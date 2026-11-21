import type { FigureProps } from './figureProps'
import { Air, Coil, Drop } from './hvacParts'
import { Label, Panel } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A frozen coil in four frames (Intro to HVAC, lesson 20): a clogged filter and too little air; ice starting on the
 * coil; the ice blocking the air; the thermostat off and the fan on, with room air melting it.
 */
export function FrozenCoilStrip({ titleId }: FigureProps) {
  const W = 72
  const H = 146
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const ICE = 'var(--bg-sky-100)'
  const coil = <Coil x={14} y={50} w={44} h={24} rows={3} tint="cold" />
  const filter = (clogged: boolean) => <rect x="12" y="96" width="48" height="6" fill={clogged ? 'currentColor' : 'var(--bg-subtle)'} stroke="currentColor" strokeWidth="1.2" />
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="1 the filter" sub="clogged, little air">
        {coil}
        {filter(true)}
        <Air x={36} y={122} angle={-90} len={14} />
        <Label x={36} y={137} anchor="middle" size={7}>
          air is held back
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="2 ice starts" sub="the coil is too cold" subColor={WRONG}>
        {coil}
        <g fill={ICE} stroke="currentColor" strokeWidth="0.8">
          <rect x="14" y="46" width="16" height="9" rx="3" />
          <rect x="38" y="57" width="18" height="9" rx="3" />
          <rect x="18" y="69" width="14" height="9" rx="3" />
        </g>
        {filter(true)}
        <Label x={36} y={128} anchor="middle" size={7}>
          water turns
        </Label>
        <Label x={36} y={137} anchor="middle" size={7}>
          to ice
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="3 ice blocks it" sub="no air, no cooling" subColor={WRONG}>
        {coil}
        <rect x="10" y="44" width="52" height="36" rx="5" fill={ICE} stroke="currentColor" strokeWidth="1" />
        {filter(true)}
        <Label x={36} y={128} anchor="middle" size={7} color={WRONG}>
          it never thaws
        </Label>
        <Label x={36} y={137} anchor="middle" size={7} color={WRONG}>
          while it runs
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="4 off, fan on" sub="let it melt" subColor={RIGHT}>
        {coil}
        <Drop x={24} y={80} />
        <Drop x={36} y={82} />
        <Drop x={48} y={80} />
        {filter(false)}
        <Air x={36} y={122} angle={-90} len={14} tint="warm" />
        <Label x={36} y={137} anchor="middle" size={7} color={RIGHT}>
          then a new filter
        </Label>
      </Panel>
    </svg>
  )
}
