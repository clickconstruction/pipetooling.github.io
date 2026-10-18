import type { FigureProps } from './figureProps'
import { Breaker, Conductor, Current, Meter } from './electricalParts'
import { Label, Panel, Person } from './plumbingParts'
import { SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A generator or a solar backfeed in three frames (punch list #120): the utility is off and the main is open; a
 * generator or the array pushes power the other way, through the panel and out through the meter to the street,
 * in the house red; and the wire the plumber thought was dead reads live from the other end. Lesson 25.
 */
export function BackfeedStrip({ titleId }: FigureProps) {
  const W = 96
  const at = (i: number) => ({ x: 2 + i * (W + 4), y: 2 })
  const scene = (feeding: boolean) => (
    <g>
      <line x1="10" y1="40" x2="10" y2="110" stroke="currentColor" strokeWidth="2.5" />
      <Conductor d="M12 46 H30" dash={feeding ? undefined : '2 2'} />
      <Meter x={42} y={60} />
      <Conductor d="M56 60 H62" />
      <rect x="62" y="44" width="28" height="60" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={76} y={100} anchor="middle" size={6}>
        panel
      </Label>
      <Breaker x={76} y={70} open />
      <Label x={76} y={84} anchor="middle" size={6}>
        main off
      </Label>
      <Label x={10} y={36} anchor="middle" size={6}>
        pole
      </Label>
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={146} title="1 utility off" sub="the street is dark">
        {scene(false)}
        <Label x={48} y={124} anchor="middle" size={6.5}>
          the main is off too
        </Label>
        <Label x={48} y={133} anchor="middle" size={6.5}>
          it looks dead
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={146} title="2 backfeed" sub="power the other way" subColor={WRONG}>
        {scene(true)}
        <rect x="66" y="112" width="20" height="14" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
        <Label x={76} y={121} anchor="middle" size={5.5} color="currentColor">
          gen
        </Label>
        <Conductor d="M76 112 V104" />
        <Current x={76} y={108} angle={-90} fault />
        <Current x={59} y={60} angle={180} fault />
        <Current x={22} y={46} angle={180} fault />
        <Label x={48} y={133} anchor="middle" size={6.5} color={WRONG}>
          out to the lineman
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={146} title="3 live" sub="from the other end" subColor={WRONG}>
        <Conductor d="M8 60 H60" />
        <Current x={40} y={60} angle={180} fault />
        <Person x={76} y={110} h={40} arm="out" />
        <rect x="56" y="54" width="10" height="14" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
        <Label x={30} y={52} anchor="middle" size={6.5} color={WRONG}>
          the tester beeps
        </Label>
        <Label x={48} y={124} anchor="middle" size={6.5}>
          never assume dead
        </Label>
        <Label x={48} y={133} anchor="middle" size={6.5}>
          on a house with either
        </Label>
      </Panel>
    </svg>
  )
}
