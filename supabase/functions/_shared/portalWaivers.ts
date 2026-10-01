/**
 * "Waivers" on the customer portal (v2.4278, our lien waiver to the GC, PR 4): one row per sent
 * bill the viewer pays, with the two waivers a bill carries — the conditional that came with
 * the bill and the unconditional that follows when the check clears — each as a state the
 * page can draw: none · signing (minted, the leader has not signed) · signed (not yet sent) ·
 * sent (the PDF is theirs). Pre-scoped HERE to what this viewer pays (the shared who-pays
 * rule), so nothing the page would hide can be read from the payload. Rows come only for jobs
 * under a GC, or bills that already carry a waiver — a homeowner's page shows nothing.
 *
 * Pure and dependency-free beyond the shared rules; tested from vitest
 * (src/lib/portal/portalWaivers.test.ts). The function turns `pdfPath` into a signed URL.
 */
import { effectiveInvoiceParty, payerCustomerId } from './billToParty.ts'

export type PortalWaiverJobRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  customer_id?: string | null
  gc_customer_id?: string | null
  bill_to_party?: string | null
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
}

export type PortalWaiverHalfState = 'none' | 'signing' | 'signed' | 'sent'

export type PortalWaiverHalf = {
  state: PortalWaiverHalfState
  /** YYYY-MM-DD of the step the state names. */
  ymd: string | null
  /** The stored signed PDF's storage path — the function signs it into a URL; null until signed. */
  pdfPath: string | null
  releaseId: string | null
}

export type PortalWaiverRow = {
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

function ymd(iso: string | null | undefined): string | null {
  const d = (iso ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

function isConditional(formType: string): boolean {
  return formType === 'conditional_progress' || formType === 'conditional_final'
}

function half(rows: PortalWaiverReleaseRow[]): PortalWaiverHalf {
  const rank = (r: PortalWaiverReleaseRow) => (r.sent_to_customer_at ? 4 : r.status === 'signed' ? 3 : r.status === 'awaiting_signature' || r.status === 'issued' ? 2 : 1)
  const best = [...rows].sort((a, b) => rank(b) - rank(a) || b.created_at.localeCompare(a.created_at))[0]
  if (!best || best.status === 'draft') return { state: 'none', ymd: null, pdfPath: null, releaseId: null }
  if (best.sent_to_customer_at) return { state: 'sent', ymd: ymd(best.sent_to_customer_at), pdfPath: best.signed_pdf_path, releaseId: best.id }
  if (best.status === 'signed') return { state: 'signed', ymd: ymd(best.signed_at), pdfPath: best.signed_pdf_path, releaseId: best.id }
  return { state: 'signing', ymd: ymd(best.created_at), pdfPath: null, releaseId: best.id }
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
    const mine = sent.filter((i) => payerCustomerId(job, effectiveInvoiceParty(job, i)) === viewerCustomerId)
    if (mine.length === 0) continue
    const jobReleases = live.filter((r) => r.job_id === job.id)
    const underGc = Boolean((job.gc_customer_id ?? '').trim())
    mine.forEach((inv) => {
      const covering = jobReleases.filter((r) => (r.invoice_ids ?? []).includes(inv.id))
      if (!underGc && covering.length === 0) return
      const applied = payments.filter((p) => p.invoice_id === inv.id).reduce((s, p) => s + Number(p.amount ?? 0), 0)
      const amount = Number(inv.amount ?? 0)
      const idx = sent.findIndex((i) => i.id === inv.id) + 1
      out.push({
        jobId: job.id,
        jobLabel: jobLabel(job),
        jobAddress: (job.job_address ?? '').trim() || null,
        invoiceId: inv.id,
        billLabel: sent.length > 1 ? `Bill ${idx} of ${sent.length}` : 'Bill',
        amount: Math.round(amount * 100) / 100,
        billedYmd: ymd(inv.billed_at),
        paid: inv.status === 'paid' || (amount > 0 && applied >= amount - 0.005),
        final: idx === sent.length,
        conditional: half(covering.filter((r) => isConditional(r.form_type))),
        unconditional: half(covering.filter((r) => !isConditional(r.form_type))),
      })
    })
  }
  // Open bills first, newest billed first; paid ones after.
  return out.sort((a, b) => Number(a.paid) - Number(b.paid) || (b.billedYmd ?? '').localeCompare(a.billedYmd ?? ''))
}
