import type { FigureProps } from './figureProps'
import { Box } from './hvacParts'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The way to an attic unit, seen from above (Intro to HVAC, lesson 25): the opening, the walkway of solid floor
 * from it to the unit, the level work space at the unit's service side, the light switched at the opening and the
 * outlet at the unit, each with the size the code gives it.
 */
export function AtticWay({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 168" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <rect x="6" y="30" width="288" height="96" rx="4" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.2" strokeDasharray="5 3" />
      <rect x="20" y="62" width="34" height="32" fill="var(--surface)" stroke="currentColor" strokeWidth="1.8" />
      <line x1="20" y1="62" x2="54" y2="94" stroke="currentColor" strokeWidth="1" />
      <rect x="54" y="68" width="136" height="20" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.3" />
      <rect x="190" y="56" width="44" height="44" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" strokeDasharray="3 2" />
      <Box x={234} y={52} w={48} h={52} />
      <circle cx="37" cy="46" r="5" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.3" />
      <rect x="10" y="74" width="7" height="10" rx="1.5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <rect x="254" y="108" width="10" height="10" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <line x1="257" y1="111" x2="257" y2="115" stroke="currentColor" strokeWidth="1" />
      <line x1="261" y1="111" x2="261" y2="115" stroke="currentColor" strokeWidth="1" />
      <Label x={150} y={16} anchor="middle" size={7.5}>
        the attic, seen from above
      </Label>
      <Label x={258} y={82} anchor="middle" bold color="currentColor" size={8}>
        the unit
      </Label>
      <Label x={122} y={81} anchor="middle" bold color="currentColor" size={7.5}>
        walkway, 24 in wide
      </Label>
      <Label x={122} y={102} anchor="middle" size={7}>
        solid floor, 20 ft at the most
      </Label>
      <Label x={212} y={76} anchor="middle" size={6.5}>
        30 in
      </Label>
      <Label x={212} y={85} anchor="middle" size={6.5}>
        by 30 in
      </Label>
      <Label x={212} y={116} anchor="middle" size={6.5}>
        level work space
      </Label>
      <Label x={46} y={48} size={6.5}>
        light
      </Label>
      <Label x={37} y={108} anchor="middle" size={6.5}>
        the opening
      </Label>
      <Label x={37} y={117} anchor="middle" size={6.5}>
        20 in by 30 in
      </Label>
      <Label x={8} y={142} size={7}>
        the light's switch is at the opening
      </Label>
      <Label x={292} y={142} anchor="end" size={7}>
        an outlet is at the unit
      </Label>
      <Label x={150} y={158} anchor="middle" bold color="currentColor" size={7.5}>
        step only on the walkway or the framing
      </Label>
    </svg>
  )
}
