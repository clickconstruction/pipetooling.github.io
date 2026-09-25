# People Contracts + Overhead Tabs Architecture Map

---
file: docs/PEOPLE_CONTRACTS_OVERHEAD_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map (per PAGE_DECOMPOSITION_PLAYBOOK.md) for the two largest already-extracted People tabs — src/components/people/PeopleContractsTab.tsx (3,670 lines) and src/components/people/PeopleOverheadTab.tsx (2,557 lines). Inventories every region's state, handlers, supabase tables/RPCs, coupling and test coverage so their sub-decomposition (Stage-A lib extraction + modal/section component moves) can start without re-deriving the strategy.
covers:
  - src/components/people/PeopleContractsTab.tsx
  - src/components/people/PeopleOverheadTab.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
sections: What this surface is; Shared substrate; Master summary table; PeopleContractsTab dossiers; PeopleOverheadTab dossiers; Stage-A candidates; Test coverage; Cross-surface duplication; Recommended extraction order; What must stay in the parents; Preserve-quirks list; Recent churn
last_updated: 2026-09-25
---

## What this surface is

**Line numbers are exact as of `a05cef4c4` and rot with every commit — search the symbol name, not the number.** Regenerate the fact sheet with `npm run map -- <file>` before trusting any range.

Both files are **already-extracted tabs** of `src/pages/People.tsx` (see [`PEOPLE_TABS_ARCHITECTURE.md`](./PEOPLE_TABS_ARCHITECTURE.md), rows `contracts` and `overhead` — both marked Done). They kept growing after extraction, so this map treats each **tab component as the "parent"** and its modals/sections as the extraction units:

- [`src/components/people/PeopleContractsTab.tsx`](../src/components/people/PeopleContractsTab.tsx) — **3,670 lines** (2,981 when this map was last refreshed). Census: 60 `useState` · 7 effects · 15 `useMemo` · 3 `useCallback` · 0 `useRef` · 7 custom hooks (`useAuth`, `useToastContext`, `useNavigate`, `useNarrowViewport660`, `useMatchMedia`, 2× `useId`). Churn: 25 commits in 90 days, last 2026-09-06. Default export `PeopleContractsTab` (116–3670) + module `ContractStatusChip` (60–72). Staff contract tracking: filterable roster with per-person document rows/cards, Agreements compliance panel, office-section queue, Assign packets modal, Add/Edit document modal (Book / Custom / Enter-from-paper chooser; Upload Signed vs Request Signature), quick send, Send-for-signature modal, and wiring for eight extracted child modals/panels. Mounted at `People.tsx` ~4127 with `people`, `users`, `archivedPeople`, `archivedUserNames`, `canDeletePeopleContracts`, `currentUserId`, `isDev`.
- [`src/components/people/PeopleOverheadTab.tsx`](../src/components/people/PeopleOverheadTab.tsx) — **2,557 lines** (~2,510 at the last refresh). Census: 33 `useState` · 11 effects · 12 `useMemo` · 2 `useCallback` · 0 `useRef` · 4 custom hooks (`useToastContext`, `useMercuryLedgerNicknames`, `useLedgerPrefixMap`, `useJobBidSearchEvidence`). Churn: 18 commits in 90 days, last 2026-09-16. Default export `PeopleOverheadTab` (184–2557) + module `formatOverheadTabWorkDateLabel` (73–82) and presentational `OverheadPartsSectionsList` (91–173). Weekly overhead day table (office/bid labor + office materials vs field totals) + per-day breakdown modal, and the 90-day panel above it (KPI averages, three-lenses strip + lens modals, pool trend chart + day panel, "who makes up overhead" people table, hygiene strip), plus office-job configuration. Mounted at `People.tsx` ~3277 with `payConfig`, `authUser`, `setError`, `canAccessOverheadTab`, `isDev`, `loadPayConfig`.

The two tabs share **nothing with each other** (no common state, tables, or selection). One doc covers both because they are the two oversized People components and their maps are small enough to co-locate.

## Shared substrate

There is **no Bids-style cross-tab shared pointer or data engine** between these two components (People.tsx keys by `person_name` and gives each tab its own data). What exists is one substrate **inside each tab**, which any sub-extraction must respect:

- **Contracts:** the four caches `contractTemplates` / `contractTemplateDocuments` / `personContractAssignments` / `personContractDocuments` (190–193) plus `twoPartyTemplateIds` (262), all written only by `loadContracts()` (635–671) and re-fetched wholesale after every mutation; the shared `contractsError` string (195 — 40 set calls across 15 units: 10 handlers + 5 render blocks; rendered in the header and inside the Assign, Document and Send modals); and the selection pointer `selectedContractsPersonName` (197 — the expanded roster row; Assign packets reads it). The fact sheet shows `contractTemplateDocuments` read by 20 units (14 functions/memos + 6 render blocks) and `personContractDocuments` by 15 (11 + 4). **Caches + `loadContracts` + `contractsError` + `selectedContractsPersonName` stay in `PeopleContractsTab`** (or move into a `usePeopleContractsData` hook the component destructures); extracted modals receive them as props + an `onSaved`/`reload` callback.
- **Overhead:** two engines. (1) **Weekly** — the scope triple `(overheadDateStart, overheadDateEnd, overheadOfficeJobLedgerId)` drives four fetch effects (461–652) + the bucket-map effect (662–682), and every table/breakdown memo derives from the resulting maps. (2) **90-day** — one effect (711–787) unpacks `loadOverheadPoolSnapshot` into six states that feed the KPI strip, lenses, lens modal, pool chart/day panel, people table and hygiene strip. Both share `overheadWageLookup` (690–709), `overheadPersonIdByUserId` (344) and `overheadOfficeJobLedgerId`. **Scope states, office job, wage lookup and both engines stay in `PeopleOverheadTab`** (or a `usePeopleOverheadData` hook); extracted modals consume derived view-models.

Two **cross-component couplings via the DB, not via props** (neither blocks extraction; do not "fix" during a move):

1. `People.tsx` independently loads contract-signing rollups for the Users-tab dots (`rollupContractSigningStatusByPersonName` ~1148 → `contractSigningStatusByPersonName`, consumed by `PeopleUsersTab` ~3234). Saves inside `PeopleContractsTab` do **not** refresh those dots until the parent reloads.
2. The office job setting (`overhead_office_job_ledger_id_v1`) is read independently by `People.tsx` (~2671, draft-payroll dual-rate office/field buckets — re-read fresh each time that effect runs), `PeopleReviewTab`, ~12 other components/libs, and the module-cached [`useOverheadOfficeJobId`](../src/hooks/useOverheadOfficeJobId.ts). Change/Clear inside `PeopleOverheadTab` notifies none of them; the module cache stays stale until a full page reload.

## Master summary table

| Region | Tab | Anchor (lines @a05cef4c4) | Size | Coupling | Risk | Tests | Status |
|---|---|---|---|---|---|---|---|
| Data engine (`loadContracts` + 4 caches + `twoPartyTemplateIds`) | C | 190–195, 262, 635–671, mount 1904–1909 | ~50 | highest (every region) | — | none | stays in tab (or `usePeopleContractsData`) |
| Row/payload builders (`getDocumentsForPerson` etc.) | C | 673–731, 1062–1148, 1365–1431 | ~220 | read-only: caches (+ `people`/`users` props for the email; ~14 form states for the payload) | low | **none** | **Stage A → `lib/peopleContracts/*`** |
| Roster (search, office queue, filter chips, table/cards, archived) | C | memos 1153–1290; render 1967–2450 | ~140 + 484 | high (opens every modal) | med | kernels only (filter/buckets/counts) | inline; extract after modals |
| Row actions cluster `renderContractDocActions` | C | 876–1060 | 185 | med (opens Send/Edit/Delete/Signed, toggles dashboard) | low-med | none | inline → `ContractDocActions` |
| Agreements panel wiring | C | 736–762, 2434–2447 | ~45 | low | — | kernel tested | **extracted** (`ContractsAgreementsPanel`) |
| Quick send (picker + plan) | C | 774–858, 3463–3472 | ~95 | med (feeds Send modal state) | med | kernel tested; `materializeQuickSendRow` none | picker **extracted**; plan/write inline |
| Assign packets modal | C | 280–283, 331–340, 1771–1902, render 2453–2698 | ~130 + 246 | med (caches, `selectedContractsPersonName`) | low-med | consequence kernel only | inline → `ContractsAssignPacketsModal` |
| Add/Edit document modal | C | state 202–274; fields 285–633; handlers 1433–1672; render 2700–3375 | ~25 states, ~520 + 676 | high (Book pick, save-and-send chain, paper entry) | high | date kernels only | inline — extract last |
| Delete-confirm dialog | C | 1569–1594, render 3377–3461 | ~110 | low | low | none | inline |
| Send-for-signature modal | C | state 228–249; 1299–1363; 1674–1768; render 3536–3667 | ~8 states, ~160 + 132 | low-med (send request set by 3 openers) | low | email builder tested | inline — **extract first** |
| Extracted children (Library, Book, Signed record, Help, Office form, Paper entry) | C | 3474–3534 | ~60 wiring | — | — | Help modal render test | wiring stays in tab |
| Weekly data engine (4 fetch effects + bucket effect + memos) | O | 421–682, 690–709, 818–918 | ~400 | highest | — | libs tested; `overheadTableTotals` none | stays in tab (or `usePeopleOverheadWeek`) |
| 90-day snapshot unpack | O | 711–787 | 77 | high (6 states) | — | `overheadPoolSnapshot` 9 tests | engine **extracted**; unpack stays |
| Scope + settings + toolbar | O | 207–229, 372–419, 1058–1067, 1103–1110, render 1428–1552 | ~215 | low (writes scope) | low | `overheadOfficeJobSettings`, `overheadTableViewStorage` | stays with tab |
| KPI strip | O | render 1225–1297 | 73 | low | low | `overheadAvgDailyCost` | presentational, inline |
| Three-lenses strip + lens modal | O | view-model 1112–1158; render 1298–1358, 1379–1388 | ~47 + 61 | low | low | `overheadRateMethods`, `overheadLensSeries` | modal **extracted** (`OverheadLensModal`); strip inline |
| Pool trend chart + day panel | O | 1036–1067, render 1359–1378 | ~35 + 20 | low-med (day panel moves week scope) | low | `overheadPoolTrend`, `overheadPoolDayLines` | **extracted** (`OverheadPoolTrendCard`, `OverheadPoolDayModal`) |
| People table | O | 1073–1083, render 1389–1394 | ~17 | low | low | `overheadPeopleTable`, `overheadPeopleCellModel` | **extracted** (`OverheadPeopleTable` → `OverheadPeopleCellModal`) |
| Hygiene strip | O | view-model 1160–1201, render 1395–1427 | ~75 | low | low | `overheadHygiene` 14 tests | inline |
| Day table + totals footer | O | render 1554–1884 | 331 | med (merged rows, opens modal) | low-med | row merge tested; totals none | inline → `OverheadDayTable` |
| Breakdown modal (5 scopes) | O | model 920–1029; render 1886–2271; list 91–173 | 110 + 386 + 83 | med (5 data inputs + the modal pointer via model deps) | med | **model untested (money math)** | inline — Stage A the model first |
| Office-job modal + job picker | O | 232–245, 789–816, render 2273–2554 | ~40 + 281 | low-med (writes office job id) | low | settings lib tested | inline → `OverheadOfficeJobModals` |

---

## PeopleContractsTab — dossiers

### Module level + props (1–114)

`ContractStatusChip` (60–72, presentational pill, ×5 in render), `isDeletablePersonContractStatus` (75–77, `unsent|sent|signed`), `personContractDocumentHasStaffData` (80–97 — **a verbatim duplicate** of the export in [`lib/contractPackets.ts`](../src/lib/contractPackets.ts), which `ContractLibraryModal` already imports; the module copy should become that import). Types `Person`, `UserRow` (99–100), `PeopleContractsTabProps` (102–114: `people`, `users`, `archivedPeople?`, `archivedUserNames?`, `canDeletePeopleContracts`, `currentUserId?` — Reply-To/sender for the send email, `isDev?` — Forms tab in the Contract library). Component-body types `ContractTemplate`, `ContractTemplateDocument` (now with `book_version_date`, `form_template_id`), `PersonContractAssignment`, `PersonContractDocument` (now with `sent_at`, `signer_last_viewed_at`, `applied_version_date`, `form_template_id`, `office_completed_at`), `PersonContractTableRow` (143–189) would move to `lib/peopleContracts/types.ts` with Stage A.

### Tab chrome (117–141, header 1913–1966)

`contractsHelpModalOpen` → [`ContractsTabHelpModal`](../src/components/people/ContractsTabHelpModal.tsx) (3480); `contractsNarrowViewport` (<660px → document cards) and `contractsWideViewport` (≥1100px → Agreements panel beside the roster); `agreementsPanelHidden` + `setAgreementsPanelHiddenStored` (133–140, localStorage `people_contracts_agreements_panel_hidden_v1`); `contractsDocsAsCards` (734 — cards on phones OR while the panel squeezes the lane). Header buttons: help, and **Contract library** (`contractLibraryModalOpen` 199, set at ~1946; the library's `onClose` clears it). There is no header Contract Book button any more.

### Contracts data engine (stays in tab)

- **State:** the four caches, `contractsLoading`, `contractsError`, `twoPartyTemplateIds`.
- **Loader `loadContracts()` (635–671):** `Promise.all` of 4 SELECTs — `contract_templates`, `contract_template_documents` (incl. `book_body_html`, `book_body_format`, `tags`, `canonical_document_url`, `updated_at`, `book_version_date`, `audience`, `form_template_id`), `person_contract_assignments`, `person_contract_documents` (incl. lineage columns, `applied_*`, `sent_at`, `signer_last_viewed_at`, `form_template_id`, `office_completed_at`) — then a **sequential** `contract_form_templates` (`id, schema`) read for the distinct `form_template_id`s → `twoPartyTemplateIdSet` (Contract Forms PR 8). Every mutation handler ends with `loadContracts()` (full refetch, no patching).
- **Effects:** initial load behind an 80 ms `setTimeout` (1904–1909; preserve); deep link `?doc=<uuid>` → `contractSignedRecordModalDocId` (266–271, mount-only).

### Pure row/payload builders (Stage-A cluster, inline closures over the caches)

- `getDocumentsForPerson(personName)` (1062–1148) → `PersonContractTableRow[]` — groups person rows by `contract_lineage_id`, sorts versions descending, resolves each version's book date via inner `bookForVersion` (pinned `applied_contract_template_document_id` wins only if the pinned row still matches the document name AND an assigned template; else the latest `effectiveBookVersionPlainDate` among assigned templates — `book_version_date` beats `updated_at`), then appends **placeholder rows** (`version: null`) for template documents with no person row. Called per person by 4 memos (`contractsRosterBuckets`, `contractsPersonNamesFiltered`, `contractsArchivedVisible`, `contractDocumentSearchLines`) and again per rendered row.
- `getAggregateStatus` (673–679) / `getAggregateStatusForTemplate` (681–687) → `'red'|'yellow'|'green'|null` (colors every roster row's per-packet name pills ~2153 — collapsed rows too, not only the expanded one).
- `listAppliedContractBookVersionOptions` (690–710) + `resolveAppliedContractTemplateDocIdForSave` (712–721) — Applied-version picker options + save-time validation.
- `rosterEmailForPersonName` (724–731) — people first, then users; prefills the signer email.
- `getContractDocumentUpsertPayload()` (1365–1431) — form → row payload with the add-tab forcing matrix (quirk 5).

### Roster (memos 1153–1290, render 1967–2450)

- **Owned state:** `contractsSearchQuery`, `selectedContractsPersonName`, `contractsArchivedSectionOpen`, `contractsRosterFilterStored` (1181, localStorage `people_contracts_roster_filter_v1`), `contractsDocumentActionsMenuOpenId` (+ click-outside effect 320–329 on `data-contract-doc-menu-wrap`), `contractDashboardPromptSavingId`, `officeModalDocId`, `contractSignedRecordModalDocId`. `useId`: `contractsTabSearchInputId`. The menu id and the dashboard-saving id are touched only by `renderContractDocActions` (plus that effect / `toggleContractDashboardPrompt`), so they become `ContractDocActions` props. The two modal pointers are read only by the tab-level child renders (`ContractFormOfficeModal`, `PersonContractSignedRecordModal`); the office queue, row actions and the `?doc=` effect set them.
- **Memos:** `contractsArchivedNameSet` (1153–1164 — archived people + archived user names; archived wins over an active twin), `contractsPersonNamesSorted` (1166–1171 — union of `people[].name` + `users[].name` minus archived), `contractsSearchNormalized`, `contractsArchivedNames`, `contractsRosterBuckets` (1189–1208 — per-person bucket via `countPersonContractStatuses` + `officeSectionPending` → `contractsRosterBucket`, plus chip totals), `contractsRosterFilterActive` (1209 — a plain derived const, not a memo: stored filter or `defaultContractsRosterFilter(attention)`), `contractsPersonNamesFiltered` (1220–1244 — filter chips when no search; search matches person OR document name across everyone), `contractsArchivedVisible` (1246–1261), `contractDocumentSearchLines` (1265–1290).
- **Handlers:** `jumpToContractsPerson` (861–873 — select, open Archived if needed, flip filter to Everyone if hidden, scroll to `data-contracts-person-row`), `setContractsRosterFilter` (1211–1218), `toggleContractDashboardPrompt` (1523–1538, UPDATE `dashboard_prompt_after_clock_in`).
- **Render:** search (1973–1994); **office-sections queue** (1995–2022, `officeQueue(personContractDocuments, twoPartyTemplateIds)` → button opens `ContractFormOfficeModal`); filter chips Needs attention / Waiting / Done / Everyone (2023–2066); search match lines (2067–2091); roster table with `PersonNameDoor` names + status counts (2092–~2410), expanded row (2178–2404: **Assign packets** and **+ Add document** openers — the latter resets ~20 form states inline — then docs as table or cards); Archived section (2411–2426); Agreements panel (2434–2447).
- **Row actions `renderContractDocActions` (876–1060):** one JSX cluster shared by the desktop cell and the cards — "office section pending" pill, View signed, Send/Resend (sets send state inline), Dashboard checkbox, ⋯ menu (Edit → `openContractDocumentEditModal`; Delete when `canDeletePeopleContracts`).
- **Extraction:** medium risk. Presentational once the row builders are in lib, but it opens every modal — extract after the modals, or accept a wide callback surface (`onAssign`, `onAddDocument`, `onEdit`, `onSend`, `onDelete`, `onViewSigned`, `onToggleDashboard`, `onOpenOfficeSection`). `renderContractDocActions` → `ContractDocActions` component is the cheap first cut.

### Agreements panel + quick send

- `agreementSummaries` (736–745, `buildAgreementSummaries`) and `quickSendDocumentNames` (748–762, documents with signable content via `resolveQuickSendSource`) feed [`ContractsAgreementsPanel`](../src/components/people/ContractsAgreementsPanel.tsx) (extracted, 205 lines).
- Quick send is entered from the panel's and the Contract library's `onQuickSend(documentName)` → `quickSendDocumentName` (231) → [`ContractQuickSendPicker`](../src/components/people/ContractQuickSendPicker.tsx) (3463–3472, extracted) → `openQuickSendForPerson` (774–802): `quickSendReusablePersonRow` + `quickSendPlan` (`reuse | fill | insert | no-content`) from [`lib/contractsQuickSend.ts`](../src/lib/contractsQuickSend.ts); **writes nothing**, opens the Send modal with `contractSendQuickSend = { personName, documentName, plan }`. `materializeQuickSendRow` (810–858) performs the deferred fill/insert inside Send (quirk 3a).

### Assign packets modal (`contractsAssignModalOpen && selectedContractsPersonName`, render 2453–2698)

- **Owned state:** `contractsAssignModalOpen` (200), `assignPacketsSelectedIds` (Set), `assignPacketsSaving`, `assignPacketUnassigningTemplateId`, `assignPacketMenuOpenId` (280–283; click-outside effect 331–340 on `data-assign-packet-menu-wrap`). Not modal-only: the expanded row's **Assign packets** opener (2187–2190) sets the open flag and resets the selection, the menu id and `contractsError`, so an extracted modal takes `open`/`onClose` and resets itself on open. Consequence line via `assignPacketsConsequence` (~2618, [`lib/contractPackets.ts`](../src/lib/contractPackets.ts)).
- **Handlers:** `materializePacketForPerson(personName, templateId)` (1771–1823 — INSERT `person_contract_assignments`, then per template doc: UPDATE the **latest lineage version** (canonical URL + pin; book body/format only when the row has no signing body) or INSERT a fresh `unsent` v1 row); `assignSelectedPacketsToPerson` (1825–1849 — skips already-assigned, sequential); `unassignPacketFromPerson(templateId)` (1851–1902 — gated by `canDeletePeopleContracts`; DELETE assignment, bulk-clear pins `.in('applied_contract_template_document_id', ids)`, delete empty-placeholder rows only).
- **Supabase:** `person_contract_assignments` (INSERT/DELETE), `person_contract_documents` (INSERT/UPDATE/DELETE).
- **Extraction:** low-medium risk. Props: caches, `personName`, `canDeletePeopleContracts`, `onSaved`, `onError`. Stage A first: `materializePacketForPerson` already exists as the export of [`lib/people/materializePacket.ts`](../src/lib/people/materializePacket.ts). It makes the same writes and takes `templateDocs`/`personDocs` as arguments. Person Desk and `hireWrites` call it; the tab never adopted it. The per-document write plan is also re-spelled in `ContractLibraryModal.savePacket` (see Cross-surface).

### Add/Edit document modal (`contractDocumentModalOpen`, render 2700–3375)

- **Owned state (~25):** `contractDocumentModalOpen` (224), `editingContractDocument` (202, null = add), the 13 `contractDocumentForm*` fields (203–217, 274 — incl. `AppliedTemplateDocId` "" = automatic and `AppliedVersionDate` "" = from book edit), `contractEditModalContractTextExpanded` / `CanonicalExpanded` (226–227, reset effect 314–318), canonical-URL check (`canonicalUrlCheckStatus`/`Message` 250–253, `canonicalUrlIsCheckable` 285–288, `checkCanonicalDocumentUrl` 290–306 → [`checkGoogleDriveAttachmentUrl`](../src/lib/checkGoogleDriveAttachmentUrl.ts), reset effect 308–312), `contractDocumentAddTab` (254) + `handleContractAddTabKeyDown` (612–633) + `contractAddDocTabBaseId`, `contractAddDocSource` (`choose|book|custom`, 258), `contractAddBookPickedRowId` / `contractAddBookCustomizeOpen` (272–273), `contractBookModalOpen` (201), `paperEntryFor` (260). The last two are set from inside this modal but read only by the tab-level `ContractBookModal` / `ContractFormPaperEntryModal` renders, so they stay in the tab (see Extraction). The open flag, `editingContractDocument` and most form fields are also written outside the modal: by the roster's **+ Add document** reset and by `openContractDocumentEditModal` from the ⋯ menu.
- **Shared field renderers:** `contractDocModalContractTextField` (354–440, format buttons + **Contract Book** button ~406 + textarea) and `contractDocModalCanonicalUrlField` (442–518) are JSX-in-`useMemo`, rendered by the edit accordions, the Customize expander and the custom Request-Signature panel; `renderContractDocAppliedVersionBox` (521–610, plain render fn — Contract Book copy select + From book edit / Custom date toggle); `contractBodyFormatBtn` (342–352).
- **Render branches:** back link (2711–2727); **chooser** (2728–2821 — Book / Custom, plus **Enter from paper** 2797–2820 when any book entry has a `form_template_id` → `paperEntryFor`); custom tablist Upload signed / Request signature (2822–2878); **book path** (2879–3000 — `listQuickAddBookDocuments` picker + Customize expander); person/document name fields (3002–3043); edit body (3049–3266); Delete (3279–3302); Save (3316–3343); Save & send (3344–3370).
- **Handlers:** `openContractDocumentEditModal` (1540–1567, full hydrate incl. pin validation), `saveContractDocument` (1452–1521 — edit → UPDATE by id; add → INSERT fresh lineage v1), `saveContractDocumentAndOpenSend` (1596–1672 — add + Request Signature only; `hasContractSigningContent` guard reads `contractAddBookPickedRowId` first for the form's `form_template_id`; INSERTs then opens Send with the new id), `handlePickContractFromBook` (1433–1446), predicate `contractBookPickFromDocumentModal` (1448–1450).
- **External:** [`ContractBookModal`](../src/components/contracts/ContractBookModal.tsx) (3486–3496) is now opened **only** from this modal's contract-text field; its `onPickEntry` is passed only when the predicate holds. [`ContractFormPaperEntryModal`](../src/components/contracts/formFill/ContractFormPaperEntryModal.tsx) (3506–3516). The DB function `create_pending_contract_versions_after_book_save` (see `docs/MIGRATIONS.md`, v2.365) mints `lineage_version > 1` rows — the UI never does.
- **Extraction:** **highest risk in the file — extract last.** Keep `ContractBookModal` + the pick predicate + `paperEntryFor` in the tab; an extracted `ContractDocumentFormModal` receives `onOpenContractBook`, `onEnterFromPaper(personName)`, `onSaved`, `onSavedAndSend(docId, personName)`, the caches (applied-version options, book picker) and `canDeletePeopleContracts`. The field renderers move with it (used only here). `handlePickContractFromBook` writes five form fields and closes the Book modal, so the tab's `onPickEntry` has to hand the picked entry into the extracted modal instead of setting its state.

### Delete-confirm dialog (render 3377–3461)

`contractDocumentDeleteConfirmOpen`, `contractDocumentDeleteTarget`, `contractDocumentDeleting` (218–223); `deleteContractDocument()` (1569–1594) — DELETE by id, gated by `canDeletePeopleContracts` + `isDeletablePersonContractStatus`; closes the edit modal if it showed the deleted row. Opened from the ⋯ menu and the edit modal. Low risk.

### Send-for-signature modal (`contractSendModalOpen && (contractSendDocId || contractSendQuickSend)`, render 3536–3667)

- **Owned state:** `contractSendModalOpen`, `contractSendDocId`, `contractSendQuickSend`, `contractSendEmail`, `contractSendSubject`, `contractSendIntro`, `contractSendPortalUrl`, `contractSendSaving` (228–249). Three openers write the first six: row Send/Resend (in `renderContractDocActions`, ~898–905 — sets doc id/email/subject/intro but does **not** clear `contractSendQuickSend`), `openQuickSendForPerson`, `saveContractDocumentAndOpenSend`; the modal's own inputs/Cancel and `sendContractForSignature` write them too.
- **Memos/effect:** `contractSendTarget` (1299–1307 — saved row or pending pick); portal URL effect (1309–1336 — when exactly one active `people` row has the name, reads `sub_portal_slugs` + unrevoked `sub_portal_links`; never mints); `contractSendEmailPreview` (1338–1363) renders the real email via `buildContractSigningEmail` (Deno `_shared/contractSigningEmail.ts` through the [`lib/contractSigningEmail.ts`](../src/lib/contractSigningEmail.ts) door) with sender, portal URL and `PORTAL_COMPANY.phone`.
- **Handler `sendContractForSignature()` (1674–1768):** inline email regex; `materializeQuickSendRow` if the plan writes (pins the id, flips plan to `reuse`); **raw `fetch`** to `send-contract-for-signature` (JWT + anon apikey, optional `email_subject`/`email_intro_plain`, `public_origin`); toast on `emailed`/`accept_url`; `recordNavClick(..., 'contract_quick_send_committed', '#<plan>')`; reset + `loadContracts()`.
- **Extraction:** **low risk — extract first.** Parent keeps one `sendRequest` (`{ docId } | { quickSend }` + prefilled email); the modal owns subject/intro/portal/saving/preview + the send handler. Props: `request`, `personDocuments` (target lookup), `people`/`users`/`currentUserId`, `onSent`, `onError` (or thread `setContractsError`).

### Already-extracted children (wiring only; stays in the tab)

[`ContractLibraryModal`](../src/components/contracts/ContractLibraryModal.tsx) (3518–3534 — v2.1411 merged Documents/Packets/Forms library; **replaced the old Manage-templates and Assign-template modals**; owns `savePacket`/`deletePacket`), [`ContractBookModal`](../src/components/contracts/ContractBookModal.tsx), [`PersonContractSignedRecordModal`](../src/components/contracts/PersonContractSignedRecordModal.tsx) (3474), `ContractsTabHelpModal` (3480), [`ContractFormOfficeModal`](../src/components/contracts/formFill/ContractFormOfficeModal.tsx) (3498–3504), `ContractFormPaperEntryModal` (3506–3516), `ContractQuickSendPicker` (3463), `ContractsAgreementsPanel` (2436).

---

## PeopleOverheadTab — dossiers

Stage A is **largely done** for this tab — the calc core lives in tested libs: [`overheadDailyLabor.ts`](../src/lib/overheadDailyLabor.ts) (`buildOverheadDailyLabor`, `buildOtherJobsLaborByDay`, `mergeOverheadDayTableRows`, `overheadFactorTotalOverOtherJobs`, `filterOverheadDetailLines`, `aggregateOverheadDetailByPerson[TotalScope]`, `aggregateOtherJobsLaborByPerson`, `buildOverheadWageLookup[ByPersonId]`, `isRecordedClockSession`), [`fetchOverheadOfficePartsByDay.ts`](../src/lib/fetchOverheadOfficePartsByDay.ts), [`overheadPartsAccountingBuckets.ts`](../src/lib/overheadPartsAccountingBuckets.ts) (incl. `sumPartsUsdByDayExcludingInternalTransfer`, `bucketForOverheadPartsLine`), [`overheadPartsBucketLoader.ts`](../src/lib/overheadPartsBucketLoader.ts) (`collectMercuryTxIds`, `fetchAccountingBucketByTxId`), [`overheadPoolSnapshot.ts`](../src/lib/overheadPoolSnapshot.ts) (the whole 90-day scan), [`overheadAvgDailyCost.ts`](../src/lib/overheadAvgDailyCost.ts), [`overheadRateMethods.ts`](../src/lib/overheadRateMethods.ts), [`overheadHygiene.ts`](../src/lib/overheadHygiene.ts), [`overheadPoolTrend.ts`](../src/lib/overheadPoolTrend.ts), [`overheadPoolDayLines.ts`](../src/lib/overheadPoolDayLines.ts), [`overheadLensSeries.ts`](../src/lib/overheadLensSeries.ts), [`overheadPeopleTable.ts`](../src/lib/overheadPeopleTable.ts), [`overheadOfficeJobSettings.ts`](../src/lib/overheadOfficeJobSettings.ts), [`overheadTableViewStorage.ts`](../src/lib/overheadTableViewStorage.ts). What remains inline is orchestration, the breakdown model, the totals memo and render.

### Scope + settings + toolbar (stays in tab)

- **State:** `overheadDateStart`/`End` (207–220, current Sun–Sat week via device-local `Date` + `localCalendarDayKey`), `overheadOfficeJobLedgerId`, `overheadOfficeJobLabel` (`{hcp_number, job_name}` via `effectiveJobLedgerNumber`), `overheadSettingsLoading`, `overheadTableSimpleView` (lazy-init from localStorage).
- **Effects:** office-job load (372–411 — `fetchOverheadOfficeJobLedgerIdFromAppSettings` + `jobs_ledger` label `maybeSingle`); `loadPayConfig()` kick that sets `overheadPayConfigLoaded` on settle (413–419).
- **Handlers:** `shiftOverheadWeek(deltaWeeks)` (1103–1110, noon-anchored ±7 days), `showOverheadWeekOf(ymd)` (1058–1067, used by the pool day panel), Simple/Advanced toggle writes `writeOverheadTableSimpleViewToStorage`.
- **Render:** toolbar 1428–1552 (week nav, date inputs, Simple/Advanced, office-job button → `overheadOfficeJobModalOpen`, settings label 1534–1550).

### Weekly data engine (stays in tab / hook candidate)

- **Effects, all gated `canAccessOverheadTab && authUser?.id` with `cancelled` cleanup:**
  1. **Person links** (421–459) → `overheadPersonIdByUserId`: `people` (`id, account_user_id`, unarchived, paged) for the C1 person-id-first wage join; failure degrades to an empty map (name fallback), no banner.
  2. **Office sessions** (461–518) → `overheadSessions`: paged `clock_sessions`, `.or(`job_ledger_id.eq.${officeJobId},bid_id.not.is.null`)` with an office job, else `.not('bid_id','is',null)`.
  3. **Field sessions** (520–575) → `overheadOtherJobsSessions`: `.not('job_ledger_id','is',null)` + `.neq('job_ledger_id', officeJobId)`.
  4. **Office parts** (577–616) → `overheadOfficePartsDetailByDay` via `fetchOverheadOfficePartsByDay` (cleared when no office job).
  5. **Field parts** (618–652) → `overheadOtherJobsPartsDetailByDay` via `fetchOtherJobsPartsByDay`.
  6. **Accounting buckets** (662–682) → `overheadPartsAccountingBucketByTxId` (one symmetric map for office AND field Mercury lines; `collectMercuryTxIds` + `fetchAccountingBucketByTxId`), recomputed per detail-map change.
- **Loading flags:** effects 2–5 each drive one flag: `overheadSessionsLoading` (228), `overheadOtherJobsSessionsLoading` (268), `overheadOfficePartsLoading` (249) and `overheadOtherJobsPartsLoading` (272). Only the day table's combined gate (1554) reads them.
- **Error surfacing:** `overheadLoadErrorBySource` (353) via `reportOverheadLoadError` / `clearOverheadLoadError` (355–370) — per-source red banner (render 1205–1224) **and** forwarded to the page-level `setError` prop.
- **Memos:** `overheadWageInputsKey` + `overheadWageLookup` (690–709, JSON content key so identity survives pay-config refetches), `overheadLabor` / `overheadOtherJobsLabor` (818–840), `overheadOfficePartsUsdByDay` / `overheadOtherJobsPartsUsdByDay` (845–861, Internal Transfers excluded), `overheadMergedByDay` (863–879), `overheadTableTotals` (890–916, column sums — untested), `overheadTableColCount` (918, 4 simple / 7 advanced).
- **Supabase:** `clock_sessions`, `people`, `jobs_ledger`; inside libs: `app_settings`, Mercury allocations, supply invoices, tally parts, drag-sort labels.

### 90-day snapshot (effect 711–787 → `loadOverheadPoolSnapshot`)

- **What changed:** since v2.2676 the whole 90-day scan (office-or-bid + field sessions, unassigned salary time, office parts excluding Internal Transfers, `jobs_ledger_invoices` with the Stripe test-mode filter, `denverCalendarDayKey` anchor) lives in [`lib/overheadPoolSnapshot.ts`](../src/lib/overheadPoolSnapshot.ts) (326 lines, 9 tests) and is shared with the Dashboard's Overhead card (`useDashboardOverheadSnapshot`) and `loadBridgeData` (`loadJobDayLedger` uses only its `loadOverheadPoolSnapshotInputs`). The tab effect only unpacks.
- **Gate:** waits for `overheadPayConfigLoaded` AND `overheadPersonIdByUserId` (single run); re-runs on office job or wage-lookup change.
- **Writes six states:** `overheadAvgDailyCost` (250), `overheadRateLenses` (298), `overheadPoolTrend` (310), `overheadHygiene` (335), `overheadPeopleLines` (321 — 90-day labor/parts detail lines + bucket map + `endYmd`), `overheadLensDetail` (319). Failure nulls all six and reports `'90-day averages'`; an unassigned-salary failure reports its own source without nulling the rest.

### KPI strip (render 1225–1297)

Avg daily cost (7/30/90) and overhead per $100 revenue cards over `overheadAvgDailyCost`; presentational. Math in `computeOverheadTrailingAverages` (tested).

### Three-lenses strip + lens modal

- **View-model (1112–1158):** `lensLoading`, `lensWindowLabel`, `lensPoolLabel`, `lensInclusionRule`, `fmtLens`, `lensCentsC`, `overheadLensCards` (A per field hour / B % of revenue / C per labor $).
- **Render (1298–1358):** card grid; each card opens [`OverheadLensModal`](../src/components/people/OverheadLensModal.tsx) (state `overheadLensModal` 315; render 1379–1388 with `pool`, `rates`, `detail`). Kernel `computeOverheadRateMethods` is shared with `PeopleReviewTab`.

### Pool trend chart + day panel

[`OverheadPoolTrendCard`](../src/components/people/OverheadPoolTrendCard.tsx) (1359–1367) gets `dayIndex` / `highlightYmd` / `onOpenDay` / `cardLabelForLine`; the tab builds `overheadPoolDayIndex` (1043–1051) with `buildOverheadPoolDayIndex` from `overheadPeopleLines` and the trend's day list, and renders [`OverheadPoolDayModal`](../src/components/people/OverheadPoolDayModal.tsx) (1368–1378; state `overheadPoolDay` / `overheadPoolHighlightYmd` 317–318; `openOverheadPoolDay` 1053–1056). "Show this week" calls `showOverheadWeekOf`, which moves the week scope with the table's own local-Date math and closes the day panel (`overheadPoolDay` → null). Only `openOverheadPoolDay` writes `overheadPoolHighlightYmd`, so the chart keeps highlighting the last opened day after the panel closes. The day panel is a sibling of the lens modal, not of the week-scoped breakdown modal.

### People table

`overheadPeopleParts` (1073–1083 — drops `internal_transfer` lines by the pool's bucket rule; Mercury card nickname = person) → [`OverheadPeopleTable`](../src/components/people/OverheadPeopleTable.tsx) (1389–1394), which owns [`OverheadPeopleCellModal`](../src/components/people/OverheadPeopleCellModal.tsx) (v2.3264 cell drill-in). Tab-side wiring only.

### Maintenance-hygiene strip

View-model `overheadHygieneCards` (1160–1201 — pending approvals, unpriced hours, unassigned salary time; one card per dirty indicator); render 1395–1427, **below** the pool chart and people table (not directly under the lenses). Kernel `buildOverheadHygieneSummary` (14 tests) runs inside the snapshot loader.

### Day table + totals footer (render 1554–1884)

Single combined loading gate (all four weekly loading flags); thead 1572–1633 (Simple vs Advanced column order differ); rows 1637–1778 (every $ cell → `setOverheadBreakdownModal({ workDate, scope })`, scopes `'bid'|'office'|'officeParts'|'total'|'otherJobs'`; per-row `overheadFactorTotalOverOtherJobs`); tfoot 1780–1881 (footer Overhead % = the same factor on period sums — weighted ratio). `formatOverheadTabWorkDateLabel` (73–82) labels rows in `APP_CALENDAR_TZ`; `overheadValueCellButtonStyle` (1092–1101). Extraction: `OverheadDayTable` taking `rows`, `totals`, `simpleView`, `onOpenBreakdown`.

### Breakdown modal (model 920–1029, render 1886–2271)

- **State:** `overheadBreakdownModal` (289); auto-close effect on week change (1088–1090).
- **View-model `overheadBreakdownModalModel`:** per-scope discriminated object — `officeParts` (bucketed sections + Materials total excluding Internal Transfers), `otherJobs` (person rows via `aggregateOtherJobsLaborByPerson`, sorted sessions, parts re-bucketed + recomputed Materials total, grand total), `total` (`aggregateOverheadDetailByPersonTotalScope` + labor + office materials), `office`/`bid` (`filterOverheadDetailLines` + `aggregateOverheadDetailByPerson`). **Money math with no test.**
- **Render:** header stats (1923–2012 officeParts), body (2015–2228 — person tables, `<details>` session/materials lists, `OverheadPartsSectionsList` ×3 with the Internal-Transfer slate accent and "−$ refund" lines since v2.3519, Mercury card labels via `overheadCardLabelForLine` 1036–1040), footer (2230–2252).
- **Extraction:** Stage A the model into `lib/overheadBreakdownModel.ts` + tests; then `OverheadBreakdownModal` (+ `OverheadPartsSectionsList`) takes `model`, `cardLabelForLine`, `officeJobConfigured`, `onClose`.

### Office-job modal + job picker (render 2273–2554, search effect 789–816)

- **State:** `overheadOfficeJobModalOpen`, `overheadJobPickerOpen`, `overheadJobSearch`, `overheadJobResults`, `overheadJobSaving` (232–245); `overheadJobResultsUnified` (239–242) + `useLedgerPrefixMap` (238) + `useJobBidSearchEvidence` (243) feed `UnifiedSearchResultRow`.
- **Effect:** 300 ms-debounced RPC `search_jobs_ledger` while the picker is open (clears on close).
- **Handlers (inline in JSX):** Clear via `deleteOverheadOfficeJobLedgerIdSetting()` (~2369) and pick via `upsertOverheadOfficeJobLedgerId(j.id)` (~2506), then set id + label locally; both toast; Change/Clear gated `isDev` (2346, 2398). The office-job modal holds the methodology explainer (moves verbatim) and links `/jobs?edit=<id>`.
- **Extraction:** low risk. `OverheadOfficeJobModals` with `open`, `onClose`, `officeJobLedgerId`, `officeJobLabel`, `settingsLoading`, `isDev`, `onChanged(id, label | null)`. The parent keeps the id because both engines key off it. It also keeps `overheadOfficeJobModalOpen`, because the toolbar's office-job button (1519) sets it. The label and `overheadSettingsLoading` are read by the toolbar's settings line (1534–1550) too.

---

## Stage-A candidates (pure logic → `src/lib/*` + tests, before any component moves)

| Candidate | Currently | Target |
|---|---|---|
| `getDocumentsForPerson` (+ `bookForVersion`), `getAggregateStatus`, `getAggregateStatusForTemplate` | closures 673–687, 1062–1148 | `lib/peopleContracts/personContractRows.ts` with explicit `(personName, assignments, templates, templateDocuments, personDocuments)`; tests: lineage sort, placeholder rows, pin fallback, `book_version_date` precedence. Then one `rowsByPerson` memo replaces the 5× recomputation |
| `listAppliedContractBookVersionOptions`, `resolveAppliedContractTemplateDocIdForSave` | closures 690–721 | `lib/peopleContracts/appliedVersionOptions.ts` + tests |
| `getContractDocumentUpsertPayload` | closure over ~14 form states (1365–1431) | `lib/peopleContracts/contractDocumentPayload.ts` taking a form-values object; tests for the Upload-Signed / Request-Signature / edit forcing matrix |
| `personContractDocumentHasStaffData` (module copy 80–97) | duplicate of `lib/contractPackets` export | delete the copy, import the lib one (zero-risk) |
| `isDeletablePersonContractStatus` | module-level 75–77 | verbatim move to `lib/contractPackets.ts` or `lib/peopleContracts/` |
| Packet document write plan (`materializePacketForPerson` 1771–1823) | inline; the same writes already live in `lib/people/materializePacket.ts` (untested, used by Person Desk + `hireWrites`) and are re-spelled in `ContractLibraryModal.savePacket` | first call the `lib/people/materializePacket` export from the tab (zero-risk). Then `planPacketDocumentWrites({ personName, templateDocs, personDocuments })` → a list of `update` / `insert` writes in `lib/contractPackets.ts` + tests; the lib function and `savePacket` loop the plan |
| `overheadBreakdownModalModel` | 110-line `useMemo` (920–1029) | `lib/overheadBreakdownModel.ts` — `buildOverheadBreakdownModel(scope, workDate, { laborDetailByDay, officePartsDetailByDay, otherJobsLabor, otherJobsPartsDetailByDay, bucketByTxId })` + tests (Internal-Transfer exclusion, Combined, refund negatives) |
| `overheadTableTotals` | `useMemo` 890–916 | `sumOverheadDayTableRows` beside `mergeOverheadDayTableRows` in `overheadDailyLabor.ts` + test |
| `overheadHygieneCards` / `overheadLensCards` view-models | inline 1128–1201 | optional `lib/overheadStripCards.ts` (pure copy/format) |
| Week math (`shiftOverheadWeek`, `showOverheadWeekOf`, initial Sun–Sat) | inline 207–220, 1058–1110 | one `overheadWeekOf(ymd)` / `shiftWeek` helper (preserve noon anchor + device-local `Date`) |

Already extracted with tests (do not re-do): `contractsQuickSend`, `contractsRosterFilter`, `contractsAgreementsPanel`, `personContractStatusCounts`, `contractPackets`, `forms/formParties`, `contractSigningEmail`, `personContractAppliedDate`, `contractBookVersionDate`, and every `overhead*` lib listed at the top of the Overhead dossiers. Extracted **without** tests: `contractBodyFormat`, `contractSigningContent` (`hasContractSigningContent` — the Send guard), `checkGoogleDriveAttachmentUrl`. (The old `contractSendEmailPreview` kernel is retired — the preview now calls `buildContractSigningEmail`.)

## Test coverage

No render smoke exists for either tab (`PeopleContractsTab.render.test.tsx` / `PeopleOverheadTab.render.test.tsx` absent), nor for `OverheadPoolTrendCard`, `OverheadPoolDayModal`, `OverheadLensModal`, `OverheadPeopleTable`, `OverheadPeopleCellModal`, `ContractsAgreementsPanel`, `ContractQuickSendPicker`, `ContractLibraryModal`. Test counts are `it(`/`test(` occurrences.

| Region | Kernel tests | Inline, untested | Risk flag |
|---|---|---|---|
| C data engine | — | `loadContracts` | low (reads) |
| C row builders | — | `getDocumentsForPerson`, aggregate status, applied-version options, upsert payload | **med — drives every status dot, bucket and saved row** |
| C roster | `contractsRosterFilter` 8, `personContractStatusCounts` 3, `forms/formParties` 2 | bucket memo, search memos | low |
| C agreements / quick send | `contractsAgreementsPanel` 9, `contractsQuickSend` 14 | `materializeQuickSendRow` (writes) | low-med |
| C assign packets | `contractPackets` 6 (2 on `assignPacketsConsequence`, 1 on `personContractDocumentHasStaffData`) | `materializePacketForPerson`, unassign (sequential writes) | med |
| C document modal | `personContractAppliedDate` 6, `contractBookVersionDate` 9 | payload forcing matrix; `contractBodyFormat` / `contractSigningContent` untested | med |
| C send modal | `contractSigningEmail` 8 | `sendContractForSignature` | low |
| C help modal | `ContractsTabHelpModal.render.test.tsx` | — | — |
| O weekly engine | `overheadDailyLabor` 35, `fetchOverheadOfficePartsByDay` 12, `overheadPartsAccountingBuckets` 20, `overheadPartsBucketLoader` 7 | `overheadTableTotals` (period $ sums + footer Overhead %) | **money math untested** |
| O 90-day panel | `overheadPoolSnapshot` 9, `overheadAvgDailyCost` 9, `overheadRateMethods` 8, `overheadHygiene` 14, `overheadPoolTrend` 5, `overheadLensSeries` 6, `overheadPoolDayLines` 6, `overheadPeopleTable` 6, `overheadPeopleCellModel` 7 | `overheadPeopleParts` (transfer filter + card attribution) | low-med |
| O breakdown modal | (inputs tested) | `overheadBreakdownModalModel` — per-scope totals, Materials recompute, grand totals | **money math untested — Stage A first** |
| O settings / toolbar | `overheadOfficeJobSettings` 5, `overheadTableViewStorage` 5 | week math | low |

## Cross-surface duplication

| Pattern | Files | Note |
|---|---|---|
| Packet → person-document materialize (latest-lineage UPDATE or fresh v1 INSERT, fill body only when empty) | `PeopleContractsTab.materializePacketForPerson`, `src/lib/people/materializePacket.ts` (lifted copy; `PersonDeskPaperworkSection`, `lib/people/hireWrites.ts`), `src/components/contracts/ContractLibraryModal.tsx` (`savePacket` ~287–330) | same rules, three copies; the tab should import the lib one, then extract a pure write planner into `lib/contractPackets.ts` |
| `personContractDocumentHasStaffData` | `PeopleContractsTab.tsx` 80–97, `src/lib/contractPackets.ts` | identical bodies; tab should import |
| Raw `fetch` to `send-contract-for-signature` (JWT + anon key + JSON body + `{ok, emailed, accept_url}` handling) | `PeopleContractsTab.sendContractForSignature`, `src/components/jobs/LienWaiverSendModal.tsx` ~152 | a `lib/contracts/sendContractForSignature.ts` client helper |
| 90-day overhead pool scan | `lib/overheadPoolSnapshot.ts` (tab, Dashboard, bridge, job day ledger) vs `src/components/people/PeopleReviewTab.tsx` (own fetch orchestration, effect ~411–647, over the same kernels) | Review tab could consume the snapshot loader (region A of [`PEOPLE_REVIEW_TAB_ARCHITECTURE.md`](./PEOPLE_REVIEW_TAB_ARCHITECTURE.md) plans the same thing) |
| Office job setting read | `PeopleOverheadTab` effect 372–411, `src/pages/People.tsx` ~2671, `PeopleReviewTab`, `src/hooks/useOverheadOfficeJobId.ts` (module cache), ~12 more readers | tab writes notify none; only the module cache stays stale until page reload |
| Debounced `search_jobs_ledger` picker (300 ms + `UnifiedSearchResultRow`) | `PeopleOverheadTab` 789–816 + ~20 other components (`AssignFocusModal`, `ClockInOutButton`, `HoursUnassignedModal`, `JobPaymentMoveModal`, …) | a shared `useJobsLedgerSearch` hook would serve all |

## Recommended extraction order (value ÷ risk)

1. **Contracts Stage A** — `personContractRows` (feeds 4 memos, the render and `getAggregateStatusForTemplate`; enables a single per-person row memo), `contractDocumentPayload`, and the zero-risk `personContractDocumentHasStaffData` import. Each independently shippable.
2. **Overhead Stage A** — `overheadBreakdownModel` + `sumOverheadDayTableRows`: closes the two untested money-math regions.
3. **`ContractSendForSignatureModal`** (+ shared `sendContractForSignature` client helper, also adopted by `LienWaiverSendModal`) — ~300 lines out, self-contained once the parent holds one `sendRequest` object.
4. **`OverheadBreakdownModal`** (with `OverheadPartsSectionsList`) — ~470 lines out after step 2.
5. **Packet write planner**: swap the inline `materializePacketForPerson` for the existing `lib/people/materializePacket.ts` export, then add the planner in `lib/contractPackets.ts`. After that, **`ContractsAssignPacketsModal`** (~375 lines incl. handlers).
6. **`OverheadOfficeJobModals`** (office-job modal + picker + debounced search + 2 hooks + 4 states, ~320 lines; the open flag stays with the toolbar button).
7. **`ContractDocActions`** component from `renderContractDocActions` (185 lines, pure JSX + callbacks), then the roster body if still wanted.
8. **`OverheadDayTable`** (331 lines, presentational; optional).
9. **`ContractDocumentFormModal`** + delete-confirm — last (≈25 states, shared field renderers, Book pick handoff, paper-entry door, save-and-send chain).
10. Optional seams if the files keep growing: `usePeopleContractsData` (4 caches + `twoPartyTemplateIds` + `loadContracts` + `contractsError`) and `usePeopleOverheadWeek` (scope + 6 weekly effects + bucket map + merged memos).

### What must STAY in the parents

- **In `People.tsx` (unchanged by this work):** the `?tab=` router + role guards (`canAccessOverheadTab`, `canAccessContracts`), `canDeletePeopleContracts`, the `people`/`users`/archived rosters, `payConfig`/`loadPayConfig`, `authUser`/`setError`, and the Users-tab `contractSigningStatusByPersonName` rollup.
- **In `PeopleContractsTab`:** the caches + `twoPartyTemplateIds` + `loadContracts`, `selectedContractsPersonName`, `contractsError` (until per-modal errors are threaded), the send request, the roster filter/archived state, and the `ContractBookModal` render + `contractBookPickFromDocumentModal` predicate + `paperEntryFor` + `officeModalDocId`.
- **In `PeopleOverheadTab`:** `overheadDateStart`/`End`, `overheadOfficeJobLedgerId`/label, `overheadTableSimpleView`, both engines' states and effects, the wage lookup, the bucket map, and the open-state of every modal (breakdown, lens, pool day, office job) — the table/strips/toolbar and their modals are siblings.

## Preserve-quirks list (odd but load-bearing)

1. **Persons are `person_name` strings**, the union of `people` + `users` names minus archived — renames orphan contract rows; do not introduce an id key during a move. **Archived wins over an active twin** (`contractsArchivedNameSet`).
2. **80 ms `setTimeout`** before the initial `loadContracts()`.
3. **UI inserts are always `lineage_version: 1`** with a fresh `crypto.randomUUID()` lineage id (`saveContractDocument`, `saveContractDocumentAndOpenSend`, `materializeQuickSendRow`, `materializePacketForPerson`, `ContractLibraryModal`, `lib/people/materializePacket.ts`); `lineage_version > 1` rows are minted only by `create_pending_contract_versions_after_book_save`. The roster shows **every** version as its own row, newest first.
   - **Quick-send writes at Send, not at pick** (v2.2851, decision 17): `openQuickSendForPerson` computes the plan and opens Send with `contractSendQuickSend`; `contractSendDocId` stays null for `insert`. `sendContractForSignature` calls `materializeQuickSendRow` immediately before the POST, pins the id and flips the plan to `reuse` so a failed send retries the same row. Cancel resets state only. Add document → Save & send still saves on purpose before opening the modal.
4. **Applied-version pin fallback:** a pin only counts if the pinned book row still matches the document name AND a currently-assigned template; otherwise the latest effective book date among assigned templates is shown. `applied_version_date` (Custom date) overrides the book-derived date.
5. **Add-tab forcing matrix** (`getContractDocumentUpsertPayload`): Request Signature forces `status='unsent'` and nulls `url`/`signed_at`/`note`; Upload Signed forces `status='signed'`, nulls signing body, canonical URL, applied pin and applied date, forces `signing_body_format='html'` and dashboard prompt false. Edit keeps the chosen status; dashboard prompt is forced false whenever status is `signed`.
6. **Empty-placeholder deletion guard:** unassign (and packet-document removal in `ContractLibraryModal.savePacket`) deletes a person row only when `personContractDocumentHasStaffData` is false — signed or in-progress documents always survive.
7. **Sequential N+1 writes by design** in `materializePacketForPerson`, `assignSelectedPacketsToPerson`, `unassignPacketFromPerson` (one await per doc/packet) — no batching during the move.
8. **`sendContractForSignature` uses raw `fetch`** with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` + session JWT, not `supabase.functions.invoke`.
9. **Single shared `contractsError`** rendered in the header and in the Assign, Document and Send modals.
10. **JSX-in-`useMemo` field blocks** (`contractDocModalContractTextField` / `CanonicalUrlField`) sit beside `contractBodyFormatBtn`, a per-render style function — harmless, preserve.
11. **`contractsRosterBuckets` deps omit `twoPartyTemplateIds`** — correct only because `loadContracts` sets it in the same post-`await` batch as `personContractAssignments`/`personContractDocuments` (templates + template docs are set earlier, before the `contract_form_templates` await); keep that ordering if the loader moves. `loadContracts` also clears `contractsLoading` before the `contract_form_templates` read, and that read's error is swallowed (empty two-party set).
12. **Roster filter default:** with nothing stored, `defaultContractsRosterFilter(attention count)` picks the chip; a non-empty search ignores the filter and also opens the Archived section when it matches there.
13. **Send portal URL is read, never minted:** only when exactly one active `people` row has the name, with a saved slug and an unrevoked link.
14. **Overhead `setError` prop IS used** — `reportOverheadLoadError` forwards every per-source failure to it (earlier maps said it was unused).
15. **Week defaults, `shiftOverheadWeek` and `showOverheadWeekOf` use device-local `Date` + `localCalendarDayKey`** (the latter two noon-anchored to dodge DST) while row labels use `APP_CALENDAR_TZ` and the 90-day window anchors on `denverCalendarDayKey` — a deliberate mismatch to preserve.
16. **Office scope query shape:** `.or(`job_ledger_id.eq.${id},bid_id.not.is.null`)` (string-interpolated); with no office job, office scope = bid-only sessions and field = ALL jobs-ledger sessions (the modal heading switches to "Materials (all jobs)").
17. **Office-job-wins and recorded-time rules live in `overheadDailyLabor`** (v2.3261, `isRecordedClockSession`: closed, not rejected/revoked, approved or pending) — the component must not re-implement them. **Copy drift:** the lens cards' `lensInclusionRule` ("approved, not revoked, not rejected, clocked out") and Method A's "approved clock hours" tooltip predate v2.3261; fix as a copy change, not during a move.
18. **Internal Transfers (symmetric exclusion):** every Materials figure — Office parts column, Office Total, both sides of Overhead %, the 90-day pool, the people table and all three Materials-bearing breakdown scopes — excludes the `internal_transfer` bucket; excluded lines still render in the modal with the slate accent + "not counted in Materials".
19. **Refunds are negative lines** (v2.3519): `OverheadPartsSectionsList` renders "−$… refund"; do not `Math.abs` amounts during a move.
20. **Bucket map is precomputed per detail-map change**, not per modal open; unassigned tx ids default to `'other'` via `bucketForOverheadPartsLine`.
21. **90-day scan runs once**: it waits for `overheadPayConfigLoaded` AND the person-link map, and keys on the JSON wage content — keep both gates if the effect moves.
22. **Single combined loading gate** hides the whole day table until all four weekly loads settle; the breakdown modal auto-closes on any week change.
23. **Persistence keys:** localStorage `people_overhead_table_simple_view_v1` (default Advanced), `people_contracts_agreements_panel_hidden_v1`, `people_contracts_roster_filter_v1`; app_settings `overhead_office_job_ledger_id_v1` (also read by `People.tsx` and `useOverheadOfficeJobId`).
24. **Simple vs Advanced views order columns differently** (Simple: Overhead % before Office Total; Advanced: Office Total before Overhead %) — preserve both layouts and the `borderLeft` group separators.

## Recent churn (git log)

- **Contracts:** the 2026-08-05 wave v2.1398–v2.1411 (applied version date, help modal, mobile cards + status counts, roster filter chips, Agreements panel, split view + Archived, quick send, Contract library + packets replacing Manage templates / Assign template); v2.2717 `PersonNameDoor`; v2.2773 sign-this email on portal paper; v2.2794 / v2.2801 / v2.2803 Contract Forms (Form Studio, Enter from paper, office flow); v2.2851 quick-send write-after-confirm; v2.2955 / v2.2959 form guard on Save & send. Grew ~690 lines since the last refresh.
- **Overhead:** v2.1285 lenses, v2.1307 / v2.1319 / v2.1320 correctness + hygiene; v2.2673–v2.2676 pool trend, lens modals, people table, shared snapshot loader; v2.3061 date-source sweep; v2.3261 recorded time; v2.3264 people cell modal; v2.3269 pool day panel; v2.3519 refund sign. Most new surface landed as extracted children, so the tab itself grew only ~50 lines.

Definition of done per extraction, verification gates (`npm run typecheck && npm run lint && npm test` after every step), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). Behavior-preserving only.
