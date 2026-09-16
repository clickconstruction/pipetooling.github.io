---
name: Decompose JobsStagesTab / BidsPricingTab
group: ready
status: "in progress · branch refactor/stages-* (one per PR) · region 5 shipped v2.3530, 6,598 → 6,325 lines · the train below is the order; stop after any PR and nothing is half-moved"
summary: Two decomposition trains — JobsStagesTab then BidsPricingTab — one map region per PR, each shippable on its own; the three mechanical sweeps already ran.
next: >
  PR 1 of the Stages train: the Stage-A kernels (role gates, section exposure totals, the AR
  button name, the section-id map, the customer-link heuristic) — tests only, no JSX moves.
  Then PRs 2–9 in order; then the Pricing train.
size: L
blocker: Collides with every feature PR on those files.
ver: inventory 09-06 · region 5 v2.3530 · train written 09-16
---

# Engineering hygiene: the decomposition inventory has regrown, plus three mechanical sweeps

## The inventory is stale (measured 2026-09-06, non-test files)

| File | Playbook says | Now |
|---|---|---|
| `src/pages/Estimates.tsx` | 5,365 | 6,906 |
| `src/components/jobs/JobsStagesTab.tsx` | 3,664 | 6,083 |
| `src/components/bids/BidsPricingTab.tsx` | 2,610 | 5,504 |
| `src/components/jobs/JobFormModal.tsx` | 4,096 | 4,824 |
| `src/pages/People.tsx` | 4,313 | 4,703 |
| `src/pages/Bids.tsx` | 3,791 | 4,613 |
| `src/pages/Workflow.tsx` | ~4,800 | 4,346 |
| `src/components/people/PeopleReviewTab.tsx` | 5,009 | 4,184 |
| `src/pages/Checklist.tsx` | ~3,500 | 3,809 (Roadmap became its own page, v2.2916) |
| `src/components/jobs/SendRecordInvoiceModal.tsx` | (not listed) | 3,513 |
| `src/components/bids/BidsTakeoffTab.tsx` | ~5,800 | 2,866 (came off the list) |
| `src/pages/Materials.tsx` | ~6,900 | 2,187 (came off the list) |

The playbook's method still applies; the numbers, the "largest files" headline in `docs/AI_CONTEXT.md`, and the "next tab" pointers do not. `Estimates.tsx` and `JobsStagesTab.tsx` are the two first candidates; `BidsPricingTab` doubled during the RFQ / Workbench trains.

## Two mechanical sweeps noted and never run

- ~~**Silent no-op `from('bids').update(...)` siblings**~~ — done v2.3058: measured 38 sites, 32 already guarded; the six that were not now are, and every guard reports through `src/lib/refusedWrite.ts` (`rls_refused` beacon).
- ~~**Same exposure on the takeoff tables**~~ — done v2.3058: both `bids_takeoff_rough_part_lines` updates guarded with a "takeoff line" message; `bids_takeoff_template_mappings` has no UPDATE site.

- ~~**`toLocaleDateString('en-CA')` as a YYYY-MM-DD source**~~ — done v2.3061: 119 sites in 41 files swept (`todayYmdInAppTz()` for today, `localCalendarDayKey(d)` for a device-local Date), guard rule 5 in `check-app-calendar-tz.mjs` keeps it out.

Mechanical sweeps merge alone (CLAUDE.md): cut from fresh main, merge before the next feature PR on those surfaces.

## The plan

1. ~~Refresh the inventory table and the AI_CONTEXT headline~~ (done: AI_CONTEXT v2.2956, playbook table v2.2961).
2. ~~Run the three sweeps as one script-driven PR each~~ (done v2.3058 / v2.3061, above).
3. **The Stages train**, then **the Pricing train** — below. Each PR is one region of the file's map, behavior-preserving, independently shippable, and cut from fresh `main` after the previous one merges. Stopping after any PR leaves nothing half-moved.

## The Stages train (`src/components/jobs/JobsStagesTab.tsx`, 6,325 lines on 2026-09-16)

Order and regions from [`docs/JOBS_STAGES_TAB_ARCHITECTURE.md`](../docs/JOBS_STAGES_TAB_ARCHITECTURE.md) → *Recommended extraction order*; the region dossiers there say what each piece touches, what stays in the tab, and which quirks to preserve. Region 5 (the three inline modals) shipped first as v2.3530 and set the pattern: Stage A (pure logic → `lib/*` + tests) inside the same PR, then the JSX move; the tab keeps every flag the imperative handle, the ⋯ menu or a table also writes.

| PR | Region | Lands | Out of the file | Risk |
|---|---|---|---|---|
| 0 | this plan | `to-dos/engineering-hygiene.md` | — | — |
| 1 | Stage-A kernels: the five role gates → `lib/jobs/stagesRoleGates.ts` (keep the RLS-mirroring comments with each gate); the section exposure totals → `lib/jobsStagesBoard.ts`; the AR button accessible-name composer; `stagesSectionElementId(key)`; `customerListImpliesLinkedRow` → `lib/jobs/customerLinkHeuristics.ts` | tests; call sites swap to the kernels | lowest |
| 2 | Toolbar + ⋯ tools menu → `JobsStagesToolbar.tsx` | ~215 | low |
| 3 | Jump nav + alert chips + their three already-extracted modals → `JobsStagesJumpNavAndAlerts.tsx` | ~250 | low |
| 4 | The three small confirms: Ready-to-Bill double checkbox, simple send-back, Collections to/from → `StagesReadyForBillingConfirmModal`, `StagesSendBackSimpleConfirmModal`, `StagesCollectionsConfirmModal` | ~200 | low |
| 5 | The two send-back modals → `StagesSendBackJobModal`, `StagesSendBackInvoiceModal`; `sendBackChecked` and the invoice re-entry lock stay in the tab (quirk 12) | ~250 | low-med |
| 6 | `planPartialInvoice(job, amount)` kernel (clamp → adjust → full-remaining-RTB ⇒ Bill Customer vs INSERT), then `StagesCreatePartialInvoiceModal`; the tab's only direct write stays in the modal, page-global `error` stays injected (quirk 4) | ~160 | med |
| 7 | **Prop-bundle seam**: one `stagesTableShared` object (superset of `StagesRowRenderContext`) built once, passed to both tables; the six ~50-prop call sites shrink to their per-section props. Wide, mechanical — **lands alone, with no feature PR open on Pipeline** | ~650 | med |
| 8 | Row dedupe inside the tables: `StagesAssignedEditCell`, `StagesRowActionIcons`, `StagesExpandedThreadRow` (the thread panel is pasted three times; quirk 15 allows the dedupe as its own diff-reviewable PR) | ~300 | low-med |
| 9 | Split `JobsStagesUnifiedTable` into `StagesUnifiedJobRow` / `StagesUnifiedInvoiceRow`; componentize `renderStagesFieldAndBillingLines` in `jobsStagesRowShared.tsx` | reshapes 1,291 | med |

PRs 1–6 are a sitting or less each. PR 7 is scheduled by the calendar, not the queue. PRs 8–9 are optional polish; stopping after 6 is a good stopping point.

Not in the train (the map's *What must STAY*): the imperative handle and everything it writes, the `stagesBoardLists` / `bankPaymentsModalBilledRows` memos, the search state and effects, the mode toggles, the section wiring itself, and the dead `confirmJobStatusJob` modal (its removal is a separate one-line cleanup, never part of a move).

## The Pricing train (`src/components/bids/BidsPricingTab.tsx`, 5,720 lines on 2026-09-16)

Order from [`docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`](../docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md) → *Recommended extraction order*, minus what already shipped (`bidTotalCostBreakdown`, `costEstimateAutosavePayload`, `laborBookMatch`, `BidsDirectCostsSection` — the Labor refresh train did those).

| PR | Region | Out of the file | Risk |
|---|---|---|---|
| 1 | Stage-A kernels: `decoratePricingRows` (the grid's row-decoration join + uncosted-revenue bucketing), `resolvePricingEntry`, `filterBidsForPicker`, `extractZipFromAddress` | tests | lowest |
| 2 | `PricingMarginBreakdownModal` — the self-contained P3 payload | ~140 | lowest |
| 3 | Shared `BidClusterBidPicker` (search + `MyBidsToggle` + table) — nine tabs carry the copy today | ~75 per tab | low |
| 4 | `BidsLaborBookPanel` (L6, in `BidsLaborTab`) | ~350 | med |
| 5 | `BidsPriceBookPanel` (P4 + P5). **Re-map first**: the map's `priceBookSectionOpen` no longer exists in the file (the v2.3458 reorder moved the price book row); confirm the panel's current state names before cutting | ~460 | med |
| 6 | The Labor parameter boxes (L4) after their string-input formulas are Stage-A'd | ~300 | med |
| 7 | `BidsPricingGrid` (P2) — last and optional; must keep consuming `pricingRowsForGrid` | ~960 | med |

## Per-PR rules (the playbook's, restated so a cold session does not skip one)

- Cut from fresh `main`; `npm run claim` for the version; a `docs/recent-features/v2.NNNN.md` fragment + `src/content/releaseNotes/v2.NNNN.ts` note per PR; flip the region's status row in the map and record what stayed in the tab and why.
- Behavior-preserving only: no logic change, no quirk fixed, no rename. The map's *Preserve-quirks list* is the checklist; anything on it that looks wrong gets its own later PR.
- `npm run typecheck && npm run lint && npm test && node scripts/theme-tokenize.mjs --check src` green, then a live walk of the moved region in the running app on prod data before the commit.
- If a feature PR is open on the same file, wait for it or land first — the diff is disposable, the feature is not.
