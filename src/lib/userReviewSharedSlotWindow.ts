import { DISPATCH_ADD_BLOCK_SLOT_COUNT } from './dispatchAddBlockTime'

/**
 * Minimum span (in 30-minute slots) the rescaled rail window will adopt
 * inside the User Review modal. 8 slots = 4 hours of visible context, so
 * a tiny single-event day doesn't end up filling the whole strip.
 */
export const USER_REVIEW_RAIL_MIN_FLOOR_SLOTS = 8

export type SharedSlotWindow = { loSlotIndex: number; hiSlotIndex: number }

type BandSlots = { startSlotIndex: number; endSlotIndex: number }

export type SharedSlotWindowRowInput = {
  occupiedStartHiSlots: ReadonlyArray<BandSlots>
  secondaryStartHiSlots: ReadonlyArray<BandSlots>
}

const MAX_SLOT_INDEX = DISPATCH_ADD_BLOCK_SLOT_COUNT - 1

function clampSlot(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > MAX_SLOT_INDEX) return MAX_SLOT_INDEX
  return Math.trunc(n)
}

/**
 * Reduces every band across every row in the User Review modal view down
 * to one shared `[loSlotIndex, hiSlotIndex]` slot window. The User Review
 * Day / Week / Month sections use the result to clip the grey schedule
 * rail to the active part of the day while keeping band positions on the
 * full track (so a band at 9 AM stays at the same x-coordinate across
 * rows regardless of trim).
 *
 * - Returns `null` when zero bands exist in the input — callers treat
 *   that as "hide every rail" (`<DispatchAddBlockTimeRange railTrimWindow={null}>`).
 * - Each band's start/end is normalized via `Math.min` / `Math.max` so a
 *   reversed `(start > end)` band can't accidentally invert the window.
 * - Result is defensively clamped to the legal slot range
 *   `[0, DISPATCH_ADD_BLOCK_SLOT_COUNT - 1]`.
 */
export function computeUserReviewSharedSlotWindow(
  rows: ReadonlyArray<SharedSlotWindowRowInput>,
): SharedSlotWindow | null {
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  let seenAny = false

  const visit = (bands: ReadonlyArray<BandSlots>): void => {
    for (const b of bands) {
      const s = clampSlot(Math.min(b.startSlotIndex, b.endSlotIndex))
      const e = clampSlot(Math.max(b.startSlotIndex, b.endSlotIndex))
      if (s < lo) lo = s
      if (e > hi) hi = e
      seenAny = true
    }
  }

  for (const row of rows) {
    visit(row.occupiedStartHiSlots)
    visit(row.secondaryStartHiSlots)
  }

  if (!seenAny) return null
  return { loSlotIndex: lo, hiSlotIndex: hi }
}

/**
 * Expands a rail trim window so its span (`hi - lo`) is at least
 * `minSpanSlots - 1` slot units wide (e.g. a `minSpanSlots = 8` floor
 * means the window covers at least 8 slots = 4 hours of 30-minute
 * granularity). Used by the User Review modal so a tiny single-event
 * day doesn't rescale into a misleading full-strip render.
 *
 * - `null` passes through unchanged (empty view stays empty).
 * - Already-wide windows pass through unchanged.
 * - Otherwise expands symmetrically around the original midpoint, then
 *   re-clamps to the legal slot range `[0, DISPATCH_ADD_BLOCK_SLOT_COUNT - 1]`.
 *   If clamping shrinks one side, the deficit shifts to the other side
 *   so the final span hits the floor whenever the track is wide enough
 *   (16-hour track vs 4-hour floor leaves 12h of slack so this almost
 *   always succeeds; the only exception is a floor larger than the
 *   entire track, which returns the full `[0, maxIdx]`).
 */
export function applyRailWindowMinFloor(
  window: SharedSlotWindow | null,
  minSpanSlots: number,
): SharedSlotWindow | null {
  if (window === null) return null
  if (!Number.isFinite(minSpanSlots) || minSpanSlots <= 0) return window

  const maxIdx = MAX_SLOT_INDEX
  const desiredSpan = Math.min(Math.trunc(minSpanSlots) - 1, maxIdx)

  const lo = clampSlot(window.loSlotIndex)
  const hi = clampSlot(window.hiSlotIndex)
  const normLo = Math.min(lo, hi)
  const normHi = Math.max(lo, hi)
  const currentSpan = normHi - normLo

  if (currentSpan >= desiredSpan) {
    return { loSlotIndex: normLo, hiSlotIndex: normHi }
  }

  const deficit = desiredSpan - currentSpan
  const expandLeft = Math.floor(deficit / 2)
  const expandRight = deficit - expandLeft

  let nextLo = normLo - expandLeft
  let nextHi = normHi + expandRight

  if (nextLo < 0) {
    nextHi += -nextLo
    nextLo = 0
  }
  if (nextHi > maxIdx) {
    nextLo -= nextHi - maxIdx
    nextHi = maxIdx
  }
  if (nextLo < 0) nextLo = 0

  return { loSlotIndex: nextLo, hiSlotIndex: nextHi }
}
