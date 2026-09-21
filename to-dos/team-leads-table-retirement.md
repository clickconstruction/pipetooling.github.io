---
name: "Team leads: drop the frozen table"
group: residual
status: residual of the Supervision train (v2.3611–v2.3616) · frozen since 2026-09-19 · not started
summary: >
  Supervision (v2.3611–v2.3616) retired the Team leads list from the UI: no screen writes
  `team_leader_assignments` or `team_leader_clock_notify_prefs` any more, and My Team's roster
  is read off the schedule and the clock. The rows that exist still feed `is_team_lead_for_member`
  in the `clock_sessions` policies, five RPCs (`approve_clock_sessions`, `revoke_clock_sessions`,
  `restore_rejected_clock_sessions`, `record_ncns_and_reject_sessions_for_day`,
  `can_edit_clock_sessions_for_user`), `is_team_lead_for_person_name` on four tables, the
  `notify-team-lead-clock` push, `send-report-email`'s team-lead scope and `list_report_email_team_leads()`.
  One mechanical release drops the two tables and every branch that reads them.
next: >
  After a quiet release: one migration that drops the `is_team_lead_for_member` /
  `is_team_lead_for_person_name` branches from the policies and RPCs, drops the two tables and
  both functions; cut `notify-team-lead-clock` down to its try-out branch (it pushes a trial
  helper's leaders since v2.3650 — do not delete it or its webhook) and retire the team-lead
  scope of report-email subscriptions (`REPORT_SUBSCRIPTIONS.md`); delete the guide lines that
  still mention the list.
size: S
blocker: A quiet release after v2.3616, so anyone who was approving through a leader link has moved to the pay-approved / office path.
mockup: not required — a table drop and a policy sweep — no screen changes
---

# Team leads: drop the frozen table

The Supervision train (`docs/recent-features/v2.3611.md` … `v2.3616.md`) replaced leader → member
links with one switch per helper and sub (`users.needs_supervision`) and reads who supervised whom
off `job_schedule_blocks` and `clock_sessions`. v2.3616 removed the last UI that wrote the list.
What remains is data and the SQL that reads it, listed in the summary; nothing new is written.

## The sweep

1. Migration: recreate the `clock_sessions` select / update policies, `jobs_ledger`'s team-lead
   read, `attendance_incidents`, `salary_work_schedule_*`, `user_time_off`, and the four
   `is_team_lead_for_person_name` tables' policies without the branch; `CREATE OR REPLACE` the
   five RPCs without the `is_team_lead_for_member` check (pay-approved masters and the office keep
   theirs); drop `list_report_email_team_leads()`; drop `team_leader_clock_notify_prefs`, then
   `team_leader_assignments`, then the two functions. Merge-accounts' remap list loses the pair.
2. Edge: in `notify-team-lead-clock` remove only the opted-in leader flow (the
   `team_leader_assignments` / `team_leader_clock_notify_prefs` reads); **keep the function and its
   webhook** — since v2.3650 its try-out branch (`notifyTrialHelperLeads`) pushes whoever ran a
   trial helper's job, off `trial_helper_supervisors()`, not the list. Drop the team-lead branch from
   `send-report-email` / `recurringJobReportCore.ts` (`crew_filter = 'my_team'`).
3. Client: `reportEmailSubscriptions.ts`'s `leaderUserIds` mirror; `email-reports-to-people.md`
   and `see-your-email-schedule.md`; `PROJECT_DOCUMENTATION.md` §tables, `ACCESS_CONTROL.md`,
   `EDGE_FUNCTIONS.md`, `REPORT_SUBSCRIPTIONS.md`.
