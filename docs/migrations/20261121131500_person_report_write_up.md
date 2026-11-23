# 20261121131500_person_report_write_up.sql (2026-11-21, v2.8157)

Write someone up: the ground under the phone sheet a leader or a superintendent opens from the Dashboard (punch list #410, PR 1; `to-dos/write-someone-up/`). Twelve columns on `person_reports` and three functions. It ships alone, ahead of the screens that call it. No table is created, so no fence call closes the file.

## What it does

- **`person_reports` gains** (all additive, none rewrites the table):
  - `kind`: `late_no_show`, `safety`, `work_quality`, `conduct`, `tools_truck`, `other` or `good_work`, held by `person_reports_kind_check`. Null on a report written before the phone sheet.
  - `job_ledger_id` (to `jobs_ledger`, set null when the job goes) and `job_label`, the job as the writer saw it named.
  - `occurred_time`, the time of day on the app's clock, beside `occurred_date`.
  - `author_role`, the writer's role when it was sent.
  - `author_saw_it`, true when the writer saw it themselves.
  - `author_on_job`, true when the writer had a clock session on that job that day. Worked out when it lands.
  - `seen_by`, a list of `{ person_id?, name }`, held to a list by `person_reports_seen_by_is_list`.
  - `talked_to_person`, whether the writer had talked to the person when it was sent.
  - `adds_to`, the earlier report this one adds to.
  - `press_id`, unique when set, and `pressed_at`, when Send was pressed on the phone.
  - Three partial indexes: the unique one on `press_id`, one on `job_ledger_id`, one on `adds_to`.
- **`write_up_people()`** returns `{ allowed, today, people, jobs }`.
  - `allowed` is true for an active `dev`, `master_technician` or `superintendent`. Anyone else gets false and two empty lists.
  - `people` is every active roster row but the caller's own, without sample accounts, twins and archived logins: `person_id`, `name`, `kind`, and, when they shared a job-day with the caller in the last seven days, `with_date`, `job_id`, the job's numbers, name and address, and `clocked_in_at`.
  - A shared job-day is one the caller was listed on (`job_schedule_blocks`) or clocked on (`clock_sessions`, not rejected or revoked). For a superintendent it is also every job-day of a job on a project they are assigned to (`project_superintendents`).
  - `jobs` is the caller's own jobs of those days, newest first.
- **`land_person_report(p jsonb)`** returns `{ already, id, status }`.
  - The caller must be an active `dev`, `master_technician` or `superintendent`.
  - `press_id` is required. A press already landed by the caller answers `already: true` with its row. Another person's press is refused.
  - It refuses, in words: no subject or one off the roster, the caller's own roster row, a kind off the list, no words, more than 4,000 characters, no day, a day after today, a job that is gone, an addition to a report the caller did not write or about another person.
  - `author_name`, `author_role` and `author_on_job` are set on the server. `seen_by` is cut to twelve names of 80 characters, a blank name dropped and a malformed id left out. `pressed_at` is the phone's stamp unless it is ahead of the server.
- **`withdraw_person_report(p_report_id, p_reason)`** returns `{ already, status }`. The caller must be the author and must give a reason. A report that still waits becomes `dismissed` with `resolution_note` *Taken back by the writer: …*, `resolved_at` and `resolved_by`. One already filed or dismissed answers `already: true`.
- All three are `SECURITY DEFINER`, owned by `postgres`, closed to `anon` and `PUBLIC`, granted to `authenticated`.

## What it leaves alone

- The table's policies. A leader's direct insert still works, which the Dashboard's HR Report card uses until the sheet replaces it. An author already reads their own rows, so a superintendent reads theirs.
- `file_person_report` and `dismiss_person_report`, the office's two doors.
- The training-mode block. The functions write as the caller, so the statement trigger on `person_reports` still refuses a person in training mode.

## Locks

`ALTER TABLE … ADD COLUMN … REFERENCES jobs_ledger` takes a brief lock on `jobs_ledger` to add the foreign key. `lock_timeout` is 3 s, so a busy moment fails the push and it is tried again.

## The bed

`npm run test:pg:person-report-write-up` (`supabase/tests/person_report_write_up/`, listed in `scripts/sql-beds.txt`).

## After the push

`src/types/database.ts` and the dev seat's catalog learn the columns and the functions with the PR that first calls them.

**Applied** to prod by 2026-11-23: `npm run check:migration-drift` read 1,454 versions applied against 1,454 local files, this version among them (read in the docs pass after #9274); types regenerated in #9220.
