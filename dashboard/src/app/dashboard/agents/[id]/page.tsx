"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { formatRelativeTime, formatDuration } from "@/lib/utils";
import {
  ArrowLeft,
  Brain,
  Bell,
  Clock,
  Activity,
  CheckCircle2,
  ShieldAlert,
  RefreshCw,
  Heart,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

const MNEMO_API_URL = process.env.NEXT_PUBLIC_MNEMO_API_URL || "https://mnemo-api-production.up.railway.app";

interface Run {
  id: string;
  run_id: string;
  status: string;
  duration_ms: number;
  memories_injected: number;
  memories_created: number;
  created_at: string;
  user_id: string | null;
  metadata: Record<string, unknown>;
}

interface AlertEvent {
  id: string;
  severity: string;
  message: string;
  fired_at: string;
  data: Record<string, unknown>;
}

interface Mem0Memory {
  id: string;
  memory: string;
  agent_id: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface DayCount {
  date: string;
  count: number;
}

function anonymizeUserId(userId: string | null | undefined): string {
  if (!userId) return "anon";
  return userId.length > 3 ? userId.slice(0, 3) + "***" : userId + "***";
}

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [mem0Memories, setMem0Memories] = useState<Mem0Memory[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [violations, setViolations] = useState<AlertEvent[]>([]);
  const [dailyRuns, setDailyRuns] = useState<DayCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Resolve tenant ID from the agent's own record
  useEffect(() => {
    async function resolve() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      // Find the agent and get its tenant_id directly
      const { data: agentData } = await supabase
        .from("agents")
        .select("tenant_id")
        .eq("agent_id", agentId)
        .limit(1)
        .single();

      if (agentData?.tenant_id) {
        setTenantId(agentData.tenant_id);
      } else {
        // Fallback to user metadata
        const tid =
          userData.user.user_metadata?.org_name ||
          userData.user.email?.split("@")[0] ||
          "default";
        setTenantId(tid);
      }
    }
    resolve();
  }, [agentId]);

  const load = useCallback(async () => {
    if (!tenantId) return;

    try {
      // Fetch all data scoped to tenant + agent
      const [runsRes, alertsRes, violationsRes] = await Promise.all([
        supabase
          .from("runs")
          .select("*")
          .eq("agent_id", agentId)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("alert_history")
          .select("*")
          .eq("agent_id", agentId)
          .eq("tenant_id", tenantId)
          .order("fired_at", { ascending: false })
          .limit(10),
        // Violations: any alert with violation data for this agent
        supabase
          .from("alert_history")
          .select("*")
          .eq("agent_id", agentId)
          .eq("tenant_id", tenantId)
          .eq("severity", "high")
          .order("fired_at", { ascending: false })
          .limit(10),
      ]);

      setRuns(runsRes.data || []);
      setAlerts(alertsRes.data || []);
      setViolations(violationsRes.data || []);

      // Fetch Mem0 memories via API
      try {
        const memRes = await fetch(
          `${MNEMO_API_URL}/memories/${tenantId}/${agentId}?limit=20`
        );
        if (memRes.ok) {
          const memData = await memRes.json();
          setMem0Memories(memData.memories || []);
        }
      } catch {
        // Mem0 fetch failed — non-critical
      }

      // Build daily run chart (last 14 days)
      const allRuns = runsRes.data || [];
      const days: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days[d.toISOString().slice(0, 10)] = 0;
      }
      allRuns.forEach((r) => {
        const day = r.created_at.slice(0, 10);
        if (days[day] !== undefined) days[day]++;
      });
      setDailyRuns(Object.entries(days).map(([date, count]) => ({ date, count })));

      setLastUpdated(new Date());
      setLoading(false);
      setError(null);
    } catch (e) {
      console.error("Agent page load error:", e);
      setError("Failed to load agent data");
      setLoading(false);
    }
  }, [agentId, tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load, tenantId]);

  // ─── Error state ───
  if (error) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">{error}</h2>
          <Link href="/dashboard" className="text-sm text-[var(--accent)] hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-[var(--muted)] rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-[var(--muted)] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Computed stats (all dynamic) ───
  const totalRuns = runs.length;
  const avgDuration =
    totalRuns > 0 ? runs.reduce((s, r) => s + (r.duration_ms || 0), 0) / totalRuns : 0;
  const totalMemoriesCreated = runs.reduce((s, r) => s + (r.memories_created || 0), 0);
  const totalAlerts = alerts.length;
  const maxBarValue = Math.max(...dailyRuns.map((d) => d.count), 1);

  // Agent health (dynamic)
  const successRuns = runs.filter((r) => r.status === "success").length;
  const successRate = totalRuns > 0 ? (successRuns / totalRuns) * 100 : 100;
  const healthStatus =
    successRate > 90 ? "healthy" : successRate > 70 ? "degraded" : "needs attention";
  const healthColor =
    successRate > 90 ? "text-emerald-400" : successRate > 70 ? "text-amber-400" : "text-red-400";
  const healthBadge: "success" | "warning" | "destructive" =
    successRate > 90 ? "success" : successRate > 70 ? "warning" : "destructive";

  function getPromptPreview(run: Run): string {
    const meta = run.metadata || {};
    const prompt = (meta.prompt as string) || "";
    if (prompt) return prompt.length > 60 ? prompt.slice(0, 60) + "..." : prompt;
    return run.run_id.slice(0, 12) + "...";
  }

  // ─── Empty state ───
  if (totalRuns === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">{agentId}</h1>
        </div>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center max-w-md">
            <Activity className="w-10 h-10 text-[var(--muted-foreground)] mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No runs yet for {agentId}</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Agents appear automatically when you call the SDK.
            </p>
            <div className="rounded-xl border border-[var(--border)] bg-[#0d0d0f] p-4 text-left font-mono text-xs">
              <span className="text-purple-400">from</span>{" "}
              <span className="text-emerald-400">mnemo</span>{" "}
              <span className="text-purple-400">import</span> MnemoClient<br />
              mnemo = MnemoClient(<span className="text-amber-400">tenant_id</span>=
              <span className="text-sky-400">&quot;{tenantId}&quot;</span>)<br />
              result = mnemo.run(<span className="text-amber-400">agent_id</span>=
              <span className="text-sky-400">&quot;{agentId}&quot;</span>, ...)
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main render ───
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">{agentId}</h1>
          <Badge variant={healthBadge}>{healthStatus}</Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <RefreshCw className="w-3 h-3" />
          updated {formatRelativeTime(lastUpdated.toISOString())}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card>
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-[var(--accent)]" />
            <div>
              <div className="text-2xl font-bold">{totalRuns}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Total runs</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-sky-400" />
            <div>
              <div className="text-2xl font-bold">{formatDuration(avgDuration)}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Avg duration</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-2xl font-bold">{totalMemoriesCreated}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Memories created</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-2xl font-bold">{totalAlerts}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Alerts</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Heart className={`w-5 h-5 ${healthColor}`} />
            <div>
              <div className="text-2xl font-bold">{Math.round(successRate)}%</div>
              <div className="text-xs text-[var(--muted-foreground)]">Success rate</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Run History Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Runs per day (last 14 days)</CardTitle>
        </CardHeader>
        <div className="flex items-end gap-1 h-32">
          {dailyRuns.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-[var(--accent)] rounded-sm min-h-[2px] transition-all"
                style={{ height: `${Math.max((d.count / maxBarValue) * 100, 2)}%` }}
              />
              <span className="text-[10px] text-[var(--muted-foreground)]">{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Traces */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Traces</h2>
          <div className="space-y-2">
            {runs.slice(0, 20).map((run) => (
              <Card key={run.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {run.status === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm truncate">{getPromptPreview(run)}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted-foreground)]">
                        <span>{formatDuration(run.duration_ms || 0)}</span>
                        <span>{run.memories_injected} mem in / {run.memories_created} out</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                    {formatRelativeTime(run.created_at)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Memories */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Memories</h2>
          <div className="space-y-2">
            {mem0Memories.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                No memories yet — they build automatically as {agentId} runs.
              </p>
            ) : (
              mem0Memories.map((mem) => (
                <Card key={mem.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm leading-relaxed line-clamp-3">{mem.memory}</p>
                    <Badge variant="outline" className="shrink-0">
                      {(mem.metadata?.mnemo_type as string) || "episodic"}
                    </Badge>
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-2">
                    {mem.created_at ? formatRelativeTime(mem.created_at) : ""}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Shield Violations — only shown if violations exist for THIS agent */}
      {violations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            Content Violations
          </h2>
          <div className="space-y-2">
            {violations.map((alert) => (
              <Card key={alert.id} className="p-4 border-red-500/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">
                        {(alert.data?.violation_type as string) || "violation"}
                      </Badge>
                      {(alert.data?.coppa_logged as boolean) && (
                        <Badge variant="outline" className="text-[10px]">COPPA logged</Badge>
                      )}
                      {(alert.data?.user_id as string) && (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          user: {anonymizeUserId(alert.data.user_id as string)}
                        </span>
                      )}
                    </div>
                    <span className="text-sm">{alert.message}</span>
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                    {formatRelativeTime(alert.fired_at)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent Alerts */}
      {alerts.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Recent Alerts</h2>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <Card key={alert.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        alert.severity === "critical" || alert.severity === "high"
                          ? "destructive"
                          : alert.severity === "warning"
                          ? "warning"
                          : "outline"
                      }
                    >
                      {alert.severity}
                    </Badge>
                    <span className="text-sm">{alert.message}</span>
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {formatRelativeTime(alert.fired_at)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Recent Alerts</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            No alerts yet — smart alerts fire automatically when behavior deviates.
          </p>
        </div>
      )}
    </div>
  );
}
