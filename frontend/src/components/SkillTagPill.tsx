export function SkillTagPill({ name, strength }: { name: string; strength: number }) {
  const opacity = 0.35 + Math.min(Math.max(strength, 0), 1) * 0.65;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-white"
      style={{ backgroundColor: "var(--color-accent)", opacity }}
      title={`Evidence strength: ${Math.round(strength * 100)}%`}
    >
      {name}
    </span>
  );
}
