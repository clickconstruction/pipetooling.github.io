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
 * One at a time / Sheet pills beside the bid title on a Combined bid's Takeoffs (v2.2768; labels v2.2990; Old retired v2.3588).
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
