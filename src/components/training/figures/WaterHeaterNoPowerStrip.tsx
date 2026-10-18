import type { FigureProps } from './figureProps'
import { Breaker, Conductor } from './electricalParts'
import { Label, Panel } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A water heater with no power in four frames (punch list #120): the breaker is on and the tank is cold, the
 * breaker goes off and the tester reads the heater dead, the cover comes off and the high-limit's red button is
 * pressed once, and if it trips again the cover goes back on and the call goes out. Lesson 24.
 */
export function WaterHeaterNoPowerStrip({ titleId }: FigureProps) {
  const W = 72
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const tank = (coverOff: boolean, popped: boolean) => (
    <g>
      <rect x="34" y="44" width="30" height="66" rx="8" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1.5" />
      {coverOff ? (
        <g>
          <rect x="40" y="52" width="18" height="18" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="49" cy="61" r="3.5" fill={popped ? WRONG : 'var(--surface)'} stroke={WRONG} strokeWidth="1.3" />
        </g>
      ) : (
        <rect x="40" y="52" width="18" height="18" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.5" />
      )}
    </g>
  )
  const feed = (on: boolean) => (
    <g>
      <Conductor d="M6 40 H12 M28 40 H34 V46" />
      <Breaker x={20} y={40} open={!on} />
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={146} title="1 cold" sub="the breaker is on">
        {feed(true)}
        {tank(false, true)}
        <Label x={36} y={124} anchor="middle" size={6.5}>
          no hot water
        </Label>
        <Label x={36} y={133} anchor="middle" size={6.5}>
          the high-limit tripped
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={146} title="2 off" sub="and tested dead" subColor={RIGHT}>
        {feed(false)}
        {tank(false, true)}
        <rect x="8" y="60" width="14" height="22" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
        <Label x={15} y={74} anchor="middle" size={6} color="currentColor">
          0 V
        </Label>
        <Label x={36} y={124} anchor="middle" size={6.5} color={RIGHT}>
          the tester says dead
        </Label>
        <Label x={36} y={133} anchor="middle" size={6.5}>
          then the cover
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={146} title="3 press" sub="once, dead" subColor={RIGHT}>
        {feed(false)}
        {tank(true, false)}
        <Label x={36} y={124} anchor="middle" size={6.5}>
          the red button
        </Label>
        <Label x={36} y={133} anchor="middle" size={6.5}>
          behind the top cover
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={146} title="4 again?" sub="a second trip" subColor={WRONG}>
        {feed(true)}
        {tank(true, true)}
        <Label x={36} y={124} anchor="middle" size={6} color={WRONG}>
          thermostat or element
        </Label>
        <Label x={36} y={133} anchor="middle" size={6.5} color={WRONG}>
          cover on, call
        </Label>
      </Panel>
    </svg>
  )
}
