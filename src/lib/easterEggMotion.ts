/**
 * The easter-egg steering brain (v2.2074) — the exact math from the approved
 * live demo, pure and clock-injected so every rule is testable: wander toward
 * a point orbiting the cursor, flee inside FLEE_R, play for PLAY_MS (owner
 * spec: 7 seconds), then drift off the nearest edge. The component just calls
 * `stepEgg` from a requestAnimationFrame loop and paints the transform.
 */

export const EGG_MOTION = {
  PLAY_MS: 7000,
  ENTER_MS: 900,
  LEAVE_MS: 1400,
  FLEE_R: 140,
  ORBIT_R: 200,
  WANDER_ACCEL: 260,
  FLEE_ACCEL: 2600,
  MAX_SPEED: 170,
  FLEE_SPEED: 620,
  LEAVE_SPEED: 420,
  LEAVE_BOOST: 3.2,
  DAMPING: 1.4,
  SPRITE_W: 110,
  SPRITE_H: 130,
} as const

export type EggPhase = 'enter' | 'play' | 'leave' | 'done'

export type EggState = {
  x: number
  y: number
  vx: number
  vy: number
  /** Orbit angle around the cursor's play point. */
  theta: number
  phase: EggPhase
  phaseStartMs: number
  /** 1 faces right, -1 faces left (hysteresis on vx). */
  facing: 1 | -1
}

export type EggInput = {
  mouseX: number
  mouseY: number
  viewportW: number
  viewportH: number
  dtSec: number
  nowMs: number
}

/** Spawn just off a random side edge, at a random upper-half height. */
export function createEggState(viewportW: number, viewportH: number, nowMs: number, rand: () => number = Math.random): EggState {
  const fromLeft = rand() < 0.5
  return {
    x: fromLeft ? -EGG_MOTION.SPRITE_W - 30 : viewportW + 30,
    y: 120 + rand() * viewportH * 0.5,
    vx: 0,
    vy: 0,
    theta: rand() * Math.PI * 2,
    phase: 'enter',
    phaseStartMs: nowMs,
    facing: 1,
  }
}

export function stepEgg(s: EggState, input: EggInput): EggState {
  if (s.phase === 'done') return s
  const M = EGG_MOTION
  const dt = Math.min(0.05, input.dtSec)
  const elapsed = input.nowMs - s.phaseStartMs
  const next: EggState = { ...s }
  const cx = s.x + M.SPRITE_W / 2
  const cy = s.y + M.SPRITE_H / 2

  let phase = s.phase
  let phaseStartMs = s.phaseStartMs
  if (phase === 'enter' && elapsed > M.ENTER_MS) {
    phase = 'play'
    phaseStartMs = input.nowMs
  } else if (phase === 'play' && elapsed >= M.PLAY_MS) {
    phase = 'leave'
    phaseStartMs = input.nowMs
  } else if (phase === 'leave' && elapsed > M.LEAVE_MS) {
    next.phase = 'done'
    return next
  }
  next.phase = phase
  next.phaseStartMs = phaseStartMs

  let targetX: number
  let targetY: number
  if (phase === 'leave') {
    targetX = cx < input.viewportW / 2 ? -220 : input.viewportW + 120
    targetY = cy - 40
  } else {
    if (phase === 'play') next.theta = s.theta + dt * 0.45
    targetX = input.mouseX + Math.cos(next.theta) * M.ORBIT_R
    targetY = input.mouseY + Math.sin(next.theta) * M.ORBIT_R
  }

  // Steering: flee beats wander inside the flee radius (play phase only).
  const dxm = cx - input.mouseX
  const dym = cy - input.mouseY
  const dm = Math.hypot(dxm, dym)
  let ax: number
  let ay: number
  let cap: number
  if (phase === 'play' && dm < M.FLEE_R) {
    const f = (M.FLEE_R - dm) / M.FLEE_R
    ax = (dxm / (dm || 1)) * M.FLEE_ACCEL * (0.4 + f)
    ay = (dym / (dm || 1)) * M.FLEE_ACCEL * (0.4 + f)
    cap = M.FLEE_SPEED
  } else {
    const dx = targetX - cx
    const dy = targetY - cy
    const d = Math.hypot(dx, dy) || 1
    const boost = phase === 'leave' ? M.LEAVE_BOOST : 1
    ax = (dx / d) * M.WANDER_ACCEL * boost
    ay = (dy / d) * M.WANDER_ACCEL * boost
    cap = phase === 'leave' ? M.LEAVE_SPEED : M.MAX_SPEED
  }

  next.vx = s.vx + ax * dt
  next.vy = s.vy + ay * dt
  next.vx -= next.vx * M.DAMPING * dt
  next.vy -= next.vy * M.DAMPING * dt
  const sp = Math.hypot(next.vx, next.vy)
  if (sp > cap) {
    next.vx = (next.vx / sp) * cap
    next.vy = (next.vy / sp) * cap
  }
  next.x = s.x + next.vx * dt
  next.y = s.y + next.vy * dt

  if (phase !== 'leave') {
    next.x = Math.max(-20, Math.min(input.viewportW - M.SPRITE_W + 20, next.x))
    next.y = Math.max(0, Math.min(input.viewportH - M.SPRITE_H, next.y))
  }

  if (next.vx > 30) next.facing = 1
  else if (next.vx < -30) next.facing = -1

  return next
}

/** Enter fade-in / leave fade-out, 0–1. */
export function eggOpacity(s: EggState, nowMs: number): number {
  const elapsed = nowMs - s.phaseStartMs
  if (s.phase === 'enter') return Math.min(1, elapsed / 600)
  if (s.phase === 'leave') return Math.max(0, 1 - elapsed / 1200)
  if (s.phase === 'done') return 0
  return 1
}

/** The cute layer: bob, lean into travel, face where you're going. */
export function eggTransform(s: EggState, nowMs: number): string {
  const bob = Math.sin(nowMs / 450) * 6
  const lean = Math.max(-9, Math.min(9, s.vx * 0.025))
  return `translate3d(${s.x}px, ${s.y + bob}px, 0) rotate(${lean}deg) scaleX(${s.facing})`
}
