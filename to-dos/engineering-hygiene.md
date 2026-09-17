---
name: Decompose JobsStagesTab / BidsPricingTab
group: ready
status: "in progress · one branch per PR · shipped: region 5 v2.3530, Stages PRs 1–5 v2.3531–v2.3535, Pricing PR 1 v2.3546 · built + live-tested, opening in order behind the queue: Stages PRs 6–12 and Pricing PR 2, each on a stacked branch · JobsStagesTab 6,598 → 4,712 lines, JobsStagesUnifiedTable 1,291 → 442, BidsPricingTab 5,720 → 5,422 · stop after any PR and nothing is half-moved"
summary: Two decomposition trains — JobsStagesTab then BidsPricingTab — one map region per PR, each shippable on its own; the three mechanical sweeps already ran.
next: >
  Open Stages PRs 6–12 one at a time as each base merges (PR 8, the prop-bundle seam, only
  with no feature PR open on JobsStagesTab.tsx), and Pricing PR 2 (the margin-breakdown
  modal, built and stacked). The Stages map is then done except the optional
  renderStagesFieldAndBillingLines component; the Pricing train continues with the Labor Book
  and Price Book panels.
size: L
blocker: Collides with every feature PR on those files.
ver: inventory 09-06 · region 5 v2.3530 · Stages PRs 1–5 v2.3531–v2.3535 · Pricing PR 1 v2.3546 · the rest queued
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
| 1 | ~~Stage-A kernels~~ — **done v2.3531**: twelve named gates in `lib/jobs/stagesRoleGates.ts` (a matrix test pins every role), the section totals, the AR button name, `STAGES_SECTION_ELEMENT_ID`, `customerLinkHeuristics.ts` | tests; call sites swapped | lowest |
| 2 | ~~The ⋯ tools menu → `JobsStagesToolsMenu.tsx`~~ — **done v2.3532** (grouped props: filters / toggles / gates / doors; `open` controlled; six render tests) | ~370 | low |
| 3 | ~~The command bar → `JobsStagesCommandBar.tsx`~~ — **built, #3296**: the ⋯ menu as its child; one `stagesToolsFilters` object feeds the chips and the menu's selects; five render tests | ~350 | low |
| 4 | ~~Jump nav~~ — **done v2.3534**: the five cloned links are one data-driven `JobsStagesJumpStrip`; the alert chips had already retired (v2.2012); the ☰ section-tools menu remains for a later single-opener PR | ~115 | low |
| 5 | ~~The three small confirms~~ — **done v2.3535**: `StagesReadyForBillingConfirmModal`, `StagesSendBackSimpleConfirmModal`, `StagesCollectionsConfirmModal`; the writes stay in the tab as named handlers | ~65 | low |
| 6 | ~~The two send-back modals~~ — **built, `refactor/stages-send-back-modals`**: `StagesSendBackInvoiceModal`, `StagesSendBackJobModal`; `sendBackChecked` stays shared (quirk 12) | ~135 | low-med |
| 7 | ~~`planPartialInvoice` + `StagesCreatePartialInvoiceModal`~~ — **built, `refactor/stages-partial-invoice`**: the decision is a kernel in `lib/jobsStagesBoard.ts` (7 tests), the creator does only IO, the dialog is its own file | ~25 | med |
| 8 | ~~**Prop-bundle seam**~~ — **built, `refactor/stages-prop-bundle`**: the follow-ups deck's `shared` / `unifiedShared` lifted to tab scope and spread at the six sites, zero overrides, tables untouched. **Opens only with no feature PR on the file** | ~355 | med |
| 9 | ~~Row dedupe inside the tables~~ — **built, `refactor/stages-row-dedupe`**: the five icon buttons → `StagesRowActionButtons.tsx`, the thread row → `StagesExpandedThreadRow`; the assigned-edit dropdown the map named no longer existed | ~260 | low-med |
| 10 | ~~Split `JobsStagesUnifiedTable`~~ — **built, `refactor/stages-unified-rows`**: `StagesUnifiedJobRow` / `StagesUnifiedInvoiceRow` with one `StagesUnifiedRowContext`; keys in `lib/jobs/stagesUnifiedRowKey.ts` | 1,096 → 442 | med |
| 11 | ~~The ☰ section-tools menu~~ — **built, `refactor/stages-section-tools-menu`**: `JobsStagesSectionToolsMenu` owns its open flag; the tab keeps the fourteen doors | ~110 | low |
| 12 | ~~The dead `confirmJobStatusJob` modal~~ — **built, `refactor/stages-dead-confirm`**: deleted; nothing in `src/` ever set it (map quirk 5) | ~40 | lowest |

PRs 1–12 were built across two sittings on 2026-09-16, each live-tested on prod data before commit; they merge one at a time behind the queue. Stopping after any of them is safe.

Not in the train (the map's *What must STAY*): the imperative handle and everything it writes, the `stagesBoardLists` / `bankPaymentsModalBilledRows` memos, the search state and effects, the mode toggles, the section wiring itself, and the dead `confirmJobStatusJob` modal (its removal is a separate one-line cleanup, never part of a move).

## The Pricing train (`src/components/bids/BidsPricingTab.tsx`, 5,720 lines on 2026-09-16)

Order from [`docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`](../docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md) → *Recommended extraction order*, minus what already shipped (`bidTotalCostBreakdown`, `costEstimateAutosavePayload`, `laborBookMatch`, `BidsDirectCostsSection` — the Labor refresh train did those).

| PR | Region | Out of the file | Risk |
|---|---|---|---|
| 1 | ~~Stage-A kernels~~ — **done v2.3546**: `decoratePricingRows`, `resolvePricingEntry`, `filterBidsForPicker` (Pricing + Labor swapped), `lastZipInAddress` | tests | lowest |
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
