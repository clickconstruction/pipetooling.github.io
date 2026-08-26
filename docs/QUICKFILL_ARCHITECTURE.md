# Quickfill Architecture Map

---
file: docs/QUICKFILL_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the Quickfill billing-workflow surface (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what src/pages/Quickfill.tsx and src/components/quickfill/QuickfillScheduleSection.tsx own (state, handlers, supabase tables/RPCs, realtime, sub-components, coupling) so future extractions need no re-derivation. Sections: What this surface is; How to read a dossier; Master summary table; Quickfill.tsx region dossiers; QuickfillScheduleSection region dossiers; Shared substrate; Stage-A pure-logic inventory; Preserve-quirks list; Recommended extraction order; What stays in the parent.
audience: Developers, AI Agents
last_updated: 2026-08-03
---

## What this surface is

Quickfill is the office billing-workflow checklist page: a single vertical page of ~24 collapsible **sections** (not tabs), each an operational review station ("Billed Awaiting Payment", "Jobs Billing", "Schedule", "Email Inbox", …) with an org-wide "Mark … up to date!" freshness system. Two files are in scope:

| File | Lines (2026-07-29) | Churn | Role |
|---|---|---|---|
| [`src/pages/Quickfill.tsx`](../src/pages/Quickfill.tsx) | 2,039 | 18 | Page shell: section registry, mark/collapse system, dev layout panel, jump grid + dock + search, the `QuickfillSectionWrapper` chrome, and the big per-section wiring switch |
| [`src/components/quickfill/QuickfillScheduleSection.tsx`](../src/components/quickfill/QuickfillScheduleSection.tsx) | 1,737 | 13 | One section's body that outgrew the pattern: a full day-schedule editor (roster timelines, dot-drag editing, travel hints, add-block, reorder) **hosted by three surfaces** |

**Key structural fact — this is NOT a Bids/Materials-style God page.** Every section body except `warnings` is already an extracted component in `src/components/quickfill/*` (18 section components) plus shared ones (`DispatchInboxSection`, `HoursSection`, `SectionDock`), and per-section data hooks already exist (`useDispatchInbox`, `useQuickfillCantReachProspects`, `useQuickfillCompleteNoBillJobs`, `useQuickfillStagesJobsWithoutCustomer`, `useUnpricedFixturesCount`, `useArBankUnallocatedCount`, `useStaleTallyStaffFollowUp`, `useQuickfillNoncardAttribution`). What remains in `Quickfill.tsx` is the **section framework itself**. The decomposition targets are therefore: (a) the framework's own clusters (mark system, layout settings, wrapper chrome, dev panel), and (b) a **sub-decomposition of `QuickfillScheduleSection`**, which is the real 1,737-line monolith here.

There is **no URL deep-link router on this page** — no `?section=` / `?id=` handling at all; jump navigation is `scrollIntoView` on DOM ids (`quickfill-<sectionId>`). That removes the usual "router stays in parent" constraint but also means no shared record pointer exists (see [Shared substrate](#shared-substrate)).

Recent churn (grep of `RECENT_FEATURES.md`, ~49 mentions): v2.1061 (schedule-adjacent), v2.1003 (page width containment fix — the comment survives at the page root div), v2.980–v2.990 cluster, v2.972, v2.939, v2.932 (self-healing geocodes inside the schedule section), v2.916, v2.877–v2.879. Both files are HIGH-churn; extractions should be small and frequent.

## How to read a dossier

Line numbers are "as of 2026-07-29" and rot — always search the named symbol. Each dossier lists: render location, **owned local state** (moves with an extraction), **cross-section/shared state** (stays in the parent), derived memos, handlers, supabase tables/RPCs/realtime, sub-components (extracted vs inline), external coupling, and extraction status + risk + approach.

---

## Master summary table

### `Quickfill.tsx` regions

| Region | Anchor | Lines est. | Coupling | Risk | Status |
|---|---|---|---|---|---|
| Module-level pure helpers | `parseHiddenSectionIdsFromValueText` … `formatHeaderLastMarked` (~102–251) | ~150 | none (pure) | low | inline — **Stage A first** |
| Layout settings engine | `persistHiddenSectionIds` + load effect (~483–618) | ~140 | med (order/hidden/banners feed everything) | low | inline — hook seam |
| Mark/collapse system | `loadSectionMarks`, `markSectionUpToDate`, `isCollapsed`, `openSectionNow` (~762–839) | ~120 | **highest** — every section wrapper + jump grid + dock | med | inline — hook seam |
| Eligibility + search + order | `sectionWouldRenderOnPage`, `searchedSections` (~623–719) | ~100 | high (reads 5 hooks' fetchEnabled/loading) | med | stays in parent |
| Per-section wiring switch | `quickfillSectionBlock` (~841–1468) | ~630 | high (marks + hooks + modal setters) | low value | stays (already thin per case) |
| Warnings section body | `case 'warnings'` (~846–895) | ~55 | low | low | inline — extract `QuickfillWarningsSection` |
| Dispatch-inbox wiring | `case 'dispatch-inbox'` (~1231–1286) | ~60 | med (`useDispatchInbox` 15-prop thread, trip-charge + dismissed modals) | low | wiring stays; hook already extracted |
| Jump grid + search + dock render | return JSX (~1474–1727) | ~180 | med (marks, searchedSections) | low | stays (page chrome) |
| Dev layout panel | `QuickfillDevSectionSortableRow` (~276–398) + panel JSX (~1648–1705) | ~185 | med (order/hidden/banner state + persistence) | low | inline — extract `QuickfillDevSectionsPanel` |
| `QuickfillSectionWrapper` + history icon | module components (~1730–2039) | ~310 | low (props + metrics context only) | **lowest** | in-file — **move verbatim first** |
| Page-level modals | `QuickfillSectionMarkHistoryModal`, `DispatchDismissedItemsModal`, `CreateTripChargeModal` (~1706–1725) | ~20 | — | — | already extracted components; wiring stays |

### `QuickfillScheduleSection.tsx` regions

| Region | Anchor | Lines est. | Coupling | Risk | Status |
|---|---|---|---|---|---|
| Day data engine | `loadData` + realtime channel (~728–1206) | ~200 | **highest** — every other region reads its caches | med | inline — **`useQuickfillScheduleDay` seam** |
| Dot-drag autosave | `dotDraft`…`handleSharedDotSeparate` (~161–178, 873–1060) | ~220 | high (blocks cache, `onBlocksSaved`, unmount flush) | **high** | inline — hook after seam |
| Travel hints + geocode self-heal | `jobCoordsByJobId`…`travelUiForUser` (~235–460) | ~230 | med (reads `blocksByUserId` only) | low-med | inline — extract `useDayTravelHints` |
| Add-block + job picker cluster | `cellAddContext`…`saveQuickfillBlockModal` (~469–691, 1130–1164) | ~280 | med (blocks/sessions/jobs caches) | med | inline — extract after seam |
| Reorder-day | `reorderUserId`, `saveReorderedDay` (~474–476, 1062–1128) | ~75 | med (writes linked legs across users) | med | inline — logic already in lib |
| Day rail window + settings modal | `dayRailWindow`…`saveDaySettings` (~180–233) + modal JSX (~1585–1713) | ~190 | **lowest** (localStorage only) | low | inline — **extract first** |
| Roster filters + grouping | `sortedUsers`…`scheduleUsersByRoleSection` (~487–519, 716–726) | ~60 | low | low | inline — Stage A memos |
| My Time editor + NCNS | `scheduleMyTimeEditor`, `handleScheduleMarkNotComingIn` (~147–150, 1166–1186, 1714–1734) | ~60 | low | low | inline — small |
| Render (day nav, rail header, rows) | `dayNavRow` + return (~1208–1584) | ~330 | med | — | stays as the component core |

---

## `Quickfill.tsx` region dossiers

### Section registry + module constants

- **Location:** top of file. `SECTIONS` (25 entries `{ id: 'quickfill-<sectionId>', sectionId, label }`), `DEFAULT_SECTION_ORDER_IDS`, `VALID_SECTION_IDS`, `SECTION_LABEL_BY_SECTION_ID`; app_settings keys `APP_SETTINGS_KEY_QUICKFILL_HIDDEN` (`quickfill_hidden_section_ids`), `APP_SETTINGS_KEY_QUICKFILL_MIN_HCP` (`quickfill_jobs_billing_min_hcp`), `APP_SETTINGS_KEY_QUICKFILL_SECTION_ORDER` (`quickfill_section_order`), `APP_SETTINGS_KEY_QUICKFILL_SECTION_BANNERS` (`quickfill_section_banners`); `QUICKFILL_SECTION_BANNER_MAX_CHARS = 800`, `SCHEDULE_SECTION_DEFAULT_BANNER`, `TOMORROW_SCHEDULE_SECTION_DEFAULT_BANNER`, `DEFAULT_JOBS_BILLING_MIN_HCP = 406`, `MARK_EVENT_NOTE_MAX_CHARS = 10_000`, `BUTTON_BG`/`BUTTON_BORDER` palettes, `QUICKFILL_SECTION_TITLE_STYLE`.
- **Extraction note:** the registry is the page's spine — it stays. The constants move with whichever lib module claims them (see Stage A).
- **Later-added sections (v2.2145):** `SECTION_INSERT_AFTER` anchors a new id beside its default neighbor when an org already saved an order (Jobs Cleanup after Missing job info). `QuickfillJobsCleanupSection` is the first section body that hosts a component shared with another page (`PipelineMoneyOpportunities`, fed by `usePipelineMoneyOpportunities`); its actions navigate via `?stagesMove=`.
- **`undated-bills` "Missing bill dates" (v2.2326):** anchored after `complete-no-bill`; self-contained body (`QuickfillUndatedBillsSection`) owning its RPC load (`get_undated_bill_worklist`), its metric report, and inline bill-date saves via the shared `InlineBillDateEditor` (`src/components/jobs/`); kernel `lib/quickfillUndatedBills.ts`.

### Module-level pure helpers (Stage-A sweep target)

All pure, zero React, currently untested in-file:

- `parseHiddenSectionIdsFromValueText(raw)` — JSON parse + validate against `VALID_SECTION_IDS`.
- `normalizeQuickfillSectionOrderFromValueText(raw)` — merge saved order with canonical `SECTIONS`, appending missing ids in default order (drift-tolerant).
- `parseQuickfillSectionBannersFromValueText(raw)` — validated record, trims + caps at 800 chars.
- `capQuickfillBannerText(s)`.
- `effectiveQuickfillSectionBanner(sectionId, banners)` — custom banner else the hardcoded defaults for `schedule` / `tomorrow-schedule`, else null.
- `getButtonColor(markedAt)` — freshness palette: red >30h, yellow >12h, green ≤12h, red when never marked.
- `formatRelativeTime(iso)`, `formatTime(iso)`, `hoursUntilExpand(markedAt)` (ceil-to-tenth hours until the 12h auto-expand), `formatHeaderLastMarked(iso)` (uses `APP_CALENDAR_TZ`).

Precedent already exists: `markStampInitial`/`markStampTime` live in [`src/lib/quickfillMarkStamp.ts`](../src/lib/quickfillMarkStamp.ts) (+test) and `matchesQuickfillSectionSearch` in [`src/lib/quickfillSectionSearch.ts`](../src/lib/quickfillSectionSearch.ts) (+test) — these ten helpers are the same shape and should join them.

### Layout settings engine (app_settings)

- **Owned state:** `hiddenSectionIds` (Set), `jobsBillingMinHcp` (number), `sectionOrderIds` (string[]), `sectionBanners` (Record), `sectionBannerDrafts` (Record; uncommitted input text), `activeSectionsPanelOpen`.
- **Handlers:** `persistHiddenSectionIds`, `persistJobsBillingMinHcp`, `persistSectionOrder`, `persistSectionBanners` (all `useCallback`, all `app_settings.upsert` with `onConflict: 'key'` via `withSupabaseRetry`); `devSetSectionVisible` (local toggle; persists only when `role === 'dev'`, via `queueMicrotask`); `onBannerDraftChange` / `onBannerCommit` (commit caps + deletes empty keys + persists); `onQuickfillSectionDragEnd` (dnd-kit `arrayMove`, dev-gated, persists via `queueMicrotask`); `isSectionVisible`.
- **Effects:** one mount effect loads all four keys in a single `app_settings.select('key, value_text, value_num').in('key', […])` and fans out through the parse helpers. **No realtime** — a comment block records that `app_settings` is not in the `supabase_realtime` publication and the previous `postgres_changes` listener was a dead no-op (removed in the v2.560 realtime cleanup). Keep it removed.
- **Supabase tables:** `app_settings` (SELECT + UPSERT ×4 keys). Org-wide settings — the dev panel edits affect **everyone**.
- **Extraction:** low risk. Seam: `useQuickfillLayoutSettings()` returning `{ hiddenSectionIds, sectionOrderIds, sectionBanners, sectionBannerDrafts, jobsBillingMinHcp, … setters/persisters }`. The parse helpers go to lib first (Stage A).

### Mark / collapse system (the page's core mechanic)

- **Owned state:** `sectionMarks` (`Record<string, { marked_at, marked_by?, marked_by_name? }>`), `forceExpandedSections` (Set, **initialized to `new Set(['cant-reach'])`**), `dockHiddenThisVisit` (Set — session-only, deliberately NOT derived from persisted marks; chips must return on reload), `markHistoryModal` (`{ sectionId, label } | null`), `warningsModalOpen` (warnings-only sub-modal).
- **Handlers:** `loadSectionMarks()` — `quickfill_section_marks.select('section_id, marked_at, marked_by, users!quickfill_section_marks_marked_by_fkey(name)')`; `markSectionUpToDate(sectionId, options?: { noteText? })` — captures `outstanding_count` from `getOutstandingCount(sectionId)` (metrics context) at mark time, trims/caps note at `MARK_EVENT_NOTE_MAX_CHARS`, UPSERTs `quickfill_section_marks` (`onConflict: 'section_id'`; silent return on error), clears force-expand, adds to `dockHiddenThisVisit`, reloads marks, then INSERTs a `quickfill_section_mark_events` history row (failure tolerated with a warning toast); `openSectionNow(sectionId)` — re-expand + restore dock chip; `isCollapsed(sectionId)` — marked <12h ago.
- **Supabase tables:** `quickfill_section_marks` (SELECT w/ `users` FK join, UPSERT), `quickfill_section_mark_events` (INSERT). History reads live inside the extracted `QuickfillSectionMarkHistoryModal`.
- **Coupling:** consumed by every `QuickfillSectionWrapper` call in the switch, the jump-grid chips, the dock filter, and by four child sections that render their **own** mark buttons (`QuickfillEmailInboxSection` ×3 variants, `QuickfillTextsSection`, `QuickfillPhysicalInboxSection`) via `onConfirmMark={(note) => markSectionUpToDate(id, { noteText: note })}` + a `markButtonPalette` computed from `getButtonColor`.
- **Extraction:** the seam is `useQuickfillSectionMarks()` returning `{ sectionMarks, markSectionUpToDate, openSectionNow, isCollapsed, forceExpandedSections, dockHiddenThisVisit }`. It must keep taking `getOutstandingCount` from `QuickfillSectionMetricsContext` (already an extracted context — see substrate). Medium risk purely from fan-out; the logic itself is simple.

### Eligibility + search + ordered render list

- **Derived:** `warningsSectionEligible` (dev / master_technician / assistant-like), `canAccessProspects` (dev/master_technician/assistant/controller, or estimator with `estimatorProspectsAccess`), `sectionWouldRenderOnPage(sectionId)` (**role/feature-only, never count-gated — documented exception: `cant-reach` IS count-gated**; `schedule`/`tomorrow-schedule` gate on `CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES` imported under the alias `CAN_USE_SCHEDULE_DISPATCH_FOR_QUICKFILL_SCHEDULE`), `orderedSections` (registry reordered by `sectionOrderIds`), `hasAnyVisibleSection`, `sectionPassesSearch` (via `matchesQuickfillSectionSearch` lib), `searchedSections` (eligibility ∩ search — drives blocks, first-divider, dock; **the jump grid stays unfiltered by search**), `noSectionsMatchSearch`, `firstVisibleSectionId` (top-divider logic), `dockSections`.
- **Owned state:** `sectionSearch`.
- **Stays in parent** — this is the page's routing-equivalent. It reads `fetchEnabled`/`loading` off five section hooks, so those hooks must keep living at page level even after their sections' bodies are (already) extracted.

### Per-section wiring switch — `quickfillSectionBlock(meta)`

~630 lines, 24 `case`s, each returning `<QuickfillSectionWrapper …>` around an already-extracted body component. Per-case variations worth preserving verbatim:

- `my-inbox`: per-user section — no mark/collapse/history/stamp (`omitDefaultMarkButton`, `showOutstandingInHeader={false}`, `showMarkHistoryButton={false}`, `showLastMarked={false}`, no-op handlers); neutral jump chip.
- `noncard-attribution` (v2.1318, **moved to `/moneyfill` in v2.1378**): "Bank transfers needing attribution" no longer renders on Quickfill — the section body (`QuickfillNoncardAttributionSection`), its hook (`useQuickfillNoncardAttribution`), and the capability-probe eligibility model (count RPC; 42501 → hidden; dev + `banking_attributors` holders) all live on unchanged, hosted by `src/pages/Moneyfill.tsx` (dev + controller page). Pure logic stays in `lib/banking/noncardAttributionQueue.ts` (+tests).
- `schedule` / `tomorrow-schedule`: `showOutstandingInHeader={false}`, `showMarkHistoryButton={false}`; schedule passes `hideConflictPrompt` (the wrapper's configurable banner replaces the section's built-in prompt).
- `email-inbox` / `email-next-actions` / `email-follow-up`: three parameterizations of `QuickfillEmailInboxSection` (distinct `metricSectionId`, `fieldLabel`, `markButtonLabel`, `emptyNoteToast`), each with `omitDefaultMarkButton` + child-owned mark button.
- `dispatch-inbox`: threads the full `useDispatchInbox` surface (requests, notes, drafts, dismiss) into `DispatchInboxSection variant="embedded"`, plus `onLinkJobPictures` via `useJobFormModal().openEditJob(jobId, { jobPicturesLinkHighlight: true })` and role-gated `onCreateTripCharge` → `setTripChargeTarget`.
- `warnings`: the **only inline body** (next dossier).
- `jobs-billing`: passes `minHcpNumber={jobsBillingMinHcp}`.
- `cant-reach` / `complete-no-bill` / `no-customer-stages`: bodies receive their hook data as props (hooks stay in parent because eligibility + metrics read them).
- Inline `QuickfillMetricReporter` (in-file 12-line component wrapping `useReportQuickfillSectionMetric`) is mounted for `warnings` (×2, incl. a synthetic `ar-bank-unallocated` id), `unpriced-fixtures`, `dispatch-inbox`; `complete-no-bill`, `cant-reach`, and `no-customer-stages` report via top-level `useReportQuickfillSectionMetric` calls instead.

**Approach:** leave the switch. Each case is already a thin wrapper; converting to a config-driven registry would be a redesign, not a move. The switch shrinks naturally as the mark/layout hooks make its inputs one destructure.

### Warnings section body (only inline section)

- **Location:** `case 'warnings'`. Composes `DashboardArBankUnallocatedBanner` (navigates to `/accounts-receivable` with a toast), `DashboardTallyStaleStaffBanner` (opens `DashboardStaleTallyStaffFollowUpModal` via `warningsModalOpen`), and two `QuickfillMetricReporter`s.
- **Data:** `useStaleTallyStaffFollowUp(TALLY_STALE_MIN_AGE_DAYS)` (`staleTallyStaffPeopleCount`, `staleTallyStaffTxCount`, `refetchStaleTallyStaffFollowUp`) and `useArBankUnallocatedCount({ enabled: arBankCountEnabled, authUserId, authRole })` with `arBankCountEnabled = authUser?.id && canRoleSeeArBankUnallocatedOrgNudge(role)`. Inner banners self-hide at count 0 (wrapper always renders for eligible roles → stable page height).
- **Extraction:** low risk → `QuickfillWarningsSection` owning `warningsModalOpen` + both hooks; parent keeps only eligibility. Note the metric ids: section metric key `warnings` reports the stale-tally **transaction** count; the AR count reports under the synthetic id `ar-bank-unallocated`.

### `QuickfillSectionWrapper` (+ `QuickfillSectionHistoryIcon`)

- **Location:** module-level components at the bottom of the file (~1730–2039), ~310 lines.
- **Inputs:** fully prop-driven (`id`, `sectionId`, `label`, `withTopDivider`, `bannerText`, `color`, `collapsed`, `mark`, `omitDefaultMarkButton`, `showOutstandingInHeader`, `showMarkHistoryButton`, `showLastMarked`, `onMarkUpToDate`, `onOpenNow`, `onOpenHistory`, `children`). Internal deps: `useQuickfillSectionMetric(sectionId)` (outstanding count + optional `onOutstandingClick` breakdown link) and `useNarrowViewport640()`.
- **Behavior:** desktop-collapsed renders a slim green strip (title + "Marked HH:MM by NAME · Reloads in X.Xh" + history + "Open now"); narrow keeps the two-row layout; expanded renders optional amber `role="note"` banner (`QUICKFILL_SECTION_BANNER_BOX_STYLE` lib style), children, and the default centered mark button (`Mark {label} up to date!`) colored by the freshness palette.
- **Extraction:** **cheapest, highest-leverage move on the page** — verbatim file move to `src/components/quickfill/QuickfillSectionWrapper.tsx`, exporting the wrapper + moving `getButtonColor`/`BUTTON_BG`/`BUTTON_BORDER`/`formatTime`/`hoursUntilExpand`/`formatHeaderLastMarked` to lib first so both the wrapper and the page's jump grid import them.

### Page chrome + page-level modals (stays)

Jump-button grid (unfiltered by search; per-chip freshness color, floating who+when stamp via `markStampInitial`/`markStampTime`, `scrollIntoView` on click), section search input, `SectionDock` (rendered only when >1 chip; hides chips in `dockHiddenThisVisit`; adds `paddingBottom: '4.5rem'`), empty-state paragraphs, and the three page-level modals: `QuickfillSectionMarkHistoryModal` (opened from any section header), `DispatchDismissedItemsModal` (gated `authUser?.id && dispatchInboxEligible`; `loadRows={fetchDismissedDispatchInboxRows}`), `CreateTripChargeModal` (`tripChargeTarget: CreateTripChargeTarget | null`, set from the dispatch-inbox section). All stay in the parent — modals are opened from section wiring, and the grid/dock read the whole mark map.

---

## `QuickfillScheduleSection.tsx` region dossiers

**Hosts (all three prop modes must survive any refactor):**

1. `Quickfill.tsx` `case 'schedule'` → `<QuickfillScheduleSection hideConflictPrompt />` (today, no day-settings gear).
2. [`ScheduleDispatchHub.tsx`](../src/components/schedule/ScheduleDispatchHub.tsx) Day tab → `<QuickfillScheduleSection hideConflictPrompt initialWorkDateYmd={dayTabWorkDateYmd} onBlocksSaved={onDayScheduleChanged} showDaySettings />`.
3. Indirectly, Quickfill's `tomorrow-schedule` section renders `QuickfillTomorrowsScheduleSection`, which embeds `ScheduleDispatchHubPage variant="tomorrow"` → host 2.

Props: `hideConflictPrompt` (suppress the built-in `SCHEDULE_CONFLICTS_DEFAULT_PROMPT` banner), `initialWorkDateYmd` (synced into `workDate` by effect whenever it changes), `onBlocksSaved` (host cache refresh after ANY block write — dot autosave, separation, reorder, add-block; also mirrored into `onBlocksSavedRef` for the unmount flush), `showDaySettings` (Day tab only: gear + `dayNavRow` moves ABOVE the banner instead of below the search row).

Role gates: `canEditSchedule = CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES.has(role)` (dots, add, reorder); `showClockStripScopeToggle` (dev/master_technician/assistant-like); `showStripSubjectMyTimeEditor` (those + superintendent). Reports a **null** section metric: `useReportQuickfillSectionMetric('schedule', null, false)` (no backlog count — the wrapper hides the "N open" column).

### Day data engine (the section's substrate)

- **Owned state:** `workDate` (init: `initialWorkDateYmd` else `denverCalendarDayKey(Date.now())`), `loading`, `userIds`, `nameById`, `blocksByUserId` (`Map<userId, JobScheduleBlockRow[]>`, sorted by `time_start`), `sessionsByUserId`, `roleByUserId`, `jobTitleById`, `bidTitleById`, `hubJobsForPicker` (`ScheduleDispatchHubJobRow[]`).
- **Loader:** `loadData({ quiet? })` — parallel `fetchUsersTabRosterForScheduleDispatchHub(role === 'dev')` + `fetchJobsLedgerForScheduleDispatchHub()`, then `fetchUserNamesForIds(ids)`, `fetchScheduleBlocksForAssigneesOnDay(ids, workDate)`, a direct `clock_sessions` SELECT (`.in('user_id', ids).eq('work_date', workDate).is('rejected_at', null).is('revoked_at', null)`), and a `bids` SELECT (`id, bid_number, project_name, service_type_id`) for session bid labels via `formatBidLedgerShortLine(ledgerPrefixMap, …)`. `quiet: true` (all post-write reloads) skips the loading flag. Full reset of all caches on roster error / thrown error.
- **Realtime:** `useRealtimeChannel(true, `quickfill-schedule-blocks-${workDate}`, [{ event: '*', table: 'job_schedule_blocks', filter: `work_date=eq.${workDate}` }], → loadData({quiet}), { debounceMs: 400 })`.
- **Supabase tables (direct + via libs):** `job_schedule_blocks` (SELECT via `fetchScheduleBlocksForAssigneesOnDay`; UPDATE via `updateJobScheduleBlock`; INSERT via `saveNewScheduleBlockForPersonDay`), `clock_sessions` (SELECT), `bids` (SELECT), `users` + `jobs_ledger` (via `scheduleDispatchHub.ts` fetchers), `jobs_ledger` + `address_geocodes` (travel region), time-off tables via `recordNotComingInForUserAsStaff`. Edge function: `geocode-address-batch`.
- **Extraction seam:** `useQuickfillScheduleDay(workDate, role, …)` returning the caches + `loadData`. Every other region consumes it. Build this hook **before** moving the dot-drag or add-block clusters.

### Dot-drag autosave (highest-risk region)

- **Owned state/refs:** `dotDraft` (`{ userId, updates: Map<blockId, { startMin, endMin }> } | null`) + `dotDraftRef` (kept in sync by effect — **updated synchronously inside `handleDotDrag` so the same-tick pointerup sees it**), `dotSaving`, `dotSaveTimerRef`, `DOT_AUTOSAVE_DEBOUNCE_MS = 2000`, `onBlocksSavedRef`.
- **Handlers:** `effectiveRowsForUser(userId)` (base rows with the live draft overlaid), `rowsToDotBlocks` (plain function), `boundaryDotsForUser` (**dot identity comes from BASE rows for the whole gesture; only positions come from the draft** — otherwise a drag onto a neighbor flips the dot to `shared` mid-drag and unmounts the pointer-capture element), `handleDotDrag` (touching a different user's dot flushes the pending draft first; merges via `resolveDotDrag` from [`lib/dayScheduleDotDrag.ts`](../src/lib/dayScheduleDotDrag.ts)), `handleDotDragEnd` → `scheduleDotSave` (2s debounce), `flushPendingDotSave`, `persistDotDraft` (sequential `updateJobScheduleBlock` per changed block, break on first error, quiet reload, `onBlocksSaved?.()`), `handleSharedDotSeparate` (`separateSharedDot`; toast "Cannot separate — the later job is already at the 30-minute minimum." on null).
- **Unmount flush effect:** cleanup clears the timer and, if a draft with updates exists, fires the writes without awaiting UI, then `onBlocksSavedRef.current?.()` — pending edits must not be lost when the section unmounts (e.g. hub tab switch).
- **Pure logic:** already extracted + tested — `boundaryDotsFromBlocks`, `resolveDotDrag`, `separateSharedDot`, `dotMinutesToPgTime` in `lib/dayScheduleDotDrag.ts`.
- **Extraction:** `useDayScheduleDotDrag({ blocksByUserId, reload, onBlocksSaved })`. **High risk**: the ref-synchronization discipline, the cross-user flush, and the unmount flush are all timing-sensitive; move verbatim with the comments, never "simplify" the ref writes into state.

### Travel hints + geocode self-heal

- **Owned state/refs:** `travelConfig` (`TravelHintsConfig`, reloaded on `TRAVEL_HINTS_CONFIG_CHANGED_EVENT` window event), `jobCoordsByJobId` (`ReadonlyMap<jobId, LatLng>`), `geocodeFill` (`{ running, failures[] }`), `geocodeAttemptedKeysRef` (once-per-address-per-page-load guard), `routedByPairKey` (`ReadonlyMap<pairKey, TravelEstimate>`).
- **Derived:** `travelJobIdsKey` (sorted-joined job ids; `''` when hints disabled — the effect key).
- **Effects:** (1) coords effect — `jobs_ledger.select('id, job_address')` for the day's job ids → `normalizeAddressForGeocodeKey` → cached `address_geocodes` lookup in `batchGeocodeCacheKeys` batches → **self-healing fill (v2.932)**: missing keys geocoded right here via `supabase.functions.invoke('geocode-address-batch')` in chunks of 20, failures surfaced in an amber status line (address list + hover detail); (2) routed effect — Option B: consecutive different-job pairs per user → `fetchRoutedTravelTimes`; empty map = straight-line fallback everywhere.
- **Handler:** `travelUiForUser(userId, rows)` — builds gap chips (`≥`/`~` prefix by estimate source, `severity: 'ok' | 'tight'` by `g.feasible`) and red shared-dot warnings for back-to-backs where `estimate.minutes >= TRAVEL_TOUCHING_WARN_MINUTES`, via `buildDayTravelGaps` from [`lib/jobTravelEstimate.ts`](../src/lib/jobTravelEstimate.ts) (tested).
- **Extraction:** `useDayTravelHints({ blocksByUserId, enabled })` — self-contained given the blocks cache; low-med risk. Stage A: the chip/warning-building body of `travelUiForUser` is pure → `lib/quickfillScheduleTravelUi.ts` + test.

### Add-block + job picker cluster

- **Owned state:** `cellAddContext` (`{ assigneeUserId, workDate } | null`), `assignJobPickerOpen`, `assignJobPickerSearch`, `blockModalState` (`QuickfillBlockModalState = { kind: 'add', assigneeUserId, workDate, jobId }`), `addBlockTimelineSegments`, `addBlockDraftByBlockId` (neighbor-block time edits made inside the modal), `addTimeStart`/`addTimeEnd` (default `'08:00'`/`'16:00'`), `addNote`, `addError`, `addSaving`.
- **Derived memos:** `quickfillOrderedSessionJobLedgerIds` (unique `job_ledger_id`s from the person's clock sessions, first-clock-in order), `quickfillSessionJobOrderIndex`, `quickfillPickerJobsSorted` (session-today jobs first in session order, then by `hcp_number` descending numeric), `quickfillAssignJobPickerRows` (search filter + `sessionToday` flag), `quickfillCellChoiceSubtitle`, `quickfillAssignJobPickerSubtitle` (ReactNode), `blockModalPersonLabel`, `blockModalJobTitle`, `addBlockModalTimeline`.
- **Handlers:** `openQuickfillAddBlock` (closes picker, builds sorted `AddBlockTimelineSegment[]` from the person's blocks, seeds times via `defaultNewBlockRangeInFirstGap` else 08:00–16:00), `closeQuickfillAddBlock`, `closeQuickfillJobPicker`, `saveQuickfillBlockModal` → [`saveNewScheduleBlockForPersonDay`](../src/lib/scheduleDispatchAddBlockSave.ts) (handles the new block AND the neighbor drafts) → toast, quiet reload, `onBlocksSaved`. A `workDate`-change effect closes both modals and resets picker state.
- **Sub-components (extracted):** `ScheduleDispatchAssignJobPickerModal`, `ScheduleDispatchAddBlockModal` (shared with Schedule Dispatch proper).
- **Extraction:** medium — everything reads the day-engine caches (`blocksByUserId`, `sessionsByUserId`, `hubJobsForPicker`, `jobTitleById`, `nameById`). Extract after the seam hook, as `useQuickfillAddBlock` or a `QuickfillAddBlockFlow` component. Stage A: the picker sort/filter memos are pure → `lib/quickfillScheduleJobPicker.ts` + tests.

### Reorder-day

- **Owned state:** `reorderUserId`, `reorderSaving`, `reorderError`.
- **Handler:** `saveReorderedDay(newOrderedIds)` — diff via [`reorderDayScheduleBlocks`](../src/lib/reorderDayScheduleBlocks.ts) (tested; throws → "The job list changed — close and reopen to reorder."), then sequential `updateJobScheduleBlock` per change, and for any changed block with a `shared_block_group_id`, **shifts every other assignee's leg of that group by the same minute delta** (`reorderTimeToMinutes`/`reorderMinutesToTime` aliases). Aborts on first error (partial writes possible — the realtime channel + quiet reload reconcile). Toast "Day reordered", quiet reload, `onBlocksSaved`.
- **Sub-component:** `ReorderDayBlocksModal` (extracted; receives `linked: r.shared_block_group_id != null` flags).
- **Extraction:** small; moves with or after the seam.

### Day rail window + settings modal (extract first)

- **Owned state:** `dayRailWindow` (`{ startMin, endMin } | null`; lazy-init from localStorage `pipetooling_dispatch_day_rail_window_v1`; invalid/full-day → null), `daySettingsOpen`, `daySettingsDraftStart`/`daySettingsDraftEnd`.
- **Derived:** `dayRailTrimWindow` (`{ loSlotIndex, hiSlotIndex }` in 30-min slots), `dayWindowChoices` (30-min steps across `MIN_MIN`–`MAX_MIN`, i.e. the 04:00–20:00 block bounds).
- **Handlers:** `openDaySettings`, `saveDaySettings` (full-window saves as **null** / removes the key; localStorage failures swallowed — in-memory still applies). Start select clamps end to ≥ start+60.
- **Render:** inline `role="dialog"` modal (~130 lines) — per-device setting, min 60-minute window, "Reset to full day (4 AM–8 PM)".
- **Extraction:** **lowest risk in the file** — `DispatchDayVisibleHoursModal` + a tiny `useDayRailWindow()` hook (localStorage read/write is Stage-A testable). Only `showDaySettings` hosts render the gear, but the stored window applies wherever the section renders.

### Roster filters + grouping

- **Owned state:** `searchQuery`, `hideAssistantsEstimators` (lazy-init via `readHideAssistantsEstimatorsFromStorage`; persisted to localStorage key `quickfill_schedule_hide_assistant_estimator` as `'1'`/`'0'` in `toggleHideAssistantsEstimators`).
- **Derived:** `sortedUsers` (name-sorted, `'Unknown'` fallback), `rosterFilteredUsers` (drops `isAssistantLike` + `estimator` when hidden), `filteredSortedUsers` (matches person name OR any of their block-job titles), `scheduleUsersByRoleSection` (via `groupRosterUsersByAuthRoleSection` lib), `scheduleSecondaryByUserId` (clock-session bands via `clockSessionsToDispatchSecondaryBands` lib), `jobLabelsRecord`/`bidLabelsRecord` (Map→Record for the My Time modal).
- **Extraction:** memos are Stage-A-able (`filterRosterBySearch` pure function + test); otherwise stays with the render core.

### My Time editor + Not-coming-in

- **Owned state:** `scheduleMyTimeEditor` (`{ subjectUserId, subjectDisplayName } | null`).
- **Handlers:** `openMyTimeForSessionStrip`, `handleScheduleMarkNotComingIn` → [`recordNotComingInForUserAsStaff`](../src/lib/notComingInTimeOff.ts) (tested lib; handles already-marked + salary-sync warnings), quiet reload.
- **Sub-component:** `DashboardMyTimeDayEditorModal` (extracted, shared with Dashboard; receives `sessions={[]}` — it loads its own, plus `jobLabels`/`bidLabels`, `allowNcnsFromMyTime`, `showMarkNotComingIn`).

### Render core (stays)

`dayNavRow` (Previous/Next day via `ymdAddDays`, `dayLabel` via `formatDenverCalendarDayWithWeekdayAndYear`, "Dispatch" link to `/schedule-dispatch?week=…&day=…` via `companyWeekStartSundayContaining`, conditional "Today" button, optional visible-hours gear; renders above the banner when `showDaySettings`, else below the search row), geocode status line, search/hide-toggle row, orientation-marks header (`DISPATCH_ADD_BLOCK_ORIENTATION_MARKS` filtered by the trim window, positioned by `dispatchAddBlockTrackThumbLeftPct`), and the role-section loop rendering [`QuickfillScheduleUserRow`](../src/components/schedule/QuickfillScheduleUserRow.tsx) (extracted; since v2.1352 it renders an **agenda variant** at ≤640px — `agendaVariant` prop from `useNarrowViewport640`: per-block time-chip rows + Clocked lines instead of the proportional track, orientation-marks header hidden; the track/dots path is unchanged and remains the ≥640px rendering) per person with `segments={blocksToSegments(rows, jobTitleById)}`, secondary bands, boundary dots (edit roles + rows>0 only), travel chips/warnings, and the add/reorder/my-time/`onOccupiedBandClick` (→ navigate to Schedule Dispatch with `jobId`) callbacks.

---

## Shared substrate

**Quickfill.tsx has no shared record pointer** — nothing like Bids' `setSharedBid`; there is no selected-record state and no `?id=` deep link. What IS shared, and what any extraction must be handed:

1. **`QuickfillSectionMetricsContext`** — the page's data-engine equivalent, and it is **already extracted** (`QuickfillSectionMetricsProvider` wraps the page in the default export; sections push counts via `useReportQuickfillSectionMetric`; the wrapper reads them via `useQuickfillSectionMetric`; `markSectionUpToDate` snapshots `getOutstandingCount(sectionId)` into history rows). Extractions plug into this context, not into new props.
2. **The mark/collapse system** (`sectionMarks` + `markSectionUpToDate` + `isCollapsed` + `forceExpandedSections` + `dockHiddenThisVisit`) — read by every wrapper, the jump grid, and the dock; written by wrappers AND by five child sections' own mark buttons. This is the page's true coupling hub → the `useQuickfillSectionMarks` seam.
3. **The layout settings** (`sectionOrderIds`, `hiddenSectionIds`, `sectionBanners`, `jobsBillingMinHcp`) — org-wide `app_settings` rows → `useQuickfillLayoutSettings` seam.
4. **Inside `QuickfillScheduleSection`**, the substrate is the **day data engine** (`workDate` + `loadData`'s seven caches + the realtime channel): the dot-drag, travel, add-block, reorder, and My Time regions all read it and all call `loadData({ quiet: true })` + `onBlocksSaved` after writes → the `useQuickfillScheduleDay` seam.

Implication: with no shared pointer, extractions here don't need controlled-selection props — they need the two page hooks (marks, layout) and, for the schedule file, the day-engine hook, threaded as destructured props exactly like Bids' `useBidPricingEngine` pattern.

## Stage-A pure-logic inventory (extract to `lib/*` + tests before any component moves)

| Candidate | Currently | Target |
|---|---|---|
| `parseHiddenSectionIdsFromValueText`, `normalizeQuickfillSectionOrderFromValueText`, `parseQuickfillSectionBannersFromValueText`, `capQuickfillBannerText`, `effectiveQuickfillSectionBanner` | module fns in Quickfill.tsx | `lib/quickfillSectionLayout.ts` + tests (order-merge drift cases, banner cap/default fallbacks) |
| `getButtonColor`, `hoursUntilExpand`, `formatRelativeTime`, `formatTime`, `formatHeaderLastMarked` (+ `BUTTON_BG`/`BUTTON_BORDER`) | module fns in Quickfill.tsx | `lib/quickfillSectionMarkFreshness.ts` + tests (30h/12h thresholds, never-marked, invalid ISO) — sits beside existing `quickfillMarkStamp.ts` |
| `travelUiForUser` chip/warning builder | `useCallback` closure in QuickfillScheduleSection | `lib/quickfillScheduleTravelUi.ts` taking `(rows, coords, config, routedByPairKey)` + tests (gap vs touching, feasible vs tight, routed `~` vs straight-line `≥` copy) |
| `quickfillPickerJobsSorted` + `quickfillAssignJobPickerRows` sort/filter | memos in QuickfillScheduleSection | `lib/quickfillScheduleJobPicker.ts` + tests (session-order-first, hcp numeric desc, search fields) |
| day-rail-window localStorage parse/serialize (lazy init + `saveDaySettings`) | inline try/catch | `lib/dispatchDayRailWindow.ts` + tests (bounds, min-60, full-day→null) |
| `rowsToDotBlocks`, roster search filter | inline | fold into the respective lib modules above |

Already in `lib/*` **with tests** (do not re-extract; just note): `dayScheduleDotDrag`, `jobTravelEstimate`, `reorderDayScheduleBlocks`, `notComingInTimeOff`, `quickfillMarkStamp`, `quickfillSectionSearch`, `quickfillCompleteNoBill`, `scheduleDispatchAddBlockTimeline`. Without colocated tests (add opportunistically): `quickfillScheduleSegments`, `clockSessionsToDispatchSecondaryBands`, `dispatchAddBlockTime`, `scheduleDispatchAddBlockSave`, `scheduleDispatchHub`.

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **`dockHiddenThisVisit` is session-only by design** — the comment says chips must return on reload even though the mark persists. Never derive it from `sectionMarks`.
2. **`forceExpandedSections` initializes to `new Set(['cant-reach'])`** — cant-reach ignores a fresh mark's collapse on first render.
3. **`cant-reach` is the only count-gated section** (documented exception in `sectionWouldRenderOnPage`); everything else is role/feature-gated only so page height is stable from first paint. (A second narrow exception existed v2.1318–v2.1377: `noncard-attribution` gated on a count-RPC permission probe — that section moved to `/moneyfill` in v2.1378 and the exception left this file with it.)
4. **`my-inbox` is per-user**: no mark, no collapse, no history, neutral jump chip ("Personal section — items are completed individually").
5. **Mark upsert failure returns silently**; mark-event history INSERT failure is tolerated with a warning toast ("Marked up to date, but saving history failed…"). Note cap 10,000 chars; `outstanding_count` snapshotted from the metrics context at mark time.
6. **`devSetSectionVisible` persists only for `role === 'dev'`** (queueMicrotask), though the toggle updates local state unconditionally; the panel itself only renders for dev.
7. **Layout settings load once on mount; no realtime** — `app_settings` is not in the realtime publication (dead listener removed, v2.560 cleanup). Don't reintroduce a listener.
8. **Schedule + tomorrow-schedule have hardcoded default banners** (`'Are there any obvious schedule conflicts?'` / `'Who is on what job tomorrow?'`) that apply only when no custom banner is stored; Quickfill passes `hideConflictPrompt` so the wrapper banner is the single callout, while the section keeps its own copy of the same string for other hosts.
9. **Schedule reports a null metric** (`useReportQuickfillSectionMetric('schedule', null, false)`) and its wrapper hides the outstanding column + history button — "not comparable to inbox-style sections".
10. **Freshness thresholds**: red >30h, yellow >12h, green ≤12h; auto-expand (collapse expiry) at 12h; `hoursUntilExpand` rounds up to tenths.
11. **Page root width containment** (v2.1003 comment): `width: '100%', minWidth: 0, boxSizing: 'border-box'` prevents phone sideways panning; dock adds `paddingBottom: '4.5rem'` only when >1 chip.
12. **Dot identity from BASE rows during a drag** (comment at `boundaryDotsForUser`) — only positions come from the draft, or the pointer-capture element unmounts mid-gesture. `dotDraftRef` is written synchronously in `handleDotDrag` (pointerup same-tick). Autosave debounce 2000ms; touching another person's dot flushes the pending draft first; **unmount flushes pending writes** fire-and-forget.
13. **Geocode self-heal runs once per address per page load** (`geocodeAttemptedKeysRef`), chunks of 20, failures rendered inline with hover detail (v2.932 — the Map page was too rarely visited to fill the cache).
14. **`saveReorderedDay` shifts linked crew legs**: any changed block with `shared_block_group_id` propagates the same minute delta to every other assignee's leg of that group; writes are sequential and abort on first error (partial state reconciled by realtime + quiet reload).
15. **Day rail window stores full-day as null** (removes the key); min 60-minute window; per-device (`pipetooling_dispatch_day_rail_window_v1`); block bounds are `MIN_MIN`–`MAX_MIN` = 04:00–20:00.
16. **`workDate` change closes the picker/add-block modals** (effect) and re-keys the realtime channel; `initialWorkDateYmd` prop changes overwrite local day nav.
17. **Email/texts/physical sections own their mark buttons** (`omitDefaultMarkButton`) and require a note before marking (variant-specific `emptyNoteToast`); the parent still owns the actual `markSectionUpToDate` write and passes the freshness palette down.
18. **`QuickfillMetricReporter` for warnings registers a synthetic section id `ar-bank-unallocated`** alongside the real `warnings` id — the metrics context tracks more ids than `SECTIONS` contains.

## Recommended extraction order (value ÷ risk)

1. **Stage A sweep** — the [pure-logic inventory](#stage-a-pure-logic-inventory-extract-to-lib--tests-before-any-component-moves) above; each independently shippable. Highest leverage: `quickfillSectionMarkFreshness` (unblocks step 2) and `quickfillScheduleTravelUi`.
2. **`QuickfillSectionWrapper` (+ history icon) → own file** — verbatim move, ~310 lines off the page, props-only interface, validates nothing else changed.
3. **`useQuickfillLayoutSettings` + `useQuickfillSectionMarks` hooks** — the two parent seams; parent destructures so downstream references are unchanged.
4. **`QuickfillDevSectionsPanel`** — `QuickfillDevSectionSortableRow` + the DndContext block + panel toggle, consuming the layout hook (~185 lines).
5. **`QuickfillWarningsSection`** — the only inline section body; takes both warnings hooks and `warningsModalOpen` with it.
6. **`QuickfillScheduleSection` sub-decomposition** (its own mini-playbook run, in this order):
   a. `DispatchDayVisibleHoursModal` + `useDayRailWindow` (lowest coupling);
   b. `useDayTravelHints`;
   c. `useQuickfillScheduleDay` seam (day engine + realtime);
   d. `useDayScheduleDotDrag` against the seam (highest risk — move verbatim);
   e. add-block/picker cluster, then reorder-day.

### What must STAY in the parent(s)

- **`Quickfill.tsx`:** the `SECTIONS` registry; `sectionWouldRenderOnPage` eligibility + the five section hooks it reads (`useQuickfillCantReachProspects`, `useQuickfillCompleteNoBillJobs`, `useQuickfillStagesJobsWithoutCustomer`, `useDispatchInbox`, `useUnpricedFixturesCount`) since eligibility, metrics, and section props all consume them; the `quickfillSectionBlock` switch; jump grid / search / `SectionDock`; page-level modals (`QuickfillSectionMarkHistoryModal`, `DispatchDismissedItemsModal`, `CreateTripChargeModal`) and their open-state setters; the `QuickfillSectionMetricsProvider` mount. There is no URL router to preserve.
- **`QuickfillScheduleSection.tsx`:** the host-prop contract (`hideConflictPrompt`, `initialWorkDateYmd`, `onBlocksSaved`, `showDaySettings`) and the `onBlocksSaved` fan-out after every write path (including the unmount flush) — the Dispatch hub Day tab depends on it; `workDate` ownership + the realtime channel; the role gates.

Definition of done per unit, verification gates (`npm run typecheck && npm run lint && npm test` after every step), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). Behavior-preserving only.
