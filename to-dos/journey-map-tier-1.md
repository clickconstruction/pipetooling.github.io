# Journey map: the Tier-1 drift list

Status: in progress across many PRs · the list itself lives in the PRIVATE repo `clickconstruction/pipetooling-journey-map` (drift sweep `_DRIFT-2`); it holds unfixed security findings and customer identifiers, so it is not copied here

## What this pointer is for

The journey-map Phase 4 PR train references Tier-1 row numbers in its fragments. This file maps the rows already closed in this repo so the next session knows what is left without opening the private corpus.

## Rows closed in PipeTooling (as of 2026-09-05)

| Row | Shipped as |
|---|---|
| #1 sign-in doors | v2.2837 |
| #2(a) / #2(b) one bill truth | v2.2839, v2.2846 |
| #3(a) banking row cap | v2.2841 |
| #4 / #4(b) superintendent scope | v2.2836, v2.2844 |
| #5(a) paid progress bill ≠ 100% | v2.2840 |
| #6(a) error classification | v2.2843 |
| #9 auto-create-job guard | v2.2838 |
| #11 GC "Sent it" counts | v2.2842 |
| #12 customer-portal visit | see fragment citing J21-F2 = J22-F2 |

## Still open here

- #5(b) provenance badge → [`job-summary-follow-ups.md`](./job-summary-follow-ups.md).
- #6(b) / #6(c) → [`error-message-follow-ups.md`](./error-message-follow-ups.md).
- Drift row #28 (role-literal sweep) → [`subs-residuals.md`](./subs-residuals.md).
- Every other row: read `_DRIFT-2` in the private repo.
