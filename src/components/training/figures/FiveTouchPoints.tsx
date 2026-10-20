import type { FigureProps } from './figureProps'
import { Conductor, Load, Receptacle } from './electricalParts'
import { Label, Pipe, Sink } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Where our work touches theirs (punch list #120): a house section with the five places numbered. The water
 * heater on its circuit, the sink with its two live boxes, the sump in its pit, the meter with its jumper, and a
 * stud with the cable set back in its middle and the hole going where the cable is not. Lesson 28.
 */
export function FiveTouchPoints({ titleId }: FigureProps) {
  const n = (x: number, y: number, k: number) => (
    <g transform={`translate(${x} ${y})`}>
      <circle r="7" fill="currentColor" />
      <text y="2.8" fontSize="8" fontWeight="700" fill="var(--surface)" textAnchor="middle">
        {k}
      </text>
    </g>
  )
  return (
    <svg viewBox="0 0 300 160" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <line x1="0" y1="140" x2="300" y2="140" />
        <line x1="0" y1="76" x2="200" y2="76" />
      </g>
      <rect x="18" y="20" width="26" height="52" rx="6" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1.5" />
      <Conductor d="M31 20 V8 H70" />
      {n(31, 46, 1)}
      <Label x={31} y={88} anchor="middle" size={6.5}>
        the water heater
      </Label>
      <Sink x={110} y={40} w={34} />
      <Load x={110} y={64} kind="motor" />
      <Receptacle x={140} y={60} />
      {n(140, 36, 2)}
      <Label x={122} y={88} anchor="middle" size={6.5}>
        under the sink
      </Label>
      <path d="M20 100 V136 H60 V100" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1.5" />
      <Load x={40} y={126} kind="motor" />
      <Receptacle x={76} y={112} kind="gfci" />
      {n(40, 100, 3)}
      <Label x={48} y={152} anchor="middle" size={6.5}>
        the pumps
      </Label>
      <Pipe d="M100 126 H200" />
      <rect x="140" y="118" width="18" height="16" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
      <Conductor d="M134 122 V108 H164 V122" wire="ground" />
      {n(149, 100, 4)}
      <Label x={149} y={152} anchor="middle" size={6.5}>
        the jumper
      </Label>
      <rect x="212" y="20" width="24" height="120" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.5" />
      <rect x="220" y="70" width="8" height="12" rx="1.5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="224" cy="112" r="5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.5" />
      {n(224, 44, 5)}
      <Label x={244} y={74} size={6.5}>
        the cable
      </Label>
      <Label x={244} y={83} size={6.5}>
        in the middle
      </Label>
      <Label x={244} y={114} size={6.5}>
        the hole
      </Label>
      <Label x={244} y={123} size={6.5}>
        where it is not
      </Label>
      <Label x={224} y={152} anchor="middle" size={6.5}>
        the holes
      </Label>
    </svg>
  )
}
