/**
 * GC mode design spike: days lost, the Gantt's Phase 4 (`to-dos/gc-mode/GANTT_PLAN.md`). Two
 * readings of the same question, where did the time go:
 *
 * - **Weather days from the daily log** (G-58): a log that says work stopped for the weather, or
 *   that a trade was held by it, puts a lost day on every bar that trade had running that day. The
 *   walk shows them on the bar and offers them as the move, with the weather as the reason.
 * - **Days lost by cause** (G-96): the moves' reasons added up across the job, the customer's,
 *   the weather's, ours, a trade's, with what they did to the finish. The numbers a time
 *   extension ask is written from.
 *
 * Its own file, out of the barrel: it reads the daily log, the schedule and the moves.
 */
import type { DailyLog, GcProject, ScheduleMove, ScheduleMoveReason } from './gcTypes'
import { daysBetween } from './gcBuildingSchedule'
import { moveReasonLabel } from './gcScheduleMoves'
import { shortDate, weekdayDate } from './gcWords'

// ---------------------------------------------------------------------------------------------
// Weather days from the daily log (G-58)
// ---------------------------------------------------------------------------------------------

/** One day one activity lost to the weather, by the daily log. */
export interface LostDay {
  date: string
  lineId: string
  packageId: string
  /** The log's words for it. */
  note: string
}

/** The trades a day's log says the weather stopped: the ones named in a weather delay, and, when the whole site stopped, every crew logged that day. */
function tradesStopped(log: DailyLog): { packageIds: Set<string>; note: string } {
  const weather = log.delays.filter((d) => d.reason === 'weather')
  const siteWide = log.weatherStop || weather.some((d) => d.packageId === null)
  const ids = new Set(weather.flatMap((d) => (d.packageId ? [d.packageId] : [])))
  if (siteWide) for (const c of log.crews) if (c.workers > 0) ids.add(c.packageId)
  const notes = weather.map((d) => d.note.trim()).filter(Boolean)
  return { packageIds: ids, note: notes.length > 0 ? notes.join(' ') : log.weatherStop ? 'Work stopped for the weather.' : '' }
}

/** Every day an activity lost to the weather by the daily log, oldest first, in the order the chart draws the bars. */
export function weatherLostDays(project: GcProject): LostDay[] {
  const activities = (project.schedule?.activities ?? []).filter((a) => !a.inspection)
  const logs = [...(project.dailyLogs ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  const out: LostDay[] = []
  for (const log of logs) {
    const { packageIds, note } = tradesStopped(log)
    if (packageIds.size === 0) continue
    for (const a of activities) {
      if (!packageIds.has(a.packageId) || a.start > log.date || a.finish < log.date) continue
      out.push({ date: log.date, lineId: a.lineId, packageId: a.packageId, note })
    }
  }
  return out
}

/** The lost days by the bar they fell on. */
export function lostDaysByLine(project: GcProject): Map<string, LostDay[]> {
  const by = new Map<string, LostDay[]>()
  for (const d of weatherLostDays(project)) by.set(d.lineId, [...(by.get(d.lineId) ?? []), d])
  return by
}

function listWords(days: string[]): string {
  const names = days.map((d) => weekdayDate(d))
  return names.length === 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** "2 days lost to the weather by the daily log: Thu Sep 24 and Fri Sep 25." Null with none. */
export function lostDaysWords(days: LostDay[]): string | null {
  if (days.length === 0) return null
  return `${days.length} ${days.length === 1 ? 'day' : 'days'} lost to the weather by the daily log: ${listWords(days.map((d) => d.date))}.`
}

/**
 * The lost days on a bar that no move has answered yet: the ones after the last standing move on
 * it that gave the weather as its reason. They are what the walk offers to add to its finish.
 */
export function lostDaysUnanswered(project: GcProject, lineId: string): LostDay[] {
  const answered = (project.schedule?.moves ?? []).find((m) => m.lineId === lineId && m.reason === 'weather' && !m.undoneOn)
  return (lostDaysByLine(project).get(lineId) ?? []).filter((d) => !answered || d.date > answered.on)
}

/** The explanation the walk fills in when it adds the lost days: the dates and the log's words. */
export function lostDaysMoveNote(days: LostDay[]): string {
  const notes = [...new Set(days.map((d) => d.note).filter(Boolean))]
  return `The daily log has ${days.length} ${days.length === 1 ? 'day' : 'days'} lost to the weather on this work, ${listWords(days.map((d) => d.date))}.${notes.length > 0 ? ` ${notes.join(' ')}` : ''}`
}

// ---------------------------------------------------------------------------------------------
// Days lost by cause (G-96)
// ---------------------------------------------------------------------------------------------

/** Who a lost day is on, for a time extension ask. A pull's days given back (G-37) stand on their own line, never netted against a door. */
export type LostCause = 'customer' | 'weather' | 'us' | 'trade' | 'other' | 'early'

/** Each reason a move can give, laid at a door: the plans are the customer's side (their architect drew them). */
export const CAUSE_OF: Record<ScheduleMoveReason, LostCause> = {
  customer: 'customer',
  'change order': 'customer',
  plans: 'customer',
  weather: 'weather',
  us: 'us',
  'trade before': 'trade',
  materials: 'trade',
  crew: 'trade',
  inspection: 'trade',
  other: 'other',
  early: 'early',
}

export const CAUSE_WORDS: Record<LostCause, string> = { customer: "the customer's", weather: "the weather's", us: 'ours', trade: "a trade's", other: 'other', early: 'finished early' }
const CAUSE_ORDER: LostCause[] = ['customer', 'weather', 'trade', 'us', 'other', 'early']

export interface CauseRow {
  cause: LostCause
  /** "the customer's" */
  label: string
  /** Days the job's finish moved in these moves, net. Positive: later. */
  finishDays: number
  /** Days the moved work itself slipped, finish to finish, net. */
  workDays: number
  moves: number
  /** The reasons given, in the words offered: "a change order, the customer". */
  reasons: string[]
}

export interface DaysLost {
  rows: CauseRow[]
  /** Days the finish moved across every standing move, net. */
  finishDays: number
  workDays: number
  moves: number
  /** Days the daily log says were lost to the weather, whether or not a move answered them. */
  logWeatherDays: number
  /** "The finish moved 9 days in 4 moves: 5 the customer's (a change order, the customer), 2 the weather's, 2 a trade's." */
  words: string
}

function standing(project: GcProject): ScheduleMove[] {
  return (project.schedule?.moves ?? []).filter((m) => !m.undoneOn)
}

export function daysLostByCause(project: GcProject): DaysLost {
  const moves = standing(project)
  const by = new Map<LostCause, CauseRow>()
  for (const m of moves) {
    const cause = CAUSE_OF[m.reason]
    const row = by.get(cause) ?? { cause, label: CAUSE_WORDS[cause], finishDays: 0, workDays: 0, moves: 0, reasons: [] }
    row.finishDays += daysBetween(m.finishFrom, m.finishTo)
    row.workDays += daysBetween(m.from.finish, m.to.finish)
    row.moves += 1
    const reason = moveReasonLabel(m.reason).toLowerCase()
    if (!row.reasons.includes(reason)) row.reasons.push(reason)
    by.set(cause, row)
  }
  const rows = CAUSE_ORDER.flatMap((c) => (by.has(c) ? [by.get(c) as CauseRow] : [])).sort((a, b) => b.finishDays - a.finishDays || b.workDays - a.workDays)
  const finishDays = rows.reduce((s, r) => s + r.finishDays, 0)
  const workDays = rows.reduce((s, r) => s + r.workDays, 0)
  const logWeatherDays = new Set(weatherLostDays(project).map((d) => d.date)).size
  const n = (d: number) => `${Math.abs(d)} ${Math.abs(d) === 1 ? 'day' : 'days'}`
  const parts = rows
    .filter((r) => r.finishDays !== 0)
    .map((r) => (r.cause === 'early' ? `${n(r.finishDays)}${r.finishDays < 0 ? ' back' : ''} from work that finished early` : `${n(r.finishDays)}${r.finishDays < 0 ? ' back' : ''} ${r.label} (${r.reasons.join(', ')})`))
  let words =
    moves.length === 0
      ? 'No move has been made on the schedule.'
      : finishDays === 0
        ? `${moves.length === 1 ? '1 move' : `${moves.length} moves`}, and the finish holds.${rows.some((r) => r.workDays > 0) ? ` The work moved inside its spare days: ${rows.filter((r) => r.workDays !== 0).map((r) => `${n(r.workDays)} ${r.label}`).join(', ')}.` : ''}`
        : `The finish moved ${n(finishDays)} ${finishDays > 0 ? 'later' : 'sooner'} in ${moves.length === 1 ? '1 move' : `${moves.length} moves`}: ${parts.join(', ')}.`
  if (logWeatherDays > 0) words += ` The daily log shows ${n(logWeatherDays)} lost to the weather.`
  return { rows, finishDays, workDays, moves: moves.length, logWeatherDays, words }
}

/** A lost day on the chart: its day in a word, for the mark's title. */
export function lostDayTitle(d: LostDay): string {
  return `Lost to the weather ${weekdayDate(d.date)}${d.note ? `: ${d.note}` : ''} (${shortDate(d.date)}, by the daily log)`
}
