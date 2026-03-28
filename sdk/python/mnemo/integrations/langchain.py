"""
Mnemo + LangChain integration.

STATUS: Stub — implementation coming in v0.2.0.

Planned usage:
    from mnemo.integrations.langchain import MnemoLangChainCallback

    from langchain_anthropic import ChatAnthropic
    from langchain_core.messages import HumanMessage

    llm = ChatAnthropic(model="claude-sonnet-4-20250514")

    # Add Mnemo as a LangChain callback — automatic memory + tracing
    callback = MnemoLangChainCallback(
        tenant_id="my-company",
        agent_id="langchain-bot",
    )

    response = llm.invoke(
        [HumanMessage(content="Hello!")],
        config={"callbacks": [callback]},
    )
"""

from __future__ import annotations

from typing import Any


class MnemoLangChainCallback:
    """
    LangChain callback handler that adds Mnemo memory and tracing.

    TODO: Implement in v0.2.0
    - Hook into on_llm_start to inject memories
    - Hook into on_llm_end to store memories and log traces
    - Hook into on_chain_start/end for full chain tracing
    - Support LangGraph state persistence
    """

    def __init__(
        self,
        tenant_id: str,
        agent_id: str,
        **kwargs: Any,
    ) -> None:
        raise NotImplementedError(
            "LangChain integration is coming in Mnemo v0.2.0. "
            "For now, use MnemoClient directly with a custom call_fn:\n\n"
            "  from mnemo import MnemoClient\n"
            "  from mnemo.client import LLMConfig\n\n"
            "  def langchain_call(enriched_prompt):\n"
            "      llm = ChatAnthropic(model='claude-sonnet-4-20250514')\n"
            "      return llm.invoke([HumanMessage(content=enriched_prompt['prompt'])])\n\n"
            "  mnemo = MnemoClient(\n"
            "      tenant_id='my-company',\n"
            "      llm=LLMConfig(provider='custom', call_fn=langchain_call),\n"
            "  )"
        )
