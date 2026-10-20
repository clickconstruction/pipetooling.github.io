import type { FigureProps } from './figureProps'
import { Conductor, Current, Load } from './electricalParts'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * 120 and 240 (punch list #120): the two hots and the neutral run across from the panel; a lamp between one hot
 * and the neutral is a 120 V circuit, and an element between the two hots is 240 V with no neutral. Lesson 5.
 */
export function OneTwentyTwoForty({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 140" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <rect x="4" y="18" width="36" height="98" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={22} y={32} anchor="middle" size={7}>
        panel
      </Label>
      <Conductor d="M40 44 H290" />
      <Conductor d="M40 74 H290" />
      <Conductor d="M40 104 H290" wire="neutral" />
      <Label x={296} y={41} anchor="end" size={7} bold color="currentColor">
        hot A
      </Label>
      <Label x={296} y={71} anchor="end" size={7} bold color="currentColor">
        hot B
      </Label>
      <Label x={296} y={101} anchor="end" size={7} bold color="currentColor">
        neutral
      </Label>
      <Conductor d="M100 44 V58" />
      <Current x={100} y={52} angle={90} />
      <Load x={100} y={68} kind="lamp" />
      <Conductor d="M100 78 V104" wire="neutral" />
      <Current x={100} y={92} angle={90} />
      <Label x={100} y={124} anchor="middle" size={8} bold color="currentColor">
        120 V
      </Label>
      <Label x={100} y={134} anchor="middle" size={7}>
        one hot to the neutral
      </Label>
      <Conductor d="M210 44 V50" />
      <Load x={210} y={59} kind="element" w={30} h={18} />
      <Conductor d="M210 68 V74" />
      <Current x={210} y={47} angle={90} />
      <Current x={210} y={71} angle={90} />
      <Label x={210} y={124} anchor="middle" size={8} bold color="currentColor">
        240 V
      </Label>
      <Label x={210} y={134} anchor="middle" size={7}>
        hot to hot, no neutral
      </Label>
      <Label x={210} y={94} anchor="middle" size={7}>
        the water heater
      </Label>
    </svg>
  )
}
