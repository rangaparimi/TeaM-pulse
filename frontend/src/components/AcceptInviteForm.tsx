"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { api } from "@/lib/api";

export function AcceptInviteForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: invite, isLoading, error: inviteError } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => api.getInvite(token),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => api.acceptInvite(token, password),
    onSuccess: (user) => {
      window.location.href = user.role === "manager" ? "/manager" : "/mentor";
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 size={14} className="animate-spin" /> Checking your invite…
      </div>
    );
  }

  if (inviteError || !invite) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-discrepancy)]">
        <XCircle size={16} />
        This invite link is invalid, already used, or has expired. Ask your manager to resend it.
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (password !== confirm) {
          setError("Passwords don't match");
          return;
        }
        if (password.length < 8) {
          setError("Password must be at least 8 characters");
          return;
        }
        accept.mutate();
      }}
    >
      <div className="flex items-center gap-2 rounded-lg bg-[var(--color-match-bg)] px-3 py-2 text-sm" style={{ color: "var(--color-match)" }}>
        <CheckCircle2 size={16} />
        Invite valid for {invite.name} &lt;{invite.email}&gt;
      </div>

      <label className="block text-sm">
        Set a password
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
      </label>

      <label className="block text-sm">
        Confirm password
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
      </label>

      <button
        type="submit"
        disabled={accept.isPending}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        style={{ backgroundColor: "var(--color-accent)" }}
      >
        {accept.isPending && <Loader2 size={14} className="animate-spin" />}
        Set password &amp; sign in
      </button>
      {error && <p className="text-xs text-[var(--color-discrepancy)]">{error}</p>}
    </form>
  );
}
