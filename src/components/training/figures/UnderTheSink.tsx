import type { FigureProps } from './figureProps'
import { Conductor, Load, Receptacle, Switch } from './electricalParts'
import { Label, Pipe, Sink } from './plumbingParts'
import { DRAIN, SVG_STYLE } from './plumbingTokens'

/**
 * The disposal and the dishwasher (punch list #120): the sink above, the cabinet below with the disposal on the
 * drain and its switched outlet on the cabinet wall, the wall switch above the counter; the dishwasher beside it
 * with its own circuit from the panel and its box behind the kick plate. Both boxes are live. Lesson 16.
 */
export function UnderTheSink({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <line x1="0" y1="56" x2="150" y2="56" />
        <rect x="30" y="56" width="110" height="84" fill="var(--surface)" />
        <rect x="150" y="56" width="70" height="84" fill="var(--bg-subtle)" />
        <line x1="0" y1="140" x2="300" y2="140" />
      </g>
      <Sink x={85} y={38} w={40} />
      <Pipe d="M85 56 V72" bore={DRAIN} tint="waste" />
      <Load x={85} y={86} kind="motor" />
      <Label x={70} y={120} anchor="middle" size={6.5}>
        the disposal
      </Label>
      <Conductor d="M95 86 H108 V104 H118" />
      <Receptacle x={128} y={110} />
      <Conductor d="M28 34 H44 V110 H118" />
      <Switch x={20} y={34} open />
      <Label x={6} y={20} size={7}>
        the switch on the wall
      </Label>
      <Label x={100} y={134} anchor="middle" size={6.5} bold color="currentColor">
        switched outlet, live
      </Label>
      <Label x={185} y={70} anchor="middle" size={7} bold color="currentColor">
        dishwasher
      </Label>
      <rect x="158" y="118" width="22" height="16" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <Conductor d="M180 126 H226 V80 H234" />
      <rect x="234" y="60" width="40" height="40" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={254} y={83} anchor="middle" size={7}>
        panel
      </Label>
      <Label x={169} y={113} anchor="middle" size={6.5} bold color="currentColor">
        live box
      </Label>
      <Label x={256} y={116} anchor="middle" size={6.5}>
        its own circuit
      </Label>
      <Label x={254} y={50} anchor="middle" size={6.5}>
        two breakers, two tests
      </Label>
    </svg>
  )
}
