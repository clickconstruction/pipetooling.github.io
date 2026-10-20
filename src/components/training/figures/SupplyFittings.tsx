import type { FigureProps } from './figureProps'
import { Flow, Hub, Label, Panel, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The eight supply fittings (punch list #119), each with the water drawn through it: the 90 and the 45 turn it, the
 * tee splits it, the coupling joins two pipes, the union joins them and comes apart, the reducer shrinks the line,
 * the cap ends it, the adapter changes to a thread. Lesson 11.
 */
export function SupplyFittings({ titleId }: FigureProps) {
  const W = 72
  const H = 76
  const at = (i: number) => ({ x: 2 + (i % 4) * (W + 2.7), y: 2 + Math.floor(i / 4) * (H + 4) })
  return (
    <svg viewBox="0 0 300 160" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="90">
        <Pipe d="M10 56 H38 V22" />
        <Hub x={26} y={56} />
        <Hub x={38} y={34} angle={90} />
        <Flow x={16} y={56} />
        <Flow x={38} y={28} angle={-90} />
        <Label x={36} y={70} anchor="middle" size={7.5}>
          a quarter turn
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="45">
        <Pipe d="M8 58 H30 L58 30" />
        <Hub x={22} y={58} />
        <Hub x={48} y={40} angle={45} />
        <Flow x={14} y={58} />
        <Flow x={54} y={34} angle={-45} />
        <Label x={36} y={70} anchor="middle" size={7.5}>
          an eighth turn
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="tee">
        <Pipe d="M6 54 H66 M36 54 V22" />
        <Hub x={20} y={54} />
        <Hub x={52} y={54} />
        <Hub x={36} y={36} angle={90} />
        <Flow x={12} y={54} />
        <Flow x={60} y={54} />
        <Flow x={36} y={28} angle={-90} />
        <Label x={36} y={70} anchor="middle" size={7.5}>
          splits the water
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="coupling">
        <Pipe d="M6 48 H66" />
        <Hub x={36} y={48} w={18} />
        <Flow x={14} y={48} />
        <Flow x={58} y={48} />
        <Label x={36} y={70} anchor="middle" size={7.5}>
          joins two pipes
        </Label>
      </Panel>
      <Panel {...at(4)} w={W} h={H} title="union">
        <Pipe d="M6 48 H66" />
        <Hub x={24} y={48} />
        <Hub x={48} y={48} />
        <rect x="30" y="36" width="12" height="24" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <Flow x={12} y={48} />
        <Flow x={60} y={48} />
        <Label x={36} y={70} anchor="middle" size={7.5}>
          comes apart again
        </Label>
      </Panel>
      <Panel {...at(5)} w={W} h={H} title="reducer">
        <Pipe d="M6 48 H30" bore={9} />
        <polygon points="30,41.5 44,45.5 44,50.5 30,54.5" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1.5" />
        <Pipe d="M44 48 H66" bore={5} />
        <Flow x={14} y={48} />
        <Flow x={58} y={48} size={0.8} />
        <Label x={36} y={70} anchor="middle" size={7.5}>
          big to small
        </Label>
      </Panel>
      <Panel {...at(6)} w={W} h={H} title="cap">
        <Pipe d="M6 48 H42" />
        <rect x="40" y="40" width="10" height="16" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <Flow x={14} y={48} />
        <line x1="30" y1="40" x2="30" y2="56" stroke="currentColor" strokeWidth="1.5" />
        <Label x={36} y={70} anchor="middle" size={7.5}>
          ends the line
        </Label>
      </Panel>
      <Panel {...at(7)} w={W} h={H} title="adapter">
        <Pipe d="M6 48 H34" />
        <Hub x={30} y={48} />
        <rect x="36" y="40" width="30" height="16" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1.5" />
        <path d="M40 40 v16 M46 40 v16 M52 40 v16 M58 40 v16" stroke="currentColor" strokeWidth="1.2" />
        <Flow x={14} y={48} />
        <Label x={36} y={70} anchor="middle" size={7.5}>
          glue to thread
        </Label>
      </Panel>
    </svg>
  )
}
