import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel'
import { useToastContext } from '../../contexts/ToastContext'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { fetchScheduleBlocksForAssigneesOnDay, type JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import {
  fetchJobsLedgerForScheduleDispatchHub,
  fetchUserNamesForIds,
  fetchUsersTabRosterForScheduleDispatchHub,
  formatScheduleDispatchHubJobTitle,
  type ScheduleDispatchHubJobRow,
} from '../../lib/scheduleDispatchHub'
import {
  defaultNewBlockRangeInFirstGap,
  type AddBlockTimelineSegment,
} from '../../lib/scheduleDispatchAddBlockTimeline'
import { scheduleTimeToMinutesFromMidnight } from '../../lib/jobScheduleOverlap'
import { scheduleFormatWeekdayLong } from '../../lib/jobScheduleChicago'
import { CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES } from '../../lib/scheduleDispatchEditRoles'
import { saveNewScheduleBlockForPersonDay } from '../../lib/scheduleDispatchAddBlockSave'
import { ScheduleDispatchAddBlockModal } from '../schedule/ScheduleDispatchAddBlockModal'
import { ScheduleDispatchAssignJobPickerModal } from '../schedule/ScheduleDispatchAssignJobPickerModal'
import {
  DISPATCH_ADD_BLOCK_SLOT_COUNT,
  dispatchMinutesToHHmm,
  timeInputToPg,
} from '../../lib/dispatchAddBlockTime'
import {
  DISPATCH_ADD_BLOCK_ORIENTATION_MARKS,
  dispatchAddBlockTrackThumbLeftPct,
  type DispatchOccupiedBand,
  type DispatchSecondaryBand,
} from '../schedule/DispatchAddBlockTimeRange'
import {
  clockSessionsToDispatchSecondaryBands,
  type ClockSessionForDispatchBand,
} from '../../lib/clockSessionsToDispatchSecondaryBands'
import { recordNotComingInForUserAsStaff } from '../../lib/notComingInTimeOff'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { DashboardMyTimeDayEditorModal } from '../DashboardMyTimeDayEditorModal'
import {
  companyWeekStartSundayContaining,
  denverCalendarDayKey,
  formatDenverCalendarDayWithWeekdayAndYear,
  getDefaultWeekRange,
  referenceDateForWorkDateYmd,
  ymdAddDays,
} from '../../utils/dateUtils'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerShortLine } from '../../lib/ledgerDisplayPrefixes'
import { QUICKFILL_SECTION_BANNER_BOX_STYLE } from '../../lib/quickfillSectionBannerStyle'
import { groupRosterUsersByAuthRoleSection } from '../../lib/usersTabRosterRoleSections'
import { blocksToSegments } from '../../lib/quickfillScheduleSegments'
import {
  QuickfillScheduleUserRow,
  QUICKFILL_SCHEDULE_ADD_COL_WIDTH,
  QUICKFILL_SCHEDULE_NAME_COL_WIDTH,
  QUICKFILL_SCHEDULE_ROW_GAP,
} from '../schedule/QuickfillScheduleUserRow'

const SCHEDULE_CONFLICTS_DEFAULT_PROMPT = 'Are there any obvious schedule conflicts?'

const QUICKFILL_SCHEDULE_HIDE_ASSISTANT_ESTIMATOR_KEY = 'quickfill_schedule_hide_assistant_estimator'

function readHideAssistantsEstimatorsFromStorage(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(QUICKFILL_SCHEDULE_HIDE_ASSISTANT_ESTIMATOR_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Quickfill overview: one read-only Add-block-style timeline per user (Schedule Dispatch roster) for a chosen day.
 * Edits happen on Schedule Dispatch. Section header does not show a Quickfill “open” backlog count (not comparable to inbox-style sections).
 *
 * On the Quickfill page, pass `hideConflictPrompt` so the section wrapper’s configurable banner is the only callout.
 */
type QuickfillBlockModalState = { kind: 'add'; assigneeUserId: string; workDate: string; jobId: string }

export function QuickfillScheduleSection({
  hideConflictPrompt = false,
  initialWorkDateYmd,
}: {
  hideConflictPrompt?: boolean
  /** When set (e.g. Dispatch hub / Quickfill tomorrow), use this as the initial schedule day. */
  initialWorkDateYmd?: string
} = {}) {
  const navigate = useNavigate()
  const { role, user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const ledgerPrefixMap = useLedgerPrefixMap()
  const canEditSchedule = role != null && CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES.has(role)
  const showClockStripScopeToggle =
    role === 'dev' || role === 'master_technician' || role === 'assistant'
  const showStripSubjectMyTimeEditor = showClockStripScopeToggle || role === 'superintendent'
  const [scheduleMyTimeEditor, setScheduleMyTimeEditor] = useState<{
    subjectUserId: string
    subjectDisplayName: string
  } | null>(null)
  const [workDate, setWorkDate] = useState(
    () => (initialWorkDateYmd != null && initialWorkDateYmd !== '' ? initialWorkDateYmd : denverCalendarDayKey(Date.now())),
  )
  useEffect(() => {
    if (initialWorkDateYmd != null && initialWorkDateYmd !== '') setWorkDate(initialWorkDateYmd)
  }, [initialWorkDateYmd])
  const [loading, setLoading] = useState(true)
  const [userIds, setUserIds] = useState<string[]>([])
  const [nameById, setNameById] = useState<Map<string, string>>(() => new Map())
  const [blocksByUserId, setBlocksByUserId] = useState<Map<string, JobScheduleBlockRow[]>>(() => new Map())
  const [jobTitleById, setJobTitleById] = useState<Map<string, string>>(() => new Map())
  const [bidTitleById, setBidTitleById] = useState<Map<string, string>>(() => new Map())
  const [sessionsByUserId, setSessionsByUserId] = useState<Map<string, ClockSessionForDispatchBand[]>>(
    () => new Map(),
  )
  const [roleByUserId, setRoleByUserId] = useState<Map<string, string>>(() => new Map())
  const [searchQuery, setSearchQuery] = useState('')
  const [hideAssistantsEstimators, setHideAssistantsEstimators] = useState(readHideAssistantsEstimatorsFromStorage)
  const [hubJobsForPicker, setHubJobsForPicker] = useState<ScheduleDispatchHubJobRow[]>([])
  const [cellAddContext, setCellAddContext] = useState<{ assigneeUserId: string; workDate: string } | null>(null)
  const [assignJobPickerOpen, setAssignJobPickerOpen] = useState(false)
  const [assignJobPickerSearch, setAssignJobPickerSearch] = useState('')
  const [blockModalState, setBlockModalState] = useState<QuickfillBlockModalState | null>(null)
  const [addBlockTimelineSegments, setAddBlockTimelineSegments] = useState<AddBlockTimelineSegment[]>([])
  const [addBlockDraftByBlockId, setAddBlockDraftByBlockId] = useState<
    Record<string, { time_start: string; time_end: string }>
  >({})
  const [addTimeStart, setAddTimeStart] = useState('08:00')
  const [addTimeEnd, setAddTimeEnd] = useState('16:00')
  const [addNote, setAddNote] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addSaving, setAddSaving] = useState(false)

  const sortedUsers = useMemo(() => {
    const rows = userIds.map((id) => ({ id, name: (nameById.get(id) ?? 'Unknown').trim() || 'Unknown' }))
    rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    return rows
  }, [userIds, nameById])

  /** Visible roster after role filter; then search runs in filteredSortedUsers. */
  const rosterFilteredUsers = useMemo(() => {
    if (!hideAssistantsEstimators) return sortedUsers
    return sortedUsers.filter(({ id }) => {
      const r = roleByUserId.get(id)
      return r !== 'assistant' && r !== 'estimator'
    })
  }, [sortedUsers, hideAssistantsEstimators, roleByUserId])

  const filteredSortedUsers = useMemo(() => {
    const q = searchQuery.trim()
    if (q === '') return rosterFilteredUsers
    const n = q.toLowerCase()
    return rosterFilteredUsers.filter(({ id, name }) => {
      if (name.toLowerCase().includes(n)) return true
      for (const b of blocksByUserId.get(id) ?? []) {
        const title = jobTitleById.get(b.job_id) ?? formatScheduleDispatchHubJobTitle(null, null)
        if (title.toLowerCase().includes(n)) return true
      }
      return false
    })
  }, [rosterFilteredUsers, searchQuery, blocksByUserId, jobTitleById])

  const scheduleUsersByRoleSection = useMemo(
    () => groupRosterUsersByAuthRoleSection(filteredSortedUsers, roleByUserId),
    [filteredSortedUsers, roleByUserId],
  )

  const scheduleSecondaryByUserId = useMemo(() => {
    const now = Date.now()
    const m = new Map<string, DispatchSecondaryBand[]>()
    for (const id of userIds) {
      const bands = clockSessionsToDispatchSecondaryBands(
        sessionsByUserId.get(id) ?? [],
        workDate,
        now,
        jobTitleById,
        bidTitleById,
      )
      if (bands.length > 0) m.set(id, bands)
    }
    return m
  }, [userIds, sessionsByUserId, workDate, jobTitleById, bidTitleById])

  const jobLabelsRecord = useMemo(() => Object.fromEntries(jobTitleById), [jobTitleById])
  const bidLabelsRecord = useMemo(() => Object.fromEntries(bidTitleById), [bidTitleById])

  const openMyTimeForSessionStrip = useCallback((uid: string, name: string) => {
    setScheduleMyTimeEditor({ subjectUserId: uid, subjectDisplayName: name })
  }, [])

  const closeQuickfillAddBlock = useCallback(() => {
    setBlockModalState(null)
    setAddError(null)
    setAddBlockTimelineSegments([])
    setAddBlockDraftByBlockId({})
  }, [])

  const closeQuickfillJobPicker = useCallback(() => {
    setAssignJobPickerOpen(false)
    setCellAddContext(null)
    setAssignJobPickerSearch('')
  }, [])

  const openQuickfillAddBlock = useCallback(
    (args: { assigneeUserId: string; workDate: string; jobId: string }) => {
      setAssignJobPickerOpen(false)
      setCellAddContext(null)
      setAssignJobPickerSearch('')
      setBlockModalState({ kind: 'add', assigneeUserId: args.assigneeUserId, workDate: args.workDate, jobId: args.jobId })
      const rows = blocksByUserId.get(args.assigneeUserId) ?? []
      const labelFor = (jid: string) => jobTitleById.get(jid) ?? formatScheduleDispatchHubJobTitle(null, null)
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
    [blocksByUserId, jobTitleById],
  )

  /** Unique jobs_ledger ids from this person’s clock sessions on the picker day (first clock-in order). */
  const quickfillOrderedSessionJobLedgerIds = useMemo(() => {
    if (!cellAddContext) return [] as string[]
    const sessions = sessionsByUserId.get(cellAddContext.assigneeUserId) ?? []
    const out: string[] = []
    const seen = new Set<string>()
    for (const s of sessions) {
      const jid = s.job_ledger_id?.trim()
      if (!jid || seen.has(jid)) continue
      seen.add(jid)
      out.push(jid)
    }
    return out
  }, [cellAddContext, sessionsByUserId])

  const quickfillSessionJobOrderIndex = useMemo(() => {
    const m = new Map<string, number>()
    quickfillOrderedSessionJobLedgerIds.forEach((id, i) => m.set(id, i))
    return m
  }, [quickfillOrderedSessionJobLedgerIds])

  const quickfillPickerJobsSorted = useMemo(
    () =>
      [...hubJobsForPicker].sort((a, b) => {
        const ia = quickfillSessionJobOrderIndex.get(a.id)
        const ib = quickfillSessionJobOrderIndex.get(b.id)
        const aIn = ia !== undefined
        const bIn = ib !== undefined
        if (aIn && !bIn) return -1
        if (!aIn && bIn) return 1
        if (aIn && bIn && ia !== ib) return ia - ib
        const ha = (a.hcp_number ?? '').trim()
        const hb = (b.hcp_number ?? '').trim()
        return hb.localeCompare(ha, undefined, { numeric: true })
      }),
    [hubJobsForPicker, quickfillSessionJobOrderIndex],
  )

  const quickfillAssignJobPickerRows = useMemo(() => {
    const q = assignJobPickerSearch.trim().toLowerCase()
    const sessionTodaySet = new Set(quickfillOrderedSessionJobLedgerIds)
    let list = quickfillPickerJobsSorted
    if (q) {
      list = list.filter(
        (j) =>
          (j.hcp_number ?? '').toLowerCase().includes(q) ||
          (j.job_name ?? '').toLowerCase().includes(q) ||
          formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name).toLowerCase().includes(q),
      )
    }
    return list.map((j) => ({
      id: j.id,
      displayTitle: formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name),
      sessionToday: sessionTodaySet.has(j.id),
    }))
  }, [assignJobPickerSearch, quickfillOrderedSessionJobLedgerIds, quickfillPickerJobsSorted])

  const quickfillCellChoiceSubtitle = useMemo(() => {
    if (!cellAddContext) return ''
    const name = (nameById.get(cellAddContext.assigneeUserId) ?? 'Unknown').trim() || 'Unknown'
    return `${name} · ${scheduleFormatWeekdayLong(cellAddContext.workDate)} (${cellAddContext.workDate})`
  }, [cellAddContext, nameById])

  const quickfillAssignJobPickerSubtitle = useMemo((): ReactNode => {
    if (!cellAddContext) return null
    return (
      <p style={{ margin: 0, fontSize: '0.875rem', color: '#4b5563' }}>
        Pick a job to add a block for <strong>{quickfillCellChoiceSubtitle}</strong>.
      </p>
    )
  }, [cellAddContext, quickfillCellChoiceSubtitle])

  const blockModalPersonLabel = useMemo(() => {
    if (!blockModalState) return ''
    return (nameById.get(blockModalState.assigneeUserId) ?? 'Unknown').trim() || 'Unknown'
  }, [blockModalState, nameById])

  const blockModalJobTitle = useMemo(() => {
    if (!blockModalState) return ''
    return jobTitleById.get(blockModalState.jobId) ?? formatScheduleDispatchHubJobTitle(null, null)
  }, [blockModalState, jobTitleById])

  const addBlockModalTimeline = useMemo(() => {
    if (!blockModalState) return undefined
    return {
      segments: addBlockTimelineSegments,
      draftByBlockId: addBlockDraftByBlockId,
      setDraftByBlockId: setAddBlockDraftByBlockId,
    }
  }, [blockModalState, addBlockTimelineSegments, addBlockDraftByBlockId])

  useEffect(() => {
    setAssignJobPickerOpen(false)
    setCellAddContext(null)
    setAssignJobPickerSearch('')
    closeQuickfillAddBlock()
  }, [workDate, closeQuickfillAddBlock])

  useReportQuickfillSectionMetric('schedule', null, false)

  const dayLabel = useMemo(() => {
    const ms = referenceDateForWorkDateYmd(workDate).getTime()
    return formatDenverCalendarDayWithWeekdayAndYear(ms)
  }, [workDate])

  const scheduleDispatchHref = useMemo(() => {
    const weekStart = companyWeekStartSundayContaining(workDate) ?? getDefaultWeekRange().start
    return `/schedule-dispatch?week=${encodeURIComponent(weekStart)}&day=${encodeURIComponent(workDate)}`
  }, [workDate])

  const openOccupiedBandOnScheduleDispatch = useCallback(
    (band: DispatchOccupiedBand) => {
      const jid = band.jobId?.trim()
      if (!jid) return
      const weekStart = companyWeekStartSundayContaining(workDate) ?? getDefaultWeekRange().start
      const target = `/schedule-dispatch?jobId=${encodeURIComponent(jid)}&week=${encodeURIComponent(weekStart)}&day=${encodeURIComponent(workDate)}`
      navigate(target)
    },
    [navigate, workDate],
  )

  const toggleHideAssistantsEstimators = useCallback(() => {
    setHideAssistantsEstimators((prev) => {
      const next = !prev
      try {
        localStorage.setItem(QUICKFILL_SCHEDULE_HIDE_ASSISTANT_ESTIMATOR_KEY, next ? '1' : '0')
      } catch {
        /* ignore quota / private mode */
      }
      return next
    })
  }, [])

  const loadData = useCallback(async (options?: { quiet?: boolean }) => {
    const quiet = options?.quiet === true
    if (!quiet) setLoading(true)
    try {
      const [usersRes, jobsRes] = await Promise.all([
        fetchUsersTabRosterForScheduleDispatchHub(role === 'dev'),
        fetchJobsLedgerForScheduleDispatchHub(),
      ])
      if (usersRes.error) {
        showToast(usersRes.error, 'error')
        setUserIds([])
        setRoleByUserId(new Map())
        setBlocksByUserId(new Map())
        setSessionsByUserId(new Map())
        setBidTitleById(new Map())
        setHubJobsForPicker([])
        return
      }
      const roster = usersRes.data
      const ids = roster.map((r) => r.id)
      setRoleByUserId(new Map(roster.map((r) => [r.id, r.role])))
      const jMap = new Map<string, string>()
      if (!jobsRes.error) {
        setHubJobsForPicker(jobsRes.data)
        for (const j of jobsRes.data) {
          jMap.set(j.id, formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name))
        }
      } else {
        setHubJobsForPicker([])
      }
      setJobTitleById(jMap)

      const namesRes = await fetchUserNamesForIds(ids)
      if (namesRes.error) {
        showToast(namesRes.error, 'warning')
      }
      setNameById(namesRes.data)

      if (ids.length === 0) {
        setUserIds([])
        setBlocksByUserId(new Map())
        setSessionsByUserId(new Map())
        setBidTitleById(new Map())
        return
      }

      const { data: blockRows, error: blockErr } = await fetchScheduleBlocksForAssigneesOnDay(ids, workDate)
      if (blockErr) {
        showToast(blockErr, 'error')
      }

      let sessionRows: ClockSessionForDispatchBand[] = []
      try {
        const raw = await withSupabaseRetry(
          async () =>
            await supabase
              .from('clock_sessions')
              .select('id, user_id, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, notes')
              .in('user_id', ids)
              .eq('work_date', workDate)
              .is('rejected_at', null)
              .is('revoked_at', null)
              .order('clocked_in_at', { ascending: true }),
          'quickfill schedule clock_sessions',
        )
        sessionRows = (raw ?? []) as ClockSessionForDispatchBand[]
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not load clock sessions'), 'warning')
      }

      const bidIds = new Set<string>()
      for (const r of sessionRows) {
        if (r.bid_id) bidIds.add(r.bid_id)
      }
      const bidMap = new Map<string, string>()
      if (bidIds.size > 0) {
        try {
          const bidRows = await withSupabaseRetry(
            async () =>
              await supabase
                .from('bids')
                .select('id, bid_number, project_name, service_type_id')
                .in('id', [...bidIds]),
            'quickfill schedule bids for clock sessions',
          )
          for (const br of bidRows ?? []) {
            const b = br as {
              id: string
              bid_number: string | null
              project_name: string | null
              service_type_id: string | null
            }
            const num = b.bid_number?.trim()
            const pn = (b.project_name ?? '').trim()
            const label = num
              ? formatBidLedgerShortLine(ledgerPrefixMap, b.service_type_id, b.bid_number, b.project_name)
              : pn || 'Bid'
            bidMap.set(b.id, label)
          }
        } catch (e) {
          showToast(formatErrorMessage(e, 'Could not load bid names for clock sessions'), 'warning')
        }
      }
      setBidTitleById(bidMap)

      const sessionsByUser = new Map<string, ClockSessionForDispatchBand[]>()
      for (const id of ids) {
        sessionsByUser.set(id, [])
      }
      for (const r of sessionRows) {
        const arr = sessionsByUser.get(r.user_id) ?? []
        arr.push(r)
        sessionsByUser.set(r.user_id, arr)
      }
      setSessionsByUserId(sessionsByUser)

      const byUser = new Map<string, JobScheduleBlockRow[]>()
      for (const id of ids) {
        byUser.set(id, [])
      }
      if (!blockErr) {
        for (const b of blockRows) {
          const arr = byUser.get(b.assignee_user_id) ?? []
          arr.push(b)
          byUser.set(b.assignee_user_id, arr)
        }
      }
      for (const [, arr] of byUser) {
        arr.sort((a, c) => a.time_start.localeCompare(c.time_start))
      }
      setUserIds(ids)
      setBlocksByUserId(byUser)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load schedule overview'), 'error')
      setUserIds([])
      setRoleByUserId(new Map())
      setBlocksByUserId(new Map())
      setSessionsByUserId(new Map())
      setBidTitleById(new Map())
      setHubJobsForPicker([])
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [workDate, role, showToast, ledgerPrefixMap])

  const saveQuickfillBlockModal = useCallback(async () => {
    if (!blockModalState || !authUser?.id) return
    setAddSaving(true)
    setAddError(null)
    const res = await saveNewScheduleBlockForPersonDay({
      authUserId: authUser.id,
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
    closeQuickfillAddBlock()
    void loadData({ quiet: true })
  }, [
    addBlockDraftByBlockId,
    addNote,
    addTimeEnd,
    addTimeStart,
    authUser?.id,
    blockModalState,
    closeQuickfillAddBlock,
    loadData,
    showToast,
  ])

  const handleScheduleMarkNotComingIn = useCallback(async () => {
    const editor = scheduleMyTimeEditor
    if (!editor) return
    const result = await recordNotComingInForUserAsStaff({
      subjectUserId: editor.subjectUserId,
      workDateYmd: workDate,
    })
    if (result.ok && result.alreadyMarked) {
      showToast(`${editor.subjectDisplayName} already has unpaid time off on ${workDate}.`, 'warning')
      return
    }
    if (!result.ok) {
      showToast(result.message, 'error')
      return
    }
    showToast(`Marked ${editor.subjectDisplayName} as not coming in (${workDate}).`, 'success')
    if (result.syncWarning) {
      showToast(`Salary sync: ${result.syncWarning}`, 'warning')
    }
    void loadData({ quiet: true })
  }, [scheduleMyTimeEditor, workDate, showToast, loadData])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const scheduleBlocksFilters = useMemo(
    () => [
      { event: '*' as const, schema: 'public', table: 'job_schedule_blocks', filter: `work_date=eq.${workDate}` },
    ],
    [workDate],
  )
  useRealtimeChannel(
    true,
    `quickfill-schedule-blocks-${workDate}`,
    scheduleBlocksFilters,
    () => {
      void loadData({ quiet: true })
    },
    { debounceMs: 400 },
  )

  return (
    <div>
      {!hideConflictPrompt ? (
        <div role="note" style={QUICKFILL_SECTION_BANNER_BOX_STYLE}>
          {SCHEDULE_CONFLICTS_DEFAULT_PROMPT}
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by person or job…"
          aria-label="Search by person or job"
          style={{
            flex: '1 1 200px',
            minWidth: 0,
            padding: '0.4rem 0.5rem',
            fontSize: '0.875rem',
            border: '1px solid #d1d5db',
            borderRadius: 4,
          }}
        />
        {searchQuery.trim() !== '' ? (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            style={{
              padding: '0.4rem 0.6rem',
              fontSize: '0.8125rem',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              background: '#fff',
              cursor: 'pointer',
              color: '#374151',
            }}
          >
            Clear
          </button>
        ) : null}
        <button
          type="button"
          onClick={toggleHideAssistantsEstimators}
          aria-pressed={hideAssistantsEstimators}
          aria-label={
            hideAssistantsEstimators
              ? 'Show assistants and estimators in the list'
              : 'Hide assistants and estimators from the list'
          }
          style={{
            padding: '0.4rem 0.6rem',
            fontSize: '0.8125rem',
            border: hideAssistantsEstimators ? '1px solid #2563eb' : '1px solid #d1d5db',
            borderRadius: 4,
            background: hideAssistantsEstimators ? '#eff6ff' : '#fff',
            color: hideAssistantsEstimators ? '#1d4ed8' : '#374151',
            cursor: 'pointer',
            fontWeight: hideAssistantsEstimators ? 600 : 400,
          }}
        >
          Hide assistants and estimators
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
          fontSize: '0.875rem',
        }}
      >
        <span style={{ color: '#374151', fontWeight: 600 }}>{dayLabel}</span>
        <button
          type="button"
          onClick={() => setWorkDate((d) => ymdAddDays(d, -1))}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.8125rem',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Previous day
        </button>
        <button
          type="button"
          onClick={() => setWorkDate((d) => ymdAddDays(d, 1))}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.8125rem',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Next day
        </button>
        <Link
          to={scheduleDispatchHref}
          aria-label="Open Schedule Dispatch for the week of this day"
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.8125rem',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            background: '#fff',
            color: '#374151',
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Dispatch
        </Link>
        {workDate !== denverCalendarDayKey(Date.now()) ? (
          <button
            type="button"
            onClick={() => setWorkDate(denverCalendarDayKey(Date.now()))}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.8125rem',
              border: '1px solid #2563eb',
              borderRadius: 4,
              background: '#eff6ff',
              color: '#1d4ed8',
              cursor: 'pointer',
            }}
          >
            Today
          </button>
        ) : null}
      </div>
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>
      ) : sortedUsers.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No users in the Schedule Dispatch roster.</p>
      ) : rosterFilteredUsers.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          No one to show with assistants and estimators hidden. Turn off “Hide assistants and estimators” to see them.
        </p>
      ) : filteredSortedUsers.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No people match this search.</p>
      ) : (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: QUICKFILL_SCHEDULE_ROW_GAP,
              marginBottom: '0.15rem',
            }}
          >
            <div style={{ width: QUICKFILL_SCHEDULE_NAME_COL_WIDTH, flexShrink: 0 }} aria-hidden />
            <div
              aria-hidden
              style={{
                position: 'relative',
                flex: 1,
                minWidth: 0,
                height: 12,
                pointerEvents: 'none',
              }}
            >
              {DISPATCH_ADD_BLOCK_ORIENTATION_MARKS.filter(
                (m) => m.slotIndex <= DISPATCH_ADD_BLOCK_SLOT_COUNT - 1,
              ).map(({ slotIndex, label }) => (
                <span
                  key={slotIndex}
                  style={{
                    position: 'absolute',
                    left: dispatchAddBlockTrackThumbLeftPct(slotIndex, DISPATCH_ADD_BLOCK_SLOT_COUNT),
                    transform: 'translateX(-50%)',
                    fontSize: '0.65rem',
                    color: '#9ca3af',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
            {canEditSchedule ? (
              <div style={{ width: QUICKFILL_SCHEDULE_ADD_COL_WIDTH, flexShrink: 0 }} aria-hidden />
            ) : null}
          </div>
          {scheduleUsersByRoleSection.map((roleSection, sectionIndex) => {
            const headingId = `quickfill-schedule-role-${roleSection.sectionKey}`
            return (
              <section
                key={roleSection.sectionKey}
                aria-labelledby={headingId}
                style={{ marginTop: sectionIndex > 0 ? '1.25rem' : 0 }}
              >
                <h2
                  id={headingId}
                  style={{
                    margin: '0 0 0.5rem 0',
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: '#111827',
                    textAlign: 'center',
                  }}
                >
                  {roleSection.label}
                </h2>
                <div>
                  {roleSection.rows.map(({ id, name }) => {
                    const rows = blocksByUserId.get(id) ?? []
                    const segments = blocksToSegments(rows, jobTitleById)
                    const secondary = scheduleSecondaryByUserId.get(id)
                    return (
                      <QuickfillScheduleUserRow
                        key={id}
                        userId={id}
                        displayName={name}
                        scheduleDayYmd={workDate}
                        segments={segments}
                        secondaryBands={secondary}
                        onScheduleAddClick={
                          canEditSchedule
                            ? () => {
                                setCellAddContext({ assigneeUserId: id, workDate })
                                setAssignJobPickerSearch('')
                                setAssignJobPickerOpen(true)
                              }
                            : undefined
                        }
                        onOpenMyTimeForSessionStrip={
                          showStripSubjectMyTimeEditor ? openMyTimeForSessionStrip : undefined
                        }
                        onOpenPersonMyTime={
                          showStripSubjectMyTimeEditor ? openMyTimeForSessionStrip : undefined
                        }
                        onOccupiedBandClick={openOccupiedBandOnScheduleDispatch}
                      />
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
      <ScheduleDispatchAssignJobPickerModal
        open={assignJobPickerOpen}
        onClose={closeQuickfillJobPicker}
        subtitle={quickfillAssignJobPickerSubtitle}
        jobRows={quickfillAssignJobPickerRows}
        searchValue={assignJobPickerSearch}
        onSearchChange={setAssignJobPickerSearch}
        onPickJob={(jobId) => {
          if (!cellAddContext) return
          openQuickfillAddBlock({
            assigneeUserId: cellAddContext.assigneeUserId,
            workDate: cellAddContext.workDate,
            jobId,
          })
        }}
      />
      <ScheduleDispatchAddBlockModal
        open={blockModalState != null}
        mode="add"
        jobTitle={blockModalJobTitle}
        personLabel={blockModalPersonLabel}
        workDate={blockModalState?.workDate ?? ''}
        timeStart={addTimeStart}
        timeEnd={addTimeEnd}
        note={addNote}
        saving={addSaving}
        error={addError}
        onClose={closeQuickfillAddBlock}
        onChangeStart={setAddTimeStart}
        onChangeEnd={setAddTimeEnd}
        onChangeNote={setAddNote}
        onSave={() => void saveQuickfillBlockModal()}
        addTimeline={addBlockModalTimeline}
      />
      {scheduleMyTimeEditor ? (
        <DashboardMyTimeDayEditorModal
          dateStr={workDate}
          sessions={[]}
          subjectUserId={scheduleMyTimeEditor.subjectUserId}
          subjectDisplayName={scheduleMyTimeEditor.subjectDisplayName}
          jobLabels={jobLabelsRecord}
          bidLabels={bidLabelsRecord}
          allowNcnsFromMyTime={showClockStripScopeToggle}
          showMarkNotComingIn={showStripSubjectMyTimeEditor}
          onMarkNotComingIn={
            showStripSubjectMyTimeEditor ? () => void handleScheduleMarkNotComingIn() : undefined
          }
          onClose={() => setScheduleMyTimeEditor(null)}
          onSaved={() => {
            void loadData({ quiet: true })
            setScheduleMyTimeEditor(null)
          }}
          onLinkedSessionsUpdated={() => void loadData({ quiet: true })}
        />
      ) : null}
    </div>
  )
}
