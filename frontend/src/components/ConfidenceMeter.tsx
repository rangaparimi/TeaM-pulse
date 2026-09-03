export function ConfidenceMeter({ value, width = 96 }: { value: number; width?: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "var(--color-match)" : pct >= 45 ? "var(--color-partial)" : "var(--color-discrepancy)";
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"
        style={{ width }}
      >
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums font-medium text-muted">{pct}%</span>
    </div>
  );
}
