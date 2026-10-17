import type { FigureProps } from './figureProps'

/** Three points of contact on a ladder, and the climb that is not (punch list #116). Lesson 17. */
export function ThreePoints({ titleId }: FigureProps) {
  const ladder = (x: number) => (
    <>
      <line x1={x} y1="10" x2={x} y2="150" />
      <line x1={x + 34} y1="10" x2={x + 34} y2="150" />
      {[22, 42, 62, 82, 102, 122, 142].map((y) => (
        <line key={y} x1={x} y1={y} x2={x + 34} y2={y} strokeWidth="1.5" />
      ))}
    </>
  )
  return (
    <svg viewBox="0 0 300 192" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {ladder(40)}
        <circle cx="90" cy="56" r="7" fill="var(--surface)" />
        <line x1="90" y1="63" x2="88" y2="98" />
        <line x1="88" y1="70" x2="74" y2="42" />
        <line x1="88" y1="74" x2="74" y2="62" />
        <line x1="88" y1="98" x2="74" y2="102" />
        <line x1="88" y1="98" x2="80" y2="128" />
        <circle cx="74" cy="42" r="4" fill="#15803d" stroke="none" />
        <circle cx="74" cy="62" r="4" fill="#15803d" stroke="none" />
        <circle cx="74" cy="102" r="4" fill="#15803d" stroke="none" />
        <circle cx="80" cy="128" r="4" fill="none" stroke="#15803d" />
        <line x1="92" y1="30" x2="92" y2="12" stroke="#15803d" strokeDasharray="2 2" />
        <rect x="88" y="4" width="8" height="8" fill="var(--bg-amber-100)" stroke="#15803d" strokeWidth="1" />
        {ladder(176)}
        <circle cx="226" cy="56" r="7" fill="var(--surface)" />
        <line x1="226" y1="63" x2="224" y2="98" />
        <line x1="224" y1="70" x2="210" y2="42" />
        <line x1="224" y1="74" x2="242" y2="82" />
        <rect x="238" y="78" width="10" height="10" fill="var(--bg-amber-100)" stroke="#b91c1c" strokeWidth="1" />
        <line x1="224" y1="98" x2="210" y2="102" />
        <line x1="224" y1="98" x2="216" y2="128" />
        <circle cx="210" cy="42" r="4" fill="#15803d" stroke="none" />
        <circle cx="210" cy="102" r="4" fill="#15803d" stroke="none" />
        <circle cx="216" cy="128" r="4" fill="none" stroke="#15803d" />
      </g>
      <g fontSize="10" fontWeight="700" textAnchor="middle">
        <text x="136" y="60" fill="#15803d">three</text>
        <text x="136" y="72" fill="#15803d">on the ladder</text>
        <text x="270" y="60" fill="#991b1b">two</text>
        <text x="270" y="72" fill="#991b1b">not enough</text>
      </g>
      <g fontSize="9" fill="var(--text-muted)" textAnchor="middle">
        <text x="80" y="170">two hands and a foot</text>
        <text x="80" y="181">while the other foot moves</text>
        <text x="220" y="170">a hand on a tool</text>
        <text x="220" y="181">is a hand off the ladder</text>
      </g>
      <text x="100" y="22" fontSize="8" fill="#15803d">
        the tool on a rope
      </text>
    </svg>
  )
}
