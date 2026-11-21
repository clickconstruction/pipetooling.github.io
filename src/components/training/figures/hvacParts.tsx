/**
 * The drawing language of the Intro to HVAC course: the small parts every HVAC figure composes, so thirty drawings
 * of heat, air and water read as one system.
 *
 *   - Air is a block arrow, filled warm red or cooled blue. Nothing else in the course is a block arrow.
 *   - Refrigerant runs in a thin two-line pipe, the plumbing's `Pipe` at a narrow bore: red on the high side, blue
 *     on the low side, with the plumbing's `Flow` arrow on its centreline.
 *   - A coil is that pipe bent back and forth over faint fins, so the eye sees where heat is traded.
 *   - A compressor is a capsule with a wedge in it, a fan is a hub with three blades, a flame is the water heater's.
 *   - Water is the plumbing's: a drop, a drain pipe in the waste tint, the trap's hatch.
 *   - A duct is the plumbing's `Pipe` at the `DUCT` width with air in it.
 *
 * Every part draws in `currentColor` and the theme's tints, so a figure reads in light and dark with no second
 * drawing. Coordinates are the figure's own (`viewBox` 300 wide). `Person`, `Label`, `Panel`, `Pipe` and `Flow`
 * come from `plumbingParts.tsx`; a wire is the electrical course's `Conductor`.
 */

import { Pipe } from './plumbingParts'
import type { Tint } from './plumbingTokens'
import { AIR, FLAME, LINE, type AirTint } from './hvacTokens'

/** Air on the move: a block arrow from x,y, `len` long. `angle` in degrees, 0 pointing right, -90 pointing up. */
export function Air({ x, y, angle = 0, len = 24, tint = 'room' }: { x: number; y: number; angle?: number; len?: number; tint?: AirTint }) {
  const n = len - 8
  return (
    <polygon
      points={`0,-3 ${n},-3 ${n},-7 ${len},0 ${n},7 ${n},3 0,3`}
      fill={AIR[tint]}
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
      transform={`translate(${x} ${y}) rotate(${angle})`}
    />
  )
}

/**
 * A coil with its top-left corner at x,y: `rows` passes of tube `w` long, `h` tall in all, over faint fins. The
 * tube starts at the top left and, for an even count of rows, ends at the bottom left; `flip` starts and ends it
 * on the right, so two coils can face each other across a drawing.
 */
export function Coil({ x, y, w, h, rows = 4, tint = 'cold', flip }: { x: number; y: number; w: number; h: number; rows?: number; tint?: Tint; flip?: boolean }) {
  const step = h / (rows - 1)
  const a = flip ? x + w : x
  const b = flip ? x : x + w
  let d = `M${a} ${y}`
  for (let i = 0; i < rows; i++) {
    d += i % 2 === 0 ? ` H${b}` : ` H${a}`
    if (i < rows - 1) d += ` V${y + (i + 1) * step}`
  }
  const fins: number[] = []
  for (let fx = x + 5; fx < x + w - 2; fx += 5) fins.push(fx)
  return (
    <g>
      {fins.map((fx) => (
        <line key={fx} x1={fx} y1={y - 4} x2={fx} y2={y + h + 4} stroke="var(--text-muted)" strokeWidth="0.6" />
      ))}
      <Pipe d={d} bore={LINE} tint={tint} />
    </g>
  )
}

/** The compressor, centred at x,y: a capsule with the wedge that squeezes. */
export function Compressor({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <rect x="-10" y="-15" width="20" height="30" rx="9" fill="var(--surface)" />
      <polygon points="-5,6 5,6 0,-7" fill="currentColor" stroke="none" />
    </g>
  )
}

/** A fan seen face on, centred at x,y: a ring, three blades and a hub. */
export function Fan({ x, y, r = 12 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke="currentColor" strokeWidth="1.3" fill="var(--surface)">
      <circle cx="0" cy="0" r={r} />
      {[0, 60, 120].map((a) => (
        <ellipse key={a} cx="0" cy="0" rx={r * 0.86} ry={r * 0.24} transform={`rotate(${a})`} />
      ))}
      <circle cx="0" cy="0" r={r * 0.18} fill="currentColor" stroke="none" />
    </g>
  )
}

/** A flame with its base at x,y. */
export function Flame({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return <path d="M-6 0 c0 -8 6 -10 6 -16 c3 5 6 7 6 12 a6 6 0 0 1 -12 4z" fill={FLAME} stroke="none" transform={`translate(${x} ${y}) scale(${size})`} />
}

/** A drop of water with its point at x,y. */
export function Drop({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return <path d="M0 0 c2 3 3 4.5 3 6 a3 3 0 0 1 -6 0 c0 -1.5 1 -3 3 -6z" fill="var(--bg-blue-200)" stroke="currentColor" strokeWidth="0.7" transform={`translate(${x} ${y}) scale(${size})`} />
}

/** A plain box for a unit, a cabinet or a closet, top-left at x,y. */
export function Box({ x, y, w, h, fill = 'var(--surface)', dash }: { x: number; y: number; w: number; h: number; fill?: string; dash?: string }) {
  return <rect x={x} y={y} width={w} height={h} rx="3" fill={fill} stroke="currentColor" strokeWidth="1.5" strokeDasharray={dash} />
}

/** The thermostat on the wall, centred at x,y. */
export function Stat({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke="currentColor" strokeWidth="1.3">
      <rect x="-8" y="-7" width="16" height="14" rx="3" fill="var(--surface)" />
      <rect x="-5" y="-4" width="10" height="5" rx="1" fill="var(--bg-blue-200)" strokeWidth="0.8" />
    </g>
  )
}
