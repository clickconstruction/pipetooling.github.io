import type { FigureProps } from './figureProps'
import { Flow, Label, Panel, Pipe, Valve } from './plumbingParts'
import { SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Three valves, cut open (punch list #119): a ball valve with its bore turned to the pipe by a quarter turn; a gate
 * valve whose wedge winds down across the pipe; a check valve whose flap swings open with the flow and shuts when
 * the flow turns around. Lesson 9.
 */
export function BallGateCheck({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={96} h={146} title="Ball" sub="a quarter turn">
        <Pipe d="M8 90 H88" />
        <Valve x={48} y={90} kind="ball" />
        <Flow x={22} y={90} />
        <Flow x={76} y={90} />
        <Label x={48} y={124} anchor="middle" size={7.5}>
          along the pipe: open
        </Label>
        <Label x={48} y={134} anchor="middle" size={7.5}>
          across it: shut
        </Label>
      </Panel>
      <Panel x={102} y={2} w={96} h={146} title="Gate" sub="many turns">
        <Pipe d="M8 90 H88" />
        <Valve x={48} y={90} kind="gate" />
        <Flow x={22} y={90} />
        <Flow x={76} y={90} />
        <Label x={48} y={124} anchor="middle" size={7.5}>
          the wedge winds down
        </Label>
        <Label x={48} y={134} anchor="middle" size={7.5}>
          all the way, or it sticks
        </Label>
      </Panel>
      <Panel x={202} y={2} w={96} h={146} title="Check" sub="one way only">
        <Pipe d="M8 90 H88" />
        <Valve x={48} y={90} kind="check" />
        <Flow x={22} y={90} />
        <Flow x={70} y={90} />
        <Flow x={80} y={74} angle={180} color={WRONG} />
        <line x1="60" y1="68" x2="66" y2="80" stroke={WRONG} strokeWidth="2" />
        <line x1="66" y1="68" x2="60" y2="80" stroke={WRONG} strokeWidth="2" />
        <Label x={48} y={124} anchor="middle" size={7.5}>
          opens with the flow
        </Label>
        <Label x={48} y={134} anchor="middle" size={7.5}>
          shuts on the way back
        </Label>
      </Panel>
    </svg>
  )
}
