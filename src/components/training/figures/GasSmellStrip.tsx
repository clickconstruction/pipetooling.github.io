import type { FigureProps } from './figureProps'
import { Box } from './hvacParts'
import { Flow, Label, Panel, Person } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A gas smell at the furnace in four frames (Intro to HVAC, lesson 22): the smell as the warning; no switch
 * touched; everyone out on foot; the call to 911 and the gas utility from a safe distance.
 */
export function GasSmellStrip({ titleId }: FigureProps) {
  const W = 72
  const H = 146
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="1 the smell" sub="like rotten eggs">
        <Box x={22} y={66} w={28} h={54} />
        <g fill="none" stroke={WRONG} strokeWidth="1.5" strokeDasharray="3 2.4" strokeLinecap="round">
          <path d="M28 60 c-4 -6 4 -8 0 -16" />
          <path d="M36 60 c-4 -6 4 -8 0 -16" />
          <path d="M44 60 c-4 -6 4 -8 0 -16" />
        </g>
        <Label x={36} y={137} anchor="middle" size={7}>
          it is the warning
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="2 no switch" sub="a spark is enough" subColor={WRONG}>
        <rect x="24" y="52" width="24" height="38" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <rect x="32" y="62" width="8" height="18" rx="2" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.2" />
        <g stroke={WRONG} strokeWidth="2.6" strokeLinecap="round">
          <line x1="18" y1="46" x2="54" y2="96" />
          <line x1="54" y1="46" x2="18" y2="96" />
        </g>
        <Label x={36} y={118} anchor="middle" size={7}>
          no light or phone,
        </Label>
        <Label x={36} y={127} anchor="middle" size={7}>
          no flame or car
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="3 everyone out" sub="on foot">
        <rect x="46" y="58" width="18" height="62" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <Person x={24} y={120} h={40} arm="out" />
        <Flow x={42} y={96} size={0.8} />
        <Label x={36} y={137} anchor="middle" size={7}>
          take everyone
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="4 the call" sub="911, the gas utility" subColor={RIGHT}>
        <path d="M6 120 V98 L16 88 L26 98 V120 Z" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <Person x={52} y={120} h={40} arm="up" />
        <rect x="61" y="80" width="5" height="9" rx="1" fill="var(--surface)" stroke="currentColor" strokeWidth="1" />
        <Label x={36} y={137} anchor="middle" size={7} color={RIGHT}>
          a safe distance
        </Label>
      </Panel>
    </svg>
  )
}
