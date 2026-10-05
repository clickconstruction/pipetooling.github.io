/**
 * GC mode — design spike: GC Follow up on the dashboard's Needs you list (the owner, 2026-10-04).
 * One item, like the dashboard's others: how many companies to call or papers past their day,
 * the first few by name, and red when a day already passed.
 */
import type { GcState } from './gcTypes'
import { followUps, type FollowUpWhy } from './gcFollowUp'
import { insuranceRenewals, tradePromisesOf, tradePromiseState } from './gcPromises'

export interface GcNeedsYou {
  count: number
  /** A day already passed, or a company never opened an ask past the days we give it: red, not amber. */
  late: boolean
  title: string
  detail: string
}

const WHY_WORDS: Record<Exclude<FollowUpWhy, 'waiting'>, (company: string) => string> = {
  passed: (c) => `${c}'s quote day passed`,
  today: (c) => `${c} promised a quote today`,
  silent: (c) => `${c} never opened the ask`,
  nodate: (c) => `${c} gave no day`,
}

/** The item, or null when there is no one to chase: the same count as Follow up's badge. */
export function gcNeedsYou(state: GcState): GcNeedsYou | null {
  const calls = followUps(state).filter((f) => f.why !== 'waiting')
  const promises = tradePromisesOf(state).filter((p) => {
    const s = tradePromiseState(p, state.today).state
    return s === 'passed' || s === 'today'
  })
  const lapsed = insuranceRenewals(state).filter((r) => r.days <= 0 && !r.promise)
  const papers = promises.length + lapsed.length
  const count = calls.length + papers
  if (count === 0) return null
  const late =
    calls.some((f) => f.why === 'passed' || f.why === 'silent') ||
    promises.some((p) => tradePromiseState(p, state.today).state === 'passed') ||
    lapsed.length > 0
  const phrases = calls.map((f) => {
    const why = f.why === 'waiting' ? 'nodate' : f.why
    return WHY_WORDS[why](f.partner.company)
  })
  if (papers > 0) phrases.push(`${papers} ${papers === 1 ? 'paper is' : 'papers are'} past or at their day`)
  const shown = phrases.slice(0, 3)
  const more = phrases.length - shown.length
  return {
    count,
    late,
    title: calls.length > 0 ? `${count} to follow up on in GC mode` : `${count} ${count === 1 ? 'paper' : 'papers'} to chase in GC mode`,
    detail: `${shown.join(' · ')}${more > 0 ? ` · and ${more} more` : ''}.`,
  }
}
