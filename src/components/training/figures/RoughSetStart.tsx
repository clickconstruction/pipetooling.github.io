import type { FigureProps } from './figureProps'
import { Box, Drop, Fan } from './hvacParts'
import { LINE } from './hvacTokens'
import { Label, Panel, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE } from './plumbingTokens'

/**
 * Rough-in, set and start-up (Intro to HVAC, lesson 28), in three frames: the ducts, the capped lines and the drain
 * in the open walls; the units set after the paint; the start-up a carded technician runs, with its gauge and the
 * water test.
 */
export function RoughSetStart({ titleId }: FigureProps) {
  const W = 96
  const H = 146
  const at = (i: number) => ({ x: 2 + i * (W + 4), y: 2 })
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="1 rough-in" sub="before the drywall">
        {[18, 46, 74].map((x) => (
          <rect key={x} x={x} y="36" width="6" height="74" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.1" />
        ))}
        <Pipe d="M8 54 H88" bore={12} tint="air" />
        <Pipe d="M8 80 H70" bore={LINE} tint="hot" />
        <rect x="70" y="76" width="5" height="8" rx="1" fill="currentColor" />
        <Pipe d="M8 96 L88 102" bore={4} tint="cold" />
        <Label x={48} y={128} anchor="middle" size={7}>
          ducts, capped lines
        </Label>
        <Label x={48} y={137} anchor="middle" size={7}>
          and the drain
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="2 set" sub="after the paint">
        <Box x={12} y={44} w={30} h={62} />
        <Fan x={27} y={86} r={10} />
        <Box x={52} y={62} w={34} h={44} />
        <Fan x={69} y={84} r={12} />
        <line x1="8" y1="106" x2="90" y2="106" stroke="var(--text-muted)" strokeWidth="1.2" />
        <Label x={48} y={128} anchor="middle" size={7}>
          the units, the registers
        </Label>
        <Label x={48} y={137} anchor="middle" size={7}>
          and the thermostat
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="3 start-up" sub="a carded technician" subColor={RIGHT}>
        <circle cx="30" cy="66" r="16" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <line x1="30" y1="66" x2="40" y2="56" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="30" cy="66" r="2" fill="currentColor" />
        <path d="M54 86 V96 H86 V86" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <Drop x={70} y={70} />
        <Drop x={62} y={78} size={0.8} />
        <path d="M22 96 l6 7 l12 -15" fill="none" stroke={RIGHT} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <Label x={48} y={128} anchor="middle" size={7} color={RIGHT}>
          leak tested, air out,
        </Label>
        <Label x={48} y={137} anchor="middle" size={7} color={RIGHT}>
          proved with water
        </Label>
      </Panel>
    </svg>
  )
}
