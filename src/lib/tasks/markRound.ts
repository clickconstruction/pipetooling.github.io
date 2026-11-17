import { batchOutcomeWords, countedLabel, type BatchOutcome } from '../batchWords'

/**
 * Mark N done (punch list #369, step D2): one press for a round of daily tasks. A person whose day is a round of ten
 * repeating tasks, the feed run or the shop walk, ticks ten boxes one at a time. This is the rule for which tasks one
 * press may finish, and the words on it.
 *
 * The round is narrow on purpose. It takes today's open tasks that repeat and have a plain tick. A one-time task has a
 * percent, a task with Done when… lines is finished by its lines, and a task that asks for a photo holds for the
 * photo: each of those is finished by itself, where its own sheet can ask what it asks. A stuck task is not finished
 * by a round either.
 */
export type RoundTask = {
  id: string
  /** Dated today and not done. */
  open: boolean
  /** A one-time or roadmap task, which wears the percent ring. */
  ring: boolean
  hasLines: boolean
  asksForPhoto: boolean
  stuck: boolean
}

/** The fewest tasks a round is offered for. One task has its own tick. */
export const ROUND_MIN = 2

/** The tasks one press may finish, in the list's order. */
export function roundTaskIds(tasks: ReadonlyArray<RoundTask>): string[] {
  return tasks.filter((t) => t.open && !t.ring && !t.hasLines && !t.asksForPhoto && !t.stuck).map((t) => t.id)
}

/** The open tasks of today the round leaves for their own press. */
export function roundHeldCount(tasks: ReadonlyArray<RoundTask>): number {
  const open = tasks.filter((t) => t.open).length
  return open - roundTaskIds(tasks).length
}

const NOUN = ['done', 'done'] as const

/** The press says exactly what it will do, with its count: *Mark 3 done*. */
export function roundPressLabel(count: number): string {
  return countedLabel('Mark', count, NOUN)
}

/** The quiet line under the press when some of today's open tasks are left out of the round. */
export function roundHeldWords(held: number): string | null {
  if (held <= 0) return null
  return held === 1 ? '1 more task has its own steps. Finish it from its card.' : `${held} more tasks have their own steps. Finish each from its card.`
}

/** The question the confirm window asks before a round is marked. Its button is the press's own label. */
export function roundConfirmMessage(count: number): string {
  return `Mark these ${count} tasks done? Each finishes as if you had ticked it.`
}

/** What the round came to: it keeps going past a task that does not mark, and says so. */
export function roundOutcome(done: number, failed: number): BatchOutcome {
  return batchOutcomeWords({ verb: 'Mark', past: 'marked', done, failed, noun: ['task done', 'tasks done'] })
}
