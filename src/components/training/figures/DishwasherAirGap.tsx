import type { FigureProps } from './figureProps'
import { Flow, Hatch, Label, Panel, Pipe, Sink, Trap } from './plumbingParts'
import { DRAIN, RIGHT, SVG_STYLE } from './plumbingTokens'

/**
 * The dishwasher's drain under a sink (punch list #119, second pass): a high loop that rises to the underside of
 * the counter before it drops to the sink's tailpiece, beside an air gap on the counter, where the hose ends in
 * open air before the second hose runs down. Either way the sink cannot drain back into the dishwasher.
 * Lesson 27.
 */
export function DishwasherAirGap({ titleId }: FigureProps) {
  const h = `${titleId}-seal`
  const room = (
    <>
      <line x1="6" y1="44" x2="140" y2="44" stroke="currentColor" strokeWidth="1.5" />
      <rect x="8" y="46" width="48" height="90" rx="2" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="32" cy="92" r="12" fill="none" stroke="currentColor" strokeWidth="1" />
      <Label x={32} y={66} anchor="middle" size={7}>
        dishwasher
      </Label>
      <Sink x={118} y={44} w={32} />
      <Pipe d="M140 68 V136" bore={DRAIN} tint="air" />
      <Trap x={118} y={62} drop={48} r={7} armTo={140} bore={9} id={h} />
      <Label x={118} y={142} anchor="middle" size={7}>
        the trap
      </Label>
    </>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Hatch id={h} />
      <Panel x={2} y={2} w={146} h={146} title="A high loop" sub="under the counter" subColor={RIGHT}>
        {room}
        <Pipe d="M56 100 H64 V54 q0 -4 4 -4 h4 q4 0 4 4 V80 H114" bore={5} tint="waste" />
        <Flow x={64} y={76} angle={-90} size={0.7} />
        <Flow x={96} y={80} size={0.7} />
        <Label x={76} y={96} size={6.5} bold color={RIGHT}>
          the sink
        </Label>
        <Label x={76} y={104} size={6.5}>
          cannot drain
        </Label>
        <Label x={76} y={112} size={6.5}>
          back down
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="An air gap" sub="on the counter" subColor={RIGHT}>
        {room}
        <rect x="60" y="30" width="12" height="16" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="66" cy="37" r="2" fill="var(--text-muted)" />
        <Pipe d="M56 100 H62 V48" bore={5} tint="waste" />
        <Pipe d="M70 48 V80 H114" bore={5} tint="waste" />
        <Flow x={62} y={76} angle={-90} size={0.7} />
        <Flow x={96} y={80} size={0.7} />
        <Label x={78} y={34} size={7} bold color="currentColor">
          air gap
        </Label>
        <Label x={76} y={96} size={6.5} bold color={RIGHT}>
          the hose
        </Label>
        <Label x={76} y={104} size={6.5}>
          ends in
        </Label>
        <Label x={76} y={112} size={6.5}>
          open air
        </Label>
      </Panel>
    </svg>
  )
}
