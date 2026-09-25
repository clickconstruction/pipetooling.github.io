# GC Review Modal Architecture Map

---
file: docs/GC_REVIEW_MODAL_ARCHITECTURE.md
type: Engineering / Refactor Map
purpose: Step-0 map for the JobsGcReviewModal.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md, adapted from tabs to modal regions and stacked overlays). It inventories what every region of GC Review touches (state, handlers, data via lib IO, child components, coupling, test coverage): the per-GC Billed Awaiting Payment rollup, Wednesday certification, weekly statement rounds, the temperature board, scheduled and standing sends, and the Draft Message and Share all send dialogs. It drives the extraction order.
covers:
  - src/components/jobs/JobsGcReviewModal.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
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
- read **Billed Awaiting Payment grouped by GC/Builder** (or by Development) with bill-out dates and ages
- **certify** each GC's group on Wednesdays
- run the **weekly statement round**: a personal email for each GC over $10k, from an assigned sender, marked "Sent it" or "Spoke with them"
- watch the **temperature board**
- manage **scheduled and standing statement emails**
- send any GC's statement through **Draft Message** (app email, send now or scheduled), **Copy**, **Print** or the **portal link**
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
| `onSendStatement(payload)` | **inline edge invoke `send-gc-statement-email`** (4259–4288) → toast + `refreshGcLastSent` | the modal builds the payload, and the parent is the transport |
| `onPrint(groups, groupBy)` | `buildGcStatementReportHtml` → `openHtmlPrintWindow` | |
| `onCopyForEmail(group, groupBy, {portalUrl})` | subject + `buildGcStatementEmailHtml/Text` → `copyRichHtmlToClipboard` | `groupBy` is ignored by the parent (`_groupBy`) |
| `emailForGc(gcId)` | `extractContactFromCustomer(customer).email` | To prefill + GC chip |
| `users` | office roster | three role-filtered cohorts built inline (Stage A) |
| `isDev` | `authRole === 'dev'` | gates Standing copies only |
| `canCertify` | `stagesGates.isStagesOfficeRole(authRole)`: dev · master_technician · assistant · controller | gates certify, assign, Mark sent, round-email edits for others |
| `onOpenJob?` | `tryOpenEditJob(jobId, { onSaved: loadJobs + refreshCustomers… })` | Edit Job (z 1010) stacks over GC Review (z 60), and the refetch re-derives the rollup in place |
| `onOpenJobDetail?` | `jobDetailModal.openJobDetail` | passed through to `GcReviewCertifyModal` |
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
| Round overlay (`roundOpen`) | 1896–2033 | 138 |
| `ScheduleWhenControls` (module scope) | 101–200 | 100 |

### Key structural differences from the page maps

1. **One scrolling panel plus eight stacked overlays (five of them inline).** The main panel (z 60) holds every inline region. The Draft Message and Share all dialogs (z 61), the Share menu (backdrop 62 / menu 63), the round overlay and Mark sent dialog (z 64) are **inline JSX**. `GcSenderRoundCard` (64), `GcStatementSendHistoryModal` (64) and `GcReviewCertifyModal` (70) are extracted. Nothing handles Escape.
2. **It stays mounted while closed.** The parent renders it unconditionally, and `return null` sits after the hooks, so **all 56 states survive close and reopen** while the Stages tab stays active: `groupBy`, `includeCollections`, a half-typed standing form, `roundStartTotal`. They reset only when the Stages tab goes inactive (the parent's `{active && …}` block unmounts the modal) or unmounts. The `open`-gated effects refetch on every open.
3. **Two rollups over the same rows.** `rollup` (492–495) is what the panel shows, following the Group-by pill and Include Collections. `roundRollup` (500–503) is always **by GC and active-only**, and it feeds certification, rounds, the temperature board and the week strip (comment 504–510, v2.2764).
4. **The parent owns transport, print and copy.** The modal owns scheduling (`gc_statement_email_requests`), round marks, certifications (in the child), sender assignment and the round-email chains.

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
| 0 | Shell: overlay + panel | `role="dialog"` 731–759; `if (!open) return null` 717; `useBodyScrollLock(open)` 339 | 30 | backdrop → `onClose` | none | low | shell |
| 1 | Header + Group-by pill | 760–807; pill `anyDevelopment ?` 765–791; `groupByPillStyle` 719–729 | 48 | 0 · 1 (`groupBy`) · 1 | none | low | inline |
| 2 | Wednesday strip | `!byDevelopment && certProgress.gcs > 0` 808–834 | 27 | `certProgress` 557 | `gcReviewWeekProgress` ✓ | low | inline |
| 3 | Toolbar: Include Collections · Share all · Print all | 835–897 (Share all opener 846–896) | 63 | 0 · 6 (`shareAll*` reset) · 0 | none | low | inline |
| 4 | Weekly statement rounds card | `!byDevelopment && roundItems.length > 0` 900–1195 | 296 | 10 · 9 · 7 | kernels ✓; chip mapping ✗ | **med-high** | inline |
| 4a | ↳ Round rows: sender, assign, chip | `roundItems.map` 937–1046 (assign 944–970, chip 972–1044) | 110 | `assigningGcId`, `boardRowByGc` | ✗ (inline chip state machine) | med | inline |
| 4b | ↳ Round email | `authUser?.id` 1054–1193 | 140 | 7 · 5 · 4 | `statementRoundEmail` ✓; client ✗ | med | inline |
| 5 | Temperature board | `<GcTemperatureBoard>` 1196–1206 | 11 | `boardRows`, `boardWeeks`, `setHistoryGc` | kernel ✓; component ✗ | low | **extracted** |
| 6 | Scheduled statement sends | `pendingSends.length > 0` 1207–1267 | 61 | 2 · 0 · 7 | `gcStatementStandingCopies` ✓, `gcStatementSchedule` ✓; `canCancelStatementRequest` ✗ | med | inline |
| 7 | GC groups list | `rollup.groups.map` 1268–1636 | 369 | 1 · 4 · 5 · children `EntityIcon`, `CustomerPortalGlobeButton` | `gcReviewRollup` ✓ | med | inline |
| 7a | ↳ Pills: last-sent · temperature · cert | 1299–1323 · 1324–1348 · 1349–1375 | 77 | `historyGc` | `gcReviewCertification` ✓ | low | inline |
| 7b | ↳ Actions: Certify + Share menu | `!g.isNoGc` 1376–1551 (menu 1430–1528) | 176 | `shareMenuGroupKey`, `certifyGroup`, `markSentGroup` | ✗ | med | inline |
| 7c | ↳ Job table | 1559–1633 (job link → `onOpenJob` 1591–1616) | 75 | — | ✗ | low | inline |
| 8 | Grand total line | 1637–1650 | 14 | `rollup.grandTotal` | `gcReviewRollup` ✓ | low | inline |
| 9 | **Draft Message dialog** | `emailDialogGroup ?` 1652–1895 + `openEmailDialogForGroup` 686–707 + `emailSendGuard` 709–716 | 244 + 31 | 13 · 11 · 3 · children `TeammateEmailChips`, `ScheduleWhenControls` | builders/guard/CC ✓; **payload assembly ✗** | **high** | inline |
| 10 | Round overlay | `roundOpen ?` IIFE 1896–2033 | 138 | 7 · 4 · 3 · child `GcStatementMarkSentForm` | form render ✓ (2); overlay ✗ | med | inline |
| 11 | Share all dialog | `shareAllOpen ?` 2034–2346 (Email once 2080–2200) | 170 | 17 · 13 · 7 (whole block, incl. 11a) | builders ✓; payload ✗ | **med-high** | inline |
| 11a | ↳ Standing copies (dev) | `isDev ?` 2201–2343 + handlers 415–485 | 143 + 71 | 7 · 4 · 6 | `planStandingCopyEdit` ✓; `applyStandingPlan` ✗ | med | inline |
| 12 | Certify modal | `<GcReviewCertifyModal>` 2347–2362 | 16 | `certifyGroup` | ✗ | low | **extracted** (241) |
| 13 | Mark sent dialog | `markSentGroup && …` 2363–2395 | 33 | 3 · 1 · 1 · `GcStatementMarkSentForm` | form ✓ | low | inline host |
| 14 | Sender card | `<GcSenderRoundCard>` IIFE 2396–2436 | 41 | 2 · 3 · 2 | ✗ | low | **extracted** (204) |
| 15 | Send history | `<GcStatementSendHistoryModal>` 2437–2439 | 3 | `historyGc` | ✗ | low | **extracted** (116) |
| M | `ScheduleWhenControls` | module 101–200 (render 133–199; `pill` 122–132) | 100 | props only | ✗ | low | inline (module scope) |

### Shell logic regions (non-render)

| Region | Symbols (lines) | Writes | Data (via lib) | Tests | Next action |
|---|---|---|---|---|---|
| View state + rollups | `includeCollections` 294, `groupBy` 295, `anyDevelopment` 486–489, `effectiveGroupBy`/`byDevelopment` 490–491, `rollup` 492–495, `roundRollup` 500–503 | — | — | `gcReviewRollup` 9 | **stays** |
| Certification loader | `certWeekStart` 332, `certRows` 333, `refreshCerts` 335–337, effect 340–342, `certsByGc` 497, `certGroupByGc` 511, `certProgress` 557 | `certRows` | `gc_review_certifications` (select) | `gcReviewCertification` 10; IO ✗ | → `useGcStatementRound` (#8) |
| Round engine | `roundMarks`/`boardMarks`/`roundSenders` 344–347, `refreshRoundMarks` 376–379, effect 380–382, senders effect 516–525, `roundGcIds` 512–515, `accountMen` 526, `mergedLastSent` 527, `roundItems` 528–531, `roundSummary` 532, `boardWeeks` 534, `boardRows` 535–538, `boardRowByGc` 539, `temperatureByGc` 540 | 3 data states | `gc_statement_round_marks` (select ×2), `customers.statement_sender_user_id` (select) | `gcStatementRounds` 14, `temperatureBoard` 4; IO ✗ | → `useGcStatementRound` (#8) |
| Round writes | `markRound` 581–609, `undoRoundMark` 619–629, `assignSender` 670–680, `thisWeekSentMark` 611–614, `markWhenLabel` 615–618, `userNameById` 579, `authUserName` 578 | `roundBusy`, `roundError`, `roundSenders`, `assigningGcId` | `gc_statement_round_marks` upsert/delete; `customers` update | ✗ (upsert payload rule 597–600 inline) | Stage A (#2), then the hook (#8) |
| Round deep link | `roundFocusGcId` 542, effect 543–548; round↔dialog effect 549–556 | `roundOpen`, `roundFocusGcId`, `emailFromRoundGcId` | — | ✗ | **stays** (pointer plumbing) |
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
| `emailFromRoundGcId` | 360 | overlay 1965 | effect 549–556 (reopens the overlay when the dialog closes) |
| `roundOpen` | 348 | Start round 924–935; effect 543; effect 549; overlay close 1909/2022 | overlay 1896 |
| `certifyGroup` | 334 | Certify / Re-certify 1387, 1399 | `GcReviewCertifyModal` 2347 |
| `markSentGroup` | 355 | Share → Mark sent… 1489 | dialog 2363 |
| `historyGc` | 356 | last-sent pill 1310; temperature pill 1334; `GcTemperatureBoard.onOpenGc` 1204 | `GcStatementSendHistoryModal` 2437 |
| `senderCard` | 358 | sender tally 915; round chip 996 | `GcSenderRoundCard` 2396 |
| `assigningGcId` | 352 | assign link 964; chip 993; `GcSenderRoundCard.onAssign` 2430 | select 944–970 |
| `shareMenuGroupKey` | 319 | Share button 1412 | one menu open at a time across all groups |

**Data engine: the statement round.** `certRows` + `roundMarks` + `boardMarks` + `roundSenders` (4 states, 2 refreshers `refreshCerts` / `refreshRoundMarks`, 3 open-gated effects 340 / 380 / 516), derived over `roundRollup` into `roundItems` / `roundSummary` / `boardRows` / `temperatureByGc` / `mergedLastSent` / `certProgress`, and read by regions 2, 4, 5, 7a, 7b, 10, 13 and 14. **`markRound` 581–609 is the single write path** for the overlay (1986 Skip, 1999 Sent it), the Mark sent dialog (2386) and the **Draft Message auto-mark** (1870–1873). This engine is **triplicated across surfaces** (see [Hazards](#hazards)), so it is the hook seam to build (#8).

**Secondary substrate:** `pendingSends` feeds both the Scheduled sends panel (6) and Standing copies (11a). `removeStanding` and `standingBusy` are used by both. It is refreshed by the Draft Message schedule (1836), the Share all schedule (2155) and the standing handlers.

---

## Per-region dossiers

### 0. Shell: overlay + panel

- **Render:** 731–759. Fixed overlay `zIndex: 60`, panel `maxWidth: 720`, `maxHeight: 85vh`, own scroll. Backdrop click → `onClose` (744–746).
- **Owns permanently:** props, `useAuth`, `useToastContext`, `useBodyScrollLock(open)` (v2.2144), `useGcPortalLinks`, the view state + rollups, the pointers above, the z-ladder (60 / 61 / 62–63 / 64 / 70), and the tail modal wiring.
- **Tests:** no render test mounts `JobsGcReviewModal`, and no e2e spec opens it (`git grep` over `*.test.*` and `e2e/`: 0 hits).

### 1–3. Header, Wednesday strip, toolbar

- **Header (760–807):** `EntityIcon` (`DevelopmentHouseIcon` / `GcHardHatIcon`, 718), a By GC / By Development pill (only when `anyDevelopment`), ✕, and a subtitle.
- **Strip (808–834):** "N of M certified · K sent", a green bar `Math.round(certified/gcs*100)`, and only under By GC.
- **Toolbar (835–897):** Include Collections checkbox with `rollup.collectionsCount` / `collectionsTotal` (844). Share all (848–877) resets 6 `shareAll*` states and seeds the subject via `gcReviewShareAllEmailSubject`. Print all → `onPrint(rollup.groups, effectiveGroupBy)`.
- **State:** it owns none (`groupBy`, `includeCollections` and the `shareAll*` openers are shared).
- **Approach:** after #6 the Share all opener collapses to `setShareAllOpen(true)`. That is the dialog's mount-init, and it is what lets regions 1–3 become one presentational `GcReviewHeader` (~140 lines) with no owned state. It is optional and low value.

### 4. Weekly statement rounds card (inline, 296 lines)

- **Render:** 900–1195. Header with a per-sender tally (908–922 → `setSenderCard`) and **Start round (N)** (924–935: `roundStartTotal`, `roundOpen`). Rows (937–1046):
  - The GC name, `$amount` and sender.
  - The **assign** select (944–970) lists 4 roles and has no email check. It calls `assignSender` and is gated by `canCertify`.
  - The **state chip** (972–1044) has a click rule:
    - `needs_sender` or no sender → undo the mark, or open assign (canCertify only).
    - Anything else → the sender card.
  - The chip's **colour, background and label are a nested ternary over 6 states**, plus the `contactedOnlyWeeks >= 2` warning from `boardRowByGc`.
  - A footnote and `roundError`.
- **4b Round email (1054–1193):** your chain line (`formatWeekdays` / `formatMinutes(parseHhMm)`), others' chains with **edit** (canCertify), "Set it up for another sender…" select, and the form (1108–1190): Mon–Fri toggles (sorted), time, **Preview** (`fetchStatementRoundEmailPreview` → `openHtmlPreviewWindow`), **Email me a test**, Stop emailing (`saveRoundEmail([])`), Cancel, Save.
- **Owned (moves with it):** `assigningGcId`*, `roundStartTotal`*, and the 7 round-email form states. The asterisked two cross regions (`assigningGcId` is also written by `GcSenderRoundCard.onAssign` 2430; `roundStartTotal` is read by the overlay 1920), so they go to the parent or into a hook.
- **Shared (stays or goes to the hook):** `roundItems`, `roundSummary`, `roundBusy`, `roundError`, `boardRowByGc`, `senderCard`, `roundOpen`.
- **Handlers:** `userNameById`, `assignSender`, `markWhenLabel`, `undoRoundMark`, `openRoundEmailForm`, `saveRoundEmail`, `describeRoundMark`/`sendChannelLabel` (kernel).
- **Data:** `customers.statement_sender_user_id` update (`setGcStatementSender`), then a senders re-read; `gc_statement_round_marks` delete (undo); `statement_round_email_requests` (`applyStatementRoundChainPlan`: **inserts, then deletes** unsent); edge `statement-round-email-dispatch` (preview / `test_send`).
- **Tests:** `buildStatementRound` / `summarizeStatementRound` / `describeRoundMark` (14), `groupStatementRoundChains` / `planStatementRoundChainEdit` (6), `emailScheduleWeek` (20). **Untested:** the chip state→presentation mapping, the chip click rule, `statementRoundEmailClient`, `gcStatementRoundIo`.
- **Approach:** Stage A the chip (#2). `useStatementRoundEmail` (#5) → `GcRoundEmailSection`. After `useGcStatementRound` (#8) → `GcStatementRoundsCard`.

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

### 7. GC groups list (inline, 369 lines)

- **Render:** 1268–1636, one card per `rollup.groups` entry (1271–1635), or "No billed jobs awaiting payment." Header row:
  - Name plus `CustomerPortalGlobeButton` (1293–1298, By GC only).
  - **7a pills:**
    - last-sent 1299–1323: `thisWeekSentMark`, `gcReviewSentThisWeek`, → `historyGc`
    - temperature + "pays by" 1324–1348: `TEMP_PILL`, **inline UTC ymd parse**
    - cert 1349–1375: `gcGroupCertStatus` → Certified or "Changed since certified · ±$delta"
  - **7b actions (1376–1551):**
    - Certify / Re-certify (canCertify, on `certGroupByGc`)
    - the Share menu (1409–1529): Draft Message, Copy (`onCopyForEmail`), Print, **Mark sent / spoke with them…** (canCertify), and Portal → `copyPortalLink` or the "No portal link yet" hint
    - else (`g.isNoGc`: the no-GC / no-development group) a print-only icon (1532–1550)
  - A stats line: jobs · `$subtotal` · oldest d (1554–1557).
  - **7c table:** customer (+ Collections badge), job (`onOpenJob` link when provided), billed-on, days, remaining.
- **Owned:** `shareMenuGroupKey`. It is one-at-a-time across groups, so it stays in the parent unless the menu becomes per-card local state (a behaviour change, since two menus could be open).
- **Shared:** `byDevelopment`, `effectiveGroupBy`, `certGroupByGc`, `certsByGc`, `mergedLastSent`, `temperatureByGc`, `boardRowByGc`, `portalLinkFor`, and the 4 pointer setters.
- **Data:** read-only except `copyPortalLink` → **rpc `mark_customer_portal_slug_shared`** (locks the short slug on first share), then `refreshPortalLinks`.
- **Tests:** `buildGcReviewRollup` (9: totals, collections, development grouping), `gcGroupCertStatus` / `gcReviewSentThisWeek` (10), `gcPortalLinkCaption` (5), `CustomerPortalGlobeButton.render` (5). **The card itself is untested.**
- **Approach:** `GcReviewGroupSection` (#10) with a callbacks bag. Take the pill IIFEs through small presentational helpers first.

### 9. Draft Message dialog (inline, 244 + 31 lines; money-adjacent send)

- **Render:** 1652–1895 (z 61; backdrop closes unless sending).
  - To: `TeammateEmailChips` with the GC chip leading via `gcEmailChip`, then an input.
  - CC: teammate chips toggle through `ccTextIncludes` / `toggleCcEmailInText`, then an input with `parseCcEmails` feedback. **`parseCcEmails` is called 3× per render** (1725 ×2, 1728).
  - Subject (locked when scheduled).
  - An include-portal checkbox (only when `portalLinkFor(g)`).
  - `ScheduleWhenControls`, the error, and the **send-guard status** (1775).
  - Preview: `buildGcStatementEmailPreviewHtml` → `openHtmlPreviewWindow`.
  - Cancel.
  - **Send (1802–1891):**
    - schedule branch 1808–1844: CC validate → `buildGcStatementRequestInsert` → `scheduleGcStatementSend` → `refreshPendingSends`
    - send-now branch 1845–1877: CC validate → `onSendStatement({gcCustomerId, gcName, groupBy, toEmail, ccEmails, subject, emailHtml, emailText, total: g.subtotal, jobCount})`; on ok → close, and **if the GC is in the round and not yet `sent` → `markRound(gcId,'sent',{channel:'email', note:'Sent from the app'})`**
- **Opener:** `openEmailDialogForGroup` 686–707 resets 9 states and fires `resolveEmailWording('gc_statement_scheduled', …)`. The template subject replaces the default **only while untouched** (705), and there is no cancel guard.
- **Owned (move with it):** `emailDialogTo`, `emailDialogCcText`, `emailDialogSubject`, `emailSending`, `emailError`, `emailIncludePortal`, `emailIntroText`, `emailWhen`, `emailSendDate`, `emailSendTime`, `emailRepeatWeekly` (11). **Stays:** `emailDialogGroup`, `emailFromRoundGcId`.
- **Guard:** `emailSendGuard` = `gcStatementSendGuard({ totalOwedCents: dollarsToCents(subtotal), emailSending, hasAddress: <inline regex 713>, scheduled })`. It blocks a **$0 send-now** (the dispatcher's own skip) and leaves scheduling on $0 allowed.
- **Data:** `gc_statement_email_requests` insert (schedule). Send-now goes through the parent → edge `send-gc-statement-email`. `email_templates` (wording). The issuer phone is read **synchronously at click** (`getPhysicalInvoiceIssuerForDocument()`).
- **Tests:** `gcStatementEmail` (14: html/text/preview/subject), `gcStatementSendGuard` (8), `gcStatementCc` (6), `teammateEmailChips` (8), `emailWording` (5), `gcStatementSchedule` (7). **Untested:** the payload assembly (1853–1863: which total, which subject fallback, portal on/off), the auto-mark rule, and the `TeammateEmailChips` component.
- **Risk:** **high.** It emails an outside GC a dollar total under the company name, and it writes a round mark as a side effect.
- **Approach:** Stage A the payload builder first (#3). Then `GcDraftMessageDialog` (#7), conditionally mounted so the 11 states init from `group` (this replaces the reset in `openEmailDialogForGroup`), with `onSent(group)` doing the auto-mark in the parent.

### 10. Round overlay (inline, 138 lines)

- **Render:** 1896–2033 (z 64; backdrop closes). `current` = `roundFocusGcId` match in `readyForUser`, else `readyForUser[0]` (1898–1900); `remaining` and "N sent" are relative to `roundStartTotal`. The body shows To (`emailForGc`), Last sent, and these actions:
  - Preview statement (1940–1952)
  - **Copy for email** → `onCopyForEmail(current.group,'gc',…)`
  - **Send from the app…** → `setEmailFromRoundGcId` + close + `openEmailDialogForGroup`
  - **Sent it ✓** → inline `GcStatementMarkSentForm` (1992–2006) → `markRound(...m)`
  - **Skip** → `markRound(gcId,'skipped')`

  When the round is done it shows "Round done 🎉" (2014–2027).
- **Owned:** `roundSentFormOpen`. **Shared:** `roundOpen`, `roundFocusGcId`, `emailFromRoundGcId` (set at 1965), `roundStartTotal`, `roundBusy`, `roundError`, `certRows` (it recomputes `latestCertByGc(certRows)` at 1901; `certsByGc` already holds it), `mergedLastSent`, `portalLinkFor`.
- **Gate gap:** Sent it / Skip / Start round are **not** `canCertify`-gated, so RLS on `gc_statement_round_marks` (4 office roles; primary reads only) is the wall, surfaced through `roundError`.
- **Tests:** `GcStatementMarkSentForm.render` (2). The overlay itself is untested.
- **Approach:** `GcRoundOverlay` after #8, together with the Mark sent dialog (13): both host `GcStatementMarkSentForm` and call `markRound`.

### 11. Share all dialog (inline, 170 + 143 lines)

- **Render:** 2034–2346 (z 61). Summary line, then **Print / save as PDF** (`onPrint`), then **Email once** (2080–2200):
  - To chips and input, Subject (locked when scheduled), `ScheduleWhenControls`, an explainer, the error.
  - **Send (2129–2198):**
    - disabled by an **inline email regex** (2131)
    - schedule → `buildGcStatementRequestInsert({entityId: null, entityName: 'All GCs'|'All developments', includeCollections, …})`
    - now → `onSendStatement({groupBy:'all', total: rollup.grandTotal, jobCount: <inline reduce 2177>, html/text via buildGcReviewShareAll*})`
  - **No $0 guard** on this path.
- **11a Standing copies (2201–2343, `isDev`):** per-recipient rows (Edit / Remove), and a form (person select *or* outside email, 7-day Mon…Sun toggles `[1,2,3,4,5,6,0]`, **unsorted** (2294), time, Add/Save, Cancel) → `submitStanding` → `planStandingCopyEdit` → `applyStandingPlan`.
- **Owned (moves with 11):** `shareAllOpen`\*, `shareAllTo`, `shareAllSubject`, `shareAllSending`, `shareAllError`, `shareAllWhen`, `shareAllSendDate`, `shareAllSendTime`, `shareAllRepeatWeekly` (\* the opener flag stays). **11a** owns the standing form states but shares `pendingSends` / `removeStanding` / `standingBusy` with region 6 (region 6's Cancel runs `removeStanding`, which reads `standingEditingEmail` and can call `resetStandingForm`), and `submitStanding` reads the view state (`includeCollections`, `byDevelopment`), so it goes through a hook.
- **Data:** `gc_statement_email_requests` insert. Standing: **`applyStandingPlan` 428–431 cancels (delete) first, then inserts, sequentially and unguarded.** A mid-loop failure leaves the recipient's chain partly or entirely cancelled. `removeStanding` swallows errors (480–483).
- **Tests:** `buildGcReviewShareAllEmailHtml/Text` + subject (in `gcStatementEmail.test`), `planStandingCopyEdit` / `groupStandingCopies` (10). **Untested:** the payload, `applyStandingPlan`'s order, `standingPickableUsers` (5-role cohort incl. `primary`).
- **Approach:** `GcReviewShareAllDialog` (#6) conditionally mounted, so the 8 non-flag states init on mount. 11a becomes `GcStandingCopiesSection` fed by `useGcScheduledSends` (#4).

### 12–15. Tail modals: extracted children

- **`GcReviewCertifyModal`** (241 lines, z 70): `group`, `weekStartYmd`, `authUserId/Name`. `onCertified({andSend})` → `refreshCerts` and optionally `openEmailDialogForGroup`. It writes `gc_review_certifications` via `insertGcReviewCertification` + `buildGcCertSnapshot` (tested). **No render test.**
- **Mark sent dialog** (2363–2395, inline host, z 64): header facts + `GcStatementMarkSentForm defaultChannel="text"` → `markRound`. Its backdrop is blocked while `roundBusy`.
- **`GcSenderRoundCard`** (204 lines, z 64): `items={roundItems}`, `chain`, `heldReason` (**inline cert→reason mapping 2405–2410**), `canAct={canCertify}`, and 4 callbacks: preview → edge function, setup → `openRoundEmailForm`, assign → `setAssigningGcId`, undo → `undoRoundMark`. It self-loads `latestGcStatementMarkBy`. **No render test.** Its own `stateLabel` (59–73) re-labels the same 6 states as region 4a.
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
| [`lib/jobsDocuments/gcStatementEmail.ts`](../src/lib/jobsDocuments/gcStatementEmail.ts) (302) | statement + share-all HTML/text/preview/subject | 14 |
| [`lib/gcStatementSendGuard.ts`](../src/lib/gcStatementSendGuard.ts) (53) | `gcStatementSendGuard`, `dollarsToCents` | 8 |
| [`lib/gcStatementCc.ts`](../src/lib/gcStatementCc.ts) (61) · [`lib/teammateEmailChips.ts`](../src/lib/teammateEmailChips.ts) (79) | CC parse/toggle, `GC_STATEMENT_CC_MAX`; chip lists, `gcEmailChip` | 6 · 8 |
| [`lib/gcStatementSchedule.ts`](../src/lib/gcStatementSchedule.ts) (90) · [`lib/gcStatementStandingCopies.ts`](../src/lib/gcStatementStandingCopies.ts) (169) | `buildGcStatementRequestInsert`, `describePendingGcStatementSend`; `groupStandingCopies`, `planStandingCopyEdit`, `formatWeekdays`, `chicagoYmdOf` | 7 · 10 |
| [`lib/statementRoundEmail.ts`](../src/lib/statementRoundEmail.ts) (136) · [`lib/emailSchedule/emailScheduleWeek.ts`](../src/lib/emailSchedule/emailScheduleWeek.ts) | round-email chains + edit plan; `addDaysYmd`, `formatMinutes`, `parseHhMm` | 6 · 20 |
| `lib/portal/gcPortalLink.ts` · `lib/emailWording.ts` · `lib/physicalInvoiceIssuer.ts` · `lib/jobs/jobFormMoney.ts` | portal caption; template wording; office phone; `formatCurrency` | 5 · 5 · 3 · 5 |
| IO: `gcStatementEmailRequests.ts` (47), `gcStatementRoundIo.ts` (106), `gcReviewCertifications.ts` (50), `statementRoundEmailClient.ts` (71), `hooks/useGcPortalLinks.ts` (50), `jobsDocuments/printWindow.ts` | Supabase reads/writes, edge preview/test | **none** (incl. the pure `canCancelStatementRequest`) |

**Still inline (Stage-A candidates):**

| Logic | Where | Target | Why |
|---|---|---|---|
| Round chip presentation: 6 states → colour / background / label, incl. `contactedOnlyWeeks >= 2` "⚠ spoke N wks running" | 1007–1043 | `lib/jobs/statementRoundChip.ts` (share with `GcSenderRoundCard` `stateLabel` 59–73) | two hand-kept copies of one state machine; untested |
| Chip click rule (undo vs assign vs sender card) | 987–997 | same kernel: `roundChipAction(it, canCertify, roundBusy)` | untested branch logic |
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
- **RPC (direct):** `mark_customer_portal_slug_shared` (569).
- **Edge functions:** `statement-round-email-dispatch` (preview, `test_send`). `send-gc-statement-email` is **invoked by the parent** through `onSendStatement`. The scheduled dispatcher (`gc-statement-email-dispatch`) rebuilds at send time and skips an entity (per-GC / per-development) statement with nothing outstanding (233–242); a whole-report row is never skipped for amount.
- **Parent-side read:** `gc_statement_emails` (last-sent hints).
- **No realtime channels.** Freshness is refetch-on-open (effects 340, 373, 380, 391, 516, 683 all gate on `open`) plus refetch-after-action: `refreshRoundMarks`, `refreshCerts`, `refreshPendingSends`, `refreshRoundEmailRows`, `refreshPortalLinks`, and the parent's `refreshGcLastSent` / `loadJobs`.

---

## Recommended extraction order

Per the playbook, Stage A comes before Stage B for each unit, and the lowest coupling goes first. Run `npm run typecheck && npm run lint && npm test` at every step, and make only behaviour-preserving changes. **Done so far:** 16 kernels in `lib/` (above), plus 5 extracted children: `GcTemperatureBoard`, `GcReviewCertifyModal`, `GcStatementMarkSentForm`, `GcSenderRoundCard`, `GcStatementSendHistoryModal`.

| # | Unit | Lines out (approx.) | Coupling | Risk |
|---|---|---|---|---|
| 1 | `ScheduleWhenControls` + `chicagoTomorrowYmd` → `src/components/jobs/GcScheduleWhenControls.tsx` + render smoke | ~105 | props only | low |
| 2 | **Stage A, small kernels:** `statementRoundChip` (+ migrate `GcSenderRoundCard.stateLabel`), `roundChipAction`, `buildRoundMarkUpsert`, `heldReason`, `thisWeekSentMark`, `pickRoundCurrent`, office cohorts, `isEmailAddress`, `gcStatementDateStr`, a ymd label; tests | ~90 | pure | low |
| 3 | **Stage A, send payloads:** `buildGcStatementSendPayload` + `buildGcReviewShareAllPayload` (+ the docs option bag); tests pin `total`, `jobCount`, subject fallback, portal toggle, `ccEmails` | ~50 | pure | med (money-adjacent) |
| 4 | `useGcScheduledSends(open, ctx)` (330, 384–485: `pendingSends` + 7 standing states + handlers) → `GcScheduledSendsPanel` (1207–1267) + `GcStandingCopiesSection` (2201–2343). Keep the cancel-then-insert order and add a `// TODO` at the seam | ~110 + 61 + 143 | hook owns 8 states | low-med |
| 5 | `useStatementRoundEmail()` (362–375, 630–669: 8 states) → `GcRoundEmailSection` (1054–1193); `GcSenderRoundCard.onSetupEmail` calls the hook's `openFor` | ~55 + 140 | 8 states; 1 cross-region opener | low-med |
| 6 | `GcReviewShareAllDialog` (2034–2200), conditionally mounted; its 8 non-flag states init on mount (replaces the opener reset 850–861) | ~170 | `rollup`, `includeCollections`, `onSendStatement`, `refreshPendingSends` | med-high |
| 7 | `GcDraftMessageDialog` (1652–1895 + 686–716), conditionally mounted on `emailDialogGroup`; 11 states move; `onSent(group)` → parent auto-mark; `emailFromRoundGcId` + effect 549 stay | ~275 | 13 reads today → ~8 props + 3 callbacks | **high** |
| 8 | **`useGcStatementRound({open, billedActiveRows, collectionsRows, lastSentByGcId, weekStart})`**: certs, marks, board marks, senders, 2 refreshers (`refreshCerts`, `refreshRoundMarks`), effects 340 / 380 / 516, the 10 derived memos, `markRound` / `undoRoundMark` / `assignSender`, `roundBusy` / `roundError`. Build it here first; a later PR can move `JobsStagesTab` 1648–1720 and `usePipelineMoneyOpportunities` 100–150 onto it | ~200 | read by 8 regions | med-high |
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
   - 549–556 bounces `emailDialogGroup` ↔ `roundOpen` via `emailFromRoundGcId`. All three must live in the same component.
   - 543–548 re-fires on `[open, startInRound, startInRoundGcId]`.
   - The senders effect 516–525 keys on the `roundGcIds` memo identity, which comes from `roundRollup`, which re-derives when the parent's rows change (e.g. after `onOpenJob` → `loadJobs`).
   - The loader effects (340, 373, 380, 391, 516) are gated on `open`, and there is **no cancellation** in `refreshCerts` / `refreshRoundMarks` / `refreshRoundEmailRows` (only 391–403 and 516–525 carry a `cancelled` flag).
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
12. **The z-ladder collides at 64.** The round overlay, Mark sent dialog, `GcSenderRoundCard` and `GcStatementSendHistoryModal` all use 64 and are mutually exclusive only by flow. The Certify modal is at 70, Edit Job (via `onOpenJob`) at 1010, and the globe modal at 1300. **No Escape handling** exists in the modal or any inline overlay.
13. **Popup-blocker paths.** Every preview (`openHtmlPreviewWindow` at 1151, 1786, 1945, 2419) returns false when blocked and sets an error string. The print path toasts in the parent.
14. **Cross-surface duplication.**
    - The round engine (certs + marks + senders → `buildStatementRound` / `summarizeStatementRound`) is loaded independently here (333–540), in `JobsStagesTab` (1648–1720, the stages map's seam "I") and in `usePipelineMoneyOpportunities` (100–150). They share no cache, and a mark made here refreshes only this copy.
    - The GC Review transport (`onSendStatement` edge invoke) lives in `JobsStagesTab` 4259–4288 (stages map extraction #7). Coordinate the two.
