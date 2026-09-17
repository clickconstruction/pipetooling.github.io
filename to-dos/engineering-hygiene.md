---
name: Decompose JobsStagesTab / BidsPricingTab
group: ready
status: "**the Stages train is complete** (region 5 v2.3530 + PRs 1–12, v2.3531–v2.3549, all on main) — JobsStagesTab 6,598 → 4,712 · the Pricing/Labor train is 3 PRs in (v2.3546, v2.3547, v2.3550) · **the three remaining steps were measured 2026-09-17**: P4 and P5 are a sitting each, L4 is two, and P2 is no longer a grid — it is the Workbench, 1,975 lines of JSX over 77 state values, a train of its own or left alone · BidsPricingTab 5,720 → 5,422, BidsLaborTab 2,155 → 1,940"
summary: Two decomposition trains — JobsStagesTab then BidsPricingTab — one map region per PR, each shippable on its own; the three mechanical sweeps already ran.
next: >
  Pricing/Labor, in order, each PR alone: (1) `BidsPriceBookDrawer` — P4, 254 lines, no
  writes in the JSX, S; (2) the three P5 forms as three files — 255 lines, the handlers stay,
  S; (3) L4 Stage A — one `laborTabCostSummaries.ts` kernel for the driving / travel string
  formulas the four IIFEs repeat, then Vehicle travel and Lodging as two components, S + S.
  (4) P2 only after a re-map into its nine blocks (the table in *Scoped 2026-09-17*) — a 5–7
  PR train, optional; the file reads ~4,900 lines without it. On the Stages map only the
  optional renderStagesFieldAndBillingLines component is left. The shared bid picker is a
  ~15-line sweep across fourteen tabs — a quiet-day mechanical sweep, not a train step.
size: S · S · S+S · (L, optional)
blocker: >
  None today — no open PR touches either tab and the three session cards that name them are
  all merged work (checked 2026-09-17). Re-check `gh pr list` before each cut; the Pricing
  steps collide with any feature PR on BidsPricingTab / BidsLaborTab.
ver: inventory 09-06 · Stages train complete v2.3530–v2.3549 · Pricing v2.3546, v2.3547, v2.3550
mockup: not required — a decomposition — no screen changes
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

## The Stages train — **COMPLETE 2026-09-17** (`JobsStagesTab.tsx` 6,598 → 4,712 lines)

Order and regions from [`docs/JOBS_STAGES_TAB_ARCHITECTURE.md`](../docs/JOBS_STAGES_TAB_ARCHITECTURE.md) → *Recommended extraction order*; the region dossiers there say what each piece touches, what stays in the tab, and which quirks to preserve. Region 5 (the three inline modals) shipped first as v2.3530 and set the pattern: Stage A (pure logic → `lib/*` + tests) inside the same PR, then the JSX move; the tab keeps every flag the imperative handle, the ⋯ menu or a table also writes.

| PR | Region | Lands | Out of the file | Risk |
|---|---|---|---|---|
| 0 | this plan | `to-dos/engineering-hygiene.md` | — | — |
| 1 | ~~Stage-A kernels~~ — **done v2.3531**: twelve named gates in `lib/jobs/stagesRoleGates.ts` (a matrix test pins every role), the section totals, the AR button name, `STAGES_SECTION_ELEMENT_ID`, `customerLinkHeuristics.ts` | tests; call sites swapped | lowest |
| 2 | ~~The ⋯ tools menu → `JobsStagesToolsMenu.tsx`~~ — **done v2.3532** (grouped props: filters / toggles / gates / doors; `open` controlled; six render tests) | ~370 | low |
| 3 | ~~The command bar → `JobsStagesCommandBar.tsx`~~ — **built, #3296**: the ⋯ menu as its child; one `stagesToolsFilters` object feeds the chips and the menu's selects; five render tests | ~350 | low |
| 4 | ~~Jump nav~~ — **done v2.3534**: the five cloned links are one data-driven `JobsStagesJumpStrip`; the alert chips had already retired (v2.2012); the ☰ section-tools menu remains for a later single-opener PR | ~115 | low |
| 5 | ~~The three small confirms~~ — **done v2.3535**: `StagesReadyForBillingConfirmModal`, `StagesSendBackSimpleConfirmModal`, `StagesCollectionsConfirmModal`; the writes stay in the tab as named handlers | ~65 | low |
| 6 | ~~The two send-back modals~~ — **done v2.3536**: `StagesSendBackInvoiceModal`, `StagesSendBackJobModal`; `sendBackChecked` stays shared (quirk 12) | ~135 | low-med |
| 7 | ~~`planPartialInvoice` + `StagesCreatePartialInvoiceModal`~~ — **done v2.3537**: the decision is a kernel in `lib/jobsStagesBoard.ts` (7 tests), the creator does only IO, the dialog is its own file | ~25 | med |
| 8 | ~~**Prop-bundle seam**~~ — **done v2.3538**: the follow-ups deck's `shared` / `unifiedShared` lifted to tab scope and spread at the six sites, zero overrides, tables untouched. **Opens only with no feature PR on the file** | ~355 | med |
| 9 | ~~Row dedupe inside the tables~~ — **done v2.3541**: the five icon buttons → `StagesRowActionButtons.tsx`, the thread row → `StagesExpandedThreadRow`; the assigned-edit dropdown the map named no longer existed | ~260 | low-med |
| 10 | ~~Split `JobsStagesUnifiedTable`~~ — **done v2.3548**: `StagesUnifiedJobRow` / `StagesUnifiedInvoiceRow` with one `StagesUnifiedRowContext`; keys in `lib/jobs/stagesUnifiedRowKey.ts` | 1,096 → 442 | med |
| 11 | ~~The ☰ section-tools menu~~ — **done v2.3549**: `JobsStagesSectionToolsMenu` owns its open flag; the tab keeps the fourteen doors | ~110 | low |
| 12 | ~~The dead `confirmJobStatusJob` modal~~ — **done v2.3545**: deleted; nothing in `src/` ever set it (map quirk 5) | ~40 | lowest |

PRs 1–12 were built across two sittings on 2026-09-16, each live-tested on prod data before commit; they merge one at a time behind the queue. Stopping after any of them is safe.

Not in the train (the map's *What must STAY*): the imperative handle and everything it writes, the `stagesBoardLists` / `bankPaymentsModalBilledRows` memos, the search state and effects, the mode toggles, the section wiring itself, and the dead `confirmJobStatusJob` modal (its removal is a separate one-line cleanup, never part of a move).

## The Pricing train (`src/components/bids/BidsPricingTab.tsx`, 5,720 lines on 2026-09-16)

Order from [`docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`](../docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md) → *Recommended extraction order*, minus what already shipped (`bidTotalCostBreakdown`, `costEstimateAutosavePayload`, `laborBookMatch`, `BidsDirectCostsSection` — the Labor refresh train did those).

| PR | Region | Out of the file | Risk |
|---|---|---|---|
| 1 | ~~Stage-A kernels~~ — **done v2.3546**: `decoratePricingRows`, `resolvePricingEntry`, `filterBidsForPicker` (Pricing + Labor swapped), `lastZipInAddress` | tests | lowest |
| 2 | `PricingMarginBreakdownModal` — the self-contained P3 payload | ~140 | lowest |
| 3 | Shared `BidClusterBidPicker` — re-measured 2026-09-16: the list, sort toggle and filter are already shared; what fourteen tabs repeat is ~15 lines. **Not a train step** — a quiet-day mechanical sweep from fresh main | ~15 per tab | low |
| 4 | ~~`BidsLaborBookPanel` (L6)~~ — **done v2.3550**: the panel + its two book dialogs; the add-missing-fixture modal stayed with the apply-hours flow | ~215 | med |
| 5 | `BidsPriceBookDrawer` (P4 alone — measured 2026-09-17, below). Keep `applyPendingBookOffer` in the tab; pass `panelVersionId` (it still exists, derived at line 993) as a prop | 254 | low-med |
| 6 | The three P5 forms — `PricingVersionFormModal`, `DeletePricingVersionModal`, `PricingEntryFormModal` — as three files in one PR; `savePricingVersion` / `confirmDeletePricingVersion` / `savePricingEntry` stay in the tab | 255 | low |
| 7 | L4 in two halves: Stage A `lib/bids/laborTabCostSummaries.ts` (the driving and travel string formulas, two functions + tests), then `BidsVehicleTravelBox` + `BidsLodgingBox` | 253 | med (18 props) |
| 8 | P2 — **not one step.** The block is the Workbench now (1,975 lines, 77 state values, 48 tab functions). Re-map into the nine blocks below first; then a train of its own, or leave it | 1,975 | high as one move |

## Scoped 2026-09-17 — the three remaining Pricing/Labor steps, measured on main at v2.3562

Method: for each region, its line span, the `useState` values and props its JSX reads, the functions above `return (` it calls, and the direct supabase calls inside the JSX (a node script over the two files; the same measure the Stages train used before each cut).

| Step | Span | Lines | State | Props | Functions from the tab | Writes in the JSX | Size |
|---|---|---|---|---|---|---|---|
| P4 `BidsPriceBookDrawer` | `wbBookDrawerOpen ? (() => {` 4619–4872 | 254 | 7 pairs — `wbBookDrawerOpen`, `priceBookSearchQuery`, `wbBooksExpanded`, `wbPriceDisplayMode`, `pendingBookOffer` + `applyingBookOffer`, `editingTemplateId` + `templateEntries`, `pricebookSwitchBusy` | 5 — the two version lists, `selectedPricingVersionId`, `defaultPriceBookTemplateId`, `bids` | 8 — the four P5 openers, `applyPendingBookOffer`, `selectPanelVersion`, `onSelectPriceBookTemplate`, `currentPriceBookTemplateId` | 0 | **S** — one sitting |
| P5 the three forms | 4873–4926 · 4971–5061 · 5062–5171 | 54 · 91 · 110 | 6 · 8 · 15, all form-local | 0 · 0 · 2 (`error`, `fixtureTypes`) | `savePricingVersion` / `closePricingVersionForm` / `openDeletePricingVersionModal` · `confirmDeletePricingVersion` · `savePricingEntry` / `deletePricingEntry` / `closePricingEntryForm` + `panelVersionId` | 0 — the writes are in the handlers, which stay | **S** — three files, one PR |
| L4 the cost-parameter boxes | 1492–1744 | 253 | 5 pairs — `vehicleTravelCollapsed`, `lodgingCollapsed`, `updatingBidDistance`, `bidDistanceUpdateSuccess`, `travelZip` + the lookup status / message | **18** — the seven string-input pairs plus `costEstimateDistanceInput`, `costEstimateLaborRows`, `selectedBidForCostEstimate`, `error`, `onEditBid` | 6 — `handleTravelPerDiemLookup`, `updateBidDistanceFromCostEstimate`, `bidTeamLabor`, `markCell`, `cellA11y`, `cellSaveStyle` | 0 in the JSX; the `bids` UPDATE and the `gsa-per-diem` call sit in the two handlers | **S + S** — Stage A first |
| P2 "the grid" | `{selectedBidForPricing && (` 2606–4580 | **1,975** | **77** | 22 | **48** | 0 | **L** — not a step; see below |

What the numbers say:

- **P4 and P5 are cheap and independent of each other.** The map's grouped props hold for P4 (`books` / `entries` / `offer` / `doors`), with three doors the dossier missed: `selectPanelVersion`, `onSelectPriceBookTemplate` and `currentPriceBookTemplateId`. One correction to the P4 dossier: `panelVersionId` **does** still exist — line 993, derived (`templatesMode ? editingTemplateId : selectedPricingVersionId`) — and it gates the entry form. It is not state; pass it down.
- **L4's cost is its props, not its lines.** Eighteen props for 253 lines, because the boxes edit seven engine strings in place. The Stage-A kernel is the half that pays: the driving formula (`trips = Σ hours ÷ hoursPerTrip`, `× rate × distance`, defaults 0.70 / 2.0) and the travel formula (`people × nights × (meals + hotel)`, people and nights rounded and floored at 0) each appear twice — collapsed summary and expanded body — as string-parsing IIFEs. One `lib/bids/laborTabCostSummaries.ts` with two functions and tests removes the duplication before the JSX moves; `bidCostCalc.ts`'s versions read the persisted row and stay (quirk 7). Then *Vehicle travel* and *Lodging & meals* as two components; *Bid labor recorded* is fifteen lines and stays in the tab.
- **P2 is not a grid any more.** The July map's ~960 lines was the price grid; since then the Workbench rounds (v2.2198–v2.2403), the bid flow strip (v2.3200), the frozen-price line, the RFQ chip and the composition strip (v2.3239) all landed inside the same `selectedBidForPricing &&` block. It is 1,975 lines of JSX reading 77 state values and 48 functions defined above `return`, with the Workbench's handlers (brush, solver, tour, scenarios, copy / fill) spread over lines 447–2534. A single `BidsPricingGrid` would take on the order of 150 props. Its blocks, in order, as the re-map for whoever picks it up:

  | Block | Span | Lines |
  |---|---|---|
  | card header, the bid flow strip (v2.3200), title, RFQ chip, Share ▾ | 2606–2779 | ~175 |
  | the "?" card + tour (v2.2376) | 2780–3057 | ~280 |
  | the price-option / version cards row (v2.2404) | 3058–3497 | ~440 |
  | stats + solver line, Apply / Discard (v2.2203) | 3500–3855 | ~355 |
  | *Sent … · today …* (frozen prices PR 2) | 3856–3873 | ~18 |
  | margin history | 3874–3992 | ~120 |
  | the grid rows proper (book matches → rows) | 3993–4379 | ~385 |
  | the profit bar + legend | 4380–4559 | ~180 |
  | the composition strip (v2.3239) | 4560–4580 | ~20 |

  The cheapest cuts, if it is ever worth it: the "?" card (reads `wbInfoOpen` and the version lists), the profit bar (its own state — `wbBarHover`, `wbBarTipLeft`, `wbBarPinnedId`, `wbLegendCollapsed`), and the brush as a `useMarginBrush` hook (six functions and four refs). Each is one PR. The grid rows proper is last and hardest: a row reads the drafts, the locks, the brush and the flash state together. **Recommendation:** leave P2 until P4, P5 and L4 have landed and the file reads ~4,900 lines; then decide whether the Workbench deserves its own train or stays as the tab's body — the map's *optional* stands.

Quiet check 2026-09-17: `gh pr list` shows no open PR touching either tab, and the three session cards that name them (`claude-labor-new-view`, `claude-price-matrix-train`, `feat-pricing-workbench-wendi-feedback`) are all merged work — the surface is clear for P4 today.

## Per-PR rules (the playbook's, restated so a cold session does not skip one)

- Cut from fresh `main`; `npm run claim` for the version; a `docs/recent-features/v2.NNNN.md` fragment + `src/content/releaseNotes/v2.NNNN.ts` note per PR; flip the region's status row in the map and record what stayed in the tab and why.
- Behavior-preserving only: no logic change, no quirk fixed, no rename. The map's *Preserve-quirks list* is the checklist; anything on it that looks wrong gets its own later PR.
- `npm run typecheck && npm run lint && npm test && node scripts/theme-tokenize.mjs --check src` green, then a live walk of the moved region in the running app on prod data before the commit.
- If a feature PR is open on the same file, wait for it or land first — the diff is disposable, the feature is not.
