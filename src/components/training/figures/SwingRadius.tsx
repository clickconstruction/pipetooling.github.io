import type { FigureProps } from './figureProps'

/** An excavator from above with its 360 degree swing radius and the three blind spots (punch list #116). Lesson 11; lesson 22 names it too. */
export function SwingRadius({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 236" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <circle cx="150" cy="125" r="95" stroke="#dc2626" strokeDasharray="6 4" strokeWidth="2" />
        <rect x="120" y="160" width="60" height="38" fill="var(--bg-red-100)" stroke="none" />
        <rect x="98" y="95" width="30" height="62" fill="var(--bg-red-100)" stroke="none" />
        <circle cx="225" cy="70" r="18" fill="var(--bg-red-100)" stroke="none" />
        <rect x="130" y="95" width="14" height="62" rx="3" fill="var(--bg-subtle)" />
        <rect x="156" y="95" width="14" height="62" rx="3" fill="var(--bg-subtle)" />
        <rect x="136" y="104" width="28" height="36" rx="4" fill="var(--surface)" strokeWidth="2" />
        <rect x="138" y="106" width="11" height="11" fill="var(--bg-blue-tint)" />
        <line x1="150" y1="110" x2="200" y2="82" strokeWidth="4" />
        <line x1="200" y1="82" x2="222" y2="74" strokeWidth="4" />
        <circle cx="225" cy="70" r="7" fill="currentColor" />
        <circle cx="40" cy="178" r="7" fill="var(--surface)" strokeWidth="2" />
        <line x1="40" y1="185" x2="40" y2="208" />
        <polyline points="40,208 33,228" />
        <polyline points="40,208 47,228" />
        <polyline points="40,192 30,200" />
        <polyline points="40,192 52,186" />
      </g>
      <g fontSize="10" fill="currentColor">
        <text x="126" y="214" fill="#991b1b">behind</text>
        <text x="96" y="78" fill="#991b1b">far side</text>
        <text x="96" y="90" fill="#991b1b">of the cab</text>
        <text x="232" y="48" fill="#991b1b">under the</text>
        <text x="232" y="60" fill="#991b1b">bucket</text>
        <text x="196" y="222" fill="#dc2626" fontSize="9.5">360° · red rope marks it</text>
        <text x="4" y="150" fill="var(--text-muted)" fontSize="9.5">outside the rope,</text>
        <text x="4" y="162" fill="var(--text-muted)" fontSize="9.5">eye contact first</text>
      </g>
    </svg>
  )
}
