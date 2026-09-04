from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app import deps, document_service, models, schemas
from app.database import get_db

router = APIRouter(prefix="/learning-paths", tags=["learning-paths"])


def _ensure_is_mentor_of(mentor: models.User, intern_id: int, db: Session) -> models.Intern:
    intern = db.get(models.Intern, intern_id)
    if not intern:
        raise HTTPException(status_code=404, detail="Intern not found")
    if intern.mentor_id != mentor.id:
        raise HTTPException(status_code=403, detail="You are not this intern's mentor")
    return intern


@router.post("", response_model=schemas.LearningPathOut)
def create_learning_path(
    payload: schemas.LearningPathCreate,
    db: Session = Depends(get_db),
    mentor: models.User = Depends(deps.require_mentor),
):
    _ensure_is_mentor_of(mentor, payload.intern_id, db)

    learning_path = models.LearningPath(
        intern_id=payload.intern_id,
        mentor_id=mentor.id,
        title=payload.title,
        description=payload.description,
        period_start=payload.period_start,
        period_end=payload.period_end,
    )
    db.add(learning_path)
    db.commit()
    db.refresh(learning_path)
    return learning_path


@router.post("/from-file", response_model=schemas.LearningPathOut)
async def create_learning_path_from_file(
    intern_id: int = Form(...),
    title: str = Form(...),
    period_start: date = Form(...),
    period_end: date = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(deps.get_current_user),
):
    """Same as POST /learning-paths, but the description is distilled from
    an uploaded Excel/PDF/image/text file instead of being typed directly —
    see document_service.extract_from_file for how each format is handled.

    Unlike the plain-text endpoint, a manager (not just the intern's direct
    mentor) may assign one too, as long as the intern is under one of their
    teams — ensure_can_access_intern() covers both cases. The intern
    themself is explicitly excluded: they can access their own record for
    read purposes, but assigning their own expectations would defeat the
    self-report-vs-evidence design.
    """
    intern = db.get(models.Intern, intern_id)
    if not intern:
        raise HTTPException(status_code=404, detail="Intern not found")
    deps.ensure_can_access_intern(user, intern)
    if user.role not in ("mentor", "manager"):
        raise HTTPException(status_code=403, detail="Only a mentor or manager can assign a learning path")

    ext = document_service.extension_of(file.filename or "")
    if ext not in document_service.SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{ext}'. Supported: {', '.join(sorted(document_service.SUPPORTED_EXTENSIONS))}",
        )

    data = await file.read()
    if len(data) > document_service.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    result = await document_service.extract_from_file(data, file.filename)

    learning_path = models.LearningPath(
        intern_id=intern_id,
        mentor_id=intern.mentor_id,
        title=title,
        description=result.summary,
        source_filename=file.filename,
        source_file=data,
        source_content_type=document_service.MIME_TYPES.get(ext, "application/octet-stream"),
        extracted_table=result.table,
        period_start=period_start,
        period_end=period_end,
    )
    db.add(learning_path)
    db.commit()
    db.refresh(learning_path)
    return learning_path


@router.get("", response_model=list[schemas.LearningPathOut])
def list_learning_paths(
    intern_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(deps.get_current_user),
):
    intern = db.get(models.Intern, intern_id)
    if not intern:
        raise HTTPException(status_code=404, detail="Intern not found")
    deps.ensure_can_access_intern(user, intern)

    return (
        db.query(models.LearningPath)
        .filter(models.LearningPath.intern_id == intern_id)
        .order_by(models.LearningPath.period_start)
        .all()
    )


@router.get("/{learning_path_id}", response_model=schemas.LearningPathOut)
def get_learning_path(
    learning_path_id: int, db: Session = Depends(get_db), user: models.User = Depends(deps.get_current_user)
):
    learning_path = db.get(models.LearningPath, learning_path_id)
    if not learning_path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    deps.ensure_can_access_intern(user, learning_path.intern)
    return learning_path


@router.get("/{learning_path_id}/file")
def get_learning_path_file(
    learning_path_id: int, db: Session = Depends(get_db), user: models.User = Depends(deps.get_current_user)
):
    """Serves the original uploaded file back, for the "preview" UI —
    inline so the browser renders images/PDFs/text directly instead of
    downloading them.
    """
    learning_path = db.get(models.LearningPath, learning_path_id)
    if not learning_path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    deps.ensure_can_access_intern(user, learning_path.intern)
    if not learning_path.source_file:
        raise HTTPException(status_code=404, detail="No file was uploaded for this learning path")

    return Response(
        content=learning_path.source_file,
        media_type=learning_path.source_content_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{learning_path.source_filename or "file"}"'},
    )
