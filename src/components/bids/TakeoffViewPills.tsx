import type { CSSProperties } from 'react'
import { TAKEOFF_VIEWS, type TakeoffView } from '../../lib/bids/takeoffView'

/** The bordered pill look the Counts / Pricing / Cover Letter Old/New pills used (v2.2385 idiom). */
function pillStyle(on: boolean): CSSProperties {
  return {
    padding: '0.2rem 0.6rem',
    borderRadius: 999,
    border: on ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
    background: on ? '#3b82f6' : 'var(--surface)',
    color: on ? '#fff' : 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}

/**
 * Old / New 1 / New 2 pills beside the bid title on Takeoffs (v2.2768).
 * Presentational: the tab owns the state and the per-device persistence.
 */
export function TakeoffViewPills({ view, onChange }: { view: TakeoffView; onChange: (next: TakeoffView) => void }) {
  return (
    <span role="tablist" aria-label="Takeoffs view" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
      {TAKEOFF_VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={view === v.id}
          title={v.title}
          onClick={() => onChange(v.id)}
          style={pillStyle(view === v.id)}
        >
          {v.label}
        </button>
      ))}
    </span>
  )
}

/**
 * Stand-in body for a view that is not built yet (the train's PR 0/1 ships
 * the pills first so the switch, the persistence, and Old's untouched body
 * can be verified on their own). Replaced by the real view in its own PR.
 */
export function TakeoffNewViewPlaceholder({ view, onBackToOld }: { view: Exclude<TakeoffView, 'old'>; onBackToOld: () => void }) {
  const meta = TAKEOFF_VIEWS.find((v) => v.id === view)
  return (
    <div
      style={{
        border: '1px dashed var(--border-strong)',
        borderRadius: 8,
        padding: '2rem 1.5rem',
        background: 'var(--bg-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontSize: '1rem', fontWeight: 700 }}>{meta?.label} is on its way</span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{meta?.title}. Until it lands, Old has everything.</span>
      <button
        type="button"
        onClick={onBackToOld}
        style={{ marginTop: '0.5rem', padding: '0.45rem 0.9rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
      >
        Back to Old
      </button>
    </div>
  )
}
