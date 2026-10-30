import type { CSSProperties } from 'react'
import type { RhythmStrip, RhythmStripAxis, RhythmStripTone } from '../../lib/quickfill/stationRhythmStrip'

/**
 * The picture of a station's rhythm (punch list #217, office-8): one cell a day, a filled dot
 * on a day with a look, a dashed red line at the day the next look falls due, red past it up to
 * today, today outlined in blue, the days ahead faint. `RhythmStripChip` is the state in two
 * words beside the name; `QuickfillRhythmStripAxis` the shared labels under a list of strips.
 * The words a screen reader hears, and the hover, are the kernel's `words`.
 */

const CHIP_TONE: Record<RhythmStripTone, CSSProperties> = {
  red: { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', borderColor: 'var(--border-red)' },
  amber: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderColor: 'var(--border-amber)' },
  green: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', borderColor: 'var(--bg-green-200)' },
  grey: { background: 'var(--bg-muted)', color: 'var(--text-muted)', borderColor: 'var(--border)' },
}

export function RhythmStripChip({ chip }: { chip: RhythmStrip['chip'] }) {
  return (
    <span
      data-rhythm-chip={chip.tone}
      style={{
        display: 'inline-block',
        padding: '0 0.45rem',
        borderRadius: 999,
        border: '1px solid',
        fontSize: '0.6875rem',
        fontWeight: 600,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
        ...CHIP_TONE[chip.tone],
      }}
    >
      {chip.words}
    </span>
  )
}

function gridStyle(cells: number): CSSProperties {
  return { display: 'grid', gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))`, gap: 2, minWidth: 0 }
}

export function QuickfillStationRhythmStrip({ strip, height = 16 }: { strip: RhythmStrip; height?: number }) {
  const n = strip.cells.length
  return (
    <div role="img" aria-label={strip.words} title={strip.words} data-rhythm-strip style={{ ...gridStyle(n), height }}>
      {strip.cells.map((c, i) => {
        const dueLeft = c.due || (strip.duePlace === 'before' && i === 0)
        const dueRight = strip.duePlace === 'after' && i === n - 1
        const cell: CSSProperties = {
          position: 'relative',
          minWidth: 0,
          borderRadius: 3,
          background: c.late ? 'var(--bg-red-100)' : c.today ? 'var(--bg-blue-tint)' : c.future ? 'transparent' : 'var(--bg-muted)',
          boxShadow: c.today ? 'inset 0 0 0 1px var(--text-link)' : c.future ? 'inset 0 0 0 1px var(--border)' : undefined,
          borderLeft: dueLeft ? '2px dashed var(--text-red-600)' : undefined,
          borderRight: dueRight ? '2px dashed var(--text-red-600)' : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }
        return (
          <span key={c.ymd} data-rhythm-cell={c.looks > 0 ? 'look' : c.late ? 'late' : c.today ? 'today' : 'day'} data-rhythm-due={dueLeft || dueRight ? '1' : undefined} style={cell}>
            {c.looks > 0 ? (
              <span
                aria-hidden="true"
                style={{
                  width: '55%',
                  maxWidth: 9,
                  aspectRatio: '1',
                  borderRadius: '50%',
                  background: c.inRhythm ? 'var(--text-strong)' : 'var(--border-strong)',
                  boxShadow: c.looks > 1 ? '0 0 0 2px var(--surface), 0 0 0 3px var(--border-strong)' : undefined,
                }}
              />
            ) : null}
          </span>
        )
      })}
    </div>
  )
}

const AXIS_LABEL: CSSProperties = { gridRow: 1, fontSize: '0.625rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', lineHeight: 1.3 }

/** The labels under a list of strips: the first day at the left, *today* under its cell, the last day at the right. */
export function QuickfillRhythmStripAxis({ axis }: { axis: RhythmStripAxis }) {
  const t = axis.todayIndex + 1
  return (
    <div aria-hidden="true" data-rhythm-axis style={{ ...gridStyle(axis.cells), marginTop: 2 }}>
      <span style={{ ...AXIS_LABEL, gridColumn: `1 / span ${Math.min(5, t - 3)}` }}>{axis.first}</span>
      <span style={{ ...AXIS_LABEL, gridColumn: `${t - 1} / span 3`, textAlign: 'center', color: 'var(--text-link)', fontWeight: 700 }}>{axis.today}</span>
      <span style={{ ...AXIS_LABEL, gridColumn: `${t + 2} / ${axis.cells + 1}`, textAlign: 'right' }}>{axis.last}</span>
    </div>
  )
}
