import type { FigureProps } from './figureProps'

/**
 * A forklift's load center (punch list #116): from the fork backrest to the load's center of gravity, 24 in for
 * the rating; a load out at the tips tips the truck; keep the load low. Lesson 24.
 */
export function ForkliftLoadCenter({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 220" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="176" x2="294" y2="176" strokeWidth="3" />
        <path d="M30 150 V96 H60 L74 68 H110 V150 Z" fill="var(--bg-amber-100)" />
        <rect x="80" y="76" width="22" height="22" rx="3" fill="var(--surface)" />
        <circle cx="52" cy="160" r="14" fill="var(--bg-subtle)" />
        <circle cx="118" cy="160" r="14" fill="var(--bg-subtle)" />
        <line x1="138" y1="40" x2="138" y2="176" strokeWidth="4" />
        <line x1="146" y1="40" x2="146" y2="176" strokeWidth="2" />
        <line x1="146" y1="136" x2="230" y2="136" strokeWidth="4" />
        <rect x="150" y="92" width="60" height="44" fill="var(--bg-blue-tint)" />
        <circle cx="174" cy="114" r="4" fill="var(--text-red-600)" stroke="none" />
      </g>
      <g stroke="var(--text-muted)" strokeWidth="1" fill="none">
        <line x1="146" y1="50" x2="174" y2="50" />
        <line x1="146" y1="46" x2="146" y2="54" />
        <line x1="174" y1="46" x2="174" y2="54" />
        <line x1="174" y1="54" x2="174" y2="108" strokeDasharray="2 3" />
      </g>
      <g fontSize="10" fill="currentColor">
        <text x="150" y="40" fill="var(--text-muted)" fontSize="9.5">load center · 24 in</text>
        <text x="216" y="110" fontSize="9.5">its weight</text>
        <text x="216" y="122" fontSize="9.5">sits here</text>
        <text x="236" y="152" fill="var(--text-red-800)" fontSize="9.5">out at the tips,</text>
        <text x="236" y="164" fill="var(--text-red-800)" fontSize="9.5">the truck tips</text>
        <text x="6" y="196" fill="var(--text-muted)" fontSize="9.5">the rating assumes 24 in; keep the load low while you move</text>
        <text x="6" y="210" fill="var(--text-muted)" fontSize="9.5">an empty truck is top-heavy too, so no speeding up after a drop</text>
      </g>
    </svg>
  )
}
