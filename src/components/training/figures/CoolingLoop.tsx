import type { FigureProps } from './figureProps'
import { Air, Coil, Compressor } from './hvacParts'
import { LINE } from './hvacTokens'
import { Flow, Label, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The loop and its four parts (Intro to HVAC, lesson 2): the evaporator inside, the compressor and the condenser
 * outside, the metering device on the way back in. The low side is drawn cold and the high side hot, with the
 * refrigerant's arrows going round one way.
 */
export function CoolingLoop({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 172" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <line x1="165" y1="6" x2="165" y2="168" stroke="var(--text-muted)" strokeWidth="1.2" strokeDasharray="4 3" />
      <Label x={8} y={14} bold color="currentColor">
        inside
      </Label>
      <Label x={292} y={14} anchor="end" bold color="currentColor">
        outside
      </Label>
      <Coil x={40} y={56} w={50} h={54} tint="cold" flip />
      <Coil x={215} y={56} w={50} h={54} tint="hot" />
      <Pipe d="M90 56 H175" bore={LINE} tint="cold" />
      <Pipe d="M195 56 H215" bore={LINE} tint="hot" />
      <Pipe d="M215 110 H134" bore={LINE} tint="hot" />
      <Pipe d="M122 110 H90" bore={LINE} tint="cold" />
      <Compressor x={185} y={56} />
      <polygon points="122,104 134,116 134,104 122,116" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <Flow x={130} y={56} size={0.7} />
      <Flow x={176} y={110} angle={180} size={0.7} />
      <Flow x={104} y={110} angle={180} size={0.7} />
      <Air x={65} y={168} angle={-90} len={20} tint="warm" />
      <Air x={65} y={48} angle={-90} len={20} tint="cool" />
      <Air x={240} y={168} angle={-90} len={20} />
      <Air x={240} y={48} angle={-90} len={20} tint="warm" />
      <Label x={77} y={162} size={7}>
        house air
      </Label>
      <Label x={77} y={40} size={7}>
        cooled
      </Label>
      <Label x={252} y={162} size={7}>
        outdoor air
      </Label>
      <Label x={252} y={40} size={7}>
        the heat
      </Label>
      <Label x={65} y={126} anchor="middle" bold color="currentColor" size={8}>
        evaporator
      </Label>
      <Label x={65} y={135} anchor="middle" size={6.5}>
        soaks heat up
      </Label>
      <Label x={240} y={126} anchor="middle" bold color="currentColor" size={8}>
        condenser
      </Label>
      <Label x={240} y={135} anchor="middle" size={6.5}>
        gives heat up
      </Label>
      <Label x={185} y={30} anchor="middle" bold color="currentColor" size={8}>
        compressor
      </Label>
      <Label x={185} y={82} anchor="middle" size={6.5}>
        squeezes
      </Label>
      <Label x={128} y={128} anchor="middle" bold color="currentColor" size={8}>
        metering device
      </Label>
      <Label x={128} y={137} anchor="middle" size={6.5}>
        drops the pressure
      </Label>
      <Label x={128} y={49} anchor="middle" size={6.5} color="var(--text-blue-700)">
        low side
      </Label>
      <Label x={196} y={104} anchor="middle" size={6.5} color="var(--text-red-700)">
        high side
      </Label>
    </svg>
  )
}
