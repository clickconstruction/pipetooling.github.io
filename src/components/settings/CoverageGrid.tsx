import type { CSSProperties } from 'react'
import type { CoverageGrid as CoverageGridShape, CoveragePanel, CoverageRow } from '../../lib/messages/coverageGrid'

/**
 * Punch list #217, office-11: the Office hours card's coverage line drawn, above the line that stays as its caption.
 * One panel per day that differs, each with one row per office person and their Push me hours as a bar on a
 * midnight-to-midnight axis; the stretch no row covers is a red hatched column through every row with its times on
 * the top edge; the hour marks sit under the axis; a gap of a day or more is a chip. A press on a row's name opens
 * that person's Push me hours, by what the app allows: your own on Your account, another's desk for the rest.
 */

const DAY = 24 * 60
const pct = (m: number): string => `${(100 * m) / DAY}%`

const rowGrid: CSSProperties = { display: 'grid', gridTemplateColumns: '4.2rem minmax(0, 1fr)', gap: '0.4rem', alignItems: 'center' }
const nameStyle: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', padding: 0, border: 'none', background: 'none' }
const hatch: CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  background: 'repeating-linear-gradient(135deg, var(--bg-red-200) 0 4px, transparent 4px 8px)',
  borderLeft: '1px solid var(--text-red-700)',
  borderRight: '1px solid var(--text-red-700)',
  boxSizing: 'border-box',
}

function GapColumns({ panel }: { panel: CoveragePanel }) {
  return (
    <>
      {panel.gaps.map((g) => (
        <span key={g.start} data-coverage-gap={g.words} aria-hidden style={{ ...hatch, left: pct(g.start), width: pct(g.end - g.start) }} />
      ))}
    </>
  )
}

function Row({ row, panel, onOpen }: { row: CoverageRow; panel: CoveragePanel; onOpen: (to: string) => void }) {
  const label = row.door ? (
    <button type="button" onClick={() => onOpen(row.door!.to)} title={row.door.words} aria-label={row.door.words} style={{ ...nameStyle, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--border-strong)' }}>
      {row.mine ? 'You' : row.short}
    </button>
  ) : (
    <span style={nameStyle}>{row.short}</span>
  )
  const bar = row.bar
  const wide = bar ? bar.end - bar.start >= 5 * 60 : false
  return (
    <div data-coverage-row={row.name} style={rowGrid}>
      {label}
      <div style={{ position: 'relative', height: 22 }}>
        <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 10, height: 2, background: 'var(--border-strong)' }} />
        <GapColumns panel={panel} />
        {bar ? (
          <span
            data-coverage-bar
            title={bar.words}
            aria-label={`${row.short}: ${bar.words}`}
            style={{
              position: 'absolute',
              top: 2,
              height: 18,
              left: pct(bar.start),
              width: pct(bar.end - bar.start),
              borderRadius: 4,
              background: 'var(--text-link)',
              color: 'var(--surface)',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              padding: '0 0.35rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            {wide ? bar.words : ''}
          </span>
        ) : (
          <span data-coverage-off style={{ position: 'absolute', left: 4, top: 2, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Off
          </span>
        )}
      </div>
    </div>
  )
}

function Panel({ panel, ticks, onOpen }: { panel: CoveragePanel; ticks: CoverageGridShape['ticks']; onOpen: (to: string) => void }) {
  return (
    <div data-coverage-panel={panel.label} style={{ display: 'grid', gap: 3 }}>
      <div style={rowGrid}>
        <span />
        <div style={{ position: 'relative', height: 14, fontSize: '0.66rem', color: 'var(--text-red-700)', fontWeight: 600 }}>
          {panel.gaps.map((g) => {
            const atStart = g.start <= 0
            const atEnd = g.end >= DAY
            const left = atStart ? '0' : atEnd ? '100%' : pct((g.start + g.end) / 2)
            const transform = atStart ? 'none' : atEnd ? 'translateX(-100%)' : 'translateX(-50%)'
            return (
              <span key={g.start} style={{ position: 'absolute', left, transform, whiteSpace: 'nowrap' }}>
                nobody {g.words}
              </span>
            )
          })}
        </div>
      </div>
      {panel.rows.map((r) => (
        <Row key={r.name} row={r} panel={panel} onOpen={onOpen} />
      ))}
      <div style={rowGrid}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{panel.label}</span>
        <div aria-hidden style={{ position: 'relative', height: 14, fontSize: '0.66rem', color: 'var(--text-muted)' }}>
          {ticks.map((t, i) => {
            const first = t.at <= 0
            const last = t.at >= DAY
            return (
              <span key={i} style={{ position: 'absolute', left: first ? '0' : last ? '100%' : pct(t.at), transform: first ? 'none' : last ? 'translateX(-100%)' : 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                {t.words}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function CoverageGrid({ grid, onOpen }: { grid: CoverageGridShape; onOpen: (to: string) => void }) {
  return (
    <div data-coverage-grid role="group" aria-label="Who hears a reply, by the hour" style={{ display: 'grid', gap: '0.6rem', padding: '0.5rem 0 0.1rem' }}>
      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-base)' }}>Who hears a reply</p>
      {grid.panels.map((p) => (
        <Panel key={p.label} panel={p} ticks={grid.ticks} onOpen={onOpen} />
      ))}
      {grid.long.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {grid.long.map((words) => (
            <span key={words} data-coverage-long style={{ display: 'inline-block', borderRadius: 999, padding: '0.1rem 0.55rem', fontSize: '0.74rem', border: '1px solid var(--text-red-700)', background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }}>
              Nobody {words}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
