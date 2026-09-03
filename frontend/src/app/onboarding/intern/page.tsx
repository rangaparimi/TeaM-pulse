"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Rocket } from "lucide-react";
import { api } from "@/lib/api";
import { RequireAuth } from "@/components/AuthGate";

function InternOnboardingForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: mentors } = useQuery({ queryKey: ["mentors"], queryFn: api.listMentors });

  const [mentorId, setMentorId] = useState<string>("");
  const [repo, setRepo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const complete = useMutation({
    mutationFn: () =>
      api.completeInternOnboarding({
        mentor_id: mentorId ? Number(mentorId) : null,
        repo,
      }),
    onSuccess: async (intern) => {
      await queryClient.invalidateQueries({ queryKey: ["auth-status"] });
      router.replace(`/intern/${intern.id}`);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong"),
  });

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-semibold">Set up your profile</h1>
      <p className="mt-2 text-sm text-muted">
        Connect the repo you&apos;re working on — TeaM Pulse pulls PR and commit evidence from it to
        compare against whatever learning path your mentor assigns.
      </p>

      <form
        className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          complete.mutate();
        }}
      >
        <label className="block text-sm">
          Mentor
          <select
            value={mentorId}
            onChange={(e) => setMentorId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          >
            <option value="">Unassigned (pick later)</option>
            {mentors?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.team_name ? ` — ${m.team_name}` : ""}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            Your team will automatically match your mentor&apos;s team.
          </span>
        </label>

        <label className="block text-sm">
          Repo you&apos;re working on
          <input
            required
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="owner/repo"
            className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <span className="mt-1 block text-xs text-muted">
            e.g. <code>your-org/your-project</code>. You can change this later.
          </span>
        </label>

        <button
          type="submit"
          disabled={complete.isPending}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          {complete.isPending ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
          Finish setup
        </button>
        {error && <p className="text-xs text-[var(--color-discrepancy)]">{error}</p>}
      </form>
    </div>
  );
}

export default function InternOnboardingPage() {
  return (
    <RequireAuth>
      <InternOnboardingForm />
    </RequireAuth>
  );
}
