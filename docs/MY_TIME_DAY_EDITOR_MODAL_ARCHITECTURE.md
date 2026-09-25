# My Time Day Editor Modal Architecture Map

---
file: docs/MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md
type: Architecture Map / Decomposition
purpose: Step-0 map for the DashboardMyTimeDayEditorModal.tsx decomposition (per PAGE_DECOMPOSITION_PLAYBOOK.md, adapted from tabs to modal regions like JOB_FORM_MODAL_ARCHITECTURE.md) — inventory what every region of the shared clock-day editor touches (state, handlers, supabase tables/RPCs, sub-components, coupling, test coverage) so extraction can proceed without re-deriving the strategy. Sections: Overview, Parent contract, Master summary table, The shared substrate, Modal lifecycle and edit-window gating, The save engine, Stage-A pure-logic inventory, Per-region dossiers, Test coverage, Preserve-quirks list, Recommended extraction order.
covers:
  - src/components/DashboardMyTimeDayEditorModal.tsx
mapped_at: a05cef4c4
audience: Developers, AI Agents
last_updated: 2026-09-25
---

## Overview

> **Every line range in this map is as of `a05cef4c4`** (3,981 lines). Ranges rot with each commit — search the symbol named beside the range, and regenerate the facts with `npm run map -- src/components/DashboardMyTimeDayEditorModal.tsx` before trusting a number.

[`src/components/DashboardMyTimeDayEditorModal.tsx`](../src/components/DashboardMyTimeDayEditorModal.tsx) is a **3,981-line** file: one exported component `DashboardMyTimeDayEditorModal` (330–3981, render 2589–3980) plus 9 module-scope functions and 3 types (108–328). Hook census: **39 `useState`, 17 effects, 19 `useMemo`, 42 `useCallback`, 16 `useRef`, 4 custom hooks** (`useToastContext`, `useConfirmDialog`, `useLedgerPrefixMap`, `useMyTimeCompactMergeMedia`). It is the shared **clock-day editor**: one person + one `work_date`, rendering that day's `clock_sessions` as a split/merge/assign timeline. **12 files import it, with 13 mounts** — see [Parent contract](#parent-contract).

This map follows [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) and the dossier format of [`JOB_FORM_MODAL_ARCHITECTURE.md`](./JOB_FORM_MODAL_ARCHITECTURE.md). Where the playbook says "tab", read **logical region**: everything mounts at once; boundaries are state-gated sub-flows (dialogs) and vertical slices of the hook pile.

### Key structural notes

1. **This modal is already half-decomposed.** Extracted children in `src/components/my-time-day-editor/`: `MyTimeDayClusterVisual` (1,061 lines), `MyTimeDayClusterForm` (990), `MyTimeMergeSegmentsModal` (282), `AddDisjointSessionModal` (266), `useMyTimeCompactMergeMedia` (45); elsewhere `AssignFocusModal`, `AdjustClockSessionTimesModal`, `people/ForceClockOutModal`. (`MyTimeSegmentMergeDirectionModal` 181 and `myTimeDayEditorDatetime.ts` 41 live in the folder but are consumed by the children, not this file.) Timeline math and save-plan predicates live in **tested** `src/lib/` kernels (`myTimeDayTimeline.ts` 891 lines + 3 test files, `myTimeDaySavePlan.ts` 532 + 4 test files, `myTimeMixedClusterSingleSegmentPartition.ts` 355 + test, `persistMyTimeClusterForSegmentAssign.ts` 188 + test). What remains inline is the **orchestration**: data engine, split-state store, gesture engine, save engine, and five confirm-dialog sub-flows.
2. **No form fields.** The state is a per-cluster `SplitEditorState` store (`splitByCluster`, 1148) keyed by `sessionClusterId`, seeded from the DB rows and diffed against `initialSnapshot` on Save.
3. **Two render layouts, one state.** `layoutMode: 'visual' | 'form'` (1509) switches between `MyTimeDayClusterVisual` and `MyTimeDayClusterForm` per cluster; both consume the same `splitByCluster` slice and the same callback bundle, so every handler the clusters need must stay reachable from the shell.
4. **Two data modes.** `sessionsProp.length > 0` → parent-controlled sessions; else the modal **self-fetches** `clock_sessions` for `(effectiveSubjectUserId, dateStr)` and owns `fetchedSessions`. **11 of 13 mounts pass `sessions={[]}`** (self-fetch); only `DashboardMyTimeSection` and People's `hoursManualDraftEditor` are controlled. Several affordances gate on this fork (Add session only in self-fetch mode; `onSaved` on reject / assign / Apply Schedule % saves only in controlled mode — NCNS always saves and closes; draft Adjust-times patches the parent seed vs `fetchedSessions`).
5. **The payroll-path is the money-path.** `persistDirtyChangesAsync` (2063–2358) writes `clock_sessions` through an ordered branch ladder of direct UPDATEs/INSERTs and six split/replace RPCs; rejects and NCNS resync `people_hours`. Same risk class as JobFormModal's save engine — and its module-scope kernels are still **untested** (see [Test coverage](#test-coverage)).
6. **Churn since the 2026-07-29 map (v2.1088 → a05cef4c4, +33 lines, 5 commits):** v2.1095 draft Adjust-times saves locally (`draftLocalAdjustTimes`, new prop `onPatchSeededSessionsTimes`); v2.1463 the "N sessions · punch-editing explainer" line removed; v2.1598 title uses the short date and the day total moved to a new `clockedSubtitle` line, `+` became a bordered "+ Add session" button; v2.1877 both approved-hours `window.confirm`s became `useConfirmDialog()`; v2.3676 both `clock_sessions` SELECTs add `quick_add_minutes` (the Quick-add chip renders in the cluster children). No change to the save ladder, the dirty kernels, or the sub-flow registry. Low churn now; the last shape change was 2026-09-21.

### How to read a dossier

Each region lists: **render location** (state gate + line range), **owned local state** (moves with the region), **cross-region/shared state** (stays in the shell), **derived memos**, **handlers**, **supabase** tables/RPCs, **sub-components** (extracted vs inline), **external coupling**, **tests**, and **extraction status + risk + approach**.

### How to maintain this doc

- Update the relevant dossier whenever a region is extracted or its state/handlers change; flip its Status and point at the new file.
- Anchor by symbol name + range; re-run `npm run map` and bump `mapped_at` when refreshing ranges.

---

## Parent contract

**Props (20, `Props` 260–328):** `dateStr`, `sessions`, `subjectUserId?`, `subjectDisplayName?`, `editableRange?` (legacy, ignored — quirk 1), `jobLabels?`, `bidLabels?`, `onClose`, `onSaved`, `onLinkedSessionsUpdated?`, `allowNcnsFromMyTime?`, `showMarkNotComingIn?`, `onMarkNotComingIn?`, `clockTimesReadOnly?`, `showSalariedLabelUnderVisualStrip?`, `prefetchSalarySessionsWhenEmpty?`, `peopleHoursGridProportionalSeed?`, `onPatchSeededSessionsJobBid?`, `onPatchSeededSessionsTimes?`, `saveableRangeOverride?`.

| Mount (file:line of `<DashboardMyTimeDayEditorModal`) | Mode | Distinguishing props |
|---|---|---|
| `pages/Dashboard.tsx:1500` (`stripMyTimeEditor`) | self-fetch | salary prefetch + salaried label, `clockTimesReadOnly`, NCNS, not-coming-in, `onLinkedSessionsUpdated` |
| `components/DashboardMyTimeSection.tsx:817` | **controlled** (`myTimeModalSessions`) | `clockTimesReadOnly` |
| `components/dashboard/DashboardYourRecordCard.tsx:175` | self-fetch | salary prefetch + salaried label |
| `components/HoursUnassignedModal.tsx:1241` | self-fetch | `onLinkedSessionsUpdated` |
| `components/jobs/team/useTeamBoardActions.tsx:248` | self-fetch | no labels; `onLinkedSessionsUpdated` |
| `components/people/PeopleHoursDashboardClockStrip.tsx:479` | self-fetch | salary prefetch + salaried label, `clockTimesReadOnly`, NCNS, not-coming-in, `onLinkedSessionsUpdated` |
| `pages/People.tsx:4499` (`hoursManualDraftEditor`) | **controlled** (draft sessions) | `peopleHoursGridProportionalSeed`, `onPatchSeededSessionsJobBid`, `onPatchSeededSessionsTimes`, `allowNcnsFromMyTime={false}` |
| `pages/People.tsx:4620` (`hoursMyTimeEditor`) | self-fetch | `saveableRangeOverride` (Draft Payroll pay period, or the Payroll ledger upcoming-week drilldown's `saveableRange`), NCNS |
| `quickfill/QuickfillScheduleSection.tsx:1863`, `quickfill/QuickfillPeopleHoursNewSection.tsx:540` | self-fetch | NCNS, not-coming-in |
| `userReview/User{Day,Week,Month}ScheduleSection.tsx` (841 / 428 / 437) | self-fetch | NCNS, not-coming-in |

Every mount except `DashboardMyTimeSection` and `DashboardYourRecordCard` passes `onLinkedSessionsUpdated` (11 of 13), so it distinguishes only those two.

The Team Summary drilldowns (`people/teamSummary/drilldowns.tsx`, `TeamSummaryInline.tsx`, `lib/peopleDocuments/buildTeamSummaryHtml.ts`) only **name** this modal in comments — their day-header click bridges up to the People.tsx mount; they do not import it.

---

## Master summary table

| # | Region | Anchor symbol | Lines (a05cef4c4) | Status | Owned state | Coupling | Risk | Tests | Recommended action |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Shell + edit-window gating | `saveableRange`, `priorWeekAck`, overlay (z 1200), header, branch ladder, dual footers | 355–378, 1509–1563, 2573–2775, 3022–3131, 3134–3214 | shell | 2 (`priorWeekAck`, `layoutMode`) + 2 effects | — | — | none (no render smoke mounts the modal) | **Stays** — this is the parent |
| 1 | Session data engine | `fetchedSessions`, `sessionsFetchNonce`, `sortedSessions`, `sessionClusters`, `nowTick` | 396–402, 564–711, 827–831, 1008–1146 | inline | 8 + 4 effects | **maximum** — every region reads it | high | kernels tested (`myTimeDayTimeline*`, 45 cases); fetch/effects untested | The shared substrate; `useMyTimeDaySessions` hook **kept in the shell**, late |
| 2 | Salary prefetch + empty-day hints | effect `713–821`, `stripEmptyDayHint` | 403–406, 684–687, 713–825 | inline | 3 + 1 ref + 3 effects | low (writes `sessionsFetchNonce`) | low | `resolveCalendarWorkday` (11); effect + `salaryScheduleSync` untested | `useMyTimeSalaryPrefetch` hook — clean vertical slice |
| 3 | Job/bid label loader | `extraJobLabels` / `extraBidLabels` effect | 910–1006 | inline | 2 + 2 refs + 2 effects | low (outputs 2 memos) | low | `formatJobLedgerSummaryLine` in `ledgerDisplayPrefixes.test.ts` (`formatBidLedgerSummaryLine` untested); loader untested | `useMyTimeJobBidLabels` hook — clean vertical slice |
| 4 | Split-editor state + gesture engine | `splitByCluster`, `patchCluster`, `startDrag`, `handleStripPointerDown` | 1148–1247, 1354–1375, 1564–1672, 1790–2015 | inline | 3 + 13 refs + 4 effects | **high** (save engine + both cluster renderers read it) | high | reducer/snap/finalize/repair kernels tested; pointer plumbing + 3× strip-Y→ms math untested | `useMyTimeSplitEditor` + `useMyTimeBoundaryGestures` hooks, shell keeps outputs; do late |
| 5 | Merge-segments job-choice flow | `mergeJobChoice`, `openMergeJobChoiceForCluster` | 246–258, 1249–1352, 3217–3228 | partial (modal extracted) | 1 | med (writes `splitByCluster`) | med | merge-block + label/alloc kernels tested; handlers untested | Handlers move into the split-editor hook; modal mount stays shell |
| 6 | Assign job/bid + Apply Schedule % | `resolveAssignSessionForSegment`, `applyScheduleProportionsToCluster`, `assignBulk` | 430–453, 1675–1788, 3229–3240 | partial (modals/lib extracted) | 1 (`assignBulk`) | high (persists splits via the RPC trio mid-flow) | high | `persistMyTimeClusterAndGetSegmentIds` (7), `applyScheduleProportionsToClockSession` (7) tested; handler forks untested | Keep in shell until the save seam exists; then fold into it |
| 7 | Dirty tracking + save engine + close paths | `persistDirtyChangesAsync`, `effectiveDirtyIds`, `requestSave`, `requestDiscard`, `closeTopmostSubFlow` | 108–244 (module fns), 2018–2571, 2777–2793, 3020, 3087–3130, 3891–3978 | inline | 3 (`saving`, `error`, `discardConfirmOpen`) | **maximum** — PAYROLL-PATH | **highest** | `myTimeDaySavePlan*` (32) + partition (7) tested; **the 8 module kernels, `canSave` and the ladder are untested** | Stage A kernels → `lib/` + tests first; then `lib/myTimeDayPersist.ts` runner |
| 8 | Punch-time sub-flows (force clock-out / adjust times / reject / add session) | `forceClockOutSession`, `adjustTimesSession`, `rejectSessionConfirm`, `addDisjointOpen` | 407–416, 455–562, 1032–1097, 2984–3017, 3241–3283, 3392–3511 | partial (3 of 4 modals extracted; reject dialog inline) | 6 | med (force/adjust/reject bump `sessionsFetchNonce`; add session and draft Adjust-times write `fetchedSessions`) | med | none (`forceClockOutDefaultOut`, `peopleHoursManualDraftSession`, the 3 modals untested) | Extract the inline reject dialog → `MyTimeRejectSessionDialog`; wiring stays shell |
| 9 | NCNS flow | `ncnsUi`, `runRecordNcns`, `handleNcnsHeaderClick`, preclose + 3-phase dialogs | 417–428, 833–908, 1383–1504, 3061–3085, 3174–3198, 3284–3391, 3512–3804 | inline | 8 + 2 effects | low (self-contained; writes `fetchedSessions`) | low | none | **Best first Stage-B** — `MyTimeNcnsFlow` component + hook (~600 lines out) |
| 10 | Not-coming-in flow | `notComingInConfirmOpen`, `confirmMarkNotComingIn` | 374–394, 3041–3060, 3154–3173, 3805–3890 | inline | 2 | none (delegates to `onMarkNotComingIn` prop) | trivial | none (no logic) | **Momentum builder** — `MyTimeNotComingInConfirm` |
| 11 | Timeline body render | `timelineItems.map`, gap strips, cluster components, "+ Add session" | 2811–3018 | mostly extracted | 0 | high (threads ~30 props into each cluster: 33 Visual / 30 Form) | low | none | Stays as shell JSX until regions 4/6/7 have seams; then thin |

> Status legend: `inline` = rendered/defined directly in the modal file; `partial` = major children extracted but the region's state/wiring still inline; `shell` = permanent parent responsibility. State totals: 2+8+3+2+3+1+1+3+6+8+2 = 39 `useState`; refs 1+2+13 = 16; effects 2+4+3+2+4+2 = 17.

---

## The shared substrate

There is **no selected-record pointer** here (no `setSharedBid` equivalent) — the modal *is* the selection: one `(subjectUserId, dateStr)` pair fixed by props for the modal's lifetime. The shared substrate is instead a **data + edit-state engine** that every region reads or invalidates:

1. **The session store:** `fetchedSessions` (398, self-fetch mode) / `sessionsProp` (controlled mode) → `resolvedSessions` (707–710) → `sortedSessions` (827–831) → `sessionClusters` (1027–1030, via `groupTimeContiguousSessionClusters` + `expandClustersSplitPairwiseOverlaps`) → `timelineItems` (1125–1128, `buildDayTimeline`). Identity key: `sessionsKey` (1008–1017; id/times/approval/work_date only — deliberately **not** job/bid). Writers of `fetchedSessions` outside the fetch effect: `draftLocalAdjustTimes`, `handleAddDisjointConfirm`, `forceClockOutOpenSessionsThenOpenNcns`.
2. **The refetch signal:** `setSessionsFetchNonce((n) => n + 1)` — the universal "something wrote the DB, reload the day" bump. Written by: `handleAssignJobSaved`, `onForceClockOutSaved`, `onAdjustTimesSaved`, `confirmRejectSession`, `resolveAssignSessionForSegment`, `applyScheduleProportionsToCluster`, and the salary-prefetch effect (713–821). Any extracted region must receive this as a callback (`onSessionsInvalidated`).
3. **The split store:** `splitByCluster: Record<string, SplitEditorState>` + `initialSnapshot` + `initialJobBidBySessionIdRef` (1148–1151) — seeded by the `sessionsKey`-keyed effect, mutated only through `splitReducer` actions, diffed by the dirty memo. Written by 7 callbacks/handlers (`patchCluster`, `applyInnerBoundaryDragMs`, `confirmMergeJobChoice`, `commitInnerBoundary`, `cancelBoundaryDrag`, `handleStripPointerDown`, `handleStripKeyDown`), the render-time `stripTapEndRef` body, and the seed/tick effects, and read by the save engine, `canSave`, the dirty memo, the merge opener and both cluster renderers. **This is the coupling center of the file.**
4. **The clock:** `nowTick` (1019; 15s interval 1020–1025, only while an open session exists) + `nowTickRef` — read by 19 consumers per the fact sheet; almost every kernel call takes it.
5. **Permission gates:** `effectiveEditable`, `allowTimelineEdits`, `allowPunchTimeActions`, `editingSelf`, `fenceOverridden`, `priorWeekGateActive` — plain derived consts (355–378, 577–578), computed each render from props + `getThisAndLastWeekRange()`/`saveableRangeOverride`; consumed everywhere.

Consequence for extraction: regions extract as **hooks/components that consume the substrate via props**, and the substrate itself (1–5) stays in the shell (or moves into a `useMyTimeDaySessions` hook that the shell owns and destructures) — the Bids `useBidPricingEngine` pattern, except the "engine" here is sessions + splits rather than pricing.

---

## Modal lifecycle and edit-window gating

- **No remount-by-key contract** (unlike JobFormModal): callers mount/unmount the component directly; all reset effects key on `dateStr` / `effectiveSubjectUserId` / `sessionsKey`.
- **Edit fence (355–372):** `saveableRange = saveableRangeOverride ?? getThisAndLastWeekRange()` (America/Chicago); `inSaveableRange` gates everything, `needsPriorWeekAck` (in range but not current week) shows the acknowledgment screen (2704–2760, Cancel → `onClose`, "Continue editing" → `setPriorWeekAck(true)`) until `priorWeekAck` is set (reset on `dateStr`, 364–366). `fenceOverridden` (People's Draft Payroll or Payroll-ledger upcoming-week origin) swaps the copy ("outside the pay period" / "Editing a payroll-period day") and — critically — forces the **leader** RPC family even for self-edits (quirk 2). The legacy `editableRange` prop is accepted and ignored (`void _editableRangeProp`, 355).
- **Close paths:** Save (`requestSave` 2481–2538 → persist → `onSaved()` + `onClose()`) vs Discard (`requestDiscard` 2548–2560 → `discardConfirmOpen` when dirty → `confirmDiscard` 2563–2566 → `onClose()`). Backdrop (`handleBackdropClose` 2568–2571) and Escape route through `requestDiscard`; Escape (capture-phase window listener, 2573–2587, ignored while `saving`) first closes `discardConfirmOpen`, then `closeTopmostSubFlow()`, then discards. **There is no save-on-close** — the opposite of JobFormModal's close-flush design.
- **`closeTopmostSubFlow()` (2408–2473)** is the sub-flow registry, in order: not-coming-in confirm → NCNS dialog → NCNS preclose → merge choice → assign bulk → reject confirm → force clock-out → adjust times → add session → boundary drag → strip tap (busy flags block the close for not-coming-in, NCNS and reject). It reads and clears the open state of regions 5, 6, 8, 9 and 10 (`mergeJobChoice`, `assignBulk`, `rejectSessionConfirm`, `forceClockOutSession`, `adjustTimesSession`, `addDisjointOpen`, `ncnsUi` + `ncnsPayrollAck` + `ncnsDetails`, `ncnsPrecloseOpenSessions`, `notComingInConfirmOpen`), so every region-"owned" open flag has this shell writer too. `requestSave` and `requestDiscard` both call it first. Every extracted sub-flow must keep its entry here (or the registry must become callback-driven).
- **`onSaved` vs `onLinkedSessionsUpdated`:** `onSaved` refreshes + typically dismisses in the parent; `onLinkedSessionsUpdated` refreshes parent lists (dashboard clock strip) *without* closing. Reject, `handleAssignJobSaved` and Apply Schedule % call `onSaved()` only when `sessionsProp.length > 0` (controlled mode); force clock-out, adjust-times and the per-segment split persist (`resolveAssignSessionForSegment`) never call it (nonce + `onLinkedSessionsUpdated` only); a successful NCNS record always calls `onSaved()` + `onClose()` — preserve these forks exactly.

---

## The save engine — PAYROLL-PATH

**Anchor:** `persistDirtyChangesAsync(dirty: string[])` (2063–2358, 296 lines), called only from `requestSave`. Per dirty cluster it computes `payloads = buildPayloads(last, split, nowTick)` and walks an ordered branch ladder. **The ladder order is load-bearing — the map documents; it does not fix.**

RPC selection: `editingSelf && !fenceOverridden` → the `own_*` family ([`splitOwnClockSessionSegments.ts`](../src/lib/splitOwnClockSessionSegments.ts): `split_own_clock_session_segments`, `split_own_clock_session_cluster`, `replace_own_clock_session_cluster_mixed`); otherwise the `leader_*` family ([`leaderClockSessionSplit.ts`](../src/lib/leaderClockSessionSplit.ts): `leader_split_clock_session_segments`, `leader_split_clock_session_cluster`, `leader_replace_clock_session_cluster_mixed` — these accept the `pay_access_clock_week_fence_bypass()` server-side, migration `20260702150000`). The fact sheet's Data line lists only `clock_sessions` for this callback because the six RPCs run through those wrappers.

The ladder, per cluster (line anchors inside `persistDirtyChangesAsync`):

1. **No payloads** (2078) → throw a formatted "add notes / min 0.01 h" `DatabaseError` naming the block's time range.
2. **Draft cluster split >1** (2084) → throw ("save once, then edit splits").
3. **Single payload, single row** (2089–2139):
   - draft id (`isDraftPeopleHoursSessionId`) → **INSERT `clock_sessions`** (requires clocked-out + `effectiveSubjectUserId`), carrying `job_ledger_id`/`bid_id` from the row;
   - times mismatch DB row (`singleSegmentTimesMatchSession`, 2113) → throw ("add a split first or edit in People → Hours");
   - `peopleHoursGridProportionalSeed` (2117) → **UPDATE** times + notes + job/bid (the proportional-scale commit);
   - else → **UPDATE notes only** (note-only v1).
4. **Single payload, multi row** (2140–2195): boundaries match original rows (+not proportional seed) → per-row notes UPDATE; else if boundaries collapsed to one segment and the cluster lacks shared RPC metadata → `partitionMixedClusterSingleSegmentToRowIntervals` and per-row time UPDATEs (salary-origin rows set the "salary sync may adjust" toast); else require shared RPC metadata (`clusterSharesClockSessionClusterRpcMetadata`, else throw `myTimeClusterPersistRpcMetadataUserMessage`) and run **`replace_*_cluster_mixed`** with `attachAllocationsToPayloads`.
5. **Multi payload, single row** (2196–2202; draft → throw) → **`split_*_segments`** (payloads stripped of job/bid via `stripJobBidForSegmentRpc`).
6. **Multi payload, homogeneous job/bid + shared metadata** (2203) → **`split_*_cluster`**.
7. **Multi payload, mixed but per-row persistable** (2205–2293, `mixedClusterSegmentsAllowPerRowPersist`): ordered 1:1 row↔segment path (`everySegmentAssignablePerRowOrdered`) does per-row notes-or-times UPDATEs; else per-row containment loop (`segmentContainedInRow`) mixing UPDATEs and `split_*_segments`.
8. **Multi payload, mixed, no shared metadata** (2294–2326) → `coalescedMixedClusterPartitionForSave` per-row time+notes UPDATEs (or throw); salary-origin rows set the sync toast.
9. **Fallback** (2327–2333): shared metadata required → `replace_*_cluster_mixed` with allocations.

**A tested twin of branches 5/6/7/9 already exists.** [`persistMyTimeClusterForSegmentAssign.ts`](../src/lib/persistMyTimeClusterForSegmentAssign.ts) `persistMyTimeClusterAndGetSegmentIds` ("the same multi-segment persistence as Dashboard My Time Save for one cluster", 7 cases since v2.3017) runs single-row split → homogeneous cluster split → per-row (ordered / containment) → replace-mixed with injected RPCs (`MyTimeClusterPersistRpcsForAssign`), and carries its own copy of `stripJobBidForSegmentRpc`. It differs from the Save ladder: no draft guard on the single-row branch, **no coalesced branch 8** (it goes straight to replace-mixed), and it returns segment ids. Do not swap one for the other without a parity test.

**Dirty computation** (`effectiveDirtyIds` memo, 2372–2396; `isDirty` 2399): union of `listDirtyClusterIds` (split-state diff vs `initialSnapshot`, open-session last boundary excluded), `listClustersDirtyFromJobBidChange` (job/bid drifted from `initialJobBidBySessionIdRef`), and all **draft** clusters (always dirty). If empty and `peopleHoursGridProportionalSeed`, **all** clusters become dirty and `isOnlyProportionalSeed = true` (amber banner 2777–2793; Cancel hidden).

**Approved-session guard:** both `requestSave` and `resolveAssignSessionForSegment` `await confirmDialog({ message, confirmLabel: 'Continue' })` (the `useConfirmDialog` service since v2.1877; was `window.confirm`) when a dirty cluster has `approved_at` rows and the change is not note-only-safe (`noteOnlyApprovedSafe`) — splits/time changes remove approved hours from payroll until re-approved.

**Recommended seam (documented, not done):** Stage A — move the module-scope kernels (see inventory) to `src/lib/` with tests. Stage B — move `persistDirtyChangesAsync` verbatim into `src/lib/myTimeDayPersist.ts` (or `useMyTimeDayPersist`) taking `{clusters, splitByCluster, nowMs, rpcs, effectiveSubjectUserId, dateStr, proportionalSeed}` explicitly — reuse the `MyTimeClusterPersistRpcsForAssign` injection shape; **same ladder, same error messages, same sequencing**. Converging branches 5/6/7/9 onto `persistMyTimeClusterAndGetSegmentIds` is a follow-up behind a parity test, not part of the move.

---

## Stage-A pure-logic inventory

Everything in the first two rows (and `formatDurationMs` in the third) is **module-scope in the modal file today** (108–244), unexported and untested — extraction is cut/paste + tests. Already out and tested: `myTimeDayTimeline.ts` (45 cases across `myTimeDayTimeline.test.ts`, `.finalizeInnerBoundary`, `.overlapWarning`), `myTimeDaySavePlan.ts` (32 cases across `myTimeDaySavePlan.test.ts`, `.assignableOrdered`, `.coalescedPartition`, `.mergeBlock`), `myTimeMixedClusterSingleSegmentPartition.ts` (7), `persistMyTimeClusterForSegmentAssign.ts` (7), `applyScheduleProportionsToClockSession.ts` (7), `resolveCalendarWorkday.ts` (11), `salaryZonedWallClock.ts` (6).

| Proposed lib file | Functions (lines today) | Notes |
|---|---|---|
| `src/lib/myTimeDayEditorPayloads.ts` | `buildPayloads` 131–155, `singleSegmentTimesMatchSession` 158–170, `stripJobBidForSegmentRpc` 172–178 | The save-gate kernels: blank-note rejection, `MIN_SEGMENT_MS` enforcement (open-last uses `nowMs`), UPDATE-vs-RPC decision. Highest test value — `canSave` (2027–2061) and every persist branch hang off `buildPayloads`. `stripJobBidForSegmentRpc` is **duplicated verbatim** in `persistMyTimeClusterForSegmentAssign.ts` (line 20, unexported) — export one copy, delete the other. |
| `src/lib/myTimeDayEditorDirty.ts` | `comparableSplit` 193–199, `listDirtyClusterIds` 201–216, `sessionJobBidKey` 218–220, `listClustersDirtyFromJobBidChange` 223–244, `noteOnlyApprovedSafe` 180–190 | The dirty/approved-safety family. `comparableSplit`'s open-session last-boundary exclusion is the quirk that keeps ticking clocks from looking dirty — test it. |
| `src/lib/myTimeDayEditorDefaults.ts` (or fold into an existing my-time lib) | `computeAddDisjointDefaults` 1046–1062 logic (a `useCallback` closing over `sortedSessions`/`nowTick`/`dateStr` — take them as args), `formatDurationMs` 108–111 | Low value alone; ride along with region 8's cleanup. Check for an existing duration formatter first. |
| `myTimeDayTimeline.ts` (add) | strip-Y ↔ ms geometry, **inlined 3×**: `pointerMoveRef.current` body 1597–1617 (relative drag, quirk 9), `stripTapEndRef.current` body 1644–1672 (tap), `handleStripPointerDown` 1910–1916 (Alt-click) | `t0 + (y / rect.height) * (t1 - t0)` with the `rect.height > 0` guard; a `stripYToMs({y, height, t0, t1})` kernel pins it. |
| const beside the fetch | the `clock_sessions` column list, duplicated at 660 and 696 (day-fetch effect and `fetchDaySessionsForEditor`) | v2.3676 had to add `quick_add_minutes` twice; one `DAY_EDITOR_SESSION_COLUMNS` const. |
| add tests only (already in `lib/`, untested) | `forceClockOutDefaultOut.ts` (36), `peopleHoursManualDraftSession.ts` (36), `splitOwnClockSessionSegments.ts` (87) / `leaderClockSessionSplit.ts` (75) / `salaryScheduleSync.ts` (53) RPC wrappers | Not moves. The two small pure files are cheap; the wrappers need a supabase mock and matter mainly for the arg-shape (`p_*` names). |

Constants that move with their consumers: `STRIP_TAP_MOVE_THRESHOLD_PX` (114), `NCNS_DETAILS_MAX_LEN` (116), `MY_TIME_BOUNDARY_DRAG_BODY_CLASS` (119), the `StripTapSession` (121–129) / `MergeJobChoiceState` (246–258) types.

---

## Per-region dossiers

### 0. Shell + edit-window gating

- **Render location:** overlay div (fixed, z **1200**, backdrop → `handleBackdropClose`) 2591–2603; dialog box 2604–2620 (`role="dialog"` at 2617; max-width `min(920px, 96vw)`, maxHeight 94vh); header 2621–2697 (title `modalTitleText` 1111–1115 = person · **short** friendly date · optional "— punch times locked"; `layoutModeToggleEl` Visual/Form toggle; `clockedSubtitle` 1118–1123 "3.02 h clocked · N sessions" via `formatDurationMs` (its JSDoc's "3h 1m" is stale) at 2685; `sessionsSpanDenverSubtitle` 1133–1146 at 2690); branch ladder 2698–2775 (`!inSaveableRange` copy → prior-week ack screen 2704–2760 → `sessionsFetchError` → loading (`pendingAuthForFetch` / `sessionsLoading` / `salarySchedulePrefetchBusy`) → empty-day hint → editor); the **second footer** for non-editable/empty days 3134–3214 (duplicates the NCNS + Not-coming-in buttons — quirk 12). A block at 2671–2683 (`!myTimeCompactLayout`) places the desktop toggle.
- **Owned state (permanent):** `priorWeekAck` (363 + reset effect 364–366), `layoutMode` (1509); derived consts `fenceOverridden`/`saveableRange`/`inSaveableRange`/`inCurrentWeek`/`needsPriorWeekAck`/`effectiveEditable`/`priorWeekGateActive`/`allowTimelineEdits`/`allowPunchTimeActions`/`showNotComingInControl` (355–378); memos `modalTitlePerson` (618–623), `modalTitleText`, `clockedSubtitle`, `layoutModeToggleEl` (1511–1561); `desktopHeaderTitleNarrow` (1563); `myTimeCompactLayout` (extracted `useMyTimeCompactMergeMedia`, ≤520px, 1510).
- **Also permanent:** the Escape capture listener (2573–2587), `requestSave`/`requestDiscard`/`confirmDiscard`, `closeTopmostSubFlow`, the footer button rows, and `saving`/`error`/`discardConfirmOpen` (counted under region 7).

### 1. Session data engine — the shared substrate

- **Location:** 396–402 state, 564–711, 827–831, 1008–1146. See [The shared substrate](#the-shared-substrate).
- **Owned state (8):** `authUserId`, `authReady` (auth effect 564–575), `fetchedSessions`, `sessionsLoading`, `sessionsFetchError`, `sessionsFetchNonce`, `resolvedSubjectLabel` (+ loader effect 580–616 querying `users.name`), `nowTick` (1019 + 15s interval effect 1020–1025).
- **Derived:** `effectiveSubjectUserId` (577, = `subjectUserIdProp ?? authUserId`), `editingSelf` (578), `pendingAuthForFetch` (711), `resolvedSessions` (prop-or-fetched, `normalizeDayEditorSession`d — carries `quick_add_minutes`), `sortedSessions`, `sessionsKey`, `sessionClusters`, `timelineItems`, `dayStartMs`/`dayEndMs` (1129)/`totalDur` (1130), `dayTotalClockedMs` (1099–1107), `sessionsSpanDenverSubtitle`, `addDisjointExistingIntervals` (1032–1039), `dayHasNoJobAssignments` (1744–1747).
- **Handlers:** the day-fetch effect (625–682; skips when `sessionsProp` supplied, `!inSaveableRange`, or no subject; re-runs on `sessionsFetchNonce`), `fetchDaySessionsForEditor` (689–705; same query as a callable, used by the NCNS pre-close sweep).
- **Supabase:** `clock_sessions` SELECT (`user_id` + `work_date`, `rejected_at IS NULL`, `revoked_at IS NULL`; columns incl. `origin`, `salary_segment_index`, `quick_add_minutes` — list duplicated at 660/696), `users` SELECT name.
- **Tests:** `normalizeDayEditorSession`, clustering, overlap, `buildDayTimeline`, `daySpanMs` in `myTimeDayTimeline.test.ts`; the effects are untested.
- **Extraction:** `useMyTimeDaySessions` hook returning the whole bundle, **kept in the shell** and destructured (playbook rule 4). Do this only after the leaf regions are out — every region's props come from here.

### 2. Salary-schedule prefetch + empty-day hints

- **Location:** reset effect 684–687; main effect 713–821, gated on `prefetchSalarySessionsWhenEmpty && sessionsProp.length === 0 && fetchedSessions?.length === 0 && inSaveableRange`, once per `${userId}|${dateStr}` (via `salaryStripPrefetchDoneKeyRef`, 403); clear-on-sessions effect 823–825.
- **Owned state (3):** `salarySchedulePrefetchBusy`, `stripEmptyDayHint` (`'time_off' | 'no_work' | null`), `stripTimeOffLabel` (default `UNPAID_TIME_OFF_LABEL`), 404–406.
- **Flow:** probe `salary_work_schedule_templates` (`maybeSingle`) → if a template exists, load `salary_work_schedule_day_overrides` + `user_time_off` in parallel → `resolveCalendarWorkday` → `time_off`/`none` set the hint; a real workday runs `syncSalaryClockSessionsForUserDay` (792; RPC **`sync_salary_clock_sessions_for_user_day`**) then bumps `sessionsFetchNonce`.
- **Reads from shell:** `effectiveSubjectUserId`, `dateStr`, `inSaveableRange`, `sessionsLoading`, `fetchedSessions`, `showToast`. Writes: hint state + the nonce. (The fact sheet's `error` read for effect@713 is the local `const { error }` at 792, not the shell's `error` state.)
- **Extraction:** `useMyTimeSalaryPrefetch({enabled, userId, dateStr, sessionsEmpty, onInvalidate, showToast}) → {busy, emptyDayHint, timeOffLabel}`. **Low risk, clean slice.**

### 3. Job/bid label loader

- **Location:** 910–1006. Owned: `extraJobLabels`, `extraBidLabels` (910–911, + reset effect 913–916 on user/date), `jobLabelsRef`/`bidLabelsRef` (918–919) + serialized dep strings; loader effect 925–1000.
- **Flow:** diff session `job_ledger_id`/`bid_id` sets against merged label maps; batch-fetch missing via RPC **`get_jobs_ledger_by_ids`** / **`get_bids_by_ids`**; format with `formatJobLedgerSummaryLine`/`formatBidLedgerSummaryLine` (+ `prefixMap` from `useLedgerPrefixMap`); fallback `Job <id8>…`/`Bid <id8>…` (also the catch path).
- **Outputs:** `mergedJobLabels` (1002–1005), `mergedBidLabels` (1006) — consumed by both cluster renderers and the merge flow.
- **Extraction:** `useMyTimeJobBidLabels({sessions, jobLabels, bidLabels, prefixMap}) → {mergedJobLabels, mergedBidLabels}`. **Low risk, clean slice** — self-contained per the fact sheet (no other writer, no shell read besides `sortedSessions`).

### 4. Split-editor state + gesture engine

- **Location:** store 1148–1247 + 1354–1375; gesture plumbing 1564–1672, 1790–2015.
- **Owned state (3 + 13 refs):** `splitByCluster`, `initialSnapshot` (read by region 7's dirty memo), `focusedHandle` (1581; set from the Visual renderer's `onFocusHandle` prop lambda at 2910, so the hook must hand that setter out); refs `initialJobBidBySessionIdRef`, `splitByClusterRef`/`sessionClustersRef`/`nowTickRef` (1373–1375), `stripRefs` (1564), `dragRef` (`DragCtx`, 1565–1576), `stripTapSessionRef`, `pointerMoveRef`/`stripTapMoveRef`/`stripTapEndRef` (1578–1580), `focusedHandleRef`, `cancelStripTapGestureRef` (1641), `endBoundaryDragListenersRef` (1790).
- **Effects (4):** (a) the **seed effect keyed on `sessionsKey` only** (1153–1177, eslint-disable at 1176 — quirk 3): rebuilds `splitByCluster` via `initialClusterSplitState`, snapshots `comparableSplit` per cluster and `sessionJobBidKey` per session; (b) the open-session boundary tick (1179–1203, `setLastBoundary` on `nowTick`); (c) `layoutMode` change cancels gestures + clears `focusedHandle` (1829–1833); (d) unmount cleanup releasing pointer capture + window listeners + the `my-time-boundary-dragging` body class (1958–1988).
- **Handlers:** `patchCluster` (1205–1223; routes `SplitAction`s through `splitReducer`; merge actions pre-checked by `myTimeClusterMergeWouldBlockPersist` → toast `myTimeClusterMergeBlockedUserMessage`), `applyInnerBoundaryDragMs` (1225–1247) + `commitInnerBoundary` (1354–1371; `finalizeInnerBoundaryMsForCluster` snap), the render-time ref bodies `pointerMoveRef.current` (1597–1617; **relative pointer delta** via `grabStripY`/`originBoundaryMs` — quirk 9) / `stripTapMoveRef.current` (1619–1625) / `stripTapEndRef.current` (1644–1672; tap-to-add-split snapped via `snapTapMsToNearestJoin`/`ROW_JOIN_SNAP_MS` then `repairMixedClusterSplitForRowContainment`), `stable*` trampolines (1585–1595, 1792–1794), `cancelStripTapGesture` (1627–1639), `endBoundaryDragListeners` (1796–1825), `cancelBoundaryDrag` (1835–1854), `startDrag` (1856–1884), `handleStripPointerDown` (1886–1956; `STRIP_TAP_MOVE_THRESHOLD_PX` cancel; **Alt/Option+click moves the focused boundary** — quirk 10), `handleStripKeyDown` (1990–2015; ±60s Arrow nudge + finalize).
- **Cross-region coupling:** the save engine, `canSave` and the dirty memo read this store; the merge flow (5) and assign flow (6) mutate/read it; both cluster renderers receive `split` + `patchClusterAction` + gesture callbacks per cluster.
- **Tests:** `splitReducer`, `initialClusterSplitState`, `cloneSplitState`, `snapBoundaryMs`/`snapTapMsToNearestJoin`, `finalizeInnerBoundaryMsForCluster`, `repairMixedClusterSplitForRowContainment` covered in `myTimeDayTimeline*.test.ts`; the pointer/keyboard plumbing and the inline Y→ms math are not.
- **Extraction:** two hooks — `useMyTimeSplitEditor` (store + seed/tick effects + `patchCluster` + merge guard) and `useMyTimeBoundaryGestures` (refs + pointer plumbing, taking the store's setters). **High risk**; do after the save seam so the store's shape is pinned by tests.

### 5. Merge-segments job-choice flow

- **Location:** `MergeJobChoiceState` type 246–258; `openMergeJobChoiceForCluster` 1249–1309 (builds upper/lower labels via `segmentAllocationLabelsForOverlap`, allocs via `effectiveSegmentJobBid`, merged note via `mergeSegmentNotes`, default choice by direction; pre-blocks via `myTimeClusterMergeWouldBlockPersist`); `confirmMergeJobChoice` 1311–1352 (merge action + `setSegmentJobOverride` + `setNote` on the absorber index); modal mount 3217–3228 (z 1300).
- **Owned state:** `mergeJobChoice` (1507).
- **Sub-components:** `MyTimeMergeSegmentsModal` (**extracted**; `MyTimeSegmentMergeDirectionModal` also lives in the folder for the cluster renderers).
- **Tests:** every kernel it calls is tested (`myTimeDaySavePlan.mergeBlock`, `.test.ts` labels/per-segment views, `mergeSegmentNotes` in `myTimeDayTimeline.test.ts`); the two handlers are not.
- **Extraction:** the two handlers belong in the region-4 hook (they are pure `splitByCluster` mutations); the modal mount stays shell (opened from both layouts). **Medium**, rides with region 4.

### 6. Assign job/bid + Apply Schedule %

- **Location:** `draftLocalJobBidAssign` 430–439 / `handleAssignJobSaved` 441–453; `resolveAssignSessionForSegment` 1675–1741; `dayHasNoJobAssignments` 1744–1747 / `showApplyScheduleProportions` 1748; `applyScheduleProportionsToCluster` 1757–1788; `AssignFocusModal` mount 3229–3240 (z 1300). The per-segment assign popover (`AssignSessionJobPopover`) renders inside the cluster components.
- **Owned state:** `assignBulk` (1506, `{sessionIds, label}`) — the `AssignFocusModal` open state. None of this region's handlers write it: the setter goes down as the `setAssignBulk` prop to both cluster renderers (2912, 2955), which open it; the mount's `onClose`/`onSaved` (→ `handleAssignJobSaved`) and `closeTopmostSubFlow` clear it.
- **Money-path handlers:**
  - `resolveAssignSessionForSegment(clusterId, segIdx)`: if `assignJobNeedsPersistedSplits`, builds payloads, runs the approved-session `confirmDialog` when needed, then **persists the split immediately** via `persistMyTimeClusterAndGetSegmentIds` (1718) with the own/leader RPC trio (`fenceOverridden` forces leader), bumps the nonce, and returns the fresh segment row id for the popover to target. Sets `saving`/`error` around the write.
  - `applyScheduleProportionsToCluster(clusterId, picks)`: v1 scope single closed non-draft row; delegates to [`applyScheduleProportionsToClockSession`](../src/lib/applyScheduleProportionsToClockSession.ts) with `editingSelf` + `fenceOverridden` (splits by Dispatch schedule shares and assigns jobs), then nonce bump + conditional `onSaved`. Gate `showApplyScheduleProportions` requires `dayHasNoJobAssignments && allowTimelineEdits && !priorWeekGateActive`.
  - `handleAssignJobSaved(patch?)`: skips draft ids, bumps nonce, `onLinkedSessionsUpdated`, and `onSaved` only in controlled mode.
  - `draftLocalJobBidAssign`: patches seeded draft rows via the `onPatchSeededSessionsJobBid` prop instead of the DB.
- **Tests:** both delegated kernels tested (v2.3017, v2.3029); the handlers' approved guard, `saving` bracketing and controlled/self-fetch fork are not.
- **Coupling:** writes DB mid-edit (before Save) — the same "immediate write" hazard class as JobFormModal §21. Keep in the shell until the persist seam exists.

### 7. Dirty tracking + save engine + close paths

Documented in [The save engine](#the-save-engine--payroll-path). Additional pieces: `editorInitialized` (2018) + `canSave` (2027–2061; also pre-validates mixed-cluster partition feasibility so Save is disabled rather than throwing), `effectiveDirtyIds`/`isOnlyProportionalSeed` memo (2372–2396), `isDirty` (2399), the amber proportional-seed banner (2777–2793), `error` paragraph (3020), footer Cancel/Save (3087–3130; Cancel hidden when `isOnlyProportionalSeed` — quirk 6; label "Cancel" when dirty else "Close"; Save rendered only when `isDirty`), and the discard confirm dialog (3891–3978, z 1320). Owned state: `saving` (1380), `error` (1381), `discardConfirmOpen` (2541) — `saving`/`error` are shared, not region-local: region 6's two handlers also set both, and `saving` is read by the layout toggle, the gesture engine (`handleStripPointerDown`, the `stripTapEndRef` body), the Escape listener, both cluster renderers, "+ Add session" and both footers, so they stay in the shell. **Tests: none for anything in this file's region** — the save-plan predicates it calls are tested in `lib/`, but `buildPayloads`, the dirty family, `canSave` and the ladder are not (risk flag).

### 8. Punch-time sub-flows

- **Force clock-out:** `forceClockOutSession` (407) + `onForceClockOutSaved` 455–459 / `openForceClockOut` 461–463; mounts **extracted** [`ForceClockOutModal`](../src/components/people/ForceClockOutModal.tsx) (3241–3253, z 1300) — the modal owns the DB write.
- **Adjust times:** `adjustTimesSession` (408) + `onAdjustTimesSaved` 465–469 / `openAdjustTimes` 471–473 + **`draftLocalAdjustTimes` 480–493** (draft ids only: patches the parent seed via `onPatchSeededSessionsTimes` in controlled mode, else `fetchedSessions`; the draft INSERT branch persists on Save); mounts **extracted** [`AdjustClockSessionTimesModal`](../src/components/AdjustClockSessionTimesModal.tsx) (3254–3272, z 1300) with `onSaveLocal` + `showToast` passed only for draft ids.
- **Reject session:** `rejectSessionConfirm`/`rejectSessionBusyId`/`rejectSessionError` (413–416); `handleRejectSession` 499–513 (draft rows get an explanatory toast instead), `closeRejectSessionModal` 515–519, `confirmRejectSession` 521–562 — **UPDATE `clock_sessions.rejected_at/rejected_by`** then RPC **`recompute_people_hours_after_session_edit`** (546; the incremental-`people_hours` resync — quirk 7), nonce bump, conditional `onSaved`. The confirm dialog is **inline** (3392–3511, z 1310) with approved-hours warning (3441–3457) and error block (3458–3474).
- **Add session (disjoint):** `addDisjointOpen` (409) + `computeAddDisjointDefaults` 1046–1062 (last end +1h gap, +2h duration; empty day → 8 AM `APP_CALENDAR_TZ` wall via `salaryZonedWallClockToUtcMs`) + `handleAddDisjointConfirm` 1070–1097 (appends a normalized draft row with seeded `notes: 'Disjoint session'` into `fetchedSessions`; persisted by the draft INSERT branch on Save); mounts **extracted** [`AddDisjointSessionModal`](../src/components/my-time-day-editor/AddDisjointSessionModal.tsx) (3273–3283, z 1300). The bordered "+ Add session" button (2984–3017, since v2.1598) is gated to self-fetch editable instances only (quirk 15).
- All four appear as callbacks/gates on both cluster renderers (`onForceClockOut`/`onAdjustTimes`/`onRejectSession` passed only when `allowPunchTimeActions && !saving`; `rejectSessionBusyId` is passed to both as well).
- **Tests:** none — `forceClockOutDefaultOut`, `peopleHoursManualDraftSession` and the three modals are untested; only `salaryZonedWallClock` (6) is.
- **Extraction:** move the inline reject dialog to `my-time-day-editor/MyTimeRejectSessionDialog.tsx` (props: session, busy, error, onCancel, onConfirm); handlers stay shell (they touch the nonce + `authUserId`). Low-medium.

### 9. NCNS flow (no-call-no-show)

- **Location:** state 417–428; `job_schedule_blocks` probe effect 833–868 (`subjectHasScheduleBlocksForDay`, only when `allowNcnsFromMyTime && !editingSelf`); gates `ncnsHasOpenSession` 870 / `ncnsClickAllowed` 871–879 / `ncnsButtonTitle` 887–908; reset-on-day effect 881–885; handlers `runRecordNcns` 1383–1415 / `enterNcnsDialogFromSessions` 1417–1423 / `forceClockOutOpenSessionsThenOpenNcns` 1425–1462 / `closeNcnsPrecloseModal` 1464–1468 / `handleNcnsPrecloseContinue` 1470–1475 / `handleNcnsHeaderClick` 1477–1504; pre-close dialog 3284–3391 (z 1305); the 3-phase dialog 3512–3804 (z 1310: `simple` 3546–3638 / `approved_warn` 3639–3690 / `approved_confirm` 3691–3801 with `ncnsPayrollAck` checkbox + `ncnsDetails` textarea, `NCNS_DETAILS_MAX_LEN` 4000); footer buttons 3061–3085 and 3174–3198.
- **Owned state (8):** `ncnsUi` (`NcnsUiPhase`), `ncnsPayrollAck`, `ncnsDetails`, `ncnsBusy`, `ncnsError`, `ncnsPrecloseOpenSessions`, `ncnsPrecloseError`, `subjectHasScheduleBlocksForDay`.
- **Supabase:** `job_schedule_blocks` SELECT probe; `clock_sessions` UPDATE `clocked_out_at` (the pre-close sweep via `forceClockOutDefaultOutIso`, then refetch-and-verify); RPC **`record_ncns_and_reject_sessions_for_day`** (`p_subject_user_id`, `p_work_date`, optional `p_details`; returns `rejected_count`/`had_approved_sessions`/`error_message`). Success → `onSaved()` + `onClose()`.
- **Shared reads/writes:** reads `sortedSessions`, `effectiveSubjectUserId`, `editingSelf`, `allowPunchTimeActions`, `sessionsLoading` + `pendingAuthForFetch` (the click gate/title), `saving` (footer buttons), `sessionsProp.length`, `fetchDaySessionsForEditor`, `modalTitlePerson`, `dateStr`, `showToast`; writes `fetchedSessions` (sweep). Outside readers/writers of its state: `closeTopmostSubFlow` (reads `ncnsUi`/`ncnsBusy`/`ncnsPrecloseOpenSessions`; clears `ncnsUi`, `ncnsPayrollAck`, `ncnsDetails`, `ncnsPrecloseOpenSessions`) and both footers (read `ncnsBusy`, `ncnsPrecloseOpenSessions`).
- **Tests:** none.
- **Extraction:** **best first Stage-B.** `useMyTimeNcnsFlow` (state + probe + handlers) + `MyTimeNcnsDialogs` (pre-close + 3-phase JSX, ~400 lines) + a small button component; ~600 lines leave the file with a narrow prop surface. Keep the `closeTopmostSubFlow` entries by exposing `{isOpen, closeTopmost}` from the hook.

### 10. Not-coming-in flow

- **Location:** gate `showNotComingInControl` 374–377 + `markNotComingInBusy`/`notComingInConfirmOpen` 379–380 + `handleNotComingInClick`/`confirmMarkNotComingIn` 381–394; confirm dialog 3805–3890 (z 1320); buttons 3041–3060 (editable footer) and 3154–3173 (second footer).
- **No supabase** — delegates entirely to the `onMarkNotComingIn` prop (parent runs the staff time-off RPC + refresh).
- **Outside readers/writers:** `closeTopmostSubFlow` reads both states and clears `notComingInConfirmOpen` (unless busy); both footers read `markNotComingInBusy`.
- **Extraction:** trivial — `MyTimeNotComingInConfirm` + keep the two-line handler pair in the shell or move them too. **Momentum builder.** The discard confirm (3891–3978) is the same yes/no shell and can ride in the same PR as JSX-only.

### 11. Timeline body render

- **Location:** 2811–3018, the `myTimeDayTimelineScroll` div: `timelineItems.map` (2831) renders gap strips ("Off clock · Nh", flex-scaled by duration), per-cluster overlap warning banners (`hasPairwiseClockIntervalOverlap` with `CLOCK_OVERLAP_WARNING_EPS_MS`, 2863–2867), then `MyTimeDayClusterVisual` (2891) or `MyTimeDayClusterForm` (2937) (both **extracted**) with the ~30-prop bundle (33 Visual / 30 Form) (split, labels, gesture callbacks, assign/merge/punch-action callbacks, `showApplyScheduleProportions`, dividers via `getNextSessionClusterInTimeline`); the "+ Add session" tail (2984–3017). The compact-layout toggle row sits just above (≤2810).
- **Owned state:** none — pure composition over regions 1/4/6/8.
- **Extraction:** leave last; once regions 4/6 have hook seams this collapses naturally into a `MyTimeDayTimelineBody` taking the two hook outputs.

---

## Test coverage

No test file mounts, mocks or names `DashboardMyTimeDayEditorModal` (`git grep` over `*.test.ts(x)` and `e2e/` finds none) — there is no `*.render.test.tsx` for the modal, so the shell, the sub-flow registry and every dialog are unguarded against wiring breaks. Coverage is entirely in the `lib/` kernels it calls:

| Kernel | Test file(s) | Cases | Regions |
|---|---|---|---|
| `myTimeDayTimeline.ts` | `myTimeDayTimeline.test.ts`, `.finalizeInnerBoundary.test.ts`, `.overlapWarning.test.ts` | 37 + 4 + 4 | 1, 4, 5, 11 |
| `myTimeDaySavePlan.ts` | `myTimeDaySavePlan.test.ts`, `.assignableOrdered`, `.coalescedPartition`, `.mergeBlock` | 18 + 3 + 6 + 5 | 5, 6, 7 |
| `myTimeMixedClusterSingleSegmentPartition.ts` | colocated | 7 | 7 |
| `persistMyTimeClusterForSegmentAssign.ts` | colocated | 7 | 6 (and the twin of ladder branches 5/6/7/9) |
| `applyScheduleProportionsToClockSession.ts` | colocated | 7 | 7 |
| `resolveCalendarWorkday.ts` | colocated | 11 | 2 |
| `salaryZonedWallClock.ts` | colocated | 6 | 8 (`computeAddDisjointDefaults` is its only caller here) |
| `ledgerDisplayPrefixes.ts` | colocated | `formatJobLedgerSummaryLine` only; `formatBidLedgerSummaryLine` untested | 3 |

**Untested money math (risk flags):** the 8 module-scope kernels (`buildPayloads`, `singleSegmentTimesMatchSession`, `stripJobBidForSegmentRpc`, `noteOnlyApprovedSafe`, `comparableSplit`, `listDirtyClusterIds`, `sessionJobBidKey`, `listClustersDirtyFromJobBidChange`); `canSave`; the `persistDirtyChangesAsync` ladder (single-payload branches 1–4 and coalesced branch 8 have no tested twin at all); `confirmRejectSession`'s UPDATE + `people_hours` resync pairing; `runRecordNcns`; the own/leader RPC wrappers.

---

## Preserve-quirks list (odd but load-bearing — do not "fix" during the move)

1. **`editableRange` prop is legacy and ignored** (`void _editableRangeProp` at 355) — callers may still pass it; removing the prop is an API change, not a refactor.
2. **`fenceOverridden` forces the `leader_*` RPCs even for self-edits** (in `persistDirtyChangesAsync`, `resolveAssignSessionForSegment` and — since v2.3834, via the kernel's `fenceOverridden` option — `applyScheduleProportionsToCluster`; before that its kernel picked by `editingSelf` alone and a fence-overridden self split hit the `own_*` week check) — the `own_*` RPCs stay week-fenced server-side; pay-access users pass `can_edit_clock_sessions_for_user` for themselves.
3. **The split-seed effect depends only on `sessionsKey`** (explicit eslint-disable at 1176): job/bid label refetches produce a new `sortedSessions` array ref and must **not** wipe in-editor splits. Any hook extraction must keep this exact dependency shape.
4. **Open-session dirtiness:** `comparableSplit` drops the last boundary for open sessions and `nowTick` only ticks (15s) while an open session exists — otherwise a live clock would make every open day permanently dirty.
5. **Draft sessions** (`DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX`): always dirty, INSERT-on-save, cannot be split before first save, reject shows an explainer toast instead of the dialog, assign patches go through `onPatchSeededSessionsJobBid` and Adjust-times patches through `onPatchSeededSessionsTimes` / `fetchedSessions` (`draftLocalAdjustTimes`) — never a DB UPDATE (the non-uuid `draft:people-hours:` id fails).
6. **`peopleHoursGridProportionalSeed` contract:** zero user edits still persists **all** clusters on Save; Cancel is hidden (`isOnlyProportionalSeed`) so the People → Hours grid keeps its "Close = Save" behavior; the seed path uses the times-UPDATE branch (not notes-only).
7. **Reject must pair the raw `rejected_at` UPDATE with RPC `recompute_people_hours_after_session_edit`** — `people_hours` is maintained incrementally (approve +, reject −); skipping the resync freezes payroll hours (this was a real prod bug).
8. **The persist branch ladder order is semantic** (single payload: draft INSERT → times-mismatch throw → proportional UPDATE → note-only → per-row notes / row-partition / replace-mixed; multi payload: split segments → split cluster → per-row → coalesced → replace-mixed — branches 3–9 above) and its `DatabaseError` messages are user-facing copy. Move verbatim.
9. **Boundary drag is relative-delta** (`grabStripY` / `originBoundaryMs`), not absolute-position; grabbing a handle off-center must not jump the boundary.
10. **Alt/Option+click** on a strip moves the *focused* inner boundary to the click Y; plain click/tap adds a split, snapped to row joins (`ROW_JOIN_SNAP_MS`) and repaired for row containment. Taps that travel > `STRIP_TAP_MOVE_THRESHOLD_PX` (8px) are cancelled.
11. **Approved-hours confirm** appears in two places (Save and per-segment assign persist) with identical copy via `useConfirmDialog` (`confirmLabel: 'Continue'`) — keep both, and keep them awaited before `setSaving(true)`.
12. **Two footers** render the NCNS / Not-coming-in buttons (editable path 3041–3085; non-editable/empty path 3154–3198) — an extracted button component must mount in both.
13. **Salary-origin partition saves** (`origin === 'salary_schedule'`) show the "salary sync may adjust rows" info toast after Save.
14. **z-index ladder:** main overlay 1200 → sub-modals (merge/assign/force/adjust/add session) 1300 → NCNS pre-close 1305 → reject + NCNS dialogs 1310 → not-coming-in + discard confirms 1320. Escape uses a **capture-phase** window listener and drains `discardConfirmOpen` → `closeTopmostSubFlow` → `requestDiscard` in that order. The `useConfirmDialog` service renders outside this ladder (z 3000, its own capture-phase `document` Escape listener); window-capture runs first, so Escape on the approved-hours confirm likely also reaches this modal's handler (→ `requestDiscard`) — unverified in a browser, flag before touching either listener. Routing the not-coming-in or discard confirms through the service would change the Escape order — a behavior change, not a move.
15. **Add session only in self-fetch mode** (`sessionsProp.length === 0`): pushing a synthetic draft into parent-controlled state is unsafe. The seeded `notes: 'Disjoint session'` is required — `buildPayloads` rejects blank notes.
16. **`onSaved` fires from sub-flows only in controlled mode** (`sessionsProp.length > 0`: reject, `handleAssignJobSaved`, Apply Schedule %; force clock-out, adjust-times and the per-segment split persist never fire it); self-fetch mode relies on `sessionsFetchNonce` + `onLinkedSessionsUpdated` so the modal stays open. The exception is NCNS: a successful record always fires `onSaved()` + `onClose()`.
17. **The session column list is written twice** (660, 696) and must stay identical — the NCNS pre-close verify reads through `fetchDaySessionsForEditor`, the editor through the effect.

---

## Recommended extraction order (value ÷ risk)

Re-ranked at a05cef4c4 — the order holds; what changed is that the lib-test gaps named in the 2026-07 step 1 are mostly closed (v2.2958–v2.3029), so step 1 is now only the module-scope kernels.

1. **Stage A sweep** — `myTimeDayEditorPayloads.ts` + `myTimeDayEditorDirty.ts` kernels with tests (pins `canSave`, the dirty gate, and the note-only-safe predicate before anything moves); export the single `stripJobBidForSegmentRpc` and delete the duplicate; add `stripYToMs` to `myTimeDayTimeline.ts`; hoist the session column list; tests for `forceClockOutDefaultOut` + `peopleHoursManualDraftSession`.
2. **Not-coming-in flow** → `MyTimeNotComingInConfirm` (+ the discard confirm JSX) — trivial, zero shared writes, validates the sub-flow seam and the dual-footer button pattern.
3. **NCNS flow** → `useMyTimeNcnsFlow` + `MyTimeNcnsDialogs` — largest self-contained slice (~600 lines), one shared write (`fetchedSessions`), big win.
4. **Reject dialog** → `MyTimeRejectSessionDialog` (120 lines JSX only; handlers stay shell).
5. **Job/bid labels** → `useMyTimeJobBidLabels` (fully self-contained); **salary prefetch** → `useMyTimeSalaryPrefetch` (one shared write, the nonce) — independent vertical hooks.
6. **Save-engine seam** → `persistDirtyChangesAsync` verbatim into `lib/myTimeDayPersist.ts` (explicit inputs, RPC trio injected in the `MyTimeClusterPersistRpcsForAssign` shape) — after step 1's tests exist. Highest risk; its own PR. Parity test against `persistMyTimeClusterAndGetSegmentIds` before any convergence.
7. **Split editor + gestures** → `useMyTimeSplitEditor` + `useMyTimeBoundaryGestures`; the merge-choice handlers (region 5) move into the split hook.
8. **Session data engine** → `useMyTimeDaySessions` (shell keeps and destructures it); then the timeline body collapses into `MyTimeDayTimelineBody`.

**What must stay in the parent (shell), permanently:** the props contract + edit-window gating (fence, prior-week ack, `clockTimesReadOnly` forks), `sessionsFetchNonce` ownership (or its `onSessionsInvalidated` successor), the `closeTopmostSubFlow` registry, `requestSave`/`requestDiscard` + the discard confirm state, `saving`/`error`, the `onSaved`/`onLinkedSessionsUpdated`/`onClose` plumbing, the layout-mode toggle, the sub-modal mounts opened from both cluster layouts (merge, assign, force clock-out, adjust times, add session), and both footers.

Definition of done per region, verification gates, and anti-patterns: see [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) (`npm run typecheck && npm run lint && npm test` green after every step; behavior-preserving only).
