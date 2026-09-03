# TeaM Pulse — Architecture

This document describes the system as built. It replaces an earlier draft
that scoped a simpler self-report-verification tool; the project evolved
during development into the mentor-assigned learning-path model described
below (see "How the design evolved" at the end for the delta).

## 1. The problem, restated tightly

Self-reported intern progress is unverifiable and expensive to check
manually. You need a system that **triangulates a mentor's expectations
against actual code evidence (PRs/commits)**, surfaces discrepancies, and
gives both interns and leadership a trustworthy growth signal — without
removing humans from judgment calls.

---

## 2. Core design principle

> **AI does evidence-gathering and correlation. Humans do judgment.**

The AI never *decides* an intern is underperforming. It produces a
**confidence-scored comparison** between "what the mentor assigned" and
"what the repo shows they did," and routes anything ambiguous to a mentor
for a one-click confirm/override. This is the single idea the whole system
is built around — evidence pulls, verdict generation, and the review queue
all exist to make this triangulation cheap enough to run continuously
instead of only at review time.

---

## 3. Roles and identity

Three roles, two identity mechanisms, one session system:

| Role | Identity mechanism | How the account is created |
|---|---|---|
| **Intern** | GitHub OAuth | Self-service — first GitHub login auto-provisions the account and role. GitHub is intentionally the *only* signup path for interns, since they need a GitHub identity to connect a repo anyway. |
| **Mentor** | Email + password | Never self-service. A manager creates the record (name, email, employee code, phone, designation, optional team) via `POST /admin/mentors`. This generates a signed, expiring invite token; the mentor follows the invite link to set their own password, which claims the account. |
| **Manager** | Email + password | **Promotion-only.** No signup path exists for this role at all — an existing manager promotes an existing mentor, or the first one is seeded. |

Both identity mechanisms converge on the same signed session cookie
(`app/session.py`); `app/deps.py`'s access-control checks don't care which
mechanism produced the logged-in user. Passwords are PBKDF2-HMAC-SHA256
hashed (stdlib only — no bcrypt/argon2 native-build dependency).

A `dev/login` backdoor (`ENABLE_DEV_LOGIN`, on by default) bypasses both
mechanisms for testing: by GitHub-style username (auto-creates a fresh
intern) or by email (must already exist — it doesn't fabricate mentor/manager
accounts, since those are meant to come from a real invite).

### Org hierarchy

```
Manager ──creates──> Team ──has many──> Mentor ──mentors──> Intern
   │                                       │
   └──(promotes)──────────────────────────┘
```

A manager owns **Teams**; each **mentor** belongs to at most one team; each
**intern** picks a mentor at onboarding. An intern's displayed "team" is
derived — whichever team their mentor belongs to — not a field an intern
sets directly.

---

## 4. High-level architecture

```
┌──────────────────┐   ┌───────────────────┐   ┌────────────────────┐
│  GitHub OAuth     │   │  Manager-issued    │   │  Mentor-authored    │
│  (interns)        │   │  email invite      │   │  learning path       │
│                   │   │  (mentors/managers)│   │  (typed, or a file:   │
│                   │   │                    │   │  txt/xlsx/pdf/image) │
└────────┬──────────┘   └─────────┬──────────┘   └──────────┬───────────┘
         ▼                        ▼                          ▼
┌────────────────────────────────────────────────────────────────────┐
│                         AUTH & SESSION LAYER                        │
│  Signed session cookie (app/session.py); role + per-intern/         │
│  per-team access checks on every route (app/deps.py)                │
└────────────────────┬─────────────────────────────────────────────┘
                      ▼
┌────────────────────────────────────────────────────────────────────┐
│                    DOCUMENT EXTRACTION (if a file)                  │
│  Deterministic text extraction first (openpyxl / pypdf / plain      │
│  decode) → structured into {summary, table} via the AI provider     │
│  chain. Images / scanned PDFs skip straight to Gemini vision (real   │
│  OCR) since the NVIDIA model here is text-only.                     │
│  app/document_service.py                                            │
└────────────────────┬─────────────────────────────────────────────┘
                      ▼
┌────────────────────────────────────────────────────────────────────┐
│                        EVIDENCE EXTRACTION                          │
│  GitHub REST API, using the intern's own OAuth token: PR metadata   │
│  (diff size, review comments, merge status, revision count),        │
│  commit messages, languages touched. Falls back to a deterministic  │
│  synthetic generator if no token or the API call fails.             │
│  app/github_service.py                                              │
└────────────────────┬─────────────────────────────────────────────┘
                      ▼
┌────────────────────────────────────────────────────────────────────┐
│                  AI ANALYSIS LAYER (the core)                       │
│  Two calls per (learning path, evidence) pair, same provider chain: │
│  (a) summarize evidence — plain-language, skill-tagged              │
│  (b) compare that summary to the learning path → structured verdict:│
│      ON_TRACK / PARTIALLY_ON_TRACK / OFF_TRACK + confidence +       │
│      reasoning + skill tags                                         │
│  Provider chain: NVIDIA NIM (primary) → Gemini (backup) →           │
│  rule-based mock (last resort). Every verdict records which one     │
│  actually produced it. app/llm_service.py                           │
└────────────────────┬─────────────────────────────────────────────┘
                      ▼
┌────────────────────────────────────────────────────────────────────┐
│                    HUMAN-IN-THE-LOOP QUEUE                          │
│  Anything below the confidence threshold, or flagged OFF_TRACK,     │
│  goes to the mentor's review queue (scoped to their own interns).   │
│  Mentor can confirm the AI verdict or override it with a note.      │
│  Everything above threshold auto-publishes to dashboards.           │
└────────────────────┬─────────────────────────────────────────────┘
                      ▼
┌────────────────────────────────────────────────────────────────────┐
│                          DASHBOARDS                                  │
│  Intern view: growth timeline, skill tags, learning-path history    │
│  Mentor view: review queue, own-interns roster, cohort distribution │
│  Manager view (visually distinct): teams, mentor roster, promotion, │
│  org-wide aggregate — never confused with the mentor's own view     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. Data model

- **User** — id, name, avatar_url, role (`intern`/`mentor`/`manager`/null
  until assigned), team_id (mentors only)
  - GitHub identity (interns): github_id, github_login, github_access_token
  - Email identity (mentors/managers): email, password_hash, employee_code,
    phone, designation, invite_token (+ expiry)
- **Team** — id, name, manager_id (→ User)
- **Intern** — id, user_id (→ User), name, mentor_id (→ User), start_date,
  github_username, repo. No team field — an intern's team is derived from
  `intern.mentor.team_name`.
- **LearningPath** — id, intern_id, mentor_id, title, description,
  source_filename (nullable — set when created from an uploaded file),
  extracted_table (nullable JSON — `{headers, rows}`), period_start,
  period_end. `description` is the single field the AI comparison reads,
  regardless of whether it was typed or extracted from a file.
- **Evidence** — id, intern_id, source (pr/commit/mock), url, title,
  diff_stats (additions/deletions/files_changed/languages), review_iterations
  (proxy for learning from feedback), merged_at
- **Verdict** — id, learning_path_id, match_status
  (ON_TRACK/PARTIALLY_ON_TRACK/OFF_TRACK), confidence, ai_summary, reasoning,
  mentor_override ({status, note, mentor_name, decided_at}), source_mode
  (`nvidia`/`gemini`/`mock` — which provider actually produced it)
- **SkillTag** — id, verdict_id, skill_name, evidence_strength

---

## 6. Suggested-vs-actual tech stack

| Layer | Actual choice | Why |
|---|---|---|
| Backend | FastAPI (Python) + SQLAlchemy + SQLite | Fast to scaffold, async-native for webhook/evidence-pull style I/O |
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind v4 + Recharts + TanStack Query | Fast to build believable, role-aware dashboards |
| Auth | GitHub OAuth (interns) + email/password with manager-issued invites (mentors/managers), signed session cookie | Matches the real org shape — interns bring a GitHub identity, mentors/managers are added by someone with authority to vouch for them |
| AI (primary) | NVIDIA NIM, `nvidia/nemotron-3-super-120b-a12b` (reasoning-tuned) | The core task — evidence vs. learning-path comparison — is calibrated judgment, not open-ended generation; a reasoning model's chain-of-thought tends to produce more consistent, well-justified confidence scores |
| AI (backup) | Google Gemini (`gemini-2.0-flash`) | Used only if NVIDIA is unconfigured or a call fails; also the only path with real vision/OCR capability, since the NVIDIA model configured here is text-only |
| AI (last resort) | Rule-based mock (word-overlap heuristic) | Keeps every AI-dependent feature — verdicts, document structuring — fully exercisable with zero API keys |
| Document extraction | `openpyxl`, `pypdf` (deterministic) + Gemini vision (OCR) | Excel/text-PDF/text files need no AI at all; only images and scanned PDFs need real OCR |
| Git integration | GitHub REST API, per-user OAuth token | Each user's own token is used for their own evidence pulls — no shared/global GitHub session |
| Email delivery | Generic SMTP (Gmail App Password is the simplest on-ramp) | Not locked to one vendor's API; degrades to showing the invite link directly in the manager UI if unconfigured |
| Containerization | Docker Compose, 2 services | Backend entrypoint self-heals a stale/interrupted seed (checks row counts, not just file existence) |

**What was cut, deliberately, and stayed cut:** real webhooks (evidence is
pulled on demand instead of via push events), Jira/ticket integration,
multiple repos per intern, session revocation/refresh-token rotation,
malware scanning on uploaded learning-path files.

---

## 7. Human-in-the-loop touchpoints

1. **Off-track review** — mentor confirms/overrides low-confidence or
   off-track verdicts in a queue scoped to their own interns.
2. **Skill-tag calibration** — mentor sees AI-assigned skill tags alongside
   evidence strength (correcting these is future work, not yet built).
3. **Sensitive judgment calls** — nothing is auto-surfaced to leadership as
   a negative score; off-track findings only ever route to a mentor
   conversation, never straight to the org-wide manager rollup as an
   individual callout.

---

## 8. What's implemented

Everything below is built and demoable end-to-end, in both local dev and
Docker Compose:

- Full auth: GitHub OAuth signup for interns; manager-issued email invites
  for mentors; promotion-only manager creation; dev-login backdoor for
  testing.
- Teams: manager creates them, assigns mentors into them, sees an org-wide
  rollup distinct from any single mentor's dashboard.
- Learning paths: typed, or extracted from an uploaded `.txt`/`.md`/`.xlsx`/
  `.xls`/`.pdf`/image file, with a rendered table when the source had one.
- Evidence pulls: real GitHub PRs/commits via each user's own token, or a
  deterministic synthetic generator with zero credentials.
- AI verdicts: NVIDIA → Gemini → mock chain, provenance always visible.
- Review queue, confirm/override, cohort and org-wide summaries with
  Recharts visualizations.
- Seed data that exercises the entire pipeline (manager, 2 mentors on 2
  teams, 3 interns, 6 learning paths, real evidence pulls, real verdicts)
  on first container boot.

---

## 9. Pitch framing (30 seconds, for judges)

*"Mentors shouldn't have to fact-check every status update — and in a real
org, they shouldn't have to hand-manage rosters and access either. TeaM
Pulse reads the actual code against whatever a mentor assigned — typed, or
handed over as a syllabus file — and tells the mentor where the two agree,
where they don't, and only pulls a human in when judgment is actually
needed. A manager runs the org — teams, mentors, promotions — without
touching a single line of code evidence themselves. Leadership gets a
verified signal instead of a trust-fall, at every level of the hierarchy."*

---

## How the design evolved

The project started from a simpler kickoff scope: one mentor role, GitHub
OAuth for everyone, self-reports typed by interns and verified against
evidence. Through the build, it grew into what's described above:

1. **Self-reports → mentor-assigned learning paths.** The comparison target
   flipped from "what the intern claims" to "what the mentor expects" —
   sharper signal, and it opened the door to the file-upload feature.
2. **One role → three, with a real org hierarchy.** Manager and Team
   entities were added so an organization, not just a mentor-intern pair,
   could use the tool.
3. **Single auth mechanism → two.** GitHub-only didn't fit mentors/managers,
   who aren't necessarily GitHub users — email + manager-issued invite is a
   more realistic fit for that side of the org chart.
4. **Typed-only → typed or uploaded.** Once learning paths existed as their
   own entity, letting a mentor hand over an existing syllabus file instead
   of retyping it was a natural extension, using the same AI provider chain
   already built for verdict generation.

Each step preserved the original core principle unchanged — AI correlates
evidence, humans hold the judgment calls — while the surface area around it
grew to fit how a real internship program is actually structured.
