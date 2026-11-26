# 20261126030238_test_note_delete_dev.sql (2026-11-26, v2.8626)

A developer deletes a note on a test job, and a comment on a test task's day. Punch list #443, row 13, one of the eight take-backs that need a migration, on the owner's answer of 2026-11-25 (*All eight*), its push on its own yes.

## Why

**Post note** on a job's Activity writes one `jobs_ledger_thread_notes` row, and **Post** under a note a person was tagged in on a task writes one `checklist_instance_events` row of kind `comment`. A posted note has no edit and no delete: neither table had a delete policy, so a note a walk posted on a ZZ Test job stood on its Activity for good. Four stood on one ZZ Test job on 2026-11-25.

## What changes

Two `DELETE` policies for `authenticated` and the two grants, as `bill_hand_ways_delete_dev` and `sent_documents_delete_dev` open theirs, with the rule in the policy so a delete past the screen reaches no other row.

- **`jobs_ledger_thread_notes_delete_dev`**: `is_dev()`; the note's job is a ZZ test job, its own name or its stored customer name starting with ZZ (`job_is_zz_test`'s test written out, since that function is internal); and no `jobs_ledger_note_tags` row names the note as its `answer_note_id`, which is `ON DELETE SET NULL` and would otherwise forget the answer without a word. The note's own tags cascade. The notes table carries the Deleted records trigger of [`20260716120000`](./20260716120000_deleted_records_archive.md), so a dev's delete is kept there too, with no second path.
- **`checklist_instance_events_delete_dev`**: `is_dev()`; `event_type = 'comment'`, the one kind a person writes; the comment's instance is of a task whose title starts with ZZ; and no `task_note_tags` row names the comment as its `answer_event_id`. The comment's own tags cascade. Nothing keeps a comment; the screen's confirm says so.
- The four fences, restrictive `FOR ALL` policies, still hold a read-only account, a digital twin and an archived caller back from these deletes. `job_papers_fence` on the notes table holds a dev out while a paper is required on the job, as it holds every write.

## What stays

Who reads and posts a note or a comment. Every other kind of event, every note on a real job, every answer a tag names. The push a tagged person was told by.

## What it does not do

It makes and changes no table, so the four closing calls of a `CREATE TABLE` migration do not apply. It corrects no row.

## Locks

`DROP POLICY IF EXISTS`, `CREATE POLICY`, `GRANT` and `COMMENT` on two tables, each a short `ACCESS EXCLUSIVE` lock. `jobs_ledger_thread_notes` is read on every job window and `checklist_instance_events` on every task card, so a busy moment fails the push fast with `SET lock_timeout = '3s'` and it is retried in a quieter one.

## Order

The client calls no new name: it deletes through the untyped client, as the other take-backs do. Until the push a dev's **Delete…** reaches no row and the screen says so. So the push and the client deploy may land in either order, and `npm run check:calls-ahead` names no call.

## Test

`npm run test:pg:job-note-tags` and `npm run test:pg:task-note-tags` each apply this migration a second time after their own, which must change nothing, and play `supabase/tests/job_note_tags/30_dev_delete.sql` and `supabase/tests/task_note_tags/30_dev_delete.sql`: an assistant's delete reaches no row; a dev's delete of a real job's note, of a note a tag names as its answer, of a real task's comment, of the app's own completed line and of a comment a tag names as its answer each reach no row; the dev deletes a plain note and a tagged question on the test job and a plain comment and a tagged question on the test task, each with its tag; Deleted records keeps both notes; anon is refused. No Postgres runs on the Mac that built this, so the SQL beds job on the PR is the proof of the SQL.
