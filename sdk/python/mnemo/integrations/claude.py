"""
Mnemo + Anthropic Claude integration.

Complete working example — copy this into your project and go.

Usage:
    from mnemo.integrations.claude import create_claude_agent, run_with_claude

    # Option 1: Quick one-shot call
    result = run_with_claude(
        tenant_id="my-company",
        agent_id="support-bot",
        prompt="Help the user with their refund",
    )

    # Option 2: Persistent client for multiple runs
    agent = create_claude_agent(tenant_id="my-company")
    result = agent.run(agent_id="support-bot", prompt="Hello!")
"""

from __future__ import annotations

import os
from typing import Any, Optional

from mnemo.client import LLMConfig, MnemoClient, RunResult


def create_claude_agent(
    tenant_id: str,
    *,
    model: str = "claude-sonnet-4-20250514",
    api_key: Optional[str] = None,
    debug: bool = False,
    **kwargs: Any,
) -> MnemoClient:
    """
    Create a MnemoClient pre-configured for Anthropic Claude.

    Args:
        tenant_id: Your tenant identifier for multi-tenant isolation.
        model: Claude model to use. Defaults to claude-sonnet-4-20250514.
        api_key: Anthropic API key. Falls back to ANTHROPIC_API_KEY env var.
        debug: Enable debug logging.
        **kwargs: Additional kwargs passed to MnemoClient.

    Returns:
        A configured MnemoClient ready to call .run().
    """
    return MnemoClient(
        tenant_id=tenant_id,
        llm=LLMConfig(
            provider="anthropic",
            model=model,
            api_key=api_key or os.getenv("ANTHROPIC_API_KEY"),
        ),
        debug=debug,
        **kwargs,
    )


def run_with_claude(
    tenant_id: str,
    agent_id: str,
    prompt: str,
    *,
    model: str = "claude-sonnet-4-20250514",
    api_key: Optional[str] = None,
    user_id: Optional[str] = None,
    system_prompt: Optional[str] = None,
    debug: bool = False,
) -> RunResult:
    """
    One-shot: create a Claude-powered agent and run it in a single call.

    This is the simplest way to use Mnemo with Claude.
    For multiple runs, use create_claude_agent() instead.

    Args:
        tenant_id: Your tenant identifier.
        agent_id: Unique identifier for this agent.
        prompt: The user's input prompt.
        model: Claude model to use.
        api_key: Anthropic API key.
        user_id: Optional user identifier for per-user memory.
        system_prompt: Optional system prompt override.
        debug: Enable debug logging.

    Returns:
        RunResult with response, memories, trace URL, and alerts.
    """
    client = create_claude_agent(
        tenant_id=tenant_id,
        model=model,
        api_key=api_key,
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
#   python -m mnemo.integrations.claude
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()

    print("Running Mnemo + Claude integration test...\n")

    result = run_with_claude(
        tenant_id="integration-test",
        agent_id="claude-test",
        prompt="What makes a great developer tool? Give me 3 principles.",
        debug=True,
    )

    print(f"\nResponse:\n{result.response}")
    print(f"\nMemories injected: {result.memories_injected}")
    print(f"Memories created:  {result.memories_created}")
    print(f"Trace URL:         {result.trace_url}")
    print(f"Duration:          {result.duration_ms:.0f}ms")
