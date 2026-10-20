import type { FigureProps } from './figureProps'
import { Flow, Hatch, Label, Panel, Pipe, Trap } from './plumbingParts'
import { DRAIN, RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A dry trap in three frames (punch list #119): the seal full; a month of no use and the bend is empty, so sewer gas
 * comes up through it; a cup of water and the seal is back. Lesson 22.
 */
export function DryTrapStrip({ titleId }: FigureProps) {
  const h = `${titleId}-seal`
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Hatch id={h} />
      <Panel x={2} y={2} w={96} h={146} title="1 in use" sub="the seal is full">
        <Pipe d="M70 70 V130" bore={DRAIN} tint="waste" />
        <Trap x={22} y={36} drop={34} r={9} armTo={70} id={h} />
        <Label x={48} y={140} anchor="middle" size={7}>
          gas stops at the water
        </Label>
      </Panel>
      <Panel x={102} y={2} w={96} h={146} title="2 a month later" sub="nobody used it" subColor={WRONG}>
        <Pipe d="M70 70 V130" bore={DRAIN} tint="waste" />
        <Trap x={22} y={36} drop={34} r={9} armTo={70} id={h} seal="none" tint="air" />
        <path d="M70 100 V70 H48 V60" fill="none" stroke={WRONG} strokeWidth="1.2" strokeDasharray="2 2" />
        <Flow x={31} y={48} angle={-90} color={WRONG} />
        <Flow x={31} y={38} angle={-90} color={WRONG} />
        <Label x={48} y={140} anchor="middle" size={7} color={WRONG}>
          the smell with no leak
        </Label>
      </Panel>
      <Panel x={202} y={2} w={96} h={146} title="3 a cup of water" sub="the seal is back" subColor={RIGHT}>
        <Pipe d="M70 70 V130" bore={DRAIN} tint="waste" />
        <Trap x={22} y={36} drop={34} r={9} armTo={70} id={h} />
        <path d="M2 40 l5 -9 l9 2 l-3 9 z" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="18" cy="34" r="1.5" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="0.8" />
        <circle cx="21" cy="30" r="1.5" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="0.8" />
        <Label x={48} y={140} anchor="middle" size={7} color={RIGHT}>
          or a trap primer
        </Label>
      </Panel>
    </svg>
  )
}
