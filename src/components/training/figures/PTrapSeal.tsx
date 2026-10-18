import type { FigureProps } from './figureProps'
import { Flow, Hatch, Label, Pipe, Sink, Trap } from './plumbingParts'
import { DRAIN, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * The P-trap and its seal (punch list #119): the sink's tailpiece drops into the bend, the water standing in the
 * bend is hatched as the seal, the trap arm runs on to the drain, and sewer gas coming back up the drain stops at
 * the water. Lesson 13.
 */
export function PTrapSeal({ titleId }: FigureProps) {
  const hatch = `${titleId}-seal`
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Hatch id={hatch} />
      <Sink x={78} y={22} w={44} />
      <Pipe d="M200 60 V140" bore={DRAIN} tint="waste" />
      <Trap x={78} y={40} drop={44} r={12} armTo={200} id={hatch} />
      <Flow x={200} y={122} angle={90} />
      <line x1="56" y1="72" x2="56" y2="96" stroke="currentColor" strokeWidth="1" />
      <line x1="52" y1="72" x2="60" y2="72" stroke="currentColor" strokeWidth="1" />
      <line x1="52" y1="96" x2="60" y2="96" stroke="currentColor" strokeWidth="1" />
      <Label x={48} y={88} anchor="end" size={8} bold color="currentColor">
        2 to 4 in
      </Label>
      <Label x={48} y={98} anchor="end" size={7.5}>
        the seal
      </Label>
      <rect x="96" y="104" width="12" height="6" rx="1" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <Label x={116} y={118} size={7.5}>
        plug
      </Label>
      <Label x={150} y={64} anchor="middle" size={8}>
        trap arm
      </Label>
      <Label x={212} y={100} size={7.5}>
        to the vent
      </Label>
      <Label x={212} y={109} size={7.5}>
        and the drain
      </Label>
      <path d="M190 118 L150 86" fill="none" stroke={WRONG} strokeWidth="1.5" strokeDasharray="3 2" />
      <Flow x={150} y={86} angle={-141} color={WRONG} />
      <line x1="112" y1="74" x2="120" y2="82" stroke={WRONG} strokeWidth="2" />
      <line x1="120" y1="74" x2="112" y2="82" stroke={WRONG} strokeWidth="2" />
      <Label x={4} y={146} size={8} color={WRONG}>
        sewer gas stops at the water
      </Label>
    </svg>
  )
}
