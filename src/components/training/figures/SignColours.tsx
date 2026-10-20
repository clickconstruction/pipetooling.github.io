import type { FigureProps } from './figureProps'

/** The four sign headers, red Danger, orange Warning, yellow and black Caution, blue Notice (punch list #116). Lesson 24. */
export function SignColours({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 64" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g fontSize="10" fontWeight="700" textAnchor="middle" stroke="var(--border-strong)" strokeWidth="0.8">
        <rect x="4" y="4" width="68" height="34" rx="3" fill="#dc2626" />
        <text x="38" y="26" fill="#fff" stroke="none">DANGER</text>
        <rect x="78" y="4" width="68" height="34" rx="3" fill="#f97316" />
        <text x="112" y="26" fill="#111827" stroke="none">WARNING</text>
        <rect x="152" y="4" width="68" height="34" rx="3" fill="#facc15" />
        <rect x="152" y="4" width="68" height="10" fill="#111827" stroke="none" />
        <text x="186" y="29" fill="#111827" stroke="none">CAUTION</text>
        <rect x="226" y="4" width="68" height="34" rx="3" fill="#2563eb" />
        <text x="260" y="26" fill="#fff" stroke="none">NOTICE</text>
      </g>
      <g fontSize="8.5" fill="var(--text-muted)" textAnchor="middle">
        <text x="38" y="52">the worst</text>
        <text x="112" y="52">could hurt you</text>
        <text x="186" y="52">watch it</text>
        <text x="260" y="52">information</text>
      </g>
    </svg>
  )
}
