"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import type { LearningPath, Verdict } from "@/lib/types";
import { LearningPathTableView } from "./LearningPathTableView";

export function GenerateSummaryButton({
  learningPath,
  internId,
  onResult,
}: {
  learningPath: LearningPath;
  internId: number;
  onResult?: (verdict: Verdict) => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: () => api.generateVerdict(learningPath.id),
    onSuccess: (verdict) => {
      queryClient.invalidateQueries({ queryKey: ["timeline", internId] });
      queryClient.invalidateQueries({ queryKey: ["cohort-summary"] });
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      onResult?.(verdict);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong"),
  });

  return (
    <div className="rounded-xl border border-dashed border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {learningPath.title}
            {learningPath.source_filename && (
              <span className="ml-1.5 text-xs font-normal text-muted">(from {learningPath.source_filename})</span>
            )}
          </p>
          <p className="text-xs text-muted">
            {learningPath.period_start} → {learningPath.period_end}
          </p>
          <p className="mt-1 text-sm">{learningPath.description}</p>
          {learningPath.extracted_table && <LearningPathTableView table={learningPath.extracted_table} />}
        </div>
        <button
          onClick={() => {
            setError(null);
            generate.mutate();
          }}
          disabled={generate.isPending}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          {generate.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {generate.isPending ? "Pulling evidence & analyzing…" : "Generate progress summary"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-[var(--color-discrepancy)]">{error}</p>}
    </div>
  );
}
