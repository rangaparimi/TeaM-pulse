"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export function useAuth() {
  return useQuery({
    queryKey: ["auth-status"],
    queryFn: api.authStatus,
    retry: false,
    // Interns have a short session timeout (backend-enforced) — poll so an
    // idle tab notices it expired and AuthGate bounces to the login page
    // within about a minute, instead of only on the next manual action.
    refetchInterval: 60_000,
  });
}
