import type { FigureProps } from './figureProps'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Water hammer in three frames (punch list #119): water moving to a washer's open valve; the valve slams shut and
 * the water hits the pipe; an arrestor beside the valve, whose air cushion takes the hit instead. Lesson 26.
 */
export function WaterHammerStrip({ titleId }: FigureProps) {
  const valve = (shut: boolean) => (
    <g>
      <rect x="66" y="70" width="14" height="20" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <rect x="69" y="60" width="8" height="10" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      {shut && <rect x="71" y="74" width="4" height="12" fill="currentColor" />}
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={96} h={146} title="1 water moving" sub="the valve is open">
        <Pipe d="M6 80 H66" />
        {valve(false)}
        <Flow x={20} y={80} />
        <Flow x={40} y={80} />
        <Flow x={56} y={80} />
        <Label x={48} y={110} anchor="middle" size={7}>
          to the washer
        </Label>
        <Label x={48} y={140} anchor="middle" size={7}>
          water has weight
        </Label>
      </Panel>
      <Panel x={102} y={2} w={96} h={146} title="2 it slams shut" sub="in a blink" subColor={WRONG}>
        <Pipe d="M6 80 H66" />
        {valve(true)}
        <Flow x={30} y={80} />
        <Flow x={50} y={80} />
        <g stroke={WRONG} strokeWidth="1.5" strokeLinecap="round">
          <line x1="60" y1="66" x2="54" y2="58" />
          <line x1="64" y1="64" x2="62" y2="54" />
          <line x1="60" y1="94" x2="54" y2="102" />
          <line x1="64" y1="96" x2="62" y2="106" />
        </g>
        <Label x={40} y={56} anchor="middle" size={9} bold color={WRONG}>
          BANG
        </Label>
        <Label x={48} y={140} anchor="middle" size={7} color={WRONG}>
          the pipe takes the hit
        </Label>
      </Panel>
      <Panel x={202} y={2} w={96} h={146} title="3 an arrestor" sub="beside the valve" subColor={RIGHT}>
        <Pipe d="M6 80 H66" />
        {valve(true)}
        <Pipe d="M50 80 V64" bore={5} />
        <rect x="43" y="36" width="14" height="28" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <rect x="44" y="52" width="12" height="11" fill="var(--bg-blue-200)" stroke="none" />
        <line x1="44" y1="52" x2="56" y2="52" stroke="currentColor" strokeWidth="1.5" />
        <Flow x={30} y={80} />
        <Flow x={50} y={70} angle={-90} color={RIGHT} />
        <Label x={60} y={46} size={6.5}>
          air
        </Label>
        <Label x={60} y={60} size={6.5}>
          piston
        </Label>
        <Label x={48} y={140} anchor="middle" size={7} color={RIGHT}>
          the cushion takes it
        </Label>
      </Panel>
    </svg>
  )
}
