/**
 * Where the checks went (v2.4043): a GC's payments read payment-first — every
 * check the GC sent, the bill on each job it sits on NOW, the moves that got it
 * there, what came in and is not yet on a bill, and where each job stands.
 *
 * The office records a check that covered two jobs as two payment rows with
 * the same number and date; this kernel folds them back into one check. A
 * payment moved between jobs keeps its row (`move_job_payment` updates
 * `job_id`), and the move is a `jobs_ledger_payment_events` row that names the
 * payment — that is the "was on" trail. Which bill an unlinked payment pays is
 * the one shared rule (`paymentAttribution.ts`, oldest bill first), so the
 * sheet agrees with the portal and the demand letter. Who pays a bill is the
 * one shared rule too (`billToParty.ts`), so a bill the owner pays on a GC's
 * job never reads as the GC's money.
 *
 * Pure, no Deno — one home for both sides (v2.4260): the client re-exports it
 * from `src/lib/jobs/gcChecksApplied.ts` (its tests live there) and
 * `gc-statement-email-dispatch` calls it for the statement's "Payments we have
 * received". `src/lib/jobs/gcChecksAppliedIo.ts` reads the rows on the client;
 * the print and CSV builders live in `src/lib/jobsDocuments/gcChecksAppliedReport.ts`.
 * A move's `created_at` and a deposit's `posted_at` are instants, read as their
 * day in the company's zone; `paid_on` and `sent_on` are calendar days already.
 */
import { todayYmdInAppTz } from './appTimeZone.ts'
import { attributeJobPayments, isSentBill, type PaymentSlice } from './paymentAttribution.ts'
import { effectiveInvoiceParty, payerCustomerId } from './billToParty.ts'
import {
  billPaidByWords as sharedBillPaidByWords,
  checkLabel,
  checkNumberText,
  formatYmdLong,
  formatYmdShort,
  isDepositRef,
  money,
  paymentKind,
  type CheckKind,
} from './billPaidBy.ts'

export type ChecksInvoiceIn = {
  id: string
  job_id: string
  sequence_order?: number | null
  amount: number | string | null
  status: string | null
  billed_at?: string | null
  bill_to_party?: string | null
  bill_to_email?: string | null
}

export type ChecksPaymentIn = {
  id: string
  job_id: string
  invoice_id: string | null
  amount: number | string | null
  paid_on: string | null
  sent_on?: string | null
  payment_type: string | null
  reference_number: string | null
  mercury_transaction_id?: string | null
  sequence_order?: number | null
  created_at?: string | null
}

export type ChecksJobIn = {
  id: string
  hcp_number?: string | null
  click_number?: string | null
  job_name?: string | null
  job_address?: string | null
  customer_id?: string | null
  gc_customer_id?: string | null
  bill_to_party?: string | null
  lien_retainage_held?: number | string | null
  /**
   * The job's total price (v2.4534). Give it only with EVERY sent bill of the job in `invoices`:
   * the part of the job on no bill takes unlinked money first, and a short list would overstate it.
   */
  revenue?: number | string | null
  invoices: ChecksInvoiceIn[]
  payments: ChecksPaymentIn[]
}

/** One `jobs_ledger_payment_events` row; only `moved` rows shape the trail. */
export type ChecksEventIn = {
  id: string
  kind: string
  payment_id: string | null
  from_job_id: string | null
  to_job_id: string | null
  amount: number | string | null
  created_at: string
}

/** A Mercury deposit a payment was matched to: when it posted, and how much of it every job together has applied. */
export type ChecksDepositIn = { id: string; posted_at: string | null; amount: number | string | null; applied: number }

export { checkLabel, checkNumberText, formatYmdLong, formatYmdShort, isDepositRef, paymentKind, type CheckKind }

export type CheckLine = {
  paymentId: string
  jobId: string
  /** "4410 Oak Ridge Dr · 1041 Oak Ridge Ph 2" — the address leads, as on the statement. */
  jobLabel: string
  invoiceId: string | null
  /** "Invoice 2 of 3"; "on the job, not tied to an invoice" for money no sent bill needed. */
  invoiceLabel: string
  amount: number
  billPaidInFull: boolean
  jobPaidInFull: boolean
}

export type CheckMove = { amount: number; fromJobLabel: string; toJobLabel: string; onYmd: string }

export type GcCheck = {
  key: string
  kind: CheckKind
  /** "#48211" · "ACH" · "Wire" · "Card" · "check · no number recorded" · "Payment". */
  label: string
  /** The number as typed, without a leading #; '' when none. */
  number: string
  noNumber: boolean
  receivedYmd: string | null
  sentYmd: string | null
  depositedYmd: string | null
  /** Sum of the lines. */
  amount: number
  lines: CheckLine[]
  /** Moves after the check was first recorded, newest first. */
  wasOn: CheckMove[]
  /** Of the deposit this check was matched to, the dollars no job has applied yet. */
  unapplied: number
}

export type GcCheckJob = {
  jobId: string
  jobLabel: string
  /** Sent bills the GC pays, billed or paid. */
  billCount: number
  billed: number
  /** The distinct checks on the job, oldest first. */
  paidBy: Array<{ label: string; receivedYmd: string | null; noNumber: boolean }>
  lastApplied: { label: string; receivedYmd: string | null } | null
  retainageHeld: number
  stillOpen: number
  paid: boolean
}

export type GcChecksReport = {
  gcId: string
  sinceYmd: string | null
  /** Newest first; only checks received on or after `sinceYmd` when set. */
  checks: GcCheck[]
  /** Checks before `sinceYmd` that the report leaves out. */
  earlierCount: number
  jobs: GcCheckJob[]
  summary: {
    payments: number
    received: number
    appliedLines: number
    jobsPaid: number
    unapplied: number
    stillOpen: number
    retainageHeld: number
    noNumber: number
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100
const num = (v: number | string | null | undefined): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const ymd = (v: string | null | undefined): string | null => {
  const s = (v ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}

const numberKey = (reference: string | null | undefined): string => checkNumberText(reference).toLowerCase().replace(/[^a-z0-9]/g, '')
/** The fold key keeps a deposit id — one deposit's allocations share it — where the display number drops it. */
const foldNumberKey = (reference: string | null | undefined): string =>
  (reference ?? '')
    .trim()
    .replace(/^#\s*/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')


/**
 * The address leads, then the job number and name — the statement's row label, on one line. A
 * name that repeats the street ("Service Visit — 9703 Lenox Hl (HCP 858)") adds nothing, so the
 * number stands alone.
 */
export function checksJobLabel(job: Pick<ChecksJobIn, 'hcp_number' | 'click_number' | 'job_name' | 'job_address'>): string {
  // The displayed job number: the HCP number, else the Click number (`effectiveJobLedgerNumber` on the client).
  const number = (job.hcp_number ?? '').trim() || (job.click_number ?? '').trim()
  const address = (job.job_address ?? '').trim()
  const street = address.split(',')[0]!.trim().toLowerCase()
  const rawName = (job.job_name ?? '').trim()
  const name = street.length >= 6 && rawName.toLowerCase().includes(street) ? '' : rawName
  const tail = [number, name].filter(Boolean).join(' ')
  if (address && tail) return `${address} · ${tail}`
  return address || tail || 'Job'
}

type SentBill = ChecksInvoiceIn & { ordinal: number }

function sentBillsInOrder(job: ChecksJobIn): SentBill[] {
  const sent = job.invoices.filter((i) => isSentBill(i.status))
  sent.sort((a, b) => {
    const sa = a.sequence_order ?? Number.POSITIVE_INFINITY
    const sb = b.sequence_order ?? Number.POSITIVE_INFINITY
    if (sa !== sb) return sa - sb
    const ba = a.billed_at ?? '9999'
    const bb = b.billed_at ?? '9999'
    if (ba !== bb) return ba < bb ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return sent.map((i, idx) => ({ ...i, ordinal: idx + 1 }))
}

function invoiceLabelFor(bill: SentBill | undefined, sentCount: number, invoiceId: string | null): string {
  if (bill) return `Invoice ${bill.ordinal} of ${sentCount}`
  if (invoiceId) return 'a bill not yet sent'
  return 'on the job, not tied to an invoice'
}

/** The GC pays this bill (or, with no bill, this job's bills by its rule). */
function gcPays(gcId: string, job: ChecksJobIn, invoice: ChecksInvoiceIn | null): boolean {
  const jobFields = { customer_id: job.customer_id ?? null, gc_customer_id: job.gc_customer_id ?? null, bill_to_party: job.bill_to_party ?? null }
  const party = effectiveInvoiceParty(jobFields, invoice ? { bill_to_party: invoice.bill_to_party ?? null, bill_to_email: invoice.bill_to_email ?? null } : null)
  return payerCustomerId(jobFields, party) === gcId
}

type JobFacts = {
  job: ChecksJobIn
  label: string
  sent: SentBill[]
  byId: Map<string, SentBill>
  attribution: ReturnType<typeof attributeJobPayments<ChecksPaymentIn>>
  jobPaidInFull: boolean
}

function jobFacts(job: ChecksJobIn): JobFacts {
  const sent = sentBillsInOrder(job)
  const attribution = attributeJobPayments<ChecksPaymentIn>(job.invoices, job.payments, job.revenue)
  const billPaid = (b: SentBill) => (attribution.byBill.get(b.id)?.applied ?? 0) >= num(b.amount) - 0.005
  return {
    job,
    label: checksJobLabel(job),
    sent,
    byId: new Map(sent.map((b) => [b.id, b])),
    attribution,
    jobPaidInFull: sent.length > 0 && sent.every(billPaid),
  }
}

/** Each of a payment's shares of a bill (a linked payment is one share; an unlinked one may split, with a job-level rest). */
function paymentShares(f: JobFacts, p: ChecksPaymentIn): Array<{ invoice: SentBill | null; invoiceId: string | null; amount: number }> {
  const amt = round2(num(p.amount))
  if (p.invoice_id) return [{ invoice: f.byId.get(p.invoice_id) ?? null, invoiceId: p.invoice_id, amount: amt }]
  const out: Array<{ invoice: SentBill | null; invoiceId: string | null; amount: number }> = []
  let placed = 0
  for (const [invoiceId, bill] of f.attribution.byBill) {
    for (const s of bill.slices as PaymentSlice<ChecksPaymentIn>[]) {
      if (s.payment !== p || s.payment.invoice_id) continue
      out.push({ invoice: f.byId.get(invoiceId) ?? null, invoiceId, amount: round2(s.amount) })
      placed = round2(placed + s.amount)
    }
  }
  const rest = round2(amt - placed)
  if (rest > 0.005 || out.length === 0) out.push({ invoice: null, invoiceId: null, amount: rest > 0.005 ? rest : amt })
  return out
}

function foldKey(p: ChecksPaymentIn): string {
  const n = foldNumberKey(p.reference_number)
  if (n) return `ref:${n}|${ymd(p.paid_on) ?? ''}`
  if ((p.mercury_transaction_id ?? '').trim()) return `dep:${p.mercury_transaction_id}`
  return `pay:${p.id}`
}

const minYmd = (a: string | null, b: string | null): string | null => (a && b ? (a < b ? a : b) : (a ?? b))

export function buildGcChecksReport(input: {
  gcId: string
  jobs: readonly ChecksJobIn[]
  events?: readonly ChecksEventIn[]
  deposits?: readonly ChecksDepositIn[]
  /** Leave out checks received before this day (YYYY-MM-DD); undated checks stay. */
  sinceYmd?: string | null
}): GcChecksReport {
  const facts = new Map<string, JobFacts>()
  for (const j of input.jobs) facts.set(j.id, jobFacts(j))
  const labelFor = (jobId: string | null): string => (jobId && facts.get(jobId)?.label) || 'another job'
  const deposits = new Map((input.deposits ?? []).map((d) => [d.id, d]))

  type Draft = GcCheck & { paymentIds: Set<string>; createdAt: string }
  const drafts = new Map<string, Draft>()
  for (const f of facts.values()) {
    for (const p of f.job.payments) {
      const lines: CheckLine[] = []
      for (const share of paymentShares(f, p)) {
        const invoiceIn = share.invoiceId ? f.job.invoices.find((i) => i.id === share.invoiceId) ?? null : null
        if (!gcPays(input.gcId, f.job, invoiceIn)) continue
        const bill = share.invoice
        lines.push({
          paymentId: p.id,
          jobId: f.job.id,
          jobLabel: f.label,
          invoiceId: share.invoiceId,
          invoiceLabel: invoiceLabelFor(bill ?? undefined, f.sent.length, share.invoiceId),
          amount: share.amount,
          billPaidInFull: bill ? (f.attribution.byBill.get(bill.id)?.applied ?? 0) >= num(bill.amount) - 0.005 : false,
          jobPaidInFull: f.jobPaidInFull,
        })
      }
      if (lines.length === 0) continue
      const key = foldKey(p)
      const kind = paymentKind(p.payment_type)
      const number = checkNumberText(p.reference_number)
      let d = drafts.get(key)
      if (!d) {
        d = {
          key,
          kind,
          label: checkLabel(kind, number, { deposit: isDepositRef(p.reference_number) || Boolean((p.mercury_transaction_id ?? '').trim()) }),
          number,
          noNumber: kind === 'check' && !number,
          receivedYmd: null,
          sentYmd: null,
          depositedYmd: null,
          amount: 0,
          lines: [],
          wasOn: [],
          unapplied: 0,
          paymentIds: new Set(),
          createdAt: '',
        }
        drafts.set(key, d)
      }
      d.paymentIds.add(p.id)
      d.receivedYmd = minYmd(d.receivedYmd, ymd(p.paid_on))
      d.sentYmd = minYmd(d.sentYmd, ymd(p.sent_on))
      const dep = p.mercury_transaction_id ? deposits.get(p.mercury_transaction_id) : undefined
      if (dep) {
        d.depositedYmd = d.depositedYmd ?? (dep.posted_at ? todayYmdInAppTz(new Date(dep.posted_at)) : null)
        d.unapplied = Math.max(d.unapplied, round2(Math.max(0, num(dep.amount) - dep.applied)))
      }
      if ((p.created_at ?? '') > d.createdAt) d.createdAt = p.created_at ?? ''
      d.lines.push(...lines)
      d.amount = round2(d.amount + lines.reduce((s, l) => s + l.amount, 0))
    }
  }

  for (const e of input.events ?? []) {
    if (e.kind !== 'moved' || !e.payment_id) continue
    for (const d of drafts.values()) {
      if (!d.paymentIds.has(e.payment_id)) continue
      d.wasOn.push({ amount: round2(num(e.amount)), fromJobLabel: labelFor(e.from_job_id), toJobLabel: labelFor(e.to_job_id), onYmd: todayYmdInAppTz(new Date(e.created_at)) })
    }
  }

  const all = [...drafts.values()]
  for (const d of all) {
    d.wasOn.sort((a, b) => b.onYmd.localeCompare(a.onYmd))
    d.lines.sort((a, b) => a.jobLabel.localeCompare(b.jobLabel) || a.invoiceLabel.localeCompare(b.invoiceLabel))
  }
  // Newest first; a check with no received date is an anomaly, so it sits last.
  all.sort((a, b) => (b.receivedYmd ?? '').localeCompare(a.receivedYmd ?? '') || b.createdAt.localeCompare(a.createdAt) || a.key.localeCompare(b.key))

  const since = ymd(input.sinceYmd) ?? null
  const inPeriod = (d: Draft) => !since || !d.receivedYmd || d.receivedYmd >= since
  const checks: GcCheck[] = all.filter(inPeriod).map(({ paymentIds: _p, createdAt: _c, ...rest }) => rest)
  const earlierCount = all.length - checks.length

  const jobs: GcCheckJob[] = []
  for (const f of facts.values()) {
    const gcBills = f.sent.filter((b) => gcPays(input.gcId, f.job, b))
    const paidBy: Array<{ label: string; receivedYmd: string | null; noNumber: boolean }> = []
    for (const d of all) {
      if (d.lines.some((l) => l.jobId === f.job.id) && !paidBy.some((x) => x.label === d.label && x.receivedYmd === d.receivedYmd)) paidBy.push({ label: d.label, receivedYmd: d.receivedYmd, noNumber: d.noNumber })
    }
    if (gcBills.length === 0 && paidBy.length === 0) continue
    paidBy.sort((a, b) => (a.receivedYmd ?? '9999').localeCompare(b.receivedYmd ?? '9999'))
    const billed = round2(gcBills.reduce((s, b) => s + num(b.amount), 0))
    const stillOpen = round2(gcBills.filter((b) => b.status === 'billed').reduce((s, b) => s + Math.max(0, num(b.amount) - (f.attribution.byBill.get(b.id)?.applied ?? 0)), 0))
    jobs.push({
      jobId: f.job.id,
      jobLabel: f.label,
      billCount: gcBills.length,
      billed,
      paidBy,
      lastApplied: paidBy.length > 0 ? { label: paidBy[paidBy.length - 1]!.label, receivedYmd: paidBy[paidBy.length - 1]!.receivedYmd } : null,
      retainageHeld: round2(Math.max(0, num(f.job.lien_retainage_held))),
      stillOpen,
      paid: billed > 0 && stillOpen <= 0.005,
    })
  }
  jobs.sort((a, b) => b.stillOpen - a.stillOpen || a.jobLabel.localeCompare(b.jobLabel))

  return {
    gcId: input.gcId,
    sinceYmd: since,
    checks,
    earlierCount,
    jobs,
    summary: {
      payments: checks.length,
      received: round2(checks.reduce((s, c) => s + c.amount, 0)),
      appliedLines: checks.reduce((s, c) => s + c.lines.filter((l) => l.invoiceId).length, 0),
      jobsPaid: new Set(checks.flatMap((c) => c.lines.map((l) => l.jobId))).size,
      unapplied: round2(checks.reduce((s, c) => s + c.unapplied, 0)),
      stillOpen: round2(jobs.reduce((s, j) => s + j.stillOpen, 0)),
      retainageHeld: round2(jobs.reduce((s, j) => s + j.retainageHeld, 0)),
      noNumber: checks.filter((c) => c.noNumber).length,
    },
  }
}

/** "Check #48211 · $18,400.00 · received Sep 24, 2026 (mailed Sep 19) · deposited Sep 25". */
export function checkHeadline(c: GcCheck): string {
  const what = c.kind === 'check' && c.number ? `Check ${c.label}` : c.label
  const parts = [what, money(c.amount)]
  if (c.receivedYmd) parts.push(`received ${formatYmdLong(c.receivedYmd)}${c.sentYmd && c.sentYmd !== c.receivedYmd ? ` (mailed ${formatYmdShort(c.sentYmd)})` : ''}`)
  else parts.push('no received date')
  if (c.depositedYmd) parts.push(`deposited ${formatYmdShort(c.depositedYmd)}`)
  return parts.join(' · ')
}

const joinList = (items: string[]): string => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)

/** "Applied now to $12,000.00 on 4410 Oak Ridge Dr · 1041 Oak Ridge Ph 2, Invoice 2 of 3, and $6,400.00 on …, which it paid in full." */
export function checkAppliedSentence(c: GcCheck): string {
  const items = c.lines.map((l) => {
    const tail = l.invoiceId ? (l.jobPaidInFull ? ', which it paid in full' : l.billPaidInFull ? ', which it paid off' : '') : ''
    return `${money(l.amount)} on ${l.jobLabel}, ${l.invoiceLabel}${tail}`
  })
  const head = c.lines.length === 1 ? 'Applied now to' : 'Applied now to'
  const sentence = `${head} ${joinList(items)}.`
  return c.unapplied > 0.005 ? `${sentence} ${money(c.unapplied)} of the deposit is not yet on a bill.` : sentence
}

/** "$12,000.00 moved from 210 Maple Ct · 1058 Maple Ct to 4410 Oak Ridge Dr · 1041 Oak Ridge Ph 2 on Sep 26". */
export function checkMoveWords(m: CheckMove): string {
  return `${money(m.amount)} moved from ${m.fromJobLabel} to ${m.toJobLabel} on ${formatYmdShort(m.onYmd)}`
}

/** "$12,000 was on 210 Maple Ct · 1058 Maple Ct until Sep 26" — the sheet's column. */
export function checkWasOnWords(m: CheckMove): string {
  return `${money(m.amount)} was on ${m.fromJobLabel} until ${formatYmdShort(m.onYmd)}`
}

const parseMoney = (q: string): number | null => {
  const s = q.replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  return Number(s)
}

/**
 * The checks a typed query names: a number (any run of two or more digits in
 * it), an amount (the check's or any line's, to the cent), or a day (a
 * YYYY-MM-DD, or "Sep 24"). Order kept.
 */
export function findChecks(checks: readonly GcCheck[], query: string): GcCheck[] {
  const q = query.trim()
  if (!q) return []
  const lower = q.toLowerCase()
  const digits = q.replace(/\D/g, '')
  const amount = parseMoney(q)
  const day = ymd(q)
  const monthDay = /^[a-z]{3,9}\.?\s+\d{1,2}$/.test(lower) ? lower.replace('.', '').replace(/\s+/, ' ') : null
  const monthDayOf = (v: string | null) => (v ? formatYmdShort(v).toLowerCase() : '')
  return checks.filter((c) => {
    if (digits.length >= 2 && amount == null && numberKey(c.number).includes(digits)) return true
    if (amount != null && (Math.abs(c.amount - amount) < 0.005 || c.lines.some((l) => Math.abs(l.amount - amount) < 0.005))) return true
    if (amount != null && digits.length >= 2 && numberKey(c.number) === digits) return true
    if (day && (c.receivedYmd === day || c.sentYmd === day || c.depositedYmd === day)) return true
    if (monthDay && (monthDayOf(c.receivedYmd) === monthDay || monthDayOf(c.sentYmd) === monthDay)) return true
    return false
  })
}

/**
 * The line under a bill on the statement, the bill lines and the portal:
 * what paid it and when, and what is still open. `invoice` null is a job
 * balance with no bill behind it — then what the job has been paid so far.
 */
export function billPaidByWords(job: ChecksJobIn, invoice: Pick<ChecksInvoiceIn, 'id' | 'amount'> | null): string {
  return sharedBillPaidByWords({ bills: job.invoices, payments: job.payments, retainageHeld: job.lien_retainage_held, total: job.revenue }, invoice)
}
