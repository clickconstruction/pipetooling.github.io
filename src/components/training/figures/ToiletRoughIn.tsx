import type { FigureProps } from './figureProps'
import { Label, Panel, Pipe } from './plumbingParts'
import { DRAIN, RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * The toilet's rough-in (punch list #119, second pass): the drain's centre 12 in from the finished wall, measured
 * to the drywall, beside the mistake of measuring to the stud, which sets the toilet half an inch too close.
 * Lesson 28.
 */
export function ToiletRoughIn({ titleId }: FigureProps) {
  const scale = 6
  const wall = (face: number) => (
    <>
      <rect x="8" y="28" width={face - 8 - 6} height="72" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1" />
      <rect x={face - 6} y="28" width="6" height="72" fill="var(--surface)" stroke="currentColor" strokeWidth="1" />
      <line x1="8" y1="100" x2="146" y2="100" stroke="currentColor" strokeWidth="1.2" />
    </>
  )
  const toilet = (xd: number) => (
    <g stroke="currentColor" strokeWidth="1.5" fill="var(--surface)" strokeLinejoin="round">
      <rect x={xd - 64} y="38" width="34" height="34" rx="2" />
      <path d={`M${xd - 32} 72 h46 q10 0 10 10 v4 q0 14 -14 14 h-28 q-14 0 -14 -14 z`} />
    </g>
  )
  const drain = (xd: number) => (
    <>
      <Pipe d={`M${xd} 100 V112`} bore={DRAIN} tint="air" />
      <rect x={xd - 10} y="98" width="20" height="4" rx="1" fill="var(--surface)" stroke="currentColor" strokeWidth="1.2" />
      <line x1={xd} y1="104" x2={xd} y2="126" stroke="var(--text-muted)" strokeWidth="0.8" strokeDasharray="2 2" />
    </>
  )
  const dim = (from: number, to: number, color: string) => (
    <g stroke={color} strokeWidth="1">
      <line x1={from} y1="122" x2={to} y2="122" />
      <line x1={from} y1="118" x2={from} y2="126" />
      <line x1={to} y1="118" x2={to} y2="126" />
    </g>
  )
  const face = 28
  const stud = 22
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="12 in to the finished wall" subColor={RIGHT}>
        {wall(face)}
        {toilet(face + 12 * scale)}
        {drain(face + 12 * scale)}
        {dim(face, face + 12 * scale, RIGHT)}
        <Label x={face + 6 * scale} y={116} anchor="middle" size={7.5} bold color={RIGHT}>
          12 in
        </Label>
        <Label x={face + 6 * scale} y={134} anchor="middle" size={7} color={RIGHT}>
          measured to the drywall
        </Label>
        <Label x={73} y={143} anchor="middle" size={7}>
          the tank clears the wall
        </Label>
        <Label x={18} y={38} anchor="middle" size={6.5}>
          stud
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="12 in to the stud" subColor={WRONG}>
        {wall(face)}
        {toilet(stud + 12 * scale)}
        {drain(stud + 12 * scale)}
        {dim(stud, stud + 12 * scale, WRONG)}
        <g stroke={WRONG} strokeWidth="2">
          <line x1="24" y1="48" x2="32" y2="56" />
          <line x1="32" y1="48" x2="24" y2="56" />
        </g>
        <Label x={stud + 6 * scale} y={116} anchor="middle" size={7.5} bold color={WRONG}>
          12 in
        </Label>
        <Label x={stud + 6 * scale} y={134} anchor="middle" size={7} color={WRONG}>
          measured to the stud
        </Label>
        <Label x={73} y={143} anchor="middle" size={7} color={WRONG}>
          the toilet sits 1/2 in too close
        </Label>
      </Panel>
    </svg>
  )
}
