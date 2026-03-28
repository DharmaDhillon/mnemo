# Contributing to Mnemo

Mnemo is MIT licensed and welcomes contributions from everyone.

## Getting Started

```bash
git clone https://github.com/mnemo-ai/mnemo
cd mnemo

# Install the SDK in editable mode with dev dependencies
pip install -e "sdk/python[all,dev]"

# Copy the environment template
cp .env.example .env
# Fill in your API keys in .env
```

## Project Structure

```
mnemo/
  sdk/python/mnemo/     Python SDK (the core — start here)
  sdk/typescript/       TypeScript SDK (secondary)
  api/                  FastAPI backend
  dashboard/            Next.js dashboard
  db/                   Supabase schema + RLS policies
```

## What to Work On

Check the [Issues](https://github.com/mnemo-ai/mnemo/issues) tab for open tasks. Good first issues are labeled `good-first-issue`.

**High-impact areas right now:**

- **Integrations** — add support for CrewAI, Google ADK, or other frameworks in `sdk/python/mnemo/integrations/`
- **LangChain callback** — implement the stub in `integrations/langchain.py`
- **Dashboard** — build out the Next.js dashboard in `dashboard/`
- **Tests** — add unit and integration tests
- **Documentation** — improve integration guides in `docs/`

## Development Workflow

1. **Fork and clone** the repository
2. **Create a branch** for your work: `git checkout -b feat/my-feature`
3. **Make your changes** — follow the code style of existing files
4. **Run the linter**: `ruff check sdk/python/`
5. **Run type checking**: `mypy sdk/python/mnemo/`
6. **Test your changes**: `python test_mnemo.py` (requires API keys in `.env`)
7. **Commit** with a clear message describing what and why
8. **Open a pull request** against `main`

## Code Style

- Python: type hints on every function, follow ruff defaults
- TypeScript: JSDoc on every public function
- Error messages should be human-readable and actionable
- Debug logging via `self._log()` — only prints when `MNEMO_DEBUG=true`
- Lazy-initialize external clients (don't fail at import time if a dep is missing)

## Architecture Principles

- **Don't rebuild what exists** — we use Mem0 for memory and Langfuse for tracing
- **Tenant isolation is non-negotiable** — every data path must be scoped by `tenant_id`
- **Graceful degradation** — if Mem0 is down, the LLM call still works; if Langfuse is down, memories still work
- **Zero required dependencies** — the base `pip install mnemo` has no deps; integrations are optional extras

## Adding a New Integration

Create a file in `sdk/python/mnemo/integrations/`:

```python
"""
Mnemo + YourProvider integration.
"""
from mnemo.client import LLMConfig, MnemoClient

def create_yourprovider_agent(tenant_id, *, model="default-model", **kwargs):
    return MnemoClient(
        tenant_id=tenant_id,
        llm=LLMConfig(provider="custom", call_fn=_call_yourprovider),
        **kwargs,
    )

def _call_yourprovider(enriched_prompt):
    # Call the provider's API with enriched_prompt["prompt"]
    # Return the response text
    ...
```

## Questions?

Open an issue or start a discussion on GitHub. We're friendly.
