from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import deps, models, schemas, serializers
from app.database import get_db

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/mentors", response_model=list[schemas.UserOut])
def list_mentors(db: Session = Depends(get_db)):
    return db.query(models.User).filter(models.User.role == "mentor").all()


@router.post("/me/intern-profile", response_model=schemas.InternOut)
def complete_intern_onboarding(
    payload: schemas.InternOnboarding,
    db: Session = Depends(get_db),
    user: models.User = Depends(deps.require_intern),
):
    intern = db.query(models.Intern).filter(models.Intern.user_id == user.id).first()
    if not intern:
        raise HTTPException(status_code=404, detail="Intern profile not found")

    if payload.mentor_id is not None:
        mentor = db.get(models.User, payload.mentor_id)
        if not mentor or mentor.role != "mentor":
            raise HTTPException(status_code=400, detail="Invalid mentor_id")

    intern.mentor_id = payload.mentor_id
    intern.repo = payload.repo.strip()
    db.commit()
    db.refresh(intern)
    return serializers.intern_out(intern)
