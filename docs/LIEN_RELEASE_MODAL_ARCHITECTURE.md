# Lien Release Modal Architecture Map

---
file: docs/LIEN_RELEASE_MODAL_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the decomposition of src/components/jobs/LienReleaseModal.tsx (1,607 lines) per PAGE_DECOMPOSITION_PLAYBOOK.md — the Release of Lien window (the four waiver-and-release forms, six numbered steps beside the page, the autosaving draft, the mint gate, the leader's signature, the send to the payor). Inventories every region (state, memos, effects, handlers, writes, children, kernels, test coverage) so extraction can proceed without re-reading the file.
covers:
  - src/components/jobs/LienReleaseModal.tsx
mapped_at: 7379b248f
audience: Developers, AI Agents
last_updated: 2026-10-05
---

> **Line numbers are as of `7379b248f`** (the `mapped_at` commit) and drift with every edit — search the symbol named beside each range. Regenerate the fact sheet with `npm run map -- src/components/jobs/LienReleaseModal.tsx`. 18 commits in 90 days.

## What this surface is

[`LienReleaseModal.tsx`](../src/components/jobs/LienReleaseModal.tsx) is the **Release of Lien** window: one dialog (z 1100, 1,200 px wide) that makes one of the four waiver-and-release forms for a job. The left side is six numbered steps on a rail — 1 Pick the bills · 2 Check the form · 3 Check the amount · 4 Check the details · 5 Get it signed · 6 Send it — and the right side is the page, pinned light, redrawn as the steps change. The document is one `job_lien_releases` row: an autosaving `draft` until an output action **mints** it (`issued` or `awaiting_signature`), then `signed`, then stamped `sent_to_customer_at`. The document's words live in [`lienWaiverRelease.ts`](../src/lib/jobsDocuments/lienWaiverRelease.ts); the row's lifecycle in [`lienReleaseLifecycle.ts`](../src/lib/jobs/lienReleaseLifecycle.ts). Help guides: [`give-a-customer-a-lien-release`](../src/content/help/give-a-customer-a-lien-release.md), [`send-a-gc-our-lien-waiver`](../src/content/help/send-a-gc-our-lien-waiver.md). Glossary: *Lien waiver to the GC (Release of Lien window)*.

### Mounts and the parent contract

Props (165–185): `open`, `onClose`, `job: JobWithDetails | null`, `invoice` (the bill to preselect), `signerNameFallback`, `onIssued?`, `initialFormType?`.

| Mounted by | Line | Stays mounted | `invoice` | `initialFormType` | `onIssued` |
|---|---|---|---|---|---|
| [`JobsStagesTab`](../src/components/jobs/JobsStagesTab.tsx) (Pipeline row; opener `setLienReleaseModal` 914) | 4605 | **yes** — `open={lienReleaseModal != null}` | the row's | — | `loadLienReleaseJobIds` |
| `DashboardLienReleaseQueueModal` (Needs You → *Issue release*) | 366 | no (`open` literal under `issue ?`) | first invoice the cleared release names | `unconditional_progress` | `onChanged` |
| `BillCustomerLienReleaseStrip` | 239 | while `canIssue && jobDetails` | first of `releaseModal.invoiceIds` | `releaseModal.formType` | `loadRows` |
| `BillCustomerWaiverFollowUp` | 29 | no (`open` literal) | passed through | — | — |
| `BillPaperworkCard` | 197 | while `showWaiver`; `open={windowOpen}` | the bill's | — | `load` |
| `JobFormInvoiceList` (Edit Job's bill rows) | 1066 | while `editing` | `waiverFor` | — | — |

`signerNameFallback` is `lienDeskSignerFor(job.master_user_id)` from the Pipeline and the session's `profileName` from the other five. The Pipeline's mount is a row of §6 *The modal tail* in [`JOBS_STAGES_TAB_ARCHITECTURE.md`](./JOBS_STAGES_TAB_ARCHITECTURE.md); the Lien desk and its other neighbours are in [`LIEN_DESK_ARCHITECTURE.md`](./LIEN_DESK_ARCHITECTURE.md).

**Hook census (fact sheet @ 7379b248f):** 29 `useState` · 0 `useReducer` · 13 `useEffect` · 12 `useMemo` · 15 `useCallback` · 3 `useRef` (`userTouchedRef` 207, `signerTouchedRef` 209, `hydratedDraftRef` 211) · 4 custom hooks (`useAuth` 186, `useToastContext` 187, `useConfirmDialog` 188, `useNavigate` 930) · 26 local imports. One default-exported component `LienReleaseModal` (165–1607, 1,443 lines; render 1063–1606) plus module scope 76–163: types `JobsLedgerInvoice` 76 and `MasterOption` 99, styles `seg` 101–110 and `segWrap` 111, `FIELD_LABELS` 113–122, `FIELD_ORDER` 124–133, `lienChipStyle` 136–155, `selectableInvoices` 158–163. **Every read and write is a direct `supabase` call in this file** (tables `job_lien_releases`, `users`, `customers`, `job_property_owners`, `customer_addresses`, `jobs_ledger`; the storage bucket `LIEN_RELEASE_DOCUMENTS_BUCKET`); no RPC, no edge function called directly (the send goes through `sendLienReleaseEmailToCustomer`).

| Largest blocks | Symbol | Lines |
|---|---|---|
| Step 5 body (signer, the two ways to sign, paper) | `LienReleaseStepRow step={stepAt(5)}` | 1330–1454 (125) |
| The mint gate | `ensureMinted` | 624–701 (78) |
| Step 4 body (details + property record) | `stepAt(4)` | 1253–1328 (76) |
| Step 1 body (bill chips + covered note) | `stepAt(1)` | 1132–1187 (56) |
| Step 6 body (send, download, print) | `stepAt(6)` | 1456–1510 (55) |
| Step 2 body (the two toggles) | `stepAt(2)` | 1189–1237 (49) |
| He signs now | `signNow` | 761–805 (45) |
| Autosave | effect | 580–616 (37) |
| The page | `.lienRelease-preview` | 1514–1548 (35) |

---

## Master summary table

| Region | Anchor (symbol · lines) | ~Lines | Coupling | Risk | Status | Tests |
|---|---|---|---|---|---|---|
| A. Shell, header, footer | early return 991 · overlay 1064–1092 · header 1093–1110 · footer 1551–1582 · module styles 101–155 | ~110 | med — the footer reads E (`autosaveState`), H (`voidPendingId`) and I (`cur`) | low | inline | `steps` (footer's *where* line, the two-click void 239); `dateHold` (the held line) |
| B. Open-time reads | `loadHistory` 218–233 · masters + GC email effect 244–280 · `issuer` 282 + effect 285–296 · `jobOwnerRow` 300–323 · property record 327–393 · `resolvedProperty` 395 · `ownerName` 396 | ~175 | low — feeds C's prefill (`issuer`, `ownerName`, `presentSigner`) and F | low | inline; resolvers out (`lienProperty`) | `gcWaiver` reads `billing_email`; **the property record line and its Link are named by no test**; `lienProperty` 12 |
| C. Document state (substrate) | `formType` 189 · `selectedInvoiceIds` 196 · `fields` 197 · `releaseRow` 202 · refs 207–211 · open-reset 401–419 · resume 427–450 · prefill 472–500 · `setField` 504 · `refillFromSelection` 516 · `toggleInvoice` 523 · `editable` 532 · `rowStatus` 533 · `buildRowPayload` 559–572 | ~150 | **highest** — every region reads it | must stay / hook seam | inline; prefill and field rules out (`lienWaiverRelease`) | `amountMath` 143, 162 (refill on a resumed draft); `steps` 167 (resume of an awaiting row); `lienWaiverRelease` 34 |
| D. Amount math | `amountHot` 535 · `amountMath` 551 · `amountCoverage` 552–555 · `paidUnwaived` 556 · `discardDraft` 1023–1029 · `waivePaid` 1030–1035 | ~25 | med — reads C + B's `historyRows`; writes C (`formType`, `fields.amount`) and I's `overrides` | med (money on a waiver) | inline glue; math + boxes out (`lienWaiverAmountMath`, `LienWaiverAmountMath.tsx`) | `amountMath` 5; `steps` 128, 144; kernel 12 |
| E. Autosave + mint | `autosaveState` 203 · `mintBusy` 204 · `datesUnfinished` 579 · autosave effect 580–616 · `ensureMinted` 624–701 | ~125 | high — reads C; every output in F and G calls `ensureMinted` | **high** (the record of a signed legal paper) | inline | `dateHold` 6 (held, saved, cleared, the five buttons that must not mint); **the stored-PDF copy 680–691 has no test** |
| F. Signature | `masters` 191 · `presentSignerId` 192 · `presentOpen` 193 · `signOpen` 205 · `presentSigner` 457 · `iAmTheSigner` 458 · `signerOfRecord` 464–468 · `requestSignature` 703–734 · `cancelSignatureRequest` 736–755 · `signNow` 761–805 · `deviceNameFor` 837–841 · `renderSignature` 844 · `inkUrl` 537 + effect 538–550 · sign modal 1584–1604 | ~200 | high — reads C + E; writes C's `releaseRow` | **high** (who signed, on whose screen) | inline; pad out (`LienReleaseSignModal`), writes for signing in `lienReleaseSignIo` | `gcWaiver` 145; `ink` 2; `steps` 167, 221; `lienReleaseLifecycle` 6, `lienReleaseInk` 5 |
| G. Outputs | `gcEmail` 194 · `sendBusy` 195 · `pdfBusy` 199 · `gcName` / `sendToName` / `sendRecipient` 807–809 · `sendToPayor` 811–834 · `printRelease` 848–858 · `downloadPdf` 904–927 | ~75 | med — each mints through E, renders through F's signature readers | med | inline; builders out | `ink` 137 (the stored file on download); `dateHold` each; **no test clicks Send** (`sendLienReleaseEmail` 7 tests the sender) |
| H. History on this job | `historyRows` 215 · `voidPendingId` 216 · `viewHistoryRelease` 860–880 · `voidHistoryRelease` 882–902 · `historyOpen` 933 · `others` 1016 · `shownOthers` 1017 · `historyRow` 1036–1061 · render 1114–1130 · footer discard 1567–1577 | ~100 | low — `voidHistoryRelease` is also D's `discardDraft` and the footer's void | low | inline | `steps` (the *Already on this job* box; 239 the footer void); **View and *Show all* named by no test** |
| I. The six steps and click to look | `overrides` 931 · `editDetails` 932 · `looking` 935 · `lookAt` 936 · resets 937–947 · `stepToShow` 950 + effect 951–956 · `showStep` 957 · `toggleLook` 958–970 · `detailKeys` 971 · `detailsMissing` 974 · `coveredBlocks` 975 · `steps` 976–989 · render locals 996–1022 · step bodies 1132–1510 | ~470 | high — each body reads C–H | med | rail + row out (`lienReleaseSteps`, `LienReleaseStepRow`); the six bodies inline | `steps` 10; kernel 13; `LienReleaseStepRow` render 5 |
| J. The page | `paragraphs` 993 · `signedFoot` 994 · `foot` 995 · `lookPart` 1009 · render 1514–1548 | ~40 | low — reads C, D's `amountHot`, F's `inkUrl`, I's `cur` and `lookPart` | low | inline shell; `MarkedWaiverAmount`, `LienWaiverFootPreview` out | `amountMath`, `ink`, `steps` 128 (the grey), 179 (the mark) |

Render smokes, all under `src/components/jobs/`: `LienReleaseModal.steps.render.test.tsx` (10 `it`), `.dateHold.` (5 `it` + one `it.each` over five buttons), `.amountMath.` (5), `.gcWaiver.` (3), `.ink.` (2), `.signerReset.` (2, v2.4567) — 28 blocks. Each mocks `useAuth` and `supabase`; four mock `signature_pad`; `ink` also mocks `lienReleaseSignIo` and `lienReleaseInk`. No e2e spec names the window.

---

## Per-region dossiers

### A. Shell, header, footer

- **Early return 991:** `if (!open || !job || !fields) return null`, below every hook. `fields` is null until the prefill effect (C) or the resume effect (C) sets it, so the first paint waits one effect pass.
- **Render:** overlay 1064–1079 (`role="dialog"`, z 1100, **a click on the backdrop is `onClose`**); card 1080–1092 (`maxWidth: 1200`, `maxHeight: min(94vh, 100%)`); header 1093–1110 (title, *job name · job number · who pays*, ✕); body `.lienRelease-body` 1112 holding `.lienRelease-steps` 1113 and `.lienRelease-preview` 1514 (the three classes are in `src/index.css`; under its breakpoint the page stops being sticky); footer 1551–1582.
- **Footer:** the autosave line 1553–1565 (blank once the row is not editable; `held` prints `draftHeldByDateMessage`), the drop link 1567–1577 (*Discard this draft* / *Void this waiver*, then *Confirm …*, sharing H's `voidPendingId`), and the *where* line 1579–1581 (`data-testid="lien-release-where"`).
- **Module styles:** `seg` / `segWrap` (step 2's toggles), `lienChipStyle` (history chips, switched on the `LienReleaseChip` tone). Render-scope styles `choice` 1020, `quietBtn` 1021, `linkBtn` 1022 are rebuilt every render and shared by H, I and the footer.
- **Extraction:** the shell stays. The three render-scope styles move to module scope first (they block every body's move).

### B. Open-time reads

- **History:** `loadHistory` 218–233 (`job_lien_releases` by `job_id`, newest first, fail-soft to `[]`) + effect 235–242 (clears `historyRows` and `voidPendingId` on close). Re-run after a mint, a signature request or its cancel, a signature, a send and a void.
- **Leaders and the GC's email (effect 244–280):** `users` where `role = master_technician`, unarchived; the name is `notes` (the People *Full name and title* line) else `name`, cut at the first comma; the job's master sorts first. The default signer (264) is the company signer from `getPhysicalInvoiceIssuerDraft()` matched by name, else the job's master, else the first row — and only when none is set (`cur ?? …`). A reset effect just above it, keyed on `[open, job?.id]` (v2.4567), clears the pick first, so each opening and each job starts from its own default. `customers.billing_email` for `job.gc_customer_id` → `gcEmail`.
- **Issuer:** `issuerGen` 198, effect 285–296 (`fetchPhysicalInvoiceIssuerFromAppSettings({ authRole })` then bump), memo `issuer` 282 (`getPhysicalInvoiceIssuerDraft()`).
- **Owner:** `jobOwnerRow` 300 + effect 301–323 (`job_property_owners`, `maybeSingle`).
- **Property record:** `linkedAddress` 327, `candidateAddresses` 328, `linkChoiceId` 329, `linkBusy` 330; `loadPropertyRecord` 332–364 (the linked `customer_addresses` row, else the customer's and GC's rows with `suggestCustomerAddressForJob` as the default pick); effect 366–374; `linkPropertyRecord` 376–393 — **the one write outside `job_lien_releases`:** `jobs_ledger.customer_address_id`. Drawn inside step 4 (1300–1327).
- **Derived:** `resolvedProperty` 395 (`resolveLienProperty`), `ownerName` 396 (`lienPropertyOwnerDisplayName`), `invoices` 398 (`lienReleaseSelectableInvoices` in `src/lib/jobs/lienReleaseOpening.ts`: `billed`, `ready_to_bill` or `paid`, by `sequence_order`; `paid` since #87 I, so the unconditional can name a paid bill).
- **Extraction:** one hook, `useLienReleaseOpenReads(open, job, authRole)` → `{ historyRows, reloadHistory, masters, gcEmail, issuer, ownerName, property }`. It owns no document state. `presentSignerId` and its reset effect stay out of it (see Hazards).

### C. Document state — the shared substrate (stays)

- **The four states:** `formType` 189, `selectedInvoiceIds` 196, `fields` 197 (`LienWaiverFields`), `releaseRow` 202 (the row this session works on).
- **Three refs decide who owns `fields`:** `userTouchedRef` 207 (nothing autosaves before a real edit), `signerTouchedRef` 209 (typed signer lines survive a prefill rebuild), `hydratedDraftRef` 211 (a resumed row's saved fields are the document; the prefill effect returns at 477).
- **Open-reset effect 401–419** (deps `[open, job?.id, invoice?.id, initialFormType]`): row null, the three refs false; the selection and the form come from `lienReleaseOpening` (`src/lib/jobs/lienReleaseOpening.ts`, #87 I). The selection is the row's bill (then `pickLienWaiverForBill` chooses the form unless the opener named one), else the billed bills, else the ready-to-bill ones; a paid bill is selected only as the row's bill.
- **Resume effect 427–450** (deps `[open, historyRows]`, exhaustive-deps disabled): when no row is held, takes the newest live `draft`, else the newest live `awaiting_signature`; signed, sent and issued rows never resume. Copies the snapshot into `fields` (437–447).
- **Prefill effect 472–500:** `buildLienWaiverPrefill(formType, { job, invoices: selectedInvoices, issuer, ownerName, signerName, signerTitle })`. The signer name is the leader picked, else the company signer, else `signerNameFallback`; the title rides along only when the name is the company signer's.
- **Edits:** `setField` 504–508; `toggleInvoice` 523–530; `refillFromSelection` 516–521 (a resumed draft only: the amount and the through date follow the bills and the form; every other typed field stays).
- **Derived:** `selectedInvoices` 452, `jobNumber` 502, `editable` 532 (`lienReleaseIsEditable`), `rowStatus` 533, `buildRowPayload` 559–572 (the one payload for draft and mint: `amount` parsed and rounded to cents, `through_date` only when the form uses it, `fields` as the snapshot).
- **Extraction:** becomes `useLienReleaseDraft` together with E (step 7). Until then nothing here moves.

### D. Amount math

- **Memos:** `amountMath` 551 (`lienWaiverAmountMath`), `amountCoverage` 552–555 (`lienWaiverAlreadyCovered`, only while editable, excluding this row), `paidUnwaived` 556 (`lienWaiverPaidUnwaived`).
- **Handlers:** `waivePaid` 1030–1035 (form to `unconditional_progress`, amount from `lienWaiverPrefillAmount`), `discardDraft` 1023–1029 (H's void, then `onClose`).
- **Render:** `WaiverCoveredNote` in step 1 (1176–1186), `WaiverPaidNote` in step 2 (1236), `MoneyTypingInput` + `WaiverMathBox` in step 3 (1243–1250; its `onGoOn` adds `'early'` to I's `overrides`), `MarkedWaiverAmount` on the page (1542; `amountHot` is the box's hover).
- **Extraction:** nothing to Stage A (the math is out). The two notes move with their steps.

### E. Autosave and the mint gate

- **Autosave effect 580–616:** runs only when open, editable and `userTouchedRef` is set; 800 ms debounce; `datesUnfinished` 579 (`lienWaiverDatesUnfinished`) sets `held` and writes nothing; else `update(payload).eq('id').eq('status', 'draft')` on a held draft, or `insert({ ...payload, status: 'draft', created_by })` and keep the returned row.
- **`ensureMinted(target)` 624–701:** returns the row untouched when already minted; `lienWaiverUnfinishedDateBlocksIssue` toasts and stops; then `update({ ...payload, status: target, minted_at, … }).eq('status', 'draft')` or a fresh insert. For `awaiting_signature` it stamps `signature_requested_at/by` and `signer_user_id`. After the row lands: `loadHistory`, `onIssued`, and a fire-and-forget audit copy (680–691: `buildLienWaiverPdfBlob` → storage upload at `lienReleaseMintedPdfPath(row.id)` → `minted_pdf_path`).
- **Callers of the mint:** `requestSignature`, `signNow` (F), `printRelease`, `downloadPdf` (G), and step 5's *Mark issued* (1447).
- **Extraction:** Stage A the writes into a `lienReleaseIo.ts` (see the inventory), then the hook seam.

### F. Signature

- **Who signs:** `presentSigner` 457; `iAmTheSigner` 458; `signerOfRecord` 464–468 — the row's `signer_user_id` else the leader picked, and **null when that is the signed-in user** (the pad then lets them type; for anyone else it locks to drawing).
- **Handlers:** `requestSignature` 703–734 (an `issued` row flips to `awaiting_signature`; otherwise mints as `awaiting_signature`), `cancelSignatureRequest` 736–755 (`lienReleaseCancelTarget`, #87 C: a waiver minted by its own request goes back to `draft` with its mint and request stamps cleared, editable again; one printed or marked issued first goes back to `issued`), `signNow` 761–805 (mint if needed, flip an `issued` row, or re-name the signer on an awaiting one, then `presentOpen`).
- **Reading a signature:** `deviceNameFor` 837–841 (this session's name, *the office* for another's, null when the signer used their own screen), `renderSignature` 844 (`lienReleaseRowSignature`), `inkUrl` 537 + effect 538–550 (`loadLienReleaseInk` once signed).
- **Render:** step 5 (1330–1454): `LienWaiverSignedLook` once signed; else the *Signs* line (a select when more than one leader; the *No title on the page* chip navigates to `/settings?tab=settings-jobs&focus=issuer.signerName` after `onClose`), the amber waiting box with *Sign now* (only for the named signer) and *Cancel request*, the two choices (`data-testid="lien-waiver-sign-now"`, *Send it to his desk*), the record sentence, and the paper path (*Print it* then *Mark issued*). `LienReleaseSignModal` 1584–1604 opens on `signOpen || presentOpen`; `onSigned` reloads history, calls `onIssued` and re-reads the row by id.
- **Extraction:** Stage B `LienReleaseSignStep` (the step-5 body), props from the seam. The three handlers go to the hook with E.

### G. Outputs

- **Send:** `sendToName` 808 (the GC, else the customer, else *the customer*), `sendRecipient` 809 (the GC's billing email on a GC job, else the job's customer email); `sendToPayor` 811–834 (`sendLienReleaseEmailToCustomer(releaseRow, job, { recipient, billLabel })`, then re-read the row, `loadHistory`, `onIssued`). `billLabel` is set only when exactly one bill is picked.
- **Print / PDF:** `printRelease` 848–858 and `downloadPdf` 904–927 both mint `issued` first; a signed row prints through `lienReleaseRowSignatureWithInk` and downloads `lienReleaseSignedPdfBlob` (the stored file), an unsigned one is built here.
- **Render:** step 6 (1456–1510) and the page's *Download PDF* link (1520).
- **Extraction:** Stage B `LienReleaseSendStep`; the handlers go with the seam.

### H. History on this job

- **Render:** the *Already on this job* box 1114–1130 (`data-testid="lien-release-already"`): `others` = `liveLienReleases(historyRows)` less this row; one row shown, *Show all N* opens the rest.
- **`historyRow` 1036–1061:** form label, amount, created day, `lienReleaseChips`, **View** (`viewHistoryRelease`: rebuilds the page from the snapshot in a new window with the stored ink) and the two-click **Void**.
- **`voidHistoryRelease` 882–902:** `update({ voided_at, voided_by }).eq('id')`. The same function discards the working draft (D) and voids the working row from the footer.
- **Extraction:** Stage B `LienReleaseHistoryBox({ rows, voidPendingId, onView, onVoid })` — the cleanest move (own `historyOpen`; `voidPendingId` stays with the footer).

### I. The six steps and click to look

- **The rail:** `steps` memo 976–989 = `lienReleaseSteps({ billCount, billsPicked, covered, amount, tooEarly, detailsMissing, rowStatus, sent })`; `cur` 996; `stepAt` 997; `leadsInto` 1010; `STEP_TITLES` 1012.
- **What holds a step:** `coveredBlocks` 975 (a waiver already covers a picked bill, until *Make it anyway* adds `'covered'` to `overrides`), `amountMath.tooEarly` (until *go on* adds `'early'`), `detailsMissing` 974 (a blank printed detail other than the title).
- **Step 4's two faces:** `showDetailInputs` 1018 (`editable && (editDetails || detailsMissing > 0)`): inputs over `detailKeys` 971, else the `dl` (`data-testid="lien-waiver-details"`) with *Change a detail*.
- **Click to look:** `looking` 935, `lookAt` 936 (reset on open, job and `rowStatus`, 944–947), `toggleLook` 958–970, `lookProps` 1000–1008, `lookNote` 999, `lookPart` 1009 (which part of the page to mark). `stepToShow` 950 + effect 951–956 scrolls the step into view and moves focus.
- **Step 2's toggles** are an IIFE (1191–1234): `lienWaiverToggles` → `pick` → `lienWaiverFormFrom`; `pickUnconditional` 1200–1205 asks `confirmDialog(UNCONDITIONAL_WAIVER_WARNING)` first. Since v2.4582 every route into an unconditional form asks: `waivePaid` asks while the form is conditional (*Stay conditional* leaves the form and the amount alone); a window opened on a preset unconditional form asks once after `historyReady` (*Stay conditional* closes a preset window, or steps a form the bill picked back through `conditionalFormOf`); a resumed draft or a pending signature request is not asked.
- **Extraction:** the six bodies become six components in the order of the extraction list; `useReleaseStepLook` (`looking`, `lookAt`, `stepToShow`, `toggleLook`, `lookProps`) last.

### J. The page

- **Render 1514–1548:** `data-theme="light"`, `data-look-part={lookPart}`; the head line (*signed* / *it changes as you work*) with *Download PDF* while unsigned; the paper (greyed to 0.55 while step 1 is a `warn`); `lienWaiverTitle`, `paragraphs` through `MarkedWaiverAmount`, `LienWaiverFootPreview` (`inkUrl` once signed; the *He signs here* highlight while step 5 is current).
- **Extraction:** Stage B `LienReleasePage({ formType, fields, foot, inkUrl, lookPart, amountHot, cur, … })` — presentational.

---

## Shared substrate

1. **The document (C):** `formType`, `selectedInvoiceIds`, `fields`, `releaseRow` and the three refs. Read by every region.
2. **The row's status:** `editable` and `rowStatus` gate every input, the autosave, the folds of the rail and both footers of step 5 and 6.
3. **`ensureMinted`:** five callers; it is the only path from a draft to paper.
4. **`loadHistory` + `onIssued`:** the pair every write ends with (mint, request, sign, send, void). `cancelSignatureRequest` reloads history and does not call `onIssued`.

## What must STAY in `LienReleaseModal`

- The open-reset and resume effects (401–419, 427–450) until C and E are one hook: their order on open is what decides between a fresh form and a resumed row.
- The early return 991 and the `LienReleaseSignModal` mount (it reads `releaseRow`, `signerOfRecord` and both open flags).
- `voidPendingId` (shared by the history box and the footer).

---

## Stage-A inventory

**Kernels already out** (size · test cases counted by `it(`):

| Kernel | Lines | Tests | Used here for |
|---|---|---|---|
| [`jobsDocuments/lienWaiverRelease.ts`](../src/lib/jobsDocuments/lienWaiverRelease.ts) | 679 | 34 (+6 pdf) | the four forms: prefill, paragraphs, foot, print HTML, PDF, toggles, the date holds, `pickLienWaiverForBill` |
| [`jobs/lienReleaseTracking.ts`](../src/lib/jobs/lienReleaseTracking.ts) | 279 | 20 | `JobLienReleaseRow`, snapshot reader, form label, `liveLienReleases` |
| [`jobs/lienWaiverAmountMath.ts`](../src/lib/jobs/lienWaiverAmountMath.ts) | 251 | 12 | the math box, already covered, paid and not yet waived |
| [`jobs/lienProperty.ts`](../src/lib/jobs/lienProperty.ts) | 131 | 12 | owner and property resolution, the address suggestion, lien-ready gaps |
| [`jobs/lienReleaseLifecycle.ts`](../src/lib/jobs/lienReleaseLifecycle.ts) | 124 | 6 | status, editable, minted, chips, the signature audit line |
| [`jobs/lienReleaseSteps.ts`](../src/lib/jobs/lienReleaseSteps.ts) | 109 | 13 | the rail, the look note, the page part |
| [`jobs/lienReleaseInk.ts`](../src/lib/jobs/lienReleaseInk.ts) | 91 | 5 | stored ink, the signed PDF |
| [`sendLienReleaseEmail.ts`](../src/lib/sendLienReleaseEmail.ts) | 146 | 7 | the send |
| `jobsDocuments/printWindow.ts`, `autosaveDateHold.ts`, `jobs/lienReleaseDocuments.ts` | 73, 31, 18 | 3, 8, none | print windows, the held-draft sentence, the bucket and the minted path |

**Still inline (move to `src/lib/jobs/*` + tests):**

| Candidate | Where | Target |
|---|---|---|
| Snapshot → fields, written twice | 437–447, 864–873 | adopt the existing `lienReleaseSnapshotToWaiverFields(row)` in `lienReleaseTracking.ts` (same eight fields, same fallbacks) |
| Typed amount → number, written twice | 561, 972 | `parseWaiverAmount(text)` in `lienWaiverRelease.ts`; `buildRowPayload` and `amountNum` call it |
| `buildRowPayload` | 559–572 | `lienReleaseRowPayload(job, formType, invoiceIds, fields)` — the draft and the mint cannot drift |
| Which row resumes | 429–431 | `resumableLienRelease(rows)` in `lienReleaseLifecycle.ts` (draft before awaiting, never signed / sent / issued) |
| The open selection | 410–418 | `defaultWaiverSelection(job, invoice)` → ids (+ whether the bill picks the form) |
| The signer fallback, written three times | 646, 716, 763 | one `signerIdFor(presentSignerId, job)` |
| Leader options | 256–259 | `leaderOptions(users, masterUserId)` (the comma cut and the sort) |
| Who gets the send | 807–809, 815–816 | `waiverSendTarget(job, gcEmail)` + `waiverBillLabel(...)` |
| Bill chip words | 1137–1142, 1164 | `waiverBillChip(job, invoice, historyRows, rowId)` → `{ owed, sub, onFile }` (three 0.005 thresholds) |
| The writes | 594, 602, 656, 668, 687, 712, 743, 775, 793, 824, 889, 1600; `jobs_ledger` 381 | `lienReleaseIo.ts`, one function per write, on the pattern of `lienDeskIo.ts` — the `issued → awaiting_signature` update (708–723, 771–781) and the re-read by id (824, 1600) are each written twice |

---

## Recommended extraction order (value ÷ risk)

1. **Stage A: adopt `lienReleaseSnapshotToWaiverFields`, add `parseWaiverAmount` and `lienReleaseRowPayload`** — ~35 lines; no behavior change.
2. **Stage A: `resumableLienRelease`, `defaultWaiverSelection`, `leaderOptions`, `waiverSendTarget`, `waiverBillChip`** — ~45 lines; puts the resume rule and the chip thresholds under tests.
3. **`lienReleaseIo.ts`** — every status-guarded write as a named function; the smokes spy on it instead of the `supabase` mock chain. ~120 lines out of the handlers.
4. **Styles to module scope** (`choice`, `quietBtn`, `linkBtn`) — unblocks every body move.
5. **`LienReleaseHistoryBox`** (H, 1036–1061 + 1114–1130) — ~45 lines + `historyOpen`.
6. **`LienReleasePage`** (J, 1514–1548) — ~35 lines.
7. **`useLienReleaseOpenReads`** (B) — ~175 lines.
8. **`useLienReleaseDraft` hook seam** (C + E + F's three handlers + G's three) — one object in, every step consumes it.
9. **Step bodies:** `LienReleaseSendStep` (6), `LienReleaseSignStep` (5), `LienReleaseDetailsStep` (4, with the property record), then 1–3.
10. **`useReleaseStepLook`** — last; it reads the rail the bodies now own.

Verification per step: `npm run typecheck && npm run lint && npm test`, behavior-preserving only, one PR per step (see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md)). Keep every `data-testid` through moves (see Hazards).

---

## Hazards

- **A signed legal paper:** a waiver gives up lien rights for an amount. `buildRowPayload` is the only source of what is saved and what is minted; an unconditional form asks first, on every route since v2.4582 (`UNCONDITIONAL_WAIVER_WARNING`, 1203).
- **No paper without the record:** print, download, *Mark issued*, *Send it to his desk* and *He signs now* all go through `ensureMinted`, which stops on a half-typed year (629–633). `dateHold`'s `it.each` holds the five.
- **Status-guarded writes:** each transition is `update(...).eq('id').eq('status', <expected>)` with `.select('*').single()`, so a row changed elsewhere fails and toasts. Two writes are not: the autosave update (594) reads nothing back, so zero rows matched still prints *All changes saved*; `voidHistoryRelease` (889) has no status filter.
- **An edit in the last 800 ms is dropped on close:** the autosave is a timer the effect's cleanup clears when `open` changes, and the backdrop click is `onClose`.
- **One extra write per new draft:** the insert sets `releaseRow`, which is in the autosave effect's deps, so an identical update follows 800 ms later.
- **`presentSignerId` is reset by its own effect, and the order matters:** the Pipeline keeps the window mounted, so an effect keyed on `[open, job?.id]` clears the pick (v2.4567; before, the leader picked for one job was still the pick on the next), and the masters effect then sets the default only when null (`cur ?? …`, 264). Keep the reset keyed on the job id alone: the masters effect also re-runs on `master_user_id` and `gc_customer_id`, and the open-reset effect on the invoice, and none of those may wipe a pick. `signerReset` (2 `it`) holds it. The reset effect sits after 242 and is not counted in this map's line numbers: every later line sits five further down the file than the number given here.
- **The signer of record:** `signerOfRecord` 464–468 decides whether the pad locks to drawing. A move that passes `presentSigner` in its place lets the person at the keyboard type the leader's name.
- **Who owns `fields`:** the three refs (C). The prefill effect rebuilds `fields` on any of eight deps; a resumed draft opts out of it, and `refillFromSelection` is the only thing that moves its amount.
- **Effects whose deps make moves risky:** resume 427–450 (disabled lint; reads `releaseRow`, keyed on `[open, historyRows]`, so every `loadHistory` re-asks whether to resume), the masters effect 244–280 (keyed on three job fields, not `job`), `issuer` memo 282 (keyed on `issuerGen`, a counter).
- **Test ids are production hooks:** the `stepToShow` effect finds `[data-testid="lien-step-N"]` and the classes `.lienStep-foldClose` / `.lienStep-foldBtn` (set in `LienReleaseStepRow`); `index.css` marks the page through `.lienRelease-preview[data-look-part=…]` and `[data-testid='lien-waiver-foot']`.
- **Hooks above the early return:** state is declared in six places down the component (189–216, 300, 327–330, 535–537, 931–936, 950) between effects and handlers; all sit above 991.
- **Best-effort storage:** the minted PDF copy (680–691) swallows every error and its `minted_pdf_path` update has no guard; the row, not the file, is the record.
- **No realtime:** while the window is open only its own writes replace `releaseRow` (a fresh `historyRows` resumes a row only when none is held). A signature given from the leader's Dashboard shows on the next open, as a row of *Already on this job* — a signed row does not resume.
- **Role gates:** none in this file. Who may open it is each mount's decision; who may write is `job_lien_releases` RLS.
