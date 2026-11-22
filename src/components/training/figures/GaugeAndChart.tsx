import type { FigureProps } from './figureProps'
import { Flow, Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The gauge and the chart (Intro to HVAC, lesson 3): a gauge that reads the pressure, and beside it the chart for
 * that refrigerant, which turns each pressure into one boiling temperature. No numbers: each refrigerant has its own.
 */
export function GaugeAndChart({ titleId }: FigureProps) {
  const rows: Array<[string, string, string]> = [
    ['low', 'boils cold', 'var(--bg-blue-200)'],
    ['higher', 'boils warmer', 'var(--surface)'],
    ['high', 'boils hot', 'var(--bg-red-100)'],
  ]
  return (
    <svg viewBox="0 0 300 138" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <circle cx="56" cy="62" r="30" fill="var(--surface)" stroke="currentColor" strokeWidth="1.8" />
      {[-120, -80, -40, 0, 40, 80, 120].map((a) => (
        <line key={a} x1="56" y1="36" x2="56" y2="41" stroke="currentColor" strokeWidth="1.2" transform={`rotate(${a} 56 62)`} />
      ))}
      <line x1="56" y1="62" x2="74" y2="46" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="56" cy="62" r="3" fill="currentColor" />
      <rect x="50" y="92" width="12" height="10" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={56} y={116} anchor="middle" bold color="currentColor" size={8}>
        the gauge
      </Label>
      <Label x={56} y={126} anchor="middle" size={7}>
        reads the pressure
      </Label>
      <Flow x={108} y={62} size={1.1} />
      <rect x="134" y="24" width="150" height="78" rx="4" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <line x1="134" y1="42" x2="284" y2="42" stroke="currentColor" strokeWidth="1.2" />
      <line x1="204" y1="24" x2="204" y2="102" stroke="currentColor" strokeWidth="1.2" />
      <Label x={169} y={36} anchor="middle" bold color="currentColor" size={7.5}>
        pressure
      </Label>
      <Label x={244} y={36} anchor="middle" bold color="currentColor" size={7.5}>
        temperature
      </Label>
      {rows.map(([p, t, fill], i) => (
        <g key={p}>
          <rect x="205" y={43 + i * 19.5} width="78" height="19" fill={fill} stroke="none" />
          <Label x={169} y={56 + i * 19.5} anchor="middle" size={7.5}>
            {p}
          </Label>
          <Label x={244} y={56 + i * 19.5} anchor="middle" size={7.5} color="currentColor">
            {t}
          </Label>
        </g>
      ))}
      <rect x="134" y="24" width="150" height="78" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <Label x={209} y={116} anchor="middle" bold color="currentColor" size={8}>
        the chart for that refrigerant
      </Label>
      <Label x={209} y={126} anchor="middle" size={7}>
        one pressure, one boiling temperature
      </Label>
    </svg>
  )
}
