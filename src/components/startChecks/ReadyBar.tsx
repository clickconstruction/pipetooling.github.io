/**
 * Before we start (punch list #382): the ready bar. Small check boxes in a row, one a bullet, with a line under the
 * whole row: green under what is ready, amber under what is open, red under an open one once the stage itself is
 * red, and red under a No. A percent follows. Every bullet is one equal step, and the percent reads 100 only when
 * every bullet has a yes (`readiness`). `light` pins the open box to white for the GC's page, which stays light.
 */
import type { ReadyMark } from '../../lib/startChecks/startChecks'

const GREEN = '#16a34a'
const RED = '#dc2626'
const AMBER = '#f59e0b'

export function ReadyBar({ marks, urgent = false, light = false }: { marks: readonly ReadyMark[]; urgent?: boolean; light?: boolean }) {
  return (
    <span aria-hidden data-ready-bar style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
      {marks.map((m, i) => {
        const line = m === 'yes' ? GREEN : m === 'no' || urgent ? RED : AMBER
        const fill = m === 'yes' ? GREEN : m === 'no' ? RED : light ? '#fff' : 'var(--surface)'
        const edge = m === 'yes' ? GREEN : m === 'no' ? RED : 'var(--text-muted)'
        return (
          <span key={i} data-ready-mark={m} style={{ display: 'inline-grid', justifyItems: 'center', padding: '0 2px' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, display: 'inline-grid', placeItems: 'center', fontSize: 9, fontWeight: 800, lineHeight: 1, color: '#fff', background: fill, borderWidth: 1.5, borderStyle: 'solid', borderColor: edge }}>
              {m === 'yes' ? '✓' : m === 'no' ? '✕' : ''}
            </span>
            <span data-ready-line={line === GREEN ? 'green' : line === RED ? 'red' : 'amber'} style={{ display: 'block', height: 4, background: line, justifySelf: 'stretch', margin: '3px -2px 0', borderRadius: i === 0 ? '2px 0 0 2px' : i === marks.length - 1 ? '0 2px 2px 0' : 0 }} />
          </span>
        )
      })}
    </span>
  )
}

/** The bar with its percent: 83% ready. Green at 100. */
export function ReadyPercent({ marks, pct, urgent = false }: { marks: readonly ReadyMark[]; pct: number; urgent?: boolean }) {
  if (!marks.length) return null
  const yes = marks.filter((m) => m === 'yes').length
  return (
    <span role="img" aria-label={`${pct}% ready, ${yes} of ${marks.length}`} data-ready-percent={pct} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
      <ReadyBar marks={marks} urgent={urgent} />
      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: pct === 100 ? 'var(--text-green-700)' : 'var(--text-strong)' }}>{pct}%</span>
      <span style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>ready</span>
    </span>
  )
}
