# 20261127051105_ready_to_bill_notice_leaves_zz_out.sql (2026-11-26, v2.8689)

A ZZ test job sends no Ready to bill notice. Punch list #443, row 7's walk, on the owner's answer of 2026-11-27 (*Yes, build it*). The yes covers the build. The push waits on its own.

## Why

A void that takes a job's last billed bill moves the job from Billed back to Ready to bill: `syncJobToReadyToBillIfNoBilledInvoicesRemain` calls `update_job_status`. Every move into `ready_to_bill` fires `enqueue_ready_to_bill_notification_au` on `jobs_ledger` ([`20260819230000_ready_to_bill_notifications.sql`](../../supabase/migrations/20260819230000_ready_to_bill_notifications.sql)), whose function queues one `paid_job_email_queue` row of kind `ready_to_bill`. The `paid-job-email` drain sends that row, by email and by push, to the people on the office's Ready to Bill list within about 15 minutes. Nothing on that path left a test job out. So voiding a ZZ test job's test bill, the press row 7 was built to walk, told real people that a job that is not real was ready to bill. The same held for every other move of a ZZ test job into Ready to bill.

## What it makes

One function, restated from its newest definition with one line added. `enqueue_ready_to_bill_notification()` is defined in `20260819230000` and in no later migration, the baseline included. Its header is as it was: `plpgsql`, `SECURITY DEFINER`, `search_path = public`. That definition carries no `REVOKE` and no `GRANT`, so the file writes none.

```diff
 BEGIN
+  -- A ZZ test job sends no notice: nothing is queued, so the drain has nothing to send.
+  IF public.job_is_zz_test(NEW.id) THEN RETURN NEW; END IF;
   INSERT INTO public.paid_job_email_queue (job_ledger_id, kind)
   VALUES (NEW.id, 'ready_to_bill');
   RETURN NEW;
```

Its comment is restated with one sentence added: *Since v2.8689 a ZZ test job (job_is_zz_test: its name or its stored customer name starts with ZZ) enqueues nothing.*

`job_is_zz_test(uuid)` ([`20261120163000`](./20261120163000_settings_on_the_job.md), its only definition) reads `jobs_ledger.job_name` and `jobs_ledger.customer_name` by id and nothing else: true when either starts with ZZ, in any case, after spaces, tabs and line ends are trimmed. `customer_name` is the name stored on the job's own row, not the customer's row. The trigger fires after the update, and its function is volatile, so the read sees the row as it stands after the update: a job renamed in the same update as its move is judged by its new name.

`job_is_zz_test` is revoked from `PUBLIC`, `anon` and `authenticated`. The trigger's function is `SECURITY DEFINER` and has the same owner, and a revoke does not bind the owner. `jobs_ledger_keep_baseline_on_billing` has called `keep_job_baseline`, revoked the same way, from the same table's status trigger since `20260912052042`.

## Why the function and not the drain

The function is the one place every move into `ready_to_bill` passes, whoever makes it. A row that is never queued is never coalesced, retried or counted. The drain is an edge function: a rule there would wait on a deploy, and it would leave rows in the queue that are stamped and never sent.

## What the push leaves on prod

One replaced function and its comment: one `pg_proc` row and its description. No table, column, policy, grant, trigger or row is made or changed. No table is locked. `SET lock_timeout = '3s'` opens the file. No table is created, so the four closing calls do not apply. Safe to run twice.

## What stays

- The trigger `enqueue_ready_to_bill_notification_au`, its `WHEN` clause, the queue table and `job_is_zz_test`.
- The drain. `paid-job-email` is not changed and owes no deploy.
- The paid notices. A ZZ test job that reaches Paid still queues its `paid_in_full` row (`enqueue_paid_job_email`), and a payment on one still queues its `payment` row (`enqueue_payment_made_email`). Neither function is touched, and those still reach the people on their lists.
- Rows already in the queue. A `ready_to_bill` row a ZZ test job queued before the push is sent by the next drain as before.
- **Preview & test** in the Ready to Bill notifications window. Its three presses call the function's `preview`, `test_send` and `test_push` modes with a job's id. None of them reads or writes the queue, so each still works for a ZZ test job.

## What is known

- **No ZZ test job ever sends this notice**, the times a person moves one to Ready to bill to look at the notice included. The owner was told this before the yes. **Preview & test** is the way to see the notice for a test job.
- Nothing else reads a `ready_to_bill` queue row. The drain is the queue's only reader in the app. No count, badge, Settings list, email schedule or Day book reads the table. The dev seat can read it as any table.
- A job counts as a test job by its two stored names at the moment of the move. A real job whose name starts with ZZ, in any case, sends none either. The rule is `job_is_zz_test`'s, as everywhere else it is asked.

## Order

The client calls nothing this migration creates, and the function it replaces answers as before until the push. Any order of the merge and the push is safe. Until the push a ZZ test job still sends the notice. From the merge, the Ready to Bill notifications window and the guide say a test job notifies nobody, which is true only from the push. Push with `bash scripts/db-push.sh` from a checkout of main right after the merge. The push waits on its own yes. No types PR is owed: a replaced function changes no generated type.

## Read before the push

The function now calls `job_is_zz_test` on every move into `ready_to_bill`, a real job's too. If the two functions had different owners on prod, that call would be refused and every such move would fail with it. Both were made by migrations with no `OWNER TO`, so one owner is expected, and the bed asserts it on the whole schema. It was not read on prod by the PR. One read-only line settles it, and it must answer one row:

```sql
SELECT DISTINCT p.proowner::regrole FROM pg_proc p
WHERE p.oid IN ('public.enqueue_ready_to_bill_notification()'::regprocedure, 'public.job_is_zz_test(uuid)'::regprocedure);
```

## Verify after the push

Read-only, through the dev seat or `psql`:

1. `SELECT pg_get_functiondef('public.enqueue_ready_to_bill_notification()'::regprocedure);` holds the line `IF public.job_is_zz_test(NEW.id) THEN RETURN NEW; END IF;` above the insert.
2. `SELECT obj_description('public.enqueue_ready_to_bill_notification()'::regprocedure, 'pg_proc');` ends with the sentence above.
3. `check_migration_ledger` reads this version as applied.

With a write, on its own yes: move a ZZ test job from Working to Ready to bill and back. Read `paid_job_email_queue` for the job's id: no row of kind `ready_to_bill` was added. The job's `job_status_events` rows are written as before.

## Roll back

Re-apply the function and its comment from `20260819230000` (lines 29 to 40 and 50 to 51) in a new migration. Nothing else was changed, so nothing else is put back.

## Test

`npm run test:pg:ready-to-bill-notice-zz` reads the function's definition, comment, owner and grants, applies this migration a second time after every migration, and reads them again: they must be the same. Then it plays `supabase/tests/ready_to_bill_notice_zz/20_scenario.sql` in one transaction that rolls back, with fixtures made as postgres and the moves made by a signed-in dev:

- The trigger stands once on `jobs_ledger`, enabled, on this function. The function runs as its owner with `search_path=public`. It and `job_is_zz_test` have one owner, and `authenticated` cannot call `job_is_zz_test` itself.
- From Working into Ready to bill through `update_job_status`: a real job queues one row, and so does a job with zz inside both of its names. A job with ZZ at the start of its own name, one with ZZ at the start of its stored customer name alone, and one named in lower case after a space queue none.
- From Billed back into Ready to bill through `update_job_status`, the move a void makes: the real job queues one, and the three kinds of ZZ test job none.
- By a direct update under RLS, where the trigger's function is the only code that runs as its owner: out of Ready to bill queues nothing, and back into it queues one more for the real job and none for the ZZ test job.
- A send back to Working, a move to Waiting, and an update that leaves the status at `ready_to_bill` queue nothing for either kind.
- A real job renamed to a ZZ name in the same update as its move queues nothing. A ZZ test job renamed to a real name in the same update queues its one row.
- A real job and a ZZ test job that reach Paid each queue one `paid_in_full` row, and no move queued a `payment` row.

**The whole-schema bed is unrun.** Docker does not answer on the Mac that built this, so the SQL beds job on the PR is the first run of the bed against the real schema. What did run there, on a local PostgreSQL 15: stand-in `jobs_ledger`, `users` and `service_types` tables with the columns the scenario touches, a stand-in `update_job_status`, and the real queue, both real enqueue triggers and the real `job_is_zz_test`, cut from their migration files by line. Against main's function the scenario failed at its first assertion about a ZZ test job, with each ZZ job holding one queued row. After this migration, twice, the second run changed nothing and the scenario as written passed, every assertion. As `authenticated`, a direct call of `job_is_zz_test` was refused while the trigger's call went through. That shows the SQL parses and the rule holds. It does not show that the real schema's other triggers and policies let the scenario's moves through, which is the bed's job.

## The walk, for the walker

It needs the push first. Each write is a write on prod and waits on its own yes.

1. Read the queue for a ZZ test job through the dev seat and note its `ready_to_bill` rows.
2. **On its own yes**, move that job from Working to Ready to bill on the Pipeline, then send it back.
3. Read the queue again: no new `ready_to_bill` row. Say the count before and after.
4. Open **Ready to Bill notifications** on the Pipeline. The words under the heading say a test job notifies nobody. Press nothing in **Preview & test** without its own yes: **Email a test** and **Push a test** send for real.
