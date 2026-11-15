/**
 * Which bank line a sub payment left on (punch list #347, PR 5).
 *
 * The Subs Ledger holds payments as the office typed them. The bank holds what really left. This finds, for each
 * payment not yet matched, the outgoing Mercury lines that could be it: the same amount to the cent, within three
 * days either side, not already taken by another payment. The closest day leads, and a payee whose name reads like
 * the sub's breaks a tie. A person presses the one that is right. Nothing is matched without that press.
 *
 * What is matched is a money movement: the lines of one sending are one unit, and its amount is what was sent
 * (the lines and the credit kept with them). Pure: no React, no Supabase.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { ledgerDayWords, type LedgerLine } from './subPaymentsLedger'

/** How far a bank line's day may sit from the payment's day and still be offered. */
export const BANK_MATCH_DAYS = 3

/** One outgoing bank line, as the matcher reads it. */
export type BankLine = {
  id: string
  /** What left, above zero. */
  amount: number
  /** The day it posted, in the app's timezone. '' when the row has no time at all. */
  ymd: string
  payee: string
  memo: string
}

export type BankRow = {
  id: string
  amount: number | string
  posted_at?: string | null
  created_at?: string | null
  counterparty_name?: string | null
  note?: string | null
  external_memo?: string | null
  status?: string | null
  /** Mercury's kind. A transfer between the company's own accounts paid nobody. */
  kind?: string | null
  duplicate_of_transaction_id?: string | null
}

/** Mercury's kind for money moved between the company's own accounts (`mercuryVisualsFlows.INTERNAL_TRANSFER_KIND`). */
export const OWN_ACCOUNT_TRANSFER_KIND = 'internalTransfer'

const cents = (n: number): number => Math.round(n * 100)
const usd = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** The rows that are real money out to someone: below zero, not a duplicate, not failed or cancelled, not a transfer between the company's own accounts. Banking reads a row the same way. */
export function bankLinesFromRows(rows: readonly BankRow[]): BankLine[] {
  const out: BankLine[] = []
  for (const r of rows) {
    const amount = Number(r.amount)
    if (!Number.isFinite(amount) || !(amount < 0)) continue
    if (r.duplicate_of_transaction_id) continue
    const status = (r.status ?? '').toLowerCase()
    if (status === 'failed' || status === 'cancelled') continue
    if (r.kind === OWN_ACCOUNT_TRANSFER_KIND) continue
    const at = r.posted_at ?? r.created_at ?? ''
    out.push({ id: r.id, amount: Math.round(-amount * 100) / 100, ymd: at ? calendarYmdInAppTzFromIso(at) : '', payee: (r.counterparty_name ?? '').trim(), memo: (r.note ?? r.external_memo ?? '').trim() })
  }
  return out
}

/** Whole days between two `YYYY-MM-DD` days, never below zero. Infinity when either is missing. */
export function daysApart(a: string, b: string): number {
  const ta = Date.parse(`${a.slice(0, 10)}T00:00:00Z`)
  const tb = Date.parse(`${b.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return Infinity
  return Math.round(Math.abs(ta - tb) / 86_400_000)
}

const STOP = new Set(['llc', 'inc', 'co', 'corp', 'company', 'the', 'and', 'of', 'ltd', 'lp', 'services', 'service'])
const tokens = (s: string): string[] => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length > 1 && !STOP.has(w))

/** True when the bank's payee and the sub's name share a word that is not company filler. */
export function payeeReadsLike(payee: string, name: string): boolean {
  const a = new Set(tokens(payee))
  return tokens(name).some((w) => a.has(w))
}

/** One money movement on the ledger: a lone payment, or every line of one sending. */
export type MatchUnit = {
  /** The line a press acts on: any line of the unit matches the whole unit. */
  paymentId: string
  lineIds: string[]
  /** What left the bank for it. */
  amount: number
  ymd: string
  paidTo: string
}

/** The ledger's payments as units to match. A back-charge and a line paid from credit moved no money and are left out. */
export function matchUnits(lines: readonly LedgerLine[]): MatchUnit[] {
  const by = new Map<string, MatchUnit>()
  for (const l of lines) {
    if (!l.checkable) continue
    const key = l.sendingNo ? `s:${l.sendingNo}` : `p:${l.id}`
    const unit = by.get(key)
    if (unit) {
      unit.lineIds.push(l.id)
      unit.amount = Math.round((unit.amount + l.sent) * 100) / 100
      if (l.ymd && (!unit.ymd || l.ymd < unit.ymd)) unit.ymd = l.ymd
    } else by.set(key, { paymentId: l.id, lineIds: [l.id], amount: l.sent, ymd: l.ymd, paidTo: l.paidTo })
  }
  return [...by.values()]
}

export type BankCandidate = BankLine & { days: number; namesAgree: boolean }

/**
 * The bank lines a unit could be, best first: same amount to the cent, within `BANK_MATCH_DAYS`, not in `taken`.
 * A unit with no day gets none: without a day there is nothing to hold a bank line against.
 */
export function bankCandidates(unit: MatchUnit, bank: readonly BankLine[], taken: ReadonlySet<string>): BankCandidate[] {
  if (!unit.ymd) return []
  const want = cents(unit.amount)
  return bank
    .filter((b) => !taken.has(b.id) && cents(b.amount) === want && daysApart(b.ymd, unit.ymd) <= BANK_MATCH_DAYS)
    .map((b) => ({ ...b, days: daysApart(b.ymd, unit.ymd), namesAgree: payeeReadsLike(b.payee, unit.paidTo) }))
    .sort((a, b) => a.days - b.days || Number(b.namesAgree) - Number(a.namesAgree) || a.ymd.localeCompare(b.ymd) || a.id.localeCompare(b.id))
}

/** Every unmatched unit's candidates, by each of its line ids. A unit with a match already is left out. */
export function suggestBankMatches(lines: readonly LedgerLine[], bank: readonly BankLine[], matchedByPayment: ReadonlyMap<string, string>): Map<string, BankCandidate[]> {
  const taken = new Set(matchedByPayment.values())
  const out = new Map<string, BankCandidate[]>()
  for (const unit of matchUnits(lines)) {
    if (unit.lineIds.some((id) => matchedByPayment.has(id))) continue
    const found = bankCandidates(unit, bank, taken)
    if (found.length === 0) continue
    for (const id of unit.lineIds) out.set(id, found)
  }
  return out
}

/** `Nov 12 · CALLOWAY TILE LLC · $1,200.00`: a bank line in a list. */
export function bankLineWords(b: Pick<BankLine, 'ymd' | 'payee' | 'amount'>, withYear = false): string {
  return [ledgerDayWords(b.ymd, withYear), b.payee || 'no payee named', usd(b.amount)].join(' · ')
}

/** `Nov 12 · CALLOWAY TILE LLC`: the matched line under a payment, which already shows the amount. */
export function bankMatchedWords(b: Pick<BankLine, 'ymd' | 'payee'> | null | undefined, withYear = false): string {
  if (!b) return 'matched to the bank'
  return [`bank ${ledgerDayWords(b.ymd, withYear)}`, b.payee].filter(Boolean).join(' · ')
}

/** The first day of bank lines worth reading for these lines: the earliest payment day, less the window. '' when no line has a day. */
export function bankReadFromYmd(lines: readonly LedgerLine[]): string {
  let first = ''
  for (const l of lines) if (l.checkable && l.ymd && (!first || l.ymd < first)) first = l.ymd
  if (!first) return ''
  const t = Date.parse(`${first}T00:00:00Z`) - (BANK_MATCH_DAYS + 1) * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

/** `3 bank lines read. 2 payments have one to match.` */
export function bankReadWords(bankCount: number, suggested: number): string {
  const read = bankCount === 1 ? '1 bank line read.' : `${bankCount} bank lines read.`
  if (suggested === 0) return `${read} None lines up with a payment still to match.`
  return `${read} ${suggested === 1 ? '1 payment has one to match.' : `${suggested} payments have one to match.`}`
}
