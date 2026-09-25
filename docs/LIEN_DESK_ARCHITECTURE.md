# Lien Desk Architecture Map

---
file: docs/LIEN_DESK_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the decomposition of src/components/jobs/LienDeskModal.tsx (2,002 lines) per PAGE_DECOMPOSITION_PLAYBOOK.md — the Texas Chapter 53 Lien desk (§ 53.056 monthly notices, § 53.052 affidavits, § 53.057 retainage notices, the lien Timeline) that the Pipeline board mounts. Inventories every region (state, memos, effects, handlers, writes, extracted Lien* children, lien kernels, test coverage) so extraction can proceed without re-reading the file; lists the large neighbouring Lien* modals without mapping them.
covers:
  - src/components/jobs/LienDeskModal.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

> **Line numbers are as of `a05cef4c4`** (the `mapped_at` commit) and drift with every edit — search the symbol named beside each range. Regenerate the fact sheet with `npm run map -- src/components/jobs/LienDeskModal.tsx`. The file is the busiest component this week (37 commits in 90 days; its 29 since 2026-09-18 lead every component — over 90 days `JobsStagesTab.tsx` has more); re-check ranges before any move.

## What this surface is

[`LienDeskModal.tsx`](../src/components/jobs/LienDeskModal.tsx) is the **Lien desk**: one full-screen dialog with four kinds (tabs) — **Notices** (the queue of § 53.056 notices due per unpaid work month on sub jobs: the office readies the owner of record, drafts on the paper, sends for approval / on the leader's spoken word / straight into the run under a standing rule; the leader approves, holds or sets the GC's standing rule; a sent notice's footer runs letter two, the GC's written okay, counsel's sign-off and the owner's call), **Affidavits** (§ 53.052, pane extracted), **Retainage** (§ 53.057, pane extracted) and **Timeline** (every billed job's Chapter 53 path, tab extracted). Header doors: pile chips, **Put a GC on notice…** (hands off to `GcOnNoticeModal`), **Send the run** (`LienDeskRunModal`). Help guide: [`send-lien-notices-from-the-lien-desk`](../src/content/help/send-lien-notices-from-the-lien-desk.md).

- **Mounted by** `src/components/jobs/JobsStagesTab.tsx` 4712 only (plus its render smoke), on the `/jobs` route (`Jobs`, `src/pages/Jobs.tsx`) → Pipeline tab. The parent row is region J of [`JOBS_STAGES_TAB_ARCHITECTURE.md`](./JOBS_STAGES_TAB_ARCHITECTURE.md).
- **Doors (all in the parent):** `setLienDesk(...)` at JobsStagesTab 1355 (URL), 2469 (handle `openLienDesk`, no caller), 3025 (`'lien-desk'` tools action), 3083 (tools menu `onOpenLienDesk`), 3260 (money-opportunities lien card, clears the board search, `kind: 'notice'`), 4058 (Collections header), 4555 (forecast `onOpenLienNotice` → `{ jobId }`). **URL:** `/jobs?tab=stages&liendesk=1[&liendeskJob=<id>][&liendeskPile=missed][&kind=affidavit|timeline]`, parsed once by JobsStagesTab 1349–1363 and stripped; built by `DashboardPinnedQuickRow` 734–766 and `QuickfillNeedsYouSection` 208–239 (neither builds `liendeskJob`). No `retainage` URL door (the parent's `lienDesk.kind` type omits it). `?gcnotice=<gcId>` is the separate Put-a-GC-on-notice door.
- **Stays mounted between opens:** `open={lienDesk != null}`; `if (!open) return null` sits at **708, below every hook** — state (selection, piles, book filters) survives a close.

### Parent contract (`LienDeskModalProps`, 98–138)

| Prop | Parent source (JobsStagesTab) | Used by region |
|---|---|---|
| `open`, `onClose` | `lienDesk != null` / `setLienDesk(null)` | shell |
| `data`, `loading` | `useLienDeskData(lienDeskEligible, todayYmd, { light: lienDesk == null })` 1613 — light read while closed, full while open | everything |
| `todayYmd` | `forecastTodayYmd` (`calendarYmdInAppTzFromIso`) | clocks, paper dates |
| `authRole`, `authUserId`, `authName` | auth; `authProfileName` | role gates, write stamps |
| `workMonths` | `useForecastWorkMonths(lienDeskJobs)` — evidence per job | months, gates, leader card, affidavit pane |
| `issuer` | `getPhysicalInvoiceIssuerDraft()` re-read after `fetchPhysicalInvoiceIssuerFromAppSettings` | letterhead, phone, run, print |
| `signerNameFor`, `signerPhoneFor?` | `lienSignerNameFor` / `lienSignerPhoneFor` over `users` | notice contact, cover letter `{{phone}}`, run |
| `initialJobId`, `initialKind`, `initialPile` | `lienDesk.jobId/kind/pile` | selection effect, kind-on-open effect, pile effect |
| `onChanged` | `refetchLienDesk` | after every write (`run`) |
| `onOpenEditJob(jobId, focus?)` | `tryOpenEditJob` with focus → `propertyRecordFocus` / `focusRow` | gate doors, paper "gc" door, retainage door |
| `onOpenCompanySettings?` | `navigate('/settings?tab=settings-jobs&focus=issuer.<field>')` | paper "company" door |
| `onOpenLienInstruments`, `onOpenLienAffidavit?`, `onOpenLegalDesk?` | close desk → `LienInstrumentsModal` (`onOpenLienInstruments` fetches an unloaded job; `onOpenLienAffidavit` only toasts for one) / Legal desk | ready footer, book rows, affidavit pane |
| `legalSignoff?` | `{ stateFor, ask }` over `useLegalMatters`; `ask` writes `legal_add_entry` | sent footer (counsel) |
| `onPutGcOnNotice?` | close desk → `setGcNotice({ gcId })` | header GC picker |

**Hook census (fact sheet @ a05cef4c4):** 40 `useState` · 0 `useReducer` · 10 `useEffect` · 18 `useMemo` · 0 `useCallback` · 7 `useRef` (`previewWinRef` 257, `paperRef` 261, `editInputRef` 262, `sourceTripRef` 264, `paneRef` 268, `wasOpenRef` 286, `onPreviewMessageRef` 667) · 4 custom hooks (`useToastContext` 227, `useIsMobile` 228, `useLienTimelineBook` 296, `useNoticePayPage` 522) · 56 local imports. One default-exported component `LienDeskModal` (202–2002, 1,801 lines; render 1813–2001) plus module helpers `jobLabel` 146–151, `severityColors` 153–157, `deadlineWords` 159–166, `chip` 168–179, `btn` 182–193 and style consts 140–200. **No direct table, RPC or edge-function call** — every write goes through an Io kernel (see Hazards).

| Largest blocks | Symbol | Lines |
|---|---|---|
| Notice pane (derived JSX local) | `pane` | 895–1305 (411) |
| Footer by pile / role (JSX if-block) | `let footer` … `if (selected)` | 1493–1811 (319) |
| Header + body switch | render `return` | 1813–2001 (189) |
| Notice paper engine (memos + preview window) | `jobDefaults` 392 → `payHtml` 540; preview 642–706 | ~210 non-JSX |
| Notice list | `list` | 722–806 (85) |
| Affidavit / retainage lists | `affList` / `retList` | 1308–1362 (55) / 1394–1440 (47) |

---

## Master summary table

| Region | Anchor (symbol · lines) | ~Lines | Coupling | Risk | Status | Tests |
|---|---|---|---|---|---|---|
| A. Shell, header, kind tabs, GC picker | render 1813–1934; `kind` 282; `gcPickerOptions` 233; effects 287–290 | ~175 | high — `kind` and `mobileListShown` are read by every body | low (GC picker) / must-stay (kind) | inline; `LienRulesDoor`, GC-picker kernel out | kind tabs via `initialKind` smokes; notice pile-chip counts read by smokes 132/169/193 (never clicked); **GC picker, affidavit/retainage chips, run button, "Sent on your word" untested in the desk** (`lienDeskGcPicker` 8) |
| B. Notice queue list | `visible` 315–319 · selection effect 322–332 · `list` 722–806 · helpers 146–179 | ~135 | med — writes the selection pointer | low | inline | smokes 132, 772, 805 (letter-two chip, both branches); `deadlineWords` + row state ladder 742–761 untested |
| C. Selection context (substrate) | `selected` 334 → `readiness` 559–560, `askReason` 564–570, `gcOpenTotal` 572–575 | ~100 | **highest** — every notice region reads it | must stay / hook seam | inline; property, claim, readiness kernels out | `lienProperty` 12, `lienClaimCorrection` 5, `lienDesk` 18; `askReason` (only `first_notice`, smoke 169) and `lastSentAt` 386 (carry strip, smoke 541) reached only through the smoke; `gcOpenTotal`'s figure never asserted |
| D. Notice paper, wording editor, preview window | memos 392–454, 507–541; handlers 456–505, 642–664; effects 444–453, 502–505, 695–706; render 1210–1286 | ~290 | high — `noticeFields` feeds saves (F1), by-hand (F1), cover/pay pages | **high** (cross-window postMessage, DOM-positioned editor) | inline; builders out (`lienNoticePreview`, `lienFilingDocuments`, `lienNoticePayPage`) | smokes 346–619 (editor, doors, preview round-trip), 621 (cover), 722 (pay); kernels 13 + 14 + 8; `useNoticePayPage` hook 2 |
| E. Notice pane body | `pane` 895–1209, 1288–1305; `monthCards` 809–825; `monthGrid` 828–842; gates 844–856; `timeline` 876–891; `pickKind` 341–353 | ~440 | med — reads C, D (`wordingDiff`, `claimOpenSignal`), writes `byHandOpen`, `rulePick`, `checkedMonths`, A's `mobileListShown` (back button) | med (claim money, gate truth) | inline shell; 7 children out | smokes 132–303, 382–572, 675; `lienDeskGates` 11, `lienMonthGrid` 3; strip 905–932 untested |
| F1. Draft / awaiting / ready / held actions | handlers 543–636; footer 1497–1711; `byHandPane` 1467–1490 | ~335 | high — reads C + D + E's `gates`/`pickGate` (Go to gate 1594), the write funnel `run` | **high** (legal consequences: skip gives up lien rights; approval path) | inline; `LienWordRecordRow`, `LienNoticeByHandPane` out; Io in `lienDeskIo` | smokes 132–245, 745; `lienDesk` 18 (`submitOutcome`, `holdUntilFor`), `lienWord` 6; footer word ladder 1503–1542 only partly (blocked + "Goes to the leader" first-notice branches, smokes 132/169/183/276/382; label 1603's "Send for approval" side, 183); **ready/held footers, rule/hold/leader/`claimGate` ladder branches, toast choice 611 untested**; `lienDeskIo` 0 (mocked) |
| F2. Sent footer (letter two, GC okay, counsel, owner's call) | footer 1712–1803; `LienOwnerCallDialog` 1973–1989 | ~110 | low-med — reads C + `data` + D's `jobDefaults` (letter two) + `run`/`busy`; own 6 states | med (inline `jobBalance` money gate) | inline; dialog + kernels out | smokes 772–842; `lienLetterTwo` 6, `lienOwnerCall` 4, `legalAsks` 4; `jobBalance` 1718 only its unpaid branch (smoke 772 "GC paid: no"); **counsel sign-off ask 1764–1770 untested** (no smoke passes `legalSignoff`) |
| G. Affidavit kind | `affVisible`… 711–714 · `affList` 1308–1362 · `affPane` 1363–1391 · chips 1856–1867 | ~100 | low — own pile/selection/footer slot; `onShowNotices` writes C | low | pane **extracted** → `LienDeskAffidavitPane` (410) | smokes 305–342, 695, 843; `lienDeskAffidavits` 4 |
| H. Retainage kind | 715–719 · `retList` 1394–1440 · `retPane` 1441–1464 · chips 1844–1855 | ~90 | low — as G, plus `onOpenRun` | low | pane **extracted** → `LienDeskRetainagePane` (306) | smokes 636–689, 695; `lienDeskRetainage` 4 |
| I. Timeline kind | `bookOpened` 284 + effect 293–295 · `useLienTimelineBook` 296 · `openBookRow` 859–873 · render 1936–1947 | ~45 | low — `openBookRow` writes `kind` + both selections | low | tab **extracted** → `LienDeskTimelineTab` (116) | **none** (no smoke opens it; `useLienTimelineBook` none; `lienTimelineBook` 8) |
| J. The run | `runOpen` 280 · header button 1924–1928 · ready footer 1692 · `LienDeskRunModal` 1990–1999 | ~20 | low | med (certified-mail packet) | **extracted** → `LienDeskRunModal` (256) | own render 6; `lienDeskRun` 16 |

Render smoke: [`LienDeskModal.render.test.tsx`](../src/components/jobs/LienDeskModal.render.test.tsx) (860 lines) — **34 `it` blocks** (35 cases; one loops over affidavit/retainage), mocks `useAuth`, `supabase`, `propertyLookupClient`, `lienClaimCorrectionIo`, `useNoticePayPage`, `propertyKindWrite`, `lienDeskIo` (importActual + spies), `ownerConfirmWrite`. No e2e spec names the desk.

---

## Per-region dossiers

### A. Shell, header, kind tabs, GC picker

- **Render:** overlay 1814–1821 (`bottom: var(--app-bottom-chrome)`, z 80); card 1822–1825 (`gridTemplateRows: auto 1fr auto`); header 1826–1934 — title with the flow tooltip 1827–1832, close 1833, kind tablist 1834–1840 (counts: notices = `entries.filter(pile !== 'sent')`, affidavits `affCount`, retainage `retCount`, timeline `book.counts.due`), `LienRulesDoor` 1841, line break 1843 (v2.3817), pile chips ×3 1844–1877, GC picker 1878–1923, run button 1924–1928 (`counts.ready + retReady`), "Sent on your word" 1929–1933 (leader). Body switch 1935–1968 (mobile: list **or** pane by `mobileListShown`). Footer slots 1969–1971 (affidavit/retainage portal targets; notice footer inline).
- **Owned state:** `gcPickerOpen` 231, `kind` 282, `mobileListShown` 254; ref `wasOpenRef` 286.
- **Memos/effects:** `gcPickerOptions` 233 (`buildLienGcPickerOptions(entries, gcsById)`); kind-on-open 287–290 (resets `kind` to `initialKind ?? 'notice'` on each false→true `open`).
- **Coupling:** `kind` is written by the tabs, `openBookRow` (I), and both panes' `onShowNotices` (G, H); `mobileListShown` by every list row, the back button (E 933–937), `openBookRow` (I) and the selection effect.
- **Extraction:** kind + `mobileListShown` stay. The three pile-chip blocks are one shape → `LienDeskPileChips({ piles, counts, active, onPick })`. The GC picker (1878–1923 + `gcPickerOpen`) is self-contained → `LienDeskGcPicker({ options, onPick })`.

### B. Notice queue list

- **Render:** `list` 722–806 — empty sentence 724–728, groups by `PILE_ORDER` 729–804, row button 763–799 (dot, `jobLabel`, GC, `formatUsdNoCents(openBalance)`, deadline chip, missed chip 781–785, months named, dated-from-creation, state words 742–761, letter-two chip IIFE 789–797).
- **Owned state:** `pile` 234 (+ effect 235–237: sets only when `initialPile` given — never cleared on reopen) — shared with A: the header's notice pile chips 1868–1877 read and write it (`setPile`).
- **Memos:** `visible` 315–319 — the **Missed lens** (v2.3679): `pile === 'missed'` also shows entries with `missedMonths.length > 0`; ordered by `PILE_ORDER` 140 (same order as `LIEN_DESK_PILES`).
- **Selection effect 322–332** (deps `[open, initialJobId, visible ids joined]`, exhaustive-deps disabled): the requested job wins (and hides the mobile list); a still-visible selection stays; else first visible row on desktop, none on mobile.
- **Extraction:** Stage A the row words (`deadlineWords`, state ladder, letter-two chip decision) → `lienDesk.ts`; Stage B a shared `LienDeskQueueList` shell with `affList`/`retList` (identical row grid/dot/pile-header markup at 771/1335/1420, 773/1337/1422, 735/1320/1406). Selection stays a controlled prop.

### C. Selection context — the shared substrate (stays)

- **Pointer:** `selectedJobId` 238 → `selected` 334 (visible first, then any entry — a filtered-out selection survives).
- **Derived locals (no state):** `job` 335, `gc` 336, `address` 337, `ownerRow` 338, `property` memo 339 (`resolveLienProperty`), `ownerName` 340, `promise` 354, `gcHasPriorNotice` 355, `ruleLive` 357 (`ruleWaitsOnFirstNotice`), `wm` 358, `item` 359 (live item: not sent/missed), `storedDraft` memo 360, `monthChoices` 363, `defaultMonths` 364, `months`/`monthsList` 380–381, `openBalance` 383, `correction` 385, `lastSentAt` 386, `claimed` 387 (`correctedClaim`), `claimSplitLine` 388, `claimGate` 389 (`correctionSendGate`), `handSetClaimWords` 390, `readiness`/`ready` 559–560 (`draftReadiness`), `askReason` memo 564–570, `gcOpenTotal` memo 572–575.
- **Reset effect 365–379** (deps `[selected?.jobId]`): clears 11 states — `checkedMonths`, `coverNote` (→ item's), `wordOpen`, `skipOpen`, `byHandOpen`, `holdOpen`, `rulePick`, `wordNote`, `wordingEdits`, `editing`, `paneScrolled` — and scrolls `paneRef` to top (guarded for jsdom).
- **Extraction:** becomes the `useLienNoticeDraft` hook seam together with D's memos (step 9) — one object in, every notice region consumes it. The pointer itself stays in the modal.

### D. Notice paper, wording editor, preview window

- **Render:** envelope line + cover-note tick 1210–1218; legend + "Preview in a new window" 1221–1233; page 1 cover 1236–1243; notice page label 1244–1249; the paper `data-lien-desk-paper` 1250–1273 (`dangerouslySetInnerHTML` of `docHtml`, `onClick={onPaperClick}`, absolutely positioned `<input>` editor 1252–1272); pay page 1276–1286. Paper divs wear `data-theme="light"`.
- **Owned state:** `coverNote` 240, `wordingEdits` 256, `previewJobId` 258, `editing` 260, `ringField` 265, `claimOpenSignal` 266 (read by E's `LienClaimBox`); refs `previewWinRef`, `paperRef`, `editInputRef`, `sourceTripRef`, `onPreviewMessageRef`.
- **Memos:** `jobDefaults` 392–407 (`buildLienNoticeFieldsForJob`, claim = `claimed.claim`), `noticeFields` 410–413 (stored draft or defaults, **claim/claimSplit/retainage always re-read live**, typed edits on top), `wordingDiff` 414, `docExtras` 418–424, `paperMarks` 426–443 (typed/locked/derived + door per field), `docHtml` 454, `coverBlocks` 507–519 (**exhaustive-deps disabled**), `coverHtml` 520, `payBlocks` 523–539, `payHtml` 540; locals `wordingTouched` 415, `wordingEditedBy` 416, `wordingLocked` 417 (`!office` or item past draft), `pageTotal` 541.
- **Handlers:** `startEdit` 456–465 (measures `[data-field]` rect vs `paperRef`, copies computed font), `onPaperClick` 466–495 (reset button → default; plain value with `data-door` → Edit Job GC / Settings → Company / claim box, remembering `sourceTripRef`; typed value → edit), `commitEdit` 496–501, `previewInput` 642–649, `postToPreview` 650–654, `openPreview` 655–664 (blob URL, **not `noopener`**, revoked after 60 s), `onPreviewMessageRef.current` 668–694 (assigned during render).
- **Effects:** ring-on-return 444–453; focus editor 502–505; `message` listener 695–700 (while open); post rebuilt pages 702–706 (exhaustive-deps disabled).
- **Data:** `useNoticePayPage(selected?.jobId, open)` 522 → `fetchJobWithDetailsById` + `noticeInvoiceDocs` + `buildPayPageAssets` (own test `src/hooks/useNoticePayPage.render.test.tsx`, 2 cases; mocked in the desk smoke).
- **Extraction:** Stage A `mergeNoticeFields` (410–413) and `lienNoticePaperMarks` (426–443) into [`lienNoticePreview.ts`](../src/lib/jobs/lienNoticePreview.ts) with tests. Stage B `LienNoticePaper` owning `previewJobId`, `editing`, `ringField` (+ 5 refs, 4 effects) — only after the hook seam (step 9) exposes `noticeFields`/`jobDefaults`/`wordingLocked`, because F1's `draftFields` and the by-hand pane read them. `wordingEdits` (read by `noticeFields`) and `coverNote` (read by `coverBlocks` and F1's `ensureDraft`) go into the seam, not the paper; `claimOpenSignal` is read by E's `LienClaimBox`, so it lifts to the pane.

### E. Notice pane body

- **Render (`pane` 895–1305):** scroll handler 899–902 (`STRIP_COLLAPSE_PX` 200, 72 px); sticky strip 905–932 (verdict, non-ok gates, months, next step, claim, wording line); mobile back 933–937; heading + letter-two chip 938–948; `LienTimelineStrip` 949–953; leader "What you're deciding" card 955–990 (hand-set claim, wording, open-with-GC total, promise, months + hours/people, hold consequence); `LienDeskGates` 993–1148 with `details` — owner 1000–1059 (roll-shaped address via `rollMailingLines`, CAD link via `txCountyCadPropertyUrl`/`…SearchUrl` → `openInExternalBrowser`, `LienDeskOwnerPane` 1045–1057), gc 1060–1083, kind 1084–1110 (`PropertyKindSwitch` → `pickKind`, shared-property words), months 1111–1146; carried-correction strip 1151–1167 (Still true / Clear it); `LienDeskMonths` 1170–1207 (`monthGrid!`, `LienClaimBox` 1173–1182, retainage-in-claim tail 1184–1197, missed/by-hand/toggle callbacks); [D renders 1210–1286]; standing-rule box 1288–1301 (leader; radio writes `rulePick` and calls `saveRule`); empty placeholder 1303–1305.
- **Owned state:** `checkedMonths` 239 (written here, but read only by C's `months` 380 — seam state, not pane-local), `rulePick` 252, `paneScrolled` 267, `activeGate` 270 (+ 4 s clear effect 271–275, `pickGate` 276 — also called by F1's Go to gate 1594), `kindBusy` 278; ref `paneRef` 268 (also used by C's reset effect 378, D's claim door 485 and F1's Go to gate 1594).
- **Derived:** `monthCards` 809–825, `monthGrid` 828–842 (`buildLienMonthGrid`), `{ gates, verdict }` 844–855 (`buildLienDeskGates`), `gateByKey` 856, `timeline` 876–891 (`buildLienTimelineFromDesk` + `lienRetainageClockFromDesk`).
- **Writes:** `savePropertyKind` (pickKind 341–353, own try/catch — **not** through `run`), `lookLienClaimCorrection`/`clearLienClaimCorrection`/`saveLienClaimCorrection` via `run`, `noteMissed` 554–557, `saveRule` 635–636.
- **Children out:** `LienTimelineStrip` (378), `LienDeskGates` (94), `LienDeskOwnerPane` (238, keyed by job, writes the owner itself), `PropertyKindSwitch` (52), `LienDeskMonths` (216), `LienClaimBox` (175).
- **Extraction:** last Stage B (`LienDeskNoticePane`), after C/D seam; move strip, leader card, gate details, carry strip and rule box as sub-components first if the pane is still too big.

### F1. Draft / awaiting / ready / held actions

- **Handlers:** `draftFields` 543–552 (keeps `batchReason`/`coverLetter` from Put-a-GC-on-notice, `monthsDatedFromCreation`, wording stamp with `new Date()`), `noteMissed` 554–557, **`run` 577–591** (busy guard → toast → `onChanged`), `ensureDraft` 593–596, `saveDraft` 598, `sendToLeader` 599–612 (`claimGate` forces `awaiting_approval/claim_by_hand`, else `submitOutcome`; toast text chosen separately at 611), `sendOnWord` 613–621, `skip` 622–630, `approve` 631, `hold` 632–633 (`holdUntilFor`), `pullBack` 634, `saveRule` 635–636.
- **Footer (1493–1811), by `selected.pile`:** draft states (`needs_owner` / `to_draft` / `missed` with due months) 1497–1610 — `stateWords` 1503–1519 and `stateWhy` 1520–1542 ladders, skip confirm 1547–1553, word row 1554–1568, main row 1570–1607 (Skip…, Already mailed?, Save draft, "The leader said to send it…", Go to gate / **leader Approve = `ensureDraft` + `approveLienDeskItem` 1598** / Send for approval · Put it in the run); `awaiting` 1611–1675 (leader: hold confirm 1614–1622, Hold/Back/Already mailed/Approve & next 1624–1635; office: word row 1638–1653 or waiting line + "He is here" 1654–1674); `ready` 1676–1696 (Not what I said, Just this one → Lien window, Send the run); `held` 1697–1711; `missed` 1804–1810. `byHandPane` 1467–1490 replaces any draft/awaiting/ready/held footer while open.
- **Owned state:** `wordOpen` 241, `wordNote` 242, `wordChannel` 243, `skipOpen` 244, `byHandOpen` 246 (also opened from E's `LienDeskMonths`), `skipReason` 250, `holdOpen` 251. Shared: `busy` 253 (substrate), `rulePick` (E, read in the awaiting line 1627), E's derived `gates` (`firstBlocker` 1502) and `pickGate`/`paneRef` (Go to gate 1594).
- **Writes (`lienDeskIo`):** `saveLienDeskDraft`, `submitLienDeskItem`, `sendLienDeskItemOnWord`, `approveLienDeskItem`, `holdLienDeskItem`, `pullBackLienDeskItem`, `skipLienDeskItem`, `noteLienWindowMissed`, `setCustomerLienNoticePolicy`.
- **Extraction:** Stage A first — `lienDeskDraftFooterWords` (1503–1542 + the toast 611 + the button label 1603 in one kernel so they cannot disagree) and `buildDeskDraftFields` (543–552, `nowIso` param). Then `useLienDeskRunner` (`busy` + `run`). Then `LienDeskDraftFooter` taking the seam object + runner (+ E's `gates` and `pickGate` as props).

### F2. Sent footer — letter two, GC okay, counsel, owner's call

- **Render:** facts row 1748–1756 (sent date, day count, GC paid, GC authorized, letter two, counsel, owner called + pile); GC-okay input 1757–1763; counsel ask 1764–1770; sentence + doors 1772–1800 (Ask counsel…, Record the owner's call…, The GC authorized direct pay…, Send letter two ▸ menu 1780–1799); `LienOwnerCallDialog` IIFE 1973–1989 (outside the card).
- **Locals:** `lt` 1714, `first` 1716 (first packet's item — **re-derived at 1975**), `call` 1717, **`jobBalance` 1718 = `max(0, revenue − payments_made)`**, `signoff`/`signoffLine` 1721–1722, `startTwo` 1723–1736 (builds letter-two `LienDeskDraftFields` from `jobDefaults`), `noteOkay` 1737–1745.
- **Owned state:** `signoffOpen` 248, `signoffText` 249, `letterTwoMenu` 303, `gcOkayOpen` 304, `gcOkayNote` 305, `ownerCallOpen` 307.
- **Writes:** `startLetterTwo`, `noteGcAuthorizedDirectPay`, `noteOwnerCall` (lienDeskIo); `legalSignoff!.ask` (parent → `legal_add_entry`).
- **Extraction:** Stage A `sentPacketFacts` (1714–1718 + 1975), `letterTwoFooterSentence` (1774), door predicates (1777–1780) and `letterTwoDraftFields` (1726–1734) → [`lienLetterTwo.ts`](../src/lib/jobs/lienLetterTwo.ts). Stage B `LienDeskSentFooter` with its 6 states + the owner-call dialog — the cleanest footer to move (own state; reads C, D's `jobDefaults` for `startTwo`, and `run`/`busy` — pass them as props).

### G / H. Affidavit and retainage kinds

- **Inline:** G — `affEntries`/`affVisible`/`affSelected`/`affCount` 711–714 (pile order literal duplicates `LIEN_AFFIDAVIT_PILES`), `affList` 1308–1362 (counsel pile chip via `affidavitPileFor`, missing gates), `affPane` mount 1363–1391, chips 1856–1867. H — `retEntries`/`retVisible`/`retSelected`/`retCount`/`retReady` 715–719, `retList` 1394–1440, `retPane` 1441–1464 (`onOpenRun`), chips 1844–1855.
- **Owned state:** G `affPile` 297, `affSelectedJobId` 308, `affFooterEl` 312; H `retPile` 299, `retSelectedJobId` 300, `retFooterEl` 301. Selection falls back to the first row on desktop (713, 717).
- **Footer portal:** the panes render their footer into `affFooterEl`/`retFooterEl` (callback refs at 1969–1970) — replaced a handed-up-state loop (comment 309–311; guarded by smoke 695).
- **Extracted:** [`LienDeskAffidavitPane`](../src/components/jobs/LienDeskAffidavitPane.tsx) (410; also exports the pure `affidavitDeadlineWords` 54), [`LienDeskRetainagePane`](../src/components/jobs/LienDeskRetainagePane.tsx) (306). Neither has its own render test.
- **Extraction:** lists fold into `LienDeskQueueList` (step 5); pile/selection stay because `openBookRow` and `onShowNotices` cross kinds.

### I. Timeline kind

- **State:** `bookOpened` 284 (true once the tab is visited; effect 293–295), `bookGcId` 291, `bookShow` 292 (setters only passed to the tab). **Hook:** `useLienTimelineBook(open && bookOpened && data != null, todayYmd, data?.items)` 296 — its own reads (`jobs_ledger`, `customers`, `customer_addresses`, `job_property_owners`, `job_lien_filings`; RPCs `list_lien_notice_months`, `list_lien_affidavit_windows`), kept for the modal's life.
- **Routing:** `openBookRow` 859–873 — next step on the affidavit side (`affidavit|serve|suit|release`) and listed → Affidavits; listed in the queue → Notices; else `onOpenLienInstruments`.
- **Render:** 1936–1947, print via `printHtmlInNewWindow(lienGridHtml(...))`.
- **Extracted:** [`LienDeskTimelineTab`](../src/components/jobs/LienDeskTimelineTab.tsx) (116). **No test opens this kind.**

### J. The run

`runOpen` 280; opened from the header 1924–1928, the ready footer 1692 and `retPane`'s `onOpenRun`. `LienDeskRunModal` 1990–1999 receives `[...buildLienDeskRun(queue.piles.ready, …), ...buildLienRetainageRun(retainage.piles.ready, …)]` **built inline on every render while open**. Extracted and tested (render 6, `lienDeskRun` 16).

---

## Shared substrate

1. **Kind + three selection pointers:** `kind` 282, `selectedJobId` 238, `affSelectedJobId` 308, `retSelectedJobId` 300, plus `mobileListShown` 254. Cross-kind writers: `openBookRow` (kind + notice/affidavit selection), `affPane`/`retPane` `onShowNotices` (kind + notice selection), the selection effect 322–332. **Stay in the modal**; children get `selected…` + `onSelect…` props.
2. **Selection context (C) + notice draft engine (D memos):** `selected` → `job`/`gc`/`property`/`months`/`claimed`/`claimGate` → `jobDefaults` → `noticeFields` → `docHtml`/`coverBlocks`/`payBlocks`. Read by E, F1, F2 (`jobDefaults`), the by-hand pane and the preview window. Becomes **`useLienNoticeDraft`** (one hook, one object) before any notice-side Stage B.
3. **Write funnel:** `busy` 253 + `run` 577–591 — every notice/sent/claim/owner-call write (except `pickKind`) goes through it; the extracted panes keep their own copies (`LienDeskAffidavitPane` `busy` 113 + `run` 174, `LienDeskRetainagePane` `busy` 85, `LienDeskOwnerPane` `busy` 67). Becomes **`useLienDeskRunner({ onChanged })`**, which those panes can adopt later.
4. **Parent data engine:** `useLienDeskData` (357 lines, JobsStagesTab 1613) — no realtime; refreshed only by `onChanged` → `refetchLienDesk`. Not this map's to move.

## What must STAY in `LienDeskModal`

- `kind`, the three selection pointers, `mobileListShown`, the selection effect 322–332 and the kind-on-open / pile effects 235–237, 287–290 (the parent's doors land through them).
- The reset-on-job effect 365–379 until every state it clears has moved with its region (then each child resets itself by `key={jobId}`).
- The header's kind tabs and body switch; the footer slots 1969–1971 (portal targets).
- `runOpen` + the `LienDeskRunModal` mount (opened from three regions).

---

## Stage-A inventory

**Kernels already out** (size · test cases counted by `it(`):

| Kernel | Lines | Tests | Used here for |
|---|---|---|---|
| [`lienDesk.ts`](../src/lib/jobs/lienDesk.ts) | 510 | 18 | piles, policies, role helpers, `draftReadiness`, `submitOutcome`, `holdUntilFor`, `ruleWaitsOnFirstNotice` |
| [`lienDeskIo.ts`](../src/lib/jobs/lienDeskIo.ts) | 228 | **0** (spied in smoke) | 12 of its 14 writers |
| `lienDeskGcPicker.ts` | 99 | 8 | picker rows |
| `lienNoticePreview.ts` | 315 | 13 | wording edits/diff, preview HTML + messages |
| `lienNoticeDraft.ts` | 279 | 4 | `buildLienNoticeFieldsForJob`, `parseLienDeskDraftFields`, cover note, `retainageInsideClaim` |
| `lienNoticePayPage.ts` | 127 | 8 | pay page blocks/summary |
| `lienDeskRun.ts` | 366 | 16 | run notices, `runCoverNoteBlocks` |
| `gcOnNotice.ts` | 537 | 14 | `fillCoverLetter`, `letterTwoTemplate`, affidavit month word |
| `lienLetterTwo.ts` | 118 | 6 | kinds, `letterTwoIsDue` |
| `lienOwnerCall.ts` | 227 | 4 | piles A/B/C, call words |
| `lienDeskRetainage.ts` | 257 | 4 | retainage piles/words; `parsePaymentBond` (no direct test) |
| `lienDeskAffidavits.ts` | 152 | 4 | affidavit piles |
| `lienMonthGrid.ts` | 207 | 3 | the months grid |
| `lienTimelineDesk.ts` | 191 | 2 | `buildLienTimelineFromDesk`, `lienRetainageClockFromDesk` — **neither named in its test** (it tests `buildLienTimelineFromWindow`) |
| `lienTimelineBook.ts` | 229 | 8 | print grid |
| `lienDeskGates.ts` | 146 | 11 | the four gates + verdict |
| `lienClaimCorrection.ts` / `…Io.ts` | 106 / 68 | 5 / 0 (mocked) | hand-set claim math / writes |
| `lienProperty.ts` | 131 | 12 | owner + property resolution |
| `propertyKind.ts` / `propertyKindWrite.ts` | 47 / 18 | 4 / 0 (mocked) | kind words, shared property / write |
| `rollMailingLines.ts`, `lienWord.ts`, `forecastWorkMonths.ts` | 59, 63, 311 | 6, 6, 11 | owner envelope, spoken word, month labels |
| `lienFilingDocuments.ts`, `demandLetter.ts`, `legal/legalAsks.ts` | 757, 868, 159 | 14 (+1 pdf), 37, 4 | paper HTML, dates/money words, counsel sign-off |

**Still inline (move to `src/lib/jobs/*` + tests):**

| Candidate | Where | Target |
|---|---|---|
| Draft-footer state/why ladder + submit toast + button label | 1503–1542, 611, 1603 | `lienDeskDraftFooterWords` in `lienDesk.ts` — one source for what the office is told |
| `askReason` | 564–570 | `lienAskReasonFor(entry, data, promise)` in `lienDesk.ts` |
| Row words: `deadlineWords`, state ladder, letter-two chip decision | 159–166, 742–761, 789–797 | `lienDesk.ts` / `lienLetterTwo.ts` |
| `visible` + Missed lens | 315–319 | `lienDeskVisible(entries, pile)` (load-bearing lens rule) |
| `lastSentAt` | 386 | `lastSentAtFor(items, jobId)` — feeds `claimGate` and the carry strip (money gate) |
| GC open total + job count | 572–575, 970 (count computed twice) | `gcOpenOnDesk(entries, gcId)` → `{ total, jobs }` |
| `noticeFields` merge | 410–413 | `mergeNoticeFields` in `lienNoticePreview.ts` |
| `paperMarks` | 426–443 | `lienNoticePaperMarks` in `lienNoticePreview.ts` |
| `draftFields` | 543–552 | `buildDeskDraftFields(…, nowIso)` in `lienNoticeDraft.ts` |
| `monthCards` | 809–825 | `lienDeskMonthCards` in `lienMonthGrid.ts` |
| `openBookRow` routing | 859–873 | `bookRowTarget(row, data)` in `lienTimelineBook.ts` |
| Sent-packet facts: `first`, `jobBalance` | 1714–1718, 1975 | `sentPacketFacts` in `lienLetterTwo.ts` — **money gate with no unit test** (smoke 772 hits only the unpaid branch) |
| Letter-two sentence + door predicates + `startTwo` fields | 1774, 1777–1780, 1726–1734 | `lienLetterTwo.ts` |
| Pile-order constants | `PILE_ORDER` 140, literal 712 | derive from `LIEN_DESK_PILES` / `LIEN_AFFIDAVIT_PILES` (same order today) |
| `affidavitDeadlineWords` | `LienDeskAffidavitPane.tsx` 54 (exported from a component) | `lienDeskAffidavits.ts` |
| "X's lien right ends …" sentence | 986, 1618, 1702 | one `lienRightEndsWords` |
| Tone → chip colours | 153–157, 795, 919, 1349 | `lienDeskStyles.ts` (component-side consts, not a kernel) |

---

## Recommended extraction order (value ÷ risk)

Done: panes/tabs/dialogs listed in the Neighbours "extracted children" table (~2,600 lines out), plus every kernel above.

1. **Stage A: `lienDeskDraftFooterWords` + `lienAskReasonFor`** (1503–1542, 564–570, 611, 1603) — ~60 lines out, pins the rule-to-UI truth under tests.
2. **Stage A: `sentPacketFacts` + letter-two words/doors/fields** (1714–1780, 1975) — ~45 lines; puts `jobBalance` under a test.
3. **Stage A: `mergeNoticeFields`, `lienNoticePaperMarks`, `buildDeskDraftFields`** (410–443, 543–552) — ~45 lines.
4. **Stage A sweep:** `lienDeskVisible`, `lastSentAtFor`, `gcOpenOnDesk`, `lienDeskMonthCards`, `bookRowTarget`, row words, pile constants, `affidavitDeadlineWords` — ~80 lines.
5. **`LienDeskQueueList`** — one list shell for `list`/`affList`/`retList` (722–806, 1308–1362, 1394–1440) — ~190 → ~90; selection controlled.
6. **`LienDeskPileChips` + `LienDeskGcPicker`** (1844–1923) — ~80 lines; `gcPickerOpen` moves.
7. **`useLienDeskRunner`** (`busy` + `run`, 577–591) — ~20 lines; unlocks every footer move.
8. **`LienDeskSentFooter`** (F2, 1712–1803 + 1973–1989) — ~110 lines + 6 states.
9. **`useLienNoticeDraft` hook seam** (C + D memos, 334–416, 418–454, 507–575) — ~200 lines; returns the selection context and the paper's HTML.
10. **`LienNoticePaper`** (D render 1210–1286 + editor/preview handlers, refs, 4 effects) — ~230 lines.
11. **`LienDeskDraftFooter`** (F1, 1467–1711) — ~245 lines + 7 states.
12. **`LienDeskNoticePane`** (E, rest of `pane`) — ~330 lines, last.

Verification per step: `npm run typecheck && npm run lint && npm test`, behavior-preserving only, one PR per step (see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md)). The smoke's `lienDeskIo` spies and DOM hooks (`data-lien-*`) are the regression net — keep every `data-*` attribute through moves.

---

## Hazards

- **Money on a statutory form:** the notice claims `claimed.claim` = `correctedClaim(openBalance, correction)`; `noticeFields` 411 **always overwrites the stored draft's claim/claimSplit/retainage with the live figure** (v2.3682) — keep that precedence. `claimGate` 389 forces leader approval over any rule (606–607) and, when `'leader'`, blocks the spoken word unless the channel says he is present (`wordRecordBlock`, `lienWord.ts` 38–42). `retainageInsideClaim` is named on the form (1186–1188).
- **Two balances:** the notice uses the desk's `selected.openBalance`; the sent footer's letter-two / GC-okay / counsel doors and "GC paid" use `jobBalance = max(0, revenue − payments_made)` 1718 with a `> 0.005` threshold; the counsel ask formats it `$${Math.round(jobBalance)…}` 1777, not `formatUsdNoCents`. Preserve; reconcile only in its own PR.
- **Legal consequences:** Skip gives up lien rights on the months (reason required, 1551); Note it as missed writes a `missed` row (554–557); the leader's Approve from a draft footer is `ensureDraft` + `approveLienDeskItem` without `submitLienDeskItem` (1598) — unlike Approve & next on an awaiting item (631).
- **Role gates (client mirrors DB):** `isLienLeader` = dev | master_technician; `isLienOffice` = dev | master | assistant | controller; `canSendLienOnWord` = dev | assistant | controller (**deliberately not the master**). Server: `job_lien_desk_items` RLS `*_office` (is_dev / is_assistant [assistant + controller] / master_technician), delete dev-only; trigger `job_lien_desk_items_guard` (approval needs a leader; the word needs note + channel); `set_customer_lien_notice_policy` raises unless dev/master (migration `20260914180000_lien_desk.sql`). The parent loads data only for `stagesGates.isStagesOfficeRole`.
- **Cross-window messaging (D):** preview opened **without `noopener`** so it can post back; the listener checks `ev.origin`, `ev.source === previewWinRef.current`, `previewIsThisJob` and `wordingLocked` before layering an edit or saving (668–694). The handler is re-assigned into a ref every render — moving it must keep that pattern or the listener goes stale.
- **DOM-positioned editor:** `startEdit` measures against `paperRef`; the `<input>` must stay inside the same `position: relative` container as the `dangerouslySetInnerHTML` paper.
- **Hooks above the early return:** all 40 states, 18 memos, 10 effects and 4 custom hooks sit above `if (!open) return null` 708; the desk stays mounted, so state persists across opens (only `kind` resets; `pile` only when a door passes one).
- **Effects whose deps make moves risky:** selection 322–332 (keyed on joined visible ids; disabled lint), reset 365–379 (**partial**: does not clear `skipReason`, `wordChannel`, `signoffOpen/Text`, `gcOkayOpen/Note`, `letterTwoMenu`, `ownerCallOpen` — an open GC-okay input survives a job switch), `coverBlocks` memo 507–519 (disabled lint; omits `property`, `storedDraft.staleNote`, `issuer`), post-to-preview 702–706 (disabled lint).
- **Footer portals (G/H):** the panes write into `affFooterEl`/`retFooterEl` via callback refs; turning that back into handed-up state recreates the render loop (smoke 695 guards it).
- **Non-null assertions:** `monthGrid!` 1171 (safe only because `pane` renders under `selected`, which implies `data`), `legalSignoff!` 1768 (door shown only when `signoff` exists).
- **No realtime:** the desk re-reads only through `onChanged` → `refetchLienDesk`; a write elsewhere (another tab, the Lien window) is invisible until then. `LienDeskOwnerPane` and the G/H panes write on their own and call `onChanged` themselves.
- **URL deep links:** consumed in the parent (JobsStagesTab 1349–1363); this file reads none. `initialPile` takes any `LienDeskPile`, but the parent only ever passes `missed`; `initialKind` accepts `retainage` but no URL produces it.

---

## Neighbours (not mapped here)

**Extracted children of this desk** (already out; sizes at a05cef4c4):

| Component | Lines | Mounted at | Own test |
|---|---|---|---|
| `LienDeskAffidavitPane` | 410 | 1365–1388 | none (desk smoke) |
| `LienTimelineStrip` | 378 | 951 | render 2 |
| `LienDeskRetainagePane` | 306 | 1443–1461 | none (desk smoke) |
| `LienDeskRunModal` | 256 | 1991–1998 | render 6 |
| `LienDeskOwnerPane` | 238 | 1045–1057 | none (desk smoke 246–303) |
| `LienDeskMonths` | 216 | 1170–1207 | none (desk smoke) |
| `LienClaimBox` | 175 | 1173–1182 | none (desk smoke 523, 541) |
| `LienNoticeByHandPane` | 159 | 1469–1489 | render 2 |
| `LienDeskTimelineTab` | 116 | 1937–1947 | **none** |
| `LienDeskGates` | 94 | 993–1148 | none (kernel 11) |
| `LienOwnerCallDialog` | 94 | 1978–1987 | none (desk smoke 823) |
| `LienWordRecordRow` | 72 | 1555, 1639 | none (desk smoke) |
| `PropertyKindSwitch` | 52 | 1088 | none (desk smoke 382) |
| `LienRulesDoor` | 38 | 1841 | none |
| hooks `useLienDeskData` / `useLienTimelineBook` / `useNoticePayPage` | 357 / 100 / 55 | parent 1613 / 296 / 522 | none / none / render 2 |

**Large sibling Lien surfaces** (candidates for their own maps):

| File | Lines | Mounted by | Relation to the desk | Test |
|---|---|---|---|---|
| [`LienInstrumentsModal.tsx`](../src/components/jobs/LienInstrumentsModal.tsx) | 1,385 | JobsStagesTab | the "Lien window" — `onOpenLienInstruments` / `onOpenLienAffidavit` land here | render 9 |
| [`GcOnNoticeModal.tsx`](../src/components/jobs/GcOnNoticeModal.tsx) | 1,133 | JobsStagesTab | Put a GC on notice (`onPutGcOnNotice`, `?gcnotice=`) | render 5 |
| [`LienReleaseModal.tsx`](../src/components/jobs/LienReleaseModal.tsx) | 1,107 | JobsStagesTab, DashboardLienReleaseQueueModal, BillCustomerLienReleaseStrip | releases (timeline tail) | none |
| [`LienFilingTabs.tsx`](../src/components/jobs/LienFilingTabs.tsx) | 851 | LienInstrumentsModal | the Lien window's filing tabs | none |
| `LienToolingPrefillModal.tsx` | 466 | JobsStagesTab | lien-tooling prefill | none |
| `LienWaiverSendModal.tsx` | 275 | JobsSubLaborTab | waivers | render 3 |
| `LienSignatureInboxSection.tsx` / `LienReleaseSignModal.tsx` | 226 / 224 | inboxes / LienReleaseModal | release signing | none |
| Parent `JobsStagesTab.tsx` | 5,099 | Jobs page | mounts the desk; mapped in [`JOBS_STAGES_TAB_ARCHITECTURE.md`](./JOBS_STAGES_TAB_ARCHITECTURE.md) | — |
