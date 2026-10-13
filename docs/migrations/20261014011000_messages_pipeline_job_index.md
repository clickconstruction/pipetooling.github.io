# 20261014011000_messages_pipeline_job_index.sql

Messages cut 10 (v2.5353): two indexes so Job activity can read a Pipeline job's calls, texts and emails. It is cut 10's SQL (GC Reviews helper 7, directed by the lead session GC Review). The plan is `to-dos/gc-mode/messages/BUILD_PLAN.md`, cut 10, on branch `spike/gc-mode`, and the screens are `phone-mockups.html` beside it.

**Why:** Jobs → Pipeline's Job activity is going to mix the customer's calls, texts and emails into a job's numbered feed. It reads them when a row's activity opens. The spine's indexes on `messages` and `contact_jobs` all lead with the contact, so a read by job would scan both tables. Quo and the bids@ reader are filling `messages` now.

## What it does

1. **`messages_pipeline_job`** on `messages (jobs_ledger_id, at DESC)`, where the job is set: the lines tied to one Pipeline job, newest first.
2. **`contact_jobs_pipeline_job`** on `contact_jobs (jobs_ledger_id)`, where the job is set: the people the office put on one Pipeline job. Job activity reads their lines tied to no job yet through the spine's `messages_thread (contact_id, at DESC)`. It shows those lines on each of the person's open jobs, marked not tied yet, until someone ties them in the thread.

No table, column, policy or function changes. An index reads under the policies its table already has, so the office team still reads every row and everyone else none, and no fence is needed.

## The lock note

A plain `CREATE INDEX` holds off writes to its table while it builds. Both tables are small today, so the build takes a moment. `SET lock_timeout = '3s';` heads the file, so a busy moment fails the push fast rather than queueing the webhook's writes behind it. Each index is `IF NOT EXISTS`, so a retry is safe.

## Verify after the push

Read only, in `BEGIN READ ONLY; … ROLLBACK;`:
1. **The indexes.** `pg_indexes` shows `messages_pipeline_job` and `contact_jobs_pipeline_job`, each with its `WHERE jobs_ledger_id IS NOT NULL`.
2. **The plan.** `EXPLAIN SELECT id FROM public.messages WHERE jobs_ledger_id = '00000000-0000-0000-0000-000000000000' ORDER BY at DESC` may still choose a scan while the table is tiny. That is fine. The index is there for when it grows.

## Status

Written 2026-10-12. Not pushed: the lead pushes with `supabase db push` after the PR merges. Nothing reads it yet. Job activity's read comes in cut 10's J2, after this is on prod.
