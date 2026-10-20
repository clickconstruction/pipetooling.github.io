import type { FigureProps } from './figureProps'
import { Flow, Label, Pipe } from './plumbingParts'
import { DRAIN, SVG_STYLE } from './plumbingTokens'

/**
 * From the stack to the sewer (punch list #119): the stack drops to the building drain under the slab, a cleanout
 * at its base, the drain leaves the house and becomes the building sewer 30 in past the wall with a cleanout
 * there, then runs with its slope to the city sewer. Lesson 16.
 */
export function HouseToSewer({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <path d="M30 40 L100 14 L170 40" />
        <rect x="30" y="40" width="140" height="60" fill="var(--bg-subtle)" />
        <line x1="0" y1="100" x2="300" y2="100" />
      </g>
      <Pipe d="M100 40 V120" bore={DRAIN} tint="waste" />
      <Flow x={100} y={70} angle={90} />
      <Pipe d="M100 120 H270 L296 126" bore={DRAIN} tint="waste" />
      <Flow x={140} y={120} />
      <Flow x={230} y={120} />
      <Pipe d="M84 120 V104" bore={9} tint="air" />
      <rect x="78" y="100" width="12" height="5" rx="1" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <Pipe d="M196 120 V104" bore={9} tint="air" />
      <rect x="190" y="100" width="12" height="5" rx="1" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <line x1="170" y1="104" x2="170" y2="140" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      <line x1="196" y1="132" x2="196" y2="140" stroke="currentColor" strokeWidth="1" />
      <line x1="170" y1="136" x2="196" y2="136" stroke="currentColor" strokeWidth="1" />
      <circle cx="292" cy="130" r="7" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="2" />
      <Label x={108} y={60} size={7.5}>
        the stack
      </Label>
      <Label x={4} y={96} size={7.5}>
        cleanout at the base
      </Label>
      <Label x={100} y={138} anchor="start" size={8} bold color="currentColor">
        building drain
      </Label>
      <Label x={100} y={147} size={7.5}>
        under the slab, 4 in
      </Label>
      <Label x={199} y={140} size={7.5}>
        30 in
      </Label>
      <Label x={206} y={96} size={7.5}>
        cleanout where it leaves
      </Label>
      <Label x={236} y={110} size={8} bold color="currentColor">
        building sewer
      </Label>
      <Label x={290} y={147} anchor="end" size={7.5}>
        city sewer or septic
      </Label>
      <Label x={100} y={30} anchor="middle" size={7.5}>
        the house
      </Label>
    </svg>
  )
}
