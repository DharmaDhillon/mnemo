"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { formatRelativeTime, formatDuration } from "@/lib/utils";
import { shouldMaskContent, maskPrompt, isWellbeingConcern, anonymizeUserId } from "@/lib/masking";
import {
  ArrowLeft, Brain, Bell, Clock, Activity, ShieldAlert, RefreshCw,
  Heart, Lock, AlertTriangle, X, ChevronRight,
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
  rule_name: string | null; agent_id: string; data: Record<string, unknown>;
}
interface Mem0Memory {
  id: string; memory: string; agent_id: string; created_at: string;
  metadata: Record<string, unknown>;
}
interface DayCount { date: string; count: number; }

/* ─── Slide-over Drawer ─── */
function Drawer({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-[var(--background)] border-l border-[var(--border)] h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-[var(--background)] border-b border-[var(--border)] px-5 py-3 flex items-center justify-between z-10">
          <h2 className="font-semibold text-sm">{title}</h2>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ─── Compact Trace Row ─── */
function TraceRow({ run }: { run: Run }) {
  const mask = shouldMaskContent(run);
  const prompt = (run.metadata?.prompt as string) || "";
  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--muted)]/30" style={{ maxHeight: 52 }}>
      {run.analysis_status === "critical" ? <span className="w-[10px] h-[10px] rounded-full bg-red-500 shrink-0 mt-1" />
       : run.analysis_status === "warning" ? <span className="w-[10px] h-[10px] rounded-full bg-amber-500 shrink-0 mt-1" />
       : <span className="w-[10px] h-[10px] rounded-full bg-emerald-500 shrink-0 mt-1" />}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] truncate">{maskPrompt(prompt || run.run_id.slice(0, 12), mask)}</div>
        {run.analysis_cop_summary && <div className="text-[10px] text-[var(--muted-foreground)] italic truncate">{run.analysis_cop_summary}</div>}
      </div>
      <div className="text-right shrink-0">
        <div className="text-[10px]">{formatDuration(run.duration_ms || 0)}</div>
        <div className="text-[9px] text-[var(--muted-foreground)]">{formatRelativeTime(run.created_at)}</div>
      </div>
    </div>
  );
}

/* ─── Compact Memory Card ─── */
function MemoryRow({ mem }: { mem: Mem0Memory }) {
  return (
    <div className="px-2 py-1.5 rounded-md border border-[var(--accent)]/10" style={{ maxHeight: 52 }}>
      <div className="text-[8px] text-[var(--accent)] uppercase tracking-wider">{(mem.metadata?.mnemo_type as string) || "episodic"} · {mem.created_at ? formatRelativeTime(mem.created_at) : ""}</div>
      <div className="text-[10px] line-clamp-2">{mem.memory}</div>
    </div>
  );
}

/* ═══ MAIN PAGE ═══ */
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
  const [wellbeingConfirmed, setWellbeingConfirmed] = useState(false);
  const [drawer, setDrawer] = useState<"traces" | "memories" | "violations" | "alerts" | null>(null);

  useEffect(() => {
    async function resolve() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setError("Not authenticated"); setLoading(false); return; }
      const { data: agentData } = await supabase.from("agents").select("tenant_id").eq("agent_id", agentId).limit(1).single();
      if (agentData?.tenant_id) setTenantId(agentData.tenant_id);
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
      const aa = allAlertsRes.data || [];
      setViolations(aa.filter(a => a.rule_name === "content_violation"));
      setWellbeingAlerts(aa.filter(a => isWellbeingConcern(a)));
      setAlerts(aa.filter(a => a.rule_name !== "content_violation"));
      try {
        const memRes = await fetch(`${API}/memories/${tenantId}/${agentId}?limit=20`);
        if (memRes.ok) { const d = await memRes.json(); setMem0Memories(d.memories || []); }
      } catch { /* */ }
      const days: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days[d.toISOString().slice(0, 10)] = 0; }
      (runsRes.data || []).forEach(r => { const day = r.created_at.slice(0, 10); if (days[day] !== undefined) days[day]++; });
      setDailyRuns(Object.entries(days).map(([date, count]) => ({ date, count })));
      setLastUpdated(new Date());
      setLoading(false);
      setError(null);
    } catch (e) { console.error(e); setError("Failed to load"); setLoading(false); }
  }, [agentId, tenantId]);

  useEffect(() => { if (!tenantId) return; load(); const iv = setInterval(load, 10000); return () => clearInterval(iv); }, [load, tenantId]);

  if (error) return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="text-center"><ShieldAlert className="w-8 h-8 text-red-400 mx-auto mb-3" /><h2 className="text-base font-semibold mb-1">{error}</h2><Link href="/dashboard" className="text-xs text-[var(--accent)] hover:underline">Back</Link></div>
    </div>
  );
  if (loading) return <div className="p-6"><div className="animate-pulse space-y-3"><div className="h-6 w-48 bg-[var(--muted)] rounded" /><div className="grid grid-cols-5 gap-3">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-[var(--muted)] rounded-lg" />)}</div></div></div>;

  const totalRuns = runs.length;
  const avgDuration = totalRuns > 0 ? runs.reduce((s, r) => s + (r.duration_ms || 0), 0) / totalRuns : 0;
  const totalMemCreated = runs.reduce((s, r) => s + (r.memories_created || 0), 0);
  const successRuns = runs.filter(r => r.status === "success").length;
  const successRate = totalRuns > 0 ? (successRuns / totalRuns) * 100 : 100;
  const healthBadge: "success" | "warning" | "destructive" = successRate > 90 ? "success" : successRate > 70 ? "warning" : "destructive";
  const healthLabel = successRate > 90 ? "healthy" : successRate > 70 ? "degraded" : "needs attention";
  const maxBar = Math.max(...dailyRuns.map(d => d.count), 1);
  const recentWarnings = runs.filter(r => r.analysis_status && r.analysis_status !== "ok" && Date.now() - new Date(r.created_at).getTime() < 86400000);
  const isShieldAgent = agentId.toLowerCase().includes("shield");
  const catCounts: Record<string, number> = {};
  runs.forEach(r => (r.analysis_categories || []).forEach((c: string) => { catCounts[c] = (catCounts[c] || 0) + 1; }));
  const cats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

  if (totalRuns === 0) return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4"><Link href="/dashboard" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="w-4 h-4" /></Link><h1 className="text-lg font-bold">{agentId}</h1></div>
      <div className="flex items-center justify-center min-h-[40vh]"><div className="text-center"><Activity className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-3" /><h2 className="text-base font-semibold mb-1">No runs yet for {agentId}</h2><p className="text-xs text-[var(--muted-foreground)]">Runs appear when the SDK sends data.</p></div></div>
    </div>
  );

  return (
    <div className="p-5 space-y-4">
      {/* S1: HEADER — 48px */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="text-lg font-bold">{agentId}</h1>
          <Badge variant={healthBadge} className="text-[10px]">{healthLabel}</Badge>
          {isShieldAgent && <span className="flex items-center gap-1 text-[9px] text-[var(--muted-foreground)]"><Lock className="w-3 h-3" />COPPA masked</span>}
        </div>
        <span className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-1"><RefreshCw className="w-3 h-3" />{formatRelativeTime(lastUpdated.toISOString())}</span>
      </div>

      {/* S2: STATS — 72px */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { icon: Activity, color: "text-[var(--accent)]", val: totalRuns, label: "Runs" },
          { icon: Clock, color: "text-sky-400", val: formatDuration(avgDuration), label: "Avg" },
          { icon: Brain, color: "text-emerald-400", val: totalMemCreated, label: "Memories" },
          { icon: Bell, color: "text-amber-400", val: violations.length + alerts.length, label: "Alerts" },
          { icon: Heart, color: successRate > 90 ? "text-emerald-400" : "text-red-400", val: `${Math.round(successRate)}%`, label: "Success" },
        ].map(s => (
          <Card key={s.label} className="p-3"><div className="flex items-center gap-2"><s.icon className={`w-4 h-4 ${s.color}`} /><div><div className="text-lg font-bold leading-tight">{s.val}</div><div className="text-[9px] text-[var(--muted-foreground)]">{s.label}</div></div></div></Card>
        ))}
      </div>

      {/* S3: WELLBEING + VIOLATIONS + INSIGHTS — fixed 160px */}
      {(wellbeingAlerts.length > 0 || violations.length > 0 || cats.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Left: Wellbeing + Violations */}
          <div style={{ maxHeight: 160, overflowY: "auto" }} className="space-y-2">
            {wellbeingAlerts.map(a => (
              <div key={a.id} className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-red-400 font-semibold"><AlertTriangle className="w-3.5 h-3.5" />Wellbeing concern</div>
                {!wellbeingConfirmed ? (
                  <button onClick={() => setWellbeingConfirmed(true)} className="text-[9px] text-[var(--muted-foreground)] mt-1 hover:underline">View details — requires confirmation</button>
                ) : (
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-1">{anonymizeUserId(a.data?.user_id as string)} · {(a.data?.violation_type as string) || "safety"}</p>
                )}
              </div>
            ))}
            {violations.slice(0, 3).map(v => (
              <div key={v.id} className="rounded-lg border border-red-500/15 px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-[9px]">{(v.data?.violation_type as string) || "violation"}</Badge>
                  <span className="text-[10px] text-[var(--muted-foreground)]">{anonymizeUserId(v.data?.user_id as string)}</span>
                </div>
                <span className="text-[9px] text-[var(--muted-foreground)]">{formatRelativeTime(v.fired_at)}</span>
              </div>
            ))}
            {violations.length > 3 && <button onClick={() => setDrawer("violations")} className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-1">View all {violations.length} violations <ChevronRight className="w-3 h-3" /></button>}
          </div>
          {/* Right: Insights */}
          <div style={{ maxHeight: 160 }}>
            <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider mb-2">AI Cop Insights</div>
            {cats.length === 0 ? (
              <p className="text-[11px] text-emerald-400">All runs nominal</p>
            ) : (
              <div className="flex gap-1.5 flex-wrap">{cats.map(([cat, count]) => <Badge key={cat} variant="outline" className="text-[9px]">{cat} x{count}</Badge>)}</div>
            )}
            {recentWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2 mt-2">
                <div className="text-[10px] text-amber-400">{recentWarnings.length} issue{recentWarnings.length > 1 ? "s" : ""} in 24h</div>
                <div className="text-[9px] text-[var(--muted-foreground)] truncate">{recentWarnings[0]?.analysis_reasoning}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* S4: CHART — 100px */}
      <Card className="p-3">
        <div className="text-[10px] text-[var(--muted-foreground)] mb-2">Runs / day (14d)</div>
        <div className="flex items-end gap-[2px] h-[60px]">
          {dailyRuns.map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center">
              <div className="w-full bg-[var(--accent)] rounded-sm min-h-[1px]" style={{ height: `${Math.max((d.count / maxBar) * 100, 2)}%` }} />
              <span className="text-[7px] text-[var(--muted-foreground)] mt-[2px]">{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* S5: TRACES + MEMORIES — fixed 280px each */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Recent Traces</span>
            {runs.length > 10 && <button onClick={() => setDrawer("traces")} className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-0.5">All {runs.length} <ChevronRight className="w-3 h-3" /></button>}
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto" }} className="space-y-[2px] rounded-lg border border-[var(--border)] p-1.5">
            {runs.slice(0, 10).map(run => <TraceRow key={run.id} run={run} />)}
            {runs.length === 0 && <p className="text-[10px] text-[var(--muted-foreground)] p-2">No traces yet.</p>}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Memories</span>
            {mem0Memories.length > 5 && <button onClick={() => setDrawer("memories")} className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-0.5">All {mem0Memories.length} <ChevronRight className="w-3 h-3" /></button>}
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto" }} className="space-y-1.5 rounded-lg border border-[var(--border)] p-1.5">
            {mem0Memories.slice(0, 5).map(mem => <MemoryRow key={mem.id} mem={mem} />)}
            {mem0Memories.length === 0 && <p className="text-[10px] text-[var(--muted-foreground)] p-2">No memories yet — they build as {agentId} runs.</p>}
          </div>
        </div>
      </div>

      {/* S6: ALERTS — fixed 120px */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">Alerts</span>
          {alerts.length > 3 && <button onClick={() => setDrawer("alerts")} className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-0.5">All {alerts.length} <ChevronRight className="w-3 h-3" /></button>}
        </div>
        <div style={{ maxHeight: 120, overflowY: "auto" }} className="space-y-1 rounded-lg border border-[var(--border)] p-1.5">
          {alerts.length === 0 ? (
            <p className="text-[10px] text-[var(--muted-foreground)] p-2">No alerts — smart alerts fire when behavior deviates.</p>
          ) : alerts.slice(0, 3).map(a => (
            <div key={a.id} className="flex items-center justify-between px-2 py-1.5 rounded-md" style={{ maxHeight: 40 }}>
              <div className="flex items-center gap-2">
                <Badge variant={a.severity === "critical" || a.severity === "high" ? "destructive" : a.severity === "warning" ? "warning" : "outline"} className="text-[9px]">{a.severity}</Badge>
                <span className="text-[10px] truncate max-w-[200px]">{shouldMaskContent({ agent_id: a.agent_id, analysis_status: a.severity }) ? maskPrompt(a.message, true) : a.message}</span>
              </div>
              <span className="text-[9px] text-[var(--muted-foreground)] shrink-0">{formatRelativeTime(a.fired_at)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── DRAWERS ─── */}
      <Drawer title={`All Traces — ${agentId}`} open={drawer === "traces"} onClose={() => setDrawer(null)}>
        <div className="space-y-1">{runs.map(run => <TraceRow key={run.id} run={run} />)}</div>
      </Drawer>
      <Drawer title={`All Memories — ${agentId}`} open={drawer === "memories"} onClose={() => setDrawer(null)}>
        <div className="space-y-2">{mem0Memories.map(mem => <MemoryRow key={mem.id} mem={mem} />)}</div>
      </Drawer>
      <Drawer title={`All Violations — ${agentId}`} open={drawer === "violations"} onClose={() => setDrawer(null)}>
        <div className="space-y-2">{violations.map(v => (
          <div key={v.id} className="rounded-lg border border-red-500/15 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Badge variant="destructive" className="text-[9px]">{(v.data?.violation_type as string) || "violation"}</Badge><span className="text-[10px] text-[var(--muted-foreground)]">{anonymizeUserId(v.data?.user_id as string)}</span></div>
              <span className="text-[9px] text-[var(--muted-foreground)]">{formatRelativeTime(v.fired_at)}</span>
            </div>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-1">{maskPrompt(v.message, true)}</p>
          </div>
        ))}</div>
      </Drawer>
      <Drawer title={`All Alerts — ${agentId}`} open={drawer === "alerts"} onClose={() => setDrawer(null)}>
        <div className="space-y-1">{alerts.map(a => (
          <div key={a.id} className="flex items-center justify-between px-2 py-2 rounded-md border border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Badge variant={a.severity === "critical" || a.severity === "high" ? "destructive" : "outline"} className="text-[9px]">{a.severity}</Badge>
              <span className="text-[10px]">{a.message}</span>
            </div>
            <span className="text-[9px] text-[var(--muted-foreground)]">{formatRelativeTime(a.fired_at)}</span>
          </div>
        ))}</div>
      </Drawer>
    </div>
  );
}
