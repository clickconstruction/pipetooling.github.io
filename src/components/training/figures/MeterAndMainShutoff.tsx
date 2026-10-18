import type { FigureProps } from './figureProps'
import { Flow, Label, Person, Pipe, Valve } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The meter and the main shutoff (punch list #119): the street main runs under the road; the service line tees off
 * through the city's valve and the meter box at the curb, then under the yard into the house, where the main
 * shutoff sits on the riser just inside the wall. Lesson 2.
 */
export function MeterAndMainShutoff({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <line x1="0" y1="100" x2="300" y2="100" />
        <rect x="0" y="92" width="44" height="8" fill="var(--bg-subtle)" />
        <path d="M200 100 V40 H300" />
        <rect x="200" y="40" width="100" height="60" fill="var(--bg-subtle)" />
        <rect x="88" y="100" width="28" height="36" fill="var(--surface)" />
        <rect x="84" y="97" width="36" height="4" fill="var(--surface)" />
      </g>
      <circle cx="20" cy="125" r="9" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="2.2" />
      <Pipe d="M29 125 H88" />
      <Valve x={58} y={125} kind="stop" />
      <Flow x={42} y={125} />
      <circle cx="102" cy="118" r="8" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <line x1="102" y1="118" x2="106" y2="113" stroke="currentColor" strokeWidth="1.5" />
      <Pipe d="M116 125 H215 V85 H262" />
      <Flow x={150} y={125} />
      <Flow x={215} y={105} angle={-90} />
      <Valve x={240} y={85} kind="ball" />
      <Flow x={256} y={85} />
      <Person x={282} y={100} h={40} arm="out" />
      <Label x={6} y={88} size={8}>
        street
      </Label>
      <Label x={20} y={111} anchor="middle" size={8}>
        main
      </Label>
      <Label x={58} y={148} anchor="middle" size={8}>
        the city's valve
      </Label>
      <Label x={102} y={146} anchor="middle" size={8}>
        meter
      </Label>
      <Label x={240} y={51} anchor="middle" size={7.5} bold color="currentColor">
        yours, the main shutoff
      </Label>
      <Label x={250} y={34} anchor="middle" size={8}>
        house
      </Label>
      <Label x={160} y={118} anchor="middle" size={7.5}>
        under the yard
      </Label>
    </svg>
  )
}
