import type { FigureProps } from './figureProps'
import { Flow, Hub, Label, Panel, Pipe } from './plumbingParts'
import { DRAIN, SVG_STYLE } from './plumbingTokens'

/**
 * A sanitary tee beside a wye (punch list #119), each with the water through it: the tee's branch curving down into
 * a vertical stack; the wye's branch joining a horizontal run at 45 degrees. Lesson 17.
 */
export function SanTeeVsWye({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="Sanitary tee" sub="a branch drops into a stack">
        <Pipe d="M88 30 V134" bore={DRAIN} tint="waste" />
        <Pipe d="M8 62 H64 q18 0 20 20" bore={11} tint="waste" />
        <Hub x={88} y={44} bore={DRAIN} w={8} angle={90} />
        <Hub x={88} y={110} bore={DRAIN} w={8} angle={90} />
        <Hub x={48} y={62} bore={11} w={8} />
        <Flow x={30} y={62} />
        <Flow x={88} y={122} angle={90} />
        <Label x={73} y={142} anchor="middle" size={7.5}>
          the sweep turns the branch down
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="Wye" sub="a branch joins a horizontal run">
        <Pipe d="M8 100 H138" bore={DRAIN} tint="waste" />
        <Pipe d="M22 30 L80 88" bore={11} tint="waste" />
        <Hub x={30} y={100} bore={DRAIN} w={8} />
        <Hub x={118} y={100} bore={DRAIN} w={8} />
        <Hub x={40} y={48} bore={11} w={8} angle={45} />
        <Flow x={18} y={100} />
        <Flow x={128} y={100} />
        <Flow x={62} y={70} angle={45} />
        <path d="M100 100 a20 20 0 0 0 -14 -14" fill="none" stroke="currentColor" strokeWidth="1" />
        <Label x={108} y={84} size={8} bold color="currentColor">
          45°
        </Label>
        <Label x={73} y={142} anchor="middle" size={7.5}>
          the long merge keeps solids moving
        </Label>
      </Panel>
    </svg>
  )
}
