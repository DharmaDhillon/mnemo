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
  const [codeLang, setCodeLang] = useState<"python" | "typescript">("python");
  const [tidCopied, setTidCopied] = useState(false);

  // Resolve all tenant IDs this user could own
  useEffect(() => {
    async function resolveTenants() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const meta = userData.user.user_metadata || {};
      const orgName = meta.org_name || "";
      const emailPrefix = userData.user.email?.split("@")[0] || "";

      // Use the explicit tenant_id from metadata if available (set on signup)
      const explicitTid = meta.tenant_id || "";
      setUserTenantLabel(explicitTid || orgName || emailPrefix);

      // Build candidate list: explicit slug first, then fallback variants
      const raw = [explicitTid, orgName, emailPrefix, orgName.toLowerCase(), emailPrefix.toLowerCase()];
      for (const r of [...raw]) {
        const stripped = r.replace(/\.(ai|io|com|org|dev|app)$/i, "");
        if (stripped !== r) raw.push(stripped, stripped.toLowerCase());
      }
      const uniqueCandidates = raw.filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

      // Query all tenants that match any candidate
      const { data: tenants } = await supabase
        .from("tenants")
        .select("tenant_id")
        .in("tenant_id", uniqueCandidates);

      const tids = tenants?.map(t => t.tenant_id) || [];

      if (tids.length === 0) {
        setTenantIds([explicitTid || orgName || emailPrefix]);
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
          {/* Tenant ID */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider mb-1">Your Tenant ID</div>
              <code className="text-sm text-[var(--accent)] font-semibold">{userTenantLabel}</code>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(userTenantLabel); setTidCopied(true); setTimeout(() => setTidCopied(false), 2000); }}
              className="p-1.5 rounded-md hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
            >
              {tidCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[var(--muted-foreground)] text-xs mb-4">
            Use this exact tenant ID in your SDK config. It connects your agents to this dashboard.
          </p>

          {/* Language toggle */}
          <div className="flex gap-1 mb-3 justify-center">
            <button
              onClick={() => setCodeLang("python")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${codeLang === "python" ? "bg-[var(--accent)] text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}
            >Python</button>
            <button
              onClick={() => setCodeLang("typescript")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${codeLang === "typescript" ? "bg-[var(--accent)] text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}
            >TypeScript</button>
          </div>

          <div className="relative rounded-xl border border-[var(--border)] bg-[#0d0d0f] p-4 text-left font-[family-name:var(--font-geist-mono)] text-xs">
            <button
              onClick={() => {
                const pyCode = `pip install mnemo-sdk[all]\n\nfrom mnemo import MnemoClient\nmnemo = MnemoClient(tenant_id="${userTenantLabel}")\nresult = mnemo.run(agent_id="my-agent", prompt="...")`;
                const tsCode = `// Add to .env.local:\n// MNEMO_API_URL=https://mnemo-api-production.up.railway.app\n\nconst start = Date.now()\nconst response = await yourLLM.complete(prompt)\n\nawait mnemoTrack({\n  tenantId: "${userTenantLabel}",\n  agentId: "my-agent",\n  prompt: userMessage,\n  response: response.text,\n  latencyMs: Date.now() - start,\n})`;
                navigator.clipboard.writeText(codeLang === "python" ? pyCode : tsCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {codeLang === "python" ? (
              <>
                <div className="text-[var(--muted-foreground)]">pip install mnemo-sdk[all]</div>
                <div className="mt-2">
                  <span className="text-purple-400">from</span>{" "}
                  <span className="text-emerald-400">mnemo</span>{" "}
                  <span className="text-purple-400">import</span> MnemoClient
                </div>
                <div className="mt-1">
                  mnemo = MnemoClient(<span className="text-amber-400">tenant_id</span>=<span className="text-sky-400">&quot;{userTenantLabel}&quot;</span>)
                </div>
                <div className="mt-1">
                  result = mnemo.run(<span className="text-amber-400">agent_id</span>=<span className="text-sky-400">&quot;my-agent&quot;</span>, <span className="text-amber-400">prompt</span>=<span className="text-sky-400">&quot;...&quot;</span>)
                </div>
              </>
            ) : (
              <>
                <div className="text-[var(--muted-foreground)]">{"//"} Add to .env.local:</div>
                <div className="text-[var(--muted-foreground)]">{"//"} MNEMO_API_URL=https://mnemo-api-production.up.railway.app</div>
                <div className="mt-2">
                  <span className="text-purple-400">const</span> start = <span className="text-emerald-400">Date</span>.now()
                </div>
                <div className="mt-1">
                  <span className="text-purple-400">const</span> response = <span className="text-purple-400">await</span> yourLLM.complete(prompt)
                </div>
                <div className="mt-2">
                  <span className="text-purple-400">await</span> <span className="text-emerald-400">mnemoTrack</span>({"{"}
                </div>
                <div className="ml-4">
                  <span className="text-amber-400">tenantId</span>: <span className="text-sky-400">&quot;{userTenantLabel}&quot;</span>,
                </div>
                <div className="ml-4">
                  <span className="text-amber-400">agentId</span>: <span className="text-sky-400">&quot;my-agent&quot;</span>,
                </div>
                <div className="ml-4">
                  <span className="text-amber-400">prompt</span>: userMessage,
                </div>
                <div className="ml-4">
                  <span className="text-amber-400">response</span>: response.text,
                </div>
                <div className="ml-4">
                  <span className="text-amber-400">latencyMs</span>: <span className="text-emerald-400">Date</span>.now() - start,
                </div>
                <div>{"}"})
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Tenant ID bar */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Tenant ID</span>
          <code className="text-sm text-[var(--accent)] font-semibold">{userTenantLabel}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(userTenantLabel); setTidCopied(true); setTimeout(() => setTidCopied(false), 2000); }}
            className="p-1 rounded hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
          >
            {tidCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <span className="text-[10px] text-[var(--muted-foreground)]">Use this in your SDK: MnemoClient(tenant_id=&quot;{userTenantLabel}&quot;)</span>
      </div>

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
