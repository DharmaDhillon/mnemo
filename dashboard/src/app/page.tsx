"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";

/* ─── palette ─── */
const C = {
  bg: "#0a0a0f",
  purple: "#7C3AED",
  purpleLight: "#A78BFA",
  green: "#5DCAA5",
  amber: "#EF9F27",
  blue: "#85B7EB",
  border: "rgba(255,255,255,0.07)",
  muted: "#a1a1aa",
  card: "#121217",
  cardAlt: "#18181f",
};

/* ─── typing hook ─── */
function useTyping(text: string, delay: number, speed = 22) {
  const [displayed, setDisplayed] = useState("");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let i = 0;
    const t = setTimeout(() => {
      const iv = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(iv);
      }, speed);
    }, delay);
    return () => clearTimeout(t);
  }, [text, delay, speed]);
  return displayed;
}

/* ─── count-up hook ─── */
function useCountUp(target: number, delay: number, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const start = Date.now();
      const iv = setInterval(() => {
        const p = Math.min((Date.now() - start) / duration, 1);
        setVal(Math.round(p * target));
        if (p >= 1) clearInterval(iv);
      }, 30);
    }, delay);
    return () => clearTimeout(t);
  }, [target, delay, duration]);
  return val;
}

/* ─── fade-in component ─── */
function FadeIn({ children, delay = 0, from = "bottom", className = "" }: {
  children: React.ReactNode; delay?: number; from?: "left" | "right" | "bottom"; className?: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  const transform = !visible
    ? from === "left" ? "translateX(-20px)" : from === "right" ? "translateX(20px)" : "translateY(16px)"
    : "translate(0)";
  return (
    <div className={className} style={{ opacity: visible ? 1 : 0, transform, transition: "all 0.5s ease" }}>
      {children}
    </div>
  );
}

/* ─── student data ─── */
const students = [
  {
    name: "Maya", age: 11, initials: "MA", color: C.green, status: "flying", statusIcon: "",
    project: "weather app · s4", question: "how do I make it rain on screen?",
    agent: "Agent Vibe", agentColor: C.green,
    reply: "You added sunshine last session — great! Now let's make it rain with CSS keyframes like this...",
    delay: 600,
  },
  {
    name: "Jordan", age: 9, initials: "JL", color: C.amber, status: "stuck", statusIcon: "\u26A0",
    project: "quiz game · stuck", question: "why doesnt my button work",
    agent: "Agent Sage", agentColor: C.amber,
    reply: "You learn best from examples — I remember! Here's a working button, copy it and change one thing...",
    delay: 1300,
  },
  {
    name: "Priya", age: 13, initials: "PR", color: C.purpleLight, status: "level up", statusIcon: "\u2605",
    project: "ai chatbot · \u2605", question: "my bot remembers names!!",
    agent: "Agent Vibe", agentColor: C.purpleLight,
    reply: "You just built persistent state — that's advanced! Memory updated. Ready for your first real API call?",
    delay: 2100,
  },
  {
    name: "Tyler", age: 10, initials: "TK", color: C.blue, status: "safe", statusIcon: "\uD83D\uDEE1",
    project: "pet tracker · blocked", question: "write my essay for school",
    agent: "Agent Shield", agentColor: C.blue,
    reply: "I only help with coding — but your pet tracker still needs a feeding schedule! Let's build that together...",
    delay: 2900,
  },
];

/* ─── student card ─── */
function StudentCard({ s }: { s: typeof students[0] }) {
  const typed = useTyping(s.reply, s.delay);
  return (
    <div style={{
      border: `1px solid ${s.color}35`, borderRadius: 12, padding: 16, marginBottom: 10,
      background: `${s.color}08`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: `${s.color}25`,
            color: s.color, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700,
          }}>{s.initials}</div>
          <div>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}, {s.age}</span>
            <div style={{ fontSize: 11, color: C.muted }}>{s.project}</div>
          </div>
        </div>
        <span style={{
          fontSize: 10, padding: "2px 8px", borderRadius: 99, background: `${s.color}20`, color: s.color, fontWeight: 600,
        }}>{s.statusIcon} {s.status}</span>
      </div>
      <div style={{
        background: `${C.bg}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#ccc", marginBottom: 8,
      }}>
        <span style={{ color: C.muted, fontSize: 10 }}>student:</span> {s.question}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: 9, padding: "1px 6px", borderRadius: 4, background: `${s.agentColor}20`,
          color: s.agentColor, fontWeight: 600,
        }}>{s.agent}</span>
      </div>
      <div style={{ fontSize: 12, color: "#d4d4d8", lineHeight: 1.5, minHeight: 40 }}>
        {typed}<span style={{ opacity: typed.length < s.reply.length ? 1 : 0, color: s.color }}>|</span>
      </div>
    </div>
  );
}

/* ═══════════════════ MAIN PAGE ═══════════════════ */
export default function LandingPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

  /* count-up stats */
  const memCount = useCountUp(24, 2200);
  const traceCount = useCountUp(4, 2600);
  const alertCount = useCountUp(3, 3000);
  const protectCount = useCountUp(1, 3400);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    if (authMode === "signup") {
      const { error: err } = await supabase.auth.signUp({ email, password, options: { data: { org_name: orgName || email.split("@")[0] } } });
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError(err.message); setLoading(false); return; }
    }
    router.push(pendingPlan && pendingPlan !== "free" ? `/dashboard/plans?plan=${pendingPlan}` : "/dashboard");
  }

  const handlePlanSelect = useCallback(async (planKey: string) => {
    if (planKey === "enterprise") { window.location.href = "mailto:dharma@dharmauniversal.ai?subject=Mnemo Enterprise"; return; }
    const { data } = await supabase.auth.getUser();
    if (!data.user) { setPendingPlan(planKey); setAuthMode(planKey === "free" ? "signup" : "login"); return; }
    if (planKey === "free") { router.push("/dashboard"); return; }
    router.push(`/dashboard/plans?plan=${planKey}`);
  }, [router]);

  const sectionStyle: React.CSSProperties = { maxWidth: 1200, margin: "0 auto", padding: "0 24px" };

  /* ─── RENDER ─── */
  return (
    <div style={{ background: C.bg, color: "#fafafa", fontFamily: "system-ui, -apple-system, sans-serif", minWidth: 0, overflowX: "hidden" }}>

      {/* ═══ NAVBAR ═══ */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50, background: C.bg,
        borderBottom: `1px solid ${C.border}`, backdropFilter: "blur(12px)",
      }}>
        <div style={{ ...sectionStyle, display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src="/mnemo_logo.svg" alt="Mnemo" style={{ height: 28, width: "auto" }} />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 18, letterSpacing: 2 }}>MNEMO</span>
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a href="https://github.com/DharmaDhillon/mnemo" target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, color: "#ccc", textDecoration: "none" }}>
              <span style={{ color: C.amber }}>&#9733;</span> GitHub
            </a>
            <button onClick={() => { setPendingPlan("free"); setAuthMode("signup"); }}
              style={{ padding: "6px 16px", borderRadius: 8, background: C.purple, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Start Free
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section style={{ ...sectionStyle, textAlign: "center", paddingTop: 80, paddingBottom: 48 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 14px", borderRadius: 99,
          background: `${C.purple}15`, border: `1px solid ${C.purple}30`, fontSize: 13, color: C.purpleLight, marginBottom: 24,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.purple, display: "inline-block", animation: "pulse 2s infinite" }} />
          MIT open source &middot; pip install mnemo-sdk
        </div>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 20 }}>
          AI agents think.<br />
          <span style={{ color: C.purpleLight }}>Now they remember.</span><br />
          And you can watch.
        </h1>
        <p style={{ fontSize: "clamp(15px, 2vw, 18px)", color: C.muted, maxWidth: 600, margin: "0 auto 32px", lineHeight: 1.6 }}>
          Memory + observability unified in two lines of code. Drop into any agent. Works with Claude, OpenAI, LangChain, or anything.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 }}>
          <button onClick={() => handlePlanSelect("free")}
            style={{ padding: "12px 24px", borderRadius: 8, background: C.purple, color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            Start Free — no card needed
          </button>
          <a href="https://github.com/DharmaDhillon/mnemo" target="_blank" rel="noopener noreferrer"
            style={{ padding: "12px 24px", borderRadius: 8, background: "transparent", color: "#fff", border: `1px solid ${C.border}`, fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
            View on GitHub
          </a>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 1, background: C.border,
          borderRadius: 12, overflow: "hidden", maxWidth: 520, margin: "0 auto",
        }}>
          {[["2", "LINES OF CODE"], ["MIT", "OPEN SOURCE"], ["HIPAA", "COMPLIANT"], ["4", "SUBSYSTEMS"]].map(([v, l]) => (
            <div key={l} style={{ background: C.card, padding: "16px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.purpleLight }}>{v}</div>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1 }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ HERO DEMO ═══ */}
      <section style={{ ...sectionStyle, paddingBottom: 64 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 10, letterSpacing: 2, color: C.muted }}>
            4 STUDENTS &middot; AGENT VIBE &middot; AGENT SAGE &middot; AGENT SHIELD &middot; MEMORY + OBSERVABILITY LIVE
          </span>
        </div>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", background: C.card }}>
          {/* mac bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px",
            borderBottom: `1px solid ${C.border}`, fontSize: 12,
          }}>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
            </div>
            <span style={{ color: C.muted, fontSize: 11 }}>usemnemo.com — MiniFounder.ai classroom</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "pulse 2s infinite" }} />
              <span style={{ color: C.green, fontSize: 10 }}>observing</span>
            </div>
          </div>
          {/* 3 columns */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 0 }}>
            {/* COL 1 — Students */}
            <div style={{ padding: 16, borderRight: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 12 }}>STUDENT SESSIONS</div>
              {students.map(s => <StudentCard key={s.name} s={s} />)}
            </div>

            {/* COL 2 — Memory */}
            <div style={{ padding: 16, borderRight: `1px solid ${C.border}`, borderColor: `${C.purple}30` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.purpleLight }}>Memory Layer</span>
                  <div style={{ fontSize: 11, color: C.muted }}>what every agent remembers</div>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: C.purpleLight }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.purple, animation: "pulse 2s infinite" }} />
                  MEMORY ACTIVE
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, marginTop: 10 }}>
                {[["24", "STORED", C.purple], ["12", "INJECTED", C.purpleLight], ["3", "TYPES", "#5b21b6"]].map(([v, l, c]) => (
                  <div key={l} style={{ flex: 1, textAlign: "center", padding: "6px 0", borderRadius: 8, background: `${c as string}15` }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: c as string }}>{v}</div>
                    <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1 }}>{l}</div>
                  </div>
                ))}
              </div>
              {/* Episodic */}
              <div style={{ fontSize: 9, letterSpacing: 1, color: C.muted, marginBottom: 6 }}>EPISODIC MEMORY — WHAT HAPPENED</div>
              {[
                { who: "MAYA", text: "built sun animation session 3 — responds to visual demos", delay: 700 },
                { who: "PRIYA", text: "mastered loops + functions — session 7 breakthrough", delay: 920 },
              ].map((m, i) => (
                <FadeIn key={i} delay={m.delay} from="left">
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", marginBottom: 6, fontSize: 11 }}>
                    <span style={{ fontWeight: 700, marginRight: 6 }}>{m.who}</span>
                    <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: `${C.purpleLight}15`, color: C.purpleLight }}>episodic</span>
                    <div style={{ color: "#ccc", marginTop: 4 }}>{m.text}</div>
                  </div>
                </FadeIn>
              ))}
              {/* Pattern */}
              <div style={{ fontSize: 9, letterSpacing: 1, color: C.muted, marginBottom: 6, marginTop: 10 }}>PATTERN MEMORY — WHAT WORKS</div>
              {[
                { who: "JORDAN", text: "learns 3x faster from live examples than text — always show first", tag: "pattern", tagColor: C.green, delay: 1140 },
                { who: "TYLER", text: "2 off-topic attempts this week — Shield pattern active", tag: "behavioral", tagColor: C.blue, delay: 1360 },
              ].map((m, i) => (
                <FadeIn key={i} delay={m.delay} from="left">
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", marginBottom: 6, fontSize: 11 }}>
                    <span style={{ fontWeight: 700, marginRight: 6 }}>{m.who}</span>
                    <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: `${m.tagColor}15`, color: m.tagColor }}>{m.tag}</span>
                    <div style={{ color: "#ccc", marginTop: 4 }}>{m.text}</div>
                  </div>
                </FadeIn>
              ))}
              {/* Semantic */}
              <div style={{ fontSize: 9, letterSpacing: 1, color: C.muted, marginBottom: 6, marginTop: 10 }}>SEMANTIC MEMORY — WHAT THEY KNOW</div>
              <FadeIn delay={1580} from="left">
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 11 }}>
                  <span style={{ fontWeight: 700, marginRight: 6 }}>ALL STUDENTS</span>
                  <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: `${C.amber}15`, color: C.amber }}>semantic</span>
                  <div style={{ color: "#ccc", marginTop: 4 }}>class avg: intermediate · visual learners · afternoon focus</div>
                </div>
              </FadeIn>
            </div>

            {/* COL 3 — Observability */}
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.green }}>Observability Layer</span>
                  <div style={{ fontSize: 11, color: C.muted }}>every agent decision traced</div>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: C.green }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "pulse 2s infinite" }} />
                  OBSERVING
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, marginTop: 10 }}>
                {[["4", "TRACES", C.green], ["3", "ALERTS", C.amber], ["1", "BLOCKED", C.blue]].map(([v, l, c]) => (
                  <div key={l} style={{ flex: 1, textAlign: "center", padding: "6px 0", borderRadius: 8, background: `${c as string}15` }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: c as string }}>{v}</div>
                    <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1 }}>{l}</div>
                  </div>
                ))}
              </div>
              {/* Traces */}
              <div style={{ fontSize: 9, letterSpacing: 1, color: C.muted, marginBottom: 6 }}>LIVE AGENT TRACES</div>
              {[
                { dot: C.green, agent: "Agent Vibe", to: "Maya", desc: "rain query", time: "1.2s", badge: "ok", badgeColor: C.green, delay: 200 },
                { dot: C.amber, agent: "Agent Sage", to: "Jordan", desc: "stuck alert", time: "18s", badge: "slow", badgeColor: C.amber, delay: 400 },
                { dot: C.purpleLight, agent: "Agent Vibe", to: "Priya", desc: "level up", time: "0.9s", badge: "ok", badgeColor: C.purpleLight, delay: 600 },
                { dot: C.blue, agent: "Agent Shield", to: "Tyler", desc: "blocked", time: "0.3s", badge: "safe", badgeColor: C.blue, delay: 800 },
              ].map((t, i) => (
                <FadeIn key={i} delay={t.delay} from="right">
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8,
                    border: `1px solid ${C.border}`, marginBottom: 5, fontSize: 11,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.dot, flexShrink: 0 }} />
                    <span style={{ color: "#ccc", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.agent} → {t.to} · {t.desc}
                    </span>
                    <span style={{ color: C.muted, fontSize: 10, flexShrink: 0 }}>{t.time}</span>
                    <span style={{
                      fontSize: 9, padding: "1px 6px", borderRadius: 4, background: `${t.badgeColor}15`, color: t.badgeColor, flexShrink: 0,
                    }}>{t.badge}</span>
                  </div>
                </FadeIn>
              ))}
              {/* Alerts */}
              <div style={{ fontSize: 9, letterSpacing: 1, color: C.muted, marginBottom: 6, marginTop: 12 }}>SMART ALERTS</div>
              {[
                { color: C.amber, text: "Jordan stuck 18min — Agent Sage switched to example-first teaching", time: "now", delay: 1900 },
                { color: C.blue, text: "Agent Shield blocked Tyler — COPPA log updated, parent notified", time: "2m", delay: 2150 },
                { color: C.green, text: "Priya breakthrough — memory stored, difficulty auto-raised", time: "4m", delay: 2400 },
              ].map((a, i) => (
                <FadeIn key={i} delay={a.delay} from="bottom">
                  <div style={{
                    display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 8,
                    border: `1px solid ${a.color}25`, marginBottom: 5, fontSize: 11, background: `${a.color}08`,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: a.color, flexShrink: 0, marginTop: 4 }} />
                    <span style={{ color: "#ccc", flex: 1 }}>{a.text}</span>
                    <span style={{ color: C.muted, fontSize: 10, flexShrink: 0 }}>{a.time}</span>
                  </div>
                </FadeIn>
              ))}
              {/* Bridge */}
              <div style={{ fontSize: 9, letterSpacing: 1, color: C.muted, marginBottom: 6, marginTop: 12 }}>MEMORY ↔ OBSERVABILITY BRIDGE</div>
              <FadeIn delay={2700} from="bottom">
                <div style={{
                  padding: "10px 12px", borderRadius: 8, background: `${C.purple}10`, border: `1px solid ${C.purple}25`,
                  fontSize: 11, color: "#ccc", lineHeight: 1.5,
                }}>
                  Every trace Mnemo observes → auto-extracted into memory for the next run. Jordan&apos;s 18min trace → pattern memory updated → Agent Sage now always shows examples first.
                </div>
              </FadeIn>
            </div>
          </div>
          {/* bottom stats bar */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 1,
            borderTop: `1px solid ${C.border}`, background: C.border,
          }}>
            {[
              [memCount, "MEMORIES STORED", C.purpleLight],
              [traceCount, "TRACES LOGGED", C.green],
              [alertCount, "ALERTS FIRED", C.amber],
              [protectCount, "STUDENTS PROTECTED", C.blue],
            ].map(([v, l, c]) => (
              <div key={l as string} style={{ background: C.card, padding: "12px 8px", textAlign: "center" }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: c as string }}>{v}</span>
                <span style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginLeft: 6 }}>{l as string}</span>
              </div>
            ))}
          </div>
        </div>
        <p style={{ textAlign: "center", fontSize: 13, color: C.muted, fontStyle: "italic", marginTop: 20, lineHeight: 1.6, maxWidth: 540, margin: "20px auto 0" }}>
          &ldquo;One teacher. 30 students. Every agent run visible. Every memory preserved. Every struggling student caught before they give up.&rdquo;
        </p>
      </section>

      {/* ═══ USED BY ═══ */}
      <section style={{ ...sectionStyle, textAlign: "center", padding: "48px 24px" }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 16 }}>POWERING AGENTS AT</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 40, alignItems: "center" }}>
          <span style={{ fontSize: 20, fontWeight: 600, opacity: 0.7 }}>MiniFounder.ai</span>
          <span style={{ fontSize: 16, color: C.muted }}>Your company →</span>
        </div>
      </section>

      {/* ═══ COMPARISON ═══ */}
      <section style={{ ...sectionStyle, padding: "64px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{ fontSize: 11, letterSpacing: 2, color: C.purpleLight, fontWeight: 600 }}>WHY MNEMO</span>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, marginTop: 8 }}>Memory + Observability. Nobody else has both.</h2>
          <p style={{ color: C.muted, fontSize: 15, marginTop: 8, maxWidth: 560, margin: "8px auto 0" }}>
            Mem0 gives you memory. Langfuse gives you traces. Mnemo gives you both — and makes them feed each other.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, background: C.card }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Every other tool today</h3>
            {[
              "Memory tools store — zero observability",
              "Observability tools log — zero memory",
              "Two tools, two integrations, zero connection",
              "TypeScript only or framework lock-in",
              "No compliance for healthcare or edtech",
              "Alerts don't know agent history",
            ].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10, fontSize: 13, color: "#aaa" }}>
                <span style={{ color: "#ef4444", flexShrink: 0 }}>&#10005;</span> {t}
              </div>
            ))}
          </div>
          <div style={{ border: `1px solid ${C.purple}40`, borderRadius: 12, padding: 24, background: `${C.purple}08` }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: C.purpleLight }}>Mnemo</h3>
            {[
              "Memory AND observability — one SDK, two lines",
              "Every trace auto-becomes a memory for next run",
              "Alerts learn what \"normal\" looks like over time",
              "Python first — any LLM, any framework",
              "HIPAA · FERPA · COPPA built in",
              "Failure patterns surface automatically",
            ].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10, fontSize: 13, color: "#d4d4d8" }}>
                <span style={{ color: C.green, flexShrink: 0 }}>&#10003;</span> {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section style={{ ...sectionStyle, padding: "64px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {[
            { icon: "\uD83E\uDDE0", title: "Persistent Memory", desc: "Episodic, semantic, and pattern memory across every run", color: C.purple },
            { icon: "\uD83D\uDCCA", title: "Full Observability", desc: "Every decision traced via Langfuse + OpenTelemetry", color: C.green },
            { icon: "\uD83D\uDD14", title: "Smart Alerts", desc: "Latency spikes, missing memories, error rates, custom rules", color: C.amber },
            { icon: "\uD83C\uDFE5", title: "Compliance Mode", desc: "HIPAA, FERPA, COPPA audit trails for regulated industries", color: "#ef4444" },
            { icon: "\uD83D\uDD0C", title: "Any LLM", desc: "Works with Claude, OpenAI, LangChain, or raw HTTP", color: C.blue },
            { icon: "\u26A1", title: "Two Lines of Code", desc: "Drop-in layer on top of whatever you already use", color: C.purpleLight },
          ].map(f => (
            <div key={f.title} style={{
              border: `1px solid ${f.title === "Two Lines of Code" ? `${C.purple}40` : C.border}`,
              borderRadius: 12, padding: 20, background: f.title === "Two Lines of Code" ? `${C.purple}08` : C.card,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" style={{ ...sectionStyle, padding: "64px 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, marginBottom: 32 }}>Pricing</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {[
            { name: "Open Source", price: "Free", period: "forever", key: "free", features: ["Python SDK", "Self-host dashboard", "Unlimited agents", "Community support"], cta: "Get Started", pop: false },
            { name: "Cloud Solo", price: "$29", period: "/mo", key: "solo", features: ["Hosted dashboard", "No server needed", "5 agents", "Email support"], cta: "Start Trial", pop: true },
            { name: "Cloud Teams", price: "$99", period: "/mo", key: "teams", features: ["Unlimited agents", "Pattern detection AI", "Team collaboration", "Priority support"], cta: "Start Trial", pop: false },
            { name: "Enterprise", price: "Custom", period: "", key: "enterprise", features: ["HIPAA/FERPA compliance", "SSO + audit trail", "Dedicated support", "Custom SLA"], cta: "Contact Sales", pop: false },
          ].map(plan => (
            <div key={plan.name} style={{
              border: `1px solid ${plan.pop ? C.purple : C.border}`, borderRadius: 12, padding: 24,
              background: C.card, position: "relative",
            }}>
              {plan.pop && (
                <div style={{
                  position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                  background: C.purple, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 10px",
                  borderRadius: 99, letterSpacing: 1,
                }}>MOST POPULAR</div>
              )}
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{plan.name}</div>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 32, fontWeight: 800 }}>{plan.price}</span>
                <span style={{ color: C.muted, fontSize: 14 }}>{plan.period}</span>
              </div>
              {plan.features.map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, color: C.muted }}>
                  <span style={{ color: C.green }}>&#10003;</span> {f}
                </div>
              ))}
              <button onClick={() => handlePlanSelect(plan.key)} style={{
                width: "100%", padding: "10px 0", borderRadius: 8, border: plan.pop ? "none" : `1px solid ${C.border}`,
                background: plan.pop ? C.purple : "transparent", color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: "pointer", marginTop: 12,
              }}>{plan.cta}</button>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section style={{ ...sectionStyle, padding: "64px 24px", textAlign: "center" }}>
        <div style={{ background: `${C.purple}10`, border: `1px solid ${C.purple}25`, borderRadius: 16, padding: "48px 24px" }}>
          <h2 style={{ fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 800, marginBottom: 12 }}>Your agents are thinking. Make them remember.</h2>
          <p style={{ color: C.muted, fontSize: 15, marginBottom: 24 }}>Free forever on open source. Cloud from $29/mo.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => handlePlanSelect("free")} style={{
              padding: "12px 24px", borderRadius: 8, background: C.purple, color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer",
            }}>Start Free at usemnemo.com</button>
            <div style={{
              padding: "12px 24px", borderRadius: 8, background: C.card, color: C.muted, fontSize: 14, fontFamily: "monospace",
              border: `1px solid ${C.border}`,
            }}>pip install mnemo-sdk[all]</div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "24px 0", textAlign: "center", fontSize: 13, color: C.muted }}>
        MIT License &middot; Built by{" "}
        <a href="https://github.com/DharmaDhillon" style={{ color: C.purpleLight, textDecoration: "none" }}>Dharma Dhillon</a>
        {" "}&middot; usemnemo.com &middot;{" "}
        <a href="https://github.com/DharmaDhillon/mnemo" style={{ color: C.purpleLight, textDecoration: "none" }}>github.com/DharmaDhillon/mnemo</a>
      </footer>

      {/* ═══ AUTH MODAL ═══ */}
      {authMode && (
        <div onClick={() => setAuthMode(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28,
            width: "100%", maxWidth: 400, margin: "0 16px",
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              {authMode === "signup" ? "Create your account" : "Welcome back"}
            </h3>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
              {pendingPlan && pendingPlan !== "free"
                ? `Sign in to continue to ${pendingPlan === "solo" ? "Solo $29/mo" : "Teams $99/mo"} checkout`
                : authMode === "signup" ? "Start giving your agents memory" : "Log in to your dashboard"}
            </p>
            <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {authMode === "signup" && (
                <input type="text" placeholder="Organization name" value={orgName} onChange={e => setOrgName(e.target.value)}
                  style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: "#fff", fontSize: 14, outline: "none" }} />
              )}
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
                style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: "#fff", fontSize: 14, outline: "none" }} />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: "#fff", fontSize: 14, outline: "none" }} />
              {error && <p style={{ fontSize: 13, color: "#ef4444" }}>{error}</p>}
              <button type="submit" disabled={loading} style={{
                padding: "10px 0", borderRadius: 8, background: C.purple, color: "#fff", border: "none",
                fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1,
              }}>{loading ? "Loading..." : authMode === "signup" ? "Create Account" : "Log In"}</button>
            </form>
            <p style={{ textAlign: "center", fontSize: 13, color: C.muted, marginTop: 16 }}>
              {authMode === "signup" ? (
                <>Already have an account? <button onClick={() => setAuthMode("login")} style={{ color: C.purpleLight, background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>Log in</button></>
              ) : (
                <>Don&apos;t have an account? <button onClick={() => setAuthMode("signup")} style={{ color: C.purpleLight, background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>Sign up</button></>
              )}
            </p>
          </div>
        </div>
      )}

      {/* pulse animation */}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
