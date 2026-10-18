import type { FigureProps } from './figureProps'
import { Flow, Label, Pipe, Valve } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Pressure and the PRV (punch list #119): a gauge on a hose bib reads the push, with the weak, good and too-much
 * bands; a pressure reducing valve passes high street pressure through as a lower house pressure, the spring on top
 * setting the house side. Lesson 3.
 */
export function PressureAndPrv({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <circle cx="70" cy="78" r="48" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <g fill="none" strokeWidth="7" strokeLinecap="butt">
        <path d="M41.7 106.3 A40 40 0 0 1 51.8 42.4" stroke="#d97706" />
        <path d="M51.8 42.4 A40 40 0 0 1 88.2 42.4" stroke="#15803d" />
        <path d="M88.2 42.4 A40 40 0 0 1 109.5 71.7" stroke="var(--text-muted)" />
        <path d="M109.5 71.7 A40 40 0 0 1 98.3 106.3" stroke="#b91c1c" />
      </g>
      <line x1="70" y1="78" x2="77.5" y2="46.9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="70" cy="78" r="3" fill="currentColor" />
      <Label x={70} y={98} anchor="middle" size={8} bold color="currentColor">
        psi
      </Label>
      <Label x={40} y={36} anchor="end" size={8}>
        40
      </Label>
      <Label x={100} y={36} size={8}>
        60
      </Label>
      <Label x={118} y={72} size={8}>
        80
      </Label>
      <Label x={12} y={116} size={8} color="#d97706">
        weak
      </Label>
      <Label x={70} y={26} anchor="middle" size={8} color="#15803d">
        good
      </Label>
      <Label x={106} y={122} size={8} color="#b91c1c">
        too much
      </Label>
      <Label x={70} y={140} anchor="middle" size={8}>
        a gauge on a hose bib
      </Label>
      <Pipe d="M150 100 H300" />
      <Valve x={225} y={100} kind="prv" />
      <Flow x={165} y={94} size={0.8} />
      <Flow x={165} y={100} size={0.8} />
      <Flow x={165} y={106} size={0.8} />
      <Flow x={190} y={100} />
      <Flow x={262} y={100} />
      <Label x={176} y={122} anchor="middle" size={8} bold color="#b91c1c">
        street 90 psi
      </Label>
      <Label x={272} y={122} anchor="middle" size={8} bold color="#15803d">
        house 55 psi
      </Label>
      <Label x={225} y={56} anchor="middle" size={8}>
        the spring sets the house side
      </Label>
      <Label x={225} y={140} anchor="middle" size={8}>
        PRV
      </Label>
    </svg>
  )
}
