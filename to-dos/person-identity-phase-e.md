# Person identity, Phase E: enforce (gated)

Status: gated — do not start before a quarter with zero name-fallback hits worth keeping · plan: [`docs/PERSON_IDENTITY_PLAN.md`](../docs/PERSON_IDENTITY_PLAN.md) → Phase E; [`docs/FRAGILITY_REMEDIATION_PLAN.md`](../docs/FRAGILITY_REMEDIATION_PLAN.md) C2/C3

## Where it stands (validated 2026-09-05)

- Phases A–D done (v2.1008–v2.1735). FKs exist on all ten pay tables; `person_contract_documents` already carries `person_id` (C2's column is in `src/types/database.ts`).
- The two "known remaining sub-sheet reader gaps" from v2.1732 are **closed**: `derivePersonTeamSummary.ts` uses `laborJobShareForPerson` (multi-assignee shares), and `subLaborOutstanding.ts` groups by junction `people.id` under the current roster name.
- Remaining client-side name filters listed in the v2.1733 entry (Workflow loadSteps sub filter, Calendar loadAssignedSteps, `previewJobModalStages.ts`, People loadPersonProjects grouping, `update_step_notes` self-match, Forecast stage modal free-text assignee) are low value now that RLS is id-first.

## What Phase E is

1. `NOT NULL` on `person_id` only where writers guarantee resolution (today unsafe: unresolvable names must degrade, not error).
2. Re-PK `people_pay_config` (and friends) off `person_name` so `onConflict` can flip.
3. Retire `cascadePersonNameInPayTables` — only after no reader joins by name.

## How to decide it is time

Grep the fallback branches for a hit counter (or add one) and watch a quarter. If the name fallback never fires, ship E in three migrations, one per step.
