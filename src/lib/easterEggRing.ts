/**
 * The ring game (v2.3282) — pure math for "catch Floaty, slingshot him through
 * a floating ring", from the approved prototype. Owner's physics spec:
 *
 * - Floaty's REAL image edge is the body (the component supplies `touching`,
 *   a silhouette test from `easterEggSilhouette.ts`).
 * - The ring is only TWO collision points, its far-left and far-right ends.
 * - Through the middle counts from either side — over the top or up from
 *   underneath.
 * - The almost-in shot (his centre already between the points when his edge
 *   clips one) rattles back OUT toward the shooter; an outside hit is duller.
 *
 * Everything here is clock- and rand-injected so the rules are unit-tested;
 * `FloatingEasterEgg.tsx` just calls these from its frame loop and paints.
 */

import { EGG_MOTION } from './easterEggMotion'

export const RING = {
  /** Max pull distance in px; velocity = pull × power. */
  PULL_MAX: 150,
  /** Ring geometry at ringScale 1 (the SVG viewBox is 200×72, rim line at y=36). */
  RX: 80,
  RIM_Y: 36,
  W: 200,
  H: 72,
  /** Where the ring may spawn, in px from Floaty's centre — always inside a full pull. */
  SPAWN_MIN: 360,
  SPAWN_MAX: 620,
  /** Degrees of spin per px of horizontal travel (kept calm so his outline stays roughly upright). */
  SPIN_PER_PX: 0.15,
  /** Integration substeps per frame — the collision points are thin. */
  SUBSTEPS: 3,
  /** Restitution: inside-edge (almost in) vs outside hits. */
  BOUNCE_INNER: 0.8,
  BOUNCE_OUTER: 0.5,
  /** The extra kick an inside-edge hit gives him back toward the shooter. */
  KICK_X: 140,
  KICK_Y: 120,
  /** Dot spacing in the aim arc, seconds of flight per dot. */
  ARC_DT: 0.055,
  /** Sprite box (matches the motion kernel). */
  SPRITE_W: EGG_MOTION.SPRITE_W,
  SPRITE_H: EGG_MOTION.SPRITE_H,
} as const

export type Point = { x: number; y: number }

export type RingPos = {
  /** Top-left of the ring's box (for the SVG). */
  x: number
  y: number
  w: number
  h: number
  /** Rim line centre + half-width: the two collision points are (cx ± rx, ry). */
  cx: number
  ry: number
  rx: number
}

/**
 * Somewhere else on the screen, 360–620px from Floaty's centre so a full pull
 * always reaches. Falls back to the candidate nearest that band if the
 * viewport is too small to satisfy it.
 */
export function placeRing(center: Point, viewportW: number, viewportH: number, ringScale: number, rand: () => number = Math.random): RingPos {
  const w = RING.W * ringScale
  const h = RING.H * ringScale
  const rx = RING.RX * ringScale
  const target = (RING.SPAWN_MIN + RING.SPAWN_MAX) / 2
  let best: RingPos & { d: number } | null = null
  for (let i = 0; i < 80; i++) {
    const x = 40 + rand() * Math.max(1, viewportW - w - 80)
    const y = viewportH * 0.16 + rand() * viewportH * 0.5
    const cx = x + w / 2
    const ry = y + RING.RIM_Y * ringScale
    const d = Math.hypot(cx - center.x, ry - center.y)
    const cand = { x, y, w, h, cx, ry, rx, d }
    if (d >= RING.SPAWN_MIN && d <= RING.SPAWN_MAX) return { x, y, w, h, cx, ry, rx }
    if (!best || Math.abs(d - target) < Math.abs(best.d - target)) best = cand
  }
  const { x, y, cx, ry } = best!
  return { x, y, w, h, cx, ry, rx }
}

export type Launch = {
  vx: number
  vy: number
  /** Where he launches from: the pulled-back point (Angry Birds), not the anchor. */
  startX: number
  startY: number
  /** Pull length in px, capped at PULL_MAX. */
  pull: number
}

/** Slingshot: pull from the anchor toward `drag`; he flies the opposite way at pull × power. */
export function launchFromPull(anchor: Point, drag: Point, power: number): Launch {
  const dx = anchor.x - drag.x
  const dy = anchor.y - drag.y
  const d = Math.hypot(dx, dy)
  const pull = Math.min(RING.PULL_MAX, d)
  const k = d ? pull / d : 0
  const ux = dx * k
  const uy = dy * k
  return { vx: ux * power, vy: uy * power, startX: anchor.x - ux, startY: anchor.y - uy, pull }
}

export type ArcDot = { x: number; y: number; r: number; opacity: number }

/** The dotted preview: `previewSec` of ballistic flight from the launch point, fading with distance. */
export function aimArc(launch: Launch, gravity: number, previewSec: number, viewportH: number): ArcDot[] {
  const dots: ArcDot[] = []
  if (launch.pull <= 12) return dots
  const n = Math.round(previewSec / RING.ARC_DT)
  for (let i = 1; i <= n; i++) {
    const t = i * RING.ARC_DT
    const y = launch.startY + launch.vy * t + 0.5 * gravity * t * t
    if (y > viewportH + 40) break
    dots.push({ x: launch.startX + launch.vx * t, y, r: Math.max(1.6, 4.2 - i * 0.1), opacity: Math.max(0.2, 0.85 - i * 0.025) })
  }
  return dots
}

export type Flight = {
  /** Sprite centre. */
  x: number
  y: number
  vx: number
  vy: number
  /** Visual rotation in degrees (also what the silhouette test rotates by). */
  spin: number
  prevY: number
  scored: boolean
  t: number
}

export function startFlight(launch: Launch): Flight {
  return { x: launch.startX, y: launch.startY, vx: launch.vx, vy: launch.vy, spin: 0, prevY: launch.startY, scored: false, t: 0 }
}

/** Which way the sprite faces in flight (scaleX). */
export const flightFacing = (f: Flight): 1 | -1 => (f.vx >= 0 ? 1 : -1)

export type FlightInput = {
  dtSec: number
  gravity: number
  ring: RingPos | null
  /** True when the world point is inside Floaty's silhouette for this flight state. */
  touching: (px: number, py: number, f: Flight) => boolean
}

export type FlightEvent = {
  /** Which ring end he hit this frame (−1 left, 1 right), if any. */
  clank: -1 | 1 | null
  /** He went through the middle this frame. */
  scored: boolean
}

/** One frame of flight: gravity, the two collision points, and the through-the-middle test. */
export function stepFlight(f: Flight, input: FlightInput): { flight: Flight; event: FlightEvent } {
  const next: Flight = { ...f, prevY: f.y, t: f.t + input.dtSec }
  const event: FlightEvent = { clank: null, scored: false }
  const sdt = input.dtSec / RING.SUBSTEPS
  const ring = input.ring
  for (let k = 0; k < RING.SUBSTEPS; k++) {
    next.vy += input.gravity * sdt
    next.x += next.vx * sdt
    next.y += next.vy * sdt
    next.spin += next.vx * sdt * RING.SPIN_PER_PX
    if (!ring || next.scored) continue
    for (const side of [-1, 1] as const) {
      const ex = ring.cx + side * ring.rx
      const ey = ring.ry
      if (!input.touching(ex, ey, next)) continue
      let nx = next.x - ex
      let ny = next.y - ey
      const d = Math.hypot(nx, ny) || 1
      nx /= d
      ny /= d
      const dot = next.vx * nx + next.vy * ny
      if (dot < 0) {
        const inner = side === 1 ? next.x < ex : next.x > ex
        const e = inner ? RING.BOUNCE_INNER : RING.BOUNCE_OUTER
        next.vx -= (1 + e) * dot * nx
        next.vy -= (1 + e) * dot * ny
        if (inner) {
          next.vx += -side * RING.KICK_X
          next.vy -= RING.KICK_Y
        }
        next.spin += 60 * side
        event.clank = side
      }
      for (let i = 0; i < 30 && input.touching(ex, ey, next); i++) {
        next.x += nx * 2
        next.y += ny * 2
      }
    }
  }
  if (ring && !next.scored) {
    const crossed = (next.prevY < ring.ry && next.y >= ring.ry) || (next.prevY > ring.ry && next.y <= ring.ry)
    if (crossed && Math.abs(next.x - ring.cx) < ring.rx) {
      next.scored = true
      next.vx *= 0.25
      event.scored = true
    }
  }
  if (next.scored) next.vx *= 0.9
  return { flight: next, event }
}

/** Off every edge with margin — the shot is over. */
export function flightGone(f: Flight, viewportW: number, viewportH: number): boolean {
  return f.y > viewportH + 160 || f.x < -220 || f.x > viewportW + 220
}
