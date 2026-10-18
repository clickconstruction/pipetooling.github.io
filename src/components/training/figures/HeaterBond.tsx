import type { FigureProps } from './figureProps'
import { Conductor } from './electricalParts'
import { Flow, Label, Pipe } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The bond across the water heater (punch list #120, v2.5620): the cold line comes in and the hot line leaves,
 * both metal, and the tank between them breaks the metal run; a bonding jumper clamped from the cold to the hot
 * ties the two sides back into one ground path. Lesson 29.
 */
export function HeaterBond({ titleId }: FigureProps) {
  const clamp = (x: number) => <rect x={x - 4} y={46} width="8" height="13" rx="1.5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.3" />
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <g stroke="currentColor" strokeWidth="1.5">
        <rect x="110" y="40" width="80" height="78" rx="10" fill="var(--bg-blue-200)" />
        <path d="M110 50 a10 10 0 0 1 10 -10 H180 a10 10 0 0 1 10 10 V84 H110 Z" fill="var(--bg-red-100)" stroke="none" />
        <rect x="110" y="40" width="80" height="78" rx="10" fill="none" />
      </g>
      <Pipe d="M0 52 H130 V60" />
      <Flow x={30} y={52} />
      <Pipe d="M170 60 V52 H300" tint="hot" />
      <Flow x={270} y={52} />
      <Conductor d="M96 52 V24 H204 V52" wire="ground" />
      {clamp(96)}
      {clamp(204)}
      <Label x={150} y={18} anchor="middle" size={7.5} bold color="currentColor">
        the bond
      </Label>
      <Label x={150} y={68} anchor="middle" size={7} color="currentColor">
        the heater breaks
      </Label>
      <Label x={150} y={77} anchor="middle" size={7} color="currentColor">
        the metal run
      </Label>
      <Label x={40} y={44} anchor="middle" size={7} color="#2563eb">
        cold in, metal
      </Label>
      <Label x={262} y={44} anchor="middle" size={7} color="#b91c1c">
        hot out, metal
      </Label>
      <Label x={150} y={132} anchor="middle" size={6.5}>
        one ground path again
      </Label>
      <Label x={150} y={142} anchor="middle" size={6.5}>
        on the plumbing inspector's list
      </Label>
    </svg>
  )
}
