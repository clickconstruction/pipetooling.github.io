import type { FigureProps } from './figureProps'
import { Flow, Hatch, Label, Panel, Pipe, Trap } from './plumbingParts'
import { DRAIN, RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Why vents exist, in three frames (punch list #119): the trap full and sealed; water rushing down with no vent,
 * pulling the seal out behind it; the same with a vent, where air follows the water and the seal stays. Lesson 14.
 */
export function SiphonAndVent({ titleId }: FigureProps) {
  const h = `${titleId}-seal`
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Hatch id={h} />
      <Panel x={2} y={2} w={96} h={146} title="1 at rest" sub="the seal holds">
        <Pipe d="M70 70 V130" bore={DRAIN} tint="air" />
        <Trap x={22} y={36} drop={34} r={9} armTo={70} id={h} />
        <Label x={48} y={142} anchor="middle" size={7.5}>
          water in the bend
        </Label>
      </Panel>
      <Panel x={102} y={2} w={96} h={146} title="2 no vent" sub="the seal is pulled out" subColor={WRONG}>
        <Pipe d="M70 70 V130" bore={DRAIN} tint="waste" />
        <Trap x={22} y={36} drop={34} r={9} armTo={70} id={h} seal="low" />
        <Flow x={46} y={61} color={WRONG} />
        <Flow x={70} y={100} angle={90} color={WRONG} />
        <Flow x={70} y={118} angle={90} color={WRONG} />
        <path d="M70 90 V72 H50" fill="none" stroke={WRONG} strokeWidth="1" strokeDasharray="2 2" />
        <Label x={48} y={142} anchor="middle" size={7.5} color={WRONG}>
          siphon: the seal goes
        </Label>
      </Panel>
      <Panel x={202} y={2} w={96} h={146} title="3 with a vent" sub="air follows the water" subColor={RIGHT}>
        <Pipe d="M70 70 V130" bore={DRAIN} tint="waste" />
        <Pipe d="M70 70 V30" bore={9} tint="air" />
        <Trap x={22} y={36} drop={34} r={9} armTo={70} id={h} />
        <Flow x={70} y={44} angle={90} color="var(--text-muted)" />
        <Flow x={70} y={56} angle={90} color="var(--text-muted)" />
        <Flow x={70} y={110} angle={90} color={RIGHT} />
        <Label x={80} y={36} size={7} color="var(--text-muted)">
          air
        </Label>
        <Label x={48} y={142} anchor="middle" size={7.5} color={RIGHT}>
          the seal stays
        </Label>
      </Panel>
    </svg>
  )
}
