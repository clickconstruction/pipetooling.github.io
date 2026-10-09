---
name: "Crew P&L: wheels and the $50 default"
number: 1
group: ready
status: PR 3 approved by the owner 2026-10-09 (the decisions sitting); not started
summary: >
  Vehicle rates on Crew P&L and Bids; the $50 sub-equivalent default; the backlog lines still
  true.
next: Build Wheels PR 3 — the vehicle deal priced on Bids and Crew P&L, wear in the truck rate — from the plan below.
size: S + S
blocker: None.
ver: from v2.2735
opinion: build — the owner said yes on 2026-10-09; the $50 default stands until vehicle records exist.
---

# Crew P&L: vehicle rates, the $50 sub-equivalent, and the backlog that is still true

## The ask

Wheels on Labor (v2.2733 / v2.2735) priced each person's vehicle deal per field hour on **Review**. The proposal's optional PR 3 was Bids and Crew P&L picking up the same rates, plus wear in the truck rate. Crew P&L's own backlog (2026-08-02) also listed six weaknesses.

## Validation 2026-09-06, re-checked 2026-09-29 (what is still true; v2.2912 added loose person-name matching, not sheet job-number linking; nothing since has touched `crewPnlSummary.ts` or the tab)

| Backlog item | State |
|---|---|
| 1. Wage name-join silently zeroes labor | **Resolved** — `src/lib/crewPnlSummary.ts` is person-keyed (people.id first, normalized name fallback). |
| 2. `revenue` is bid value, not cash | Design choice, not a to-do (documented). |
| 3. Sheet linking beyond trim/lower (e.g. "HCP " prefix) | Still exact-match; decide after reading the audit footer's raw job # texts. |
| 4. Employee cost is bare wage, subs are market price | Still true on Crew P&L; Review now carries the vehicle burden (Wheels) — **this is the PR 3 gap**. |
| 5. `DEFAULT_SUB_LABOR_EQUIVALENT_RATE = 50` is a manual literal | Still literal (`crewPnlSummary.ts`, `DEFAULT_SUB_LABOR_EQUIVALENT_RATE`); could track the field crew's real loaded average. |
| 6. Sub data rides the Jobs page's `laborJobs` loader | Still true (`Jobs.tsx` passes `laborJobs` into `JobsCrewPnlTab`); the audit footer dropping to $0 remains the tell. |

## The plan

1. **Wheels PR 3 (optional)**: Crew P&L labor cost gains the per-field-hour vehicle line from the same kernel Review uses; Bids labor estimate reads the same rate; add wear to the truck rate if the owner wants it.
2. Sub-equivalent rate: derive the default from the loaded field average (one kernel + a Settings readout), keep the box editable.
3. Sheet-linking normalization only after the audit texts are read.

## Where it plugs in

- `src/lib/crewPnlSummary.ts`, `src/components/jobs/JobsCrewPnlTab.tsx`, the Wheels kernel used by `PeopleReviewTab` (v2.2735; since v2.3955 its read lives in `src/lib/people/loadTeamReviewUnion.ts` via `loadWheelsSnapshot`, and v2.4104's `pickFuelTag` in `lib/banking/categoryTags.ts` is the fuel tag Wheels and the job's cost timeline share), `src/utils/teamLabor.ts` for the bids side.

## How to verify

- A week with a company-truck driver: Crew P&L labor for that person rises by the Wheels line exactly as Review shows it; the audit footer still reconciles.
