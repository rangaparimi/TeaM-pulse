"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, GitBranch, User } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { GrowthChart } from "./GrowthChart";
import { SkillTagPill } from "./SkillTagPill";
import { VerdictCard } from "./VerdictCard";
import { GenerateSummaryButton } from "./GenerateSummaryButton";
import { LearningPathForm } from "./LearningPathForm";

export function InternView({ internId }: { internId: number }) {
  const { data: auth } = useAuth();
  const {
    data: intern,
    error: internError,
  } = useQuery({ queryKey: ["intern", internId], queryFn: () => api.getIntern(internId), retry: false });
  const { data: timeline, isLoading } = useQuery({
    queryKey: ["timeline", internId],
    queryFn: () => api.internTimeline(internId),
  });

  const isMentorOfThisIntern = auth?.user?.role === "mentor" && auth.user.id === intern?.mentor_id;

  const skillTags = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of timeline ?? []) {
      for (const tag of entry.verdict?.skill_tags ?? []) {
        map.set(tag.skill_name, Math.max(map.get(tag.skill_name) ?? 0, tag.evidence_strength));
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [timeline]);

  const nextPeriodStart = useMemo(() => {
    const last = timeline?.[timeline.length - 1]?.learning_path.period_end;
    return format(last ? new Date(last) : new Date(), "yyyy-MM-dd");
  }, [timeline]);

  if (internError) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10 text-sm text-[var(--color-discrepancy)]">
        You don&apos;t have access to this intern&apos;s data.
      </div>
    );
  }

  if (!intern) {
    return <div className="mx-auto max-w-4xl px-6 py-10 text-sm text-muted">Loading intern…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{intern.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1">
                <User size={12} /> {intern.team_name || "no team set"} · mentored by{" "}
                {intern.mentor_name || "unassigned"}
              </span>
              <span className="flex items-center gap-1">
                <GitBranch size={12} /> {intern.repo || "no repo connected"} (@{intern.github_username})
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays size={12} /> since {intern.start_date}
              </span>
            </div>
          </div>
        </div>

        {skillTags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-4">
            {skillTags.map(([name, strength]) => (
              <SkillTagPill key={name} name={name} strength={strength} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Growth timeline</h2>
        <div className="mt-3">{timeline && <GrowthChart timeline={timeline} />}</div>
      </div>

      {isMentorOfThisIntern && (
        <div className="mt-5">
          <LearningPathForm internId={internId} defaultStart={nextPeriodStart} />
        </div>
      )}

      <div className="mt-8 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Learning path history</h2>
        {isLoading &&
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        {[...(timeline ?? [])].reverse().map((entry) =>
          entry.verdict ? (
            <VerdictCard key={entry.learning_path.id} learningPath={entry.learning_path} verdict={entry.verdict} />
          ) : (
            <GenerateSummaryButton
              key={entry.learning_path.id}
              learningPath={entry.learning_path}
              internId={internId}
            />
          )
        )}
        {timeline?.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
            {isMentorOfThisIntern
              ? "No learning paths yet — assign the first one above."
              : "Your mentor hasn't assigned a learning path yet."}
          </div>
        )}
      </div>
    </div>
  );
}
