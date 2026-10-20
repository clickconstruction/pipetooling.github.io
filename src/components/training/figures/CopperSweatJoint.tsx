import type { FigureProps } from './figureProps'
import { Flow, Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * A copper joint, cut open (punch list #119): the pipe sits in the fitting's cup with a hair of a gap around it; the
 * torch heats the fitting and the solder touches the mouth of the cup, where the heat draws it into the gap all the
 * way round. Lesson 6.
 */
export function CopperSweatJoint({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 130" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <g stroke="currentColor" strokeWidth="1.5">
        <rect x="120" y="42" width="130" height="46" rx="3" fill="var(--surface)" />
        <rect x="120" y="50" width="122" height="30" fill="var(--bg-blue-200)" stroke="none" />
        <rect x="16" y="53" width="168" height="24" fill="var(--bg-blue-200)" />
        <line x1="184" y1="50" x2="184" y2="80" />
        <rect x="120" y="50" width="64" height="3" fill="var(--text-muted)" stroke="none" />
        <rect x="120" y="77" width="64" height="3" fill="var(--text-muted)" stroke="none" />
      </g>
      <Flow x={140} y={51.5} size={0.6} />
      <Flow x={160} y={51.5} size={0.6} />
      <Flow x={140} y={78.5} size={0.6} />
      <Flow x={160} y={78.5} size={0.6} />
      <line x1="96" y1="14" x2="121" y2="49" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" />
      <g transform="translate(150 104)">
        <path d="M-7 0 c0 -8 5 -10 5 -15 c3 5 6 7 6 11 a5.5 5.5 0 0 1 -11 4z" fill="#f97316" stroke="none" />
        <rect x="-4" y="2" width="8" height="12" rx="1" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      </g>
      <Label x={40} y={46} size={8}>
        pipe
      </Label>
      <Label x={200} y={36} size={8}>
        the fitting's cup
      </Label>
      <Label x={92} y={12} anchor="end" size={8} bold color="currentColor">
        solder here
      </Label>
      <Label x={126} y={104} size={8} anchor="end">
        heat here, on the fitting
      </Label>
      <Label x={168} y={110} size={8}>
        the heat draws the solder
      </Label>
      <Label x={168} y={119} size={8}>
        into the gap, all the way round
      </Label>
      <Label x={60} y={95} size={8} color="var(--text-muted)">
        the gap is a hair wide
      </Label>
    </svg>
  )
}
