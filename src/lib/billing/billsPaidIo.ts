/**
 * Bills sent, By day paid (punch list #422, PR 3): the reads. The rules are `billsPaidDays.ts`.
 *
 * Nothing is written. The view reads the payment rows whose day falls in a span (`jobs_ledger_payments` by
 * `paid_on`, which the page's four roles read under the table's own policy), then what makes a payment readable:
 * its bill, its job, the number the bill carries and the day the bill first went. The payments throw their reason
 * when they do not read, so the screen says so and offers Retry. The reads after them are best effort: a payment
 * still draws with what its own row says.
 *
 * `readStripePayout` asks Stripe for the next payout through `get-stripe-payouts`, the edge function the
 * Dashboard's Money in bar asks, which answers the same four roles. Best effort: no answer, no tile.
 */
import { supabase } from '../supabase'
import { chunkIds } from '../supabasePaging'
import { billNumberFromTitle } from './billsSent'
import type { BillsPaidBill, BillsPaidInput, BillsPaidJob, BillsPaidPayment } from './billsPaidDays'

/** Ids per `in.(…)` list: a longer list makes an address some networks refuse. */
const IN_CHUNK = 80
/** Payments read in one page. A month holds far fewer; a full page says so on the screen. */
export const BILLS_PAID_PAGE = 1000

const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const numberOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null)

type Rows = Array<Record<string, unknown>>

/** A list read by ids that answers what it could: a chunk that fails adds nothing, and the rest still draw. */
async function inChunks(ids: string[], read: (chunk: string[]) => PromiseLike<{ data: unknown; error: unknown }>): Promise<Rows> {
  if (ids.length === 0) return []
  const parts = await Promise.all(
    chunkIds(ids, IN_CHUNK).map(async (chunk) => {
      try {
        const { data, error } = await read(chunk)
        return error ? [] : ((data ?? []) as Rows)
      } catch {
        return []
      }
    }),
  )
  return parts.flat()
}

export interface BillsPaidRead extends BillsPaidInput {
  /** True when the span held a full page of payments: older ones in it were not read. */
  more: boolean
}

/**
 * The payments whose day is from `from` to `to`, both YYYY-MM-DD, with their bills and jobs. Throws when the
 * payments themselves cannot be read.
 */
export async function readBillsPaid(span: { from: string; to: string }): Promise<BillsPaidRead> {
  const { data, error } = await supabase
    .from('jobs_ledger_payments')
    .select('id, job_id, invoice_id, amount, paid_on, created_at, payment_type, note, reference_number, mercury_transaction_id, stripe_credit_note_id')
    .gte('paid_on', span.from)
    .lte('paid_on', span.to)
    .order('paid_on', { ascending: false })
    .order('id')
    .limit(BILLS_PAID_PAGE)
  if (error) throw error
  const payments: BillsPaidPayment[] = ((data ?? []) as unknown as Rows).flatMap((r) => {
    const amount = numberOrNull(r.amount)
    if (!text(r.id) || amount == null) return []
    return [
      {
        id: text(r.id),
        billId: text(r.invoice_id) || null,
        jobId: text(r.job_id) || null,
        amount,
        paidOn: text(r.paid_on) || null,
        createdAtIso: text(r.created_at) || null,
        paymentType: text(r.payment_type) || null,
        note: text(r.note) || null,
        referenceNumber: text(r.reference_number) || null,
        bankTransactionId: text(r.mercury_transaction_id) || null,
        stripeCreditNoteId: text(r.stripe_credit_note_id) || null,
      },
    ]
  })

  const billIds = [...new Set(payments.map((p) => p.billId).filter((id): id is string => !!id))]
  const [billRows, copyRows] = await Promise.all([
    inChunks(billIds, (chunk) => supabase.from('jobs_ledger_invoices').select('id, job_id, amount, status, billed_at, created_at, sent_to_customer_at, stripe_invoice_id, stripe_invoice_status, stripe_mode, external_send_channel').in('id', chunk)),
    // Each bill's sends: the number it carries is in a copy's title, and the oldest copy is the day it first went.
    inChunks(billIds, (chunk) => supabase.from('sent_documents').select('source_id, title, sent_at, kind, recipient_name').eq('source_table', 'jobs_ledger_invoices').in('source_id', chunk).like('kind', 'bill%').order('sent_at', { ascending: true }).limit(BILLS_PAID_PAGE)),
  ])
  const bills = new Map<string, BillsPaidBill>()
  for (const r of billRows) {
    if (!text(r.id)) continue
    bills.set(text(r.id), {
      id: text(r.id),
      jobId: text(r.job_id) || null,
      amount: numberOrNull(r.amount),
      status: text(r.status),
      stripeInvoiceId: text(r.stripe_invoice_id) || null,
      stripeInvoiceStatus: text(r.stripe_invoice_status) || null,
      externalSendChannel: text(r.external_send_channel) || null,
      stripeMode: text(r.stripe_mode) || null,
      sentAtIso: text(r.sent_to_customer_at) || null,
      billedAtIso: text(r.billed_at) || text(r.created_at) || null,
    })
  }
  const numbers = new Map<string, string>()
  const firstSent = new Map<string, string>()
  const sentTo = new Map<string, string>()
  for (const r of copyRows) {
    const billId = text(r.source_id)
    // A copy to the copy list and a record made by hand are not the bill's own send.
    if (!billId || text(r.kind) === 'bill_copy') continue
    const number = billNumberFromTitle(text(r.title))
    if (number && !numbers.has(billId)) numbers.set(billId, number)
    if (text(r.kind) !== 'bill_by_hand' && text(r.sent_at) && !firstSent.has(billId)) firstSent.set(billId, text(r.sent_at))
    // Who the bill went to, from its first send that names one: the name By day sent draws on the same bill.
    if (text(r.recipient_name).trim() && !sentTo.has(billId)) sentTo.set(billId, text(r.recipient_name).trim())
  }

  const jobIds = [...new Set([...payments.map((p) => p.jobId), ...[...bills.values()].map((b) => b.jobId)].filter((id): id is string => !!id))]
  const jobRows = await inChunks(jobIds, (chunk) => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, customer_name').in('id', chunk))
  const jobs = new Map<string, BillsPaidJob>()
  for (const r of jobRows) {
    if (!text(r.id)) continue
    jobs.set(text(r.id), { id: text(r.id), hcp_number: text(r.hcp_number) || null, click_number: text(r.click_number) || null, job_name: text(r.job_name) || null, customer_name: text(r.customer_name) || null })
  }
  return { payments, bills, jobs, numbers, firstSent, sentTo, more: payments.length >= BILLS_PAID_PAGE }
}

/** Stripe's next payout to the bank: what it adds to, after Stripe's fee, and the day it arrives. */
export interface BillsPaidPayout {
  usd: number
  arrivalYmd: string | null
}

/** The next payout, or null when Stripe has none on its way, the caller may not ask, or the answer did not come. */
export async function readStripePayout(): Promise<BillsPaidPayout | null> {
  try {
    const { data, error } = await supabase.functions.invoke('get-stripe-payouts', { body: {} })
    if (error) return null
    const b = (data ?? {}) as { error?: unknown; nextPayout?: { usd?: unknown; arrivalYmd?: unknown } | null }
    const p = b.nextPayout
    if ((typeof b.error === 'string' && b.error) || !p || typeof p.usd !== 'number' || !(p.usd > 0)) return null
    return { usd: p.usd, arrivalYmd: typeof p.arrivalYmd === 'string' ? p.arrivalYmd : null }
  } catch {
    return null
  }
}
