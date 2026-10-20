import type { FigureProps } from './figureProps'
import { Flow, Hatch, Label, Panel, Pipe, Trap } from './plumbingParts'
import { DRAIN, RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * The first-timer's four mistakes (punch list #119), each above the right way: an S-trap above a vented P-trap, a
 * sanitary tee on its back above a wye, a flat run above a sloped one, a trap arm past the table above one with
 * the vent inside it. Lesson 30.
 */
export function FirstTimerMistakes({ titleId }: FigureProps) {
  const h = `${titleId}-seal`
  const W = 72
  const H = 176
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const divider = <line x1="6" y1="96" x2="66" y2="96" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="2 2" />
  const x = (cx: number, cy: number) => (
    <g stroke={WRONG} strokeWidth="2">
      <line x1={cx - 4} y1={cy - 4} x2={cx + 4} y2={cy + 4} />
      <line x1={cx + 4} y1={cy - 4} x2={cx - 4} y2={cy + 4} />
    </g>
  )
  const tick = (cx: number, cy: number) => <path d={`M${cx - 5} ${cy} l3 3 l7 -7`} fill="none" stroke={RIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  return (
    <svg viewBox="0 0 300 180" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Hatch id={h} />
      <Panel {...at(0)} w={W} h={H} title="S-trap" sub="no vent" subColor={WRONG}>
        <Pipe d="M20 32 V52 a8 8 0 0 0 16 0 V46 a8 8 0 0 1 16 0 V90" bore={9} tint="waste" />
        <Flow x={52} y={78} angle={90} color={WRONG} />
        {x(60, 40)}
        {divider}
        <Pipe d="M58 112 V170" bore={DRAIN} tint="air" />
        <Trap x={20} y={106} drop={24} r={8} armTo={58} bore={9} id={h} />
        {tick(60, 108)}
        <Label x={36} y={174} anchor="middle" size={6.5} color={RIGHT}>
          P-trap, vented
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="tee on its back" sub="the branch stalls" subColor={WRONG}>
        <Pipe d="M6 72 H66" bore={DRAIN} tint="waste" />
        <Pipe d="M36 34 V62" bore={9} tint="waste" />
        <Flow x={36} y={46} angle={90} color={WRONG} />
        {x(60, 40)}
        {divider}
        <Pipe d="M6 150 H66" bore={DRAIN} tint="waste" />
        <Pipe d="M12 110 L40 138" bore={9} tint="waste" />
        <Flow x={26} y={124} angle={45} color={RIGHT} />
        {tick(60, 108)}
        <Label x={36} y={174} anchor="middle" size={6.5} color={RIGHT}>
          a wye or a combo
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="a flat run" sub="water sits" subColor={WRONG}>
        <Pipe d="M6 66 H66" bore={DRAIN} tint="air" />
        <rect x="12" y="66" width="48" height="5" fill="var(--bg-amber-100)" stroke="none" />
        <circle cx="24" cy="69" r="1.5" fill="currentColor" />
        <circle cx="40" cy="69" r="1.5" fill="currentColor" />
        {x(60, 40)}
        {divider}
        <Pipe d="M6 140 L66 150" bore={DRAIN} tint="waste" />
        <Flow x={40} y={145} angle={9} color={RIGHT} />
        {tick(60, 108)}
        <Label x={36} y={128} anchor="middle" size={6.5}>
          1/4 in per ft
        </Label>
        <Label x={36} y={174} anchor="middle" size={6.5} color={RIGHT}>
          it slopes
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="arm too long" sub="past the table" subColor={WRONG}>
        <Pipe d="M64 50 V90" bore={DRAIN} tint="air" />
        <Trap x={10} y={34} drop={16} r={6} armTo={64} bore={7} id={h} seal="low" />
        <Label x={40} y={64} anchor="middle" size={6.5} color={WRONG}>
          9 ft
        </Label>
        {x(60, 40)}
        {divider}
        <Pipe d="M50 170 V112" bore={DRAIN} tint="air" />
        <Trap x={10} y={108} drop={16} r={6} armTo={50} bore={7} id={h} />
        <Label x={30} y={138} anchor="middle" size={6.5} color={RIGHT}>
          6 ft
        </Label>
        {tick(60, 108)}
        <Label x={36} y={174} anchor="middle" size={6.5} color={RIGHT}>
          the vent inside it
        </Label>
      </Panel>
    </svg>
  )
}
