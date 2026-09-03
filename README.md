# TeaM Pulse

Verified intern progress, without the trust-fall. Mentors set a learning path;
interns connect the repo they're working on; TeaM Pulse compares what the
code actually shows against what was assigned, and only pulls a human mentor
in when the comparison is ambiguous or off track.

> **AI does evidence-gathering and correlation. Humans do judgment.**
> The AI never decides an intern is underperforming — it produces a
> confidence-scored comparison between what the mentor assigned and what the
> repo *shows* they did, and routes anything below a confidence threshold (or
> flagged off-track) to a mentor for a one-click confirm/override.

Full architecture background: [`team-pulse-architecture.md`](team-pulse-architecture.md).

## Roles

Three roles, three distinct dashboards — and **two different identity
mechanisms**, one per side of the org chart:

- **Intern** — authenticates with **GitHub OAuth**. First login is signup;
  role is auto-assigned (GitHub is only ever used by interns, since they
  need a GitHub identity to connect a repo anyway — there's no role picker
  for this path). Connects a repo, gets assigned a learning path, sees their
  own growth timeline.
- **Mentor** — authenticates with **email + password**. There's no
  self-signup: a manager adds them via `/manager` with their email, employee
  code, phone, and designation, which sends (or, if email isn't configured,
  displays) an invite link. Following that link lets the mentor set their
  own password — from then on it's a normal email+password login. Sets
  learning paths for their own interns, reviews AI-flagged progress in a
  review queue.
- **Manager** — also email + password, but **promotion-only**: there's no
  "add yourself as manager" anywhere. An existing manager promotes an
  existing mentor (or you're seeded as the bootstrap manager). Creates
  teams, adds mentors, promotes new managers, and sees an org-wide rollup.
  The `/manager` page is deliberately styled differently (a gradient
  admin-console header) from the mentor's plain dashboard, so the two are
  never visually confused.

Hierarchy: a manager owns **Teams** → each **mentor** belongs to one team →
each **intern** picks a mentor. An intern's displayed "team" is just
whichever team their mentor is in — interns don't pick a team directly.

## How it works

1. **Intern signs in with GitHub.** First login auto-provisions their
   account and role.
2. **Intern connects a repo.** Onboarding asks for the repo they're working
   on and (optionally) their mentor.
3. **Manager adds a mentor.** Name, email, employee code, phone,
   designation, optional team. The mentor gets an invite link (emailed if
   SMTP is configured, shown directly to the manager otherwise) to set their
   password and log in.
4. **Mentor assigns a learning path.** A title, a period, and either a typed
   description **or an uploaded syllabus file** (text, Excel, PDF, or image)
   — see "Uploading a learning path document" below.
5. **Generate a progress summary.** Either the intern or their mentor can
   trigger it: TeaM Pulse pulls PR/commit evidence for that repo and period,
   summarizes it, and asks an AI model to compare it against the assigned
   learning path — producing ON_TRACK / PARTIALLY_ON_TRACK / OFF_TRACK with a
   confidence score and specific reasoning.
6. **Mentor reviews the queue.** Anything below the confidence threshold or
   flagged OFF_TRACK needs a human — confirm the AI's read or override it.
7. **Manager oversees the org.** Creates teams, assigns mentors, promotes new
   managers, and watches an aggregate on-track ratio across every team.

## Uploading a learning path document

Instead of typing a description, a mentor can upload a syllabus/curriculum
file (`.txt`, `.md`, `.xlsx`/`.xls`, `.pdf`, or an image) when assigning a
learning path. `app/document_service.py` turns it into the same kind of
plain-language description a typed one would be, plus (where the content
has clear structure) a table shown alongside it — the AI verdict comparison
always runs against that description, so a file-based learning path works
identically to a typed one from there on.

How extraction works depends on the file, in order of preference:
1. **Deterministic text extraction** — `.txt`/`.md` decoded directly,
   `.xlsx`/`.xls` read cell-by-cell via `openpyxl`, `.pdf` text layer via
   `pypdf` (works for any PDF that isn't a scan). No AI involved in this step.
2. **Structuring that text** — the extracted text is reformatted into a
   summary + table using the same NVIDIA → Gemini → mock chain as verdict
   generation (a text-only reformatting task, so NVIDIA handles it as
   primary).
3. **Real OCR** — only for images, or a PDF with no usable text layer (a
   scan). This requires Gemini specifically (`GEMINI_API_KEY`), since the
   configured NVIDIA model here is text-only and can't read images. Without
   Gemini configured, this degrades to a clearly `[MOCK]`-labeled message
   asking you to configure it or upload a text-based file instead, rather
   than failing outright.

## Stack

| Layer | Choice |
|---|---|
| Backend | FastAPI (Python) + SQLAlchemy + SQLite |
| Auth | Two mechanisms, one session system: GitHub OAuth for interns (first login = signup), email+password for mentors/managers (added by a manager, invited by email, self-set password). A signed session cookie identifies the user on each request either way. Passwords are PBKDF2-HMAC-SHA256 hashed (stdlib only, no bcrypt dependency). |
| Email delivery | SMTP (works with any provider — Gmail with an App Password is the simplest) for mentor invite emails. If unconfigured, the invite link is still returned to the manager in the UI, so testing never depends on real email delivery. |
| AI core (primary) | NVIDIA NIM — `nvidia/nemotron-3-super-120b-a12b` (a reasoning-tuned model) via the OpenAI-compatible `integrate.api.nvidia.com` endpoint. This task is calibrated judgment (compare two texts, emit a structured confidence + reasoning), not open-ended generation — a reasoning model's chain-of-thought (returned separately as `reasoning_content`, kept out of the stored verdict) tends to produce more consistent, well-justified confidence scores. Which models a given NVIDIA key can call varies by account entitlement, independent of what `/v1/models` lists — verify with a real chat-completions call before changing `NVIDIA_MODEL`. |
| AI core (backup) | Google Gemini (`gemini-2.0-flash`) — used only if NVIDIA is unconfigured or a call to it fails |
| AI core (last resort) | Rule-based mock verdicts — used only if neither provider is configured or both fail |
| Evidence source | GitHub REST API (PRs, commits, reviews, diff stats) using each user's own OAuth token, with a deterministic synthetic fallback so the app is demoable with zero credentials |
| Document extraction | `openpyxl` (Excel), `pypdf` (PDF text layer) for deterministic parsing; Gemini vision for real OCR on images/scanned PDFs — see "Uploading a learning path document" |
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 |
| Data viz | Recharts (growth timeline, cohort verdict distribution) |
| Data fetching | TanStack Query |

Both the GitHub and AI integrations run in **mock mode automatically** when
their API keys aren't configured. Evidence pulls fall back to a seeded
synthetic generator; verdicts try NVIDIA first, then Gemini, then finally a
transparent rule-based heuristic. Every verdict records exactly which one
produced it (`source_mode`: `"nvidia"` | `"gemini"` | `"mock"`), shown as a
small badge in the UI — never silently passed off as a live judgment that
didn't happen.

## Quickstart

### Option A: Docker Compose (recommended)

```bash
cd backend && cp .env.example .env
# Edit .env: add NVIDIA_API_KEY / GEMINI_API_KEY / GITHUB_OAUTH_CLIENT_ID+SECRET /
# SMTP_* if you have them — none are required, everything runs in mock mode
# without them, and dev login (below) lets you exercise the full app with no keys at all.
cd ..

docker compose up -d --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000 (docs at `/docs`)

The backend seeds demo data on first boot (2 mentors, 3 interns, learning
paths, evidence, verdicts) via an entrypoint script that checks actual row
counts, not just that the database file exists — so it self-heals if an
earlier seed run was ever interrupted. Data persists in a named volume
(`backend_data`) across restarts; `docker compose down -v` wipes it for a
full reset.

> **`NEXT_PUBLIC_API_URL` is baked in at build time** (this app fetches the
> API directly from the browser, not through a server proxy). If you change
> the backend's published port or host, update the build arg in
> `docker-compose.yml` and rebuild the frontend image.

### Option B: run locally without Docker

```bash
# Backend
cd backend
python -m venv venv && ./venv/Scripts/activate   # or `source venv/bin/activate`
pip install -r requirements.txt
cp .env.example .env
python -m app.seed --reset
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

> **Windows + Docker Desktop / WSL note:** if the frontend can't reach the
> API, Docker/WSL's port relay can intercept `localhost` on some ports. Point
> both `.env` files at `127.0.0.1` instead and restart both servers. (Doesn't
> affect Option A.)

### Logging in

The `/` page offers both real paths side by side, plus a dev-login panel:

1. **Interns: real GitHub OAuth** — register an OAuth App at
   https://github.com/settings/developers with Authorization callback URL
   matching `GITHUB_OAUTH_REDIRECT_URI` in `.env` (default
   `http://localhost:8000/auth/github/callback`), then set
   `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`. Each user's own
   token is stored on their account and used only for pulling evidence from
   *their own* connected repo.
2. **Mentors/managers: real email + password** — a manager adds a mentor via
   `/manager` → "Add mentor". Set `SMTP_HOST` / `SMTP_FROM_EMAIL` (and
   `SMTP_USERNAME` / `SMTP_PASSWORD` if your provider needs auth) in `.env`
   to actually send the invite email; a Gmail account with an
   [App Password](https://myaccount.google.com/apppasswords) is the
   quickest way to get real SMTP credentials. Without SMTP configured, the
   invite link is shown directly in the manager's UI instead — copy it and
   open it yourself (or send it however you like) to test the accept flow.
3. **Dev login** (default on, `ENABLE_DEV_LOGIN=true`) — a "Dev login" panel
   on the landing page lets you log in as any seeded demo user (by email for
   mentors/managers, by GitHub-style username for interns), or type a new
   username to create a fresh intern account instantly. This bypasses both
   real auth mechanisms entirely — it does *not* fabricate mentor/manager
   accounts, since those are meant to come from a real invite. Set
   `ENABLE_DEV_LOGIN=false` in `.env` to remove this endpoint.

Seeded demo accounts, password `changeme123` for all mentors/manager:
`alex.rivera@teampulse.dev` (manager), `priya.singh@teampulse.dev`,
`devon.okafor@teampulse.dev` (mentors, one per team), and GitHub-style
`demo-asha`, `demo-marcus`, `demo-wei` (interns, via dev login).

### Demo it

1. **Log in as the manager** (`alex.rivera@teampulse.dev` / `changeme123`,
   or dev-login) — see the org-wide rollup, create a team, and click **"Add
   mentor"** to invite someone new (copy the invite link if SMTP isn't
   configured).
2. Open that invite link in a private/incognito window (or a different
   browser) to **set a password and accept the invite** as the new mentor.
3. Back as a mentor (dev-log in as `priya.singh@teampulse.dev` for one with
   existing interns), click into one of your interns and **assign a new
   learning path** (title + what to focus on + period).
4. Click **"Generate progress summary"** — the wow moment: it pulls repo
   evidence live and asks the AI to compare it against what you just
   assigned, landing inline within a few seconds with a status, confidence,
   and specific reasoning.
5. Back on **Mentor view**, anything OFF_TRACK or low-confidence is in the
   review queue with Confirm / Override.
6. On the **manager dashboard**, promote a mentor to manager and notice the
   distinct gradient header vs. the mentor view's plain layout.
7. **Dev-log in as a brand-new intern** (any username) to see the full
   first-time flow: connect a repo, pick a mentor, land on your dashboard.

## Project layout

```
docker-compose.yml    orchestrates both containers for Option A
backend/
  Dockerfile, entrypoint.sh   builds the image; entrypoint self-heals/seeds on boot
  app/
    main.py               FastAPI app, CORS, router wiring
    config.py              env-driven settings
    session.py              signed session-cookie helpers
    security.py              password hashing (PBKDF2, stdlib only)
    email_service.py          SMTP invite email, logs the link if unconfigured
    deps.py                 auth dependencies: current user, role guards, per-intern access checks
    models.py               User, Team, Intern, LearningPath, Evidence, Verdict, SkillTag
    schemas.py               Pydantic request/response schemas
    serializers.py            ORM -> schema conversions needing a joined field
    github_service.py       GitHub REST evidence pulls + synthetic mock fallback
    llm_service.py           NVIDIA -> Gemini -> rule-based mock fallback chain
    document_service.py       learning-path file upload -> text/table extraction (+ Gemini OCR for images/scans)
    routers/                 auth (GitHub + email/password + invites), admin (mentor
                             invites, teams, promotion), users (intern onboarding),
                             interns, learning_paths, evidence, verdicts, dashboard
    seed.py                   demo data generator, runs the full pipeline on seed
frontend/
  Dockerfile             multi-stage build using Next.js standalone output
  src/
    app/                   Landing (/), onboarding/intern, invite/[token], dashboard
                           redirect, mentor view (/mentor), manager view (/manager),
                           intern dashboard (/intern/[id])
    components/            AuthGate, AcceptInviteForm, VerdictCard, LearningPathForm,
                           GenerateSummaryButton, ...
    lib/                    typed API client, shared types, useAuth hook
```

## Data model

- **User** — id, name, avatar_url, role (`intern`/`mentor`/`manager`/null until onboarded), team_id (mentors only); GitHub identity: github_id, github_login, github_access_token (interns); email identity: email, password_hash, employee_code, phone, designation, invite_token(+expiry) (mentors/managers)
- **Team** — id, name, manager_id (→ User)
- **Intern** — id, user_id, name, mentor_id (→ User), start_date, github_username, repo (team is derived: `intern.mentor.team_name`, not stored on Intern)
- **LearningPath** — id, intern_id, mentor_id, title, description, source_filename, extracted_table, period_start, period_end
- **Evidence** — id, intern_id, source (pr/commit/mock), url, title, diff_stats, review_iterations, merged_at
- **Verdict** — id, learning_path_id, match_status (ON_TRACK/PARTIALLY_ON_TRACK/OFF_TRACK), confidence, ai_summary, reasoning, mentor_override
- **SkillTag** — id, verdict_id, skill_name, evidence_strength

## Access control

- An intern can only see/act on their own data.
- A mentor can only see/act on interns who picked them as their mentor.
- A manager can only see/act on teams they created, and (read-only, via the org rollup) interns under mentors in those teams.
- Enforced server-side on every route (`app/deps.py`), not just hidden in the UI.

## Known edge case

Promoting a mentor who still has interns assigned turns them into a manager
but doesn't reassign their interns — those interns keep pointing at a
mentor whose role is no longer `mentor` (their mentor-facing dashboard
becomes inaccessible to that person). Not handled for this POC; reassign
those interns to a different mentor first if you hit this in practice.

## Human-in-the-loop touchpoints

1. **Off-track review** — mentor confirms/overrides low-confidence or off-track verdicts in the queue.
2. **Skill-tag calibration** — mentor sees AI-assigned skill tags alongside evidence strength (correcting these is noted as future work).
3. **Sensitive judgment calls** — nothing is auto-surfaced to leadership as a negative score; off-track findings only ever route to a mentor conversation.

## Cut corners (by design, per the hackathon-MVP scope)

- Session store is a signed cookie holding just a user id — no revocation list, no refresh-token rotation. Fine for a demo; a real deployment would want shorter-lived tokens and a way to invalidate sessions.
- No "forgot password" flow for email accounts — a manager would need to re-invite (a fresh invite token overwrites the old one) if a mentor forgets theirs.
- No real webhooks — evidence is pulled on demand (generate-summary click, or manually via `POST /evidence/pull`), not via push events.
- No Jira/ticket integration.
- Single repo per intern (good enough for a demo; trivial to extend to a list).
- Learning-path file uploads are capped at 10 MB and don't run malware/content scanning — fine for a trusted internal tool, not for accepting uploads from the public internet.
- Image/scanned-PDF OCR for learning paths hard-requires Gemini — if you only configure NVIDIA, those two file types fall back to a mock message rather than degrading to some other OCR method.
- `ENABLE_DEV_LOGIN` defaults to on for easy testing — turn it off (`ENABLE_DEV_LOGIN=false`) before showing this to anyone you don't want logging in as anyone else.
