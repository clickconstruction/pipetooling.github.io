/**
 * A supply house payment and the bank line it left on (the owner, 2026-11-16: "most of our supply house bills are
 * paid via credit card or ach").
 *
 * A payment is what the office typed. The bank holds what really left. Read from the feed on 2026-11-16, both kinds
 * are there: a card payment to a house is a debit card line and an ACH pull is a line of kind `other`, each with
 * the house as its payee. So the match runs in both directions:
 *
 *   - a payment is offered the bank lines for the same money, within three days, and a person presses the right one;
 *   - a bank line to a house that no payment claims is listed, and opens Record a payment with its day, its amount
 *     and its method filled, so only the bills are left to tick.
 *
 * A house whose payments never show in the feed (a card that is not the company's Mercury card) simply gets no
 * offer, and its payments stay typed. Nothing is matched without a press.
 *
 * The rows the bank lines come from, and the three-day window, are the Subs Ledger's (`subPaymentBankMatch.ts`):
 * one reading of the feed for both. Pure: no React, no Supabase.
 */

import { BANK_MATCH_DAYS, bankLinesFromRows, daysApart, type BankLine, type BankRow } from '../../subWorkOrders/subPaymentBankMatch'
import { toCents, usd, type SupplyPayMethod, type SupplyPayment } from './supplyPayment'

/** An outgoing bank line with the method its kind stands for. */
export type SupplyBankLine = BankLine & { method: SupplyPayMethod }

/** A card line is a card payment; any other money out to a house is an ACH. The database's `p_fill` reads a kind the same way. */
export function methodOfBankKind(kind: string | null | undefined): SupplyPayMethod {
  return /card/i.test(kind ?? '') ? 'card' : 'ach'
}

/** The feed's rows as outgoing lines: not failed, not cancelled, not a duplicate, not a move between the company's own accounts. */
export function supplyBankLines(rows: ReadonlyArray<BankRow>): SupplyBankLine[] {
  const kindOf = new Map(rows.map((r) => [r.id, r.kind ?? '']))
  return bankLinesFromRows(rows).map((b) => ({ ...b, method: methodOfBankKind(kindOf.get(b.id)) }))
}

const plain = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Does the bank's payee read like this house? As the Tally's bill picker reads it: one name holds the other
 * (`Cedar Fork Plumbing` and `Cedar Fork`). A shared word is not enough: half the houses are "… Supply", and a
 * line to one must never be read as a payment to another. A name under three letters matches nothing.
 */
export function payeeIsHouse(payee: string, houseName: string): boolean {
  const a = plain(payee)
  const b = plain(houseName)
  if (a.length < 3 || b.length < 3) return false
  return a.includes(b) || b.includes(a)
}

export type SupplyBankCandidate = SupplyBankLine & { days: number; isHouse: boolean }

/**
 * The bank lines a payment could be, best first: the same amount to the cent, within three days, not taken by
 * another payment. A line whose payee reads like the house leads; a line to someone else is still offered, since a
 * house's bank name is not always its name here.
 */
export function bankCandidatesFor(payment: Pick<SupplyPayment, 'amount' | 'paid_on'>, houseName: string, bank: ReadonlyArray<SupplyBankLine>, taken: ReadonlySet<string>): SupplyBankCandidate[] {
  const want = toCents(Number(payment.amount))
  if (want <= 0 || !payment.paid_on) return []
  return bank
    .filter((b) => !taken.has(b.id) && toCents(b.amount) === want && daysApart(b.ymd, payment.paid_on) <= BANK_MATCH_DAYS)
    .map((b) => ({ ...b, days: daysApart(b.ymd, payment.paid_on), isHouse: payeeIsHouse(b.payee, houseName) }))
    .sort((a, b) => Number(b.isHouse) - Number(a.isHouse) || a.days - b.days || a.ymd.localeCompare(b.ymd) || a.id.localeCompare(b.id))
}

/** `11/12 · PECAN SUPPLY · $5,000.00`: a bank line in a list. */
export function supplyBankLineWords(b: Pick<BankLine, 'ymd' | 'payee' | 'amount'>, dayWords: (ymd: string) => string): string {
  return [b.ymd ? dayWords(b.ymd) : 'no day', b.payee || 'no payee named', usd(b.amount)].join(' · ')
}

export type UnclaimedHouseLine = { line: SupplyBankLine; houseId: string; houseName: string }

/**
 * Bank lines to a supply house that no payment claims, newest first: the other direction of the match.
 *
 * A line counts when its payee reads like one house's name, it posted on or after `fromYmd` (the day payments
 * became rows: every older line is a bill's payment "from before"), no payment is matched to it, and the Tally has
 * not already said what it was (a counter purchase put on a job, or tied to its own bill).
 */
export function unclaimedHouseLines(bank: ReadonlyArray<SupplyBankLine>, houses: ReadonlyArray<{ id: string; name: string }>, claimed: ReadonlySet<string>, settledElsewhere: ReadonlySet<string>, fromYmd: string): UnclaimedHouseLine[] {
  const out: UnclaimedHouseLine[] = []
  for (const line of bank) {
    if (!line.ymd || line.ymd < fromYmd || claimed.has(line.id) || settledElsewhere.has(line.id)) continue
    // The longest house name that fits wins, so `Pecan Supply North` is not read as `Pecan Supply`.
    const house = houses.filter((h) => payeeIsHouse(line.payee, h.name)).sort((a, b) => b.name.length - a.name.length)[0]
    if (house) out.push({ line, houseId: house.id, houseName: house.name })
  }
  return out.sort((a, b) => b.line.ymd.localeCompare(a.line.ymd) || a.line.id.localeCompare(b.line.id))
}

/** `2 bank lines to supply houses have no payment recorded` · `1 bank line to a supply house has no payment recorded` · '' at none. */
export function unclaimedHeading(count: number): string {
  if (count <= 0) return ''
  return count === 1 ? '1 bank line to a supply house has no payment recorded' : `${count} bank lines to supply houses have no payment recorded`
}

/** The day payments became rows (v2.7450). A bank line older than this paid a bill that carries a payment "from before". */
export const SUPPLY_BANK_FROM_YMD = '2026-11-16'
