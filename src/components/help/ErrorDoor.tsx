/**
 * The door on an error line (punch list #187, PR 6): *What this means* after the reason, and the card it
 * opens in place, so the error, the window and anything half typed stay on the screen. The card is the
 * same `LegendCard` a desk's ? opens, with the family's three rows and its guide in a new tab. Two pieces,
 * because the line is often a `<p>` and a card cannot sit inside one. Words: `lib/help/errorGuides.ts`.
 */
import type { CSSProperties } from 'react'
import { useOptionalAuth } from '../../hooks/useAuth'
import { ERROR_DOOR_OPENED_CONTROL, ERROR_DOOR_WORDS, errorDoor, errorGuideHref, type ErrorFamily } from '../../lib/help/errorGuides'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { LegendCard } from './LegendCard'

const link: CSSProperties = { border: 0, background: 'none', padding: 0, color: 'var(--text-link)', font: 'inherit', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }

export function ErrorDoorButton({ family, open, onToggle, style }: { family: ErrorFamily; open: boolean; onToggle: (open: boolean) => void; style?: CSSProperties }) {
  const auth = useOptionalAuth()
  return (
    <button
      type="button"
      aria-expanded={open}
      title={ERROR_DOOR_WORDS.tip}
      data-testid="error-door-button"
      onClick={() => {
        if (!open) recordNavClick(auth?.user?.id, auth?.role ?? null, ERROR_DOOR_OPENED_CONTROL, `#${family}`)
        onToggle(!open)
      }}
      style={{ ...link, ...style }}
    >
      {ERROR_DOOR_WORDS.open}
    </button>
  )
}

export function ErrorDoorCard({ family, onClose, style }: { family: ErrorFamily; onClose: () => void; style?: CSSProperties }) {
  const door = errorDoor(family)
  return <LegendCard rows={door.rows} label={ERROR_DOOR_WORDS.label} onClose={onClose} guide={{ href: errorGuideHref(door), title: door.guide.title }} testId="error-door" style={style} />
}
