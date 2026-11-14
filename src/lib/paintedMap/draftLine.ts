/**
 * A line while it is being drawn by hand (punch list #345): its corners, the one a finger has
 * picked, and every step back. Pure: a state and the moves on it, so Undo is a list and nothing a
 * screen has to remember.
 *
 * - A press on the map adds a corner at the end.
 * - A drag moves a corner, and a drag from the middle of a leg makes a new corner there.
 * - Undo takes back the last of those, one at a time, as far as the empty map.
 */
import { haversineMeters } from '../jobTravelEstimate'
import { isPaintedPoint, lineLengthMeters, type PaintedPoint } from './paintedLine'

export type DraftLine = {
  points: PaintedPoint[]
  /** The corner the finger last touched, by index, or null. */
  picked: number | null
  /** What the corners were before each move, newest last. */
  past: PaintedPoint[][]
}

/** How many steps back are kept. A line is drawn in tens of presses, not thousands. */
export const DRAFT_LINE_UNDO_MAX = 200

export function emptyDraftLine(points: ReadonlyArray<PaintedPoint> = []): DraftLine {
  return { points: points.filter(isPaintedPoint).map((p) => ({ lat: p.lat, lng: p.lng })), picked: null, past: [] }
}

const step = (draft: DraftLine, points: PaintedPoint[], picked: number | null): DraftLine => ({
  points,
  picked,
  past: [...draft.past, draft.points].slice(-DRAFT_LINE_UNDO_MAX),
})

/** A new corner at the end of the line. */
export function addCorner(draft: DraftLine, p: PaintedPoint): DraftLine {
  if (!isPaintedPoint(p)) return draft
  return step(draft, [...draft.points, { lat: p.lat, lng: p.lng }], draft.points.length)
}

/** A corner moved to where the finger let go. */
export function moveCorner(draft: DraftLine, index: number, p: PaintedPoint): DraftLine {
  if (!isPaintedPoint(p) || index < 0 || index >= draft.points.length) return draft
  const points = draft.points.slice()
  points[index] = { lat: p.lat, lng: p.lng }
  return step(draft, points, index)
}

/** A new corner on the leg after corner `afterIndex`: what dragging the middle of a leg makes. */
export function insertCorner(draft: DraftLine, afterIndex: number, p: PaintedPoint): DraftLine {
  if (!isPaintedPoint(p) || afterIndex < 0 || afterIndex >= draft.points.length - 1) return draft
  const points = [...draft.points.slice(0, afterIndex + 1), { lat: p.lat, lng: p.lng }, ...draft.points.slice(afterIndex + 1)]
  return step(draft, points, afterIndex + 1)
}

/** A corner taken out. */
export function removeCorner(draft: DraftLine, index: number): DraftLine {
  if (index < 0 || index >= draft.points.length) return draft
  return step(draft, draft.points.filter((_, i) => i !== index), null)
}

/** The corner a finger touched, or none. Picking is not a move, so Undo does not step over it. */
export function pickCorner(draft: DraftLine, index: number | null): DraftLine {
  const picked = index != null && index >= 0 && index < draft.points.length ? index : null
  return picked === draft.picked ? draft : { ...draft, picked }
}

/** One step back. */
export function undoDraftLine(draft: DraftLine): DraftLine {
  const before = draft.past[draft.past.length - 1]
  if (!before) return draft
  return { points: before, picked: null, past: draft.past.slice(0, -1) }
}

export const canUndoDraftLine = (draft: DraftLine): boolean => draft.past.length > 0
/** A line is two corners or more. */
export const canSaveDraftLine = (draft: DraftLine): boolean => draft.points.length >= 2

/** The middle of each leg, where a drag makes a new corner. Leg `i` runs from corner `i` to corner `i + 1`. */
export function legMiddles(points: ReadonlyArray<PaintedPoint>): PaintedPoint[] {
  const out: PaintedPoint[] = []
  for (let i = 0; i < points.length - 1; i++) {
    out.push({ lat: (points[i]!.lat + points[i + 1]!.lat) / 2, lng: (points[i]!.lng + points[i + 1]!.lng) / 2 })
  }
  return out
}

/** The two legs that meet at a corner, in metres: the one back toward the start and the one on. Null where there is none. */
export function legsAtCorner(points: ReadonlyArray<PaintedPoint>, index: number): { backM: number | null; onM: number | null } {
  const here = points[index]
  if (!here) return { backM: null, onM: null }
  const before = points[index - 1]
  const after = points[index + 1]
  return { backM: before ? haversineMeters(before, here) : null, onM: after ? haversineMeters(here, after) : null }
}

/** The draft's length in metres. */
export const draftLengthMeters = (draft: DraftLine): number => lineLengthMeters(draft.points)
