"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { formatRelativeTime, formatDuration } from "@/lib/utils";
import { shouldMaskContent, maskPrompt, isWellbeingConcern, anonymizeUserId } from "@/lib/masking";
import {
  ArrowLeft, Brain, Bell, Clock, Activity, CheckCircle2, ShieldAlert, RefreshCw, Heart, Lock, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_MNEMO_API_URL || "https://mnemo-api-production.up.railway.app";

interface Run {
  id: string; run_id: string; status: string; duration_ms: number;
  memories_injected: number; memories_created: number; created_at: string;
  user_id: string | null; agent_id: string;
  analysis_status: string | null; analysis_severity: number | null;
  analysis_reasoning: string | null; analysis_cop_summary: string | null;
  analysis_categories: string[] | null;
  metadata: Record<string, unknown>;
}

interface AlertEvent {
  id: string; severity: string; message: string; fired_at: string;
  rule_name: string | null; agent_id: string;
  data: Record<string, unknown>;
}

interface Mem0Memory {
  id: string; memory: string; agent_id: string; created_at: string;
  metadata: Record<string, unknown>;
}

interface DayCount { date: string; count: number; }

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [mem0Memories, setMem0Memories] = useState<Mem0Memory[]>([]);
  const [violations, setViolations] = useState<AlertEvent[]>([]);
  const [wellbeingAlerts, setWellbeingAlerts] = useState<AlertEvent[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [dailyRuns, setDailyRuns] = useState<DayCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [revealedViolations, setRevealedViolations] = useState<Set<string>>(new Set());
  const [wellbeingConfirmed, setWellbeingConfirmed] = useState(false);

  useEffect(() => {
    async function resolve() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setError("Not authenticated"); setLoading(false); return; }
      const { data: agentData } = await supabase.from("agents").select("tenant_id").eq("agent_id", agentId).limit(1).single();
      if (agentData?.tenant_id) { setTenantId(agentData.tenant_id); }
      else {
        const meta = userData.user.user_metadata || {};
        setTenantId(meta.tenant_id || meta.org_name || userData.user.email?.split("@")[0] || "default");
      }
    }
    resolve();
  }, [agentId]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [runsRes, allAlertsRes] = await Promise.all([
        supabase.from("runs").select("*").eq("agent_id", agentId).eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
        supabase.from("alert_history").select("*").eq("agent_id", agentId).eq("tenant_id", tenantId).order("fired_at", { ascending: false }).limit(20),
      ]);

      setRuns(runsRes.data || []);

      const allAlerts = allAlertsRes.data || [];
      setViolations(allAlerts.filter(a => a.rule_name === "content_violation"));
      setWellbeingAlerts(allAlerts.filter(a => isWellbeingConcern(a)));
      setAlerts(allAlerts.filter(a => a.rule_name !== "content_violation"));

      // Mem0 memories
      try {
        const memRes = await fetch(`${API}/memories/${tenantId}/${agentId}?limit=20`);
        if (memRes.ok) { const d = await memRes.json(); setMem0Memories(d.memories || []); }
      } catch { /* non-critical */ }

      // Chart
      const days: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days[d.toISOString().slice(0, 10)] = 0; }
      (runsRes.data || []).forEach(r => { const day = r.created_at.slice(0, 10); if (days[day] !== undefined) days[day]++; });
      setDailyRuns(Object.entries(days).map(([date, count]) => ({ date, count })));

      setLastUpdated(new Date());
      setLoading(false);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Failed to load agent data");
      setLoading(false);
    }
  }, [agentId, tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load, tenantId]);

  if (error) return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <ShieldAlert className="w-10 h-10 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">{error}</h2>
        <Link href="/dashboard" className="text-sm text-[var(--accent)] hover:underline">Back to dashboard</Link>
      </div>
    </div>
  );

  if (loading) return (
    <div className="p-8"><div className="animate-pulse space-y-4"><div className="h-8 w-64 bg-[var(--muted)] rounded" /><div className="grid grid-cols-5 gap-4">{[1,2,3,4,5].map(i => <div key={i} className="h-24 bg-[var(--muted)] rounded-xl" />)}</div></div></div>
  );

  // Computed stats
  const totalRuns = runs.length;
  const avgDuration = totalRuns > 0 ? runs.reduce((s, r) => s + (r.duration_ms || 0), 0) / totalRuns : 0;
  const totalMemCreated = runs.reduce((s, r) => s + (r.memories_created || 0), 0);
  const successRuns = runs.filter(r => r.status === "success").length;
  const successRate = totalRuns > 0 ? (successRuns / totalRuns) * 100 : 100;
  const healthBadge: "success" | "warning" | "destructive" = successRate > 90 ? "success" : successRate > 70 ? "warning" : "destructive";
  const healthLabel = successRate > 90 ? "healthy" : successRate > 70 ? "degraded" : "needs attention";
  const maxBar = Math.max(...dailyRuns.map(d => d.count), 1);
  const recentWarnings = runs.filter(r => {
    if (!r.analysis_status || r.analysis_status === "ok") return false;
    const age = Date.now() - new Date(r.created_at).getTime();
    return age < 86400000; // 24h
  });
  const isShieldAgent = agentId.toLowerCase().includes("shield");

  // Empty state
  if (totalRuns === 0) return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold">{agentId}</h1>
      </div>
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center max-w-md">
          <Activity className="w-10 h-10 text-[var(--muted-foreground)] mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No runs yet for {agentId}</h2>
          <p className="text-sm text-[var(--muted-foreground)]">Agents appear automatically when you call the SDK.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-8">
      {/* 1. Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-2xl font-bold">{agentId}</h1>
          <Badge variant={healthBadge}>{healthLabel}</Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <RefreshCw className="w-3 h-3" />updated {formatRelativeTime(lastUpdated.toISOString())}
        </div>
      </div>

      {/* COPPA masking banner for shield agents */}
      {isShieldAgent && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 mb-4 text-xs text-[var(--muted-foreground)]">
          <Lock className="w-3.5 h-3.5" />
          Content from student interactions is partially masked for COPPA compliance and student privacy. Violation types are logged for safety review.
        </div>
      )}

      {/* 2. Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { icon: Activity, color: "text-[var(--accent)]", val: totalRuns, label: "Total runs" },
          { icon: Clock, color: "text-sky-400", val: formatDuration(avgDuration), label: "Avg duration" },
          { icon: Brain, color: "text-emerald-400", val: totalMemCreated, label: "Memories" },
          { icon: Bell, color: "text-amber-400", val: violations.length + alerts.length, label: "Alerts" },
          { icon: Heart, color: successRate > 90 ? "text-emerald-400" : successRate > 70 ? "text-amber-400" : "text-red-400", val: `${Math.round(successRate)}%`, label: "Success rate" },
        ].map(s => (
          <Card key={s.label}><div className="flex items-center gap-3"><s.icon className={`w-5 h-5 ${s.color}`} /><div><div className="text-2xl font-bold">{s.val}</div><div className="text-xs text-[var(--muted-foreground)]">{s.label}</div></div></div></Card>
        ))}
      </div>

      {/* 3. WELLBEING ALERTS — top priority */}
      {wellbeingAlerts.length > 0 && (
        <div className="mb-6">
          {wellbeingAlerts.map(a => (
            <Card key={a.id} className="p-4 mb-2 border-red-500/30 bg-red-500/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-red-400 text-sm mb-1">Wellbeing concern — student distress detected</div>
                  <p className="text-xs text-[var(--muted-foreground)]">Immediate review recommended. Logged for safety team.</p>
                  {!wellbeingConfirmed ? (
                    <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => setWellbeingConfirmed(true)}>
                      View details — requires confirmation
                    </Button>
                  ) : (
                    <p className="text-xs text-[var(--muted-foreground)] mt-2">
                      User: {anonymizeUserId(a.data?.user_id as string)} · {(a.data?.violation_type as string) || "safety"} · {formatRelativeTime(a.fired_at)}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 4. CONTENT VIOLATIONS — masked */}
      {violations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />Content Violations
          </h2>
          <div className="space-y-2">
            {violations.map(v => {
              const revealed = revealedViolations.has(v.id);
              return (
                <Card key={v.id} className="p-3 border-red-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-[10px]">{(v.data?.violation_type as string) || "violation"}</Badge>
                      {(v.data?.coppa_logged as boolean) && <Badge variant="outline" className="text-[10px]">COPPA</Badge>}
                      <span className="text-xs text-[var(--muted-foreground)]">user: {anonymizeUserId(v.data?.user_id as string)}</span>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)]">{formatRelativeTime(v.fired_at)}</span>
                  </div>
                  {!revealed ? (
                    <button onClick={() => setRevealedViolations(prev => new Set(prev).add(v.id))} className="text-[10px] text-[var(--muted-foreground)] mt-1 hover:underline">
                      Show masked details
                    </button>
                  ) : (
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">{maskPrompt(v.message, true)}</p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. ALERT BANNER */}
      {recentWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            {recentWarnings.length} issue{recentWarnings.length > 1 ? "s" : ""} flagged in the last 24 hours
          </div>
          <div className="text-xs text-[var(--muted-foreground)] mt-1">
            {recentWarnings.slice(0, 3).map(r => r.analysis_reasoning).filter(Boolean).join(" · ")}
          </div>
        </div>
      )}

      {/* 6. Chart */}
      <Card className="mb-8">
        <CardHeader><CardTitle className="text-base">Runs per day (last 14 days)</CardTitle></CardHeader>
        <div className="flex items-end gap-1 h-32">
          {dailyRuns.map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-[var(--accent)] rounded-sm min-h-[2px] transition-all" style={{ height: `${Math.max((d.count / maxBar) * 100, 2)}%` }} />
              <span className="text-[10px] text-[var(--muted-foreground)]">{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 7. Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Traces — masked if sensitive */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Traces</h2>
          <div className="space-y-2">
            {runs.slice(0, 20).map(run => {
              const mask = shouldMaskContent(run);
              const prompt = (run.metadata?.prompt as string) || "";
              return (
                <Card key={run.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      {run.analysis_status === "critical" ? (
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      ) : run.analysis_status === "warning" ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm truncate">{maskPrompt(prompt || run.run_id.slice(0, 12), mask)}</div>
                        {run.analysis_cop_summary && (
                          <div className="text-xs text-[var(--muted-foreground)] italic mt-0.5 line-clamp-1">{run.analysis_cop_summary}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted-foreground)]">
                          <span>{formatDuration(run.duration_ms || 0)}</span>
                          <span>{run.memories_injected} in / {run.memories_created} out</span>
                          {(run.analysis_severity || 0) > 0 && (
                            <span className="text-amber-400">sev {run.analysis_severity}/10</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)] shrink-0">{formatRelativeTime(run.created_at)}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Memories + Cop Insights */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Memories</h2>
          <div className="space-y-2 mb-8">
            {mem0Memories.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No memories yet — they build automatically as {agentId} runs.</p>
            ) : mem0Memories.map(mem => (
              <Card key={mem.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-relaxed line-clamp-3">{mem.memory}</p>
                  <Badge variant="outline" className="shrink-0">{(mem.metadata?.mnemo_type as string) || "episodic"}</Badge>
                </div>
                <div className="text-xs text-[var(--muted-foreground)] mt-2">{mem.created_at ? formatRelativeTime(mem.created_at) : ""}</div>
              </Card>
            ))}
          </div>

          {/* AI Cop Insights */}
          <h2 className="text-lg font-semibold mb-4">AI Cop Insights</h2>
          {(() => {
            const catCounts: Record<string, number> = {};
            runs.forEach(r => (r.analysis_categories || []).forEach((c: string) => { catCounts[c] = (catCounts[c] || 0) + 1; }));
            const cats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
            if (cats.length === 0) return <p className="text-sm text-emerald-400">All runs nominal — no issues detected.</p>;
            return (
              <div className="flex gap-2 flex-wrap">
                {cats.map(([cat, count]) => (
                  <Badge key={cat} variant="outline">{cat} x{count}</Badge>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* 8. Regular Alerts */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Recent Alerts</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No alerts yet — smart alerts fire automatically when behavior deviates.</p>
        ) : (
          <div className="space-y-2">
            {alerts.map(a => (
              <Card key={a.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={a.severity === "critical" || a.severity === "high" ? "destructive" : a.severity === "warning" ? "warning" : "outline"}>{a.severity}</Badge>
                    <span className="text-sm">{shouldMaskContent({ agent_id: a.agent_id, analysis_status: a.severity }) ? maskPrompt(a.message, true) : a.message}</span>
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)]">{formatRelativeTime(a.fired_at)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
