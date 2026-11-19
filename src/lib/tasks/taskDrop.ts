/**
 * No longer applies: a one-time task closed without the work done, with a reason (`task_no_longer_applies`, migration
 * `20261117120000_task_doer_acts.sql`). The words and the reason's rule, on their own so the dev seat's
 * `plan_task_close` holds a close to the same rule the card's More does (the copy under `gcKernels`). Pure: no
 * imports. `taskDoerActs.ts` hands every name on, so a screen imports from there as before.
 */

export const DROP_TITLE = 'No longer applies'
/** The reasons one press writes. The person may type their own instead. */
export const DROP_REASONS: readonly string[] = ['Done another way', 'Plans changed', 'A double of another task']
/** The database's own limits on the reason, after it is tidied. */
export const DROP_REASON_MIN = 3
export const DROP_REASON_MAX = 200

/** The reason as the database will keep it: one line, trimmed, cut at its limit. */
export function dropReasonTidy(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, DROP_REASON_MAX)
}

/** Why the task cannot be closed yet, or null when it can. */
export function dropRule(reason: string): string | null {
  return dropReasonTidy(reason).length < DROP_REASON_MIN ? 'Say why in a few words.' : null
}

export function dropPressLabel(ready: boolean): string {
  return ready ? 'Close this task' : 'Say why first'
}

/** What the press will do, in the green line above it. */
export function dropSentence(giverName: string | null): string {
  const name = (giverName ?? '').trim()
  return name ? `It leaves your list. ${name} is told and can put it back.` : 'It leaves your list. You can put it back from History.'
}

/** The line a closed task wears where a done task says *Done 12:22 PM.* */
export function droppedLineWords(stamp: string, reason: string): string {
  const why = reason.trim().replace(/[.!?]+$/, '')
  return why ? `Closed ${stamp} as no longer applying. ${why}.` : `Closed ${stamp} as no longer applying.`
}

/** The short mark a closed task wears in History and Review. */
export const DROPPED_CHIP = 'No longer applies'

/** The push the giver gets when a person closes their task this way. */
export function dropPush(who: string, title: string, reason: string): { title: string; body: string } {
  return { title: 'A task was closed', body: `${who} closed "${title}" as no longer applying: ${dropReasonTidy(reason)}` }
}
