# 20261119102000_primary_scope_job_photos.sql (2026-11-19, v2.7936)

A primary reads the photo notes, the first looks and the crew's position of the jobs they have a claim on (punch list #400 PR 3, `to-dos/primary-job-doors.md`, the owner's call 2). It stands on `20261119040000_primary_scope_reports.sql` (`primary_can_read_job_reports`) and is pushed after it. The `job-photos` edge function carries the same clause and deploys after both.

## What it does

`can_report_stage_progress(job)` says yes to a primary on any job, and it stays that way: it is the write gate of a field report. This file holds four reads that gate also opened.

- **`job_photo_notes`**: a RESTRICTIVE `primary_scope_job_photo_notes` policy, for every command. A primary passes on their own shot, on a job whose reports they read, or on a job whose crew or schedule they are on.
- **The `job-photo-notes` bucket**: its read policy is made again with the same clause. The object's owner is their own upload.
- **A first look tied to a job**: `first_looks_select_job_team` is made again with the clause. `first_look_files` and the `first-look-files` bucket read `first_looks` under the caller's own policies, so they follow. The office's policy and the asked tech's policy are untouched.
- **`list_job_crew_position`**: its live definition with one clause on the job rows, `primary_can_read_job_reports`, the rule v2.7906 put on its newest-report percent.

## Why the shape

- The clause is `NOT is_primary() OR <their own row> OR primary_can_read_job_reports(job) OR helper_on_job(job)`. The first predicate is the rule a report follows. The second is the crew claim the owner asked for, on the job's team or on its schedule this week or last. It is not tied to a role despite its name, so no new predicate was written.
- Their own row always passes. The Add photo press writes a row and reads it back, on any job.
- **The stage checklist is not held.** The card proposed fencing `stage_checklist_answers`, `stage_checklist_records` and `stage_checklist_skips` too. The photo checklist of a field report reads the job's skips and the live answer row before it writes one (`ensureAnswerRow`). With a read fence, a primary reporting on a job that is not theirs would find no row, try to make one, meet the unique key, and fail to save. So those tables, their bucket, `list_job_stage_progress` and `record_stage_progress` stay open on any job. Holding them needs the report form to write through a function of its own, and that is a separate piece of work.
- Documents → Photos reads the `uploaded_photos` view, which runs as the caller and joins `jobs_ledger`. That join already holds a primary to the jobs they account-manage, so the list on that page does not change.

## Verify

Read-only on prod after the push, as the dev: `select count(*) from pg_policies where policyname = 'primary_scope_job_photo_notes'` reads 1, and `select pg_get_functiondef('public.list_job_crew_position(uuid[],date)'::regprocedure) like '%primary_can_read_job_reports(x.id)%'` reads true. The SQL bed `npm run test:pg:primary-scope-job-photos` (`supabase/tests/primary_scope_job_photos/20_scenario.sql`) reads every door as three primaries, the assistant and a helper, and has a primary on nothing add a shot on a job that is not theirs. CI runs it from `scripts/sql-beds.txt`.
