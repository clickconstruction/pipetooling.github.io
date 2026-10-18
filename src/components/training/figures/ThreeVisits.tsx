import type { FigureProps } from './figureProps'
import { Flow, Label, Panel, Pipe, Sink, Toilet } from './plumbingParts'
import { DRAIN, SVG_STYLE } from './plumbingTokens'

/**
 * The three visits (punch list #119): rough-in with the drain under the slab and the supply in the open studs,
 * top-out with the stack through the roof and every stub capped under test, trim with the fixtures set on the
 * finished wall. Lesson 28.
 */
export function ThreeVisits({ titleId }: FigureProps) {
  const studs = (
    <g stroke="currentColor" strokeWidth="1.2" fill="none">
      <line x1="12" y1="30" x2="12" y2="96" />
      <line x1="30" y1="30" x2="30" y2="96" />
      <line x1="48" y1="30" x2="48" y2="96" />
      <line x1="66" y1="30" x2="66" y2="96" />
      <line x1="84" y1="30" x2="84" y2="96" />
      <line x1="8" y1="30" x2="88" y2="30" />
    </g>
  )
  const slab = <rect x="6" y="96" width="84" height="8" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.2" />
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={96} h={146} title="1 rough-in" sub="slab and walls">
        {studs}
        {slab}
        <Pipe d="M20 114 H80 L92 116" bore={DRAIN} tint="waste" />
        <Pipe d="M40 114 V86" bore={9} tint="waste" />
        <Pipe d="M24 96 V50" bore={5} tint="hot" />
        <Pipe d="M56 96 V50" bore={5} />
        <Flow x={70} y={114} />
        <Label x={48} y={128} anchor="middle" size={6.5}>
          inspected before the pour
        </Label>
        <Label x={48} y={142} anchor="middle" size={7}>
          drain and supply go in
        </Label>
      </Panel>
      <Panel x={102} y={2} w={96} h={146} title="2 top-out" sub="stubs, under test">
        {studs}
        {slab}
        <Pipe d="M40 96 V30" bore={DRAIN} tint="air" />
        <Pipe d="M24 96 V64 H34" bore={5} tint="hot" />
        <Pipe d="M56 96 V64 H46" bore={5} />
        <rect x="34" y="61" width="4" height="6" fill="var(--surface)" stroke="currentColor" strokeWidth="1" />
        <rect x="42" y="61" width="4" height="6" fill="var(--surface)" stroke="currentColor" strokeWidth="1" />
        <circle cx="72" cy="50" r="7" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
        <line x1="72" y1="50" x2="75" y2="46" stroke="currentColor" strokeWidth="1.2" />
        <Label x={72} y={66} anchor="middle" size={6.5}>
          gauge
        </Label>
        <Label x={48} y={128} anchor="middle" size={6.5}>
          through the roof, stubs capped
        </Label>
        <Label x={48} y={142} anchor="middle" size={7}>
          the water test
        </Label>
      </Panel>
      <Panel x={202} y={2} w={96} h={146} title="3 trim" sub="after the drywall">
        <rect x="6" y="30" width="84" height="66" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.2" />
        {slab}
        <Sink x={30} y={56} w={30} />
        <Toilet x={66} y={96} />
        <Label x={48} y={128} anchor="middle" size={6.5}>
          faucets, toilets, the heater
        </Label>
        <Label x={48} y={142} anchor="middle" size={7}>
          what the customer sees
        </Label>
      </Panel>
    </svg>
  )
}
