import { parsePoGeneratorCodeFromPurchaseOrderName } from '../parsePoGeneratorCodeFromPurchaseOrderName'
import { calendarYmdInAppTzFromIso, startOfYmdInAppTzMs } from '../../utils/dateUtils'

/**
 * Pure logic behind the Materials → Supply Houses Add / Edit Invoice form
 * (v2.3474): the PO Generator check that used to live only in the table, the
 * "Paid on" date ↔ `paid_at` conversion, the due-date hint, and the job
 * allocation arithmetic the chips used to do inline.
 */

export type InvoiceJobAllocation = { job_id: string; pct: number }

// ---------- Purchase order # ----------

export type PoCodeHint =
  | { kind: 'empty' }
  /** Text with no five-digit PO Generator code — a hand-written PO, nothing to check. */
  | { kind: 'hand' }
  /** A code, but the ledger for this house hasn't loaded (or failed) — say nothing. */
  | { kind: 'unknown'; code: number }
  | { kind: 'on_ledger'; code: number }
  | { kind: 'not_on_ledger'; code: number }

export function poCodeHint(poText: string, ledgerCodes: ReadonlySet<number> | null): PoCodeHint {
  if (!poText.trim()) return { kind: 'empty' }
  const code = parsePoGeneratorCodeFromPurchaseOrderName(poText)
  if (code == null) return { kind: 'hand' }
  if (ledgerCodes == null) return { kind: 'unknown', code }
  return ledgerCodes.has(code) ? { kind: 'on_ledger', code } : { kind: 'not_on_ledger', code }
}

/**
 * One PO Generator ledger row as the invoice form needs it (v2.3599): who the
 * code was minted for, on which job, when, by whom — and what they said they
 * needed. Keyed by code in `PoLedgerEntriesByCode`.
 */
export type PoLedgerEntry = {
  code: number
  /** "J964 · Oak Ridge townhomes" — the caller formats the number with its prefix. */
  jobLabel: string
  /** The job the code was minted for (v2.3724) — what the job + date match and the mismatch line read. */
  jobLedgerId: string | null
  personName: string
  createdAt: string | null
  createdBy: string | null
  statedNeed: string | null
}

export type PoLedgerEntriesByCode = ReadonlyMap<number, PoLedgerEntry>

/** The codes alone, for the checks that only need to know whether a code exists. */
export function poLedgerCodes(entries: PoLedgerEntriesByCode | null): ReadonlySet<number> | null {
  return entries == null ? null : new Set(entries.keys())
}

export type PoLedgerEntryCard = {
  /** "J964 · Oak Ridge townhomes" */
  head: string
  /** "for Marcus Delgado · Sep 16 · by Dana" — the pieces that are known, joined. */
  meta: string
  /** The claim, trimmed; null when none was written down (the card then says so). */
  statedNeed: string | null
}

/**
 * The card under the PO hint: only when the code is on this house's ledger.
 * A matched code with no claim still returns a card — the job and the person are
 * the half of the answer the ledger always has.
 */
export function poLedgerEntryCard(hint: PoCodeHint, entries: PoLedgerEntriesByCode | null): PoLedgerEntryCard | null {
  if (hint.kind !== 'on_ledger' || entries == null) return null
  const e = entries.get(hint.code)
  if (!e) return null
  const when = e.createdAt ? formatLedgerDay(e.createdAt) : null
  const meta = [`for ${e.personName}`, when, e.createdBy ? `by ${e.createdBy}` : null].filter((x): x is string => x != null).join(' · ')
  const said = (e.statedNeed ?? '').trim()
  return { head: e.jobLabel, meta, statedNeed: said || null }
}

function formatLedgerDay(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Aug 19" from a YYYY-MM-DD, with no timezone in the way. */
function formatYmdShort(ymd: string): string {
  const m = Number(ymd.slice(5, 7))
  const d = Number(ymd.slice(8, 10))
  return `${MONTHS_SHORT[m - 1] ?? '?'} ${d}`
}

// ---------- Codes for this job near this date (v2.3724) ----------

/**
 * The supply house prints what the tech said at the counter — at Reece 114 of
 * 117 invoices with a PO # carry the job's name, not the five-digit code. So
 * the exact-code card (above) fires on one bill in forty. This is the reader
 * for the other thirty-nine: once the invoice is on a job, the codes minted for
 * that job at this house within a window of the invoice date — who made the
 * trip, when, and what they said they needed.
 */
export const PO_LEDGER_JOB_WINDOW_DAYS = 7

export type PoLedgerJobMatch = {
  code: number
  jobLabel: string
  personName: string
  /** "Aug 19" */
  when: string | null
  /** "same day" · "2 days before" · "1 day after" — the code's day relative to the invoice date. */
  apart: string
  /** Sort key: the code's day minus the invoice date, in days. */
  daysApart: number
  statedNeed: string | null
}

export type PoLedgerJobMatches = {
  /** The heading over the rows, or — with no rows — the one sentence that says so. */
  line: string
  rows: PoLedgerJobMatch[]
  /** More than one job on the invoice: each row names its job. */
  showJob: boolean
}

export function daysApartLabel(d: number): string {
  if (d === 0) return 'same day'
  const n = Math.abs(d)
  return `${n} day${n === 1 ? '' : 's'} ${d < 0 ? 'before' : 'after'}`
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Null when there is nothing to read against: the exact-code card is showing
 * (`on_ledger`), the ledger has not loaded, no job is on the invoice yet, or
 * the invoice has no date. Otherwise the rows nearest the invoice date first.
 */
export function poLedgerJobMatches(args: {
  hint: PoCodeHint
  entries: PoLedgerEntriesByCode | null
  jobIds: readonly string[]
  invoiceDateYmd: string
  houseName: string
  windowDays?: number
}): PoLedgerJobMatches | null {
  const { hint, entries, jobIds, invoiceDateYmd, houseName } = args
  const windowDays = args.windowDays ?? PO_LEDGER_JOB_WINDOW_DAYS
  if (hint.kind === 'on_ledger' || entries == null || jobIds.length === 0 || !YMD_RE.test(invoiceDateYmd)) return null
  const jobs = new Set(jobIds)
  const invoiceMs = startOfYmdInAppTzMs(invoiceDateYmd)
  const rows: PoLedgerJobMatch[] = []
  for (const e of entries.values()) {
    if (!e.jobLedgerId || !jobs.has(e.jobLedgerId) || !e.createdAt) continue
    const ymd = calendarYmdInAppTzFromIso(e.createdAt)
    if (!YMD_RE.test(ymd)) continue
    const daysApart = Math.round((startOfYmdInAppTzMs(ymd) - invoiceMs) / 86_400_000)
    if (Math.abs(daysApart) > windowDays) continue
    rows.push({
      code: e.code,
      jobLabel: e.jobLabel,
      personName: e.personName,
      when: formatYmdShort(ymd),
      apart: daysApartLabel(daysApart),
      daysApart,
      statedNeed: (e.statedNeed ?? '').trim() || null,
    })
  }
  // Nearest the invoice date first; on a tie the code minted BEFORE the trip (its code) beats one minted after.
  rows.sort((a, b) => Math.abs(a.daysApart) - Math.abs(b.daysApart) || a.daysApart - b.daysApart || b.code - a.code)
  const jobWord = jobIds.length > 1 ? 'these jobs' : 'this job'
  const span = windowDays === 7 ? 'a week' : `${windowDays} days`
  const day = formatYmdShort(invoiceDateYmd)
  const line =
    rows.length > 0
      ? `PO codes minted for ${jobWord} at ${houseName} within ${span} of ${day}:`
      : `No PO code on the ledger for ${jobWord} at ${houseName} within ${span} of ${day} — the trip was made without one, or its code sits on another job.`
  return { line, rows, showJob: jobIds.length > 1 }
}

/**
 * The exact-code card's one warning (v2.3724): the code on the paper was minted
 * for a job the invoice is not on. Null until a job is picked, and null when
 * the ledger row has no job to compare.
 */
export function poLedgerEntryJobMismatch(hint: PoCodeHint, entries: PoLedgerEntriesByCode | null, jobIds: readonly string[]): string | null {
  if (hint.kind !== 'on_ledger' || entries == null || jobIds.length === 0) return null
  const e = entries.get(hint.code)
  if (!e || !e.jobLedgerId || jobIds.includes(e.jobLedgerId)) return null
  return `PO ${e.code} was minted for ${e.jobLabel} — this invoice is on a different job. One of the two is wrong.`
}

/** The one-line hint under the PO field; null when there is nothing worth saying. */
export function poCodeHintText(hint: PoCodeHint, houseName: string): string | null {
  switch (hint.kind) {
    case 'empty':
    case 'unknown':
      return null
    case 'hand':
      return 'Hand PO — no PO Generator code. A five-digit code here is checked against the ledger.'
    case 'on_ledger':
      return `PO ${hint.code} is on the PO Generator ledger for ${houseName}.`
    case 'not_on_ledger':
      return `PO ${hint.code} is not on the PO Generator ledger for ${houseName} — check the number.`
  }
}

// ---------- Due date ----------

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th", 11–13 → "th", 21 → "21st". */
export function ordinalDay(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/** Where the prefilled due date came from — the house's monthly payment day. Null when the house has none. */
export function dueDateHint(houseName: string, monthlyPaymentDay: number | null | undefined): string | null {
  if (monthlyPaymentDay == null || !Number.isInteger(monthlyPaymentDay) || monthlyPaymentDay < 1 || monthlyPaymentDay > 31) return null
  return `${houseName}'s payment day is the ${ordinalDay(monthlyPaymentDay)}.`
}

// ---------- Paid on ----------

/**
 * A "Paid on" calendar day → the `paid_at` instant to store: noon in the company
 * time zone, so the day survives every locale's `toLocaleDateString()` and a DST
 * switch. Null when the day is blank or malformed (the DB trigger then stamps now()).
 */
export function paidAtIsoFromYmd(ymd: string): string | null {
  const start = startOfYmdInAppTzMs(ymd)
  if (Number.isNaN(start)) return null
  return new Date(start + 12 * 60 * 60_000).toISOString()
}

/** The stored `paid_at` instant as the calendar day it fell on (company time zone); '' when unpaid. */
export function paidOnYmdFromIso(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return calendarYmdInAppTzFromIso(iso)
  } catch {
    return ''
  }
}

/**
 * What the save payload carries for `paid_at`. The trigger stamps now() when an
 * invoice flips to paid with no explicit date and nulls it when it flips back, so
 * the client only speaks up when the office typed a day that differs from what's stored.
 */
export function paidAtPayload(
  isPaid: boolean,
  paidOnYmd: string,
  priorPaidAtIso: string | null | undefined,
): { paid_at: string } | Record<string, never> {
  if (!isPaid) return {}
  const ymd = paidOnYmd.trim()
  if (!ymd) return {}
  if (ymd === paidOnYmdFromIso(priorPaidAtIso)) return {}
  const iso = paidAtIsoFromYmd(ymd)
  return iso ? { paid_at: iso } : {}
}

/**
 * The Apply Payment update for the selected bills: mark them paid, and file a typed payment /
 * receipt link in `payment_link` (v2.3843). `link` is each bill's own paper — the scan the
 * invoice form saved — and Apply Payment never touches it: a blank field used to null it
 * (fixed v2.3830) and a typed one replaced it (the owner's call 2026-09-25: keep both). A blank
 * field leaves an earlier receipt link alone too.
 */
export function applyPaymentUpdate(linkTyped: string): { is_paid: true; payment_link?: string } {
  const link = linkTyped.trim()
  return link ? { is_paid: true, payment_link: link } : { is_paid: true }
}

// ---------- Job allocations ----------

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Even split across n jobs; the last one absorbs the rounding remainder so the total is exactly 100. */
function evenSplit(jobIds: string[]): InvoiceJobAllocation[] {
  const n = jobIds.length
  if (n === 0) return []
  const each = round1(100 / n)
  return jobIds.map((job_id, i) => ({ job_id, pct: i === n - 1 ? round1(100 - (n - 1) * each) : each }))
}

/** Add a job to the split (even re-split). A job already on the invoice is a no-op. */
export function addAllocation(list: InvoiceJobAllocation[], jobId: string): InvoiceJobAllocation[] {
  if (list.some((a) => a.job_id === jobId)) return list
  return evenSplit([...list.map((a) => a.job_id), jobId])
}

/** Remove one job and re-split the rest evenly. */
export function removeAllocation(list: InvoiceJobAllocation[], index: number): InvoiceJobAllocation[] {
  return evenSplit(list.filter((_, i) => i !== index).map((a) => a.job_id))
}

/**
 * Set one job's percent and scale the others so the total stays 100 (the last
 * job absorbs rounding). With nothing else to scale, the others split what's left.
 */
export function setAllocationPct(list: InvoiceJobAllocation[], index: number, pct: number): InvoiceJobAllocation[] {
  const v = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0
  const rest = list.filter((_, i) => i !== index)
  const restSum = rest.reduce((s, x) => s + x.pct, 0)
  const scale = restSum > 0 ? (100 - v) / restSum : 1
  let next = list.map((x, i) => (i === index ? { ...x, pct: v } : { ...x, pct: round1(x.pct * scale) }))
  if (restSum === 0 && rest.length > 0) {
    // Everyone else was at 0 — hand them the remainder evenly instead of leaving it stranded.
    const share = round1((100 - v) / rest.length)
    next = list.map((x, i) => (i === index ? { ...x, pct: v } : { ...x, pct: share }))
  }
  const sum = next.reduce((s, x) => s + x.pct, 0)
  if (Math.abs(sum - 100) > 0.01 && next.length > 0) {
    // Push the rounding drift onto the last job that isn't the one being edited.
    let target = next.length - 1
    if (target === index && next.length > 1) target -= 1
    next = next.map((x, i) => (i === target ? { ...x, pct: round1(x.pct + (100 - sum)) } : x))
  }
  return next
}

export function allocationTotal(list: InvoiceJobAllocation[]): number {
  return round1(list.reduce((s, a) => s + a.pct, 0))
}

// ---------- Labels ----------

export function invoiceSaveLabel(editing: boolean, saving: boolean): string {
  if (saving) return 'Saving…'
  return editing ? 'Save changes' : 'Save invoice'
}

// ---------------------------------------------------------------------------
// What the paper is (v2.3503)
//
// A supply house document is an invoice or a credit memo. The DATABASE stores a credit with a
// negative amount, because job allocations are percentages and every reader sums `amount × pct`.
// The FORM never asks anyone to type a minus: the amount box stays positive and the sign is derived
// from the choice, so a slipped minus key cannot invent a credit and a real credit cannot be lost
// to a missing one.
// ---------------------------------------------------------------------------

export type SupplyDocumentKind = 'invoice' | 'credit'

export type SupplyDocumentWords = {
  /** Dialog title verb-phrase, e.g. "Add credit". */
  title: (editing: boolean) => string
  numberLabel: string
  dateLabel: string
  /** Caption over the due-date / status block. */
  statusCaption: string
  openLabel: string
  closedLabel: string
  saveLabel: (editing: boolean, saving: boolean) => string
  /** Amount adornment: '$' for an invoice, '− $' for a credit. */
  amountAdornment: string
  /** The empty-state line under "Which job". */
  noJobLine: string
  /** The Paperwork field label. */
  documentPdfLabel: string
}

/** Every label that follows the document, so nothing on screen calls a credit memo an invoice. */
export function documentWords(kind: SupplyDocumentKind): SupplyDocumentWords {
  if (kind === 'credit') {
    return {
      title: (editing) => (editing ? 'Edit credit' : 'Add credit'),
      numberLabel: 'Credit #',
      dateLabel: 'Credit date',
      statusCaption: 'Applying it',
      openLabel: 'Open — still on the account',
      closedLabel: 'Applied on',
      saveLabel: (editing, saving) => (saving ? 'Saving…' : editing ? 'Save changes' : 'Save credit'),
      amountAdornment: '− $',
      noJobLine: 'No job yet — until one is added this credit comes off no job’s costs.',
      documentPdfLabel: 'Credit PDF',
    }
  }
  return {
    title: (editing) => (editing ? 'Edit invoice' : 'Add invoice'),
    numberLabel: 'Invoice #',
    dateLabel: 'Invoice date',
    statusCaption: 'Paying it',
    openLabel: 'Not paid yet',
    closedLabel: 'Paid on',
    saveLabel: invoiceSaveLabel,
    amountAdornment: '$',
    noJobLine: "No job yet — until one is added this invoice sits on no job's costs.",
    documentPdfLabel: 'Invoice PDF',
  }
}

/**
 * The amount to store, from the kind and what the office typed. Returns null when the box does not
 * hold a usable number — the caller shows `amountProblem`. A credit comes back negative; this is the
 * ONLY place the sign is applied.
 */
export function signedAmountForSave(kind: SupplyDocumentKind, typed: string): number | null {
  const n = parseFloat(typed)
  if (!Number.isFinite(n)) return null
  const magnitude = Math.abs(n)
  if (kind === 'credit') return magnitude > 0 ? -magnitude : null
  return magnitude
}

/** What the box shows for a stored row — always a positive magnitude, whichever kind it is. */
export function typedAmountFromStored(amount: number | null | undefined): string {
  const n = Number(amount ?? 0)
  if (!Number.isFinite(n) || n === 0) return n === 0 ? '0' : ''
  return String(Math.abs(n))
}

/** null when the amount is fine, otherwise the sentence to show. */
export function amountProblem(kind: SupplyDocumentKind, typed: string): string | null {
  const n = parseFloat(typed)
  if (!Number.isFinite(n)) return 'Amount must be a number.'
  if (n < 0) return 'Type the amount as a positive number — picking Credit is what takes it off the balance.'
  if (kind === 'credit' && n === 0) return 'A credit needs an amount. A zero credit is not a document.'
  return null
}

/** The kind a stored row reads as. Falls back to the sign for a row written before the column existed. */
export function documentKindFromRow(row: { document_kind?: string | null; amount: number | null }): SupplyDocumentKind {
  if (row.document_kind === 'credit') return 'credit'
  if (row.document_kind === 'invoice') return 'invoice'
  return Number(row.amount ?? 0) < 0 ? 'credit' : 'invoice'
}

/**
 * The effect stated in the office's own words before the credit is saved — the sentence that makes
 * a wrong house or a wrong job obvious while it can still be fixed.
 */
export function creditEffectSentence(args: {
  amountTyped: string
  houseName: string
  jobLabel: string | null
}): string | null {
  const n = parseFloat(args.amountTyped)
  if (!Number.isFinite(n) || n <= 0) return null
  const dollars = `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const house = args.houseName.trim() || 'this supply house'
  if (!args.jobLabel) {
    return `Takes ${dollars} off what we owe ${house}. No job gets money back — add one above if these parts went back from a job.`
  }
  return `Takes ${dollars} off what we owe ${house}, and ${dollars} off ${args.jobLabel}’s parts cost.`
}
