/* Hardcoded demo dataset — exported from a real seeded run of the full
 * TeaM Pulse backend (NVIDIA-generated verdicts over mock GitHub evidence).
 * No API calls are made anywhere in this static build. */
window.TP_SEED = {
 "teams": [
  {
   "id": 1,
   "name": "Platform Engineering",
   "manager_id": 1
  },
  {
   "id": 2,
   "name": "Data & Analytics",
   "manager_id": 1
  }
 ],
 "users": [
  {
   "id": 1,
   "github_login": null,
   "email": "alex.rivera@teampulse.dev",
   "name": "Alex Rivera",
   "avatar_url": "",
   "role": "manager",
   "team_id": null,
   "employee_code": "MGR-001",
   "phone": "+1-555-0100",
   "designation": "Head of Engineering",
   "pending_invite": false
  },
  {
   "id": 2,
   "github_login": null,
   "email": "priya.singh@teampulse.dev",
   "name": "Priya Singh",
   "avatar_url": "",
   "role": "mentor",
   "team_id": 1,
   "employee_code": "MTR-001",
   "phone": "+1-555-0101",
   "designation": "Staff Engineer",
   "pending_invite": false
  },
  {
   "id": 3,
   "github_login": null,
   "email": "devon.okafor@teampulse.dev",
   "name": "Devon Okafor",
   "avatar_url": "",
   "role": "mentor",
   "team_id": 2,
   "employee_code": "MTR-002",
   "phone": "+1-555-0102",
   "designation": "Senior Data Engineer",
   "pending_invite": false
  },
  {
   "id": 4,
   "github_login": "demo-asha",
   "email": null,
   "name": "Asha Kumar",
   "avatar_url": "",
   "role": "intern",
   "team_id": null,
   "employee_code": null,
   "phone": null,
   "designation": null,
   "pending_invite": false
  },
  {
   "id": 5,
   "github_login": "demo-marcus",
   "email": null,
   "name": "Marcus Chen",
   "avatar_url": "",
   "role": "intern",
   "team_id": null,
   "employee_code": null,
   "phone": null,
   "designation": null,
   "pending_invite": false
  },
  {
   "id": 6,
   "github_login": "demo-wei",
   "email": null,
   "name": "Wei Zhang",
   "avatar_url": "",
   "role": "intern",
   "team_id": null,
   "employee_code": null,
   "phone": null,
   "designation": null,
   "pending_invite": false
  },
  {
   "id": 7,
   "github_login": null,
   "email": "jamie.lee@teampulse.dev",
   "name": "Jamie Lee",
   "avatar_url": "",
   "role": "mentor",
   "team_id": null,
   "employee_code": "MTR-003",
   "phone": "+1-555-0199",
   "designation": "Backend Engineer",
   "pending_invite": false
  },
  {
   "id": 8,
   "github_login": "demo-riya",
   "email": null,
   "name": "Riya Patel",
   "avatar_url": "",
   "role": "intern",
   "team_id": null,
   "employee_code": null,
   "phone": null,
   "designation": null,
   "pending_invite": false
  }
 ],
 "interns": [
  {
   "id": 1,
   "user_id": 4,
   "name": "Asha Kumar",
   "mentor_id": 2,
   "start_date": "2026-06-01",
   "github_username": "demo-asha",
   "repo": "octocat/Hello-World"
  },
  {
   "id": 2,
   "user_id": 5,
   "name": "Marcus Chen",
   "mentor_id": 2,
   "start_date": "2026-06-01",
   "github_username": "demo-marcus",
   "repo": "octocat/Hello-World"
  },
  {
   "id": 3,
   "user_id": 6,
   "name": "Wei Zhang",
   "mentor_id": 3,
   "start_date": "2026-07-01",
   "github_username": "demo-wei",
   "repo": "octocat/Hello-World"
  },
  {
   "id": 4,
   "user_id": 8,
   "name": "Riya Patel",
   "mentor_id": null,
   "start_date": "2026-09-01",
   "github_username": "demo-riya",
   "repo": "octocat/Spoon-Knife"
  }
 ],
 "learning_paths": [
  {
   "id": 1,
   "intern_id": 1,
   "mentor_id": 2,
   "title": "Sprint 1: Search & webhook reliability",
   "description": "Add pagination to the search endpoint, write integration tests for the webhook handler, and improve validation error messaging.",
   "period_start": "2026-06-01",
   "period_end": "2026-06-14",
   "source_filename": null,
   "has_file": false,
   "extracted_table": null,
   "created_at": "2026-09-03T10:23:15"
  },
  {
   "id": 2,
   "intern_id": 1,
   "mentor_id": 2,
   "title": "Sprint 2: Async processing & cache correctness",
   "description": "Build out the async job queue consumer, investigate and fix the cache invalidation race condition, and refactor test fixtures for reuse across the API layer.",
   "period_start": "2026-06-15",
   "period_end": "2026-06-28",
   "source_filename": null,
   "has_file": false,
   "extracted_table": null,
   "created_at": "2026-09-03T10:23:58"
  },
  {
   "id": 3,
   "intern_id": 2,
   "mentor_id": 2,
   "title": "Sprint 1: Authentication hardening",
   "description": "Rebuild the authentication system with proper JWT handling, prepare the service for multi-region deployment, and scope out the new payment gateway integration.",
   "period_start": "2026-06-01",
   "period_end": "2026-06-14",
   "source_filename": null,
   "has_file": false,
   "extracted_table": null,
   "created_at": "2026-09-03T10:24:26"
  },
  {
   "id": 4,
   "intern_id": 2,
   "mentor_id": 2,
   "title": "Sprint 2: Maintenance & CI",
   "description": "Light sprint — handle routine bug fixes and CI configuration tweaks. No major new features planned.",
   "period_start": "2026-06-15",
   "period_end": "2026-06-28",
   "source_filename": null,
   "has_file": false,
   "extracted_table": null,
   "created_at": "2026-09-03T10:24:48"
  },
  {
   "id": 5,
   "intern_id": 3,
   "mentor_id": 3,
   "title": "Sprint 1: Dashboard performance",
   "description": "Build a reusable chart component for the dashboard and optimize the slow N+1 query causing performance issues on the dashboard endpoint.",
   "period_start": "2026-07-01",
   "period_end": "2026-07-14",
   "source_filename": null,
   "has_file": false,
   "extracted_table": null,
   "created_at": "2026-09-03T10:25:05"
  },
  {
   "id": 6,
   "intern_id": 3,
   "mentor_id": 3,
   "title": "Sprint 2: Rate limiting exploration",
   "description": "Investigate rate limiting middleware options as a proof of concept — early exploration only, nothing production-ready expected yet.",
   "period_start": "2026-07-15",
   "period_end": "2026-07-28",
   "source_filename": null,
   "has_file": false,
   "extracted_table": null,
   "created_at": "2026-09-03T10:25:38"
  }
 ],
 "verdicts": [
  {
   "id": 1,
   "learning_path_id": 1,
   "match_status": "PARTIALLY_ON_TRACK",
   "confidence": 0.75,
   "ai_summary": "The intern refactored the API layer's test fixtures, wrote several unit tests, added pagination support to the search endpoint, and enhanced validation error messages in a TypeScript/React codebase. These changes improved test maintainability, extended test coverage, made search results paginatable, and provided clearer feedback to users on input errors.",
   "reasoning": "Intern added pagination to the search endpoint and improved validation error messages, completing two of the three assigned tasks; no evidence of integration tests for the webhook handler was provided.",
   "source_mode": "nvidia",
   "mentor_override": null,
   "created_at": "2026-09-03T10:23:58",
   "skill_tags": [
    {
     "id": 1,
     "skill_name": "API pagination",
     "evidence_strength": 0.9
    },
    {
     "id": 2,
     "skill_name": "Validation error messaging improvement",
     "evidence_strength": 0.9
    },
    {
     "id": 3,
     "skill_name": "Test fixture refactoring",
     "evidence_strength": 0.8
    },
    {
     "id": 4,
     "skill_name": "Unit testing",
     "evidence_strength": 0.8
    },
    {
     "id": 5,
     "skill_name": "TypeScript/React development",
     "evidence_strength": 0.7
    }
   ],
   "evidence_ids": [
    1,
    2,
    3,
    4,
    5
   ]
  },
  {
   "id": 2,
   "learning_path_id": 2,
   "match_status": "PARTIALLY_ON_TRACK",
   "confidence": 0.7,
   "ai_summary": "The intern updated project dependencies, explored caching strategies, and implemented an initial asynchronous job queue consumer in Python. They also improved validation error messages in a TypeScript/React codebase, performed code cleanups, and addressed review feedback. This work demonstrates hands-on experience with dependency management, async processing, frontend error handling, and iterative code refinement.",
   "reasoning": "Intern implemented an initial async job queue consumer and explored caching strategies, showing progress on two of three goals, but no evidence of fixing the cache invalidation race condition or refactoring test fixtures.",
   "source_mode": "nvidia",
   "mentor_override": null,
   "created_at": "2026-09-03T10:24:26",
   "skill_tags": [
    {
     "id": 6,
     "skill_name": "asynchronous job queue (Python)",
     "evidence_strength": 0.8
    },
    {
     "id": 7,
     "skill_name": "caching strategy exploration",
     "evidence_strength": 0.6
    },
    {
     "id": 8,
     "skill_name": "dependency management",
     "evidence_strength": 0.7
    },
    {
     "id": 9,
     "skill_name": "TypeScript/React error message improvement",
     "evidence_strength": 0.6
    },
    {
     "id": 10,
     "skill_name": "code cleanup and review responsiveness",
     "evidence_strength": 0.5
    }
   ],
   "evidence_ids": [
    6,
    7,
    8,
    9,
    10,
    11,
    12
   ]
  },
  {
   "id": 3,
   "learning_path_id": 3,
   "match_status": "PARTIALLY_ON_TRACK",
   "confidence": 0.6,
   "ai_summary": "The intern corrected a typo in the project's README, implemented a JWT-based authentication middleware in TypeScript, and performed a small code cleanup across several files. These changes improved documentation clarity, added secure authentication functionality, and refined the codebase.",
   "reasoning": "Intern implemented JWT-based authentication middleware, addressing part of the authentication rebuild goal, but provided no evidence of multi-region deployment preparation or payment gateway integration scoping.",
   "source_mode": "nvidia",
   "mentor_override": null,
   "created_at": "2026-09-03T10:24:48",
   "skill_tags": [
    {
     "id": 11,
     "skill_name": "documentation editing",
     "evidence_strength": 0.7
    },
    {
     "id": 12,
     "skill_name": "TypeScript development",
     "evidence_strength": 0.9
    },
    {
     "id": 13,
     "skill_name": "JWT authentication",
     "evidence_strength": 0.9
    },
    {
     "id": 14,
     "skill_name": "middleware implementation",
     "evidence_strength": 0.9
    },
    {
     "id": 15,
     "skill_name": "code cleanup/refactoring",
     "evidence_strength": 0.8
    }
   ],
   "evidence_ids": [
    13,
    14,
    15
   ]
  },
  {
   "id": 4,
   "learning_path_id": 4,
   "match_status": "PARTIALLY_ON_TRACK",
   "confidence": 0.7,
   "ai_summary": "The intern added integration tests for a webhook handler in Python, implemented pagination for the search endpoint (updating both documentation and Python code), and fixed a race condition in cache invalidation logic written in Go. They also performed routine dependency version bumps, explored a cache strategy in a work‑in‑progress commit, and carried out minor code cleanup. These changes demonstrate work on testing, API features, concurrency safety, and maintenance tasks.",
   "reasoning": "The intern's work includes routine bug fixes (Go race condition fix) and maintenance (dependency bumps) that match the assigned light sprint, but also adds API pagination—a new feature—and integration tests, which exceed the scope of routine bug fixes and CI tweaks.",
   "source_mode": "nvidia",
   "mentor_override": null,
   "created_at": "2026-09-03T10:25:05",
   "skill_tags": [
    {
     "id": 16,
     "skill_name": "Python integration testing",
     "evidence_strength": 0.8
    },
    {
     "id": 17,
     "skill_name": "API pagination implementation",
     "evidence_strength": 0.9
    },
    {
     "id": 18,
     "skill_name": "Go race condition fixing",
     "evidence_strength": 0.8
    },
    {
     "id": 19,
     "skill_name": "Dependency management",
     "evidence_strength": 0.7
    },
    {
     "id": 20,
     "skill_name": "Cache strategy exploration",
     "evidence_strength": 0.5
    },
    {
     "id": 21,
     "skill_name": "Code cleanup/refactoring",
     "evidence_strength": 0.6
    }
   ],
   "evidence_ids": [
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    23
   ]
  },
  {
   "id": 5,
   "learning_path_id": 5,
   "match_status": "PARTIALLY_ON_TRACK",
   "confidence": 0.78,
   "ai_summary": "The intern optimized a dashboard endpoint by fixing an N+1 query and explored a caching strategy. They also wired up CI for frontend builds, improved validation error messages in TypeScript/React, added unit tests, bumped dependencies, and corrected README typos.",
   "reasoning": "Intern fixed the N+1 query on the dashboard endpoint (fulfilling the optimization goal) and explored caching, but there is no evidence of work on building a reusable chart component for the dashboard.",
   "source_mode": "nvidia",
   "mentor_override": null,
   "created_at": "2026-09-03T10:25:38",
   "skill_tags": [
    {
     "id": 22,
     "skill_name": "SQL query optimization",
     "evidence_strength": 0.9
    },
    {
     "id": 23,
     "skill_name": "Caching strategy exploration",
     "evidence_strength": 0.7
    },
    {
     "id": 24,
     "skill_name": "CI/CD pipeline configuration",
     "evidence_strength": 0.6
    },
    {
     "id": 25,
     "skill_name": "TypeScript/React error handling",
     "evidence_strength": 0.6
    },
    {
     "id": 26,
     "skill_name": "Unit testing",
     "evidence_strength": 0.6
    },
    {
     "id": 27,
     "skill_name": "Dependency management",
     "evidence_strength": 0.5
    },
    {
     "id": 28,
     "skill_name": "Documentation editing",
     "evidence_strength": 0.4
    }
   ],
   "evidence_ids": [
    24,
    25,
    26,
    27,
    28,
    29,
    30
   ]
  },
  {
   "id": 6,
   "learning_path_id": 6,
   "match_status": "ON_TRACK",
   "confidence": 0.9,
   "ai_summary": "The intern added pagination to a search endpoint in Python, updated the associated documentation, and incorporated reviewer feedback. They also refactored the API layer's test fixtures to improve test maintainability. Finally, they implemented a rate limiting middleware in Go and addressed subsequent review comments.",
   "reasoning": "The intern implemented a rate limiting middleware in Go and addressed review comments, directly fulfilling the assignment to explore rate limiting middleware as a proof of concept. Additional work (pagination, test fixtures) does not contradict the assignment.",
   "source_mode": "nvidia",
   "mentor_override": null,
   "created_at": "2026-09-03T10:25:58",
   "skill_tags": [
    {
     "id": 29,
     "skill_name": "Rate limiting",
     "evidence_strength": 0.9
    },
    {
     "id": 30,
     "skill_name": "Go middleware",
     "evidence_strength": 0.9
    },
    {
     "id": 31,
     "skill_name": "Pagination",
     "evidence_strength": 0.8
    },
    {
     "id": 32,
     "skill_name": "Test fixture refactoring",
     "evidence_strength": 0.8
    },
    {
     "id": 33,
     "skill_name": "Documentation updates",
     "evidence_strength": 0.7
    },
    {
     "id": 34,
     "skill_name": "Code review responsiveness",
     "evidence_strength": 0.8
    }
   ],
   "evidence_ids": [
    31,
    32,
    33,
    34,
    35
   ]
  }
 ],
 "evidence": [
  {
   "id": 1,
   "intern_id": 1,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/pull/1822",
   "title": "Refactor test fixtures for API layer",
   "diff_stats": {
    "additions": 106,
    "deletions": 54,
    "files_changed": 3,
    "languages": [
     "Python"
    ]
   },
   "review_iterations": 1,
   "merged_at": "2026-06-02T00:00:00"
  },
  {
   "id": 2,
   "intern_id": 1,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/7bd3bc6a41",
   "title": "add unit tests",
   "diff_stats": {
    "additions": 18,
    "deletions": 11,
    "files_changed": 1,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-06-02T00:00:00"
  },
  {
   "id": 3,
   "intern_id": 1,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/pull/1777",
   "title": "Add pagination to search endpoint",
   "diff_stats": {
    "additions": 191,
    "deletions": 86,
    "files_changed": 3,
    "languages": [
     "Docs",
     "Python"
    ]
   },
   "review_iterations": 2,
   "merged_at": "2026-06-09T00:00:00"
  },
  {
   "id": 4,
   "intern_id": 1,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/pull/1780",
   "title": "Improve error messages on validation failures",
   "diff_stats": {
    "additions": 134,
    "deletions": 18,
    "files_changed": 2,
    "languages": [
     "TypeScript",
     "TypeScript/React"
    ]
   },
   "review_iterations": 2,
   "merged_at": "2026-06-12T00:00:00"
  },
  {
   "id": 5,
   "intern_id": 1,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/7bd3bc6a41",
   "title": "add unit tests",
   "diff_stats": {
    "additions": 13,
    "deletions": 5,
    "files_changed": 2,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-06-13T00:00:00"
  },
  {
   "id": 6,
   "intern_id": 1,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/1ace21ebf5",
   "title": "bump dependency versions",
   "diff_stats": {
    "additions": 33,
    "deletions": 8,
    "files_changed": 1,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-06-20T00:00:00"
  },
  {
   "id": 7,
   "intern_id": 1,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/1ace21ebf5",
   "title": "bump dependency versions",
   "diff_stats": {
    "additions": 5,
    "deletions": 2,
    "files_changed": 2,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-06-21T00:00:00"
  },
  {
   "id": 8,
   "intern_id": 1,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/c43ae54333",
   "title": "address review comments",
   "diff_stats": {
    "additions": 12,
    "deletions": 18,
    "files_changed": 1,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-06-22T00:00:00"
  },
  {
   "id": 9,
   "intern_id": 1,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/882aa55783",
   "title": "small cleanup",
   "diff_stats": {
    "additions": 32,
    "deletions": 17,
    "files_changed": 1,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-06-23T00:00:00"
  },
  {
   "id": 10,
   "intern_id": 1,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/c32526f149",
   "title": "wip: exploring cache strategy",
   "diff_stats": {
    "additions": 39,
    "deletions": 17,
    "files_changed": 2,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-06-24T00:00:00"
  },
  {
   "id": 11,
   "intern_id": 1,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/pull/1251",
   "title": "First pass: async job queue consumer",
   "diff_stats": {
    "additions": 40,
    "deletions": 9,
    "files_changed": 2,
    "languages": [
     "Config/CI",
     "Python"
    ]
   },
   "review_iterations": 4,
   "merged_at": "2026-06-25T00:00:00"
  },
  {
   "id": 12,
   "intern_id": 1,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/pull/1879",
   "title": "Improve error messages on validation failures",
   "diff_stats": {
    "additions": 125,
    "deletions": 54,
    "files_changed": 2,
    "languages": [
     "TypeScript",
     "TypeScript/React"
    ]
   },
   "review_iterations": 0,
   "merged_at": "2026-06-28T00:00:00"
  },
  {
   "id": 13,
   "intern_id": 2,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/1734e6a374",
   "title": "fix typo in README",
   "diff_stats": {
    "additions": 3,
    "deletions": 0,
    "files_changed": 2,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-06-04T00:00:00"
  },
  {
   "id": 14,
   "intern_id": 2,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/pull/1264",
   "title": "Implement JWT-based auth middleware",
   "diff_stats": {
    "additions": 155,
    "deletions": 108,
    "files_changed": 3,
    "languages": [
     "Config",
     "TypeScript"
    ]
   },
   "review_iterations": 1,
   "merged_at": "2026-06-06T00:00:00"
  },
  {
   "id": 15,
   "intern_id": 2,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/882aa55783",
   "title": "small cleanup",
   "diff_stats": {
    "additions": 27,
    "deletions": 12,
    "files_changed": 4,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-06-10T00:00:00"
  },
  {
   "id": 16,
   "intern_id": 2,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/1ace21ebf5",
   "title": "bump dependency versions",
   "diff_stats": {
    "additions": 16,
    "deletions": 15,
    "files_changed": 4,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-06-19T00:00:00"
  },
  {
   "id": 17,
   "intern_id": 2,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/pull/1714",
   "title": "Add integration tests for webhook handler",
   "diff_stats": {
    "additions": 25,
    "deletions": 23,
    "files_changed": 2,
    "languages": [
     "Python"
    ]
   },
   "review_iterations": 0,
   "merged_at": "2026-06-23T00:00:00"
  },
  {
   "id": 18,
   "intern_id": 2,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/1ace21ebf5",
   "title": "bump dependency versions",
   "diff_stats": {
    "additions": 24,
    "deletions": 8,
    "files_changed": 4,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-06-23T00:00:00"
  },
  {
   "id": 19,
   "intern_id": 2,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/pull/1533",
   "title": "Add pagination to search endpoint",
   "diff_stats": {
    "additions": 80,
    "deletions": 70,
    "files_changed": 3,
    "languages": [
     "Docs",
     "Python"
    ]
   },
   "review_iterations": 3,
   "merged_at": "2026-06-24T00:00:00"
  },
  {
   "id": 20,
   "intern_id": 2,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/c32526f149",
   "title": "wip: exploring cache strategy",
   "diff_stats": {
    "additions": 31,
    "deletions": 15,
    "files_changed": 1,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-06-25T00:00:00"
  },
  {
   "id": 21,
   "intern_id": 2,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/882aa55783",
   "title": "small cleanup",
   "diff_stats": {
    "additions": 19,
    "deletions": 16,
    "files_changed": 2,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-06-25T00:00:00"
  },
  {
   "id": 22,
   "intern_id": 2,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/1ace21ebf5",
   "title": "bump dependency versions",
   "diff_stats": {
    "additions": 32,
    "deletions": 19,
    "files_changed": 2,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-06-25T00:00:00"
  },
  {
   "id": 23,
   "intern_id": 2,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/pull/1309",
   "title": "Fix race condition in cache invalidation",
   "diff_stats": {
    "additions": 61,
    "deletions": 3,
    "files_changed": 2,
    "languages": [
     "Go"
    ]
   },
   "review_iterations": 4,
   "merged_at": "2026-06-27T00:00:00"
  },
  {
   "id": 24,
   "intern_id": 3,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/1734e6a374",
   "title": "fix typo in README",
   "diff_stats": {
    "additions": 3,
    "deletions": 6,
    "files_changed": 2,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-07-06T00:00:00"
  },
  {
   "id": 25,
   "intern_id": 3,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/pull/1653",
   "title": "Optimize N+1 query in dashboard endpoint",
   "diff_stats": {
    "additions": 184,
    "deletions": 58,
    "files_changed": 2,
    "languages": [
     "Python",
     "SQL"
    ]
   },
   "review_iterations": 1,
   "merged_at": "2026-07-07T00:00:00"
  },
  {
   "id": 26,
   "intern_id": 3,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/c32526f149",
   "title": "wip: exploring cache strategy",
   "diff_stats": {
    "additions": 23,
    "deletions": 10,
    "files_changed": 4,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-07-07T00:00:00"
  },
  {
   "id": 27,
   "intern_id": 3,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/pull/1750",
   "title": "Wire up CI pipeline for frontend build",
   "diff_stats": {
    "additions": 16,
    "deletions": 8,
    "files_changed": 2,
    "languages": [
     "Config",
     "Config/CI"
    ]
   },
   "review_iterations": 1,
   "merged_at": "2026-07-08T00:00:00"
  },
  {
   "id": 28,
   "intern_id": 3,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/pull/1220",
   "title": "Improve error messages on validation failures",
   "diff_stats": {
    "additions": 154,
    "deletions": 21,
    "files_changed": 2,
    "languages": [
     "TypeScript",
     "TypeScript/React"
    ]
   },
   "review_iterations": 0,
   "merged_at": "2026-07-08T00:00:00"
  },
  {
   "id": 29,
   "intern_id": 3,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/7bd3bc6a41",
   "title": "add unit tests",
   "diff_stats": {
    "additions": 25,
    "deletions": 19,
    "files_changed": 4,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-07-09T00:00:00"
  },
  {
   "id": 30,
   "intern_id": 3,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/1ace21ebf5",
   "title": "bump dependency versions",
   "diff_stats": {
    "additions": 11,
    "deletions": 19,
    "files_changed": 2,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-07-10T00:00:00"
  },
  {
   "id": 31,
   "intern_id": 3,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/pull/1283",
   "title": "Add pagination to search endpoint",
   "diff_stats": {
    "additions": 46,
    "deletions": 14,
    "files_changed": 3,
    "languages": [
     "Docs",
     "Python"
    ]
   },
   "review_iterations": 1,
   "merged_at": "2026-07-15T00:00:00"
  },
  {
   "id": 32,
   "intern_id": 3,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/c43ae54333",
   "title": "address review comments",
   "diff_stats": {
    "additions": 39,
    "deletions": 14,
    "files_changed": 3,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-07-24T00:00:00"
  },
  {
   "id": 33,
   "intern_id": 3,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/pull/1598",
   "title": "Refactor test fixtures for API layer",
   "diff_stats": {
    "additions": 19,
    "deletions": 11,
    "files_changed": 3,
    "languages": [
     "Python"
    ]
   },
   "review_iterations": 1,
   "merged_at": "2026-07-27T00:00:00"
  },
  {
   "id": 34,
   "intern_id": 3,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/pull/1925",
   "title": "Add rate limiting middleware",
   "diff_stats": {
    "additions": 173,
    "deletions": 10,
    "files_changed": 1,
    "languages": [
     "Go"
    ]
   },
   "review_iterations": 2,
   "merged_at": "2026-07-27T00:00:00"
  },
  {
   "id": 35,
   "intern_id": 3,
   "source": "mock",
   "url": "https://github.com/octocat/Hello-World/commit/c43ae54333",
   "title": "address review comments",
   "diff_stats": {
    "additions": 34,
    "deletions": 14,
    "files_changed": 1,
    "languages": []
   },
   "review_iterations": 0,
   "merged_at": "2026-07-27T00:00:00"
  }
 ]
};
