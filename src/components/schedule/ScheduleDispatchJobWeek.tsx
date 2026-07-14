import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import {
  deleteJobScheduleBlock,
  fetchJobScheduleBlocksForJobDateRange,
  fetchScheduleBlocksForAssigneesOnDay,
  fetchScheduleJobContext,
  updateJobScheduleBlock,
  updateJobScheduleBlockGroup,
  type JobScheduleBlockRow,
  type ScheduleTeamMember,
} from '../../lib/jobScheduleBlocks'
import { dispatchMinutesToHHmm, timeInputToPg } from '../../lib/dispatchAddBlockTime'
import {
  scheduleBlockToRange,
  scheduleOverlapsAny,
  scheduleTimeToMinutesFromMidnight,
} from '../../lib/jobScheduleOverlap'
import {
  defaultNewBlockRangeInFirstGap,
  type AddBlockTimelineSegment,
} from '../../lib/scheduleDispatchAddBlockTimeline'
import { scheduleFormatWeekdayLong, scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import { removeNotComingInForUserAsStaff } from '../../lib/notComingInTimeOff'
import { ScheduleDispatchUndoNotComingInModal } from './ScheduleDispatchUndoNotComingInModal'
import { executeScheduleDispatchBlockReassign } from '../../lib/scheduleDispatchDragEnd'
import { insertScheduleDispatchCopiedLeg } from '../../lib/scheduleDispatchMirrorInsert'
import { fetchSalariedUserIdSetFromUserIds } from '../../lib/salaryPayConfigGate'
import { isAssistantLike, isSubcontractorLikeRole } from '../../lib/subcontractorLikeRole'
import { ScheduleDispatchAddBlockModal } from './ScheduleDispatchAddBlockModal'
import { ScheduleDispatchBlockNoteModal } from './ScheduleDispatchBlockNoteModal'
import { PreviewJobModal } from '../calendar/PreviewJobModal'
import {
  cellKey,
  ScheduleDispatchGrid,
  type ScheduleDispatchCardPlacementMode,
} from './ScheduleDispatchGrid'
import { fetchArchivedUserIdSetForIds, fetchUserNamesForIds } from '../../lib/scheduleDispatchHub'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { pickDayForScheduleDispatchUrl } from '../../lib/scheduleDispatchColumnFocus'
import {
  companyWeekStartSundayContaining,
  denverCalendarDayKey,
  formatScheduleDispatchVisibleDateRange,
  getDefaultWeekRange,
  getScheduleDispatchVisibleDayKeys,
  ymdAddDays,
} from '../../utils/dateUtils'
import { CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES as CAN_USE_SCHEDULE_DISPATCH } from '../../lib/scheduleDispatchEditRoles'
import { saveNewScheduleBlockForPersonDay } from '../../lib/scheduleDispatchAddBlockSave'
import {
  RemoveScheduleBlockConfirmModal,
  validateScheduleDispatchBlockTimeRange,
} from './scheduleDispatchRemoveBlockModal'
import {
  buildUserTimeOffByCell,
  fetchUserTimeOffForUsersInRange,
  type UserTimeOffCellInfo,
} from '../../lib/userTimeOffByCell'

const SCHEDULE_DISPATCH_HIDE_WEEKEND_STORAGE_KEY = 'scheduleDispatchHideWeekend'
function readScheduleDispatchHideWeekend(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const v = window.localStorage.getItem(SCHEDULE_DISPATCH_HIDE_WEEKEND_STORAGE_KEY)
    if (v === '0') return false
    if (v === '1') return true
    return true
  } catch {
    return true
  }
}

/** Matches RLS on jobs_ledger_team_members INSERT (no superintendent). */
const CAN_ADD_TO_JOB_ROSTER = new Set(['dev', 'master_technician', 'assistant', 'controller'])

type ScheduleDispatchBlockModalState =
  | { kind: 'add'; assigneeUserId: string; workDate: string; jobId: string }
  | { kind: 'edit'; blockId: string }

export function ScheduleDispatchJobWeek() {
  const { user: authUser, role } = useAuth()
  const { showToast } = useToastContext()
  const jobFormModal = useJobFormModal()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const jobId = searchParams.get('jobId')?.trim() ?? ''
  const weekRaw = searchParams.get('week')?.trim() ?? ''
  const dayRaw = searchParams.get('day')?.trim() ?? ''

  const defaultWeekStart = useMemo(() => getDefaultWeekRange().start, [])
  const weekStart = useMemo(() => {
    if (!weekRaw) return defaultWeekStart
    const n = companyWeekStartSundayContaining(weekRaw)
    return n ?? defaultWeekStart
  }, [weekRaw, defaultWeekStart])

  const [hideWeekend, setHideWeekend] = useState(readScheduleDispatchHideWeekend)

  useEffect(() => {
    if (!weekRaw || !jobId) return
    const n = companyWeekStartSundayContaining(weekRaw)
    if (n && n !== weekRaw) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('jobId', jobId)
        next.set('week', n)
        const d = prev.get('day')?.trim() ?? ''
        if (d) {
          if (getScheduleDispatchVisibleDayKeys(n, hideWeekend).includes(d)) next.set('day', d)
          else next.delete('day')
        }
        return next
      }, { replace: true })
    }
  }, [jobId, weekRaw, setSearchParams, hideWeekend])

  const weekEnd = useMemo(() => ymdAddDays(weekStart, 6), [weekStart])

  /** Identity for the current job-week URL; used to avoid showing an empty grid before `load()` runs (first paint / Strict Mode). */
  const jobWeekListKey = useMemo(() => (jobId ? `${jobId}|${weekStart}` : null), [jobId, weekStart])

  useEffect(() => {
    try {
      window.localStorage.setItem(SCHEDULE_DISPATCH_HIDE_WEEKEND_STORAGE_KEY, hideWeekend ? '1' : '0')
    } catch {
      /* ignore quota / private mode */
    }
  }, [hideWeekend])

  const visibleDayKeys = useMemo(
    () => getScheduleDispatchVisibleDayKeys(weekStart, hideWeekend),
    [weekStart, hideWeekend],
  )
  const columnFocusDayYmd = useMemo(
    () => (dayRaw && visibleDayKeys.includes(dayRaw) ? dayRaw : ''),
    [dayRaw, visibleDayKeys],
  )

  useEffect(() => {
    if (!dayRaw) return
    if (!visibleDayKeys.includes(dayRaw)) {
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev)
        n.delete('day')
        return n
      }, { replace: true })
    }
  }, [dayRaw, visibleDayKeys, setSearchParams])

  const scheduleTodayYmd = denverCalendarDayKey(Date.now())
  const dispatchWeekNavDateRangeOverride = useMemo(
    () => (hideWeekend ? formatScheduleDispatchVisibleDateRange(visibleDayKeys) : undefined),
    [hideWeekend, visibleDayKeys],
  )

  const [jobTitle, setJobTitle] = useState('')
  const [teamMembers, setTeamMembers] = useState<ScheduleTeamMember[]>([])
  const [blocks, setBlocks] = useState<JobScheduleBlockRow[]>([])
  const [userTimeOffByCell, setUserTimeOffByCell] = useState<Map<string, UserTimeOffCellInfo>>(
    () => new Map(),
  )
  const [jobScheduleSalariedUserIds, setJobScheduleSalariedUserIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** Set in `load()` finally when the latest request finishes so the grid does not flash “no roster” before data arrives. */
  const [jobWeekHydratedKey, setJobWeekHydratedKey] = useState<string | null>(null)

  /** Monotonic id so overlapping `load()` runs (Strict Mode / rapid URL changes) do not clobber state or `loading`. */
  const jobWeekLoadSeqRef = useRef(0)
  const [jobPreview, setJobPreview] = useState<{ projectId: string; dateKey: string | null } | null>(null)
  const [scheduleJobProjectId, setScheduleJobProjectId] = useState<string | null>(null)
  /** `null` until job-week `load()` succeeds; then whoever is not in this set is schedule-only. */
  const [officialJobTeamUserIds, setOfficialJobTeamUserIds] = useState<ReadonlySet<string> | null>(null)
  const [addToJobBusyUserId, setAddToJobBusyUserId] = useState<string | null>(null)

  const canEdit = role != null && CAN_USE_SCHEDULE_DISPATCH.has(role)
  const canAddToJobRoster = role != null && CAN_ADD_TO_JOB_ROSTER.has(role)

  const jobWeekGridLoading =
    Boolean(jobId) && loadError == null && (loading || jobWeekHydratedKey !== jobWeekListKey)

  useEffect(() => {
    if (!jobWeekListKey) {
      setJobWeekHydratedKey(null)
      return
    }
    setJobWeekHydratedKey(null)
  }, [jobWeekListKey])

  useEffect(() => {
    if (jobId) return
    setJobTitle('')
    setTeamMembers([])
    setBlocks([])
    setJobScheduleSalariedUserIds(new Set())
    setScheduleJobProjectId(null)
    setOfficialJobTeamUserIds(null)
    setLoading(false)
    setLoadError(null)
  }, [jobId])

  const load = useCallback(async () => {
    if (!jobId) return
    const seq = ++jobWeekLoadSeqRef.current
    setLoading(true)
    setLoadError(null)
    setJobScheduleSalariedUserIds(new Set())
    setScheduleJobProjectId(null)
    setOfficialJobTeamUserIds(null)
    try {
      const [ctx, blk] = await Promise.all([
        fetchScheduleJobContext(jobId),
        fetchJobScheduleBlocksForJobDateRange(jobId, weekStart, weekEnd),
      ])
      if (seq !== jobWeekLoadSeqRef.current) return
      if (ctx.error || !ctx.data) {
        setLoadError(ctx.error ?? 'Could not load job.')
        setJobTitle('')
        setTeamMembers([])
        setBlocks([])
        setScheduleJobProjectId(null)
        setOfficialJobTeamUserIds(null)
      } else {
        setJobTitle(ctx.data.jobTitle)
        setScheduleJobProjectId(ctx.data.project_id)
        setOfficialJobTeamUserIds(new Set(ctx.data.teamMembers.map((t) => t.user_id)))
        let blocksData: JobScheduleBlockRow[] = []
        if (blk.error) {
          setLoadError(blk.error)
          setBlocks([])
        } else {
          blocksData = blk.data
          setBlocks(blk.data)
        }
        const teamIds = ctx.data.teamMembers.map((t) => t.user_id)
        const assigneeIds = blocksData.map((b) => b.assignee_user_id)
        const rosterIds = [...new Set([...teamIds, ...assigneeIds])].filter(Boolean)
        const teamById = new Map(ctx.data.teamMembers.map((t) => [t.user_id, t]))
        const [{ data: nameMap, error: nameErr }, archivedSet] = await Promise.all([
          fetchUserNamesForIds(rosterIds),
          fetchArchivedUserIdSetForIds(rosterIds),
        ])
        if (seq !== jobWeekLoadSeqRef.current) return
        if (nameErr) showToast(`People names: ${nameErr}`, 'warning')
        const mergedRoster: ScheduleTeamMember[] = rosterIds
          .filter((uid) => !archivedSet.has(uid))
          .map((uid) => {
            const fromTeam = teamById.get(uid)
            if (fromTeam) return fromTeam
            return { user_id: uid, name: nameMap.get(uid) ?? null }
          })
        setTeamMembers(mergedRoster)
        try {
          const salaried = await fetchSalariedUserIdSetFromUserIds(rosterIds)
          if (seq !== jobWeekLoadSeqRef.current) return
          setJobScheduleSalariedUserIds(salaried)
        } catch (e) {
          if (seq !== jobWeekLoadSeqRef.current) return
          setJobScheduleSalariedUserIds(new Set())
          showToast(`Salary flags: ${formatErrorMessage(e)}`, 'warning')
        }
      }
    } catch (e) {
      if (seq === jobWeekLoadSeqRef.current) {
        setLoadError(formatErrorMessage(e, 'Could not load schedule.'))
        setJobTitle('')
        setTeamMembers([])
        setBlocks([])
        setScheduleJobProjectId(null)
        setOfficialJobTeamUserIds(null)
      }
    } finally {
      if (seq === jobWeekLoadSeqRef.current) {
        setLoading(false)
        setJobWeekHydratedKey(`${jobId}|${weekStart}`)
      }
    }
  }, [jobId, weekStart, weekEnd, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const visibleUserIdsForTimeOffSerialized = useMemo(() => {
    const ids = new Set<string>()
    for (const m of teamMembers) ids.add(m.user_id)
    for (const b of blocks) ids.add(b.assignee_user_id)
    return [...ids].sort().join('|')
  }, [teamMembers, blocks])

  const refreshUserTimeOff = useCallback(async () => {
    const ids = visibleUserIdsForTimeOffSerialized
      ? visibleUserIdsForTimeOffSerialized.split('|').filter(Boolean)
      : []
    if (ids.length === 0 || !weekStart || !weekEnd) {
      setUserTimeOffByCell(new Map())
      return
    }
    const { data, error } = await fetchUserTimeOffForUsersInRange(ids, weekStart, weekEnd)
    if (error) return
    const dayKeys: string[] = []
    for (let i = 0; i < 7; i += 1) dayKeys.push(ymdAddDays(weekStart, i))
    setUserTimeOffByCell(buildUserTimeOffByCell(data, dayKeys))
  }, [visibleUserIdsForTimeOffSerialized, weekStart, weekEnd])

  useEffect(() => {
    void refreshUserTimeOff()
  }, [refreshUserTimeOff])

  useEffect(() => {
    setJobPreview(null)
  }, [jobId, weekStart])

  const blocksByCell = useMemo(() => {
    const m = new Map<string, JobScheduleBlockRow[]>()
    for (const b of blocks) {
      const k = cellKey(b.assignee_user_id, b.work_date)
      const arr = m.get(k) ?? []
      arr.push(b)
      m.set(k, arr)
    }
    for (const [, arr] of m) {
      arr.sort((a, b) => a.time_start.localeCompare(b.time_start))
    }
    return m
  }, [blocks])

  const blockById = useMemo(() => {
    const m = new Map<string, JobScheduleBlockRow>()
    for (const b of blocks) m.set(b.id, b)
    return m
  }, [blocks])

  const groupMemberCountByGroupId = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of blocks) {
      const g = b.shared_block_group_id
      if (!g) continue
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }, [blocks])

  const nameByUserId = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of teamMembers) {
      m.set(t.user_id, (t.name ?? '').trim() || 'Unnamed')
    }
    return m
  }, [teamMembers])

  const addUserToJobRoster = useCallback(
    async (userId: string) => {
      if (!jobId || !userId || !canAddToJobRoster || officialJobTeamUserIds == null) return
      if (officialJobTeamUserIds.has(userId)) {
        showToast('Already on job roster.', 'info')
        return
      }
      setAddToJobBusyUserId(userId)
      try {
        const existing = await withSupabaseRetry(
          async () =>
            await supabase
              .from('jobs_ledger_team_members')
              .select('id')
              .eq('job_id', jobId)
              .eq('user_id', userId)
              .maybeSingle(),
          'dispatch check jobs_ledger_team_member',
        )
        if (existing) {
          showToast('Already on job roster.', 'info')
          void load()
          return
        }
        await withSupabaseRetry(
          async () =>
            await supabase.from('jobs_ledger_team_members').insert({ job_id: jobId, user_id: userId }),
          'dispatch insert jobs_ledger_team_member',
        )
        showToast('Added to job.', 'success')
        void load()
      } catch (e) {
        showToast(formatErrorMessage(e), 'error')
      } finally {
        setAddToJobBusyUserId(null)
      }
    },
    [jobId, canAddToJobRoster, officialJobTeamUserIds, showToast, load],
  )

  const [blockModalState, setBlockModalState] = useState<ScheduleDispatchBlockModalState | null>(null)
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null)
  const [deleteBlockBusy, setDeleteBlockBusy] = useState(false)
  const [addTimeStart, setAddTimeStart] = useState('08:00')
  const [addTimeEnd, setAddTimeEnd] = useState('16:00')
  const [addNote, setAddNote] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addBlockTimelineSegments, setAddBlockTimelineSegments] = useState<AddBlockTimelineSegment[]>([])
  const [addBlockDraftByBlockId, setAddBlockDraftByBlockId] = useState<
    Record<string, { time_start: string; time_end: string }>
  >({})
  const [cardPlacementMode, setCardPlacementMode] = useState<ScheduleDispatchCardPlacementMode | null>(null)
  const [plusMenuBlockId, setPlusMenuBlockId] = useState<string | null>(null)
  const [blockNoteEdit, setBlockNoteEdit] = useState<JobScheduleBlockRow | null>(null)
  const [blockNoteBusy, setBlockNoteBusy] = useState(false)
  const [blockNoteError, setBlockNoteError] = useState<string | null>(null)
  const [undoNotComingInTarget, setUndoNotComingInTarget] = useState<
    | {
        personUserId: string
        personLabel: string
        workDate: string
        workDateLabel: string
      }
    | null
  >(null)
  const [undoNotComingInBusy, setUndoNotComingInBusy] = useState(false)

  const handleRequestUndoNotComingIn = useCallback(
    (personUserId: string, workDate: string) => {
      if (!canEdit) return
      const personLabel = nameByUserId.get(personUserId) ?? 'Team member'
      setUndoNotComingInTarget({
        personUserId,
        personLabel,
        workDate,
        workDateLabel: scheduleFormatWeekdayLong(workDate),
      })
    },
    [canEdit, nameByUserId],
  )

  const handleCancelUndoNotComingIn = useCallback(() => {
    if (undoNotComingInBusy) return
    setUndoNotComingInTarget(null)
  }, [undoNotComingInBusy])

  const handleConfirmUndoNotComingIn = useCallback(async () => {
    const target = undoNotComingInTarget
    if (!target || !canEdit) return
    setUndoNotComingInBusy(true)
    try {
      const result = await removeNotComingInForUserAsStaff({
        subjectUserId: target.personUserId,
        workDateYmd: target.workDate,
      })
      if (!result.ok) {
        showToast(result.message, 'error')
        return
      }
      if (result.deleted === 0) {
        showToast(
          `${target.personLabel} was already cleared for ${target.workDate}.`,
          'warning',
        )
      } else {
        showToast(
          `${target.personLabel} is no longer marked Not coming in (${target.workDate}).`,
          'success',
        )
        if (result.syncWarning) {
          showToast(`Salary sync: ${result.syncWarning}`, 'warning')
        }
      }
      setUndoNotComingInTarget(null)
      await load()
      void refreshUserTimeOff()
    } finally {
      setUndoNotComingInBusy(false)
    }
  }, [undoNotComingInTarget, canEdit, showToast, load, refreshUserTimeOff])

  const placementSourceBlock = useMemo(() => {
    if (!cardPlacementMode) return null
    return blockById.get(cardPlacementMode.sourceBlockId) ?? null
  }, [cardPlacementMode, blockById])

  useEffect(() => {
    if (!cardPlacementMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCardPlacementMode(null)
        setPlusMenuBlockId(null)
        setSearchParams((prev) => {
          const n = new URLSearchParams(prev)
          if (!n.has('placeJob')) return prev
          n.delete('placeJob')
          return n
        }, { replace: true })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cardPlacementMode, setSearchParams])

  useEffect(() => {
    if (deleteBlockId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleteBlockBusy) setDeleteBlockId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteBlockId, deleteBlockBusy])

  const stripPlaceJobFromUrl = useCallback(() => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      if (!n.has('placeJob')) return prev
      n.delete('placeJob')
      return n
    }, { replace: true })
  }, [setSearchParams])

  const openAddBlock = useCallback(
    (args: { assigneeUserId: string; workDate: string; jobId: string }) => {
      setCardPlacementMode(null)
      setPlusMenuBlockId(null)
      setBlockModalState({ kind: 'add', assigneeUserId: args.assigneeUserId, workDate: args.workDate, jobId: args.jobId })
      const rows = blocks.filter(
        (b) => b.assignee_user_id === args.assigneeUserId && b.work_date === args.workDate,
      )
      const labelFor = (_jid: string) => jobTitle
      const segments: AddBlockTimelineSegment[] = [...rows]
        .map((b) => ({
          blockId: b.id,
          jobId: b.job_id,
          label: labelFor(b.job_id),
          time_start: b.time_start,
          time_end: b.time_end,
          shared_block_group_id: b.shared_block_group_id,
        }))
        .sort(
          (a, b) =>
            scheduleTimeToMinutesFromMidnight(timeInputToPg(a.time_start.slice(0, 5))) -
            scheduleTimeToMinutesFromMidnight(timeInputToPg(b.time_start.slice(0, 5))),
        )
      setAddBlockTimelineSegments(segments)
      setAddBlockDraftByBlockId({})
      const def = defaultNewBlockRangeInFirstGap({ segments, draftByBlockId: {} })
      if (def) {
        setAddTimeStart(dispatchMinutesToHHmm(def.startMin))
        setAddTimeEnd(dispatchMinutesToHHmm(def.endMin))
      } else {
        setAddTimeStart('08:00')
        setAddTimeEnd('16:00')
      }
      setAddNote('')
      setAddError(null)
    },
    [blocks, jobTitle],
  )

  const openEdit = useCallback(
    (block: JobScheduleBlockRow) => {
      if (!canEdit || !jobId || block.job_id !== jobId) return
      setCardPlacementMode(null)
      setPlusMenuBlockId(null)
      setBlockModalState({ kind: 'edit', blockId: block.id })
      setAddTimeStart(block.time_start.slice(0, 5))
      setAddTimeEnd(block.time_end.slice(0, 5))
      setAddNote(block.note ?? '')
      setAddError(null)
      setAddBlockTimelineSegments([])
      setAddBlockDraftByBlockId({})
    },
    [canEdit, jobId],
  )

  const closeAdd = useCallback(() => {
    setBlockModalState(null)
    setAddError(null)
    setAddBlockTimelineSegments([])
    setAddBlockDraftByBlockId({})
    stripPlaceJobFromUrl()
  }, [stripPlaceJobFromUrl])

  const onStartCardPlacement = useCallback(
    (source: JobScheduleBlockRow, variant: 'linked' | 'unlinked') => {
      if (!canEdit || source.job_id !== jobId) return
      setBlockModalState(null)
      setAddError(null)
      setPlusMenuBlockId(null)
      stripPlaceJobFromUrl()
      setCardPlacementMode({ sourceBlockId: source.id, variant })
      const extra =
        variant === 'linked'
          ? ' Linked copies stay on the same work day as the source.'
          : ' Solo copies can go on any day in this week.'
      showToast(`Click a team member's day cell to add the copy. Press Esc to cancel.${extra}`, 'info')
    },
    [canEdit, jobId, showToast, stripPlaceJobFromUrl],
  )

  const onCardPlacementPickCell = useCallback(
    async (assigneeUserId: string, workDate: string) => {
      if (!cardPlacementMode || !authUser?.id || !jobId) return
      const placementVariant = cardPlacementMode.variant
      const sourceBlockId = cardPlacementMode.sourceBlockId

      const source = blockById.get(sourceBlockId)
      if (!source || source.job_id !== jobId) {
        setCardPlacementMode(null)
        return
      }
      if (placementVariant === 'linked' && workDate !== source.work_date) {
        showToast(
          'Linked copies use the source block’s day. Use drag to move the whole crew to another day.',
          'info',
        )
        return
      }

      const { error } = await insertScheduleDispatchCopiedLeg({
        jobId,
        createdBy: authUser.id,
        source,
        targetAssigneeUserId: assigneeUserId,
        targetWorkDate: workDate,
        linkMode: placementVariant === 'linked' ? 'linked' : 'unlinked',
        allJobBlocks: blocks,
      })
      if (error) {
        showToast(error, 'error')
        return
      }
      setCardPlacementMode(null)
      showToast(placementVariant === 'linked' ? 'Linked copy added.' : 'Solo copy added.', 'success')
      await load()
    },
    [cardPlacementMode, jobId, authUser?.id, blockById, blocks, load, showToast],
  )

  const blockModalPersonLabel = useMemo(() => {
    if (!blockModalState) return ''
    if (blockModalState.kind === 'add') {
      return nameByUserId.get(blockModalState.assigneeUserId) ?? 'Unknown'
    }
    const b = blockById.get(blockModalState.blockId)
    return b ? nameByUserId.get(b.assignee_user_id) ?? 'Unknown' : ''
  }, [blockModalState, nameByUserId, blockById])

  const blockModalJobTitleForModal = useMemo(() => {
    if (!blockModalState) return ''
    if (blockModalState.kind === 'add') {
      return jobTitle
    }
    return jobTitle
  }, [blockModalState, jobTitle])

  const blockModalWorkDate = useMemo(() => {
    if (!blockModalState) return ''
    if (blockModalState.kind === 'add') return blockModalState.workDate
    const b = blockById.get(blockModalState.blockId)
    return b?.work_date ?? ''
  }, [blockModalState, blockById])

  const addBlockModalTimeline = useMemo(() => {
    if (blockModalState?.kind !== 'add') return undefined
    return {
      segments: addBlockTimelineSegments,
      draftByBlockId: addBlockDraftByBlockId,
      setDraftByBlockId: setAddBlockDraftByBlockId,
    }
  }, [blockModalState, addBlockTimelineSegments, addBlockDraftByBlockId])

  const saveBlockModal = useCallback(async () => {
    if (!blockModalState) return
    if (blockModalState.kind === 'add' && !authUser?.id) return

    const v = validateScheduleDispatchBlockTimeRange(addTimeStart, addTimeEnd)
    if (v) {
      setAddError(v)
      return
    }
    const ts = timeInputToPg(addTimeStart)
    const te = timeInputToPg(addTimeEnd)
    const candidate = scheduleBlockToRange(ts, te)
    const noteVal = addNote.trim() || null

    if (blockModalState.kind === 'add') {
      const createdBy = authUser?.id
      if (!createdBy) return
      setAddSaving(true)
      setAddError(null)
      const res = await saveNewScheduleBlockForPersonDay({
        authUserId: createdBy,
        assigneeUserId: blockModalState.assigneeUserId,
        workDate: blockModalState.workDate,
        targetJobId: blockModalState.jobId,
        addTimeStart,
        addTimeEnd,
        addNote,
        addBlockDraftByBlockId,
      })
      setAddSaving(false)
      if (!res.ok) {
        setAddError(res.error)
        return
      }
      showToast('Block added.', 'success')
      closeAdd()
      await load()
      return
    }

    const b = blockById.get(blockModalState.blockId)
    if (!b) {
      showToast('Block not found.', 'error')
      closeAdd()
      return
    }
    const groupId = b.shared_block_group_id
    if (groupId) {
      const legs = blocks.filter((x) => x.job_id === jobId && x.shared_block_group_id === groupId)
      const assigneeIds = [...new Set(legs.map((l) => l.assignee_user_id))]
      for (const uid of assigneeIds) {
        const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay([uid], b.work_date)
        if (dayErr) {
          setAddError(dayErr)
          return
        }
        const excludeIds = legs.filter((l) => l.assignee_user_id === uid).map((l) => l.id)
        if (scheduleOverlapsAny(candidate, dayBlocks, excludeIds)) {
          setAddError('That time overlaps another block for this person on this day.')
          return
        }
      }
    } else {
      const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay([b.assignee_user_id], b.work_date)
      if (dayErr) {
        setAddError(dayErr)
        return
      }
      if (scheduleOverlapsAny(candidate, dayBlocks, [blockModalState.blockId])) {
        setAddError('That time overlaps another block for this person on this day.')
        return
      }
    }

    setAddSaving(true)
    setAddError(null)
    if (groupId) {
      const { error: upErr } = await updateJobScheduleBlockGroup(jobId, groupId, {
        time_start: ts,
        time_end: te,
        note: noteVal,
      })
      setAddSaving(false)
      if (upErr) {
        setAddError(upErr)
        return
      }
      showToast('Block updated.', 'success')
    } else {
      const { error: upErr } = await updateJobScheduleBlock(blockModalState.blockId, {
        time_start: ts,
        time_end: te,
        note: noteVal,
      })
      setAddSaving(false)
      if (upErr) {
        setAddError(upErr)
        return
      }
      showToast('Block updated.', 'success')
    }

    closeAdd()
    await load()
  }, [
    blockModalState,
    jobId,
    authUser?.id,
    addTimeStart,
    addTimeEnd,
    addNote,
    addBlockDraftByBlockId,
    blockById,
    blocks,
    closeAdd,
    load,
    showToast,
  ])

  const saveJobWeekBlockNote = useCallback(
    async (plain: string) => {
      if (!blockNoteEdit || !canEdit || !jobId) return
      setBlockNoteBusy(true)
      setBlockNoteError(null)
      const noteVal = plain.trim() || null
      const b = blockNoteEdit
      const gid = b.shared_block_group_id
      try {
        if (gid) {
          const { error: upErr } = await updateJobScheduleBlockGroup(jobId, gid, { note: noteVal })
          if (upErr) {
            setBlockNoteError(upErr)
            return
          }
        } else {
          const { error: upErr } = await updateJobScheduleBlock(b.id, { note: noteVal })
          if (upErr) {
            setBlockNoteError(upErr)
            return
          }
        }
        showToast('Note saved.', 'success')
        setBlockNoteEdit(null)
        await load()
      } finally {
        setBlockNoteBusy(false)
      }
    },
    [blockNoteEdit, canEdit, jobId, load, showToast],
  )

  const requestDeleteBlock = useCallback(
    (id: string) => {
      if (!canEdit) return
      setDeleteBlockId(id)
    },
    [canEdit],
  )

  const cancelRequestDeleteBlock = useCallback(() => {
    if (deleteBlockBusy) return
    setDeleteBlockId(null)
  }, [deleteBlockBusy])

  const confirmDeleteBlock = useCallback(async () => {
    const id = deleteBlockId
    if (!id || !canEdit) return
    setDeleteBlockBusy(true)
    try {
      const { error: delErr } = await deleteJobScheduleBlock(id)
      if (delErr) {
        showToast(delErr, 'error')
        return
      }
      setDeleteBlockId(null)
      await load()
    } finally {
      setDeleteBlockBusy(false)
    }
  }, [deleteBlockId, canEdit, load, showToast])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      await executeScheduleDispatchBlockReassign(event, {
        blockById,
        canEdit,
        showToast,
        onSuccess: load,
      })
    },
    [blockById, canEdit, load, showToast],
  )

  const shiftWeek = useCallback(
    (deltaWeeks: number) => {
      const next = ymdAddDays(weekStart, deltaWeeks * 7)
      const dayKeep = pickDayForScheduleDispatchUrl(dayRaw, next, hideWeekend)
      const p: Record<string, string> = { jobId, week: next }
      if (dayKeep) p.day = dayKeep
      setSearchParams(p, { replace: false })
    },
    [jobId, weekStart, setSearchParams, dayRaw, hideWeekend],
  )

  const goThisWeek = useCallback(() => {
    const s = getDefaultWeekRange().start
    const dayKeep = pickDayForScheduleDispatchUrl(dayRaw, s, hideWeekend)
    const p: Record<string, string> = { jobId, week: s }
    if (dayKeep) p.day = dayKeep
    setSearchParams(p, { replace: false })
  }, [jobId, setSearchParams, dayRaw, hideWeekend])

  const openJobPreviewFromJobWeek = useCallback(() => {
    const pid = scheduleJobProjectId?.trim()
    if (!pid) {
      showToast('No workflow project linked to this job.', 'warning')
      return
    }
    setJobPreview({ projectId: pid, dateKey: null })
  }, [scheduleJobProjectId, showToast])

  const removeScheduleBlockConfirmModal = (
    <RemoveScheduleBlockConfirmModal
      open={deleteBlockId != null}
      busy={deleteBlockBusy}
      onCancel={cancelRequestDeleteBlock}
      onConfirm={() => void confirmDeleteBlock()}
    />
  )

  if (!jobId) return null

  return (
    <>
    <div style={{ padding: '1rem 1.25rem', maxWidth: '100%' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.35rem', fontWeight: isAssistantLike(role) ? 700 : 400 }}>
          Dispatch
        </h1>
        <div style={{ marginBottom: 6 }}>
          <button
            type="button"
            onClick={() => navigate(`/schedule-dispatch?week=${encodeURIComponent(weekStart)}`)}
            style={{
              padding: 0,
              border: 'none',
              background: 'none',
              color: 'var(--text-link)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              textDecoration: 'underline',
              textUnderlineOffset: 2,
            }}
          >
            Week overview (all jobs)
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={openJobPreviewFromJobWeek}
            disabled={jobWeekGridLoading}
            title={jobTitle}
            aria-label={`Job preview: ${jobTitle}`}
            style={{
              padding: 0,
              margin: 0,
              border: 'none',
              background: 'none',
              cursor: jobWeekGridLoading ? 'not-allowed' : 'pointer',
              font: 'inherit',
              fontSize: '0.9375rem',
              color: 'var(--text-700)',
              fontWeight: 600,
              textAlign: 'left',
            }}
          >
            {jobTitle}
          </button>
          <button
            type="button"
            onClick={() => {
              jobFormModal?.openEditJob(jobId, { onSaved: () => void load() })
            }}
            title="Edit job"
            aria-label="Edit job"
            style={{
              flex: '0 0 auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              margin: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              borderRadius: 4,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 640 640"
              width={18}
              height={18}
              fill="currentColor"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
            </svg>
          </button>
        </div>
        {loadError ? (
          <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', margin: '0.5rem 0 0', whiteSpace: 'pre-wrap' }}>{loadError}</p>
        ) : null}
      </div>

      {cardPlacementMode ? (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.5rem 0.75rem',
            background: '#e0e7ff',
            border: '1px solid #a5b4fc',
            borderRadius: 6,
            fontSize: '0.8125rem',
            color: '#3730a3',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>
            Adding a <strong>{cardPlacementMode.variant === 'linked' ? 'linked' : 'solo'}</strong> copy from{' '}
            {placementSourceBlock
              ? scheduleFormatWindow(placementSourceBlock.time_start, placementSourceBlock.time_end)
              : 'this block'}
            . Click a team member&apos;s day cell
            {cardPlacementMode.variant === 'linked'
              ? ` on ${placementSourceBlock?.work_date ?? 'that day'}.`
              : '.'}{' '}
            Press Esc to cancel.
          </span>
          <button
            type="button"
            onClick={() => {
              setCardPlacementMode(null)
              setPlusMenuBlockId(null)
            }}
            style={{
              padding: '0.2rem 0.55rem',
              fontSize: '0.75rem',
              border: '1px solid #4338ca',
              borderRadius: 4,
              background: 'var(--surface)',
              color: '#312e81',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
        <ScheduleDispatchGrid
          weekStart={weekStart}
          visibleDayKeys={visibleDayKeys}
          hideWeekend={hideWeekend}
          onHideWeekendChange={setHideWeekend}
          weekNavDateRangeOverride={dispatchWeekNavDateRangeOverride}
          columnFocusDayYmd={columnFocusDayYmd}
          cardPlacementMode={cardPlacementMode}
          placementSourceWorkDate={placementSourceBlock?.work_date ?? null}
          plusMenuBlockId={plusMenuBlockId}
          onPlusMenuBlockIdChange={setPlusMenuBlockId}
          onStartCardPlacement={(b, v) => onStartCardPlacement(b, v)}
          onCardPlacementCellPick={(assigneeUserId, workDate) =>
            void onCardPlacementPickCell(assigneeUserId, workDate)
          }
          groupMemberCountByGroupId={groupMemberCountByGroupId}
          salariedUserIds={jobScheduleSalariedUserIds}
          teamMembers={teamMembers}
          blocksByCell={blocksByCell}
          loading={jobWeekGridLoading}
          canEdit={canEdit}
          onWeekShift={shiftWeek}
          onThisWeek={goThisWeek}
          onAddClick={(assigneeUserId, workDate) => openAddBlock({ assigneeUserId, workDate, jobId })}
          onEditBlock={openEdit}
          onDeleteBlock={(id) => void requestDeleteBlock(id)}
          onRequestEditBlockNote={canEdit ? (b) => { setBlockNoteError(null); setBlockNoteEdit(b) } : undefined}
          scheduleTodayYmd={scheduleTodayYmd}
          officialJobTeamUserIds={officialJobTeamUserIds ?? undefined}
          canAddUserToJobRoster={canAddToJobRoster}
          onAddUserToJobRoster={canAddToJobRoster ? (uid) => void addUserToJobRoster(uid) : undefined}
          addToJobBusyUserId={addToJobBusyUserId}
          userTimeOffByCell={userTimeOffByCell}
          onRequestUndoNotComingIn={canEdit ? handleRequestUndoNotComingIn : undefined}
        />
      </DndContext>

      <ScheduleDispatchAddBlockModal
        open={blockModalState != null}
        mode={blockModalState?.kind === 'edit' ? 'edit' : 'add'}
        jobTitle={blockModalJobTitleForModal}
        personLabel={blockModalPersonLabel}
        workDate={blockModalWorkDate}
        timeStart={addTimeStart}
        timeEnd={addTimeEnd}
        note={addNote}
        saving={addSaving}
        error={addError}
        onClose={closeAdd}
        onChangeStart={setAddTimeStart}
        onChangeEnd={setAddTimeEnd}
        onChangeNote={setAddNote}
        onSave={() => void saveBlockModal()}
        addTimeline={addBlockModalTimeline}
      />
      <ScheduleDispatchBlockNoteModal
        open={blockNoteEdit != null}
        initialNote={blockNoteEdit?.note ?? null}
        busy={blockNoteBusy}
        error={blockNoteError}
        onClose={() => {
          if (blockNoteBusy) return
          setBlockNoteEdit(null)
          setBlockNoteError(null)
        }}
        onSave={(plain) => void saveJobWeekBlockNote(plain)}
      />
      {removeScheduleBlockConfirmModal}
      <ScheduleDispatchUndoNotComingInModal
        open={undoNotComingInTarget != null}
        busy={undoNotComingInBusy}
        personLabel={undoNotComingInTarget?.personLabel ?? ''}
        workDateLabel={undoNotComingInTarget?.workDateLabel ?? ''}
        onCancel={handleCancelUndoNotComingIn}
        onConfirm={() => void handleConfirmUndoNotComingIn()}
      />
    </div>
    {jobPreview ? (
      <PreviewJobModal
        open
        onClose={() => setJobPreview(null)}
        projectId={jobPreview.projectId}
        contextDateKey={jobPreview.dateKey}
        authUserId={authUser?.id}
        showJobsDeepLink={!isSubcontractorLikeRole(role)}
      />
    ) : null}
    </>
  )
}
