import type { FigureProps } from './figureProps'
import { Box, Drop } from './hvacParts'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Where a condensate drain ends (Intro to HVAC, lesson 8), in two frames: tied straight into a plumbing drain,
 * with sewer gas climbing the pipe to the unit in the house red; and ending in the open air over a drain.
 */
export function DrainEnd({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="tied straight in" sub="sewer gas can climb it" subColor={WRONG}>
        <Box x={14} y={34} w={40} h={22} />
        <Pipe d="M24 112 H130" bore={10} tint="waste" />
        <Pipe d="M54 46 H92 V108" bore={4} tint="cold" />
        <g fill="none" stroke={WRONG} strokeWidth="1.5" strokeDasharray="3 2.4" strokeLinecap="round">
          <path d="M104 106 V58 H64" />
        </g>
        <Flow x={64} y={58} angle={180} size={0.7} color={WRONG} />
        <Label x={34} y={48} anchor="middle" size={6.5}>
          the unit
        </Label>
        <Label x={118} y={84} anchor="middle" size={6.5} color={WRONG}>
          gas
        </Label>
        <Label x={73} y={134} anchor="middle" size={7}>
          a plumbing drain
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="ends in the open" sub="nothing comes back" subColor={RIGHT}>
        <Box x={14} y={34} w={40} h={22} />
        <Pipe d="M54 46 H92 V80" bore={4} tint="cold" />
        <Drop x={92} y={84} />
        <path d="M82 98 L87 106 M102 98 L97 106" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <Pipe d="M92 106 V122" bore={10} tint="waste" />
        <Label x={34} y={48} anchor="middle" size={6.5}>
          the unit
        </Label>
        <Label x={108} y={94} bold color="currentColor" size={7}>
          air gap
        </Label>
        <Label x={73} y={138} anchor="middle" size={7}>
          over a drain, not into it
        </Label>
      </Panel>
    </svg>
  )
}
