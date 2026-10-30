# 20261029190000_jobs_ledger_first_work_date.sql (2026-10-29, v2.6061)

The first day of approved work on a job, for the lien affidavit's work span ([v2.6061](../recent-features/v2.6061.md)).

- **`jobs_ledger.first_work_date date`**, nullable, no default: the earliest `work_date` among the job's approved clock sessions (approved, not rejected, not revoked), the twin of `last_work_date`. `ADD COLUMN IF NOT EXISTS`; a nullable column with no default is a catalog write, so the `ACCESS EXCLUSIVE` lock is brief, and `SET lock_timeout = '3s'` fails the push fast if the table is busy.
- **`refresh_jobs_ledger_last_work_date(uuid)`** re-created (`CREATE OR REPLACE`, grants kept): one `SELECT MIN, MAX` over the same predicate, writing both columns. The three `clock_sessions` triggers from the baseline (`…_ins`, `…_upd`, `…_del`) call it unchanged, so every approval, rejection, revocation or re-dated session keeps both days current.
- **Backfill**: one `UPDATE … FROM` over the jobs that have an approved session (about 220 at the time), setting the first day where it differs. Jobs with no approved session stay null.

No table created, so no fences. Idempotent: a second run adds nothing and updates nothing.

## Order

Client first is fine. The Lien desk reads the column in a select that falls back to the list without it until the push, and the affidavit's span then reads the first of the last month worked through the last day. After the merge: `supabase db push`, then the types chore (`src/types/database.ts` gains `first_work_date` on `jobs_ledger`).
