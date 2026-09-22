---
name: Person identity phase E
group: waiting
status: gated
summary: NOT NULL, re-PK off `person_name`, retire the name cascade — after a quiet quarter.
next: Revisit in December.
size: M
blocker: A quiet quarter.
ver: phases A–D done
opinion: later — a primary-key change on people in a busy quarter is risk without payoff; December as written.
mockup: not required — a schema change — no screen changes
---

# Person identity, Phase E: enforce (gated)

## Where it stands (validated 2026-09-05)

- Phases A–D done (v2.1008–v2.1735). FKs exist on all ten pay tables; `person_contract_documents` already carries `person_id` (C2's column is in `src/types/database.ts`).
- The two "known remaining sub-sheet reader gaps" from v2.1732 are **closed**: `derivePersonTeamSummary.ts` uses `laborJobShareForPerson` (multi-assignee shares), and `subLaborOutstanding.ts` groups by junction `people.id` under the current roster name.
- Remaining client-side name filters listed in the v2.1733 entry (Workflow loadSteps sub filter, Calendar loadAssignedSteps, `previewJobModalStages.ts`, People loadPersonProjects grouping, `update_step_notes` self-match, Forecast stage modal free-text assignee) are low value now that RLS is id-first.

- 2026-09-21: `to-dos/people-spine/` PR 4 (not started) plans the `person_id` backfill on
  `people_pay_config`, `people_hours` and `pay_stubs` plus a BEFORE INSERT OR UPDATE trigger that
  fills it from the name, and id-first readers — the writer guarantee that step 1 below needs.
  Revisit E once that PR is in; the two are not the same work (E is the NOT NULL, the re-PK and
  the cascade's retirement).

## What Phase E is

1. `NOT NULL` on `person_id` only where writers guarantee resolution (today unsafe: unresolvable names must degrade, not error).
2. Re-PK `people_pay_config` (and friends) off `person_name` so `onConflict` can flip.
3. Retire `cascadePersonNameInPayTables` — only after no reader joins by name.

## How to decide it is time

Grep the fallback branches for a hit counter (or add one) and watch a quarter. If the name fallback never fires, ship E in three migrations, one per step.
