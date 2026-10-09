/**
 * AIA G702-G703 (v2.5032, the owner's call of 2026-10-09): the bill an application became. The
 * office picks it, on the application's line in the window's history or in Bill Customer
 * (`job_pay_applications.invoice_id`); an amount-and-date match only pre-fills the pick. Under a
 * tied application the history reads the bill's payments the way the job window's bills do: a
 * payment linked to the bill, then unlinked money oldest bill first (`attributeJobPayments`), with
 * the same states (`invoiceLedgerState`) and the newest payment's day. Pure.
 */
import { attributeJobPayments, type AttributionPayment } from './jobs/paymentAttribution'
import { invoiceLedgerState } from './jobs/invoiceLedgerRow'
import { daysBetweenYmd, formatYmdMonthDay } from './jobs/billedExpectedPay'
import { billSentYmd } from './jobs/billsAndPayments'
import { formatAiaMoney } from './aiaG702G703Preview'
import { fallbackInvoiceNumber } from './jobsDocuments/demandLetter'
import type { SavedPayApplication } from './aiaPayApplications'

/** The roles `job_pay_applications`' policies let write: dev, `is_assistant()` (assistant or controller), master_technician. */
export const PAY_APPLICATION_WRITE_ROLES: readonly string[] = ['dev', 'master_technician', 'assistant', 'controller']

export function canTiePayApplication(role: string | null | undefined): boolean {
  return PAY_APPLICATION_WRITE_ROLES.includes(role ?? '')
}

/** A bill on the job, as the job's own read carries it. */
export type AiaJobBill = {
  id: string
  amount: number | string | null
  status: string | null
  sequence_order: number
  billed_at?: string | null
  sent_to_customer_at?: string | null
}

/** What the paid line and the pick read: the job's bills and payments, its total for the attribution, and its number for a bill's own. */
export type AiaBillsOnJob = {
  bills: ReadonlyArray<AiaJobBill>
  payments: ReadonlyArray<AttributionPayment>
  revenue?: number | string | null
  hcp?: string | null
}

export type AiaBillOption = { id: string; label: string; amount: number; sentYmd: string | null }

type AppTie = Pick<SavedPayApplication, 'id' | 'invoiceId' | 'deletedAt'>

const money = (n: number): string => formatAiaMoney(n)
const amountOf = (b: AiaJobBill): number => Number(b.amount) || 0

/**
 * The bills an application may be tied to: every bill on the job but one another live
 * application already holds, oldest first. A bill keeps its place for the application that holds it.
 */
export function aiaBillOptions(onJob: AiaBillsOnJob, apps: ReadonlyArray<AppTie>, appId: string | null): AiaBillOption[] {
  const held = new Set(apps.filter((a) => a.id !== appId && !a.deletedAt && a.invoiceId).map((a) => a.invoiceId as string))
  return [...onJob.bills]
    .filter((b) => !held.has(b.id))
    .sort((a, b) => a.sequence_order - b.sequence_order)
    .map((b) => {
      const sentYmd = billSentYmd({ sent_to_customer_at: b.sent_to_customer_at ?? null, billed_at: b.billed_at ?? null })
      return {
        id: b.id,
        amount: amountOf(b),
        sentYmd,
        label: `${fallbackInvoiceNumber(b, onJob.hcp)} · ${money(amountOf(b))} · ${sentYmd ? `sent ${formatYmdMonthDay(sentYmd)}` : 'not sent yet'}`,
      }
    })
}

const sameCents = (a: number, b: number): boolean => Math.abs(a - b) < 0.005

/** The one nearest candidate by day, or null when two are as near, or no day can be compared. */
function nearestByDay<T>(candidates: ReadonlyArray<T>, dayOf: (c: T) => string | null, toYmd: string | null): T | null {
  if (candidates.length === 1) return candidates[0] ?? null
  if (!toYmd || candidates.length === 0) return null
  const ranked = candidates
    .map((c) => {
      const day = dayOf(c)
      const d = day ? daysBetweenYmd(day, toYmd) : null
      return { c, d: d == null ? Number.POSITIVE_INFINITY : Math.abs(d) }
    })
    .sort((a, b) => a.d - b.d)
  const [first, second] = ranked
  if (!first || first.d === Number.POSITIVE_INFINITY) return null
  if (second && second.d === first.d) return null
  return first.c
}

/**
 * The bill the match pre-fills on an application's line: the one whose amount is the
 * application's payment due to the cent; when several are, the one sent nearest the
 * application's date (else its period). None when nothing matches, or two are as near.
 */
export function suggestAiaBill(app: Pick<SavedPayApplication, 'currentPaymentDue' | 'applicationDate' | 'periodTo'>, options: ReadonlyArray<AiaBillOption>): string | null {
  const candidates = options.filter((o) => sameCents(o.amount, app.currentPaymentDue))
  return nearestByDay(candidates, (o) => o.sentYmd, app.applicationDate ?? app.periodTo)?.id ?? null
}

/**
 * The application Bill Customer pre-picks for the bill it is about to send: a live, untied
 * application whose payment due is the bill's amount to the cent; when several are, the one dated
 * nearest today. None when nothing matches, or two are as near.
 */
export function suggestAiaApplication(apps: ReadonlyArray<SavedPayApplication>, billAmount: number, todayYmd: string): string | null {
  const candidates = apps.filter((a) => !a.deletedAt && !a.invoiceId && sameCents(a.currentPaymentDue, billAmount))
  return nearestByDay(candidates, (a) => a.applicationDate ?? a.periodTo, todayYmd)?.id ?? null
}

/** The live applications Bill Customer offers: untied ones, newest first. */
export function aiaApplicationsToTie(apps: ReadonlyArray<SavedPayApplication>): SavedPayApplication[] {
  return apps.filter((a) => !a.deletedAt && !a.invoiceId).sort((a, b) => b.applicationNumber - a.applicationNumber)
}

/** "No. 3 · $13,588.20 due · period to Aug 31", as Bill Customer lists an application. */
export function aiaApplicationLabel(app: Pick<SavedPayApplication, 'applicationNumber' | 'currentPaymentDue' | 'periodTo'>): string {
  return [`No. ${app.applicationNumber}`, `${money(app.currentPaymentDue)} due`, app.periodTo ? `period to ${formatYmdMonthDay(app.periodTo)}` : ''].filter(Boolean).join(' · ')
}

export type AiaPaidLine = { kind: 'untied' | 'missing' | 'draft' | 'open' | 'partial' | 'paid' | 'marked'; words: string }

/**
 * The line under an application in the history. Untied: "Bill not yet tied". Tied: the bill's
 * own state and money as the job window reads it, like "Paid $13,588.20 · Aug 22".
 */
export function aiaPaidLine(app: Pick<SavedPayApplication, 'invoiceId'>, onJob: AiaBillsOnJob): AiaPaidLine {
  if (!app.invoiceId) return { kind: 'untied', words: 'Bill not yet tied' }
  const bill = onJob.bills.find((b) => b.id === app.invoiceId)
  if (!bill) return { kind: 'missing', words: 'The tied bill is not on this job' }
  const amount = amountOf(bill)
  const slices = attributeJobPayments(onJob.bills, onJob.payments, onJob.revenue).byBill.get(bill.id)?.slices ?? []
  const paid = slices.reduce((s, x) => s + x.amount, 0)
  const state = invoiceLedgerState(bill.status, amount, paid)
  if (state === 'draft' || state == null) return { kind: 'draft', words: `Bill ${money(amount)} not sent yet` }
  const paidYmd = slices.reduce<string | null>((m, x) => {
    const day = (x.payment.paid_on ?? '').slice(0, 10)
    return day && (!m || day > m) ? day : m
  }, null)
  const on = paidYmd ? ` · ${formatYmdMonthDay(paidYmd)}` : ''
  if (state === 'paid') {
    if (paid <= 0.005) return { kind: 'marked', words: `${money(amount)} marked paid · no payment on record` }
    return { kind: 'paid', words: `Paid ${money(paid)}${on}` }
  }
  if (paid > 0.005) return { kind: 'partial', words: `Paid ${money(paid)} of ${money(amount)}${on}` }
  return { kind: 'open', words: `Billed ${money(amount)} · nothing paid yet` }
}
