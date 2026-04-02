"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { LayoutDashboard, Bell, LogOut, BookOpen, ArrowUpRight, CreditCard, Shield, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Agents", icon: LayoutDashboard },
  { href: "/dashboard/cop", label: "Mission Control", icon: Shield },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
  { href: "/dashboard/plans", label: "Plans & Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>("");
  const [userPlan, setUserPlan] = useState<string>("free");
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/");
        return;
      }
      setUserEmail(data.user.email || "");

      // Load plan — try explicit tenant_id first, then fallback variants
      const meta = data.user.user_metadata || {};
      const candidates = [meta.tenant_id, meta.org_name, data.user.email?.split("@")[0]].filter(Boolean);
      // Also try stripped variants
      for (const c of [...candidates]) {
        const stripped = (c as string).toLowerCase().replace(/\.(ai|io|com|org|dev|app)$/i, "");
        if (stripped !== c) candidates.push(stripped);
      }
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("plan")
        .in("tenant_id", candidates)
        .limit(1)
        .single();
      if (tenantData?.plan) {
        setUserPlan(tenantData.plan);
      }

      // Load alert count for badge — scoped to user's tenants
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("alert_history")
        .select("*", { count: "exact", head: true })
        .in("tenant_id", candidates)
        .gte("fired_at", cutoff);
      setAlertCount(count || 0);
    });
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="min-h-screen flex font-[family-name:var(--font-geist-sans)]">
      {/* Sidebar */}
      <aside className="w-60 border-r border-[var(--border)] flex flex-col shrink-0">
        <a href="/" className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
          <span style={{ color: 'white', fontWeight: 700, fontSize: '20px', letterSpacing: '1px' }}>Mnemo</span>
        </a>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard" ||
                  pathname.startsWith("/dashboard/agents")
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-[var(--muted)] text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {item.href === "/dashboard/cop" && alertCount > 0 && (
                  <span className="ml-auto text-[10px] bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">{alertCount > 9 ? "9+" : alertCount}</span>
                )}
              </Link>
            );
          })}
          <a
            href="https://github.com/DharmaDhillon/mnemo"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Documentation
            <ArrowUpRight className="w-3 h-3 ml-auto" />
          </a>
        </nav>

        <div className="p-3 border-t border-[var(--border)] space-y-2">
          <div className="px-3">
            <div className="text-xs text-[var(--muted-foreground)] truncate mb-1">
              {userEmail}
            </div>
            <Badge
              variant={
                userPlan === "teams"
                  ? "success"
                  : userPlan === "solo"
                  ? "default"
                  : "outline"
              }
            >
              {userPlan === "teams"
                ? "Teams $99/mo"
                : userPlan === "solo"
                ? "Solo $29/mo"
                : "Free"}
            </Badge>
          </div>
          {userPlan === "free" && (
            <Link href="/dashboard/plans">
              <Button size="sm" className="w-full text-xs">
                Upgrade to Solo — $29/mo
              </Button>
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] w-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
