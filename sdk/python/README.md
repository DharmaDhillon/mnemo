# mnemo

Memory and observability for AI agents. Two lines of code.

```python
from mnemo import MnemoClient

mnemo = MnemoClient(tenant_id="your-tenant")
result = mnemo.run(agent_id="my-agent", prompt="Hello, world!")
```

That's it. Your agent now has persistent memory and full trace visibility.

## Install

```bash
pip install mnemo

# With all integrations
pip install mnemo[all]

# Pick what you need
pip install mnemo[anthropic,mem0,langfuse]
```

## What happens when you call `mnemo.run()`

1. Retrieves relevant memories from past runs
2. Injects them into the prompt context
3. Calls your LLM (Claude, OpenAI, or any custom function)
4. Logs the full trace to Langfuse + OpenTelemetry
5. Extracts new memories from the response
6. Checks alert rules and fires if needed
7. Returns the response — unchanged

## Configuration

```python
from mnemo import MnemoClient
from mnemo.client import LLMConfig

mnemo = MnemoClient(
    tenant_id="acme-corp",
    llm=LLMConfig(provider="anthropic", model="claude-sonnet-4-20250514"),
    debug=True,
)
```

Or use environment variables:

```bash
export MNEMO_MEM0_API_KEY=your-key
export MNEMO_LANGFUSE_PUBLIC_KEY=your-key
export MNEMO_LANGFUSE_SECRET_KEY=your-key
export ANTHROPIC_API_KEY=your-key
```

## License

MIT
