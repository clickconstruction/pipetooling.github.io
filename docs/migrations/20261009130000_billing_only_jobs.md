# 20261009130000_billing_only_jobs.sql (2026-10-09, v2.4958)

A billing-only job, kept off every crew screen. The plan is `to-dos/gc-mode/mockups/billing-only-job.md` on branch `spike/gc-mode`. The owner said yes on 2026-10-09 (call 1), with a `service_types.billing_only` flag folded in, which was O4a's finding. Stages' Working column leaving these jobs out is its default, kept.

GC mode gives each GC job we win one Pipeline job, its **billing job** (Owner Billing's decision 1), so our bills to the customer use the app's statement, Stripe, payments, promises, the chase list and the waiver train as they are. Nothing on main could keep such a job away from the crews. This migration closes every way in on the database side. Owner Billing's O4a comes next and is the first to set the column.

The client's part is v2.4972 (BO-2), its own PR after the types were regenerated:
- the money searches opt in;
- the crew lists filter;
- Stages' Working column leaves these jobs out;
- the service-type pickers leave billing-only types out;
- dev-mcp's `find_job` opts in.

## What it does

1. **`jobs_ledger.billing_only`** `boolean NOT NULL DEFAULT false`. With a constant default it is a catalog change, with no rewrite. Every job on prod reads false.
2. **`service_types.billing_only`** `boolean NOT NULL DEFAULT false`, the same kind of change. O4a's "General contracting" type sets it, so the type stays out of the dozen Pipeline pickers.
3. **Three guards**, one `SECURITY DEFINER` function, `refuse_billing_only_job(<column>)`:
   - `clock_sessions` on `job_ledger_id`;
   - `job_schedule_blocks` on `job_id`;
   - `jobs_ledger_team_members` on `job_id`.

   Each runs `BEFORE INSERT OR UPDATE OF` its column and refuses a billing-only job: *That job only carries a GC job's bills. Pick the job the work is on.* `UPDATE OF <column>` keeps them off every other update, such as clocking out, approving hours or moving a block.
4. **The flip**, `jobs_ledger_billing_only_flip` (`BEFORE UPDATE OF billing_only`):
   - on is refused while any of the three tables names the job;
   - off is always refused.

   Fixing a mistake is a migration.
5. **`search_jobs_ledger(search_text, include_billing_only DEFAULT false)`** replaces the one-argument function in the same transaction, since two overloads would make a one-argument call ambiguous.
   - The body is `20260905220000`'s, with one line added to the inner WHERE.
   - Every call that passes only `search_text` keeps working by name.
   - `anon` cannot run it.
6. **`search_jobs_for_self_schedule`** (My Schedule's **+ Add job**): the same body, with `AND NOT j.billing_only`.

## Checked on a local Postgres 15

The run used stand-ins for the four job tables and `escape_like_pattern`, with the migration applied twice:
- billing-only was turned on for a job with no crew, and refused for a job with hours;
- the three guards refused a new clock session, a moved one, a schedule block and a crew member on it;
- a clock session on a crew job, and clocking out on another, went through;
- off was refused, and a rename went through;
- the searches:
  - `search_jobs_ledger('Fair Oaks')` found 0, and with `true` found 1;
  - a named-argument call found the crew jobs;
  - `search_jobs_for_self_schedule('Fair')` found 0;
- there is one `search_jobs_ledger`, and `anon` got *permission denied*.

## The lock note

This touches four busy tables while crews work:
- the two `ALTER TABLE`s are instant catalog changes;
- the three `CREATE TRIGGER`s take a SHARE ROW EXCLUSIVE lock on `clock_sessions`, `job_schedule_blocks` and `jobs_ledger_team_members`. `clock_sessions` is written all day by clock-ins;
- the search's `DROP` / `CREATE` locks only the function.

`SET lock_timeout = '3s';` is first. **It goes in the evening batch, never in the morning clock-in hour.** If it stops at the timeout, nothing is applied, and the push runs again a few minutes later.

## Verify after the push

Each step from 2 on runs as a dev, in one transaction that rolls back. The transaction first makes a stand-in billing-only job:

```sql
BEGIN;
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, billing_only)
  VALUES ('00000000-0000-0000-0000-0000000b1110',
          (SELECT id FROM public.users WHERE role = 'dev' LIMIT 1),
          (SELECT id FROM public.service_types LIMIT 1),
          'Billing check, rolled back', true);
-- step's statements
ROLLBACK;
```

1. **The columns, and every row reads false.**
   - `SELECT count(*) FILTER (WHERE billing_only), count(*) FROM public.jobs_ledger;` gives `0` and today's count.
   - The same on `service_types` gives `0`.
2. **The guards.**
   - `SELECT tgname, tgenabled FROM pg_trigger WHERE tgname LIKE '%_refuse_billing_only' OR tgname = 'jobs_ledger_billing_only_flip';` gives 4 rows of `O`.
   - Moving a clock session, a schedule block or a crew member onto `…b1110` is each refused with *That job only carries a GC job's bills.*
3. **Ordinary work.**
   - `UPDATE public.clock_sessions SET job_ledger_id = job_ledger_id WHERE id = (SELECT id FROM public.clock_sessions LIMIT 1);` gives `UPDATE 1`.
   - Turning `billing_only` on for a job with sessions is refused, and turning `…b1110` off is refused.
4. **The searches.**
   - `search_jobs_ledger('Billing check')` gives 0, and with `true` gives 1.
   - `search_jobs_for_self_schedule('Billing check')` gives 0.
   - `search_jobs_ledger('')` gives 50, as before.
5. **Nobody signed out.** `BEGIN; SET LOCAL ROLE anon; SELECT * FROM public.search_jobs_ledger('a'); ROLLBACK;` gives *permission denied for function search_jobs_ledger*.

Then run `npm run check:migration-drift` and the types PR: `database.ts` gains the two columns and the second argument, and the dev-mcp catalog is rebuilt. The client PR follows.

## Rollback

A one-off migration:
- drop the four triggers and their two functions;
- re-create `search_jobs_ledger(text)` from `20260905220000` and `search_jobs_for_self_schedule` from `20260811140701`;
- leave the two columns.

The client (v2.4972) filters on the columns, so they stay. Its opt-in calls pass `include_billing_only`, which the one-argument search does not take, so a rollback reverts those calls in the same release.
