# Bid Submission & Followup Tab Architecture Map

---
file: docs/BID_SUBMISSION_FOLLOWUP_TAB_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 sub-decomposition map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for src/components/bids/BidSubmissionFollowupTab.tsx (~2,081 lines) — an already-extracted Bids tab that kept its inline jsPDF builders and five near-duplicate section tables. Inventories every logical region (state, memos, handlers, supabase tables, sub-components, coupling) so a future extraction can proceed without re-reading the whole file.
audience: Developers, AI Agents
last_updated: 2026-07-29
---

## What this surface is

[`src/components/bids/BidSubmissionFollowupTab.tsx`](../src/components/bids/BidSubmissionFollowupTab.tsx) (~2,081 lines) is the **Submission & Followup** tab of Bids, extracted from `Bids.tsx` on 2026-05-29 (see the `submission-followup` dossier in [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md)). It is a single-component surface — no internal `activeTab` switch — with one exported component and no module-level components. Hook census: **7 `useState`, 2 `useEffect`, 5 `useMemo`, 1 `useCallback`**.

The line count is not driven by state complexity (the tab is behaviorally thin) but by two things:

1. **Two inline jsPDF document builders** (`downloadSubmissionSummaryPdf` ~57 lines, `downloadFollowupSheetPdf` ~226 lines) that never got the Stage-A treatment their sibling `printFollowupSheet` HTML path already received ([`src/lib/bidDocuments/followupSheet.ts`](../src/lib/bidDocuments/followupSheet.ts), 188 lines).
2. **Five near-duplicate section tables** (Unsent / Pending / Won / Started-or-Complete / Lost, ~567 lines total) whose rows repeat the same inline SVG icon links and the same "Go to summary / Edit" action-button pair five times over.

Everything the tab renders comes from parent-owned data (`bids`, `lastContactFromEntries`, `customerContacts`, `estimatorUsers`); the component's **only direct supabase reads** are two identical `bids_submission_entries` SELECTs inside the followup-sheet builders. All note CRUD happens inside already-extracted children (`BidNotesTable`, `CustomerNotesTable`, `UnifiedBidCustomerNotes`).

Related file sizes (for context): `BidSubmissionFollowupExpandableDetails.tsx` 216, `BidWorkflowTabTitleWithPreview.tsx` 49, `BidNotesTable.tsx` 492, `CustomerNotesTable.tsx` 475, `UnifiedBidCustomerNotes.tsx` 995, `lib/submissionFollowupStale.ts` 37, `lib/bids/submissionSections.ts` 20.

**Recent churn is low**: ~31 mentions across `docs/RECENT_FEATURES.md`, the newest at v2.781 (dark-mode row-tint fix — `#fef2f2` → `var(--bg-red-tint)`, selected rows in the helper-driven tables → `var(--bg-blue-tint)`); current app version is v2.1088. No feature work has landed here for ~300 versions, so extraction can be scheduled at leisure.

### How to read a dossier

Line numbers are "as of 2026-07-29" and rot — prefer the symbol names. Each region lists: render location, **owned local state** (moves with the region), **cross-region / parent-owned state** (stays where it is), derived memos, handlers, supabase tables/RPCs, sub-components (extracted vs inline), external coupling, and an extraction status + risk + approach.

### How to maintain this doc

Update the relevant dossier whenever a region is extracted or its state/handlers change; flip its Status and point at the new file. Keep frontmatter `last_updated` current; never add line-number hints to frontmatter.

---

## Master summary table

| Region | Anchor / lines (approx) | Lines est. | Coupling | Risk | Status |
|---|---|---|---|---|---|
| Props seam + notes-tab state machine | component top, `submissionFollowupToolbarAddingKind` (~104–178) | ~75 | high (drives the notes panel) | — | stays / moves with notes panel |
| Buckets, search, stale threshold, prev/next nav | `filteredBidsForSubmission` … `handleScrollToSelectedBidRow` (~180–344) | ~165 | high (feeds tables, nav, overlay) | low as pure logic | inline — Stage A first |
| `submissionFollowupUrlRow` JSX helper | function `submissionFollowupUrlRow` (~346–416) | ~71 | low | low | inline — trivial component extraction |
| `downloadSubmissionSummaryPdf` | function (~418–474) | ~57 | low (reads `selectedBid` only) | low | inline — **Stage A candidate** |
| `printFollowupSheet` (HTML path) | function (~476–584) | ~109 | low | low | builder already in `lib/bidDocuments/followupSheet.ts`; only the data assembly is inline |
| `downloadFollowupSheetPdf` (PDF path) | function (~586–811) | ~226 | low | low-med | inline — **biggest Stage A candidate** |
| Print toolbar (stale input + followup-sheet picker) | first JSX block (~815–894) | ~80 | low | low | inline — extract first (Stage B) |
| Selected-bid summary card | `{selectedBid && (` (~896–1503) | ~608 | high (13 parent callbacks/props) | med | inline — extract after Stage A |
| Notes panel (pills + 3 note tables) | `role="tablist"` … `role="tabpanel"` (~1370–1502, state ~108–178) | ~205 | med (state machine + 4 parent callbacks) | med | inline — move with summary card or as own child |
| Search input + five section tables | `<input placeholder="Search bids` … end (~1505–2078) | ~574 | med (parent-owned `submissionSectionOpen`, selection) | med | inline — extract via a shared row/table component |

---

## Per-region dossiers

### Props seam (what the parent already owns)

The component receives everything through `BidSubmissionFollowupTabProps`. Grouped by role:

- **Controlled selection (parent-owned, URL-synced):** `selectedBid` (the parent's `selectedBidForSubmission`), `onSelectBid` (parent wires `(bid) => selectBidAndSyncUrl(bid, 'submission-followup')` — writes `?bidId=`), `onClearBid`.
- **Deep-link substrate (parent-owned, shared with `applySubmissionFollowupDeepLinkToBid` in `Bids.tsx`):** `summaryCardRef` (`submissionSummaryCardRef` in the parent — the deep-link handler scrolls it), `submissionSectionOpen` + `setSubmissionSectionOpen` (the deep-link handler force-opens the target section; parent initializes `{ unsent: true, pending: true, won: true, startedOrComplete: true, lost: false }`).
- **Data (parent caches):** `bids` (`BidWithBuilder[]` with `customers` / `bids_gc_builders` / `account_manager` / `estimator` embeds), `lastContactFromEntries` (`Record<string, string>`), `customerContacts` (`customer_contacts` rows), `estimatorUsers`, `authUser`.
- **Cross-tab callbacks:** `onEditBid` (accepts `{ focus: 'projectName' | 'gcBuilder' | 'bidValue' }`), `onOpenParty`, `onError`, `onReloadBids`, `onReloadCustomerContacts`.
- **Parent-only actions:** `onDownloadApprovalPdf` (stays in parent — depends on `loadPOTotal`, `priceBookVersions`, `serviceTypes`, and the 8 `coverLetter*ByBid` maps; already Stage-A'd to `lib/bidDocuments/approvalPdf.ts`), `canAddChecklistTask` + `onAddChecklistTask`, `onShowSentBidScript`, `onShowBidQuestionScript` (script modals live in the parent).

Any sub-extraction from this file threads a subset of these props through; none of them may be re-owned by a child.

### Notes-tab state machine

- **Render location:** state + handlers at the top of the component (~108–178); consumed by the notes pills/panel inside the summary card (~1332–1502).
- **Owned local state:** `submissionFollowupNotesTab` (`'all' | 'bid' | 'customer'`), `submissionFollowupUnifiedAddingKind` (`UnifiedNotesAddingKind`), `submissionFollowupBidTableAdding`, `submissionFollowupCustomerTableAdding`.
- **Derived:** `submissionFollowupToolbarAddingKind` (plain derived expression, not a memo — maps the active pill to the adding kind).
- **Handlers:** `handleSubmissionFollowupToolbarAddingKind` (the file's only `useCallback` — cross-tab "add" routing: e.g. pressing "add customer note" while on the Bid pill switches pills and starts adding), `handleSubmissionFollowupNotesTabPillClick` (resets all three adding flags then switches pill), plus the **reset effect** on `selectedBid?.id` change (clears pill back to `'all'` and all adding flags).
- **Cross-region state:** reads `selectedBid?.customers?.id` (customer pill is disabled when the bid has no linked customer).
- **Extraction status + risk + approach:** Moves as a unit with the notes panel (below). Do not split the state machine from the pills — the toolbar-adding routing is the subtle part; port it verbatim.

### Buckets, search, stale threshold, prev/next nav (the derived core)

- **Render location:** ~180–344.
- **Owned local state:** `submissionSearchQuery`, `submissionFollowupStaleDaysInput` (string).
- **Derived values:**
  - `filteredBidsForSubmission` — plain expression (not memoized): `bids` filtered by `submissionSearchQuery` against `project_name` / `address` / `customers.name` / `bids_gc_builders.name`.
  - Section buckets (plain expressions): `submissionUnsent` (= `bidEligibleForWorkingBoardArchive(b) && !b.working_board_archived_at` — imported from [`lib/workingBoardArchiveEligibility.ts`](../src/lib/workingBoardArchiveEligibility.ts)), `submissionPending` (`bid_date_sent` set, outcome not won/lost/started_or_complete), `submissionWon` (sorted by `estimated_job_start_date` ascending, nulls last), `submissionStartedOrComplete`, `submissionLost`.
  - Memos: `uniqueAccountManagers` (id/name/count, normalizes the `account_manager` embed which may be an array), `unassignedBidsCount`, `totalBidsCount`, `submissionFollowupStaleDaysThresholdParsed` (`parseInt`, `null` unless ≥ 1), `submissionFollowupNav` (prev/next position of `selectedBid` within its section's bucket, keyed by `getSubmissionSectionKey(selectedBid)` from [`lib/bids/submissionSections.ts`](../src/lib/bids/submissionSections.ts)).
- **Handlers:** `toggleSubmissionSection(key)` (writes parent-owned `setSubmissionSectionOpen`), `navigateSubmissionFollowup(delta)` (calls `onSelectBid` on the neighbor), `handleScrollToSelectedBidRow` (opens the section if closed, then `document.getElementById(`submission-row-${id}`)` scroll), `submissionFollowupListRowBackground(bid, isSelected)` (selected → `var(--bg-blue-tint)`; else stale → `var(--bg-red-tint)` via `isSubmissionBidStaleForThreshold` from [`lib/submissionFollowupStale.ts`](../src/lib/submissionFollowupStale.ts)).
- **Effect:** the **stale-overlay effect** pushes `{ thresholdDays, lastContactFromEntries, customerContacts }` into `bidPreview.setSubmissionFollowupStaleOverlay(...)` (from `useBidPreview()` / `BidPreviewModalContext`) whenever the parsed threshold changes, and clears it (`null`) on unmount. It is deliberately unguarded (no activeTab gate — the component only mounts on this tab).
- **Supabase tables:** none.
- **Extraction status + risk + approach:** The bucket predicates, the search filter, and the nav computation are **pure and should go to `lib/*` first** (see Stage-A inventory). The stale-overlay effect must stay in whatever component owns the threshold input (currently the print-toolbar region) — it is the only `BidPreviewModalContext` write on this surface.

### `submissionFollowupUrlRow` — link-row JSX helper

- **Render location:** function ~346–416; called 4× in the summary card (Project Folder / Job Plans / Bid Submission / CountTooling Plans).
- **Behavior:** renders a dash for empty URLs; otherwise an anchor that routes through `openInExternalBrowser` plus a copy-to-clipboard button (`navigator.clipboard.writeText`, toasts via `useToastContext`).
- **Extraction:** trivially becomes a tiny component (`SubmissionFollowupUrlRow`) in its own file or inside the future summary-card component. No state, no supabase; only `showToast` coupling.

### `downloadSubmissionSummaryPdf` — one-bid summary PDF (inline jsPDF)

- **Location:** ~418–474; triggered by the summary card's "PDF" button.
- **Behavior:** `loadJsPDF()` then builds an A4 sheet from `selectedBid` only — bid size (`formatCompactCurrency`), builder block (customer-vs-`bids_gc_builders` fallback via `extractContactInfo`), project block, contact block, and four `textWithLink` URL rows (URLs truncated at 70 chars). Filename `Bid_Summary_<name>.pdf` (sanitized, 40 chars).
- **Supabase tables:** none.
- **Extraction status:** **Stage-A candidate** → `src/lib/bidDocuments/submissionSummaryPdf.ts` taking an explicit bid/context object (no React, no closure) + a test. Low risk; nothing else references it.

### `printFollowupSheet` — followup sheet, HTML/print path

- **Location:** ~476–584; triggered by the toolbar "Print" button with `selectedAccountManagerForPrint` (`'ALL' | 'UNASSIGNED' | <managerId>`).
- **Behavior:** fetches **all** `bids_submission_entries` (table-wide, ordered `occurred_at` desc, embed `SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR` from [`lib/noteCreatorDisplay.ts`](../src/lib/noteCreatorDisplay.ts)), groups **latest 3 per bid** into `entriesByBid`, maps bids to `FollowupProject` view objects (`toProjectView`) and `FollowupGroups` (`toGroups`: notYetWonOrLost + won), then calls the **already-extracted** `buildFollowupSheetHtml` ([`lib/bidDocuments/followupSheet.ts`](../src/lib/bidDocuments/followupSheet.ts)) and `printHtmlInNewWindow` ([`lib/bidDocuments/htmlDoc.ts`](../src/lib/bidDocuments/htmlDoc.ts)).
- **Supabase tables:** `bids_submission_entries` (SELECT).
- **Extraction status:** the builder is done (Stage A complete); what remains inline is the **data assembly** (`entriesByBid` grouping, `accountManagerOf`, `toProjectView`, `toGroups`). Those are shared verbatim-in-spirit with the PDF path below — extract once, use twice.

### `downloadFollowupSheetPdf` — followup sheet, PDF path (inline jsPDF)

- **Location:** ~586–811 (~226 lines) — the single largest extractable block in the file.
- **Behavior:** repeats the same `bids_submission_entries` fetch + latest-3 grouping, then builds the PDF with local helpers `formatOutcome`, `push`, `pushLink` (tel:/mailto: `textWithLink`), `renderSubmissionEntriesPdf`, `renderProjectPdf`, `renderUnassignedBids`, `renderManagerBids` — **duplicating the grouping logic that the HTML path expresses via `toGroups`/`toProjectView`** rather than reusing it. Handles the same three modes (ALL with page breaks per manager + unassigned page, UNASSIGNED, single manager). Filenames: `followup-sheets-all.pdf` / `followup-sheet-unassigned.pdf` / `followup-sheet-<manager-slug>.pdf`.
- **Supabase tables:** `bids_submission_entries` (SELECT).
- **Extraction status:** **top Stage-A candidate** → `src/lib/bidDocuments/followupSheetPdf.ts`, taking the same `FollowupGroups`/`FollowupProject` shapes the HTML builder already defines (unify the two data assemblies first). Test the mode branching, page-break-per-manager behavior, and the tel/mailto link formatting. Behavior-preserving: keep the visual quirks (leading-space indentation strings like `'          Builder: '`) exactly.

### Print toolbar — stale input + followup-sheet picker

- **Render location:** first JSX block (~815–894).
- **Owned local state:** `selectedAccountManagerForPrint`, `submissionFollowupStaleDaysInput` (input rendered here; parsing + overlay effect described above).
- **Derived:** `uniqueAccountManagers`, `unassignedBidsCount`, `totalBidsCount` (option labels with counts).
- **Handlers:** `printFollowupSheet`, `downloadFollowupSheetPdf` (both above), `setSubmissionFollowupStaleDaysInput`.
- **Sub-components:** none; plain inputs/buttons.
- **External coupling:** the stale threshold feeds `submissionFollowupListRowBackground` (tables region) and the `BidPreviewModalContext` overlay effect — so the threshold state itself must stay hoisted at the tab level (or move to the tab's future top-level component), even if the toolbar JSX moves.
- **Extraction status + risk + approach:** **Extract first** (Stage B) as `BidSubmissionFollowupPrintToolbar` — after the two PDF builders are in `lib/`. Props: `bids` (or the precomputed manager list), the stale input value + setter, and the two document actions. Low risk; validates the seam.

### Selected-bid summary card

- **Render location:** `{selectedBid && (<div ref={summaryCardRef} ...` (~896–1503).
- **Owned local state:** none beyond the notes state machine (all display is derived from `selectedBid`).
- **Parent-owned state used:** `summaryCardRef` (deep-link scroll target — **must remain the parent's ref**, passed through), `selectedBid`, all the callback props.
- **Contents, in order:** mobile close X (`bidDetailCloseFloatMobileStyle` / desktop `bidDetailCloseXStyle` from [`lib/bids/bidStyles.ts`](../src/lib/bids/bidStyles.ts)); `BidWorkflowTabTitleWithPreview` (**extracted**, opens `bidPreview.openBidPreviewFromBid`); **prev/next nav** (`navigateSubmissionFollowup`, `[n/total]` from `submissionFollowupNav`); **share-link copy** (`submissionFollowupBidShareUrl(selectedBid.id)` — copies `?bidId=&tab=submission-followup`; note comment: superintendents get redirected off this tab by the parent's URL effect); edit-bid gear (`onEditBid`); "PDF" (`downloadSubmissionSummaryPdf`); builder / project / project-contact grid with "Add Builder" / "Add Project" / "Add project contact" buttons calling `onEditBid(selectedBid, { focus: ... })`; `BidSubmissionFollowupExpandableDetails` (**extracted**, 216 lines — takes `bid`, `narrowViewport640`, `estimatorUsers`); the four `submissionFollowupUrlRow` links; "Go to bid in table" (`handleScrollToSelectedBidRow`); "Approval PDF" (`onDownloadApprovalPdf`); "Add checklist task" (gated by `canAddChecklistTask` and `selectedBid?.id && authUser?.id`); the two safety-orange script buttons (`onShowSentBidScript` / `onShowBidQuestionScript`, styles `SAFETY_ORANGE`/`SAFETY_ORANGE_BORDER`); "Last update" line (`formatTimeSinceLastContact(effectiveSubmissionBidLastNoteIso(...))`); then the notes pills + panel (next dossier).
- **Supabase tables:** none directly.
- **External coupling:** `useNarrowViewport640` (responsive layout), `useBidPreview`, `useToastContext`.
- **Extraction status + risk + approach:** **Medium risk, big win** (~608 lines) → `BidSubmissionFollowupSummaryCard`. The risk is purely prop-surface width (~15 props: `selectedBid`, `summaryCardRef`, nav object + navigate callback, `onClearBid`, `onEditBid`, `onOpenParty`, `onDownloadApprovalPdf`, checklist + script callbacks, `estimatorUsers`, `authUser`, last-contact inputs, scroll-to-row callback, and the notes-panel props). Do Stage A (`downloadSubmissionSummaryPdf`) first so the move is cut/paste JSX.

### Notes panel (pills + BidNotesTable / CustomerNotesTable / UnifiedBidCustomerNotes)

- **Render location:** action buttons + pills + panel (~1332–1502), inside the summary card.
- **Owned local state:** the notes-tab state machine (dossier above).
- **Sub-components (all extracted):**
  - `UnifiedBidCustomerNotesActionButtons` + `UnifiedBidCustomerNotes` (`'all'` pill) — props `bidId`, `customerId`, `addingKind`/`onAddingKindChange`, `onMutated={() => { onReloadCustomerContacts(); onReloadBids() }}`.
  - `BidNotesTable` (`'bid'` pill) — `adding`/`onAddingChange={setSubmissionFollowupBidTableAdding}`, `onMutated={onReloadBids}`, `hideFooterAddButton`.
  - `CustomerNotesTable` (`'customer'` pill; only when `selectedBid.customers?.id`) — `useBidBoardCustomerChrome`, `hideFooterAddButton`; a fallback paragraph renders when the bid has no linked customer.
- **Supabase tables (via children):** `bids_submission_entries` (bid notes CRUD), `customer_contacts` (customer notes CRUD), `bids` (updates on mutation) — see the children's own files for exact verbs.
- **External coupling:** `onError`, `onReloadBids`, `onReloadCustomerContacts` — mutations here refresh parent caches that other Bids tabs read (`lastContactFromEntries` recompute).
- **Extraction status + risk + approach:** Move together with the summary card (simplest), or as its own `BidSubmissionFollowupNotesPanel` if the summary card is split — in that case the four notes-state values + two handlers move with it, and the reset-on-`selectedBid.id` effect must come along.

### Search input + five section tables

- **Render location:** ~1505–2078: search input, then per section a toggle button + conditional `<table>`: **Unsent / Working Bids** (`SUBMISSION_UNSENT_SECTION_LABEL`, ~1512–1625), **Not yet won or lost** (~1626–1761), **Won** (~1762–1900), **Started or Complete** (~1901–1997), **Lost** (~1998–2078).
- **Owned local state:** `submissionSearchQuery`.
- **Parent-owned state:** `submissionSectionOpen` / `setSubmissionSectionOpen` (deep-link handler writes it — stays in `Bids.tsx`), `selectedBid` (row highlight + action buttons).
- **Column sets differ per table** (behavior, not accident): Unsent has Job Plans icon, Pages (`plan_pages`), Project/GC, Bid Date (+`formatBidDueTime`), Account Man, Estimator, Last Update; Pending adds a Bid Submission icon column and GC/Builder (customer) link; Won has four icon columns (Project Folder `drive_link`, Job Plans `plans_link`, CountTooling `count_tooling_plans_link`, Bid Submission `bid_submission_link`) plus Start Date (`estimated_job_start_date`); Started/Complete is icon-free; Lost shows Bid Date + **Loss Reason** (accessed via cast `(bid as { loss_reason?: string | null })`).
- **Row mechanics repeated 5×:** `id={`submission-row-${bid.id}`}` (scroll anchor), `onClick={() => onSelectBid(bid)}`, link-icon cells with `e.stopPropagation()` + `openInExternalBrowser`, inline account-manager/estimator embed normalization (`Array.isArray` dance), and when selected a two-button cluster — "Go to summary" (re-selects then scrolls `summaryCardRef`) and "Edit bid" (`onEditBid`).
- **Row background inconsistency (load-bearing quirk):** Unsent and Pending use `submissionFollowupListRowBackground` (theme-tokenized selected tint + stale red highlight); **Won, Started/Complete, and Lost still hardcode `#eff6ff`** for the selected row and get **no stale highlight**. Preserve exactly during any move (the stale feature intentionally targets the two active-followup sections; the raw hex is a separate, pre-existing theme-token gap).
- **Supabase tables:** none.
- **Extraction status + risk + approach:** **Medium risk** — the duplication invites a parameterized `SubmissionSectionTable`, but a config-driven rewrite is a structural refactor; verify output-identical DOM per section (column order, `colSpan` values 8/8/9/5/4, th `title` attributes, icon SVGs). Safer staged path: first extract the two repeated leaf pieces as components (`SubmissionRowActions` for the Go-to-summary/Edit pair; `SubmissionLinkIconCell` for the icon anchor cells — this alone removes most of the ~570 duplicated lines since the SVG paths dominate), then optionally unify the tables.

---

## Shared substrate

**The selection pointer is the parent's, and it is the same one Bids has always had**: `selectedBidForSubmission` in `Bids.tsx`, passed as the controlled `selectedBid` prop, written via `onSelectBid → selectBidAndSyncUrl(bid, 'submission-followup')` which syncs `?bidId=` in the URL. This tab must never own selection (playbook rule 2).

Beyond selection, the shared substrate is **three parent-owned deep-link artifacts** that `applySubmissionFollowupDeepLinkToBid` (in `Bids.tsx`) writes: `selectedBidForSubmission`, `submissionSectionOpen` (it force-opens the section computed from the bid's outcome — note the parent re-implements the section-key ternary inline instead of calling `getSubmissionSectionKey`), and `submissionSummaryCardRef` (scrolled after a 150 ms timeout). Any sub-decomposition keeps all three as pass-through props.

**There is no data engine inside this component** — no equivalent of `useBidPricingEngine`. `bids`, `lastContactFromEntries`, `customerContacts`, and `estimatorUsers` are parent caches; the only direct DB access is the `bids_submission_entries` read in the two followup-sheet builders. Consequence: sub-extractions here are prop-threading exercises, not seam-building exercises — **no shared hook is needed** before any of the moves below.

One context coupling to respect: the tab is the sole writer of `BidPreviewModalContext.setSubmissionFollowupStaleOverlay` (the bid-preview modal shows the same stale highlighting). Whoever ends up owning `submissionFollowupStaleDaysInput` owns that effect and its unmount cleanup.

---

## Stage-A candidates (pure logic → `src/lib/*` + tests, before any component moves)

| Candidate | Currently | Target |
|---|---|---|
| `downloadFollowupSheetPdf` jsPDF builder (incl. `formatOutcome`, `renderProjectPdf`, `renderSubmissionEntriesPdf`, `renderManagerBids`, `renderUnassignedBids`) | ~226 lines inline | `src/lib/bidDocuments/followupSheetPdf.ts` consuming the existing `FollowupGroups`/`FollowupProject` types + tests (mode branching, page breaks, tel/mailto links) |
| `downloadSubmissionSummaryPdf` jsPDF builder | ~57 lines inline | `src/lib/bidDocuments/submissionSummaryPdf.ts` (explicit bid context, no React) + test |
| `bids_submission_entries` fetch + latest-3-per-bid grouping (`entriesByBid`) | duplicated in `printFollowupSheet` and `downloadFollowupSheetPdf` | `src/lib/bids/latestSubmissionEntriesByBid.ts` (grouping pure + test; keep the fetch injected or separate) |
| `toProjectView` / `toGroups` followup-view mapping | inline in `printFollowupSheet` only (PDF path re-derives it) | move next to the `FollowupProject` type in `lib/bidDocuments/followupSheet.ts` (or a sibling `followupSheetData.ts`) + test; then both paths share it |
| `accountManagerOf` embed normalizer (the `am == null ? null : Array.isArray(am) ? am[0] ?? null : am` dance — appears ~6× incl. estimator cells) | repeated inline | `src/lib/bids/normalizeBidStaffEmbed.ts` (check `bidBoardStaffOutcomes.ts` first — `formatBidStaffDisplayName` already half-covers display) + test |
| Section bucket predicates (`submissionUnsent`/`Pending`/`Won` sort/`StartedOrComplete`/`Lost`) | inline filter expressions | extend [`lib/bids/submissionSections.ts`](../src/lib/bids/submissionSections.ts) with `bucketBidsForSubmission(bids)` so buckets and `getSubmissionSectionKey` can never drift + tests (incl. Won's nulls-last start-date sort and Unsent's `bidEligibleForWorkingBoardArchive && !working_board_archived_at` gate) |
| `filteredBidsForSubmission` search predicate | inline | pure `filterBidsForSubmissionSearch(bids, query)` + test (4 fields, case-insensitive) |
| `submissionFollowupNav` computation | `useMemo` closure | pure `computeSubmissionFollowupNav(selectedBid, buckets)` + test (not-in-list, ends of list) |
| Stale-days input parsing | `submissionFollowupStaleDaysThresholdParsed` memo | trivial pure `parseStaleDaysThreshold(input)` (fold into `lib/submissionFollowupStale.ts`) + test |

Already Stage-A complete (do not re-extract): `buildFollowupSheetHtml` + `printHtmlInNewWindow`, `effectiveSubmissionBidLastNoteIso` / `isSubmissionBidStaleForThreshold`, `submissionFollowupBidShareUrl`, `getSubmissionSectionKey`, `bidEligibleForWorkingBoardArchive`, the `lib/bids/bidFormatting.ts` formatters, `extractContactInfo`, `formatBidDueTime`, `noteByLineFromEmbed` / `SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR`.

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **Followup-sheet builders fetch the whole `bids_submission_entries` table** (no `.in('bid_id', ...)` filter), ordered desc, then cap at 3 entries per bid client-side. N-heavy by design; keep it.
2. **The PDF path duplicates the HTML path's grouping** instead of reusing `toGroups`; unifying them is allowed as Stage A only if the emitted documents stay byte-comparable in content.
3. **Selected-row highlight is inconsistent by section**: Unsent/Pending use `submissionFollowupListRowBackground` (tokens + stale red); Won/Started/Lost hardcode `#eff6ff` and skip stale highlighting entirely (v2.781 only tokenized the helper path).
4. **Won bucket sort**: `estimated_job_start_date` ascending with nulls pushed to the end via the three-way null checks — preserve the exact comparator.
5. **`loss_reason` is read through a cast** (`(bid as { loss_reason?: string | null })`) because it is missing from the `BidWithBuilder` join type; keep the cast rather than widening the type mid-move.
6. **Stale threshold counts "Chicago calendar days"** (aria-label documents it; logic in `lib/submissionFollowupStale.ts`) and the overlay effect is unguarded but cleans up on unmount.
7. **The parent's deep-link handler re-implements the section-key ternary** instead of calling `getSubmissionSectionKey` — a known duplication in `Bids.tsx`, out of scope for this file's moves.
8. **`onEditBid` focus targets** (`'projectName' | 'gcBuilder' | 'bidValue'`) are part of the prop contract; the Add Builder / Add Project buttons depend on them.
9. **Share button copies `?bidId=&tab=submission-followup`**; superintendents opening that link are redirected off the tab by the parent's URL effect (comment at the button).
10. **Notes mutations trigger different reload combos**: bid-notes → `onReloadBids` only; customer-notes and unified → `onReloadCustomerContacts()` then `onReloadBids()`. Preserve the pairing.
11. **`handleScrollToSelectedBidRow` and the row "Go to summary" buttons use bare `setTimeout(..., 0)`** after state writes; the deep-link scroll in the parent uses 150 ms. Keep the timings.
12. **PDF builder indentation is literal spaces** inside strings (`'          Builder: '` etc.) — the output layout depends on them.

---

## Recommended extraction order (value ÷ risk)

1. **Stage-A sweep** — the table above, roughly in listed order; `followupSheetPdf.ts` is the single biggest win (~226 lines out plus a test over previously untested document logic), then `submissionSummaryPdf.ts`, then the shared entries-grouping/`toGroups` unification, then the small predicates.
2. **`BidSubmissionFollowupPrintToolbar`** (Stage B) — smallest prop surface once the builders live in `lib/`; the stale-days input value/setter stay lifted in the tab (the overlay effect and `submissionFollowupListRowBackground` read the parsed threshold).
3. **Leaf row components** — `SubmissionRowActions` + `SubmissionLinkIconCell` (deduplicates the 5× SVG/action blocks with zero structural change).
4. **`BidSubmissionFollowupSummaryCard`** (with the notes panel and its state machine inside) — after steps 1–3 the move is cut/paste JSX plus a wide-but-mechanical prop list; `summaryCardRef` passes through untouched.
5. **Section tables** — last, and optionally: either five thin table components or one parameterized `SubmissionSectionTable` with per-section column config, verified DOM-identical (colSpans 8/8/9/5/4, header titles, icon order). `submissionSectionOpen` and its setter remain pass-through props.

**What must STAY in the parent (`Bids.tsx`), permanently:** `selectedBidForSubmission` + `selectBidAndSyncUrl` URL sync, the `?bidId=` deep-link router and `applySubmissionFollowupDeepLinkToBid`, `submissionSectionOpen` + `submissionSummaryCardRef` (deep-link handler writes/scrolls them), `downloadApprovalPdf` (depends on parent-only pricing/cover-letter state), the Sent Bid / Bid Question script modals, the checklist-task opener, and the `bids` / `customerContacts` / `lastContactFromEntries` / `estimatorUsers` loaders.

Definition of done per step, verification gates (`npm run typecheck && npm run lint && npm test` after every move), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md).
