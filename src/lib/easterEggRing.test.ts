import { describe, expect, it } from 'vitest'
import { RING, aimArc, flightGone, launchFromPull, placeRing, startFlight, stepFlight, type Flight, type RingPos } from './easterEggRing'
import { makeTouching, maskFromRgba } from './easterEggSilhouette'

const VW = 1280
const VH = 720
const G = 1500
const P = 9

/** A synthetic silhouette: a 30px-radius disc in the middle of his box, so the rules are tested on known geometry. */
function discMask(r = 30) {
  const w = RING.SPRITE_W
  const h = RING.SPRITE_H
  const rgba = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.hypot(x - w / 2, y - h / 2) <= r) rgba[(y * w + x) * 4 + 3] = 255
  return maskFromRgba(rgba, w, h)
}
const touching = makeTouching(discMask(), RING.SPRITE_W, RING.SPRITE_H, () => 1, () => 1)

function ringAt(cx: number, ry: number, scale = 1): RingPos {
  const w = RING.W * scale
  return { x: cx - w / 2, y: ry - RING.RIM_Y * scale, w, h: RING.H * scale, cx, ry, rx: RING.RX * scale }
}

/** Solve a pull that sends him through (tx, ty) after T seconds, accounting for the pulled-back launch point. */
function pullFor(anchor: { x: number; y: number }, tx: number, ty: number, T: number) {
  const k = T - 1 / P
  const vx = (tx - anchor.x) / k
  const vy = (ty - anchor.y - 0.5 * G * T * T) / k
  return { x: anchor.x - vx / P, y: anchor.y - vy / P }
}

type Outcome = { scored: boolean; clanks: Array<-1 | 1>; final: Flight; frames: number }
function fly(f0: Flight, ring: RingPos | null, maxFrames = 400): Outcome {
  let f = f0
  const clanks: Array<-1 | 1> = []
  let scored = false
  let frames = 0
  while (frames < maxFrames && !flightGone(f, VW, VH)) {
    const r = stepFlight(f, { dtSec: 1 / 60, gravity: G, ring, touching })
    f = r.flight
    if (r.event.clank) clanks.push(r.event.clank)
    if (r.event.scored) scored = true
    frames++
    if (scored && frames > 90) break
  }
  return { scored, clanks, final: f, frames }
}

describe('launchFromPull', () => {
  it('flies opposite the pull at pull × power and launches from the pulled-back point', () => {
    const l = launchFromPull({ x: 500, y: 400 }, { x: 440, y: 480 }, P)
    expect(l.pull).toBe(100)
    expect(l.vx).toBeCloseTo(60 * P)
    expect(l.vy).toBeCloseTo(-80 * P)
    expect(l.startX).toBe(440)
    expect(l.startY).toBe(480)
  })

  it('caps the pull at PULL_MAX', () => {
    const l = launchFromPull({ x: 500, y: 400 }, { x: 100, y: 400 }, P)
    expect(l.pull).toBe(RING.PULL_MAX)
    expect(l.vx).toBeCloseTo(RING.PULL_MAX * P)
    expect(l.startX).toBeCloseTo(500 - RING.PULL_MAX)
  })
})

describe('aimArc', () => {
  it('is empty for a tiny pull and grows with the preview length', () => {
    expect(aimArc(launchFromPull({ x: 0, y: 0 }, { x: -5, y: 0 }, P), G, 0.8, VH)).toEqual([])
    const l = launchFromPull({ x: 300, y: 500 }, { x: 200, y: 560 }, P)
    expect(aimArc(l, G, 0, VH)).toHaveLength(0)
    expect(aimArc(l, G, 0.8, VH)).toHaveLength(Math.round(0.8 / RING.ARC_DT))
    expect(aimArc(l, G, 1.6, VH).length).toBeGreaterThan(aimArc(l, G, 0.8, VH).length)
  })

  it('follows the ballistic path from the launch point and stops below the viewport', () => {
    const l = launchFromPull({ x: 300, y: 500 }, { x: 200, y: 560 }, P)
    const dots = aimArc(l, G, 1.6, VH)
    const t = RING.ARC_DT
    expect(dots[0]!.x).toBeCloseTo(l.startX + l.vx * t)
    expect(dots[0]!.y).toBeCloseTo(l.startY + l.vy * t + 0.5 * G * t * t)
    expect(dots.every((d) => d.y <= VH + 40)).toBe(true)
  })
})

describe('placeRing', () => {
  it('lands 360–620px from Floaty and inside the viewport', () => {
    let seed = 3
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (let i = 0; i < 25; i++) {
      const c = { x: 60 + rand() * (VW - 120), y: 100 + rand() * (VH - 200) }
      const r = placeRing(c, VW, VH, 1, rand)
      const d = Math.hypot(r.cx - c.x, r.ry - c.y)
      expect(d).toBeGreaterThanOrEqual(RING.SPAWN_MIN)
      expect(d).toBeLessThanOrEqual(RING.SPAWN_MAX)
      expect(r.x).toBeGreaterThanOrEqual(40)
      expect(r.x + r.w).toBeLessThanOrEqual(VW - 40)
    }
  })

  it('scales the ring with ringScale', () => {
    const r = placeRing({ x: 100, y: 300 }, VW, VH, 1.25, () => 0.5)
    expect(r.rx).toBeCloseTo(RING.RX * 1.25)
    expect(r.w).toBeCloseTo(RING.W * 1.25)
  })
})

describe('stepFlight — through the middle', () => {
  it('a centred shot from above scores and ends the shot', () => {
    const anchor = { x: 300, y: 500 }
    const ring = ringAt(820, 340, 1.25)
    const l = launchFromPull(anchor, pullFor(anchor, ring.cx, ring.ry, 0.95), P)
    const out = fly(startFlight(l), ring)
    expect(out.scored).toBe(true)
  })

  it('a shot up from underneath through the middle also counts', () => {
    // He sits below and left of the ring; the arc rises through the rim line.
    const anchor = { x: 640, y: 640 }
    const ring = ringAt(700, 330, 1.25)
    const l = launchFromPull(anchor, pullFor(anchor, ring.cx, ring.ry + 2, 0.36), P)
    expect(l.vy + G * 0.36).toBeLessThan(0) // still rising when he reaches the rim
    const out = fly(startFlight(l), ring)
    expect(out.scored).toBe(true)
  })

  it('scores once, then only damps', () => {
    const anchor = { x: 300, y: 500 }
    const ring = ringAt(820, 340, 1.25)
    const l = launchFromPull(anchor, pullFor(anchor, ring.cx, ring.ry, 0.95), P)
    let f = startFlight(l)
    let scoredEvents = 0
    for (let i = 0; i < 400 && !flightGone(f, VW, VH); i++) {
      const r = stepFlight(f, { dtSec: 1 / 60, gravity: G, ring, touching })
      f = r.flight
      if (r.event.scored) scoredEvents++
    }
    expect(scoredEvents).toBe(1)
  })
})

describe('stepFlight — the two collision points', () => {
  it('the almost-in shot clips the inside of the far end and rattles back toward the shooter', () => {
    const anchor = { x: 300, y: 500 }
    const ring = ringAt(820, 340, 1.25)
    // Aim just inside the far (right) point at rim height: his right edge catches it.
    const l = launchFromPull(anchor, pullFor(anchor, ring.cx + ring.rx - 24, ring.ry - 4, 0.95), P)
    let f = startFlight(l)
    let clank: -1 | 1 | null = null
    let before: Flight | null = null
    let after: Flight | null = null
    for (let i = 0; i < 400 && !flightGone(f, VW, VH); i++) {
      const r = stepFlight(f, { dtSec: 1 / 60, gravity: G, ring, touching })
      if (r.event.clank && !clank) {
        clank = r.event.clank
        before = f
        after = r.flight
      }
      f = r.flight
    }
    expect(clank).toBe(1)
    expect(before!.vx).toBeGreaterThan(0) // he was flying right, into the ring
    expect(after!.vx).toBeLessThan(0) // and heads back left, toward where he was shot from
    expect(after!.vy).toBeLessThan(before!.vy) // with an upward kick — the rattle, not a slide
  })

  it('an outside hit is a duller bounce that never scores', () => {
    const anchor = { x: 300, y: 500 }
    const ring = ringAt(820, 340, 1.25)
    // Aim well outside the far point so his edge hits it from the outside.
    const l = launchFromPull(anchor, pullFor(anchor, ring.cx + ring.rx + 24, ring.ry - 10, 1.0), P)
    const out = fly(startFlight(l), ring)
    expect(out.clanks.length).toBeGreaterThan(0)
    expect(out.scored).toBe(false)
  })

  it('a wide miss touches nothing', () => {
    const anchor = { x: 300, y: 500 }
    const ring = ringAt(820, 340, 1.25)
    const l = launchFromPull(anchor, pullFor(anchor, ring.cx, ring.ry - 260, 0.9), P)
    const out = fly(startFlight(l), null)
    expect(out.clanks).toEqual([])
    expect(out.scored).toBe(false)
  })

  it('never lets him rest inside a collision point', () => {
    const ring = ringAt(600, 300)
    let f: Flight = { x: ring.cx + ring.rx - 10, y: ring.ry - 20, vx: 0, vy: 50, spin: 0, prevY: ring.ry - 21, scored: false, t: 0 }
    for (let i = 0; i < 5; i++) f = stepFlight(f, { dtSec: 1 / 60, gravity: G, ring, touching }).flight
    expect(touching(ring.cx + ring.rx, ring.ry, f)).toBe(false)
  })
})

describe('flightGone', () => {
  it('is true only well off the edges', () => {
    const base: Flight = { x: 100, y: 100, vx: 0, vy: 0, spin: 0, prevY: 100, scored: false, t: 0 }
    expect(flightGone(base, VW, VH)).toBe(false)
    expect(flightGone({ ...base, y: VH + 161 }, VW, VH)).toBe(true)
    expect(flightGone({ ...base, x: -221 }, VW, VH)).toBe(true)
    expect(flightGone({ ...base, x: VW + 221 }, VW, VH)).toBe(true)
  })
})
