import type { FigureProps } from './figureProps'
import { Conductor } from './electricalParts'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Low voltage, a different world (punch list #120): 120 V comes into the transformer's box on the left in the
 * ink; 24 V leaves on the right as thin muted lines to the thermostat, the doorbell and the gas valve. The 24 V
 * side is safe and the box is not. Lesson 18.
 */
export function LowVoltageWorld({ titleId }: FigureProps) {
  const thin = (d: string) => <path d={d} fill="none" stroke="var(--text-muted)" strokeWidth="1.3" />
  const box = (x: number, y: number, name: string) => (
    <g>
      <rect x={x - 22} y={y - 10} width="44" height="20" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
      <Label x={x} y={y + 3} anchor="middle" size={6.5} color="currentColor">
        {name}
      </Label>
    </g>
  )
  return (
    <svg viewBox="0 0 300 140" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Conductor d="M10 70 H110" />
      <Conductor d="M10 80 H110" wire="neutral" />
      <Label x={60} y={62} anchor="middle" size={8} bold color="currentColor">
        120 V
      </Label>
      <Label x={60} y={94} anchor="middle" size={7}>
        a live box, like any other
      </Label>
      <rect x="110" y="50" width="50" height="50" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <path d="M122 62 q6 6 0 12 q6 6 0 12" />
        <path d="M148 62 q-6 6 0 12 q-6 6 0 12" />
        <line x1="133" y1="58" x2="133" y2="92" />
        <line x1="137" y1="58" x2="137" y2="92" />
      </g>
      <Label x={135} y={112} anchor="middle" size={7} bold color="currentColor">
        the transformer
      </Label>
      {thin('M160 66 H190 V30 H228')}
      {thin('M160 74 H196 V75 H228')}
      {thin('M160 84 H190 V120 H228')}
      {box(250, 30, 'thermostat')}
      {box(250, 75, 'doorbell')}
      {box(250, 120, 'gas valve')}
      <Label x={212} y={60} anchor="middle" size={8} bold color="currentColor">
        24 V
      </Label>
      <Label x={224} y={99} anchor="middle" size={7}>
        it will not hurt you
      </Label>
    </svg>
  )
}
