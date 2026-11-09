/**
 * Supply house bill lines as rows (punch list #298 PR 1, v2.6817): whether a paper's lines add up. A paper read from a
 * PDF counts as a purchase only when every sum holds; otherwise its lines are kept and wait for a person. The sums,
 * in cents:
 *
 *   1. each line: quantity shipped × unit price ÷ pricing unit = its extension, within a cent;
 *   2. the extensions sum to the printed subtotal;
 *   3. subtotal + tax + freight = the printed total;
 *   4. for a bill on file, the printed total = the row's amount, which a person typed from the paper;
 *   5. where the PDF has a text layer, every house part code the reader returned is found in that text, since the
 *      four sums protect the money and not the code, and the code is the crosswalk's key.
 *
 * A kit component carries no price of its own (its money is on the line above), so it is skipped by the arithmetic
 * and by the sum. Pure; the sweep turns the reader's answer (`supabase/functions/_shared/billRead.ts`) into a
 * `PaperRead` with `paperFromBillRead` and calls `checkPaper`; nothing here reads a table.
 */
import type { BillRead } from '../../../../supabase/functions/_shared/billRead'

export type PricingUnit = 'each' | 'per_hundred' | 'per_thousand'

/** What the printed unit price is for: one, a hundred, a thousand. */
export const PRICING_UNIT_DIVISOR: Record<PricingUnit, number> = { each: 1, per_hundred: 100, per_thousand: 1000 }

export type LineKind = 'part' | 'charge' | 'component'

export type PaperKind = 'invoice' | 'credit' | 'ship_ticket' | 'acknowledgement' | 'quote' | 'bid' | 'statement' | 'other'

/** The kinds whose lines count as purchases; a credit counts negative. */
export const PURCHASE_KINDS: ReadonlySet<PaperKind> = new Set<PaperKind>(['invoice', 'credit'])

export function purchaseSign(kind: PaperKind): 1 | -1 | 0 {
  if (kind === 'credit') return -1
  return kind === 'invoice' ? 1 : 0
}

export interface PaperLine {
  lineNo: number
  lineKind: LineKind
  houseCode: string
  mfrNumber: string
  description: string
  unit: string
  qtyOrdered: number | null
  qtyShipped: number | null
  qtyBackordered: number | null
  /** The unit price as printed, in dollars, to four places. */
  unitPrice: number | null
  pricingUnit: PricingUnit
  extendedCents: number | null
}

export interface PaperRead {
  kind: PaperKind
  lines: PaperLine[]
  subtotalCents: number | null
  taxCents: number | null
  freightCents: number | null
  totalCents: number | null
}

export interface CheckContext {
  /** The bill's row amount, in cents, when the paper is a bill on file. A credit's row may be positive; its size is compared. */
  rowAmountCents?: number | null
  /** The PDF's own text layer, when it has one. Empty or missing: the code check does not run. */
  text?: string | null
}

export type LineProblem =
  | { kind: 'arithmetic'; lineNo: number; expectedCents: number; extendedCents: number; words: string }
  | { kind: 'code_not_in_text'; lineNo: number; houseCode: string; words: string }

export type PaperProblem =
  | { kind: 'no_lines'; words: string }
  | { kind: 'no_total'; words: string }
  | { kind: 'lines_vs_subtotal'; offCents: number; words: string }
  | { kind: 'subtotal_vs_total'; offCents: number; words: string }
  | { kind: 'total_vs_row'; offCents: number; words: string }

export interface PaperCheck {
  state: 'adds_up' | 'off'
  /** The lines that count: every line but a component. */
  lineCount: number
  /** The counted lines' extensions, in cents. */
  sumCents: number
  lineProblems: LineProblem[]
  paperProblems: PaperProblem[]
  /** The row's one line: *42 lines · adds up*, or *41 lines · $12.40 short of the subtotal*. */
  words: string
}

const CENT = 1

/** Dollars from cents, the way the app prints money: $1,284.10, −$12.40. */
export function moneyWords(cents: number): string {
  const sign = cents < 0 ? '−' : ''
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  return `${sign}$${whole.toLocaleString('en-US')}.${frac}`
}

/** A line's extension as the paper's arithmetic gives it: quantity shipped (ordered when none) × price ÷ unit, in cents. */
export function expectedExtensionCents(line: Pick<PaperLine, 'qtyShipped' | 'qtyOrdered' | 'unitPrice' | 'pricingUnit'>): number | null {
  const qty = line.qtyShipped ?? line.qtyOrdered
  if (qty == null || line.unitPrice == null) return null
  return Math.round((qty * line.unitPrice * 100) / PRICING_UNIT_DIVISOR[line.pricingUnit])
}

/** A code or a text, folded for the contains check: upper case, no whitespace. */
const fold = (s: string): string => s.toUpperCase().replace(/\s+/g, '')
/** The same with the dashes gone too, so K-26077-0 matches K26077-0 and a code printed across a hyphenation. */
const foldHard = (s: string): string => fold(s).replace(/-/g, '')

/** Whether a house code is found in the paper's own text, folded both ways. A code under three characters is not checked. */
export function codeInText(houseCode: string, text: string): boolean | null {
  const code = houseCode.trim()
  if (code.length < 3) return null
  const t = fold(text)
  if (t.includes(fold(code))) return true
  return foldHard(text).includes(foldHard(code))
}

/**
 * The reader's answer as a paper to check: the lines numbered as printed, the quantity shipped falling back to the
 * one quantity the paper prints, the unit price whole (the cents figure when the answer is an older one).
 */
export function paperFromBillRead(read: BillRead): PaperRead {
  return {
    kind: read.kind,
    lines: read.lines.map((l, i) => ({
      lineNo: i + 1,
      lineKind: l.lineKind ?? 'part',
      houseCode: l.houseCode ?? '',
      mfrNumber: l.mfrNumber ?? '',
      description: l.description,
      unit: l.unit ?? '',
      qtyOrdered: l.qtyOrdered ?? null,
      qtyShipped: l.qtyShipped ?? l.quantity,
      qtyBackordered: l.qtyBackordered ?? null,
      unitPrice: l.unitPrice ?? (l.unitPriceCents == null ? null : l.unitPriceCents / 100),
      pricingUnit: l.pricingUnit ?? 'each',
      extendedCents: l.extendedCents,
    })),
    subtotalCents: read.subtotalCents,
    taxCents: read.taxCents,
    freightCents: read.freightCents ?? null,
    totalCents: read.totalCents,
  }
}

const shortOrOver = (offCents: number): string => (offCents < 0 ? `${moneyWords(-offCents)} short of` : `${moneyWords(offCents)} over`)

/** Every check at once. `state` is adds_up only when no problem was found. */
export function checkPaper(paper: PaperRead, ctx: CheckContext = {}): PaperCheck {
  const counted = paper.lines.filter((l) => l.lineKind !== 'component')
  const lineProblems: LineProblem[] = []
  const paperProblems: PaperProblem[] = []
  const text = ctx.text?.trim() ?? ''

  for (const line of counted) {
    const expected = expectedExtensionCents(line)
    if (expected != null && line.extendedCents != null && Math.abs(expected - line.extendedCents) > CENT) {
      lineProblems.push({
        kind: 'arithmetic',
        lineNo: line.lineNo,
        expectedCents: expected,
        extendedCents: line.extendedCents,
        words: `Line ${line.lineNo}: the quantity times the price is ${moneyWords(expected)}, the paper prints ${moneyWords(line.extendedCents)}.`,
      })
    }
    if (text && codeInText(line.houseCode, text) === false) {
      lineProblems.push({
        kind: 'code_not_in_text',
        lineNo: line.lineNo,
        houseCode: line.houseCode,
        words: `Line ${line.lineNo}: the part code ${line.houseCode} is not on the paper as read. The reader may have misread it.`,
      })
    }
  }

  const sumCents = counted.reduce((s, l) => s + (l.extendedCents ?? 0), 0)
  if (counted.length === 0) paperProblems.push({ kind: 'no_lines', words: 'No line was read.' })

  const tax = paper.taxCents ?? 0
  const freight = paper.freightCents ?? 0
  if (paper.subtotalCents != null) {
    const off = sumCents - paper.subtotalCents
    if (Math.abs(off) > CENT) paperProblems.push({ kind: 'lines_vs_subtotal', offCents: off, words: `The lines are ${shortOrOver(off)} the subtotal.` })
    if (paper.totalCents != null) {
      const offTotal = paper.subtotalCents + tax + freight - paper.totalCents
      if (Math.abs(offTotal) > CENT) paperProblems.push({ kind: 'subtotal_vs_total', offCents: offTotal, words: `The subtotal with tax and freight is ${shortOrOver(offTotal)} the total.` })
    }
  } else if (paper.totalCents != null) {
    // No subtotal printed: the lines with the tax and freight must meet the total on their own.
    const off = sumCents + tax + freight - paper.totalCents
    if (Math.abs(off) > CENT) paperProblems.push({ kind: 'lines_vs_subtotal', offCents: off, words: `The lines with tax and freight are ${shortOrOver(off)} the total.` })
  }
  if (paper.totalCents == null && counted.length > 0) paperProblems.push({ kind: 'no_total', words: 'No total was read.' })

  if (paper.totalCents != null && ctx.rowAmountCents != null) {
    const off = paper.totalCents - Math.abs(ctx.rowAmountCents)
    if (Math.abs(off) > CENT) paperProblems.push({ kind: 'total_vs_row', offCents: off, words: `The printed total is ${shortOrOver(off)} the amount on the bill's row.` })
  }

  const state: PaperCheck['state'] = lineProblems.length === 0 && paperProblems.length === 0 ? 'adds_up' : 'off'
  const lineWords = `${counted.length} ${counted.length === 1 ? 'line' : 'lines'}`
  const first = paperProblems[0] ?? lineProblems[0]
  const words = state === 'adds_up' ? `${lineWords} · adds up` : `${lineWords} · ${first ? first.words.replace(/\.$/, '') : 'off'}`
  return { state, lineCount: counted.length, sumCents, lineProblems, paperProblems, words }
}
