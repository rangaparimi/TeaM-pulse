from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import deps, github_service, models, schemas
from app.database import get_db

router = APIRouter(prefix="/evidence", tags=["evidence"])


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)


@router.post("/pull", response_model=list[schemas.EvidenceOut])
async def pull_evidence(
    payload: schemas.EvidencePullRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(deps.get_current_user),
):
    intern = db.get(models.Intern, payload.intern_id)
    if not intern:
        raise HTTPException(status_code=404, detail="Intern not found")
    deps.ensure_can_access_intern(user, intern)
    if not intern.repo:
        raise HTTPException(status_code=400, detail="This intern hasn't connected a repo yet")

    token = deps.resolve_github_token(intern, db)
    raw_evidence, mode = await github_service.pull_evidence(
        intern.repo, intern.github_username, payload.period_start, payload.period_end, token
    )

    stored = []
    for item in raw_evidence:
        evidence = models.Evidence(
            intern_id=intern.id,
            source=item["source"],
            url=item["url"],
            title=item["title"],
            diff_stats=item["diff_stats"],
            review_iterations=item["review_iterations"],
            merged_at=_parse_dt(item.get("merged_at")),
        )
        db.add(evidence)
        stored.append(evidence)

    db.commit()
    for e in stored:
        db.refresh(e)
    return stored


@router.get("", response_model=list[schemas.EvidenceOut])
def list_evidence(intern_id: int, db: Session = Depends(get_db), user: models.User = Depends(deps.get_current_user)):
    intern = db.get(models.Intern, intern_id)
    if not intern:
        raise HTTPException(status_code=404, detail="Intern not found")
    deps.ensure_can_access_intern(user, intern)
    return (
        db.query(models.Evidence)
        .filter(models.Evidence.intern_id == intern_id)
        .order_by(models.Evidence.merged_at)
        .all()
    )
