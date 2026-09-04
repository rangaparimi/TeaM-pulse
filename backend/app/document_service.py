"""Turns an uploaded learning-path document (text, Excel, PDF, or image)
into a plain-language description + optional structured table, so a mentor
can hand over a syllabus/curriculum file instead of typing a description.

Two-stage approach:
  1. Get raw text out of the file, deterministically wherever possible:
     - .txt/.md: decoded directly.
     - .xlsx/.xls: cell contents via openpyxl, no AI involved.
     - .pdf: text layer via pypdf, if the PDF has one (not scanned).
  2. Structure that raw text into {summary, table} using the same
     NVIDIA -> Gemini -> mock chain as llm_service (this is a text-only
     reformatting task, so NVIDIA handles it fine as primary).

True OCR — images, or a PDF with no extractable text layer (i.e. scanned
pages) — skips straight to Gemini's vision input, since the NVIDIA model
configured here is text-only. If Gemini isn't configured, this degrades to
a clearly-labeled mock result rather than failing outright, consistent with
the rest of the app's fallback philosophy.
"""

import io
import logging
from dataclasses import dataclass
from typing import Any

from app.config import get_settings
from app.llm_service import _extract_json

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
SUPPORTED_EXTENSIONS = {"txt", "md", "xlsx", "xls", "pdf", "png", "jpg", "jpeg", "webp"}

STRUCTURE_SCHEMA_HINT = (
    '{"summary": "2-4 sentence plain-language learning goal description, '
    'grounded strictly in the document content", '
    '"table": {"headers": ["string", "..."], "rows": [["string", "..."], "..."]} or null '
    'if the content has no clear tabular/list structure}'
)


@dataclass
class ExtractResult:
    summary: str
    table: dict[str, Any] | None
    source_mode: str  # "direct" | "nvidia" | "gemini" | "mock"


class UnsupportedFileType(ValueError):
    pass


def extension_of(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _read_text_file(data: bytes) -> str:
    return data.decode("utf-8", errors="ignore")


def _read_excel(data: bytes) -> str:
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    lines = []
    for sheet in wb.worksheets:
        lines.append(f"# Sheet: {sheet.title}")
        for row in sheet.iter_rows(values_only=True):
            cells = [str(c) for c in row if c is not None]
            if cells:
                lines.append(" | ".join(cells))
    return "\n".join(lines)


def _read_pdf_text_layer(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def _structure_text(raw_text: str) -> tuple[dict[str, Any], str]:
    """Reformats already-extracted raw text into {summary, table} using the
    NVIDIA -> Gemini -> mock chain. Returns (result_dict, provider)."""
    from app import llm_service

    prompt = (
        "The following is raw content extracted from a learning-plan document "
        "(a syllabus, curriculum outline, or task list for a software "
        "engineering intern). Reformat it into a plain-language summary "
        "suitable as a learning goal an intern will be evaluated against, and "
        "extract any tabular/list structure (topics, milestones, deadlines, "
        "skills) into a table if present.\n\n"
        f"Content:\n{raw_text[:12000]}\n\n"
        + llm_service.JSON_ONLY_INSTRUCTION.format(schema=STRUCTURE_SCHEMA_HINT)
    )

    for name, is_enabled, complete_fn in llm_service._PROVIDERS:
        settings = get_settings()
        if not is_enabled(settings):
            continue
        try:
            return complete_fn(prompt), name
        except Exception as exc:
            logger.warning("Document structuring via '%s' failed, falling back: %s", name, exc)
            continue

    # Mock: no AI provider available — still usable, just unstructured.
    trimmed = raw_text.strip().replace("\n", " ")
    summary = f"[MOCK] Extracted document content (no AI provider configured): {trimmed[:280]}"
    return {"summary": summary, "table": None}, "mock"


def _gemini_vision_extract(data: bytes, mime_type: str) -> tuple[dict[str, Any], str]:
    settings = get_settings()
    if not settings.gemini_enabled:
        return (
            {
                "summary": (
                    "[MOCK] This file needs OCR (it's an image or a scanned PDF with no "
                    "text layer), which requires GEMINI_API_KEY to be configured — add it "
                    "to .env, or upload a text-based file (.txt, .xlsx, or a PDF with a "
                    "text layer) instead."
                ),
                "table": None,
            },
            "mock",
        )

    from google import genai
    from google.genai import types

    prompt = (
        "This file contains a learning plan or curriculum for a software "
        "engineering intern. Read all the text (perform OCR if it's a scanned "
        "document or image), then produce a plain-language summary suitable as "
        "a learning goal an intern will be evaluated against, and extract any "
        "tabular/list structure (topics, milestones, deadlines, skills) into a "
        "table if present.\n\n" + f"Respond with ONLY a JSON object matching this shape:\n{STRUCTURE_SCHEMA_HINT}"
    )

    client = genai.Client(api_key=settings.gemini_api_key)
    resp = client.models.generate_content(
        model=settings.gemini_model,
        contents=[types.Part.from_bytes(data=data, mime_type=mime_type), prompt],
        config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.2),
    )
    return _extract_json(resp.text or ""), "gemini"


MIME_TYPES = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "txt": "text/plain",
    "md": "text/markdown",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xls": "application/vnd.ms-excel",
}


async def extract_from_file(data: bytes, filename: str) -> ExtractResult:
    ext = extension_of(filename)
    if ext not in SUPPORTED_EXTENSIONS:
        raise UnsupportedFileType(ext)

    if ext in ("txt", "md"):
        raw_text = _read_text_file(data)
        result, provider = _structure_text(raw_text)
        return ExtractResult(summary=result["summary"], table=result.get("table"), source_mode=provider)

    if ext in ("xlsx", "xls"):
        raw_text = _read_excel(data)
        result, provider = _structure_text(raw_text)
        return ExtractResult(summary=result["summary"], table=result.get("table"), source_mode=provider)

    if ext == "pdf":
        raw_text = ""
        try:
            raw_text = _read_pdf_text_layer(data)
        except Exception as exc:
            logger.warning("PDF text-layer extraction failed: %s", exc)

        if len(raw_text.strip()) > 50:
            result, provider = _structure_text(raw_text)
        else:
            # No usable text layer — likely a scanned PDF. Needs real OCR.
            result, provider = _gemini_vision_extract(data, MIME_TYPES["pdf"])
        return ExtractResult(summary=result["summary"], table=result.get("table"), source_mode=provider)

    # Images always need real OCR.
    result, provider = _gemini_vision_extract(data, MIME_TYPES[ext])
    return ExtractResult(summary=result["summary"], table=result.get("table"), source_mode=provider)
