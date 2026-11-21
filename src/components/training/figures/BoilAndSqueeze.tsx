import type { FigureProps } from './figureProps'
import { Air } from './hvacParts'
import { Label, Panel, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Refrigerant boils cold (Intro to HVAC, lesson 3), in two frames: at low pressure the refrigerant boils at about
 * 40°F and the house air's heat goes into it; at high pressure it is hotter than the yard and the heat goes out.
 */
export function BoilAndSqueeze({ titleId }: FigureProps) {
  const bubbles = [24, 40, 52, 68, 80, 96, 108, 122]
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="low pressure" sub="the indoor coil">
        <Pipe d="M14 84 H132" bore={12} tint="cold" />
        {bubbles.map((bx, i) => (
          <circle key={bx} cx={bx} cy={i % 2 ? 82 : 86} r={1.4 + (i % 3) * 0.5} fill="var(--surface)" stroke="currentColor" strokeWidth="0.6" />
        ))}
        <Air x={45} y={48} angle={90} len={22} tint="warm" />
        <Air x={101} y={48} angle={90} len={22} tint="warm" />
        <Label x={73} y={42} anchor="middle" size={7}>
          house air, 75°F
        </Label>
        <Label x={73} y={110} anchor="middle" bold color="currentColor" size={8}>
          boils at about 40°F
        </Label>
        <Label x={73} y={122} anchor="middle" size={7}>
          the heat goes in
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="high pressure" sub="the outdoor coil">
        <Pipe d="M14 84 H132" bore={12} tint="hot" />
        <Air x={45} y={72} angle={-90} len={22} tint="warm" />
        <Air x={101} y={72} angle={-90} len={22} tint="warm" />
        <Label x={73} y={42} anchor="middle" size={7}>
          outdoor air, 95°F
        </Label>
        <Label x={73} y={110} anchor="middle" bold color="currentColor" size={8}>
          hotter than the yard
        </Label>
        <Label x={73} y={122} anchor="middle" size={7}>
          the heat goes out
        </Label>
      </Panel>
    </svg>
  )
}
