# 20261030040000_field_presses_notes_reports.sql (2026-10-29, punch list #163 PR 3)

`CREATE OR REPLACE` of **`land_field_press(p_id uuid, p_kind text, p_pressed_at timestamptz, p_payload jsonb)`** ([the PR 2 fragment](20261029230000_field_presses.md) has the table, the repeat rule, the bounds and the clock kinds, which this version keeps word for word), adding the queue's two more kinds:

- **`job_note`**: `INSERT INTO jobs_ledger_thread_notes (job_id, author_user_id, body, created_at)` with the caller as the author and `created_at` at the pressed time, under the caller's own insert policy (the job's team, its schedule's assignees, the office). Refuses with `22023` when the body is empty. Answers `{ note_id, late }`.
- **`field_report`**: an estimator (`is_estimator()`) goes through `public.insert_report(...)`, the definer path the form already uses for that role, and the row's `created_at` is then set to the pressed time; everyone else inserts into `reports` directly under their own policy, `created_at` at the pressed time, with the template, the field values, the job, project or bid, and the location when given. Answers `{ report_id, late }`.

Still `SECURITY INVOKER`, `search_path = public`; the grants are unchanged (`authenticated` executes, `anon` and `PUBLIC` do not). No table, no fences. A function definition takes no table lock; `SET lock_timeout = '3s'` first all the same.

## Order

After PR 2's `20261029230000_field_presses.sql`. Push right after the merge, before the Pages deploy finishes (about ten minutes): the client sends every note and report to the two new kinds, online or queued, so until the push the old function refuses them with *That kind of press cannot be sent from the queue yet*. From the main checkout after the merge: `bash scripts/db-push.sh`, then the types chore.
