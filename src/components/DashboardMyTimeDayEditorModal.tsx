import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  leaderReplaceClockSessionClusterMixed,
  leaderSplitClockSessionCluster,
  leaderSplitClockSessionSegments,
} from '../lib/leaderClockSessionSplit'
import {
  replaceOwnClockSessionClusterMixed,
  splitOwnClockSessionCluster,
  splitOwnClockSessionSegments,
} from '../lib/splitOwnClockSessionSegments'
import { AssignFocusModal } from './AssignFocusModal'
import { AdjustClockSessionTimesModal } from './AdjustClockSessionTimesModal'
import { ForceClockOutModal } from './people/ForceClockOutModal'
import {
  assignJobNeedsPersistedSplits,
  clockSessionRowForSegmentAssign,
} from '../lib/myTimeDaySavePlan'
import { persistMyTimeClusterAndGetSegmentIds } from '../lib/persistMyTimeClusterForSegmentAssign'
import {
  MY_TIME_SALARY_SYNC_SAVED_NOTE,
  myTimeDaySaveUsesLeaderRpcs,
  persistMyTimeDayDirtyClusters,
} from '../lib/myTimeDayPersist'
import {
  buildPayloads,
  dayEditorClusterCanSave,
} from '../lib/myTimeDayEditorPayloads'
import {
  dayEditorEffectiveDirty,
  noteOnlyApprovedSafe,
} from '../lib/myTimeDayEditorDirty'
import { applyScheduleProportionsToClockSession } from '../lib/applyScheduleProportionsToClockSession'
import type { DispatchScheduledJobForAssign } from '../lib/jobScheduleBlocks'
import {
  sessionClusterId,
  normalizeDayEditorSession,
  type DayEditorSession,
} from '../lib/myTimeDayTimeline'
import {
  type AssignSessionJobPopoverSession,
  type AssignSessionJobSavedPatch,
} from './clock-sessions/AssignSessionJobPopover'
import { useMyTimeCompactMergeMedia } from './my-time-day-editor/useMyTimeCompactMergeMedia'
import {
  MyTimeMergeSegmentsModal,
  type MergeJobAllocOption,
} from './my-time-day-editor/MyTimeMergeSegmentsModal'
import { useToastContext } from '../contexts/ToastContext'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, DatabaseError, withSupabaseRetry } from '../utils/errorHandling'
import {
  APP_CALENDAR_TZ,
  denverCalendarDayKey,
  formatDenverBlockDateHeader,
  formatWorkDateYmdWeekdayLongFriendly,
  formatWorkDateYmdWeekdayShortFriendly,
  getDefaultWeekRange,
  getThisAndLastWeekRange,
} from '../utils/dateUtils'
import type { UnifiedSearchResult } from '../utils/unifiedJobBidSearch'
import {
  DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX,
  isDraftPeopleHoursSessionId,
} from '../lib/peopleHoursManualDraftSession'
import { salaryZonedWallClockToUtcMs } from '../lib/salaryZonedWallClock'
import { AddDisjointSessionModal } from './my-time-day-editor/AddDisjointSessionModal'
import { MyTimeDiscardChangesConfirm } from './my-time-day-editor/MyTimeDiscardChangesConfirm'
import {
  MyTimeNcnsButton,
  MyTimeNcnsDialog,
  MyTimeNcnsPrecloseDialog,
} from './my-time-day-editor/MyTimeNcnsDialogs'
import { MyTimeRejectSessionDialog } from './my-time-day-editor/MyTimeRejectSessionDialog'
import { useMyTimeJobBidLabels } from './my-time-day-editor/useMyTimeJobBidLabels'
import { useMyTimeNcnsFlow } from './my-time-day-editor/useMyTimeNcnsFlow'
import { useMyTimeSalaryPrefetch } from './my-time-day-editor/useMyTimeSalaryPrefetch'
import { useMyTimeSplitEditor } from './my-time-day-editor/useMyTimeSplitEditor'
import { useMyTimeBoundaryGestures } from './my-time-day-editor/useMyTimeBoundaryGestures'
import { useMyTimeDaySessions } from './my-time-day-editor/useMyTimeDaySessions'
import { MyTimeDayTimelineBody } from './my-time-day-editor/MyTimeDayTimelineBody'
import { formatDurationMs } from './my-time-day-editor/myTimeDayEditorDatetime'
import {
  MyTimeNotComingInButton,
  MyTimeNotComingInConfirm,
} from './my-time-day-editor/MyTimeNotComingInConfirm'
import { emptyDayLine } from '../lib/myTimeSalaryPrefetch'

export type { DayEditorSession }

type Props = {
  dateStr: string
  sessions: DayEditorSession[]
  /** When set, edits that user's clock sessions (team lead / pay access). Empty sessions triggers a fetch for dateStr. */
  subjectUserId?: string | null
  subjectDisplayName?: string | null
  /**
   * Legacy prop; ignored for gating. The modal uses America/Chicago **this week + last week** for save/edit
   * (`getThisAndLastWeekRange()`), with a prior-week acknowledgment step for days outside the current week.
   */
  editableRange?: { start: string; end: string }
  jobLabels?: Record<string, string>
  bidLabels?: Record<string, string>
  onClose: () => void
  onSaved: () => void
  /** Refresh parent lists (e.g. dashboard clock strip) when job/bid link changes without full save — avoids closing the modal when only `onSaved` would dismiss. */
  onLinkedSessionsUpdated?: () => void
  /**
   * Dev / master / assistant: allow recording NCNS for another user's day (rejects sessions + attendance incident).
   * Omit or false for self My Time.
   */
  allowNcnsFromMyTime?: boolean
  /** Strip-origin team day: show "Not coming in" (unpaid day off) in footer. Requires `subjectUserId`. */
  showMarkNotComingIn?: boolean
  /** Called after confirm; parent runs staff time-off RPC + refresh. */
  onMarkNotComingIn?: () => void | Promise<void>
  /** Dashboard clock preview: allow splits/assign/notes; disable Adjust times, force clock-out, reject, NCNS. */
  clockTimesReadOnly?: boolean
  /** Dashboard strip Today → My Time: show “Salaried” under each Visual cluster’s vertical strip when pay config is salary. */
  showSalariedLabelUnderVisualStrip?: boolean
  /**
   * Dashboard strip: when the day loads with zero `clock_sessions`, run salary sync (unless unpaid time off / no schedule)
   * so split schedule rows materialize before editing.
   */
  prefetchSalarySessionsWhenEmpty?: boolean
  /**
   * People Hours grid: proportional scale pre-fills `sessions` so initial snapshot matches the target times.
   * Without this, Close sees no dirty clusters and skips persist. When true, empty dirty still persists all clusters.
   */
  peopleHoursGridProportionalSeed?: boolean
  /**
   * When the modal is driven by parent-supplied sessions (e.g. People Hours draft / proportional seed),
   * draft rows are not in `clock_sessions` yet — assign popover calls this instead of updating the DB.
   */
  onPatchSeededSessionsJobBid?: (args: {
    sessionId: string
    job_ledger_id: string | null
    bid_id: string | null
  }) => void
  /**
   * Same seeded-draft contract as `onPatchSeededSessionsJobBid`, for Adjust times: draft rows
   * are not in `clock_sessions` yet, so the adjust modal patches the parent's seed instead of
   * running a DB UPDATE (which fails on the non-uuid `draft:people-hours:` id).
   */
  onPatchSeededSessionsTimes?: (args: {
    sessionId: string
    clocked_in_at: string
    clocked_out_at: string | null
    work_date: string
  }) => void
  /**
   * Pay-access origin (Draft Payroll Hours breakdown): replaces the default this+last-week
   * (America/Chicago) save fence with this inclusive YMD range. Caller must gate on pay access;
   * the leader split/replace RPCs enforce the same bypass server-side
   * (pay_access_clock_week_fence_bypass()). While set, saves route through the leader RPCs even
   * for self-edits — the own_* RPCs stay week-fenced.
   */
  saveableRangeOverride?: { start: string; end: string } | null
}

export function DashboardMyTimeDayEditorModal({
  dateStr,
  sessions: sessionsProp,
  subjectUserId: subjectUserIdProp,
  subjectDisplayName,
  editableRange: _editableRangeProp,
  jobLabels = {},
  bidLabels = {},
  onClose,
  onSaved,
  onLinkedSessionsUpdated,
  allowNcnsFromMyTime = false,
  showMarkNotComingIn = false,
  onMarkNotComingIn,
  clockTimesReadOnly = false,
  showSalariedLabelUnderVisualStrip = false,
  prefetchSalarySessionsWhenEmpty = false,
  peopleHoursGridProportionalSeed = false,
  onPatchSeededSessionsJobBid,
  onPatchSeededSessionsTimes,
  saveableRangeOverride = null,
}: Props) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  void _editableRangeProp
  const fenceOverridden = saveableRangeOverride != null
  const saveableRange = saveableRangeOverride ?? getThisAndLastWeekRange()
  const currentWeekRange = getDefaultWeekRange()
  const inSaveableRange = dateStr >= saveableRange.start && dateStr <= saveableRange.end
  const inCurrentWeek =
    dateStr >= currentWeekRange.start && dateStr <= currentWeekRange.end
  const needsPriorWeekAck = inSaveableRange && !inCurrentWeek
  const [priorWeekAck, setPriorWeekAck] = useState(false)
  useEffect(() => {
    setPriorWeekAck(false)
  }, [dateStr])
  const effectiveEditable = inSaveableRange && (inCurrentWeek || priorWeekAck)
  const priorWeekGateActive = needsPriorWeekAck && !priorWeekAck
  /** Splits, merges, notes, assign prep, strip interactions (preview from clock allows these). */
  const allowTimelineEdits = effectiveEditable
  /** Adjust-times modal, force clock-out, reject, NCNS (disabled in dashboard clock preview). */
  const allowPunchTimeActions = effectiveEditable && !clockTimesReadOnly

  const showNotComingInControl =
    !clockTimesReadOnly &&
    showMarkNotComingIn === true &&
    Boolean(subjectUserIdProp?.trim())

  const [markNotComingInBusy, setMarkNotComingInBusy] = useState(false)
  const [notComingInConfirmOpen, setNotComingInConfirmOpen] = useState(false)
  const handleNotComingInClick = useCallback(() => {
    if (!onMarkNotComingIn) return
    setNotComingInConfirmOpen(true)
  }, [onMarkNotComingIn])
  const confirmMarkNotComingIn = useCallback(async () => {
    if (!onMarkNotComingIn) return
    setMarkNotComingInBusy(true)
    try {
      await Promise.resolve(onMarkNotComingIn())
    } finally {
      setMarkNotComingInBusy(false)
      setNotComingInConfirmOpen(false)
    }
  }, [onMarkNotComingIn])

  const {
    authUserId,
    effectiveSubjectUserId,
    editingSelf,
    modalTitlePerson,
    fetchedSessions,
    setFetchedSessions,
    sessionsLoading,
    sessionsFetchError,
    setSessionsFetchNonce,
    bumpSessionsFetchNonce,
    fetchDaySessionsForEditor,
    resolvedSessions,
    pendingAuthForFetch,
    sortedSessions,
    sessionsKey,
    nowTick,
    sessionClusters,
  } = useMyTimeDaySessions({ dateStr, sessionsProp, subjectUserIdProp, subjectDisplayName, inSaveableRange })
  const [forceClockOutSession, setForceClockOutSession] = useState<DayEditorSession | null>(null)
  const [adjustTimesSession, setAdjustTimesSession] = useState<DayEditorSession | null>(null)
  const [addDisjointOpen, setAddDisjointOpen] = useState<{
    defaultClockInIso: string
    defaultClockOutIso: string
  } | null>(null)
  const [rejectSessionConfirm, setRejectSessionConfirm] = useState<DayEditorSession | null>(null)
  const [rejectSessionBusyId, setRejectSessionBusyId] = useState<string | null>(null)
  /** Per-sub-flow error so reject failures show inside the reject dialog (not behind it). */
  const [rejectSessionError, setRejectSessionError] = useState<string | null>(null)

  const draftLocalJobBidAssign = useCallback(
    (target: AssignSessionJobPopoverSession, selection: UnifiedSearchResult | null) => {
      onPatchSeededSessionsJobBid?.({
        sessionId: target.id,
        job_ledger_id: selection?.source === 'job' ? selection.id : null,
        bid_id: selection?.source === 'bid' ? selection.id : null,
      })
    },
    [onPatchSeededSessionsJobBid],
  )

  const handleAssignJobSaved = useCallback(
    (patch?: AssignSessionJobSavedPatch) => {
      if (patch?.sessionId && isDraftPeopleHoursSessionId(patch.sessionId)) {
        return
      }
      setSessionsFetchNonce((n) => n + 1)
      onLinkedSessionsUpdated?.()
      if (sessionsProp.length > 0) {
        onSaved()
      }
    },
    [sessionsProp.length, onSaved, onLinkedSessionsUpdated, setSessionsFetchNonce],
  )

  const onForceClockOutSaved = useCallback(() => {
    setSessionsFetchNonce((n) => n + 1)
    onLinkedSessionsUpdated?.()
    setForceClockOutSession(null)
  }, [onLinkedSessionsUpdated, setSessionsFetchNonce])

  const openForceClockOut = useCallback((s: DayEditorSession) => {
    setForceClockOutSession(s)
  }, [])

  const onAdjustTimesSaved = useCallback(() => {
    setSessionsFetchNonce((n) => n + 1)
    onLinkedSessionsUpdated?.()
    setAdjustTimesSession(null)
  }, [onLinkedSessionsUpdated, setSessionsFetchNonce])

  const openAdjustTimes = useCallback((s: DayEditorSession) => {
    setAdjustTimesSession(s)
  }, [])

  /**
   * Adjust-times save for draft sessions (`draft:people-hours:` ids): the row isn't in the DB yet,
   * so patch it in memory — the parent's seed when sessions are seeded, `fetchedSessions` when the
   * modal owns them. The existing draft INSERT in `persistDirtyChangesAsync` persists the new times.
   */
  const draftLocalAdjustTimes = useCallback(
    (update: { clocked_in_at: string; clocked_out_at: string | null; work_date: string }) => {
      const target = adjustTimesSession
      if (!target) return
      if (sessionsProp.length > 0) {
        onPatchSeededSessionsTimes?.({ sessionId: target.id, ...update })
      } else {
        setFetchedSessions((prev) =>
          prev ? prev.map((s) => (s.id === target.id ? { ...s, ...update } : s)) : prev,
        )
      }
    },
    [adjustTimesSession, sessionsProp.length, onPatchSeededSessionsTimes, setFetchedSessions],
  )

  /**
   * Per-segment reject updates one `clock_sessions` row (same target as adjust times / assign).
   * Virtual-split overlap edge case: only that row is rejected; user may need another reject.
   */
  const handleRejectSession = useCallback(
    (session: DayEditorSession) => {
      if (!session.clocked_out_at) return
      if (isDraftPeopleHoursSessionId(session.id)) {
        showToast(
          'This block isn\u2019t saved yet \u2014 Close will save it as a pending session that can be approved or rejected from People \u2192 Hours.',
          'info',
        )
        return
      }
      setRejectSessionError(null)
      setRejectSessionConfirm(session)
    },
    [showToast],
  )

  const closeRejectSessionModal = useCallback(() => {
    if (rejectSessionBusyId != null) return
    setRejectSessionError(null)
    setRejectSessionConfirm(null)
  }, [rejectSessionBusyId])

  const confirmRejectSession = useCallback(
    async (session: DayEditorSession) => {
      if (!session.clocked_out_at) return
      if (isDraftPeopleHoursSessionId(session.id)) {
        setRejectSessionConfirm(null)
        return
      }
      setRejectSessionBusyId(session.id)
      setRejectSessionError(null)
      try {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .update({
                rejected_at: new Date().toISOString(),
                rejected_by: authUserId ?? null,
              })
              .eq('id', session.id),
          'reject clock session from my time day editor',
        )
        // people_hours is maintained incrementally (approve +duration / reject -duration); a raw
        // rejected_at update bypasses that, freezing the day's payroll hours. Resync from the
        // remaining approved sessions server-side — the same RPC the Adjust-times save path uses.
        await withSupabaseRetry(
          async () => supabase.rpc('recompute_people_hours_after_session_edit', { p_session_id: session.id }),
          'recompute people_hours after reject',
        )
        setRejectSessionConfirm(null)
        setSessionsFetchNonce((n) => n + 1)
        onLinkedSessionsUpdated?.()
        if (sessionsProp.length > 0) {
          onSaved()
        }
      } catch (e: unknown) {
        setRejectSessionError(formatErrorMessage(e, 'Could not reject session'))
      } finally {
        setRejectSessionBusyId(null)
      }
    },
    [authUserId, onLinkedSessionsUpdated, onSaved, sessionsProp.length, setSessionsFetchNonce],
  )

  const {
    busy: salarySchedulePrefetchBusy,
    emptyDayHint: stripEmptyDayHint,
    timeOffLabel: stripTimeOffLabel,
  } = useMyTimeSalaryPrefetch({
    enabled: prefetchSalarySessionsWhenEmpty,
    sessionsControlledByParent: sessionsProp.length > 0,
    sessionsLoading,
    fetchedSessions,
    resolvedSessionCount: resolvedSessions.length,
    inSaveableRange,
    effectiveSubjectUserId,
    dateStr,
    onSessionsInvalidated: bumpSessionsFetchNonce,
  })

  const ncns = useMyTimeNcnsFlow({
    allowNcnsFromMyTime,
    editingSelf,
    allowPunchTimeActions,
    effectiveSubjectUserId,
    dateStr,
    sortedSessions,
    sessionsLoading,
    pendingAuthForFetch,
    sessionsControlledByParent: sessionsProp.length > 0,
    fetchDaySessionsForEditor,
    setFetchedSessions,
    onLinkedSessionsUpdated,
    onSaved,
    onClose,
  })

  const { mergedJobLabels, mergedBidLabels } = useMyTimeJobBidLabels({
    sortedSessions,
    jobLabels,
    bidLabels,
    effectiveSubjectUserId,
    dateStr,
  })

  const addDisjointExistingIntervals = useMemo(
    () =>
      sortedSessions.map((s) => ({
        startMs: new Date(s.clocked_in_at).getTime(),
        endMs: s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : null,
      })),
    [sortedSessions],
  )

  /**
   * "Add disjoint session" defaults: last session end + 1h gap; +2h duration.
   * Empty day -> 8 AM wall (APP_CALENDAR_TZ) + 2h. If the computed window slips
   * into the future, the inner modal's "no future" validator will surface it.
   */
  const computeAddDisjointDefaults = useCallback(() => {
    const last = sortedSessions[sortedSessions.length - 1]
    const lastEndMs = last
      ? last.clocked_out_at
        ? new Date(last.clocked_out_at).getTime()
        : nowTick
      : null
    const baseInMs =
      lastEndMs != null
        ? lastEndMs + 60 * 60 * 1000
        : (salaryZonedWallClockToUtcMs(dateStr, 8, 0, 0, APP_CALENDAR_TZ) ?? Date.now())
    const baseOutMs = baseInMs + 2 * 60 * 60 * 1000
    return {
      defaultClockInIso: new Date(baseInMs).toISOString(),
      defaultClockOutIso: new Date(baseOutMs).toISOString(),
    }
  }, [sortedSessions, nowTick, dateStr])

  /**
   * Pushes a new closed draft session into local state. Save persists it via the
   * existing `isDraftPeopleHoursSessionId` INSERT branch in `persistDirtyChangesAsync`.
   * Only safe when the modal owns its sessions (`sessionsProp.length === 0`); the
   * "+" button is gated accordingly.
   */
  const handleAddDisjointConfirm = useCallback(
    ({
      clockedInIso,
      clockedOutIso,
      workDateYmd,
    }: {
      clockedInIso: string
      clockedOutIso: string
      workDateYmd: string
    }) => {
      const draft = normalizeDayEditorSession({
        id: `${DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX}${crypto.randomUUID()}`,
        clocked_in_at: clockedInIso,
        clocked_out_at: clockedOutIso,
        work_date: workDateYmd,
        // Non-empty default keeps the existing draft INSERT path happy: buildPayloads
        // rejects blank notes, and we deliberately omit a notes field from the inner
        // modal. Users can refine via the per-segment textarea before / after Save.
        notes: 'Disjoint session',
        job_ledger_id: null,
        bid_id: null,
        approved_at: null,
      })
      setFetchedSessions((prev) => [...(prev ?? []), draft])
      setAddDisjointOpen(null)
    },
    [setFetchedSessions],
  )

  const dayTotalClockedMs = useMemo(() => {
    let total = 0
    for (const s of sortedSessions) {
      const start = new Date(s.clocked_in_at).getTime()
      const end = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : nowTick
      total += Math.max(0, end - start)
    }
    return total
  }, [sortedSessions, nowTick])

  // v2.1598: short date so the title never truncates ("Paige · Wed, Aug 12");
  // the day total moved from the title to the clocked-subtitle line below.
  const modalTitleText = useMemo(() => {
    return `${modalTitlePerson} · ${formatWorkDateYmdWeekdayShortFriendly(dateStr)}${
      clockTimesReadOnly ? ' — punch times locked' : ''
    }`
  }, [modalTitlePerson, dateStr, clockTimesReadOnly])

  /** "3h 1m clocked · 1 session" — under the title once sessions are known. */
  const clockedSubtitle = useMemo(() => {
    if (sortedSessions.length === 0) return null
    return `${formatDurationMs(dayTotalClockedMs)} clocked · ${sortedSessions.length} session${
      sortedSessions.length === 1 ? '' : 's'
    }`
  }, [sortedSessions, dayTotalClockedMs])

  /** Option B: subtitle when clock data spans more than one company calendar day. */
  const sessionsSpanDenverSubtitle = useMemo(() => {
    if (sortedSessions.length === 0) return null
    let minT = Infinity
    let maxT = -Infinity
    for (const s of sortedSessions) {
      const a = new Date(s.clocked_in_at).getTime()
      const b = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : nowTick
      minT = Math.min(minT, a, b)
      maxT = Math.max(maxT, a, b)
    }
    if (!Number.isFinite(minT) || !Number.isFinite(maxT)) return null
    if (denverCalendarDayKey(minT) === denverCalendarDayKey(maxT)) return null
    return `Spans ${formatDenverBlockDateHeader(minT, maxT)}`
  }, [sortedSessions, nowTick])

  const {
    splitByCluster,
    setSplitByCluster,
    initialSnapshot,
    initialJobBidBySessionIdRef,
    patchCluster,
    applyInnerBoundaryDragMs,
    openMergeJobChoiceForCluster,
    confirmMergeJobChoice,
    commitInnerBoundary,
    mergeJobChoice,
    setMergeJobChoice,
    splitByClusterRef,
    sessionClustersRef,
    nowTickRef,
  } = useMyTimeSplitEditor({
    sortedSessions,
    sessionsKey,
    sessionClusters,
    nowTick,
    allowTimelineEdits,
    mergedJobLabels,
    mergedBidLabels,
    showToast,
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [assignBulk, setAssignBulk] = useState<{ sessionIds: string[]; label: string } | null>(null)
  /** Default Visual on all viewports; Form via header toggle (wide) or beside session count (≤520px). */
  const [layoutMode, setLayoutMode] = useState<'visual' | 'form'>('visual')
  const myTimeCompactLayout = useMyTimeCompactMergeMedia()
  const layoutModeToggleEl = useMemo(() => {
    if (!effectiveEditable || resolvedSessions.length === 0) return null
    return (
      <div
        role="group"
        aria-label="Visual or form editor"
        style={{
          display: 'inline-flex',
          flexShrink: 0,
          border: '1px solid var(--border-strong)',
          borderRadius: 6,
          overflow: 'hidden',
          fontSize: '0.75rem',
        }}
      >
        <button
          type="button"
          onClick={() => setLayoutMode('visual')}
          disabled={saving}
          style={{
            border: 'none',
            margin: 0,
            padding: '0.35rem 0.65rem',
            background: layoutMode === 'visual' ? 'var(--bg-blue-tint)' : 'var(--surface)',
            color: layoutMode === 'visual' ? 'var(--text-blue-700)' : 'var(--text-700)',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: layoutMode === 'visual' ? 600 : 400,
          }}
        >
          Visual
        </button>
        <button
          type="button"
          onClick={() => setLayoutMode('form')}
          disabled={saving}
          style={{
            border: 'none',
            borderLeft: '1px solid var(--border-strong)',
            margin: 0,
            padding: '0.35rem 0.65rem',
            background: layoutMode === 'form' ? 'var(--bg-blue-tint)' : 'var(--surface)',
            color: layoutMode === 'form' ? 'var(--text-blue-700)' : 'var(--text-700)',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: layoutMode === 'form' ? 600 : 400,
          }}
        >
          Form
        </button>
      </div>
    )
  }, [effectiveEditable, resolvedSessions.length, layoutMode, saving])
  /** Desktop h3 only reserves ~64% when Visual/Form sits on the right; prior-week gate / empty day has no toggle. */
  const desktopHeaderTitleNarrow = !myTimeCompactLayout && layoutModeToggleEl != null
  const {
    stripRefs,
    dragRef,
    stripTapSessionRef,
    setFocusedHandle,
    cancelStripTapGesture,
    cancelBoundaryDrag,
    startDrag,
    handleStripPointerDown,
    handleStripKeyDown,
  } = useMyTimeBoundaryGestures({
    allowTimelineEdits,
    saving,
    nowTick,
    sessionClusters,
    layoutMode,
    setSplitByCluster,
    patchCluster,
    applyInnerBoundaryDragMs,
    splitByClusterRef,
    sessionClustersRef,
    nowTickRef,
  })

  /** Persist UI splits to DB when needed so job/bid assign targets only one segment (single-row + virtual splits). */
  const resolveAssignSessionForSegment = useCallback(
    async (clusterId: string, segIdx: number) => {
      if (!allowTimelineEdits) return null
      const c = sessionClustersRef.current.find((x) => sessionClusterId(x) === clusterId)
      const split = splitByClusterRef.current[clusterId]
      if (!c?.length || !split) return null
      const now = nowTickRef.current
      const row = clockSessionRowForSegmentAssign(c, split, now, segIdx)
      if (!row) return null

      if (!assignJobNeedsPersistedSplits(c, split, now)) {
        return { id: row.id, job_ledger_id: row.job_ledger_id, bid_id: row.bid_id }
      }

      const last = c[c.length - 1]!
      const payloads = buildPayloads(last, split, now)
      if (!payloads || payloads.length < 2) {
        showToast('Add focus notes to each segment before assigning jobs per segment.', 'warning')
        return null
      }

      const dirtyApprovedNeedsRpc =
        c.some((s) => s.approved_at) && !noteOnlyApprovedSafe(c, split, last, now)
      if (dirtyApprovedNeedsRpc) {
        const ok = await confirmDialog({
          message:
            'One or more sessions were already approved. Saving splits or time changes will remove those hours from payroll until a lead approves the new segments again.',
          confirmLabel: 'Continue',
        })
        if (!ok) return null
      }

      setSaving(true)
      setError(null)
      try {
        // Overridden fence (Draft Payroll origin): always use the leader RPCs — the own_* variants
        // stay week-fenced server-side, and pay-access users pass can_edit_clock_sessions_for_user
        // even for their own sessions.
        const rpcs = {
          runSplitSeg: editingSelf && !fenceOverridden ? splitOwnClockSessionSegments : leaderSplitClockSessionSegments,
          runSplitCluster: editingSelf && !fenceOverridden ? splitOwnClockSessionCluster : leaderSplitClockSessionCluster,
          runReplaceMixed: editingSelf && !fenceOverridden ? replaceOwnClockSessionClusterMixed : leaderReplaceClockSessionClusterMixed,
        }
        const segmentIds = await persistMyTimeClusterAndGetSegmentIds(c, split, payloads, now, rpcs)
        const newId = segmentIds[segIdx]
        if (!newId) {
          throw new DatabaseError('Persist did not return an id for this segment.')
        }
        setSessionsFetchNonce((n) => n + 1)
        onLinkedSessionsUpdated?.()
        return {
          id: newId,
          job_ledger_id: row.job_ledger_id,
          bid_id: row.bid_id,
        }
      } catch (e: unknown) {
        showToast(
          formatErrorMessage(e, e instanceof DatabaseError ? e.message : 'Could not prepare segment for assign'),
          'error',
        )
        return null
      } finally {
        setSaving(false)
      }
    },
    [allowTimelineEdits, editingSelf, fenceOverridden, onLinkedSessionsUpdated, showToast, nowTickRef, sessionClustersRef, splitByClusterRef, setSessionsFetchNonce]
  )

  /** True when no session this day is linked to a job/bid — gate for the "Apply Schedule %" action. */
  const dayHasNoJobAssignments = useMemo(
    () => sortedSessions.length > 0 && sortedSessions.every((s) => !s.job_ledger_id && !s.bid_id),
    [sortedSessions],
  )
  const showApplyScheduleProportions =
    dayHasNoJobAssignments && allowTimelineEdits && !priorWeekGateActive

  /**
   * "Apply Schedule %": split the worked session in `clusterId` into segments proportional to the
   * person's Dispatch schedule (each scheduled job's share of total scheduled time) and assign each
   * segment to its job. v1 scope: a single closed, non-draft `clock_sessions` row. Persists
   * immediately (mirrors the per-segment assign flow) and refetches.
   */
  const applyScheduleProportionsToCluster = useCallback(
    async (clusterId: string, picks: DispatchScheduledJobForAssign[]) => {
      if (!allowTimelineEdits) return
      const c = sessionClustersRef.current.find((x) => sessionClusterId(x) === clusterId)
      if (!c?.length) return
      if (c.length !== 1) {
        showToast('Apply Schedule % needs a single continuous session for this day.', 'warning')
        return
      }
      const row = c[0]!

      setSaving(true)
      setError(null)
      try {
        const res = await applyScheduleProportionsToClockSession(row, picks, {
          editingSelf,
          fenceOverridden,
          nowTick: nowTickRef.current,
        })
        if (!res.ok) {
          showToast(res.message, res.kind)
          return
        }
        setSessionsFetchNonce((n) => n + 1)
        onLinkedSessionsUpdated?.()
        if (sessionsProp.length > 0) onSaved()
        showToast('Applied schedule split.', 'success')
      } finally {
        setSaving(false)
      }
    },
    [allowTimelineEdits, editingSelf, fenceOverridden, onLinkedSessionsUpdated, onSaved, sessionsProp.length, showToast, nowTickRef, sessionClustersRef, setSessionsFetchNonce],
  )

  /** Show timeline once effect has seeded split state (do not gate on notes/duration — that blocks empty notes). */
  const editorInitialized =
    sortedSessions.length > 0 &&
    sessionClusters.every((c) => {
      const split = splitByCluster[sessionClusterId(c)]
      if (!split || split.boundaries.length < 2) return false
      return split.notes.length === split.boundaries.length - 1
    })

  /** Save enabled when every cluster can produce valid payloads (non-empty notes, min duration, etc.). */
  const canSave =
    editorInitialized &&
    sessionClusters.every((c) =>
      dayEditorClusterCanSave(c, splitByCluster[sessionClusterId(c)]!, nowTick)
    )

  const persistDirtyChangesAsync = useCallback(
    async (dirty: string[]): Promise<boolean> => {
      try {
        const { salarySyncMayAdjust } = await persistMyTimeDayDirtyClusters({
          dirty,
          sessionClusters,
          splitByCluster,
          nowTick,
          effectiveSubjectUserId,
          dateStr,
          peopleHoursGridProportionalSeed,
          leader: myTimeDaySaveUsesLeaderRpcs(editingSelf, fenceOverridden),
        })
        if (salarySyncMayAdjust) {
          showToast(MY_TIME_SALARY_SYNC_SAVED_NOTE, 'info')
        }
        return true
      } catch (e: unknown) {
        setError(formatErrorMessage(e, e instanceof DatabaseError ? e.message : 'Save failed'))
        return false
      }
    },
    [
      editingSelf,
      fenceOverridden,
      sessionClusters,
      splitByCluster,
      nowTick,
      effectiveSubjectUserId,
      dateStr,
      peopleHoursGridProportionalSeed,
      showToast,
    ]
  )

  /**
   * Single source of truth for "what clusters need to be persisted on Save":
   *  - `effectiveDirtyIds` real user edits (splits / job-bid / draft sessions), extended with
   *    the proportional-seed override so the People → Hours grid contract still persists
   *    scaled state on Save / Close.
   *  - `isOnlyProportionalSeed` true iff the modal needs Save *only* because of the
   *    proportional-seed pre-fill — PR3 uses this to hide Cancel and show the amber
   *    "scaled, not saved yet" banner.
   *
   * Computed once per render via `useMemo` so `requestSave`, `requestDiscard`, the footer
   * buttons, and the banner all read a single consistent snapshot.
   */
  const { effectiveDirtyIds, isOnlyProportionalSeed } = useMemo(
    () =>
      dayEditorEffectiveDirty({
        clusters: sessionClusters,
        sessions: sortedSessions,
        initialSnapshot,
        splitByCluster,
        initialJobBidBySessionId: initialJobBidBySessionIdRef.current,
        proportionalSeed: peopleHoursGridProportionalSeed,
      }),
    [sessionClusters, initialSnapshot, splitByCluster, sortedSessions, peopleHoursGridProportionalSeed, initialJobBidBySessionIdRef]
  )

  /** True whenever the Save button should be visible / enabled (includes the proportional-seed override). */
  const isDirty = effectiveDirtyIds.length > 0

  /**
   * Close the topmost open sub-flow (sub-modal or active gesture) and return true if anything
   * matched. Used by `requestClose`, the Escape key handler, and (after PR3) `requestDiscard` so
   * every entry point dismisses the same sub-flow first instead of leaking through to the main
   * modal close. Busy guards inside each branch (e.g. the NCNS flow's `busy`, `rejectSessionBusyId`) suppress
   * the actual setState while still returning true so the caller stops.
   */
  const ncnsCloseTopmost = ncns.closeTopmost
  const closeTopmostSubFlow = useCallback((): boolean => {
    if (notComingInConfirmOpen) {
      if (!markNotComingInBusy) setNotComingInConfirmOpen(false)
      return true
    }
    if (ncnsCloseTopmost()) return true
    if (mergeJobChoice) {
      setMergeJobChoice(null)
      return true
    }
    if (assignBulk) {
      setAssignBulk(null)
      return true
    }
    if (rejectSessionConfirm) {
      if (rejectSessionBusyId == null) setRejectSessionConfirm(null)
      return true
    }
    if (forceClockOutSession) {
      setForceClockOutSession(null)
      return true
    }
    if (adjustTimesSession) {
      setAdjustTimesSession(null)
      return true
    }
    if (addDisjointOpen) {
      setAddDisjointOpen(null)
      return true
    }
    if (dragRef.current) {
      cancelBoundaryDrag()
      return true
    }
    if (stripTapSessionRef.current) {
      cancelStripTapGesture()
      return true
    }
    return false
  }, [
    setMergeJobChoice,
    dragRef,
    stripTapSessionRef,
    notComingInConfirmOpen,
    markNotComingInBusy,
    ncnsCloseTopmost,
    mergeJobChoice,
    assignBulk,
    rejectSessionConfirm,
    rejectSessionBusyId,
    forceClockOutSession,
    adjustTimesSession,
    addDisjointOpen,
    cancelBoundaryDrag,
    cancelStripTapGesture,
  ])

  /**
   * Commit dirty changes to the database. Wired to the footer Save button. Mirrors the
   * pre-PR3 `requestClose` save path verbatim except it no longer doubles as the close path:
   * Cancel / backdrop / Escape now route through `requestDiscard`, so Save only runs when
   * the user explicitly clicked Save.
   */
  const requestSave = useCallback(async () => {
    if (saving) return
    if (closeTopmostSubFlow()) return
    if (!effectiveEditable || !authUserId) {
      onClose()
      return
    }
    if (effectiveDirtyIds.length === 0) {
      onClose()
      return
    }
    if (!canSave) {
      setError(
        'Add focus notes to each segment and ensure each part is at least 0.01 hours before saving.'
      )
      return
    }
    const dirtyApprovedNeedsRpc = effectiveDirtyIds.some((cid) => {
      const c = sessionClusters.find((x) => sessionClusterId(x) === cid)
      if (!c?.length || !c.some((s) => s.approved_at)) return false
      const split = splitByCluster[cid]
      if (!split) return false
      const last = c[c.length - 1]!
      return !noteOnlyApprovedSafe(c, split, last, nowTick)
    })
    if (dirtyApprovedNeedsRpc) {
      const ok = await confirmDialog({
        message:
          'One or more sessions were already approved. Saving splits or time changes will remove those hours from payroll until a lead approves the new segments again.',
        confirmLabel: 'Continue',
      })
      if (!ok) return
    }
    setSaving(true)
    setError(null)
    try {
      const ok = await persistDirtyChangesAsync(effectiveDirtyIds)
      if (ok) {
        onSaved()
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }, [
    saving,
    closeTopmostSubFlow,
    effectiveDirtyIds,
    effectiveEditable,
    authUserId,
    sessionClusters,
    splitByCluster,
    canSave,
    nowTick,
    onClose,
    onSaved,
    persistDirtyChangesAsync,
  ])

  /** Open by `requestDiscard` when the modal has dirty changes; commits to discard them on confirm. */
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)

  /**
   * Cancel / backdrop / Escape path. Closes any open sub-flow first; if the modal has nothing
   * to discard (not editable, no auth, or already clean) just closes. Otherwise opens the
   * Discard Changes confirm dialog so the user has one safety net before losing edits.
   */
  const requestDiscard = useCallback(() => {
    if (saving) return
    if (closeTopmostSubFlow()) return
    if (!effectiveEditable || !authUserId) {
      onClose()
      return
    }
    if (!isDirty) {
      onClose()
      return
    }
    setDiscardConfirmOpen(true)
  }, [saving, closeTopmostSubFlow, effectiveEditable, authUserId, isDirty, onClose])

  /** "Discard changes" button in the confirm dialog: close the confirm, then dismiss the modal. */
  const confirmDiscard = useCallback(() => {
    setDiscardConfirmOpen(false)
    onClose()
  }, [onClose])

  function handleBackdropClose() {
    if (saving) return
    void requestDiscard()
  }

  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (saving) return
      e.preventDefault()
      if (discardConfirmOpen) {
        setDiscardConfirmOpen(false)
        return
      }
      if (closeTopmostSubFlow()) return
      void requestDiscard()
    }
    window.addEventListener('keydown', onWindowKeyDown, true)
    return () => window.removeEventListener('keydown', onWindowKeyDown, true)
  }, [closeTopmostSubFlow, discardConfirmOpen, requestDiscard, saving])

  return (
    <>
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        paddingTop: 'var(--app-top-chrome, 0px)',
      }}
      onClick={handleBackdropClose}
      role="presentation"
    >
      <div
        style={{
          background: 'var(--surface)',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 360,
          maxWidth: 'min(920px, 96vw)',
          maxHeight: 'min(94vh, 100%)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-labelledby="dashboard-my-time-editor-title"
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: myTimeCompactLayout ? 'flex-start' : 'flex-end',
            gap: myTimeCompactLayout ? 0 : 8,
            minHeight: '1.75rem',
            marginBottom: '0.35rem',
            width: '100%',
          }}
        >
          <h3
            id="dashboard-my-time-editor-title"
            style={
              myTimeCompactLayout
                ? {
                    position: 'relative',
                    margin: 0,
                    fontSize: '1rem',
                    flex: 1,
                    minWidth: 0,
                    lineHeight: 1.25,
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                  }
                : {
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    margin: 0,
                    fontSize: '1rem',
                    maxWidth: desktopHeaderTitleNarrow ? '64%' : '100%',
                    overflow: desktopHeaderTitleNarrow ? 'hidden' : undefined,
                    textOverflow: desktopHeaderTitleNarrow ? 'ellipsis' : undefined,
                    whiteSpace: desktopHeaderTitleNarrow ? 'nowrap' : 'normal',
                    wordBreak: desktopHeaderTitleNarrow ? undefined : 'break-word',
                  }
            }
            aria-describedby={
              needsPriorWeekAck && !priorWeekAck
                ? 'dashboard-my-time-prior-week-notice-desc'
                : sessionsSpanDenverSubtitle
                  ? 'dashboard-my-time-editor-subtitle'
                  : undefined
            }
          >
            {modalTitleText}
          </h3>
          {!myTimeCompactLayout ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              {layoutModeToggleEl}
            </div>
          ) : null}
        </div>
        {clockedSubtitle ? (
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {clockedSubtitle}
          </p>
        ) : null}
        {sessionsSpanDenverSubtitle ? (
          <p
            id="dashboard-my-time-editor-subtitle"
            style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}
          >
            {sessionsSpanDenverSubtitle}
          </p>
        ) : null}
        {!inSaveableRange ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {fenceOverridden
              ? 'This day is outside the pay period.'
              : 'Only this week and last week can be edited from the dashboard (America/Chicago week boundaries). For older days, use People → Hours.'}
          </p>
        ) : needsPriorWeekAck && !priorWeekAck ? (
          <div
            id="dashboard-my-time-prior-week-notice-desc"
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 420 }}
          >
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>
              {fenceOverridden ? 'Editing a payroll-period day' : 'Editing a prior week'}
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
              {fenceOverridden ? (
                <>
                  You are about to change hours for{' '}
                  <strong>{formatWorkDateYmdWeekdayLongFriendly(dateStr)}</strong>, which is outside the normal two-week
                  edit window. You opened this from Draft Payroll; changes affect this pay period&rsquo;s totals and can
                  reset approval status.
                </>
              ) : (
                <>
                  You are about to change hours for{' '}
                  <strong>{formatWorkDateYmdWeekdayLongFriendly(dateStr)}</strong> (last week). Changes can affect payroll
                  and approval status; use People → Hours if you need a different audit path.
                </>
              )}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: 6,
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setPriorWeekAck(true)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: 6,
                  border: '1px solid #2563eb',
                  background: '#2563eb',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                Continue editing
              </button>
            </div>
          </div>
        ) : sessionsFetchError ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-red-700)' }}>{sessionsFetchError}</p>
        ) : pendingAuthForFetch ||
          (sessionsProp.length === 0 && sessionsLoading) ||
          (prefetchSalarySessionsWhenEmpty && salarySchedulePrefetchBusy) ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading sessions…</p>
        ) : resolvedSessions.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {emptyDayLine(stripEmptyDayHint, stripTimeOffLabel)}
          </p>
        ) : (
          <>
            {isOnlyProportionalSeed ? (
              <p
                role="status"
                style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '0.8125rem',
                  color: 'var(--text-amber-800)',
                  background: 'var(--bg-amber-tint)',
                  border: '1px solid var(--border-amber)',
                  borderRadius: 6,
                  padding: '0.5rem 0.65rem',
                  lineHeight: 1.45,
                }}
              >
                These hours were just scaled from People → Hours and aren&rsquo;t saved yet. Click{' '}
                <strong>Save</strong> to commit.
              </p>
            ) : null}
            {/* The "N sessions · punch-editing explainer" line was hidden in
                v2.1463 (user request — it crowded the phone modal); the Visual
                handles remain self-explanatory and the toggle stays. */}
            {myTimeCompactLayout ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  gap: 8,
                  margin: '0 0 0.5rem 0',
                }}
              >
                {layoutModeToggleEl}
              </div>
            ) : null}
            <MyTimeDayTimelineBody
              myTimeCompactLayout={myTimeCompactLayout}
              editorInitialized={editorInitialized}
              sortedSessions={sortedSessions}
              nowTick={nowTick}
              layoutMode={layoutMode}
              saving={saving}
              splitByCluster={splitByCluster}
              patchCluster={patchCluster}
              commitInnerBoundary={commitInnerBoundary}
              openMergeJobChoiceForCluster={openMergeJobChoiceForCluster}
              stripRefs={stripRefs}
              handleStripPointerDown={handleStripPointerDown}
              handleStripKeyDown={handleStripKeyDown}
              startDrag={startDrag}
              setFocusedHandle={setFocusedHandle}
              mergedJobLabels={mergedJobLabels}
              mergedBidLabels={mergedBidLabels}
              setAssignBulk={setAssignBulk}
              handleAssignJobSaved={handleAssignJobSaved}
              resolveAssignSessionForSegment={resolveAssignSessionForSegment}
              allowPunchTimeActions={allowPunchTimeActions}
              openForceClockOut={openForceClockOut}
              openAdjustTimes={openAdjustTimes}
              handleRejectSession={handleRejectSession}
              rejectSessionBusyId={rejectSessionBusyId}
              effectiveSubjectUserId={effectiveSubjectUserId}
              dateStr={dateStr}
              onPatchSeededSessionsJobBid={onPatchSeededSessionsJobBid}
              draftLocalJobBidAssign={draftLocalJobBidAssign}
              showApplyScheduleProportions={showApplyScheduleProportions}
              applyScheduleProportionsToCluster={applyScheduleProportionsToCluster}
              showSalariedLabelUnderVisualStrip={showSalariedLabelUnderVisualStrip}
              clockTimesReadOnly={clockTimesReadOnly}
              effectiveEditable={effectiveEditable}
              priorWeekGateActive={priorWeekGateActive}
              sessionsProp={sessionsProp}
              sessionsLoading={sessionsLoading}
              pendingAuthForFetch={pendingAuthForFetch}
              setAddDisjointOpen={setAddDisjointOpen}
              computeAddDisjointDefaults={computeAddDisjointDefaults}
            />

            {error && <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{error}</p>}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginTop: '1rem',
              }}
            >
              <div
                style={{
                  minHeight: '2.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {showNotComingInControl ? (
                  <MyTimeNotComingInButton
                    busy={markNotComingInBusy}
                    disabled={saving}
                    onClick={handleNotComingInClick}
                  />
                ) : null}
                {allowNcnsFromMyTime && !editingSelf && allowPunchTimeActions ? (
                  <MyTimeNcnsButton flow={ncns} saving={saving} />
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {/* Cancel / Close — hidden in proportional-seed-only mode so the People → Hours grid
                    caller keeps its "Close = Save" contract (no user-visible discard path). */}
                {!isOnlyProportionalSeed ? (
                  <button
                    type="button"
                    onClick={() => requestDiscard()}
                    disabled={saving}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: 'var(--surface)',
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isDirty ? 'Cancel' : 'Close'}
                  </button>
                ) : null}
                {isDirty ? (
                  <button
                    type="button"
                    onClick={() => void requestSave()}
                    disabled={saving || !canSave}
                    title={
                      !canSave
                        ? 'Add focus notes to each segment and ensure each part is at least 0.01 hours'
                        : undefined
                    }
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid #3b82f6',
                      borderRadius: 4,
                      background: '#3b82f6',
                      color: 'white',
                      cursor: saving || !canSave ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      opacity: !canSave ? 0.65 : 1,
                    }}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}
        {(!effectiveEditable || resolvedSessions.length === 0) && !priorWeekGateActive ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginTop: '1rem',
            }}
          >
            <div
              style={{
                minHeight: '2.25rem',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {showNotComingInControl ? (
                <MyTimeNotComingInButton busy={markNotComingInBusy} onClick={handleNotComingInClick} />
              ) : null}
              {allowNcnsFromMyTime && !editingSelf && allowPunchTimeActions ? (
                <MyTimeNcnsButton flow={ncns} saving={saving} />
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>
    {mergeJobChoice ? (
      <MyTimeMergeSegmentsModal
        open
        overlayZIndex={1300}
        upperJobLabel={mergeJobChoice.upperJobLabel}
        lowerJobLabel={mergeJobChoice.lowerJobLabel}
        defaultJobChoice={mergeJobChoice.defaultJobChoice}
        initialMergedFocusNote={mergeJobChoice.initialMergedFocusNote}
        onClose={() => setMergeJobChoice(null)}
        onConfirm={(choice: MergeJobAllocOption, note: string) => confirmMergeJobChoice(choice, note)}
      />
    ) : null}
    {assignBulk ? (
      <AssignFocusModal
        sessionIds={assignBulk.sessionIds}
        label={assignBulk.label}
        overlayZIndex={1300}
        onClose={() => setAssignBulk(null)}
        onSaved={() => {
          handleAssignJobSaved()
          setAssignBulk(null)
        }}
      />
    ) : null}
    {forceClockOutSession && !forceClockOutSession.clocked_out_at ? (
      <ForceClockOutModal
        session={{
          id: forceClockOutSession.id,
          clocked_in_at: forceClockOutSession.clocked_in_at,
          clocked_out_at: forceClockOutSession.clocked_out_at,
          approved_at: forceClockOutSession.approved_at,
        }}
        zIndex={1300}
        onClose={() => setForceClockOutSession(null)}
        onSaved={onForceClockOutSaved}
      />
    ) : null}
    {adjustTimesSession ? (
      <AdjustClockSessionTimesModal
        session={{
          id: adjustTimesSession.id,
          clocked_in_at: adjustTimesSession.clocked_in_at,
          clocked_out_at: adjustTimesSession.clocked_out_at,
          work_date: adjustTimesSession.work_date,
          notes: adjustTimesSession.notes,
          job_ledger_id: adjustTimesSession.job_ledger_id,
          bid_id: adjustTimesSession.bid_id,
          approved_at: adjustTimesSession.approved_at,
        }}
        zIndex={1300}
        onClose={() => setAdjustTimesSession(null)}
        onSaved={onAdjustTimesSaved}
        onSaveLocal={isDraftPeopleHoursSessionId(adjustTimesSession.id) ? draftLocalAdjustTimes : undefined}
        showToast={isDraftPeopleHoursSessionId(adjustTimesSession.id) ? showToast : undefined}
      />
    ) : null}
    {addDisjointOpen ? (
      <AddDisjointSessionModal
        defaultClockInIso={addDisjointOpen.defaultClockInIso}
        defaultClockOutIso={addDisjointOpen.defaultClockOutIso}
        workDateYmd={dateStr}
        existingIntervals={addDisjointExistingIntervals}
        zIndex={1300}
        onClose={() => setAddDisjointOpen(null)}
        onConfirm={handleAddDisjointConfirm}
      />
    ) : null}
    <MyTimeNcnsPrecloseDialog flow={ncns} zIndex={1305} />
    <MyTimeRejectSessionDialog
      session={rejectSessionConfirm}
      dateLabel={formatWorkDateYmdWeekdayLongFriendly(dateStr)}
      busy={rejectSessionBusyId != null}
      error={rejectSessionError}
      onCancel={closeRejectSessionModal}
      onConfirm={(session) => void confirmRejectSession(session)}
      zIndex={1310}
    />
    <MyTimeNcnsDialog
      flow={ncns}
      personLabel={modalTitlePerson}
      dateLabel={formatWorkDateYmdWeekdayLongFriendly(dateStr)}
      zIndex={1310}
    />
    <MyTimeNotComingInConfirm
      open={notComingInConfirmOpen}
      busy={markNotComingInBusy}
      onCancel={() => setNotComingInConfirmOpen(false)}
      onConfirm={() => void confirmMarkNotComingIn()}
      zIndex={1320}
    />
    <MyTimeDiscardChangesConfirm
      open={discardConfirmOpen}
      personLabel={modalTitlePerson}
      dateLabel={formatWorkDateYmdWeekdayLongFriendly(dateStr)}
      onKeepEditing={() => setDiscardConfirmOpen(false)}
      onDiscard={confirmDiscard}
      zIndex={1320}
    />
    </>
  )
}
