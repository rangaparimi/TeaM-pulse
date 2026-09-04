from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import deps, models, schemas, serializers
from app.database import get_db

router = APIRouter(prefix="/interns", tags=["interns"])


@router.get("", response_model=list[schemas.InternOut])
def list_interns(db: Session = Depends(get_db), user: models.User = Depends(deps.get_current_user)):
    if user.role == "mentor":
        interns = db.query(models.Intern).filter(models.Intern.mentor_id == user.id).all()
    else:
        interns = db.query(models.Intern).filter(models.Intern.user_id == user.id).all()
    return [serializers.intern_out(i) for i in interns]


@router.get("/unassigned", response_model=list[schemas.InternOut])
def list_unassigned_interns(db: Session = Depends(get_db), mentor: models.User = Depends(deps.require_mentor)):
    """Interns with no mentor yet — either they picked "unassigned" during
    onboarding, or (dev-login shortcut) were created without one. Any
    mentor can see this pool and claim from it; ensure_can_access_intern()
    can't be reused for that check since it requires an existing mentor
    link, which is exactly what a still-unassigned intern doesn't have.
    """
    interns = db.query(models.Intern).filter(models.Intern.mentor_id.is_(None)).all()
    return [serializers.intern_out(i) for i in interns]


@router.post("/{intern_id}/claim", response_model=schemas.InternOut)
def claim_intern(intern_id: int, db: Session = Depends(get_db), mentor: models.User = Depends(deps.require_mentor)):
    intern = db.get(models.Intern, intern_id)
    if not intern:
        raise HTTPException(status_code=404, detail="Intern not found")
    if intern.mentor_id is not None:
        raise HTTPException(status_code=400, detail="This intern already has a mentor")

    intern.mentor_id = mentor.id
    db.commit()
    db.refresh(intern)
    return serializers.intern_out(intern)


@router.get("/{intern_id}", response_model=schemas.InternOut)
def get_intern(intern_id: int, db: Session = Depends(get_db), user: models.User = Depends(deps.get_current_user)):
    intern = db.get(models.Intern, intern_id)
    if not intern:
        raise HTTPException(status_code=404, detail="Intern not found")
    deps.ensure_can_access_intern(user, intern)
    return serializers.intern_out(intern)


@router.patch("/{intern_id}", response_model=schemas.InternOut)
def update_intern(
    intern_id: int,
    payload: schemas.InternUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(deps.get_current_user),
):
    intern = db.get(models.Intern, intern_id)
    if not intern:
        raise HTTPException(status_code=404, detail="Intern not found")
    deps.ensure_can_access_intern(user, intern)

    if payload.repo is not None:
        intern.repo = payload.repo.strip()
    if payload.mentor_id is not None:
        mentor = db.get(models.User, payload.mentor_id)
        if not mentor or mentor.role != "mentor":
            raise HTTPException(status_code=400, detail="Invalid mentor_id")
        intern.mentor_id = payload.mentor_id

    db.commit()
    db.refresh(intern)
    return serializers.intern_out(intern)
