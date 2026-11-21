import type { FigureProps } from './figureProps'
import { Air, Box, Fan, Flame } from './hvacParts'
import { Flow, Label, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The gas furnace, cut open (Intro to HVAC, lesson 11): the burners' flame inside the heat exchanger, the inducer
 * pulling the flame's gas up the flue, and the blower pushing the house's air past the outside of the same metal.
 */
export function FurnaceCutaway({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 196" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Box x={92} y={32} w={108} h={140} />
      <Pipe d="M104 118 H184 V98 H112 V78 H184 V58 H226 V10" bore={8} tint="hot" />
      <Flame x={106} y={123} size={0.8} />
      <Flow x={150} y={118} size={0.7} />
      <Flow x={150} y={78} size={0.7} />
      <Flow x={226} y={30} angle={-90} size={0.7} />
      <Fan x={210} y={58} r={8} />
      <Fan x={146} y={150} r={13} />
      <Air x={124} y={136} angle={-90} len={14} />
      <Air x={168} y={136} angle={-90} len={14} />
      <Air x={146} y={192} angle={-90} len={18} />
      <Air x={146} y={28} angle={-90} len={20} tint="warm" />
      <Label x={86} y={92} anchor="end" bold color="currentColor" size={8}>
        heat exchanger
      </Label>
      <Label x={86} y={121} anchor="end" size={7.5}>
        burners
      </Label>
      <Label x={86} y={153} anchor="end" size={7.5}>
        blower
      </Label>
      <Label x={236} y={24} size={7.5} bold color="currentColor">
        flue
      </Label>
      <Label x={236} y={34} size={7}>
        to the vent
      </Label>
      <Label x={206} y={78} size={7}>
        inducer
      </Label>
      <Label x={134} y={16} anchor="end" bold color="currentColor" size={8}>
        warm air out
      </Label>
      <Label x={160} y={188} size={7.5}>
        house air in
      </Label>
    </svg>
  )
}
