import type { FigureProps } from './figureProps'
import { Box } from './hvacParts'
import { Flow, Label, Panel, Pipe } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Which way a clog comes out (Intro to HVAC, lesson 19), in two frames: a wet vacuum at the far end pulling the
 * slime out of the pipe, with the capped tee as the other way in; and the line blown from the far end, which sends
 * the slime back into the pan under the coil.
 */
export function ClearTheDrain({ titleId }: FigureProps) {
  const SLIME = 'var(--bg-amber-100)'
  const rig = (
    <>
      <Box x={10} y={38} w={40} h={22} />
      <path d="M8 62 V74 H52 V62" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <Pipe d="M58 71 V60" bore={3.4} tint="air" />
      <line x1="54" y1="59" x2="62" y2="59" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <Pipe d="M52 71 H66 V88 a4 4 0 0 0 8 0 V80 H108" bore={3.4} tint="air" />
      <Label x={66} y={55} size={6.5}>
        capped tee
      </Label>
    </>
  )
  const slime = (points: [number, number][]) => (
    <g fill={SLIME} stroke="currentColor" strokeWidth="1">
      {points.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" />
      ))}
    </g>
  )
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="pulled out" sub="from the far end" subColor={RIGHT}>
        {rig}
        <path d="M108 80 H122 V88" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
        <rect x="112" y="88" width="20" height="20" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        {slime([
          [84, 80],
          [92, 80],
          [122, 101],
        ])}
        <Flow x={101} y={80} size={0.6} />
        <Label x={122} y={117} anchor="middle" size={6.5}>
          wet vacuum
        </Label>
        <Label x={73} y={130} anchor="middle" bold color="currentColor" size={7.5}>
          the slime leaves the pipe
        </Label>
        <Label x={73} y={140} anchor="middle" size={7}>
          or go in at the capped tee
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="blown back" sub="toward the unit" subColor={WRONG}>
        {rig}
        <path d="M108 80 L122 74 V86 Z" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <Flow x={92} y={80} angle={180} size={0.6} color={WRONG} />
        {slime([
          [18, 70],
          [28, 71],
          [40, 69],
          [30, 56],
        ])}
        <Label x={122} y={98} anchor="middle" size={6.5}>
          air blown in
        </Label>
        <Label x={73} y={130} anchor="middle" bold color={WRONG} size={7.5}>
          the slime lands in the pan
        </Label>
        <Label x={73} y={140} anchor="middle" size={7}>
          and on the coil
        </Label>
      </Panel>
    </svg>
  )
}
