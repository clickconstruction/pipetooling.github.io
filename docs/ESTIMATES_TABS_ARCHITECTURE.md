# Estimates Tabs Architecture Map

---
file: docs/ESTIMATES_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the Estimates.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what every region of the ~5,365-line src/pages/Estimates.tsx touches (state, loaders, handlers, sub-components, supabase tables/edge functions, cross-region coupling), identify the shared substrate, and set the recommended extraction order. Sections — What this surface is; Shared substrate; Master summary table; Per-region dossiers; Shared infrastructure; Stage-A pure-logic inventory; Preserve-quirks list; Recommended extraction order.
audience: Developers, AI Agents
last_updated: 2026-09-05
---

## What this surface is

[`src/pages/Estimates.tsx`](../src/pages/Estimates.tsx) is a ~5,365-line file (counts as of v2.1088): 63 `useState`, 25 `useEffect`/`useLayoutEffect`, 28 `useMemo`/`useCallback`. Unlike Materials or Bids it is **not one tab-switched God component — it is two independent page components plus a 5-line router**:

```tsx
export default function Estimates() {
  const { id: routeSegment } = useParams<{ id: string }>()
  if (routeSegment) return <EstimateDetail routeSegment={routeSegment} />
  return <EstimateList />
}
```

- **`EstimateList`** (~440 lines) — `/estimates`. Two list tabs on `listTab: 'followup' | 'all'` (labels **Pipeline** and **Ledger**; `followup`/Pipeline is the default — the tab label was renamed from "Stages" in the v2.1251–v2.1263 naming audit (key `'followup'` and DOM id `estimates-tab-stages` unchanged)). Backed by two large module-level presentational components, `EstimateListTable` (~368 lines) and `EstimateListCards` (~325 lines, the ≤640px card variant via `useNarrowViewport640`).
- **`EstimateDetail`** (~3,360 lines) — `/estimates/:id`, where `:id` is a quote number (canonical) or a UUID (redirected to the number, `replace: true`). This is the real God component. It is **not** tab-switched: its regions are gated on `row.status` (`isDraft = row?.status === 'draft'` vs sent/accepted), plus one `<details>` section (Customer experience) with its own inner tab state `customerPreviewTab: 'email' | 'page' | 'thankyou'`.
- **Module-level shared layer** (~860 lines above `EstimateListTable`) — types, CSS strings, `est*Button`/`estInput*` style helpers, ~20 small pure helpers, three tiny components (`EstimateCustomerActivityDetails`, `EstimateDetailCustomerActivitySection`, `EstimateDraftCustomerGate`), and one IO helper (`resolveMasterUserId`, queries `master_assistants`).

The page is already a good Stage-A citizen: 13 components exist in `src/components/estimates/` (~2,974 lines) and ~20 `src/lib/estimate*` modules are imported. What remains inline is the list shell, the entire detail editor, the line-item catalog modal, and a residue of pure helpers that never got their `lib/` move.

**Churn**: heavy feature churn through v2.6xx–v2.9xx (accept-notify recipients wave ended ~v2.991 per `docs/RECENT_FEATURES.md`); since then only peripheral touches (v2.1003 e2e viewport smoke, v2.1061 `JobThreadNotesPanel` prop addition). The surface is currently **quiet** — a good extraction window.

### How to read a dossier

Each section lists: render location (anchored by symbol/status gate — line numbers are "as of v2.1088" and rot; search the symbol), **owned local state** (moves with the region), **cross-region/shared state** (stays in the parent), **derived memos**, **handlers/loaders**, **supabase tables/RPCs/edge functions**, **sub-components** (extracted vs inline), **external coupling**, and **extraction status + risk + approach**.

---

## Shared substrate

**There is no in-memory shared selection pointer** — no `setSharedBid` equivalent. The selection pointer **is the URL**: `/estimates/:number` selects the record, and `EstimateList` and `EstimateDetail` never mount together and share zero runtime state. UUID deep links (`isEstimateUuidSegment`) are loaded by `id` then rewritten to `/estimates/:estimate_number` (`replace: true`) via `parseEstimateQuoteNumberSegment`/`isEstimateUuidSegment` from [`lib/estimateRouteSegment.ts`](../src/lib/estimateRouteSegment.ts).

Consequences for extraction:

1. The two page components can be decomposed **independently**; the only shared code is the module-level helper layer (which should become `lib/` + a shared components file, not a hook).
2. **Within `EstimateList`**, the shared engine already exists as an extracted hook: [`useEstimateThreadNotes`](../src/hooks/useEstimateThreadNotes.ts) (294 lines; `estimates_thread_notes` table) plus the `rows`/`filteredRows`/`listSearch` cache consumed by both list tabs. The two list tabs share one search input state (`listSearch` persists across the Pipeline↔Ledger switch) and all four page-level modals — so the list tabs are cheap to extract against props, but the modal openers stay in `EstimateList`.
3. **Within `EstimateDetail`**, the substrate is the `row: EstimateDetailRow` record + the ~25-field draft form-state cluster (`title`, `terms`, `lines`, `customerId`, `validUntil`, `forAddress`, `internalNotes`, `customerAttachmentUrl/Label`, `acceptHeaderBrand`, `cxOverrideFields`, `acceptNotifyUserIds`, …) + the `customers` cache + `load()`. Nearly every region reads several of these, so detail regions must be extracted **against a seam** (a `useEstimateDetailData` hook or a fat props object), not piecemeal — this is the page's equivalent of Bids' `useBidPricingEngine`, except it does not exist yet.

---

## Master summary table

| Region | Component / gate | Lines est. | Coupling | Risk | Status | Recommended action |
|---|---|---|---|---|---|---|
| Module shared layer | module scope, lines ~116–860 | ~745 | consumed by everything in-file | low | inline | Stage-A sweep → `lib/estimates/*`; tiny components → `components/estimates/` |
| List table + cards | `EstimateListTable`, `EstimateListCards` | ~695 | props-only (one `useAuth()` for role) | **low** | inline (module-level) | **Extract first** — pure file move to `components/estimates/EstimateListTable.tsx` |
| List: Pipeline tab | `listTab === 'followup'` inside `EstimateList` | ~120 JSX | med (thread hook + shared modals + `listSearch`) | low-med | inline | Extract with Ledger as one `EstimatesListPage`, or leave — shell is small once tables move |
| List: Ledger tab | `listTab === 'all'` inside `EstimateList` | ~45 JSX | low (same modals, no thread) | low | inline | same as above |
| Detail: loader + hydration | `load` / `hydrateCustomerFieldsFromEstimate` | ~250 | highest — writes ~20 states | high | inline | Becomes `useEstimateDetailData` seam hook (Step 2) |
| Detail: draft customer picker | `isDraft` block at top of return | ~215 JSX + handlers | high (title derivation, autosave, gate) | med-high | inline | Extract after seam → `EstimateDraftCustomerSection` |
| Detail: draft editor body | `isDraft &&` `AcceptHeaderBrandPicker` block | ~740 JSX + handlers | high (all form fields + save/send) | high | inline | Extract last of the draft cluster → `EstimateDraftEditor` |
| Detail: line item catalog modal | `catalogModalOpen` inside lineItemsSlot | ~360 + ~14 states | **low** (only `applyFromCatalogEntry` crosses out) | **low** | inline | **Extract second** → `EstimateLineItemCatalogModal` |
| Detail: sent/accepted view | `!isDraft &&` block | ~225 JSX | med (row + resolved experience + job link) | med | inline | Extract third → `EstimateSentAcceptedView` |
| Detail: customer experience preview | `<details>` "Customer experience" | ~255 JSX + `renderCxDraftSectionFields` | med-high (cx overrides read/write + draft fields) | med | inline | Extract → `EstimateCustomerExperienceSection` |
| Detail: page-level modals | end of `EstimateDetail` return | ~120 | med (create-customer writes picker state) | — | mixed | Stay in parent (opened from multiple regions) |
| Router | `Estimates()` default export | 5 | — | — | done | Stays as-is |

---

## Per-region dossiers

### Module-level shared layer (lines ~116–860)

- **Contents:** constants (`ESTIMATE_CATALOG_EDITOR_ROLES`, `SEND_EMAIL_RE`, `ESTIMATE_EMAIL_FROM_LABEL`, `PREVIEW_EMAIL_ACCEPT_URL`, `ESTIMATE_ACCEPT_URL_SESSION_PREFIX`, `ESTIMATE_JOB_SECTION_HASH`, `DEFAULT_DRAFT_FIRST_LINE_ITEM`, `ESTIMATES_PAGE_CLASS`); CSS strings (`estimatesPageShellCss`, `estimatesFocusVisibleCss`, `estimateCustomerSearchHighlightCss`, `estimateDetailLineItemRowCss`, composed into `estimateDetailPageCss` / `estimatesListPageCss`); style factories (`estInputBase`, `estInputBlock`, `estPrimaryButton`, `estSecondaryButton`, `estSendButton`, `estDangerOutlineButton`, `estSmallSecondaryButton`, `estSmallPrimaryButton`, `estimateListCreateJobButtonStyle`, `estimateDetailCreateJobButtonStyle`).
- **Pure helpers (Stage-A residue):** `estimateCustomerEventLabel`, `isUsableCustomerAcceptUrl`, `normalizeCustomerAcceptUrlCandidate`, `cxOverrideFieldRows`, `estimateAcceptNotifySeparatorLabel`, `estimateLinkedJobHcp`, `isDefaultDraftStubShape`, `defaultDraftFirstLine`, `emptyDraftLine`, `emptyCatalogEditRow`, `lineItemsFromJson` / `sumLineItems` (thin wrappers over [`lib/estimateLineItemNormalize.ts`](../src/lib/estimateLineItemNormalize.ts)), `formatMoney`, `statusLabel`, `defaultEstimateTitle`, `isGenericEstimateTitle`, `estimateListCustomerSubline`, `estimateListCustomerColumnLines`, `estimateListRowMatchesSearch`, `sortEstimatesByUpdatedDesc`, `splitFollowupRows`.
- **CX config data:** `CX_FIELD_LABELS` (16 keys) and `CX_OVERRIDE_SECTIONS` (Email / Acceptance page / Thank you) — the field metadata for the customer-experience override editor. Keys are `EstimateExperienceOverrideKey` from [`lib/estimateCustomerExperience.ts`](../src/lib/estimateCustomerExperience.ts).
- **Small components:** `EstimateCustomerActivityDetails` (controlled `<details>`), `EstimateDetailCustomerActivitySection` (renders `estimate_customer_events` list with `IpAddressMapButton`), `EstimateDraftCustomerGate` (overlay that blocks the draft body until a customer is picked; forwards pointer-downs to `onBlockedInteraction`; uses the `inert` attribute).
- **IO helper:** `resolveMasterUserId(userId, role)` — dev/master return self; assistant-like roles look up `master_assistants.master_id` (fallback self). Used by `EstimateList.createDraft`.
- **Types:** `EstimateRow`, `EstimateListRow` (with `customers(name,address,contact_info)` + `jobs_ledger(hcp_number)` joins), `EstimateDetailRow`, `EstimateNotifyUserOption`, `EstimateListStagesThread`, `EstimateListTableProps`, `LineItem` (= `EstimateLineItemNormalized`), `CxOverrideSectionConfig`.
- **Extraction status + risk + approach:** Inline; **low risk**. Everything here is either pure (→ `lib/estimates/*` with tests, see [Stage-A inventory](#stage-a-pure-logic-inventory-extract-to-lib--tests-before-any-component-moves)) or presentational (→ `components/estimates/`). The style factories and CSS strings should move to a `components/estimates/estimatesPageStyles.ts` so both future page files can import them. `resolveMasterUserId` moves to `lib/estimates/resolveMasterUserId.ts` (takes `supabase` explicitly).

### `EstimateListTable` + `EstimateListCards` (module components, ~862–1555)

- **Render location:** module scope; rendered by `EstimateList` in 8 call sites (table vs cards per `narrowViewport640`, ×4 buckets: Ledger, Pipeline Unsent/Sent/Accepted).
- **Owned local state:** none — both are controlled by `EstimateListTableProps`. Only hook: `useAuth()` for `estimateListViewerRole` (passed to `JobThreadNotesPanel`).
- **Props (the seam already exists):** `rows: EstimateListRow[]`, `setAcceptanceModalEstimateId`, `setCreateJobFromListRow`, `showCustomerColumn?`, `onCustomerSnapshotRequest?`, `stagesThread?: EstimateListStagesThread` (the thread-notes bundle: stats/notes maps, `expandedEstimateThreadId`, `toggleEstimateThreadExpanded`, `estimateThreadDraft` + setter, `submitEstimateThreadNote`, `canPostNotes`).
- **Derived:** none memoized; per-row `formatEstimateListUpdatedLines`, `getDispatchNoteDisplayMeta`, `estimateLinkedJobHcp`, `estimateListCustomerSubline` / `estimateListCustomerColumnLines`.
- **Sub-components:** [`JobThreadNotesPanel`](../src/components/JobThreadNotesPanel.tsx) (**extracted**, expanded thread row), `Link` rows to `/estimates/:number` and `/jobs?edit=<job_ledger_id>`.
- **Supabase:** none directly (all IO comes in via props).
- **External coupling:** "Create job" button and "Accepted — view" button only invoke parent setters. `threadColSpan = 6 + (showCustomerColumn ? 1 : 0)` — colspan arithmetic must track the column count if columns ever change.
- **Extraction status + risk + approach:** Inline module components. **Lowest risk on the page — extract first.** Pure file move to `src/components/estimates/EstimateListTable.tsx` (both components + `EstimateListTableProps` + `EstimateListStagesThread` + the three `estimateListCustomer*` style constants + `ESTIMATE_LIST_CUSTOMER_SNAPSHOT_BTN_CLASS`). Their pure row helpers (`estimateListCustomerSubline`, `estimateListCustomerColumnLines`, `estimateListRowMatchesSearch`, `splitFollowupRows`, `sortEstimatesByUpdatedDesc`, `statusLabel`, `formatMoney`, `estimateLinkedJobHcp`) go Stage-A to `lib/estimates/estimateListRows.ts` in the same wave.

### `EstimateList` — Pipeline + Ledger tabs (~1559–1999)

- **Render location:** whole component when the route has no `:id`. Pipeline panel behind `listTab === 'followup'` (the `else` branch, `aria-labelledby="estimates-tab-stages"`); Ledger behind `listTab === 'all'`.
- **Owned local state:** `listTab` (default `'followup'`), `listSearch` (**one input state shared by both tabs** — persists across tab switch), `rows`, `loading`, `creating`, `acceptanceModalEstimateId`, `createJobFromListRow`, `customerSnapshotId`, `acceptNotifySettingsOpen` (dev/master ⚙ button).
- **Shared engine (extracted hook):** `useEstimateThreadNotes(showToast, user?.id, profileName)` → `expandedEstimateThreadId` + setter, `estimateThreadNotesByEstimateId`, `estimateThreadNotesLoadingId`, `estimateThreadSubmittingId`, `estimateThreadDraft` + setter, `submitEstimateThreadNote`, `estimateThreadStatsByEstimateId`, `refreshEstimateThreadStatsForEstimateIds`. Bundled into the `estimatesStagesThread` object and passed only to Pipeline buckets.
- **Derived memos:** `filteredRows` (search via `estimateListRowMatchesSearch`), `followupBuckets` (`splitFollowupRows` — **moved to `lib/estimatePipelineRefresh.ts` in v2.2873**: draft→Unsent; sent→Sent; **declined→Declined** (its own bucket, rendered only when non-empty; it used to ride in Sent, J17-N2); customer_accepted→Accepted; superseded omitted; each bucket re-sorted by `updated_at` desc). **v2.2873 (J17-F1):** `listCustomerEvents` (one chunked `estimate_customer_events` fetch for every sent + declined row, `fetchAllRowsChunkedIn` + `groupEventsByEstimateId`), `sentOpenStateById` (`estimateOpenState` per Sent row — the "opened Tue · quiet 2d" / "never opened · sent 7d ago — nudge?" chip; scanner burst filtered), `declinedLabelById` ("Declined by customer · 2d ago"). Both flow into `EstimateListTable`/`EstimateListCards` as optional props; absent → the chip is `computeSentWait` alone.
- **Handlers/loaders:** `load` (useCallback: `estimates` SELECT `*, customers(name, address, contact_info), jobs_ledger(hcp_number)`, optional `.eq('customer_id', …)` from the `?customer=` URL param, order `updated_at` desc, **limit 200** — deliberately **not** joined to `estimate_customer_events`; that is the separate chunked effect above), `createDraft` (resolves master via `resolveMasterUserId`, INSERTs a draft with `line_items_snapshot: [defaultDraftFirstLine()]`, navigates to `/estimates/:number`), `toggleEstimateThreadExpanded`. Effects: load-on-mount/param-change; 320ms-debounced `refreshEstimateThreadStatsForEstimateIds` over visible row ids (gated `listTab === 'followup'`); collapse expanded thread when leaving Pipeline.
- **Supabase tables/edge functions:** `estimates` (SELECT, INSERT), `master_assistants` (SELECT via `resolveMasterUserId`), `estimates_thread_notes` (SELECT/INSERT via the hook). Modals do their own IO (`CreateJobFromEstimateModal` → `create_job_from_estimate` RPC; `CustomerAcceptanceRecordModal`; `EstimateAcceptedNotifySettingsModal` → `lib/estimateAcceptedNotify.ts`).
- **Sub-components:** `EstimateListTable`/`EstimateListCards` (in-file, see above), `EstimateAcceptedNotifySettingsModal`, `CustomerAcceptanceRecordModal`, `CustomerSnapshotModal`, `CreateJobFromEstimateModal` (all **extracted**).
- **External coupling:** `?customer=<id>` deep link (mirrors Jobs' `?customer=`) with a "Filtered by customer / Clear filter" banner; `CreateJobFromEstimateModal.onSuccess` navigates to `/jobs?edit=<jobId>` after `load()`.
- **Extraction status + risk + approach:** Inline. **Low-medium risk.** Once the table/cards move out, the shell is ~440 lines and arguably fine to leave in `Estimates.tsx`; if extracted, move it whole (`EstimatesListPage`) rather than per list-tab — the two tabs share `listSearch`, `filteredRows`, all four modals, and the empty-state labels, so splitting them buys nothing. The four modals and `?customer=` handling stay with the list shell (they are its parent-level concerns).

### `EstimateDetail` — loader + hydration (the future seam)

- **Render location:** not a render region — the `load` useCallback (~2317–2488) + `hydrateCustomerFieldsFromEstimate` + `refetchCustomersAfterEdit` + the reset-on-`routeSegment` effect (~2090–2102) + `loadEstimateCustomerEvents` + the signature signed-URL effect.
- **What `load` does (all in one pass):** fetch `estimates` by `id` (UUID segment) or `estimate_number` with `*, jobs_ledger(hcp_number)`; redirect UUID→number; `setRow`; hydrate `acceptHeaderBrand` (`parseAcceptHeaderBrand`), `terms`, `lines` (`lineItemsFromJson`; empty draft gets `[defaultDraftFirstLine()]`), `customerId`, `validUntil` + `validUntilPreset` (draft default **today+30** via `addCalendarDaysYmd(30)`; `presetMatchingTodayOffset` re-detects 7/15/30), `forAddress`, `internalNotes`; **accept-notify defaulting** — draft with `accept_notify_user_ids === null` defaults to `[user.id, ...all master_technician ids]` (extra `users` SELECT); non-draft resolves the locked ids to display rows (`users` SELECT `id, name, email`); attachment fields — draft edits `customer_attachment_url/label`, sent/accepted parses frozen `customer_attachment_sent` (`parseCustomerAttachmentSent`); restores `lastAcceptUrl` from sessionStorage `estimate_accept_url:<id>`; loads the full `customers` list (SELECT `id, name, address, contact_info, date_met, master_user_id, customer_type, archived_at` ORDER name — unpaginated); derives a default title for generic-titled drafts with a linked customer (`defaultEstimateTitle`).
- **Supabase:** `estimates`, `users` (×2 paths), `customers`, plus per-effect: `estimate_customer_events` (SELECT, reloaded on window focus while sent/accepted), storage bucket `estimate-acceptor-signatures` (`createSignedUrl(path, 3600)`), `app_settings` (SELECT keys in `ESTIMATE_EXPERIENCE_APP_KEY_LIST`), `estimate_catalog_items` (via `fetchEstimateCatalogLive`), `users` role list for `notifyUserOptions` (roles: assistant, controller, master_technician, subcontractor, helpers, estimator, primary, superintendent; devs additionally see other devs).
- **Extraction status + risk + approach:** **This is Step 2 (the seam), not a component.** Extract into `src/hooks/useEstimateDetailData.ts` returning `{ row, loading, load, customers, customersLoading, refetchCustomersAfterEdit, …all hydrated field states + setters }` that `EstimateDetail` destructures — downstream references unchanged. **High risk** if attempted mid-flight with regions still inline; do it before any draft-cluster component move. The `routeSegment`-reset effect and the `#estimate-job` hash-scroll effect stay with the hook/parent respectively.

### `EstimateDetail` — draft customer picker + notes (`isDraft` header block, ~3383–3597)

- **Render location:** `{isDraft && (...)}` block at the top of the return — customer combobox, selected-customer card (email/phone/notes), edit-customer link.
- **Owned local state:** `customerSearch`, `sendEmailOverride`, `emailOverrideRevealed` (reset on `customerId` change), `createCustomerOpen`, `customerNotesExpanded` (reset on `customerId` change), `customerSearchHighlight`, refs `customerSearchSectionRef`, `sendEmailOverrideInputRef`, `lastCustomerGateToastAt`, `customerGateHighlightTimerRef`.
- **Cross-region/shared state:** `customerId` (read by saveDraft/send/title derivation/for-address placeholder/create-job prefill — **stays in parent**), `customers` + `customersLoading` (cache), `forAddress`, `title` (auto-derived on select), `row`.
- **Derived:** `selectedCustomer`, `crmEmailForSelected` (`extractContactFromCustomer`), `showSendEmailOverride` (draft + customer + no CRM email), `draftNeedsCustomer` (= `isDraft && !customerId`, drives both `EstimateDraftCustomerGate` wrappers), notes-preview derivations (`recentNotePreviewText`, `showRecentCustomerNotePreview`, `draftNotesToggleLabel`).
- **Handlers:** `handleSelectCustomer` (clears `forAddress`, sets id/search, clears override when CRM email exists, **title auto-derivation**: replaces generic titles or the previous customer's default title with `defaultEstimateTitle(c.name)`), `handleCustomerSearchChange` (deselects when text no longer matches), `openDraftCustomerForEdit` (via `useEditCustomerModal` context — `onSaved` refetches, `onDeleted`/`onMerged` patch the cache in `queueMicrotask`), `requestCustomerFirst` (gate feedback: 700ms toast throttle, scroll + 2400ms pulse highlight, focus the combobox input), `resolveCustomerEmailForPersist`.
- **Hooks:** `useCustomerContactsForCustomer(customerNotesQueryCustomerId, …)` — customer notes entries; only queried while draft + customer selected.
- **Sub-components:** `CustomerSearchCombobox`, `NewCustomerForm` (create-customer modal at the bottom of the file feeds `handleSelectCustomer`), `CustomerNotesTable` (**all extracted**), `filterActiveCustomersForPicker` (lib).
- **Supabase:** `customers` (via cache + `refetchCustomersAfterEdit`); notes tables via the hook.
- **External coupling:** the **autosave-on-customer-change effect** (see quirks #6) and `EstimateDraftCustomerGate` both live at parent level and reference this region's state.
- **Extraction status + risk + approach:** Inline. **Medium-high risk** — the title-derivation and autosave interplay is subtle. Extract after the seam hook exists → `EstimateDraftCustomerSection`; `customerId`, `customers`, `title`, `forAddress` remain parent-owned controlled props; the gate + autosave effect stay in the parent.

### `EstimateDetail` — draft editor body (`isDraft &&` block, ~3657–4757)

- **Render location:** `AcceptHeaderBrandPicker` with four slots (`documentTitleSlot`, `forFieldSlot`, `expiresOnSlot`, `lineItemsSlot`), then Supporting-document fieldset, "Email when customer accepts" fieldset, Internal notes, and the Save draft / Send to customer / Delete draft button row. Wrapped in `EstimateDraftCustomerGate`.
- **Owned local state:** `draftTitleEditing` (+ `titleInputRef`, focused via `useLayoutEffect`), `validUntilPreset`, `attachmentCheckStatus`/`attachmentCheckMessage` (reset when `customerAttachmentUrl` changes), `catalogIconHovered`, `lineItemRecentIds` (localStorage-backed via `estimateLineItemRecentsStorageKey(user.id)` / `loadRecentCatalogIds` / `persistRecentCatalogIds`).
- **Cross-region/shared state:** the whole draft form cluster — `title`, `terms`, `lines`, `validUntil`, `forAddress`, `internalNotes`, `customerAttachmentUrl`/`customerAttachmentLabel`, `acceptHeaderBrand`, `acceptNotifyUserIds`, `cxOverrideFields` (written by the CX section, read by `saveDraft`), `saving`, `sending`, `customerId`, `row`.
- **Derived memos:** `totalCents` (`sumLineItems(lines)`), `lineItemRecentChips` (`resolveRecentChips` minus default-stub shapes), `customerAttachmentPreview` (draft: normalized live fields; else frozen `customer_attachment_sent`), `customerAttachmentUrlIsCheckable`, `acceptNotifyOtherSelectOptions` (role-bucketed: masters → Assistants → Superintendents → Everyone else, with separators via `estimateAcceptNotifySeparatorLabel`), `acceptNotifyOtherIds`.
- **Handlers:** `updateLine` (quantity coerced to 1 when ≤ 0; recomputes `amount_cents` via `computeEstimateLineExtendedCents`), add line (`emptyDraftLine`), remove line, `applyFromCatalogEntry` (replaces a trailing stub line — `isReplaceableStubLine`/`isBlankDraftLine` — else appends; records the recents pick), `saveDraft(options?: {quiet})` (UPDATE `estimates` **gated `.eq('status','draft')`**; validates attachment URL; persists all draft fields incl. `customer_experience_overrides` payload and de-duped `accept_notify_user_ids`; reloads), `sendToCustomer` (re-fetches the customer if missing from cache; requires an email — CRM or `sendEmailOverride`, `SEND_EMAIL_RE`; `saveDraft()` first; then **direct `fetch` to edge function `send-estimate-to-customer`** with session JWT + anon apikey; on success stores `accept_url` in state + sessionStorage and copies to clipboard when not emailed; reloads), `resendCustomerLink` (v2.2856, sent rows only — gated by the shared kernel [`canResendEstimateLink`](../supabase/functions/_shared/estimateLinkResend.ts) via the `resendVerdict` memo; same edge function with `mode: 'resend'`; on success stores the new `accept_url` in state + sessionStorage, sets `resentInfo` so [`EstimateResendLinkPanel`](../src/components/estimates/EstimateResendLinkPanel.tsx) shows the URL once with a Copy button, toasts "Link resent to <email>", records `ui_nav_clicks` `estimate_link_resent`, reloads; `resentInfo` clears on row change), `deleteDraft` (`window.confirm`; DELETE gated `.eq('status','draft')`), `checkCustomerAttachmentUrl` (→ [`checkGoogleDriveAttachmentUrl`](../src/lib/checkGoogleDriveAttachmentUrl.ts) → edge function `check-estimate-attachment-url`; hint-only, never blocks send).
- **Supabase/edge:** `estimates` (UPDATE/DELETE), `customers` (single re-fetch in send), edge functions `send-estimate-to-customer`, `check-estimate-attachment-url`.
- **Sub-components:** `AcceptHeaderBrandPicker`, `AutosizeTextarea`, `SearchableMultiSelect`, `EstimateCustomerAttachmentCard` (**all extracted**); the line-item rows, expires-on 7/15/30 preset buttons, and both fieldsets are inline.
- **External coupling:** `staffResolvedExperience?.docLineItemsHeading/docTermsHeading` (CX section memo) label the draft's own headings; `customerAttachmentPreview` is also rendered by the accepted view and the CX preview.
- **Extraction status + risk + approach:** Inline. **High risk — extract last of the draft cluster.** Everything it owns is also read by `saveDraft`/`sendToCustomer`, which in turn are invoked from the button row here; the clean seam is to move the whole block + `saveDraft`/`sendToCustomer`/`deleteDraft` together as `EstimateDraftEditor`, taking the seam hook's state/setters as props. Stage A first: the accept-notify role bucketing, `catalogEntryToLineItem`, stub-line predicates, and `updateLine`'s patch logic are all pure (see inventory).

### `EstimateDetail` — line item catalog modal (`catalogModalOpen`, ~3876–4237)

- **Render location:** modal inside `lineItemsSlot`, gated `catalogModalOpen`; opener is the catalog icon button next to "+ add line"; recents chips render beside the Line items heading.
- **Owned local state (the `catalog*` cluster, ~11 states):** `catalogModalOpen`, `catalogModalTab: 'pick' | 'edit'`, `catalogEditRows`, `catalogSaveBusy`, `catalogEventsByItemId`, `catalogHistoryOpenId`, `catalogHistoryLoadingId`, `catalogEditorNames: Map`, `catalogFilter`, `catalogIconHovered`; plus effects: Escape-closes, clear-filter-on-open/collapse-history-on-close, un-hover when disabled.
- **Cross-region/shared state:** `catalogLineItems` (also feeds `lineItemRecentChips` in the draft editor — stays in parent or the seam hook), `canManageEstimateCatalog` (= role in `ESTIMATE_CATALOG_EDITOR_ROLES`), `lines` (written via `applyFromCatalogEntry`), `lineItemRecentIds`.
- **Derived memos:** `catalogFiltered` (multi-field filter incl. formatted money).
- **Handlers/loaders:** `loadCatalogFromDb` (`fetchEstimateCatalogLive` → `catalogDbRowsToLineItems`), `loadHistoryForCatalogItem` (`fetchEstimateCatalogEvents` + `loadEditorDisplayByUserId`), `catalogEventSummary` (pure event formatter: create/update/delete/restore), `saveCatalogEdits` (`replaceEstimateCatalogFromPayload`, then reload + flip to pick tab), inline row editors (quantity coerced ≥ 1, unit dollars→cents rounding).
- **Supabase (via [`lib/estimateCatalogApi.ts`](../src/lib/estimateCatalogApi.ts)):** `estimate_catalog_items` (live SELECT `deleted_at IS NULL` + replace-from-payload writes), `estimate_catalog_item_events` (history SELECT), `users` (editor names).
- **Sub-components:** none inside; entirely inline JSX.
- **External coupling:** only `applyFromCatalogEntry` and the shared `catalogLineItems` cache cross the boundary.
- **Extraction status + risk + approach:** Inline. **Low risk — extract second** (the momentum-builder for the detail side). New `src/components/estimates/EstimateLineItemCatalogModal.tsx` owning the whole `catalog*` cluster; props: `open`, `onClose`, `catalogLineItems`, `onReloadCatalog` (= `loadCatalogFromDb`), `canManage`, `onInsert(entry)` (= `applyFromCatalogEntry` minus the modal-close, which moves inside). Stage A first: `catalogEventSummary` → `lib/estimates/estimateCatalogEventSummary.ts` + test; `catalogEntryToLineItem` + `emptyCatalogEditRow` join the draft-line lib.

### `EstimateDetail` — sent/accepted view (`!isDraft &&`, ~4759–4981)

- **Render location:** `{!isDraft && (...)}` block — locked notify-recipients card, then per-status: `customer_accepted` renders `EstimateCustomerDocument` + acceptance record (name / at / IP / signature) + Customer activity + Job section; `sent` renders Customer activity (default open) + `EstimateResendLinkPanel` (v2.2856) + `EstimateCustomerAcceptLinkButtons` + **`EstimateRecordDeclineControl`** (v2.2873 — "Record a decline (phone / in person)" → RPC `record_estimate_decline`); **`declined`** (v2.2873) renders a "Declined." note + Customer activity (the events loader now runs for `declined` rows too; the `declined` event renders as "Declined by customer — “reason”" / "Declined — office heard it by phone — “note”"). Above it, a small read-only header block (`For:` line, acceptance-page logo, `EstimateLineItemsTable`) renders for `sent`/`declined`/`superseded` (gate `!isDraft && row.status !== 'customer_accepted'`).
- **Owned local state:** `unlinkingJob`, `unlinkJobConfirmOpen`, `createJobModalOpen`, `acceptorSignatureSignedUrl` (effect: signed URL from bucket `estimate-acceptor-signatures`, 3600s), `detailCustomerSnapshotId`.
- **Cross-region/shared state:** `row`, `customers` (customer display name), `estimateCustomerEvents` + `estimateCustomerEventsLoading` (loader + focus-refresh effect at parent level), `acceptNotifyResolvedUsers` (hydrated in `load`), `customerAcceptUrl` memo (state → sessionStorage fallback, validated by `isUsableCustomerAcceptUrl`), `acceptancePreviewForLine`, `acceptanceDocHeaderBrand`, `staffResolvedExperience` (headings), `customerAttachmentPreview`, `linkedCustomerPrefillForCreateJobModal`, `customerId`.
- **Handlers:** `openCreateJobModal`, `openUnlinkJobConfirm`/`closeUnlinkJobConfirm`/`confirmUnlinkLinkedJob` (UPDATE `estimates.job_ledger_id = null` **gated `.eq('status','customer_accepted')`**), `copyCustomerAcceptUrl`, `openCustomerAcceptUrl` (v2.2873: opens `withEstimatePreviewMarker(url)` — `?preview=1` — so the office's own look is not stamped as a customer open; Copy stays the raw link), `recordStaffDecline` (v2.2873: RPC `record_estimate_decline`, toast, `recordNavClick('estimate_declined', '#staff')`, reload row + events).
- **Supabase:** `estimates` (UPDATE unlink), storage `estimate-acceptor-signatures`, `estimate_customer_events` (via parent loader).
- **Sub-components:** `EstimateCustomerDocument` + `estimatePublicLineItems`/`EstimateLineItemsTable`, `EstimateAcceptTypedSignatureLine`, `EstimateDetailCustomerActivitySection` (in-file), `IpAddressMapButton`, `EstimateCustomerAcceptLinkButtons`, `CreateJobFromEstimateModal`, `CustomerSnapshotModal` (**extracted**), unlink-confirm dialog (inline).
- **External coupling:** `#estimate-job` hash deep link scrolls to the Job section (parent effect, 150ms delay); `CreateJobFromEstimateModal.onSuccess` → `load()` then `navigate('/jobs?edit=<jobId>')`; Jobs links use `jobs_ledger.hcp_number` via `estimateLinkedJobHcp`.
- **Extraction status + risk + approach:** Inline. **Medium risk.** Read-mostly; the writes are the two status-gated updates. Extract as `EstimateSentAcceptedView` after the seam; the `#estimate-job` router effect, `estimate_customer_events` loader, and both modals it opens can move with it **only if** nothing else opens them — `CreateJobFromEstimateModal` here is a separate instance from the list's, and `CustomerSnapshotModal` is only opened from this region in detail, so both can move with the tab (playbook: modal opened from only this tab moves).

### `EstimateDetail` — customer experience preview (`<details>` "Customer experience", ~4984–5238)

- **Render location:** `<details>` after the status views, wrapped in the second `EstimateDraftCustomerGate`; inner tabs on `customerPreviewTab: 'email' | 'page' | 'thankyou'`.
- **Owned local state:** `customerPreviewTab`, `appCxSettings` (loaded once from `app_settings`), `lastAcceptUrl` (also written by `sendToCustomer` — shared).
- **Cross-region/shared state:** `cxOverrideFields` + `setCxOverrideFields` (**written here, persisted by `saveDraft`** — the region's main outbound coupling; re-hydrated from `row.customer_experience_overrides` on row change), `row`, `title`, `terms`, `lines`, `totalCents`, `validUntil`, `forAddress`, `acceptHeaderBrand`, `customerAttachmentPreview`, `customerId`/`customers`/`sendEmailOverride` (for `previewEmailTo`), `acceptorSignatureSignedUrl`.
- **Derived memos:** `staffResolvedExperience` (frozen `customer_experience_sent` snapshot via `parseEstimateCustomerExperienceSnapshot`, else `resolveEstimateCustomerExperience(appCxSettings, cxOverrideFields, {acceptUrl, title, estimateNumber})`), `customerEmailPreviewHtml` (`buildEstimateEmailHtml` with optional brand header image), `cxTemplateDefaults` (`mergeEstimateExperienceStrings`), `previewEmailTo`, `previewEmailTitle`, `acceptUrlForTemplatePreview`, `customerAcceptUrl`.
- **Handlers/render fns:** `renderCxDraftSectionFields(section, options)` (the override editor: per-key textarea, blank-or-default removes the override; **`accept_page_footer` supports an intentional empty-string override** via a "Hide company footer" checkbox), `buildCustomerExperienceOverridesPayload`, `acceptanceCxOmitKeys` (hides `doc_valid_through_prefix` when no expiry, `doc_title_fallback` when titled), `openStaffAcceptCustomerPreview` (draft: `writeStaffAcceptPreviewSnapshot(buildStaffAcceptPreviewSnapshot(...))` then opens `/estimate/customer-accept-preview/:number` in a new tab).
- **Supabase:** `app_settings` (SELECT `ESTIMATE_EXPERIENCE_APP_KEY_LIST`).
- **Sub-components:** `EstimateAcceptBody` (`variant="staffPreview"` with no-op form handlers), `EstimateCustomerThankYou`, `EstimateCustomerAcceptLinkButtons` (**extracted**); the email preview card and the override editor are inline.
- **External coupling:** `staffResolvedExperience` headings are read by the draft editor and the accepted document; `lastAcceptUrl` is written by `sendToCustomer`. **Note the dependency direction:** this region computes shared memos consumed elsewhere, so those memos belong in the seam hook, not the extracted component.
- **Extraction status + risk + approach:** Inline. **Medium risk.** Extract as `EstimateCustomerExperienceSection` taking `row`, `isDraft`, the resolved-experience inputs, `cxOverrideFields` + setter, and the draft snapshot fields as props; keep `staffResolvedExperience`/`customerAcceptUrl`/`customerAttachmentPreview` computation in the parent/seam (multi-region consumers). Stage A: `acceptanceCxOmitKeys` → pure `(validUntil, title)` function; the CX config tables (`CX_FIELD_LABELS`, `CX_OVERRIDE_SECTIONS`, `cxOverrideFieldRows`) → `lib/estimates/estimateCxOverrideSections.ts`.

### `EstimateDetail` — page-level modals (~5240–5357)

- **Contents:** create-customer modal (inline overlay hosting `NewCustomerForm`; `onCreated` patches `customers` + `handleSelectCustomer`), unlink-job confirm dialog (inline), `CreateJobFromEstimateModal`, `CustomerSnapshotModal`.
- **Extraction status:** create-customer stays with the draft customer section when it moves (only opener is the combobox's `onRequestCreateNew`); unlink-confirm + `CreateJobFromEstimateModal` + `CustomerSnapshotModal` move with the sent/accepted view (only openers). Nothing here is opened from 2+ regions.

---

## Shared infrastructure

The API surface extracted regions must be handed.

### Route/URL state (parent, permanent)

- The `Estimates()` router: `useParams<{ id }>` → detail vs list. **The URL is the selection pointer.**
- Detail: UUID segment → load by `id` → `navigate('/estimates/:number', { replace: true })`; invalid segment → toast + `/estimates`.
- Detail: `#estimate-job` hash scrolls to the Job section after load (150ms timeout).
- List: `?customer=<id>` filters `load()`; the Clear-filter button deletes the param.
- Outbound: `/jobs?edit=<job_ledger_id>` links, `/estimate/customer-accept-preview/:number` staff preview tab.

### Browser storage

- sessionStorage `estimate_accept_url:<estimateId>` — accept URL captured at send time; restored on load; validated by `isUsableCustomerAcceptUrl` (must be an `/estimate/accept` URL with a `t` param and not the `PREVIEW_EMAIL_ACCEPT_URL` sentinel).
- localStorage `estimateLineItemRecentsStorageKey(user.id)` — recent catalog picks (lib-managed).

### Role gating

- No page-level access gate. `ESTIMATE_CATALOG_EDITOR_ROLES` (dev, master_technician, assistant, controller, estimator, primary, superintendent) gates catalog **editing**; the ⚙ Accepted-notifications button is dev/master only; `resolveMasterUserId` maps assistant-like creators to their master.

### Supabase inventory (whole file)

| Table / function | Verbs | Region |
|---|---|---|
| `estimates` | SELECT (list joins `customers`, `jobs_ledger`; detail joins `jobs_ledger`), INSERT (createDraft), UPDATE (saveDraft draft-gated; unlink accepted-gated), DELETE (draft-gated) | list + detail |
| `customers` | SELECT (full list ×2 loaders + single re-fetch in send) | detail |
| `users` | SELECT (notify options by role list; self role; master_technician defaults; notify display; catalog editor names via lib) | detail |
| `master_assistants` | SELECT (`resolveMasterUserId`) | list (createDraft) |
| `app_settings` | SELECT (`ESTIMATE_EXPERIENCE_APP_KEY_LIST`) | detail CX |
| `estimate_customer_events` | SELECT (+ window-focus refresh) in detail for sent/accepted/declined; **list**: one chunked SELECT for all sent + declined rows (v2.2873, opened/never-opened chip) | list Pipeline + detail |
| RPC `record_estimate_decline` | via `recordStaffDecline` (v2.2873; `(supabase as any).rpc` until gen-types) | detail sent |
| `estimates_thread_notes` | SELECT/INSERT (via `useEstimateThreadNotes`) | list Pipeline |
| `estimate_catalog_items`, `estimate_catalog_item_events` | SELECT/replace-writes (via `lib/estimateCatalogApi.ts`) | detail catalog modal |
| storage `estimate-acceptor-signatures` | `createSignedUrl` | detail accepted |
| edge `send-estimate-to-customer` | direct `fetch` (JWT + anon apikey); `mode: 'resend'` re-mints the link on a sent row (v2.2856) | detail send / Resend link |
| edge `check-estimate-attachment-url` | via `checkGoogleDriveAttachmentUrl` | detail attachment check |
| RPC `create_job_from_estimate` | via `CreateJobFromEstimateModal` (extracted) | list + detail |

### Seam hook candidates

1. **`useEstimateDetailData`** — `row`, `loading`, `load`, `customers` cache + `refetchCustomersAfterEdit`, all hydrated field states/setters, the `routeSegment` reset effect, `loadEstimateCustomerEvents` + focus refresh, the signature signed-URL effect, and the shared memos (`totalCents`, `staffResolvedExperience`, `customerAcceptUrl`, `customerAttachmentPreview`, `acceptancePreviewForLine`, `acceptanceDocHeaderBrand`). The unlock for every detail-region extraction.
2. **`useEstimateThreadNotes`** — already exists; no work needed.
3. Optional **`useEstimateCatalog`** — `catalogLineItems` + `loadCatalogFromDb` + recents; only worth it if the recents chips and modal end up in different components.

---

## Stage-A pure-logic inventory (extract to `lib/*` + tests before any component moves)

| Candidate | Currently | Target |
|---|---|---|
| `estimateListCustomerSubline`, `estimateListCustomerColumnLines`, `estimateListRowMatchesSearch`, `sortEstimatesByUpdatedDesc`, `splitFollowupRows` | module functions in Estimates.tsx | `lib/estimates/estimateListRows.ts` + tests (esp. `declined`→Sent bucketing, superseded omission) |
| `statusLabel`, `formatMoney`, `estimateLinkedJobHcp` | module functions | shared lib (check for existing money/status formatters first) |
| `isDefaultDraftStubShape`, `defaultDraftFirstLine`, `emptyDraftLine`, `isBlankDraftLine`, `isReplaceableStubLine`, `catalogEntryToLineItem`, `emptyCatalogEditRow`, `updateLine` patch logic | module + component-body functions | `lib/estimates/estimateDraftLines.ts` + tests (qty-coerce-to-1, stub replacement, legacy stub shape) |
| `catalogEventSummary` | component-body function | `lib/estimates/estimateCatalogEventSummary.ts` + tests (4 actions × null fields) |
| `isUsableCustomerAcceptUrl`, `normalizeCustomerAcceptUrlCandidate` + the sessionStorage read/write pairs | module functions + inline try/catch | `lib/estimates/estimateAcceptUrlSession.ts` + tests |
| `defaultEstimateTitle`, `isGenericEstimateTitle`, the title-derivation rule in `handleSelectCustomer` | module + inline | `lib/estimates/estimateTitleDerivation.ts` + tests |
| `estimateCustomerEventLabel` | module function | join `estimateAcceptUrlSession` or its own tiny lib |
| accept-notify role bucketing in `acceptNotifyOtherSelectOptions` + `estimateAcceptNotifySeparatorLabel` | 60-line useMemo | pure `groupEstimateNotifyOptions(options, selfId)` → `lib/estimates/estimateNotifyOptions.ts` + tests |
| `acceptanceCxOmitKeys` | closure over `validUntil`/`title` | pure `(validUntilTrimmed, titleTrimmed)` function |
| `CX_FIELD_LABELS`, `CX_OVERRIDE_SECTIONS`, `cxOverrideFieldRows` | module data | `lib/estimates/estimateCxOverrideSections.ts` (data-only; no test needed beyond a shape assertion) |
| `resolveMasterUserId` | module IO function | `lib/estimates/resolveMasterUserId.ts` (takes `supabase` explicitly) |
| `catalogFiltered` predicate | inline in useMemo | pure `filterCatalogItems(items, query)` + test (money-string matching) |
| Already in `lib/` (verify colocated tests exist) | — | `estimateLineItemNormalize`, `estimateCustomerExperience`, `estimateCustomerAttachment`, `estimateLineItemRecents`, `estimateRouteSegment`, `addCalendarDaysYmd`, `estimateEmailHtmlPreview`, `formatEstimateListUpdated`, `estimateStaffAcceptPreview`, `estimateAcceptHeaderBrand`, `estimateCatalogApi` |

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **Every status-changing write is status-gated**: `saveDraft` UPDATE and `deleteDraft` DELETE carry `.eq('status','draft')`; `confirmUnlinkLinkedJob` carries `.eq('status','customer_accepted')`. These are race guards against the customer accepting mid-edit — keep them.
2. **UUID → number redirect** uses `replace: true` so back-button history stays clean; the redirect check compares `String(r.estimate_number) !== routeSegment` *inside* the UUID branch.
3. **Accept URL is session-scoped by design**: it exists only in `lastAcceptUrl` state + sessionStorage (`estimate_accept_url:<id>`), never in the DB read path. `customerAcceptUrl` returns null in other sessions — the copy/open buttons render their disabled/absent state accordingly.
4. **Draft accept-notify default = self + ALL master_technicians** (extra `users` query, only when `accept_notify_user_ids IS NULL` and status is draft); the fallback on query failure is `[user.id]` alone. Non-draft shows the locked list ("This list was locked when the quote was sent").
5. **Title auto-derivation is conditional**: selecting a customer overwrites the title only when it is generic (`''`/`'New estimate'`/`'Estimate'`) **or** exactly equals the previous customer's `defaultEstimateTitle` — a hand-edited title is never clobbered. `saveDraft` persists `title.trim() || 'Estimate'`.
6. **Autosave fires only on customer-link change** (`prevCustomerIdForAutosave` ref; `undefined` sentinel skips the first run after load/navigation), calls `saveDraft({ quiet: true })`, and deliberately has an incomplete dep array (`eslint-disable react-hooks/exhaustive-deps`) so it reads the latest form state via closure without saving per keystroke.
7. **Draft `valid_until` defaults to today+30** with the 30-day preset lit; typing a date re-detects presets via `presetMatchingTodayOffset`. Non-draft never shows presets.
8. **Attachment duality**: drafts edit `customer_attachment_url`/`customer_attachment_label`; sent/accepted read the frozen `customer_attachment_sent` JSON (`parseCustomerAttachmentSent`). Same duality for CX copy: `customer_experience_sent` snapshot wins over live resolution in `staffResolvedExperience`.
9. **`accept_page_footer: ''` is a meaningful override** ("hide the footer for this quote"), set via a dedicated checkbox — the generic "blank removes the override" rule does NOT apply to it. `buildCustomerExperienceOverridesPayload` must keep empty-string entries for this key (it round-trips through `parseEstimateExperienceOverrides`).
10. **Send flow ordering**: `saveDraft()` runs before the edge call (so the frozen snapshots match the screen); when the edge function reports `emailed: false` but returns `accept_url`, the URL is auto-copied to the clipboard; the attachment "Check link" is advisory only and never blocks sending.
11. **`updateLine` and the catalog edit rows coerce quantity ≤ 0 (or NaN) to 1**; unit price inputs are dollars in the UI, rounded to cents (`Math.round(... * 100)`); `amount_cents` is always recomputed via `computeEstimateLineExtendedCents`, never trusted from input.
12. **Empty draft line-items hydrate to `[defaultDraftFirstLine()]`** ("Custom Service Visit" stub), and `isDefaultDraftStubShape` recognizes BOTH the new shape (default in `line_item`) and the legacy shape (default in `description`) so catalog inserts replace either.
13. **`declined` estimates bucket into "Sent"** on the Pipeline tab; `superseded` is omitted entirely; each bucket independently re-sorts by `updated_at` desc.
14. **One `listSearch` state serves both list tabs** — the query persists across the Pipeline↔Ledger switch (two separate input elements, same state).
15. **`estimate_customer_events` refresh on window focus** (only while sent/accepted) so staff see link-view events after tabbing back from email.
16. **`EstimateDraftCustomerGate` appears twice** (draft body + Customer experience section) with the same `draftNeedsCustomer`/`requestCustomerFirst` pair; `requestCustomerFirst` throttles its toast to one per 700ms and pulses the combobox for 2400ms.
17. **`customers` is loaded unpaginated** (full table, ordered by name) in both `load` and `refetchCustomersAfterEdit`; `filterActiveCustomersForPicker(customers, customerId)` keeps the archived-but-selected customer visible in the picker.
18. **Signature display fallback chain** (accepted): signed-URL image → "(loading preview…)" while the path exists but the URL hasn't resolved → `EstimateAcceptTypedSignatureLine` when only a printed name exists.
19. **List queries cap at 200 rows** (`.limit(200)`, newest first) — no pagination UI.
20. **`EstimateListTable`'s expanded-thread row uses `threadColSpan = 6 + (showCustomerColumn ? 1 : 0)`** — update it if columns change.
21. **`createDraft` inserts `title: ''`** (not the 'Estimate' fallback) so the customer-select title derivation can claim it as generic.

---

## Recommended extraction order (value ÷ risk)

1. **Stage-A sweep** — the [pure-logic inventory](#stage-a-pure-logic-inventory-extract-to-lib--tests-before-any-component-moves) above; each independently shippable. Highest leverage: `estimateListRows` (feeds step 2), `estimateDraftLines`, `estimateNotifyOptions`.
2. **`EstimateListTable` + `EstimateListCards` → `components/estimates/EstimateListTable.tsx`** — zero owned state, props seam already exists; pure file move plus the shared style constants. Removes ~695 lines and validates nothing else because there is nothing to validate — it's free.
3. **Line item catalog modal → `EstimateLineItemCatalogModal.tsx`** — the detail side's momentum builder: 11-state self-contained cluster, one outbound callback (`onInsert`). ~360 JSX lines + handlers.
4. **Seam: `useEstimateDetailData`** — lift `load`, hydration, the `customers` cache, `loadEstimateCustomerEvents`, the signature effect, and the shared memos into the hook; `EstimateDetail` destructures it (downstream references unchanged). No JSX moves in this step.
5. **Sent/accepted view → `EstimateSentAcceptedView.tsx`** — read-mostly; takes the hook's values + `onReload`; brings its own modals (unlink confirm, `CreateJobFromEstimateModal`, `CustomerSnapshotModal`) since nothing else opens them. The `#estimate-job` hash effect stays in the parent.
6. **Customer experience preview → `EstimateCustomerExperienceSection.tsx`** — owns `customerPreviewTab` + the override editor; `cxOverrideFields` stays parent-owned (persisted by `saveDraft`), passed as controlled prop + setter; `staffResolvedExperience` and friends come from the hook.
7. **Draft customer section → `EstimateDraftCustomerSection.tsx`**, then **draft editor → `EstimateDraftEditor.tsx`** (with `saveDraft`/`sendToCustomer`/`deleteDraft`) — last, after everything they feed is already consuming the seam. The gate + autosave effect stay in the parent.
8. **Optionally** move the slimmed `EstimateList` shell to its own file; the `Estimates.tsx` that remains is the router + `EstimateList` shell + `EstimateDetail` shell.

**What must STAY in the parent(s):** the `Estimates()` route split; the UUID→number redirect + not-found navigation (inside `load`/the hook); the `#estimate-job` hash-scroll effect; `?customer=` handling and its banner (list shell); `customerId` + `customers` cache + `title`/`forAddress` and the rest of the draft form cluster (controlled props via the seam hook); `draftNeedsCustomer`/`requestCustomerFirst` (both gate instances reference them); `lastAcceptUrl` + its sessionStorage sync (written by send, read by CX section); the list's four modals (opened from both list tabs).

Definition of done per region, verification gates, and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) (`npm run typecheck && npm run lint && npm test` green after every step; behavior-preserving only).
