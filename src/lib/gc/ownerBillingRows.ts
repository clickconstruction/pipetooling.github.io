/**
 * GC mode, the real build, Owner Billing's O5a: our bills to the customer as their rows hold them
 * (O1's `gc_owner_pay_apps` and their lines, reminders, interest bills and the customer's acceptance),
 * read back as the prototype's `OwnerBilling`, so every billing kernel in ./ownerBilling*.ts reads real
 * data unchanged. Payments, paid days and the customer's promises are O5c's: they come from the
 * Pipeline's own records on the billing job (`money`), read from the app's tables and never copied.
 * Without them every bill reads unpaid and unpromised.
 */
import type { Database } from '../../types/database'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { OwnerBilling, OwnerInterestBill, OwnerPayAppSent, OwnerRetainageStep } from './types'

type Tables = Database['public']['Tables']
export type OwnerPayAppRow = Tables['gc_owner_pay_apps']['Row']
export type OwnerPayAppLineRow = Tables['gc_owner_pay_app_lines']['Row']
export type OwnerPayReminderRow = Tables['gc_owner_pay_reminders']['Row']
export type OwnerInterestBillRow = Tables['gc_owner_interest_bills']['Row']
export type OwnerAcceptanceRow = Tables['gc_owner_acceptances']['Row']

/**
 * The Pipeline's own records on a project's billing job (O5c): the bills its certificates made, every
 * payment on the job, and the customer's live promises.
 */
export interface OwnerBillingMoney {
  /** The billing job's bills (`jobs_ledger_invoices`): what each asks, and `paid` once the Pipeline closed it. A bill on card carries its card page. */
  bills: { id: string; amount: number; status: string; payUrl?: string | null }[]
  /** Every payment on the billing job (`jobs_ledger_payments`). One that names no bill goes on no pay application. */
  payments: { invoice_id: string | null; amount: number; paid_on: string | null }[]
  /** The billing job's live promises (`list_job_payment_promises`): the day they said, when they said it, and who. */
  promises: { promisedYmd: string; createdAt: string; source: string; note: string | null }[]
  /** Our lien waivers on the billing job (`job_lien_releases`): which form, and the bills each names. The window reads them. */
  waivers?: { form_type: string; invoice_ids: string[] }[]
  /** The bills the customer turned to card (O8b, `gc_owner_card_bills`): the base, the fee and where it stands. */
  cards?: OwnerCardBillRow[]
}

/** A bill turned to card, as `gc_owner_card_bills` holds it. */
export interface OwnerCardBillRow {
  invoice_id: string
  status: string
  base: number
  fee: number
  chosen_on: string
  undone_on: string | null
}

/** The bill's live card row: on card, not pending and not taken back. */
function onCard(money: OwnerBillingMoney | undefined, invoiceId: string): OwnerCardBillRow | null {
  return money?.cards?.find((c) => c.invoice_id === invoiceId && c.status === 'on_card') ?? null
}

/** A pay application's bill on card, or taken back to a check bill (O8c). Null: never on card. */
export function billCard(money: OwnerBillingMoney | undefined, invoiceId: string | null): OwnerPayAppSent['card'] | null {
  if (!money || !invoiceId) return null
  const row = money.cards?.find((c) => c.invoice_id === invoiceId && (c.status === 'on_card' || c.status === 'undone'))
  if (!row) return null
  const base = Number(row.base)
  const fee = Number(row.fee)
  const bill = money.bills.find((b) => b.id === invoiceId)
  return {
    invoiceId,
    state: row.status === 'on_card' ? 'onCard' : 'undone',
    base,
    fee,
    total: Math.round((base + fee) * 100) / 100,
    chosenOn: row.chosen_on,
    payUrl: row.status === 'on_card' ? (bill?.payUrl ?? null) : null,
    undoneOn: row.undone_on,
  }
}

/** One project's billing rows, as `loadGcOwnerBillingRows` reads them. */
export interface OwnerBillingRows {
  payApps: OwnerPayAppRow[]
  lines: OwnerPayAppLineRow[]
  reminders: OwnerPayReminderRow[]
  interestBills: OwnerInterestBillRow[]
  acceptance: OwnerAcceptanceRow | null
  /** The billing job's bills, payments and promises (O5c). Absent: nothing paid or promised yet. */
  money?: OwnerBillingMoney
  /**
   * The sent copies of our emails about each pay application (O4b, `sent_documents` by source): which kind of copy
   * (the application's own, or the certified bill's), who and when.
   */
  emails?: { source_id: string; kind: string; recipient_name: string | null; sent_at: string }[]
  /** The sent copies of our interest bills' emails (O6b-2), by the interest bill's id: who and when. */
  interestEmails?: { source_id: string; recipient_name: string | null; sent_at: string }[]
  /** The architect's reminders the app sent (O10, `gc_office_notices`), by pay application. */
  notices?: { pay_app_id: string | null; kind: string; created_at: string }[]
}

/**
 * One bill's payments, oldest first, and the day it was paid in full: the payment that closed it. A bill on card
 * (O8b) reads at what it asked before the fee: its card payment carries the fee, so only the base is laid on the pay
 * application and the rest is the fee (O8c). The fee is a recovery of Stripe's cost, never a GC figure.
 */
export function billMoney(money: OwnerBillingMoney | undefined, invoiceId: string | null): { payments: { on: string; amount: number }[]; paidOn: string | null } {
  const bill = invoiceId ? money?.bills.find((b) => b.id === invoiceId) : undefined
  if (!money || !bill) return { payments: [], paidOn: null }
  const card = onCard(money, bill.id)
  const ask = card ? Number(card.base) : Number(bill.amount)
  const paid = money.payments
    .filter((p) => p.invoice_id === bill.id && p.paid_on !== null)
    .map((p) => ({ on: p.paid_on ?? '', amount: Number(p.amount) }))
    .sort((a, b) => a.on.localeCompare(b.on))
  let laid = 0
  const payments = card
    ? paid.flatMap((p) => {
        const amount = Math.round(Math.max(0, Math.min(p.amount, ask - laid)) * 100) / 100
        laid += amount
        return amount > 0.005 ? [{ on: p.on, amount }] : []
      })
    : paid
  let sum = 0
  let paidOn: string | null = null
  for (const p of payments) {
    sum += p.amount
    if (sum >= ask - 0.005) {
      paidOn = p.on
      break
    }
  }
  // Closed for less than it asked (a write-down): paid on its last payment's day.
  if (paidOn === null && bill.status === 'paid') paidOn = payments[payments.length - 1]?.on ?? null
  return { payments, paidOn }
}

/**
 * The customer's word on when they will pay (decision 8): a promise on the billing job covers every bill
 * open when it was made, meaning made by then (its certificate) and not yet paid. Oldest first.
 */
export function promisesOnBill(money: OwnerBillingMoney | undefined, madeOn: string | null, paidOn: string | null): NonNullable<OwnerPayAppSent['promises']> {
  if (!money || madeOn === null) return []
  return [...money.promises]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((p) => ({ by: p.promisedYmd, madeOn: calendarYmdInAppTzFromIso(p.createdAt), note: (p.note ?? '').trim(), who: p.source === 'customer' ? ('owner' as const) : ('office' as const) }))
    .filter((p) => p.madeOn >= madeOn && (paidOn === null || p.madeOn < paidOn))
}

/** Payments on the billing job that name no bill, oldest first: shown as they are, never laid on a pay application. */
export function unbilledPayments(money: OwnerBillingMoney | undefined): { on: string | null; amount: number }[] {
  return (money?.payments ?? [])
    .filter((p) => p.invoice_id === null)
    .map((p) => ({ on: p.paid_on, amount: Number(p.amount) }))
    .sort((a, b) => (a.on ?? '').localeCompare(b.on ?? ''))
}

/** The key a line goes by in the kernels: a trade or our crew by its package, a change order by its id, our own lines by name. */
export function payAppLineKey(line: Pick<OwnerPayAppLineRow, 'line' | 'package_id' | 'change_order_id'>): string {
  if (line.line === 'trade' || line.line === 'self') return line.package_id ?? ''
  if (line.line === 'change_order') return line.change_order_id ?? ''
  return line.line
}

function stepOf(row: Pick<OwnerPayAppRow, 'retainage_step_at_pct' | 'retainage_step_to_pct' | 'retainage_step_way'>): OwnerRetainageStep | null {
  const { retainage_step_at_pct: at, retainage_step_to_pct: to, retainage_step_way: way } = row
  if (at === null || to === null || (way !== 'after' && way !== 'all')) return null
  return { atPct: Number(at), toPct: Number(to), way }
}

/**
 * One pay application as it went, its lines keyed the kernels' way and its reminders oldest first. With the
 * billing job's money (O5c), its bill's payments, the day it was paid and the promises that cover it.
 */
export function payAppFromRows(
  app: OwnerPayAppRow,
  lines: OwnerPayAppLineRow[],
  reminders: OwnerPayReminderRow[],
  money?: OwnerBillingMoney,
  notices?: OwnerBillingRows['notices'],
): OwnerPayAppSent {
  const mine = lines.filter((l) => l.pay_app_id === app.id).sort((a, b) => a.position - b.position)
  const doneToDate = Object.fromEntries(mine.map((l) => [payAppLineKey(l), Number(l.done_to_date)]))
  const worthByLine = Object.fromEntries(mine.map((l) => [payAppLineKey(l), Number(l.worth)]))
  const stored = mine.filter((l) => Number(l.stored) > 0.005)
  const step = stepOf(app)
  const sentReminders = reminders
    .filter((r) => r.pay_app_id === app.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => ({ on: r.sent_on, by: r.pay_by, note: r.note, subject: r.subject, lines: r.lines, emailed: r.email_send_log_id !== null }))
  const { payments, paidOn } = billMoney(money, app.invoice_id)
  const promises = app.invoice_id ? promisesOnBill(money, app.certified_on, paidOn) : []
  const card = billCard(money, app.invoice_id)
  // The day the app reminded the architect to certify it (O10), in the office's day.
  const reminded = (notices ?? []).find((n) => n.pay_app_id === app.id && n.kind === 'certify_reminder')
  return {
    number: app.number,
    periodTo: app.period_to,
    sentOn: app.sent_on,
    doneToDate,
    workToDate: Number(app.work_to_date),
    retainagePct: Number(app.retainage_pct),
    retainage: Number(app.retainage),
    due: Number(app.due),
    // Paid is read from the bill's payments on the billing job (O5c): the day the payment that closed it came.
    paidOn,
    ...(app.final ? { final: true } : {}),
    worthByLine,
    certified: app.certified === null ? null : Number(app.certified),
    certifiedOn: app.certified_on,
    ...(app.certified_note.trim() !== '' ? { certifiedNote: app.certified_note } : {}),
    ...(step ? { retainageStep: step } : {}),
    ...(stored.length > 0 ? { storedByLine: Object.fromEntries(stored.map((l) => [payAppLineKey(l), Number(l.stored)])) } : {}),
    ...(sentReminders.length > 0 ? { reminders: sentReminders } : {}),
    ...(payments.length > 0 ? { payments } : {}),
    ...(promises.length > 0 ? { promises } : {}),
    ...(card ? { card } : {}),
    ...(reminded ? { architectRemindedOn: calendarYmdInAppTzFromIso(reminded.created_at) } : {}),
  }
}

/**
 * A project's bills to the customer as the kernels read them. Billed and held are the last progress
 * pay application's (the rule `ownerAccount` reads); paid adds up the payments on their bills (O5c). Null when
 * the project has no pay application, interest bill or acceptance: there is nothing to read yet.
 */
export function ownerBillingFromRows(rows: OwnerBillingRows): OwnerBilling | null {
  if (rows.payApps.length === 0 && rows.interestBills.length === 0 && rows.acceptance === null) return null
  const payApps = [...rows.payApps].sort((a, b) => a.number - b.number).map((app) => payAppFromRows(app, rows.lines, rows.reminders, rows.money, rows.notices))
  const lastProgress = [...payApps].reverse().find((app) => !app.final)
  const interestBills: OwnerInterestBill[] = [...rows.interestBills]
    .sort((a, b) => a.number - b.number)
    .map((bill) => ({ number: bill.number, sentOn: bill.sent_on, amount: Number(bill.amount), paidOn: billMoney(rows.money, bill.invoice_id).paidOn }))
  return {
    billed: lastProgress?.workToDate ?? 0,
    paid: payApps.reduce((s, app) => s + (app.payments ?? []).reduce((t, p) => t + p.amount, 0), 0),
    retainageHeld: lastProgress?.retainage ?? 0,
    ...(payApps.length > 0 ? { payApps } : {}),
    ...(rows.acceptance ? { acceptedOn: rows.acceptance.accepted_on, ...(rows.acceptance.how === 'portal' ? { acceptedInPortal: true } : {}) } : {}),
    ...(interestBills.length > 0 ? { interestBills } : {}),
  }
}
