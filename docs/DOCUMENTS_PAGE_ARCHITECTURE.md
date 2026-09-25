# Documents Page Architecture Map

---
file: docs/DOCUMENTS_PAGE_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the Documents.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what each tab of the 1,926-line src/pages/Documents.tsx owns (the four in-file ledger components, the unified Search tab, the tab router, module-scope helpers; state, loaders, memos, writes, supabase tables/storage, extracted modals, coupling, test coverage) so extraction can start without re-deriving the strategy. Sections: What this surface is; Master summary table; Per-region dossiers; Shared substrate; Stage-A inventory (+ cross-surface duplicates); Preserve-quirks list; Recommended extraction order; Hazards.
covers:
  - src/pages/Documents.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

> **Line numbers are exact as of `a05cef4c4`** (from the `npm run map -- src/pages/Documents.tsx` fact sheet) and rot with the next edit — search the symbol; the range is only a hint. Re-run `npm run map` before trusting a range.

## What this surface is

[`src/pages/Documents.tsx`](../src/pages/Documents.tsx) is the office's **read-mostly document ledger** at `/documents`: seven tabs — four ledgers (Estimates, Bid proposals, Jobs, Supply invoices), each a flat table of the newest 200 records of one kind with a "Docs" column of icon buttons (open the sent/accepted/signed paper, open a Drive/file link, or **+** to attach a link); a cross-ledger **Search** tab; the **Company** documents list; and an **Upload** placeholder. The only in-file writes are the four "+ add link" saves (the Company tab's extracted `SettingsCompanyDocumentsSection` with `showManage` also lets a dev insert/update/reorder/delete `company_documents` rows), and nothing on the page does money math — every dollar figure is a formatted column.

- **Mounted by:** `src/App.tsx` only — `lazy(() => import('./pages/Documents'))` (line 45), `<Route path="documents" element={<Documents />} />` (line 338). ROUTES: `/documents` → `Documents`, 1926 lines. Default export, **no props**.
- **Who reaches it:** dev / master / assistant-like (every non-banking route), estimator (`estimatorAllowedPaths`), primary (`PRIMARY_PATHS`), superintendent (`SUPERINTENDENT_PATHS`) in [`layoutRouteAccess.ts`](../src/lib/layoutRouteAccess.ts); subcontractor-like roles are bounced. Nav: the Layout gear menu (`Layout.tsx` 1658–1686, hidden in farm mode) and the phone dock (`phoneDock.ts` `documents`, `notField`). No in-app `?tab=` deep links point here (grep of `src/` at `a05cef4c4`).
- **Shape:** unusual for a big page — it is **already componentized inside one file**. The four ledgers are module-level functions with one clean prop (`DocumentsLedgerEmbedProps = { embedSearch?: string }`, line 249), each owning its own state, loader and modals. The parent (`Documents`, 88 lines) owns only the `?tab=` router and the Company-tab role gate. Nothing is shared between ledgers at runtime; the Search tab re-mounts all four in "embedded" mode.

**Hook census (fact sheet):** 26 `useState` · 0 `useReducer` · 4 effects · 5 `useMemo` · 4 `useCallback` · 0 `useRef` · 14 custom hooks · 6 components · 18 module functions · 18 commits in 90 days (last 2026-09-11, `11ce04c24`, v2.3331 test reports).

| Component | Lines | useState | Effects | useMemo | useCallback | Custom hooks |
|---|---|---|---|---|---|---|
| `DocumentsEstimatesLedger` | 253–483 (231) | 6 | 1 | 1 | 1 | 2 (`useAuth`, `useToastContext`) |
| `DocumentsJobsLedger` | 638–1183 (546) | 10 | 1 | 1 | 1 | 3 (+ `useTestReportModalOptional`) |
| `DocumentsBidProposalsLedger` | 1187–1509 (323) | 5 | 1 | 2 | 1 | 2 |
| `DocumentsSupplyHouseInvoicesLedger` | 1511–1783 (273) | 4 | 1 | 1 | 1 | 3 (+ `useLedgerPrefixMap`) |
| `DocumentsUnifiedSearchTab` | 1791–1837 (47) | 1 | 0 | 0 | 0 | 1 |
| `Documents` (default export) | 1839–1926 (88) | 0 | 0 | 0 | 0 | 3 (`useLocation`, `useSearchParams`, `useAuth`) |

**Monster blocks:** `DocumentsJobsLedger` render 840–1182 (343; its `loading` ladder 893–1180 is 288, with four child-row loops 1018–1173 ≈ 156) and its `load` callback 668–810 (143, five sequential queries); `DocumentsBidProposalsLedger` render 1291–1508 (218); `DocumentsSupplyHouseInvoicesLedger` render 1572–1782 (211); `DocumentsEstimatesLedger` render 308–482 (175). Module scope carries ~205 lines of pure helper functions (the 18 module functions; plus ~57 lines of row types) spread over 47–182 and 485–636 and ~70 lines of style constants (184–251, 1785–1789).

---

## Master summary table

| Region | Anchor (symbol + lines) | ~Lines | Coupling | Risk | Status |
|---|---|---|---|---|---|
| Tab router + Company/Upload tabs | `Documents` 1839–1926; `setDocumentsTab` 1852–1857; `companyTabVisible` 1845–1850 | 88 | `?tab=` URL; role gate mirrors `company_documents` RLS | low | inline (tab parser **extracted** → [`lib/documentsPageTab.ts`](../src/lib/documentsPageTab.ts); Company body **extracted** → [`SettingsCompanyDocumentsSection`](../src/components/settings/SettingsCompanyDocumentsSection.tsx)) |
| Unified Search tab | `DocumentsUnifiedSearchTab` 1791–1837 | 47 | mounts all four ledgers with `embedSearch` | low (after the ledgers move) | inline |
| Estimates ledger | `DocumentsEstimatesLedger` 253–483 + helpers 47–93, 168–182 | 231 + ~60 | none beyond auth/toast; `estimates` UPDATE | low | inline (modals extracted) |
| Bid proposals ledger | `DocumentsBidProposalsLedger` 1187–1509 + helpers 96–166, `COVER_LETTER_TAB` 1185 | 323 + ~70 | `bids` UPDATE via refusal guard; `/bids?bidId=&tab=cover-letter` link | low-med | inline (link modal extracted) |
| Jobs ledger (+ billed invoices, contracts, test reports, lien releases) | `DocumentsJobsLedger` 638–1183 + helpers 485–534, 597–636 | 546 + ~90 | 5 tables + storage bucket; TestReportModal context; primary scoping; signed legal papers | **med** | inline (3 modals extracted) |
| Supply-house invoices ledger | `DocumentsSupplyHouseInvoicesLedger` 1511–1783 + helpers 536–595 | 273 + ~60 | `useLedgerPrefixMap` context; `supply_house_invoices` UPDATE | low | inline (link modal extracted) |
| Module styles | `tableStyle` … `documentsLedgerEmbedHintStyle` 184–251, `documentsUnifiedSectionHeadingStyle` 1785–1789 | ~75 | read by all four ledgers + Search — except `documentsPageVisuallyHiddenH1Style` 237–247, read only by the router (1861) | none | inline |
| Module pure helpers | 18 module functions (see Stage A) | ~205 | each read by one ledger (+ its search predicate) — **except `formatJobRevenueUsd` 531–534, read by Jobs (1016, 1040, 1148, predicates 603/631) and Supply (predicate 580, cell 1772)** | low, **untested** | inline |

Already extracted and mounted here: [`DocumentsAddDriveLinkModal`](../src/components/documents/DocumentsAddDriveLinkModal.tsx) (248 lines; URL normalize via `normalizeCustomerAttachmentUrl` + the try/catch that toasts a thrown `onSave`), [`DocumentsJobBilledInvoiceModal`](../src/components/documents/DocumentsJobBilledInvoiceModal.tsx) (277), [`DocumentsLedgerDocIcons`](../src/components/documents/DocumentsLedgerDocIcons.tsx) (37), `CustomerAcceptanceRecordModal`, `EstimateSentDocumentModal`, `JobSignedAgreementModal`, `SettingsCompanyDocumentsSection` (278). None of these seven has a test or render test (git grep at `a05cef4c4`).

---

## Per-region dossiers

### Tab router + Company / Upload tabs — `Documents` 1839–1926

- **Render:** visually hidden `<h1>` (style 237–247), a wrap row of `pageTabStyle` buttons 1863–1911, then one conditional body per tab 1913–1923. Tabs are **conditionally rendered** (unmount on switch).
- **State:** none — the tab lives in the URL. `documentsTab = parseDocumentsPageTabFromSearch(location.search)` (1843) reads `useLocation`, not `searchParams`; `setDocumentsTab` (1852–1857) writes `tab`, **deletes legacy `ledger`**, `replace: true`.
- **Tab values** ([`documentsPageTab.ts`](../src/lib/documentsPageTab.ts), 31 lines): `company | search | estimates | bid-proposals | jobs | supply-invoices | upload`; missing/empty/`ledger` → `estimates` unless `ledger=bid-proposals`; unknown → `estimates`.
- **Role gate:** `companyTabVisible` (1845–1850) = dev / master_technician / assistant / controller / estimator — a literal list matching the `company_documents` SELECT policy (`20260722248000_company_documents.sql`). Company renders `SettingsCompanyDocumentsSection isDev={role==='dev'} showManage` — the section loads and (dev ⚙ manage) inserts/updates/reorders/deletes `company_documents` itself, a table the fact sheet's Data line omits because the calls live in the child (Settings mounts the same section at `Settings.tsx:1185` without `showManage`).
- **Upload:** placeholder text only (1916–1918).
- **Tests:** none — no `Documents.render.test.tsx`; `documentsPageTab.ts` has **no test**; `pageTabStyle` untested (styling).
- **Risk / approach:** low. Stays the parent. Stage A: `canSeeCompanyDocuments(role)` + `documentsPageTab.test.ts`.

### Unified Search tab — `DocumentsUnifiedSearchTab` 1791–1837

- **State (moves):** `query` (1793). Derived `filterQuery = q.length >= 2 ? query : ''` (1794–1795); a one-character hint at 1813–1817.
- **Render:** one search input + four `<h2>` sections, each an embedded ledger (`embedSearch={filterQuery}`) 1819–1834.
- **Data:** none of its own — but mounting it fires **all four ledger loads** (1 + 5 + 3 + 1 = 10 queries) before a key is pressed; every ledger holds up to 200 rows and filters client-side.
- **Coupling:** imports the four ledger components; relies on each ledger's embedded contract (hide own input, `[]` until the query is non-empty, hint text in `documentsLedgerEmbedHintStyle` 251).
- **Tests:** none. **Risk:** low; move **after** the four ledgers so it imports them from their new files.

### Estimates ledger — `DocumentsEstimatesLedger` 253–483

- **Owned state (all moves):** `rows` 257, `loading` 258, `search` 259, `acceptanceRecordEstimateId` 260, `sentPreviewEstimateId` 261, `addDriveLinkEstimate` 262.
- **Memo:** `filteredRows` 269–275 (embedded + empty query → `[]`).
- **Loader:** `load` 277–298 — `estimates` `select('*, customers(name, address, contact_info), jobs_ledger(id, hcp_number, job_name)')`, `status in (draft, sent, declined, customer_accepted)`, `updated_at desc`, `limit 200`; effect 300–302.
- **Write:** link save 321–342 — `estimates.update({ customer_attachment_url, customer_attachment_label: null }).eq('id').eq('status','draft').select('id')`; zero rows → "no longer a draft" toast (guarded).
- **Docs column:** accepted → `CustomerAcceptanceRecordModal`; sent → `EstimateSentDocumentModal`; draft → **+** link.
- **Money:** `formatMoney(total_cents)` — **cents ÷ 100** (52–54).
- **Links out:** `/estimates/<estimate_number>` 435, `/jobs?edit=<job_ledger_id>` 443.
- **Helpers:** `documentsLedgerStatusLabel` 57–70, `ledgerLinkedJobHcp` 72–75, `documentsLedgerRowMatchesSearch` 77–93, `ledgerCustomerColumnLines` 168–182 (name/address → `customer_email` → `for_address` → `—`).
- **Tests:** none for the component or its helpers.
- **Approach:** Stage A helpers → `src/lib/documents/estimatesLedger.ts` + test; then verbatim move → `src/components/documents/DocumentsEstimatesLedger.tsx`.

### Bid proposals ledger — `DocumentsBidProposalsLedger` 1187–1509

- **Owned state (moves):** `rows` 1191, `countRowsByBidId` 1192, `loading` 1195, `search` 1196, `addDriveLinkBid` 1197 (`column: 'submission' | 'folder' | 'choose'`).
- **Memos:** `filteredRows` 1271–1280 (search also matches the active version's fixture names/counts); `tableRows` 1282–1285 — **drops `outcome === 'lost'` unless a search is typed**.
- **Loader:** `load` 1203–1264 — `bids` (explicit columns + `customers(name, address)`, `service_type:service_types(name)`, `updated_at desc`, `limit 200`), then `Promise.all` of `bids_count_rows` and `bid_versions` (1226–1241); active version = `selected_bid_version_id` ?? first by `sort_order` ?? unsplit (`null`) rows (1244–1255, v2.2132). Effect 1266–1268.
- **Write:** link save 1304–1323 — `bids.update({ bid_submission_link } | { drive_link }).select('id')` → `bidUpdateRefused(rows)` → `BID_UPDATE_NOT_APPLIED_MESSAGE` (guarded; `lib/bids/updateGuard.ts`).
- **Docs column:** submission link (filled icon), project folder (folder icon), and one **+** (`choose`) when both are missing, else a per-column **+** (1368–1436).
- **Money:** table shows `$` + `Math.round(bid_value).toLocaleString('en-US')` (1498) — **dollars**; search matches `formatBidValueCompact` (`$153k`, 96–101) instead — display and search disagree.
- **Links out:** `/bids?bidId=<id>&tab=cover-letter` (`COVER_LETTER_TAB` 1185, 1367).
- **Helpers:** `formatBidValueCompact` 96–101 (verbatim copy of `formatCompactCurrency` in [`lib/bids/bidFormatting.ts`](../src/lib/bids/bidFormatting.ts), which is tested), `documentsBidStatusLabel` 122–128, `bidProposalCustomerLines` 130–140, `documentsBidProposalsRowMatchesSearch` 142–166.
- **Tests:** `bidSearchStatusChip` (jobSearchEvidence.test.ts) and `bidUpdateRefused` (updateGuard.test.ts) are covered; the in-file helpers and the version pick are not; `getBidServiceTypeTag` is not exercised by `unifiedJobBidSearch.test.ts`.
- **Approach:** Stage A → `src/lib/documents/bidProposalsLedger.ts` (+ `pickActiveVersionCountRows(bids, versions, countRows)`), import `formatCompactCurrency`; then verbatim move.

### Jobs ledger — `DocumentsJobsLedger` 638–1183 (the big one)

- **Owned state (all moves):** `rows` 642, `invoicesByJobId` 643, `lienReleasesByJobId` 646, `contractsByJobId` 647, `testReportsByJobId` 649, `loading` 651, `search` 652, `addDriveLinkJob` 653, `billedInvoiceModal` 654, `contractRecord` 655.
- **Hooks:** `useAuth` → `{ user, role }` 640 (role drives primary scoping), `useToastContext` 641, `useTestReportModalOptional` 650 (provider at `App.tsx:263`).
- **Memo:** `filteredRows` 658–666 — matches job fields, billed invoices and test-report `searchText`; **not** contracts or lien releases.
- **Loader:** `load` 668–810, deps `[user?.id, role, showToast]`, effect 812–814. Five **sequential** reads:
  1. `jobs_ledger` 674–686 — explicit columns, `customers!jobs_ledger_customer_id_fkey(name, address)` (named FK: two customer FKs since v2.1175), `service_type:service_types(name)`, `.match(role === 'primary' ? { account_manager_user_id: user.id } : {})` (v2.2177), `updated_at desc`, `limit 200`.
  2. `jobs_ledger_invoices` 699–727 — `status = 'billed'`, grouped + re-sorted by `sequence_order`, `created_at`; failure toasts.
  3. `job_lien_releases` 735–755 — `status != 'draft'`; fail-soft (RLS office-only → others see none).
  4. `job_contracts` 758–778 — `status != 'draft'`; fail-soft.
  5. `job_test_reports` 781–801 — all statuses, mapped through `testReportDocumentRow`; fail-soft.
- **Handler:** `openTestReportDocument` 816–834 — `tr.door.kind === 'pdf'` (status `sent` **and** a `pdf_path`, per `testReportDocumentRow`) → `supabase.storage.from('job-test-reports').createSignedUrl(path, 300)` → `openInExternalBrowser`; otherwise (drafts, or sent without a PDF) → `fetchJobWithDetailsById` → `testReportModal.openTestReport({ job, reportId, onChanged: load })`; returns silently when the context is absent.
- **Write:** Drive link save 865–877 — `jobs_ledger.update({ google_drive_link })` with **no `.select` / refusal check**.
- **Render:** main row 931–1017 (Drive folder icon or **+**; `J<num> · name` title via `effectiveJobLedgerNumber` + `getBidServiceTypeTag`; `jobPickerStatusChip`; revenue); child rows: billed invoices 1018–1047 (→ `DocumentsJobBilledInvoiceModal`), contracts 1048–1077 (signed → `JobSignedAgreementModal` with an inline `coverage` literal 851–855; unsigned → `openHtmlPreviewWindow(buildJobContractRecordHtml(con, r, null))`), test reports 1078–1103, lien releases 1104–1173 (form-type fallback + typed-signature builder 1105–1117 → `buildLienWaiverPrintHtml` preview).
- **Money:** `formatJobRevenueUsd` (531–534, **dollars**) for job revenue, invoice amounts and lien-release amounts. Display only.
- **Links out:** `/jobs?edit=<id>` 964.
- **Helpers:** `jobLedgerCustomerLines` 508–522, `documentsJobLedgerStatusLabel` 524–529, `formatJobRevenueUsd` 531–534, `documentsJobInvoiceMatchesSearch` 597–611, `documentsJobsRowMatchesSearch` 613–636; `TEST_REPORT_BUCKET` 506.
- **Tests:** kernels it calls are tested — `jobsLedgerStatusPipeline`, `lienReleaseTracking`, `lienReleaseLifecycle`, `lienWaiverRelease`, `ledgerDisplayPrefixes`, `scheduleDispatchHub` (`jobPickerStatusChip`), `testReportDocumentRow`, `jobContractLifecycle` (via `jobContractDocument.test.ts`: chips / audit line / status only). **Untested:** every in-file helper, the group-by-job loops, `billingTypeLabel` (a pure function living in the 975-line `HostedStripeBillPanel.tsx:143`), `buildJobContractRecordHtml` (component file `JobContractRecordModal.tsx:75`), `fetchJobWithDetailsById`, `openInExternalBrowser`, `printWindow`.
- **Risk:** medium — signed legal papers (contracts, lien waivers) and signed storage URLs render here; the loader's partial-reset quirks must survive the move.
- **Approach:** Stage A → `src/lib/documents/jobsLedger.ts` (helpers + `groupRowsByJobId` + job title builder 917–920 + `signedContractCoverage(row)`), and the lien print args into `lib/jobs/lienReleaseLifecycle.ts` (shared with two other surfaces — see Cross-surface). Stage B in two steps: (1) `useDocumentsJobsLedgerData(user, role)` hook seam for the state `load` writes — `rows` / `*ByJobId` 642–649 **and `loading` 651** — + `load` (tab-local, so it may also stay inside the moved component); (2) move to `src/components/documents/DocumentsJobsLedger.tsx`, optionally splitting the child-row loops into `DocumentsJobChildRows.tsx`.

### Supply-house invoices ledger — `DocumentsSupplyHouseInvoicesLedger` 1511–1783

- **Owned state (moves):** `rows` 1516, `loading` 1517, `search` 1518, `addDriveLinkInvoice` 1519.
- **Hooks:** `useLedgerPrefixMap` 1515 (job titles via `formatJobLedgerDocTitle`).
- **Memo:** `filteredRows` 1526–1532. **Loader:** `load` 1534–1562 — `supply_house_invoices` `*, supply_houses(name), supply_house_invoice_job_allocations(job_id, pct, jobs_ledger(id, hcp_number, click_number, job_name, job_address, service_type_id))`, `invoice_date desc`, `limit 200`; effect 1564–1566. No role scoping in the query (RLS decides).
- **Write:** link save 1585–1597 — `supply_house_invoices.update({ link })`, **no `.select` / refusal check**.
- **Render:** allocations sorted by `pct` desc, each a `/jobs?edit=` link (1706–1748); the allocation line is built **twice** (tooltip `allocTitle` 1653–1667 and per-link 1714–1717); `(Paid)` marker 1757–1759.
- **Money:** `formatJobRevenueUsd(Number(r.amount))` — dollars; `pct` shown as `· N%`.
- **Helpers:** `supplyHouseInvoiceLedgerHouseName` 554–558 (object-or-array embed), `supplyHouseInvoiceLedgerAllocations` 560–564, `formatSupplyInvoiceDateYmd` 566–571 (noon anchor), `documentsSupplyInvoiceRowMatchesSearch` 573–595; row types 536–552. **Cross-ledger dependency:** the predicate (580) and the Amount cell (1772) call the Jobs helper `formatJobRevenueUsd` 531–534.
- **Tests:** `ledgerDisplayPrefixes` tested; nothing in-file.
- **Approach:** the cheapest ledger — Stage A → `src/lib/documents/supplyInvoicesLedger.ts` (+ `supplyAllocationLine(prefixMap, alloc)`), then verbatim move.

---

## Shared substrate

**No selection pointer and no shared data engine.** Each ledger loads, owns and refreshes its own rows; nothing crosses between tabs. What is shared:

| Shared thing | Where | Owner after decomposition |
|---|---|---|
| `?tab=` (+ legacy `ledger`) | `Documents` 1843, 1852–1857 | **parent** (router) |
| Role → Company tab gate | `companyTabVisible` 1845–1850 | **parent** |
| Embed contract `embedSearch?: string` | `DocumentsLedgerEmbedProps` 249; `embedded = embedSearch !== undefined` in each ledger | a shared type in `src/components/documents/documentsLedgerTypes.ts` |
| Identical "search → rows" rule (embedded + empty ⇒ `[]`; empty ⇒ all; else predicate) | `filteredRows` 269–275, 658–666, 1271–1280, 1526–1532 | pure `filterLedgerRows(rows, query, embedded, matches)` in `src/lib/documents/` |
| Identical state ladder (search input → Loading → empty → embed hint → no match → table) | 354–480, 879–1180, 1325–1506, 1599–1780 | optional `DocumentsLedgerFrame` later — not a move prerequisite |
| Style constants | 184–251, 1785–1789 | `src/components/documents/documentsLedgerStyles.ts` |
| `DocumentsAddDriveLinkModal` | mounted by all four ledgers | already extracted |

A hook seam is **not** needed before the moves: every ledger is already props-clean. The only engine-like block is the Jobs loader, and it is tab-local.

---

## Stage-A inventory

Pure logic still inline (target `src/lib/documents/*` unless noted; every row is untested today):

| Symbol(s) | Lines | Target | Test focus |
|---|---|---|---|
| `formatMoney` (cents) | 52–54 | `estimatesLedger.ts` (or a shared cents formatter — 4 more private copies exist, see Cross-surface) | cents ÷ 100; pin locale |
| `documentsLedgerStatusLabel`, `ledgerLinkedJobHcp`, `ledgerCustomerColumnLines`, `documentsLedgerRowMatchesSearch` | 57–93, 168–182 | `estimatesLedger.ts` | fallback chain; search hits on status label, raw status, HCP, formatted total |
| `formatBidValueCompact` | 96–101 | **delete** → import `formatCompactCurrency` from `lib/bids/bidFormatting.ts` | already tested there |
| `documentsBidStatusLabel`, `bidProposalCustomerLines`, `documentsBidProposalsRowMatchesSearch` | 122–166 | `bidProposalsLedger.ts` | count-line matches; compact-$ match |
| Active-version count-row pick | 1244–1255 (inside `load`) | `pickActiveVersionCountRows` in `bidProposalsLedger.ts` | saved choice → first version → unsplit `null` |
| Lost-bid hiding | `tableRows` 1282–1285 | `bidProposalsLedger.ts` | hidden only when query empty |
| `jobLedgerCustomerLines`, `documentsJobLedgerStatusLabel`, `formatJobRevenueUsd`, `documentsJobInvoiceMatchesSearch`, `documentsJobsRowMatchesSearch` | 508–534, 597–636 | `jobsLedger.ts` (`formatJobRevenueUsd` → shared `ledgerFormat.ts`, since Supply calls it too — see the Supply row) | NaN → `—`; unknown status → spaced raw; invoice/test-report hits |
| Group-by-`job_id` loops ×4 | 713–726, 746–751, 769–774, 792–797 | `groupRowsByJobId(rows, sort?)` in `jobsLedger.ts` | invoice re-sort by `sequence_order`, `created_at` |
| Job title / number | 917–920 | `jobsLedger.ts` | `J<num> · name`, no-number fallback |
| Signed-contract coverage literal | 851–855 | `signedContractCoverage(row)` (near `lib/jobs/jobContractLifecycle.ts`) | paper vs contract source |
| Lien print form fallback + typed signature | 1105–1117 | `lib/jobs/lienReleaseLifecycle.ts` (`lienReleasePrintFormType`, `lienReleaseTypedSignature`) | signed-only; unknown form → `conditional_progress` |
| Supply helpers + allocation line (+ types 536–552) | 554–595, 1653–1667 / 1714–1717 | `supplyInvoicesLedger.ts`; `formatJobRevenueUsd` (called at 580) must move first to a shared `lib/documents/ledgerFormat.ts` that Jobs also imports — a lib cannot import it from the page | object-vs-array embed; pct sort; `paid`/`unpaid`/`open` whole-word keywords via `supplyInvoicePaidWordMatches` (quirk 3) |
| `filterLedgerRows` pattern | 269–275, 658–666, 1271–1280, 1526–1532 | `ledgerSearch.ts` | embedded-empty ⇒ `[]` |
| Search min length | 1794–1795 | `unifiedSearchFilterQuery(query)` | 1 char ⇒ `''` |
| `companyTabVisible` | 1845–1850 | `canSeeCompanyDocuments(role)` | the five roles of the RLS policy |

Already extracted kernels this page calls: tested — `jobsLedgerStatusPipeline`, `jobs/lienReleaseTracking`, `jobs/lienReleaseLifecycle`, `jobs/jobContractLifecycle` (partly, via `jobContractDocument.test.ts`), `jobsDocuments/lienWaiverRelease`, `jobsDocuments/testReportDocumentRow`, `ledgerDisplayPrefixes`, `jobSearchEvidence`, `scheduleDispatchHub`, `bids/updateGuard`, `utils/errorHandling`, `estimateCustomerAttachment` (inside the link modal). Extracted but **untested**: `documentsPageTab.ts`, `openInExternalBrowser.ts`, `jobsDocuments/printWindow.ts`, `fetchJobWithDetailsById.ts`, `pageTabStyle.ts`; `getBidServiceTypeTag` has a test file that does not exercise it.

### Cross-surface duplicates (fix outside the Documents moves)

| Pattern | Copies | Note |
|---|---|---|
| Lien-waiver typed signature + form-type fallback | `Documents.tsx` 1105–1117; `DashboardLienReleaseQueueModal.tsx` `signatureForRow` 50 + fallback 112–114; `LienReleaseModal.tsx` `renderSignature` 591–599 | one kernel in `lib/jobs/lienReleaseLifecycle.ts` (tested file) |
| `formatMoney(cents)` | `Documents.tsx` 52, `Estimates.tsx` 862, `BidRoom.tsx` 73, `EstimateCustomerDocument.tsx` 21, `EstimateOptionsPicker.tsx` 23 | one shared cents formatter |
| `$Nk` compact bid value | `Documents.tsx` `formatBidValueCompact` 96; `lib/bids/bidFormatting.ts` `formatCompactCurrency` 14 (tested); `BidSubmissionFollowupExpandableDetails.tsx` 11 | import the lib one |
| Pure helpers exported from component files | `billingTypeLabel` (`HostedStripeBillPanel.tsx` 143, only importer is Documents); `buildJobContractRecordHtml` (`JobContractRecordModal.tsx` 75, also used by `JobSignedAgreementModal`) | move to `lib/jobs/*` + tests |
| Company documents list + role gate | `SettingsCompanyDocumentsSection` in `Settings.tsx` 1185 (its Company group gated at 1178: dev / master_technician / `isAssistantLike` (assistant, controller) / estimator) and here; both role lists mirror `company_documents` RLS | shared `canSeeCompanyDocuments` |

---

## Preserve-quirks list (behavior contract for the moves)

1. **200-row cap everywhere**, and search is client-side over those rows — older records cannot be found from this page.
2. **Lost bids hidden unless searching** (`tableRows` 1282–1285, message 1347–1350).
3. **Supply search paid-state words are whole words** — `supplyInvoicePaidWordMatches` (`lib/supplyInvoicePaidSearch.ts`, tested): *paid* → paid, *unpaid* / *open* → unpaid. Fixed v2.3829: the old substring test (`t.includes('paid') && r.is_paid`, 582) made *unpaid* match every invoice. Keep the kernel call when the matcher moves to `supplyInvoicesLedger.ts`.
4. **Bid search vs display money**: search matches `$153k`; the cell shows `$153,000`.
5. **Guarded vs unguarded link writes**: estimates (`.eq('status','draft').select`) and bids (`bidUpdateRefused`) detect a no-op; jobs and supply invoices toast "Link saved" even when RLS refuses. Keep as-is in the move.
6. **Jobs loader partial resets**: the empty-`jobIds` early return (693–696) clears only invoices; the outer catch (802–806) clears rows/invoices/lien releases but not contracts/test reports. Harmless today (no rows ⇒ no child rows), but a "tidy" refactor changes it.
7. **Fail-soft sub-loads**: invoices toast on error; lien releases, contracts, test reports go silently empty (RLS scoping is the expected cause).
8. **Drafts stay off the page**: lien releases and contracts `status != 'draft'`; test reports include drafts (they open the modal).
9. **Named FK embed** `customers!jobs_ledger_customer_id_fkey` — an unnamed `customers(...)` embed is ambiguous and errors.
10. **Tab bodies unmount on switch** — every tab visit re-fetches and loses its local `search`.
11. **`?tab=company` for a role outside the list renders an empty body** (no button, no content).
12. **Test-report PDF links live 300 s** and open in the external browser; draft opens need `TestReportModalProvider` and silently no-op without it.
13. **Unsigned contract preview passes `signatureUrl = null`**; signed opens `JobSignedAgreementModal`.
14. **Estimates status filter** is the four ledger statuses only (286).
15. **`formatSupplyInvoiceDateYmd` noon-anchors** (`T12:00:00`) to dodge TZ shift.

---

## Recommended extraction order (value ÷ risk)

| # | Step | Expected size |
|---|---|---|
| 1 | `src/lib/documentsPageTab.test.ts` (legacy `ledger`, unknown → estimates) | +40 test |
| 2 | `Documents.render.test.tsx` smoke — `?tab=` switching, Company hidden for primary, each ledger mounts (`renderWithProviders`) | +80 test |
| 3 | Stage A supply: `lib/documents/supplyInvoicesLedger.ts` + test (calls the quirk-3 kernel); carries `formatJobRevenueUsd` out to a shared `lib/documents/ledgerFormat.ts` in the same PR (Jobs uses it too) | −60 page / +80 lib / +120 test |
| 4 | Stage A estimates: `lib/documents/estimatesLedger.ts` + test | −70 / +70 / +100 |
| 5 | Stage A bids: `lib/documents/bidProposalsLedger.ts` (+ version pick, lost filter), import `formatCompactCurrency` | −90 / +85 / +120 |
| 6 | Stage A jobs: `lib/documents/jobsLedger.ts` (+ group-by, title, coverage) and the lien print args in `lib/jobs/lienReleaseLifecycle.ts` | −110 / +120 / +150 |
| 7 | Stage A shared: `ledgerSearch.ts` (`filterLedgerRows`, `unifiedSearchFilterQuery`) + `canSeeCompanyDocuments` | −25 / +35 / +50 |
| 8 | Styles → `components/documents/documentsLedgerStyles.ts` (+ embed props type) | −75 / +80 |
| 9 | Move `DocumentsSupplyHouseInvoicesLedger` → `components/documents/` | −255 |
| 10 | Move `DocumentsEstimatesLedger` | −225 |
| 11 | Move `DocumentsBidProposalsLedger` | −305 |
| 12 | Move `DocumentsJobsLedger` (optionally split `DocumentsJobChildRows` ≈ 160) | −495 |
| 13 | Move `DocumentsUnifiedSearchTab` | −50 |

End state: `Documents.tsx` ≈ 100 lines (router + gate + imports). Verification gates and definition of done: [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md).

### What must stay in the parent

The `?tab=` parse/write (including deleting `ledger`), `companyTabVisible`, the tab button row, and the conditional tab bodies.

---

## Hazards

| Hazard | Where | Why it bites a move |
|---|---|---|
| **Money units** — cents vs dollars | `formatMoney` 52–54 (cents) vs `formatJobRevenueUsd` 531–534 and the bid cell 1498 (dollars) | Swapping formatters during a consolidation is a silent 100× error; none are tested. Both use `Intl.NumberFormat(undefined…)`, so search-by-amount results depend on browser locale — pin a locale in tests. |
| **Signed legal documents** | contracts 1048–1077, lien releases 1104–1173 | Form-type fallback, signature-only-when-signed and `jobNum || '—'` feed printed waivers; the same logic is copied on two other surfaces. |
| **Storage signed URLs** | `openTestReportDocument` 816–834, bucket `job-test-reports` | Office read works only through the v2.3331 `storage.objects` SELECT policy; five-minute links. |
| **RLS / role gates** | primary `.match` 684; `companyTabVisible` 1845–1850; lien releases / contracts / test reports office-only; bid refusal guard 1317 | The client role list duplicates the `company_documents` policy; `role` is a `load` dep in the Jobs ledger — dropping it breaks primary scoping on role change. |
| **Unguarded writes** | jobs 865–877, supply 1585–1597 | Refused updates report success (quirk 5). |
| **Effect deps** | the four `useEffect(() => void load(), [load])`; `load` deps `[user?.id, showToast]` (+ `role`) | An unstable callback in a new hook = reload loop; keep `useCallback` deps verbatim. |
| **Load fan-out** | Search tab mounts four ledgers = 10 queries; tab switch remounts | A keep-alive container or a shared cache would change fetch cadence — a behavior change, not a move. |
| **Context dependencies** | `useTestReportModalOptional` 650, `useLedgerPrefixMap` 1515 | Providers live in `App.tsx`, but both hooks have safe defaults without them (`useTestReportModalOptional` → `null`, so draft opens no-op; `useLedgerPrefixMap` → `{}`), so a render smoke mounts under `renderWithProviders` alone; supply them only to exercise a draft-report open or prefixed job titles. |
| **URL deep links** | `?tab=` + legacy `?tab=ledger&ledger=bid-proposals` | No in-app sender today, but bookmarks and help text ("Documents → Company") rely on the values. |
| **Realtime** | none | No subscriptions; refresh is `load()` after each save. |
