/**
 * Following a painted map (punch list #345, PR 4): what the shared page tells a reader about where
 * they are, once they ask. Pure. The reader's own position is worked on their phone and goes
 * nowhere: nothing here is sent or saved.
 */
import { haversineMeters } from '../jobTravelEstimate'
import { taskPlaceAccuracyWords, taskPlaceDirection, taskPlaceDistanceWords } from '../tasks/taskPlace'
import { nearestOnLine, type PaintedPoint } from './paintedLine'

/** Nearer the line than this, the reader is on it: about 80 ft, a phone's margin on a bad day. */
export const WAY_ON_LINE_METERS = 25
/** Nearer the start than this, the reader is at it. */
export const WAY_AT_START_METERS = 20

/** Nearer the map than this, the page frames the reader and the map together: about a mile and a quarter. */
export const WAY_FRAME_METERS = 2000

/**
 * Is the reader near enough for one picture to hold them and the map? Farther off, the picture
 * stays on the map and the words say how far the start is: a map zoomed out to hold a reader
 * across town shows neither the line nor where they stand.
 */
export function wayNearMap(me: PaintedPoint, points: ReadonlyArray<PaintedPoint>): boolean {
  return points.some((p) => haversineMeters(me, p) <= WAY_FRAME_METERS)
}

/** The reader's dot stays on their phone. Said under it, every time. */
export const WAY_PRIVACY_WORDS = 'Where you are stays on your phone. We never see it. Keep this page open and the dot moves with you.'

/**
 * Where the reader stands against the map: at the start, on the line, or how far and which way the
 * start is. `sure` is how sure their phone is, when it said.
 */
export function wayWords(me: PaintedPoint & { accuracyM?: number | null }, lines: ReadonlyArray<{ points: ReadonlyArray<PaintedPoint> }>, start: PaintedPoint | null): { lead: string; sure: string | null } {
  const sureWords = taskPlaceAccuracyWords(me.accuracyM)
  const sure = sureWords ? `Your phone is sure ${sureWords}.` : null
  if (start && haversineMeters(me, start) <= WAY_AT_START_METERS) return { lead: 'You are at the start.', sure }
  let nearest = Infinity
  for (const line of lines) {
    const hit = nearestOnLine(line.points, me)
    if (hit && hit.distanceM < nearest) nearest = hit.distanceM
  }
  if (nearest <= WAY_ON_LINE_METERS) return { lead: 'You are on the painted line.', sure }
  if (start) return { lead: `The start is ${taskPlaceDistanceWords(haversineMeters(me, start))} ${taskPlaceDirection(me, start)} of you.`, sure }
  return { lead: 'You are off the map’s line.', sure }
}

/** Why the page could not show the reader's dot. The map and Directions never needed it. */
export function wayNoFixWords(why: 'none' | 'refused' | 'failed'): string {
  if (why === 'refused') return 'Location is off for this page. The map and Directions still work.'
  if (why === 'none') return 'This device gives no location. The map and Directions still work.'
  return 'Your phone could not find you. Try again in the open. The map and Directions still work.'
}
