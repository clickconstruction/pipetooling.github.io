import type { FigureProps } from './figureProps'

/**
 * A hard hat's limits (punch list #116): six objects at the height each one injures you from, a 1-lb wrench at
 * 30 ft down to a 50-lb block at 1 ft. Lesson 11.
 */
export function HardHatLimits({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 246" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
        <line x1="10" y1="220" x2="290" y2="220" strokeWidth="3" />
        <path d="M30 172 a12 12 0 0 1 24 0 z" fill="#f97316" strokeWidth="1.5" />
        <circle cx="42" cy="178" r="7" fill="var(--surface)" />
        <line x1="42" y1="185" x2="42" y2="204" />
        <polyline points="42,204 35,220" />
        <polyline points="42,204 49,220" />
        <polyline points="42,190 32,198" />
        <polyline points="42,190 52,198" />
        <line x1="120" y1="220" x2="120" y2="24" />
        <g strokeWidth="1.5">
          <line x1="115" y1="25" x2="125" y2="25" />
          <line x1="115" y1="122" x2="125" y2="122" />
          <line x1="115" y1="168" x2="125" y2="168" />
          <line x1="115" y1="194" x2="125" y2="194" />
          <line x1="115" y1="207" x2="125" y2="207" />
          <line x1="115" y1="213" x2="125" y2="213" />
        </g>
        <g stroke="var(--text-muted)" strokeWidth="1">
          <line x1="125" y1="25" x2="150" y2="30" />
          <line x1="125" y1="122" x2="150" y2="66" />
          <line x1="125" y1="168" x2="150" y2="102" />
          <line x1="125" y1="194" x2="150" y2="138" />
          <line x1="125" y1="207" x2="150" y2="174" />
          <line x1="125" y1="213" x2="150" y2="206" />
        </g>
        <g fill="var(--bg-subtle)" strokeWidth="1.5">
          <rect x="154" y="24" width="14" height="6" rx="2" />
          <rect x="154" y="58" width="12" height="12" rx="2" />
          <rect x="154" y="94" width="16" height="12" />
          <rect x="154" y="130" width="16" height="12" rx="3" />
          <rect x="154" y="166" width="18" height="12" rx="2" />
          <rect x="154" y="200" width="20" height="14" />
        </g>
      </g>
      <g fontSize="10" fill="currentColor">
        <text x="178" y="32">a 1-lb wrench · 30 ft</text>
        <text x="178" y="68">a 2-lb hammer · 15 ft</text>
        <text x="178" y="104">a 5-lb brick · 8 ft</text>
        <text x="178" y="140">a 10-lb drill · 4 ft</text>
        <text x="178" y="176">a 20-lb sledge · 2 ft</text>
        <text x="178" y="210">a 50-lb block · 1 ft</text>
        <text x="96" y="22" fill="var(--text-muted)" fontSize="9.5" textAnchor="end">30 ft</text>
        <text x="96" y="217" fill="var(--text-muted)" fontSize="9.5" textAnchor="end">ground</text>
        <text x="14" y="240" fill="var(--text-muted)" fontSize="9.5">each one hurts you through the hat from the height shown</text>
      </g>
    </svg>
  )
}
