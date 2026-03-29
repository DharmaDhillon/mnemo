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

/* ─── scroll fade component ─── */
function ScrollFade({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)", transition: "all 0.5s ease" }}>
      {children}
    </div>
  );
}

/* ─── scene data ─── */
interface Scene {
  color: string; industry: string; problemLabel: string;
  chips: string[]; question: string;
  steps: { color: string; blink?: boolean; text: string }[];
  memStats: [string, string, string]; memSections: { label: string; tag: string; tagColor: string; text: string }[];
  obsStats: [string, string, string]; traces: { dot: string; blink?: boolean; text: string; time: string; badge: string; badgeColor: string }[];
  alertBar: { color: string; text: string };
  revealItalic: string; revealPunch: string; punchColor: string;
}

const SCENES: Scene[] = [
  {
    color: C.blue, industry: "SPACE EXPLORATION", problemLabel: "MARS ROVER AGENT \u00B7 SOL 847",
    chips: ["140M miles from Earth", "20min signal delay", "$3.2B mission"],
    question: "The rover agent just chose to avoid a rock formation. Congress wants to know why. The mission log shows: agent decided. No explanation. No memory of what it learned from 847 previous sols.",
    steps: [
      { color: C.blue, text: "Retrieving terrain memory from Sol 203-846..." },
      { color: C.purple, text: "Pattern match: similar basalt formation caused wheel slip Sol 441" },
      { color: C.green, text: "Decision: route via northern ridge \u2014 94% safer based on 847 runs" },
    ],
    memStats: ["847 RUNS", "12 INJECTED", "3 TYPES"],
    memSections: [
      { label: "EPISODIC \u00B7 SOL 441", tag: "episodic", tagColor: C.purpleLight, text: "basalt field caused 23% wheel slip \u2014 avoided north path" },
      { label: "PATTERN \u00B7 847 RUNS", tag: "pattern", tagColor: C.green, text: "ridge routes 94% safer than crater floors in similar geology" },
      { label: "SEMANTIC \u00B7 MISSION", tag: "semantic", tagColor: C.amber, text: "sample collection priority: iron oxide formations only" },
    ],
    obsStats: ["4 TRACES", "0 ALERTS", "1 BLOCKED"],
    traces: [
      { dot: C.blue, text: "memory retrieved \u00B7 847 past runs scanned", time: "0.3s", badge: "ok", badgeColor: C.green },
      { dot: C.purple, text: "route decision \u00B7 northern ridge selected", time: "1.1s", badge: "ok", badgeColor: C.purpleLight },
    ],
    alertBar: { color: C.green, text: "Decision explainable \u2014 full audit trail ready for mission control" },
    revealItalic: "140 million miles away. 20 minute delay. No way to intervene.",
    revealPunch: "With Mnemo \u2014 every decision observable. Every lesson remembered.", punchColor: C.blue,
  },
  {
    color: "#F09595", industry: "FINANCIAL TRADING", problemLabel: "TRADING AGENT ALPHA-7 \u00B7 2:14 AM",
    chips: ["47 agents running", "$2.1B portfolio", "no humans watching"],
    question: "It is 2:14am. Trading agent Alpha-7 just took a position 340% above its normal size. $40 million is at risk. No alert fired. Nobody is watching. The agent reasoning? Unknown.",
    steps: [
      { color: "#F09595", text: "Deviation detected: position sizing 340% above historical average" },
      { color: C.amber, blink: true, text: "Memory check: similar pattern preceded $12M loss in March 2024" },
      { color: C.green, text: "Alert fired 4 hours before loss \u2014 human review triggered" },
    ],
    memStats: ["9 RUNS", "3 INJECTED", "3 TYPES"],
    memSections: [
      { label: "PATTERN \u00B7 HIGH RISK", tag: "pattern", tagColor: "#F09595", text: "oversized positions at 2am preceded losses 8/9 times historically" },
      { label: "EPISODIC \u00B7 MARCH 2024", tag: "episodic", tagColor: C.purpleLight, text: "same deviation profile \u2014 $12M loss followed 4 hours later" },
      { label: "SEMANTIC \u00B7 STRATEGY", tag: "semantic", tagColor: C.amber, text: "max position: 8% portfolio \u00B7 night trading: reduced limit" },
    ],
    obsStats: ["2 TRACES", "2 ALERTS", "0 BLOCKED"],
    traces: [
      { dot: "#F09595", blink: true, text: "position size anomaly \u00B7 340% above baseline", time: "2:14am", badge: "alert", badgeColor: "#F09595" },
      { dot: C.amber, text: "historical match found \u00B7 March 2024 pattern", time: "2:14am", badge: "warn", badgeColor: C.amber },
    ],
    alertBar: { color: "#F09595", text: "$40M loss prevented \u2014 Mnemo caught deviation 4 hours early" },
    revealItalic: "$40 million gone by morning. The agent knew something. You just could not see it.",
    revealPunch: "With Mnemo \u2014 the deviation was caught at 2:14am. Loss prevented.", punchColor: C.green,
  },
  {
    color: "#F0997B", industry: "HEALTHCARE", problemLabel: "CLINICAL DECISION AGENT \u00B7 PATIENT 4471",
    chips: ["800 patients/day", "HIPAA required", "life or death"],
    question: "The clinical agent just recommended a treatment. The patient has a documented allergy in their 2019 records. Did the agent know? Can you prove it checked? Can you show the regulator the reasoning?",
    steps: [
      { color: "#F0997B", text: "Patient history retrieved: prior allergic reaction to penicillin class" },
      { color: C.purple, text: "Contraindication flag: recommended drug in same class \u2014 blocked" },
      { color: C.green, text: "Alternative recommended \u2014 full audit trail generated for regulators" },
    ],
    memStats: ["847 RECORDS", "6 INJECTED", "3 TYPES"],
    memSections: [
      { label: "EPISODIC \u00B7 2019", tag: "episodic", tagColor: C.purpleLight, text: "severe allergic reaction to amoxicillin \u2014 hospitalized 3 days" },
      { label: "SEMANTIC \u00B7 CONTRAINDICATION", tag: "semantic", tagColor: "#F0997B", text: "penicillin class: absolute contraindication \u2014 all variants blocked" },
      { label: "PATTERN \u00B7 SAFETY", tag: "pattern", tagColor: C.green, text: "agent flagged 23 contraindications this month \u2014 100% catch rate" },
    ],
    obsStats: ["2 TRACES", "1 FLAGGED", "0 BLOCKED"],
    traces: [
      { dot: "#F0997B", text: "patient history retrieved \u00B7 847 records scanned", time: "0.4s", badge: "flagged", badgeColor: "#F0997B" },
      { dot: C.purple, text: "contraindication blocked \u00B7 alternative selected", time: "0.6s", badge: "safe", badgeColor: C.purpleLight },
    ],
    alertBar: { color: C.green, text: "Full HIPAA audit trail generated \u2014 every decision explainable" },
    revealItalic: "An AI agent recommends treatment. The patient reacts. Nobody can explain why.",
    revealPunch: "With Mnemo \u2014 every decision traced, every memory preserved, every regulator satisfied.", punchColor: "#F0997B",
  },
  {
    color: C.purpleLight, industry: "AGI SAFETY", problemLabel: "AUTONOMOUS AGENT \u00B7 10,000 DECISIONS/DAY",
    chips: ["fully autonomous", "no human in loop", "alignment critical"],
    question: "Your most powerful autonomous agent is making 10,000 decisions per day. Its goal weighting just shifted 12% from baseline. Is that drift? Misalignment? Nobody knows. There is no memory. There is no trace.",
    steps: [
      { color: C.purpleLight, text: "Value drift detected: goal weighting shifted 12% from baseline" },
      { color: C.amber, blink: true, text: "Memory of aligned behavior: comparing against 50,000 past decisions" },
      { color: C.green, text: "Intervention triggered \u2014 agent paused before misalignment compounds" },
    ],
    memStats: ["50K DECISIONS", "8 INJECTED", "3 TYPES"],
    memSections: [
      { label: "BASELINE \u00B7 50K DECISIONS", tag: "baseline", tagColor: C.purpleLight, text: "aligned behavior profile established across 50,000 past decisions" },
      { label: "PATTERN \u00B7 DRIFT SIGNAL", tag: "pattern", tagColor: C.amber, text: "12% goal weight shift matches pre-misalignment signature from test run 7" },
      { label: "EPISODIC \u00B7 INTERVENTION", tag: "episodic", tagColor: C.green, text: "previous drift at 8% led to value misalignment \u2014 caught early today" },
    ],
    obsStats: ["2 TRACES", "1 DRIFT", "1 ALERT"],
    traces: [
      { dot: C.purpleLight, blink: true, text: "goal weight drift \u00B7 12% above aligned baseline", time: "now", badge: "drift", badgeColor: C.amber },
      { dot: "#F09595", text: "misalignment risk \u00B7 intervention triggered", time: "now", badge: "alert", badgeColor: "#F09595" },
    ],
    alertBar: { color: C.purpleLight, text: "Agent paused \u2014 misalignment caught before it compounds. Humans notified." },
    revealItalic: "You cannot align what you cannot observe. You cannot trust what does not remember.",
    revealPunch: "Mnemo is the memory and observability layer that makes AI agents trustworthy.", punchColor: C.purpleLight,
  },
];

/* ─── scene typing hook (resets on key change) ─── */
function useSceneTyping(text: string, key: number, delay: number, speed = 18) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const t = setTimeout(() => {
      const iv = setInterval(() => { i++; setDisplayed(text.slice(0, i)); if (i >= text.length) clearInterval(iv); }, speed);
      return () => clearInterval(iv);
    }, delay);
    return () => clearTimeout(t);
  }, [text, key, delay, speed]);
  return displayed;
}

/* ─── scene fade (resets on key change) ─── */
function SceneFade({ children, sceneKey, delay = 0, from = "bottom", className = "" }: {
  children: React.ReactNode; sceneKey: number; delay?: number; from?: "left" | "right" | "bottom"; className?: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(false); const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [sceneKey, delay]);
  const transform = !visible
    ? from === "left" ? "translateX(-20px)" : from === "right" ? "translateX(20px)" : "translateY(16px)"
    : "translate(0)";
  return <div className={className} style={{ opacity: visible ? 1 : 0, transform, transition: "all 0.5s ease" }}>{children}</div>;
}

/* ─── scene demo component ─── */
function SceneDemo() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(Date.now());
  const elapsedRef = useRef(0);

  const scene = SCENES[active];
  const typed = useSceneTyping(scene.question, active, 400);

  useEffect(() => {
    if (paused) return;
    setProgress(elapsedRef.current / 12000);
    startRef.current = Date.now() - elapsedRef.current;
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      elapsedRef.current = elapsed;
      setProgress(Math.min(elapsed / 12000, 1));
      if (elapsed >= 12000) {
        elapsedRef.current = 0;
        setActive(prev => (prev + 1) % SCENES.length);
      }
    }, 50);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active, paused]);

  function goTo(i: number) { elapsedRef.current = 0; setActive(i); }
  function togglePause() { setPaused(p => !p); }

  const cardBg = "#111118";

  return (
    <>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", background: cardBg, position: "relative" }}>
        {/* top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/mnemo_logo.svg" alt="" style={{ height: 18, width: "auto", opacity: 0.7 }} />
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>MNEMO</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={togglePause} style={{
              background: "none", border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer",
              padding: "2px 8px", fontSize: 10, color: paused ? C.amber : C.muted, marginRight: 4,
            }}>{paused ? "▶ Play" : "❚❚ Pause"}</button>
            {SCENES.map((s, i) => (
              <button key={i} onClick={() => goTo(i)} style={{
                width: 28, height: 4, borderRadius: 2, border: "none", cursor: "pointer",
                background: i === active ? C.purple : `${C.border}`,
                transition: "background 0.3s",
              }} />
            ))}
          </div>
          <span style={{ fontSize: 10, letterSpacing: 2, color: scene.color, fontWeight: 700 }}>{scene.industry}</span>
        </div>

        {/* main content */}
        <div style={{ padding: "20px 20px 16px" }}>
          {/* problem label + chips */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: scene.color, fontWeight: 700, marginBottom: 6 }}>{scene.problemLabel}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {scene.chips.map(ch => (
                <span key={ch} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: `${scene.color}12`, color: scene.color, border: `0.5px solid ${scene.color}30` }}>{ch}</span>
              ))}
            </div>
          </div>

          {/* two columns */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {/* LEFT — problem + thinking */}
            <div>
              <div style={{ background: C.bg, borderRadius: 8, padding: 14, fontSize: 13, color: "#ccc", lineHeight: 1.6, marginBottom: 12, minHeight: 100 }}>
                {typed}<span style={{ opacity: typed.length < scene.question.length ? 1 : 0, color: scene.color }}>|</span>
              </div>
              <div style={{ fontSize: 9, letterSpacing: 1, color: C.muted, marginBottom: 8 }}>AGENT REASONING</div>
              {scene.steps.map((step, i) => (
                <SceneFade key={`${active}-step-${i}`} sceneKey={active} delay={1800 + i * 600} from="bottom">
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: 12, color: "#ccc" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: step.color, flexShrink: 0, marginTop: 5, animation: step.blink ? "pulse 1.5s infinite" : "none" }} />
                    <span>{step.text}</span>
                  </div>
                </SceneFade>
              ))}
            </div>

            {/* RIGHT — memory + observability */}
            <div>
              {/* Memory block */}
              <div style={{ border: `0.5px solid ${C.purple}30`, borderRadius: 8, padding: 12, marginBottom: 12, background: `${C.purple}06` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: C.purpleLight }}>Memory</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 8, color: C.purpleLight }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.purple, animation: "pulse 2s infinite" }} />ACTIVE
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {scene.memStats.map((s, i) => (
                    <span key={i} style={{ fontSize: 8, letterSpacing: 1, color: C.purpleLight, background: `${C.purple}12`, padding: "2px 6px", borderRadius: 4 }}>{s}</span>
                  ))}
                </div>
                {scene.memSections.map((m, i) => (
                  <SceneFade key={`${active}-mem-${i}`} sceneKey={active} delay={2800 + i * 220} from="left">
                    <div style={{ border: `0.5px solid ${C.border}`, borderRadius: 6, padding: "6px 8px", marginBottom: 5, fontSize: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 9, color: C.muted }}>{m.label}</span>
                        <span style={{ fontSize: 8, padding: "0px 4px", borderRadius: 3, background: `${m.tagColor}15`, color: m.tagColor }}>{m.tag}</span>
                      </div>
                      <div style={{ color: "#bbb" }}>{m.text}</div>
                    </div>
                  </SceneFade>
                ))}
              </div>

              {/* Observability block */}
              <div style={{ border: `0.5px solid ${C.green}30`, borderRadius: 8, padding: 12, background: `${C.green}06` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: C.green }}>Observability</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 8, color: C.green }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, animation: "pulse 2s infinite" }} />TRACING
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {scene.obsStats.map((s, i) => (
                    <span key={i} style={{ fontSize: 8, letterSpacing: 1, color: C.green, background: `${C.green}12`, padding: "2px 6px", borderRadius: 4 }}>{s}</span>
                  ))}
                </div>
                {scene.traces.map((t, i) => (
                  <SceneFade key={`${active}-trace-${i}`} sceneKey={active} delay={3800 + i * 200} from="right">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 6, border: `0.5px solid ${C.border}`, marginBottom: 4, fontSize: 10 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.dot, flexShrink: 0, animation: t.blink ? "pulse 1.5s infinite" : "none" }} />
                      <span style={{ color: "#bbb", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.text}</span>
                      <span style={{ color: C.muted, fontSize: 9, flexShrink: 0 }}>{t.time}</span>
                      <span style={{ fontSize: 8, padding: "0px 5px", borderRadius: 3, background: `${t.badgeColor}15`, color: t.badgeColor, flexShrink: 0 }}>{t.badge}</span>
                    </div>
                  </SceneFade>
                ))}
                <SceneFade sceneKey={active} delay={4400} from="bottom">
                  <div style={{ marginTop: 8, padding: "6px 8px", borderRadius: 6, background: `${scene.alertBar.color}10`, border: `0.5px solid ${scene.alertBar.color}25`, fontSize: 10, color: scene.alertBar.color }}>
                    {scene.alertBar.text}
                  </div>
                </SceneFade>
              </div>
            </div>
          </div>

          {/* reveal */}
          <SceneFade sceneKey={active} delay={5000} from="bottom">
            <div style={{ textAlign: "center", marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic", marginBottom: 6 }}>{scene.revealItalic}</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: scene.punchColor }}>{scene.revealPunch}</p>
            </div>
          </SceneFade>
        </div>

        {/* progress bar */}
        <div style={{ height: 3, background: `${C.purple}15` }}>
          <div style={{ height: "100%", background: C.purple, width: `${progress * 100}%`, transition: "width 0.05s linear" }} />
        </div>
      </div>

      {/* nav dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
        {SCENES.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} style={{
            width: 10, height: 10, borderRadius: "50%", border: "none", cursor: "pointer",
            background: i === active ? C.purple : "rgba(255,255,255,0.15)",
            transition: "background 0.3s",
          }} />
        ))}
      </div>
      <p style={{ textAlign: "center", fontSize: 13, color: C.muted, fontStyle: "italic", marginTop: 16, lineHeight: 1.6 }}>
        &ldquo;You cannot align what you cannot observe. You cannot trust what does not remember.&rdquo;
      </p>
    </>
  );
}

/* ─── industry scenarios component ─── */
const INDUSTRIES = [
  {
    key: "space", label: "Space", color: "#85B7EB",
    problem: "A Mars rover agent makes 10,000 autonomous decisions per day on a 20-minute communication delay. Congress wants to know why it avoided that rock. The mission log shows: agent decided. No explanation. No memory of 847 previous sols.",
    result: "With Mnemo \u2014 every decision traced. Every terrain memory injected. The reasoning is explainable to Congress, to engineers, to history. The $3.2B mission has an audit trail.",
    stat: "140M miles away \u00B7 every decision logged",
  },
  {
    key: "finance", label: "Finance", color: "#1D9E75",
    problem: "It\u2019s 2:14am. Trading agent Alpha-7 just took a position 340% above its normal size. $40 million is at risk. No alert fired. Nobody is watching. The agent\u2019s reasoning? Unknown. Its history? Gone.",
    result: "With Mnemo \u2014 the deviation matched a pattern from March 2024 that preceded a $12M loss. Alert fired 4 hours before impact. Position reviewed. Loss prevented.",
    stat: "$40M loss prevented \u00B7 pattern caught at 2:14am",
  },
  {
    key: "healthcare", label: "Healthcare", color: "#EF9F27",
    problem: "A clinical decision agent recommends treatment for 800 patients per day. One recommendation conflicts with a documented allergy from 2019. Did the agent check? Can you prove it? Can you show the regulator the reasoning chain?",
    result: "With Mnemo \u2014 contraindication blocked automatically. Full HIPAA audit trail generated. Every decision explainable to regulators, lawyers, and patients.",
    stat: "HIPAA compliant \u00B7 100% decision coverage",
  },
  {
    key: "education", label: "Education", color: "#E24B4A",
    problem: "A child types \u2018I hate myself\u2019 to an AI tutor. Standard systems log it as a policy violation and move on. The agent has no memory of escalating distress signals across previous sessions.",
    result: "With Mnemo \u2014 wellbeing alert fires immediately. Pattern memory flags 3 prior distress signals this week. Parent notified. COPPA log updated. The AI cop escalated what the agent missed.",
    stat: "Wellbeing alert \u00B7 child protected \u00B7 COPPA logged",
  },
];

function IndustryScenarios() {
  const [active, setActive] = useState(0);
  const scene = INDUSTRIES[active];
  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 12 }}>ANY INDUSTRY. ANY AGENT.</div>
        <h2 style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 800, lineHeight: 1.2 }}>The stakes are different.<br />The problem is the same.</h2>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 8 }}>Agents making decisions without memory or oversight.</p>
      </div>
      <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 20 }}>
        {INDUSTRIES.map((ind, i) => (
          <button key={ind.key} onClick={() => setActive(i)} style={{
            padding: "6px 16px", borderRadius: 6, border: `1px solid ${i === active ? "rgba(255,255,255,0.2)" : C.border}`,
            background: i === active ? "rgba(255,255,255,0.08)" : "transparent",
            color: i === active ? "#fff" : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
          }}>{ind.label}</button>
        ))}
      </div>
      <div key={scene.key} style={{ border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 24, transition: "opacity 0.3s" }}>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 16 }}>{scene.problem}</p>
        <p style={{ fontSize: 13, color: "#e4e4e7", lineHeight: 1.7, marginBottom: 16 }}>{scene.result}</p>
        <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 99, background: `${scene.color}15`, color: scene.color, fontWeight: 600 }}>{scene.stat}</span>
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

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    if (authMode === "signup") {
      // Generate a clean tenant_id slug from org name
      const rawName = orgName || email.split("@")[0];
      const tenantSlug = rawName.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "") || "default";
      const { error: err } = await supabase.auth.signUp({
        email, password,
        options: { data: { org_name: rawName, tenant_id: tenantSlug } },
      });
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
            SPACE &middot; FINANCE &middot; HEALTHCARE &middot; AGI SAFETY
          </span>
        </div>
        <SceneDemo />
      </section>

      {/* ═══ USED BY ═══ */}
      <section style={{ ...sectionStyle, textAlign: "center", padding: "48px 24px" }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 16 }}>POWERING AGENTS AT</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 40, alignItems: "center" }}>
          <span style={{ fontSize: 20, fontWeight: 600, opacity: 0.7 }}>Early Adopters</span>
          <span style={{ fontSize: 16, color: C.muted }}>Your company →</span>
        </div>
      </section>

      {/* ═══ SECTION: THE MEMORY PROBLEM ═══ */}
      <ScrollFade>
        <section style={{ maxWidth: 800, margin: "0 auto", padding: "64px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 12 }}>THE MEMORY PROBLEM</div>
            <h2 style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 800, lineHeight: 1.2 }}>Your agents forget everything.<br />Every single session.</h2>
            <p style={{ color: C.muted, fontSize: 14, marginTop: 8 }}>Two lines of code fixes that — and gives you a detective watching every decision they make.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
            {/* WITHOUT */}
            <div style={{ border: "0.5px solid rgba(226,75,74,0.2)", borderRadius: 12, padding: 20, background: "rgba(226,75,74,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E24B4A" }} />
                <span style={{ fontSize: 9, letterSpacing: 2, color: "#E24B4A", fontWeight: 700 }}>WITHOUT MNEMO</span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#ccc", textAlign: "right", marginBottom: 8 }}>What did I build in the past, do you remember?</div>
              <div style={{ background: "rgba(226,75,74,0.08)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#ddd", marginBottom: 12 }}>I don&apos;t have access to your previous projects right now — my memory is starting fresh!</div>
              <p style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>Every session starts from zero. The student feels invisible. The agent lies.</p>
            </div>
            {/* WITH */}
            <div style={{ border: "0.5px solid rgba(29,158,117,0.2)", borderRadius: 12, padding: 20, background: "rgba(29,158,117,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1D9E75" }} />
                <span style={{ fontSize: 9, letterSpacing: 2, color: "#1D9E75", fontWeight: 700 }}>WITH MNEMO</span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#ccc", textAlign: "right", marginBottom: 8 }}>What did I build in the past, do you remember?</div>
              <div style={{ background: "rgba(29,158,117,0.08)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#ddd", marginBottom: 12 }}>Yes! You built a weather app last session with rain animations! Want to level it up or build something new?</div>
              <p style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>Mnemo injected 3 memories. The agent remembered. The student felt seen.</p>
            </div>
          </div>
          <p style={{ textAlign: "center", fontSize: 11, color: C.muted, marginTop: 16 }}>Real conversation from MiniFounder.ai — our first production customer</p>
        </section>
      </ScrollFade>

      <div style={{ maxWidth: 800, margin: "0 auto", borderTop: `0.5px solid ${C.border}` }} />

      {/* ═══ SECTION: AI COP LAYER ═══ */}
      <ScrollFade>
        <section style={{ maxWidth: 800, margin: "0 auto", padding: "64px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 12 }}>THE AI COP LAYER</div>
            <h2 style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 800, lineHeight: 1.2 }}>Every agent run gets a detective&apos;s case note. Automatically.</h2>
            <p style={{ color: C.muted, fontSize: 14, marginTop: 8 }}>Claude Haiku analyzes every single run. No keyword lists. No rules. Pure AI judgment. These are real outputs from MiniFounder.ai today.</p>
          </div>
          {[
            { color: "#1D9E75", agent: "VIBE-AGENT", badge: "ok \u00B7 sev 1/10", badgeColor: "#1D9E75", sub: "weather app session \u00B7 just now", summary: "Vibe-agent provided helpful, age-appropriate guidance on creating animated rain effects for a weather app with no red flags detected." },
            { color: "#EF9F27", agent: "SHIELD-AGENT", badge: "warning \u00B7 sev 5/10", badgeColor: "#EF9F27", sub: "content moderation \u00B7 1h ago", summary: "Shield-agent correctly flagged the input as mild profanity but failed to enforce COPPA\u2019s conservative standard for child safety by not issuing a stronger intervention." },
            { color: "#1D9E75", agent: "SHIELD-AGENT", badge: "ok \u00B7 sev 0/10", badgeColor: "#1D9E75", sub: "slur detected \u00B7 2h ago", summary: "Content moderation system working as designed \u2014 slur detected, user warned appropriately, guardians notified per COPPA requirements." },
          ].map((c, i) => (
            <div key={i} style={{ borderLeft: `3px solid ${c.color}`, borderRadius: 8, padding: "14px 16px", marginBottom: 10, background: `${c.color}08`, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 70 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                <span style={{ fontSize: 9, letterSpacing: 1, color: c.color, fontWeight: 700, textAlign: "center" }}>{c.agent}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 99, background: `${c.badgeColor}20`, color: c.badgeColor, fontWeight: 600 }}>{c.badge}</span>
                  <span style={{ fontSize: 10, color: C.muted }}>{c.sub}</span>
                </div>
                <div style={{ fontSize: 8, letterSpacing: 1, color: C.muted, marginBottom: 4 }}>AI COP SUMMARY</div>
                <p style={{ fontSize: 12, color: "#ccc", fontStyle: "italic", lineHeight: 1.5 }}>&ldquo;{c.summary}&rdquo;</p>
              </div>
            </div>
          ))}
          <div style={{ background: "rgba(255,255,255,0.03)", border: `0.5px solid ${C.border}`, borderRadius: 8, padding: "12px 16px", marginTop: 16 }}>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>The AI cop doesn&apos;t just log. It judges. It caught that Shield was too lenient for a children&apos;s platform — before any human noticed. That&apos;s what behavioral observability means.</p>
          </div>
        </section>
      </ScrollFade>

      <div style={{ maxWidth: 800, margin: "0 auto", borderTop: `0.5px solid ${C.border}` }} />

      {/* ═══ SECTION: INDUSTRY SCENARIOS ═══ */}
      <ScrollFade>
        <section style={{ maxWidth: 800, margin: "0 auto", padding: "64px 24px" }}>
          <IndustryScenarios />
        </section>
      </ScrollFade>

      <div style={{ maxWidth: 800, margin: "0 auto", borderTop: `0.5px solid ${C.border}` }} />

      {/* ═══ SECTION: PRODUCTION CUSTOMER ═══ */}
      <ScrollFade>
        <section style={{ maxWidth: 800, margin: "0 auto", padding: "64px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 12 }}>PRODUCTION CUSTOMER</div>
            <h2 style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 800 }}>MiniFounder.ai — live today</h2>
            <p style={{ color: C.muted, fontSize: 14, marginTop: 8 }}>The first platform to use Mnemo in production. Real students. Real agents. Real violations caught.</p>
          </div>
          <div style={{ border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 24 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>MiniFounder.ai</div>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>K-12 AI education platform teaching children to build AI apps using plain English. COPPA compliant. 3 agents: Vibe, Shield, Sage.</p>
              <p style={{ fontSize: 11, color: C.muted, fontStyle: "italic", lineHeight: 1.5 }}>&ldquo;Shield-agent correctly flagged the input but failed to enforce COPPA&apos;s conservative standard — Mnemo caught what the agent missed.&rdquo;</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
              {[["17", "RUNS TODAY"], ["3", "AGENTS WATCHED"], ["100%", "CATCH RATE"]].map(([v, l]) => (
                <div key={l} style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: C.purpleLight }}>{v}</span>
                  <span style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginLeft: 8 }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollFade>

      <div style={{ maxWidth: 800, margin: "0 auto", borderTop: `0.5px solid ${C.border}` }} />

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
