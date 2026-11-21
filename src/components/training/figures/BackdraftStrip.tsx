import type { FigureProps } from './figureProps'
import { Air, Fan, Flame } from './hvacParts'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A water heater that backdrafts, in four frames (Intro to HVAC, lesson 21): the vent drawing as it should; a fan
 * pulling the room short of air; the flame's gas spilling at the draft hood, in the house red; the heater off and
 * the room aired until the cause is fixed.
 */
export function BackdraftStrip({ titleId }: FigureProps) {
  const W = 72
  const H = 146
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const heater = (lit: boolean) => (
    <>
      <Pipe d="M32 62 V30" bore={7} tint={lit ? 'hot' : 'air'} />
      <rect x="18" y="74" width="28" height="48" rx="8" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 74 L27 64 H37 L40 74" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {lit && <Flame x={32} y={119} size={0.55} />}
    </>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="1 it draws" sub="the gas goes up" subColor={RIGHT}>
        {heater(true)}
        <Flow x={32} y={44} angle={-90} size={0.6} />
        <Label x={36} y={137} anchor="middle" size={7}>
          as it should
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="2 a fan pulls" sub="short of air">
        {heater(true)}
        <Fan x={58} y={50} r={8} />
        <Air x={52} y={70} len={16} />
        <Label x={36} y={137} anchor="middle" size={7}>
          air leaves the room
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="3 it spills" sub="at the draft hood" subColor={WRONG}>
        {heater(true)}
        <Flow x={32} y={46} angle={90} size={0.6} color={WRONG} />
        <g fill="none" stroke={WRONG} strokeWidth="1.5" strokeDasharray="3 2.4" strokeLinecap="round">
          <path d="M41 66 C52 60 60 70 62 84" />
          <path d="M23 66 C12 62 8 74 8 86" />
        </g>
        <Label x={36} y={137} anchor="middle" size={7} color={WRONG}>
          into the room
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="4 off, air it" sub="find the cause" subColor={RIGHT}>
        {heater(false)}
        <Label x={32} y={102} anchor="middle" size={7.5} bold color="currentColor">
          off
        </Label>
        <Label x={36} y={137} anchor="middle" size={7} color={RIGHT}>
          then relight
        </Label>
      </Panel>
    </svg>
  )
}
