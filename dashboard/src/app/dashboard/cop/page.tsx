"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { formatRelativeTime } from "@/lib/utils";
import {
  ArrowLeft,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_MNEMO_API_URL || "https://mnemo-api-production.up.railway.app";

interface AttentionAgent {
  agent_id: string;
  last_issue: string;
  warning_count: number;
  critical_count: number;
  last_active: string;
  categories: string[];
  run_count: number;
}

interface HealthyAgent {
  agent_id: string;
  run_count: number;
  last_active: string;
}

interface FeedItem {
  agent_id: string;
  cop_summary: string;
  analysis_status: string;
  analysis_severity: number;
  analysis_categories: string[];
  created_at: string;
  prompt_preview: string;
}

interface DriftAlert {
  agent_id: string;
  message: string;
  fired_at: string;
  data: Record<string, unknown>;
}

export default function CopPage() {
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [summary, setSummary] = useState<{
    total_agents: number; total_runs: number; total_issues: number;
    critical_alerts: number; healthy_agents: number;
    agents_needing_attention: AttentionAgent[];
    healthy_agents_list: HealthyAgent[];
  } | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [driftAlerts, setDriftAlerts] = useState<DriftAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const meta = data.user.user_metadata || {};
      const orgName = meta.org_name || "";
      const emailPrefix = data.user.email?.split("@")[0] || "";
      const explicitTid = meta.tenant_id || "";

      // Build all possible candidates
      const raw = [explicitTid, orgName, emailPrefix, orgName.toLowerCase(), emailPrefix.toLowerCase()];
      for (const r of [...raw]) {
        if (r) {
          const stripped = r.replace(/\.(ai|io|com|org|dev|app)$/i, "");
          if (stripped !== r) raw.push(stripped, stripped.toLowerCase());
          raw.push(r.toLowerCase().replace(/[^a-z0-9]/g, ""));
        }
      }
      const candidates = raw.filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

      // Also check user_tenants table for manually linked tenants
      try {
        const { data: linked } = await supabase.from("user_tenants").select("tenant_id").eq("user_id", data.user.id);
        linked?.forEach(l => { if (!candidates.includes(l.tenant_id)) candidates.push(l.tenant_id); });
      } catch { /* table may not exist */ }

      const { data: tenants } = await supabase.from("tenants").select("tenant_id").in("tenant_id", candidates);
      setTenantIds((tenants || []).map(t => t.tenant_id));
    });
  }, []);

  const load = useCallback(async () => {
    if (tenantIds.length === 0) return;
    try {
      const results = await Promise.all(tenantIds.map(async (tid) => {
        const [sumRes, feedRes, driftRes] = await Promise.all([
          fetch(`${API}/cop/summary/${tid}`).then(r => r.json()).catch(() => null),
          fetch(`${API}/cop/feed/${tid}?limit=20`).then(r => r.json()).catch(() => []),
          fetch(`${API}/cop/drift/${tid}`).then(r => r.json()).catch(() => []),
        ]);
        return { summary: sumRes, feed: feedRes, drift: driftRes };
      }));

      // Merge across tenants
      const mergedSummary = { total_agents: 0, total_runs: 0, total_issues: 0, critical_alerts: 0, healthy_agents: 0, agents_needing_attention: [] as AttentionAgent[], healthy_agents_list: [] as HealthyAgent[] };
      const mergedFeed: FeedItem[] = [];
      const mergedDrift: DriftAlert[] = [];

      for (const r of results) {
        if (r.summary) {
          mergedSummary.total_agents += r.summary.total_agents || 0;
          mergedSummary.total_runs += r.summary.total_runs || 0;
          mergedSummary.total_issues += r.summary.total_issues || 0;
          mergedSummary.critical_alerts += r.summary.critical_alerts || 0;
          mergedSummary.healthy_agents += r.summary.healthy_agents || 0;
          mergedSummary.agents_needing_attention.push(...(r.summary.agents_needing_attention || []));
          mergedSummary.healthy_agents_list.push(...(r.summary.healthy_agents_list || []));
        }
        mergedFeed.push(...(Array.isArray(r.feed) ? r.feed : []));
        mergedDrift.push(...(Array.isArray(r.drift) ? r.drift : []));
      }

      mergedFeed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSummary(mergedSummary);
      setFeed(mergedFeed.slice(0, 20));
      setDriftAlerts(mergedDrift);
      setLastUpdated(new Date());
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [tenantIds]);

  useEffect(() => {
    if (tenantIds.length === 0) return;
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [tenantIds, load]);

  const statusIcon = (s: string) =>
    s === "critical" ? <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
    : s === "warning" ? <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
    : <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />;

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-[var(--muted)] rounded" />
          <div className="grid grid-cols-5 gap-4">{[1,2,3,4,5].map(i => <div key={i} className="h-24 bg-[var(--muted)] rounded-xl" />)}</div>
        </div>
      </div>
    );
  }

  const s = summary || { total_agents: 0, total_runs: 0, total_issues: 0, critical_alerts: 0, healthy_agents: 0, agents_needing_attention: [], healthy_agents_list: [] };

  return (
    <div className="p-8" style={{ background: "#0a0a0f", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="w-5 h-5" /></Link>
          <Shield className="w-6 h-6 text-[var(--accent)]" />
          <h1 className="text-2xl font-bold">Mission Control</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Mnemo AI Cop — observing all agents</span>
          <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" />updated {formatRelativeTime(lastUpdated.toISOString())}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Agents", value: s.total_agents, icon: Activity, color: "text-[var(--accent)]" },
          { label: "Runs Analyzed", value: s.total_runs, icon: Activity, color: "text-sky-400" },
          { label: "Issues Detected", value: s.total_issues, icon: AlertTriangle, color: "text-amber-400" },
          { label: "Critical Alerts", value: s.critical_alerts, icon: AlertTriangle, color: "text-red-400" },
          { label: "Agents Healthy", value: s.healthy_agents, icon: CheckCircle2, color: "text-emerald-400" },
        ].map(st => (
          <Card key={st.label} className="p-4">
            <div className="flex items-center gap-3">
              <st.icon className={`w-5 h-5 ${st.color}`} />
              <div>
                <div className="text-2xl font-bold">{st.value}</div>
                <div className="text-xs text-[var(--muted-foreground)]">{st.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Agents Needing Attention */}
      {s.agents_needing_attention.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />Agents Needing Attention
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {s.agents_needing_attention.map(ag => (
              <Card key={ag.agent_id} className="p-4" style={{ borderLeft: `3px solid ${ag.critical_count > 0 ? "#E24B4A" : "#EF9F27"}`, background: ag.critical_count > 0 ? "rgba(226,75,74,0.03)" : "rgba(239,159,39,0.03)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${ag.critical_count > 0 ? "bg-red-500" : "bg-amber-500"}`} />
                    <span className="font-semibold">{ag.agent_id}</span>
                  </div>
                  <Link href={`/dashboard/agents/${ag.agent_id}`} className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">View agent <ArrowRight className="w-3 h-3" /></Link>
                </div>
                <p className="text-sm text-[var(--muted-foreground)] mb-2 line-clamp-2">{ag.last_issue}</p>
                <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <span>{ag.warning_count} warnings</span>
                  {ag.critical_count > 0 && <span className="text-red-400">{ag.critical_count} critical</span>}
                  <span>{ag.last_active ? formatRelativeTime(ag.last_active) : ""}</span>
                </div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {ag.categories.map(c => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Clear */}
      {s.healthy_agents_list.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />Agents Operating Normally
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {s.healthy_agents_list.map(ag => (
              <Card key={ag.agent_id} className="p-4" style={{ borderLeft: "3px solid rgba(93,202,165,0.3)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-sm">{ag.agent_id}</span>
                  </div>
                  <Link href={`/dashboard/agents/${ag.agent_id}`} className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">View <ArrowRight className="w-3 h-3" /></Link>
                </div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">
                  {ag.run_count} runs {ag.last_active ? `· ${formatRelativeTime(ag.last_active)}` : ""}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Live Feed */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Live Analysis Feed</h2>
        {feed.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No analyzed runs yet. Runs are analyzed automatically as they come in.</p>
        ) : (
          <div className="space-y-2">
            {feed.map((item, i) => (
              <Card key={`${item.created_at}-${i}`} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 shrink-0 mt-0.5">
                    <span className="text-xs text-[var(--muted-foreground)] w-12">{formatRelativeTime(item.created_at)}</span>
                    {statusIcon(item.analysis_status)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-semibold">{item.agent_id}</span>
                      <span className="text-[var(--muted-foreground)]"> — {item.cop_summary || item.prompt_preview || "run analyzed"}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {(item.analysis_categories || []).map((c: string) => <Badge key={c} variant="outline" className="text-[9px]">{c}</Badge>)}
                      {item.analysis_severity > 0 && <span className="text-[10px] text-amber-400">sev {item.analysis_severity}/10</span>}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Drift Alerts */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Drift Alerts</h2>
        {driftAlerts.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No drift detected — all agents stable.</p>
        ) : (
          <div className="space-y-2">
            {driftAlerts.map((alert, i) => (
              <Card key={`drift-${i}`} className="p-4" style={{ borderLeft: "3px solid #EF9F27" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="font-semibold">{alert.agent_id}</span>
                    <span className="text-sm text-amber-400">Behavioral drift detected</span>
                  </div>
                  <Link href={`/dashboard/agents/${alert.agent_id}`} className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">Investigate <ArrowRight className="w-3 h-3" /></Link>
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">{alert.message}</p>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">{formatRelativeTime(alert.fired_at)}</div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
