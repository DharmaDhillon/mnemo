"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { formatRelativeTime } from "@/lib/utils";
import { Bell, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: string;
  threshold: number | null;
  enabled: boolean;
  created_at: string;
}

interface AlertEvent {
  id: string;
  agent_id: string;
  severity: string;
  message: string;
  fired_at: string;
}

export default function AlertsPage() {
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [newName, setNewName] = useState("");
  const [newCondition, setNewCondition] = useState("latency_high");
  const [newSeverity, setNewSeverity] = useState("warning");
  const [newThreshold, setNewThreshold] = useState("10000");

  useEffect(() => {
    async function resolveTenants() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const meta = userData.user.user_metadata || {};
      const raw = [meta.tenant_id, meta.org_name, userData.user.email?.split("@")[0]].filter(Boolean);
      for (const r of [...raw]) {
        const stripped = (r as string).toLowerCase().replace(/\.(ai|io|com|org|dev|app)$/i, "");
        if (stripped !== r) raw.push(stripped);
        raw.push((r as string).toLowerCase().replace(/[^a-z0-9]/g, ""));
      }
      const candidates = raw.filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
      try {
        const { data: linked } = await supabase.from("user_tenants").select("tenant_id").eq("user_id", userData.user.id);
        linked?.forEach(l => { if (!candidates.includes(l.tenant_id)) candidates.push(l.tenant_id); });
      } catch { /* */ }
      const { data: tenants } = await supabase.from("tenants").select("tenant_id").in("tenant_id", candidates);
      const tids = (tenants || []).map(t => t.tenant_id);
      setTenantIds(tids);
    }
    resolveTenants();
  }, []);

  useEffect(() => {
    if (tenantIds.length > 0) loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantIds]);

  async function loadData() {
    if (tenantIds.length === 0) return;
    const [rulesRes, historyRes] = await Promise.all([
      supabase.from("alert_rules").select("*").in("tenant_id", tenantIds).order("created_at", { ascending: false }),
      supabase.from("alert_history").select("*").in("tenant_id", tenantIds).order("fired_at", { ascending: false }).limit(50),
    ]);

    setRules(rulesRes.data || []);
    setHistory(historyRes.data || []);
    setLoading(false);
  }

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    const { data: userData } = await supabase.auth.getUser();
    const tenantId =
      userData.user?.user_metadata?.org_name ||
      userData.user?.email?.split("@")[0] ||
      "default";

    await supabase.from("alert_rules").insert({
      tenant_id: tenantId,
      name: newName,
      condition: newCondition,
      severity: newSeverity,
      threshold: parseFloat(newThreshold) || null,
      enabled: true,
    });

    setNewName("");
    setShowForm(false);
    loadData();
  }

  async function deleteRule(id: string) {
    await supabase.from("alert_rules").delete().eq("id", id);
    loadData();
  }

  async function toggleRule(id: string, enabled: boolean) {
    await supabase.from("alert_rules").update({ enabled: !enabled }).eq("id", id);
    loadData();
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-[var(--muted)] rounded" />
          <div className="h-64 bg-[var(--muted)] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Alerts</h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" />
          New Rule
        </Button>
      </div>

      {/* Create Rule Form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Create Alert Rule</CardTitle>
          </CardHeader>
          <form onSubmit={createRule} className="space-y-3">
            <input
              type="text"
              placeholder="Rule name (e.g. High latency alert)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <div className="grid grid-cols-3 gap-3">
              <select
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="latency_high">Latency too high</option>
                <option value="no_memories">No memories available</option>
                <option value="response_too_short">Response too short</option>
                <option value="response_too_long">Response too long</option>
                <option value="error_rate_high">Error rate high</option>
              </select>
              <select
                value={newSeverity}
                onChange={(e) => setNewSeverity(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
              <input
                type="number"
                placeholder="Threshold (e.g. 10000 for ms)"
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Create Rule
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Alert Rules */}
      <h2 className="text-lg font-semibold mb-3">Rules</h2>
      {rules.length === 0 ? (
        <Card className="mb-8">
          <div className="text-center py-8">
            <Bell className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-3" />
            <p className="text-[var(--muted-foreground)]">
              No alert rules configured. Create one to get started.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2 mb-8">
          {rules.map((rule) => (
            <Card key={rule.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleRule(rule.id, rule.enabled)}
                    className={`w-8 h-4 rounded-full transition-colors relative ${
                      rule.enabled ? "bg-emerald-500" : "bg-[var(--muted)]"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                        rule.enabled ? "left-4" : "left-0.5"
                      }`}
                    />
                  </button>
                  <div>
                    <span className="text-sm font-medium">{rule.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">
                        {rule.condition}
                      </Badge>
                      <Badge
                        variant={
                          rule.severity === "critical"
                            ? "destructive"
                            : rule.severity === "warning"
                            ? "warning"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {rule.severity}
                      </Badge>
                      {rule.threshold && (
                        <span className="text-[10px] text-[var(--muted-foreground)]">
                          threshold: {rule.threshold}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Alert History */}
      <h2 className="text-lg font-semibold mb-3">History</h2>
      {history.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          No alerts have fired yet.
        </p>
      ) : (
        <div className="space-y-2">
          {history.map((alert) => (
            <Card key={alert.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
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
                  <div>
                    <span className="text-sm">{alert.message}</span>
                    <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                      Agent: {alert.agent_id}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                  {formatRelativeTime(alert.fired_at)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
