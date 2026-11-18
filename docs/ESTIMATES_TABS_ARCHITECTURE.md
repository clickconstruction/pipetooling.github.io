# Estimates Tabs Architecture Map

---
file: docs/ESTIMATES_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Map of the Estimates surface after its 2026-11-17 decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — where each region of what was a 5,423-line src/pages/Estimates.tsx lives now, what the 1,781-line page still holds, what each piece owns and is handed, the supabase surface, the quirks a change must keep, and what is left to cut. Sections — What this surface is; Master summary table; Per-region dossiers; Shared substrate; Kernels; Preserve-quirks list; What is left; Hazards.
covers:
  - src/pages/Estimates.tsx
  - src/hooks/useEstimateDetailData.ts
  - src/components/estimates/EstimatesListPage.tsx
mapped_at: b32a7beb25
audience: Developers, AI Agents
last_updated: 2026-11-17
---

> **Line numbers are exact as of `b32a7beb25`** (from the `npm run map -- src/pages/Estimates.tsx` fact sheet) and rot with the next edit — search the symbol; the range is only a hint. Re-run `npm run map` before trusting a range.

## What this surface is

The Estimates surface is two pages behind a 5-line router in [`src/pages/Estimates.tsx`](../src/pages/Estimates.tsx): the list at `/estimates` and the detail page at `/estimates/:id`, where `:id` is a quote number (canonical) or a UUID (redirected to the number). The address is the only thing they share.

```tsx
export default function Estimates() {
  const { id: routeSegment } = useParams<{ id: string }>()
  if (routeSegment) return <EstimateDetail routeSegment={routeSegment} />
  return <EstimatesListPage />
}
```

**The page file is 1,781 lines**: 15 `useState`, 9 effects, 14 `useMemo` + 5 `useCallback`, 7 `useRef`, 10 custom-hook calls; 3 components (`EstimateDraftCustomerGate` 200–224, `EstimateDetail` 226–1776, `Estimates` 1778–1782). It is the router and the **detail page's wiring**: the rail, the two customer gates, the customer and option handlers, the send flow, the previews' memos and every window's open state. The engine, the sent side, the list and each large block of markup are their own files.

| File | Lines | What it is |
|---|---|---|
| [`src/pages/Estimates.tsx`](../src/pages/Estimates.tsx) | 1,781 | the router + `EstimateDetail`'s wiring and what is left of its markup |
| [`src/hooks/useEstimateDetailData.ts`](../src/hooks/useEstimateDetailData.ts) | 721 | the detail page's engine: the row, the form it opens as, the reads, the save, both autosaves, the leave rule |
| [`src/hooks/useEstimateSentActions.ts`](../src/hooks/useEstimateSentActions.ts) | 264 | the sent side's presses: decline, extend with the letter again, resend, unlink |
| [`components/estimates/EstimatesListPage.tsx`](../src/components/estimates/EstimatesListPage.tsx) | 739 | the list: Pipeline and Ledger |
| [`components/estimates/EstimateSentView.tsx`](../src/components/estimates/EstimateSentView.tsx) | 521 | a sent, accepted or declined estimate's screen, with the Unlink job window |
| [`components/estimates/EstimateDraftLineItems.tsx`](../src/components/estimates/EstimateDraftLineItems.tsx) | 414 | Line items / Impact on cost on a draft |
| [`components/estimates/EstimateCustomerExperienceSection.tsx`](../src/components/estimates/EstimateCustomerExperienceSection.tsx) | 356 | the three previews, with `EstimateCxOverrideFields.tsx` (120) under each on a draft |
| [`components/estimates/EstimateDraftCustomerSection.tsx`](../src/components/estimates/EstimateDraftCustomerSection.tsx) | 318 | the customer box on a draft |
| [`components/estimates/EstimateOptionsStrip.tsx`](../src/components/estimates/EstimateOptionsStrip.tsx) | 254 | the option cards and the viewed option's row |
| `EstimateDeliverySection.tsx` · `EstimateSupportingDocumentFieldset.tsx` · `EstimateCustomerActivitySection.tsx` · `EstimateSentHeader.tsx` · `EstimateChangeOrderFields.tsx` | 177 · 160 · 118 · 103 · 79 | the smaller draft and sent pieces |
| `estimatesPageCss.ts` · `estimatesPageStyles.ts` | 37 · 100 | the stylesheet strings and style factories both pages use |

**How it got here.** ~5,365 lines at v2.1088 → 6,982 at the first map (2026-09-25) → 5,201 after the first pass (the list table, the catalog window, the first kernels) → 5,423 on 2026-11-17, seven features later. That day's re-map found the sent side reads no draft state, and the owner asked for all eight of its cuts: five kernels (v2.7596, v2.7601, v2.7605, v2.7607, and v2.7622's), a render smoke of the page (v2.7610), the sent side (v2.7613), two fieldsets (v2.7618), the customer experience section (v2.7622), the options strip (v2.7624), the engine as a hook (v2.7627), the list's own file (v2.7629) and the draft editor's pieces (v2.7633). Each version's fragment under `docs/recent-features/` says what moved, what stayed and why.

**Churn:** hot — 85 commits in 90 days. New features have landed as extracted components with tests, the page gaining only wiring; the sent side is where they land most.

### How to read a dossier

Each lists: the file and its anchor (as of `b32a7beb25`), what it **owns**, what it is **handed**, its supabase surface, its tests, and what a change there must keep.

---

## Master summary table

| Region | Where it lives | Size | Owns state? | Tests | Left to do |
|---|---|---|---|---|---|
| Router | `Estimates()` 1778–1782 | 5 | no | the page smoke | nothing |
| List (Pipeline + Ledger) | `EstimatesListPage.tsx` | 739 | yes — all 14 of its states | page smoke (2 cases), `estimatePipelineRefresh`, `estimateListRows`, `EstimateListTable.render` | `useEstimateThreadNotes` has no test |
| Detail: the engine | `useEstimateDetailData.ts` | 721 | yes — the row, the form cluster, the reads, `saving` / `sending`, `lastAcceptUrl` | page smoke (8 engine cases), `estimateDetailHydration`, `estimateDraftPersist`, `useJobFormAutosaveSlice.*` | a quiet reload (the owner's call) |
| Detail: wiring | `EstimateDetail` 226–1089 | 864 | 15 window and screen states | page smoke | the send flow's handlers could join a hook of their own |
| Detail: step rail + customer view | `railData` 538–565 · `handleRailStepClick` 567–580 · `railStepDot` 583–591 · render 1098–1109, 1206–1252 | ~110 | `railFlashStep`, `customerViewOn` | `estimateDraftSteps` | stays |
| Detail: send flow | `sendToCustomer` 830–889 · `sendEstimateEmailAnswer` 897–929 · `sendEstimateEmail` 932–940 · `tellSheet` 1053–1079 | ~130 | `tellEstimate` | `sendEstimateIo` (15), `estimateSendPlan` (12), page smoke (a change order's send) | the Tell sheet's path has no page case |
| Detail: draft customer | `EstimateDraftCustomerSection.tsx`, mounted 1110–1145; handlers 400–424, 440–468, 800–828 | 318 + ~90 | no — 33 values handed in | page smoke | its own state once the reload is quiet |
| Detail: draft editor | markup 1204–1641: the customer view, the title editor 1259–1339, the For and Expires slots, the mounts below, the attachment card 1475–1528, Terms, the button row | 438 | `draftTitleEditing` | page smoke | leave |
| ↳ options | `EstimateOptionsStrip.tsx`, mounted 1437–1453; handlers 493–520 | 254 | no | `estimateOptionsEditor` (19), `EstimateOptionsStrip.render` (8), page smoke | — |
| ↳ change-order fields | `EstimateChangeOrderFields.tsx` | 79 | no | page smoke | — |
| ↳ line items | `EstimateDraftLineItems.tsx`; `updateLine` 1010–1018, `applyFromCatalogEntry` 1028–1048 | 414 | no | `estimateDraftLines`, page smoke | — |
| ↳ supporting document | `EstimateSupportingDocumentFieldset.tsx` | 160 | no | its render test (5) | — |
| ↳ delivery | `EstimateDeliverySection.tsx` | 177 | no (two memos) | its render test (5) | — |
| Detail: sent side | `EstimateSentHeader.tsx` + `EstimateSentView.tsx` (mounted 1644–1672) + `EstimateCustomerActivitySection.tsx` over `useEstimateSentActions` | 103 + 521 + 118 + 264 | the hook owns six busy and window states | page smoke (7 cases), each control's render test | — |
| Detail: customer experience | `EstimateCustomerExperienceSection.tsx` + `EstimateCxOverrideFields.tsx`; memos 594–605, 702–722, 756–798 stay | 356 + 120 | no | `estimateCxOverrideSections` (14), `EstimateCxOverrideFields.render` (5), page smoke (3) | — |
| Detail: windows | create customer 1709–1751, Create job, the customer snapshot | ~70 | their open state is the page's | `CreateJobFromEstimateModal.render` | move with a quiet reload |

---

## Per-region dossiers

### The list — `EstimatesListPage.tsx`

- **What it is:** `/estimates`, moved whole (v2.7629). Two tabs on `listTab: 'followup' | 'all'` (labels **Pipeline** and **Ledger**; DOM ids `estimates-tab-stages` / `estimates-tab-ledger`). The header (⚙ for `canOpenBillingNotifications`, **New change order**, **New estimate**), the `?customer=` banner, the Ledger's filters and totals, the Pipeline's four lanes with the empty-draft sweep, and four windows. Both tabs draw `EstimateListTable` / `EstimateListCards` ([`EstimateListTable.tsx`](../src/components/estimates/EstimateListTable.tsx), 1,003 lines; the card variant by `useNarrowViewport640`).
- **Owns:** all its state — `listTab`, the Ledger's three filters, `listSearch` (**one state for both tabs**), `rows`, `loading`, `creating`, the three window states, `listCustomerEvents`, `cleaningEmpties`; and the [`useEstimateThreadNotes`](../src/hooks/useEstimateThreadNotes.ts) engine for the Pipeline's threads.
- **Reads and writes:** `load` (`estimates` `*, customers(name, address, contact_info), jobs_ledger(hcp_number)`, optional `?customer=`, newest first, **limit 200**); one chunked `estimate_customer_events` read (best effort); `cleanUpEmptyDrafts` (bulk DELETE, draft-gated); `createDraft(projectId?, docKind, trigger)` (the company owner via `resolveMasterUserId`, INSERT, then navigate with `state.freshEstimateDraft`); the `?newEstimate=true&project=` deep link, which `src/lib/search/doors.ts` names this file for.
- **Not cut per tab:** the tabs share the search, the filtered list, the windows and the empty words.

### The engine — `useEstimateDetailData({ routeSegment })`

- **What it is:** every statement of `EstimateDetail` that loads or saves, moved whole and in the page's own order (v2.7627), so the effects fire as they did. The page calls it first and destructures 72 names.
- **Owns:** `row`, `loading`; the draft form cluster (`title`, `terms`, `lines`, `estimateOptions` / `viewedOptionKey` / `previewSelectedOptionKeys`, `coFields`, `customerId`, `customerSearch`, `sendEmailOverride`, `validUntil` + preset, `forAddress`, `linkedProjectId`, `internalNotes`, the attachment pair with Check link's answer, `acceptHeaderBrand`, `cxOverrideFields`, `acceptNotifyUserIds`); the `customers` cache; `catalogLineItems`, `notifyUserOptions`, `acceptNotifyResolvedUsers`, `projectsForPicker`, `appCxSettings`, the customer's events, the signature's signed URL; `saving`, `sending`, `lastAcceptUrl`.
- **The loader:** `load({ refresh? })` 268 — reads `estimates` (`*, jobs_ledger(hcp_number)`) by `id` or `estimate_number`; invalid or missing → toast + `/estimates`; UUID → number redirect; stamps `freshDraftRowIdRef`; sets the form from `estimateFormFromRow` (`lib/estimates/estimateDetailHydration.ts`); reads the master technicians for a draft that never had a notify list, the locked list's names on a sent row, then the **whole `customers` table**. `{ refresh: true }` skips the `loading` flag, so the page and the Tell sheet stay mounted.
- **The save:** `buildDraftPersistPayload` 467 (the hand-off to the tested `buildEstimateDraftPersistPayload`), the held dates, `saveDraft({ quiet?, skipReload? })` 503, the customer-change autosave 544, `useJobFormAutosaveSlice` 566, the fresh-draft leave rule 581, the flush when the tab hides 626.
- **Supabase:** `estimates` (SELECT; UPDATE and the leave rule's DELETE, both `.eq('status','draft')`), `users` (five reads), `customers`, `projects`, `app_settings`, `estimate_customer_events`, `estimate_catalog_items` (via `fetchEstimateCatalogLive`), storage `estimate-acceptor-signatures`; edge `check-estimate-attachment-url` (via `checkGoogleDriveAttachmentUrl`).
- **Must keep:** the three things in its header comment — one payload for the save and the autosave's baseline; `saveDraft`'s reload and the autosave's skip of it; the leave rule keyed on the route. And the statement order: a reordered effect is a behaviour change.

### The page's wiring — `EstimateDetail` 226–1089

- **State (15):** `emailOverrideRevealed`, `createCustomerOpen`, `createJobModalOpen`, `customerPreviewTab`, `tellEstimate`, `catalogModalOpen`, `catalogIconHovered`, `lineItemRecentIds`, `draftTitleEditing`, `customerNotesExpanded`, `detailCustomerSnapshotId`, `customerSearchHighlight`, `railFlashStep`, `customerViewOn`, `whatWentRevision`.
- **Effects (9):** `?createJob=1` 312–319; the two resets on a customer change 351, 379; the page's half of the reset on a new estimate 356–359; the `#estimate-job` / `#extend-good-through` scroll 361–377; the title editor's focus 383; the recents 388; the catalog icon 396; the gate's highlight 461.
- **Memos that stay because several pieces read them:** `customerAttachmentPreview` 470, `syncedEstimateOptions` 485, `railData` 538, `previewEmailTo` 594, `customerAcceptUrl` 611, `acceptancePreviewForLine` 619, `rowOfferedOptions` 631, `acceptanceDocHeaderBrand` 635, `staffResolvedExperience` 702, `buildEstimatePdf` / `estimatePdfFiling` 730–753, `customerEmailPreview` 756, `cxTemplateDefaults` 795.
- **Handlers:** the customer's (`openDraftCustomerForEdit` 400, `requestCustomerFirst` 440, `handleSelectCustomer` 800, `handleCustomerSearchChange` 814); the option moves 493–520, which apply `lib/estimates/estimateOptionsEditor.ts`; the rail's; the send flow's; `publishCoToBidRoom` 952–992 (`pickBidRoomForChangeOrder`, save, RPC `publish_co_to_bid_room`); `deleteDraft` 994; `updateLine` 1010; `applyFromCatalogEntry` 1028.
- **The loading return** 1081–1089 draws only the keyed `tellSheet` and *Loading…*: it unmounts everything else.

### The send flow — `sendToCustomer` 830–889

- Checks (a held date, a customer, the customer re-read when missing from the cache), then asks `estimateSendPlan` (`lib/estimates/estimateSendPlan.ts`): refuse with its reason; a normal estimate above $0 sent by an office role opens **Tell the customer** (`setTellEstimate`); every other send gets one confirm that names the recipient.
- `sendEstimateEmailAnswer(email, 'send' | 'resend')` 897–929 saves first (skipping its reload), calls `postSendEstimate` with a 20-second timeout, reads the reply with `sendEstimateAnswerFrom`, stores the link, copies it when no email went, then `load({ refresh: true })` outside the send's verdict.
- The text leg (`quo-send`, the share link) lives inside `TellCustomerSheet`.

### The sent side — `useEstimateSentActions` + `EstimateSentView`

- **The hook** takes `{ row, user, role, load, loadEstimateCustomerEvents, setLastAcceptUrl, bumpWhatWent, showToast }` and owns `recordingDecline`, `extendingGoodThrough`, `resending`, `resentInfo`, `unlinkingJob`, `unlinkJobConfirmOpen` and the three verdicts. Its presses: `recordStaffDecline` (RPC `record_estimate_decline`), `extendGoodThrough` (RPC `extend_estimate_good_through`, then `postSendEstimate` in `remail` when ticked), `resendCustomerLink` (`postSendEstimate` in `resend`), and the unlink (UPDATE `job_ledger_id = null`, `.eq('status','customer_accepted')`). Every press returns early unless the row is sent or accepted.
- **The view** draws What went, the locked notify list, the paper or its total, the customer line, the acceptance record and the Job section on an accepted row, the link's presses on a sent row, the note on a declined row, and the Unlink job window. `EstimateSentHeader` draws the top of a sent, declined or superseded row.
- **Stays in the page:** `customerAcceptUrl` with its copy and open (the customer experience section mounts the same buttons), the PDF pair (three mounts), `openCreateJobModal` and `createJobModalOpen` (the `?createJob=1` effect opens it), `detailCustomerSnapshotId`.
- **This is where features land.** A new one should arrive as a component the view mounts and, if it has a press, a handler in the hook.

### The draft's pieces

- **`EstimateDraftCustomerSection`** — the search box and the picked customer's card. Fully controlled: 33 values and setters, the notes and their expanded state among them.
- **`EstimateOptionsStrip`** — the cards, ＋ Option and the viewed option's row. `lines` always holds the **viewed** option's lines; `syncedEstimateOptions` re-merges them.
- **`EstimateChangeOrderFields`** — what is changing, why, the impact on schedule, the response-by day.
- **`EstimateDraftLineItems`** — the note a bridged change order carries, the heading with the recent picks, the catalog window's mount, the guided added-work and credit presses, the rows, the toolbar, the total.
- **`EstimateSupportingDocumentFieldset`** — the label, the link, Check link with its answer handed in.
- **`EstimateDeliverySection`** — who is told on acceptance, the project, the notes; the people and the projects are handed in.
- **Still inline** (1204–1641): the customer view, the title editor, the For and Expires slots of `AcceptHeaderBrandPicker`, the attachment preview card, Terms, the button row (Save draft · autosave status · Send · Publish to bid room · Delete draft).

### Customer experience — `EstimateCustomerExperienceSection`

- The `<details>` and its three tabs: Email (the letter as `buildEstimateLetterheadEmail` builds it), Acceptance page (`EstimateAcceptBody variant="staffPreview"`, the option picker to rehearse), Thank you. On a draft, `EstimateCxOverrideFields` under each, over `lib/estimates/estimateCxOverrideSections.ts`.
- Handed: `cxOverrideFields` (saved with the draft), `previewSelectedOptionKeys`, `customerPreviewTab`, the resolved experience, the built email, the draft's form as typed. The gate around it stays in the page.

---

## Shared substrate

**There is no in-memory selection pointer. The URL is the pointer.** The list and the detail page never mount together and share no runtime state. The only hand-off is `navigate(..., { state: { freshEstimateDraft: true } })`, sent from the list's `createDraft`, `useLeadDoors.ts` (Messages) and `useLookDoors.ts` (First look), the last two through `leadDoorsIo.startEstimate`.

**Within the detail page** the substrate is the engine hook's return. The draft form cluster is a draft-only substrate: the sent side reads `row` and never the cluster.

**The page blanks on reload, and that shapes every piece.** `EstimateDetail` returns *Loading…* while `load()` runs, and Save draft runs `load()`. Everything under it unmounts on every save. So no moved piece owns state or a read it must keep: the state is the page's or the hook's, handed in. See [What is left](#what-is-left).

### Route and URL state

- Detail: the UUID → number redirect (the hook); `location.state.freshEstimateDraft` (the hook); `#estimate-job` and `#extend-good-through` scroll after load, the second focusing its date field (the page, 361–377); `?createJob=1` opens Create job once for an accepted, unlinked row and strips itself (the page, 312–319).
- List: `?customer=<id>`; `?newEstimate=true&project=<id>`.
- Outbound: `/jobs?edit=<job_ledger_id>`, `/estimate/customer-accept-preview/:number`, the accept URL with the preview marker.

### Browser storage

- sessionStorage `estimate_accept_url:<estimateId>` through `estimateAcceptUrlSession.ts`.
- localStorage recents (`estimateLineItemRecents.ts`) and the staff accept-preview snapshot (`estimateStaffAcceptPreview.ts`).

### Role gating

No page-level gate; RLS scopes the rows. `ESTIMATE_CATALOG_EDITOR_ROLES` (the page, 127–135) gates catalog editing; `canOpenBillingNotifications` the list's ⚙; `GC_OFFICE_TEAM`, inside `estimateSendPlan`, decides who gets the Tell sheet.

### Supabase inventory

| Table / function | Verbs | Where |
|---|---|---|
| `estimates` | SELECT; INSERT (`createDraft`); UPDATE (`saveDraft`, draft-gated; unlink, accepted-gated); DELETE (`deleteDraft`, the leave rule, the bulk sweep — all draft-gated) | list, engine, sent hook, page |
| `customers` | SELECT — the full list in `load` and `refetchCustomersAfterEdit`; one row in the send | engine, page |
| `users` | SELECT — who can be told (+ self role, + devs), the master-technician default, the locked list's names | engine |
| `projects`, `app_settings` | SELECT | engine |
| `bid_proposal_rooms` | SELECT | page (`publishCoToBidRoom`) |
| `estimate_customer_events` | SELECT — detail per row; list one chunked read | engine, list |
| `estimates_thread_notes` + RPC `estimates_thread_note_stats` | via `useEstimateThreadNotes` | list |
| RPC `record_estimate_decline`, `extend_estimate_good_through` | both through `(supabase as any).rpc` | sent hook |
| RPC `publish_co_to_bid_room` | SECURITY DEFINER; draft → sent | page |
| storage `estimate-acceptor-signatures` | `createSignedUrl(path, 3600)` | engine |
| edge `send-estimate-to-customer` | one `fetch`, in `postSendEstimate` (`lib/estimates/sendEstimateIo.ts`): send and the sheet's resend from the page, `resend` and `remail` from the sent hook | page, sent hook |
| edge `check-estimate-attachment-url` | via `checkGoogleDriveAttachmentUrl` | engine |
| through extracted children | `create_job_from_estimate`, `tie_message`, `replace_estimate_catalog_payload`, `share_estimate_link`, `sent_documents`, `quo-send` | windows, sheet, strips |

---

## Kernels

The pure logic the surface stands on, all with tests. The five marked 2026-11-17 came out of the page that day.

| Kernel | What it decides |
|---|---|
| `lib/estimates/sendEstimateIo.ts` (2026-11-17) | the one request to `send-estimate-to-customer` and what a reply means |
| `lib/estimates/estimateSendPlan.ts` (2026-11-17) | refuse, sheet or confirm on Send, and the address an estimate goes to |
| `lib/estimates/estimateOptionsEditor.ts` (2026-11-17) | switch, add, remove, patch and set-kind over the editor's option state |
| `lib/estimates/estimateDetailHydration.ts` (2026-11-17) | the form a row opens as, the notify default, the customer and Send to boxes, the opening title |
| `lib/estimates/estimateCxOverrideSections.ts` (2026-11-17) | the override editor's fields and its three rules |
| `lib/estimates/estimateDraftPersist.ts` | the draft's save payload and the held dates |
| `lib/estimates/estimateDraftLines.ts` | a line's math, the stub line, a catalog pick |
| `lib/estimates/estimateOptions.ts` | options: the default selection, the star, kinds, the freeze on acceptance |
| `lib/estimates/estimateListRows.ts`, `lib/estimatePipelineRefresh.ts`, `lib/estimateOpenState.ts` | what a list row says, the lanes, the Ledger's filters and totals, opened or never opened |
| `lib/estimates/estimateTitle.ts`, `estimateNotifyOptions.ts`, `estimateAcceptUrlSession.ts`, `changeOrderRoomPick.ts`, `estimateCatalogView.ts` | the title rules, the Also-notify grouping, the accept link's session memory, the bid room pick, the catalog's filter and history words |
| `lib/estimateDraftSteps.ts`, `lib/estimateFreshDraftDiscard.ts`, `lib/estimateCustomerExperience.ts`, `lib/estimateChangeOrder.ts` | the step rail, the fresh-draft discard, the customer copy, a change order's fields |
| `supabase/functions/_shared/estimateLinkResend.ts`, `estimateDecline.ts` | the resend and decline verdicts, shared with the edge |

Still with no test of their own: `addCalendarDaysYmd`, `formatEstimateListUpdated`, `estimateCatalogApi`, `checkGoogleDriveAttachmentUrl`, `estimateMasterUser`, `useEstimateThreadNotes`, `estimateTextsTieIo`.

### Cross-surface duplicates

- **The raw-`fetch` edge family** — `postSendEstimate` is this surface's share of the playbook's [edge-function call helper](./PAGE_DECOMPOSITION_PLAYBOOK.md#cross-surface-seams) seam; its door (session, `fetch`, URL, origin, timeout) is the part a shared helper would lift.
- **The draft INSERT** — the list's `createDraft` and `leadDoorsIo.startEstimate` build the same row; one `estimateDraftInsertRow` would serve both.
- **The customers list SELECT** — the same eight columns, twice in the engine and once in the page's send.

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
21. **`EstimateDraftCustomerGate` is mounted twice** (1146, 1674) on the same `draftNeedsCustomer` / `requestCustomerFirst` pair; the toast is throttled to one per 700 ms.
22. **Fresh drafts delete themselves on leave** (v2.2885). The leave hook is **keyed on `routeSegment`**, not `row.id`: its cleanup runs while state is still the old row's. Every write stamps `committedDraftRowIdRef`. A hard reload cannot run it; the sweep catches those.
23. **The customer view hides the edit paper (`display: none`, 1253)** instead of unmounting it, so field state survives the toggle.
24. **Deep links that write or open once**: `?newEstimate=true&project=` (ref guard, params stripped first) and `?createJob=1` (deps `[row?.id]`, eslint-disable).
25. **`createDraft` inserts `title: ''`** so the customer pick can claim it as generic.
26. **The events refresh on window focus** runs only while sent or accepted; the loader itself also runs for declined.
27. **The reset on a new estimate is two effects**: the engine clears the form's pieces, and the page's own effect (356–359) closes its title editor and customer window. Both key on `routeSegment`.
28. **Two empty lines on a sent estimate are `EmptyState`** (v2.7613): *No staff email recipients were set for this quote.* and *No link views or acceptance events recorded yet.* `check:empty-words` reads a moved line as a written one.
29. **Check link's answer outlives a Save draft**: its state is the engine's, not the fieldset's, because the save's reload unmounts the fieldset.

---

## What is left

Nothing on this map's 2026-11-17 order is unbuilt. What a later pass could take, in the order of what it would buy:

1. **A quiet reload — the owner's call.** `load()` blanks the editor, which is why every piece is handed its state. If a save's reload kept the page up (as `load({ refresh: true })` already does after a send), each section could own what only it uses: the customer section its notes and its open boxes (it takes 33 props today), the fieldset its check, the delivery section its two reads, the line items the catalog's open state. It changes what the office sees during a save, so it is a decision before it is a cut.
2. **`useEstimateSendFlow`** — `sendToCustomer`, `sendEstimateEmailAnswer`, `sendEstimateEmail` and `tellEstimate` (≈130 lines) over the two tested kernels. Add a page-smoke case for the Tell sheet's path first.
3. **`useEstimateRail`** — `railData`, the flash, the dot and `customerViewOn` (≈80 lines); five sections take its dot.
4. **The create-customer overlay and the Unlink job window as the app's own windows** — both are hand-built `role="dialog"` overlays; the house `confirmDialog` and window shell would replace ~100 lines, with a look at the screen.
5. **Tests for the seven untested libs** under Kernels.

**What stays in the page:** the route split; the hash and `?createJob=1` effects; the title chips row; both gates and `requestCustomerFirst`; `lastAcceptUrl`'s readers; `staffResolvedExperience` and `customerEmailPreview` (four readers); the keyed `tellSheet` above the loading return.

Definition of done per region, verification gates and anti-patterns: [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md).

---

## Hazards

- **The page's render smoke is the proof of a move.** `Estimates.render.test.tsx` (24 cases) mounts the list, a draft, and a sent, an accepted and a declined row against a stateful Supabase stand-in, with `postSendEstimate` replaced by a recorder. A cut keeps it green unedited; a cut that moves a press the smoke does not reach adds its case first, against the unmoved page.
- **The send path cannot be walked on prod without emailing someone.** The smoke presses Resend link, Extend and a change order's send against the recorder; a live walk needs a ZZ test customer whose email is the sender's own.
- **`load()` blanks the tree; `load({ refresh: true })` does not.** A caller that swaps one for the other either unmounts the Tell sheet mid-send or leaves a stale editor after a save.
- **The leave rule judges the old row during a route change.** Re-keying it on `row.id`, or resetting the form before its cleanup runs, deletes the wrong draft or none.
- **The autosave's baseline is the payload's JSON.** A change to the payload's key order or shape reads as "dirty" on every open draft and saves at once; `estimateDraftPersist.test` pins the shape.
- **The engine's statement order is its contract.** It was moved in the page's order so the effects fire as they did; a tidy-up that regroups them is a behaviour change.
- **The page is hot, and features land on the sent side.** Check `npm run sessions` and the open PRs' files before a cut.
- **The fact sheet under-counts IO**: it lists no edge functions (the `fetch` is in `sendEstimateIo.ts`) and reads a hook's data as the hook's file, not the page's. Run it on `useEstimateDetailData.ts` and `useEstimateSentActions.ts` too.
