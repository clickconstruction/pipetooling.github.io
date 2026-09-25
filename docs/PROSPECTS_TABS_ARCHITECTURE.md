# Prospects Tabs Architecture Map

---
file: docs/PROSPECTS_TABS_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the Prospects surface (per PAGE_DECOMPOSITION_PLAYBOOK.md) — what every tab of src/pages/Prospects.tsx (3,962 lines) and the already-extracted src/components/prospects/TeamProspectsTab.tsx (2,383 lines, the hottest file on the surface) touches (state, loaders, handlers, sub-components, supabase tables/RPCs, cross-tab coupling), so extraction can proceed tab by tab without re-deriving the strategy.
covers:
  - src/pages/Prospects.tsx
  - src/components/prospects/TeamProspectsTab.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
sections: What this surface is; Master summary table; Shared substrate; Per-tab dossiers; TeamProspectsTab sub-decomposition; Page-level modals; URL / navigation router; Test coverage by region; Stage-A pure-logic inventory; Preserve-quirks list; Recommended extraction order
---

## What this surface is

[`src/pages/Prospects.tsx`](../src/pages/Prospects.tsx) is the customer-prospecting cold-call workstation plus the door to the Hiring board. [`src/components/prospects/TeamProspectsTab.tsx`](../src/components/prospects/TeamProspectsTab.tsx) is the extracted Hiring tab, which has grown into its own God component: the Hiring wave from v2.3627 to v2.3805 (Try-out stage, trial tally, column shares, shared board) landed there. Hook censuses are from `npm run map` at a05cef4c4:

| File | Lines (July map) | useState · effects · useMemo · useCallback · refs | Handlers | Commits (90 d) | Role |
|---|---|---|---|---|---|
| `Prospects.tsx` (`Prospects` 264–3962) | 3,962 (3,373) | 80 · 24 · 0 · 4 · 5 | 57 | 30 | shell + router + 4 Customers tabs + 7 modals |
| `TeamProspectsTab.tsx` (`TeamProspectsTab` 782–2383) | 2,383 (1,820) | 36 · 2 · 0 · 1 · 0 (35 in the component + `RoleColumn.menuOpen`) | 34 | 31 | Hiring board: 5 stages + 6 modals |

Prospects.tsx has 9 custom hooks (`useNavigate`, `useLocation`, `useAuth`, `useMyHiringShares`, `useToastContext`, `useConfirmDialog`, `usePromptDialog`, `useNewCustomerModal`, `useSearchParams`). Its module scope (57–262) holds 12 functions (formatters, copy-template helpers, `tabStyle`, `DIDNT_ANSWER_MOVE_NEXT_KEY`), 4 copy-template constants and 3 inline SVG icons (`EnvelopeIcon` / `EnvelopeCheckIcon` / `EditIcon`, 78–94). TeamProspectsTab.tsx has 7 module-level components (186–779) and 6 module functions (159–340) above the component (see the sub-decomposition section below).

The page switches on **three levels of tab state**:

```
topTab:    'customers' | 'team'                                   (ProspectsTopTab 96)
activeTab: 'follow-up' | 'prospect-list' | 'convert' | 'activity' (ProspectsTab 98, PROSPECTS_TABS 128; only under 'customers')
stage:     'screen' | 'interview' | 'tryout' | 'hire' | 'review' (TeamProspectsTab 803; HiringStage in lib/hiring/sharedHiringTab.ts)
```

One `?tab=` param selects both upper levels: `team` selects the Hiring tab (its label changed from Team to Hiring in v2.1253, and the key stayed `team`), and the four `PROSPECTS_TABS` values select the Customers sub-tabs. `?stage=` (+ `?rate=`) is applied once inside TeamProspectsTab and then stripped.

Access gates:
- **`canAccessFollowUp`** (1983): signed in AND [`canAccessProspectPipeline`](../src/lib/prospects/prospectConversion.ts)`(authRole, estimatorProspectsAccess)`. That means dev, master_technician, assistant or controller, or an estimator with the flag. It gates Follow Up, Prospect List and Convert (each shows "You do not have access" otherwise) and the New Prospect button. An estimator without the flag gets an early-return page (1993–2001).
- **`canAccessActivityTab`** (416): `authRole === 'dev' || isAssistantLike(authRole)`.
- **`canOpenHiring`** (270): `teamProspectsAccess || myHiringShares.length > 0`. Since v2.3805, `useMyHiringShares` reads the viewer's own `team_prospect_role_shares` rows. A share holder without the switch gets the trimmed board, because the page passes `shared={!teamProspectsAccess}`.

**Line numbers are exact as of a05cef4c4 and will drift. Always search for the named symbol.**

## Master summary table

| Region | Render anchor (a05cef4c4) | Lines | Status | Owned state | Coupling | Risk | Recommended action |
|---|---|---|---|---|---|---|---|
| Shell: gates, tab rows, URL router | effects 418–465 / 468–478, `setTab` 480–490, `openTeamTab` 492–501, tab rows 2003–2078 | ~155 | permanent parent | `topTab`, `activeTab` | — | — | Stays |
| Follow Up | `topTab === 'customers' && activeTab === 'follow-up'` 2084–2595 + 5 tab-local modals 3445–3853 | 512 + 401 | inline | 39 states, 5 refs, 13 effects, 2 callbacks | high (pointer, both caches, `saving`, `calledProspectIds`/`prospectLastCallMap`, Edit modal) | high | Hook seams first (`useCallingLock`, `useProspectCopyTemplates`); extract **last** |
| Prospect List | `activeTab === 'prospect-list'` 2597–2898 | 302 | inline (grouping Stage-A'd → `prospectListGrouping.ts`) | 5 states, 2 effects | med (3 cache-writing actions, shared Edit modal, pointer via `selectProspectForList`) | med | Extract after the data seam |
| Convert | `activeTab === 'convert'` 2900–3161 | 262 | inline (picker Stage-A'd → `convertProspectSearch.ts`) | 8 states, 3 effects | low-med (reads the cache union + `prospectLastCallMap`; patches both caches on success) | low | **Extract 2nd** → `ProspectsConvertTab` |
| Activity | `activeTab === 'activity' && canAccessActivityTab` 3163–3301 | 139 | inline (both loaders lib-backed) | 5 states, 2 callbacks, 2 effects | none | lowest | **Extract 1st** → `ProspectsActivityTab` |
| Hiring (key `team`) | `topTab === 'team' && canOpenHiring && authUser?.id` 2080–2082 | 3 | **extracted** (`TeamProspectsTab`) | 0 (parent owns `useMyHiringShares` for the gate) | 4 props: `authUserId`, `isDev`, `resolveMasterId`, `shared` | — | Sub-decompose (below) |
| Edit Prospect modal | `editModalOpen && (currentProspect \|\| editingProspect)` 3304–3442 | 139 | inline, parent | 8 states | opened by Follow Up + Prospect List; hosts warmth ± (3409–3421) | — | Stays in parent |
| New Prospect modal | `newProspectModalOpen` 3856–3959 | 104 | inline, parent | 8 states | tab-row button + `?newProspect=true` | — | Stays in parent |
| — TPT module components | `EmailText` 186–201 … `RoleColumn` 625–779 | ~594 | inline in file, pure props | `RoleColumn.menuOpen` only | none | lowest | **Move to own files first** |
| — TPT Screen | header 1652–1690, board 1692–1739, Passed 2052, Sources 2054–2101 | ~150 | inline | 5 | `rows`/`roles`/`busy`/`load`/`setStatus`/`openEdit`, hygiene, shares, drag | med-high | Last |
| — TPT Interview | 1741–1848 + My review modal 2179–2226 | 108 + 48 | inline | 2 (reads TPT-level `reviews`/`reviewerNames` from `load`) | `setStatus`, `startTryOut`, `markContacted` | low-med | 3rd |
| — TPT Try-out (v2.3627) | 1849–1916 | 68 | inline | `trialTallies` (from `load`) | `endTryOut`, `keepTrying`, `markContacted`, `openEdit`, `prefixMap` | low | 2nd |
| — TPT Hire | 1917–2043 + Onboarding settings modal 2276–2368 | 127 + 93 | inline | 6 onboarding states | roster hand-off modal (2228–2274) is opened by `setStatus('hired')` from any stage | low | **1st stage move** |
| — TPT Review | 2044–2051 | 8 | **extracted** (`TeamReviewSection`, 1,025 lines) | 0 (`rateUserIdFromUrl` passed down) | `onOpenScreenBoard={() => setStage('screen')}` | — | Done |
| — TPT Share with… (v2.3802) | 2369–2380 → `ShareColumnDialog` (79 lines) | 12 | dialog **extracted**; state + handlers inline | 4 (`shares` from `load`, `shareRoleId`, `shareAccounts`, `shareAccountsLoading`) | `RoleColumn` ⋯ menu; the Screen board also reads `shares` for the share chip; the dialog names sharers from `reviewerNames` | low | Hook seam with the dialog |

## Shared substrate

1. **Selection pointer:** `currentProspectIndex` (281) indexes `followUpProspects` (280) and yields `const currentProspect = followUpProspects[currentProspectIndex] ?? null` (799). It syncs to the URL as `?prospect_id=`.
   - The index is written by every advance/removal handler, by the `renderQueueRows` row click (1356–1360), by `loadFollowUpProspects` (557) and by the index-sync effect (1000–1006). The `?prospect_id=` half is written by `updateUrlProspectId` (1393–1401) and, cross-tab, by `selectProspectForList` (1870–1879).
   - `?prospect_id=` is read by `loadFollowUpProspects` (541–555) and the index-sync effect (1000–1006).
   - Six per-prospect effects hang off `currentProspect?.id`: notes sync 801–803, comments 1008–1016, email-sent keys 1029–1035, ledger seconds 1049–1055, scheduled callback 1178–1180 (via `loadScheduledCallback` 1155–1176), and calling-lock release 1186–1197. The Convert-default effect was deleted in v2.2879.
   - **Stays in the parent**, passed to an extracted Follow Up as controlled props.
2. **Dual prospect caches:** `followUpProspects` (15 writers) and `prospectListProspects` (314; 11 writers). Which mutation writes which:
   - both caches: `saveFollowUpNotes`, `handleDeleteProspect`, `saveEdit`, `handleCantReach`, `handleConverted`, `handleSendBack`, `handleDeleteFromList`, `handleAnswered`, `handleConvertSubmit`
   - Follow Up cache only: `handleWarmthDelta`, `handleWarmthReset`, `handleNoLongerFit`, `handleDidntAnswer`, `handleAddComment`
   - list cache only: `handleNotAFitFromList`
   - reloads both: `saveNewProspect`

   Two call-history derivatives travel with the caches:
   - `calledProspectIds` (335): set by `loadFollowUpProspects`, patched by `markCalledLocally` 1749–1752. It drives the "never called" chip and the queue order.
   - `prospectLastCallMap` (318): set by `loadProspectListProspects`, patched by `markCalledLocally`. It is read by Prospect List ("Last touch"), Convert search and suggestions, and the list's `?prospect_id` effect.

   This is the page's `useBidPricingEngine` analog. The seam hook would be **`useProspectsData`**, returning `{ followUpProspects, prospectListProspects, currentProspectIndex, currentProspect, calledProspectIds, prospectLastCallMap, followUpLoading, prospectListLoading, loadFollowUpProspects, loadProspectListProspects, updateUrlProspectId, markCalledLocally, saving, setSaving, …patch helpers }`. `callingOrderModeRef` (334) has to move with `loadFollowUpProspects`, which reads it.
3. **One global `saving` flag** (289; 21 readers, 14 writers) disables buttons across all Customers tabs and modals. A behavior-preserving extraction keeps it page-level (or in the seam hook), not per tab. Convert has its own `convertSaving`.
4. **Tab-keyed loaders:**
   - 765–770 runs `loadFollowUpProspects` + `loadMyTimeToday` on `[topTab, activeTab, authUser?.id, searchParams]`. See quirk 5.
   - 772–776 runs `loadProspectListProspects` on entry to prospect-list **or** convert. That shared loader effect stays in the parent.
5. **TeamProspectsTab is substrate-free from the parent's side.**
   - It takes 4 props and loads its own data.
   - `getEffectiveMasterId` (1881–1885) is now just `resolveCompanyOwnerUserId(supabase, authUser.id)` (v2.2972, one company). It serves `saveNewProspect` and TPT's `saveNewCandidate`/`addRole`.
   - *Inside* TPT the substrate is `rows`/`roles`/`loading`/`busy`/`modalError`/`load()` plus `setStatus`/`openEdit`/`markContacted`/`startTryOut`.
6. **Logic duplicated with other surfaces** (collapse or cross-link; do not "fix" during a move):
   - The prospects-staff audience predicate exists 4× on the client: `canAccessProspectPipeline` (`lib/prospects/prospectConversion.ts`), `hasProspectsStaffAccess` (`lib/hiring/columnShares.ts`, the twin of DB `user_has_prospects_staff_access()`), and the PostgREST string `.or('role.in.(dev,master_technician,assistant,controller),and(role.eq.estimator,estimator_prospects_access.eq.true)')` in both `loadWeekReport` (1112) and `lib/prospectTeamActivity.ts` (34).
   - "Called" (`CALL_INTERACTION_TYPES`) is loaded twice by unbounded full scans of call comments: `loadFollowUpProspects` 514 and `loadProspectListProspects` 652–656. `loadWeekReport` hard-codes `['didnt_answer', 'answered', 'converted']` (1116).
   - `team_prospect_role_shares` is read 3×: TPT `load()`, `useMyHiringShares` (this page's gate) and `useHiringColumnShares` (`ActiveAccountsPanel` in the app-level Active accounts modal, opened by "Manage accounts…"). `team_prospect_roles` is read by TPT `load()` and `useHiringColumnShares`.
   - Quickfill's [`prospectWarmthCounts.ts`](../src/lib/prospectWarmthCounts.ts) still buckets by warmth and counts `converted` as active. Its doc comment says it matches the Prospect List, but the list regrouped by pipeline stage in v2.2453, so the two have drifted apart.

## Per-tab dossiers

### `follow-up` — Follow Up (the calling workstation)

- **Render location:** 2084–2595. It contains:
  - Header card IIFE 2098–2266:
    - who you're calling, with a due badge, the "never called" chip, the "<name> is calling this one" chip, and a `telHrefFor` link that takes the lock (2164)
    - outcome row 2173–2203: Didn't Answer / Answered / Can't reach / Not a fit / Converted ✓
    - utility row 2204–2263: Set callback · Edit prospect · 🔥 warmth pill (read-only) · scheduled-callback `<Link to="/calendar">` · mobile "N of M · show order" · the `this call` timer (opens Timer history) · `my day`
  - Mobile queue peek 2268–2281 (15 rows).
  - Comments section 2283–2415 (the composer takes the lock on focus at 2295; `retaggableNote` hint at 2314; quick-note chips from 2319).
  - Info card with notes 2416–2458: Last Contact / Last updated by / Last Successful Contact / Address / Time on this prospect.
  - Copy-template buttons 2459–2515.
  - "Next Prospect →" bar 2516–2538.
  - Desktop queue rail 2540–2554 (v2.2458; 12 rows).
  - Footer 2557–2593: the Didn't-Answer auto-advance checkbox and the "my time" link.

  Five tab-local modals render after the tab blocks (see [Page-level modals](#page-level-modals)).
- **Owned local state (39, moves with the tab):**
  - comments / composer: `comments`, `commentInputValue`, `commentInputRef` (a state used as a ref), `quickNotes`, `followUpNotes`, `followUpNotesSaving`, `followUpLoading`
  - queue: `callingOrderMode`, `calledProspectIds` (seam candidate), `showCallingOrder`, `didntAnswerMoveNext`
  - lock: `lockHeldBy`
  - timers: `followUpTimerSeconds` (also zeroed by the parent's `handleDeleteProspect` when it deletes the current prospect, 1471, so the parent needs a reset callback), `myTimeTodaySeconds`, `prospectLedgerSeconds`
  - callback: `scheduledCallback`, `callbackModalOpen`, `callbackDate`, `callbackTime`, `callbackNote`
  - timer history: `timerHistoryModalOpen`, `timerEvents`, `timerEventsLoading`
  - my time: `myTimeModalOpen`, `myTimeStats`, `myTimeStatsLoading`
  - copy templates (13): `copyDefaults`, `copyOverrides`, `copySubjectDefaults`, `copySubjectOverrides`, `personPhone`, `authUserName`, `editingCopyTemplateKey`, `editingCopyText`, `editingCopySubject`, `copyTemplateSaving`, `copyBlankFieldsModalOpen`, `copyBlankFieldsList`, `emailSentTemplateKeys`

  Refs (all 5): `lockTakenForRef` 296, `lockAttemptForRef` 297, `callingOrderModeRef` 334, `loadCommentsForProspectRef` 339, `copyTemplateTextareaRef` 408.
- **Cross-tab state (stays in the parent):** the pointer, both caches, `prospectLastCallMap`, `saving`, and the Edit Prospect modal cluster.
- **Derived values:**
  - `currentProspect` 799 and `retaggableNote` 983–986 (`findRetaggableNote` over this prospect's comments).
  - The info card's "Last Contact" is `comments[0]?.created_at ?? currentProspect.last_contact`. "Last Successful Contact" is the newest `answered` comment.
  - `formatDueBadge` 144–151.
  - Readouts: `this call` = `followUpTimerSeconds`; `my day` = `myTimeTodaySeconds + followUpTimerSeconds`; "Time on this prospect" = `prospectLedgerSeconds + followUpTimerSeconds`.
- **Handlers and loaders:**
  - `loadFollowUpProspects` 503–560 (seam). In parallel it reads live locks held by *others* (`.gte('locked_at', callingLockCutoffIso(now))`) and every call comment. The server filter is `fit null | neq not_a_fit`; the client then drops `cant_reach` + `converted` (536), then `orderFollowUpProspects(…, callingOrderModeRef.current)`. Finally, if the `?prospect_id` row is missing from the list, it fetches that row and prepends it.
  - Loaders: `loadComments` 562–575, `loadTimerEvents` 577–600 (last 100), `loadMyTimeStats` 602–628, `loadMyTimeToday` 630–643, `loadCopyTemplates` 673–716, `loadPersonPhone` 718–740 (users → people fallback), `loadQuickNotes` 742–750, `loadEmailSentTemplateKeys` 1018–1027, `loadProspectLedgerSeconds` 1037–1047, `loadScheduledCallback` 1155–1176 (useCallback).
  - Notes and copy templates: `saveFollowUpNotes` 805–822, `cancelFollowUpNotes` 824–826, `getResolvedCopyText`/`getResolvedCopySubject` 828–838, `handleCopyTemplate` 840–869, `handleOpenMail` 871–903, `openEditCopyModal` 905–909, `saveCopyTemplate` 911–928.
  - `takeCallingLock(trigger)` 1205–1240 (useCallback). It reads the lock row, runs `callingLockDecision`, upserts only on `take` / `stale-take`, names the holder on `held-by-other`, and records `prospect_lock_taken` via `recordNavClick`.
  - Queue: `switchCallingOrder` 1295–1310, `renderCallingOrderToggle` 1312–1344, `renderQueueRows(limit, collapseOnJump)` 1346–1391.
  - Callbacks and timer events: `openCallbackModal` 1516–1523, `saveCallback` 1525–1542, `saveTimerEvent` 1544–1552.
  - Outcomes: `handleNoLongerFit` 1554–1582, `handleCantReach` 1584–1608, `handleConverted` 1617–1657. **`handleConverted` opens the global Add customer modal** via `useNewCustomerModal().openNewCustomerModal({ initialValues: customerDraftFromProspect(p), sourceProspect, conversionLane: 'follow-up', onCreated })`. The form's Save runs `markProspectConverted`, and `onCreated` then writes the timer event, releases the lock, patches both caches and advances. Cancel writes nothing.
  - Call logging: `writeCallOutcome` 1722–1744, `markCalledLocally` 1749–1752, `handleDidntAnswer` 1754–1773, `handleAnswered` 1775–1797 (sets `last_contact` + warmth +1, v2.2458), `handleAddComment` 1799–1820.
  - Quick notes and advance: `handleQuickNoteClick` 1822–1824, `handleAddQuickNote` 1826–1837 (`promptDialog`), `handleDeleteQuickNote` 1839–1844, `handleNextProspect(skipTimerEvent?)` 1846–1857.
- **Effects (13):**
  - 752–763: per-user loads (copy templates, phone, quick notes, `users.name`)
  - 765–770: queue load
  - 801–803: notes sync
  - 1008–1016: comments
  - 1029–1035: email-sent keys
  - 1049–1055: ledger seconds
  - 1178–1180: scheduled callback
  - 1186–1197: lock **release-only**; deletes only when `lockTakenForRef` says this tab wrote the row
  - 1243–1251: `visibilitychange` resets the timer
  - 1253–1259: 1-second interval, gated on `topTab === 'customers' && activeTab === 'follow-up' && visible`
  - 1262–1267: textarea auto-resize
  - 1270–1274: `didntAnswerMoveNext` preference
  - 1278–1293: calling-order preference; reloads the queue if it is not `coldest`
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
- **Sub-components:** none extracted. The icons are module-level and move with the tab. `renderCallingOrderToggle` + `renderQueueRows` are render helpers used twice (mobile peek and desktop rail), which makes them the first presentational child to lift (`FollowUpQueue`). Kernels used: `callingOrder`, `callingLock`, `callLogState`, `prospectConversion`, `navClickTelemetry`, `phoneContact`, `dateUtils`.
- **External coupling:**
  - localStorage keys `prospects_didnt_answer_move_next_<uid>` (1272 / 2567, not try/catch-guarded) and `prospects_calling_order_v1_<uid>` (1282 / 1302, guarded)
  - `navigator.clipboard`; `window.location.href = mailto:…`
  - the global Add customer modal context
  - its rows feed Activity, Quickfill's team chart and Calendar callbacks (inbound `?tab=follow-up&prospect_id=` from `Calendar.tsx` 1229 / 1856 / 1952)
- **Extraction status, risk and approach:** Inline. **High risk**: the biggest tab and the home of the pointer. Extract it last among the Customers tabs, after the `useProspectsData` seam. Before the JSX move, peel two hook seams that need no layout change (see [order](#recommended-extraction-order-value--risk) step 5). The pointer (`currentProspect`, `onSelectNext`, `updateUrlProspectId`) and the Edit Prospect modal stay parent-owned.

### `prospect-list` — Prospect List

- **Render location:** 2597–2898.
  - Search input 2605–2617, then a grouping IIFE 2618–2894: `filterProspectsForList` → `groupProspectsForList(filtered, calledIds, nowMs)`.
  - Jump-chip row 2634–2661 covers every section except `cant_reach`/`not_a_fit`.
  - Each `LIST_SECTION_ORDER` section is collapsible (`plist-sec-<key>`) with a desktop table (2682–) and mobile cards (2797–).
  - "Last touch" shows `lastTouchLabel(p, prospectLastCallMap[p.id], nowMs)` plus `formatTimerSeconds(prospectLedgerSecondsMap[p.id])`.
  - Terminal sections (`converted` / `cant_reach` / `not_a_fit`) get Edit / Send back / Not a fit / Delete. Other rows select into Follow Up.
- **Sections (v2.2453, pipeline, not warmth):** `never_called` → `recent` (<30 d) → `going_cold` (30–90 d) → `cold` (90 d+) → `converted` → `cant_reach` → `not_a_fit`. `LIST_SECTIONS_DEFAULT_OPEN` = `never_called` + `recent`.
- **Owned local state (5):** `prospectListSearchQuery`, `prospectListLoading`, `prospectListSectionOpen` (`Partial<Record<ListSectionKey, boolean>>`), `selectedProspectForList`, `prospectLedgerSecondsMap`.
- **Cross-tab / shared state:** `prospectListProspects`, `followUpProspects` (patched by `handleSendBack`/`handleDeleteFromList`), `prospectLastCallMap`, `saving`, the shared Edit Prospect modal, and the pointer (`selectProspectForList` sets `activeTab` and writes `?tab=follow-up&prospect_id=`).
- **Handlers and loaders:**
  - `loadProspectListProspects` 645–671, shared with Convert. It is an unfiltered `prospects` SELECT plus every call comment newest-first, building `prospectLastCallMap` at 663–667.
  - `loadProspectLedgerSecondsMap` 1057–1071.
  - `openEditModalForProspect` 1440–1449, `handleSendBack` 1659–1681, `handleNotAFitFromList` 1683–1694, `handleDeleteFromList` 1696–1713 (`confirmDialog`).
  - `toggleProspectListSection` 1859–1861, `jumpToProspectListSection` 1863–1868 (rAF + `scrollIntoView`), `selectProspectForList` 1870–1879.
- **Effects (2 + the shared loader):**
  - 779–797: handles `?prospect_id` (from Quickfill `CantReachSection.tsx` 95). It selects the row, opens its section via `groupProspectsForList([p], …)` when that section is not default-open, then strips the param.
  - 1073–1079: loads or clears the ledger map on tab entry/exit.
- **Supabase tables:** `prospects` (SELECT/UPDATE/DELETE), `prospect_comments` (SELECT call rows), `prospect_timer_events` (SELECT, `as any`).
- **Extraction status, risk and approach:** Inline. **Medium risk.** The JSX is self-contained, but three actions write the caches and the Edit modal stays in the parent. Extract after the data seam. Props: `prospects`, `lastCallMap`, `loading`, `saving`, `onSelectProspect`, `onEditProspect`, `onSendBack`, `onNotAFit`, `onDelete`. The tab can own the ledger-map loader and effect. Stage A is done (`prospectListGrouping.ts`, 13 tests).

### `convert` — Convert (prospect → customer)

- **Render location:** 2900–3161.
  - Selector 2906–3006: a type-ahead over `convertPickerPool` where Enter picks the first hit; results show `lastTouchLabel`. When the query is empty and nothing is picked, "Suggested — answered in the last 30 days" chips appear. A summary card follows.
  - Once `convertProspectId` is set: `NewCustomerForm` (`mode="page"`, from 3010), contact-person cards (3028–), bid cards (3089–), and a submit row (3139–) whose button targets `form="convert-customer-form"`.
- **Owned local state (8):** `convertProspectId`, `convertSearchQuery`, `convertContactPersons`, `convertBids`, `convertServiceTypes`, `convertSaving`, `convertError`, `convertFirstInteractionDate`.
- **Cross-tab / shared state:**
  - Reads `prospectListProspects` + `followUpProspects` (the picker pool is their union) and `prospectLastCallMap`.
  - Patches both caches after a successful mark.
  - No default selection since v2.2879: the tab starts on search.
- **Derived values (in the component body, not memoized, 976–979):** `convertProspect`, `convertPickerPool`, `convertSearchResults = searchConvertProspects(pool, query)`, `convertSuggestions = suggestRecentlyAnswered(pool, prospectLastCallMap, now)`. Converted prospects are excluded by the kernel.
- **Handlers:** `pickConvertProspect` 988–991. `handleConvertSubmit(payload)` 1925–1981 runs in order:
  1. INSERT `customers`
  2. loop `customer_contact_persons` (skips blank names)
  3. loop `bids` (skips blank project or service type; hard-codes `materials_model: 'rough'`)
  4. `markProspectConverted(...)` + `recordProspectConverted(…, 'convert-tab')`; a failed mark only logs
  5. `navigate('/customers/<id>')`
- **Effects (3 + the shared loader 772–776):**
  - 936–963: earliest `prospect_comments` date → `convertFirstInteractionDate` (cancellation-guarded, `localCalendarDayKey`)
  - 966–973: `service_types` load on tab activation (`'service_types' as any`)
  - 992–998: pre-fill the first contact person
- **Supabase tables:** `customers`, `customer_contact_persons`, `bids` (INSERT); `service_types`, `prospect_comments` (SELECT); plus `prospects` / `prospect_comments` through `markProspectConverted`.
- **Sub-components:** [`NewCustomerForm`](../src/components/NewCustomerForm.tsx) (**extracted**, `onSubmitForConvert`).
- **Extraction status, risk and approach:** Inline. **Low risk. Extract second** → `ProspectsConvertTab`. Props: `pool` (or both caches), `lastCallMap`, `authUserId`, `authRole`, `onConverted(prospectId)` (the parent patches both caches), `navigate`. All 8 states and the 3 effects move verbatim.

### `activity` — Activity (team calling stats, dev/assistant)

- **Render location:** 3163–3301.
  - Week report section 3165–3247: a header on `weekOffset` with ‹ previous / next › (not past 0), per-user cards plus a team card when there is more than one user, and a "Daily detail" table.
  - "Marked / Updated by day — last 30 days" 3248–3299, built from an inline date-key loop at 3253–3262.
- **Owned local state (5):** `teamDataByDate`, `teamLoading`, `weekOffset`, `weekReport`, `weekLoading`. There is no cross-tab state; the gate `canAccessActivityTab` lives in the parent.
- **Loaders:**
  - `loadTeamActivity` 1081–1092 (useCallback) → [`loadProspectTeamActivity`](../src/lib/prospectTeamActivity.ts), shared with Quickfill's team chart.
  - `loadWeekReport(offset)` 1100–1147 (useCallback) runs 4 parallel reads: `users` (audience `.or(...)`), `prospect_comments` call/converted rows in `weekRange`, `prospect_timer_events` (`as any`), and `prospect_callbacks`. The results feed [`buildProspectWeekReport`](../src/lib/prospects/prospectWeekReport.ts) (v2.2456).
  - Effects: 1094–1098 and 1149–1153.
- **Supabase tables:** `users`, `prospect_comments`, `prospect_timer_events`, `prospect_callbacks`.
- **Extraction status, risk and approach:** Inline. **Lowest risk. Extract first** → `ProspectsActivityTab`. Its only prop is `canAccess` (or keep the parent render gate). It validates the seam the way `bid-costs` did for Bids.

### `team` — Hiring (extracted wrapper)

- **Render location:** 2080–2082: `<TeamProspectsTab authUserId={authUser.id} isDev={authRole === 'dev'} resolveMasterId={getEffectiveMasterId} shared={!teamProspectsAccess} />`.
- **In the parent:** `useMyHiringShares` (269) + `canOpenHiring` (270). The `?tab=` effect waits for `hiringSharesLoading` as it does for `authLoading`.
- **Extraction status:** **Done at page level.** The component is the surface's second God component; see the next section.

## TeamProspectsTab sub-decomposition

[`TeamProspectsTab.tsx`](../src/components/prospects/TeamProspectsTab.tsx) (2,383 lines) renders the five-stage hiring pipeline. Stage tabs (1608–1651) come from `allStageTabs` (1599–1605) filtered by `stageAllowed(key, shared)` (1606): Screen (active count) → Interview (`calling`) → Try-out (`trial`) → Hire (`hired`) → Review (`activeUserCount`). It also renders six modals: five are built through one `modal(title, body, onClose, opts)` factory (1507–1521) that shares a single `modalError`, and Share with… is `ShareColumnDialog` (2369–2380). `powers = hiringTabPowers(shared)` (784) hides the office controls from a share holder: `canPass`, `canHire`, `canDelete`, `canAddRole`, `canManageColumn`, `showUnsorted`, `showPassed`, `showSources`, `canEditTrialCard`. A share holder sees only Screen / Interview / Try-out.

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
| `parseCandidateLinks` / `serializeCandidateLinks` | 159–171 / 174–179 | pure, **untested** (Stage-A) |
| `EmailText` | 186–201 | v2.3601 wrap-at-`@` |
| `CandidateLinkChips`, `CandidateRatingBars` | 204–231, 237–260 | |
| `inputStyle`, `labelSpanStyle`, `NUDGE_TONE` | 262–269 | |
| `TrialTallyBlock` | 276–306 | v2.3715 |
| `smallButtonStyle`, `dropId`, `boardCollisionDetection`, `formatLastContact` | 308–340 | custom collision order: `pointerWithin` → `rectIntersection` → `closestCorners` |
| `CandidateFields` | 342–446 | Add + Edit modal body |
| `SortableCandidateCard` | 449–622 | `useSortable`; props `candidate`, `rank`, `busy`, `onEdit`, `onMarkContacted`, `onSetStatus`, `onPullUp`, `onTryOut`, `duplicate`, `canPass`, `alsoInRoles`, `isCallNext` |
| `RoleColumn` | 625–779 | `useDroppable`; own `menuOpen` (664); ⋯ menu (Share with…, Delete column) 699–738; delete confirm 739–753 |

**Internal shared substrate:** `rows`, `roles`, `loading`, `busy` (34 readers, 18 writers), `modalError`, `stage`, plus the `load`-fed `activeUserCount` (read only by the stage-tab row, 1604), `reviews` (read by `mergeDuplicate` on Screen and by Interview) and `reviewerNames` (Interview's reviewer names and the Share dialog's `nameOf`, 2376).
- `load()` 851–899 runs 8 parallel reads: `team_prospects`, `team_prospect_roles`, `team_prospect_reviews`, `team_onboarding_items`, `team_prospect_onboarding_statuses`, the active-`users` count, RPC `team_prospect_trial_tally` (fail-soft), and `team_prospect_role_shares`. A follow-up `users` names read then covers reviewers and sharers.
- Derived per render (905–924): `groupTeamProspects(rows)` → `activeByRole`/`calling`/`trial`/`hired`/`passed`, plus `reviewsByProspect`, `roleNameById`, `referencedCountByRole`, `unsortedActive`, `sourceSummary`, `knownSources`, `hygiene` (Screen candidates only) and `rowById`.
- Shared handlers: `setStatus` 1132–1146 (`hired` opens the roster hand-off), `openEdit` 1482–1499, `markContacted` 1387–1400, `startTryOut` 1153–1177 (from Screen cards and Interview), `renderCard` 1574–1594.
- If the stages are split, this becomes `useTeamProspectsData`.

**Per-stage inventory:**

- **Screen:** header 1652–1690 (`boardIntro(shared, roles.length)` + Add role, gated by `powers.canAddRole`), board 1692–1739 (`DndContext` + one `RoleColumn` per role + Unsorted when `powers.showUnsorted` and non-empty), Passed bucket 2052 (`bucketSection` 1523–1566, `powers.showPassed`) and Source success 2054–2101 (`powers.showSources`).
  - Owned state: `addingRole`, `newRoleName`, `confirmDeleteRoleId`, `passedOpen`, `sourcesOpen`.
  - Handlers: `handleDragEnd` 947–991 (+ `applyListsToRows` 941–945, `persistRankUpdates` 926–939), `addRole` 1402–1427 (`resolveMasterId`), `deleteRole` 1465–1480, `openAdd` 1501–1505, `mergeDuplicate` 1082–1130 (from the card's duplicate chip, `powers.canDelete`).
  - Share cluster: `openShare` 1430–1444, `toggleShare` 1447–1463 (one INSERT/DELETE per tick).
- **Interview** (1741–1848): read-only per-role columns of `calling` candidates with tel links and everyone's reviews.
  - Buttons: My review / Talked today / Back to Screen / Try out (helper columns only) / Advance to Hire (`canHire`) / Pass (`canPass`).
  - Owned state: `reviewTarget`, `reviewDraft`. It also reads `reviews`/`reviewerNames` from `load`, which stay at TPT level (`mergeDuplicate` reads `reviews`; the Share dialog reads `reviewerNames`).
  - Handlers: `openReview` 1238–1251, `saveReview` 1253–1278 (upsert `onConflict: 'team_prospect_id,reviewer_user_id'`). Modal 2179–2226.
- **Try-out** (1849–1916; v2.3627, tally in v2.3715): trial cards with `trialSinceLabel` and `TrialTallyBlock(buildTrialTally(row, { todayYmd: todayYmdInAppTz(), prefixMap }))`.
  - Buttons: Hire / Keep trying (only when the nudge asks and the card is not deferred) / Talked today (`canEditTrialCard`) / Pass.
  - Owned state: `trialTallies`.
  - Handlers: `endTryOut` 1180–1204 (RPC `end_team_prospect_trial`; Hire switches the stage to `hire`), `keepTrying` 1211–1225 (stamps `trial_deferred_at`/`_by`).
  - Entry point is `startTryOut`: `tryOutBlocker` check → `confirmDialog` → `create-user` edge function `{ trial_prospect_id }` → stage `tryout`.
- **Hire** (1917–2043): onboarding tracker plus "Add to roster".
  - Owned state: `onboardingItems`, `onboardingStatuses` (a Map keyed `` `${prospectId}:${itemId}` ``; a missing key means pending), `onboardingSettingsOpen`, `newItemLabel`, `newItemLink`, `itemDrafts`.
  - Handlers: `cycleOnboardingStatus` 1302–1316 (optimistic upsert, `ONBOARDING_STATUS_META` 120–124), `addOnboardingItem` 1318–1335, `saveOnboardingItem` 1337–1356, `moveOnboardingItem` 1358–1373 (index-based two-row position swap), `deleteOnboardingItem` 1375–1385.
  - Settings modal 2276–2368. The roster hand-off (`hireTarget`, `hireKind`; `openRosterHandoff` 1232–1236 pre-selects `suggestRosterKind(roleName)`; `addHireToRoster` 1280–1299; modal 2228–2274) is opened from `setStatus('hired')` too, so it **stays at TPT level**.
  - The onboarding legend renders only when items exist or `isDev`. The ⚙ Onboarding settings button and the "no items yet" pointer are dev-only.
- **Review** (2044–2051): `<TeamReviewSection authUserId isDev initialRateUserId={rateUserIdFromUrl} onOpenScreenBoard={() => setStage('screen')} />`. Done.
- **Cross-stage modals:** Add 2103–2128 (`addOpen`/`addDraft`); Edit 2130–2177 (`editTarget`/`editDraft`/`confirmingDelete`; delete gated by `powers.canDelete`, opened from Screen cards, Try-out, Hire rows and the Passed bucket); My review; Hire-to-roster; Onboarding settings; Share (`ShareColumnDialog` 2369–2380).

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

## Page-level modals

| Modal | Anchor | State | Opened from | Verdict |
|---|---|---|---|---|
| Edit Prospect | 3304–3442 | `editModalOpen`, `editingProspect` (null ⇒ edits `currentProspect`), `edit*` ×6, `openEditModal` 1428–1438 / `openEditModalForProspect` 1440–1449, `handleDeleteProspect` 1451–1478, `saveEdit` 1480–1514; warmth ± (`handleWarmthDelta` 1403–1414 / `handleWarmthReset` 1416–1426) at 3409–3421, shown only when editing the current prospect | Follow Up "Edit prospect" AND Prospect List row actions | **Stays in parent** (2 tabs) |
| New Prospect | 3856–3959 | `newProspectModalOpen`, `new*` ×6, `newProspectError`, `saveNewProspect` 1887–1923 (`getEffectiveMasterId`, reloads both caches) | Tab-row "New Prospect" button (2059–2076, `canAccessFollowUp`) + `?newProspect=true` | **Stays in parent** (tab row + URL) |
| Callback | 3445–3519 | `callbackModalOpen`, `callbackDate`/`callbackTime`/`callbackNote`, `saveCallback` | Follow Up only | Moves with Follow Up |
| Copy template edit | 3522–3655 | `editingCopyTemplateKey`, `editingCopyText`, `editingCopySubject`, `copyTemplateSaving`, placeholder chips via `copyTemplateTextareaRef` | Follow Up only | Moves with Follow Up |
| Copy blank fields | 3658–3700 | `copyBlankFieldsModalOpen`, `copyBlankFieldsList` | Follow Up only | Moves with Follow Up |
| Timer history | 3703–3774 | `timerHistoryModalOpen`, `timerEvents`, `timerEventsLoading` | Follow Up `this call` timer | Moves with Follow Up |
| My time | 3777–3853 | `myTimeModalOpen`, `myTimeStats`, `myTimeStatsLoading` (+ live `followUpTimerSeconds` bonus when `activeTab === 'follow-up'`) | Follow Up footer | Moves with Follow Up |

## URL / navigation router (parent, permanent)

- **`?tab=`** effect 418–465 waits for `authLoading` **and** `hiringSharesLoading`, because the per-user grants arrive with the role.
  - `team` requires `canOpenHiring`; otherwise it rewrites to `follow-up` (`replace: true`).
  - `activity` requires `canAccessActivityTab`; otherwise it rewrites.
  - A missing tab resolves through [`resolveProspectsLanding`](../src/lib/prospects/prospectsLanding.ts) (v2.2910 / J25-F1) and is written into the URL.
  - `setTab` / `openTeamTab` remember the clicked top tab in localStorage (`prospects:lastTopTab`); URL-driven landings never write it. Both also set `?tab=` and delete `prospect_id`.
- **`?prospect_id=`:**
  - read by `loadFollowUpProspects` (fetch-and-prepend when missing), the index-sync effect 1000–1006, and the Prospect List effect 779–797 (which opens the right section, then strips the param)
  - written by `updateUrlProspectId` on every advance/removal/queue jump, and by `selectProspectForList`
  - inbound from Calendar (follow-up) and Quickfill Can't reach (prospect-list)
- **`?newProspect=true`** (Dashboard quick-add, `Dashboard.tsx` 1084): effect 468–478 opens the New Prospect modal and strips the param.
- **`?stage=` / `?rate=`** (from the Dashboard pinned row, Quickfill Needs You and the Person desk, e.g. `/prospects?tab=team&stage=review&rate=<id>`): handled **inside** TeamProspectsTab (effect 811–823). It passes through `coerceStage(wanted, shared)`, so a share holder's `hire`/`review` is ignored. It is applied once, then stripped.

All of this stays in the parent (playbook rule), except `?stage=`/`?rate=`, which already live in the extracted component.

## Test coverage by region

Neither file has an e2e spec (no `e2e/*` opens `/prospects`). `Prospects.tsx` has **no render test**. TeamProspectsTab has [`TeamProspectsTab.render.test.tsx`](../src/components/prospects/TeamProspectsTab.render.test.tsx) with 5 cases: Try-out ×3, column share ×1, share-holder board ×1. There is **no money math on this surface**. The untested arithmetic is time (⚠ timer-second sums and my-time windows) and the copy-template rules (⚠, real business rules with zero tests).

| Region | Tested kernels (`it` blocks) | Render test | Untested inline logic |
|---|---|---|---|
| Shell / router | `prospectsLanding` (4), `prospectConversion` (14, incl. `canAccessProspectPipeline`) | — | `?tab` rewrite effect 418–465 |
| Follow Up | `callingOrder` (8), `callingLock` (10), `callLogState` (7), `prospectConversion` (14), `phoneContact` (5) | — | ⚠ copy-template substitution / blank-field rules 194–262; formatters 138–192; ⚠ my-time windows 602–643 and ledger sum 1037–1047; queue window 1347; `writeCallOutcome` insert-then-delete |
| Prospect List | `prospectListGrouping` (13), `callLogState` (7) | — | `handleSendBack` comparator 1672–1677; ⚠ ledger-map reduce 1057–1071; last-call map build 663–667 |
| Convert | `convertProspectSearch` (8), `prospectConversion` (14) | — | `handleConvertSubmit` insert chain 1925–1981 |
| Activity | `prospectTeamActivity` (4), `prospectWeekReport` (9); `prospectTeamActivityChartData` (2) is Quickfill's and not imported here (reuse target below) | — | 30-day date-key loop 3253–3262 |
| New Prospect | `companyOwner` (4) | — | — |
| TPT Screen | `teamProspectRanking` (23), `teamProspectSourceSummary` (16, incl. an `it.each` matrix), `candidateHygiene` (8), `columnShares` (7), `sharedHiringTab` (4) | share chip + column menu; share-holder trimmed board | `parseCandidateLinks`/`serializeCandidateLinks`; `mergeDuplicate` merge rules 1093–1119; `handleDragEnd` wiring |
| TPT Interview | — | — | review draft ↔ row mapping (1239–1248) |
| TPT Try-out | `helperTrial` (6), `trialTally` (12) | 3 cases (helper-column gating, trial card dated by the company calendar, tally + nudge + Keep trying) | — |
| TPT Hire | `hireRosterKinds` (7) | — | `moveOnboardingItem` swap 1358–1373 |
| TPT Review (`TeamReviewSection`) | `teamMemberReviews` (21), `reviewerCalibration` (9), `teamComposite` (9), `teamLeaderboard` (4), `teamReviewDue` (12) | — | outside covers |

## Stage-A pure-logic inventory

Extract to `src/lib/*` + colocated tests **before** any component moves. Since the July map, most calc has already landed in tested kernels (last row). What remains:

| Candidate | Currently | Target |
|---|---|---|
| `substituteCopyPlaceholders` 237–262, `getBlankPlaceholderFields` 194–220, `getBlankFieldsForMail` 222–235 + `COPY_TEMPLATE_KEYS`/`COPY_TEMPLATE_LABELS`/`APP_SETTINGS_KEYS`/`APP_SUBJECT_SETTINGS_KEYS` 57–76; the override-fallback rule in `getResolvedCopyText`/`Subject` 828–838 | module-level / inline, **untested** | `lib/prospects/prospectCopyTemplates.ts` + tests: placeholder substitution, `_______` per-template behavior, blank-field detection incl. the `forMail` prospect-email rule, `null`-or-`''` → default |
| `formatDateTime`, `formatDueBadge`, `formatInteractionType`, `formatTimerButtonName`, `formatTimerSeconds`, `formatWebsiteDisplay`, `getWebsiteHref` (138–192); TPT `formatLastContact` 334–340 | module-level, untested | `lib/prospects/prospectFormat.ts` + tests (`formatDaysSince` no longer exists in Prospects.tsx; Quickfill's `CantReachSection.tsx` keeps its own) |
| `loadMyTimeStats` windows 602–628, `loadMyTimeToday` 630–643, ledger sums 1037–1047 / 1057–1071 | inline reduces + inline local-midnight `Date` math | pure `sumTimerSeconds(rows)` / `sumTimerSecondsByProspect(rows)` / `myTimeWindows(now)` + tests |
| `handleSendBack` re-insert comparator 1672–1677; queue window `start` in `renderQueueRows` 1347 | inline | fold into `callingOrder.ts` + tests (preserve the coldest-order insert) |
| last-call map build 663–667 (first row per prospect of the newest-first call rows) | inline in `loadProspectListProspects` | `lastCallByProspect(rows)` in `callLogState.ts` |
| Activity 30-day date-key loop 3253–3262 | inline IIFE | reuse [`getOrderedDateKeysLast30Days`](../src/lib/prospectTeamActivityChartData.ts). It returns oldest → newest while the tab renders newest first, so reverse it; do not re-extract |
| `parseCandidateLinks` / `serializeCandidateLinks` 159–179 + `mergeDuplicate`'s merge rules 1093–1103 (link dedupe by URL, notes concatenated when they differ) and review re-point filter 1115–1117 | module-level / inline, untested | `lib/prospects/candidateLinks.ts` (+ `mergeCandidateFields`) + tests |
| **Already in lib with tests** | `prospectListGrouping` (v2.2453), `convertProspectSearch` (v2.2454), `prospectWeekReport` (v2.2456), `callingOrder` (v2.2301), `callLogState`, `callingLock` (v2.2850), `prospectConversion` (v2.2879), `prospectsLanding` (v2.2910), `prospectTeamActivity`, `candidateHygiene` (v2.2459), `helperTrial` (v2.3627), `hireRosterKinds`, `hiring/trialTally` (v2.3715), `hiring/columnShares` + `hiring/sharedHiringTab` (v2.3802/v2.3805), `teamProspectRanking`, `teamProspectSourceSummary`, review kernels | — (reference implementations) |

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **Stale type casts.** Prospects.tsx has `(supabase as any)` on `prospect_timer_events` ×10 (580, 615–618, 635, 1039, 1059, 1119, 1546) and `'service_types' as any` (969). TPT has `'team_prospect_trial_tally' as never` (860) and `keepTrying`'s update `as never` (1216), plus jsonb `links` written `as unknown as string` (1017, 1052, 1106). Those tables, the RPC and the `trial_deferred_*` columns are all in generated `database.ts` now, so the casts are removable. Do that in a separate types pass, never during a move.
2. **Calling locks are advisory, taken on intent, and expire** (v2.2850).
   - Triggers: `dial` (2164), `composer` (2295), `outcome` (1756/1777), `callback` (1517). Converted ✓ takes no lock.
   - A colleague's row younger than `CALLING_LOCK_TTL_MS` (30 min) is never overwritten; an older row is taken over.
   - `loadFollowUpProspects` hides only live rows held by *others* at load time.
   - Release (1186–1197) deletes only the row this tab wrote (`lockTakenForRef`). `handleNoLongerFit`, `handleCantReach`, `handleConverted` and `handleNextProspect` also delete the caller's own row; Didn't Answer and Answered do not.
   - There is no purge job; staleness is a read-side rule.
3. **`?prospect_id` fetch-and-prepend** (545–555) deliberately shows a prospect even when it is `not_a_fit`/`cant_reach`/`converted` or locked, because Prospect List, Calendar and Quickfill must be able to open anything.
4. **Queue filter is split.** The server excludes only `not_a_fit`; the client drops `cant_reach` + `converted` (536). The order comes from `callingOrderModeRef.current`, a ref rather than state, so the loader is not recreated when the mode changes.
5. **The queue reloads on every URL change.** Effect 765–770 depends on `searchParams`, so each `updateUrlProspectId` (every advance, removal and queue jump) re-runs `loadFollowUpProspects` + `loadMyTimeToday`, and the index-sync effect 1000–1006 re-points. In never-called-first mode, a prospect just called moves into the called block on that reload. Keep the dependency.
6. **Timer semantics.**
   - `followUpTimerSeconds` resets on tab re-visibility and on every advance.
   - A `prospect_timer_events` row is written only by `saveTimerEvent` for `no_longer_fit` / `next_prospect` / `cant_reach` / `converted`. Converted's closes over the click-time render values.
   - `handleDidntAnswer`'s auto-advance calls `handleNextProspect(true)`: **no timer event, no lock delete, no `loadMyTimeToday`** on that path. The release effect still frees the lock.
7. **Live "session bonus":** `my day`, "Time on this prospect" and the My time modal add the running `followUpTimerSeconds` to DB sums (the modal only when `activeTab === 'follow-up'`). Yesterday intentionally gets no bonus.
8. **Last Contact and warmth.**
   - The card prefers `comments[0]?.created_at` over `prospects.last_contact`.
   - `handleAnswered`/`handleDidntAnswer`/`handleAddComment` bump `last_contact` to now after inserting.
   - Answered also sets warmth +1 (v2.2458). The warmth pill on the card is read-only; ± lives only in the Edit modal and only for the current prospect. `handleWarmthDelta`/`Reset` patch the Follow Up cache only.
9. **Call-outcome retag** (`writeCallOutcome` 1722–1744). Applies when the composer is empty and the newest comment is the caller's own `user_comment` within `RETAG_NOTE_WINDOW_MS` (10 min). The outcome row takes the note's text and original `created_at`, and **then** the note is deleted: insert-then-delete, because `prospect_comments` has no UPDATE policy. A failed delete toasts but keeps the call.
10. **Single-cache patches are safe only because the list reloads on every tab entry** (effect 772–776). `handleNoLongerFit`, `handleDidntAnswer` and `handleAddComment` leave `prospectListProspects` stale until then.
11. **Copy-template override fallback:** an override that is `null` **or** `''` falls back to the app_settings default. The save upsert writes `subject_text: editingCopySubject || null`.
12. **`handleOpenMail` fires the mailto first**, then upserts `prospect_email_sent`. The envelope-check icon is per user + prospect + template.
13. **One global `saving` flag** across all Customers-tab mutations; TeamProspectsTab has its own `busy`, and Convert has `convertSaving`. Keep each scope intact.
14. **Edit modal dual identity:** `editingProspect === null` means "editing `currentProspect`" (Follow Up); a set value means "editing this list row" (Prospect List). `handleDeleteProspect` handles both and re-points the Follow Up index.
15. **Sort orders differ on purpose.** Prospect List groups by pipeline stage and recency. The Follow Up queue is coldest-first (`last_contact` asc, nulls first) or never-called-first. `handleSendBack` re-inserts in coldest order regardless of `callingOrderMode`.
16. **Convert marks the prospect only through `markProspectConverted`** (status → `converted` + a `converted` comment naming `/customers/<id>`). Add customer and Follow Up use the same kernel; never re-inline it. Convert does not delete the prospect. The submit button lives outside `NewCustomerForm` via `form="convert-customer-form"`, and new bids hard-code `materials_model: 'rough'`.
17. **Owner stamping.** `getEffectiveMasterId` → `resolveCompanyOwnerUserId` (v2.2972) stamps prospects, roles and candidates with the company owner. `addHireToRoster` alone uses the raw `authUserId` as `people.master_user_id`. Preserve the inconsistency.
18. **TeamProspectsTab drag rules.**
    - `boardCollisionDetection` order matters (it fixes a source-column bias).
    - `PointerSensor` activation distance is 8.
    - `hired` / `passed` / `trial` rows are drag-inert (952).
    - Rank updates are optimistic, with a full `load()` revert on any failure.
    - Edit-modal role changes append to the bottom of the target column via `nextTeamProspectRank`.
19. **Role deletion** requires `referencedCountByRole === 0` counting **all** statuses. The DB backs this with `ON DELETE RESTRICT`, and code `23503` gets a friendly message.
20. **Additive loads swallow errors:** reviews, onboarding, the trial tally (`.then(r => r, () => …)`), shares, and `useMyHiringShares` all read as empty while migrations roll out.
21. **`mergeDuplicate` is not transactional.** It updates the keeper, then re-points reviews one UPDATE at a time with errors ignored (1116–1119), then deletes the duplicate. A reviewer who already reviewed the keeper keeps that review.
22. **The shared board only hides controls.** `hiringTabPowers(shared)` trims the UI; the database refuses everything outside the share (`20260924040000`). Handlers such as `setStatus` do not re-check powers.
23. **One-shot deep links:** `?stage=`/`?rate=`, `?newProspect=true` and the Prospect List `?prospect_id` are each applied once, then stripped, so later tab-hopping does not snap back.
24. **Activity hides a day entirely** when every user's Marked and Updated are 0. Date labels render via `new Date(dk + 'T12:00:00')` (a noon guard against timezone off-by-one), and all week and day boundaries are browser-local.
25. **`commentInputRef` is a state, not a ref.** The auto-resize effect depends on it re-running when the node mounts.
26. **Dialogs are context dialogs:** `handleAddQuickNote` uses `promptDialog`, and the two prospect deletes (1455, 1699), merge, Try out and the Try-out card's Pass (`endTryOut`) use `confirmDialog`. TPT's candidate and column deletes confirm inline instead (`confirmingDelete`, `confirmDeleteRoleId`), and Pass on a Screen or Interview card (`setStatus('passed')`) has no confirm. Keep them as they are; no modal redesign during the move.

## Recommended extraction order (value ÷ risk)

1. **TPT module components → own files.** Covers `EmailText`, `CandidateLinkChips`, `CandidateRatingBars`, `TrialTallyBlock`, `CandidateFields`, `SortableCandidateCard`, `RoleColumn` and the style/dnd helpers (186–779, ≈594 lines). They take pure props and share no state (no supabase, no context hooks), and the hottest file (31 commits in 90 d) sheds a quarter of its length. The component body also uses `smallButtonStyle` (20×), `inputStyle`, `labelSpanStyle`, `boardCollisionDetection` and `formatLastContact`, so those are exported and imported back. Ship it with the `candidateLinks.ts` Stage A, since the card (618), the Interview column (1780), `openEdit` (1495) and `mergeDuplicate` parse links and both candidate saves (1017 / 1052) serialize them.
2. **Stage A in Prospects.tsx:** `prospectCopyTemplates.ts` (business rules, zero tests), `prospectFormat.ts`, and the timer sums. Each is independently shippable.
3. **`activity` → `ProspectsActivityTab`:** 5 states, 2 callbacks, 2 effects, 139 lines, no shared writes. Validates the seam.
4. **`convert` → `ProspectsConvertTab`:** 8 states, 3 effects, 262 lines. Props: `pool`, `lastCallMap`, `authUserId`, `authRole`, `onConverted`. The 772–776 loader effect stays in the parent.
5. **Follow Up hook seams (no JSX move).** `useCallingLock` takes refs 296–297, `lockHeldBy`, release effect 1186–1197 and `takeCallingLock` 1205–1240; its kernel is already tested. `useProspectCopyTemplates` takes the 13 copy states, `copyTemplateTextareaRef`, loaders 673–740 / 1018–1027, effect 1029–1035, the copy / phone / `authUserName` part of the per-user effect 752–763 (its `loadQuickNotes` call stays) and handlers 828–928. Together they pull 14 of the 39 states and 3 of the 5 refs out before the big move.
6. **Data seam `useProspectsData`:** the caches, pointer, `calledProspectIds`, `prospectLastCallMap`, both loaders (+ `callingOrderModeRef`), `updateUrlProspectId`, `markCalledLocally`, `saving`, and the tandem-patch helpers. The parent destructures it; nothing downstream changes.
7. **`prospect-list` → `ProspectsListTab`:** consumes the seam. The Edit Prospect modal and `selectProspectForList` navigation stay as parent-owned callbacks.
8. **`follow-up` → `ProspectsFollowUpTab`:** lift `FollowUpQueue` (`renderQueueRows` + `renderCallingOrderToggle`) first. Then move the remaining owned states, the per-prospect effects and the 5 tab-local modals. Controlled selection and the Edit Prospect modal stay in the parent.
9. **TeamProspectsTab stages** (independent track; can interleave from step 1): `TeamHireStage` → `TeamTryoutStage` → `TeamInterviewStage` → optionally `TeamScreenBoard`, plus the share-editor hook. `rows`/`roles`/`load`/`busy`/`modalError`/`setStatus`/`openEdit`/`markContacted`/`startTryOut` and the roster hand-off stay in TeamProspectsTab.

**What must stay in `Prospects.tsx` permanently:**
- the `?tab=` / `?prospect_id=` / `?newProspect=` router and the access-gate rewrites
- `topTab`/`activeTab` and the tab-button rows
- the selection pointer and the dual caches (via the seam hook)
- `saving`
- the Edit Prospect and New Prospect modals
- `getEffectiveMasterId`
- `useMyHiringShares` and the `canAccessFollowUp` / `canAccessActivityTab` / `canOpenHiring` gates

Definition of done per tab, verification gates (`npm run typecheck && npm run lint && npm test` after every step), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). Behavior-preserving only.
