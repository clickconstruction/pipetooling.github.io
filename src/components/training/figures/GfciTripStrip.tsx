import type { FigureProps } from './figureProps'
import { Conductor, Current, Receptacle } from './electricalParts'
import { Label, Panel } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A GFCI trip at a sink in four frames (punch list #120): a damp cord on the counter leaks a little current, the
 * GFCI sees it leave and trips with its Reset popped, the cord is dried and the tool unplugged, and Reset is
 * pressed once. If it will not hold, the leak is still there and it is a call. Lesson 20.
 */
export function GfciTripStrip({ titleId }: FigureProps) {
  const W = 72
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const scene = (wet: boolean, popped: boolean) => (
    <g>
      <line x1="6" y1="104" x2="66" y2="104" stroke="currentColor" strokeWidth="1.5" />
      <Receptacle x={22} y={64} kind="gfci" />
      {popped && <rect x="23" y="62" width="6" height="4" rx="1" fill={WRONG} />}
      <Conductor d="M32 70 H44 V92 H56" />
      <rect x="52" y="84" width="12" height="16" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
      {wet && (
        <g fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="0.8">
          <ellipse cx="46" cy="100" rx="9" ry="3" />
          <ellipse cx="40" cy="80" rx="2" ry="3" />
        </g>
      )}
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={146} title="1 damp" sub="a cord in the water">
        {scene(true, false)}
        <Label x={36} y={122} anchor="middle" size={6.5}>
          a little current
        </Label>
        <Label x={36} y={131} anchor="middle" size={6.5}>
          leaks out
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={146} title="2 it trips" sub="5 mA was enough" subColor={WRONG}>
        {scene(true, true)}
        <Current x={46} y={96} angle={90} fault />
        <Label x={36} y={122} anchor="middle" size={6.5} color={WRONG}>
          Reset pops out
        </Label>
        <Label x={36} y={131} anchor="middle" size={6.5}>
          downstream dead
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={146} title="3 the cause" sub="dry it, unplug it">
        {scene(false, true)}
        <Label x={36} y={122} anchor="middle" size={6.5}>
          the cause first
        </Label>
        <Label x={36} y={131} anchor="middle" size={6.5}>
          then the button
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={146} title="4 Reset" sub="once" subColor={RIGHT}>
        {scene(false, false)}
        <Label x={36} y={122} anchor="middle" size={6.5} color={RIGHT}>
          it holds
        </Label>
        <Label x={36} y={131} anchor="middle" size={6.5} color={WRONG}>
          or it will not: call
        </Label>
      </Panel>
    </svg>
  )
}
