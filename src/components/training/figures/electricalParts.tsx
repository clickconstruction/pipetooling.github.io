import type { ReactNode } from 'react'

/**
 * The drawing language of the Intro to electrical course (punch list #120): the small parts every electrical figure
 * composes, so thirty drawings of circuits read as one system and a change to how a wire looks is one edit.
 *
 *   - A conductor is one line, thinner than a pipe. The hot is the plain ink; the neutral white with a grey edge;
 *     the ground amber for bare copper. The same three everywhere.
 *   - Current is an arrow along the line, in the ink. The house red is for current where it should not be, and
 *     nowhere else.
 *   - A breaker is a gate in the line, closed in the run or swung open, with its amps beside it; a switch is the
 *     same gate with no number.
 *   - A receptacle is its face; a ground is three bars to earth; a load is a circle or a box with its name, never
 *     empty; a meter is its dial; a panel is its box with the two bus bars.
 *
 * Every part draws in `currentColor` and the theme's tints, so a figure reads in light and dark with no second
 * drawing. Coordinates are the figure's own (`viewBox` 300 wide). `Person`, `Pipe`, `Label` and `Panel` come from
 * `plumbingParts.tsx`.
 */

import { Flow } from './plumbingParts'
import { CONDUCTOR, FAULT, WIRE, type Wire } from './electricalTokens'

/** A conductor as an SVG path: the hot one ink stroke, the neutral and the ground an edge with the tint over it. */
export function Conductor({ d, wire = 'hot', dash }: { d: string; wire?: Wire; dash?: string }) {
  if (wire === 'hot') return <path d={d} fill="none" stroke="currentColor" strokeWidth={CONDUCTOR} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={wire === 'neutral' ? 'var(--text-muted)' : 'currentColor'} strokeWidth={CONDUCTOR + 2} strokeDasharray={dash} />
      <path d={d} stroke={WIRE[wire]} strokeWidth={CONDUCTOR} strokeDasharray={dash} />
    </g>
  )
}

/** A current arrow on a conductor: the ink for the loop, the house red for current where it should not be. */
export function Current({ x, y, angle = 0, fault }: { x: number; y: number; angle?: number; fault?: boolean }) {
  return <Flow x={x} y={y} angle={angle} color={fault ? FAULT : 'currentColor'} size={0.9} />
}

/**
 * A gate in a conductor centred at x,y, the run left to right (`angle` turns it): two pivots 16 apart, the bar
 * closed between them or swung up open. With `amps` it is a breaker; with none it is a switch.
 */
export function Breaker({ x, y, amps, open, angle = 0 }: { x: number; y: number; amps?: number; open?: boolean; angle?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <circle cx={-8} cy={0} r={2} fill="currentColor" />
      <circle cx={8} cy={0} r={2} fill="currentColor" />
      <line x1={-8} y1={0} x2={open ? 3 : 8} y2={open ? -12 : 0} stroke="currentColor" strokeWidth={CONDUCTOR + 0.4} strokeLinecap="round" />
      {amps != null && (
        <text x={0} y={open ? -16 : -6} fontSize="7" fill="var(--text-muted)" textAnchor="middle" stroke="var(--surface)" strokeWidth={2} paintOrder="stroke" transform={`rotate(${-angle})`}>
          {amps} A
        </text>
      )}
    </g>
  )
}

export function Switch({ x, y, open, angle = 0 }: { x: number; y: number; open?: boolean; angle?: number }) {
  return <Breaker x={x} y={y} open={open} angle={angle} />
}

/** A receptacle's face, as a reader sees it on the wall: the long slot the neutral, the short the hot, the hole the ground. */
export function Receptacle({ x, y, kind = '120' }: { x: number; y: number; kind?: '120' | 'gfci' | '240' }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke="currentColor" strokeWidth="1.3" fill="var(--surface)">
      <rect x={-10} y={-15} width={20} height={30} rx="3" />
      {kind === '240' ? (
        <g fill="currentColor" stroke="none">
          <polygon points="-8,-10 -5.5,-7 -3.5,-9 -6,-12" />
          <polygon points="8,-10 5.5,-7 3.5,-9 6,-12" />
          <rect x={-1.3} y={-9} width={2.6} height={6} />
          <rect x={-2} y={5} width={4} height={4} />
        </g>
      ) : (
        <g fill="currentColor" stroke="none">
          <rect x={-6.5} y={-11} width={2.6} height={7} />
          <rect x={4} y={-10} width={2.6} height={5} />
          <circle cx={0} cy={kind === 'gfci' ? 9 : 5} r={2} />
        </g>
      )}
      {kind === 'gfci' && (
        <>
          <rect x={-7} y={-1} width={6} height={3.5} rx="1" />
          <rect x={1} y={-1} width={6} height={3.5} rx="1" />
        </>
      )}
    </g>
  )
}

/** The earth: three bars under a stem, at x,y the top of the stem. The ground's one home. */
export function Ground({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1={0} y1={0} x2={0} y2={6} />
      <line x1={-9} y1={6} x2={9} y2={6} />
      <line x1={-6} y1={10} x2={6} y2={10} />
      <line x1={-3} y1={14} x2={3} y2={14} />
    </g>
  )
}

export type LoadKind = 'lamp' | 'motor' | 'element' | 'box'

/** A load centred at x,y: a lamp is a circle with a cross, a motor a circle with an M, an element a zigzag, a box its name. */
export function Load({ x, y, kind, name, w = 28, h = 20 }: { x: number; y: number; kind: LoadKind; name?: string; w?: number; h?: number }) {
  const r = 10
  return (
    <g transform={`translate(${x} ${y})`} stroke="currentColor" strokeWidth="1.5" fill="var(--surface)">
      {kind === 'lamp' && (
        <>
          <circle r={r} />
          <line x1={-6} y1={-6} x2={6} y2={6} />
          <line x1={6} y1={-6} x2={-6} y2={6} />
        </>
      )}
      {kind === 'motor' && (
        <>
          <circle r={r} />
          <text y="3.5" fontSize="9" fontWeight="600" fill="currentColor" textAnchor="middle" stroke="none">
            M
          </text>
        </>
      )}
      {kind === 'element' && (
        <>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="2" />
          <path d={`M${-w / 2 + 4} 0 l3 -5 l4 10 l4 -10 l4 10 l4 -10 l3 5`} fill="none" />
        </>
      )}
      {kind === 'box' && <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="2" />}
      {name && (
        <text y={kind === 'box' ? 3 : r + 11} fontSize="7" fill={kind === 'box' ? 'currentColor' : 'var(--text-muted)'} textAnchor="middle" stroke="none">
          {name}
        </text>
      )}
    </g>
  )
}

/** The utility's meter: a round face in a base, the dial a short needle. */
export function Meter({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke="currentColor" strokeWidth="1.5" fill="var(--surface)">
      <rect x={-14} y={-18} width={28} height={36} rx="3" />
      <circle r={9} />
      <line x1={0} y1={0} x2={4} y2={-6} strokeWidth="1.2" />
      <line x1={-5} y1={13} x2={5} y2={13} strokeWidth="1.2" />
    </g>
  )
}

/**
 * The panel's enclosure at x,y: the two bus bars down the middle, `slots` breaker stubs on each, a neutral bar
 * (white) on the left and a ground bar (amber) on the right, and whatever the figure adds inside.
 */
export function PanelBox({ x, y, w = 56, h = 90, slots = 3, children }: { x: number; y: number; w?: number; h?: number; slots?: number; children?: ReactNode }) {
  const cx = w / 2
  const top = 22
  const bottom = h - 14
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width={w} height={h} rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <line x1={cx - 4} y1={top} x2={cx - 4} y2={bottom} stroke="currentColor" strokeWidth="2.6" />
      <line x1={cx + 4} y1={top} x2={cx + 4} y2={bottom} stroke="currentColor" strokeWidth="2.6" />
      {Array.from({ length: slots }, (_, i) => {
        const sy = top + 8 + i * ((bottom - top - 12) / Math.max(1, slots - 1))
        return (
          <g key={i} fill="var(--surface)" stroke="currentColor" strokeWidth="1.2">
            <rect x={cx - 18} y={sy - 3} width={12} height={6} />
            <rect x={cx + 6} y={sy - 3} width={12} height={6} />
          </g>
        )
      })}
      <Conductor d={`M8 ${top + 4} V${bottom}`} wire="neutral" />
      <Conductor d={`M${w - 8} ${top + 4} V${bottom}`} wire="ground" />
      {children}
    </g>
  )
}
