/**
 * The hours a week the office has for a person, as My Time's quiet line and the hours window read them: the
 * answer in force today, a drawn week adding up to its own hours. Null with no answer. Since working hours
 * (punch list #429) the line reads those first: a person whose hours a dev or the controller set is told them,
 * with no press, and is told a week ahead when they are about to change. Pure.
 */
import { answerInForce, type AvailableHoursAnswer, type CanWork } from '../people/utilization'
import { weekHours } from '../people/weekAvailability'
import { formatWorkingClock, workingDaysLabel, workingHoursComing, workingHoursInForce, workingHoursLines, workingHoursSentences } from '../people/workingHours'
import { workingSundayWords } from '../people/workingHoursEdit'
import { val } from '../valuesInPlace'
import type { WeekDays } from '../people/weekAvailability'

export function canWorkFromAnswers(answers: readonly AvailableHoursAnswer[], todayYmd: string): CanWork | null {
  const a = answerInForce(answers, todayYmd)
  if (!a) return null
  return { hours: a.days ? weekHours(a.days) : a.hours_per_week, source: 'answered', setAt: a.set_at, setBy: a.set_by, days: a.days ?? null }
}

/** The line's words and its press. */
export function myTimeCanWorkWords(canWork: CanWork | null): { line: string; press: string } {
  return canWork ? { line: `The office has your week as ${canWork.hours} h.`, press: 'Change' } : { line: 'How many hours a week can you work?', press: 'Set hours' }
}

/** Who sets working hours, as the person reads it under their own. */
export const MY_TIME_HOURS_SET_BY = 'The office sets these hours.'

/** Hours that start on a Sunday ahead: the chip that dates them and the week, a value at a time. */
export type MyTimeHoursComing = { chip: string; sentences: string[] }

/**
 * What the foot of My Time says about a person's hours. `set` is working hours in force: sentences to read, no
 * press. `ask` is the old line, the person's own answer and its press, for a person who is asked. `none` says
 * nothing. Any of them may carry hours that are about to start.
 */
export type MyTimeHours =
  | { kind: 'set'; sentences: string[]; coming: MyTimeHoursComing | null }
  | { kind: 'ask'; canWork: CanWork | null; coming: MyTimeHoursComing | null }
  | { kind: 'none'; coming: MyTimeHoursComing | null }

/** A week ahead on one line: "6:00 AM to 12:00 PM, Mon to Fri." A week with no working day says so. */
function comingSentences(days: WeekDays | null | undefined): string[] {
  if (!days) return ['The office no longer sets your hours.']
  const lines = workingHoursLines(days).filter((l) => l.segs.length > 0)
  if (lines.length === 0) return ['You have no working days set.']
  return lines.map((l) => `${l.segs.map(([s, e]) => `${val('time', formatWorkingClock(s))} to ${val('time', formatWorkingClock(e))}`).join(', then ')}, ${val('days', workingDaysLabel(l.days))}.`)
}

/** `asks` is false for a person the card does not ask, a salaried one, whose week is on pay. */
export function myTimeHours(answers: readonly AvailableHoursAnswer[], todayYmd: string, asks: boolean): MyTimeHours {
  const next = workingHoursComing(answers, todayYmd)
  const coming: MyTimeHoursComing | null = next ? { chip: `New from ${workingSundayWords(next.effective_from)}`, sentences: comingSentences(next.days) } : null
  const set = workingHoursInForce(answers, todayYmd)
  if (set) return { kind: 'set', sentences: workingHoursSentences(set), coming }
  if (asks) return { kind: 'ask', canWork: canWorkFromAnswers(answers, todayYmd), coming }
  return { kind: 'none', coming }
}
