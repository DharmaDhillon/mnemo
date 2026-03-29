/**
 * Content masking for COPPA compliance and student safety.
 *
 * Does NOT use word lists. Trusts the Shield agent's analysis
 * and AI Cop status to determine what should be masked.
 */

export function shouldMaskContent(trace: {
  agent_id: string;
  analysis_status?: string | null;
}): boolean {
  if (trace.agent_id?.toLowerCase().includes("shield")) return true;
  if (trace.analysis_status === "warning") return true;
  if (trace.analysis_status === "critical") return true;
  return false;
}

export function maskPrompt(prompt: string | null | undefined, mask: boolean): string {
  if (!prompt) return "";
  if (!mask) return prompt.length > 60 ? prompt.slice(0, 60) + "..." : prompt;
  const preview = prompt.slice(0, 20);
  return `${preview}... [content masked]`;
}

export function isWellbeingConcern(alert: {
  data?: Record<string, unknown> | null;
  severity?: string | null;
}): boolean {
  const cats = (alert.data?.categories as string[]) || (alert.data?.analysis_categories as string[]) || [];
  const sev = (alert.data?.severity as number) || 0;
  const vtype = (alert.data?.violation_type as string) || "";
  return (
    vtype === "self_harm" ||
    cats.includes("safety") && sev >= 7
  );
}

export function anonymizeUserId(userId: string | null | undefined): string {
  if (!userId) return "anon";
  return userId.length > 3 ? userId.slice(0, 3) + "***" : userId + "***";
}
