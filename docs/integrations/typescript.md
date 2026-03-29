# Using Mnemo with TypeScript / Next.js

Mnemo's Python SDK cannot run inside Next.js or Node.js directly. Use one of these approaches:

## Option 1 — REST API (Recommended for Next.js)

The fastest way. No SDK needed. Just fetch.

Create `src/lib/mnemo.ts` in your project:

```typescript
const MNEMO_API = process.env.MNEMO_API_URL ||
  'https://mnemo-api-production.up.railway.app'

export async function mnemoTrack({
  tenantId,
  agentId,
  prompt,
  response,
  userId,
  latencyMs,
  complianceMode = 'standard',
}: {
  tenantId: string
  agentId: string
  prompt: string
  response: string
  userId?: string
  latencyMs?: number
  complianceMode?: string
}) {
  try {
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
        prompt,
        response,
        latency_ms: latencyMs || 0,
        compliance_mode: complianceMode,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (err) {
    // Silent fail — never break the user experience
    console.error('[mnemo] tracking failed:', err)
  }
}
```

Then in your API route:

```typescript
import { mnemoTrack } from '@/lib/mnemo'

const start = Date.now()
const response = await yourLLM.complete(prompt)

// Fire and forget — non-blocking
mnemoTrack({
  tenantId: 'your-company',
  agentId: 'your-agent-name',
  prompt: userMessage,
  response: response.text,
  latencyMs: Date.now() - start,
})
```

Add to `.env.local`:
```
MNEMO_API_URL=https://mnemo-api-production.up.railway.app
```

## Option 2 — TypeScript SDK

Install from source (npm publish coming soon):

```bash
cd sdk/typescript && npm install && npm run build
```

```typescript
import { MnemoClient } from 'mnemo-sdk'

const mnemo = new MnemoClient({ tenantId: 'my-company' })

const result = await mnemo.run({
  agentId: 'my-agent',
  prompt: userMessage,
  response: aiResponse,
  latencyMs: 1200,
})

console.log(result.copSummary) // AI Cop analysis
```

## Framework Quick Start Guides

### Next.js App Router

```typescript
// app/api/chat/route.ts
import { mnemoTrack } from '@/lib/mnemo'

export async function POST(req: Request) {
  const { prompt } = await req.json()
  const start = Date.now()
  const response = await yourLLM.complete(prompt)

  // Non-blocking — never slows the response
  mnemoTrack({
    tenantId: 'my-company',
    agentId: 'chat-agent',
    prompt,
    response: response.text,
    latencyMs: Date.now() - start,
  }).catch(() => {})

  return Response.json({ response: response.text })
}
```

### Express.js / Node.js

```javascript
const { MnemoClient } = require('mnemo-sdk')

const mnemo = new MnemoClient({ tenantId: 'my-company' })

app.post('/chat', async (req, res) => {
  const start = Date.now()
  const response = await myLLM.complete(req.body.prompt)

  mnemo.run({
    agentId: 'express-agent',
    prompt: req.body.prompt,
    response: response.text,
    latencyMs: Date.now() - start,
  }).catch(console.error)

  res.json({ response: response.text })
})
```

### LangChain (Python)

```python
from mnemo import MnemoClient
from mnemo.client import LLMConfig

mnemo = MnemoClient(tenant_id="my-company")

def langchain_agent(prompt):
    llm = Anthropic()
    start = time.time()
    response = llm(prompt)

    mnemo.run(
        agent_id="langchain-agent",
        prompt=prompt,
    )
    return response
```

### CrewAI (Python)

```python
from mnemo import MnemoClient
from crewai import Crew

mnemo = MnemoClient(tenant_id="my-company")

def run_crew_with_mnemo(crew, inputs):
    start = time.time()
    result = crew.kickoff(inputs=inputs)

    mnemo.run(
        agent_id="crewai-agent",
        prompt=str(inputs),
    )
    return result
```

### OpenAI Agents SDK (Python)

```python
from mnemo import MnemoClient
from agents import Agent, Runner

mnemo = MnemoClient(tenant_id="my-company")

agent = Agent(name="my-agent", instructions="...")

async def run_with_mnemo(user_input):
    result = await Runner.run(agent, user_input)
    mnemo.run(
        agent_id="openai-agent",
        prompt=user_input,
    )
    return result
```

### Google ADK (Python)

```python
from mnemo import MnemoClient
import google.adk as adk

mnemo = MnemoClient(tenant_id="my-company")

def run_adk(prompt):
    response = adk.run(prompt)
    mnemo.run(agent_id="adk-agent", prompt=prompt)
    return response
```
