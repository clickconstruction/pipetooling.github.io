import type { FigureProps } from './figureProps'

/** A NIOSH mask's label (punch list #116): the five things a real one shows, and the lot number that is optional. Lesson 13. */
export function NioshLabel({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 124" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M14 60 c0 -28 22 -44 50 -44 s50 16 50 44 c0 22 -22 40 -50 40 s-50 -18 -50 -40z" fill="var(--bg-subtle)" />
        <path d="M14 56 c-6 -4 -8 -12 -4 -18" />
        <path d="M114 56 c6 -4 8 -12 4 -18" />
        <rect x="32" y="46" width="64" height="30" rx="2" fill="var(--surface)" strokeWidth="1" />
      </g>
      <g fontSize="6" fontWeight="700" fill="currentColor" textAnchor="middle">
        <text x="64" y="54">NIOSH</text>
        <text x="64" y="62">ACME · M-10</text>
        <text x="64" y="70">N95 · TC-84A-1234</text>
      </g>
      <g fontSize="9.5" fill="currentColor">
        <text x="140" y="22" fontWeight="600">five things on a real mask</text>
        <text x="140" y="38">1 NIOSH, spelled right</text>
        <text x="140" y="52">2 the maker</text>
        <text x="140" y="66">3 the model</text>
        <text x="140" y="80">4 the filter rating, N95 or P99</text>
        <text x="140" y="94">5 the TC number</text>
        <text x="140" y="112" fill="var(--text-muted)">only the lot number may be missing</text>
      </g>
    </svg>
  )
}
