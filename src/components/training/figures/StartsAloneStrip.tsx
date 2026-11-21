import type { FigureProps } from './figureProps'
import { Conductor } from './electricalParts'
import { Box, Fan, Stat } from './hvacParts'
import { Label, Panel } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A unit that starts by itself, in four frames (Intro to HVAC, lesson 24): the quiet unit; the thermostat's call
 * starting it with nobody there; the disconnect pulled, locked and tagged; the wires tested dead before a hand
 * goes in.
 */
export function StartsAloneStrip({ titleId }: FigureProps) {
  const W = 72
  const H = 146
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const unit = (
    <>
      <Box x={20} y={64} w={40} h={50} />
      <Fan x={40} y={88} r={13} />
    </>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="1 quiet" sub="between two calls">
        {unit}
        <Label x={36} y={137} anchor="middle" size={7}>
          quiet is not off
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="2 the call" sub="it starts alone" subColor={WRONG}>
        <Stat x={14} y={46} />
        <Conductor d="M14 53 V72 H20" dash="3 2" />
        {unit}
        <g fill="none" stroke={WRONG} strokeWidth="1.5" strokeLinecap="round">
          <path d="M56 70 a22 22 0 0 1 4 16" />
          <path d="M24 106 a22 22 0 0 1 -4 -16" />
        </g>
        <Label x={36} y={137} anchor="middle" size={7} color={WRONG}>
          nobody is there
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="3 off, locked" sub="at the disconnect">
        <rect x="18" y="44" width="26" height="40" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <line x1="26" y1="76" x2="36" y2="56" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M44 86 v-5 a5 5 0 0 1 10 0 v5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="41" y="86" width="16" height="13" rx="2" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.5" />
        <rect x="24" y="96" width="12" height="18" rx="1.5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
        <line x1="27" y1="103" x2="33" y2="103" stroke="currentColor" strokeWidth="1" />
        <line x1="27" y1="108" x2="33" y2="108" stroke="currentColor" strokeWidth="1" />
        <Label x={36} y={128} anchor="middle" size={7}>
          a lock, and a tag
        </Label>
        <Label x={36} y={137} anchor="middle" size={7}>
          with a name
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="4 tested dead" sub="then hands go in" subColor={RIGHT}>
        <Conductor d="M10 78 H62" />
        <rect x="30" y="50" width="9" height="24" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" transform="rotate(20 34 62)" />
        <path d="M26 100 l7 8 l14 -18" fill="none" stroke={RIGHT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <Label x={36} y={128} anchor="middle" size={7} color={RIGHT}>
          tester proved
        </Label>
        <Label x={36} y={137} anchor="middle" size={7} color={RIGHT}>
          on a live outlet
        </Label>
      </Panel>
    </svg>
  )
}
