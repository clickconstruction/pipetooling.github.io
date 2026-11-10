/**
 * Permits, the history on a card (punch list #302): the pure words for what was done on a permit.
 * Every answer is one row of `permit_verdicts`, never overwritten, so the history is those rows
 * read back: who moved the permit, where to, when, and why. No React, no Supabase.
 */
import { formatProvenanceDate } from '../jobPercentProvenance'
import type { ResearchPermitRow } from './permitResearch'
import { placeOf } from './permitBuilders'

/** One stored answer, as the io reads it. */
export type HistoryEvent = { id: string; verdict: string; reason: string; reason_code: string | null; decided_at: string; by_name: string | null; for_name: string | null }

/** The words every answer is stored with when nothing was typed or tapped. A reader has them already from the verb. */
const STOCK_LEAD = /^(passed on the skim|passed on a second look|not pursuing|kept on the skim|kept on a second look, after .+ passed|kept from passed, after .+|put back on the skim|pursued for this job and their next ones|pursued for their next jobs|pursued for this job|handed to nobody yet)\s*[:.]?\s*/i

/** What the person did, in the past tense, from the verdict and its code. */
export function historyVerb(ev: Pick<HistoryEvent, 'verdict' | 'reason' | 'reason_code' | 'for_name'>): string {
  const code = ev.reason_code ?? ''
  if (ev.verdict === 'back') return 'put it back on the skim'
  if (ev.verdict === 'not_for_us') return code.startsWith('np_') ? 'stopped pursuing it' : code.startsWith('sl_') ? 'passed again' : 'passed'
  if (ev.verdict === 'approach') return 'pursued it'
  if (ev.verdict === 'taken') return 'said a plumber has it'
  if (ev.verdict === 'look') {
    if (/^handed to /i.test(ev.reason)) return ev.for_name ? `handed it to ${ev.for_name}` : 'handed it to nobody yet'
    const how = /^kept on a second look/i.test(ev.reason) ? 'kept it on a second look' : /^kept from passed/i.test(ev.reason) ? 'kept it from Passed' : 'kept it'
    return ev.for_name ? `${how} for ${ev.for_name}` : how
  }
  return ev.verdict
}

/** The reason worth reading: what was tapped or typed, with the stock lead-in and the last full stop taken off. Null when there is none. */
export function historyReason(ev: Pick<HistoryEvent, 'reason'>): string | null {
  const said = (ev.reason ?? '').replace(/\s+/g, ' ').trim()
  if (/^handed to /i.test(said)) return null
  const rest = said.replace(STOCK_LEAD, '').replace(/\.$/, '').trim()
  return rest === '' ? null : rest
}

/** One line of the history: "Sam passed, Nov 9: too far". */
export function historyWords(ev: HistoryEvent): string {
  const day = formatProvenanceDate(ev.decided_at)
  const why = historyReason(ev)
  return `${ev.by_name ?? 'Someone'} ${historyVerb(ev)}${day ? `, ${day}` : ''}${why ? `: ${why}` : ''}`
}

/**
 * What a card shows of the history: the newest lines, and how many older ones the sheet holds.
 * `skip` leaves out the newest answers a card already says in its own words (a second-look card
 * reads the pass in its amber line).
 */
export function cardHistory(events: readonly HistoryEvent[], show = 2, skip = 0): { lines: Array<{ id: string; words: string }>; earlier: number } {
  const newestFirst = [...events].sort((a, b) => b.decided_at.localeCompare(a.decided_at)).slice(skip)
  return { lines: newestFirst.slice(0, show).map((ev) => ({ id: ev.id, words: historyWords(ev) })), earlier: Math.max(0, newestFirst.length - show) }
}

/** "and 3 earlier". Null with none. */
export function earlierWords(earlier: number): string | null {
  return earlier > 0 ? `and ${earlier} earlier` : null
}

/** May a closed permit be kept from its row? Any pass or drop, by anyone, as long as the feed has not paired it with a plumbing permit. */
export function mayKeepFromClosed(row: ResearchPermitRow): boolean {
  const p = placeOf(row)
  return p.place === 'closed' && p.why !== 'plumber'
}

/** The words a keep from the Closed list is stored with, so the history says whose answer it overturned. */
export function keepFromPassedReason(row: ResearchPermitRow): string {
  const dropped = placeOf(row).why === 'not_pursuing'
  return `Kept from Passed, after ${row.verdict_by_name ?? 'someone'} ${dropped ? 'stopped pursuing it' : 'passed'}.`
}
