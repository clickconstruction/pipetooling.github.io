import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { fetchScheduleBlocksForAssigneesOnDay, type JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import {
  fetchJobsLedgerForScheduleDispatchHub,
  fetchUserNamesForIds,
  fetchUsersTabUserIdsForScheduleDispatchHub,
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
import { DispatchAddBlockTimeRange, type DispatchOccupiedBand } from '../schedule/DispatchAddBlockTimeRange'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  companyWeekStartSundayContaining,
  denverCalendarDayKey,
  formatDenverCalendarDayWithWeekdayAndYear,
  getDefaultWeekRange,
  referenceDateForWorkDateYmd,
  ymdAddDays,
} from '../../utils/dateUtils'

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
      label: s.label,
      startSlotIndex: dispatchMinutesToSlotIndex(sm),
      endSlotIndex: dispatchMinutesToSlotIndex(em),
    }
  })
}

const noopSlot = () => {}

const QuickfillScheduleUserRow = memo(function QuickfillScheduleUserRow({
  displayName,
  segments,
}: {
  displayName: string
  segments: AddBlockTimelineSegment[]
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
        padding: '0.65rem 0',
        borderBottom: '1px solid #f3f4f6',
      }}
    >
      <div
        style={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: '#374151',
          marginBottom: '0.45rem',
          wordBreak: 'break-word',
        }}
      >
        {displayName}
      </div>
      <DispatchAddBlockTimeRange
        compact
        slotCount={DISPATCH_ADD_BLOCK_SLOT_COUNT}
        startSlotIndex={startSlotIndex}
        endSlotIndex={endSlotIndex}
        onStartChange={noopSlot}
        onEndChange={noopSlot}
        formatAriaValue={(i) =>
          formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(dispatchSlotIndexToMinutes(i)))
        }
        disabled
        groupAriaLabel={`${displayName}: scheduled blocks preview (read-only), 30-minute steps from 4:00 AM to 8:00 PM Central`}
        occupiedBands={occupiedBands.length > 0 ? occupiedBands : undefined}
      />
    </div>
  )
})

/**
 * Quickfill overview: one read-only Add-block-style timeline per user (Schedule Dispatch roster) for a chosen day.
 * Edits happen on Schedule Dispatch; metric = count of roster users with no blocks that day.
 */
export function QuickfillScheduleSection() {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const [workDate, setWorkDate] = useState(() => denverCalendarDayKey(Date.now()))
  const [loading, setLoading] = useState(true)
  const [userIds, setUserIds] = useState<string[]>([])
  const [nameById, setNameById] = useState<Map<string, string>>(() => new Map())
  const [blocksByUserId, setBlocksByUserId] = useState<Map<string, JobScheduleBlockRow[]>>(() => new Map())
  const [jobTitleById, setJobTitleById] = useState<Map<string, string>>(() => new Map())

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

  useReportQuickfillSectionMetric('schedule', loading ? null : usersWithNoBlocksCount, loading)

  const dayLabel = useMemo(() => {
    const ms = referenceDateForWorkDateYmd(workDate).getTime()
    return formatDenverCalendarDayWithWeekdayAndYear(ms)
  }, [workDate])

  const scheduleDispatchHref = useMemo(() => {
    const weekStart = companyWeekStartSundayContaining(workDate) ?? getDefaultWeekRange().start
    return `/schedule-dispatch?week=${encodeURIComponent(weekStart)}`
  }, [workDate])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, jobsRes] = await Promise.all([
        fetchUsersTabUserIdsForScheduleDispatchHub(role === 'dev'),
        fetchJobsLedgerForScheduleDispatchHub(),
      ])
      if (usersRes.error) {
        showToast(usersRes.error, 'error')
        setUserIds([])
        setBlocksByUserId(new Map())
        return
      }
      const ids = usersRes.data
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
        return
      }

      const { data: blockRows, error: blockErr } = await fetchScheduleBlocksForAssigneesOnDay(ids, workDate)
      if (blockErr) {
        showToast(blockErr, 'error')
        setUserIds(ids)
        setBlocksByUserId(new Map())
        return
      }

      const byUser = new Map<string, JobScheduleBlockRow[]>()
      for (const id of ids) {
        byUser.set(id, [])
      }
      for (const b of blockRows) {
        const arr = byUser.get(b.assignee_user_id) ?? []
        arr.push(b)
        byUser.set(b.assignee_user_id, arr)
      }
      for (const [, arr] of byUser) {
        arr.sort((a, c) => a.time_start.localeCompare(c.time_start))
      }
      setUserIds(ids)
      setBlocksByUserId(byUser)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load schedule overview'), 'error')
      setUserIds([])
      setBlocksByUserId(new Map())
    } finally {
      setLoading(false)
    }
  }, [workDate, role, showToast])

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
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.45 }}>
        Read-only preview of each person’s scheduled blocks (same timeline as Add schedule block on Schedule Dispatch).
        Add or edit blocks on{' '}
        <Link to={scheduleDispatchHref} style={{ color: '#2563eb' }}>
          Schedule Dispatch
        </Link>
        .
      </p>
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
      ) : (
        <div>
          {sortedUsers.map(({ id, name }) => {
            const rows = blocksByUserId.get(id) ?? []
            const segments = blocksToSegments(rows, jobTitleById)
            return <QuickfillScheduleUserRow key={id} displayName={name} segments={segments} />
          })}
        </div>
      )}
    </div>
  )
}
