/* TeaM Pulse — static build.
 *
 * A dependency-free, client-side-only port of the Next.js frontend. Every
 * screen, flow and interaction mirrors the real app, but there is no backend:
 * data comes from the hardcoded dataset in data.js, mutations persist to this
 * browser's localStorage, and verdict generation replays recorded AI output
 * (or, for newly assigned learning paths, runs a JS port of the backend's
 * rule-based mock). No API keys, tokens or network calls exist anywhere in
 * this build, which is what makes it safe to host on GitHub Pages.
 */
(function () {
  "use strict";

  const SEED = window.TP_SEED;
  const ICONS = window.TP_ICONS;

  const STORE_KEY = "tp-static-db-v1";
  const SESSION_KEY = "tp-static-session-v1";
  const DEMO_PASSWORD = "changeme123";
  const CONFIDENCE_THRESHOLD = 0.7;
  const INTERN_SESSION_MINUTES = 60;
  const MENTOR_SESSION_DAYS = 30;
  const MAX_STORED_FILE_BYTES = 1024 * 1024;
  const ACCEPTED_EXTENSIONS = ".txt,.md,.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls";

  // Recorded verdicts, keyed by learning path — "Re-run analysis" on a seeded
  // learning path replays these instead of degrading to the mock.
  const RECORDED_VERDICTS = new Map(SEED.verdicts.map((v) => [v.learning_path_id, v]));

  // ---------------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------------

  const clone = (o) => JSON.parse(JSON.stringify(o));

  function loadDb() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {
      /* storage unavailable — fall through to the seed */
    }
    return Object.assign(clone(SEED), { passwords: {}, files: {} });
  }

  let db = loadDb();

  function saveDb() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(db));
    } catch (_) {
      /* quota exceeded or storage blocked — state still lives in memory */
    }
  }

  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch (_) {
      return memorySession;
    }
  }
  let memorySession = null;
  function saveSession(s) {
    memorySession = s;
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch (_) {
      /* in-memory session only */
    }
  }

  const nextId = (rows) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function icon(name, size = 14, cls = "", style = "") {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
      `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ` +
      `class="icon ${cls}"${style ? ` style="${style}"` : ""} aria-hidden="true">${ICONS[name] || ""}</svg>`
    );
  }
  const spinner = (size = 14) => icon("loader-circle", size, "spin");

  function initials(name) {
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  const todayIso = () => toIso(new Date());
  function toIso(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function addDaysIso(iso, days) {
    const [y, m, d] = iso.split("-").map(Number);
    return toIso(new Date(y, m - 1, d + days));
  }
  const pct = (v) => Math.round(v * 100);
  const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  async function hashPassword(password) {
    try {
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`tp-static:${password}`));
      return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
    } catch (_) {
      // Non-secure context (no SubtleCrypto) — weak fallback is fine here:
      // this demo has no real accounts to protect.
      let h = 0;
      for (const c of `tp-static:${password}`) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
      return `weak-${h}`;
    }
  }

  function randomToken() {
    const bytes = new Uint8Array(16);
    (window.crypto || {}).getRandomValues
      ? crypto.getRandomValues(bytes)
      : bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // ---------------------------------------------------------------------------
  // "API" — the same shapes the FastAPI backend returns, computed locally
  // ---------------------------------------------------------------------------

  const userById = (id) => db.users.find((u) => u.id === id) || null;
  const teamById = (id) => db.teams.find((t) => t.id === id) || null;
  const internById = (id) => db.interns.find((i) => i.id === id) || null;
  const lpById = (id) => db.learning_paths.find((l) => l.id === id) || null;
  const evidenceById = (id) => db.evidence.find((e) => e.id === id) || null;

  function userOut(u) {
    const team = teamById(u.team_id);
    return Object.assign({}, u, {
      team_name: team ? team.name : null,
      intern_count: u.role === "mentor" ? db.interns.filter((i) => i.mentor_id === u.id).length : null,
      pending_invite: !!u.invite_token,
    });
  }

  function internOut(i) {
    const mentor = userById(i.mentor_id);
    const team = mentor ? teamById(mentor.team_id) : null;
    return Object.assign({}, i, {
      mentor_name: mentor ? mentor.name : null,
      team_name: team ? team.name : null,
    });
  }

  function verdictFor(lpId) {
    return db.verdicts.find((v) => v.learning_path_id === lpId) || null;
  }

  function verdictOut(v) {
    const lp = lpById(v.learning_path_id);
    const intern = internById(lp.intern_id);
    return Object.assign({}, v, {
      evidence: v.evidence_ids.map(evidenceById).filter(Boolean),
      learning_path: lp,
      intern_name: intern ? intern.name : "",
      intern_id: lp.intern_id,
    });
  }

  function timeline(internId) {
    return db.learning_paths
      .filter((l) => l.intern_id === internId)
      .sort((a, b) => a.period_start.localeCompare(b.period_start))
      .map((lp) => {
        const v = verdictFor(lp.id);
        return { learning_path: lp, verdict: v ? verdictOut(v) : null };
      });
  }

  const needsReview = (v) =>
    !v.mentor_override && (v.confidence < CONFIDENCE_THRESHOLD || v.match_status === "OFF_TRACK");

  function cohortSummary(internIds) {
    const ids = new Set(internIds);
    const lps = db.learning_paths.filter((l) => ids.has(l.intern_id));
    const lpIds = new Set(lps.map((l) => l.id));
    const verdicts = db.verdicts.filter((v) => lpIds.has(v.learning_path_id));
    const total = verdicts.length;
    const count = (s) => verdicts.filter((v) => v.match_status === s).length;
    const onTrack = count("ON_TRACK");
    const partial = count("PARTIALLY_ON_TRACK");
    return {
      total_interns: ids.size,
      total_learning_paths: lps.length,
      total_verdicts: total,
      on_track_count: onTrack,
      partially_on_track_count: partial,
      off_track_count: count("OFF_TRACK"),
      pending_review_count: verdicts.filter(needsReview).length,
      on_track_ratio: total ? (onTrack + partial) / total : 0,
      avg_confidence: total ? verdicts.reduce((s, v) => s + v.confidence, 0) / total : 0,
    };
  }

  function reviewQueue(internIds) {
    const ids = new Set(internIds);
    return db.verdicts
      .filter((v) => ids.has(lpById(v.learning_path_id).intern_id) && needsReview(v))
      .sort((a, b) => a.confidence - b.confidence)
      .map(verdictOut);
  }

  const mentorInternIds = (mentorId) => db.interns.filter((i) => i.mentor_id === mentorId).map((i) => i.id);

  function managerTeams(managerId) {
    return db.teams
      .filter((t) => t.manager_id === managerId)
      .map((t) =>
        Object.assign({}, t, {
          mentors: db.users.filter((u) => u.role === "mentor" && u.team_id === t.id).map(userOut),
        })
      );
  }

  function orgWideInternIds(managerId) {
    const mentorIds = new Set(managerTeams(managerId).flatMap((t) => t.mentors.map((m) => m.id)));
    return db.interns.filter((i) => mentorIds.has(i.mentor_id)).map((i) => i.id);
  }

  function managerOverview(managerId) {
    return {
      teams: managerTeams(managerId),
      unassigned_mentors: db.users.filter((u) => u.role === "mentor" && u.team_id == null).map(userOut),
      summary: cohortSummary(orgWideInternIds(managerId)),
    };
  }

  function authStatus() {
    const s = loadSession();
    if (!s) return { authenticated: false };
    if (s.expires_at && Date.now() > s.expires_at) {
      saveSession(null);
      return { authenticated: false };
    }
    const u = userById(s.user_id);
    if (!u) return { authenticated: false };
    const intern = u.role === "intern" ? db.interns.find((i) => i.user_id === u.id) : null;
    return {
      authenticated: true,
      user: userOut(u),
      onboarding_complete: u.role !== "intern" || !!(intern && intern.repo),
      intern_id: intern ? intern.id : null,
    };
  }

  function startSession(u) {
    const ttl =
      u.role === "intern" ? INTERN_SESSION_MINUTES * 60 * 1000 : MENTOR_SESSION_DAYS * 24 * 60 * 60 * 1000;
    saveSession({ user_id: u.id, expires_at: Date.now() + ttl });
  }

  function canAccessIntern(auth, intern) {
    const u = auth.user;
    if (u.role === "manager") return true;
    if (u.role === "mentor") return intern.mentor_id === u.id || intern.mentor_id == null;
    return intern.user_id === u.id;
  }

  // ---------------------------------------------------------------------------
  // Mock GitHub evidence + rule-based verdict (ports of github_service.py and
  // llm_service.py's mock paths — used only for newly assigned learning paths)
  // ---------------------------------------------------------------------------

  const MOCK_PR_POOL = [
    ["Add pagination to search endpoint", ["py", "py", "md"], 2],
    ["Fix race condition in cache invalidation", ["go", "go"], 3],
    ["Implement JWT-based auth middleware", ["ts", "ts", "json"], 1],
    ["Refactor test fixtures for API layer", ["py", "py", "py"], 0],
    ["Add retry logic with exponential backoff", ["ts", "ts"], 2],
    ["First pass: async job queue consumer", ["py", "yml"], 4],
    ["Improve error messages on validation failures", ["ts", "tsx"], 1],
    ["Add integration tests for webhook handler", ["py", "py"], 1],
    ["Optimize N+1 query in dashboard endpoint", ["py", "sql"], 2],
    ["Wire up CI pipeline for frontend build", ["yml", "json"], 0],
    ["Build reusable chart component", ["tsx", "css"], 2],
    ["Add rate limiting middleware", ["go"], 3],
  ];
  const MOCK_COMMIT_POOL = [
    "fix typo in README",
    "wip: exploring cache strategy",
    "address review comments",
    "add unit tests",
    "bump dependency versions",
    "small cleanup",
  ];
  const EXTENSION_LANGUAGE_MAP = {
    py: "Python", ts: "TypeScript", tsx: "TypeScript/React", js: "JavaScript", jsx: "JavaScript/React",
    go: "Go", rs: "Rust", java: "Java", rb: "Ruby", css: "CSS", html: "HTML", sql: "SQL",
    md: "Docs", yml: "Config/CI", yaml: "Config/CI", json: "Config",
  };

  function seededRng(seedStr) {
    let h = 2166136261;
    for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    let a = h >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function mockEvidence(repo, username, start, end) {
    const rng = seededRng(`${repo}:${username}:${start}:${end}`);
    const randint = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    const span = Math.max(Math.round((new Date(end) - new Date(start)) / 86400000), 1);
    const nPrs = randint(1, 3);
    const nCommits = randint(2, 5);
    const pool = MOCK_PR_POOL.map((_, i) => i);
    const out = [];
    for (let i = 0; i < nPrs; i++) {
      const [title, files, baseReviews] = MOCK_PR_POOL[pool.splice(randint(0, pool.length - 1), 1)[0]];
      const additions = randint(15, 260);
      out.push({
        source: "mock",
        url: `https://github.com/${repo}/pull/${1000 + randint(1, 999)}`,
        title,
        diff_stats: {
          additions,
          deletions: randint(2, Math.min(120, additions)),
          files_changed: files.length,
          languages: [...new Set(files.map((f) => EXTENSION_LANGUAGE_MAP[f] || f))].sort(),
        },
        review_iterations: Math.max(0, baseReviews + randint(-1, 1)),
        merged_at: `${addDaysIso(start, randint(0, span))}T00:00:00`,
      });
    }
    for (let i = 0; i < nCommits; i++) {
      const msg = MOCK_COMMIT_POOL[randint(0, MOCK_COMMIT_POOL.length - 1)];
      out.push({
        source: "mock",
        url: `https://github.com/${repo}/commit/${seededRng(msg)().toString(16).slice(2, 12)}`,
        title: msg,
        diff_stats: { additions: randint(1, 40), deletions: randint(0, 20), files_changed: randint(1, 4), languages: [] },
        review_iterations: 0,
        merged_at: `${addDaysIso(start, randint(0, span))}T00:00:00`,
      });
    }
    return out;
  }

  const STOPWORDS = new Set(
    "the a an and to of in on for with this that i we was is are it my our as at be by week period".split(" ")
  );
  const tokenize = (text) =>
    new Set((text.toLowerCase().match(/[a-z]+/g) || []).filter((w) => !STOPWORDS.has(w) && w.length > 2));

  function mockVerdict(planText, evidence) {
    const languages = [...new Set(evidence.flatMap((e) => e.diff_stats.languages || []))].sort();
    let summary;
    if (!evidence.length) {
      summary = "No code evidence was found for this period.";
    } else {
      const add = evidence.reduce((s, e) => s + e.diff_stats.additions, 0);
      const del = evidence.reduce((s, e) => s + e.diff_stats.deletions, 0);
      const prs = evidence.filter((e) => e.url.includes("pull")).length;
      summary =
        `[MOCK] Evidence shows ${evidence.length} item(s) (~${prs} PR-like changes) totalling +${add}/-${del} lines ` +
        `across ${languages.join(", ") || "unspecified languages"}. ` +
        `Representative work: ${evidence.slice(0, 4).map((e) => e.title).join(", ")}.`;
    }

    const planTokens = tokenize(planText);
    const evTokens = tokenize(summary);
    evidence.forEach((e) => tokenize(e.title).forEach((t) => evTokens.add(t)));
    const overlap = [...planTokens].filter((t) => evTokens.has(t)).length;
    const ratio = evTokens.size ? overlap / Math.max(planTokens.size, 1) : 0;
    const ratioPct = `${Math.round(ratio * 100)}%`;

    let match_status, confidence, reasoning;
    if (!evidence.length) {
      [match_status, confidence] = ["OFF_TRACK", 0.55];
      reasoning = "[MOCK] No supporting evidence was found for this period against the assigned learning path.";
    } else if (ratio >= 0.35) {
      [match_status, confidence] = ["ON_TRACK", Math.min(0.6 + ratio * 0.4, 0.95)];
      reasoning = `[MOCK] Evidence vocabulary overlaps ${ratioPct} with the assigned learning path.`;
    } else if (ratio >= 0.12) {
      [match_status, confidence] = ["PARTIALLY_ON_TRACK", 0.5 + ratio * 0.3];
      reasoning = `[MOCK] Some overlap (${ratioPct}) between evidence and the assigned plan, but coverage is incomplete.`;
    } else {
      [match_status, confidence] = ["OFF_TRACK", 0.45];
      reasoning = `[MOCK] Low overlap (${ratioPct}) between evidence and the assigned learning path.`;
    }

    const skill_tags = languages.length
      ? languages.map((l) => ({ skill_name: `worked with ${l}`, evidence_strength: 0.6 }))
      : [{ skill_name: "general contribution", evidence_strength: 0.3 }];

    return { ai_summary: summary, match_status, confidence: Math.round(confidence * 100) / 100, reasoning, skill_tags };
  }

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------

  const ui = {
    forms: {}, // formKey -> { field: value }
    files: {}, // formKey -> File
    pending: {}, // actionKey -> true
    errors: {}, // formKey -> message
    open: {}, // toggleKey -> true
    runs: {}, // learningPathId -> { logs, running, error }
    expandedMentors: new Set(),
    seenCards: new Set(), // verdict cards already shown (animate only on first mount)
    animateModal: false,
    openStat: null,
    modal: null,
    copied: false,
    inviteResult: null,
    flashDevLogin: false,
  };

  function resetViewState() {
    ui.forms = {};
    ui.files = {};
    ui.errors = {};
    ui.open = {};
    ui.openStat = null;
    ui.modal = null;
    ui.inviteResult = null;
  }

  const form = (key) => (ui.forms[key] = ui.forms[key] || {});
  const fv = (key, field, fallback = "") => {
    const f = form(key);
    return field in f ? f[field] : fallback;
  };

  /** Runs `fn` after a short simulated round-trip, showing the pending state
   *  in the meantime — keeps the original app's spinner/disabled feedback. */
  function withPending(key, fn, delay = 450) {
    if (ui.pending[key]) return;
    ui.pending[key] = true;
    render();
    setTimeout(() => {
      delete ui.pending[key];
      Promise.resolve()
        .then(fn)
        .catch((err) => console.error(err))
        .finally(render);
    }, delay);
  }

  // ---------------------------------------------------------------------------
  // Routing (hash-based, so it works on GitHub Pages with no server rewrites)
  // ---------------------------------------------------------------------------

  function currentPath() {
    const p = location.hash.replace(/^#/, "");
    return p.startsWith("/") ? p : "/";
  }

  function navigate(path, { replace = false } = {}) {
    if (currentPath() === path) {
      render();
      return;
    }
    resetViewState();
    if (replace) {
      history.replaceState(null, "", `#${path}`);
      render();
    } else {
      location.hash = path;
    }
  }

  function homeFor(auth) {
    if (!auth.authenticated) return "/";
    if (!auth.onboarding_complete) return "/onboarding/intern";
    if (auth.user.role === "manager") return "/manager";
    if (auth.user.role === "mentor") return "/mentor";
    if (auth.intern_id) return `/intern/${auth.intern_id}`;
    return "/";
  }

  // ---------------------------------------------------------------------------
  // Shared components
  // ---------------------------------------------------------------------------

  const STATUS_CFG = {
    ON_TRACK: { label: "On track", icon: "circle-check", fg: "var(--color-match)", bg: "var(--color-match-bg)" },
    PARTIALLY_ON_TRACK: {
      label: "Partially on track",
      icon: "triangle-alert",
      fg: "var(--color-partial)",
      bg: "var(--color-partial-bg)",
    },
    OFF_TRACK: { label: "Off track", icon: "circle-x", fg: "var(--color-discrepancy)", bg: "var(--color-discrepancy-bg)" },
  };
  const PROVIDER_LABEL = { nvidia: "NVIDIA", gemini: "Gemini (backup)", mock: "mock verdict" };

  function verdictBadge(status, size = "md") {
    const cfg = STATUS_CFG[status];
    return `<span class="badge badge-${size}" style="color:${cfg.fg};background-color:${cfg.bg}">${icon(
      cfg.icon,
      size === "sm" ? 12 : 14
    )}${cfg.label}</span>`;
  }

  function confidenceMeter(value, width = 96) {
    const p = pct(value);
    const color = p >= 70 ? "var(--color-match)" : p >= 45 ? "var(--color-partial)" : "var(--color-discrepancy)";
    return `<div class="meter"><div class="meter-track" style="width:${width}px"><div class="meter-fill" style="width:${p}%;background-color:${color}"></div></div><span class="meter-label">${p}%</span></div>`;
  }

  function skillTagPill(name, strength) {
    const opacity = 0.35 + Math.min(Math.max(strength, 0), 1) * 0.65;
    return `<span class="skill-pill" style="opacity:${opacity}" title="Evidence strength: ${pct(strength)}%">${esc(name)}</span>`;
  }

  function avatar(name, size = "md") {
    return `<span class="avatar avatar-${size}">${esc(initials(name))}</span>`;
  }

  function learningPathTable(table) {
    return `<div class="lp-table"><table><thead><tr>${table.headers
      .map((h) => `<th>${esc(h)}</th>`)
      .join("")}</tr></thead><tbody>${table.rows
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table></div>`;
  }

  function filePreviewButton(lp) {
    return `<button class="link-btn" data-action="preview-file" data-lp="${lp.id}">${icon("eye", 11)} Preview</button>`;
  }

  function sourceFileNote(lp, extraClass = "") {
    if (!lp.source_filename) return "";
    return `<span class="source-note ${extraClass}">(from ${esc(lp.source_filename)})${
      lp.has_file ? filePreviewButton(lp) : ""
    }</span>`;
  }

  function evidenceList(evidence, key) {
    if (!evidence.length) return `<p class="text-xs muted">No evidence found for this period.</p>`;
    const open = !!ui.open[key];
    return `<div>
      <button class="evidence-toggle" data-action="toggle" data-key="${key}">
        ${icon("chevron-down", 13, open ? "rotate-180" : "")}
        ${evidence.length} evidence item${evidence.length === 1 ? "" : "s"}
      </button>
      ${
        open
          ? `<ul class="evidence-list">${evidence
              .map((e) => {
                const s = e.diff_stats;
                return `<li>
                  <a href="${esc(e.url)}" target="_blank" rel="noreferrer" class="evidence-link">
                    ${icon(e.url.includes("/pull/") ? "git-pull-request" : "git-commit-horizontal", 12)}
                    ${esc(e.title)}
                    ${icon("external-link", 10, "dim")}
                  </a>
                  <span class="muted"> +${s.additions}/-${s.deletions} · ${s.files_changed} files${
                  s.languages && s.languages.length ? ` · ${esc(s.languages.join(", "))}` : ""
                }${e.review_iterations > 0 ? ` · ${e.review_iterations} review round(s)` : ""}</span>
                </li>`;
              })
              .join("")}</ul>`
          : ""
      }
    </div>`;
  }

  const STATUS_OPTIONS = ["ON_TRACK", "PARTIALLY_ON_TRACK", "OFF_TRACK"];

  function verdictCard(lp, verdict, { internName, showActions = false, scope = "" } = {}) {
    const key = `verdict-${scope}-${verdict.id}`;
    const overriding = !!ui.open[`${key}-override`];
    const pending = !!ui.pending[`decide-${verdict.id}`];
    const overrideStatus = fv(key, "status", verdict.match_status);
    const provider =
      verdict.source_mode === "mock"
        ? `<span class="provider-tag" title="No AI provider configured (or all failed) — using rule-based mock verdicts">${icon(
            "flask-conical",
            10
          )} mock verdict</span>`
        : `<span class="provider-tag"${
            verdict.source_mode === "gemini" ? ` title="NVIDIA was unavailable — fell back to Gemini"` : ""
          }>${icon("cpu", 10)} ${PROVIDER_LABEL[verdict.source_mode]}</span>`;

    let actions = "";
    if (showActions && !verdict.mentor_override) {
      actions = `<div class="card-actions">${
        !overriding
          ? `<div class="row wrap gap-2">
              <button class="btn btn-sm btn-success" data-action="confirm-verdict" data-verdict="${verdict.id}" ${
              pending ? "disabled" : ""
            }>${icon("check")} Confirm</button>
              <button class="btn btn-sm btn-outline" data-action="toggle" data-key="${key}-override">${icon(
              "pencil"
            )} Override</button>
            </div>`
          : `<div class="stack-2">
              <div class="row wrap gap-2">${STATUS_OPTIONS.map(
                (s) =>
                  `<button class="choice-pill ${overrideStatus === s ? "active" : ""}" data-action="set-field" data-form="${key}" data-field="status" data-value="${s}">${s.replace(
                    /_/g,
                    " "
                  )}</button>`
              ).join("")}</div>
              <textarea class="input" rows="2" placeholder="Note for the record (optional)" data-form="${key}" data-field="note">${esc(
                fv(key, "note")
              )}</textarea>
              <div class="row gap-2">
                <button class="btn btn-sm btn-primary" data-action="override-verdict" data-verdict="${verdict.id}" data-form="${key}" ${
              pending ? "disabled" : ""
            }>Save override</button>
                <button class="btn btn-sm btn-outline" data-action="toggle" data-key="${key}-override">Cancel</button>
              </div>
            </div>`
      }</div>`;
    }

    const override = verdict.mentor_override
      ? `<div class="override-note">${icon("check", 13, "", "color:var(--color-match)")}<span><strong>${esc(
          verdict.mentor_override.mentor_name
        )}</strong> ${verdict.mentor_override.status.toLowerCase()} this verdict${
          verdict.mentor_override.note ? `: "${esc(verdict.mentor_override.note)}"` : "."
        }</span></div>`
      : "";

    const anim = ui.seenCards.has(key) ? "" : "fade-in-up";
    ui.seenCards.add(key);
    return `<div class="card card-pad-4 ${anim}">
      <div class="row wrap between gap-2">
        <div class="row gap-2">
          ${internName ? `<span class="text-sm semibold">${esc(internName)}</span>` : ""}
          <span class="text-xs muted">${lp.period_start} → ${lp.period_end}</span>
          ${provider}
        </div>
        <div class="row gap-3">${verdictBadge(verdict.match_status, "sm")}${confidenceMeter(verdict.confidence, 70)}</div>
      </div>
      <div class="grid-2 mt-3">
        <div>
          <p class="eyebrow">Assigned: ${esc(lp.title)}${sourceFileNote(lp, "normal-case")}</p>
          <p class="mt-1 text-sm">${esc(lp.description)}</p>
          ${lp.extracted_table ? learningPathTable(lp.extracted_table) : ""}
        </div>
        <div>
          <p class="eyebrow">Evidence-based summary</p>
          <p class="mt-1 text-sm">${esc(verdict.ai_summary)}</p>
        </div>
      </div>
      <div class="reasoning mt-3">
        <span class="eyebrow">Reasoning</span>
        <p class="mt-1">${esc(verdict.reasoning)}</p>
      </div>
      ${
        verdict.skill_tags.length
          ? `<div class="row wrap gap-1-5 mt-3">${verdict.skill_tags
              .map((t) => skillTagPill(t.skill_name, t.evidence_strength))
              .join("")}</div>`
          : ""
      }
      <div class="mt-3">${evidenceList(verdict.evidence, `${key}-evidence`)}</div>
      ${override}
      ${actions}
    </div>`;
  }

  function runLog(lpId) {
    const run = ui.runs[lpId];
    if (!run || (!run.running && !run.logs.length)) return "";
    return `<div class="run-log" id="run-log-${lpId}">
      <div class="run-log-head">${icon("terminal", 11)} analysis log</div>
      ${run.logs.map((l) => `<div><span class="run-log-prompt">$</span> ${esc(l)}</div>`).join("")}
      ${run.running ? `<div class="run-log-cursor">▍</div>` : ""}
    </div>`;
  }

  function generateSummaryButton(lp, existingVerdict) {
    const run = ui.runs[lp.id] || { logs: [], running: false, error: null };
    const isRerun = !!existingVerdict;
    const label = run.running ? "Analyzing…" : isRerun ? "Re-run analysis" : "Generate progress summary";
    const btnIcon = run.running ? spinner() : icon(isRerun ? "refresh-cw" : "sparkles");
    return `<div class="dashed-box" data-run="${lp.id}">
      <div class="row between gap-3">
        ${
          !isRerun
            ? `<div>
                <p class="text-sm medium">${esc(lp.title)}${sourceFileNote(lp, "text-xs normal muted")}</p>
                <p class="text-xs muted">${lp.period_start} → ${lp.period_end}</p>
                <p class="mt-1 text-sm">${esc(lp.description)}</p>
                ${lp.extracted_table ? learningPathTable(lp.extracted_table) : ""}
              </div>`
            : `<p class="text-xs muted">Re-analyze this period's GitHub evidence against the learning path.</p>`
        }
        <button class="btn btn-primary shrink-0" data-action="run-analysis" data-lp="${lp.id}" data-rerun="${
      isRerun ? 1 : 0
    }" ${run.running ? "disabled" : ""}>${btnIcon} ${label}</button>
      </div>
      ${runLog(lp.id)}
      ${run.error ? `<p class="mt-2 text-xs error">${esc(run.error)}</p>` : ""}
    </div>`;
  }

  function modalShell(title, body, { size = "max-w-2xl", titleClass = "text-base" } = {}) {
    return `<div class="modal-backdrop" data-action="close-modal">
      <div class="modal ${size} ${ui.animateModal ? "modal-anim" : ""}" data-action="noop" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3 class="${titleClass} semibold truncate">${esc(title)}</h3>
          <button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button>
        </div>
        ${body}
      </div>
    </div>`;
  }

  function fileInput(formKey, required = true) {
    const file = ui.files[formKey];
    return `<div class="file-drop">
      ${icon("file-text", 14, "muted shrink-0")}
      <label class="file-picker">
        <input type="file" accept="${ACCEPTED_EXTENSIONS}" data-file-form="${formKey}" ${
      required && !file ? "required" : ""
    } />
        <span class="file-btn">Choose file</span>
        <span class="file-name">${file ? esc(file.name) : "No file chosen"}</span>
      </label>
    </div>`;
  }

  // ---------------------------------------------------------------------------
  // Charts (hand-drawn SVG equivalents of the Recharts components)
  // ---------------------------------------------------------------------------

  function monotonePath(pts) {
    // Monotone cubic interpolation along x (same curve family as Recharts'
    // `type="monotone"` / d3.curveMonotoneX).
    const n = pts.length;
    if (n < 2) return "";
    if (n === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`;
    const dx = [], dy = [], m = [];
    for (let i = 0; i < n - 1; i++) {
      dx.push(pts[i + 1].x - pts[i].x);
      dy.push(pts[i + 1].y - pts[i].y);
      m.push(dy[i] / dx[i]);
    }
    const t = [m[0]];
    for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
    t.push(m[n - 2]);
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) {
        t[i] = t[i + 1] = 0;
        continue;
      }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) {
        const k = 3 / Math.sqrt(s);
        t[i] = k * a * m[i];
        t[i + 1] = k * b * m[i];
      }
    }
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += `C${pts[i].x + h},${pts[i].y + t[i] * h},${pts[i + 1].x - h},${pts[i + 1].y - t[i + 1] * h},${pts[i + 1].x},${pts[i + 1].y}`;
    }
    return d;
  }

  function growthChart(tl) {
    const data = tl
      .filter((t) => t.verdict)
      .map((t) => ({
        period: t.learning_path.period_start,
        confidence: pct(t.verdict.confidence),
        status: t.verdict.match_status,
      }));
    if (!data.length) return `<div class="chart-empty h-40">No verdicts yet</div>`;
    return `<div class="growth-chart" data-chart="growth" data-points='${esc(JSON.stringify(data))}'></div>`;
  }

  function drawGrowthChart(el) {
    const data = JSON.parse(el.dataset.points);
    const W = el.clientWidth || 600, H = 208;
    const left = 40, right = W - 12, top = 8, bottom = H - 30;
    const x = (i) => (data.length === 1 ? (left + right) / 2 : left + (i * (right - left)) / (data.length - 1));
    const y = (v) => bottom - (v / 100) * (bottom - top);
    const pts = data.map((d, i) => ({ x: x(i), y: y(d.confidence) }));
    const ticks = [0, 25, 50, 75, 100];
    let svg = `<svg width="${W}" height="${H}" class="chart-svg">`;
    ticks.forEach((t) => (svg += `<line x1="${left}" x2="${right}" y1="${y(t)}" y2="${y(t)}" class="grid-line"/>`));
    data.forEach((_, i) => (svg += `<line x1="${x(i)}" x2="${x(i)}" y1="${top}" y2="${bottom}" class="grid-line"/>`));
    svg += `<line x1="${left}" x2="${left}" y1="${top}" y2="${bottom}" class="axis-line"/>`;
    svg += `<line x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" class="axis-line"/>`;
    ticks.forEach(
      (t) => (svg += `<text x="${left - 8}" y="${y(t)}" class="tick" text-anchor="end" dominant-baseline="middle">${t}</text>`)
    );
    data.forEach((d, i) => {
      const anchor = data.length > 1 && i === 0 ? "start" : data.length > 1 && i === data.length - 1 ? "end" : "middle";
      svg += `<text x="${x(i)}" y="${bottom + 16}" class="tick" text-anchor="${anchor}">${d.period}</text>`;
    });
    svg += `<line class="cursor-line" x1="0" x2="0" y1="${top}" y2="${bottom}" style="display:none"/>`;
    svg += `<path d="${monotonePath(pts)}" fill="none" stroke="var(--color-accent)" stroke-width="2"/>`;
    pts.forEach(
      (p, i) =>
        (svg += `<circle cx="${p.x}" cy="${p.y}" r="5" fill="${STATUS_CFG[data[i].status].fg}" stroke="var(--surface)" stroke-width="2"/>`)
    );
    svg += `</svg><div class="chart-tooltip" style="display:none"></div>`;
    el.innerHTML = svg;

    const cursor = el.querySelector(".cursor-line");
    const tip = el.querySelector(".chart-tooltip");
    el.onmousemove = (e) => {
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      if (mx < left - 10 || mx > right + 10) return el.onmouseleave();
      let best = 0;
      pts.forEach((p, i) => Math.abs(p.x - mx) < Math.abs(pts[best].x - mx) && (best = i));
      cursor.setAttribute("x1", pts[best].x);
      cursor.setAttribute("x2", pts[best].x);
      cursor.style.display = "";
      tip.innerHTML = `<div class="tip-label">${data[best].period}</div><div style="color:var(--color-accent)">confidence : ${data[best].confidence}</div>`;
      tip.style.display = "";
      const tx = pts[best].x + 12 + tip.offsetWidth > W ? pts[best].x - 12 - tip.offsetWidth : pts[best].x + 12;
      tip.style.left = `${tx}px`;
      tip.style.top = `${Math.max(0, pts[best].y - tip.offsetHeight / 2)}px`;
    };
    el.onmouseleave = () => {
      cursor.style.display = "none";
      tip.style.display = "none";
    };
  }

  function distributionChart(summary) {
    const data = [
      { name: "On track", value: summary.on_track_count, color: "var(--color-match)" },
      { name: "Partially on track", value: summary.partially_on_track_count, color: "var(--color-partial)" },
      { name: "Off track", value: summary.off_track_count, color: "var(--color-discrepancy)" },
    ];
    const total = data.reduce((s, d) => s + d.value, 0);
    if (!total) return `<div class="chart-empty h-48">No verdicts yet</div>`;

    // Donut geometry matches the Recharts <Pie>: 192px box, inner 55, outer
    // 80, 3° padding, starting at 3 o'clock and sweeping counter-clockwise.
    const cx = 96, cy = 96, ri = 55, ro = 80, padding = 3;
    const nonZero = data.filter((d) => d.value > 0);
    const usable = 360 - (nonZero.length > 1 ? nonZero.length * padding : 0);
    const polar = (r, deg) => [cx + r * Math.cos((-deg * Math.PI) / 180), cy + r * Math.sin((-deg * Math.PI) / 180)];
    let angle = 0;
    let paths = "";
    nonZero.forEach((d) => {
      const sweep = (d.value / total) * usable;
      const a0 = angle, a1 = angle + Math.min(sweep, 359.99);
      const large = a1 - a0 > 180 ? 1 : 0;
      const [x0, y0] = polar(ro, a0), [x1, y1] = polar(ro, a1);
      const [x2, y2] = polar(ri, a1), [x3, y3] = polar(ri, a0);
      paths += `<path d="M${x0},${y0}A${ro},${ro} 0 ${large} 0 ${x1},${y1}L${x2},${y2}A${ri},${ri} 0 ${large} 1 ${x3},${y3}Z" fill="${d.color}" data-tip="${esc(
        d.name
      )} : ${d.value}" class="pie-slice"/>`;
      angle = a1 + (nonZero.length > 1 ? padding : 0);
    });

    return `<div class="row gap-6">
      <div class="pie-box" data-chart="pie"><svg width="192" height="192" viewBox="0 0 192 192">${paths}</svg><div class="chart-tooltip" style="display:none"></div></div>
      <ul class="legend">${data
        .map(
          (d) =>
            `<li><span class="dot" style="background-color:${d.color}"></span><span class="muted">${d.name}</span><span class="legend-value">${d.value}</span></li>`
        )
        .join("")}</ul>
    </div>`;
  }

  function wirePie(el) {
    const tip = el.querySelector(".chart-tooltip");
    el.onmousemove = (e) => {
      const slice = e.target.closest(".pie-slice");
      if (!slice) {
        tip.style.display = "none";
        return;
      }
      const rect = el.getBoundingClientRect();
      tip.textContent = slice.dataset.tip;
      tip.style.display = "";
      tip.style.left = `${e.clientX - rect.left + 12}px`;
      tip.style.top = `${e.clientY - rect.top + 12}px`;
    };
    el.onmouseleave = () => (tip.style.display = "none");
  }

  function drawCharts() {
    document.querySelectorAll('[data-chart="growth"]').forEach(drawGrowthChart);
    document.querySelectorAll('[data-chart="pie"]').forEach(wirePie);
  }

  // ---------------------------------------------------------------------------
  // Navbar
  // ---------------------------------------------------------------------------

  function navbar(auth) {
    const path = currentPath();
    const link = (href, label) =>
      `<a href="#${href}" class="nav-link ${path === href ? "active" : ""}">${label}</a>`;
    let links = "";
    if (auth.authenticated && auth.user.role === "manager") links = link("/manager", "Manager view");
    if (auth.authenticated && auth.user.role === "mentor") links = link("/mentor", "Mentor view");
    if (auth.authenticated && auth.user.role === "intern" && auth.intern_id)
      links = link(`/intern/${auth.intern_id}`, "My dashboard");

    const userMenu =
      auth.authenticated && auth.user
        ? `<div class="row gap-2">
            ${
              auth.user.avatar_url
                ? `<img src="${esc(auth.user.avatar_url)}" alt="" class="avatar-img"/>`
                : `<span class="avatar avatar-xs">${esc(auth.user.name.slice(0, 1).toUpperCase())}</span>`
            }
            <span class="text-sm medium hide-sm">${esc(auth.user.name)}</span>
            ${auth.user.role ? `<span class="role-pill">${auth.user.role}</span>` : ""}
            <button class="icon-btn" data-action="logout" title="Log out" aria-label="Log out">${icon("log-out")}</button>
          </div>`
        : "";

    return `<header class="navbar">
      <div class="navbar-inner">
        <a href="#/" class="brand"><span class="brand-mark">${icon("activity", 16)}</span>TeaM Pulse</a>
        <nav class="row gap-1">${links}</nav>
        <div class="row gap-3">
          <span class="mode-pill" title="Static demo — no AI provider is called. Recorded NVIDIA verdicts are replayed; new learning paths use the rule-based mock.">
            <span class="mode-dot"></span>AI: mock
          </span>
          ${userMenu}
        </div>
      </div>
    </header>`;
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  const ROLE_ORDER = ["manager", "mentor", "intern"];
  const ROLE_LABEL = { manager: "Managers", mentor: "Mentors", intern: "Interns" };

  function viewLanding() {
    const loginPending = !!ui.pending.emailLogin;
    const devUsers = db.users.filter((u) => u.role);
    return `<div class="container-3xl center py-16">
      <span class="hero-pill">${icon("sparkles", 12)} AI evidence-gathering, human judgment</span>
      <h1 class="hero-title">TeaM Pulse</h1>
      <p class="hero-sub">Mentors set the learning path. Interns connect their repo. TeaM Pulse compares what the
        code actually shows against what was assigned — and only pulls a human in when judgment
        is actually needed.</p>

      <div class="grid-sm-2 mt-10 left">
        <div class="card card-pad-5 flat">
          ${icon("git-fork", 18, "accent")}
          <p class="mt-2 medium">I'm an intern</p>
          <p class="mt-1 text-xs muted">Sign in with GitHub — first login sets you up.</p>
          <button class="btn btn-primary btn-lg mt-4" data-action="github-login">${icon("git-fork")} Continue with GitHub</button>
          <p class="mt-2 text-xs muted">GitHub OAuth isn't configured on this instance yet — use dev login below.</p>
        </div>

        <div class="card card-pad-5 flat">
          ${icon("shield-check", 18, "accent")}
          <p class="mt-2 medium">I'm a mentor or manager</p>
          <p class="mt-1 text-xs muted">Sign in with the email your manager added you with.</p>
          <form class="mt-4 stack-2" data-submit="email-login">
            <input type="email" required class="input input-lg" placeholder="you@company.com" data-form="login" data-field="email" value="${esc(
              fv("login", "email")
            )}" autocomplete="username"/>
            <input type="password" required class="input input-lg" placeholder="Password" data-form="login" data-field="password" value="${esc(
              fv("login", "password")
            )}" autocomplete="current-password"/>
            <button type="submit" class="btn btn-primary btn-block" ${loginPending ? "disabled" : ""}>${
      loginPending ? spinner() : icon("log-in")
    } Sign in</button>
            ${ui.errors.login ? `<p class="text-xs error">${esc(ui.errors.login)}</p>` : ""}
            <p class="text-xs muted">New mentors are added by a manager, who sends an invite link to your email.</p>
          </form>
        </div>
      </div>

      <div class="grid-sm-3 mt-10 left">
        <div class="card card-pad-4 flat">${icon("target", 16, "accent")}<p class="mt-2 text-sm medium">Mentor sets the plan</p><p class="mt-1 text-xs muted">A learning path with clear goals for the period.</p></div>
        <div class="card card-pad-4 flat">${icon("git-fork", 16, "accent")}<p class="mt-2 text-sm medium">Intern connects a repo</p><p class="mt-1 text-xs muted">Real PRs and commits become the evidence.</p></div>
        <div class="card card-pad-4 flat">${icon("shield-check", 16, "accent")}<p class="mt-2 text-sm medium">AI compares, mentor confirms</p><p class="mt-1 text-xs muted">Only ambiguous cases need a human call.</p></div>
      </div>

      <div id="dev-login" class="dev-login mt-12 left ${ui.flashDevLogin ? "flash" : ""}">
        <p class="dev-login-title">Dev login (testing convenience — bypasses real GitHub OAuth and email/password)</p>
        ${ROLE_ORDER.map((role) => {
          const forRole = devUsers.filter((u) => u.role === role);
          if (!forRole.length) return "";
          return `<div class="mt-3">
            <p class="text-11 medium muted">${ROLE_LABEL[role]}</p>
            <div class="row wrap gap-2 mt-1-5">${forRole
              .map((u) => `<button class="chip" data-action="dev-login" data-user="${u.id}">${esc(u.name)}</button>`)
              .join("")}</div>
          </div>`;
        }).join("")}
        <form class="row gap-2 mt-3" data-submit="dev-login-new">
          <input class="input input-sm flex-1" placeholder="new-dev-username (creates a fresh intern account)" data-form="devlogin" data-field="login" value="${esc(
            fv("devlogin", "login")
          )}"/>
          <button type="submit" class="chip-btn">Log in as new intern</button>
        </form>
        <div class="row between wrap gap-2 mt-3 static-note">
          <span>Static demo: all data is hardcoded and changes are saved only in this browser. Demo password for every mentor/manager: <code>${DEMO_PASSWORD}</code></span>
          <button class="chip-btn" data-action="reset-demo">${icon("rotate-ccw", 12)} Reset demo data</button>
        </div>
      </div>
    </div>`;
  }

  function viewOnboarding() {
    const pending = !!ui.pending.onboarding;
    const mentors = db.users.filter((u) => u.role === "mentor").map(userOut);
    return `<div class="container-lg py-16">
      <h1 class="text-2xl semibold">Set up your profile</h1>
      <p class="mt-2 text-sm muted">Connect the repo you're working on — TeaM Pulse pulls PR and commit evidence from it to
        compare against whatever learning path your mentor assigns.</p>
      <form class="card card-pad-5 flat mt-6 stack-4" data-submit="onboarding">
        <label class="field text-sm">Mentor
          <select class="input input-lg mt-1" data-form="onboarding" data-field="mentor_id">
            <option value="">Unassigned (pick later)</option>
            ${mentors
              .map(
                (m) =>
                  `<option value="${m.id}" ${String(m.id) === fv("onboarding", "mentor_id") ? "selected" : ""}>${esc(m.name)}${
                    m.team_name ? ` — ${esc(m.team_name)}` : ""
                  }</option>`
              )
              .join("")}
          </select>
          <span class="hint">Your team will automatically match your mentor's team.</span>
        </label>
        <label class="field text-sm">Repo you're working on
          <input required class="input input-lg mt-1" placeholder="owner/repo" data-form="onboarding" data-field="repo" value="${esc(
            fv("onboarding", "repo")
          )}"/>
          <span class="hint">e.g. <code>your-org/your-project</code>. You can change this later.</span>
        </label>
        <div><button type="submit" class="btn btn-primary btn-lg" ${pending ? "disabled" : ""}>${
      pending ? spinner() : icon("rocket")
    } Finish setup</button></div>
        ${ui.errors.onboarding ? `<p class="text-xs error">${esc(ui.errors.onboarding)}</p>` : ""}
      </form>
    </div>`;
  }

  function viewInvite(token) {
    const invitee = db.users.find((u) => u.invite_token && u.invite_token === token);
    let body;
    if (!invitee) {
      body = `<div class="row gap-2 text-sm error">${icon("circle-x", 16)}
        This invite link is invalid, already used, or has expired. Ask your manager to resend it.</div>`;
    } else {
      const pending = !!ui.pending.invite;
      body = `<form class="stack-4" data-submit="accept-invite" data-token="${esc(token)}">
        <div class="success-box">${icon("circle-check", 16)} Invite valid for ${esc(invitee.name)} &lt;${esc(invitee.email)}&gt;</div>
        <label class="field text-sm">Set a password
          <input type="password" required minlength="8" class="input input-lg mt-1" data-form="invite" data-field="password" value="${esc(
            fv("invite", "password")
          )}" autocomplete="new-password"/>
        </label>
        <label class="field text-sm">Confirm password
          <input type="password" required minlength="8" class="input input-lg mt-1" data-form="invite" data-field="confirm" value="${esc(
            fv("invite", "confirm")
          )}" autocomplete="new-password"/>
        </label>
        <div><button type="submit" class="btn btn-primary btn-lg" ${pending ? "disabled" : ""}>${
        pending ? spinner() : ""
      } Set password &amp; sign in</button></div>
        ${ui.errors.invite ? `<p class="text-xs error">${esc(ui.errors.invite)}</p>` : ""}
      </form>`;
    }
    return `<div class="container-md py-16">
      <h1 class="text-2xl semibold">Welcome to TeaM Pulse</h1>
      <p class="mt-2 text-sm muted">Set a password to finish setting up your account.</p>
      <div class="card card-pad-5 mt-6">${body}</div>
    </div>`;
  }

  function learningPathForm(internId, defaultStart) {
    const key = `lpform-${internId}`;
    if (!ui.open[key]) {
      return `<button class="btn btn-dashed" data-action="toggle" data-key="${key}">${icon("plus")} Assign a new learning path</button>`;
    }
    const mode = fv(key, "mode", "text");
    const start = fv(key, "period_start", defaultStart);
    const end = fv(key, "period_end", addDaysIso(defaultStart, 13));
    const pending = !!ui.pending[key];
    return `<form class="card card-pad-4" data-submit="create-lp" data-intern="${internId}" data-form="${key}">
      <label class="field text-xs muted">Title
        <input required class="input mt-1" placeholder="e.g. Sprint 3: Backend fundamentals" data-form="${key}" data-field="title" value="${esc(
      fv(key, "title")
    )}"/>
      </label>
      <div class="segmented mt-3">
        <button type="button" class="${mode === "text" ? "active" : ""}" data-action="set-field" data-form="${key}" data-field="mode" data-value="text">${icon(
      "pen-line",
      12
    )} Write it</button>
        <button type="button" class="${mode === "file" ? "active" : ""}" data-action="set-field" data-form="${key}" data-field="mode" data-value="file">${icon(
      "upload",
      12
    )} Upload a file</button>
      </div>
      ${
        mode === "text"
          ? `<label class="field text-xs muted mt-3">What should they focus on this period?
              <textarea required rows="3" class="input mt-1" data-form="${key}" data-field="description">${esc(
              fv(key, "description")
            )}</textarea>
            </label>`
          : `<div class="field text-xs muted mt-3">Syllabus / curriculum file (.txt, .md, .pdf, image, or .xlsx)
              ${fileInput(key)}
              <span class="hint-11">AI extracts a summary and, where possible, a structured table from the file — used the
                same way a typed description would be.</span>
            </div>`
      }
      ${periodFields(key, start, end)}
      <div class="row gap-2 mt-3">
        <button type="submit" class="btn btn-sm btn-primary" ${pending ? "disabled" : ""}>${pending ? spinner() : ""}${
      pending && mode === "file" ? "Extracting & assigning…" : "Assign"
    }</button>
        <button type="button" class="btn btn-sm btn-outline" data-action="toggle" data-key="${key}">Cancel</button>
        ${ui.errors[key] ? `<span class="text-xs error">${esc(ui.errors[key])}</span>` : ""}
      </div>
    </form>`;
  }

  function periodFields(key, start, end) {
    return `<div class="row gap-3 mt-3">
      <label class="field flex-1 text-xs muted">Period start
        <input type="date" required class="input mt-1" data-form="${key}" data-field="period_start" value="${start}"/>
      </label>
      <label class="field flex-1 text-xs muted">Period end
        <input type="date" required class="input mt-1" data-form="${key}" data-field="period_end" value="${end}"/>
      </label>
    </div>`;
  }

  function viewIntern(auth, internId) {
    const raw = internById(internId);
    if (!raw || !canAccessIntern(auth, raw)) {
      return `<div class="container-4xl py-10 text-sm error">You don't have access to this intern's data.</div>`;
    }
    const intern = internOut(raw);
    const tl = timeline(internId);
    const isMentorOfThisIntern = auth.user.role === "mentor" && auth.user.id === intern.mentor_id;

    const tagMap = new Map();
    tl.forEach((e) =>
      (e.verdict ? e.verdict.skill_tags : []).forEach((t) =>
        tagMap.set(t.skill_name, Math.max(tagMap.get(t.skill_name) || 0, t.evidence_strength))
      )
    );
    const skillTags = [...tagMap.entries()].sort((a, b) => b[1] - a[1]);
    const last = tl.length ? tl[tl.length - 1].learning_path.period_end : null;
    const nextStart = last || todayIso();

    return `<div class="container-4xl py-10">
      <div class="card card-pad-5">
        <div>
          <h1 class="text-xl semibold">${esc(intern.name)}</h1>
          <div class="row wrap gap-3 mt-1 text-xs muted">
            <span class="row gap-1">${icon("user", 12)} ${esc(intern.team_name || "no team set")} · mentored by ${esc(
      intern.mentor_name || "unassigned"
    )}</span>
            <span class="row gap-1">${icon("git-branch", 12)} ${esc(intern.repo || "no repo connected")} (@${esc(
      intern.github_username
    )})</span>
            <span class="row gap-1">${icon("calendar-days", 12)} since ${intern.start_date}</span>
          </div>
        </div>
        ${
          skillTags.length
            ? `<div class="row wrap gap-1-5 mt-4 pt-4 border-t">${skillTags.map(([n, s]) => skillTagPill(n, s)).join("")}</div>`
            : ""
        }
      </div>

      <div class="card card-pad-5 mt-5">
        <h2 class="section-title">Growth timeline</h2>
        <div class="mt-3">${growthChart(tl)}</div>
      </div>

      ${isMentorOfThisIntern ? `<div class="mt-5">${learningPathForm(internId, nextStart)}</div>` : ""}

      <div class="mt-8 stack-4">
        <h2 class="section-title">Learning path history</h2>
        ${[...tl]
          .reverse()
          .map((e) => (e.verdict ? verdictCard(e.learning_path, e.verdict, { scope: "intern" }) : generateSummaryButton(e.learning_path)))
          .join("")}
        ${
          !tl.length
            ? `<div class="empty-box">${
                isMentorOfThisIntern
                  ? "No learning paths yet — assign the first one above."
                  : "Your mentor hasn't assigned a learning path yet."
              }</div>`
            : ""
        }
      </div>
    </div>`;
  }

  function statCard(label, value, iconName, accent) {
    return `<div class="card card-pad-4">
      <div class="row between">
        <span class="eyebrow">${label}</span>
        <span class="stat-icon" style="background-color:${accent ? `color-mix(in srgb, ${accent} 10%, transparent)` : "var(--color-accent-bg)"}">${icon(
      iconName,
      15,
      "",
      `color:${accent || "var(--color-accent)"}`
    )}</span>
      </div>
      <div class="mt-2 text-2xl semibold">${value}</div>
    </div>`;
  }

  function viewMentor(auth) {
    const me = auth.user;
    const myInternIds = mentorInternIds(me.id);
    const summary = cohortSummary(myInternIds);
    const interns = myInternIds.map((id) => internOut(internById(id)));
    const unassigned = db.interns.filter((i) => i.mentor_id == null).map(internOut);
    const queue = reviewQueue(myInternIds);

    return `<div class="container-6xl py-10">
      <h1 class="text-2xl semibold tight">Mentor &amp; leadership view</h1>
      <p class="mt-1 text-sm muted">Everything above the confidence threshold has already auto-published. This queue is only
        what needs a human judgment call.</p>

      <div class="grid-stats mt-6">
        ${statCard("Interns", String(summary.total_interns), "users")}
        ${statCard("Learning paths", String(summary.total_learning_paths), "list-tree")}
        ${statCard("On track", `${pct(summary.on_track_ratio)}%`, "shield-check")}
        ${statCard(
          "Needs review",
          String(summary.pending_review_count),
          "clipboard-check",
          summary.pending_review_count > 0 ? "var(--color-partial)" : undefined
        )}
      </div>

      <div class="card card-pad-5 mt-6">
        <h2 class="section-title">Cohort verdict distribution</h2>
        <div class="mt-4">${distributionChart(summary)}</div>
      </div>

      <div class="mt-8">
        <h2 class="section-title">My interns</h2>
        <div class="grid-cards mt-3">
          ${interns
            .map(
              (i) => `<a href="#/intern/${i.id}" class="card card-pad-4 intern-card">
                <div class="row gap-3">${avatar(i.name, "lg")}<div><div class="text-sm medium">${esc(i.name)}</div><div class="text-xs muted">${esc(
                i.team_name || "no team set"
              )}</div></div></div>
                ${icon("arrow-right", 14, "hover-arrow")}
              </a>`
            )
            .join("")}
          ${!interns.length ? `<div class="empty-box span-all">No interns have picked you as their mentor yet.</div>` : ""}
        </div>
      </div>

      ${
        unassigned.length
          ? `<div class="mt-8">
              <h2 class="section-title row gap-2">${icon("user-plus")} Unassigned interns (${unassigned.length})</h2>
              <p class="mt-1 text-xs muted">These interns signed up without picking a mentor yet — claim one to add them to your roster.</p>
              <div class="grid-cards mt-3">${unassigned
                .map(
                  (i) => `<div class="card card-pad-4 dashed row between gap-2">
                    <div class="row gap-3">${avatar(i.name, "lg")}<div><div class="text-sm medium">${esc(i.name)}</div><div class="text-xs muted">@${esc(
                    i.github_username
                  )}</div></div></div>
                    <button class="btn btn-xs btn-primary shrink-0" data-action="claim-intern" data-intern="${i.id}" ${
                    ui.pending.claim ? "disabled" : ""
                  }>${ui.pending.claim ? spinner(12) : icon("link-2", 12)} Assign to me</button>
                  </div>`
                )
                .join("")}</div>
            </div>`
          : ""
      }

      <div class="mt-8">
        <h2 class="section-title">Review queue (${queue.length})</h2>
        <div class="mt-3 stack-4">
          ${
            !queue.length
              ? `<div class="empty-box">Nothing needs a human right now — every verdict is confident and consistent.</div>`
              : ""
          }
          ${queue.map((v) => verdictCard(v.learning_path, v, { internName: v.intern_name, showActions: true, scope: "queue" })).join("")}
        </div>
      </div>
    </div>`;
  }

  // ---- Manager -------------------------------------------------------------

  function statBlock(label, value, statKey, details) {
    return `<div role="button" tabindex="0" class="stat-block" data-action="open-stat" data-stat="${statKey}">
      <div class="stat-block-label">${label}</div>
      <div class="stat-block-value">${value}</div>
      <div class="stat-popover">${details}</div>
    </div>`;
  }

  function mentorRow(mentor, action, { expandable = false, expanded = false } = {}) {
    const nameBlock = `<div class="row gap-2">
      ${avatar(mentor.name, "sm")}
      <div>
        <div class="row gap-1-5"><span class="text-sm medium">${esc(mentor.name)}</span>${
      mentor.pending_invite
        ? `<span class="pending-pill" title="Hasn't accepted their invite yet">${icon("clock", 9)} pending</span>`
        : ""
    }</div>
        <div class="text-11 muted">${mentor.intern_count || 0} intern(s)</div>
      </div>
    </div>`;
    return `<div class="mentor-row">
      ${
        expandable
          ? `<button class="mentor-toggle" data-action="toggle-mentor" data-mentor="${mentor.id}" title="${
              expanded ? "Hide interns" : "Show this mentor's interns"
            }">${icon(expanded ? "chevron-down" : "chevron-right", 13, "muted shrink-0")}${nameBlock}</button>`
          : nameBlock
      }
      ${action}
    </div>`;
  }

  function addMentorForm(teams) {
    if (ui.inviteResult) {
      const r = ui.inviteResult;
      return `<div class="card card-pad-4">
        <div class="row gap-2 text-sm medium" style="color:var(--color-match)">${icon("check", 16)} ${esc(r.mentor.name)} added</div>
        <p class="mt-1 text-xs muted">Email sending isn't configured — share this invite link with them directly:</p>
        <div class="row gap-2 mt-2">
          <code class="invite-link">${esc(r.invite_link)}</code>
          <button class="btn btn-xs btn-outline" data-action="copy-invite">${icon(ui.copied ? "check" : "copy", 12)} ${
        ui.copied ? "Copied" : "Copy"
      }</button>
        </div>
        <button class="text-btn mt-3" data-action="add-another-mentor">+ Add another mentor</button>
      </div>`;
    }
    if (!ui.open.addMentor) {
      return `<button class="btn btn-primary" data-action="toggle" data-key="addMentor">${icon("user-plus")} Add mentor</button>`;
    }
    const f = (field, label, type = "text") =>
      `<label class="field text-xs muted">${label}<input ${type === "email" ? 'type="email"' : ""} required class="input mt-1" data-form="addMentor" data-field="${field}" value="${esc(
        fv("addMentor", field)
      )}"/></label>`;
    const pending = !!ui.pending.addMentor;
    return `<form class="card card-pad-4" data-submit="add-mentor">
      <div class="grid-sm-2 gap-3">
        ${f("name", "Name")}${f("email", "Email", "email")}${f("employee_code", "Employee code")}${f("phone", "Phone")}${f(
      "designation",
      "Designation"
    )}
        <label class="field text-xs muted">Team (optional)
          <select class="input mt-1" data-form="addMentor" data-field="team_id">
            <option value="">Unassigned</option>
            ${teams
              .map((t) => `<option value="${t.id}" ${String(t.id) === fv("addMentor", "team_id") ? "selected" : ""}>${esc(t.name)}</option>`)
              .join("")}
          </select>
        </label>
      </div>
      <div class="row gap-2 mt-3">
        <button type="submit" class="btn btn-sm btn-primary" ${pending ? "disabled" : ""}>${pending ? spinner() : icon("mail")} Send invite</button>
        <button type="button" class="btn btn-sm btn-outline" data-action="toggle" data-key="addMentor">Cancel</button>
        ${ui.errors.addMentor ? `<span class="text-xs error">${esc(ui.errors.addMentor)}</span>` : ""}
      </div>
    </form>`;
  }

  function createTeamForm() {
    if (!ui.open.createTeam) {
      return `<button class="btn btn-ghost-light" data-action="toggle" data-key="createTeam">${icon("plus")} New team</button>`;
    }
    const pending = !!ui.pending.createTeam;
    return `<form class="row gap-2" data-submit="create-team">
      <input autofocus class="input input-light" placeholder="Team name" data-form="createTeam" data-field="name" value="${esc(
        fv("createTeam", "name")
      )}"/>
      <button type="submit" class="btn btn-sm btn-white" ${pending ? "disabled" : ""}>${pending ? spinner() : "Create"}</button>
      <button type="button" class="text-btn-light" data-action="toggle" data-key="createTeam">Cancel</button>
    </form>`;
  }

  function managerInternRow(intern) {
    const key = `mgr-intern-${intern.id}`;
    const open = !!ui.open[key];
    let body = "";
    if (open) {
      const tl = timeline(intern.id);
      const defaultStart = tl.length ? tl[tl.length - 1].learning_path.period_end : todayIso();
      body = `<div class="intern-row-body stack-3">
        <button class="btn btn-xs btn-dashed muted" data-action="open-add-lp" data-intern="${intern.id}" data-start="${defaultStart}">${icon(
        "plus",
        13
      )} Add learning path</button>
        ${!tl.length ? `<p class="text-xs muted">No learning paths assigned to this intern yet.</p>` : ""}
        ${[...tl]
          .reverse()
          .map((e) =>
            e.verdict
              ? `<div class="stack-2">${verdictCard(e.learning_path, e.verdict, {
                  internName: intern.name,
                  scope: "mgr",
                })}${generateSummaryButton(e.learning_path, e.verdict)}</div>`
              : generateSummaryButton(e.learning_path)
          )
          .join("")}
      </div>`;
    }
    return `<div class="intern-row">
      <button class="intern-row-head" data-action="toggle" data-key="${key}">
        <span class="row gap-2">${icon(open ? "chevron-down" : "chevron-right", 13, "muted")}<span class="text-sm medium">${esc(
      intern.name
    )}</span><span class="text-xs muted">@${esc(intern.github_username)}</span></span>
        <span class="row gap-1 text-xs muted">${icon("git-branch", 11)} ${esc(intern.repo || "no repo")}</span>
      </button>
      ${body}
    </div>`;
  }

  function mentorInternsList(mentorId) {
    const interns = db.interns.filter((i) => i.mentor_id === mentorId).map(internOut);
    if (!interns.length) return `<p class="text-xs muted px-1 py-2">No interns assigned to this mentor yet.</p>`;
    return `<div class="stack-2">${interns.map(managerInternRow).join("")}</div>`;
  }

  function addLearningPathModal(internId, defaultStart) {
    const key = `addlp-${internId}`;
    const start = fv(key, "period_start", defaultStart);
    const end = fv(key, "period_end", addDaysIso(defaultStart, 13));
    const pending = !!ui.pending[key];
    return `<div class="modal-backdrop light" data-action="close-modal">
      <div class="modal max-w-md ${ui.animateModal ? "modal-anim" : ""}" data-action="noop" role="dialog" aria-modal="true">
        <div class="row between">
          <h3 class="text-sm semibold">Add a learning path</h3>
          <button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 16)}</button>
        </div>
        <form class="mt-4 stack-3" data-submit="create-lp-file" data-intern="${internId}" data-form="${key}">
          <label class="field text-xs muted">Title
            <input required class="input mt-1" placeholder="e.g. Sprint 4: API hardening" data-form="${key}" data-field="title" value="${esc(
      fv(key, "title")
    )}"/>
          </label>
          <div class="field text-xs muted">Text, Excel, PDF, or image file
            ${fileInput(key)}
            <span class="hint-11">AI extracts a summary (and a table, where possible) from the file, then this
              intern's GitHub activity is analyzed against it.</span>
          </div>
          ${periodFields(key, start, end).replace("mt-3", "")}
          <div class="row gap-2 pt-1">
            <button type="submit" class="btn btn-sm btn-primary" ${pending ? "disabled" : ""}>${pending ? spinner() : ""}${
      pending ? "Extracting & assigning…" : "Assign"
    }</button>
            <button type="button" class="btn btn-sm btn-outline" data-action="close-modal">Cancel</button>
          </div>
          ${ui.errors[key] ? `<p class="text-xs error">${esc(ui.errors[key])}</p>` : ""}
        </form>
      </div>
    </div>`;
  }

  function viewManager(auth) {
    const ov = managerOverview(auth.user.id);
    const s = ov.summary;
    const allMentors = ov.teams.flatMap((t) => t.mentors.map((m) => ({ id: m.id, name: m.name, team_name: t.name })));
    const unassignedInterns = db.interns.filter((i) => i.mentor_id == null).map(internOut);
    const busy = !!ui.pending.mgrAction;

    const internsDetail = `<div class="stack-1"><p class="semibold">By team</p>${ov.teams
      .map(
        (t) =>
          `<div class="row between gap-4"><span class="muted">${esc(t.name)}</span><span class="medium">${t.mentors.reduce(
            (sum, m) => sum + (m.intern_count || 0),
            0
          )}</span></div>`
      )
      .join("")}${!ov.teams.length ? `<p class="muted">No teams yet.</p>` : ""}</div>`;
    const teamsDetail = `<div class="stack-1">${ov.teams
      .map(
        (t) =>
          `<div class="row between gap-4"><span class="muted">${esc(t.name)}</span><span class="medium">${t.mentors.length} mentor(s)</span></div>`
      )
      .join("")}${!ov.teams.length ? `<p class="muted">No teams yet — create one below.</p>` : ""}</div>`;
    const onTrackDetail = `<div class="stack-1">
      <div class="row between gap-4"><span style="color:var(--color-match)">On track</span><span class="medium">${s.on_track_count}</span></div>
      <div class="row between gap-4"><span style="color:var(--color-partial)">Partially on track</span><span class="medium">${s.partially_on_track_count}</span></div>
      <div class="row between gap-4"><span style="color:var(--color-discrepancy)">Off track</span><span class="medium">${s.off_track_count}</span></div>
      <div class="mt-1 pt-1 border-t muted">Avg. AI confidence: ${pct(s.avg_confidence)}%</div>
    </div>`;
    const reviewDetail = `<p class="muted">Verdicts that are off-track or below the confidence threshold, and haven't been
      confirmed or overridden by a mentor yet.</p>`;

    const teamCards = ov.teams
      .map((team) => {
        const ids = team.mentors.map((m) => m.id);
        const allExpanded = ids.length > 0 && ids.every((id) => ui.expandedMentors.has(id));
        return `<div class="card card-pad-4">
          <button class="team-head" data-action="toggle-team" data-team="${team.id}" ${ids.length ? "" : "disabled"} ${
          ids.length ? `title="${allExpanded ? "Collapse all mentors" : "Show interns under every mentor in this team"}"` : ""
        }>
            <span class="row gap-1-5">${ids.length ? icon(allExpanded ? "chevron-down" : "chevron-right", 14, "muted") : ""}<h3 class="semibold">${esc(
          team.name
        )}</h3></span>
            <span class="text-xs muted">${team.mentors.length} mentor(s)</span>
          </button>
          <div class="mt-3 stack-2">
            ${team.mentors
              .map((m) => {
                const expanded = ui.expandedMentors.has(m.id);
                return `<div>${mentorRow(
                  m,
                  `<div class="row gap-1">
                    <button class="icon-btn p-1-5" data-action="promote" data-user="${m.id}" title="Promote to manager" ${busy ? "disabled" : ""}>${icon(
                    "user-cog",
                    13
                  )}</button>
                    <button class="mini-btn" data-action="remove-from-team" data-user="${m.id}" ${busy ? "disabled" : ""}>Remove</button>
                  </div>`,
                  { expandable: true, expanded }
                )}${expanded ? `<div class="nested">${mentorInternsList(m.id)}</div>` : ""}</div>`;
              })
              .join("")}
            ${!team.mentors.length ? `<p class="text-xs muted">No mentors in this team yet.</p>` : ""}
          </div>
          ${
            ov.unassigned_mentors.length
              ? `<select class="input input-dashed mt-3" data-action-change="add-mentor-to-team" data-team="${team.id}">
                  <option value="">+ Add a mentor to this team…</option>
                  ${ov.unassigned_mentors.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join("")}
                </select>`
              : ""
          }
        </div>`;
      })
      .join("");

    let modal = "";
    if (ui.openStat === "interns") {
      const interns = orgWideInternIds(auth.user.id).map((id) => internOut(internById(id)));
      modal = modalShell(
        "Interns (org-wide)",
        interns.length
          ? `<div class="overflow-x"><table class="data-table"><thead><tr><th>Name</th><th>Team</th><th>Mentor</th><th>Repo</th></tr></thead><tbody>${interns
              .map(
                (i) =>
                  `<tr><td><a href="#/intern/${i.id}" class="medium hover-accent">${esc(i.name)}</a><div class="text-xs muted">@${esc(
                    i.github_username
                  )}</div></td><td class="muted">${esc(i.team_name || "—")}</td><td class="muted">${esc(
                    i.mentor_name || "—"
                  )}</td><td class="muted truncate max-w-160">${esc(i.repo || "no repo")}</td></tr>`
              )
              .join("")}</tbody></table></div>`
          : `<p class="text-sm muted">No interns yet.</p>`
      );
    } else if (ui.openStat === "teams") {
      modal = modalShell(
        "Teams",
        ov.teams.length
          ? `<div class="stack-4">${ov.teams
              .map(
                (t) => `<div class="bordered-box">
                  <div class="row between"><h4 class="semibold">${esc(t.name)}</h4><span class="text-xs muted">${t.mentors.length} mentor(s)</span></div>
                  <div class="mt-2 stack-1-5">${t.mentors
                    .map(
                      (m) =>
                        `<div class="row between text-sm"><span>${esc(m.name)}</span><span class="text-xs muted">${m.intern_count || 0} intern(s)</span></div>`
                    )
                    .join("")}${!t.mentors.length ? `<p class="text-xs muted">No mentors in this team yet.</p>` : ""}</div>
                </div>`
              )
              .join("")}</div>`
          : `<p class="text-sm muted">No teams yet — create one below.</p>`
      );
    } else if (ui.openStat === "ontrack") {
      modal = modalShell(
        "Cohort verdict distribution",
        `<div class="stack-4">${distributionChart(s)}<div class="bordered-box text-sm muted">Average AI confidence across every verdict: <span class="medium fg">${pct(
          s.avg_confidence
        )}%</span></div></div>`
      );
    } else if (ui.openStat === "review") {
      const queue = reviewQueue(orgWideInternIds(auth.user.id));
      modal = modalShell(
        "Needs review (org-wide)",
        queue.length
          ? `<div class="stack-4">${queue
              .map((v) => verdictCard(v.learning_path, v, { internName: v.intern_name, scope: "orgqueue" }))
              .join("")}</div>`
          : `<p class="text-sm muted">Nothing needs a human right now — every verdict across your teams is confident and consistent.</p>`
      );
    }

    return `<div>
      <div class="manager-hero">
        <div class="container-6xl-inner">
          <span class="hero-chip">${icon("building-2", 12)} Organization overview</span>
          <h1 class="mt-3 text-2xl semibold white">Welcome back, ${esc(auth.user.name.split(" ")[0])}</h1>
          <p class="mt-1 text-sm white-70">Create teams, assign mentors into them, and promote someone to manager. This is the
            org-wide rollup across every team you own — mentor dashboards only see their own interns.</p>
          <div class="grid-stats gap-3 mt-6">
            ${statBlock("Interns (org-wide)", String(s.total_interns), "interns", internsDetail)}
            ${statBlock("Teams", String(ov.teams.length), "teams", teamsDetail)}
            ${statBlock("On track", `${pct(s.on_track_ratio)}%`, "ontrack", onTrackDetail)}
            ${statBlock("Needs review", String(s.pending_review_count), "review", reviewDetail)}
          </div>
        </div>
      </div>

      <div class="container-6xl py-8">
        <h2 class="section-title row gap-2">${icon("users")} Add a mentor</h2>
        <div class="mt-3">${addMentorForm(ov.teams)}</div>

        <h2 class="section-title row gap-2 mt-8">${icon("list-tree")} Teams</h2>
        <div class="grid-sm-2 gap-4 mt-3">${teamCards}</div>
        <div class="mt-4 team-create-wrap">${createTeamForm()}</div>

        ${
          unassignedInterns.length
            ? `<div class="mt-8">
                <h2 class="section-title row gap-2">${icon("user-plus")} Unassigned interns (${unassignedInterns.length})</h2>
                <p class="mt-1 text-xs muted">These interns signed up without picking a mentor — route each one to a mentor on one of your teams.</p>
                <div class="mt-3 stack-2">${unassignedInterns
                  .map((i) => {
                    const sel = fv(`assign-${i.id}`, "mentor_id");
                    const pending = !!ui.pending[`assign-${i.id}`];
                    return `<div class="unassigned-row">
                      <div class="row gap-2">${avatar(i.name, "sm")}<div><div class="text-sm medium">${esc(i.name)}</div><div class="text-11 muted">@${esc(
                      i.github_username
                    )}</div></div></div>
                      <div class="row gap-1-5">
                        <select class="input input-xs" data-form="assign-${i.id}" data-field="mentor_id" data-rerender="1">
                          <option value="">Pick a mentor…</option>
                          ${allMentors
                            .map(
                              (m) =>
                                `<option value="${m.id}" ${String(m.id) === sel ? "selected" : ""}>${esc(m.name)}${
                                  m.team_name ? ` — ${esc(m.team_name)}` : ""
                                }</option>`
                            )
                            .join("")}
                        </select>
                        <button class="btn btn-xs btn-primary shrink-0 dim-disabled" data-action="assign-intern" data-intern="${i.id}" ${
                      !sel || pending ? "disabled" : ""
                    }>${pending ? spinner(12) : icon("link-2", 12)} Assign</button>
                      </div>
                    </div>`;
                  })
                  .join("")}</div>
                ${
                  !allMentors.length
                    ? `<p class="mt-2 text-xs muted">Add a mentor to one of your teams first before you can assign these interns.</p>`
                    : ""
                }
              </div>`
            : ""
        }

        <div class="mt-8">
          <h2 class="section-title row gap-2">${icon("users")} Unassigned mentors</h2>
          <div class="mt-3 stack-2">
            ${ov.unassigned_mentors
              .map((m) =>
                mentorRow(
                  m,
                  `<button class="mini-btn row gap-1" data-action="promote" data-user="${m.id}" ${busy ? "disabled" : ""}>${icon(
                    "user-cog",
                    12
                  )} Promote to manager</button>`
                )
              )
              .join("")}
            ${!ov.unassigned_mentors.length ? `<p class="text-xs muted">Every mentor is on a team.</p>` : ""}
          </div>
        </div>

        <div class="tip-box mt-8">
          ${icon("sparkles", 14, "accent")}
          Want to see a mentor's own review queue and per-intern verdicts?
          <a href="#/mentor" class="text-accent medium row-inline gap-1">Open the mentor view ${icon("arrow-up-right", 12)}</a>
        </div>
      </div>
      ${modal}
    </div>`;
  }

  function filePreviewModal(lp) {
    const name = lp.source_filename;
    const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    const stored = db.files[lp.id];
    let body;
    if (!stored) {
      body = `<p class="text-xs error">Couldn't load file — it was too large to keep in this static demo's browser storage.</p>`;
    } else if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
      body = `<img src="${stored}" alt="${esc(name)}" class="preview-img"/>`;
    } else if (ext === "pdf") {
      body = `<iframe src="${dataUrlToBlobUrl(stored)}" title="${esc(name)}" class="preview-frame"></iframe>`;
    } else if (["xlsx", "xls"].includes(ext)) {
      body = `<div class="stack-3 text-sm">
        <p class="text-xs muted">Excel files can't be previewed inline — the extracted table already shown on this
          learning path is the structured version of this file's content.</p>
        <a href="${stored}" download="${esc(name)}" class="btn btn-xs btn-outline">${icon("download", 12)} Download original file</a>
      </div>`;
    } else {
      body = `<pre class="preview-text">${esc(stored)}</pre>`;
    }
    return modalShell(name, body, { size: "max-w-3xl", titleClass: "text-sm" });
  }

  function dataUrlToBlobUrl(dataUrl) {
    try {
      const [meta, b64] = dataUrl.split(",");
      const mime = meta.slice(5).split(";")[0];
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: mime }));
    } catch (_) {
      return dataUrl;
    }
  }

  function loading() {
    return `<div class="loading">${spinner()} Loading…</div>`;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const appEl = document.getElementById("app");

  function resolveView(auth) {
    const path = currentPath();
    const redirect = (to) => {
      setTimeout(() => navigate(to, { replace: true }));
      return loading();
    };
    const gate = (role) => {
      if (!auth.authenticated) return "/";
      if (!auth.onboarding_complete) return "/onboarding/intern";
      if (role && auth.user.role !== role) return homeFor(auth);
      return null;
    };

    if (path === "/") return auth.authenticated ? redirect(homeFor(auth)) : viewLanding();
    if (path === "/dashboard") return redirect(homeFor(auth));
    if (path === "/manager") return gate("manager") ? redirect(gate("manager")) : viewManager(auth);
    if (path === "/mentor") return gate("mentor") ? redirect(gate("mentor")) : viewMentor(auth);
    if (path === "/onboarding/intern") {
      if (!auth.authenticated) return redirect("/");
      if (auth.onboarding_complete) return redirect(homeFor(auth));
      return viewOnboarding();
    }
    let m = path.match(/^\/intern\/(\d+)$/);
    if (m) return gate() ? redirect(gate()) : viewIntern(auth, Number(m[1]));
    m = path.match(/^\/invite\/([\w-]+)$/);
    if (m) return viewInvite(m[1]);
    return `<div class="container-3xl center py-16"><h1 class="text-2xl semibold">404</h1><p class="mt-2 text-sm muted">This page could not be found. <a class="text-accent" href="#/">Go home</a></p></div>`;
  }

  function render() {
    const auth = authStatus();
    let modal = "";
    if (ui.modal && ui.modal.type === "preview") {
      const lp = lpById(ui.modal.lpId);
      if (lp) modal = filePreviewModal(lp);
    } else if (ui.modal && ui.modal.type === "addlp") {
      modal = addLearningPathModal(ui.modal.internId, ui.modal.defaultStart);
    }
    appEl.innerHTML = `${navbar(auth)}<main class="main">${resolveView(auth)}</main>${modal}`;
    ui.animateModal = false;
    drawCharts();
    const autofocus = appEl.querySelector("[autofocus]");
    if (autofocus && document.activeElement !== autofocus) autofocus.focus();
  }

  /** Re-renders only one analysis log box — avoids rebuilding the whole page
   *  (and stealing focus) for every streamed log line. */
  function renderRun(lpId) {
    document.querySelectorAll(`[data-run="${lpId}"]`).forEach((box) => {
      const lp = lpById(lpId);
      const verdict = verdictFor(lpId);
      const isRerun = box.querySelector('[data-rerun="1"]') !== null;
      const tmp = document.createElement("div");
      tmp.innerHTML = generateSummaryButton(lp, isRerun ? verdict : null);
      box.replaceWith(tmp.firstElementChild);
    });
    document.querySelectorAll(`#run-log-${lpId}`).forEach((el) => (el.scrollTop = el.scrollHeight));
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function runAnalysis(lpId, force) {
    const run = (ui.runs[lpId] = { logs: [], running: true, error: null });
    const log = async (msg, delay = 550) => {
      await sleep(delay);
      run.logs.push(msg);
      renderRun(lpId);
    };
    renderRun(lpId);

    const lp = lpById(lpId);
    const intern = internById(lp.intern_id);
    await log(`Loading learning path "${lp.title}" for ${intern.name}…`, 250);
    const existing = verdictFor(lpId);
    if (existing && force) {
      await log("Discarding the previous verdict for a fresh rerun…");
    }

    const recorded = RECORDED_VERDICTS.get(lpId);
    const inPeriod = (e) =>
      e.intern_id === intern.id &&
      e.merged_at.slice(0, 10) >= lp.period_start &&
      e.merged_at.slice(0, 10) <= lp.period_end;
    let evidence = recorded ? recorded.evidence_ids.map(evidenceById).filter(Boolean) : db.evidence.filter(inPeriod);

    if (evidence.length) {
      await log(`Found ${evidence.length} cached evidence item(s) for this period.`);
    } else {
      await log(`Pulling GitHub evidence for ${intern.repo} (${lp.period_start} → ${lp.period_end})…`);
      let id = nextId(db.evidence);
      evidence = mockEvidence(intern.repo, intern.github_username, lp.period_start, lp.period_end).map((e) =>
        Object.assign({ id: id++, intern_id: intern.id }, e)
      );
      db.evidence.push(...evidence);
      await log(`mock fallback (no GitHub token available) returned ${evidence.length} item(s).`, 900);
    }

    await log("Sending evidence + learning path to the AI provider chain (NVIDIA → Gemini → mock)…");
    let result, provider;
    if (recorded) {
      result = recorded;
      provider = recorded.source_mode;
      await log("Static demo: replaying the recorded verdict for this learning path (no live AI call).", 900);
    } else {
      result = mockVerdict(lp.description, evidence);
      provider = "mock";
      await sleep(900);
    }
    const label = { nvidia: "NVIDIA", gemini: "Gemini (backup)", mock: "rule-based mock" }[provider];
    await log(`${label} responded: ${titleCase(result.match_status.replace(/_/g, " "))} at ${pct(result.confidence)}% confidence.`, 200);
    await log("Saving verdict and skill tags…", 400);

    db.verdicts = db.verdicts.filter((v) => v.learning_path_id !== lpId);
    const verdictId = nextId(db.verdicts.concat(SEED.verdicts));
    let tagId = db.verdicts.flatMap((v) => v.skill_tags).reduce((m, t) => Math.max(m, t.id), 100) + 1;
    db.verdicts.push({
      id: verdictId,
      learning_path_id: lpId,
      match_status: result.match_status,
      confidence: result.confidence,
      ai_summary: result.ai_summary,
      reasoning: result.reasoning,
      source_mode: provider,
      mentor_override: null,
      created_at: new Date().toISOString().slice(0, 19),
      skill_tags: result.skill_tags.map((t) => ({ id: tagId++, skill_name: t.skill_name, evidence_strength: t.evidence_strength })),
      evidence_ids: evidence.map((e) => e.id),
    });
    saveDb();
    await log("Done.", 300);
    run.running = false;
    await sleep(250);
    render();
  }

  function readFile(file, asText) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      asText ? r.readAsText(file) : r.readAsDataURL(file);
    });
  }

  function parseMarkdownTable(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("|") && l.endsWith("|"));
    if (lines.length < 3 || !/^\|[\s:|-]+\|$/.test(lines[1])) return null;
    const cells = (l) => l.slice(1, -1).split("|").map((c) => c.trim());
    return { headers: cells(lines[0]), rows: lines.slice(2).map(cells) };
  }

  async function extractFromFile(file) {
    const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
    if (!ACCEPTED_EXTENSIONS.split(",").includes(`.${ext}`)) {
      throw new Error(`Unsupported file type ".${ext}" — use .txt, .md, .pdf, an image, or .xlsx`);
    }
    if (file.size > 10 * 1024 * 1024) throw new Error("File is larger than the 10 MB limit");
    let description, table = null, stored = null;
    if (ext === "txt" || ext === "md") {
      const text = await readFile(file, true);
      description = `[MOCK] Extracted document content (no AI provider configured): ${text.trim().replace(/\n/g, " ").slice(0, 280)}`;
      table = parseMarkdownTable(text);
      stored = text.length <= MAX_STORED_FILE_BYTES ? text : null;
    } else if (["png", "jpg", "jpeg", "webp"].includes(ext) || ext === "pdf") {
      description =
        "[MOCK] This file needs OCR (it's an image or a scanned PDF with no text layer), which requires " +
        "GEMINI_API_KEY to be configured — this static demo has no AI provider, so upload a .txt or .md file to see extraction.";
      stored = file.size <= MAX_STORED_FILE_BYTES ? await readFile(file, false) : null;
    } else {
      description = "[MOCK] Spreadsheet parsing runs on the backend, which this static demo doesn't have — upload a .txt or .md file to see extraction.";
      stored = file.size <= MAX_STORED_FILE_BYTES ? await readFile(file, false) : null;
    }
    return { description, table, stored };
  }

  async function createLearningPath(internId, key, fromFile) {
    const f = form(key);
    const intern = internById(internId);
    const lpStart = f.period_start;
    const lpEnd = f.period_end;
    if (lpEnd < lpStart) throw new Error("Period end must be on or after period start");

    const lp = {
      id: nextId(db.learning_paths),
      intern_id: internId,
      mentor_id: intern.mentor_id,
      title: (f.title || "").trim(),
      description: (f.description || "").trim(),
      period_start: lpStart,
      period_end: lpEnd,
      source_filename: null,
      has_file: false,
      extracted_table: null,
      created_at: new Date().toISOString().slice(0, 19),
    };
    if (fromFile) {
      const file = ui.files[key];
      if (!file) throw new Error("Choose a file to upload");
      const extracted = await extractFromFile(file);
      lp.description = extracted.description;
      lp.extracted_table = extracted.table;
      lp.source_filename = file.name;
      lp.has_file = !!extracted.stored;
      if (extracted.stored) db.files[lp.id] = extracted.stored;
    }
    db.learning_paths.push(lp);
    saveDb();
  }

  const actions = {
    noop() {},
    toggle(el) {
      const k = el.dataset.key;
      ui.open[k] = !ui.open[k];
      if (!ui.open[k]) {
        delete ui.forms[k];
        delete ui.files[k];
        delete ui.errors[k];
      }
      render();
    },
    "set-field"(el) {
      form(el.dataset.form)[el.dataset.field] = el.dataset.value;
      render();
    },
    "close-modal"() {
      if (ui.modal && ui.modal.type === "addlp") {
        const k = `addlp-${ui.modal.internId}`;
        delete ui.forms[k];
        delete ui.files[k];
        delete ui.errors[k];
      }
      ui.modal = null;
      ui.openStat = null;
      render();
    },
    "preview-file"(el) {
      ui.modal = { type: "preview", lpId: Number(el.dataset.lp) };
      ui.animateModal = true;
      render();
    },
    logout() {
      withPending(
        "logout",
        () => {
          saveSession(null);
          resetViewState();
          navigate("/");
        },
        150
      );
    },
    "github-login"() {
      ui.flashDevLogin = true;
      render();
      document.getElementById("dev-login").scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        ui.flashDevLogin = false;
        const el = document.getElementById("dev-login");
        if (el) el.classList.remove("flash");
      }, 1600);
    },
    "dev-login"(el) {
      const u = userById(Number(el.dataset.user));
      startSession(u);
      resetViewState();
      navigate(homeFor(authStatus()));
    },
    "reset-demo"() {
      if (!confirm("Reset all demo data to the original hardcoded dataset? Changes made in this browser will be lost.")) return;
      try {
        localStorage.removeItem(STORE_KEY);
      } catch (_) {
        /* nothing stored */
      }
      db = Object.assign(clone(SEED), { passwords: {}, files: {} });
      saveSession(null);
      resetViewState();
      ui.runs = {};
      ui.expandedMentors.clear();
      render();
    },
    "run-analysis"(el) {
      const lpId = Number(el.dataset.lp);
      if (ui.runs[lpId] && ui.runs[lpId].running) return;
      runAnalysis(lpId, el.dataset.rerun === "1").catch((err) => {
        ui.runs[lpId].running = false;
        ui.runs[lpId].error = err.message || "Something went wrong";
        render();
      });
    },
    "confirm-verdict"(el) {
      decide(Number(el.dataset.verdict), "CONFIRMED", null, null);
    },
    "override-verdict"(el) {
      const key = el.dataset.form;
      const v = db.verdicts.find((x) => x.id === Number(el.dataset.verdict));
      decide(v.id, "OVERRIDDEN", fv(key, "status", v.match_status), fv(key, "note") || null);
    },
    "claim-intern"(el) {
      const auth = authStatus();
      withPending("claim", () => {
        const intern = internById(Number(el.dataset.intern));
        if (intern && intern.mentor_id == null) intern.mentor_id = auth.user.id;
        saveDb();
      });
    },
    "toggle-mentor"(el) {
      const id = Number(el.dataset.mentor);
      ui.expandedMentors.has(id) ? ui.expandedMentors.delete(id) : ui.expandedMentors.add(id);
      render();
    },
    "toggle-team"(el) {
      const team = managerTeams(authStatus().user.id).find((t) => t.id === Number(el.dataset.team));
      const ids = team.mentors.map((m) => m.id);
      const expand = !ids.every((id) => ui.expandedMentors.has(id));
      ids.forEach((id) => (expand ? ui.expandedMentors.add(id) : ui.expandedMentors.delete(id)));
      render();
    },
    "open-stat"(el) {
      ui.openStat = el.dataset.stat;
      ui.animateModal = true;
      render();
    },
    promote(el) {
      withPending("mgrAction", () => {
        const u = userById(Number(el.dataset.user));
        if (u && u.role !== "manager") {
          u.role = "manager";
          u.team_id = null;
        }
        saveDb();
      });
    },
    "remove-from-team"(el) {
      withPending("mgrAction", () => {
        const u = userById(Number(el.dataset.user));
        if (u) u.team_id = null;
        ui.expandedMentors.delete(u.id);
        saveDb();
      });
    },
    "assign-intern"(el) {
      const internId = Number(el.dataset.intern);
      const mentorId = Number(fv(`assign-${internId}`, "mentor_id"));
      if (!mentorId) return;
      withPending(`assign-${internId}`, () => {
        internById(internId).mentor_id = mentorId;
        delete ui.forms[`assign-${internId}`];
        saveDb();
      });
    },
    "copy-invite"() {
      const link = ui.inviteResult.invite_link;
      const done = () => {
        ui.copied = true;
        render();
        setTimeout(() => {
          ui.copied = false;
          render();
        }, 1500);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, done);
      else done();
    },
    "add-another-mentor"() {
      ui.inviteResult = null;
      render();
    },
    "open-add-lp"(el) {
      ui.modal = { type: "addlp", internId: Number(el.dataset.intern), defaultStart: el.dataset.start };
      ui.animateModal = true;
      render();
    },
  };

  function decide(verdictId, status, overriddenStatus, note) {
    const auth = authStatus();
    withPending(`decide-${verdictId}`, () => {
      const v = db.verdicts.find((x) => x.id === verdictId);
      v.mentor_override = {
        status,
        note,
        mentor_name: auth.user.name,
        decided_at: new Date().toISOString(),
      };
      if (status === "OVERRIDDEN" && overriddenStatus) v.match_status = overriddenStatus;
      saveDb();
    });
  }

  const submits = {
    "email-login"() {
      const email = (fv("login", "email") || "").trim().toLowerCase();
      const password = fv("login", "password");
      delete ui.errors.login;
      withPending("emailLogin", async () => {
        const u = db.users.find((x) => x.email && x.email.toLowerCase() === email && x.role !== "intern");
        const expected = u && db.passwords[u.id];
        const ok = u && !u.invite_token && (expected ? (await hashPassword(password)) === expected : password === DEMO_PASSWORD);
        if (!ok) {
          ui.errors.login = "Invalid email or password";
          return;
        }
        startSession(u);
        resetViewState();
        navigate(u.role === "manager" ? "/manager" : "/mentor");
      });
    },
    "dev-login-new"() {
      const login = (fv("devlogin", "login") || "").trim();
      if (!login) return;
      let u = db.users.find((x) => x.github_login === login);
      if (!u) {
        u = {
          id: nextId(db.users),
          github_login: login,
          email: null,
          name: login,
          avatar_url: "",
          role: "intern",
          team_id: null,
          employee_code: null,
          phone: null,
          designation: null,
        };
        db.users.push(u);
        saveDb();
      }
      startSession(u);
      resetViewState();
      navigate(homeFor(authStatus()));
    },
    onboarding() {
      const auth = authStatus();
      const repo = (fv("onboarding", "repo") || "").trim();
      delete ui.errors.onboarding;
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
        ui.errors.onboarding = 'Repo must look like "owner/repo"';
        render();
        return;
      }
      withPending("onboarding", () => {
        const mentorId = fv("onboarding", "mentor_id") ? Number(fv("onboarding", "mentor_id")) : null;
        let intern = db.interns.find((i) => i.user_id === auth.user.id);
        if (!intern) {
          intern = {
            id: nextId(db.interns),
            user_id: auth.user.id,
            name: auth.user.name,
            mentor_id: mentorId,
            start_date: todayIso(),
            github_username: auth.user.github_login,
            repo,
          };
          db.interns.push(intern);
        } else {
          intern.repo = repo;
          intern.mentor_id = mentorId;
        }
        saveDb();
        resetViewState();
        navigate(`/intern/${intern.id}`, { replace: true });
      });
    },
    "accept-invite"(formEl) {
      const token = formEl.dataset.token;
      const password = fv("invite", "password");
      delete ui.errors.invite;
      if (password !== fv("invite", "confirm")) {
        ui.errors.invite = "Passwords don't match";
        render();
        return;
      }
      if (password.length < 8) {
        ui.errors.invite = "Password must be at least 8 characters";
        render();
        return;
      }
      withPending("invite", async () => {
        const u = db.users.find((x) => x.invite_token === token);
        if (!u) return;
        db.passwords[u.id] = await hashPassword(password);
        u.invite_token = null;
        saveDb();
        startSession(u);
        resetViewState();
        navigate(u.role === "manager" ? "/manager" : "/mentor");
      });
    },
    "add-mentor"() {
      const f = form("addMentor");
      delete ui.errors.addMentor;
      const email = (f.email || "").trim().toLowerCase();
      if (db.users.some((u) => u.email && u.email.toLowerCase() === email)) {
        ui.errors.addMentor = "A user with that email already exists";
        render();
        return;
      }
      withPending("addMentor", () => {
        const token = randomToken();
        const mentor = {
          id: nextId(db.users),
          github_login: null,
          email,
          name: (f.name || "").trim(),
          avatar_url: "",
          role: "mentor",
          team_id: f.team_id ? Number(f.team_id) : null,
          employee_code: (f.employee_code || "").trim(),
          phone: (f.phone || "").trim(),
          designation: (f.designation || "").trim(),
          invite_token: token,
        };
        db.users.push(mentor);
        saveDb();
        const base = location.href.split("#")[0];
        ui.inviteResult = { mentor, invite_link: `${base}#/invite/${token}`, email_sent: false };
        delete ui.forms.addMentor;
      });
    },
    "create-team"() {
      const name = (fv("createTeam", "name") || "").trim();
      if (!name) return;
      const auth = authStatus();
      withPending("createTeam", () => {
        db.teams.push({ id: nextId(db.teams), name, manager_id: auth.user.id });
        saveDb();
        delete ui.forms.createTeam;
        ui.open.createTeam = false;
      });
    },
    "create-lp"(formEl) {
      const internId = Number(formEl.dataset.intern);
      const key = formEl.dataset.form;
      delete ui.errors[key];
      const fromFile = fv(key, "mode", "text") === "file";
      withPending(
        key,
        async () => {
          try {
            await createLearningPath(internId, key, fromFile);
            delete ui.forms[key];
            delete ui.files[key];
            ui.open[key] = false;
          } catch (err) {
            ui.errors[key] = err.message;
          }
        },
        fromFile ? 1400 : 450
      );
    },
    "create-lp-file"(formEl) {
      const internId = Number(formEl.dataset.intern);
      const key = formEl.dataset.form;
      delete ui.errors[key];
      withPending(
        key,
        async () => {
          try {
            await createLearningPath(internId, key, true);
            delete ui.forms[key];
            delete ui.files[key];
            ui.modal = null;
          } catch (err) {
            ui.errors[key] = err.message;
          }
        },
        1400
      );
    },
  };

  // ---------------------------------------------------------------------------
  // Event wiring (delegated — the DOM is re-rendered from state)
  // ---------------------------------------------------------------------------

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (!fn) return;
    if (el.dataset.action === "noop") return;
    if (el.tagName === "A") e.preventDefault();
    fn(el, e);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (ui.modal || ui.openStat)) {
      actions["close-modal"]();
      return;
    }
    const el = e.target.closest && e.target.closest('[role="button"][data-action]');
    if (el && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      actions[el.dataset.action](el, e);
    }
  });

  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.form && el.dataset.field) form(el.dataset.form)[el.dataset.field] = el.value;
  });

  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.fileForm) {
      const file = el.files && el.files[0];
      if (file) ui.files[el.dataset.fileForm] = file;
      else delete ui.files[el.dataset.fileForm];
      render();
      return;
    }
    if (el.dataset.actionChange === "add-mentor-to-team") {
      const userId = Number(el.value);
      if (!userId) return;
      withPending("mgrAction", () => {
        userById(userId).team_id = Number(el.dataset.team);
        saveDb();
      });
      return;
    }
    if (el.dataset.form && el.dataset.field) {
      form(el.dataset.form)[el.dataset.field] = el.value;
      if (el.dataset.rerender) render();
    }
  });

  document.addEventListener("submit", (e) => {
    const el = e.target.closest("[data-submit]");
    if (!el) return;
    e.preventDefault();
    // Capture every field's current value (including rendered defaults the
    // user never touched, like pre-filled dates) before acting on the form.
    el.querySelectorAll("input[data-field], select[data-field], textarea[data-field]").forEach((input) => {
      form(input.dataset.form)[input.dataset.field] = input.value;
    });
    const fn = submits[el.dataset.submit];
    if (fn) fn(el);
  });

  window.addEventListener("hashchange", () => {
    resetViewState();
    render();
    window.scrollTo(0, 0);
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawCharts, 120);
  });

  // Intern sessions are short-lived (matches the backend's 60-minute
  // intern_session_max_age) — notice expiry in an idle tab.
  setInterval(() => {
    const s = loadSession();
    if (s && s.expires_at && Date.now() > s.expires_at) render();
  }, 60000);

  // Keep other tabs of the demo in sync.
  window.addEventListener("storage", (e) => {
    if (e.key === STORE_KEY || e.key === SESSION_KEY) {
      db = loadDb();
      render();
    }
  });

  render();
})();
