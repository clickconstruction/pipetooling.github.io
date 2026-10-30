import type { FigureProps } from './figureProps'

/**
 * The lift in four frames (punch list #116, redrawn v2.5609 with bigger figures and motion arrows): plan the
 * weight and the route, squat with a straight back and hold it close, carry without twisting, squat again to
 * set it down. Lesson 21.
 */
export function LiftSteps({ titleId }: FigureProps) {
  const frame = (i: number, title: string, sub: string, subColor: string, body: JSX.Element) => (
    <g key={title} transform={`translate(${2 + i * 74} 0)`}>
      <rect x="0" y="2" width="70" height="140" rx="6" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <text x="35" y="16" fontSize="9" fontWeight="600" fill="currentColor" textAnchor="middle">
        {title}
      </text>
      <text x="35" y="26" fontSize="7" fill={subColor} textAnchor="middle">
        {sub}
      </text>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="128" x2="64" y2="128" strokeWidth="1.5" stroke="var(--text-muted)" />
        {body}
      </g>
    </g>
  )
  return (
    <svg viewBox="0 0 300 170" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      {frame(0, '1 plan', 'weight and route', 'var(--text-muted)', (
        <>
          <circle cx="20" cy="40" r="7" fill="var(--surface)" />
          <line x1="20" y1="47" x2="20" y2="88" />
          <line x1="20" y1="88" x2="12" y2="128" />
          <line x1="20" y1="88" x2="28" y2="128" />
          <line x1="20" y1="60" x2="38" y2="100" />
          <rect x="38" y="104" width="20" height="24" fill="var(--bg-amber-100)" />
          <text x="48" y="119" fontSize="7" stroke="none" fill="currentColor" textAnchor="middle">? lb</text>
          <path d="M60 108 q9 -18 6 -40" stroke="var(--text-muted)" strokeDasharray="3 2" strokeWidth="1.5" />
          <polygon points="66,64 62,70 69,70" fill="var(--text-muted)" stroke="none" />
          <text x="58" y="60" fontSize="7" stroke="none" fill="var(--text-muted)" textAnchor="middle">route</text>
        </>
      ))}
      {frame(1, '2 squat', 'hold it close', 'var(--text-green-700)', (
        <>
          <circle cx="30" cy="56" r="7" fill="var(--surface)" />
          <line x1="30" y1="63" x2="26" y2="94" />
          <line x1="26" y1="94" x2="42" y2="110" />
          <line x1="42" y1="110" x2="30" y2="128" />
          <line x1="28" y1="70" x2="42" y2="92" />
          <rect x="36" y="88" width="20" height="20" fill="var(--bg-amber-100)" />
          <line x1="20" y1="60" x2="16" y2="96" stroke="var(--text-green-700)" strokeWidth="2.5" />
          <text x="16" y="106" fontSize="7" stroke="none" fill="var(--text-green-700)" textAnchor="middle">straight</text>
          <text x="16" y="114" fontSize="7" stroke="none" fill="var(--text-green-700)" textAnchor="middle">back</text>
          <line x1="62" y1="100" x2="62" y2="78" stroke="var(--text-green-700)" strokeWidth="2" />
          <polygon points="62,74 58,80 66,80" fill="var(--text-green-700)" stroke="none" />
        </>
      ))}
      {frame(2, '3 carry', 'no twist', 'var(--text-red-700)', (
        <>
          <circle cx="28" cy="40" r="7" fill="var(--surface)" />
          <line x1="28" y1="47" x2="28" y2="88" />
          <line x1="28" y1="88" x2="18" y2="128" />
          <line x1="28" y1="88" x2="40" y2="126" />
          <line x1="28" y1="56" x2="50" y2="64" />
          <line x1="28" y1="62" x2="50" y2="74" />
          <rect x="30" y="58" width="20" height="20" fill="var(--bg-amber-100)" />
          <path d="M12 78 a6 6 0 1 1 -6 6" stroke="var(--text-red-700)" strokeWidth="1.5" />
          <polygon points="6,80 3,86 9,86" fill="var(--text-red-700)" stroke="none" />
          <line x1="4" y1="92" x2="20" y2="76" stroke="var(--text-red-700)" strokeWidth="1.5" />
          <line x1="46" y1="118" x2="60" y2="118" stroke="var(--text-green-700)" strokeWidth="2" />
          <polygon points="65,118 59,114 59,122" fill="var(--text-green-700)" stroke="none" />
        </>
      ))}
      {frame(3, '4 set down', 'squat again', 'var(--text-muted)', (
        <>
          <circle cx="30" cy="56" r="7" fill="var(--surface)" />
          <line x1="30" y1="63" x2="26" y2="94" />
          <line x1="26" y1="94" x2="42" y2="110" />
          <line x1="42" y1="110" x2="30" y2="128" />
          <line x1="28" y1="70" x2="46" y2="106" />
          <rect x="44" y="108" width="20" height="20" fill="var(--bg-amber-100)" />
          <line x1="14" y1="76" x2="14" y2="96" stroke="var(--text-green-700)" strokeWidth="2" />
          <polygon points="14,100 10,94 18,94" fill="var(--text-green-700)" stroke="none" />
        </>
      ))}
      <g fontSize="8.5" fill="var(--text-muted)">
        <text x="4" y="155">over 50 lb: a second person or a machine,</text>
        <text x="4" y="166">and count the lift off together</text>
      </g>
    </svg>
  )
}
