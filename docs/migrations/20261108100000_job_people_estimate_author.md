# 20261108100000_job_people_estimate_author.sql (2026-11-08, v2.6694)

The estimate's author among the job's people (punch list #129, the leftovers, `to-dos/estimator-money-word/README.md`): the owner's call of 2026-11-08 on the card's first question. A job made from a signed estimate had no estimator among its people, since `is_job_people` (`20261019060000_job_people.sql`) knew only the bid's estimator or account manager and the job's account manager. The client works before and after the push: the E chip reads `estimates` itself, and the gates the predicate holds simply stay as narrow as before until the push. Push after the PR merges.

## What it does

**`is_job_people(p_job_id uuid)`** re-stated (STABLE, SECURITY DEFINER, `CREATE OR REPLACE`): the body of `20261019060000` with one more leg inside the estimator-or-primary branch — true when the signed-in person is `estimates.created_by` on an estimate whose `job_ledger_id` is the job, whose `status` is `customer_accepted` and whose `doc_kind` is not `change_order`. That is the mark `auto_create_job_from_signed_estimate` leaves (through `create_job_from_estimate`), and the mark the office's own *Create job* on a signed estimate leaves. A change order is applied to a job and never its source, so its author gains nothing. The role check (`estimator`, `primary`) stays: an author who has since become a helper or a sub opens nothing.

Every gate that reads the predicate widens with it and none is re-stated: `add_job_payment_promise`, `void_job_payment_promise`, `set_job_promised_pay_date`, `add_job_payment_claim`, `list_job_payment_promises_for`, `list_paid_claims`, `list_bid_money_strip`, `list_customer_money_strip`, `list_my_money_strip`, and a primary's paid verbs (`20261019120000`). Nothing on `jobs_ledger`'s or `estimates`' policies changes.

## Why the shape

- One predicate, one more leg: the scope stays the job's, and every surface that already asks *is this one of the job's people* gets the author for free.
- The signed estimate pointing at the job is the fact, not an activity row: `job_activity_events`' `job_auto_created_from_estimate` is best-effort telemetry and may be missing; `estimates.job_ledger_id` is what the create writes and what Edit Job's *Source estimate* banner reads.
- `status = 'customer_accepted'`: a draft or a sent estimate linked to a job by hand is not a sale yet.

## Verify

Read-only on prod after the push: `select pg_get_functiondef('public.is_job_people(uuid)'::regprocedure)` names `estimates`. The SQL bed `npm run test:pg:job-people` (`supabase/tests/job_people/20_scenario.sql`) gains a fourth job, J4, made from Nia's signed estimate: Nia is J4's and no other job's, writes the customer's word on J4, is refused on J1; the author of a change order on J3 is not J3's; the runner re-applies this file a second time and it changes nothing. CI runs it from `scripts/sql-beds.txt`. `src/types/database.ts` needs no regen (no signature changed).

**Applied** to prod on 2026-11-08, read the same day: `scripts/db-push.sh` from a scratch checkout of `main` at the merge of #7316 (0aa03dd0e) — the CLI asked for `--include-all`, this file's stamp sitting before the five already applied that day (20261108120000–20261108190000), and the script's retry applied it alone; `npm run check:migration-drift` then read 1170 local files and 1170 remote versions, fully applied. The read-only check above ran through the management API's query endpoint: `pg_get_functiondef` names `estimates`, `customer_accepted` and `change_order`. No types PR: the regen the script ran matched #7350's `database.ts` byte for byte (no signature here changed).
