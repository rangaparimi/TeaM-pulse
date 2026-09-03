"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import type { Role } from "@/lib/types";

function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-muted">
      <Loader2 size={14} className="animate-spin" /> Loading…
    </div>
  );
}

function homeFor(role: Role | null | undefined, internId: number | null | undefined) {
  if (role === "manager") return "/manager";
  if (role === "mentor") return "/mentor";
  if (role === "intern" && internId) return `/intern/${internId}`;
  return "/";
}

/** Guards a fully-onboarded app page. Redirects to landing if not logged
 * in, into onboarding if an intern hasn't connected a repo yet (the only
 * "incomplete" state possible — role is always assigned at signup/invite
 * time now), or to the user's own home if they're the wrong role for this
 * page. */
export function AuthGate({ role, children }: { role?: Role; children: React.ReactNode }) {
  const router = useRouter();
  const { data, isLoading } = useAuth();

  const ready =
    !isLoading && !!data?.authenticated && !!data.onboarding_complete && (!role || data.user?.role === role);

  useEffect(() => {
    if (isLoading) return;
    if (!data?.authenticated) {
      router.replace("/");
      return;
    }
    if (!data.onboarding_complete) {
      router.replace("/onboarding/intern");
      return;
    }
    if (role && data.user?.role !== role) {
      router.replace(homeFor(data.user?.role, data.intern_id));
    }
  }, [isLoading, data, role, router]);

  if (!ready) return <Loading />;
  return <>{children}</>;
}

/** Guards an onboarding step: just needs to be logged in. If onboarding is
 * already complete, bounces to the user's real home instead of re-onboarding. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!data?.authenticated) {
      router.replace("/");
      return;
    }
    if (data.onboarding_complete) {
      router.replace(homeFor(data.user?.role, data.intern_id));
    }
  }, [isLoading, data, router]);

  if (isLoading || !data?.authenticated || data.onboarding_complete) return <Loading />;
  return <>{children}</>;
}
