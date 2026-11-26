/**
 * One check over many bills (punch list #435, piece 3). A payer hands over one check that pays several bills on
 * several jobs at one place. Before this the office typed it bill by bill, and nothing added the rows up to the check.
 *
 * The check pane on the Lien desk's Payoffs does the thinking:
 *   - `checkBills`: the bills still open at the place, the liened jobs' bills first, each job's oldest bill first,
 *     then the bills on jobs with no filed lien.
 *   - `spreadCheck`: the check placed on those bills in that order, to the cent. A value a person keeps by hand
 *     stays, and the rest of the check is spread over the other bills.
 *   - `checkPlan`: the three totals (the check, placed, left), each line's state, what the check does to the
 *     liens, and the button's words. The batch rule: it records what is ready and holds what is not, with the
 *     reason. Nothing records while the lines add up to more than the check.
 *
 * A line is held, never guessed, when it pays part of a Stripe bill: a part payment there is a credit note Stripe
 * never takes back (`stripePartPayment.ts`), so it goes through the bill's own window, where the office reads what
 * it will do. A whole Stripe bill paid by check is a ledger row only, and Stripe closes it once the check has had
 * its days (`heldStripeMark.ts`), the same as the bill's own window.
 *
 * Every payment the pane records is a Check with the same number and the same day, and a note that names the
 * check's whole amount, so the rows of one check can be told from any other. No migration.
 *
 * Since punch list #437, piece 1, the pane asks the bank about the check typed (`payoffCheckBank`, over
 * `checkCleared.ts`): a check the bank holds and has not cleared is not recorded, and the pane says the day it may
 * be. A check the bank shows no deposit of is recorded as before, and its release waits seven days.
 *
 * Money is worked in cents. Pure; tested beside it. The writes are `lienPayoffCheckIo.ts`.
 */
import { batchWords, type BatchWords } from '../batchWords'
import { moneyWords } from '../moneyParts'
import { val } from '../valuesInPlace'
import { ymdAddDays } from '../../utils/dateUtils'
import { bankCheckAnswer, bankCheckTyped, checkAnswerWords, checkName, type BankCheck } from './checkCleared'
import { CHECK_CLEAR_DAYS } from './checkClearing'
import type { LienPayoffBill, LienPayoffPlace } from './lienPayoff'

export const PAYOFF_CHECK_WORDS = {
  open: 'One check for this place ›',
  title: 'One check',
  back: '‹ The liens',
  amount: 'Check amount',
  amountHint: 'It starts on what pays the liens off. Change it to what the check says.',
  number: 'Check number',
  received: 'Received',
  pays: 'this check pays',
  spreadAgain: 'Spread it again',
  noAmount: 'Type the check’s amount.',
  noNumber: 'Type the check’s number.',
  heldWhy: { one: 'pays part of a Stripe bill', many: 'pay part of a Stripe bill' },
  heldDoor: 'Record it on the bill ›',
  heldLine: 'Part of a Stripe bill is recorded on the bill itself.',
  overLine: 'This is more than the bill owes.',
  failed: 'The payment was not recorded.',
  noDeposit: 'The bank shows no deposit of this check. A release then waits seven days.',
  /** The written request (piece 4): typed with the check, kept on each liened lien the check pays. */
  asked: 'Asked for a release in writing',
  askedHint: 'Leave it empty if no written request has come.',
  clears: 'Check clears',
  clearsBank: 'the bank’s day',
  clearsAbout: 'about, seven days after the check',
  askedNotKept: 'The day a release was asked for did not take on every lien.',
} as const

const cents = (dollars: number | string | null | undefined): number => Math.round((Number(dollars) || 0) * 100)
const dollars = (c: number): number => Math.round(c) / 100

/** A typed amount as dollars, or null: `$16,455.50`, `16455.5`, ` 1,200 `. */
export function parseCheckAmount(text: string): number | null {
  const plain = text.replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(plain)) return null
  const n = Number(plain)
  return Number.isFinite(n) && n > 0 ? n : null
}

export type CheckBill = LienPayoffBill & {
  jobNumber: string
  jobName: string
  /** The job holds a filed lien that is not released. */
  liened: boolean
}

/** The bills still open at a place in the order a check is placed on them. */
export function checkBills(place: Pick<LienPayoffPlace, 'rows' | 'other'>, billsByJob: Readonly<Record<string, ReadonlyArray<LienPayoffBill>>>): CheckBill[] {
  const out: CheckBill[] = []
  const seen = new Set<string>()
  const add = (jobId: string, jobNumber: string, jobName: string, liened: boolean) => {
    if (seen.has(jobId)) return
    seen.add(jobId)
    const bills = [...(billsByJob[jobId] ?? [])].filter((b) => b.open > 0.004).sort((a, b) => a.billedYmd.localeCompare(b.billedYmd) || a.invoiceId.localeCompare(b.invoiceId))
    for (const b of bills) out.push({ ...b, jobNumber, jobName, liened })
  }
  for (const r of place.rows) if (r.step.step !== 'done') add(r.jobId, r.jobNumber, r.jobName, true)
  for (const r of place.rows) add(r.jobId, r.jobNumber, r.jobName, false)
  for (const o of place.other ?? []) add(o.jobId, o.jobNumber, o.jobName, false)
  return out
}

/** What pays the place's liens off: every open bill on a job whose lien is not released. */
export function liensPayoffAmount(bills: ReadonlyArray<CheckBill>): number {
  return dollars(bills.filter((b) => b.liened).reduce((s, b) => s + cents(b.open), 0))
}

/**
 * The check placed on the bills in order, to the cent. `kept` is what a person set by hand, by bill: those stand
 * as typed, and what is left of the check is spread over the rest.
 */
export function spreadCheck(check: number, bills: ReadonlyArray<CheckBill>, kept: Readonly<Record<string, number>> = {}): Record<string, number> {
  const pays: Record<string, number> = {}
  let left = cents(check)
  for (const b of bills) {
    if (kept[b.invoiceId] === undefined) continue
    const c = Math.max(0, cents(kept[b.invoiceId]))
    pays[b.invoiceId] = dollars(c)
    left -= c
  }
  for (const b of bills) {
    if (kept[b.invoiceId] !== undefined) continue
    const c = Math.max(0, Math.min(cents(b.open), left))
    pays[b.invoiceId] = dollars(c)
    left -= c
  }
  return pays
}

export type PayoffCheckBank = {
  /** Why the check is not recorded yet, with its values marked. Null when it may be. */
  hold: string | null
  /** What the bank says when it does not hold the check. Null when there is nothing to say. */
  note: string | null
  tone: 'red' | 'amber' | 'green'
  /** The bank's deposit of this check, or null. */
  check: BankCheck | null
}

/**
 * What the bank says about the check typed in the pane. The bank's deposit is the one with the same number and
 * the same amount to the cent. A check the bank has not cleared holds the press.
 */
export function payoffCheckBank(typed: { check: number | null; number: string }, checks: ReadonlyArray<BankCheck>, todayYmd: string): PayoffCheckBank {
  if (!(Number(typed.check) > 0) || !typed.number.trim()) return { hold: null, note: null, tone: 'green', check: null }
  const check = bankCheckTyped({ number: typed.number, amount: typed.check }, checks)
  if (!check) return { hold: null, note: PAYOFF_CHECK_WORDS.noDeposit, tone: 'amber', check: null }
  const answer = bankCheckAnswer(check, todayYmd)
  const words = checkAnswerWords(answer, checkName(check.checkNumber))
  if (answer.cleared) return { hold: null, note: words.say, tone: 'green', check }
  const tail = answer.state === 'unread' ? '' : answer.state === 'came_back' ? 'Do not record it.' : words.wait === 'until then' ? 'Record it then.' : 'Record it once the bank clears it.'
  return { hold: [words.say, tail].filter(Boolean).join(' '), note: null, tone: words.tone, check }
}

/** The day the check clears, for the pane's worked-out line: the bank's day when the bank holds the check, else about seven days after it. */
export function payoffCheckClears(bank: Pick<PayoffCheckBank, 'check'> | null, receivedYmd: string, todayYmd: string): { ymd: string; about: boolean } | null {
  if (bank?.check) {
    const ymd = bankCheckAnswer(bank.check, todayYmd).clearsYmd
    return ymd ? { ymd, about: false } : null
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(receivedYmd) ? { ymd: ymdAddDays(receivedYmd, CHECK_CLEAR_DAYS), about: true } : null
}

export type CheckLineState = 'none' | 'ready' | 'held' | 'over'

export type CheckLine = { bill: CheckBill; pays: number; state: CheckLineState; why: string | null }

export type CheckPlan = {
  lines: CheckLine[]
  check: number
  placed: number
  /** The check less what is placed. Below zero when the lines add up to more than the check. */
  left: number
  ready: number
  held: number
  /** The button: its label, the line under it, and whether it is dead. */
  words: BatchWords
  /** What the check does, with its values marked. */
  say: string
  tone: 'red' | 'amber' | 'green'
}

/** The whole pane worked out: each line's state, the three totals, what the check does and the button's words. */
export function checkPlan(input: { check: number | null; number: string; bills: ReadonlyArray<CheckBill>; pays: Readonly<Record<string, number>>; bank?: Pick<PayoffCheckBank, 'hold' | 'tone'> | null }): CheckPlan {
  const check = input.check ?? 0
  const lines: CheckLine[] = input.bills.map((bill) => {
    const pays = Math.max(0, input.pays[bill.invoiceId] ?? 0)
    const p = cents(pays)
    const open = cents(bill.open)
    if (p <= 0) return { bill, pays: 0, state: 'none', why: null }
    if (p > open) return { bill, pays, state: 'over', why: PAYOFF_CHECK_WORDS.overLine }
    if (p < open && bill.stripe) return { bill, pays, state: 'held', why: PAYOFF_CHECK_WORDS.heldLine }
    return { bill, pays, state: 'ready', why: null }
  })
  const placedC = lines.reduce((s, l) => s + cents(l.pays), 0)
  const leftC = cents(check) - placedC
  const ready = lines.filter((l) => l.state === 'ready').length
  const held = lines.filter((l) => l.state === 'held' || l.state === 'over').length
  const base = { lines, check, placed: dollars(placedC), left: dollars(leftC), ready, held }
  const dead = (say: string, tone: CheckPlan['tone'] = 'red'): CheckPlan => ({ ...base, words: { ...batchWords({ verb: 'Record', ready: 0, held: 0, noun: 'payment' }), dead: true }, say, tone })

  if (!(check > 0)) return dead(PAYOFF_CHECK_WORDS.noAmount)
  if (leftC < 0) return dead(`The lines add up to ${val('money', moneyWords(dollars(-leftC)))} more than the check.`)
  if (!input.number.trim()) return dead(PAYOFF_CHECK_WORDS.noNumber)
  // The bank holds this check and has not cleared it (#437, piece 1): nothing is recorded yet.
  if (input.bank?.hold) return dead(input.bank.hold, input.bank.tone)

  // What the check does to the liens: a liened job is paid in full when every one of its open bills is.
  const lienedJobs = [...new Set(lines.filter((l) => l.bill.liened).map((l) => l.bill.jobId))]
  const paidJobs = lienedJobs.filter((jobId) => lines.filter((l) => l.bill.jobId === jobId).every((l) => cents(l.pays) >= cents(l.bill.open) && l.state !== 'over'))
  const n = lienedJobs.length
  const k = paidJobs.length
  const liens = n === 0 ? '' : k === n ? (n === 1 ? 'Pays the lien’s bills in full.' : `Pays all ${val('count', String(n))} liens’ bills in full.`) : `Pays ${val('count', String(k))} of ${val('count', String(n))} liens’ bills in full.`
  const unplaced = leftC > 0 ? `${val('money', moneyWords(dollars(leftC)))} of the check is not placed.` : ''
  return {
    ...base,
    words: batchWords({ verb: 'Record', ready, held, heldWhy: PAYOFF_CHECK_WORDS.heldWhy, noun: 'payment' }),
    say: [liens, unplaced].filter(Boolean).join(' ') || 'Nothing is placed on a bill yet.',
    tone: leftC > 0 || held > 0 || (n > 0 && k < n) ? 'amber' : 'green',
  }
}

/** The note every payment of one check carries, so its rows can be told from any other check's. */
export function payoffCheckNote(check: number, number: string, lines: number): string {
  return `Payoff check ${number.trim()}, ${moneyWords(check)} over ${lines} ${lines === 1 ? 'bill' : 'bills'}`
}
