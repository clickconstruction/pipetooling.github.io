import type { FigureProps } from './figureProps'
import { Conductor } from './electricalParts'
import { Box, Drop } from './hvacParts'
import { Flow, Label, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The pan and the float (Intro to HVAC, lesson 9): a unit over a ceiling with its own drain, the second pan under
 * the whole unit with a drain of its own to where it will be seen, and the float switch that stops the unit.
 */
export function PanAndFloat({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 176" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <line x1="10" y1="150" x2="210" y2="150" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10" y1="156" x2="210" y2="156" stroke="var(--text-muted)" strokeWidth="1" />
      <rect x="84" y="112" width="10" height="12" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1" />
      <rect x="146" y="112" width="10" height="12" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1" />
      <Box x={70} y={58} w={100} h={54} />
      <path d="M54 108 V126 H186 V108" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <Pipe d="M170 96 H214 L290 106" bore={4} tint="cold" />
      <Flow x={250} y={100.6} angle={7} size={0.6} />
      <Pipe d="M186 122 H214 L290 132" bore={4} tint="air" />
      <Drop x={290} y={138} />
      <rect x="58" y="96" width="9" height="12" rx="1.5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="62.5" cy="116" r="3.6" fill="var(--bg-amber-100)" stroke="currentColor" strokeWidth="1.2" />
      <line x1="62.5" y1="108" x2="62.5" y2="112.4" stroke="currentColor" strokeWidth="1.2" />
      <Conductor d="M62.5 96 V70 H70" dash="3 2" />
      <Label x={120} y={82} anchor="middle" bold color="currentColor">
        the unit
      </Label>
      <Label x={120} y={92} anchor="middle" size={7}>
        over a ceiling
      </Label>
      <Label x={250} y={90} anchor="middle" size={7}>
        its own drain, the first
      </Label>
      <Label x={250} y={148} anchor="middle" size={7}>
        the second drain
      </Label>
      <Label x={250} y={157} anchor="middle" size={7}>
        ends where it is seen
      </Label>
      <Label x={120} y={140} anchor="middle" bold color="currentColor" size={7.5}>
        second pan, 1-1/2 in deep, 3 in larger
      </Label>
      <Label x={8} y={48} bold color="currentColor" size={7.5}>
        float switch
      </Label>
      <Label x={8} y={57} size={6.5}>
        stops the unit
      </Label>
      <Label x={110} y={170} anchor="middle" size={7}>
        the ceiling below
      </Label>
    </svg>
  )
}
