import type { CSSProperties } from 'react'
import { MIN_BAR_PCT, type YourRecordWeekStrip as YourRecordWeekStripModel } from '../../lib/yourRecordWeekStrip'

/**
 * A Your record item's pay week drawn under its title (punch list #217, field-8; a prototype behind
 * the card's *Week strip* switch). Seven columns, Sunday to Saturday: a bar on each day the person
 * clocked on the job, its height the day's share of the week's longest day and its hours under it;
 * today's open session a hatched bar with its hours so far in the hover; a dot over any day a field
 * report from them landed on the job; today's column tinted and its letter in colour. The whole
 * strip reads as one sentence to a screen reader and on hover. The shape is the Legal Timeline's
 * strip of days over `yourRecordWeekStrip.ts`.
 */

const BAR_H = 26
const DOT_ROW_H = 8
const LABEL_ROW_H = 12
const LETTER_ROW_H = 12

const COLOUR = 'var(--timeline-job-4)'
const HATCH = `repeating-linear-gradient(45deg, ${COLOUR} 0 3px, var(--surface) 3px 6px)`

export function YourRecordWeekStrip({ strip }: { strip: YourRecordWeekStripModel }) {
  return (
    <div
      role="img"
      aria-label={strip.words}
      title={strip.words}
      data-testid="your-record-week-strip"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3, margin: '0.35rem 0 0.1rem', maxWidth: 360 }}
    >
      {strip.days.map((d) => {
        const bar: CSSProperties | null =
          d.barPct > 0 || d.open
            ? {
                position: 'absolute',
                left: '18%',
                right: '18%',
                bottom: 0,
                height: `${Math.max(d.barPct, d.open ? MIN_BAR_PCT : 0)}%`,
                borderRadius: '2px 2px 0 0',
                background: d.open ? HATCH : COLOUR,
                boxSizing: 'border-box',
                border: d.open ? `1px solid ${COLOUR}` : undefined,
                borderBottom: 'none',
              }
            : null
        return (
          <div
            key={d.ymd}
            title={d.words}
            data-testid="your-record-week-day"
            data-ymd={d.ymd}
            data-worked={d.hours > 0 ? 'true' : undefined}
            data-open={d.open ? 'true' : undefined}
            data-report={d.report ? 'true' : undefined}
            data-today={d.today ? 'true' : undefined}
            style={{ background: d.today ? 'var(--bg-blue-tint)' : 'transparent', borderRadius: 3, padding: '2px 0 1px', minWidth: 0 }}
          >
            <div style={{ height: DOT_ROW_H, display: 'flex', justifyContent: 'center', alignItems: 'center' }} aria-hidden>
              {d.report ? <span style={{ width: 6, height: 6, borderRadius: 6, background: 'var(--text-link)' }} /> : null}
            </div>
            <div style={{ position: 'relative', height: BAR_H, borderBottom: '1px solid var(--border)' }} aria-hidden>
              {bar ? <div style={bar} /> : null}
            </div>
            <div
              aria-hidden
              style={{
                height: LABEL_ROW_H,
                lineHeight: `${LABEL_ROW_H}px`,
                fontSize: '0.625rem',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--text-strong)',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {d.label}
            </div>
            <div
              aria-hidden
              style={{
                height: LETTER_ROW_H,
                lineHeight: `${LETTER_ROW_H}px`,
                fontSize: '0.625rem',
                fontWeight: d.today ? 700 : 400,
                color: d.today ? 'var(--text-link)' : 'var(--text-faint)',
                textAlign: 'center',
              }}
            >
              {d.short.charAt(0)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
