import type { FigureProps } from './figureProps'

/**
 * The three confined-space roles in place and the rescue order (punch list #116): the entrant inside on a line,
 * the attendant at the opening with the monitor and no other duty, the supervisor with the permit; self, then the
 * tripod, then the rescue service. Lesson 26.
 */
export function ConfinedSpaceRoles({ titleId }: FigureProps) {
  const person = (x: number, y: number) => (
    <>
      <circle cx={x} cy={y} r="6" fill="var(--surface)" />
      <line x1={x} y1={y + 6} x2={x} y2={y + 26} />
      <line x1={x} y1={y + 26} x2={x - 6} y2={y + 44} />
      <line x1={x} y1={y + 26} x2={x + 6} y2={y + 44} />
      <line x1={x} y1={y + 12} x2={x - 9} y2={y + 22} />
      <line x1={x} y1={y + 12} x2={x + 9} y2={y + 22} />
    </>
  )
  return (
    <svg viewBox="0 0 300 226" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="92" x2="110" y2="92" strokeWidth="3" />
        <line x1="150" y1="92" x2="296" y2="92" strokeWidth="3" />
        <path d="M110 92 V182 H150 V92" fill="var(--bg-subtle)" />
        <polyline points="104,92 130,46 156,92" strokeWidth="2.5" />
        <line x1="130" y1="46" x2="130" y2="130" strokeDasharray="3 3" />
        {person(130, 136)}
        {person(84, 48)}
        <rect x="94" y="68" width="10" height="7" fill="var(--bg-green-100)" stroke="#15803d" strokeWidth="1" />
        {person(224, 48)}
        <rect x="236" y="60" width="14" height="18" fill="var(--surface)" strokeWidth="1" />
        <line x1="239" y1="65" x2="247" y2="65" strokeWidth="1" />
        <line x1="239" y1="70" x2="247" y2="70" strokeWidth="1" />
      </g>
      <g fontSize="9" fill="currentColor" textAnchor="middle">
        <text x="130" y="198" fontWeight="600">the entrant</text>
        <text x="130" y="209" fill="var(--text-muted)" fontSize="8">works, reports, leaves on any order</text>
        <text x="64" y="16" fontWeight="600">the attendant</text>
        <text x="64" y="27" fill="var(--text-muted)" fontSize="8">outside, counting,</text>
        <text x="64" y="37" fill="var(--text-muted)" fontSize="8">monitoring the air</text>
        <text x="224" y="16" fontWeight="600">the entry supervisor</text>
        <text x="224" y="27" fill="var(--text-muted)" fontSize="8">signs the permit,</text>
        <text x="224" y="37" fill="var(--text-muted)" fontSize="8">checks rescue is ready</text>
      </g>
      <g fontSize="8.5">
        <text x="166" y="116" fill="#15803d" fontWeight="600">rescue order</text>
        <text x="166" y="128" fill="currentColor">1 the entrant gets out</text>
        <text x="166" y="140" fill="currentColor">2 the attendant hoists</text>
        <text x="166" y="152" fill="currentColor">3 the rescue service</text>
        <text x="166" y="168" fill="#991b1b" fontWeight="600">coworkers never go in</text>
        <text x="4" y="116" fill="var(--text-muted)" fontSize="8">the tripod</text>
        <text x="4" y="126" fill="var(--text-muted)" fontSize="8">and winch</text>
      </g>
      <text x="4" y="222" fontSize="8.5" fill="var(--text-muted)">
        the attendant talks to the entrants and does nothing else, not even traffic
      </text>
    </svg>
  )
}
