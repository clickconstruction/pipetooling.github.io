import { appliedByInvoiceId, openRemainder, type BillTruthInvoice, type BillTruthJob, type BillTruthPayment } from '../billing/billTruth'

/**
 * What a job's sent bills still owe — the money every lien reader counts (the owner, 2026-10-08:
 * "I can't lien work I have not done yet"). The desk's RPCs compute it as `lien_billed_open()`
 * (v2.4969); the readers that take the job from the client — the Pipeline's Deadlines runway,
 * the Dashboard's lien reminder, Put a GC on notice — call this, the same rule: once any bill
 * has gone out (status `billed` or `paid`), each `billed` one net of the payments tied to it,
 * clamped at zero, and the paid ones nothing — whatever the job's own status, since a sent bill
 * is a sent bill; a job billed as one shell (status `billed`, no bill ever sent) is price less
 * payments, as bill truth's shell row; anything else 0. Never the job's whole balance, and never
 * the part of a job its sent bills do not carry — that is work not yet billed, not a shell.
 */
export function lienBilledOpen(
  job: Pick<BillTruthJob, 'id' | 'status' | 'revenue' | 'payments_made'>,
  invoices: ReadonlyArray<Pick<BillTruthInvoice, 'id' | 'job_id' | 'status' | 'amount'>>,
  payments: ReadonlyArray<Pick<BillTruthPayment, 'invoice_id' | 'amount'>>,
): number {
  const sent = invoices.filter((i) => i.status === 'billed' || i.status === 'paid')
  let open = 0
  if (sent.length > 0) {
    const applied = appliedByInvoiceId(payments)
    for (const inv of sent) {
      if (inv.status === 'billed') open += openRemainder(inv.amount, applied.get(inv.id) ?? 0)
    }
  } else if (job.status === 'billed') {
    open = openRemainder(job.revenue, job.payments_made)
  }
  return Math.round(open * 100) / 100
}

/**
 * Put a GC on notice's rows (`list_gc_unpaid_months`) still carry the job's whole balance as
 * `open_balance`, because the run also lists jobs not billed yet (`is_billed = false`) and says
 * what they will bill. A billed job's row takes what its sent bills owe instead, from the bills
 * and payments the run already loaded; an unbilled job's row is left as it is.
 */
export function gcNoticeRowsWithBilledOpen<R extends { job_id: string; is_billed: boolean; open_balance: number }>(
  rows: ReadonlyArray<R>,
  jobById: ReadonlyMap<string, Pick<BillTruthJob, 'id' | 'status' | 'revenue' | 'payments_made'>>,
  invoices: ReadonlyArray<Pick<BillTruthInvoice, 'id' | 'job_id' | 'status' | 'amount'>>,
  payments: ReadonlyArray<Pick<BillTruthPayment, 'invoice_id' | 'amount'> & { job_id: string }>,
): R[] {
  const invByJob = new Map<string, Array<Pick<BillTruthInvoice, 'id' | 'job_id' | 'status' | 'amount'>>>()
  for (const i of invoices) {
    const list = invByJob.get(i.job_id) ?? []
    list.push(i)
    invByJob.set(i.job_id, list)
  }
  const payByJob = new Map<string, Array<Pick<BillTruthPayment, 'invoice_id' | 'amount'>>>()
  for (const p of payments) {
    const list = payByJob.get(p.job_id) ?? []
    list.push(p)
    payByJob.set(p.job_id, list)
  }
  return rows.map((r) => {
    if (!r.is_billed) return r
    const job = jobById.get(r.job_id)
    if (!job) return r
    return { ...r, open_balance: lienBilledOpen(job, invByJob.get(r.job_id) ?? [], payByJob.get(r.job_id) ?? []) }
  })
}
