"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Link2,
  ListTree,
  Loader2,
  Mail,
  Plus,
  Sparkles,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { AuthGate } from "@/components/AuthGate";
import { MentorInternsList } from "@/components/ManagerInternPanel";
import { StatDetailModal } from "@/components/StatDetailModal";
import { MatchDistributionChart } from "@/components/MatchDistributionChart";
import { VerdictCard } from "@/components/VerdictCard";
import type { CohortSummary, Intern, ManagerOverview, MentorInviteResult, User } from "@/lib/types";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function StatBlock({
  label,
  value,
  details,
  onClick,
}: {
  label: string;
  value: string;
  details?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
      className={`group relative rounded-xl bg-white/10 px-4 py-3 text-left backdrop-blur transition ${
        details ? "hover:bg-white/15" : ""
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      {details && (
        <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-border bg-surface p-3 text-xs text-foreground opacity-0 shadow-lg transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
          {details}
        </div>
      )}
    </div>
  );
}

function MentorRow({
  mentor,
  action,
  expandable = false,
  expanded = false,
  onToggle,
}: {
  mentor: User;
  action: React.ReactNode;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const nameBlock = (
    <div className="flex items-center gap-2">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
        style={{ backgroundColor: "var(--color-accent)" }}
      >
        {initials(mentor.name)}
      </span>
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{mentor.name}</span>
          {mentor.pending_invite && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{ color: "var(--color-partial)", backgroundColor: "var(--color-partial-bg)" }}
              title="Hasn't accepted their invite yet"
            >
              <Clock size={9} /> pending
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted">{mentor.intern_count ?? 0} intern(s)</div>
      </div>
    </div>
  );

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
      {expandable ? (
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left"
          title={expanded ? "Hide interns" : "Show this mentor's interns"}
        >
          {expanded ? (
            <ChevronDown size={13} className="shrink-0 text-muted" />
          ) : (
            <ChevronRight size={13} className="shrink-0 text-muted" />
          )}
          {nameBlock}
        </button>
      ) : (
        nameBlock
      )}
      {action}
    </div>
  );
}

function AddMentorForm({ teams }: { teams: { id: number; name: string }[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", employee_code: "", phone: "", designation: "" });
  const [teamId, setTeamId] = useState<string>("");
  const [result, setResult] = useState<MentorInviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      api.createMentor({ ...form, team_id: teamId ? Number(teamId) : null }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["manager-overview"] });
      setResult(res);
      setForm({ name: "", email: "", employee_code: "", phone: "", designation: "" });
      setTeamId("");
    },
  });

  if (result) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-match)" }}>
          <Check size={16} /> {result.mentor.name} added
        </div>
        <p className="mt-1 text-xs text-muted">
          {result.email_sent
            ? `An invite email was sent to ${result.mentor.email}.`
            : "Email sending isn't configured — share this invite link with them directly:"}
        </p>
        {!result.email_sent && (
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-border bg-black/[0.03] px-2.5 py-1.5 text-xs dark:bg-white/5">
              {result.invite_link}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(result.invite_link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
        <button
          onClick={() => setResult(null)}
          className="mt-3 text-xs font-medium text-[var(--color-accent)]"
        >
          + Add another mentor
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white"
        style={{ backgroundColor: "var(--color-accent)" }}
      >
        <UserPlus size={14} /> Add mentor
      </button>
    );
  }

  return (
    <form
      className="rounded-xl border border-border bg-surface p-4 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <label className="text-xs text-muted">
          Email
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <label className="text-xs text-muted">
          Employee code
          <input
            required
            value={form.employee_code}
            onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <label className="text-xs text-muted">
          Phone
          <input
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <label className="text-xs text-muted">
          Designation
          <input
            required
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <label className="text-xs text-muted">
          Team (optional)
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
          >
            <option value="">Unassigned</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
          Send invite
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
        >
          Cancel
        </button>
        {create.isError && (
          <span className="text-xs text-[var(--color-discrepancy)]">
            {create.error instanceof Error ? create.error.message : "Something went wrong"}
          </span>
        )}
      </div>
    </form>
  );
}

function CreateTeamForm() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () => api.createTeam(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-overview"] });
      setName("");
      setOpen(false);
    },
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/30 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
      >
        <Plus size={14} /> New team
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) create.mutate();
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Team name"
        className="rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-sm text-white placeholder:text-white/50 outline-none focus:border-white"
      />
      <button
        type="submit"
        disabled={create.isPending}
        className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] disabled:opacity-60"
      >
        {create.isPending ? <Loader2 size={14} className="animate-spin" /> : "Create"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-white/70 hover:text-white">
        Cancel
      </button>
    </form>
  );
}

function UnassignedInternRow({
  intern,
  mentors,
}: {
  intern: Intern;
  mentors: { id: number; name: string; team_name: string | null }[];
}) {
  const queryClient = useQueryClient();
  const [mentorId, setMentorId] = useState<string>("");

  const assign = useMutation({
    mutationFn: (mentorId: number) => api.assignInternToMentor(intern.id, mentorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unassigned-interns"] });
      queryClient.invalidateQueries({ queryKey: ["manager-overview"] });
      queryClient.invalidateQueries({ queryKey: ["mentor-interns"] });
    },
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          {initials(intern.name)}
        </span>
        <div>
          <div className="text-sm font-medium">{intern.name}</div>
          <div className="text-[11px] text-muted">@{intern.github_username}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <select
          value={mentorId}
          onChange={(e) => setMentorId(e.target.value)}
          className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-xs outline-none focus:border-[var(--color-accent)]"
        >
          <option value="">Pick a mentor…</option>
          {mentors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.team_name ? ` — ${m.team_name}` : ""}
            </option>
          ))}
        </select>
        <button
          onClick={() => mentorId && assign.mutate(Number(mentorId))}
          disabled={!mentorId || assign.isPending}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          {assign.isPending ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
          Assign
        </button>
      </div>
      {assign.isError && (
        <p className="w-full text-[11px] text-[var(--color-discrepancy)]">
          {assign.error instanceof Error ? assign.error.message : "Something went wrong"}
        </p>
      )}
    </div>
  );
}

type StatKey = "interns" | "teams" | "ontrack" | "review";

function InternsDetailContent() {
  const { data: interns, isLoading } = useQuery({ queryKey: ["org-wide-interns"], queryFn: api.orgWideInterns });

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;
  if (!interns || interns.length === 0) return <p className="text-sm text-muted">No interns yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th className="pb-2 pr-3 font-medium">Name</th>
            <th className="pb-2 pr-3 font-medium">Team</th>
            <th className="pb-2 pr-3 font-medium">Mentor</th>
            <th className="pb-2 font-medium">Repo</th>
          </tr>
        </thead>
        <tbody>
          {interns.map((intern) => (
            <tr key={intern.id} className="border-b border-border last:border-0">
              <td className="py-2 pr-3">
                <Link href={`/intern/${intern.id}`} className="font-medium hover:text-[var(--color-accent)]">
                  {intern.name}
                </Link>
                <div className="text-xs text-muted">@{intern.github_username}</div>
              </td>
              <td className="py-2 pr-3 text-muted">{intern.team_name || "—"}</td>
              <td className="py-2 pr-3 text-muted">{intern.mentor_name || "—"}</td>
              <td className="max-w-[160px] truncate py-2 text-muted">{intern.repo || "no repo"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamsDetailContent({ teams }: { teams: ManagerOverview["teams"] }) {
  if (teams.length === 0) return <p className="text-sm text-muted">No teams yet — create one below.</p>;

  return (
    <div className="space-y-4">
      {teams.map((team) => (
        <div key={team.id} className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">{team.name}</h4>
            <span className="text-xs text-muted">{team.mentors.length} mentor(s)</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {team.mentors.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span>{m.name}</span>
                <span className="text-xs text-muted">{m.intern_count ?? 0} intern(s)</span>
              </div>
            ))}
            {team.mentors.length === 0 && <p className="text-xs text-muted">No mentors in this team yet.</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function OnTrackDetailContent({ summary }: { summary: CohortSummary }) {
  return (
    <div className="space-y-4">
      <MatchDistributionChart summary={summary} />
      <div className="rounded-lg border border-border p-3 text-sm text-muted">
        Average AI confidence across every verdict: <span className="font-medium text-foreground">{Math.round(summary.avg_confidence * 100)}%</span>
      </div>
    </div>
  );
}

function ReviewQueueDetailContent() {
  const { data: queue, isLoading } = useQuery({
    queryKey: ["org-wide-review-queue"],
    queryFn: api.orgWideReviewQueue,
  });

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;
  if (!queue || queue.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nothing needs a human right now — every verdict across your teams is confident and consistent.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {queue.map((verdict) => (
        <VerdictCard
          key={verdict.id}
          learningPath={verdict.learning_path}
          verdict={verdict}
          internName={verdict.intern_name}
        />
      ))}
    </div>
  );
}

function ManagerDashboard() {
  const { data: auth } = useAuth();
  const queryClient = useQueryClient();
  const [openStat, setOpenStat] = useState<StatKey | null>(null);
  const [expandedMentorIds, setExpandedMentorIds] = useState<Set<number>>(new Set());
  const toggleMentor = (id: number) =>
    setExpandedMentorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleMentors = (ids: number[], expand: boolean) =>
    setExpandedMentorIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (expand) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const { data: overview, isLoading } = useQuery({
    queryKey: ["manager-overview"],
    queryFn: api.managerOverview,
  });
  const { data: unassignedInterns } = useQuery({
    queryKey: ["unassigned-interns"],
    queryFn: api.listUnassignedInternsOrgWide,
  });
  const allMentors = (overview?.teams ?? []).flatMap((t) =>
    t.mentors.map((m) => ({ id: m.id, name: m.name, team_name: t.name }))
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["manager-overview"] });

  const assignTeam = useMutation({
    mutationFn: ({ userId, teamId }: { userId: number; teamId: number | null }) =>
      api.assignMentorTeam(userId, teamId),
    onSuccess: invalidate,
  });

  const promote = useMutation({
    mutationFn: (userId: number) => api.promoteToManager(userId),
    onSuccess: invalidate,
  });

  return (
    <div>
      <div
        className="px-6 py-10"
        style={{ background: "linear-gradient(135deg, var(--color-accent), #1e1b4b)" }}
      >
        <div className="mx-auto max-w-6xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
            <Building2 size={12} /> Organization overview
          </span>
          <h1 className="mt-3 text-2xl font-semibold text-white">
            Welcome back, {auth?.user?.name?.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-white/70">
            Create teams, assign mentors into them, and promote someone to manager. This is the
            org-wide rollup across every team you own — mentor dashboards only see their own interns.
          </p>

          {overview && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBlock
                label="Interns (org-wide)"
                value={String(overview.summary.total_interns)}
                onClick={() => setOpenStat("interns")}
                details={
                  <div className="space-y-1">
                    <p className="font-semibold">By team</p>
                    {overview.teams.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-4">
                        <span className="text-muted">{t.name}</span>
                        <span className="font-medium">
                          {t.mentors.reduce((sum, m) => sum + (m.intern_count ?? 0), 0)}
                        </span>
                      </div>
                    ))}
                    {overview.teams.length === 0 && <p className="text-muted">No teams yet.</p>}
                  </div>
                }
              />
              <StatBlock
                label="Teams"
                value={String(overview.teams.length)}
                onClick={() => setOpenStat("teams")}
                details={
                  <div className="space-y-1">
                    {overview.teams.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-4">
                        <span className="text-muted">{t.name}</span>
                        <span className="font-medium">{t.mentors.length} mentor(s)</span>
                      </div>
                    ))}
                    {overview.teams.length === 0 && <p className="text-muted">No teams yet — create one below.</p>}
                  </div>
                }
              />
              <StatBlock
                label="On track"
                value={`${Math.round(overview.summary.on_track_ratio * 100)}%`}
                onClick={() => setOpenStat("ontrack")}
                details={
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span style={{ color: "var(--color-match)" }}>On track</span>
                      <span className="font-medium">{overview.summary.on_track_count}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span style={{ color: "var(--color-partial)" }}>Partially on track</span>
                      <span className="font-medium">{overview.summary.partially_on_track_count}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span style={{ color: "var(--color-discrepancy)" }}>Off track</span>
                      <span className="font-medium">{overview.summary.off_track_count}</span>
                    </div>
                    <div className="mt-1 border-t border-border pt-1 text-muted">
                      Avg. AI confidence: {Math.round(overview.summary.avg_confidence * 100)}%
                    </div>
                  </div>
                }
              />
              <StatBlock
                label="Needs review"
                value={String(overview.summary.pending_review_count)}
                onClick={() => setOpenStat("review")}
                details={
                  <p className="text-muted">
                    Verdicts that are off-track or below the confidence threshold, and haven&apos;t been
                    confirmed or overridden by a mentor yet.
                  </p>
                }
              />
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <Users size={14} /> Add a mentor
          </h2>
        </div>
        <div className="mt-3">
          <AddMentorForm teams={(overview?.teams ?? []).map((t) => ({ id: t.id, name: t.name }))} />
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <ListTree size={14} /> Teams
          </h2>
        </div>

        {isLoading && (
          <div className="mt-3 h-32 animate-pulse rounded-xl border border-border bg-surface" />
        )}

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {overview?.teams.map((team) => {
            const teamMentorIds = team.mentors.map((m) => m.id);
            const allExpanded = teamMentorIds.length > 0 && teamMentorIds.every((id) => expandedMentorIds.has(id));
            return (
            <div key={team.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <button
                onClick={() => toggleMentors(teamMentorIds, !allExpanded)}
                disabled={teamMentorIds.length === 0}
                className="flex w-full items-center justify-between text-left disabled:cursor-default"
                title={teamMentorIds.length === 0 ? undefined : allExpanded ? "Collapse all mentors" : "Show interns under every mentor in this team"}
              >
                <span className="flex items-center gap-1.5">
                  {teamMentorIds.length > 0 &&
                    (allExpanded ? (
                      <ChevronDown size={14} className="text-muted" />
                    ) : (
                      <ChevronRight size={14} className="text-muted" />
                    ))}
                  <h3 className="font-semibold">{team.name}</h3>
                </span>
                <span className="text-xs text-muted">{team.mentors.length} mentor(s)</span>
              </button>
              <div className="mt-3 space-y-2">
                {team.mentors.map((mentor) => {
                  const mentorExpanded = expandedMentorIds.has(mentor.id);
                  return (
                  <div key={mentor.id}>
                    <MentorRow
                      mentor={mentor}
                      expandable
                      expanded={mentorExpanded}
                      onToggle={() => toggleMentor(mentor.id)}
                      action={
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => promote.mutate(mentor.id)}
                            disabled={promote.isPending}
                            title="Promote to manager"
                            className="rounded-full p-1.5 text-muted hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                          >
                            <UserCog size={13} />
                          </button>
                          <button
                            onClick={() => assignTeam.mutate({ userId: mentor.id, teamId: null })}
                            disabled={assignTeam.isPending}
                            className="rounded-full px-2 py-1 text-[11px] font-medium text-muted hover:bg-black/5 dark:hover:bg-white/10"
                          >
                            Remove
                          </button>
                        </div>
                      }
                    />
                    {mentorExpanded && (
                      <div className="ml-9 mt-2 border-l border-border pl-3">
                        <MentorInternsList mentorId={mentor.id} />
                      </div>
                    )}
                  </div>
                  );
                })}
                {team.mentors.length === 0 && (
                  <p className="text-xs text-muted">No mentors in this team yet.</p>
                )}
              </div>

              {overview.unassigned_mentors.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) assignTeam.mutate({ userId: Number(e.target.value), teamId: team.id });
                    e.target.value = "";
                  }}
                  className="mt-3 w-full rounded-lg border border-dashed border-border bg-transparent px-2.5 py-1.5 text-xs text-muted outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="">+ Add a mentor to this team…</option>
                  {overview.unassigned_mentors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            );
          })}
        </div>

        <div className="mt-4">
          <CreateTeamForm />
        </div>

        {unassignedInterns && unassignedInterns.length > 0 && (
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <UserPlus size={14} /> Unassigned interns ({unassignedInterns.length})
            </h2>
            <p className="mt-1 text-xs text-muted">
              These interns signed up without picking a mentor — route each one to a mentor on one of your teams.
            </p>
            <div className="mt-3 space-y-2">
              {unassignedInterns.map((intern) => (
                <UnassignedInternRow key={intern.id} intern={intern} mentors={allMentors} />
              ))}
            </div>
            {allMentors.length === 0 && (
              <p className="mt-2 text-xs text-muted">
                Add a mentor to one of your teams first before you can assign these interns.
              </p>
            )}
          </div>
        )}

        <div className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <Users size={14} /> Unassigned mentors
          </h2>
          <div className="mt-3 space-y-2">
            {overview?.unassigned_mentors.map((mentor) => (
              <MentorRow
                key={mentor.id}
                mentor={mentor}
                action={
                  <button
                    onClick={() => promote.mutate(mentor.id)}
                    disabled={promote.isPending}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <UserCog size={12} /> Promote to manager
                  </button>
                }
              />
            ))}
            {overview?.unassigned_mentors.length === 0 && (
              <p className="text-xs text-muted">Every mentor is on a team.</p>
            )}
          </div>
        </div>

        <div className="mt-8 flex items-center gap-2 rounded-xl border border-dashed border-border p-4 text-xs text-muted">
          <Sparkles size={14} style={{ color: "var(--color-accent)" }} />
          Want to see a mentor&apos;s own review queue and per-intern verdicts?
          <Link href="/mentor" className="inline-flex items-center gap-1 font-medium text-[var(--color-accent)]">
            Open the mentor view <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      {overview && openStat === "interns" && (
        <StatDetailModal title="Interns (org-wide)" onClose={() => setOpenStat(null)}>
          <InternsDetailContent />
        </StatDetailModal>
      )}
      {overview && openStat === "teams" && (
        <StatDetailModal title="Teams" onClose={() => setOpenStat(null)}>
          <TeamsDetailContent teams={overview.teams} />
        </StatDetailModal>
      )}
      {overview && openStat === "ontrack" && (
        <StatDetailModal title="Cohort verdict distribution" onClose={() => setOpenStat(null)}>
          <OnTrackDetailContent summary={overview.summary} />
        </StatDetailModal>
      )}
      {overview && openStat === "review" && (
        <StatDetailModal title="Needs review (org-wide)" onClose={() => setOpenStat(null)}>
          <ReviewQueueDetailContent />
        </StatDetailModal>
      )}
    </div>
  );
}

export default function ManagerPage() {
  return (
    <AuthGate role="manager">
      <ManagerDashboard />
    </AuthGate>
  );
}
