# 20261119040000_primary_scope_reports.sql (2026-11-19, v2.7906)

A primary reads the reports of their own jobs and no others, in the database. The owner's word of 2026-11-19: "A primary should only be able to see reports for jobs they are the account manager of or the listed superintendent of they can no longer see all reports." It is part 4 of the primary scoping of v2.2174 to v2.2177 (`20260823171344`, `171822`, `172141`), which left reports open on purpose (D1). It ships with the client that says whose reports the list holds ([v2.7906](../recent-features/v2.7906.md)).

Push after the merge, from a clean checkout of `main`. It is safe on either side of the client deploy: no name, argument or returned column changes, so the old client and the new one read through the same names and a primary simply gets fewer rows.

## The rule

A user whose role is `primary` reads a report when one of these holds. Every other role reads as before.

| The report | A primary reads it when |
|---|---|
| on a job | they are the job's account manager (`primary_can_access_job`, the predicate of parts 1 to 3: `jobs_ledger.account_manager_user_id`), or the job's project lists them as superintendent |
| any report | they wrote it (`reports.created_by_user_id`) |
| on a project, no job | the project lists them as superintendent |
| on a bid, no job | the bid is theirs (`primary_can_access_bid`, part 1: estimator, account manager or creator) |

A job lists its superintendent through its project: a `project_superintendents` row (the chips on Projects and Workflow) or `gc_projects.superintendent_user_id` (the GC project's one). They are the two sources `superintendent_scores` reads. `jobs_ledger` has no superintendent column of its own.

## What it makes

| Object | What it is |
|---|---|
| `primary_can_read_job_reports(job)` | New. `primary_can_access_job(job)`, or listed as superintendent on the job's project. `SECURITY DEFINER`, `authenticated` and `service_role`. |
| `primary_can_read_report(job, project, bid, author)` | New. The table above, for the caller. `SECURITY DEFINER`, `authenticated` and `service_role`. |
| `primary_scope_reports` on `reports` | New. `RESTRICTIVE FOR ALL`: `NOT is_primary() OR primary_can_read_report(...)`. |
| `primary_scope_report_photos` on `report_photos` | New. `RESTRICTIVE FOR ALL`: not a primary, or their own shot, or a job whose reports they read. |
| `report_photos_files_select` on `storage.objects` | Dropped and made again, as `20261029220000` does, with the primary's clause added: their own upload, or a job whose reports they read. |
| `list_reports_with_job_info()` | Replaced. The live body with one clause added at the end of `WHERE`. |
| `list_reports_for_job_ledger(job)` | Replaced. The same one clause. |
| `list_reports_for_bid(bid)` | Replaced. The same one clause. |
| `list_job_crew_position(jobs, today)` | Replaced. The same clause on the newest-report read, so the percent it carries is from a report the caller reads. |

The four function bodies are `pg_get_functiondef` taken on 2026-11-19 from a copy of the whole schema with every migration applied, never the baseline file. A diff of each against the newest file that defines it shows the added clause and nothing else.

## Every report surface, and how it is gated now

| Surface | Read through | Gate for a primary |
|---|---|---|
| Dashboard, **Recent Reports** card and its band, the counts, **Mark N opened** | `list_reports_with_job_info` | the function's clause; the counts are the list it answers |
| Jobs, **Reports** tab; the job reports window; Projects' day window; the person review | `list_reports_with_job_info` | the function's clause |
| A job's reports in its window and ledger views | `list_reports_for_job_ledger` | the function's clause |
| A bid's field reports on the Bid Board | `list_reports_for_bid` | the function's clause |
| Settings, **My reports** | `list_my_reports` | their own reports, untouched |
| The report edit window, the New report form's last answers, the customer timeline, the job summary, the charges timeline, the Bridge's reads, Your record | `reports` directly | `primary_scope_reports` |
| The newest percent on a job | `list_latest_report_completion_pct` (invoker), `list_job_crew_position` | the policy; the function's clause |
| Job thread counts and the job's activity feed | `jobs_ledger_thread_note_stats`, `list_my_accessible_job_activity_events` (invoker) | the policy |
| The realtime feed that refreshes the card | `reports` in `supabase_realtime` | the policy |
| A report's photos and their count | `report_photos` directly | `primary_scope_report_photos` |
| A photo still waiting in the bucket | a signed link on `report-photos` | the bucket's read policy |
| Unread and done marks | `report_reads` | the caller's own rows; a mark on a report they no longer read counts nowhere |
| Push on a new report | `user_report_notification_preferences` | its policy lets only dev, master, assistant and controller keep a preference |
| Field report emails and the digest | `report_email_subscriptions`, `recurring_job_report_schedule_recipients` | the office picks the recipients, and a primary cannot (`can_manage_report_email_subscriptions`); not filtered by this migration, and filtered per recipient since [`20261119060000`](./20261119060000_primary_reports_named_user.md) |

## What it leaves alone

- **Writing.** `insert_report`, the insert policy and the New-report job picker (`search_jobs_for_reports`) are as they were: a primary still writes a report on any job, and reads it back because they wrote it.
- **The two dashboard job lists' last-report time** (`list_assigned_jobs_for_dashboard`, `list_ready_to_bill_assigned_jobs_for_dashboard`): a time on a job the caller is on the crew of, not a report.
- **The office-only and superintendent-only reads** (`get_crew_day_payload`, `list_project_board`, `list_superintendent_jobs_for_dashboard`, `get_supervised_days_payload`): none admits a primary.
- **The email streams.** On 2026-11-19 prod had one field-report subscription and two digest recipients, all the same master, and no primary. A primary the office subscribes later would be sent every report in that stream's scope, until [`20261119060000`](./20261119060000_primary_reports_named_user.md) and the functions that ask it are live.
- **Job-level doors that pass a primary on the role alone** and are not reports: `can_report_stage_progress` (stage photos, the `job-photos` function's Drive list), `list_job_crew_position`'s crew and sheet columns, `job_test_reports` (`can_reach_job_for_test_report`).

## The calls made here, for the owner to confirm

1. **A primary still reads a report they wrote, on any job.** The sentence does not say. Without it a primary could not save a report on a job that is not theirs (the save reads the new row back), and Settings' My reports is their own list.
2. **A report on a bid with no job** opens to the bid's own primary, the scope their bids already have. Read strictly, the sentence names jobs only and would hide these.
3. **A report on a project with no job** opens to the project's listed superintendent.
4. **Listed superintendent** is the project's list or the GC project's named one. Both pickers offer people whose role is superintendent, so on 2026-11-19 no primary is listed anywhere and this leg opens nothing yet.

## The bed

`npm run test:pg:primary-scope-reports` (`scripts/pgtest-primary-scope-reports.sh`, `supabase/tests/primary_scope_reports/20_scenario.sql`, in `scripts/sql-beds.txt`). The whole schema, the migration applied twice, then: a primary who is the account manager of one job, listed on a second job's project and named on a third's GC project reads those three jobs' reports, his own report on a fourth, the listing project's report and his bid's report, and no other, through the table, the three list functions, both percent reads, the photos and the bucket. He cannot change or delete a report he cannot read, and he writes one on a job that is not his and reads it back. A primary on nothing reads none. The master, the assistant, the superintendent and the helper read as before.

## Verify

Read-only on prod after the push, as the dev:

```sql
select polname, polpermissive from pg_policy where polname in ('primary_scope_reports', 'primary_scope_report_photos');
select p.oid::regprocedure, p.proacl from pg_proc p where p.proname in ('primary_can_read_report', 'primary_can_read_job_reports');
```

Two restrictive policies, and two functions with `authenticated` and `service_role` and no `anon`. Then open the Dashboard with View as, Sample primary: the Recent Reports card lists none, since the sample account is on no job.

**Applied** to prod by 2026-11-20: the dev seat's `check_migration_ledger` read 1,410 versions applied against 1,410 local files, this version among them (read in the docs pass after #8832); types regenerated in #8913.
