import type { FigureProps } from './figureProps'
import { Box, Flame } from './hvacParts'
import { Label, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * What the inspector looks at (Intro to HVAC, lesson 29): a house in section with the six places on the list
 * numbered where they are, the attic unit's drain and its second pan, the attic's opening and walkway, the gas at the closet,
 * the closet's two air openings and the vent through the roof, and the six named under the drawing.
 */
export function InspectorMechanical({ titleId }: FigureProps) {
  const spot = (n: number, x: number, y: number) => (
    <g>
      <circle cx={x} cy={y} r="6.5" fill="currentColor" />
      <text x={x} y={y + 3} fontSize="8.5" fontWeight="700" fill="var(--surface)" textAnchor="middle">
        {n}
      </text>
    </g>
  )
  const names = ['the drain', 'the second defence', 'the attic', 'the gas', "the closet's air", 'the vent']
  return (
    <svg viewBox="0 0 300 204" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M8 88 L150 14 L292 88" />
        <path d="M18 88 V146 H282 V88" />
        <path d="M18 88 H84 M102 88 H282" />
      </g>
      <Pipe d="M52 100 V44" bore={5} tint="hot" />
      <Box x={30} y={100} w={62} h={46} fill="var(--bg-subtle)" />
      <rect x="38" y="114" width="18" height="32" rx="6" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
      <Box x={64} y={112} w={18} h={34} />
      <Flame x={47} y={143} size={0.4} />
      <Flame x={73} y={143} size={0.4} />
      <rect x="89" y="103" width="6" height="9" fill="var(--surface)" stroke="none" />
      <rect x="89" y="134" width="6" height="9" fill="var(--surface)" stroke="none" />
      <g stroke="currentColor" strokeWidth="1.2">
        <line x1="88" y1="106" x2="96" y2="104" />
        <line x1="88" y1="110" x2="96" y2="108" />
        <line x1="88" y1="137" x2="96" y2="135" />
        <line x1="88" y1="141" x2="96" y2="139" />
      </g>
      <Pipe d="M18 132 H38" bore={3} tint="air" />
      <Pipe d="M28 132 V140" bore={3} tint="air" />
      <Box x={124} y={56} w={44} h={22} />
      <path d="M118 76 V85 H174 V76" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <Pipe d="M168 70 L262 81" bore={3.4} tint="cold" />
      <line x1="102" y1="86" x2="118" y2="86" stroke="currentColor" strokeWidth="3.4" />
      {spot(1, 214, 64)}
      {spot(2, 146, 98)}
      {spot(3, 104, 72)}
      {spot(4, 9, 122)}
      {spot(5, 108, 124)}
      {spot(6, 68, 40)}
      {names.map((name, i) => {
        const x = i < 3 ? 22 : 164
        const y = 162 + (i % 3) * 14
        return (
          <g key={name}>
            {spot(i + 1, x, y)}
            <Label x={x + 12} y={y + 3} size={8} color="currentColor">
              {name}
            </Label>
          </g>
        )
      })}
    </svg>
  )
}
