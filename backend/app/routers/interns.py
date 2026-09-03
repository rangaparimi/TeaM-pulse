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
