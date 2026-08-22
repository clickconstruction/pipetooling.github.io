import { describe, expect, it } from 'vitest'
import { EGG_MOTION, createEggState, eggOpacity, stepEgg, type EggInput } from './easterEggMotion'

const VP = { viewportW: 1400, viewportH: 900 }

function input(over: Partial<EggInput> = {}): EggInput {
  return { mouseX: 700, mouseY: 450, dtSec: 1 / 60, nowMs: 0, ...VP, ...over }
}

function run(state: ReturnType<typeof createEggState>, frames: number, over: Partial<EggInput> = {}, startMs = 0) {
  let s = state
  for (let i = 0; i < frames; i++) {
    s = stepEgg(s, input({ ...over, nowMs: startMs + (i + 1) * (1000 / 60) }))
  }
  return s
}

describe('stepEgg phases', () => {
  it('walks enter → play → leave → done on the clock (7s play)', () => {
    let s = createEggState(VP.viewportW, VP.viewportH, 0, () => 0.4)
    expect(s.phase).toBe('enter')
    s = stepEgg(s, input({ nowMs: EGG_MOTION.ENTER_MS + 1 }))
    expect(s.phase).toBe('play')
    const playStart = s.phaseStartMs
    s = stepEgg(s, input({ nowMs: playStart + EGG_MOTION.PLAY_MS - 1 }))
    expect(s.phase).toBe('play')
    s = stepEgg(s, input({ nowMs: playStart + EGG_MOTION.PLAY_MS + 1 }))
    expect(s.phase).toBe('leave')
    const leaveStart = s.phaseStartMs
    s = stepEgg(s, input({ nowMs: leaveStart + EGG_MOTION.LEAVE_MS + 1 }))
    expect(s.phase).toBe('done')
    expect(eggOpacity(s, leaveStart + EGG_MOTION.LEAVE_MS + 1)).toBe(0)
  })

  it('done is terminal', () => {
    let s = createEggState(VP.viewportW, VP.viewportH, 0, () => 0.4)
    s = { ...s, phase: 'done' as const }
    expect(stepEgg(s, input({ nowMs: 99999 })).phase).toBe('done')
  })
})

describe('stepEgg steering', () => {
  it('flees when the mouse gets inside the flee radius', () => {
    let s = createEggState(VP.viewportW, VP.viewportH, 0, () => 0.4)
    s = { ...s, phase: 'play' as const, phaseStartMs: 0, x: 700 - EGG_MOTION.SPRITE_W / 2, y: 450 - EGG_MOTION.SPRITE_H / 2, vx: 0, vy: 0 }
    // mouse 60px to the left of center → should accelerate right (positive vx)
    const out = run(s, 10, { mouseX: 700 - 60, mouseY: 450 })
    expect(out.vx).toBeGreaterThan(100)
  })

  it('caps wander speed at MAX_SPEED and flee speed at FLEE_SPEED', () => {
    let s = createEggState(VP.viewportW, VP.viewportH, 0, () => 0.4)
    s = { ...s, phase: 'play' as const, phaseStartMs: 0, x: 100, y: 100 }
    const wander = run(s, 240, { mouseX: 1300, mouseY: 800 })
    expect(Math.hypot(wander.vx, wander.vy)).toBeLessThanOrEqual(EGG_MOTION.MAX_SPEED + 1)
    let f = { ...s, x: 700 - EGG_MOTION.SPRITE_W / 2, y: 450 - EGG_MOTION.SPRITE_H / 2 }
    const flee = run(f, 30, { mouseX: 700 - 10, mouseY: 450 })
    expect(Math.hypot(flee.vx, flee.vy)).toBeLessThanOrEqual(EGG_MOTION.FLEE_SPEED + 1)
  })

  it('stays clamped inside the viewport while playing', () => {
    let s = createEggState(VP.viewportW, VP.viewportH, 0, () => 0.4)
    s = { ...s, phase: 'play' as const, phaseStartMs: 0, x: 10, y: 10 }
    // flee from a mouse at the top-left corner pushes him up-left → clamp holds
    const out = run(s, 120, { mouseX: 20, mouseY: 20 })
    expect(out.x).toBeGreaterThanOrEqual(-20)
    expect(out.y).toBeGreaterThanOrEqual(0)
    expect(out.x).toBeLessThanOrEqual(VP.viewportW - EGG_MOTION.SPRITE_W + 20)
    expect(out.y).toBeLessThanOrEqual(VP.viewportH - EGG_MOTION.SPRITE_H)
  })

  it('faces the direction of travel with hysteresis', () => {
    let s = createEggState(VP.viewportW, VP.viewportH, 0, () => 0.4)
    s = { ...s, phase: 'play' as const, phaseStartMs: 0, x: 700, y: 400, vx: 100, vy: 0 }
    expect(stepEgg(s, input({ nowMs: 16 })).facing).toBe(1)
    s = { ...s, vx: -100 }
    expect(stepEgg(s, input({ nowMs: 16 })).facing).toBe(-1)
    // small drift doesn't flip (mouse far away so no flee kick)
    s = { ...s, vx: 5, facing: -1 as const }
    expect(stepEgg(s, input({ nowMs: 16, mouseX: 1300, mouseY: 850 })).facing).toBe(-1)
  })
})
