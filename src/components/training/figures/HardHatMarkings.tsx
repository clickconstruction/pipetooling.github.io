import type { FigureProps } from './figureProps'

/**
 * A hard hat's markings (punch list #116): the Type and Class stamped inside, and the date wheel. Type 1 covers the
 * top, Type 2 the top and sides; Class C no electrical protection, G to 2,200 V, E to 20,000 V. Lesson 12.
 */
export function HardHatMarkings({ titleId }: FigureProps) {
  const ticks = Array.from({ length: 12 }, (_, i) => i)
  return (
    <svg viewBox="0 0 300 166" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M30 96 a46 46 0 0 1 92 0" fill="#f97316" />
        <path d="M18 96 H134" strokeWidth="4" />
        <path d="M50 96 v-26 a26 26 0 0 1 52 0 v26" strokeDasharray="3 3" strokeWidth="1" stroke="var(--text-muted)" />
      </g>
      <g fontSize="9" fill="currentColor">
        <rect x="56" y="70" width="40" height="22" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1" />
        <text x="76" y="79" textAnchor="middle" fontWeight="700" fontSize="8">
          TYPE 1
        </text>
        <text x="76" y="89" textAnchor="middle" fontWeight="700" fontSize="8">
          CLASS G
        </text>
      </g>
      <g stroke="currentColor" strokeWidth="1.5" fill="var(--surface)">
        <circle cx="206" cy="60" r="34" />
        <circle cx="206" cy="60" r="4" fill="currentColor" />
        {ticks.map((i) => {
          const a = (i / 12) * Math.PI * 2
          return <line key={i} x1={206 + Math.sin(a) * 28} y1={60 - Math.cos(a) * 28} x2={206 + Math.sin(a) * 34} y2={60 - Math.cos(a) * 34} />
        })}
        <polygon points="206,60 212,36 200,36" fill="var(--text-red-600)" stroke="none" />
      </g>
      <g fontSize="9.5" fill="currentColor">
        <text x="206" y="112" textAnchor="middle" fontWeight="600">
          the date wheel
        </text>
        <text x="206" y="124" textAnchor="middle" fill="var(--text-muted)" fontSize="9">
          the month and year it was made
        </text>
        <text x="206" y="136" textAnchor="middle" fill="var(--text-muted)" fontSize="9">
          replace the shell 5 years on
        </text>
        <text x="76" y="112" textAnchor="middle" fontWeight="600">
          the stamp inside
        </text>
        <text x="76" y="124" textAnchor="middle" fill="var(--text-muted)" fontSize="9">
          Type 1 covers the top
        </text>
        <text x="76" y="135" textAnchor="middle" fill="var(--text-muted)" fontSize="9">
          Type 2 the top and sides
        </text>
        <text x="76" y="149" textAnchor="middle" fill="var(--text-muted)" fontSize="9">
          Class C no electrical
        </text>
        <text x="76" y="160" textAnchor="middle" fill="var(--text-muted)" fontSize="9">
          G 2,200 V · E 20,000 V
        </text>
        <text x="18" y="24" fill="var(--text-muted)" fontSize="9">the gap under the shell</text>
        <text x="18" y="35" fill="var(--text-muted)" fontSize="9">takes the blow</text>
      </g>
    </svg>
  )
}
