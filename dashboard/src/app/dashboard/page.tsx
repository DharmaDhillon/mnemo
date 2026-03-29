"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { formatRelativeTime } from "@/lib/utils";
import { Bot, Clock, Brain, AlertTriangle, Activity, Copy, Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface Agent {
  id: string;
  agent_id: string;
  tenant_id: string;
  name: string | null;
  description: string | null;
  created_at: string;
  _run_count?: number;
  _memory_count?: number;
  _last_run?: string;
  _alert_count?: number;
}

interface Stats {
  totalAgents: number;
  totalRuns: number;
  totalMemories: number;
  totalAlerts: number;
}

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<Stats>({ totalAgents: 0, totalRuns: 0, totalMemories: 0, totalAlerts: 0 });
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [userTenantLabel, setUserTenantLabel] = useState("your-tenant");

  // Resolve all tenant IDs this user could own
  useEffect(() => {
    async function resolveTenants() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const orgName = userData.user.user_metadata?.org_name || "";
      const emailPrefix = userData.user.email?.split("@")[0] || "";
      setUserTenantLabel(orgName || emailPrefix);

      // Check which tenant IDs exist for this user's possible identifiers
      const candidates = [orgName, emailPrefix, orgName.toLowerCase(), emailPrefix.toLowerCase()].filter(Boolean);
      const uniqueCandidates = candidates.filter((v, i, a) => a.indexOf(v) === i);

      // Query all tenants that match any candidate
      const { data: tenants } = await supabase
        .from("tenants")
        .select("tenant_id")
        .in("tenant_id", uniqueCandidates);

      const tids = tenants?.map(t => t.tenant_id) || [];

      // If no tenant exists yet, use the org_name as the expected tenant
      if (tids.length === 0) {
        setTenantIds([orgName || emailPrefix]);
      } else {
        setTenantIds(tids);
      }
    }
    resolveTenants();
  }, []);

  const loadData = useCallback(async () => {
    if (tenantIds.length === 0) return;

    // Query agents for ALL of this user's tenant IDs
    const { data: agentData } = await supabase
      .from("agents")
      .select("*")
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: false });

    if (agentData && agentData.length > 0) {
      const enriched = await Promise.all(
        agentData.map(async (agent) => {
          const [runsRes, memoriesRes, alertsRes] = await Promise.all([
            supabase
              .from("runs")
              .select("created_at", { count: "exact", head: false })
              .eq("agent_id", agent.agent_id)
              .eq("tenant_id", agent.tenant_id)
              .order("created_at", { ascending: false })
              .limit(1),
            supabase
              .from("runs")
              .select("memories_created")
              .eq("agent_id", agent.agent_id)
              .eq("tenant_id", agent.tenant_id),
            supabase
              .from("alert_history")
              .select("*", { count: "exact", head: true })
              .eq("agent_id", agent.agent_id)
              .eq("tenant_id", agent.tenant_id),
          ]);

          const totalMem = (memoriesRes.data || []).reduce(
            (s: number, r: { memories_created: number }) => s + (r.memories_created || 0), 0
          );

          return {
            ...agent,
            _run_count: runsRes.count || 0,
            _memory_count: totalMem,
            _last_run: runsRes.data?.[0]?.created_at || null,
            _alert_count: alertsRes.count || 0,
          };
        })
      );
      setAgents(enriched);
    } else {
      setAgents([]);
    }

    // Stats scoped to user's tenants
    const [agentsCount, runsCount, memoriesCount, alertsCount] = await Promise.all([
      supabase.from("agents").select("*", { count: "exact", head: true }).in("tenant_id", tenantIds),
      supabase.from("runs").select("*", { count: "exact", head: true }).in("tenant_id", tenantIds),
      supabase.from("runs").select("memories_created").in("tenant_id", tenantIds),
      supabase.from("alert_history").select("*", { count: "exact", head: true }).in("tenant_id", tenantIds),
    ]);

    const totalMem = (memoriesCount.data || []).reduce(
      (s: number, r: { memories_created: number }) => s + (r.memories_created || 0), 0
    );

    setStats({
      totalAgents: agentsCount.count || 0,
      totalRuns: runsCount.count || 0,
      totalMemories: totalMem,
      totalAlerts: alertsCount.count || 0,
    });

    setLoading(false);
  }, [tenantIds]);

  useEffect(() => {
    if (tenantIds.length === 0) return;
    loadData();

    const channel = supabase
      .channel("agents-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantIds, loadData]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-[var(--muted)] rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-[var(--muted)] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (agents.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[80vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-[var(--muted)] flex items-center justify-center mx-auto mb-6">
            <Bot className="w-8 h-8 text-[var(--muted-foreground)]" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Add your first agent</h2>
          <p className="text-[var(--muted-foreground)] mb-6">
            Agents appear here automatically when you run{" "}
            <code className="bg-[var(--muted)] px-1.5 py-0.5 rounded text-xs">
              mnemo.run()
            </code>{" "}
            from the SDK.
          </p>
          <div className="relative rounded-xl border border-[var(--border)] bg-[#0d0d0f] p-4 text-left font-[family-name:var(--font-geist-mono)] text-xs">
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `pip install mnemo-sdk[all]\n\nfrom mnemo import MnemoClient\nmnemo = MnemoClient(tenant_id="${userTenantLabel}")\nresult = mnemo.run(agent_id="my-agent", prompt="...")`
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <div className="text-[var(--muted-foreground)]">
              pip install mnemo-sdk[all]
            </div>
            <div className="mt-2">
              <span className="text-purple-400">from</span>{" "}
              <span className="text-emerald-400">mnemo</span>{" "}
              <span className="text-purple-400">import</span> MnemoClient
            </div>
            <div className="mt-1">
              mnemo = MnemoClient(
              <span className="text-amber-400">tenant_id</span>=
              <span className="text-sky-400">&quot;{userTenantLabel}&quot;</span>)
            </div>
            <div className="mt-1">
              result = mnemo.run(
              <span className="text-amber-400">agent_id</span>=
              <span className="text-sky-400">&quot;my-agent&quot;</span>,{" "}
              <span className="text-amber-400">prompt</span>=
              <span className="text-sky-400">&quot;...&quot;</span>)
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-[var(--accent)]" />
            <div>
              <div className="text-2xl font-bold">{stats.totalAgents}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Total Agents</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-sky-400" />
            <div>
              <div className="text-2xl font-bold">{stats.totalRuns}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Total Runs</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-2xl font-bold">{stats.totalMemories}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Memories Stored</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-2xl font-bold">{stats.totalAlerts}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Alerts Fired</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Agents</h1>
        <Badge variant="outline">{agents.length} agents</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            href={`/dashboard/agents/${agent.agent_id}`}
          >
            <Card className="hover:border-[var(--accent)] transition-colors cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {agent.name || agent.agent_id}
                  </CardTitle>
                  {(agent._alert_count || 0) > 0 && (
                    <Badge variant="warning">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {agent._alert_count}
                    </Badge>
                  )}
                </div>
                {agent.description && (
                  <CardDescription>{agent.description}</CardDescription>
                )}
              </CardHeader>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {agent._last_run
                      ? formatRelativeTime(agent._last_run)
                      : "No runs"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                  <Bot className="w-3.5 h-3.5" />
                  <span>{agent._run_count || 0} runs</span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                  <Brain className="w-3.5 h-3.5" />
                  <span>{agent._memory_count || 0} mem</span>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
