"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { formatRelativeTime } from "@/lib/utils";
import { Plus, Trash2, Link2, Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface LinkedTenant {
  id: string;
  tenant_id: string;
  created_at: string;
}

interface DetectedTenant {
  tenant_id: string;
  already_linked: boolean;
}

export default function SettingsPage() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [tenantIdSlug, setTenantIdSlug] = useState("");
  const [userPlan, setUserPlan] = useState("free");
  const [memberSince, setMemberSince] = useState("");
  const [linked, setLinked] = useState<LinkedTenant[]>([]);
  const [detected, setDetected] = useState<DetectedTenant[]>([]);
  const [newTenantId, setNewTenantId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const user = userData.user;
    const meta = user.user_metadata || {};
    setUserId(user.id);
    setUserEmail(user.email || "");
    setOrgName(meta.org_name || "");
    setTenantIdSlug(meta.tenant_id || "");
    setMemberSince(user.created_at || "");

    // Load plan
    const candidates = [meta.tenant_id, meta.org_name, user.email?.split("@")[0]].filter(Boolean);
    for (const c of [...candidates]) {
      const stripped = (c as string).toLowerCase().replace(/\.(ai|io|com|org|dev|app)$/i, "");
      if (stripped !== c) candidates.push(stripped);
    }
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("plan")
      .in("tenant_id", candidates.filter(Boolean))
      .limit(1)
      .single();
    if (tenantData?.plan) setUserPlan(tenantData.plan);

    // Load linked tenants
    try {
      const { data: linkedData } = await supabase
        .from("user_tenants")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setLinked(linkedData || []);

      // Detect tenants from common patterns
      const patterns = candidates.filter(Boolean).map(c => (c as string).toLowerCase()).filter((v, i, a) => a.indexOf(v) === i);
      const { data: allTenants } = await supabase
        .from("tenants")
        .select("tenant_id")
        .in("tenant_id", patterns);

      const linkedIds = new Set((linkedData || []).map(l => l.tenant_id));
      setDetected(
        (allTenants || []).map(t => ({
          tenant_id: t.tenant_id,
          already_linked: linkedIds.has(t.tenant_id),
        }))
      );
    } catch {
      // user_tenants table may not exist
    }
  }

  async function connectTenant(tid: string) {
    setConnecting(true);
    setMessage("");
    const { error } = await supabase
      .from("user_tenants")
      .insert({ user_id: userId, tenant_id: tid });

    if (error) {
      if (error.code === "23505") setMessage("Already connected");
      else setMessage(error.message);
    } else {
      setMessage(`Connected to ${tid}`);
      setNewTenantId("");
    }
    setConnecting(false);
    loadData();
  }

  async function disconnectTenant(id: string) {
    await supabase.from("user_tenants").delete().eq("id", id);
    loadData();
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Account */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Email</span>
            <span>{userEmail}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Organization</span>
            <span>{orgName || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Tenant ID</span>
            <code className="text-[var(--accent)]">{tenantIdSlug || "—"}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Plan</span>
            <Badge variant={userPlan === "solo" ? "default" : userPlan === "teams" ? "success" : "outline"}>
              {userPlan}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Member since</span>
            <span>{memberSince ? new Date(memberSince).toLocaleDateString() : "—"}</span>
          </div>
        </div>
      </Card>

      {/* Connected Tenants */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Connected Tenants
          </CardTitle>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Connect SDK tenants to see their data in Mission Control and Agents view.
          </p>
        </CardHeader>

        {linked.length > 0 && (
          <div className="space-y-2 mb-4">
            {linked.map(t => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--border)]">
                <div>
                  <code className="text-sm font-semibold">{t.tenant_id}</code>
                  <span className="text-xs text-[var(--muted-foreground)] ml-2">
                    connected {formatRelativeTime(t.created_at)}
                  </span>
                </div>
                <button onClick={() => disconnectTenant(t.id)} className="text-[var(--muted-foreground)] hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter tenant_id from your SDK"
            value={newTenantId}
            onChange={e => setNewTenantId(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <Button size="sm" disabled={!newTenantId.trim() || connecting} onClick={() => connectTenant(newTenantId.trim())}>
            <Plus className="w-3.5 h-3.5 mr-1" />Connect
          </Button>
        </div>
        <p className="text-[10px] text-[var(--muted-foreground)] mt-2">
          This is the tenant_id you pass to MnemoClient(tenant_id=&quot;...&quot;)
        </p>

        {message && (
          <p className={`text-xs mt-2 ${message.includes("Connected") ? "text-emerald-400" : "text-amber-400"}`}>
            {message}
          </p>
        )}
      </Card>

      {/* Auto-detected tenants */}
      {detected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Detected Tenants
            </CardTitle>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Tenants detected from your account info. Click to connect.
            </p>
          </CardHeader>
          <div className="space-y-2">
            {detected.map(t => (
              <div key={t.tenant_id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--border)]">
                <code className="text-sm">{t.tenant_id}</code>
                {t.already_linked ? (
                  <Badge variant="success" className="text-[10px]">Connected</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => connectTenant(t.tenant_id)}>
                    Connect
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
