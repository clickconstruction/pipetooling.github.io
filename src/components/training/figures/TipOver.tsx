import type { FigureProps } from './figureProps'

/** A tip-over (punch list #116): belted, gripping the wheel, leaning away from the fall under the cage, beside the jump that kills. Lesson 10. */
export function TipOver({ titleId }: FigureProps) {
  const machine = (x: number, y: number, rot: number) => (
    <g transform={`rotate(${rot} ${x + 50} ${y + 60})`}>
      <rect x={x} y={y + 30} width="100" height="30" rx="4" fill="var(--bg-amber-100)" />
      <circle cx={x + 22} cy={y + 64} r="12" fill="var(--bg-subtle)" />
      <circle cx={x + 78} cy={y + 64} r="12" fill="var(--bg-subtle)" />
      <path d={`M${x + 34} ${y + 30} v-30 h32 v30`} strokeWidth="3" />
      <line x1={x + 34} y1={y} x2={x + 66} y2={y} strokeWidth="3" />
    </g>
  )
  return (
    <svg viewBox="0 0 300 182" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="130" x2="296" y2="130" strokeWidth="3" />
        {machine(18, 40, -18)}
        <g transform="rotate(-18 68 100)">
          <circle cx="56" cy="52" r="6" fill="var(--surface)" />
          <line x1="56" y1="58" x2="52" y2="78" />
          <line x1="54" y1="64" x2="44" y2="70" />
          <line x1="54" y1="64" x2="46" y2="76" />
          <circle cx="42" cy="72" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="48" y1="70" x2="58" y2="72" stroke="#15803d" strokeWidth="3" />
        </g>
        {machine(176, 40, -18)}
        <g transform="rotate(-18 226 100)">
          <circle cx="232" cy="26" r="6" fill="var(--surface)" />
          <line x1="232" y1="32" x2="240" y2="52" />
          <line x1="234" y1="40" x2="246" y2="30" />
          <line x1="234" y1="40" x2="222" y2="34" />
          <line x1="240" y1="52" x2="250" y2="64" />
          <line x1="240" y1="52" x2="232" y2="66" />
        </g>
      </g>
      <g fontSize="10" fontWeight="700" textAnchor="middle">
        <text x="68" y="18" fill="#15803d">stay in, belted</text>
        <text x="226" y="18" fill="#991b1b">never jump</text>
      </g>
      <g fontSize="8.5" fill="var(--text-muted)" textAnchor="middle">
        <text x="76" y="148">grip the wheel, lean away</text>
        <text x="76" y="159">the cage takes the ground</text>
        <text x="222" y="148">the cage lands where you land</text>
        <text x="222" y="159">that is how the jump kills</text>
      </g>
      <text x="150" y="176" fontSize="8.5" fill="var(--text-muted)" textAnchor="middle">
        ROPS, the cage, on every machine on any ground
      </text>
    </svg>
  )
}
