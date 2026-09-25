# Bid Submission & Followup Tab Architecture Map

---
file: docs/BID_SUBMISSION_FOLLOWUP_TAB_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 sub-decomposition map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for src/components/bids/BidSubmissionFollowupTab.tsx (2,214 lines) — the already-extracted "By status" lens of the Bids Followup tab, which kept its inline jsPDF builders, five near-duplicate section tables and (since Bids by GC) an inline per-GC row-bucketing layer. Inventories every logical region (state, memos, handlers, supabase tables, sub-components, coupling, test coverage) so a future extraction can proceed without re-reading the whole file.
covers:
  - src/components/bids/BidSubmissionFollowupTab.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

## What this surface is

[`src/components/bids/BidSubmissionFollowupTab.tsx`](../src/components/bids/BidSubmissionFollowupTab.tsx) (2,214 lines; the component body `BidSubmissionFollowupTab` is lines 97–2214, its render 911–2213) is the **Submission & Followup** tab of Bids, extracted from `Bids.tsx` on 2026-05-30 (`cfb1f1982`; see the `submission-followup` dossier in [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md)). Since the Followup merge (v2.1387) it has no button of its own: it renders as the **"By status"** lens in the merged Followup tab's top strip (`activeTab === 'submission-followup'`, hidden for `superintendent`; mounted at `Bids.tsx` `<BidSubmissionFollowupTab` ~4743). It is a single-component surface — no internal `activeTab` switch — with one exported component, no module-level components, and at module scope only types plus one const (`CustomerContact` 48, `SubmissionSectionOpenState` 50–56, const `SUBMISSION_UNSENT_SECTION_LABEL` 58, `SectionRow` 61, `BidSubmissionFollowupTabProps` 63–95).

Hook census (fact sheet): **8 `useState`, 3 effects, 7 `useMemo`, 1 `useCallback`, 0 `useRef`, 4 custom hooks** (`useNarrowViewport640`, `useBidPreview`, `useToastContext`, `useLedgerPrefixMap`).

The line count is not driven by state complexity (the tab is behaviorally thin) but by three things:

1. **Two inline jsPDF document builders** (`downloadSubmissionSummaryPdf` 57 lines, `downloadFollowupSheetPdf` 226 lines) that never got the Stage-A treatment their sibling `printFollowupSheet` HTML path already received ([`src/lib/bidDocuments/followupSheet.ts`](../src/lib/bidDocuments/followupSheet.ts), 189 lines).
2. **Five near-duplicate section tables** (Unsent / Pending / Won / Started-or-Complete / Lost, lines 1603–2211, ~609 lines) whose rows repeat the same inline SVG icon links (21 `<svg>` in the file) and the same "Go to summary / Edit" action-button pair five times over.
3. **An inline Bids-by-GC row layer** (v2.2178): the four post-send tables list **one row per GC packet** (`sectionRows` → `SectionRow { bid, gc, rowKey }`), with a local started-vs-won rule, a primary-GC anchor rule repeated 5×, and a `renderRowGcCell` JSX helper — pure logic that is untested at this layer.

Everything the tab renders comes from parent-owned data (`bids`, `gcPacketsByBid`, `sentScope`, `lastContactFromEntries`, `customerContacts`, `estimatorUsers`); the component's **only direct supabase reads** are two identical `bids_submission_entries` SELECTs inside the followup-sheet builders, and it makes **no direct writes**. Note CRUD happens inside already-extracted children (`BidNotesTable`, `CustomerNotesTable`, `UnifiedBidCustomerNotes`), and the Lost-row reason write happens inside `BidLostQuickPopover` (`bids` or `bid_versions` UPDATE).

Related file sizes: `BidSubmissionFollowupExpandableDetails.tsx` 223, `BidWorkflowTabTitleWithPreview.tsx` 49, `BidLostQuickPopover.tsx` 125, `BidNotesTable.tsx` 485, `CustomerNotesTable.tsx` 477, `UnifiedBidCustomerNotes.tsx` 1,048, `lib/submissionFollowupStale.ts` 37, `lib/bids/submissionSections.ts` 20, `lib/bids/gcOutcomeRows.ts` 175, `lib/bids/bidSentCounts.ts` 153. Parent `src/pages/Bids.tsx` is 5,293 lines.

**Churn is moderate, now quiet**: 11 commits in 90 days (fact sheet); since the previous map refresh (2026-07-29) seven commits touched the file, +133 net lines (2,081 → 2,214): v2.1336 (CountTooling icon → crosshair), v2.1385 (By-builder lens link `onOpenBuilderLens` + persisted stale-days pref), v2.1512 / v2.1515 (bid-number search + ledger prefix), v2.2043 (Lost-row "why?" quick capture), v2.2178 (one row per GC), v2.2937 (headers count bids via `bidSentCounts`). Last touch 2026-09-06 (v2.2937); nothing since through v2.3819, so extraction can be scheduled at leisure.

### How to read a dossier

**Line numbers are exact as of `a05cef4c4`** (from `npm run map -- src/components/bids/BidSubmissionFollowupTab.tsx`) and rot with every edit — search the symbol name, which every region below is anchored by. Each region lists: render location, **owned local state** (moves with the region), **cross-region / parent-owned state** (stays where it is), derived memos, handlers, supabase tables/RPCs, sub-components (extracted vs inline), external coupling, tests, and an extraction status + risk + approach.

### How to maintain this doc

Update the relevant dossier whenever a region is extracted or its state/handlers change; flip its Status and point at the new file. Regenerate the fact sheet (`npm run map -- <file>`), re-read line ranges from it, and bump front-matter `mapped_at` + `last_updated`; never add line-number hints to front matter.

---

## Master summary table

| Region | Anchor (symbol) · lines at a05cef4c4 | Lines | Coupling | Tests | Risk | Status |
|---|---|---|---|---|---|---|
| Props seam | `BidSubmissionFollowupTabProps` 63–95 | 33 (24 props) | parent `Bids.tsx` only importer | no render smoke | — | stays |
| Notes-tab state machine | `submissionFollowupNotesTab` … `submissionFollowupCustomerTableAdding` 147–151; reset effect 158–163; `submissionFollowupToolbarAddingKind` 165–174; `handleSubmissionFollowupToolbarAddingKind` 176–208; `handleSubmissionFollowupNotesTabPillClick` 210–215 | ~70 | 4 states, read only by the summary card (994–1602) | none | med (routing is subtle) | inline — moves with notes panel |
| Search + account-manager counts | `useLedgerPrefixMap` 217; `filteredBidsForSubmission` 218–227; `uniqueAccountManagers` 229–248; `unassignedBidsCount` 250–256; `totalBidsCount` 258–260 | ~44 | search feeds every bucket + `statusCounts`; AM memos feed toolbar + both followup-sheet builders | none (`bidNumberMatchesQuery` untested) | low | inline — Stage A (reuse tested `filterBidsForPicker`) |
| Bids-by-GC buckets + header counts | `submissionUnsent` 262–264; `sectionRows` 267–279; `statusCounts` 282; `submissionPending` 283; `isStartedRow` 286–287; `submissionWon` 288–298; `submissionStartedOrComplete` 299; `submissionLost` 300 | ~39 | reads `gcPacketsByBid` + `sentScope`; feeds 5 tables, 4 headers, nav | kernels tested (`gcOutcomeRows.test.ts`, `bidSentCounts.test.ts`); local bucketing untested | low as pure logic, wide blast radius | inline — **Stage A first** |
| `renderRowGcCell` | function 303–336 | 34 | Pending / Won / Started GC column + Lost multi-GC sub-line; `onOpenParty`, `onOpenBuilderLens` | none | low | inline — leaf component |
| Stale threshold + overlay | `submissionFollowupStaleDaysInput` 132–139 + localStorage effect 140–146; `submissionFollowupStaleDaysThresholdParsed` 338–342; `submissionFollowupListRowBackground` 344–349; overlay effect 351–370 | ~45 | input in toolbar; parsed value → Unsent/Pending row tint + `BidPreviewModalContext` | none (`submissionFollowupStale.ts` untested) | low | inline — state stays at tab top |
| Prev/next nav + section toggles + scroll | `toggleSubmissionSection` 154–156; `submissionFollowupNav` 372–423; `navigateSubmissionFollowup` 425–429; `handleScrollToSelectedBidRow` 431–442 | ~75 | reads all 5 buckets, `getSubmissionSectionKey`, parent `submissionSectionOpen` | none (`submissionSections.ts` has no test file; exercised only via `bidSentCounts.test.ts`) | low | inline — Stage A |
| `submissionFollowupUrlRow` | function 444–514 | 71 | `showToast` | none | low | inline — trivial component |
| `downloadSubmissionSummaryPdf` | async function 516–572 | 57 | reads `selectedBid` only | formatters only (`bidFormatting.test.ts`, `bidContactInfo.test.ts`) | low | inline — **Stage A** |
| `printFollowupSheet` (HTML) | async function 574–682 | 109 | `bids_submission_entries` SELECT; `uniqueAccountManagers`, `unassignedBidsCount` | builder: `followupSheet.test.ts`, `htmlDoc.test.ts`; data assembly untested | low | builder in lib; assembly inline |
| `downloadFollowupSheetPdf` (PDF) | async function 684–909 | 226 | `bids_submission_entries` SELECT; `uniqueAccountManagers`, `unassignedBidsCount` | none | low-med | inline — **biggest Stage A** |
| Print toolbar | JSX `{/* Print Followup Sheet UI + stale highlight */}` 913–992 | 80 | `selectedAccountManagerForPrint` (152), stale input | none | low | inline — Stage B first |
| Selected-bid summary card | `{selectedBid && (` 994–1602 | 609 | reads 4 notes states, calls 5 handlers, renders 6 children, ~16 props | none | med | inline |
| Notes panel (pills + 3 note tables) | action row 1430; `role="tablist"` 1469; `role="tabpanel"` 1548–1600 (pill switch 1558–1599) | ~171 | notes state machine + `onError` / `onReloadBids` / `onReloadCustomerContacts` | none (children untested) | med | inline — with summary card or own child |
| Search input + five section tables | `<input placeholder="Search bids` 1603–1609; Unsent 1610–1726; Pending 1727–1856; Won 1857–1989; Started 1990–2080; Lost 2081–2211 | ~609 | parent `submissionSectionOpen`, `selectedBid`, buckets, `submissionLedgerPrefixMap` | none | med | inline |
| Lost-reason quick capture | `lostReasonPanelBidId` 129; chip + `BidLostQuickPopover` row inside the Lost table (2090–2211) | (in Lost) | only state written inside a section table (branches 2090 / 2102); child writes `bids` / `bid_versions`, fires `bid-gc-outcome-changed` | `bidLossCategories.test.ts`; popover untested | med (write path) | inline — moves with Lost table |

**Money:** there is no money math on this surface — `bid_value` is only displayed (`formatCompactCurrency`, tested; `formatBidNameWithValue`, untested). The mounted child `BidSubmissionFollowupExpandableDetails` (1326) shows bid / agreed / profit values through its own private, untested copy of `formatCompactCurrency` (its line 11, same body as the lib's; used at 184–186). The risk flags are the untested **row bucketing** (decides which table and which count a bid lands in) and the untested **Lost-reason write path**.

---

## Per-region dossiers

### Props seam (what the parent already owns)

The component receives everything through `BidSubmissionFollowupTabProps` (63–95, 24 props). Grouped by role:

- **Controlled selection (parent-owned, URL-synced):** `selectedBid` (the parent's `selectedBidForSubmission`), `onSelectBid` (parent wires `(bid) => selectBidAndSyncUrl(bid, 'submission-followup')` — writes `?bidId=`), `onClearBid` (`setSelectedBidForSubmission(null)`).
- **Deep-link substrate (parent-owned, shared with `applySubmissionFollowupDeepLinkToBid` in `Bids.tsx`):** `summaryCardRef` (`submissionSummaryCardRef` in the parent — the deep-link handler scrolls it), `submissionSectionOpen` + `setSubmissionSectionOpen` (the deep-link handler force-opens the target section; parent initializes `{ unsent: true, pending: true, won: true, startedOrComplete: true, lost: false }`).
- **Data (parent caches):** `bids` (`BidWithBuilder[]`, loaded per trade pill, with `customers` / `bids_gc_builders` / `account_manager` / `estimator` embeds; the unpartitioned list, robot-twin bids included, whereas the Bid Board and the other Followup lenses get `peopleBids`), `gcPacketsByBid` (`Record<string, GcPacket[]>` from the parent's `useBidGcPackets(bids, bidGcRecipientsByBidId)`), `sentScope` (`BidSentScope` memo from the trade pill — `{ kind: 'trade', … }` or `{ kind: 'all' }`), `lastContactFromEntries` (`Record<string, string>`), `customerContacts` (`customer_contacts` rows), `estimatorUsers`, `authUser`.
- **Cross-tab callbacks:** `onEditBid` (type accepts `{ focus: 'projectName' | 'gcBuilder' | 'bidValue' }`), `onOpenParty` (`openGcBuilderOrCustomerModal`), `onOpenBuilderLens?` (`openBuilderLensForCustomer` — switches to `builder-review` and highlights that customer's card), `onError`, `onReloadBids`, `onReloadCustomerContacts`.
- **Parent-only actions:** `onDownloadApprovalPdf` (stays in parent — depends on `loadPOTotal`, `priceBookVersions`, `serviceTypes`, and the 8 `coverLetter*ByBid` maps; already Stage-A'd to `lib/bidDocuments/approvalPdf.ts`), `canAddChecklistTask` + `onAddChecklistTask`, `onShowSentBidScript`, `onShowBidQuestionScript` (script modals live in the parent).

Any sub-extraction from this file threads a subset of these props through; none of them may be re-owned by a child.

### Notes-tab state machine

- **Render location:** state 147–151; reset effect 158–163; derived + handlers 165–215; consumed by the notes action row / pills / panel inside the summary card (1430–1600).
- **Owned local state:** `submissionFollowupNotesTab` (`'all' | 'bid' | 'customer'`), `submissionFollowupUnifiedAddingKind` (`UnifiedNotesAddingKind`), `submissionFollowupBidTableAdding`, `submissionFollowupCustomerTableAdding`.
- **Derived:** `submissionFollowupToolbarAddingKind` (165–174, plain expression, not a memo — maps the active pill to the adding kind).
- **Handlers:** `handleSubmissionFollowupToolbarAddingKind` (176–208, the file's only `useCallback`, deps `[submissionFollowupNotesTab, selectedBid?.customers?.id]` — cross-pill "add" routing: pressing "add customer note" on the Bid pill switches pills and starts adding; ignored when the bid has no linked customer), `handleSubmissionFollowupNotesTabPillClick` (210–215, resets all three adding flags then switches pill), plus the **reset effect** (158–163) on `selectedBid?.id` change (pill back to `'all'`, all adding flags cleared).
- **Also written by the note children** through setter props — `onAddingChange={setSubmissionFollowupBidTableAdding}` (1565), `onAddingChange={setSubmissionFollowupCustomerTableAdding}` (1578), `onAddingKindChange={setSubmissionFollowupUnifiedAddingKind}` (1597) — all inside the notes panel, so the four states still move together.
- **Cross-region state:** reads `selectedBid?.customers?.id`.
- **Tests:** none.
- **Extraction status + risk + approach:** Moves as a unit with the notes panel (below). Do not split the state machine from the pills — the toolbar-adding routing is the subtle part; port it verbatim.

### Search + account-manager counts

- **Render location:** 217–260.
- **Owned local state:** `submissionSearchQuery` (127; input rendered at 1603–1609).
- **Derived:**
  - `filteredBidsForSubmission` (218–227) — plain expression (not memoized): `bids` filtered by `bidNumberMatchesQuery(b, query, submissionLedgerPrefixMap)` (from [`lib/ledgerDisplayPrefixes.ts`](../src/lib/ledgerDisplayPrefixes.ts); `submissionLedgerPrefixMap` = `useLedgerPrefixMap()` at 217) **or** a case-insensitive substring of `project_name` / `address` / `customers.name` / `bids_gc_builders.name`. With a non-empty query it is a new array every render, so every memo keyed on it (`sectionRows`, `statusCounts`) recomputes each render while searching.
  - Memos over the **unfiltered** `bids`: `uniqueAccountManagers` (229–248; id/name/count, normalizes the `account_manager` embed that may be an array), `unassignedBidsCount` (250–256), `totalBidsCount` (258–260).
- **Tests:** none — `ledgerDisplayPrefixes.test.ts` exists but does not exercise `bidNumberMatchesQuery`.
- **Extraction:** the tested kernel already exists — [`lib/bids/filterBidsForPicker.ts`](../src/lib/bids/filterBidsForPicker.ts) (`filterBidsForPicker(bids, query, prefixMap)`, v2.3546; `filterBidsForPicker.test.ts`) has the same 5 matchers; swap it in as `query.trim() ? filterBidsForPicker(...) : bids` (the kernel returns a copy on a blank query, which would bust the `sectionRows` / `statusCounts` memos every render). The AM counts become `accountManagerCounts(bids)` next to the embed normalizer (Stage-A table).

### Bids-by-GC buckets + header counts (the derived core)

- **Render location:** 262–300.
- **Owned local state:** none.
- **Derived values:**
  - `submissionUnsent` (262–264) — **still bid-based**: `bidEligibleForWorkingBoardArchive(b) && !b.working_board_archived_at` (from [`lib/workingBoardArchiveEligibility.ts`](../src/lib/workingBoardArchiveEligibility.ts)).
  - `sectionRows` memo (267–279) — `filteredBidsForSubmission.flatMap(b => gcOutcomeRowsForBid(b, { key: builderKey, name: builderName }, gcPacketsByBid[b.id]))` where `builderName = customers.name || bids_gc_builders.name || 'No builder'` (each name trimmed) and `builderKey = customer_id ?? gc_builder_id ?? builderName`; `rowKey = gc.packetKey ? `${b.id}:${gc.gcKey}` : b.id`. Single-GC bids yield exactly one row carrying the bid's own outcome ([`lib/bids/gcOutcomeRows.ts`](../src/lib/bids/gcOutcomeRows.ts)).
  - `statusCounts` memo (282) — `bidSentCounts(filteredBidsForSubmission, { scope: sentScope, packetsByBid: gcPacketsByBid })` ([`lib/bids/bidSentCounts.ts`](../src/lib/bids/bidSentCounts.ts): the unit is the BID, pile = `getSubmissionSectionKey`, adopted bids excluded).
  - Row buckets (plain expressions): `submissionPending` (283, `gc.outcome === 'pending'`); `isStartedRow` (286–287: `gc.outcome === 'won' && bid.outcome === 'started_or_complete'` **and** primary-GC row); `submissionWon` (288–298, won rows that are not started, sorted by `bid.estimated_job_start_date` ascending, nulls last); `submissionStartedOrComplete` (299); `submissionLost` (300, `gc.outcome === 'lost'`). Rows whose `gc.outcome` is `'unsent'` land in no row bucket (Unsent is bid-based).
- **Headers:** Unsent `({submissionUnsent.length}) · {scopeLabel(sentScope)}`; Pending / Won / Lost `bidsAndPacketsLabel(statusCounts.waiting|won|lost, rows.length)` ("101 bids · 107 GC packets", collapsing to "101 bids"); Started or Complete shows the row count only.
- **Supabase tables:** none.
- **Tests:** the kernels are covered (`gcOutcomeRows.test.ts`, `bidSentCounts.test.ts` incl. `bidsAndPacketsLabel` / `scopeLabel`); the **local** layer — `builderKey` derivation, `rowKey` shape, `isStartedRow`, the Won comparator, the primary-GC predicate — is untested.
- **Extraction status + risk + approach:** **Stage A first.** One pure `bucketSubmissionRows(bids, gcPacketsByBid)` (return the five buckets + `isPrimaryGcRow(row)`) in [`lib/bids/submissionSections.ts`](../src/lib/bids/submissionSections.ts) + tests; the `builderName`/`builderKey` pair is copied verbatim in three other lenses (see Shared substrate) and belongs in `gcOutcomeRows.ts`. `statusCounts` stays a one-line memo over the kernel.

### `renderRowGcCell` — per-GC party cell (JSX helper)

- **Location:** function 303–336; called in the Pending, Won and Started tables' GC/Builder column and, for multi-GC rows only, as a sub-line under the Lost table's first cell.
- **Behavior:** `multi = gc.siblings.length > 0 || gc.sharedLetter`. Name button → `onOpenBuilderLens(gc.gcKey)` when multi and the row's GC is not the bid's customer, else `onOpenParty(bid)`; a `↗` button opens the By-builder lens (only when `onOpenBuilderLens` is passed and there is a key: `gc.gcKey` on multi rows, else `bid.customer_id`, so a single-GC bid with only a `bids_gc_builders` builder gets none); multi rows add an "also to <GC> <waiting|won|lost>" line (plus "same letter · " for `sharedLetter`) with local `outcomeWord` / `outcomeColor`. Returns `'—'` for a single-GC bid with no party.
- **Tests:** none.
- **Extraction:** leaf component `SubmissionRowGcCell({ row, onOpenParty, onOpenBuilderLens })` — no state, theme tokens already used. `outcomeWord`/`outcomeColor` can go pure.

### Stale threshold + overlay

- **Owned local state:** `submissionFollowupStaleDaysInput` (132–139) — lazy init from `localStorage['bids_followup_stale_days']` (`''` default), persisted back by the effect at 140–146. The input is rendered in the print toolbar.
- **Derived:** `submissionFollowupStaleDaysThresholdParsed` memo (338–342; `parseInt`, `null` unless ≥ 1).
- **Handlers:** `submissionFollowupListRowBackground(bid, isSelected)` (344–349: selected → `var(--bg-blue-tint)`; else stale → `var(--bg-red-tint)` via `isSubmissionBidStaleForThreshold` from [`lib/submissionFollowupStale.ts`](../src/lib/submissionFollowupStale.ts)) — used by the Unsent and Pending tables only.
- **Effect:** the **stale-overlay effect** (351–370) pushes `{ thresholdDays, lastContactFromEntries, customerContacts }` into `bidPreview.setSubmissionFollowupStaleOverlay(...)` (`useBidPreview()` / `BidPreviewModalContext`), sets `null` when unparsed, and clears on unmount. No active-tab guard (only `if (!bidPreview) return`) — the component only mounts on this lens.
- **Tests:** none (`submissionFollowupStale.ts` has no test file).
- **Extraction:** the parse folds into `lib/submissionFollowupStale.ts`; the state + both effects stay with whoever owns the tab top level (the threshold feeds the tables and the context).

### Prev/next nav, section toggles, scroll-to-row

- **Location:** `toggleSubmissionSection` 154–156 (writes parent `setSubmissionSectionOpen`); `submissionFollowupNav` memo 372–423; `navigateSubmissionFollowup` 425–429; `handleScrollToSelectedBidRow` 431–442.
- **Behavior:** `submissionFollowupNav` picks the list by `getSubmissionSectionKey(selectedBid)` ([`lib/bids/submissionSections.ts`](../src/lib/bids/submissionSections.ts), bid-level outcome) — `submissionUnsent` as-is, the four row buckets mapped back to bids and **deduped by first occurrence** — and returns `{ list, currentIndex, total, canPrev, canNext, inList }`. `handleScrollToSelectedBidRow` force-opens that section then `setTimeout(0)` scrolls `#submission-row-<bidId>`.
- **Tests:** none (`getSubmissionSectionKey` has no test file).
- **Extraction:** pure `computeSubmissionFollowupNav(selectedBid, buckets)` + test (not-in-list, list ends, multi-GC dedupe). Handlers stay (they write parent state).

### `submissionFollowupUrlRow` — link-row JSX helper

- **Location:** function 444–514; called 4× in the summary card (1355–1361: Project Folder / Job Plans / Bid Submission / CountTooling Plans).
- **Behavior:** renders `"<label> —"` for empty URLs; otherwise an anchor that routes through `openInExternalBrowser` plus a copy-to-clipboard button (`navigator.clipboard.writeText`, toasts via `useToastContext`).
- **Extraction:** trivially becomes `SubmissionFollowupUrlRow`. No state, no supabase; only `showToast` coupling.

### `downloadSubmissionSummaryPdf` — one-bid summary PDF (inline jsPDF)

- **Location:** 516–572; triggered by the summary card's "PDF" button (1148).
- **Behavior:** `loadJsPDF()` then builds an A4 sheet from `selectedBid` only — bid size (`formatCompactCurrency`), builder block (customer-vs-`bids_gc_builders` fallback via `extractContactInfo`), project block, contact block, and four `textWithLink` URL rows (URLs truncated at 70 chars). Filename `Bid_Summary_<name>.pdf` (sanitized, 40 chars).
- **Supabase tables:** none. **Tests:** only its formatters.
- **Extraction status:** **Stage-A candidate** → `src/lib/bidDocuments/submissionSummaryPdf.ts` taking an explicit bid/context object (no React, no closure) + a test. Low risk; nothing else references it.

### `printFollowupSheet` — followup sheet, HTML/print path

- **Location:** 574–682; triggered by the toolbar "Print" button (961) with `selectedAccountManagerForPrint` (`'ALL' | 'UNASSIGNED' | <managerId>`).
- **Behavior:** fetches **all** `bids_submission_entries` (table-wide, `SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR` from [`lib/noteCreatorDisplay.ts`](../src/lib/noteCreatorDisplay.ts), ordered `occurred_at` desc), groups **latest 3 per bid** into `entriesByBid` (584–592), then `accountManagerOf` (594), `toProjectView` (602) and `toGroups` (639: notYetWonOrLost + won by **bid-level** `outcome`) over the **unfiltered** `bids`, and calls the extracted `buildFollowupSheetHtml` + `printHtmlInNewWindow` ([`lib/bidDocuments/htmlDoc.ts`](../src/lib/bidDocuments/htmlDoc.ts)).
- **Supabase tables:** `bids_submission_entries` (SELECT).
- **Tests:** builder covered by `followupSheet.test.ts` / `htmlDoc.test.ts`; the data assembly is not.
- **Extraction status:** builder done (Stage A complete); the inline **data assembly** (`entriesByBid`, `accountManagerOf`, `toProjectView`, `toGroups`) is shared in spirit with the PDF path — extract once, use twice.

### `downloadFollowupSheetPdf` — followup sheet, PDF path (inline jsPDF)

- **Location:** 684–909 (226 lines) — the single largest extractable block in the file.
- **Behavior:** repeats the same `bids_submission_entries` fetch + latest-3 grouping (693–701), then builds the PDF with local helpers `formatOutcome` (703), `push` (718), `pushLink` (726, tel:/mailto: `textWithLink`), `renderSubmissionEntriesPdf` (752), `renderProjectPdf` (771), `renderUnassignedBids` (804), `renderManagerBids` (831) — **duplicating the grouping the HTML path expresses via `toGroups`/`toProjectView`**. Same three modes (ALL with page breaks per manager + unassigned page, UNASSIGNED, single manager). Filenames `followup-sheets-all.pdf` / `followup-sheet-unassigned.pdf` / `followup-sheet-<manager-slug>.pdf` (903–906).
- **Supabase tables:** `bids_submission_entries` (SELECT). **Tests:** none.
- **Extraction status:** **top Stage-A candidate by size** → `src/lib/bidDocuments/followupSheetPdf.ts`, taking the same `FollowupGroups`/`FollowupProject` shapes the HTML builder already defines (unify the two data assemblies first). Test the mode branching, page-break-per-manager behavior, and the tel/mailto link formatting. Behavior-preserving: keep the literal leading-space indentation strings exactly.

### Print toolbar — stale input + followup-sheet picker

- **Render location:** first JSX block, `{/* Print Followup Sheet UI + stale highlight */}` 913–992.
- **Owned local state:** `selectedAccountManagerForPrint` (152); renders the `submissionFollowupStaleDaysInput` input (`#submission-followup-stale-days`, 918–936).
- **Derived:** `uniqueAccountManagers`, `unassignedBidsCount`, `totalBidsCount` (option labels with counts).
- **Handlers:** `printFollowupSheet`, `downloadFollowupSheetPdf`, `setSubmissionFollowupStaleDaysInput`.
- **Sub-components:** none; plain inputs/buttons (`#3b82f6` / `#10b981` / `#d1d5db` literal button colors).
- **External coupling:** the stale threshold feeds `submissionFollowupListRowBackground` and the `BidPreviewModalContext` overlay effect — so its state stays at the tab level even if the toolbar JSX moves.
- **Extraction status + risk + approach:** **first Stage-B move** as `BidSubmissionFollowupPrintToolbar`, after the two PDF builders are in `lib/`. Props: the manager list + counts, the stale input value + setter, and the two document actions. Low risk; validates the seam.

### Selected-bid summary card

- **Render location:** `{selectedBid && (<div ref={summaryCardRef} …` 994–1602 (609 lines).
- **Owned local state:** none beyond the notes state machine (all display is derived from `selectedBid`).
- **Parent-owned state used:** `summaryCardRef` (deep-link scroll target — **must remain the parent's ref**), `selectedBid`, the callback props.
- **Contents, in order:** mobile close X (1009, `bidDetailCloseFloatMobileStyle`; desktop `bidDetailCloseXStyle` at 1156, from [`lib/bids/bidStyles.ts`](../src/lib/bids/bidStyles.ts)); `BidWorkflowTabTitleWithPreview` (1027, **extracted**, opens `bidPreview.openBidPreviewFromBid`); **prev/next nav** (1050 / 1083, `navigateSubmissionFollowup`, `[n/total]` from `submissionFollowupNav`); **share-link copy** (~1102–1114, `submissionFollowupBidShareUrl(selectedBid.id)` — copies `?bidId=&tab=submission-followup`); edit-bid gear (1138, `onEditBid(selectedBid)`); "PDF" (1148, `downloadSubmissionSummaryPdf`); builder block (1198–1258, "Add Builder" → `onEditBid(…, { focus: 'gcBuilder' })`), project block (1261–1290, "Add Project" → `{ focus: 'projectName' }`), project-contact block (1293–1323, "Add project contact" → `onEditBid(selectedBid)` with no focus); `BidSubmissionFollowupExpandableDetails` (1326, **extracted** — `bid`, `narrowViewport640`, `estimatorUsers`); the four `submissionFollowupUrlRow` links (1355–1361); "Go to bid in table" (1374, `handleScrollToSelectedBidRow`); "Approval PDF" (1385, `onDownloadApprovalPdf`); "Add checklist task" (1390–1411, gated by `canAddChecklistTask`); the two safety-orange script buttons (1417 / 1424, `SAFETY_ORANGE` / `SAFETY_ORANGE_BORDER`); then the notes action row, "Last update" (`formatTimeSinceLastContact(effectiveSubmissionBidLastNoteIso(...))`, 1461) and pills + panel (next dossier).
- **Supabase tables:** none directly.
- **External coupling:** `useNarrowViewport640`, `useBidPreview`, `useToastContext`.
- **Tests:** none (no render smoke; the two extracted children have no tests either).
- **Extraction status + risk + approach:** **Medium risk, big win** (609 lines) → `BidSubmissionFollowupSummaryCard`. The risk is prop-surface width (~16 props: `selectedBid`, `summaryCardRef`, nav object + navigate callback, `onClearBid`, `onEditBid`, `onDownloadApprovalPdf`, checklist + script callbacks, `estimatorUsers`, `authUser`, last-contact inputs, scroll-to-row callback, the notes-panel props). Do Stage A (`downloadSubmissionSummaryPdf`) first so the move is cut/paste JSX.

### Notes panel (action row + pills + BidNotesTable / CustomerNotesTable / UnifiedBidCustomerNotes)

- **Render location:** 1430–1600 inside the summary card: action row with `UnifiedBidCustomerNotesActionButtons` (1443, rendered for **every** pill, driven by `submissionFollowupToolbarAddingKind` / `handleSubmissionFollowupToolbarAddingKind`), "Last update" (1461), `role="tablist"` pills (1469), `role="tabpanel"` (1548) with the pill switch (1558–1599).
- **Owned local state:** the notes-tab state machine (dossier above).
- **Sub-components (all extracted):**
  - `UnifiedBidCustomerNotes` (`'all'` pill) — `bidId`, `customerId`, `addingKind={submissionFollowupUnifiedAddingKind}` / `onAddingKindChange`, `onMutated={() => { onReloadCustomerContacts(); onReloadBids() }}`.
  - `BidNotesTable` (`'bid'` pill, 1559) — `adding` / `onAddingChange={setSubmissionFollowupBidTableAdding}`, `onMutated={() => { onReloadBids() }}`, `hideFooterAddButton`.
  - `CustomerNotesTable` (`'customer'` pill, 1570; only when `selectedBid.customers?.id`) — `useBidBoardCustomerChrome`, `hideFooterAddButton`, `onMutated` reloads contacts then bids; a fallback paragraph renders when the bid has no linked customer.
- **Supabase tables (via children):** `bids_submission_entries` (bid notes), `customer_contacts` (customer notes) — see the children for exact verbs.
- **External coupling:** `onError`, `onReloadBids`, `onReloadCustomerContacts` — mutations refresh parent caches other Bids tabs read (`lastContactFromEntries` recompute).
- **Extraction status + risk + approach:** Move together with the summary card (simplest), or as `BidSubmissionFollowupNotesPanel` if the card is split — then the four notes-state values, both handlers, the derived adding kind and the reset-on-`selectedBid.id` effect all move with it.

### Search input + five section tables

- **Render location:** search input 1603–1609, then per section a toggle button + conditional `<table>`: **Unsent / Working Bids** (`SUBMISSION_UNSENT_SECTION_LABEL`, 1610–1726), **Not yet won or lost** (1727–1856), **Won** (1857–1989), **Started or Complete** (1990–2080), **Lost** (2081–2211).
- **Owned local state:** `lostReasonPanelBidId` (129, Lost table only — next dossier).
- **Cross-region state:** `submissionSearchQuery` (127) — the search input here is its only writer, but the Search region owns it: it feeds `filteredBidsForSubmission` → every bucket, `statusCounts` and nav, so it stays at the tab top and the input takes value + setter as props if the tables move.
- **Parent-owned state:** `submissionSectionOpen` / `setSubmissionSectionOpen` (deep-link handler writes it — stays in `Bids.tsx`), `selectedBid` (row highlight + action buttons).
- **Column sets differ per table** (behavior, not accident): **Unsent** — Job Plans icon, Pages (`plan_pages`), Project / GC, Bid Date (+`formatBidDueTime`), Account Man, Estimator, Last Update, actions (colSpan 8); **Pending** — Job Plans + Bid Submission icons, Project / GC (+address), GC/Builder (customer) via `renderRowGcCell`, Account Man, Estimator, Last Update, actions (8); **Won** — four icons (Project Folder `drive_link`, Job Plans `plans_link`, CountTooling `count_tooling_plans_link` [crosshair since v2.1336], Bid Submission `bid_submission_link`), Project / GC, Start Date (`estimated_job_start_date`), GC/Builder, Account Man, actions (9); **Started or Complete** — icon-free: Project / GC, GC/Builder, Account Man, Estimator, actions (5); **Lost** — Project / GC (+ multi-GC `renderRowGcCell` sub-line), Bid Date, **Loss Reason** (chip / "why?" + note), actions (4).
- **Row mechanics repeated 5×:** `key={rowKey}` (Unsent: `bid.id`), scroll anchor `id="submission-row-<bidId>"` (Unsent always; the other four only on the primary-GC row), `onClick={() => onSelectBid(bid)}`, link-icon cells with `e.stopPropagation()` + `openInExternalBrowser`, inline staff-embed handling (Account Man cells use a bare `bid.account_manager as EstimatorUser | null` cast, 4×; Estimator cells use the `Array.isArray` dance, 3× — 8 `Array.isArray` occurrences in the file), and when selected a two-button cluster — "Go to summary" (re-selects then `setTimeout(0)` scrolls `summaryCardRef`) and "Edit bid" (`onEditBid`).
- **Name cell:** Unsent / Pending / Won / Started use `formatBidNameWithValue(bid, submissionLedgerPrefixMap)` (bid-number prefix); Lost uses `bidDisplayName(bid) || customers.name || bids_gc_builders.name || id.slice(0, 8)`.
- **Row background inconsistency (load-bearing quirk):** Unsent and Pending use `submissionFollowupListRowBackground` (tokenized selected tint + stale red); **Won, Started/Complete and Lost still hardcode `#eff6ff`** for the selected row and get **no stale highlight**.
- **Supabase tables:** none directly.
- **Tests:** none.
- **Extraction status + risk + approach:** **Medium risk** — the duplication invites a parameterized `SubmissionSectionTable`, but a config-driven rewrite is a structural refactor; verify output-identical DOM per section (column order, colSpans 8/8/9/5/4, th `title` attributes, icon SVGs, anchor-id rule). Safer staged path: extract the repeated leaf pieces first (`SubmissionRowActions`, `SubmissionLinkIconCell`, `SubmissionRowGcCell`), then optionally unify the tables. Pass the bucket arrays in as props (they are computed once at the tab level and also feed nav).

### Lost-reason quick capture (v2.2043)

- **Location:** state `lostReasonPanelBidId` (129, keyed by `rowKey`, not bid id despite the name); per-row derivation + chip inside the Lost table's `submissionLost.flatMap(...)` (2090–2211).
- **Behavior:** per row, `packetScoped = gcRowIsPacketScoped(gc)`; `lostCategory = isBidLossCategoryKey(gc.lossCategory) ? … : null`; `lostChip` from `BID_LOSS_CATEGORIES`; `lostNote = packetScoped ? gc.lossNote : (bid as { loss_reason?: … }).loss_reason`. Chip (or an amber "why? →" button) toggles the panel; an `auto` tag marks `gc.reasonInferred`. The open row appends a second `<tr>` (`colSpan={4}`) with `BidLostQuickPopover` (`packet` passed only when packet-scoped), whose `onSaved` runs `onReloadBids()` then `window.dispatchEvent(new Event('bid-gc-outcome-changed'))`.
- **Supabase tables (via child):** `bid_versions` UPDATE (`outcome`, `loss_category`, `outcome_note` for the packet's `versionIds`) or `bids` UPDATE (`outcome`, `loss_category`, `loss_reason`).
- **Tests:** `bidLossCategories.test.ts` covers the category list/guard; `BidLostQuickPopover` and the row derivation are untested.
- **Extraction:** pure `lostRowReason(row)` → `{ packetScoped, chip, note, inferred }` + test; the state moves with the Lost table.

---

## Shared substrate

**The selection pointer is the parent's**: `selectedBidForSubmission` in `Bids.tsx`, passed as the controlled `selectedBid` prop, written via `onSelectBid → selectBidAndSyncUrl(bid, 'submission-followup')` which syncs `?bidId=` in the URL. This tab must never own selection (playbook rule 2).

Beyond selection, the shared substrate is **three parent-owned deep-link artifacts** that `applySubmissionFollowupDeepLinkToBid` (`Bids.tsx` ~960) writes: `selectedBidForSubmission`, `submissionSectionOpen` (force-opens the section computed from the bid's outcome — the parent re-implements the section-key ternary inline instead of calling `getSubmissionSectionKey`), and `submissionSummaryCardRef` (scrolled after a 150 ms timeout). Any sub-decomposition keeps all three as pass-through props.

**Two more parent-owned inputs arrived with Bids by GC:** `gcPacketsByBid` (the parent's `useBidGcPackets`, also passed to the Bid Board and the other Followup lenses) and `sentScope` (the trade-pill memo the Bid Board pills and lens headers feed to `bidSentCounts`; the Dashboard card calls the same kernel with its own `{ kind: 'all' }`, `LOST_BID_NUDGE_SCOPE` in `useLostBidNudge`). Both are read-only here.

**There is no data engine inside this component** — no equivalent of `useBidPricingEngine`. Every list is a parent cache; the only direct DB access is the `bids_submission_entries` read in the two followup-sheet builders, and every write happens in an extracted child. Consequence: sub-extractions here are prop-threading exercises, not seam-building exercises — **no shared hook is needed** before any of the moves below.

Cross-surface couplings to respect:

- The tab is the sole writer of `BidPreviewModalContext.setSubmissionFollowupStaleOverlay` (the bid-preview modal shows the same stale highlighting). Whoever owns `submissionFollowupStaleDaysInput` owns that effect and its unmount cleanup.
- `localStorage['bids_followup_stale_days']` is read/written here **and** in `BidsBuilderReviewTab.tsx` (~156 / ~167) — the two lenses share the value but default differently (`''` here, `'14'` there).
- The `builderName` / `builderKey` derivation feeding `gcOutcomeRowsForBid` is copied verbatim in `BidsBuilderReviewTab.tsx` (~116–117; its `builderBidMapStats` builds the same name at ~96 but keys on `customer_id` alone at ~97), `BidsCallQueueTab.tsx` (~132–133) and `BidsWaitingToHearLens.tsx` (~183–184).
- `bid-gc-outcome-changed` is a window event also fired by `BidBoardGcRows`, `BidGcSentPanel`, `BidPackageSendsDetails`, `BidVersionPicker`, `BidsCallQueueTab`, `BidsWaitingToHearLens`, `BidsWhyWeLostLens` and `JobFormModal` (a `CustomEvent` with `detail.bidId`); listeners are `useBidGcPackets` (the parent hook behind `gcPacketsByBid` — this is how the Lost-row save refreshes the packets) and `BidPackageSendsDetails`.

---

## Stage-A candidates (pure logic → `src/lib/*` + tests, before any component moves)

| Candidate | Currently | Target |
|---|---|---|
| Bids-by-GC bucketing: `sectionRows` + `isStartedRow` + Won comparator + primary-GC predicate (inline 5×: `isStartedRow` 287 and the row `id` at 1758 / 1889 / 2018 / 2114) + nav dedupe | inline 262–300, 404 | `bucketSubmissionRows(bids, gcPacketsByBid)` + `isPrimaryGcRow(row)` in [`lib/bids/submissionSections.ts`](../src/lib/bids/submissionSections.ts) + tests (single-GC = one row with bid outcome; started only on rows passing the primary predicate — shared-letter rows included, pin today's behavior; Won nulls-last; `rowKey` shape; unsent-outcome rows dropped); the `builderName`/`builderKey` pair → `gcOutcomeRows.ts`, shared with the 3 other lenses |
| `downloadFollowupSheetPdf` jsPDF builder (incl. `formatOutcome`, `renderProjectPdf`, `renderSubmissionEntriesPdf`, `renderManagerBids`, `renderUnassignedBids`) | 226 lines inline | `src/lib/bidDocuments/followupSheetPdf.ts` consuming the existing `FollowupGroups`/`FollowupProject` types + tests (mode branching, page breaks, tel/mailto links) |
| `bids_submission_entries` fetch + latest-3-per-bid grouping (`entriesByBid`) | duplicated in `printFollowupSheet` (584) and `downloadFollowupSheetPdf` (693) | `src/lib/bids/latestSubmissionEntriesByBid.ts` (grouping pure + test; keep the fetch injected or separate) |
| `toProjectView` / `toGroups` followup-view mapping | inline in `printFollowupSheet` only (602 / 639; PDF path re-derives it) | next to the `FollowupProject` type in `lib/bidDocuments/followupSheet.ts` (or a sibling `followupSheetData.ts`) + test; then both paths share it |
| `downloadSubmissionSummaryPdf` jsPDF builder | 57 lines inline | `src/lib/bidDocuments/submissionSummaryPdf.ts` (explicit bid context, no React) + test |
| Lost-row reason derivation (`packetScoped` / `lostCategory` / `lostChip` / `lostNote`) | inline in the Lost `flatMap` | pure `lostRowReason(row)` (next to `gcRowIsPacketScoped` in `gcOutcomeRows.ts` or in `bidLossCategories.ts`) + test |
| `accountManagerOf` embed normalizer (`am == null ? null : Array.isArray(am) ? am[0] ?? null : am` — 8 occurrences incl. estimator cells) + `uniqueAccountManagers` / `unassignedBidsCount` | repeated inline | `src/lib/bids/normalizeBidStaffEmbed.ts` + `accountManagerCounts(bids)` (check `bidBoardStaffOutcomes.ts` first — `formatBidStaffDisplayName` already half-covers display, and is itself untested) + test |
| `filteredBidsForSubmission` search predicate | inline | **reuse** the existing tested `filterBidsForPicker(bids, query, prefixMap)` ([`lib/bids/filterBidsForPicker.ts`](../src/lib/bids/filterBidsForPicker.ts) — same bid-number + 4 text-field matchers), keeping `bids` itself on a blank query (the kernel returns a copy) |
| `submissionFollowupNav` computation | `useMemo` closure | pure `computeSubmissionFollowupNav(selectedBid, buckets)` + test (not-in-list, ends of list, multi-GC dedupe) |
| Stale-days input parsing | `submissionFollowupStaleDaysThresholdParsed` memo | `parseStaleDaysThreshold(input)` folded into `lib/submissionFollowupStale.ts` + test (that file has none today) |
| `renderRowGcCell` outcome word/color | local closures | pure `gcOutcomeWord` / `gcOutcomeColor` beside `gcOutcomeRows.ts` (the component part is Stage B) |

Already Stage-A complete (do not re-extract): `buildFollowupSheetHtml` + `printHtmlInNewWindow` (tested), `gcOutcomeRowsForBid` (tested; `gcRowIsPacketScoped` in the same file is not exercised by any test), `filterBidsForPicker` (tested — the search kernel this tab has not adopted yet), `bidSentCounts` / `bidsAndPacketsLabel` / `scopeLabel` (tested), `BID_LOSS_CATEGORIES` / `isBidLossCategoryKey` (tested), `bidNumberMatchesQuery` (untested), `effectiveSubmissionBidLastNoteIso` / `isSubmissionBidStaleForThreshold` (untested), `submissionFollowupBidShareUrl` (untested), `getSubmissionSectionKey` (no direct test; exercised through `bidSentCounts.test.ts`), `bidEligibleForWorkingBoardArchive` (untested), the `lib/bids/bidFormatting.ts` formatters (`formatCompactCurrency` / `formatDateYYMMDD` tested; `formatBidNameWithValue` / `formatTimeSinceLastContact` not), `extractContactInfo` (tested), `formatBidDueTime` (tested), `noteByLineFromEmbed` / `SELECT_BIDS_SUBMISSION_ENTRIES_WITH_CREATOR` (untested).

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **Followup-sheet builders fetch the whole `bids_submission_entries` table** (no `.in('bid_id', ...)` filter), ordered desc, then cap at 3 entries per bid client-side. N-heavy by design; keep it.
2. **The PDF path duplicates the HTML path's grouping** instead of reusing `toGroups`; unifying them is allowed as Stage A only if the emitted documents stay byte-comparable in content.
3. **Selected-row highlight is inconsistent by section**: Unsent/Pending use `submissionFollowupListRowBackground` (tokens + stale red); Won/Started/Lost hardcode `#eff6ff` and skip stale highlighting entirely.
4. **Won bucket sort**: `bid.estimated_job_start_date` ascending with nulls pushed to the end via the three-way null checks — preserve the exact comparator.
5. **`loss_reason` is read through a cast** (`(bid as { loss_reason?: string | null })`, 2110) because it is missing from the `BidWithBuilder` join type; packet-scoped Lost rows read `gc.lossNote` instead. Keep the cast rather than widening the type mid-move.
6. **Stale threshold counts "Chicago calendar days"** (aria-label documents it; logic in `lib/submissionFollowupStale.ts`); the value persists to `localStorage['bids_followup_stale_days']`, shared with the By-builder lens, which defaults to `'14'` where this lens defaults to empty. The overlay effect has no active-tab guard (only `!bidPreview`) but cleans up on unmount.
7. **The parent's deep-link handler re-implements the section-key ternary** instead of calling `getSubmissionSectionKey` — a known duplication in `Bids.tsx`, out of scope for this file's moves.
8. **`onEditBid` focus targets** are part of the prop contract: Add Builder → `'gcBuilder'`, Add Project → `'projectName'`; Add project contact and the gear pass no focus; `'bidValue'` is in the type but unused here.
9. **Share button copies `?bidId=&tab=submission-followup`**; superintendents opening that link are redirected off the tab by the parent's URL effect (comment at the button), and the "By status" lens button is hidden for them.
10. **Notes mutations trigger different reload combos**: bid-notes → `onReloadBids` only; customer-notes and unified → `onReloadCustomerContacts()` then `onReloadBids()`. Lost-reason save → `onReloadBids()` then the `bid-gc-outcome-changed` event. Preserve the pairings.
11. **`handleScrollToSelectedBidRow` and the row "Go to summary" buttons use bare `setTimeout(..., 0)`** after state writes; the deep-link scroll in the parent uses 150 ms. Keep the timings.
12. **PDF builder indentation is literal spaces** inside strings — the output layout depends on them.
13. **Rows are per GC packet, sections and anchors are per bid.** Only the primary-GC row (`gc.siblings.length === 0 || gc.gcKey === (bid.customer_id ?? bid.gc_builder_id ?? '')`) carries `id="submission-row-<bidId>"` — but shared-letter ("Also sent to") rows are built with empty `siblings` too, so they also pass this predicate (duplicate ids, and a started bid's shared-letter rows land in Started); nav and scroll-to-row pick the section from the bid's own outcome (`getSubmissionSectionKey`) while rows bucket by each packet's outcome, and the nav list dedupes rows back to bids. When the two disagree the selected bid can be absent from the nav list (`inList: false`) or its anchor can sit in a section that was not force-opened. Keep the rule; fix it deliberately, not during a move.
14. **Headers count bids, tables draw GC rows**: Pending / Won / Lost headers use `bidsAndPacketsLabel(statusCounts.*, rows.length)`; Unsent shows its bid count plus `scopeLabel(sentScope)`; Started or Complete shows only the row count.
15. **The followup sheet ignores search and GC packets**: both builders work over the unfiltered `bids` prop and bucket by bid-level `outcome`, so a sheet can disagree with what the lists show.
16. **Lost name cell has no bid-number prefix** (`bidDisplayName`), unlike the other four tables' `formatBidNameWithValue(bid, submissionLedgerPrefixMap)`.

---

## Recommended extraction order (value ÷ risk)

1. **Stage-A bucket kernel** — `bucketSubmissionRows` + `isPrimaryGcRow` (+ the shared `builderName`/`builderKey` helper). Smallest effort (~40 lines), and it is the newest, subtlest, untested logic on the surface: it decides the table, the header count, the nav list and the anchor id for every bid. Every later table move takes its output as props, so it goes first.
2. **Stage-A document sweep** — `followupSheetPdf.ts` (226 lines out, previously untested), unified with the shared `entriesByBid` grouping + `toProjectView`/`toGroups`; then `submissionSummaryPdf.ts`.
3. **Stage-A small predicates** — `lostRowReason`, search filter (adopt the existing `filterBidsForPicker`), nav computation, stale parse, staff-embed normalizer + AM counts.
4. **`BidSubmissionFollowupPrintToolbar`** (Stage B) — smallest prop surface once the builders live in `lib/`; the stale-days value/setter and both stale effects stay lifted in the tab.
5. **Leaf row components** — `SubmissionRowGcCell` (from `renderRowGcCell`), `SubmissionRowActions`, `SubmissionLinkIconCell` (deduplicates the 5× SVG/action blocks with zero structural change).
6. **`BidSubmissionFollowupSummaryCard`** (with the notes panel and its state machine inside) — after steps 1–5 the move is cut/paste JSX plus a wide-but-mechanical prop list; `summaryCardRef` passes through untouched. Add a `*.render.test.tsx` smoke with it (the surface has none).
7. **Section tables** — last, and optionally: five thin table components or one parameterized `SubmissionSectionTable` with per-section column config, verified DOM-identical (colSpans 8/8/9/5/4, header titles, icon order, anchor-id rule). The Lost table takes `lostReasonPanelBidId` with it; `submissionSectionOpen` and its setter remain pass-through props.

**What must STAY in the parent (`Bids.tsx`), permanently:** `selectedBidForSubmission` + `selectBidAndSyncUrl` URL sync, the `?bidId=` deep-link router and `applySubmissionFollowupDeepLinkToBid`, `submissionSectionOpen` + `submissionSummaryCardRef` (deep-link handler writes/scrolls them), `gcPacketsByBid` (`useBidGcPackets`) and `sentScope`, `downloadApprovalPdf` (depends on parent-only pricing/cover-letter state), the Sent Bid / Bid Question script modals, the checklist-task opener, `openBuilderLensForCustomer`, and the `bids` / `customerContacts` / `lastContactFromEntries` / `estimatorUsers` loaders.

Definition of done per step, verification gates (`npm run typecheck && npm run lint && npm test` after every move), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md).
