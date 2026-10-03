/**
 * "Your payments" on the customer portal (v2.4053, "Where the checks went"
 * PR 5): the rows the page's kernel (`src/lib/jobs/gcChecksApplied.ts`)
 * folds into checks — pre-scoped HERE to what this viewer pays, so nothing
 * the page would hide could be read from the payload:
 *
 * - a bill counts when the viewer is its payer (the shared who-pays rule);
 * - a payment linked to a bill counts when that bill counts;
 * - an unlinked payment counts only when EVERY sent bill on its job is the
 *   viewer's — otherwise which bill it paid could name the other party's
 *   money, so it is left out;
 * - a move counts when it names a kept payment; it carries no actor and no
 *   reason, only the day and the amount.
 *
 * Every kept job is stamped `customer_id: PORTAL_CHECKS_VIEWER` with no GC and
 * no rule, so the page's kernel counts every line as the viewer's. Pure and
 * dependency-free beyond the shared rules; tested from vitest
 * (src/lib/portal/portalChecks.test.ts).
 */
import { todayYmdInAppTz } from './appTimeZone.ts'
import { effectiveInvoiceParty, payerCustomerId } from './billToParty.ts'

/** The id the page passes as the "GC" — every kept job's customer. */
export const PORTAL_CHECKS_VIEWER = 'viewer'

export type PortalChecksJobRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  customer_id?: string | null
  gc_customer_id?: string | null
  bill_to_party?: string | null
  lien_retainage_held?: number | null
}

export type PortalChecksInvoiceRow = {
  id: string
  job_id: string
  amount: number | null
  status: string
  billed_at: string | null
  sequence_order: number | null
  bill_to_party?: string | null
  bill_to_email?: string | null
}

export type PortalChecksPaymentRow = {
  id: string
  job_id: string
  invoice_id: string | null
  amount: number | null
  paid_on: string | null
  sent_on?: string | null
  payment_type: string | null
  reference_number: string | null
  sequence_order?: number | null
}

export type PortalChecksEventRow = {
  id: string
  kind: string
  payment_id: string | null
  from_job_id: string | null
  to_job_id: string | null
  amount: number | null
  created_at: string
}

export type PortalChecksJobOut = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  customer_id: string
  gc_customer_id: null
  bill_to_party: null
  lien_retainage_held: number | null
  invoices: Array<{ id: string; job_id: string; sequence_order: number | null; amount: number; status: string; billed_at: string | null }>
  payments: Array<{ id: string; job_id: string; invoice_id: string | null; amount: number; paid_on: string | null; sent_on: string | null; payment_type: string | null; reference_number: string | null; sequence_order: number | null }>
}

export type PortalChecksEventOut = { id: string; kind: 'moved'; payment_id: string; from_job_id: string | null; to_job_id: string | null; amount: number; created_at: string }

export type PortalChecksOut = { jobs: PortalChecksJobOut[]; events: PortalChecksEventOut[] }

const isSent = (status: string | null | undefined): boolean => status === 'billed' || status === 'paid'

export function buildPortalChecks(args: {
  jobs: PortalChecksJobRow[]
  invoices: PortalChecksInvoiceRow[]
  payments: PortalChecksPaymentRow[]
  events: PortalChecksEventRow[]
  viewerCustomerId: string
}): PortalChecksOut {
  const { jobs, invoices, payments, events, viewerCustomerId } = args
  const invoicesByJob = new Map<string, PortalChecksInvoiceRow[]>()
  for (const inv of invoices) invoicesByJob.set(inv.job_id, [...(invoicesByJob.get(inv.job_id) ?? []), inv])
  const paymentsByJob = new Map<string, PortalChecksPaymentRow[]>()
  for (const p of payments) paymentsByJob.set(p.job_id, [...(paymentsByJob.get(p.job_id) ?? []), p])

  const keptPaymentIds = new Set<string>()
  const out: PortalChecksJobOut[] = []
  for (const job of jobs) {
    const partyJob = { customer_id: job.customer_id ?? null, gc_customer_id: job.gc_customer_id ?? null, bill_to_party: job.bill_to_party ?? null }
    const viewerPays = (inv: PortalChecksInvoiceRow | null): boolean =>
      payerCustomerId(partyJob, effectiveInvoiceParty(partyJob, inv ? { bill_to_party: inv.bill_to_party ?? null, bill_to_email: inv.bill_to_email ?? null } : null)) === viewerCustomerId
    const sent = (invoicesByJob.get(job.id) ?? []).filter((i) => isSent(i.status))
    const mine = sent.filter(viewerPays)
    const mineIds = new Set(mine.map((i) => i.id))
    const allMine = sent.length > 0 && mine.length === sent.length
    const kept = (paymentsByJob.get(job.id) ?? []).filter((p) => (p.invoice_id ? mineIds.has(p.invoice_id) : allMine || (sent.length === 0 && viewerPays(null))))
    if (mine.length === 0 && kept.length === 0) continue
    for (const p of kept) keptPaymentIds.add(p.id)
    out.push({
      id: job.id,
      hcp_number: job.hcp_number,
      click_number: job.click_number,
      job_name: job.job_name,
      job_address: job.job_address,
      customer_id: PORTAL_CHECKS_VIEWER,
      gc_customer_id: null,
      bill_to_party: null,
      lien_retainage_held: job.lien_retainage_held ?? null,
      invoices: mine.map((i) => ({ id: i.id, job_id: i.job_id, sequence_order: i.sequence_order, amount: Number(i.amount ?? 0), status: i.status, billed_at: i.billed_at ? todayYmdInAppTz(new Date(i.billed_at)) : null })),
      payments: kept.map((p) => ({
        id: p.id,
        job_id: p.job_id,
        invoice_id: p.invoice_id,
        amount: Number(p.amount ?? 0),
        paid_on: p.paid_on ? String(p.paid_on).slice(0, 10) : null,
        sent_on: p.sent_on ? String(p.sent_on).slice(0, 10) : null,
        payment_type: p.payment_type,
        reference_number: p.reference_number,
        sequence_order: p.sequence_order ?? null,
      })),
    })
  }

  const moves: PortalChecksEventOut[] = []
  for (const e of events) {
    if (e.kind !== 'moved' || !e.payment_id || !keptPaymentIds.has(e.payment_id)) continue
    moves.push({ id: e.id, kind: 'moved', payment_id: e.payment_id, from_job_id: e.from_job_id, to_job_id: e.to_job_id, amount: Number(e.amount ?? 0), created_at: e.created_at })
  }
  return { jobs: out, events: moves }
}
