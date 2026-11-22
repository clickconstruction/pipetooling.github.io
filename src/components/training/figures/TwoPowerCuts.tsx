import type { FigureProps } from './figureProps'
import { Conductor } from './electricalParts'
import { Box, Fan, Stat } from './hvacParts'
import { Label, Panel } from './plumbingParts'
import { SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Two places to cut the power (Intro to HVAC, lesson 24), in two frames: outdoors, the disconnect that cuts the
 * outdoor unit and nothing else; indoors, the unit's own switch or breaker, which the blower and the thermostat's
 * 24 V stay live on until it is off.
 */
export function TwoPowerCuts({ titleId }: FigureProps) {
  const lock = (x: number, y: number) => (
    <>
      <path d={`M${x + 3} ${y} v-4 a4 4 0 0 1 8 0 v4`} fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x={x} y={y} width="14" height="11" rx="2" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.3" />
    </>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="outdoors" sub="the disconnect">
        <rect x="16" y="46" width="22" height="34" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <line x1="22" y1="72" x2="32" y2="54" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        {lock(20, 88)}
        <Conductor d="M38 62 H78" dash="3 2" />
        <Box x={78} y={46} w={48} h={56} />
        <Fan x={102} y={74} r={15} />
        <Label x={73} y={128} anchor="middle" bold color="currentColor" size={7.5}>
          cuts the outdoor unit
        </Label>
        <Label x={73} y={138} anchor="middle" size={7}>
          and nothing indoors
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="indoors" sub="its own switch or breaker">
        <rect x="16" y="56" width="16" height="24" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <rect x="21" y="62" width="6" height="12" rx="1.5" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1" />
        {lock(17, 88)}
        <Conductor d="M32 68 H70" />
        <Box x={70} y={42} w={40} h={62} />
        <Fan x={90} y={84} r={12} />
        <Stat x={128} y={52} />
        <Conductor d="M110 56 H120" dash="3 2" />
        <Label x={128} y={72} anchor="middle" size={6.5} color={WRONG}>
          24 V
        </Label>
        <Label x={73} y={128} anchor="middle" bold color="currentColor" size={7.5}>
          the blower and the 24 V
        </Label>
        <Label x={73} y={138} anchor="middle" size={7}>
          stay live until this is off
        </Label>
      </Panel>
    </svg>
  )
}
