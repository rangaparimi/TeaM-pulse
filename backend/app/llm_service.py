"""The AI analysis layer — the core of TeaM Pulse.

Two calls per (learning path, evidence) pair, run against the same provider:
  (a) summarize_evidence   — plain-language summary of what the code shows,
      grounded only in the evidence passed in.
  (b) compare_to_plan      — structured verdict comparing that summary
      against the mentor-authored learning path (what the intern was
      expected to work on).

Provider chain, tried in order until one succeeds:
  1. NVIDIA NIM (primary)  — nvidia/nemotron-3-super-120b-a12b by default,
     a reasoning-tuned model. Chosen because this task is fundamentally a
     calibrated judgment task (compare two texts, emit a structured
     confidence + reasoning) rather than open-ended generation.
  2. Google Gemini (backup) — used only if NVIDIA is unconfigured or a call
     to it raises.
  3. Rule-based mock (last resort) — keeps the whole app (queues,
     dashboards) demoable with zero API keys configured.

Every verdict records which of the three actually produced it
(`source_mode`: "nvidia" | "gemini" | "mock") so the UI can be transparent
about provenance instead of implying a live judgment that didn't happen.
"""

import json
import logging
import re
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

SUMMARY_SCHEMA_HINT = (
    '{"summary": "2-4 sentence plain-language summary of what was actually '
    'built, grounded strictly in the evidence provided", '
    '"notable_skills": ["short skill/technique label", "..."]}'
)

VERDICT_SCHEMA_HINT = (
    '{"match_status": "ON_TRACK" | "PARTIALLY_ON_TRACK" | "OFF_TRACK", '
    '"confidence": 0.0-1.0, '
    '"reasoning": "concise, specific explanation citing what agrees or disagrees", '
    '"skill_tags": [{"skill_name": "string", "evidence_strength": 0.0-1.0}, "..."]}'
)

JSON_ONLY_INSTRUCTION = (
    "Respond with ONLY a single JSON object matching this exact shape — no "
    "markdown code fences, no prose before or after it:\n{schema}"
)


def _format_evidence(evidence_list: list[dict[str, Any]]) -> str:
    lines = []
    for e in evidence_list:
        stats = e.get("diff_stats", {}) or {}
        lines.append(
            f"- [{e.get('source', 'evidence')}] {e.get('title')} "
            f"(+{stats.get('additions', 0)}/-{stats.get('deletions', 0)} lines, "
            f"{stats.get('files_changed', 0)} files, "
            f"languages: {', '.join(stats.get('languages', []) or []) or 'n/a'}, "
            f"review iterations: {e.get('review_iterations', 0)}, "
            f"merged: {e.get('merged_at', 'n/a')}) — {e.get('url')}"
        )
    return "\n".join(lines) if lines else "(no evidence found for this period)"


def _summary_prompt(evidence_list: list[dict[str, Any]]) -> str:
    return (
        "You are reviewing raw GitHub evidence (PRs and commits) for one intern "
        "over one reporting period. Summarize, in plain language, what the "
        "evidence shows was actually built. Only claim what the evidence "
        "supports — do not speculate beyond it. Tag notable skills/techniques "
        "demonstrated.\n\n"
        f"Evidence:\n{_format_evidence(evidence_list)}\n\n"
        + JSON_ONLY_INSTRUCTION.format(schema=SUMMARY_SCHEMA_HINT)
    )


def _verdict_prompt(learning_path_text: str, evidence_summary: dict[str, Any]) -> str:
    return (
        "A mentor assigned an intern a learning path — goals/expectations for "
        "what they should work on this period. Compare what the code evidence "
        "actually shows against that assignment. Decide ON_TRACK if the "
        "evidence shows solid progress on the assigned goals, "
        "PARTIALLY_ON_TRACK if there's some relevant progress but it's "
        "incomplete, off-focus, or thin, or OFF_TRACK if the evidence shows "
        "little to no engagement with the assigned goals (or contradicts "
        "them). Be conservative with confidence when evidence is thin. Never "
        "make a claim about the intern's overall performance or ability — "
        "only compare the specific assignment to the specific evidence.\n\n"
        f"Assigned learning path:\n{learning_path_text}\n\n"
        f"Evidence-based summary of actual work:\n{evidence_summary.get('summary', '')}\n"
        f"Notable skills from evidence: {', '.join(evidence_summary.get('notable_skills', []))}\n\n"
        + JSON_ONLY_INSTRUCTION.format(schema=VERDICT_SCHEMA_HINT)
    )


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    fence_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1)
    else:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1 and end > start:
            text = text[start : end + 1]
    return json.loads(text)


# ---------------------------------------------------------------------------
# NVIDIA NIM (OpenAI-compatible)
# ---------------------------------------------------------------------------


def _nvidia_complete(prompt: str) -> dict[str, Any]:
    from openai import OpenAI

    settings = get_settings()
    client = OpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=settings.nvidia_api_key)
    resp = client.chat.completions.create(
        model=settings.nvidia_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=1024,
    )
    return _extract_json(resp.choices[0].message.content or "")


# ---------------------------------------------------------------------------
# Google Gemini
# ---------------------------------------------------------------------------


def _gemini_complete(prompt: str) -> dict[str, Any]:
    from google import genai
    from google.genai import types

    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)
    resp = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.2),
    )
    return _extract_json(resp.text or "")


# ---------------------------------------------------------------------------
# Rule-based mock fallback (no AI provider configured / all providers failed)
# ---------------------------------------------------------------------------

_STOPWORDS = {
    "the", "a", "an", "and", "to", "of", "in", "on", "for", "with", "this",
    "that", "i", "we", "was", "is", "are", "it", "my", "our", "as",
    "at", "be", "by", "week", "period",
}


def _tokenize(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-zA-Z]+", text.lower()) if w not in _STOPWORDS and len(w) > 2}


def _mock_summarize(evidence_list: list[dict[str, Any]]) -> dict[str, Any]:
    if not evidence_list:
        return {"summary": "No code evidence was found for this period.", "notable_skills": []}

    total_add = sum((e.get("diff_stats", {}) or {}).get("additions", 0) for e in evidence_list)
    total_del = sum((e.get("diff_stats", {}) or {}).get("deletions", 0) for e in evidence_list)
    prs = [e for e in evidence_list if e.get("source") in ("pr", "mock") and "pull" in e.get("url", "")]
    languages = sorted({lang for e in evidence_list for lang in (e.get("diff_stats", {}) or {}).get("languages", [])})
    titles = ", ".join(e["title"] for e in evidence_list[:4])

    summary = (
        f"[MOCK] Evidence shows {len(evidence_list)} item(s) (~{len(prs)} PR-like changes) "
        f"totalling +{total_add}/-{total_del} lines across {', '.join(languages) or 'unspecified languages'}. "
        f"Representative work: {titles}."
    )
    skills = [f"worked with {lang}" for lang in languages] or ["general code changes"]
    return {"summary": summary, "notable_skills": skills}


def _mock_compare(
    learning_path_text: str, evidence_summary: dict[str, Any], evidence_list: list[dict[str, Any]]
) -> dict[str, Any]:
    plan_tokens = _tokenize(learning_path_text)
    evidence_tokens = _tokenize(evidence_summary.get("summary", ""))
    for e in evidence_list:
        evidence_tokens |= _tokenize(e.get("title", ""))

    if not evidence_tokens:
        overlap_ratio = 0.0
    else:
        overlap = plan_tokens & evidence_tokens
        overlap_ratio = len(overlap) / max(len(plan_tokens), 1)

    if not evidence_list:
        match_status, confidence = "OFF_TRACK", 0.55
        reasoning = "[MOCK] No supporting evidence was found for this period against the assigned learning path."
    elif overlap_ratio >= 0.35:
        match_status, confidence = "ON_TRACK", min(0.6 + overlap_ratio * 0.4, 0.95)
        reasoning = f"[MOCK] Evidence vocabulary overlaps {overlap_ratio:.0%} with the assigned learning path."
    elif overlap_ratio >= 0.12:
        match_status, confidence = "PARTIALLY_ON_TRACK", 0.5 + overlap_ratio * 0.3
        reasoning = f"[MOCK] Some overlap ({overlap_ratio:.0%}) between evidence and the assigned plan, but coverage is incomplete."
    else:
        match_status, confidence = "OFF_TRACK", 0.45
        reasoning = f"[MOCK] Low overlap ({overlap_ratio:.0%}) between evidence and the assigned learning path."

    languages = sorted({lang for e in evidence_list for lang in (e.get("diff_stats", {}) or {}).get("languages", [])})
    skill_tags = [{"skill_name": f"worked with {lang}", "evidence_strength": 0.6} for lang in languages]
    if not skill_tags:
        skill_tags = [{"skill_name": "general contribution", "evidence_strength": 0.3}]

    return {
        "match_status": match_status,
        "confidence": round(confidence, 2),
        "reasoning": reasoning,
        "skill_tags": skill_tags,
    }


# ---------------------------------------------------------------------------
# Public entry point: try NVIDIA -> Gemini -> mock, in that order.
# ---------------------------------------------------------------------------

_PROVIDERS = [
    ("nvidia", lambda s: get_settings().nvidia_enabled, _nvidia_complete),
    ("gemini", lambda s: get_settings().gemini_enabled, _gemini_complete),
]


def generate_verdict(
    learning_path_text: str, evidence_list: list[dict[str, Any]]
) -> tuple[dict[str, Any], dict[str, Any], str]:
    """Returns (evidence_summary, verdict_data, provider_used)."""
    settings = get_settings()

    for name, is_enabled, complete_fn in _PROVIDERS:
        if not is_enabled(settings):
            continue
        try:
            summary = complete_fn(_summary_prompt(evidence_list))
            verdict = complete_fn(_verdict_prompt(learning_path_text, summary))
            return summary, verdict, name
        except Exception as exc:
            logger.warning("AI provider '%s' failed, falling back: %s", name, exc)
            continue

    summary = _mock_summarize(evidence_list)
    verdict = _mock_compare(learning_path_text, summary, evidence_list)
    return summary, verdict, "mock"
