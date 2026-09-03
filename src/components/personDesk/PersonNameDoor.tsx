import type { CSSProperties, ReactNode } from 'react'
import { useOptionalPersonDesk } from '../../contexts/PersonDeskContext'

/**
 * The name is the door (PR 4). Renders a person's name as a Person Desk
 * opener when the viewer can open the Desk and the provider is mounted;
 * otherwise the `fallback` (or a plain span). Pass whichever key the surface
 * has — an account id, a roster id, or just the pay name (resolved by the
 * Desk on open).
 */
export function PersonNameDoor({
  name,
  userId,
  personId,
  payName,
  style,
  fallback,
  stopPropagation = true,
  children,
}: {
  name: string
  userId?: string | null
  personId?: string | null
  payName?: string | null
  style?: CSSProperties
  /** Rendered instead of the plain span when the door is unavailable (e.g. the clock strip's User Review button). */
  fallback?: ReactNode
  stopPropagation?: boolean
  children?: ReactNode
}) {
  const desk = useOptionalPersonDesk()
  const trimmed = name.trim()
  const canOpen = desk != null && desk.canOpen && (Boolean(userId) || Boolean(personId) || Boolean(payName?.trim() || trimmed))
  if (!canOpen) {
    if (fallback !== undefined) return <>{fallback}</>
    return <span style={style}>{children ?? trimmed}</span>
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation()
        desk.open({ userId: userId ?? null, personId: personId ?? null, payName: payName ?? (userId || personId ? null : trimmed), displayName: trimmed })
      }}
      title={`Open ${trimmed}'s desk`}
      style={{
        border: 'none',
        background: 'none',
        padding: 0,
        cursor: 'pointer',
        color: 'inherit',
        font: 'inherit',
        textAlign: 'inherit',
        textDecoration: 'underline dotted',
        textUnderlineOffset: 3,
        ...style,
      }}
    >
      {children ?? trimmed}
    </button>
  )
}
