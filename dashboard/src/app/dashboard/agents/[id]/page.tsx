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
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Run {
  id: string;
  run_id: string;
  status: string;
  duration_ms: number;
  memories_injected: number;
  memories_created: number;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface Memory {
  id: string;
  content: string;
  memory_type: string;
  created_at: string;
}

interface AlertEvent {
  id: string;
  severity: string;
  message: string;
  fired_at: string;
}

interface DayCount {
  date: string;
  count: number;
}

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;
  const [runs, setRuns] = useState<Run[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [dailyRuns, setDailyRuns] = useState<DayCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [runsRes, memoriesRes, alertsRes] = await Promise.all([
        supabase
          .from("runs")
          .select("*")
          .eq("agent_id", agentId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("memories")
          .select("*")
          .eq("agent_id", agentId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("alert_history")
          .select("*")
          .eq("agent_id", agentId)
          .order("fired_at", { ascending: false })
          .limit(10),
      ]);

      setRuns(runsRes.data || []);
      setMemories(memoriesRes.data || []);
      setAlerts(alertsRes.data || []);

      // Build daily run chart data (last 14 days)
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
      setDailyRuns(
        Object.entries(days).map(([date, count]) => ({ date, count }))
      );

      setLoading(false);
    }

    load();

    // Real-time for runs
    const channel = supabase
      .channel(`runs-${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "runs",
          filter: `agent_id=eq.${agentId}`,
        },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId]);

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

  const totalRuns = runs.length;
  const avgDuration =
    totalRuns > 0
      ? runs.reduce((s, r) => s + (r.duration_ms || 0), 0) / totalRuns
      : 0;
  const totalMemories = memories.length;
  const maxBarValue = Math.max(...dailyRuns.map((d) => d.count), 1);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard"
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">{agentId}</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-[var(--accent)]" />
            <div>
              <div className="text-2xl font-bold">{totalRuns}</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                Total runs
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-sky-400" />
            <div>
              <div className="text-2xl font-bold">
                {formatDuration(avgDuration)}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">
                Avg duration
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-2xl font-bold">{totalMemories}</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                Memories
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-2xl font-bold">{alerts.length}</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                Alerts
              </div>
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
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-full bg-[var(--accent)] rounded-sm min-h-[2px] transition-all"
                style={{
                  height: `${Math.max((d.count / maxBarValue) * 100, 2)}%`,
                }}
              />
              <span className="text-[10px] text-[var(--muted-foreground)]">
                {d.date.slice(8)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Traces */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Traces</h2>
          <div className="space-y-2">
            {runs.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                No runs yet. Use the SDK to start tracing.
              </p>
            ) : (
              runs.map((run) => (
                <Card key={run.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {run.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[var(--destructive)]" />
                      )}
                      <code className="text-xs text-[var(--muted-foreground)]">
                        {run.run_id.slice(0, 8)}...
                      </code>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                      <span>{formatDuration(run.duration_ms || 0)}</span>
                      <span>
                        {run.memories_injected} mem in / {run.memories_created}{" "}
                        out
                      </span>
                      <span>{formatRelativeTime(run.created_at)}</span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Memories */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Memories</h2>
          <div className="space-y-2">
            {memories.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                No memories stored yet.
              </p>
            ) : (
              memories.map((mem) => (
                <Card key={mem.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm leading-relaxed line-clamp-3">
                      {mem.content}
                    </p>
                    <Badge variant="outline" className="shrink-0">
                      {mem.memory_type}
                    </Badge>
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-2">
                    {formatRelativeTime(mem.created_at)}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Alerts for this agent */}
      {alerts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Recent Alerts</h2>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <Card key={alert.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        alert.severity === "critical"
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
      )}
    </div>
  );
}
