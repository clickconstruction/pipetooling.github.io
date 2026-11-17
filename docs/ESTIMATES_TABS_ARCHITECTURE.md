# Estimates Tabs Architecture Map

---
file: docs/ESTIMATES_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the Estimates.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what every region of the 5,423-line src/pages/Estimates.tsx owns (state, loaders, memos, writes, supabase tables / RPCs / edge functions, modals, coupling, test coverage) so the next cut can start without re-deriving the strategy. Re-mapped whole on 2026-11-17 after the first pass's steps 1–3 shipped. Sections — What this surface is; Master summary table; Per-region dossiers; Shared substrate; Stage-A inventory (+ cross-surface duplicates); Preserve-quirks list; Recommended extraction order; Hazards.
covers:
  - src/pages/Estimates.tsx
mapped_at: 6af60c5bcf
audience: Developers, AI Agents
last_updated: 2026-11-17
---

> **Line numbers are exact as of `6af60c5bcf`** (from the `npm run map -- src/pages/Estimates.tsx` fact sheet) and rot with the next edit — search the symbol; the range is only a hint. Re-run `npm run map` before trusting a range.

## What this surface is

[`src/pages/Estimates.tsx`](../src/pages/Estimates.tsx) is **5,423 lines**: 73 `useState`, 28 effects (27 `useEffect` + 1 `useLayoutEffect`), 28 `useMemo` + 13 `useCallback`, 15 `useRef`, 17 custom-hook calls; 6 components, 4 module functions, 103 local imports. It is **not one tab-switched God component — it is two independent page components behind a 5-line router**:

```tsx
export default function Estimates() {
  const { id: routeSegment } = useParams<{ id: string }>()
  if (routeSegment) return <EstimateDetail routeSegment={routeSegment} />
  return <EstimateList />
}
```

| Component | Lines | Size | useState | Effects | Memo/cb | Refs | Role |
|---|---|---|---|---|---|---|---|
| module layer (constants, CSS strings, CX config, types) | 190–563 | 374 | — | — | — | — | shared by both pages |
| `EstimateCustomerActivityDetails` | 203–220 | 18 | 1 | 0 | 0 | 0 | controlled `<details>` |
| `EstimateDetailCustomerActivitySection` | 222–307 | 86 | 0 | 0 | 0 | 0 | presentational events list (3 mounts) |
| `EstimateDraftCustomerGate` | 537–561 | 25 | 0 | 0 | 0 | 0 | `inert` overlay (2 mounts) |
| `EstimateList` | 565–1248 | 684 | 14 | 5 | 11 | 1 | `/estimates` |
| **`EstimateDetail`** | **1250–5418** | **4,169** | **58** | **23** | **30** | **14** | `/estimates/:id` — the God component |
| `Estimates` | 5420–5424 | 5 | 0 | 0 | 0 | 0 | router (default export) |

- **`EstimateList`** — `/estimates`. Two list tabs on `listTab: 'followup' | 'all'` (labels **Pipeline** and **Ledger**; Pipeline is the default; DOM ids `estimates-tab-stages` / `estimates-tab-ledger`). Both draw `EstimateListTable` / `EstimateListCards` from [`components/estimates/EstimateListTable.tsx`](../src/components/estimates/EstimateListTable.tsx) (1,003 lines, out since v2.3869; the card variant by `useNarrowViewport640`).
- **`EstimateDetail`** — `/estimates/:id`, where `:id` is a quote number (canonical) or a UUID (redirected to the number, `replace: true`). 77% of the file. Logic 1250–3159 (1,910 lines), render 3161–5417 (2,257 lines). It is not tab-switched: regions gate on `row.status` (`isDraft`) and on doc kind (`isCO` — a change order reuses the whole page in CO mode), plus the Customer experience `<details>` with its own `customerPreviewTab: 'email' | 'page' | 'thankyou'`.

**How it grew.** ~5,365 lines at v2.1088 → **6,982** at `a05cef4c4` (2026-09-25, the first map) → **5,201** two days later, after the first pass's three steps (the Stage-A kernels v2.3866–v2.3868, the list table and cards v2.3869, the catalog modal and the style factories v2.3870) → 5,223 on 2026-10-26 (the Stage-A residue, v2.5864 / v2.5870 / v2.5871, paid for the Tell-the-customer sheet and *Start ticked*) → **5,423** today. Every line added since the cuts went into `EstimateDetail`, most of it on the **sent side**: What went (v2.5683), the offered options (v2.5988), Extend good-through (v2.5992), Download PDF (v2.5993), the letter again (v2.5997), the passed chip's door (v2.6037), First look (v2.7004). Each feature arrived as an extracted component with tests — the page gained only the wiring — which is why 200 lines of growth carried seven features.

**Stage-A maturity:** 30 component files in `src/components/estimates/` (23 imported here) and 47 kernel modules under `lib/estimates/` and `lib/estimate*.ts` hold what has left; 63 of the page's import lines name an estimate kernel or component. What remains inline is wiring and JSX: the loader, the draft persistence, the send flow, the option handlers, the whole draft editor, the sent view's layout, the CX override editor.

**Churn:** hot — 82 commits in 90 days, 23 in the last 30, last 2026-11-13 (`191bf31ee3`, a theme-token sweep). No session card and no open PR touches the file at `6af60c5bcf`. Extract between trains; check `npm run sessions` and `gh pr list --json number,title,files` first.

### How to read a dossier

Each lists: anchor (symbol + lines as of `6af60c5bcf`), **owned state** (moves with the region), **shared state** (stays in the parent or a seam), memos, handlers and loaders, supabase surface, sub-components, tests, and **status + risk + approach**. "Reads N / writes N" are the fact sheet's per-block state counts.

---

## Master summary table

| Region | Anchor (as of `6af60c5bcf`) | Size | Coupling | Risk | Status | Recommended action |
|---|---|---|---|---|---|---|
| Module layer | 190–563 | 374 | consumed by both pages | low | inline; helpers already in `lib/estimates/*` | CSS strings 397–495 → `estimatesPageStyles.ts`; CX config moves with the CX section |
| List shell (Pipeline + Ledger) | `EstimateList` 565–1248 | 684 | self-contained (URL only) | low | **out, v2.7629** — [`EstimatesListPage.tsx`](../src/components/estimates/EstimatesListPage.tsx), moved whole; the shell and focus CSS in `estimatesPageCss.ts` | done |
| Detail: loader + hydration | `load` 1590–1772 + the reset and IO effects 1364–1784 | ~470 | highest — `load` writes 23 states | high | **out, v2.7627** — [`hooks/useEstimateDetailData.ts`](../src/hooks/useEstimateDetailData.ts) | done |
| Detail: draft persistence | payload 2640–2665 · `saveDraft` 2678–2716 · autosave + leave 2718–2806 | 172 | highest — payload reads 16 states | high | **out, v2.7627** — in `useEstimateDetailData`, whole, beside the loader | done |
| Detail: send flow | `sendToCustomer` 2808–2870 · `sendEstimateEmailAnswer` 2878–2948 · `sendEstimateEmail` 2951–2959 · `tellSheet` 3123–3149 | 179 | med (calls `saveDraft`, `load`) | **med, customer-facing, untested** | inline | **Stage A first** — one send client + answer kernel + send-plan kernel |
| Detail: sent-side actions | accept URL 2158–2173 · decline 2175–2201 · extend + remail 2203–2271 · resend 2273–2354 · PDF 2378–2407 · unlink 2979–3015 | ~290 | **low** — touches `row`, `load`, events, `lastAcceptUrl` only | low-med | **out, v2.7613** — [`hooks/useEstimateSentActions.ts`](../src/hooks/useEstimateSentActions.ts) (decline, extend + remail, resend, unlink); the accept-URL pair and the PDF pair stay in the page | done |
| Detail: sent / accepted / declined view | `!isDraft` 4705–5035 + read-only header 3453–3511 | 331 + 59 | reads 15 / writes 1 | med | **out, v2.7613** — [`EstimateSentView.tsx`](../src/components/estimates/EstimateSentView.tsx) (the view + the Unlink job window) and `EstimateCustomerActivitySection.tsx`; the read-only header is `EstimateSentHeader.tsx` since v2.7633 | done |
| Detail: customer experience | gate + `<details>` 5037–5292 · `renderCxDraftSectionFields` 2459–2589 · memos 2356–2376, 2409–2457 | 256 + 131 + 90 | med-high (`cxOverrideFields` persisted by the payload) | med | **out, v2.7622** — [`EstimateCustomerExperienceSection.tsx`](../src/components/estimates/EstimateCustomerExperienceSection.tsx) + `EstimateCxOverrideFields.tsx` + the `estimateCxOverrideSections` kernel; the memos stay in the page | done |
| Detail: step rail + customer view | `railData` 2017–2044 · `handleRailStepClick` 2046–2059 · `railStepDot` 2062–2070 · render 3168–3179, 3515–3561 | ~110 | med (`railStepDot` in 5 sections) | low-med | `EstimateDraftStepRail` out; wiring inline | stays in the parent |
| Detail: draft customer picker | `isDraft` 3180–3398 + handlers 2591–2619, 1786–1836, 1879–1907 | 219 + ~100 | reads 9 / writes 7 | med-high | **out, v2.7633** — [`EstimateDraftCustomerSection.tsx`](../src/components/estimates/EstimateDraftCustomerSection.tsx), the JSX; its handlers, the notes read and the create-customer overlay stay in the page | done |
| Detail: draft editor body | `isDraft` 3513–4702 | 1,190 | reads 29 / writes 18 | high as one block | split, v2.7618 to v2.7633; what is left inline is the customer view, the title editor, the For and Expires slots, the attachment card, Terms and the button row | leave: each is a few lines over the page's own state |
| ↳ Estimate options strip | `!isCO && isDraft` 3800–3994 + handlers 1926–2001 | 195 + 76 | med (`lines` = the viewed option) | med | **out, v2.7624** — [`EstimateOptionsStrip.tsx`](../src/components/estimates/EstimateOptionsStrip.tsx) over the moves of `estimateOptionsEditor` (v2.7605); the option state stays in the page | done |
| ↳ Change-order block | `isCO` 3743–3799 · empty prompts 4058–4093, 4210–4300 · `addCoLine` 1846–1853 · `publishCoToBidRoom` 3022–3062 | ~230 | low-med | low-med | **out, v2.7633** — [`EstimateChangeOrderFields.tsx`](../src/components/estimates/EstimateChangeOrderFields.tsx) (the four fields); the prompts went with the line items; `addCoLine` and `publishCoToBidRoom` stay in the page | done |
| ↳ Line rows + toolbar | 4017–4303 + `updateLine` 3080–3088, `applyFromCatalogEntry` 3098–3118 | ~290 + 40 | med (`lines`, catalog, recents, CO prompts) | med | **out, v2.7633** — [`EstimateDraftLineItems.tsx`](../src/components/estimates/EstimateDraftLineItems.tsx): the bridged note, the heading and recents, the catalog window, the prompts, the rows, the toolbar and the total; `updateLine` and `applyFromCatalogEntry` stay in the page | done |
| ↳ Supporting document | fieldset 4400–4550 + check 2961–2977 + resets 1383–1386 | 151 + 25 | **low** (url + label in, the check's answer in) | **low** | **out, v2.7618** — [`EstimateSupportingDocumentFieldset.tsx`](../src/components/estimates/EstimateSupportingDocumentFieldset.tsx); the check's state and handler stay in the page | done |
| ↳ Delivery (notify, project, notes) | 4552–4660 + options loader 1452–1499 + memos 1856–1877 + projects 2621–2633 | ~110 + 85 | **low** (ids in, ids out) | **low** | **out, v2.7618** — [`EstimateDeliverySection.tsx`](../src/components/estimates/EstimateDeliverySection.tsx) with the two Also-notify memos; the two loaders stay in the page | done |
| Detail: page-level modals | 5294–5417 | 124 | each has one opener | low | mixed | move with their opener |
| Router | `Estimates()` 5420–5424 | 5 | — | — | done | stays |

---

## Per-region dossiers

### Module layer (190–563)

- **Constants:** `ESTIMATE_CATALOG_EDITOR_ROLES` 190–198, `SEND_EMAIL_RE` 200, `ESTIMATE_JOB_SECTION_HASH` 381, `ESTIMATES_PAGE_CLASS` 397.
- **CSS strings:** `estimatesPageShellCss` 400–420, `estimatesFocusVisibleCss` 422–429, `estimatesListCustomerSnapshotBtnCss` 431–435, `estimateCustomerSearchHighlightCss` 437–447, `estimateDetailLineItemRowCss` 449–484, composed into `estimateDetailPageCss` 486 and `estimatesListPageCss` 488; `estimateListTableScrollWrapStyle` 491–495; `estimateDetailCreateJobButtonStyle` 384–395; `coPromptChipStyle` / `coPromptPanelStyle` 502–520. The input and button factories are already in [`estimatesPageStyles.ts`](../src/components/estimates/estimatesPageStyles.ts) (v2.3870).
- **CX config (data):** `CX_FIELD_LABELS` 309–326 (16 keys), `CX_OVERRIDE_SECTIONS` 338–369 (Email / Acceptance page / Thank you), `cxOverrideFieldRows` 371–374. Read only by the CX section.
- **Thin wrappers:** `lineItemsFromJson(raw, allowNegative)` 522–524 and `sumLineItems` 526–528 over [`lib/estimateLineItemNormalize.ts`](../src/lib/estimateLineItemNormalize.ts).
- **Types:** `EstimateDetailRow` 377–379, `LineItem` 499, `EstimateDraftCustomerGateProps` 530–534, `EstimateListTab` 563.
- **Small components:** `EstimateDraftCustomerGate` 537–561. The two activity components (was 203–307) left with the sent view, v2.7613, to `components/estimates/EstimateCustomerActivitySection.tsx`.
- **Status:** no pure logic left here. Low risk. The CSS strings go to the styles file when either page component gets its own file; the activity section goes with the sent view; the gate stays beside `EstimateDetail`.

### `EstimateList` — Pipeline + Ledger (565–1248)

- **Render:** 854–1247. Header 857–897 (⚙ `canOpenBillingNotifications(role)` 860–882, **New change order** 890, **New estimate** 893) + settings modal 898; tablist 900–931; `?customer=` banner 932–969; Ledger panel 970–1045 (search `estimates-list-search`, kind / window / closed filters, totals footer 1041–1043); Pipeline panel 1047–1213 (search `estimates-list-search-stages`; Unsent 1077 with the empty-draft sweep 1095, Sent 1126, Declined 1157 — drawn only when non-empty — Accepted 1184); three modals 1215–1247. Ten table/cards call sites.
- **Owned state (14):** `listTab`, `ledgerKind`, `ledgerDays` (90), `ledgerIncludeClosed`, `acceptNotifySettingsOpen`, `listSearch` (**one state for both tabs**), `rows`, `loading`, `creating`, `acceptanceModalEstimateId`, `createJobFromListRow`, `customerSnapshotId`, `listCustomerEvents` 644, `cleaningEmpties` 702; ref `newEstimateParamFiredRef` 756.
- **Engine:** [`useEstimateThreadNotes`](../src/hooks/useEstimateThreadNotes.ts) 588–599 (294 lines; `estimates_thread_notes`), bundled as `estimatesStagesThread` 841–852 and handed to the Pipeline buckets only.
- **Memos:** `filteredRows` 634, `followupBuckets` 639 (`splitFollowupRows`), `eventRowIdsKey` 645, `sentOpenStateById` 679, `declinedLabelById` 686, `emptyDraftIds` 694, `unsentVisibleRows` 698, `ledgerRows` 704, `ledgerTotals` 710.
- **Loaders / writes:** `load` 605–628 (`estimates` `*, customers(name, address, contact_info), jobs_ledger(hcp_number)`, optional `?customer=`, `updated_at` desc, **limit 200**); events effect 649–678 (one chunked `estimate_customer_events` read through `fetchAllRowsChunkedIn`, best effort); `cleanUpEmptyDrafts` 712–734 (confirm, bulk DELETE draft-gated); `createDraft(projectId?, docKind, trigger)` 773–820 (company owner via `resolveMasterUserId`, INSERT, telemetry, navigate with `state.freshEstimateDraft`). Effects: 320 ms thread-stats refresh 737–744, collapse thread off-Pipeline 746–748, `?newEstimate=true&project=` 757–771.
- **Sub-components (all extracted):** `EstimateListTable` / `EstimateListCards`, `EmptyState` ×7 over `estimatesEmptyWords`, `EstimateAcceptedNotifySettingsModal`, `CustomerAcceptanceRecordModal`, `CustomerSnapshotModal`, `CreateJobFromEstimateModal`.
- **Tests:** `estimatePipelineRefresh.test`, `estimateOpenState.test`, `estimateListRows.test`, `estimatesEmptyWords.test`, `EstimateListTable.render.test`, `supabasePaging.test`; e2e `viewport-smoke.spec.ts` (the `/estimates` marker only). The page smoke (`Estimates.render.test.tsx`, v2.7610) mounts the shell and reads the lanes and the Ledger's totals; `useEstimateThreadNotes` and `estimateMasterUser` untested.
- **Status:** **out, v2.7629** — moved whole to `components/estimates/EstimatesListPage.tsx` (739 lines), the code the page's own; `Estimates.tsx` mounts it from the router and is 2,393 lines. The page shell and focus-ring CSS strings, which both pages use, are `components/estimates/estimatesPageCss.ts`; the list's own CSS went with it. Not cut per tab: the tabs share `listSearch`, `filteredRows`, the modals and the empty words.

### `EstimateDetail` — loader + hydration (the future seam)

- **Anchor:** route reset 1368–1381; signature URL 1406–1428; catalog 1439–1450; notify options 1452–1499; `app_settings` 1501–1519; recents 1521–1527; events 1529–1566 (focus refresh only while sent or accepted); `hydrateCustomerFieldsFromEstimate` 1572–1588; **`load({ refresh? })` 1590–1772**; CX overrides re-hydrate 1778–1784; `refetchCustomersAfterEdit` 1786–1810; `openDraftCustomerForEdit` 1812–1836; lazy projects 2621–2633.
- **What `load` does in one pass:** read `estimates` (`*, jobs_ledger(hcp_number)`) by `id` or `estimate_number`; invalid or missing → toast + `/estimates`; UUID → number redirect; stamp `freshDraftRowIdRef`; then hydrate the brand, terms, **options** (`normalizeEstimateOptionsFromJson`; none on a CO; viewed = recommended; preview selection = `defaultEstimateSelection`), `lines` (the viewed option's, else the snapshot, else `[defaultDraftFirstLine()]` for an empty non-CO draft), `coFields`, `customerId`, `validUntil` + preset (a draft with none gets today + 30), `forAddress`, `linkedProjectId`, `internalNotes`, the accept-notify ids (a draft with `NULL` → self + every `master_technician`, one `users` read) and their display rows (non-draft), the attachment (draft live vs frozen `customer_attachment_sent`), `lastAcceptUrl` from sessionStorage, then the **whole `customers` table** and a derived title for a generic-titled draft with a customer. `{ refresh: true }` (v2.5695) skips the `loading` flag so the page and the Tell sheet stay mounted.
- **Supabase:** `estimates`, `users` (five reads), `customers`, `projects`, `app_settings`, `estimate_customer_events`, storage `estimate-acceptor-signatures`, `estimate_catalog_items` (via `fetchEstimateCatalogLive`).
- **Tests:** the parse kernels (`estimateRouteSegment`, `estimateAcceptHeaderBrand`, `estimateCustomerAttachment`, `estimateOptions`, `estimateChangeOrder`, `estimateTitle`, `estimateAcceptUrlSession`); the hydration rules themselves (today + 30, which lines a draft opens on, the notify default) are `estimateDetailHydration.test` since v2.7607 (26 cases); `addCalendarDaysYmd` has no test of its own.
- **Status:** **out, v2.7627** — `useEstimateDetailData({ routeSegment })` owns `row`, `loading`, `load`, the `customers` cache, the draft form cluster, every read above and the persistence below; the page calls it first and destructures 72 names, so nothing downstream changed. Each statement is the page's own, in the page's own order, so the effects fire as they did. The route reset is the one statement that was split: the hook clears the form's pieces, and the page keeps a two-line effect for `draftTitleEditing` and `detailCustomerSnapshotId`. Before the move it read: this is the seam, not a component. The pure hydration plan is out ([Stage A](#stage-a-inventory-pure-logic-to-lib--tests-before-any-component-moves) row 4, v2.7607; the page is 5,257 lines), so the hook move is a move of setters and effects only. The route reset also clears region-owned state (`draftTitleEditing`, `validUntilPreset`, the attachment check, `detailCustomerSnapshotId`), so a region that leaves resets those itself or is keyed on `routeSegment`.

### `EstimateDetail` — draft persistence (autosave, save, leave hook)

- **Anchor:** `buildDraftPersistPayload` 2640–2665 (the hand-off to the tested `buildEstimateDraftPersistPayload`); held dates 2667–2676 (v2.4246: a half-typed date is left out of the write, said once, and stops a send); `saveDraft({ quiet?, skipReload? })` 2678–2716; the customer-link autosave 2718–2732; `useJobFormAutosaveSlice` 2734–2751; the fresh-draft leave hook 2753–2796; the visibility flush 2797–2806. Refs `freshDraftRowIdRef` 1262, `committedDraftRowIdRef` 1264, `toldHeldDraftDatesRef` 1266, `prevCustomerIdForAutosave` 1362, `draftAutosaveFlushRef` 2750, `freshDraftLeaveRef` 2758.
- **Reads:** 16 states through the payload — `title`, `terms`, `lines`, `estimateOptions`, `viewedOptionKey`, `validUntil`, `forAddress`, `linkedProjectId`, `internalNotes`, `customerId`, `acceptHeaderBrand`, `acceptNotifyUserIds`, `coFields`, plus `customers` / `sendEmailOverride` (the email) and `cxOverrideFields` — and the attachment pair as `attDb`.
- **Writes:** `estimates` UPDATE `.eq('status','draft')`; leave-hook DELETE `.eq('status','draft')`.
- **Consumers:** the send flow and `publishCoToBidRoom` save first; the button row 4663–4698 shows `draftAutosave.status`.
- **Tests:** `estimateDraftPersist.test` (the payload, the held dates), `estimateFreshDraftDiscard.test`, `autosaveDateHold`, `useJobFormAutosaveSlice.render.test` + `.lifecycle.render.test`.
- **Status:** **out, v2.7627**, in one piece inside `useEstimateDetailData` — payload, `saveDraft`, both autosave paths and the leave hook are one mechanism and must not sit in two files. The page's smoke pins it: the debounced save writes with no reload, Save draft writes and reloads, an untouched fresh draft deletes itself on the way out and a touched or older one does not.

### `EstimateDetail` — send flow

- **Anchor:** `sendToCustomer` 2808–2870 — checks (held date, customer, the customer re-read when missing from the cache, an email by `SEND_EMAIL_RE`), then **routes**: a normal estimate above $0 sent by an office role (`GC_OFFICE_TEAM`) opens **Tell the customer** (`setTellEstimate`); a change order or a $0 total gets one confirm that names the recipient. `sendEstimateEmailAnswer(email, 'send' | 'resend')` 2878–2948 — saves first (skipping its reload), `fetch`es `send-estimate-to-customer` with a 20-second timeout, maps the answer to a `TellSendEmailAnswer` (`slow`, `already-went` with its time, `refused` with the resend verdict's words, or ok with the link), stores the link, copies it when no email went, then `load({ refresh: true })` outside the send's verdict. `sendEstimateEmail` 2951–2959 wraps it in toasts for the confirm path. `tellSheet` 3123–3149 is built above the loading early-return and keyed, so a refresh never unmounts it.
- **Owned state:** `sending`, `tellEstimate`, `lastAcceptUrl` (shared with the sent side and the CX section), `whatWentRevision` (bumped by the sheet's `onSent`).
- **Supabase / edge:** `customers` (one re-read), edge `send-estimate-to-customer` by direct `fetch`; the text leg (`quo-send`, the share link) lives inside `TellCustomerSheet`.
- **Tests:** `sendEstimateIo.test` (v2.7596, 15 cases: the request, the door, the reply's meaning) and `estimateSendPlan.test` (v2.7601, 12 cases: the recipient, the refusals, the sheet, the confirm's words). `tellCustomer.test` covers the sheet's side of the contract; `estimateLinkResend.test` the verdict.
- **Status:** inline, **medium risk and the one path that emails a customer**. Its two pure halves leave first: the answer mapping with the fetch as one client — **out, v2.7596** (`postSendEstimate` + `sendEstimateAnswerFrom` in [`lib/estimates/sendEstimateIo.ts`](../src/lib/estimates/sendEstimateIo.ts); the page is 5,362 lines) — and the routing as a send-plan kernel — **out, v2.7601** (`estimateSendPlan` + `estimateRecipientEmail` in [`lib/estimates/estimateSendPlan.ts`](../src/lib/estimates/estimateSendPlan.ts); the page is 5,356 lines). The handlers then move with the seam.

### `EstimateDetail` — sent-side actions (the cut that needs no seam)

- **Anchor:** `customerAcceptUrl` 2099–2105 + `copyCustomerAcceptUrl` 2158–2165 + `openCustomerAcceptUrl` 2167–2173 (`withEstimatePreviewMarker`); `declineVerdict` 2179 + `recordStaffDecline` 2180–2201 (RPC `record_estimate_decline`); `extendVerdict` 2209–2212 + `remailCustomerLetter` 2221–2242 (edge, `mode: 'remail'`) + `extendGoodThrough` 2243–2271 (RPC `extend_estimate_good_through`, then the letter when ticked); `resendVerdict` 2273–2280 + `copyResentUrl` 2287–2295 + `resendCustomerLink` 2302–2354 (edge, `mode: 'resend'`); `buildEstimatePdf` 2384–2395 + `estimatePdfFiling` 2396–2407; `openCreateJobModal` 2979–2982 and the unlink trio 2984–3015 (UPDATE `job_ledger_id = null`, gated `.eq('status','customer_accepted')`).
- **Owned state (8):** `recordingDecline`, `extendingGoodThrough`, `resending`, `resentInfo` (cleared per row, 2283–2285), `unlinkingJob`, `unlinkJobConfirmOpen`, `createJobModalOpen`, `detailCustomerSnapshotId`.
- **Shared, read only:** `row`, `user`, `role`, `customers`, `acceptancePreviewForLine`, `staffResolvedExperience`. **Shared, written:** `lastAcceptUrl` (setter) and `whatWentRevision` (bump); it calls `load` and `loadEstimateCustomerEvents`.
- **Why it is separable:** every handler returns early unless the row is sent or accepted, and none reads or writes the draft form cluster. The hook's whole input is `{ row, user, role, load, loadEvents, setLastAcceptUrl, bumpWhatWent }`.
- **Tests:** the verdict kernels (`estimateDecline`, `estimateLinkResend`, `estimateGoodThroughExtend`, `estimateViewPreview`, `estimatePaper`), and each control's render test; the handlers themselves have none.
- **Status:** **out, v2.7613** — `useEstimateSentActions({ row, user, role, load, loadEstimateCustomerEvents, setLastAcceptUrl, bumpWhatWent, showToast })` owns the six busy and window states and the handlers for decline, extend with the letter again, resend and unlink, moved verbatim (two RPCs, two sends, one UPDATE). Left in the page on purpose: `customerAcceptUrl` with its copy and open (the customer experience section reads them too), `buildEstimatePdf` / `estimatePdfFiling` (three mounts), `openCreateJobModal` and `createJobModalOpen` (the `?createJob=1` effect sets it), `detailCustomerSnapshotId` (the route reset clears it).

### `EstimateDetail` — sent / accepted / declined view (`!isDraft`, 4705–5035)

- **Render:** `EstimateWhatWent` 4707–4718; the locked notify-recipients card 4719–4744; accepted → `EstimateCustomerDocument` + attachment 4745–4791, then `EstimateOfferedOptions accepted` 4792–4794; the customer line with `MessagesButton` and the snapshot link 4796–4835; accepted → the acceptance record (name, time, IP, signature image or typed line), Customer activity and the Job section (`#estimate-job`, Create job / Unlink job) 4836–4968; sent → activity, `EstimateResendLinkPanel`, `EstimateExtendGoodThroughPanel` (`#extend-good-through`), `EstimateCustomerAcceptLinkButtons`, `EstimateDownloadPdfButton`, `EstimateRecordDeclineControl` 4969–5017; declined → note, activity, Download PDF 5018–5033. The read-only header above it (3453–3511: the For line, the good-through line, the CO fields 3478–3496, `EstimateOfferedOptions` or `EstimateLineItemsTable` 3497–3509) draws for sent, declined and superseded rows.
- **Shared state read:** `row`, `customers`, `estimateCustomerEvents(+Loading)`, `acceptNotifyResolvedUsers`, `acceptorSignatureSignedUrl` (also read by the CX Page tab), `rowOfferedOptions` 2119, `acceptanceDocHeaderBrand` 2123, `staffResolvedExperience`, `customerAttachmentPreview`, `coFields`, `whatWentRevision`, `loading`.
- **Modals that come with it:** the unlink confirm 5338–5393 (an inline `role="dialog"`), `CreateJobFromEstimateModal` 5395–5409 (`onSuccess` → `tieEstimateTextsToJob`, then `load()`, then `/jobs?edit=<jobId>`), `CustomerSnapshotModal` 5410–5415.
- **Tests:** render tests for the resend, extend, PDF, offered-options, What went, customer-document and create-job pieces; `estimateAcceptedRecord.test`, `whatWent.test`, `acceptLinkTie.test`.
- **Status:** inline, **medium risk**, read-mostly, and **the part of the page that grows** (six of the last seven features landed here). **Out, v2.7613**: `EstimateSentView` takes `row`, the read-only values and the `useEstimateSentActions` bundle as `actions`; the JSX is the page's own, with the Unlink job window moved in beside it, and the page is 4,571 lines. Two sentences changed shape, because `check:empty-words` reads a moved line as a written one: *No staff email recipients were set for this quote.* and *No link views or acceptance events recorded yet.* are drawn with `EmptyState`. The `#estimate-job` / `#extend-good-through` hash effect and the `?createJob=1` effect stay in the parent, which hands the view `openCreateJobModal`; `CreateJobFromEstimateModal` and `CustomerSnapshotModal` are still mounted by the page, and the read-only header (the For line, the good-through line, the options or the lines) moved to `EstimateSentHeader` in v2.7633, mounted where it was, above the draft editor's place.

### `EstimateDetail` — customer experience (`<details>`, 5037–5292)

- **Render:** the second `EstimateDraftCustomerGate` 5037 → `<details>` 5038; the accept-link buttons 5048 and, on an accepted row, Download PDF 5058; three tabs on `customerPreviewTab` — Email 5116–5164, Page 5166–5264 (`EstimateAcceptBody variant="staffPreview"`, the option-selection rehearsal, Open preview tab), Thank you 5266–5289 (`EstimateCustomerThankYou`).
- **Owned state:** `customerPreviewTab` only.
- **Shared state:** `cxOverrideFields` (**written here, persisted by the payload**), `previewSelectedOptionKeys` (also written by the option handlers and the customer view), `appCxSettings`, and read-only `row`, `title`, `terms`, `lines`, `totalCents`, `validUntil`, `syncedEstimateOptions`, `customerAttachmentPreview`, `acceptorSignatureSignedUrl`.
- **Memos:** `previewEmailTo` 2080–2093, `staffResolvedExperience` 2356–2376 (the frozen `customer_experience_sent` wins), `customerEmailPreview` 2410–2447 (`buildEstimateLetterheadEmail`, the edge function's own builder — also handed to the Tell sheet's Preview), `cxTemplateDefaults` 2449–2452.
- **Render fns:** `renderCxDraftSectionFields` 2459–2589 (the override editor, called once per tab), `openStaffAcceptCustomerPreview` 2129–2156 (writes the staff snapshot, opens `/estimate/customer-accept-preview/:number`).
- **Tests:** `estimateCustomerExperience.test` + `.co.test`, `estimateEmailLetterhead.test`, `estimateStaffAcceptPreview.test`; since v2.7622 `estimateCxOverrideSections.test` (14 cases) and `EstimateCxOverrideFields.render.test` (5), and three cases in the page smoke (the three previews, an override saved with the draft, a sent row's copy with nothing to edit).
- **Status:** **out, v2.7622** (the page is 3,888 lines). `EstimateCustomerExperienceSection` is the `<details>` and its three previews; the override editor is its own component, `EstimateCxOverrideFields`, over the kernel `lib/estimates/estimateCxOverrideSections.ts` (the config data and the three rules: the footer's empty override, the tick, a keystroke). `cxOverrideFields` and `previewSelectedOptionKeys` stay parent-owned and controlled, and so does `customerPreviewTab`, which outlives the page's reload there; `staffResolvedExperience`, `customerEmailPreview`, `previewEmailTo`, `cxTemplateDefaults` and `openStaffAcceptCustomerPreview` stay in the parent because the draft editor (headings), the sent view (headings, PDF) and the Tell sheet read them too. The gate around the section stays in the page.

### `EstimateDetail` — step rail + customer view

- **Anchor:** `railFlashStep` 2013, `customerViewOn` 2015, `railFlashTimerRef` 2016; `railData` 2017–2044 (`computeEstimateDraftSteps` over 11 inputs); `handleRailStepClick` 2046–2059; `railStepDot` 2062–2070 (called in the customer, change, cost, paper-extras and delivery sections). Render: `EstimateDraftStepRail` 3168–3179; the customer view 3515–3561 (`EstimateAcceptBody`), with the edit paper hidden, not unmounted, at 3562.
- **Tests:** `estimateDraftSteps.test`.
- **Status:** small and cross-cutting — stays in the parent; a section that leaves takes `railStepDot` and `railFlashStep` as props.

### `EstimateDetail` — draft customer picker (`isDraft`, 3180–3398)

- **Render:** `#est-step-customer` 3190 — `CustomerSearchCombobox` 3199, the selected-customer card 3215–3395 (email, the send-to override, phone, `CustomerNotesTable` 3376).
- **Owned state:** `customerSearch` (also written by the loader helpers), `emailOverrideRevealed`, `createCustomerOpen`, `customerNotesExpanded`; ref `sendEmailOverrideInputRef`; hook `useCustomerContactsForCustomer` 1341–1345.
- **Shared state:** `customerId`, `sendEmailOverride`, `customers`, `forAddress`, `title`; `customerSearchHighlight` and the gate refs (`requestCustomerFirst` 1879–1898).
- **Handlers:** `handleSelectCustomer` 2591–2603 (clears `forAddress`, drops the override when the customer has an email, re-derives a generic title), `handleCustomerSearchChange` 2605–2619, `openDraftCustomerForEdit` 1812–1836. The create-customer overlay 5294–5336 (`NewCustomerForm`) is its only modal.
- **Tests:** `estimateTitle.test`, `customerArchive.test`.
- **Status:** **out, v2.7633** — the section's JSX is `EstimateDraftCustomerSection`, fully controlled (33 values and setters handed in). The title derivation (`handleSelectCustomer`), the search handler, the Edit customer door, the notes read and its expanded state, and the create-customer overlay stay in the page: the page's reload unmounts the section, and the notes and the open Send to box are kept across it there.

### `EstimateDetail` — draft editor body (`isDraft`, 3513–4702)

- **Render (inside the first gate, 3399–4703):** the title chips row 3410–3448 draws for every status and stays in the parent. Then `AcceptHeaderBrandPicker` 3563 with four slots — `documentTitleSlot` 3566 (the title editor 3568–3648), `forFieldSlot` 3651, `expiresOnSlot` 3694 (the 7 / 15 / 30 presets), `lineItemsSlot` 3739: `EstimateFieldPhotosStrip` 3741, `EstimateFirstLookStrip` 3742, the CO block 3743–3799 (`#est-step-change`), the options strip 3800–3994, the Line items heading with the recents chips 4017–4056 (`#est-step-cost`), the catalog modal mount 4057, the CO empty prompt 4058–4093, the line rows 4101–4209, the add-line and catalog toolbar 4210–4300, the total 4303, the attachment preview card 4305–4358, Terms 4360–4398 (`#est-step-paper_extras`). After the picker: Supporting document 4400–4550, Delivery 4552–4660 (`#est-step-delivery`), the button row 4661–4702 (Save draft · autosave status · Send · Publish to bid room · Delete draft).
- **Estimate options strip (3800–3994):** option cards, name and pitch, **Offered as** (choice or add-on), ★ Recommended, **✓ Start ticked**, Remove. `lines` always holds the **viewed** option's lines; `syncedEstimateOptions` 1926–1929 re-merges them. Handlers 1931–1999: `switchViewedOption`, `addEstimateOption` (the first press turns one estimate into two options), `removeViewedOption` (down to one collapses back to a plain estimate), `patchViewedOption`, `setViewedOptionKind`. These five decide which lines each option saves; since v2.7605 they are pure steps in [`lib/estimates/estimateOptionsEditor.ts`](../src/lib/estimates/estimateOptionsEditor.ts) with tests, and the page's handlers apply the answer (the page is 5,325 lines).
- **Change-order block:** `coFields` (description, reason, impact on schedule, response-by) 3743–3799; the guided credit / added-work prompts over [`lib/coCostLinePrompt.ts`](../src/lib/coCostLinePrompt.ts); `publishCoToBidRoom` 3022–3062 (`pickBidRoomForChangeOrder`, save, RPC `publish_co_to_bid_room`, the `bid-room-changed` event).
- **Supporting document** — **out, v2.7618**: `EstimateSupportingDocumentFieldset` takes the label, the link and their setters, and the check's status, message and press. The check's state (`attachmentCheckStatus` / `attachmentCheckMessage`), `checkCustomerAttachmentUrl` and the reset on a URL change stay in the page: `load()` blanks the editor on every Save draft, and a component that owned the answer would lose it there. The fieldset's two non-draft branches sat inside the draft-only block, could never draw, and did not move.
- **Delivery** — **out, v2.7618**: `EstimateDeliverySection` draws *Email when customer accepts* (the self row and `SearchableMultiSelect` over `acceptNotifyOtherSelectOptions`, which moved in with `acceptNotifyOtherIds`), the Project `SearchableSelect` and Internal notes, every value the page's with its setter. `notifyUserOptions` and `projectsForPicker` are still loaded by the page and handed in, for the same reason as the check: a section that loaded them would read both again after every Save draft and flash an empty Project box. They are the seam hook's to own.
- **Tests:** `estimateDraftLines.test`, `estimateOptions.test` + the parity test, `estimateChangeOrder.test`, `coCostLinePrompt.test`, `estimateLineItemRecents.test`, `estimateNotifyOptions.test`, `changeOrderRoomPick.test`, `EstimateLineItemCatalogModal.render.test`; `checkGoogleDriveAttachmentUrl` untested.
- **Status:** inline, **high risk as one block — split it.** Supporting document and Delivery are out (v2.7618; the page is 4,315 lines). The options strip is out (v2.7624; 3,707 lines): its cards, ＋ Option and the viewed option's row are `EstimateOptionsStrip`, with the option state and the five handlers still the page's. The change-order fields and the line items are out (v2.7633; 1,781 lines). The remainder was not made an `EstimateDraftEditor`: what is left is slots and a button row over the page's own state, and a wrapper would only pass all of it through.

### `EstimateDetail` — page-level modals (5294–5417)

Create-customer overlay 5294–5336 → with the customer section. Unlink confirm 5338–5393, `CreateJobFromEstimateModal` 5395–5409, `CustomerSnapshotModal` 5410–5415 → with the sent view. Nothing here has two openers.

---

## Shared substrate

**There is no in-memory selection pointer. The URL is the pointer**: `/estimates/:number` selects the record, and the two page components never mount together and share no runtime state. The only hand-off is `navigate(..., { state: { freshEstimateDraft: true } })`, sent from three places: `createDraft` here, `useLeadDoors.ts` (Messages) and `useLookDoors.ts` (First look), both through `leadDoorsIo.startEstimate`.

Consequences:

1. The two page components decompose **independently**.
2. **Within `EstimateDetail`** the substrate is `row` (read by most of the component) + the ~18-field **draft form cluster** (`title`, `terms`, `lines`, `estimateOptions` / `viewedOptionKey` / `previewSelectedOptionKeys`, `coFields`, `customerId`, `sendEmailOverride`, `validUntil`, `forAddress`, `linkedProjectId`, `internalNotes`, the attachment pair, `acceptHeaderBrand`, `cxOverrideFields`, `acceptNotifyUserIds`) + the `customers` cache + `load()`. One function ties the cluster together: `buildDraftPersistPayload` is both the save payload and the autosave's dirty baseline.
3. **The cluster is a draft-only substrate.** The sent side reads `row` and never the cluster. That is the change from the first map, which put every detail region behind the seam: the sent-side actions and view, and the two controlled fieldsets, can leave **before** `useEstimateDetailData` exists.

### Route and URL state (stays in the parent)

- Detail: UUID → number redirect; `location.state.freshEstimateDraft`; `#estimate-job` and `#extend-good-through` (the Pipeline's passed chip) scroll after load, the second focusing its date field (1388–1404); `?createJob=1` (the Signed agreements email) opens Create job once for an accepted, unlinked row and strips itself (1306–1313).
- List: `?customer=<id>` filters `load()`; `?newEstimate=true&project=<id>` INSERTs once per mount and strips both params.
- Outbound: `/jobs?edit=<job_ledger_id>`, `/estimate/customer-accept-preview/:number`, the accept URL with the preview marker.

### Browser storage

- sessionStorage `estimate_accept_url:<estimateId>` through `estimateAcceptUrlSession.ts` (read in `load` and `customerAcceptUrl`, written by send, resend and remail).
- localStorage recents (`estimateLineItemRecents.ts`) and the staff accept-preview snapshot (`estimateStaffAcceptPreview.ts`).

### Role gating

No page-level gate; RLS scopes the rows (a primary sees their own, and the empty words say so). `ESTIMATE_CATALOG_EDITOR_ROLES` gates catalog **editing**; `canOpenBillingNotifications` gates the list's ⚙; `GC_OFFICE_TEAM` decides who gets the Tell sheet on a send; `MessagesButton` draws for `canOpenMessages` roles by itself.

### Supabase inventory (whole file)

The fact sheet lists no edge functions because the call is a `fetch`, since v2.7596 inside `sendEstimateIo.ts`.

| Table / function | Verbs | Region |
|---|---|---|
| `estimates` | SELECT (list + detail), INSERT (`createDraft`), UPDATE (`saveDraft` draft-gated; unlink accepted-gated), DELETE (`deleteDraft`, the leave hook, the bulk sweep — all draft-gated) | list + detail |
| `customers` | SELECT — the full list in `load` and `refetchCustomersAfterEdit`; one row in the send | detail |
| `users` | SELECT — notify options by role (+ self role, + devs), the master-technician default, the locked list's names | detail |
| `projects`, `app_settings`, `bid_proposal_rooms` | SELECT | detail draft / CX / CO |
| `estimate_customer_events` | SELECT — detail per row; list one chunked read | both |
| `estimates_thread_notes` + RPC `estimates_thread_note_stats` | via `useEstimateThreadNotes` | list Pipeline |
| RPC `record_estimate_decline`, `extend_estimate_good_through` | both through `(supabase as any).rpc` | detail sent |
| RPC `publish_co_to_bid_room` | SECURITY DEFINER; draft → sent | detail CO |
| storage `estimate-acceptor-signatures` | `createSignedUrl(path, 3600)` | detail accepted |
| edge `send-estimate-to-customer` | one `fetch`, in `postSendEstimate` (`lib/estimates/sendEstimateIo.ts`, v2.7596), from three callers: `sendEstimateEmailAnswer` (send, and resend from the sheet), `resendCustomerLink` (`mode: 'resend'`), `remailCustomerLetter` (`mode: 'remail'`) | detail |
| edge `check-estimate-attachment-url` | via `checkGoogleDriveAttachmentUrl` | detail attachment |
| through extracted children | `create_job_from_estimate`, `tie_message`, `replace_estimate_catalog_payload`, `share_estimate_link`, `sent_documents`, `quo-send` | modals, sheet, strips |

### Seam hook candidates

1. **`useEstimateSentActions`** — the sent-side handlers and their states. Needs nothing from the draft cluster. **Exists since v2.7613.**
2. **`useEstimateDetailData`** — `row`, `loading`, `load`, the `customers` cache, the hydrated form cluster, the reset and IO effects and **the persistence trio**. **Exists since v2.7627** (721 lines). The shared memos (`staffResolvedExperience`, `customerEmailPreview`, the rail) stayed in the page: they are screen, and nothing in the engine reads them.
3. **`useEstimateThreadNotes`** — exists; needs a test.

---

## Stage-A inventory (pure logic to `lib/` + tests, before any component moves)

The first map's inventory is **done** (v2.3866–v2.3868, v2.3870, v2.5864, v2.5870, v2.5871). These are what a fresh read finds still inline, ranked by what they guard.

| # | Candidate | Currently | Target | Tests to write |
|---|---|---|---|---|
| 1 | **Done (v2.7596): the send client and its answer.** Three hand-written `fetch`es of `send-estimate-to-customer` (session → JWT + anon key → POST → JSON), each reading the reply its own way | was 2221–2236, 2306–2338, 2884–2942 | `lib/estimates/sendEstimateIo.ts`: `postSendEstimate({ estimateId, mode, customerEmail?, timeoutMs? }, door?)` → no-session / slow / reply, + pure `sendEstimateAnswerFrom(httpOk, json)` → `TellSendEmailAnswer`; the browser is a `SendEstimateDoor` a test stands in for | ✓ 15 tests: the body per mode, the headers, no request with no session, the timeout only when asked, slow, a lost connection still throws; `already_sent` → already-went with its time; `not_draft` → the resend verdict's words; ok with and without `emailed` |
| 2 | **Done (v2.7601): the send plan** — who gets the Tell sheet, who gets the confirm, and its words | was `sendToCustomer` 2843–2867 | `lib/estimates/estimateSendPlan.ts`: `estimateSendPlan({ customerEmail, override, isChangeOrder, totalCents, role })` → refuse / sheet / confirm, with `SEND_EMAIL_RE` | ✓ 12 tests with row 5: no email, a bad email, each office role above $0 → sheet, a role outside the office → confirm, a change order → *Send for signature?*, $0 → *Send anyway* with the note, a credit change order with no note |
| 3 | **Done (v2.7605): the option editor's moves** — switch, add, remove, patch, set kind | was 1931–1999 | `lib/estimates/estimateOptionsEditor.ts`: pure steps over `{ options, viewedKey, lines, previewSelected }` (`switchViewedEstimateOption`, `addEstimateOptionToEditor`, `removeViewedEstimateOption`, `setViewedEstimateOptionKind`, `patchEstimateOption`, `syncedEstimateOptionsOf`), the key maker and the stub line passed in; the page's five handlers apply the answer | ✓ 19 tests: first Add makes two with the lines copied; a copy keeps its source's kind; remove to one goes back to a plain estimate; the star re-seats; an empty target opens on the stub line; the option being left keeps its typed lines; the cap |
| 4 | **Done (v2.7607): the hydration plan** — what a row opens as | was `load` 1634–1728, 1747–1755; `hydrateCustomerFieldsFromEstimate` 1572–1588 | `lib/estimates/estimateDetailHydration.ts`: `estimateFormFromRow(row, today)`, `defaultAcceptNotifyIds`, `customerFieldsFromEstimate(row, customers)`, `estimateInitialTitle(row, customers)`; `load()` keeps the reads, the redirect and the order it sets things in | ✓ 26 tests: today + 30 with the preset lit; a typed date re-detects its preset; a CO draft opens with no lines; options open on the recommended one; draft vs frozen attachment; the notify default and the locked list; the override is dropped when the customer has an email; the generic title |
| 5 | **Done (v2.7601): the recipient rule** — the customer's own email wins, else the typed override — was written four times, and a fifth in the hydration (row 4) | was 2022, 2073–2078, 2080–2093, 2843–2844 | `estimateRecipientEmail(customerEmail, override)` in `estimateSendPlan.ts`, read by the rail, the save, the preview and the send | ✓ both sources, neither, whitespace |
| 6 | The notify role list (eight roles, devs added for a dev) | effect 1466–1475 | a constant + loader in `estimateNotifyOptions.ts` | the list is asserted once |
| 7 | **Done (v2.7622):** CX override config (`CX_FIELD_LABELS`, `CX_OVERRIDE_SECTIONS`) and the editor's three inline rules | was 309–374 and inside `renderCxDraftSectionFields` | `lib/estimates/estimateCxOverrideSections.ts`: the data, `cxFooterHidden`, `cxWithFooterHidden`, `cxOverridesAfterEdit` | ✓ 14 tests: every section key has a label and sits in one section; a real change is kept; a field cleared or typed back to the default drops out; the cap; the footer's empty override and its tick |
| 8 | Imported libs with no test yet | — | `addCalendarDaysYmd`, `formatEstimateListUpdated`, `estimateCatalogApi`, `checkGoogleDriveAttachmentUrl`, `estimateMasterUser`, `useEstimateThreadNotes`, `estimateTextsTieIo` | — |

### Cross-surface duplicates

- **The raw-`fetch` edge family** — row 1 is this page's share of the playbook's [edge-function call helper](./PAGE_DECOMPOSITION_PLAYBOOK.md#cross-surface-seams) seam (JWT + apikey → `!res.ok || !json.ok` → `json.error`), shared with `PeopleContractsTab`, `LienWaiverSendModal`, `BidRoomPanel` and the contract-form modals. Build the estimates client so the generic POST step can be lifted out of it later.
- **The draft INSERT** — `createDraft` 786–806 and `leadDoorsIo.startEstimate` build the same row (`title: ''`, the stub line, `total_cents: 0`); the second adds `customer_id` and `first_look_id`. One `estimateDraftInsertRow(kind, { projectId?, customerId?, firstLookId? })` would serve both.
- **`formatMoney(cents)`** — imported here from `estimateListRows.ts`; it is one of the five cents formatters the playbook's money-format seam counts. Not this map's to merge.
- **The customers list SELECT** — the same eight columns are spelled three times (1742, 1794, 2822).

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during a move)

1. **Every status-changing write is status-gated**: `saveDraft`, `deleteDraft`, the leave-hook DELETE and the bulk sweep carry `.eq('status','draft')`; the unlink carries `.eq('status','customer_accepted')`. They guard against the customer accepting mid-edit. Draft → sent for a bid-room CO goes through RPC `publish_co_to_bid_room` because `estimates_update_draft` pins the status.
2. **UUID → number redirect** uses `replace: true`, and compares `String(r.estimate_number) !== routeSegment` inside the UUID branch.
3. **The accept URL is session-scoped by design**: `lastAcceptUrl` + sessionStorage, never the database. `customerAcceptUrl` is null in another session and for any status but sent or accepted.
4. **A draft's accept-notify default is self + every master technician**, only when the column is `NULL`; a failed read falls back to self alone. A sent row shows the locked list.
5. **Title auto-derivation is conditional** (`shouldReplaceTitleOnCustomerChange`): a customer pick overwrites only a generic title or the previous customer's default; `load()` applies the same to a generic-titled draft with a customer. The payload persists `title.trim()` or the kind's fallback.
6. **Two autosave paths.** (a) A customer-link change: `prevCustomerIdForAutosave` with an `undefined` first-run sentinel, `saveDraft({ quiet: true })` **with** a reload, deps deliberately short. (b) The debounced slice: 1500 ms over the payload's JSON, `saveDraft({ quiet: true, skipReload: true })`, `jobId` gated on `!loading` so the baseline is post-hydration, off while saving, sending or the attachment URL is invalid, flushed when the tab hides.
7. **A half-typed date is held, not saved** (v2.4246): the payload leaves it out, Save draft says so every time and the autosave once per box (`toldHeldDraftDatesRef`), and neither Send nor Publish goes out past one.
8. **A draft's `valid_until` defaults to today + 30** with that preset lit; a non-draft never shows presets.
9. **Attachment and CX duality**: a draft edits the live columns; a sent row reads the frozen `customer_attachment_sent` / `customer_experience_sent`.
10. **`accept_page_footer: ''` is a meaningful override** (hide the footer for this quote); blank does not remove it.
11. **Send ordering**: the pre-send `saveDraft` skips its reload; exactly one `load({ refresh: true })` follows the edge call, outside the send's verdict, so a page that fails to refresh never reads as a send that failed, and the keyed Tell sheet stays mounted for its receipt. No email but a link → the link is copied. The attachment's Check link never blocks a send.
12. **Three resend-shaped paths differ on purpose.** The sheet's *Send the link again* (`sendEstimateEmailAnswer(…, 'resend')`) has the 20-second timeout and answers in words; the panel's `resendCustomerLink` has no timeout, needs `accept_url` in the reply and shows the URL once (`resentInfo`); `remailCustomerLetter` throws, keeps the same link and moves nothing on the row. The shared client (`postSendEstimate`, v2.7596) keeps each caller's handling: the timeout is the caller's to pass, and each caller still reads the reply itself.
13. **`record_estimate_decline` and `extend_estimate_good_through` are called through `(supabase as any).rpc`** — the generated types were behind when they shipped. Typing them is its own change, not part of a move.
14. **Line money**: `updateLine` → `patchDraftLine(…, { allowNegative: isCO })`; a CO credit line renders negative; quantities ≤ 0 coerce to 1 (`estimateDraftLines`).
15. **An empty estimate draft hydrates to the stub line; an empty CO draft to no lines**, so Impact on cost opens on the guided prompt. With options, `lines` is the recommended option's.
16. **`lines` is the viewed option's lines** while options exist; a switch folds them into the option being left first. A CO never carries options. The payload mirrors the ★ option into the legacy fields.
17. **Pipeline buckets**: Declined has its own bucket, drawn only when non-empty; superseded rows are omitted; signed bid-room proposals are skipped; empty drafts collapse behind the sweep button.
18. **One `listSearch` serves both list tabs** through two inputs.
19. **The list caps at 200 rows**, newest first, and the Ledger's filters and totals — *All time* included — are computed over those 200.
20. **`customers` is loaded whole and unpaginated**; `filterActiveCustomersForPicker` keeps an archived-but-selected customer visible.
21. **`EstimateDraftCustomerGate` is mounted twice** (3399, 5037) on the same `draftNeedsCustomer` / `requestCustomerFirst` pair; the toast is throttled to one per 700 ms.
22. **Fresh drafts delete themselves on leave** (v2.2885). The leave hook is **keyed on `routeSegment`**, not `row.id`: its cleanup runs while state is still the old row's. Every write stamps `committedDraftRowIdRef`. A hard reload cannot run it; the sweep catches those.
23. **The customer view hides the edit paper (`display: none`, 3562)** instead of unmounting it, so field state survives the toggle.
24. **Deep links that write or open once**: `?newEstimate=true&project=` (ref guard, params stripped first) and `?createJob=1` (deps `[row?.id]`, eslint-disable).
25. **`createDraft` inserts `title: ''`** so the customer pick can claim it as generic.
26. **The events refresh on window focus** runs only while sent or accepted; the loader itself also runs for declined.

---

## Recommended extraction order (value ÷ risk)

The first pass's steps 1–3 are shipped and are not repeated here. From today's file:

1. **Stage A, one kernel per PR** — rows 1–4 of the [inventory](#stage-a-inventory-pure-logic-to-lib--tests-before-any-component-moves). **First: the send client and its answer (row 1)** — it is the only path that emails a customer, and it was written three times with no test — **shipped v2.7596**. Then the send plan (row 2, with the recipient rule, row 5) — **shipped v2.7601** — the option transitions (row 3) — **shipped v2.7605** — the hydration plan (row 4) — **shipped v2.7607**. Rows 1–5 of the inventory are done.
2. **`useEstimateSentActions` + `EstimateSentView`** — **shipped v2.7613**, 686 lines out (the handlers, the view, the activity section and the unlink window; the page is 4,571 lines), no seam needed, behind the page's render smoke (v2.7610). The read-only header and the two modals stayed, by the reasons in the dossier.
3. **The two controlled fieldsets** — **shipped v2.7618** in one PR: `EstimateSupportingDocumentFieldset` and `EstimateDeliverySection`, 256 lines out. Both came out fully controlled: the check's answer and the two loaders stay in the page until the seam, because the page's reload unmounts the editor.
4. **`EstimateCustomerExperienceSection`** — **shipped v2.7622**, 427 lines out with the override editor and the CX config; `cxOverrideFields`, `previewSelectedOptionKeys` and the preview tab stay controlled.
5. **`EstimateOptionsStrip`** — **shipped v2.7624**, 181 lines of JSX out over the kernel from step 1; the option state and its handlers stay in the page until the seam.
6. **The seam: `useEstimateDetailData`** — **shipped v2.7627**: `load` over the hydration kernel, the `customers` cache, the form cluster and **the persistence trio together**; no JSX moved; the page is 3,141 lines. Eight smoke cases were written against the unmoved page first — autosave, Save draft, the leave-discard three ways, the id redirect, a missing number, a send — and pass on the moved one with no edit. Not yet walked on a live throwaway draft: a customer change's autosave is the one path the smoke does not press.
7. **The draft sections against the seam** — **shipped v2.7633** in one PR: `EstimateDraftCustomerSection`, `EstimateChangeOrderFields`, `EstimateDraftLineItems` and, from the sent side, `EstimateSentHeader`; 612 lines out, the page is 1,781. No `EstimateDraftEditor` wrapper: see the draft editor body's status.
8. `EstimateList` → its own file — **shipped v2.7629** (`EstimatesListPage.tsx`, 746 lines out); `Estimates.tsx` is the router and the detail page.

After steps 1–5 the file is near 3,500 lines with the high-risk seam untouched; after 6–7, near 1,500.

**What stays in the parent:** the route split; the redirect and not-found navigation; the hash and `?createJob=1` effects; the title chips row; both gates and `requestCustomerFirst`; the rail (`railData`, `railStepDot`, `railFlashStep`, `customerViewOn`); `lastAcceptUrl`; `staffResolvedExperience` and `customerEmailPreview` (four readers); the keyed `tellSheet` above the loading early-return.

Definition of done per region, verification gates and anti-patterns: [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md).

---

## Hazards

- **The page's render smoke is the proof of a move.** `Estimates.render.test.tsx` (v2.7610, 10 cases) mounts the list, a draft, and a sent, an accepted and a declined row against a stateful Supabase stand-in, and presses Delete draft, Resend link, Extend and Unlink job, reading what each called. A cut that moves a region keeps it green unedited; a cut that moves a press the smoke does not reach adds its case first.
- **The page is hot and its growth lands on the sent side** — a feature train there collides with step 2. Check `npm run sessions` and the open PRs' files on the day.
- **The send path cannot be walked on prod without emailing someone.** Stage-A rows 1 and 2 are kernels for that reason; walk a move of the handlers on a ZZ test customer whose email is the sender's own.
- **`load()` blanks the tree; `load({ refresh: true })` does not.** A moved caller that swaps one for the other either unmounts the Tell sheet mid-send or leaves a stale editor after a save.
- **The leave hook judges the old row during a route change.** A seam that re-keys it on `row.id`, or that resets the form before the cleanup runs, deletes the wrong draft or none.
- **The autosave baseline is the payload's JSON.** Any change to the payload's key order or shape while moving it reads as "dirty" on every open draft and saves at once; `estimateDraftPersist.test` pins the shape — keep it green, unedited.
- **The fact sheet under-counts the sent side's IO**: it reports no edge functions (the `fetch` is in `sendEstimateIo.ts`) and cannot see the two `any`-typed RPC calls' arguments. Grep `functions/v1/` and `.rpc(` before trusting its Data line.
