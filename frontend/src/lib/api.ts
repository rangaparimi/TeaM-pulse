import type {
  AuthStatus,
  CohortSummary,
  Intern,
  InviteInfo,
  LearningPath,
  ManagerOverview,
  MentorInviteResult,
  ServiceStatus,
  Team,
  TeamWithMentors,
  TimelineEntry,
  User,
  Verdict,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      // Let the browser set its own multipart boundary for FormData bodies.
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${init?.method ?? "GET"} ${path} failed (${res.status}): ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  status: () => request<ServiceStatus>("/"),

  authStatus: () => request<AuthStatus>("/auth/me/status"),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  emailLogin: (email: string, password: string) =>
    request<User>("/auth/email/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  getInvite: (token: string) => request<InviteInfo>(`/auth/invite/${token}`),
  acceptInvite: (token: string, password: string) =>
    request<User>(`/auth/invite/${token}/accept`, { method: "POST", body: JSON.stringify({ password }) }),

  listMentors: () => request<User[]>("/users/mentors"),
  completeInternOnboarding: (payload: { mentor_id: number | null; repo: string }) =>
    request<Intern>("/users/me/intern-profile", { method: "POST", body: JSON.stringify(payload) }),

  listInterns: () => request<Intern[]>("/interns"),
  getIntern: (id: number) => request<Intern>(`/interns/${id}`),
  updateIntern: (id: number, payload: { mentor_id?: number; repo?: string }) =>
    request<Intern>(`/interns/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  // Manager/admin
  createMentor: (payload: {
    name: string;
    email: string;
    employee_code: string;
    phone: string;
    designation: string;
    team_id?: number | null;
  }) => request<MentorInviteResult>("/admin/mentors", { method: "POST", body: JSON.stringify(payload) }),
  listTeams: () => request<TeamWithMentors[]>("/admin/teams"),
  createTeam: (name: string) => request<Team>("/admin/teams", { method: "POST", body: JSON.stringify({ name }) }),
  listAllMentors: () => request<User[]>("/admin/mentors"),
  assignMentorTeam: (userId: number, teamId: number | null) =>
    request<User>(`/admin/mentors/${userId}/team`, { method: "POST", body: JSON.stringify({ team_id: teamId }) }),
  promoteToManager: (userId: number) => request<User>(`/admin/users/${userId}/promote`, { method: "POST" }),
  managerOverview: () => request<ManagerOverview>("/admin/overview"),

  listLearningPaths: (internId: number) =>
    request<LearningPath[]>(`/learning-paths?intern_id=${internId}`),
  createLearningPath: (payload: {
    intern_id: number;
    title: string;
    description: string;
    period_start: string;
    period_end: string;
  }) => request<LearningPath>("/learning-paths", { method: "POST", body: JSON.stringify(payload) }),

  createLearningPathFromFile: (payload: {
    intern_id: number;
    title: string;
    period_start: string;
    period_end: string;
    file: File;
  }) => {
    const form = new FormData();
    form.append("intern_id", String(payload.intern_id));
    form.append("title", payload.title);
    form.append("period_start", payload.period_start);
    form.append("period_end", payload.period_end);
    form.append("file", payload.file);
    return request<LearningPath>("/learning-paths/from-file", { method: "POST", body: form });
  },

  generateVerdict: (learningPathId: number) =>
    request<Verdict>("/verdicts/generate", {
      method: "POST",
      body: JSON.stringify({ learning_path_id: learningPathId }),
    }),

  listVerdicts: (internId?: number) =>
    request<Verdict[]>(`/verdicts${internId ? `?intern_id=${internId}` : ""}`),

  reviewQueue: (threshold?: number) =>
    request<Verdict[]>(`/verdicts/queue${threshold ? `?threshold=${threshold}` : ""}`),

  decideVerdict: (
    verdictId: number,
    payload: { status: "CONFIRMED" | "OVERRIDDEN"; note?: string; overridden_match_status?: string }
  ) =>
    request<Verdict>(`/verdicts/${verdictId}/decision`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  cohortSummary: () => request<CohortSummary>("/dashboard/cohort-summary"),

  internTimeline: (internId: number) =>
    request<TimelineEntry[]>(`/dashboard/intern/${internId}/timeline`),
};
