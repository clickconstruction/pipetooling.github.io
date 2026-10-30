import type { FigureProps } from './figureProps'

/**
 * A trench wall showing the six warning signs of a cave-in (punch list #116): bulging, cracks parallel to the
 * edge, boiling, heaving, slumping and sliding. Lesson 20; lesson 10 names it too.
 */
export function CaveInSigns({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 198" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 40 H70 V150 H230 V40 H294" fill="var(--bg-subtle)" />
        <path d="M70 70 c14 10 14 30 0 40" stroke="var(--text-red-700)" strokeWidth="2.5" />
        <path d="M100 40 v10 M112 40 v14 M124 40 v9" stroke="var(--text-red-700)" strokeWidth="1.5" />
        <path d="M18 34 h40 M22 30 h30" stroke="var(--text-red-700)" strokeWidth="1.5" />
        <circle cx="110" cy="142" r="3" stroke="var(--text-red-700)" strokeWidth="1.5" />
        <circle cx="122" cy="146" r="2.5" stroke="var(--text-red-700)" strokeWidth="1.5" />
        <circle cx="134" cy="141" r="3" stroke="var(--text-red-700)" strokeWidth="1.5" />
        <path d="M150 150 c10 -14 30 -14 40 0" stroke="var(--text-red-700)" strokeWidth="2.5" />
        <path d="M230 90 c-14 6 -26 20 -30 40" stroke="var(--text-red-700)" strokeWidth="2.5" strokeDasharray="4 3" />
        <path d="M230 50 l-18 24" stroke="var(--text-red-700)" strokeWidth="2.5" />
        <path d="M212 74 l-4 -8 M212 74 l8 -2" stroke="var(--text-red-700)" strokeWidth="2" />
      </g>
      <g fontSize="9" fill="var(--text-red-800)">
        <text x="74" y="62">bulging</text>
        <text x="96" y="30" textAnchor="start">cracks along the edge</text>
        <text x="6" y="22">cracks on top</text>
        <text x="104" y="166">boiling</text>
        <text x="170" y="136" textAnchor="middle">heaving</text>
        <text x="166" y="104">slumping</text>
        <text x="236" y="62">sliding</text>
      </g>
      <text x="6" y="180" fontSize="9.5" fill="var(--text-muted)">
        on any one of these, or seeping water, everybody out
      </text>
      <text x="6" y="192" fontSize="9.5" fill="var(--text-muted)">
        until the wall is reinforced
      </text>
    </svg>
  )
}
