"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Check, Loader2 } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function PlansPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading plans...</div>}>
      <PlansContent />
    </Suspense>
  );
}

function PlansContent() {
  const searchParams = useSearchParams();
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [tenantId, setTenantId] = useState("");

  const plans = [
    {
      name: "Open Source",
      planKey: "free",
      price: "Free",
      period: "forever",
      features: [
        "Python SDK",
        "Self-host dashboard",
        "Unlimited agents",
        "Community support",
      ],
      cta: "Current Plan",
      highlight: false,
    },
    {
      name: "Cloud Solo",
      planKey: "solo",
      price: "$29",
      period: "/mo",
      features: [
        "Hosted dashboard",
        "No server needed",
        "5 agents",
        "Email support",
      ],
      cta: "Upgrade to Solo",
      highlight: true,
    },
    {
      name: "Cloud Teams",
      planKey: "teams",
      price: "$99",
      period: "/mo",
      features: [
        "Unlimited agents",
        "Pattern detection AI",
        "Team collaboration",
        "Priority support",
      ],
      cta: "Upgrade to Teams",
      highlight: false,
    },
    {
      name: "Enterprise",
      planKey: "enterprise",
      price: "Custom",
      period: "",
      features: [
        "HIPAA/FERPA compliance",
        "SSO + audit trail",
        "Dedicated support",
        "Custom SLA",
      ],
      cta: "Contact Sales",
      highlight: false,
    },
  ];

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserEmail(data.user.email || "");
      const meta = data.user.user_metadata || {};
      const tid = meta.tenant_id || meta.org_name || data.user.email?.split("@")[0] || "default";
      setTenantId(tid);

      const { data: tenantData } = await supabase
        .from("tenants")
        .select("plan")
        .eq("tenant_id", tid)
        .single();
      if (tenantData?.plan) {
        setCurrentPlan(tenantData.plan);
      }

      // Auto-checkout if redirected from landing page with ?plan=
      const autoPlan = searchParams.get("plan");
      if (autoPlan && (autoPlan === "solo" || autoPlan === "teams")) {
        handleCheckout(autoPlan, data.user.email || "", tid);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleCheckout(planKey: string, email?: string, tid?: string) {
    if (planKey === "free") return;
    if (planKey === "enterprise") {
      window.location.href = "mailto:dharma@dharmauniversal.ai?subject=Mnemo Enterprise";
      return;
    }

    setLoading(planKey);
    setError("");

    try {
      const res = await fetch("/api/square/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planKey,
          tenantId: tid || tenantId,
          email: email || userEmail,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to create checkout");
        setLoading(null);
      }
    } catch {
      setError("Failed to connect to payment service");
      setLoading(null);
    }
  }

  function getButtonLabel(planKey: string) {
    if (planKey === currentPlan) return "Current Plan";
    if (planKey === "free" && currentPlan !== "free") return "Downgrade";
    if (planKey === "enterprise") return "Contact Sales";
    return plans.find((p) => p.planKey === planKey)?.cta || "Select";
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Plans & Billing</h1>
        <p className="text-[var(--muted-foreground)] mt-1">
          You are currently on the{" "}
          <Badge
            variant={
              currentPlan === "teams"
                ? "success"
                : currentPlan === "solo"
                ? "default"
                : "outline"
            }
          >
            {currentPlan === "teams"
              ? "Teams"
              : currentPlan === "solo"
              ? "Solo"
              : "Free"}
          </Badge>{" "}
          plan.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={
              plan.planKey === currentPlan
                ? "border-emerald-500 ring-1 ring-emerald-500"
                : plan.highlight
                ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
                : ""
            }
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                {plan.planKey === currentPlan && (
                  <Badge variant="success">Active</Badge>
                )}
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-[var(--muted-foreground)] text-sm">
                  {plan.period}
                </span>
              </div>
            </CardHeader>
            <ul className="space-y-2 mb-6">
              {plan.features.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]"
                >
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              variant={
                plan.planKey === currentPlan
                  ? "outline"
                  : plan.highlight
                  ? "default"
                  : "outline"
              }
              className="w-full"
              size="sm"
              disabled={plan.planKey === currentPlan || loading !== null}
              onClick={() => handleCheckout(plan.planKey)}
            >
              {loading === plan.planKey ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : null}
              {getButtonLabel(plan.planKey)}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
