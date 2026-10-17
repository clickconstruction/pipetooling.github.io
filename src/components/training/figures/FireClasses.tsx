import type { FigureProps } from './figureProps'

/** The five fire classes with what puts each out, and the one deadly mistake in red (punch list #116). Lesson 25. */
export function FireClasses({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 118" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="1.5" fill="var(--bg-subtle)">
        <rect x="2" y="2" width="55" height="110" rx="6" />
        <rect x="62" y="2" width="55" height="110" rx="6" />
        <rect x="122" y="2" width="55" height="110" rx="6" fill="var(--bg-red-100)" />
        <rect x="182" y="2" width="55" height="110" rx="6" />
        <rect x="242" y="2" width="55" height="110" rx="6" />
      </g>
      <g fontSize="20" fontWeight="700" fill="currentColor">
        <text x="22" y="28">A</text>
        <text x="82" y="28">B</text>
        <text x="142" y="28">C</text>
        <text x="202" y="28">D</text>
        <text x="262" y="28">K</text>
      </g>
      <g fontSize="8" fill="currentColor">
        <text x="7" y="46">wood, paper</text>
        <text x="7" y="57">and trash</text>
        <text x="7" y="80" fill="#15803d">water or</text>
        <text x="7" y="91" fill="#15803d">dry chemical</text>
        <text x="67" y="46">liquids</text>
        <text x="67" y="57">and gases</text>
        <text x="67" y="80" fill="#15803d">CO2, foam or</text>
        <text x="67" y="91" fill="#15803d">dry chemical</text>
        <text x="127" y="46">live</text>
        <text x="127" y="57">electrical</text>
        <text x="127" y="80" fill="#15803d">dry chemical</text>
        <text x="127" y="91" fill="#991b1b" fontWeight="700">never water</text>
        <text x="187" y="46">metals</text>
        <text x="187" y="80" fill="#15803d">special</text>
        <text x="187" y="91" fill="#15803d">powder</text>
        <text x="247" y="46">cooking</text>
        <text x="247" y="57">oils</text>
        <text x="247" y="80" fill="#15803d">wet</text>
        <text x="247" y="91" fill="#15803d">chemical</text>
      </g>
    </svg>
  )
}
