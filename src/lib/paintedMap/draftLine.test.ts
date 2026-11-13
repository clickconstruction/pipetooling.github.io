import { describe, expect, it } from 'vitest'
import { fromPlane, type PaintedPoint } from './paintedLine'
import {
  addCorner,
  canSaveDraftLine,
  canUndoDraftLine,
  draftLengthMeters,
  emptyDraftLine,
  insertCorner,
  legMiddles,
  legsAtCorner,
  moveCorner,
  pickCorner,
  removeCorner,
  undoDraftLine,
} from './draftLine'

const ORIGIN: PaintedPoint = { lat: 29.5, lng: -98.2 }
const at = (eastM: number, northM: number): PaintedPoint => fromPlane(ORIGIN, { x: eastM, y: northM })

describe('a line being drawn by hand', () => {
  it('grows a corner at a time and is a line at two', () => {
    let d = emptyDraftLine()
    expect(canSaveDraftLine(d)).toBe(false)
    d = addCorner(d, at(0, 0))
    expect(canSaveDraftLine(d)).toBe(false)
    d = addCorner(d, at(100, 0))
    expect(canSaveDraftLine(d)).toBe(true)
    expect(draftLengthMeters(d)).toBeCloseTo(100, 0)
    expect(d.picked).toBe(1)
  })
  it('moves a corner and makes one in the middle of a leg', () => {
    let d = addCorner(addCorner(emptyDraftLine(), at(0, 0)), at(100, 0))
    d = insertCorner(d, 0, at(50, 30))
    expect(d.points).toHaveLength(3)
    expect(d.picked).toBe(1)
    d = moveCorner(d, 1, at(50, 0))
    expect(draftLengthMeters(d)).toBeCloseTo(100, 0)
  })
  it('takes a corner out', () => {
    let d = emptyDraftLine([at(0, 0), at(50, 40), at(100, 0)])
    d = removeCorner(d, 1)
    expect(d.points).toHaveLength(2)
    expect(d.picked).toBeNull()
  })
  it('steps back one move at a time, as far as the start', () => {
    let d = emptyDraftLine()
    d = addCorner(d, at(0, 0))
    d = addCorner(d, at(100, 0))
    d = moveCorner(d, 1, at(100, 50))
    expect(canUndoDraftLine(d)).toBe(true)
    d = undoDraftLine(d)
    expect(draftLengthMeters(d)).toBeCloseTo(100, 0)
    d = undoDraftLine(undoDraftLine(d))
    expect(d.points).toEqual([])
    expect(canUndoDraftLine(d)).toBe(false)
    expect(undoDraftLine(d)).toBe(d)
  })
  it('does not count picking a corner as a move', () => {
    let d = emptyDraftLine([at(0, 0), at(100, 0)])
    d = pickCorner(d, 0)
    expect(d.picked).toBe(0)
    expect(canUndoDraftLine(d)).toBe(false)
    expect(pickCorner(d, 9).picked).toBeNull()
  })
  it('refuses a move it cannot make and changes nothing', () => {
    const d = emptyDraftLine([at(0, 0), at(100, 0)])
    expect(moveCorner(d, 5, at(1, 1))).toBe(d)
    expect(insertCorner(d, 1, at(1, 1))).toBe(d)
    expect(addCorner(d, { lat: 0, lng: 0 })).toBe(d)
    expect(removeCorner(d, -1)).toBe(d)
  })
  it('opens on a saved line with nothing to undo', () => {
    const d = emptyDraftLine([at(0, 0), at(100, 0), { lat: 0, lng: 0 }])
    expect(d.points).toHaveLength(2)
    expect(canUndoDraftLine(d)).toBe(false)
  })
})

describe('what the readout says about a corner', () => {
  const line = [at(0, 0), at(60, 0), at(60, 80)]
  it('gives the leg back and the leg on', () => {
    const legs = legsAtCorner(line, 1)
    expect(legs.backM).toBeCloseTo(60, 0)
    expect(legs.onM).toBeCloseTo(80, 0)
  })
  it('gives one leg at an end and none off the line', () => {
    expect(legsAtCorner(line, 0)).toMatchObject({ backM: null })
    expect(legsAtCorner(line, 2).onM).toBeNull()
    expect(legsAtCorner(line, 7)).toEqual({ backM: null, onM: null })
  })
  it('finds the middle of each leg', () => {
    const mids = legMiddles(line)
    expect(mids).toHaveLength(2)
    expect(mids[0]!.lng).toBeCloseTo((line[0]!.lng + line[1]!.lng) / 2, 9)
    expect(legMiddles([at(0, 0)])).toEqual([])
  })
})
