import type { FigureProps } from './figureProps'
import { Breaker, Conductor, Receptacle } from './electricalParts'
import { Label, Panel } from './plumbingParts'
import { RIGHT, SVG_STYLE } from './plumbingTokens'

/**
 * What is live and how to know, in three frames (punch list #120): the non-contact tester beeps on an outlet that
 * is known live, so the tester is proved; it goes to the wire with the breaker off and stays quiet; it goes back
 * to the known outlet and beeps again, so the quiet meant dead. Lesson 26.
 */
export function TestBeforeTouch({ titleId }: FigureProps) {
  const W = 96
  const at = (i: number) => ({ x: 2 + i * (W + 4), y: 2 })
  const tester = (x: number, y: number, beep: boolean) => (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-4" y="0" width="8" height="34" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="0" cy="6" r="2" fill={beep ? RIGHT : 'var(--bg-subtle)'} stroke="none" />
      {beep && (
        <g fill="none" stroke={RIGHT} strokeWidth="1.3">
          <path d="M-8 -4 a10 10 0 0 1 16 0" />
          <path d="M-12 -8 a16 16 0 0 1 24 0" />
        </g>
      )}
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={146} title="1 the tester" sub="on a known live outlet" subColor={RIGHT}>
        <Receptacle x={34} y={80} />
        {tester(56, 66, true)}
        <Label x={48} y={122} anchor="middle" size={6.5} color={RIGHT}>
          it beeps, so it works
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={146} title="2 the wire" sub="with the breaker off">
        <Conductor d="M8 50 H26 M42 50 H60" />
        <Breaker x={34} y={50} open />
        <Conductor d="M60 50 V80 H36" />
        {tester(44, 84, false)}
        <Label x={48} y={128} anchor="middle" size={6.5}>
          quiet, and quiet means dead
        </Label>
        <Label x={48} y={137} anchor="middle" size={6.5}>
          only because of frame 1
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={146} title="3 again" sub="back on the known outlet" subColor={RIGHT}>
        <Receptacle x={34} y={80} />
        {tester(56, 66, true)}
        <Label x={48} y={122} anchor="middle" size={6.5} color={RIGHT}>
          it still works
        </Label>
        <Label x={48} y={131} anchor="middle" size={6.5}>
          now the wire is dead
        </Label>
      </Panel>
    </svg>
  )
}
