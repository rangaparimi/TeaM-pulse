import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { MatchStatus } from "@/lib/types";

const CONFIG: Record<MatchStatus, { label: string; icon: typeof CheckCircle2; fg: string; bg: string }> = {
  ON_TRACK: { label: "On track", icon: CheckCircle2, fg: "var(--color-match)", bg: "var(--color-match-bg)" },
  PARTIALLY_ON_TRACK: {
    label: "Partially on track",
    icon: AlertTriangle,
    fg: "var(--color-partial)",
    bg: "var(--color-partial-bg)",
  },
  OFF_TRACK: {
    label: "Off track",
    icon: XCircle,
    fg: "var(--color-discrepancy)",
    bg: "var(--color-discrepancy-bg)",
  },
};

export function VerdictBadge({ status, size = "md" }: { status: MatchStatus; size?: "sm" | "md" }) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
      style={{ color: cfg.fg, backgroundColor: cfg.bg }}
    >
      <Icon size={size === "sm" ? 12 : 14} />
      {cfg.label}
    </span>
  );
}

export function statusColor(status: MatchStatus) {
  return CONFIG[status].fg;
}
