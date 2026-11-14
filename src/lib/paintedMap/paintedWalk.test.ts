import { describe, expect, it } from 'vitest'
import { fromPlane, type PaintedPoint } from './paintedLine'
import { PAINT_MAX_MS, PAINT_STANDING_MS, type PaintedFix } from './paintedTrack'
import {
  WALK_KEEP_MS,
  canResumeWalk,
  readKeptWalk,
  startWalk,
  walkFix,
  walkHasLine,
  walkHidden,
  walkLengthMeters,
  walkPaintedMs,
  walkPause,
  walkResume,
  walkShown,
  walkStrokes,
  walkSure,
  walkTick,
  type WalkState,
} from './paintedWalk'

const ORIGIN: PaintedPoint = { lat: 29.5, lng: -98.2 }
const fix = (eastM: number, northM: number, atMs: number, accuracyM: number | null = 5): PaintedFix => ({ ...fromPlane(ORIGIN, { x: eastM, y: northM }), accuracyM, atMs })

/** A walk east from `fromEast`, a reading every two seconds and 8 m, starting at `t0`. */
function walkEast(state: WalkState, fromEast: number, steps: number, t0: number): { state: WalkState; t: number } {
  let s = state
  let t = t0
  for (let i = 0; i < steps; i++) {
    t = t0 + i * 2000
    s = walkFix(s, fix(fromEast + i * 8, 0, t), t)
  }
  return { state: s, t }
}

describe('painting a walk', () => {
  it('keeps the readings that are real steps and draws a line of the right length', () => {
    const { state } = walkEast(startWalk(0), 0, 11, 0)
    expect(state.current).toHaveLength(11)
    expect(walkLengthMeters(state)).toBeCloseTo(80, 0)
    expect(walkHasLine(state)).toBe(true)
    expect(walkStrokes(state)[0]!.how).toBe('walked')
  })
  it('keeps where the person is even when the reading was not a step', () => {
    let s = walkFix(startWalk(0), fix(0, 0, 1000), 1000)
    s = walkFix(s, fix(1, 1, 2000), 2000)
    expect(s.current).toHaveLength(1)
    expect(s.last?.atMs).toBe(2000)
    expect(walkHasLine(s)).toBe(false)
  })
  it('does not paint from a rough location, and says the phone is giving one', () => {
    const s = walkFix(startWalk(0), fix(0, 0, 1000, 2500), 1000)
    expect(s.rough).toBe(true)
    expect(s.current).toHaveLength(0)
    expect(walkFix(s, fix(0, 0, 2000, 6), 2000).rough).toBe(false)
  })
  it('ignores a reading the phone remembered from before', () => {
    const s = walkFix(startWalk(60_000), fix(0, 0, 20_000), 60_000)
    expect(s.last).toBeNull()
    expect(s.current).toHaveLength(0)
  })
  it('says how sure the phone is now', () => {
    expect(walkSure(walkFix(startWalk(0), fix(0, 0, 1000, 4), 1000))).toEqual({ accuracyM: 4, poor: false })
    expect(walkSure(walkFix(startWalk(0), fix(0, 0, 1000, 30), 1000))).toEqual({ accuracyM: 30, poor: true })
    expect(walkSure(startWalk(0))).toEqual({ accuracyM: null, poor: false })
  })
})

describe('pause and restart', () => {
  it('reads nothing while paused, and closes the stroke', () => {
    const walked = walkEast(startWalk(0), 0, 6, 0)
    const paused = walkPause(walked.state, walked.t + 1000)
    expect(paused.status).toBe('paused')
    expect(paused.pausedWhy).toBe('press')
    expect(paused.strokes).toHaveLength(1)
    expect(walkFix(paused, fix(500, 0, walked.t + 2000), walked.t + 2000)).toBe(paused)
  })
  it('starts a new stroke on a restart, so a pause leaves two lines', () => {
    const a = walkEast(startWalk(0), 0, 6, 0)
    const resumed = walkResume(walkPause(a.state, a.t + 1000), false, a.t + 60_000)
    const b = walkEast(resumed, 200, 6, a.t + 61_000)
    const strokes = walkStrokes(b.state)
    expect(strokes).toHaveLength(2)
    expect(walkLengthMeters(b.state)).toBeCloseTo(80, 0)
  })
  it('joins the gap with a straight line when asked', () => {
    const a = walkEast(startWalk(0), 0, 6, 0)
    const resumed = walkResume(walkPause(a.state, a.t + 1000), true, a.t + 60_000)
    const b = walkEast(resumed, 200, 6, a.t + 61_000)
    const strokes = walkStrokes(b.state)
    expect(strokes).toHaveLength(1)
    // 40 m, a straight 160 m across the gap, then 40 m.
    expect(walkLengthMeters(b.state)).toBeCloseTo(240, 0)
  })
  it('drops a stroke of one reading: a dot is not a line', () => {
    const s = walkPause(walkFix(startWalk(0), fix(0, 0, 1000), 1000), 2000)
    expect(s.strokes).toHaveLength(0)
  })
  it('counts only the time spent painting', () => {
    const a = walkEast(startWalk(0), 0, 6, 0)
    const paused = walkPause(a.state, 30_000)
    expect(walkPaintedMs(paused, 500_000)).toBe(30_000)
    const resumed = walkResume(paused, false, 600_000)
    expect(walkPaintedMs(resumed, 610_000)).toBe(40_000)
  })
})

describe('a locked screen', () => {
  it('pauses the painting and remembers how long the screen was off', () => {
    const a = walkEast(startWalk(0), 0, 6, 0)
    const hidden = walkHidden(a.state, 20_000)
    expect(hidden.pausedWhy).toBe('hidden')
    expect(hidden.gapMs).toBeNull()
    const back = walkShown(hidden, 140_000)
    expect(back.status).toBe('paused')
    expect(back.gapMs).toBe(120_000)
    expect(canResumeWalk(back)).toBe(true)
  })
  it('leaves a press-pause alone when the page comes back', () => {
    const paused = walkPause(walkEast(startWalk(0), 0, 6, 0).state, 20_000)
    expect(walkShown(paused, 99_000)).toBe(paused)
  })
})

describe('stopping by itself', () => {
  it('pauses after five minutes with no real step', () => {
    const a = walkEast(startWalk(0), 0, 6, 0)
    expect(walkTick(a.state, a.t + 60_000).status).toBe('painting')
    const still = walkTick(a.state, a.t + PAINT_STANDING_MS)
    expect(still.pausedWhy).toBe('standing')
    expect(canResumeWalk(still)).toBe(true)
  })
  it('ends after an hour of painting, and cannot start again', () => {
    let s = startWalk(0)
    // Keep moving for an hour: a real step every minute.
    for (let m = 0; m < 60; m++) {
      s = walkFix(s, fix(m * 50, 0, m * 60_000), m * 60_000)
      s = walkTick(s, m * 60_000)
    }
    expect(s.status).toBe('painting')
    const over = walkTick(s, PAINT_MAX_MS)
    expect(over.pausedWhy).toBe('time')
    expect(canResumeWalk(over)).toBe(false)
    expect(walkResume(over, false, PAINT_MAX_MS + 1000)).toBe(over)
    expect(walkHasLine(over)).toBe(true)
  })
  it('does not count a pause against the hour', () => {
    const a = walkEast(startWalk(0), 0, 6, 0)
    const resumed = walkResume(walkPause(a.state, 20_000), false, PAINT_MAX_MS + 50_000)
    expect(walkTick(walkFix(resumed, fix(900, 0, PAINT_MAX_MS + 60_000), PAINT_MAX_MS + 60_000), PAINT_MAX_MS + 61_000).status).toBe('painting')
  })
})

describe('what a walk hands over', () => {
  it('is shapes, with no time in them', () => {
    const strokes = walkStrokes(walkEast(startWalk(1_700_000_000_000), 0, 8, 1_700_000_000_000).state)
    expect(JSON.stringify(strokes)).not.toMatch(/atMs|17000000/)
    expect(Object.keys(strokes[0]!.points[0]!).sort()).toEqual(['lat', 'lng'])
  })
  it('marks a stretch the phone was not sure of and keeps it out of the length', () => {
    let s = startWalk(0)
    let t = 0
    for (let i = 0; i <= 10; i++) s = walkFix(s, fix(i * 10, 0, (t = i * 3000), 5), t)
    for (const [e, n] of [[150, -22], [185, 20]] as const) s = walkFix(s, fix(e, n, (t += 4000), 45), t)
    for (let i = 0; i <= 10; i++) s = walkFix(s, fix(220 + i * 10, 0, (t += 3000), 5), t)
    const [stroke] = walkStrokes(s)
    expect(stroke!.poorParts).toHaveLength(1)
    expect(walkLengthMeters(s)).toBeCloseTo(200, 0)
  })
  it('gives each stroke a give or take from how sure the phone was at its ends', () => {
    const [stroke] = walkStrokes(walkEast(startWalk(0), 0, 11, 0).state)
    expect(stroke!.marginM).toBeGreaterThan(10)
    expect(stroke!.marginM).toBeLessThan(15)
  })
  it('calls a fast stroke driven', () => {
    let s = startWalk(0)
    for (let i = 0; i < 20; i++) s = walkFix(s, fix(i * 30, 0, i * 2000), i * 2000)
    expect(walkStrokes(s)[0]!.how).toBe('driven')
  })
})

describe('a walk kept on the phone', () => {
  const MAP = { id: 'm1', name: 'The way in' }
  it('comes back paused, with the gap it has', () => {
    const a = walkEast(startWalk(0), 0, 6, 0)
    const raw = JSON.stringify({ savedAtMs: 12_000, map: MAP, state: a.state })
    const kept = readKeptWalk<typeof MAP>(raw, 72_000)!
    expect(kept.map).toEqual(MAP)
    expect(kept.state!.status).toBe('paused')
    expect(kept.state!.pausedWhy).toBe('hidden')
    expect(kept.state!.gapMs).toBe(60_000)
    expect(kept.state!.strokes).toHaveLength(1)
  })
  it('comes back as it was when it was already paused', () => {
    const paused = walkPause(walkEast(startWalk(0), 0, 6, 0).state, 12_000)
    const kept = readKeptWalk(JSON.stringify({ savedAtMs: 12_000, map: MAP, state: paused }), 72_000)!
    expect(kept.state!.pausedWhy).toBe('press')
  })
  it('comes back with no live walk once it was looked over: the lines waiting are the screen\'s', () => {
    const kept = readKeptWalk<{ id: string; pending: number }>(JSON.stringify({ savedAtMs: 5, map: { id: 'm1', pending: 2 }, state: null }), 10)!
    expect(kept.state).toBeNull()
    expect(kept.map.pending).toBe(2)
  })
  it('is thrown away after a day, and anything that is not a walk reads as none', () => {
    const a = walkEast(startWalk(0), 0, 6, 0)
    expect(readKeptWalk(JSON.stringify({ savedAtMs: 0, map: MAP, state: a.state }), WALK_KEEP_MS + 1)).toBeNull()
    expect(readKeptWalk('not json', 0)).toBeNull()
    expect(readKeptWalk(JSON.stringify({ savedAtMs: 0 }), 0)).toBeNull()
    expect(readKeptWalk(JSON.stringify({ savedAtMs: 0, map: MAP, state: { status: 'flying', strokes: [], current: [] } }), 0)).toBeNull()
    expect(readKeptWalk(null, 0)).toBeNull()
  })
})
