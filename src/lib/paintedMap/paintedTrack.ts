/**
 * A walk turned into a line (punch list #345). A phone that is followed hands back a reading a
 * second, each with its own margin, and they wobble: a person standing still draws a knot, and a
 * wall or a tree bends the signal. This file is the rules that turn those readings into a stroke a
 * person can look over before it is saved. Pure: no browser, no clock of its own, no network.
 *
 * The rules the screens lean on:
 * - A reading is kept only when the phone really moved: further than the wobble its own margin
 *   allows. That is what keeps a pause from drawing a scribble.
 * - A stretch the phone was not sure of is kept, marked, drawn faint and left out of the length. It
 *   is never dropped quietly and never drawn as if it were sure.
 * - A reading with a margin of half a mile is not a reading of where the person is. It means the
 *   phone was told to give only a rough location, and the person is told how to change that.
 * - The time on a reading is used here, on the phone, to tell a walk from a drive and to notice
 *   standing still. It is never saved: `cleanStroke` hands back points and nothing else.
 */
import { haversineMeters } from '../jobTravelEstimate'
import { isPaintedPoint, simplifyLine, type PaintedPart, type PaintedPoint } from './paintedLine'

/** One reading off the phone while painting. */
export type PaintedFix = PaintedPoint & {
  /** The phone's own margin in metres, or null when it gave none. */
  accuracyM: number | null
  /** When the reading was taken, in milliseconds. Used on the phone only. */
  atMs: number
}

/** Past this the phone is not sure enough to draw a line as read: about 65 ft. */
export const PAINT_POOR_FIX_METERS = 20
/** Past this the phone is giving a rough location, not a reading: Precise Location is off. */
export const PAINT_ROUGH_FIX_METERS = 1000
/** A step shorter than this is not a step: about 10 ft. */
export const PAINT_MIN_STEP_METERS = 3
/** Standing this long pauses the painting by itself. */
export const PAINT_STANDING_MS = 5 * 60_000
/** Painting this long ends by itself. */
export const PAINT_MAX_MS = 60 * 60_000
/** How far a sure stretch may be straightened: about 5 ft, under what a phone can tell apart. */
export const PAINT_SIMPLIFY_METERS = 1.5
/** A faint stretch is straightened harder, since its wobble is larger. */
export const PAINT_SIMPLIFY_POOR_METERS = 5
/** Faster than this, at the middle of the stroke, is a drive: about 10 mph. */
export const PAINT_DRIVEN_MPS = 4.5
/** What a hand can place on the view from above, at each end, with the magnifying glass: about 5 ft. */
export const PAINT_DRAWN_END_METERS = 1.5
/** What a phone is taken to be sure of when it did not say: its usual margin under open sky. */
export const PAINT_USUAL_FIX_METERS = 5

const hasMargin = (m: number | null | undefined): m is number => typeof m === 'number' && Number.isFinite(m) && m >= 0

/** The phone is giving a rough location: nothing can be painted from it. */
export function isRoughFix(accuracyM: number | null | undefined): boolean {
  return hasMargin(accuracyM) && accuracyM > PAINT_ROUGH_FIX_METERS
}

/** The phone is not sure enough to draw this stretch as read. No margin at all is not poor. */
export function isPoorFix(accuracyM: number | null | undefined): boolean {
  return hasMargin(accuracyM) && accuracyM > PAINT_POOR_FIX_METERS
}

/**
 * Has the phone really moved since the last reading that was kept? Two readings of a phone lying
 * on a tailgate differ by a few feet each second, and they drift around the true spot inside the
 * phone's own margin. So a step counts only when it is longer than the new reading's margin, and
 * never under 10 ft. The new reading's margin, not the old one's: a sure reading after an unsure
 * one is news and is taken at once, and an unsure reading has to be a long way off to be believed.
 * A person walking is kept every few seconds, which is all a line needs. The first reading always
 * counts.
 */
export function isRealStep(last: PaintedFix | null, fix: PaintedFix): boolean {
  if (!isPaintedPoint(fix) || isRoughFix(fix.accuracyM)) return false
  if (!last) return true
  const wobble = hasMargin(fix.accuracyM) ? fix.accuracyM : hasMargin(last.accuracyM) ? last.accuracyM : 0
  return haversineMeters(last, fix) >= Math.max(PAINT_MIN_STEP_METERS, wobble)
}

/** The readings worth keeping, in order: each one a real step on from the one before. */
export function keptFixes(fixes: ReadonlyArray<PaintedFix>): PaintedFix[] {
  const out: PaintedFix[] = []
  for (const f of fixes) {
    if (isRealStep(out[out.length - 1] ?? null, f)) out.push(f)
  }
  return out
}

export type CleanStroke = {
  /** The line, as pairs of numbers. */
  points: PaintedPoint[]
  /** The stretches the phone was not sure of, by index into `points`. */
  poorParts: PaintedPart[]
  /** The margin of the first and the last reading kept, for the give or take on the length. */
  startAccuracyM: number | null
  endAccuracyM: number | null
}

const samePoint = (a: PaintedPoint | undefined, b: PaintedPoint | undefined) => !!a && !!b && a.lat === b.lat && a.lng === b.lng

/**
 * A stroke made ready to look over: the real steps, straightened, with the unsure stretches
 * marked. A faint part reaches one sure point either side, because a leg with one unsure end is
 * unsure. Sure and unsure stretches are straightened apart, so a mark never slides onto a sure
 * leg.
 */
export function cleanStroke(fixes: ReadonlyArray<PaintedFix>): CleanStroke {
  const kept = keptFixes(fixes)
  const tagged = kept.map((f) => ({ p: { lat: f.lat, lng: f.lng } as PaintedPoint, poor: isPoorFix(f.accuracyM) }))
  const points: PaintedPoint[] = []
  const poorParts: PaintedPart[] = []
  let i = 0
  while (i < tagged.length) {
    let j = i
    while (j + 1 < tagged.length && tagged[j + 1]!.poor === tagged[i]!.poor) j++
    if (!tagged[i]!.poor) {
      const run = simplifyLine(tagged.slice(i, j + 1).map((t) => t.p), PAINT_SIMPLIFY_METERS)
      // A faint part before this run already ended on the run's first point.
      for (const [k, p] of run.entries()) if (!(k === 0 && samePoint(points[points.length - 1], p))) points.push(p)
    } else {
      const from = i > 0 ? i - 1 : i
      const to = j + 1 < tagged.length ? j + 1 : j
      const run = simplifyLine(tagged.slice(from, to + 1).map((t) => t.p), PAINT_SIMPLIFY_POOR_METERS)
      const start = i > 0 ? points.length - 1 : points.length
      for (const [k, p] of run.entries()) if (!(k === 0 && i > 0)) points.push(p)
      const end = points.length - 1
      if (end > start) poorParts.push([start, end])
    }
    i = j + 1
  }
  return {
    points,
    poorParts,
    startAccuracyM: kept[0]?.accuracyM ?? null,
    endAccuracyM: kept[kept.length - 1]?.accuracyM ?? null,
  }
}

/**
 * Walked or driven, from how fast the middle of the stroke went. The middle, not the mean: a truck
 * waits at a gate and a person stops to look, and neither should change the answer.
 */
export function strokeHow(fixes: ReadonlyArray<PaintedFix>): 'walked' | 'driven' {
  const kept = keptFixes(fixes)
  const speeds: number[] = []
  for (let i = 1; i < kept.length; i++) {
    const seconds = (kept[i]!.atMs - kept[i - 1]!.atMs) / 1000
    if (seconds > 0) speeds.push(haversineMeters(kept[i - 1]!, kept[i]!) / seconds)
  }
  if (speeds.length === 0) return 'walked'
  speeds.sort((a, b) => a - b)
  return speeds[Math.floor(speeds.length / 2)]! > PAINT_DRIVEN_MPS ? 'driven' : 'walked'
}

/**
 * The give or take on a length, in metres.
 *
 * A line drawn by hand is off by what a hand can place at each end. A line read from a phone is off
 * by the phone's margin at each end, widened by half again because a phone's margin is its
 * two-in-three claim and not a promise, plus two in a hundred of the length for the wobble that
 * straightening does not take out. Never under 10 ft for a line off a phone.
 */
export function strokeMarginMeters(input: {
  how: 'walked' | 'driven' | 'drawn'
  lengthM: number
  startAccuracyM?: number | null
  endAccuracyM?: number | null
}): number {
  if (input.how === 'drawn') return Math.hypot(PAINT_DRAWN_END_METERS, PAINT_DRAWN_END_METERS)
  const a = hasMargin(input.startAccuracyM) ? input.startAccuracyM : PAINT_USUAL_FIX_METERS
  const b = hasMargin(input.endAccuracyM) ? input.endAccuracyM : PAINT_USUAL_FIX_METERS
  return Math.max(3, Math.hypot(a, b) * 1.5 + Math.max(0, input.lengthM) * 0.02)
}

export type PaintingStop = 'go' | 'standing' | 'time'

/**
 * Should painting stop by itself? After an hour it ends, and after five minutes with no real step
 * it pauses. Nobody means to paint a lunch break, and a phone left painting on a dash is the one
 * way this tool could keep a trail nobody asked for.
 */
export function paintingStop(input: { startedAtMs: number; lastStepAtMs: number; nowMs: number }): PaintingStop {
  if (input.nowMs - input.startedAtMs >= PAINT_MAX_MS) return 'time'
  if (input.nowMs - input.lastStepAtMs >= PAINT_STANDING_MS) return 'standing'
  return 'go'
}

/** `2 minutes`, `45 seconds`, `1 hour`: how long a gap or a painting lasted, in words. */
export function spanWords(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.round(minutes / 60)
  return `${hours} hour${hours === 1 ? '' : 's'}`
}

/** `2:14`: the running clock on the bar. */
export function clockWords(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}
