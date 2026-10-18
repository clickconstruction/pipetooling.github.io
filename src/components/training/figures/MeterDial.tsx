import type { FigureProps } from './figureProps'
import { Flow, Label, Pipe } from './plumbingParts'
import { SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Reading the meter (punch list #119, second pass): the register with its digits, the sweep hand that turns while
 * water runs, and the small leak indicator that turns when every faucet is off, which is the sign of a leak.
 * Lesson 2.
 */
export function MeterDial({ titleId }: FigureProps) {
  const cx = 90
  const cy = 76
  const r = 58
  const ticks = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    return <line key={i} x1={cx + Math.cos(a) * (r - 8)} y1={cy + Math.sin(a) * (r - 8)} x2={cx + Math.cos(a) * (r - 3)} y2={cy + Math.sin(a) * (r - 3)} stroke="currentColor" strokeWidth="1.5" />
  })
  const hand = Math.PI * 0.15
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Pipe d="M8 134 H100" bore={8} />
      <Flow x={24} y={134} />
      <circle cx={cx} cy={cy} r={r + 4} fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r} fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      {ticks}
      <rect x={cx - 30} y={cy - 32} width="60" height="14" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <text x={cx} y={cy - 21} fontSize="9" fontFamily="ui-monospace, monospace" fontWeight="600" fill="currentColor" textAnchor="middle" stroke="none" letterSpacing="2">
        0427183
      </text>
      <line x1={cx} y1={cy} x2={cx + Math.cos(hand - Math.PI / 2) * (r - 12)} y2={cy + Math.sin(hand - Math.PI / 2) * (r - 12)} stroke={WRONG} strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3" fill="currentColor" />
      <g transform={`translate(${cx} ${cy + 24})`}>
        <circle r="7" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
        <polygon points="0,-6 2,-1 6,0 2,1 0,6 -2,1 -6,0 -2,-1" fill={WRONG} stroke="none" />
      </g>
      <line x1={cx + 36} y1={cy - 25} x2={cx + 68} y2={cy - 40} stroke="var(--text-muted)" strokeWidth="0.8" />
      <Label x={cx + 70} y={cy - 42} size={7.5} bold color="currentColor">
        the register
      </Label>
      <Label x={cx + 70} y={cy - 33} size={7}>
        every gallon that went in
      </Label>
      <line x1={cx + 24} y1={cy - 36} x2={cx + 62} y2={cy - 6} stroke="var(--text-muted)" strokeWidth="0.8" />
      <Label x={cx + 70} y={cy - 6} size={7.5} bold color="currentColor">
        the sweep hand
      </Label>
      <Label x={cx + 70} y={cy + 3} size={7}>
        turns while water runs
      </Label>
      <line x1={cx + 8} y1={cy + 24} x2={cx + 62} y2={cy + 30} stroke="var(--text-muted)" strokeWidth="0.8" />
      <Label x={cx + 70} y={cy + 30} size={7.5} bold color="currentColor">
        the leak indicator
      </Label>
      <Label x={cx + 70} y={cy + 39} size={7}>
        the small one, it turns on a trickle
      </Label>
      <Label x={cx + 70} y={cy + 56} size={7.5} color={WRONG}>
        every faucet off and it still turns:
      </Label>
      <Label x={cx + 70} y={cy + 65} size={7.5} bold color={WRONG}>
        a leak somewhere in the house
      </Label>
      <Label x={10} y={126} size={7}>
        street
      </Label>
    </svg>
  )
}
