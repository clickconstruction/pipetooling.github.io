import type { FigureProps } from './figureProps'

/** The four heat stages as a rising staircase, rash, cramps, exhaustion, stroke at about 104°F (punch list #116). Lesson 15. */
export function HeatStages({ titleId }: FigureProps) {
  const steps: Array<[string, string, string]> = [
    ['rash', 'sweaty, bumpy skin', 'var(--bg-amber-100)'],
    ['cramps', 'muscles knot up', 'var(--bg-amber-100)'],
    ['exhaustion', 'weak, dizzy, pale', 'var(--bg-amber-100)'],
    ['stroke · 104°F', 'confused, hot, dry', 'var(--bg-red-100)'],
  ]
  return (
    <svg viewBox="0 0 300 180" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      {steps.map(([name, sign, fill], i) => {
        const x = 8 + i * 72
        const top = 120 - i * 28
        return (
          <g key={name}>
            <rect x={x} y={top} width="70" height={150 - top} fill={fill} stroke={i === 3 ? '#b91c1c' : '#b45309'} strokeWidth="1.5" />
            <text x={x + 35} y={top + 16} fontSize="9.5" fontWeight="600" fill="currentColor" textAnchor="middle">
              {name}
            </text>
            <text x={x + 35} y={top + 29} fontSize="7.5" fill="var(--text-muted)" textAnchor="middle">
              {sign}
            </text>
          </g>
        )
      })}
      <g fontSize="9.5">
        <text x="224" y="12" fill="#991b1b" fontWeight="700">call 911</text>
        <text x="224" y="24" fill="#991b1b" fontSize="9">shade, cool them</text>
        <text x="8" y="168" fill="var(--text-muted)" fontSize="9">two weeks to acclimatize; water all day; a break at least every 2 hours</text>
      </g>
    </svg>
  )
}
