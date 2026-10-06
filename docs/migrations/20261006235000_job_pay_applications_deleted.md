# 20261006235000_job_pay_applications_deleted.sql (2026-10-06, v2.4715)

Soft delete on `job_pay_applications`, so a deleted pay application stays in the job's history:

- `deleted_at timestamptz` and `deleted_by uuid` (→ `users`, set null on delete) — null while the application is live. The window's Delete now writes `deleted_at` instead of removing the row; the live list reads `deleted_at IS NULL`, the history reads the marked rows as a quiet line.
- The unique rule `job_pay_applications_job_number_uniq` (one application per job and number) is dropped and comes back as the partial unique index `job_pay_applications_job_number_live_uniq` over the live rows, so a deleted application 1 does not block a new application 1. A restore that would collide with a live number is refused by the same index.
- `job_pay_applications_stamp()` is replaced in full: a change to `deleted_at` stamps `deleted_at = now()` and `deleted_by = auth.uid()` (or clears `deleted_by` on a restore) and leaves `updated_by` / `updated_at` as they were, so the history does not read a delete as *saved again*. Any other update stamps `updated_*` as before.

Additive apart from the constraint swap; the policies and fences are unchanged (the DELETE policy stays for the old client and for a hard delete by hand).

Apply order: **client first or with the merge**. The old client's Delete removes the row, which still works. The new client marks the row; on a database without the column (PGRST204) it removes the row as before, and its reads go again without the column (`aiaPayApplicationsIo.ts`). Regenerate `src/types/database.ts` after the push.

Test: `supabase/tests/pay_applications/20_scenario.sql`, case 10 — the mark is the server's, the saved stamps stay, the number is free again, a colliding restore is refused. Run with `npm run test:pg:pay-applications` (docker); green on 2026-10-06. The runner re-applies this file, the table's newest migration, as its idempotency check — not the birth file, whose `CREATE OR REPLACE` would put the old trigger back.
