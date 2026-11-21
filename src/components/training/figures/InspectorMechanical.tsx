import type { FigureProps } from './figureProps'
import { Label, Person } from './plumbingParts'
import { RIGHT, SVG_STYLE } from './plumbingTokens'

/**
 * What the inspector looks at (Intro to HVAC, lesson 29): the mechanical inspector with a clipboard and the six
 * things on the list, each with what is read on it.
 */
export function InspectorMechanical({ titleId }: FigureProps) {
  const rows: Array<[string, string]> = [
    ['the drain', 'size, slope, trap, where it ends'],
    ['the second defence', 'a second pan and drain, or a float'],
    ['the attic', 'opening, walkway, light, outlet'],
    ['the gas', 'shutoff, sediment trap, connector'],
    ["the closet's air", 'two openings, both clear'],
    ['the vent', 'slope, joints, what shares it'],
  ]
  return (
    <svg viewBox="0 0 300 172" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Person x={30} y={150} h={64} arm="out" />
      <rect x="44" y="92" width="16" height="22" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <line x1="48" y1="99" x2="56" y2="99" stroke="currentColor" strokeWidth="1" />
      <line x1="48" y1="104" x2="56" y2="104" stroke="currentColor" strokeWidth="1" />
      <line x1="48" y1="109" x2="56" y2="109" stroke="currentColor" strokeWidth="1" />
      <line x1="6" y1="150" x2="64" y2="150" stroke="var(--text-muted)" strokeWidth="1.2" />
      {rows.map(([what, read], i) => {
        const y = 22 + i * 25
        return (
          <g key={what}>
            <rect x="84" y={y - 9} width="11" height="11" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
            <path d={`M86 ${y - 4} l3 3.4 l5 -7`} fill="none" stroke={RIGHT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <Label x={102} y={y - 1} bold color="currentColor" size={8.5}>
              {what}
            </Label>
            <Label x={102} y={y + 9} size={7}>
              {read}
            </Label>
          </g>
        )
      })}
    </svg>
  )
}
