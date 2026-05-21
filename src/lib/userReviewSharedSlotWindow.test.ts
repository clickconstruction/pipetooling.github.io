import { describe, it, expect } from 'vitest'
import {
  applyRailWindowMinFloor,
  computeUserReviewSharedSlotWindow,
  USER_REVIEW_RAIL_MIN_FLOOR_SLOTS,
  type SharedSlotWindowRowInput,
} from './userReviewSharedSlotWindow'
import { DISPATCH_ADD_BLOCK_SLOT_COUNT } from './dispatchAddBlockTime'

const MAX = DISPATCH_ADD_BLOCK_SLOT_COUNT - 1

function row(
  occupied: Array<[number, number]>,
  secondary: Array<[number, number]> = [],
): SharedSlotWindowRowInput {
  return {
    occupiedStartHiSlots: occupied.map(([s, e]) => ({ startSlotIndex: s, endSlotIndex: e })),
    secondaryStartHiSlots: secondary.map(([s, e]) => ({ startSlotIndex: s, endSlotIndex: e })),
  }
}

describe('computeUserReviewSharedSlotWindow', () => {
  it('returns null for an empty input', () => {
    expect(computeUserReviewSharedSlotWindow([])).toBeNull()
  })

  it('returns null when every row has zero bands', () => {
    expect(
      computeUserReviewSharedSlotWindow([row([], []), row([], []), row([], [])]),
    ).toBeNull()
  })

  it('uses only occupied bands when secondary is empty', () => {
    const out = computeUserReviewSharedSlotWindow([row([[8, 16]])])
    expect(out).toEqual({ loSlotIndex: 8, hiSlotIndex: 16 })
  })

  it('uses only secondary bands when occupied is empty', () => {
    const out = computeUserReviewSharedSlotWindow([row([], [[10, 14]])])
    expect(out).toEqual({ loSlotIndex: 10, hiSlotIndex: 14 })
  })

  it('takes the min/max across the union of every band on every row', () => {
    const out = computeUserReviewSharedSlotWindow([
      row([[12, 16]]),
      row([], [[8, 10]]),
      row([[20, 24]], [[22, 26]]),
    ])
    expect(out).toEqual({ loSlotIndex: 8, hiSlotIndex: 26 })
  })

  it('ignores empty rows mixed with populated ones', () => {
    const out = computeUserReviewSharedSlotWindow([
      row([], []),
      row([[10, 12]]),
      row([], []),
      row([], [[18, 22]]),
      row([], []),
    ])
    expect(out).toEqual({ loSlotIndex: 10, hiSlotIndex: 22 })
  })

  it('normalizes reversed (start > end) bands via Math.min/Math.max', () => {
    const out = computeUserReviewSharedSlotWindow([row([[20, 10]])])
    expect(out).toEqual({ loSlotIndex: 10, hiSlotIndex: 20 })
  })

  it('clamps out-of-range slot indices defensively', () => {
    const out = computeUserReviewSharedSlotWindow([row([[-5, MAX + 50]])])
    expect(out).toEqual({ loSlotIndex: 0, hiSlotIndex: MAX })
  })
})

describe('applyRailWindowMinFloor', () => {
  const FLOOR = USER_REVIEW_RAIL_MIN_FLOOR_SLOTS // 8 slots = 4 hours

  it('passes through null (empty view)', () => {
    expect(applyRailWindowMinFloor(null, FLOOR)).toBeNull()
  })

  it('passes through an already-wide window unchanged', () => {
    const wide = { loSlotIndex: 8, hiSlotIndex: 24 }
    expect(applyRailWindowMinFloor(wide, FLOOR)).toEqual(wide)
  })

  it('expands a narrow window symmetrically around the midpoint when there is room on both sides', () => {
    // [16, 17] has midpoint 16.5; floor span 7 → expand by 6 (3 left + 3 right).
    const out = applyRailWindowMinFloor({ loSlotIndex: 16, hiSlotIndex: 17 }, FLOOR)
    expect(out).toEqual({ loSlotIndex: 13, hiSlotIndex: 20 })
  })

  it('clamps a narrow window pinned to the left edge and shifts deficit right', () => {
    // [0, 1]: expand by 6 → ideal [-3, 4]; clamp left to 0, push 3 right → [0, 7].
    const out = applyRailWindowMinFloor({ loSlotIndex: 0, hiSlotIndex: 1 }, FLOOR)
    expect(out).toEqual({ loSlotIndex: 0, hiSlotIndex: 7 })
  })

  it('clamps a narrow window pinned to the right edge and shifts deficit left', () => {
    // MAX = 32 (slotCount = 33). [31, 32]: expand by 6 → ideal [28, 35]; clamp right to 32, push 3 left → [25, 32].
    const out = applyRailWindowMinFloor({ loSlotIndex: MAX - 1, hiSlotIndex: MAX }, FLOOR)
    expect(out).toEqual({ loSlotIndex: MAX - 7, hiSlotIndex: MAX })
  })

  it('returns the full track when the requested floor exceeds the track width', () => {
    const huge = MAX * 4
    const out = applyRailWindowMinFloor({ loSlotIndex: 4, hiSlotIndex: 6 }, huge)
    expect(out).toEqual({ loSlotIndex: 0, hiSlotIndex: MAX })
  })
})
