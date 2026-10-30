import type { CSSProperties, ReactNode } from 'react'
import { MUTED } from '../../lib/portal/portalTheme'

/**
 * A prototype beside today's look on a public page (punch list #217, *Show it, don't say it*): the
 * section as the page draws it today above the new shape, each under its caption, **Today** and
 * the shape's own label. The page decides when to draw it (`portalShapeMode`: `?sbs=1` on a sample
 * token or for a signed-in dev); this only lays the two out. The same names as the office pages'
 * `SideBySide` helper, on the portal's paper, since the portals pin light and read no theme token.
 */

const CAPTION: CSSProperties = {
  margin: '0 0 0.3rem',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: MUTED,
}

export function PortalSideBySide({ today, shape, label, testId }: { today: ReactNode; shape: ReactNode; label: string; testId?: string }) {
  return (
    <div data-testid={testId ?? 'portal-side-by-side'} data-side-by-side data-screen-only style={{ display: 'grid', gap: '1.1rem', margin: '0.6rem 0 1rem' }}>
      <div data-side-by-side-today>
        <p style={CAPTION}>Today</p>
        {today}
      </div>
      <div data-side-by-side-shape>
        <p style={CAPTION}>{label}</p>
        {shape}
      </div>
    </div>
  )
}

export default PortalSideBySide
