import type { FigureProps } from './figureProps'
import { Receptacle } from './electricalParts'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Receptacles (punch list #120): three faces as a reader sees them on the wall. The 120 V face with its short
 * slot, long slot and round hole named; the GFCI face with its two buttons; the 240 V face whose slots are
 * turned so a 120 V plug cannot go in. Lesson 11.
 */
export function ReceptacleFaces({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 120" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <g transform="scale(1.6)">
        <Receptacle x={40} y={30} />
        <Receptacle x={94} y={30} kind="gfci" />
        <Receptacle x={148} y={30} kind="240" />
      </g>
      <Label x={64} y={88} anchor="middle" size={8} bold color="currentColor">
        120 V
      </Label>
      <Label x={150} y={88} anchor="middle" size={8} bold color="currentColor">
        GFCI
      </Label>
      <Label x={237} y={88} anchor="middle" size={8} bold color="currentColor">
        240 V
      </Label>
      <Label x={150} y={99} anchor="middle" size={7}>
        Test and Reset
      </Label>
      <Label x={237} y={99} anchor="middle" size={7}>
        a 120 V plug cannot fit
      </Label>
      <Label x={64} y={99} anchor="middle" size={7}>
        short: hot, long: neutral
      </Label>
      <Label x={64} y={110} anchor="middle" size={7}>
        round: ground
      </Label>
    </svg>
  )
}
