/**
 * The office's verdict on a Rework pair (punch list #255, v2.6589): It was a callback, or Not a callback. A pair the
 * Rework view infers (a second job at the same address soon after the first was billed) counts against the techs on
 * the first job only after the office presses; an inferred pair alone never reaches a Your week card. Both presses
 * weigh the same. Pure: the key, the words, the chip.
 */

export type CallbackVerdict = 'callback' | 'not_callback'

export type JobCallbackRow = { first_job_id: string; second_job_id: string; verdict: CallbackVerdict; decided_by_name: string; decided_at: string }

export const pairKey = (firstJobId: string, secondJobId: string): string => `${firstJobId}:${secondJobId}`

export const VERDICT_PRESS: Record<CallbackVerdict, string> = { callback: 'It was a callback', not_callback: 'Not a callback' }

/** The chip after a press: "Callback · Rosa · Nov 6", "Not a callback · Rosa · Nov 6". */
export function verdictWords(row: Pick<JobCallbackRow, 'verdict' | 'decided_by_name' | 'decided_at'>): string {
  const who = row.decided_by_name.trim() || 'the office'
  const ms = Date.parse(row.decided_at)
  const day = Number.isNaN(ms) ? '' : new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' })
  return `${row.verdict === 'callback' ? 'Callback' : 'Not a callback'} · ${who}${day ? ` · ${day}` : ''}`
}

/** The verdicts by pair key. */
export function verdictsByPair(rows: readonly JobCallbackRow[]): Map<string, JobCallbackRow> {
  return new Map(rows.map((r) => [pairKey(r.first_job_id, r.second_job_id), r]))
}

/** The note under the pairs table, so the office knows what a press does. */
export const PRESS_NOTE = 'A callback counts against every tech clocked on the first job, on their Your week card, only once someone presses It was a callback. Not a callback keeps the pair off every card. A second press replaces the verdict.'
