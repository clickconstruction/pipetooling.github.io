import type { FigureProps } from './figureProps'
import { Box, Drop } from './hvacParts'
import { Label, Panel, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The four ways the code allows for the second defence (Intro to HVAC, lesson 9), one frame each: a second pan with
 * a drain of its own; an overflow drain from the unit's pan, higher than the first; a second pan with no drain and a
 * float switch; a float switch alone.
 */
export function FourDefences({ titleId }: FigureProps) {
  const W = 72
  const H = 146
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const unit = (
    <>
      <Box x={14} y={44} w={38} h={24} />
      <Pipe d="M52 62 H68" bore={3.4} tint="cold" />
    </>
  )
  const pan = <path d="M4 66 V82 H58 V66" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  const float = (x: number, y: number) => (
    <>
      <rect x={x - 3} y={y - 12} width="6" height="8" rx="1" fill="var(--surface)" stroke="currentColor" strokeWidth="1" />
      <line x1={x} y1={y - 4} x2={x} y2={y - 1} stroke="currentColor" strokeWidth="1" />
      <circle cx={x} cy={y + 1.6} r="2.6" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1" />
    </>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="1 pan, drain" sub="its own drain">
        {unit}
        {pan}
        <Pipe d="M58 79 H68" bore={3.4} tint="air" />
        <Drop x={66} y={86} size={0.8} />
        <Label x={36} y={128} anchor="middle" size={7}>
          drips where
        </Label>
        <Label x={36} y={137} anchor="middle" size={7}>
          it is seen
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="2 overflow" sub="a second drain">
        {unit}
        <Pipe d="M52 52 H68" bore={3.4} tint="air" />
        <Label x={36} y={128} anchor="middle" size={7}>
          leaves the pan
        </Label>
        <Label x={36} y={137} anchor="middle" size={7}>
          above the first
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="3 pan, float" sub="no second drain">
        {unit}
        {pan}
        {float(9, 76)}
        <Label x={36} y={128} anchor="middle" size={7}>
          the float stops
        </Label>
        <Label x={36} y={137} anchor="middle" size={7}>
          the unit
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="4 float alone" sub="no second pan">
        {unit}
        {float(60, 54)}
        <Label x={36} y={128} anchor="middle" size={7}>
          set where a clog
        </Label>
        <Label x={36} y={137} anchor="middle" size={7}>
          will lift it
        </Label>
      </Panel>
    </svg>
  )
}
