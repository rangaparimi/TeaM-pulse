"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardCheck, ListTree, ShieldCheck, Users } from "lucide-react";
import { api } from "@/lib/api";
import { AuthGate } from "@/components/AuthGate";
import { StatCard } from "@/components/StatCard";
import { MatchDistributionChart } from "@/components/MatchDistributionChart";
import { VerdictCard } from "@/components/VerdictCard";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function MentorDashboard() {
  const { data: summary } = useQuery({ queryKey: ["cohort-summary"], queryFn: api.cohortSummary });
  const { data: interns } = useQuery({ queryKey: ["interns"], queryFn: api.listInterns });
  const { data: queue, isLoading } = useQuery({
    queryKey: ["review-queue"],
    queryFn: () => api.reviewQueue(),
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Mentor &amp; leadership view</h1>
      <p className="mt-1 text-sm text-muted">
        Everything above the confidence threshold has already auto-published. This queue is only
        what needs a human judgment call.
      </p>

      {summary && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Interns" value={String(summary.total_interns)} icon={Users} />
          <StatCard label="Learning paths" value={String(summary.total_learning_paths)} icon={ListTree} />
          <StatCard
            label="On track"
            value={`${Math.round(summary.on_track_ratio * 100)}%`}
            icon={ShieldCheck}
          />
          <StatCard
            label="Needs review"
            value={String(summary.pending_review_count)}
            icon={ClipboardCheck}
            accent={summary.pending_review_count > 0 ? "var(--color-partial)" : undefined}
          />
        </div>
      )}

      {summary && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Cohort verdict distribution
          </h2>
          <div className="mt-4">
            <MatchDistributionChart summary={summary} />
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">My interns</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {interns?.map((intern) => (
            <Link
              key={intern.id}
              href={`/intern/${intern.id}`}
              className="group flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: "var(--color-accent)" }}
                >
                  {initials(intern.name)}
                </span>
                <div>
                  <div className="text-sm font-medium">{intern.name}</div>
                  <div className="text-xs text-muted">{intern.team_name || "no team set"}</div>
                </div>
              </div>
              <ArrowRight
                size={14}
                className="text-[var(--color-accent)] opacity-0 transition group-hover:opacity-100"
              />
            </Link>
          ))}
          {interns?.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
              No interns have picked you as their mentor yet.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Review queue {queue ? `(${queue.length})` : ""}
        </h2>
        <div className="mt-3 space-y-4">
          {isLoading &&
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-surface" />
            ))}
          {queue?.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
              Nothing needs a human right now — every verdict is confident and consistent.
            </div>
          )}
          {queue?.map((verdict) => (
            <VerdictCard
              key={verdict.id}
              learningPath={verdict.learning_path}
              verdict={verdict}
              internName={verdict.intern_name}
              showActions
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MentorPage() {
  return (
    <AuthGate role="mentor">
      <MentorDashboard />
    </AuthGate>
  );
}
