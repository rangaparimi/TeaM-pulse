from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import deps, models, schemas
from app.config import get_settings
from app.database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def compute_cohort_summary(intern_ids: list[int], db: Session) -> schemas.CohortSummary:
    settings = get_settings()

    total_paths = (
        db.query(models.LearningPath).filter(models.LearningPath.intern_id.in_(intern_ids)).count()
        if intern_ids
        else 0
    )
    verdicts = (
        db.query(models.Verdict)
        .join(models.LearningPath)
        .filter(models.LearningPath.intern_id.in_(intern_ids))
        .all()
        if intern_ids
        else []
    )

    total_verdicts = len(verdicts)
    on_track = sum(1 for v in verdicts if v.match_status == "ON_TRACK")
    partial = sum(1 for v in verdicts if v.match_status == "PARTIALLY_ON_TRACK")
    off_track = sum(1 for v in verdicts if v.match_status == "OFF_TRACK")
    pending = sum(
        1
        for v in verdicts
        if v.mentor_override is None and (v.confidence < settings.confidence_threshold or v.match_status == "OFF_TRACK")
    )
    avg_confidence = sum(v.confidence for v in verdicts) / total_verdicts if total_verdicts else 0.0
    on_track_ratio = (on_track + partial) / total_verdicts if total_verdicts else 0.0

    return schemas.CohortSummary(
        total_interns=len(intern_ids),
        total_learning_paths=total_paths,
        total_verdicts=total_verdicts,
        on_track_count=on_track,
        partially_on_track_count=partial,
        off_track_count=off_track,
        pending_review_count=pending,
        on_track_ratio=round(on_track_ratio, 3),
        avg_confidence=round(avg_confidence, 3),
    )


@router.get("/cohort-summary", response_model=schemas.CohortSummary)
def cohort_summary(db: Session = Depends(get_db), mentor: models.User = Depends(deps.require_mentor)):
    intern_ids = [i.id for i in db.query(models.Intern).filter(models.Intern.mentor_id == mentor.id).all()]
    return compute_cohort_summary(intern_ids, db)


@router.get("/intern/{intern_id}/timeline", response_model=list[schemas.InternTimelineEntry])
def intern_timeline(
    intern_id: int, db: Session = Depends(get_db), user: models.User = Depends(deps.get_current_user)
):
    intern = db.get(models.Intern, intern_id)
    if not intern:
        raise HTTPException(status_code=404, detail="Intern not found")
    deps.ensure_can_access_intern(user, intern)

    learning_paths = (
        db.query(models.LearningPath)
        .filter(models.LearningPath.intern_id == intern_id)
        .order_by(models.LearningPath.period_start)
        .all()
    )
    return [schemas.InternTimelineEntry(learning_path=lp, verdict=lp.verdict) for lp in learning_paths]
