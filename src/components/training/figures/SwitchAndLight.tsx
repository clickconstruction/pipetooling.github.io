import type { FigureProps } from './figureProps'
import { Conductor, Current, Load, Switch } from './electricalParts'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * Switches and lights (punch list #120): the hot runs from the panel to the switch on its line side, up the
 * switch leg to the light, and back to the panel on the neutral; the switch is drawn open, so the switch leg is
 * dead and the line side is still live. Lesson 12.
 */
export function SwitchAndLight({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 130" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <rect x="6" y="20" width="40" height="92" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={26} y={34} anchor="middle" size={7}>
        panel
      </Label>
      <Conductor d="M46 76 H132" />
      <Current x={90} y={76} />
      <rect x="128" y="60" width="30" height="32" rx="3" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" strokeDasharray="3 2" />
      <Switch x={143} y={76} open />
      <Conductor d="M151 76 H190 V34 H220" dash="4 3" />
      <Load x={230} y={34} kind="lamp" />
      <Conductor d="M240 34 H280 V110 H46" wire="neutral" />
      <Label x={84} y={58} anchor="middle" size={7.5} bold color="currentColor">
        line side: live
      </Label>
      <Label x={88} y={68} anchor="middle" size={7}>
        when the breaker is on
      </Label>
      <Label x={143} y={103} anchor="middle" size={7}>
        the switch, off
      </Label>
      <Label x={186} y={27} anchor="end" size={7.5} bold color="currentColor">
        switch leg
      </Label>
      <Label x={186} y={47} anchor="end" size={7}>
        live only when on
      </Label>
      <Label x={160} y={121} anchor="middle" size={7}>
        neutral
      </Label>
      <Label x={230} y={57} anchor="middle" size={7}>
        the light, dark
      </Label>
    </svg>
  )
}
