import type { CSSProperties, ReactNode } from 'react'
import { useOptionalAuth } from '../../hooks/useAuth'

/**
 * A prototype's side-by-side (v2.6139, punch list #217): the owner asked to see every prototype
 * live beside today's look, on the same data. When the page URL carries `?sbs=1` (or `?sbs=` a
 * comma list of surface keys) and the signed-in person is a dev, a surface that offers a shape
 * draws **Today** and **With the …** one above the other instead of whichever the per-user switch
 * picked. Dev only, URL only: nothing is remembered and nobody else sees it.
 *
 * Written here with the names the #217 group agreed on (`useShapeView(key)`, `SideBySide`); a
 * sibling branch (`claude/217-rhythm-strips…`) writes the same helper, and the two fold into one
 * when both are on main.
 */

export type ShapeView = {
  /** Draw today's look and the shape together, labelled. */
  sideBySide: boolean
}

/** Pure: the flag for one surface from the URL's search and the viewer's role. */
export function sideBySideFor(search: string, role: string | null | undefined, key: string): boolean {
  if (role !== 'dev') return false
  const raw = new URLSearchParams(search).get('sbs')
  if (raw == null) return false
  const v = raw.trim()
  if (v === '' || v === '0') return false
  if (v === '1' || v === 'all') return true
  return v.split(',').map((k) => k.trim()).includes(key)
}

export function useShapeView(key: string): ShapeView {
  const auth = useOptionalAuth()
  const search = typeof window === 'undefined' ? '' : window.location.search
  return { sideBySide: sideBySideFor(search, auth?.role ?? null, key) }
}

const capStyle: CSSProperties = { fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }

/** Today's look over the shape, each under a small caption. */
export function SideBySide({ today, shape, shapeLabel = 'With the shape', testId = 'side-by-side' }: { today: ReactNode; shape: ReactNode; /** "With the track" · "With the strip". */ shapeLabel?: string; testId?: string }) {
  return (
    <div data-testid={testId} style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      <div data-testid={`${testId}-today`} style={{ minWidth: 0 }}>
        <div style={capStyle}>Today</div>
        {today}
      </div>
      <div data-testid={`${testId}-shape`} style={{ minWidth: 0, paddingTop: 8, borderTop: '1px dashed var(--border-strong)' }}>
        <div style={capStyle}>{shapeLabel}</div>
        {shape}
      </div>
    </div>
  )
}
