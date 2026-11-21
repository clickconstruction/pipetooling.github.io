import type { FigureProps } from './figureProps'
import { Conductor } from './electricalParts'
import { Air, Box, Stat } from './hvacParts'
import { Label, Panel } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The filter, the airflow and the thermostat (Intro to HVAC, lesson 17), in two frames: the filter with its arrow
 * pointing the way the air goes, toward the unit; and the thermostat's thin cable, one wire for each call.
 */
export function FilterAndStat({ titleId }: FigureProps) {
  const wires: Array<[string, string]> = [
    ['R', 'power'],
    ['Y', 'cool'],
    ['G', 'fan'],
    ['W', 'heat'],
    ['C', 'back'],
  ]
  return (
    <svg viewBox="0 0 300 152" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={148} title="the filter" sub="its arrow points to the unit">
        <rect x="52" y="40" width="14" height="78" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.5" />
        <path d="M54 44 l10 6 l-10 6 l10 6 l-10 6 l10 6 l-10 6 l10 6 l-10 6 l10 6 l-10 6 l10 6" fill="none" stroke="currentColor" strokeWidth="0.9" />
        <Air x={12} y={66} len={30} tint="warm" />
        <Air x={12} y={96} len={30} tint="warm" />
        <Air x={72} y={80} len={22} tint="warm" />
        <Box x={100} y={46} w={36} h={66} />
        <Label x={118} y={82} anchor="middle" size={7}>
          the unit
        </Label>
        <Label x={59} y={134} anchor="middle" bold color="currentColor" size={7.5}>
          in the return
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={148} title="the thermostat" sub="24 V, one wire a call">
        <Stat x={73} y={44} />
        {wires.map(([letter, word], i) => {
          const x = 25 + i * 24
          return (
            <g key={letter}>
              <Conductor d={`M${61 + i * 6} 51 V62 H${x} V104`} />
              <Label x={x} y={116} anchor="middle" bold color="currentColor" size={8}>
                {letter}
              </Label>
              <Label x={x} y={126} anchor="middle" size={6.5}>
                {word}
              </Label>
            </g>
          )
        })}
        <Label x={73} y={141} anchor="middle" size={7}>
          at the indoor unit
        </Label>
      </Panel>
    </svg>
  )
}
