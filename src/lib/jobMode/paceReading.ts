import { val } from '../valuesInPlace'
import { paceDayWords } from './paceCard'

/**
 * Job pace, the crew's reading (the owner's walk of 2026-11-20). The pace card's headline said *Spending 22
 * points ahead of the work.* A point is a percentage point of the money spent over the percent of work done,
 * a word nobody on a job site uses, and the number matched nothing the card drew. The owner asked for a card
 * that says what it compares and why.
 *
 * This file is what the card's face says in its place, worked out from the same pace the office's Projects
 * board reads. The rules:
 *
 * - the card compares two things, **Hours used** and **Work done**, on one scale. The gap between them is said
 *   in hours, the crew's own unit;
 * - ahead or behind is the line's own sum, the gap in the job's crew days, a day or more either way. Money is
 *   left out: a superintendent's read carries no dollar, and materials are bought before the work they are for.
 *   Money that leads is one calm line and the office's to watch;
 * - a gap asks before it warns. When hours have gone in since the percent was last set, the likely cause is an
 *   old percent, so the card is amber and asks *Is 40% still right?* It is red only on a percent said since;
 * - no percent, no hours budget and under 8 hours each say which one it is and whose move it is.
 *
 * Pure: numbers and days in, words and bar lengths out. Each value in a sentence is marked with `val`, so the
 * card draws it apart from the words.
 */

export type PaceReadingState = 'no-percent' | 'no-budget' | 'early' | 'old' | 'over' | 'track' | 'under'
export type PaceReadingTone = 'red' | 'amber' | 'green' | 'calm'

export type PaceReadingBars = {
  /** Hours used as a percent of the budget, whole, not stopped at 100. */
  hoursPct: number
  workPct: number
  /** The solid part of the hours bar, 0 to 100: the hours the work done accounts for. */
  hoursFill: number
  /** The hatched part of the hours bar: where it starts and how wide, 0 to 100. Zero wide with no gap. */
  gapFrom: number
  gapWidth: number
  /** Under the hours bar: *104 of 160 hours*. */
  hoursWords: string
  /** Under the work bar: *set yesterday*. Empty when no day is known. */
  workWords: string
  /** The work bar is drawn broken: the percent is older than the hours. */
  workOld: boolean
}

export type PaceReading = {
  state: PaceReadingState
  tone: PaceReadingTone
  headline: string
  bars: PaceReadingBars | null
  /** The sentences under the bars, in order. Values are marked. */
  lines: string[]
  /** The question over the loud **Set the %**, or null when the card has no loud press. */
  setPctAsk: string | null
  /** **Still 40%**: the percent to say again today, or null when the card does not ask. */
  stillPct: number | null
  /** Said over **My finish date** when the gap is real. */
  finishAsk: string | null
  /** The hours left in the budget, or null when none are left or no budget exists. */
  leftLine: string | null
  /** The money, when it leads or its budget is wrong: one calm line, never the headline. */
  moneyLine: string | null
}

export type PaceReadingInput = {
  /** The job's percent done, or null when nobody has set one. */
  pctDone: number | null
  /** Team hours clocked on the job; null while not read. */
  hoursUsed: number | null
  /** The subs' sheet hours, counted into the hours used as the line counts them. */
  subHours?: number | null
  hoursBudget: number
  /** The job's crew day in hours, the line's own figure. */
  crewHoursPerDay: number
  /** Every dated percent on the job: the reports and the percents set by hand. */
  values: ReadonlyArray<{ ymd: string; pct: number }>
  /** Each worked day with its hours. */
  laborDays: ReadonlyArray<{ ymd: string; hours: number }>
  todayYmd: string
  /** The line's money reading: whether it leads the work, and whether its budget looks wrong. */
  money?: { leads: boolean; wrong: boolean } | null
  /** The percent was said again in this sitting, before the read came back with it. */
  saidToday?: boolean
}

/** Hours gone in since the percent was set that make it old: one person's day. */
export const PACE_OLD_HOURS = 8
/** Under this many hours the card does not call a pace, the line's own floor. */
export const PACE_EARLY_HOURS = 8

const clamp = (n: number) => Math.max(0, Math.min(100, n))

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T12:00:00Z`)
  const b = Date.parse(`${toYmd}T12:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) : 0
}

const hoursOf = (n: number): string => `${Math.round(n)} hour${Math.round(n) === 1 ? '' : 's'}`
const daysOf = (n: number): string => `${n} day${n === 1 ? '' : 's'}`

/** When the percent was last said, for under the work bar: *set today*, *set yesterday*, *set 28 days ago*. */
export function paceSetWords(lastYmd: string | null, todayYmd: string): string {
  if (!lastYmd) return ''
  const n = daysBetween(lastYmd, todayYmd)
  if (n <= 0) return PACE_READING_WORDS.setToday
  if (n === 1) return PACE_READING_WORDS.setYesterday
  return PACE_READING_WORDS.setDaysAgo(n)
}

export function paceReading(i: PaceReadingInput): PaceReading {
  const W = PACE_READING_WORDS
  const sub = Math.max(0, i.subHours ?? 0)
  const used = i.hoursUsed != null ? i.hoursUsed + sub : sub > 0 ? sub : null
  const moneyLine = i.money?.wrong ? W.moneyWrong : i.money?.leads ? W.moneyLeads : null
  const left = i.hoursBudget > 0 && used != null ? i.hoursBudget - used : null
  const leftDays = left != null && i.crewHoursPerDay > 0 ? Math.round(left / i.crewHoursPerDay) : 0
  const leftLine = left != null && Math.round(left) > 0 ? (leftDays >= 1 ? W.left(hoursOf(left), daysOf(leftDays)) : W.leftShort(hoursOf(left))) : null
  const quiet = { bars: null, setPctAsk: null, stillPct: null, finishAsk: null }

  if (i.pctDone == null) return { ...quiet, state: 'no-percent', tone: 'calm', headline: W.noPercent, lines: [W.noPercentNext], setPctAsk: '', leftLine, moneyLine }
  if (!(i.hoursBudget > 0)) return { ...quiet, state: 'no-budget', tone: 'calm', headline: W.noBudget, lines: [W.noBudgetNext], leftLine: null, moneyLine }
  if (used == null || used < PACE_EARLY_HOURS) return { ...quiet, state: 'early', tone: 'calm', headline: W.early, lines: [W.earlyWhy], leftLine, moneyLine }

  const workPct = Math.round(clamp(i.pctDone))
  const hoursPctRaw = (used / i.hoursBudget) * 100
  const hoursPct = Math.round(hoursPctRaw)
  // The gap in hours: what is used over what the work done accounts for. The line's own sum, read the other way.
  const gapHours = used - (clamp(i.pctDone) / 100) * i.hoursBudget
  const days = i.crewHoursPerDay > 0 ? Math.round(-gapHours / i.crewHoursPerDay) : 0
  // When the percent was last said, and the hours that went in on the days after it.
  const lastYmd = i.saidToday ? i.todayYmd : i.values.reduce<string | null>((best, v) => (best == null || v.ymd > best ? v.ymd : best), null)
  const sinceHours = lastYmd ? i.laborDays.reduce((s, d) => (d.ymd > lastYmd ? s + Math.max(0, d.hours) : s), 0) : 0
  const over = days <= -1
  const old = over && lastYmd != null && sinceHours >= PACE_OLD_HOURS
  const state: PaceReadingState = old ? 'old' : over ? 'over' : days >= 1 ? 'under' : 'track'

  const fill = clamp(Math.min(workPct, hoursPctRaw))
  const bars: PaceReadingBars = {
    hoursPct,
    workPct,
    hoursFill: fill,
    gapFrom: fill,
    gapWidth: Math.max(0, clamp(hoursPctRaw) - fill),
    hoursWords: W.hoursOf(Math.round(used), Math.round(i.hoursBudget)),
    workWords: paceSetWords(lastYmd, i.todayYmd),
    workOld: old,
  }
  const pct = `${workPct}%`
  if (state === 'old') {
    const day = paceDayWords(lastYmd) ?? lastYmd ?? ''
    return { state, tone: 'amber', headline: W.stillRight(pct), bars, lines: [W.oldWhy(day, hoursOf(sinceHours))], setPctAsk: '', stillPct: workPct, finishAsk: null, leftLine, moneyLine: null }
  }
  if (state === 'over') {
    const past = used - i.hoursBudget
    const why = past >= 0 ? (Math.round(past) > 0 ? W.usedUpBy(hoursOf(past)) : W.usedUp) : W.overWhy
    return { state, tone: 'red', headline: W.over, bars, lines: [W.gap(hoursOf(gapHours)), why], setPctAsk: W.moreDone(pct), stillPct: null, finishAsk: W.finishAsk, leftLine, moneyLine: null }
  }
  if (state === 'under') return { state, tone: 'green', headline: W.under, bars, lines: [W.underBy(hoursOf(-gapHours))], setPctAsk: null, stillPct: null, finishAsk: null, leftLine, moneyLine }
  return { state, tone: 'calm', headline: W.track, bars, lines: [W.trackWhy], setPctAsk: null, stillPct: null, finishAsk: null, leftLine, moneyLine }
}

/** The note a **Still 40%** press files with its status report, so the office reads where the number came from. */
export function paceStillNote(pct: number): string {
  return `Still ${Math.round(pct)}%. Said on the Job pace card.`
}

export const PACE_READING_WORDS = {
  /** The card's name, so a person can ask about it. */
  name: 'Job pace',
  hoursLabel: 'Hours used',
  workLabel: 'Work done',
  hoursOf: (used: number, budget: number): string => `${used} of ${budget} hours`,
  setToday: 'set today',
  setYesterday: 'set yesterday',
  setDaysAgo: (n: number): string => `set ${n} days ago`,

  over: 'Hours are ahead of the work.',
  gap: (hours: string): string => `The gap is about ${val('gap', hours)}.`,
  overWhy: 'At this rate the hours run out before the work does.',
  usedUp: 'The hours budget is used up.',
  usedUpBy: (hours: string): string => `The hours budget is used up. The job is ${val('past', hours)} past it.`,
  moreDone: (pct: string): string => `More than ${val('pct', pct)} done?`,
  finishAsk: 'If not, say when you will finish.',

  stillRight: (pct: string): string => `Is ${pct} still right?`,
  oldWhy: (day: string, hours: string): string => `The work was last set on ${val('day', day)}. The crew has put in ${val('since', hours)} since.`,
  still: (pct: number): string => `Still ${Math.round(pct)}%`,
  stillSaved: (pct: number): string => `Saved. The work is still ${Math.round(pct)}% as of today.`,
  stillFailed: 'The percent could not be saved.',

  track: 'On track.',
  trackWhy: 'Hours and work are moving together.',
  under: 'The work is ahead of the hours.',
  underBy: (hours: string): string => `About ${val('gap', hours)} under so far.`,

  noPercent: 'Nobody has set the work percent yet.',
  noPercentNext: 'Press Set the % so this card can compare.',
  noBudget: 'This job has no hours budget yet.',
  noBudgetNext: 'The office sets it. There is nothing for you to do.',
  early: 'Too early to tell.',
  earlyWhy: `The job has under ${PACE_EARLY_HOURS} hours on it.`,

  left: (hours: string, days: string): string => `${val('left', hours)} left in the budget. About ${val('days', days)} for this crew.`,
  leftShort: (hours: string): string => `${val('left', hours)} left in the budget.`,
  moneyLeads: 'Money spent is ahead of the work. The office watches that.',
  moneyWrong: 'The office’s money budget for this job looks wrong. There is nothing for you to do.',

  /** Under a stage's name on the rail: the one being worked. */
  inHand: 'in hand',
  /** The key beside the hatched part of the hours bar, for a screen reader. */
  gapKey: 'The hatched part of the hours bar is the gap.',

  /** The fold that says what the card is. It opens by itself the first time, then stays folded. */
  what: 'What is this?',
  whatLines: [
    'This card compares two things on this job.',
    'Hours used is the time the crew has clocked here. It is measured against the job’s hours budget.',
    'Work done is the percent you set.',
    'When hours run ahead of the work, the job can run out of hours before it is finished.',
    'The office sees the same two numbers on the Projects board.',
    'Set the percent when more work is done. Say your finish date when the job needs more time.',
  ],
} as const

/** Where the card keeps that a person has seen **What is this?** once, on this phone. */
export const paceWhatSeenKey = (userId: string | null | undefined): string => `pt.jobPace.whatSeen.${userId ?? 'anon'}`
