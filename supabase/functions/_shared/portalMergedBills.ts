/**
 * Pure bill-list builder for the customer portal (portal custom-links train).
 * Shared by the customer-portal edge function and unit-tested from vitest
 * (src/lib/portal/portalMergedBills.test.ts) — keep it dependency-free.
 *
 * Audience 'all' merges jobs where the company is the customer with jobs
 * where it is the GC, deduped by job id; rows on someone else's property get
 * asGc=true plus the owner's name for the statement's AS GC tag.
 */

import { jobCarriesOpenBills, jobPrintsShellRemainder } from './portalBillMembership.ts'
import { effectiveInvoiceParty, payerCustomerId } from './billToParty.ts'
import { shownToPartyFor, statementRoleFor } from './billVisibility.ts'

export type PortalJobRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  status: string | null
  revenue: number | null
  payments_made: number | null
  /** Embedded service type (`service_types:service_type_id(name)`), for the statement's trade tag. */
  service_types?: { name: string | null } | null
  customer_id?: string | null
  gc_customer_id?: string | null
  /** v2.2933: the job-level switch — nothing about stages reaches the GC until this is on. */
  gc_shares_stage_dates?: boolean | null
  /** Who pays (v2.3346): customer | gc | split — the job's rule. */
  bill_to_party?: string | null
  /** Share this bill (v2.3375): the job's memory — decides the invoice-less shell remainder. */
  show_bills_to_other_party?: boolean | null
}

export type PortalInvoiceRow = {
  id: string
  job_id: string
  amount: number | null
  status: string
  billed_at: string | null
  sequence_order: number | null
  hosted_invoice_url: string | null
  /** Who pays (v2.3346): this invoice's own pick and the typed someone-else recipient. */
  bill_to_party?: string | null
  bill_to_email?: string | null
  bill_to_name?: string | null
  /** Share this bill (v2.3375): the non-paying party this bill is shown to — customer | gc | null. */
  shown_to_party?: string | null
}

export type PortalPaymentRow = {
  invoice_id: string | null
  amount: number | null
  /** Optional detail (v2.2313): when present, per-payment rows render on the statement. */
  paid_on?: string | null
  payment_type?: string | null
  sequence_order?: number | null
}

/** One customer-visible payment line under a bill (v2.2313). Never includes internal notes. */
export type PortalBillPaymentOut = {
  /** YYYY-MM-DD (null = undated). */
  date: string | null
  method: string
  amount: number
}

export type PortalBillOut = {
  jobLabel: string
  jobNumber: string
  /** Bare job name (no number suffix) — the statement's fallback identity when a job has no address. */
  jobName: string | null
  /** 'plum' | 'elec' | 'hvac' — the trade tag the statement colors; null when the job has no (known) service type. */
  serviceTag: string | null
  jobAddress: string | null
  amount: number
  billedOn: string | null
  payUrl: string | null
  checkRef: string
  asGc: boolean
  ownerName: string | null
  /** Payments already applied to this bill, oldest first (v2.2313). */
  payments: PortalBillPaymentOut[]
  /** Sum of `payments` (dollars). */
  totalPaid: number
}

export function jobNumber(j: PortalJobRow): string {
  return (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim() || ''
}

/** Mirrors the board's trade pills (BID_SERVICE_TYPE_TAGS in src/utils/unifiedJobBidSearch.ts). */
const PORTAL_TRADE_TAGS: Record<string, string> = {
  Plumbing: 'plum',
  Electrical: 'elec',
  HVAC: 'hvac',
}

export function jobTradeTag(j: PortalJobRow): string | null {
  const name = (j.service_types?.name ?? '').trim()
  return PORTAL_TRADE_TAGS[name] ?? null
}

export function jobLabel(j: PortalJobRow): string {
  const n = jobNumber(j)
  const name = (j.job_name ?? '').trim()
  if (n && name) return `${name} · Job ${n}`
  return name || (n ? `Job ${n}` : 'Job')
}

/** Union of the customer-side and GC-side queries, first occurrence wins. */
export function dedupeJobsById<T extends { id: string }>(jobs: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const j of jobs) {
    if (seen.has(j.id)) continue
    seen.add(j.id)
    out.push(j)
  }
  return out
}

/** A merged-view row is "as GC" when the job belongs to someone else's account. */
export function jobIsAsGc(job: PortalJobRow, viewerCustomerId: string): boolean {
  return typeof job.customer_id === 'string' && job.customer_id !== viewerCustomerId
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Open-bill rows for the statement: one row per billed invoice with a
 * remaining balance on any NON-PAID job (progress bills on working jobs
 * included — membership rule in portalBillMembership.ts, aligned with the GC
 * statement payload RPC), plus a job-level remainder row for `billed` jobs
 * that have no billed line (rare shells; never widened past `billed`).
 * Sorted newest billed first.
 */
export function buildPortalBills(args: {
  jobs: PortalJobRow[]
  invoices: PortalInvoiceRow[]
  payments: PortalPaymentRow[]
  viewerCustomerId: string
  /** Only the merged 'all' audience tags rows; scoped views never do. */
  markGcRows: boolean
  /** customer_id → display name, for AS GC owner labels. */
  ownerNames?: Record<string, string>
}): PortalBillOut[] {
  const { jobs, invoices, payments, viewerCustomerId, markGcRows, ownerNames = {} } = args

  const openBillJobs = jobs.filter((j) => jobCarriesOpenBills(j.status))
  const jobById = new Map(openBillJobs.map((j) => [j.id, j]))
  const shellJobs = openBillJobs.filter((j) => jobPrintsShellRemainder(j.status))

  const paymentsByInvoice = new Map<string, number>()
  const paymentRowsByInvoice = new Map<string, PortalBillPaymentOut[]>()
  for (const p of payments) {
    if (!p.invoice_id) continue
    paymentsByInvoice.set(p.invoice_id, (paymentsByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
    const rows = paymentRowsByInvoice.get(p.invoice_id) ?? []
    rows.push({
      date: (p.paid_on ?? '').trim() ? String(p.paid_on).slice(0, 10) : null,
      method: (p.payment_type ?? '').trim() || 'Payment',
      amount: round2(Number(p.amount ?? 0)),
    })
    paymentRowsByInvoice.set(p.invoice_id, rows)
  }
  for (const rows of paymentRowsByInvoice.values()) {
    rows.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
  }

  const asGcFields = (job: PortalJobRow): Pick<PortalBillOut, 'asGc' | 'ownerName'> => {
    const asGc = markGcRows && jobIsAsGc(job, viewerCustomerId)
    const owner = asGc && job.customer_id ? (ownerNames[job.customer_id] ?? '').trim() : ''
    return { asGc, ownerName: asGc && owner ? owner : null }
  }

  const bills: PortalBillOut[] = []
  const jobsWithLines = new Set<string>()
  for (const inv of invoices) {
    const job = jobById.get(inv.job_id)
    if (!job) continue
    jobsWithLines.add(inv.job_id)
    const open = round2(Number(inv.amount ?? 0) - (paymentsByInvoice.get(inv.id) ?? 0))
    if (open <= 0) continue
    // Share this bill (v2.3375): the ledger carries what the viewer owes and
    // nothing else — a bill sent to the other party never rides in this list.
    if (statementRoleFor(job, inv, viewerCustomerId) !== 'owed') continue
    bills.push({
      jobLabel: jobLabel(job),
      jobNumber: jobNumber(job),
      jobName: (job.job_name ?? '').trim() || null,
      serviceTag: jobTradeTag(job),
      jobAddress: (job.job_address ?? '').trim() || null,
      amount: open,
      billedOn: inv.billed_at ? String(inv.billed_at).slice(0, 10) : null,
      payUrl: (inv.hosted_invoice_url ?? '').trim() || null,
      checkRef: jobNumber(job) || String(inv.sequence_order ?? ''),
      ...asGcFields(job),
      payments: paymentRowsByInvoice.get(inv.id) ?? [],
      totalPaid: round2(paymentsByInvoice.get(inv.id) ?? 0),
    })
  }
  for (const job of shellJobs) {
    if (jobsWithLines.has(job.id)) continue
    const open = round2(Number(job.revenue ?? 0) - Number(job.payments_made ?? 0))
    if (open <= 0) continue
    if (statementRoleFor(job, null, viewerCustomerId) !== 'owed') continue
    bills.push({
      jobLabel: jobLabel(job),
      jobNumber: jobNumber(job),
      jobName: (job.job_name ?? '').trim() || null,
      serviceTag: jobTradeTag(job),
      jobAddress: (job.job_address ?? '').trim() || null,
      amount: open,
      billedOn: null,
      payUrl: null,
      checkRef: jobNumber(job),
      ...asGcFields(job),
      payments: [],
      totalPaid: round2(Number(job.payments_made ?? 0)),
    })
  }
  bills.sort((a, b) => (b.billedOn ?? '9999').localeCompare(a.billedOn ?? '9999'))
  return bills
}

/**
 * Share this bill (v2.3375): the bills on this viewer's jobs that someone
 * else pays and the office chose to show them — the GC's card ("Your
 * customers' open bills") or the owner's ("On your job, billed to your
 * builder"). Open amounts only, oldest billed first; never in the balance,
 * never payable here. A bill with no stamp (or a stamp for the wrong party)
 * is not in this list and not in the payload at all.
 */
export type PortalSharedBillOut = {
  jobLabel: string
  jobNumber: string
  jobName: string | null
  serviceTag: string | null
  jobAddress: string | null
  /** Still open (dollars). */
  amount: number
  /** What was billed (dollars) — the "of $6,420.00" sub-line. */
  billedAmount: number
  totalPaid: number
  billedOn: string | null
  /** Who the bill went to: the payer's name (or a typed recipient's). */
  billedTo: string
  /** The viewer's role on this job: the GC seeing a customer's bill, or the customer seeing the builder's. */
  viewerRole: 'gc' | 'customer'
}

export function buildPortalSharedBills(args: {
  jobs: PortalJobRow[]
  invoices: PortalInvoiceRow[]
  payments: PortalPaymentRow[]
  viewerCustomerId: string
  /** customer_id → display name for every party on these jobs (owners and GCs). */
  partyNames?: Record<string, string>
}): PortalSharedBillOut[] {
  const { jobs, invoices, payments, viewerCustomerId, partyNames = {} } = args
  const openBillJobs = jobs.filter((j) => jobCarriesOpenBills(j.status))
  const jobById = new Map(openBillJobs.map((j) => [j.id, j]))
  const paymentsByInvoice = new Map<string, number>()
  for (const p of payments) {
    if (!p.invoice_id) continue
    paymentsByInvoice.set(p.invoice_id, (paymentsByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
  }
  const billedToFor = (job: PortalJobRow, inv: PortalInvoiceRow | null): string => {
    const party = effectiveInvoiceParty(job, inv)
    if (party === 'other') return (inv?.bill_to_name ?? '').trim() || 'someone else'
    const payerId = payerCustomerId(job, party)
    return (payerId ? partyNames[payerId] ?? '' : '').trim() || (party === 'gc' ? 'the builder' : 'the owner')
  }
  const viewerRoleFor = (job: PortalJobRow): 'gc' | 'customer' =>
    (job.gc_customer_id ?? '') === viewerCustomerId && (job.customer_id ?? '') !== viewerCustomerId ? 'gc' : 'customer'

  const out: PortalSharedBillOut[] = []
  const jobsWithLines = new Set<string>()
  for (const inv of invoices) {
    const job = jobById.get(inv.job_id)
    if (!job) continue
    jobsWithLines.add(inv.job_id)
    if (statementRoleFor(job, inv, viewerCustomerId) !== 'shared') continue
    const paid = round2(paymentsByInvoice.get(inv.id) ?? 0)
    const open = round2(Number(inv.amount ?? 0) - paid)
    if (open <= 0) continue
    out.push({
      jobLabel: jobLabel(job),
      jobNumber: jobNumber(job),
      jobName: (job.job_name ?? '').trim() || null,
      serviceTag: jobTradeTag(job),
      jobAddress: (job.job_address ?? '').trim() || null,
      amount: open,
      billedAmount: round2(Number(inv.amount ?? 0)),
      totalPaid: paid,
      billedOn: inv.billed_at ? String(inv.billed_at).slice(0, 10) : null,
      billedTo: billedToFor(job, inv),
      viewerRole: viewerRoleFor(job),
    })
  }
  for (const job of openBillJobs.filter((j) => jobPrintsShellRemainder(j.status))) {
    if (jobsWithLines.has(job.id)) continue
    if (shownToPartyFor(job, null) == null || statementRoleFor(job, null, viewerCustomerId) !== 'shared') continue
    const paid = round2(Number(job.payments_made ?? 0))
    const open = round2(Number(job.revenue ?? 0) - paid)
    if (open <= 0) continue
    out.push({
      jobLabel: jobLabel(job),
      jobNumber: jobNumber(job),
      jobName: (job.job_name ?? '').trim() || null,
      serviceTag: jobTradeTag(job),
      jobAddress: (job.job_address ?? '').trim() || null,
      amount: open,
      billedAmount: round2(Number(job.revenue ?? 0)),
      totalPaid: paid,
      billedOn: null,
      billedTo: billedToFor(job, null),
      viewerRole: viewerRoleFor(job),
    })
  }
  // Oldest billed first — the one the GC should ask about is on top; undated shells last.
  out.sort((a, b) => (a.billedOn ?? '9999').localeCompare(b.billedOn ?? '9999'))
  return out
}
