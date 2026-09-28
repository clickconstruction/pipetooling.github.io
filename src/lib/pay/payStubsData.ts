/** People → Payroll: every pay report and its three kinds of child rows, as the page holds them. */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PayStubRow } from '../../components/people/PeoplePayStubsTab'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { PayStubAdditionalLineRow, PayStubDeductionRow } from '../payStubDeductions'
import type { PayStubPaymentRow } from '../payStubPayments'
import type { PayStubLineMaps } from './recordPayStubPayment'

/** What one `loadPayStubs` read: the stubs, newest first, and their lines by stub id. */
export type PayStubsLoadSnapshot = PayStubLineMaps & { stubs: PayStubRow[] }

/** Child rows are read `.in('pay_stub_id', …)` this many stubs at a time, to keep the URL short. */
export const PAY_STUB_CHILD_ROWS_CHUNK = 200

export function chunkPayStubIds(ids: string[], size = PAY_STUB_CHILD_ROWS_CHUNK): string[][] {
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size))
  return chunks
}

/** Appends each row to its stub's list in `into`, keeping the order read. */
export function groupByPayStubId<T extends { pay_stub_id: string }>(rows: T[], into: Record<string, T[]> = {}): Record<string, T[]> {
  for (const r of rows) {
    const list = into[r.pay_stub_id] ?? []
    list.push(r)
    into[r.pay_stub_id] = list
  }
  return into
}

/** The map without one stub's entry — a copy; the map handed in is left as it was. */
export function withoutPayStub<T>(byStubId: Record<string, T>, stubId: string): Record<string, T> {
  const next = { ...byStubId }
  delete next[stubId]
  return next
}

/** Every pay report, newest first. Throws what `withSupabaseRetry` throws. */
export async function fetchPayStubRows(supabase: SupabaseClient): Promise<PayStubRow[]> {
  const data = await withSupabaseRetry(
    async () =>
      await supabase
        .from('pay_stubs')
        .select('id, person_name, period_start, period_end, hours_total, gross_pay, created_at, paid_at, paid_by, paid_note')
        .order('created_at', { ascending: false }),
    'load pay reports',
  )
  return (data ?? []) as PayStubRow[]
}

/** The payments (oldest first), deductions and additional lines of the given stubs, by stub id. No ids, no reads. */
export async function fetchPayStubLineMaps(supabase: SupabaseClient, stubIds: string[]): Promise<PayStubLineMaps> {
  const paymentsByStubId: Record<string, PayStubPaymentRow[]> = {}
  const deductionsByStubId: Record<string, PayStubDeductionRow[]> = {}
  const additionalByStubId: Record<string, PayStubAdditionalLineRow[]> = {}
  for (const chunk of chunkPayStubIds(stubIds)) {
    const [payments, deductions, additional] = await Promise.all([
      withSupabaseRetry(
        async () =>
          await supabase
            .from('pay_stub_payments')
            .select('id, pay_stub_id, amount, paid_at, memo, created_at, created_by')
            .in('pay_stub_id', chunk)
            .order('paid_at', { ascending: true }),
        'load pay report payments',
      ),
      withSupabaseRetry(
        async () =>
          await supabase
            .from('pay_stub_deductions')
            .select('id, pay_stub_id, amount, source, person_offset_id, description, created_at, created_by')
            .in('pay_stub_id', chunk)
            .order('created_at', { ascending: true }),
        'load pay report deductions',
      ),
      withSupabaseRetry(
        async () =>
          await supabase
            .from('pay_stub_additional_lines')
            .select('id, pay_stub_id, description, quantity, rate, line_total, created_at, created_by, source_clock_session_id')
            .in('pay_stub_id', chunk)
            .order('created_at', { ascending: true }),
        'load pay report additional lines',
      ),
    ])
    groupByPayStubId((payments ?? []) as PayStubPaymentRow[], paymentsByStubId)
    groupByPayStubId((deductions ?? []) as PayStubDeductionRow[], deductionsByStubId)
    groupByPayStubId((additional ?? []) as PayStubAdditionalLineRow[], additionalByStubId)
  }
  return { paymentsByStubId, deductionsByStubId, additionalByStubId }
}
