import type { FigureProps } from './figureProps'

/** PASS in four frames, pull, aim at the base, squeeze, sweep, from 6 to 8 ft (punch list #116). Lesson 25. */
export function PassSteps({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 126" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round">
        <rect x="2" y="2" width="70" height="100" rx="6" fill="var(--surface)" />
        <rect x="76" y="2" width="70" height="100" rx="6" fill="var(--surface)" />
        <rect x="150" y="2" width="70" height="100" rx="6" fill="var(--surface)" />
        <rect x="224" y="2" width="70" height="100" rx="6" fill="var(--surface)" />
        <rect x="30" y="64" width="14" height="30" rx="4" fill="var(--bg-red-100)" />
        <circle cx="46" cy="60" r="4" fill="var(--surface)" />
        <line x1="50" y1="60" x2="62" y2="54" />
        <polygon points="64,53 58,51 60,57" fill="currentColor" stroke="none" />
        <rect x="96" y="64" width="14" height="30" rx="4" fill="var(--bg-red-100)" />
        <line x1="110" y1="66" x2="130" y2="88" />
        <path d="M130 96 c2 -6 6 -8 6 -12 c2 4 4 6 4 10 a5 5 0 0 1 -10 2z" fill="#f97316" stroke="none" />
        <line x1="124" y1="98" x2="142" y2="98" strokeWidth="2" />
        <rect x="188" y="64" width="14" height="30" rx="4" fill="var(--bg-red-100)" />
        <path d="M196 60 q10 -6 14 2" strokeWidth="3" />
        <path d="M206 54 l6 -8" strokeWidth="2" />
        <rect x="252" y="64" width="14" height="30" rx="4" fill="var(--bg-red-100)" />
        <path d="M240 98 q26 -10 52 0" strokeWidth="2" />
        <polygon points="238,98 244,94 244,102" fill="currentColor" stroke="none" />
        <polygon points="294,98 288,94 288,102" fill="currentColor" stroke="none" />
      </g>
      <g fontSize="22" fontWeight="700" fill="currentColor">
        <text x="12" y="30">P</text>
        <text x="86" y="30">A</text>
        <text x="160" y="30">S</text>
        <text x="234" y="30">S</text>
      </g>
      <g fontSize="8.5" fill="var(--text-muted)">
        <text x="10" y="44">pull</text>
        <text x="10" y="55">the pin</text>
        <text x="84" y="44">aim at</text>
        <text x="84" y="55">the base</text>
        <text x="158" y="44">squeeze</text>
        <text x="158" y="55">the handle</text>
        <text x="232" y="44">sweep</text>
        <text x="232" y="55">side to side</text>
      </g>
      <text x="4" y="118" fontSize="9.5" fill="var(--text-muted)">
        from 6 to 8 ft away; if the fire does not shrink at once, get out
      </text>
    </svg>
  )
}
