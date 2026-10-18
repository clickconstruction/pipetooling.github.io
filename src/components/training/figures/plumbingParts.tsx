import type { ReactNode } from 'react'

/**
 * The drawing language of the Intro to plumbing course (punch list #119): the small parts every plumbing figure
 * composes, so thirty drawings of pipes read as one system and a change to how a pipe looks is one edit.
 *
 *   - A pipe is two lines: a stroke in the page's ink with the bore drawn over it in a tint. Supply pipe is narrow,
 *     drain pipe is wide, so a drain reads bigger than a supply line with no label.
 *   - Water is a tint in the bore: cold blue, hot red, waste amber, air the surface. The same four everywhere.
 *   - Flow is an arrow on the centreline, pointing the way the water goes.
 *   - The trap's seal is a hatch over the water in the bend, and only there.
 *   - A valve is its symbol with the water drawn through it; a fitting is drawn with water in it, never empty.
 *   - A person is a stick figure at the OSHA strips' scale.
 *
 * Every part draws in `currentColor` and the theme's tints, so a figure reads in light and dark with no second
 * drawing. Coordinates are the figure's own (`viewBox` 300 wide).
 */

import { DRAIN, SUPPLY, TINT, type Tint } from './plumbingTokens'

/** A straight or bent pipe as an SVG path: the ink outline, then the bore in its tint. */
export function Pipe({ d, bore = SUPPLY, tint = 'cold', dash }: { d: string; bore?: number; tint?: Tint; dash?: string }) {
  return (
    <g fill="none" strokeLinecap="butt" strokeLinejoin="round">
      <path d={d} stroke="currentColor" strokeWidth={bore + 2.6} strokeDasharray={dash} />
      <path d={d} stroke={TINT[tint]} strokeWidth={bore} strokeDasharray={dash} />
    </g>
  )
}

/** A hatch over a pipe's bore: the trap's seal. Define `Hatch` once per figure with the same id. */
export function Seal({ d, bore = DRAIN, id }: { d: string; bore?: number; id: string }) {
  return <path d={d} fill="none" stroke={`url(#${id})`} strokeWidth={bore} strokeLinecap="butt" />
}

export function Hatch({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="4" height="4" fill="var(--bg-blue-200)" />
        <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="1.2" />
      </pattern>
    </defs>
  )
}

/** A flow arrow on the centreline. `angle` in degrees, 0 pointing right, 90 pointing down. */
export function Flow({ x, y, angle = 0, color = 'currentColor', size = 1 }: { x: number; y: number; angle?: number; color?: string; size?: number }) {
  return <polygon points="5,0 -4,-4 -4,4" fill={color} stroke="none" transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`} />
}

/** A socket at a joint: the fitting's hub, a little wider than the pipe. */
export function Hub({ x, y, bore = SUPPLY, w = 7, angle = 0 }: { x: number; y: number; bore?: number; w?: number; angle?: number }) {
  const h = bore + 6
  return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="1.5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" transform={`translate(${x} ${y}) rotate(${angle})`} />
}

export type ValveKind = 'ball' | 'gate' | 'check' | 'prv' | 'stop'

/**
 * A valve in a horizontal pipe, centred at x,y: the bowtie with the part that does the work drawn in it. `open`
 * draws the ball's bore along the pipe and the gate up; shut turns the ball and drops the gate.
 */
export function Valve({ x, y, kind, open = true, bore = SUPPLY, tint = 'cold' }: { x: number; y: number; kind: ValveKind; open?: boolean; bore?: number; tint?: Tint }) {
  const r = bore / 2 + 5
  const body = (
    <>
      <polygon points={`${-r},${-r} ${r},${r} ${r},${-r} ${-r},${r}`} fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </>
  )
  let inner: ReactNode = null
  if (kind === 'ball') {
    inner = (
      <>
        <circle cx="0" cy="0" r={r - 1.5} fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <line x1={open ? -r + 2 : 0} y1={open ? 0 : -r + 2} x2={open ? r - 2 : 0} y2={open ? 0 : r - 2} stroke={TINT[tint]} strokeWidth={bore - 1} />
        <line x1="0" y1={-r} x2="0" y2={-r - 9} stroke="currentColor" strokeWidth="2" />
        <line x1={open ? -7 : 0} y1={-r - 9} x2={open ? 7 : 0} y2={open ? -r - 9 : -r - 18} stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </>
    )
  } else if (kind === 'gate') {
    inner = (
      <>
        <line x1="0" y1={-r} x2="0" y2={-r - 10} stroke="currentColor" strokeWidth="2" />
        <circle cx="0" cy={-r - 13} r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <polygon points={open ? `-3,${-r + 1} 3,${-r + 1} 0,${-bore / 2}` : `-3,${-r + 1} 3,${-r + 1} 0,${r - 1}`} fill="currentColor" />
      </>
    )
  } else if (kind === 'check') {
    inner = (
      <>
        <line x1={-r + 2} y1={-r + 3} x2={open ? r - 6 : -r + 2} y2={open ? -2 : r - 3} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={-r + 2} cy={-r + 3} r="2" fill="currentColor" />
      </>
    )
  } else if (kind === 'prv') {
    inner = (
      <>
        <rect x={-6} y={-r - 16} width="12" height="16" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        <path d={`M-4 ${-r - 13} l8 3 l-8 3 l8 3 l-8 3`} fill="none" stroke="currentColor" strokeWidth="1.2" />
        <line x1="0" y1={-r - 16} x2="0" y2={-r - 22} stroke="currentColor" strokeWidth="2" />
      </>
    )
  } else {
    inner = (
      <>
        <line x1="0" y1={-r} x2="0" y2={-r - 7} stroke="currentColor" strokeWidth="2" />
        <ellipse cx="0" cy={-r - 10} rx="6" ry="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      </>
    )
  }
  return (
    <g transform={`translate(${x} ${y})`}>
      {body}
      {inner}
    </g>
  )
}

/**
 * A P-trap: the tailpiece down from x,y, the bend, the outlet leg up and the trap arm to `armTo`. The seal is the
 * hatch (`Hatch` with the same id) over the water: `full` to the weir, `low` only in the bottom of the bend, `none`.
 */
export function Trap({ x, y, drop = 20, r = 9, armTo, bore = DRAIN, id, seal = 'full', tint = 'waste' }: { x: number; y: number; drop?: number; r?: number; armTo: number; bore?: number; id: string; seal?: 'full' | 'low' | 'none'; tint?: Tint }) {
  const y1 = y + drop
  const up = r
  const d = `M${x} ${y} V${y1} a${r} ${r} 0 0 0 ${2 * r} 0 V${y1 - up} H${armTo}`
  const full = `M${x} ${y1 - up} V${y1} a${r} ${r} 0 0 0 ${2 * r} 0 V${y1 - up}`
  const low = `M${x} ${y1} a${r} ${r} 0 0 0 ${2 * r} 0`
  return (
    <>
      <Pipe d={d} bore={bore} tint={tint} />
      {seal === 'full' && <Seal d={full} bore={bore} id={id} />}
      {seal === 'low' && <Seal d={low} bore={bore} id={id} />}
    </>
  )
}

/** A toilet seen from the side: the tank and the bowl, the outlet under it at x. */
export function Toilet({ x, y }: { x: number; y: number }) {
  return (
    <g stroke="currentColor" strokeWidth="1.5" fill="var(--surface)" strokeLinejoin="round">
      <rect x={x - 6} y={y - 30} width="14" height="18" rx="2" />
      <path d={`M${x - 4} ${y - 12} h22 q6 0 6 6 v4 q0 8 -10 8 h-10 q-8 0 -8 -8 z`} />
    </g>
  )
}

/** A stick figure, feet at x,y. */
export function Person({ x, y, h = 44, arm }: { x: number; y: number; h?: number; arm?: 'up' | 'out' | 'down' }) {
  const head = h * 0.16
  const top = y - h
  const hip = y - h * 0.4
  const shoulder = top + head * 2 + 2
  const armEnd = arm === 'up' ? { x: x + h * 0.28, y: shoulder - h * 0.25 } : arm === 'out' ? { x: x + h * 0.36, y: shoulder + h * 0.05 } : { x: x + h * 0.2, y: shoulder + h * 0.3 }
  return (
    <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx={x} cy={top + head} r={head} fill="var(--surface)" />
      <line x1={x} y1={top + head * 2} x2={x} y2={hip} />
      <line x1={x} y1={hip} x2={x - h * 0.18} y2={y} />
      <line x1={x} y1={hip} x2={x + h * 0.18} y2={y} />
      <line x1={x} y1={shoulder} x2={x - h * 0.2} y2={shoulder + h * 0.3} />
      <line x1={x} y1={shoulder} x2={armEnd.x} y2={armEnd.y} />
    </g>
  )
}

/** A sink seen from the side: the basin, the faucet, the drain stub under it. */
export function Sink({ x, y, w = 40 }: { x: number; y: number; w?: number }) {
  return (
    <g stroke="currentColor" strokeWidth="1.5" fill="var(--surface)" strokeLinejoin="round">
      <path d={`M${x - w / 2} ${y} h${w} v8 q0 10 -10 10 h${-(w - 20)} q-10 0 -10 -10 z`} />
      <path d={`M${x + w / 2 - 8} ${y} v-14 q0 -6 -6 -6 h-6 v6`} fill="none" />
    </g>
  )
}

/** A small text label; muted by default. */
export function Label({ x, y, children, size = 8.5, bold, anchor, color = 'var(--text-muted)' }: { x: number; y: number; children: ReactNode; size?: number; bold?: boolean; anchor?: 'start' | 'middle' | 'end'; color?: string }) {
  return (
    <text x={x} y={y} fontSize={size} fontWeight={bold ? 600 : 400} fill={color} textAnchor={anchor} stroke="none">
      {children}
    </text>
  )
}

/** The bordered panel of a strip or a grid, with its title. */
export function Panel({ x, y, w, h, title, sub, subColor, children }: { x: number; y: number; w: number; h: number; title?: string; sub?: string; subColor?: string; children: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width={w} height={h} rx="6" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      {title && (
        <text x={w / 2} y="14" fontSize="9" fontWeight="600" fill="currentColor" textAnchor="middle" stroke="none">
          {title}
        </text>
      )}
      {sub && (
        <text x={w / 2} y="24" fontSize="7" fill={subColor ?? 'var(--text-muted)'} textAnchor="middle" stroke="none">
          {sub}
        </text>
      )}
      {children}
    </g>
  )
}
