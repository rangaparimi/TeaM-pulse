"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Cpu, FlaskConical, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import type { LearningPath, MatchStatus, Verdict } from "@/lib/types";
import { VerdictBadge } from "./VerdictBadge";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { SkillTagPill } from "./SkillTagPill";
import { EvidenceList } from "./EvidenceList";
import { LearningPathTableView } from "./LearningPathTableView";
import { FilePreviewButton } from "./FilePreviewModal";

const STATUS_OPTIONS: MatchStatus[] = ["ON_TRACK", "PARTIALLY_ON_TRACK", "OFF_TRACK"];

const PROVIDER_LABEL: Record<Verdict["source_mode"], string> = {
  nvidia: "NVIDIA",
  gemini: "Gemini (backup)",
  mock: "mock verdict",
};

export function VerdictCard({
  learningPath,
  verdict,
  internName,
  showActions = false,
}: {
  learningPath: LearningPath;
  verdict: Verdict;
  internName?: string;
  showActions?: boolean;
}) {
  const queryClient = useQueryClient();
  const [overriding, setOverriding] = useState(false);
  const [note, setNote] = useState("");
  const [overrideStatus, setOverrideStatus] = useState<MatchStatus>(verdict.match_status);

  const decide = useMutation({
    mutationFn: (payload: { status: "CONFIRMED" | "OVERRIDDEN"; overridden_match_status?: MatchStatus }) =>
      api.decideVerdict(verdict.id, {
        status: payload.status,
        note: note || undefined,
        overridden_match_status: payload.overridden_match_status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["cohort-summary"] });
      queryClient.invalidateQueries({ queryKey: ["verdicts"] });
      setOverriding(false);
    },
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {internName && <span className="text-sm font-semibold">{internName}</span>}
          <span className="text-xs text-muted">
            {learningPath.period_start} → {learningPath.period_end}
          </span>
          {verdict.source_mode === "mock" ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-muted"
              title="No AI provider configured (or all failed) — using rule-based mock verdicts"
            >
              <FlaskConical size={10} /> mock verdict
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-muted"
              title={verdict.source_mode === "gemini" ? "NVIDIA was unavailable — fell back to Gemini" : undefined}
            >
              <Cpu size={10} /> {PROVIDER_LABEL[verdict.source_mode]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <VerdictBadge status={verdict.match_status} size="sm" />
          <ConfidenceMeter value={verdict.confidence} width={70} />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Assigned: {learningPath.title}
            {learningPath.source_filename && (
              <span className="ml-1.5 inline-flex items-center gap-1.5 normal-case text-muted">
                (from {learningPath.source_filename})
                {learningPath.has_file && (
                  <FilePreviewButton learningPathId={learningPath.id} filename={learningPath.source_filename} />
                )}
              </span>
            )}
          </p>
          <p className="mt-1 text-sm">{learningPath.description}</p>
          {learningPath.extracted_table && <LearningPathTableView table={learningPath.extracted_table} />}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Evidence-based summary</p>
          <p className="mt-1 text-sm">{verdict.ai_summary}</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-black/[0.03] p-3 text-sm dark:bg-white/5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Reasoning</span>
        <p className="mt-1">{verdict.reasoning}</p>
      </div>

      {verdict.skill_tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {verdict.skill_tags.map((tag) => (
            <SkillTagPill key={tag.id} name={tag.skill_name} strength={tag.evidence_strength} />
          ))}
        </div>
      )}

      <div className="mt-3">
        <EvidenceList evidence={verdict.evidence} />
      </div>

      {verdict.mentor_override && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
          <Check size={13} className="text-[var(--color-match)]" />
          <span>
            <strong>{verdict.mentor_override.mentor_name}</strong> {verdict.mentor_override.status.toLowerCase()} this
            verdict
            {verdict.mentor_override.note ? `: "${verdict.mentor_override.note}"` : "."}
          </span>
        </div>
      )}

      {showActions && !verdict.mentor_override && (
        <div className="mt-4 border-t border-border pt-3">
          {!overriding ? (
            <div className="flex flex-wrap gap-2">
              <button
                disabled={decide.isPending}
                onClick={() => decide.mutate({ status: "CONFIRMED" })}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                style={{ backgroundColor: "var(--color-match)" }}
              >
                <Check size={14} /> Confirm
              </button>
              <button
                onClick={() => setOverriding(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
              >
                <Pencil size={14} /> Override
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setOverrideStatus(s)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                      overrideStatus === s ? "border-[var(--color-accent)] text-[var(--color-accent)]" : "border-border text-muted"
                    }`}
                  >
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Note for the record (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              <div className="flex gap-2">
                <button
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ status: "OVERRIDDEN", overridden_match_status: overrideStatus })}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                  style={{ backgroundColor: "var(--color-accent)" }}
                >
                  Save override
                </button>
                <button
                  onClick={() => setOverriding(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
