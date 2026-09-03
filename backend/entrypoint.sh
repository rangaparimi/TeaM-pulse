#!/bin/sh
set -e

DB_FILE="/app/data/team_pulse.db"

# File existence alone isn't a reliable "already seeded" signal — if a
# previous seed run was interrupted (container killed mid-seed), it can
# leave behind a valid-but-empty schema that would otherwise be mistaken
# for a completed seed forever. Check actual row count instead, and
# reset+reseed if the schema is present but empty.
needs_seed() {
  python -c "
import sqlite3, sys
try:
    conn = sqlite3.connect('$DB_FILE')
    count = conn.execute('SELECT COUNT(*) FROM interns').fetchone()[0]
    sys.exit(0 if count == 0 else 1)
except sqlite3.OperationalError:
    sys.exit(0)
"
}

if [ ! -f "$DB_FILE" ] || needs_seed; then
  echo "No seeded data found at $DB_FILE — seeding demo data..."
  python -m app.seed --reset
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
