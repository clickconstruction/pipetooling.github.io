import type { FigureProps } from './figureProps'
import { Label } from './plumbingParts'
import { SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Carbon monoxide on one scale (Intro to HVAC, lesson 15): three bars drawn to scale, OSHA's 50 ppm limit over a
 * work day, the 70 ppm a home alarm may take hours to sound at, and the 1,200 ppm that is an immediate danger to
 * life. The first two are slivers beside the third, which is the point.
 */
export function CoScale({ titleId }: FigureProps) {
  const X = 78
  const PER = 0.15
  const rows: Array<{ ppm: number; text: string; note: string; danger?: boolean }> = [
    { ppm: 50, text: '50 ppm', note: "OSHA's limit, averaged over 8 hours" },
    { ppm: 70, text: '70 ppm', note: 'a home alarm may take 1 to 4 hours' },
    { ppm: 1200, text: '1,200 ppm', note: 'an immediate danger to life', danger: true },
  ]
  return (
    <svg viewBox="0 0 300 138" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Label x={8} y={16} bold color="currentColor" size={8}>
        carbon monoxide, parts per million
      </Label>
      <line x1={X} y1="26" x2={X} y2="116" stroke="currentColor" strokeWidth="1.5" />
      {rows.map((r, i) => {
        const y = 34 + i * 30
        return (
          <g key={r.ppm}>
            <rect x={X} y={y} width={r.ppm * PER} height="12" fill={r.danger ? WRONG : 'var(--bg-amber-100)'} stroke="currentColor" strokeWidth="1" />
            <Label x={X - 6} y={y + 10} anchor="end" bold color={r.danger ? WRONG : 'currentColor'} size={8.5}>
              {r.text}
            </Label>
            <Label x={X + 4} y={y + 23} size={7}>
              {r.note}
            </Label>
          </g>
        )
      })}
      <Label x={292} y={132} anchor="end" size={6.5}>
        the bars are drawn to scale
      </Label>
    </svg>
  )
}
