# 20261025010000_quickfill_mark_outcome.sql (2026-10-25, v2.5837)

Quickfill: the Mark says what happened (punch list #176, change 1). Adds `outcome text` to
`quickfill_section_mark_events` with a check that it is null, `done`, `worked` or `question`, and a
column comment. Null is a mark from before the column, or a plain look on a station with no count.
The client writes the column on every mark from v2.5837, so apply this before or with that client:
an insert carrying `outcome` fails on a table without it. Additive and idempotent (`ADD COLUMN IF
NOT EXISTS`, the constraint added only when missing). No new table, so no fence call.

Apply with `supabase db push` from the main checkout after the PR merges, then regenerate
`src/types/database.ts` in its own PR.
