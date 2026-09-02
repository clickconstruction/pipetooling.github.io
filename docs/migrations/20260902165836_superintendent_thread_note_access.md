# 20260902165836_superintendent_thread_note_access.sql (2026-09-02, v2.2647)

Superintendents can read and post `jobs_ledger_thread_notes` on jobs they
legitimately reach. The baseline policies' office branch evaluates its
team-member check inside an `EXISTS (… FROM jobs_ledger …)` subquery that runs
under the caller's RLS — superintendents have no `jobs_ledger` SELECT policy,
so the branch was always empty for them — and the field branch is role-gated
to helpers/subcontractor. A team-member superintendent therefore saw the
activity feed (RPC-fed) but every Post note / Arrived / Leaving insert failed
with an RLS violation.

Adds SECURITY DEFINER helper `superintendent_can_touch_job_thread(p_job_id)`
(role = superintendent AND (`superintendent_report_job_anchor_allowed` —
project access OR team member — OR dispatch schedule assignee)) and two
additive permissive policies (`…_superintendent_select`,
`…_superintendent_insert`, author-only on insert). Existing policies and the
restrictive fences (read-only, twin, primary scope) are untouched.

DB-only — no client change; apply order free. Ships with the v2.2647 PR.
