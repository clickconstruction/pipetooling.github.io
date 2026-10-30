import type { FigureProps } from './figureProps'

/**
 * Power-line clearances by voltage (punch list #116): a pole and its line on the left, six bars for how far to
 * stay, 10 ft up to 50 kV out to 45 ft up to 1,000 kV, drawn to one scale. Lesson 9; lesson 18 names it too.
 */
export function PowerLineClearances({ titleId }: FigureProps) {
  // 45 ft → 171 px, from the line at x = 50, so the longest bar's label still fits inside 300.
  const rows: Array<[string, number, string]> = [
    ['10 ft', 10, 'up to 50 kV'],
    ['15 ft', 15, 'up to 200 kV'],
    ['20 ft', 20, 'up to 350 kV'],
    ['25 ft', 25, 'up to 500 kV'],
    ['35 ft', 35, 'up to 750 kV'],
    ['45 ft', 45, 'up to 1,000 kV'],
  ]
  return (
    <svg viewBox="0 0 300 226" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
        <line x1="24" y1="206" x2="24" y2="14" strokeWidth="4" />
        <line x1="8" y1="22" x2="40" y2="22" strokeWidth="3" />
        <line x1="8" y1="22" x2="8" y2="30" />
        <line x1="40" y1="22" x2="40" y2="30" />
        <line x1="50" y1="16" x2="50" y2="206" stroke="var(--text-red-600)" strokeDasharray="3 3" strokeWidth="1.5" />
        <line x1="6" y1="206" x2="294" y2="206" strokeWidth="3" />
      </g>
      {rows.map(([ft, n, kv], i) => {
        const y = 40 + i * 28
        const w = n * 3.8
        return (
          <g key={ft}>
            <rect x="50" y={y - 8} width={w} height="16" rx="3" fill={i < 2 ? 'var(--bg-amber-100)' : 'var(--bg-red-100)'} stroke={i < 2 ? 'var(--text-amber-700)' : 'var(--text-red-700)'} strokeWidth="1" />
            <text x="56" y={y + 4} fontSize="10" fill="currentColor" fontWeight="600">
              {ft}
            </text>
            <text x={50 + w + 6} y={y + 4} fontSize="9.5" fill="var(--text-muted)">
              {kv}
            </text>
          </g>
        )
      })}
      <g fontSize="9.5" fill="var(--text-muted)">
        <text x="56" y="222">stay this far from the line, you and anything you hold</text>
      </g>
    </svg>
  )
}
