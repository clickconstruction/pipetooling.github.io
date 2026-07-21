# Page Decomposition Playbook

---
file: docs/PAGE_DECOMPOSITION_PLAYBOOK.md
type: Engineering / Refactor Process
purpose: A repeatable, generic process for breaking a multi-thousand-line "God component" page into per-tab components + shared hooks + tested pure logic, without re-deriving the strategy each time. Generalizes the method proven on Bids.tsx (~18,800 → ~3,787 lines) and People.tsx (~21,435 → ~4,269).
audience: Developers, AI Agents
last_updated: 2026-07-20
---

## What this is

The repo still has several God components (line counts at 2026-07-20):

| File | Lines | Notes |
|---|---|---|
| `src/pages/Jobs.tsx` | 10,684 | map written ([`JOBS_TABS_ARCHITECTURE.md`](./JOBS_TABS_ARCHITECTURE.md), refreshed 2026-07-20 vs v2.819) — extraction can resume |
| `src/pages/Materials.tsx` | 6,935 | map written ([`MATERIALS_TABS_ARCHITECTURE.md`](./MATERIALS_TABS_ARCHITECTURE.md)) — low-churn, no extraction scheduled |
| `src/components/bids/BidsTakeoffTab.tsx` | 5,641 | already an extracted tab; kept growing — candidate for its own sub-decomposition |
| `src/pages/Estimates.tsx` | 5,332 | no map yet |
| `src/pages/Settings.tsx` | 5,171 | map written ([`SETTINGS_TABS_ARCHITECTURE.md`](./SETTINGS_TABS_ARCHITECTURE.md)) — extraction can resume |
| `src/components/people/PeopleReviewTab.tsx` | 5,007 | already an extracted tab |
| `src/pages/Workflow.tsx` | 4,782 | no map yet |
| `src/components/jobs/JobFormModal.tsx` | 4,342 | a modal, not a page — same method applies; shrank from ~7.1k via mapped extraction ([`JOB_FORM_MODAL_ARCHITECTURE.md`](./JOB_FORM_MODAL_ARCHITECTURE.md)) — extraction underway |
| `src/pages/People.tsx` | 4,269 | decomposition essentially done (see map) |
| `src/pages/Bids.tsx` | 3,791 | decomposition done (see map) |
| `src/pages/Dashboard.tsx` | 2,144 | shrank from ~8.9k via mapped extraction ([`DASHBOARD_SECTIONS_ARCHITECTURE.md`](./DASHBOARD_SECTIONS_ARCHITECTURE.md)) — remaining sections tracked there |

Each page is a tab-switched surface that owns hundreds of `useState`s, dozens of loaders/handlers, and inline JSX for every tab. Every large surface except `Estimates.tsx` and `Workflow.tsx` now has its Step-0 architecture map — write those two maps before starting their extraction.

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
