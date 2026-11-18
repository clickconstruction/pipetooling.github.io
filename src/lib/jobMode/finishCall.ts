import { paceDayWords } from './paceCard'

/**
 * My finish date (punch list #396, PR 3). The pace card read the office's planned finish and the day this pace
 * lands on, and neither is what the man on the job thinks. This is his own word: the day he says the job
 * finishes, and what is in the way. It is kept as a row of `job_finish_calls`, one row a saying, never changed.
 *
 * It moves nothing: the planned finish and the score stay the office's (the owner's call of 2026-11-18). The
 * card shows his day beside the plan's, and the Projects board shows it to the office.
 *
 * The card also asks. Two days before the day in force, and when the job falls behind before he has said a day,
 * it puts one question on top, *Still finishing Fri, Nov 20?*, with **Yes** and **Pick a day**. Once a day at
 * most. This file is the choices, the rule for the question and every word. Pure: days in, words out.
 */

/** One saying, as the screens read it (`job_finish_calls`). */
export type FinishCall = { userId: string; userName?: string | null; finishOn: string; planWas: string | null; why: string | null; createdAt: string }

/** How close to the day in force the card starts asking. */
export const FINISH_ASK_DAYS_BEFORE = 2

const DAY_MS = 86_400_000
const ymdMs = (ymd: string): number => Date.parse(`${ymd}T12:00:00Z`)
const isYmd = (s: string | null | undefined): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(ymdMs(s))

function addDays(ymd: string, days: number): string {
  return new Date(ymdMs(ymd) + days * DAY_MS).toISOString().slice(0, 10)
}

/** The next working day after `ymd`, or before it with `step` -1: Saturday and Sunday are stepped over. */
export function workingDayFrom(ymd: string, step: 1 | -1): string {
  let d = addDays(ymd, step)
  while ([0, 6].includes(new Date(ymdMs(d)).getUTCDay())) d = addDays(d, step)
  return d
}

/** A person's word today on a job: his newest saying. */
export function latestFinishCall(rows: ReadonlyArray<FinishCall>, userId: string | null | undefined): FinishCall | null {
  if (!userId) return null
  return rows.filter((r) => r.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
}

/** Each person's newest saying on a job, newest first: what the office reads on the Projects board. */
export function latestFinishCallsByPerson(rows: ReadonlyArray<FinishCall>): FinishCall[] {
  const byUser = new Map<string, FinishCall>()
  for (const r of rows) {
    const held = byUser.get(r.userId)
    if (!held || r.createdAt > held.createdAt) byUser.set(r.userId, r)
  }
  return [...byUser.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** One quick pick in the window. */
export type FinishChoice = { ymd: string; words: string; isPlan: boolean }

/**
 * The quick picks: the working day before the day in force, that day, and the working day after it. The day in
 * force is his own last word when he has one, else the plan. A day already gone is left out, and with no day in
 * force there are no quick picks: the window opens on its date box.
 */
export function finishChoices(input: { plannedYmd: string | null | undefined; saidYmd: string | null | undefined; todayYmd: string }): FinishChoice[] {
  const planned = isYmd(input.plannedYmd) ? input.plannedYmd : null
  const base = isYmd(input.saidYmd) ? input.saidYmd : planned
  if (!base) return []
  const days = [workingDayFrom(base, -1), base, workingDayFrom(base, 1)]
  if (planned && !days.includes(planned) && planned >= input.todayYmd) days.push(planned)
  return [...new Set(days)]
    .filter((d) => d >= input.todayYmd)
    .sort()
    .map((ymd) => ({ ymd, isPlan: ymd === planned, words: `${paceDayWords(ymd) ?? ymd}${ymd === planned ? FINISH_CALL_WORDS.planMark : ''}` }))
}

/** The question on top of the card, or null when it has nothing to ask. */
export type FinishAsk = { ymd: string; words: string; /** The day in force is already gone: there is no Yes to give, only a new day. */ past: boolean }

/**
 * Whether the card asks, and about which day. The day in force is his last word, else the plan.
 *
 * It asks when that day is two days off or nearer, or already gone. It also asks when the job is behind and he
 * has never said a day. It does not ask twice in a day: a saying made today is the day's answer. With no day in
 * force there is no question, and the **My finish date** press is the way in.
 */
export function finishAsk(input: { plannedYmd: string | null | undefined; mine: FinishCall | null; todayYmd: string; saidTodayYmd: string | null; behind: boolean }): FinishAsk | null {
  const target = input.mine && isYmd(input.mine.finishOn) ? input.mine.finishOn : isYmd(input.plannedYmd) ? input.plannedYmd : null
  if (!target) return null
  if (input.saidTodayYmd === input.todayYmd) return null
  const daysOff = Math.round((ymdMs(target) - ymdMs(input.todayYmd)) / DAY_MS)
  const near = daysOff <= FINISH_ASK_DAYS_BEFORE
  const behindAndSilent = input.behind && !input.mine
  if (!near && !behindAndSilent) return null
  const day = paceDayWords(target) ?? target
  return { ymd: target, past: daysOff < 0, words: daysOff < 0 ? FINISH_CALL_WORDS.askPast(day) : FINISH_CALL_WORDS.ask(day) }
}

/** His word on the rail's foot: the day, and what is in the way when he said. Null until he has said a day. */
export function saidRow(mine: FinishCall | null): { day: string; why: string | null } | null {
  if (!mine || !isYmd(mine.finishOn)) return null
  return { day: paceDayWords(mine.finishOn) ?? mine.finishOn, why: mine.why?.trim() || null }
}

/** What the office reads on the Projects board: *Sam says Mon, Nov 23: waiting on the inspector.* */
export function boardSaysWords(call: FinishCall): string {
  const who = (call.userName ?? '').trim().split(/\s+/)[0] || 'The crew'
  const day = paceDayWords(call.finishOn) ?? call.finishOn
  const why = call.why?.trim()
  return why ? `${who} says ${day}: ${why}` : `${who} says ${day}.`
}

/** Whether the window's Save has a real day that is not already gone. */
export function finishDayOk(ymd: string | null | undefined, todayYmd: string): ymd is string {
  return isYmd(ymd) && ymd >= todayYmd
}

/** The longest *what is in the way* the table takes. */
export const FINISH_WHY_MAX = 300

export const FINISH_CALL_WORDS = {
  press: 'My finish date',
  title: 'When does this job finish?',
  label: 'Say when this job finishes',
  planMark: ', the plan',
  another: 'Another day',
  dayLabel: 'The day',
  whyLabel: 'What is in the way',
  whyPlaceholder: 'Waiting on the inspector',
  save: 'Save my date',
  saving: 'Saving',
  saved: (day: string): string => `Saved ${day}. The office sees your date.`,
  failed: 'Your date was not saved',
  ask: (day: string): string => `Still finishing ${day}?`,
  askPast: (day: string): string => `${day} has passed. When does it finish?`,
  yes: 'Yes',
  pick: 'Pick a day',
  said: 'You said',
} as const
