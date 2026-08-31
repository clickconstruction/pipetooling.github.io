import type { PersonDayLateness } from '../../lib/scheduleLateness'

/**
 * The Late chip (v2.2550): a derived, informational amber pill on a Schedule
 * Dispatch person-day cell — "◔ Late 2h 15m". Computed from clock sessions vs
 * the day's earliest scheduled block (src/lib/scheduleLateness.ts); nothing is
 * filed and there is nothing to undo, so it is never interactive. The title
 * carries the receipt: scheduled vs actual, exact minutes, the grace rule.
 * Suppressed by callers whenever the cell shows a time-off/NCNS chip — one
 * status per cell.
 */
export function ScheduleDispatchLateChip({ info }: { info: PersonDayLateness }) {
  return (
    <span
      title={info.title}
      aria-label={info.title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '0.1rem 0.4rem',
        fontSize: '0.6875rem',
        fontWeight: 600,
        borderRadius: 999,
        border: '1px solid var(--border-amber)',
        background: 'var(--bg-amber-100)',
        color: 'var(--text-amber-800)',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}
    >
      <span aria-hidden style={{ fontSize: '0.625rem' }}>◔</span>
      {info.label}
    </span>
  )
}
