import type { FigureProps } from './figureProps'

/**
 * A tip-over (punch list #116, redrawn v2.5609): a machine going over to the right. Left, the operator sits
 * under the cage, belted, hands on the wheel, leaning to the high side. Right, the seat is empty, the operator
 * is out on the low side, and the cage's edge is coming down on them. Lesson 10.
 */
export function TipOver({ titleId }: FigureProps) {
  const machine = (x: number) => (
    <g transform={`translate(${x} 22) rotate(14 50 86)`}>
      <rect x="0" y="50" width="100" height="30" rx="4" fill="var(--bg-amber-100)" />
      <circle cx="22" cy="86" r="12" fill="var(--bg-subtle)" />
      <circle cx="78" cy="86" r="12" fill="var(--bg-subtle)" />
      <rect x="32" y="8" width="36" height="42" rx="3" fill="var(--surface)" strokeWidth="3" />
      <path d="M44 46 v-12 h12" strokeWidth="2.5" />
      <circle cx="62" cy="26" r="5" fill="none" strokeWidth="2" />
    </g>
  )
  return (
    <svg viewBox="0 0 300 184" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="128" x2="296" y2="128" strokeWidth="3" />
        {machine(16)}
        <g transform="translate(16 22) rotate(14 50 86)">
          <circle cx="46" cy="18" r="4.5" fill="var(--surface)" />
          <line x1="47" y1="22.5" x2="49" y2="35" />
          <line x1="49" y1="35" x2="58" y2="35" />
          <line x1="58" y1="35" x2="60" y2="48" />
          <line x1="48" y1="26" x2="58" y2="27" />
          <line x1="48" y1="28" x2="58" y2="29" />
          <line x1="44" y1="24" x2="53" y2="36" stroke="var(--text-green-700)" strokeWidth="3" />
        </g>
        {machine(170)}
        <circle cx="287" cy="86" r="5" fill="var(--surface)" />
        <line x1="285" y1="91" x2="280" y2="106" />
        <line x1="280" y1="106" x2="272" y2="120" />
        <line x1="280" y1="106" x2="288" y2="122" />
        <line x1="284" y1="96" x2="296" y2="102" />
        <line x1="284" y1="96" x2="274" y2="94" />
        <path d="M258 40 c12 8 20 20 24 36" stroke="var(--text-red-600)" strokeWidth="2.5" strokeDasharray="4 3" />
        <polygon points="282,80 277,72 287,72" fill="var(--text-red-600)" stroke="none" />
      </g>
      <g fontSize="10" fontWeight="700" textAnchor="middle">
        <text x="66" y="14" fill="var(--text-green-700)">stay in, belted</text>
        <text x="220" y="14" fill="var(--text-red-800)">never jump</text>
      </g>
      <g fontSize="8.5" fill="var(--text-muted)" textAnchor="middle">
        <text x="70" y="146">grip the wheel, lean away</text>
        <text x="70" y="157">the cage takes the ground</text>
        <text x="226" y="146">the cage lands where you land</text>
        <text x="226" y="157">that is how the jump kills</text>
      </g>
      <text x="150" y="178" fontSize="8.5" fill="var(--text-muted)" textAnchor="middle">
        ROPS, the cage, on every machine on any ground
      </text>
    </svg>
  )
}
