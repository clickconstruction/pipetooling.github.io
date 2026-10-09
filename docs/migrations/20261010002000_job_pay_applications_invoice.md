# 20261010002000_job_pay_applications_invoice.sql (2026-10-09, v2.5032)

AIA G702-G703, the owner's call of 2026-10-09 on `to-dos/aia-pay-application-follow-ups.md` item 2: the office picks the bill an application became. The office ties them on the application's line in the window's history, or in Bill Customer when it sends a bill on a job with saved applications. An amount-and-date match only pre-fills the pick. The history then reads that bill's payments under the application, like *Paid $13,588.20 · Aug 22*.

## What it does

1. **`job_pay_applications.invoice_id`** `uuid`, nullable, `REFERENCES jobs_ledger_invoices(id) ON DELETE SET NULL`. Null until tied. A deleted bill unties its application.
2. **`job_pay_applications_invoice_live_uniq`**, a unique index on `(invoice_id)` for live rows with a bill. One bill belongs to at most one live application, and the index also serves the foreign key.
3. **`job_pay_applications_stamp()`** restated in full from `20261006235000`, with two additions:
   - **A tie is not a save.** An update that changes only `invoice_id` keeps `updated_at` and `updated_by`. That covers a tie, an untie, and a deleted bill's SET NULL. So the history does not read a tie as *saved again*. The test compares the row before and after with `invoice_id` and the two stamps left out.
   - **The bill is on the application's job.** A tie to a bill on another job is refused with *That bill is on another job.* (`check_violation`). A restored application whose bill another live application has since taken comes back untied, instead of the restore failing on the index.

The function stays SECURITY INVOKER. Its two reads run as the caller: the bill's job, and the other live application holding a bill. The policies let every role that can write this table read both, because `is_office_staff()` reads every bill.

Additive and idempotent: `ADD COLUMN IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`, and `CREATE OR REPLACE FUNCTION`. No new table, so no read-only or digital-twin fences to re-apply. The client reads the column through its fallback ladder, so the app works before the push and offers no tie until the column is there.

## Checked on a local Postgres 15

The stand-ins were `users`, `jobs_ledger`, `jobs_ledger_invoices`, `job_pay_applications` with its live-number index, and `auth.uid()` reading `request.jwt.claim.sub`. The migration was applied twice; the second run skipped the column and the index.
- A tie kept the saved stamps.
- A tie to a bill on another job was refused with its words.
- A second live application could not take a held bill.
- A figure save stamped the saver and kept the tie.
- A restore whose bill was taken came back untied.
- A deleted bill untied its application and left the stamps alone.

The whole-schema bed (`npm run test:pg:pay-applications`, Docker) now re-runs this migration as the table's newest. Its scenario's section 11 asserts the same six things through RLS. `.github/workflows/sql-beds.yml` gains a `pay-applications` job, so GitHub runs the bed on a PR that touches the table's migrations, its scenario or its script.

## The lock note

`SET lock_timeout = '3s';` is first.
- The column is a catalog change.
- The foreign key and the index take locks on `job_pay_applications`, a table of a few dozen rows written only from the AIA window.
- The foreign key also locks `jobs_ledger_invoices` briefly (SHARE ROW EXCLUSIVE) while it is added. A bill being saved at that moment waits out the moment.
- `CREATE OR REPLACE FUNCTION` locks no table.

## Verify after the push

1. **The column and the index.** `SELECT count(*) FROM information_schema.columns WHERE table_name = 'job_pay_applications' AND column_name = 'invoice_id';` gives `1`. `SELECT indexdef FROM pg_indexes WHERE indexname = 'job_pay_applications_invoice_live_uniq';` names `(invoice_id)` with the live-and-tied `WHERE`.
2. **The trigger carries both additions.** `SELECT prosrc LIKE '%That bill is on another job.%' AND prosrc LIKE '%to_jsonb(NEW) - ''invoice_id''%' FROM pg_proc WHERE proname = 'job_pay_applications_stamp';` gives `true`.
3. **Nothing tied yet.** `SELECT count(*) FROM public.job_pay_applications WHERE invoice_id IS NOT NULL;` gives `0`.

Then run `npm run check:migration-drift`. A types PR adds the column to `database.ts`. The client's `as never` on the tie's write can go then.

## Status

Merged as v2.5032 (#5103) and pushed with 003000 and 004000 on 2026-10-09 (drift 817 of 817). Verified read-only: the `invoice_id` column and `job_pay_applications_invoice_live_uniq` (`(invoice_id) WHERE invoice_id IS NOT NULL AND deleted_at IS NULL`) are present; the stamp trigger carries both additions; nothing tied yet. Types: PR #5111.

## Rollback

A one-off migration:
- re-creates `job_pay_applications_stamp()` from `20261006235000`;
- drops the index and the column.

The client reads the column through its fallback ladder, so it keeps working without it.
