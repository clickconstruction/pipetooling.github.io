import type { FigureProps } from './figureProps'
import { Flow, Hatch, Label, Pipe, Seal } from './plumbingParts'
import { DRAIN, SVG_STYLE } from './plumbingTokens'

/**
 * The trap arm's drop rule (punch list #119, second pass), from the side: the weir line runs level from the top
 * of the trap's water to the vent, and the arm falls no more than its own width before it gets there, so the vent
 * opening stays above the water. The 6 ft and 8 ft marks sit beside it. Lesson 14.
 */
export function TrapArmDrop({ titleId }: FigureProps) {
  const h = `${titleId}-seal`
  const weir = 50.5
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Hatch id={h} />
      <Pipe d="M214 2 V100" bore={DRAIN} tint="air" />
      <Pipe d="M214 57 V100" bore={DRAIN} tint="waste" />
      <Flow x={214} y={24} angle={90} color="var(--text-muted)" size={0.8} />
      <Flow x={214} y={86} angle={90} />
      <Pipe d="M30 14 V54 a10 10 0 0 0 20 0 V44 L208 57" bore={DRAIN} tint="waste" />
      <Seal d={`M30 ${weir - 6.5} V54 a10 10 0 0 0 20 0 V44`} id={h} />
      <line x1="50" y1={weir} x2="210" y2={weir} stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
      <line x1="232" y1="44" x2="232" y2="57" stroke="currentColor" strokeWidth="1" />
      <line x1="228" y1="44" x2="236" y2="44" stroke="currentColor" strokeWidth="1" />
      <line x1="228" y1="57" x2="236" y2="57" stroke="currentColor" strokeWidth="1" />
      <Label x={240} y={46} size={7.5} bold color="currentColor">
        the drop
      </Label>
      <Label x={240} y={55} size={7}>
        one pipe width
      </Label>
      <Label x={240} y={63} size={7}>
        at most
      </Label>
      <Label x={120} y={36} anchor="middle" size={7.5} bold color="currentColor">
        the trap arm
      </Label>
      <Label x={66} y={70} size={7.5}>
        the weir line, the water's top
      </Label>
      <Label x={222} y={16} size={7.5}>
        vent
      </Label>
      <Label x={222} y={96} size={7.5}>
        drain
      </Label>
      <line x1="50" y1="114" x2="214" y2="114" stroke="currentColor" strokeWidth="1" />
      <line x1="50" y1="110" x2="50" y2="118" stroke="currentColor" strokeWidth="1" />
      <line x1="214" y1="110" x2="214" y2="118" stroke="currentColor" strokeWidth="1" />
      <Label x={132} y={110} anchor="middle" size={7.5}>
        a 1-1/2 in arm runs 6 ft at most
      </Label>
      <line x1="50" y1="132" x2="290" y2="132" stroke="currentColor" strokeWidth="1" />
      <line x1="50" y1="128" x2="50" y2="136" stroke="currentColor" strokeWidth="1" />
      <line x1="290" y1="128" x2="290" y2="136" stroke="currentColor" strokeWidth="1" />
      <Label x={170} y={128} anchor="middle" size={7.5}>
        a 2 in arm runs 8 ft at most
      </Label>
      <Label x={170} y={147} anchor="middle" size={7}>
        past the mark or steeper, the arm runs full and siphons the trap
      </Label>
    </svg>
  )
}
