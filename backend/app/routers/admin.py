"""Manager-only admin actions: invite mentors by email, create teams,
assign mentors into them, and promote a user to manager. Promotion is
deliberately not self-service — a manager account can only come from
another manager promoting someone, or from seed data bootstrapping the
first one.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import deps, email_service, models, schemas
from app.config import get_settings
from app.database import get_db
from app.routers.auth import generate_invite_token
from app.routers.dashboard import compute_cohort_summary

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/mentors", response_model=schemas.MentorInviteOut)
def create_mentor(
    payload: schemas.MentorCreate, db: Session = Depends(get_db), manager: models.User = Depends(deps.require_manager)
):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="A user with that email already exists")

    if payload.team_id is not None:
        team = db.get(models.Team, payload.team_id)
        if not team or team.manager_id != manager.id:
            raise HTTPException(status_code=403, detail="You don't own this team")

    token, expires_at = generate_invite_token()
    mentor = models.User(
        name=payload.name.strip(),
        email=payload.email.strip().lower(),
        employee_code=payload.employee_code.strip(),
        phone=payload.phone.strip(),
        designation=payload.designation.strip(),
        team_id=payload.team_id,
        role="mentor",
        invite_token=token,
        invite_token_expires_at=expires_at,
    )
    db.add(mentor)
    db.commit()
    db.refresh(mentor)

    settings = get_settings()
    invite_link = f"{settings.frontend_url}/invite/{token}"
    email_sent = email_service.send_mentor_invite(mentor.email, mentor.name, invite_link)

    return schemas.MentorInviteOut(mentor=mentor, invite_link=invite_link, email_sent=email_sent)


@router.post("/teams", response_model=schemas.TeamOut)
def create_team(payload: schemas.TeamCreate, db: Session = Depends(get_db), manager: models.User = Depends(deps.require_manager)):
    team = models.Team(name=payload.name.strip(), manager_id=manager.id)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.get("/teams", response_model=list[schemas.TeamWithMentors])
def list_teams(db: Session = Depends(get_db), manager: models.User = Depends(deps.require_manager)):
    return db.query(models.Team).filter(models.Team.manager_id == manager.id).all()


@router.get("/mentors", response_model=list[schemas.UserOut])
def list_all_mentors(db: Session = Depends(get_db), manager: models.User = Depends(deps.require_manager)):
    return db.query(models.User).filter(models.User.role == "mentor").all()


@router.post("/mentors/{user_id}/team", response_model=schemas.UserOut)
def assign_mentor_team(
    user_id: int,
    payload: schemas.AssignMentorTeam,
    db: Session = Depends(get_db),
    manager: models.User = Depends(deps.require_manager),
):
    mentor = db.get(models.User, user_id)
    if not mentor or mentor.role != "mentor":
        raise HTTPException(status_code=404, detail="Mentor not found")

    if payload.team_id is not None:
        team = db.get(models.Team, payload.team_id)
        if not team or team.manager_id != manager.id:
            raise HTTPException(status_code=403, detail="You don't own this team")

    mentor.team_id = payload.team_id
    db.commit()
    db.refresh(mentor)
    return mentor


@router.post("/users/{user_id}/promote", response_model=schemas.UserOut)
def promote_to_manager(user_id: int, db: Session = Depends(get_db), manager: models.User = Depends(deps.require_manager)):
    target = db.get(models.User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role == "manager":
        raise HTTPException(status_code=400, detail="Already a manager")

    target.role = "manager"
    target.team_id = None
    db.commit()
    db.refresh(target)
    return target


@router.get("/overview", response_model=schemas.ManagerOverview)
def manager_overview(db: Session = Depends(get_db), manager: models.User = Depends(deps.require_manager)):
    teams = db.query(models.Team).filter(models.Team.manager_id == manager.id).all()
    team_mentor_ids = [m.id for t in teams for m in t.mentors]

    unassigned_mentors = (
        db.query(models.User)
        .filter(models.User.role == "mentor", models.User.team_id.is_(None))
        .all()
    )

    intern_ids = (
        [i.id for i in db.query(models.Intern).filter(models.Intern.mentor_id.in_(team_mentor_ids)).all()]
        if team_mentor_ids
        else []
    )

    return schemas.ManagerOverview(
        teams=teams,
        unassigned_mentors=unassigned_mentors,
        summary=compute_cohort_summary(intern_ids, db),
    )
