# GC Review Modal Architecture Map

---
file: docs/GC_REVIEW_MODAL_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Step-0 map for the JobsGcReviewModal.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md, adapted from tabs to modal regions and stacked overlays). It inventories what every region of GC Review touches (state, handlers, data via lib IO, child components, coupling, test coverage): the per-GC Billed Awaiting Payment rollup, Wednesday certification, weekly statement rounds, the temperature board, scheduled and standing sends, and the Draft Message and Share all send dialogs. It drives the extraction order.
covers:
  - src/components/jobs/JobsGcReviewModal.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-10-09
---

## Overview

**Line numbers are exact as of `a05cef4c4` and go stale with every commit, so search for the symbol instead of trusting the number.** Before you trust a range, regenerate the facts with `npm run map -- src/components/jobs/JobsGcReviewModal.tsx`.

[`src/components/jobs/JobsGcReviewModal.tsx`](../src/components/jobs/JobsGcReviewModal.tsx) is **2,442 lines**:
- The component is `export function JobsGcReviewModal`, at lines 275–2442 (2,168 lines). Its render runs 730–2441 (1,712 lines).
- The module scope around it holds:
  - `chicagoTomorrowYmd` (96–98)
  - a second component, `ScheduleWhenControls` (101–200, 100 lines)
  - `gcShareMenuItemStyle` (202–214)
  - the exported `SendGcStatementPayload` type (216–229)
  - `JobsGcReviewModalProps` (231–264)

**Census:** 56 `useState` · 0 `useReducer` · 8 effects · 14 `useMemo` · 3 `useCallback` · 0 `useRef` · 4 custom hooks (`useAuth` 321, `useBodyScrollLock` 339, `useGcPortalLinks` 560, `useToastContext` 562). It also has 25 handlers or inner functions and one derived local of 8 or more lines (`emailSendGuard` 709–716). Imports: 38 local plus `react`.

**Churn:** 33 commits in 90 days. The last commit was `a8b2543fc` (2026-09-06, scheduled-send visibility / duplicate skip). It is quiet since the v2.2761–v2.2888 statement-round wave.

**Data:** the fact sheet reports no tables, RPCs or edge functions. All data goes through `lib/*` IO modules (see [Supabase surface](#supabase-surface-via-lib-io)), with **one direct call the scanner misses**: `supabase.rpc('mark_customer_portal_slug_shared' as never, …)` at 569. The `as never` cast hides it.

### What the user does

The office opens GC Review from the Stages board's Billed section. There they:
- read where the week stands on the **stage track** (Check → Send → Word → Done), pinned over the list, and press a stage to see the GCs waiting there
- read **Billed Awaiting Payment grouped by GC/Builder** (or by Development): one row per group, its bills with bill-out dates and ages folded inside
- **certify** each GC's group on Wednesdays
- work **This week's GCs**: every GC with a balance, three steps a row (Check · Send · Word), grouped by the account man to ask (since v2.4149 every GC files under one — the standing pick, else the account man on most of its jobs, else the leader, the one live master — so the *Under $10,000* / *No account man yet* groups are gone and `ownerSource` says which rule chose) — whoever is signed in works every row
- watch the **temperature board** (the Temperature tab)
- manage **scheduled and standing statement emails** (the Scheduled tab)
- send any GC's statement through **Draft Message** (app email, send now or scheduled), **Copy**, **Print** or the **portal link** — the first three only once its bills are checked this week and unchanged (v2.5022, `statementHoldFor` over `gcStatementHeld`; both send functions hold it too; Share all and Print all by GC carry only the checked sections, `bulk`, and say who was held), and open the GC's unpaid invoices as one PDF (**Print unpaid invoices**)
- **Share all**: print or email the whole report

### Host, openers, contract

**Imported by (1):** [`JobsStagesTab.tsx`](../src/components/jobs/JobsStagesTab.tsx). The mount is at 4208–4289, **unconditional**, inside the section IIFE's `active` block, and controlled by `open={gcReviewModalOpen}` (see [`JOBS_STAGES_TAB_ARCHITECTURE.md`](./JOBS_STAGES_TAB_ARCHITECTURE.md) §5, IIFE-mounted dialogs). It has no route of its own and lives under `/jobs` (Stages tab).

| Opener (all in `JobsStagesTab.tsx` unless noted) | Line | Sets |
|---|---|---|
| Billed section header button "GC Review" | 3825 | `open` |
| Section tools menu `'gc-review'` | 3020 | `open` |
| Round cards: `gcRoundCertify` / `gcRoundStart` cases; `onCertifyRound` / `onStartRound` props | 2496–2503; 3228–3235 | `open` (+ `startInRound`) |
| `?gcReview=1` (`DashboardGcReviewWeeklyBanner` 88, `DashboardPinnedQuickRow` 707) | effect 1326–1335 | `open` |
| `?round=1[&gc=<id>]` (`DashboardPinnedQuickRow` 709, edge `statement-round-email-dispatch` `ROUND_URL`) | effect 1366–1378 | `open`, `startInRound`, `startInRoundGcId` |

| Prop (231–264) | Parent wiring | Notes |
|---|---|---|
| `open` / `onClose` | `gcReviewModalOpen`; close also clears `gcReviewStartRound` | `if (!open) return null` at 717, **after** all hooks |
| `billedActiveRows`, `collectionsRows: StageRow[]` | `unfilteredBoardLists` | money-never-hides: the board's filters/search don't shrink the rollup |
| `lastSentByGcId` | `gcLastSentByGcId`: `gc_statement_emails` loaded on open (JobsStagesTab 693–716) | merged with round marks → `mergedLastSent` 527 |
| `onSendStatement(payload)` | [`sendGcStatementEmail`](../src/lib/sendGcStatementEmail.ts) (edge `send-gc-statement-email`; v2.5099, the Stages map's step 7) → toast + `refreshGcLastSent` | the modal builds the payload, the lib is the transport, and the parent keeps the toast and the last-sent read |
| `onPrint(groups, groupBy)` | `buildGcStatementReportHtml` → `openHtmlPrintWindow` | |
| `onCopyForEmail(group, groupBy, {portalUrl})` | subject + `buildGcStatementEmailHtml/Text` → `copyRichHtmlToClipboard` | `groupBy` is ignored by the parent (`_groupBy`) |
| `emailForGc(gcId)` | `extractContactFromCustomer(customer).email` | To prefill + GC chip |
| `users` | office roster | three role-filtered cohorts built inline (Stage A) |
| `isDev` | `authRole === 'dev'` | gates Standing copies only |
| `canCertify` | `stagesGates.isStagesOfficeRole(authRole)`: dev · master_technician · assistant · controller | gates certify, assign, Mark sent, round-email edits for others |
| `onOpenJob?` | `tryOpenEditJob(jobId, { onSaved: loadJobs + refreshCustomers… })` | Edit Job (z 1010) stacks over GC Review (z 60), and the refetch re-derives the rollup in place |
| `onOpenJobDetail?` | `jobDetailModal.openJobDetail` | passed through to `GcReviewCertifyModal` and `GcCallSheetModal` |
| `startInRound?`, `startInRoundGcId?` | `gcReviewStartRound`, `gcReviewRoundGcId` | effect 543–548 |

### Monster blocks (fact sheet, ≥ 100 lines)

| Block | Lines | Size |
|---|---|---|
| GC groups list (`rollup.groups.length === 0 ? … : map`) | 1268–1636 | 369 |
| ↳ per-group actions (Certify + Share menu + portal) | 1376–1551 | 176 |
| Share all dialog (`shareAllOpen`) | 2034–2346 | 313 |
| ↳ Standing copies (`isDev`) | 2201–2343 | 143 |
| Weekly statement rounds card | 900–1195 | 296 |
| ↳ Round email ("Email me my round") | 1054–1193 | 140 |
| Draft Message dialog (`emailDialogGroup`) | 1652–1895 | 244 |
| ~~Round overlay~~ | retired — the worklist and the call sheet do its job | — |
| `ScheduleWhenControls` (module scope) | 101–200 | 100 |

### Key structural differences from the page maps

1. **One scrolling panel plus seven stacked overlays (four of them inline).** The main panel (z 60) holds every inline region: a title block that scrolls away, a sticky block (the tabs with Share all / Print all, and the stage track), the open tab's body, and a sticky foot (Include Collections, Total outstanding). It is the `gc-review` container, so `.gcReview*` / `.gcStage*` / `.gcStep*` in `src/index.css` follow the panel's width, not the screen's. The Draft Message and Share all dialogs (z 61), the Share menu (backdrop 62 / menu 63), the Mark sent dialog (z 64) are **inline JSX**. `GcCallSheetModal` (64), `GcStatementSendHistoryModal` (64) and `GcReviewCertifyModal` (70) are extracted. Nothing handles Escape.
2. **It stays mounted while closed.** The parent renders it unconditionally, and `return null` sits after the hooks, so **all 56 states survive close and reopen** while the Stages tab stays active: `groupBy`, `includeCollections`, a half-typed standing form, `roundStartTotal`. They reset only when the Stages tab goes inactive (the parent's `{active && …}` block unmounts the modal) or unmounts. The `open`-gated effects refetch on every open.
3. **Two rollups over the same rows.** `rollup` (492–495) is what the panel shows, following the Group-by pill and Include Collections. `roundRollup` (500–503) is always **by GC and active-only**, and it feeds certification, rounds, the temperature board and the week strip (comment 504–510, v2.2764).
4. **The parent owns transport, the statement print and copy.** The modal owns the unpaid-invoices PDF (it reads the jobs itself), scheduling (`gc_statement_email_requests`), round marks, certifications (in the child), sender assignment and the round-email chains.

### How to read a dossier

Each dossier gives the **render location**, **owned state** (it moves with the region), **shared state** (it stays in the parent), memos, handlers, **data** (lib IO → table/RPC/edge function), extracted children, **tests**, **risk** and the **approach**. "Reads N · writes M · handlers K" are the fact sheet's per-block counts.

### How to maintain this doc

- When a region extracts, flip its row and dossier to point at the new file, re-run `npm run map` and move `mapped_at`.
- Search for the symbol or label text. Never trust a line past `mapped_at`.

---

## Master summary table

Render regions in JSX order (all ranges @ `a05cef4c4`). Status: `extracted` means thin wiring around an imported component; `inline` means JSX and logic in this file; `shell` means it stays by design.

| # | Region | Anchor (symbol + lines) | ~Lines | Coupling (block reads · writes · handlers) | Tests | Risk | Status |
|---|---|---|---|---|---|---|---|
| 0 | Shell: overlay + panel (`.gcReviewPanel`: top · sticky · body · foot) | `role="dialog"` 731–759; `if (!open) return null` 717; `useBodyScrollLock(open)` 339 | 30 | backdrop → `onClose`; `tab`, `stage`, `expandedKeys` | `JobsGcReviewModal.render` ✓ (7) | low | shell |
| 1 | Header + Group-by pill | 760–807; pill `anyDevelopment ?` 765–791; `groupByPillStyle` 719–729 | 48 | 0 · 1 (`groupBy`) · 1 | none | low | inline |
| 2 | Stage track (replaced the Wednesday strip) | `<GcStageTrack>` in the sticky block; `showTrack` = By GC and a GC in the week | 88 | `buildGcStageTrack(worklist)`, `stage` | `gcReviewStages` ✓ (17), track render ✓ (4) | low | **extracted** |
| 3 | Tabs (This week · Temperature · Scheduled) with Share all · Print all; Include Collections is in the foot (region 8) | `.gcReviewTabs`; Share all opener | 63 | `tab` · 6 (`shareAll*` reset) · 0 | modal render ✓ | low | inline |
| 4 | This week's GCs (the worklist) + the round-email box | `<GcWorklistPanel>`; round email `!byDevelopment && roundItems.length > 0` | panel 262 + email ~140 | `worklist`, `assigningGcId`, `markSentDefaultAction`, 4 pointer setters | `gcWorklist` ✓ (18), panel render ✓ (4) | med | **extracted** (rows) · inline (email) |
| 4a | ↳ Worklist rows: three steps as one line, the next step's button, the statement folded inside (account man, or mark sent, undo) | `GcWorklistPanel.tsx` over `GcReviewRow.tsx` | 401 + 58 | props only; `stage` filters through `gcWorklistAtStage` | render ✓ (12) | low | **extracted** |
| 4b | ↳ Round email | `authUser?.id` 1054–1193 | 140 | 7 · 5 · 4 | `statementRoundEmail` ✓; client ✗ | med | inline |
| 5 | Temperature board | `<GcTemperatureBoard>` 1196–1206 | 11 | `boardRows`, `boardWeeks`, `setHistoryGc` | kernel ✓; component ✗ | low | **extracted** |
| 6 | Scheduled statement sends | `pendingSends.length > 0` 1207–1267 | 61 | 2 · 0 · 7 | `gcStatementStandingCopies` ✓, `gcStatementSchedule` ✓; `canCancelStatementRequest` ✗ | med | inline |
| 7 | A group's statement, folded inside its row | `groupDetail(g)`; a worklist row opens its `statementByGc` group, `otherGroups` (Collections-only GCs, the no-GC bucket, every development) get a `GcReviewRow` of their own | 369 | 1 · 4 · 5 · children `CustomerPortalGlobeButton` | `gcReviewRollup` ✓; modal render ✓ | med | inline |
| 7a | ↳ Pills: last-sent · temperature · cert | 1299–1323 · 1324–1348 · 1349–1375 | 77 | `historyGc` | `gcReviewCertification` ✓ | low | inline |
| 7b | ↳ Actions: Certify + Share menu | `!g.isNoGc` 1376–1551 (menu 1430–1528) | 176 | `shareMenuGroupKey`, `certifyGroup`, `markSentGroup` | ✗ | med | inline |
| 7c | ↳ Job table | 1559–1633 (job link → `onOpenJob` 1591–1616); since v2.4280 a GC's bills end with a **Lien waivers** column — `lienWaiverCellForBill`'s two chips per bill (they hold · we owe), calm since v2.4317 like the Bill tab (grey until a waiver on the bill is under way, amber only when its next step is owed), the jobs' releases read once per open, a chip opening the job (`waiverChipsFor`, shared with the cards). On a phone (`useNarrowViewport640`, ≤ 640 px) the table gives way to one card per bill (`.gcReviewBills`, v2.4364): the job link and what is open, the address, then `gcReviewBillCardWords`' when line (the customer only when the job's name lacks it), then the chips; it ran 550 px wide, breaking a job's name a word a line with the waivers off to the right | 75 | — | `lienWaiverCell` ✓ (7); `gcReviewBillCard` ✓ (6); modal render ✓ | low | inline |
| 8 | Foot: Include Collections · Total outstanding (sticky) | `.gcReviewFoot` | 14 | `includeCollections`, `rollup.grandTotal` | `gcReviewRollup` ✓; modal render ✓ | low | inline |
| 9 | **Draft Message dialog** | `emailDialogGroup ?` 1652–1895 + `openEmailDialogForGroup` 686–707 + `emailSendGuard` 709–716 | 244 + 31 | 13 · 11 · 3 · children `TeammateEmailChips`, `ScheduleWhenControls` | builders/guard/CC ✓; **payload assembly ✗** | **high** | inline |
| 10 | Call sheet (replaced the round overlay) | `callSheetGroupKey && …` IIFE → `<GcCallSheetModal>`; `saveCallSheet` | modal 215 | `worklist`, `boardRowByGc`, `promisedPayDates`, `collectionsByGc`, `wordSources`, `onOpenJobDetail`, `roundBusy`, `roundError` | `gcCallSheet` ✓ (10), `payPromise` ✓ (7), render ✓ (4) | med | **extracted** |
| 10a | ↳ Find a check + the sheet (v2.4046, v2.4050; by development v2.4912; a PDF v2.4913) | `findCheckGroup ?` → `<GcFindCheckModal>` from a group's Share menu (a GC, or a development); Print the sheet / CSV inside it | modal ~230 | `findCheckGroup` | `gcChecksApplied` ✓ (22), `gcChecksAppliedReport` ✓ (8), `gcChecksAppliedPdf` ✓ (3), render ✓ (4) | low | **extracted** |
| 11 | Share all dialog | `shareAllOpen ?` 2034–2346 (Email once 2080–2200) | 170 | 17 · 13 · 7 (whole block, incl. 11a) | builders ✓; payload ✗ | **med-high** | inline |
| 11a | ↳ Standing copies (dev) | `isDev ?` 2201–2343 + handlers 415–485 | 143 + 71 | 7 · 4 · 6 | `planStandingCopyEdit` ✓; `applyStandingPlan` ✗ | med | inline |
| 12 | Certify modal | `<GcReviewCertifyModal>` 2347–2362 | 16 | `certifyGroup` | render ✓ (3) | low | **extracted** (167, over `GcBillLines`) |
| 13 | Mark sent dialog | `markSentGroup && …` 2363–2395 | 33 | 3 · 1 · 1 · `GcStatementMarkSentForm` | form ✓ | low | inline host |
| 14 | ~~Sender card~~ | retired with the rounds panel — nothing opened it once the chips went | — | — | — | — | **retired** |
| 15 | Send history | `<GcStatementSendHistoryModal>` 2437–2439 | 3 | `historyGc` | ✗ | low | **extracted** (116) |
| M | `ScheduleWhenControls` | module 101–200 (render 133–199; `pill` 122–132) | 100 | props only | ✗ | low | inline (module scope) |

### Shell logic regions (non-render)

| Region | Symbols (lines) | Writes | Data (via lib) | Tests | Next action |
|---|---|---|---|---|---|
| View state + rollups | `includeCollections` 294, `groupBy` 295, `anyDevelopment` 486–489, `effectiveGroupBy`/`byDevelopment` 490–491, `rollup` 492–495, `roundRollup` 500–503 | — | — | `gcReviewRollup` 9 | **stays** |
| Certification loader | `certWeekStart`, `certsByGc`, `certGroupByGc` stay; `certRows`, `certsRead`, `refreshCerts` and its effect are [`useGcStatementRound`](../src/hooks/useGcStatementRound.ts)'s | — (the hook's) | `gc_review_certifications` (select) | `gcReviewCertification` 10; hook render ✓ | **moved v2.5072** (#8) |
| Round engine | the hook's: `roundMarks` / `boardMarks` / `roundSenders`, `refreshRoundMarks` and its effect, the senders effect, `reloadSenders`. The window's: `roundGcIds`, `accountMen`, `mergedLastSent`, `worklist`, `boardWeeks`, `boardRows`, `boardRowByGc`, `temperatureByGc`, `payByByGc` | — (the hook's) | `gc_statement_round_marks` (select ×2), `customers.statement_sender_user_id` (select) | `gcStatementRounds` 14, `temperatureBoard` 4; hook render ✓ (9) | **moved v2.5072** (#8); the memos stay, each consumer derives its own |
| Round writes | `markRound` 581–609, `undoRoundMark` 619–629, `assignSender` 670–680, `thisWeekSentMark` 611–614, `markWhenLabel` 615–618, `userNameById` 579, `authUserName` 578 | `roundBusy`, `roundError`, `roundSenders`, `assigningGcId` | `gc_statement_round_marks` upsert/delete; `customers` update | ✗ (upsert payload rule 597–600 inline) | Stage A (#2), then the hook (#8) |
| Deep link to one GC | `focusGcId` prop, `focusedGcId`, the focus effect | `callSheetGroupKey` | — | ✗ | **stays** (pointer plumbing) |
| Scheduled sends | `pendingSends` 330, effect 391–403, `refreshPendingSends` 404–406, `standingGroups` 407, `standingRowIds` 408, `canCancelRow`/`canCancelStanding`/`requesterNameOf`/`requesterOf` 410–413 | `pendingSends` | `gc_statement_email_requests` (select, delete) | `groupStandingCopies` ✓; `canCancelStatementRequest` ✗ | → `useGcScheduledSends` (#4) |
| Standing copies form | 7 states 384–390, `standingPickableUsers` 415–417, `standingUserByEmail` 418–419, `resetStandingForm` 420–427, `applyStandingPlan` 428–431, `submitStanding` 432–462, `editStanding` 463–471, `removeStanding` 472–485 | 7 standing states | `gc_statement_email_requests` (delete then insert) | `planStandingCopyEdit` ✓; apply loop ✗ | → `useGcScheduledSends` (#4) |
| Round email chains | `roundEmailRows` 362 + 7 form states 363–369, `refreshRoundEmailRows` 370–372, effect 373–375, `roundEmailChains` 630, `myRoundEmailChain` 631, `roundEmailPickableUsers` 632–634, `openRoundEmailForm` 635–643, `saveRoundEmail` 644–669 | 8 states | `statement_round_email_requests` (select/insert/delete); edge `statement-round-email-dispatch` | `statementRoundEmail` 6; client ✗ | → `useStatementRoundEmail` (#5) |
| Portal links | `gcIdsForPortal` 559, `useGcPortalLinks` 560, `portalLinkFor` 561, `copyPortalLink` 563–577 | — | `customer_portal_links` + `customer_portal_slugs` (hook); **rpc `mark_customer_portal_slug_shared`** (direct) | `gcPortalLink` 5; hook ✗ | **stays** (read by regions 7, 9, 10) |
| Issuer cache | effect 683–685 `fetchPhysicalInvoiceIssuerFromAppSettings` | module cache | `app_settings` | `physicalInvoiceIssuer` 3 | **stays** |

---

## Shared substrate

**Selection pointers.** Each of these is set by one region and consumed by another, so all of them stay in the parent:

| Pointer | Line | Set by | Consumed by |
|---|---|---|---|
| `emailDialogGroup` | 297 | Share menu Draft Message 1455; round overlay "Send from the app…" 1967; `GcReviewCertifyModal.onCertified({andSend})` 2358 (all via `openEmailDialogForGroup`) | dialog 1652; `emailSendGuard` 709; effect 549 |
| `callSheetGroupKey` | — | the worklist's Call sheet button; the focus effect (`?round=1&gc=`) | `GcCallSheetModal` |
| `certifyGroup` | 334 | Certify / Re-certify 1387, 1399 | `GcReviewCertifyModal` 2347 |
| `markSentGroup` | 355 | Share → Mark sent… 1489 | dialog 2363 |
| `historyGc` | 356 | last-sent pill 1310; temperature pill 1334; `GcTemperatureBoard.onOpenGc` 1204 | `GcStatementSendHistoryModal` 2437 |
| `assigningGcId` | 352 | the worklist's account-man link | the worklist's select |
| `shareMenuGroupKey` | 319 | Share button 1412 | one menu open at a time across all groups |

**Data engine: the statement round.** `certRows` + `roundMarks` + `boardMarks` + `roundSenders` (4 states, 2 refreshers `refreshCerts` / `refreshRoundMarks`, 3 open-gated effects; since v2.5072 all in [`useGcStatementRound`](../src/hooks/useGcStatementRound.ts), with `reloadSenders` for an assign), derived over `roundRollup` into `roundItems` / `roundSummary` / `boardRows` / `temperatureByGc` / `mergedLastSent` / `certProgress`, and read by regions 2, 4, 5, 7a, 7b, 10, 13 and 14. **`markRound` 581–609 is the single write path** for the overlay (1986 Skip, 1999 Sent it), the Mark sent dialog (2386) and the **Draft Message auto-mark** (1870–1873). The writes stay in the window (`markRound`, `undoRoundMark`, `assignSender`, `saveCallSheet`, the Certify modal's `onCertified`), since they need its signed-in name, its toasts and the word promises; each reaches the data only through the hook's refreshers, and a render test holds each one to it. The engine is still read separately on two other surfaces (see [Hazards](#hazards)).

**Secondary substrate:** `pendingSends` feeds both the Scheduled sends panel (6) and Standing copies (11a). `removeStanding` and `standingBusy` are used by both. It is refreshed by the Draft Message schedule (1836), the Share all schedule (2155) and the standing handlers.

---

## Per-region dossiers

### 0. Shell: overlay + panel

- **Render:** 731–759. Fixed overlay `zIndex: 60`, panel `maxWidth: 720`, `maxHeight: 85vh`, own scroll. Backdrop click → `onClose` (744–746).
- **Owns permanently:** props, `useAuth`, `useToastContext`, `useBodyScrollLock(open)` (v2.2144), `useGcPortalLinks`, the view state + rollups, the pointers above, the z-ladder (60 / 61 / 62–63 / 64 / 70), and the tail modal wiring.
- **View state:** `tab` (`week` · `temperature` · `scheduled`), `stage` (the track's filter) and `expandedKeys` (open rows, by GC id, else group key). `stage` and `tab` reset when `open` goes false; open rows survive, like the rest of the state.
- **Tests:** `JobsGcReviewModal.render.test.tsx` (12) mounts the modal over mocked IO: the track and one row per GC, a row opening onto its bills (cards on a phone), a stage narrowing the list and clearing on close, the next step opening its window, a Collections-only GC, the tabs, and a reader with no step buttons. No e2e spec opens it.

### 1–3. Header, stage track, tabs

- **Header (760–807):** `EntityIcon` (`DevelopmentHouseIcon` / `GcHardHatIcon`, 718), a By GC / By Development pill (only when `anyDevelopment`) and ✕, in the title block that scrolls away.
- **Stage track:** `GcStageTrack` over `buildGcStageTrack(worklist)` (`lib/jobs/gcReviewStages.ts`): three stops and Done, each with the GCs waiting there (a row's `next`) and the step's done / owed; the pin is the first stop with a GC waiting. A stop sets `stage`; the list under it is `gcWorklistAtStage`. Only under By GC, only on the This week tab.
- **Tabs:** `tabs` is built per render — Temperature only with `boardRows`, Scheduled only with pending sends or the week's-list email; a tab that is gone falls back to This week. Include Collections with `rollup.collectionsCount` / `collectionsTotal` sits in the foot. Share all (848–877) resets 6 `shareAll*` states and seeds the subject via `gcReviewShareAllEmailSubject`. Print all → `printAll` (v2.5022): `onPrint(bulk.going, effectiveGroupBy)`, the sections checked this week by GC (every section by Development), then the `gcBulkHeldSummary` toast for the held GCs; it waits while `bulkWaitNote` says the week's checks are not read yet.
- **State:** it owns none (`groupBy`, `includeCollections` and the `shareAll*` openers are shared).
- **Approach:** after #6 the Share all opener collapses to `setShareAllOpen(true)`. That is the dialog's mount-init, and it is what lets regions 1–3 become one presentational `GcReviewHeader` (~140 lines) with no owned state. It is optional and low value.

### 4. This week's GCs (extracted) + the round-email box (inline)

- **Render:** `<GcWorklistPanel>` on the This week tab, By GC only; the round-email box is on the Scheduled tab. The modal builds `worklist` (`buildGcWorklist` over `roundRollup.groups`, this week's certs and marks, senders, account men, `mergedLastSent`) and hands the panel callbacks:
  - **Check** → `setCertifyGroup(r.group)`; **Send** → `openEmailDialogForGroup(r.group)`; **Word** / **or mark sent** → `setMarkSentDefaultAction` + `setMarkSentGroup`; **undo** → `undoRoundMark`; a done Sent or Word pill → `setHistoryGc`.
  - The account-man select lists 4 roles and has no email check. It calls `assignSender` and is gated by `canCertify`.
  - Every write goes through `markRound`, which merges with the week's existing mark (`mergeRoundMarkWrite`): one row holds the statement and the word.
  - The stage track reads the same worklist (`buildGcStageTrack`).
- **4b Round email (1054–1193):** your chain line (`formatWeekdays` / `formatMinutes(parseHhMm)`), others' chains with **edit** (canCertify), "Set it up for another sender…" select, and the form (1108–1190): Mon–Fri toggles (sorted), time, **Preview** (`fetchStatementRoundEmailPreview` → `emailPreview.show`, the in-app overlay), **Email me a test**, Stop emailing (`saveRoundEmail([])`), Cancel, Save.
- **Owned (moves with it):** `assigningGcId`, `markSentDefaultAction` and the 7 round-email form states.
- **Shared (stays or goes to the hook):** `worklist`, `roundBusy`, `roundError`, `temperatureByGc`, `boardRowByGc`.
- **Handlers:** `userNameById`, `assignSender`, `markWhenLabel`, `undoRoundMark`, `openRoundEmailForm`, `saveRoundEmail`, `describeRoundMark`/`sendChannelLabel` (kernel).
- **Data:** `customers.statement_sender_user_id` update (`setGcStatementSender`), then a senders re-read; `gc_statement_round_marks` delete (undo); `statement_round_email_requests` (`applyStatementRoundChainPlan`: **inserts, then deletes** unsent); edge `statement-round-email-dispatch` (preview / `test_send`).
- **Tests:** `buildStatementRound` / `summarizeStatementRound` / `describeRoundMark` (14), `groupStatementRoundChains` / `planStatementRoundChainEdit` (6), `emailScheduleWeek` (20). `buildGcWorklist` / `worklistNextStep` / `mergeRoundMarkWrite` (18), `GcWorklistPanel.render` (4). **Untested:** `statementRoundEmailClient`, `gcStatementRoundIo`.
- **Approach:** `useStatementRoundEmail` (#5) → `GcRoundEmailSection`; the round email, the overlay and the per-sender prompts are re-aimed at the office by punch list #49 (`to-dos/gc-review-one-operator/`), which changes this region again.

### 5. Temperature board (extracted)

- `GcTemperatureBoard` (133 lines) gets `rows={boardRows}`, `weekLabels` (**inline UTC date formatting 1199–1202**), `userNameById` and `onOpenGc → setHistoryGc`. Kernel `temperatureBoard.ts` has 4 tests; the component has none. `TEMP_PILL` is re-used by pill 7a.

### 6. Scheduled statement sends (inline, 61 lines)

- **Render:** 1207–1267.
  - Standing groups, one line per recipient (1214–1238): Cancel via `removeStanding`, or "by {requester}".
  - One-off / weekly chains (1239–1265): `describePendingGcStatementSend`, `send_at` in `APP_CALENDAR_TZ`, and Cancel → `cancelGcStatementSend(s.id).then(refreshPendingSends, refreshPendingSends)`.
- **Gate:** `canCancelRow` = `canCancelStatementRequest(row, {id, isDev})` mirrors RLS "Creators cancel own unsent … OR is_dev()" (migration `20260806233713`). The office **reads** every row (journey-map #45 policy).
- **Owned:** none. It reads `pendingSends` and `standingBusy`.
- **Tests:** `groupStandingCopies` ✓ (in `gcStatementStandingCopies.test`, 10), `describePendingGcStatementSend` ✓ (1 of `gcStatementSchedule.test`'s 7). **`canCancelStatementRequest` is untested**; it is a pure predicate living in an IO file.
- **Approach:** `useGcScheduledSends(open)` hook first (#4), then a presentational `GcScheduledSendsPanel`.

### 7. A group's statement (inline, 369 lines)

- **Render:** `groupDetail(g)`, drawn inside an opened `GcReviewRow` — nothing is drawn for a closed row. The row itself carries the name, `$subtotal` · jobs · oldest d. "No billed jobs awaiting payment." when the rollup is empty. Chips and actions:
  - `CustomerPortalGlobeButton` (By GC only).
  - **7a pills:**
    - last-sent 1299–1323: `thisWeekSentMark`, `gcReviewSentThisWeek`, → `historyGc`
    - temperature + "pays by" 1324–1348: `TEMP_PILL`, **inline UTC ymd parse**
    - cert 1349–1375: `gcGroupCertStatus` → Certified or "Changed since certified · ±$delta"
  - **7b actions (1376–1551):**
    - Certify / Re-certify (canCertify, on `certGroupByGc`)
    - the Share menu (1409–1529): Draft Message, Copy (`onCopyForEmail`), Print, **Print unpaid invoices** (`printUnpaidInvoices` → `planGcUnpaidInvoicePrint` + `openGcUnpaidInvoicesPdfInNewTab`; `invoicePrintGroupKey` disables the item while one PDF builds), **Mark sent / spoke with them…** (canCertify), and Portal → `copyPortalLink` or the "No portal link yet" hint
    - else (`g.isNoGc`: the no-GC / no-development group) a print-only icon (1532–1550)
  - **7c table:** customer (+ Collections badge), job (`onOpenJob` link when provided), billed-on, days, remaining.
- **Owned:** `shareMenuGroupKey`. It is one-at-a-time across groups, so it stays in the parent unless the menu becomes per-card local state (a behaviour change, since two menus could be open).
- **Shared:** `byDevelopment`, `effectiveGroupBy`, `certGroupByGc`, `certsByGc`, `mergedLastSent`, `temperatureByGc`, `boardRowByGc`, `portalLinkFor`, and the 4 pointer setters.
- **Data:** read-only except `copyPortalLink` → **rpc `mark_customer_portal_slug_shared`** (locks the short slug on first share), then `refreshPortalLinks`.
- **Tests:** `buildGcReviewRollup` (9: totals, collections, development grouping), `gcGroupCertStatus` / `gcReviewSentThisWeek` (10), `gcPortalLinkCaption` (5), `gcUnpaidInvoicePrint` (10: which bills, which are left out, the message), `CustomerPortalGlobeButton.render` (5). The opened row is covered by `JobsGcReviewModal.render`.
- **Approach:** `GcReviewGroupSection` (#10) with a callbacks bag. Take the pill IIFEs through small presentational helpers first.

### 9. Draft Message dialog (inline, 244 + 31 lines; money-adjacent send)

- **Render:** 1652–1895 (z 61; backdrop closes unless sending).
  - The header (v2.4262): [`StatementRecipientHeader`](../src/components/jobs/StatementRecipientHeader.tsx) draws From · To · Cc · Reply to · Subject over the dialog's own state (one To address, the CC as text through `toggleCcEmailInText` / `parseCcEmails`, `emailReplyToUserId`); the menu's people come from `buildRecipientPeople` ([`lib/gcStatementRecipients.ts`](../src/lib/gcStatementRecipients.ts)) — the GC's `customer_contact_persons` (read by an effect keyed on the dialog's GC, fail-soft) then the office roles — and the sender's copy the reply rule adds is read off `resolveStatementReplyTo` (`lockedCopyEmail`) so the Cc line shows it. Subject is the header's last line (locked when scheduled).
  - An include-portal checkbox (only when `portalLinkFor(g)`).
  - `ScheduleWhenControls`, the error, and the **send-guard status** (1775).
  - Preview: `buildGcStatementEmailPreviewHtml` → `emailPreview.show` — [`EmailPreviewOverlay`](../src/components/jobs/EmailPreviewOverlay.tsx) (z 66, mounted at the modal's root) lays the email over the dialog in a sandboxed frame with Back; `useEmailPreview` holds its state, `previewFrameHtml` sends the email's links to a new tab.
  - Cancel.
  - **Send (1802–1891):**
    - schedule branch 1808–1844: CC validate → `buildGcStatementRequestInsert` → `scheduleGcStatementSend` → `refreshPendingSends`
    - send-now branch 1845–1877: CC validate → `onSendStatement({gcCustomerId, gcName, groupBy, toEmail, ccEmails, subject, emailHtml, emailText, total: g.subtotal, jobCount})`; on ok → close, and **if the GC is in the round and not yet `sent` → `markRound(gcId,'sent',{channel:'email', note:'Sent from the app'})`**
- **Opener:** `openEmailDialogForGroup` 686–707 resets 9 states and fires `resolveEmailWording('gc_statement_scheduled', …)`. The template subject replaces the default **only while untouched** (705), and there is no cancel guard.
- **Owned (move with it):** `emailDialogTo`, `emailDialogCcText`, `emailDialogSubject`, `emailSending`, `emailError`, `emailIncludePortal`, `emailReplyToUserId` (Replies go to — `defaultReplyToUserId`), `emailIntroText`, `emailWhen`, `emailSendDate`, `emailSendTime`, `emailRepeatWeekly` (11). **Stays:** `emailDialogGroup`, `emailFromRoundGcId`.
- **Guard:** `emailSendGuard` = `gcStatementSendGuard({ totalOwedCents: dollarsToCents(subtotal), emailSending, hasAddress: <inline regex 713>, scheduled })`. It blocks a **$0 send-now** (the dispatcher's own skip) and leaves scheduling on $0 allowed.
- **Data:** `gc_statement_email_requests` insert (schedule). Send-now goes through the parent → edge `send-gc-statement-email`. `email_templates` (wording). The issuer phone is read **synchronously at click** (`getPhysicalInvoiceIssuerForDocument()`).
- **Tests:** `gcStatementEmail` (18: html/text/preview/subject/unmatched note/payments block), `gcStatementByProperty` (27: the shared renderer — grouping, lines, sums, the payments block), `gcStatementSendGuard` (8), `gcStatementCc` (6), `gcStatementRecipients` (12), `StatementRecipientHeader.render` (5), `teammateEmailChips` (8, the Share-all dialog's pills), `emailWording` (5), `gcStatementSchedule` (7). **Untested:** the payload assembly (which total, which subject fallback, portal on/off) and the auto-mark rule.
- **Risk:** **high.** It emails an outside GC a dollar total under the company name, and it writes a round mark as a side effect.
- **Approach:** Stage A the payload builder first (#3). Then `GcDraftMessageDialog` (#7), conditionally mounted so the 11 states init from `group` (this replaces the reset in `openEmailDialogForGroup`), with `onSent(group)` doing the auto-mark in the parent.

### 10. Call sheet (extracted; replaced the round overlay)

- **Render:** `GcCallSheetModal` (z 64), mounted while `callSheetGroupKey` names a worklist group. The modal builds the sheet per render — `buildCallSheet({ group, boardRowByGc, todayYmd, promisedPayDates, collectionsByGc })` (each row carries the bills behind its total, from the worklist row's own group, and the GC's Collections bills apart; `GcBillLines` draws them, and a bill's job link is `onOpenJobDetail`) — and owns nothing of it; the component owns the drafts, the source select and how it was heard.
- **Save:** `saveCallSheet(answers, word)` upserts each answer through `mergeRoundMarkWrite` (a word over a sent mark keeps it sent), refreshes once, names any GC that failed and keeps the rest.
- **Print:** `buildCallSheetPrintHtml` → `openHtmlPrintWindow`.
- **Ask by link** (punch list #49, step 7): `wordAsks` (loaded on open through `listGcWordAsks`; `wordAsksOn` stays false until the tables exist) feeds the worklist's **Ask by link** / **answered N — review** buttons. `GcWordAskDialog` (z 64) mints, copies, emails and revokes through `wordAskStep`; review opens this same call sheet with `initialDrafts` (`callSheetFromLink`), and `saveCallSheet` marks the saved answers `accepted`.
- **Tests:** `gcCallSheet` (10), `payPromise` (7), `gcWordAskState` (7), `GcCallSheetModal.render` (5), `GcWordAskDialog.render` (4). `saveCallSheet` and `wordAskStep` themselves are untested.
- **Find a check** (v2.4046, "Where the checks went" PR 3): `GcFindCheckModal` (z 64), mounted while `findCheckGroup` names a GC or, since v2.4912, a development (the group's Share menu; the owner's call was "follow the switch"). It reads on its own — `fetchGcChecksInputs(gcId)` (`lib/jobs/gcChecksAppliedIo.ts`: the GC's jobs with bills and payments, the move ledger, the deposits), or `fetchDevelopmentChecksInputs(developmentId)` under By development, where the kernel gets `gcId: null` and counts every bill on the development's jobs, whoever pays it (a development's sheet files under those jobs, not a customer) — and `buildGcChecksReport` + `findChecks` (`lib/jobs/gcChecksApplied.ts`) do the rest; the parent owns nothing of it. The sheet (v2.4050; a PDF since v2.4913, so the browser's *about:blank* footer is gone) — `gcChecksSheetModel` (every cell, tested) → `gcChecksSheetPdfBlob` (`lib/jobsDocuments/gcChecksAppliedPdf.ts`, jsPDF) → `printPdfAndFile`, which opens it in a tab and files the PDF; `buildGcChecksAppliedCsv` → a blob download — reads the last twelve months (`addDaysYmd(today, -365)`) or, on *show all*, everything; the search always reads everything.
- **The round overlay is retired** with `roundOpen`, `roundFocusGcId`, `roundSentFormOpen`, `emailFromRoundGcId` and the dialog↔overlay bounce effect.

### 11. Share all dialog (inline, 170 + 143 lines)

- **Render:** 2034–2346 (z 61). Summary line, then **Print / save as PDF** (`onPrint`), then **Email once** (2080–2200):
  - To chips and input, Subject (locked when scheduled), `ScheduleWhenControls`, an explainer, the error.
  - **Send (2129–2198):**
    - disabled by an **inline email regex** (2131)
    - schedule → `buildGcStatementRequestInsert({entityId: null, entityName: 'All GCs'|'All developments', includeCollections, …})`
    - now → `onSendStatement({groupBy:'all', total: bulk.grandTotal, jobCount: <inline reduce over bulk.going 2177>, html/text via buildGcReviewShareAll*({ groups: bulk.going, grandTotal, held })})`, then the `gcBulkHeldSummary` toast for the held GCs (v2.5022)
  - **No $0 guard** on this path.
- **11a Standing copies (2201–2343, `isDev`):** per-recipient rows (Edit / Remove), and a form (person select *or* outside email, 7-day Mon…Sun toggles `[1,2,3,4,5,6,0]`, **unsorted** (2294), time, Add/Save, Cancel) → `submitStanding` → `planStandingCopyEdit` → `applyStandingPlan`.
- **Owned (moves with 11):** `shareAllOpen`\*, `shareAllTo`, `shareAllSubject`, `shareAllSending`, `shareAllError`, `shareAllWhen`, `shareAllSendDate`, `shareAllSendTime`, `shareAllRepeatWeekly` (\* the opener flag stays). **11a** owns the standing form states but shares `pendingSends` / `removeStanding` / `standingBusy` with region 6 (region 6's Cancel runs `removeStanding`, which reads `standingEditingEmail` and can call `resetStandingForm`), and `submitStanding` reads the view state (`includeCollections`, `byDevelopment`), so it goes through a hook.
- **Data:** `gc_statement_email_requests` insert. Standing: **`applyStandingPlan` 428–431 cancels (delete) first, then inserts, sequentially and unguarded.** A mid-loop failure leaves the recipient's chain partly or entirely cancelled. `removeStanding` swallows errors (480–483).
- **Tests:** `buildGcReviewShareAllEmailHtml/Text` + subject (in `gcStatementEmail.test`), `planStandingCopyEdit` / `groupStandingCopies` (10). **Untested:** the payload, `applyStandingPlan`'s order, `standingPickableUsers` (5-role cohort incl. `primary`).
- **Approach:** `GcReviewShareAllDialog` (#6) conditionally mounted, so the 8 non-flag states init on mount. 11a becomes `GcStandingCopiesSection` fed by `useGcScheduledSends` (#4).

### 12–15. Tail modals: extracted children

- **`GcReviewCertifyModal`** (167 lines, z 70; its bill lines, the job link and the activity dropdown are `GcBillLines`, shared with the call sheet): `group`, `weekStartYmd`, `authUserId/Name`. `onCertified({andSend})` → `refreshCerts` and optionally `openEmailDialogForGroup`. It writes `gc_review_certifications` via `insertGcReviewCertification` + `buildGcCertSnapshot` (tested). **No render test.**
- **Mark sent dialog** (2363–2395, inline host, z 64): header facts + `GcStatementMarkSentForm defaultChannel="text"` → `markRound`. Its backdrop is blocked while `roundBusy`. With `canFilePromises` the form is given the group's bills (`gcWordBills`) and `markRound` files the pay date on the jobs it returns (`addJobPaymentPromisesSettled`); `saveCallSheet` does the same for every bill of each answered GC.
- **`GcSenderRoundCard`** is retired (with `senderRoundQueue` and `latestGcStatementMarkBy`).
- **`GcStatementSendHistoryModal`** (116 lines, z 64): self-loading (`listGcStatementSentHistory`, `gcStatementSendHistoryIo`). **No render test.**

### M. `ScheduleWhenControls` (module scope, 100 lines)

- Presentational (no state of its own) "Send now | Schedule…" pill + date/time (Central) + Repeat weekly. On first switch to Schedule it seeds `sendDate = chicagoTomorrowYmd()` (v2.1429). It is used twice (1760, 2102). Its only coupling is props. **Untested.** A similar pill exists in `CrewDayEmailModal.tsx` (line 304) and `BilledReportShareModal.tsx` (line 316).
- **Approach:** move it to its own file first (#1), with a render smoke.

---

## Stage-A inventory

**Module scope:** `chicagoTomorrowYmd` (96–98) is pure and moves with `ScheduleWhenControls`.

**Kernels already extracted (tests counted by `it(`):**

| Kernel | Used for | Tests |
|---|---|---|
| [`lib/gcReviewRollup.ts`](../src/lib/gcReviewRollup.ts) (182) | `buildGcReviewRollup`: groups, subtotals, grand total, collections, development grouping | 9 |
| [`lib/jobs/gcStatementRounds.ts`](../src/lib/jobs/gcStatementRounds.ts) (248) | `GC_ROUND_THRESHOLD` (10000), `buildStatementRound`, `summarizeStatementRound`, `deriveGcAccountMen`, `mergeMarksIntoLastSent`, `describeRoundMark`, `sendChannelLabel` | 14 |
| [`lib/jobs/gcReviewCertification.ts`](../src/lib/jobs/gcReviewCertification.ts) (169) | `gcReviewWeekStartYmd`, `latestCertByGc`, `gcGroupCertStatus`, `gcReviewSentThisWeek`, `gcReviewWeekProgress` | 10 |
| [`lib/jobs/temperatureBoard.ts`](../src/lib/jobs/temperatureBoard.ts) (109) | `buildTemperatureBoard`, `latestTemperatureByGc`, `trailingWeekStarts` | 4 |
| [`lib/jobsDocuments/gcStatementEmail.ts`](../src/lib/jobsDocuments/gcStatementEmail.ts) (330) | the statement's row mapping onto `_shared/gcStatementByProperty.ts`, the payments block from a GC's checks (`gcStatementReceived`), the office's unmatched-payments note, share-all HTML/text, preview, subject | 18 |
| [`hooks/useGcStatementReceived.ts`](../src/hooks/useGcStatementReceived.ts) (41) | reads a GC's checks once as its row or Draft Message opens; a snapshot for Preview and Copy, a promise for Send | — |
| [`lib/gcStatementSendGuard.ts`](../src/lib/gcStatementSendGuard.ts) (53) | `gcStatementSendGuard`, `dollarsToCents` | 8 |
| [`lib/gcStatementCc.ts`](../src/lib/gcStatementCc.ts) (61) · [`lib/teammateEmailChips.ts`](../src/lib/teammateEmailChips.ts) (79) | CC parse/toggle, `GC_STATEMENT_CC_MAX`; chip lists, `gcEmailChip` | 6 · 8 |
| [`lib/gcStatementSchedule.ts`](../src/lib/gcStatementSchedule.ts) (90) · [`lib/gcStatementStandingCopies.ts`](../src/lib/gcStatementStandingCopies.ts) (169) | `buildGcStatementRequestInsert`, `describePendingGcStatementSend`; `groupStandingCopies`, `planStandingCopyEdit`, `formatWeekdays`, `chicagoYmdOf` | 7 · 10 |
| [`lib/statementRoundEmail.ts`](../src/lib/statementRoundEmail.ts) (136) · [`lib/emailSchedule/emailScheduleWeek.ts`](../src/lib/emailSchedule/emailScheduleWeek.ts) | round-email chains + edit plan; `addDaysYmd`, `formatMinutes`, `parseHhMm` | 6 · 20 |
| `lib/portal/gcPortalLink.ts` · `lib/emailWording.ts` · `lib/physicalInvoiceIssuer.ts` · `lib/jobs/jobFormMoney.ts` | portal caption; template wording; office phone; `formatCurrency` | 5 · 5 · 3 · 5 |
| IO: `gcStatementEmailRequests.ts` (47), `gcStatementRoundIo.ts` (106), `gcReviewCertifications.ts` (50), `statementRoundEmailClient.ts` (71), `hooks/useGcPortalLinks.ts` (50), `jobsDocuments/printWindow.ts` | Supabase reads/writes, edge preview/test | **none** (incl. the pure `canCancelStatementRequest`) |

**Still inline (Stage-A candidates):**

| Logic | Where | Target | Why |
|---|---|---|---|
| Round-mark upsert payload: `skipped` nulls channel/note/temperature/expectedPayBy, default channel `'email'` | `markRound` 591–601 | `buildRoundMarkUpsert(...)` in `gcStatementRounds.ts` | the data rule sits beside IO |
| **Statement send payloads**: per-GC (1853–1863), share-all (2168–2177: `total: grandTotal`, `jobCount` reduce), and the `{dateStr, groupBy, officePhone, portalUrl, introText}` bag built 4× (1786, 1860, 1861, 1945) | Draft Message, Share all, overlay | `buildGcStatementSendPayload` / `buildGcReviewShareAllPayload` in `gcStatementEmail.ts` | **what a GC is told they owe**: untested assembly |
| `dateStr` (`toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})`) | 687, 856, 1784, 1845, 1902, 2164 | `gcStatementDateStr(now)` | six copies |
| Current-GC pick `focused ?? readyForUser[0]` | 1898–1900 | `pickRoundCurrent(summary, focusGcId)` | overlay logic |
| `heldReason` cert-status → `'changed' \| 'uncertified' \| null` | 2405–2410 | `gcReviewCertification.ts` | the chip kernel needs it too |
| `thisWeekSentMark` | 611–614 | `gcStatementRounds.ts` | pure over `roundMarks` + `mergedLastSent` |
| Office recipient cohorts: 5 roles incl. `primary` + email (415–417); 4 roles + email (632–634); 4 roles, no email check (953–954) | 3 sites | `lib/officeRecipientCohorts.ts` | three subtly different lists (and `JobsWeeklyMovementModal` 75, `SettingsEmailStreamsSection` 333) |
| Email-shape regex | 713, 2131 | export `isEmailAddress` from `gcStatementCc.ts` (it already has `EMAIL_RE`) | also in `gcStatementSchedule` / `gcStatementStandingCopies` |
| UTC ymd → "Mon d" labels | 1199–1202, "pays by" in 1324–1348 | `emailScheduleWeek.ts` or `dateUtils` | two inline copies |
| Weekday toggle (sorted in round email 1127, unsorted in standing 2294) | 1127, 2294 | `toggleWeekday(list, dow)` | inconsistent order (harmless if the plans normalize; pin with a test) |

---

## Supabase surface (via lib IO)

- **Tables:**
  - `gc_statement_email_requests`: select pending, insert (schedule / standing), delete unsent (cancel)
  - `gc_statement_round_marks`: select this week + 6 weeks, upsert, delete
  - `customers`: `statement_sender_user_id` select/update
  - `gc_review_certifications`: select (insert lives in `GcReviewCertifyModal`)
  - `statement_round_email_requests`: select, insert, delete
  - `customer_portal_links` + `customer_portal_slugs`: select via `useGcPortalLinks`
  - `email_templates`: `resolveEmailWording`
  - `app_settings`: issuer
  - `gc_word_asks` + `gc_word_ask_answers`: select (embedded), update of an answer's decision; rpc `mint_gc_word_ask`, `revoke_gc_word_ask`; edge `gc-word-ask` (email mode) — all through `lib/gcWordAskIo.ts`
  - `jobs_ledger` (full detail select): `fetchJobWithDetailsById`, one read per job on the statement, five at a time, only when Print unpaid invoices runs (`lib/jobs/gcUnpaidInvoicePrintIo.ts`)
- **RPC (direct):** `mark_customer_portal_slug_shared` (569).
- **Edge functions:** `statement-round-email-dispatch` (preview, `test_send`). `send-gc-statement-email` is **invoked by the parent** through `onSendStatement`, by `lib/sendGcStatementEmail.ts` (v2.5099). The scheduled dispatcher (`gc-statement-email-dispatch`) rebuilds at send time and skips an entity (per-GC / per-development) statement with nothing outstanding (233–242); a whole-report row is never skipped for amount.
- **Parent-side read:** `gc_statement_emails` (last-sent hints).
- **No realtime channels.** Freshness is refetch-on-open (effects 340, 373, 380, 391, 516, 683 all gate on `open`) plus refetch-after-action: `refreshRoundMarks`, `refreshCerts`, `refreshPendingSends`, `refreshRoundEmailRows`, `refreshPortalLinks`, and the parent's `refreshGcLastSent` / `loadJobs`.

---

## Recommended extraction order

Per the playbook, Stage A comes before Stage B for each unit, and the lowest coupling goes first. Run `npm run typecheck && npm run lint && npm test` at every step, and make only behaviour-preserving changes. **Done so far:** 16 kernels in `lib/` (above), 5 extracted children (`GcTemperatureBoard`, `GcReviewCertifyModal`, `GcStatementMarkSentForm`, `GcWorklistPanel`, `GcStatementSendHistoryModal`), and the round's data hook (#8, v2.5072).

| # | Unit | Lines out (approx.) | Coupling | Risk |
|---|---|---|---|---|
| 1 | `ScheduleWhenControls` + `chicagoTomorrowYmd` → `src/components/jobs/GcScheduleWhenControls.tsx` + render smoke | ~105 | props only | low |
| 2 | **Stage A, small kernels:** `buildRoundMarkUpsert`, `heldReason`, `thisWeekSentMark`, `pickRoundCurrent`, office cohorts, `isEmailAddress`, `gcStatementDateStr`, a ymd label; tests | ~90 | pure | low |
| 3 | **Stage A, send payloads:** `buildGcStatementSendPayload` + `buildGcReviewShareAllPayload` (+ the docs option bag); tests pin `total`, `jobCount`, subject fallback, portal toggle, `ccEmails` | ~50 | pure | med (money-adjacent) |
| 4 | `useGcScheduledSends(open, ctx)` (330, 384–485: `pendingSends` + 7 standing states + handlers) → `GcScheduledSendsPanel` (1207–1267) + `GcStandingCopiesSection` (2201–2343). Keep the cancel-then-insert order and add a `// TODO` at the seam | ~110 + 61 + 143 | hook owns 8 states | low-med |
| 5 | `useStatementRoundEmail()` (362–375, 630–669: 8 states) → `GcRoundEmailSection` (1054–1193); `GcSenderRoundCard.onSetupEmail` calls the hook's `openFor` | ~55 + 140 | 8 states; 1 cross-region opener | low-med |
| 6 | `GcReviewShareAllDialog` (2034–2200), conditionally mounted; its 8 non-flag states init on mount (replaces the opener reset 850–861) | ~170 | `rollup`, `includeCollections`, `onSendStatement`, `refreshPendingSends` | med-high |
| 7 | `GcDraftMessageDialog` (1652–1895 + 686–716), conditionally mounted on `emailDialogGroup`; 11 states move; `onSent(group)` → parent auto-mark; `emailReplyToUserId` moves with it | ~275 | 13 reads today → ~8 props + 3 callbacks | **high** |
| 8 | **Shipped v2.5072: [`useGcStatementRound({ open, certWeekStart, roundGcIds })`](../src/hooks/useGcStatementRound.ts)** holds the data: certs and whether they were read, marks, board marks, senders, the 2 refreshers and `reloadSenders`, and the 3 open-gated effects, moved verbatim. The derived memos and the writes (`markRound` / `undoRoundMark` / `assignSender`, `roundBusy` / `roundError`) stay in the window by decision: the Stages board derives different cards from the same data, and the writes need the window's name, toasts and word promises. The Stages board reads through it too (v2.5075, the Stages map's step 4); `usePipelineMoneyOpportunities` is next | ~50 | read by 8 regions | med-high |
| 9 | `GcStatementRoundsCard` (900–1053) + `GcRoundOverlay` (1896–2033) + `GcMarkSentDialog` (2363–2395), all on the #8 hook | ~155 + 138 + 33 | pointer setters as callbacks | med |
| 10 | `GcReviewGroupSection` (1271–1635) with a callbacks bag; `shareMenuGroupKey` stays in the parent (one menu open) | ~365 | ~15 props | med |

**End state:** a shell of about 600–700 lines. **It stays in the shell permanently:** props/overlay/close, `useBodyScrollLock`, the view state + both rollups, the selection pointers (table above), the round↔dialog effect 549–556 and the deep-link effect 543–548, `useGcPortalLinks` + `copyPortalLink`, the issuer-cache effect, and the tail-modal wiring.

---

## Hazards

1. **Money-adjacent sends.**
   - The modal writes no ledger money, but it **emails outside GCs dollar totals** (`total: g.subtotal`, share-all `total: rollup.grandTotal`) from payloads assembled inline and untested (1853–1863, 2168–2177).
   - The $0 guard (`gcStatementSendGuard`) covers **only Draft Message send-now**. Share all has no amount guard. Scheduled per-GC sends rely on the dispatcher's nothing-outstanding skip; a scheduled whole report (Share all, standing copies) has none.
   - The displayed rollup math is tested (`gcReviewRollup`, 9). Keep the grand total coming from the kernel so it reconciles with the Billed section header.
2. **Certification basis must stay on `roundRollup`** (active-only, by GC; 500–511). Reading `rollup` instead would flip certified GCs to "changed since certified" whenever Include Collections toggles (the v2.2764 rationale at 504–510).
3. **Auto-mark on app send** (1870–1873). It reads `roundItems` from the send closure. Any dialog extraction must still call the parent's `markRound`, or rounds stop reflecting app sends.
4. **Effects whose deps make moves risky:**
   - (The dialog ↔ round-overlay bounce went with the overlay.)
   - 543–548 re-fires on `[open, startInRound, startInRoundGcId]`.
   - The senders effect 516–525 keys on the `roundGcIds` memo identity, which comes from `roundRollup`, which re-derives when the parent's rows change (e.g. after `onOpenJob` → `loadJobs`).
   - The loader effects (340, 373, 380, 391, 516) are gated on `open`, and there is **no cancellation** in `refreshCerts` / `refreshRoundMarks` (moved verbatim into `useGcStatementRound`) or `refreshRoundEmailRows`; only the pending-sends effect and the hook's senders effect carry a `cancelled` flag.
5. **Mounted while closed.** State survives close and reopen (see structural note 2). Conditionally mounting the extracted dialogs (#6, #7) changes *when* their fields reset. Only the reset-on-open behaviour needs to be kept, and the openers already do that.
6. **Stale round focus (parent, code read).** `JobsStagesTab` never clears `gcReviewRoundGcId` (set only at 1371). A later **Start round** from the Stages round card re-focuses the old deep-linked GC if it is still ready.
7. **Non-transactional multi-writes:**
   - `applyStandingPlan` (428–431) deletes, then inserts, sequentially, so a failure can drop a recipient's standing chain. `removeStanding` swallows the error.
   - `applyStatementRoundChainPlan` does the opposite (inserts, then deletes).
   - Preserve both orders when moving; fixing them is a separate behavioural PR.
8. **RLS / role gates:**
   - `canCertify` (dev · master_technician · assistant · controller) matches the insert/update/delete policies on `gc_statement_round_marks` and the insert policy on `gc_review_certifications` (it has no update/delete policy; migration `20260821190000`). `primary` can read both but not write.
   - The round overlay's Sent it / Skip and **Start round are not `canCertify`-gated**, so RLS is the wall (error via `roundError`).
   - Standing copies are `isDev` UI-only. The insert policy admits dev, assistant-like roles, master_technician and primary with `requested_by = auth.uid()`, so the dev-only rule is not enforced server-side.
   - Cancel is enforced by RLS ("own unsent OR is_dev"), mirrored client-side by the untested `canCancelStatementRequest`.
   - The assign-sender select lists 4 roles with no email check; the standing picker adds `primary`.
9. **Side effect on Copy portal link.** `mark_customer_portal_slug_shared` permanently locks the short address on first share (569). Keep it before the clipboard write.
10. **Portal staleness.** `CustomerPortalGlobeButton` takes only `customerId` / `customerName` / `size` (no change callback). A link minted in the globe modal does not show in the Share menu or Draft Message until GC Review is closed and reopened. This is from a code read, not verified in the browser.
11. **URL deep links are parent-owned:** `?gcReview=1` and `?round=1[&gc=<id>]` (the `JobsStagesTab` consume-once effects 1326–1335, 1366–1378; the producers are the Dashboard banner / pinned row and the `statement-round-email-dispatch` email). The modal only sees `startInRound` / `startInRoundGcId`.
12. **The z-ladder collides at 64.** The round overlay, Mark sent dialog and `GcStatementSendHistoryModal` all use 64 and are mutually exclusive only by flow. The Certify modal is at 70, Edit Job (via `onOpenJob`) at 1010, and the globe modal at 1300. **No Escape handling** exists in the modal or any inline overlay, except the email preview (z 66), whose Escape closes the preview alone.
13. **Popup-blocker paths.** The two email previews open in the app (`EmailPreviewOverlay`) and open no window. The print paths still do: the call sheet (`openHtmlPrintWindow`) toasts here when blocked, and the statement print toasts in the parent.
14. **Cross-surface duplication.**
    - The round engine (certs + marks + senders) is loaded independently here (through `useGcStatementRound` since v2.5072), on the Stages board (the same hook since v2.5075, reading while the window is shut) and in `usePipelineMoneyOpportunities`. They share no cache, and a mark made here refreshes only this copy; the Stages board re-reads when the window closes.
    - The GC Review transport (`onSendStatement` edge invoke) moved from `JobsStagesTab` to [`lib/sendGcStatementEmail.ts`](../src/lib/sendGcStatementEmail.ts) in v2.5099 (the Stages map's step 7; 9 tests, and two tab render cases that send through this window). The payload type `SendGcStatementPayload` stays exported here.
