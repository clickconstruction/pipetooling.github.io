// Job Parts Tally → Transactions → Team (punch list #72, PR 3's pay bar): the Cash App pay sends
// waiting in the team's queue, one bar per card. The owner, 2026-10-09: the bar shows only to the
// roles that may mark payroll (dev, controller, a pay-approved master: `canMarkTallyPayroll`, the
// same gate `set_tally_payroll_flag` holds on the server), with no migration. It marks the sends as
// payroll; it does not widen a payroll rule, which stays dev-only configuration (`20260906130000`). The owner,
// the same day: only sends to a person. A send whose note reads as an expense (gas, Home Depot, materials, a
// reimbursement: `classifyCashAppNote`, the Cash App lane's own words) stays off the bar, counted, to sort by hand.
// Pure: the writes are in `TallyTeamQueue.tsx`.

import type { Json } from '../../types/database'
import { mercuryBankDescriptionFromRaw } from '../mercuryBankDescriptionFromRaw'
import { classifyCashAppNote } from '../cashapp/cashAppLane'
import type { TallyQueueCard } from './tallyTeamQueue'

const CASH_APP = /cash\s*app/i

/** One pay send on a card. */
export type TallyPaySend = {
  chargeId: string
  /** Who it went to, from Mercury's bank description (`CASH APP*ISAIAH WHITES` → Isaiah Whites), or null. */
  payee: string | null
  amount: number
}

/** One card's pay sends: the bar. */
export type TallyPaySendGroup = {
  holderId: string
  holderName: string
  sends: TallyPaySend[]
  /** The signed total of the sends (negative: money out). */
  total: number
  /** Cash App sends on the card whose note reads as an expense, left off the bar to sort by hand. */
  expenseSends: number
}

type CashAppRow = { counterparty_name: string | null; raw: Json | null; amount: number | string | null; note?: string | null }

/**
 * What a charge is to the bar: `pay` for a Cash App send to a person, `expense` for a Cash App send whose note
 * reads as an expense (it stays off the bar), null for anything else. A Cash App send is money out (an incoming
 * Cash App credit is not pay) whose counterparty or Mercury bank description names Cash App.
 */
export function tallyCashAppSendKind(row: CashAppRow): 'pay' | 'expense' | null {
  if (!(Number(row.amount) < 0)) return null
  if (!CASH_APP.test(row.counterparty_name ?? '') && !CASH_APP.test(mercuryBankDescriptionFromRaw(row.raw) ?? '')) return null
  return classifyCashAppNote(row.note ?? '') === 'expense' ? 'expense' : 'pay'
}

/** A Cash App send to a person: the bar marks it. */
export function isTallyPaySend(row: CashAppRow): boolean {
  return tallyCashAppSendKind(row) === 'pay'
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
}

/** The payee after the `*` in Mercury's bank description, in title case; null when there is none. */
export function tallyPaySendPayee(raw: Json | null): string | null {
  const bank = mercuryBankDescriptionFromRaw(raw)
  if (!bank) return null
  const star = bank.indexOf('*')
  if (star < 0) return null
  const name = bank.slice(star + 1).trim()
  return name ? titleCase(name) : null
}

/** The queue's pay sends, one group per card holder, by name; a card with no send to a person has no bar. */
export function tallyPaySendGroups(cards: readonly TallyQueueCard[]): TallyPaySendGroup[] {
  const byHolder = new Map<string, TallyPaySendGroup>()
  for (const card of cards) {
    for (const { row, charge } of card.charges) {
      const kind = tallyCashAppSendKind(row)
      if (!kind) continue
      const group = byHolder.get(card.holderId) ?? { holderId: card.holderId, holderName: card.holderName, sends: [], total: 0, expenseSends: 0 }
      if (kind === 'expense') group.expenseSends += 1
      else {
        group.sends.push({ chargeId: charge.id, payee: tallyPaySendPayee(row.raw), amount: charge.amount })
        group.total = Math.round((group.total + charge.amount) * 100) / 100
      }
      byHolder.set(card.holderId, group)
    }
  }
  return [...byHolder.values()].filter((g) => g.sends.length > 0).sort((a, b) => a.holderName.localeCompare(b.holderName))
}

const money = (n: number) =>
  Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

const sendsWords = (n: number) => `${n} Cash App ${n === 1 ? 'pay send' : 'pay sends'}`

/** The bar's words: what and whose, who it went to, the sends it left off, and the button. */
export function tallyPayBarWords(group: TallyPaySendGroup): { title: string; payees: string; leftOff: string; button: string } {
  const n = group.sends.length
  const names = [...new Set(group.sends.map((s) => s.payee).filter((p): p is string => p != null))]
  const shown = names.slice(0, 3)
  const more = names.length - shown.length
  let payees = ''
  if (shown.length > 0) {
    const list = shown.length === 1 ? shown[0]! : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`
    payees = more > 0 ? `To ${shown.join(', ')} and ${more} more.` : `To ${list}.`
  }
  const e = group.expenseSends
  const leftOff =
    e === 0 ? '' : e === 1 ? 'One more send has a note like gas or Home Depot. Sort it by hand.' : `${e} more sends have a note like gas or Home Depot. Sort them by hand.`
  return {
    title: `${sendsWords(n)} on ${group.holderName}’s card · ${money(group.total)}`,
    payees,
    leftOff,
    button: n === 1 ? 'Mark it payroll' : `Mark ${n} payroll`,
  }
}

/** The server's own words for the first refusal, after the count, so the reason reaches the person. */
const because = (reason: string | null | undefined) => (reason ? ` ${reason.trim().replace(/\.?$/, '.')}` : '')

/** The message after marking: how many went to payroll, and the first refusal's words when any could not. */
export function tallyPayMarkToast(done: number, failed: number, reason?: string | null): { message: string; type: 'success' | 'error' } {
  if (done === 0) return { message: `Nothing was marked.${because(reason) || ' Try again.'}`, type: 'error' }
  if (failed > 0) return { message: `Marked ${done} of ${done + failed} as payroll.${because(reason)}`, type: 'error' }
  return { message: `Marked ${sendsWords(done)} as payroll.`, type: 'success' }
}

/** The message after undoing a mark: the sends are back to sort. */
export function tallyPayUnmarkToast(done: number, failed: number, reason?: string | null): { message: string; type: 'success' | 'error' } {
  if (done === 0) return { message: `Nothing was undone.${because(reason) || ' Try again.'}`, type: 'error' }
  if (failed > 0) return { message: `${done} of ${done + failed} are back to sort.${because(reason) || ' The rest could not be undone.'}`, type: 'error' }
  return { message: done === 1 ? '1 pay send is back to sort.' : `${done} pay sends are back to sort.`, type: 'success' }
}
