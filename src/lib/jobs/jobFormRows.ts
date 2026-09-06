/**
 * Row-model helpers for the Job form: dirty-checks (has-user-content), the
 * fixture display-name normaliser, payment-row factories/hydration, and the
 * New-Job "is this sheet dirty" gate. Extracted verbatim from JobFormModal.
 * Pure except the two obvious factories (`crypto.randomUUID` / today's date).
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { FixtureRow, MaterialRow, PaymentRow } from './jobFormTypes'

export function materialRowHasUserContent(row: MaterialRow): boolean {
  return (row.description ?? '').trim() !== '' || Number(row.amount) !== 0
}

/** Collapses newlines and internal whitespace; trims ends. Single logical line for DB / Stripe. */
export function normalizeFixtureDisplayName(raw: string): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim()
}

export function fixtureRowHasUserContent(row: FixtureRow): boolean {
  if (normalizeFixtureDisplayName(row.name ?? '') !== '') return true
  if ((row.line_description ?? '').trim() !== '') return true
  if (row.line_unit_price != null && Number.isFinite(Number(row.line_unit_price))) return true
  const c = Number(row.count)
  if (Number.isFinite(c) && c !== 1) return true
  return false
}

export function paymentRowHasUserContent(row: PaymentRow): boolean {
  if (Number(row.amount) !== 0) return true
  if ((row.note ?? '').trim() !== '') return true
  if ((row.reference_number ?? '').trim() !== '') return true
  if ((row.payment_type ?? '').trim() !== '') return true
  if (row.invoice_id != null && String(row.invoice_id).trim() !== '') return true
  if (row.mercury_transaction_id != null && String(row.mercury_transaction_id).trim() !== '') return true
  return false
}

/** Hover / tap copy for a blocked Import button (v2.2909, J1-F4). */
export const NEW_JOB_IMPORT_BLOCKED_HINT =
  'Import fills a blank New Job from an estimate or bid. Clear what you typed here first, or open a fresh New Job.'

/**
 * The header Import button's state on New Job (v2.2909, J1-F4): shown for every
 * new-job render, greyed with an explanation once the sheet has content —
 * it used to vanish, which read as "the door is gone".
 */
export function newJobImportButtonState(args: { mode: 'new' | 'edit'; isEditing: boolean; blocked: boolean }): {
  visible: boolean
  disabled: boolean
  /** Tooltip / toast copy; null when the button is live. */
  hint: string | null
} {
  if (args.mode !== 'new' || args.isEditing) return { visible: false, disabled: false, hint: null }
  return args.blocked
    ? { visible: true, disabled: true, hint: NEW_JOB_IMPORT_BLOCKED_HINT }
    : { visible: true, disabled: false, hint: null }
}

/** True when the New Job sheet has any user-visible content; disables **Import** to avoid accidental overwrites. */
export function newJobFormHasBlockingContent(args: {
  jobName: string
  jobAddress: string
  hcpNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  dateMet: string
  customerId: string | null
  bidId: string | null
  projectId: string | null
  formServiceTypeId: string
  /** Set on new-job init so auto-picked trade does not hide Import. */
  initialNewJobServiceTypeId: string
  googleDriveLink: string
  jobPicturesLink: string
  jobPlansLink: string
  fixtures: FixtureRow[]
  materials: MaterialRow[]
  payments: PaymentRow[]
  teamMemberIds: string[]
}): boolean {
  if (args.jobName.trim() || args.jobAddress.trim() || args.hcpNumber.trim()) return true
  if (
    args.customerId ||
    args.customerName.trim() ||
    args.customerEmail.trim() ||
    args.customerPhone.trim() ||
    args.dateMet.trim()
  ) {
    return true
  }
  if (args.bidId || args.projectId) return true
  if (
    args.formServiceTypeId.trim() !== '' &&
    args.formServiceTypeId !== args.initialNewJobServiceTypeId
  ) {
    return true
  }
  if (
    args.googleDriveLink.trim() ||
    args.jobPicturesLink.trim() ||
    args.jobPlansLink.trim()
  ) {
    return true
  }
  if (args.fixtures.length > 1 || args.fixtures.some(fixtureRowHasUserContent)) return true
  if (args.materials.length > 1 || args.materials.some(materialRowHasUserContent)) return true
  if (args.payments.length > 1 || args.payments.some(paymentRowHasUserContent)) return true
  if (args.teamMemberIds.length > 0) return true
  return false
}

function localDateYYYYMMDD(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function newEmptyPaymentRow(): PaymentRow {
  return {
    id: crypto.randomUUID(),
    amount: 0,
    paid_on: localDateYYYYMMDD(),
    sent_on: null,
    note: null,
    payment_type: null,
    reference_number: null,
    invoice_id: null,
    mercury_transaction_id: null,
  }
}

export function paymentRowsFromJob(job: JobWithDetails): PaymentRow[] {
  if (job.payments?.length) {
    return job.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      paid_on: p.paid_on ? String(p.paid_on).slice(0, 10) : null,
      sent_on: p.sent_on ? String(p.sent_on).slice(0, 10) : null,
      note: p.note ?? null,
      payment_type: p.payment_type ?? null,
      reference_number: p.reference_number ?? null,
      invoice_id: p.invoice_id ?? null,
      mercury_transaction_id: p.mercury_transaction_id ?? null,
    }))
  }
  return [newEmptyPaymentRow()]
}
