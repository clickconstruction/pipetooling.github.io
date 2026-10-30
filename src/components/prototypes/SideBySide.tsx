import type { CSSProperties, ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { SIDE_BY_SIDE_PARAM, shapeViewAsked } from '../../lib/prototypes/shapeView'

/**
 * A prototype beside today's look, for the owner to compare live (punch list #217, *Show it,
 * don't say it*). Dev only: when the page's URL carries `?sbs=1` (every prototype on the page)
 * or `?sbs=<key>` (one of them) and the signed-in person is a dev, the surface draws today's
 * look and the shape one above the other, on the same live rows, each under its own caption.
 * Anyone else, and any URL without `sbs`, sees the page as it is. The per-user switch a
 * prototype ships behind is a different thing: that one changes the page for the person who
 * turned it on, this one only compares. The URL rule is `lib/prototypes/shapeView.ts`.
 */

/** True when a dev opened the page with `?sbs=1` or `?sbs=<key>`: draw today's look and the shape side by side. */
// eslint-disable-next-line react-refresh/only-export-components -- the hook lives beside the frame it gates, one import for every #217 prototype
export function useShapeView(key: string): boolean {
  const { role } = useAuth()
  const [params] = useSearchParams()
  return role === 'dev' && shapeViewAsked(params.get(SIDE_BY_SIDE_PARAM), key)
}

const caption: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  margin: '0 0 0.25rem',
}

export type SideBySideProps = {
  /** The caption over today's look; *Today* unless the surface says otherwise. */
  todayLabel?: string
  /** The caption over the shape: *With the strip*, *As a calendar*, … */
  shapeLabel: string
  today: ReactNode
  shape: ReactNode
}

/** Today's look over the shape, each under its caption, in one bordered frame. */
export function SideBySide({ todayLabel = 'Today', shapeLabel, today, shape }: SideBySideProps) {
  return (
    <div
      data-testid="prototype-side-by-side"
      style={{
        border: '1px dashed var(--border-strong)',
        borderRadius: 12,
        padding: '0.6rem 0.6rem 0.2rem',
        marginBottom: '0.9rem',
        background: 'var(--bg-subtle)',
      }}
    >
      <div data-side="today">
        <p style={{ ...caption, color: 'var(--text-muted)' }}>{todayLabel}</p>
        {today}
      </div>
      <div data-side="shape">
        <p style={{ ...caption, color: 'var(--text-blue-700)' }}>{shapeLabel}</p>
        {shape}
      </div>
    </div>
  )
}
