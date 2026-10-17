import type { FigureProps } from './figureProps'

/**
 * The lifting zone on a body (punch list #116): mid-thigh to mid-chest, and the three work heights around the
 * elbow, precision 4 in above, light just below, heavy 4 to 6 in below. Lesson 21; lesson 27 names it too.
 */
export function LiftingZone({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 236" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <rect x="66" y="84" width="128" height="78" rx="6" fill="var(--bg-green-100)" stroke="#15803d" strokeWidth="1" />
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="130" cy="28" r="13" fill="var(--surface)" />
        <path d="M103 56 H157 L163 130 H97 Z" fill="var(--surface)" />
        <line x1="103" y1="58" x2="85" y2="100" />
        <line x1="85" y1="100" x2="83" y2="140" />
        <line x1="157" y1="58" x2="175" y2="100" />
        <line x1="175" y1="100" x2="177" y2="140" />
        <line x1="109" y1="130" x2="105" y2="220" />
        <line x1="151" y1="130" x2="155" y2="220" />
        <line x1="97" y1="220" x2="115" y2="220" />
        <line x1="147" y1="220" x2="165" y2="220" />
        <circle cx="175" cy="100" r="3" fill="currentColor" />
      </g>
      <g stroke="var(--text-muted)" strokeWidth="1">
        <line x1="186" y1="89" x2="196" y2="89" />
        <line x1="186" y1="100" x2="196" y2="100" />
        <line x1="186" y1="104" x2="196" y2="104" />
        <line x1="186" y1="113" x2="196" y2="113" />
      </g>
      <g fontSize="9.5" fill="currentColor">
        <text x="6" y="92" fill="#15803d">mid-chest</text>
        <text x="6" y="164" fill="#15803d">mid-thigh</text>
        <text x="200" y="80">precision work</text>
        <text x="200" y="91">4 in above the elbow</text>
        <text x="200" y="104" fontWeight="600">the elbow</text>
        <text x="200" y="117" fill="var(--text-muted)">light · just below it</text>
        <text x="200" y="130" fontSize="9">heavy · 4 to 6 in below it</text>
      </g>
    </svg>
  )
}
