# CLAUDE.md

Project context for Claude Code sessions working in this repo. This file
captures operational knowledge and decisions from the build session that
aren't obvious just from reading the code — read `README.md` for user-facing
docs and `team-pulse-architecture.md` for the full architecture writeup.

## What this project is

TeaM Pulse — verifies intern progress by comparing mentor-assigned learning
paths (typed, or extracted from an uploaded syllabus file) against real
GitHub evidence, using an AI provider chain (NVIDIA → Gemini → rule-based
mock), with mentors/managers staying in the loop for anything ambiguous.
Three roles (intern/mentor/manager), two auth mechanisms (GitHub OAuth for
interns, email+password via manager-issued invite for mentors/managers).

Full details: `team-pulse-architecture.md` (system design) and `README.md`
(setup, quickstart, feature docs). Don't duplicate those here — this file is
for things that would otherwise have to be rediscovered.

## Running it

**Always prefer Docker Compose** (`docker compose up -d --build` from repo
root) over local dev servers — that's what's actually been tested against
throughout this build, and the backend's Python version differs
deliberately from whatever's installed locally (see below).

```bash
docker compose down -v          # full reset (wipes seeded data — schema
                                 # changes require this, see "No migrations")
docker compose build             # after code changes
docker compose up -d
```

Backend: http://localhost:8000 (docs at `/docs`). Frontend:
http://localhost:3000. Seeded demo accounts and their passwords are in
`backend/app/seed.py` and documented in `README.md`.

## Things that will bite you in this environment

These are specific to how this project has actually been built/tested — not
generic advice.

- **No migrations.** `Base.metadata.create_all()` only creates *missing*
  tables — it never alters existing ones. Any change to `models.py` (new
  column, new table) requires `docker compose down -v` to drop the SQLite
  volume and reseed from scratch. There is no ALTER-TABLE path; don't try to
  patch the running DB in place.
- **Seed script is slow and commits once, at the end.** `app/seed.py` makes
  ~12 real AI calls when NVIDIA/Gemini are configured, and only calls
  `db.commit()` after everything succeeds. If it's killed partway through
  (e.g. a premature `docker restart` or a timeout), you get **zero rows**,
  not partial data. The backend's `entrypoint.sh` guards against this by
  checking actual row counts (not just file existence) before deciding
  whether to reseed — but if you're driving the seed script directly, let
  it finish. When backgrounding it locally, use `python -u` (unbuffered) or
  stdout won't show progress until the process exits, which looks like a
  hang.
- **Local Python venv is 3.14; Docker is 3.12 — on purpose.** This machine
  only has Python 3.14 installed locally, which lacks prebuilt wheels for
  some packages (`pydantic-core` failed to build from source against 3.14
  via PyO3). The backend `Dockerfile` deliberately pins `python:3.12-slim`
  for wheel availability. When installing backend deps into the local venv
  for quick testing, always use
  `pip install --only-binary=:all: -r requirements.txt` to avoid triggering
  a native build that will fail.
- **NVIDIA's `/v1/models` listing lies about what you can call.** A model
  appearing in the catalog doesn't mean your API key has entitlement to
  invoke it — `nvidia/llama-3.1-nemotron-70b-instruct` (the originally
  planned model) 404'd despite being listed. Verify any model change with a
  real `chat.completions.create()` call before committing to it in
  `config.py`'s `nvidia_model` default. The confirmed-working default is
  `nvidia/nemotron-3-super-120b-a12b`.
- **Windows Git Bash mangles absolute container paths.** `docker exec ...
  /app/...` or `docker run -v ...:/app/...` gets the leading `/app` rewritten
  to a Windows path (`C:/Program Files/Git/app/...`) by MSYS's path
  conversion before Docker ever sees it. Prefix the command with
  `MSYS_NO_PATHCONV=1` whenever passing an absolute in-container path.
- **`localhost` vs `127.0.0.1` breaks session cookies, not just CORS.**
  Docker Desktop + WSL's port relay can intercept `localhost` on some ports
  in this environment, and separately, session cookies are host-scoped — a
  cookie set while hitting the backend via `127.0.0.1:8000` will not be sent
  on a subsequent request to `localhost:8000`, even though both resolve to
  the same server. Pick one hostname (matching whatever `NEXT_PUBLIC_API_URL`
  and `FRONTEND_URL` use) and use it consistently end-to-end, especially
  when testing login flows.
- **No `chromium-cli` in this environment.** Browser-driven verification
  used `npx playwright install chromium` once, then a scratch `smoke.js`
  script (chromium via the `playwright` package, `node smoke.js`) for each
  round of testing, with screenshots reviewed via the Read tool. Clean up
  `smoke.js` and screenshot PNGs from `frontend/` after each round — they're
  scratch artifacts, not part of the app.

## Conventions established this session

- **Every external integration degrades gracefully, and says so.** GitHub
  evidence pulls, AI verdicts, and document OCR all have a mock/fallback
  path when unconfigured, and every result that came from a fallback is
  visibly labeled in the API response and the UI (`source_mode`, `[MOCK]`
  prefixes) — never silently passed off as a live result.
- **`ENABLE_DEV_LOGIN` stays on by default** for this POC's testing
  convenience, but is a real security-relevant toggle — call it out if
  asked about hardening this for real use.
- **Attribution for commits/PRs from here on:**
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```
  and PR descriptions end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Known limitations (see README's "Cut corners" for the full list)

Most relevant to keep in mind while extending this: promoting a mentor with
existing interns orphans those interns' mentor reference (no reassignment
flow exists yet); no password-reset flow (re-invite is the only recovery
path); learning-path file uploads are capped at 10 MB with no malware
scanning; image/scanned-PDF OCR hard-requires Gemini specifically.
