/**
 * The finish-later list's reads and its one write: the payments across every house that still need how they were
 * paid, how many there are (for Accounts payable and Needs you), and saving how one was sent.
 *
 * The screens take a `SupplyFinishIo`, so a test hands them a fake.
 */

import { supabase } from '../../supabase'
import { withSupabaseRetry } from '../../../utils/errorHandling'
import type { PaymentToFinish } from './supplyPaymentsFinish'

export type HowSentPatch = { method: string; method_ref: string | null; paid_on: string; receipt_link: string | null }

export interface SupplyFinishIo {
  /** Every live payment with no method that is not from before and sent money, with its house and its bills. */
  loadToFinish(): Promise<PaymentToFinish[]>
  /** How many there are. */
  countToFinish(): Promise<number>
  /** Says how a payment was sent. */
  saveHowSent(paymentId: string, patch: HowSentPatch): Promise<void>
}

type Row = {
  id: string
  supply_house_id: string
  paid_on: string
  amount: number | string
  method: string | null
  method_ref: string | null
  receipt_link: string | null
  source: string
  removed_at: string | null
  created_by_name: string | null
  supply_houses: { name: string | null } | null
  supply_house_payment_lines: { supply_house_invoices: { invoice_number: string | null } | null }[] | null
}

export const supabaseSupplyFinishIo: SupplyFinishIo = {
  async loadToFinish() {
    // The tables are not in the generated types until the regeneration after the push.
    const rows = ((await withSupabaseRetry(
      () =>
        supabase
          .from('supply_house_payments' as never)
          .select('id, supply_house_id, paid_on, amount, method, method_ref, receipt_link, source, removed_at, created_by_name, supply_houses(name), supply_house_payment_lines(supply_house_invoices(invoice_number))')
          .is('method', null)
          .is('removed_at', null)
          .neq('source', 'before')
          .gt('amount', 0)
          .order('paid_on', { ascending: true })
          .limit(500) as never,
      'read the payments that need how they were paid',
    )) ?? []) as Row[]
    return rows.map(({ supply_houses, supply_house_payment_lines, ...p }) => ({
      ...p,
      amount: Number(p.amount),
      houseName: supply_houses?.name ?? '',
      billNumbers: [...new Set((supply_house_payment_lines ?? []).map((l) => l.supply_house_invoices?.invoice_number ?? '').filter(Boolean))],
    }))
  },

  async countToFinish() {
    const { count, error } = await supabase
      .from('supply_house_payments' as never)
      .select('id', { count: 'exact', head: true })
      .is('method', null)
      .is('removed_at', null)
      .neq('source', 'before')
      .gt('amount', 0)
    if (error) throw error
    return count ?? 0
  },

  async saveHowSent(paymentId, patch) {
    await withSupabaseRetry(
      () =>
        supabase
          .from('supply_house_payments' as never)
          .update(patch as never)
          .eq('id', paymentId)
          .is('removed_at', null)
          .select('id') as never,
      'save how the payment was sent',
    )
  },
}
