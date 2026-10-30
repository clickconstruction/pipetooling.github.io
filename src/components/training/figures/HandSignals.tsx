import type { FigureProps } from './figureProps'

/**
 * The crane signal person's stop, raise and lower, and the flagger's stop and slow (punch list #116; v2.5609
 * drew the motions as arrows: the swing under the stop arm, the circles at the raised and lowered finger).
 * Lesson 22; lesson 24 names it too.
 */
export function HandSignals({ titleId }: FigureProps) {
  const person = (x: number, arms: JSX.Element) => (
    <g transform={`translate(${x} 0)`}>
      <circle cx="30" cy="34" r="7" fill="var(--surface)" />
      <line x1="30" y1="41" x2="30" y2="78" />
      <line x1="30" y1="78" x2="24" y2="106" />
      <line x1="30" y1="78" x2="36" y2="106" />
      {arms}
    </g>
  )
  return (
    <svg viewBox="0 0 300 184" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 12)">
        {person(6, (
          <>
            <line x1="30" y1="50" x2="4" y2="50" />
            <line x1="30" y1="50" x2="42" y2="70" />
            <line x1="0" y1="60" x2="20" y2="60" stroke="var(--text-red-600)" strokeWidth="2" />
            <polygon points="-4,60 2,56 2,64" fill="var(--text-red-600)" stroke="none" />
            <polygon points="24,60 18,56 18,64" fill="var(--text-red-600)" stroke="none" />
          </>
        ))}
        {person(60, (
          <>
            <line x1="30" y1="50" x2="44" y2="38" />
            <line x1="44" y1="38" x2="44" y2="20" />
            <line x1="30" y1="50" x2="18" y2="70" />
            <path d="M44 7 a7 7 0 1 1 -7 7" stroke="var(--text-green-700)" strokeWidth="2" />
            <polygon points="37,9 33,15 41,15" fill="var(--text-green-700)" stroke="none" />
          </>
        ))}
        {person(120, (
          <>
            <line x1="30" y1="50" x2="44" y2="62" />
            <line x1="44" y1="62" x2="44" y2="84" />
            <line x1="30" y1="50" x2="18" y2="70" />
            <path d="M44 83 a7 7 0 1 1 -7 7" stroke="var(--text-green-700)" strokeWidth="2" />
            <polygon points="37,85 33,91 41,91" fill="var(--text-green-700)" stroke="none" />
          </>
        ))}
        {person(190, (
          <>
            <line x1="30" y1="50" x2="46" y2="34" />
            <line x1="30" y1="50" x2="18" y2="70" />
            <polygon points="46,34 56,18 66,34 56,50" fill="#dc2626" stroke="currentColor" strokeWidth="1" />
          </>
        ))}
        {person(240, (
          <>
            <line x1="30" y1="50" x2="46" y2="34" />
            <line x1="30" y1="50" x2="18" y2="70" />
            <rect x="44" y="18" width="12" height="32" rx="2" fill="#f97316" stroke="currentColor" strokeWidth="1" />
          </>
        ))}
      </g>
      <g fontSize="8.5" fontWeight="600" fill="currentColor" textAnchor="middle">
        <text x="36" y="136">stop</text>
        <text x="90" y="136">raise the load</text>
        <text x="150" y="136">lower the load</text>
        <text x="218" y="136">STOP</text>
        <text x="270" y="136">SLOW</text>
      </g>
      <g fontSize="7" fill="var(--text-muted)" textAnchor="middle">
        <text x="36" y="146">arm out</text>
        <text x="36" y="155">palm down</text>
        <text x="36" y="164">swung sideways</text>
        <text x="90" y="146">forearm up</text>
        <text x="90" y="155">finger up</text>
        <text x="90" y="164">small circles</text>
        <text x="150" y="146">arm down</text>
        <text x="150" y="155">finger down</text>
        <text x="150" y="164">small circles</text>
        <text x="244" y="146">the flagger's paddle</text>
      </g>
      <text x="4" y="180" fontSize="9" fill="var(--text-muted)">
        the signal person is certified; a stop from anyone on site stops the lift
      </text>
      <line x1="178" y1="18" x2="178" y2="122" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" />
      <text x="8" y="12" fontSize="8.5" fill="var(--text-muted)">the crane's signal person</text>
      <text x="186" y="12" fontSize="8.5" fill="var(--text-muted)">the flagger on the road</text>
    </svg>
  )
}
