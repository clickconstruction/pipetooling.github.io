import type { FigureProps } from './figureProps'
import { Conductor, Current } from './electricalParts'
import { Flow, Label, Panel, Person, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A cut in the bonded pipe in three frames (punch list #120): the ground runs along the metal water pipe and a
 * jumper spans the section to come out; the section is cut with the jumper on and the ground goes round the gap;
 * the same cut with no jumper, and the person holding both ends is the path, in the house red. Lesson 23.
 */
export function CutPipeStrip({ titleId }: FigureProps) {
  const W = 96
  const at = (i: number) => ({ x: 2 + i * (W + 4), y: 2 })
  const clamp = (x: number) => <rect x={x - 3} y={72} width="6" height="12" rx="1.5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
  const jumper = (
    <>
      <Conductor d="M30 74 V58 H66 V74" wire="ground" />
      {clamp(30)}
      {clamp(66)}
    </>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={146} title="1 at rest" sub="along the pipe">
        <Pipe d="M6 78 H90" />
        {jumper}
        <Flow x={16} y={78} color="var(--text-muted)" size={0.9} />
        <Flow x={82} y={78} color="var(--text-muted)" size={0.9} />
        <Label x={48} y={52} anchor="middle" size={6.5}>
          the jumper
        </Label>
        <Label x={48} y={104} anchor="middle" size={6.5}>
          the section to come out
        </Label>
        <line x1="40" y1="90" x2="56" y2="90" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="2 2" />
      </Panel>
      <Panel {...at(1)} w={W} h={146} title="2 cut, jumper on" sub="the ground goes round" subColor={RIGHT}>
        <Pipe d="M6 78 H42" />
        <Pipe d="M54 78 H90" />
        {jumper}
        <Current x={48} y={58} />
        <Person x={48} y={142} h={36} arm="up" />
        <Label x={48} y={100} anchor="middle" size={6.5} color={RIGHT}>
          the cut opens nothing
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={146} title="3 cut, no jumper" sub="the person is the path" subColor={WRONG}>
        <Pipe d="M6 78 H42" />
        <Pipe d="M54 78 H90" />
        <Person x={48} y={142} h={36} arm="up" />
        <Current x={34} y={112} angle={90} fault />
        <Current x={62} y={112} angle={90} fault />
        <Label x={48} y={100} anchor="middle" size={6.5} color={WRONG}>
          both ends, through the hands
        </Label>
      </Panel>
    </svg>
  )
}
