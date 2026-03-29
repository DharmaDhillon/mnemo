/**
 * Mnemo TypeScript SDK — Memory + observability for AI agents.
 *
 * Works by sending traces to the Mnemo API which handles
 * Mem0 memory storage, Langfuse tracing, and AI Cop analysis.
 *
 * Usage:
 *   import { MnemoClient } from 'mnemo-sdk'
 *   const mnemo = new MnemoClient({ tenantId: 'your-tenant' })
 *   await mnemo.run({ agentId: 'my-agent', prompt: '...', response: '...' })
 */

export interface MnemoConfig {
  tenantId: string;
  apiUrl?: string;
  debug?: boolean;
}

export interface MnemoRunOptions {
  agentId: string;
  prompt: string;
  response: string;
  userId?: string;
  latencyMs?: number;
  complianceMode?: "COPPA" | "HIPAA" | "FERPA" | "standard";
  metadata?: Record<string, unknown>;
}

export interface MnemoRunResult {
  runId: string;
  status: string;
  memoriesCreated: number;
  traceUrl?: string;
  copStatus?: string;
  copSummary?: string;
}

export class MnemoClient {
  private tenantId: string;
  private apiUrl: string;
  private debug: boolean;

  constructor(config: MnemoConfig) {
    this.tenantId = config.tenantId;
    this.apiUrl =
      config.apiUrl ||
      (typeof process !== "undefined" && process.env?.MNEMO_API_URL) ||
      "https://mnemo-api-production.up.railway.app";
    this.debug = config.debug || false;
  }

  /** Track an agent run — stores memory, traces, and triggers AI Cop analysis. */
  async run(options: MnemoRunOptions): Promise<MnemoRunResult> {
    const runId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      const res = await fetch(`${this.apiUrl}/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-ID": this.tenantId,
        },
        body: JSON.stringify({
          run_id: runId,
          agent_id: options.agentId,
          tenant_id: this.tenantId,
          user_id: options.userId || "anonymous",
          prompt: options.prompt,
          response: options.response,
          latency_ms: options.latencyMs || Date.now() - startTime,
          compliance_mode: options.complianceMode || "standard",
          metadata: options.metadata || {},
          timestamp: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        if (this.debug) console.error("[mnemo] ingest failed:", res.status);
        return { runId, status: "error", memoriesCreated: 0 };
      }

      const data = await res.json();

      if (this.debug) {
        console.log(`[mnemo] tracked ${options.agentId} run ${runId.slice(0, 8)}`);
      }

      return {
        runId,
        status: data.status || "ok",
        memoriesCreated: data.memories_created || 0,
        traceUrl: data.trace_url,
        copStatus: data.cop_status,
        copSummary: data.cop_summary,
      };
    } catch (err) {
      if (this.debug) console.error("[mnemo] error:", err);
      return { runId, status: "error", memoriesCreated: 0 };
    }
  }

  /** Get stored memories for an agent. */
  async getMemories(agentId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const res = await fetch(
        `${this.apiUrl}/memories/${this.tenantId}/${agentId}`,
        { headers: { "X-Tenant-ID": this.tenantId } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.memories || [];
    } catch {
      return [];
    }
  }

  /** Get alert history for an agent. */
  async getAlerts(agentId?: string): Promise<Array<Record<string, unknown>>> {
    try {
      const url = agentId
        ? `${this.apiUrl}/alerts/${this.tenantId}?agent_id=${agentId}`
        : `${this.apiUrl}/alerts/${this.tenantId}`;
      const res = await fetch(url, {
        headers: { "X-Tenant-ID": this.tenantId },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.alerts || [];
    } catch {
      return [];
    }
  }
}

/**
 * Lightweight tracking function — no class needed.
 * Fire-and-forget. Never throws. Never blocks.
 */
export async function mnemoTrack(options: {
  tenantId: string;
  agentId: string;
  prompt: string;
  response: string;
  userId?: string;
  latencyMs?: number;
  complianceMode?: string;
  apiUrl?: string;
}): Promise<void> {
  const url =
    options.apiUrl ||
    (typeof process !== "undefined" && process.env?.MNEMO_API_URL) ||
    "https://mnemo-api-production.up.railway.app";

  try {
    await fetch(`${url}/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": options.tenantId,
      },
      body: JSON.stringify({
        run_id: crypto.randomUUID(),
        agent_id: options.agentId,
        tenant_id: options.tenantId,
        user_id: options.userId || "anonymous",
        prompt: options.prompt,
        response: options.response,
        latency_ms: options.latencyMs || 0,
        compliance_mode: options.complianceMode || "standard",
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("[mnemo] tracking failed:", err);
  }
}

export default MnemoClient;
