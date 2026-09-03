"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimelineEntry } from "@/lib/types";
import { statusColor } from "./VerdictBadge";

export function GrowthChart({ timeline }: { timeline: TimelineEntry[] }) {
  const data = timeline
    .filter((t) => t.verdict)
    .map((t) => ({
      period: t.learning_path.period_start,
      confidence: Math.round((t.verdict?.confidence ?? 0) * 100),
      status: t.verdict?.match_status,
    }));

  if (data.length === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted">No verdicts yet</div>;
  }

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--muted)" }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--muted)" }} />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="confidence"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload, key } = props;
              return (
                <circle
                  key={key}
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill={statusColor(payload.status)}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
