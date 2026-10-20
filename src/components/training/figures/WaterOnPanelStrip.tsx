import type { FigureProps } from './figureProps'
import { Current } from './electricalParts'
import { Label, Panel, Person, Pipe, Valve } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Water on a panel in four frames (punch list #120): a pipe above the panel starts to drip, the water runs down
 * the live panel and makes a path to the floor, the water is shut off at a valve away from the panel, and the
 * electrician is called while nobody touches the panel. Lesson 21.
 */
export function WaterOnPanelStrip({ titleId }: FigureProps) {
  const W = 72
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const scene = (drip: boolean, wet: boolean) => (
    <g>
      <Pipe d="M6 36 H66" bore={5} />
      <rect x="22" y="56" width="28" height="44" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={36} y={81} anchor="middle" size={6.5}>
        panel
      </Label>
      <line x1="6" y1="112" x2="66" y2="112" stroke="currentColor" strokeWidth="1.5" />
      {drip && (
        <g fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="0.8">
          <ellipse cx="36" cy="44" rx="2" ry="3" />
          <ellipse cx="36" cy="52" rx="2" ry="3" />
        </g>
      )}
      {wet && <ellipse cx="36" cy="110" rx="12" ry="3" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="0.8" />}
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={146} title="1 a leak" sub="above the panel">
        {scene(true, false)}
        <Label x={36} y={130} anchor="middle" size={6.5}>
          water heads down
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={146} title="2 live" sub="water makes a path" subColor={WRONG}>
        {scene(true, true)}
        <Current x={36} y={104} angle={90} fault />
        <Label x={36} y={130} anchor="middle" size={6.5} color={WRONG}>
          do not touch it
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={146} title="3 water off" sub="somewhere else" subColor={RIGHT}>
        <Pipe d="M6 56 H66" bore={5} />
        <Valve x={36} y={56} kind="ball" open={false} bore={5} />
        <Person x={56} y={112} h={40} arm="up" />
        <line x1="6" y1="112" x2="66" y2="112" stroke="currentColor" strokeWidth="1.5" />
        <Label x={36} y={130} anchor="middle" size={6.5} color={RIGHT}>
          the main shutoff
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={146} title="4 call" sub="the electrician reads">
        {scene(false, true)}
        <Person x={60} y={112} h={40} arm="out" />
        <Label x={36} y={130} anchor="middle" size={6.5}>
          still live till then
        </Label>
      </Panel>
    </svg>
  )
}
