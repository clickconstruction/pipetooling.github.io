import type { FigureProps } from './figureProps'
import { Label, Panel } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A tripped breaker in four frames (punch list #120): the handle in the middle, the handle pushed to off, the
 * handle pushed to on and holding, and the handle back in the middle, which is the end of the plumber's part.
 * Lesson 19.
 */
export function TrippedBreakerStrip({ titleId }: FigureProps) {
  const W = 72
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const breaker = (handleY: number, flag?: boolean) => (
    <g>
      <rect x="22" y="36" width="28" height="70" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <rect x="30" y="44" width="12" height="54" rx="2" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1" />
      <rect x="28" y={handleY} width="16" height="12" rx="2" fill={flag ? WRONG : 'currentColor'} />
      <Label x={36} y={32} anchor="middle" size={6.5}>
        on
      </Label>
      <Label x={36} y={116} anchor="middle" size={6.5}>
        off
      </Label>
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={146} title="1 tripped" sub="in the middle" subColor={WRONG}>
        {breaker(66, true)}
        <Label x={36} y={136} anchor="middle" size={6.5}>
          it looks on, it is not
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={146} title="2 off" sub="push it all the way">
        {breaker(86)}
        <Label x={36} y={136} anchor="middle" size={6.5}>
          off first
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={146} title="3 on" sub="once, and it holds" subColor={RIGHT}>
        {breaker(44)}
        <Label x={36} y={136} anchor="middle" size={6.5} color={RIGHT}>
          the work goes on
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={146} title="4 again" sub="a second trip" subColor={WRONG}>
        {breaker(66, true)}
        <Label x={36} y={136} anchor="middle" size={6.5} color={WRONG}>
          stop and call
        </Label>
      </Panel>
    </svg>
  )
}
