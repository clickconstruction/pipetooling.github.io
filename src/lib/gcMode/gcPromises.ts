/**
 * GC mode — design spike: promises other than a quote date (the owner, 2026-10-04, question 8: "yes
 * to all, especially insurance, which will have a renewal date"). One record for every kind. A
 * promise is kept when the thing happens: `promisesKeptBy` names, for each move, what it keeps.
 * Each lane adds its own kinds' moves there (Board: insurance, W-9, statement of work; Building:
 * start, submittals, delivery, a pay application sent again, punch, closeout papers).
 */
import type { GcAction, GcState, PromiseKind } from './gcTypes'
import { buildingPromisesKeptBy } from './gcBuildingPromises'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import { openPromiseFor } from '../gc/promises'
export type { InsuranceRenewal, PaperAsk } from '../gc/promises'
export { PROMISE_WHAT, insuranceRenewalWords, insuranceRenewals, openPromiseFor, paperAsks, promisePartner, promisesToChase, tradePromiseRecord, tradePromiseState, tradePromiseWords, tradePromisesOf } from '../gc/promises'

export { INSURANCE_ASK_DAYS } from '../gc/promises'

/**
 * What a move keeps: the open promises it settles. Each lane adds its own moves here. `on`: the day
 * it came, when that is not today (Building: a daily log caught up late keeps a start on its own day).
 */
export function promisesKeptBy(state: GcState, action: GcAction): { partnerId: string; kind: PromiseKind; projectId?: string; packageId?: string; on?: string }[] {
  switch (action.type) {
    // Board's kinds.
    case 'tradeUploadCoi':
      return [{ partnerId: action.partnerId, kind: 'insurance' }]
    case 'tradeSignW9':
      return [{ partnerId: action.partnerId, kind: 'w9' }]
    case 'tradeSignMsa':
      return [{ partnerId: action.partnerId, kind: 'msa' }]
    case 'tradeSignSow': {
      const pkg = state.projects.find((p) => p.id === action.projectId)?.packages.find((k) => k.id === action.packageId)
      const partnerId = pkg?.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId
      return partnerId ? [{ partnerId, kind: 'sow', projectId: action.projectId, packageId: action.packageId }] : []
    }
    // Building's kinds: the moves are in gcBuildingPromises.ts.
    case 'saveDailyLog':
    case 'tradeSendSubmittal':
    case 'tradeSendPayApp':
    case 'tradeFixPunchItem':
    case 'tradeSendFinalPayApp':
    case 'tradeSignUnconditional':
      return buildingPromisesKeptBy(state, action)
    default:
      return []
  }
}

/** Marks kept every open promise a move settled: today, or the day the move says it came. The same state back when none did. */
export function keepPromisesOn(state: GcState, matches: ReturnType<typeof promisesKeptBy>): GcState {
  if (matches.length === 0 || !state.tradePromises) return state
  const on = new Map<string, string>()
  for (const m of matches) {
    const id = openPromiseFor(state, m)?.id
    if (id) on.set(id, m.on ?? state.today)
  }
  if (on.size === 0) return state
  return { ...state, tradePromises: state.tradePromises.map((p) => (on.has(p.id) ? { ...p, keptOn: on.get(p.id) } : p)) }
}
