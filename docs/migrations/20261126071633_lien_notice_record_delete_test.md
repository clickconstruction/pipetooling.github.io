# 20261126071633_lien_notice_record_delete_test.sql (2026-11-26, v2.8644)

Deleting a test notice record takes its Activity line too, and the lines of records deleted before can be cleared. Punch list #443, row 1, one of the take-backs that need a migration, on the owner's answer of 2026-11-25 (*All eight*), each push on its own yes.

## Why

A § 53.056 notice recorded by hand is one `job_lien_filings` row with `by_hand` set. Its insert trigger, `job_lien_filings_to_activity_ins` ([`20261019030000_customer_sends_to_activity`](./20261019030000_customer_sends_to_activity.md)), writes one `job_activity_events` line of type `lien_notice_sent` whose `detail` names the record as `source_id`. Since v2.8567 a developer deletes a voided by-hand record of a ZZ test job from the job's Lien window, as a direct delete under the table's own policy `job_lien_filings_delete_dev`. The line stayed: `job_activity_events` has one read policy and no other (`20260608010000_job_activity_events.sql`), so only `SECURITY DEFINER` code writes it. Three records deleted that way on a ZZ Test job left three lines that name nothing.

## What it makes

Two functions, both `CREATE OR REPLACE`, `plpgsql`, `SECURITY DEFINER`, `search_path = public`, `row_security = off`, revoked from `PUBLIC` and `anon`, granted to `authenticated`, each with a comment. No table is created, so the four closing calls do not apply. No table, policy, grant or trigger is changed.

`row_security = off` changes nothing today: each function is owned by the owner of both tables, which row security does not bind. It is set so that a function that ever ran as a role row security does bind would raise. Without it the delete of the line would reach no row without a word, and the record would go alone.

### `delete_test_lien_notice_record(p_filing_id uuid) → jsonb`

It refuses in this order, each with `ERRCODE = 'P0001'`, and where the Lien window's own rule has the sentence (`lienByHandDeleteProblem`, `lienByHandTiesProblem`) the words are the same:

| The case | The words |
|---|---|
| Nobody is signed in | *Sign in first.* |
| The caller is not a developer (`is_dev()`) | *Only a developer can delete a notice record.* |
| The record is not there | *The record is not there any more. Read the window again.* |
| It is not a § 53.056 notice recorded by hand (`kind`, `by_hand`) | *Only a notice recorded by hand can be deleted.* |
| It is not voided | *Void this record first.* |
| Its job is not a ZZ test job (`job_is_zz_test`, [`20261120163000`](./20261120163000_settings_on_the_job.md)) | *Only a record on a test job can be deleted. This job is a real one.* |
| A desk paper is tied to it (`job_lien_desk_items.sent_filing_id`) | *A paper on the Lien desk is tied to this record. It stays.* or *N papers on the Lien desk are tied to this record. It stays.* |
| A bill's pay offer names it (`jobs_ledger_invoices.lien_offer_filing_id`) | *A bill’s pay offer names this record. It stays.* or *The pay offers of N bills name this record. It stays.* |
| Another record was applied from it (`job_lien_filings.applied_from`) | *Another record was applied from this one. It stays.* or *N other records were applied from this one. It stays.* |
| A sent copy names it (`sent_documents`, `source_table = 'job_lien_filings'`, `source_id` a uuid) | *A sent copy names this record. It stays.* or *N sent copies name this record. It stays.* |

The record's row is read `FOR UPDATE`, so a tie made at the same moment waits and is then refused by its own foreign key. The first two foreign keys are `ON DELETE SET NULL` and would otherwise clear the pointer without a word.

Then, in the one transaction, it deletes the `job_activity_events` rows with the record's `job_id`, `event_type = 'lien_notice_sent'` and `detail ->> 'source_id'` equal to the record's id as text, and the one `job_lien_filings` row, named again by `kind`, `by_hand` and `voided_at` in the delete itself. A delete that reaches no row raises *The record is not there any more. Read the window again.* It answers `{ ok, job_id, activity_lines }`, the last being the count of lines it took.

### `delete_test_lien_notice_stray_lines(p_job_id uuid) → jsonb`

| The case | The words |
|---|---|
| Nobody is signed in | *Sign in first.* |
| The caller is not a developer | *Only a developer can clear Activity lines.* |
| The job is not there | *The job is not there any more.* |
| The job is not a ZZ test job | *Only a test job’s Activity lines can be cleared. This job is a real one.* |

Then it deletes the job's `job_activity_events` rows of type `lien_notice_sent` whose `source_id` names no row of `job_lien_filings`, on any job. The id is compared as the text the trigger wrote, so a `source_id` that is no uuid cannot raise. A line with no `source_id` is left alone. It answers `{ ok, job_id, activity_lines }`. Zero is an answer, not an error.

## What stays

Who reads the job's Activity, and that nobody writes it directly: `job_activity_events` keeps its one read policy, so a direct `DELETE` still reaches no row for anyone. `job_lien_filings` keeps its own policies, `job_lien_filings_delete_dev` among them. Every line that names a standing record, every line of another type, every line of a real job. A live record, a record on a real job, a notice the run made, an affidavit, a retainage notice and a release of record. The pointers of everything that names a record.

## Triggers that fire on these deletes

Read in the migrations, not on a database:

- **`job_lien_filings`** has `job_lien_filings_to_activity_ins` (after insert), `job_lien_filing_void_restores_paper` (after update of `voided_at`) and the statement trigger `read_only_block_stmt` (before insert, update or delete). Only the last fires on a delete. It raises for a caller flagged `users.read_only` and is silent otherwise, also inside a `SECURITY DEFINER` function, so a developer in training mode is refused with *Read-only (training) mode: changes are blocked.*
- **`job_activity_events`** has `read_only_block_stmt` and no other trigger. The same holds.
- Neither table has `zzz_archive_on_delete`: the deleted-records archive names its tables, and neither is among them. A deleted record and its line are not copied anywhere, and Settings → Recently deleted does not show them.
- `job_activity_events` is in the `supabase_realtime` publication. The app's listener asks for inserts alone (`useJobThreadNotes`), so an Activity that is already open keeps a deleted line until it reads again.

One thing nothing here checks: `mail_pieces.source_ids` can hold a filing's id with no foreign key (`20261013120000_mail_pieces.sql`). A notice recorded by hand went out outside the run, so the run made it no mail piece, and neither the Lien window nor this function counts one.

## Locks

`CREATE OR REPLACE FUNCTION`, `REVOKE`, `GRANT` and `COMMENT` on two functions: two `pg_proc` rows. No table is locked. `SET lock_timeout = '3s'` opens the file.

## Order

The client calls `delete_test_lien_notice_record` and `delete_test_lien_notice_stray_lines` by name, and only this migration creates them. So `npm run check:calls-ahead` labels the PR *push right after the merge*, and `deploy.yml` holds the client until the push. Push with `bash scripts/db-push.sh` from a checkout of main right after the merge. The push is asked for by name and waits on its own yes.

Until the push, **Delete…** on a voided by-hand record is answered with a missing name, read as a refusal, and the record stays. That is a step back from v2.8567 for as long as the gap lasts, on a press only a developer sees. The read of the job's Activity lines works before the push, so the second line can be drawn, and its **Clear…** is refused the same way.

No types PR is owed for the client: it calls both functions as untyped RPCs, as the other take-backs call theirs. The generated types gain the two functions on the next `chore(types)` PR.

## Test

`npm run test:pg:lien-notice-record-delete` applies this migration a second time after every migration, which must change nothing, and plays `supabase/tests/lien_notice_record_delete/20_scenario.sql` in one transaction that rolls back, with fixtures made as postgres and every call made through RLS:

- An assistant and the job's own master are refused at both doors, and their direct deletes of a record and of the lines reach no row.
- A dev is refused a live record, a record on a job not named ZZ, a notice not recorded by hand, an affidavit, a record tied by each of the four ties (the sent copies with their count) and a record that is not there. Nothing changed, and the four ties stand.
- A dev's direct `DELETE FROM job_activity_events` reaches 0 rows.
- The dev deletes the voided by-hand record: it and its one line are gone, a sibling record and its line on the same job stand, and a line of another type that names the same record stands. A second delete is refused.
- A record deleted the old way, straight off the table, leaves its line. The sweep refuses the real job, whose own stray line is untouched, refuses a job that is not there, clears the one line on the ZZ job, leaves the line that names nothing and the line of another type, and answers zero the second time.
- With nobody signed in each function says *Sign in first.*, and as `anon` each call is refused at the door.

**The whole-schema bed is unrun.** Docker does not answer on the Mac that built this, so the SQL beds job on the PR is the first run of the bed against the real schema. What did run there: this migration, twice, and this scenario file as written, on a local Postgres 15 over stand-in tables that hold the columns, the policies and the read-only statement trigger the two functions touch. Every assertion passed. That shows the SQL parses and the rules hold. It does not show that the real schema's triggers and policies agree, which is the bed's job. On the same stand-ins a developer flagged read-only was refused at both doors with the trigger's words.

## The walk, for the walker

Each write below is a write on prod and waits on its own yes. The three stray lines stand on the ZZ Test job of #415's walks (card #443, *What sits on prod*).

1. As the sample assistant through View as: open the ZZ Test job's Lien window. Neither *Voided by-hand notice records* nor *Activity lines of deleted notice records* is drawn, on any tab.
2. As the dev, on a real job's Lien window: no *Activity lines of deleted notice records* line is drawn. Press nothing.
3. As the dev, on the ZZ Test job's Lien window: the line reads *Activity lines of deleted notice records · 3*. Read the job's Activity first and note the three notice lines. **On its own yes**, press **Clear…**. The confirm reads *Clear these 3 Activity lines?* and its button reads **Clear 3 lines**. Confirm. The toast reads *3 Activity lines were cleared.* and the line is gone from the window.
4. Read the job's Activity: the three notice lines are gone and every other line stands. Read `job_activity_events` for the job through the dev seat to say the same.
5. **On its own yes**, record a § 53.056 notice by hand on the ZZ Test job and void it. The job's Activity gains one notice line. The Lien window reads *Voided by-hand notice records · 1*.
6. **On its own yes**, press **Show**, then **Delete…**. The confirm reads *1 record is deleted, for good. Its line on the job’s Activity goes with it.* Confirm. The toast reads *The record was deleted. Its line on the job’s Activity went with it.*
7. Read `job_lien_filings` for the job through the dev seat: the row is not there. Read the job's Activity: the notice line of step 5 is gone, and no *Activity lines of deleted notice records* line is drawn. Tell `fixing` both.

**Applied** to prod by 2026-11-26: the dev seat's `check_migration_ledger` read 1,504 versions applied against 1,504 files on `origin/main`, this version among them (read in the docs pass after #9830); types regenerated in #9981.
