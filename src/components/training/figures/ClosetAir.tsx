import type { FigureProps } from './figureProps'
import { Air, Box, Flame } from './hvacParts'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Combustion air (Intro to HVAC, lesson 13): a closet holding a furnace and a water heater, fed by two openings
 * to the rest of the house, one starting within 12 in of the top and one within 12 in of the bottom.
 */
export function ClosetAir({ titleId }: FigureProps) {
  const louvre = (y: number) => (
    <g>
      <rect x="107" y={y} width="6" height="18" fill="var(--surface)" stroke="none" />
      {[3, 9, 15].map((d) => (
        <line key={d} x1="106" y1={y + d + 2} x2="114" y2={y + d - 2} stroke="currentColor" strokeWidth="1.3" />
      ))}
    </g>
  )
  return (
    <svg viewBox="0 0 300 184" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Box x={110} y={22} w={150} h={136} fill="var(--bg-subtle)" />
      {louvre(30)}
      {louvre(132)}
      <Box x={124} y={58} w={50} h={98} />
      <rect x="196" y="84" width="46" height="72" rx="10" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Flame x={149} y={152} size={0.7} />
      <Flame x={219} y={153} size={0.7} />
      <Air x={60} y={39} len={38} />
      <Air x={60} y={141} len={38} />
      <Label x={6} y={26} bold color="currentColor" size={8}>
        one opening high
      </Label>
      <Label x={6} y={58} size={6.5}>
        within 12 in of the top
      </Label>
      <Label x={6} y={128} bold color="currentColor" size={8}>
        one opening low
      </Label>
      <Label x={6} y={160} size={6.5}>
        within 12 in of the bottom
      </Label>
      <Label x={149} y={104} anchor="middle" size={7.5}>
        furnace
      </Label>
      <Label x={219} y={116} anchor="middle" size={6.5}>
        water heater
      </Label>
      <Label x={185} y={14} anchor="middle" size={7.5}>
        a closet with two burners
      </Label>
      <Label x={185} y={174} anchor="middle" bold color="currentColor" size={7.5}>
        each opening at least 100 sq in
      </Label>
    </svg>
  )
}
