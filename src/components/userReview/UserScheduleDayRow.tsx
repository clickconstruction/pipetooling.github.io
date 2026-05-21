import { useMemo, type CSSProperties } from 'react'
import {
  clockSessionsToDispatchSecondaryBands,
  type ClockSessionForDispatchBand,
} from '../../lib/clockSessionsToDispatchSecondaryBands'
import { blocksToSegments } from '../../lib/quickfillScheduleSegments'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { type DispatchOccupiedBand } from '../schedule/DispatchAddBlockTimeRange'
import { QuickfillScheduleUserRow } from '../schedule/QuickfillScheduleUserRow'
import { formatRelativeDayPhrase } from '../../lib/relativeDayPhrase'
import {
  APP_CALENDAR_TZ,
  denverCalendarDayKey,
  formatDenverWeekday,
  referenceDateForWorkDateYmd,
} from '../../utils/dateUtils'

const relativeDaySublineStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  color: '#9ca3af',
  fontWeight: 400,
  marginTop: '0.05rem',
}

export function formatDateMdYDisplay(workDateYmd: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(referenceDateForWorkDateYmd(workDateYmd))
}

export type UserScheduleDayRowProps = {
  userId: string
  displayName: string
  dayYmd: string
  blocks: JobScheduleBlockRow[]
  sessions: ClockSessionForDispatchBand[]
  jobTitleById: ReadonlyMap<string, string>
  bidTitleById: ReadonlyMap<string, string>
  nowMs: number
  showOpenMyTime: boolean
  /** Called with the row's own dayYmd so callers (Week/Month) can open My Time keyed to the clicked day. */
  onOpenMyTimeForSessionStrip: (uid: string, name: string, dayYmd: string) => void
  onOccupiedBandClick: (band: DispatchOccupiedBand) => void
  narrow: boolean
}

export function UserScheduleDayRow({
  userId,
  displayName,
  dayYmd,
  blocks,
  sessions,
  jobTitleById,
  bidTitleById,
  nowMs,
  showOpenMyTime,
  onOpenMyTimeForSessionStrip,
  onOccupiedBandClick,
  narrow,
}: UserScheduleDayRowProps) {
  const segments = useMemo(
    () => blocksToSegments(blocks, new Map(jobTitleById)),
    [blocks, jobTitleById],
  )
  const secondaryBands = useMemo(
    () =>
      clockSessionsToDispatchSecondaryBands(
        sessions,
        dayYmd,
        nowMs,
        new Map(jobTitleById),
        new Map(bidTitleById),
      ),
    [sessions, dayYmd, nowMs, jobTitleById, bidTitleById],
  )

  const dayLabel = formatDenverWeekday(referenceDateForWorkDateYmd(dayYmd).getTime())
  const dayMd = formatDateMdYDisplay(dayYmd)
  const dayShort = dayLabel.slice(0, 3)
  const dayMdShort = dayMd.slice(0, 5)
  const compactDay = `${dayShort} · ${dayMdShort}`
  const narrowDateHeader = narrow ? `${dayShort} ${dayMdShort}` : null
  const relativePhrase = formatRelativeDayPhrase(dayYmd, denverCalendarDayKey(Date.now()))
  const subline = relativePhrase ? (
    <span style={relativeDaySublineStyle}>({relativePhrase})</span>
  ) : null

  return (
    <div>
      {narrowDateHeader ? (
        <div
          style={{
            fontSize: '0.8125rem',
            color: '#374151',
            marginBottom: '0.1rem',
          }}
        >
          <span style={{ fontWeight: 600, color: '#111827' }}>{narrowDateHeader}</span>
          {subline}
        </div>
      ) : null}
      <QuickfillScheduleUserRow
        userId={userId}
        displayName={displayName}
        scheduleDayYmd={dayYmd}
        segments={segments}
        secondaryBands={secondaryBands}
        showNameColumn={!narrow}
        nameColumnLabel={compactDay}
        nameColumnSubline={subline}
        compactRow
        onOpenMyTimeForSessionStrip={
          showOpenMyTime
            ? (uid, name) => onOpenMyTimeForSessionStrip(uid, name, dayYmd)
            : undefined
        }
        onOpenPersonMyTime={
          showOpenMyTime
            ? (uid, name) => onOpenMyTimeForSessionStrip(uid, name, dayYmd)
            : undefined
        }
        onOccupiedBandClick={onOccupiedBandClick}
      />
    </div>
  )
}

export function UserScheduleEmptyDayRow({ dayYmd }: { dayYmd: string }) {
  const dayLabel = formatDenverWeekday(referenceDateForWorkDateYmd(dayYmd).getTime())
  const dayMd = formatDateMdYDisplay(dayYmd)
  const dayShort = dayLabel.slice(0, 3)
  const dayMdShort = dayMd.slice(0, 5)
  return (
    <div style={{ padding: '0.15rem 0', fontSize: '0.8125rem', color: '#9ca3af' }}>
      <span style={{ fontWeight: 500, color: '#6b7280' }}>
        {dayShort} · {dayMdShort}
      </span>
      <span style={{ marginLeft: '0.5rem' }}>— No activity</span>
    </div>
  )
}
