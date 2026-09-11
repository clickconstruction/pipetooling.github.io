# Bids → Labor refresh — "Hours that learn"

Status: **in progress** · PR 1 shipped as v2.3276 (`claude/labor-new-view`, the New view beside Old) · PR 2 shipped as v2.3291 (`claude/labor-refresh-pr2-data`, the columns, the burden key, the direct-costs view) · designed 2026-09-11 · mock-up [`mockup.html`](./mockup.html) (published as the artifact *Hours That Learn*; v1 → "best we can do" → v2 → a second pass, both recorded in its §06).

Pairs with [`to-dos/burn-against-the-bid/`](../burn-against-the-bid/README.md): a job's budget is only as honest as the estimate that feeds it, and calibration (PR 5 here) needs that to-do's bid ↔ job link.

## The ask, in the owner's words

"If we're going to build this we need to also build a new version of the bids labor section." Then, on the mock-up: "This has potential. Currently we have a old new process. Help me build this as a new tab under the bids labor, leaving the current as an old tab."

## What the data said (prod, read-only, 2026-09-11)

- Labor rate blank on every won bid → labor $ reads $0 on all 33.
- B375 SPACEX: 26 count rows, every hour cell 0; rows are plan codes and footage (`WC 1&2`, `LAV2`, `WHA-500`, `ft of 3/4IN WATER 140.23`); the book keys on "Toilet"; Old's Apply matched primary names only.
- Books: "Default" 15 entries (guesses, never calibrated), "Robot Default" 17 entries with aliases (the only one that matches anything), "Bill" 3, "Bryan" / "default" empty.
- Real field hours exist on jobs that match won bids by value (J650 ATI 339 h on $33.5k; J523 549 h at 90 % of $123.6k; J804 131 h at 80 % of $32.6k) — unused by estimating.

## The decision (the reframe)

The estimate is **hours**; dollars are derived. The tab keeps its grid and changes what surrounds it: a rate that is never blank, matching that survives real count sheets, a **queue** instead of a scan (only unanswered rows ask; each answer teaches the book the alias and the hours), calibration from finished jobs (bid-level multiplier first, per-fixture only where the job mix supports it), and a sanity strip that judges the whole bid (revenue per field hour against finished-job history). Completeness is the same object the Burn budget reads after the win. Estimator time leaves the direct cost (bid labor is already in the overhead pool).

Assumptions made in the mock-up, not yet confirmed by the owner: a person costs the bid before pricing (~5 min); the labor rate is one company number from People with a per-bid override; footage rows carry labor per 100 ft; the Robot Default book becomes *the* book with human overrides.

## The plan (six PRs; each live before the next)

1. **New view beside Old — SHIPPED v2.3276.** Kernels `laborBookMatch.ts` (exact → alias → prefix; `laborRowSource`), `bidLaborSummary.ts` (strip + completeness), `laborView.ts`; `BidsLaborNewView` (head, queue with Save / Save & learn / Fill from the book, grid with source chips); `LaborViewPills`; Old untouched. No schema change.
2. **Data — SHIPPED v2.3291.** Migration `20260911161857_labor_rows_kind_unit_source.sql`: `labor_book_entries.unit` + `kind`; `cost_estimate_labor_rows.kind` (`fixture` | `task` | `sub`) + `unit` + `source` + `source_note`; `app_settings.labor_burden_factor_v1` (1.20, nothing reads it until PR 4); view `cost_estimate_direct_costs`. `laborRowMultiplier` is the one reading rule; `laborRowPatchFromMatch` the one write rule; the queue's Fixture · Task · Sub control and the entry form's Reads as / Hours are per selects are live. Deviation from the plan: the row got a `unit` column too (the hours math must be pure on the row); "learned from B375 by Wendi" carries the bid but not the person (no user name in the view — add `learnedBy` when calibration wants it).
3. **Extract the L2 autosave payload** to `costEstimateAutosavePayload.ts` (the "stuck Saving…" quirk dies), and `bidTotalCostBreakdown.ts` so Pricing, the CSV and the PDF read one total.
4. **Rate and other direct costs** — the crew-rate card (People's 90-day recorded field wage × burden, per-bid override), overhead per field hour tile from lens A (shown, not added), estimator time retired for recorded bid labor, one `DirectCostRowsSection` with a kind chip, driving from crew-days × distance.
5. **Calibration** — needs the bid ↔ job link (Burn to-do PR 1–2). `laborBookMultiplier.ts` (book predicted vs actual per linked finished job; the strip's "book runs ×1.18 light"), then `laborActualsByFixture.ts` (split by the book's own stage weights; excluded under 25 % done or 8 field days) + the entry drawer (evidence table, confidence count, Set / Keep, entry history). Verified on J650 / J523 / J804.
6. **Robot book as the book** — human books fold into Robot Default as overrides (migration with a conflict report); who may recalibrate (dev · master tech · estimators for their own overrides); retire Old the way Takeoffs will (`takeoffs-retire-old.md`).

## Where it plugs in

`src/components/bids/BidsLaborTab.tsx` (2,500 lines; regions L1–L6 in `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`, now L3b for the New view), `src/hooks/useBidPricingEngine.ts` (`loadCostEstimateData` → `loadCostEstimateLaborRowsAndSync`: rows are minted from count rows with hours from the applied book's names + aliases, else `fixture_labor_defaults`), `src/lib/bids/laborRowHours.ts`, `bidCostCalc.ts`, `bidDocuments/costEstimatePage.ts` (sub sheets). Tables: `cost_estimates`, `cost_estimate_labor_rows`, `labor_book_versions/entries` (`alias_names text[]`, `version_id`), `fixture_types`, `bids_count_rows` (`bid_id` + `bid_version_id`; count rows of an unversioned bid sit under `bid_version_id` of the base version — query by `bid_id`).

## How to verify

- Dev server `pipetooling-dev-5179`; headless Playwright from `node_modules/.scratch/`; dev-login `…/dev-login?as=1&to=<encoded>`; `/bids?tab=labor&bidId=<uuid>` opens a bid on Labor.
- **Safe prod bid: BP398 ZZ Test** (`a5a3a840-0a7b-4c67-8b59-3e95d0d80150`, 3 count rows: Toilets ×5, Kitchen sinks ×6, Shower/tub combos ×3, no book, no rate). Restore it afterwards (rows to 0, `labor_rate` null, `selected_labor_book_version_id` null). Never learn an alias into a real book from a test — only "Task · fixed hours" or an empty book.
- Gotchas: a fresh browser context is on Old (per-device pick) — click the New pill first; the queue rows' DOM id is `laborRowDomId(fixture)`; `bids` has no `status` (use `outcome`); `labor_book_entries.version_id`, not `labor_book_version_id`.
