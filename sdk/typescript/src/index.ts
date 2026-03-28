/**
 * Mnemo TypeScript SDK — Memory and observability for AI agents.
 *
 * Usage:
 *   import { MnemoClient } from 'mnemo';
 *   const mnemo = new MnemoClient({ tenantId: 'your-tenant' });
 *   const result = await mnemo.run({ agentId: 'my-agent', prompt: 'Hello' });
 *
 * @module mnemo
 */

export interface MnemoConfig {
  tenantId: string;
  mem0ApiKey?: string;
  langfusePublicKey?: string;
  langfuseSecretKey?: string;
  otelEndpoint?: string;
  debug?: boolean;
}

export interface RunOptions {
  agentId: string;
  prompt: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  memoryLimit?: number;
  systemPrompt?: string;
}

export interface RunResult {
  response: unknown;
  runId: string;
  agentId: string;
  tenantId: string;
  memoriesInjected: number;
  memoriesCreated: number;
  traceUrl?: string;
  durationMs: number;
  alertsFired: string[];
}

export class MnemoClient {
  private config: MnemoConfig;

  constructor(config: MnemoConfig) {
    this.config = config;
  }

  /** Execute a single agent run with full memory and observability. */
  async run(options: RunOptions): Promise<RunResult> {
    // TODO: Implement TypeScript SDK (Python SDK is primary, this is secondary)
    throw new Error('TypeScript SDK not yet implemented. Use the Python SDK: pip install mnemo');
  }
}
