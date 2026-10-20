import type { FigureProps } from './figureProps'

/** A cubic yard of soil beside a car, the same weight (punch list #116). Lesson 10. */
export function SoilCubeCar({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round">
        <line x1="6" y1="116" x2="294" y2="116" strokeWidth="3" />
        <path d="M30 60 H90 V116 H30 Z" fill="var(--bg-amber-100)" />
        <path d="M30 60 L50 40 H110 L90 60" fill="var(--bg-amber-100)" />
        <path d="M90 60 L110 40 V96 L90 116" fill="var(--bg-amber-100)" />
        <path d="M150 116 V96 L170 76 H250 L270 96 V116 Z" fill="var(--bg-blue-tint)" />
        <path d="M180 96 L190 80 H240 L252 96" fill="var(--surface)" />
        <circle cx="178" cy="116" r="10" fill="var(--bg-subtle)" />
        <circle cx="246" cy="116" r="10" fill="var(--bg-subtle)" />
      </g>
      <g fontSize="12" fontWeight="700" fill="currentColor" textAnchor="middle">
        <text x="120" y="92">=</text>
      </g>
      <g fontSize="9.5" fill="currentColor" textAnchor="middle">
        <text x="70" y="134">one cubic yard of soil</text>
        <text x="70" y="146" fill="var(--text-muted)">2,000 to 3,000 lb</text>
        <text x="212" y="134">a car</text>
        <text x="212" y="146" fill="var(--text-muted)">a cave-in buries you under several</text>
      </g>
      <text x="6" y="22" fontSize="9.5" fill="var(--text-muted)">
        you cannot dig yourself out, and the crew cannot dig fast enough
      </text>
    </svg>
  )
}
