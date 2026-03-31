import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  leaderReplaceClockSessionClusterMixed,
  leaderSplitClockSessionCluster,
  leaderSplitClockSessionSegments,
} from '../lib/leaderClockSessionSplit'
import {
  replaceOwnClockSessionClusterMixed,
  splitOwnClockSessionCluster,
  splitOwnClockSessionSegments,
  type SplitClockSegmentPayload,
} from '../lib/splitOwnClockSessionSegments'
import { AssignFocusModal } from './AssignFocusModal'
import {
  assignJobNeedsPersistedSplits,
  attachAllocationsToPayloads,
  clockSessionRowForSegmentAssign,
  effectiveSegmentJobBid,
  everySegmentFullyInsideSomeRow,
  segmentAllocationLabelsForOverlap,
} from '../lib/myTimeDaySavePlan'
import { persistMyTimeClusterAndGetSegmentIds } from '../lib/persistMyTimeClusterForSegmentAssign'
import {
  boundariesMatchOriginalRows,
  buildDayTimeline,
  cloneSplitState,
  CLUSTER_CONTIGUITY_EPS_MS,
  clusterIsHomogeneousJobBid,
  daySpanMs,
  groupTimeContiguousSessionClusters,
  initialClusterSplitState,
  internalRowJoinMs,
  MIN_SEGMENT_MS,
  ROW_JOIN_SNAP_MS,
  segmentContainedInRow,
  sessionRowIntervalMs,
  sessionClusterId,
  snapBoundaryMs,
  mergeSegmentNotes,
  snapTapMsToNearestJoin,
  splitReducer,
  type DayEditorSession,
  type DayTimelineItem,
  type SplitAction,
  type SplitEditorState,
} from '../lib/myTimeDayTimeline'
import { MyTimeDayClusterForm } from './my-time-day-editor/MyTimeDayClusterForm'
import { MyTimeDayClusterVisual } from './my-time-day-editor/MyTimeDayClusterVisual'
import {
  MyTimeMergeSegmentsModal,
  type MergeJobAllocOption,
} from './my-time-day-editor/MyTimeMergeSegmentsModal'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, DatabaseError, withSupabaseRetry } from '../utils/errorHandling'
import {
  denverCalendarDayKey,
  formatDenverBlockDateHeader,
  formatDenverTimeOnly,
  formatWorkDateYmdWeekdayLongFriendly,
  getDefaultWeekRange,
} from '../utils/dateUtils'

export type { DayEditorSession }

function formatDurationMs(ms: number): string {
  const h = ms / 3600000
  return h % 1 === 0 ? `${h.toFixed(1)} h` : `${h.toFixed(2)} h`
}

/** Ignore strip «tap» if the pointer moved more than this (avoids add-split on slight drags). */
const STRIP_TAP_MOVE_THRESHOLD_PX = 8

/** Applied to `document.body` while dragging a Visual split boundary (`grabbing` cursor, teardown). */
const MY_TIME_BOUNDARY_DRAG_BODY_CLASS = 'my-time-boundary-dragging'

type StripTapSession = {
  clusterId: string
  sessions: DayEditorSession[]
  startX: number
  startY: number
  cancelled: boolean
  pointerId: number
  stripEl: HTMLDivElement
}

function buildPayloads(
  session: DayEditorSession,
  split: SplitEditorState,
  nowMs: number
): SplitClockSegmentPayload[] | null {
  const { boundaries, notes } = split
  if (boundaries.length < 2) return null
  const nSeg = boundaries.length - 1
  const payloads: SplitClockSegmentPayload[] = []
  for (let i = 0; i < nSeg; i++) {
    const a = boundaries[i]!
    const b = boundaries[i + 1]!
    const isLast = i === nSeg - 1
    const openLast = !session.clocked_out_at && isLast
    if (!notes[i]?.trim()) return null
    if (!openLast && b - a < MIN_SEGMENT_MS) return null
    if (openLast && nowMs - a < MIN_SEGMENT_MS) return null
    payloads.push({
      clocked_in_at: new Date(a).toISOString(),
      clocked_out_at: openLast ? null : new Date(b).toISOString(),
      notes: notes[i]!.trim(),
    })
  }
  return payloads
}

/** Single-segment save uses UPDATE only when times still match the DB row (note-only v1). */
function singleSegmentTimesMatchSession(session: DayEditorSession, split: SplitEditorState): boolean {
  if (split.boundaries.length !== 2) return false
  const a = split.boundaries[0]!
  const b = split.boundaries[1]!
  const inMs = new Date(session.clocked_in_at).getTime()
  const eps = CLUSTER_CONTIGUITY_EPS_MS
  if (Math.abs(a - inMs) > eps) return false
  if (session.clocked_out_at) {
    const outMs = new Date(session.clocked_out_at).getTime()
    return Math.abs(b - outMs) <= eps
  }
  return true
}

function stripJobBidForSegmentRpc(p: SplitClockSegmentPayload): SplitClockSegmentPayload {
  return {
    clocked_in_at: p.clocked_in_at,
    clocked_out_at: p.clocked_out_at,
    notes: p.notes,
  }
}

function noteOnlyApprovedSafe(
  c: DayEditorSession[],
  split: SplitEditorState,
  last: DayEditorSession,
  nowMs: number
): boolean {
  const payloads = buildPayloads(last, split, nowMs)
  if (!payloads || payloads.length !== 1) return false
  if (c.length === 1) return singleSegmentTimesMatchSession(c[0]!, split)
  return boundariesMatchOriginalRows(c, split, nowMs)
}

/** Open sessions: exclude last boundary from compare so clock ticks do not look dirty. */
function comparableSplit(session: DayEditorSession, split: SplitEditorState): string {
  if (session.clocked_out_at) return JSON.stringify(split)
  return JSON.stringify({
    boundaries: split.boundaries.slice(0, -1),
    notes: split.notes,
  })
}

function listDirtyClusterIds(
  clusters: DayEditorSession[][],
  initial: Record<string, string>,
  splitByCluster: Record<string, SplitEditorState>
): string[] {
  const dirty: string[] = []
  for (const c of clusters) {
    const id = sessionClusterId(c)
    const cur = splitByCluster[id]
    if (!cur) continue
    const last = c[c.length - 1]!
    const key = comparableSplit(last, cur)
    if (initial[id] !== key) dirty.push(id)
  }
  return dirty
}

type MergeJobChoiceState = {
  clusterId: string
  direction: 'prev' | 'next'
  segIdx: number
  openLastCluster: boolean
  upperJobLabel: string
  lowerJobLabel: string
  /** Segment merged into: above → upper, below → lower (matches Merge up / Merge down copy). */
  defaultJobChoice: Extract<MergeJobAllocOption, 'upper' | 'lower'>
  upperAlloc: { job_ledger_id: string | null; bid_id: string | null }
  lowerAlloc: { job_ledger_id: string | null; bid_id: string | null }
  initialMergedFocusNote: string
}

type Props = {
  dateStr: string
  sessions: DayEditorSession[]
  /** When set, edits that user's clock sessions (team lead / pay access). Empty sessions triggers a fetch for dateStr. */
  subjectUserId?: string | null
  subjectDisplayName?: string | null
  /** Inclusive YYYY-MM-DD range allowed for edit/save (defaults to current calendar week). */
  editableRange?: { start: string; end: string }
  jobLabels?: Record<string, string>
  bidLabels?: Record<string, string>
  onClose: () => void
  onSaved: () => void
  /** Refresh parent lists (e.g. dashboard clock strip) when job/bid link changes without full save — avoids closing the modal when only `onSaved` would dismiss. */
  onLinkedSessionsUpdated?: () => void
}

export function DashboardMyTimeDayEditorModal({
  dateStr,
  sessions: sessionsProp,
  subjectUserId: subjectUserIdProp,
  subjectDisplayName,
  editableRange: editableRangeProp,
  jobLabels = {},
  bidLabels = {},
  onClose,
  onSaved,
  onLinkedSessionsUpdated,
}: Props) {
  const { start, end } = editableRangeProp ?? getDefaultWeekRange()
  const editable = dateStr >= start && dateStr <= end

  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [fetchedSessions, setFetchedSessions] = useState<DayEditorSession[] | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsFetchError, setSessionsFetchError] = useState<string | null>(null)
  const [resolvedSubjectLabel, setResolvedSubjectLabel] = useState<string | null>(null)
  const [sessionsFetchNonce, setSessionsFetchNonce] = useState(0)

  const onAssignJobSaved = useCallback(() => {
    setSessionsFetchNonce((n) => n + 1)
    onLinkedSessionsUpdated?.()
    if (sessionsProp.length > 0) {
      onSaved()
    }
  }, [sessionsProp.length, onSaved, onLinkedSessionsUpdated])

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setAuthUserId(data.user?.id ?? null)
        setAuthReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const effectiveSubjectUserId = subjectUserIdProp ?? authUserId
  const editingSelf = !!(authUserId && effectiveSubjectUserId === authUserId)

  useEffect(() => {
    if (subjectDisplayName?.trim()) {
      setResolvedSubjectLabel(subjectDisplayName.trim())
      return
    }
    if (!authUserId) {
      setResolvedSubjectLabel(null)
      return
    }
    const isSelf = !subjectUserIdProp || subjectUserIdProp === authUserId
    const userIdToLoad = isSelf ? authUserId : subjectUserIdProp
    if (!userIdToLoad) {
      setResolvedSubjectLabel(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const row = (await withSupabaseRetry(
          async () => supabase.from('users').select('name').eq('id', userIdToLoad).maybeSingle(),
          'users name for my time editor'
        )) as { name: string | null } | null
        if (cancelled) return
        const n = row?.name?.trim()
        if (isSelf) {
          setResolvedSubjectLabel(n && n.length > 0 ? n : 'You')
        } else {
          setResolvedSubjectLabel(n && n.length > 0 ? n : 'Team member')
        }
      } catch {
        if (!cancelled) setResolvedSubjectLabel(isSelf ? 'You' : 'Team member')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [subjectUserIdProp, authUserId, subjectDisplayName])

  const modalTitlePerson = useMemo(() => {
    const t = resolvedSubjectLabel?.trim()
    if (t) return t
    const selfish = !subjectUserIdProp || (authUserId != null && subjectUserIdProp === authUserId)
    return selfish ? 'You' : 'Team member'
  }, [resolvedSubjectLabel, subjectUserIdProp, authUserId])

  const modalTitleText = useMemo(
    () => `${modalTitlePerson} · ${formatWorkDateYmdWeekdayLongFriendly(dateStr)}`,
    [modalTitlePerson, dateStr]
  )

  useEffect(() => {
    let cancelled = false
    if (sessionsProp.length > 0) {
      setFetchedSessions(null)
      setSessionsFetchError(null)
      setSessionsLoading(false)
      return () => {
        cancelled = true
      }
    }
    if (!effectiveSubjectUserId || !dateStr) {
      setFetchedSessions([])
      setSessionsFetchError(null)
      setSessionsLoading(false)
      return () => {
        cancelled = true
      }
    }
    setSessionsLoading(true)
    setSessionsFetchError(null)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .select('id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id, bid_id, approved_at')
              .eq('user_id', effectiveSubjectUserId)
              .eq('work_date', dateStr)
              .is('rejected_at', null)
              .is('revoked_at', null),
          'clock_sessions day for my time editor'
        )
        if (cancelled) return
        setFetchedSessions((data ?? []) as DayEditorSession[])
      } catch (e: unknown) {
        if (!cancelled) {
          setSessionsFetchError(formatErrorMessage(e, 'Could not load clock sessions'))
          setFetchedSessions([])
        }
      } finally {
        if (!cancelled) setSessionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionsProp.length, effectiveSubjectUserId, dateStr, sessionsFetchNonce])

  const resolvedSessions = sessionsProp.length > 0 ? sessionsProp : (fetchedSessions ?? [])
  const pendingAuthForFetch = sessionsProp.length === 0 && !subjectUserIdProp && !authReady

  const sortedSessions = useMemo(
    () =>
      [...resolvedSessions].sort((a, b) => new Date(a.clocked_in_at).getTime() - new Date(b.clocked_in_at).getTime()),
    [resolvedSessions]
  )

  const [extraJobLabels, setExtraJobLabels] = useState<Record<string, string>>({})
  const [extraBidLabels, setExtraBidLabels] = useState<Record<string, string>>({})

  useEffect(() => {
    setExtraJobLabels({})
    setExtraBidLabels({})
  }, [effectiveSubjectUserId, dateStr])

  const jobLabelsRef = useRef(jobLabels)
  const bidLabelsRef = useRef(bidLabels)
  jobLabelsRef.current = jobLabels
  bidLabelsRef.current = bidLabels
  const jobLabelsSerialized = JSON.stringify(jobLabels)
  const bidLabelsSerialized = JSON.stringify(bidLabels)

  useEffect(() => {
    if (sortedSessions.length === 0) return
    const mergedJob = { ...jobLabelsRef.current, ...extraJobLabels }
    const mergedBid = { ...bidLabelsRef.current, ...extraBidLabels }
    const jobIds = [...new Set(sortedSessions.map((s) => s.job_ledger_id).filter(Boolean))] as string[]
    const bidIds = [...new Set(sortedSessions.map((s) => s.bid_id).filter(Boolean))] as string[]
    const needJobs = jobIds.filter((id) => !mergedJob[id])
    const needBids = bidIds.filter((id) => !mergedBid[id])
    if (needJobs.length === 0 && needBids.length === 0) return

    let cancelled = false
    void (async () => {
      try {
        type JobRow = { id: string; hcp_number: string; job_name: string; job_address: string }
        type BidRow = { id: string; bid_number: string; project_name: string; address: string }
        const [jobsData, bidsData] = await Promise.all([
          needJobs.length > 0
            ? withSupabaseRetry(
                async () => supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: needJobs }),
                'my time editor job labels'
              )
            : Promise.resolve([]),
          needBids.length > 0
            ? withSupabaseRetry(
                async () => supabase.rpc('get_bids_by_ids', { p_bid_ids: needBids }),
                'my time editor bid labels'
              )
            : Promise.resolve([]),
        ])
        if (cancelled) return
        const rows = (jobsData ?? []) as JobRow[]
        const byJobId = new Map(rows.map((j) => [j.id, j]))
        const nextJ: Record<string, string> = {}
        for (const id of needJobs) {
          const j = byJobId.get(id)
          nextJ[id] = j
            ? `J${(j.hcp_number || '').trim() || '—'} · ${j.job_name || '—'} - ${j.job_address || '—'}`
            : `Job ${id.slice(0, 8)}…`
        }
        const bidRows = (bidsData ?? []) as BidRow[]
        const byBidId = new Map(bidRows.map((b) => [b.id, b]))
        const nextB: Record<string, string> = {}
        for (const id of needBids) {
          const b = byBidId.get(id)
          nextB[id] = b
            ? `B${(b.bid_number || '').trim() || '—'} · ${b.project_name || '—'} - ${b.address || '—'}`
            : `Bid ${id.slice(0, 8)}…`
        }
        if (Object.keys(nextJ).length > 0) setExtraJobLabels((prev) => ({ ...prev, ...nextJ }))
        if (Object.keys(nextB).length > 0) setExtraBidLabels((prev) => ({ ...prev, ...nextB }))
      } catch {
        const nextJ: Record<string, string> = {}
        for (const id of needJobs) nextJ[id] = `Job ${id.slice(0, 8)}…`
        const nextB: Record<string, string> = {}
        for (const id of needBids) nextB[id] = `Bid ${id.slice(0, 8)}…`
        if (needJobs.length > 0) setExtraJobLabels((prev) => ({ ...prev, ...nextJ }))
        if (needBids.length > 0) setExtraBidLabels((prev) => ({ ...prev, ...nextB }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sortedSessions, extraJobLabels, extraBidLabels, jobLabelsSerialized, bidLabelsSerialized])

  const mergedJobLabels = useMemo(
    () => ({ ...jobLabels, ...extraJobLabels }),
    [jobLabels, extraJobLabels]
  )
  const mergedBidLabels = useMemo(() => ({ ...bidLabels, ...extraBidLabels }), [bidLabels, extraBidLabels])

  const sessionClusters = useMemo(() => groupTimeContiguousSessionClusters(sortedSessions), [sortedSessions])

  const sessionsKey = useMemo(
    () =>
      sortedSessions
        .map(
          (s) =>
            `${s.id}:${s.clocked_in_at}:${s.clocked_out_at ?? ''}:${s.approved_at ?? ''}:${s.work_date}`
        )
        .join('|'),
    [sortedSessions]
  )

  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const hasOpen = sortedSessions.some((s) => !s.clocked_out_at)
    if (!hasOpen) return
    const t = setInterval(() => setNowTick(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [sortedSessions])

  const timelineItems = useMemo(() => buildDayTimeline(sortedSessions, nowTick), [sortedSessions, nowTick])
  const { dayStartMs, dayEndMs } = useMemo(() => daySpanMs(sortedSessions, nowTick), [sortedSessions, nowTick])
  const totalDur = Math.max(1, dayEndMs - dayStartMs)

  /** Option B: subtitle when clock data spans more than one Denver calendar day. */
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

  const [splitByCluster, setSplitByCluster] = useState<Record<string, SplitEditorState>>({})
  const [initialSnapshot, setInitialSnapshot] = useState<Record<string, string>>({})

  useEffect(() => {
    const now = Date.now()
    const next: Record<string, SplitEditorState> = {}
    const snap: Record<string, string> = {}
    const clusters = groupTimeContiguousSessionClusters(sortedSessions)
    for (const c of clusters) {
      const cid = sessionClusterId(c)
      next[cid] = initialClusterSplitState(c, now)
      const last = c[c.length - 1]!
      snap[cid] = comparableSplit(last, next[cid]!)
    }
    setSplitByCluster(next)
    setInitialSnapshot(snap)
    // Only re-seed when ids/times/approval/work_date change (`sessionsKey`). Job/bid refresh uses a
    // new `sortedSessions` array ref and must not wipe in-editor splits.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read sortedSessions from render when sessionsKey changes
  }, [sessionsKey])

  useEffect(() => {
    setSplitByCluster((prev) => {
      let changed = false
      const next = { ...prev }
      const now = nowTick
      const clusters = groupTimeContiguousSessionClusters(sortedSessions)
      for (const c of clusters) {
        const last = c[c.length - 1]!
        if (!last.clocked_out_at) {
          const cid = sessionClusterId(c)
          if (next[cid]) {
            const updated = splitReducer(next[cid]!, { type: 'setLastBoundary', nowMs: now })
            if (JSON.stringify(updated) !== JSON.stringify(next[cid])) {
              next[cid] = updated
              changed = true
            }
          }
        }
      }
      return changed ? next : prev
    })
  }, [nowTick, sortedSessions])

  const patchCluster = useCallback((clusterId: string, action: SplitAction) => {
    setSplitByCluster((prev) => {
      const cur = prev[clusterId]
      if (!cur) return prev
      return { ...prev, [clusterId]: splitReducer(cur, action) }
    })
  }, [])

  const openMergeJobChoiceForCluster = useCallback(
    (clusterId: string, payload: { direction: 'prev' | 'next'; segIdx: number }) => {
      const c = sessionClusters.find((x) => sessionClusterId(x) === clusterId)
      const split = splitByCluster[clusterId]
      if (!c?.length || !split) return
      const lastS = c[c.length - 1]!
      const openLastCluster = !lastS.clocked_out_at
      const { direction, segIdx } = payload
      const upperSeg = direction === 'prev' ? segIdx - 1 : segIdx
      const lowerSeg = direction === 'prev' ? segIdx : segIdx + 1
      const upperAllocs = segmentAllocationLabelsForOverlap(
        c,
        split,
        nowTick,
        upperSeg,
        mergedJobLabels,
        mergedBidLabels
      )
      const lowerAllocs = segmentAllocationLabelsForOverlap(
        c,
        split,
        nowTick,
        lowerSeg,
        mergedJobLabels,
        mergedBidLabels
      )
      const upperJobLabel = upperAllocs.join(' · ')
      const lowerJobLabel = lowerAllocs.join(' · ')
      const upperAlloc = effectiveSegmentJobBid(c, split, nowTick, upperSeg)
      const lowerAlloc = effectiveSegmentJobBid(c, split, nowTick, lowerSeg)
      const notes = split.notes
      const initialMergedFocusNote =
        direction === 'prev'
          ? mergeSegmentNotes(notes[segIdx - 1] ?? '', notes[segIdx] ?? '')
          : mergeSegmentNotes(notes[segIdx + 1] ?? '', notes[segIdx] ?? '')
      const defaultJobChoice: Extract<MergeJobAllocOption, 'upper' | 'lower'> =
        direction === 'prev' ? 'upper' : 'lower'
      setMergeJobChoice({
        clusterId,
        direction,
        segIdx,
        openLastCluster,
        upperJobLabel,
        lowerJobLabel,
        defaultJobChoice,
        upperAlloc,
        lowerAlloc,
        initialMergedFocusNote,
      })
    },
    [sessionClusters, splitByCluster, nowTick, mergedJobLabels, mergedBidLabels]
  )

  const confirmMergeJobChoice = useCallback((choice: MergeJobAllocOption, mergedFocusNote: string) => {
    const text = mergedFocusNote.trim()
    setMergeJobChoice((m) => {
      if (!m) return null
      const { clusterId, direction, segIdx, openLastCluster, upperAlloc, lowerAlloc } = m
      const mergeAction: SplitAction =
        direction === 'prev'
          ? {
              type: 'removeSegmentMergeWithPrev',
              segIndex: segIdx,
              nowMs: nowTick,
              openLastCluster,
            }
          : {
              type: 'removeSegmentMergeWithNext',
              segIndex: segIdx,
              nowMs: nowTick,
              openLastCluster,
            }
      const absorberIdx = direction === 'prev' ? segIdx - 1 : segIdx
      const picked =
        choice === 'upper'
          ? upperAlloc
          : choice === 'lower'
            ? lowerAlloc
            : { job_ledger_id: null as string | null, bid_id: null as string | null }
      setSplitByCluster((prev) => {
        const cur = prev[clusterId]
        if (!cur) return prev
        let next = splitReducer(cur, mergeAction)
        next = splitReducer(next, {
          type: 'setSegmentJobOverride',
          segIndex: absorberIdx,
          job_ledger_id: picked.job_ledger_id,
          bid_id: picked.bid_id,
        })
        next = splitReducer(next, { type: 'setNote', index: absorberIdx, text })
        return { ...prev, [clusterId]: next }
      })
      return null
    })
  }, [nowTick])

  const commitInnerBoundary = useCallback((clusterId: string, boundaryIndex: number, ms: number) => {
    setSplitByCluster((prev) => {
      const s0 = prev[clusterId]
      const c = sessionClustersRef.current.find((x) => sessionClusterId(x) === clusterId)
      if (!s0 || !c?.length) return prev
      if (boundaryIndex <= 0 || boundaryIndex >= s0.boundaries.length - 1) return prev
      let next = splitReducer(s0, { type: 'drag', index: boundaryIndex, ms })
      const msAt = next.boundaries[boundaryIndex]!
      const prevB = next.boundaries[boundaryIndex - 1]!
      const nextB = next.boundaries[boundaryIndex + 1]!
      const joins = internalRowJoinMs(c, nowTickRef.current)
      const snapped = snapBoundaryMs(msAt, prevB, nextB, joins, ROW_JOIN_SNAP_MS)
      if (snapped !== msAt) {
        next = splitReducer(next, { type: 'drag', index: boundaryIndex, ms: snapped })
      }
      return { ...prev, [clusterId]: next }
    })
  }, [])

  const splitByClusterRef = useRef(splitByCluster)
  const sessionClustersRef = useRef(sessionClusters)
  const nowTickRef = useRef(nowTick)
  splitByClusterRef.current = splitByCluster
  sessionClustersRef.current = sessionClusters
  nowTickRef.current = nowTick

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignBulk, setAssignBulk] = useState<{ sessionIds: string[]; label: string } | null>(null)
  const [mergeJobChoice, setMergeJobChoice] = useState<MergeJobChoiceState | null>(null)
  /* Mobile default Form — matches .myTimeDayClusterFormGrid single-column breakpoint (560px). */
  const [layoutMode, setLayoutMode] = useState<'visual' | 'form'>(() => {
    if (typeof window === 'undefined') return 'visual'
    return window.matchMedia('(max-width: 560px)').matches ? 'form' : 'visual'
  })
  const stripRefs = useRef<Record<string, HTMLDivElement | null>>({})
  type DragCtx = {
    clusterId: string
    index: number
    pointerId: number
    captureEl: Element
    undo: SplitEditorState
  }
  const dragRef = useRef<DragCtx | null>(null)
  const stripTapSessionRef = useRef<StripTapSession | null>(null)
  const pointerMoveRef = useRef<(e: PointerEvent) => void>(() => {})
  const stripTapMoveRef = useRef<(e: PointerEvent) => void>(() => {})
  const stripTapEndRef = useRef<(e: PointerEvent) => void>(() => {})
  const [focusedHandle, setFocusedHandle] = useState<{ clusterId: string; index: number } | null>(null)
  const focusedHandleRef = useRef<{ clusterId: string; index: number } | null>(null)
  focusedHandleRef.current = focusedHandle

  const stableWindowPointerMove = useCallback((e: PointerEvent) => {
    pointerMoveRef.current(e)
  }, [])

  const stableStripTapMove = useCallback((e: PointerEvent) => {
    stripTapMoveRef.current(e)
  }, [])

  const stableStripTapEnd = useCallback((e: PointerEvent) => {
    stripTapEndRef.current(e)
  }, [])

  pointerMoveRef.current = (e: PointerEvent) => {
    const ctx = dragRef.current
    if (!ctx) return
    const { clusterId, index } = ctx
    const el = stripRefs.current[clusterId]
    const split = splitByCluster[clusterId]
    const c = sessionClusters.find((x) => sessionClusterId(x) === clusterId)
    if (!el || !split || !c?.length) return
    const first = c[0]!
    const last = c[c.length - 1]!
    const rect = el.getBoundingClientRect()
    const y = Math.min(Math.max(0, e.clientY - rect.top), rect.height)
    const t0 = new Date(first.clocked_in_at).getTime()
    const t1 = last.clocked_out_at ? new Date(last.clocked_out_at).getTime() : nowTick
    const ms = t0 + (rect.height > 0 ? (y / rect.height) * (t1 - t0) : 0)
    patchCluster(clusterId, { type: 'drag', index, ms })
  }

  stripTapMoveRef.current = (e: PointerEvent) => {
    const s = stripTapSessionRef.current
    if (!s || e.pointerId !== s.pointerId) return
    const dx = e.clientX - s.startX
    const dy = e.clientY - s.startY
    if (Math.hypot(dx, dy) > STRIP_TAP_MOVE_THRESHOLD_PX) s.cancelled = true
  }

  const cancelStripTapGesture = useCallback(() => {
    const s = stripTapSessionRef.current
    if (!s) return
    stripTapSessionRef.current = null
    try {
      s.stripEl.releasePointerCapture(s.pointerId)
    } catch {
      /* already released or unsupported */
    }
    window.removeEventListener('pointermove', stableStripTapMove)
    window.removeEventListener('pointerup', stableStripTapEnd)
    window.removeEventListener('pointercancel', stableStripTapEnd)
  }, [stableStripTapMove, stableStripTapEnd])

  stripTapEndRef.current = (e: PointerEvent) => {
    const s = stripTapSessionRef.current
    if (!s || e.pointerId !== s.pointerId) return
    const wasCancelled = s.cancelled
    const { clusterId, sessions } = s
    const stripEl = s.stripEl
    cancelStripTapGesture()

    if (saving) return
    if (wasCancelled) return

    const c = sessions
    const first = c[0]!
    const last = c[c.length - 1]!
    const rect = stripEl.getBoundingClientRect()
    const y = Math.min(Math.max(0, e.clientY - rect.top), rect.height)
    const t0 = new Date(first.clocked_in_at).getTime()
    const t1 = last.clocked_out_at ? new Date(last.clocked_out_at).getTime() : nowTick
    const ms = t0 + (rect.height > 0 ? (y / rect.height) * (t1 - t0) : 0)
    const joins = internalRowJoinMs(c, nowTick)
    const msSnap = snapTapMsToNearestJoin(ms, joins, ROW_JOIN_SNAP_MS)
    patchCluster(clusterId, { type: 'addSplitAt', ms: msSnap })
  }

  /** Persist UI splits to DB when needed so job/bid assign targets only one segment (single-row + virtual splits). */
  const resolveAssignSessionForSegment = useCallback(
    async (clusterId: string, segIdx: number) => {
      if (!editable) return null
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
        setError('Add focus notes to each segment before assigning jobs per segment.')
        return null
      }

      const dirtyApprovedNeedsRpc =
        c.some((s) => s.approved_at) && !noteOnlyApprovedSafe(c, split, last, now)
      if (dirtyApprovedNeedsRpc) {
        const ok = window.confirm(
          'One or more sessions were already approved. Saving splits or time changes will remove those hours from payroll until a lead approves the new segments again. Continue?'
        )
        if (!ok) return null
      }

      setSaving(true)
      setError(null)
      try {
        const rpcs = {
          runSplitSeg: editingSelf ? splitOwnClockSessionSegments : leaderSplitClockSessionSegments,
          runSplitCluster: editingSelf ? splitOwnClockSessionCluster : leaderSplitClockSessionCluster,
          runReplaceMixed: editingSelf ? replaceOwnClockSessionClusterMixed : leaderReplaceClockSessionClusterMixed,
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
        setError(
          formatErrorMessage(e, e instanceof DatabaseError ? e.message : 'Could not prepare segment for assign')
        )
        return null
      } finally {
        setSaving(false)
      }
    },
    [editable, editingSelf, onLinkedSessionsUpdated]
  )

  const endBoundaryDragListeners = useCallback(() => {
    const ctx = dragRef.current
    if (ctx) {
      try {
        ctx.captureEl.releasePointerCapture(ctx.pointerId)
      } catch {
        /* already released or unsupported */
      }
    }
    dragRef.current = null
    window.removeEventListener('pointermove', stableWindowPointerMove)
    window.removeEventListener('pointerup', endBoundaryDragListeners)
    window.removeEventListener('pointercancel', endBoundaryDragListeners)
    document.body.classList.remove(MY_TIME_BOUNDARY_DRAG_BODY_CLASS)

    if (!ctx) return
    const { clusterId, index } = ctx
    const split = splitByClusterRef.current[clusterId]
    const c = sessionClustersRef.current.find((x) => sessionClusterId(x) === clusterId)
    if (!split || !c?.length) return
    if (index <= 0 || index >= split.boundaries.length - 1) return

    const ms = split.boundaries[index]!
    const prevB = split.boundaries[index - 1]!
    const nextB = split.boundaries[index + 1]!
    const joins = internalRowJoinMs(c, nowTickRef.current)
    const snapped = snapBoundaryMs(ms, prevB, nextB, joins, ROW_JOIN_SNAP_MS)
    if (snapped !== ms) {
      patchCluster(clusterId, { type: 'drag', index, ms: snapped })
    }
  }, [patchCluster, stableWindowPointerMove])

  useEffect(() => {
    cancelStripTapGesture()
    endBoundaryDragListeners()
    setFocusedHandle(null)
  }, [layoutMode, cancelStripTapGesture, endBoundaryDragListeners])

  const cancelBoundaryDrag = useCallback(() => {
    const ctx = dragRef.current
    if (!ctx) return
    const { clusterId, undo } = ctx
    try {
      ctx.captureEl.releasePointerCapture(ctx.pointerId)
    } catch {
      /* */
    }
    dragRef.current = null
    window.removeEventListener('pointermove', stableWindowPointerMove)
    window.removeEventListener('pointerup', endBoundaryDragListeners)
    window.removeEventListener('pointercancel', endBoundaryDragListeners)
    document.body.classList.remove(MY_TIME_BOUNDARY_DRAG_BODY_CLASS)
    setSplitByCluster((prev) => {
      if (!prev[clusterId]) return prev
      return { ...prev, [clusterId]: cloneSplitState(undo) }
    })
    setFocusedHandle(null)
  }, [endBoundaryDragListeners, stableWindowPointerMove])

  const startDrag = useCallback(
    (clusterId: string, index: number, ev: React.PointerEvent<HTMLButtonElement>, undo: SplitEditorState) => {
      const captureEl = ev.currentTarget
      dragRef.current = { clusterId, index, pointerId: ev.pointerId, captureEl, undo }
      try {
        captureEl.setPointerCapture(ev.pointerId)
      } catch {
        /* ignore */
      }
      document.body.classList.add(MY_TIME_BOUNDARY_DRAG_BODY_CLASS)
      window.addEventListener('pointermove', stableWindowPointerMove)
      window.addEventListener('pointerup', endBoundaryDragListeners)
      window.addEventListener('pointercancel', endBoundaryDragListeners)
    },
    [endBoundaryDragListeners, stableWindowPointerMove]
  )

  const handleStripPointerDown = useCallback(
    (clusterId: string, c: DayEditorSession[], ev: React.PointerEvent<HTMLDivElement>) => {
      if (saving) return
      if (!ev.isPrimary || ev.button !== 0) return
      if ((ev.target as HTMLElement).closest('button[data-boundary-handle]')) return

      if (stripTapSessionRef.current) {
        cancelStripTapGesture()
      }

      /** Alt/Option+click strip: move focused inner boundary to click Y. Plain click (and Shift+click) use add-split tap. */
      if (ev.altKey && !dragRef.current) {
        const fh = focusedHandleRef.current
        if (fh?.clusterId === clusterId) {
          const split = splitByClusterRef.current[clusterId]
          const idx = fh.index
          if (
            split &&
            idx > 0 &&
            idx < split.boundaries.length - 1
          ) {
            const stripEl = ev.currentTarget
            const first = c[0]!
            const last = c[c.length - 1]!
            const rect = stripEl.getBoundingClientRect()
            const y = Math.min(Math.max(0, ev.clientY - rect.top), rect.height)
            const t0ms = new Date(first.clocked_in_at).getTime()
            const t1ms = last.clocked_out_at
              ? new Date(last.clocked_out_at).getTime()
              : nowTickRef.current
            const ms = t0ms + (rect.height > 0 ? (y / rect.height) * (t1ms - t0ms) : 0)
            setSplitByCluster((prev) => {
              const s0 = prev[clusterId]
              if (!s0) return prev
              let next = splitReducer(s0, { type: 'drag', index: idx, ms })
              const msAt = next.boundaries[idx]!
              const prevB = next.boundaries[idx - 1]!
              const nextB = next.boundaries[idx + 1]!
              const joins = internalRowJoinMs(c, nowTickRef.current)
              const snapped = snapBoundaryMs(msAt, prevB, nextB, joins, ROW_JOIN_SNAP_MS)
              if (snapped !== msAt) {
                next = splitReducer(next, { type: 'drag', index: idx, ms: snapped })
              }
              return { ...prev, [clusterId]: next }
            })
            ev.preventDefault()
            return
          }
        }
      }

      const stripEl = ev.currentTarget
      stripTapSessionRef.current = {
        clusterId,
        sessions: c,
        startX: ev.clientX,
        startY: ev.clientY,
        cancelled: false,
        pointerId: ev.pointerId,
        stripEl,
      }
      try {
        stripEl.setPointerCapture(ev.pointerId)
      } catch {
        /* ignore */
      }
      window.addEventListener('pointermove', stableStripTapMove)
      window.addEventListener('pointerup', stableStripTapEnd)
      window.addEventListener('pointercancel', stableStripTapEnd)
    },
    [cancelStripTapGesture, saving, stableStripTapMove, stableStripTapEnd]
  )

  useEffect(
    () => () => {
      const ctx = dragRef.current
      if (ctx) {
        try {
          ctx.captureEl.releasePointerCapture(ctx.pointerId)
        } catch {
          /* */
        }
      }
      dragRef.current = null
      window.removeEventListener('pointermove', stableWindowPointerMove)
      window.removeEventListener('pointerup', endBoundaryDragListeners)
      window.removeEventListener('pointercancel', endBoundaryDragListeners)
      document.body.classList.remove(MY_TIME_BOUNDARY_DRAG_BODY_CLASS)

      if (stripTapSessionRef.current) {
        const s = stripTapSessionRef.current
        stripTapSessionRef.current = null
        try {
          s.stripEl.releasePointerCapture(s.pointerId)
        } catch {
          /* */
        }
        window.removeEventListener('pointermove', stableStripTapMove)
        window.removeEventListener('pointerup', stableStripTapEnd)
        window.removeEventListener('pointercancel', stableStripTapEnd)
      }
    },
    [endBoundaryDragListeners, stableStripTapEnd, stableStripTapMove, stableWindowPointerMove]
  )

  function handleStripKeyDown(clusterId: string, e: React.KeyboardEvent) {
    const fh = focusedHandle
    if (!fh || fh.clusterId !== clusterId) return
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const delta = (e.key === 'ArrowUp' ? -1 : 1) * 60 * 1000
    setSplitByCluster((prev) => {
      const split = prev[clusterId]
      if (!split) return prev
      const c = sessionClusters.find((x) => sessionClusterId(x) === clusterId)
      if (!c?.length) return prev
      let next = splitReducer(split, { type: 'nudge', index: fh.index, deltaMs: delta })
      const idx = fh.index
      if (idx > 0 && idx < next.boundaries.length - 1) {
        const ms = next.boundaries[idx]!
        const prevB = next.boundaries[idx - 1]!
        const nextB = next.boundaries[idx + 1]!
        const joins = internalRowJoinMs(c, nowTick)
        const snapped = snapBoundaryMs(ms, prevB, nextB, joins, ROW_JOIN_SNAP_MS)
        if (snapped !== ms) {
          next = splitReducer(next, { type: 'drag', index: idx, ms: snapped })
        }
      }
      return { ...prev, [clusterId]: next }
    })
  }

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
    sessionClusters.every((c) => {
      const split = splitByCluster[sessionClusterId(c)]!
      const last = c[c.length - 1]!
      return buildPayloads(last, split, nowTick) !== null
    })

  const persistDirtyChangesAsync = useCallback(
    async (dirty: string[]): Promise<boolean> => {
      const runSplitSeg = editingSelf ? splitOwnClockSessionSegments : leaderSplitClockSessionSegments
      const runSplitCluster = editingSelf ? splitOwnClockSessionCluster : leaderSplitClockSessionCluster
      const runReplaceMixed = editingSelf ? replaceOwnClockSessionClusterMixed : leaderReplaceClockSessionClusterMixed
      try {
        for (const clusterId of dirty) {
          const c = sessionClusters.find((x) => sessionClusterId(x) === clusterId)
          if (!c?.length) continue
          const last = c[c.length - 1]!
          const split = splitByCluster[clusterId]
          if (!split) continue
          const payloads = buildPayloads(last, split, nowTick)
          if (!payloads || payloads.length < 1) {
            const first = c[0]!
            throw new DatabaseError(
              `Block ${formatDenverBlockDateHeader(new Date(first.clocked_in_at).getTime(), new Date(last.clocked_out_at || nowTick).getTime())} (${formatDenverTimeOnly(new Date(first.clocked_in_at).getTime())} – ${formatDenverTimeOnly(new Date(last.clocked_out_at || nowTick).getTime())}): add notes and ensure at least 0.01 hours per part.`
            )
          }
          if (payloads.length === 1) {
            if (c.length === 1) {
              const row = c[0]!
              if (!singleSegmentTimesMatchSession(row, split)) {
                throw new DatabaseError(
                  'To change clock times for one block, add a split first (tap the gray strip) or edit in People → Hours.'
                )
              }
              await withSupabaseRetry(
                async () => supabase.from('clock_sessions').update({ notes: payloads[0]!.notes }).eq('id', row.id),
                'update clock session notes'
              )
            } else if (boundariesMatchOriginalRows(c, split, nowTick)) {
              for (const row of c) {
                await withSupabaseRetry(
                  async () =>
                    supabase.from('clock_sessions').update({ notes: payloads[0]!.notes }).eq('id', row.id),
                  'update clock session notes'
                )
              }
            } else {
              const mixed = attachAllocationsToPayloads(payloads, c, split, nowTick)
              await runReplaceMixed(c.map((s) => s.id), mixed)
            }
          } else if (c.length === 1) {
            await runSplitSeg(c[0]!.id, payloads.map(stripJobBidForSegmentRpc))
          } else if (clusterIsHomogeneousJobBid(c)) {
            await runSplitCluster(c.map((s) => s.id), payloads.map(stripJobBidForSegmentRpc))
          } else if (everySegmentFullyInsideSomeRow(c, split, nowTick)) {
            for (const row of c) {
              const { lo, hi } = sessionRowIntervalMs(row, nowTick)
              const rowPayloads: SplitClockSegmentPayload[] = []
              for (let i = 0; i < payloads.length; i++) {
                const a = split.boundaries[i]!
                const b = split.boundaries[i + 1]!
                if (segmentContainedInRow(a, b, lo, hi)) {
                  rowPayloads.push(payloads[i]!)
                }
              }
              if (rowPayloads.length === 0) continue
              if (rowPayloads.length === 1) {
                const p0 = rowPayloads[0]!
                const pIn = new Date(p0.clocked_in_at).getTime()
                const pOut = p0.clocked_out_at ? new Date(p0.clocked_out_at).getTime() : nowTick
                const rowIn = new Date(row.clocked_in_at).getTime()
                const rowOut = row.clocked_out_at ? new Date(row.clocked_out_at).getTime() : nowTick
                const eps = CLUSTER_CONTIGUITY_EPS_MS
                const timesMatch =
                  Math.abs(pIn - rowIn) <= eps &&
                  ((!row.clocked_out_at && !p0.clocked_out_at) ||
                    (row.clocked_out_at &&
                      p0.clocked_out_at &&
                      Math.abs(pOut - rowOut) <= eps))
                if (timesMatch) {
                  await withSupabaseRetry(
                    async () =>
                      supabase.from('clock_sessions').update({ notes: p0.notes }).eq('id', row.id),
                    'update clock session notes'
                  )
                } else {
                  await withSupabaseRetry(
                    async () =>
                      supabase
                        .from('clock_sessions')
                        .update({
                          clocked_in_at: p0.clocked_in_at,
                          clocked_out_at: p0.clocked_out_at,
                          notes: p0.notes,
                        })
                        .eq('id', row.id),
                    'update clock session times'
                  )
                }
              } else {
                await runSplitSeg(row.id, rowPayloads.map(stripJobBidForSegmentRpc))
              }
            }
          } else {
            const mixed = attachAllocationsToPayloads(payloads, c, split, nowTick)
            await runReplaceMixed(c.map((s) => s.id), mixed)
          }
        }
        return true
      } catch (e: unknown) {
        setError(formatErrorMessage(e, e instanceof DatabaseError ? e.message : 'Save failed'))
        return false
      }
    },
    [editingSelf, sessionClusters, splitByCluster, nowTick]
  )

  const requestClose = useCallback(async () => {
    if (saving) return
    if (mergeJobChoice) {
      setMergeJobChoice(null)
      return
    }
    if (assignBulk) {
      setAssignBulk(null)
      return
    }
    if (!editable || !authUserId) {
      onClose()
      return
    }
    const dirty = listDirtyClusterIds(sessionClusters, initialSnapshot, splitByCluster)
    if (dirty.length === 0) {
      onClose()
      return
    }
    if (!canSave) {
      setError(
        'Add focus notes to each segment and ensure each part is at least 0.01 hours before closing.'
      )
      return
    }
    const dirtyApprovedNeedsRpc = dirty.some((cid) => {
      const c = sessionClusters.find((x) => sessionClusterId(x) === cid)
      if (!c?.length || !c.some((s) => s.approved_at)) return false
      const split = splitByCluster[cid]
      if (!split) return false
      const last = c[c.length - 1]!
      return !noteOnlyApprovedSafe(c, split, last, nowTick)
    })
    if (dirtyApprovedNeedsRpc) {
      const ok = window.confirm(
        'One or more sessions were already approved. Saving splits or time changes will remove those hours from payroll until a lead approves the new segments again. Continue?'
      )
      if (!ok) return
    }
    setSaving(true)
    setError(null)
    try {
      const ok = await persistDirtyChangesAsync(dirty)
      if (ok) {
        onSaved()
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }, [
    saving,
    mergeJobChoice,
    assignBulk,
    editable,
    authUserId,
    sessionClusters,
    initialSnapshot,
    splitByCluster,
    canSave,
    nowTick,
    onClose,
    onSaved,
    persistDirtyChangesAsync,
  ])

  function handleBackdropClose() {
    if (saving) return
    void requestClose()
  }

  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (saving) return
      if (dragRef.current) {
        e.preventDefault()
        cancelBoundaryDrag()
        return
      }
      if (stripTapSessionRef.current) {
        e.preventDefault()
        cancelStripTapGesture()
        return
      }
      e.preventDefault()
      void requestClose()
    }
    window.addEventListener('keydown', onWindowKeyDown, true)
    return () => window.removeEventListener('keydown', onWindowKeyDown, true)
  }, [cancelBoundaryDrag, cancelStripTapGesture, requestClose, saving])

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
      }}
      onClick={handleBackdropClose}
      role="presentation"
    >
      <div
        style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 360,
          maxWidth: 'min(920px, 96vw)',
          maxHeight: '94vh',
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
            justifyContent: 'flex-end',
            minHeight: '1.75rem',
            marginBottom: '0.35rem',
          }}
        >
          <h3
            id="dashboard-my-time-editor-title"
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              margin: 0,
              fontSize: '1rem',
              maxWidth: '58%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            aria-describedby={sessionsSpanDenverSubtitle ? 'dashboard-my-time-editor-subtitle' : undefined}
          >
            {modalTitleText}
          </h3>
          {editable && resolvedSessions.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>Edit layout</span>
              <div
                role="group"
                aria-label="Visual or form editor"
                style={{
                  display: 'inline-flex',
                  border: '1px solid #d1d5db',
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
                    background: layoutMode === 'visual' ? '#eff6ff' : 'white',
                    color: layoutMode === 'visual' ? '#1d4ed8' : '#374151',
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
                    borderLeft: '1px solid #d1d5db',
                    margin: 0,
                    padding: '0.35rem 0.65rem',
                    background: layoutMode === 'form' ? '#eff6ff' : 'white',
                    color: layoutMode === 'form' ? '#1d4ed8' : '#374151',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: layoutMode === 'form' ? 600 : 400,
                  }}
                >
                  Form
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {sessionsSpanDenverSubtitle ? (
          <p
            id="dashboard-my-time-editor-subtitle"
            style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', color: '#6b7280' }}
          >
            {sessionsSpanDenverSubtitle}
          </p>
        ) : null}
        {!editable ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            Only this week can be edited from the dashboard (server uses America/Denver week boundaries).
          </p>
        ) : sessionsFetchError ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#b91c1c' }}>{sessionsFetchError}</p>
        ) : pendingAuthForFetch || (sessionsProp.length === 0 && sessionsLoading) ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Loading sessions…</p>
        ) : resolvedSessions.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No sessions this day.</p>
        ) : (
          <>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: '#9ca3af' }}>
              {sortedSessions.length} session{sortedSessions.length === 1 ? '' : 's'} ·{' '}
              {layoutMode === 'visual' ? (
                <>
                  Each block starts as one focus; tap the gray strip to add a split, then drag blue handles to adjust
                  boundaries. Off-clock gaps are read-only.
                </>
              ) : (
                <>
                  Edit ends at inner boundaries with Ends at (same as dragging blue handles). First and last clock times stay
                  fixed; open end-of-day rows show as open. Use Split below Span to halve a long segment. Times use your device
                  timezone for input fields.
                </>
              )}
            </p>
            {sortedSessions.some((s) => s.approved_at) && (
              <p
                style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '0.8125rem',
                  color: '#b45309',
                  background: '#fffbeb',
                  padding: '0.5rem 0.6rem',
                  borderRadius: 6,
                }}
              >
                Adding splits or changing segment times on approved sessions returns hours to pending until re-approved.
                Note-only edits keep approval.
              </p>
            )}
            <div
              className="myTimeDayTimelineScroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 260,
                maxHeight: 'min(65vh, 640px)',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {!editorInitialized ? (
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Loading editor…</p>
              ) : (
                timelineItems.map((item: DayTimelineItem, idx: number) => {
                  if (item.type === 'gap') {
                    const flexW = Math.max(0.12, (item.endMs - item.startMs) / totalDur)
                    return (
                      <div
                        key={`gap-${idx}-${item.startMs}`}
                        className="myTimeDayGapStrip"
                        style={{
                          flex: `${Math.max(0.35, flexW * 6)} 0 auto`,
                          minHeight: 32,
                          padding: '0.35rem 0.5rem',
                          borderRadius: 6,
                          background: 'repeating-linear-gradient(-45deg, #f3f4f6, #f3f4f6 8px, #fafafa 8px, #fafafa 16px)',
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        Off clock · {formatDurationMs(item.endMs - item.startMs)}
                      </div>
                    )
                  }

                  const c = item.sessions
                  const lastS = c[c.length - 1]!
                  const clusterId = item.clusterId
                  const split = splitByCluster[clusterId]!
                  const t0 = item.startMs
                  const t1 = item.endMs
                  const span = Math.max(1, t1 - t0)
                  const flexW = (item.endMs - item.startMs) / totalDur

                  return layoutMode === 'visual' ? (
                    <MyTimeDayClusterVisual
                      key={clusterId}
                      clusterId={clusterId}
                      c={c}
                      lastS={lastS}
                      split={split}
                      t0={t0}
                      t1={t1}
                      span={span}
                      flexW={flexW}
                      nowTick={nowTick}
                      saving={saving}
                      jobLabels={mergedJobLabels}
                      bidLabels={mergedBidLabels}
                      setStripEl={(el) => {
                        stripRefs.current[clusterId] = el
                      }}
                      onStripPointerDown={(e) => handleStripPointerDown(clusterId, c, e)}
                      onStripKeyDown={(e) => handleStripKeyDown(clusterId, e)}
                      onStartDrag={(index, ev, undo) => startDrag(clusterId, index, ev, undo)}
                      onFocusHandle={(index) => setFocusedHandle({ clusterId, index })}
                      patchClusterAction={(action) => patchCluster(clusterId, action)}
                      setAssignBulk={setAssignBulk}
                      onAssignJobSaved={onAssignJobSaved}
                      resolveAssignSession={(segIdx) =>
                        resolveAssignSessionForSegment(clusterId, segIdx)
                      }
                      onRequestMergeJobChoice={(payload) =>
                        openMergeJobChoiceForCluster(clusterId, payload)
                      }
                    />
                  ) : (
                    <MyTimeDayClusterForm
                      key={clusterId}
                      clusterId={clusterId}
                      c={c}
                      lastS={lastS}
                      split={split}
                      t0={t0}
                      t1={t1}
                      span={span}
                      flexW={flexW}
                      nowTick={nowTick}
                      saving={saving}
                      jobLabels={mergedJobLabels}
                      bidLabels={mergedBidLabels}
                      patchClusterAction={(action) => patchCluster(clusterId, action)}
                      onCommitInnerBoundary={(boundaryIndex, ms) => commitInnerBoundary(clusterId, boundaryIndex, ms)}
                      setAssignBulk={setAssignBulk}
                      onAssignJobSaved={onAssignJobSaved}
                      resolveAssignSession={(segIdx) =>
                        resolveAssignSessionForSegment(clusterId, segIdx)
                      }
                      onRequestMergeJobChoice={(payload) =>
                        openMergeJobChoiceForCluster(clusterId, payload)
                      }
                    />
                  )
                })
              )}
            </div>

            {error && <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: '#dc2626' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => void requestClose()}
                disabled={saving}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #3b82f6',
                  borderRadius: 4,
                  background: '#3b82f6',
                  color: 'white',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {saving ? 'Saving…' : 'Close'}
              </button>
            </div>
          </>
        )}
        {!editable || resolvedSessions.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: 'white',
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
          onAssignJobSaved()
          setAssignBulk(null)
        }}
      />
    ) : null}
    </>
  )
}
