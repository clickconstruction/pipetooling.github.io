/**
 * "Waivers" on the customer portal (v2.4278, our lien waiver to the GC, PR 4; v2.4304 Your
 * papers): one row per sent bill with the two waivers a bill carries — the conditional that
 * came with the bill and the unconditional that follows when the check clears. A half shows
 * once the leader has SIGNED it (the owner's call, 2026-10-01): signed (not yet emailed) or
 * sent; a waiver still being signed, or none, reads `none` and a bill with no signed half
 * sends no row, so the page never promises paper that does not exist.
 *
 * Two audiences, pre-scoped HERE so nothing the page would hide can be read from the payload:
 * `payer` — the bills the viewer pays (`statementRoleFor` = owed); `owner` — the bills on the
 * viewer's own property that the office shared with them (`statementRoleFor` = shared and the
 * viewer is the job's customer), open or paid, since the unconditional comes after payment.
 *
 * Pure and dependency-free beyond the shared rules; tested from vitest
 * (src/lib/portal/portalWaivers.test.ts). The function turns `pdfPath` into a signed URL.
 */
import { todayYmdInAppTz } from './appTimeZone.ts'
import { statementRoleFor } from './billVisibility.ts'

export type PortalWaiverJobRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  customer_id?: string | null
  gc_customer_id?: string | null
  bill_to_party?: string | null
  show_bills_to_other_party?: boolean | null
}

export type PortalWaiverInvoiceRow = {
  id: string
  job_id: string
  amount: number | null
  status: string
  billed_at: string | null
  sequence_order: number | null
  bill_to_party?: string | null
  bill_to_email?: string | null
  /** Share this bill (v2.3375): the non-paying party this bill is shown to. */
  shown_to_party?: string | null
}

export type PortalWaiverPaymentRow = { invoice_id: string | null; amount: number | null }

export type PortalWaiverReleaseRow = {
  id: string
  job_id: string
  form_type: string
  status: string
  invoice_ids: string[] | null
  created_at: string
  signed_at: string | null
  sent_to_customer_at: string | null
  signed_pdf_path: string | null
  voided_at: string | null
  /** Who drew the signature (v2.4285); the record row names him. */
  signer_printed_name?: string | null
}

export type PortalWaiverHalfState = 'none' | 'signing' | 'signed' | 'sent'

export type PortalWaiverHalf = {
  state: PortalWaiverHalfState
  /** YYYY-MM-DD of the step the state names. */
  ymd: string | null
  /** The stored signed PDF's storage path — the function signs it into a URL; null until signed. */
  pdfPath: string | null
  releaseId: string | null
  /** The signed form: conditional_progress · conditional_final · unconditional_progress · unconditional_final. */
  formType: string | null
  /** Who signed it, for "signed by …". */
  signerName: string | null
}

export type PortalWaiverRow = {
  /** payer: a bill the viewer pays · owner: a bill on the viewer's property, shared with them. */
  audience: 'payer' | 'owner'
  jobId: string
  jobLabel: string
  jobAddress: string | null
  invoiceId: string
  /** "Bill 2 of 3" — the bill's place among the job's sent bills. */
  billLabel: string
  amount: number
  billedYmd: string | null
  /** The bill's money has settled (paid, or the payments on it reach its amount). */
  paid: boolean
  /** The bill is the job's last sent bill — its waivers are the final forms. */
  final: boolean
  conditional: PortalWaiverHalf
  unconditional: PortalWaiverHalf
}

function jobLabel(j: PortalWaiverJobRow): string {
  const num = (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim()
  const name = (j.job_name ?? '').trim()
  return [num, name].filter(Boolean).join(' · ') || 'Job'
}

/** The day an instant (sent, signed, billed) falls on in the company's zone, never its UTC date. */
function ymd(iso: string | null | undefined): string | null {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? todayYmdInAppTz(d) : null
}

function isConditional(formType: string): boolean {
  return formType === 'conditional_progress' || formType === 'conditional_final'
}

const NONE: PortalWaiverHalf = { state: 'none', ymd: null, pdfPath: null, releaseId: null, formType: null, signerName: null }

/** The half a bill shows: its newest signed release, a sent one first. Unsigned rows never show. */
function half(rows: PortalWaiverReleaseRow[]): PortalWaiverHalf {
  const signed = rows.filter((r) => r.status === 'signed')
  const best = [...signed].sort((a, b) => Number(Boolean(b.sent_to_customer_at)) - Number(Boolean(a.sent_to_customer_at)) || b.created_at.localeCompare(a.created_at))[0]
  if (!best) return NONE
  const common = { pdfPath: best.signed_pdf_path, releaseId: best.id, formType: best.form_type, signerName: (best.signer_printed_name ?? '').trim() || null }
  if (best.sent_to_customer_at) return { state: 'sent', ymd: ymd(best.sent_to_customer_at), ...common }
  return { state: 'signed', ymd: ymd(best.signed_at), ...common }
}

export function buildPortalWaivers(args: {
  jobs: PortalWaiverJobRow[]
  invoices: PortalWaiverInvoiceRow[]
  payments: PortalWaiverPaymentRow[]
  releases: PortalWaiverReleaseRow[]
  viewerCustomerId: string
}): PortalWaiverRow[] {
  const { jobs, invoices, payments, releases, viewerCustomerId } = args
  const live = releases.filter((r) => !r.voided_at)
  const out: PortalWaiverRow[] = []
  for (const job of jobs) {
    const sent = invoices
      .filter((i) => i.job_id === job.id && (i.status === 'billed' || i.status === 'paid'))
      .sort((a, b) => Number(a.sequence_order ?? 0) - Number(b.sequence_order ?? 0))
    const jobReleases = live.filter((r) => r.job_id === job.id)
    if (jobReleases.length === 0) continue
    const viewerIsOwner = (job.customer_id ?? '') === viewerCustomerId
    sent.forEach((inv, i) => {
      const role = statementRoleFor(job, inv, viewerCustomerId)
      const audience: PortalWaiverRow['audience'] | null = role === 'owed' ? 'payer' : role === 'shared' && viewerIsOwner ? 'owner' : null
      if (!audience) return
      const covering = jobReleases.filter((r) => (r.invoice_ids ?? []).includes(inv.id))
      const conditional = half(covering.filter((r) => isConditional(r.form_type)))
      const unconditional = half(covering.filter((r) => !isConditional(r.form_type)))
      if (conditional.state === 'none' && unconditional.state === 'none') return
      const applied = payments.filter((p) => p.invoice_id === inv.id).reduce((s, p) => s + Number(p.amount ?? 0), 0)
      const amount = Number(inv.amount ?? 0)
      out.push({
        audience,
        jobId: job.id,
        jobLabel: jobLabel(job),
        jobAddress: (job.job_address ?? '').trim() || null,
        invoiceId: inv.id,
        billLabel: sent.length > 1 ? `Bill ${i + 1} of ${sent.length}` : 'Bill',
        amount: Math.round(amount * 100) / 100,
        billedYmd: ymd(inv.billed_at),
        paid: inv.status === 'paid' || (amount > 0 && applied >= amount - 0.005),
        final: i + 1 === sent.length,
        conditional,
        unconditional,
      })
    })
  }
  // Open bills first, newest billed first; paid ones after.
  return out.sort((a, b) => Number(a.paid) - Number(b.paid) || (b.billedYmd ?? '').localeCompare(a.billedYmd ?? ''))
}
