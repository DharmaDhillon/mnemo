"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import {
  Eye,
  Bell,
  Shield,
  Zap,
  Brain,
  ArrowRight,
  Check,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LandingPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (authMode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { org_name: orgName || email.split("@")[0] },
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
    }
    if (pendingPlan && pendingPlan !== "free") {
      router.push(`/dashboard/plans?plan=${pendingPlan}`);
    } else {
      router.push("/dashboard");
    }
  }

  const features = [
    {
      icon: Brain,
      title: "Persistent Memory",
      desc: "Episodic, semantic, and pattern memory across every run",
    },
    {
      icon: Eye,
      title: "Full Observability",
      desc: "Every decision traced via Langfuse + OpenTelemetry",
    },
    {
      icon: Bell,
      title: "Smart Alerts",
      desc: "Latency spikes, missing memories, error rates, custom rules",
    },
    {
      icon: Shield,
      title: "Compliance Mode",
      desc: "HIPAA, FERPA, COPPA audit trails for regulated industries",
    },
    {
      icon: Zap,
      title: "Any LLM",
      desc: "Works with Claude, OpenAI, LangChain, or raw HTTP",
    },
    {
      icon: ArrowRight,
      title: "2 Lines of Code",
      desc: "Drop-in layer on top of whatever you already use",
    },
  ];

  async function handlePlanSelect(planKey: string) {
    if (planKey === "enterprise") {
      window.location.href = "mailto:hello@usemnemo.com?subject=Mnemo Enterprise";
      return;
    }

    // Check if user is logged in
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      // Not logged in — store desired plan and show auth modal
      setPendingPlan(planKey);
      setAuthMode(planKey === "free" ? "signup" : "login");
      return;
    }

    // Already logged in
    if (planKey === "free") {
      router.push("/dashboard");
      return;
    }

    // Logged in + paid plan — go straight to checkout
    router.push(`/dashboard/plans?plan=${planKey}`);
  }

  const plans = [
    {
      name: "Open Source",
      price: "Free",
      period: "forever",
      planKey: "free",
      features: [
        "Python SDK",
        "Self-host dashboard",
        "Unlimited agents",
        "Community support",
      ],
      cta: "Get Started",
      highlight: false,
    },
    {
      name: "Cloud Solo",
      price: "$29",
      period: "/mo",
      planKey: "solo",
      features: [
        "Hosted dashboard",
        "No server needed",
        "5 agents",
        "Email support",
      ],
      cta: "Start Trial",
      highlight: true,
    },
    {
      name: "Cloud Teams",
      price: "$99",
      period: "/mo",
      planKey: "teams",
      features: [
        "Unlimited agents",
        "Pattern detection AI",
        "Team collaboration",
        "Priority support",
      ],
      cta: "Start Trial",
      highlight: false,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      planKey: "enterprise",
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

  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Image src="/mnemo_logo.svg" alt="Mnemo" width={32} height={32} />
          <span className="text-lg font-bold">Mnemo</span>
        </div>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAuthMode("login")}
          >
            Log in
          </Button>
          <Button size="sm" onClick={() => setAuthMode("signup")}>
            Sign up
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center px-6 pt-24 pb-16">
        <div className="flex justify-center mb-8">
          <Image src="/mnemo_logo.svg" alt="Mnemo" width={56} height={56} />
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
          Every AI framework teaches agents to think.
          <br />
          <span className="text-[var(--accent)]">
            Nobody taught them to remember.
          </span>
        </h1>
        <p className="mt-6 text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
          Mnemo gives any AI agent persistent memory and full observability.
          Two lines of code. Works with any LLM.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Button size="lg" onClick={() => setAuthMode("signup")}>
            Get Started Free
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() =>
              window.open("https://github.com/DharmaDhillon/mnemo", "_blank")
            }
          >
            View on GitHub
          </Button>
        </div>

        {/* Code snippet */}
        <div className="mt-12 text-left max-w-xl mx-auto">
          <div className="rounded-xl border border-[var(--border)] bg-[#0d0d0f] p-6 font-[family-name:var(--font-geist-mono)] text-sm">
            <div className="text-[var(--muted-foreground)]">
              # pip install mnemo-sdk[all]
            </div>
            <div className="mt-3">
              <span className="text-purple-400">from</span>{" "}
              <span className="text-emerald-400">mnemo</span>{" "}
              <span className="text-purple-400">import</span> MnemoClient
            </div>
            <div className="mt-2">
              mnemo = <span className="text-emerald-400">MnemoClient</span>(
              <span className="text-amber-400">tenant_id</span>=
              <span className="text-sky-400">&quot;my-company&quot;</span>)
            </div>
            <div className="mt-1">
              result = mnemo.
              <span className="text-emerald-400">run</span>(
              <span className="text-amber-400">agent_id</span>=
              <span className="text-sky-400">&quot;my-agent&quot;</span>,{" "}
              <span className="text-amber-400">prompt</span>=
              <span className="text-sky-400">&quot;...&quot;</span>)
            </div>
            <div className="mt-3 text-[var(--muted-foreground)]">
              # That&apos;s it. Memory + traces + alerts. Automatically.
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">
          Everything your agents need
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <Card key={f.title} className="hover:border-[var(--accent)] transition-colors">
              <CardHeader>
                <f.icon className="w-5 h-5 text-[var(--accent)] mb-2" />
                <CardTitle className="text-base">{f.title}</CardTitle>
                <CardDescription>{f.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">Pricing</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={
                plan.highlight
                  ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
                  : ""
              }
            >
              <CardHeader>
                <CardTitle className="text-base">{plan.name}</CardTitle>
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
                variant={plan.highlight ? "default" : "outline"}
                className="w-full"
                size="sm"
                onClick={() => handlePlanSelect(plan.planKey)}
              >
                {plan.cta}
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-6 py-8 text-center text-sm text-[var(--muted-foreground)]">
        MIT License &middot; Built by{" "}
        <a
          href="https://github.com/DharmaDhillon"
          className="text-[var(--accent)] hover:underline"
        >
          Dharma Dhillon
        </a>
      </footer>

      {/* Auth Modal */}
      {authMode && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setAuthMode(null)}
        >
          <Card
            className="w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle>
                {authMode === "signup" ? "Create your account" : "Welcome back"}
              </CardTitle>
              <CardDescription>
                {pendingPlan && pendingPlan !== "free"
                  ? `Sign in to continue to ${pendingPlan === "solo" ? "Solo $29/mo" : "Teams $99/mo"} checkout`
                  : authMode === "signup"
                  ? "Start giving your agents memory"
                  : "Log in to your dashboard"}
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === "signup" && (
                <input
                  type="text"
                  placeholder="Organization name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />

              {error && (
                <p className="text-sm text-[var(--destructive)]">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? "Loading..."
                  : authMode === "signup"
                  ? "Create Account"
                  : "Log In"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-[var(--muted-foreground)]">
              {authMode === "signup" ? (
                <>
                  Already have an account?{" "}
                  <button
                    className="text-[var(--accent)] hover:underline"
                    onClick={() => setAuthMode("login")}
                  >
                    Log in
                  </button>
                </>
              ) : (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    className="text-[var(--accent)] hover:underline"
                    onClick={() => setAuthMode("signup")}
                  >
                    Sign up
                  </button>
                </>
              )}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
