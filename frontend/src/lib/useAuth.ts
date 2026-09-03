"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export function useAuth() {
  return useQuery({ queryKey: ["auth-status"], queryFn: api.authStatus, retry: false });
}
