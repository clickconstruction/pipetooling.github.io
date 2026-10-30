import type { CSSProperties } from 'react'
import { APP_CALENDAR_TZ, referenceDateForWorkDateYmd } from '../../utils/dateUtils'
import { shiftWorkDateYmd } from '../../lib/peopleHoursClockStripSelectedDay'
import { earlierPendingStubWords, formatStripHours } from '../../lib/people/hoursDayStrip'

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

/**
 * The strip shape (punch list #217, people-docs-15): an amber ring on each day with a session
 * waiting and its hours under it instead of the count, and a stub at the left edge, *7 earlier ›*,
 * for the sessions in weeks the strip does not show.
 */
export type MiniCalendarStrip = {
  pendingHoursByWorkDate: Readonly<Record<string, number>>
  earlier: { count: number | null; onOpen?: () => void }
}

type Props = {
  miniCalendarYmds: readonly string[]
  todayDenver: string
  selectedYmd: string
  onSelectYmd: (ymd: string) => void
  pendingUnapprovedCountByWorkDate: Readonly<Record<string, number>>
  countsLoading: boolean
  narrowViewport640: boolean
  strip?: MiniCalendarStrip | null
}

export function PeopleHoursClockStripMiniCalendar({
  miniCalendarYmds,
  todayDenver,
  selectedYmd,
  onSelectYmd,
  pendingUnapprovedCountByWorkDate,
  countsLoading,
  narrowViewport640,
  strip = null,
}: Props) {
  const stubWords = strip ? earlierPendingStubWords(strip.earlier.count) : ''
  const stubCell: CSSProperties = { flexShrink: 0, minWidth: stubWords ? '4.25rem' : 0, display: 'flex', alignItems: 'center' }
  return (
    <div
      data-mini-calendar={strip ? 'strip' : 'today'}
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
        {stubWords ? (
          <span style={stubCell}>
            <button
              type="button"
              onClick={strip?.earlier.onOpen}
              disabled={!strip?.earlier.onOpen}
              title="Sessions waiting on approval in weeks before these days. Opens the all-weeks approvals queue."
              data-earlier-stub
              style={{
                padding: '0.2rem 0.5rem',
                borderRadius: 999,
                border: '1px solid var(--border-amber)',
                background: 'var(--bg-amber-tint)',
                color: 'var(--text-amber-800)',
                font: 'inherit',
                fontSize: '0.72rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: strip?.earlier.onOpen ? 'pointer' : 'default',
              }}
            >
              {stubWords}
            </button>
          </span>
        ) : null}
        {miniCalendarYmds.map((ymd) => {
          const isToday = ymd === todayDenver
          const isSelected = ymd === selectedYmd
          const isWeekend = isWeekendWallYmd(ymd)
          const { mdLine, weekdayLine, ariaFull } = miniCalendarCellLabels(ymd)
          const mutedWeekendWeekday = isWeekend && !isToday && !isSelected
          const n = pendingUnapprovedCountByWorkDate[ymd] ?? 0
          const pendingHours = strip ? (strip.pendingHoursByWorkDate[ymd] ?? 0) : 0
          const ring = strip != null && pendingHours > 0
          const countPhrase = strip
            ? ring
              ? `${formatStripHours(pendingHours)} h waiting on approval`
              : 'Nothing waiting on approval'
            : n === 1
              ? `${n} unapproved session`
              : `${n} unapproved sessions`
          const style = miniDayPickerButtonStyle(isToday, isSelected, isWeekend)
          return (
            <button
              key={ymd}
              type="button"
              data-pending-ring={ring ? '1' : undefined}
              style={ring ? { ...style, boxShadow: [style.boxShadow, '0 0 0 2px var(--text-amber-700)'].filter(Boolean).join(', ') } : style}
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
        aria-label={strip ? 'Hours waiting on approval per day for strip scope' : 'Unapproved session counts per day for strip scope'}
      >
        {stubWords ? <span aria-hidden="true" style={stubCell} /> : null}
        {miniCalendarYmds.map((ymd) => {
          const n = pendingUnapprovedCountByWorkDate[ymd] ?? 0
          const pendingHours = strip ? (strip.pendingHoursByWorkDate[ymd] ?? 0) : 0
          const words = strip ? (pendingHours > 0 ? `${formatStripHours(pendingHours)} h` : '') : String(n)
          const hot = strip ? pendingHours > 0 : n > 0
          return (
            <div
              key={`unapproved-count-${ymd}`}
              style={{
                flexShrink: 0,
                minWidth: '3rem',
                textAlign: 'center',
                fontSize: '0.72rem',
                fontWeight: countsLoading ? 500 : hot ? 700 : 600,
                color: countsLoading ? 'var(--text-muted)' : hot ? 'var(--text-amber-700)' : 'var(--text-700)',
                lineHeight: 1.2,
                fontFamily: 'inherit',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {countsLoading ? '…' : words}
            </div>
          )
        })}
      </div>
    </div>
  )
}
