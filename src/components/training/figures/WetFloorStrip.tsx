import type { FigureProps } from './figureProps'
import { Conductor, Current, Receptacle } from './electricalParts'
import { Label, Panel, Person } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A wet floor and a cord in four frames (punch list #120): a tool on a cord on a wet floor, the cord's nick puts
 * the tool's frame live, with a GFCI the leak trips it before the person is the path, and without one the
 * current runs through the person in the house red. Lesson 22.
 */
export function WetFloorStrip({ titleId }: FigureProps) {
  const W = 72
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const scene = (gfci: boolean, live: boolean) => (
    <g>
      <rect x="6" y="104" width="60" height="6" fill="var(--bg-blue-200)" stroke="none" />
      <line x1="6" y1="110" x2="66" y2="110" stroke="currentColor" strokeWidth="1.5" />
      <Receptacle x={16} y={50} kind={gfci ? 'gfci' : '120'} />
      <Conductor d="M26 56 H34 V98 H42" />
      <rect x="42" y="88" width="16" height="14" rx="2" fill="var(--surface)" stroke={live ? WRONG : 'currentColor'} strokeWidth={live ? 2 : 1.3} />
      <circle cx="34" cy="80" r="2" fill={WRONG} />
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={146} title="1 a cord" sub="on a wet floor">
        {scene(false, false)}
        <Label x={36} y={128} anchor="middle" size={6.5}>
          a nick in the cord
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={146} title="2 live" sub="the tool's frame" subColor={WRONG}>
        {scene(false, true)}
        <Label x={36} y={128} anchor="middle" size={6.5} color={WRONG}>
          waiting for a hand
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={146} title="3 a GFCI" sub="trips at 5 mA" subColor={RIGHT}>
        {scene(true, true)}
        <rect x="17" y="48" width="6" height="4" rx="1" fill={WRONG} />
        <Person x={60} y={110} h={40} arm="out" />
        <Label x={36} y={128} anchor="middle" size={6.5} color={RIGHT}>
          before the person
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={146} title="4 no GFCI" sub="through the person" subColor={WRONG}>
        {scene(false, true)}
        <Person x={60} y={110} h={40} arm="out" />
        <Current x={60} y={86} angle={90} fault />
        <Current x={60} y={102} angle={90} fault />
        <Label x={36} y={128} anchor="middle" size={6.5} color={WRONG}>
          across the chest
        </Label>
      </Panel>
    </svg>
  )
}
