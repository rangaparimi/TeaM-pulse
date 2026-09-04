"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Sparkles, Terminal } from "lucide-react";
import { api } from "@/lib/api";
import type { LearningPath, Verdict } from "@/lib/types";
import { LearningPathTableView } from "./LearningPathTableView";
import { FilePreviewButton } from "./FilePreviewModal";

export function GenerateSummaryButton({
  learningPath,
  internId,
  existingVerdict,
  onResult,
}: {
  learningPath: LearningPath;
  internId: number;
  /** Pass the current verdict to switch this into "rerun" mode: it reruns
   *  the AI analysis from scratch and discards the old verdict. */
  existingVerdict?: Verdict;
  onResult?: (verdict: Verdict) => void;
}) {
  const queryClient = useQueryClient();
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const isRerun = !!existingVerdict;

  const run = async () => {
    setError(null);
    setLogs([]);
    setRunning(true);
    try {
      await api.streamGenerateVerdict(learningPath.id, isRerun, (event) => {
        if (event.type === "log") {
          setLogs((prev) => [...prev, event.message]);
          queueMicrotask(() => logsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
        } else if (event.type === "error") {
          setError(event.message);
        } else if (event.type === "result") {
          queryClient.invalidateQueries({ queryKey: ["timeline", internId] });
          queryClient.invalidateQueries({ queryKey: ["cohort-summary"] });
          queryClient.invalidateQueries({ queryKey: ["review-queue"] });
          queryClient.invalidateQueries({ queryKey: ["manager-overview"] });
          onResult?.(event.verdict);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-border p-4">
      <div className="flex items-center justify-between gap-3">
        {!isRerun ? (
          <div>
            <p className="text-sm font-medium">
              {learningPath.title}
              {learningPath.source_filename && (
                <span className="ml-1.5 inline-flex items-center gap-1.5 text-xs font-normal text-muted">
                  (from {learningPath.source_filename})
                  {learningPath.has_file && (
                    <FilePreviewButton learningPathId={learningPath.id} filename={learningPath.source_filename} />
                  )}
                </span>
              )}
            </p>
            <p className="text-xs text-muted">
              {learningPath.period_start} → {learningPath.period_end}
            </p>
            <p className="mt-1 text-sm">{learningPath.description}</p>
            {learningPath.extracted_table && <LearningPathTableView table={learningPath.extracted_table} />}
          </div>
        ) : (
          <p className="text-xs text-muted">Re-analyze this period&apos;s GitHub evidence against the learning path.</p>
        )}
        <button
          onClick={run}
          disabled={running}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          {running ? (
            <Loader2 size={14} className="animate-spin" />
          ) : isRerun ? (
            <RefreshCw size={14} />
          ) : (
            <Sparkles size={14} />
          )}
          {running ? "Analyzing…" : isRerun ? "Re-run analysis" : "Generate progress summary"}
        </button>
      </div>

      {(running || logs.length > 0) && (
        <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-black/90 p-3 font-mono text-[11px] leading-relaxed text-green-400">
          <div className="mb-1 flex items-center gap-1.5 text-white/50">
            <Terminal size={11} /> analysis log
          </div>
          {logs.map((line, i) => (
            <div key={i}>
              <span className="text-white/30">$</span> {line}
            </div>
          ))}
          {running && <div className="animate-pulse text-white/40">▍</div>}
          <div ref={logsEndRef} />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-[var(--color-discrepancy)]">{error}</p>}
    </div>
  );
}
