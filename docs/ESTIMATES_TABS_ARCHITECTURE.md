# Estimates Tabs Architecture Map

---
file: docs/ESTIMATES_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the Estimates.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what every region of the 6,982-line src/pages/Estimates.tsx touches (state, loaders, handlers, sub-components, supabase tables/RPCs/edge functions, cross-region coupling, test coverage), identify the shared substrate, and set the recommended extraction order. Sections — What this surface is; Shared substrate; Master summary table; Per-region dossiers; Shared infrastructure; Test coverage; Stage-A pure-logic inventory; Preserve-quirks list; Recommended extraction order.
covers:
  - src/pages/Estimates.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

## What this surface is

**Line numbers in this map are "as of a05cef4c4" and rot — search the symbol; every region is anchored by symbol name and range.** Regenerate the facts with `npm run map -- src/pages/Estimates.tsx`.

[`src/pages/Estimates.tsx`](../src/pages/Estimates.tsx) is **6,982 lines** (up from ~5,365 at v2.1088): 79 `useState`, 30 effects (29 `useEffect` + 1 `useLayoutEffect`), 26 `useMemo` + 12 `useCallback`, 15 `useRef`, 19 custom-hook calls; 11 components, 30 module functions, 74 local imports. Unlike Materials or Bids it is **not one tab-switched God component — it is two independent page components plus a 5-line router**:

```tsx
export default function Estimates() {
  const { id: routeSegment } = useParams<{ id: string }>()
  if (routeSegment) return <EstimateDetail routeSegment={routeSegment} />
  return <EstimateList />
}
```

| Component | Lines | useState | Effects | Memo/cb | Refs | Role |
|---|---|---|---|---|---|---|
| `EstimateCustomerActivityDetails` | 201–218 | 1 | 0 | 0 | 0 | controlled `<details>` |
| `EstimateDetailCustomerActivitySection` | 220–299 | 0 | 0 | 0 | 0 | presentational events list |
| `EstimateChangeOrderChip` / `EstimateLegacyChangeOrderTitleChip` / `EstimateBidProposalChip` | 632–701 | 0 | 0 | 0 | 0 | row/title chips |
| `EstimateDraftCustomerGate` | 915–939 | 0 | 0 | 0 | 0 | `inert` overlay |
| `EstimateListTable` | 1046–1471 (426) | 0 | 0 | 0 | 0 | ≥641px list |
| `EstimateListCards` | 1473–1868 (396) | 1 (`tapHintCardId`) | 0 | 0 | 1 | ≤640px list |
| `EstimateList` | 1872–2536 (665) | 14 | 5 | 11 | 1 | `/estimates` |
| `EstimateDetail` | 2538–6976 (4,439) | 63 | 25 | 27 | 13 | `/estimates/:id` |
| `Estimates` | 6978–6982 | 0 | 0 | 0 | 0 | router (default export) |

- **`EstimateList`** — `/estimates`. Two list tabs on `listTab: 'followup' | 'all'` (labels **Pipeline** and **Ledger**; `followup`/Pipeline is the default; DOM ids `estimates-tab-stages` / `estimates-tab-ledger`). The Ledger is a money view with its own kind/date/closed filters and a totals footer; the Pipeline has four buckets and an empty-draft sweep. Both render the module-level `EstimateListTable` / `EstimateListCards` (card variant via `useNarrowViewport640`).
- **`EstimateDetail`** — `/estimates/:id`, where `:id` is a quote number (canonical) or a UUID (redirected to the number, `replace: true`). This is the real God component (render alone is 4433–6975, 2,543 lines). It is **not** tab-switched: regions gate on `row.status` (`isDraft = row?.status === 'draft'`) and on doc kind (`isCO = isChangeOrderDocKind(row?.doc_kind)` — change orders reuse the whole page in CO mode), plus the Customer experience `<details>` with inner tab state `customerPreviewTab: 'email' | 'page' | 'thankyou'`.
- **Module-level shared layer** (180–1044, ~865 lines) — constants, CSS strings, `est*Button`/`estInput*` style factories, list-row and draft-line helpers, the CX override config, types, the three chips, the gate, and the two activity components.

**Stage-A maturity:** 19 components live in `src/components/estimates/` (5,402 lines); 15 are imported here (the other four — `CustomerAcceptanceRecordBody`, `EstimateOptionsPicker`, `EstimateSentDocumentModal`, `QuickEstimateWizard` — are used elsewhere). 35 `src/lib/*` modules are imported (21 named `*estimate*`, plus the change-order kernels `coCostLinePrompt` and `bidDocuments/changeOrderBridge`) plus two `supabase/functions/_shared` kernels (`estimateDecline`, `estimateLinkResend`). What remains inline is the list shell + both list renderers, the entire detail editor (options strip, CO block, line rows, catalog modal, attachment/delivery fieldsets, customer picker), the sent/accepted view, the CX section, and a residue of pure helpers.

**Churn:** **hot** — 58 commits in 90 days, last 2026-09-23 (3bdec1ac4, v2.3748). Since this map's last touch (e770fa53e, v2.3556) only that one commit landed; it moved `defaultEstimateTitle` / `isGenericEstimateTitle` out to [`lib/estimates/estimateTitle.ts`](../src/lib/estimates/estimateTitle.ts). The v2.1088 → a05cef4c4 growth (~+1,600 lines) is all feature work inside the two page components: change-order mode, the step rail + customer view, estimate options, draft autosave + fresh-draft discard, resend link / record decline, the Ledger money view, the empty-draft sweep, the linked-project picker and field photos. Extract between trains; check `npm run sessions` first.

### How to read a dossier

Each section lists: anchor (symbol + line range as of a05cef4c4), **owned local state** (moves with the region), **cross-region/shared state** (stays in the parent/seam), **derived memos**, **handlers/loaders**, **supabase tables/RPCs/edge functions**, **sub-components** (extracted vs inline), **external coupling**, **tests**, and **extraction status + risk + approach**. Coupling counts ("reads 37 / writes 22") are the fact sheet's per-block state reads/writes.

---

## Shared substrate

**There is no in-memory shared selection pointer** — no `setSharedBid` equivalent. The selection pointer **is the URL**: `/estimates/:number` selects the record, and `EstimateList` and `EstimateDetail` never mount together and share zero runtime state. UUID deep links (`isEstimateUuidSegment`) load by `id` then rewrite to `/estimates/:estimate_number` (`replace: true`) via [`lib/estimateRouteSegment.ts`](../src/lib/estimateRouteSegment.ts). The only cross-component handoff is `navigate(..., { state: { freshEstimateDraft: true } })` from `createDraft` (read by `locationFreshDraftRef`, 2546).

Consequences for extraction:

1. The two page components decompose **independently**; the only shared code is the module layer (→ `lib/` + a shared components/styles file, not a hook).
2. **Within `EstimateList`**, the shared engine is the extracted [`useEstimateThreadNotes`](../src/hooks/useEstimateThreadNotes.ts) (294 lines; `estimates_thread_notes`) plus the `rows` → `filteredRows` cache consumed by both tabs. Both tabs share one `listSearch` state and all four list modals — so list tabs are cheap to extract against props, but the modal openers stay in `EstimateList`.
3. **Within `EstimateDetail`**, the substrate is `row: EstimateDetailRow` (read by 8 effects + 49 other units) + the ~18-field draft form cluster (`title`, `terms`, `lines`, `estimateOptions`/`viewedOptionKey`/`previewSelectedOptionKeys`, `coFields`, `customerId`, `sendEmailOverride`, `validUntil`, `forAddress`, `linkedProjectId`, `internalNotes`, `customerAttachmentUrl/Label`, `acceptHeaderBrand`, `cxOverrideFields`, `acceptNotifyUserIds`) + the `customers` cache + `load()`. Since v2.2592 the cluster has a single consumer that ties it together: **`buildDraftPersistPayload` (3903–3927) is both the save payload and the autosave dirty baseline** (`useJobFormAutosaveSlice` diffs its JSON). Detail regions must therefore be extracted **against a seam** (`useEstimateDetailData` owning the cluster + the persistence trio), not piecemeal — this page's equivalent of Bids' `useBidPricingEngine`, and it does not exist yet.

---

## Master summary table

| Region | Anchor (as of a05cef4c4) | Size | Coupling | Risk | Status | Tests | Recommended action |
|---|---|---|---|---|---|---|---|
| Module shared layer | module scope 180–1044 | ~865 | consumed by everything in-file | low | inline (title helpers → lib v2.3748; `resolveMasterUserId` → `lib/estimateMasterUser.ts`; `splitFollowupRows` → `lib/estimatePipelineRefresh.ts`) | wrapped kernels tested; in-file helpers **untested** | Stage-A sweep → `lib/estimates/*`; styles → `components/estimates/estimatesPageStyles.ts` |
| List table + cards | `EstimateListTable` 1046–1471, `EstimateListCards` 1473–1868 (+ props/styles 985–1044) | 822 (+60) | props-only (`useAuth` role; cards own a tap hint) | **low** | inline (module-level) | kernels tested; no render smoke | **Extract first** — file move |
| List: Pipeline tab | `listTab === 'followup'` panel 2335–2501 | 167 JSX | med (thread hook, sweep, events chip, 4 buckets) | low-med | inline | `estimatePipelineRefresh.test`, `estimateOpenState.test`; e2e viewport smoke | Keep in the list shell |
| List: Ledger tab | `listTab === 'all'` panel 2270–2333 | 64 JSX | low (3 filter states + `ledgerRows`/`ledgerTotals`) | low | inline | `ledgerRowPasses`/`computeLedgerTotals` tested | Keep in the list shell |
| Detail: loader + hydration | `load` 2887–3073 + 16 hydration/reset/IO effects | ~450 | highest — `load` writes 23 states | high | inline | parse kernels tested; accept-notify default untested | Seam `useEstimateDetailData` |
| Detail: draft persistence | `buildDraftPersistPayload` 3903–3927, `saveDraft` 3929–3961, autosave/leave 3963–4051 | ~150 | highest — payload reads 16 states | high | inline (autosave slice hook extracted) | `estimateOptions`, `estimateFreshDraftDiscard`, `jobFormCloseFlush` tested; **payload untested** | Part of the seam; payload → pure kernel first |
| Detail: step rail + customer view | `railData` 3360–3387, `handleRailStepClick` 3389–3402, `railStepDot` 3405–3413; render 4439–4450, 4770–4816 | ~95 | med (`railData` 11 deps; `railStepDot` in 5 sections) | low-med | `EstimateDraftStepRail` extracted; wiring inline | `estimateDraftSteps.test` | Stays parent; pass `railStepDot`/`railFlashStep` down |
| Detail: draft customer picker | `isDraft` block 4451–4669 | 219 JSX + handlers | reads 9 / writes 7 | med-high | inline | title kernel tested; derivation rule untested | `EstimateDraftCustomerSection` after seam |
| Detail: title chips + read-only header | 4681–4719, 4724–4766 | 82 | low | low | inline | — | Title/chip header row renders for every status (drafts too) → stays in the parent; read-only header 4724–4766 moves with the sent view |
| Detail: draft editor body | `isDraft` block 4768–6296 | 1,529 JSX | reads 37 / writes 22 / 16 handlers | high | inline | pieces (see dossier) | Split into sub-sections below, then remainder last |
| ↳ Estimate options strip | `!isCO && isDraft` 5054–5220 + handlers 3269–3342 | 167 + 74 | med (`lines` = viewed option; 5 consumers) | med | inline | `estimateOptions.test`, parity test | `EstimateOptionsStrip` (controlled) |
| ↳ Change-order block | `isCO` 4997–5053, CO prompts 5645–5680 / 5804–5894, `addCoLine` 3147–3154, `publishCoToBidRoom` 4226–4265 | ~250 | low-med (`coFields` read by payload/rail/header/leave hook/customer view/accepted document) | low-med | inline | `estimateChangeOrder.test`, `coCostLinePrompt.test` | `EstimateChangeOrderFields` (controlled) |
| ↳ Line item catalog modal | `catalogModalOpen` 5283–5644 + handlers 4300–4422 | 362 + ~120 | **low** (only `applyFromCatalogEntry` crosses out) | **low** | inline | `estimateCatalogApi` untested; inline money untested | **Extract second** |
| Detail: sent/accepted/declined view | `!isDraft` block 6299–6600 | 302 JSX | reads 13 / writes 1 | med | inline; resend/decline/doc controls extracted | resend/decline/doc/create-job tests | `EstimateSentAcceptedView` |
| Detail: customer experience | gate + `<details>` 6602–6854 + `renderCxDraftSectionFields` 3717–3847 | 253 + 131 | med-high (`cxOverrideFields` written here, persisted by payload) | med | inline | CX / letterhead / preview kernels tested; override editor untested | `EstimateCustomerExperienceSection` |
| Detail: page-level modals | 6856–6975 | ~120 | med | — | mixed | `CreateJobFromEstimateModal.render.test` | Move with their only opener |
| Router | `Estimates()` 6978–6982 | 5 | — | — | done | — | Stays as-is |

---

## Per-region dossiers

### Module-level shared layer (180–1044)

- **Constants:** `ESTIMATE_CATALOG_EDITOR_ROLES` 180–188, `SEND_EMAIL_RE` 190, `ESTIMATE_EMAIL_FROM_ADDRESS` 195 (mirrors the `EMAIL_FROM` edge secret), `PREVIEW_EMAIL_ACCEPT_URL` 197, `ESTIMATE_ACCEPT_URL_SESSION_PREFIX` 199, `ESTIMATE_JOB_SECTION_HASH` 480, `ESTIMATES_PAGE_CLASS` 510, `DEFAULT_DRAFT_FIRST_LINE_ITEM` 804.
- **CSS + style factories:** `estimatesPageShellCss` … `estimateDetailLineItemRowCss` 513–599 (composed into `estimateDetailPageCss` 601 / `estimatesListPageCss` 603), `estimateListTableScrollWrapStyle` 606, `estInputBase`/`estInputBlock` 612–629, `estPrimaryButton` … `estSmallPrimaryButton` 703–775, `estimateListCreateJobButtonStyle`/`estimateDetailCreateJobButtonStyle` 483–508, `coPromptChipStyle`/`coPromptPanelStyle` 784–802.
- **Pure helpers (Stage-A residue):** list-row — `estimateListOptionsCount`/`estimateListAddOnCount`/`estimateListOptionsSuffix` 305–336 (cheap keyed-entry counters, capped at `MAX_ESTIMATE_OPTIONS`), `estimateDeclinedRowLabel` 354–360, `estimateLinkedJobHcp` 777–780, `formatMoney` 862, `withDispatchChip` 867–888 (JSX), `statusLabel` 890–905, `estimateListCustomerSubline`/`estimateListCustomerColumnLines`/`estimateListRowMatchesSearch` 941–983; detail — `estimateCustomerEventLabel` 338–351, `isUsableCustomerAcceptUrl`/`normalizeCustomerAcceptUrlCandidate` 365–382, `estimateAcceptNotifySeparatorLabel` 465–478, `isDefaultDraftStubShape`/`defaultDraftFirstLine`/`emptyDraftLine`/`emptyCatalogEditRow` 807–852, `lineItemsFromJson`/`sumLineItems` 854–860 (thin wrappers over [`lib/estimateLineItemNormalize.ts`](../src/lib/estimateLineItemNormalize.ts); `lineItemsFromJson(raw, allowNegative)` is CO-aware).
- **CX config data:** `CX_FIELD_LABELS` 384–401 (16 keys), `CX_OVERRIDE_SECTIONS` 413–444 (Email / Acceptance page / Thank you), `cxOverrideFieldRows` 446–449. Keys are `EstimateExperienceOverrideKey` from [`lib/estimateCustomerExperience.ts`](../src/lib/estimateCustomerExperience.ts).
- **Small components:** see the component table above.
- **Types:** `EstimateListCustomerEvent` 363, `EstimateRow`/`EstimateListRow`/`EstimateDetailRow`/`EstimateNotifyUserOption` 451–462, `LineItem` 781 (= `EstimateLineItemNormalized`), `EstimateListStagesThread`/`EstimateListTableProps` 985–1016, `EstimateListTab` 1870.
- **Gone from this layer since v2.1088:** `defaultEstimateTitle`/`isGenericEstimateTitle` (→ `lib/estimates/estimateTitle.ts`, v2.3748), `splitFollowupRows` + its sort (→ `lib/estimatePipelineRefresh.ts`), `resolveMasterUserId` (→ `lib/estimateMasterUser.ts`, imported as `resolveEstimateMasterUserId as resolveMasterUserId`; since v2.2972 it returns the company owner and no longer reads `master_assistants`).
- **Tests:** none for the in-file helpers (search, customer lines, options counters, status/money labels, accept-URL validation, draft-stub predicates).
- **Extraction status + risk + approach:** Inline; **low risk**. Pure helpers → `lib/estimates/*` with tests ([Stage-A inventory](#stage-a-pure-logic-inventory-extract-to-lib--tests-before-any-component-moves)); style factories + CSS strings → `components/estimates/estimatesPageStyles.ts` so both future page files import them.

### `EstimateListTable` + `EstimateListCards` (1046–1868)

- **Render location:** module scope; rendered by `EstimateList` at **10 call sites** (table vs cards per `narrowViewport640` × 5 buckets: Ledger, Pipeline Unsent / Sent / Declined / Accepted).
- **Owned local state:** table none; cards `tapHintCardId` (1488) + `tapHintTimerRef` (dead-tap hint via [`lib/tapHint.ts`](../src/lib/tapHint.ts)). Only hook: `useAuth()` for `estimateListViewerRole` (passed to `JobThreadNotesPanel`).
- **Props (the seam already exists, `EstimateListTableProps` 998–1016):** `rows`, `setAcceptanceModalEstimateId`, `setCreateJobFromListRow`, `showCustomerColumn?`, `onCustomerSnapshotRequest?`, `stagesThread?: EstimateListStagesThread` (thread-notes bundle), `sentOpenStateById?` (opened / never-opened chip), `declinedLabelById?`.
- **Inner render fns:** table `renderExpandButton` 1069–1102, `lastActivityBodyInteractiveProps` 1104–1136, `renderLastActivityCell` 1138–1210; cards `renderExpandControl` 1496–1529, `renderCustomerSection` 1531–1568, `renderStatusSection` 1570–1679, `renderLastActivitySection` 1681–1766.
- **Derived:** none memoized; per-row `formatEstimateListUpdatedLines`, `getDispatchNoteDisplayMeta`, `computeEstimateListReadiness`/`readinessDots`/`estimateDraftMeaningfulLineCount`, `computeSentWait`, `estimateListOptionsSuffix`, chips (`EstimateChangeOrderChip`, `EstimateBidProposalChip`, `EstimateLegacyChangeOrderTitleChip`, `withDispatchChip`).
- **Sub-components:** [`JobThreadNotesPanel`](../src/components/JobThreadNotesPanel.tsx) (**extracted**), `Link` rows to `/estimates/:number` and `/jobs?edit=<job_ledger_id>`.
- **Supabase:** none (all IO via props).
- **External coupling:** "Create job" and "Accepted — view" only call parent setters. `threadColSpan = 6 + (showCustomerColumn ? 1 : 0)` (1058).
- **Tests:** `estimatePipelineRefresh.test`, `estimateOpenState.test`, `tapHint.test`, `estimateDecline.test`; no render smoke; `formatEstimateListUpdated` untested.
- **Extraction status + risk + approach:** Inline module components. **Lowest risk on the page — extract first.** Pure file move to `src/components/estimates/EstimateListTable.tsx` (both components + props/thread types + the three `estimateListCustomer*` style constants 1018–1044 + `ESTIMATE_LIST_CUSTOMER_SNAPSHOT_BTN_CLASS`/`estimatesListCustomerSnapshotBtnCss` 544–550 + the list-only `EstimateBidProposalChip`). `EstimateChangeOrderChip` and `EstimateLegacyChangeOrderTitleChip` are also rendered by the detail title row (4681–4719), so they go to a shared `components/estimates/EstimateKindChips.tsx`, not into the list file. Their pure row helpers go Stage-A to `lib/estimates/estimateListRows.ts` in the same wave; add a `EstimateListTable.render.test.tsx`.

### `EstimateList` — Pipeline + Ledger tabs (1872–2536)

- **Render location:** whole component when the route has no `:id`; render 2153–2535. Header (⚙ dev-master 2159–2181, New change order, New estimate; ~2156–2195) + settings modal 2196–2198; tablist 2199–~2230; `?customer=` banner 2231–2268; Ledger panel 2270–2333 (`aria-labelledby="estimates-tab-ledger"`); Pipeline panel 2335–2501; four modals 2503–2535.
- **Owned local state (14):** `listTab` (default `'followup'`), `ledgerKind` (`LedgerKindFilter`, `'all'`), `ledgerDays` (90), `ledgerIncludeClosed`, `acceptNotifySettingsOpen`, `listSearch` (**one state for both tabs**), `rows`, `loading`, `creating`, `acceptanceModalEstimateId`, `createJobFromListRow`, `customerSnapshotId`, `listCustomerEvents` (1951), `cleaningEmpties` (2009). Ref `newEstimateParamFiredRef` 2063.
- **Shared engine (extracted hook):** `useEstimateThreadNotes(showToast, user?.id, profileName)` (1895) → bundled into `estimatesStagesThread` (2140–2151) and passed only to Pipeline buckets.
- **Derived memos:** `filteredRows` 1941, `followupBuckets` 1946 (`splitFollowupRows`: Unsent / Sent / **Declined** (own bucket, rendered only when non-empty) / Accepted; superseded omitted; signed bid-room proposals skipped), `eventRowIdsKey` 1952, `sentOpenStateById` 1986, `declinedLabelById` 1993, `emptyDraftIds`/`unsentVisibleRows` 2001–2008 (`isEmptyEstimateDraft`), `ledgerRows` 2011 (`ledgerRowPasses` kind / closed / window), `ledgerTotals` 2017 (`computeLedgerTotals`: accepted this month, outstanding sent, accepted-not-on-a-job).
- **Handlers/loaders:** `load` 1912–1935 (`estimates` SELECT `*, customers(name, address, contact_info), jobs_ledger(hcp_number)`, optional `?customer=` filter, `updated_at` desc, **limit 200**); events effect 1956–1985 (one chunked `estimate_customer_events` fetch for every sent + declined row via `fetchAllRowsChunkedIn` + `groupEventsByEstimateId`; best-effort); `cleanUpEmptyDrafts` 2019–2041 (confirm dialog, bulk DELETE `.in('id', emptyDraftIds).eq('status','draft')`); `createDraft(projectId?, docKind, trigger)` 2080–2127 (company-owner via `resolveMasterUserId`; INSERT `title: ''`, `line_items_snapshot: [defaultDraftFirstLine()]` for estimates / `[]` + `doc_kind: 'change_order'` for COs; `estimate_draft_created` telemetry; navigates with `state.freshEstimateDraft`); `toggleEstimateThreadExpanded` 1908. Effects: load 1937; 320ms-debounced thread-stats refresh 2044–2051 (Pipeline only); collapse thread off-Pipeline 2053–2055; `?newEstimate=true&project=<id>` deep link 2064–2078.
- **Supabase:** `estimates` (SELECT, INSERT, bulk DELETE), `estimate_customer_events` (chunked SELECT), `estimates_thread_notes` (via hook). Modals do their own IO (`CreateJobFromEstimateModal` → `create_job_from_estimate`; `CustomerAcceptanceRecordModal`; `EstimateAcceptedNotifySettingsModal` → `lib/estimateAcceptedNotify.ts`).
- **Sub-components:** `EstimateListTable`/`EstimateListCards` (in-file), `EstimateAcceptedNotifySettingsModal`, `CustomerAcceptanceRecordModal`, `CustomerSnapshotModal`, `CreateJobFromEstimateModal` (all **extracted**).
- **External coupling:** `?customer=<id>` (mirrors Jobs) with a Clear-filter banner; `?newEstimate&project` from the Projects card; `CreateJobFromEstimateModal.onSuccess` → `load()` then `/jobs?edit=<jobId>`; primary-role empty-state label (2134–2138).
- **Tests:** `estimatePipelineRefresh.test` (buckets, ledger filters/totals, empty-draft rule, sent wait), `estimateOpenState.test`, `supabasePaging.test`, e2e `viewport-smoke.spec.ts` (`/estimates` marker only). `useEstimateThreadNotes` and `estimateMasterUser` untested; no render smoke.
- **Extraction status + risk + approach:** Inline. **Low-medium risk.** Once table/cards move out the shell is ~665 lines — fine to leave, or move whole (`EstimatesListPage`) rather than per tab: the tabs share `listSearch`, `filteredRows`, all four modals and the empty-state label. The Ledger's three filter states are tab-local and could ride into an `EstimatesLedgerPanel` if the shell is ever split.

### `EstimateDetail` — loader + hydration (the future seam)

- **Not a render region:** `load` 2887–3073 (UUID/number fetch, redirect, then writes 23 states incl. `loading` and `row`) + `hydrateCustomerFieldsFromEstimate` 2869–2885 + `refetchCustomersAfterEdit` 3087–3111 + `openDraftCustomerForEdit` 3113–3137 + effects: `?createJob=1` 2592–2599, customer-change resets 2656/2713, `routeSegment` reset 2660–2672, attachment-check reset 2674–2677, `#estimate-job` hash 2679–2687, signature signed URL 2689–2711, notify options 2735–2782 (→ `notifyUserOptions`, read only by the draft editor's `acceptNotifyOtherSelectOptions`), `app_settings` 2784–2802, recents 2804–2810, catalog load 2731–2733, events 2849–2858, load 3075–3077, CX overrides re-hydrate 3079–3085, lazy projects 3885–3896. The `routeSegment` reset also clears region-owned state (`draftTitleEditing`, `validUntilPreset`, `attachmentCheckStatus`/`Message`, `detailCustomerSnapshotId`), so an extracted region resets those itself or is keyed on `routeSegment`.
- **What `load` does (one pass):** fetch `estimates` (`*, jobs_ledger(hcp_number)`) by `id` or `estimate_number`; invalid/not-found → toast + `/estimates`; UUID → number redirect; stamp `freshDraftRowIdRef` when navigated with the fresh marker; hydrate `acceptHeaderBrand`, `terms`, **options** (`normalizeEstimateOptionsFromJson`; COs never have options; `viewedOptionKey` = recommended; `previewSelectedOptionKeys` = `defaultEstimateSelection`), `lines` (viewed option's lines, else snapshot; empty non-CO draft → `[defaultDraftFirstLine()]`), `coFields` (`parseEstimateChangeOrderFields`), `customerId`, `validUntil` + preset (draft default today+30), `forAddress`, `linkedProjectId`, `internalNotes`, accept-notify ids (draft null → self + all `master_technician`) and resolved display users (non-draft), attachment fields (draft live vs frozen `customer_attachment_sent`), `lastAcceptUrl` from sessionStorage (sent/accepted), then the full `customers` list (unpaginated) and a derived default title for generic-titled drafts with a customer (`defaultEstimateTitle(name, isCO)`).
- **Supabase:** `estimates`, `users` (notify role list + self role + devs; master_technician defaults; notify display), `customers`, `projects` (lazy picker), `app_settings` (`ESTIMATE_EXPERIENCE_APP_KEY_LIST`), `estimate_customer_events` (sent/accepted/declined; focus-refresh only sent/accepted), storage `estimate-acceptor-signatures` (`createSignedUrl(path, 3600)`), `estimate_catalog_items` (via `fetchEstimateCatalogLive`).
- **Tests:** `estimateRouteSegment.test`, `estimateAcceptHeaderBrand.test`, `estimateCustomerAttachment.test`, `estimateOptions.test`, `estimateChangeOrder.test`, `estimateTitle.test`, `customerArchive.test`; untested: `addCalendarDaysYmd`/`presetMatchingTodayOffset`, the accept-notify default branch, the fresh-marker stamp.
- **Extraction status + risk + approach:** **This is the seam, not a component.** Extract into `src/hooks/useEstimateDetailData.ts` returning `{ row, loading, load, customers, customersLoading, refetchCustomersAfterEdit, …all hydrated field states + setters, the shared memos }`; `EstimateDetail` destructures it so downstream references are unchanged. **High risk** if attempted with regions still inline; do it before any draft-cluster component move. The `#estimate-job` hash effect and the `?createJob=1` effect stay in the parent.

### `EstimateDetail` — draft persistence (autosave, save, leave hook)

- **Anchor:** `buildDraftPersistPayload` 3903–3927, `saveDraft({ quiet?, skipReload? })` 3929–3961, customer-link autosave effect 3963–3977, `useJobFormAutosaveSlice` wiring 3984–3996, fresh-draft leave hook 4003–4041, visibility flush 4042–4051. Refs `freshDraftRowIdRef` 2550, `committedDraftRowIdRef` 2552, `prevCustomerIdForAutosave` 2654, `draftAutosaveFlushRef` 3995, `freshDraftLeaveRef` 4003.
- **Reads:** 16 states via the payload — 13 directly (`title`, `terms`, `lines`, `estimateOptions`, `viewedOptionKey`, `validUntil`, `forAddress`, `linkedProjectId`, `internalNotes`, `customerId`, `acceptHeaderBrand`, `acceptNotifyUserIds`, `coFields`) + `customers`/`sendEmailOverride` via `resolveCustomerEmailForPersist` + `cxOverrideFields` via `buildCustomerExperienceOverridesPayload` — plus derived `totalCents`; callers pass the normalized attachment (`customerAttachmentUrl/Label`) as `attDb`.
- **Writes:** `estimates` UPDATE `.eq('status','draft')`; leave-hook DELETE `.eq('status','draft')`.
- **Consumers:** `sendToCustomer` and `publishCoToBidRoom` call `saveDraft` first; the button row shows `draftAutosave.status` (6258–6273).
- **Tests:** `estimateOptions.test` (`estimateOptionsDraftPersistFields`), `estimateFreshDraftDiscard.test`, `jobFormCloseFlush.test` (used by the slice hook); the slice hook itself and **`buildDraftPersistPayload` are untested** — it is the exact DB write and carries money (`total_cents`).
- **Extraction status + risk + approach:** Inline. **High risk.** Stage A first: `buildDraftPersistPayload` → pure `buildEstimateDraftPersistPayload(fields, attDb)` + test. Then it moves into the seam hook together with `saveDraft`, both autosave paths and the leave hook — they must not be split across files.

### `EstimateDetail` — step rail + customer view

- **Anchor:** state `railFlashStep` 3356, `customerViewOn` 3358, `railFlashTimerRef` 3359; `railData` 3360–3387 (`computeEstimateDraftSteps` over 11 deps; line count via `countMeaningfulEstimateLines` so the seeded $0 stub never ticks Line items); `handleRailStepClick` 3389–3402 (scroll to `#est-step-<key>`, focus the combobox for `customer`, 2600ms flash); `railStepDot` 3405–3413 (called in the customer, change, cost, paper_extras and delivery sections). Render: `EstimateDraftStepRail` 4439–4450; customer view 4770–4816 (`EstimateAcceptBody` pixel-true preview; the edit paper stays mounted but `display: none`, 4817).
- **Sub-components:** [`EstimateDraftStepRail`](../src/components/estimates/EstimateDraftStepRail.tsx) (**extracted**, 284 lines).
- **Tests:** `estimateDraftSteps.test`; no rail render test.
- **Extraction status:** wiring is small and cross-cutting — stays in the parent; extracted sections receive `railStepDot` + `railFlashStep` as props.

### `EstimateDetail` — draft customer picker (`isDraft` block 4451–4669)

- **Render location:** `{isDraft && (...)}` at the top of the return (`#est-step-customer`) — customer combobox, selected-customer card 4486–4666 (email / send-to override / phone / notes), edit-customer link.
- **Owned local state:** `customerSearch` (also written by the loader helpers `hydrateCustomerFieldsFromEstimate` / `refetchCustomersAfterEdit` / `openDraftCustomerForEdit` — seam-writable), `emailOverrideRevealed` (reset on `customerId`), `createCustomerOpen`, `customerNotesExpanded` (reset on `customerId`); ref `sendEmailOverrideInputRef`.
- **Cross-region/shared state:** `customerId`, `sendEmailOverride` (payload, rail, preview, send), `customers` + `customersLoading`, `forAddress`, `title`, `row`, `railFlashStep`; `customerSearchHighlight` (set by the parent's `requestCustomerFirst`, cleared by the `customerId` effect 3243–3250) and refs `customerSearchSectionRef` (also used by `handleRailStepClick`), `lastCustomerGateToastAt`, `customerGateHighlightTimerRef` stay with the gates and come in as props.
- **Derived:** `selectedCustomer` 3344, `crmEmailForSelected` 3353, `showSendEmailOverride` 3414, `draftNeedsCustomer` 3155 (drives both gates), notes-preview derivations 2638–2645.
- **Handlers:** `handleSelectCustomer` 3849–3866 (clears `forAddress`, clears override when CRM email exists, **title auto-derivation** for drafts), `handleCustomerSearchChange` 3868–3882, `openDraftCustomerForEdit` 3113–3137 (via `useEditCustomerModal`), `requestCustomerFirst` 3222–3241 (700ms toast throttle, scroll + pulse, focus), `resolveCustomerEmailForPersist` 3416–3421.
- **Hooks:** `useCustomerContactsForCustomer(customerNotesQueryCustomerId, …)` (2633) — only while draft + customer selected.
- **Sub-components:** `CustomerSearchCombobox`, `CustomerNotesTable` (**extracted**), `filterActiveCustomersForPicker` (lib); `NewCustomerForm` in the create-customer modal (6856–6897) feeds `handleSelectCustomer`.
- **Tests:** `estimateTitle.test`, `customerArchive.test`; the title-derivation rule itself is untested inline logic.
- **Extraction status + risk + approach:** Inline. **Medium-high risk** — title derivation + both autosave paths interplay. Extract after the seam → `EstimateDraftCustomerSection` (with the create-customer modal); `customerId`, `sendEmailOverride`, `customers`, `title`, `forAddress` stay parent-owned controlled props; both gates + the autosave effects stay in the parent.

### `EstimateDetail` — draft editor body (`isDraft` block 4768–6296)

- **Render location (inside the first `EstimateDraftCustomerGate` 4670–6297):** customer view 4770–4816; `AcceptHeaderBrandPicker` 4818 with four slots — `documentTitleSlot` 4821 (title editor 4823–4903), `forFieldSlot` 4906 (no-customer hint 4908–4921), `expiresOnSlot` 4949 (7/15/30 presets), `lineItemsSlot` 4994–5990 (`EstimateFieldPhotosStrip` 4996, CO block 4997–5053, options strip 5054–5220, Line items / Impact on cost heading + recents chips 5243–5282, catalog modal 5283–5644, CO empty prompt 5645–5680, line rows 5688–~5800, add-line / catalog toolbar 5804–5894, attachment preview card 5899–5952, Terms (`#est-step-paper_extras`) 5953–5989); Supporting document fieldset 5994–6144 (editable 6008–6107); Delivery section (`#est-step-delivery`) 6145–6247 — Email when customer accepts fieldset 6153–6219 (self row 6171–6201 + `SearchableMultiSelect`), Project `SearchableSelect` 6222–6235, Internal notes 6238–6246; button row 6248–6295 (Save draft · autosave status · Send · Publish to bid room (CO with `bid_id`) · Delete draft).
- **Coupling:** reads 37 / writes 22 states, 16 handlers (fact sheet).
- **Owned local state:** `draftTitleEditing` (+ `titleInputRef`, focused via `useLayoutEffect` 2717–2720), `validUntilPreset` (also hydrated by `load` — seam-writable), `attachmentCheckStatus`/`attachmentCheckMessage`, `catalogIconHovered` (toolbar, not the modal; reset by effect 2865–2867), `lineItemRecentIds` (localStorage-backed), `coFocusLineIndexRef`, `projectsForPicker`.
- **Cross-region/shared state:** the whole draft form cluster (see substrate), `saving`, `sending`, `customerViewOn`, `railFlashStep`, `catalogLineItems`, `staffResolvedExperience` (headings), `customerAttachmentPreview`, `notifyUserOptions` (loaded by the seam's notify-options effect).
- **Derived memos:** `totalCents` 3267 (plain `sumLineItems(lines)`), `syncedEstimateOptions` 3269–3272, `lineItemRecentChips` 4300–4306, `customerAttachmentPreview` 3252–3265, `customerAttachmentUrlIsCheckable` 3266, `acceptNotifyOtherSelectOptions` 3157–3215 (masters → Assistants → Superintendents → Everyone else), `acceptNotifyOtherIds` 3217–3220.
- **Handlers:** `updateLine` 4283–4298 (qty ≤0/NaN → 1; `computeEstimateLineExtendedCents(q, unit, { allowNegative: isCO })`), add/remove line, `applyFromCatalogEntry` 4344–4365, option handlers 3274–3342, `addCoLine` 3147–3154, `sendToCustomer` 4053–4163, `checkCustomerAttachmentUrl` 4165–4181 (→ edge `check-estimate-attachment-url`; hint only), `publishCoToBidRoom` 4226–4265, `deleteDraft` 4267–4281 (confirm dialog; DELETE draft-gated).
- **Estimate options strip (5054–5220):** option cards, name + pitch, **Offered as** (choice · add-on via `setEstimateOptionKind`), ★ Recommended (`setRecommendedEstimateOption`; blocked on an add-on while a choice exists), Remove. `lines` always holds the **viewed** option's lines; save mirrors the ★ option into the legacy fields via `estimateOptionsDraftPersistFields`. Kernels: [`lib/estimates/estimateOptions.ts`](../src/lib/estimates/estimateOptions.ts), [`estimateAcceptedRecord.ts`](../src/lib/estimates/estimateAcceptedRecord.ts); [`estimateAcceptSelection.ts`](../src/lib/estimates/estimateAcceptSelection.ts) is not imported here — it reaches the page only through `EstimateAcceptBody`.
- **Change-order block:** `coFields` (description / reason / impact on schedule / response-by) 4997–5053; guided credit/added-work prompts via [`lib/coCostLinePrompt.ts`](../src/lib/coCostLinePrompt.ts); credit lines render negative (`isCoCreditLine`); `publishCoToBidRoom` picks the open `bid_proposal_rooms` row (customer match → sole room → customer-less room), `saveDraft`, then RPC `publish_co_to_bid_room`, dispatches `bid-room-changed`.
- **Supabase/edge:** `estimates` (UPDATE/DELETE), `customers` (single re-fetch in send), `projects`, `bid_proposal_rooms`, RPC `publish_co_to_bid_room`, edge `send-estimate-to-customer` (direct `fetch`, 4118), `check-estimate-attachment-url` (via lib).
- **Sub-components:** `AcceptHeaderBrandPicker`, `EstimateFieldPhotosStrip`, `AutosizeTextarea`, `SearchableMultiSelect`, `SearchableSelect`, `EstimateCustomerAttachmentCard`, `EstimateAcceptBody` (**all extracted**); everything else inline.
- **Tests:** `estimateOptions.test` + `estimateOptionsSharedParity.test`, `estimateChangeOrder.test`, `coCostLinePrompt.test`, `estimateLineItemNormalize.test`, `estimateLineItemRecents.test`, `estimateDraftSteps.test`; **untested money math inline:** `updateLine`, the line-row dollars → cents + credit sign (5748–5751), `catalogEntryToLineItem`; `checkGoogleDriveAttachmentUrl` untested; no send-flow test.
- **Extraction status + risk + approach:** Inline. **High risk as one block — split it.** After the seam: options strip and CO block first (self-contained, controlled props), catalog modal earlier still (below), then the remainder (`EstimateDraftEditor` with the button row) last; `saveDraft`/`sendToCustomer`/`deleteDraft` stay with the seam, passed as callbacks.

### `EstimateDetail` — line item catalog modal (`catalogModalOpen`, 5283–5644)

- **Render location:** modal inside `lineItemsSlot`; openers: toolbar icon (5853) and the CO empty prompt (5662); recents chips beside the heading (5254).
- **Owned local state (9, 2609–2617):** `catalogModalOpen` (written by its openers 5645 / 5804 and `applyFromCatalogEntry` — becomes the `open`/`onClose` props, so 8 move), `catalogModalTab: 'pick' | 'edit'`, `catalogEditRows`, `catalogSaveBusy`, `catalogEventsByItemId`, `catalogHistoryOpenId`, `catalogHistoryLoadingId`, `catalogEditorNames`, `catalogFilter`; effects: Escape-close 2812–2819, clear-filter-on-open / collapse-history-on-close 2860–2863.
- **Cross-region/shared state:** `catalogLineItems` (also read by `lineItemRecentChips` and both CO prompts — stays parent/seam), `canManageEstimateCatalog` (2619), `lines` (via `applyFromCatalogEntry`), `lineItemRecentIds`, `catalogIconHovered` (toolbar).
- **Coupling:** reads 10 / writes 5; handlers `applyFromCatalogEntry`, `loadHistoryForCatalogItem` 4367–4382, `catalogEventSummary` 4384–4407, `saveCatalogEdits` 4409–4422; derived `catalogFiltered` 4308–4320.
- **Supabase (via [`lib/estimateCatalogApi.ts`](../src/lib/estimateCatalogApi.ts)):** SELECT `estimate_catalog_items`, `estimate_catalog_item_events`, `users` (editor names); saves through RPC `replace_estimate_catalog_payload`.
- **Tests:** none — `estimateCatalogApi` untested, and the edit-row money (qty coerce 5554–5557, unit `Math.max(0, Math.round(… * 100))` 5578–5583) is inline.
- **Extraction status + risk + approach:** Inline. **Low risk — extract second.** `src/components/estimates/EstimateLineItemCatalogModal.tsx` owning the other 8 modal states; props `open`, `onClose`, `catalogLineItems`, `onReloadCatalog` (= `loadCatalogFromDb`), `canManage`, `onInsert(entry)`. Stage A first: `catalogEventSummary`, `filterCatalogItems`, edit-row coercion.

### `EstimateDetail` — sent / accepted / declined view (`!isDraft`, 6299–6600)

- **Render location:** locked notify-recipients card 6301–6326; `customer_accepted` → `EstimateCustomerDocument` + attachment 6327–6373; customer line + snapshot link 6374–6412; acceptance record (name / at / IP / signature, `describeAcceptedEstimateRecord` over `acceptedEstimateOptionKeys`) + Customer activity + Job section 6413–6545; `sent` → activity + `EstimateResendLinkPanel` + `EstimateCustomerAcceptLinkButtons` + `EstimateRecordDeclineControl` 6546–6583; `declined` → note + activity 6584–6598. The read-only header above (For line, logo, `EstimateLineItemsTable`, CO fields 4738–4756) renders at 4724–4766 for sent/declined/superseded; title chips at 4681–4719.
- **Owned local state:** `unlinkingJob`, `unlinkJobConfirmOpen`, `createJobModalOpen`, `acceptorSignatureSignedUrl` (also read by the CX Page tab 6728 — keep it in the seam or pass it down), `detailCustomerSnapshotId`, `resending`, `resentInfo` (cleared per row by effect 3559–3561), `recordingDecline`.
- **Cross-region/shared state:** `row`, `customers`, `estimateCustomerEvents(+Loading)`, `acceptNotifyResolvedUsers`, `customerAcceptUrl` 3442–3456, `acceptancePreviewForLine` 3458–3467, `acceptanceDocHeaderBrand` 3469–3473, `staffResolvedExperience`, `customerAttachmentPreview`, `linkedCustomerPrefillForCreateJobModal` 3347–3352, `customerId`, `coFields`.
- **Handlers:** `openCreateJobModal` 4183, `openUnlinkJobConfirm`/`closeUnlinkJobConfirm`/`confirmUnlinkLinkedJob` 4188–4219 (UPDATE `job_ledger_id = null` **gated `.eq('status','customer_accepted')`**), `copyCustomerAcceptUrl` 3504, `openCustomerAcceptUrl` 3513 (`withEstimatePreviewMarker`), `recordStaffDecline` 3525–3546 (RPC `record_estimate_decline`, gated by `declineVerdict` 3524), `resendCustomerLink` 3578–3636 (edge `send-estimate-to-customer` `mode: 'resend'`, direct `fetch` 3589; gated by `resendVerdict` 3549–3556 = shared `canResendEstimateLink`), `copyResentUrl` 3563–3571.
- **Supabase:** `estimates` (UPDATE unlink), RPC `record_estimate_decline`, edge `send-estimate-to-customer`, storage `estimate-acceptor-signatures`, `estimate_customer_events` (parent loader).
- **Sub-components:** `EstimateCustomerDocument`/`EstimateLineItemsTable`, `EstimateCustomerAttachmentCard`, `EstimateAcceptTypedSignatureLine`, `IpAddressMapButton`, `EstimateResendLinkPanel`, `EstimateCustomerAcceptLinkButtons`, `EstimateRecordDeclineControl`, `CreateJobFromEstimateModal`, `CustomerSnapshotModal` (**extracted**); `EstimateDetailCustomerActivitySection` (in-file); unlink dialog (inline).
- **Tests:** `EstimateResendLinkPanel.render.test`, `EstimateCustomerDocument.render.test`, `CreateJobFromEstimateModal.render.test` (+ `createJobFromEstimateSubmit.test`, `jobFromEstimateDefaults.test`), `estimateLinkResend.test`, `estimateDecline.test`, `estimateViewPreview.test`, `estimateAcceptedRecord.test`.
- **Extraction status + risk + approach:** Inline. **Medium risk**, read-mostly (one write + one RPC). Extract as `EstimateSentAcceptedView` after the seam, together with the read-only header, the unlink dialog, the detail `CreateJobFromEstimateModal` and `CustomerSnapshotModal` (only openers). The `#estimate-job` and `?createJob=1` effects stay in the parent (the `?createJob=1` effect sets `createJobModalOpen` → lift that one state or pass an opener; the hash effect only scrolls).

### `EstimateDetail` — customer experience (`<details>` "Customer experience", 6602–6854)

- **Render location:** second `EstimateDraftCustomerGate` 6602 → `<details>` 6603; tabs on `customerPreviewTab`; Email 6678–6726, Page 6728–6826 (`EstimateAcceptBody variant="staffPreview"`, option selection rehearsal, Open preview tab), Thank you 6828–6851 (`EstimateCustomerThankYou`).
- **Owned local state:** `customerPreviewTab` only. `appCxSettings` (loaded once, 2784) is read only by `staffResolvedExperience`/`cxTemplateDefaults`, so it goes with the seam; `lastAcceptUrl` (**shared** — written by `sendToCustomer`/`resendCustomerLink`/`load`).
- **Cross-region/shared state:** `cxOverrideFields` (**written here, persisted by the payload**; re-hydrated from `row.customer_experience_overrides` 3079–3085), `previewSelectedOptionKeys`, `row`, `title`, `terms`, `lines`, `totalCents`, `validUntil`, `forAddress`, `acceptHeaderBrand`, `syncedEstimateOptions`, `customerAttachmentPreview`, `acceptorSignatureSignedUrl`.
- **Derived memos:** `previewEmailTo` 3423–3436, `staffResolvedExperience` 3638–3658 (frozen `customer_experience_sent` wins; else `resolveEstimateCustomerExperience(…, { docKind })`), `customerEmailPreview` 3661–3698 (`buildEstimateLetterheadEmail` — the same builder as the edge function), `cxTemplateDefaults` 3700–3703.
- **Handlers/render fns:** `renderCxDraftSectionFields` 3717–3847 (override editor; `accept_page_footer` keeps an intentional empty string), `buildCustomerExperienceOverridesPayload` 3705–3708, `acceptanceCxOmitKeys` 3710–3715, `openStaffAcceptCustomerPreview` 3475–3502 (writes the staff preview snapshot then opens `/estimate/customer-accept-preview/:number`).
- **Supabase:** `app_settings`.
- **Tests:** `estimateCustomerExperience.test` + `.co.test`, `estimateEmailLetterhead.test`, `estimateStaffAcceptPreview.test`; `renderCxDraftSectionFields` / `acceptanceCxOmitKeys` untested.
- **Extraction status + risk + approach:** Inline. **Medium risk.** Extract as `EstimateCustomerExperienceSection` taking the seam's values + `cxOverrideFields`/setter + `previewSelectedOptionKeys`/setter; keep `staffResolvedExperience`, `customerAcceptUrl`, `customerAttachmentPreview`, `customerEmailPreview` in the seam (multi-region consumers — the draft editor reads the headings, the accepted view reads the brand/attachment).

### `EstimateDetail` — page-level modals (6856–6975)

- **Contents:** create-customer overlay 6856–6897 (`NewCustomerForm`; `onCreated` patches `customers` + `handleSelectCustomer`), unlink-job confirm 6899–6953, `CreateJobFromEstimateModal` 6955–6967 (`onSuccess` → `load()` → `/jobs?edit=<jobId>`), `CustomerSnapshotModal` 6968–6973.
- **Extraction status:** create-customer moves with the draft customer section (only opener); the other three move with the sent/accepted view. Nothing here is opened from 2+ regions.

---

## Shared infrastructure

The API surface extracted regions must be handed.

### Route/URL state (parent, permanent)

- `Estimates()` router: `useParams<{ id }>` → detail vs list. **The URL is the selection pointer.**
- Detail: UUID segment → load by `id` → `navigate('/estimates/:number', { replace: true })`; invalid/not-found → toast + `/estimates`; `location.state.freshEstimateDraft` marks a just-minted draft.
- Detail: `#estimate-job` hash scrolls to the Job section after load (2679–2687); `?createJob=1` (Signed agreements email) opens Create job once for an accepted, unlinked row, then strips the param (2592–2599).
- List: `?customer=<id>` filters `load()` (Clear filter deletes it); `?newEstimate=true&project=<id>` INSERTs a draft once per mount and strips both params (2064–2078).
- Outbound: `/jobs?edit=<job_ledger_id>`, `/estimate/customer-accept-preview/:number` (staff preview tab), the accept URL with `?preview=1`.

### Browser storage

- sessionStorage `estimate_accept_url:<estimateId>` — read 3023 / 3449, written 3619 / 4148; validated by `isUsableCustomerAcceptUrl`.
- localStorage `estimateLineItemRecentsStorageKey(user.id)` — recent catalog picks (lib-managed).
- localStorage staff accept-preview snapshot (`writeStaffAcceptPreviewSnapshot`, lib-managed).

### Role gating

- No page-level access gate (primary scoping is RLS; the list's empty label explains it). `ESTIMATE_CATALOG_EDITOR_ROLES` (dev, master_technician, assistant, controller, estimator, primary, superintendent) gates catalog **editing**; the ⚙ Accepted-notifications button is dev/master only; `resolveMasterUserId` returns the company owner for every role (v2.2972).

### Supabase inventory (whole file)

The fact sheet lists no edge functions because both calls are direct `fetch`es; they are added here.

| Table / function | Verbs | Region |
|---|---|---|
| `estimates` | SELECT (list joins `customers`, `jobs_ledger`; detail joins `jobs_ledger`), INSERT (`createDraft`), UPDATE (`saveDraft` draft-gated; unlink accepted-gated), DELETE (`deleteDraft`, fresh-draft leave hook, bulk `cleanUpEmptyDrafts` — all draft-gated) | list + detail |
| `customers` | SELECT (full list in `load` + `refetchCustomersAfterEdit`; single re-fetch in send) | detail |
| `users` | SELECT (notify options by role list + self role + devs; master_technician defaults; notify display; catalog editor names via lib) | detail |
| `projects` | SELECT (lazy linked-project picker, drafts only) | detail draft |
| `bid_proposal_rooms` | SELECT (open rooms for the CO's bid) | detail CO |
| `app_settings` | SELECT (`ESTIMATE_EXPERIENCE_APP_KEY_LIST`) | detail CX |
| `estimate_customer_events` | SELECT (detail: sent/accepted/declined + focus refresh); list: one chunked SELECT for all sent + declined rows | list Pipeline + detail |
| `estimates_thread_notes` | SELECT/INSERT + RPC `estimates_thread_note_stats` (via `useEstimateThreadNotes`) | list Pipeline |
| `estimate_catalog_items`, `estimate_catalog_item_events` | SELECT; writes via RPC `replace_estimate_catalog_payload` (all via `lib/estimateCatalogApi.ts`) | detail catalog |
| RPC `record_estimate_decline` | `recordStaffDecline` (`(supabase as any).rpc` until gen-types) | detail sent |
| RPC `publish_co_to_bid_room` | `publishCoToBidRoom` (SECURITY DEFINER; draft→sent is privileged) | detail CO |
| RPC `create_job_from_estimate` | via `CreateJobFromEstimateModal` (extracted) | list + detail |
| storage `estimate-acceptor-signatures` | `createSignedUrl(path, 3600)` | detail accepted |
| edge `send-estimate-to-customer` | direct `fetch` (JWT + anon apikey): send 4118; `mode: 'resend'` 3589 | detail send / resend |
| edge `check-estimate-attachment-url` | via `checkGoogleDriveAttachmentUrl` | detail attachment |

### Seam hook candidates

1. **`useEstimateDetailData`** — `row`, `loading`, `load`, `customers` cache + `refetchCustomersAfterEdit`/`openDraftCustomerForEdit`, all hydrated field states/setters, the reset/events/signature/notify/app-settings/projects effects, **the persistence trio** (`buildDraftPersistPayload` + `saveDraft` + both autosave paths + the fresh-draft leave hook), and the shared memos (`totalCents`, `syncedEstimateOptions`, `staffResolvedExperience`, `customerEmailPreview`, `customerAcceptUrl`, `customerAttachmentPreview`, `acceptancePreviewForLine`, `acceptanceDocHeaderBrand`, `railData`). The unlock for every detail-region extraction.
2. **`useEstimateThreadNotes`** — already exists; no work needed (add a test).
3. Optional **`useEstimateCatalog`** — `catalogLineItems` + `loadCatalogFromDb` + recents; worth it once the modal, the recents chips and the CO prompts live in different components.

---

## Test coverage

| Region | Covered by | Gaps (risk) |
|---|---|---|
| Module layer | via wrapped libs: `estimateLineItemNormalize.test`, `estimateTitle.test` | all in-file helpers — search, customer lines, options counters, `statusLabel`/`formatMoney`, accept-URL validation, draft-stub predicates |
| List table + cards | `estimatePipelineRefresh.test`, `estimateOpenState.test`, `tapHint.test`, `estimateDecline.test` | no render smoke; `formatEstimateListUpdated` untested |
| List shell | `estimatePipelineRefresh.test` (buckets, ledger filters/totals, empty drafts), `supabasePaging.test`; e2e `viewport-smoke.spec.ts` (`/estimates`) | `useEstimateThreadNotes`, `estimateMasterUser` untested; no render smoke; deep-link INSERT deliberately has no e2e |
| Detail loader | `estimateRouteSegment`, `estimateAcceptHeaderBrand`, `estimateCustomerAttachment`, `estimateOptions`, `estimateChangeOrder`, `customerArchive` tests | `addCalendarDaysYmd` untested; accept-notify default branch inline |
| Draft persistence | `estimateOptions.test`, `estimateFreshDraftDiscard.test`, `jobFormCloseFlush.test` | **`buildDraftPersistPayload` untested (writes `total_cents`)**; `useJobFormAutosaveSlice` has no hook test |
| Step rail | `estimateDraftSteps.test` | no rail render test |
| Draft editor + options + CO | `estimateOptions.test`, `estimateOptionsSharedParity.test`, `estimateChangeOrder.test`, `coCostLinePrompt.test`, `estimateLineItemRecents.test` | **money math inline and untested:** `updateLine` (qty coerce, CO negatives), line-row dollars→cents + credit sign, `catalogEntryToLineItem`; send flow; `checkGoogleDriveAttachmentUrl` |
| Catalog modal | — | **none**: `estimateCatalogApi`, `catalogEventSummary`, `catalogFiltered`, edit-row dollars→cents |
| Sent/accepted view | `EstimateResendLinkPanel`, `EstimateCustomerDocument`, `CreateJobFromEstimateModal` render tests; `estimateLinkResend`, `estimateDecline`, `estimateViewPreview`, `estimateAcceptedRecord`, `createJobFromEstimateSubmit`, `jobFromEstimateDefaults` tests | unlink flow inline |
| Customer experience | `estimateCustomerExperience.test` + `.co.test`, `estimateEmailLetterhead.test`, `estimateStaffAcceptPreview.test` | `renderCxDraftSectionFields`, `acceptanceCxOmitKeys` |
| Whole page | — | no `Estimates.render.test.tsx` smoke for either page component |

---

## Stage-A pure-logic inventory (extract to `lib/*` + tests before any component moves)

| Candidate | Currently | Target |
|---|---|---|
| **Done:** `splitFollowupRows` (+ sort), `isEmptyEstimateDraft`, `countMeaningfulEstimateLines`, readiness/sent-wait/ledger kernels | — | `lib/estimatePipelineRefresh.ts` ✓ tested |
| **Done:** `defaultEstimateTitle`, `isGenericEstimateTitle` (v2.3748) | — | `lib/estimates/estimateTitle.ts` ✓ tested |
| **Done:** `resolveMasterUserId` | — | `lib/estimateMasterUser.ts` ✓ (thin; untested) |
| **Done:** step rail, fresh-draft discard, options, accepted record, resend/decline verdicts | — | `estimateDraftSteps`, `estimateFreshDraftDiscard`, `estimates/estimateOptions`, `estimates/estimateAcceptedRecord`, `_shared/estimateLinkResend`, `_shared/estimateDecline` ✓ tested |
| `isDefaultDraftStubShape`, `defaultDraftFirstLine`, `emptyDraftLine`, `emptyCatalogEditRow` (807–852), `isBlankDraftLine`, `isReplaceableStubLine`, `catalogEntryToLineItem` (4322–4342), `updateLine` patch (4283–4298), line-row dollars→cents + credit sign (5748–5751), catalog edit-row coercion (5554–5583) | module + component-body + inline JSX | `lib/estimates/estimateDraftLines.ts` + tests (**untested money math** — qty coerce, CO `allowNegative`, credit sign, unit clamp ≥0, rounding, both stub shapes) |
| `buildDraftPersistPayload` (3903–3927) | component-body function | pure `buildEstimateDraftPersistPayload(fields, attDb)` + test (title fallback by kind, options-vs-legacy `total_cents`, notify de-dupe, CO fields only for COs) |
| `estimateListCustomerSubline`, `estimateListCustomerColumnLines`, `estimateListRowMatchesSearch`, `estimateListOptionsCount`/`AddOnCount`/`OptionsSuffix`, `estimateDeclinedRowLabel`, `statusLabel`, `formatMoney`, `estimateLinkedJobHcp` | module functions | `lib/estimates/estimateListRows.ts` + tests (options counters may join `estimateOptions.ts` beside the parity test) |
| `catalogEventSummary` (4384–4407), `catalogFiltered` predicate (4308–4320) | component-body | `lib/estimates/estimateCatalogView.ts` + tests (4 actions × null fields; money-string matching) |
| `isUsableCustomerAcceptUrl`, `normalizeCustomerAcceptUrlCandidate` (365–382) + the four sessionStorage read/write sites | module + inline try/catch | `lib/estimates/estimateAcceptUrlSession.ts` + tests |
| title-derivation rule in `handleSelectCustomer` (3859–3865) | inline | `shouldReplaceTitleOnCustomerChange(title, prevName)` in `estimateTitle.ts` + test |
| `acceptNotifyOtherSelectOptions` bucketing (3157–3215) + `estimateAcceptNotifySeparatorLabel` (465–478) | 59-line useMemo | pure `groupEstimateNotifyOptions(options, selfId)` → `lib/estimates/estimateNotifyOptions.ts` + tests |
| bid-room pick in `publishCoToBidRoom` (4238) | inline | pure `pickBidRoomForChangeOrder(rooms, customerId)` + test |
| `estimateCustomerEventLabel` (338–351) | module function | join `estimateAcceptUrlSession` or its own tiny lib |
| `acceptanceCxOmitKeys` (3710–3715) | closure over `validUntil`/`title` | pure `(validUntilTrimmed, titleTrimmed)` function |
| `CX_FIELD_LABELS`, `CX_OVERRIDE_SECTIONS`, `cxOverrideFieldRows` (384–449) | module data | `lib/estimates/estimateCxOverrideSections.ts` (data-only; shape assertion) |
| Imported libs with no test yet | — | `addCalendarDaysYmd`, `formatEstimateListUpdated`, `estimateCatalogApi` (`catalogDbRowsToLineItems`), `checkGoogleDriveAttachmentUrl`, `useEstimateThreadNotes`, `useJobFormAutosaveSlice` |

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **Every status-changing write is status-gated**: `saveDraft` UPDATE, `deleteDraft` DELETE, the fresh-draft leave DELETE and the bulk `cleanUpEmptyDrafts` DELETE carry `.eq('status','draft')`; `confirmUnlinkLinkedJob` carries `.eq('status','customer_accepted')`. Race guards against the customer accepting mid-edit — keep them. Draft→sent for a bid-room CO goes through RPC `publish_co_to_bid_room` because `estimates_update_draft` pins status to `'draft'`.
2. **UUID → number redirect** uses `replace: true`; the check compares `String(r.estimate_number) !== routeSegment` inside the UUID branch.
3. **Accept URL is session-scoped by design**: only `lastAcceptUrl` + sessionStorage `estimate_accept_url:<id>`, never the DB. `customerAcceptUrl` is null in other sessions and for any status other than sent/accepted.
4. **Draft accept-notify default = self + ALL master_technicians** (only when `accept_notify_user_ids IS NULL` and draft); query failure falls back to `[user.id]`. Non-draft shows the locked list.
5. **Title auto-derivation is conditional**: selecting a customer overwrites the title only when it is generic (`isGenericEstimateTitle`: `''`, `New estimate`, `Estimate`, `Change order`, `Estimate for customer`, `Change Order for customer`) **or** equals the previous customer's default in either shape (`defaultEstimateTitle(prevName)` / `(prevName, true)`); the new title is `defaultEstimateTitle(name, isCO)`. `load()` applies the same for generic-titled drafts with a customer. The payload persists `title.trim() || (isCO ? 'Change order' : 'Estimate')`.
6. **Two autosave paths.** (a) Customer-link change (3963–3977): `prevCustomerIdForAutosave` with an `undefined` first-run sentinel, `saveDraft({ quiet: true })` **with** reload, deliberately incomplete deps. (b) Debounced draft autosave (v2.2592): `useJobFormAutosaveSlice` over the JSON of `buildDraftPersistPayload`, 1500ms, `saveDraft({ quiet: true, skipReload: true })` (a reload would clobber typing in flight), `jobId` gated on `!loading` so the baseline is post-hydration, disabled while saving/sending or while the attachment URL is invalid, flushed on `visibilitychange` → hidden. Dirty and saved agree because both use the one payload builder.
7. **Draft `valid_until` defaults to today+30** with the 30-day preset lit; typed dates re-detect presets via `presetMatchingTodayOffset`. Non-draft never shows presets.
8. **Attachment duality**: drafts edit `customer_attachment_url/label`; sent/accepted read frozen `customer_attachment_sent`. Same for CX copy: `customer_experience_sent` wins in `staffResolvedExperience`.
9. **`accept_page_footer: ''` is a meaningful override** ("hide the footer for this quote") — the blank-removes-override rule does not apply; the payload keeps the empty string.
10. **Send flow ordering**: customer re-fetched if missing from cache; email = CRM or `sendEmailOverride` (`SEND_EMAIL_RE`); one confirm dialog names the recipient and folds in the $0 soft gate ("Send anyway"), recording `discard_guard_shown`; `saveDraft()` (with reload) before the edge call; `emailed: false` + `accept_url` → clipboard copy. The attachment "Check link" never blocks sending.
11. **Line money coercion**: `updateLine` and catalog edit rows coerce quantity ≤0/NaN to 1; `amount_cents` always recomputed via `computeEstimateLineExtendedCents`, with `{ allowNegative: isCO }` in `updateLine` only; the line-row unit input rounds dollars → cents and forces a negative sign on CO credit lines; catalog edit rows and `catalogEntryToLineItem` clamp unit ≥ 0.
12. **Empty draft line-items hydrate to `[defaultDraftFirstLine()]`** for estimates only — CO drafts are created and hydrated with `[]` so Impact on cost opens with the guided prompt. `isDefaultDraftStubShape` recognizes the new and legacy stub shapes. With options, `lines` hydrates from the recommended option.
13. **`lines` is the viewed option's lines** while options exist; `syncedEstimateOptions` re-merges them for cards, previews and the payload; the payload mirrors the ★ option into the legacy fields. COs never carry options.
14. **Pipeline buckets**: Declined has its own bucket (rendered only when non-empty); superseded omitted; signed bid-room proposals skipped; each bucket re-sorts by `updated_at` desc; empty drafts collapse behind the sweep button.
15. **One `listSearch` state serves both list tabs** (two inputs, `estimates-list-search` / `estimates-list-search-stages`).
16. **List queries cap at 200 rows** (`.limit(200)`, newest first) — and the Ledger's filters and totals ("All time" included) are computed client-side over those 200.
17. **`estimate_customer_events` refresh on window focus** only while sent/accepted (the loader itself also runs for declined).
18. **`EstimateDraftCustomerGate` appears twice** (4670 and 6602) with the same `draftNeedsCustomer`/`requestCustomerFirst` pair; toast throttled to one per 700ms, combobox pulse.
19. **`customers` is loaded unpaginated** (full table by name) in `load` and `refetchCustomersAfterEdit`; `filterActiveCustomersForPicker(customers, customerId)` keeps an archived-but-selected customer visible.
20. **Signature display fallback** (accepted): signed-URL image → "(loading preview…)" → `EstimateAcceptTypedSignatureLine` when only a printed name exists.
21. **`threadColSpan = 6 + (showCustomerColumn ? 1 : 0)`** (1058) — update it if columns change.
22. **`createDraft` inserts `title: ''`** so the customer-select derivation can claim it as generic.
23. **Fresh drafts self-delete on leave (v2.2885).** `createDraft` navigates with `state.freshEstimateDraft`; `load()` stamps `freshDraftRowIdRef`; every write (`saveDraft`, `deleteDraft`) stamps `committedDraftRowIdRef`; the leave hook (4003–4041) is **keyed on `routeSegment`** (its cleanup runs while state is still the OLD row's) and, when `shouldDiscardFreshEstimateDraftOnLeave` (fresh ∧ never saved ∧ `isEmptyEstimateDraft` over title, customer, lines, terms, CO fields, `forAddress`, `internalNotes`) holds, cancels the pending autosave and DELETEs the row. Do not key it on `row.id`. Hard reload / tab close cannot run it; `cleanUpEmptyDrafts` sweeps stragglers.
24. **Customer view hides, not unmounts**, the edit paper (`display: none`, 4817) so field state survives the toggle.
25. **Deep links that write or open once**: `?newEstimate=true&project=` INSERTs once per mount (ref guard) and strips its params first; `?createJob=1` opens Create job only for an accepted, unlinked row and strips the param (deps `[row?.id]`, eslint-disable).
26. **`publishCoToBidRoom` room pick**: the room whose `customer_id` matches the CO's customer, else the only open room, else the customer-less room; otherwise it refuses with a toast. It saves first, then calls the RPC and dispatches `bid-room-changed`.

---

## Recommended extraction order (value ÷ risk)

1. **Stage-A sweep** — the [pure-logic inventory](#stage-a-pure-logic-inventory-extract-to-lib--tests-before-any-component-moves); each independently shippable. Highest leverage now: `estimateDraftLines` (untested money math), `buildEstimateDraftPersistPayload` (the save + autosave baseline, writes `total_cents`), `estimateListRows` (feeds step 2), `estimateCatalogView`, `estimateNotifyOptions`.
2. **`EstimateListTable` + `EstimateListCards` → `components/estimates/EstimateListTable.tsx`** — props-only (the cards' tap hint moves with them), 10 call sites unchanged; removes ~880 lines with the props/styles; the two kind chips the detail also renders go to a shared chips file in the same PR. Add a render smoke.
3. **Line item catalog modal → `EstimateLineItemCatalogModal.tsx`** — 9 catalog states (8 move; `catalogModalOpen` stays with its openers as `open`/`onClose`), reads 10 / writes 5, one outbound callback (`onInsert`); `catalogLineItems` and `catalogIconHovered` stay behind (recents chips, CO prompts, toolbar).
4. **Seam: `useEstimateDetailData`** — `load`, hydration, the `customers` cache, the IO effects, the shared memos **and the persistence trio** (payload + `saveDraft` + both autosave paths + fresh-draft leave hook, moved together). No JSX moves in this step. Riskier than at v2.1088 because autosave keys on the payload JSON — verify autosave, Save draft, Send and leave-discard on a throwaway draft.
5. **Sent/accepted/declined view → `EstimateSentAcceptedView.tsx`** — reads 13 / writes 1; brings the read-only header, unlink dialog, detail `CreateJobFromEstimateModal` and `CustomerSnapshotModal`; `#estimate-job` / `?createJob=1` stay in the parent.
6. **Draft sub-sections as controlled components** — `EstimateChangeOrderFields` (reads 2 / writes 1) and `EstimateOptionsStrip` (reads 4 / writes 1 + 5 handlers from the seam), each taking `railStepDot`/`railFlashStep`.
7. **Customer experience → `EstimateCustomerExperienceSection.tsx`** — owns `customerPreviewTab` + the override editor; `cxOverrideFields` and `previewSelectedOptionKeys` stay parent-owned (controlled); resolved-experience memos come from the seam.
8. **Draft customer section → `EstimateDraftCustomerSection.tsx`**, then **the draft editor remainder → `EstimateDraftEditor.tsx`** (line rows, attachment, delivery, button row) — last, after everything they feed consumes the seam. Both gates and the customer-link autosave stay in the parent.
9. **Optionally** move the `EstimateList` shell to its own file; `Estimates.tsx` becomes the router + two thin shells.

**What must STAY in the parent(s):** the `Estimates()` route split; the UUID→number redirect + not-found navigation (inside `load`/the hook); the `#estimate-job` and `?createJob=1` effects; `?customer=` / `?newEstimate` handling and the list's four modals; the draft form cluster + `customers` cache (via the seam); `draftNeedsCustomer`/`requestCustomerFirst` (both gates); `railData`/`railStepDot`/`railFlashStep`/`customerViewOn` (rail + 5 sections); `lastAcceptUrl` + its sessionStorage sync (written by send/resend/load, read by the CX section and the accepted view).

Definition of done per region, verification gates, and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) (`npm run typecheck && npm run lint && npm test` green after every step; behavior-preserving only).
