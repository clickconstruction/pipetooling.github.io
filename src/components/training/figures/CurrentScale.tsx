import type { FigureProps } from './figureProps'

/**
 * The current scale (punch list #116): 1 mA a tingle, 5 the GFCI trips, 30 you cannot let go, 50 to 150 breathing
 * stops, 200 the heart, and the breaker only at 15,000, above a cut in the axis. Lesson 9.
 */
export function CurrentScale({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 236" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
        <rect x="84" y="80" width="12" height="60" fill="var(--bg-red-100)" stroke="none" />
        <line x1="90" y1="215" x2="90" y2="62" />
        <polyline points="90,62 84,56 96,50 84,44 90,38" />
        <line x1="90" y1="38" x2="90" y2="22" />
        <polygon points="90,14 85,24 95,24" fill="currentColor" stroke="none" />
      </g>
      <g stroke="currentColor" strokeWidth="2">
        <line x1="82" y1="205" x2="98" y2="205" />
        <line x1="82" y1="180" x2="98" y2="180" stroke="var(--text-green-700)" strokeWidth="3" />
        <line x1="82" y1="140" x2="98" y2="140" />
        <line x1="82" y1="105" x2="98" y2="105" />
        <line x1="82" y1="80" x2="98" y2="80" />
        <line x1="82" y1="30" x2="98" y2="30" />
      </g>
      <g fontSize="10.5" fill="currentColor">
        <text x="106" y="209">1 mA · a tingle</text>
        <text x="106" y="184" fill="var(--text-green-700)">5 mA · the GFCI trips here</text>
        <text x="106" y="144" fill="var(--text-red-800)">30 mA · you cannot let go</text>
        <text x="106" y="109" fill="var(--text-red-800)">50 to 150 mA · breathing stops</text>
        <text x="106" y="84" fill="var(--text-red-800)">200 mA · the heart can stop</text>
        <text x="106" y="34">15,000 mA · the breaker trips</text>
        <text x="106" y="47" fill="var(--text-muted)" fontSize="9.5">it protects the wiring, not you</text>
        <text x="8" y="130" fill="var(--text-muted)" fontSize="9.5" transform="rotate(-90 8 130)">more current</text>
        <text x="60" y="230" fill="var(--text-muted)" fontSize="9.5">the axis is cut: 15,000 is 75 times 200</text>
      </g>
    </svg>
  )
}
