import type { CSSProperties } from 'react'
import { APP_CALENDAR_TZ, referenceDateForWorkDateYmd } from '../../utils/dateUtils'
import { shiftWorkDateYmd } from '../../lib/peopleHoursClockStripSelectedDay'

export function buildPeopleHoursClockStripMiniCalendarYmds(todayDenverYmd: string): string[] {
  const cols: string[] = []
  for (let i = -10; i <= 0; i += 1) {
    cols.push(shiftWorkDateYmd(todayDenverYmd, i))
  }
  return cols
}

/** Min/max of the 11 visible pills; used as `pendingWorkDateRange` for strip counts. */
export function pendingWorkDateRangeFromMiniCalendarYmds(
  miniCalendarYmds: string[],
  todayDenverYmd: string,
): { start: string; end: string } {
  const start = miniCalendarYmds[0]
  const end = miniCalendarYmds[miniCalendarYmds.length - 1]
  if (!start || !end) return { start: todayDenverYmd, end: todayDenverYmd }
  return start <= end ? { start, end } : { start: end, end: start }
}

function miniCalendarCellLabels(ymd: string): { mdLine: string; weekdayLine: string; ariaFull: string } {
  const d = referenceDateForWorkDateYmd(ymd)
  const mdLine = d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
  const weekdayLine = d.toLocaleDateString('en-US', { weekday: 'short' })
  const ariaFull = d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  return { mdLine, weekdayLine, ariaFull }
}

function isWeekendWallYmd(ymd: string): boolean {
  const d = referenceDateForWorkDateYmd(ymd)
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    weekday: 'short',
  }).format(d)
  const norm = short.trim().slice(0, 3).toUpperCase()
  return norm.startsWith('SAT') || norm.startsWith('SUN')
}

function miniDayPickerButtonStyle(isToday: boolean, isSelected: boolean, isWeekend: boolean): CSSProperties {
  const base: CSSProperties = {
    flexShrink: 0,
    minWidth: '3rem',
    padding: '0.35rem 0.45rem',
    borderRadius: 6,
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    cursor: 'pointer',
    fontSize: '0.72rem',
    lineHeight: 1.22,
    textAlign: 'center',
    fontFamily: 'inherit',
    color: 'var(--text-strong)',
  }

  // Theme tokens, not pastels: light-mode literals here were unreadable against
  // dark-mode text tokens (light-on-light chips).
  const neutralWeekend: CSSProperties =
    !isWeekend
      ? {}
      : {
          borderColor: 'var(--border)',
          background: 'var(--bg-muted)',
        }

  if (isToday && isSelected) {
    return {
      ...base,
      border: '2px solid #1d4ed8',
      background: 'var(--bg-blue-200)',
      fontWeight: 700,
      boxShadow: 'inset 0 0 0 1px #93c5fd',
    }
  }
  if (isToday) {
    return {
      ...base,
      borderColor: '#93c5fd',
      background: 'var(--bg-blue-tint)',
    }
  }
  if (isSelected) {
    return {
      ...base,
      border: '2px solid #2563eb',
      background: 'var(--bg-blue-200)',
      fontWeight: 600,
    }
  }
  return {
    ...base,
    ...neutralWeekend,
  }
}

type Props = {
  miniCalendarYmds: readonly string[]
  todayDenver: string
  selectedYmd: string
  onSelectYmd: (ymd: string) => void
  pendingUnapprovedCountByWorkDate: Readonly<Record<string, number>>
  countsLoading: boolean
  narrowViewport640: boolean
}

export function PeopleHoursClockStripMiniCalendar({
  miniCalendarYmds,
  todayDenver,
  selectedYmd,
  onSelectYmd,
  pendingUnapprovedCountByWorkDate,
  countsLoading,
  narrowViewport640,
}: Props) {
  return (
    <div
      style={{
        marginBottom: '0.65rem',
        overflowX: narrowViewport640 ? 'auto' : 'visible',
        WebkitOverflowScrolling: narrowViewport640 ? 'touch' : undefined,
        paddingBottom: narrowViewport640 ? '2px' : undefined,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          gap: '0.35rem',
          justifyContent: narrowViewport640 ? 'flex-start' : 'center',
          alignItems: 'stretch',
        }}
        role="group"
        aria-label="Jump to day in last 11 days"
      >
        {miniCalendarYmds.map((ymd) => {
          const isToday = ymd === todayDenver
          const isSelected = ymd === selectedYmd
          const isWeekend = isWeekendWallYmd(ymd)
          const { mdLine, weekdayLine, ariaFull } = miniCalendarCellLabels(ymd)
          const mutedWeekendWeekday = isWeekend && !isToday && !isSelected
          const n = pendingUnapprovedCountByWorkDate[ymd] ?? 0
          const countPhrase = n === 1 ? `${n} unapproved session` : `${n} unapproved sessions`
          return (
            <button
              key={ymd}
              type="button"
              style={miniDayPickerButtonStyle(isToday, isSelected, isWeekend)}
              aria-label={
                countsLoading ? `Select ${ariaFull}. Loading counts.` : `Select ${ariaFull}. ${countPhrase}.`
              }
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => onSelectYmd(ymd)}
            >
              <div style={{ fontWeight: isSelected ? 600 : isToday ? 600 : 500 }}>{mdLine}</div>
              <div style={{ color: mutedWeekendWeekday ? 'var(--text-muted)' : 'var(--text-600)', fontWeight: 500 }}>{weekdayLine}</div>
            </button>
          )
        })}
      </div>
      <div
        role="group"
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          gap: '0.35rem',
          justifyContent: narrowViewport640 ? 'flex-start' : 'center',
          alignItems: 'center',
          marginTop: '0.28rem',
        }}
        aria-label="Unapproved session counts per day for strip scope"
      >
        {miniCalendarYmds.map((ymd) => {
          const n = pendingUnapprovedCountByWorkDate[ymd] ?? 0
          return (
            <div
              key={`unapproved-count-${ymd}`}
              style={{
                flexShrink: 0,
                minWidth: '3rem',
                textAlign: 'center',
                fontSize: '0.72rem',
                fontWeight: countsLoading ? 500 : n > 0 ? 700 : 600,
                color: countsLoading ? 'var(--text-muted)' : n > 0 ? 'var(--text-amber-700)' : 'var(--text-700)',
                lineHeight: 1.2,
                fontFamily: 'inherit',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {countsLoading ? '…' : String(n)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
