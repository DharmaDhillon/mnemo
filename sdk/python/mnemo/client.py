"""
MnemoClient — the core class that gives any AI agent memory and observability.

Two lines of code. That's all it takes:

    mnemo = MnemoClient(tenant_id="acme-corp")
    response = mnemo.run(agent_id="support-bot", prompt="Help the user")

What happens behind the scenes:
    1. Retrieves relevant memories from this agent's past runs
    2. Injects those memories into the prompt context
    3. Calls the LLM (any provider — Claude, OpenAI, anything)
    4. Logs the full trace to Langfuse + OpenTelemetry
    5. Extracts new memories from the completed run
    6. Checks alert rules and fires if needed
    7. Returns the response — unchanged, unmodified
"""

from __future__ import annotations

import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from mnemo.alerts import AlertEngine, AlertRule
from mnemo.compliance import ComplianceLayer, ComplianceMode
from mnemo.memory import MemoryManager
from mnemo.tracer import Tracer, TraceEvent


@dataclass
class RunResult:
    """The result of a single agent run through Mnemo."""

    response: Any
    run_id: str
    agent_id: str
    tenant_id: str
    memories_injected: int
    memories_created: int
    trace_url: Optional[str]
    duration_ms: float
    alerts_fired: list[str] = field(default_factory=list)


@dataclass
class LLMConfig:
    """Configuration for the LLM provider."""

    provider: str  # "anthropic", "openai", "custom"
    model: str = "claude-sonnet-4-20250514"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    call_fn: Optional[Callable[..., Any]] = None  # custom LLM call function


class MnemoClient:
    """
    The main entry point for Mnemo.

    Wraps any LLM call with automatic memory injection, trace logging,
    and alert detection. Works with any provider — Anthropic, OpenAI,
    LangChain, or a raw HTTP endpoint.
    """

    def __init__(
        self,
        tenant_id: str,
        *,
        llm: Optional[LLMConfig] = None,
        mem0_api_key: Optional[str] = None,
        langfuse_public_key: Optional[str] = None,
        langfuse_secret_key: Optional[str] = None,
        otel_endpoint: Optional[str] = None,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        compliance_mode: Optional[ComplianceMode] = None,
        debug: bool = False,
    ) -> None:
        self.tenant_id = tenant_id
        self.debug = debug or os.getenv("MNEMO_DEBUG", "").lower() == "true"

        # LLM configuration — can be set later via configure_llm()
        self.llm = llm

        # Initialize subsystems
        self.memory = MemoryManager(
            tenant_id=tenant_id,
            api_key=mem0_api_key or os.getenv("MNEMO_MEM0_API_KEY"),
            debug=self.debug,
        )

        self.tracer = Tracer(
            tenant_id=tenant_id,
            langfuse_public_key=langfuse_public_key or os.getenv("MNEMO_LANGFUSE_PUBLIC_KEY"),
            langfuse_secret_key=langfuse_secret_key or os.getenv("MNEMO_LANGFUSE_SECRET_KEY"),
            otel_endpoint=otel_endpoint or os.getenv("MNEMO_OPENTELEMETRY_ENDPOINT"),
            debug=self.debug,
        )

        self.alerts = AlertEngine(
            tenant_id=tenant_id,
            tracer=self.tracer,
            debug=self.debug,
        )

        self.compliance: Optional[ComplianceLayer] = None
        if compliance_mode:
            self.compliance = ComplianceLayer(
                tenant_id=tenant_id,
                mode=compliance_mode,
                debug=self.debug,
            )

        self._log("MnemoClient initialized", tenant_id=tenant_id)

    def configure_llm(self, llm: LLMConfig) -> None:
        """Set or update the LLM configuration after initialization."""
        self.llm = llm
        self._log("LLM configured", provider=llm.provider, model=llm.model)

    def run(
        self,
        agent_id: str,
        prompt: str,
        *,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        memory_limit: int = 10,
        system_prompt: Optional[str] = None,
    ) -> RunResult:
        """
        Execute a single agent run with full memory and observability.

        This is the main method. It:
        1. Retrieves relevant memories for this agent
        2. Builds an enriched prompt with memory context
        3. Calls the LLM
        4. Logs the full trace
        5. Extracts and stores new memories
        6. Evaluates alert rules
        7. Returns the result

        Args:
            agent_id: Unique identifier for this agent.
            prompt: The user's input prompt.
            user_id: Optional user identifier for per-user memory.
            session_id: Optional session identifier for grouping runs.
            metadata: Optional key-value metadata attached to the trace.
            memory_limit: Max number of memories to inject (default 10).
            system_prompt: Optional system prompt override.

        Returns:
            RunResult with the LLM response and run metadata.
        """
        run_id = str(uuid.uuid4())
        start_time = time.monotonic()

        # Start trace
        trace = self.tracer.start_trace(
            run_id=run_id,
            agent_id=agent_id,
            user_id=user_id,
            session_id=session_id,
            metadata=metadata or {},
        )

        try:
            # Step 1: Retrieve relevant memories
            self.tracer.log_event(trace, TraceEvent.MEMORY_RETRIEVAL_START)
            memories = self.memory.retrieve(
                agent_id=agent_id,
                query=prompt,
                user_id=user_id,
                limit=memory_limit,
            )
            self.tracer.log_event(
                trace,
                TraceEvent.MEMORY_RETRIEVAL_END,
                data={"count": len(memories)},
            )

            # Step 2: Build enriched prompt
            enriched_prompt = self._build_prompt(
                prompt=prompt,
                memories=memories,
                system_prompt=system_prompt,
            )

            # Step 3: Call the LLM
            self.tracer.log_event(trace, TraceEvent.LLM_CALL_START)
            response = self._call_llm(enriched_prompt, agent_id=agent_id)
            self.tracer.log_event(
                trace,
                TraceEvent.LLM_CALL_END,
                data={"response_length": len(str(response))},
            )

            # Step 4: Extract and store new memories
            self.tracer.log_event(trace, TraceEvent.MEMORY_STORAGE_START)
            new_memories = self.memory.extract_and_store(
                agent_id=agent_id,
                prompt=prompt,
                response=str(response),
                user_id=user_id,
            )
            self.tracer.log_event(
                trace,
                TraceEvent.MEMORY_STORAGE_END,
                data={"count": new_memories},
            )

            # Step 5: Evaluate alerts
            alerts_fired = self.alerts.evaluate(
                run_id=run_id,
                agent_id=agent_id,
                prompt=prompt,
                response=str(response),
                memories_injected=len(memories),
                duration_ms=(time.monotonic() - start_time) * 1000,
            )

            # Step 6: Compliance logging
            if self.compliance:
                self.compliance.log_decision(
                    run_id=run_id,
                    agent_id=agent_id,
                    prompt=prompt,
                    response=str(response),
                    memories_used=len(memories),
                )

            duration_ms = (time.monotonic() - start_time) * 1000
            trace_url = self.tracer.end_trace(trace, status="success")

            return RunResult(
                response=response,
                run_id=run_id,
                agent_id=agent_id,
                tenant_id=self.tenant_id,
                memories_injected=len(memories),
                memories_created=new_memories,
                trace_url=trace_url,
                duration_ms=duration_ms,
                alerts_fired=alerts_fired,
            )

        except Exception as exc:
            duration_ms = (time.monotonic() - start_time) * 1000
            self.tracer.log_event(
                trace,
                TraceEvent.ERROR,
                data={"error": str(exc), "type": type(exc).__name__},
            )
            self.tracer.end_trace(trace, status="error")
            raise

    def add_alert_rule(self, rule: AlertRule) -> None:
        """Register an alert rule that fires when conditions are met."""
        self.alerts.add_rule(rule)

    def get_memories(
        self,
        agent_id: str,
        *,
        user_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Retrieve all stored memories for an agent."""
        return self.memory.list_memories(
            agent_id=agent_id,
            user_id=user_id,
            limit=limit,
        )

    def clear_memories(
        self,
        agent_id: str,
        *,
        user_id: Optional[str] = None,
    ) -> int:
        """Delete all memories for an agent. Returns count of deleted memories."""
        return self.memory.clear(agent_id=agent_id, user_id=user_id)

    def _build_prompt(
        self,
        prompt: str,
        memories: list[dict[str, Any]],
        system_prompt: Optional[str],
    ) -> dict[str, Any]:
        """Build the enriched prompt with injected memories."""
        memory_block = ""
        if memories:
            memory_lines = []
            for mem in memories:
                score = mem.get("score", 0)
                text = mem.get("text", "")
                mem_type = mem.get("type", "episodic")
                memory_lines.append(f"  [{mem_type}, relevance={score:.2f}] {text}")
            memory_block = (
                "\n<agent_memory>\n"
                "The following memories from your past runs may be relevant:\n"
                + "\n".join(memory_lines)
                + "\n</agent_memory>\n\n"
            )

        system = system_prompt or "You are a helpful assistant."
        full_user_prompt = memory_block + prompt

        return {
            "system": system,
            "prompt": full_user_prompt,
            "raw_prompt": prompt,
            "memories": memories,
        }

    def _call_llm(self, enriched_prompt: dict[str, Any], agent_id: str) -> Any:
        """
        Call the configured LLM provider.

        Supports Anthropic, OpenAI, and custom call functions.
        Falls back to returning the enriched prompt if no LLM is configured
        (useful for testing and trace-only mode).
        """
        if not self.llm:
            self._log("No LLM configured — returning prompt in passthrough mode")
            return {
                "mode": "passthrough",
                "message": "No LLM configured. Set llm= in MnemoClient or call configure_llm().",
                "enriched_prompt": enriched_prompt["prompt"],
            }

        if self.llm.call_fn:
            return self.llm.call_fn(enriched_prompt)

        if self.llm.provider == "anthropic":
            return self._call_anthropic(enriched_prompt)
        elif self.llm.provider == "openai":
            return self._call_openai(enriched_prompt)
        else:
            raise ValueError(
                f"Unknown LLM provider '{self.llm.provider}'. "
                f"Use 'anthropic', 'openai', or set a custom call_fn."
            )

    def _call_anthropic(self, enriched_prompt: dict[str, Any]) -> str:
        """Call the Anthropic Claude API."""
        try:
            import anthropic
        except ImportError:
            raise ImportError(
                "Install the Anthropic SDK: pip install anthropic"
            )

        api_key = self.llm.api_key or os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("Anthropic API key required. Set ANTHROPIC_API_KEY or pass api_key in LLMConfig.")

        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=self.llm.model,
            max_tokens=4096,
            system=enriched_prompt["system"],
            messages=[{"role": "user", "content": enriched_prompt["prompt"]}],
        )
        return message.content[0].text

    def _call_openai(self, enriched_prompt: dict[str, Any]) -> str:
        """Call the OpenAI API."""
        try:
            import openai
        except ImportError:
            raise ImportError(
                "Install the OpenAI SDK: pip install openai"
            )

        api_key = self.llm.api_key or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OpenAI API key required. Set OPENAI_API_KEY or pass api_key in LLMConfig.")

        client = openai.OpenAI(api_key=api_key, base_url=self.llm.base_url)
        response = client.chat.completions.create(
            model=self.llm.model,
            messages=[
                {"role": "system", "content": enriched_prompt["system"]},
                {"role": "user", "content": enriched_prompt["prompt"]},
            ],
        )
        return response.choices[0].message.content

    def _log(self, message: str, **kwargs: Any) -> None:
        """Internal debug logging."""
        if self.debug:
            extra = " ".join(f"{k}={v}" for k, v in kwargs.items())
            print(f"[mnemo] {message} {extra}".strip())
