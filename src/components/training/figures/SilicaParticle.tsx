import type { FigureProps } from './figureProps'

/** A silica particle under 10 microns beside a hair about 70 microns across, to scale (punch list #116). Lesson 16. */
export function SilicaParticle({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="2" fill="none">
        <circle cx="90" cy="70" r="49" fill="var(--bg-amber-100)" />
        <circle cx="200" cy="70" r="7" fill="var(--bg-red-100)" stroke="#b91c1c" />
        <line x1="90" y1="126" x2="90" y2="134" stroke="var(--text-muted)" strokeWidth="1" />
        <line x1="41" y1="130" x2="139" y2="130" stroke="var(--text-muted)" strokeWidth="1" />
        <line x1="41" y1="126" x2="41" y2="134" stroke="var(--text-muted)" strokeWidth="1" />
        <line x1="139" y1="126" x2="139" y2="134" stroke="var(--text-muted)" strokeWidth="1" />
      </g>
      <g fontSize="9.5" fill="currentColor" textAnchor="middle">
        <text x="90" y="16">a human hair, end on</text>
        <text x="90" y="146" fill="var(--text-muted)">about 70 microns</text>
        <text x="200" y="16">a silica particle</text>
        <text x="200" y="96" fill="#991b1b">under 10 microns</text>
        <text x="200" y="110" fill="var(--text-muted)" fontSize="9">too small to see</text>
        <text x="200" y="122" fill="var(--text-muted)" fontSize="9">too small to cough up</text>
      </g>
    </svg>
  )
}
