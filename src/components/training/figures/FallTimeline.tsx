import type { FigureProps } from './figureProps'

/**
 * The fall timeline (punch list #116): 0.3 s to realize, 0.33 s more to react, one second to fall 16 ft; and under
 * it the hang, suspension trauma from 3 to 5 minutes and a death inside 30. Lesson 7.
 */
export function FallTimeline({ titleId }: FigureProps) {
  // one second across 240 px, from x = 30.
  const x = (s: number) => 30 + s * 240
  return (
    <svg viewBox="0 0 300 196" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1={x(0)} y1="60" x2={x(1)} y2="60" />
        <line x1={x(0)} y1="54" x2={x(0)} y2="66" />
        <line x1={x(0.3)} y1="54" x2={x(0.3)} y2="66" />
        <line x1={x(0.63)} y1="54" x2={x(0.63)} y2="66" />
        <line x1={x(1)} y1="54" x2={x(1)} y2="66" />
        <rect x={x(0)} y="70" width={x(0.3) - x(0)} height="10" fill="var(--bg-amber-100)" stroke="none" />
        <rect x={x(0.3)} y="70" width={x(0.63) - x(0.3)} height="10" fill="var(--bg-amber-100)" stroke="none" />
        <rect x={x(0.63)} y="70" width={x(1) - x(0.63)} height="10" fill="var(--bg-red-100)" stroke="none" />
      </g>
      <g fontSize="9" fill="currentColor" textAnchor="middle">
        <text x={x(0)} y="46">you slip</text>
        <text x={x(0.3)} y="46">0.3 s</text>
        <text x={x(0.63)} y="46">0.63 s</text>
        <text x={x(1)} y="46">1 s</text>
        <text x={(x(0) + x(0.3)) / 2} y="94" fill="var(--text-muted)">realize</text>
        <text x={(x(0.3) + x(0.63)) / 2} y="94" fill="var(--text-muted)">react</text>
        <text x={(x(0.63) + x(1)) / 2} y="94" fill="#991b1b">16 ft down</text>
      </g>
      <text x="30" y="24" fontSize="10" fontWeight="600" fill="currentColor">
        the fall
      </text>
      <text x="30" y="124" fontSize="10" fontWeight="600" fill="currentColor">
        then the hang
      </text>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="30" y1="150" x2="270" y2="150" />
        <line x1="30" y1="144" x2="30" y2="156" />
        <line x1="62" y1="144" x2="62" y2="156" />
        <line x1="270" y1="144" x2="270" y2="156" />
        <rect x="62" y="158" width="208" height="8" fill="var(--bg-red-100)" stroke="none" />
      </g>
      <g fontSize="9" fill="currentColor" textAnchor="middle">
        <text x="62" y="138" textAnchor="start">3 to 5 min</text>
        <text x="270" y="138" textAnchor="end">30 min</text>
        <text x="166" y="180" fill="#991b1b">suspension trauma: the harness itself hurts you, then kills</text>
      </g>
      <text x="30" y="192" fontSize="9" fill="var(--text-muted)">
        the rescue plan is written before anyone goes up
      </text>
    </svg>
  )
}
