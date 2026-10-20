import type { FigureProps } from './figureProps'
import { Flow, Hatch, Label, Panel, Pipe, Trap } from './plumbingParts'
import { DRAIN, RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A blocked vent in three frames (punch list #119): the stack breathing through the roof; a nest in the vent, so the
 * flush pulls air through the sink's trap with a gurgle; the vent cleared from the top. Lesson 23.
 */
export function BlockedVentStrip({ titleId }: FigureProps) {
  const h = `${titleId}-seal`
  const house = (
    <g stroke="currentColor" strokeWidth="1.2" fill="none">
      <line x1="6" y1="40" x2="90" y2="40" />
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Hatch id={h} />
      <Panel x={2} y={2} w={96} h={146} title="1 breathing" sub="air comes down the vent">
        {house}
        <Pipe d="M70 130 V34" bore={DRAIN} tint="air" />
        <Trap x={22} y={66} drop={24} r={8} armTo={70} bore={9} id={h} />
        <Flow x={70} y={50} angle={90} color="var(--text-muted)" />
        <Flow x={70} y={116} angle={90} />
        <Label x={48} y={140} anchor="middle" size={7}>
          the drain breathes
        </Label>
      </Panel>
      <Panel x={102} y={2} w={96} h={146} title="2 blocked" sub="a nest in the vent" subColor={WRONG}>
        {house}
        <Pipe d="M70 130 V34" bore={DRAIN} tint="air" />
        <path d="M62 38 q4 -8 8 -2 q4 -6 8 0 q-2 6 -8 4 q-6 2 -8 -2z" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1" />
        <line x1="60" y1="32" x2="80" y2="44" stroke={WRONG} strokeWidth="2" />
        <line x1="80" y1="32" x2="60" y2="44" stroke={WRONG} strokeWidth="2" />
        <Trap x={22} y={66} drop={24} r={8} armTo={70} bore={9} id={h} seal="low" />
        <Flow x={70} y={116} angle={90} />
        <Flow x={30} y={70} angle={90} color={WRONG} />
        <Flow x={50} y={82} color={WRONG} />
        <Label x={10} y={60} size={7} color={WRONG}>
          gurgle
        </Label>
        <Label x={48} y={140} anchor="middle" size={7} color={WRONG}>
          air through the seal
        </Label>
      </Panel>
      <Panel x={202} y={2} w={96} h={146} title="3 cleared" sub="from the roof" subColor={RIGHT}>
        {house}
        <Pipe d="M70 130 V34" bore={DRAIN} tint="air" />
        <path d="M70 30 q0 10 0 36" fill="none" stroke={RIGHT} strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
        <Trap x={22} y={66} drop={24} r={8} armTo={70} bore={9} id={h} />
        <Flow x={70} y={116} angle={90} />
        <Label x={48} y={140} anchor="middle" size={7} color={RIGHT}>
          a hose from the top
        </Label>
      </Panel>
    </svg>
  )
}
