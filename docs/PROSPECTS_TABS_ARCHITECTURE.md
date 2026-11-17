# Prospects Tabs Architecture Map

---
file: docs/PROSPECTS_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the Prospects surface (per PAGE_DECOMPOSITION_PLAYBOOK.md) — what every lane and tab of src/pages/Prospects.tsx (5,600 lines, the largest hand-written file in the repo) and the already-extracted src/components/prospects/TeamProspectsTab.tsx (2,376 lines) touches (state, loaders, handlers, sub-components, supabase tables/RPCs, cross-tab coupling), so extraction can proceed cut by cut without re-deriving the strategy.
covers:
  - src/pages/Prospects.tsx
  - src/components/prospects/TeamProspectsTab.tsx
  - src/components/prospects/ProspectPersonForm.tsx, ProspectJobsBox.tsx, ProspectBenchModal.tsx (the lanes' windows, v2.5560–v2.5604), SubsBoard.tsx (the Board, v2.5808)
  - src/lib/prospects/ (the lanes' kernels: prospectKinds, subsLane, gcLeadLane, laneLoad, companyDouble, deckWords, windowLeave, zzProspects, stripState, personBlock, mapsShareText, textingRule, subsStages, benchOrigin, subsBoard, subRecord, callRun, subsRanks, benchAsk, needTones, gcNeeds, pagePadding)
mapped_at: 6af60c5bcf
audience: Developers, AI Agents
last_updated: 2026-11-17
sections: What this surface is; Master summary table; Shared substrate; Per-tab dossiers; TeamProspectsTab sub-decomposition; Page-level windows; URL / navigation router; Test coverage by region; Stage-A pure-logic inventory; Preserve-quirks list; Recommended extraction order; Hazards
---

> **Line numbers are exact as of `6af60c5bcf`** (re-mapped 2026-11-17 from `a05cef4c4`: `Prospects.tsx` read again whole against its `npm run map` fact sheet, 3,962 → 5,600 lines; `TeamProspectsTab.tsx` re-anchored through its diff, 2,383 → 2,376 lines, and checked by symbol).
> They drift with every edit. Search for the named symbol; the range is a hint.
> Regenerate the fact sheet with `npm run map -- src/pages/Prospects.tsx`.
> The cuts in [the extraction order](#recommended-extraction-order-value--risk) are shipping one PR a step; each step's line says what moved and the page's size after it, and the ranges below it in the file sit that much lower than this map says until the next re-anchor.

## What this surface is

[`src/pages/Prospects.tsx`](../src/pages/Prospects.tsx) is the cold-call workstation. It finds three kinds of company through one calling deck, and it is the door to the Hiring board and the Permits ledger. [`src/components/prospects/TeamProspectsTab.tsx`](../src/components/prospects/TeamProspectsTab.tsx) is the extracted Hiring tab, a God component of its own. Hook censuses are from `npm run map` at `6af60c5bcf`:

| File | Lines (at `a05cef4c4`) | useState · effects · useMemo · useCallback · refs | Handlers | Commits (90 d) | Role |
|---|---|---|---|---|---|
| `Prospects.tsx` (`Prospects` 419–5600) | 5,600 (3,962) | 111 · 30 · 2 · 4 · 6 | 95 | 58 | shell + router + three lanes × five sub-tabs + nine windows |
| `TeamProspectsTab.tsx` (`TeamProspectsTab` 785–2376) | 2,376 (2,383) | 36 · 2 · 0 · 1 · 0 (35 in the component + `RoleColumn.menuOpen`) | 34 | 21 | Hiring board: 5 stages + 6 modals |

Already out of the page, each in `src/components/prospects/` unless named: `SubsBoard.tsx` (904 lines, the Board), `ProspectsResearchTab.tsx` (805, the Permits tab, with fifteen children of its own), `ProspectJobsBox.tsx` (228), `ProspectBenchModal.tsx` (196), `ProspectPersonForm.tsx` (139), `components/gc/GcCallScriptWindow.tsx`, `components/NewCustomerForm.tsx`, and 38 tested kernels under `src/lib/prospects/`.

`Prospects.tsx` calls 13 custom hooks: `useNavigate`, `useLocation`, `useAuth`, `useIsMobile`, `useZzTestJobsHidden`, `useMyHiringShares`, `useToastContext`, `useConfirmDialog`, `usePromptDialog`, `useNewCustomerModal`, `useSearchParams` (420–436) and `useLeaveGuard` twice (747, 749). Its module scope (105–417) holds 12 functions (formatters, copy-template helpers, `tabStyle`, `DIDNT_ANSWER_MOVE_NEXT_KEY`, `renderKindFields`), 4 copy-template constants, 2 tone-style tables and 3 inline SVG icons (`EnvelopeIcon` / `EnvelopeCheckIcon` / `EditIcon`, 126–142).

### How it grew

| Day | Commit | Lines | What landed |
|---|---|---|---|
| 2026-02-23 | `28931d97ec` | — | the page's first commit |
| 2026-09-25 | `a05cef4c4` | 3,962 | this map's last anchor: one customer deck, four sub-tabs, seven windows |
| 2026-10-15 | before v2.5559 | 3,970 | — |
| 2026-10-15 | v2.5559 | 4,271 | three kinds of prospect (punch list #110): the `kind` state, `renderKindFields`, the kind cards |
| 2026-10-17 | v2.5606 | 4,782 | the lanes' bench and jobs (v2.5560, v2.5561), the #113 spots (v2.5578–v2.5585), the person first (#117, v2.5601–v2.5606) |
| 2026-10-24 | v2.5810 | 5,530 | what GC mode needs (#148, v2.5782, v2.5785), the path onto the bench, the Board, the run, the pins, the ask on landing (#153, v2.5807–v2.5810) |
| 2026-10-28 | v2.6032 | 5,546 | the run's first text starts a thread |
| 2026-11-17 | `6af60c5bcf` | 5,600 | the Permits tab's mount (v2.6782, v2.6787), the phone padding (v2.6869), sweeps |

1,560 of the 1,638 lines since the last anchor came in the ten days from 2026-10-15 to 2026-10-24, all of them on the lanes. Each feature put its rules in a tested kernel under `src/lib/prospects/`, and left its state, its effects, its handlers and its JSX in the page. So the rules are tested and the page is not: it has no render test.

### Tabs and lanes

The page switches on **four levels of state**:

```
topTab:    'customers' | 'team' | 'research'                              (ProspectsTopTab 144; 'research' is the Permits tab, ?tab=permits)
kind:      'customer' | 'gc_lead' | 'sub'                                 (ProspectKind, lib/prospects/prospectKinds.ts; state 442; only under 'customers')
activeTab: 'follow-up' | 'board' | 'prospect-list' | 'convert' | 'activity' (ProspectsTab 146, PROSPECTS_TABS 200; only under 'customers')
stage:     'screen' | 'interview' | 'tryout' | 'hire' | 'review'          (TeamProspectsTab 806; HiringStage in lib/hiring/sharedHiringTab.ts)
```

The top row (3228–3242) draws five pills: **Customers**, **Jobs to GC** and **Subs** (one per `PROSPECT_KINDS`, each sets `kind` through `setKindTab`), then **Hiring** and **Permits**. The second row (3248–3307) shows under the three lanes only: **Follow Up**, **Board** (Subs only), **Prospect List**, **Convert** (Customers only), **Activity** (dev and assistant-like), and the **New Prospect** button.

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

- **`canAccessFollowUp`** (3199): signed in AND [`canAccessProspectPipeline`](../src/lib/prospects/prospectConversion.ts)`(authRole, estimatorProspectsAccess)`. That means dev, master_technician, assistant or controller, or an estimator with the flag. It gates the three lane pills, Follow Up, the Board, Prospect List and Convert (each shows "You do not have access" otherwise) and the New Prospect button. An estimator without the flag gets an early-return page (3209–3220), except on the Permits tab.
- **`canAccessActivityTab`** (644): `authRole === 'dev' || isAssistantLike(authRole)`.
- **`canOpenHiring`** (429): `teamProspectsAccess || myHiringShares.length > 0`. `useMyHiringShares` (428) reads the viewer's own `team_prospect_role_shares` rows. A share holder without the switch gets the trimmed board, because the page passes `shared={!teamProspectsAccess}`.
- **`canResearch`** (431): `canResearchPermits(authRole)`, the office and every estimator, flagged or not.
- **Lane rules, in the router and in `setKindTab`:** `board` needs `kind === 'sub'`, `convert` needs `kind === 'customer'`. Either falls back to Follow Up.
- **The GC tables are read fail-soft.** A role they refuse sees the Subs and Jobs to GC lanes without their strips.

## Master summary table

| Region | Render anchor (`6af60c5bcf`) | Lines | Status | Owned state | Coupling | Risk | Recommended action |
|---|---|---|---|---|---|---|---|
| Module scope | constants 105–124, icons 126–142, types 144–198, formatters 222–267, copy helpers 269–337, `renderKindFields` 341–417 | 313 | inline | — | the page-local `Prospect` type (148–184) | lowest | **Stage A first**: the copy-template rules and the formatters to `lib/prospects/` with tests; the type and `PROSPECT_COLUMNS` to a lib file |
| Shell: gates, tab rows, URL router | effects 646–729 / 732–742, `setTradeFilter` 913, `setPlansFor` 924, `setTab` 933, `setKindTab` 946, `openResearchTab` 967, `openTeamTab` 978, early returns 3201–3220, tab rows 3225–3307 | ~290 | permanent parent | `topTab`, `activeTab`, `kind` | — | — | Stays |
| Lane reads: the bench, GC work, doubles, jobs | effects 771–794, 829–849, 873–896; `mergeJobs` 898–911; job handlers 2515–2560 | ~175 | inline | 10: `benchTrades`, `gcBench`, `benchCompanies`, `benchQuoted`, `gcPlans`, `gcWork`, `gcBidding`, `customerDoubles`, `prospectDoubles`, `jobsByProspect` | read-only and fail-soft; keyed on `kind`, `newKind`, the user | low | Hook seams: `useSubsBench`, `useGcLeadStrip`, `useProspectDoubles`, `useProspectJobs` |
| Subs lane drawn helpers | `renderSubsStrip` 2998–3038, `renderPlansPicker` 3041–3075, `renderSubsList` 3078–3197 | 200 | inline render helpers | `subsSectionOpen` | props-clean: rows, sets and callbacks | low | **First component move** → `SubsPathStrip`, `SubsPlansPicker`, `SubsLaneList` |
| Follow Up | `topTab === 'customers' && activeTab === 'follow-up'` 3315–4166 + 5 tab-local windows 5036–5449 | 852 + 414 | inline | 45 states, 5 refs, 16 effects, 2 callbacks | high (pointer, both caches, `saving`, the call-history sets, the Edit window, the run, the bench) | high | Peel the panels, the windows and the hook seams first; extract **last** |
| — Subs needs panel | `gcNeedsNow` block 3318–3419 | 102 | inline | — | `gcNeedsNow`, `tradeFilter`, `setTradeFilter`, `openAddSub` | low | → `SubsNeedsPanel` |
| — GC work strip | `stripReads(gcWork)` block 3420–3469 | 50 | inline | — | `gcWork`, `gcBidding`, `followUpProspects`, `jobsByProspect` | low | → `GcWorkStrip` |
| Board (Subs) | `activeTab === 'board' && kind === 'sub'` 4168–4204 | 37 | drawn by `SubsBoard` (**extracted**); its data and writes inline | `laneRanks`, `laneCallRows`, `inboundProspectIds`, `laneCallbacks` + 2 memos | med: fed by the list's loader; 9 callbacks into page handlers | med | `useSubsBoardData` after the data seam |
| Prospect List | `activeTab === 'prospect-list'` 4206–4509 | 304 | inline (grouping in `prospectListGrouping.ts`; Subs through `renderSubsList`) | 5 states, 2 effects | med (3 cache-writing actions, shared Edit window, pointer via `selectProspectForList`) | med | Extract after the data seam |
| Convert | `activeTab === 'convert'` 4511–4772 | 262 | inline (picker in `convertProspectSearch.ts`) | 8 states, 3 effects | low-med (reads the cache union + `prospectLastCallMap`; patches both caches on success) | low | → `ProspectsConvertTab` |
| Activity | `activeTab === 'activity' && canAccessActivityTab` 4774–4933 | 160 | inline (both loaders lib-backed) | 5 states, 2 callbacks, 2 effects | low: Source success reads `prospectListProspects` on a lane | lowest | → `ProspectsActivityTab` |
| Hiring (key `team`) | `topTab === 'team' && canOpenHiring && authUser?.id` 3309–3311 | 3 | **extracted** (`TeamProspectsTab`) | 0 (parent owns `useMyHiringShares` for the gate) | 5 props: `authUserId`, `isDev`, `canEditOnboarding`, `resolveMasterId`, `shared` | — | Sub-decompose (below) |
| Permits (key `permits`) | `topTab === 'research' && canResearch && authUser?.id` 3313 | 1 | **extracted** (`ProspectsResearchTab`) | 0 | 1 prop: `authUserId`; its own URL keys through `permitsLink.ts` | — | Nothing to cut here |
| Edit Prospect window | `editModalOpen && (currentProspect \|\| editingProspect)` 4936–5033 | 98 | inline, parent | the `editPerson` / `editCompany` blocks, 4 kind fields, `editOpenedWith`, a leave guard | opened by Follow Up, Prospect List and the Board; hosts warmth ± (5006–5008) | med | Controller hook + component, after the data seam |
| New Prospect window | `newProspectModalOpen` 5457–5597 | 141 | inline, parent | `newKind`, 4 kind fields, the `newPerson` / `newCompany` blocks, `newCustomerLink`, `newProspectError`, the doubles, a leave guard | tab-row button, `?newProspect=true`, `openAddSub` (panel, list, Board), the empty states; Save reads **Save anyway** while a double shows | med | Controller hook + component, after the lane read hooks |
| Bench window, call script | `scriptOpen` 5451, `benchDraft` 5452–5455 | 5 | **extracted** (`GcCallScriptWindow`, `ProspectBenchModal`) | `benchDraft`, `benchSaving`, `benchError`, `scriptOpen` | `handleBenchSave` writes three caches and the pointer | — | Stays with its handler |
| — TPT module components | `EmailText` 193–208 … `RoleColumn` 632–782 | ~590 | inline in file, pure props | `RoleColumn.menuOpen` only | none | lowest | **Move to own files first** |
| — TPT Screen | header 1651–1689, board 1691–1738, Passed 2045, Sources 2047–2094 | ~140 | inline | 5 | `rows`/`roles`/`busy`/`load`/`setStatus`/`openEdit`, hygiene, shares, drag | med-high | Last |
| — TPT Interview | 1740–1845 + My review modal 2172–2219 | 106 + 48 | inline | 2 (reads TPT-level `reviews`/`reviewerNames` from `load`) | `setStatus`, `startTryOut`, `markContacted` | low-med | 3rd |
| — TPT Try-out (v2.3627) | 1846–1911 | 66 | inline | `trialTallies` (from `load`) | `endTryOut`, `keepTrying`, `markContacted`, `openEdit`, `prefixMap` | low | 2nd |
| — TPT Hire | 1912–2036 + Onboarding settings modal 2269–2361 | 125 + 93 | inline | 6 onboarding states | roster hand-off modal (2221–2267) is opened by `setStatus('hired')` from any stage | low | **1st stage move** |
| — TPT Review | 2037–2044 | 8 | **extracted** (`TeamReviewSection`, 1,025 lines) | 0 (`rateUserIdFromUrl` passed down) | `onOpenScreenBoard={() => setStage('screen')}` | — | Done |
| — TPT Share with… (v2.3802) | 2362–2373 → `ShareColumnDialog` (79 lines) | 12 | dialog **extracted**; state + handlers inline | 4 (`shares` from `load`, `shareRoleId`, `shareAccounts`, `shareAccountsLoading`) | `RoleColumn` ⋯ menu; the Screen board also reads `shares` for the share chip; the dialog names sharers from `reviewerNames` | low | Hook seam with the dialog |

## Shared substrate

1. **The lane:** `kind` (442) starts from the link (`kindFromSearch`, so a refresh never paints the Customers deck under a lane's tab) and is written only by the `?tab=` effect and `setKindTab`.
   - Both loaders filter `prospects.kind`. The Activity reads join each row on `prospects!inner(kind)`.
   - `latestLoad` (443, `makeLatestOnly`) numbers the deck's loads, and every await in `loadFollowUpProspects` returns early unless its load is still the newest.
   - The deck draws a card only when `cardOnLane` says it is the lane's (3503–3505), and says `laneLoadingWords(kind)` otherwise.
   - `kindWords = PROSPECT_KIND_WORDS[kind]` (444) names the lane's tab, its last press and its landed words.
2. **Selection pointer:** `currentProspectIndex` (504) indexes `followUpProspects` (503) and yields `const currentProspect = followUpProspects[currentProspectIndex] ?? null` (1447). It syncs to the URL as `?prospect_id=`.
   - The index is written by every advance and removal handler, by the `renderQueueRows` row click (2018–2023), by `loadFollowUpProspects` (1093) and by the index-sync effect (1653–1659). The `?prospect_id=` half is written by `updateUrlProspectId` (2063–2071) and, cross-tab, by `selectProspectForList` (2865–2874) and `openDoubleProspect` (855–870).
   - `?prospect_id=` is read by `loadFollowUpProspects` (1062–1090) and the index-sync effect.
   - Eight per-prospect effects hang off `currentProspect?.id`: the text-ask reset 1449–1451, notes sync 1453–1455, comments 1661–1669, email-sent keys 1682–1688, ledger seconds 1702–1708, scheduled callback 1836–1838 (via `loadScheduledCallback` 1813–1834), calling-lock release 1844–1855 and the card clock 1912–1919.
   - **Stays in the parent**, passed to an extracted Follow Up as controlled props.
3. **The prospect caches:** `followUpProspects` (the deck) and `prospectListProspects` (539, the list, the Board and Convert). The Subs lane adds `laneAllRows` (463, every row of the lane for the strip's counts) and `laneQueueAll` (457, the whole queue before the trade filter). Which mutation writes which:
   - both caches: `saveFollowUpNotes`, `saveOkToText`, `savePriority` (and `laneAllRows`), `handleDeleteProspect`, `saveEdit`, `handleCantReach`, `handleConverted`, `handleBenchSave` (and `laneAllRows`), `leaveQueueAsLanded`, `handleSendBack`, `handleDeleteFromList`, `handleAnswered`, `handleConvertSubmit`
   - Follow Up cache only: `handleWarmthDelta`, `handleWarmthReset`, `handleNoLongerFit`, `handleDidntAnswer`, `handleAddComment`
   - list cache only: `handleNotAFitFromList` (`passFromBoard` then patches `laneAllRows`)
   - reloads both: `saveNewProspect`, unless the new row is another lane's, where `setKindTab` moves there and the kind change reloads

   Four call-history derivatives travel with the caches:
   - `calledProspectIds` (560): set by `loadFollowUpProspects`, patched by `markCalledLocally` 2652–2655. It drives the "never called" chip and the queue order.
   - `prospectLastCallMap` (543): set by `loadProspectListProspects`, patched by `markCalledLocally`. It is read by Prospect List ("Last touch"), the Subs list, the Board, Convert search and suggestions, and the list's `?prospect_id` effect.
   - `answeredProspectIds` (464) and `laneCallRows` (472): set by both loaders. They feed the Subs stages and `subRecordMap` (481).

   This is the page's `useBidPricingEngine` analog. The seam hook would be **`useProspectsData`**, returning `{ kind, followUpProspects, prospectListProspects, laneAllRows, laneQueueAll, currentProspectIndex, currentProspect, calledProspectIds, answeredProspectIds, laneCallRows, prospectLastCallMap, followUpLoading, prospectListLoading, loadFollowUpProspects, loadProspectListProspects, updateUrlProspectId, markCalledLocally, saving, setSaving, …patch helpers }`. `callingOrderModeRef` (559) and `latestLoad` (443) have to move with `loadFollowUpProspects`, which reads them.
4. **One global `saving` flag** (512; 26 readers, 14 writers) disables buttons across every lane's tabs and windows, the Board's cards included (`busy={saving}`). A behavior-preserving extraction keeps it page-level (or in the seam hook), not per tab. Convert has `convertSaving` and the bench window has `benchSaving`.
5. **Tab-keyed loaders:**
   - 1405–1410 runs `loadFollowUpProspects` + `loadMyTimeToday` on `[topTab, activeTab, authUser?.id, searchParams, kind, benchTrades]`. See quirk 5.
   - 1412–1416 runs `loadProspectListProspects` on entry to prospect-list, convert **or** board, and on a kind change.
   - 1419–1424 runs it again on Activity of a lane that is not Customers, for Source success.
6. **The bench read** (effect 771–794) is shared by five readers: the needs panel, the path strip (`benchQuoted`), the For picker and the Board (`gcPlans`, `gcBench`), the Trades picks in New and Edit (`benchTrades`) and the double check (`benchCompanies`). It runs when the lane **or** the New Prospect window's kind is `sub`.
7. **TeamProspectsTab and ProspectsResearchTab are substrate-free from the parent's side.**
   - Each loads its own data. Hiring takes 5 props, Permits takes 1.
   - `getEffectiveMasterId` (2876–2880) is just `resolveCompanyOwnerUserId(supabase, authUser.id)` (v2.2972, one company). It serves `saveNewProspect` and TPT's `saveNewCandidate`/`addRole`.
   - *Inside* TPT the substrate is `rows`/`roles`/`loading`/`busy`/`modalError`/`load()` plus `setStatus`/`openEdit`/`markContacted`/`startTryOut`.
8. **Logic duplicated with other surfaces** is listed under [Cross-surface duplicates](#cross-surface-duplicates-fix-outside-the-moves).

## Per-tab dossiers

### The lanes — what a kind adds

- **Customers** (`customer`): the deck as it always was, plus the Convert tab and the copy templates. Its last press is **Converted ✓** (`handleConverted` 2313–2357).
- **Jobs to GC** (`gc_lead`): an owner, developer, architect or owner's rep with a job we could build as the GC.
  - State: `jobsByProspect` (494), `gcWork` (495, a `StripRead`), `gcBidding` (497), `customerDoubles` (498).
  - Reads: effect 873–896 (`loadGcProjects` → `gcWorkCounts`, `gcBiddingLines`; `loadCustomerDoubles`), and `mergeJobs` 898–911 beside both loaders.
  - Draws: the **GC work in flight** strip 3420–3469, the card's Jobs box (`ProspectJobsBox`, 3680–3693), the **Soonest bid** order.
  - Writes: `addJobFor` 2515–2519, `editJobFor` 2522–2525, `changeJob` 2527–2536, `markJobLost` 2538–2549 (`promptDialog`), `removeJob` 2551–2560, all through `gcLeadLaneIo.ts` on `prospect_jobs`.
  - Last press **Asked us ✓** (`handleAskedUs` 2460–2512): the customer on file when `customer_id` is set, else Add customer; the job with the soonest bid marked asked; `leaveQueueAsLanded` 2441–2454; then `navigate('/gc?new=1', { state: { newProjectSeed } })`.
- **Subs** (`sub`): a company that does a trade we buy out.
  - State: `benchTrades` (453), `gcBench` (455), `benchCompanies` (456), `laneQueueAll` (457), `scriptOpen` (458), `laneAllRows` (463), `answeredProspectIds` (464), `benchQuoted` (465), `gcPlans` (466), `subsSectionOpen` (467), `laneCallRows` (472), `inboundProspectIds` (473), `laneCallbacks` (474), the run's four (477–480), `laneRanks` (483), the bench window's three (446–448).
  - URL: `?trade=` (`tradeFilter` 459), `?for=` (`plansFor` 468, `plansPick` 469), `?run=` with `?pkg=` (`run` 475).
  - Reads: the bench effect 771–794 (`loadGcProjects` → `loadGcBoardRows` → `boardStateFromRows` → `tradeBenches`, the way GC projects reads it), `loadLaneRanks` 1216–1226, `loadLaneExtras` 1279–1311 (`contacts` → `messages` in, the upcoming `prospect_callbacks`).
  - Derived per render: `deckIds` 797, `laneQueueNow` 798 (`stillQueued`), `gcNeedsNow` 800 (`gcNeeds`), `subRecordMap` 481, `lanePins` 484.
  - Draws: the path strip, the needs panel, the For picker, the list by trade, the Board, the run's head and receipt, the priority presses on the card, **Call script** (`GcCallScriptWindow`), the **By need** and **By rank** orders.
  - Writes: `savePriority` 1265–1276, `dropOnBoard` 1229–1235 / `unpinOnBoard` 1237–1241 → `writePins` 1243–1262 (`prospect_trade_ranks`), `passFromBoard` 2714–2719, `sendRunText` 2672–2711 (`quo-send`).
  - Last press **Add to the bench ✓** (`openBenchModal` 2375–2380 → `ProspectBenchModal` → `handleBenchSave` 2382–2438): `addGcCompany` → `markProspectOnBench` → the ask on the job's package (`askGcCompanies`, when `benchAskForProspect` 2363–2372 finds one) → the three caches, the pointer, the run's note.
- **Every lane** shares the person and company blocks (`personBlock.ts`, `ProspectPersonForm`), the ZZ rule (`withoutZzProspects` behind `useZzTestJobsHidden`), the **May we text?** chip (`saveOkToText` 2883–2893, `textRefusal` holds a text until the yes) and the double lookup on New Prospect (`companyDouble` over effect 829–849).

### `follow-up` — Follow Up (the calling workstation)

- **Render location:** 3315–4166. It contains:
  - Over the card: the Subs path strip 3317, the needs panel 3318–3419 (its *Trades nobody does yet* chips from 3398), the GC work strip 3420–3469, the run's head 3470–3479.
  - The state chain 3480–3506: no access → loading → the run's receipt 3484–3496 → the empty lane 3497–3502 (`emptyLaneWords`) → a card of another lane 3503–3505 → the card.
  - Header card IIFE from 3510:
    - who you're calling from 3529 (`prospectTitle`, `personLineParts`, the **May we text?** chooser 3548–3568, *Maps ↗* and a sub's license and trades 3598–3613, the `telHrefFor` link that takes the lock at 3653, **Call script** on Subs 3669–3672, the Jobs box on a lead 3680–3693)
    - outcome row from 3694: Didn't Answer 3697 / Answered 3700 / Can't reach 3703 / Not a fit 3708 / the lane's last press; in a run the text press 3739 and Next 3746
    - utility row from 3751: Set callback 3753 · Edit prospect 3755 · the priority presses on Subs 3759–3767 or the 🔥 warmth pill (read-only) · scheduled-callback link · mobile "N of M · show order" 3794–3801 · the `this call` timer (opens Timer history, 3814) · `my day`
  - Mobile queue peek from 3837 (15 rows).
  - Comments section from 3852 (the composer takes the lock on focus at 3864; quick-note chips 3888–3931).
  - Info card with notes from 3985: Last Contact / Last updated by / Last Successful Contact / Address / Time on this prospect; notes from 4003.
  - Copy-template buttons 4028–4086, on Customers only (4029).
  - The advance bar 4087–4109 (`Next Prospect →`, or `Finish the run →` on a run's last card).
  - Desktop queue rail 4111–4125 (12 rows; the order toggle hides in a run).
  - Footer 4128–4164: the Didn't-Answer auto-advance checkbox and the "my time" link.

  Five tab-local windows render after the tab blocks (see [Page-level windows](#page-level-windows)).
- **Owned local state (45, moves with the tab):**
  - comments / composer: `comments`, `commentInputValue`, `commentInputRef` (a state used as a ref), `quickNotes`, `followUpNotes`, `followUpNotesSaving`, `followUpLoading`
  - queue: `callingOrderMode`, `calledProspectIds` (seam candidate), `showCallingOrder`, `didntAnswerMoveNext`
  - lock: `lockHeldBy`
  - timers: `followUpTimerSeconds` (also zeroed by the parent's `handleDeleteProspect` when it deletes the current prospect, 2170, so the parent needs a reset callback), `myTimeTodaySeconds`, `prospectLedgerSeconds`
  - callback: `scheduledCallback`, `callbackModalOpen`, `callbackDate`, `callbackTime`, `callbackNote`
  - timer history: `timerHistoryModalOpen`, `timerEvents`, `timerEventsLoading`
  - my time: `myTimeModalOpen`, `myTimeStats`, `myTimeStatsLoading`
  - copy templates (13): `copyDefaults`, `copyOverrides`, `copySubjectDefaults`, `copySubjectOverrides`, `personPhone`, `authUserName`, `editingCopyTemplateKey`, `editingCopyText`, `editingCopySubject`, `copyTemplateSaving`, `copyBlankFieldsModalOpen`, `copyBlankFieldsList`, `emailSentTemplateKeys`
  - the card's small ones: `textAskOpen`, `scriptOpen`
  - the run: `runOutcomes`, `runDone`, `runCallbackAt`, `runTextState`

  `authUserName` is also read by `handleBenchSave` and `sendRunText`.

  Refs: `lockTakenForRef` 519, `lockAttemptForRef` 520, `callingOrderModeRef` 559, `loadCommentsForProspectRef` 564, `copyTemplateTextareaRef` 636. The sixth ref, `latestLoad` 443, is the lane's.
- **Cross-tab state (stays in the parent):** the lane, the pointer, the caches, `prospectLastCallMap`, `saving`, the Edit Prospect window's cluster, the lane reads, `jobsByProspect`.
- **Derived values:**
  - `currentProspect` 1447 and `retaggableNote` 1636–1639 (`findRetaggableNote` over this prospect's comments).
  - The info card's "Last Contact" is `comments[0]?.created_at ?? currentProspect.last_contact`. "Last Successful Contact" is the newest `answered` comment.
  - Readouts: `this call` = `followUpTimerSeconds`; `my day` = `myTimeTodaySeconds + followUpTimerSeconds`; "Time on this prospect" = `prospectLedgerSeconds + followUpTimerSeconds`.
- **Handlers and loaders:**
  - `loadFollowUpProspects` 989–1095 (seam). In parallel it reads live locks held by *others* (`.gte('locked_at', callingLockCutoffIso(now))`) and every call comment. The server filter is `.eq('kind', kind)` and, off the Subs lane, `fit null | neq not_a_fit` (1013); the client then drops `not_a_fit` + `cant_reach` + `converted` (1028) and, for a non-dev, the ZZ rows, then `orderFollowUpProspects(…, callingOrderModeRef.current)`. The Subs branch 1032–1054 keeps the whole queue for the strip, then takes a run's ids in their order, or the trade filter with By need or By rank. The Jobs to GC branch 1055–1060 merges the jobs and orders by Soonest bid. Finally, if the `?prospect_id` row is missing from the list, it fetches that row and prepends it (a row of another kind switches `?kind=` instead, 1073–1085; a hidden ZZ row opens nothing).
  - Loaders: `loadComments` 1097–1110, `loadTimerEvents` 1112–1135 (last 100), `loadMyTimeStats` 1137–1163, `loadMyTimeToday` 1165–1178, `loadCopyTemplates` 1313–1356, `loadPersonPhone` 1358–1380 (users → people fallback), `loadQuickNotes` 1382–1390, `loadEmailSentTemplateKeys` 1671–1680, `loadProspectLedgerSeconds` 1690–1700, `loadScheduledCallback` 1813–1834 (useCallback).
  - Notes and copy templates: `saveFollowUpNotes` 1457–1474, `cancelFollowUpNotes` 1476–1478, `getResolvedCopyText` 1480–1484 / `getResolvedCopySubject` 1486–1490, `handleCopyTemplate` 1492–1521, `handleOpenMail` 1523–1555, `openEditCopyModal` 1557–1561, `saveCopyTemplate` 1563–1580.
  - `takeCallingLock(trigger)` 1863–1898 (useCallback). It reads the lock row, runs `callingLockDecision`, upserts only on `take` / `stale-take`, names the holder on `held-by-other`, and records `prospect_lock_taken` via `recordNavClick`.
  - Queue: `switchCallingOrder` 1955–1970, `renderCallingOrderToggle` 1972–2006 (two more orders on Subs, one more on Jobs to GC), `renderQueueRows(limit, collapseOnJump)` 2008–2061.
  - Callbacks and timer events: `openCallbackModal` 2210–2217, `saveCallback` 2219–2236, `saveTimerEvent` 2238–2246.
  - Outcomes: `handleNoLongerFit` 2248–2277, `handleCantReach` 2279–2304, `handleConverted` 2313–2357, `handleAskedUs` 2460–2512, `handleBenchSave` 2382–2438. **`handleConverted` opens the global Add customer modal** via `useNewCustomerModal().openNewCustomerModal({ initialValues: customerDraftFromProspect(p), sourceProspect, conversionLane: 'follow-up', onCreated })`. The form's Save runs `markProspectConverted`, and `onCreated` then writes the timer event, releases the lock, patches both caches and advances. Cancel writes nothing.
  - Call logging: `writeCallOutcome` 2625–2647, `markCalledLocally` 2652–2655, `handleDidntAnswer` 2721–2757, `handleAnswered` 2759–2782 (sets `last_contact` + warmth +1), `handleAddComment` 2784–2805.
  - The run: `noteRunOutcome` 2658–2665, `sendRunText` 2672–2711, the reset effect 485–491, and the run branches inside `handleDidntAnswer` (2735–2751) and `handleNextProspect` (2832–2840).
  - Quick notes and advance: `handleQuickNoteClick` 2807–2809, `handleAddQuickNote` 2811–2822 (`promptDialog`), `handleDeleteQuickNote` 2824–2829, `handleNextProspect(skipTimerEvent?)` 2831–2852.
- **Effects (16):**
  - 485–491: a new run starts clean
  - 1392–1403: per-user loads (copy templates, phone, quick notes, `users.name`)
  - 1405–1410: queue load
  - 1449–1451: the text ask closes on a new card
  - 1453–1455: notes sync
  - 1653–1659: index sync from `?prospect_id`
  - 1661–1669: comments
  - 1682–1688: email-sent keys
  - 1702–1708: ledger seconds
  - 1836–1838: scheduled callback
  - 1844–1855: lock **release-only**; deletes only when `lockTakenForRef` says this tab wrote the row
  - 1901–1909: `visibilitychange` resets the timer
  - 1912–1919: 1-second interval, gated on `cardClockTicks({ onDeck, visible, hasCard })` and keyed on the card
  - 1922–1927: textarea auto-resize
  - 1930–1934: `didntAnswerMoveNext` preference
  - 1938–1953: calling-order preference; reloads the queue if it is not `coldest`
- **Supabase tables:**
  - `prospects`: SELECT/UPDATE/DELETE
  - `prospect_calling_locks`: SELECT on load and in `takeCallingLock`; UPSERT `onConflict: 'prospect_id'`; DELETE on release/outcome
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
- **Sub-components:** `ProspectJobsBox`, `GcCallScriptWindow`, `ProspectBenchModal`, `EmptyState`. The icons are module-level and move with the tab. `renderCallingOrderToggle` + `renderQueueRows` are render helpers used twice (mobile peek and desktop rail), which makes them a presentational child to lift (`FollowUpQueue`).
- **External coupling:**
  - localStorage keys `prospects_didnt_answer_move_next_<uid>` (1932 / 4138, not try/catch-guarded) and `prospects_calling_order_v1_<uid>` (1942 / 1962, guarded)
  - `navigator.clipboard` (1516); `window.location.href = mailto:…` (1549)
  - the global Add customer modal context; the router's state on `/gc?new=1`
  - `PORTAL_COMPANY` from `supabase/functions/_shared/portalCompany` (the run's text names the company)
  - its rows feed Activity, Quickfill's team chart and Calendar callbacks (inbound `?tab=follow-up&prospect_id=` from `Calendar.tsx`)
- **Extraction status, risk and approach:** Inline. **High risk**: the biggest tab and the home of the pointer. Extract it last, after the `useProspectsData` seam. Before the JSX move, peel what needs no layout change: the two lane panels, the five windows, and the hook seams (see [order](#recommended-extraction-order-value--risk)). The pointer and the Edit Prospect window stay parent-owned.

### `board` — Board (Subs only)

- **Render location:** 4168–4204. The page filters `prospectListProspects` to the live rows, builds `calledIds` from `prospectLastCallMap`, and mounts `<SubsBoard>` with 20 props.
- **Owned state:** `laneRanks` (483) with the memo `lanePins` (484); `laneCallRows` (472) and `inboundProspectIds` (473) with the memo `subRecordMap` (481); `laneCallbacks` (474).
- **Cross-tab / shared state:** `prospectListProspects`, `prospectLastCallMap`, `gcBench`, `gcPlans`, `plansPick`, `saving`.
- **Props that are page handlers:** `onPick={setPlansFor}`, `onCall` (navigates to `runHref(ids, trade, plansFor, packageId)`), `onBench={openBenchModal}`, `onPass={passFromBoard}`, `onEdit={openEditModalForProspect}`, `onAddSub={openAddSub}`, `onDrop={dropOnBoard}`, `onUnpin={unpinOnBoard}`, `onPriority={savePriority}`, and `strip={renderSubsStrip(…)}` as a drawn node.
- **Loaders:** the list's loader (effect 1412–1416), which on Subs calls `loadLaneExtras` for the live rows (1212), which calls `loadLaneRanks`.
- **Supabase tables:** `prospect_trade_ranks` (SELECT/UPSERT `onConflict: 'prospect_id,trade'`/DELETE), `contacts`, `messages`, `prospect_callbacks` (SELECT), `prospects` (UPDATE `priority`, `prospect_fit_status`).
- **Sub-components:** [`SubsBoard`](../src/components/prospects/SubsBoard.tsx) (**extracted**, dnd-kit; a card's sortable id is `tradeKey:prospectId`), over `subsBoard.ts`, `subRecord.ts`, `subsRanks.ts`.
- **Extraction status, risk and approach:** The drawing is out. What is left is data and writes: a hook `useSubsBoardData` (the ranks, the extras, the pin writes, the priority write) beside the board. **Medium risk**, because `savePriority` patches three caches and the pins are optimistic with a reload on refusal. After the data seam.

### `prospect-list` — Prospect List

- **Render location:** 4206–4509.
  - Search input from 4214, then a grouping IIFE: `filterProspectsForList` (4228), and on Subs `renderSubsList(filtered, calledIds, nowMs)` (4232) draws the whole list instead.
  - Otherwise `groupProspectsForList(filtered, calledIds, nowMs)` (4233). The jump-chip row covers every section except `cant_reach`/`not_a_fit` (4235); the `converted` chip reads the lane's `landedChip` (4268).
  - Each `LIST_SECTION_ORDER` section (4273) is collapsible (`plist-sec-<key>`, 4278) with a desktop table (from 4293) and mobile cards (from 4408).
  - "Last touch" shows `lastTouchLabel(p, prospectLastCallMap[p.id], nowMs)` plus `formatTimerSeconds(prospectLedgerSecondsMap[p.id])`.
  - Terminal sections (`converted` / `cant_reach` / `not_a_fit`) get Edit / Send back / Not a fit / Delete. Other rows select into Follow Up.
  - The empty list's words and press come from `prospectListEmpty` 810–816.
- **The Subs list** (`renderSubsList` 3078–3197): the path strip, the For picker, then one section a trade in the needs panel's order (`groupSubsByTrade`), each row with its stage chip (`subStage`, `STAGE_TONE_STYLE` 206–212) and its press (`rowPress`: **Call now →**, **Add to the bench ✓**), then the folds *No trade named*, the landed rows and the exits. Section doors: **Call for ‹trade› →** (`callForTradeHref`) or **Add a sub** (`openAddSub`).
- **Sections (pipeline, not warmth):** `never_called` → `recent` (<30 d) → `going_cold` (30–90 d) → `cold` (90 d+) → `converted` → `cant_reach` → `not_a_fit`. `LIST_SECTIONS_DEFAULT_OPEN` = `never_called` + `recent`.
- **Owned local state (5 + 1):** `prospectListSearchQuery`, `prospectListLoading`, `prospectListSectionOpen`, `selectedProspectForList`, `prospectLedgerSecondsMap`, and the Subs list's `subsSectionOpen`.
- **Cross-tab / shared state:** `prospectListProspects`, `followUpProspects` (patched by `handleSendBack`/`handleDeleteFromList`), `prospectLastCallMap`, `saving`, the shared Edit Prospect window, the bench window (`openBenchModal(p)` from a Subs row), and the pointer (`selectProspectForList` sets `activeTab` and writes `?tab=follow-up&prospect_id=`).
- **Handlers and loaders:**
  - `loadProspectListProspects` 1180–1213, shared with Convert, the Board and a lane's Activity. It is a `prospects` SELECT by `kind` (less the ZZ rows for a non-dev) plus every call comment newest-first, building `prospectLastCallMap` at 1199–1204. On Jobs to GC it merges the jobs; on Subs it loads the Board's extras.
  - `loadProspectLedgerSecondsMap` 1710–1724.
  - `openEditModalForProspect` 2140–2148, `handleSendBack` 2562–2584, `handleNotAFitFromList` 2586–2597, `handleDeleteFromList` 2599–2616 (`confirmDialog`).
  - `toggleProspectListSection` 2854–2856, `jumpToProspectListSection` 2858–2863 (rAF + `scrollIntoView`), `selectProspectForList` 2865–2874.
- **Effects (2 + the shared loader):**
  - 1427–1445: handles `?prospect_id` (from Quickfill's Can't reach). It selects the row, opens its section via `groupProspectsForList([p], …)` when that section is not default-open, then strips the param.
  - 1726–1732: loads or clears the ledger map on tab entry/exit.
- **Supabase tables:** `prospects` (SELECT/UPDATE/DELETE), `prospect_comments` (SELECT call rows), `prospect_timer_events` (SELECT, `as any`).
- **Extraction status, risk and approach:** Inline. **Medium risk.** The JSX is self-contained, but three actions write the caches and the Edit window stays in the parent. Move `renderSubsList` out first as a component (it is already a function of its arguments and nine callbacks). Extract the tab after the data seam. Props: `kind`, `prospects`, `lastCallMap`, `loading`, `saving`, `onSelectProspect`, `onEditProspect`, `onSendBack`, `onNotAFit`, `onDelete`, `onNewProspect`. The tab can own the ledger-map loader and effect.

### `convert` — Convert (Customers only)

- **Render location:** 4511–4772.
  - Selector from 4517: a type-ahead over `convertPickerPool` where Enter picks the first hit. When the query is empty and nothing is picked, "Suggested — answered in the last 30 days" chips appear (4572). A summary card follows (4590).
  - Once `convertProspectId` is set: `NewCustomerForm` (`mode="page"`, 4625), contact-person cards (from 4639), bid cards (from 4700), and a submit row (from 4750) whose button targets `form="convert-customer-form"` (4755).
  - Its `convert*` class names are styled in `src/index.css`.
- **Owned local state (8):** `convertProspectId`, `convertSearchQuery`, `convertContactPersons`, `convertBids`, `convertServiceTypes`, `convertSaving`, `convertError`, `convertFirstInteractionDate`.
- **Cross-tab / shared state:**
  - Reads `prospectListProspects` + `followUpProspects` (the picker pool is their union) and `prospectLastCallMap`.
  - Patches both caches after a successful mark.
  - No default selection: the tab starts on search.
- **Derived values (in the component body, not memoized, 1629–1632):** `convertProspect`, `convertPickerPool`, `convertSearchResults = searchConvertProspects(pool, query)`, `convertSuggestions = suggestRecentlyAnswered(pool, prospectLastCallMap, now)`. Converted prospects are excluded by the kernel.
- **Handlers:** `pickConvertProspect` 1641–1644. `handleConvertSubmit(payload)` 2936–2992 runs in order:
  1. INSERT `customers`
  2. loop `customer_contact_persons` (skips blank names)
  3. loop `bids` (skips blank project or service type; hard-codes `materials_model: 'rough'`, 2966)
  4. `markProspectConverted(...)` + `recordProspectConverted(…, 'convert-tab')`; a failed mark only logs
  5. `navigate('/customers/<id>')`
- **Effects (3 + the shared loader 1412–1416):**
  - 1588–1615: earliest `prospect_comments` date → `convertFirstInteractionDate` (cancellation-guarded, `localCalendarDayKey`)
  - 1618–1626: `service_types` load on tab activation (`'service_types' as any`, less the billing-only types)
  - 1645–1651: pre-fill the first contact person
- **Supabase tables:** `customers`, `customer_contact_persons`, `bids` (INSERT); `service_types`, `prospect_comments` (SELECT); plus `prospects` / `prospect_comments` through `markProspectConverted`.
- **Sub-components:** [`NewCustomerForm`](../src/components/NewCustomerForm.tsx) (**extracted**, `onSubmitForConvert`).
- **Extraction status, risk and approach:** Inline. **Low risk** → `ProspectsConvertTab`. Props: `pool` (or both caches), `lastCallMap`, `authUserId`, `authRole`, `onConverted(prospectId)` (the parent patches both caches), `navigate`. All 8 states and the 3 effects move verbatim.

### `activity` — Activity (team calling stats, dev and assistant-like)

- **Render location:** 4774–4933.
  - Week report section from 4776: a header on `weekOffset` with ‹ previous / next › (not past 0), the empty week's words (`callingWeekEmptyWords`, 4803), per-user cards plus a team card when there is more than one user, and a "Daily detail" table. The landed count reads the lane's `landedCount` (4820).
  - **Source success** 4860–4879, on a lane that is not Customers: `sourceSuccess(prospectListProspects)`.
  - "Marked / Updated by day — last 30 days" 4880–4931, built from an inline date-key loop at 4885–4893.
- **Owned local state (5):** `teamDataByDate`, `teamLoading`, `weekOffset`, `weekReport`, `weekLoading`. The gate `canAccessActivityTab` lives in the parent.
- **Cross-tab state:** `kind`, `kindWords`, `hideZz`, and `prospectListProspects` for Source success (effect 1419–1424 loads it).
- **Loaders:**
  - `loadTeamActivity` 1734–1746 (useCallback) → [`loadProspectTeamActivity`](../src/lib/prospectTeamActivity.ts)`(supabase, kind, { hideZz })`. Quickfill's team chart reads the same lib for every kind.
  - `loadWeekReport(offset)` 1754–1805 (useCallback) runs 4 parallel reads: `users` (audience `.or(...)`), `prospect_comments` call/converted rows in `weekRange`, `prospect_timer_events` (`as any`), and `prospect_callbacks`, each joined on `prospects!inner(kind)`. The results feed [`buildProspectWeekReport`](../src/lib/prospects/prospectWeekReport.ts).
  - Effects: 1748–1752 and 1807–1811.
- **Supabase tables:** `users`, `prospect_comments`, `prospect_timer_events`, `prospect_callbacks`.
- **Extraction status, risk and approach:** Inline. **Lowest risk** → `ProspectsActivityTab`. Props: `kind`, `hideZz`, `laneRows` (for Source success). It validates the seam the way `bid-costs` did for Bids.

### `team` — Hiring (extracted wrapper)

- **Render location:** 3309–3311: `<TeamProspectsTab authUserId={authUser.id} isDev={authRole === 'dev'} canEditOnboarding={isOwnerOrDev(authRole)} resolveMasterId={getEffectiveMasterId} shared={!teamProspectsAccess} />`.
- **In the parent:** `useMyHiringShares` (428) + `canOpenHiring` (429). The `?tab=` effect waits for `hiringSharesLoading` as it does for `authLoading`.
- **Extraction status:** **Done at page level.** The component is the surface's second God component; see the next section.

### `permits` — Permits (extracted)

- **Render location:** 3313: `<ProspectsResearchTab authUserId={authUser.id} />`. The key was `research` until v2.6787, and the old key still opens the tab and is rewritten.
- **In the parent:** `canResearch` (431), the `?tab=` branch 678–697, `openResearchTab` 967–976 (it drops the tab's own address keys through `permitsLinkCleared`, so the tab's name opens on Skim), and the estimator's landing (722).
- **What the tab owns, all of it outside this file:** [`ProspectsResearchTab.tsx`](../src/components/prospects/ProspectsResearchTab.tsx) (805 lines, 30-odd states) and its children (`PermitSkimDeck`, `PermitSkimLook`, `PermitSkimGoogleStill`, `PermitPlaceList`, `PermitBuilders`, `PermitBuildingSheet`, `WhoPulledItSheet`, `PermitDecideSheet`, `PermitCloseOutSheet`, `PermitFindPanel`, `PermitCountStrip`, `PermitLookAlikes`, `ResearchMapCard`, `BuilderNameTies`, `GoogleSearchPress`), over the kernels in `src/lib/research/`.
  - Its views: Skim, Investigating, Pursuing, Closed, the second look, Find, Builders, the ledger and the map.
  - Its four verdicts (`VERDICT_WORDS`): **Pursue**, **Investigate**, **Pass**, **Has a plumber**. Pursue makes a lead on the Customers deck or on Jobs to GC (`approachFromPermit`: a `prospects` row, and a `prospect_jobs` row for a lead), which is the tab's one write into this page's tables.
  - Its cities come from `RESEARCH_CITIES`; the feeds are read by the edge functions `permit-pull` and `permit-lookup`.
  - Its address keys (`view=builders`, `looks=1`, `city=`) are read and written through `src/lib/research/permitsLink.ts`.
- **Extraction status:** **Done.** `PROJECT_DOCUMENTATION.md` §17 holds the tab's flows. At 805 lines it is under the map threshold; it gets its own map if it passes 1,500.

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

| Window | Anchor | State | Opened from | Verdict |
|---|---|---|---|---|
| Edit Prospect | 4936–5033 | `editModalOpen`, `editingProspect` (null ⇒ edits `currentProspect`), the `editPerson` / `editCompany` blocks, `editSource` / `editTrades` / `editMaxMiles` / `editRole`, `editOpenedWith`; `editGuard` (749) with `LeaveQuestion` (5013); `openEditModal` 2098–2107 / `openEditModalForProspect` 2140–2148, `editSnapshotOf` 2110–2120, `setEditKindFields` 2122–2127, `kindFieldsPayload` 2130–2138, `handleDeleteProspect` 2150–2177, `saveEdit` 2179–2208; warmth ± (`handleWarmthDelta` 2073–2084 / `handleWarmthReset` 2086–2096) at 5006–5008, shown only when editing the current prospect; `ProspectPersonForm` (4991) and `renderKindFields` (4992) | Follow Up "Edit prospect", Prospect List row actions, the Subs list, a Board card | **Stays in parent** (3 tabs) until the data seam; then a controller hook |
| New Prospect | 5457–5597 | `newProspectModalOpen`, `newKind`, `newSource` / `newTrades` / `newMaxMiles` / `newRole`, the `newPerson` / `newCompany` blocks, `newCustomerLink`, `newProspectError`; `newGuard` (747) with `LeaveQuestion` (5577); the three kind cards (5488–5510); the double line (`newProspectTwin` 850–852, drawn 5535–5564 with its three doors); `openNewProspect` 802–808, `openAddSub` 818–825, `resetNewProspectForm` 758–767, `closeNewProspect` 750–753, `openDoubleProspect` 855–870, `saveNewProspect` 2895–2934 (`getEffectiveMasterId`, `blocksProblem`; switches lanes when `newKind` is not the lane's) | the tab row's button (3297–3305, `canAccessFollowUp`), `?newProspect=true`, the empty lane (3501), the empty list, Add a sub (the needs panel, the Subs list, the Board) | **Stays in parent** (tab row + URL) until the lane read hooks; then a controller hook |
| Callback | 5036–5111 | `callbackModalOpen`, `callbackDate`/`callbackTime`/`callbackNote`, `saveCallback` | Follow Up only | Moves on its own, or with Follow Up |
| Copy template edit | 5114–5248 | `editingCopyTemplateKey`, `editingCopyText`, `editingCopySubject`, `copyTemplateSaving`, placeholder chips via `copyTemplateTextareaRef` | Follow Up only, Customers only | Moves with `useProspectCopyTemplates` |
| Copy blank fields | 5251–5294 | `copyBlankFieldsModalOpen`, `copyBlankFieldsList` | Follow Up only | Moves with `useProspectCopyTemplates` |
| Timer history | 5297–5369 | `timerHistoryModalOpen`, `timerEvents`, `timerEventsLoading`, `loadTimerEvents` | Follow Up `this call` timer | **Self-contained**: moves on its own with its loader |
| My time | 5372–5449 | `myTimeModalOpen`, `myTimeStats`, `myTimeStatsLoading`, `loadMyTimeStats` (+ live `followUpTimerSeconds` bonus when `activeTab === 'follow-up'`) | Follow Up footer | **Self-contained**: moves on its own with its loader; takes the live seconds as a prop |
| Call script | 5451 | `scriptOpen`; `<GcCallScriptWindow job={run ? { trade, project } : null}>` | the Subs card's **Call script** | Extracted; the state moves with Follow Up |
| Add to the bench | 5452–5455 | `benchDraft` (the prospect, the draft, the ask), `benchSaving`, `benchError`; `<ProspectBenchModal onSave={handleBenchSave}>` | the Subs card's last press, a Subs list row, a Board card | Extracted; stays with `handleBenchSave` in the parent |

**May we text?** is not a window: it is a chooser inline on the card (3548–3568, `textAskOpen`).

## URL / navigation router (parent, permanent)

- **`?tab=`** effect 646–729 waits for `authLoading` **and** `hiringSharesLoading`, because the per-user grants arrive with the role.
  - `subs` and `gc-leads` are doors, not tabs (653–662): each is rewritten to `tab=follow-up` with `kind=`.
  - `team` requires `canOpenHiring`; otherwise it rewrites to `follow-up` (`replace: true`).
  - `permits` (or the older `research`, rewritten to `permits`) requires `canResearch`; otherwise it rewrites.
  - `activity` requires `canAccessActivityTab`, `convert` the Customers lane, `board` the Subs lane (699); otherwise it rewrites.
  - A missing tab resolves through [`resolveProspectsLanding`](../src/lib/prospects/prospectsLanding.ts) and is written into the URL. An estimator with no Prospects flag lands on `permits` (722).
  - `setTab`, `setKindTab`, `openTeamTab` and `openDoubleProspect` remember the clicked top tab in localStorage (`prospects:lastTopTab`); `openResearchTab` and URL-driven landings never write it. Each also sets `?tab=` and deletes `prospect_id`.
- **`?kind=`** (`gc-leads`, `subs`; bare for Customers): read first by `kindFromSearch` for the state's initial value (442), then by the `?tab=` effect (663–664). Written by `setKindTab` (946–965), which also drops `trade` and `for` off the Subs lane, by `openDoubleProspect`, and by `loadFollowUpProspects` when an inbound `?prospect_id=` is another lane's row (1077–1082).
- **`?prospect_id=`:**
  - read by `loadFollowUpProspects` (fetch-and-prepend when missing), the index-sync effect 1653–1659, and the Prospect List effect 1427–1445 (which opens the right section, then strips the param)
  - written by `updateUrlProspectId` on every advance/removal/queue jump, by `selectProspectForList` and by `openDoubleProspect`
  - inbound from Calendar (follow-up), Quickfill's Can't reach (prospect-list) and GC projects' *Send the owner back to Prospects* (`?tab=gc-leads&prospect_id=`)
- **`?trade=`** (Subs): the deck's trade filter. Read at 459 and inside `loadFollowUpProspects`; written by `setTradeFilter` (913–921, which also drops `prospect_id`); inbound from the bench's *Find N more* (`subsLaneHref`) and the list's **Call for ‹trade› →**.
- **`?for=`** (Subs): the project a set of plans is for. Read at 468; written by `setPlansFor` (924–931); carried by the run and by `boardHref`.
- **`?run=`** with `?trade=`, `?for=`, `?pkg=` (Subs): the run's ids, fixed at the press (`runFromSearch` / `runHref`, `callRun.ts`). Read at 475 and inside `loadFollowUpProspects` (1038); written by the Board's `onCall` (4191).
- **`?newProspect=true`** (Dashboard quick-add): effect 732–742 opens the New Prospect window and strips the param.
- **`?stage=` / `?rate=`** (from the Dashboard pinned row, Needs you and the Person desk, e.g. `/prospects?tab=team&stage=review&rate=<id>`): handled **inside** TeamProspectsTab (effect 814–826). It passes through `coerceStage(wanted, shared)`, so a share holder's `hire`/`review` is ignored. It is applied once, then stripped.
- **`?view=` / `?looks=` / `?city=`** (Permits): handled **inside** `ProspectsResearchTab` through `permitsLink.ts`. The parent only clears them in `openResearchTab`.

All of this stays in the parent (playbook rule), except the keys the two extracted tabs already own.

## Test coverage by region

`Prospects.tsx` has a render smoke since v2.7615, [`Prospects.render.test.tsx`](../src/pages/Prospects.render.test.tsx) (60 cases, the Hiring board and the Permits tab stubbed), and no e2e spec opens `/prospects`. TeamProspectsTab has [`TeamProspectsTab.render.test.tsx`](../src/components/prospects/TeamProspectsTab.render.test.tsx) with 6 cases. There is **no money math on this surface**. The untested arithmetic is time (⚠ timer-second sums and my-time windows) and the copy-template rules (⚠, real business rules with zero tests).

| Region | Tested kernels (`it` blocks) | Render test | Untested inline logic |
|---|---|---|---|
| Shell / router | `prospectsLanding` (4), `prospectConversion` (19, incl. `canAccessProspectPipeline`), `laneLoad` (6), `prospectKinds` (14), `pagePadding` (2), `permitsLink` (9) | — | the `?tab` rewrite effect 646–729; `setKindTab`'s param rules 946–965 |
| The lanes | `subsLane` (13), `gcNeeds` (13), `subsStages` (12), `gcLeadLane` (14), `stripState` (1), `zzProspects` (2), `companyDouble` (9), `benchAsk` (2), `benchOrigin` (3) | `ProspectJobsBox` (7), `ProspectBenchModal` (6) | the bench read's shaping 782–786; `handleBenchSave`'s cache and pointer patch 2412–2429; `handleAskedUs`'s chain |
| Follow Up | `callingOrder` (11), `callingLock` (10), `callLogState` (7), `callRun` (15), `deckWords` (6), `textingRule` (1), `personBlock` (9), `phoneContact` (5) | — | ⚠ copy-template substitution / blank-field rules 269–337; formatters 222–267; ⚠ my-time windows 1137–1178 and ledger sum 1690–1700; queue window 2009; `writeCallOutcome` insert-then-delete; the queue-after-removal arithmetic, six copies |
| Board | `subsBoard` (8), `subRecord` (4), `subsRanks` (3) | `SubsBoard` (4) | `writePins`' optimistic paint 1243–1262; `loadLaneExtras`' two folds 1286–1310 |
| Prospect List | `prospectListGrouping` (13), `callLogState` (7), `subsStages` (12) | — | `handleSendBack` comparator 2575–2580; ⚠ ledger-map reduce 1710–1724; last-call map build 1199–1204 |
| Convert | `convertProspectSearch` (8), `prospectConversion` (19) | — | `handleConvertSubmit` insert chain 2936–2992 |
| Activity | `prospectTeamActivity` (4), `prospectWeekReport` (9); `prospectTeamActivityChartData` (2) is Quickfill's and not imported here (reuse target below) | — | 30-day date-key loop 4885–4893 |
| New / Edit windows | `companyOwner` (4), `companyDouble` (9), `windowLeave` (4), `personBlock` (9), `mapsShareText` (4) | `ProspectPersonForm` (3) | `kindFieldsPayload` 2130–2138; `editSnapshotOf` 2110–2120 |
| Permits (`ProspectsResearchTab`) | the kernels under `lib/research/` | `ProspectsResearchTab` (44), `PermitBuilders` (13) | outside covers |
| TPT Screen | `teamProspectRanking` (23), `teamProspectSourceSummary` (16, incl. an `it.each` matrix), `candidateHygiene` (8), `columnShares` (7), `sharedHiringTab` (4) | share chip + column menu; share-holder trimmed board | `parseCandidateLinks`/`serializeCandidateLinks`; `mergeDuplicate` merge rules 1096–1122; `handleDragEnd` wiring |
| TPT Interview | — | — | review draft ↔ row mapping (1242–1251) |
| TPT Try-out | `helperTrial` (6), `trialTally` (13) | 3 cases (helper-column gating, trial card dated by the company calendar, tally + nudge + Keep trying) | — |
| TPT Hire | `hireRosterKinds` (7) | — | `moveOnboardingItem` swap 1357–1372 |
| TPT Review (`TeamReviewSection`) | `teamMemberReviews` (22), `reviewerCalibration` (9), `teamComposite` (9), `teamLeaderboard` (4), `teamReviewDue` (12) | — | outside covers |

## Stage-A pure-logic inventory

Extract to `src/lib/*` + colocated tests **before** any component moves. Most rules already live in tested kernels (last row). What remains in `Prospects.tsx`, in the order to take it:

| # | Candidate | Currently | Target |
|---|---|---|---|
| 1 | `substituteCopyPlaceholders` 312–337, `getBlankPlaceholderFields` 269–295, `getBlankFieldsForMail` 297–310 + `COPY_TEMPLATE_KEYS`/`COPY_TEMPLATE_LABELS`/`APP_SETTINGS_KEYS`/`APP_SUBJECT_SETTINGS_KEYS` 105–124; the override-fallback rule in `getResolvedCopyText`/`Subject` 1480–1490; the defaults and overrides fold in `loadCopyTemplates` 1320–1355 | **shipped v2.7595** | `lib/prospects/prospectCopyTemplates.ts`, 27 tests: placeholder substitution, `_______` per-template behavior, blank-field detection incl. the `forMail` prospect-email rule, `null`-or-`''` → default (`resolveCopyText`), the two reads' fold (`foldCopyTemplateRows`) |
| 2 | The `Prospect` type 148–184, `PROSPECT_COLUMNS` 187–188, `ProspectComment` 190–198 | **shipped v2.7598** | `lib/prospects/prospectRow.ts` (types and the column list, 3 tests: every type key is in the list and nothing else is) |
| 3 | `formatDateTime`, `formatInteractionType`, `formatTimerButtonName`, `formatTimerSeconds`, `formatWebsiteDisplay`, `getWebsiteHref` (222–267); TPT `formatLastContact` 341–347 | the page's six **shipped v2.7595 / v2.7598** (14 tests); TPT's `formatLastContact` still module-level, untested | `lib/prospects/prospectFormat.ts` |
| 4 | The queue after a card leaves, six copies of `nextList` / `nextIdx = Math.min(index, Math.max(0, length − 1))`: `handleDeleteProspect` 2167–2171, `handleNoLongerFit` 2270–2275, `handleCantReach` 2297–2302, `handleConverted` 2348–2353, `handleBenchSave` 2419–2429 (with the row-before-the-pointer branch), `leaveQueueAsLanded` 2448–2453 | **shipped v2.7603**, the six call sites with it | `queueAfterRemoval(queue, index, id)` and `indexAfterOtherRowLeft` in `callingOrder.ts`, 11 tests |
| 5 | `loadMyTimeStats` windows 1140–1145, `loadMyTimeToday` 1167–1169, the sums at 1147 / 1176, ledger sums 1690–1700 / 1710–1724 | **shipped v2.7606** | `lib/prospects/prospectTimerSums.ts`: `sumTimerSeconds` / `sumTimerSecondsByProspect` / `myTimeWindows(now)`, 11 tests |
| 6 | `kindFieldsPayload` 2130–2138, `editSnapshotOf` 2110–2120 | **shipped v2.7606** | `prospectKinds.ts` and `windowLeave.ts`, 10 tests |
| 7 | The `sourceProspect` literal, written twice: `handleConverted` 2319–2331 and `handleAskedUs` 2490–2502 | **shipped v2.7606** | `sourceProspectOf(p)` beside `customerDraftFromProspect` in `prospectConversion.ts` |
| 8 | The Subs deck's order in `loadFollowUpProspects` 1032–1054 (a run's ids in their order, else the trade filter, By need, By rank over the pins) | inline, between awaits; it moves with the loader in step 10, since By rank awaits a read in the middle | `orderSubsDeck({ queue, run, trade, mode, needs, called, records, pins })` + tests |
| 9 | The bench read's shaping 782–786 (the dependable counts, the quoted set, the plans' input, our own trades, the vetted flag) | inline in an effect; it moves with `useSubsBench` in step 8 | `benchReadFromBoard(rows, projects, today)` beside `gcBenchInput` + tests |
| 10 | `handleSendBack` re-insert comparator 2575–2580; queue window `start` in `renderQueueRows` 2009 | **shipped v2.7603** | `insertColdest` and `queueWindowStart` in `callingOrder.ts`, 9 tests |
| 11 | last-call map build 1199–1204 (first row per prospect of the newest-first call rows) | **shipped v2.7606** | `lastCallByProspect(rows)` in `callLogState.ts`, 3 tests |
| 12 | `loadLaneExtras`' two folds: inbound lines by contact → prospect 1286–1297, first upcoming callback per prospect 1303–1307 | **shipped v2.7606** | `inboundProspects(contacts, lines)` in `subRecord.ts` and `firstCallbackWords(rows, now)` in `callRun.ts`, 5 tests |
| 13 | Convert's rows: the picker pool union 1630, the first-contact prefill 1647–1650, the skip rules in `handleConvertSubmit` 2946–2969 | the two skip rules **shipped v2.7606**; the pool union and the prefill move with the tab in step 7 | `convertContactRows` and `convertBidRows` in `prospectConversion.ts`, 3 tests |
| 14 | Activity 30-day date-key loop 4885–4893 | **shipped v2.7606** | reuses [`getOrderedDateKeysLast30Days`](../src/lib/prospectTeamActivityChartData.ts), reversed, since the tab renders newest first |
| 15 | `saveCallback`'s title 2222 | **shipped v2.7606** | calls `runCallbackTitle` |
| 16 | `parseCandidateLinks` / `serializeCandidateLinks` 166–186 + `mergeDuplicate`'s merge rules 1096–1106 (link dedupe by URL, notes concatenated when they differ) and review re-point filter 1118–1120 | module-level / inline in TPT, untested | `lib/prospects/candidateLinks.ts` (+ `mergeCandidateFields`) + tests |
| — | **Already in lib with tests** | 38 kernels under `lib/prospects/` (the deck: `callingOrder`, `callLogState`, `callingLock`, `prospectConversion`, `prospectsLanding`, `prospectListGrouping`, `convertProspectSearch`, `prospectWeekReport`; the lanes: `prospectKinds`, `laneLoad`, `subsLane`, `gcNeeds`, `gcLeadLane`, `subsStages`, `subsBoard`, `subRecord`, `subsRanks`, `callRun`, `benchAsk`, `benchOrigin`, `companyDouble`, `deckWords`, `windowLeave`, `zzProspects`, `stripState`, `personBlock`, `mapsShareText`, `textingRule`, `leadThread`, `pagePadding`; Hiring: `candidateHygiene`, `helperTrial`, `hireRosterKinds` and the review kernels), plus `prospectTeamActivity`, `teamProspectRanking`, `teamProspectSourceSummary`, `hiring/trialTally`, `hiring/columnShares`, `hiring/sharedHiringTab` | — (reference implementations) |

### Cross-surface duplicates (fix outside the moves)

- **The prospects-staff audience predicate** exists 4× on the client: `canAccessProspectPipeline` (`lib/prospects/prospectConversion.ts`), `hasProspectsStaffAccess` (`lib/hiring/columnShares.ts`, the twin of DB `user_has_prospects_staff_access()`), and the PostgREST string `.or('role.in.(dev,master_technician,assistant,controller),and(role.eq.estimator,estimator_prospects_access.eq.true)')` in both `loadWeekReport` (1766) and `lib/prospectTeamActivity.ts`.
- **"Called"** (`CALL_INTERACTION_TYPES`) is loaded twice by unbounded full scans of call comments: `loadFollowUpProspects` 1002 and `loadProspectListProspects` 1188–1192. `loadWeekReport` hard-codes `['didnt_answer', 'answered', 'converted']` (1771).
- **The GC board is read here the way `GcProjects` reads it** (`loadGcProjects` → `loadGcBoardRows` → `boardStateFromRows` → `tradeBenches`, 777–781), and the Jobs to GC effect calls `loadGcProjects` again (877). One `useGcBoardRead` would serve the page and GC projects.
- **`loadCustomerDoubles`** is called by two effects (839 and 886), and both write `customerDoubles`.
- `team_prospect_role_shares` is read 3×: TPT `load()`, `useMyHiringShares` (this page's gate) and `useHiringColumnShares` (the person desk). The playbook's cross-surface seam 41 holds it.
- Quickfill's [`prospectWarmthCounts.ts`](../src/lib/prospectWarmthCounts.ts) still buckets by warmth, while the Prospect List groups by pipeline stage. The playbook's *Prospects ↔ Quickfill* row holds it.

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **Stale type casts.** Prospects.tsx has `(supabase as any)` on `prospect_timer_events` ×10 (1115, 1150–1153, 1170, 1692, 1712, 1775, 2240) and `'service_types' as any` (1621). TPT has `'team_prospect_trial_tally' as never` (863) and `keepTrying`'s update `as never` (1219), plus jsonb `links` written `as unknown as string` (1020, 1055, 1109). Those tables, the RPC and the `trial_deferred_*` columns are all in generated `database.ts` now, so the casts are removable. Do that in a separate types pass, never during a move.
2. **Calling locks are advisory, taken on intent, and expire.**
   - Triggers: `dial` (3653), `composer` (3864), `outcome` (2723 / 2761), `callback` (2211). The lane's last press takes no lock.
   - A colleague's row younger than `CALLING_LOCK_TTL_MS` (30 min) is never overwritten; an older row is taken over.
   - `loadFollowUpProspects` hides only live rows held by *others* at load time.
   - Release (1844–1855) means to delete only the row this tab wrote (`lockTakenForRef`); see quirk 36, no release is sent today. `handleNoLongerFit`, `handleCantReach`, `handleConverted`, `handleBenchSave`, `leaveQueueAsLanded` and `handleNextProspect` also delete the caller's own row; Didn't Answer and Answered do not.
   - There is no purge job; staleness is a read-side rule.
3. **`?prospect_id` fetch-and-prepend** (1062–1090) deliberately shows a prospect even when it is `not_a_fit`/`cant_reach`/`converted` or locked, because Prospect List, Calendar and Quickfill must be able to open anything. A row of another kind is handed to its own lane, and a hidden ZZ row opens nothing.
4. **Queue filter is split.** The server excludes `not_a_fit` on two lanes only (1013): the Subs lane reads every row, because its strip counts the exits. The client drops `not_a_fit` + `cant_reach` + `converted` (1028) and, for a non-dev, the ZZ rows. The order comes from `callingOrderModeRef.current`, a ref rather than state, so the loader is not recreated when the mode changes.
5. **The queue reloads on every URL change, and twice on the Subs lane's entry.** Effect 1405–1410 depends on `searchParams`, so each `updateUrlProspectId` (every advance, removal and queue jump) re-runs `loadFollowUpProspects` + `loadMyTimeToday`, and the index-sync effect re-points. It also depends on `benchTrades`, so the Subs deck loads once before the bench read answers and once after (By need reads the bench). In never-called-first mode, a prospect just called moves into the called block on that reload. Keep the dependencies.
6. **Timer semantics.**
   - `followUpTimerSeconds` resets on tab re-visibility and on every advance.
   - A `prospect_timer_events` row is written only by `saveTimerEvent` for `no_longer_fit` / `next_prospect` / `cant_reach` / `converted`. A landing writes `converted` on every lane, and closes over the click-time render values.
   - `handleDidntAnswer`'s auto-advance calls `handleNextProspect(true)`: **no timer event, no lock delete, no `loadMyTimeToday`** on that path. The release effect still frees the lock.
   - `handleBenchSave` writes the timer event only when the landed prospect is the deck's card (2413).
7. **Live "session bonus":** `my day`, "Time on this prospect" and the My time window add the running `followUpTimerSeconds` to DB sums (the window only when `activeTab === 'follow-up'`). Yesterday intentionally gets no bonus.
8. **Last Contact and warmth.**
   - The card prefers `comments[0]?.created_at` over `prospects.last_contact`.
   - `handleAnswered`/`handleDidntAnswer`/`handleAddComment` bump `last_contact` to now after inserting.
   - Answered also sets warmth +1. The warmth pill on the card is read-only; ± lives only in the Edit window and only for the current prospect. `handleWarmthDelta`/`Reset` patch the Follow Up cache only. On the Subs lane the card shows the priority presses in place of the pill.
9. **Call-outcome retag** (`writeCallOutcome` 2625–2647). Applies when the composer is empty and the newest comment is the caller's own `user_comment` within `RETAG_NOTE_WINDOW_MS` (10 min). The outcome row takes the note's text and original `created_at`, and **then** the note is deleted: insert-then-delete, because `prospect_comments` has no UPDATE policy. A failed delete toasts but keeps the call.
10. **Single-cache patches are safe only because the list reloads on every tab entry** (effect 1412–1416). `handleNoLongerFit`, `handleDidntAnswer` and `handleAddComment` leave `prospectListProspects` stale until then.
11. **Copy-template override fallback:** an override that is `null` **or** `''` falls back to the app_settings default. The save upsert writes `subject_text: editingCopySubject || null`. The template row shows on the Customers lane only (4029).
12. **`handleOpenMail` fires the mailto first**, then upserts `prospect_email_sent`. The envelope-check icon is per user + prospect + template.
13. **One global `saving` flag** across every lane's mutations; TeamProspectsTab has its own `busy`, Convert has `convertSaving`, the bench window has `benchSaving`. Keep each scope intact. `savePriority`, `saveOkToText` and the job handlers set none of them.
14. **Edit window dual identity:** `editingProspect === null` means "editing `currentProspect`" (Follow Up); a set value means "editing this row" (Prospect List, the Subs list, the Board). `handleDeleteProspect` handles both and re-points the Follow Up index. The kind boxes follow `(editingProspect ?? currentProspect)?.kind ?? kind`.
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
25. **`commentInputRef` is a state, not a ref.** The auto-resize effect depends on it re-running when the node mounts.
26. **Dialogs are context dialogs:** `handleAddQuickNote` and `markJobLost` use `promptDialog`, and the two prospect deletes (2154, 2602), `passFromBoard` (2715), merge, Try out and the Try-out card's Pass (`endTryOut`) use `confirmDialog`. TPT's candidate and column deletes confirm inline instead (`confirmingDelete`, `confirmDeleteRoleId`), and Pass on a Screen or Interview card (`setStatus('passed')`) has no confirm. New Prospect and Edit prospect ask to leave inline (`LeaveQuestion` through `useLeaveGuard`). Keep them as they are; no modal redesign during the move.
27. **A run is fixed at the press.** `?run=` carries the ids; the deck works them in that order and nothing reshuffles (1039–1042). The run's notes (`runOutcomes`, `runDone`, `runCallbackAt`, `runTextState`) reset when the ids change (485–491) and do not survive a refresh. In a run Didn't Answer never auto-advances: it writes a callback at `callbackHourFor(now)` and offers the text (2735–2751). Next on the last card shows the receipt and never wraps to the first (2832–2840).
28. **A landing from a list row or a Board card leaves the deck's card alone.** `handleBenchSave` advances only when the landed prospect is the card (2412, 2422–2426); when the landed row sat before the pointer the index steps back one (2427–2428). A refused ask leaves the landing whole and says so (2406–2408).
29. **Asked us ✓ makes no second customer.** With `customer_id` set it marks the prospect against the customer on file (2476–2485). Marking the job asked is fail-soft (2466–2470): the project still opens.
30. **The job handlers key the cache two ways.** `changeJob`, `markJobLost` and `removeJob` patch `jobsByProspect[currentProspect.id]`; `addJobFor` takes the id and `editJobFor` uses `job.prospect_id`. They agree only because the Jobs box draws on the deck's card.
31. **`customerDoubles` has two writers** (effects 829–849 and 873–896). Whichever read answers last wins; both read the same rows.
32. **`passFromBoard` patches `laneAllRows` whatever the write did** (2717–2718): `handleNotAFitFromList` swallows its error. On a refused write the strip's count moves and the list's does not, until the next load.
33. **The empty lane's press opens New Prospect without setting its kind** (3501 calls `setNewProspectModalOpen(true)`, not `openNewProspect`). The window opens on whatever `newKind` last was: `customer` on a fresh visit, even on the Subs or Jobs to GC lane. The `?newProspect=true` door does the same on purpose (it comes from the Dashboard). *Suspected defect, read from the code and not walked live; it gets its own fix PR, never a move.*
34. **`saveNewProspect` on another lane's kind** closes the window and calls `setKindTab(newKind)`; the loaders then run on the kind change, not from the save (2927–2931).
35. **The page imports `PORTAL_COMPANY` from `supabase/functions/_shared/portalCompany`** (97). A client file reading the edge side's shared folder is on purpose here: one company name for the app and the functions.
36. **No calling lock is ever released.** The eight releases are written `void supabase.from('prospect_calling_locks').delete()…` and never awaited: the release effect, `handleNoLongerFit`, `handleCantReach`, `handleConverted`, `handleBenchSave`, `leaveQueueAsLanded` and `handleNextProspect` twice. The Supabase client sends a query only when it is awaited, so none is sent, and a lock stays until it goes stale. The render smoke pins this (v2.7615). *A defect, found by the smoke; it gets its own fix PR, never a move.*

## Recommended extraction order (value ÷ risk)

The page is 5,600 lines: 313 of module scope, about 2,800 of state, effects and handlers, and 2,378 of render. Every step is one small PR that changes no behaviour. Steps 1 and 2 need no render smoke; step 3 is the smoke every later step leans on.

1. **Stage A, the copy-template rules** → `lib/prospects/prospectCopyTemplates.ts` (inventory row 1) — **shipped v2.7595** (the three rules, `resolveCopyText`, `foldCopyTemplateRows`, and `formatDateTime` as the first export of `prospectFormat.ts`; 29 tests; the page is 5,481 lines).
2. **Stage A, the rest**, in the inventory's order — the row types and the formatters **shipped v2.7598** (`prospectRow.ts`, `prospectFormat.ts`, 15 tests; the page is 5,389 lines); the queue rules **shipped v2.7603** (`queueAfterRemoval`, `indexAfterOtherRowLeft`, `insertColdest`, `queueWindowStart`, 20 tests, the six handlers adopted; 5,377 lines); the time sums, the loaders' folds and the windows' helpers **shipped v2.7606** (31 tests; 5,284 lines). Stage A is done but for rows 8 and 9, which sit between awaits and move with their loader (step 10) and their hook (step 8).
3. **The page's first render smoke**, `src/pages/Prospects.render.test.tsx` — **shipped v2.7615** (60 cases: every `?tab=` key on every lane, the lane doors, the roles, the deck's outcomes and its pointer, a run, the Board's run press, the list, Convert, Activity and six windows; seven of eight deliberate breaks caught, the eighth changes nothing on screen). Tests only.
4. **The Subs lane's drawn pieces → `components/prospects/`:** `SubsPathStrip` (`renderSubsStrip`), `SubsPlansPicker` (`renderPlansPicker`), `SubsLaneList` (`renderSubsList`), `SubsNeedsPanel` (3318–3419), `GcWorkStrip` (3420–3469). Each is already a function of its arguments. About −350 lines.
5. **Follow Up's two self-contained windows:** `ProspectTimerHistoryModal` and `ProspectMyTimeModal`, each with its loader and its three states. About −220 lines. Then `ProspectCallbackModal` with `saveCallback`.
6. **`activity` → `ProspectsActivityTab`:** 5 states, 2 callbacks, 2 effects, 160 lines of render, no shared writes. Validates the tab seam.
7. **`convert` → `ProspectsConvertTab`:** 8 states, 3 effects, 262 lines of render and `handleConvertSubmit`. Props: `pool`, `lastCallMap`, `authUserId`, `authRole`, `onConverted`. The 1412–1416 loader effect stays in the parent.
8. **The lane read hooks (no JSX move):** `useSubsBench` (effect 771–794 and its 5 states), `useGcLeadStrip` (effect 873–896), `useProspectDoubles` (effect 829–849, `newProspectTwin`), `useProspectJobs` (`jobsByProspect`, `mergeJobs`, the five job handlers). Ten states leave the page, each hook read-only or self-contained.
9. **Follow Up hook seams (no JSX move).** `useCallingLock` takes refs 519–520, `lockHeldBy`, release effect 1844–1855 and `takeCallingLock` 1863–1898; its kernel is already tested. `useProspectCopyTemplates` takes the 13 copy states, `copyTemplateTextareaRef`, loaders 1313–1380 / 1671–1680, effect 1682–1688, the copy / phone / `authUserName` part of the per-user effect 1392–1403 (its `loadQuickNotes` call stays), handlers 1480–1580 and the two copy windows. `useCallRun` takes the run's four states, the reset effect, `noteRunOutcome` and `sendRunText`.
10. **Data seam `useProspectsData`:** the lane, the caches, the pointer, the call-history sets, both loaders (+ `callingOrderModeRef`, `latestLoad`), `updateUrlProspectId`, `markCalledLocally`, `saving`, and the tandem-patch helpers. The parent destructures it; nothing downstream changes. **The highest-risk step**: do it on a quiet day, after step 3's smoke covers every lane.
11. **`useSubsBoardData`** beside `SubsBoard` (the ranks, the extras, the pin writes, the priority write), then **`prospect-list` → `ProspectsListTab`**, both consuming the seam.
12. **The New Prospect and Edit Prospect windows** as a controller hook and a component each (`useNewProspectWindow` + `NewProspectWindow`, `useEditProspectWindow` + `EditProspectWindow`). `renderKindFields` becomes `ProspectKindFields` on the way.
13. **`follow-up` → `ProspectsFollowUpTab`:** lift `FollowUpQueue` (`renderQueueRows` + `renderCallingOrderToggle`) first. Then move the remaining owned states and the per-prospect effects. Controlled selection, the outcomes that write the caches and the Edit window stay in the parent.
14. **TeamProspectsTab** (independent track; can interleave from step 1): the module components to their own files (`EmailText`, `CandidateLinkChips`, `CandidateRatingBars`, `TrialTallyBlock`, `CandidateFields`, `SortableCandidateCard`, `RoleColumn` and the style/dnd helpers, 193–782, ≈590 lines, with the `candidateLinks.ts` Stage A), then `TeamHireStage` → `TeamTryoutStage` → `TeamInterviewStage` → optionally `TeamScreenBoard`, plus the share-editor hook. `rows`/`roles`/`load`/`busy`/`modalError`/`setStatus`/`openEdit`/`markContacted`/`startTryOut` and the roster hand-off stay in TeamProspectsTab.

Steps 1 to 9 take the page to about 4,000 lines with no step above low risk. Steps 10 to 13 take it to a shell of about 1,200.

**What must stay in `Prospects.tsx` permanently:**
- the `?tab=` / `?kind=` / `?prospect_id=` / `?newProspect=` router and the access-gate rewrites
- `topTab`/`activeTab`/`kind` and the two tab rows
- the selection pointer and the caches (via the seam hook)
- `saving`
- the landings that write the caches and the pointer (`handleConverted`, `handleAskedUs`, `handleBenchSave`, `leaveQueueAsLanded`)
- `getEffectiveMasterId`
- `useMyHiringShares` and the `canAccessFollowUp` / `canAccessActivityTab` / `canOpenHiring` / `canResearch` gates

Definition of done per tab, verification gates (`npm run typecheck && npm run lint && npm test` after every step), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). Behavior-preserving only.

## Hazards

- **One render smoke and no e2e on the page.** `Prospects.render.test.tsx` (v2.7615) is what proves a move. It mounts the router with `v7_startTransition` off, as `src/main.tsx` does; with it on, the address and the page's tab state commit in two renders and the list's jump to a card loses its prospect. A cut adds its own cases when it moves something the 60 do not press.
- **The handlers are plain inner functions, not `useCallback`s.** Each closes over the render it was made in, and three paths depend on that: `saveTimerEvent` reads the click-time `followUpTimerSeconds`, `handleConverted`'s `onCreated` runs after the Add customer window closes with the click-time queue, and `handleAskedUs`'s `landed` does the same. A hook that memoizes them changes which render they see.
- **Three effects carry `eslint-disable react-hooks/exhaustive-deps`** (1423, 1918, 1952), and the loader effects call non-memoized loaders. Moving a loader into a hook must keep the same dependency lists, or the queue reloads at different moments (quirk 5).
- **The Follow Up block is one ternary chain** (3480–4127) with an IIFE that defines its button styles (3511–3526). A partial lift has to carry those styles or import them.
- **`Prospect` is a page-local type** (148–184). Until it lives in a lib file, every extracted component re-declares a structural copy, as `SubsBoard` and `ProspectJobsBox` do today.
- **The file was hot for ten days and is quiet now.** 58 commits in 90 days, 20 in the last 30, none of them a feature since 2026-11-11. On 2026-11-17 no open PR touches it and no session card names it. Check `npm run sessions` and the open PRs again before each cut: the permit train (#302, #307) writes into the lanes from outside and could come back to the page.
- **The lanes read the GC tables.** A change to `lib/gc/gcIo.ts` or `boardRows.ts` reaches this page's strips, and the render smoke must stub those reads.
- **The CSS class names** (`followUpQueueRail`, `followUpQueueMobileStrip`, `followUpCommentsSection`, `followUpInfoCard*`, `convert*`) are styled in `src/index.css`. A moved block keeps its class names.
