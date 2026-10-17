import type { FigureProps } from './figureProps'

/** Poison ivy's leaves of three beside a five-leaf vine that is not it (punch list #116). Lesson 14. */
export function PoisonIvy({ titleId }: FigureProps) {
  const leaf = (x: number, y: number, rot: number, w = 16, h = 30) => (
    <path d={`M0 0 c${w * 0.6} -${h * 0.25} ${w} -${h * 0.7} 0 -${h} c-${w} ${h * 0.3} -${w * 0.6} ${h * 0.75} 0 ${h}z`} transform={`translate(${x} ${y}) rotate(${rot})`} />
  )
  return (
    <svg viewBox="0 0 300 130" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="#15803d" strokeWidth="1.5" fill="var(--bg-green-100)" strokeLinejoin="round">
        <line x1="70" y1="110" x2="70" y2="62" />
        {leaf(70, 62, 0, 18, 40)}
        {leaf(68, 70, -55, 16, 34)}
        {leaf(72, 70, 55, 16, 34)}
        <line x1="210" y1="110" x2="210" y2="66" />
        {leaf(210, 66, 0, 12, 34)}
        {leaf(207, 70, -40, 11, 30)}
        {leaf(213, 70, 40, 11, 30)}
        {leaf(205, 76, -85, 10, 26)}
        {leaf(215, 76, 85, 10, 26)}
      </g>
      <g fontSize="9.5" fill="currentColor" textAnchor="middle">
        <text x="70" y="124" fontWeight="600" fill="#991b1b">
          leaves of three, let it be
        </text>
        <text x="210" y="124" fill="var(--text-muted)">
          five leaves is another plant
        </text>
      </g>
    </svg>
  )
}
