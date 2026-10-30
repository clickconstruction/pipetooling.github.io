import type { FigureProps } from './figureProps'
import { Flow, Hatch, Label, Pipe, Seal, Sink } from './plumbingParts'
import { DRAIN, SVG_STYLE } from './plumbingTokens'

/**
 * Two systems, one house (punch list #119): the supply comes in under pressure from the street main and climbs to
 * the fixture; the drain leaves by gravity through the trap, down the stack and out to the sewer; the vent lets air
 * follow. The air gap at the faucet is the one place the two meet, and they never touch. Lesson 1.
 */
export function TwoSystems({ titleId }: FigureProps) {
  const hatch = `${titleId}-seal`
  return (
    <svg viewBox="0 0 300 200" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Hatch id={hatch} />
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <path d="M70 60 L180 22 L290 60" />
        <rect x="70" y="60" width="220" height="130" fill="var(--bg-subtle)" />
        <line x1="0" y1="190" x2="300" y2="190" />
      </g>
      <Pipe d="M0 180 H40 V128 H162 V100" />
      <Flow x={20} y={180} />
      <Flow x={40} y={152} angle={-90} />
      <Flow x={100} y={128} />
      <Pipe d="M200 130 V18" bore={DRAIN} tint="air" />
      <Pipe d="M150 118 V138 a8 8 0 0 0 16 0 V130 H200 V185 L300 191" bore={DRAIN} tint="waste" />
      <Seal d="M150 130 V138 a8 8 0 0 0 16 0 V130" id={hatch} />
      <Flow x={200} y={160} angle={90} />
      <Flow x={255} y={188} angle={3} />
      <Flow x={200} y={50} angle={90} color="var(--text-muted)" />
      <Sink x={150} y={100} />
      <line x1="150" y1="87" x2="150" y2="99" stroke={'var(--text-green-700)'} strokeWidth="1.2" strokeDasharray="2 2" />
      <Label x={46} y={116} bold color="var(--text-link)">
        in: pressure
      </Label>
      <Label x={222} y={178} bold color="var(--text-amber-700)">
        out: gravity
      </Label>
      <Label x={210} y={34} bold>
        vent: air
      </Label>
      <Label x={108} y={92} anchor="end" size={8} color="var(--text-green-700)">
        air gap
      </Label>
      <Label x={150} y={72} anchor="middle" bold color="currentColor">
        the fixture
      </Label>
      <Label x={14} y={172} size={8}>
        street
      </Label>
      <Label x={299} y={178} size={8} anchor="end">
        sewer
      </Label>
    </svg>
  )
}
