<p align="center">
  <img src="./logo/mnemo_logo.svg" alt="Mnemo" width="360" />
</p>

<h1 align="center">Mnemo</h1>

<p align="center"><strong>The AI that watches your AI.</strong></p>

<p align="center">
Memory + observability + behavioral analysis for AI agents.<br/>
Two lines of code. Works with any LLM.
</p>

<p align="center">
  <a href="https://pypi.org/project/mnemo-sdk/"><img src="https://img.shields.io/pypi/v/mnemo-sdk" alt="PyPI" /></a>
  <a href="https://github.com/DharmaDhillon/mnemo"><img src="https://img.shields.io/github/stars/DharmaDhillon/mnemo" alt="GitHub stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://www.python.org/downloads/"><img src="https://img.shields.io/badge/python-3.10+-blue.svg" alt="Python 3.10+" /></a>
</p>

<p align="center"><code>pip install mnemo-sdk[all]</code></p>

---

```python
from mnemo import MnemoClient
from mnemo.client import LLMConfig

mnemo = MnemoClient(
    tenant_id="my-company",
    llm=LLMConfig(provider="anthropic", model="claude-sonnet-4-20250514"),
)

result = mnemo.run(
    agent_id="my-agent",
    prompt="Help the user with their refund",
    user_id="user-123",
)

print(result.response)           # LLM response
print(result.memories_injected)  # memories from past runs injected
print(result.memories_created)   # new memories stored from this run
print(result.trace_url)          # clickable Langfuse trace URL
```

That's it. Your agent now remembers every past interaction, has full trace visibility, and is being watched by an AI safety monitor.

---

## The problem

Every AI framework teaches agents to think. Nobody taught them to remember. And nobody is watching what they decide.

**Without Mnemo:**
> **Student:** "What did I build in the past, do you remember?"
>
> **Agent:** "I don't have access to your previous projects — my memory is starting fresh!"

**With Mnemo:**
> **Student:** "What did I build in the past, do you remember?"
>
> **Agent:** "Yes! You built a weather app last session with rain animations! Want to level it up or build something new?"

*Real conversation from [MiniFounder.ai](https://minifounder.ai) — our first production customer.*

---

## What Mnemo does

Mnemo is three layers in one SDK:

### Layer 1 — Memory

Persistent memory across every agent run, powered by [Mem0](https://github.com/mem0ai/mem0). Three types:

| Type | What it stores | Example |
|---|---|---|
| **Episodic** | What happened in past runs | "User built a weather app with rain animations in session 3" |
| **Semantic** | Facts about users and domains | "This user is on the Enterprise plan, prefers visual explanations" |
| **Pattern** | Learned failure/success modes | "Showing examples first works 3x better than text for this student" |

Memories are scoped per tenant, per agent, per user. Multi-tenant isolation is enforced — customer A never sees customer B's data.

### Layer 2 — Observability

Every agent decision traced via [Langfuse](https://github.com/langfuse/langfuse) + OpenTelemetry. Each `mnemo.run()` produces:

- A complete trace of every step (memory retrieval → LLM call → memory storage)
- A clickable Langfuse URL in `result.trace_url`
- OpenTelemetry spans for Datadog, Grafana, AWS CloudWatch

### Layer 3 — AI Cop

After every run, Claude Haiku automatically analyzes the interaction for safety, quality, and alignment. No keyword lists. No rules. Pure AI judgment.

Real output from MiniFounder.ai:

> **vibe-agent** · ok · sev 1/10
> *"Vibe-agent provided helpful, age-appropriate guidance on creating animated rain effects for a weather app with no red flags detected."*

> **shield-agent** · warning · sev 5/10
> *"Shield-agent correctly flagged the input as mild profanity but failed to enforce COPPA's conservative standard for child safety by not issuing a stronger intervention."*

The AI cop caught that Shield was too lenient for a children's platform — before any human noticed. That's behavioral observability.

Available on Solo and Teams plans. Free tier stores runs and memories but skips AI analysis.

---

## Mission Control

Every agent you connect appears automatically at [usemnemo.com/dashboard/cop](https://usemnemo.com/dashboard/cop):

- **Agents needing attention** — red/amber agents with active issues
- **Healthy agents** — green agents operating normally
- **Live analysis feed** — every run analyzed in real time with cop summaries
- **Drift detection** — behavioral changes caught automatically across recent history

No setup. No configuration. Connect the SDK, send a run, your agents appear.

---

## Quick Start

### Python SDK

```bash
pip install mnemo-sdk[all]
```

```python
from mnemo import MnemoClient
from mnemo.client import LLMConfig

mnemo = MnemoClient(
    tenant_id="my-company",
    llm=LLMConfig(provider="anthropic", model="claude-sonnet-4-20250514"),
)

result = mnemo.run(
    agent_id="support-bot",
    prompt="The user wants to cancel their subscription",
    user_id="user-123",
)

print(result.response)
print(f"Memories used: {result.memories_injected}")
print(f"New memories: {result.memories_created}")
print(f"Trace: {result.trace_url}")
```

### TypeScript / Next.js (REST API)

No package install needed. Create `src/lib/mnemo.ts`:

```typescript
const MNEMO_API = process.env.MNEMO_API_URL
  || 'https://mnemo-api-production.up.railway.app'

export async function mnemoTrack({
  tenantId, agentId, prompt, response,
  userId, latencyMs,
}: {
  tenantId: string; agentId: string;
  prompt: string; response: string;
  userId?: string; latencyMs?: number;
}) {
  await fetch(`${MNEMO_API}/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId,
    },
    body: JSON.stringify({
      run_id: crypto.randomUUID(),
      agent_id: agentId,
      tenant_id: tenantId,
      user_id: userId || 'anonymous',
      prompt, response,
      latency_ms: latencyMs || 0,
      timestamp: new Date().toISOString(),
    }),
  })
}
```

Then in any API route:

```typescript
const start = Date.now()
const response = await yourLLM.complete(prompt)

// Fire and forget — non-blocking
mnemoTrack({
  tenantId: 'my-company',
  agentId: 'my-agent',
  prompt: userMessage,
  response: response.text,
  latencyMs: Date.now() - start,
}).catch(() => {})
```

Full TypeScript guide: [docs/integrations/typescript.md](docs/integrations/typescript.md)

### Use with OpenAI

```python
mnemo = MnemoClient(
    tenant_id="my-company",
    llm=LLMConfig(provider="openai", model="gpt-4o"),
)
result = mnemo.run(agent_id="analyst", prompt="Summarize Q4 trends")
```

### Use with any LLM

```python
def my_llm(enriched_prompt):
    return my_model.generate(enriched_prompt["prompt"])

mnemo = MnemoClient(
    tenant_id="my-company",
    llm=LLMConfig(provider="custom", call_fn=my_llm),
)
```

---

## AI Cop — how it works

After every `mnemo.run()` call, the Mnemo API calls Claude Haiku to analyze the interaction. The analysis is stored on the run record and available in the dashboard.

The AI Cop evaluates:
- Does the response match expected behavior for this agent?
- Did behavior change from past runs?
- Safety, quality, or alignment concerns?
- COPPA/HIPAA compliance if applicable?
- Signs of prompt injection or jailbreaking?
- Quality degradation vs baseline?

Each run gets a structured judgment:

| Field | Type | Example |
|---|---|---|
| `status` | ok / warning / critical | "warning" |
| `severity` | 0-10 | 5 |
| `cop_summary` | One-line case note | "Shield was too lenient for COPPA" |
| `categories` | safety, scope, drift, etc. | ["compliance", "safety"] |
| `action` | none / alert_human / pause_agent | "alert_human" |
| `reasoning` | Plain english explanation | "Failed to enforce conservative standard" |

When `action` is `alert_human` or `pause_agent`, an alert is created automatically and appears in Mission Control.

---

## Drift Detection

Mnemo tracks analysis results across recent runs per agent. When patterns emerge, a drift alert fires:

```
Behavioral drift detected for trading-agent.
7/10 recent runs flagged.
Avg severity 6.2/10.
Recurring issues: scope, behavior_change.
```

Drift is checked after every run. Alerts are deduplicated (max one per agent per hour). They appear in Mission Control and can trigger webhooks.

---

## Compliance

```python
from mnemo.compliance import ComplianceMode

# COPPA — children's platforms
mnemo = MnemoClient(
    tenant_id="minifounder",
    compliance_mode=ComplianceMode.COPPA,
)
# Content masked in dashboard, wellbeing alerts,
# parent notifications, COPPA audit log

# HIPAA — healthcare
mnemo = MnemoClient(
    tenant_id="hospital-abc",
    compliance_mode=ComplianceMode.HIPAA,
)
# Prompts stored as SHA-256 hashes, 6-year retention,
# full decision audit trail, regulator-ready export

# FERPA — education
mnemo = MnemoClient(
    tenant_id="university",
    compliance_mode=ComplianceMode.FERPA,
)
```

Compliance audit reports can be exported as JSON:

```python
report = mnemo.compliance.export_audit_json(agent_id="triage-bot")
```

---

## Smart Alerts

Built-in alert rules fire automatically:

| Alert | When it fires |
|---|---|
| **High latency** | Run takes >10 seconds |
| **No memories** | Agent has no context from past runs |
| **Shield violation** | Content blocked by safety agent |
| **AI Cop critical** | AI analysis flags severity >7 |
| **Drift detected** | 3+ of last 10 runs flagged |

Custom alert rules can be added:

```python
from mnemo.alerts import AlertRule, AlertCondition

mnemo.add_alert_rule(AlertRule(
    name="slow_response",
    condition=AlertCondition.LATENCY_HIGH,
    threshold=5000,  # 5 seconds
    webhook_url="https://hooks.slack.com/...",
))
```

---

## Framework Support

| Framework | Language | Integration |
|---|---|---|
| **Python SDK** | Python | `pip install mnemo-sdk[all]` |
| **REST API** | Any | `POST /ingest` — works everywhere |
| **Next.js** | TypeScript | REST API — [guide](docs/integrations/typescript.md) |
| **LangChain** | Python | Python SDK — wrap your chain |
| **CrewAI** | Python | Python SDK — wrap crew.kickoff() |
| **OpenAI Agents** | Python | Python SDK — wrap Runner.run() |
| **Google ADK** | Python | Python SDK — wrap adk.run() |
| **Express/Node** | JavaScript | REST API — [guide](docs/integrations/typescript.md) |

---

## Architecture

```
Your Agent Code
       |
       v
  MnemoClient.run()
       |
  ┌────┼────────┬──────────┬────────────┐
  v    v        v          v            v
Mem0  LLM    Langfuse   Claude Haiku  Supabase
  |   Call   + OTel     (AI Cop)      (runs +
  |    |     tracing    analysis       alerts)
  v    v        |          |            |
Memory  Response  Trace    Judgment     Drift
retrieve  back   URL      stored      detection
+ store           |          |
       ┌──────────┼──────────┘
       v
  RunResult {
    response, memories_injected,
    memories_created, trace_url,
    duration_ms, alerts_fired
  }
```

We don't rebuild these tools — we orchestrate them. Mem0 handles memory. Langfuse handles traces. Claude handles behavioral analysis. Supabase handles multi-tenant storage. Mnemo is the bridge.

---

## API Reference

The Mnemo API runs at `https://mnemo-api-production.up.railway.app` for cloud customers, or on your own Railway for self-hosters.

### POST /ingest

Send a completed agent run for storage, memory extraction, and AI Cop analysis.

```bash
curl -X POST https://mnemo-api-production.up.railway.app/ingest \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: my-company" \
  -d '{
    "run_id": "unique-id",
    "agent_id": "my-agent",
    "tenant_id": "my-company",
    "user_id": "user-123",
    "prompt": "user message",
    "response": "agent response",
    "latency_ms": 1200,
    "compliance_mode": "standard",
    "timestamp": "2026-03-29T00:00:00Z"
  }'
```

Response:
```json
{
  "status": "ok",
  "run_id": "unique-id",
  "memories_created": 2,
  "cop_status": "ok",
  "cop_summary": "Agent provided helpful response with no issues detected."
}
```

### GET /health

```json
{"status": "ok", "service": "mnemo-api", "version": "0.3.0"}
```

### GET /traces/{tenant_id}

Returns recent runs for a tenant. Optional `?agent_id=` filter.

### GET /memories/{tenant_id}/{agent_id}

Returns stored memories from Mem0 for an agent.

### GET /alerts/{tenant_id}

Returns alert history. Optional `?agent_id=` filter.

### GET /agents/{tenant_id}

Returns all agents for a tenant.

### GET /cop/summary/{tenant_id}

Returns Mission Control summary: agent health, attention queue, stats.

### GET /cop/feed/{tenant_id}

Returns last 20 analyzed runs with cop summaries.

### GET /cop/drift/{tenant_id}

Returns drift detection alerts.

---

## Self-hosting

Run everything on your own infrastructure. Free forever. MIT licensed.

```bash
git clone https://github.com/DharmaDhillon/mnemo
cd mnemo/api
cp .env.example .env    # Fill in your keys
railway up              # Deploy your API
```

Full guide: [usemnemo.com/docs/self-hosting](https://usemnemo.com/docs/self-hosting)

Required services (all have free tiers):

| Service | Purpose | Free tier |
|---|---|---|
| [Supabase](https://supabase.com) | Database + auth | 500MB, 2 projects |
| [Mem0](https://app.mem0.ai) | Memory storage | 1,000 memories |
| [Langfuse](https://cloud.langfuse.com) | Observability | 50k events/month |
| [Anthropic](https://console.anthropic.com) | AI Cop analysis | Pay per use |
| [Railway](https://railway.app) | API hosting | $5 credit/month |

---

## Pricing

| Plan | Price | Runs/month | Agent types | AI Cop | Hosting |
|---|---|---|---|---|---|
| **Open Source** | Free | 1,000 | Unlimited | No | You host |
| **Cloud Solo** | $29/mo | 10,000 | 5 | Yes | We host |
| **Cloud Teams** | $99/mo | 50,000 | Unlimited | Yes | We host |
| **Enterprise** | Custom | Unlimited | Unlimited | Yes | Your choice |

Start at [usemnemo.com](https://usemnemo.com)

---

## What's working (v0.3.0)

- [x] Anthropic Claude + OpenAI integration
- [x] Custom LLM support (any provider)
- [x] Mem0 memory — episodic, semantic, pattern
- [x] Langfuse tracing + OpenTelemetry
- [x] AI Cop — Claude Haiku analyzes every run
- [x] Mission Control dashboard
- [x] Drift detection across run history
- [x] Multi-tenant isolation (Supabase RLS)
- [x] HIPAA / FERPA / COPPA compliance modes
- [x] Smart alerts with webhook support
- [x] Shield agent violation tracking
- [x] Content masking for COPPA
- [x] Adaptive activity charts
- [x] TypeScript REST API integration
- [x] Self-hosting guide
- [x] Square production payments
- [x] 20 automated API tests passing

---

## Project Structure

```
mnemo/
├── sdk/python/mnemo/        Python SDK (pip install mnemo-sdk)
│   ├── client.py            MnemoClient — core class
│   ├── memory.py            Mem0 integration
│   ├── tracer.py            Langfuse + OpenTelemetry
│   ├── alerts.py            Alert engine
│   ├── compliance.py        HIPAA/FERPA/COPPA
│   └── integrations/        Claude, OpenAI, LangChain helpers
├── sdk/typescript/          TypeScript SDK
├── api/                     FastAPI backend (Railway)
│   ├── main.py              /ingest, AI Cop, drift detection
│   └── .env.example         All required keys documented
├── dashboard/               Next.js dashboard (Vercel)
│   ├── app/dashboard/       Agents, alerts, plans, settings
│   ├── app/dashboard/cop/   Mission Control
│   └── app/docs/            Self-hosting guide
├── db/                      Supabase schema + RLS policies
├── tests/                   Automated API tests
├── docs/integrations/       TypeScript, LangChain, CrewAI guides
└── logo/                    Mnemo SVG logo
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and guidelines.

---

## License

[MIT](LICENSE) — use it however you want.

Built by [Dharma Dhillon](https://github.com/DharmaDhillon) · dharma@dharmauniversal.ai · [usemnemo.com](https://usemnemo.com)
