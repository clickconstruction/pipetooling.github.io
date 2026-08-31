import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import {
  deleteJobScheduleBlock,
  fetchJobScheduleBlocksForHubDateRange,
  fetchScheduleBlocksForAssigneesOnDay,
  insertJobScheduleBlock,
  newJobScheduleSharedBlockGroupId,
  isScheduleBidAnchorId,
  scheduleBlockAnchorFromId,
  scheduleBlockAnchorId,
  updateJobScheduleBlock,
  updateJobScheduleBlockGroup,
  type JobScheduleBlockRow,
  type ScheduleTeamMember,
} from '../../lib/jobScheduleBlocks'
import { buildLinkedGroupAccentMap } from '../../lib/scheduleDispatchLinkedGroupPalette'
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
import { executeScheduleDispatchBlockReassign } from '../../lib/scheduleDispatchDragEnd'
import { insertScheduleDispatchCopiedLeg } from '../../lib/scheduleDispatchMirrorInsert'
import { fetchDispatchSwimLanes, type DispatchSwimLanesData } from '../../lib/dispatchSwimLanes'
import {
  summarizeLinkedCopyApply,
  summarizeLinkedCopyLaneApply,
  toggleLinkedCopyBlockSelection,
  type LinkedCopyLegResult,
  type LinkedCopyMode,
} from '../../lib/scheduleDispatchLinkedCopy'
import { fetchSalariedUserIdSetFromUserIds } from '../../lib/salaryPayConfigGate'
import { ScheduleDispatchAddBlockModal } from './ScheduleDispatchAddBlockModal'
import { ScheduleDispatchBlockNoteModal } from './ScheduleDispatchBlockNoteModal'
import { ScheduleDispatchAssignJobPickerModal } from './ScheduleDispatchAssignJobPickerModal'
import { LinkedScheduleGroupModal } from './LinkedScheduleGroupModal'
import ManagePersonDayModal from '../dispatchMode/ManagePersonDayModal'
import { ScheduleDispatchHub } from './ScheduleDispatchHub'
import { ScheduleShareModal } from './ScheduleShareModal'
import type { ScheduleDispatchCardPlacementMode } from './ScheduleDispatchGrid'
import {
  aggregateWeekSummariesByJob,
  blocksToJobWeekSummaries,
  buildPersonDayBlockMap,
  fetchArchivedUserIdSetForIds,
  hubPersonDayKey,
  fetchBidsForScheduleDispatchHub,
  fetchJobsLedgerForScheduleDispatchHub,
  fetchTeamMemberUserIdsForJobIds,
  fetchUserNamesForIds,
  fetchUsersTabRosterForScheduleDispatchHub,
  findDuplicateJobAddress,
  formatScheduleDispatchHubBidTitle,
  formatScheduleDispatchHubJobTitle,
  parseHubPersonDayKey,
  sortJobPickerRowsFinishedLast,
  type ScheduleDispatchHubBidRow,
  type ScheduleDispatchHubJobRow,
} from '../../lib/scheduleDispatchHub'
import {
  fetchJobSearchEvidence,
  jobSearchEvidenceModeForRole,
  type JobSearchEvidence,
} from '../../lib/jobSearchEvidence'
import { HUB_EXPECTED_MANPOWER_ALL_WEEK } from '../../lib/scheduleDispatchExpectedManpower'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { pickDayForScheduleDispatchUrl } from '../../lib/scheduleDispatchColumnFocus'
import {
  companyWeekStartSundayContaining,
  denverCalendarDayKey,
  denverCalendarDaysBetweenInstantAndNow,
  formatDenverCalendarDayShort,
  formatScheduleDispatchVisibleDateRange,
  getDefaultWeekRange,
  getScheduleDispatchVisibleDayKeys,
  ymdAddDays,
} from '../../utils/dateUtils'
import { CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES as CAN_USE_SCHEDULE_DISPATCH } from '../../lib/scheduleDispatchEditRoles'
import { ensureOfficeScheduleBlocks } from '../../lib/dispatchOfficeRoster'
import { saveEditedScheduleBlockTimes, saveNewScheduleBlockForPersonDay } from '../../lib/scheduleDispatchAddBlockSave'
import { compareJobsByCreatedAtDesc } from '../../lib/assignJobPickerOrder'
import { findJobsByNumber } from '../../lib/jobs/stagesJobNumberJump'
import {
  RemoveScheduleBlockConfirmModal,
  validateScheduleDispatchBlockTimeRange,
} from './scheduleDispatchRemoveBlockModal'
import {
  NO_CALL_NO_SHOW_NOTE,
  recordNotComingInForUserAsStaff,
  removeNotComingInForUserAsStaff,
} from '../../lib/notComingInTimeOff'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import {
  buildUserTimeOffByCell,
  fetchUserTimeOffForUsersInRange,
  userTimeOffCellKey,
  type UserTimeOffCellInfo,
} from '../../lib/userTimeOffByCell'
import { computeLatenessByCell, fetchClockInsForUsersInRange, type PersonDayLateness } from '../../lib/scheduleLateness'
import { ScheduleDispatchUndoNotComingInModal } from './ScheduleDispatchUndoNotComingInModal'
import { stripTrailingZip } from '../../lib/displayAddress'

/** Picker subline: "<N>d Mon D | address" (N calendar days since the job was added, app calendar TZ). Either part optional. */
function hubJobPickerSubline(r: { created_at?: string | null; job_address?: string | null }): string | undefined {
  const dt = (r.created_at ?? '').trim()
  let dateLabel = ''
  if (dt) {
    const d = new Date(dt)
    if (!Number.isNaN(d.getTime())) {
      const daysAgo = denverCalendarDaysBetweenInstantAndNow(d.getTime())
      dateLabel = `${daysAgo}d ${formatDenverCalendarDayShort(d.getTime())}`
    }
  }
  const address = stripTrailingZip(r.job_address)
  if (dateLabel && address) return `${dateLabel} | ${address}`
  return dateLabel || address || undefined
}

const SCHEDULE_DISPATCH_HIDE_WEEKEND_STORAGE_KEY = 'scheduleDispatchHideWeekend'
const SCHEDULE_DISPATCH_HIGHLIGHT_LINKED_GROUPS_KEY = 'scheduleDispatchHighlightLinkedGroups'

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

function readScheduleDispatchHighlightLinkedGroups(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SCHEDULE_DISPATCH_HIGHLIGHT_LINKED_GROUPS_KEY) === '1'
  } catch {
    return false
  }
}

type ScheduleDispatchBlockModalState =
  | { kind: 'add'; assigneeUserId: string; workDate: string; jobId: string }
  | { kind: 'edit'; blockId: string }

type HubAssignJobPlacementState = { jobId: string }

type HubCellAddContextState = { assigneeUserId: string; workDate: string }

type HubAssignJobPickerIntent = 'toolbar' | 'cell' | 'multi'

export function ScheduleDispatchHubPage({ variant = 'url' }: { variant?: 'url' | 'tomorrow' }) {
  const { user: authUser, role, loading: authLoading } = useAuth()
  const { showToast } = useToastContext()
  const jobFormModal = useJobFormModal()
  const jobDetailModal = useJobDetailModal()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isTomorrow = variant === 'tomorrow'
  const jobId = ''
  const tomorrowYmd = useMemo(() => ymdAddDays(denverCalendarDayKey(Date.now()), 1), [])
  const [localHubTab, setLocalHubTab] = useState<'people' | 'jobs' | 'day'>('people')
  const weekRaw = isTomorrow ? companyWeekStartSundayContaining(tomorrowYmd) ?? '' : (searchParams.get('week')?.trim() ?? '')
  const dayRaw = searchParams.get('day')?.trim() ?? ''
  const hubTabFromUrl = useMemo((): 'people' | 'jobs' | 'day' => {
    const v = searchParams.get('hubTab')?.trim()
    if (v === 'jobs') return 'jobs'
    if (v === 'day') return 'day'
    return 'people'
  }, [searchParams])
  const hubTab = isTomorrow ? localHubTab : hubTabFromUrl

  // Phone layout (v2.1240; the toggle was removed in v2.1242 — the compact
  // header IS the phone rendering now): compact header + day-first on narrow.
  const narrowViewport = useNarrowViewport640()
  // Day-first: one-shot replace-redirect on mount. Only when the URL didn't ask
  // for a tab (deep links win) and no placeJob deep link is armed (that flow
  // expects the People grid).
  const hubMobileDayFirstAppliedRef = useRef(false)
  useEffect(() => {
    if (hubMobileDayFirstAppliedRef.current) return
    hubMobileDayFirstAppliedRef.current = true
    if (isTomorrow || !narrowViewport) return
    if (searchParams.get('hubTab')?.trim()) return
    if (searchParams.get('placeJob')?.trim()) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('hubTab', 'day')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only (ref-guarded)
  }, [])

  useEffect(() => {
    if (!isTomorrow) return
    if (localHubTab === 'jobs' || localHubTab === 'day') {
      setLocalHubTab('people')
    }
  }, [isTomorrow, localHubTab])

  const defaultWeekStart = useMemo(() => getDefaultWeekRange().start, [])
  const weekStart = useMemo(() => {
    if (isTomorrow) {
      return companyWeekStartSundayContaining(tomorrowYmd) ?? defaultWeekStart
    }
    if (!weekRaw) return defaultWeekStart
    const n = companyWeekStartSundayContaining(weekRaw)
    return n ?? defaultWeekStart
  }, [isTomorrow, tomorrowYmd, weekRaw, defaultWeekStart])

  const [hideWeekend, setHideWeekend] = useState(readScheduleDispatchHideWeekend)

  useEffect(() => {
    if (isTomorrow) return
    if (!weekRaw) return
    const n = companyWeekStartSundayContaining(weekRaw)
    if (n && n !== weekRaw) {
      if (jobId) {
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
      } else {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.set('week', n)
          const ht = prev.get('hubTab')?.trim()
          if (ht === 'jobs' || ht === 'day') next.set('hubTab', ht)
          else next.delete('hubTab')
          const d = prev.get('day')?.trim() ?? ''
          if (d) {
            if (getScheduleDispatchVisibleDayKeys(n, hideWeekend).includes(d)) next.set('day', d)
            else next.delete('day')
          }
          return next
        }, { replace: true })
      }
    }
  }, [isTomorrow, jobId, weekRaw, setSearchParams, hideWeekend])

  const weekEnd = useMemo(() => ymdAddDays(weekStart, 6), [weekStart])

  useEffect(() => {
    try {
      window.localStorage.setItem(SCHEDULE_DISPATCH_HIDE_WEEKEND_STORAGE_KEY, hideWeekend ? '1' : '0')
    } catch {
      /* ignore quota / private mode */
    }
  }, [hideWeekend])

  const [highlightLinkedGroups, setHighlightLinkedGroups] = useState(readScheduleDispatchHighlightLinkedGroups)
  useEffect(() => {
    try {
      window.localStorage.setItem(
        SCHEDULE_DISPATCH_HIGHLIGHT_LINKED_GROUPS_KEY,
        highlightLinkedGroups ? '1' : '0',
      )
    } catch {
      /* ignore quota / private mode */
    }
  }, [highlightLinkedGroups])

  const [linkedGroupModalId, setLinkedGroupModalId] = useState<string | null>(null)
  /** Clock button on block cards (v2.1817): one person's whole day, editable. */
  const [personDayModal, setPersonDayModal] = useState<{ userId: string; name: string; ymd: string } | null>(null)

  const visibleDayKeys = useMemo(
    () => (isTomorrow ? [tomorrowYmd] : getScheduleDispatchVisibleDayKeys(weekStart, hideWeekend)),
    [isTomorrow, tomorrowYmd, weekStart, hideWeekend],
  )
  const columnFocusDayYmd = useMemo(
    () => (isTomorrow ? tomorrowYmd : dayRaw && visibleDayKeys.includes(dayRaw) ? dayRaw : ''),
    [isTomorrow, tomorrowYmd, dayRaw, visibleDayKeys],
  )

  useEffect(() => {
    if (isTomorrow) return
    if (!dayRaw) return
    if (!visibleDayKeys.includes(dayRaw)) {
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev)
        n.delete('day')
        return n
      }, { replace: true })
    }
  }, [isTomorrow, dayRaw, visibleDayKeys, setSearchParams])

  const scheduleTodayYmd = denverCalendarDayKey(Date.now())
  const dispatchWeekNavDateRangeOverride = useMemo(
    () =>
      isTomorrow || hideWeekend
        ? formatScheduleDispatchVisibleDateRange(visibleDayKeys)
        : undefined,
    [isTomorrow, hideWeekend, visibleDayKeys],
  )

  const [hubExpectedManpowerDayKey, setHubExpectedManpowerDayKey] = useState<string | null>(null)
  useEffect(() => {
    setHubExpectedManpowerDayKey((prev) => {
      if (visibleDayKeys.length === 0) return null
      if (prev === HUB_EXPECTED_MANPOWER_ALL_WEEK) return HUB_EXPECTED_MANPOWER_ALL_WEEK
      if (prev != null && visibleDayKeys.includes(prev)) return prev
      if (visibleDayKeys.includes(scheduleTodayYmd)) return scheduleTodayYmd
      return visibleDayKeys[0] ?? null
    })
  }, [visibleDayKeys, scheduleTodayYmd])

  const [jobTitle, setJobTitle] = useState('')
  const [teamMembers, setTeamMembers] = useState<ScheduleTeamMember[]>([])
  const [blocks, setBlocks] = useState<JobScheduleBlockRow[]>([])

  const [hubLoading, setHubLoading] = useState(false)
  /** Monotonic id so only the latest non-quiet `loadHub` run clears `hubLoading` (overlapping week/job navigations). Quiet refreshes do not bump this. */
  const hubLoadSeqRef = useRef(0)
  const [hubJobsError, setHubJobsError] = useState<string | null>(null)
  const [hubSummariesError, setHubSummariesError] = useState<string | null>(null)
  const [hubJobs, setHubJobs] = useState<ScheduleDispatchHubJobRow[]>([])
  /** Schedulable bids (v2.1613) — picker rows + `bid:<id>` title/address map entries. */
  const [hubBids, setHubBids] = useState<ScheduleDispatchHubBidRow[]>([])
  const [hubWeekBlocks, setHubWeekBlocks] = useState<JobScheduleBlockRow[]>([])
  const [hubTeamMemberUserIds, setHubTeamMemberUserIds] = useState<string[]>([])
  const [hubRoleByUserId, setHubRoleByUserId] = useState<Map<string, string>>(() => new Map())
  const [hubArchivedUserIds, setHubArchivedUserIds] = useState<ReadonlySet<string>>(() => new Set())
  const [hubPeopleNameById, setHubPeopleNameById] = useState<Map<string, string>>(() => new Map())
  const [hubHourlyWageByUserId, setHubHourlyWageByUserId] = useState<Map<string, number>>(() => new Map())
  const [hubPayApprovedMasterIds, setHubPayApprovedMasterIds] = useState<Set<string>>(() => new Set())
  const [hubSalariedUserIds, setHubSalariedUserIds] = useState<Set<string>>(() => new Set())
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const canEdit = role != null && CAN_USE_SCHEDULE_DISPATCH.has(role)

  useEffect(() => {
    if (jobId) return
    setJobTitle('')
    setTeamMembers([])
    setBlocks([])
  }, [jobId])

  useEffect(() => {
    if (!authUser?.id) {
      setHubPayApprovedMasterIds(new Set())
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () => supabase.from('pay_approved_masters').select('master_id'),
          'scheduleDispatchPayApprovedMasters',
        )
        if (cancelled) return
        const rows = (data ?? []) as Array<{ master_id: string }>
        setHubPayApprovedMasterIds(new Set(rows.map((r) => r.master_id)))
      } catch {
        if (!cancelled) setHubPayApprovedMasterIds(new Set())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id])

  const canShowHubExpectedManpowerPayroll = useMemo(
    () =>
      role === 'dev' ||
      (role === 'master_technician' &&
        authUser?.id != null &&
        hubPayApprovedMasterIds.has(authUser.id)),
    [role, authUser?.id, hubPayApprovedMasterIds],
  )

  const hubSummaryRows = useMemo(() => blocksToJobWeekSummaries(hubWeekBlocks), [hubWeekBlocks])

  const hubPersonDayBlocks = useMemo(() => buildPersonDayBlockMap(hubWeekBlocks), [hubWeekBlocks])

  const hubJobTitleById = useMemo(() => {
    const m = new Map<string, string>()
    for (const j of hubJobs) {
      m.set(j.id, formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name, j.click_number))
    }
    // Bid anchors key on their `bid:<uuid>` anchor id, so every id-keyed lookup just works.
    for (const b of hubBids) {
      m.set(`bid:${b.id}`, formatScheduleDispatchHubBidTitle(b.bid_number, b.project_name))
    }
    return m
  }, [hubJobs, hubBids])

  const hubAllPeopleRows = useMemo(() => {
    const idSet = new Set<string>([...hubTeamMemberUserIds, ...hubWeekBlocks.map((b) => b.assignee_user_id)])
    return [...idSet]
      .filter((userId) => !hubArchivedUserIds.has(userId))
      .map((userId) => ({ userId, displayName: hubPeopleNameById.get(userId) ?? 'Unknown' }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))
  }, [hubTeamMemberUserIds, hubWeekBlocks, hubPeopleNameById, hubArchivedUserIds])

  const [hubUserTimeOffByCell, setHubUserTimeOffByCell] = useState<Map<string, UserTimeOffCellInfo>>(
    () => new Map(),
  )
  /**
   * Tracks the `(weekStart, weekEnd, rosterKey)` that `loadHub` last seeded `hubUserTimeOffByCell` for.
   * The standalone `refreshHubUserTimeOff` effect consults this to skip the immediate redundant
   * refetch after a fresh `loadHub` (it still fires for later roster changes — e.g., a quiet
   * refresh that introduces a new assignee).
   */
  const hubUserTimeOffPrimedRef = useRef<
    { weekStart: string; weekEnd: string; rosterKey: string } | null
  >(null)

  const hubVisibleUserIdsSerialized = useMemo(
    () => [...hubAllPeopleRows.map((r) => r.userId)].sort().join('|'),
    [hubAllPeopleRows],
  )

  /** Derived Late chips (v2.2550): clock-ins vs earliest block start, per cell. */
  const [hubLatenessByCell, setHubLatenessByCell] = useState<Map<string, PersonDayLateness>>(
    () => new Map(),
  )
  const refreshHubLateness = useCallback(async () => {
    const userIds = hubAllPeopleRows.map((r) => r.userId)
    if (userIds.length === 0 || !weekStart || !weekEnd || hubWeekBlocks.length === 0) {
      setHubLatenessByCell(new Map())
      return
    }
    const { data, error } = await fetchClockInsForUsersInRange(userIds, weekStart, weekEnd)
    if (error) return
    const blockRows = hubWeekBlocks.map((b) => ({
      assignee_user_id: b.assignee_user_id,
      work_date: b.work_date,
      time_start: b.time_start,
      job_label:
        (hubJobTitleById.get(scheduleBlockAnchorId(b)) ?? '').split('·')[0]?.trim() || null,
    }))
    setHubLatenessByCell(computeLatenessByCell(blockRows, data))
  }, [hubAllPeopleRows, weekStart, weekEnd, hubWeekBlocks, hubJobTitleById])

  useEffect(() => {
    void refreshHubLateness()
  }, [refreshHubLateness])

  const refreshHubUserTimeOff = useCallback(async () => {
    const userIds = hubAllPeopleRows.map((r) => r.userId)
    if (userIds.length === 0 || !weekStart || !weekEnd) {
      setHubUserTimeOffByCell(new Map())
      return
    }
    const { data, error } = await fetchUserTimeOffForUsersInRange(userIds, weekStart, weekEnd)
    if (error) return
    const dayKeys: string[] = []
    for (let i = 0; i < 7; i += 1) dayKeys.push(ymdAddDays(weekStart, i))
    setHubUserTimeOffByCell(buildUserTimeOffByCell(data, dayKeys))
  }, [hubAllPeopleRows, weekStart, weekEnd])

  useEffect(() => {
    const primed = hubUserTimeOffPrimedRef.current
    if (
      primed &&
      primed.weekStart === weekStart &&
      primed.weekEnd === weekEnd &&
      primed.rosterKey === hubVisibleUserIdsSerialized
    ) {
      // `loadHub` just seeded the cell map for this exact (week, roster); skip the refetch.
      return
    }
    void refreshHubUserTimeOff()
  }, [refreshHubUserTimeOff, hubVisibleUserIdsSerialized, weekStart, weekEnd])

  const hubUserIdsWithBlocksThisWeek = useMemo(
    () => new Set(hubWeekBlocks.map((b) => b.assignee_user_id)),
    [hubWeekBlocks],
  )

  const hubBlockById = useMemo(() => {
    const m = new Map<string, JobScheduleBlockRow>()
    for (const b of hubWeekBlocks) m.set(b.id, b)
    return m
  }, [hubWeekBlocks])

  const hubGroupMemberCountByGroupId = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of hubWeekBlocks) {
      const g = b.shared_block_group_id
      if (!g) continue
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }, [hubWeekBlocks])

  const hubLinkedGroupAccentMap = useMemo(() => {
    const ids = new Set<string>()
    for (const b of hubWeekBlocks) {
      const g = b.shared_block_group_id
      if (g) ids.add(g)
    }
    return buildLinkedGroupAccentMap(ids)
  }, [hubWeekBlocks])

  const getHubJobDisplayTitle = useCallback(
    (id: string) => hubJobTitleById.get(id) ?? formatScheduleDispatchHubJobTitle(null, null),
    [hubJobTitleById],
  )

  const hubJobAddressById = useMemo(() => {
    const m = new Map<string, string>()
    for (const j of hubJobs) {
      const a = (j.job_address ?? '').trim()
      if (a) m.set(j.id, a)
    }
    for (const b of hubBids) {
      const a = (b.address ?? '').trim()
      if (a) m.set(`bid:${b.id}`, a)
    }
    return m
  }, [hubJobs, hubBids])

  const getHubJobAddress = useCallback((id: string) => hubJobAddressById.get(id) ?? '', [hubJobAddressById])

  const hubMergedRows = useMemo(() => {
    const agg = aggregateWeekSummariesByJob(hubSummaryRows)
    const rows = hubJobs.map((j) => {
      const s = agg.get(j.id) ?? { total: 0, byDay: {} }
      return {
        ...j,
        displayTitle: formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name, j.click_number),
        totalBlocks: s.total,
        byDay: { ...s.byDay },
      }
    })
    rows.sort((a, b) => {
      if (b.totalBlocks !== a.totalBlocks) return b.totalBlocks - a.totalBlocks
      const ha = (a.hcp_number ?? '').trim()
      const hb = (b.hcp_number ?? '').trim()
      return hb.localeCompare(ha, undefined, { numeric: true })
    })
    return rows
  }, [hubJobs, hubSummaryRows])

  const loadHub = useCallback(async (options?: { quiet?: boolean }) => {
    if (jobId) return
    const quiet = options?.quiet === true
    const hubLoadSeq = quiet ? 0 : ++hubLoadSeqRef.current
    if (!quiet) setHubLoading(true)
    try {
      setHubJobsError(null)
      setHubSummariesError(null)
      setHubSalariedUserIds(new Set())

      // Phase A: jobs ledger + week blocks + users-tab roster + bids — fully independent, parallel.
      const [jr, br, usersTabRes, bidsRes] = await Promise.all([
        fetchJobsLedgerForScheduleDispatchHub(),
        fetchJobScheduleBlocksForHubDateRange(weekStart, weekEnd),
        fetchUsersTabRosterForScheduleDispatchHub(role === 'dev'),
        fetchBidsForScheduleDispatchHub(),
      ])

      let hubJobsData: ScheduleDispatchHubJobRow[] = []
      if (jr.error) {
        setHubJobsError(jr.error)
        setHubJobs([])
      } else {
        hubJobsData = jr.data
        setHubJobs(jr.data)
      }

      // Bids degrade to a warning — the board is still fully usable for jobs.
      if (bidsRes.error) {
        setHubBids([])
        showToast(`Bids list: ${bidsRes.error}`, 'warning')
      } else {
        setHubBids(bidsRes.data)
      }

      let blocksData: JobScheduleBlockRow[] = []
      if (br.error) {
        setHubSummariesError(br.error)
        setHubWeekBlocks([])
        showToast(`Schedule blocks: ${br.error}`, 'warning')
      } else {
        setHubSummariesError(null)
        blocksData = br.data
        setHubWeekBlocks(br.data)
      }

      const usersTabIds = usersTabRes.error ? [] : usersTabRes.data.map((r) => r.id)
      if (usersTabRes.error) showToast(`Dispatch people list: ${usersTabRes.error}`, 'warning')
      setHubRoleByUserId(new Map(usersTabRes.error ? [] : usersTabRes.data.map((r) => [r.id, r.role])))

      // Phase B: team-members for the ledger job ids (needs jobIds from phase A).
      const jobIds = hubJobsData.map((j) => j.id)
      const teamRes = await fetchTeamMemberUserIdsForJobIds(jobIds)
      const teamIds = teamRes.error ? [] : teamRes.data
      if (teamRes.error) showToast(`Team roster: ${teamRes.error}`, 'warning')

      const mergedHubBaseIds = [...new Set([...teamIds, ...usersTabIds])]
      setHubTeamMemberUserIds(mergedHubBaseIds)

      const assigneeIds = [...new Set(blocksData.map((b) => b.assignee_user_id))]
      const rosterIds = [...new Set([...mergedHubBaseIds, ...assigneeIds])]

      // Phase C: names + archived + time-off in parallel (all depend only on rosterIds).
      const [nameRes, archivedSet, timeOffRes] = await Promise.all([
        fetchUserNamesForIds(rosterIds),
        fetchArchivedUserIdSetForIds(rosterIds),
        fetchUserTimeOffForUsersInRange(rosterIds, weekStart, weekEnd),
      ])
      setHubPeopleNameById(nameRes.data)
      if (nameRes.error) showToast(`People names: ${nameRes.error}`, 'warning')
      setHubArchivedUserIds(archivedSet)

      const dayKeys: string[] = []
      for (let i = 0; i < 7; i += 1) dayKeys.push(ymdAddDays(weekStart, i))
      if (!timeOffRes.error) {
        setHubUserTimeOffByCell(buildUserTimeOffByCell(timeOffRes.data, dayKeys))
      }
      // Record what the time-off map was just primed for so the standalone refresh effect
      // can skip the immediate duplicate fetch (it still fires for later roster changes).
      hubUserTimeOffPrimedRef.current = {
        weekStart,
        weekEnd,
        rosterKey: [...rosterIds].sort().join('|'),
      }

      // Phase D: salaried + wages in parallel — both keyed by the already-fetched name map,
      // so no extra `users` round-trip. `Promise.allSettled` keeps a wages failure from
      // dropping the salaried set and vice versa (mirrors the previous try/catch granularity).
      const nameMap = nameRes.data
      const wagesPromise: Promise<Map<string, number>> = (async () => {
        if (!canShowHubExpectedManpowerPayroll) return new Map()
        const names = new Set<string>()
        for (const uid of rosterIds) {
          const raw = nameMap.get(uid)?.trim()
          if (raw && raw !== 'Unknown') names.add(raw)
        }
        const nameList = [...names]
        if (nameList.length === 0) return new Map()
        const payData = await withSupabaseRetry(
          async () =>
            supabase
              .from('people_pay_config')
              .select('person_name, hourly_wage')
              .in('person_name', nameList),
          'scheduleDispatchHubPeoplePayWages',
        )
        const wageByName = new Map<string, number>()
        for (const r of (payData ?? []) as Array<{ person_name: string; hourly_wage: number | null }>) {
          const pn = r.person_name?.trim()
          if (!pn) continue
          const w = r.hourly_wage
          wageByName.set(pn, typeof w === 'number' && Number.isFinite(w) ? w : 0)
        }
        const wageByUserId = new Map<string, number>()
        for (const uid of rosterIds) {
          const nm = nameMap.get(uid)?.trim()
          wageByUserId.set(uid, nm ? (wageByName.get(nm) ?? 0) : 0)
        }
        return wageByUserId
      })()

      const [salariedResult, wagesResult] = await Promise.allSettled([
        fetchSalariedUserIdSetFromUserIds(rosterIds, { nameByUserId: nameMap }),
        wagesPromise,
      ])
      if (salariedResult.status === 'fulfilled') {
        setHubSalariedUserIds(salariedResult.value)
      } else {
        setHubSalariedUserIds(new Set())
        showToast(`Salary flags: ${formatErrorMessage(salariedResult.reason)}`, 'warning')
      }
      if (wagesResult.status === 'fulfilled') {
        setHubHourlyWageByUserId(wagesResult.value)
      } else {
        setHubHourlyWageByUserId(new Map())
        showToast(`Pay rates: ${formatErrorMessage(wagesResult.reason)}`, 'warning')
      }
    } catch (err) {
      showToast(formatErrorMessage(err), 'error')
    } finally {
      if (!quiet && hubLoadSeqRef.current === hubLoadSeq) {
        setHubLoading(false)
      }
    }
  }, [jobId, weekStart, weekEnd, role, showToast, canShowHubExpectedManpowerPayroll])

  const applyHubMultiCellJob = useCallback(
    async (targetJobId: string, selectionKeys: readonly string[]) => {
      const createdBy = authUser?.id
      if (!createdBy) {
        showToast('You must be signed in to add blocks.', 'error')
        return
      }
      if (selectionKeys.length === 0) {
        showToast('No cells selected.', 'info')
        return
      }
      const rangeErr = validateScheduleDispatchBlockTimeRange('08:00', '16:00')
      if (rangeErr) {
        showToast(rangeErr, 'error')
        return
      }
      const ts = timeInputToPg('08:00')
      const te = timeInputToPg('16:00')
      const candidate = scheduleBlockToRange(ts, te)

      let added = 0
      let skippedOverlap = 0
      let failed = 0

      for (const key of selectionKeys) {
        const parsed = parseHubPersonDayKey(key)
        if (!parsed) {
          failed++
          continue
        }
        const { assigneeUserId, workDate } = parsed
        const { data: dayBlocks, error: dayErr } = await fetchScheduleBlocksForAssigneesOnDay(
          [assigneeUserId],
          workDate,
        )
        if (dayErr) {
          failed++
          continue
        }
        if (scheduleOverlapsAny(candidate, dayBlocks, undefined)) {
          skippedOverlap++
          continue
        }
        const { error: insErr } = await insertJobScheduleBlock({
          ...scheduleBlockAnchorFromId(targetJobId),
          assignee_user_id: assigneeUserId,
          work_date: workDate,
          time_start: ts,
          time_end: te,
          note: null,
          created_by: createdBy,
          shared_block_group_id: newJobScheduleSharedBlockGroupId(),
        })
        if (insErr) {
          failed++
        } else {
          added++
        }
      }

      const parts: string[] = []
      if (added > 0) parts.push(`Added ${added} block${added === 1 ? '' : 's'}`)
      if (skippedOverlap > 0) parts.push(`Skipped ${skippedOverlap} (overlap)`)
      if (failed > 0) parts.push(`${failed} failed`)
      showToast(
        parts.length > 0 ? `${parts.join('. ')}.` : 'No blocks added.',
        added > 0 ? 'success' : failed > 0 ? 'error' : 'info',
      )

      setHubMultiCellAddActive(false)
      setHubMultiCellAddSelection(new Set())
      setHubAssignJobPickerOpen(false)
      setHubAssignJobPickerIntent('toolbar')
      setHubCellAddContext(null)
      await loadHub({ quiet: true })
    },
    [authUser?.id, showToast, loadHub],
  )

  useEffect(() => {
    if (jobId) {
      setHubLoading(false)
      return
    }
    void loadHub()
  }, [jobId, loadHub])

  // Standing office schedule (v2.1812): idempotently fill the roster's weekday
  // Office blocks for the visible week whenever an editor views it, then
  // refresh so the new blocks render. Once per range per mount; the RPC's
  // tombstones make repeat calls cheap no-ops. Roster edits force a re-run.
  const officeEnsureRanForRangeRef = useRef<string | null>(null)
  const runOfficeEnsure = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!canEdit || jobId) return
      const rangeKey = `${weekStart}:${weekEnd}`
      if (!opts?.force && officeEnsureRanForRangeRef.current === rangeKey) return
      officeEnsureRanForRangeRef.current = rangeKey
      const { created, error } = await ensureOfficeScheduleBlocks(weekStart, weekEnd)
      if (!error && created > 0) await loadHub({ quiet: true })
    },
    [canEdit, jobId, weekStart, weekEnd, loadHub],
  )
  useEffect(() => {
    void runOfficeEnsure()
  }, [runOfficeEnsure])

  useEffect(() => {
    setHubMultiCellAddActive(false)
    setHubMultiCellAddSelection(new Set())
  }, [weekStart])

  useEffect(() => {
    if (jobId) return
    if (isTomorrow) {
      placeJobArmKeyRef.current = ''
      return
    }
    const pj = searchParams.get('placeJob')?.trim() ?? ''
    if (!pj) {
      placeJobArmKeyRef.current = ''
      return
    }
    if (hubTab === 'jobs') {
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev)
        n.set('week', weekStart)
        n.delete('hubTab')
        n.set('placeJob', pj)
        return n
      }, { replace: true })
      return
    }
    if (hubLoading) return
    const key = `${pj}|${weekStart}`
    if (placeJobArmKeyRef.current === key) return
    placeJobArmKeyRef.current = key
    setCardPlacementMode(null)
    setPlusMenuBlockId(null)
    setHubMultiCellAddActive(false)
    setHubMultiCellAddSelection(new Set())
    setHubAssignJobPlacement({ jobId: pj })
  }, [isTomorrow, jobId, weekStart, hubTab, hubLoading, searchParams, setSearchParams])

  /** Job-week data load. Hub-only page always has `jobId === ''`; full job-week view lives in `ScheduleDispatch`. */
  const load = useCallback(async () => {
    if (!jobId) return
  }, [jobId])

  // Close a lingering Job Detail modal when the view changes (week shift, hub → job week).
  // Depend on the stable closeJobDetail fn, NOT the context object — its identity changes
  // when the modal opens (isOpen flips), which made this effect close it instantly.
  const closeJobDetail = jobDetailModal?.closeJobDetail
  useEffect(() => {
    closeJobDetail?.()
  }, [jobId, weekStart, closeJobDetail])

  useEffect(() => {
    if (!jobId) return
    setHubAssignJobPlacement(null)
    setHubAssignJobPickerOpen(false)
    placeJobArmKeyRef.current = ''
  }, [jobId])

  const blockById = useMemo(() => {
    const m = new Map<string, JobScheduleBlockRow>()
    for (const b of blocks) m.set(b.id, b)
    return m
  }, [blocks])

  const nameByUserId = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of teamMembers) {
      m.set(t.user_id, (t.name ?? '').trim() || 'Unnamed')
    }
    return m
  }, [teamMembers])

  const [blockModalState, setBlockModalState] = useState<ScheduleDispatchBlockModalState | null>(null)
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null)
  const [deleteBlockBusy, setDeleteBlockBusy] = useState(false)
  const [addTimeStart, setAddTimeStart] = useState('08:00')
  const [addTimeEnd, setAddTimeEnd] = useState('16:00')
  const [addNote, setAddNote] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [notComingInBusy, setNotComingInBusy] = useState(false)
  const [addBlockTimelineSegments, setAddBlockTimelineSegments] = useState<AddBlockTimelineSegment[]>([])
  const [addBlockDraftByBlockId, setAddBlockDraftByBlockId] = useState<
    Record<string, { time_start: string; time_end: string }>
  >({})
  const [cardPlacementMode, setCardPlacementMode] = useState<ScheduleDispatchCardPlacementMode | null>(null)
  /** Two-stage "copy jobs linked to people" flow (toolbar chains button). */
  const [linkedCopyMode, setLinkedCopyMode] = useState<LinkedCopyMode | null>(null)
  /** Office-wide swim lanes (People grid 'lanes' grouping + Dispatch Settings manager). */
  const [swimLanes, setSwimLanes] = useState<DispatchSwimLanesData | null>(null)
  const [linkedCopyApplyBusy, setLinkedCopyApplyBusy] = useState(false)
  const [plusMenuBlockId, setPlusMenuBlockId] = useState<string | null>(null)
  const [blockNoteEdit, setBlockNoteEdit] = useState<JobScheduleBlockRow | null>(null)
  const [blockNoteBusy, setBlockNoteBusy] = useState(false)
  const [blockNoteError, setBlockNoteError] = useState<string | null>(null)
  const [hubAssignJobPlacement, setHubAssignJobPlacement] = useState<HubAssignJobPlacementState | null>(null)
  const [hubAssignJobPickerOpen, setHubAssignJobPickerOpen] = useState(false)
  const [hubAssignJobPickerSearch, setHubAssignJobPickerSearch] = useState('')
  /** Money-rail evidence for picker rows, accumulated per job id (fetched only for short result lists). */
  const [hubJobEvidence, setHubJobEvidence] = useState<Map<string, JobSearchEvidence>>(() => new Map())
  const [hubAssignJobPickerNumberQuery, setHubAssignJobPickerNumberQuery] = useState('')
  const [hubCellAddContext, setHubCellAddContext] = useState<HubCellAddContextState | null>(null)
  const [hubAssignJobPickerIntent, setHubAssignJobPickerIntent] = useState<HubAssignJobPickerIntent>('toolbar')
  const [hubMultiCellAddActive, setHubMultiCellAddActive] = useState(false)
  const [hubMultiCellAddSelection, setHubMultiCellAddSelection] = useState<Set<string>>(() => new Set())
  const placeJobArmKeyRef = useRef<string>('')

  const closeHubAssignJobPicker = useCallback(() => {
    setHubAssignJobPickerOpen(false)
    setHubCellAddContext(null)
    setHubAssignJobPickerIntent('toolbar')
    setHubMultiCellAddActive(false)
    setHubMultiCellAddSelection(new Set())
  }, [])

  const placementSourceBlock = useMemo(() => {
    if (!cardPlacementMode) return null
    const m = jobId ? blockById : hubBlockById
    return m.get(cardPlacementMode.sourceBlockId) ?? null
  }, [cardPlacementMode, jobId, blockById, hubBlockById])

  useEffect(() => {
    if (!cardPlacementMode && !hubAssignJobPlacement) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCardPlacementMode(null)
        setPlusMenuBlockId(null)
        setHubAssignJobPlacement(null)
        setHubCellAddContext(null)
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
  }, [cardPlacementMode, hubAssignJobPlacement, setSearchParams])

  useEffect(() => {
    if (deleteBlockId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleteBlockBusy) setDeleteBlockId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteBlockId, deleteBlockBusy])

  const refetchSwimLanes = useCallback(async () => {
    const { data, error } = await fetchDispatchSwimLanes()
    if (!error) setSwimLanes(data)
  }, [])

  useEffect(() => {
    if (!authUser?.id) return
    void refetchSwimLanes()
  }, [authUser?.id, refetchSwimLanes])

  useEffect(() => {
    if (!linkedCopyMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLinkedCopyMode(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [linkedCopyMode])

  useEffect(() => {
    if (!hubMultiCellAddActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHubMultiCellAddActive(false)
        setHubMultiCellAddSelection(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hubMultiCellAddActive])

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
      setHubAssignJobPlacement(null)
      setHubAssignJobPickerOpen(false)
      setHubCellAddContext(null)
      setHubAssignJobPickerIntent('toolbar')
      setHubMultiCellAddActive(false)
      setHubMultiCellAddSelection(new Set())
      setBlockModalState({ kind: 'add', assigneeUserId: args.assigneeUserId, workDate: args.workDate, jobId: args.jobId })
      const rows = jobId
        ? blocks.filter((b) => b.assignee_user_id === args.assigneeUserId && b.work_date === args.workDate)
        : (hubPersonDayBlocks.get(hubPersonDayKey(args.assigneeUserId, args.workDate)) ?? [])
      const labelFor = (jid: string) =>
        jobId ? jobTitle : hubJobTitleById.get(jid) ?? formatScheduleDispatchHubJobTitle(null, null)
      const segments: AddBlockTimelineSegment[] = [...rows]
        .map((b) => ({
          blockId: b.id,
          jobId: scheduleBlockAnchorId(b),
          label: labelFor(scheduleBlockAnchorId(b)),
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
    [blocks, hubPersonDayBlocks, jobId, jobTitle, hubJobTitleById],
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
      if (!canEdit) return
      if (jobId) {
        if (source.job_id !== jobId) return
      } else if (hubTab !== 'people') {
        showToast('Switch to the People tab to place a copy on the grid.', 'info')
        return
      }
      setBlockModalState(null)
      setAddError(null)
      setPlusMenuBlockId(null)
      setHubAssignJobPlacement(null)
      setHubMultiCellAddActive(false)
      setHubMultiCellAddSelection(new Set())
      setLinkedCopyMode(null)
      stripPlaceJobFromUrl()
      setCardPlacementMode({ sourceBlockId: source.id, variant })
      const extra =
        variant === 'linked'
          ? ' Linked copies stay on the same work day as the source.'
          : ' Solo copies can go on any day in this week.'
      showToast(`Click a team member's day cell to add the copy. Press Esc to cancel.${extra}`, 'info')
    },
    [canEdit, jobId, hubTab, showToast, stripPlaceJobFromUrl],
  )

  const onCardPlacementPickCell = useCallback(
    async (assigneeUserId: string, workDate: string) => {
      if (!cardPlacementMode || !authUser?.id) return
      const placementVariant = cardPlacementMode.variant
      const sourceBlockId = cardPlacementMode.sourceBlockId

      if (jobId) {
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
        return
      }

      const source = hubBlockById.get(sourceBlockId)
      if (!source) {
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

      const allJobBlocks = hubWeekBlocks.filter((b) => scheduleBlockAnchorId(b) === scheduleBlockAnchorId(source))
      const { error: hubInsErr } = await insertScheduleDispatchCopiedLeg({
        jobId: scheduleBlockAnchorId(source),
        createdBy: authUser.id,
        source,
        targetAssigneeUserId: assigneeUserId,
        targetWorkDate: workDate,
        linkMode: placementVariant === 'linked' ? 'linked' : 'unlinked',
        allJobBlocks,
      })
      if (hubInsErr) {
        showToast(hubInsErr, 'error')
        return
      }
      setCardPlacementMode(null)
      showToast(placementVariant === 'linked' ? 'Linked copy added.' : 'Solo copy added.', 'success')
      await loadHub({ quiet: true })
    },
    [
      cardPlacementMode,
      jobId,
      authUser?.id,
      blockById,
      hubBlockById,
      blocks,
      hubWeekBlocks,
      load,
      loadHub,
      showToast,
    ],
  )

  const onHubAssignJobCellPick = useCallback(
    (assigneeUserId: string, workDate: string) => {
      if (!hubAssignJobPlacement) return
      const jid = hubAssignJobPlacement.jobId
      setHubAssignJobPlacement(null)
      openAddBlock({ assigneeUserId, workDate, jobId: jid })
    },
    [hubAssignJobPlacement, openAddBlock],
  )

  const onCancelHubAssignJobPlacement = useCallback(() => {
    setHubAssignJobPlacement(null)
    stripPlaceJobFromUrl()
  }, [stripPlaceJobFromUrl])

  const onRequestHubAddJob = useCallback(() => {
    setLinkedCopyMode(null)
    setCardPlacementMode(null)
    setPlusMenuBlockId(null)
    setHubAssignJobPlacement(null)
    setHubCellAddContext(null)
    setHubMultiCellAddActive(false)
    setHubMultiCellAddSelection(new Set())
    stripPlaceJobFromUrl()
    setHubAssignJobPickerIntent('toolbar')
    setHubAssignJobPickerSearch('')
    setHubAssignJobPickerNumberQuery('')
    setHubAssignJobPickerOpen(true)
  }, [stripPlaceJobFromUrl])

  const onHubEmptyCellOpenChoice = useCallback((personUserId: string, workDate: string) => {
    setHubCellAddContext({ assigneeUserId: personUserId, workDate })
    setHubAssignJobPickerIntent('cell')
    setHubAssignJobPickerSearch('')
    setHubAssignJobPickerNumberQuery('')
    setHubAssignJobPickerOpen(true)
  }, [])

  const onRequestHubMultiCellAddMode = useCallback(() => {
    if (hubMultiCellAddActive) {
      setHubMultiCellAddActive(false)
      setHubMultiCellAddSelection(new Set())
      return
    }
    setLinkedCopyMode(null)
    setCardPlacementMode(null)
    setPlusMenuBlockId(null)
    setHubAssignJobPlacement(null)
    setHubCellAddContext(null)
    setHubAssignJobPickerOpen(false)
    setHubAssignJobPickerIntent('toolbar')
    stripPlaceJobFromUrl()
    setHubMultiCellAddSelection(new Set())
    setHubMultiCellAddActive(true)
  }, [hubMultiCellAddActive, stripPlaceJobFromUrl])

  const onHubMultiCellAddToggle = useCallback((personUserId: string, workDate: string) => {
    const k = hubPersonDayKey(personUserId, workDate)
    setHubMultiCellAddSelection((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }, [])

  /** Toolbar chains button: enter (or exit) the two-stage linked-copy flow. */
  const onStartLinkedCopyMode = useCallback(() => {
    if (linkedCopyMode) {
      setLinkedCopyMode(null)
      return
    }
    setCardPlacementMode(null)
    setPlusMenuBlockId(null)
    setHubAssignJobPlacement(null)
    setHubCellAddContext(null)
    setHubAssignJobPickerOpen(false)
    setHubMultiCellAddActive(false)
    setHubMultiCellAddSelection(new Set())
    stripPlaceJobFromUrl()
    setLinkedCopyMode({ stage: 1, selectedBlockIds: new Set() })
  }, [linkedCopyMode, stripPlaceJobFromUrl])

  /** Stage 1: card click toggles a source block in/out of the selection. */
  const onLinkedCopyToggleBlock = useCallback((blockId: string) => {
    setLinkedCopyMode((m) =>
      m && m.stage === 1
        ? { ...m, selectedBlockIds: toggleLinkedCopyBlockSelection(m.selectedBlockIds, blockId) }
        : m,
    )
  }, [])

  const onLinkedCopySetStage = useCallback((stage: 1 | 2) => {
    setLinkedCopyMode((m) => (m ? { ...m, stage } : m))
  }, [])

  /** Stage 2: person click applies a linked copy of every selected block to them
   * (each on its source block's own day; per-leg overlap/duplicate safety lives
   * in insertScheduleDispatchCopiedLeg). Mode stays active for more people. */
  const onLinkedCopyApplyToPerson = useCallback(
    async (personUserId: string) => {
      if (!linkedCopyMode || linkedCopyMode.stage !== 2 || !authUser?.id || linkedCopyApplyBusy) return
      const sources = [...linkedCopyMode.selectedBlockIds]
        .map((id) => hubBlockById.get(id))
        .filter((b): b is JobScheduleBlockRow => b != null)
      if (sources.length === 0) return
      setLinkedCopyApplyBusy(true)
      try {
        const results: LinkedCopyLegResult[] = []
        for (const source of sources) {
          const allJobBlocks = hubWeekBlocks.filter((b) => scheduleBlockAnchorId(b) === scheduleBlockAnchorId(source))
          const { error } = await insertScheduleDispatchCopiedLeg({
            jobId: scheduleBlockAnchorId(source),
            createdBy: authUser.id,
            source,
            targetAssigneeUserId: personUserId,
            targetWorkDate: source.work_date,
            linkMode: 'linked',
            allJobBlocks,
          })
          results.push({ blockId: source.id, error })
        }
        const sum = summarizeLinkedCopyApply(results)
        const personName = hubPeopleNameById.get(personUserId) ?? 'Person'
        showToast(`${personName}: ${sum.message}`, sum.tone)
        await loadHub({ quiet: true })
      } finally {
        setLinkedCopyApplyBusy(false)
      }
    },
    [
      linkedCopyMode,
      linkedCopyApplyBusy,
      authUser?.id,
      hubBlockById,
      hubWeekBlocks,
      hubPeopleNameById,
      loadHub,
      showToast,
    ],
  )


  /** Stage 2 + lanes grouping: lane-heading click = the person apply for every
   * crew member, one combined toast (per-leg safety unchanged). */
  const onLinkedCopyApplyToLane = useCallback(
    async (laneLabel: string, memberUserIds: string[]) => {
      if (!linkedCopyMode || linkedCopyMode.stage !== 2 || !authUser?.id || linkedCopyApplyBusy) return
      const sources = [...linkedCopyMode.selectedBlockIds]
        .map((id) => hubBlockById.get(id))
        .filter((b): b is JobScheduleBlockRow => b != null)
      if (sources.length === 0 || memberUserIds.length === 0) return
      setLinkedCopyApplyBusy(true)
      try {
        const results: LinkedCopyLegResult[] = []
        for (const memberUserId of memberUserIds) {
          for (const source of sources) {
            const allJobBlocks = hubWeekBlocks.filter((b) => scheduleBlockAnchorId(b) === scheduleBlockAnchorId(source))
            const { error } = await insertScheduleDispatchCopiedLeg({
              jobId: scheduleBlockAnchorId(source),
              createdBy: authUser.id,
              source,
              targetAssigneeUserId: memberUserId,
              targetWorkDate: source.work_date,
              linkMode: 'linked',
              allJobBlocks,
            })
            results.push({ blockId: source.id, error })
          }
        }
        const sum = summarizeLinkedCopyLaneApply(laneLabel, memberUserIds.length, results)
        showToast(sum.message, sum.tone)
        await loadHub({ quiet: true })
      } finally {
        setLinkedCopyApplyBusy(false)
      }
    },
    [
      linkedCopyMode,
      linkedCopyApplyBusy,
      authUser?.id,
      hubBlockById,
      hubWeekBlocks,
      loadHub,
      showToast,
    ],
  )

  const onRequestHubMultiCellAddChooseJob = useCallback(() => {
    if (hubMultiCellAddSelection.size === 0) return
    setHubCellAddContext(null)
    setHubAssignJobPickerIntent('multi')
    setHubAssignJobPickerSearch('')
    setHubAssignJobPickerNumberQuery('')
    setHubAssignJobPickerOpen(true)
  }, [hubMultiCellAddSelection])

  const onCreateNewJobFromHubJobPicker = useCallback(() => {
    if (!jobFormModal) return
    const ctx = hubCellAddContext ? { ...hubCellAddContext } : null
    const intentSnapshot = hubAssignJobPickerIntent
    const multiKeys =
      intentSnapshot === 'multi' && hubMultiCellAddSelection.size > 0 ? [...hubMultiCellAddSelection] : null
    setHubAssignJobPickerOpen(false)
    setCardPlacementMode(null)
    setPlusMenuBlockId(null)
    setHubCellAddContext(null)
    jobFormModal.openNewJob({
      onCreatedJobId: (newId) => {
        void loadHub().then(async () => {
          if (multiKeys && multiKeys.length > 0) {
            await applyHubMultiCellJob(newId, multiKeys)
            return
          }
          if (ctx) {
            openAddBlock({ assigneeUserId: ctx.assigneeUserId, workDate: ctx.workDate, jobId: newId })
          } else {
            setHubAssignJobPlacement({ jobId: newId })
            showToast('Click a person day cell to add the first block for this job.', 'info')
          }
        })
      },
      onSaved: () => void loadHub(),
    })
  }, [
    jobFormModal,
    hubCellAddContext,
    hubAssignJobPickerIntent,
    hubMultiCellAddSelection,
    openAddBlock,
    loadHub,
    showToast,
    applyHubMultiCellJob,
  ])

  const hubAssignJobPickerRows = useMemo(() => {
    const digits = hubAssignJobPickerNumberQuery.replace(/\D/g, '')
    if (digits !== '') return sortJobPickerRowsFinishedLast(findJobsByNumber(hubMergedRows, digits))
    const q = hubAssignJobPickerSearch.trim().toLowerCase()
    let list = hubMergedRows
    if (q) {
      list = list.filter(
        (r) =>
          (r.hcp_number ?? '').toLowerCase().includes(q) ||
          (r.job_name ?? '').toLowerCase().includes(q) ||
          r.displayTitle.toLowerCase().includes(q) ||
          (r.job_address ?? '').toLowerCase().includes(q) ||
          (r.customer_name ?? '').toLowerCase().includes(q),
      )
    }
    return sortJobPickerRowsFinishedLast([...list].sort(compareJobsByCreatedAtDesc))
  }, [hubMergedRows, hubAssignJobPickerSearch, hubAssignJobPickerNumberQuery])

  /**
   * Bid rows for the assign picker (v2.1613): same generic row shape the modal
   * renders, listed after every job row under their violet "Bid" chip. Search
   * matches bid number / project / address; the digits-only number query
   * matches bid_number.
   */
  const hubAssignBidPickerRows = useMemo(() => {
    const digits = hubAssignJobPickerNumberQuery.replace(/\D/g, '')
    const q = hubAssignJobPickerSearch.trim().toLowerCase()
    let list = hubBids
    if (digits !== '') {
      list = list.filter((b) => (b.bid_number ?? '').replace(/\D/g, '').includes(digits))
    } else if (q) {
      list = list.filter(
        (b) =>
          (b.bid_number ?? '').toLowerCase().includes(q) ||
          (b.project_name ?? '').toLowerCase().includes(q) ||
          (b.address ?? '').toLowerCase().includes(q) ||
          formatScheduleDispatchHubBidTitle(b.bid_number, b.project_name).toLowerCase().includes(q),
      )
    }
    const blocksThisWeekByBid = new Map<string, number>()
    for (const blk of hubWeekBlocks) {
      if (blk.bid_id != null) {
        blocksThisWeekByBid.set(blk.bid_id, (blocksThisWeekByBid.get(blk.bid_id) ?? 0) + 1)
      }
    }
    return list.map((b) => ({
      id: `bid:${b.id}`,
      displayTitle: formatScheduleDispatchHubBidTitle(b.bid_number, b.project_name),
      serviceTypeName: b.service_type?.name ?? null,
      subline: hubJobPickerSubline({ created_at: b.created_at, job_address: b.address }),
      status: 'bid',
      blocksThisWeek: blocksThisWeekByBid.get(b.id) ?? 0,
      evidence: null,
    }))
  }, [hubBids, hubWeekBlocks, hubAssignJobPickerSearch, hubAssignJobPickerNumberQuery])

  /** Enrich visible picker rows with money-rail evidence — short lists only, debounced, accumulating, failure-silent. */
  useEffect(() => {
    if (!hubAssignJobPickerOpen) return
    if (hubAssignJobPickerRows.length === 0 || hubAssignJobPickerRows.length > 30) return
    const missing = hubAssignJobPickerRows.filter((r) => !hubJobEvidence.has(r.id)).map((r) => r.id)
    if (missing.length === 0) return
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const got = await fetchJobSearchEvidence(missing, jobSearchEvidenceModeForRole(role))
          if (cancelled) return
          setHubJobEvidence((prev) => {
            const next = new Map(prev)
            for (const [k, v] of got) next.set(k, v)
            return next
          })
        } catch {
          // Rows simply render without the rail.
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [hubAssignJobPickerOpen, hubAssignJobPickerRows, hubJobEvidence, role])

  /** Same-address ambiguity warning — only while a search narrows the list (the full ledger always has repeats). */
  const hubAssignJobPickerDuplicateAddressNotice = useMemo(() => {
    const searching =
      hubAssignJobPickerSearch.trim() !== '' || hubAssignJobPickerNumberQuery.replace(/\D/g, '') !== ''
    if (!searching || hubAssignJobPickerRows.length > 8) return null
    const dup = findDuplicateJobAddress(hubAssignJobPickerRows)
    return dup ? `${dup.count} jobs at ${dup.address} — check the status before picking` : null
  }, [hubAssignJobPickerRows, hubAssignJobPickerSearch, hubAssignJobPickerNumberQuery])

  const hubEmptyCellChoiceSubtitle = useMemo(() => {
    if (!hubCellAddContext) return ''
    const name = hubPeopleNameById.get(hubCellAddContext.assigneeUserId) ?? 'Unknown'
    return `${name} · ${scheduleFormatWeekdayLong(hubCellAddContext.workDate)} (${hubCellAddContext.workDate})`
  }, [hubCellAddContext, hubPeopleNameById])

  const hubAssignJobPickerSubtitle = useMemo(() => {
    if (!hubAssignJobPickerOpen) return null
    if (hubAssignJobPickerIntent === 'multi') {
      return (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-600)' }}>
          Adding the same job to <strong>{hubMultiCellAddSelection.size}</strong> selected person/day cell
          {hubMultiCellAddSelection.size === 1 ? '' : 's'} (this week&apos;s hub list).
        </p>
      )
    }
    if (hubCellAddContext) {
      return (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-600)' }}>
          Pick a job to add a block for <strong>{hubEmptyCellChoiceSubtitle}</strong> (this week&apos;s hub list).
        </p>
      )
    }
    return null
  }, [
    hubAssignJobPickerOpen,
    hubAssignJobPickerIntent,
    hubMultiCellAddSelection.size,
    hubCellAddContext,
    hubEmptyCellChoiceSubtitle,
  ])

  const blockModalPersonLabel = useMemo(() => {
    if (!blockModalState) return ''
    if (blockModalState.kind === 'add') {
      if (jobId) {
        return nameByUserId.get(blockModalState.assigneeUserId) ?? 'Unknown'
      }
      return hubPeopleNameById.get(blockModalState.assigneeUserId) ?? 'Unknown'
    }
    const b = blockById.get(blockModalState.blockId)
    return b ? nameByUserId.get(b.assignee_user_id) ?? 'Unknown' : ''
  }, [blockModalState, nameByUserId, blockById, jobId, hubPeopleNameById])

  const blockModalJobTitleForModal = useMemo(() => {
    if (!blockModalState) return ''
    if (blockModalState.kind === 'add') {
      return getHubJobDisplayTitle(blockModalState.jobId)
    }
    return jobTitle
  }, [blockModalState, getHubJobDisplayTitle, jobTitle])

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
    if (blockModalState.kind === 'edit' && !jobId) return
    if (blockModalState.kind === 'add' && !authUser?.id) return

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
      if (jobId) {
        await load()
      } else {
        await loadHub({ quiet: true })
      }
      return
    }

    const b = blockById.get(blockModalState.blockId)
    if (!b) {
      showToast('Block not found.', 'error')
      closeAdd()
      return
    }
    setAddSaving(true)
    setAddError(null)
    const res = await saveEditedScheduleBlockTimes({
      blockId: blockModalState.blockId,
      jobId,
      assigneeUserId: b.assignee_user_id,
      workDate: b.work_date,
      sharedBlockGroupId: b.shared_block_group_id,
      timeStart: addTimeStart,
      timeEnd: addTimeEnd,
      note: addNote,
    })
    setAddSaving(false)
    if (!res.ok) {
      setAddError(res.error)
      return
    }
    showToast('Block updated.', 'success')
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
    closeAdd,
    load,
    loadHub,
    showToast,
  ])

  /** Shared core: record unpaid time off + remove any blocks for the day (verbatim
   * from the assign-picker flow; also used by the empty-cell "off" button). */
  const markNotComingInForPersonDay = useCallback(async (subjectUserId: string, workDateYmd: string) => {
    const personName = hubPeopleNameById.get(subjectUserId) ?? 'Team member'
    const existingBlockIds = (
      hubPersonDayBlocks.get(hubPersonDayKey(subjectUserId, workDateYmd)) ?? []
    ).map((b) => b.id)

    setNotComingInBusy(true)
    const result = await recordNotComingInForUserAsStaff({ subjectUserId, workDateYmd })

    if (!result.ok) {
      setNotComingInBusy(false)
      showToast(result.message, 'error')
      return
    }

    let removedCount = 0
    let removalFailures = 0
    if (existingBlockIds.length > 0) {
      const settled = await Promise.all(
        existingBlockIds.map(async (id) => {
          const { error } = await deleteJobScheduleBlock(id)
          return { id, error }
        }),
      )
      removedCount = settled.filter((r) => !r.error).length
      removalFailures = settled.length - removedCount
    }

    if (result.alreadyMarked) {
      showToast(
        `${personName} already had unpaid time off on ${workDateYmd}.${
          removedCount > 0
            ? ` Removed ${removedCount} schedule block${removedCount === 1 ? '' : 's'} for the day.`
            : ''
        }`,
        'warning',
      )
    } else {
      showToast(
        `Marked ${personName} as not coming in (${workDateYmd}).${
          removedCount > 0
            ? ` Removed ${removedCount} schedule block${removedCount === 1 ? '' : 's'} for the day.`
            : ''
        }`,
        'success',
      )
      if (result.syncWarning) {
        showToast(`Salary sync: ${result.syncWarning}`, 'warning')
      }
    }
    if (removalFailures > 0) {
      showToast(
        `${removalFailures} schedule block${
          removalFailures === 1 ? '' : 's'
        } could not be removed; please remove manually.`,
        'warning',
      )
    }

    if (jobId) {
      await load()
    } else {
      await loadHub({ quiet: true })
    }
    void refreshHubUserTimeOff()
    setNotComingInBusy(false)
  }, [
    hubPeopleNameById,
    hubPersonDayBlocks,
    showToast,
    jobId,
    load,
    loadHub,
    refreshHubUserTimeOff,
  ])

  const handleMarkNotComingInTodayFromAssignPicker = useCallback(async () => {
    if (!hubCellAddContext) return
    const subjectUserId = hubCellAddContext.assigneeUserId
    const workDateYmd = hubCellAddContext.workDate
    closeHubAssignJobPicker()
    await markNotComingInForPersonDay(subjectUserId, workDateYmd)
  }, [hubCellAddContext, closeHubAssignJobPicker, markNotComingInForPersonDay])

  /** Mirrors the day-editor's NCNS gate (payroll-side roles); the RPC enforces
   * payroll access OR team-lead regardless — this only decides link visibility. */
  const canRecordNcns = role === 'dev' || role === 'master_technician' || isAssistantLike(role)

  /**
   * NCNS from the assign picker (v2.2540). ORDER MATTERS: the RPC runs while the
   * schedule blocks still exist — with zero clock sessions it accepts the incident
   * only as "scheduled, no clock time", so clearing blocks first would make it
   * refuse. On any RPC refusal (open session / already recorded / access denied)
   * nothing else happens — no half-marked day.
   */
  const handleRecordNcnsFromAssignPicker = useCallback(
    async (details: string) => {
      if (!hubCellAddContext) return
      const subjectUserId = hubCellAddContext.assigneeUserId
      const workDateYmd = hubCellAddContext.workDate
      const personName = hubPeopleNameById.get(subjectUserId) ?? 'Team member'
      const existingBlockIds = (
        hubPersonDayBlocks.get(hubPersonDayKey(subjectUserId, workDateYmd)) ?? []
      ).map((b) => b.id)
      closeHubAssignJobPicker()
      setNotComingInBusy(true)
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase.rpc('record_ncns_and_reject_sessions_for_day', {
              p_subject_user_id: subjectUserId,
              p_work_date: workDateYmd,
              ...(details ? { p_details: details } : {}),
            }),
          'record ncns from dispatch',
        )
        const row = (data ?? [])[0] as
          | { rejected_count: number; had_approved_sessions: boolean; error_message: string | null }
          | undefined
        if (!row || row.error_message) {
          showToast(row?.error_message ?? 'Could not record NCNS.', 'error')
          return
        }

        // Incident is on record — now clear the day like "not coming in" does,
        // with the NCNS note so the board chip reads NCNS.
        const timeOff = await recordNotComingInForUserAsStaff({
          subjectUserId,
          workDateYmd,
          note: NO_CALL_NO_SHOW_NOTE,
        })
        let removedCount = 0
        let removalFailures = 0
        if (existingBlockIds.length > 0) {
          const settled = await Promise.all(
            existingBlockIds.map(async (id) => {
              const { error } = await deleteJobScheduleBlock(id)
              return { id, error }
            }),
          )
          removedCount = settled.filter((r) => !r.error).length
          removalFailures = settled.length - removedCount
        }

        const parts = [`NCNS recorded for ${personName} (${workDateYmd}).`]
        if (row.rejected_count > 0) {
          parts.push(`${row.rejected_count} clock session${row.rejected_count === 1 ? '' : 's'} rejected.`)
        }
        if (row.had_approved_sessions) parts.push('Approved hours were unwound.')
        if (removedCount > 0) {
          parts.push(`Removed ${removedCount} schedule block${removedCount === 1 ? '' : 's'}.`)
        }
        showToast(parts.join(' '), 'success')
        if (!timeOff.ok) {
          showToast(`Day-off marking failed: ${timeOff.message} (the incident is recorded).`, 'warning')
        } else if (timeOff.alreadyMarked) {
          showToast(`${personName} already had time off recorded for the day.`, 'warning')
        } else if (timeOff.syncWarning) {
          showToast(`Salary sync: ${timeOff.syncWarning}`, 'warning')
        }
        if (removalFailures > 0) {
          showToast(
            `${removalFailures} schedule block${removalFailures === 1 ? '' : 's'} could not be removed; please remove manually.`,
            'warning',
          )
        }

        if (jobId) {
          await load()
        } else {
          await loadHub({ quiet: true })
        }
        void refreshHubUserTimeOff()
      } catch (e) {
        showToast(e instanceof Error ? e.message : String(e), 'error')
      } finally {
        setNotComingInBusy(false)
      }
    },
    [
      hubCellAddContext,
      hubPeopleNameById,
      hubPersonDayBlocks,
      closeHubAssignJobPicker,
      showToast,
      jobId,
      load,
      loadHub,
      refreshHubUserTimeOff,
    ],
  )

  /** Empty-cell "off" button: mark that person/day as not coming in directly. */
  const onMarkNotComingInForCell = useCallback(
    (personUserId: string, workDate: string) => {
      if (notComingInBusy) return
      void markNotComingInForPersonDay(personUserId, workDate)
    },
    [notComingInBusy, markNotComingInForPersonDay],
  )

  // ──────────────────────────────────────────────────────────────────────
  // Undo "Not coming in" — confirm modal driven by a click on the cell chip.
  // ──────────────────────────────────────────────────────────────────────
  const [undoNotComingInTarget, setUndoNotComingInTarget] = useState<
    | {
        personUserId: string
        personLabel: string
        workDate: string
        workDateLabel: string
        /** NCNS chip: sterner modal copy — the attendance incident stays on record. */
        isNcns: boolean
      }
    | null
  >(null)
  const [undoNotComingInBusy, setUndoNotComingInBusy] = useState(false)

  const handleRequestUndoNotComingIn = useCallback(
    (personUserId: string, workDate: string) => {
      if (!canEdit) return
      const personLabel = hubPeopleNameById.get(personUserId) ?? 'Team member'
      const cellInfo = hubUserTimeOffByCell.get(userTimeOffCellKey(personUserId, workDate))
      setUndoNotComingInTarget({
        personUserId,
        personLabel,
        workDate,
        workDateLabel: scheduleFormatWeekdayLong(workDate),
        isNcns: cellInfo?.variant === 'ncns',
      })
    },
    [canEdit, hubPeopleNameById, hubUserTimeOffByCell],
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
        // Already cleared by someone else — refresh quietly so the chip goes away.
        showToast(`${target.personLabel} was already cleared for ${target.workDate}.`, 'warning')
      } else {
        showToast(
          target.isNcns
            ? `NCNS schedule mark cleared for ${target.personLabel} (${target.workDate}). The attendance incident stays on record.`
            : `${target.personLabel} is no longer marked Not coming in (${target.workDate}).`,
          'success',
        )
        if (result.syncWarning) {
          showToast(`Salary sync: ${result.syncWarning}`, 'warning')
        }
      }
      setUndoNotComingInTarget(null)
      if (jobId) {
        await load()
      } else {
        await loadHub({ quiet: true })
      }
      void refreshHubUserTimeOff()
    } finally {
      setUndoNotComingInBusy(false)
    }
  }, [
    undoNotComingInTarget,
    canEdit,
    showToast,
    jobId,
    load,
    loadHub,
    refreshHubUserTimeOff,
  ])

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
      if (jobId) await load()
      else await loadHub({ quiet: true })
    } finally {
      setDeleteBlockBusy(false)
    }
  }, [deleteBlockId, canEdit, jobId, load, loadHub, showToast])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleHubDragEnd = useCallback(
    async (event: DragEndEvent) => {
      await executeScheduleDispatchBlockReassign(event, {
        blockById: hubBlockById,
        canEdit,
        showToast,
        onSuccess: () => loadHub({ quiet: true }),
      })
    },
    [hubBlockById, canEdit, loadHub, showToast],
  )

  const shiftWeek = useCallback(
    (deltaWeeks: number) => {
      setHubAssignJobPlacement(null)
      placeJobArmKeyRef.current = ''
      const next = ymdAddDays(weekStart, deltaWeeks * 7)
      if (isTomorrow) {
        const dayKeep = pickDayForScheduleDispatchUrl(tomorrowYmd, next, hideWeekend)
        const p = new URLSearchParams()
        p.set('week', next)
        if (hubTab === 'jobs') p.set('hubTab', 'jobs')
        else if (hubTab === 'day') p.set('hubTab', 'day')
        if (dayKeep) p.set('day', dayKeep)
        navigate(`/schedule-dispatch?${p.toString()}`)
        return
      }
      const dayKeep = pickDayForScheduleDispatchUrl(dayRaw, next, hideWeekend)
      if (jobId) {
        const p: Record<string, string> = { jobId, week: next }
        if (dayKeep) p.day = dayKeep
        setSearchParams(p, { replace: false })
      } else {
        const p: Record<string, string> = { week: next }
        if (hubTab === 'jobs') p.hubTab = 'jobs'
        else if (hubTab === 'day') p.hubTab = 'day'
        if (dayKeep) p.day = dayKeep
        setSearchParams(p, { replace: false })
      }
    },
    [isTomorrow, tomorrowYmd, jobId, weekStart, navigate, setSearchParams, hubTab, dayRaw, hideWeekend],
  )

  const goThisWeek = useCallback(() => {
    setHubAssignJobPlacement(null)
    placeJobArmKeyRef.current = ''
    const s = getDefaultWeekRange().start
    if (isTomorrow) {
      const dayKeep = pickDayForScheduleDispatchUrl(tomorrowYmd, s, hideWeekend)
      const p = new URLSearchParams()
      p.set('week', s)
      if (hubTab === 'jobs') p.set('hubTab', 'jobs')
      else if (hubTab === 'day') p.set('hubTab', 'day')
      if (dayKeep) p.set('day', dayKeep)
      navigate(`/schedule-dispatch?${p.toString()}`)
      return
    }
    const dayKeep = pickDayForScheduleDispatchUrl(dayRaw, s, hideWeekend)
    if (jobId) {
      const p: Record<string, string> = { jobId, week: s }
      if (dayKeep) p.day = dayKeep
      setSearchParams(p, { replace: false })
    } else {
      const p: Record<string, string> = { week: s }
      if (hubTab === 'jobs') p.hubTab = 'jobs'
      else if (hubTab === 'day') p.hubTab = 'day'
      if (dayKeep) p.day = dayKeep
      setSearchParams(p, { replace: false })
    }
  }, [isTomorrow, tomorrowYmd, jobId, navigate, setSearchParams, hubTab, dayRaw, hideWeekend])

  const setHubTab = useCallback(
    (t: 'jobs' | 'people' | 'day') => {
      if (t === 'jobs') {
        setCardPlacementMode(null)
        setPlusMenuBlockId(null)
        setHubAssignJobPlacement(null)
        setHubMultiCellAddActive(false)
        setHubMultiCellAddSelection(new Set())
        stripPlaceJobFromUrl()
      }
      if (t === 'day') {
        setCardPlacementMode(null)
        setPlusMenuBlockId(null)
        setHubAssignJobPlacement(null)
        setHubMultiCellAddActive(false)
        setHubMultiCellAddSelection(new Set())
        stripPlaceJobFromUrl()
        if (isTomorrow) {
          setLocalHubTab('day')
          return
        }
        setSearchParams((prev) => {
          const n = new URLSearchParams(prev)
          n.set('week', weekStart)
          n.set('hubTab', 'day')
          return n
        }, { replace: true })
        return
      }
      if (t === 'people') {
        if (isTomorrow) {
          setLocalHubTab('people')
          return
        }
        setSearchParams((prev) => {
          const n = new URLSearchParams(prev)
          n.set('week', weekStart)
          n.delete('hubTab')
          return n
        }, { replace: true })
        return
      }
      if (isTomorrow) {
        setLocalHubTab('jobs')
        return
      }
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev)
        n.set('week', weekStart)
        n.set('hubTab', 'jobs')
        return n
      }, { replace: true })
    },
    [isTomorrow, weekStart, setSearchParams, stripPlaceJobFromUrl],
  )

  const openJobWeekGrid = useCallback(
    (id: string) => {
      if (isTomorrow) {
        const dayKeep = pickDayForScheduleDispatchUrl(tomorrowYmd, weekStart, hideWeekend)
        const p = new URLSearchParams()
        p.set('jobId', id)
        p.set('week', weekStart)
        if (dayKeep) p.set('day', dayKeep)
        navigate(`/schedule-dispatch?${p.toString()}`)
        return
      }
      const dayKeep = pickDayForScheduleDispatchUrl(dayRaw, weekStart, hideWeekend)
      const p: Record<string, string> = { jobId: id, week: weekStart }
      if (dayKeep) p.day = dayKeep
      setSearchParams(p, { replace: false })
    },
    [isTomorrow, tomorrowYmd, navigate, setSearchParams, weekStart, dayRaw, hideWeekend],
  )

  const openHubJobDetail = useCallback(
    (block: JobScheduleBlockRow, workDateYmd: string) => {
      // Bid-anchored blocks (v2.1613) have no Job Detail to open.
      if (block.job_id == null) return
      jobDetailModal?.openJobDetail({
        jobId: block.job_id,
        scheduleContext: {
          workDate: workDateYmd,
          timeStart: block.time_start,
          timeEnd: block.time_end,
          note: block.note,
        },
        prefillRowLabel: getHubJobDisplayTitle(block.job_id),
        prefillAddress: null,
        assignedJobsRows: [],
        onEditJobSaved: () => void loadHub(),
      })
    },
    [getHubJobDisplayTitle, jobDetailModal, loadHub],
  )

  const saveHubBlockNote = useCallback(
    async (plain: string) => {
      if (!blockNoteEdit || !canEdit) return
      setBlockNoteBusy(true)
      setBlockNoteError(null)
      const noteVal = plain.trim() || null
      const b = blockNoteEdit
      const gid = b.shared_block_group_id
      try {
        if (gid) {
          const { error: upErr } = await updateJobScheduleBlockGroup(gid, { note: noteVal })
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
        await loadHub({ quiet: true })
      } finally {
        setBlockNoteBusy(false)
      }
    },
    [blockNoteEdit, canEdit, loadHub, showToast],
  )

  const removeScheduleBlockConfirmModal = (
    <RemoveScheduleBlockConfirmModal
      open={deleteBlockId != null}
      busy={deleteBlockBusy}
      onCancel={cancelRequestDeleteBlock}
      onConfirm={() => void confirmDeleteBlock()}
    />
  )

  if (authLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  if (role != null && !CAN_USE_SCHEDULE_DISPATCH.has(role)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <>
        {cardPlacementMode ? (
          <div
            style={{
              margin: '0 1.25rem',
              marginBottom: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-blue-200)',
              border: '1px solid var(--border-indigo)',
              borderRadius: 6,
              fontSize: '0.8125rem',
              color: 'var(--text-blue-900)',
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
                color: 'var(--text-blue-900)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}
        {linkedCopyMode ? (
          <div
            role="status"
            style={{
              margin: '0 1.25rem',
              marginBottom: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-blue-200)',
              border: '1px solid var(--border-indigo)',
              borderRadius: 6,
              fontSize: '0.8125rem',
              color: 'var(--text-blue-900)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {linkedCopyMode.stage === 1 ? (
              <>
                <span>
                  <strong>1 of 2</strong> — Click the job blocks you want to copy linked (
                  {linkedCopyMode.selectedBlockIds.size} selected). Press Esc to cancel.
                </span>
                <button
                  type="button"
                  disabled={linkedCopyMode.selectedBlockIds.size === 0}
                  onClick={() => onLinkedCopySetStage(2)}
                  style={{
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.75rem',
                    border: '1px solid #4338ca',
                    borderRadius: 4,
                    background:
                      linkedCopyMode.selectedBlockIds.size === 0 ? 'var(--bg-muted)' : '#4338ca',
                    color: linkedCopyMode.selectedBlockIds.size === 0 ? 'var(--text-muted)' : '#fff',
                    cursor: linkedCopyMode.selectedBlockIds.size === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Next: pick people
                </button>
              </>
            ) : (
              <>
                <span>
                  <strong>2 of 2</strong> — Click the people to apply{' '}
                  <strong>{linkedCopyMode.selectedBlockIds.size}</strong> linked{' '}
                  {linkedCopyMode.selectedBlockIds.size === 1 ? 'copy' : 'copies'} to
                  {linkedCopyApplyBusy ? ' (applying…)' : ''}. Each copy lands on its source
                  block&apos;s day. In the swim-lanes grouping, clicking a lane heading applies
                  to the whole crew. Press Esc when done.
                </span>
                <button
                  type="button"
                  onClick={() => onLinkedCopySetStage(1)}
                  style={{
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.75rem',
                    border: '1px solid #4338ca',
                    borderRadius: 4,
                    background: 'var(--surface)',
                    color: 'var(--text-blue-900)',
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setLinkedCopyMode(null)}
                  style={{
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.75rem',
                    border: '1px solid #4338ca',
                    borderRadius: 4,
                    background: '#4338ca',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Done
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setLinkedCopyMode(null)}
              style={{
                padding: '0.2rem 0.55rem',
                fontSize: '0.75rem',
                border: '1px solid #4338ca',
                borderRadius: 4,
                background: 'var(--surface)',
                color: 'var(--text-blue-900)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}
        {hubAssignJobPlacement ? (
          <div
            style={{
              margin: '0 1.25rem',
              marginBottom: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-emerald-tint)',
              border: '1px solid #6ee7b7',
              borderRadius: 6,
              fontSize: '0.8125rem',
              color: 'var(--text-emerald-800)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>
              Placing schedule for <strong>{getHubJobDisplayTitle(hubAssignJobPlacement.jobId)}</strong>. Click a
              person&apos;s day cell. Press Esc to cancel.
            </span>
            <button
              type="button"
              onClick={() => onCancelHubAssignJobPlacement()}
              style={{
                padding: '0.2rem 0.55rem',
                fontSize: '0.75rem',
                border: '1px solid #047857',
                borderRadius: 4,
                background: 'var(--surface)',
                color: 'var(--text-emerald-800)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => void handleHubDragEnd(e)}
        >
          <ScheduleDispatchHub
            weekStart={weekStart}
            visibleDayKeys={visibleDayKeys}
            hideWeekend={hideWeekend}
            onHideWeekendChange={setHideWeekend}
            weekNavDateRangeOverride={dispatchWeekNavDateRangeOverride}
            showExpectedManpower={!isTomorrow}
            dayTabWorkDateYmd={isTomorrow ? tomorrowYmd : undefined}
            onDayScheduleChanged={() => void loadHub({ quiet: true })}
            showWeekNavigation={!isTomorrow}
            showHubViewTabs={!isTomorrow}
            showHideWeekendToggle={!isTomorrow}
            mobileNewMode={!isTomorrow && narrowViewport}
            weekNavRightSlot={
              canEdit && !isTomorrow ? (
                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    border: '1px solid #ff6600',
                    borderRadius: 4,
                    background: '#ff6600',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                  }}
                >
                  Share
                </button>
              ) : undefined
            }
            columnFocusDayYmd={columnFocusDayYmd}
            rows={hubMergedRows}
            loading={hubLoading}
            jobsError={hubJobsError}
            summariesError={hubSummariesError}
            hubTab={hubTab}
            onHubTabChange={setHubTab}
            personDayBlocks={hubPersonDayBlocks}
            allPeopleRows={hubAllPeopleRows}
            userIdsWithBlocksThisWeek={hubUserIdsWithBlocksThisWeek}
            salariedUserIds={hubSalariedUserIds}
            getJobDisplayTitle={getHubJobDisplayTitle}
            getJobAddress={getHubJobAddress}
            groupMemberCountByGroupId={hubGroupMemberCountByGroupId}
            canEdit={canEdit}
            onWeekShift={shiftWeek}
            onThisWeek={goThisWeek}
            onOpenJob={openJobWeekGrid}
            onOpenHubJobDetail={openHubJobDetail}
            focusPersonUserId={searchParams.get('focusPerson')?.trim() || null}
            roleByUserId={hubRoleByUserId}
            scheduleTodayYmd={scheduleTodayYmd}
            cardPlacementMode={cardPlacementMode}
            placementSourceWorkDate={placementSourceBlock?.work_date ?? null}
            plusMenuBlockId={plusMenuBlockId}
            onPlusMenuBlockIdChange={setPlusMenuBlockId}
            onStartCardPlacement={(b, v) => onStartCardPlacement(b, v)}
            onCardPlacementCellPick={(assigneeUserId, workDate) =>
              void onCardPlacementPickCell(assigneeUserId, workDate)
            }
            highlightLinkedGroups={highlightLinkedGroups}
            onHighlightLinkedGroupsChange={setHighlightLinkedGroups}
            linkedGroupAccentByGroupId={hubLinkedGroupAccentMap}
            onOpenLinkedGroup={(gid) => setLinkedGroupModalId(gid)}
            hubWeekBlocks={hubWeekBlocks}
            hubExpectedManpowerDayKey={hubExpectedManpowerDayKey}
            onHubExpectedManpowerDayChange={setHubExpectedManpowerDayKey}
            hubPeopleNameById={hubPeopleNameById}
            canShowExpectedManpowerPayroll={canShowHubExpectedManpowerPayroll}
            hubHourlyWageByUserId={hubHourlyWageByUserId}
            hubAssignJobPlacement={hubAssignJobPlacement}
            onRequestHubAddJob={onRequestHubAddJob}
            linkedCopyMode={linkedCopyMode}
            onStartLinkedCopyMode={onStartLinkedCopyMode}
            onLinkedCopyToggleBlock={onLinkedCopyToggleBlock}
            onLinkedCopyApplyToPerson={onLinkedCopyApplyToPerson}
            onLinkedCopyApplyToLane={onLinkedCopyApplyToLane}
            linkedCopyApplyBusy={linkedCopyApplyBusy}
            swimLanes={swimLanes}
            onSwimLanesChanged={() => void refetchSwimLanes()}
            onOfficeRosterChanged={() => void runOfficeEnsure({ force: true })}
            onQuickAssignScheduled={() => void loadHub({ quiet: true })}
            onHubAssignJobCellPick={onHubAssignJobCellPick}
            onDeleteBlock={(id) => void requestDeleteBlock(id)}
            onHubEmptyCellClick={canEdit ? onHubEmptyCellOpenChoice : undefined}
            onHubAddJobToScheduleForCell={canEdit ? onHubEmptyCellOpenChoice : undefined}
            hubMultiCellAddActive={hubMultiCellAddActive}
            hubMultiCellAddSelectedKeys={hubMultiCellAddSelection}
            onHubMultiCellAddToggle={canEdit ? onHubMultiCellAddToggle : undefined}
            onRequestHubMultiCellAddMode={canEdit ? onRequestHubMultiCellAddMode : undefined}
            onRequestEditBlockNote={canEdit ? (b) => { setBlockNoteError(null); setBlockNoteEdit(b) } : undefined}
            onOpenPersonDay={(b) =>
              setPersonDayModal({
                userId: b.assignee_user_id,
                name: hubPeopleNameById.get(b.assignee_user_id) ?? 'This person',
                ymd: b.work_date,
              })
            }
            userTimeOffByCell={hubUserTimeOffByCell}
            latenessByCell={hubLatenessByCell}
            onRequestUndoNotComingIn={canEdit ? handleRequestUndoNotComingIn : undefined}
            onMarkNotComingInForCell={canEdit ? onMarkNotComingInForCell : undefined}
          />
        </DndContext>
        <ScheduleShareModal
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          baseDateYmd={scheduleTodayYmd}
        />
        {hubMultiCellAddActive && !hubAssignJobPickerOpen ? (
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1002,
              display: 'flex',
              justifyContent: 'center',
              padding: '0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px))',
              pointerEvents: 'none',
            }}
          >
            <button
              type="button"
              disabled={hubMultiCellAddSelection.size === 0}
              onClick={onRequestHubMultiCellAddChooseJob}
              style={{
                pointerEvents: 'auto',
                padding: '0.65rem 1.25rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: 8,
                background: hubMultiCellAddSelection.size === 0 ? '#9ca3af' : '#2563eb',
                color: '#fff',
                cursor: hubMultiCellAddSelection.size === 0 ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
              }}
            >
              Choose job for multi-cell add
              {hubMultiCellAddSelection.size > 0 ? ` (${hubMultiCellAddSelection.size})` : ''}
            </button>
          </div>
        ) : null}
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
          onRemove={
            blockModalState?.kind === 'edit' && canEdit
              ? () => {
                  const id = blockModalState.blockId
                  closeAdd()
                  requestDeleteBlock(id)
                }
              : undefined
          }
          addTimeline={addBlockModalTimeline}
        />
        {removeScheduleBlockConfirmModal}
        <ScheduleDispatchUndoNotComingInModal
          open={undoNotComingInTarget != null}
          busy={undoNotComingInBusy}
          personLabel={undoNotComingInTarget?.personLabel ?? ''}
          workDateLabel={undoNotComingInTarget?.workDateLabel ?? ''}
          isNcns={undoNotComingInTarget?.isNcns ?? false}
          onCancel={handleCancelUndoNotComingIn}
          onConfirm={() => void handleConfirmUndoNotComingIn()}
        />
        <ScheduleDispatchAssignJobPickerModal
          open={hubAssignJobPickerOpen}
          onClose={closeHubAssignJobPicker}
          subtitle={hubAssignJobPickerSubtitle}
          jobRows={[
            ...hubAssignJobPickerRows.map((r) => ({
              id: r.id,
              displayTitle: r.displayTitle,
              serviceTypeName: r.service_type?.name ?? null,
              subline: hubJobPickerSubline(r),
              status: r.status ?? null,
              blocksThisWeek: r.totalBlocks,
              evidence: hubJobEvidence.get(r.id) ?? null,
            })),
            ...hubAssignBidPickerRows,
          ]}
          duplicateAddressNotice={hubAssignJobPickerDuplicateAddressNotice}
          evidenceMode={jobSearchEvidenceModeForRole(role)}
          searchValue={hubAssignJobPickerSearch}
          onSearchChange={setHubAssignJobPickerSearch}
          numberQuery={hubAssignJobPickerNumberQuery}
          onNumberQueryChange={setHubAssignJobPickerNumberQuery}
          searchPlaceholder="Search HCP, job, address, or customer"
          onOpenJobDetail={(pickedJobId) => {
            if (isScheduleBidAnchorId(pickedJobId)) return
            const row = hubMergedRows.find((r) => r.id === pickedJobId)
            // Picker stays open underneath — Job Detail (and Edit Job from it)
            // stack above it, so closing them lands back on this picker.
            jobDetailModal?.openJobDetail({
              jobId: pickedJobId,
              prefillRowLabel: row?.displayTitle ?? null,
              prefillAddress: row?.job_address ?? null,
              assignedJobsRows: [],
              onEditJobSaved: () => void loadHub(),
            })
          }}
          onPickJob={(pickedJobId) => {
            if (hubAssignJobPickerIntent === 'multi') {
              void applyHubMultiCellJob(pickedJobId, [...hubMultiCellAddSelection])
              return
            }
            if (hubCellAddContext) {
              openAddBlock({
                assigneeUserId: hubCellAddContext.assigneeUserId,
                workDate: hubCellAddContext.workDate,
                jobId: pickedJobId,
              })
              return
            }
            setHubAssignJobPickerOpen(false)
            setHubAssignJobPickerIntent('toolbar')
            setCardPlacementMode(null)
            setPlusMenuBlockId(null)
            setHubAssignJobPlacement({ jobId: pickedJobId })
            showToast('Click a person day cell to place a block for this job.', 'info')
          }}
          onCreateNewJob={jobFormModal ? onCreateNewJobFromHubJobPicker : undefined}
          notComingIn={
            hubAssignJobPickerIntent === 'cell' && hubCellAddContext
              ? {
                  personLabel:
                    hubPeopleNameById.get(hubCellAddContext.assigneeUserId) ?? 'Team member',
                  workDateLabel: scheduleFormatWeekdayLong(hubCellAddContext.workDate),
                  existingBlockCount: (
                    hubPersonDayBlocks.get(
                      hubPersonDayKey(
                        hubCellAddContext.assigneeUserId,
                        hubCellAddContext.workDate,
                      ),
                    ) ?? []
                  ).length,
                  busy: notComingInBusy,
                  onConfirm: handleMarkNotComingInTodayFromAssignPicker,
                }
              : undefined
          }
          noCallNoShow={
            hubAssignJobPickerIntent === 'cell' && hubCellAddContext && canRecordNcns
              ? { busy: notComingInBusy, onConfirm: handleRecordNcnsFromAssignPicker }
              : undefined
          }
        />
        {linkedGroupModalId ? (
          <LinkedScheduleGroupModal
            open
            onClose={() => setLinkedGroupModalId(null)}
            groupId={linkedGroupModalId}
            weekStart={weekStart}
            weekEnd={weekEnd}
            getJobDisplayTitle={getHubJobDisplayTitle}
            canManage={canEdit}
            addPeople={hubAllPeopleRows.map((r) => ({ userId: r.userId, displayName: r.displayName }))}
            onChanged={() => void loadHub({ quiet: true })}
          />
        ) : null}
        {personDayModal ? (
          <ManagePersonDayModal
            open
            personUserId={personDayModal.userId}
            personName={personDayModal.name}
            initialYmd={personDayModal.ymd}
            onClose={() => setPersonDayModal(null)}
            onChanged={() => void loadHub({ quiet: true })}
          />
        ) : null}
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
          onSave={(plain) => void saveHubBlockNote(plain)}
        />
    </>
  )
}
