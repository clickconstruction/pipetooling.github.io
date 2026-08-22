# 20260822010000_combine_job_reconciliation.sql (2026-08-22, v2.2068)

`ALTER TABLE job_status_events ADD COLUMN IF NOT EXISTS source_job_id uuid` (nullable, **no FK** —
the source row is deleted in the same transaction, so the id is forensic, not relational) +
`CREATE OR REPLACE` of **`migrate_job_ledger_costs_and_delete(p_from, p_to, p_allow_billed)`**
(base: `20260619130000_migrate_costs_allow_billed.sql`, signature unchanged). Three additive deltas:

1. The status-event repoint becomes `SET job_id = p_to, source_job_id = p_from` — migrated events
   describe the SOURCE job's transitions, and consumers that assume single-writer order
   (Weekly Money movement, RTB payloads) can now skip rows where `source_job_id IS NOT NULL`.
2. Posts a thread note on the target before the source delete, authored by `auth.uid()`:
   `Combined "<job_name>" (Job #<number>) into this job — source was <Status> at <pct>%`
   (number = hcp→click→`—` COALESCE chain; suffix omitted when status/pct unknown). The body format
   is a contract with `src/lib/jobs/jobCombineNote.ts` compose/parse — change them together.
3. Return payload gains `note_body` plus `source`/`target` objects (`status`, `pct_complete`,
   source `job_name`/`number`), snapshotted before anything moves. Old clients ignore the keys.

Idempotent (`IF NOT EXISTS` + `CREATE OR REPLACE`); `SET lock_timeout = '3s'` first line.
Apply only via `supabase db push` after merge.
