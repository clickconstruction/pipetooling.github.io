# Quickfill Architecture Map

---
file: docs/QUICKFILL_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the Quickfill billing-workflow surface (per PAGE_DECOMPOSITION_PLAYBOOK.md) — inventory what src/pages/Quickfill.tsx (2,476 lines) and src/components/quickfill/QuickfillScheduleSection.tsx (1,885 lines) own (state, handlers, supabase tables/edge functions, realtime, sub-components, coupling, test coverage) so future extractions need no re-derivation. Sections: What this surface is; How to read a dossier; Master summary table; Quickfill.tsx region dossiers; QuickfillScheduleSection region dossiers; Shared substrate; Stage-A pure-logic inventory; Test coverage; Preserve-quirks list; Recommended extraction order; What stays in the parent.
covers:
  - src/pages/Quickfill.tsx
  - src/components/quickfill/QuickfillScheduleSection.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

> **Line numbers are exact as of `a05cef4c4`** (from `npm run map -- <file>` fact sheets) and rot with the next edit — search the symbol; the range is only a hint. Re-run `npm run map` before trusting a range.

## What this surface is

Quickfill (`/quickfill`) is the office billing-workflow checklist: on desktop a single vertical page of **31 collapsible sections** (stations, not tabs), each an operational review ("Billed Awaiting Payment", "Jobs Billing", "Schedule", "Email", …) with an org-wide "Mark … up to date!" freshness system; **on phones (≤640px, v2.3783) the same stations become a round** — a list of rows measured against each section's own marking rhythm, one section per screen. Two files are in scope:

| File | Lines | Components | useState | Effects | useMemo | useCallback | useRef | Custom hooks | Last commit | Commits / 90 d |
|---|---|---|---|---|---|---|---|---|---|---|
| [`src/pages/Quickfill.tsx`](../src/pages/Quickfill.tsx) | 2,476 | 6 (+12 module fns) | 22 | 5 | 11 | 10 | 2 | 21 | 2026-09-23 `f414f16b0` | 42 |
| [`src/components/quickfill/QuickfillScheduleSection.tsx`](../src/components/quickfill/QuickfillScheduleSection.tsx) | 1,885 | 1 (+1 module fn) | 39 | 10 | 22 | 22 | 4 | 8 | 2026-09-06 `a59faab40` | 21 |

`Quickfill.tsx` holds `QuickfillPage` (436–2081, 1,646 lines — all 22 `useState`), `QuickfillSectionWrapper` (2137–2476), `QuickfillDevSectionSortableRow` (315–434), `CloseWeekChip` (2099–2135), `QuickfillSectionHistoryIcon` (2083–2089) and the default export `Quickfill` (292–298, mounts `QuickfillSectionMetricsProvider`). Imported only by `src/App.tsx`. The schedule section is imported by `Quickfill.tsx` and `ScheduleDispatchHub.tsx`.

**Key structural fact — this is NOT a Bids/Materials-style God page.** 25 section-body components already live in `src/components/quickfill/*` (`QuickfillOfficeSection` serves two stations) plus shared ones (`DispatchInboxSection`, `SectionDock`, five `Dashboard*` banners/modals); per-section data hooks exist (`useDispatchInbox`, `useQuickfillCantReachProspects`, `useQuickfillCompleteNoBillJobs`, `useQuickfillStagesJobsWithoutCustomer`, `useUnpricedFixturesCount`, `useStaleTallyStaffFollowUp`, `useLostBidNudge`); the phone round's pure logic is [`lib/quickfill/round.ts`](../src/lib/quickfill/round.ts) (+test) and its screens are extracted (`QuickfillRoundScreen` 104 lines, `QuickfillRoundList` 103, `quickfillRoundContext.ts` 7). What remains in `Quickfill.tsx` is the **section framework itself** (registry, mark system, layout settings, wrapper chrome, dev panel, round wiring, one 730-line switch). The decomposition targets are (a) those framework clusters and (b) a **sub-decomposition of `QuickfillScheduleSection`**, the real 1,885-line monolith.

**The page has one address form and no record pointer.** `/quickfill#<sectionId>` (also `#quickfill-<sectionId>`, `?station=`) is a station deep link — desktop force-expands + scrolls; phones open that station's round screen. There is no selected-record state. See [Station deep links](#station-deep-links-v22890-journey-map-tier-2-17).

Shape changes since the previous map (2026-09-06): Close-week chip on four money stations (v2.2898); dispatch-inbox metric reporter moved beside its wrapper (v2.2896); `crew-jobs` station retired (v2.2986); `banking-sorting` gated to `canAccessBanking` (v2.3305); dispatch priority + call-log props (v2.3247); **phone round** (v2.3783, punch list #30 PR 3); schedule section gained "Create new job" in the person-row picker (v2.2909) and the Day-tab `SubsOnSiteForDay` strip (v2.2929). Both files are HIGH-churn; extractions should be small and frequent.

## How to read a dossier

Each dossier lists: render location, **owned local state** (moves with an extraction), **cross-section/shared state** (stays in the parent), derived memos, handlers, supabase tables/realtime/edge functions, sub-components (extracted vs inline), external coupling, tests, and extraction status + risk + approach. Ranges are the fact-sheet ranges at `a05cef4c4`.

---

## Master summary table

### `Quickfill.tsx` regions

| Region | Anchor (lines) | Size | Coupling | Risk | Tests | Status |
|---|---|---|---|---|---|---|
| Section registry + constants | `SECTIONS` 89–129 … `SECTION_LABEL_BY_SECTION_ID` 148 | ~60 | page spine | — | none | stays |
| Module-level pure helpers | `parseHiddenSectionIdsFromValueText` 150–159 … `formatHeaderLastMarked` 275–290 | 141 | none (pure) | low | **none** | inline — **Stage A first** |
| Layout settings engine | state 525, 530, 532, 546–548; persisters 552–610; load effect 612–664; `devSetSectionVisible` 676–688; banner/drag callbacks 815–854 | ~185 | med (order/hidden/banners feed eligibility, grid, dev panel, round) | low | none | inline — hook seam |
| Mark/collapse system | `sectionMarks` 497; `loadSectionMarks` 856–870 … `isCollapsed` 928–933 | ~85 | **highest** — 31 wrappers, grid, dock, round, 3 child mark buttons | med | none | inline — hook seam |
| Close-week chip cluster | `closeWeekMonday` 503 … `onCloseWeekOpen` 521–522; `CloseWeekChip` 2099–2135 | ~60 | low (4 money stations) | low | kernels tested | inline — small hook |
| Eligibility + search + order | `warningsSectionEligible` 693–695 … `firstVisibleSectionId` 811 | ~120 | high (4 section hooks + role gates) | med | kernels only | stays in parent |
| Station deep link effect | `stationRequestKey` 944, effect 947–972 | ~38 | med | low | `stationDeepLink.test.ts` (kernel) | stays (router-equivalent) |
| Per-section wiring switch | `quickfillSectionBlock` 974–1703 | 730 | high (marks + hooks + modal setters) | low value | none | stays (thin per case) |
| Inline station bodies | `case 'warnings'` 979–1015; `lost-bid-reasons` 1221–1247; `gc-weekly-review` 1248–1270; `job-followups` 1271–1293; `needs-you` 1294–1323 | ~150 | low-med (3 page-held counts, 2 hooks) | low | kernels only | inline — extract |
| Dispatch-inbox wiring | `case 'dispatch-inbox'` 1522–1581 | 60 | med (19-field `useDispatchInbox` → 23 props; trip-charge + dismissed modals) | low | `dispatchInboxAging.test.ts` (kernel), `DispatchInboxSection.render.test.tsx` (body); wiring none | wiring stays |
| Phone round wiring | `roundEvents` 1718 … `roundLooked` 1759–1768; render 1778–1810 | ~90 | med (marks, eligibility, metrics ctx, `location`) | low-med | `round.test.ts` (kernel) | inline — hook seam; screens extracted |
| Desktop chrome render | dock 1813, jump grid 1815–1903, search 1907–1955, empty states 1956–1995, list 1996–1998 | ~190 | med (marks, `searchedSections`) | low | e2e `viewport-smoke` loads `/quickfill` | stays (page chrome) |
| **Dead phone paths** | `freshnessLine` 1706–1714 + 1904–1906 (keep `narrowViewport` 1705 — the round reads it); narrow jump-strip ternaries 1822–1832, 1861, 1866; wrapper narrow-collapsed branch 2406–2444 (its else 2445–2472 is the live expanded body — keep it) | ~65 | none | low | `freshnessSummary.test.ts` tests the orphaned kernel | **delete** — unreachable since v2.3783 |
| Dev layout panel | `QuickfillDevSectionSortableRow` 315–434 + `activeSectionsPanelOpen` 531 + panel JSX 1999–2056 | ~178 | med (order/hidden/banner/min-HCP state + persisters) | low | none | inline — extract `QuickfillDevSectionsPanel` |
| Wrapper + chip + history icon | `QuickfillSectionHistoryIcon` 2083–2089, `CloseWeekChip` 2099–2135, `QuickfillSectionWrapper` 2137–2476 | 394 | low (props + metrics ctx + round ctx) | **lowest** | `outstandingLabel.test.ts` only | in-file — **move verbatim first** |
| Page-level modals | `QuickfillSectionMarkHistoryModal`, `DispatchDismissedItemsModal`, `CreateTripChargeModal` 2059–2078 (+ open state `dispatchDismissedModalOpen` 549, `tripChargeTarget` 550) | 20 | — | — | — | extracted components; wiring stays |

### `QuickfillScheduleSection.tsx` regions

| Region | Anchor (lines) | Size | Coupling | Risk | Tests | Status |
|---|---|---|---|---|---|---|
| Day data engine | `workDate` 170–175; caches 176–179, 481–486, 489; `loadData` 770–893; load effect 1226–1228; realtime 1230–1244 | ~160 | **highest** — every other region reads its caches | med | fetchers tested; `loadData` none | inline — **`useQuickfillScheduleDay` seam** |
| Dot-drag autosave | `dotDraft` 181 … `dotSaveTimerRef` 197; `effectiveRowsForUser` 912–924 … `handleSharedDotSeparate` 1071–1098 | ~205 | high (blocks cache, `onBlocksSaved`, unmount flush) | **high** | kernel only (`dayScheduleDotDrag`) | inline — hook after seam |
| Travel hints + geocode self-heal | 254–480; status line 1453–1467 | ~240 | med (reads `blocksByUserId` only) | low-med | `jobTravelEstimate`, `geocodeCacheBatches`; `travelUiForUser` none | inline — `useDayTravelHints` |
| Add-block + job picker | state 490–494, 498–506; `closeQuickfillAddBlock` 565 … `addBlockModalTimeline` 705–712; reset effect 714–720; `onCreateNewJobFromQuickfillPicker` 898–909; `saveQuickfillBlockModal` 1168–1202; modals 1679–1697, 1715–1732 | ~260 | med (blocks/sessions/jobs caches) | med | save/timeline/number kernels + modal render test; picker memos none | inline — after seam |
| Reorder-day | state 495–497; `saveReorderedDay` 1102–1166; modal 1698–1714 | ~87 | med (writes linked legs across users) | med | kernel only (`reorderDayScheduleBlocks`) | inline — logic already in lib |
| Day rail window + settings modal | 199–252; host-API effect 735–745; modal JSX 1733–1861 | ~195 | **lowest** (localStorage + host callback) | low | hub render smoke covers registration | inline — **extract first** |
| Day nav rows | `dayLabel` 724–727, `scheduleDispatchHref` 729–732, `dayNavRow` 1247–1324, `compactDayNavRow` 1343–1442 (+`compactSearchOpen` 156) | ~205 | low (`workDate`, search, hide toggle) | low | none | inline — extract component |
| Roster filters + grouping | `readHideAssistantsEstimatorsFromStorage` 113–120; `sortedUsers` 508–512 … `bidLabelsRecord` 559; `toggleHideAssistantsEstimators` 758–768 | ~75 | low | low | bands kernel tested | inline — Stage A memos |
| My Time editor + NCNS | 166–169; `openMyTimeForSessionStrip` 561–563; `handleScheduleMarkNotComingIn` 1204–1224; modal 1862–1882 | ~50 | low | low | `notComingInTimeOff.test.ts` | inline — small |
| Render core | return 1444–1678 (roster loop 1596–1676) | ~235 | med | — | hub render smoke (Day tab) | stays as the component core |

---

## `Quickfill.tsx` region dossiers

### Section registry + module constants

- **Location:** top of file. `SECTIONS` 89–129 (31 entries `{ id: 'quickfill-<sectionId>', sectionId, label }`, `warnings` first, `needs-you` last), `DEFAULT_SECTION_ORDER_IDS` 138, `SECTION_INSERT_AFTER` 140–144, `VALID_SECTION_IDS` 146, `SECTION_LABEL_BY_SECTION_ID` 148; app_settings keys 131–134 `APP_SETTINGS_KEY_QUICKFILL_HIDDEN` (`quickfill_hidden_section_ids`), `…_MIN_HCP` (`quickfill_jobs_billing_min_hcp`), `…_SECTION_ORDER` (`quickfill_section_order`), `…_SECTION_BANNERS` (`quickfill_section_banners`); `QUICKFILL_SECTION_BANNER_MAX_CHARS = 800` 135, `DEFAULT_JOBS_BILLING_MIN_HCP = 406` 136, `MARK_EVENT_NOTE_MAX_CHARS = 10_000` 244, `BUTTON_BG`/`BUTTON_BORDER` 232–242, `QUICKFILL_SECTION_TITLE_STYLE` 247–252. Default banner questions for every section live in [`lib/quickfill/sectionBanners.ts`](../src/lib/quickfill/sectionBanners.ts) (v2.2189; no test).
- **Extraction note:** the registry is the page's spine — it stays. The constants move with whichever lib module claims them (see Stage A).
- **Later-added sections:** `SECTION_INSERT_AFTER` anchors a new id beside its default neighbor when an org already saved an order (`jobs-cleanup` → after `no-customer-stages`, `assistant-dailys` → after `office-arriving`, `undated-bills` → after `complete-no-bill`). `QuickfillJobsCleanupSection` hosts a component shared with another page (`PipelineMoneyOpportunities`, fed by `usePipelineMoneyOpportunities`; actions navigate via `?stagesMove=`); since v2.2189 it also carries the "Allocate N bank deposits" card that left Warnings.
- **`undated-bills` "Missing bill dates" (v2.2326):** self-contained body (`QuickfillUndatedBillsSection`) owning its RPC load (`get_undated_bill_worklist`), its metric report and inline bill-date saves via the shared `InlineBillDateEditor`; kernel `lib/quickfillUndatedBills.ts` (+test), render test `QuickfillUndatedBillsSection.render.test.tsx`.
- **Retired/moved stations (no longer in `SECTIONS`):** `noncard-attribution` → `/moneyfill` (v2.1378; body, hook and capability-probe eligibility live on in `src/pages/Moneyfill.tsx`); `hours` "People Hours (Old)" and the `email-next-actions` / `email-follow-up` variants (merged into one `email-inbox` "Email", v2.2189); `crew-jobs` "Crew Jobs / Bids" (v2.2986). A stale id in a saved order/hidden/banner row is dropped by the parse helpers (`VALID_SECTION_IDS`).

### Module-level pure helpers (Stage-A sweep target)

All pure, zero React, **untested** (not exported):

- `parseHiddenSectionIdsFromValueText(raw)` 150–159 — JSON parse + validate against `VALID_SECTION_IDS`.
- `normalizeQuickfillSectionOrderFromValueText(raw)` 162–189 — merge saved order with canonical `SECTIONS`; missing ids land after their `SECTION_INSERT_AFTER` anchor, else at the tail (drift-tolerant).
- `parseQuickfillSectionBannersFromValueText(raw)` 191–207 — validated record, trims + caps at 800 chars.
- `capQuickfillBannerText(s)` 209–213.
- `effectiveQuickfillSectionBanner(sectionId, banners)` 216–220 — stored custom banner wins, else `defaultQuickfillSectionBanner(sectionId)` from lib (every section has a default question since v2.2189).
- `getButtonColor(markedAt)` 224–230 — freshness palette: red >30h, yellow >12h, green ≤12h, red when never marked.
- `formatRelativeTime(iso)` 254–264 (jump-grid title + round count line), `formatTime(iso)` 266–268, `hoursUntilExpand(markedAt)` 270–273 (ceil-to-tenth hours until the 12h auto-expand), `formatHeaderLastMarked(iso)` 275–290 (uses `APP_CALENDAR_TZ`) — the last three are used only by the wrapper.

Precedent: `markStampInitial`/`markStampTime` in [`lib/quickfillMarkStamp.ts`](../src/lib/quickfillMarkStamp.ts), `matchesQuickfillSectionSearch` in [`lib/quickfillSectionSearch.ts`](../src/lib/quickfillSectionSearch.ts), and six tested kernels under [`lib/quickfill/`](../src/lib/quickfill/) — these ten helpers are the same shape and should join them. **The 12h / 30h thresholds now exist in five spots across three files** (`getButtonColor` + `isCollapsed` + `hoursUntilExpand` here, `freshnessBucket` in `lib/quickfill/freshnessSummary.ts`, `ROUND_FRESH_HOURS` / `ROUND_FLAT_DUE_HOURS` in `lib/quickfill/round.ts`) — the Stage-A move should import one set.

### Layout settings engine (app_settings)

- **Owned state:** `hiddenSectionIds` 530 (Set), `jobsBillingMinHcp` 532, `sectionOrderIds` 546, `sectionBanners` 547, `sectionBannerDrafts` 548 (uncommitted input text), `layoutSettingsLoaded` 525 (station deep links and the phone round wait on it). Not here: `activeSectionsPanelOpen` 531 is the dev panel's own open toggle (read and written only in the panel JSX 1999–2056) — it moves with `QuickfillDevSectionsPanel`.
- **Handlers:** `persistHiddenSectionIds` 552–565, `persistJobsBillingMinHcp` 567–580, `persistSectionOrder` 582–595, `persistSectionBanners` 597–610 (all `useCallback`, all `app_settings.upsert` `onConflict: 'key'` via `withSupabaseRetry`, errors to console); `isSectionVisible` 672–674; `devSetSectionVisible` 676–688 (local toggle; persists only when `role === 'dev'`, via `queueMicrotask`); `onBannerDraftChange` 815–817 / `onBannerCommit` 819–834 (caps, deletes empty keys, persists); `onQuickfillSectionDragEnd` 836–854 (dnd-kit `arrayMove`, dev-gated, persists via `queueMicrotask`); `quickfillSectionDragSensors` 813 (PointerSensor, 8px activation).
- **Effects:** mount effect 612–664 loads all four keys in one `app_settings.select('key, value_text, value_num').in('key', […])`, fans out through the parse helpers, then sets `layoutSettingsLoaded` (also on error). **No realtime** — the comment at 666–670 records that `app_settings` is not in the `supabase_realtime` publication and the old `postgres_changes` listener was a dead no-op (removed, v2.560). Keep it removed.
- **Supabase tables:** `app_settings` (SELECT + UPSERT ×4 keys). Org-wide — the dev panel edits affect **everyone**.
- **Extraction:** low risk. Seam: `useQuickfillLayoutSettings()` returning `{ hiddenSectionIds, sectionOrderIds, sectionBanners, sectionBannerDrafts, jobsBillingMinHcp, layoutSettingsLoaded, … setters/persisters }`. Note `jobsBillingMinHcp` also feeds `useQuickfillCompleteNoBillJobs(jobsBillingMinHcp)` at 533 — the hook must return before that call. Parse helpers go to lib first (Stage A).

### Mark / collapse system (the page's core mechanic)

- **Owned state:** `sectionMarks` 497 (`Record<string, { marked_at, marked_by?, marked_by_name? }>`), `forceExpandedSections` 523 (**initialized to `new Set(['cant-reach'])`**), `dockHiddenThisVisit` 528 (session-only, deliberately NOT derived from persisted marks — chips return on reload), `markHistoryModal` 545 (`{ sectionId, label } | null`).
- **Handlers:** `loadSectionMarks()` 856–870 — `quickfill_section_marks.select('section_id, marked_at, marked_by, users!quickfill_section_marks_marked_by_fkey(name)')`, mount effect 872–874; `markSectionUpToDate(sectionId, options?: { noteText? })` 876–915 — snapshots `outstanding_count` from `getOutstandingCount(sectionId)` (metrics context), trims/caps the note at `MARK_EVENT_NOTE_MAX_CHARS`, UPSERTs `quickfill_section_marks` (`onConflict: 'section_id'`; silent return on error), clears force-expand, adds to `dockHiddenThisVisit`, reloads marks, then INSERTs a `quickfill_section_mark_events` row (failure → warning toast); `openSectionNow(sectionId)` 918–926 — re-expand + restore dock chip; `isCollapsed(sectionId)` 928–933 — marked <12h ago.
- **Supabase tables:** `quickfill_section_marks` (SELECT w/ `users` FK join, UPSERT), `quickfill_section_mark_events` (INSERT here; SELECT by the round effect 1721–1737 and by the extracted `QuickfillSectionMarkHistoryModal`).
- **Coupling:** read by all 31 `QuickfillSectionWrapper` calls, the jump grid, the dock filter, `freshnessLine`, `roundRowsValue` and the round events effect (refetch on every marks change); written by the wrappers, by `roundLooked` (phone "Looked"), and by three child sections that render their **own** mark buttons (`QuickfillEmailSection`, `QuickfillTextsSection`, `QuickfillPhysicalInboxSection`) via `onConfirmMark={(note) => markSectionUpToDate(id, { noteText: note })}` + a `markButtonPalette` from `getButtonColor`/`BUTTON_BG`/`BUTTON_BORDER`.
- **Extraction:** seam `useQuickfillSectionMarks()` returning `{ sectionMarks, markSectionUpToDate, openSectionNow, isCollapsed, forceExpandedSections, dockHiddenThisVisit, markHistoryModal, setMarkHistoryModal }`. It must keep taking `getOutstandingCount` from `QuickfillSectionMetricsContext` (already extracted). Medium risk purely from fan-out; the logic itself is simple.

### Close-week chip (v2.2898, journey-map Tier-2 #18)

- **Owned state:** `closeWeekMonday` 503 (memo, `previousCompleteCloseWeekMonday()`), `closeWeekCounts` 504 (`MoneyfillQueueCount[] | null`).
- **Effect 505–518:** only for `canOpenMoneyfill(role)`: `fetchWeekCloseCounts(closeWeekMonday, authUser?.id)` — the same counts Moneyfill's header and the report's confidence footer use; failures leave the chip at "…".
- **Handlers:** `closeWeekFor(sectionId)` 519–520 → `closeWeekChipModel(sectionId, counts, monday, role)`; `onCloseWeekOpen(sectionId)` 521–522 → `recordNavClick(…, WEEK_CLOSE_OPENED_CONTROL, weekCloseOpenedTarget('station-chip', …))`.
- **Consumers:** four cases pass `closeWeek` + `onCloseWeekOpen` to the wrapper — `people-hours-new`, `unassigned-field-time`, `banking-sorting`, `supply-houses`; `CloseWeekChip` (2099–2135, presentational: inert `<span>` for non-money roles, `<Link>` into Moneyfill otherwise) renders at 2262, 2359, 2425.
- **Tests:** `lib/quickfill/closeWeekChip.test.ts`, `lib/moneyfillWeekClose.test.ts`, `lib/closeWeekAnchor.test.ts`; the wiring is untested. No money math is computed in this file.
- **Extraction:** `useCloseWeekChips(role, authUserId)` returning `{ closeWeekFor, onCloseWeekOpen }`; `CloseWeekChip` moves with the wrapper.

### Eligibility + search + ordered render list

- **Derived:** `warningsSectionEligible` 693–695 (dev / master_technician / assistant-like — also gates `lost-bid-reasons`, `gc-weekly-review`, `job-followups`, `needs-you`), `canAccessProspects` 706–714 (dev/master_technician/assistant/controller, or estimator with `estimatorProspectsAccess`), `sectionWouldRenderOnPage(sectionId)` 729–783 (**role/feature-only, never count-gated — documented exception: `cant-reach` IS count-gated**; `banking-sorting` → `canAccessBanking(role)` (v2.3305); `schedule`/`tomorrow-schedule` → `CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES` imported under the alias `CAN_USE_SCHEDULE_DISPATCH_FOR_QUICKFILL_SCHEDULE`; `unpriced-fixtures` / `undated-bills` / `difficult-people` / `assistant-dailys` / `unassigned-field-time` / `vehicle-odometers` → dev / master_technician / assistant-like), `orderedSections` 785–788, `hasAnyVisibleSection` 790, `sectionPassesSearch` 792–796 (via `matchesQuickfillSectionSearch`), `searchedSections` 802–808 (eligibility ∩ search — drives blocks, first-divider, dock; **the jump grid stays unfiltered by search**), `noSectionsMatchSearch` 809, `firstVisibleSectionId` 811.
- **Owned state:** `sectionSearch` 529.
- **Stays in parent** — this is the page's routing-equivalent. It reads `fetchEnabled`/`loading`/`prospects` off four section hooks (`useQuickfillCantReachProspects`, `useQuickfillCompleteNoBillJobs`, `useQuickfillStagesJobsWithoutCustomer`, `useDispatchInbox.dispatchInboxEligible`), so those hooks keep living at page level. The station deep-link effect, the jump grid (1838), `freshnessLine` and the round also call `sectionWouldRenderOnPage`.

### Per-section wiring switch — `quickfillSectionBlock(meta)` 974–1703

730 lines, 31 `case`s, each returning `<QuickfillSectionWrapper …>` around a body. `withTopDivider` = not the first searched section; `bannerText` = `effectiveQuickfillSectionBanner`. Per-case variations worth preserving verbatim:

- `my-inbox` 1034–1058: per-user — no mark/collapse/history/stamp (`omitDefaultMarkButton`, `showOutstandingInHeader={false}`, `showMarkHistoryButton={false}`, `showLastMarked={false}`, no-op handlers); neutral jump chip.
- `office-arriving` / `office-leaving`: one body, `QuickfillOfficeSection variant="arriving"|"leaving"`.
- `schedule` 1582–1601 / `tomorrow-schedule` 1602–1623: `showOutstandingInHeader={false}`, `showMarkHistoryButton={false}`; schedule renders `<QuickfillScheduleSection hideConflictPrompt />`, tomorrow renders `QuickfillTomorrowsScheduleSection`.
- `email-inbox` 1624–1649 / `texts` 1650–1674 / `physical-inbox` 1675–1699: `omitDefaultMarkButton` + `onMarkUpToDate={() => undefined}`; the child owns the (note-first) mark button.
- `dispatch-inbox` 1522–1581: a fragment — `QuickfillMetricReporter` **beside** the wrapper (v2.2896: a collapsed desktop strip never mounts children), then `DispatchInboxSection variant="embedded"` with 23 props threaded from the 19-field `useDispatchInbox()` destructure (440–460) — requests, notes, drafts, dismiss, `prioritySavingId`/`onSetPriority`/`onLogCall`, `onLinkJobPictures` via `useJobFormModal().openEditJob(jobId, { jobPicturesLinkHighlight: true })`, role-gated `onCreateTripCharge` → `setTripChargeTarget`, `onOpenDismissedArchive` → `setDispatchDismissedModalOpen(true)`.
- Money stations (`people-hours-new`, `unassigned-field-time`, `banking-sorting`, `supply-houses`): add `closeWeek` / `onCloseWeekOpen`. `supply-houses` 1379–1398 wraps `SupplyHousesSection`, a 5-line shim around the Materials page's `<SupplyHousesTab showTitle={false} />` (`src/components/SupplyHousesTab.tsx`, 1,898 lines, self-loading), which reports the station's count (houses 60+ days past due) from inside the body (`SupplyHousesTab.tsx` 595–599) — so, like the in-wrapper reporters below, its header count goes dark while the desktop strip is collapsed.
- `jobs-billing` 1399–1416: `minHcpNumber={jobsBillingMinHcp}`.
- `cant-reach` / `complete-no-bill` / `no-customer-stages`: bodies receive hook data as props (hooks stay in parent because eligibility + metrics read them); their metrics report from page level via `useReportQuickfillSectionMetric` at 486–490, 534–538, 540–544 (`no-customer-stages` reports the union of three job lists, memo 473–485).
- In-wrapper `QuickfillMetricReporter` (300–311, 12-line component wrapping `useReportQuickfillSectionMetric`) mounts for `warnings`, `lost-bid-reasons`, `gc-weekly-review`, `job-followups`, `needs-you`, `unpriced-fixtures` — **inside** the wrapper, so their header count reads "—" while the desktop strip is collapsed (see quirk 18).

**Approach:** leave the switch. Each case is a thin wrapper; converting to a config-driven registry would be a redesign, not a move. It shrinks naturally as the mark/layout hooks make its inputs one destructure.

### Inline station bodies (warnings + the nudge stations)

- **`warnings` 979–1015:** `QuickfillMetricReporter` (reports the stale-tally **transaction** count) + `DashboardTallyStaleStaffBanner` (opens `DashboardStaleTallyStaffFollowUpModal` via `warningsModalOpen` 496) + the modal (`onDataChanged` → `refetchStaleTallyStaffFollowUp`). Data: `useStaleTallyStaffFollowUp(TALLY_STALE_MIN_AGE_DAYS)` 491–495. The AR-bank-unallocated banner and its synthetic `ar-bank-unallocated` metric left in v2.2189 (now a Jobs Cleanup card).
- **Nudge stations (v2.2347)** reuse the Dashboard cards: `lost-bid-reasons` 1221–1247 (`useLostBidNudge(warningsSectionEligible)` 701 → `DashboardLostBidsMissingReasonBanner`, call mode → `/bids?tab=why-we-lost`); `gc-weekly-review` 1248–1270 (`DashboardGcReviewWeeklyBanner onCount={setGcReviewRemaining}`); `job-followups` 1271–1293 (`DashboardJobFollowupsBanner onCount={setJobFollowupsCount}`). Wrappers always render for eligible roles; the cards self-hide at zero.
- **`needs-you` 1294–1323 (v2.2350, journey-map #40):** `QuickfillNeedsYouSection onCount={setNeedsYouSectionCount}` + `dispatchAged` (memo 466–472, `summarizeOpenDispatchAging(dispatchRequests, DISPATCH_REQUESTS_MIN_AGE_DAYS)` from the inbox rows the page already holds) + `onOpenDispatchInbox` (`openSectionNow('dispatch-inbox')` + scroll).
- **Page-held counts:** `jobFollowupsCount` 702, `gcReviewRemaining` 703, `needsYouSectionCount` 704 — written only through the children's `onCount` props, read only by the sibling reporter.
- **Extraction:** low risk → `QuickfillWarningsSection` (owns `warningsModalOpen`; the stale-tally counts + `refetch` come in as props) and a `QuickfillNudgeStation` per card owning its count state + reporter. Moving a page-level hook (`useStaleTallyStaffFollowUp`, `useLostBidNudge`, `useUnpricedFixturesCount`) into a body changes **when it fetches** (bodies unmount on a collapsed desktop strip) — keep the hooks at page level unless that change is intended.

### Station deep links (v2.2890, journey-map Tier-2 #17)

`/quickfill#<sectionId>` (also `#quickfill-<sectionId>` and `?station=<sectionId>`) is the page's one address form; build it with `quickfillStationHref(sectionId)` from [`src/lib/quickfill/stationDeepLink.ts`](../src/lib/quickfill/stationDeepLink.ts) — never a bare `navigate('/quickfill')`. Resolution is the pure kernel `resolveQuickfillStation(location, SECTIONS, sectionWouldRenderOnPage)` → `{ found, hidden, domId }`; the page effect 947–972 (key `stationRequestKey` 944, refs `appliedStationKeyRef` 945 / `stationPollTokenRef` 946) waits for `layoutSettingsLoaded`, applies once per URL, calls `openSectionNow(sectionId)` and polls ≤4s for the element before `scrollIntoView`. Hidden / role-gated / unknown → toast "That section isn't on your Quickfill." and nothing else (a forced render must never resurrect a hidden section). Telemetry: `recordNavClick(…, 'station_deep_link', '#<station> found|hidden|unknown')` into `ui_nav_clicks`. On phones the same address also selects the round screen (`parseQuickfillStationRequest` at 1752); the round's own navigation (`goRound`) writes it.

### Phone round (v2.3783, punch list #30 PR 3)

- **Owned state:** `roundEvents` 1718 (`RoundEvent[]`), `roundSearch` 1719 (written via `QuickfillRoundList onSearch`), `roundMarking` 1720.
- **Effect 1721–1737 (phone only):** `quickfill_section_mark_events.select('section_id, marked_at, outstanding_count')`, last 60 days, newest first, `limit(2000)`; refetched on every `sectionMarks` change.
- **Derived:** `roundNow` 1738 (memo keyed on marks/events, eslint-disabled), `roundRowsValue` 1739–1751 (`roundRows(eligible sections → { personal: QUICKFILL_PERSONAL_SECTIONS, needsNote: QUICKFILL_NOTE_FIRST_SECTIONS }, sectionMarks, roundEvents, getOutstandingCount, roundNow)`), `roundMeta` 1753 (station id that exists AND is eligible), `roundActive` 1754 (`narrowViewport && layoutSettingsLoaded`), `roundQueueIds` / `roundPosition` 1755–1756.
- **Handlers:** `goRound` 1757 (`navigate(quickfillStationHref(id))` or `/quickfill`), `roundSkip` 1758 (`nextInRound`), `roundLooked` 1759–1768 (`markSectionUpToDate` with no note, then next — the screen only offers it for non-personal, non-note-first sections).
- **Render 1778–1810:** `QuickfillRoundScreenContext.Provider value={roundMeta != null}` → either `QuickfillRoundScreen` (label, position, banner question, count line built inline from `getOutstandingCount` + `formatRelativeTime`, `onHistory` → `setMarkHistoryModal`) wrapping `quickfillSectionBlock(roundMeta)`, or the `QuickfillRoundList`. The wrapper reads the context and returns body-only `<div id={id}>` (2187–2188).
- **Counts in list mode:** no section bodies mount, so only the three page-level reporters give live counts; every other row falls back to its last mark event's `outstanding_count` (`countSource: 'last_look'`).
- **Extraction:** `useQuickfillRound({ narrowViewport, layoutSettingsLoaded, orderedSections, sectionWouldRenderOnPage, sectionMarks, markSectionUpToDate, getOutstandingCount })` — after the marks hook; the render branch can become `QuickfillRoundView`. Low-med risk (navigation + marking).

### `QuickfillSectionWrapper` (+ `CloseWeekChip`, `QuickfillSectionHistoryIcon`)

- **Location:** module-level components 2083–2476 (394 lines; wrapper alone 2137–2476, 340).
- **Inputs:** fully prop-driven (`id`, `sectionId`, `label`, `withTopDivider`, `bannerText`, `color`, `collapsed`, `mark`, `omitDefaultMarkButton`, `showOutstandingInHeader`, `showMarkHistoryButton`, `showLastMarked`, `closeWeek`, `onCloseWeekOpen`, `onMarkUpToDate`, `onOpenNow`, `onOpenHistory`, `children`). Internal deps: `useQuickfillSectionMetric(sectionId)` 2182 → `quickfillOutstandingLabel(metric)` (lib, tested), `useNarrowViewport640()` 2184, `useContext(QuickfillRoundScreenContext)` 2187.
- **Behavior:** inside a round screen → body only (2188). Desktop-collapsed (2193–2307) → slim green strip (title + "Marked HH:MM by NAME · Reloads in X.Xh" + close-week chip + history + "Open now"; **children not mounted**). Expanded (2309–2475) → header (`QUICKFILL_SECTION_TITLE_STYLE` h2, "N open" column 2327–2353, "Last marked:" stamp, close-week chip, "✓ Mark" button 2363–2382 (v2.2184), history 2383–2404), optional amber `role="note"` banner (`QUICKFILL_SECTION_BANNER_BOX_STYLE`) 2447–2451, children, foot "Mark … up to date!" button 2453–2471 — both mark buttons colored by the freshness palette. The `collapsed ?` true branch 2406–2444 is the old narrow layout — unreachable since v2.3783 (phones never render the wrapper outside a round screen); its else 2445–2472 is the live expanded body.
- **Extraction:** **cheapest, highest-leverage move on the page** — verbatim move to `src/components/quickfill/QuickfillSectionWrapper.tsx` with `CloseWeekChip` + the icon, after Stage A moves `ButtonColor`/`BUTTON_BG`/`BUTTON_BORDER`/`formatTime`/`hoursUntilExpand`/`formatHeaderLastMarked`/`QUICKFILL_SECTION_TITLE_STYLE` to lib so the page's jump grid and the three child mark buttons import the same palette.

### Page chrome + page-level modals (stays)

Desktop branch 1811–2058 (phones render `null` here): `SectionDock` 1813 (only when >1 chip; hides `dockHiddenThisVisit`; page adds `paddingBottom: '4.5rem'`), h1, jump-button grid 1815–1903 (unfiltered by search; per-chip freshness color, `markStampInitial`/`markStampTime` stamp inside the chip, `scrollIntoView` on click; `my-inbox` neutral), search input + "open = …" legend 1907–1955 (v2.2189), empty states 1956–1995, `searchedSections.map(quickfillSectionBlock)` 1996–1998, dev panel 1999–2056. Page-level modals 2059–2078: `QuickfillSectionMarkHistoryModal` (from any header or round screen), `DispatchDismissedItemsModal` (`dispatchDismissedModalOpen` 549, set by dispatch-inbox's `onOpenDismissedArchive`; gated `authUser?.id && dispatchInboxEligible`; `loadRows={fetchDismissedDispatchInboxRows}`), `CreateTripChargeModal` (`tripChargeTarget` 550, set from dispatch-inbox). All stay — modals are opened from section wiring, and the grid/dock read the whole mark map.

---

## `QuickfillScheduleSection.tsx` region dossiers

**Hosts (both live prop modes must survive any refactor):**

1. `Quickfill.tsx` `case 'schedule'` → `<QuickfillScheduleSection hideConflictPrompt />` — nav row below the search row, no Subs strip, no visible-hours control (the settings modal is unreachable here; a stored window still trims the rail).
2. [`ScheduleDispatchHub.tsx`](../src/components/schedule/ScheduleDispatchHub.tsx) Day tab (3996–4002) → `<QuickfillScheduleSection hideConflictPrompt initialWorkDateYmd={dayTabWorkDateYmd} onBlocksSaved={onDayScheduleChanged} showDaySettings onDaySettingsApiChange={setDaySettingsApi} />`.
3. Not a host: Quickfill's `tomorrow-schedule` renders `QuickfillTomorrowsScheduleSection` (50 lines) → `ScheduleDispatchHubPage variant="tomorrow"`, which hides the hub's tab bar and pins its local tab to People (effect 238–243 in `ScheduleDispatchHubPage.tsx`), so the Day tab — and this section — never mounts there. (The `initialWorkDateYmd` JSDoc at 138 still says "Quickfill tomorrow"; it is stale.)

Props (130–151, 5): `hideConflictPrompt` (suppress the built-in `SCHEDULE_CONFLICTS_DEFAULT_PROMPT` 109 banner — every host passes it), `initialWorkDateYmd` (synced into `workDate` by effect 173–175), `onBlocksSaved` (host cache refresh after ANY block write — dot autosave, separation, reorder, add-block; mirrored into `onBlocksSavedRef` 191 for the unmount flush), `showDaySettings` (Day tab: nav row renders ABOVE the banner + `<SubsOnSiteForDay dayKey={workDate} />` 1447, and enables the host-API effect), `onDaySettingsApiChange` (v2.1243: reports `{ open, windowLabel, dispatchHref }` — null on unmount — so the hub's ⋯ menu shows "Visible hours…"; the inline gear is gone).

Header (152–165): `useNavigate`, `agendaMode = useNarrowViewport640()` 154 (phone agenda rows, v2.1352), `useAuth`, `useToastContext`, `useJobFormModal()` 160 (null outside the provider — then no "Create new job"), `useLedgerPrefixMap()` 161. Role gates: `canEditSchedule = CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES.has(role)` 162 (dots, add, reorder); `showClockStripScopeToggle` 163–164 (dev/master_technician/assistant-like; also `allowNcnsFromMyTime`); `showStripSubjectMyTimeEditor` 165 (those + superintendent). Reports a **null** metric at 722: `useReportQuickfillSectionMetric('schedule', null, false)`.

### Day data engine (the section's substrate)

- **Owned state:** `workDate` 170 (init `initialWorkDateYmd` else `denverCalendarDayKey(Date.now())`), `loading` 176, `userIds` 177, `nameById` 178, `blocksByUserId` 179 (`Map<userId, JobScheduleBlockRow[]>`, sorted by `time_start`), `jobTitleById` 481, `bidTitleById` 482, `sessionsByUserId` 483, `roleByUserId` 486, `hubJobsForPicker` 489 (`ScheduleDispatchHubJobRow[]`).
- **Loader:** `loadData({ quiet? })` 770–893 — parallel `fetchUsersTabRosterForScheduleDispatchHub(role === 'dev')` + `fetchJobsLedgerForScheduleDispatchHub()`, then `fetchUserNamesForIds(ids)`, `fetchScheduleBlocksForAssigneesOnDay(ids, workDate)`, a direct `clock_sessions` SELECT (`.in('user_id', ids).eq('work_date', workDate).is('rejected_at', null).is('revoked_at', null)`), and `fetchBidTitlesForScheduleBlocks(collectScheduledBidIds(blockRows, sessionRows), ledgerPrefixMap)` — bids people are **scheduled** on and **clocked** on (v2.2901). `jobTitleById` is set first (job titles via `scheduleBlockTitle({ kind: 'job', … clickNumber })`, so the picker can paint) and re-set as `addBidAnchorTitles(jMap, bidMap)` so `bid:<id>` anchors resolve to `Bid visit · <title>`. `quiet: true` (all post-write reloads + realtime) skips the loading flag. Roster error / thrown error resets six caches (`userIds`, `roleByUserId`, `blocksByUserId`, `sessionsByUserId`, `bidTitleById`, `hubJobsForPicker`).
- **Effects:** load 1226–1228 (`[loadData]` — re-runs on `workDate`, `role`, `ledgerPrefixMap` change). **Realtime** 1230–1244: `useRealtimeChannel(true, 'quickfill-schedule-blocks-${workDate}', [{ event: '*', table: 'job_schedule_blocks', filter: 'work_date=eq.${workDate}' }], → loadData({ quiet }), { debounceMs: 400 })`.
- **Supabase (direct + via libs):** `clock_sessions` (direct SELECT), `job_schedule_blocks` (SELECT via `fetchScheduleBlocksForAssigneesOnDay`; UPDATE via `updateJobScheduleBlock`; INSERT via `saveNewScheduleBlockForPersonDay`), `bids` + `users` + `jobs_ledger` (via `scheduleDispatchHub.ts` fetchers), `jobs_ledger` + `address_geocodes` (travel region, direct), time-off tables via `recordNotComingInForUserAsStaff`. Edge function: `geocode-address-batch`.
- **Extraction seam:** `useQuickfillScheduleDay({ workDate, role, ledgerPrefixMap })` returning the caches + `loadData` (+ the realtime channel). Every other region consumes it. Build this **before** moving dot-drag or add-block. The same bid-title pipeline (`collectScheduledBidIds` → `fetchBidTitlesForScheduleBlocks` → `addBidAnchorTitles`) also runs in `usePersonDay/Week/MonthScheduleData`.

### Dot-drag autosave (highest-risk region)

- **Owned state/refs:** `dotDraft` 181–184 (`{ userId, updates: Map<blockId, { startMin, endMin }> } | null`) + `dotDraftRef` 186 (synced by effect 187–189 — **and written synchronously inside `handleDotDrag` so the same-tick pointerup sees it**), `dotSaving` 185, `onBlocksSavedRef` 191 (+ effect 192–194), `DOT_AUTOSAVE_DEBOUNCE_MS = 2000` 196, `dotSaveTimerRef` 197.
- **Handlers:** `effectiveRowsForUser(userId)` 912–924 (base rows with the live draft overlaid), `rowsToDotBlocks` 926–931 (plain function), `boundaryDotsForUser` 939–960 (**dot identity from BASE rows for the whole gesture; only positions from the draft** — otherwise a drag onto a neighbor flips the dot to `shared` mid-drag and unmounts the pointer-capture element), `persistDotDraft` 963–992 (sequential `updateJobScheduleBlock` per changed block, break on first error, quiet reload, `onBlocksSaved?.()`), `flushPendingDotSave` 994–1001, `scheduleDotSave` 1004–1011 (2s debounce), `handleDotDrag` 1036–1060 (touching a different user's dot flushes the pending draft first; merges via `resolveDotDrag` from [`lib/dayScheduleDotDrag.ts`](../src/lib/dayScheduleDotDrag.ts)), `handleDotDragEnd` 1062–1069 → `scheduleDotSave`, `handleSharedDotSeparate` 1071–1098 (`separateSharedDot`; toast "Cannot separate — the later job is already at the 30-minute minimum." on null).
- **Unmount flush effect 1014–1034:** clears the timer and, if a draft has updates, fires the writes without awaiting UI, then `onBlocksSavedRef.current?.()` — pending edits must not be lost when the section unmounts (hub tab switch).
- **Pure logic:** extracted + tested — `boundaryDotsFromBlocks`, `resolveDotDrag`, `separateSharedDot`, `dotMinutesToPgTime`. The orchestration (debounce, cross-user flush, unmount flush) has **no test**.
- **Extraction:** `useDayScheduleDotDrag({ blocksByUserId, reload, onBlocksSaved })`. **High risk**: the ref-synchronization discipline, the cross-user flush and the unmount flush are timing-sensitive; move verbatim with the comments, never "simplify" the ref writes into state.

### Travel hints + geocode self-heal

- **Owned state/refs:** `jobCoordsByJobId` 260 (`ReadonlyMap<jobId, LatLng>`), `travelConfig` 264 (`TravelHintsConfig`; effect 265–278 loads it and reloads on the `TRAVEL_HINTS_CONFIG_CHANGED_EVENT` window event), `geocodeFill` 289 (`{ running, failures[] }`), `geocodeAttemptedKeysRef` 293 (once-per-address-per-page-load guard), `routedByPairKey` 388 (`ReadonlyMap<pairKey, TravelEstimate>`).
- **Derived:** `travelJobIdsKey` 279–284 (sorted-joined job ids, bid-anchored blocks skipped; `''` when hints disabled — the effect key).
- **Effects:** coords 294–385 — `jobs_ledger.select('id, job_address')` for the day's job ids → `normalizeAddressForGeocodeKey` → cached `address_geocodes` lookup in `batchGeocodeCacheKeys` batches → **self-healing fill (v2.932)**: missing keys geocoded via `supabase.functions.invoke('geocode-address-batch')` in chunks of 20, failures listed in an amber status line (1453–1467, hover detail); routed 391–421 — Option B: consecutive different-job pairs per user (null job ids skipped) → `fetchRoutedTravelTimes`; empty map = straight-line fallback.
- **Handler:** `travelUiForUser(userId, rows)` 424–480 — gap chips (`≥`/`~` prefix by estimate source, `severity: 'ok' | 'tight'` by `g.feasible`) and red shared-dot warnings where `estimate.minutes >= TRAVEL_TOUCHING_WARN_MINUTES`, via `buildDayTravelGaps` from [`lib/jobTravelEstimate.ts`](../src/lib/jobTravelEstimate.ts) (tested).
- **Extraction:** `useDayTravelHints({ blocksByUserId })` — self-contained given the blocks cache; low-med risk. Stage A: the chip/warning body of `travelUiForUser` → `lib/quickfillScheduleTravelUi.ts` + test.

### Add-block + job picker cluster

- **Owned state (12):** `cellAddContext` 490 (`{ assigneeUserId, workDate } | null`), `assignJobPickerOpen` 491, `assignJobPickerSearch` 492, `assignJobPickerNumberQuery` 493 ("#" number-only search, v2.1375), `blockModalState` 494 (`QuickfillBlockModalState` 128 = `{ kind: 'add', assigneeUserId, workDate, jobId }`), `addBlockTimelineSegments` 498, `addBlockDraftByBlockId` 499 (neighbor-block edits made inside the modal), `addTimeStart`/`addTimeEnd` 502–503 (`'08:00'`/`'16:00'`), `addNote` 504, `addError` 505, `addSaving` 506.
- **Derived memos:** `quickfillOrderedSessionJobLedgerIds` 619–631 (unique `job_ledger_id`s from the person's clock sessions, first-clock-in order), `quickfillSessionJobOrderIndex` 633–637, `quickfillPickerJobsSorted` 639–654 (session-today jobs first in session order, then `hcp_number` descending numeric), `quickfillAssignJobPickerRows` 656–678 (digits → `findJobsByNumber`, else text filter on hcp/name/title; `sessionToday` flag), `quickfillCellChoiceSubtitle` 680–684, `quickfillAssignJobPickerSubtitle` 686–693 (ReactNode), `blockModalPersonLabel` 695–698, `blockModalJobTitle` 700–703, `addBlockModalTimeline` 705–712.
- **Handlers:** `closeQuickfillAddBlock` 565–570, `closeQuickfillJobPicker` 572–577, `openQuickfillAddBlock` 579–616 (closes picker, builds sorted `AddBlockTimelineSegment[]` with `bid:` anchors, seeds times via `defaultNewBlockRangeInFirstGap` else 08:00–16:00), `onCreateNewJobFromQuickfillPicker` 898–909 (v2.2909: `jobFormModal.openNewJob({ onCreatedJobId })` → quiet reload → `openQuickfillAddBlock` for the same person/day), `saveQuickfillBlockModal` 1168–1202 → [`saveNewScheduleBlockForPersonDay`](../src/lib/scheduleDispatchAddBlockSave.ts) (new block + neighbor drafts) → toast, quiet reload, `onBlocksSaved`. The person-row "+" (1644–1653) opens the picker inline. Effect 714–720: a `workDate` change closes both modals and resets picker state.
- **Sub-components (extracted):** `ScheduleDispatchAssignJobPickerModal` 1679–1697, `ScheduleDispatchAddBlockModal` 1715–1732 (shared with Schedule Dispatch; render test exists).
- **Extraction:** medium — reads `blocksByUserId`, `sessionsByUserId`, `hubJobsForPicker`, `jobTitleById`, `nameById`. Extract after the seam as `useQuickfillAddBlock` or a `QuickfillAddBlockFlow` component. Stage A: the picker sort/filter is **duplicated** under the same names in `userReview/UserDayScheduleSection.tsx` (~353–390); `ScheduleDispatchHubPage.tsx` `hubAssignJobPickerRows` (~1628) is a variant (finished-last, address/customer fields) → one `lib/scheduleJobPicker.ts` + tests.

### Reorder-day

- **Owned state:** `reorderUserId` 495, `reorderSaving` 496, `reorderError` 497.
- **Handler:** `saveReorderedDay(newOrderedIds)` 1102–1166 — diff via [`reorderDayScheduleBlocks`](../src/lib/reorderDayScheduleBlocks.ts) (tested; throws → "The job list changed — close and reopen to reorder."), then sequential `updateJobScheduleBlock` per change, and for any changed block with a `shared_block_group_id`, **shifts every other assignee's leg of that group by the same minute delta** (`reorderTimeToMinutes`/`reorderMinutesToTime`). Aborts on first error (partial writes possible — the error path skips the quiet reload and `onBlocksSaved`; only the realtime channel reconciles). On success: toast "Day reordered", quiet reload, `onBlocksSaved`.
- **Sub-component:** `ReorderDayBlocksModal` 1698–1714 (extracted; `linked: r.shared_block_group_id != null`; bid rows labeled via `scheduleBlockTitle({ kind: 'bid' })`). Opened from the row's reorder button when `canEditSchedule && rows.length >= 2`.
- **Extraction:** small; moves with or after the seam. The leg-shift loop is untested.

### Day rail window + settings modal (extract first)

- **Owned state:** `dayRailWindow` 201–215 (`{ startMin, endMin } | null`; lazy-init from localStorage `pipetooling_dispatch_day_rail_window_v1` (`DAY_RAIL_WINDOW_STORAGE_KEY` 200); invalid/<60 min/full-day → null), `daySettingsOpen` 216, `daySettingsDraftStart`/`daySettingsDraftEnd` 217–218.
- **Derived:** `dayRailTrimWindow` 219–228 (`{ loSlotIndex, hiSlotIndex }` in 30-min slots — also filters the orientation marks), `dayWindowChoices` 248–252 (30-min steps across `MIN_MIN`–`MAX_MIN`, 04:00–20:00).
- **Handlers:** `openDaySettings` 229–233, `saveDaySettings` 234–246 (full window saves as **null** / removes the key; localStorage failures swallowed).
- **Host API effect 735–745:** when `onDaySettingsApiChange && showDaySettings`, reports `{ open: openDaySettings, windowLabel, dispatchHref: scheduleDispatchHref }`; cleanup reports null. This is the only way to open the modal.
- **Render:** inline `role="dialog"` modal 1733–1861 (129 lines) — per-device setting, min 60-minute window (start select clamps end to ≥ start+60), "Reset to full day (4 AM–8 PM)".
- **Extraction:** **lowest risk in the file** — `DispatchDayVisibleHoursModal` + `useDayRailWindow({ showDaySettings, onDaySettingsApiChange, scheduleDispatchHref })` (localStorage parse/serialize is Stage-A testable). The hub render smoke (`Day view registers Visible hours into the ⋯ menu`) guards the registration.

### Day nav rows (header)

- **Derived/locals:** `dayLabel` 724–727 (`formatDenverCalendarDayWithWeekdayAndYear`), `scheduleDispatchHref` 729–732 (`/schedule-dispatch?week=…&day=…` via `companyWeekStartSundayContaining`), `isTodaySelected` / `compactDayLabel` 1329–1330, `compactNavButtonStyle` 1331–1342.
- **`dayNavRow` 1247–1324** (JSX local): Previous/Next day (`ymdAddDays`), label, "Dispatch" link, conditional "Today" 1304–1320. **`compactDayNavRow` 1343–1442** (phone, v2.1356): chevrons, tap-date-for-Today, search + staff-filter toggles; `compactSearchOpen` 156 drives the collapsible search 1416–1440.
- **Placement:** with `showDaySettings` → above the banner (1446); otherwise below the search row (1530); `agendaMode` picks compact. The desktop search/hide row 1468–1529 renders only when `!agendaMode`.
- **Also here:** `openOccupiedBandOnScheduleDispatch` 747–756 (row band click → `/schedule-dispatch?jobId=…&week=…&day=…`).
- **Extraction:** low risk → `QuickfillScheduleDayNav` taking `{ workDate, setWorkDate, dayLabel, scheduleDispatchHref, compact, searchQuery, setSearchQuery, hideAssistantsEstimators, onToggleHide, showDispatchChip }` (~205 lines off the file).

### Roster filters + grouping

- **Owned state:** `searchQuery` 487, `hideAssistantsEstimators` 488 (lazy-init via `readHideAssistantsEstimatorsFromStorage` 113–120; persisted to `quickfill_schedule_hide_assistant_estimator` as `'1'`/`'0'` by `toggleHideAssistantsEstimators` 758–768). Both are also read and written by `compactDayNavRow` and the desktop search/hide row 1468–1529, so they stay in the component and go down to the nav as props.
- **Derived:** `sortedUsers` 508–512 (name-sorted, `'Unknown'` fallback), `rosterFilteredUsers` 515–521 (drops `isAssistantLike` + `estimator` when hidden), `filteredSortedUsers` 523–535 (person name OR any block-job title), `scheduleUsersByRoleSection` 537–540 (`groupRosterUsersByAuthRoleSection`, untested lib), `scheduleSecondaryByUserId` 542–556 (clock-session bands via `clockSessionsToDispatchSecondaryBands`, tested), `jobLabelsRecord`/`bidLabelsRecord` 558–559 (Map→Record for the My Time modal).
- **Extraction:** memos are Stage-A-able (`filterRosterBySearch` pure function + test); otherwise stays with the render core.

### My Time editor + Not-coming-in

- **Owned state:** `scheduleMyTimeEditor` 166–169 (`{ subjectUserId, subjectDisplayName } | null`).
- **Handlers:** `openMyTimeForSessionStrip` 561–563, `handleScheduleMarkNotComingIn` 1204–1224 → [`recordNotComingInForUserAsStaff`](../src/lib/notComingInTimeOff.ts) (tested; handles already-marked + salary-sync warnings), quiet reload.
- **Sub-component:** `DashboardMyTimeDayEditorModal` 1862–1882 (extracted, shared with Dashboard; `sessions={[]}` — it loads its own — plus `jobLabels`/`bidLabels`, `allowNcnsFromMyTime={showClockStripScopeToggle}`, `showMarkNotComingIn`).

### Render core (stays)

Return 1444–1884 (441): header placement + `SubsOnSiteForDay` (Day tab only, extracted, 62 lines, own render test) 1446–1447, built-in banner 1448–1452 (never rendered at `a05cef4c4` — every host passes `hideConflictPrompt`), geocode status 1453–1467, desktop search/hide row 1468–1529, loading / empty / roster 1531–1678 — orientation-marks header (`DISPATCH_ADD_BLOCK_ORIENTATION_MARKS` filtered by the trim window, positioned by `dispatchAddBlockTrackThumbLeftPct`; hidden in agenda mode) and the role-section loop 1596–1676 rendering [`QuickfillScheduleUserRow`](../src/components/schedule/QuickfillScheduleUserRow.tsx) (extracted, 613 lines, no render test; `agendaVariant={agendaMode}` switches to per-block time-chip rows at ≤640px) per person with `segments={blocksToSegments(rows, jobTitleById)}` (untested lib), secondary bands, boundary dots (edit roles + rows>0), travel chips/warnings, and add/reorder/my-time/`onOccupiedBandClick` callbacks; then the four modals 1679–1882.

---

## Shared substrate

**Quickfill.tsx has no shared record pointer** — nothing like Bids' `setSharedBid`; the only URL input is the station deep link (a section id, not a record). What IS shared, and what any extraction must be handed:

1. **`QuickfillSectionMetricsContext`** — the page's data-engine equivalent, **already extracted** (`QuickfillSectionMetricsProvider` mounted by the default export; sections push counts via `useReportQuickfillSectionMetric`, whose cleanup clears the count on unmount; the wrapper reads via `useQuickfillSectionMetric`; `markSectionUpToDate` snapshots `getOutstandingCount(sectionId)` into history rows; the round reads live counts through it). Extractions plug into this context, not into new props.
2. **The mark/collapse system** (`sectionMarks` + `markSectionUpToDate` + `isCollapsed` + `forceExpandedSections` + `dockHiddenThisVisit` + `markHistoryModal`) — read by every wrapper, the jump grid, the dock and the round; written by wrappers, three child sections' own mark buttons and `roundLooked`. The page's true coupling hub → the `useQuickfillSectionMarks` seam.
3. **The layout settings** (`sectionOrderIds`, `hiddenSectionIds`, `sectionBanners`, `jobsBillingMinHcp`, `layoutSettingsLoaded`) — org-wide `app_settings` rows → `useQuickfillLayoutSettings` seam.
4. **Inside `QuickfillScheduleSection`**, the substrate is the **day data engine** (`workDate` + `loadData`'s eight caches + the realtime channel): dot-drag, travel, add-block, reorder, roster and My Time all read it, and every write path calls `loadData({ quiet: true })` + `onBlocksSaved` → the `useQuickfillScheduleDay` seam.

Implication: extractions here don't need controlled-selection props — they need the two page hooks (marks, layout) and, for the schedule file, the day-engine hook, threaded as destructured props exactly like Bids' `useBidPricingEngine` pattern.

## Stage-A pure-logic inventory (extract to `lib/*` + tests before any component moves)

| Candidate | Currently | Target |
|---|---|---|
| `parseHiddenSectionIdsFromValueText`, `normalizeQuickfillSectionOrderFromValueText` (+ `SECTION_INSERT_AFTER`), `parseQuickfillSectionBannersFromValueText`, `capQuickfillBannerText`, `effectiveQuickfillSectionBanner` | module fns 150–220 | `lib/quickfill/sectionLayout.ts` + tests (order-merge drift + insert-after anchors, banner cap/default fallbacks, retired ids dropped) |
| `getButtonColor`, `hoursUntilExpand`, `formatRelativeTime`, `formatTime`, `formatHeaderLastMarked` (+ `ButtonColor`, `BUTTON_BG`/`BUTTON_BORDER`) | module fns 222–290 | `lib/quickfill/markFreshness.ts` + tests (30h/12h, never-marked, invalid ISO) — import `ROUND_FRESH_HOURS`/`ROUND_FLAT_DUE_HOURS` from `round.ts` and use them in `isCollapsed` too (`freshnessBucket` goes away with step 2) |
| "personal section" test | `sectionId === 'my-inbox'` hardcoded at 1711, 1846 and 1848 | `QUICKFILL_PERSONAL_SECTIONS` already in `round.ts` — decide whether schedule/tomorrow count as personal on desktop (behavior change → separate PR) |
| `travelUiForUser` chip/warning builder | `useCallback` 424–480 | `lib/quickfillScheduleTravelUi.ts` taking `(rows, coords, config, routedByPairKey)` + tests (gap vs touching, feasible vs tight, routed `~` vs straight-line `≥`) |
| `quickfillPickerJobsSorted` + `quickfillAssignJobPickerRows` | memos 639–678 (copies in `UserDayScheduleSection`, `ScheduleDispatchHubPage`) | `lib/scheduleJobPicker.ts` + tests (session-order-first, hcp numeric desc, `#` number query, text fields) — one kernel for three pickers |
| day-rail-window parse/serialize | lazy init 201–215 + `saveDaySettings` 234–246 | `lib/dispatchDayRailWindow.ts` + tests (bounds, min-60, full-day→null) |
| `rowsToDotBlocks` 926–931, roster search filter 523–535 | inline | fold into the respective lib modules above |

Already in `lib/*` **with tests** (do not re-extract): `dayScheduleDotDrag`, `jobTravelEstimate`, `reorderDayScheduleBlocks`, `notComingInTimeOff`, `quickfillMarkStamp`, `quickfillSectionSearch`, `quickfillCompleteNoBill`, `quickfillUndatedBills`, `scheduleDispatchAddBlockTimeline`, `scheduleDispatchAddBlockSave`, `scheduleDispatchHub`, `scheduleBlockTitle`, `clockSessionsToDispatchSecondaryBands`, `dispatchAddBlockTime`, `jobScheduleBlocks`, `jobScheduleOverlap`, `jobs/stagesJobNumberJump`, `map/geocodeCacheBatches`, `quickfill/{round, stationDeepLink, closeWeekChip, freshnessSummary, outstandingLabel}`, `moneyfillWeekClose`, `closeWeekAnchor`, `dispatchInboxAging`, `bankingAccess`, `scheduleDispatchEditRoles`. Without tests (add opportunistically): `quickfillScheduleSegments`, `usersTabRosterRoleSections`, `travelHintsConfig`, `routedTravelTimes`, `map/normalizeAddressForGeocode`, `map/geocodeErrorMessage`, `quickfill/sectionBanners`.

## Test coverage

Neither file has a render test of its own. `e2e/viewport-smoke.spec.ts` loads `/quickfill` (marker `/Quickfill/i`); [`ScheduleDispatchHub.render.test.tsx`](../src/components/schedule/ScheduleDispatchHub.render.test.tsx) mounts `QuickfillScheduleSection` on the Day tab and asserts the "Visible hours…" registration. Everything else is kernel-level (per-region column above). **No money math lives in either file** — the close-week figures come from tested `moneyfillWeekClose` / `closeWeekChip`. The riskiest untested logic: the dot-drag orchestration (debounce / cross-user flush / unmount flush), the reorder linked-leg shift loop (cross-user writes), `loadData`'s cache assembly, `sectionWouldRenderOnPage`, and the ten module helpers (freshness palette + org settings parsing).

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **`dockHiddenThisVisit` is session-only by design** — chips must return on reload even though the mark persists. Never derive it from `sectionMarks`.
2. **`forceExpandedSections` initializes to `new Set(['cant-reach'])`** — cant-reach ignores a fresh mark's collapse on first render.
3. **`cant-reach` is the only count-gated section** (documented exception in `sectionWouldRenderOnPage`); everything else is role/feature-gated so page height is stable from first paint (`banking-sorting`'s `canAccessBanking` gate is role-only).
4. **`my-inbox` is per-user**: no mark, no collapse, no history, neutral jump chip ("Personal section — items are completed individually"). The phone round additionally treats `schedule` / `tomorrow-schedule` as personal (`QUICKFILL_PERSONAL_SECTIONS`); the desktop grid does not.
5. **Mark upsert failure returns silently**; mark-event INSERT failure is tolerated with a warning toast ("Marked up to date, but saving history failed…"). Note cap 10,000 chars; `outstanding_count` snapshotted from the metrics context at mark time.
6. **`devSetSectionVisible` persists only for `role === 'dev'`** (queueMicrotask), though the toggle updates local state unconditionally; the panel only renders for dev.
7. **Layout settings load once on mount; no realtime** — `app_settings` is not in the realtime publication (dead listener removed, v2.560). Don't reintroduce a listener.
8. **Every section has a default banner question** (`lib/quickfill/sectionBanners.ts`, v2.2189); a stored custom banner wins. The schedule section keeps its own copy of `'Are there any obvious schedule conflicts?'` (`SCHEDULE_CONFLICTS_DEFAULT_PROMPT` 109), shown only when a host omits `hideConflictPrompt` — none does today.
9. **Schedule reports a null metric** (`useReportQuickfillSectionMetric('schedule', null, false)`) and both schedule wrappers hide the outstanding column + history button — "not comparable to inbox-style sections".
10. **Freshness thresholds**: red >30h, yellow >12h, green ≤12h; auto-expand at 12h; `hoursUntilExpand` rounds up to tenths. The phone round uses a different rule on purpose (each section's own median rhythm; flat 12h/30h only under three marks).
11. **Page root width containment** (v2.1003 comment): `width: '100%', minWidth: 0, boxSizing: 'border-box'`; `paddingBottom: '4.5rem'` only when >1 dock chip.
12. **Dot identity from BASE rows during a drag** (comment at `boundaryDotsForUser`) — only positions come from the draft, or the pointer-capture element unmounts mid-gesture. `dotDraftRef` is written synchronously in `handleDotDrag` (pointerup same-tick). Autosave debounce 2000ms; touching another person's dot flushes the pending draft first; **unmount flushes pending writes** fire-and-forget.
13. **Geocode self-heal runs once per address per page load** (`geocodeAttemptedKeysRef`), chunks of 20, failures rendered inline with hover detail (v2.932).
14. **`saveReorderedDay` shifts linked crew legs**: any changed block with `shared_block_group_id` propagates the same minute delta to every other assignee's leg; writes are sequential and abort on first error (partial state reconciled only by the realtime channel — the error path skips the quiet reload and `onBlocksSaved`).
15. **Day rail window stores full-day as null** (removes the key); min 60 minutes; per-device (`pipetooling_dispatch_day_rail_window_v1`); block bounds `MIN_MIN`–`MAX_MIN` = 04:00–20:00; the modal opens only through the hub's ⋯ menu (`onDaySettingsApiChange`).
16. **`workDate` change closes the picker/add-block modals** (effect 714–720, incl. the number query) and re-keys the realtime channel; `initialWorkDateYmd` prop changes overwrite local day nav.
17. **Email/texts/physical sections own their mark buttons** (`omitDefaultMarkButton`) and require a note before marking; the parent still owns the `markSectionUpToDate` write and passes the freshness palette down. On a round screen these (and the personal sections) get no "Looked" button — `QuickfillRoundScreen` shows "Mark inside · <next>" (personal: just "<next>"), which only skips; `roundLooked` itself marks with no note.
18. **Metric reporters inside the wrapper go dark while collapsed.** Six reporters (`warnings`, `lost-bid-reasons`, `gc-weekly-review`, `job-followups`, `needs-you`, `unpriced-fixtures`) are children of the wrapper; the desktop-collapsed strip doesn't mount children, the reporter's cleanup clears the count, and the header reads "—". Only `dispatch-inbox` sits beside its wrapper (v2.2896, documented in `lib/quickfill/outstandingLabel.ts`). Moving the other six is a behavior change — ship it as its own fix, not inside a move.
19. **Phones render nothing until `layoutSettingsLoaded`**, then the round list or one round screen; the desktop chrome (grid, search, dock, dev panel) never renders at ≤640px. Inside a round screen the wrapper returns `<div id={id}>{children}</div>` so the deep-link target survives.
20. **Bid-anchored schedule blocks** (`job_id` null) key as `bid:<bid_id>` in every title/segment/timeline lookup and are skipped by travel hints. "Create new job" in the picker needs `useJobFormModal()` non-null (null in render smokes).

## Recommended extraction order (value ÷ risk)

1. **Stage A sweep** — the [pure-logic inventory](#stage-a-pure-logic-inventory-extract-to-lib--tests-before-any-component-moves); each independently shippable. Highest leverage: `quickfill/markFreshness` (unblocks step 3 and collapses four threshold copies), `scheduleJobPicker` (one kernel for three pickers), `quickfillScheduleTravelUi`.
2. **Delete the dead phone paths** (~65 lines: `freshnessLine` + its render, narrow jump-strip ternaries, the wrapper's narrow `collapsed ?` true branch 2406–2444 — not its else; `lib/quickfill/freshnessSummary.ts` then has no caller) — mechanical, merges alone; verify with the e2e viewport smoke.
3. **`QuickfillSectionWrapper` + `CloseWeekChip` + history icon → own file** — verbatim move, props-plus-two-contexts interface, ~394 lines (fewer after step 2).
4. **Schedule: `DispatchDayVisibleHoursModal` + `useDayRailWindow`** (incl. the host-API effect) — lowest coupling in that file, guarded by the hub render smoke.
5. **Schedule: `QuickfillScheduleDayNav`** (`dayNavRow` + `compactDayNavRow`, ~196 lines of JSX locals, 1247–1442).
6. **`useQuickfillLayoutSettings` + `useQuickfillSectionMarks`** (+ fold in `useCloseWeekChips`) — the parent seams; parent destructures so downstream references are unchanged.
7. **`QuickfillDevSectionsPanel`** — `QuickfillDevSectionSortableRow` + the DndContext block + panel toggle, consuming the layout hook (~178 lines).
8. **`useQuickfillRound`** (+ optional `QuickfillRoundView`) against the marks hook.
9. **`QuickfillWarningsSection` + `QuickfillNudgeStation`s** — each owns its count state and reporter; keep the data hooks at page level (quirk 18 + fetch timing).
10. **`QuickfillScheduleSection` core** (its own mini-playbook run, in this order): a. `useDayTravelHints`; b. `useQuickfillScheduleDay` seam (day engine + realtime); c. `useDayScheduleDotDrag` against the seam (highest risk — move verbatim, add an orchestration test first); d. add-block/picker cluster, then reorder-day.

### What must STAY in the parent(s)

- **`Quickfill.tsx`:** the `SECTIONS` registry; `sectionWouldRenderOnPage` eligibility + the four section hooks it reads (`useQuickfillCantReachProspects`, `useQuickfillCompleteNoBillJobs`, `useQuickfillStagesJobsWithoutCustomer`, `useDispatchInbox`) — eligibility, metrics and section props all consume them; the page-level metric hooks (`useUnpricedFixturesCount`, `useStaleTallyStaffFollowUp`, `useLostBidNudge`) unless a fetch-timing change is intended; the `quickfillSectionBlock` switch; the station deep-link effect and the round's `location`/`navigate` wiring; jump grid / search / `SectionDock`; page-level modals (`QuickfillSectionMarkHistoryModal`, `DispatchDismissedItemsModal`, `CreateTripChargeModal`) and their open-state setters; the `QuickfillSectionMetricsProvider` mount.
- **`QuickfillScheduleSection.tsx`:** the host-prop contract (`hideConflictPrompt`, `initialWorkDateYmd`, `onBlocksSaved`, `showDaySettings`, `onDaySettingsApiChange`) and the `onBlocksSaved` fan-out after every write path (including the unmount flush) — the Dispatch hub Day tab depends on it; `workDate` ownership + the realtime channel; the role gates.

Definition of done per unit, verification gates (`npm run typecheck && npm run lint && npm test` after every step), and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md). Behavior-preserving only.
