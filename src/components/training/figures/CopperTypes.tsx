import type { FigureProps } from './figureProps'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Copper types M, L and K (punch list #119, second pass): three lengths of pipe with the printed marking in the
 * type's colour, red, blue and green, and the end of each cut to show the wall, thin to thick. Lesson 6.
 */
const COPPER = '#c0703d'
const ROWS: Array<{ type: string; print: string; wall: number; name: string; use: string }> = [
  { type: 'M', print: '#dc2626', wall: 2, name: 'M, the thin one', use: 'red print, houses' },
  { type: 'L', print: '#2563eb', wall: 4, name: 'L, medium', use: 'blue print, houses' },
  { type: 'K', print: '#15803d', wall: 6.5, name: 'K, the thick one', use: 'green print, underground' },
]

export function CopperTypes({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 134" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      {ROWS.map((r, i) => {
        const c = 24 + i * 40
        return (
          <g key={r.type}>
            <rect x="30" y={c - 12} width="160" height="24" fill={COPPER} stroke="currentColor" strokeWidth="1.2" />
            <circle cx="30" cy={c} r="12" fill={COPPER} stroke="currentColor" strokeWidth="1.2" />
            <circle cx="30" cy={c} r={12 - r.wall} fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1" />
            <text x="112" y={c + 3.5} fontSize="9" fontFamily="ui-monospace, monospace" fontWeight="700" fill={r.print} textAnchor="middle" stroke="none" letterSpacing="1.5">
              {`TYPE ${r.type}  3/4  COPPER`}
            </text>
            <Label x={198} y={c - 1} size={7.5} bold color="currentColor">
              {r.name}
            </Label>
            <Label x={198} y={c + 9} size={7}>
              {r.use}
            </Label>
          </g>
        )
      })}
      <Label x={6} y={128} size={7}>
        the cut end shows the wall. The letters do not run thin to thick in order.
      </Label>
    </svg>
  )
}
