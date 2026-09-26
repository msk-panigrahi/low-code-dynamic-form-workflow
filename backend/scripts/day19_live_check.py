"""Read-only live sanity check for Day 19 tables + archive job (no data changes)."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import psycopg2

CONN = "postgresql://postgres:A24126510092@localhost:5432/dynamic_forms_db"

conn = psycopg2.connect(CONN)
cur = conn.cursor()

cur.execute(
    """SELECT table_name FROM information_schema.tables
       WHERE table_schema='public'
         AND table_name IN ('retention_policies','audit_logs','archive_job_runs')"""
)
print("TABLES:", [r[0] for r in cur.fetchall()])

# Check submissions has archived_at column
cur.execute(
    """SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='submissions' AND column_name='archived_at'"""
)
print("submissions.archived_at column:", [r[0] for r in cur.fetchall()])

# Check audit_logs columns
cur.execute(
    """SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='audit_logs' ORDER BY ordinal_position"""
)
print("audit_logs columns:", [r[0] for r in cur.fetchall()])

cur.execute("SELECT COUNT(*) FROM forms")
print("forms count:", cur.fetchone()[0])

conn.close()
print("LIVE CHECK OK")
