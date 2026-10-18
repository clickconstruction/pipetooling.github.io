import type { FigureProps } from './figureProps'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A freeze in four frames (punch list #119): a pipe in an outside wall on a 20°F night; the ice growing along it;
 * the split, dry while frozen; the thaw, when the leak shows. Lesson 25.
 */
export function FreezeStrip({ titleId }: FigureProps) {
  const W = 72
  const H = 146
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const wall = (
    <g stroke="currentColor" strokeWidth="1.2" fill="var(--bg-subtle)">
      <rect x="8" y="34" width="56" height="80" />
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="1 a cold night" sub="an outside wall">
        {wall}
        <Pipe d="M20 44 V104" />
        <Label x={44} y={62} size={8} bold color="currentColor">
          20°F
        </Label>
        <Label x={44} y={72} size={6.5}>
          outside
        </Label>
        <Label x={36} y={136} anchor="middle" size={7}>
          still water
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="2 ice grows" sub="9% bigger" subColor={WRONG}>
        {wall}
        <Pipe d="M20 44 V104" tint="air" />
        <rect x="17.5" y="56" width="5" height="40" fill="var(--bg-sky-100)" stroke="none" />
        <Flow x={20} y={52} angle={-90} size={0.6} color={WRONG} />
        <Flow x={20} y={100} angle={90} size={0.6} color={WRONG} />
        <Label x={28} y={78} size={6.5}>
          ice
        </Label>
        <Label x={36} y={136} anchor="middle" size={7} color={WRONG}>
          nowhere to go
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="3 the split" sub="still dry" subColor={WRONG}>
        {wall}
        <Pipe d="M20 44 V104" tint="air" />
        <rect x="17.5" y="56" width="5" height="40" fill="var(--bg-sky-100)" stroke="none" />
        <path d="M23 70 l4 4 l-3 5 l4 4" fill="none" stroke={WRONG} strokeWidth="1.5" />
        <Label x={36} y={136} anchor="middle" size={7} color={WRONG}>
          the ice plugs it
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="4 the thaw" sub="the leak shows" subColor={WRONG}>
        {wall}
        <Pipe d="M20 44 V104" />
        <path d="M23 70 l4 4 l-3 5 l4 4" fill="none" stroke={WRONG} strokeWidth="1.5" />
        <circle cx="34" cy="76" r="1.5" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="0.6" />
        <circle cx="40" cy="82" r="1.5" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="0.6" />
        <circle cx="36" cy="92" r="1.5" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="0.6" />
        <circle cx="44" cy="100" r="1.5" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="0.6" />
        <Label x={36} y={136} anchor="middle" size={7} color={RIGHT}>
          shut the main first
        </Label>
      </Panel>
    </svg>
  )
}
