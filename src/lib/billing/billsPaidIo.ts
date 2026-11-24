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
 * Dashboard's Money in bar asks, which answers the same four roles. Best effort, and it says which of three answers it got.
 *
 * `readDepositsOnNoBill` reads the bank deposits that landed and are on no bill yet, through the Money in bar's
 * own reads and rule (`moneyInDepositsLoad.ts`, `moneyInDeposits.ts`). Best effort: it answers *unread* and
 * never throws, so a bank that does not read never hides a day and is never drawn as no deposits.
 */
import { supabase } from '../supabase'
import { chunkIds } from '../supabasePaging'
import { billNumberFromTitle } from './billsSent'
import { ymdAddDays } from '../../utils/dateUtils'
import { fetchBankPaymentsSortingConfigFromAppSettings } from '../bankingSortingConfig'
import { MATCH_LOOKBACK_DAYS, moneyInDepositsFromRows, moneyInDepositsSince, moneyInUnlinkedFromRows, returnedPaymentIdsOfCases } from '../moneyInDeposits'
import { moneyInDepositFilterOf, readOpenReturnCaseRows, readPendingDepositRows, readPostedDepositRows, readUnlinkedPaymentRows } from '../moneyInDepositsLoad'
import { billsPaidNoBillAnswer, billsPaidPayoutOf, type BillsPaidBill, type BillsPaidInput, type BillsPaidJob, type BillsPaidNoBillAnswer, type BillsPaidPayment, type BillsPaidPayoutAnswer } from './billsPaidDays'

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

/** What Stripe said of its next payout, in the three answers `billsPaidPayoutOf` tells apart. It never throws. */
export async function readStripePayout(): Promise<BillsPaidPayoutAnswer> {
  try {
    const { data, error } = await supabase.functions.invoke('get-stripe-payouts', { body: {} })
    return billsPaidPayoutOf(data, !!error)
  } catch {
    return billsPaidPayoutOf(null, true)
  }
}

/**
 * The bank deposits that landed from `span.from` on and are on no bill yet, by day. It never throws.
 *
 * The rows are the ones the Dashboard's Money in bar reads, from no later than where that bar starts, so a day
 * both screens show is decided over the same deposits. Two reads must answer: the posted deposits, and the
 * typed-in payments that say which deposit a payment already carries. Without either the answer is *unread*,
 * since a count from half of them could name a deposit whose money is already in the day. The pending deposits
 * and the open return cases only sharpen which payment carries which deposit, so each fails soft.
 *
 * The org's deposit setting must read too. It holds the filter and the day Accounts Receivable starts its list,
 * and without them a count would name deposits that list hides, so the answer is *unread*.
 */
export async function readDepositsOnNoBill(span: { from: string }, todayYmd: string): Promise<BillsPaidNoBillAnswer> {
  try {
    const sorting = await fetchBankPaymentsSortingConfigFromAppSettings()
    if (sorting.outcome === 'error') return { state: 'unread' }
    const cfg = sorting.config
    const moneyInSince = moneyInDepositsSince(todayYmd)
    const since = span.from < moneyInSince ? span.from : moneyInSince
    const [posted, unlinked, pending, cases] = await Promise.all([
      readPostedDepositRows(supabase, cfg, since),
      readUnlinkedPaymentRows(supabase, ymdAddDays(since, -MATCH_LOOKBACK_DAYS)),
      readPendingDepositRows(supabase).catch(() => []),
      readOpenReturnCaseRows(supabase).catch(() => []),
    ])
    return billsPaidNoBillAnswer({
      deposits: moneyInDepositsFromRows(pending, posted, moneyInDepositFilterOf(cfg)),
      // This view names no payer on the line, so the typed-in payments carry none.
      unlinked: moneyInUnlinkedFromRows(unlinked, () => ''),
      returnedPaymentIds: returnedPaymentIdsOfCases(cases),
      todayYmd,
    })
  } catch {
    return { state: 'unread' }
  }
}
