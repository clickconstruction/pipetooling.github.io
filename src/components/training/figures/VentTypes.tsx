import type { FigureProps } from './figureProps'
import { Flow, Hatch, Label, Pipe, Sink, Toilet, Trap } from './plumbingParts'
import { DRAIN, SVG_STYLE } from './plumbingTokens'

/**
 * The vents of a two-storey house (punch list #119): the stack rising through the roof as the stack vent, an
 * individual vent from the upstairs lav joining it, the toilet's arm into the stack, an air admittance valve under
 * the kitchen sink downstairs, and the window the vent's end must keep away from. Lesson 15.
 */
export function VentTypes({ titleId }: FigureProps) {
  const h = `${titleId}-seal`
  return (
    <svg viewBox="0 0 300 190" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Hatch id={h} />
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <path d="M30 44 L150 12 L270 44" />
        <rect x="30" y="44" width="240" height="140" fill="var(--bg-subtle)" />
        <line x1="30" y1="112" x2="270" y2="112" />
        <rect x="222" y="58" width="26" height="22" fill="var(--surface)" />
      </g>
      <Pipe d="M150 184 V2" bore={DRAIN} tint="air" />
      <Pipe d="M150 112 V184" bore={DRAIN} tint="waste" />
      <Flow x={150} y={160} angle={90} />
      <Sink x={74} y={60} w={34} />
      <Trap x={74} y={74} drop={14} r={7} armTo={150} bore={9} id={h} />
      <Pipe d="M100 85 V50 H150" bore={6} tint="air" />
      <Toilet x={118} y={100} />
      <Pipe d="M118 100 V108 H150" bore={DRAIN} tint="waste" />
      <Sink x={74} y={132} w={34} />
      <Trap x={74} y={146} drop={14} r={7} armTo={150} bore={9} id={h} />
      <Pipe d="M100 157 V138" bore={6} tint="air" />
      <rect x="95" y="130" width="10" height="8" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Flow x={100} y={146} angle={90} color="var(--text-muted)" size={0.8} />
      <Label x={160} y={12} size={8} bold color="currentColor">
        stack vent
      </Label>
      <Label x={160} y={22} size={7.5}>
        6 in above the roof
      </Label>
      <Label x={106} y={60} size={6.5}>
        individual
      </Label>
      <Label x={106} y={67} size={6.5}>
        vent
      </Label>
      <Label x={46} y={54} anchor="end" size={7.5}>
        lav
      </Label>
      <Label x={46} y={126} anchor="end" size={7.5}>
        kitchen
      </Label>
      <Label x={110} y={128} size={7.5} bold color="currentColor">
        AAV
      </Label>
      <Label x={110} y={137} size={7}>
        4 in above
      </Label>
      <Label x={110} y={145} size={7}>
        the arm
      </Label>
      <Label x={166} y={128} size={7.5}>
        the stack
      </Label>
      <Label x={166} y={176} size={7.5}>
        to the building drain
      </Label>
      <Label x={235} y={92} anchor="middle" size={7.5}>
        window
      </Label>
      <Label x={235} y={102} anchor="middle" size={7}>
        10 ft from the vent
      </Label>
      <Label x={235} y={110} anchor="middle" size={7}>
        or 3 ft below it
      </Label>
    </svg>
  )
}
