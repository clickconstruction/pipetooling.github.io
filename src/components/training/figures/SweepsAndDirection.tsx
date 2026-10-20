import type { FigureProps } from './figureProps'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { DRAIN, RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Sweeps and direction (punch list #119): a long sweep turning a horizontal run, a short sweep dropping into a
 * vertical pipe, and a combo joining a branch and turning it into the run, each with its arrow; the fourth panel
 * is the same combo facing the wrong way. Lesson 18.
 */
export function SweepsAndDirection({ titleId }: FigureProps) {
  const W = 72
  const H = 136
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  return (
    <svg viewBox="0 0 300 140" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="long sweep" sub="a horizontal turn">
        <Pipe d="M8 48 H30 a30 30 0 0 1 30 30 V120" bore={DRAIN} tint="waste" />
        <Flow x={16} y={48} />
        <Flow x={60} y={108} angle={90} />
        <Label x={36} y={132} anchor="middle" size={7}>
          or two 45s
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="short sweep" sub="into a drop only">
        <Pipe d="M8 48 H46 a10 10 0 0 1 10 10 V120" bore={DRAIN} tint="waste" />
        <Flow x={16} y={48} />
        <Flow x={56} y={108} angle={90} />
        <Label x={36} y={132} anchor="middle" size={7}>
          the water falls
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="combo" sub="wye and eighth bend" subColor={RIGHT}>
        <Pipe d="M8 100 H66" bore={DRAIN} tint="waste" />
        <Pipe d="M30 34 V58 q0 16 12 28" bore={10} tint="waste" />
        <Flow x={14} y={100} />
        <Flow x={58} y={100} />
        <Flow x={30} y={44} angle={90} />
        <Label x={36} y={132} anchor="middle" size={7} color={RIGHT}>
          joins with the flow
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="backwards" sub="the same combo" subColor={WRONG}>
        <Pipe d="M8 100 H66" bore={DRAIN} tint="waste" />
        <Pipe d="M44 34 V58 q0 16 -12 28" bore={10} tint="waste" />
        <Flow x={14} y={100} />
        <Flow x={58} y={100} />
        <Flow x={44} y={44} angle={90} color={WRONG} />
        <line x1="18" y1="70" x2="28" y2="80" stroke={WRONG} strokeWidth="2" />
        <line x1="28" y1="70" x2="18" y2="80" stroke={WRONG} strokeWidth="2" />
        <Label x={36} y={132} anchor="middle" size={7} color={WRONG}>
          fights the flow
        </Label>
      </Panel>
    </svg>
  )
}
