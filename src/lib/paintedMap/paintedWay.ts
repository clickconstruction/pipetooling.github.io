/**
 * Following a painted map (punch list #345, PR 4): what the shared page tells a reader about where
 * they are, once they ask. Pure. Since v2.7414 a reader who is not signed in gives a name first, and
 * the page says what the company keeps before it asks: the name, the device, and where they are once
 * they press Show where I am. The sample keeps nothing and sends nothing.
 */
import { haversineMeters } from '../jobTravelEstimate'
import { taskPlaceAccuracyWords, taskPlaceDirection, taskPlaceDistanceWords } from '../tasks/taskPlace'
import { nearestOnLine, type PaintedPoint } from './paintedLine'
import { paintedMapDeviceId, paintedMapVisitorName } from './paintedMapLink'
import { lineHowWords, type PaintedLine } from './paintedMap'

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
export function wayNearMap(me: PaintedPoint, points: ReadonlyArray<PaintedPoint>, withinM: number = WAY_FRAME_METERS): boolean {
  return points.some((p) => haversineMeters(me, p) <= withinM)
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

/** Under several lines whose lengths are about: said once, at the foot of the list. */
export const WAY_LENGTH_GUIDE_WORDS = 'A length here is a guide for how far, not a measurement.'

/**
 * The sentence under a line's length on the shared page (Taunya, 2026-11-15: how the line was made
 * and what its length is worth are one sentence, below the length).
 *
 * A map's only line says both. A measured length is a measurement, so its line says only how it
 * was made. Among several lines each says how, and the page says the guide once at the foot.
 *   'Drawn by hand, so the length is a guide for how far, not a measurement.'
 *   'Walked, a part drawn by hand.'
 */
export function wayLineUnderWords(line: Pick<PaintedLine, 'how' | 'fixedByHand'>, measured: boolean, alone: boolean): string {
  const how = lineHowWords(line)
  const lead = how.charAt(0).toUpperCase() + how.slice(1)
  return alone && !measured ? `${lead}, so the length is a guide for how far, not a measurement.` : `${lead}.`
}

/** Why the page could not show the reader's dot. The map and Directions never needed it. */
export function wayNoFixWords(why: 'none' | 'refused' | 'failed'): string {
  if (why === 'refused') return 'Location is off for this page. The map and Directions still work.'
  if (why === 'none') return 'This device gives no location. The map and Directions still work.'
  return 'Your phone could not find you. Try again in the open. The map and Directions still work.'
}

// ---------------------------------------------------------------------------------------------------
// Who is looking (v2.7414, Taunya's ask of 2026-11-15).

/** Where the page keeps this device's id and the name last given. Both stay until site data is cleared. */
export const WAY_DEVICE_KEY = 'pt.way.device'
export const WAY_NAME_KEY = 'pt.way.name'

type WayStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * This device's id: the one the page kept, or a new one from `make`, kept for next time. A browser
 * that keeps nothing (a private window, storage switched off) gets a new one each visit.
 */
export function wayDeviceId(store: WayStore | null, make: () => string): string {
  try {
    const kept = paintedMapDeviceId(store?.getItem(WAY_DEVICE_KEY))
    if (kept) return kept
  } catch {
    // Storage that throws is storage that keeps nothing.
  }
  const id = make()
  try {
    store?.setItem(WAY_DEVICE_KEY, id)
  } catch {
    // The id lasts this visit.
  }
  return id
}

/** The name this device gave before, so the same person is not asked twice. */
export function wayRememberedName(store: WayStore | null): string | null {
  try {
    return paintedMapVisitorName(store?.getItem(WAY_NAME_KEY))
  } catch {
    return null
  }
}

/** Keep the name for next time, or forget it (`null`: *Not you?*). */
export function rememberWayName(store: WayStore | null, name: string | null): void {
  try {
    if (name) store?.setItem(WAY_NAME_KEY, name)
    else store?.removeItem(WAY_NAME_KEY)
  } catch {
    // Nothing kept: the page asks again next time.
  }
}

/** The screen as the browser tells it: `390x844@3`. Empty when it tells nothing. */
export function wayScreenWords(width: unknown, height: unknown, ratio: unknown): string {
  if (typeof width !== 'number' || typeof height !== 'number' || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return ''
  const dpr = typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0 ? `@${Math.round(ratio * 100) / 100}` : ''
  return `${Math.round(width)}x${Math.round(height)}${dpr}`
}

/** The page sends where the reader is at once, then about once a minute while Show where I am is on. */
export const WAY_POINT_EVERY_MS = 60_000
export function wayPointIsDue(lastSentMs: number | null, nowMs: number): boolean {
  return lastSentMs == null || nowMs - lastSentMs >= WAY_POINT_EVERY_MS
}

export const WAY_NAME_WORDS = {
  head: 'Who is opening this map?',
  label: 'Your name',
  placeholder: 'First and last name',
  open: 'Open the map',
  opening: 'Opening…',
  change: 'Not you? Change the name',
} as const

const sender = (company: string | null | undefined): string => (company ?? '').trim() || 'The company that sent this map'

/** Said under the name box, before the reader presses anything: what is kept. */
export function wayKeptWords(company: string | null | undefined): string {
  return `${sender(company)} keeps your name, the phone or computer you are on, and when you open this map. If you press Show where I am, they also see where you are.`
}

/** Said under Show where I am before it is pressed. */
export function wayWillSeeWords(company: string | null | undefined): string {
  return `${sender(company)} will see where you are while this is on.`
}

/** Said in the box while Show where I am is on. */
export function wayIsSeenWords(company: string | null | undefined): string {
  return `${sender(company)} sees where you are while this is on. Press Hide where I am to stop. Keep this page open and the dot moves with you.`
}

/** `You opened this map as Dana Reyes.` */
export function wayOpenedAsWords(name: string): string {
  return `You opened this map as ${name}.`
}
