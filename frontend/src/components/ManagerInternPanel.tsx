"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, GitBranch, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Intern } from "@/lib/types";
import { VerdictCard } from "./VerdictCard";
import { GenerateSummaryButton } from "./GenerateSummaryButton";
import { AddLearningPathButton } from "./AddLearningPathModal";

function InternRow({ intern }: { intern: Intern }) {
  const [open, setOpen] = useState(false);
  const { data: timeline, isLoading } = useQuery({
    queryKey: ["timeline", intern.id],
    queryFn: () => api.internTimeline(intern.id),
    enabled: open,
  });

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown size={13} className="text-muted" /> : <ChevronRight size={13} className="text-muted" />}
          <span className="text-sm font-medium">{intern.name}</span>
          <span className="text-xs text-muted">@{intern.github_username}</span>
        </span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <GitBranch size={11} /> {intern.repo || "no repo"}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border p-3">
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Loader2 size={12} className="animate-spin" /> Loading learning summary…
            </div>
          )}
          <AddLearningPathButton
            internId={intern.id}
            defaultStart={
              timeline && timeline.length > 0
                ? format(new Date(timeline[timeline.length - 1].learning_path.period_end), "yyyy-MM-dd")
                : format(new Date(), "yyyy-MM-dd")
            }
          />
          {timeline?.length === 0 && (
            <p className="text-xs text-muted">No learning paths assigned to this intern yet.</p>
          )}
          {[...(timeline ?? [])].reverse().map((entry) =>
            entry.verdict ? (
              <div key={entry.learning_path.id} className="space-y-2">
                <VerdictCard learningPath={entry.learning_path} verdict={entry.verdict} internName={intern.name} />
                <GenerateSummaryButton
                  learningPath={entry.learning_path}
                  internId={intern.id}
                  existingVerdict={entry.verdict}
                />
              </div>
            ) : (
              <GenerateSummaryButton key={entry.learning_path.id} learningPath={entry.learning_path} internId={intern.id} />
            )
          )}
        </div>
      )}
    </div>
  );
}

export function MentorInternsList({ mentorId }: { mentorId: number }) {
  const { data: interns, isLoading } = useQuery({
    queryKey: ["mentor-interns", mentorId],
    queryFn: () => api.mentorInterns(mentorId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-1 py-2 text-xs text-muted">
        <Loader2 size={12} className="animate-spin" /> Loading interns…
      </div>
    );
  }

  if (!interns || interns.length === 0) {
    return <p className="px-1 py-2 text-xs text-muted">No interns assigned to this mentor yet.</p>;
  }

  return (
    <div className="space-y-2">
      {interns.map((intern) => (
        <InternRow key={intern.id} intern={intern} />
      ))}
    </div>
  );
}
