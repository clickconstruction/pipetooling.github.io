# Prospects Tabs Architecture Map

---
file: docs/PROSPECTS_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the Prospects surface (per PAGE_DECOMPOSITION_PLAYBOOK.md) — what every lane and tab of src/pages/Prospects.tsx (1,556 lines since the thirteen cuts of 2026-11-17, 5,600 before them) and the pieces cut out of it touch (state, loaders, handlers, sub-components, supabase tables/RPCs, cross-tab coupling), with the already-extracted src/components/prospects/TeamProspectsTab.tsx (2,376 lines), so the next cut can start without re-deriving the strategy.
covers:
  - src/pages/Prospects.tsx
  - src/components/prospects/TeamProspectsTab.tsx
  - src/components/prospects/ProspectsFollowUpTab.tsx, ProspectsListTab.tsx, ProspectsConvertTab.tsx, ProspectsActivityTab.tsx (the tabs, cut out 2026-11-17)
  - src/components/prospects/useProspectsData.ts, useSubsBoardData.ts, useSubsBench.ts, useProspectDoubles.ts, useProspectJobs.ts, useCallingLock.ts, useCallRun.ts, useProspectCopyTemplates.ts, useProspectListTab.ts, useProspectConvert.ts, useEditProspectWindow.ts, useNewProspectWindow.ts (the hooks the page calls)
  - src/components/prospects/EditProspectWindow.tsx, NewProspectWindow.tsx, ProspectKindFields.tsx, ProspectCallbackModal.tsx, ProspectTimerHistoryModal.tsx, ProspectMyTimeModal.tsx, ProspectCopyTemplateRow.tsx, ProspectCopyTemplateEditModal.tsx, ProspectCopyBlankFieldsModal.tsx (the windows)
  - src/components/prospects/SubsPathStrip.tsx, SubsPlansPicker.tsx, SubsLaneList.tsx, SubsNeedsPanel.tsx, GcWorkStrip.tsx (the Subs and Jobs to GC lanes' drawn pieces)
  - src/components/prospects/ProspectPersonForm.tsx, ProspectJobsBox.tsx, ProspectBenchModal.tsx (the lanes' windows, v2.5560–v2.5604), SubsBoard.tsx (the Board, v2.5808)
  - src/lib/prospects/ (the kernels: prospectKinds, prospectRow, prospectFormat, prospectCopyTemplates, prospectTimerSums, prospectTimerIo, prospectWeekReportIo, subsDeckOrder, benchRead, callingLockIo, subsLane, gcLeadLane, laneLoad, companyDouble, deckWords, windowLeave, zzProspects, stripState, personBlock, mapsShareText, textingRule, subsStages, benchOrigin, subsBoard, subRecord, callRun, subsRanks, benchAsk, needTones, gcNeeds, pagePadding)
mapped_at: 82094de18b
audience: Developers, AI Agents
last_updated: 2026-11-19
sections: What this surface is; Master summary table; Shared substrate; Per-tab dossiers; TeamProspectsTab sub-decomposition; Page-level windows; URL / navigation router; Test coverage by region; Stage-A pure-logic inventory; Preserve-quirks list; Recommended extraction order; Hazards
---

> **Line numbers are exact as of `82094de18b`** (re-mapped 2026-11-18 from `6af60c5bcf`, after the thirteen cuts and the two fixes they found: `Prospects.tsx` read again against its `npm run map` fact sheet, 5,600 → 1,556 lines, and every piece cut out of it indexed the same way; `TeamProspectsTab.tsx` has not changed since `6af60c5bcf`, so its section stands as it was).
> They drift with every edit. Search for the named symbol; the range is a hint.
> A bare range is in the file its section or its bullet names; a range in any other file names the file.
> Regenerate a fact sheet with `npm run map -- src/pages/Prospects.tsx`, or the same with any file below.

## What this surface is

[`src/pages/Prospects.tsx`](../src/pages/Prospects.tsx) is the cold-call workstation. It finds three kinds of company through one calling deck, and it is the door to the Hiring board and the Permits ledger. Since the cuts of 2026-11-17 the page is the shell: the router and the gates, the tab rows, the state the tabs share, the outcomes that write the caches, and the mounts. Each tab draws in its own file, and the page reaches its data through hooks it calls, so a tab's state lives as long as the page does and survives a tab switch. [`src/components/prospects/TeamProspectsTab.tsx`](../src/components/prospects/TeamProspectsTab.tsx) is the extracted Hiring tab, a God component of its own. Hook censuses are from `npm run map` at `82094de18b`:

| File | Lines (at `6af60c5bcf`) | useState · effects · useMemo · useCallback · refs | Handlers | Role |
|---|---|---|---|---|
| `Prospects.tsx` (`Prospects` 98–1556) | 1,556 (5,600) | 28 · 15 · 1 · 1 · 1 | 42 | shell: router, gates, tab rows, shared state, the outcomes, the mounts |
| `ProspectsFollowUpTab.tsx` (`ProspectsFollowUpTab` 128–954) | 954 (—) | 0 · 0 · 0 · 0 · 0 | 2 render helpers | the calling deck, drawn from 82 props |
| `TeamProspectsTab.tsx` (`TeamProspectsTab` 785–2376) | 2,376 (2,376) | 36 · 2 · 0 · 1 · 0 (35 in the component + `RoleColumn.menuOpen`) | 34 | Hiring board: 5 stages + 6 modals |

**Cut out of the page on 2026-11-17**, each in `src/components/prospects/` unless named:

| Piece | Lines | What it holds | Shipped |
|---|---|---|---|
| `ProspectsFollowUpTab.tsx` | 954 | the Follow Up tab's JSX and its two queue helpers, props only | v2.7638 |
| `ProspectsListTab.tsx` + `useProspectListTab.ts` | 417 + 121 | the Prospect List, with its search, open sections, folds, selected row and timed seconds | v2.7636 |
| `ProspectsConvertTab.tsx` + `useProspectConvert.ts` | 303 + 178 | Convert, with its 8 states, 3 effects, picker pool and submit | v2.7628 |
| `ProspectsActivityTab.tsx` | 228 | Activity, with its 4 states and its two reads (`lib/prospects/prospectWeekReportIo.ts` for the week) | v2.7626 |
| `useProspectsData.ts` | 300 | the lane's caches, the pointer, the call-history sets, both loaders, the calling order | v2.7634 |
| `useSubsBoardData.ts` | 100 | the Board's pins and extras, and the pin writes | v2.7634 |
| `useSubsBench.ts`, `useProspectDoubles.ts`, `useProspectJobs.ts` | 48, 92, 85 | the bench read; the doubles and the GC work read; a lead's jobs and their five writes | v2.7631 |
| `useCallingLock.ts`, `useCallRun.ts`, `useProspectCopyTemplates.ts` | 91, 110, 254 | the lock; the run's notes and its text; the copy templates' state, reads and presses | v2.7632 |
| `ProspectCopyTemplateRow.tsx`, `ProspectCopyTemplateEditModal.tsx`, `ProspectCopyBlankFieldsModal.tsx` | 85, 147, 53 | the copy row with the three icons, and its two windows | v2.7632 |
| `useEditProspectWindow.ts` + `EditProspectWindow.tsx`, `useNewProspectWindow.ts` + `NewProspectWindow.tsx`, `ProspectKindFields.tsx` | 204 + 148, 169 + 194, 85 | the two windows, and `renderKindFields` | v2.7637 |
| `ProspectCallbackModal.tsx`, `ProspectTimerHistoryModal.tsx`, `ProspectMyTimeModal.tsx` | 99, 100, 105 | Set callback's boxes; the two time windows with their reads (`lib/prospects/prospectTimerIo.ts`) | v2.7623 |
| `SubsPathStrip.tsx`, `SubsPlansPicker.tsx`, `SubsLaneList.tsx`, `SubsNeedsPanel.tsx`, `GcWorkStrip.tsx` | 61, 52, 201, 130, 73 | the Subs lane's strip, For picker, list by trade and needs panel; the Jobs to GC work strip | v2.7621 |
| `lib/prospects/` | — | new: `prospectCopyTemplates`, `prospectFormat`, `prospectRow`, `prospectTimerSums`, `prospectTimerIo`, `prospectWeekReportIo`, `subsDeckOrder`, `benchRead`, `callingLockIo`; grown: `callingOrder`, `callLogState`, `subRecord`, `callRun`, `prospectKinds`, `windowLeave`, `prospectConversion` | v2.7595–v2.7656 |

Out before the cuts, each in `src/components/prospects/` unless named: `SubsBoard.tsx` (904 lines, the Board), `ProspectsResearchTab.tsx` (805, the Permits tab, with fifteen children of its own), `ProspectJobsBox.tsx` (228), `ProspectBenchModal.tsx` (196), `ProspectPersonForm.tsx` (139), `components/gc/GcCallScriptWindow.tsx` and `components/NewCustomerForm.tsx`.

`Prospects.tsx` calls 23 hooks. Eleven are the router's, the auth's, the toasts' and the dialogs' (`useNavigate`, `useLocation`, `useAuth`, `useIsMobile`, `useZzTestJobsHidden`, `useMyHiringShares`, `useToastContext`, `useConfirmDialog`, `usePromptDialog`, `useNewCustomerModal`, `useSearchParams`, 99–115). Twelve are its own pieces: `useSubsBench` 134, `useSubsBoardData` 136, `useProspectsData` 139, `useProspectDoubles` 191, `useProspectListTab` 536, `useEditProspectWindow` 547, `useNewProspectWindow` 561, `useProspectConvert` 584, `useCallingLock` 598, `useCallRun` 600, `useProspectCopyTemplates` 609 and `useProspectJobs` 611. Its module scope (84–94) holds the two tab types, `PROSPECTS_TABS` and `tabStyle`. Everything else that was module-level moved: the formatters and the copy rules to `lib/prospects/`, the `Prospect` type to `lib/prospects/prospectRow.ts`, the three icons to `ProspectCopyTemplateRow.tsx`, `STAGE_TONE_STYLE` to `SubsLaneList.tsx`, `NEED_TONE_COLOR` to `SubsNeedsPanel.tsx`, `DIDNT_ANSWER_MOVE_NEXT_KEY` to `ProspectsFollowUpTab.tsx` and `renderKindFields` to `ProspectKindFields.tsx`.

### How it grew

| Day | Commit | Lines | What landed |
|---|---|---|---|
| 2026-02-23 | `28931d97ec` | — | the page's first commit |
| 2026-09-25 | `a05cef4c4` | 3,962 | the first map's anchor: one customer deck, four sub-tabs, seven windows |
| 2026-10-15 | before v2.5559 | 3,970 | — |
| 2026-10-15 | v2.5559 | 4,271 | three kinds of prospect (punch list #110): the `kind` state, `renderKindFields`, the kind cards |
| 2026-10-17 | v2.5606 | 4,782 | the lanes' bench and jobs (v2.5560, v2.5561), the #113 spots (v2.5578–v2.5585), the person first (#117, v2.5601–v2.5606) |
| 2026-10-24 | v2.5810 | 5,530 | what GC mode needs (#148, v2.5782, v2.5785), the path onto the bench, the Board, the run, the pins, the ask on landing (#153, v2.5807–v2.5810) |
| 2026-10-28 | v2.6032 | 5,546 | the run's first text starts a thread |
| 2026-11-17 | `6af60c5bcf` | 5,600 | the Permits tab's mount (v2.6782, v2.6787), the phone padding (v2.6869), sweeps; the second map's anchor |
| 2026-11-18 | `82094de18b` | 1,556 | the thirteen cuts of 2026-11-17 (v2.7595–v2.7638) and the two fixes they found (v2.7656, v2.7657) |

1,560 of the 1,638 lines between the first two anchors came in the ten days from 2026-10-15 to 2026-10-24, all of them on the lanes. Each feature put its rules in a tested kernel under `src/lib/prospects/`, and left its state, its effects, its handlers and its JSX in the page, which had no render test. The cuts gave it one first (v2.7615), then moved everything but the shell out, each move run against the same cases before and after.

### Tabs and lanes

The page switches on **four levels of state**:

```
topTab:    'customers' | 'team' | 'research' | 'roll'                     (ProspectsTopTab; 'research' is the Permits tab, ?tab=permits; 'roll' is State roll, ?tab=roll)
kind:      'customer' | 'gc_lead' | 'sub'                                 (ProspectKind, lib/prospects/prospectKinds.ts; state 121; only under 'customers')
activeTab: 'follow-up' | 'board' | 'prospect-list' | 'convert' | 'activity' (ProspectsTab 86, PROSPECTS_TABS 88; only under 'customers')
stage:     'screen' | 'interview' | 'tryout' | 'hire' | 'review'          (TeamProspectsTab 806; HiringStage in lib/hiring/sharedHiringTab.ts)
```

The top row (1290–1311) draws six pills: **Customers**, **Jobs to GC** and **Subs** (one per `PROSPECT_KINDS`, each sets `kind` through `setKindTab`, 1293–1297), then **Hiring** (1299), **Permits** (1304) and **State roll** (punch list #411: [`StateRollTab`](../src/components/prospects/StateRollTab.tsx), shown to `teamProspectsAccess` alone, its lines in [`rollPulls.ts`](../src/lib/licenseRoll/rollPulls.ts) and its reads in `rollPullsIo.ts`). The pills scroll sideways beside the title on a phone; the lit one carries `aria-current` and [`useLitPillInView`](../src/hooks/useLitPillInView.ts) moves the row, never the page, to show it. The second row (1307–1366) shows under the three lanes only: **Follow Up**, **Board** (Subs only), **Prospect List**, **Convert** (Customers only, 1332–1343), **Activity** (dev and assistant-like, 1344–1355), and the **New Prospect** button (1356–1364).

| Tab | Shows on | Owns |
|---|---|---|
| Follow Up | every lane | the calling deck: one card, its outcomes, comments, notes, timers, the queue; on Subs the path strip, the needs panel and the run; on Jobs to GC the work strip and the card's Jobs box; on Customers the copy templates |
| Board | Subs | the lane by trade in columns (`SubsBoard`), pins by drag, priority, Call the top 3 as a run |
| Prospect List | every lane | every row of the lane, grouped by pipeline stage (by trade on Subs), with the row actions |
| Convert | Customers | prospect → customer with contact persons and first bids, on one form |
| Activity | every lane, dev and assistant-like | the week report, Source success on a lane, Marked / Updated by day |
| Hiring (`team`) | — | `TeamProspectsTab`: the five-stage hiring board |
| Permits (`permits`) | — | `ProspectsResearchTab`: the cities' permit feeds, the skim, Investigate / Pursue / Pass / Has a plumber, Builders, Find |

One `?tab=` param selects the top tab and the sub-tab together, and `?kind=` selects the lane (`gc-leads` or `subs`; the customer deck keeps its bare URL). See [URL / navigation router](#url--navigation-router-parent-permanent).

### Access gates

- **`canAccessFollowUp`** (1258): signed in AND [`canAccessProspectPipeline`](../src/lib/prospects/prospectConversion.ts)`(authRole, estimatorProspectsAccess)`. That means dev, master_technician, assistant or controller, or an estimator with the flag. It gates the three lane pills, Follow Up, the Board, Prospect List and Convert (each shows "You do not have access" otherwise) and the New Prospect button. The page hands it to each tab as a prop. An estimator without the flag gets an early-return page (1268–1279), except on the Permits tab.
- **`canAccessActivityTab`** (244): `authRole === 'dev' || isAssistantLike(authRole)`.
- **`canOpenHiring`** (108): `teamProspectsAccess || myHiringShares.length > 0`. `useMyHiringShares` (107) reads the viewer's own `team_prospect_role_shares` rows. A share holder without the switch gets the trimmed board, because the page passes `shared={!teamProspectsAccess}`.
- **`canResearch`** (110): `canResearchPermits(authRole)`, the office and every estimator, flagged or not.
- **Lane rules, in the router (299) and in `setKindTab` (412):** `board` needs `kind === 'sub'`, `convert` needs `kind === 'customer'`. Either falls back to Follow Up.
- **The GC tables are read fail-soft.** A role they refuse sees the Subs and Jobs to GC lanes without their strips.

## Master summary table

| Region | Where it lives (`82094de18b`) | Lines | Status | Owned state | Coupling | Risk | Next |
|---|---|---|---|---|---|---|---|
| Module scope | page 84–94 | 11 | inline | — | — | — | Stays |
| Shell: gates, tab rows, URL router | page: effects 246–329 / 332–342, `setTradeFilter` 375, `setPlansFor` 386, `setTab` 395, `setKindTab` 408, `openResearchTab` 429, `openTeamTab` 440, early returns 1260–1279, tab rows 1284–1366 | ~300 | permanent parent | `topTab`, `activeTab`, `kind` | — | — | Stays |
| Data seam | `useProspectsData.ts` 33–297, called at page 139 and destructured 150–173 | 300 | **extracted v2.7634** | the caches, the pointer, the call-history sets, the calling order, both loading flags | every tab; the page's handlers patch its caches through its setters | — | Done |
| Lane reads | `useSubsBench.ts`, `useProspectDoubles.ts`, `useProspectJobs.ts`, `useSubsBoardData.ts` | 325 | **extracted v2.7631 / v2.7634** | the bench's five, GC work, the doubles, the jobs, the pins and extras | read-only and fail-soft; keyed on `kind`, `newKind`, the user | — | Done |
| Subs lane drawn pieces | `SubsPathStrip`, `SubsPlansPicker`, `SubsLaneList`, `SubsNeedsPanel`, `GcWorkStrip` | 517 | **extracted v2.7621** | `subsSectionOpen` (`useProspectListTab.ts` 35) | props only | — | Done |
| Follow Up | page 1374–1459 mounts `ProspectsFollowUpTab.tsx` 128–954 | 86 + 954 | **extracted v2.7638**, props only | 18 page states (the comments, the composer, the notes, the clock, the order toggle, the auto-advance choice, the text ask, the open flags, the caller's name) and the hooks' values | high: 82 props by name; the outcomes stay in the page | med | `useFollowUpDeck`, then `FollowUpQueue` (see [the order](#recommended-extraction-order-value--risk)) |
| — Follow Up's outcomes and call logging | page 742–1229 (`openCallbackModal` … `handleNextProspect`) | ~490 | inline, parent | — | write the caches, the pointer, the clock, the lock and the run; close over the click-time render | high | Stays until a deck hook exists |
| Board (Subs) | page 1461–1497 mounts `SubsBoard` (1472) | 37 | drawn by `SubsBoard`; data in `useSubsBoardData` | — | 9 callbacks into page handlers | low | Done |
| Prospect List | page 1499–1524 mounts `ProspectsListTab.tsx` 57–417 over `useProspectListTab` (page 536) | 26 + 417 + 121 | **extracted v2.7636** | 5 states | the row actions stay in the page | — | Done |
| Convert | page 1526–1528 mounts `ProspectsConvertTab.tsx` 12–303 over `useProspectConvert` (page 584) | 3 + 303 + 178 | **extracted v2.7628** | 8 states | patches both caches on success | — | Done |
| Activity | page 1530–1532 mounts `ProspectsActivityTab.tsx` 19–228 | 3 + 228 | **extracted v2.7626** | 4 states; `weekOffset` stays in the page (243) | reads the lane's rows for Source success | — | Done |
| Hiring (key `team`) | page 1368–1370 | 3 | **extracted** (`TeamProspectsTab`) | 0 (parent owns `useMyHiringShares` for the gate) | 5 props: `authUserId`, `isDev`, `canEditOnboarding`, `resolveMasterId`, `shared` | — | Sub-decompose (below) |
| Permits (key `permits`) | page 1372 | 1 | **extracted** (`ProspectsResearchTab`) | 0 | 1 prop: `authUserId`; its own URL keys through `permitsLink.ts` | — | Nothing to cut here |
| Edit Prospect window | `useEditProspectWindow.ts` 20–202 (page 547), `EditProspectWindow.tsx` 14–148 (page 1534) | 204 + 148 | **extracted v2.7637** | 9 states + a leave guard | opened by Follow Up, Prospect List and the Board; hosts warmth ± | — | Done |
| New Prospect window | `useNewProspectWindow.ts` 17–167 (page 561), `NewProspectWindow.tsx` 15–194 (page 1553) | 169 + 194 | **extracted v2.7637** | 8 states + a leave guard; the open flag and `newKind` stay in the page (131–132) | tab-row button, `?newProspect=true`, `openAddSub`, the empty states; Save reads **Save anyway** while a double shows | — | Done |
| Follow Up's small windows | page 1536–1546 | — | **extracted v2.7623 / v2.7632** | the open flags stay in the page; the boxes and reads in the windows | — | — | Done |
| Bench window, call script | page 1548–1551; state 124–126 and 179 | 4 | **extracted** (`GcCallScriptWindow`, `ProspectBenchModal`) | `benchDraft`, `benchSaving`, `benchError`, `scriptOpen` | `handleBenchSave` writes three caches and the pointer | — | Stays with its handler |
| — TPT module components | `EmailText` 193–208 … `RoleColumn` 632–782 | ~590 | inline in file, pure props | `RoleColumn.menuOpen` only | none | lowest | **Move to own files first** |
| — TPT Screen | header 1651–1689, board 1691–1738, Passed 2045, Sources 2047–2094 | ~140 | inline | 5 | `rows`/`roles`/`busy`/`load`/`setStatus`/`openEdit`, hygiene, shares, drag | med-high | Last |
| — TPT Interview | 1740–1845 + My review modal 2172–2219 | 106 + 48 | inline | 2 (reads TPT-level `reviews`/`reviewerNames` from `load`) | `setStatus`, `startTryOut`, `markContacted` | low-med | 3rd |
| — TPT Try-out (v2.3627) | 1846–1911 | 66 | inline | `trialTallies` (from `load`) | `endTryOut`, `keepTrying`, `markContacted`, `openEdit`, `prefixMap` | low | 2nd |
| — TPT Hire | 1912–2036 + Onboarding settings modal 2269–2361 | 125 + 93 | inline | 6 onboarding states | roster hand-off modal (2221–2267) is opened by `setStatus('hired')` from any stage | low | **1st stage move** |
| — TPT Review | 2037–2044 | 8 | **extracted** (`TeamReviewSection`, 1,025 lines) | 0 (`rateUserIdFromUrl` passed down) | `onOpenScreenBoard={() => setStage('screen')}` | — | Done |
| — TPT Share with… (v2.3802) | 2362–2373 → `ShareColumnDialog` (79 lines) | 12 | dialog **extracted**; state + handlers inline | 4 (`shares` from `load`, `shareRoleId`, `shareAccounts`, `shareAccountsLoading`) | `RoleColumn` ⋯ menu; the Screen board also reads `shares` for the share chip; the dialog names sharers from `reviewerNames` | low | Hook seam with the dialog |

## Shared substrate

1. **The lane:** `kind` (page 121) starts from the link (`kindFromSearch`, so a refresh never paints the Customers deck under a lane's tab) and is written only by the `?tab=` effect and `setKindTab`.
   - Both loaders filter `prospects.kind` (`useProspectsData.ts` 100 and 182). The Activity reads join each row on `prospects!inner(kind)` (`lib/prospects/prospectWeekReportIo.ts`).
   - `latestLoad` (`useProspectsData.ts` 59, `makeLatestOnly`) numbers the deck's loads, and every await in `loadFollowUpProspects` returns early unless its load is still the newest.
   - The deck draws a card only when `cardOnLane` says it is the lane's (`ProspectsFollowUpTab.tsx` 347–349), and says `laneLoadingWords(kind)` otherwise.
   - `kindWords = PROSPECT_KIND_WORDS[kind]` (page 122) names the lane's tab, its last press and its landed words.
2. **Selection pointer:** `currentProspectIndex` (`useProspectsData.ts` 65) indexes `followUpProspects` (64) and yields `currentProspect` (206) and `currentProspectId` (207). It syncs to the URL as `?prospect_id=`.
   - The index is written by every advance and removal handler in the page, by the `renderQueueRows` row click (`ProspectsFollowUpTab.tsx` 250–303), by `loadFollowUpProspects` and by the index-sync effect (`useProspectsData.ts` 209–215). The `?prospect_id=` half is written by `updateUrlProspectId` (`useProspectsData.ts` 254–262) and, cross-tab, by `selectProspectForList` (`useProspectListTab.ts` 93–102) and `openDoubleProspect` (page 358–373).
   - `?prospect_id=` is read by `loadFollowUpProspects` (`useProspectsData.ts` 140–160) and the index-sync effect.
   - Per-prospect effects hang off the card. In the page: the text-ask reset 612–614, notes sync 616–618, comments 651–659, ledger seconds 671–677, scheduled callback 702–704 (via `loadScheduledCallback` 679–700) and the card clock 718–725. In the hooks: the email-sent keys (`useProspectCopyTemplates.ts` 225–232) and the lock's release (`useCallingLock.ts` 34–45).
   - **Stays with the parent**, through the hook it calls; the tabs get it as props.
3. **The prospect caches:** `followUpProspects` (the deck) and `prospectListProspects` (`useProspectsData.ts` 67: the list, the Board and Convert). The Subs lane adds `laneAllRows` (61, every row of the lane for the strip's counts) and `laneQueueAll` (60, the whole queue before the trade filter). The page destructures them with their setters (150–173), and its handlers patch them as before. Which mutation writes which:
   - both caches: `saveFollowUpNotes`, `saveOkToText`, `savePriority` (and `laneAllRows`), `handleCantReach`, `handleConverted`, `handleBenchSave` (and `laneAllRows`), `leaveQueueAsLanded`, `handleSendBack`, `handleDeleteFromList` and `handleAnswered` in the page; `handleDeleteProspect` and `saveEdit` in `useEditProspectWindow.ts`; `handleConvertSubmit` in `useProspectConvert.ts`
   - Follow Up cache only: `handleNoLongerFit`, `handleDidntAnswer` and `handleAddComment` in the page; `handleWarmthDelta` and `handleWarmthReset` in `useEditProspectWindow.ts`
   - list cache only: `handleNotAFitFromList` (`passFromBoard` then patches `laneAllRows`)
   - reloads both: `saveNewProspect` (`useNewProspectWindow.ts` 104–142), unless the new row is another lane's, where `setKindTab` moves there and the kind change reloads

   Four call-history derivatives travel with the caches, all in `useProspectsData.ts`:
   - `calledProspectIds` (76): set by `loadFollowUpProspects`, patched by `markCalledLocally` 267–270. It drives the "never called" chip and the queue order.
   - `prospectLastCallMap` (69): set by `loadProspectListProspects` through `lastCallByProspect` (195), patched by `markCalledLocally`. It is read by Prospect List ("Last touch"), the Subs list, the Board, Convert search and suggestions, and the list's `?prospect_id` effect.
   - `answeredProspectIds` (62) and `laneCallRows` (63): set by both loaders. They feed the Subs stages and `subRecordMap` (page 178).

   **`useProspectsData`** is the seam the map proposed at `6af60c5bcf`, as built. It returns the caches, the pointer, the sets, both loading flags, both loaders, `updateUrlProspectId`, `markCalledLocally` and the calling order with its switch, each with its setter (`ProspectsData`, 299). `callingOrderModeRef` (75) and `latestLoad` (59) moved with `loadFollowUpProspects`, which reads them. The page's `switchCallingOrder` (175–177) closes the order toggle around the hook's (237–252). It does not own `saving`.
4. **One global `saving` flag** (page 198) disables buttons across every lane's tabs and windows, the Board's cards included (`busy={saving}`). It stayed in the page: the tabs and windows read it as a prop, and `useEditProspectWindow` and `useNewProspectWindow` take `setSaving` as an argument. Convert has `convertSaving` (`useProspectConvert.ts` 46) and the bench window has `benchSaving` (page 125).
5. **Tab-keyed loaders**, in the page on purpose (they decide when a hook's loader runs, and they read the tab state the page owns):
   - 513–518 runs `loadFollowUpProspects` + `loadMyTimeToday` on `[topTab, activeTab, authUser?.id, searchParams, kind, benchTrades]`. See quirk 5.
   - 520–524 runs `loadProspectListProspects` on entry to prospect-list, convert **or** board, and on a kind change.
   - 527–532 runs it again on Activity of a lane that is not Customers, for Source success.
6. **The bench read** (`useSubsBench.ts` 23–45, over `benchReadFromBoard`) is shared by five readers: the needs panel, the path strip (`benchQuoted`), the For picker and the Board (`gcPlans`, `gcBench`), the Trades picks in New and Edit (`benchTrades`) and the double check (`benchCompanies`). It runs when the lane **or** the New Prospect window's kind is `sub`, which is why `newKind` sits in the page above it (132).
7. **TeamProspectsTab and ProspectsResearchTab are substrate-free from the parent's side.**
   - Each loads its own data. Hiring takes 5 props, Permits takes 1.
   - `getEffectiveMasterId` (page 1231–1235) is just `resolveCompanyOwnerUserId(supabase, authUser.id)` (v2.2972, one company). It serves `saveNewProspect` (handed to `useNewProspectWindow`) and TPT's `saveNewCandidate`/`addRole`.
   - *Inside* TPT the substrate is `rows`/`roles`/`loading`/`busy`/`modalError`/`load()` plus `setStatus`/`openEdit`/`markContacted`/`startTryOut`.
8. **Logic duplicated with other surfaces** is listed under [Cross-surface duplicates](#cross-surface-duplicates-fix-outside-the-moves).

## Per-tab dossiers

### The lanes — what a kind adds

- **Customers** (`customer`): the deck as it always was, plus the Convert tab and the copy templates. Its last press is **Converted ✓** (`handleConverted`, page 839–870).
- **Jobs to GC** (`gc_lead`): an owner, developer, architect or owner's rep with a job we could build as the GC.
  - State: `jobsByProspect` (`useProspectJobs.ts` 19); `gcWork` (a `StripRead`), `gcBidding` and `customerDoubles` (`useProspectDoubles.ts` 36, 38, 39).
  - Reads: `useProspectDoubles.ts` effect 66–89 (`loadGcProjects` → `gcWorkCounts`, `gcBiddingLines`; `loadCustomerDoubles`), and `mergeJobs` (`useProspectJobs.ts` 21–34) beside both loaders.
  - Draws: the **GC work in flight** strip (`GcWorkStrip.tsx`, mounted at `ProspectsFollowUpTab.tsx` 311–313), the card's Jobs box (`ProspectJobsBox`, `ProspectsFollowUpTab.tsx` 526), the **Soonest bid** order.
  - Writes, in `useProspectJobs.ts`: `addJobFor` 37–41, `editJobFor` 44–47, `changeJob` 49–58, `markJobLost` 60–71 (`promptDialog`), `removeJob` 73–82, all through `gcLeadLaneIo.ts` on `prospect_jobs`.
  - Last press **Asked us ✓** (`handleAskedUs`, page 971–1011): the customer on file when `customer_id` is set (987–995), else Add customer (998–1009); the job with the soonest bid marked asked (978); `leaveQueueAsLanded` 953–965; then `navigate('/gc?new=1', { state: { newProjectSeed } })` (985).
- **Subs** (`sub`): a company that does a trade we buy out.
  - State: in the page `scriptOpen` (179), the bench window's three (124–126); in `useSubsBench.ts` `benchTrades` 16, `gcBench` 18, `benchCompanies` 19, `benchQuoted` 20, `gcPlans` 21; in `useProspectsData.ts` `laneQueueAll` 60, `laneAllRows` 61, `answeredProspectIds` 62, `laneCallRows` 63; in `useSubsBoardData.ts` `inboundProspectIds` 16, `laneCallbacks` 17, `laneRanks` 19; in `useCallRun.ts` the run's four (40–43); in `useProspectListTab.ts` `subsSectionOpen` (35).
  - URL, read in the page: `?trade=` (`tradeFilter` 180), `?for=` (`plansFor` 184, `plansPick` 185), `?run=` with `?pkg=` (`run` 188).
  - Reads: the bench (`useSubsBench.ts` 23–45: `loadGcProjects` → `loadGcBoardRows`, shaped by `benchReadFromBoard`, the way GC projects reads it), `loadLaneRanks` (`useSubsBoardData.ts` 23–33), `loadLaneExtras` (`useSubsBoardData.ts` 72–97: `contacts` → `messages` in, the upcoming `prospect_callbacks`).
  - Derived per render, in the page: `deckIds` 345, `laneQueueNow` 346 (`stillQueued`), `gcNeedsNow` 348 (`gcNeeds`), `subRecordMap` 178; `lanePins` in `useSubsBoardData.ts` (20).
  - Draws: the path strip (`SubsPathStrip`, through the page's `subsStrip` 1254–1256), the needs panel (`SubsNeedsPanel`), the For picker (`SubsPlansPicker`), the list by trade (`SubsLaneList`), the Board, the run's head and receipt (`ProspectsFollowUpTab.tsx` 314–340), the priority presses on the card (604–615), **Call script** (516, `GcCallScriptWindow`), the **By need** and **By rank** orders.
  - Writes: `savePriority` (page 479–490), `dropOnBoard` 36–42 / `unpinOnBoard` 44–48 → `writePins` 50–69 (`useSubsBoardData.ts`, `prospect_trade_ranks`), `passFromBoard` (page 1091–1096), `sendRunText` (`useCallRun.ts` 68–107, `quo-send`).
  - Last press **Add to the bench ✓** (`openBenchModal`, page 888–893 → `ProspectBenchModal` → `handleBenchSave` 895–950): `addGcCompany` → `markProspectOnBench` → the ask on the job's package (`askGcCompanies` 916, when `benchAskForProspect` 876–885 finds one) → the three caches, the pointer, the run's note.
- **Every lane** shares the person and company blocks (`personBlock.ts`, `ProspectPersonForm`), the ZZ rule (`withoutZzProspects` behind `useZzTestJobsHidden`), the **May we text?** chip (`saveOkToText`, page 1238–1248; `textRefusal` holds a text until the yes) and the double lookup on New Prospect (`companyDouble` over `useProspectDoubles.ts` 43–63).

### `follow-up` — Follow Up (the calling workstation)

- **Render location:** page 1374–1459 mounts `<ProspectsFollowUpTab>` (1375) with 82 props. The tab is `ProspectsFollowUpTab.tsx` 128–954, its props type 33–117. It contains:
  - Over the card: the Subs path strip 307, the needs panel 308–310 (`SubsNeedsPanel`), the GC work strip 311–313 (`GcWorkStrip`), the run's head 314–323.
  - The state chain 324–915: no access → loading → the run's receipt 328–340 → the empty lane 341–346 (`emptyLaneWords`; its press opens New Prospect through `openNewProspect`) → a card of another lane 347–349 → the card 350–915.
  - Header card IIFE from 354 (its button styles 355–370):
    - who you're calling from 376 (`prospectTitle`, `personLineParts`, the **May we text?** chooser 384–419, *Maps ↗* 438 and a sub's license (442) and trades (449), the `telHrefFor` link that takes the lock at 496–497, **Call script** on Subs 516, the Jobs box on a lead 526)
    - outcome row from 541: Didn't Answer 541 / Answered 544 / Can't reach 547 / Not a fit 552 / the lane's last press 564–566; in a run the text press 574–588 and Next 590
    - utility row from 596: Set callback 597 · Edit prospect 599 · the priority presses on Subs 604–615 or the 🔥 warmth pill (read-only, 623) · scheduled-callback link · mobile "N of M · show order" 638–650 · the `this call` timer (opens Timer history, 654–663) · `my day` 667
  - Mobile queue peek from 682 (15 rows, 691).
  - Comments section from 696 (the composer takes the lock on focus at 707; quick-note chips from 734).
  - Info card with notes from 829: Last Contact 831 / Last updated by / Last Successful Contact / Address / Time on this prospect 840; notes from 846.
  - Copy-template row 872 (`ProspectCopyTemplateRow`), on Customers only.
  - The advance bar 875–898 (`Next Prospect →`, or `Finish the run →` on a run's last card, 896).
  - Desktop queue rail 900–913 (12 rows, 911; the order toggle hides in a run).
  - Footer 916–951: the Didn't-Answer auto-advance checkbox (921–926) and the "my time" link.

  The windows it opens render from the page (see [Page-level windows](#page-level-windows)).
- **Where its state lives:** the tab owns none; it draws what it is handed. The 45 states the map counted at `6af60c5bcf` now sit here:
  - in the page (18): the comments and the composer, `comments` 194, `commentInputValue` 196, `commentInputRef` 197 (a state used as a ref), `quickNotes` 212, `followUpNotes` 208, `followUpNotesSaving` 209; the queue, `showCallingOrder` 217, `didntAnswerMoveNext` 215; the clocks, `followUpTimerSeconds` 200, `myTimeTodaySeconds` 227, `prospectLedgerSeconds` 230; the callback, `scheduledCallback` 199, `callbackModalOpen` 195; the time windows' flags, `timerHistoryModalOpen` 223, `myTimeModalOpen` 226; the card's small ones, `textAskOpen` 236, `scriptOpen` 179; and the caller's name, `authUserName` 241
  - in `useProspectsData.ts`: `followUpLoading` 66, `callingOrderMode` 74, `calledProspectIds` 76
  - in `useCallingLock.ts`: `lockHeldBy` 28
  - in `useCallRun.ts`: `runOutcomes`, `runDone`, `runCallbackAt`, `runTextState` (40–43)
  - in `useProspectCopyTemplates.ts`: the twelve copy states (40–67), `personPhone` among them
  - in the windows: the callback's three boxes (`ProspectCallbackModal.tsx` 19–21), the timer events (`ProspectTimerHistoryModal.tsx` 11–12), the my-time stats (`ProspectMyTimeModal.tsx` 11–12)

  `authUserName` is read by `handleBenchSave`, `useCallRun` and the copy templates. `followUpTimerSeconds` is also zeroed by `handleDeleteProspect` when it deletes the card (`useEditProspectWindow.ts` 138), which takes the setter.

  Refs: `lockTakenForRef` and `lockAttemptForRef` (`useCallingLock.ts` 26–27), `callingOrderModeRef` and `latestLoad` (`useProspectsData.ts` 75, 59), `loadCommentsForProspectRef` (page 220), `copyTemplateTextareaRef` (`useProspectCopyTemplates.ts` 68).
- **Cross-tab state (stays with the parent):** the lane, the pointer and the caches (through `useProspectsData`), `prospectLastCallMap`, `saving`, the Edit window's hook, the lane reads, `jobsByProspect`.
- **Derived values:**
  - `currentProspect` (`useProspectsData.ts` 206) and `retaggableNote` (page 646–649, `findRetaggableNote` over this prospect's comments).
  - The info card's "Last Contact" is `comments[0]?.created_at ?? currentProspect.last_contact`. "Last Successful Contact" is the newest `answered` comment.
  - Readouts: `this call` = `followUpTimerSeconds`; `my day` = `myTimeTodaySeconds + followUpTimerSeconds`; "Time on this prospect" = `prospectLedgerSeconds + followUpTimerSeconds`.
- **Handlers and loaders:**
  - `loadFollowUpProspects` (`useProspectsData.ts` 78–173). In parallel it reads live locks held by *others* (`.gte('locked_at', callingLockCutoffIso(now))`, 90) and every call comment (91). The server filter is `.eq('kind', kind)` (100) and, off the Subs lane, `fit null | neq not_a_fit` (102); the client then drops `not_a_fit` + `cant_reach` + `converted` and, for a non-dev, the ZZ rows, then `orderFollowUpProspects(…, callingOrderModeRef.current)` (115–118). The Subs branch orders through `orderSubsDeck` (126–131): a run's ids in their order, or the trade filter with By need or By rank. The Jobs to GC branch merges the jobs (135) and orders by Soonest bid. Finally, if the `?prospect_id` row is missing from the list, it fetches that row and prepends it (140–160; a row of another kind switches `?kind=` instead, 155–158; a hidden ZZ row opens nothing).
  - Loaders in the page: `loadComments` 451–464, `loadMyTimeToday` 466–476, `loadQuickNotes` 492–500, `loadProspectLedgerSeconds` 661–669, `loadScheduledCallback` 679–700 (useCallback). In `useProspectCopyTemplates.ts`: `loadCopyTemplates` 70–82, `loadPersonPhone` 84–106 (users → people fallback), `loadEmailSentTemplateKeys` 214–223. The timer events and the my-time stats are read by their windows as they mount (`lib/prospects/prospectTimerIo.ts`).
  - Notes, in the page: `saveFollowUpNotes` 620–637, `cancelFollowUpNotes` 639–641. Copy templates, in `useProspectCopyTemplates.ts`: `getResolvedCopyText` 116–118 / `getResolvedCopySubject` 120–122, `handleCopyTemplate` 124–153, `handleOpenMail` 155–187, `openEditCopyModal` 189–193, `saveCopyTemplate` 195–212.
  - `takeCallingLock(trigger)` (`useCallingLock.ts` 53–88, useCallback). It reads the lock row, runs `callingLockDecision`, upserts only on `take` / `stale-take`, names the holder on `held-by-other`, and records `prospect_lock_taken` via `recordNavClick`.
  - Queue: `switchCallingOrder` (page 175–177, around `useProspectsData.ts` 237–252), `renderCallingOrderToggle` (`ProspectsFollowUpTab.tsx` 214–248; two more orders on Subs, one more on Jobs to GC), `renderQueueRows(limit, collapseOnJump)` (`ProspectsFollowUpTab.tsx` 250–303).
  - Callbacks and timer events, in the page: `openCallbackModal` 742–745, `saveCallback` 747–764, `saveTimerEvent` 766–774.
  - Outcomes, in the page: `handleNoLongerFit` 776–804, `handleCantReach` 806–830, `handleConverted` 839–870, `handleAskedUs` 971–1011, `handleBenchSave` 895–950. **`handleConverted` opens the global Add customer modal** via `useNewCustomerModal().openNewCustomerModal({ initialValues: customerDraftFromProspect(p), sourceProspect, conversionLane: 'follow-up', onCreated })`. The form's Save runs `markProspectConverted`, and `onCreated` then writes the timer event, releases the lock, patches both caches and advances. Cancel writes nothing.
  - Call logging: `writeCallOutcome` (page 1066–1088), `markCalledLocally` (`useProspectsData.ts` 267–270), and in the page `handleDidntAnswer` 1098–1134, `handleAnswered` 1136–1159 (sets `last_contact` + warmth +1), `handleAddComment` 1161–1182.
  - The run: `noteRunOutcome` (`useCallRun.ts` 54–61), `sendRunText` (68–107), the reset effect (45–51), and the run branches inside `handleDidntAnswer` (page 1112–1129) and `handleNextProspect` (1209–1217).
  - Quick notes and advance, in the page: `handleQuickNoteClick` 1184–1186, `handleAddQuickNote` 1188–1199 (`promptDialog`), `handleDeleteQuickNote` 1201–1206, `handleNextProspect(skipTimerEvent?)` 1208–1229.
- **Effects (17):**
  - `useCallRun.ts` 45–51: a new run starts clean
  - page 502–511: per-user loads (quick notes, `users.name`); `useProspectCopyTemplates.ts` 108–114: the copy templates and the phone
  - page 513–518: queue load
  - page 612–614: the text ask closes on a new card
  - page 616–618: notes sync
  - `useProspectsData.ts` 209–215: index sync from `?prospect_id`
  - page 651–659: comments
  - `useProspectCopyTemplates.ts` 225–232: email-sent keys
  - page 671–677: ledger seconds
  - page 702–704: scheduled callback
  - `useCallingLock.ts` 34–45: lock **release-only**; deletes only when `lockTakenForRef` says this tab wrote the row, through `releaseCallingLock`
  - page 707–715: `visibilitychange` resets the timer
  - page 718–725: 1-second interval, gated on `cardClockTicks({ onDeck, visible, hasCard })` and keyed on the card
  - page 728–733: textarea auto-resize
  - page 736–740: `didntAnswerMoveNext` preference
  - `useProspectsData.ts` 219–234: calling-order preference; reloads the queue if it is not `coldest`
- **Supabase tables:**
  - `prospects`: SELECT/UPDATE/DELETE
  - `prospect_calling_locks`: SELECT on load and in `takeCallingLock`; UPSERT `onConflict: 'prospect_id'`; DELETE on release and on an outcome, through `releaseCallingLock`
  - `prospect_comments`: SELECT with `created_by_user:users!prospect_comments_created_by_fkey(name, email)`; INSERT; DELETE on retag
  - `prospect_callbacks`: SELECT/INSERT
  - `prospect_timer_events`: SELECT/INSERT, always through `(supabase as any)`
  - `prospect_email_sent`: SELECT/UPSERT
  - `user_prospect_quick_notes`: SELECT/INSERT/DELETE
  - `user_prospect_copy_templates`: SELECT/UPSERT
  - `app_settings`: copy-template defaults
  - `users`: own name, phone, and the lock holder's name
  - `people`: phone fallback
  - through the lib: `prospect_jobs` (`gcLeadLaneIo.ts`), the GC board's tables (`lib/gc/gcIo.ts`: `loadGcProjects`, `loadGcBoardRows`, `addGcCompany`, `askGcCompanies`), `contacts` / `contact_channels` and the RPC `contact_for_prospect` (`prospectThreadIo.ts`)
  - edge function: `quo-send` (the run's text)
- **Sub-components:** `SubsNeedsPanel`, `GcWorkStrip`, `ProspectJobsBox`, `ProspectCopyTemplateRow` (with the three icons), `EmptyState`; the page mounts `GcCallScriptWindow` and `ProspectBenchModal`. `renderCallingOrderToggle` + `renderQueueRows` are render helpers drawn twice (the mobile peek and the desktop rail), which makes them a presentational child to lift (`FollowUpQueue`).
- **External coupling:**
  - localStorage keys `prospects_didnt_answer_move_next_<uid>` (`DIDNT_ANSWER_MOVE_NEXT_KEY`, `ProspectsFollowUpTab.tsx` 31; read by the page's effect 736–740, written by the tab's checkbox at 926, neither try/catch-guarded) and `prospects_calling_order_v1_<uid>` (`CALLING_ORDER_STORAGE_KEY`, read and written in `useProspectsData.ts` 219–252, guarded)
  - `navigator.clipboard` (`handleCopyTemplate`) and `window.location.href = mailto:…` (`handleOpenMail`), both in `useProspectCopyTemplates.ts`
  - the global Add customer modal context; the router's state on `/gc?new=1`
  - `PORTAL_COMPANY` from `supabase/functions/_shared/portalCompany`, imported by `useCallRun.ts` (10): the run's text names the company
  - its rows feed Activity, Quickfill's team chart and Calendar callbacks (inbound `?tab=follow-up&prospect_id=` from `Calendar.tsx`)
- **Extraction status, risk and approach:** **Extracted (v2.7638), props only.** The page keeps the pointer, the caches, `saving` and the outcomes that write them, so a typed comment and the clock survive a tab switch. What is left is the width of the seam: 82 props, 40 values, 11 setters and 31 handlers by name. **Medium risk** for the next step, `useFollowUpDeck` (see [the order](#recommended-extraction-order-value--risk)): the clock's effects and `saveTimerEvent` read `followUpTimerSeconds` from the render they were made in (see [Hazards](#hazards)).

### `board` — Board (Subs only)

- **Render location:** page 1461–1497. The page filters `prospectListProspects` to the live rows, builds `calledIds` from `prospectLastCallMap`, and mounts `<SubsBoard>` (1472) with 20 props.
- **Owned state:** `laneRanks` with the memo `lanePins` (`useSubsBoardData.ts` 19–20); `laneCallRows` (`useProspectsData.ts` 63) and `inboundProspectIds` (`useSubsBoardData.ts` 16) with the memo `subRecordMap` (page 178); `laneCallbacks` (`useSubsBoardData.ts` 17).
- **Cross-tab / shared state:** `prospectListProspects`, `prospectLastCallMap`, `gcBench`, `gcPlans`, `plansPick`, `saving`.
- **Props that are page handlers:** `onPick={setPlansFor}`, `onCall` (1484, navigates to `runHref(ids, trade, plansFor, packageId)`), `onBench={openBenchModal}`, `onPass={passFromBoard}`, `onEdit={openEditModalForProspect}`, `onAddSub={openAddSub}`, `onDrop={dropOnBoard}`, `onUnpin={unpinOnBoard}`, `onPriority={savePriority}`, and `strip={subsStrip(…)}` as a drawn node (page 1254–1256).
- **Loaders:** the list's loader (page effect 520–524), which on Subs calls `loadLaneExtras` for the live rows (`useProspectsData.ts` 203), which calls `loadLaneRanks`.
- **Supabase tables:** `prospect_trade_ranks` (SELECT/UPSERT `onConflict: 'prospect_id,trade'`/DELETE), `contacts`, `messages`, `prospect_callbacks` (SELECT), `prospects` (UPDATE `priority`, `prospect_fit_status`).
- **Sub-components:** [`SubsBoard`](../src/components/prospects/SubsBoard.tsx) (**extracted**, dnd-kit; a card's sortable id is `tradeKey:prospectId`), over `subsBoard.ts`, `subRecord.ts`, `subsRanks.ts`.
- **Extraction status:** **Done.** The drawing is in `SubsBoard`; the ranks, the extras and the pin writes are in `useSubsBoardData` (v2.7634). `savePriority` (page 479–490) stays in the page, because it patches three caches; the pins are optimistic with a reload on refusal.

### `prospect-list` — Prospect List

- **Render location:** page 1499–1524 mounts `<ProspectsListTab>` (1500). The tab is `ProspectsListTab.tsx` 57–417, its props type 22–50, over `useProspectListTab` (page 536).
  - Search input at 95, then a grouping IIFE: `filterProspectsForList` (106), and on Subs `<SubsLaneList>` (112) draws the whole list instead.
  - Otherwise `groupProspectsForList(filtered, calledIds, nowMs)` (140). The jump-chip row covers every section except `cant_reach`/`not_a_fit` (142); the `converted` chip reads the lane's `landedChip` (175).
  - Each `LIST_SECTION_ORDER` section (180) is collapsible (`plist-sec-<key>`, 185) with a desktop table (from 201) and mobile cards (from 316).
  - "Last touch" shows `lastTouchLabel(p, prospectLastCallMap[p.id], nowMs)` (259, 352) plus `formatTimerSeconds(prospectLedgerSecondsMap[p.id])`.
  - Terminal sections (`converted` / `cant_reach` / `not_a_fit`) get Edit / Send back / Not a fit / Delete. Other rows select into Follow Up.
  - The empty list's words and press come from the page's `prospectListEmpty` (350–356), drawn at 149.
- **The Subs list** (`SubsLaneList.tsx` 29–201): the path strip, the For picker, then one section a trade in the needs panel's order (`groupSubsByTrade`), each row (93–150) with its stage chip (`subStage`, `STAGE_TONE_STYLE` 16–22) and its press (`rowPress`: **Call now →**, **Add to the bench ✓**), then the folds *No trade named*, the landed rows and the exits. Section doors (151–175): **Call for ‹trade› →** (`callForTradeHref`) or **Add a sub** (`openAddSub`).
- **Sections (pipeline, not warmth):** `never_called` → `recent` (<30 d) → `going_cold` (30–90 d) → `cold` (90 d+) → `converted` → `cant_reach` → `not_a_fit`. `LIST_SECTIONS_DEFAULT_OPEN` = `never_called` + `recent`.
- **Owned state (5), in `useProspectListTab.ts`:** `subsSectionOpen` 35, `prospectListSearchQuery` 36, `prospectListSectionOpen` 37, `selectedProspectForList` 38, `prospectLedgerSecondsMap` 39. `prospectListLoading` is the data hook's (`useProspectsData.ts` 68).
- **Cross-tab / shared state:** `prospectListProspects`, `followUpProspects` (patched by `handleSendBack`/`handleDeleteFromList`), `prospectLastCallMap`, `saving`, the shared Edit Prospect window, the bench window (`openBenchModal(p)` from a Subs row), and the pointer (`selectProspectForList` sets `activeTab` and writes `?tab=follow-up&prospect_id=`).
- **Handlers and loaders:**
  - `loadProspectListProspects` (`useProspectsData.ts` 175–204), shared with Convert, the Board and a lane's Activity. It is a `prospects` SELECT by `kind` (less the ZZ rows for a non-dev) plus every call comment newest-first, folded into `prospectLastCallMap` by `lastCallByProspect` (195). On Jobs to GC it merges the jobs (202); on Subs it loads the Board's extras (203).
  - `loadProspectLedgerSecondsMap` (`useProspectListTab.ts` 63–71).
  - In the page: `handleSendBack` 1013–1025, `handleNotAFitFromList` 1027–1038, `handleDeleteFromList` 1040–1057 (`confirmDialog`). `openEditModalForProspect` is the Edit window's (`useEditProspectWindow.ts` 109–117).
  - In `useProspectListTab.ts`: `toggleProspectListSection` 82–84, `jumpToProspectListSection` 86–91 (rAF + `scrollIntoView`), `selectProspectForList` 93–102, `toggleSubsSection` 105.
- **Effects (2 + the shared loader), in `useProspectListTab.ts`:**
  - 42–61: handles `?prospect_id` (from Quickfill's Can't reach). It selects the row, opens its section via `groupProspectsForList([p], …)` when that section is not default-open, then strips the param.
  - 73–80: loads or clears the ledger map on tab entry/exit.
- **Supabase tables:** `prospects` (SELECT/UPDATE/DELETE), `prospect_comments` (SELECT call rows), `prospect_timer_events` (SELECT, `as any`).
- **Extraction status:** **Done (v2.7636).** The page calls the hook, so the search and the open sections survive a tab switch. The row actions stay in the page, where they patch both caches.

### `convert` — Convert (Customers only)

- **Render location:** page 1526–1528 mounts `<ProspectsConvertTab convert={convert} …>`. The tab is `ProspectsConvertTab.tsx` 12–303, over `useProspectConvert` (page 584, `active: activeTab === 'convert'`).
  - The selector, from 43: a type-ahead over `convertPickerPool` where Enter picks the first hit, its hits 69–101 (no hit: `EmptyState`, 72). When the query is empty and nothing is picked, "Suggested — answered in the last 30 days" chips appear (102–118). A summary card follows (119–146).
  - Once `convertProspectId` is set (149–298): `NewCustomerForm` (`mode="page"`, 155), contact-person cards (169–229), bid cards (from 230), and a submit row whose button targets `form="convert-customer-form"`.
  - Its `convert*` class names are styled in `src/index.css`.
- **Owned state (8), in `useProspectConvert.ts` 41–48:** `convertProspectId`, `convertSearchQuery`, `convertContactPersons`, `convertBids`, `convertServiceTypes`, `convertSaving`, `convertError`, `convertFirstInteractionDate`.
- **Cross-tab / shared state:**
  - Reads `prospectListProspects` + `followUpProspects` (the picker pool is their union) and `prospectLastCallMap`.
  - Patches both caches after a successful mark.
  - No default selection: the tab starts on search.
- **Derived values (`useProspectConvert.ts` 98–101, not memoized):** `convertProspect`, `convertPickerPool`, `convertSearchResults = searchConvertProspects(pool, query)`, `convertSuggestions = suggestRecentlyAnswered(pool, prospectLastCallMap, now)`. Converted prospects are excluded by the kernel.
- **Handlers:** `pickConvertProspect` (103–106). `handleConvertSubmit(payload)` (115–155) runs in order:
  1. INSERT `customers`
  2. the `customer_contact_persons` rows (`convertContactRows` skips blank names)
  3. the `bids` rows (`convertBidRows` skips a blank project or service type and hard-codes `materials_model: 'rough'`, `prospectConversion.ts` 313)
  4. `markProspectConverted(...)` + `recordProspectConverted(…, 'convert-tab')`; a failed mark only logs
  5. `navigate('/customers/<id>')`
- **Effects (3 + the shared loader), in `useProspectConvert.ts`:**
  - 57–84: earliest `prospect_comments` date → `convertFirstInteractionDate` (cancellation-guarded, `localCalendarDayKey`)
  - 87–95: `service_types` load on tab activation (`'service_types' as any`, less the billing-only types)
  - 107–113: pre-fill the first contact person
- **Supabase tables:** `customers`, `customer_contact_persons`, `bids` (INSERT); `service_types`, `prospect_comments` (SELECT); plus `prospects` / `prospect_comments` through `markProspectConverted`.
- **Sub-components:** [`NewCustomerForm`](../src/components/NewCustomerForm.tsx) (**extracted**, `onSubmitForConvert`).
- **Extraction status:** **Done (v2.7628).** The page calls the hook, so the form survives a look at another tab; the list's loader effect stays in the page.

### `activity` — Activity (team calling stats, dev and assistant-like)

- **Render location:** page 1530–1532 mounts `<ProspectsActivityTab>` behind `canAccessActivityTab` (244). The tab is `ProspectsActivityTab.tsx` 19–228.
  - The week report: a header on `weekOffset` with ‹ previous / next › (not past 0), the empty week's words (`callingWeekEmptyWords`, 103), per-user cards plus a team card when there is more than one user, and a "Daily detail" table. The landed count reads the lane's `landedCount` (120).
  - **Source success** 160–179, on a lane that is not Customers: `sourceSuccess(laneRows)`.
  - "Marked / Updated by day — last 30 days" 181–225, its days from `getOrderedDateKeysLast30Days`, reversed (187).
- **Owned state (4):** `teamDataByDate` 37, `teamLoading` 38, `weekReport` 39, `weekLoading` 40. `weekOffset` stays in the page (243), so the pager survives a tab switch. The gate `canAccessActivityTab` lives in the parent.
- **Cross-tab state:** `kind`, `kindWords`, `hideZz`, and the lane's rows for Source success (`laneRows`, loaded by the page's effect 527–532).
- **Loaders:**
  - `loadTeamActivity` 42–53 (useCallback) → [`loadProspectTeamActivity`](../src/lib/prospectTeamActivity.ts)`(supabase, kind, { hideZz })`. Quickfill's team chart reads the same lib for every kind.
  - `loadWeekReport` 59–68 (useCallback) → [`loadProspectWeekReport`](../src/lib/prospects/prospectWeekReportIo.ts) (10–52), which runs 4 parallel reads: `users` (audience `.or(...)`), `prospect_comments` call/converted rows in `weekRange`, `prospect_timer_events` (`as any`), and `prospect_callbacks`, each joined on `prospects!inner(kind)`. The results feed [`buildProspectWeekReport`](../src/lib/prospects/prospectWeekReport.ts).
  - Effects: 55–57 and 70–72.
- **Supabase tables:** `users`, `prospect_comments`, `prospect_timer_events`, `prospect_callbacks`.
- **Extraction status:** **Done (v2.7626).**

### `team` — Hiring (extracted wrapper)

- **Render location:** page 1368–1370: `<TeamProspectsTab authUserId={authUser.id} isDev={authRole === 'dev'} canEditOnboarding={isOwnerOrDev(authRole)} resolveMasterId={getEffectiveMasterId} shared={!teamProspectsAccess} />`.
- **In the parent:** `useMyHiringShares` (107) + `canOpenHiring` (108). The `?tab=` effect waits for `hiringSharesLoading` as it does for `authLoading`.
- **Extraction status:** **Done at page level.** The component is the surface's second God component; see the next section.

### `permits` — Permits (extracted)

- **Render location:** page 1372: `<ProspectsResearchTab authUserId={authUser.id} />`. The key was `research` until v2.6787, and the old key still opens the tab and is rewritten.
- **In the parent:** `canResearch` (110), the `?tab=` branch 278–295, `openResearchTab` 429–438 (it drops the tab's own address keys through `permitsLinkCleared`, so the tab's name opens on Skim), and the estimator's landing (322).
- **What the tab owns, all of it outside this file:** [`ProspectsResearchTab.tsx`](../src/components/prospects/ProspectsResearchTab.tsx) (814 lines, 30-odd states) and its children (`PermitSkimDeck`, `PermitSkimLook`, `PermitSkimGoogleStill`, `PermitPlaceList`, `PermitBuilders`, `PermitMarket` with `PermitCallList` and `PermitMarketShape`, `PermitBuildingSheet`, `WhoPulledItSheet`, `PermitDecideSheet`, `PermitCloseOutSheet`, `PermitFindPanel`, `PermitCountStrip`, `PermitLookAlikes`, `ResearchMapCard`, `BuilderNameTies`, `GoogleSearchPress`), over the kernels in `src/lib/research/`.
  - Its views: Skim, Investigating, Pursuing, Closed, the second look, Find, Builders, the ledger and the map. On a phone their strip scrolls sideways, and `useLitPillInView` keeps the lit step in view by its `aria-pressed`.
  - Its four verdicts (`VERDICT_WORDS`): **Pursue**, **Investigate**, **Pass**, **Has a plumber**. Pursue makes a lead on the Customers deck or on Jobs to GC (`approachFromPermit`: a `prospects` row, and a `prospect_jobs` row for a lead), which is the tab's one write into this page's tables.
  - Its cities come from `RESEARCH_CITIES`; the feeds are read by the edge functions `permit-pull` and `permit-lookup`. The city picker's rows come from `usePermitCityQuiet` over `permitQuiet.ts`: each city's newest permit day, or *quiet since* that day.
  - Its address keys (`view=builders` or `view=market`, `looks=1`, `city=`) are read and written through `src/lib/research/permitsLink.ts`.
- **Extraction status:** **Done.** `PROJECT_DOCUMENTATION.md` §17 holds the tab's flows. At 814 lines it is under the map threshold; it gets its own map if it passes 1,500.

## TeamProspectsTab sub-decomposition

[`TeamProspectsTab.tsx`](../src/components/prospects/TeamProspectsTab.tsx) (2,376 lines) renders the five-stage hiring pipeline. Stage tabs (1607–1650) come from `allStageTabs` (1598–1604) filtered by `stageAllowed(key, shared)` (1605): Screen (active count) → Interview (`calling`) → Try-out (`trial`) → Hire (`hired`) → Review (`activeUserCount`). It also renders six modals: five are built through one `modal(title, body, onClose, opts)` factory (1506–1520) that shares a single `modalError`, and Share with… is `ShareColumnDialog` (2362–2373). `powers = hiringTabPowers(shared)` (787) hides the office controls from a share holder: `canPass`, `canHire`, `canDelete`, `canAddRole`, `canManageColumn`, `showUnsorted`, `showPassed`, `showSources`, `canEditTrialCard`. A share holder sees only Screen / Interview / Try-out.

**Already extracted from it** (the pattern works; keep going):
- [`ratingDimensions.tsx`](../src/components/prospects/ratingDimensions.tsx): `RATING_DEFS`, `RatingKey`, `COMMENT_KEY_BY_RATING`, `RatingSliders`.
- [`TeamReviewSection.tsx`](../src/components/prospects/TeamReviewSection.tsx) (1,025 lines, self-contained, outside this map's covers). It loads its own data: `activeUsersQuery`, `team_member_reviews` (office + supervisor), RPCs `list_team_member_recent_jobs` / `list_team_member_start_dates`, the crew lane via `lib/teamFeedback.ts` (`crew_review_aggregates`), and `app_settings` composite weights. Its kernels in `src/lib/prospects/` are all tested.
- [`ShareColumnDialog.tsx`](../src/components/prospects/ShareColumnDialog.tsx) (79 lines, v2.3802) and [`LinkifiedText.tsx`](../src/components/prospects/LinkifiedText.tsx).
- Lib kernels:
  - [`teamProspectRanking.ts`](../src/lib/teamProspectRanking.ts): `groupTeamProspects` (now also yields `trial`), `reorderActiveTeamProspects`, `moveTeamProspectAcrossRoles`, `nextTeamProspectRank`, `roleKeyOf`
  - [`teamProspectSourceSummary.ts`](../src/lib/teamProspectSourceSummary.ts)
  - [`candidateHygiene.ts`](../src/lib/prospects/candidateHygiene.ts) (v2.2459): `analyzeCandidates` → `duplicateOf` / `crossRoles` / `callNextByRole` / `neverContactedByRole`
  - [`helperTrial.ts`](../src/lib/prospects/helperTrial.ts): `isHelperColumn`, `tryOutBlocker`, `trialSinceLabel`
  - [`hireRosterKinds.ts`](../src/lib/prospects/hireRosterKinds.ts)
  - [`lib/hiring/trialTally.ts`](../src/lib/hiring/trialTally.ts): `buildTrialTally`, `trialVerdictMark`
  - [`lib/hiring/columnShares.ts`](../src/lib/hiring/columnShares.ts)
  - [`lib/hiring/sharedHiringTab.ts`](../src/lib/hiring/sharedHiringTab.ts)

**Module-level in the file** (pure props, so they can move to their own files verbatim):

| Symbol | Lines | Notes |
|---|---|---|
| `parseCandidateLinks` / `serializeCandidateLinks` | 166–178 / 181–186 | pure, **untested** (Stage-A) |
| `EmailText` | 193–208 | v2.3601 wrap-at-`@` |
| `CandidateLinkChips`, `CandidateRatingBars` | 211–238, 244–267 | |
| `inputStyle`, `labelSpanStyle`, `NUDGE_TONE` | 269–276 | |
| `TrialTallyBlock` | 283–313 | v2.3715 |
| `smallButtonStyle`, `dropId`, `boardCollisionDetection`, `formatLastContact` | 315–347 | custom collision order: `pointerWithin` → `rectIntersection` → `closestCorners` |
| `CandidateFields` | 349–453 | Add + Edit modal body |
| `SortableCandidateCard` | 456–629 | `useSortable`; props `candidate`, `rank`, `busy`, `onEdit`, `onMarkContacted`, `onSetStatus`, `onPullUp`, `onTryOut`, `duplicate`, `canPass`, `alsoInRoles`, `isCallNext` |
| `RoleColumn` | 632–782 | `useDroppable`; own `menuOpen` (671); ⋯ menu (Share with…, Delete column) 706–745; delete confirm 746–760 |

**Internal shared substrate:** `rows`, `roles`, `loading`, `busy` (34 readers, 18 writers), `modalError`, `stage`, plus the `load`-fed `activeUserCount` (read only by the stage-tab row, 1603), `reviews` (read by `mergeDuplicate` on Screen and by Interview) and `reviewerNames` (Interview's reviewer names and the Share dialog's `nameOf`, 2369).
- `load()` 854–902 runs 8 parallel reads: `team_prospects`, `team_prospect_roles`, `team_prospect_reviews`, `team_onboarding_items`, `team_prospect_onboarding_statuses`, the active-`users` count, RPC `team_prospect_trial_tally` (fail-soft), and `team_prospect_role_shares`. A follow-up `users` names read then covers reviewers and sharers.
- Derived per render (908–927): `groupTeamProspects(rows)` → `activeByRole`/`calling`/`trial`/`hired`/`passed`, plus `reviewsByProspect`, `roleNameById`, `referencedCountByRole`, `unsortedActive`, `sourceSummary`, `knownSources`, `hygiene` (Screen candidates only) and `rowById`.
- Shared handlers: `setStatus` 1135–1149 (`hired` opens the roster hand-off), `openEdit` 1481–1498, `markContacted` 1386–1399, `startTryOut` 1156–1180 (from Screen cards and Interview), `renderCard` 1573–1593.
- If the stages are split, this becomes `useTeamProspectsData`.

**Per-stage inventory:**

- **Screen:** header 1651–1689 (`boardIntro(shared, roles.length)` + Add role, gated by `powers.canAddRole`), board 1691–1738 (`DndContext` + one `RoleColumn` per role + Unsorted when `powers.showUnsorted` and non-empty), Passed bucket 2045 (`bucketSection` 1522–1565, `powers.showPassed`) and Source success 2047–2094 (`powers.showSources`).
  - Owned state: `addingRole`, `newRoleName`, `confirmDeleteRoleId`, `passedOpen`, `sourcesOpen`.
  - Handlers: `handleDragEnd` 950–994 (+ `applyListsToRows` 944–948, `persistRankUpdates` 929–942), `addRole` 1401–1426 (`resolveMasterId`), `deleteRole` 1464–1479, `openAdd` 1500–1504, `mergeDuplicate` 1085–1133 (from the card's duplicate chip, `powers.canDelete`).
  - Share cluster: `openShare` 1429–1443, `toggleShare` 1446–1462 (one INSERT/DELETE per tick).
- **Interview** (1740–1845): read-only per-role columns of `calling` candidates with tel links and everyone's reviews.
  - Buttons: My review / Talked today / Back to Screen / Try out (helper columns only) / Advance to Hire (`canHire`) / Pass (`canPass`).
  - Owned state: `reviewTarget`, `reviewDraft`. It also reads `reviews`/`reviewerNames` from `load`, which stay at TPT level (`mergeDuplicate` reads `reviews`; the Share dialog reads `reviewerNames`).
  - Handlers: `openReview` 1241–1254, `saveReview` 1256–1281 (upsert `onConflict: 'team_prospect_id,reviewer_user_id'`). Modal 2172–2219.
- **Try-out** (1846–1911; v2.3627, tally in v2.3715): trial cards with `trialSinceLabel` and `TrialTallyBlock(buildTrialTally(row, { todayYmd: todayYmdInAppTz(), prefixMap }))`.
  - Buttons: Hire / Keep trying (only when the nudge asks and the card is not deferred) / Talked today (`canEditTrialCard`) / Pass.
  - Owned state: `trialTallies`.
  - Handlers: `endTryOut` 1183–1207 (RPC `end_team_prospect_trial`; Hire switches the stage to `hire`), `keepTrying` 1214–1228 (stamps `trial_deferred_at`/`_by`).
  - Entry point is `startTryOut`: `tryOutBlocker` check → `confirmDialog` → `create-user` edge function `{ trial_prospect_id }` → stage `tryout`.
- **Hire** (1912–2036): onboarding tracker plus "Add to roster".
  - Owned state: `onboardingItems`, `onboardingStatuses` (a Map keyed `` `${prospectId}:${itemId}` ``; a missing key means pending), `onboardingSettingsOpen`, `newItemLabel`, `newItemLink`, `itemDrafts`.
  - Handlers: `cycleOnboardingStatus` 1301–1315 (optimistic upsert, `ONBOARDING_STATUS_META` 125–129), `addOnboardingItem` 1317–1334, `saveOnboardingItem` 1336–1355, `moveOnboardingItem` 1357–1372 (index-based two-row position swap), `deleteOnboardingItem` 1374–1384.
  - Settings modal 2269–2361. The roster hand-off (`hireTarget`, `hireKind`; `openRosterHandoff` 1235–1239 pre-selects `suggestRosterKind(roleName)`; `addHireToRoster` 1283–1298; modal 2221–2267) is opened from `setStatus('hired')` too, so it **stays at TPT level**.
  - The onboarding legend renders only when items exist or `canEditOnboarding`. The ⚙ Onboarding settings button is the owner's and a dev's since v2.6763 (`canEditOnboarding`, with the Team review weights as `canSetWeights`); the "no items yet" pointer is dev-only.
- **Review** (2037–2044): `<TeamReviewSection authUserId isDev initialRateUserId={rateUserIdFromUrl} onOpenScreenBoard={() => setStage('screen')} />`. Done.
- **Cross-stage modals:** Add 2096–2121 (`addOpen`/`addDraft`); Edit 2123–2170 (`editTarget`/`editDraft`/`confirmingDelete`; delete gated by `powers.canDelete`, opened from Screen cards, Try-out, Hire rows and the Passed bucket); My review; Hire-to-roster; Onboarding settings; Share (`ShareColumnDialog` 2362–2373).

**Supabase (whole component):**
- `team_prospects`: SELECT/INSERT/UPDATE/DELETE; jsonb `links` is written `as unknown as string`
- `team_prospect_roles`: SELECT/INSERT/DELETE
- `team_prospect_reviews`: SELECT/UPSERT, plus UPDATE when a merge re-points a review
- `team_onboarding_items`: SELECT/INSERT/UPDATE/DELETE
- `team_prospect_onboarding_statuses`: SELECT/UPSERT
- `team_prospect_role_shares`: SELECT/INSERT/DELETE
- `users`: count, names, shareable accounts
- `people`: INSERT (roster hand-off)
- RPCs: `end_team_prospect_trial`, `team_prospect_trial_tally`. The tally RPC is called `as never`, so the fact sheet's RPC list misses it.
- Edge function: `create-user`

**Sub-decomposition approach:**
1. Move the module-level components and helpers to their own files: pure moves, doable anytime.
2. Extract `TeamHireStage` (+ Onboarding settings modal). Its onboarding cluster is used nowhere else; pass `onboardingItems`/`onboardingStatuses` down from `load` or split them into their own loader.
3. Extract `TeamTryoutStage`.
4. Extract `TeamInterviewStage` (+ My review modal).
5. Extract Screen last: it owns the drag machinery, hygiene, and the Passed/Sources/Share sections.

`rows`/`roles`/`load`/`busy`/`modalError`/`setStatus`/`openEdit`/`markContacted`/`startTryOut` and the roster hand-off stay in TeamProspectsTab and are passed down, mirroring the page-level rule. The share cluster (`shareRoleId`, `shareAccounts`, `shareAccountsLoading`, `openShare`, `toggleShare`) can become a hook next to `ShareColumnDialog`; it takes `shares`, `reviewerNames`, `roles` and `busy` from TPT.

## Page-level windows

Every window mounts at the end of the page (1534–1553), behind its open flag.

| Window | Anchor | State | Opened from | Status |
|---|---|---|---|---|
| Edit Prospect | page 1534; `EditProspectWindow.tsx` 14–148 over `useEditProspectWindow.ts` 20–202 (page 547) | in the hook: `editModalOpen` 45, `editingProspect` 46 (null ⇒ edits `currentProspect`), `editSource` / `editTrades` / `editMaxMiles` / `editRole` 48–51, the `editPerson` / `editCompany` blocks 52–53, `editOpenedWith` 54; `editGuard` (59) with `LeaveQuestion`; `openEditModal` 91–100 / `openEditModalForProspect` 109–117, `setEditKindFields` 102–107, `handleDeleteProspect` 119–145, `saveEdit` 147–176; warmth ± (`handleWarmthDelta` 66–77 / `handleWarmthReset` 79–89) drawn at `EditProspectWindow.tsx` 113–125, only when editing the current prospect; `ProspectPersonForm` and `renderKindFields` (`ProspectKindFields.tsx` 9–85) | Follow Up "Edit prospect", Prospect List row actions, the Subs list, a Board card | **Extracted v2.7637**; the page calls the hook |
| New Prospect | page 1553; `NewProspectWindow.tsx` 15–194 over `useNewProspectWindow.ts` 17–167 (page 561) | in the page: `newProspectModalOpen` 131, `newKind` 132 (the bench read keys on it); in the hook: `newCustomerLink` 51, `newProspectError` 52, `newSource` / `newTrades` / `newMaxMiles` / `newRole` 53–56, the `newPerson` / `newCompany` blocks 57–58; `newGuard` (63) with `LeaveQuestion`; the double line (`newProspectTwin` 100–102, drawn at `NewProspectWindow.tsx` 131–163 with its three doors); `openNewProspect` 82–88, `openAddSub` 91–98, `resetNewProspectForm` 70–79, `closeNewProspect` 65–68, `saveNewProspect` 104–142 (`getEffectiveMasterId`, `blocksProblem`; switches lanes when `newKind` is not the lane's, 138); `openDoubleProspect` stays in the page (358–373) | the tab row's button (page 1356–1364, `canAccessFollowUp`), `?newProspect=true` (332–342), the empty lane (`ProspectsFollowUpTab.tsx` 341–346), the empty list, Add a sub (the needs panel, the Subs list, the Board) | **Extracted v2.7637** |
| Callback | page 1536; `ProspectCallbackModal.tsx` 8–99 | `callbackModalOpen` (page 195); the three boxes in the window (19–21); `saveCallback` (page 747–764), which holds `saving` | Follow Up only | **Extracted v2.7623** |
| Copy template edit | page 1538; `ProspectCopyTemplateEditModal.tsx` 9–147 | the copy hook's `editingCopyTemplateKey`, `editingCopyText`, `editingCopySubject`, `copyTemplateSaving`, and the placeholder chips through `copyTemplateTextareaRef` (`useProspectCopyTemplates.ts` 61–68) | Follow Up only, Customers only | **Extracted v2.7632** with `useProspectCopyTemplates` |
| Copy blank fields | page 1540; `ProspectCopyBlankFieldsModal.tsx` 7–53 | `copyBlankFieldsModalOpen`, `copyBlankFieldsList` (`useProspectCopyTemplates.ts` 65–66) | Follow Up only | **Extracted v2.7632** with `useProspectCopyTemplates` |
| Timer history | page 1542; `ProspectTimerHistoryModal.tsx` 10–100 | `timerHistoryModalOpen` (page 223); its rows and their read in the window (11–25, `loadProspectTimerEvents`) | Follow Up `this call` timer | **Extracted v2.7623**: reads on every open |
| My time | page 1544–1546; `ProspectMyTimeModal.tsx` 10–105 | `myTimeModalOpen` (page 226); its stats and their read in the window (11–25, `loadMyTimeStats`); the live `followUpTimerSeconds` as `liveSeconds` while `activeTab === 'follow-up'` | Follow Up footer | **Extracted v2.7623**: reads on every open |
| Call script | page 1548 | `scriptOpen` (179); `<GcCallScriptWindow job={run ? { trade, project } : null}>` | the Subs card's **Call script** | Extracted; its flag stays in the page |
| Add to the bench | page 1549–1551 | `benchDraft` (the prospect, the draft, the ask), `benchSaving`, `benchError` (124–126); `<ProspectBenchModal onSave={handleBenchSave}>` | the Subs card's last press, a Subs list row, a Board card | Extracted; stays with `handleBenchSave` in the parent |

**May we text?** is not a window: it is a chooser inline on the card (`ProspectsFollowUpTab.tsx` 384–419, `textAskOpen`).

## URL / navigation router (parent, permanent)

All of it is in the page.

- **`?tab=`** effect 246–329 waits for `authLoading` **and** `hiringSharesLoading`, because the per-user grants arrive with the role.
  - `subs` and `gc-leads` are doors, not tabs (252–261): each is rewritten to `tab=follow-up` with `kind=`.
  - `team` requires `canOpenHiring` (265–277); otherwise it rewrites to `follow-up` (`replace: true`).
  - `permits` (or the older `research`, rewritten to `permits`) requires `canResearch` (278–295); otherwise it rewrites.
  - `activity` requires `canAccessActivityTab`, `convert` the Customers lane, `board` the Subs lane (299); otherwise it rewrites.
  - A missing tab resolves through [`resolveProspectsLanding`](../src/lib/prospects/prospectsLanding.ts) and is written into the URL (314–327). An estimator with no Prospects flag lands on `permits` (322).
  - `setTab`, `setKindTab`, `openTeamTab` and `openDoubleProspect` remember the clicked top tab in localStorage (`prospects:lastTopTab`); `openResearchTab` and URL-driven landings never write it. Each also sets `?tab=` and deletes `prospect_id`.
- **`?kind=`** (`gc-leads`, `subs`; bare for Customers): read first by `kindFromSearch` for the state's initial value (121), then by the `?tab=` effect (263). Written by `setKindTab` (408–427), which also drops `trade` and `for` off the Subs lane, by `openDoubleProspect`, and by `loadFollowUpProspects` when an inbound `?prospect_id=` is another lane's row (`useProspectsData.ts` 155–158).
- **`?prospect_id=`:**
  - read by `loadFollowUpProspects` (fetch-and-prepend when missing), the index-sync effect (`useProspectsData.ts` 209–215), and the Prospect List effect (`useProspectListTab.ts` 42–61, which opens the right section, then strips the param)
  - written by `updateUrlProspectId` (`useProspectsData.ts` 254–262) on every advance/removal/queue jump, by `selectProspectForList` and by `openDoubleProspect`
  - inbound from Calendar (follow-up), Quickfill's Can't reach (prospect-list) and GC projects' *Send the owner back to Prospects* (`?tab=gc-leads&prospect_id=`)
- **`?trade=`** (Subs): the deck's trade filter. Read at 180 and inside `loadFollowUpProspects` (`useProspectsData.ts` 131); written by `setTradeFilter` (375–383, which also drops `prospect_id`); inbound from the bench's *Find N more* (`subsLaneHref`) and the list's **Call for ‹trade› →**.
- **`?for=`** (Subs): the project a set of plans is for. Read at 184; written by `setPlansFor` (386–393); carried by the run and by `boardHref`.
- **`?run=`** with `?trade=`, `?for=`, `?pkg=` (Subs): the run's ids, fixed at the press (`runFromSearch` / `runHref`, `callRun.ts`). Read at 188 and inside `loadFollowUpProspects` (`useProspectsData.ts` 126); written by the Board's `onCall` (1484).
- **`?newProspect=true`** (Dashboard quick-add): effect 332–342 opens the New Prospect window and strips the param.
- **`?stage=` / `?rate=`** (from the Dashboard pinned row, Needs you and the Person desk, e.g. `/prospects?tab=team&stage=review&rate=<id>`): handled **inside** TeamProspectsTab (effect 814–826). It passes through `coerceStage(wanted, shared)`, so a share holder's `hire`/`review` is ignored. It is applied once, then stripped.
- **`?view=` / `?looks=` / `?city=`** (Permits): handled **inside** `ProspectsResearchTab` through `permitsLink.ts`. The parent only clears them in `openResearchTab`.

All of this stays in the parent (playbook rule), except the keys the two extracted tabs own and the `?prospect_id=` reads that moved into the data and list hooks with their effects.

## Test coverage by region

`Prospects.tsx` has a render smoke since v2.7615, [`Prospects.render.test.tsx`](../src/pages/Prospects.render.test.tsx): 125 cases, the Hiring board and the Permits tab stubbed, its supabase stand-in lazy the way the real client is (a query is recorded only when it is awaited). Every cut ran its cases against the page before its move and after it. The pieces cut out are proven through it; none of them has a render test of its own. No e2e spec opens `/prospects`. TeamProspectsTab has [`TeamProspectsTab.render.test.tsx`](../src/components/prospects/TeamProspectsTab.render.test.tsx) with 6 cases. There is **no money math on this surface**, and the time sums and the copy-template rules are tested kernels now.

| Region | Tested kernels (`it` blocks) | Render test | Untested inline logic |
|---|---|---|---|
| Shell / router | `prospectsLanding` (4), `prospectConversion` (23, incl. `canAccessProspectPipeline`), `laneLoad` (6), `prospectKinds` (21), `pagePadding` (2), `permitsLink` (9) | the smoke: every `?tab=` key on every lane, the lane doors, the roles | the `?tab` rewrite effect 246–329 and `setKindTab`'s param rules 408–427, both pressed by the smoke |
| Data seam | `subsDeckOrder` (9), `callingOrder` (31), `callLogState` (10) | the smoke: the calling orders, By rank with pins, Soonest bid, the ZZ rule, a lane switch | — |
| The lanes | `subsLane` (13), `gcNeeds` (13), `subsStages` (12), `gcLeadLane` (14), `stripState` (1), `zzProspects` (2), `companyDouble` (9), `benchAsk` (2), `benchOrigin` (3), `benchRead` (5) | `ProspectJobsBox` (7), `ProspectBenchModal` (6), the smoke | `handleBenchSave`'s cache and pointer patch (page 924–943); `handleAskedUs`'s chain |
| Follow Up | `callingOrder` (31), `callingLock` (10), `callingLockIo` (2), `callLogState` (10), `callRun` (17), `deckWords` (6), `textingRule` (1), `personBlock` (9), `phoneContact` (5), `prospectCopyTemplates` (27), `prospectFormat` (13), `prospectTimerSums` (11), `prospectTimerIo` (4), `leadThread` (18) | the smoke: the outcomes, the pointer, a run and its text, the lock, the copy templates | `writeCallOutcome`'s insert-then-delete (page 1066–1088) |
| Board | `subsBoard` (8), `subRecord` (7), `subsRanks` (3) | `SubsBoard` (4), the smoke (the Board's writes) | `writePins`' optimistic paint (`useSubsBoardData.ts` 50–69) |
| Prospect List | `prospectListGrouping` (13), `callLogState` (10), `subsStages` (12) | the smoke: search and sections across a tab switch, the row actions | — |
| Convert | `convertProspectSearch` (8), `prospectConversion` (23) | the smoke: a full Convert, a bid card left out, a suggestion | `handleConvertSubmit`'s insert chain (`useProspectConvert.ts` 115–155) |
| Activity | `prospectTeamActivity` (4), `prospectWeekReport` (9), `prospectTeamActivityChartData` (2, Quickfill's, whose date keys the tab reuses) | the smoke: a week, a caller's week, an empty week, Source success | — |
| New / Edit windows | `companyOwner` (4), `companyDouble` (9), `windowLeave` (7), `personBlock` (9), `mapsShareText` (4), `prospectKinds` (21) | `ProspectPersonForm` (3), the smoke: both leave questions, New Prospect by kind, the empty lane's press, Edit's warmth and Delete | — |
| Guard | `src/lib/unsentQueries.test.ts` (3): no source file builds a supabase query and drops it unsent | — | — |
| Permits (`ProspectsResearchTab`) | the kernels under `lib/research/` | `ProspectsResearchTab` (53), `PermitBuilders` (15), `PermitMarket` (16), `PermitCallList` (13) | outside covers |
| TPT Screen | `teamProspectRanking` (23), `teamProspectSourceSummary` (16, incl. an `it.each` matrix), `candidateHygiene` (8), `columnShares` (7), `sharedHiringTab` (4) | share chip + column menu; share-holder trimmed board | `parseCandidateLinks`/`serializeCandidateLinks`; `mergeDuplicate` merge rules 1096–1122; `handleDragEnd` wiring |
| TPT Interview | — | — | review draft ↔ row mapping (1242–1251) |
| TPT Try-out | `helperTrial` (6), `trialTally` (13) | 3 cases (helper-column gating, trial card dated by the company calendar, tally + nudge + Keep trying) | — |
| TPT Hire | `hireRosterKinds` (7) | — | `moveOnboardingItem` swap 1357–1372 |
| TPT Review (`TeamReviewSection`) | `teamMemberReviews` (22), `reviewerCalibration` (9), `teamComposite` (9), `teamLeaderboard` (4), `teamReviewDue` (12) | — | outside covers |

## Stage-A pure-logic inventory

Stage A for the page is done: every rule the map found inline at `6af60c5bcf` now lives in a tested kernel. The table keeps the record of where each went. Row 16 is the Hiring tab's and is still open.

| # | Candidate | Status | Where it lives |
|---|---|---|---|
| 1 | the copy-template rules: placeholder substitution, `_______` per template, blank fields with the `forMail` rule, the four key tables, the override fallback, the two reads' fold | **shipped v2.7595** | `lib/prospects/prospectCopyTemplates.ts` (`substituteCopyPlaceholders`, `getBlankPlaceholderFields`, `getBlankFieldsForMail`, `resolveCopyText`, `foldCopyTemplateRows`) |
| 2 | the `Prospect` type, `PROSPECT_COLUMNS`, `ProspectComment` | **shipped v2.7598** | `lib/prospects/prospectRow.ts` (every type key is in the column list and nothing else is) |
| 3 | `formatDateTime`, `formatInteractionType`, `formatTimerButtonName`, `formatTimerSeconds`, `formatWebsiteDisplay`, `getWebsiteHref`; TPT's `formatLastContact` (341–347) | the page's six **shipped v2.7595 / v2.7598**; TPT's still module-level, untested | `lib/prospects/prospectFormat.ts` |
| 4 | the queue after a card leaves, written six times | **shipped v2.7603**, the six call sites with it | `queueAfterRemoval` and `indexAfterOtherRowLeft` in `callingOrder.ts` |
| 5 | the my-time windows and the timer sums | **shipped v2.7606** | `lib/prospects/prospectTimerSums.ts` (`sumTimerSeconds`, `sumTimerSecondsByProspect`, `myTimeWindows`) |
| 6 | `kindFieldsPayload`, `editSnapshotOf` | **shipped v2.7606** | `prospectKinds.ts` and `windowLeave.ts` |
| 7 | the `sourceProspect` literal, written twice | **shipped v2.7606** | `sourceProspectOf(p)` beside `customerDraftFromProspect` in `prospectConversion.ts` |
| 8 | the Subs deck's order (a run's ids in their order, else the trade filter, By need, By rank over the pins) | **shipped v2.7634** with its loader | `orderSubsDeck` in `lib/prospects/subsDeckOrder.ts` |
| 9 | the bench read's shaping (the dependable counts, the quoted set, the plans' input, our own trades, the vetted flag) | **shipped v2.7631** with `useSubsBench` | `benchReadFromBoard` in `lib/prospects/benchRead.ts` |
| 10 | `handleSendBack`'s re-insert comparator; the queue window's start | **shipped v2.7603** | `insertColdest` and `queueWindowStart` in `callingOrder.ts` |
| 11 | the last-call map's build (the first row per prospect of the newest-first call rows) | **shipped v2.7606** | `lastCallByProspect` in `callLogState.ts` |
| 12 | `loadLaneExtras`' two folds: inbound lines by contact → prospect, the first upcoming callback per prospect | **shipped v2.7606** | `inboundProspects` in `subRecord.ts`, `firstCallbackWords` in `callRun.ts` |
| 13 | Convert's rows: the picker pool's union, the first-contact prefill, the submit's skip rules | the skip rules **shipped v2.7606**; the union and the prefill moved with the tab in v2.7628 (`useProspectConvert.ts` 99, 107–113) | `convertContactRows` and `convertBidRows` in `prospectConversion.ts` |
| 14 | Activity's 30-day date keys | **shipped v2.7606** | [`getOrderedDateKeysLast30Days`](../src/lib/prospectTeamActivityChartData.ts), reversed (`ProspectsActivityTab.tsx` 187), since the tab renders newest first |
| 15 | `saveCallback`'s title | **shipped v2.7606** | `runCallbackTitle` |
| 16 | `parseCandidateLinks` / `serializeCandidateLinks` 166–186 + `mergeDuplicate`'s merge rules 1096–1106 (link dedupe by URL, notes concatenated when they differ) and review re-point filter 1118–1120 | module-level / inline in TPT, untested | `lib/prospects/candidateLinks.ts` (+ `mergeCandidateFields`) + tests |

### Cross-surface duplicates (fix outside the moves)

- **The prospects-staff audience predicate** exists 4× on the client: `canAccessProspectPipeline` (`lib/prospects/prospectConversion.ts`), `hasProspectsStaffAccess` (`lib/hiring/columnShares.ts`, the twin of DB `user_has_prospects_staff_access()`), and the PostgREST string `.or('role.in.(dev,master_technician,assistant,controller),and(role.eq.estimator,estimator_prospects_access.eq.true)')` in both `loadProspectWeekReport` (`lib/prospects/prospectWeekReportIo.ts` 19) and `lib/prospectTeamActivity.ts`.
- **"Called"** (`CALL_INTERACTION_TYPES`) is loaded twice by unbounded full scans of call comments: `loadFollowUpProspects` (`useProspectsData.ts` 91) and `loadProspectListProspects` (`useProspectsData.ts` 183–186). `loadProspectWeekReport` hard-codes `['didnt_answer', 'answered', 'converted']` (`prospectWeekReportIo.ts` 24).
- **The GC board is read here the way `GcProjects` reads it** (`loadGcProjects` → `loadGcBoardRows`, in `useSubsBench.ts` 23–45), and the Jobs to GC read calls `loadGcProjects` again (`useProspectDoubles.ts` 66–89). One `useGcBoardRead` would serve the page and GC projects.
- **`loadCustomerDoubles`** is called by both effects of `useProspectDoubles.ts` (43–63 and 66–89), and both write `customerDoubles`.
- `team_prospect_role_shares` is read 3×: TPT `load()`, `useMyHiringShares` (this page's gate) and `useHiringColumnShares` (the person desk). The playbook's cross-surface seam 41 holds it.
- Quickfill's [`prospectWarmthCounts.ts`](../src/lib/prospectWarmthCounts.ts) still buckets by warmth, while the Prospect List groups by pipeline stage. The playbook's *Prospects ↔ Quickfill* row holds it.

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **Stale type casts.** `(supabase as any)` on `prospect_timer_events` sits in the page (469, 663, 768), in `useProspectListTab.ts` (66), `lib/prospects/prospectTimerIo.ts` (33, 50) and `lib/prospects/prospectWeekReportIo.ts` (29), and `'service_types' as any` in `useProspectConvert.ts` (90). TPT has `'team_prospect_trial_tally' as never` (863) and `keepTrying`'s update `as never` (1219), plus jsonb `links` written `as unknown as string` (1020, 1055, 1109). Those tables, the RPC and the `trial_deferred_*` columns are all in generated `database.ts` now, so the casts are removable. Do that in a separate types pass, never during a move.
2. **Calling locks are advisory, taken on intent, and expire.**
   - Triggers: `dial` (`ProspectsFollowUpTab.tsx` 497), `composer` (`ProspectsFollowUpTab.tsx` 707), `outcome` (page 1100 / 1138), `callback` (page 743). The lane's last press takes no lock.
   - A colleague's row younger than `CALLING_LOCK_TTL_MS` (30 min) is never overwritten; an older row is taken over, and the table's update policy lets it be (quirk 38).
   - `loadFollowUpProspects` hides only live rows held by *others* at load time.
   - Release (`useCallingLock.ts` 34–45) deletes only the row this tab wrote (`lockTakenForRef`), through `releaseCallingLock` (quirk 36). In the page `handleNoLongerFit` (789), `handleCantReach` (819), `handleConverted` (858), `handleBenchSave` (927), `leaveQueueAsLanded` (956) and `handleNextProspect` (1213, 1222) also delete the caller's own row; Didn't Answer and Answered do not.
   - There is no purge job; staleness is a read-side rule.
3. **`?prospect_id` fetch-and-prepend** (`useProspectsData.ts` 140–160) deliberately shows a prospect even when it is `not_a_fit`/`cant_reach`/`converted` or locked, because Prospect List, Calendar and Quickfill must be able to open anything. A row of another kind is handed to its own lane, and a hidden ZZ row opens nothing.
4. **Queue filter is split.** The server excludes `not_a_fit` on two lanes only (`useProspectsData.ts` 102): the Subs lane reads every row, because its strip counts the exits. The client drops `not_a_fit` + `cant_reach` + `converted` and, for a non-dev, the ZZ rows (115–118). The order comes from `callingOrderModeRef.current`, a ref rather than state, so the loader is not recreated when the mode changes.
5. **The queue reloads on every URL change, and twice on the Subs lane's entry.** The page's effect 513–518 depends on `searchParams`, so each `updateUrlProspectId` (every advance, removal and queue jump) re-runs `loadFollowUpProspects` + `loadMyTimeToday`, and the index-sync effect re-points. It also depends on `benchTrades`, so the Subs deck loads once before the bench read answers and once after (By need reads the bench). In never-called-first mode, a prospect just called moves into the called block on that reload. Keep the dependencies.
6. **Timer semantics.**
   - `followUpTimerSeconds` resets on tab re-visibility and on every advance.
   - A `prospect_timer_events` row is written only by `saveTimerEvent` for `no_longer_fit` / `next_prospect` / `cant_reach` / `converted`. A landing writes `converted` on every lane, and closes over the click-time render values.
   - `handleDidntAnswer`'s auto-advance calls `handleNextProspect(true)` (page 1130): **no timer event, no lock delete, no `loadMyTimeToday`** on that path. The release effect still frees the lock.
   - `handleBenchSave` writes the timer event only when the landed prospect is the deck's card (page 926).
7. **Live "session bonus":** `my day`, "Time on this prospect" and the My time window add the running `followUpTimerSeconds` to DB sums (the window only when `activeTab === 'follow-up'`, through `liveSeconds`). Yesterday intentionally gets no bonus.
8. **Last Contact and warmth.**
   - The card prefers `comments[0]?.created_at` over `prospects.last_contact`.
   - `handleAnswered`/`handleDidntAnswer`/`handleAddComment` bump `last_contact` to now after inserting.
   - Answered also sets warmth +1. The warmth pill on the card is read-only; ± lives only in the Edit window and only for the current prospect. `handleWarmthDelta`/`Reset` patch the Follow Up cache only. On the Subs lane the card shows the priority presses in place of the pill.
9. **Call-outcome retag** (`writeCallOutcome`, page 1066–1088). Applies when the composer is empty and the newest comment is the caller's own `user_comment` within `RETAG_NOTE_WINDOW_MS` (10 min). The outcome row takes the note's text and original `created_at`, and **then** the note is deleted: insert-then-delete, because `prospect_comments` has no UPDATE policy. A failed delete toasts but keeps the call.
10. **Single-cache patches are safe only because the list reloads on every tab entry** (page effect 520–524). `handleNoLongerFit`, `handleDidntAnswer` and `handleAddComment` leave `prospectListProspects` stale until then.
11. **Copy-template override fallback:** an override that is `null` **or** `''` falls back to the app_settings default (`resolveCopyText`). The save upsert writes `subject_text: editingCopySubject || null`. The template row shows on the Customers lane only (`ProspectsFollowUpTab.tsx` 872).
12. **`handleOpenMail` fires the mailto first** (`useProspectCopyTemplates.ts` 155–187), then upserts `prospect_email_sent`. The envelope-check icon is per user + prospect + template.
13. **One global `saving` flag** across every lane's mutations; TeamProspectsTab has its own `busy`, Convert has `convertSaving`, the bench window has `benchSaving`. Keep each scope intact. `savePriority`, `saveOkToText` and the job handlers set none of them.
14. **Edit window dual identity:** `editingProspect === null` means "editing `currentProspect`" (Follow Up); a set value means "editing this row" (Prospect List, the Subs list, the Board). `handleDeleteProspect` (`useEditProspectWindow.ts` 119–145) handles both and re-points the Follow Up index. The kind boxes follow `(editingProspect ?? currentProspect)?.kind ?? kind`.
15. **Sort orders differ on purpose.** Prospect List groups by pipeline stage and recency, and the Subs list by trade in the needs panel's order. The Follow Up queue is coldest-first, never-called-first, By need, By rank or Soonest bid. `handleSendBack` re-inserts in coldest order regardless of `callingOrderMode`.
16. **Convert marks the prospect only through `markProspectConverted`** (status → `converted` + a `converted` comment naming `/customers/<id>`; also the `customer_contact_persons` row when Add customer hands it a contact person, which Convert does not). Add customer, Follow Up and Asked us ✓ use the same kernel; never re-inline it. Convert does not delete the prospect. The submit button lives outside `NewCustomerForm` via `form="convert-customer-form"`, and new bids hard-code `materials_model: 'rough'`.
17. **Owner stamping.** `getEffectiveMasterId` → `resolveCompanyOwnerUserId` stamps prospects, roles and candidates with the company owner. `addHireToRoster` alone uses the raw `authUserId` as `people.master_user_id`. Preserve the inconsistency.
18. **TeamProspectsTab drag rules.**
    - `boardCollisionDetection` order matters (it fixes a source-column bias).
    - `PointerSensor` activation distance is 8.
    - `hired` / `passed` / `trial` rows are drag-inert (955).
    - Rank updates are optimistic, with a full `load()` revert on any failure.
    - Edit-modal role changes append to the bottom of the target column via `nextTeamProspectRank`.
19. **Role deletion** requires `referencedCountByRole === 0` counting **all** statuses. The DB backs this with `ON DELETE RESTRICT`, and code `23503` gets a friendly message.
20. **Additive loads swallow errors:** reviews, onboarding, the trial tally (`.then(r => r, () => …)`), shares, `useMyHiringShares`, and on this page the bench read, the GC work read, both double reads, `mergeJobs`, `loadLaneRanks` and `loadLaneExtras` all read as empty when refused.
21. **`mergeDuplicate` is not transactional.** It updates the keeper, then re-points reviews one UPDATE at a time with errors ignored (1119–1122), then deletes the duplicate. A reviewer who already reviewed the keeper keeps that review.
22. **The shared board only hides controls.** `hiringTabPowers(shared)` trims the UI; the database refuses everything outside the share (`20260924040000`). Handlers such as `setStatus` do not re-check powers.
23. **One-shot deep links:** `?stage=`/`?rate=`, `?newProspect=true`, the `subs` / `gc-leads` doors and the Prospect List `?prospect_id` are each applied once, then stripped or rewritten, so later tab-hopping does not snap back.
24. **Activity hides a day entirely** when every user's Marked and Updated are 0. Date labels render via `new Date(dk + 'T12:00:00')` (a noon guard against timezone off-by-one), and all week and day boundaries are browser-local.
25. **`commentInputRef` is a state, not a ref** (page 197). The auto-resize effect (728–733) depends on it re-running when the node mounts.
26. **Dialogs are context dialogs:** `handleAddQuickNote` and `markJobLost` use `promptDialog`, and the two prospect deletes (`useEditProspectWindow.ts` 123, page 1043), `passFromBoard` (page 1092), merge, Try out and the Try-out card's Pass (`endTryOut`) use `confirmDialog`. TPT's candidate and column deletes confirm inline instead (`confirmingDelete`, `confirmDeleteRoleId`), and Pass on a Screen or Interview card (`setStatus('passed')`) has no confirm. New Prospect and Edit prospect ask to leave inline (`LeaveQuestion` through `useLeaveGuard`). Keep them as they are; no modal redesign during a move.
27. **A run is fixed at the press.** `?run=` carries the ids; the deck works them in that order and nothing reshuffles (`orderSubsDeck`, `useProspectsData.ts` 131). The run's notes (`runOutcomes`, `runDone`, `runCallbackAt`, `runTextState`) reset when the ids change (`useCallRun.ts` 45–51) and do not survive a refresh. In a run Didn't Answer never auto-advances: it writes a callback at `callbackHourFor(now)` and offers the text (page 1112–1129). Next on the last card shows the receipt and never wraps to the first (1209–1217).
28. **A landing from a list row or a Board card leaves the deck's card alone.** `handleBenchSave` advances only when the landed prospect is the card (page 924–938); when the landed row sat before the pointer the index steps back one (939). A refused ask leaves the landing whole and says so (916–920).
29. **Asked us ✓ makes no second customer.** With `customer_id` set it marks the prospect against the customer on file (page 987–995). Marking the job asked is fail-soft (976–981): the project still opens.
30. **The job handlers key the cache two ways.** `changeJob`, `markJobLost` and `removeJob` patch `jobsByProspect[currentProspect.id]`; `addJobFor` takes the id and `editJobFor` uses `job.prospect_id` (`useProspectJobs.ts`). They agree only because the Jobs box draws on the deck's card.
31. **`customerDoubles` has two writers** (`useProspectDoubles.ts` effects 43–63 and 66–89). Whichever read answers last wins; both read the same rows.
32. **`passFromBoard` patches `laneAllRows` whatever the write did** (page 1095): `handleNotAFitFromList` swallows its error. On a refused write the strip's count moves and the list's does not, until the next load.
33. **The empty lane's press and the header's button open New Prospect the same way** (v2.7657): both call `openNewProspect`, which sets the window's kind to the lane's and clears its boxes. Until then the empty lane's press only raised the open flag, so the window opened on the kind picked last. The `?newProspect=true` door still only raises the flag, on purpose: it comes from the Dashboard and lands on Customers.
34. **`saveNewProspect` on another lane's kind** closes the window and calls `setKindTab(newKind)` (`useNewProspectWindow.ts` 138); the loaders then run on the kind change, not from the save.
35. **`useCallRun.ts` imports `PORTAL_COMPANY` from `supabase/functions/_shared/portalCompany`** (10; the page did until v2.7632). A client file reading the edge side's shared folder is on purpose here: one company name for the app and the functions.
36. **Every lock release goes through `releaseCallingLock`** (`lib/prospects/callingLockIo.ts`, v2.7656). Until then the eight releases were written `void supabase.from('prospect_calling_locks').delete()…` and never awaited, and the Supabase client sends a query only when it is awaited, so none was sent and a lock stayed until it went stale. `src/lib/unsentQueries.test.ts` fails on that shape anywhere in the app.
37. **The deck loads once on any entry to the page.** `activeTab` starts as `follow-up`, and the queue-load effect (page 513–518) runs on the first render, before the `?tab=` effect reads the address. A link to another tab still loads the deck once, and a link to the Prospect List with a `?prospect_id=` also puts that prospect up as the deck's card.
38. **A colleague's stale lock is taken over by the database's leave** (v2.7955). `takeCallingLock` upserts on `prospect_id`, which updates their row. Until then the table's update policy let a caller change only their own row, so the database refused the takeover with 42501, the code treated it as no lock taken, and the call went on: proven on a whole-schema bed as a second caller, where 23 rows on prod were all stale and all one caller's. Now the policy passes a row older than 30 minutes or with no time, and the row written must be the caller's own, so a live colleague's row is still refused, by the database as well as by `callingLockDecision`. The 30 minutes is written twice, in the policy and in `CALLING_LOCK_TTL_MS`; `callingLock.test.ts` reads the newest migration that states the policy and fails when they differ. A refused upsert (a colleague who dialed in the same second, a clock ahead of the server's) is still let go: no chip, no lock, and the next sign of intent tries again. The bed is `supabase/tests/calling_lock_takeover`.

## Recommended extraction order (value ÷ risk)

The thirteen steps drawn at `6af60c5bcf` are the record below; each line says what moved and the page's size after it. Steps 1 and 2 needed no render smoke; step 3 was the smoke every later step leaned on.

1. **Stage A, the copy-template rules** → `lib/prospects/prospectCopyTemplates.ts` (inventory row 1) — **shipped v2.7595** (the three rules, `resolveCopyText`, `foldCopyTemplateRows`, and `formatDateTime` as the first export of `prospectFormat.ts`; 29 tests; the page is 5,481 lines).
2. **Stage A, the rest**, in the inventory's order — the row types and the formatters **shipped v2.7598** (`prospectRow.ts`, `prospectFormat.ts`, 15 tests; the page is 5,389 lines); the queue rules **shipped v2.7603** (`queueAfterRemoval`, `indexAfterOtherRowLeft`, `insertColdest`, `queueWindowStart`, 20 tests, the six handlers adopted; 5,377 lines); the time sums, the loaders' folds and the windows' helpers **shipped v2.7606** (31 tests; 5,284 lines). Rows 8 and 9 sat between awaits and moved with their loader (step 10) and their hook (step 8).
3. **The page's first render smoke**, `src/pages/Prospects.render.test.tsx` — **shipped v2.7615** (60 cases: every `?tab=` key on every lane, the lane doors, the roles, the deck's outcomes and its pointer, a run, the Board's run press, the list, Convert, Activity and six windows; seven of eight deliberate breaks caught, the eighth changes nothing on screen). Tests only.
4. **The Subs lane's drawn pieces → `components/prospects/`** — **shipped v2.7621**: `SubsPathStrip` (`renderSubsStrip`), `SubsPlansPicker` (`renderPlansPicker`), `SubsLaneList` (`renderSubsList`), `SubsNeedsPanel`, `GcWorkStrip`, each a function of its props; `subsSectionOpen` stays with the page so a fold survives a tab switch; the smoke grew to 68 cases first; the page is 4,963 lines.
5. **Follow Up's small windows** — **shipped v2.7623**: `ProspectTimerHistoryModal` and `ProspectMyTimeModal`, each with its rows and its read (`lib/prospects/prospectTimerIo.ts`), and `ProspectCallbackModal` with its three boxes; the three open flags and `saveCallback` stay in the page, which holds `saving`; the smoke is 71 cases; the page is 4,681 lines.
6. **`activity` → `ProspectsActivityTab`** — **shipped v2.7626**: the tab with its 4 states, its 2 loaders and `lib/prospects/prospectWeekReportIo.ts`; `weekOffset` stays in the page so the pager survives a tab switch; the smoke is 75 cases, run against the page before and after; the page is 4,438 lines.
7. **`convert` → `ProspectsConvertTab`** — **shipped v2.7628**: `useProspectConvert` (the 8 states, the 3 effects, the picker pool and the submit), which the page calls so the form survives a tab switch, and `ProspectsConvertTab`, which draws it; the list's loader effect stays in the parent; the smoke is 79 cases, run against the page before and after; the page is 4,075 lines.
8. **The lane read hooks (no JSX move)** — **shipped v2.7631**: `useSubsBench` (the bench effect and its 5 states, over the new kernel `benchReadFromBoard`, Stage-A row 9), `useProspectDoubles` (the doubles and the Jobs to GC reads, with `customerDoubles` and its two writers), `useProspectJobs` (`jobsByProspect`, `mergeJobs`, the five job writes); the smoke is 83 cases, run against the page before and after; the page is 3,928 lines.
9. **Follow Up hook seams** — **shipped v2.7632**: `useCallingLock` (the refs, `lockHeldBy`, the release effect, `takeCallingLock`), `useProspectCopyTemplates` (the 12 copy states, their reads and the four presses) with `ProspectCopyTemplateRow` and the two copy windows, and `useCallRun` (the run's four states, the reset, `noteRunOutcome`, `sendRunText`); the caller's name stays in the page; the smoke is 94 cases, run against the page before and after; the page is 3,358 lines.
10. **Data seam `useProspectsData`** — **shipped v2.7634**: the lane's caches, the pointer and its `?prospect_id=` effect, the call-history sets, both loaders (with `callingOrderModeRef` and `latestLoad`), the calling order, `updateUrlProspectId` and `markCalledLocally`; `useSubsBoardData` beside it (the pins, the extras, the pin writes); `orderSubsDeck` as a kernel (Stage-A row 8, 9 tests); the page destructures the hook and its handlers still patch the caches; the tab-keyed loader effects and `saving` stay in the page; the smoke is 104 cases, run against the page before and after, with six of seven breaks of the hook caught (the `?prospect_id=` effect is shadowed by the loader, which re-points the card on every reload); the page is 3,092 lines.
11. **`prospect-list` → `ProspectsListTab`** — **shipped v2.7636**: `useProspectListTab` (the search, the open sections and folds, the selected row, the timed seconds, the two effects), which the page calls so the search survives a tab switch, and `ProspectsListTab`, which draws it; the row actions stay in the page; the smoke is 109 cases, run against the page before and after; the page is 2,722 lines.
12. **The New Prospect and Edit Prospect windows** — **shipped v2.7637**: `useEditProspectWindow` + `EditProspectWindow` and `useNewProspectWindow` + `NewProspectWindow`, each hook called by the page; `renderKindFields` moved whole to `ProspectKindFields.tsx`; the open flag and kind of New Prospect, the `?newProspect=` effect and `openDoubleProspect` stay in the page; the smoke is 114 cases, run against the page before and after; the page is 2,223 lines.
13. **`follow-up` → `ProspectsFollowUpTab`** — **shipped v2.7638**: the tab's JSX and its two queue helpers, props-only (40 values, 12 setters, 30 handlers handed down by name; 82 props); the page keeps the pointer, the caches, `saving` and the outcomes that write them, so a typed comment and the clock survive a tab switch; the same 114 smoke cases pass before and after; the page is 1,555 lines.

The three fixes the cuts found shipped beside them: the calling lock's release (v2.7656, quirk 36, with the guard test), the empty lane's press (v2.7657, quirk 33) and the stale lock's takeover (v2.7955, quirk 38). The smoke stands at 125 cases, and the page at 1,556 lines with 28 `useState` and 15 effects, from 111 and 30.

**Next, ranked by value ÷ risk.** None is scheduled; each is one small PR that changes no behaviour, proven by the smoke before and after.

1. **`useFollowUpDeck`** (medium value, medium risk). The deck's own state still in the page: the comments, the composer, the quick notes, the notes, the scheduled callback, the three clocks, the order toggle, the auto-advance choice and the text ask (13 states), their five loaders (`loadComments`, `loadMyTimeToday`, `loadQuickNotes`, `loadProspectLedgerSeconds`, `loadScheduledCallback`) and their nine effects (612–740), into one hook the page calls. The page drops about 200 lines, under the 1,500 the map threshold counts, and `ProspectsFollowUpTab` takes the hook's value in place of some 25 props. The page's handlers keep reading the clock from the render they were made in, so the outcomes stay where they are (see [Hazards](#hazards)).
2. **`FollowUpQueue`** (low value, low risk). `renderCallingOrderToggle` + `renderQueueRows` (`ProspectsFollowUpTab.tsx` 214–303) as a child drawn twice, the mobile peek and the desktop rail.
3. **The bench landing beside its window** (low value, low-medium risk). `benchDraft`, `benchSaving`, `benchError` (124–126), `benchAskForProspect`, `openBenchModal` and `handleBenchSave` (876–950) as `useBenchLanding`. It writes three caches and the pointer, so it takes their setters.
4. **The types pass** (quirk 1). The `as any` casts on `prospect_timer_events` and `service_types` are removable; one PR of its own, never inside a move.
5. **The outcomes** (page 742–1229, about 490 lines) stay in the page unless it grows again. They write the caches, the pointer, the clock, the lock and the run, and three of them close over the click-time render. A hook for them would take some 30 arguments and buy little.
6. **Step 14, TeamProspectsTab** (independent track): the module components to their own files (`EmailText`, `CandidateLinkChips`, `CandidateRatingBars`, `TrialTallyBlock`, `CandidateFields`, `SortableCandidateCard`, `RoleColumn` and the style/dnd helpers, 193–782, ≈590 lines, with the `candidateLinks.ts` Stage A, inventory row 16), then `TeamHireStage` → `TeamTryoutStage` → `TeamInterviewStage` → optionally `TeamScreenBoard`, plus the share-editor hook. `rows`/`roles`/`load`/`busy`/`modalError`/`setStatus`/`openEdit`/`markContacted`/`startTryOut` and the roster hand-off stay in TeamProspectsTab.
7. **The stale lock's takeover** (quirk 38) — **shipped v2.7955**, a policy change and not a move.

**What must stay in `Prospects.tsx` permanently:**
- the `?tab=` / `?kind=` / `?newProspect=` router and the access-gate rewrites
- `topTab`/`activeTab`/`kind` and the two tab rows
- the selection pointer and the caches, through `useProspectsData`
- `saving`
- the landings that write the caches and the pointer (`handleConverted`, `handleAskedUs`, `handleBenchSave`, `leaveQueueAsLanded`)
- `getEffectiveMasterId`
- `useMyHiringShares` and the `canAccessFollowUp` / `canAccessActivityTab` / `canOpenHiring` / `canResearch` gates

Definition of done per tab, verification gates (`npm run typecheck && npm run lint && npm test` after every step), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). Behavior-preserving only.

## Hazards

- **One render smoke and no e2e on the page.** `Prospects.render.test.tsx` (125 cases) is what proves a move. It mounts the router with `v7_startTransition` off, as `src/main.tsx` does; with it on, the address and the page's tab state commit in two renders and the list's jump to a card loses its prospect. Its supabase stand-in sends nothing until it is awaited, as the real client does. A cut adds its own cases, before its move, when it moves something the 123 do not press.
- **The handlers are plain inner functions, not `useCallback`s.** Each closes over the render it was made in, and three paths depend on that: `saveTimerEvent` (page 766–774) reads the click-time `followUpTimerSeconds`, `handleConverted`'s `onCreated` runs after the Add customer window closes with the click-time queue, and `handleAskedUs`'s `landed` does the same. A hook that memoizes them changes which render they see; a hook that returns plain functions made on each render does not.
- **Seven effects carry `eslint-disable react-hooks/exhaustive-deps`**: the page's 531 and 724, `useProspectsData.ts` 233, `useProspectCopyTemplates.ts` 113 and 231, `useProspectListTab.ts` 60 and 79. The loader effects call non-memoized loaders. Moving a loader or an effect must keep the same dependency lists, or the queue reloads at different moments (quirk 5); every cut so far kept them.
- **The Follow Up tab takes 82 props by name.** A handler renamed in the page must be renamed in `ProspectsFollowUpTabProps` (33–117); the typecheck catches a miss, the smoke catches a wrong wire.
- **The Follow Up block is one ternary chain** (`ProspectsFollowUpTab.tsx` 324–915) with an IIFE that defines its button styles (355–370). A partial lift has to carry those styles or import them.
- **`Prospect` lives in `lib/prospects/prospectRow.ts`** since v2.7598, and the pieces cut out import it. `SubsBoard` and `ProspectJobsBox`, out before the cuts, still declare structural copies of their own.
- **The file was the train's for a day and is quiet again.** Some 65 commits in 90 days, the last seven of them this train's, one PR each. Check `npm run sessions` and the open PRs before each cut: the permit train (#302, #307) writes into the lanes from outside and could come back to the page.
- **The lanes read the GC tables.** A change to `lib/gc/gcIo.ts` or `boardRows.ts` reaches this page's strips, and the render smoke must stub those reads.
- **The CSS class names** (`followUpQueueRail`, `followUpQueueMobileStrip`, `followUpCommentsSection`, `followUpInfoCard*` in `ProspectsFollowUpTab.tsx`; `prospectList*` in `ProspectsListTab.tsx`; `convert*` in `ProspectsConvertTab.tsx`) are styled in `src/index.css`. A moved block keeps its class names.
