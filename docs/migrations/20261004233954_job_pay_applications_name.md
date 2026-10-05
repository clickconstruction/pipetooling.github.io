# 20261004233954_job_pay_applications_name.sql (2026-10-04, v2.4508)

One column on `job_pay_applications`:

- `name text NOT NULL DEFAULT ''` (a check keeps it to 80 characters) — the office's own name for a saved application ("Sent to the GC"). It shows in the AIA window's list and on the job window's Documents tab. It is never printed on the G702 or the G703.

Additive; the table's policies and fences are unchanged.

Apply order: **migration first, or with the merge**. The old client never names the column. The new client reads without it on a database that lacks it, and a save there goes again without the name (`aiaPayApplicationsIo.ts`'s column sets), so a name typed before the column exists is not kept. Regenerate `src/types/database.ts` after the push.

Test: `supabase/tests/pay_applications/20_scenario.sql` — a row starts with no name; the office names one; a name past 80 characters is refused.
