"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/useAuth";

export default function DashboardRedirect() {
  const router = useRouter();
  const { data, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!data?.authenticated) {
      router.replace("/");
    } else if (!data.onboarding_complete) {
      router.replace("/onboarding/intern");
    } else if (data.user?.role === "manager") {
      router.replace("/manager");
    } else if (data.user?.role === "mentor") {
      router.replace("/mentor");
    } else if (data.intern_id) {
      router.replace(`/intern/${data.intern_id}`);
    }
  }, [isLoading, data, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-muted">
      <Loader2 size={14} className="animate-spin" /> Redirecting…
    </div>
  );
}
