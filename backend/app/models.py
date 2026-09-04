from datetime import datetime, date

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Text,
    Date,
    DateTime,
    ForeignKey,
    Table,
    JSON,
    LargeBinary,
)
from sqlalchemy.orm import relationship

from app.database import Base

verdict_evidence = Table(
    "verdict_evidence",
    Base.metadata,
    Column("verdict_id", Integer, ForeignKey("verdicts.id"), primary_key=True),
    Column("evidence_id", Integer, ForeignKey("evidence.id"), primary_key=True),
)


class Team(Base):
    """Created by a manager; mentors join one team. A manager's visibility
    (their own interns' cohort, aggregated) is everything under the mentors
    in the teams they own.
    """

    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    manager = relationship("User", foreign_keys=[manager_id])
    mentors = relationship("User", foreign_keys="User.team_id", back_populates="team")


class User(Base):
    """A logged-in person — any role, with one of two identity mechanisms:

    - Interns authenticate with GitHub OAuth (github_id/github_login set).
      First login auto-provisions role='intern' — GitHub is only ever used
      for interns, since they need a GitHub identity to connect a repo
      anyway.
    - Mentors (and, by promotion, managers) authenticate with email +
      password. A manager creates the record via POST /admin/mentors with
      email/employee_code/phone/designation; the mentor "registers" by
      following the emailed invite link to set their password
      (invite_token), after which it's a normal email+password login.
      'manager' is promotion-only (see routers/admin.py) — never a signup
      choice for either identity mechanism.
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    # GitHub identity (interns)
    github_id = Column(String, unique=True, nullable=True, index=True)
    github_login = Column(String, nullable=True)
    github_access_token = Column(String, nullable=True)  # this user's own OAuth token, used for their own evidence pulls

    # Email identity (mentors/managers)
    email = Column(String, unique=True, nullable=True, index=True)
    password_hash = Column(String, nullable=True)
    employee_code = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    designation = Column(String, nullable=True)
    invite_token = Column(String, unique=True, nullable=True, index=True)
    invite_token_expires_at = Column(DateTime, nullable=True)

    name = Column(String, nullable=False)
    avatar_url = Column(String, default="")
    role = Column(String, nullable=True)  # "intern" | "mentor" | "manager" | None until onboarding picks one
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # only meaningful for role="mentor"
    created_at = Column(DateTime, default=datetime.utcnow)

    intern_profile = relationship(
        "Intern", back_populates="user", uselist=False, cascade="all, delete-orphan", foreign_keys="Intern.user_id"
    )
    team = relationship("Team", foreign_keys=[team_id], back_populates="mentors")
    mentee_interns = relationship("Intern", foreign_keys="Intern.mentor_id", viewonly=True)

    @property
    def intern_count(self) -> int:
        return len(self.mentee_interns)

    @property
    def pending_invite(self) -> bool:
        return self.email is not None and self.password_hash is None

    @property
    def team_name(self) -> str | None:
        return self.team.name if self.team else None


class Intern(Base):
    """An intern's profile — one per User with role='intern'. Created
    during onboarding once that user picks the intern role. There's no
    team field here on purpose: an intern's "team" is whatever team their
    mentor belongs to (see serializers.intern_out) — teams are owned by
    mentors, not interns, in this hierarchy.
    """

    __tablename__ = "interns"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=True)  # null for seeded demo data
    name = Column(String, nullable=False)
    mentor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    start_date = Column(Date, default=date.today)
    github_username = Column(String, nullable=False)
    repo = Column(String, nullable=True)  # "owner/repo" — set during onboarding

    user = relationship("User", back_populates="intern_profile", foreign_keys=[user_id])
    mentor = relationship("User", foreign_keys=[mentor_id])
    learning_paths = relationship("LearningPath", back_populates="intern", cascade="all, delete-orphan")
    evidence = relationship("Evidence", back_populates="intern", cascade="all, delete-orphan")


class LearningPath(Base):
    """A mentor-authored learning goal for one intern over one period.
    Replaces the old self-report: instead of the intern claiming what they
    did, the mentor sets what they're expected to work on, and the AI
    compares that expectation against the repo evidence.

    `description` can come from either the mentor typing it directly, or
    from document_service.extract_from_file() distilling an uploaded
    Excel/PDF/image/text file into a plain-language summary — either way
    it's the text llm_service compares evidence against. `extracted_table`
    additionally holds a structured table when the source document had one
    (for display only; the AI comparison always uses `description`).
    """

    __tablename__ = "learning_paths"

    id = Column(Integer, primary_key=True, index=True)
    intern_id = Column(Integer, ForeignKey("interns.id"), nullable=False)
    mentor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    source_filename = Column(String, nullable=True)
    source_file = Column(LargeBinary, nullable=True)  # original uploaded bytes, for the "preview file" UI
    source_content_type = Column(String, nullable=True)
    extracted_table = Column(JSON, nullable=True)  # {"headers": [...], "rows": [[...], ...]}
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    intern = relationship("Intern", back_populates="learning_paths")
    mentor = relationship("User", foreign_keys=[mentor_id])
    verdict = relationship("Verdict", back_populates="learning_path", uselist=False, cascade="all, delete-orphan")

    @property
    def has_file(self) -> bool:
        return self.source_file is not None


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    intern_id = Column(Integer, ForeignKey("interns.id"), nullable=False)
    source = Column(String, nullable=False)  # "pr" | "commit" | "mock"
    url = Column(String, nullable=False)
    title = Column(String, nullable=False)
    diff_stats = Column(JSON, default=dict)  # {additions, deletions, files_changed, languages: []}
    review_iterations = Column(Integer, default=0)
    merged_at = Column(DateTime, nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow)

    intern = relationship("Intern", back_populates="evidence")


class Verdict(Base):
    __tablename__ = "verdicts"

    id = Column(Integer, primary_key=True, index=True)
    learning_path_id = Column(Integer, ForeignKey("learning_paths.id"), unique=True, nullable=False)
    match_status = Column(String, nullable=False)  # ON_TRACK | PARTIALLY_ON_TRACK | OFF_TRACK
    confidence = Column(Float, nullable=False)
    ai_summary = Column(Text, nullable=False)
    reasoning = Column(Text, nullable=False)
    mentor_override = Column(JSON, nullable=True)  # {status, note, mentor_name, decided_at}
    created_at = Column(DateTime, default=datetime.utcnow)
    source_mode = Column(String, default="mock")  # "nvidia" | "gemini" | "mock"

    learning_path = relationship("LearningPath", back_populates="verdict")
    evidence = relationship("Evidence", secondary=verdict_evidence)
    skill_tags = relationship("SkillTag", back_populates="verdict", cascade="all, delete-orphan")

    @property
    def intern_name(self) -> str:
        return self.learning_path.intern.name

    @property
    def intern_id(self) -> int:
        return self.learning_path.intern_id


class SkillTag(Base):
    __tablename__ = "skill_tags"

    id = Column(Integer, primary_key=True, index=True)
    verdict_id = Column(Integer, ForeignKey("verdicts.id"), nullable=False)
    skill_name = Column(String, nullable=False)
    evidence_strength = Column(Float, default=0.5)  # 0-1

    verdict = relationship("Verdict", back_populates="skill_tags")
