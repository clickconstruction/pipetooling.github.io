import type { FigureProps } from './figureProps'

/**
 * Arc flash PPE categories to scale, 4, 8, 25 and 40 cal/cm² (punch list #116), and the boundaries around live
 * equipment: arc flash outermost, limited approach, restricted. Lesson 28.
 */
export function ArcFlashCategories({ titleId }: FigureProps) {
  const cats: Array<[string, number]> = [
    ['1', 4],
    ['2', 8],
    ['3', 25],
    ['4', 40],
  ]
  return (
    <svg viewBox="0 0 300 252" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <text x="6" y="14" fontSize="10" fontWeight="600" fill="currentColor">
        the suit's rating, cal/cm²
      </text>
      {cats.map(([n, cal], i) => {
        const y = 24 + i * 22
        const w = cal * 4.5
        return (
          <g key={n}>
            <text x="6" y={y + 12} fontSize="10" fontWeight="700" fill="currentColor">
              {n}
            </text>
            <rect x="18" y={y} width={w} height="16" rx="3" fill={i < 2 ? 'var(--bg-amber-100)' : 'var(--bg-red-100)'} stroke={i < 2 ? '#b45309' : '#b91c1c'} strokeWidth="1" />
            <text x={18 + w + 6} y={y + 12} fontSize="9.5" fill="currentColor">
              {cal}
            </text>
          </g>
        )
      })}
      <text x="6" y="124" fontSize="9" fill="var(--text-muted)">
        over natural fibers: synthetics melt onto you
      </text>
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <circle cx="90" cy="190" r="44" stroke="#b91c1c" strokeDasharray="4 3" />
        <circle cx="90" cy="190" r="30" stroke="#b45309" strokeDasharray="4 3" />
        <circle cx="90" cy="190" r="16" stroke="#991b1b" />
        <rect x="83" y="183" width="14" height="14" fill="var(--bg-subtle)" />
        <g stroke="var(--text-muted)" strokeWidth="1">
          <line x1="132" y1="176" x2="150" y2="160" />
          <line x1="119" y1="183" x2="150" y2="186" />
          <line x1="105" y1="196" x2="150" y2="212" />
        </g>
      </g>
      <g fontSize="9" fill="currentColor">
        <text x="154" y="163" fill="#b91c1c">arc flash boundary: a burn</text>
        <text x="154" y="189" fill="#b45309">limited approach: a shock</text>
        <text x="154" y="215" fill="#991b1b">restricted: qualified only,</text>
        <text x="154" y="226" fill="#991b1b">in shock PPE</text>
        <text x="90" y="142" fill="var(--text-muted)" fontSize="8.5" textAnchor="middle">live equipment</text>
      </g>
      <text x="6" y="246" fontSize="9" fill="var(--text-muted)">
        an unqualified person crosses a boundary only with a qualified escort
      </text>
    </svg>
  )
}
