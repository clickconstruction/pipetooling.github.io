/**
 * Supply-house bill capture (punch list #179 PR 2, v2.6088): the checks the form shows as sentences under a field,
 * and Save still works. The lines add to the printed total with the tax, to the cent, or they do not; the number is
 * already on this house's list; the paper is a statement listing several invoices; the letterhead is not this house.
 * None of them holds the form. Pure; the words are `billWords.ts`'s.
 */
import type { PairableSupplyRow } from '../supplyHouseInvoiceForm'
import { houseMatch, type HouseMatch } from './billMatch'
import type { BillRead } from './billRead'

export type SumCheck =
  /** No lines, or no total: nothing to add up. */
  | { kind: 'none' }
  | { kind: 'right'; lineCount: number; sumCents: number; totalCents: number; withTax: boolean }
  | { kind: 'off'; lineCount: number; sumCents: number; totalCents: number; withTax: boolean }

/**
 * The lines against the total. The lines plus the tax must meet the total to the cent; when the paper prints no tax,
 * or prints the tax inside the lines, the lines alone meeting it is right too. The reader never guesses a total.
 */
export function sumCheck(read: Pick<BillRead, 'lines' | 'taxCents' | 'totalCents'>): SumCheck {
  const priced = read.lines.filter((l) => l.extendedCents != null)
  if (priced.length === 0 || read.totalCents == null) return { kind: 'none' }
  const linesCents = priced.reduce((s, l) => s + (l.extendedCents ?? 0), 0)
  const tax = read.taxCents ?? 0
  if (linesCents + tax === read.totalCents) return { kind: 'right', lineCount: priced.length, sumCents: linesCents + tax, totalCents: read.totalCents, withTax: tax > 0 }
  if (linesCents === read.totalCents) return { kind: 'right', lineCount: priced.length, sumCents: linesCents, totalCents: read.totalCents, withTax: false }
  return { kind: 'off', lineCount: priced.length, sumCents: linesCents + tax, totalCents: read.totalCents, withTax: tax > 0 }
}

export interface DuplicateHit {
  invoiceId: string
  number: string
  dateYmd: string
  amountCents: number
}

const normNumber = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** A row on this house's list with the same number, ignoring case, spaces and dashes. Null when none. */
export function duplicateCheck(number: string, rows: ReadonlyArray<PairableSupplyRow & { invoice_date: string }>, exceptId: string | null = null): DuplicateHit | null {
  const want = normNumber(number)
  if (!want) return null
  const hit = rows.find((r) => r.id !== exceptId && normNumber(r.invoice_number ?? '') === want)
  return hit ? { invoiceId: hit.id, number: (hit.invoice_number ?? '').trim(), dateYmd: hit.invoice_date, amountCents: Math.round(Math.abs(hit.amount) * 100) } : null
}

/** A statement, several invoices in one PDF: the numbers it lists. Null for a single bill. */
export function statementCheck(read: Pick<BillRead, 'kind' | 'statementNumbers'>): { numbers: string[] } | null {
  if (read.kind === 'statement') return { numbers: read.statementNumbers }
  if (read.statementNumbers.length > 1) return { numbers: read.statementNumbers }
  return null
}

export interface BillChecks {
  sum: SumCheck
  duplicate: DuplicateHit | null
  statement: { numbers: string[] } | null
  /** The letterhead against the house the form is open on. */
  house: HouseMatch
}

/** Every check at once, as the row keeps them at Save. */
export function billChecks(read: BillRead, ctx: { houseName: string; rows: ReadonlyArray<PairableSupplyRow & { invoice_date: string }>; editingId?: string | null }): BillChecks {
  return {
    sum: sumCheck(read),
    duplicate: duplicateCheck(read.number, ctx.rows, ctx.editingId ?? null),
    statement: statementCheck(read),
    house: houseMatch(read.houseName, ctx.houseName),
  }
}

/** How many checks ask for a look: an off sum, a duplicate, a statement, another house. */
export function checksToLook(checks: BillChecks): number {
  return (checks.sum.kind === 'off' ? 1 : 0) + (checks.duplicate ? 1 : 0) + (checks.statement ? 1 : 0) + (checks.house === 'other' ? 1 : 0)
}
