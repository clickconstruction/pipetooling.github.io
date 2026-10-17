import type { FigureProps } from './figureProps'

/** The nine HazCom pictograms, drawn simply and named (punch list #116). Lesson 14. */
export function HazcomPictograms({ titleId }: FigureProps) {
  const xs = [18, 51, 84, 117, 150, 183, 216, 249, 282]
  const names = ['flame', 'oxidizer', 'corrosion', 'skull', 'health', 'irritant', 'gas', 'explosive', 'nature']
  return (
    <svg viewBox="0 0 300 56" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="#dc2626" strokeWidth="1.5" fill="var(--surface)">
        {xs.map((x) => (
          <path key={x} d={`M${x} 4 L${x + 14} 18 L${x} 32 L${x - 14} 18 Z`} />
        ))}
      </g>
      <g fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <path d="M18 9 c3 4 5 6 5 10 a5 5 0 0 1 -10 0 c0 -3 2 -4 3 -6 c0 2 1 3 2 3 c0 -3 0 -5 0 -7z" stroke="none" />
        <path d="M51 8 c2 3 4 4 4 7 a4 4 0 0 1 -8 0 c0 -2 1 -3 2 -4 c0 1 1 2 2 2 c0 -2 0 -3 0 -5z" stroke="none" />
        <circle cx="51" cy="24" r="4" fill="none" />
        <line x1="78" y1="12" x2="84" y2="20" />
        <circle cx="86" cy="24" r="1.6" stroke="none" />
        <circle cx="90" cy="26" r="1.6" stroke="none" />
        <line x1="80" y1="27" x2="92" y2="27" />
        <circle cx="117" cy="15" r="5" fill="none" />
        <circle cx="115" cy="14" r="1" stroke="none" />
        <circle cx="119" cy="14" r="1" stroke="none" />
        <line x1="111" y1="22" x2="123" y2="27" />
        <line x1="123" y1="22" x2="111" y2="27" />
        <circle cx="150" cy="11" r="3" fill="none" />
        <line x1="150" y1="14" x2="150" y2="22" />
        <path d="M150 15 l5 4 l-5 4 l-5 -4 z" stroke="none" />
        <line x1="146" y1="26" x2="154" y2="26" />
        <text x="183" y="25" fontSize="16" fontWeight="700" textAnchor="middle" stroke="none">
          !
        </text>
        <rect x="212" y="10" width="8" height="16" rx="3" fill="none" />
        <line x1="216" y1="8" x2="216" y2="10" />
        <circle cx="249" cy="20" r="5" fill="none" />
        <line x1="249" y1="8" x2="249" y2="12" />
        <line x1="241" y1="12" x2="244" y2="15" />
        <line x1="257" y1="12" x2="254" y2="15" />
        <path d="M276 24 l4 -8 l4 8z" stroke="none" />
        <ellipse cx="288" cy="24" rx="4" ry="2" stroke="none" />
      </g>
      <g fontSize="7.5" fill="var(--text-muted)" textAnchor="middle">
        {xs.map((x, i) => (
          <text key={x} x={x} y="46">
            {names[i]}
          </text>
        ))}
      </g>
    </svg>
  )
}
