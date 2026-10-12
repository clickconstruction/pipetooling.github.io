/**
 * Messages, cut 8 (the portals): the six numbers of a customer's statement, lifted from the Messages prototype (branch
 * spike/gc-mode, `to-dos/gc-mode/messages/prototype.html` v1.178: the statement inside `portalMoneyHtml`, v1.163).
 * The contract, the changes they signed, the revised sum they make, what we billed, what they paid, and the balance
 * to finish. The sum is the contract plus the signed changes and nothing else. The header's percent and History's
 * *To finish* read the same numbers (`moneyStory.ts`), so the page never shows two answers.
 *
 * The balance to finish is the revised sum less what they paid, the prototype's reading: what is left for them to pay.
 * Retainage is not counted apart; it stays inside billed and not yet paid. Pure.
 */

import { money, say, signedMoney, type PortalLang, type TypedLine } from './pageWords'

/**
 * A change order on the job as their page reads it: sent and waiting on them (`open`, main's `PortalGcChangeOrder`), or
 * signed. The same list feeds Your move, Money, Papers and the readiness list.
 */
export interface CustomerChange {
  id: string
  number: number
  /** What it is, in the customer's words. */
  description: TypedLine
  /** What it adds to the sum; below zero, a credit. */
  price: number
  /** The working days it adds. */
  days: number
  state: 'signed' | 'open'
  signedOn?: string | null
}

/** The change orders still waiting on them, lowest number first. */
export function openChanges(changes: CustomerChange[]): CustomerChange[] {
  return changes.filter((c) => c.state === 'open').sort((p, q) => p.number - q.number)
}

/** The change orders they signed, lowest number first. */
export function signedChanges(changes: CustomerChange[]): CustomerChange[] {
  return changes.filter((c) => c.state === 'signed').sort((p, q) => p.number - q.number)
}

export interface MoneyLinesIn {
  /** The contract sum on the job. */
  contract: number
  /** The job's change orders; only the signed ones count. */
  changes: CustomerChange[]
  /** Every pay application sent, in dollars. */
  billed: number
  /** Every payment from them that cleared, from the ledger. */
  paid: number
}

export interface MoneyLines {
  contract: number
  changesCount: number
  changes: number
  revised: number
  billed: number
  paid: number
  balance: number
}

export function moneyLines(input: MoneyLinesIn): MoneyLines {
  const signed = signedChanges(input.changes)
  const changes = signed.reduce((a, c) => a + c.price, 0)
  const revised = input.contract + changes
  return {
    contract: input.contract,
    changesCount: signed.length,
    changes,
    revised,
    billed: input.billed,
    paid: input.paid,
    balance: revised - input.paid,
  }
}

/** The share of the revised sum they have paid, a whole percent: the header's *34% built*. */
export function paidPct(lines: MoneyLines): number {
  return lines.revised > 0 ? Math.round((100 * lines.paid) / lines.revised) : 0
}

export interface StatementRow {
  label: string
  amount: string
  /** The count beside *Changes signed*. */
  count?: number
  /** A sum line, drawn with a rule above. */
  sum?: boolean
}

/** The statement's six lines for the bookkeeper. Folded, the page shows the first two. */
export function statementRows(lang: PortalLang, lines: MoneyLines): StatementRow[] {
  return [
    { label: say(lang, 'lineContract'), amount: money(lines.contract) },
    { label: say(lang, 'lineChanges'), amount: signedMoney(lines.changes), count: lines.changesCount },
    { label: say(lang, 'lineRevised'), amount: money(lines.revised), sum: true },
    { label: say(lang, 'lineBilled'), amount: money(lines.billed) },
    { label: say(lang, 'linePaid'), amount: money(lines.paid) },
    { label: say(lang, 'lineBalance'), amount: money(lines.balance), sum: true },
  ]
}
