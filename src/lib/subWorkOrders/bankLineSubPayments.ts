/**
 * The Banking side of the sub payment match (punch list #347; Taunya, 2026-11-15: "Build all four").
 *
 * `subPaymentBankMatch` starts from a payment on the Subs Ledger and finds the bank line it left on. This starts
 * from a bank line on Banking and reads the same facts the other way: which sub payment the line already paid, and,
 * for a line nothing has taken, which payments it could be. The rules are the ledger's own, read from its kernel:
 * the same amount to the cent, within `BANK_MATCH_DAYS`, the closest day first, a payee that reads like the sub
 * breaking a tie. The lines of one sending are one unit worth what was sent. A press matches and nothing is
 * matched without it. A bank line a payment took is offered to nobody else.
 *
 * Pure: no React, no Supabase.
 */
import { BANK_MATCH_DAYS, bankLinesFromRows, daysApart, matchUnits, payeeReadsLike, type BankLine, type BankRow, type MatchUnit } from './subPaymentBankMatch'
import { ledgerDayWords, sendingTagWords, type LedgerLine, type LedgerSheet } from './subPaymentsLedger'
import { buildSheetPartiesLookup, sheetParties } from './sheetParties'
import type { NeedsWorkOrderRosterPerson } from './sheetsNeedingWorkOrder'
import { sheetLabel } from '../jobs/subPaymentMoveRemove'
import type { LaborJobPayment } from '../../types/laborJob'

const cents = (n: number): number => Math.round(n * 100)
const usd = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const uniq = (list: readonly string[]): string[] => [...new Set(list.filter(Boolean))]

/** What Banking reads to know the sub payments: the rows that moved money, and the sheets they sit on. */
export type BankSideRead = {
  payments: ReadonlyArray<LaborJobPayment & { job_id: string }>
  sheets: ReadonlyArray<{ id: string; assigned_to_name: string | null; address: string | null; job_number: string | null; job_ledger_id: string | null }>
  jobNamesById: Readonly<Record<string, string>>
  assigneesBySheetId: ReadonlyMap<string, ReadonlyArray<{ personId: string; personName: string | null }>>
}

/**
 * The read as the ledger's sheets, so the lines and the units come from the ledger's own kernel. *Paid to* is the
 * Pay view's rule (`sheetParties`). What a sheet was agreed at is not read: Banking draws no *Left on the sheet*.
 */
export function bankSideSheets(read: BankSideRead, roster: readonly NeedsWorkOrderRosterPerson[]): LedgerSheet[] {
  const lookup = buildSheetPartiesLookup(roster)
  const paymentsBySheet = new Map<string, LaborJobPayment[]>()
  for (const p of read.payments) {
    const list = paymentsBySheet.get(p.job_id)
    if (list) list.push(p)
    else paymentsBySheet.set(p.job_id, [p])
  }
  return read.sheets.map((s) => {
    const parties = sheetParties(s, read.assigneesBySheetId.get(s.id), lookup)
    return {
      id: s.id,
      paidTo: parties.label || (s.assigned_to_name ?? '').trim() || 'nobody named',
      paidToKey: parties.key || `sheet:${s.id}`,
      crew: roster.length > 0 && parties.crew,
      job: sheetLabel({ job_number: s.job_number, job_ledger_id: s.job_ledger_id, address: s.address ?? '' }, read.jobNamesById as Record<string, string>),
      address: (s.address ?? '').trim(),
      agreed: 0,
      payments: paymentsBySheet.get(s.id) ?? [],
      events: [],
    }
  })
}

/** One money movement as Banking names it: the ledger's unit, with the sending's number and the jobs its lines sit on. */
export type BankSideUnit = MatchUnit & {
  sendingNo: number | null
  jobs: string[]
}

/** The ledger's payments as units, each with what a bank line's picker needs to name it. */
export function bankSideUnits(lines: readonly LedgerLine[]): BankSideUnit[] {
  const byId = new Map(lines.map((l) => [l.id, l]))
  return matchUnits(lines).map((u) => {
    const own = u.lineIds.map((id) => byId.get(id)).filter((l): l is LedgerLine => !!l)
    return { ...u, sendingNo: own[0]?.sendingNo ?? null, jobs: uniq(own.map((l) => l.job)) }
  })
}

export type BankSideCandidate = BankSideUnit & { days: number; namesAgree: boolean }

/**
 * The payments a bank line could be, best first. A unit with a match already is left out, and so is one with no
 * day: without a day there is nothing to hold it against the bank.
 */
export function subPaymentCandidates(line: BankLine, units: readonly BankSideUnit[], matchedByPayment: ReadonlyMap<string, string>): BankSideCandidate[] {
  if (!line.ymd) return []
  const want = cents(line.amount)
  return units
    .filter((u) => u.ymd && cents(u.amount) === want && daysApart(u.ymd, line.ymd) <= BANK_MATCH_DAYS && !u.lineIds.some((id) => matchedByPayment.has(id)))
    .map((u) => ({ ...u, days: daysApart(u.ymd, line.ymd), namesAgree: payeeReadsLike(line.payee, u.paidTo) }))
    .sort((a, b) => a.days - b.days || Number(b.namesAgree) - Number(a.namesAgree) || a.ymd.localeCompare(b.ymd) || a.paymentId.localeCompare(b.paymentId))
}

/** What a bank line paid: every unit matched to it. More than one only for payments typed one per sheet before sendings. */
export type BankLinePaid = {
  /** One payment of each unit on the line: taking the line back clears each of them. */
  paymentIds: string[]
  paidTo: string[]
  sendingNos: number[]
  /** How many ledger lines sit on it. Zero when the payments are matched but this login cannot read them. */
  lineCount: number
  /** What those lines sent. */
  amount: number
}

/** What one bank line reads on Banking: what it paid, or the payments a press could match it to. */
export type BankSideLine = { paid: BankLinePaid | null; offers: BankSideCandidate[] }

/**
 * Every bank row given, by id, with what it says about subs. A row that already holds a match says what it
 * paid and is offered nothing more. A row that is not real money out (money in, a duplicate, failed or
 * cancelled) is offered nothing. A row with nothing to say is left out of the map.
 */
export function bankSideRead(rows: readonly BankRow[], lines: readonly LedgerLine[], matchedByPayment: ReadonlyMap<string, string>): Map<string, BankSideLine> {
  const units = bankSideUnits(lines)
  const unitsByTx = new Map<string, BankSideUnit[]>()
  for (const u of units) {
    const tx = u.lineIds.map((id) => matchedByPayment.get(id)).find(Boolean)
    if (!tx) continue
    const list = unitsByTx.get(tx)
    if (list) list.push(u)
    else unitsByTx.set(tx, [u])
  }
  // A bank line is held against the units of its own amount alone: Banking shows thousands of lines at once.
  const unitsByCents = new Map<number, BankSideUnit[]>()
  for (const u of units) {
    const list = unitsByCents.get(cents(u.amount))
    if (list) list.push(u)
    else unitsByCents.set(cents(u.amount), [u])
  }
  const taken = new Set(matchedByPayment.values())
  const outgoing = new Map(bankLinesFromRows(rows).map((b) => [b.id, b]))
  const out = new Map<string, BankSideLine>()
  for (const r of rows) {
    if (taken.has(r.id)) {
      const on = unitsByTx.get(r.id) ?? []
      out.set(r.id, {
        paid: {
          paymentIds: on.map((u) => u.paymentId),
          paidTo: uniq(on.map((u) => u.paidTo)),
          sendingNos: [...new Set(on.map((u) => u.sendingNo).filter((n): n is number => !!n))],
          lineCount: on.reduce((n, u) => n + u.lineIds.length, 0),
          amount: Math.round(on.reduce((n, u) => n + u.amount, 0) * 100) / 100,
        },
        offers: [],
      })
      continue
    }
    const line = outgoing.get(r.id)
    if (!line) continue
    const offers = subPaymentCandidates(line, unitsByCents.get(cents(line.amount)) ?? [], matchedByPayment)
    if (offers.length > 0) out.set(r.id, { paid: null, offers })
  }
  return out
}

/** `paid Calloway Tile · sending 12 · 2 sheets`: what a matched bank line says under its payee. */
export function bankLinePaidWords(paid: BankLinePaid): string {
  if (paid.lineCount === 0) return 'paid a sub'
  const who = paid.paidTo.length === 0 ? 'a sub' : paid.paidTo.length <= 2 ? paid.paidTo.join(' and ') : `${paid.paidTo.length} subs`
  const sending = paid.sendingNos.length === 1 && paid.paymentIds.length === 1 ? sendingTagWords(paid.sendingNos[0]) : ''
  const sheets = paid.lineCount > 1 ? `${paid.lineCount} sheets` : ''
  return [`paid ${who}`, sending, sheets].filter(Boolean).join(' · ')
}

/** `Nov 12 · Calloway Tile · 2104 Larkspur · $1,200.00`: a payment in a bank line's picker. A sending names its number and its sheets. */
export function subPaymentPickWords(c: Pick<BankSideUnit, 'ymd' | 'paidTo' | 'amount' | 'sendingNo' | 'jobs' | 'lineIds'>, withYear = false): string {
  const where = c.lineIds.length > 1 ? [sendingTagWords(c.sendingNo), `${c.lineIds.length} sheets`].filter(Boolean).join(', ') : (c.jobs[0] ?? '')
  return [ledgerDayWords(c.ymd, withYear), c.paidTo || 'nobody named', where, usd(c.amount)].filter(Boolean).join(' · ')
}
