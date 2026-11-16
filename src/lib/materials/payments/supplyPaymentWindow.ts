/**
 * Record a payment to a supply house: the window's arithmetic (the owner's ask of 2026-11-16).
 *
 * A supply house is paid by picking invoices in its portal, so ticking bills leads and the amount adds itself.
 * Typing the amount still works: it fills the oldest bills first. A box lowered is a part payment. An open credit
 * memo is a line to tick, and it lowers the money needed the way a statement nets a credit. Money an earlier
 * payment left on account with the house is offered first. Money past the bills is kept on account only when the
 * person says so, and the press is dead with its reason until every dollar is placed.
 *
 * The window holds a `PayWindowState`; every change goes through a function here and `planSupplyPayment` reads the
 * state into what the press records (`record_supply_house_payment`). Sums are in cents, so no float drifts.
 *
 * Pure: no React, no Supabase.
 */

import { SUPPLY_PAY_LATER, fromCents, toCents, usd, type SupplyPayChip } from './supplyPayment'

/** An open bill, as the window lists it. `open` is above zero. */
export type PayWindowBill = { id: string; number: string; title: string; dueYmd: string | null; open: number }
/** An open credit memo. `open` is how much credit is left on it, above zero. */
export type PayWindowCredit = { id: string; number: string; open: number }
/** Money an earlier payment left on account with this house. */
export type PayWindowAccount = { paymentId: string; amount: number }

export type PayWindowContext = {
  /** Oldest due first: `orderBillsOldestFirst`. */
  bills: ReadonlyArray<PayWindowBill>
  credits: ReadonlyArray<PayWindowCredit>
  /** Oldest payment first. */
  account: ReadonlyArray<PayWindowAccount>
  /** Part payments, credits and money on account are switched on. Off, a bill is paid whole or not at all. */
  parts: boolean
}

export type PayWindowState = {
  amountText: string
  /** True once the person types the amount: the bills then follow it. False, the amount follows the bills. */
  amountTyped: boolean
  /** A ticked bill's box, as typed. A bill with no entry is not ticked. */
  boxes: Readonly<Record<string, string>>
  /** The credit memos ticked. */
  credits: ReadonlyArray<string>
  /** Use the money on account first. */
  useAccount: boolean
  /** Keep what is not on a bill on account with the house. */
  keepOnAccount: boolean
}

export const EMPTY_PAY_WINDOW: PayWindowState = { amountText: '', amountTyped: false, boxes: {}, credits: [], useAccount: false, keepOnAccount: false }

/** A typed amount as a number: commas and a dollar sign dropped, `NaN` when it is not one. */
export function parsePayAmount(text: string): number {
  const t = text.trim().replace(/[$,\s]/g, '')
  return /^\d*\.?\d+$|^\d+\.$/.test(t) ? parseFloat(t) : NaN
}

const money = (c: number): string => fromCents(c).toFixed(2)
const validCents = (text: string): number => {
  const n = parsePayAmount(text)
  return Number.isFinite(n) && n > 0 ? toCents(n) : 0
}

/** Oldest due first; a bill with no due day goes last; the number breaks a tie. */
export function orderBillsOldestFirst<T extends { dueYmd: string | null; number: string }>(bills: ReadonlyArray<T>): T[] {
  return [...bills].sort((a, b) => {
    if (a.dueYmd && b.dueYmd && a.dueYmd !== b.dueYmd) return a.dueYmd.localeCompare(b.dueYmd)
    if (!a.dueYmd !== !b.dueYmd) return a.dueYmd ? -1 : 1
    return a.number.localeCompare(b.number, undefined, { numeric: true })
  })
}

const creditCents = (state: PayWindowState, ctx: PayWindowContext): number => ctx.credits.reduce((s, c) => (state.credits.includes(c.id) ? s + toCents(c.open) : s), 0)
const accountCents = (state: PayWindowState, ctx: PayWindowContext): number => (state.useAccount ? ctx.account.reduce((s, a) => s + toCents(a.amount), 0) : 0)

/** The boxes a sum of money fills, oldest bill first. Without part payments a bill is taken whole, and the fill stops at the first that does not fit. */
function boxesFor(availableCents: number, ctx: PayWindowContext): Record<string, string> {
  const boxes: Record<string, string> = {}
  let left = availableCents
  for (const b of ctx.bills) {
    const open = toCents(b.open)
    if (left <= 0 || open <= 0) break
    if (!ctx.parts && left < open) break
    const take = Math.min(open, left)
    boxes[b.id] = money(take)
    left -= take
  }
  return boxes
}

/** After a change to what lowers the money needed (a credit, the money on account): a typed amount fills again. */
function refill(state: PayWindowState, ctx: PayWindowContext): PayWindowState {
  if (!state.amountTyped) return state
  const sent = validCents(state.amountText)
  if (sent <= 0) return state
  return { ...state, boxes: boxesFor(sent + creditCents(state, ctx) + accountCents(state, ctx), ctx) }
}

/** Tick or untick a bill. Ticked, its box is everything it has open. */
export function tickBill(state: PayWindowState, bill: PayWindowBill, on: boolean): PayWindowState {
  const boxes = { ...state.boxes }
  if (on) boxes[bill.id] = money(toCents(bill.open))
  else delete boxes[bill.id]
  return { ...state, boxes }
}

/** A bill's box typed into. An amount above zero ticks the bill; an empty box unticks it. */
export function setBillBox(state: PayWindowState, billId: string, text: string): PayWindowState {
  const boxes = { ...state.boxes }
  if (text.trim() === '') delete boxes[billId]
  else boxes[billId] = text
  return { ...state, boxes }
}

export function tickCredit(state: PayWindowState, creditId: string, on: boolean, ctx: PayWindowContext): PayWindowState {
  const credits = on ? [...new Set([...state.credits, creditId])] : state.credits.filter((id) => id !== creditId)
  return refill({ ...state, credits }, ctx)
}

export function setUseAccount(state: PayWindowState, on: boolean, ctx: PayWindowContext): PayWindowState {
  return refill({ ...state, useAccount: on }, ctx)
}

/** The Amount sent box typed into: the bills follow it, oldest first. Emptied, the amount follows the bills again. */
export function typeAmount(state: PayWindowState, text: string, ctx: PayWindowContext): PayWindowState {
  const typed = text.trim() !== ''
  const next: PayWindowState = { ...state, amountText: text, amountTyped: typed }
  if (!typed) return next
  const sent = validCents(text)
  return sent > 0 ? { ...next, boxes: boxesFor(sent + creditCents(next, ctx) + accountCents(next, ctx), ctx) } : next
}

/** Fill oldest first: a typed amount is spread again; with none, every bill is ticked and the amount follows. */
export function fillOldestFirst(state: PayWindowState, ctx: PayWindowContext): PayWindowState {
  const sent = state.amountTyped ? validCents(state.amountText) : 0
  if (sent > 0) return { ...state, boxes: boxesFor(sent + creditCents(state, ctx) + accountCents(state, ctx), ctx) }
  const boxes: Record<string, string> = {}
  for (const b of ctx.bills) boxes[b.id] = money(toCents(b.open))
  return { ...state, amountText: '', amountTyped: false, boxes }
}

/** Tick every bill due on or before a day, each for all it has open. The amount follows. */
export function tickDueBy(state: PayWindowState, ctx: PayWindowContext, ymd: string): PayWindowState {
  const boxes: Record<string, string> = {}
  for (const b of ctx.bills) if (b.dueYmd && b.dueYmd <= ymd) boxes[b.id] = money(toCents(b.open))
  return { ...state, amountText: '', amountTyped: false, boxes }
}

/** How many bills a day's tick would take, for its link's words. */
export function dueByCount(ctx: PayWindowContext, ymd: string): number {
  return ctx.bills.filter((b) => b.dueYmd && b.dueYmd <= ymd).length
}

const daysIn = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate()
const ymdOf = (year: number, month: number, day: number): string => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/**
 * The house's next pay day, today counted: `pays on the 15th` read on Nov 12 is Nov 15, read on Nov 16 is Dec 15.
 * A day past the month's end is the month's last day. Null when the house has no pay day.
 */
export function nextPayDay(monthlyPaymentDay: number | null | undefined, todayYmd: string): string | null {
  const day = Number(monthlyPaymentDay)
  if (!Number.isInteger(day) || day < 1 || day > 31 || !/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) return null
  let year = Number(todayYmd.slice(0, 4))
  let month = Number(todayYmd.slice(5, 7))
  const thisMonth = ymdOf(year, month, Math.min(day, daysIn(year, month)))
  if (thisMonth >= todayYmd) return thisMonth
  month += 1
  if (month > 12) {
    month = 1
    year += 1
  }
  return ymdOf(year, month, Math.min(day, daysIn(year, month)))
}

export type PayWindowBillNote = { words: string; tone: 'plain' | 'bad' }

export type PayWindowPlan = {
  /** What was sent, in dollars. */
  sent: number
  /** What the boxes put on bills. */
  placed: number
  creditUsed: number
  accountUsed: number
  /** Sent, credits and account money, less what is placed. Above zero is not on a bill yet; below zero is too much placed. */
  left: number
  /** Bills ticked with an amount. */
  billCount: number
  notes: Readonly<Record<string, PayWindowBillNote>>
  /** `$2,052.40 placed of $1,840.00 sent`, and what else paid for it. */
  placedWords: string
  /** `$30.00 is not on a bill yet.` · `Every dollar is placed.` */
  leftWords: string
  leftTone: 'plain' | 'bad'
  /** The press, naming what it records. */
  pressLabel: string
  /** Why the press is dead, or '' when it can be pressed. */
  reason: string
  /** Under a live press: what it will do. */
  afterWords: string
  /** The arguments of `record_supply_house_payment`, when the press is live. */
  record: { amount: number; lines: { invoice_id: string; amount: number }[]; fromAccount: { payment_id: string; invoice_id: string; amount: number }[]; keepOnAccount: boolean } | null
}

const billsWord = (n: number): string => `${n} ${n === 1 ? 'bill' : 'bills'}`

/** Read the window into what the press records, with the words around it. */
export function planSupplyPayment(state: PayWindowState, ctx: PayWindowContext, opts: { chip: SupplyPayChip | null; paidOn: string; dayWords?: string; house?: string }): PayWindowPlan {
  const house = opts.house?.trim() || 'the house'
  const notes: Record<string, PayWindowBillNote> = {}
  let placedC = 0
  let billCount = 0
  let overBox = false
  let badBox = false
  let partBox = false
  const boxCents = new Map<string, number>()
  for (const b of ctx.bills) {
    const text = state.boxes[b.id]
    if (text == null) continue
    const typed = parsePayAmount(text)
    const open = toCents(b.open)
    if (!Number.isFinite(typed) || typed <= 0) {
      badBox = true
      notes[b.id] = { words: 'Type an amount above zero, or untick the bill.', tone: 'bad' }
      continue
    }
    const c = toCents(typed)
    boxCents.set(b.id, c)
    placedC += c
    billCount += 1
    if (c > open) {
      overBox = true
      notes[b.id] = { words: `${usd(fromCents(c - open))} more than this bill has open.`, tone: 'bad' }
    } else if (c < open) {
      partBox = true
      notes[b.id] = { words: `A part payment. ${usd(fromCents(open - c))} stays open on the bill.`, tone: 'plain' }
    } else notes[b.id] = { words: 'Paid in full.', tone: 'plain' }
  }

  const creditC = creditCents(state, ctx)
  const accountAvailC = accountCents(state, ctx)
  const needC = placedC - creditC
  const accountC = Math.max(0, Math.min(accountAvailC, needC))
  const typedSent = parsePayAmount(state.amountText)
  const badAmount = state.amountTyped && !(Number.isFinite(typedSent) && typedSent >= 0)
  const sentC = state.amountTyped ? (badAmount ? 0 : toCents(typedSent)) : Math.max(0, needC - accountC)
  const leftC = sentC + creditC + accountC - placedC
  const keep = leftC > 0 && state.keepOnAccount && ctx.parts
  const later = opts.chip === SUPPLY_PAY_LATER || opts.chip == null

  const paidFor: string[] = []
  if (creditC > 0) paidFor.push(`a ${usd(fromCents(creditC))} credit`)
  if (accountC > 0) paidFor.push(`${usd(fromCents(accountC))} from the account`)
  const placedWords = `${usd(fromCents(placedC))} placed of ${usd(fromCents(sentC))} sent${paidFor.length ? `, with ${paidFor.join(' and ')}` : ''}`

  let reason = ''
  if (badAmount) reason = 'Type the amount sent in dollars and cents.'
  else if (badBox) reason = 'One box is not an amount.'
  else if (placedC === 0 && sentC === 0) reason = creditC > 0 ? 'Tick the bills this credit goes on.' : 'Tick a bill, or type the amount sent.'
  else if (overBox) reason = 'One box is more than its bill has open.'
  else if (partBox && !ctx.parts) reason = 'A bill is paid whole here. Tick it, or leave it for the next payment.'
  else if (needC < 0) reason = 'The credit is more than the bills ticked. Tick another bill, or untick the credit.'
  else if (leftC < 0) reason = 'More is placed than was sent. Lower a box or raise the amount.'
  else if (leftC > 0 && !keep) reason = ctx.parts ? `Put ${usd(fromCents(leftC))} on a bill, or keep it on account.` : `${usd(fromCents(leftC))} is not on a bill. Tick the bills this paid, so the amounts match.`
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.paidOn)) reason = 'Pick the day it was sent.'

  const leftWords = leftC > 0 ? `${usd(fromCents(leftC))} is not on a bill yet.` : leftC < 0 ? `${usd(fromCents(-leftC))} more is placed than was sent.` : sentC > 0 || placedC > 0 ? 'Every dollar is placed.' : ''

  let pressLabel = 'Record payment'
  if (sentC > 0) {
    pressLabel = `Record ${usd(fromCents(sentC))} ${billCount > 0 ? `on ${billsWord(billCount)}` : 'on account'}`
    if (creditC > 0) pressLabel += `, with a ${usd(fromCents(creditC))} credit`
    if (later) pressLabel += ', details later'
  } else if (billCount > 0 && placedC > 0) pressLabel = `Settle ${billsWord(billCount)} with no money sent`

  const afterWords = reason ? '' : keep ? `${usd(fromCents(leftC))} will wait on account with ${house}.` : billCount > 0 ? `Each bill paid in full will read paid on ${opts.dayWords ?? opts.paidOn}.` : ''

  let record: PayWindowPlan['record'] = null
  if (!reason) {
    const lines: { invoice_id: string; amount: number }[] = []
    const fromAccount: { payment_id: string; invoice_id: string; amount: number }[] = []
    // The money on account goes on the oldest bills ticked, from the oldest payment that holds any.
    const pots = state.useAccount ? ctx.account.map((a) => ({ id: a.paymentId, left: toCents(a.amount) })) : []
    let budget = accountC
    for (const b of ctx.bills) {
      let box = boxCents.get(b.id) ?? 0
      if (box <= 0) continue
      for (const pot of pots) {
        if (budget <= 0 || box <= 0) break
        const take = Math.min(pot.left, box, budget)
        if (take <= 0) continue
        fromAccount.push({ payment_id: pot.id, invoice_id: b.id, amount: fromCents(take) })
        pot.left -= take
        box -= take
        budget -= take
      }
      if (box > 0) lines.push({ invoice_id: b.id, amount: fromCents(box) })
    }
    for (const c of ctx.credits) if (state.credits.includes(c.id)) lines.push({ invoice_id: c.id, amount: -fromCents(toCents(c.open)) })
    record = { amount: fromCents(sentC), lines, fromAccount, keepOnAccount: keep }
  }

  return {
    sent: fromCents(sentC),
    placed: fromCents(placedC),
    creditUsed: fromCents(creditC),
    accountUsed: fromCents(accountC),
    left: fromCents(leftC),
    billCount,
    notes,
    placedWords,
    leftWords,
    leftTone: leftC < 0 ? 'bad' : 'plain',
    pressLabel,
    reason,
    afterWords,
    record,
  }
}

/** The Amount sent box's text: what was typed, or what the bills ticked add up to. */
export function amountBoxText(state: PayWindowState, plan: PayWindowPlan): string {
  if (state.amountTyped) return state.amountText
  return plan.sent > 0 ? plan.sent.toFixed(2) : ''
}

/** `5 open bills · $5,201.75 · 1 open credit · pays on the 20th`: the line under the window's name. */
export function payWindowSummaryWords(ctx: PayWindowContext, payDayWords: string): string {
  const open = ctx.bills.reduce((s, b) => s + toCents(b.open), 0)
  const parts = [ctx.bills.length === 0 ? 'no open bills' : `${ctx.bills.length} open ${ctx.bills.length === 1 ? 'bill' : 'bills'} · ${usd(fromCents(open))}`]
  if (ctx.parts && ctx.credits.length > 0) parts.push(`${ctx.credits.length} open ${ctx.credits.length === 1 ? 'credit' : 'credits'}`)
  if (payDayWords) parts.push(payDayWords)
  return parts.join(' · ')
}
