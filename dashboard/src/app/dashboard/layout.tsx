"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { LayoutDashboard, Bell, LogOut, BookOpen, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Agents", icon: LayoutDashboard },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
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

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/");
        return;
      }
      setUserEmail(data.user.email || "");

      // Load plan from tenants table
      const tenantId =
        data.user.user_metadata?.org_name ||
        data.user.email?.split("@")[0] ||
        "default";
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("plan")
        .eq("tenant_id", tenantId)
        .single();
      if (tenantData?.plan) {
        setUserPlan(tenantData.plan);
      }
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
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
          <Image src="/mnemo_logo.svg" alt="Mnemo" width={24} height={24} />
          <span className="font-bold">Mnemo</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard" ||
                  pathname.startsWith("/dashboard/agents")
                : pathname === item.href;
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
            <Link href="/#pricing">
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
