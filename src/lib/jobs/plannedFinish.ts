import { addBusinessDays } from '../moneyInWeek'

/**
 * The planned finish (punch list #234, PR 2). Beside its hours baseline, a project leaves award with a
 * planned start and finish, frozen like the hours, so the superintendent's line reads days against a
 * plan and not only hours against a budget. Three sources, tried in order:
 *
 *   ◆ rough    the GC project's rough schedule, its weeks kept when the bid went in or at award
 *   ≈ assumed  the start the bid assumed (else the day of the award) and the baseline hours at the
 *              crew day, in working days — a guess, read as one
 *   ✎ typed    a day the office knows
 *
 * Pure; the award block and the Costs strip read it, `set_job_planned_finish` writes it.
 */
export type PlannedFinishSource = 'rough' | 'assumed' | 'typed'

export const PLANNED_FINISH_GLYPH: Record<PlannedFinishSource, string> = { rough: '◆', assumed: '≈', typed: '✎' }

/** The crew day the assumed plan counts in when the job has no days of its own yet: three people at eight hours. */
export const PLANNED_CREW_HOURS_PER_DAY = 24

/** The rough schedule as the plan reads it: the kept finish and weeks, and when they were kept. */
export type RoughForPlan = { start: string; finish: string; weeks: number; keptAt: 'bid' | 'award'; keptOn: string }

export type PlannedFinishInput = {
  rough: RoughForPlan | null
  /** The start the bid assumed (`bids.estimated_job_start_date`), else null. */
  bidStartYmd: string | null
  /** Today, the award day, when the bid assumed no start. */
  todayYmd: string
  /** The hours baseline the award picked; null when none is usable. */
  hours: number | null
  crewHoursPerDay?: number
  /** What was typed in the finish box; null = nothing. */
  typedFinishYmd: string | null
}

export type PlannedFinishOption = {
  source: PlannedFinishSource
  glyph: string
  startYmd: string | null
  finishYmd: string | null
  usable: boolean
  head: string
  why: string
}

const dayWords = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const isYmd = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

/** The working days a baseline takes at the crew day: 480 h at 24 h a day is 20 days. At least one. */
export function workingDaysFor(hours: number, crewHoursPerDay = PLANNED_CREW_HOURS_PER_DAY): number {
  if (!(hours > 0) || !(crewHoursPerDay > 0)) return 0
  return Math.max(1, Math.ceil(hours / crewHoursPerDay))
}

/** The finish `days` working days after the start, the start counting as day one. */
export function finishAfterWorkingDays(startYmd: string, days: number): string {
  return days <= 1 ? startYmd : addBusinessDays(startYmd, days - 1)
}

export function plannedFinishOptions(i: PlannedFinishInput): PlannedFinishOption[] {
  const rough: PlannedFinishOption = i.rough
    ? { source: 'rough', glyph: '◆', startYmd: i.rough.start, finishYmd: i.rough.finish, usable: true, head: `${dayWords(i.rough.finish)} · from the rough schedule`, why: `${i.rough.weeks} week${i.rough.weeks === 1 ? '' : 's'} from ${dayWords(i.rough.start)}, kept ${i.rough.keptAt === 'bid' ? 'when the bid went in' : 'at award'} on ${dayWords(i.rough.keptOn)}. The GC's own plan. This is the one the days read against.` }
    : { source: 'rough', glyph: '◆', startYmd: null, finishYmd: null, usable: false, head: 'From the rough schedule', why: 'No GC project with a kept rough schedule behind this job.' }

  const start = isYmd(i.bidStartYmd) ? i.bidStartYmd : i.todayYmd
  const crew = i.crewHoursPerDay ?? PLANNED_CREW_HOURS_PER_DAY
  const days = i.hours != null ? workingDaysFor(i.hours, crew) : 0
  const assumed: PlannedFinishOption =
    days > 0
      ? { source: 'assumed', glyph: '≈', startYmd: start, finishYmd: finishAfterWorkingDays(start, days), usable: true, head: `${dayWords(finishAfterWorkingDays(start, days))} · assumed from the hours`, why: `${Math.round(i.hours!)} h at ${crew} crew hours a day is ${days} working day${days === 1 ? '' : 's'} from ${dayWords(start)}${isYmd(i.bidStartYmd) ? ', the start the bid assumed' : ', the day of the award'}. A guess, read as one.` }
      : { source: 'assumed', glyph: '≈', startYmd: null, finishYmd: null, usable: false, head: 'Assumed from the hours', why: 'Needs an hours baseline to count the days from.' }

  const typed: PlannedFinishOption = isYmd(i.typedFinishYmd)
    ? { source: 'typed', glyph: '✎', startYmd: start, finishYmd: i.typedFinishYmd, usable: true, head: `${dayWords(i.typedFinishYmd)} · typed`, why: 'A day you know, with your name on it.' }
    : { source: 'typed', glyph: '✎', startYmd: null, finishYmd: null, usable: false, head: 'Typed', why: 'A day you know, with your name on it.' }
  return [rough, assumed, typed]
}

export function plannedFinishPick(options: readonly PlannedFinishOption[]): PlannedFinishSource {
  return options.find((o) => o.usable)?.source ?? 'typed'
}

/** "Planned finish Nov 14 from the rough schedule" / "Planned finish Dec 2, assumed" / "no planned finish yet". */
export function plannedFinishPressWords(options: readonly PlannedFinishOption[], pick: PlannedFinishSource): string {
  const o = options.find((x) => x.source === pick)
  if (!o || !o.usable || !o.finishYmd) return 'no planned finish yet'
  return `planned finish ${dayWords(o.finishYmd)}${pick === 'rough' ? ' from the rough schedule' : pick === 'assumed' ? ', assumed' : ', typed'}`
}

/** The `p_planned` the award carries; null when the pick cannot be written. */
export function plannedFinishPayload(i: PlannedFinishInput, options: readonly PlannedFinishOption[], pick: PlannedFinishSource): { source: PlannedFinishSource; start: string | null; finish: string; detail: Record<string, unknown> } | null {
  const o = options.find((x) => x.source === pick)
  if (!o || !o.usable || !o.finishYmd) return null
  const detail: Record<string, unknown> =
    pick === 'rough' && i.rough
      ? { weeks: i.rough.weeks, kept_at: i.rough.keptAt, kept_on: i.rough.keptOn }
      : pick === 'assumed'
        ? { hours: i.hours, crew_hours_per_day: i.crewHoursPerDay ?? PLANNED_CREW_HOURS_PER_DAY, working_days: i.hours != null ? workingDaysFor(i.hours, i.crewHoursPerDay) : 0, start_from: isYmd(i.bidStartYmd) ? 'bid' : 'award' }
        : {}
  return { source: pick, start: o.startYmd, finish: o.finishYmd, detail }
}

/* ---------- the columns ---------- */

export type JobPlannedColumns = {
  planned_start?: string | null
  planned_finish?: string | null
  planned_source?: string | null
  planned_detail?: unknown
  planned_set_at?: string | null
  planned_set_by?: string | null
}

export type JobPlanned = { startYmd: string | null; finishYmd: string; source: PlannedFinishSource; setAt: string | null; setBy: string | null; detail: Record<string, unknown> }

const isSource = (s: unknown): s is PlannedFinishSource => s === 'rough' || s === 'assumed' || s === 'typed'

/** The plan on a row, or null when none was written. */
export function jobPlannedOf(row: JobPlannedColumns | null | undefined): JobPlanned | null {
  if (!row || !isYmd(row.planned_finish) || !isSource(row.planned_source)) return null
  return { startYmd: isYmd(row.planned_start) ? row.planned_start : null, finishYmd: row.planned_finish, source: row.planned_source, setAt: row.planned_set_at ?? null, setBy: row.planned_set_by ?? null, detail: row.planned_detail && typeof row.planned_detail === 'object' ? (row.planned_detail as Record<string, unknown>) : {} }
}

/** The strip's words for a frozen plan: "planned finish Nov 14 from the rough schedule (9 weeks kept at bid)". */
export function jobPlannedWords(p: JobPlanned): string {
  const tail = p.source === 'rough' ? ` from the rough schedule${typeof p.detail.weeks === 'number' ? ` (${p.detail.weeks} weeks kept ${p.detail.kept_at === 'bid' ? 'at bid' : 'at award'})` : ''}` : p.source === 'assumed' ? `, assumed${typeof p.detail.working_days === 'number' ? ` (${p.detail.working_days} working days at ${p.detail.crew_hours_per_day ?? PLANNED_CREW_HOURS_PER_DAY} h a day)` : ''}` : ', typed'
  return `planned finish ${dayWords(p.finishYmd)}${tail}`
}
