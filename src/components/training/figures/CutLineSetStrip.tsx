import type { FigureProps } from './figureProps'
import { LINE } from './hvacTokens'
import { Flow, Label, Panel, Person, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A cut line set in four frames (Intro to HVAC, lesson 23): the cut and its spray; the cold that freezes skin; the
 * heavy vapor sinking into a low space; the step back, the open door and the call. Red is the refrigerant loose.
 */
export function CutLineSetStrip({ titleId }: FigureProps) {
  const W = 72
  const H = 146
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const line = (
    <>
      <Pipe d="M6 70 H32" bore={LINE + 1} tint="hot" />
      <Pipe d="M40 70 H66" bore={LINE + 1} tint="hot" />
    </>
  )
  const spray = (
    <g stroke={WRONG} strokeWidth="1.4" strokeLinecap="round">
      <line x1="36" y1="66" x2="30" y2="50" />
      <line x1="36" y1="66" x2="36" y2="46" />
      <line x1="36" y1="66" x2="42" y2="50" />
      <line x1="36" y1="74" x2="30" y2="88" />
      <line x1="36" y1="74" x2="42" y2="88" />
    </g>
  )
  const dots = [
    [14, 112],
    [22, 116],
    [30, 110],
    [38, 116],
    [46, 111],
    [54, 115],
    [18, 120],
    [34, 121],
    [50, 121],
  ]
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="1 the cut" sub="a hiss and a mist" subColor={WRONG}>
        {line}
        {spray}
        <Label x={36} y={128} anchor="middle" size={7}>
          under pressure,
        </Label>
        <Label x={36} y={137} anchor="middle" size={7}>
          for minutes
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="2 it freezes" sub="60°F below zero" subColor={WRONG}>
        {line}
        <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <line x1="36" y1="56" x2="36" y2="84" />
          <line x1="24" y1="63" x2="48" y2="77" />
          <line x1="24" y1="77" x2="48" y2="63" />
        </g>
        <Label x={36} y={128} anchor="middle" size={7} color={WRONG}>
          frostbite
        </Label>
        <Label x={36} y={137} anchor="middle" size={7} color={WRONG}>
          on bare skin
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="3 it sinks" sub="heavier than air" subColor={WRONG}>
        <Pipe d="M6 54 H66" bore={LINE + 1} tint="hot" />
        <Flow x={36} y={78} angle={90} size={0.7} color={WRONG} />
        <path d="M8 96 H20 V124 H52 V96 H64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        {dots.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" fill={WRONG} />
        ))}
        <Label x={36} y={137} anchor="middle" size={7} color={WRONG}>
          it fills low places
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="4 step back" sub="air it, and call" subColor={RIGHT}>
        <rect x="6" y="58" width="18" height="62" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <Flow x={34} y={94} size={0.8} />
        <Person x={52} y={120} h={40} />
        <Label x={36} y={137} anchor="middle" size={7} color={RIGHT}>
          no torch, no spark
        </Label>
      </Panel>
    </svg>
  )
}
