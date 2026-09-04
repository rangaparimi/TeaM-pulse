"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GitFork, Loader2, LogIn, ShieldCheck, Sparkles, Target } from "lucide-react";
import { api, API_URL } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import type { DemoLogin } from "@/lib/types";

const ROLE_ORDER = ["manager", "mentor", "intern"];
const ROLE_LABEL: Record<string, string> = { manager: "Managers", mentor: "Mentors", intern: "Interns" };

function EmailLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: () => api.emailLogin(email, password),
    onSuccess: (user) => {
      window.location.href = user.role === "manager" ? "/manager" : "/mentor";
    },
  });

  return (
    <form
      className="mt-4 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        login.mutate();
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      <button
        type="submit"
        disabled={login.isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        style={{ backgroundColor: "var(--color-accent)" }}
      >
        {login.isPending ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
        Sign in
      </button>
      {login.isError && (
        <p className="text-xs text-[var(--color-discrepancy)]">
          {login.error instanceof Error ? login.error.message : "Invalid email or password"}
        </p>
      )}
      <p className="text-xs text-muted">
        New mentors are added by a manager, who sends an invite link to your email.
      </p>
    </form>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { data: auth, isLoading } = useAuth();
  const { data: status } = useQuery({ queryKey: ["status"], queryFn: api.status });
  const { data: devLoginUsers } = useQuery({
    queryKey: ["dev-login-users"],
    queryFn: api.listDevLoginUsers,
    enabled: !!status?.dev_login_enabled,
  });
  const [customLogin, setCustomLogin] = useState("");

  useEffect(() => {
    if (isLoading || !auth?.authenticated) return;
    if (!auth.onboarding_complete) {
      router.replace("/onboarding/intern");
    } else if (auth.user?.role === "manager") {
      router.replace("/manager");
    } else if (auth.user?.role === "mentor") {
      router.replace("/mentor");
    } else if (auth.intern_id) {
      router.replace(`/intern/${auth.intern_id}`);
    }
  }, [isLoading, auth, router]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-center">
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
        style={{ color: "var(--color-accent)", backgroundColor: "var(--color-accent-bg)" }}
      >
        <Sparkles size={12} /> AI evidence-gathering, human judgment
      </span>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">TeaM Pulse</h1>
      <p className="mt-3 text-lg text-muted">
        Mentors set the learning path. Interns connect their repo. TeaM Pulse compares what the
        code actually shows against what was assigned — and only pulls a human in when judgment
        is actually needed.
      </p>

      <div className="mt-10 grid gap-4 text-left sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <GitFork size={18} style={{ color: "var(--color-accent)" }} />
          <p className="mt-2 font-medium">I&apos;m an intern</p>
          <p className="mt-1 text-xs text-muted">Sign in with GitHub — first login sets you up.</p>
          <a
            href={`${API_URL}/auth/github/login`}
            className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ backgroundColor: "var(--color-accent)" }}
          >
            <GitFork size={14} /> Continue with GitHub
          </a>
          {status && !status.github_oauth_available && (
            <p className="mt-2 text-xs text-muted">
              GitHub OAuth isn&apos;t configured on this instance yet — use dev login below.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <ShieldCheck size={18} style={{ color: "var(--color-accent)" }} />
          <p className="mt-2 font-medium">I&apos;m a mentor or manager</p>
          <p className="mt-1 text-xs text-muted">Sign in with the email your manager added you with.</p>
          <EmailLoginForm />
        </div>
      </div>

      <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <Target size={16} style={{ color: "var(--color-accent)" }} />
          <p className="mt-2 text-sm font-medium">Mentor sets the plan</p>
          <p className="mt-1 text-xs text-muted">A learning path with clear goals for the period.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <GitFork size={16} style={{ color: "var(--color-accent)" }} />
          <p className="mt-2 text-sm font-medium">Intern connects a repo</p>
          <p className="mt-1 text-xs text-muted">Real PRs and commits become the evidence.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <ShieldCheck size={16} style={{ color: "var(--color-accent)" }} />
          <p className="mt-2 text-sm font-medium">AI compares, mentor confirms</p>
          <p className="mt-1 text-xs text-muted">Only ambiguous cases need a human call.</p>
        </div>
      </div>

      {status?.dev_login_enabled && (
        <div className="mt-12 rounded-xl border border-dashed border-border p-5 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Dev login (testing convenience — bypasses real GitHub OAuth and email/password)
          </p>
          {ROLE_ORDER.map((role) => {
            const usersForRole = (devLoginUsers ?? []).filter((d) => d.role === role);
            if (usersForRole.length === 0) return null;
            return (
              <div key={role} className="mt-3">
                <p className="text-[11px] font-medium text-muted">{ROLE_LABEL[role] ?? role}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {usersForRole.map((d: DemoLogin) => (
                    <a
                      key={`${d.kind}-${d.kind === "email" ? d.email : d.github_login}`}
                      href={
                        d.kind === "email"
                          ? `${API_URL}/auth/dev/login?email=${encodeURIComponent(d.email)}`
                          : `${API_URL}/auth/dev/login?github_login=${d.github_login}`
                      }
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      {d.label}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (customLogin.trim()) {
                window.location.href = `${API_URL}/auth/dev/login?github_login=${encodeURIComponent(customLogin.trim())}`;
              }
            }}
          >
            <input
              value={customLogin}
              onChange={(e) => setCustomLogin(e.target.value)}
              placeholder="new-dev-username (creates a fresh intern account)"
              className="flex-1 rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              Log in as new intern
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
