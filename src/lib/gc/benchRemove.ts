/**
 * The bench's Remove press (v2.6749, punch list #153): a company with no history leaves Trade partners in
 * one press behind a confirm; a company with any history keeps only the ask's Will not do it and Cannot do
 * it, and no Remove shows on its row. History is what the office would lose: a work order, a quote, an ask,
 * a contact logged, a promise, a paper sent or come in, a portal opened, a vetting form sent. The server
 * function `gc_remove_bench_company` holds the same rule over every table and refuses in words, so a stale
 * row never takes a company that was asked a minute ago. Pure; the write is `removeGcBenchCompany` in gcIo.
 */
import type { Partner } from './types'

/** Why the row shows no Remove: the first piece of history on the company, in words. Null: nothing, the press shows. */
export function benchRemoveHold(p: Partner): string | null {
  if (p.won > 0) return 'They hold a work order with us.'
  if (p.bids > 0) return 'They quoted for us.'
  if (p.invited > 0) return 'They were asked to quote.'
  if ((p.contacts?.length ?? 0) > 0) return 'A contact is logged on them.'
  if (p.promisesMade > 0) return 'They gave us a promise.'
  if (p.msa !== 'none' || p.msaSentOn || p.w9 || p.w9SentOn || p.coiExpires || p.coiReceived) return 'Papers went to them or came in.'
  if (p.portalOpenedOn) return 'They opened their portal.'
  if (p.vetting?.form) return 'They sent us their form.'
  return null
}

/** The press shows on a company with no history. */
export function canRemoveFromBench(p: Partner): boolean {
  return benchRemoveHold(p) === null
}

export const BENCH_REMOVE_PRESS = 'Remove from the bench…'
export const BENCH_REMOVE_CONFIRM = 'Remove from the bench'
export const BENCH_REMOVE_PRESS_TITLE = 'No quote, no ask, no work order and no contact logged. Press to take them off the bench.'

/** The confirm window's words. `fromProspects`: the company came from Prospects → Subs, so its card goes back on the lane. */
export function benchRemoveConfirmWords(company: string, fromProspects: boolean): { title: string; message: string; confirmLabel: string } {
  const back = fromProspects ? ' Their card goes back on Prospects → Subs to call again.' : ''
  return {
    title: `Remove ${company} from the bench?`,
    message: `${company} has no quote, no ask, no work order and no contact logged. Their row leaves Trade partners.${back}`,
    confirmLabel: BENCH_REMOVE_CONFIRM,
  }
}

/** The fallback when the write fails with no reason of its own. */
export const BENCH_REMOVE_FAILED = 'The remove did not go through.'
