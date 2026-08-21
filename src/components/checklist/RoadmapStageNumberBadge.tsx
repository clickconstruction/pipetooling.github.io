import type { CSSProperties } from 'react'

/**
 * The roadmap stage-number badge (v2.1940) — identical chip on Map cluster
 * corners and Plan rows so "stage 4" means the same thing in both views.
 * Neutral slate on purpose: numbers are wayfinding, not status, so they must
 * not read as done/unlocked/locked (`--text-slate-600` flips per theme:
 * dark chip + light text in light mode, light chip + dark text in dark mode).
 */
export function RoadmapStageNumberBadge({ n, corner }: { n: number; corner?: boolean }) {
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
    height: 22,
    padding: '0 5px',
    borderRadius: 999,
    background: 'var(--text-slate-600)',
    color: 'var(--surface)',
    fontSize: '0.75rem',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    flex: 'none',
    boxSizing: 'border-box',
    ...(corner
      ? { position: 'absolute', top: -10, left: -10, zIndex: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }
      : null),
  }
  return <span style={style}>{n}</span>
}
