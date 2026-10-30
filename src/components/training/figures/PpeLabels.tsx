import type { FigureProps } from './figureProps'

/** A glove's chemical rating, very good to poor, and the welding shade scale 2 to 14 (punch list #116). Lesson 12. */
export function PpeLabels({ titleId }: FigureProps) {
  const shades = Array.from({ length: 13 }, (_, i) => i + 2)
  return (
    <svg viewBox="0 0 300 132" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g fontSize="9.5" fill="currentColor">
        <text x="6" y="14" fontWeight="600">a glove's chemical rating</text>
        <rect x="6" y="22" width="70" height="24" fill="var(--bg-green-100)" stroke="var(--text-green-700)" strokeWidth="1" />
        <rect x="76" y="22" width="70" height="24" fill="var(--bg-green-100)" stroke="var(--text-green-700)" strokeWidth="1" opacity="0.7" />
        <rect x="146" y="22" width="70" height="24" fill="var(--bg-amber-100)" stroke="var(--text-amber-700)" strokeWidth="1" />
        <rect x="216" y="22" width="78" height="24" fill="var(--bg-red-100)" stroke="var(--text-red-700)" strokeWidth="1" />
        <text x="41" y="38" textAnchor="middle" fontWeight="700">VG</text>
        <text x="111" y="38" textAnchor="middle" fontWeight="700">G</text>
        <text x="181" y="38" textAnchor="middle" fontWeight="700">F</text>
        <text x="255" y="38" textAnchor="middle" fontWeight="700">P</text>
        <text x="41" y="58" textAnchor="middle" fill="var(--text-muted)" fontSize="8.5">very good</text>
        <text x="111" y="58" textAnchor="middle" fill="var(--text-muted)" fontSize="8.5">good</text>
        <text x="181" y="58" textAnchor="middle" fill="var(--text-muted)" fontSize="8.5">fair</text>
        <text x="255" y="58" textAnchor="middle" fill="var(--text-muted)" fontSize="8.5">poor</text>
        <text x="6" y="84" fontWeight="600">a welding lens's shade</text>
      </g>
      <g stroke="currentColor" strokeWidth="0.8">
        {shades.map((n, i) => {
          const dark = Math.round(235 - (i / 12) * 215)
          return <rect key={n} x={6 + i * 22} y="92" width="22" height="18" fill={`rgb(${dark},${dark},${dark})`} />
        })}
      </g>
      <g fontSize="8.5" fill="currentColor" textAnchor="middle">
        {shades.map((n, i) => (
          <text key={n} x={17 + i * 22} y="124">
            {n}
          </text>
        ))}
      </g>
    </svg>
  )
}
