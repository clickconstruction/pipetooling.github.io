import type { FigureProps } from './figureProps'

/**
 * Noise by tool on one scale (punch list #116): the damage line at 85, the PEL at 90, a nail gun at 95, a
 * jackhammer at 105, a chainsaw at 110, and under each step the time you can stand it unprotected. Lesson 15.
 */
export function NoiseByTool({ titleId }: FigureProps) {
  // 80 dBA at x = 42, 115 at x = 280: 6.8 px a dBA, with room for the unit on the left.
  const x = (db: number) => 42 + (db - 80) * 6.8
  const steps: Array<[number, string]> = [
    [90, '8 h'],
    [95, '4 h'],
    [100, '2 h'],
    [105, '1 h'],
    [110, '30 min'],
    [115, '15 min'],
  ]
  return (
    <svg viewBox="0 0 300 190" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <rect x={x(90) - 8} y="60" width={x(115) - x(90) + 16} height="60" fill="var(--bg-red-100)" stroke="none" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="30" y1="120" x2="292" y2="120" />
        {[80, 85, 90, 95, 100, 105, 110, 115].map((db) => (
          <line key={db} x1={x(db)} y1="116" x2={x(db)} y2="124" />
        ))}
        <line x1={x(85)} y1="110" x2={x(85)} y2="128" stroke="var(--text-amber-700)" strokeWidth="3" />
        <line x1={x(90)} y1="110" x2={x(90)} y2="128" stroke="var(--text-red-700)" strokeWidth="3" />
      </g>
      <g fontSize="9" fill="var(--text-muted)" textAnchor="middle">
        {[80, 85, 90, 95, 100, 105, 110, 115].map((db) => (
          <text key={db} x={x(db)} y="136">
            {db}
          </text>
        ))}
        <text x="6" y="136" textAnchor="start">dBA</text>
      </g>
      <g fontSize="9" fill="currentColor" textAnchor="middle">
        <text x={x(95)} y="22">nail gun</text>
        <line x1={x(95)} y1="26" x2={x(95)} y2="58" stroke="currentColor" strokeWidth="1" />
        <text x={x(105)} y="22">jackhammer</text>
        <line x1={x(105)} y1="26" x2={x(105)} y2="58" stroke="currentColor" strokeWidth="1" />
        <text x={x(110)} y="40">chainsaw</text>
        <line x1={x(110)} y1="44" x2={x(110)} y2="58" stroke="currentColor" strokeWidth="1" />
      </g>
      <g fontSize="8.5" fill="var(--text-red-800)" textAnchor="middle">
        {steps.map(([db, t]) => (
          <text key={db} x={x(db)} y="76">
            {t}
          </text>
        ))}
        <text x={x(102)} y="100" fontSize="9">
          unprotected time at each step
        </text>
      </g>
      <g fontSize="8.5" textAnchor="middle">
        <text x={x(85)} y="150" fill="var(--text-amber-700)">protect</text>
        <text x={x(90)} y="150" fill="var(--text-red-700)">PEL</text>
      </g>
      <text x="20" y="176" fontSize="9.5" fill="var(--text-muted)">
        if you must raise your voice at 2 to 3 ft, it is over 85
      </text>
    </svg>
  )
}
