import type { FigureProps } from './figureProps'
import { Air } from './hvacParts'
import { Label, Panel, Pipe } from './plumbingParts'
import { SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * What hurts a duct (Intro to HVAC, lesson 16), in four frames: a kink, a sag between two hangers, a crushed spot
 * under a weight, and a leak. The first three choke the air; the leak loses it, or in a return pulls dust in.
 */
export function DuctFaults({ titleId }: FigureProps) {
  const W = 72
  const H = 146
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const joist = <line x1="6" y1="42" x2="66" y2="42" stroke="currentColor" strokeWidth="2" />
  const hanger = (x: number, to: number) => <line x1={x} y1="42" x2={x} y2={to} stroke="currentColor" strokeWidth="1.2" />
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="1 a kink" sub="a turn too sharp">
        <Pipe d="M8 100 L38 62 L44 100" bore={11} tint="air" />
        <Label x={36} y={128} anchor="middle" size={7} color={WRONG}>
          chokes
        </Label>
        <Label x={36} y={137} anchor="middle" size={7} color={WRONG}>
          the air
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="2 a sag" sub="too few hangers">
        {joist}
        {hanger(10, 60)}
        {hanger(62, 60)}
        <Pipe d="M8 66 Q36 116 64 66" bore={11} tint="air" />
        <Label x={36} y={128} anchor="middle" size={7} color={WRONG}>
          chokes
        </Label>
        <Label x={36} y={137} anchor="middle" size={7} color={WRONG}>
          the air
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="3 crushed" sub="a boot or a box">
        <Pipe d="M6 84 H26" bore={13} tint="air" />
        <Pipe d="M26 86 H46" bore={3} tint="air" />
        <Pipe d="M46 84 H66" bore={13} tint="air" />
        <rect x="24" y="52" width="24" height="30" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.3" />
        <Label x={36} y={128} anchor="middle" size={7} color={WRONG}>
          flat for
        </Label>
        <Label x={36} y={137} anchor="middle" size={7} color={WRONG}>
          good
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="4 a leak" sub="a torn or loose joint">
        <Pipe d="M6 90 H30" bore={12} tint="air" />
        <Pipe d="M40 90 H66" bore={12} tint="air" />
        <Air x={35} y={80} angle={-90} len={22} tint="cool" />
        <Label x={36} y={128} anchor="middle" size={7} color={WRONG}>
          air lost,
        </Label>
        <Label x={36} y={137} anchor="middle" size={7} color={WRONG}>
          or dust pulled in
        </Label>
      </Panel>
    </svg>
  )
}
