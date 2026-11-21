/**
 * The superintendent's line (punch list #242, PR 1; designed on the #234 spike and read
 * through with the owner): one reading per project that says, in the superintendent's
 * words, whether the job is ahead or behind at this pace — the work done against the
 * hours used, the planned finish against the finish at pace, the proof the number stands
 * on (the certified pay app, the checklist, the crew's own provisional percent) and the
 * one move when behind. The Projects board and the phone's card both read this one file,
 * so the office and the field read one number. The rules:
 *
 * - done percent against hours percent of the budget gives the days ahead or behind at the
 *   crew day; the crew day is the mean of the worked days when there are two or more, else
 *   `crewHoursPerDay` (24 h assumed: three people at eight hours);
 * - money leading the work by ten percentage points or more outranks the hours and reads *Money is ahead of the
 *   work.*, with both percents on the money line (the word *points* left the screens on 2026-11-20: nobody on a
 *   job or in the office says it); spend over three times the money budget reads *The money budget looks wrong.*
 *   instead of a verdict. The crew's own card reads hours, never money (`lib/jobMode/paceReading.ts`);
 * - a gap under a crew day still counts when it is a tenth of the hours budget or more (`PACE_SHARE_PTS`, the
 *   owner's word of 2026-11-20 after the walk): a small job 40% over its hours read *On pace.* because the gap
 *   was under one assumed 24 h crew day. Such a gap is said in hours, *6 hours behind.*, since it is no day;
 * - no percent yet, under 8 h in or no hours budget is too early to call;
 * - the proof line is the office's sign-off on the percent (the owner's first call of 2026-11-07:
 *   the office's sign-off is the certified percent, never a pay app), then the checklist count,
 *   then the crew's own percent, provisional until the office signs it; the move when behind is
 *   the open checklist, else *Set the %*;
 * - a stage a sub performs counts on the sub's sheet hours (the owner's third call), so the hours
 *   in are the team's clock hours plus the subs' sheet hours.
 *
 * Pure: the callers feed it from the job budget, the charge timeline and the checklists.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

export type SuperintendentLineInput = {
  /** The job's percent done, as set on the job; null when nobody has set one. */
  pctDone: number | null
  /** Team hours clocked on the job; null while not loaded. */
  hoursUsed: number | null
  /** The subs' sheet hours on the job (`people_labor_job_items`), counted into the hours in; null or omitted when none are known. */
  subHours?: number | null
  /** The hours budget the Costs tab stands on: the bid's hours, the typed hours, else the assumed line budgets' sum. */
  hoursBudget: number
  /** Where that budget came from — the same word the Costs strip wears, or the leader's open target. */
  budgetSource: 'bid' | 'typed' | 'book' | 'assumed' | 'target'
  /** The budget is the hours frozen at award, the number the score reads (the owner's call of 2026-11-09); the words say so. */
  budgetFrozen?: boolean
  /** When the budget is the leader's target: who set it, when, from what and why, so the card says so. */
  target?: { by: string; at: string; from: number | null; why: string } | null
  /** The money reading the Pipeline's burning card makes: direct spend against the direct-cost budget; null while not loaded. */
  money: { spentUsd: number; budgetUsd: number } | null
  /** The planned finish, `YYYY-MM-DD`, or null when no plan carries one yet. */
  plannedFinishYmd: string | null
  /** The stage checklists across the job: answered of asked. */
  checklist: { answered: number; asked: number }
  /** The office's sign-off on the percent — the newest percent an office role set — or null when none has. */
  certifiedPct: number | null
  /** The day of that sign-off, `YYYY-MM-DD`, when known. */
  certifiedOn?: string | null
  /** Crew hours one calendar day of work spends; 24 = three people at eight hours. Read from `laborDays` when those are given. */
  crewHoursPerDay?: number
  /** The job's own days of team labor: each work date with the hours clocked on it, so the pace reads in this job's crew days. */
  laborDays?: ReadonlyArray<{ ymd: string; hours: number }>
}

/** The job's days of team labor from its charge events: one entry per work date with the hours that landed on it. */
export function laborDaysOf(events: ReadonlyArray<{ source: string; dateKey: string | null; hours?: number }>): Array<{ ymd: string; hours: number }> {
  const byDay = new Map<string, number>()
  for (const e of events) {
    if (e.source !== 'team_labor' || !e.dateKey || !e.hours) continue
    byDay.set(e.dateKey, (byDay.get(e.dateKey) ?? 0) + e.hours)
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([ymd, hours]) => ({ ymd, hours }))
}

export type SuperintendentLine = {
  tone: 'ahead' | 'behind' | 'even' | 'early'
  headline: string
  donePct: number
  hoursPct: number
  /** Days ahead (positive) or behind (negative) at this pace. Zero for a gap that is real but under a crew day. */
  days: number
  /** Whole hours ahead (positive) or behind (negative) of the work done; zero while too early to call. */
  hoursAhead: number
  finishWords: string
  proofWords: string
  hoursWords: string
  /** The target's line when the leader set one, else null. */
  targetLine: string | null
  /** The job's crew day: hours one day of work spends here, and whether it was read from the job or assumed. */
  hoursPerDay: number
  hoursPerDayRead: boolean
  /** Crew days used so far, and left at this pace against the budget (null before a pace exists). */
  daysUsed: number | null
  daysLeft: number | null
  /** The money line, the burning card's own reading, red when spend leads the work by ten points. */
  money: { words: string; leads: boolean; spentPct: number; wrong: boolean } | null
  /** The one move when behind, else null. */
  move: { kind: 'set-pct' | 'open-checklist'; why: string } | null
}

export const BUDGET_SOURCE_WORDS: Record<SuperintendentLineInput['budgetSource'], string> = { bid: '◆ from the bid', typed: '✎ typed by the office', book: '≈ assumed from the book', assumed: '≈ assumed', target: '🎯 expected' }

/** The target's own line on the card: who moved the number, from what, and why. The day is the company's calendar day. */
export function targetWords(t: NonNullable<SuperintendentLineInput['target']>, hours: number): string {
  const day = dayWords(calendarYmdInAppTzFromIso(t.at))
  return `Expected ${Math.round(hours)} h, set by ${t.by || 'the office'} on ${day}${t.from != null ? ` (was ${Math.round(t.from)} h)` : ''}: ${t.why}`
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** A civil date as *Nov 1*: the string is already a day, so no zone moves it. */
export function dayWords(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** A gap this many percentage points of the hours budget, or more, is ahead or behind even when it is under a crew day. */
export const PACE_SHARE_PTS = 10

/**
 * Ahead, behind or even on hours, the one rule the office's line and the crew's card both read. A crew day or
 * more either way decides it, as it always did. Under a crew day, a gap of a tenth of the budget or more decides
 * it too, so a small job cannot hide a large share of its hours inside one assumed crew day.
 */
export function hoursVerdict(a: { donePct: number; hoursPct: number; hoursBudget: number; crewDay: number }): { days: number; side: -1 | 0 | 1; hoursAhead: number } {
  const hoursAhead = ((a.donePct - a.hoursPct) / 100) * a.hoursBudget
  // `|| 0`: a quarter day behind rounds to minus zero, and a day count must be a plain 0.
  const days = a.crewDay > 0 ? Math.round(hoursAhead / a.crewDay) || 0 : 0
  const pts = a.donePct - a.hoursPct
  const side = days >= 1 ? 1 : days <= -1 ? -1 : pts >= PACE_SHARE_PTS ? 1 : pts <= -PACE_SHARE_PTS ? -1 : 0
  return { days, side, hoursAhead }
}

const hoursWordsOf = (n: number): string => `${Math.round(n)} hour${Math.round(n) === 1 ? '' : 's'}`

/** The short words for a strip's chip or the Dashboard's worst line: *+2 d*, *-3 d*, or hours when the gap is under a crew day. */
export function paceGapShort(line: Pick<SuperintendentLine, 'days' | 'hoursAhead'>): string {
  if (line.days !== 0) return `${line.days > 0 ? '+' : ''}${line.days} d`
  return `${line.hoursAhead > 0 ? '+' : line.hoursAhead < 0 ? '-' : ''}${Math.abs(line.hoursAhead)} h`
}

export function superintendentLine(i: SuperintendentLineInput): SuperintendentLine {
  // The job's own crew day where it has worked days; the assumption otherwise.
  const workedDays = (i.laborDays ?? []).filter((d) => d.hours > 0)
  const hoursPerDayRead = workedDays.length >= 2
  const crewDay = hoursPerDayRead ? workedDays.reduce((s, d) => s + d.hours, 0) / workedDays.length : i.crewHoursPerDay ?? 24
  const donePct = clamp(i.pctDone ?? 0)
  // The hours in: the team's clock hours and the subs' sheet hours, the score's own rule (the owner's third call).
  const subHours = Math.max(0, i.subHours ?? 0)
  const used = i.hoursUsed != null ? i.hoursUsed + subHours : subHours > 0 ? subHours : null
  // Not capped at the budget's edge: a job 242 h past its budget is that far behind, never "on pace".
  const hoursPct = i.hoursBudget > 0 && used != null ? Math.max(0, (used / i.hoursBudget) * 100) : 0
  const subWords = subHours > 0 ? (i.hoursUsed != null && i.hoursUsed > 0 ? ` (${Math.round(subHours)} h on sub sheets)` : ', all on sub sheets') : ''
  const frozenWords = i.budgetFrozen && i.budgetSource !== 'target' ? ', frozen at award' : ''
  const hoursWords = i.hoursBudget > 0 ? `${Math.round(i.hoursBudget)} h budget ${BUDGET_SOURCE_WORDS[i.budgetSource]}${frozenWords} · ${used != null ? Math.round(used) : '—'} h in${subWords}` : 'no hours budget yet'
  const early = i.pctDone == null || used == null || used < 8 || i.hoursBudget <= 0
  // Hours saved or lost against the work done, read in crew days, and as a share of the budget when under a day.
  const verdict = early ? { days: 0, side: 0 as const, hoursAhead: 0 } : hoursVerdict({ donePct, hoursPct, hoursBudget: i.hoursBudget, crewDay })
  const daysByHours = verdict.days
  // The money reading, the same one the Pipeline's burning card makes; it outranks the hours when spend leads the work.
  const spentPct = i.money && i.money.budgetUsd > 0 ? (i.money.spentUsd / i.money.budgetUsd) * 100 : null
  const leadPts = spentPct != null && i.pctDone != null ? spentPct - donePct : null
  // A budget the spend has passed three times over is a wrong budget, not a 2,000-point lead: say that instead.
  const budgetWrong = spentPct != null && spentPct > 300
  const moneyLeads = !budgetWrong && leadPts != null && leadPts >= 10
  const money: SuperintendentLine['money'] = budgetWrong
    ? { words: `Spent is ${Math.round(spentPct! / 100)}× the money budget; the budget looks wrong, not the crew.`, leads: true, spentPct: spentPct!, wrong: true }
    : spentPct != null
      ? { words: `${Math.round(spentPct)}% of the money spent at ${Math.round(donePct)}% done`, leads: moneyLeads, spentPct, wrong: false }
      : null
  const days = moneyLeads && daysByHours > 0 ? 0 : daysByHours
  const tone: SuperintendentLine['tone'] = early ? 'early' : budgetWrong || moneyLeads ? 'behind' : verdict.side > 0 ? 'ahead' : verdict.side < 0 ? 'behind' : 'even'
  const hoursAhead = Math.round(verdict.hoursAhead)
  const headline =
    tone === 'early'
      ? i.pctDone == null
        ? 'No percent set yet.'
        : 'Too early to call.'
      : budgetWrong
        ? 'The money budget looks wrong.'
        : moneyLeads
        ? 'Money is ahead of the work.'
        : tone === 'ahead'
          ? days >= 1
            ? `${days} day${days === 1 ? '' : 's'} ahead at this pace.`
            : `${hoursWordsOf(verdict.hoursAhead)} ahead at this pace.`
          : tone === 'behind'
            ? days <= -1
              ? `${-days} day${days === -1 ? '' : 's'} behind.`
              : `${hoursWordsOf(-verdict.hoursAhead)} behind.`
            : 'On pace.'
  const finishWords = i.plannedFinishYmd
    ? tone === 'early'
      ? `Planned finish ${dayWords(i.plannedFinishYmd)}.`
      : `Planned finish ${dayWords(i.plannedFinishYmd)}. At this pace, ${dayWords(addDays(i.plannedFinishYmd, -days))}.`
    : 'No planned finish on the job yet.'
  // The proof: the office's sign-off is the certified percent (the owner's first call); the crew's own figure is
  // provisional until the office signs it, and is the signed-off figure once it has.
  const signed = i.certifiedPct != null && i.pctDone != null && Math.round(i.certifiedPct) === Math.round(i.pctDone)
  const proof = [
    i.certifiedPct != null ? `Signed off by the office at ${Math.round(i.certifiedPct)}%${i.certifiedOn ? ` on ${dayWords(i.certifiedOn)}` : ''}` : 'No office sign-off on the percent yet',
    i.checklist.asked > 0 ? `checklist ${i.checklist.answered} of ${i.checklist.asked} ready` : 'no checklist on the stages yet',
    i.pctDone != null ? (signed ? `the crew's ${Math.round(i.pctDone)}% is the signed-off figure` : `the crew's ${Math.round(i.pctDone)}% reads provisional until the office signs it off`) : 'set the percent to read a pace',
  ]
  const proofWords = `${proof.join(' · ')}.`
  const move: SuperintendentLine['move'] =
    tone === 'behind'
      ? i.checklist.asked > 0 && i.checklist.answered < i.checklist.asked
        ? { kind: 'open-checklist', why: `${Math.round(used ?? 0)} h in at ${Math.round(donePct)}% done; ${i.checklist.asked - i.checklist.answered} checks still open.` }
        : { kind: 'set-pct', why: `${Math.round(used ?? 0)} h in and the percent reads ${Math.round(donePct)}%. If the work moved, set it.` }
      : tone === 'early' && i.pctDone == null
        ? { kind: 'set-pct', why: 'The line needs a percent to read a pace.' }
        : null
  const targetLine = i.budgetSource === 'target' && i.target ? targetWords(i.target, i.hoursBudget) : null
  const daysUsed = used != null && crewDay > 0 ? used / crewDay : null
  const daysLeft = used != null && crewDay > 0 && i.hoursBudget > 0 ? Math.max(0, i.hoursBudget - used) / crewDay : null
  return { tone, headline, donePct, hoursPct, days, hoursAhead, finishWords, proofWords, hoursWords, targetLine, hoursPerDay: crewDay, hoursPerDayRead, daysUsed, daysLeft, money, move }
}
