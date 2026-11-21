import type { FigureProps } from './figureProps'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The licence, the registration and the card (Intro to HVAC, lesson 26): three papers side by side, the company's
 * contractor licence and each worker's registration from the state, and the federal card for the refrigerant loop.
 */
export function LicenceLine({ titleId }: FigureProps) {
  const card = (x: number, head: string, photo: boolean) => (
    <g>
      <rect x={x} y="24" width="88" height="56" rx="6" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <rect x={x} y="24" width="88" height="16" rx="6" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.5" />
      <text x={x + 44} y="36" fontSize="8.5" fontWeight="600" fill="currentColor" textAnchor="middle">
        {head}
      </text>
      {photo && <rect x={x + 8} y="46" width="20" height="26" rx="2" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1" />}
      <line x1={x + (photo ? 36 : 12)} y1="52" x2={x + 76} y2="52" stroke="var(--text-muted)" strokeWidth="1.2" />
      <line x1={x + (photo ? 36 : 12)} y1="60" x2={x + 68} y2="60" stroke="var(--text-muted)" strokeWidth="1.2" />
      <line x1={x + (photo ? 36 : 12)} y1="68" x2={x + 58} y2="68" stroke="var(--text-muted)" strokeWidth="1.2" />
    </g>
  )
  return (
    <svg viewBox="0 0 300 138" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Label x={98} y={14} anchor="middle" size={7.5}>
        from the state, TDLR
      </Label>
      <Label x={250} y={14} anchor="middle" size={7.5}>
        federal, the EPA
      </Label>
      <line x1="203" y1="6" x2="203" y2="132" stroke="var(--text-muted)" strokeWidth="1.2" strokeDasharray="4 3" />
      {card(8, 'Contractor', false)}
      {card(106, 'Technician', true)}
      {card(210, 'Section 608', true)}
      <Label x={52} y={96} anchor="middle" bold color="currentColor" size={8}>
        the company's licence
      </Label>
      <Label x={52} y={106} anchor="middle" size={7}>
        Class A or Class B
      </Label>
      <Label x={150} y={96} anchor="middle" bold color="currentColor" size={8}>
        each worker's own
      </Label>
      <Label x={150} y={106} anchor="middle" size={7}>
        registered or certified
      </Label>
      <Label x={150} y={115} anchor="middle" size={7}>
        from age 16, for one year
      </Label>
      <Label x={254} y={96} anchor="middle" bold color="currentColor" size={8}>
        the card
      </Label>
      <Label x={254} y={106} anchor="middle" size={7}>
        to open a loop
      </Label>
      <Label x={254} y={115} anchor="middle" size={7}>
        in every state
      </Label>
    </svg>
  )
}
