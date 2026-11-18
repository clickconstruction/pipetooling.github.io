import { plainDateWords } from '../jobNameDate'

/**
 * The pace card, shown (punch list #396). The superintendent's card said its reading in about ninety words:
 * where the budget came from, a strip with a four-part legend, a finish sentence, the office's sign-off and
 * the month's score. The owner asked for fewer words and more showing. This file is what the card shows in
 * their place, worked out from the same `projectPace` the office's Projects board reads, so the two cannot
 * disagree:
 *
 * - the job's stages top to bottom as a rail, done, now and next, ending in the finish day;
 * - the hours used against the budget as one bar;
 * - the row the short Job Mode page shows while the card is folded.
 *
 * Everything the card used to say stays one press away, behind **How this is figured**. Pure: numbers and
 * days in, rows and words out.
 */

/** One stage of the rail. `pct` is how far along it is, 0 to 100. */
export type PaceRailRow = { name: string; state: 'done' | 'now' | 'next'; pct: number }

export type PaceRail = {
  rows: PaceRailRow[]
  /** Where each stage's percent came from: the crew's own number per stage, or the job's one percent spread over the stages in order. */
  from: 'stages' | 'job'
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

/**
 * The job's stages as a rail. A stage is done at 100. The first stage that is not done is the one in hand.
 *
 * When the crew has reported any stage by itself, each stage reads its own number and an unreported one reads 0.
 * When nobody has, the job's one percent is spread over the stages in their order by their share of the hours:
 * at 25% on a job whose first stage is a fifth of the work, the first stage is done and the second is started.
 * Fewer than two stages is no rail: the card draws one bar for the work instead.
 */
export function paceStageRail(stages: ReadonlyArray<{ name: string; hours: number; pctDone: number | null }>, jobPct: number | null): PaceRail | null {
  if (stages.length < 2) return null
  const reported = stages.some((s) => s.pctDone != null)
  let pcts: number[]
  if (reported) {
    pcts = stages.map((s) => clamp(s.pctDone ?? 0))
  } else {
    const total = stages.reduce((sum, s) => sum + Math.max(0, s.hours), 0)
    const doneHours = (clamp(jobPct ?? 0) / 100) * total
    let before = 0
    pcts = stages.map((s) => {
      const hours = Math.max(0, s.hours)
      const pct = hours > 0 ? clamp(((doneHours - before) / hours) * 100) : doneHours >= before && total > 0 && doneHours >= total ? 100 : 0
      before += hours
      return pct
    })
  }
  // A whisker short of 100 from the spread is done: 99.99999 must not read as in hand.
  const rounded = pcts.map((p) => (p > 99.5 ? 100 : Math.round(p)))
  const nowAt = rounded.findIndex((p) => p < 100)
  return {
    rows: stages.map((s, i) => ({ name: s.name, pct: rounded[i]!, state: rounded[i]! >= 100 ? 'done' : i === nowAt ? 'now' : 'next' })),
    from: reported ? 'stages' : 'job',
  }
}

function ymdParts(ymd: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** A civil day as *Fri, Nov 20*. The string is already a day, so no zone moves it. */
export function paceDayWords(ymd: string | null | undefined): string | null {
  const p = ymd ? ymdParts(ymd) : null
  return p ? plainDateWords(p[0], p[1], p[2]) : null
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * The foot of the rail: the planned finish, and the day this pace lands on when that is a different day.
 * `days` is the line's own figure, days ahead (positive) or behind (negative), and the pace day is the planned
 * day moved by it, the same sum the line's finish sentence makes.
 */
export function paceFinish(input: { plannedFinishYmd: string | null | undefined; days: number; tone: 'ahead' | 'behind' | 'even' | 'early' }): { planned: string | null; atPace: { words: string; tone: 'ahead' | 'behind' } | null } {
  const planned = paceDayWords(input.plannedFinishYmd)
  if (!planned || !input.plannedFinishYmd) return { planned: null, atPace: null }
  if ((input.tone !== 'ahead' && input.tone !== 'behind') || input.days === 0) return { planned, atPace: null }
  const words = paceDayWords(addDays(input.plannedFinishYmd, -input.days))
  return { planned, atPace: words ? { words, tone: input.tone } : null }
}

/** The hours bar: what is in against the budget. `fillPct` stops at the bar's end, and `over` says the hours passed it. */
export function paceHours(input: { hoursUsed: number | null; subHours: number | null; hoursBudget: number }): { words: string; fillPct: number; over: boolean } | null {
  if (!(input.hoursBudget > 0)) return null
  const sub = Math.max(0, input.subHours ?? 0)
  const used = input.hoursUsed != null ? input.hoursUsed + sub : sub
  const budget = Math.round(input.hoursBudget)
  return { words: PACE_CARD_WORDS.hoursOf(Math.round(used), budget), fillPct: clamp((used / input.hoursBudget) * 100), over: used > input.hoursBudget }
}

/** The budget's hours still unspent, in the job's own crew days: *3 days of hours left*. Null before a pace exists. */
export function paceDaysLeftWords(daysLeft: number | null): string | null {
  if (daysLeft == null || !Number.isFinite(daysLeft)) return null
  const n = Math.round(daysLeft)
  if (n <= 0) return PACE_CARD_WORDS.noDaysLeft
  return n === 1 ? '1 day of hours left' : `${n} days of hours left`
}

/** The folded row's second line on the short page: the finish day when the job has one, then what the press does. */
export function paceRowNote(plannedFinishYmd: string | null | undefined): string {
  const day = paceDayWords(plannedFinishYmd)
  return day ? `Finish ${day}. ${PACE_CARD_WORDS.rowOpen}` : PACE_CARD_WORDS.rowOpen
}

export const PACE_CARD_WORDS = {
  work: 'Work',
  hours: 'Hours',
  hoursOf: (used: number, budget: number): string => `${used} of ${budget} h`,
  noDaysLeft: 'No hours left in the budget',
  finish: 'Finish',
  atPace: 'At this pace',
  setPct: 'Set the %',
  /** The fold that holds what the card used to say: the budget's source, the days, the sign-off and the score. */
  figured: 'How this is figured',
  rowOpen: 'Tap for the pace card.',
  /** Said under the rail when the stages read the job's one percent, so a tick is never taken for a stage's own report. */
  fromJob: 'Stages read from the job’s percent.',
} as const
