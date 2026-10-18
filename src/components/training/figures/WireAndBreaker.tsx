import type { FigureProps } from './figureProps'
import { Breaker, Current } from './electricalParts'
import { Label, Panel } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Wire sizes and the breaker that protects each (punch list #120): three wires drawn at their sizes with the
 * breaker that pairs with each, 14 AWG and 15 A, 12 and 20, 10 and 30; beside them a short, which trips the
 * breaker at once, and an overload, which trips it in minutes. Either way the breaker saves the wire. Lesson 10.
 */
export function WireAndBreaker({ titleId }: FigureProps) {
  const row = (y: number, w: number, gauge: string, amps: number) => (
    <g key={gauge}>
      <path d={`M10 ${y} H58 M74 ${y} H140`} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" />
      <Breaker x={66} y={y} amps={amps} />
      <Label x={10} y={y - 7} size={7.5} bold color="currentColor">
        {gauge}
      </Label>
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      {row(40, 1.8, '14 AWG', 15)}
      {row(80, 2.8, '12 AWG', 20)}
      {row(120, 4, '10 AWG', 30)}
      <Label x={75} y={142} anchor="middle" size={7}>
        smaller number, bigger wire
      </Label>
      <Panel x={154} y={2} w={70} h={146} title="a short" sub="trips at once">
        <path d="M8 60 H22 M38 60 H62" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <Breaker x={30} y={60} open />
        <path d="M8 90 H62" fill="none" stroke="var(--text-muted)" strokeWidth="3" strokeLinecap="round" />
        <path d="M40 60 V90" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <Current x={40} y={76} angle={90} fault />
        <Label x={35} y={112} anchor="middle" size={6.5}>
          hot touches neutral
        </Label>
        <Label x={35} y={121} anchor="middle" size={6.5}>
          the current spikes
        </Label>
      </Panel>
      <Panel x={228} y={2} w={70} h={146} title="an overload" sub="trips in minutes">
        <path d="M8 60 H22 M38 60 H62" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <Breaker x={30} y={60} />
        <Current x={46} y={60} />
        <Current x={54} y={60} />
        <g fill="var(--surface)" stroke="currentColor" strokeWidth="1.2">
          <rect x="10" y="74" width="12" height="10" rx="1" />
          <rect x="28" y="74" width="12" height="10" rx="1" />
          <rect x="46" y="74" width="12" height="10" rx="1" />
        </g>
        <Label x={35} y={100} anchor="middle" size={6.5}>
          too many loads
        </Label>
        <Label x={35} y={109} anchor="middle" size={6.5}>
          the wire warms
        </Label>
        <Label x={35} y={132} anchor="middle" size={6.5} bold color="currentColor">
          it saves the wire
        </Label>
      </Panel>
    </svg>
  )
}
