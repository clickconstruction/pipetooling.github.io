import type { JobWithDetails } from '../../types/jobWithDetails'
import type { PhysicalInvoiceDocument } from '../physicalInvoiceDocument'
import { buildPhysicalInvoiceDocumentForBilledInvoice } from '../physicalInvoiceDocumentForBilledInvoice'
import { enclosedInvoiceDocument, payPageDescription, stripeBillNumber } from './noticeInvoiceEnclosure'
import { fallbackInvoiceNumber } from '../jobsDocuments/demandLetter'
import type { StripeInvoiceFacts } from '../stripeInvoiceFacts'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatUsdNoCents } from './jobFormatting'
import { attributeJobPayments } from './paymentAttribution'

/**
 * The bills behind a lien claim (v2.4969, the owner: "I can't lien work I have not done yet").
 * The desk's money is what the job's sent bills still owe — the bill-truth rule the Bill tab
 * uses, `lien_billed_open()` in SQL — never the job's price. These are the lines the Months card
 * lists under the claim so the reader sees it add up: each sent bill with what was billed, paid
 * and still owed, then the part of the job no sent bill carries, which is not claimed until it is.
 */
export type LienClaimBill = {
  invoiceId: string
  /** "#922-2609241309" — Stripe's number when the office has it, else the app's. */
  number: string
  /** The bill's line as the pay page reads it — "Rough In"; '' when the bill has none. */
  what: string
  /** 'YYYY-MM-DD' the bill went out; '' when the row carries no day. */
  sentYmd: string
  /** The bill lives in Stripe: a payment page, and a code on the notice's pay page. */
  stripe: boolean
  /** Stripe's due day, 'YYYY-MM-DD'; '' when unknown. */
  dueYmd: string
  billed: number
  /** What this bill has been paid under the payment rule (v2.5093): its linked payments in full and its share of the job's unlinked money, oldest bill first. */
  paid: number
  /** max(0, billed − paid) — the part of the claim this bill is. */
  owed: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Every sent bill on the job, oldest first, paid or not — a bill marked paid (status `paid`) stays on
 * the list owing nothing, so the reader sees the money that came in and the owed column adds up to the claim.
 */
export function lienClaimBills(job: JobWithDetails, facts?: Readonly<Record<string, Pick<StripeInvoiceFacts, 'invoiceNumber' | 'dueYmd'>>>): LienClaimBill[] {
  // The one payment rule (v2.5093), as `lienBilledOpen` and `lien_billed_open()` read it: linked money is its bill's, and the job's
  // unlinked money pays the part on no sent bill first, then the sent bills oldest first.
  const byBill = attributeJobPayments(job.invoices ?? [], job.payments ?? [], job.revenue).byBill
  const billed = (job.invoices ?? []).filter((i) => i.status === 'billed' || i.status === 'paid').slice().sort((a, b) => a.sequence_order - b.sequence_order)
  const out: LienClaimBill[] = []
  // A job billed as one shell (status billed, no invoice rows): the job is the bill, price less payments — bill truth's shell row, `lien_billed_open()`'s second arm.
  if (billed.length === 0 && job.status === 'billed') {
    const amount = round2(Number(job.revenue ?? 0))
    const paid = round2(Number(job.payments_made ?? 0))
    const hcp = (job.hcp_number ?? '').trim()
    return [{ invoiceId: `job:${job.id}`, number: hcp ? `#${hcp}` : '#1', what: 'billed as one bill', sentYmd: '', stripe: false, dueYmd: '', billed: amount, paid, owed: Math.max(0, round2(amount - paid)) }]
  }
  for (const inv of billed) {
    const amount = round2(Number(inv.amount ?? 0))
    // A bill marked paid is settled whatever payment rows it carries (bill truth); a billed one nets what the rule says it was paid.
    const applied = byBill.get(inv.id)?.applied ?? 0
    const paid = inv.status === 'paid' ? Math.max(amount, round2(applied)) : round2(applied)
    let doc: PhysicalInvoiceDocument | null = null
    try {
      doc = buildPhysicalInvoiceDocumentForBilledInvoice(job, inv)
    } catch {
      doc = null
    }
    const fact = facts?.[inv.id]
    const shown = doc ? enclosedInvoiceDocument(doc, inv, job.hcp_number, fact) : null
    const number = shown ? shown.invoiceNumberDisplay : stripeBillNumber(fact) || fallbackInvoiceNumber(inv, job.hcp_number)
    const sent = calendarYmdInAppTzFromIso((inv.billed_at ?? inv.sent_to_customer_at ?? '') as string)
    out.push({
      invoiceId: inv.id,
      number,
      what: shown ? payPageDescription(shown) : '',
      sentYmd: /^\d{4}-\d{2}-\d{2}$/.test(sent) ? sent : '',
      stripe: Boolean((inv.stripe_invoice_id ?? '').trim()),
      dueYmd: fact?.dueYmd ?? '',
      billed: amount,
      paid,
      owed: Math.max(0, round2(amount - paid)),
    })
  }
  return out
}

/** What the sent bills still owe — the claim's base, the same sum `lien_billed_open()` returns. */
export function lienClaimBillsOwed(bills: ReadonlyArray<Pick<LienClaimBill, 'owed'>>): number {
  return round2(bills.reduce((s, b) => s + b.owed, 0))
}

/**
 * The part of the job no sent bill carries: price minus payments minus what the sent bills still
 * owe, never below zero. Work not yet billed, or a bill still at Ready to Bill — not claimed until it is billed.
 */
export function lienUnbilled(job: { revenue: number | null | undefined; payments_made: number | null | undefined }, billedOpen: number): number {
  return Math.max(0, round2(Number(job.revenue ?? 0) - Number(job.payments_made ?? 0) - billedOpen))
}

/** The pane's Months row: "nothing billed" / "2 bills" / "1 of 2 bills" / "2 bills paid" — how many sent bills still owe, of how many went out. */
export function lienBillsCountWords(owing: number, sent: number = owing): string {
  const bills = (n: number) => `${n} ${n === 1 ? 'bill' : 'bills'}`
  if (sent === 0) return 'nothing billed'
  if (owing === 0) return `${bills(sent)} paid`
  return owing === sent ? bills(owing) : `${owing} of ${bills(sent)}`
}

/** The amber line under the bills: "$1,000 of the job's $5,000 · not claimed until it is billed". */
export function lienUnbilledWords(unbilled: number, revenue: number | null | undefined): string {
  return `${formatUsdNoCents(unbilled)} of the job’s ${formatUsdNoCents(Number(revenue ?? 0))} · not claimed until it is billed`
}

/** The fifth gate's sentence when the sent bills owe nothing and money is still on the job. */
export function lienNothingBilledWords(sentBills: number): string {
  return sentBills === 0
    ? 'Nothing is billed on this job yet. A notice claims what is billed. Bill the work, then come back. The claim fills in by itself.'
    : 'The sent bills are paid. What is left on the job is not billed yet. Bill it, then come back. The claim fills in by itself.'
}

export const LIEN_BILL_FROM_HERE_LABEL = 'Bill it from here ›'
export const LIEN_BILL_FROM_HERE_HINT = 'Opens Bill Customer over the desk. Bill only work that is done. The notice claims what you bill. When the bill goes, the desk re-reads and the claim fills in.'
