import type { FigureProps } from './figureProps'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A PEX bend beside a kink (punch list #119, second pass): the pipe turns a corner on a radius of 6 to 8 of its
 * own widths and needs no fitting; a kinked pipe is damaged and the kink is cut out, never bent back. Lesson 7.
 */
export function PexBend({ titleId }: FigureProps) {
  const tick = (cx: number, cy: number) => <path d={`M${cx - 5} ${cy} l3 3 l7 -7`} fill="none" stroke={RIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  const x = (cx: number, cy: number) => (
    <g stroke={WRONG} strokeWidth="2">
      <line x1={cx - 4} y1={cy - 4} x2={cx + 4} y2={cy + 4} />
      <line x1={cx + 4} y1={cy - 4} x2={cx - 4} y2={cy + 4} />
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="A bend" sub="6 to 8 pipe widths, or wider" subColor={RIGHT}>
        <Pipe d="M8 44 H60 a56 56 0 0 1 56 56 V128" bore={8} />
        <Flow x={30} y={44} />
        <Flow x={116} y={118} angle={90} />
        <line x1="60" y1="100" x2="99.6" y2="60.4" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 2" />
        <circle cx="60" cy="100" r="1.5" fill="var(--text-muted)" />
        <Label x={56} y={82} anchor="end" size={7} bold color="currentColor">
          the radius
        </Label>
        <Label x={56} y={91} anchor="end" size={7}>
          6 to 8 widths
        </Label>
        {tick(132, 36)}
        <Label x={54} y={142} anchor="middle" size={7} color={RIGHT}>
          no fitting at the corner
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="A kink" sub="the pipe is damaged" subColor={WRONG}>
        <Pipe d="M8 44 H76 L84 52 V120" bore={8} />
        <polygon points="70,36 90,36 90,56" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <line x1="74" y1="40" x2="86" y2="52" stroke="currentColor" strokeWidth="1.2" />
        {x(132, 36)}
        <line x1="56" y1="34" x2="56" y2="54" stroke={WRONG} strokeWidth="2" strokeDasharray="3 2" />
        <line x1="74" y1="70" x2="94" y2="70" stroke={WRONG} strokeWidth="2" strokeDasharray="3 2" />
        <Label x={52} y={32} anchor="end" size={7} color={WRONG}>
          cut
        </Label>
        <Label x={98} y={73} size={7} color={WRONG}>
          cut
        </Label>
        <Label x={73} y={132} anchor="middle" size={7} bold color={WRONG}>
          cut the kink out
        </Label>
        <Label x={73} y={142} anchor="middle" size={7}>
          join the ends with a fitting
        </Label>
      </Panel>
    </svg>
  )
}
