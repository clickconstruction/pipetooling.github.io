import { buildCourseModel, type CourseModel } from './courseModel'
import { buildVectorDayCells } from './vectorDays'
import type { VectorSession, VectorWage } from './vectors'

/**
 * The hours that still wait on approval, by day (v2.6965, punch list #303).
 *
 * The Bridge's headline reads recorded time: every closed session, the ones
 * waiting on approval too. The breakdown under it, *What is left after
 * overhead*, read the loader's day maps, which count approved hours only, so
 * the two disagreed whenever hours waited and the breakdown opened on a
 * warning.
 *
 * The page already holds every recorded session for the headline. This kernel
 * takes the part of them that waits and says what those hours earn and cost,
 * per work day, on the grid's own rule (`buildVectorDayCells`: the job's rate
 * per hour, the person's field wage, a salaried day at its flat cost), as the
 * difference between the recorded reading and the approved one. Added to the
 * loader's approved maps it gives the breakdown on recorded time with no
 * change to the loader, which is copied to the edge functions. When no hour
 * waits it adds nothing, so the breakdown reads exactly as it did.
 *
 * Field hours only: waiting office and bid hours earn nothing here and their
 * wages belong to overhead, which the breakdown reads at its 90-day rate. One
 * known edge: a salaried day whose approved hours are office and whose
 * waiting hours are field moves its flat day to the field here while the
 * overhead pool still holds it.
 *
 * Pure: no React, no Supabase.
 */

export type WaitingDays = {
  /** What the waiting field hours earn, at each job's rate, by work day. */
  earnedByDay: Map<string, number>
  /** What they cost in field wages, by work day. */
  laborByDay: Map<string, number>
  /** Waiting field hours in the range. */
  hours: number
}

const add = (m: Map<string, number>, ymd: string, usd: number): void => {
  if (usd !== 0) m.set(ymd, (m.get(ymd) ?? 0) + usd)
}

export function buildWaitingDays(input: {
  start: string
  end: string
  wages: ReadonlyArray<VectorWage>
  sessions: ReadonlyArray<VectorSession>
  ratePerHourByJob: ReadonlyMap<string, number>
}): WaitingDays {
  const common = { start: input.start, end: input.end, wages: input.wages, sessions: input.sessions, ratePerHourByJob: input.ratePerHourByJob }
  const recorded = buildVectorDayCells({ ...common, mode: 'recorded' })
  const approved = buildVectorDayCells({ ...common, mode: 'approved' })
  const earnedByDay = new Map<string, number>()
  const laborByDay = new Map<string, number>()
  let hours = 0
  for (const [userId, days] of recorded) {
    const was = approved.get(userId)
    for (const [ymd, cell] of days) {
      const a = was?.get(ymd)
      const h = cell.fieldHours - (a?.fieldHours ?? 0)
      if (h <= 0) continue
      hours += h
      add(earnedByDay, ymd, cell.earnedUsd - (a?.earnedUsd ?? 0))
      add(laborByDay, ymd, cell.laborUsd - (a?.laborUsd ?? 0))
    }
  }
  return { earnedByDay, laborByDay, hours }
}

/** Two day maps summed into a new one. */
export function addDayMaps(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): Map<string, number> {
  const out = new Map(a)
  for (const [ymd, usd] of b) add(out, ymd, usd)
  return out
}

export type RecordedReadingTotals = { earnedUsd: number; fieldLaborUsd: number; materialsUsd: number; subLaborUsd: number; overheadUsd: number }

export type RecordedReading = {
  earnedByDay: Map<string, number>
  directByDay: Map<string, number>
  speed: CourseModel['speed']
  contributionMargin: number | null
  totals: RecordedReadingTotals
}

/**
 * The breakdown's inputs on recorded time: the loader's approved day maps with
 * the waiting hours added, the trailing rates and the margin measured again on
 * them (`buildCourseModel`, the page's own settings), and the window's totals
 * with what the waiting hours earn and cost.
 */
export function buildRecordedReading(input: {
  todayYmd: string
  daysBack: number
  earnedByDay: ReadonlyMap<string, number>
  directByDay: ReadonlyMap<string, number>
  overheadByDay: ReadonlyMap<string, number>
  overheadPerDayBaseline: number
  totals: RecordedReadingTotals
  waiting: WaitingDays
}): RecordedReading {
  const earnedByDay = addDayMaps(input.earnedByDay, input.waiting.earnedByDay)
  const directByDay = addDayMaps(input.directByDay, input.waiting.laborByDay)
  const course = buildCourseModel({
    todayYmd: input.todayYmd,
    daysBack: input.daysBack,
    daysAhead: 1,
    earnedByDay,
    directByDay,
    overheadByDay: input.overheadByDay,
    targetUsd: null,
    overheadPerDayBaseline: input.overheadPerDayBaseline,
  })
  const sum = (m: ReadonlyMap<string, number>): number => [...m.values()].reduce((s, v) => s + v, 0)
  return {
    earnedByDay,
    directByDay,
    speed: course.speed,
    contributionMargin: course.contributionMargin,
    totals: { ...input.totals, earnedUsd: input.totals.earnedUsd + sum(input.waiting.earnedByDay), fieldLaborUsd: input.totals.fieldLaborUsd + sum(input.waiting.laborByDay) },
  }
}
