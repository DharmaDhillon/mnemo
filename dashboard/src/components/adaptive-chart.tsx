"use client";

import { useState } from "react";

interface Run {
  created_at: string;
  analysis_status?: string | null;
}

interface ChartBar {
  label: string;
  runs: number;
  warnings: number;
  criticals: number;
}

type Granularity = "hourly" | "daily" | "monthly" | "all";

function fmtHour(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

function toLocal(utc: string): Date {
  return new Date(utc); // Date constructor auto-converts to local timezone
}

function buildChartData(runs: Run[], granularity: Granularity): {
  data: ChartBar[];
  title: string;
  summary: string;
} {
  if (!runs.length) return { data: [], title: "", summary: "" };

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzShort = new Date().toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ").pop() || tz;

  if (granularity === "hourly") {
    const buckets: ChartBar[] = [];
    for (let h = 0; h < 24; h++) {
      buckets.push({ label: fmtHour(h), runs: 0, warnings: 0, criticals: 0 });
    }
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    let count = 0;
    runs.forEach(r => {
      const local = toLocal(r.created_at);
      const localStr = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
      if (localStr === todayStr) {
        const h = local.getHours();
        buckets[h].runs++;
        if (r.analysis_status === "warning") buckets[h].warnings++;
        if (r.analysis_status === "critical") buckets[h].criticals++;
        count++;
      }
    });
    const peak = buckets.reduce((a, b) => (a.runs > b.runs ? a : b));
    return {
      data: buckets,
      title: `Today by hour (${tzShort})`,
      summary: count > 0 ? `${count} runs today \u00B7 peak: ${peak.label} (${peak.runs})` : "No runs today yet",
    };
  }

  if (granularity === "daily") {
    const buckets: Record<string, ChartBar> = {};
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      buckets[key] = { label: `${dayNames[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`, runs: 0, warnings: 0, criticals: 0 };
    }
    runs.forEach(r => {
      const local = toLocal(r.created_at);
      const key = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
      if (buckets[key]) {
        buckets[key].runs++;
        if (r.analysis_status === "warning") buckets[key].warnings++;
        if (r.analysis_status === "critical") buckets[key].criticals++;
      }
    });
    const data = Object.values(buckets);
    const total = data.reduce((s, d) => s + d.runs, 0);
    const peak = data.reduce((a, b) => (a.runs > b.runs ? a : b));
    return {
      data,
      title: `Daily (last 14 days, ${tzShort})`,
      summary: total > 0 ? `${total} runs \u00B7 busiest: ${peak.label} (${peak.runs})` : "No runs in period",
    };
  }

  if (granularity === "monthly") {
    const buckets: Record<string, ChartBar> = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = { label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`, runs: 0, warnings: 0, criticals: 0 };
    }
    runs.forEach(r => {
      const local = toLocal(r.created_at);
      const key = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}`;
      if (buckets[key]) {
        buckets[key].runs++;
        if (r.analysis_status === "warning") buckets[key].warnings++;
        if (r.analysis_status === "critical") buckets[key].criticals++;
      }
    });
    const data = Object.values(buckets);
    const total = data.reduce((s, d) => s + d.runs, 0);
    const peak = data.reduce((a, b) => (a.runs > b.runs ? a : b));
    return {
      data,
      title: "Monthly (last 12 months)",
      summary: total > 0 ? `${total} total runs \u00B7 peak: ${peak.label} (${peak.runs})` : "No runs",
    };
  }

  // All time — group by week
  const times = runs.map(r => toLocal(r.created_at).getTime());
  const earliest = Math.min(...times);
  const latest = Math.max(...times);
  const buckets: ChartBar[] = [];
  const weekStart = new Date(earliest);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  while (weekStart.getTime() <= latest + 7 * 86400000) {
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6); weekEnd.setHours(23, 59, 59, 999);
    const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    const bar: ChartBar = { label, runs: 0, warnings: 0, criticals: 0 };
    runs.forEach(r => {
      const t = toLocal(r.created_at).getTime();
      if (t >= weekStart.getTime() && t <= weekEnd.getTime()) {
        bar.runs++;
        if (r.analysis_status === "warning") bar.warnings++;
        if (r.analysis_status === "critical") bar.criticals++;
      }
    });
    buckets.push(bar);
    weekStart.setDate(weekStart.getDate() + 7);
    if (buckets.length >= 26) break;
  }
  const total = buckets.reduce((s, d) => s + d.runs, 0);
  const peak = buckets.length > 0 ? buckets.reduce((a, b) => (a.runs > b.runs ? a : b)) : { label: "", runs: 0 };
  return {
    data: buckets,
    title: "All time (weekly)",
    summary: total > 0 ? `${total} total runs \u00B7 peak week: ${peak.label} (${peak.runs})` : "No runs",
  };
}

export default function AdaptiveChart({ runs }: { runs: Run[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("hourly");

  const { data, title, summary } = buildChartData(runs, granularity);

  if (runs.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.runs), 1);

  function barColor(bar: ChartBar): string {
    if (bar.criticals > 0) return "#E24B4A";
    if (bar.warnings > 0) return "#EF9F27";
    return "#7C3AED";
  }

  function tooltipText(bar: ChartBar): string {
    const parts = [`${bar.runs} run${bar.runs !== 1 ? "s" : ""}`];
    if (bar.warnings > 0) parts.push(`${bar.warnings} warn`);
    if (bar.criticals > 0) parts.push(`${bar.criticals} crit`);
    if (bar.warnings === 0 && bar.criticals === 0 && bar.runs > 0) parts.push("all clear");
    return `${bar.label} \u2014 ${parts.join(" \u00B7 ")}`;
  }

  const tabs: { key: Granularity; label: string }[] = [
    { key: "hourly", label: "Hourly" },
    { key: "daily", label: "Daily" },
    { key: "monthly", label: "Monthly" },
    { key: "all", label: "All Time" },
  ];

  return (
    <div className="rounded-lg border border-[var(--border)] p-3" style={{ maxHeight: 155 }}>
      {/* Header: title + filter tabs + tooltip */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--muted-foreground)]">{title}</span>
          <div className="flex gap-[2px] ml-2">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setGranularity(t.key)}
                style={{
                  fontSize: 9,
                  padding: "1px 6px",
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  background: granularity === t.key ? "#7C3AED" : "rgba(255,255,255,0.06)",
                  color: granularity === t.key ? "#fff" : "#a1a1aa",
                  transition: "all 0.15s",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {hoveredIdx !== null && data[hoveredIdx] && (
          <span className="text-[10px] text-[var(--foreground)] font-medium">{tooltipText(data[hoveredIdx])}</span>
        )}
      </div>

      {/* Bars */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
        {data.map((bar, i) => {
          const barH = bar.runs > 0 ? Math.max(4, (bar.runs / maxVal) * 80) : 1;
          return (
            <div
              key={i}
              style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", cursor: "pointer" }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div
                style={{
                  width: "100%",
                  height: barH,
                  backgroundColor: bar.runs > 0 ? barColor(bar) : "rgba(255,255,255,0.05)",
                  borderRadius: "3px 3px 0 0",
                  opacity: hoveredIdx === null || hoveredIdx === i ? 1 : 0.4,
                  transition: "opacity 0.15s",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex mt-[2px]">
        {data.map((bar, i) => {
          const showLabel = data.length <= 14 || i % Math.ceil(data.length / 12) === 0;
          return (
            <div key={i} className="flex-1 text-center">
              {showLabel && <span className="text-[7px] text-[var(--muted-foreground)]">{bar.label}</span>}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="text-[9px] text-[var(--muted-foreground)] mt-1">{summary}</div>
    </div>
  );
}
