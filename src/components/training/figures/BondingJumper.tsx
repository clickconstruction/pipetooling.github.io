import type { FigureProps } from './figureProps'
import { Conductor } from './electricalParts'
import { Flow, Label, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The jumper you must not break (punch list #120): the metal water pipe comes in from the street under the earth,
 * through the wall, past the meter and on into the house; the panel's ground wire clamps onto it inside the wall,
 * and a jumper with a clamp at each end carries the ground around the meter, so the meter can come out and the
 * path stays whole. Lesson 8.
 */
export function BondingJumper({ titleId }: FigureProps) {
  const clamp = (x: number) => <rect x={x - 4} y={111} width={8} height={14} rx="1.5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <line x1="0" y1="104" x2="80" y2="104" />
        <line x1="80" y1="18" x2="80" y2="136" strokeWidth="3" />
        <line x1="80" y1="136" x2="300" y2="136" />
      </g>
      <rect x="0" y="104" width="80" height="46" fill="var(--bg-subtle)" stroke="none" />
      <Pipe d="M0 118 H300" />
      <Flow x={40} y={118} />
      <Flow x={230} y={118} />
      <rect x="138" y="106" width="24" height="24" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="150" cy="112" r="4" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <rect x="228" y="24" width="44" height="50" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={250} y={52} anchor="middle" bold color="currentColor" size={8}>
        panel
      </Label>
      <Conductor d="M250 74 V112" wire="ground" />
      {clamp(250)}
      <Conductor d="M124 112 V96 H176 V112" wire="ground" />
      {clamp(124)}
      {clamp(176)}
      <Label x={150} y={90} anchor="middle" bold color="currentColor">
        the jumper
      </Label>
      <Label x={150} y={146} anchor="middle" size={8}>
        meter
      </Label>
      <Label x={244} y={92} anchor="end" size={7.5}>
        ground wire
      </Label>
      <Label x={244} y={101} anchor="end" size={7.5}>
        from the panel
      </Label>
      <Label x={6} y={98} size={7.5}>
        street
      </Label>
      <Label x={6} y={134} size={7.5}>
        under the earth
      </Label>
      <Label x={86} y={28} size={7.5}>
        the wall
      </Label>
      <Label x={296} y={132} anchor="end" size={7.5}>
        metal water pipe
      </Label>
    </svg>
  )
}
