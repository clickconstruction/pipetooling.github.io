/**
 * The estimator's own row and a closeout's chip (team scorecard, punch list #360, PR 5).
 *
 * The Scores tab is the owner's. The person the estimating score is about never saw it: an estimator met the score
 * only as a chip on a bid they could not finish. This is their own row, on the Bid Board where they work, from the
 * bids they estimated or manage: what they won above the hurdle, what a closed job moved, what is waiting, and what
 * they have to finish before a bid can score. And on a won bid's row, what its job made against what the bid was
 * priced to make, the day the job closed.
 *
 * Pure: the answer comes from `team-scores`; these are the words.
 */
import { usdPerHour } from './hurdle'
import type { EstimatorRow, EstimatorScore } from './estimatorScore'

const usd0 = (n: number): string => `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
const signed = (n: number): string => `${n < 0 ? '−' : '+'}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export const MY_SCORE_WORDS = {
  title: 'Your score',
  open: 'Open your score',
  hurdle: (perHour: number | null) => (perHour == null ? 'There is no hurdle yet: no paid field hours in the window.' : `The hurdle is ${usdPerHour(perHour)}: a bid scores when its priced profit on each labor hour clears it.`),
  windowLead: (days: number) => `Your bids over the last ${days === 28 ? '4 weeks' : days === 56 ? '8 weeks' : `${days} days`}, as estimator or account manager.`,
  awardedHead: 'Won above the hurdle',
  closedHead: 'Closed, and what the job moved',
  zeroHead: 'Awarded, counting zero',
  finishHead: 'Finish these before they can score',
  waitingHead: 'Out, waiting on an answer',
  openLabor: 'Open Labor',
  nothing: 'Nothing waiting on you here: no bid of yours is awarded, closed or out in the window.',
} as const

/** Whether the person has a row at all: a bid in play, counted, closed or held in the window. */
export function myScoreHasAnything(e: EstimatorScore): boolean {
  return e.awarded.length + e.closeouts.length + e.underHurdle.length + e.held.length + e.toFinish.length + e.waiting.length > 0 || e.coverage.total > 0
}

/** The strip on the Bid Board: one figure and one line. The ramp's figure until a judged bid of theirs is awarded. */
export function myScoreStripWords(e: EstimatorScore): { figure: string; words: string } {
  if (e.ramp) {
    const need = e.toFinish.length
    return { figure: `${e.coverage.judged} of ${e.coverage.total}`, words: `of your priced bids can be scored${need > 0 ? ` · ${need} ${need === 1 ? 'needs its' : 'need their'} Labor tab finished` : ''}` }
  }
  const parts: string[] = []
  if (e.awarded.length > 0) parts.push(`won above the hurdle on ${count(e.awarded.length, 'bid')}`)
  if (e.closeouts.length > 0) parts.push(`${count(e.closeouts.length, 'job')} closed and moved it by ${signed(e.adjustmentsUsd)}`)
  if (e.underHurdle.length > 0) parts.push(`${e.underHurdle.length} under the hurdle ${e.underHurdle.length === 1 ? 'counts' : 'count'} zero`)
  if (e.toFinish.length > 0) parts.push(`${e.toFinish.length} to finish`)
  return { figure: usd0(e.countedUsd), words: parts.length > 0 ? parts.join(' · ') : 'no bid of yours awarded or closed in the window' }
}

export type CloseoutChip = { text: string; title: string; tone: 'up' | 'down' | 'even' }

/** A closed job's chip on its bid: what it made against what the bid was priced to make. Null unless the bid closed. */
export function closeoutChip(row: EstimatorRow): CloseoutChip | null {
  if (row.kind !== 'closed' || row.adjustmentUsd == null || row.expectedGrossProfitUsd == null) return null
  const adj = row.adjustmentUsd
  const even = Math.abs(adj) < 0.5
  const made = row.expectedGrossProfitUsd + adj
  const when = row.job?.closedYmd ? ` on ${row.job.closedYmd}` : ''
  return {
    text: even ? 'Closed on its estimate' : `Closed ${signed(adj)}`,
    title: `The job closed${when}. It made ${usd0(made)} against the ${usd0(row.expectedGrossProfitUsd)} the bid was priced to make. ${even ? 'The estimating score did not move.' : `The estimating score moved by ${signed(adj)}.`}`,
    tone: even ? 'even' : adj > 0 ? 'up' : 'down',
  }
}

/** The closeouts by bid id, for the Bid Board's rows. */
export function closeoutChipsByBid(e: EstimatorScore | null): Map<string, CloseoutChip> {
  const out = new Map<string, CloseoutChip>()
  for (const r of e?.closeouts ?? []) {
    const chip = closeoutChip(r)
    if (chip) out.set(r.bidId, chip)
  }
  return out
}

/** One row of the sheet: "B512 Riverside Lofts · $12,400 at $41/h". */
export function myScoreRowWords(r: EstimatorRow): string {
  const name = [r.bidNumber ? `B${r.bidNumber}` : null, r.projectName].filter(Boolean).join(' ') || 'A bid'
  if (r.kind === 'closed') return `${name} · ${closeoutChip(r)?.text ?? 'Closed'}`
  if (r.kind === 'counted') return `${name} · ${usd0(r.expectedGrossProfitUsd ?? 0)}${r.expectedPerHourUsd != null ? ` at ${usdPerHour(r.expectedPerHourUsd)}` : ''}`
  if (r.kind === 'waiting') return `${name} · out ${count(r.daysOut ?? 0, 'day')}${r.note ? ` · ${r.note}` : ''}`
  return `${name}${r.note ? ` · ${r.note}` : ''}`
}
