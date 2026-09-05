# Page Decomposition Playbook

---
file: docs/PAGE_DECOMPOSITION_PLAYBOOK.md
type: Engineering / Refactor Process
purpose: A repeatable, generic process for breaking a multi-thousand-line "God component" page into per-tab components + shared hooks + tested pure logic, without re-deriving the strategy each time. Generalizes the method proven on Bids.tsx (~18,800 → ~3,787 lines) and People.tsx (~21,435 → ~4,269).
audience: Developers, AI Agents
last_updated: 2026-08-02
---

## What this is

> The large-file inventory below is stale (measured 2026-09-05); refresh tracked in [`to-dos/engineering-hygiene.md`](../to-dos/engineering-hygiene.md).

The repo still has several God components (line counts at 2026-07-29, the date of the 20-map Step-0 sweep — v2.1089):

**Pages and page-scale surfaces:**

| File | Lines | Map | Notes |
|---|---|---|---|
| `src/pages/Materials.tsx` | ~2,120 | [`MATERIALS_TABS_ARCHITECTURE.md`](./MATERIALS_TABS_ARCHITECTURE.md) | **decomposition complete** (v2.1275–v2.1293, 12-PR train from 7,033 lines): all 6 tabs extracted, 3 seam hooks (`useMaterialsCatalog`/`useMaterialsAssemblies`/`useMaterialsPurchaseOrders`), Stage-A kernels in `lib/materials/*` + `lib/materialsDocuments/*` |
| `src/pages/Estimates.tsx` | 5,365 | [`ESTIMATES_TABS_ARCHITECTURE.md`](./ESTIMATES_TABS_ARCHITECTURE.md) | two page components behind a URL router; Stage-A-mature already |
| `src/pages/Workflow.tsx` | 4,782 | [`WORKFLOW_PAGE_ARCHITECTURE.md`](./WORKFLOW_PAGE_ARCHITECTURE.md) | region-based (not tabbed); StepFormModal is the first peel-off |
| `src/pages/People.tsx` | 4,313 | [`PEOPLE_TABS_ARCHITECTURE.md`](./PEOPLE_TABS_ARCHITECTURE.md) | decomposition essentially done |
| `src/pages/Bids.tsx` | 3,791 | [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md) | decomposition done |
| `src/pages/Prospects.tsx` (+ `TeamProspectsTab` 1,820) | 3,373 | [`PROSPECTS_TABS_ARCHITECTURE.md`](./PROSPECTS_TABS_ARCHITECTURE.md) | pointer + dual-cache substrate; Activity tab is a near-free first move |
| `src/pages/Banking.tsx` (+ 2 oversized extracted tabs) | 3,104 | [`BANKING_TABS_ARCHITECTURE.md`](./BANKING_TABS_ARCHITECTURE.md) | 5 of 7 Mercury tabs already out; in-file table components are the first move |
| `ScheduleDispatchHub` + `ScheduleDispatchHubPage` | 3,302 + 2,384 | [`SCHEDULE_DISPATCH_ARCHITECTURE.md`](./SCHEDULE_DISPATCH_ARCHITECTURE.md) | hot (churn 22/20); container/presentational split already in place |
| `src/pages/Checklist.tsx` (+ `ChecklistTechTreeTab` ~1,840 after v2.2156) | ~3,500 | [`CHECKLIST_TABS_ARCHITECTURE.md`](./CHECKLIST_TABS_ARCHITECTURE.md) | tabs are already in-file components — Stage B is mostly file moves; tech-tree sub-decomposition done v2.2156 |
| `src/pages/JobTally.tsx` | 2,330 | [`JOB_TALLY_ARCHITECTURE.md`](./JOB_TALLY_ARCHITECTURE.md) | two nearly independent tabs |
| `src/pages/Quickfill.tsx` (+ `QuickfillScheduleSection` 1,737) | 2,039 | [`QUICKFILL_ARCHITECTURE.md`](./QUICKFILL_ARCHITECTURE.md) | section bodies extracted; framework + schedule section remain |
| `src/pages/Jobs.tsx` | 2,020 | [`JOBS_TABS_ARCHITECTURE.md`](./JOBS_TABS_ARCHITECTURE.md) | decomposition essentially done (shrank from ~15k) |
| `src/pages/Settings.tsx` | 1,714 | [`SETTINGS_TABS_ARCHITECTURE.md`](./SETTINGS_TABS_ARCHITECTURE.md) | done (v2.853–859); follow-on: `SettingsDashboardTab` (1,985) |
| `src/pages/Dashboard.tsx` | 1,673 | [`DASHBOARD_SECTIONS_ARCHITECTURE.md`](./DASHBOARD_SECTIONS_ARCHITECTURE.md) | shrank from ~8.9k; remaining sections tracked there |

**Extracted tabs that regrew into God components:**

| File | Lines | Map | Notes |
|---|---|---|---|
| `src/components/bids/BidsTakeoffTab.tsx` | ~2,958 | [`BIDS_TAKEOFF_TAB_ARCHITECTURE.md`](./BIDS_TAKEOFF_TAB_ARCHITECTURE.md) | **decomposition underway** (T0–T7 done, v2.1294–v2.1306: kernels, row file move, book admin, materials summary, both small modals, authoring cluster); T8 catalog seam + exact / T9 rough remain — see the map's Decomposition log |
| `src/components/people/PeopleReviewTab.tsx` | 5,009 | [`PEOPLE_REVIEW_TAB_ARCHITECTURE.md`](./PEOPLE_REVIEW_TAB_ARCHITECTURE.md) | ~1,660-line popup HTML builder is a third of the file — Stage A first |
| `src/components/jobs/JobsStagesTab.tsx` (+ 3,100 lines of table/row sub-files) | 3,664 | [`JOBS_STAGES_TAB_ARCHITECTURE.md`](./JOBS_STAGES_TAB_ARCHITECTURE.md) | hot (churn 18); always-mounted contract is the hazard |
| `src/components/people/PeopleContractsTab.tsx` + `PeopleOverheadTab.tsx` | 2,981 + 2,038 | [`PEOPLE_CONTRACTS_OVERHEAD_TABS_ARCHITECTURE.md`](./PEOPLE_CONTRACTS_OVERHEAD_TABS_ARCHITECTURE.md) | Overhead's calc already in tested libs |
| `src/components/jobs/JobsJobSummaryTab.tsx` | 2,862 | [`JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md`](./JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md) | 100% presentational — pure JSX partition |
| `src/components/bids/BidsPricingTab.tsx` + `BidsLaborTab.tsx` | 2,610 + 2,365 | [`BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`](./BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md) | data lives in `useBidPricingEngine`; Labor's single autosave effect is the hazard |
| `src/components/bids/BidSubmissionFollowupTab.tsx` | 2,081 | [`BID_SUBMISSION_FOLLOWUP_TAB_ARCHITECTURE.md`](./BID_SUBMISSION_FOLLOWUP_TAB_ARCHITECTURE.md) | two inline jsPDF builders are the bulk — Stage A first |
| `src/components/projects/ProjectsForecastSpecificTab.tsx` (+ stage modal 1,465) | 2,326 | [`PROJECTS_FORECAST_TABS_ARCHITECTURE.md`](./PROJECTS_FORECAST_TABS_ARCHITECTURE.md) | low-churn; no extraction scheduled |

**Modals and standalone components:**

| File | Lines | Map | Notes |
|---|---|---|---|
| `src/components/jobs/JobFormModal.tsx` | 4,096 | [`JOB_FORM_MODAL_ARCHITECTURE.md`](./JOB_FORM_MODAL_ARCHITECTURE.md) | extraction underway — peaked at ~4,985 before shrinking back to ~4,096; highest churn in the repo (62 commits in 6 weeks) |
| `src/components/DashboardMyTimeDayEditorModal.tsx` | 3,948 | [`MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md`](./MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md) | 13 call sites; payroll-path save ladder moves verbatim behind Stage-A tests |
| `src/components/jobs/SendRecordInvoiceModal.tsx` | 3,286 | [`SEND_RECORD_INVOICE_MODAL_ARCHITECTURE.md`](./SEND_RECORD_INVOICE_MODAL_ARCHITECTURE.md) | hot (churn 22); Stage B waits for the bill-to train (v2.1084–1087) to settle |
| `src/components/DashboardTeamActiveClockStrip.tsx` + `ClockInOutButton.tsx` | 2,965 + 2,248 | [`CLOCK_SURFACES_ARCHITECTURE.md`](./CLOCK_SURFACES_ARCHITECTURE.md) | ~640 lines of closure-free pure helpers are the Stage-A opener |
| `src/components/jobs/JobsSubLaborFormModal.tsx` + `DetailJobModal.tsx` | 2,154 + 2,035 | [`JOBS_MODALS_ARCHITECTURE.md`](./JOBS_MODALS_ARCHITECTURE.md) | SubLabor's always-mounted state-persistence contract is pinned by a render test |

Each unfinished surface owns dozens-to-hundreds of `useState`s, loaders/handlers, and inline JSX. **As of the 2026-07-29 sweep, every surface ≥2,000 lines has its Step-0 architecture map** — start any extraction from the map, not from the source file.

This document is the **process** for shrinking one. The two reference implementations are:

- [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md) — the completed map (all 14 tabs extracted; `Bids.tsx` ~3,787 lines).
- [`PEOPLE_TABS_ARCHITECTURE.md`](./PEOPLE_TABS_ARCHITECTURE.md) — a near-complete map using the same method (`People.tsx` ~4,269 lines; only the Hours clock-strip wrapper left).

> **Read this before starting an extraction.** Then create (or update) a `docs/<PAGE>_TABS_ARCHITECTURE.md` map for the page you're working on, and work tab by tab.

---

## Core principles

1. **Two stages per unit of work, always in this order:**
   - **Stage A — Extract pure logic to `lib/*` + tests.** Move calculation, formatting, parsing, CSV/PDF/HTML builders, and any data-shaping that has *no React/JSX* into `src/lib/<domain>/*` (or `src/lib/<domain>Documents/*` for print/PDF). Add a `*.test.ts` next to each. This is safe, reviewable, and independently shippable.
   - **Stage B — Move the component.** Only after the pure logic is out, lift the tab's JSX + its tab-local state/effects/handlers into `src/components/<page>/<Page><Tab>Tab.tsx`. The parent renders a thin `<...Tab .../>` wrapper.

   Doing A before B keeps each Stage-B diff small (mostly a cut/paste move) and means the risky calc lives behind unit tests before any UI moves.

2. **Selection + URL state stays in the parent, passed down as controlled props.** The page owns "which record is selected" and the URL deep-link router. Each extracted tab receives `selectedX` + `onSelectX`/`onClose` as props — it does **not** own its own selection. This preserves cross-tab navigation and `?tab=…&id=…` deep links. (See [Bids: shared bid pointer](./BIDS_TABS_ARCHITECTURE.md#the-shared-bid-pointer).)

3. **Tab-local state moves with the tab; shared state stays and is injected.** If a piece of state/effect/handler is used by exactly one tab, it moves into that tab's component. If it's read or written by 2+ tabs (or by the URL router, or by a shared modal), it stays in the parent and is passed in as a prop/callback.

4. **For high-coupling tab clusters, build a shared hook seam first.** When several tabs share a data engine (e.g. counts → takeoffs → labor → pricing all read/write the same cache and loaders), extract that shared state + loaders + load-effects into a hook (`src/hooks/use<Page><Engine>.ts`) that returns one object the parent destructures. Then each tab in the cluster consumes the engine via props. This is the unlock that lets coupled tabs come out without rewiring everything. (See [Bids: pricing-engine shared layer](./BIDS_TABS_ARCHITECTURE.md#pricing-engine-shared-layer) → `useBidPricingEngine`.)

5. **Extract lowest-coupling tabs first; order by value ÷ risk.** Cheap, isolated tabs first to build momentum and validate the seam; the tightly-coupled cluster last, after its shared hook exists.

6. **Verify after every step.** `npm run typecheck && npm run lint && npm test` must stay green after each extraction (each tab is its own commit). Never batch multiple tab moves into one unverified change.

7. **Behavior-preserving only.** Decomposition is a move, not a redesign. Do not "improve" logic, rename DB columns, or change UX in the same pass. Preserve quirks (even hardcoded constants — note them) so the diff is reviewable as a pure refactor.

---

## The process, step by step

### Step 0 — Map the page (once per page)

Create `docs/<PAGE>_TABS_ARCHITECTURE.md` (copy the header + section shape from `BIDS_TABS_ARCHITECTURE.md`). For each tab, inventory:

- **Render location** (line range / `activeTab === '…'` gate).
- **Owned local state** — state used *only* by this tab (these move with it).
- **Cross-tab / shared state** — state read/written by 2+ tabs, the URL router, or shared modals (these stay in the parent).
- **Derived memos**, **handlers/functions**, **data dependencies**, **supabase tables**.
- **Sub-components** (already extracted vs inline).
- **External coupling** + an **extraction status + risk + suggested approach**.

Then write a **Master summary table** and a **Recommended extraction order** (value ÷ risk, lowest coupling first). Identify any **shared substrate**: the page's equivalent of Bids' `setSharedBid` selection pointer and/or its `useBidPricingEngine` data engine. Note when a page has *no* single shared pointer (e.g. People keys by `person_name` and gives each tab its own selection — so only *data* is shared, not a UI selection).

### Step 1 — Pick the next tab

Take the lowest-coupling not-yet-extracted tab from the order. If the next-best tab belongs to a high-coupling cluster and the shared hook doesn't exist yet, do **Step 2 (seam)** first.

### Step 2 (only for clusters) — Build the shared hook seam

Extract the cluster's shared state + refs + loaders + load-effects into `src/hooks/use<Page><Engine>.ts`. The parent passes the cluster's selections + page context (`activeTab`, role, `setError`, master loaders) as inputs and **destructures the returned object**, so existing downstream references are unchanged. Put shared types in `src/lib/<page>/<engine>Types.ts`. Leave UI-coupled effects (those that write parent-owned UI state) in the parent for now and revisit per tab.

### Step 3 (Stage A) — Pure logic → `lib/*` + tests

For the chosen tab, identify every pure function it uses inline (calc, format, parse, CSV/PDF/HTML builders, filtering/bucketing). Move each into `src/lib/<domain>/*` and add a colocated `*.test.ts`. Print/PDF builders go to `src/lib/<page>Documents/*` and take an explicit context object (no React, no parent closure). The parent/tab then calls the lib function. Verify green.

### Step 4 (Stage B) — Move the component

Create `src/components/<page>/<Page><Tab>Tab.tsx`. Move into it: the tab's JSX, its owned local state/effects/handlers/memos, and any tab-local sub-components or module-level sortable rows. The parent renders a thin wrapper and passes:

- **Controlled selection:** `selectedX`, `onSelectX`/`onClose`.
- **Shared engine values** (for cluster tabs): destructured from the hook.
- **Shared state read/written by others:** as props + setter callbacks.
- **Master loaders / cross-cutting callbacks:** `onEditX`, `loadX`, `onError`, modal openers.

What **stays in the parent:** the URL deep-link router + any `apply…DeepLink…` glue, shared modals opened from multiple tabs, and any state the router or a sibling tab also touches. Verify green.

### Step 5 — Update the map + commit

Flip the tab's Status to `extracted` in `docs/<PAGE>_TABS_ARCHITECTURE.md`, point it at the new file, and record what stayed in the parent and why. Commit per tab (or per Stage A / Stage B half) with a behavior-preserving message. Repeat from Step 1.

---

## What moves vs what stays — quick reference

| Concern | Moves into the tab component | Stays in the parent |
|---|---|---|
| State used by only this tab | ✅ | |
| State read/written by 2+ tabs | | ✅ (pass as prop + setter) |
| Selected-record pointer | | ✅ (controlled prop `selectedX` + `onSelectX`) |
| URL deep-link router / `apply…DeepLink…` | | ✅ |
| Tab-local effects (autosave, click-outside, reset-on-change) | ✅ | |
| Effects that write parent-owned UI state | | ✅ (revisit later) |
| Pure calc/format/parse/PDF/CSV | ✅→ extract to `lib/*` first (Stage A) | |
| Shared data engine (multi-tab cache + loaders) | | ✅ via `use<Page><Engine>` hook |
| Modal opened from 2+ tabs | | ✅ (page-level; open via callback) |
| Modal opened from only this tab | ✅ | |
| Master loaders (`loadX`, role, `authUser`) | | ✅ (pass down as needed) |

---

## Definition of done (per tab)

- [ ] Parent renders a thin `<...Tab .../>` wrapper; no tab-specific JSX left inline.
- [ ] Selection is a controlled prop; the tab owns no selection state.
- [ ] All pure logic the tab used lives in `lib/*` with at least one colocated test.
- [ ] `npm run typecheck && npm run lint && npm test` are green.
- [ ] No behavior/UX/schema change vs before (diff reads as a move).
- [ ] `docs/<PAGE>_TABS_ARCHITECTURE.md` updated: Status `extracted`, new file linked, "stays in parent" noted.

---

## Anti-patterns (don't do these)

- **Skipping Stage A.** Moving a tab with its calc still inline produces a huge, unreviewable Stage-B diff and ships untested logic into a new file.
- **Letting the tab own its selection.** Breaks cross-tab navigation and deep links. Selection is always a controlled prop.
- **Refactoring logic during the move.** Behavior-preserving only; redesign is a separate, later pass.
- **Extracting a coupled cluster tab before its shared hook exists.** You'll thread dozens of props by hand and likely duplicate the engine. Build the `use<Page><Engine>` seam first.
- **Batching multiple tab moves into one commit.** Keep each tab (and ideally each Stage) independently verifiable and revertible.
- **Pulling shared/router state into a child** because it's "convenient." If a sibling or the URL router also touches it, it stays in the parent.

---

## See also

- [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md) — completed reference (controlled selection, `useBidPricingEngine`, Stage-A `lib/bidDocuments/*` builders, recommended extraction order).
- [`PEOPLE_TABS_ARCHITECTURE.md`](./PEOPLE_TABS_ARCHITECTURE.md) — near-complete reference (no single shared pointer; phased hook extraction).
- `AGENTS.md` (repo root) — project-wide constraints (Supabase, RLS, types).
