import { readPhonePeopleView, writePhonePeopleView, type PhonePeopleView, resolvePhonePeopleView, type PhonePeopleViewPref } from '../../lib/scheduleDispatch/phonePeopleBoard'
import { blockCoverageKey, coverageOfAssignees, supervisionWarningFor } from '../../lib/schedule/blockGroupCoverage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { resolveScheduleDispatchLinkedDay, scheduleDispatchDayTabWorkDate } from '../../lib/scheduleDispatchDayLink'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useScheduleDispatchHubData } from '../../hooks/useScheduleDispatchHubData'
import { useScheduleDispatchNotComingIn } from '../../hooks/useScheduleDispatchNotComingIn'
import { useScheduleDispatchHubModes } from '../../hooks/useScheduleDispatchHubModes'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useAuth } from '../../hooks/useAuth'
import { OPEN_BID_EDIT_QUERY } from '../../contexts/BidPreviewModalContext'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { bidOpenPath, scheduleBlockTarget } from '../../lib/scheduleBlockTarget'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import {
  deleteJobScheduleBlock,
  isScheduleBidAnchorId,
  scheduleBlockAnchorId,
  updateJobScheduleBlock,
  updateJobScheduleBlockGroup,
  type JobScheduleBlockRow,
  type ScheduleTeamMember,
} from '../../lib/jobScheduleBlocks'
import { dispatchMinutesToHHmm, timeInputToPg } from '../../lib/dispatchAddBlockTime'
import { scheduleTimeToMinutesFromMidnight } from '../../lib/jobScheduleOverlap'
import {
  defaultNewBlockRangeInFirstGap,
  type AddBlockTimelineSegment,
} from '../../lib/scheduleDispatchAddBlockTimeline'
import { scheduleFormatWeekdayLong, scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import { executeScheduleDispatchBlockReassign, moveScheduleDispatchBlockTo } from '../../lib/scheduleDispatchDragEnd'
import { moveDayLabel } from '../../lib/scheduleDispatchMoveBlock'
import ScheduleDispatchMoveBlockSheet from './ScheduleDispatchMoveBlockSheet'
import { ScheduleDispatchAddBlockModal } from './ScheduleDispatchAddBlockModal'
import { ScheduleDispatchBlockNoteModal } from './ScheduleDispatchBlockNoteModal'
import { ScheduleDispatchAssignJobPickerModal } from './ScheduleDispatchAssignJobPickerModal'
import { LinkedScheduleGroupModal } from './LinkedScheduleGroupModal'
import ManagePersonDayModal from '../dispatchMode/ManagePersonDayModal'
import { ScheduleDispatchHub } from './ScheduleDispatchHub'
import { ScheduleShareModal } from './ScheduleShareModal'
import { ScheduleDispatchModeBanners, ScheduleDispatchMultiCellBar } from './ScheduleDispatchModeBanners'
import {
  hubPersonDayKey,
  findDuplicateJobAddress,
  formatScheduleDispatchHubJobTitle,
} from '../../lib/scheduleDispatchHub'
import { buildHubBidPickerRows, filterHubJobPickerRows, hubJobPickerSubline } from '../../lib/scheduleDispatch/hubJobPicker'
import {
  fetchJobSearchEvidence,
  jobSearchEvidenceModeForRole,
  type JobSearchEvidence,
} from '../../lib/jobSearchEvidence'
import { HUB_EXPECTED_MANPOWER_ALL_WEEK } from '../../lib/scheduleDispatchExpectedManpower'
import { pickDayForScheduleDispatchUrl } from '../../lib/scheduleDispatchColumnFocus'
import {
  companyWeekStartSundayContaining,
  denverCalendarDayKey,
  formatScheduleDispatchVisibleDateRange,
  getDefaultWeekRange,
  getScheduleDispatchVisibleDayKeys,
  ymdAddDays,
} from '../../utils/dateUtils'
import {
  CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES as CAN_USE_SCHEDULE_DISPATCH,
  CAN_VIEW_SCHEDULE_DISPATCH_ROLES,
  canWriteTimeOff,
} from '../../lib/scheduleDispatchEditRoles'
import { saveEditedScheduleBlockTimes, saveNewScheduleBlockForPersonDay } from '../../lib/scheduleDispatchAddBlockSave'
import { RemoveScheduleBlockConfirmModal } from './scheduleDispatchRemoveBlockModal'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { ScheduleDispatchUndoNotComingInModal } from './ScheduleDispatchUndoNotComingInModal'
import ConfirmDialog from '../ConfirmDialog'
import { markOffConfirmCopy } from '../../lib/scheduleDispatchNotComingInCopy'

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
  // One resolver for the `?day=` link (tested in scheduleDispatchDayLink.ts):
  // it focuses the week-grid column AND is the day the Day tab opens on —
  // before Tier-2 #17 the Day tab ignored it and rendered today (J18-F11).
  const columnFocusDayYmd = useMemo(
    () => resolveScheduleDispatchLinkedDay({ isTomorrow, tomorrowYmd, dayParam: dayRaw, visibleDayKeys }),
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

  const [shareModalOpen, setShareModalOpen] = useState(false)
  const canEdit = role != null && CAN_USE_SCHEDULE_DISPATCH.has(role)
  /** "off" / undo / picker not-coming-in: only roles the time-off RPC accepts (J18-N2 — superintendent is refused server-side). */
  const canTimeOff = canEdit && canWriteTimeOff(role)

  useEffect(() => {
    if (jobId) return
    setJobTitle('')
    setTeamMembers([])
    setBlocks([])
  }, [jobId])

  // The week data engine (SCHEDULE_DISPATCH map, step 3): loadHub, its state, the memos the
  // tabs project from it, lateness, time off, the standing office schedule and swim lanes.
  const {
    hubLoading,
    hubJobsError,
    hubSummariesError,
    hubBids,
    hubWeekBlocks,
    hubHiddenBlockCounts,
    hubRoleByUserId,
    hubPersonById,
    hubPeopleNameById,
    hubHourlyWageByUserId,
    hubSalariedUserIds,
    hubUserTimeOffByCell,
    hubLatenessByCell,
    swimLanes,
    canShowHubExpectedManpowerPayroll,
    hubPersonDayBlocks,
    hubJobTitleById,
    hubAllPeopleRows,
    hubUserIdsWithBlocksThisWeek,
    hubHiddenByCell,
    hubSubLanes,
    hubSubBadgeByCell,
    hubBlockById,
    hubGroupMemberCountByGroupId,
    hubBlockCoverageByKey,
    hubLinkedGroupAccentMap,
    hubBidMatrixRows,
    hubMergedRows,
    getHubJobDisplayTitle,
    getHubJobAddress,
    refreshHubUserTimeOff,
    loadHub,
    runOfficeEnsure,
    refetchSwimLanes,
  } = useScheduleDispatchHubData({ jobId, weekStart, weekEnd, role, authUserId: authUser?.id, canEdit, showToast })

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
  const [addBlockTimelineSegments, setAddBlockTimelineSegments] = useState<AddBlockTimelineSegment[]>([])
  const [addBlockDraftByBlockId, setAddBlockDraftByBlockId] = useState<
    Record<string, { time_start: string; time_end: string }>
  >({})
  // Press-and-hold Move sheet (phone-first): which block, plus save state.
  const [moveSheetBlock, setMoveSheetBlock] = useState<JobScheduleBlockRow | null>(null)
  const [moveSheetSaving, setMoveSheetSaving] = useState(false)
  const [moveSheetError, setMoveSheetError] = useState<string | null>(null)
  // v2.3156: the People board on a phone vs the desktop grid — per device, page-owned so the mode banners know to stand down.
  // An explicit pick wins at any width (a phone rotated to landscape keeps its board); unset follows the viewport.
  const [phonePeopleViewPref, setPhonePeopleViewPref] = useState<PhonePeopleViewPref>(() => readPhonePeopleView(typeof localStorage === 'undefined' ? null : localStorage))
  const phonePeopleView = resolvePhonePeopleView(phonePeopleViewPref, narrowViewport)
  const onPhonePeopleViewChange = useCallback((view: PhonePeopleView) => {
    setPhonePeopleViewPref(view)
    writePhonePeopleView(typeof localStorage === 'undefined' ? null : localStorage, view)
  }, [])
  const phoneBoardActive = !isTomorrow && hubTab === 'people' && phonePeopleView === 'board'
  const [blockNoteEdit, setBlockNoteEdit] = useState<JobScheduleBlockRow | null>(null)
  const [blockNoteBusy, setBlockNoteBusy] = useState(false)
  const [blockNoteError, setBlockNoteError] = useState<string | null>(null)
  const [hubAssignJobPickerSearch, setHubAssignJobPickerSearch] = useState('')
  /** Money-rail evidence for picker rows, accumulated per job id (fetched only for short result lists). */
  const [hubJobEvidence, setHubJobEvidence] = useState<Map<string, JobSearchEvidence>>(() => new Map())
  const [hubAssignJobPickerNumberQuery, setHubAssignJobPickerNumberQuery] = useState('')
  /** The picker's search and number query start empty each time it opens; they stay page-owned. */
  const onPickerOpened = useCallback(() => {
    setHubAssignJobPickerSearch('')
    setHubAssignJobPickerNumberQuery('')
  }, [])
  /** Entering a placement closes the add-block window (`addBlock` in the mode rule). */
  const closeAddBlockWindow = useCallback(() => {
    setBlockModalState(null)
    setAddError(null)
  }, [])
  // Every mode flag and the rule that entering one leaves the others (lib/scheduleDispatch/hubModes),
  // in useScheduleDispatchHubModes since v2.4986. It hands out intents only, never a flag's setter.
  const {
    cardPlacementMode,
    plusMenuBlockId,
    linkedCopyMode,
    linkedCopyApplyBusy,
    hubAssignJobPlacement,
    hubAssignJobPickerOpen,
    hubAssignJobPickerIntent,
    hubCellAddContext,
    hubMultiCellAddActive,
    hubMultiCellAddSelection,
    placementSourceBlock,
    setCardPlacementMode,
    setPlusMenuBlockId,
    setLinkedCopyMode,
    onPlusMenuBlockIdChange,
    onCancelCardPlacement,
    onStartCardPlacement,
    onCardPlacementPickCell,
    onCancelHubAssignJobPlacement,
    onRequestHubAddJob,
    onHubEmptyCellOpenChoice,
    onRequestHubMultiCellAddMode,
    onHubMultiCellAddToggle,
    onRequestHubMultiCellAddChooseJob,
    closeHubAssignJobPicker,
    applyHubMultiCellJob,
    onStartLinkedCopyMode,
    onLinkedCopyToggleBlock,
    onLinkedCopySetStage,
    onLinkedCopyApplyToPerson,
    onLinkedCopyApplyToLane,
    onCopyBlockToPeople,
    leaveModesFor,
    pickJobToPlace,
    placeNewJob,
  } = useScheduleDispatchHubModes({
    jobId,
    isTomorrow,
    hubTab,
    weekStart,
    hubLoading,
    searchParams,
    setSearchParams,
    canEdit,
    authUser,
    showToast,
    blockById,
    hubBlockById,
    blocks,
    hubWeekBlocks,
    hubPeopleNameById,
    load,
    loadHub,
    onPickerOpened,
    closeAddBlockWindow,
  })

  useEffect(() => {
    if (deleteBlockId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleteBlockBusy) setDeleteBlockId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteBlockId, deleteBlockBusy])

  const openAddBlock = useCallback(
    (args: { assigneeUserId: string; workDate: string; jobId: string }) => {
      leaveModesFor('openAddBlock')
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
    [blocks, hubPersonDayBlocks, jobId, jobTitle, hubJobTitleById, leaveModesFor],
  )

  const closeAdd = useCallback(() => {
    leaveModesFor('closeAddBlock')
    setAddBlockTimelineSegments([])
    setAddBlockDraftByBlockId({})
  }, [leaveModesFor])

  const saveMoveSheet = useCallback(
    async (target: { workDate: string; assigneeUserId: string }) => {
      const b = moveSheetBlock
      if (!b || !canEdit || moveSheetSaving) return
      setMoveSheetSaving(true)
      setMoveSheetError(null)
      const moved = await moveScheduleDispatchBlockTo(b.id, target, {
        blockById: hubBlockById,
        canEdit,
        showToast: (message, type) => {
          if (type === 'error') setMoveSheetError(message)
          else showToast(message, type)
        },
        onSuccess: async () => {
          await loadHub({ quiet: true })
        },
      })
      setMoveSheetSaving(false)
      if (moved) {
        setMoveSheetBlock(null)
        const who = target.assigneeUserId !== b.assignee_user_id ? hubPeopleNameById.get(target.assigneeUserId) : null
        const day = target.workDate !== b.work_date ? moveDayLabel(target.workDate) : null
        showToast(`Moved to ${[day, who].filter(Boolean).join(' · ')}.`, 'success')
      }
    },
    [moveSheetBlock, canEdit, moveSheetSaving, hubBlockById, loadHub, showToast, hubPeopleNameById],
  )

  const onHubAssignJobCellPick = useCallback(
    (assigneeUserId: string, workDate: string) => {
      if (!hubAssignJobPlacement) return
      const jid = hubAssignJobPlacement.jobId
      leaveModesFor('assignCellPick')
      openAddBlock({ assigneeUserId, workDate, jobId: jid })
    },
    [hubAssignJobPlacement, openAddBlock, leaveModesFor],
  )


  const onCreateNewJobFromHubJobPicker = useCallback(() => {
    if (!jobFormModal) return
    const ctx = hubCellAddContext ? { ...hubCellAddContext } : null
    const intentSnapshot = hubAssignJobPickerIntent
    const multiKeys =
      intentSnapshot === 'multi' && hubMultiCellAddSelection.size > 0 ? [...hubMultiCellAddSelection] : null
    leaveModesFor('newJob')
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
            placeNewJob(newId)
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
    leaveModesFor,
    placeNewJob,
  ])

  const hubAssignJobPickerRows = useMemo(
    () => filterHubJobPickerRows(hubMergedRows, hubAssignJobPickerSearch, hubAssignJobPickerNumberQuery),
    [hubMergedRows, hubAssignJobPickerSearch, hubAssignJobPickerNumberQuery],
  )

  /**
   * Bid rows for the assign picker (v2.1613): same generic row shape the modal
   * renders, listed after every job row under their violet "Bid" chip. Search
   * matches bid number / project / address; the digits-only number query
   * matches bid_number.
   */
  const hubAssignBidPickerRows = useMemo(
    () => buildHubBidPickerRows(hubBids, hubWeekBlocks, hubAssignJobPickerSearch, hubAssignJobPickerNumberQuery),
    [hubBids, hubWeekBlocks, hubAssignJobPickerSearch, hubAssignJobPickerNumberQuery],
  )

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

  /** v2.3612 Supervision: the live line under the person while a block is built — null when covered. */
  const blockModalSupervisionWarning = useMemo(() => {
    if (!blockModalState) return null
    if (blockModalState.kind === 'add') {
      const id = blockModalState.assigneeUserId
      return supervisionWarningFor(blockModalPersonLabel, hubPersonById.get(id), coverageOfAssignees([id], hubPersonById))
    }
    const b = blockById.get(blockModalState.blockId)
    if (!b) return null
    return supervisionWarningFor(blockModalPersonLabel, hubPersonById.get(b.assignee_user_id), hubBlockCoverageByKey.get(blockCoverageKey(b)))
  }, [blockModalState, blockModalPersonLabel, hubPersonById, blockById, hubBlockCoverageByKey])

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

  // Not coming in, NCNS and their undo (SCHEDULE_DISPATCH map, step 4).
  const {
    notComingInBusy,
    markNotComingInForPersonDay,
    recordNcnsOnPersonDay,
    markOffConfirmTarget,
    onMarkNotComingInForCell,
    cancelMarkOffForCell,
    confirmMarkOffForCell,
    undoNotComingInTarget,
    undoNotComingInBusy,
    handleRequestUndoNotComingIn,
    handleCancelUndoNotComingIn,
    handleConfirmUndoNotComingIn,
  } = useScheduleDispatchNotComingIn({
    jobId,
    load,
    canEdit,
    showToast,
    hubPeopleNameById,
    hubPersonDayBlocks,
    hubUserTimeOffByCell,
    loadHub,
    refreshHubUserTimeOff,
  })

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

  /** NCNS from the assign picker (v2.2540): its cell's person and day; the writes are `recordNcnsOnPersonDay`. */
  const handleRecordNcnsFromAssignPicker = useCallback(
    async (details: string) => {
      if (!hubCellAddContext) return
      const subjectUserId = hubCellAddContext.assigneeUserId
      const workDateYmd = hubCellAddContext.workDate
      closeHubAssignJobPicker()
      await recordNcnsOnPersonDay(subjectUserId, workDateYmd, details)
    },
    [hubCellAddContext, closeHubAssignJobPicker, recordNcnsOnPersonDay],
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
      // A copy / move / linked-copy mode is anchored to blocks in the loaded week; the phone board
      // would lose its bar (and Cancel) once they are gone, so the week change ends the mode.
      leaveModesFor('weekNav')
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
    [isTomorrow, tomorrowYmd, jobId, weekStart, navigate, setSearchParams, hubTab, dayRaw, hideWeekend, leaveModesFor],
  )

  const goThisWeek = useCallback(() => {
    leaveModesFor('weekNav')
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
  }, [isTomorrow, tomorrowYmd, jobId, navigate, setSearchParams, hubTab, dayRaw, hideWeekend, leaveModesFor])

  const setHubTab = useCallback(
    (t: 'jobs' | 'people' | 'day') => {
      if (t === 'jobs') {
        leaveModesFor('tabAway')
      }
      if (t === 'day') {
        leaveModesFor('tabAway')
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
    [isTomorrow, weekStart, setSearchParams, leaveModesFor],
  )

  const openJobWeekGrid = useCallback(
    (id: string) => {
      // A bid block's "open it" gesture opens the BID (Edit Bid on the Bids page),
      // not a per-job week grid — there is no job to grid (J18-F1, Tier-1 #6c).
      const target = scheduleBlockTarget(id)
      recordNavClick(authUser?.id, role, 'schedule_block_opened', `#${target.kind}`)
      if (target.kind === 'bid') {
        const path = bidOpenPath(target.id, OPEN_BID_EDIT_QUERY)
        if (path) navigate(path)
        return
      }
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
    [isTomorrow, tomorrowYmd, navigate, setSearchParams, weekStart, dayRaw, hideWeekend, authUser?.id, role],
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

  if (role != null && !CAN_VIEW_SCHEDULE_DISPATCH_ROLES.has(role)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <>
        <ScheduleDispatchModeBanners
          cardPlacementMode={cardPlacementMode}
          linkedCopyMode={linkedCopyMode}
          linkedCopyApplyBusy={linkedCopyApplyBusy}
          hubAssignJobPlacement={hubAssignJobPlacement}
          phoneBoardActive={phoneBoardActive}
          placementSourceBlock={placementSourceBlock}
          visibleDayKeys={visibleDayKeys}
          getHubJobDisplayTitle={getHubJobDisplayTitle}
          onCardPlacementPickCell={onCardPlacementPickCell}
          setCardPlacementMode={setCardPlacementMode}
          setPlusMenuBlockId={setPlusMenuBlockId}
          setLinkedCopyMode={setLinkedCopyMode}
          onLinkedCopySetStage={onLinkedCopySetStage}
          onCancelHubAssignJobPlacement={onCancelHubAssignJobPlacement}
        />
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => void handleHubDragEnd(e)}
        >
          <ScheduleDispatchHub
            onRequestMoveBlock={(b) => {
              setMoveSheetError(null)
              setMoveSheetBlock(b)
            }}
            weekStart={weekStart}
            visibleDayKeys={visibleDayKeys}
            hideWeekend={hideWeekend}
            onHideWeekendChange={setHideWeekend}
            weekNavDateRangeOverride={dispatchWeekNavDateRangeOverride}
            showExpectedManpower={!isTomorrow}
            dayTabWorkDateYmd={scheduleDispatchDayTabWorkDate(columnFocusDayYmd)}
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
            bidRows={hubBidMatrixRows}
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
            blockCoverageByKey={hubBlockCoverageByKey}
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
            onPlusMenuBlockIdChange={onPlusMenuBlockIdChange}
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
            phonePeopleView={isTomorrow ? undefined : phonePeopleView}
            onPhonePeopleViewChange={isTomorrow ? undefined : onPhonePeopleViewChange}
            onCopyBlockToPeople={canEdit ? onCopyBlockToPeople : undefined}
            onCancelCardPlacement={onCancelCardPlacement}
            onCancelHubAssignJobPlacement={onCancelHubAssignJobPlacement}
            onLinkedCopySetStage={onLinkedCopySetStage}
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
            onRequestUndoNotComingIn={canTimeOff ? handleRequestUndoNotComingIn : undefined}
            onMarkNotComingInForCell={canTimeOff ? onMarkNotComingInForCell : undefined}
            hiddenByCell={hubHiddenByCell}
            subBadgeByCell={hubSubBadgeByCell}
            subLanes={hubSubLanes}
            hiddenBlockCounts={hubHiddenBlockCounts}
          />
        </DndContext>
        <ScheduleShareModal
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          baseDateYmd={scheduleTodayYmd}
        />
        <ScheduleDispatchMultiCellBar
          hubMultiCellAddActive={hubMultiCellAddActive}
          hubAssignJobPickerOpen={hubAssignJobPickerOpen}
          hubMultiCellAddSelection={hubMultiCellAddSelection}
          onRequestHubMultiCellAddChooseJob={onRequestHubMultiCellAddChooseJob}
        />
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
          warning={blockModalSupervisionWarning}
        />
        {removeScheduleBlockConfirmModal}
        {markOffConfirmTarget ? (
          <ConfirmDialog
            {...markOffConfirmCopy(markOffConfirmTarget)}
            onConfirm={confirmMarkOffForCell}
            onCancel={cancelMarkOffForCell}
          />
        ) : null}
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
            pickJobToPlace(pickedJobId)
            showToast('Click a person day cell to place a block for this job.', 'info')
          }}
          onCreateNewJob={jobFormModal ? onCreateNewJobFromHubJobPicker : undefined}
          notComingIn={
            hubAssignJobPickerIntent === 'cell' && hubCellAddContext && canTimeOff
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
        {moveSheetBlock ? (
          <ScheduleDispatchMoveBlockSheet
            open
            title={getHubJobDisplayTitle(scheduleBlockAnchorId(moveSheetBlock))}
            windowLabel={scheduleFormatWindow(moveSheetBlock.time_start, moveSheetBlock.time_end)}
            sourceYmd={moveSheetBlock.work_date}
            sourceUserId={moveSheetBlock.assignee_user_id}
            visibleDayKeys={visibleDayKeys}
            people={hubAllPeopleRows}
            saving={moveSheetSaving}
            error={moveSheetError}
            onClose={() => {
              if (moveSheetSaving) return
              setMoveSheetBlock(null)
              setMoveSheetError(null)
            }}
            onSave={(target) => void saveMoveSheet(target)}
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
