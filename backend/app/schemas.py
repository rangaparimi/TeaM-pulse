from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    github_login: Optional[str] = None
    email: Optional[str] = None
    name: str
    avatar_url: str
    role: Optional[str] = None
    team_id: Optional[int] = None
    team_name: Optional[str] = None
    intern_count: Optional[int] = None
    employee_code: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    pending_invite: Optional[bool] = None


class MentorCreate(BaseModel):
    name: str
    email: str
    employee_code: str
    phone: str
    designation: str
    team_id: Optional[int] = None


class MentorInviteOut(BaseModel):
    mentor: UserOut
    invite_link: str
    email_sent: bool


class InviteInfo(BaseModel):
    name: str
    email: str


class AcceptInvite(BaseModel):
    password: str = Field(min_length=8)


class EmailLogin(BaseModel):
    email: str
    password: str


class InternOnboarding(BaseModel):
    mentor_id: Optional[int] = None
    repo: str


class InternUpdate(BaseModel):
    mentor_id: Optional[int] = None
    repo: Optional[str] = None


class InternOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    name: str
    team_name: Optional[str] = None
    mentor_id: Optional[int] = None
    mentor_name: Optional[str] = None
    github_username: str
    repo: Optional[str] = None
    start_date: date


class TeamCreate(BaseModel):
    name: str


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    manager_id: int
    created_at: datetime


class TeamWithMentors(TeamOut):
    mentors: list[UserOut] = []


class AssignMentorTeam(BaseModel):
    team_id: Optional[int] = Field(description="null removes the mentor from any team")


class LearningPathCreate(BaseModel):
    intern_id: int
    title: str
    description: str
    period_start: date
    period_end: date


class LearningPathTable(BaseModel):
    headers: list[str]
    rows: list[list[str]]


class LearningPathOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    intern_id: int
    mentor_id: Optional[int] = None
    title: str
    description: str
    source_filename: Optional[str] = None
    extracted_table: Optional[LearningPathTable] = None
    period_start: date
    period_end: date
    created_at: datetime


class EvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    intern_id: int
    source: str
    url: str
    title: str
    diff_stats: dict
    review_iterations: int
    merged_at: Optional[datetime] = None


class EvidencePullRequest(BaseModel):
    intern_id: int
    period_start: date
    period_end: date


class SkillTagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    skill_name: str
    evidence_strength: float


class MentorDecision(BaseModel):
    status: str = Field(description="CONFIRMED or OVERRIDDEN")
    note: Optional[str] = None
    overridden_match_status: Optional[str] = None


class VerdictOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    learning_path_id: int
    match_status: str
    confidence: float
    ai_summary: str
    reasoning: str
    mentor_override: Optional[dict] = None
    created_at: datetime
    source_mode: str
    skill_tags: list[SkillTagOut] = []
    evidence: list[EvidenceOut] = []
    learning_path: LearningPathOut
    intern_name: str
    intern_id: int


class GenerateVerdictRequest(BaseModel):
    learning_path_id: int


class CohortSummary(BaseModel):
    total_interns: int
    total_learning_paths: int
    total_verdicts: int
    on_track_count: int
    partially_on_track_count: int
    off_track_count: int
    pending_review_count: int
    on_track_ratio: float
    avg_confidence: float


class InternTimelineEntry(BaseModel):
    learning_path: LearningPathOut
    verdict: Optional[VerdictOut] = None


class ManagerOverview(BaseModel):
    teams: list[TeamWithMentors]
    unassigned_mentors: list[UserOut]
    summary: CohortSummary
