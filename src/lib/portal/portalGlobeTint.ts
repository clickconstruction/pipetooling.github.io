/**
 * The globe's colour is its state (journey-map B18 / J21-F3): an active,
 * shared portal used to be pixel-identical to a never-minted one — 411
 * identical globes, 6 real portals. This is the ONE state→tint map; both
 * the customer globe and the sub globe render from it, so a colour means
 * the same thing next to a customer and next to a sub.
 */
import type { PortalGlobeInitialState } from './portalLinkState'

export type PortalGlobeTone = 'unknown' | 'unminted' | 'active' | 'off'

export type PortalGlobeTint = {
  tone: PortalGlobeTone
  /** CSS colour for the icon (`currentColor`) — theme tokens; red stays literal-by-token. */
  color: string
  /** One short trade-language phrase for the button's tooltip. */
  hint: string
}

const TINTS: Record<PortalGlobeTone, PortalGlobeTint> = {
  // Rows not loaded yet: today's neutral grey, so nothing flashes a wrong state.
  unknown: { tone: 'unknown', color: 'var(--text-muted)', hint: '' },
  // Never shared: the quiet outline everyone had before — "nothing here yet".
  unminted: { tone: 'unminted', color: 'var(--text-faint)', hint: 'no portal link yet' },
  // Live link (merged, or a legacy scoped link still running): the link blue.
  active: { tone: 'active', color: 'var(--text-link)', hint: 'portal is live' },
  // Deliberately turned off: red, as before.
  off: { tone: 'off', color: 'var(--text-red-600)', hint: 'portal is turned off' },
}

export function portalGlobeTone(state: PortalGlobeInitialState | null | undefined): PortalGlobeTone {
  switch (state) {
    case 'active':
    case 'legacy-active':
      return 'active'
    case 'off':
      return 'off'
    case 'unminted':
      return 'unminted'
    default:
      return 'unknown'
  }
}

/** `null`/`undefined` = the list-level rows have not loaded yet. */
export function portalGlobeTint(state: PortalGlobeInitialState | null | undefined): PortalGlobeTint {
  return TINTS[portalGlobeTone(state)]
}

/** Tooltip for the globe button: "<name>'s portal — portal is live". */
export function portalGlobeTitle(name: string, state: PortalGlobeInitialState | null | undefined): string {
  const { hint } = portalGlobeTint(state)
  const base = `${name}'s portal`
  return hint ? `${base} — ${hint}` : base
}
