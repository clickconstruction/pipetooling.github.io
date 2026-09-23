# 20260923170000_lien_months_creation_fallback.sql (2026-09-23, v2.3747)

Punch list #32: a job with no approved clock hours fell out of every lien reader. Adds `public.lien_fallback_month(timestamptz)` — the job's creation day in the company calendar (America/Chicago) as `YYYY-MM` — and rewrites the four readers so their months CTE is the approved-session months `UNION ALL` one creation month per job with none (`NOT EXISTS` on the same session predicate each reader already used), with a new result column `month_source` (`'hours'` | `'job_created'`; `approved_hours` is 0 on a fallback row):

| Function | Feeds | What changes |
|---|---|---|
| `list_gc_unpaid_months(uuid)` | Put a GC on notice | every job with unpaid work under the GC now has at least one month |
| `list_lien_notice_months(integer)` | the Lien desk queue, the Needs You lien card | the fallback month joins the queue when it is inside the desk's window (or is a silent closed month since 2026-09-14), like any other |
| `list_lien_affidavit_windows(integer)` | the desk's Affidavits pile | `last_month` falls back to the creation month |
| `list_jobs_owner_to_confirm()` | the owner-of-record sitting, `owner-confirm-nightly` | `first_work_month` falls back to the creation month, so these jobs get an owner lookup too |

A result column cannot be added with `CREATE OR REPLACE`, so each function is `DROP FUNCTION IF EXISTS` + `CREATE FUNCTION` inside the one transaction, with its REVOKE/GRANT and COMMENT restated. Signatures are unchanged, so no caller changes; the client reads an absent `month_source` as hours, so **deploy order does not matter**. No new table — the read-only sweeps are not re-run. Dry-run on prod inside `BEGIN … ROLLBACK` before merge (Dudley 6 → 21 jobs; the desk 12 → 17; owner list 10 → 28). After the push: `npm run check:migration-drift`, regenerate `src/types/database.ts` and the dev-mcp catalog in the usual chore PR.
