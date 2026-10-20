import type { FigureProps } from './figureProps'
import { Flow, Hatch, Label, Pipe, Sink, Toilet, Trap } from './plumbingParts'
import { DRAIN, SVG_STYLE } from './plumbingTokens'

/**
 * A wet vent (punch list #119, second pass): one bathroom group where the lav's drain runs on to take the toilet,
 * and the stretch between them carries the lav's water and the toilet's air at once. The lav's own dry vent rises
 * to the roof. Lesson 15.
 */
export function WetVent({ titleId }: FigureProps) {
  const h = `${titleId}-seal`
  return (
    <svg viewBox="0 0 300 166" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Hatch id={h} />
      <line x1="0" y1="100" x2="300" y2="100" stroke="currentColor" strokeWidth="1.2" />
      <Pipe d="M90 2 V46" bore={6} tint="air" />
      <Flow x={90} y={30} angle={-90} color="var(--text-muted)" size={0.8} />
      <Pipe d="M90 44 V120 H292" bore={DRAIN} tint="waste" />
      <Sink x={50} y={32} w={38} />
      <Trap x={50} y={46} drop={14} r={7} armTo={90} bore={9} id={h} />
      <Toilet x={200} y={100} />
      <Pipe d="M200 100 V120" bore={DRAIN} tint="waste" />
      <Flow x={200} y={111} angle={90} />
      <Flow x={120} y={120} />
      <Flow x={260} y={120} />
      <Flow x={160} y={113} angle={180} color="var(--text-muted)" size={0.8} />
      <Flow x={90} y={92} angle={-90} color="var(--text-muted)" size={0.8} />
      <line x1="96" y1="134" x2="194" y2="134" stroke="currentColor" strokeWidth="1" />
      <line x1="96" y1="130" x2="96" y2="138" stroke="currentColor" strokeWidth="1" />
      <line x1="194" y1="130" x2="194" y2="138" stroke="currentColor" strokeWidth="1" />
      <Label x={145} y={148} anchor="middle" size={8} bold color="currentColor">
        the wet vent
      </Label>
      <Label x={145} y={158} anchor="middle" size={7.5}>
        the lav's drain, and the toilet's vent
      </Label>
      <Label x={28} y={28} anchor="end" size={7.5}>
        lav
      </Label>
      <Label x={96} y={12} size={7.5} bold color="currentColor">
        dry vent
      </Label>
      <Label x={96} y={21} size={7}>
        to the roof
      </Label>
      <Label x={166} y={108} size={7} color="var(--text-muted)">
        air
      </Label>
      <Label x={232} y={84} size={7.5}>
        toilet
      </Label>
      <Label x={296} y={106} anchor="end" size={7.5}>
        on to the stack
      </Label>
      <Label x={4} y={96} size={7}>
        floor
      </Label>
    </svg>
  )
}
