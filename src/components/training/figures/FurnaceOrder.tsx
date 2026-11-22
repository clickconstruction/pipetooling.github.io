import type { FigureProps } from './figureProps'
import { Air, Fan, Flame, Stat } from './hvacParts'
import { FLAME } from './hvacTokens'
import { Label, Panel } from './plumbingParts'
import { RIGHT, SVG_STYLE } from './plumbingTokens'

/**
 * The order a gas furnace starts in (Intro to HVAC, lesson 11), in four frames: the thermostat's call and the
 * inducer proved by its pressure switch; the igniter and the gas valve; the flame proved by its sensor; the blower.
 */
export function FurnaceOrder({ titleId }: FigureProps) {
  const W = 72
  const H = 146
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="1 the call" sub="the inducer pulls">
        <Stat x={20} y={50} />
        <Fan x={44} y={86} r={14} />
        <Label x={36} y={128} anchor="middle" size={7}>
          a pressure switch
        </Label>
        <Label x={36} y={137} anchor="middle" size={7}>
          proves it pulls
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="2 the igniter" sub="it glows">
        <rect x="18" y="82" width="36" height="7" rx="3" fill={FLAME} stroke="currentColor" strokeWidth="1.1" />
        <line x1="36" y1="89" x2="36" y2="104" stroke="currentColor" strokeWidth="1.5" />
        <g stroke={FLAME} strokeWidth="1.4" strokeLinecap="round">
          <line x1="22" y1="76" x2="20" y2="68" />
          <line x1="36" y1="76" x2="36" y2="66" />
          <line x1="50" y1="76" x2="52" y2="68" />
        </g>
        <Label x={36} y={128} anchor="middle" size={7}>
          then the gas
        </Label>
        <Label x={36} y={137} anchor="middle" size={7}>
          valve opens
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="3 the flame" sub="the burners light">
        <Flame x={22} y={96} size={1.1} />
        <Flame x={38} y={96} size={1.1} />
        <line x1="56" y1="100" x2="56" y2="74" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="98" x2="62" y2="98" stroke="currentColor" strokeWidth="1.5" />
        <Label x={36} y={128} anchor="middle" size={7}>
          a flame sensor
        </Label>
        <Label x={36} y={137} anchor="middle" size={7}>
          proves it is lit
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="4 the blower" sub="air to the rooms" subColor={RIGHT}>
        <Fan x={36} y={96} r={14} />
        <Air x={36} y={76} angle={-90} len={24} tint="warm" />
        <Label x={36} y={128} anchor="middle" size={7}>
          once the metal
        </Label>
        <Label x={36} y={137} anchor="middle" size={7}>
          is warm
        </Label>
      </Panel>
    </svg>
  )
}
