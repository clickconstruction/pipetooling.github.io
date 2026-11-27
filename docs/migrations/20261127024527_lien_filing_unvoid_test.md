# 20261127024527_lien_filing_unvoid_test.sql (2026-11-26, v2.8680)

A voided test lien record can be put back, with the desk paper its void moved. Punch list #443, row 2, one of the take-backs that need a migration, on the owner's answer of 2026-11-25 (*All eight*), each push on its own yes.

## Why

**Void** on a record in a job's Lien window, and **Take it back** on *Back from the clerk*, write one column: `job_lien_filings.voided_at` (`voidLienFiling`, `src/lib/jobs/lienFilingVoidIo.ts`). Nothing cleared it again. Clearing it is one write a developer may make, but a void does a second thing. For a filed affidavit and a § 53.056 notice the trigger `job_lien_filing_void_restores_paper` ([`20261119050000_lien_void_puts_notice_back`](./20261119050000_lien_void_puts_notice_back.md)) moves each desk paper the record had sent, one of two ways:

- a newer live paper of that kind is on the job: the old paper is **set aside** (`voided_at`), with its tie and its sent day left on the row;
- otherwise the paper is **put back**: `approved` when it carries an approval, else `drafted`, with `sent_filing_id` and `sent_at` cleared.

It kept no record of which paper it moved, which way, or what the sent day was. So an un-void could not put the paper back.

## What the push leaves on prod

- **Three nullable columns on `job_lien_desk_items`**, no default, no backfill, no foreign key, no index.
- **One replaced function**, `job_lien_filing_void_restores_paper()`, the trigger's. The trigger itself is not dropped or made again. The guard `job_lien_desk_items_guard()` is not touched.
- **Two new functions**, `lien_void_memory_since()` and `unvoid_test_lien_filing(uuid)`.
- **No row is written.** No table is created, so the four closing calls do not apply. No policy, grant on a table, index or trigger is made or changed.

### The three columns: the void's memory

| Column | Type | What it holds |
|---|---|---|
| `void_of_filing_ids` | `uuid[]` | The records whose void moved or set aside this paper, oldest first. Null on a paper no void has touched. |
| `void_prior_sent_at` | `timestamptz` | The paper's `sent_at` before the newest of those voids cleared it. Null for a paper set aside, which keeps its sent day. |
| `void_stamped_at` | `timestamptz` | When the newest of those voids wrote the paper. |

They are written by the trigger's function, and cleared by the un-void. Nothing else reads them. They sit under the table's own update policy like every other column, so the office could write them by hand through the API. Nothing follows from that but a refusal or a wrong put back on a test job, by a developer.

### `job_lien_filing_void_restores_paper()`

Restated from its newest definition (`20261119050000`; `20261119020000` is the only other file that defines it). One change: each of its two writes also writes the memory. The set aside write adds the record to `void_of_filing_ids`, clears `void_prior_sent_at` and stamps `void_stamped_at`. The put back write adds the record, keeps the `sent_at` it is about to clear, and stamps. The loop's read gains `sent_at`. What a void does to a paper is otherwise as it was: the existing scenario of the `lien-void-paper` bed passes against it unchanged.

### `lien_void_memory_since() → timestamptz`

The instant from which a void is known to have kept its memory. A `DO` block makes it only when `to_regprocedure('public.lien_void_memory_since()')` is null, with the answer written into its body as a literal in UTC, `IMMUTABLE`. A second run of the file finds it and leaves it alone. Revoked from `PUBLIC`, `anon` and `authenticated`.

It answers **one minute after this file's own start**, not the start itself. Two reasons, both read in the code. The trigger's new function is live only when the file commits, which is after its `now()`. And `voided_at` is the clock of the device that pressed Void (`new Date().toISOString()`), which can run a little fast.

### `unvoid_test_lien_filing(p_filing_id uuid) → jsonb`

`plpgsql`, `SECURITY DEFINER`, `search_path = public`, `row_security = off`, revoked from `PUBLIC` and `anon`, granted to `authenticated`. It refuses in this order, each with `ERRCODE = 'P0001'`:

| The case | The words |
|---|---|
| Nobody is signed in | *Sign in first.* |
| The caller is not a developer (`is_dev()`) | *Only a developer can put a voided record back.* |
| The record is not there | *The record is not there any more. Read the window again.* |
| It is not voided | *This record is not voided.* |
| It applied a paper already on record (`applied_from`) | *This record applied a paper already on record. Undo was its take-back. It stays voided.* |
| Its job is not a ZZ test job (`job_is_zz_test`, [`20261120163000`](./20261120163000_settings_on_the_job.md)) | *Only a record on a test job can be put back. This job is a real one.* |
| A paper that remembers its void is not as the void left it | *The paper this record sent has moved on since the void. The record stays voided.* |
| No paper remembers it, it was voided before `lien_void_memory_since()`, and a desk paper of its kind was on the job by then | *This record was voided before the app kept what a void does to its desk paper. It stays voided.* |

The record's row is read `FOR UPDATE` first, then every paper whose `void_of_filing_ids` holds the record, `FOR UPDATE`: the order a void takes them in.

**A paper is as the void left it** when all of this holds. This record is the last id in its `void_of_filing_ids`. Its `updated_at` equals its `void_stamped_at`: the guard stamps `updated_at` with the same `now()` in the void's own write, so the two differ once anything has written the paper. And it stands one of the two ways a void leaves a paper: set aside, still `sent` and tied to this record, or live, untied and `approved` when it carries an approval, else `drafted`. One paper that fails refuses the whole call, and nothing is written.

**The paper checks apply to a filed affidavit and a § 53.056 notice alone**, the trigger's own two kinds. A retainage notice's paper stays sent and tied through a void, and a release of record has no paper. Those two go back with no paper read.

Then, in the one transaction: `voided_at` is cleared on the record, the one column a void writes. Each remembered paper goes back the way it came. A set aside paper has its `voided_at` cleared. A paper put back goes to `sent`, tied to the record, with `sent_at` from `void_prior_sent_at`. On each, the record's id comes off the end of `void_of_filing_ids` (null when the list is then empty) and the other two columns are cleared. It answers `{ ok, job_id, kind, papers_restored, papers_unset_aside }`.

## Where this departs from one id and one day on the paper

The first design was two columns: one record id and the sent day. Two cases it could not tell apart, both read in the `lien-void-paper` bed's own scenario:

- **A paper sent twice.** A record is voided and its paper put back. The paper is sent again as a new record, and that record is voided too. One id would be overwritten by the second void. The first record would then read as a record with no paper, and go back alone. A list keeps both, and only the last can go back.
- **A paper edited on the desk.** A paper put back can be edited, printed, signed or approved before the un-void, and still read untied and approved or drafted. The stamp tells an untouched paper from one that only looks the same.

## What was read and found to need nothing

- **No rule holds one live record per job or per month.** `job_lien_filings` has no unique index and no such check (`20260902164655`, `20260923200000`, `20261117090000`), and the kernels read several live records side by side (`releaseTargets` and `releaseForAffidavit` take the newest of two, `filedAffidavit` the first). So a record put back collides with nothing and no refusal for it exists. The one such rule is on the paper: `job_lien_desk_items_live_uniq`, one paper per job and kind that is not voided, sent or missed. The un-void only moves a paper to `sent` or lifts a set aside off a `sent` paper, so it never enters that index.
- **Triggers on `job_lien_filings`.** `job_lien_filings_to_activity_ins` fires after insert alone, and a void writes no Activity line, so the un-void writes none. `job_lien_filing_void_restores_paper` fires on live to voided alone, so clearing `voided_at` does not fire it. The statement trigger `read_only_block_stmt` raises for a caller flagged `users.read_only`, also inside this function, so a developer in training mode is refused in that trigger's words.
- **The guard on the paper.** A move from `approved` or `drafted` to `sent` is no approval, no signature and no offer, so `job_lien_desk_items_guard()` asks nobody. It stamps `updated_at` on every write, and `sent_at` only when it is null, so the old sent day stands.
- **A bill's pay offer** (`jobs_ledger_invoices.lien_offer_filing_id`), **a release**, **a mail piece** (`mail_pieces.source_ids`) and **a sent copy** are not changed by a void, so they are not changed here. `lien-pay-offer` refuses a voided record at apply time and does nothing when a record is voided later.
- **The attorney's letter clock** reads the paper's sent day. A void clears that day and stops the clock. The un-void gives the day back, so the clock stands where it stood before the void.
- **Undo** (v2.7508) is the void of a record that applied a paper already on record, and it puts that record's own set aside notice back on the desk from the client (`undoLienNoticeApply`). Putting such a record back would leave that notice on the desk beside it, so it is refused.

## What it cannot put back

Written here because the function cannot refuse what it cannot see:

- **A paper deleted since the void.** A developer may delete a desk paper under the table's own policy, and a job's delete takes its papers. The memory goes with the paper, so the record reads as one with no paper and goes back alone.
- **`updated_at` on a paper.** The guard stamps it on every write, so a paper put back reads the day of the un-void there. Every other column of the paper, and every column of the record, is as before the void.
- **A device whose clock ran more than a minute fast**, voiding a record with a paper in the minute before this file ran. That void kept no memory and its day reads as past the memory's first instant, so the record would go back alone. A device whose clock runs slow is covered: the memory on the paper is read first, whatever the day says.
- **Between the void and the un-void** the paper stood on the desk, approved or drafted. The un-void refuses a paper that was written there, and it calls back nothing a person sent or said about it meanwhile.

## Locks

`ALTER TABLE … ADD COLUMN` of three nullable columns with no default takes an `ACCESS EXCLUSIVE` lock on `job_lien_desk_items` for an instant: a catalog change, no rewrite, no scan. `SET lock_timeout = '3s'` opens the file, so a push that cannot get the lock fails and is tried again. `job_lien_filings` is not locked. The rest is `CREATE OR REPLACE FUNCTION`, `CREATE FUNCTION` inside the `DO` block, `REVOKE`, `GRANT` and `COMMENT`: `pg_proc` rows.

## Roll back

Nothing here needs data put right. In this order:

1. Restate `job_lien_filing_void_restores_paper()` from [`20261119050000`](./20261119050000_lien_void_puts_notice_back.md), so no void writes the columns.
2. `DROP FUNCTION public.unvoid_test_lien_filing(uuid);` and `DROP FUNCTION public.lien_void_memory_since();`
3. `ALTER TABLE public.job_lien_desk_items DROP COLUMN void_of_filing_ids, DROP COLUMN void_prior_sent_at, DROP COLUMN void_stamped_at;`

Each as a new migration, never by hand. The client's press would then be answered with a missing name, read as a refusal.

## Order

The client calls `unvoid_test_lien_filing` by name, and only this migration creates it. So `npm run check:calls-ahead` labels the PR *push right after the merge*, and `deploy.yml` holds the client until the push. Push with `bash scripts/db-push.sh` from a checkout of main right after the merge. The push is asked for by name and waits on its own yes.

Until the push, **Put back…** is answered with a missing name and the record stays voided, on a press only a developer sees on a test job. A void made before the push keeps no memory, as before.

No types PR is owed for the client: it calls the function as an untyped RPC and reads none of the three columns. The generated types gain them on the next `chore(types)` PR.

## Test

`npm run test:pg:lien-void-paper`, the void's own bed, now applies this migration a second time after the two older files, last, so the bed ends on what prod runs. The script reads `lien_void_memory_since()` before and after that second run and fails when it moved. Then it plays every scenario in `supabase/tests/lien_void_paper/`:

- `20_scenario.sql`, unchanged: a void does to a paper what it did before.
- `30_unvoid.sql`, new, in one transaction that rolls back, with fixtures made as postgres and every void and every un-void made through RLS:
  - A void of a notice with an approved paper, of a notice with a draft, and of a filed affidavit puts the paper back and writes the memory. A void beside a newer draft sets the paper aside and writes the memory. A retainage notice's paper is untouched.
  - An assistant and the job's own master are refused. A dev is refused a record that is not there, a live record, a record that applied a paper already on record and a record on a real job.
  - The dev puts each record back. The record's row is compared whole with its row before the void. The paper's row is compared whole but for `updated_at`. A record with no paper, on a job with papers and on a job with none. A retainage notice voided before the memory. A second round trip on the same record.
  - The paper moved on, four ways, each refused with the record left voided: sent again as a new record; touched by a later void, where the later record goes back and the first stays refused; written since the void; held.
  - Voided before the memory: refused with a paper of its kind on the job by then; put back with only a newer paper of its kind and an old paper of another kind; put back with its paper when the memory is there though the day reads early.
  - With nobody signed in the function says *Sign in first.*, and as `anon` the call is refused at the door. Who may call each function, that the memory's day is fixed, the three columns, and the one trigger.

**The whole-schema bed is unrun.** Docker is not available on the Mac that built this, so the SQL beds job on the PR is the first run against the real schema. What did run there: the real `20261119050000` file, this migration twice, and both scenario files as written, on a local PostgreSQL 15 over stand-in tables that hold the two lien tables' real columns, constraints, unique index and policies, with the real guard and trigger. `lien_void_memory_since()` kept its first answer on the second run, the three functions read the same after it, and every assertion of both scenarios passed. That shows the SQL parses and the rules hold. It does not show that the real schema's other triggers, policies and default grants agree, which is the bed's job, and prod runs PostgreSQL 17.

In one transaction every write carries one `now()`. So the scenario cannot write a paper *later* than its void, and plays *written since the void* by moving the stamp back a minute. The live proof of that refusal is the walk's step 6.

## The walk, for the walker

Each write below is a write on prod and waits on its own yes. Use a ZZ Test job with a § 53.056 notice paper on the Lien desk.

1. As the sample assistant through View as: open the ZZ Test job's Lien window. No *Voided records* line is drawn, on any tab.
2. As the dev, on a real job's Lien window with a voided record: no *Voided records* line is drawn. Press nothing.
3. As the dev, on the ZZ Test job: record the notice's mailing so its paper reads sent, then **Void** the record. The paper is back on the desk. Read the paper through the dev seat: `void_of_filing_ids` holds the record's id, `void_prior_sent_at` its sent day.
4. The Lien window reads *Voided records · N*. Press **Show**: the record reads its kind, its months and its days, each on its own line. Press **Put back…**. The confirm reads *Put this record back?* and its button **Put the record back**. Confirm. The toast reads *The record is back. Its paper on the Lien desk is sent again, tied to it.*
5. Read the record and the paper through the dev seat: `voided_at` is null, the paper is `sent`, tied to the record, on its old sent day, and the three memory columns are null. The job's Activity holds what it held.
6. Void the record again. On the desk, change the paper, a month or a line of its words. Press **Put back…** and confirm: the line reads *The paper this record sent has moved on since the void. The record stays voided.* and the record stays voided.
7. A record voided before the push, on a job that held a notice paper by then: **Put back…** reads *This record was voided before the app kept what a void does to its desk paper. It stays voided.*
8. Leave the ZZ Test job as it was found, and tell `fixing` what was made and what stays.

**Applied** to prod by 2026-11-27: the dev seat's `check_migration_ledger` read 1,514 versions applied against 1,514 files on `origin/main`, this version among them (read in the docs pass after #9995); types regenerated in #10009.
