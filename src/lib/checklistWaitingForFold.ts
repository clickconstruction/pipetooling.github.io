/**
 * The words on the Checklist's folded "Waiting For" row (Today tab). The section is reference, not work, so it starts
 * folded, and the one row left has to say what is behind it: how many tasks wait, behind how many steps, and the same
 * peek at the first step the Dashboard's My Inbox strip shows (`buildWaitingForStripSummary`), so the two folds read
 * alike.
 */
import { pluralNoun } from './batchWords'
import { buildWaitingForStripSummary, type WaitingForStripGroup } from './dashboardWaitingForStrip'

export type WaitingForFoldLine = {
  /** Tasks waiting, across every step. */
  count: number
  /** Steps they wait behind. One group is one step someone else has to finish. */
  steps: number
  /** `5 tasks behind 2 steps`, `1 task behind 1 step`. */
  countWords: string
  /** The Dashboard strip's peek at the first step: `after "<step>" — <who>`. */
  peek: string
}

/** What the row says under its heading once it is open. The list below then carries the counts. */
export const WAITING_FOR_OPEN_WORDS = 'yours, once the step ahead clears'

/** The folded row's line, or null when nothing waits and the section draws nothing. A step with no task is not counted. */
export function waitingForFoldLine(groups: ReadonlyArray<WaitingForStripGroup>): WaitingForFoldLine | null {
  const waiting = groups.filter((g) => g.tasks.length > 0)
  const summary = buildWaitingForStripSummary(waiting)
  if (!summary) return null
  const steps = waiting.length
  return {
    count: summary.count,
    steps,
    countWords: `${summary.count} ${pluralNoun('task', summary.count)} behind ${steps} ${pluralNoun('step', steps)}`,
    peek: summary.peek,
  }
}
