"""GitHub evidence pulling.

If a GITHUB_TOKEN is configured, this hits the real GitHub REST API for PRs
and commits authored by the intern's GitHub username, scoped to the repo and
reporting period. If no token is configured (or the API call fails), it falls
back to a deterministic synthetic evidence generator so the rest of the
pipeline (AI verdicts, dashboards) is always demoable offline.
"""

import hashlib
import random
from datetime import date, datetime, timedelta
from typing import Any

import httpx

GITHUB_API = "https://api.github.com"

EXTENSION_LANGUAGE_MAP = {
    "py": "Python",
    "ts": "TypeScript",
    "tsx": "TypeScript/React",
    "js": "JavaScript",
    "jsx": "JavaScript/React",
    "go": "Go",
    "rs": "Rust",
    "java": "Java",
    "rb": "Ruby",
    "css": "CSS",
    "html": "HTML",
    "sql": "SQL",
    "md": "Docs",
    "yml": "Config/CI",
    "yaml": "Config/CI",
    "json": "Config",
}

MOCK_PR_POOL = [
    ("Add pagination to search endpoint", ["py", "py", "md"], 2),
    ("Fix race condition in cache invalidation", ["go", "go"], 3),
    ("Implement JWT-based auth middleware", ["ts", "ts", "json"], 1),
    ("Refactor test fixtures for API layer", ["py", "py", "py"], 0),
    ("Add retry logic with exponential backoff", ["ts", "ts"], 2),
    ("First pass: async job queue consumer", ["py", "yml"], 4),
    ("Improve error messages on validation failures", ["ts", "tsx"], 1),
    ("Add integration tests for webhook handler", ["py", "py"], 1),
    ("Optimize N+1 query in dashboard endpoint", ["py", "sql"], 2),
    ("Wire up CI pipeline for frontend build", ["yml", "json"], 0),
    ("Build reusable chart component", ["tsx", "css"], 2),
    ("Add rate limiting middleware", ["go"], 3),
]

MOCK_COMMIT_POOL = [
    "fix typo in README",
    "wip: exploring cache strategy",
    "address review comments",
    "add unit tests",
    "bump dependency versions",
    "small cleanup",
]


def _seeded_rng(seed_str: str) -> random.Random:
    seed = int(hashlib.sha256(seed_str.encode()).hexdigest(), 16) % (2**32)
    return random.Random(seed)


def _lang_for_files(files: list[str]) -> list[str]:
    extensions = [f.rsplit(".", 1)[-1].lower() if "." in f else "" for f in files]
    return _lang_for_extensions(extensions)


def _lang_for_extensions(extensions: list[str]) -> list[str]:
    langs = {EXTENSION_LANGUAGE_MAP.get(ext, ext or "other") for ext in extensions}
    return sorted(langs)


async def _fetch_real_pull_requests(
    repo: str, username: str, period_start: date, period_end: date, token: str
) -> list[dict[str, Any]]:
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
    query = (
        f"repo:{repo} author:{username} is:pr "
        f"created:{period_start.isoformat()}..{period_end.isoformat()}"
    )
    async with httpx.AsyncClient(timeout=20) as client:
        search_resp = await client.get(
            f"{GITHUB_API}/search/issues", params={"q": query, "per_page": 20}, headers=headers
        )
        search_resp.raise_for_status()
        items = search_resp.json().get("items", [])

        evidence = []
        for item in items:
            number = item["number"]
            pr_resp = await client.get(f"{GITHUB_API}/repos/{repo}/pulls/{number}", headers=headers)
            if pr_resp.status_code != 200:
                continue
            pr = pr_resp.json()

            reviews_resp = await client.get(
                f"{GITHUB_API}/repos/{repo}/pulls/{number}/reviews", headers=headers
            )
            review_count = len(reviews_resp.json()) if reviews_resp.status_code == 200 else 0

            files_resp = await client.get(
                f"{GITHUB_API}/repos/{repo}/pulls/{number}/files",
                headers=headers,
                params={"per_page": 30},
            )
            filenames = [f["filename"] for f in files_resp.json()] if files_resp.status_code == 200 else []

            evidence.append(
                {
                    "source": "pr",
                    "url": pr["html_url"],
                    "title": pr["title"],
                    "diff_stats": {
                        "additions": pr.get("additions", 0),
                        "deletions": pr.get("deletions", 0),
                        "files_changed": pr.get("changed_files", 0),
                        "languages": _lang_for_files(filenames),
                    },
                    "review_iterations": review_count,
                    "merged_at": pr.get("merged_at"),
                }
            )
        return evidence


async def _fetch_real_commits(
    repo: str, username: str, period_start: date, period_end: date, token: str
) -> list[dict[str, Any]]:
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
    since = datetime.combine(period_start, datetime.min.time()).isoformat() + "Z"
    until = datetime.combine(period_end, datetime.max.time()).isoformat() + "Z"
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"{GITHUB_API}/repos/{repo}/commits",
            headers=headers,
            params={"author": username, "since": since, "until": until, "per_page": 20},
        )
        resp.raise_for_status()
        commits = resp.json()

        evidence = []
        for c in commits:
            evidence.append(
                {
                    "source": "commit",
                    "url": c["html_url"],
                    "title": c["commit"]["message"].splitlines()[0],
                    "diff_stats": {"additions": 0, "deletions": 0, "files_changed": 0, "languages": []},
                    "review_iterations": 0,
                    "merged_at": c["commit"]["author"]["date"],
                }
            )
        return evidence


def _generate_mock_evidence(
    repo: str, username: str, period_start: date, period_end: date
) -> list[dict[str, Any]]:
    rng = _seeded_rng(f"{repo}:{username}:{period_start}:{period_end}")
    days_span = max((period_end - period_start).days, 1)
    n_prs = rng.randint(1, 3)
    n_commits = rng.randint(2, 5)

    evidence = []
    used_pr_idx = rng.sample(range(len(MOCK_PR_POOL)), k=min(n_prs, len(MOCK_PR_POOL)))
    for i, idx in enumerate(used_pr_idx):
        title, files, base_reviews = MOCK_PR_POOL[idx]
        offset = rng.randint(0, days_span)
        merged_at = period_start + timedelta(days=offset)
        additions = rng.randint(15, 260)
        deletions = rng.randint(2, min(120, additions))
        evidence.append(
            {
                "source": "mock",
                "url": f"https://github.com/{repo}/pull/{1000 + rng.randint(1, 999)}",
                "title": title,
                "diff_stats": {
                    "additions": additions,
                    "deletions": deletions,
                    "files_changed": len(files),
                    "languages": _lang_for_extensions(files),
                },
                "review_iterations": max(0, base_reviews + rng.randint(-1, 1)),
                "merged_at": datetime.combine(merged_at, datetime.min.time()).isoformat(),
            }
        )

    for _ in range(n_commits):
        offset = rng.randint(0, days_span)
        commit_date = period_start + timedelta(days=offset)
        msg = rng.choice(MOCK_COMMIT_POOL)
        evidence.append(
            {
                "source": "mock",
                "url": f"https://github.com/{repo}/commit/{hashlib.sha1(msg.encode()).hexdigest()[:10]}",
                "title": msg,
                "diff_stats": {
                    "additions": rng.randint(1, 40),
                    "deletions": rng.randint(0, 20),
                    "files_changed": rng.randint(1, 4),
                    "languages": [],
                },
                "review_iterations": 0,
                "merged_at": datetime.combine(commit_date, datetime.min.time()).isoformat(),
            }
        )

    evidence.sort(key=lambda e: e["merged_at"])
    return evidence


async def pull_evidence(
    repo: str, username: str, period_start: date, period_end: date, token: str | None
) -> tuple[list[dict[str, Any]], str]:
    """Returns (evidence_list, mode) where mode is 'live' or 'mock'.

    `token` is resolved by the caller: normally the intern's own
    GitHub OAuth token (each user authenticates for themselves now), falling
    back to the static GITHUB_TOKEN env var for seeded demo interns with no
    real login, falling back to mock evidence if neither is available.
    """
    if token:
        try:
            prs = await _fetch_real_pull_requests(repo, username, period_start, period_end, token)
            commits = await _fetch_real_commits(repo, username, period_start, period_end, token)
            combined = prs + commits
            if combined:
                return combined, "live"
            # No real activity found for this window — fall back so the demo still has signal.
            return _generate_mock_evidence(repo, username, period_start, period_end), "mock"
        except httpx.HTTPError:
            return _generate_mock_evidence(repo, username, period_start, period_end), "mock"

    return _generate_mock_evidence(repo, username, period_start, period_end), "mock"
