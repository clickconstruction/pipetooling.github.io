import type { FigureProps } from './figureProps'
import { Air, Coil } from './hvacParts'
import { LINE } from './hvacTokens'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The heat pump (Intro to HVAC, lesson 10), in two frames: in summer the indoor coil is cold and the heat goes
 * out; in winter the reversing valve turns the loop round, the indoor coil is hot and the heat comes in.
 */
export function HeatPumpReverse({ titleId }: FigureProps) {
  const frame = (summer: boolean) => {
    const inside = summer ? 'cold' : 'hot'
    const outside = summer ? 'hot' : 'cold'
    return (
      <>
        <Coil x={14} y={62} w={34} h={30} tint={inside} flip />
        <Coil x={98} y={62} w={34} h={30} tint={outside} />
        <Pipe d="M48 62 H66" bore={LINE} tint={inside} />
        <Pipe d="M80 62 H98" bore={LINE} tint={outside} />
        <Pipe d="M48 92 H73" bore={LINE} tint={inside} />
        <Pipe d="M73 92 H98" bore={LINE} tint={outside} />
        <rect x="66" y="56" width="14" height="12" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <Flow x={57} y={62} angle={summer ? 0 : 180} size={0.6} />
        <Flow x={89} y={62} angle={summer ? 0 : 180} size={0.6} />
        <Flow x={73} y={92} angle={summer ? 180 : 0} size={0.6} />
        <Air x={summer ? 38 : 108} y={116} angle={summer ? 0 : 180} len={70} tint="warm" />
        <Label x={31} y={52} anchor="middle" size={7}>
          indoor
        </Label>
        <Label x={115} y={52} anchor="middle" size={7}>
          outdoor
        </Label>
        <Label x={73} y={50} anchor="middle" size={6.5}>
          valve
        </Label>
        <Label x={73} y={138} anchor="middle" bold color="currentColor" size={8}>
          {summer ? 'the heat goes out' : 'the heat comes in'}
        </Label>
      </>
    )
  }
  return (
    <svg viewBox="0 0 300 152" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={148} title="summer" sub="the indoor coil is cold">
        {frame(true)}
      </Panel>
      <Panel x={152} y={2} w={146} h={148} title="winter" sub="the indoor coil is hot">
        {frame(false)}
      </Panel>
    </svg>
  )
}
