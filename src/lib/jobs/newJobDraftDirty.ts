/**
 * New Job discard guard (journey-map Tier-2 #42, J1-F2): is the sheet dirty
 * relative to what the form opened with? `initial` is the snapshot taken once
 * the form finished initialising (and again after a bid prefill lands), so
 * auto-filled values — the suggested C#, the default trade, a project's
 * customer, an imported bid — never count as the user's typing. Row ids and
 * the C# are deliberately left out of the key: both are minted by the app.
 */
import { fixtureRowHasUserContent, materialRowHasUserContent, newJobFormHasBlockingContent, paymentRowHasUserContent } from './jobFormRows'
import type { FixtureRow, MaterialRow, PaymentRow } from './jobFormTypes'

export type NewJobDraftSnapshot = {
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
  googleDriveLink: string
  jobPicturesLink: string
  jobPlansLink: string
  fixtures: FixtureRow[]
  materials: MaterialRow[]
  payments: PaymentRow[]
  teamMemberIds: string[]
}

const t = (s: string | null | undefined) => (s ?? '').trim()

/** Content-only key: trimmed text, rows with user content (ids dropped), team ids sorted. */
export function newJobDraftKey(s: NewJobDraftSnapshot): string {
  return JSON.stringify({
    jobName: t(s.jobName),
    jobAddress: t(s.jobAddress),
    hcpNumber: t(s.hcpNumber),
    customerName: t(s.customerName),
    customerEmail: t(s.customerEmail),
    customerPhone: t(s.customerPhone),
    dateMet: t(s.dateMet),
    customerId: s.customerId ?? null,
    bidId: s.bidId ?? null,
    projectId: s.projectId ?? null,
    formServiceTypeId: t(s.formServiceTypeId),
    googleDriveLink: t(s.googleDriveLink),
    jobPicturesLink: t(s.jobPicturesLink),
    jobPlansLink: t(s.jobPlansLink),
    fixtures: s.fixtures
      .filter(fixtureRowHasUserContent)
      .map((f) => [t(f.name), Number(f.count), f.line_unit_price ?? null, t(f.line_description), f.stage_kind === undefined ? 'any' : f.stage_kind]),
    materials: s.materials.filter(materialRowHasUserContent).map((m) => [t(m.description), Number(m.amount)]),
    payments: s.payments
      .filter(paymentRowHasUserContent)
      .map((p) => [Number(p.amount), p.paid_on ?? null, t(p.note), t(p.payment_type), t(p.reference_number), p.invoice_id ?? null]),
    teamMemberIds: [...s.teamMemberIds].sort(),
  })
}

/**
 * True when closing would throw away something the user did. With no snapshot
 * (init never finished) fall back to "has any content", ignoring the trade —
 * the only auto-picked field that gate knows about.
 */
export function newJobDraftIsDirty(form: NewJobDraftSnapshot, initial: NewJobDraftSnapshot | null): boolean {
  if (!initial) {
    return newJobFormHasBlockingContent({ ...form, initialNewJobServiceTypeId: form.formServiceTypeId })
  }
  return newJobDraftKey(form) !== newJobDraftKey(initial)
}
