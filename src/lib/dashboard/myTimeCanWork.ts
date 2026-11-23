/**
 * The hours a week the office has for a person, as My Time's quiet line and the hours window read them: the
 * answer in force today, a drawn week adding up to its own hours. Null with no answer. Pure.
 */
import { answerInForce, type AvailableHoursAnswer, type CanWork } from '../people/utilization'
import { weekHours } from '../people/weekAvailability'

export function canWorkFromAnswers(answers: readonly AvailableHoursAnswer[], todayYmd: string): CanWork | null {
  const a = answerInForce(answers, todayYmd)
  if (!a) return null
  return { hours: a.days ? weekHours(a.days) : a.hours_per_week, source: 'answered', setAt: a.set_at, setBy: a.set_by, days: a.days ?? null }
}

/** The line's words and its press. */
export function myTimeCanWorkWords(canWork: CanWork | null): { line: string; press: string } {
  return canWork ? { line: `The office has your week as ${canWork.hours} h.`, press: 'Change' } : { line: 'How many hours a week can you work?', press: 'Set hours' }
}
