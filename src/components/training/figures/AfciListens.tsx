import type { FigureProps } from './figureProps'
import { Breaker, Conductor } from './electricalParts'
import { FAULT } from './electricalTokens'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * AFCI, what it catches (punch list #120): a cable runs through a stud behind the drywall, a screw has gone
 * through it, and an arc jumps the gap inside the wall in the house red; the AFCI breaker at the panel hears the
 * arc and swings open. Lesson 14.
 */
export function AfciListens({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 130" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <rect x="6" y="14" width="56" height="100" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={34} y={28} anchor="middle" size={7}>
        panel
      </Label>
      <Conductor d="M14 60 H26 M42 60 H120" />
      <Breaker x={34} y={60} amps={15} open />
      <Label x={34} y={100} anchor="middle" size={6.5} bold color="currentColor">
        AFCI
      </Label>
      <Label x={34} y={109} anchor="middle" size={6.5}>
        it hears the arc
      </Label>
      <rect x="150" y="20" width="26" height="96" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.5" />
      <line x1="200" y1="14" x2="200" y2="122" stroke="currentColor" strokeWidth="3" />
      <Conductor d="M120 60 H152 M174 60 H290" />
      <rect x="156" y="52" width="14" height="16" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <line x1="216" y1="40" x2="166" y2="58" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M160 64 l5 -3 l-3 5 l6 -2" fill="none" stroke={FAULT} strokeWidth="1.6" strokeLinecap="round" />
      <Label x={163} y={14} anchor="middle" size={7}>
        the stud
      </Label>
      <Label x={206} y={30} size={7}>
        the drywall
      </Label>
      <Label x={222} y={46} size={7}>
        a screw
      </Label>
      <Label x={250} y={78} anchor="middle" size={7} color={FAULT}>
        an arc inside the wall
      </Label>
      <Label x={250} y={88} anchor="middle" size={7}>
        under the breaker's trip
      </Label>
      <Label x={88} y={53} anchor="middle" size={7}>
        the cable
      </Label>
    </svg>
  )
}
