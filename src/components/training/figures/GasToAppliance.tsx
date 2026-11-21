import type { FigureProps } from './figureProps'
import { Box } from './hvacParts'
import { Flow, Label, Pipe, Valve } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Gas to the appliance (Intro to HVAC, lesson 12): the gas line, the shutoff valve in the room and within 6 ft, the
 * sediment trap pointing down after it, and the one connector, 6 ft at most, into a furnace or a water heater.
 */
export function GasToAppliance({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Pipe d="M8 56 H78" tint="air" />
      <Pipe d="M100 56 H170" tint="air" />
      <Pipe d="M138 56 V92" tint="air" />
      <rect x="131" y="92" width="14" height="6" rx="1.5" fill="currentColor" />
      <Valve x={89} y={56} kind="ball" tint="air" />
      <rect x="166" y="49" width="9" height="14" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Pipe d="M175 56 C192 34 212 78 232 56" tint="waste" dash="2.4 1.4" />
      <Box x={232} y={22} w={60} h={104} />
      <Flow x={40} y={56} size={0.8} />
      <Label x={20} y={46} size={7.5}>
        gas
      </Label>
      <Label x={89} y={22} anchor="middle" bold color="currentColor" size={8}>
        shutoff valve
      </Label>
      <Label x={66} y={82} anchor="middle" size={7}>
        same room,
      </Label>
      <Label x={66} y={91} anchor="middle" size={7}>
        within 6 ft
      </Label>
      <Label x={138} y={112} anchor="middle" bold color="currentColor" size={8}>
        sediment trap
      </Label>
      <Label x={138} y={122} anchor="middle" size={7}>
        grit and water drop in
      </Label>
      <Label x={202} y={92} anchor="middle" bold color="currentColor" size={7.5}>
        connector
      </Label>
      <Label x={202} y={101} anchor="middle" size={7}>
        6 ft at most
      </Label>
      <Label x={262} y={70} anchor="middle" size={7}>
        furnace or
      </Label>
      <Label x={262} y={80} anchor="middle" size={7}>
        water heater
      </Label>
    </svg>
  )
}
