import type { FigureProps } from './figureProps'

/** The lift in five frames (punch list #116): plan, squat with a straight back, hold it close, move without twisting, set down. Lesson 21. */
export function LiftSteps({ titleId }: FigureProps) {
  const frame = (i: number, title: string, body: JSX.Element) => (
    <g key={title} transform={`translate(${2 + i * 60} 0)`}>
      <rect x="0" y="2" width="56" height="118" rx="6" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <text x="28" y="16" fontSize="9" fontWeight="600" fill="currentColor" textAnchor="middle">
        {title}
      </text>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {body}
      </g>
    </g>
  )
  return (
    <svg viewBox="0 0 300 140" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      {frame(0, '1 plan', (
        <>
          <circle cx="20" cy="36" r="6" fill="var(--surface)" />
          <line x1="20" y1="42" x2="20" y2="74" />
          <line x1="20" y1="74" x2="14" y2="104" />
          <line x1="20" y1="74" x2="26" y2="104" />
          <line x1="20" y1="50" x2="32" y2="60" />
          <rect x="34" y="84" width="16" height="16" fill="var(--bg-amber-100)" />
          <path d="M36 72 l8 -8 l8 8" strokeDasharray="2 2" />
        </>
      ))}
      {frame(1, '2 squat', (
        <>
          <circle cx="26" cy="48" r="6" fill="var(--surface)" />
          <line x1="26" y1="54" x2="22" y2="80" />
          <line x1="22" y1="80" x2="34" y2="92" />
          <line x1="34" y1="92" x2="24" y2="104" />
          <line x1="24" y1="60" x2="36" y2="80" />
          <rect x="30" y="80" width="16" height="16" fill="var(--bg-amber-100)" />
          <text x="28" y="114" fontSize="7" stroke="none" fill="#15803d" textAnchor="middle">straight back</text>
        </>
      ))}
      {frame(2, '3 hold close', (
        <>
          <circle cx="24" cy="36" r="6" fill="var(--surface)" />
          <line x1="24" y1="42" x2="24" y2="74" />
          <line x1="24" y1="74" x2="18" y2="104" />
          <line x1="24" y1="74" x2="30" y2="104" />
          <rect x="26" y="52" width="16" height="16" fill="var(--bg-amber-100)" />
          <line x1="24" y1="50" x2="42" y2="58" />
          <line x1="24" y1="56" x2="42" y2="66" />
        </>
      ))}
      {frame(3, '4 no twist', (
        <>
          <circle cx="24" cy="36" r="6" fill="var(--surface)" />
          <line x1="24" y1="42" x2="24" y2="74" />
          <line x1="24" y1="74" x2="16" y2="104" />
          <line x1="24" y1="74" x2="34" y2="102" />
          <rect x="26" y="52" width="16" height="16" fill="var(--bg-amber-100)" />
          <line x1="24" y1="50" x2="42" y2="58" />
          <path d="M6 24 q18 -12 36 0" stroke="#b91c1c" strokeWidth="1.5" />
          <line x1="12" y1="18" x2="36" y2="30" stroke="#b91c1c" strokeWidth="1.5" />
        </>
      ))}
      {frame(4, '5 set down', (
        <>
          <circle cx="26" cy="48" r="6" fill="var(--surface)" />
          <line x1="26" y1="54" x2="22" y2="80" />
          <line x1="22" y1="80" x2="34" y2="92" />
          <line x1="34" y1="92" x2="24" y2="104" />
          <line x1="24" y1="60" x2="38" y2="88" />
          <rect x="34" y="90" width="16" height="14" fill="var(--bg-amber-100)" />
        </>
      ))}
      <text x="4" y="134" fontSize="9" fill="var(--text-muted)">
        over 50 lb: a second person or a machine, and count the lift off together
      </text>
    </svg>
  )
}
