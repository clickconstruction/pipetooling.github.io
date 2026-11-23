# 20261123162010_stripe_paid_day_older_rows.sql (2026-11-23)

Bills sent, punch list #422 (v2.8371). The Stripe payments filed a day late before `20261123074206` go back to the day they were made. Data only: no table, no function, no grant.

## Why

Until `20261123074206_stripe_paid_day_is_the_company_day.sql`, `mark_invoice_paid_from_stripe` dated a customer's own Stripe payment with the UTC date of the moment the webhook ran. A payment made after 6 PM Central in winter, or 7 PM in summer, was filed on the next day. That migration files the company's day from then on and left the older rows alone, for the owner to call after their list was read.

Read on prod on 2026-11-23, read only, with no amounts: of every Stripe row on record, six sat a day late. Each was written between 6 PM and midnight Central. Three were Sunday-night payments filed on a Monday. None crosses a month. The owner said yes to moving them the same day.

## What it does

One `UPDATE` in a `DO` block. A row moves only when it carries every mark of the old function's own write for a customer's payment, made in the evening, before the fix:

- it is on a bill, its note is the function's `'Stripe'`, and it has no payment type, number or recorder. A bill marked paid outside Stripe names those, and its day was named by a person;
- its `paid_on` is the UTC date of its `created_at`, and that is not the company's date of `created_at`;
- it was written before 2026-11-23, the company's day the fix went in.

It moves to the company's date of `created_at`, in the zone `public.app_today()` reads (`America/Chicago`). That is one day back. The same six rows match this rule and the looser one the count used (note *Stripe*, late by a day).

The update refuses to move more than six. A seventh match means a row nobody has read, so it raises and the whole update rolls back. On a fresh database, such as a SQL bed or a local reset, nothing matches and nothing moves. A second run moves nothing, since a moved row's day is no longer the UTC date. It starts `SET lock_timeout = '3s'`, and it ends with a notice of how many rows it moved.

## What it does not do

- No amount, bill or job changes. The job's running total (`payments_made`) is recomputed as the sum of the job's amounts, so it stays. That recompute locks each job's row for a moment, so a job row held by someone else makes the push fail fast under the lock timeout; try again.
- No trigger on `jobs_ledger_payments` reads `paid_on`, and none on an update writes an email or an activity line. Read from `pg_trigger` and `pg_proc` on prod before the PR: the email fires on an insert, the activity line on an insert or a delete. A payment event is written by a move between jobs, not by a trigger. So the job's trail gains no line, and this note and the release note are the record.
- A paper or an email already sent keeps the day it said.
- `mark_invoice_paid` and `mark_job_paid` were never in question: the app's payment windows name the day when they call them.

What moves on the screens: the three Sunday-night payments go from a Monday to the Sunday before. The company's weeks run Monday to Sunday, so Weekly money counts them in the week before. A weekly email already sent is not sent again.

## Checked before the push

The SQL bed `stripe-paid-day` (`npm run test:pg:stripe-paid-day`) runs every migration on Supabase Postgres 17, so this one runs once on empty tables and moves nothing. Then `supabase/tests/stripe_paid_day/30_older_rows.sql`, in phases around runs of this file as `db push` runs it:

- Three late rows move back a day: a Sunday-night payment in November, one a minute before midnight in summer, and one on the last evening of September, which moves into September.
- Nine rows stay. Two were on their day: one made at noon and one just after midnight. Five differ from a late row in one mark each: a payment type, a number, a recorder, a note that is not *Stripe*, and no bill. And two were written on or after the day of the fix: one with a day named, and one from the fixed function.
- No amount, no recorder and no job total changes.
- The file says it moved three. A second run says it moved none, and every row is where the first run put it.
- Seven more late rows than the six read on prod: the file refuses, names the count, and moves none of them.

## The push

After the merge, on the owner's yes (2026-11-23), from a checkout at `origin/main`, with this file the only one pending:

```bash
supabase db push --linked
```

No types regenerate, since no shape changes.

## To verify after the push

```sql
SELECT count(*) FROM public.jobs_ledger_payments p
WHERE lower(btrim(p.note)) = 'stripe'
  AND p.paid_on = (p.created_at AT TIME ZONE 'UTC')::date
  AND p.paid_on <> (p.created_at AT TIME ZONE 'America/Chicago')::date;  -- 0
```
