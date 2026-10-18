import type { FigureProps } from './figureProps'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { DRAIN, RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A clog in three frames (punch list #119): the stack with a toilet above and a tub below running to the building
 * drain; a clog below both, so the flush backs up into the tub; a cable through the cleanout reaching it. Lesson 21.
 */
export function ClogStrip({ titleId }: FigureProps) {
  const base = (tubLevel: number) => (
    <>
      <Pipe d="M60 30 V110 H92" bore={DRAIN} tint="waste" />
      <Pipe d="M20 50 H60" bore={9} tint="waste" />
      <Pipe d="M20 80 H60" bore={9} tint="waste" />
      <rect x="6" y="38" width="12" height="10" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <Label x={12} y={34} anchor="middle" size={6.5}>
        toilet
      </Label>
      <path d="M4 70 h18 v8 q0 4 -4 4 h-10 q-4 0 -4 -4 z" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      {tubLevel > 0 && <rect x="5" y={78 - tubLevel} width="16" height={tubLevel} fill="var(--bg-amber-100)" stroke="none" />}
      <Label x={12} y={66} anchor="middle" size={6.5}>
        tub
      </Label>
    </>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={96} h={146} title="1 at rest" sub="both drain down">
        {base(0)}
        <Flow x={60} y={66} angle={90} />
        <Flow x={80} y={110} />
        <Label x={48} y={136} anchor="middle" size={7}>
          to the building drain
        </Label>
      </Panel>
      <Panel x={102} y={2} w={96} h={146} title="2 a clog" sub="the flush backs up" subColor={WRONG}>
        {base(6)}
        <ellipse cx="80" cy="110" rx="8" ry="6" fill="currentColor" />
        <Flow x={60} y={64} angle={90} />
        <Flow x={40} y={80} angle={180} color={WRONG} />
        <Flow x={28} y={80} angle={180} color={WRONG} />
        <Label x={48} y={136} anchor="middle" size={7} color={WRONG}>
          out at the lowest fixture
        </Label>
      </Panel>
      <Panel x={202} y={2} w={96} h={146} title="3 the cleanout" sub="the cable follows the pipe" subColor={RIGHT}>
        {base(0)}
        <Pipe d="M44 110 V96" bore={7} tint="air" />
        <path d="M30 86 q10 -6 14 10 q2 10 12 14 h22" fill="none" stroke={RIGHT} strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="80" cy="110" rx="8" ry="6" fill="currentColor" />
        <Flow x={78} y={110} color={RIGHT} />
        <Label x={48} y={136} anchor="middle" size={7} color={RIGHT}>
          never chemicals
        </Label>
      </Panel>
    </svg>
  )
}
