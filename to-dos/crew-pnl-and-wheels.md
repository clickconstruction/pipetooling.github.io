---
name: "Crew P&L: wheels and the $50 default"
number: 1
group: ready
status: Wheels PR 3 shipped v2.5039 (2026-10-09, the owner's call of that day); items 2 and 3 remain
summary: >
  The $50 sub-equivalent default and the backlog lines still true. The vehicle rates on Crew P&L and
  Bids shipped in v2.5039.
next: Item 2 (derive the $50 sub-equivalent from the loaded field average) waits until vehicle records exist; item 3 waits on the audit footer's raw job # texts.
size: S
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
| 4. Employee cost is bare wage, subs are market price | The vehicle part is closed: since v2.5039 Crew P&L carries the Vehicle column Review charges. Otherwise still bare wage (a burden multiplier stays a design choice). |
| 5. `DEFAULT_SUB_LABOR_EQUIVALENT_RATE = 50` is a manual literal | Still literal (`crewPnlSummary.ts`, `DEFAULT_SUB_LABOR_EQUIVALENT_RATE`); could track the field crew's real loaded average. |
| 6. Sub data rides the Jobs page's `laborJobs` loader | Still true (`Jobs.tsx` passes `laborJobs` into `JobsCrewPnlTab`); the audit footer dropping to $0 remains the tell. |

## The plan

1. **Wheels PR 3 — done in v2.5039.** Crew P&L's **Vehicle** column is Review's fixed rate × each person's field hours in the range (the office job left out); profit nets it. The Bids crew-rate card shows the trucks per field hour (`fleet_truck_rate_per_field_hour`), never added: the burden and the driving line carry the truck. The truck rate carries wear, the latest replacement value over five years. The $50 sub-equivalent default is untouched; it was never a vehicle fallback.
2. Sub-equivalent rate: derive the default from the loaded field average (one kernel + a Settings readout), keep the box editable.
3. Sheet-linking normalization only after the audit texts are read.

## Where it plugs in

- `src/lib/crewPnlSummary.ts`, `src/components/jobs/JobsCrewPnlTab.tsx`, the Wheels kernel used by `PeopleReviewTab` (v2.2735; since v2.3955 its read lives in `src/lib/people/loadTeamReviewUnion.ts` via `loadWheelsSnapshot`, and v2.4104's `pickFuelTag` in `lib/banking/categoryTags.ts` is the fuel tag Wheels and the job's cost timeline share), `src/utils/teamLabor.ts` for the bids side.

## How to verify

- A week with a company-truck driver: Crew P&L's Vehicle cell for that person equals Review's vehicle fixed part for the same field hours; the audit footer still reconciles. (v2.5039 pins this in `crewPnlSummary.test.ts` and `JobsCrewPnlTab.render.test.tsx`; the server read matched `fleetTruckRate` on a local Postgres.)
