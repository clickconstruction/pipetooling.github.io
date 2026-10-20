import type { FigureProps } from './figureProps'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Trunk and branch beside a manifold (punch list #119), from above: one 3/4 in trunk with 1/2 in branches teeing off
 * to each fixture, or a manifold with one 1/2 in line run to each fixture on its own. Lesson 5.
 */
export function TrunkVsManifold({ titleId }: FigureProps) {
  const fixture = (x: number, y: number, name: string) => (
    <g key={`${x}-${y}`}>
      <rect x={x - 11} y={y - 7} width="22" height="14" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <text x={x} y={y + 3} fontSize="6.5" fill="currentColor" textAnchor="middle">
        {name}
      </text>
    </g>
  )
  return (
    <svg viewBox="0 0 300 160" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={156} title="Trunk and branch">
        <Pipe d="M8 85 H136" bore={8} />
        <Flow x={20} y={85} />
        <Flow x={110} y={85} />
        <Pipe d="M40 85 V52" bore={5} />
        <Pipe d="M70 85 V118" bore={5} />
        <Pipe d="M100 85 V52" bore={5} />
        <Pipe d="M126 85 V118" bore={5} />
        {fixture(40, 44, 'sink')}
        {fixture(70, 126, 'tub')}
        {fixture(100, 44, 'toilet')}
        {fixture(126, 126, 'lav')}
        <Label x={73} y={146} anchor="middle" size={8}>
          3/4 in trunk, 1/2 in branches
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={156} title="Manifold">
        <Pipe d="M4 80 H14" bore={8} />
        <Flow x={8} y={80} />
        <rect x="14" y="44" width="18" height="72" rx="3" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1.5" />
        <Pipe d="M32 54 H60 V40 H106" bore={5} />
        <Pipe d="M32 70 H74 V62 H106" bore={5} />
        <Pipe d="M32 90 H74 V98 H106" bore={5} />
        <Pipe d="M32 106 H60 V120 H106" bore={5} />
        <Flow x={90} y={40} />
        <Flow x={90} y={62} />
        <Flow x={90} y={98} />
        <Flow x={90} y={120} />
        {fixture(118, 40, 'sink')}
        {fixture(118, 62, 'tub')}
        {fixture(118, 98, 'toilet')}
        {fixture(118, 120, 'lav')}
        <Label x={73} y={146} anchor="middle" size={8}>
          one 1/2 in line to each fixture
        </Label>
      </Panel>
    </svg>
  )
}
