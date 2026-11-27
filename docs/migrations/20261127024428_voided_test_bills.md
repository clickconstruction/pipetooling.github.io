# 20261127024428_voided_test_bills.sql (2026-11-26, v2.8682)

A voided test bill leaves a record. Punch list #443, row 7, on the owner's answer relayed 2026-11-27: *A, test bills only*. One new table, written by one edge function and read by a developer.

## Why

**Void invoice** on Bill Customer calls `void-stripe-invoice-for-revert`. The function voids the invoice in Stripe and then deletes the bill's `jobs_ledger_invoices` row. The rows of its Stripe emails, `jobs_ledger_invoice_stripe_email_sends`, go with it by their foreign key. Stripe keeps the invoice as void. Nothing in the app is left to read as one thing.

Three ways were put to the owner. A state on the bill's own row was the first idea, and about 250 files and many SQL functions read `jobs_ledger_invoices`, each of which would have to leave a voided row out of its totals. Way A keeps the delete as it is and writes a record beside it, for a bill of a ZZ test job alone, read by a developer alone. No reader of bills changes.

## What Deleted records already keeps, and what this adds

`zzz_archive_on_delete` ([`20260716120000_deleted_records_archive`](./20260716120000_deleted_records_archive.md)) already copies a deleted `jobs_ledger_invoices` row to `deleted_records_archive`, and each deleted `jobs_ledger_invoice_stripe_email_sends` row as a row of its own. Those copies stand, for every job, and this migration does not touch them. They are there to put a row back. They are not a record of a void:

- The bill and its email rows are separate archive rows under two group keys, the job's id and the bill's id. Nothing joins them.
- `deleted_by` is null, since the function deletes as the service role. Who pressed the void is not kept.
- What was done in Stripe is not kept.
- A sent copy that names the bill, a `sent_documents` row, is not deleted and so is not archived. It is in neither place beside the bill.
- The archive is purged after 90 days.

A `voided_test_bills` row holds the bill, its sends, the Stripe side, who and when in one row, and it stays as long as its test job does.

## What it makes

One table, `public.voided_test_bills`, `CREATE TABLE IF NOT EXISTS`:

| Column | Type | What it holds |
|---|---|---|
| `id` | `uuid` primary key, `gen_random_uuid()` | |
| `invoice_id` | `uuid NOT NULL` | The deleted bill's id. No foreign key: the row is gone. Unique. |
| `job_id` | `uuid`, `REFERENCES jobs_ledger(id) ON DELETE CASCADE` | The test job. The record goes with it. |
| `bill` | `jsonb NOT NULL`, checked to be an object | The bill's whole row as it stood. |
| `sends` | `jsonb NOT NULL DEFAULT '[]'`, checked to be an array | Its sends, oldest first. |
| `stripe_invoice_id` | `text` | The Stripe invoice the bill carried, if any. |
| `stripe_action` | `text` | What the function did on Stripe's side, the `stripe_action` word of its own answer. |
| `voided_by` | `uuid`, `REFERENCES users(id) ON DELETE SET NULL` | Who pressed the void. |
| `voided_by_name` | `text` | That account's name then, or its email. |
| `voided_at` | `timestamptz NOT NULL DEFAULT now()` | When the record was written. |

Each entry of `sends` is one object with a `source`:

- `stripe_email`: a `jobs_ledger_invoice_stripe_email_sends` row (`id`, `sent_at`, `stripe_invoice_id`, `copy_emails`). This is the row that goes with the bill.
- `sent_copy`: a `sent_documents` row whose `source_table` is `jobs_ledger_invoices` and whose `source_id` is the bill (`id`, `kind`, `title`, `how`, `recipient_name`, `recipient_emails`, `subject`, `sent_at`, `sent_by_name`, `copy_path`, `resend_email_id`). That row stays where it is. The record keeps who it went to, how and when.

Not copied: a text that carried the bill's pay link. It names the bill only inside its words, and it stays in Messages. The bill's id and its `pay_code` are in `bill`.

Also made: the index `voided_test_bills_job_idx (job_id, voided_at)`, the unique index `voided_test_bills_invoice_key (invoice_id)`, a comment on the table and on nine columns, row security on, and one policy, `voided_test_bills_select_dev`: `FOR SELECT TO authenticated USING ((SELECT public.is_dev()))`. There is no `INSERT`, `UPDATE` or `DELETE` policy. `REVOKE ALL` from `anon` and `authenticated`, `GRANT SELECT` to `authenticated`, `GRANT ALL` to `service_role`. The four closing calls put the training-mode blocks, the twin fence and the archived seal on it.

## What the push leaves on prod

One new, empty table with its two indexes, its one policy, its grants, and what the four closing calls add to it: seven restrictive policies and the statement trigger `read_only_block_stmt`. No other table is changed. No row is written anywhere. No function, view or trigger of the app is made or replaced.

A second run changes nothing: `IF NOT EXISTS` on the table and both indexes, `DROP POLICY IF EXISTS` before the one `CREATE POLICY`, and the four calls create only what is missing.

## Who

| | Reads | Writes |
|---|---|---|
| A developer | every record | nothing |
| Every other signed-in role | nothing: the policy returns no row | nothing |
| A developer in training mode | every record | nothing |
| A twin, an archived account | nothing | nothing |
| Nobody signed in | refused at the table | refused at the table |
| The service role | everything | `void-stripe-invoice-for-revert` inserts. Nothing updates or deletes. |

A record goes when its job is deleted. Nothing else removes one, and no screen offers to.

## Locks

`CREATE TABLE` takes no lock on a table that exists, except through its two foreign keys: each takes a `SHARE ROW EXCLUSIVE` lock on the table it points at, `jobs_ledger` and `users`, for the moment it is added. That lock waits on a write in flight to either table, and a write that arrives while it waits queues behind it. `SET lock_timeout = '3s'` opens the file, so a push that cannot get either lock in three seconds fails and changes nothing. Push it again in a quieter moment.

The indexes are built on an empty table. `ENABLE ROW LEVEL SECURITY`, the policy, the grants and the four calls lock the new table alone.

## Order: the merge, the push and the deploy

Three things ship apart: the client on the merge, this migration on a push, and the function on a deploy. Every order is safe.

- **Merged, neither pushed nor deployed.** The old function voids as it always has. The fold's read asks for a table that is not there, the database refuses, and the fold draws nothing.
- **Pushed, not deployed.** The table stands empty. The fold reads no row and draws nothing. The old function writes nothing to it.
- **Deployed, not pushed.** The new function's insert is refused, since the table is not there. It logs the refusal and deletes the bill as before. The answer says `kept_record: false`.
- **Both.** A void of a ZZ test job's bill leaves a record, and the fold draws it.

`npm run check:calls-ahead` still names the fold's read, since it reads a table only this migration creates, and labels the PR *push right after the merge*. `deploy.yml` holds the client until the push. The client would be harmless without the table. The check cannot know that, and the push is the way through. Push with `bash scripts/db-push.sh` from a checkout of main right after the merge, then deploy the function: `bash scripts/deploy-functions.sh void-stripe-invoice-for-revert`. Neither was done by the PR.

No types PR is owed for the client: it reads the table with a cast at the one read, as the other reads of a new table do. The generated types gain the table on the next `chore(types)` PR.

## Verify after the push

Through the dev seat, read-only:

- `get_table voided_test_bills` names the ten columns.
- `read_rows voided_test_bills` answers no row.
- `check_migration_ledger` lists `20261127024428` as applied.

Then `npm run check:migration-drift` reads clean.

## Roll back

Nothing reads the table but the fold, which draws nothing without it, and nothing writes it but the function, which carries on without it. So a roll back is one statement, on its own yes, after reading that the table is empty or that its rows are not wanted:

```sql
DROP TABLE IF EXISTS public.voided_test_bills;
```

It takes the same two locks for a moment. The fences' policies and the trigger go with the table. The migration file stays in the repo and in the ledger, so a later `db push` does not make the table again. To have it again, a new migration makes it.

## Test

`npm run test:pg:voided-test-bills` applies this migration a second time after every migration, which must change nothing, and plays `supabase/tests/voided_test_bills/20_scenario.sql` in one transaction that rolls back, with fixtures made as postgres:

- The table carries the seven fence policies and the statement trigger. Its one permissive policy is the dev's read. `anon` holds no right, and `authenticated` holds `SELECT` alone.
- As the service role: a record of a bill is written with the bill's row and its one Stripe email, and the bill is deleted. The email's row goes with the bill. The record stands.
- `sends` refuses a value that is not a list, `bill` a value that is not an object, a record with no bill, and a job that is not there. A second record for the same bill is refused, and passed over with `ON CONFLICT (invoice_id) DO NOTHING`, which is what the function's second try sends.
- A dev reads both records. A dev in training mode reads them too. An assistant, a helper, the job's own master, a twin and a dev who left read none. Nobody signed in is refused at the table.
- A dev, an assistant, a dev in training mode and a twin each try an insert, an update and a delete. Each is refused, and both records stand as written.
- Deleting one ZZ job takes its record and leaves the other's. Deleting the other takes the last.

**The whole-schema bed is unrun.** Docker does not answer on the Mac that built this, so the SQL beds job on the PR is the first run of the bed against the real schema. What did run there: this migration, twice, and this scenario file as written, on a local PostgreSQL 15.14 over stand-in tables. The stand-ins hold the columns the scenario writes, `is_dev()`, `auth.uid()`, the three roles with Supabase's default grants, and four fence functions written in the shape of the real ones. The second run left the structure identical, and all 47 assertions passed. That shows the SQL parses, the constraints and the grants hold, and the policy lets a dev in and nobody else. It does not show that the real fence functions, the real `is_dev()` or the real triggers on `jobs_ledger_invoices` and `jobs_ledger` agree, which is the bed's job.

The function's side is under test in `src/lib/billing/voidStripeInvoiceForRevert.run.test.ts`, which runs the handler against a fake database and a fake Stripe.

## The walk, for the walker

Each write below is a write on prod and waits on its own yes. It needs the push and the deploy first.

1. As the dev, with Stripe in test mode, on a ZZ Test job at Ready to Bill: open Bill Customer. No *Voided test bills* line is drawn.
2. **On its own yes**, press **Make the bill and email** in test mode. The email goes to the sender alone.
3. **On its own yes**, press **Void Stripe invoice…**, tick the box, then **Void invoice**. Bill Customer closes and the job is at Ready to Bill.
4. Open Bill Customer on the same job. The foot of the window reads *Voided test bills · 1*. Press **Show**: the amount, the day, who voided it, *Voided in Stripe* and the Stripe invoice's id, and under *Its sends* the send of step 2 with its time. A send in test mode files no sent copy of the bill email itself (`send-stripe-invoice`, read in the code and not run), so expect the Stripe email's own row, which keeps no address: *Email from Stripe*, *Address not on record*. Say what the lines read.
5. Read `voided_test_bills` for the job through the dev seat: one row, `stripe_action` `void`, and `sends` a list that holds the Stripe email's row.
6. As the sample assistant through View as, open Bill Customer on the same job: no line is drawn.
7. As the dev, open Bill Customer on a real job: no line is drawn. Press nothing.
