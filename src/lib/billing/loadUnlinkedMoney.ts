import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRowsChunkedIn } from '../supabasePaging'

/**
 * What the payment rule needs beyond a read of the open bills and their linked payments (v2.5006,
 * shared v2.5010; the owner's call of 2026-10-09): a payment put on the job with no bill picked
 * pays the job's bills oldest first, so a read that nets bills must also hold
 *
 * - the unlinked payments of every job with a billed bill,
 * - the paid bills of each job that has unlinked money — the rule walks every sent bill — and
 * - those paid bills' own linked payments, when the caller's read holds only the open bills'
 *   (`withPaidBillPayments`); without them a paid bill would look unpaid and take the money.
 *
 * A job with no unlinked money reads exactly as before, so these small reads are all a
 * linked-only read needs to follow the rule (`appliedByInvoiceUnderRule` in bill truth). Rows the
 * filters let through by mistake are dropped here too (`!invoice_id`, `status === 'paid'`).
 */
export async function loadUnlinkedMoney<
  P extends { job_id: string; invoice_id: string | null; amount: number | null },
  I extends { id: string; job_id: string; status: string | null },
>(
  billedJobIds: readonly string[],
  opts: { paymentColumns: string; invoiceColumns: string; label: string; withPaidBillPayments?: boolean },
): Promise<{ unlinkedPayments: P[]; paidBills: I[]; paidBillPayments: P[] }> {
  const jobIds = [...new Set(billedJobIds)]
  if (jobIds.length === 0) return { unlinkedPayments: [], paidBills: [], paidBillPayments: [] }
  const unlinkedPayments = (
    (await fetchAllRowsChunkedIn(
      jobIds,
      async (chunk, from, to) => ({
        data: (await withSupabaseRetry(
          async () => supabase.from('jobs_ledger_payments').select(opts.paymentColumns).is('invoice_id', null).in('job_id', chunk).order('id').range(from, to),
          `${opts.label}: unlinked payments`,
        )) as unknown as P[] | null,
        error: null,
      }),
      `${opts.label}: unlinked payments`,
    )) as P[]
  ).filter((p) => !p.invoice_id)
  const unlinkedJobIds = [...new Set(unlinkedPayments.filter((p) => Number(p.amount ?? 0) > 0).map((p) => p.job_id))]
  if (unlinkedJobIds.length === 0) return { unlinkedPayments, paidBills: [], paidBillPayments: [] }
  const paidBills = (
    (await fetchAllRowsChunkedIn(
      unlinkedJobIds,
      async (chunk, from, to) => ({
        data: (await withSupabaseRetry(
          async () => supabase.from('jobs_ledger_invoices').select(opts.invoiceColumns).eq('status', 'paid').in('job_id', chunk).order('id').range(from, to),
          `${opts.label}: paid bills`,
        )) as unknown as I[] | null,
        error: null,
      }),
      `${opts.label}: paid bills`,
    )) as I[]
  ).filter((i) => i.status === 'paid')
  const paidBillIds = paidBills.map((b) => b.id)
  if (!opts.withPaidBillPayments || paidBillIds.length === 0) return { unlinkedPayments, paidBills, paidBillPayments: [] }
  const paidBillPayments = (await fetchAllRowsChunkedIn(
    paidBillIds,
    async (chunk, from, to) => ({
      data: (await withSupabaseRetry(
        async () => supabase.from('jobs_ledger_payments').select(opts.paymentColumns).in('invoice_id', chunk).order('id').range(from, to),
        `${opts.label}: paid bills' payments`,
      )) as unknown as P[] | null,
      error: null,
    }),
    `${opts.label}: paid bills' payments`,
  )) as P[]
  return { unlinkedPayments, paidBills, paidBillPayments }
}
