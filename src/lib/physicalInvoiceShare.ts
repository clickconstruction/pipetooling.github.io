/**
 * A progress bill's lines beside the contract's (punch list #217, *Show it, don't say it*, outside-1 — a prototype).
 * When a bill is part of a job, the paper spreads the bill over the job's priced lines by their value and prints each
 * at a count of one and a figure nobody priced (`buildScaledFixtureLineDrafts`). This kernel pairs those scaled lines
 * with the lines they came from, so the paper can say once what share of the contract the bill is and carry, on each
 * line, the contract line with its count beside this bill's share of it. Pure; `resolvePhysicalInvoiceLinePresentation`
 * fills it only when it scaled, and the Stripe line's tail (`stripeShareTail`) is the same words for the build step.
 */
import type { PhysicalInvoiceServiceLine } from './physicalInvoiceLineItems'

export interface ProgressBillShareRow {
  description: string
  /** The contract line's count and unit price: 24 × $1,180. */
  qty: number
  unitPrice: number
  /** The contract line's amount, qty × unit. */
  contract: number
  /** This bill's share of it. */
  share: number
}

export interface ProgressBillShare {
  /** This bill as a share of the contract lines, a whole percent, never under 1. */
  pct: number
  /** The contract lines added up: what the job priced. */
  contract: number
  /** This bill's service lines added up. */
  bill: number
  rows: ProgressBillShareRow[]
}

/** This bill's share of the contract, a whole percent, never under 1 while there is a bill. */
export function sharePct(bill: number, contract: number): number {
  if (contract <= 0 || bill <= 0) return 0
  return Math.max(1, Math.round((100 * bill) / contract))
}

/**
 * The share, from the contract lines (`buildBillableServiceLinesFromFixtures`) and the scaled lines the bill prints,
 * paired in order by their words. Null when nothing pairs: a line the scaling dropped shifts the pairing on, a line
 * that is not in the contract ends it.
 */
export function progressBillShare(contractLines: readonly PhysicalInvoiceServiceLine[], scaledLines: readonly PhysicalInvoiceServiceLine[]): ProgressBillShare | null {
  const rows: ProgressBillShareRow[] = []
  let j = 0
  for (const s of scaledLines) {
    while (j < contractLines.length && contractLines[j]!.description !== s.description) j++
    const c = contractLines[j]
    if (!c) return null
    rows.push({ description: c.description, qty: c.qty, unitPrice: c.unitPrice, contract: c.amount, share: s.amount })
    j++
  }
  const contract = Math.round(contractLines.reduce((t, l) => t + l.amount, 0) * 100) / 100
  const bill = Math.round(scaledLines.reduce((t, l) => t + l.amount, 0) * 100) / 100
  if (rows.length === 0 || contract <= 0 || bill <= 0) return null
  return { pct: sharePct(bill, contract), contract, bill, rows }
}

/** "$1,180" when whole, "$1,180.50" when not: the figures a customer compares against the contract. */
export function shareMoney(n: number): string {
  const whole = Math.abs(n - Math.round(n)) < 0.005
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`
}

/** The one line at the top: "This bill: $18,200, 32% of the $56,343 contract." */
export function shareHeadline(share: ProgressBillShare): string {
  return `This bill: ${shareMoney(share.bill)}, ${share.pct}% of the ${shareMoney(share.contract)} contract.`
}

/** The line under it, once: "Each line shows the contract line and this bill's share of it." */
export const SHARE_EXPLAINER = 'Each line shows the contract line and this bill’s share of it.'

/** The contract line with its count: "24 × $1,180 = $28,320"; a single at its price reads "$9,820". */
export function contractLineWords(row: ProgressBillShareRow): string {
  return row.qty === 1 ? shareMoney(row.contract) : `${row.qty} × ${shareMoney(row.unitPrice)} = ${shareMoney(row.contract)}`
}

/** The two column heads beside the line: "In the contract" and "This bill · 32%". */
export function shareColumnHeads(share: ProgressBillShare): { contract: string; bill: string } {
  return { contract: 'In the contract', bill: `This bill · ${share.pct}%` }
}

/** The sum row: "Contract · this bill", the two figures. */
export const SHARE_SUM_LABEL = 'Contract · this bill'

/** The Stripe line's tail (the build step): "Water closet, wall-hung · 32% of $28,320". */
export function stripeShareTail(pct: number, contract: number): string {
  return ` · ${pct}% of ${shareMoney(contract)}`
}
