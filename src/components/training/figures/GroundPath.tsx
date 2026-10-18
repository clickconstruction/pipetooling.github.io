import type { FigureProps } from './figureProps'
import { Conductor, Ground } from './electricalParts'
import { Label, Person, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Where the ground goes (punch list #120): the panel's ground wire runs out through the wall to a rod driven 8 ft
 * into the earth, and to a clamp on the metal water pipe within 5 ft of where it comes in; the pipe runs on to
 * the street under the earth. A fault goes to the earth by those paths and not through the person. Lesson 7.
 */
export function GroundPath({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <line x1="0" y1="108" x2="300" y2="108" />
        <line x1="120" y1="14" x2="120" y2="108" strokeWidth="3" />
      </g>
      <rect x="0" y="108" width="300" height="42" fill="var(--bg-subtle)" stroke="none" />
      <Pipe d="M300 96 H120 V120 H0" />
      <rect x="160" y="24" width="50" height="56" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={185} y={56} anchor="middle" bold color="currentColor" size={8}>
        panel
      </Label>
      <Conductor d="M172 80 V96 H150" wire="ground" />
      <rect x="146" y="90" width="8" height="13" rx="1.5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Conductor d="M198 80 V90 H60 V108" wire="ground" />
      <line x1="60" y1="108" x2="60" y2="146" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <Ground x={82} y={132} />
      <Person x={256} y={108} h={40} arm="down" />
      <Label x={60} y={76} anchor="middle" size={7.5} bold color="currentColor">
        the rod, 8 ft
      </Label>
      <Label x={60} y={84} anchor="middle" size={7}>
        outside, in the earth
      </Label>
      <Label x={130} y={86} size={7} bold color="currentColor">
        clamp
      </Label>
      <Label x={126} y={118} size={7}>
        within 5 ft of the wall
      </Label>
      <Label x={296} y={122} anchor="end" size={7}>
        metal water pipe
      </Label>
      <Label x={6} y={134} size={7}>
        to the street
      </Label>
      <Label x={126} y={22} size={7.5}>
        the wall
      </Label>
      <Label x={256} y={30} anchor="middle" size={7}>
        a fault goes to the earth
      </Label>
      <Label x={256} y={39} anchor="middle" size={7}>
        and not through you
      </Label>
    </svg>
  )
}
