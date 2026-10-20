import type { FigureProps } from './figureProps'
import { Conductor, Meter } from './electricalParts'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The service drop and the meter (punch list #120): three wires, two hots and the neutral, sag from the pole to
 * the weatherhead on the house, run down to the meter in its base on the outside wall, and on through the wall
 * to the panel. Everything from the pole to the meter is the utility's and never off. Lesson 2.
 */
export function ServiceAndMeter({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <line x1="0" y1="128" x2="300" y2="128" />
        <line x1="22" y1="128" x2="22" y2="14" strokeWidth="3" />
        <line x1="8" y1="22" x2="36" y2="22" strokeWidth="2" />
        <path d="M176 48 L238 20 L300 48" />
        <rect x="176" y="48" width="124" height="80" fill="var(--bg-subtle)" />
      </g>
      <Conductor d="M24 26 Q100 78 176 52" />
      <Conductor d="M30 22 Q106 74 178 56" />
      <Conductor d="M18 30 Q96 84 174 60" wire="neutral" />
      <path d="M176 50 q6 -4 8 2 v14" fill="none" stroke="currentColor" strokeWidth="3" />
      <line x1="184" y1="66" x2="184" y2="88" stroke="currentColor" strokeWidth="4" />
      <Meter x={196} y={106} />
      <Conductor d="M210 106 H246" />
      <rect x="246" y="90" width="44" height="32" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={268} y={110} anchor="middle" bold color="currentColor" size={8}>
        panel
      </Label>
      <g stroke="var(--text-muted)" strokeWidth="1.2" fill="none">
        <path d="M14 140 V146 H200 V140" />
        <path d="M246 140 V146 H292 V140" />
      </g>
      <Label x={107} y={138} anchor="middle" size={8} bold color="currentColor">
        the utility's, never off
      </Label>
      <Label x={269} y={138} anchor="middle" size={8}>
        the house's
      </Label>
      <Label x={22} y={10} anchor="middle" size={7.5}>
        pole
      </Label>
      <Label x={94} y={82} anchor="middle" size={7.5}>
        two hots and a neutral
      </Label>
      <Label x={172} y={76} anchor="end" size={7.5}>
        weatherhead
      </Label>
      <Label x={214} y={124} size={7}>
        meter
      </Label>
      <Label x={238} y={36} anchor="middle" size={7.5}>
        house
      </Label>
    </svg>
  )
}
