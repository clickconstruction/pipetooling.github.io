import type { FigureProps } from './figureProps'
import { Box, Drop } from './hvacParts'
import { Label, Panel, Person } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * An attic in August, in four frames (Intro to HVAC, lesson 25): the heat; the drywall between the framing that
 * will not hold a boot; the walkway the code gives the unit; short turns with water and someone below.
 */
export function AtticStrip({ titleId }: FigureProps) {
  const W = 72
  const H = 146
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const framing = (
    <g>
      <line x1="6" y1="112" x2="66" y2="112" stroke="currentColor" strokeWidth="1.2" />
      {[10, 30, 50].map((x) => (
        <rect key={x} x={x} y="98" width="6" height="14" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.1" />
      ))}
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="1 the heat" sub="hotter than outside" subColor={WRONG}>
        <path d="M6 96 L36 44 L66 96" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <Person x={36} y={112} h={38} />
        <Drop x={24} y={80} size={0.8} />
        <Drop x={48} y={84} size={0.8} />
        <line x1="6" y1="112" x2="66" y2="112" stroke="currentColor" strokeWidth="1.2" />
        <Label x={36} y={128} anchor="middle" size={7}>
          the body cannot
        </Label>
        <Label x={36} y={137} anchor="middle" size={7}>
          cool itself
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="2 the floor" sub="drywall between" subColor={WRONG}>
        {framing}
        <g stroke={WRONG} strokeWidth="2.4" strokeLinecap="round">
          <line x1="18" y1="84" x2="28" y2="96" />
          <line x1="28" y1="84" x2="18" y2="96" />
          <line x1="38" y1="84" x2="48" y2="96" />
          <line x1="48" y1="84" x2="38" y2="96" />
        </g>
        <Label x={36} y={128} anchor="middle" size={7} color={WRONG}>
          it will not
        </Label>
        <Label x={36} y={137} anchor="middle" size={7} color={WRONG}>
          hold a boot
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="3 the walkway" sub="24 in of solid floor" subColor={RIGHT}>
        {framing}
        <rect x="6" y="93" width="44" height="5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
        <Box x={46} y={66} w={20} h={27} />
        <Person x={22} y={93} h={34} />
        <Label x={36} y={128} anchor="middle" size={7} color={RIGHT}>
          from the opening
        </Label>
        <Label x={36} y={137} anchor="middle" size={7} color={RIGHT}>
          to the unit
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="4 short turns" sub="water, and a buddy" subColor={RIGHT}>
        <line x1="6" y1="84" x2="66" y2="84" stroke="currentColor" strokeWidth="1.2" />
        <Person x={24} y={84} h={30} />
        <rect x="42" y="68" width="8" height="16" rx="2" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="1.2" />
        <Person x={48} y={122} h={30} arm="up" />
        <Label x={36} y={137} anchor="middle" size={7} color={RIGHT}>
          someone knows
        </Label>
      </Panel>
    </svg>
  )
}
