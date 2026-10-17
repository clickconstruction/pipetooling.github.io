import type { FigureProps } from './figureProps'

/**
 * The clearance stack (punch list #116): a worker hanging from an overhead anchor with the five distances
 * that add up to 18 ft of clear space, 6 ft of free fall, 3.5 ft to slow, 1 ft of D-ring shift, 5 ft from the
 * D-ring to the feet and 2 ft of safety. Lesson 8 draws it.
 */
export function ClearanceStack({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 250" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round">
        <rect x="20" y="8" width="260" height="12" fill="var(--bg-subtle)" />
        <circle cx="120" cy="20" r="3" fill="currentColor" />
        <line x1="120" y1="23" x2="120" y2="92" />
        <polyline points="120,92 112,98 128,104 112,110 128,116 112,122 128,128 120,134" />
        <line x1="120" y1="134" x2="120" y2="146" />
        <circle cx="120" cy="140" r="7" fill="var(--surface)" />
        <line x1="120" y1="147" x2="120" y2="176" />
        <polyline points="120,152 104,132" />
        <polyline points="120,152 136,132" />
        <polyline points="120,176 110,206" />
        <polyline points="120,176 130,206" />
        <line x1="20" y1="230" x2="280" y2="230" strokeWidth="2" />
        <g stroke="var(--text-muted)" strokeWidth="1">
          <line x1="150" y1="20" x2="150" y2="92" />
          <line x1="146" y1="20" x2="154" y2="20" />
          <line x1="146" y1="92" x2="154" y2="92" />
          <line x1="150" y1="94" x2="150" y2="134" />
          <line x1="146" y1="134" x2="154" y2="134" />
          <line x1="150" y1="136" x2="150" y2="146" />
          <line x1="146" y1="146" x2="154" y2="146" />
          <line x1="150" y1="148" x2="150" y2="206" />
          <line x1="146" y1="206" x2="154" y2="206" />
          <line x1="150" y1="208" x2="150" y2="230" />
          <line x1="90" y1="20" x2="90" y2="230" />
          <line x1="86" y1="20" x2="94" y2="20" />
          <line x1="86" y1="230" x2="94" y2="230" />
        </g>
      </g>
      <g fontSize="10.5" fill="currentColor">
        <text x="160" y="38" fill="var(--text-muted)" fontSize="9.5">anchor overhead</text>
        <text x="160" y="60">6 ft · free fall</text>
        <text x="160" y="118">3.5 ft · to slow</text>
        <text x="160" y="145">1 ft · D-ring shift</text>
        <text x="160" y="181">5 ft · D-ring to feet</text>
        <text x="160" y="222">2 ft · safety</text>
        <text x="30" y="130" fill="var(--text-muted)" fontSize="9.5" transform="rotate(-90 30 130)">18 ft below you</text>
        <text x="24" y="245" fill="var(--text-muted)" fontSize="9.5">the ground, or the next level down</text>
      </g>
    </svg>
  )
}
