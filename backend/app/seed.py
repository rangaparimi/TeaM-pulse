"""Seed TeaM Pulse with demo mentors, interns, learning paths, and runs the
full evidence -> AI verdict pipeline so the app has data the moment you open
the frontend.

Run from backend/: `python -m app.seed` (add `--reset` to wipe first).

The manager and mentors are email/password accounts (that's the real auth
mechanism for those roles now — see routers/auth.py) all sharing the demo
password below; interns are GitHub-identity accounts with fake github_id
values ("seed:...") so they never collide with a real GitHub OAuth login.
Demo interns' repos are placeholders — evidence pulls automatically use the
synthetic mock generator (app/github_service.py) unless you point
DEMO_INTERNS at a repo/user you actually control and set GITHUB_TOKEN in .env.
"""

import argparse
import asyncio
from datetime import date, datetime

from app import github_service, llm_service, models, security
from app.config import get_settings
from app.database import Base, SessionLocal, engine

DEMO_PASSWORD = "changeme123"  # shared by every seeded mentor/manager account

DEMO_MANAGER = {
    "name": "Alex Rivera",
    "email": "alex.rivera@teampulse.dev",
    "employee_code": "MGR-001",
    "phone": "+1-555-0100",
    "designation": "Head of Engineering",
}

DEMO_MENTORS = [
    {
        "name": "Priya Singh",
        "email": "priya.singh@teampulse.dev",
        "employee_code": "MTR-001",
        "phone": "+1-555-0101",
        "designation": "Staff Engineer",
        "team_name": "Platform Engineering",
    },
    {
        "name": "Devon Okafor",
        "email": "devon.okafor@teampulse.dev",
        "employee_code": "MTR-002",
        "phone": "+1-555-0102",
        "designation": "Senior Data Engineer",
        "team_name": "Data & Analytics",
    },
]

DEMO_INTERNS = [
    {
        "github_id": "seed:asha-kumar",
        "github_login": "demo-asha",
        "name": "Asha Kumar",
        "mentor_email": "priya.singh@teampulse.dev",
        "repo": "octocat/Hello-World",
        "start_date": date(2026, 6, 1),
        "learning_paths": [
            {
                "title": "Sprint 1: Search & webhook reliability",
                "period_start": date(2026, 6, 1),
                "period_end": date(2026, 6, 14),
                "description": (
                    "Add pagination to the search endpoint, write integration tests "
                    "for the webhook handler, and improve validation error messaging."
                ),
            },
            {
                "title": "Sprint 2: Async processing & cache correctness",
                "period_start": date(2026, 6, 15),
                "period_end": date(2026, 6, 28),
                "description": (
                    "Build out the async job queue consumer, investigate and fix the "
                    "cache invalidation race condition, and refactor test fixtures "
                    "for reuse across the API layer."
                ),
            },
        ],
    },
    {
        "github_id": "seed:marcus-chen",
        "github_login": "demo-marcus",
        "name": "Marcus Chen",
        "mentor_email": "priya.singh@teampulse.dev",
        "repo": "octocat/Hello-World",
        "start_date": date(2026, 6, 1),
        "learning_paths": [
            {
                "title": "Sprint 1: Authentication hardening",
                "period_start": date(2026, 6, 1),
                "period_end": date(2026, 6, 14),
                "description": (
                    "Rebuild the authentication system with proper JWT handling, "
                    "prepare the service for multi-region deployment, and scope out "
                    "the new payment gateway integration."
                ),
            },
            {
                "title": "Sprint 2: Maintenance & CI",
                "period_start": date(2026, 6, 15),
                "period_end": date(2026, 6, 28),
                "description": (
                    "Light sprint — handle routine bug fixes and CI configuration "
                    "tweaks. No major new features planned."
                ),
            },
        ],
    },
    {
        "github_id": "seed:wei-zhang",
        "github_login": "demo-wei",
        "name": "Wei Zhang",
        "mentor_email": "devon.okafor@teampulse.dev",
        "repo": "octocat/Hello-World",
        "start_date": date(2026, 7, 1),
        "learning_paths": [
            {
                "title": "Sprint 1: Dashboard performance",
                "period_start": date(2026, 7, 1),
                "period_end": date(2026, 7, 14),
                "description": (
                    "Build a reusable chart component for the dashboard and "
                    "optimize the slow N+1 query causing performance issues on the "
                    "dashboard endpoint."
                ),
            },
            {
                "title": "Sprint 2: Rate limiting exploration",
                "period_start": date(2026, 7, 15),
                "period_end": date(2026, 7, 28),
                "description": (
                    "Investigate rate limiting middleware options as a proof of "
                    "concept — early exploration only, nothing production-ready "
                    "expected yet."
                ),
            },
        ],
    },
]


async def seed(reset: bool = False):
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    settings = get_settings()
    print(f"AI provider: {settings.ai_primary_label or 'mock (no NVIDIA/Gemini key configured)'}")

    db = SessionLocal()
    try:
        if db.query(models.User).count() > 0 and not reset:
            print("Database already has users — pass --reset to reseed from scratch.")
            return

        password_hash = security.hash_password(DEMO_PASSWORD)

        manager = models.User(
            name=DEMO_MANAGER["name"],
            email=DEMO_MANAGER["email"],
            employee_code=DEMO_MANAGER["employee_code"],
            phone=DEMO_MANAGER["phone"],
            designation=DEMO_MANAGER["designation"],
            password_hash=password_hash,
            avatar_url="",
            role="manager",
        )
        db.add(manager)
        db.flush()
        print(f"Created manager: {manager.name} <{manager.email}> (password: {DEMO_PASSWORD})")

        mentors_by_email = {}
        for m in DEMO_MENTORS:
            team = models.Team(name=m["team_name"], manager_id=manager.id)
            db.add(team)
            db.flush()

            mentor = models.User(
                name=m["name"],
                email=m["email"],
                employee_code=m["employee_code"],
                phone=m["phone"],
                designation=m["designation"],
                password_hash=password_hash,
                avatar_url="",
                role="mentor",
                team_id=team.id,
            )
            db.add(mentor)
            db.flush()
            mentors_by_email[m["email"]] = mentor
            print(f"Created mentor: {mentor.name} <{mentor.email}> (team: {team.name})")

        for intern_data in DEMO_INTERNS:
            learning_paths = intern_data.pop("learning_paths")
            mentor = mentors_by_email[intern_data.pop("mentor_email")]

            user = models.User(
                github_id=intern_data["github_id"],
                github_login=intern_data["github_login"],
                name=intern_data["name"],
                avatar_url="",
                role="intern",
            )
            db.add(user)
            db.flush()

            intern = models.Intern(
                user_id=user.id,
                name=intern_data["name"],
                mentor_id=mentor.id,
                start_date=intern_data["start_date"],
                github_username=intern_data["github_login"],
                repo=intern_data["repo"],
            )
            db.add(intern)
            db.flush()
            print(f"Created intern: {intern.name} -> mentor {mentor.name} (team: {mentor.team_name})")

            for lp_data in learning_paths:
                learning_path = models.LearningPath(
                    intern_id=intern.id,
                    mentor_id=mentor.id,
                    title=lp_data["title"],
                    description=lp_data["description"],
                    period_start=lp_data["period_start"],
                    period_end=lp_data["period_end"],
                )
                db.add(learning_path)
                db.flush()

                raw_evidence, mode = await github_service.pull_evidence(
                    intern.repo,
                    intern.github_username,
                    learning_path.period_start,
                    learning_path.period_end,
                    token=None,
                )
                evidence_rows = []
                for item in raw_evidence:
                    merged_at = None
                    if item.get("merged_at"):
                        merged_at = datetime.fromisoformat(
                            item["merged_at"].replace("Z", "+00:00")
                        ).replace(tzinfo=None)
                    row = models.Evidence(
                        intern_id=intern.id,
                        source=item["source"],
                        url=item["url"],
                        title=item["title"],
                        diff_stats=item["diff_stats"],
                        review_iterations=item["review_iterations"],
                        merged_at=merged_at,
                    )
                    db.add(row)
                    evidence_rows.append(row)
                db.flush()

                evidence_dicts = [
                    {
                        "source": e.source,
                        "url": e.url,
                        "title": e.title,
                        "diff_stats": e.diff_stats or {},
                        "review_iterations": e.review_iterations,
                        "merged_at": e.merged_at.isoformat() if e.merged_at else None,
                    }
                    for e in evidence_rows
                ]

                summary, verdict_data, provider = llm_service.generate_verdict(
                    learning_path.description, evidence_dicts
                )

                verdict = models.Verdict(
                    learning_path_id=learning_path.id,
                    match_status=verdict_data["match_status"],
                    confidence=float(verdict_data["confidence"]),
                    ai_summary=summary["summary"],
                    reasoning=verdict_data["reasoning"],
                    source_mode=provider,
                )
                verdict.evidence = evidence_rows
                db.add(verdict)
                db.flush()

                for tag in verdict_data.get("skill_tags", []):
                    db.add(
                        models.SkillTag(
                            verdict_id=verdict.id,
                            skill_name=tag["skill_name"],
                            evidence_strength=float(tag["evidence_strength"]),
                        )
                    )

                print(
                    f"  [{learning_path.period_start} - {learning_path.period_end}] "
                    f"{len(evidence_rows)} evidence ({mode}) -> {verdict.match_status} "
                    f"(confidence {verdict.confidence:.2f})"
                )

        db.commit()
        print("\nSeed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Drop and recreate all tables first")
    args = parser.parse_args()
    asyncio.run(seed(reset=args.reset))
