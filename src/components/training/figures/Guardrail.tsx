import type { FigureProps } from './figureProps'

/** A guardrail beside a person (punch list #116): top rail 42 in, midrail 21 in, toeboard 3.5 in. Lesson 8; lesson 18 names it too. */
export function Guardrail({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 200" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
        <line x1="10" y1="180" x2="290" y2="180" strokeWidth="3" />
        <line x1="70" y1="180" x2="70" y2="96" />
        <line x1="200" y1="180" x2="200" y2="96" />
        <line x1="60" y1="96" x2="210" y2="96" strokeWidth="4" />
        <line x1="60" y1="138" x2="210" y2="138" />
        <rect x="60" y="173" width="150" height="7" fill="var(--bg-amber-100)" strokeWidth="1" />
        <circle cx="250" cy="50" r="8" fill="var(--surface)" />
        <line x1="250" y1="58" x2="250" y2="128" />
        <polyline points="250,70 236,100" />
        <polyline points="250,70 264,100" />
        <polyline points="250,128 240,180" />
        <polyline points="250,128 260,180" />
      </g>
      <g stroke="var(--text-muted)" strokeWidth="1" fill="none">
        <line x1="34" y1="96" x2="34" y2="180" />
        <line x1="30" y1="96" x2="38" y2="96" />
        <line x1="30" y1="180" x2="38" y2="180" />
        <line x1="50" y1="138" x2="50" y2="180" />
        <line x1="46" y1="138" x2="54" y2="138" />
      </g>
      <g fontSize="10.5" fill="currentColor">
        <text x="78" y="90">top rail · 42 in</text>
        <text x="78" y="132">midrail · 21 in</text>
        <text x="78" y="170">toeboard · 3.5 in</text>
        <text x="26" y="150" fill="var(--text-muted)" fontSize="9.5" transform="rotate(-90 26 150)">42 in</text>
        <text x="232" y="196" fill="var(--text-muted)" fontSize="9.5">5 ft 9 in</text>
      </g>
    </svg>
  )
}
