/**
 * GC mode, the real build, Owner Billing's O5a: our bills to the customer as their rows hold them
 * (O1's `gc_owner_pay_apps` and their lines, reminders, interest bills and the customer's acceptance),
 * read back as the prototype's `OwnerBilling`, so every billing kernel in ./ownerBilling*.ts reads real
 * data unchanged. Payments, paid days and the customer's promises are O5c's: they come from the
 * Pipeline's own records on the billing job once O4a makes the bills, so until then every bill reads
 * unpaid and unpromised.
 */
import type { Database } from '../../types/database'
import type { OwnerBilling, OwnerInterestBill, OwnerPayAppSent, OwnerRetainageStep } from './types'

type Tables = Database['public']['Tables']
export type OwnerPayAppRow = Tables['gc_owner_pay_apps']['Row']
export type OwnerPayAppLineRow = Tables['gc_owner_pay_app_lines']['Row']
export type OwnerPayReminderRow = Tables['gc_owner_pay_reminders']['Row']
export type OwnerInterestBillRow = Tables['gc_owner_interest_bills']['Row']
export type OwnerAcceptanceRow = Tables['gc_owner_acceptances']['Row']

/** One project's billing rows, as `loadGcOwnerBillingRows` reads them. */
export interface OwnerBillingRows {
  payApps: OwnerPayAppRow[]
  lines: OwnerPayAppLineRow[]
  reminders: OwnerPayReminderRow[]
  interestBills: OwnerInterestBillRow[]
  acceptance: OwnerAcceptanceRow | null
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

/** One pay application as it went, its lines keyed the kernels' way and its reminders oldest first. */
export function payAppFromRows(app: OwnerPayAppRow, lines: OwnerPayAppLineRow[], reminders: OwnerPayReminderRow[]): OwnerPayAppSent {
  const mine = lines.filter((l) => l.pay_app_id === app.id).sort((a, b) => a.position - b.position)
  const doneToDate = Object.fromEntries(mine.map((l) => [payAppLineKey(l), Number(l.done_to_date)]))
  const worthByLine = Object.fromEntries(mine.map((l) => [payAppLineKey(l), Number(l.worth)]))
  const stored = mine.filter((l) => Number(l.stored) > 0.005)
  const step = stepOf(app)
  const sentReminders = reminders
    .filter((r) => r.pay_app_id === app.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => ({ on: r.sent_on, by: r.pay_by, note: r.note, subject: r.subject, lines: r.lines }))
  return {
    number: app.number,
    periodTo: app.period_to,
    sentOn: app.sent_on,
    doneToDate,
    workToDate: Number(app.work_to_date),
    retainagePct: Number(app.retainage_pct),
    retainage: Number(app.retainage),
    due: Number(app.due),
    // Paid is read from the bill's payments (O5c); none until O4a makes the bills.
    paidOn: null,
    ...(app.final ? { final: true } : {}),
    worthByLine,
    certified: app.certified === null ? null : Number(app.certified),
    certifiedOn: app.certified_on,
    ...(app.certified_note.trim() !== '' ? { certifiedNote: app.certified_note } : {}),
    ...(step ? { retainageStep: step } : {}),
    ...(stored.length > 0 ? { storedByLine: Object.fromEntries(stored.map((l) => [payAppLineKey(l), Number(l.stored)])) } : {}),
    ...(sentReminders.length > 0 ? { reminders: sentReminders } : {}),
  }
}

/**
 * A project's bills to the customer as the kernels read them. Billed and held are the last progress
 * pay application's (the rule `ownerAccount` reads); paid is 0 until O5c reads the payments. Null when
 * the project has no pay application, interest bill or acceptance: there is nothing to read yet.
 */
export function ownerBillingFromRows(rows: OwnerBillingRows): OwnerBilling | null {
  if (rows.payApps.length === 0 && rows.interestBills.length === 0 && rows.acceptance === null) return null
  const payApps = [...rows.payApps].sort((a, b) => a.number - b.number).map((app) => payAppFromRows(app, rows.lines, rows.reminders))
  const lastProgress = [...payApps].reverse().find((app) => !app.final)
  const interestBills: OwnerInterestBill[] = [...rows.interestBills]
    .sort((a, b) => a.number - b.number)
    .map((bill) => ({ number: bill.number, sentOn: bill.sent_on, amount: Number(bill.amount), paidOn: null }))
  return {
    billed: lastProgress?.workToDate ?? 0,
    paid: 0,
    retainageHeld: lastProgress?.retainage ?? 0,
    ...(payApps.length > 0 ? { payApps } : {}),
    ...(rows.acceptance ? { acceptedOn: rows.acceptance.accepted_on } : {}),
    ...(interestBills.length > 0 ? { interestBills } : {}),
  }
}
