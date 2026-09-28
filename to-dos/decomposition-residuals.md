---
name: "Decomposition residuals: the Workbench block"
number: 21
group: residual
status: the two trains closed 2026-09-17 (Stages v2.3530–v2.3549; Pricing/Labor v2.3546, v2.3547, v2.3550, v2.3563, v2.3564, v2.3565) · the picker sweep shipped v2.4034 · what is left is by decision, not by shortfall
summary: >
  What the two decomposition trains left on purpose: the Pricing tab's Workbench block (P2 —
  1,975 lines over 77 state values, re-mapped into nine blocks in the architecture map, not
  worth cutting until a Workbench feature train needs a smaller file), the L4 box components (18
  props for 253 lines — the formulas were the duplication and they are one kernel now), and the
  optional renderStagesFieldAndBillingLines component on the Stages map.
next: >
  Nothing scheduled. The Workbench cut starts as PR 1 of the next Workbench feature train, from
  the nine-block table in the map's P2 dossier.
size: L (Workbench, only inside a feature train)
blocker: None. Each is a judgment about value, recorded in the map.
ver: closed 09-17
opinion: drop — left by decision; the Workbench cut only pays inside a Workbench feature train.
mockup: not required — refactors — no screen changes
---

# Decomposition residuals

The two trains in the old `engineering-hygiene.md` to-do are complete — `JobsStagesTab.tsx` 6,598 → 4,712 lines (v2.3530–v2.3549), `BidsPricingTab.tsx` 5,720 → 5,008 and `BidsLaborTab.tsx` 2,155 → 1,928 (v2.3546–v2.3565). The release notes and `docs/recent-features/` carry the record; [`docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`](../docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md) and [`docs/JOBS_STAGES_TAB_ARCHITECTURE.md`](../docs/JOBS_STAGES_TAB_ARCHITECTURE.md) carry the per-region status. This file holds only what was left **on purpose**.

## The Workbench block (P2) — not until a feature train needs it

Measured 2026-09-17: the `selectedBidForPricing &&` block is 1,975 lines of JSX reading 77 state values, 22 props and 48 functions defined above `return`, with the Workbench's handlers (brush, solver, tour, scenarios, copy / fill) spread over ~2,000 lines. A single `BidsPricingGrid` would take on the order of 150 props. The nine blocks with their spans are tabled in the map's P2 dossier. Two of the cheap cuts have since shipped from the queue (#46 row 1): the "?" card (v2.3980) and the profit bar (v2.3990); the brush as a `useMarginBrush` hook is the map's step 8. **Decision:** leave it. The value appears only when the Workbench gets another feature train — then that train's first PR does the cut it needs, from the table.

## The L4 box components — not built, by decision

The Vehicle Travel and Lodging and Meals boxes are 253 lines behind 18 props (seven engine string pairs edited in place). Their duplicated formulas were the real cost and are one kernel since v2.3565; a component would carry more surface than it removes.

## The Stages map's last optional item

`renderStagesFieldAndBillingLines` as its own component — optional on the map, nothing waits on it.
