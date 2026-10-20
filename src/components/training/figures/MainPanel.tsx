import type { FigureProps } from './figureProps'
import { Conductor, PanelBox } from './electricalParts'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The main panel and the main breaker (punch list #120): the two hots land on the lugs at the top and feed the
 * main breaker; below it the two bus bars carry every branch breaker; the neutral lands on its bar, the ground on
 * its own. With the main off everything under it is dead and the lugs above it are not. Lesson 3.
 */
export function MainPanel({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 170" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Conductor d="M140 2 V22" />
      <Conductor d="M160 2 V22" />
      <Conductor d="M108 2 V46" wire="neutral" />
      <PanelBox x={95} y={20} w={110} h={140} slots={4}>
        <rect x="41" y="4" width="28" height="12" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <text x="55" y="13" fontSize="7" fontWeight="600" fill="currentColor" textAnchor="middle">
          MAIN
        </text>
        <rect x="42" y="-4" width="8" height="6" fill="currentColor" />
        <rect x="60" y="-4" width="8" height="6" fill="currentColor" />
      </PanelBox>
      <Label x={88} y={10} anchor="end" size={7.5} bold color="currentColor">
        the lugs
      </Label>
      <Label x={88} y={19} anchor="end" size={7}>
        live with the main off
      </Label>
      <Label x={212} y={34} size={7.5} bold color="currentColor">
        main breaker
      </Label>
      <Label x={212} y={43} size={7}>
        kills everything below it
      </Label>
      <Label x={212} y={80} size={7.5} bold color="currentColor">
        bus bars
      </Label>
      <Label x={212} y={89} size={7}>
        the two hots
      </Label>
      <Label x={212} y={118} size={7.5} bold color="currentColor">
        branch breakers
      </Label>
      <Label x={212} y={127} size={7}>
        one circuit each
      </Label>
      <Label x={88} y={96} anchor="end" size={7.5} bold color="currentColor">
        neutral bar
      </Label>
      <Label x={88} y={105} anchor="end" size={7}>
        every white wire
      </Label>
      <Label x={88} y={136} anchor="end" size={7.5} bold color="currentColor">
        ground bar
      </Label>
      <Label x={88} y={145} anchor="end" size={7}>
        every bare or green wire
      </Label>
      <path d="M92 96 H103" fill="none" stroke="var(--text-muted)" strokeWidth="1" />
      <path d="M92 136 H197" fill="none" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="2 2" />
    </svg>
  )
}
