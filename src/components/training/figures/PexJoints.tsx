import type { FigureProps } from './figureProps'
import { Flow, Label, Panel } from './plumbingParts'
import { RIGHT, SVG_STYLE } from './plumbingTokens'

/**
 * Two PEX joints, cut open (punch list #119): a crimp ring squeezed down over the pipe onto a barbed fitting, and an
 * expansion joint where the pipe and its ring were stretched over a bigger fitting and shrink back to grip it.
 * Lesson 7.
 */
export function PexJoints({ titleId }: FigureProps) {
  const pipe = (x: number, w: number, top: number, bottom: number) => (
    <g stroke="currentColor" strokeWidth="1.5">
      <rect x={x} y={top} width={w} height={bottom - top} fill="var(--bg-blue-200)" />
      <rect x={x} y={top} width={w} height="4" fill="var(--surface)" />
      <rect x={x} y={bottom - 4} width={w} height="4" fill="var(--surface)" />
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="Crimp" sub="a ring squeezes the pipe on">
        {pipe(8, 90, 54, 94)}
        <path d="M60 58 l6 6 l-6 6 l6 6 l-6 6 l6 6 l-6 6 h78 v-36 z" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.5" />
        <rect x="68" y="50" width="14" height="48" fill="currentColor" />
        <Flow x={75} y={40} angle={90} color={RIGHT} />
        <Flow x={75} y={108} angle={-90} color={RIGHT} />
        <Label x={28} y={48} size={7.5}>
          PEX
        </Label>
        <Label x={140} y={48} size={7.5} anchor="end">
          barbed fitting
        </Label>
        <Label x={73} y={128} anchor="middle" size={8}>
          the ring stays squeezed
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="Expansion" sub="the pipe stretches, then shrinks back">
        {pipe(8, 50, 58, 90)}
        {pipe(58, 40, 50, 98)}
        <rect x="98" y="58" width="40" height="32" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.5" />
        <rect x="70" y="42" width="20" height="64" fill="none" stroke="currentColor" strokeWidth="4" />
        <Flow x={80} y={34} angle={-90} color="var(--text-muted)" />
        <Flow x={80} y={114} angle={90} color="var(--text-muted)" />
        <Flow x={62} y={30} angle={90} color={RIGHT} size={0.8} />
        <Flow x={62} y={118} angle={-90} color={RIGHT} size={0.8} />
        <Label x={20} y={52} size={7.5}>
          PEX
        </Label>
        <Label x={140} y={52} size={7.5} anchor="end">
          fitting
        </Label>
        <Label x={73} y={128} anchor="middle" size={8}>
          the pipe grips as it shrinks
        </Label>
      </Panel>
    </svg>
  )
}
