import type { CSSProperties, ReactNode } from 'react'

/**
 * A prototype's two looks on one card (punch list #217): today's look and the shape, one above the
 * other on the same live data, each under a small cap, for a dev who opened the page with `?sbs=1`
 * (`useShapeView`). `ShapeSwitch` is the per-user switch every prototype card carries in its head.
 */

const cap: CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
  margin: '0 0 0.3rem',
}

export function SideBySide({ today, shape, shapeLabel = 'With the strip' }: { today: ReactNode; shape: ReactNode; shapeLabel?: string }) {
  return (
    <div data-testid="side-by-side" style={{ display: 'grid', gap: '0.9rem' }}>
      <section aria-label="Today">
        <div style={cap}>Today</div>
        {today}
      </section>
      <section aria-label={shapeLabel}>
        <div style={cap}>{shapeLabel}</div>
        {shape}
      </section>
    </div>
  )
}

export function ShapeSwitch({ on, onToggle, label, title }: { on: boolean; onToggle: () => void; label: string; title: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={title}
      data-testid="shape-switch"
      style={{
        font: 'inherit',
        fontSize: '0.72rem',
        fontWeight: 600,
        padding: '0.1rem 0.55rem',
        borderRadius: 999,
        cursor: 'pointer',
        border: on ? '1px solid var(--border-blue)' : '1px solid var(--border)',
        background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
        color: on ? 'var(--text-blue-700)' : 'var(--text-muted)',
        marginLeft: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      {on ? '✓ ' : ''}
      {label}
    </button>
  )
}
