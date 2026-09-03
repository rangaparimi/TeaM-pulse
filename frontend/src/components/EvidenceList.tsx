"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, GitCommitHorizontal, GitPullRequest } from "lucide-react";
import type { Evidence } from "@/lib/types";

export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  const [open, setOpen] = useState(false);

  if (evidence.length === 0) {
    return <p className="text-xs text-muted">No evidence found for this period.</p>;
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
      >
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        {evidence.length} evidence item{evidence.length === 1 ? "" : "s"}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 border-l border-border pl-3">
          {evidence.map((e) => (
            <li key={e.id} className="text-xs">
              <a
                href={e.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 font-medium hover:text-[var(--color-accent)]"
              >
                {e.url.includes("/pull/") ? <GitPullRequest size={12} /> : <GitCommitHorizontal size={12} />}
                {e.title}
                <ExternalLink size={10} className="opacity-50" />
              </a>
              <span className="text-muted">
                {" "}
                +{e.diff_stats.additions}/-{e.diff_stats.deletions} · {e.diff_stats.files_changed} files
                {e.diff_stats.languages?.length ? ` · ${e.diff_stats.languages.join(", ")}` : ""}
                {e.review_iterations > 0 ? ` · ${e.review_iterations} review round(s)` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
