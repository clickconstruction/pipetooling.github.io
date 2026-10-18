import type { FigureProps } from './figureProps'
import { Flow, Label, Panel, Pipe, Valve } from './plumbingParts'
import { SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * A pressure drop in four frames (punch list #119): one fixture on a line gets the whole push; two at once share it;
 * a gate valve stuck half open chokes everything past it; a floor up costs about 4 psi. Lesson 24.
 */
export function PressureDropStrip({ titleId }: FigureProps) {
  const W = 72
  const H = 146
  const at = (i: number) => ({ x: 2 + i * (W + 2.7), y: 2 })
  const shower = (x: number, y: number) => (
    <g stroke="currentColor" strokeWidth="1.2" fill="var(--surface)">
      <path d={`M${x} ${y} h14 v4 h-14 z`} />
      <line x1={x + 3} y1={y + 4} x2={x + 2} y2={y + 10} />
      <line x1={x + 7} y1={y + 4} x2={x + 7} y2={y + 10} />
      <line x1={x + 11} y1={y + 4} x2={x + 12} y2={y + 10} />
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel {...at(0)} w={W} h={H} title="1 one fixture" sub="the whole push">
        <Pipe d="M6 80 H40 V50" bore={5} />
        {shower(33, 36)}
        <Flow x={14} y={80} size={0.8} />
        <Flow x={22} y={80} size={0.8} />
        <Flow x={30} y={80} size={0.8} />
        <Label x={36} y={136} anchor="middle" size={7}>
          strong
        </Label>
      </Panel>
      <Panel {...at(1)} w={W} h={H} title="2 two at once" sub="they share it" subColor={WRONG}>
        <Pipe d="M6 80 H40 V50 M40 80 V110" bore={5} />
        {shower(33, 36)}
        <rect x="34" y="110" width="12" height="10" rx="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
        <Flow x={14} y={80} size={0.8} />
        <Flow x={40} y={64} angle={-90} size={0.7} />
        <Flow x={40} y={96} angle={90} size={0.7} />
        <Label x={48} y={118} size={6.5}>
          toilet
        </Label>
        <Label x={36} y={136} anchor="middle" size={7} color={WRONG}>
          both weak
        </Label>
      </Panel>
      <Panel {...at(2)} w={W} h={H} title="3 half shut" sub="a stuck gate" subColor={WRONG}>
        <Pipe d="M6 86 H66" bore={5} />
        <Valve x={30} y={86} kind="gate" open={false} bore={5} />
        <Flow x={14} y={86} size={0.8} />
        <Flow x={56} y={86} size={0.5} color={WRONG} />
        <Label x={36} y={136} anchor="middle" size={7} color={WRONG}>
          like a small pipe
        </Label>
      </Panel>
      <Panel {...at(3)} w={W} h={H} title="4 upstairs" sub="height costs push">
        <Pipe d="M20 120 V40 H50" bore={5} />
        <Flow x={20} y={100} angle={-90} size={0.8} />
        <Flow x={20} y={60} angle={-90} size={0.5} />
        <line x1="30" y1="120" x2="30" y2="78" stroke="var(--text-muted)" strokeWidth="1" />
        <line x1="30" y1="78" x2="30" y2="40" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="2 2" />
        <Label x={34} y={100} size={6.5}>
          10 ft
        </Label>
        <Label x={34} y={62} size={6.5} color={WRONG}>
          4 psi less
        </Label>
        <Label x={36} y={136} anchor="middle" size={7}>
          per floor
        </Label>
      </Panel>
    </svg>
  )
}
