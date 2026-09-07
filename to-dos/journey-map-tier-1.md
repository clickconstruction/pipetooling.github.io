# Journey map: the Tier-1 / Tier-2 drift list

Status: in progress across many PRs · the list itself lives in the PRIVATE repo `clickconstruction/pipetooling-journey-map` (drift sweep `_DRIFT-2`, Phase 4 ledger `docs/journeys/_PHASE4.md`); it holds unfixed security findings and customer identifiers, so it is not copied here

## What this pointer is for

The journey-map Phase 4 PR train references row numbers in its fragments. This file maps the rows already closed in this repo so the next session knows what is left without opening the private corpus.

## Tier-1 rows closed in PipeTooling (as of 2026-09-06)

| Row | Shipped as |
|---|---|
| #1 sign-in doors | v2.2837 |
| #2 one bill truth | v2.2839, v2.2846, v2.2862 (shared kernel + shadow beacon — see [`bill-truth-shadow-beacon.md`](./bill-truth-shadow-beacon.md)) |
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

- #5(c) shared earned-revenue kernel → [`job-summary-follow-ups.md`](./job-summary-follow-ups.md).
- J31-N4 primary steps branch — v2.2900 row 6 verified it **still open** (last `project_workflow_steps` SELECT policy is `20260817012110`).
- ~~`rls_refused{table, role}` telemetry~~ — built v2.3058 as a `ui_nav_clicks` beacon (control `rls_refused`, target `/<table>?op=<op>`) fired by every refused-update guard.
- Every other row: read `_DRIFT-2` in the private repo.
