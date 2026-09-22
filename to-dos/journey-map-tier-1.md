---
name: "Journey map: J31-N4"
group: waiting
status: pointer
summary: Which drift rows are closed here (re-checked 2026-09-21); the list lives in the private repo.
next: Read _DRIFT-2 in the private repo first; the only Tier-1 remainder here is #5(c)'s board half (Job Summary's half shipped v2.3575).
size: S
blocker: Private repo context.
ver: tiers 1–4 mostly closed · J31-N4 v2.2920 · #5(c) half v2.3575
pointer: true
---

# Journey map: the Tier-1 / Tier-2 drift list

## What this pointer is for

The journey-map Phase 4 PR train references row numbers in its fragments. This file maps the rows already closed in this repo so the next session knows what is left without opening the private corpus.

## Tier-1 rows closed in PipeTooling (as of 2026-09-06; re-checked 2026-09-21)

| Row | Shipped as |
|---|---|
| #1 sign-in doors | v2.2837 |
| #2 one bill truth | v2.2839, v2.2846, v2.2862 (shared kernel + shadow beacon; the beacon and the legacy sums were removed in v2.3218 — the `bill-truth-shadow-beacon` to-do closed on the 2026-09-14 sweep) |
| #3(a) banking row cap · #3(c) whole-set paging | v2.2841 · v2.2870 |
| #4 / #4(b) / #7 superintendent + Job window role branch | v2.2836, v2.2844, v2.2900, v2.2920 |
| #5(a) paid progress bill ≠ 100% · #5(b) provenance badge | v2.2840 · v2.2852 |
| #6(a) error classification · #6(b)/(c) offline Retry + week-grid bid branch | v2.2843 · v2.2861 |
| #8 job from bid + birth row | v2.2859, v2.2904 |
| #9 auto-create-job guard | v2.2838 |
| #11 GC "Sent it" counts | v2.2842 |
| #12 customer-portal visit | see fragment citing J21-F2 = J22-F2 |
| #13 Moneyfill card charges → Banking | v2.2849 |
| #14(a)/(b)/(d) "opening is a write" family | v2.2851, v2.2850, v2.2885 |
| #15 payroll approvals | v2.2858 |

## Tier-2 / Tier-3 rows closed (2026-09-05 → 06)

Tier-2 #16–#19, #21–#23, #26–#29, #31–#35, #37–#46 shipped as v2.2856–v2.2926 (one fragment per row; grep `Tier-2 #N` in `docs/recent-features/`). Tier-3 papercut batches B1–B21 shipped as v2.2899–v2.2919. Tier-4 guide/doc audits: v2.2921–v2.2925.

## Still open here

- #5(c) shared earned-revenue kernel — the Job Summary half shipped v2.3575 (`earnedRevenueInWindow` on the Jobs view); the board's half and Crew P&L remain → [`job-summary-follow-ups.md`](./job-summary-follow-ups.md).
- ~~J31-N4 primary steps branch~~ — v2.2900 row 6 found it still open; closed the next day by the role sweep v2.2920 (`20260906010000_role_sweep_predicates.sql` re-created the `project_workflow_steps` SELECT policy with a `primary` branch: `can_access_project_via_step(id) OR step_assignee_matches_user(…)`). `/workflows` stays off `PRIMARY_PATHS` by decision.
- ~~`rls_refused{table, role}` telemetry~~ — built v2.3058 as a `ui_nav_clicks` beacon (control `rls_refused`, target `/<table>?op=<op>`) fired by every refused-update guard.
- Every other row: read `_DRIFT-2` in the private repo.
