import type { FigureProps } from './figureProps'
import { Air, Box, Fan } from './hvacParts'
import { LINE } from './hvacTokens'
import { Flow, Label, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Heat only moves (Intro to HVAC, lesson 1): a house with its indoor unit, the outdoor unit in the yard, and the
 * loop between them. The heat in the room's air is picked up inside, carried out by the refrigerant and let go
 * outside. Nothing in the drawing makes cold.
 */
export function HeatMoves({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 172" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <line x1="0" y1="150" x2="300" y2="150" stroke="var(--text-muted)" strokeWidth="1.2" />
      <g fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <rect x="20" y="72" width="150" height="78" />
        <path d="M12 74 L95 30 L178 74" fill="none" />
      </g>
      <Pipe d="M150 116 H222" bore={LINE} tint="hot" />
      <Pipe d="M222 132 H150" bore={LINE} tint="cold" />
      <Flow x={190} y={116} size={0.7} />
      <Flow x={190} y={132} angle={180} size={0.7} />
      <Box x={122} y={100} w={30} h={46} />
      <Box x={222} y={104} w={44} h={46} />
      <Fan x={244} y={127} r={13} />
      <Air x={52} y={112} len={30} tint="warm" />
      <Air x={52} y={132} len={30} tint="warm" />
      <Air x={234} y={98} angle={-90} len={22} tint="warm" />
      <Air x={254} y={98} angle={-90} len={22} tint="warm" />
      <Label x={30} y={88} bold color="currentColor">
        inside, 75°F
      </Label>
      <Label x={30} y={98} size={7}>
        heat in the room's air
      </Label>
      <Label x={137} y={94} anchor="middle" size={7}>
        picked up
      </Label>
      <Label x={244} y={54} anchor="middle" bold color="currentColor">
        outside, 95°F
      </Label>
      <Label x={244} y={64} anchor="middle" size={7}>
        the heat is let go
      </Label>
      <Label x={190} y={164} anchor="middle" size={7.5}>
        the refrigerant carries the heat out
      </Label>
    </svg>
  )
}
