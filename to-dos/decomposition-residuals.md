---
name: "Decomposition residuals: the Workbench block, the Workflow page's leftovers"
number: 21
group: residual
status: the two trains closed 2026-09-17 (Stages v2.3530–v2.3549; Pricing/Labor v2.3546, v2.3547, v2.3550, v2.3563, v2.3564, v2.3565) · the picker sweep shipped v2.4034 · the Workflow train (#46 row 9, v2.3907–v2.4081) closed 2026-09-28 with four leftovers added here · re-checked 2026-09-29: the queue card's roll-up is done (this sweep) · 2026-10-09: the contact modal moved v2.5094, the refused-delete message v2.5103, the error banner v2.5108 · the WorkflowStageCard is the one Workflow leftover still open · what is left is by decision, not by shortfall
summary: >
  What the two decomposition trains left on purpose: the Pricing tab's Workbench block (P2 —
  1,975 lines over 77 state values, re-mapped into nine blocks in the architecture map, not
  worth cutting until a Workbench feature train needs a smaller file), the L4 box components (18
  props for 253 lines — the formulas were the duplication and they are one kernel now), the
  optional renderStagesFieldAndBillingLines component on the Stages map, and the Workflow page
  train's separate WorkflowStageCard. The rest of the Workflow leftovers is done: the contact
  modal (v2.5094), the queue-card roll-up and two behaviour fixes (a refused projection delete
  says why, v2.5103; an action's error is a banner, not the whole page, v2.5108).
next: >
  Nothing scheduled. The Workbench cut starts as PR 1 of the next Workbench feature train, from
  the nine-block table in the map's P2 dossier. The WorkflowStageCard waits for a feature on the
  stage cards that needs a smaller file.
size: L (Workbench, only inside a feature train) · the WorkflowStageCard is sized by the card feature that asks for it
blocker: None. Each is a judgment about value, recorded in the map.
ver: closed 09-17
opinion: later — left by decision; each cut pays only when a feature needs a smaller file. The two Workflow behaviour fixes shipped (v2.5103, v2.5108).
mockup: not required — refactors — no screen changes
---

# Decomposition residuals

The two trains in the old `engineering-hygiene.md` to-do are complete — `JobsStagesTab.tsx` 6,598 → 4,712 lines (v2.3530–v2.3549), `BidsPricingTab.tsx` 5,720 → 5,008 and `BidsLaborTab.tsx` 2,155 → 1,928 (v2.3546–v2.3565). The release notes and `docs/recent-features/` carry the record; [`docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`](../docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md) and [`docs/JOBS_STAGES_TAB_ARCHITECTURE.md`](../docs/JOBS_STAGES_TAB_ARCHITECTURE.md) carry the per-region status. This file holds only what was left **on purpose**.

## The Workbench block (P2) — not until a feature train needs it

Measured 2026-09-17: the `selectedBidForPricing &&` block is 1,975 lines of JSX reading 77 state values, 22 props and 48 functions defined above `return`, with the Workbench's handlers (brush, solver, tour, scenarios, copy / fill) spread over ~2,000 lines. A single `BidsPricingGrid` would take on the order of 150 props. The nine blocks with their spans are tabled in the map's P2 dossier. Two of the cheap cuts have since shipped from the queue (#46 row 1): the "?" card (v2.3980) and the profit bar (v2.3990); the brush as a `useMarginBrush` hook is the map's step 8. **Decision:** leave it. The value appears only when the Workbench gets another feature train — then that train's first PR does the cut it needs, from the table.

## The L4 box components — not built, by decision

The Vehicle Travel and Lodging and Meals boxes are 253 lines behind 18 props (seven engine string pairs edited in place). Their duplicated formulas were the real cost and are one kernel since v2.3565; a component would carry more surface than it removes.

## The Workflow page's leftovers — optional (2026-09-28)

The Workflow page train (punch list #46 row 9, v2.3907–v2.4081) took `src/pages/Workflow.tsx` from 4,354 to 1,010 lines and closed all ten steps of [`docs/WORKFLOW_PAGE_ARCHITECTURE.md`](../docs/WORKFLOW_PAGE_ARCHITECTURE.md). What it left, on purpose:

- **A separate `WorkflowStageCard`** — optional. The stage list (`src/components/workflow/WorkflowStagesList.tsx`, 1,193 lines) holds every card inline. The card body reads the list's rail helpers (`railRow`, `renderMoneyMarker`, `moneyFlow`, `showLedgerRail`) and its open-section state, so a card component would take most of the list's props again. Worth cutting when a feature on the cards needs a smaller file; the map's "Stage cards list" dossier says so.
- ~~**The contact modal**~~ — done v2.5094: the person-contact window (name, email, phone) is `src/components/workflow/PersonContactModal.tsx`, moved verbatim with a render smoke; the page keeps only its open state.
- ~~**The queue card's roll-up**~~ — done 2026-09-29: the punch-list sweep rolled row 9's versions (and rows 1, 2, 5, 8 and 10's) into [#46](./decomposition-queue.md)'s `status` and `ver` lines.
- ~~**Two behaviours the move pinned but did not change**~~ — both fixed 2026-10-09, each its own PR (a move never changes behaviour):
  - ~~*A refused projection delete says nothing.*~~ — done v2.5103: `deleteProjection` hands a refused delete to `onError` in the kernel's words (`projectionWriteError`, `src/lib/workflow/projectionEdit.ts`), and `useWorkflowProjections.render.test.tsx` now pins the message. The map's quirk 24.
  - ~~*Any error blanks the whole page.*~~ — done v2.5108. The steps engine now keeps two errors. `loadError` is a load that leaves nothing to draw: the first project, workflow or steps read, the workflow create, and a subcontractor with no step here. It still replaces the page. Everything else is `error`, which shows in `WorkflowErrorBanner` above the page, pinned as it scrolls, with Dismiss. That covers a refused write, a failed line-item or projection read, and a failed re-read once the steps are drawn: the refresh after a write keeps the last steps. The map's quirk 21.
