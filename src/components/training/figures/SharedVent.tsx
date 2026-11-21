import type { FigureProps } from './figureProps'
import { Box } from './hvacParts'
import { Flow, Label, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Venting the flame (Intro to HVAC, lesson 14): a furnace and a water heater on one vent through the roof, each
 * connector sloping up to it with no dip, and the draft hood on top of the water heater.
 */
export function SharedVent({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 192" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <line x1="96" y1="24" x2="204" y2="24" stroke="currentColor" strokeWidth="1.5" />
      <Pipe d="M150 86 V6" bore={10} tint="hot" />
      <Pipe d="M70 124 V106 L150 86" bore={7} tint="hot" />
      <Pipe d="M224 110 V104 L150 86" bore={7} tint="hot" />
      <Flow x={150} y={46} angle={-90} size={0.8} />
      <Flow x={108} y={96.5} angle={-14} size={0.7} />
      <Flow x={190} y={95.7} angle={194} size={0.7} />
      <Box x={40} y={124} w={60} h={58} />
      <rect x="202" y="124" width="44" height="58" rx="10" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M212 124 L217 112 H231 L236 124" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <Label x={162} y={44} bold color="currentColor" size={8}>
        one vent for both
      </Label>
      <Label x={210} y={27} size={7}>
        roof
      </Label>
      <Label x={150} y={120} anchor="middle" bold color="currentColor" size={7.5}>
        each slopes up
      </Label>
      <Label x={150} y={130} anchor="middle" size={7}>
        1/4 in per ft, no dips
      </Label>
      <Label x={70} y={156} anchor="middle" size={7.5}>
        furnace
      </Label>
      <Label x={224} y={158} anchor="middle" size={6.5}>
        water heater
      </Label>
      <Label x={252} y={118} size={7}>
        draft hood
      </Label>
    </svg>
  )
}
