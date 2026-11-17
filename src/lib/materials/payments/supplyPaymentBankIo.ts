/**
 * The bank side of supply house payments: the outgoing lines of the feed, which of them a payment already claims,
 * which the Tally already settled, and the two presses (`match_supply_house_payment`, `unmatch_supply_house_payment`).
 *
 * Every read leans on the caller's own access and the screens fail soft: a login that cannot read the bank, or a
 * database that does not carry the match yet, sees payments as they were, with no offer.
 */

import { supabase } from '../../supabase'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../../supabasePaging'
import { withSupabaseRetry } from '../../../utils/errorHandling'
import type { BankRow } from '../../subWorkOrders/subPaymentBankMatch'

export interface SupplyBankIo {
  /** Money out since a day, as the feed holds it. */
  loadBankRows(fromYmd: string): Promise<BankRow[]>
  /** The bank line each live payment claims, across every house. */
  loadMatches(): Promise<{ paymentId: string; transactionId: string }[]>
  /** Of these bank lines, the ones the Tally already said something about: a job, a bid, or a bill of its own. */
  loadSettled(transactionIds: string[]): Promise<Set<string>>
  /** Ties a payment to a bank line. `fill` also takes the line's day, and its kind as the method when none is said. */
  match(paymentId: string, transactionId: string, fill: boolean): Promise<void>
  unmatch(paymentId: string): Promise<void>
}

export const supabaseSupplyBankIo: SupplyBankIo = {
  async loadBankRows(fromYmd) {
    return fetchAllRows<BankRow>(
      (from, to) =>
        supabase
          .from('mercury_transactions')
          .select('id, amount, posted_at, created_at, counterparty_name, note, external_memo, status, kind, duplicate_of_transaction_id')
          .lt('amount', 0)
          .gte('created_at', `${fromYmd}T00:00:00Z`)
          .order('id')
          .range(from, to) as never,
      'read the bank lines for supply house payments',
    )
  },

  async loadMatches() {
    // The column comes with its own migration: the types learn it after the push.
    const rows = await fetchAllRows<{ id: string; mercury_transaction_id: string | null }>(
      (from, to) =>
        supabase
          .from('supply_house_payments' as never)
          .select('id, mercury_transaction_id')
          .not('mercury_transaction_id', 'is', null)
          .is('removed_at', null)
          .order('id')
          .range(from, to) as never,
      'read the supply house payments matched to the bank',
    )
    return rows.filter((r) => r.mercury_transaction_id).map((r) => ({ paymentId: r.id, transactionId: r.mercury_transaction_id as string }))
  },

  async loadSettled(transactionIds) {
    if (transactionIds.length === 0) return new Set()
    const read = (table: 'mercury_transaction_job_allocations' | 'mercury_transaction_bid_allocations' | 'mercury_transaction_supply_house_invoice_links') =>
      fetchAllRowsChunkedIn<{ mercury_transaction_id: string }, string>(
        transactionIds,
        (chunk, from, to) => supabase.from(table).select('mercury_transaction_id').in('mercury_transaction_id', chunk).order('mercury_transaction_id').range(from, to) as never,
        `read what the Tally said about the bank lines (${table})`,
      )
    const [jobs, bids, bills] = await Promise.all([read('mercury_transaction_job_allocations'), read('mercury_transaction_bid_allocations'), read('mercury_transaction_supply_house_invoice_links')])
    return new Set([...jobs, ...bids, ...bills].map((r) => r.mercury_transaction_id))
  },

  // A press changes the books once: neither is asked for twice on a lost reply.
  async match(paymentId, transactionId, fill) {
    await withSupabaseRetry(() => supabase.rpc('match_supply_house_payment' as never, { p_payment_id: paymentId, p_transaction_id: transactionId, p_fill: fill } as never) as never, 'match the payment to the bank', { maxRetries: 0 })
  },

  async unmatch(paymentId) {
    await withSupabaseRetry(() => supabase.rpc('unmatch_supply_house_payment' as never, { p_payment_id: paymentId } as never) as never, 'take the payment off its bank line', { maxRetries: 0 })
  },
}
