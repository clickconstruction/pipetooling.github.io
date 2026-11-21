import type { FigureProps } from './figureProps'
import { Box } from './hvacParts'
import { LINE, SUCTION } from './hvacTokens'
import { Flow, Label, Pipe } from './plumbingParts'
import { SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * The line set (Intro to HVAC, lesson 6): the big suction line in its foam carrying cool vapor back to the outdoor
 * unit, the small bare liquid line carrying warm liquid to the indoor coil, and, inset, a line through a stud
 * close to its edge with the steel plate over it.
 */
export function LineSet({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 152" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Box x={6} y={36} w={26} h={72} />
      <Box x={164} y={36} w={26} h={72} />
      <Label x={19} y={30} anchor="middle" size={7}>
        indoor
      </Label>
      <Label x={177} y={30} anchor="middle" size={7}>
        outdoor
      </Label>
      <Pipe d="M32 58 H164" bore={SUCTION} tint="cold" />
      <g fill="none">
        <path d="M44 58 H152" stroke="currentColor" strokeWidth="14" />
        <path d="M45.2 58 H150.8" stroke="var(--bg-subtle)" strokeWidth="11.6" />
      </g>
      <Flow x={98} y={58} size={0.8} />
      <Pipe d="M164 92 H32" bore={LINE} tint="hot" />
      <Flow x={98} y={92} angle={180} size={0.7} />
      <Label x={98} y={44} anchor="middle" bold color="currentColor" size={8}>
        suction line, wrapped in foam
      </Label>
      <Label x={98} y={76} anchor="middle" size={7}>
        cool vapor back to the compressor
      </Label>
      <Label x={98} y={106} anchor="middle" bold color="currentColor" size={8}>
        liquid line, bare
      </Label>
      <Label x={98} y={116} anchor="middle" size={7}>
        warm liquid to the indoor coil
      </Label>
      <Label x={98} y={138} anchor="middle" size={7.5} color={WRONG}>
        under pressure all the time
      </Label>
      <g>
        <rect x="232" y="50" width="26" height="62" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="239" cy="81" r="4.5" fill="var(--bg-red-100)" stroke="currentColor" strokeWidth="1.2" />
        <line x1="229" y1="68" x2="229" y2="94" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
        <Label x={246} y={40} anchor="middle" size={7}>
          a stud, cut through
        </Label>
        <Label x={262} y={78} size={6.5}>
          1-1/4 in
        </Label>
        <Label x={262} y={87} size={6.5}>
          or closer
        </Label>
        <Label x={246} y={124} anchor="middle" bold color="currentColor" size={7.5}>
          steel plate
        </Label>
      </g>
    </svg>
  )
}
