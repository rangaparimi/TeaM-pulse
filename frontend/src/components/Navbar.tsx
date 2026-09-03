"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, LogOut, Radio } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

function ModePill({ label, live, title }: { label: string; live: boolean; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{
        borderColor: live ? "var(--color-match)" : "var(--border)",
        color: live ? "var(--color-match)" : "var(--muted)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: live ? "var(--color-match)" : "var(--muted)" }}
      />
      {label}
    </span>
  );
}

function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: auth } = useAuth();

  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth-status"] });
      router.push("/");
    },
  });

  if (!auth?.authenticated || !auth.user) return null;

  return (
    <div className="flex items-center gap-2">
      {auth.user.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={auth.user.avatar_url} alt="" className="h-6 w-6 rounded-full" />
      ) : (
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          {auth.user.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="text-sm font-medium">{auth.user.name}</span>
      {auth.user.role && (
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted dark:bg-white/10">
          {auth.user.role}
        </span>
      )}
      <button
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="rounded-full p-1 text-muted hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
        title="Log out"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { data: status } = useQuery({ queryKey: ["status"], queryFn: api.status });
  const { data: auth } = useAuth();

  const linkClass = (href: string) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      pathname === href ? "bg-[var(--color-accent-bg)] text-[var(--color-accent)]" : "text-muted hover:text-foreground"
    }`;

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: "var(--color-accent)" }}
          >
            <Activity size={16} />
          </span>
          TeaM Pulse
        </Link>

        <nav className="flex items-center gap-1">
          {auth?.authenticated && auth.user?.role === "manager" && (
            <Link href="/manager" className={linkClass("/manager")}>
              Manager view
            </Link>
          )}
          {auth?.authenticated && auth.user?.role === "mentor" && (
            <Link href="/mentor" className={linkClass("/mentor")}>
              Mentor view
            </Link>
          )}
          {auth?.authenticated && auth.user?.role === "intern" && auth.intern_id && (
            <Link href={`/intern/${auth.intern_id}`} className={linkClass(`/intern/${auth.intern_id}`)}>
              My dashboard
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {status ? (
            <ModePill
              label={`AI: ${status.ai_primary ?? "mock"}`}
              live={status.ai_mode === "live"}
              title={
                status.ai_primary
                  ? `Primary: ${status.ai_primary}${status.ai_backup ? ` · backup: ${status.ai_backup}` : ""}`
                  : "No AI provider configured — using rule-based mock verdicts"
              }
            />
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Radio size={12} className="animate-pulse" /> connecting…
            </span>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
