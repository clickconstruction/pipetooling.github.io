/**
 * How a lien waiver's amount is figured (v2.4296) — the math the Release of Lien window shows
 * under **Amount ($)** when the amount is not simply the bill, so nobody has to ask why bill #1's
 * $26,800 became $9,022.49. Pure: the window passes the job (its bills and payments) and the
 * job's waiver rows; nothing here reads or writes.
 *
 * Three readings, one per kind of form (the same rules `lienWaiverPrefillAmount` fills the box with):
 * - **Conditional** (progress or final) waives the check still to come: each bill less the
 *   payments recorded on it — *Still owed*.
 * - **Unconditional progress** waives money already in hand: the payments on the bills — *Paid so far*.
 * - **Unconditional final** waives the whole of the bills, paid in full — and says *not yet* while
 *   any of it is still owed.
 *
 * Two more facts ride along: a live waiver that already covers a picked bill (`lienWaiverAlreadyCovered`
 * — a second one would give up the same money twice) and, under a conditional, the money already
 * paid that no unconditional waiver covers yet (`lienWaiverPaidUnwaived`).
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { LienWaiverFormType } from '../jobsDocuments/lienWaiverRelease'
import { isConditionalLienForm, lienReleaseFormLabel, type JobLienReleaseRow } from './lienReleaseTracking'
import { lienReleaseStatus } from './lienReleaseLifecycle'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

type Invoice = JobWithDetails['invoices'][number]
type Payment = JobWithDetails['payments'][number]

const CENT = 0.005

export type WaiverMathPayment = { id: string; ymd: string | null; label: string; amount: number }

export type WaiverMathBill = {
  invoiceId: string
  /** The bill's place among the job's billable lines, as the window's chips number it (#1, #2…). */
  n: number
  billedYmd: string | null
  amount: number
  payments: WaiverMathPayment[]
  paid: number
  owed: number
}

export type WaiverAmountMath = {
  kind: 'owed' | 'paid' | 'whole'
  bills: WaiverMathBill[]
  /** The figured amount — what the Amount box is filled with. */
  total: number
  /** "Still owed on bill #1" · "Still owed" · "Paid so far" · "The whole job, paid in full". */
  totalLabel: string
  /** One plain sentence under the total. */
  note: string | null
  /** Show the box: the amount is not simply the bills' face, or the final form is early. */
  show: boolean
  /** Unconditional final while money is still owed on the bills: how much. */
  tooEarly: number | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** A `date` column's day. An instant's day is `calendarYmdInAppTzFromIso` (its first ten characters are the UTC date). */
function ymd(s: string | null | undefined): string | null {
  const d = (s ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

/** "Check" · "Transfer" · "Card" · "Cash" · "Payment" — the word a bookkeeper matches to the deposit. */
export function waiverPaymentLabel(paymentType: string | null | undefined): string {
  const t = (paymentType ?? '').trim().toLowerCase()
  if (t.startsWith('check')) return 'Check'
  if (t === 'ach' || t.includes('transfer') || t === 'wire') return 'Transfer'
  if (t.includes('card') || t.includes('stripe')) return 'Card'
  if (t === 'cash') return 'Cash'
  return 'Payment'
}

function paymentsOn(job: JobWithDetails, invoiceId: string): WaiverMathPayment[] {
  return (job.payments ?? [])
    .filter((p: Payment) => p.invoice_id === invoiceId && Number(p.amount ?? 0) !== 0)
    .map((p: Payment) => ({
      id: p.id,
      ymd: ymd(p.paid_on) ?? ymd(p.sent_on) ?? (calendarYmdInAppTzFromIso(p.created_at ?? '') || null),
      label: waiverPaymentLabel(p.payment_type),
      amount: round2(Number(p.amount ?? 0)),
    }))
    .sort((a, b) => (a.ymd ?? '').localeCompare(b.ymd ?? ''))
}

/** Each picked bill with its payments, numbered as the chips number it. */
export function waiverMathBills(job: JobWithDetails, picked: Invoice[], numbered: Invoice[]): WaiverMathBill[] {
  return picked
    .map((inv) => {
      const payments = paymentsOn(job, inv.id)
      const amount = round2(Number(inv.amount ?? 0))
      const paid = round2(payments.reduce((s, p) => s + p.amount, 0))
      return {
        invoiceId: inv.id,
        n: Math.max(1, numbered.findIndex((x) => x.id === inv.id) + 1),
        billedYmd: calendarYmdInAppTzFromIso(inv.billed_at ?? '') || calendarYmdInAppTzFromIso(inv.created_at ?? '') || null,
        amount,
        payments,
        paid,
        owed: round2(Math.max(0, amount - paid)),
      }
    })
    .sort((a, b) => a.n - b.n)
}

export function lienWaiverAmountMath(
  formType: LienWaiverFormType,
  job: JobWithDetails,
  picked: Invoice[],
  numbered: Invoice[],
): WaiverAmountMath | null {
  if (picked.length === 0) return null
  const bills = waiverMathBills(job, picked, numbered)
  const face = round2(bills.reduce((s, b) => s + b.amount, 0))
  const owed = round2(bills.reduce((s, b) => s + b.owed, 0))
  const paid = round2(bills.reduce((s, b) => s + b.paid, 0))
  const one = bills.length === 1 ? bills[0]! : null

  if (formType === 'unconditional_final') {
    const wholeJob = Math.abs(face - Number(job.revenue ?? 0)) < 1
    return {
      kind: 'whole',
      bills,
      total: face,
      totalLabel: wholeJob ? 'The whole job, paid in full' : 'These bills, paid in full',
      note: null,
      show: owed > CENT,
      tooEarly: owed > CENT ? owed : null,
    }
  }
  if (formType === 'unconditional_progress') {
    // Nothing recorded yet: the prefill falls back to the bills' face — say so rather than show a $0 sum.
    if (paid <= CENT) {
      return { kind: 'whole', bills, total: face, totalLabel: 'Nothing recorded as paid yet', note: 'The amount is the whole bill until a payment is recorded.', show: true, tooEarly: null }
    }
    return {
      kind: 'paid',
      bills,
      total: paid,
      totalLabel: 'Paid so far',
      note: owed > CENT ? 'Money already in hand. What is still owed is not in it.' : null,
      show: Math.abs(paid - face) > CENT,
      tooEarly: null,
    }
  }
  return {
    kind: 'owed',
    bills,
    total: owed,
    totalLabel: one ? `Still owed on bill #${one.n}` : 'Still owed',
    note: 'This waiver is for the check still to come. It takes effect when that check clears.',
    show: Math.abs(owed - face) > CENT,
    tooEarly: null,
  }
}

const STATUS_RANK: Record<string, number> = { signed: 3, awaiting_signature: 2, issued: 1, draft: 0 }

export type WaiverCoverage = {
  release: JobLienReleaseRow
  formLabel: string
  /** The picked bills this other waiver covers, by chip number. */
  billNumbers: number[]
  /** Every bill it covers, by chip number. */
  coversNumbers: number[]
}

/**
 * A live waiver of the same family (conditional or unconditional) that already covers one of the
 * picked bills — minted (issued, awaiting a signature, or signed), not voided, not the row being
 * edited. The furthest along wins, then the newest.
 */
export function lienWaiverAlreadyCovered(
  formType: LienWaiverFormType,
  pickedIds: string[],
  numbered: Invoice[],
  releases: JobLienReleaseRow[],
  currentReleaseId: string | null,
): WaiverCoverage | null {
  const conditional = isConditionalLienForm(formType)
  const picked = new Set(pickedIds)
  const numberOf = (id: string) => numbered.findIndex((x) => x.id === id) + 1
  const hits = releases
    .filter((r) => r.id !== currentReleaseId && r.voided_at == null && lienReleaseStatus(r) !== 'draft')
    .filter((r) => isConditionalLienForm(r.form_type) === conditional)
    .filter((r) => (r.invoice_ids ?? []).some((id) => picked.has(id)))
    .sort((a, b) => (STATUS_RANK[lienReleaseStatus(b)] ?? 0) - (STATUS_RANK[lienReleaseStatus(a)] ?? 0) || b.created_at.localeCompare(a.created_at))
  const r = hits[0]
  if (!r) return null
  const ids = r.invoice_ids ?? []
  const nums = (list: string[]) => list.map(numberOf).filter((n) => n > 0).sort((a, b) => a - b)
  return { release: r, formLabel: lienReleaseFormLabel(r.form_type), billNumbers: nums(ids.filter((id) => picked.has(id))), coversNumbers: nums(ids) }
}

/**
 * Under a conditional: the money already recorded as paid on the picked bills that no live
 * unconditional waiver covers yet — the GC is owed an unconditional progress waiver for it.
 * Null when nothing is paid or it is all covered.
 */
export function lienWaiverPaidUnwaived(
  formType: LienWaiverFormType,
  job: JobWithDetails,
  picked: Invoice[],
  releases: JobLienReleaseRow[],
): number | null {
  if (!isConditionalLienForm(formType) || picked.length === 0) return null
  const ids = new Set(picked.map((i) => i.id))
  const paid = round2(picked.reduce((s, inv) => s + paymentsOn(job, inv.id).reduce((t, p) => t + p.amount, 0), 0))
  if (paid <= CENT) return null
  const waived = round2(
    releases
      .filter((r) => r.voided_at == null && lienReleaseStatus(r) !== 'draft' && !isConditionalLienForm(r.form_type))
      .filter((r) => (r.invoice_ids ?? []).some((id) => ids.has(id)))
      .reduce((s, r) => s + Number(r.amount ?? 0), 0),
  )
  const left = round2(paid - waived)
  return left > CENT ? left : null
}

/** "Malachi Whites signed a Conditional · final on Sep 30 for $15,722.49." — the first sentence of the warning. */
export function waiverCoverageSentence(c: WaiverCoverage, money: (n: number) => string, day: (ymd: string) => string): string {
  const r = c.release
  const amount = money(Number(r.amount ?? 0))
  const s = lienReleaseStatus(r)
  const form = c.formLabel.toLowerCase()
  if (s === 'signed') {
    const who = (r.signer_printed_name ?? '').trim()
    const when = r.signed_at ? ` on ${day(calendarYmdInAppTzFromIso(r.signed_at))}` : ''
    return `${who || 'The leader'} signed a ${form}${when} for ${amount}.`
  }
  if (s === 'awaiting_signature') return `A ${form} for ${amount} is waiting for a signature.`
  return `A ${form} for ${amount} was issued${r.minted_at ? ` on ${day(calendarYmdInAppTzFromIso(r.minted_at))}` : ''}.`
}

/** "It covers bill #1 and bill #2." */
export function waiverCoversSentence(c: WaiverCoverage): string {
  const list = c.coversNumbers.map((n) => `bill #${n}`)
  if (list.length === 0) return 'It covers this bill.'
  const words = list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
  return `It covers ${words}.`
}

/** "Jul 15" — the year only when it is not this one. */
export function waiverShortDay(ymd: string | null): string {
  if (!ymd) return '—'
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  const thisYear = new Date().getFullYear() === d.getFullYear()
  return d.toLocaleDateString('en-US', thisYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
}
