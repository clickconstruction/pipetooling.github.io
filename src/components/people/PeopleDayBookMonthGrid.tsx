/**
 * People → Day book, the Month view (to-dos/day-book, PR 3): the rhythm grid.
 *
 * Rows are kinds of work, columns the days of the month, a cell the initials of who did
 * it. A run of empty working days turns amber only when the queue held work — the kernel
 * (`dayBookRhythm.ts`) decides; this file only draws. Tap a cell to open that day.
 */
import type { CSSProperties } from 'react'
import { dayBookDayLabel } from '../../lib/people/dayBook'
import { rhythmRowSentence, type RhythmCell, type RhythmGrid } from '../../lib/people/dayBookRhythm'

type Props = {
  grid: RhythmGrid
  today: string
  onOpenDay: (day: string) => void
}

const CELL: Record<RhythmCell['state'], CSSProperties> = {
  done: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-600)', fontWeight: 600 },
  none: { background: 'var(--surface)', color: 'var(--text-muted)' },
  gap: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-700)', fontWeight: 600 },
  closed: { background: 'var(--bg-subtle)', color: 'var(--text-muted)' },
  today: { background: 'var(--surface)', color: 'var(--text-muted)', outline: '2px solid var(--text-strong)', outlineOffset: -2 },
  future: { background: 'var(--surface)', color: 'transparent' },
}

function cellTitle(cell: RhythmCell, rowLabel: string): string {
  const day = dayBookDayLabel(cell.day)
  if (cell.state === 'closed') return `${day} — nobody clocked in`
  if (cell.state === 'future') return day
  if (cell.who.length === 0) return cell.state === 'gap' ? `${day} — nothing on ${rowLabel} while work was waiting` : `${day} — nothing on ${rowLabel}`
  return `${day} — ${cell.who.map((w) => `${w.name} · ${w.count}`).join(', ')}`
}

export default function PeopleDayBookMonthGrid({ grid, today, onOpenDay }: Props) {
  const dayNum = (ymd: string) => String(Number(ymd.slice(8, 10)))
  const dow = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' })
  const labelCol = 'minmax(92px, 120px)'
  const cols = `${labelCol} repeat(${grid.days.length}, minmax(24px, 1fr))`
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <div style={{ overflowX: 'auto' }}>
        <div role="table" aria-label="Month rhythm" style={{ display: 'grid', gridTemplateColumns: cols, gap: 2, fontSize: '0.7rem', minWidth: 560 }}>
          <div role="columnheader" style={{ ...eyebrow, alignSelf: 'end' }}>
            Kind of work
          </div>
          {grid.days.map((d) => (
            <div key={d} role="columnheader" style={{ textAlign: 'center', color: d === today ? 'var(--text-strong)' : 'var(--text-muted)', fontWeight: d === today ? 700 : 400, lineHeight: 1.1 }}>
              <div style={{ fontSize: '0.6rem' }}>{dow(d)}</div>
              <div style={{ fontVariantNumeric: 'tabular-nums' }}>{dayNum(d)}</div>
            </div>
          ))}
          {grid.rows.map((row) => (
            <RowCells key={row.chip} row={row} onOpenDay={onOpenDay} workingDays={grid.workingDays} />
          ))}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.9rem' }}>
        {grid.legend.map((l) => (
          <span key={l.initials}>
            <b style={{ color: 'var(--text-700)' }}>{l.initials}</b> {l.name}
          </span>
        ))}
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--bg-amber-tint)', border: '1px solid var(--text-amber-700)', verticalAlign: '-1px', marginRight: 4 }} />
          three working days with nothing while work was waiting
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border)', verticalAlign: '-1px', marginRight: 4 }} />
          nobody clocked in
        </span>
      </p>
    </div>
  )
}

function RowCells({ row, onOpenDay, workingDays }: { row: RhythmGrid['rows'][number]; onOpenDay: (day: string) => void; workingDays: number }) {
  return (
    <>
      <div role="rowheader" style={{ alignSelf: 'center', paddingRight: 6, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.78rem' }}>{row.label}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.66rem', lineHeight: 1.2 }}>{rhythmRowSentence(row, workingDays)}</div>
      </div>
      {row.cells.map((c) => {
        const clickable = c.state !== 'future'
        const label = c.who.map((w) => w.initials).join(' ')
        return (
          <button
            key={c.day}
            type="button"
            role="cell"
            disabled={!clickable}
            title={cellTitle(c, row.label)}
            aria-label={cellTitle(c, row.label)}
            data-state={c.state}
            onClick={() => clickable && onOpenDay(c.day)}
            style={{
              font: 'inherit',
              fontSize: '0.66rem',
              lineHeight: 1.1,
              padding: '0.35rem 0.1rem',
              minHeight: 30,
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: clickable ? 'pointer' : 'default',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              ...CELL[c.state],
            }}
          >
            {label || (c.state === 'closed' ? '·' : c.state === 'gap' ? '—' : '')}
          </button>
        )
      })}
    </>
  )
}

const eyebrow: CSSProperties = { fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
