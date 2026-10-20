import type { FigureProps } from './figureProps'
import { Flow, Label, Panel, Pipe, Valve } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Backflow in three frames (punch list #119): a hose from the bib sits in a bucket; street pressure drops and the
 * bucket is pulled back up the hose into the house; a vacuum breaker on the bib lets air in and the pull stops.
 * Lesson 27.
 */
export function CrossConnectionStrip({ titleId }: FigureProps) {
  const scene = (breaker: boolean) => (
    <>
      <rect x="6" y="30" width="10" height="100" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.2" />
      <Pipe d="M2 60 H30" />
      <Valve x={38} y={60} kind="stop" />
      <Pipe d="M46 60 h8 v10" />
      {breaker && <rect x="49" y="70" width="10" height="7" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />}
      <path d={`M54 ${breaker ? 77 : 70} q2 22 12 34 q6 8 6 14`} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d={`M54 ${breaker ? 77 : 70} q2 22 12 34 q6 8 6 14`} fill="none" stroke="var(--bg-blue-200)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M58 118 h28 l-3 14 h-22 z" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.2" />
    </>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={96} h={146} title="1 a hose in a bucket" sub="the usual one">
        {scene(false)}
        <Flow x={14} y={60} />
        <Label x={72} y={128} anchor="middle" size={6.5}>
          dirty water
        </Label>
        <Label x={48} y={142} anchor="middle" size={7}>
          nothing wrong yet
        </Label>
      </Panel>
      <Panel x={102} y={2} w={96} h={146} title="2 the street drops" sub="a main breaks" subColor={WRONG}>
        {scene(false)}
        <Flow x={14} y={60} angle={180} color={WRONG} />
        <Flow x={64} y={100} angle={-110} color={WRONG} />
        <Flow x={58} y={84} angle={-100} color={WRONG} />
        <Label x={48} y={142} anchor="middle" size={7} color={WRONG}>
          the bucket comes back in
        </Label>
      </Panel>
      <Panel x={202} y={2} w={96} h={146} title="3 a vacuum breaker" sub="air gets in instead" subColor={RIGHT}>
        {scene(true)}
        <Flow x={64} y={74} angle={180} color="var(--text-muted)" size={0.7} />
        <Label x={66} y={66} size={6.5} color="var(--text-muted)">
          air
        </Label>
        <line x1="50" y1="88" x2="58" y2="96" stroke={WRONG} strokeWidth="2" />
        <line x1="58" y1="88" x2="50" y2="96" stroke={WRONG} strokeWidth="2" />
        <Label x={48} y={142} anchor="middle" size={7} color={RIGHT}>
          the pull stops at the bib
        </Label>
      </Panel>
    </svg>
  )
}
