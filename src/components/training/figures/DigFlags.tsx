import type { FigureProps } from './figureProps'

/** The three underground flags, yellow gas, blue water, red electric, and the double-insulated symbol (punch list #116). Lesson 9. */
export function DigFlags({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 122" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="1.5">
        <line x1="30" y1="8" x2="30" y2="80" />
        <path d="M30 8 h30 v18 h-30z" fill="#facc15" />
        <line x1="110" y1="8" x2="110" y2="80" />
        <path d="M110 8 h30 v18 h-30z" fill="#2563eb" />
        <line x1="190" y1="8" x2="190" y2="80" />
        <path d="M190 8 h30 v18 h-30z" fill="#dc2626" />
        <rect x="252" y="18" width="40" height="40" rx="3" fill="none" strokeWidth="2" />
        <rect x="261" y="27" width="22" height="22" rx="2" fill="none" strokeWidth="2" />
        <line x1="6" y1="80" x2="230" y2="80" strokeWidth="2" />
      </g>
      <g fontSize="9.5" fill="currentColor">
        <text x="30" y="94">gas or oil</text>
        <text x="110" y="94">water</text>
        <text x="190" y="94">electric</text>
        <text x="272" y="72" fill="var(--text-muted)" textAnchor="middle">double</text>
        <text x="272" y="84" fill="var(--text-muted)" textAnchor="middle">insulated</text>
        <text x="6" y="107" fill="var(--text-muted)" fontSize="9">the employer calls 811 before the dig;</text>
        <text x="6" y="118" fill="var(--text-muted)" fontSize="9">you check the marks and hand-dig within 3 ft of a flag</text>
      </g>
    </svg>
  )
}
