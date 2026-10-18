import type { FigureProps } from './figureProps'
import { Breaker, Conductor } from './electricalParts'
import { Label, Person } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Lockout and tagout as a plumber sees it (punch list #120): the breaker is open with a padlock through its handle
 * and a tag hanging from the lock with a name and a reason; the circuit runs to the work on the right, where the
 * plumber holds the tester to it. Only the name on the tag takes the lock off. Lesson 27.
 */
export function LockoutTag({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 140" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <rect x="20" y="16" width="70" height="110" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={55} y={30} anchor="middle" size={7}>
        panel
      </Label>
      <Conductor d="M30 60 H42 M58 60 H200 V96 H214" />
      <Breaker x={50} y={60} amps={30} open />
      <g transform="translate(50 70)">
        <rect x="-8" y="0" width="16" height="12" rx="2" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.5" />
        <path d="M-5 0 v-6 a5 5 0 0 1 10 0 v6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </g>
      <path d="M58 80 L80 96" fill="none" stroke="currentColor" strokeWidth="1" />
      <g transform="translate(80 92)">
        <path d="M0 0 h40 v26 h-40 z" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
        <text x="20" y="10" fontSize="6" fontWeight="600" fill="currentColor" textAnchor="middle">
          DANGER
        </text>
        <text x="20" y="18" fontSize="5.5" fill="var(--text-muted)" textAnchor="middle">
          locked by: a name
        </text>
        <text x="20" y="24" fontSize="5.5" fill="var(--text-muted)" textAnchor="middle">
          why: the heater
        </text>
      </g>
      <Label x={100} y={44} size={7} bold color="currentColor">
        off, locked, tagged
      </Label>
      <Label x={100} y={53} size={7}>
        by the one who unlocks it
      </Label>
      <Person x={250} y={126} h={44} arm="out" />
      <rect x="214" y="90" width="10" height="14" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <Label x={248} y={82} anchor="middle" size={7} bold color="currentColor">
        the plumber tests it dead
      </Label>
      <Label x={232} y={136} anchor="middle" size={7}>
        and never touches the lock
      </Label>
    </svg>
  )
}
