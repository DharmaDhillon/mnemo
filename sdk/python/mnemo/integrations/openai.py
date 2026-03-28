"""
Mnemo + OpenAI integration.

Complete working example — copy this into your project and go.

Usage:
    from mnemo.integrations.openai import create_openai_agent, run_with_openai

    # Option 1: Quick one-shot call
    result = run_with_openai(
        tenant_id="my-company",
        agent_id="analyst",
        prompt="Summarize Q4 revenue trends",
    )

    # Option 2: Persistent client for multiple runs
    agent = create_openai_agent(tenant_id="my-company", model="gpt-4o")
    result = agent.run(agent_id="analyst", prompt="Hello!")
"""

from __future__ import annotations

import os
from typing import Any, Optional

from mnemo.client import LLMConfig, MnemoClient, RunResult


def create_openai_agent(
    tenant_id: str,
    *,
    model: str = "gpt-4o",
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    debug: bool = False,
    **kwargs: Any,
) -> MnemoClient:
    """
    Create a MnemoClient pre-configured for OpenAI.

    Args:
        tenant_id: Your tenant identifier for multi-tenant isolation.
        model: OpenAI model to use. Defaults to gpt-4o.
        api_key: OpenAI API key. Falls back to OPENAI_API_KEY env var.
        base_url: Optional custom base URL (for Azure OpenAI, local models, etc).
        debug: Enable debug logging.
        **kwargs: Additional kwargs passed to MnemoClient.

    Returns:
        A configured MnemoClient ready to call .run().
    """
    return MnemoClient(
        tenant_id=tenant_id,
        llm=LLMConfig(
            provider="openai",
            model=model,
            api_key=api_key or os.getenv("OPENAI_API_KEY"),
            base_url=base_url,
        ),
        debug=debug,
        **kwargs,
    )


def run_with_openai(
    tenant_id: str,
    agent_id: str,
    prompt: str,
    *,
    model: str = "gpt-4o",
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    user_id: Optional[str] = None,
    system_prompt: Optional[str] = None,
    debug: bool = False,
) -> RunResult:
    """
    One-shot: create an OpenAI-powered agent and run it in a single call.

    Args:
        tenant_id: Your tenant identifier.
        agent_id: Unique identifier for this agent.
        prompt: The user's input prompt.
        model: OpenAI model to use.
        api_key: OpenAI API key.
        base_url: Optional custom base URL.
        user_id: Optional user identifier for per-user memory.
        system_prompt: Optional system prompt override.
        debug: Enable debug logging.

    Returns:
        RunResult with response, memories, trace URL, and alerts.
    """
    client = create_openai_agent(
        tenant_id=tenant_id,
        model=model,
        api_key=api_key,
        base_url=base_url,
        debug=debug,
    )
    return client.run(
        agent_id=agent_id,
        prompt=prompt,
        user_id=user_id,
        system_prompt=system_prompt,
    )


# ---------------------------------------------------------------------------
# Standalone example — run this file directly to test:
#   python -m mnemo.integrations.openai
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()

    print("Running Mnemo + OpenAI integration test...\n")

    result = run_with_openai(
        tenant_id="integration-test",
        agent_id="openai-test",
        prompt="What makes a great developer tool? Give me 3 principles.",
        debug=True,
    )

    print(f"\nResponse:\n{result.response}")
    print(f"\nMemories injected: {result.memories_injected}")
    print(f"Memories created:  {result.memories_created}")
    print(f"Trace URL:         {result.trace_url}")
    print(f"Duration:          {result.duration_ms:.0f}ms")
