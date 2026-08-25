/**
 * HCP reconcile kernels (v2.2255) — Billing Truth Plan Phase 3.
 *
 * Turns the one-off 2026-08-24 psql backfills into a repeatable Settings
 * flow. Two lanes, both pure (parsed CSV cells + current app rows in, a
 * reviewable plan out; nothing writes here):
 *
 *   Lane 1 — the HCP *invoices* export: create dated `status='paid'`
 *   invoices for paid single-invoice HCP jobs that have payments but no app
 *   invoice, stamp `billed_at` on undated singles, and link unlinked
 *   payments. Open HCP invoices are never imported — the app is the system
 *   of record since the migration (owner ruling, 2026-08-24).
 *
 *   Lane 2 — the HCP *payments* export (+ the *jobs* export as the bridge):
 *   correct `paid_on` to HCP's true received date on job-scoped unique
 *   amount matches, and split import rollups (one app payment = the sum of
 *   the job's real payments). Bank(Mercury)- and Stripe-dated rows are
 *   never touched. Corrected/split rows get note tags the pay-speed
 *   quarantine (v2.2248) recognizes as verified.
 *
 * CRITICAL export gotcha (cost a wasted join on 2026-08-24): the payments
 * export's "Invoice Number" is a DIFFERENT numbering series than the
 * invoices export's "Invoice #". Payments resolve to jobs only via
 * (customer name + job created timestamp) against the jobs export.
 */
import { parseCsv } from '../parseCsv'
import { normalizeHcpNumber } from '../customers/backfillHcpPayments'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

// ---------------------------------------------------------------------------
// App-side slices (fetched by the section, passed in flat)
// ---------------------------------------------------------------------------

export type ReconcileJob = { id: string; hcp_number: string | null }

export type ReconcileInvoice = {
  id: string
  job_id: string
  status: string
  billed_at: string | null
  estimated_bill_date: string | null
  stripe_invoice_id: string | null
  external_send_note: string | null
}

export type ReconcilePayment = {
  id: string
  job_id: string
  amount: number | string | null
  paid_on: string | null
  invoice_id: string | null
  payment_type: string | null
  note: string | null
  sequence_order: number | null
  mercury_transaction_id: string | null
}

/** Job number → app job id, only when exactly one job carries that number. */
export function buildJobNumberMap(jobs: ReconcileJob[]): Map<string, string> {
  const counts = new Map<string, { id: string; n: number }>()
  for (const j of jobs) {
    const num = normalizeHcpNumber(j.hcp_number)
    if (!num || !/^\d+$/.test(num)) continue
    const cur = counts.get(num)
    if (cur) cur.n += 1
    else counts.set(num, { id: j.id, n: 1 })
  }
  const out = new Map<string, string>()
  for (const [num, v] of counts) if (v.n === 1) out.set(num, v.id)
  return out
}

const num = (v: number | string | null | undefined): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** The invoice's bill day (YYYY-MM-DD): billed_at's Chicago calendar day, else the est. bill date. */
function invoiceBilledYmd(inv: ReconcileInvoice): string | null {
  if (inv.billed_at) {
    const ymd = calendarYmdInAppTzFromIso(inv.billed_at)
    if (ymd) return ymd
  }
  const est = (inv.estimated_bill_date ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(est) ? est.slice(0, 10) : null
}

// ---------------------------------------------------------------------------
// Lane 1 — invoices export
// ---------------------------------------------------------------------------

export type HcpInvoiceExportRow = {
  invoiceNo: string
  jobNumber: string
  status: string
  /** ISO timestamp of the latest send (null = never sent through HCP). */
  sentAtIso: string | null
}

/** Header-tolerant parse of the HCP invoices export; null when it isn't that file. */
export function parseHcpInvoicesExport(text: string): HcpInvoiceExportRow[] | null {
  const rows = parseCsv(text)
  const header = rows[0]
  if (!header) return null
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name)
  const invCol = col('invoice #')
  const statusCol = col('invoice status')
  const sendCol = col('latest send date')
  const jobCol = col('job #')
  if (invCol === -1 || statusCol === -1 || sendCol === -1 || jobCol === -1) return null
  const out: HcpInvoiceExportRow[] = []
  for (const row of rows.slice(1)) {
    const jobNumber = normalizeHcpNumber(row[jobCol])
    if (!jobNumber || !/^\d+$/.test(jobNumber)) continue
    const sent = (row[sendCol] ?? '').trim()
    out.push({
      invoiceNo: (row[invCol] ?? '').trim(),
      jobNumber,
      status: (row[statusCol] ?? '').trim(),
      sentAtIso: sent || null,
    })
  }
  return out
}

export type InvoicePlanCreate = {
  jobId: string
  jobNumber: string
  invoiceNo: string
  sentAtIso: string
  /** Invoice amount = the job's payment sum (a fully-paid invoice covers what was paid). */
  amount: number
  /** Unlinked payment ids to attach to the new invoice. */
  linkPaymentIds: string[]
}

export type InvoicePlanStamp = { invoiceId: string; jobNumber: string; sentAtIso: string }
export type InvoicePlanLink = { paymentId: string; invoiceId: string; jobNumber: string }
export type ReconcileSkip = { key: string; reason: string; count: number }

export type InvoiceReconcilePlan = {
  creates: InvoicePlanCreate[]
  stamps: InvoicePlanStamp[]
  links: InvoicePlanLink[]
  skips: ReconcileSkip[]
  exportRows: number
}

function addSkip(map: Map<string, number>, reason: string) {
  map.set(reason, (map.get(reason) ?? 0) + 1)
}

export function buildInvoiceReconcilePlan(
  exportRows: HcpInvoiceExportRow[],
  jobs: ReconcileJob[],
  invoices: ReconcileInvoice[],
  payments: ReconcilePayment[],
): InvoiceReconcilePlan {
  const jobByNumber = buildJobNumberMap(jobs)
  const invoicesByJob = new Map<string, ReconcileInvoice[]>()
  for (const i of invoices) {
    const list = invoicesByJob.get(i.job_id)
    if (list) list.push(i)
    else invoicesByJob.set(i.job_id, [i])
  }
  const paymentsByJob = new Map<string, ReconcilePayment[]>()
  for (const p of payments) {
    const list = paymentsByJob.get(p.job_id)
    if (list) list.push(p)
    else paymentsByJob.set(p.job_id, [p])
  }

  const skips = new Map<string, number>()
  // Group export rows per job number first — multi-invoice jobs are deferred
  // (pairing needs per-invoice amounts the export doesn't carry).
  const byJobNumber = new Map<string, HcpInvoiceExportRow[]>()
  for (const r of exportRows) {
    if (r.status !== 'Paid') {
      addSkip(skips, 'Open/unpaid in HCP — not imported (the app is the system of record)')
      continue
    }
    if (!r.sentAtIso) {
      addSkip(skips, 'Paid but never sent through HCP — no bill date to import')
      continue
    }
    const list = byJobNumber.get(r.jobNumber)
    if (list) list.push(r)
    else byJobNumber.set(r.jobNumber, [r])
  }

  const creates: InvoicePlanCreate[] = []
  const stamps: InvoicePlanStamp[] = []
  const links: InvoicePlanLink[] = []

  for (const [jobNumber, rows] of byJobNumber) {
    const jobId = jobByNumber.get(jobNumber)
    if (!jobId) {
      addSkip(skips, 'No app job with this number (or the number is ambiguous)')
      continue
    }
    if (rows.length > 1) {
      addSkip(skips, 'Multiple HCP invoices on one job — needs per-invoice amounts (deferred)')
      continue
    }
    const row = rows[0]!
    const jobInvoices = invoicesByJob.get(jobId) ?? []
    const jobPayments = paymentsByJob.get(jobId) ?? []

    if (jobInvoices.length === 0) {
      const paySum = jobPayments.reduce((s, p) => s + num(p.amount), 0)
      if (jobPayments.length === 0 || paySum <= 0) {
        addSkip(skips, 'Job has no payments — creating an open bill would change the board (skipped)')
        continue
      }
      creates.push({
        jobId,
        jobNumber,
        invoiceNo: row.invoiceNo,
        sentAtIso: row.sentAtIso!,
        amount: paySum,
        linkPaymentIds: jobPayments.filter((p) => !p.invoice_id).map((p) => p.id),
      })
      continue
    }

    if (jobInvoices.length === 1) {
      const inv = jobInvoices[0]!
      if (!inv.billed_at && (inv.status === 'billed' || inv.status === 'paid')) {
        stamps.push({ invoiceId: inv.id, jobNumber, sentAtIso: row.sentAtIso! })
      }
      if (inv.status === 'paid' && (inv.billed_at || row.sentAtIso)) {
        for (const p of jobPayments) {
          if (!p.invoice_id) links.push({ paymentId: p.id, invoiceId: inv.id, jobNumber })
        }
      }
      if (inv.billed_at && jobPayments.every((p) => p.invoice_id)) {
        addSkip(skips, 'Already reconciled — dated invoice, every payment linked')
      }
      continue
    }

    addSkip(skips, 'Job already has multiple app invoices — left alone')
  }

  return {
    creates,
    stamps,
    links,
    skips: [...skips.entries()].map(([reason, count]) => ({ key: reason, reason, count })),
    exportRows: exportRows.length,
  }
}

// ---------------------------------------------------------------------------
// Lane 2 — payments export + jobs-export bridge
// ---------------------------------------------------------------------------

export type HcpPaymentExportRow = {
  customer: string
  jobCreatedIso: string
  /** Chicago calendar day the money arrived. */
  paidYmd: string
  amount: number
  paymentType: string
}

export function parseHcpPaymentsExport(text: string): HcpPaymentExportRow[] | null {
  const rows = parseCsv(text)
  const header = rows[0]
  if (!header) return null
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name)
  const recCol = col('payment received date')
  const createdCol = col('job created date')
  const custCol = col('customer name')
  const amtCol = col('payment amount')
  const typeCol = col('payment type')
  if (recCol === -1 || createdCol === -1 || custCol === -1 || amtCol === -1) return null
  const out: HcpPaymentExportRow[] = []
  for (const row of rows.slice(1)) {
    const rec = (row[recCol] ?? '').trim()
    const created = (row[createdCol] ?? '').trim()
    if (!rec || !created) continue
    const paidYmd = calendarYmdInAppTzFromIso(rec)
    if (!paidYmd) continue
    out.push({
      customer: (row[custCol] ?? '').trim(),
      jobCreatedIso: created,
      paidYmd,
      amount: num((row[amtCol] ?? '').replace(/[$,]/g, '')),
      paymentType: typeCol === -1 ? '' : (row[typeCol] ?? '').trim(),
    })
  }
  return out
}

export type HcpJobsBridgeRow = { jobNumber: string; customer: string; createdIso: string }

export function parseHcpJobsBridge(text: string): HcpJobsBridgeRow[] | null {
  const rows = parseCsv(text)
  const header = rows[0]
  if (!header) return null
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name)
  const jobCol = col('job #')
  const custCol = col('customer name')
  const createdCol = col('job created date')
  if (jobCol === -1 || custCol === -1 || createdCol === -1) return null
  const out: HcpJobsBridgeRow[] = []
  for (const row of rows.slice(1)) {
    const jobNumber = normalizeHcpNumber(row[jobCol])
    const created = (row[createdCol] ?? '').trim()
    if (!jobNumber || !/^\d+$/.test(jobNumber) || !created) continue
    out.push({ jobNumber, customer: (row[custCol] ?? '').trim(), createdIso: created })
  }
  return out
}

export type PaymentPlanCorrection = {
  paymentId: string
  jobNumber: string
  amount: number
  fromYmd: string | null
  toYmd: string
  /** New note (existing note preserved, verified tag appended). */
  newNote: string
}

export type PaymentPlanSplitInsert = {
  amount: number
  paidYmd: string
  paymentType: string
  invoiceId: string | null
  sequenceOrder: number
}

export type PaymentPlanSplit = {
  deletePaymentId: string
  jobId: string
  jobNumber: string
  rollupAmount: number
  inserts: PaymentPlanSplitInsert[]
}

export type PaymentReconcilePlan = {
  corrections: PaymentPlanCorrection[]
  splits: PaymentPlanSplit[]
  skips: ReconcileSkip[]
  exportRows: number
  resolvedRows: number
}

/** The verified-date tags the pay-speed quarantine (v2.2248) recognizes. */
export const CORRECTED_TAG_PREFIX = 'hcp-paydate-corrected-'
export const SPLIT_TAG_PREFIX = 'hcp-payments-split-'

export function appendNoteTag(existing: string | null, tag: string): string {
  const trimmed = (existing ?? '').trim()
  return trimmed ? `${trimmed} · ${tag}` : tag
}

export function buildPaymentReconcilePlan(
  payRows: HcpPaymentExportRow[],
  bridge: HcpJobsBridgeRow[],
  jobs: ReconcileJob[],
  invoices: ReconcileInvoice[],
  payments: ReconcilePayment[],
  runYmd: string,
): PaymentReconcilePlan {
  const correctedTag = `${CORRECTED_TAG_PREFIX}${runYmd}`
  const jobIdByNumber = buildJobNumberMap(jobs)
  const numberByJobId = new Map<string, string>()
  for (const [jobNum, id] of jobIdByNumber) numberByJobId.set(id, jobNum)
  const skips = new Map<string, number>()

  // bridge: (customer, created timestamp) → job number; drop ambiguous pairs
  const bridgeKey = (cust: string, iso: string) => `${cust} ${new Date(iso).getTime()}`
  const bridgeMap = new Map<string, string | null>()
  for (const b of bridge) {
    const key = bridgeKey(b.customer, b.createdIso)
    if (bridgeMap.has(key) && bridgeMap.get(key) !== b.jobNumber) bridgeMap.set(key, null)
    else bridgeMap.set(key, b.jobNumber)
  }

  const invoiceById = new Map(invoices.map((i) => [i.id, i]))
  const stripeLocked = (p: ReconcilePayment) => {
    if (!p.invoice_id) return false
    return Boolean(invoiceById.get(p.invoice_id)?.stripe_invoice_id)
  }

  type Resolved = HcpPaymentExportRow & { jobNumber: string }
  const resolved: Resolved[] = []
  for (const r of payRows) {
    const jobNumber = bridgeMap.get(bridgeKey(r.customer, r.jobCreatedIso))
    if (!jobNumber) {
      addSkip(skips, 'Payment could not be matched to a job (job missing from the jobs export, or ambiguous)')
      continue
    }
    resolved.push({ ...r, jobNumber })
  }

  const paymentsByJobNumber = new Map<string, ReconcilePayment[]>()
  for (const p of payments) {
    const jobNum = numberByJobId.get(p.job_id)
    if (!jobNum) continue
    const list = paymentsByJobNumber.get(jobNum)
    if (list) list.push(p)
    else paymentsByJobNumber.set(jobNum, [p])
  }
  const resolvedByJob = new Map<string, Resolved[]>()
  for (const r of resolved) {
    const list = resolvedByJob.get(r.jobNumber)
    if (list) list.push(r)
    else resolvedByJob.set(r.jobNumber, [r])
  }

  const corrections: PaymentPlanCorrection[] = []
  const splits: PaymentPlanSplit[] = []

  for (const [jobNumber, hcpRows] of resolvedByJob) {
    const appRows = paymentsByJobNumber.get(jobNumber) ?? []
    if (appRows.length === 0) {
      addSkip(skips, 'HCP payment on a job with no app payments — adding money needs owner review')
      continue
    }

    // job-scoped unique amount matches
    const matchedApp = new Set<string>()
    const matchedHcp = new Set<Resolved>()
    for (const ap of appRows) {
      const amount = num(ap.amount)
      const hcpSame = hcpRows.filter((h) => h.amount === amount)
      const appSame = appRows.filter((a) => num(a.amount) === amount)
      if (hcpSame.length !== 1 || appSame.length !== 1) continue
      const hcp = hcpSame[0]!
      matchedApp.add(ap.id)
      matchedHcp.add(hcp)
      if ((ap.paid_on ?? '') === hcp.paidYmd) continue
      if (ap.mercury_transaction_id) {
        addSkip(skips, 'Date differs but the app date is bank-sourced (Mercury) — kept')
        continue
      }
      if (stripeLocked(ap)) {
        addSkip(skips, 'Date differs but the app date is Stripe-sourced — kept')
        continue
      }
      corrections.push({
        paymentId: ap.id,
        jobNumber,
        amount,
        fromYmd: ap.paid_on,
        toYmd: hcp.paidYmd,
        newNote: appendNoteTag(ap.note, correctedTag),
      })
    }

    // rollup split: exactly one unmatched app payment whose amount = sum of the
    // job's unmatched HCP payments (>= 2 of them)
    const residualApp = appRows.filter((a) => !matchedApp.has(a.id))
    const residualHcp = hcpRows.filter((h) => !matchedHcp.has(h))
    if (residualApp.length === 1 && residualHcp.length >= 2) {
      const rollup = residualApp[0]!
      const sum = residualHcp.reduce((s, h) => s + h.amount, 0)
      if (Math.abs(sum - num(rollup.amount)) < 0.005) {
        if (rollup.mercury_transaction_id || stripeLocked(rollup)) {
          addSkip(skips, 'Rollup matches a split but the row is bank/Stripe-locked — kept')
          continue
        }
        const inv = rollup.invoice_id ? invoiceById.get(rollup.invoice_id) : undefined
        const billedYmd = inv ? invoiceBilledYmd(inv) : null
        const baseSeq = rollup.sequence_order ?? 0
        splits.push({
          deletePaymentId: rollup.id,
          jobId: rollup.job_id,
          jobNumber,
          rollupAmount: num(rollup.amount),
          inserts: [...residualHcp]
            .sort((a, b) => (a.paidYmd < b.paidYmd ? -1 : 1))
            .map((h, i) => ({
              amount: h.amount,
              paidYmd: h.paidYmd,
              paymentType: h.paymentType || 'HCP import',
              // A draw before the bill went out did not pay that bill.
              invoiceId:
                rollup.invoice_id && (!billedYmd || h.paidYmd >= billedYmd) ? rollup.invoice_id : null,
              sequenceOrder: baseSeq + i,
            })),
        })
      } else {
        addSkip(skips, 'Amounts do not reconcile exactly (fees/partials) — left for review')
      }
    } else if (residualHcp.length > 0) {
      addSkip(skips, 'Amounts do not reconcile exactly (fees/partials) — left for review')
    }
  }

  return {
    corrections,
    splits,
    skips: [...skips.entries()].map(([reason, count]) => ({ key: reason, reason, count })),
    exportRows: payRows.length,
    resolvedRows: resolved.length,
  }
}

/** Note value for split-inserted rows (kept out of the quarantine by tag). */
export function splitInsertNote(runYmd: string): string {
  return `${SPLIT_TAG_PREFIX}${runYmd}`
}

/** external_send_note for lane-1 created invoices. */
export function backfillInvoiceNote(runYmd: string, invoiceNo: string): string {
  return `hcp-backfill-${runYmd} (HCP invoice #${invoiceNo})`
}
