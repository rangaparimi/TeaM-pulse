"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CohortSummary } from "@/lib/types";

export function MatchDistributionChart({ summary }: { summary: CohortSummary }) {
  const data = [
    { name: "On track", value: summary.on_track_count, color: "var(--color-match)" },
    { name: "Partially on track", value: summary.partially_on_track_count, color: "var(--color-partial)" },
    { name: "Off track", value: summary.off_track_count, color: "var(--color-discrepancy)" },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return <div className="flex h-48 items-center justify-center text-sm text-muted">No verdicts yet</div>;
  }

  return (
    <div className="flex items-center gap-6">
      <div className="h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-muted">{d.name}</span>
            <span className="ml-auto font-medium tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
