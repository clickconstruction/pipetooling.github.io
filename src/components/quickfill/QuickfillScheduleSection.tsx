import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { fetchScheduleBlocksForAssigneesOnDay, type JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import {
  fetchJobsLedgerForScheduleDispatchHub,
  fetchUserNamesForIds,
  fetchUsersTabRosterForScheduleDispatchHub,
  formatScheduleDispatchHubJobTitle,
} from '../../lib/scheduleDispatchHub'
import {
  defaultNewBlockRangeInFirstGap,
  type AddBlockTimelineSegment,
} from '../../lib/scheduleDispatchAddBlockTimeline'
import {
  DISPATCH_ADD_BLOCK_SLOT_COUNT,
  dispatchMinutesToHHmm,
  dispatchMinutesToSlotIndex,
  dispatchSlotIndexToMinutes,
  formatDispatchQuickTimeLabel,
  timeInputToMinutesSafe,
  timeInputToPg,
} from '../../lib/dispatchAddBlockTime'
import { scheduleTimeToMinutesFromMidnight } from '../../lib/jobScheduleOverlap'
import {
  DISPATCH_ADD_BLOCK_ORIENTATION_MARKS,
  DispatchAddBlockTimeRange,
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

const QUICKFILL_SCHEDULE_HIDE_ASSISTANT_ESTIMATOR_KEY = 'quickfill_schedule_hide_assistant_estimator'

/** Matches per-row name column so shared 8 AM / 12 PM / 4 PM labels align with each timeline. */
const QUICKFILL_SCHEDULE_NAME_COL_WIDTH = 'clamp(5.5rem, 24vw, 8.5rem)'
const QUICKFILL_SCHEDULE_ROW_GAP = '0.5rem'

function readHideAssistantsEstimatorsFromStorage(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(QUICKFILL_SCHEDULE_HIDE_ASSISTANT_ESTIMATOR_KEY) === '1'
  } catch {
    return false
  }
}

function blocksToSegments(rows: JobScheduleBlockRow[], jobTitleById: Map<string, string>): AddBlockTimelineSegment[] {
  return [...rows]
    .map((b) => ({
      blockId: b.id,
      jobId: b.job_id,
      label: jobTitleById.get(b.job_id) ?? formatScheduleDispatchHubJobTitle(null, null),
      time_start: b.time_start,
      time_end: b.time_end,
      shared_block_group_id: b.shared_block_group_id,
    }))
    .sort(
      (a, b) =>
        scheduleTimeToMinutesFromMidnight(timeInputToPg(a.time_start.slice(0, 5))) -
        scheduleTimeToMinutesFromMidnight(timeInputToPg(b.time_start.slice(0, 5))),
    )
}

function segmentsToOccupiedBands(segments: AddBlockTimelineSegment[]): DispatchOccupiedBand[] {
  return segments.map((s) => {
    const ts = s.time_start.slice(0, 5)
    const te = s.time_end.slice(0, 5)
    const sm = timeInputToMinutesSafe(ts)
    const em = timeInputToMinutesSafe(te)
    return {
      blockId: s.blockId,
      jobId: s.jobId,
      label: s.label,
      startSlotIndex: dispatchMinutesToSlotIndex(sm),
      endSlotIndex: dispatchMinutesToSlotIndex(em),
    }
  })
}

const noopSlot = () => {}

const QuickfillScheduleUserRow = memo(function QuickfillScheduleUserRow({
  userId,
  displayName,
  segments,
  secondaryBands,
  onOpenMyTimeForSessionStrip,
  onOccupiedBandClick,
}: {
  userId: string
  displayName: string
  segments: AddBlockTimelineSegment[]
  secondaryBands?: DispatchSecondaryBand[]
  onOpenMyTimeForSessionStrip?: (uid: string, name: string) => void
  onOccupiedBandClick?: (band: DispatchOccupiedBand) => void
}) {
  const occupiedBands = useMemo(() => segmentsToOccupiedBands(segments), [segments])

  const { startSlotIndex, endSlotIndex } = useMemo(() => {
    const def = defaultNewBlockRangeInFirstGap({ segments, draftByBlockId: {} })
    if (def) {
      return {
        startSlotIndex: dispatchMinutesToSlotIndex(def.startMin),
        endSlotIndex: dispatchMinutesToSlotIndex(def.endMin),
      }
    }
    return {
      startSlotIndex: dispatchMinutesToSlotIndex(timeInputToMinutesSafe('08:00')),
      endSlotIndex: dispatchMinutesToSlotIndex(timeInputToMinutesSafe('12:00')),
    }
  }, [segments])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: QUICKFILL_SCHEDULE_ROW_GAP,
        padding: '0.45rem 0',
        borderBottom: '1px solid #f3f4f6',
      }}
    >
      <div
        title={displayName}
        style={{
          width: QUICKFILL_SCHEDULE_NAME_COL_WIDTH,
          flexShrink: 0,
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: '#374151',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.2,
        }}
      >
        {displayName}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <DispatchAddBlockTimeRange
          compact
          showOrientationLabels={false}
          showProposedRange={false}
          slotCount={DISPATCH_ADD_BLOCK_SLOT_COUNT}
          startSlotIndex={startSlotIndex}
          endSlotIndex={endSlotIndex}
          onStartChange={noopSlot}
          onEndChange={noopSlot}
          formatAriaValue={(i) =>
            formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(dispatchSlotIndexToMinutes(i)))
          }
          disabled
          groupAriaLabel={`${displayName}: scheduled blocks preview (read-only), 30-minute steps from 4:00 AM to 8:00 PM Central${
            secondaryBands?.length
              ? ` Includes ${secondaryBands.length} clock session${secondaryBands.length === 1 ? '' : 's'}.`
              : ''
          }`}
          occupiedBands={occupiedBands.length > 0 ? occupiedBands : undefined}
          secondaryBands={secondaryBands}
          onSecondaryBandClick={
            onOpenMyTimeForSessionStrip && (secondaryBands?.length ?? 0) > 0
              ? () => onOpenMyTimeForSessionStrip(userId, displayName)
              : undefined
          }
          onOccupiedBandClick={onOccupiedBandClick}
        />
      </div>
    </div>
  )
})

/**
 * Quickfill overview: one read-only Add-block-style timeline per user (Schedule Dispatch roster) for a chosen day.
 * Edits happen on Schedule Dispatch; metric = count of roster users with no blocks that day.
 */
export function QuickfillScheduleSection() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const showClockStripScopeToggle =
    role === 'dev' || role === 'master_technician' || role === 'assistant'
  const showStripSubjectMyTimeEditor = showClockStripScopeToggle || role === 'superintendent'
  const [scheduleMyTimeEditor, setScheduleMyTimeEditor] = useState<{
    subjectUserId: string
    subjectDisplayName: string
  } | null>(null)
  const [workDate, setWorkDate] = useState(() => denverCalendarDayKey(Date.now()))
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

  const sortedUsers = useMemo(() => {
    const rows = userIds.map((id) => ({ id, name: (nameById.get(id) ?? 'Unknown').trim() || 'Unknown' }))
    rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    return rows
  }, [userIds, nameById])

  const usersWithNoBlocksCount = useMemo(() => {
    if (sortedUsers.length === 0) return 0
    let n = 0
    for (const { id } of sortedUsers) {
      const blocks = blocksByUserId.get(id)
      if (!blocks || blocks.length === 0) n++
    }
    return n
  }, [sortedUsers, blocksByUserId])

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

  useReportQuickfillSectionMetric('schedule', loading ? null : usersWithNoBlocksCount, loading)

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
      navigate(
        `/schedule-dispatch?jobId=${encodeURIComponent(jid)}&week=${encodeURIComponent(weekStart)}&day=${encodeURIComponent(workDate)}`,
      )
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

  const loadData = useCallback(async () => {
    setLoading(true)
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
        return
      }
      const roster = usersRes.data
      const ids = roster.map((r) => r.id)
      setRoleByUserId(new Map(roster.map((r) => [r.id, r.role])))
      const jMap = new Map<string, string>()
      if (!jobsRes.error) {
        for (const j of jobsRes.data) {
          jMap.set(j.id, formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name))
        }
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
                .select('id, bid_number, project_name')
                .in('id', [...bidIds]),
            'quickfill schedule bids for clock sessions',
          )
          for (const br of bidRows ?? []) {
            const b = br as { id: string; bid_number: string | null; project_name: string | null }
            const num = b.bid_number?.trim()
            const pn = (b.project_name ?? '').trim()
            const label = num ? `B${num}${pn ? ` · ${pn}` : ''}` : pn || 'Bid'
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
    } finally {
      setLoading(false)
    }
  }, [workDate, role, showToast])

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
    void loadData()
  }, [scheduleMyTimeEditor, workDate, showToast, loadData])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const channel = supabase
      .channel(`quickfill-schedule-blocks-${workDate}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_schedule_blocks' },
        (payload) => {
          const row = (payload.new as { work_date?: string } | null) ?? (payload.old as { work_date?: string } | null)
          const wd = row?.work_date
          if (wd != null && wd !== workDate) return
          void loadData()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [workDate, loadData])

  return (
    <div>
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
          </div>
          {filteredSortedUsers.map(({ id, name }) => {
            const rows = blocksByUserId.get(id) ?? []
            const segments = blocksToSegments(rows, jobTitleById)
            const secondary = scheduleSecondaryByUserId.get(id)
            return (
              <QuickfillScheduleUserRow
                key={id}
                userId={id}
                displayName={name}
                segments={segments}
                secondaryBands={secondary}
                onOpenMyTimeForSessionStrip={
                  showStripSubjectMyTimeEditor ? openMyTimeForSessionStrip : undefined
                }
                onOccupiedBandClick={openOccupiedBandOnScheduleDispatch}
              />
            )
          })}
        </div>
      )}
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
            void loadData()
            setScheduleMyTimeEditor(null)
          }}
          onLinkedSessionsUpdated={() => void loadData()}
        />
      ) : null}
    </div>
  )
}
