import type { CSSProperties } from 'react'
import { LABOR_VIEWS, type LaborView } from '../../lib/bids/laborView'

/**
 * Old · New on the Labor tab's selected-bid card (the Labor refresh PR 1) —
 * the same per-device pill switch Takeoffs used for its parallel run.
 */
function pillStyle(active: boolean): CSSProperties {
  return {
    padding: '0.3rem 0.7rem',
    fontSize: '0.8125rem',
    border: `1px solid ${active ? '#3b82f6' : 'var(--border-strong)'}`,
    borderRadius: 999,
    background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
    color: active ? 'var(--text-strong)' : 'var(--text-muted)',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
  }
}

export function LaborViewPills({ view, onChange }: { view: LaborView; onChange: (next: LaborView) => void }) {
  return (
    <span role="tablist" aria-label="Labor view" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
      {LABOR_VIEWS.map((v) => (
        <button key={v.id} type="button" role="tab" aria-selected={view === v.id} title={v.title} onClick={() => onChange(v.id)} style={pillStyle(view === v.id)}>
          {v.label}
        </button>
      ))}
    </span>
  )
}
