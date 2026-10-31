import type { FigureProps } from './figureProps'
import { Breaker, Conductor } from './electricalParts'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The subpanel (punch list #120, v2.5620): one two-pole breaker in the main panel feeds a second box; in that box
 * the neutral bar floats clear of the case and the ground bar bolts to it, so the two never join there. The feed
 * breaker in the main panel is the subpanel's real off. Lesson 3.
 */
export function Subpanel({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 140" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <rect x="10" y="16" width="80" height="108" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={50} y={30} anchor="middle" size={7} bold color="currentColor">
        main panel
      </Label>
      <line x1="46" y1="40" x2="46" y2="110" stroke="currentColor" strokeWidth="2.6" />
      <line x1="54" y1="40" x2="54" y2="110" stroke="currentColor" strokeWidth="2.6" />
      <Conductor d="M24 48 V100" wire="neutral" />
      <Conductor d="M76 48 V100" wire="ground" />
      <Conductor d="M24 100 V108 H76 V100" wire="ground" />
      <Label x={50} y={120} anchor="middle" size={6.5}>
        joined here, once
      </Label>
      <Conductor d="M54 58 H62 M78 58 H118 V50 H192" />
      <Conductor d="M54 72 H62 M78 72 H112 V62 H192" />
      <Breaker x={70} y={58} />
      <Breaker x={70} y={72} />
      <line x1="70" y1="58" x2="70" y2="72" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1" />
      <Conductor d="M24 86 H118 V74 H192" wire="neutral" />
      <Conductor d="M76 96 H124 V86 H192" wire="ground" />
      <Label x={140} y={42} anchor="middle" size={6.5} bold color="currentColor">
        one breaker feeds it
      </Label>
      <Label x={104} y={53} anchor="middle" size={7}>
        60 A
      </Label>
      <Label x={140} y={104} anchor="middle" size={6.5}>
        its real off
      </Label>
      <rect x="192" y="16" width="100" height="108" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={242} y={30} anchor="middle" size={7} bold color="currentColor">
        subpanel
      </Label>
      <line x1="238" y1="40" x2="238" y2="110" stroke="currentColor" strokeWidth="2.6" />
      <line x1="250" y1="40" x2="250" y2="110" stroke="currentColor" strokeWidth="2.6" />
      <rect x="203" y="44" width="14" height="60" rx="2" fill="none" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="2 2" />
      <Conductor d="M210 48 V100" wire="neutral" />
      <Conductor d="M280 48 V100" wire="ground" />
      <g fill="currentColor">
        <circle cx="280" cy="52" r="2.2" />
        <circle cx="280" cy="96" r="2.2" />
      </g>
      <Label x={216} y={116} anchor="middle" size={6.5}>
        neutral floats
      </Label>
      <Label x={290} y={116} anchor="end" size={6.5}>
        ground on box
      </Label>
      <Label x={242} y={134} anchor="middle" size={6.5} bold color="currentColor">
        they do not join here
      </Label>
    </svg>
  )
}
