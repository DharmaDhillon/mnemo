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

function buildChartData(runs: Run[]): {
  data: ChartBar[];
  title: string;
  summary: string;
} {
  if (!runs.length) return { data: [], title: "", summary: "" };

  const times = runs.map(r => new Date(r.created_at).getTime());
  const earliest = Math.min(...times);
  const latest = Math.max(...times);
  const spanHours = (latest - earliest) / (1000 * 60 * 60);

  if (spanHours < 48) {
    // Group by hour — show today
    const buckets: ChartBar[] = [];
    for (let h = 0; h < 24; h++) {
      buckets.push({
        label: h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`,
        runs: 0, warnings: 0, criticals: 0,
      });
    }
    runs.forEach(r => {
      const h = new Date(r.created_at).getHours();
      buckets[h].runs++;
      if (r.analysis_status === "warning") buckets[h].warnings++;
      if (r.analysis_status === "critical") buckets[h].criticals++;
    });
    const peak = buckets.reduce((a, b) => (a.runs > b.runs ? a : b));
    return {
      data: buckets,
      title: "Runs today by hour",
      summary: peak.runs > 0 ? `${runs.length} runs today \u00B7 peak: ${peak.label} (${peak.runs} runs)` : "No runs today yet",
    };
  }

  if (spanHours < 7 * 24) {
    // Group by day — show last 7 days
    const buckets: Record<string, ChartBar> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      buckets[key] = { label: dayNames[d.getDay()], runs: 0, warnings: 0, criticals: 0 };
    }
    runs.forEach(r => {
      const key = r.created_at.slice(0, 10);
      if (buckets[key]) {
        buckets[key].runs++;
        if (r.analysis_status === "warning") buckets[key].warnings++;
        if (r.analysis_status === "critical") buckets[key].criticals++;
      }
    });
    const data = Object.values(buckets);
    const peak = data.reduce((a, b) => (a.runs > b.runs ? a : b));
    return {
      data,
      title: "Runs per day (7d)",
      summary: peak.runs > 0 ? `${runs.length} runs this week \u00B7 busiest: ${peak.label} (${peak.runs} runs)` : "No runs this week",
    };
  }

  if (spanHours < 30 * 24) {
    // Group by day — show last 14 days
    const buckets: Record<string, ChartBar> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { label: `${d.getMonth() + 1}/${d.getDate()}`, runs: 0, warnings: 0, criticals: 0 };
    }
    runs.forEach(r => {
      const key = r.created_at.slice(0, 10);
      if (buckets[key]) {
        buckets[key].runs++;
        if (r.analysis_status === "warning") buckets[key].warnings++;
        if (r.analysis_status === "critical") buckets[key].criticals++;
      }
    });
    const data = Object.values(buckets);
    const peak = data.reduce((a, b) => (a.runs > b.runs ? a : b));
    return {
      data,
      title: "Runs per day (14d)",
      summary: peak.runs > 0 ? `${runs.length} runs \u00B7 busiest: ${peak.label} (${peak.runs})` : "No runs in period",
    };
  }

  // Group by week
  const buckets: ChartBar[] = [];
  const weekStart = new Date(earliest);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  while (weekStart.getTime() <= latest + 7 * 86400000) {
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
    const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    const bar: ChartBar = { label, runs: 0, warnings: 0, criticals: 0 };
    runs.forEach(r => {
      const t = new Date(r.created_at).getTime();
      if (t >= weekStart.getTime() && t <= weekEnd.getTime()) {
        bar.runs++;
        if (r.analysis_status === "warning") bar.warnings++;
        if (r.analysis_status === "critical") bar.criticals++;
      }
    });
    buckets.push(bar);
    weekStart.setDate(weekStart.getDate() + 7);
    if (buckets.length >= 12) break;
  }
  const peak = buckets.reduce((a, b) => (a.runs > b.runs ? a : b));
  return {
    data: buckets,
    title: "Runs per week",
    summary: peak.runs > 0 ? `${runs.length} total runs \u00B7 peak week: ${peak.label} (${peak.runs})` : "No runs",
  };
}

export default function AdaptiveChart({ runs }: { runs: Run[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const { data, title, summary } = buildChartData(runs);

  if (data.length === 0) return null; // Hide entirely if no data

  const maxVal = Math.max(...data.map(d => d.runs), 1);

  function barColor(bar: ChartBar): string {
    if (bar.criticals > 0) return "#E24B4A";
    if (bar.warnings > 0) return "#EF9F27";
    return "#7C3AED";
  }

  function tooltipText(bar: ChartBar): string {
    const parts = [`${bar.runs} run${bar.runs !== 1 ? "s" : ""}`];
    if (bar.warnings > 0) parts.push(`${bar.warnings} warning${bar.warnings !== 1 ? "s" : ""}`);
    if (bar.criticals > 0) parts.push(`${bar.criticals} critical`);
    if (bar.warnings === 0 && bar.criticals === 0 && bar.runs > 0) parts.push("all clear");
    return `${bar.label} \u2014 ${parts.join(" \u00B7 ")}`;
  }

  return (
    <div className="rounded-lg border border-[var(--border)] p-3" style={{ maxHeight: 140 }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-[var(--muted-foreground)]">{title}</span>
        {hoveredIdx !== null && (
          <span className="text-[10px] text-[var(--foreground)] font-medium">{tooltipText(data[hoveredIdx])}</span>
        )}
      </div>
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
      {/* X-axis labels — show every Nth to avoid crowding */}
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
      <div className="text-[9px] text-[var(--muted-foreground)] mt-1">{summary}</div>
    </div>
  );
}
