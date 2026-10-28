import type { RetainageHeldInput } from './retainageHeld'
import { attributeJobPayments } from '../jobs/paymentAttribution'

/**
 * The rows AR reads for its Retainage held section (punch list #165, PR 2), folded into the
 * kernel's inputs and the facts each line shows beside the money: the job's number, name and
 * address, who holds the retainage, the job's status. Pure; `retainageHeldIo.ts` fetches.
 */

export type RetainageJobRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  status: string | null
  customer_name: string | null
  gc_customer_id: string | null
  lien_retainage_held: number | string | null
  lien_contract_ended_on: string | null
  /** The job's price, for the oldest-bill-first share of an unlinked payment; absent → oldest-first alone. */
  revenue?: number | string | null
  /** The GC's customers row, embedded through `jobs_ledger_gc_customer_id_fkey`. */
  gc?: { name: string | null } | null
}

export type RetainageApplicationRow = {
  job_id: string
  application_number: number | string
  retainage_held: number | string | null
  updated_at: string | null
  invoice_id?: string | null
}

export type RetainageInvoiceRow = {
  id: string
  job_id: string
  amount: number | string | null
  status: string | null
  sequence_order?: number | null
  /** The release mark (PR 3's migration); absent when the read could not ask for the column. */
  retainage_release?: boolean | null
}

/** One payment on the job (v2.6027): linked to a bill, or unlinked and read oldest bill first. */
export type RetainagePaymentRow = {
  id: string
  job_id: string
  invoice_id: string | null
  amount: number | string | null
  paid_on?: string | null
}

export type RetainageJobFacts = {
  jobId: string
  /** The job's number as the app shows it: the HCP number, else the Click number, else the id's first eight. */
  label: string
  name: string
  address: string
  /** Who holds the money: the GC on the job, else the job's customer, else ''. */
  heldBy: string
  status: string
  /** The job's bills so far: a draft takes the next place. */
  billCount: number
}

const text = (v: string | null | undefined): string => (v ?? '').trim()

export function retainageJobFacts(job: RetainageJobRow, billCount = 0): RetainageJobFacts {
  return {
    jobId: job.id,
    label: text(job.hcp_number) || text(job.click_number) || job.id.slice(0, 8),
    name: text(job.job_name),
    address: text(job.job_address),
    heldBy: text(job.gc?.name) || text(job.customer_name),
    status: text(job.status),
    billCount,
  }
}

/**
 * One kernel input per job row, with the job's live applications and bills attached. An
 * application or a bill whose job is not among the rows is dropped: the job is not one the
 * viewer can read. `releaseBillId` is the job's newest bill marked `retainage_release`, or null.
 */
export function assembleRetainageHeld(
  jobs: ReadonlyArray<RetainageJobRow>,
  applications: ReadonlyArray<RetainageApplicationRow>,
  invoices: ReadonlyArray<RetainageInvoiceRow>,
  payments: ReadonlyArray<RetainagePaymentRow> = [],
): { inputs: RetainageHeldInput[]; facts: Map<string, RetainageJobFacts> } {
  const appsByJob = new Map<string, RetainageHeldInput['applications'][number][]>()
  for (const a of applications) {
    const list = appsByJob.get(a.job_id) ?? []
    list.push({
      applicationNumber: Number(a.application_number) || 0,
      retainageHeld: Number(a.retainage_held) || 0,
      updatedAt: a.updated_at,
      invoiceId: a.invoice_id ?? null,
    })
    appsByJob.set(a.job_id, list)
  }
  const invoicesByJob = new Map<string, RetainageInvoiceRow[]>()
  // The release bill: the newest marked bill on the job (the highest sequence), or none.
  const releaseByJob = new Map<string, { id: string; order: number }>()
  for (const b of invoices) {
    const list = invoicesByJob.get(b.job_id) ?? []
    list.push(b)
    invoicesByJob.set(b.job_id, list)
    if (b.retainage_release === true) {
      const order = Number(b.sequence_order ?? 0)
      const prev = releaseByJob.get(b.job_id)
      if (!prev || order >= prev.order) releaseByJob.set(b.job_id, { id: b.id, order })
    }
  }
  const paymentsByJob = new Map<string, RetainagePaymentRow[]>()
  for (const p of payments) {
    const list = paymentsByJob.get(p.job_id) ?? []
    list.push(p)
    paymentsByJob.set(p.job_id, list)
  }
  const inputs: RetainageHeldInput[] = []
  const facts = new Map<string, RetainageJobFacts>()
  const seen = new Set<string>()
  for (const job of jobs) {
    if (seen.has(job.id)) continue
    seen.add(job.id)
    const jobInvoices = invoicesByJob.get(job.id) ?? []
    // What each bill has been paid, by the Bill tab's rule: linked payments in full, unlinked money oldest bill first.
    const applied = attributeJobPayments(
      jobInvoices.map((b) => ({ id: b.id, amount: b.amount, status: b.status, sequence_order: b.sequence_order ?? null })),
      paymentsByJob.get(job.id) ?? [],
      job.revenue ?? null,
    ).byBill
    const bills = jobInvoices.map((b) => ({ id: b.id, amount: Number(b.amount) || 0, status: b.status ?? '', paid: applied.get(b.id)?.applied ?? 0 }))
    inputs.push({
      jobId: job.id,
      applications: appsByJob.get(job.id) ?? [],
      typedHeld: job.lien_retainage_held == null ? null : Number(job.lien_retainage_held),
      finishedOn: job.lien_contract_ended_on ? String(job.lien_contract_ended_on).slice(0, 10) : null,
      bills,
      releaseBillId: releaseByJob.get(job.id)?.id ?? null,
    })
    facts.set(job.id, retainageJobFacts(job, bills.length))
  }
  return { inputs, facts }
}
