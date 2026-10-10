# 20261010022000_drop_team_leader_list.sql (2026-10-09, v2.5088)

The Team leads list, dropped (punch list #26, the residual of the Supervision train v2.3611–v2.3616). Supervision replaced leader → member links with `users.needs_supervision` and reads who supervised whom off the schedule and the clock. Since v2.3616 no screen writes the list, but its rows still opened doors through `is_team_lead_for_member` and `is_team_lead_for_person_name`. This migration closes every such door, then drops the list.

## What it does

1. **Twelve functions** are rebuilt from prod's live bodies, less their team-lead check. Pay access, the office, devs and the person themselves keep theirs:
   - `approve_clock_sessions`, `revoke_clock_sessions`, `restore_rejected_clock_sessions`, `record_ncns_and_reject_sessions_for_day`, `can_edit_clock_sessions_for_user`;
   - `confirm_clock_typed_entry`, `recompute_people_hours_after_session_edit`, `pay_staff_clear_salary_schedule_by_person_name`, `jobs_ledger_row_visible_for_tally_assign`;
   - `merge_user_accounts` (its remap list loses the two tables);
   - `get_my_email_schedule` and `get_global_email_schedule`, which lose the report-email `team_leads` list.
2. **Nineteen policies on ten tables** lose the team-lead branch. `ALTER POLICY` keeps each name, command and role. The two policies that were only that branch are dropped: *Team leads can read jobs ledger for member clock sessions* (`jobs_ledger`) and *Team leads can delete people hours for members* (`people_hours`).
3. **The helpers go:** `is_team_lead_for_member`, `is_team_lead_for_person_name` and `list_report_email_team_leads()`.
4. **The digest's crew filter** keeps `'all_users'` only. `'my_team'` read the list. The check fails loudly, and widens nobody, if a `'my_team'` row appeared since the read below.
5. **Last, the tables:** `report_email_subscription_team_leads`, `team_leader_clock_notify_prefs` and `team_leader_assignments`. Their policies, fences, indexes and triggers go with them. So do `team_leader_assignments_dashboard_visibility_dev_only()` and `can_manage_team_leader_assignments()`, which only their own policies called.

`scripts/check-migrations.sh` gains guard 5: a migration versioned after this one must not name the list, its tables or its helpers outside a comment. A body copied from an older migration would otherwise bring a dropped name back.

## The prod read (2026-10-08, read-only)

The list was frozen before this drop:
- `team_leader_assignments`: 16 links, the newest created 2026-08-13. None was written since; the row versions are older than every clock session of 2026-09-17.
- `team_leader_clock_notify_prefs`: 0 rows.
- `report_email_subscription_team_leads`: 0 rows, so no report-email subscription had a lead scope.
- No digest recipient was on `'my_team'`.

## Checked

- **On a prod-schema bed.** The migration was applied twice to a bed made from a schema-only dump of prod, before the rebase below.
- **Rebased onto main at `20261010020000` (2026-10-09).** One pair of functions had changed under it. `20261009233000_gc_money_monday_email.sql` restated `get_my_email_schedule` and `get_global_email_schedule` to list the GC money Monday stream. Both are now that migration's bodies, less the team-lead parts. A three-way merge made them: the base was `20260915180000`, one side the team-lead removal, the other the GC addition. The two did not overlap. Their comments are restated without the team-lead scope. No other migration since the first build touches the twelve functions, the nineteen policies or the dropped objects.
- **On the SQL beds** (`sql-beds.yml`, every migration replayed on the Supabase image). The owner-billing bed used to re-apply its eight GC migrations after all the others. Re-applied after this drop, `20261009233000`'s email schedules named the dropped `report_email_subscription_team_leads` and failed. `scripts/pgtest-gc-owner-billing.sh` now runs each of the eight twice where it stands in the order. The second run still proves it changes nothing, and a later restatement keeps the last word.

## The lock note

Every statement holds its lock to commit, and the drops come last. The ACCESS EXCLUSIVE footprint, as measured on the bed:
- the ten policy tables: `attendance_incidents`, `clock_sessions`, `clock_typed_entries`, `jobs_ledger`, `people_crew_bids`, `people_crew_jobs`, `people_hours`, `salary_work_schedule_day_overrides`, `salary_work_schedule_templates` and `user_time_off`;
- `users` and `report_email_subscriptions`, while the dropped tables' foreign-key triggers go;
- `recurring_job_report_schedule_recipients`, while the crew filter's check is replaced;
- the three dropped tables.

`clock_sessions` and `people_hours` are written all day by the clock. **Push it in a quiet window, crews clocked out, lock_timeout 3s, retried.** If it stops at the timeout, nothing is applied, and the push runs again a few minutes later.

## Release order

CLAUDE.md's rule for the deploy tracks: "When a migration changes behavior the old client would misread, deploy the client first."

The seven edge functions follow the same logic and deploy **before** the push. The old functions read the tables or the `'my_team'` filter, and after the drop they would find "no leads" and log errors. Two changed directly, and five import the changed `_shared/recurringJobReportCore.ts`:

```bash
supabase functions deploy notify-team-lead-clock send-report-email recurring-job-report-dispatch recurring-job-report-preview recurring-job-report-test-send schedule-day-email-dispatch send-bid-pricing-package
```

`notify-team-lead-clock` stays deployed with its webhook. Since v2.3650 its try-out branch pushes a trial helper's leaders off `trial_helper_supervisors()`, not the list.

In order:
1. the client merges and GitHub Pages deploys it;
2. the seven functions deploy;
3. save the 16 links with the push's notes (`SELECT * FROM public.team_leader_assignments`), so a rollback can put them back;
4. `supabase db push`;
5. the verify steps below, `npm run check:migration-drift` and `npm run check:edge-drift`;
6. the types PR. `database.ts` loses the three tables and the dropped functions, and the dev-mcp catalog is rebuilt.

## Verify after the push

Each step is a read.

1. **The tables and helpers are gone.**
   - `SELECT to_regclass('public.team_leader_assignments'), to_regclass('public.team_leader_clock_notify_prefs'), to_regclass('public.report_email_subscription_team_leads');` gives three nulls.
   - `SELECT proname FROM pg_proc WHERE proname IN ('is_team_lead_for_member', 'is_team_lead_for_person_name', 'list_report_email_team_leads', 'can_manage_team_leader_assignments', 'team_leader_assignments_dashboard_visibility_dev_only');` gives no rows.
2. **No policy names them.** `SELECT tablename, policyname FROM pg_policies WHERE qual ILIKE '%team_lead%' OR with_check ILIKE '%team_lead%';` gives no rows.
3. **No function body names them.** `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prosrc ~ 'is_team_lead|team_leader_|report_email_subscription_team_leads';` gives no rows.
4. **The crew filter.** `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'recurring_job_report_schedule_recipients_crew_filter_check';` gives `CHECK ((crew_filter = 'all_users'::text))`.
5. **The email schedules.** As a dev, Settings → Email streams lists every stream, the GC money Monday requests among them. My email schedule opens for a digest recipient.

## Status

Applied on prod 2026-10-10 ~01:10 UTC by PUNCHLIST, in the window the owner opened by clocking every crew out (his word at 23:05 UTC). In the release order: #5183 merged ~01:05 UTC; the seven functions deployed first from the main checkout at `653c1c4a6` (notify-team-lead-clock, send-report-email, recurring-job-report-dispatch, recurring-job-report-preview, recurring-job-report-test-send, schedule-day-email-dispatch, send-bid-pricing-package), then submit-sub-portal and test-email for the shared file; then `supabase db push --linked --include-all` (the stamp sits below the applied 041000; the dry run listed this file alone); drift 842 local / 842 remote, fully applied; the types regen is #5243 and dev-mcp redeployed with its catalog. Verified read-only right after: the three tables read null; none of the five helpers exists; no policy and no function body names them; the crew filter reads `CHECK ((crew_filter = 'all_users'::text))`. Step 5 (Settings → Email streams and My email schedule as a dev) is the owner's look.

## Rollback

A one-off migration, and the seven functions' previous versions redeployed:
- re-create the three tables and their policies from `20250101000000_baseline.sql` and `20260915180000_report_email_subscription_team_leads.sql`, and the 16 links from the copy saved before the push;
- re-create the two helpers, `list_report_email_team_leads()` and the two dropped policies;
- restore the policies' team-lead branches and the twelve functions' previous bodies. For the two email schedules, that is `20261009233000`'s bodies.
- widen the crew filter's check back to `'all_users'` and `'my_team'`.
