export type MatchStatus = "ON_TRACK" | "PARTIALLY_ON_TRACK" | "OFF_TRACK";
export type Role = "intern" | "mentor" | "manager";

export interface User {
  id: number;
  github_login: string | null;
  email: string | null;
  name: string;
  avatar_url: string;
  role: Role | null;
  team_id: number | null;
  team_name: string | null;
  intern_count: number | null;
  employee_code: string | null;
  phone: string | null;
  designation: string | null;
  pending_invite: boolean | null;
}

export interface MentorInviteResult {
  mentor: User;
  invite_link: string;
  email_sent: boolean;
}

export interface InviteInfo {
  name: string;
  email: string;
}

export interface Team {
  id: number;
  name: string;
  manager_id: number;
  created_at: string;
}

export interface TeamWithMentors extends Team {
  mentors: User[];
}

export interface ManagerOverview {
  teams: TeamWithMentors[];
  unassigned_mentors: User[];
  summary: CohortSummary;
}

export interface AuthStatus {
  authenticated: boolean;
  user?: User;
  onboarding_complete?: boolean;
  intern_id?: number | null;
}

export interface Intern {
  id: number;
  user_id: number | null;
  name: string;
  team_name: string | null;
  mentor_id: number | null;
  mentor_name: string | null;
  github_username: string;
  repo: string | null;
  start_date: string;
}

export interface LearningPathTable {
  headers: string[];
  rows: string[][];
}

export interface LearningPath {
  id: number;
  intern_id: number;
  mentor_id: number | null;
  title: string;
  description: string;
  source_filename: string | null;
  has_file: boolean;
  extracted_table: LearningPathTable | null;
  period_start: string;
  period_end: string;
  created_at: string;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  files_changed: number;
  languages: string[];
}

export interface Evidence {
  id: number;
  intern_id: number;
  source: "pr" | "commit" | "mock";
  url: string;
  title: string;
  diff_stats: DiffStats;
  review_iterations: number;
  merged_at: string | null;
}

export interface SkillTag {
  id: number;
  skill_name: string;
  evidence_strength: number;
}

export interface MentorOverride {
  status: "CONFIRMED" | "OVERRIDDEN";
  note: string | null;
  mentor_name: string;
  decided_at: string;
}

export interface Verdict {
  id: number;
  learning_path_id: number;
  match_status: MatchStatus;
  confidence: number;
  ai_summary: string;
  reasoning: string;
  mentor_override: MentorOverride | null;
  created_at: string;
  source_mode: "nvidia" | "gemini" | "mock";
  skill_tags: SkillTag[];
  evidence: Evidence[];
  learning_path: LearningPath;
  intern_name: string;
  intern_id: number;
}

export interface TimelineEntry {
  learning_path: LearningPath;
  verdict: Verdict | null;
}

export type DemoLogin =
  | { kind: "email"; email: string; label: string; role: string }
  | { kind: "github"; github_login: string; label: string; role: string };

export type VerdictStreamEvent =
  | { type: "log"; message: string }
  | { type: "error"; message: string }
  | { type: "result"; verdict: Verdict };

export interface CohortSummary {
  total_interns: number;
  total_learning_paths: number;
  total_verdicts: number;
  on_track_count: number;
  partially_on_track_count: number;
  off_track_count: number;
  pending_review_count: number;
  on_track_ratio: number;
  avg_confidence: number;
}

export interface ServiceStatus {
  service: string;
  github_oauth_available: boolean;
  dev_login_enabled: boolean;
  ai_primary: "nvidia" | "gemini" | null;
  ai_backup: "gemini" | null;
  ai_mode: "live" | "mock";
}
