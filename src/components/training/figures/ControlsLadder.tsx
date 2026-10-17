import type { FigureProps } from './figureProps'

/**
 * The controls ladder (punch list #116): elimination, substitution, engineering, administrative, PPE, most
 * to least effective, the tint running from green to red. Lesson 1 draws it; lessons 5, 21 and 27 name it too.
 */
export function ControlsLadder({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 172" role="img" aria-labelledby={titleId} style={{ display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' }}>
      <g fontSize="10.5" fill="currentColor">
        <rect x="40" y="6" width="254" height="26" rx="4" fill="var(--bg-green-100)" stroke="#15803d" />
        <text x="48" y="23">Elimination · remove the hazard</text>
        <rect x="40" y="38" width="236" height="26" rx="4" fill="var(--bg-green-100)" stroke="#15803d" />
        <text x="48" y="55">Substitution · swap in a safer one</text>
        <rect x="40" y="70" width="218" height="26" rx="4" fill="var(--bg-blue-tint)" stroke="#2563eb" />
        <text x="48" y="87">Engineering · a guard, a vent, a hoist</text>
        <rect x="40" y="102" width="200" height="26" rx="4" fill="var(--bg-amber-100)" stroke="#b45309" />
        <text x="48" y="119">Administrative · training, permits</text>
        <rect x="40" y="134" width="182" height="26" rx="4" fill="var(--bg-red-100)" stroke="#b91c1c" />
        <text x="48" y="151">PPE · the gear you wear</text>
        <line x1="18" y1="18" x2="18" y2="150" stroke="var(--text-muted)" strokeWidth="1.5" />
        <polygon points="18,160 13,150 23,150" fill="var(--text-muted)" />
        <text x="8" y="12" fontSize="9" fill="var(--text-muted)">best</text>
        <text x="8" y="170" fontSize="9" fill="var(--text-muted)">last</text>
      </g>
    </svg>
  )
}
