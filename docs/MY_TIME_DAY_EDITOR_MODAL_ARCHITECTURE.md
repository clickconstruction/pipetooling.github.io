# My Time Day Editor Modal Architecture Map

---
file: docs/MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the DashboardMyTimeDayEditorModal.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md, adapted from tabs to modal regions like JOB_FORM_MODAL_ARCHITECTURE.md) — inventory what every region of the shared clock-day editor touches (state, handlers, supabase tables/RPCs, sub-components, coupling) so extraction can proceed without re-deriving the strategy. Sections: Overview, Master summary table, The shared substrate, Modal lifecycle and edit-window gating, The save engine, Stage-A pure-logic inventory, Per-region dossiers, Preserve-quirks list, Recommended extraction order.
audience: Developers, AI Agents
last_updated: 2026-07-29
---

## Overview

[`src/components/DashboardMyTimeDayEditorModal.tsx`](../src/components/DashboardMyTimeDayEditorModal.tsx) is a **3,948-line** modal component (as of v2.1088: ~39 `useState`, 17 `useEffect`, ~17 `useMemo`, ~40 `useCallback`, ~16 refs) — the shared **clock-day editor**: one person + one `work_date`, rendering that day's `clock_sessions` as a split/merge/assign timeline. It is opened from **13 call sites**: `Dashboard.tsx` + `DashboardMyTimeSection` (self My Time), `People.tsx` + `PeopleReviewTab` + `PeopleHoursDashboardClockStrip` (People → Hours, including the payroll-fence-override origins from v2.597/v2.616), `people/teamSummary/drilldowns.tsx` + `TeamSummaryInline`, the three `userReview/User*ScheduleSection` components, and `quickfill/QuickfillScheduleSection` + `QuickfillPeopleHoursNewSection`.

This map follows [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) and the dossier format of [`JOB_FORM_MODAL_ARCHITECTURE.md`](./JOB_FORM_MODAL_ARCHITECTURE.md). Where the playbook says "tab", read **logical region**: everything mounts at once; boundaries are state-gated sub-flows (dialogs) and vertical slices of the hook pile.

### Key structural notes

1. **This modal is already half-decomposed.** The two big cluster renderers are extracted (`MyTimeDayClusterVisual` ~1,054 lines, `MyTimeDayClusterForm` ~988 lines, in `src/components/my-time-day-editor/`), as are `MyTimeMergeSegmentsModal`, `AddDisjointSessionModal`, `AssignFocusModal`, `AdjustClockSessionTimesModal`, `ForceClockOutModal`, and the `useMyTimeCompactMergeMedia` media-query hook. The timeline math and save-plan predicates live in **tested** `src/lib/` kernels (`myTimeDayTimeline.ts` 887 lines + 2 test files, `myTimeDaySavePlan.ts` 532 lines + 3 test files, `myTimeMixedClusterSingleSegmentPartition.ts` + test). What remains inline is the **orchestration**: data engine, split-state store, gesture engine, save engine, and five confirm-dialog sub-flows.
2. **No form fields.** Unlike JobFormModal, the state is not a form — it is a per-cluster `SplitEditorState` store (`splitByCluster`) keyed by `sessionClusterId`, seeded from the DB rows and diffed against `initialSnapshot` on Save.
3. **Two render layouts, one state.** `layoutMode: 'visual' | 'form'` switches between `MyTimeDayClusterVisual` and `MyTimeDayClusterForm` per cluster; both consume the same `splitByCluster` slice and the same callback bundle, so every handler the clusters need must stay reachable from the shell.
4. **Two data modes.** `sessionsProp.length > 0` → parent-controlled sessions (People Hours seeds, drilldowns); else the modal **self-fetches** `clock_sessions` for `(effectiveSubjectUserId, dateStr)` and owns `fetchedSessions`. Several affordances gate on this fork (Add disjoint only in self-fetch mode; `onSaved` fired on sub-flow saves only in prop mode).
5. **The payroll-path is the money-path.** `persistDirtyChangesAsync` writes `clock_sessions` through an ordered branch ladder of direct UPDATEs/INSERTs and six split/replace RPCs; rejects and NCNS resync `people_hours`. Same risk class as JobFormModal's save engine.
6. **High churn.** `docs/RECENT_FEATURES.md` mentions this component in ~20 versions from v2.179 through the current head (v2.597 `saveableRangeOverride` payroll fence, v2.616 upcoming-week drilldown, the reject→`recompute_people_hours_after_session_edit` fix, and the newest Add-disjoint-session feature). Expect merge conflicts; extract in small PRs.

### How to read a dossier

Each region lists: **render location** (state gate or line range — line numbers are "as of v2.1088, 3,948 lines" and rot; search the symbol), **owned local state** (moves with the region), **cross-region/shared state** (stays in the shell), **derived memos**, **handlers**, **supabase** tables/RPCs, **sub-components** (extracted vs inline), **external coupling**, and **extraction status + risk + approach**.

### How to maintain this doc

- Update the relevant dossier whenever a region is extracted or its state/handlers change; flip its Status and point at the new file.
- Prefer symbol names over line numbers; treat line numbers as approximate anchors.

---

## Master summary table

| # | Region | Anchor symbol | Approx lines | Status | Owned state | Coupling | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| 0 | Shell + edit-window gating | `saveableRange`, `priorWeekAck`, overlay div (z 1200), prior-week ack screen, dual footers | ~340–362, 2544–2725, 2991–3183 | shell | 2 (`priorWeekAck`, + fence memos) | — | — | **Stays** — this is the parent |
| 1 | Session data engine | `fetchedSessions`, `sessionsFetchNonce`, `sortedSessions`, `sessionClusters`, `nowTick` | ~381–1005 | inline | ~7 + 2 effects | **maximum** — every region reads it | high | The shared substrate; extract to `useMyTimeDaySessions` hook **kept in the shell**, late |
| 2 | Salary prefetch + empty-day hints | `prefetchSalarySessionsWhenEmpty` effect, `stripEmptyDayHint` | ~649–652, 678–790 | inline | 4 + 1 ref + 1 effect | low (writes `sessionsFetchNonce`) | low | `useMyTimeSalaryPrefetch` hook — clean vertical slice |
| 3 | Job/bid label loader | `extraJobLabels` / `extraBidLabels` effect | ~875–971 | inline | 2 + 1 effect + 2 refs | low (outputs 2 memos) | low | `useMyTimeJobBidLabels` hook — clean vertical slice |
| 4 | Split-editor state + gesture engine | `splitByCluster`, `patchCluster`, `startDrag`, `handleStripPointerDown` | ~1107–1341, 1523–1972 | inline | 4 + ~10 refs + 4 effects | **high** (save engine + both cluster renderers read it) | high | `useMyTimeSplitEditor` + `useMyTimeBoundaryGestures` hooks, shell keeps outputs; do late |
| 5 | Merge-segments job-choice flow | `mergeJobChoice`, `openMergeJobChoiceForCluster` | ~244–256, 1208–1311, 3186–3197 | partial (modal extracted) | 1 | med (writes `splitByCluster`) | med | Handlers can move into the split-editor hook; modal mount stays shell |
| 6 | Assign job/bid + Apply Schedule % | `resolveAssignSessionForSegment`, `applyScheduleProportionsToCluster`, `assignBulk` | ~415–438, 1633–1745, 3198–3209 | partial (modals/lib extracted) | 1 (`assignBulk`) | high (persists splits via the RPC trio mid-flow) | high | Keep in shell until the save seam exists; then fold into it |
| 7 | Dirty tracking + save engine + close paths | `persistDirtyChangesAsync`, `effectiveDirtyIds`, `requestSave`, `requestDiscard`, `closeTopmostSubFlow` | ~129–242 (module fns), 1974–2542, 3858–3945 | inline | 3 (`saving`, `error`, `discardConfirmOpen`) | **maximum** — PAYROLL-PATH | **highest** | Stage A kernels → `lib/` + tests first; then `lib/myTimeDayPersist.ts` runner |
| 8 | Punch-time sub-flows (force clock-out / adjust times / reject / add disjoint) | `forceClockOutSession`, `adjustTimesSession`, `rejectSessionConfirm`, `addDisjointOpen` | ~392–399, 440–527, 997–1062, 3210–3250, 3359–3478 | partial (3 of 4 modals extracted; reject dialog inline) | 6 | med (all bump `sessionsFetchNonce`) | med | Extract the inline reject dialog → `MyTimeRejectSessionDialog`; wiring stays shell |
| 9 | NCNS flow | `ncnsUi`, `runRecordNcns`, `handleNcnsHeaderClick`, preclose + 3-phase dialogs | ~402–413, 798–873, 1342–1463, 3251–3358, 3479–3771 | inline | 9 + 1 probe effect | low (self-contained; bumps nonce) | low | **Best first Stage-B** — `MyTimeNcnsFlow` component + hook (~600 lines out) |
| 10 | Not-coming-in flow | `notComingInConfirmOpen`, `confirmMarkNotComingIn` | ~359–379, 3772–3857 | inline | 2 | none (delegates to `onMarkNotComingIn` prop) | trivial | **Momentum builder** — `MyTimeNotComingInConfirm` |
| 11 | Timeline body render | `timelineItems.map`, gap strips, cluster components, `+` button | ~2781–2987 | mostly extracted | 0 | high (threads ~25 props into each cluster) | low | Stays as shell JSX until regions 4/6/7 have seams; then thin |

> Status legend: `inline` = rendered/defined directly in the modal file; `partial` = major children extracted but the region's state/wiring still inline; `shell` = permanent parent responsibility.

---

## The shared substrate

There is **no selected-record pointer** here (no `setSharedBid` equivalent) — the modal *is* the selection: one `(subjectUserId, dateStr)` pair fixed by props for the modal's lifetime. The shared substrate is instead a **data + edit-state engine** that every region reads or invalidates:

1. **The session store:** `fetchedSessions` (self-fetch mode) / `sessionsProp` (controlled mode) → `resolvedSessions` → `sortedSessions` → `sessionClusters` (via `groupTimeContiguousSessionClusters` + `expandClustersSplitPairwiseOverlaps`) → `timelineItems` (`buildDayTimeline`). Identity key: `sessionsKey` (id/times/approval/work_date only — deliberately **not** job/bid).
2. **The refetch signal:** `setSessionsFetchNonce((n) => n + 1)` — the universal "something wrote the DB, reload the day" bump. Called by: assign-saved, force-clock-out-saved, adjust-times-saved, reject, salary prefetch, per-segment split persist, and Apply Schedule %. Any extracted region must receive this as a callback (`onSessionsInvalidated`).
3. **The split store:** `splitByCluster: Record<string, SplitEditorState>` + `initialSnapshot` + `initialJobBidBySessionIdRef` — seeded by the `sessionsKey`-keyed effect, mutated only through `splitReducer` actions, diffed by the dirty memo. Both cluster renderers, the gesture engine, the merge flow, the assign flow, and the save engine all touch it. **This is the coupling center of the file.**
4. **The clock:** `nowTick` (15s interval, only while an open session exists) + `nowTickRef` — open-session boundaries track it; almost every kernel call takes it.
5. **Permission gates:** `effectiveEditable`, `allowTimelineEdits`, `allowPunchTimeActions`, `editingSelf`, `fenceOverridden`, `priorWeekGateActive` — computed once in the shell from props + `getThisAndLastWeekRange()`/`saveableRangeOverride`; consumed everywhere.

Consequence for extraction: regions extract as **hooks/components that consume the substrate via props**, and the substrate itself (1–5) stays in the shell (or moves into a `useMyTimeDaySessions` hook that the shell owns and destructures) — exactly the Bids `useBidPricingEngine` pattern, except the "engine" here is sessions + splits rather than pricing.

---

## Modal lifecycle and edit-window gating

- **No remount-by-key contract** (unlike JobFormModal): callers mount/unmount the component directly; all reset effects key on `dateStr` / `effectiveSubjectUserId` / `sessionsKey`.
- **Edit fence:** `saveableRange = saveableRangeOverride ?? getThisAndLastWeekRange()` (America/Chicago); `inSaveableRange` gates everything, `needsPriorWeekAck` (in range but not current week) shows the acknowledgment screen until `priorWeekAck` is set (reset on `dateStr` change). `fenceOverridden` (Draft Payroll / Payroll ledger origin) swaps the copy and — critically — forces the **leader** RPC family even for self-edits (see quirk 2). The legacy `editableRange` prop is accepted and ignored (`void _editableRangeProp`).
- **Close paths:** Save (`requestSave` → persist → `onSaved()` + `onClose()`) vs Discard (`requestDiscard` → `discardConfirmOpen` when dirty → `confirmDiscard` → `onClose()`). Backdrop click and Escape route through `requestDiscard`; Escape (capture-phase window listener) first closes `discardConfirmOpen`, then `closeTopmostSubFlow()`, then discards. **There is no save-on-close** — the opposite of JobFormModal's close-flush design.
- **`closeTopmostSubFlow()`** is the sub-flow registry: not-coming-in confirm → NCNS dialog → NCNS preclose → merge choice → assign bulk → reject confirm → force clock-out → adjust times → add disjoint → boundary drag → strip tap. Every extracted sub-flow must keep its entry here (or the registry must become callback-driven).
- **`onSaved` vs `onLinkedSessionsUpdated`:** `onSaved` refreshes + typically dismisses in the parent; `onLinkedSessionsUpdated` refreshes parent lists (dashboard clock strip) *without* closing. Sub-flows call `onSaved()` only when `sessionsProp.length > 0` (controlled mode, parent owns the data) — preserve this fork exactly.

---

## The save engine — PAYROLL-PATH

**Anchor:** `persistDirtyChangesAsync(dirty: string[])` (~2020–2315), called only from `requestSave`. Per dirty cluster it computes `payloads = buildPayloads(last, split, nowTick)` and walks an ordered branch ladder. **The ladder order is load-bearing — the map documents; it does not fix.**

RPC selection: `editingSelf && !fenceOverridden` → the `own_*` family ([`splitOwnClockSessionSegments.ts`](../src/lib/splitOwnClockSessionSegments.ts): `split_own_clock_session_segments`, `split_own_clock_session_cluster`, `replace_own_clock_session_cluster_mixed`); otherwise the `leader_*` family ([`leaderClockSessionSplit.ts`](../src/lib/leaderClockSessionSplit.ts): `leader_split_clock_session_segments`, `leader_split_clock_session_cluster`, `leader_replace_clock_session_cluster_mixed` — these accept the `pay_access_clock_week_fence_bypass()` server-side, migration `20260702150000`).

The ladder, per cluster:

1. **No payloads** → throw a formatted "add notes / min 0.01 h" `DatabaseError` naming the block's time range.
2. **Draft cluster split >1** → throw ("save once, then edit splits").
3. **Single payload, single row:**
   - draft id (`isDraftPeopleHoursSessionId`) → **INSERT `clock_sessions`** (requires clocked-out + `effectiveSubjectUserId`), carrying `job_ledger_id`/`bid_id` from the row;
   - times mismatch DB row → throw ("add a split first or edit in People → Hours");
   - `peopleHoursGridProportionalSeed` → **UPDATE** times + notes + job/bid (the proportional-scale commit);
   - else → **UPDATE notes only** (note-only v1).
4. **Single payload, multi row:** boundaries match original rows (+not proportional seed) → per-row notes UPDATE; else if boundaries collapsed to one segment and the cluster lacks shared RPC metadata → `partitionMixedClusterSingleSegmentToRowIntervals` and per-row time UPDATEs (salary-origin rows set the "salary sync may adjust" toast); else require shared RPC metadata (`clusterSharesClockSessionClusterRpcMetadata`, else throw `myTimeClusterPersistRpcMetadataUserMessage`) and run **`replace_*_cluster_mixed`** with `attachAllocationsToPayloads`.
5. **Multi payload, single row:** → **`split_*_segments`** (payloads stripped of job/bid via `stripJobBidForSegmentRpc`).
6. **Multi payload, homogeneous job/bid + shared metadata:** → **`split_*_cluster`**.
7. **Multi payload, mixed but per-row persistable** (`mixedClusterSegmentsAllowPerRowPersist`): ordered 1:1 row↔segment path (`everySegmentAssignablePerRowOrdered`) does per-row notes-or-times UPDATEs; else per-row containment loop (`segmentContainedInRow`) mixing UPDATEs and `split_*_segments`.
8. **Multi payload, mixed, no shared metadata:** → `coalescedMixedClusterPartitionForSave` per-row time+notes UPDATEs (or throw); salary-origin rows set the sync toast.
9. **Fallback:** shared metadata required → `replace_*_cluster_mixed` with allocations.

**Dirty computation** (`effectiveDirtyIds` memo): union of `listDirtyClusterIds` (split-state diff vs `initialSnapshot`, open-session last boundary excluded), `listClustersDirtyFromJobBidChange` (job/bid drifted from `initialJobBidBySessionIdRef`), and all **draft** clusters (always dirty). If empty and `peopleHoursGridProportionalSeed`, **all** clusters become dirty and `isOnlyProportionalSeed = true` (amber banner; Cancel hidden).

**Approved-session guard:** both `requestSave` and `resolveAssignSessionForSegment` show a `window.confirm` when a dirty cluster has `approved_at` rows and the change is not note-only-safe (`noteOnlyApprovedSafe`) — splits/time changes remove approved hours from payroll until re-approved.

**Recommended seam (documented, not done):** Stage A — move the module-scope kernels (`buildPayloads`, `singleSegmentTimesMatchSession`, `noteOnlyApprovedSafe`, `comparableSplit`, `listDirtyClusterIds`, `sessionJobBidKey`, `listClustersDirtyFromJobBidChange`, `stripJobBidForSegmentRpc`) to `src/lib/` with tests (see inventory). Stage B — move `persistDirtyChangesAsync` verbatim into `src/lib/myTimeDayPersist.ts` (or `useMyTimeDayPersist`) taking `{clusters, splitByCluster, nowMs, rpcs, effectiveSubjectUserId, dateStr, proportionalSeed}` explicitly — **same ladder, same error messages, same sequencing**.

---

## Stage-A pure-logic inventory

Everything below is **module-scope in the modal file today** (lines ~106–256) — extraction is cut/paste + tests. The heavy lifting is already out: `myTimeDayTimeline.ts` (tested: `finalizeInnerBoundary`, `overlapWarning`), `myTimeDaySavePlan.ts` (tested: `assignableOrdered`, `coalescedPartition`, `mergeBlock`), `myTimeMixedClusterSingleSegmentPartition.ts` (tested), `salaryZonedWallClock.ts` (tested).

| Proposed lib file | Functions (module-scope today) | Notes |
|---|---|---|
| `src/lib/myTimeDayEditorPayloads.ts` | `buildPayloads`, `singleSegmentTimesMatchSession`, `stripJobBidForSegmentRpc` | The save-gate kernels: blank-note rejection, `MIN_SEGMENT_MS` enforcement (open-last uses `nowMs`), UPDATE-vs-RPC decision. Highest test value — `canSave` and every persist branch hang off `buildPayloads`. |
| `src/lib/myTimeDayEditorDirty.ts` | `comparableSplit`, `listDirtyClusterIds`, `sessionJobBidKey`, `listClustersDirtyFromJobBidChange`, `noteOnlyApprovedSafe` | The dirty/approved-safety family. `comparableSplit`'s open-session last-boundary exclusion is the quirk that keeps ticking clocks from looking dirty — test it. |
| `src/lib/myTimeDayEditorDefaults.ts` (or fold into an existing my-time lib) | `computeAddDisjointDefaults` logic (currently a `useCallback` closing over `sortedSessions`/`nowTick`/`dateStr` — take them as args), `formatDurationMs` | Low value alone; ride along with region 8's cleanup. Check for an existing duration formatter first. |
| add tests only (already in `lib/`, untested) | `persistMyTimeClusterForSegmentAssign.ts`, `applyScheduleProportionsToClockSession.ts`, `resolveCalendarWorkday.ts`, `forceClockOutDefaultOut.ts`, `peopleHoursManualDraftSession.ts` | Not moves — colocated `*.test.ts` gaps worth closing before the save seam. |

Constants that move with their consumers: `STRIP_TAP_MOVE_THRESHOLD_PX`, `NCNS_DETAILS_MAX_LEN`, `MY_TIME_BOUNDARY_DRAG_BODY_CLASS`, the `StripTapSession` / `MergeJobChoiceState` types.

---

## Per-region dossiers

### 0. Shell + edit-window gating

- **Render location:** overlay div (fixed, z **1200**, backdrop → `handleBackdropClose`) ~2546; dialog box max-width `min(920px, 96vw)`, maxHeight 94vh; header (title `modalTitleText` = person · friendly date · `[Nh]` · optional "punch times locked", `sessionsSpanDenverSubtitle`, `layoutModeToggleEl` Visual/Form toggle) ~2576–2647; out-of-range / prior-week-ack / fetch-error / loading / empty-day branches ~2648–2724; the **second footer** for non-editable/empty days ~3103–3183 (duplicates the NCNS + Not-coming-in buttons — quirk 12).
- **Owned state (permanent):** `priorWeekAck` (+ reset-on-`dateStr` effect), `layoutMode`, `saving`, `error`, `discardConfirmOpen`; memos `saveableRange`/`inSaveableRange`/`inCurrentWeek`/`needsPriorWeekAck`/`effectiveEditable`/`priorWeekGateActive`/`allowTimelineEdits`/`allowPunchTimeActions`, `modalTitlePerson`, `modalTitleText`, `layoutModeToggleEl`, `desktopHeaderTitleNarrow`; `myTimeCompactLayout` (extracted `useMyTimeCompactMergeMedia`, ≤520px).
- **Also permanent:** the Escape capture listener, `requestSave`/`requestDiscard`/`confirmDiscard`, `closeTopmostSubFlow`, the footer button rows, and a `layoutMode`-change effect that cancels any live gesture and clears `focusedHandle`.

### 1. Session data engine — the shared substrate

- **Location:** ~381–1005. See [The shared substrate](#the-shared-substrate).
- **Owned state:** `authUserId`, `authReady` (auth effect ~529), `fetchedSessions`, `sessionsLoading`, `sessionsFetchError`, `sessionsFetchNonce`, `resolvedSubjectLabel` (+ loader effect ~545 querying `users.name`), `nowTick` (+ 15s interval effect ~985, only with an open session).
- **Derived:** `effectiveSubjectUserId` (= `subjectUserIdProp ?? authUserId`), `editingSelf`, `pendingAuthForFetch`, `resolvedSessions` (prop-or-fetched, `normalizeDayEditorSession`d), `sortedSessions`, `sessionsKey`, `sessionClusters`, `timelineItems`, `dayStartMs`/`dayEndMs`/`totalDur`, `dayTotalClockedMs`, `sessionsSpanDenverSubtitle`, `addDisjointExistingIntervals`, `dayHasNoJobAssignments`.
- **Handlers:** the day-fetch effect (~590; skips when `sessionsProp` supplied, `!inSaveableRange`, or no subject; re-runs on `sessionsFetchNonce`), `fetchDaySessionsForEditor` (same query as a callable, used by the NCNS pre-close sweep).
- **Supabase:** `clock_sessions` SELECT (`user_id` + `work_date`, `rejected_at IS NULL`, `revoked_at IS NULL`; columns incl. `origin`, `salary_segment_index`), `users` SELECT name.
- **Extraction:** `useMyTimeDaySessions` hook returning the whole bundle, **kept in the shell** and destructured (playbook rule 4). Do this only after the leaf regions are out — every region's props come from here.

### 2. Salary-schedule prefetch + empty-day hints

- **Location:** reset effect ~649; main effect ~678–790, gated on `prefetchSalarySessionsWhenEmpty && sessionsProp.length === 0 && fetchedSessions?.length === 0 && inSaveableRange`, once per `${userId}|${dateStr}` (via `salaryStripPrefetchDoneKeyRef`).
- **Owned state:** `salarySchedulePrefetchBusy`, `stripEmptyDayHint` (`'time_off' | 'no_work' | null`), `stripTimeOffLabel` (default `UNPAID_TIME_OFF_LABEL`), `salaryStripPrefetchDoneKeyRef`; a clear-on-sessions effect ~788.
- **Flow:** probe `salary_work_schedule_templates` (`maybeSingle`) → if a template exists, load `salary_work_schedule_day_overrides` + `user_time_off` in parallel → `resolveCalendarWorkday` → `time_off`/`none` set the hint; a real workday runs `syncSalaryClockSessionsForUserDay` (RPC **`sync_salary_clock_sessions_for_user_day`**) then bumps `sessionsFetchNonce`.
- **Reads from shell:** `effectiveSubjectUserId`, `dateStr`, `inSaveableRange`, `sessionsLoading`, `fetchedSessions`, `showToast`. Writes: hint state + the nonce.
- **Extraction:** `useMyTimeSalaryPrefetch({enabled, userId, dateStr, sessionsEmpty, onInvalidate, showToast}) → {busy, emptyDayHint, timeOffLabel}`. **Low risk, clean slice.**

### 3. Job/bid label loader

- **Location:** ~875–971. Owned: `extraJobLabels`, `extraBidLabels` (+ reset effect on user/date), `jobLabelsRef`/`bidLabelsRef` + serialized dep strings.
- **Flow:** diff session `job_ledger_id`/`bid_id` sets against merged label maps; batch-fetch missing via RPC **`get_jobs_ledger_by_ids`** / **`get_bids_by_ids`**; format with `formatJobLedgerSummaryLine`/`formatBidLedgerSummaryLine` (+ `prefixMap` from `useLedgerPrefixMap`); fallback `Job <id8>…`/`Bid <id8>…` (also the catch path).
- **Outputs:** `mergedJobLabels`, `mergedBidLabels` — consumed by both cluster renderers and the merge flow.
- **Extraction:** `useMyTimeJobBidLabels({sessions, jobLabels, bidLabels, prefixMap}) → {mergedJobLabels, mergedBidLabels}`. **Low risk, clean slice.**

### 4. Split-editor state + gesture engine

- **Location:** store ~1107–1341; gesture plumbing ~1523–1631, 1747–1972.
- **Owned state:** `splitByCluster`, `initialSnapshot`, `initialJobBidBySessionIdRef`, `focusedHandle` (+ ref); refs `splitByClusterRef`, `sessionClustersRef`, `nowTickRef`, `stripRefs`, `dragRef` (`DragCtx`), `stripTapSessionRef`, `pointerMoveRef`/`stripTapMoveRef`/`stripTapEndRef`, `endBoundaryDragListenersRef`, `cancelStripTapGestureRef`.
- **Effects:** (a) the **seed effect keyed on `sessionsKey` only** (eslint-disabled deps — quirk 3): rebuilds `splitByCluster` via `initialClusterSplitState`, snapshots `comparableSplit` per cluster and `sessionJobBidKey` per session; (b) the open-session boundary tick (`setLastBoundary` on `nowTick`); (c) layout-mode change cancels gestures; (d) unmount cleanup releasing pointer capture + window listeners + the `my-time-boundary-dragging` body class.
- **Handlers:** `patchCluster` (routes `SplitAction`s through `splitReducer`; merge actions pre-checked by `myTimeClusterMergeWouldBlockPersist` → toast `myTimeClusterMergeBlockedUserMessage`), `applyInnerBoundaryDragMs` + `commitInnerBoundary` (drag then `finalizeInnerBoundaryMsForCluster` snap), `startDrag`/`endBoundaryDragListeners`/`cancelBoundaryDrag` (pointer-capture drag; **relative pointer delta** via `grabStripY`/`originBoundaryMs` — quirk 9), `handleStripPointerDown` (tap-to-add-split with `STRIP_TAP_MOVE_THRESHOLD_PX` cancel; **Alt/Option+click moves the focused boundary** — quirk 10; tap end snaps to `internalRowJoinMs` joins via `snapTapMsToNearestJoin`/`ROW_JOIN_SNAP_MS` then `repairMixedClusterSplitForRowContainment`), `handleStripKeyDown` (±60s Arrow nudge + finalize), `cancelStripTapGesture`, the three `stable*` window-listener trampolines.
- **Cross-region coupling:** the save engine diffs this store; the merge flow (5) and assign flow (6) mutate/read it; both cluster renderers receive `split` + `patchClusterAction` + gesture callbacks per cluster.
- **Extraction:** two hooks — `useMyTimeSplitEditor` (store + seed/tick effects + `patchCluster` + merge guard) and `useMyTimeBoundaryGestures` (refs + pointer plumbing, taking the store's setters). **High risk**; do after the save seam so the store's shape is pinned by tests.

### 5. Merge-segments job-choice flow

- **Location:** `MergeJobChoiceState` type ~244; `openMergeJobChoiceForCluster` ~1208 (builds upper/lower labels via `segmentAllocationLabelsForOverlap`, allocs via `effectiveSegmentJobBid`, merged note via `mergeSegmentNotes`, default choice by direction; pre-blocks via `myTimeClusterMergeWouldBlockPersist`); `confirmMergeJobChoice` ~1270 (merge action + `setSegmentJobOverride` + `setNote` on the absorber index); modal mount ~3186 (z 1300).
- **Owned state:** `mergeJobChoice`.
- **Sub-components:** `MyTimeMergeSegmentsModal` (**extracted**; `MyTimeSegmentMergeDirectionModal` also lives in the folder for the cluster renderers).
- **Extraction:** the two handlers belong in the region-4 hook (they are pure `splitByCluster` mutations); the modal mount stays shell (opened from both layouts). **Medium**, rides with region 4.

### 6. Assign job/bid + Apply Schedule %

- **Location:** `draftLocalJobBidAssign`/`handleAssignJobSaved` ~415–438; `resolveAssignSessionForSegment` ~1633–1698; `dayHasNoJobAssignments`/`showApplyScheduleProportions` ~1700–1706; `applyScheduleProportionsToCluster` ~1714–1745; `AssignFocusModal` mount ~3198 (z 1300). The per-segment assign popover itself (`AssignSessionJobPopover`) renders inside the cluster components.
- **Owned state:** `assignBulk` (`{sessionIds, label}`).
- **Money-path handlers:**
  - `resolveAssignSessionForSegment(clusterId, segIdx)`: if `assignJobNeedsPersistedSplits`, builds payloads, runs the approved-session `window.confirm` when needed, then **persists the split immediately** via `persistMyTimeClusterAndGetSegmentIds` with the own/leader RPC trio (`fenceOverridden` forces leader), bumps the nonce, and returns the fresh segment row id for the popover to target. Sets `saving` around the write.
  - `applyScheduleProportionsToCluster(clusterId, picks)`: v1 scope single closed non-draft row; delegates to [`applyScheduleProportionsToClockSession`](../src/lib/applyScheduleProportionsToClockSession.ts) (splits by Dispatch schedule shares and assigns jobs), then nonce bump + conditional `onSaved`. Gate `showApplyScheduleProportions` requires `dayHasNoJobAssignments && allowTimelineEdits && !priorWeekGateActive`.
  - `handleAssignJobSaved(patch?)`: skips draft ids, bumps nonce, `onLinkedSessionsUpdated`, and `onSaved` only in controlled mode.
  - `draftLocalJobBidAssign`: patches seeded draft rows via the `onPatchSeededSessionsJobBid` prop instead of the DB.
- **Coupling:** writes DB mid-edit (before Save) — the same "immediate write" hazard class as JobFormModal §21. Keep in the shell until the persist seam exists.

### 7. Dirty tracking + save engine + close paths

Documented in [The save engine](#the-save-engine--payroll-path). Additional render pieces: `editorInitialized` + `canSave` gates (~1974–2018; `canSave` also pre-validates the mixed-cluster partition feasibility so Save is disabled rather than throwing), the amber proportional-seed banner (~2727), `error` paragraph (~2989), footer Cancel/Save (~3056–3099; Cancel hidden when `isOnlyProportionalSeed` — quirk 6; Save rendered only when `isDirty`), and the discard confirm dialog (~3858, z 1320).

### 8. Punch-time sub-flows

- **Force clock-out:** `forceClockOutSession` + `openForceClockOut`/`onForceClockOutSaved`; mounts **extracted** [`ForceClockOutModal`](../src/components/people/ForceClockOutModal.tsx) (z 1300) — the modal owns the DB write.
- **Adjust times:** `adjustTimesSession` + `openAdjustTimes`/`onAdjustTimesSaved`; mounts **extracted** [`AdjustClockSessionTimesModal`](../src/components/AdjustClockSessionTimesModal.tsx) (z 1300).
- **Reject session:** `rejectSessionConfirm`/`rejectSessionBusyId`/`rejectSessionError`; `handleRejectSession` (draft rows get an explanatory toast instead), `confirmRejectSession` — **UPDATE `clock_sessions.rejected_at/rejected_by`** then RPC **`recompute_people_hours_after_session_edit`** (the incremental-`people_hours` resync — quirk 7), nonce bump, conditional `onSaved`. The confirm dialog is **inline** (~3359–3478, z 1310) with approved-hours warning.
- **Add disjoint:** `addDisjointOpen` + `computeAddDisjointDefaults` (last end +1h gap, +2h duration; empty day → 8 AM `APP_CALENDAR_TZ` wall via `salaryZonedWallClockToUtcMs`) + `handleAddDisjointConfirm` (appends a normalized draft row with seeded `notes: 'Disjoint session'` into `fetchedSessions`; persisted by the draft INSERT branch on Save); mounts **extracted** [`AddDisjointSessionModal`](../src/components/my-time-day-editor/AddDisjointSessionModal.tsx) (z 1300). `+` button gated to self-fetch editable instances only (quirk 15).
- All four appear as callbacks/gates on both cluster renderers (`onForceClockOut`/`onAdjustTimes`/`onRejectSession` passed only when `allowPunchTimeActions && !saving`).
- **Extraction:** move the inline reject dialog to `my-time-day-editor/MyTimeRejectSessionDialog.tsx` (props: session, busy, error, onCancel, onConfirm); handlers stay shell (they touch the nonce + `authUserId`). Low-medium.

### 9. NCNS flow (no-call-no-show)

- **Location:** state ~402–413; `job_schedule_blocks` probe effect ~798 (`subjectHasScheduleBlocksForDay`, only when `allowNcnsFromMyTime && !editingSelf`); gates `ncnsHasOpenSession`/`ncnsClickAllowed`/`ncnsButtonTitle` ~835–873; reset-on-day effect ~846; handlers `runRecordNcns`/`enterNcnsDialogFromSessions`/`forceClockOutOpenSessionsThenOpenNcns`/`closeNcnsPrecloseModal`/`handleNcnsPrecloseContinue`/`handleNcnsHeaderClick` ~1342–1463; pre-close dialog ~3251–3358 (z 1305); the 3-phase dialog (`simple` / `approved_warn` / `approved_confirm` with `ncnsPayrollAck` checkbox + `ncnsDetails` textarea, `NCNS_DETAILS_MAX_LEN` 4000) ~3479–3771 (z 1310); footer buttons in both footers.
- **Owned state:** `ncnsUi` (`NcnsUiPhase`), `ncnsPayrollAck`, `ncnsDetails`, `ncnsBusy`, `ncnsError`, `ncnsPrecloseOpenSessions`, `ncnsPrecloseError`, `subjectHasScheduleBlocksForDay`.
- **Supabase:** `job_schedule_blocks` SELECT probe; `clock_sessions` UPDATE `clocked_out_at` (the pre-close sweep via `forceClockOutDefaultOutIso`, then refetch-and-verify); RPC **`record_ncns_and_reject_sessions_for_day`** (`p_subject_user_id`, `p_work_date`, optional `p_details`; returns `rejected_count`/`had_approved_sessions`/`error_message`). Success → `onSaved()` + `onClose()`.
- **Shared reads:** `sortedSessions`, `effectiveSubjectUserId`, `editingSelf`, `allowPunchTimeActions`, `sessionsProp.length`, `fetchDaySessionsForEditor`, `setFetchedSessions`, `modalTitlePerson`, `dateStr`, `showToast`.
- **Extraction:** **best first Stage-B.** `useMyTimeNcnsFlow` (state + probe + handlers) + `MyTimeNcnsDialogs` (pre-close + 3-phase JSX) + a small button component; ~550–600 lines leave the file with a narrow prop surface. Keep the `closeTopmostSubFlow` entries by exposing `{isOpen, closeTopmost}` from the hook.

### 10. Not-coming-in flow

- **Location:** gate `showNotComingInControl` + `markNotComingInBusy`/`notComingInConfirmOpen` + `handleNotComingInClick`/`confirmMarkNotComingIn` ~359–379; confirm dialog ~3772–3857 (z 1320); buttons in both footers.
- **No supabase** — delegates entirely to the `onMarkNotComingIn` prop (parent runs the staff time-off RPC + refresh).
- **Extraction:** trivial — `MyTimeNotComingInConfirm` + keep the two-line handler pair in the shell or move them too. **Momentum builder.**

### 11. Timeline body render

- **Location:** ~2781–2987 inside the `myTimeDayTimelineScroll` div: `timelineItems.map` renders gap strips ("Off clock · Nh", flex-scaled by duration), per-cluster overlap warning banners (`hasPairwiseClockIntervalOverlap` with `CLOCK_OVERLAP_WARNING_EPS_MS`), then `MyTimeDayClusterVisual` or `MyTimeDayClusterForm` (both **extracted**) with the ~25-prop bundle (split, labels, gesture callbacks, assign/merge/punch-action callbacks, `showApplyScheduleProportions`, dividers via `getNextSessionClusterInTimeline`); the add-disjoint `+` button tail.
- **Owned state:** none — pure composition over regions 1/4/6/8.
- **Extraction:** leave last; once regions 4/6 have hook seams this collapses naturally into a `MyTimeDayTimelineBody` taking the two hook outputs.

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **`editableRange` prop is legacy and ignored** (`void _editableRangeProp` pattern at ~340) — callers still pass it; removing the prop is an API change, not a refactor.
2. **`fenceOverridden` forces the `leader_*` RPCs even for self-edits** (both in `persistDirtyChangesAsync` and `resolveAssignSessionForSegment`) — the `own_*` RPCs stay week-fenced server-side; pay-access users pass `can_edit_clock_sessions_for_user` for themselves.
3. **The split-seed effect depends only on `sessionsKey`** (explicit eslint-disable): job/bid label refetches produce a new `sortedSessions` array ref and must **not** wipe in-editor splits. Any hook extraction must keep this exact dependency shape.
4. **Open-session dirtiness:** `comparableSplit` drops the last boundary for open sessions and `nowTick` only ticks (15s) while an open session exists — otherwise a live clock would make every open day permanently dirty.
5. **Draft sessions** (`DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX`): always dirty, INSERT-on-save, cannot be split before first save, reject shows an explainer toast instead of the dialog, assign patches go through `onPatchSeededSessionsJobBid` not the DB.
6. **`peopleHoursGridProportionalSeed` contract:** zero user edits still persists **all** clusters on Save; Cancel is hidden (`isOnlyProportionalSeed`) so the People → Hours grid keeps its "Close = Save" behavior; the seed path uses the times-UPDATE branch (not notes-only).
7. **Reject must pair the raw `rejected_at` UPDATE with RPC `recompute_people_hours_after_session_edit`** — `people_hours` is maintained incrementally (approve +, reject −); skipping the resync freezes payroll hours (this was a real prod bug).
8. **The persist branch ladder order is semantic** (note-only → draft INSERT → proportional UPDATE → row-partition → per-row → coalesced → replace-mixed) and its `DatabaseError` messages are user-facing copy. Move verbatim.
9. **Boundary drag is relative-delta** (`grabStripY` / `originBoundaryMs`), not absolute-position; grabbing a handle off-center must not jump the boundary.
10. **Alt/Option+click** on a strip moves the *focused* inner boundary to the click Y; plain click/tap adds a split, snapped to row joins (`ROW_JOIN_SNAP_MS`) and repaired for row containment. Taps that travel > `STRIP_TAP_MOVE_THRESHOLD_PX` (8px) are cancelled.
11. **Approved-hours `window.confirm`** appears in two places (Save and per-segment assign persist) with identical copy — keep both.
12. **Two footers** render the NCNS / Not-coming-in buttons (editable path ~3010; non-editable/empty path ~3123) — an extracted button component must mount in both.
13. **Salary-origin partition saves** (`origin === 'salary_schedule'`) show the "salary sync may adjust rows" info toast after Save.
14. **z-index ladder:** main overlay 1200 → sub-modals (merge/assign/force/adjust/disjoint) 1300 → NCNS pre-close 1305 → reject + NCNS dialogs 1310 → not-coming-in + discard confirms 1320. Escape uses a **capture-phase** window listener and drains `discardConfirmOpen` → `closeTopmostSubFlow` → `requestDiscard` in that order.
15. **Add disjoint only in self-fetch mode** (`sessionsProp.length === 0`): pushing a synthetic draft into parent-controlled state is unsafe. The seeded `notes: 'Disjoint session'` is required — `buildPayloads` rejects blank notes.
16. **`onSaved` fires from sub-flows only in controlled mode** (`sessionsProp.length > 0`); self-fetch mode relies on `sessionsFetchNonce` + `onLinkedSessionsUpdated` so the modal stays open.

---

## Recommended extraction order (value ÷ risk)

1. **Stage A sweep** — `myTimeDayEditorPayloads.ts` + `myTimeDayEditorDirty.ts` kernels with tests (pins `canSave`, the dirty gate, and the note-only-safe predicate before anything moves); add tests to the untested lib deps (`persistMyTimeClusterForSegmentAssign`, `applyScheduleProportionsToClockSession`, `resolveCalendarWorkday`, `forceClockOutDefaultOut`).
2. **Not-coming-in flow** → `MyTimeNotComingInConfirm` — trivial, validates the sub-flow seam and the dual-footer button pattern.
3. **NCNS flow** → `useMyTimeNcnsFlow` + `MyTimeNcnsDialogs` — largest self-contained slice (~600 lines), low coupling, big win.
4. **Reject dialog** → `MyTimeRejectSessionDialog` (JSX only; handlers stay shell).
5. **Salary prefetch** → `useMyTimeSalaryPrefetch`; **job/bid labels** → `useMyTimeJobBidLabels` — independent vertical hooks.
6. **Save-engine seam** → `persistDirtyChangesAsync` verbatim into `lib/myTimeDayPersist.ts` (explicit inputs, RPC trio injected) — after step 1's tests exist. Highest risk; its own PR.
7. **Split editor + gestures** → `useMyTimeSplitEditor` + `useMyTimeBoundaryGestures`; the merge-choice handlers (region 5) move into the split hook.
8. **Session data engine** → `useMyTimeDaySessions` (shell keeps and destructures it); then the timeline body collapses into `MyTimeDayTimelineBody`.

**What must stay in the parent (shell), permanently:** the props contract + edit-window gating (fence, prior-week ack, `clockTimesReadOnly` forks), `sessionsFetchNonce` ownership (or its `onSessionsInvalidated` successor), the `closeTopmostSubFlow` registry, `requestSave`/`requestDiscard` + the discard confirm, `saving`/`error`, the `onSaved`/`onLinkedSessionsUpdated`/`onClose` plumbing, the layout-mode toggle, the sub-modal mounts opened from both cluster layouts (merge, assign, force clock-out, adjust times, add disjoint), and both footers.

Definition of done per region, verification gates, and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) (`npm run typecheck && npm run lint && npm test` green after every step; behavior-preserving only).
