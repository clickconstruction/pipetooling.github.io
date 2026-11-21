import type { FigureProps } from './figureProps'
import { Box, Coil, Drop } from './hvacParts'
import { Flow, Hatch, Label, Pipe, Trap } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Condensate (Intro to HVAC, lesson 8): the coil dripping into its pan, the drain leaving through a capped tee
 * and a trap, sloping down all the way, and ending in the open air over a drain, never tied into it.
 */
export function CondensateDrain({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 176" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Hatch id="condensate-seal" />
      <Box x={16} y={22} w={84} h={66} />
      <Coil x={28} y={34} w={60} h={20} rows={3} tint="cold" />
      <Drop x={42} y={58} />
      <Drop x={60} y={60} />
      <Drop x={76} y={58} />
      <path d="M24 68 V78 H92 V68" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <Pipe d="M92 76 H122" bore={5} tint="cold" />
      <Pipe d="M110 76 V60" bore={5} tint="air" />
      <line x1="104" y1="59" x2="116" y2="59" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <Trap x={122} y={73.5} drop={18} r={6} armTo={150} bore={5} id="condensate-seal" tint="cold" />
      <Pipe d="M150 85.5 L250 100 V128" bore={5} tint="cold" />
      <Flow x={200} y={92.6} angle={8} size={0.7} />
      <Drop x={250} y={131} />
      <line x1="150" y1="150" x2="300" y2="150" stroke="var(--text-muted)" strokeWidth="1.2" />
      <Pipe d="M250 150 V172" bore={9} tint="waste" />
      <path d="M240 143 L245 150 M260 143 L255 150" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <Label x={58} y={16} anchor="middle" size={7}>
        the cold coil
      </Label>
      <Label x={58} y={98} anchor="middle" size={7}>
        the pan
      </Label>
      <Label x={120} y={62} size={7}>
        capped tee
      </Label>
      <Label x={128} y={112} anchor="middle" bold color="currentColor" size={7.5}>
        trap
      </Label>
      <Label x={200} y={78} anchor="middle" bold color="currentColor" size={7.5}>
        slopes 1/8 in per ft or more
      </Label>
      <Label x={196} y={112} anchor="middle" size={7}>
        3/4 in or bigger
      </Label>
      <Label x={262} y={140} bold color="currentColor" size={7.5}>
        air gap
      </Label>
      <Label x={236} y={166} anchor="end" size={7}>
        ends in the open, over a drain
      </Label>
    </svg>
  )
}
