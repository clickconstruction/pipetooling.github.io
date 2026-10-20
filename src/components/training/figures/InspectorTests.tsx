import type { FigureProps } from './figureProps'
import { Label, Panel, Pipe } from './plumbingParts'
import { DRAIN, RIGHT, SVG_STYLE } from './plumbingTokens'

/**
 * What the inspector tests (punch list #119): the drains filled to a 10 ft head of water above the highest joint
 * with a test ball in the cleanout, the same drains under 5 psi of air on a gauge, and the supply under 50 psi;
 * each must hold for 15 minutes. Lesson 29.
 */
export function InspectorTests({ titleId }: FigureProps) {
  const gauge = (x: number, y: number, reading: string) => (
    <g>
      <circle cx={x} cy={y} r="13" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <line x1={x} y1={y} x2={x + 6} y2={y - 8} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={x} cy={y} r="1.5" fill="currentColor" />
      <text x={x} y={y + 22} fontSize="8" fontWeight="600" fill="currentColor" textAnchor="middle">
        {reading}
      </text>
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={96} h={146} title="drains, water" sub="a 10 ft head">
        <Pipe d="M48 30 V118" bore={DRAIN} tint="air" />
        <rect x="41.5" y="44" width="13" height="74" fill="var(--bg-blue-200)" stroke="none" />
        <Pipe d="M48 96 H76" bore={9} tint="air" />
        <rect x="69.5" y="90" width="13" height="12" fill="var(--bg-blue-200)" stroke="none" />
        <circle cx="48" cy="112" r="5" fill="currentColor" />
        <line x1="24" y1="44" x2="24" y2="96" stroke="currentColor" strokeWidth="1" />
        <line x1="20" y1="44" x2="28" y2="44" stroke="currentColor" strokeWidth="1" />
        <line x1="20" y1="96" x2="28" y2="96" stroke="currentColor" strokeWidth="1" />
        <Label x={20} y={72} anchor="end" size={7} bold color="currentColor">
          10 ft
        </Label>
        <Label x={60} y={82} size={6.5}>
          top joint
        </Label>
        <Label x={56} y={116} size={6.5}>
          test ball
        </Label>
        <Label x={48} y={136} anchor="middle" size={7}>
          no drop in 15 min
        </Label>
      </Panel>
      <Panel x={102} y={2} w={96} h={146} title="drains, air" sub="instead of water">
        <Pipe d="M48 36 V118" bore={DRAIN} tint="air" />
        <rect x="40" y="32" width="16" height="5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
        <rect x="40" y="117" width="16" height="5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
        <Pipe d="M48 70 H66" bore={4} tint="air" />
        {gauge(76, 70, '5 psi')}
        <Label x={48} y={136} anchor="middle" size={7}>
          the needle holds 15 min
        </Label>
      </Panel>
      <Panel x={202} y={2} w={96} h={146} title="the supply" sub="working pressure or air">
        <Pipe d="M10 76 H60" />
        <rect x="59" y="70" width="5" height="12" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
        <Pipe d="M36 76 V58" bore={4} />
        {gauge(36, 46, '50 psi')}
        <Label x={48} y={110} anchor="middle" size={6.5} color={RIGHT}>
          every fixture runs at the final,
        </Label>
        <Label x={48} y={119} anchor="middle" size={6.5} color={RIGHT}>
          and every trap holds
        </Label>
        <Label x={48} y={136} anchor="middle" size={7}>
          15 min, no drop
        </Label>
      </Panel>
    </svg>
  )
}
