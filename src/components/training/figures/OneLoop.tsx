import type { FigureProps } from './figureProps'
import { Breaker, Conductor, Current, Ground, Load } from './electricalParts'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * One loop, out and back (punch list #120): current leaves the panel on the hot, through its breaker, does its work
 * in the light and comes back on the neutral; the ground runs from the light's metal case back to the panel and
 * ends in the earth, with no arrow on it, because it waits for a fault. Lesson 1.
 */
export function OneLoop({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <rect x="16" y="28" width="54" height="92" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={43} y={44} anchor="middle" bold color="currentColor">
        the panel
      </Label>
      <Conductor d="M40 50 H78 M94 50 H206 V64" />
      <Breaker x={86} y={50} amps={15} />
      <Current x={140} y={50} />
      <Current x={185} y={50} />
      <rect x="186" y="56" width="40" height="40" rx="3" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" strokeDasharray="3 2" />
      <Load x={206} y={76} kind="lamp" />
      <Conductor d="M206 88 V100 H40" wire="neutral" />
      <Current x={185} y={100} angle={180} />
      <Current x={140} y={100} angle={180} />
      <Conductor d="M226 90 H250 V122 H43 V128" wire="ground" />
      <Ground x={43} y={128} />
      <Label x={140} y={41} anchor="middle" bold color="currentColor">
        hot: out
      </Label>
      <Label x={140} y={112} anchor="middle" bold color="currentColor">
        neutral: back
      </Label>
      <Label x={150} y={134} anchor="middle" size={8}>
        ground: waits for a fault
      </Label>
      <Label x={234} y={72} size={8}>
        the light
      </Label>
      <Label x={234} y={81} size={7.5}>
        does the work
      </Label>
      <Label x={43} y={70} anchor="middle" size={7.5}>
        breaker
      </Label>
      <Label x={43} y={79} anchor="middle" size={7.5}>
        at the top
      </Label>
    </svg>
  )
}
