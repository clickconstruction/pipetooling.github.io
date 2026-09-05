# Crew P&L: vehicle rates, the $50 sub-equivalent, and the backlog that is still true

Status: not started, owner-optional · sources: [`docs/CREW_PNL_DATA_FLOW.md`](../docs/CREW_PNL_DATA_FLOW.md) §5, fragment v2.2735 "Not in this PR"

## The ask

Wheels on Labor (v2.2733 / v2.2735) priced each person's vehicle deal per field hour on **Review**. The proposal's optional PR 3 was Bids and Crew P&L picking up the same rates, plus wear in the truck rate. Crew P&L's own backlog (2026-08-02) also listed six weaknesses.

## Validation 2026-09-05 (what is still true)

| Backlog item | State |
|---|---|
| 1. Wage name-join silently zeroes labor | **Resolved** — `src/lib/crewPnlSummary.ts` is person-keyed (people.id first, normalized name fallback). |
| 2. `revenue` is bid value, not cash | Design choice, not a to-do (documented). |
| 3. Sheet linking beyond trim/lower (e.g. "HCP " prefix) | Still exact-match; decide after reading the audit footer's raw job # texts. |
| 4. Employee cost is bare wage, subs are market price | Still true on Crew P&L; Review now carries the vehicle burden (Wheels) — **this is the PR 3 gap**. |
| 5. `DEFAULT_SUB_LABOR_EQUIVALENT_RATE = 50` is a manual literal | Still literal (`crewPnlSummary.ts:165`); could track the field crew's real loaded average. |
| 6. Sub data rides the Jobs page's `laborJobs` loader | Still true (`Jobs.tsx` passes `laborJobs` into `JobsCrewPnlTab`); the audit footer dropping to $0 remains the tell. |

## The plan

1. **Wheels PR 3 (optional)**: Crew P&L labor cost gains the per-field-hour vehicle line from the same kernel Review uses; Bids labor estimate reads the same rate; add wear to the truck rate if the owner wants it.
2. Sub-equivalent rate: derive the default from the loaded field average (one kernel + a Settings readout), keep the box editable.
3. Sheet-linking normalization only after the audit texts are read.

## Where it plugs in

- `src/lib/crewPnlSummary.ts`, `src/components/jobs/JobsCrewPnlTab.tsx`, the Wheels kernel used by `PeopleReviewTab` (v2.2735), `src/lib/teamLabor.ts` for the bids side.

## How to verify

- A week with a company-truck driver: Crew P&L labor for that person rises by the Wheels line exactly as Review shows it; the audit footer still reconciles.
