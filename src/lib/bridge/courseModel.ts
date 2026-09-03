import { ymdAddDays } from '../../utils/dateUtils'

/**
 * Course model (v2.2677) — the chart at the center of the Bridge.
 *
 * Inputs are per-day dollar maps for the window behind today; the model
 * builds the cumulative net TRACK, measures SPEED (trailing rates), and
 * PROJECTS the same rates ahead, optionally bent by course-correction levers
 * and a destination target. Cumulative net = earned − direct − overhead.
 * Hazards are cash events and do NOT bend the net line; they are surfaced
 * beside it. One clock: calendar days.
 *
 * Pure: no React, no Supabase.
 */

export type CourseDay = { ymd: string; offset: number; earnedUsd: number; directUsd: number; overheadUsd: number; netUsd: number; cumulativeUsd: number }

export type CourseLever = {
  key: string
  label: string
  /** Extra earned $ per calendar day from `fromOffset` on. */
  ratePerDay?: number
  fromOffset?: number
  /** One-time net $ applied on `atOffset` (default 1). */
  onceUsd?: number
  atOffset?: number
}

export type CourseModel = {
  todayYmd: string
  track: CourseDay[]
  /** Trailing rates per calendar day (weekends included as what they are). */
  speed: { days: number; earnedPerDay: number; directPerDay: number; overheadPerDay: number; burnPerDay: number; climbPerDay: number }
  /** Contribution margin over the whole window: (earned − direct) ÷ earned; null when nothing earned. */
  contributionMargin: number | null
  projection: Array<{ ymd: string; offset: number; cumulativeUsd: number }>
  /** Cumulative net at the end of the projection. */
  endUsd: number
  /** Target cumulative net at the projection end (track end + targetUsd), or null when no target is set. */
  targetEndUsd: number | null
  verdict: { kind: 'makes' | 'misses' | 'no-target'; gapUsd: number | null; underwaterDays: number }
}

const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function buildCourseModel(input: {
  todayYmd: string
  daysBack: number
  daysAhead: number
  earnedByDay: ReadonlyMap<string, number>
  directByDay: ReadonlyMap<string, number>
  overheadByDay: ReadonlyMap<string, number>
  /** Trailing span for the speed readout and the projection rates. */
  speedDays?: number
  /** Net $ the owner wants to add over the projection span; null = no destination. */
  targetUsd: number | null
  levers?: ReadonlyArray<CourseLever>
}): CourseModel {
  const speedDays = Math.max(1, Math.floor(input.speedDays ?? 14))
  const track: CourseDay[] = []
  let cum = 0
  for (let o = -input.daysBack; o <= 0; o++) {
    const ymd = ymdAddDays(input.todayYmd, o)
    const earnedUsd = num(input.earnedByDay.get(ymd))
    const directUsd = num(input.directByDay.get(ymd))
    const overheadUsd = num(input.overheadByDay.get(ymd))
    const netUsd = earnedUsd - directUsd - overheadUsd
    cum += netUsd
    track.push({ ymd, offset: o, earnedUsd, directUsd, overheadUsd, netUsd, cumulativeUsd: cum })
  }
  const tail = track.slice(Math.max(0, track.length - speedDays))
  const avg = (pick: (d: CourseDay) => number) => (tail.length ? tail.reduce((s, d) => s + pick(d), 0) / tail.length : 0)
  const earnedPerDay = avg((d) => d.earnedUsd)
  const directPerDay = avg((d) => d.directUsd)
  const overheadPerDay = avg((d) => d.overheadUsd)
  const speed = { days: tail.length, earnedPerDay, directPerDay, overheadPerDay, burnPerDay: directPerDay + overheadPerDay, climbPerDay: earnedPerDay - directPerDay - overheadPerDay }
  const totalEarned = track.reduce((s, d) => s + d.earnedUsd, 0)
  const totalDirect = track.reduce((s, d) => s + d.directUsd, 0)
  const contributionMargin = totalEarned > 0 ? (totalEarned - totalDirect) / totalEarned : null

  const levers = input.levers ?? []
  const projection: CourseModel['projection'] = []
  let p = cum
  let underwaterDays = 0
  for (let o = 1; o <= input.daysAhead; o++) {
    let extra = 0
    for (const l of levers) {
      if (l.ratePerDay && o >= (l.fromOffset ?? 1)) extra += l.ratePerDay
      if (l.onceUsd && o === (l.atOffset ?? 1)) extra += l.onceUsd
    }
    p += speed.climbPerDay + extra
    if (p < 0) underwaterDays++
    projection.push({ ymd: ymdAddDays(input.todayYmd, o), offset: o, cumulativeUsd: p })
  }
  const endUsd = projection.length ? (projection[projection.length - 1] as { cumulativeUsd: number }).cumulativeUsd : cum
  const targetEndUsd = input.targetUsd == null ? null : cum + input.targetUsd
  const verdict: CourseModel['verdict'] =
    targetEndUsd == null
      ? { kind: 'no-target', gapUsd: null, underwaterDays }
      : endUsd >= targetEndUsd
        ? { kind: 'makes', gapUsd: endUsd - targetEndUsd, underwaterDays }
        : { kind: 'misses', gapUsd: endUsd - targetEndUsd, underwaterDays }
  return { todayYmd: input.todayYmd, track, speed, contributionMargin, projection, endUsd, targetEndUsd, verdict }
}

/** Sizes the "win this bid" lever: contract × contribution margin spread over `durationDays` from its start offset. */
export function bidWinLever(input: { key: string; label: string; bidValueUsd: number; contributionMargin: number | null; startOffset: number; durationDays?: number }): CourseLever | null {
  const m = input.contributionMargin
  if (m == null || !(input.bidValueUsd > 0)) return null
  const days = Math.max(1, Math.floor(input.durationDays ?? 60))
  return { key: input.key, label: input.label, ratePerDay: (input.bidValueUsd * m) / days, fromOffset: Math.max(1, input.startOffset) }
}
