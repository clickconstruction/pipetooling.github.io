import type { CSSProperties, ReactNode } from 'react'
import { useMemo } from 'react'
import { getScheduleDispatchWeekNavParts, ymdAddDays } from '../../utils/dateUtils'

const btnNeutral: CSSProperties = {
  padding: '0.4rem 0.75rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--surface)',
  cursor: 'pointer',
}

const btnPrimary: CSSProperties = {
  ...btnNeutral,
  border: '1px solid #2563eb',
  color: 'var(--text-link)',
}

type ScheduleDispatchWeekNavProps = {
  weekStart: string
  onWeekShift: (deltaWeeks: number) => void
  onThisWeek: () => void
  /** When set (e.g. Mon–Fri only), replaces the default Sun–Sat range line. */
  dateRangeOverride?: string
  hideWeekend?: boolean
  onHideWeekendChange?: (hide: boolean) => void
  /** Right-aligned content (e.g. a Share button) shown across from "This week". */
  rightSlot?: ReactNode
}

export function ScheduleDispatchWeekNav({
  weekStart,
  onWeekShift,
  onThisWeek,
  dateRangeOverride,
  hideWeekend = true,
  onHideWeekendChange,
  rightSlot,
}: ScheduleDispatchWeekNavProps) {
  const weekEnd = useMemo(() => ymdAddDays(weekStart, 6), [weekStart])
  const { weekTitle, dateRange } = useMemo(
    () => getScheduleDispatchWeekNavParts(weekStart, weekEnd),
    [weekStart, weekEnd],
  )
  const displayDateRange = dateRangeOverride ?? dateRange

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.35rem',
        marginBottom: '0.75rem',
      }}
    >
      <button type="button" onClick={() => onWeekShift(-1)} style={btnNeutral} aria-label="Previous week">
        ←
      </button>
      <span
        aria-live="polite"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: 'var(--text-700)',
          padding: '0 0.25rem',
          lineHeight: 1.25,
        }}
      >
        {weekTitle !== null ? (
          <>
            <span style={{ fontWeight: 600 }}>{weekTitle}</span>
            <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{displayDateRange}</span>
          </>
        ) : (
          <span style={{ fontWeight: 600 }}>{displayDateRange}</span>
        )}
      </span>
      <button type="button" onClick={() => onWeekShift(1)} style={btnNeutral} aria-label="Next week">
        →
      </button>
      <button type="button" onClick={onThisWeek} style={btnPrimary}>
        This week
      </button>
      {onHideWeekendChange ? (
        <label
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-700)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            marginLeft: 2,
          }}
        >
          <input
            type="checkbox"
            checked={hideWeekend}
            onChange={(e) => onHideWeekendChange(e.target.checked)}
            aria-label="Hide Saturday and Sunday columns"
          />
          Hide weekend
        </label>
      ) : null}
      {rightSlot ? <div style={{ marginLeft: 'auto' }}>{rightSlot}</div> : null}
    </div>
  )
}
