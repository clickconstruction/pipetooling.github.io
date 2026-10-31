import type { FigureProps } from './figureProps'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * A glued joint, cut open (punch list #119): primer softens the pipe's outside and the socket's inside, cement
 * melts the two faces into one piece as the pipe goes in with a quarter turn and is held still. Lesson 8.
 */
export function SolventJoint({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 130" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <g stroke="currentColor" strokeWidth="1.5">
        <rect x="130" y="40" width="130" height="50" rx="3" fill="var(--surface)" />
        <rect x="130" y="49" width="122" height="32" fill="var(--bg-blue-200)" stroke="none" />
        <rect x="20" y="52" width="176" height="26" fill="var(--bg-blue-200)" />
        <line x1="196" y1="49" x2="196" y2="81" />
        <rect x="130" y="49" width="66" height="3" fill="#7c3aed" stroke="none" />
        <rect x="130" y="78" width="66" height="3" fill="#7c3aed" stroke="none" />
        <rect x="130" y="46" width="66" height="3" fill="var(--text-muted)" stroke="none" />
        <rect x="130" y="81" width="66" height="3" fill="var(--text-muted)" stroke="none" />
      </g>
      <path d="M62 34 a16 18 0 1 1 -2 30" fill="none" stroke="currentColor" strokeWidth="2" />
      <polygon points="56,66 64,62 62,70" fill="currentColor" />
      <polygon points="92,65 104,65 104,57 116,68 104,79 104,71 92,71" fill="currentColor" />
      <Label x={36} y={28} size={8}>
        a quarter turn
      </Label>
      <Label x={36} y={100} size={8}>
        push in, hold 30 seconds
      </Label>
      <Label x={140} y={32} size={8} color="var(--text-violet-700)">
        cement melts the two faces
      </Label>
      <Label x={140} y={110} size={8}>
        primer softened them first
      </Label>
      <Label x={262} y={100} size={8} anchor="middle">
        the socket
      </Label>
      <Label x={30} y={46} size={8}>
        pipe
      </Label>
    </svg>
  )
}
