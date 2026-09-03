import asyncio
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import deps, github_service, llm_service, models, schemas
from app.config import get_settings
from app.database import get_db

router = APIRouter(prefix="/verdicts", tags=["verdicts"])


def _evidence_to_dict(e: models.Evidence) -> dict:
    return {
        "source": e.source,
        "url": e.url,
        "title": e.title,
        "diff_stats": e.diff_stats or {},
        "review_iterations": e.review_iterations,
        "merged_at": e.merged_at.isoformat() if e.merged_at else None,
    }


@router.post("/generate", response_model=schemas.VerdictOut)
async def generate_verdict(
    payload: schemas.GenerateVerdictRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(deps.get_current_user),
):
    learning_path = db.get(models.LearningPath, payload.learning_path_id)
    if not learning_path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    intern = db.get(models.Intern, learning_path.intern_id)
    deps.ensure_can_access_intern(user, intern)
    if learning_path.verdict:
        raise HTTPException(status_code=400, detail="A progress summary already exists for this learning path")
    if not intern.repo:
        raise HTTPException(status_code=400, detail="This intern hasn't connected a repo yet")

    evidence_rows = (
        db.query(models.Evidence)
        .filter(
            models.Evidence.intern_id == intern.id,
            models.Evidence.merged_at >= datetime.combine(learning_path.period_start, datetime.min.time()),
            models.Evidence.merged_at <= datetime.combine(learning_path.period_end, datetime.max.time()),
        )
        .all()
    )

    if not evidence_rows:
        token = deps.resolve_github_token(intern, db)
        raw_evidence, _mode = await github_service.pull_evidence(
            intern.repo, intern.github_username, learning_path.period_start, learning_path.period_end, token
        )
        for item in raw_evidence:
            merged_at = None
            if item.get("merged_at"):
                merged_at = datetime.fromisoformat(item["merged_at"].replace("Z", "+00:00")).replace(tzinfo=None)
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
        db.commit()
        for row in evidence_rows:
            db.refresh(row)

    evidence_dicts = [_evidence_to_dict(e) for e in evidence_rows]

    summary, verdict_data, provider = await asyncio.to_thread(
        llm_service.generate_verdict, learning_path.description, evidence_dicts
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

    db.commit()
    db.refresh(verdict)
    return verdict


@router.get("", response_model=list[schemas.VerdictOut])
def list_verdicts(intern_id: int | None = None, db: Session = Depends(get_db), user: models.User = Depends(deps.get_current_user)):
    query = db.query(models.Verdict).join(models.LearningPath)
    if intern_id is not None:
        intern = db.get(models.Intern, intern_id)
        if not intern:
            raise HTTPException(status_code=404, detail="Intern not found")
        deps.ensure_can_access_intern(user, intern)
        query = query.filter(models.LearningPath.intern_id == intern_id)
    elif user.role == "mentor":
        query = query.join(models.Intern).filter(models.Intern.mentor_id == user.id)
    else:
        query = query.join(models.Intern).filter(models.Intern.user_id == user.id)
    return query.order_by(models.Verdict.created_at.desc()).all()


@router.get("/queue", response_model=list[schemas.VerdictOut])
def review_queue(
    threshold: float | None = None,
    db: Session = Depends(get_db),
    mentor: models.User = Depends(deps.require_mentor),
):
    settings = get_settings()
    limit = threshold if threshold is not None else settings.confidence_threshold
    verdicts = (
        db.query(models.Verdict)
        .join(models.LearningPath)
        .join(models.Intern)
        .filter(models.Intern.mentor_id == mentor.id)
        .filter(models.Verdict.mentor_override.is_(None))
        .filter(
            (models.Verdict.confidence < limit) | (models.Verdict.match_status == "OFF_TRACK")
        )
        .order_by(models.Verdict.confidence.asc())
        .all()
    )
    return verdicts


@router.get("/{verdict_id}", response_model=schemas.VerdictOut)
def get_verdict(verdict_id: int, db: Session = Depends(get_db), user: models.User = Depends(deps.get_current_user)):
    verdict = db.get(models.Verdict, verdict_id)
    if not verdict:
        raise HTTPException(status_code=404, detail="Verdict not found")
    deps.ensure_can_access_intern(user, verdict.learning_path.intern)
    return verdict


@router.post("/{verdict_id}/decision", response_model=schemas.VerdictOut)
def mentor_decision(
    verdict_id: int,
    payload: schemas.MentorDecision,
    db: Session = Depends(get_db),
    mentor: models.User = Depends(deps.require_mentor),
):
    verdict = db.get(models.Verdict, verdict_id)
    if not verdict:
        raise HTTPException(status_code=404, detail="Verdict not found")
    if verdict.learning_path.intern.mentor_id != mentor.id:
        raise HTTPException(status_code=403, detail="You are not this intern's mentor")

    verdict.mentor_override = {
        "status": payload.status,
        "note": payload.note,
        "mentor_name": mentor.name,
        "decided_at": datetime.utcnow().isoformat(),
    }
    if payload.status == "OVERRIDDEN" and payload.overridden_match_status:
        verdict.match_status = payload.overridden_match_status

    db.commit()
    db.refresh(verdict)
    return verdict
