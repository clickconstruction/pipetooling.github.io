import type { FigureProps } from './figureProps'
import { Box, Drop } from './hvacParts'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A clogged condensate drain in four frames (Intro to HVAC, lesson 19): slime in the trap; the pan filling; the
 * float switch tripping and the unit stopping; the line cleared and proved with a pour of water.
 */
export function CloggedDrainStrip({ titleId }: FigureProps) {
  const W = 72
  const H = 146
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const rig = (water: 'none' | 'full', clog: boolean, float: 'down' | 'up') => (
    <>
      <Box x={14} y={34} w={36} h={22} />
      {water === 'full' && <rect x="12.8" y="61" width="38.4" height="9" fill="var(--bg-blue-200)" />}
      <path d="M12 58 V70 H52 V58" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <Pipe d="M52 67 H57 V92 a4 4 0 0 0 8 0 V86" bore={3.4} tint={clog ? 'air' : 'cold'} />
      {clog && <circle cx="61" cy="95" r="3.4" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.1" />}
      <rect x="3.5" y="46" width="6" height="8" rx="1" fill="var(--surface)" stroke="currentColor" strokeWidth="1" />
      <line x1="6.5" y1="54" x2="6.5" y2={float === 'up' ? 57 : 62} stroke="currentColor" strokeWidth="1" />
      <circle cx="6.5" cy={float === 'up' ? 59.5 : 64.5} r="2.6" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1" />
    </>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="1 slime grows" sub="in the trap">
        {rig('none', true, 'down')}
        <Label x={36} y={128} anchor="middle" size={7}>
          the drain
        </Label>
        <Label x={36} y={137} anchor="middle" size={7}>
          is blocking
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="2 the pan fills" sub="nowhere to go" subColor={WRONG}>
        {rig('full', true, 'down')}
        <Drop x={24} y={74} />
        <Label x={36} y={128} anchor="middle" size={7} color={WRONG}>
          a ceiling
        </Label>
        <Label x={36} y={137} anchor="middle" size={7} color={WRONG}>
          at risk
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="3 float trips" sub="the unit stops">
        {rig('full', true, 'up')}
        <Label x={32} y={48} anchor="middle" size={7} bold color="currentColor">
          off
        </Label>
        <Label x={36} y={128} anchor="middle" size={7}>
          thermostat
        </Label>
        <Label x={36} y={137} anchor="middle" size={7}>
          to off first
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="4 clear, prove" sub="water runs out" subColor={RIGHT}>
        {rig('none', false, 'down')}
        <Flow x={57} y={80} angle={90} size={0.6} />
        <Drop x={65} y={78} />
        <Label x={36} y={128} anchor="middle" size={7} color={RIGHT}>
          pour water,
        </Label>
        <Label x={36} y={137} anchor="middle" size={7} color={RIGHT}>
          watch it leave
        </Label>
      </Panel>
    </svg>
  )
}
