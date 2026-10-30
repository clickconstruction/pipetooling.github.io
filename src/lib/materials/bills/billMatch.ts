/**
 * Supply-house bill capture (punch list #179 PR 2, v2.6088): what the app works out from the read and what it already
 * holds. The paper never prints the job's id, so the job is always a guess, with the evidence named: the PO Generator
 * code against the house's ledger (the form's own `PoLedgerEntriesByCode`), the account reference against the job
 * accounts at this house, the ship-to and the job text against the jobs the form can search. The house on the
 * letterhead is read against the house the form is open on. A credit memo's pair is read from the invoice it names.
 * The due date follows the terms the paper prints, else the house's payment day, as the form does today. Pure.
 */
import { parsePoGeneratorCodeFromPurchaseOrderName } from '../../parsePoGeneratorCodeFromPurchaseOrderName'
import { nextMonthlyPaymentDueYmd } from '../../supplyHouseAging'
import type { PairableSupplyRow, PoLedgerEntriesByCode, SupplyDocumentKind } from '../supplyHouseInvoiceForm'
import { creditableInvoices } from '../supplyHouseInvoiceForm'
import type { BillRead } from './billRead'

// ---------- Names ----------

/** Words every supply house's name carries, which say nothing about which house it is. */
const GENERIC = new Set(['supply', 'supplies', 'inc', 'llc', 'co', 'corp', 'company', 'the', 'and', 'of', 'ltd', 'plumbing', 'pipe', 'hvac', 'electric', 'electrical', 'wholesale', 'distribution', 'distributors', 'branch'])

export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !GENERIC.has(t))
}

export type HouseMatch = 'same' | 'other' | 'unknown'

/**
 * Whether the letterhead names the house the form is open on. The generic words are dropped and the names compared
 * on what is left: Ridgeway Supply and RIDGEWAY SUPPLY CO are the same house; Cedar Bend Pipe & Supply is another.
 * An empty letterhead is unknown, never other.
 */
export function houseMatch(readName: string, houseName: string): HouseMatch {
  const a = nameTokens(readName)
  const b = nameTokens(houseName)
  if (a.length === 0) return 'unknown'
  if (b.length === 0) return 'unknown'
  const shared = a.filter((t) => b.includes(t)).length
  if (shared === 0) return 'other'
  // One name inside the other, or more than half the shorter name shared.
  return shared >= Math.min(a.length, b.length) || shared * 2 > Math.min(a.length, b.length) ? 'same' : 'other'
}

// ---------- The job ----------

/** A job the form can put the bill on, as the search and the detail map carry it. */
export interface MatchableJob {
  id: string
  /** "J1042", the job's number with its prefix. */
  label: string
  name: string
  address: string
}

/** An account at this house, as `job_supply_house_accounts` carries it. */
export interface MatchableAccount {
  jobId: string
  accountRef: string
  status: string
}

export type JobEvidence = 'code' | 'account' | 'shipTo' | 'jobText'

export interface JobGuess {
  jobId: string
  /** What pointed at the job, strongest first. */
  evidence: JobEvidence[]
  /** The PO Generator code that pointed, when one did. */
  code: number | null
}

const STOP = new Set(['the', 'and', 'of', 'at', 'to', 'for', 'suite', 'ste', 'unit', 'dr', 'drive', 'st', 'street', 'rd', 'road', 'ln', 'lane', 'ave', 'avenue', 'blvd', 'tx', 'texas', 'usa'])

export function placeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t))
}

/** The job whose name and address share the most words with the printed place; null under two shared words. */
export function jobByPlace(printed: string, jobs: readonly MatchableJob[]): MatchableJob | null {
  const want = placeTokens(printed)
  if (want.length === 0) return null
  let best: { job: MatchableJob; score: number } | null = null
  for (const job of jobs) {
    const have = new Set(placeTokens(`${job.name} ${job.address}`))
    const score = want.filter((t) => have.has(t)).length
    if (score >= 2 && (!best || score > best.score)) best = { job, score }
  }
  return best?.job ?? null
}

const normRef = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * The job the bill is for, as a guess with its evidence. Null when nothing points at one: the form then asks for the
 * job as it does today. A code on the ledger wins; the account reference and the printed place add to it or stand in.
 */
export function jobGuess(read: BillRead, ctx: { ledger: PoLedgerEntriesByCode | null; accounts: readonly MatchableAccount[]; jobs: readonly MatchableJob[] }): JobGuess | null {
  const code = parsePoGeneratorCodeFromPurchaseOrderName(read.poText)
  const fromCode = code != null ? ctx.ledger?.get(code)?.jobLedgerId ?? null : null
  const ref = normRef(read.accountRef)
  const fromAccount = ref ? ctx.accounts.find((a) => normRef(a.accountRef) === ref)?.jobId ?? null : null
  const fromShipTo = jobByPlace(read.shipTo, ctx.jobs)?.id ?? null
  const fromJobText = jobByPlace(read.jobText, ctx.jobs)?.id ?? null
  const candidates: Array<[JobEvidence, string | null]> = [
    ['code', fromCode],
    ['account', fromAccount],
    ['shipTo', fromShipTo],
    ['jobText', fromJobText],
  ]
  const first = candidates.find(([, id]) => id)
  if (!first || !first[1]) return null
  const jobId = first[1]
  const evidence = candidates.filter(([, id]) => id === jobId).map(([e]) => e)
  return { jobId, evidence, code: fromCode === jobId ? code : null }
}

/** Whether the job-account tick defaults on: an open account for the job at this house, as the form decides today. */
export function jobAccountDefault(jobId: string | null, accounts: readonly MatchableAccount[]): boolean {
  return jobId != null && accounts.some((a) => a.jobId === jobId && a.status === 'open')
}

// ---------- The kind, the pair ----------

/** The kind the form's radio takes: a credit memo is a credit; everything else, a statement included, starts as an invoice. */
export function kindFromRead(read: Pick<BillRead, 'kind'>): SupplyDocumentKind {
  return read.kind === 'credit' ? 'credit' : 'invoice'
}

/** The invoice a credit memo credits, found on this house's list by the number its RE: line names. Null when none matches. */
export function creditPairGuess(read: Pick<BillRead, 'referencesNumber'>, rows: ReadonlyArray<PairableSupplyRow & { invoice_date: string }>): { invoiceId: string; label: string } | null {
  const want = normRef(read.referencesNumber)
  if (!want) return null
  const options = creditableInvoices(rows, null)
  for (const row of rows) {
    if (normRef(row.invoice_number ?? '') !== want) continue
    const option = options.find((o) => o.id === row.id)
    if (option) return { invoiceId: row.id, label: option.label }
  }
  return null
}

// ---------- The due date ----------

export type DueGuess = { ymd: string; from: 'terms' | 'receipt' | 'house' | 'none'; days: number | null }

/** Civil-date arithmetic on a YYYY-MM-DD: a day is a day, no zone. '' when malformed. */
export function ymdPlusDays(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ''
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days)).toISOString().slice(0, 10)
}

/**
 * The due date: Net N on the paper is the invoice date plus N days; Due on receipt is the date itself; otherwise the
 * house's payment day as the form prefills it today, or nothing.
 */
export function dueGuess(read: Pick<BillRead, 'dateYmd' | 'terms'>, paymentDay: number | null | undefined, todayYmd: string): DueGuess {
  const terms = read.terms.toLowerCase()
  const net = /net\s*(\d{1,3})/.exec(terms)
  if (net && read.dateYmd) return { ymd: ymdPlusDays(read.dateYmd, Number(net[1])), from: 'terms', days: Number(net[1]) }
  if (/receipt|c\.?o\.?d\b|cash/.test(terms) && read.dateYmd) return { ymd: read.dateYmd, from: 'receipt', days: 0 }
  if (paymentDay && Number.isInteger(paymentDay) && paymentDay >= 1 && paymentDay <= 31) return { ymd: nextMonthlyPaymentDueYmd(paymentDay, read.dateYmd || todayYmd), from: 'house', days: null }
  return { ymd: '', from: 'none', days: null }
}
