import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { ChartPanelFrame } from '../../lib/bridge/chartPanelFrame'

/**
 * The sources table at the foot of a Bridge chart panel, Money owed and Crew hours: where each number is read from,
 * what can make it wrong, and the door to mend it.
 *
 * At a desk it is the four-column table it always was. On a phone (`frame.stacked`, v2.8279) a source is three
 * lines: its name with its door beside it, then where it is read from, then what can be wrong. The four columns
 * asked for more than a phone's width, and the doors hung past the edge of the page.
 */

const cap: CSSProperties = { fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const ruled: CSSProperties = { borderTop: '1px solid var(--border)', paddingTop: 4 }

export type PanelSourceRow = { input: string; from: string; risk: string; tone: 'amber' | 'green'; door: { to: string; label: string } }

export function BridgePanelSources({ rows, frame, testId }: { rows: ReadonlyArray<PanelSourceRow>; frame: ChartPanelFrame; testId: string }) {
  const wide: CSSProperties = frame.stacked ? { gridColumn: '1 / -1', minWidth: 0 } : ruled
  return (
    <div style={{ display: 'grid', gridTemplateColumns: frame.sources, gap: '0.2rem 0.6rem', fontSize: '0.78rem', alignItems: 'baseline', marginTop: 4 }} data-testid={testId} data-stacked={frame.stacked ? 'true' : 'false'}>
      {!frame.stacked && (
        <>
          <span style={cap}>input</span>
          <span style={cap}>read from</span>
          <span style={cap}>what can be wrong</span>
          <span />
        </>
      )}
      {rows.map((r) => {
        const door = (
          <Link to={r.door.to} style={{ ...ruled, whiteSpace: 'nowrap' }}>
            {r.door.label}
          </Link>
        )
        return (
          <span key={r.input} style={{ display: 'contents' }}>
            <span style={{ ...ruled, fontWeight: 700, minWidth: 0 }}>{r.input}</span>
            {frame.stacked && door}
            <span style={{ ...wide, color: 'var(--text-muted)' }}>{r.from}</span>
            <span style={{ ...wide, color: r.tone === 'green' ? 'var(--text-green-700)' : 'var(--text-amber-800)' }}>{r.risk}</span>
            {!frame.stacked && door}
          </span>
        )
      })}
    </div>
  )
}
