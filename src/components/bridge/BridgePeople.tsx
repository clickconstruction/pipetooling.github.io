import type { CSSProperties, ReactNode } from 'react'

/** The People strip (v2.5222): Vectors and Vectors by the day under one strip, closed by default, with the pay week in one line while closed. */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const panel: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem' }
const btn: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.2rem 0.6rem', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }

export function BridgePeople(props: { summary: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div style={{ ...panel, marginTop: '0.6rem' }} data-testid="bridge-people">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={label}>People — who moved the number</span>
        <span style={det} data-testid="bridge-people-summary">
          {props.summary}
        </span>
        <button type="button" onClick={props.onToggle} style={{ ...btn, marginLeft: 'auto' }} aria-expanded={props.open}>
          {props.open ? 'Hide the rows' : 'Show the rows and the days'}
        </button>
      </div>
      {props.open ? <div data-testid="bridge-people-open">{props.children}</div> : null}
    </div>
  )
}
