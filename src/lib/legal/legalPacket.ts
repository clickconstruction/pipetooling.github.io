/**
 * Legal packet kernel (Legal desk PR 1, v2.3293).
 *
 * Assembles everything a collections attorney would ask for about ONE paying
 * account that the office has parked in Collections — from records the app
 * already keeps — into the five sections the future firm portal mirrors:
 *
 *   Account · Paper · Their word · Evidence · Fees & steps
 *
 * plus the gap list the office works through BEFORE anything is released to a
 * firm ("is this attorney-ready?"). Pure: no React, no supabase. Inputs are the
 * row shapes the existing kernels already type; the loader hook fetches them.
 *
 * An "account" is the PAYER — the GC when one pays, else the job's customer —
 * and spans every Collections job that payer owes on. A petition names one
 * defendant; the packet follows.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { Database } from '../../types/database'
import {
  buildJobContractCoverage,
  type JobContractCoverage,
  type JobContractRowLike,
  type SignedEstimateLike,
} from '../jobs/jobContractCoverage'
import { type JobDemandLetterRow, liveDemandLetters } from '../jobs/demandLetterTracking'
import { type JobLienFilingRow, liveFilings } from '../jobs/lienDeadlines'
import { customerAddressLienGaps, type CustomerAddressRow } from '../jobs/lienProperty'
import type { PaymentPromise, PromiseOutcome } from '../jobs/paymentPromises'
import type { ChaseTouch } from '../jobs/paymentChase'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

// ---------------------------------------------------------------------------
// Payer grouping
// ---------------------------------------------------------------------------

/** `c:<customer id>` when the payer has a customers row, else `n:<name>` (name-only jobs). */
export type LegalPayerKey = string

export type LegalPayer = {
  key: LegalPayerKey
  customerId: string | null
  name: string
  /** True when the payer is the job's GC rather than its customer. */
  viaGc: boolean
}

export function payerForJob(
  job: Pick<JobWithDetails, 'customer_id' | 'customer_name' | 'gc_customer_id' | 'gcCustomer'>,
): LegalPayer {
  if (job.gc_customer_id) {
    return {
      key: `c:${job.gc_customer_id}`,
      customerId: job.gc_customer_id,
      name: (job.gcCustomer?.name ?? '').trim() || 'GC',
      viaGc: true,
    }
  }
  const name = (job.customer_name ?? '').trim() || 'Unnamed customer'
  if (job.customer_id) return { key: `c:${job.customer_id}`, customerId: job.customer_id, name, viaGc: false }
  return { key: `n:${name.toLowerCase()}`, customerId: null, name, viaGc: false }
}

/** Money still open on a billed invoice: amount − payments applied to it, never below 0. */
export function invoiceOpenAmount(inv: Pick<JobsLedgerInvoice, 'id' | 'amount'>, payments: JobWithDetails['payments']): number {
  const applied = (payments ?? [])
    .filter((p) => p.invoice_id === inv.id)
    .reduce((s, p) => s + Number(p.amount ?? 0), 0)
  return Math.max(0, Number(inv.amount ?? 0) - applied)
}

/**
 * What the account still owes on one job: the open billed lines when any exist,
 * else the job-level remainder (a billed job-shell with no bill line — the
 * "No line" case the board flags).
 */
export function jobOpenBalance(job: JobWithDetails): number {
  const billed = (job.invoices ?? []).filter((i) => i.status === 'billed')
  if (billed.length > 0) return billed.reduce((s, i) => s + invoiceOpenAmount(i, job.payments), 0)
  return Math.max(0, Number(job.revenue ?? 0) - Number(job.payments_made ?? 0))
}

export type LegalAccountSummary = LegalPayer & {
  jobs: JobWithDetails[]
  balance: number
  /** Days since the oldest open bill (or the oldest collections flag when no bill date). */
  oldestDays: number | null
  /** Jobs in this account with a signed agreement on file. */
  signedJobs: number
}

export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const a = Date.UTC(Number(fromYmd.slice(0, 4)), Number(fromYmd.slice(5, 7)) - 1, Number(fromYmd.slice(8, 10)))
  const b = Date.UTC(Number(toYmd.slice(0, 4)), Number(toYmd.slice(5, 7)) - 1, Number(toYmd.slice(8, 10)))
  return Math.round((b - a) / 86_400_000)
}

function ymdOfIso(iso: string | null | undefined): string | null {
  if (!iso) return null
  const s = String(iso)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}

/** Oldest reference day for aging: the earliest billed_at among open lines, else the job's last_bill_date, else the collections flag. */
export function jobAgingYmd(job: JobWithDetails): string | null {
  const billedYmds = (job.invoices ?? [])
    .filter((i) => i.status === 'billed')
    .map((i) => ymdOfIso(i.billed_at))
    .filter((y): y is string => y != null)
    .sort()
  return billedYmds[0] ?? ymdOfIso(job.last_bill_date) ?? ymdOfIso(job.collections_at) ?? null
}

/** Group Collections jobs into payer accounts, largest balance first. */
export function groupCollectionsByPayer(
  jobs: ReadonlyArray<JobWithDetails>,
  coverage: ReadonlyMap<string, JobContractCoverage>,
  todayYmd: string,
): LegalAccountSummary[] {
  const byKey = new Map<LegalPayerKey, LegalAccountSummary>()
  for (const job of jobs) {
    const payer = payerForJob(job)
    const acc = byKey.get(payer.key) ?? { ...payer, jobs: [], balance: 0, oldestDays: null, signedJobs: 0 }
    acc.jobs.push(job)
    acc.balance += jobOpenBalance(job)
    const aging = jobAgingYmd(job)
    if (aging) {
      const d = daysBetweenYmd(aging, todayYmd)
      acc.oldestDays = acc.oldestDays == null ? d : Math.max(acc.oldestDays, d)
    }
    if (coverage.get(job.id)?.kind === 'signed') acc.signedJobs += 1
    byKey.set(payer.key, acc)
  }
  return [...byKey.values()].sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------------------
// Packet input / output
// ---------------------------------------------------------------------------

export type LegalCustomerLike = {
  id: string
  name: string
  address: string | null
  contact_info: unknown
  payment_terms: string | null
  payment_terms_note: string | null
} | null

export type LegalContactLike = { name: string; email: string | null; phone: string | null; note: string | null }

export type LegalReportLike = {
  jobId: string
  createdAt: string
  authorName: string
  templateName: string
  hasGps: boolean
}

export type LegalClockSessionLike = {
  jobId: string
  workDate: string
  clockedInAt: string
  clockedOutAt: string | null
  hasGps: boolean
  approved: boolean
  /** Rejected or revoked sessions never count as evidence. */
  disqualified: boolean
}

export type LegalThreadNoteLike = { jobId: string; body: string; createdAt: string; authorName: string | null }

export type LegalPacketInput = {
  todayYmd: string
  account: LegalAccountSummary
  customer: LegalCustomerLike
  contacts: ReadonlyArray<LegalContactLike>
  addresses: ReadonlyArray<CustomerAddressRow>
  contracts: ReadonlyArray<JobContractRowLike>
  signedEstimates: ReadonlyArray<SignedEstimateLike>
  demandLetters: ReadonlyArray<JobDemandLetterRow>
  lienFilings: ReadonlyArray<JobLienFilingRow>
  /** Promise details (who said it, how) — list_job_payment_promises. */
  promises: ReadonlyArray<PaymentPromise>
  /** Promise outcomes (kept / late / broken / open) — classifyPromises over list_payment_promise_records. */
  promiseOutcomes: ReadonlyArray<PromiseOutcome>
  chaseTouches: ReadonlyArray<ChaseTouch>
  reports: ReadonlyArray<LegalReportLike>
  clockSessions: ReadonlyArray<LegalClockSessionLike>
  threadNotes: ReadonlyArray<LegalThreadNoteLike>
  /** For naming who flagged Collections. */
  users: ReadonlyArray<{ id: string; name: string | null }>
}

export type LegalLedgerEntry = {
  ymd: string | null
  jobId: string
  jobLabel: string
  kind: 'invoice' | 'payment' | 'write_down'
  text: string
  /** Positive for invoices, negative for payments / write-downs. */
  amount: number
}

export type LegalJobLine = {
  jobId: string
  label: string
  name: string
  address: string
  balance: number
  agingDays: number | null
  collectionsNote: string | null
  collectionsBy: string | null
  collectionsYmd: string | null
  contract: JobContractCoverage
}

export type LegalPropertyLine = {
  address: string
  county: string
  owner: string
  legalDescription: string
  parcelId: string
  propertyKind: string
  homestead: boolean
  /** From customerAddressLienGaps — empty means lien-ready. */
  gaps: string[]
}

export type LegalDemandLine = {
  jobLabel: string
  amount: number
  sentYmd: string | null
  method: string
  tracking: string
  deadlineYmd: string | null
  deadlinePassed: boolean
  recipient: string
}

export type LegalFilingLine = {
  jobLabel: string
  kind: string
  amount: number
  monthsCovered: string[]
  filedYmd: string | null
  servedYmd: string | null
  serveDueYmd: string | null
  county: string
  recordingNumber: string
  sends: number
}

export type LegalPromiseLine = {
  jobLabel: string
  promisedYmd: string
  saidBy: string | null
  heardBy: string | null
  channel: string | null
  source: 'office' | 'customer'
  state: PromiseOutcome['state'] | 'unknown'
  note: string | null
  createdAt: string
}

export type LegalTouchLine = {
  jobLabel: string | null
  createdAt: string
  outcome: ChaseTouch['outcome']
  note: string | null
  promisedYmd: string | null
  by: string
}

export type LegalEvidenceJob = {
  jobId: string
  jobLabel: string
  reports: number
  reportsWithGps: number
  latestReport: LegalReportLike | null
  sessions: number
  approvedSessions: number
  sessionsWithGps: number
  hours: number
  firstWorkYmd: string | null
  lastWorkYmd: string | null
  threadNotes: number
  latestNote: LegalThreadNoteLike | null
  picturesLink: string | null
  driveLink: string | null
}

export type LegalStep = {
  ymd: string | null
  sortKey: string
  kind: 'billed' | 'sent' | 'payment' | 'promise' | 'call' | 'demand' | 'filing' | 'collections' | 'contract'
  text: string
  jobLabel: string | null
}

export type LegalGapSeverity = 'stop' | 'warn'

export type LegalGap = {
  key: string
  severity: LegalGapSeverity
  label: string
  detail: string
  jobId: string | null
  /** Where the office fixes it. */
  fix: 'contract' | 'lien_instruments' | 'edit_customer' | 'edit_job' | 'call_mode' | 'none'
}

export type LegalExhibit = { letter: string; title: string; count: number }

export type LegalPacket = {
  account: {
    payer: LegalPayer
    customerAddress: string
    paymentTerms: string
    paymentTermsNote: string | null
    contacts: LegalContactLike[]
    /** Emails / phones found anywhere: contacts, customer contact_info, job denormalized fields. */
    emails: string[]
    phones: string[]
    properties: LegalPropertyLine[]
    jobs: LegalJobLine[]
    ledger: LegalLedgerEntry[]
    totals: { billed: number; paid: number; writtenDown: number; balance: number; oldestDays: number | null }
  }
  paper: {
    agreements: Array<{ jobLabel: string; coverage: JobContractCoverage }>
    demandLetters: LegalDemandLine[]
    lienFilings: LegalFilingLine[]
  }
  theirWord: {
    promises: LegalPromiseLine[]
    kept: number
    decided: number
    broken: number
    touches: LegalTouchLine[]
    collectionsNotes: Array<{ jobLabel: string; note: string; by: string | null; ymd: string | null }>
  }
  evidence: LegalEvidenceJob[]
  feesAndSteps: {
    steps: LegalStep[]
    /** Empty until a firm exists (PR 3+); the tab says so. */
    fees: never[]
  }
  gaps: LegalGap[]
  readiness: { stops: number; warns: number; label: string }
  exhibits: LegalExhibit[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jobLabelOf(job: Pick<JobWithDetails, 'hcp_number' | 'click_number'>): string {
  return effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'
}

function uniqStrings(values: ReadonlyArray<string | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of values) {
    const s = (v ?? '').trim()
    if (!s) continue
    const k = s.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(s)
  }
  return out
}

function contactInfoFields(info: unknown): { emails: string[]; phones: string[] } {
  if (!info || typeof info !== 'object') return { emails: [], phones: [] }
  const rec = info as Record<string, unknown>
  const pick = (keys: string[]) =>
    keys.map((k) => rec[k]).filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  return { emails: pick(['email', 'billing_email', 'ap_email']), phones: pick(['phone', 'mobile', 'office_phone']) }
}

const PAYMENT_TERMS_LABEL: Record<string, string> = {
  standard: 'Standard',
  deposit_required: 'Deposit required',
  no_new_work_past_promise: 'No new work past a broken promise',
  winding_down: 'Winding down',
}

export function paymentTermsLabel(raw: string | null | undefined): string {
  const k = (raw ?? '').trim()
  return PAYMENT_TERMS_LABEL[k] ?? (k ? k : 'Standard')
}

const DEMAND_METHOD_LABEL: Record<string, string> = {
  certified_mail: 'Certified mail',
  traceable_courier: 'Traceable courier',
  email: 'Email',
  hand: 'Hand-delivered',
}

const FILING_KIND_LABEL: Record<string, string> = {
  notice_53_056: '§ 53.056 notice',
  affidavit: "Mechanic's lien affidavit",
  release_of_record: 'Release of record',
}

export function filingKindLabel(kind: string): string {
  return FILING_KIND_LABEL[kind] ?? kind
}

function hoursBetween(inIso: string, outIso: string | null): number {
  if (!outIso) return 0
  const ms = new Date(outIso).getTime() - new Date(inIso).getTime()
  return ms > 0 ? ms / 3_600_000 : 0
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// ---------------------------------------------------------------------------
// The build
// ---------------------------------------------------------------------------

export function buildLegalPacket(input: LegalPacketInput): LegalPacket {
  const { account, todayYmd } = input
  const jobs = account.jobs
  const jobIds = new Set(jobs.map((j) => j.id))
  const labelByJob = new Map(jobs.map((j) => [j.id, jobLabelOf(j)] as const))
  const userName = (id: string | null | undefined) =>
    id ? (input.users.find((u) => u.id === id)?.name ?? null) : null

  const coverage = buildJobContractCoverage(jobs, input.contracts, input.signedEstimates)

  // --- Account -------------------------------------------------------------
  const ci = contactInfoFields(input.customer?.contact_info)
  const emails = uniqStrings([
    ...input.contacts.map((c) => c.email),
    ...ci.emails,
    ...jobs.map((j) => j.customer_email),
  ])
  const phones = uniqStrings([
    ...input.contacts.map((c) => c.phone),
    ...ci.phones,
    ...jobs.map((j) => j.customer_phone),
  ])

  const properties: LegalPropertyLine[] = input.addresses.map((a) => ({
    address: a.address,
    county: (a.county ?? '').trim(),
    owner: [a.owner_company, a.owner_name].map((s) => (s ?? '').trim()).filter(Boolean).join(' · '),
    legalDescription: (a.legal_description ?? '').trim(),
    parcelId: (a.parcel_id ?? '').trim(),
    propertyKind: (a.property_kind ?? '').trim(),
    homestead: a.homestead,
    gaps: customerAddressLienGaps(a),
  }))

  const jobLines: LegalJobLine[] = jobs.map((j) => {
    const aging = jobAgingYmd(j)
    return {
      jobId: j.id,
      label: labelByJob.get(j.id) ?? '—',
      name: j.job_name,
      address: j.job_address,
      balance: jobOpenBalance(j),
      agingDays: aging ? daysBetweenYmd(aging, todayYmd) : null,
      collectionsNote: (j.collections_note ?? '').trim() || null,
      collectionsBy: userName(j.collections_by),
      collectionsYmd: ymdOfIso(j.collections_at),
      contract: coverage.get(j.id) ?? { kind: 'none' },
    }
  })

  const ledger: LegalLedgerEntry[] = []
  let billedTotal = 0
  let paidTotal = 0
  let writtenDown = 0
  for (const j of jobs) {
    const label = labelByJob.get(j.id) ?? '—'
    for (const inv of j.invoices ?? []) {
      if (inv.status !== 'billed' && inv.status !== 'paid') continue
      const amt = Number(inv.amount ?? 0)
      billedTotal += amt
      const channel = (inv.external_send_channel ?? '').trim()
      const sentYmd = ymdOfIso(inv.sent_to_customer_at)
      ledger.push({
        ymd: ymdOfIso(inv.billed_at) ?? sentYmd,
        jobId: j.id,
        jobLabel: label,
        kind: 'invoice',
        text: `Invoice · ${label}${channel ? ` · sent ${channel === 'stripe_manual' ? 'stripe' : channel}` : ''}${
          sentYmd ? ` ${sentYmd}` : ''
        }${inv.stripe_invoice_status ? ` · ${inv.stripe_invoice_status}` : ''}`,
        amount: amt,
      })
      const wd = inv.agreed_write_down_previous_amount
      if (inv.agreed_write_down_at && typeof wd === 'number' && wd > amt) {
        writtenDown += wd - amt
        ledger.push({
          ymd: ymdOfIso(inv.agreed_write_down_at),
          jobId: j.id,
          jobLabel: label,
          kind: 'write_down',
          text: `Agreed write-down · ${label}${inv.agreed_write_down_note ? ` · ${inv.agreed_write_down_note}` : ''}`,
          amount: -(wd - amt),
        })
      }
    }
    for (const p of j.payments ?? []) {
      const amt = Number(p.amount ?? 0)
      paidTotal += amt
      ledger.push({
        ymd: ymdOfIso(p.paid_on) ?? ymdOfIso(p.sent_on),
        jobId: j.id,
        jobLabel: label,
        kind: 'payment',
        text: `Payment · ${label}${p.payment_type ? ` · ${p.payment_type}` : ''}${p.reference_number ? ` · ref ${p.reference_number}` : ''}`,
        amount: -amt,
      })
    }
  }
  ledger.sort((a, b) => (a.ymd ?? '9999').localeCompare(b.ymd ?? '9999'))

  // --- Paper ---------------------------------------------------------------
  const agreements = jobLines
    .filter((l) => l.contract.kind !== 'none')
    .map((l) => ({ jobLabel: l.label, coverage: l.contract }))

  const demandLetters: LegalDemandLine[] = liveDemandLetters(
    input.demandLetters.filter((d) => jobIds.has(d.job_id)),
  ).map((d) => {
    const deadline = d.deadline_date
    return {
      jobLabel: labelByJob.get(d.job_id) ?? '—',
      amount: Number(d.amount ?? 0),
      sentYmd: ymdOfIso(d.sent_at),
      method: DEMAND_METHOD_LABEL[d.sent_method] ?? d.sent_method,
      tracking: d.tracking_number,
      deadlineYmd: deadline,
      deadlinePassed: Boolean(d.sent_at && deadline && deadline < todayYmd),
      recipient: d.recipient_name,
    }
  })

  const lienFilings: LegalFilingLine[] = liveFilings(input.lienFilings.filter((f) => jobIds.has(f.job_id))).map(
    (f) => ({
      jobLabel: labelByJob.get(f.job_id) ?? '—',
      kind: filingKindLabel(f.kind),
      amount: Number(f.amount ?? 0),
      monthsCovered: f.months_covered ?? [],
      filedYmd: ymdOfIso(f.filed_at),
      servedYmd: ymdOfIso(f.served_at),
      serveDueYmd: f.serve_due,
      county: f.county,
      recordingNumber: f.recording_number,
      sends: Array.isArray(f.sends) ? f.sends.length : 0,
    }),
  )

  // --- Their word ----------------------------------------------------------
  const outcomeById = new Map(input.promiseOutcomes.map((o) => [o.id, o] as const))
  const promises: LegalPromiseLine[] = input.promises
    .filter((p) => jobIds.has(p.jobId))
    .map((p): LegalPromiseLine => ({
      jobLabel: labelByJob.get(p.jobId) ?? '—',
      promisedYmd: p.promisedYmd,
      saidBy: p.saidBy,
      heardBy: p.heardByName,
      channel: p.channel,
      source: p.source,
      state: outcomeById.get(p.id)?.state ?? 'unknown',
      note: p.note,
      createdAt: p.createdAt,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  // Outcomes without a detail row (the details RPC is gated tighter) still count.
  const accountOutcomes = input.promiseOutcomes.filter((o) => jobIds.has(o.jobId))
  const decided = accountOutcomes.filter((o) => o.state !== 'open').length
  const kept = accountOutcomes.filter((o) => o.state === 'kept').length
  const broken = accountOutcomes.filter((o) => o.state === 'broken').length

  const touches: LegalTouchLine[] = input.chaseTouches
    .filter((t) => (t.jobId ? jobIds.has(t.jobId) : account.customerId != null && t.customerId === account.customerId))
    .map((t) => ({
      jobLabel: t.jobId ? labelByJob.get(t.jobId) ?? null : null,
      createdAt: t.createdAt,
      outcome: t.outcome,
      note: t.note,
      promisedYmd: t.promisedYmd,
      by: t.createdByName,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const collectionsNotes = jobLines
    .filter((l) => l.collectionsNote)
    .map((l) => ({ jobLabel: l.label, note: l.collectionsNote as string, by: l.collectionsBy, ymd: l.collectionsYmd }))

  // --- Evidence ------------------------------------------------------------
  const evidence: LegalEvidenceJob[] = jobs.map((j) => {
    const reports = input.reports.filter((r) => r.jobId === j.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const sessions = input.clockSessions.filter((s) => s.jobId === j.id && !s.disqualified)
    const notes = input.threadNotes.filter((n) => n.jobId === j.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const workDays = sessions.map((s) => s.workDate).sort()
    return {
      jobId: j.id,
      jobLabel: labelByJob.get(j.id) ?? '—',
      reports: reports.length,
      reportsWithGps: reports.filter((r) => r.hasGps).length,
      latestReport: reports[0] ?? null,
      sessions: sessions.length,
      approvedSessions: sessions.filter((s) => s.approved).length,
      sessionsWithGps: sessions.filter((s) => s.hasGps).length,
      hours: Math.round(sessions.reduce((s, x) => s + hoursBetween(x.clockedInAt, x.clockedOutAt), 0) * 10) / 10,
      firstWorkYmd: workDays[0] ?? null,
      lastWorkYmd: workDays[workDays.length - 1] ?? null,
      threadNotes: notes.length,
      latestNote: notes[0] ?? null,
      picturesLink: (j.job_pictures_link ?? '').trim() || null,
      driveLink: (j.google_drive_link ?? '').trim() || null,
    }
  })

  // --- Steps (what we did, in order) ---------------------------------------
  const steps: LegalStep[] = []
  for (const e of ledger) {
    if (e.kind === 'invoice') steps.push({ ymd: e.ymd, sortKey: e.ymd ?? '9999', kind: 'billed', text: e.text, jobLabel: e.jobLabel })
    if (e.kind === 'payment') steps.push({ ymd: e.ymd, sortKey: e.ymd ?? '9999', kind: 'payment', text: `${e.text} · $${(-e.amount).toFixed(2)}`, jobLabel: e.jobLabel })
  }
  for (const a of agreements) {
    if (a.coverage.kind === 'signed') {
      const y = ymdOfIso(a.coverage.signedAt)
      steps.push({ ymd: y, sortKey: y ?? '0000', kind: 'contract', text: `Agreement signed${a.coverage.signerName ? ` by ${a.coverage.signerName}` : ''} (${a.coverage.source})`, jobLabel: a.jobLabel })
    }
  }
  for (const p of promises) {
    const y = ymdOfIso(p.createdAt)
    steps.push({
      ymd: y,
      sortKey: y ?? '9999',
      kind: 'promise',
      text: `Promised to pay by ${p.promisedYmd}${p.saidBy ? ` — ${p.saidBy}` : ''}${p.channel ? ` (${p.channel})` : ''} · ${p.state}`,
      jobLabel: p.jobLabel,
    })
  }
  for (const t of touches) {
    const y = ymdOfIso(t.createdAt)
    steps.push({ ymd: y, sortKey: y ?? '9999', kind: 'call', text: `Collection call · ${t.outcome}${t.note ? ` — ${t.note}` : ''} · ${t.by}`, jobLabel: t.jobLabel })
  }
  for (const d of demandLetters) {
    steps.push({
      ymd: d.sentYmd,
      sortKey: d.sentYmd ?? '9999',
      kind: 'demand',
      text: `Final demand ${d.sentYmd ? 'sent' : 'drafted'} · ${d.method}${d.tracking ? ` · ${d.tracking}` : ''}${d.deadlineYmd ? ` · deadline ${d.deadlineYmd}${d.deadlinePassed ? ' (passed)' : ''}` : ''}`,
      jobLabel: d.jobLabel,
    })
  }
  for (const f of lienFilings) {
    const y = f.filedYmd ?? f.servedYmd
    steps.push({ ymd: y, sortKey: y ?? '9999', kind: 'filing', text: `${f.kind}${f.filedYmd ? ' filed' : ''}${f.recordingNumber ? ` · ${f.recordingNumber}` : ''}${f.servedYmd ? ` · served ${f.servedYmd}` : ''}`, jobLabel: f.jobLabel })
  }
  for (const l of jobLines) {
    if (l.collectionsYmd) steps.push({ ymd: l.collectionsYmd, sortKey: l.collectionsYmd, kind: 'collections', text: `Moved to Collections${l.collectionsBy ? ` by ${l.collectionsBy}` : ''}${l.collectionsNote ? ` — ${l.collectionsNote}` : ''}`, jobLabel: l.label })
  }
  steps.sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  // --- Gaps ----------------------------------------------------------------
  const gaps: LegalGap[] = []
  for (const l of jobLines) {
    if (l.contract.kind !== 'signed') {
      gaps.push({
        key: `contract:${l.jobId}`,
        severity: 'stop',
        label: `No signed agreement on ${l.label}`,
        detail:
          l.contract.kind === 'sent'
            ? 'A contract went out and was never signed — fee-shifting and interest terms hang on a signature. Record the paper copy if one exists.'
            : 'Nothing signed is on file. Record a paper contract, or expect the attorney to proceed on a sworn account and the lien path only.',
        jobId: l.jobId,
        fix: 'contract',
      })
    }
    if (!l.collectionsNote) {
      gaps.push({
        key: `note:${l.jobId}`,
        severity: 'warn',
        label: `No collections note on ${l.label}`,
        detail: 'The attorney reads this first: why the office thinks this one will not pay on its own.',
        jobId: l.jobId,
        fix: 'edit_job',
      })
    }
  }
  if (!account.customerId) {
    gaps.push({
      key: 'payer',
      severity: 'stop',
      label: 'Payer is a name only',
      detail: 'The job carries a customer name but no customer record — link it so the packet has an address and contacts.',
      jobId: null,
      fix: 'edit_job',
    })
  }
  if (emails.length === 0 && phones.length === 0) {
    gaps.push({ key: 'contact', severity: 'stop', label: 'No email or phone for the payer', detail: 'Add a contact on the customer so the demand and any service can reach someone.', jobId: null, fix: 'edit_customer' })
  } else if (emails.length === 0) {
    gaps.push({ key: 'email', severity: 'warn', label: 'No email for the payer', detail: 'Phone only. Add an email so written notice has a second channel.', jobId: null, fix: 'edit_customer' })
  }
  if (!(input.customer?.address ?? '').trim() && jobs.every((j) => !(j.job_address ?? '').trim())) {
    gaps.push({ key: 'address', severity: 'stop', label: 'No address anywhere', detail: 'Service and the lien both need a street address.', jobId: null, fix: 'edit_customer' })
  }
  if (demandLetters.filter((d) => d.sentYmd).length === 0) {
    gaps.push({
      key: 'demand',
      severity: 'warn',
      label: 'No final demand letter sent',
      detail: 'Most firms send their own, but one already on record with a tracking number shortens the first call.',
      jobId: jobs[0]?.id ?? null,
      fix: 'lien_instruments',
    })
  } else if (demandLetters.some((d) => d.sentYmd && d.deadlineYmd && !d.deadlinePassed)) {
    gaps.push({ key: 'demand_open', severity: 'warn', label: 'A demand deadline has not passed yet', detail: 'Releasing to counsel before the letter’s own deadline undercuts the letter.', jobId: null, fix: 'none' })
  }
  if (properties.length === 0) {
    gaps.push({
      key: 'property',
      severity: 'warn',
      label: 'No property record on the customer',
      detail: 'County, owner of record and legal description decide whether a lien is on the table. Fill it on the customer.',
      jobId: null,
      fix: 'edit_customer',
    })
  } else {
    for (const p of properties) {
      if (p.gaps.length > 0) {
        gaps.push({ key: `property:${p.address}`, severity: 'warn', label: `Property record incomplete · ${p.address}`, detail: `Missing ${p.gaps.join(', ')}.`, jobId: null, fix: 'edit_customer' })
      }
    }
  }
  for (const e of evidence) {
    if (e.reports === 0 && e.sessions === 0) {
      gaps.push({ key: `evidence:${e.jobId}`, severity: 'warn', label: `No field evidence on ${e.jobLabel}`, detail: 'No field reports and no clock sessions — nothing places a crew on the property.', jobId: e.jobId, fix: 'none' })
    }
  }
  if (promises.length === 0 && accountOutcomes.length === 0 && touches.length === 0) {
    gaps.push({ key: 'never_asked', severity: 'warn', label: 'Never asked when they would pay', detail: 'No promise and no collection call on record. One call in call mode gives the attorney a “they said…” line.', jobId: null, fix: 'call_mode' })
  }
  const severityRank = (s: LegalGapSeverity) => (s === 'stop' ? 0 : 1)
  gaps.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.label.localeCompare(b.label))
  const stops = gaps.filter((g) => g.severity === 'stop').length
  const warns = gaps.length - stops
  const readinessLabel =
    stops > 0
      ? `${stops} thing${stops === 1 ? '' : 's'} an attorney will ask for first`
      : warns > 0
        ? `Ready with ${warns} note${warns === 1 ? '' : 's'}`
        : 'Attorney-ready'

  // --- Exhibits ------------------------------------------------------------
  const exhibitCandidates: Array<{ title: string; count: number }> = [
    { title: 'Invoices and payments', count: ledger.length },
    { title: 'Signed agreements', count: agreements.filter((a) => a.coverage.kind === 'signed').length },
    { title: 'Final demand letters', count: demandLetters.filter((d) => d.sentYmd).length },
    { title: 'Lien notices and filings', count: lienFilings.length },
    { title: 'Payment promises and collection calls', count: promises.length + touches.length },
    { title: 'Field reports and clock sessions', count: evidence.reduce((s, e) => s + e.reports + e.sessions, 0) },
    { title: 'Property record', count: properties.length },
  ]
  const exhibits: LegalExhibit[] = []
  for (const c of exhibitCandidates) {
    if (c.count <= 0) continue
    exhibits.push({ letter: LETTERS[exhibits.length] ?? '?', title: c.title, count: c.count })
  }

  const oldestDays = jobLines.reduce<number | null>((m, l) => (l.agingDays == null ? m : m == null ? l.agingDays : Math.max(m, l.agingDays)), null)

  return {
    account: {
      payer: { key: account.key, customerId: account.customerId, name: account.name, viaGc: account.viaGc },
      customerAddress: (input.customer?.address ?? '').trim(),
      paymentTerms: paymentTermsLabel(input.customer?.payment_terms),
      paymentTermsNote: (input.customer?.payment_terms_note ?? '').trim() || null,
      contacts: [...input.contacts],
      emails,
      phones,
      properties,
      jobs: jobLines,
      ledger,
      totals: {
        billed: billedTotal,
        paid: paidTotal,
        writtenDown,
        balance: jobLines.reduce((s, l) => s + l.balance, 0),
        oldestDays,
      },
    },
    paper: { agreements, demandLetters, lienFilings },
    theirWord: { promises, kept, decided, broken, touches, collectionsNotes },
    evidence,
    feesAndSteps: { steps, fees: [] },
    gaps,
    readiness: { stops, warns, label: readinessLabel },
    exhibits,
  }
}

export function formatLegalMoney(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
