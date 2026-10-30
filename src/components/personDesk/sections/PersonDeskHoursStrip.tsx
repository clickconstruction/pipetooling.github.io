import type { CSSProperties } from 'react'
import { formatStripHours, hoursStripDayTitle, hoursStripWords, reviewedThroughRule, reviewedThroughWords, shortDayWords, type HoursStripDay } from '../../../lib/people/hoursDayStrip'

/**
 * The person desk's hours as fourteen days (punch list #217, people-docs-6): a filled dot per
 * approved day, an amber ring per day with a session waiting, a hollow dot for the day on the
 * clock, the hours under each day, a grey rule after the last reviewed day with its date on
 * hover, today outlined. The words a screen reader hears are the kernel's sentence.
 */

const DOT: Record<HoursStripDay['kind'], CSSProperties> = {
  approved: { background: 'var(--text-strong)' },
  waiting: { background: 'var(--surface)', boxShadow: 'inset 0 0 0 2px var(--text-amber-700)' },
  open: { background: 'var(--surface)', boxShadow: 'inset 0 0 0 2px var(--text-strong)' },
  none: { background: 'var(--border)', width: 4, height: 4 },
}

const LEGEND_DOT: CSSProperties = { display: 'inline-block', width: 10, height: 10, borderRadius: '50%', verticalAlign: '-1px', marginRight: 5 }

export function PersonDeskHoursStrip({ days, reviewedThrough }: { days: ReadonlyArray<HoursStripDay>; reviewedThrough: string | null }) {
  const rule = reviewedThroughRule(days, reviewedThrough)
  const ruleWords = reviewedThroughWords(reviewedThrough)
  const n = days.length
  const grid: CSSProperties = { display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 0, minWidth: 0 }
  return (
    <div data-person-hours-strip style={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <div role="img" aria-label={hoursStripWords(days, reviewedThrough)} title={hoursStripWords(days, reviewedThrough)} style={grid}>
        {days.map((d, i) => {
          const ruleHere = (rule.kind === 'after' && rule.index === i) || (rule.kind === 'before' && i === 0)
          const col: CSSProperties = {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            padding: '3px 0 2px',
            minWidth: 0,
            borderRight: rule.kind === 'after' && rule.index === i ? '2px solid var(--border-strong)' : undefined,
            borderLeft: rule.kind === 'before' && i === 0 ? '2px solid var(--border-strong)' : undefined,
            borderRadius: d.today ? 5 : undefined,
            boxShadow: d.today ? 'inset 0 0 0 1px var(--text-link)' : undefined,
            background: d.today ? 'var(--bg-blue-tint)' : undefined,
          }
          return (
            <span key={d.ymd} data-hours-day={d.kind} data-hours-rule={ruleHere ? '1' : undefined} title={ruleHere ? `${hoursStripDayTitle(d)} · ${ruleWords}` : hoursStripDayTitle(d)} style={col}>
              <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, ...DOT[d.kind] }} />
              <span
                aria-hidden="true"
                style={{
                  fontSize: '0.6875rem',
                  lineHeight: 1.2,
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: d.waitingHours > 0 ? 700 : 500,
                  color: d.waitingHours > 0 ? 'var(--text-amber-700)' : d.hours > 0 ? 'var(--text-700)' : 'var(--text-faint)',
                  whiteSpace: 'nowrap',
                }}
              >
                {d.open && d.hours === 0 ? 'now' : formatStripHours(d.hours) || '·'}
              </span>
            </span>
          )
        })}
      </div>
      <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>
        <span>{n > 0 ? shortDayWords(days[0]!.ymd) : ''}</span>
        <span style={{ color: 'var(--text-link)', fontWeight: 700 }}>today</span>
      </div>
      <div aria-hidden="true" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.75rem', fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
        <span>
          <i style={{ ...LEGEND_DOT, ...DOT.approved }} />
          approved day
        </span>
        <span>
          <i style={{ ...LEGEND_DOT, ...DOT.waiting }} />
          waiting on approval
        </span>
        <span>
          <i style={{ ...LEGEND_DOT, ...DOT.open }} />
          on the clock
        </span>
        <span>
          <i style={{ display: 'inline-block', width: 2, height: 10, background: 'var(--border-strong)', verticalAlign: '-1px', marginRight: 5 }} />
          {ruleWords}
        </span>
      </div>
    </div>
  )
}
