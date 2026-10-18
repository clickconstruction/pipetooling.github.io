import type { FigureProps } from './figureProps'
import { Flow, Hatch, Label, Panel, Pipe, Seal } from './plumbingParts'
import { DRAIN, RIGHT, SVG_STYLE } from './plumbingTokens'

/**
 * A flush in four frames (punch list #119): the tank dumps into the bowl, the bowl's own trap siphons, the vent lets
 * air follow the water down the stack, the fill valve refills the tank from the supply. Lesson 20.
 */
export function FlushStrip({ titleId }: FigureProps) {
  const h = `${titleId}-seal`
  const W = 72
  const H = 146
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const toilet = (tankTint: string, bowlLevel: number) => (
    <g stroke="currentColor" strokeWidth="1.5">
      <rect x="10" y="34" width="22" height="26" rx="2" fill={tankTint} />
      <path d="M14 60 h30 q8 0 8 8 v6 q0 10 -12 10 h-14 q-12 0 -12 -10 z" fill="var(--surface)" />
      <rect x="18" y={84 - bowlLevel} width="18" height={bowlLevel} fill="var(--bg-blue-200)" stroke="none" />
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Hatch id={h} />
      <Panel {...at(0)} w={W} h={H} title="1 press" sub="the tank dumps">
        {toilet('var(--bg-blue-200)', 10)}
        <Flow x={21} y={66} angle={90} />
        <Pipe d="M30 84 V96 a8 8 0 0 0 16 0 V120" bore={9} tint="waste" />
        <Seal d="M30 88 V96 a8 8 0 0 0 16 0 V88" bore={9} id={h} />
        <Label x={36} y={136} anchor="middle" size={7}>
          the flapper lifts
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="2 siphon" sub="the bowl empties">
        {toilet('var(--surface)', 18)}
        <Pipe d="M30 84 V96 a8 8 0 0 0 16 0 V120" bore={9} tint="waste" />
        <Flow x={46} y={110} angle={90} />
        <Flow x={30} y={92} angle={90} />
        <Label x={36} y={136} anchor="middle" size={7}>
          its own trap pulls
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="3 the vent" sub="air follows">
        <Pipe d="M36 30 V120" bore={DRAIN} tint="waste" />
        <Pipe d="M36 30 V34" bore={DRAIN} tint="air" />
        <Flow x={36} y={44} angle={90} color="var(--text-muted)" />
        <Flow x={36} y={56} angle={90} color="var(--text-muted)" />
        <Flow x={36} y={96} angle={90} />
        <Flow x={36} y={108} angle={90} />
        <Label x={46} y={48} size={7} color="var(--text-muted)">
          air
        </Label>
        <Label x={46} y={104} size={7}>
          water
        </Label>
        <Label x={36} y={136} anchor="middle" size={7}>
          down the stack
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="4 refill" sub="the supply" subColor={RIGHT}>
        {toilet('var(--bg-blue-200)', 12)}
        <Pipe d="M4 46 H10" bore={5} />
        <Flow x={6} y={46} size={0.8} color={RIGHT} />
        <circle cx="26" cy="40" r="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
        <Pipe d="M30 84 V96 a8 8 0 0 0 16 0 V120" bore={9} tint="waste" />
        <Seal d="M30 88 V96 a8 8 0 0 0 16 0 V88" bore={9} id={h} />
        <Label x={36} y={136} anchor="middle" size={7}>
          the float shuts it
        </Label>
      </Panel>
    </svg>
  )
}
