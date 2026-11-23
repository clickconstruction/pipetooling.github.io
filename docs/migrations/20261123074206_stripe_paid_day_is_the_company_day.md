# 20261123074206_stripe_paid_day_is_the_company_day.sql (2026-11-23)

Bills sent, punch list #422, PR 2 (v2.8335). A Stripe payment is filed on the company's day. One function replaced, one line changed. No table.

## Why

`mark_invoice_paid_from_stripe` writes the `jobs_ledger_payments` row when Stripe says a bill was paid. The row's `paid_on` was

```sql
COALESCE(p_paid_on, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date)
```

beside a note that the webhook always sends the day. It does not. `stripe-webhook` passes `p_paid_on` only from the invoice's `pt_paid_on` metadata, and that is written for a bill marked paid **outside** Stripe (`record-stripe-invoice-out-of-band-payment`). A customer who pays by card or bank debit names no day, so the row took the UTC date of the webhook. A payment made after 6 PM Central in winter, or 7 PM in summer, was filed on the next day.

Read on prod through the dev seat on 2026-11-23, read only, counts only: of the 9 Stripe payments in the 31 days before, 4 sat one day late. Three were paid on a Sunday night and read as Monday.

Every reader of `paid_on` carried it: the Dashboard's Money in bar, the Bridge, Weekly money, a customer's timeline, and Bills sent, whose second view will list money by the day it came.

## What it does

The default becomes `public.app_today()` (`20260903190000`): today in the company's calendar.

```sql
v_paid_on := COALESCE(p_paid_on, public.app_today());
```

The rest of the body is `20261001153000_payment_actor_and_link.sql`'s, line for line. A `diff` of the two bodies shows that one line and its comment. The six arguments are the same, so `CREATE OR REPLACE` keeps the grants, and the file names them again: `REVOKE ALL … FROM PUBLIC, anon, authenticated`, `GRANT EXECUTE … TO service_role`. It starts `SET lock_timeout = '3s'`. A second run changes nothing.

A day the webhook names still stands: a check recorded on a Stripe bill keeps the day the office gave it.

## What it does not do

It does not touch a row already written. The older Stripe rows that sit a day late are a separate step, to take only on the owner's word and after their list is read:

- the rows whose note is *Stripe*, with no payment type, whose `paid_on` is one day after the company's day of `created_at`;
- an update fires the payments table's history trigger, so each corrected row gains a line in its job's trail;
- a payment that moves from a Monday to a Sunday can move between weeks on Weekly money and the Bridge.

`mark_invoice_paid` and `mark_job_paid` default the same way (`20261019120000_primary_paid_verbs.sql`). They are left as they are: the app's payment windows name the day when they call them.

## Checked before the push

The SQL bed `stripe-paid-day` (`npm run test:pg:stripe-paid-day`) runs every migration on Supabase Postgres 17, then this one a second time, then the scenario, as the service role:

- The function's own body names no UTC day and asks for `app_today()`. This holds at any hour the bed runs.
- anon and a signed-in person cannot run it. The service role can.
- A customer's own payment: one row for the whole bill, on the company's day, with the note *Stripe*. The bill and the job are paid.
- Stripe's second event for the same payment is answered ok and adds no row.
- A check recorded on a Stripe bill keeps the day, the type and the number the office named, and who recorded it.
- A bill it does not know is refused in words.

## The push

Nothing in the client calls this function. `stripe-webhook` does, with the same arguments as before, so no edge function is redeployed. After the merge, on the owner's yes by name:

```bash
bash scripts/db-push.sh
```

from a checkout at `origin/main`. The function's shape does not change, so no types regenerate.

## To verify after the push

```sql
SELECT position('app_today' IN pg_get_functiondef('public.mark_invoice_paid_from_stripe(uuid, text, text, date, text, uuid)'::regprocedure)) > 0;  -- true
SELECT has_function_privilege('authenticated', 'public.mark_invoice_paid_from_stripe(uuid, text, text, date, text, uuid)', 'EXECUTE');  -- false
```

Then the next Stripe payment made in the evening reads on that day on the Dashboard's Money in bar.
