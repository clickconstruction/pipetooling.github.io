import type { FigureProps } from './figureProps'
import { Air, Box, Coil, Drop, Fan } from './hvacParts'
import { Label, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The indoor unit (Intro to HVAC, lesson 5): house air in at the bottom through the filter, the blower, the cold
 * coil with water forming on it, the pan under the coil and its drain, and the cooler air out at the top.
 */
export function IndoorUnit({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 190" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Box x={100} y={38} w={80} h={122} />
      <Coil x={112} y={58} w={56} h={24} rows={3} tint="cold" />
      <path d="M108 96 V103 H172 V96" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <Drop x={124} y={86} />
      <Drop x={142} y={88} />
      <Drop x={158} y={86} />
      <Pipe d="M172 101 H214 V132" bore={4} tint="cold" />
      <Fan x={140} y={126} r={13} />
      <line x1="104" y1="150" x2="176" y2="150" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" />
      <Air x={140} y={186} angle={-90} len={22} tint="warm" />
      <Air x={140} y={34} angle={-90} len={22} tint="cool" />
      <Label x={154} y={22} bold color="currentColor" size={8}>
        cooler air out
      </Label>
      <Label x={154} y={180} bold color="currentColor" size={8}>
        house air in
      </Label>
      <Label x={94} y={72} anchor="end" bold color="currentColor" size={8}>
        cold coil
      </Label>
      <Label x={94} y={102} anchor="end" size={7.5}>
        pan
      </Label>
      <Label x={94} y={129} anchor="end" size={7.5}>
        blower
      </Label>
      <Label x={94} y={153} anchor="end" size={7.5}>
        filter
      </Label>
      <Label x={220} y={98} size={7.5}>
        condensate
      </Label>
      <Label x={220} y={108} size={7.5}>
        to the drain
      </Label>
    </svg>
  )
}
