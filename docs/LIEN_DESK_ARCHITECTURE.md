# Lien Desk Architecture Map

---
file: docs/LIEN_DESK_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the decomposition of src/components/jobs/LienDeskModal.tsx (2,251 lines) per PAGE_DECOMPOSITION_PLAYBOOK.md — the Texas Chapter 53 Lien desk (§ 53.056 monthly notices, § 53.052 affidavits, § 53.057 retainage notices, the lien Timeline, the Calendar) that the Pipeline board mounts. Inventories every region (state, memos, effects, handlers, writes, extracted Lien* children, lien kernels, test coverage) so extraction can proceed without re-reading the file; lists the large neighbouring Lien* modals without mapping them.
covers:
  - src/components/jobs/LienDeskModal.tsx
mapped_at: f423bd6e5
audience: Developers, AI Agents
last_updated: 2026-10-05
---

> **Line numbers are as of `f423bd6e5`** (the `mapped_at` commit; re-anchored 2026-10-05 from `a05cef4c4` through the file's diff, 2,002 → 2,251 lines) and drift with every edit — search the symbol named beside each range. Regenerate the fact sheet with `npm run map -- src/components/jobs/LienDeskModal.tsx`. The file is one of the busiest components (62 commits in 90 days); re-check ranges before any move. The dated notes below say what each version added; the regions under them carry the same facts by line.

## What this surface is

> **v2.4404 (supply houses on a job):** above the early return the desk calls `useLienJobSuppliers` over every job on the three lists and the Calendar (`supplierJobIds`), and keeps `supplierMarks` (`lienSupplierMark` per job, only while a house is owed). Each list row's words end with `LienSupplierMarkLine`; region E draws `LienJobSuppliersCard` under `LienDeskGates` when the job has supplier invoices (`supplierJob`); `LienDeskCalendarTab` takes `supplierMarks`. Kernel [`lienJobSuppliers.ts`](../src/lib/jobs/lienJobSuppliers.ts) (13 tests); the money agrees with `materials/jobAccountsFlow.ts` by test. The Lien window mounts the same card folded (`startFolded`). **v2.4407:** `LienDeskShare` takes `suppliers` and offers a second thing to send, **Jobs where a supply house is also owed** (`lienShareHouseJobs`, scope `houses`; the payload's optional `houses`, rendered by `_shared/lienDeskStatus.ts`), and the Calendar gains the **Houses owed** lens (`housesOnly`: the board is built from the marked rows, the axis from all of them; since v2.4430 it sits in the date row beside the search on a computer, before the pills on a phone). **v2.4411:** the card takes `word` from the office (`{ authName, onChanged: suppliers.reload }`) and each owed house's row offers **They told us…** (`WordForm` → `lienSupplierWordIo.ts` → `job_supply_house_words`); the house's own day (`lienSupplierHouseNotice`, kind `said`) and balance show over the estimate.

> **v2.4355 (the title bar on one line):** region A's spacing moved from inline margins to the `lienDeskTitleBar` column gap (`index.css`), the tab buttons to `lienDeskKindTab`, and Share's word to a `lienDeskShareWord` span. A viewport from 641 to 1,131 px closes the gap, narrows the tabs and hides the word, so a desk narrower than 1,100 px keeps one title line. No container query: one on the bar would trap the phone's fixed Share sheet.

> **v2.4535 (the door on the other tabs):** the number button is shared — [`LienJobNumber.tsx`](../src/components/jobs/LienJobNumber.tsx) (`LienJobNumber`, and `LienJobHeading` over `splitLienJobLabel` in `lib/jobs/lienJobLabel.ts`). A Timeline row's number opens the job (`LienDeskTimelineTab` `onOpenJob`; the row is a `div` that takes the click for its pane, the name its keyboard button), and the Notices, Affidavits and Retainage panes draw their heading as the number button beside the name. The left lists are untouched: a click there selects. **v2.4632 (the chip as a door to the paper):** `LienDeskNextUp` draws the Notice / Affidavit chip as a `lienPaperDoor` button when the desk passes `onOpenPaper` (`gapsFor` puts a red count or a tick on it); the desk builds `paperEntries` on open — for each row with a job, the notice (`buildLienNoticeFieldsForJob`, the stored draft's fields when there is one, `buildLienNoticeBlocks`) or the affidavit (`buildLienAffidavitFieldsForJob`, `buildLienAffidavitBlocks`) with every statutory blank replaced by a token (`withGapTokens`) that `paintGaps` turns into the numbered red `.lienPaperGap` mark after `filingDocHtml`; the gaps themselves come from `lienPaperGaps` (`lib/jobs/lienPaperGaps.ts`) over the resolved property, the owner, the GC, the signer, the issuer's address and, for an affidavit, the entry's gates. `LienPaperPreviewOverlay` (z 795) draws the banner, the paper with a notice's envelope line above it (the owner gap lands there, since the form does not name the owner), and the rail of gaps with the row's own button when its rung is the fix; arrows walk `paperRows`, Esc closes it alone. **v2.4631 (the steps):** `LienDeskNextUp` draws a rail per kind of paper above the rows (`LienStepRail` in `LienDeskSteps.tsx`, counts from `countLienSteps` in `lib/jobs/lienNextUpSteps.ts`; the notice ladder's fourth rung is the desk's `counts.ready`, pressed it opens the run), four dots and a fraction per row (`LienStepMark`, `lienStepOfRow`), and a card on the dots (`LienStepCardView`, `lienStepCard` over `stepFactsFor` — owner, months, draft and approval days, missing affidavit gates, the run count — beside the dots on a computer, a sheet on a phone). A pressed rung dims every row not on it (`data-dim`), session-only. **v2.4628:** every door is text, not a chip — `.lienJobDoor` (was `.lienCalJobNo`) underlines on hover and focus; a pane's heading is one button of the whole line; the Do now row's number and name are the same door (`LienDeskNextUp` `onOpenJob`, `lien-next-up-job-<id>`), a GC's run row stays plain. The Pipeline's mount passes `onEditJobSaved` and `onClosed` (new on `OpenJobDetailOptions`), both `refetchLienDesk`, so the desk re-reads after a save and when the window closes.
>
> **v2.4531 (the job number is a door):** a Calendar row's number is its own button (`JobNumber` in `LienDeskCalendarTab.tsx`, `onOpenJobWindow`) that opens the job — `LienDeskModal`'s `onOpenJob` → `jobDetailModal.openJobDetail` in `JobsStagesTab` — over the desk (the Job window is z 1010, the desk 780). The rest of the cell still opens the Lien window: the cell's `div` takes the click, the name is its keyboard button, and the number stops the click from reaching it. Desktop axis and phone list alike.
>
> **v2.4544 (records for an owner):** the title bar's *An owner asked for records ›* (`onOpenOwnerRecords`; since v2.4629 at the right end of the second line, in the `data-lien-desk-right` span with *Put a GC on notice…*) opens `LienOwnerRecordsModal`, mounted in `JobsStagesTab` beside the desk (z 800, the desk stays open behind it). Kernels: `ownerRecords.ts` (the packet, the numbers check, the four steps, what blocks a send), `ownerRecordsDocs.ts` (the cover note, the statement, the acknowledgment — draft wording), `ownerRecordsDesk.ts` (the properties and each job's notice claim, from `LienDeskData`); IO `ownerRecordsIo.ts` over `jobs_ledger` / `jobs_ledger_invoices` / `jobs_ledger_payments` and the new `lien_owner_record_requests`. Since v2.4554 its two prints and *Record it as sent* each file the page as it went (`printAndFile`, `fileSentCopy` — [`SENT_COPIES.md`](./SENT_COPIES.md)), and a recorded time carries its year. Since v2.4619 *Download as PDF* draws the same cover note and statement with jsPDF (`ownerRecordsPdf.ts`: `ownerPacketPdfModel` is the pure half, `ownerPacketPdfBlob` draws it) and saves the file through `saveBlobAs` (`storageSave.ts`); a download counts as a send, as a print does. Glossary: *Records for an owner*.
>
> **v2.4541 (undo an approved run):** *Approve all N and send the run* in `GcOnNoticeModal` keeps a receipt of what the click changed (`GcRunReceipt`, `lib/jobs/gcNoticeRunUndo.ts`): the desk items, the standing rule it moved, the payment-terms columns as they were, the owner-share rows it turned on (`ownerShareTurnedOn`), the Legal desk matter it saved. `LienDeskRunModal` takes `undo` and draws a strip under its title; `undoRun` confirms with `gcRunUndoMessage`, then `undoLienDeskApprovals` (approved / awaiting → drafted, printed stamp cleared, `pulled_back_*` stamped), the rule and the terms put back, `unshareBillsTurnedOn`. A Legal desk matter is not removed. The receipt lives in the window's state: gone when the window closes or the run is recorded.
>
> **v2.4526 (an overdue job with its property):** `placeOverdueWithProperty` in `lib/jobs/lienCalendarBuckets.ts` runs at the end of `buildLienCalendarBoard`. An Overdue job whose property (`lienSameProperty`: the linked record, the typed address, or one address cut short of the other) has a job with a date still ahead is listed under that job's group in the bucket of the property's earliest date — `group.byProperty`, drawn through `lienGroupRows` as a heading per property, its jobs, then the overdue ones greyed (`closedHere`). Counts and money do not move: Overdue's `jobs` / `total`, a group's `jobs` / `total` / word and *Draft the N* are as before; Overdue's `groups` lists the rest, its bar says how many are away, and `whole` is what the tab draws when the Overdue pill is picked on its own.
>
> **v2.4340 (the Calendar refresh):** `LienDeskCalendarTab` only; the parent's props are unchanged. The to-do (`TodoStrip`, `lienCalendarTodo`), the density strip (`DensityStrip`, `lienCalendarDensity`) and the summary line are gone. `lib/jobs/lienCalendarBuckets.ts` puts each job once, at its next date (the notice it owes, else its lien date), into Overdue, This month, Next month or Later (`buildLienCalendarBoard`, `lienNextDate`, `lienNextDateCounts`, `lienPhoneLine`). The tab draws the pills (`pick`), the bucket bars sticky under the date row (`folded` holds both the buckets and `bucket/group` keys; a bar's `draft` calls `onDraft` only for notices inside `LIEN_DESK_LEAD_DAYS`), the date row (the search, each 15th's count, today) and `KeyStrip` as one line at the bottom, whose draft door is the first bucket's `draft`.

> **v2.4249 (the caller's door searches the desk):** `LienCallerDoor` now finds every job on the three tabs, not only sent notices — the parent's `callerInput` memo adds `deskJobs` (one `DeskJobRef` per job from `queue` / `affidavits` / `retainage` entries), a *Letter sent* hit still sets `callerJobId`, a *No letter mailed yet* hit calls `openDeskJob` (switches `kind`, lifts `pile` / `affPile` / `retPile` / `calendarJobFilter`, selects the job; `doorPickedJobId` keeps the selection effect from snapping back to `initialJobId` on that one list change), and `practiceCallOpen` mounts `LienOwnerCallDialog practice` on `practiceCallFacts` — no item, no `noteOwnerCall`. Kernel: [`lienCallerMatch.ts`](../src/lib/jobs/lienCallerMatch.ts) (`callerIndex`, `findOnDesk`, `lettersOutNow`, `callerTryWords`).

> **v2.4311 (Share where the liens stand):** region A's title line ends with **Share** (`shareOpen`, reset when the desk closes; desktop: a labelled button at the end of the line, the title bar's right padding 6.2rem so no line runs under the full-screen toggle (§ Rules did at 768 px); phone: a 40 px icon beside ×, the title alone on its line with its right end kept clear; the card's column is `minmax(0, 1fr)` and the tab row scrolls sideways, so the title bar no longer runs past a 375 px screen) → [`LienDeskShare`](../src/components/jobs/LienDeskShare.tsx) → [`LienDeskSharePanel`](../src/components/jobs/LienDeskSharePanel.tsx) (popover / bottom sheet: What to send, the message, Send… via `runJobShare`, Copy, counsel's link) and [`LienDeskEmailSheet`](../src/components/jobs/LienDeskEmailSheet.tsx) (→ `send-lien-desk-summary`). Kernels: [`lienDeskShare.ts`](../src/lib/jobs/lienDeskShare.ts) (`buildLienStatusPayload`, `lienShareScopeOptions`: the notice piles before mailing, affidavits to file, retainage to send, and from `calendarRows` the kinds unset and the windows gone) and [`_shared/lienDeskStatus.ts`](../supabase/functions/_shared/lienDeskStatus.ts) (text, subject, email, `parseLienStatusPayload`). The desk still reads nothing itself: the share's reads are in [`lienDeskShareIo.ts`](../src/lib/jobs/lienDeskShareIo.ts).

> **v2.4119 (the mailing):** a `printed` pile between Ready and Held (`job_lien_desk_items.printed_at`, stamped by the run's *Print the packet* through `markLienDeskItemsPrinted`); the run window (`LienDeskRunModal`) gained the steps strip, `trackingShape` hints, `runRecordSplit` (numbered envelopes record, the rest stay printed), *Mailed on*, and *Envelope faces* (`runEnvelopeFacesHtml`); the Sent footer (region F2) and the Lien window's Filings list draw `LienTrackingOwedEditor` when a certified send has no number (`lib/jobs/lienSendTracking.ts`). The run's source is `piles.ready + piles.printed`.

> **v2.4270 (the visual pass):** `LienDeskCalendarTab` only — `noticeInk` / `lienInk` replace the one `FLAG` map (amber notices, slate liens, red inside a week), `LINE_Y` / `FLAG_H` put every mark on one baseline, `GroupTrack` draws one flag per kind per date, `JobRow` takes `index` for the alternate tint, the density strip inks its column headers. No kernel move.

> **v2.4265 (the work tick, the grey past a dead lien, the key strip):** `LienDeskCalendarTab` alone changed — every row's marks lead with `workMarkFor` (the runway's new `basisYmd`, hollow when `datedFromCreation`), a closed row draws the `gone` wash from `closedYmdFor` (the runway's new `closedBy`), `JobRow` takes its group and prints `rowWord` (nothing when the GC row already says it) with `payMissingDot: false` under a GC, and `KeyStrip` replaces the folded `Key` (the `KEY_SEEN` localStorage rule is gone; `keyGlyph` state, the panel's `door` maps to `setKindsOpen` / the to-do's first draft action, since v2.4340 the first bucket's `draft`). Nothing in this file moved.

> **v2.4101 (punch list #55 PR B):** a fifth kind, **Calendar**, first in the tab row and the desk's default landing — `LienDeskCalendarTab.tsx` over `lib/jobs/lienCalendar.ts`, fed by the parent's `calendarRows` (every billed job with its `LienPayRunway`, built in `JobsStagesTab` from `lienRunwayFor`; null, which the tab reads as *Reading the board…*, until the board holds the `billed_all` scope and `useBilledLienClocks` has read it — the parent fetches that scope while the desk is open, since v2.4321, because the phone board loads one stage at a time) and `onOpenCalendarJob`. Region A's tab row and the body switch gained the kind; nothing else in this file moved. PR C (v2.4152) landed the shared axis in the tab component and the kernels in `lib/jobs/lienCalendar.ts`; the parent's `calendarRows` carry `lastWorkYmd` (and carried each job's `months` from the desk's `useForecastWorkMonths`, widened to every billed job, until v2.4308 moved the flags onto each runway's own `noticeMonths` — fed by `useBilledLienClocks`' work months — and put the desk's work months back on its own jobs), and the tab takes `todayYmd` and `isMobile`. PR D (v2.4153) landed the pen in the tab (`TheySaidPopover`, `KindsSheet`, the density bar as a door until v2.4340) and, here, the Calendar's `calendarJobFilter` on the Notices kind (the chip above the piles, set by the tab's `onDraft`) and the `onCalendarChanged` prop the Pipeline uses to re-read pay dates or bump `useBilledLienClocks`'s `refreshKey`.

[`LienDeskModal.tsx`](../src/components/jobs/LienDeskModal.tsx) is the **Lien desk**: one full-screen dialog with six kinds (since v2.4588 shown as three views, *Do now · Deadlines · All filings* (named *Do now · Calendar · All filings* until v2.4630, when the owner renamed them and dropped All filings's count; only Do now carries one), the last with its own row of paper kinds) — **Do now** (since v2.4583, the landing: one list of what to do next, over the queues below), **Calendar** (every billed job on its lien clock, tab extracted; the landing when no door names a job), **Notices** (the queue of § 53.056 notices due per unpaid work month on sub jobs: the office readies the owner of record, drafts on the paper, sends for approval / on the leader's spoken word / straight into the run under a standing rule; the leader approves, holds or sets the GC's standing rule; a sent notice's footer runs letter two, the GC's written okay, counsel's sign-off and the owner's call), **Affidavits** (§ 53.052, pane extracted), **Retainage** (§ 53.057, pane extracted) and **Timeline** (every billed job's Chapter 53 path, tab extracted). Header doors: **§ Rules**, **☎** — *Someone's calling* (`LienCallerDoor`; the icon alone since v2.4618), **An owner asked for records ›** (`LienOwnerRecordsModal`, in the parent), **Share** (`LienDeskShare`), the full-screen toggle, pile chips, **Put a GC on notice…** (hands off to `GcOnNoticeModal`), **Send the run** (`LienDeskRunModal`). Help guide: [`send-lien-notices-from-the-lien-desk`](../src/content/help/send-lien-notices-from-the-lien-desk.md).

- **Mounted by** `src/components/jobs/JobsStagesTab.tsx` 4473 only (plus its render smoke), on the `/jobs` route (`Jobs`, `src/pages/Jobs.tsx`) → Pipeline tab. The parent row is region J of [`JOBS_STAGES_TAB_ARCHITECTURE.md`](./JOBS_STAGES_TAB_ARCHITECTURE.md).
- **Doors (all in the parent):** `setLienDesk(...)` at JobsStagesTab 1273 (URL, handed in by `useStagesDeepLinkParams`), 2331 (handle `openLienDesk`, no caller), 2930 (`'lien-desk'` tools action), 3012 (money-opportunities lien card, clears the board search, `kind: 'notice'`), 3072 (tools menu `onOpenLienDesk`), 3188 (the stage bar's `StagesLienDeskShortcut`, v2.4520), 3826 (Collections header), 4312 (forecast `onOpenLienNotice` → `{ jobId }`). **URL:** `/jobs?tab=stages&liendesk=1[&liendeskJob=<id>][&liendeskPile=missed][&kind=affidavit|timeline]`, parsed by `parseStagesDeepLinks` ([`stagesDeepLinks.ts`](../src/lib/jobs/stagesDeepLinks.ts) 52–57: `liendeskPile` honours `missed` only at `mapped_at`; any pile since v2.4561) and stripped; built by `DashboardPinnedQuickRow` 808–818, 853 and `QuickfillNeedsYouSection` 210–220, 243 (neither builds `liendeskJob`; both send `liendeskPile=sent`). No `retainage` or `calendar` URL door (the parser reads `affidavit` and `timeline`; the parent's `lienDesk.kind` type omits `retainage`). A door that names no job and no kind lands on the Calendar (the parent's `initialKind`, 4488). `?gcnotice=<gcId>` is the separate Put-a-GC-on-notice door.
- **Stays mounted between opens:** `open={lienDesk != null}`; `if (!open) return null` sits at **830, below every hook** — state (selection, piles, book filters) survives a close.

### Parent contract (`LienDeskModalProps`, 115–165)

| Prop | Parent source (JobsStagesTab) | Used by region |
|---|---|---|
| `open`, `onClose` | `lienDesk != null` / `setLienDesk(null)` | shell |
| `data`, `loading` | `useLienDeskData(lienDeskEligible, todayYmd, { light: lienDesk == null })` 1495 — light read while closed, full while open | everything but the Calendar (its `calendarRows` say when they are read) |
| `todayYmd` | `forecastTodayYmd` (`calendarYmdInAppTzFromIso`) | clocks, paper dates |
| `authRole`, `authUserId`, `authName` | auth; `authProfileName` | role gates, write stamps |
| `workMonths` | `useForecastWorkMonths(lienDeskJobs)` — evidence per job | months, gates, leader card, affidavit pane |
| `issuer` | `getPhysicalInvoiceIssuerDraft()` re-read after `fetchPhysicalInvoiceIssuerFromAppSettings` | letterhead, phone, run, print |
| `signerNameFor`, `signerPhoneFor?` | `lienSignerNameFor` / `lienSignerPhoneFor` over `users` | notice contact, cover letter `{{phone}}`, run |
| `initialJobId`, `initialKind`, `initialPile`, `aimKey` (v2.4612) | `lienDesk.jobId/kind/pile/aim` | selection effect, kind-on-open effect, pile effect; `aimKey` changes on every press of a door, so a desk already open on that job still re-aims to the tab (`aimedRef` holds `"<job>|<aim>"`) |
| `onChanged` | `refetchLienDesk` | after every write (`run`) |
| `onOpenEditJob(jobId, focus?)` | `tryOpenEditJob` with focus → `propertyRecordFocus` / `focusRow` | gate doors, paper "gc" door, retainage door |
| `onOpenCompanySettings?` | `navigate('/settings?tab=settings-jobs&focus=issuer.<field>')` | paper "company" door |
| `onOpenLienInstruments`, `onOpenLienAffidavit?`, `onOpenLegalDesk?` | `LienInstrumentsModal` over the desk, which stays open under it since v2.4523 — as it does under `onOpenCalendarJob`'s window and `onPutGcOnNotice`'s — so closing the window lands back on the desk (`onOpenLienInstruments` fetches an unloaded job; `onOpenLienAffidavit` only toasts for one) / close desk → Legal desk | ready footer, book rows, affidavit pane |
| `legalSignoff?` | `{ stateFor, ask }` over `useLegalMatters`; `ask` writes `legal_add_entry` | sent footer (counsel) |
| `onPutGcOnNotice?` | close desk → `setGcNotice({ gcId })` | header GC picker |
| `calendarRows?`, `onOpenCalendarJob?`, `onCalendarChanged?` | `lienCalendarRows` (every billed job with its `LienPayRunway`; null while the board reads) / `setLienInstrumentsModal` over the desk / re-read pay dates or bump the clocks, then `refetchLienDesk` | Calendar kind (K), Share |
| `onOpenJob?`, `onOpenOwnerRecords?` | `jobDetailModal.openJobDetail` over the desk / `setOwnerRecordsOpen(true)` | job-number buttons (K, I, the three panes' headings), header |

**Hook census (fact sheet @ f423bd6e5):** 44 `useState` · 0 `useReducer` · 12 `useEffect` · 21 `useMemo` · 0 `useCallback` · 9 `useRef` (`previewWinRef` 291, `paperRef` 295, `editInputRef` 296, `sourceTripRef` 298, `paneRef` 302, `kindShownRef` 324, `wasOpenRef` 342, `doorPickedJobId` 369, `onPreviewMessageRef` 789) · 7 custom hooks (`useToastContext` 259, `useIsMobile` 260, `useModalFullScreen` 262, `useScrollEdgeFade` 323, `useLienTimelineBook` 352, `useLienJobSuppliers` 386, `useNoticePayPage` 644) · 72 local imports. One default-exported component `LienDeskModal` (229–2251, 2,023 lines; render 1964–2250) plus module helpers `jobLabel` 173–178, `severityColors` 180–184, `deadlineWords` 186–193, `chip` 195–206, `btn` 209–220 and style consts 167–227. **No direct table, RPC or edge-function call** — every write goes through an Io kernel (see Hazards).

| Largest blocks | Symbol | Lines |
|---|---|---|
| Notice pane (derived JSX local) | `pane` | 1029–1444 (416) |
| Footer by pile / role (JSX if-block) | `let footer` … `if (selected)` | 1640–1962 (323) |
| Header + body switch | render `return` | 1964–2250 (287) |
| Notice paper engine (memos + preview window) | `jobDefaults` 513 → `payHtml` 662; preview 764–828 | ~210 non-JSX |
| Notice list | `list` | 844–939 (96) |
| Affidavit / retainage lists | `affList` / `retList` | 1447–1502 (56) / 1535–1582 (48) |

---

## Master summary table

| Region | Anchor (symbol · lines) | ~Lines | Coupling | Risk | Status | Tests |
|---|---|---|---|---|---|---|
| A. Shell, header, kind tabs, header doors, GC picker | render 1964–2133; `kind` 321; `gcPickerOptions` 267; effects 343–346 | ~175 | high — `kind` and `mobileListShown` are read by every body | low (GC picker) / must-stay (kind) | inline; `LienRulesDoor`, `LienCallerDoor`, `LienDeskShare`, GC-picker kernel out | kind tabs via `initialKind` smokes; Share 148, the owner-records door 167, the caller's door 985–1047, the full-screen toggle 1089; notice pile-chip counts read by smokes 181/226/252 (never clicked); **GC picker, affidavit/retainage chips, run button, "Sent on your word" untested in the desk** (`lienDeskGcPicker` 8) |
| B. Notice queue list | `visible` 397–402 · selection effect 405–420 · `list` 844–939 · helpers 173–206 | ~135 | med — writes the selection pointer | low | inline | smokes 181, 900, 934 (letter-two chip, both branches); `deadlineWords` + row state ladder 874–893 untested |
| C. Selection context (substrate) | `selected` 422 → `readiness` 681–682, `askReason` 686–692, `gcOpenTotal` 694–697 | ~100 | **highest** — every notice region reads it | must stay / hook seam | inline; property, claim, readiness kernels out | `lienProperty` 12, `lienClaimCorrection` 7, `lienDesk` 20; `askReason` (only `first_notice`, smoke 226) and `lastSentAt` 507 (carry strip, smoke 638) reached only through the smoke; `gcOpenTotal`'s figure never asserted |
| D. Notice paper, wording editor, preview window | memos 513–576, 629–663; handlers 578–627, 764–786; effects 566–575, 624–627, 817–828; render 1349–1425 | ~290 | high — `noticeFields` feeds saves (F1), by-hand (F1), cover/pay pages | **high** (cross-window postMessage, DOM-positioned editor) | inline; builders out (`lienNoticePreview`, `lienFilingDocuments`, `lienNoticePayPage`) | smokes 441–717 (editor, doors, preview round-trip), 719 (cover), 824 (pay); kernels 13 + 14 + 8; `useNoticePayPage` hook 2 |
| E. Notice pane body | `pane` 1029–1348, 1427–1444; `monthCards` 942–958; `monthGrid` 961–975; gates 977–989; `timeline` 1009–1025; `pickKind` 461–473 | ~440 | med — reads C, D (`wordingDiff`, `claimOpenSignal`), writes `byHandOpen`, `rulePick`, `checkedMonths`, A's `mobileListShown` (back button) | med (claim money, gate truth) | inline shell; 8 children out | smokes 181–397, 478–669, 777, the supplier card 1105–1188; `lienDeskGates` 11, `lienMonthGrid` 4; strip 1039–1066 untested |
| F1. Draft / awaiting / ready / held actions | handlers 665–758; footer 1644–1858; `byHandPane` 1611–1637 | ~335 | high — reads C + D + E's `gates`/`pickGate` (Go to gate 1741), the write funnel `run` | **high** (legal consequences: skip gives up lien rights; approval path) | inline; `LienWordRecordRow`, `LienNoticeByHandPane` out; Io in `lienDeskIo` | smokes 181–308, 848, 860 (the by-hand sheet on a phone); `lienDesk` 20 (`submitOutcome`, `holdUntilFor`), `lienWord` 6; footer word ladder 1650–1689 only partly (blocked + "Goes to the leader" first-notice branches, smokes 181/226/241/368/478; label 1750's "Send for approval" side, 241); **ready/held footers, the `printed` footer (none at `mapped_at`; added v2.4568), rule/hold/leader/`claimGate` ladder branches, toast choice 733 untested**; `lienDeskIo` 0 (mocked) |
| F2. Sent footer (letter two, GC okay, counsel, owner's call) | footer 1859–1954; `LienOwnerCallDialog` 2194–2223 | ~110 | low-med — reads C + `data` + D's `jobDefaults` (letter two) + `run`/`busy`; own 6 states | med (inline `jobBalance` money gate) | inline; dialog + kernels out | smokes 900–984, 1209; `lienLetterTwo` 8, `lienOwnerCall` 5, `legalAsks` 4; `jobBalance` 1868 only its unpaid branch (smoke 900 "GC paid: no"); **counsel sign-off ask 1915–1921 untested** (no smoke passes `legalSignoff`) |
| G. Affidavit kind | `affVisible`… 833–836 · `affList` 1447–1502 · `affPane` 1503–1532 · chips 2055–2066 | ~100 | low — own pile/selection/footer slot; `onShowNotices` writes C | low | pane **extracted** → `LienDeskAffidavitPane` (417) | smokes 326, 399–437, 797, 1071; `lienDeskAffidavits` 5 |
| H. Retainage kind | 837–841 · `retList` 1535–1582 · `retPane` 1583–1608 · chips 2043–2054 | ~90 | low — as G, plus `onOpenRun` | low | pane **extracted** → `LienDeskRetainagePane` (316) | smokes 739–791, 797; `lienDeskRetainage` 5 |
| I. Timeline kind | `bookOpened` 340 + effect 349–351 · `useLienTimelineBook` 352 · `openBookRow` 992–1006 · render 2135–2168 | ~45 | low — `openBookRow` writes `kind` + both selections | low | tab **extracted** → `LienDeskTimelineTab` (134) | own render 2 (the job-number door, v2.4535); **the desk smoke never opens the kind**; `useLienTimelineBook` none; `lienTimelineBook` 8 |
| J. The run | `runOpen` 314 · header button 2123–2127 · ready footer 1839 · `LienDeskRunModal` 2235–2248 | ~20 | low | med (certified-mail packet) | **extracted** → `LienDeskRunModal` (334) | own render 8; `lienDeskRun` 20 |
| K. Calendar kind (v2.4101) | `calendarJobFilter` 396 · `supplierMarks` 387–394 · render 2135–2156 | ~25 | low — the tab's `onDraft` writes `calendarJobFilter`, `pile` and `kind`; rows come from the parent | low | tab **extracted** → `LienDeskCalendarTab` (940) | own render 25; the desk smoke never opens the kind; `lienCalendar`, `lienCalendarBuckets`, `lienCalendarAxis`, `lienCalendarMarks` kernels |

Render smoke: [`LienDeskModal.render.test.tsx`](../src/components/jobs/LienDeskModal.render.test.tsx) (1,228 lines) — **50 `it` blocks** (51 cases; one loops over affidavit/retainage), mocks `useAuth`, `supabase`, `propertyLookupClient`, `lienClaimCorrectionIo`, `useNoticePayPage`, `useLienJobSuppliers`, `lienSupplierWordIo`, `propertyKindWrite`, `lienDeskIo` (importActual + spies), `ownerConfirmWrite`. No e2e spec names the desk.

---

## Per-region dossiers

### A. Shell, header, kind tabs, GC picker

- **Render:** overlay 1965–1973 (`bottom: var(--app-bottom-chrome)`, `padding-top: var(--app-top-chrome)` for an iPhone's status bar, z 80); card 1974–1978 (`gridTemplateRows: auto 1fr auto`); header 1979–2133 — title with the flow tooltip 1981–1987, `ModalFullScreenButton` 1988, close 1989, kind tablist 1990–1997 (five kinds, Calendar first; scrolls sideways on a phone through `useScrollEdgeFade`; counts: notices = `entries.filter(pile !== 'sent')`, affidavits `affCount`, retainage `retCount`, timeline `book.counts.due`), `LienRulesDoor` 1998, `LienCallerDoor` 1999 (office), the owner-records door 2001–2011 (office, when the parent passes `onOpenOwnerRecords`), Share + `LienDeskShare` 2013–2039, line break 2041 (v2.3817), pile chips ×3 2043–2076, GC picker 2077–2122, run button 2123–2127 (`counts.ready + retReady`), "Sent on your word" 2128–2132 (leader). Body switch 2134–2189 (mobile: list **or** pane by `mobileListShown`). Footer slots 2190–2192 (affidavit/retainage portal targets; notice footer inline).
- **Owned state:** `gcPickerOpen` 265, `kind` 321, `mobileListShown` 288, `shareOpen` 316 (cleared when the desk closes, effect 317–319), `callerJobId` 365, `practiceCallOpen` 367; refs `wasOpenRef` 342, `kindShownRef` 324 (the every-render effect 326–338 scrolls the picked tab into view only when the tab or the row's width changed), `doorPickedJobId` 369.
- **Memos/effects:** `gcPickerOptions` 267 (`buildLienGcPickerOptions(entries, gcsById)`); kind-on-open 343–346 (resets `kind` to `initialKind ?? 'notice'` on each false→true `open`). Since v2.4583 (punch list #82) `kind` has a sixth value, `next`, the first tab: `LienDeskNextUp` draws `buildLienNextUp` (`lib/jobs/lienNextUp.ts`) over the queues `data` already holds (`nextUpRows` memo, no read of its own), and `actOnNextUp` turns a row's `target` into the existing setters — `kind` + `pile` + the selected job for a notice, the affidavit or retainage selection, `setRunOpen(true)`, or `onOpenLienAffidavit`. Since v2.4588 the header draws three views, not six tabs: *Do now · Calendar · All filings* (`tablist` "View"), and under All filings a second `tablist` ("Kind of paper": Notices · Affidavits · Retainage · Timeline). `kind` keeps its six values, so every body, door and deep link is untouched; `paperShown` says a paper kind is on, and `lastPaperKind` is where All filings reopens. The host passes `initialKind='next'` on a plain open; a door that names a job, a pile or a kind lands where it did. Since v2.4585 the kind-on-open effect also applies a door's tab when an open desk is handed a different job (the Lien window's next-step card, `lib/jobs/lienWindowNextStep.ts`, closes its window and aims the desk at its job). Since v2.4586 a bare `?liendesk=1` reads `next` in `stagesDeepLinks.ts` (`liendeskJob`, `liendeskPile` or `kind=notice` still mean Notices), so the Dashboard's lien deadlines card lands on the list it counts from and the leader's approve card names `liendeskPile=awaiting`.
- **Coupling:** `kind` is written by the tabs, `openDeskJob` 442–460 (the caller's door), the Calendar's `onDraft` (K), `openBookRow` (I), and both panes' `onShowNotices` (G, H); `mobileListShown` by every list row, the back button (E 1067–1071), `openBookRow` (I) and the selection effect.
- **Extraction:** kind + `mobileListShown` stay. The three pile-chip blocks are one shape → `LienDeskPileChips({ piles, counts, active, onPick })`. The GC picker (2077–2122 + `gcPickerOpen`) is self-contained → `LienDeskGcPicker({ options, onPick })`.

### B. Notice queue list

- **Render:** `list` 844–939 — empty sentence 846–850, groups by `PILE_ORDER` 861–937, row button 895–932 (dot, `jobLabel`, GC, `formatUsdNoCents(openBalance)`, deadline chip, missed chip 913–917, months named, dated-from-creation, state words 874–893, letter-two chip IIFE 921–929).
- **Owned state:** `pile` 268 (+ effect 269–271: sets only when `initialPile` given — never cleared on reopen) — shared with A: the header's notice pile chips 2067–2076 read and write it (`setPile`).
- **Memos:** `visible` 397–402 — the **Missed lens** (v2.3679): `pile === 'missed'` also shows entries with `missedMonths.length > 0`; ordered by `PILE_ORDER` 167 (same order as `LIEN_DESK_PILES`).
- **Selection effect 405–420** (deps `[open, initialJobId, visible ids joined]`, exhaustive-deps disabled): the requested job wins (and hides the mobile list); a still-visible selection stays; else first visible row on desktop, none on mobile.
- **Extraction:** Stage A the row words (`deadlineWords`, state ladder, letter-two chip decision) → `lienDesk.ts`; Stage B a shared `LienDeskQueueList` shell with `affList`/`retList` (identical row grid/dot/pile-header markup at 903/1474/1561, 905/1476/1563, 867/1459/1547). Selection stays a controlled prop.

### C. Selection context — the shared substrate (stays)

- **Pointer:** `selectedJobId` 272 → `selected` 422 (visible first, then any entry — a filtered-out selection survives).
- **Derived locals (no state):** `job` 423, `gc` 424, `address` 425, `ownerRow` 426, `property` memo 427 (`resolveLienProperty`), `ownerName` 428, `promise` 474, `gcHasPriorNotice` 475, `ruleLive` 477 (`ruleWaitsOnFirstNotice`), `wm` 478, `item` 479 (live item: not sent/missed), `storedDraft` memo 480, `monthChoices` 483, `defaultMonths` 484, `months`/`monthsList` 500–501, `openBalance` 503, `correction` 506, `lastSentAt` 507, `claimed` 508 (`correctedClaim`), `claimSplitLine` 509, `claimGate` 510 (`correctionSendGate`), `handSetClaimWords` 511, `readiness`/`ready` 681–682 (`draftReadiness`), `askReason` memo 686–692, `gcOpenTotal` memo 694–697.
- **Reset effect 485–499** (deps `[selected?.jobId]`): clears 11 states — `checkedMonths`, `coverNote` (→ item's), `wordOpen`, `skipOpen`, `byHandOpen`, `holdOpen`, `rulePick`, `wordNote`, `wordingEdits`, `editing`, `paneScrolled` — and scrolls `paneRef` to top (guarded for jsdom).
- **Extraction:** becomes the `useLienNoticeDraft` hook seam together with D's memos (step 9) — one object in, every notice region consumes it. The pointer itself stays in the modal.

### D. Notice paper, wording editor, preview window

- **Render:** envelope line + cover-note tick 1349–1357; legend + "Preview in a new window" 1360–1372; page 1 cover 1375–1382; notice page label 1383–1388; the paper `data-lien-desk-paper` 1389–1412 (`dangerouslySetInnerHTML` of `docHtml`, `onClick={onPaperClick}`, absolutely positioned `<input>` editor 1391–1411); pay page 1415–1425. Paper divs wear `data-theme="light"`.
- **Owned state:** `coverNote` 274, `wordingEdits` 290, `previewJobId` 292, `editing` 294, `ringField` 299, `claimOpenSignal` 300 (read by E's `LienClaimBox`); refs `previewWinRef`, `paperRef`, `editInputRef`, `sourceTripRef`, `onPreviewMessageRef`.
- **Memos:** `jobDefaults` 513–529 (`buildLienNoticeFieldsForJob`, claim = `claimed.claim`), `noticeFields` 532–535 (stored draft or defaults, **claim/claimSplit/retainage always re-read live**, typed edits on top), `wordingDiff` 536, `docExtras` 540–546, `paperMarks` 548–565 (typed/locked/derived + door per field), `docHtml` 576, `coverBlocks` 629–641 (**exhaustive-deps disabled**), `coverHtml` 642, `payBlocks` 645–661, `payHtml` 662; locals `wordingTouched` 537, `wordingEditedBy` 538, `wordingLocked` 539 (`!office` or item past draft), `pageTotal` 663.
- **Handlers:** `startEdit` 578–587 (measures `[data-field]` rect vs `paperRef`, copies computed font), `onPaperClick` 588–617 (reset button → default; plain value with `data-door` → Edit Job GC / Settings → Company / claim box, remembering `sourceTripRef`; typed value → edit), `commitEdit` 618–623, `previewInput` 764–771, `postToPreview` 772–776, `openPreview` 777–786 (blob URL, **not `noopener`**, revoked after 60 s), `onPreviewMessageRef.current` 790–816 (assigned during render).
- **Effects:** ring-on-return 566–575; focus editor 624–627; `message` listener 817–822 (while open); post rebuilt pages 824–828 (exhaustive-deps disabled).
- **Data:** `useNoticePayPage(selected?.jobId, open)` 644 → `fetchJobWithDetailsById` + `noticeInvoiceDocs` + `buildPayPageAssets` (own test `src/hooks/useNoticePayPage.render.test.tsx`, 2 cases; mocked in the desk smoke).
- **Extraction:** Stage A `mergeNoticeFields` (532–535) and `lienNoticePaperMarks` (548–565) into [`lienNoticePreview.ts`](../src/lib/jobs/lienNoticePreview.ts) with tests. Stage B `LienNoticePaper` owning `previewJobId`, `editing`, `ringField` (+ 5 refs, 4 effects) — only after the hook seam (step 9) exposes `noticeFields`/`jobDefaults`/`wordingLocked`, because F1's `draftFields` and the by-hand pane read them. `wordingEdits` (read by `noticeFields`) and `coverNote` (read by `coverBlocks` and F1's `ensureDraft`) go into the seam, not the paper; `claimOpenSignal` is read by E's `LienClaimBox`, so it lifts to the pane.

### E. Notice pane body

- **Render (`pane` 1029–1444):** scroll handler 1033–1036 (`STRIP_COLLAPSE_PX` 227, 72 px); sticky strip 1039–1066 (verdict, non-ok gates, months, next step, claim, wording line); mobile back 1067–1071; heading + letter-two chip 1072–1082; `LienTimelineStrip` 1083–1087; leader "What you're deciding" card 1089–1124 (hand-set claim, wording, open-with-GC total, promise, months + hours/people, hold consequence); `LienDeskGates` 1127–1282 with `details` — owner 1134–1193 (roll-shaped address via `rollMailingLines`, CAD link via `txCountyCadPropertyUrl`/`…SearchUrl` → `openInExternalBrowser`, `LienDeskOwnerPane` 1179–1191), gc 1194–1217, kind 1218–1244 (`PropertyKindSwitch` → `pickKind`, shared-property words), months 1245–1280; carried-correction strip 1290–1306 (Still true / Clear it); `LienDeskMonths` 1309–1346 (`monthGrid!`, `LienClaimBox` 1312–1321, retainage-in-claim tail 1323–1336, missed/by-hand/toggle callbacks); [D renders 1349–1425]; standing-rule box 1427–1440 (leader; radio writes `rulePick` and calls `saveRule`); empty placeholder 1442–1444.
- **Owned state:** `checkedMonths` 273 (written here, but read only by C's `months` 500 — seam state, not pane-local), `rulePick` 286, `paneScrolled` 301, `activeGate` 304 (+ 4 s clear effect 305–309, `pickGate` 310 — also called by F1's Go to gate 1741), `kindBusy` 312; ref `paneRef` 302 (also used by C's reset effect 498, D's claim door 607 and F1's Go to gate 1741).
- **Derived:** `monthCards` 942–958, `monthGrid` 961–975 (`buildLienMonthGrid`), `{ gates, verdict }` 977–988 (`buildLienDeskGates`), `gateByKey` 989, `timeline` 1009–1025 (`buildLienTimelineFromDesk` + `lienRetainageClockFromDesk`).
- **Writes:** `savePropertyKind` (pickKind 461–473, own try/catch — **not** through `run`), `lookLienClaimCorrection`/`clearLienClaimCorrection`/`saveLienClaimCorrection` via `run`, `noteMissed` 676–679, `saveRule` 757–758.
- **Children out:** `LienTimelineStrip` (530), `LienDeskGates` (94), `LienDeskOwnerPane` (238, keyed by job, writes the owner itself), `PropertyKindSwitch` (52), `LienDeskMonths` (217), `LienClaimBox` (175), `LienJobSuppliersCard` (in `LienJobSuppliers.tsx`, 350).
- **Extraction:** last Stage B (`LienDeskNoticePane`), after C/D seam; move strip, leader card, gate details, carry strip and rule box as sub-components first if the pane is still too big.

### F1. Draft / awaiting / ready / held actions

- **Handlers:** `draftFields` 665–674 (keeps `batchReason`/`coverLetter` from Put-a-GC-on-notice, `monthsDatedFromCreation`, wording stamp with `new Date()`), `noteMissed` 676–679, **`run` 699–713** (busy guard → toast → `onChanged`), `ensureDraft` 715–718, `saveDraft` 720, `sendToLeader` 721–734 (`claimGate` forces `awaiting_approval/claim_by_hand`, else `submitOutcome`; toast text chosen separately at 733), `sendOnWord` 735–743, `skip` 744–752, `approve` 753, `hold` 754–755 (`holdUntilFor`), `pullBack` 756, `saveRule` 757–758.
- **Footer (1640–1962), by `selected.pile`:** draft states (`needs_owner` / `to_draft` / `missed` with due months) 1644–1757 — `stateWords` 1650–1666 and `stateWhy` 1667–1689 ladders, skip confirm 1694–1700, word row 1701–1715, main row 1717–1754 (Skip…, Already mailed?, Save draft, "The leader said to send it…", Go to gate / **leader Approve = `ensureDraft` + `approveLienDeskItem` 1745** / Send for approval · Put it in the run); `awaiting` 1758–1822 (leader: hold confirm 1761–1769, Hold/Back/Already mailed/Approve & next 1771–1782; office: word row 1785–1800 or waiting line + "He is here" 1801–1821); `ready` 1823–1843 (Not what I said, Just this one → Lien window, Send the run); `held` 1844–1858; `missed` 1955–1961. `byHandPane` 1611–1637 replaces any draft/awaiting/ready/held footer while open; on a phone it is `layout="sheet"`, a [`LienRecordSheet`](../src/components/jobs/LienRecordSheet.tsx) over the desk's card (v2.4446).
- **Owned state:** `wordOpen` 275, `wordNote` 276, `wordChannel` 277, `skipOpen` 278, `byHandOpen` 280 (also opened from E's `LienDeskMonths`), `skipReason` 284, `holdOpen` 285. Shared: `busy` 287 (substrate), `rulePick` (E, read in the awaiting line 1774), E's derived `gates` (`firstBlocker` 1649) and `pickGate`/`paneRef` (Go to gate 1741).
- **Writes (`lienDeskIo`):** `saveLienDeskDraft`, `submitLienDeskItem`, `sendLienDeskItemOnWord`, `approveLienDeskItem`, `holdLienDeskItem`, `pullBackLienDeskItem`, `skipLienDeskItem`, `noteLienWindowMissed`, `setCustomerLienNoticePolicy`.
- **Extraction:** Stage A first — `lienDeskDraftFooterWords` (1650–1689 + the toast 733 + the button label 1750 in one kernel so they cannot disagree) and `buildDeskDraftFields` (665–674, `nowIso` param). Then `useLienDeskRunner` (`busy` + `run`). Then `LienDeskDraftFooter` taking the seam object + runner (+ E's `gates` and `pickGate` as props).

### F2. Sent footer — letter two, GC okay, counsel, owner's call

- **Render:** facts row 1898–1907 (sent date, day count, GC paid, GC authorized, letter two, counsel, owner called + pile); GC-okay input 1908–1914; counsel ask 1915–1921; sentence + doors 1923–1951 (Ask counsel…, Record the owner's call…, The GC authorized direct pay…, Send letter two ▸ menu 1931–1950); `LienOwnerCallDialog` IIFE 2194–2223 (outside the card).
- **Locals:** `lt` 1861, `first` 1863 (first packet's item — **re-derived at 2196**), `call` 1864, **`jobBalance` 1868 = `max(0, revenue − payments_made)`**, `signoff`/`signoffLine` 1871–1872, `startTwo` 1873–1886 (builds letter-two `LienDeskDraftFields` from `jobDefaults`), `noteOkay` 1887–1895.
- **Owned state:** `signoffOpen` 282, `signoffText` 283, `letterTwoMenu` 359, `gcOkayOpen` 360, `gcOkayNote` 361, `ownerCallOpen` 363.
- **Writes:** `startLetterTwo`, `noteGcAuthorizedDirectPay`, `noteOwnerCall` (lienDeskIo); `legalSignoff!.ask` (parent → `legal_add_entry`).
- **Extraction:** Stage A `sentPacketFacts` (1861–1868 + 2196), `letterTwoFooterSentence` (1925), door predicates (1928–1931) and `letterTwoDraftFields` (1876–1884) → [`lienLetterTwo.ts`](../src/lib/jobs/lienLetterTwo.ts). Stage B `LienDeskSentFooter` with its 6 states + the owner-call dialog — the cleanest footer to move (own state; reads C, D's `jobDefaults` for `startTwo`, and `run`/`busy` — pass them as props).

### G / H. Affidavit and retainage kinds

- **Inline:** G — `affEntries`/`affVisible`/`affSelected`/`affCount` 833–836 (pile order literal duplicates `LIEN_AFFIDAVIT_PILES`), `affList` 1447–1502 (counsel pile chip via `affidavitPileFor`, missing gates), `affPane` mount 1503–1532, chips 2055–2066. H — `retEntries`/`retVisible`/`retSelected`/`retCount`/`retReady` 837–841, `retList` 1535–1582, `retPane` 1583–1608 (`onOpenRun`), chips 2043–2054.
- **Owned state:** G `affPile` 353, `affSelectedJobId` 370, `affFooterEl` 374; H `retPile` 355, `retSelectedJobId` 356, `retFooterEl` 357. Selection falls back to the first row on desktop (835, 839).
- **Footer portal:** the panes render their footer into `affFooterEl`/`retFooterEl` (callback refs at 2190–2191) — replaced a handed-up-state loop (comment 371–373; guarded by smoke 797).
- **Extracted:** [`LienDeskAffidavitPane`](../src/components/jobs/LienDeskAffidavitPane.tsx) (417; also exports the pure `affidavitDeadlineWords` 56), [`LienDeskRetainagePane`](../src/components/jobs/LienDeskRetainagePane.tsx) (316). Neither has its own render test.
- **Extraction:** lists fold into `LienDeskQueueList` (step 5); pile/selection stay because `openBookRow` and `onShowNotices` cross kinds.

### I. Timeline kind

- **State:** `bookOpened` 340 (true once the tab is visited; effect 349–351), `bookGcId` 347, `bookShow` 348 (setters only passed to the tab). **Hook:** `useLienTimelineBook(open && bookOpened && data != null, todayYmd, data?.items)` 352 — its own reads (`jobs_ledger`, `customers`, `customer_addresses`, `job_property_owners`, `job_lien_filings`, `job_demand_letters`; RPCs `list_lien_notice_months`, `list_lien_affidavit_windows`), kept for the modal's life.
- **Routing:** `openBookRow` 992–1006 — next step on the affidavit side (`affidavit|serve|suit|release`) and listed → Affidavits; listed in the queue → Notices; else `onOpenLienInstruments`.
- **Render:** 2135–2168, print via `printHtmlInNewWindow(lienGridHtml(...))`.
- **Extracted:** [`LienDeskTimelineTab`](../src/components/jobs/LienDeskTimelineTab.tsx) (134), own render test 2 cases. **The desk smoke never opens this kind.**

### J. The run

`runOpen` 314; opened from the header 2123–2127 (since v2.4629 the first thing on the title bar's second line, at the left on every view — `data-lien-desk-run`; it had sat at the right), the ready footer 1839 and `retPane`'s `onOpenRun`. `LienDeskRunModal` 2235–2248 receives `[...buildLienDeskRun(queue.piles.ready, …), ...buildLienRetainageRun(retainage.piles.ready, …)]` **built inline on every render while open**; the source is `piles.ready + piles.printed`, and `onPrinted` stamps `markLienDeskItemsPrinted`. The header button's count and its condition read `counts.ready + retReady` only, so at `mapped_at` a desk with nothing but printed notices had no door back into the run (counted since v2.4568). Since v2.4621 every copy row of the run has a *Preview ›* door into `LienRunPreviewOverlay` (z 795 over the run's 790): one entry per copy in packet order, its pages from `runCopyPages` (`lib/jobs/lienDeskRun.ts`), the same pages `runPacketHtml` stacks; arrows walk the packet, Esc closes the preview alone. The run's explainer paragraph sits behind a *?* beside its title. Extracted and tested (render 8, `lienDeskRun` 20).

---

## Shared substrate

1. **Kind + three selection pointers:** `kind` 321, `selectedJobId` 272, `affSelectedJobId` 370, `retSelectedJobId` 356, plus `mobileListShown` 288. Cross-kind writers: `openBookRow` (kind + notice/affidavit selection), `affPane`/`retPane` `onShowNotices` (kind + notice selection), the selection effect 405–420. **Stay in the modal**; children get `selected…` + `onSelect…` props.
2. **Selection context (C) + notice draft engine (D memos):** `selected` → `job`/`gc`/`property`/`months`/`claimed`/`claimGate` → `jobDefaults` → `noticeFields` → `docHtml`/`coverBlocks`/`payBlocks`. Read by E, F1, F2 (`jobDefaults`), the by-hand pane and the preview window. Becomes **`useLienNoticeDraft`** (one hook, one object) before any notice-side Stage B.
3. **Write funnel:** `busy` 287 + `run` 699–713 — every notice/sent/claim/owner-call write (except `pickKind`) goes through it; the extracted panes keep their own copies (`LienDeskAffidavitPane` `busy` 118 + `run` 181, `LienDeskRetainagePane` `busy` 94 + `run` 136, `LienDeskOwnerPane` `busy` 67). Becomes **`useLienDeskRunner({ onChanged })`**, which those panes can adopt later.
4. **Parent data engine:** `useLienDeskData` (374 lines; `demandLettersByJob` feeds both panes' strips, JobsStagesTab 1495) — no realtime; refreshed only by `onChanged` → `refetchLienDesk`. Not this map's to move.

## What must STAY in `LienDeskModal`

- `kind`, the three selection pointers, `mobileListShown`, the selection effect 405–420 and the kind-on-open / pile effects 269–271, 343–346 (the parent's doors land through them).
- The reset-on-job effect 485–499 until every state it clears has moved with its region (then each child resets itself by `key={jobId}`).
- The header's kind tabs and body switch; the footer slots 2190–2192 (portal targets).
- `runOpen` + the `LienDeskRunModal` mount (opened from three regions).

---

## Stage-A inventory

**Kernels already out** (size · test cases counted by `it(`):

| Kernel | Lines | Tests | Used here for |
|---|---|---|---|
| [`lienDesk.ts`](../src/lib/jobs/lienDesk.ts) | 514 | 20 | piles, policies, role helpers, `draftReadiness`, `submitOutcome`, `holdUntilFor`, `ruleWaitsOnFirstNotice` |
| [`lienDeskIo.ts`](../src/lib/jobs/lienDeskIo.ts) | 270 | **0** (spied in smoke) | 13 of its 16 writers |
| `lienDeskGcPicker.ts` | 99 | 8 | picker rows |
| `lienNoticePreview.ts` | 315 | 13 | wording edits/diff, preview HTML + messages |
| `lienNoticeDraft.ts` | 348 | 5 | `buildLienNoticeFieldsForJob`, `parseLienDeskDraftFields`, cover note, `retainageInsideClaim` |
| `lienNoticePayPage.ts` | 127 | 8 | pay page blocks/summary |
| `lienDeskRun.ts` | 444 | 20 | run notices, `runCoverNoteBlocks` |
| `gcOnNotice.ts` | 571 | 14 | `fillCoverLetter`, `letterTwoTemplate`, affidavit month word |
| `lienLetterTwo.ts` | 119 | 8 | kinds, `letterTwoIsDue` |
| `lienOwnerCall.ts` | 268 | 5 | piles A/B/C, call words |
| `lienDeskRetainage.ts` | 258 | 5 | retainage piles/words; `parsePaymentBond` (no direct test) |
| `lienDeskAffidavits.ts` | 153 | 5 | affidavit piles |
| `lienMonthGrid.ts` | 208 | 4 | the months grid |
| `lienTimelineDesk.ts` | 212 | 6 | `buildLienTimelineFromDesk`, `lienRetainageClockFromDesk` — **neither named in its test** (it tests `buildLienTimelineFromWindow`) |
| `lienTimelineBook.ts` | 233 | 8 | print grid |
| `lienDeskGates.ts` | 146 | 11 | the four gates + verdict |
| `lienClaimCorrection.ts` / `…Io.ts` | 122 / 68 | 7 / 0 (mocked) | hand-set claim math / writes |
| `lienProperty.ts` | 131 | 12 | owner + property resolution |
| `propertyKind.ts` / `propertyKindWrite.ts` | 47 / 49 | 4 / 0 (mocked) | kind words, shared property / write |
| `rollMailingLines.ts`, `lienWord.ts`, `forecastWorkMonths.ts` | 59, 63, 311 | 6, 6, 11 | owner envelope, spoken word, month labels |
| `lienFilingDocuments.ts`, `demandLetter.ts`, `legal/legalAsks.ts` | 757, 874, 159 | 14 (+1 pdf), 40, 4 | paper HTML, dates/money words, counsel sign-off |

**Still inline (move to `src/lib/jobs/*` + tests):**

| Candidate | Where | Target |
|---|---|---|
| Draft-footer state/why ladder + submit toast + button label | 1650–1689, 733, 1750 | `lienDeskDraftFooterWords` in `lienDesk.ts` — one source for what the office is told |
| `askReason` | 686–692 | `lienAskReasonFor(entry, data, promise)` in `lienDesk.ts` |
| Row words: `deadlineWords`, state ladder, letter-two chip decision | 186–193, 874–893, 921–929 | `lienDesk.ts` / `lienLetterTwo.ts` |
| `visible` + Missed lens | 397–402 | `lienDeskVisible(entries, pile)` (load-bearing lens rule) |
| `lastSentAt` | 507 | `lastSentAtFor(items, jobId)` — feeds `claimGate` and the carry strip (money gate) |
| GC open total + job count | 694–697, 1104 (count computed twice) | `gcOpenOnDesk(entries, gcId)` → `{ total, jobs }` |
| `noticeFields` merge | 532–535 | `mergeNoticeFields` in `lienNoticePreview.ts` |
| `paperMarks` | 548–565 | `lienNoticePaperMarks` in `lienNoticePreview.ts` |
| `draftFields` | 665–674 | `buildDeskDraftFields(…, nowIso)` in `lienNoticeDraft.ts` |
| `monthCards` | 942–958 | `lienDeskMonthCards` in `lienMonthGrid.ts` |
| `openBookRow` routing | 992–1006 | `bookRowTarget(row, data)` in `lienTimelineBook.ts` |
| Sent-packet facts: `first`, `jobBalance` | 1861–1868, 2196 | `sentPacketFacts` in `lienLetterTwo.ts` — **money gate with no unit test** (smoke 900 hits only the unpaid branch) |
| Letter-two sentence + door predicates + `startTwo` fields | 1925, 1928–1931, 1876–1884 | `lienLetterTwo.ts` |
| Pile-order constants | `PILE_ORDER` 167, literal 834 | derive from `LIEN_DESK_PILES` / `LIEN_AFFIDAVIT_PILES` (same order today) |
| `affidavitDeadlineWords` | `LienDeskAffidavitPane.tsx` 54 (exported from a component) | `lienDeskAffidavits.ts` |
| "X's lien right ends …" sentence | 1120, 1765, 1849 | one `lienRightEndsWords` |
| Tone → chip colours | 180–184, 927, 1053, 1488 | `lienDeskStyles.ts` (component-side consts, not a kernel) |

---

## Recommended extraction order (value ÷ risk)

Done: panes/tabs/dialogs listed in the Neighbours "extracted children" table (~2,600 lines out), plus every kernel above.

1. **Stage A: `lienDeskDraftFooterWords` + `lienAskReasonFor`** (1650–1689, 686–692, 733, 1750) — ~60 lines out, pins the rule-to-UI truth under tests.
2. **Stage A: `sentPacketFacts` + letter-two words/doors/fields** (1861–1931, 2196) — ~45 lines; puts `jobBalance` under a test.
3. **Stage A: `mergeNoticeFields`, `lienNoticePaperMarks`, `buildDeskDraftFields`** (532–565, 665–674) — ~45 lines.
4. **Stage A sweep:** `lienDeskVisible`, `lastSentAtFor`, `gcOpenOnDesk`, `lienDeskMonthCards`, `bookRowTarget`, row words, pile constants, `affidavitDeadlineWords` — ~80 lines.
5. **`LienDeskQueueList`** — one list shell for `list`/`affList`/`retList` (844–939, 1447–1502, 1535–1582) — ~190 → ~90; selection controlled.
6. **`LienDeskPileChips` + `LienDeskGcPicker`** (2043–2122) — ~80 lines; `gcPickerOpen` moves.
7. **`useLienDeskRunner`** (`busy` + `run`, 699–713) — ~20 lines; unlocks every footer move.
8. **`LienDeskSentFooter`** (F2, 1859–1954 + 2194–2223) — ~110 lines + 6 states.
9. **`useLienNoticeDraft` hook seam** (C + D memos, 422–538, 540–576, 629–697) — ~200 lines; returns the selection context and the paper's HTML.
10. **`LienNoticePaper`** (D render 1349–1425 + editor/preview handlers, refs, 4 effects) — ~230 lines.
11. **`LienDeskDraftFooter`** (F1, 1611–1858) — ~245 lines + 7 states.
12. **`LienDeskNoticePane`** (E, rest of `pane`) — ~330 lines, last.

Verification per step: `npm run typecheck && npm run lint && npm test`, behavior-preserving only, one PR per step (see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md)). The smoke's `lienDeskIo` spies and DOM hooks (`data-lien-*`) are the regression net — keep every `data-*` attribute through moves.

---

## Hazards

- **Money on a statutory form:** the notice claims `claimed.claim` = `correctedClaim(openBalance, correction)`; `noticeFields` 533 **always overwrites the stored draft's claim/claimSplit/retainage with the live figure** (v2.3682) — keep that precedence. `claimGate` 510 forces leader approval over any rule (728–729) and, when `'leader'`, blocks the spoken word unless the channel says he is present (`wordRecordBlock`, `lienWord.ts` 38–42). `retainageInsideClaim` is named on the form (1325–1327).
- **Two balances:** the notice uses the desk's `selected.openBalance`; the sent footer's letter-two / GC-okay / counsel doors and "GC paid" use `jobBalance = max(0, revenue − payments_made)` 1868 with a `> 0.005` threshold; the counsel ask formats it `$${Math.round(jobBalance)…}` 1928, not `formatUsdNoCents`. Preserve; reconcile only in its own PR.
- **Legal consequences:** Skip gives up lien rights on the months (reason required, 1698); Note it as missed writes a `missed` row (676–679); the leader's Approve from a draft footer is `ensureDraft` + `approveLienDeskItem` without `submitLienDeskItem` (1745) — unlike Approve & next on an awaiting item (753).
- **Role gates (client mirrors DB):** `isLienLeader` = dev | master_technician; `isLienOffice` = dev | master | assistant | controller; `canSendLienOnWord` = dev | assistant | controller (**deliberately not the master**). Server: `job_lien_desk_items` RLS `*_office` (is_dev / is_assistant [assistant + controller] / master_technician), delete dev-only; trigger `job_lien_desk_items_guard` (approval needs a leader; the word needs note + channel); `set_customer_lien_notice_policy` raises unless dev/master (migration `20260914180000_lien_desk.sql`). The parent loads data only for `stagesGates.isStagesOfficeRole`.
- **Cross-window messaging (D):** preview opened **without `noopener`** so it can post back; the listener checks `ev.origin`, `ev.source === previewWinRef.current`, `previewIsThisJob` and `wordingLocked` before layering an edit or saving (790–816). The handler is re-assigned into a ref every render — moving it must keep that pattern or the listener goes stale.
- **DOM-positioned editor:** `startEdit` measures against `paperRef`; the `<input>` must stay inside the same `position: relative` container as the `dangerouslySetInnerHTML` paper.
- **Hooks above the early return:** all 44 states, 21 memos, 12 effects and 7 custom hooks sit above `if (!open) return null` 830; the desk stays mounted, so state persists across opens (only `kind` resets; `pile` only when a door passes one).
- **Effects whose deps make moves risky:** selection 405–420 (keyed on joined visible ids; disabled lint), reset 485–499 (**partial**: does not clear `skipReason`, `wordChannel`, `signoffOpen/Text`, `gcOkayOpen/Note`, `letterTwoMenu`, `ownerCallOpen` — an open GC-okay input survives a job switch), `coverBlocks` memo 629–641 (disabled lint; omits `property`, `storedDraft.staleNote`, `issuer`), post-to-preview 824–828 (disabled lint).
- **Footer portals (G/H):** the panes write into `affFooterEl`/`retFooterEl` via callback refs; turning that back into handed-up state recreates the render loop (smoke 797 guards it).
- **Non-null assertions:** `monthGrid!` 1310 (safe only because `pane` renders under `selected`, which implies `data`), `legalSignoff!` 1919 (door shown only when `signoff` exists).
- **No realtime:** the desk re-reads only through `onChanged` → `refetchLienDesk`; a write elsewhere (another tab, the Lien window) is invisible until then. `LienDeskOwnerPane` and the G/H panes write on their own and call `onChanged` themselves.
- **URL deep links:** parsed in `stagesDeepLinks.ts` and landed by the parent (JobsStagesTab 1273); this file reads none. `initialPile` takes any `LienDeskPile`, and since v2.4561 the URL can name any of them; the Dashboard and Quickfill build `missed` and `sent` (the tracking card and the letter two line); a pile a door passed is cleared on the next plain open since v2.4568; `initialKind` accepts `retainage` but no URL produces it.

---

## Neighbours (not mapped here)

**Extracted children of this desk** (already out; sizes at f423bd6e5):

| Component | Lines | Mounted at | Own test |
|---|---|---|---|
| `LienDeskAffidavitPane` | 417 | 1505–1529 | none (desk smoke) |
| `LienTimelineStrip` | 530 | 1085 | render 7 (v2.3877: the move pill, the Waiting-on line, the demand node) |
| `LienDeskRetainagePane` | 316 | 1585–1605 | none (desk smoke) |
| `LienDeskRunModal` | 386 (+ `LienRunPreviewOverlay` 114, v2.4621) | 2236–2247 | render 9 |
| `LienDeskOwnerPane` | 238 | 1179–1191 | none (desk smoke 338–397) |
| `LienDeskMonths` | 217 | 1309–1346 | none (desk smoke) |
| `LienClaimBox` | 175 | 1312–1321 | none (desk smoke 620, 638) |
| `LienNoticeByHandPane` | 245 | 1613–1636 | render 3 |
| `LienDeskTimelineTab` | 134 | 2157–2168 | render 2 |
| `LienDeskCalendarTab` (v2.4101) | 940 | 2136–2155 | render 25 |
| `LienCallerDoor` (v2.3854) | 166 | 1999 | none (desk smoke 985–1047) |
| `LienDeskShare` / `LienDeskSharePanel` / `LienDeskEmailSheet` (v2.4311) | 128 / 174 / 239 | 2038 | render 11 (`LienDeskShare`) |
| `LienTrackingOwedEditor` (v2.4119) | 82 | the Sent footer | render 1 |
| `LienJobHeading` (`LienJobNumber.tsx`, v2.4535; text doors v2.4628) | 63 | the notice pane's heading | render 6 |
| `LienDeskGates` | 94 | 1127–1282 | none (kernel 11) |
| `LienOwnerCallDialog` | 183 | 2214–2221, 2225–2234 (practice) | none (desk smoke 952) |
| `LienWordRecordRow` | 72 | 1702, 1786 | none (desk smoke) |
| `PropertyKindSwitch` | 52 | 1222 | none (desk smoke 478) |
| `LienRulesDoor` (since v2.4655 a button that opens `LienRulesModal`, 150 — the rules guide over the desk at the surface's cite, with a find box over `lib/helpGuideFind.ts`) | 48 | 1998 | render 2 + 3 dom |
| `LienJobSuppliersCard` / `LienSupplierMarkLine` (`LienJobSuppliers.tsx`, v2.4404) | 350 | region E under the gates; every list row | desk smoke (5, 1105–1188) |
| hooks `useLienDeskData` / `useLienTimelineBook` / `useNoticePayPage` | 374 / 112 / 55 | parent 1495 / 352 / 644 | none / render 2 / render 2 |

**Large sibling Lien surfaces** (candidates for their own maps):

| File | Lines | Mounted by | Relation to the desk | Test |
|---|---|---|---|---|
| [`LienInstrumentsModal.tsx`](../src/components/jobs/LienInstrumentsModal.tsx) | 1,472 | JobsStagesTab | the "Lien window" — `onOpenLienInstruments` / `onOpenLienAffidavit` land here | render 12 |
| [`GcOnNoticeModal.tsx`](../src/components/jobs/GcOnNoticeModal.tsx) | 1,231 | JobsStagesTab | Put a GC on notice (`onPutGcOnNotice`, `?gcnotice=`) | render 8 |
| [`LienReleaseModal.tsx`](../src/components/jobs/LienReleaseModal.tsx) | 1,607 | six mounts, listed in its own map | releases (timeline tail); mapped in [`LIEN_RELEASE_MODAL_ARCHITECTURE.md`](./LIEN_RELEASE_MODAL_ARCHITECTURE.md) | five render files, counted there |
| [`LienFilingTabs.tsx`](../src/components/jobs/LienFilingTabs.tsx) | 971 | LienInstrumentsModal | the Lien window's filing tabs; on a phone its record steps are sheets on [`LienRecordSheet`](../src/components/jobs/LienRecordSheet.tsx) | render 6 |
| `LienWaiverAmountMath.tsx` (v2.4296) | 234 | LienReleaseModal | the Release of Lien window's amount pieces, per step; draws only, the kernel is `lienWaiverAmountMath.ts`; the amount box types through `lib/moneyTyping.ts` (v2.4334) and the drawn signature is trimmed by `lib/signatureInkTrim.ts` (v2.4335) | kernels 16 / 6 |
| `LienWindowFoldedSteps.tsx` (v2.4398) | 113 | LienInstrumentsModal | the Lien window's steps folded to one strip on a phone, so the paper gets the room | render 3 |
| `DemandRecordSendSheet.tsx` (v2.4414) | 71 | LienInstrumentsModal | Save & record send… as its own page on a phone; shares `lienRecordSheetStyles.ts` (v2.4422) with `LienFilingTabs` and `LienNoticeByHandPane` | render 4 |
| `useScrollEdgeFade` over `lib/scrollEdges.ts` (v2.4441) | 24 / 36 | LienDeskModal, LienInstrumentsModal | a tab row wider than a phone fades its cut end | kernel 5 |
| `LienWaiverSendModal.tsx` | 275 | JobsSubLaborTab | waivers | render 3 |
| `LienSignatureInboxSection.tsx` / `LienReleaseSignModal.tsx` / `DashboardLienWaiversToSignModal.tsx` (v2.4276) | 219 / 197 / 250 | inboxes / LienReleaseModal and the inbox section / the Dashboard's `lien-waivers-to-sign` Needs You item | release signing — the sign and send writes are one module, `lib/jobs/lienReleaseSignIo.ts`, and the page's foot is `LienWaiverFootPreview` (v2.4285) | none / render 2 / render 2 |
| Parent `JobsStagesTab.tsx` | 4,876 | Jobs page | mounts the desk; mapped in [`JOBS_STAGES_TAB_ARCHITECTURE.md`](./JOBS_STAGES_TAB_ARCHITECTURE.md) | — |
