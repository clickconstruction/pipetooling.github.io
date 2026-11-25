import type { FigureProps } from './figureProps'
import { Air, Box, Coil, Drop, Fan } from './hvacParts'
import { Label, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Where water meets air (Intro to HVAC, lesson 18): a heat pump water heater, the tank below and the small cooling
 * loop on top, room air in and cooler air out, the heat going into the water, and the condensate it makes on its
 * way to a drain. The two labels inside the tank sit on its tints, so they take the darker `--text-600` the cutaway's
 * own labels take there: the muted grey read 3.96 to 1 on them (punch list #419).
 */
export function WaterMeetsAir({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 186" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <line x1="0" y1="164" x2="300" y2="164" stroke="var(--text-muted)" strokeWidth="1.2" />
      <g stroke="currentColor" strokeWidth="1.5">
        <rect x="116" y="62" width="68" height="102" rx="10" fill="var(--bg-blue-200)" />
        <path d="M116 72 a10 10 0 0 1 10 -10 H174 a10 10 0 0 1 10 10 V112 H116 Z" fill="var(--bg-red-100)" stroke="none" />
        <rect x="116" y="62" width="68" height="102" rx="10" fill="none" />
      </g>
      <Box x={116} y={22} w={68} h={40} />
      <Fan x={134} y={42} r={10} />
      <Coil x={150} y={32} w={26} h={20} rows={3} tint="cold" />
      <Pipe d="M116 56 H98 V150" bore={4} tint="cold" />
      <Drop x={98} y={153} />
      <Air x={52} y={42} len={52} tint="warm" />
      <Air x={194} y={42} len={48} tint="cool" />
      <Air x={150} y={66} angle={90} len={22} tint="warm" />
      <Label x={78} y={30} anchor="middle" size={7}>
        room air in
      </Label>
      <Label x={246} y={30} anchor="middle" size={7}>
        cooler, drier air out
      </Label>
      <Label x={150} y={14} anchor="middle" bold color="currentColor" size={8}>
        a sealed loop on top
      </Label>
      <Label x={150} y={104} anchor="middle" size={7} color="var(--text-600)">
        the heat goes
      </Label>
      <Label x={150} y={126} anchor="middle" size={7} color="var(--text-600)">
        into the water
      </Label>
      <Label x={90} y={112} anchor="end" bold color="currentColor" size={7.5}>
        condensate
      </Label>
      <Label x={90} y={122} anchor="end" size={7}>
        to a drain
      </Label>
      <Label x={194} y={112} bold color="currentColor" size={7.5}>
        the tank
      </Label>
      <Label x={194} y={122} size={7}>
        is plumbing
      </Label>
      <Label x={150} y={180} anchor="middle" size={7}>
        the water, the air and the sealed loop, three kinds of work
      </Label>
    </svg>
  )
}
