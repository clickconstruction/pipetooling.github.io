import type { FigureProps } from './figureProps'
import { Box, Drop, Flame } from './hvacParts'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Two kinds of gas furnace (Intro to HVAC, lesson 11), in two frames: a standard one, Category I, vented hot and
 * dry in metal that rises; and a condensing one, Category IV, vented cool and wet in plastic, with a drain.
 */
export function TwoFurnaces({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 156" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={152} title="standard" sub="Category I">
        <Box x={28} y={70} w={44} h={48} />
        <Flame x={50} y={114} size={0.7} />
        <Pipe d="M50 70 V34" bore={8} tint="hot" />
        <Flow x={50} y={50} angle={-90} size={0.7} />
        <Label x={84} y={48} bold color="currentColor" size={7.5}>
          metal vent
        </Label>
        <Label x={84} y={58} size={7}>
          hot and dry
        </Label>
        <Label x={84} y={68} size={7}>
          it rises
        </Label>
        <Label x={73} y={138} anchor="middle" size={7}>
          the gas leaves hot
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={152} title="condensing" sub="Category IV">
        <Box x={28} y={70} w={44} h={48} />
        <Flame x={50} y={114} size={0.7} />
        <Pipe d="M72 84 H132" bore={7} tint="cold" />
        <Flow x={104} y={84} size={0.7} />
        <Pipe d="M28 108 H16 V124" bore={3.4} tint="cold" />
        <Drop x={16} y={127} size={0.8} />
        <Drop x={92} y={92} size={0.7} />
        <Label x={80} y={56} bold color="currentColor" size={7.5}>
          plastic vent
        </Label>
        <Label x={80} y={66} size={7}>
          cool and wet
        </Label>
        <Label x={73} y={144} anchor="middle" size={7}>
          water forms, so it needs a drain
        </Label>
      </Panel>
    </svg>
  )
}
