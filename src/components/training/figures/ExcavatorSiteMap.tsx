import type { FigureProps } from './figureProps'

/**
 * The capstone site from above (punch list #116): the trench, the excavator and its swing radius, the pipe over
 * the trench, and the four decisions placed where they happen, with the legend under the map. Lesson 30.
 */
export function ExcavatorSiteMap({ titleId }: FigureProps) {
  const mark = (x: number, y: number, n: string) => (
    <g>
      <circle cx={x} cy={y} r="9" fill="#2563eb" />
      <text x={x} y={y + 4} fontSize="10" fontWeight="700" fill="#fff" textAnchor="middle">
        {n}
      </text>
    </g>
  )
  return (
    <svg viewBox="0 0 300 320" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <rect x="10" y="150" width="280" height="36" fill="var(--bg-subtle)" />
        <circle cx="160" cy="88" r="78" stroke="#dc2626" strokeDasharray="6 4" strokeWidth="2" />
        <rect x="142" y="58" width="12" height="56" rx="3" fill="var(--bg-subtle)" />
        <rect x="166" y="58" width="12" height="56" rx="3" fill="var(--bg-subtle)" />
        <rect x="148" y="68" width="24" height="32" rx="4" fill="var(--surface)" strokeWidth="2" />
        <line x1="160" y1="98" x2="160" y2="130" strokeWidth="4" />
        <line x1="160" y1="130" x2="166" y2="150" strokeWidth="4" />
        <line x1="140" y1="168" x2="192" y2="168" strokeWidth="5" />
        <line x1="166" y1="150" x2="166" y2="168" strokeDasharray="2 2" />
        <circle cx="34" cy="128" r="6" fill="var(--surface)" strokeWidth="2" />
        <line x1="34" y1="134" x2="34" y2="150" />
        <polyline points="34,150 29,160" />
        <polyline points="34,150 39,160" />
        <line x1="40" y1="140" x2="70" y2="172" stroke="#15803d" strokeWidth="1.5" />
      </g>
      {mark(126, 116, '1')}
      {mark(160, 46, '2')}
      {mark(178, 136, '3')}
      {mark(206, 160, '4')}
      <g fontSize="9.5" fill="currentColor">
        <text x="8" y="96" fill="var(--text-muted)">you,</text>
        <text x="8" y="107" fill="var(--text-muted)">outside</text>
        <text x="8" y="118" fill="var(--text-muted)">the rope</text>
        <text x="74" y="181" fill="#15803d" fontSize="9">a tag line</text>
        <text x="206" y="181" fill="var(--text-muted)">the pipe</text>
        <text x="14" y="181" fill="var(--text-muted)" fontSize="9">the trench</text>
        <text x="12" y="206" fontWeight="600">1</text>
        <text x="22" y="206">no untrained spotter: stop the work</text>
        <text x="12" y="220" fontWeight="600">2</text>
        <text x="22" y="220">inspect the machine, get the manual on site</text>
        <text x="12" y="234" fontWeight="600">3</text>
        <text x="22" y="234">the maker's connection test on the coupler</text>
        <text x="12" y="248" fontWeight="600">4</text>
        <text x="22" y="248">tag lines on the pipe, nobody under it</text>
        <text x="12" y="270">What happens: the operator swaps the bucket back on.</text>
        <text x="12" y="284">It drops off the coupler. Outside the circle, you are safe.</text>
        <text x="12" y="302" fill="var(--text-muted)">What really happened: nobody inspected, nobody was named,</text>
        <text x="12" y="316" fill="var(--text-muted)">and a worker stood under the load.</text>
      </g>
    </svg>
  )
}
