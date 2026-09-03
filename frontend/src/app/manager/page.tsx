"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Building2,
  Check,
  Clock,
  Copy,
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
import type { MentorInviteResult, User } from "@/lib/types";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
      <div className="text-[11px] font-medium uppercase tracking-wide text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function MentorRow({ mentor, action }: { mentor: User; action: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          {initials(mentor.name)}
        </span>
        <div>
          <div className="flex items-center gap-1.5">
            <Link href={`/mentor`} className="text-sm font-medium hover:text-[var(--color-accent)]">
              {mentor.name}
            </Link>
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

function ManagerDashboard() {
  const { data: auth } = useAuth();
  const queryClient = useQueryClient();
  const { data: overview, isLoading } = useQuery({
    queryKey: ["manager-overview"],
    queryFn: api.managerOverview,
  });

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
              <StatBlock label="Interns (org-wide)" value={String(overview.summary.total_interns)} />
              <StatBlock label="Teams" value={String(overview.teams.length)} />
              <StatBlock
                label="On track"
                value={`${Math.round(overview.summary.on_track_ratio * 100)}%`}
              />
              <StatBlock label="Needs review" value={String(overview.summary.pending_review_count)} />
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
          {overview?.teams.map((team) => (
            <div key={team.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{team.name}</h3>
                <span className="text-xs text-muted">{team.mentors.length} mentor(s)</span>
              </div>
              <div className="mt-3 space-y-2">
                {team.mentors.map((mentor) => (
                  <MentorRow
                    key={mentor.id}
                    mentor={mentor}
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
                ))}
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
          ))}
        </div>

        <div className="mt-4">
          <CreateTeamForm />
        </div>

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
