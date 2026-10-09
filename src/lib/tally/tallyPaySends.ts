// Job Parts Tally → Transactions → Team (punch list #72, PR 3's pay bar): the Cash App pay sends
// waiting in the team's queue, one bar per card. The owner, 2026-10-09: the bar shows only to the
// roles that may mark payroll (dev, controller, a pay-approved master: `canMarkTallyPayroll`, the
// same gate `set_tally_payroll_flag` holds on the server), with no migration. It marks the sends as
// payroll; it does not widen a payroll rule, which stays dev-only configuration (`20260906130000`).
// Pure: the writes are in `TallyTeamQueue.tsx`.

import type { Json } from '../../types/database'
import { mercuryBankDescriptionFromRaw } from '../mercuryBankDescriptionFromRaw'
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
}

/** A Cash App send on the card: the counterparty or Mercury's bank description names Cash App. */
export function isTallyPaySend(row: { counterparty_name: string | null; raw: Json | null }): boolean {
  if (CASH_APP.test(row.counterparty_name ?? '')) return true
  return CASH_APP.test(mercuryBankDescriptionFromRaw(row.raw) ?? '')
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

/** The queue's pay sends, one group per card holder, by name; a card with none has no bar. */
export function tallyPaySendGroups(cards: readonly TallyQueueCard[]): TallyPaySendGroup[] {
  const byHolder = new Map<string, TallyPaySendGroup>()
  for (const card of cards) {
    for (const { row, charge } of card.charges) {
      if (!isTallyPaySend(row)) continue
      const group = byHolder.get(card.holderId) ?? { holderId: card.holderId, holderName: card.holderName, sends: [], total: 0 }
      group.sends.push({ chargeId: charge.id, payee: tallyPaySendPayee(row.raw), amount: charge.amount })
      group.total = Math.round((group.total + charge.amount) * 100) / 100
      byHolder.set(card.holderId, group)
    }
  }
  return [...byHolder.values()].sort((a, b) => a.holderName.localeCompare(b.holderName))
}

const money = (n: number) =>
  Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

const sendsWords = (n: number) => `${n} Cash App ${n === 1 ? 'pay send' : 'pay sends'}`

/** The bar's words: what and whose, who it went to, and the button. */
export function tallyPayBarWords(group: TallyPaySendGroup): { title: string; payees: string; button: string } {
  const n = group.sends.length
  const names = [...new Set(group.sends.map((s) => s.payee).filter((p): p is string => p != null))]
  const shown = names.slice(0, 3)
  const more = names.length - shown.length
  let payees = ''
  if (shown.length > 0) {
    const list = shown.length === 1 ? shown[0]! : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`
    payees = more > 0 ? `To ${shown.join(', ')} and ${more} more.` : `To ${list}.`
  }
  return {
    title: `${sendsWords(n)} on ${group.holderName}’s card · ${money(group.total)}`,
    payees,
    button: n === 1 ? 'Mark it payroll' : `Mark ${n} payroll`,
  }
}

/** The message after marking: how many went to payroll, and whether any could not. */
export function tallyPayMarkToast(done: number, failed: number): { message: string; type: 'success' | 'error' } {
  if (done === 0) return { message: 'Nothing was marked. Try again.', type: 'error' }
  if (failed > 0) return { message: `Marked ${done} of ${done + failed} as payroll. The rest need another look.`, type: 'error' }
  return { message: `Marked ${sendsWords(done)} as payroll.`, type: 'success' }
}

/** The message after undoing a mark: the sends are back to sort. */
export function tallyPayUnmarkToast(done: number, failed: number): { message: string; type: 'success' | 'error' } {
  if (done === 0) return { message: 'Nothing was undone. Try again.', type: 'error' }
  if (failed > 0) return { message: `${done} of ${done + failed} are back to sort. The rest could not be undone.`, type: 'error' }
  return { message: done === 1 ? '1 pay send is back to sort.' : `${done} pay sends are back to sort.`, type: 'success' }
}
