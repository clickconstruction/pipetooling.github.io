import { useMemo, useState, type CSSProperties } from 'react'
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
import { UserDaySummaryModal } from './UserDaySummaryModal'

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
  /** Called when the user clicks a Scheduled-blocks row inside the per-day
      Summary modal. Wired to the parent section's existing
      `openBlockPreviewForDay(dayYmd, blockId)` so the block preview modal
      reuses the same singleton state managed in Week/Month sections. */
  onOpenBlockPreviewForBlock?: (blockId: string) => void
  narrow: boolean
  /** Shared trim window forwarded into the strip's grey rail. The User
      Review Day / Week / Month sections compute this from every row in
      view so band x-coordinates stay aligned across rails. `null` hides
      the rail; `undefined` leaves the strip's default (full track). */
  railTrimWindow?: { loSlotIndex: number; hiSlotIndex: number } | null
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
  onOpenBlockPreviewForBlock,
  narrow,
  railTrimWindow,
}: UserScheduleDayRowProps) {
  const [summaryOpen, setSummaryOpen] = useState(false)

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
        <button
          type="button"
          onClick={() => setSummaryOpen(true)}
          title={`Open day summary for ${displayName} (${dayYmd})`}
          aria-label={`Open day summary for ${displayName} on ${dayYmd}`}
          style={{
            display: 'block',
            width: '100%',
            margin: 0,
            marginBottom: '0.1rem',
            padding: 0,
            border: 'none',
            background: 'none',
            font: 'inherit',
            fontSize: '0.8125rem',
            color: '#374151',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontWeight: 600, color: '#111827' }}>{narrowDateHeader}</span>
          {subline}
        </button>
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
        onNameColumnClick={() => setSummaryOpen(true)}
        onOccupiedBandClick={onOccupiedBandClick}
        railTrimWindow={railTrimWindow}
      />
      <UserDaySummaryModal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        dayYmd={dayYmd}
        blocks={blocks}
        sessions={sessions}
        jobTitleById={jobTitleById}
        bidTitleById={bidTitleById}
        nowMs={nowMs}
        showOpenMyTime={showOpenMyTime}
        onSelectBlock={(b) => {
          setSummaryOpen(false)
          onOpenBlockPreviewForBlock?.(b.id)
        }}
        onSelectSession={() => {
          setSummaryOpen(false)
          onOpenMyTimeForSessionStrip(userId, displayName, dayYmd)
        }}
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
