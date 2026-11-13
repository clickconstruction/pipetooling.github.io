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
 * and by the sum.
 *
 * What the papers themselves taught the sums (PR 1c, v2.7103, from the measure of every bill on file):
 *
 *   * a price rounded on the paper. A house that sells pipe by the stick prints a price a foot to three places, so
 *     the quantity times the printed price misses the extension by a few cents. A line holds when some price that
 *     rounds to the printed one gives the extension (`roundingAllowCents`), on a paper that prints three places or more;
 *   * a pack priced by the piece. The quantity is boxes and the price is for one piece, so the extension is the
 *     arithmetic times a whole number, on a line whose unit is a pack (`packFactorOf`, kept for the crosswalk's unit factor);
 *   * a charge outside the subtotal. A shipping row printed under the subtotal and read as a line: the lines pass the
 *     subtotal by exactly that charge, and the total takes it back in (`outsideChargeCents`);
 *   * a line that takes money off. A rebate or a credit among an invoice's parts is negative. The reader keeps the
 *     sign since v2.7103; a line read before it is turned when the subtotal says so (`settlePaper`);
 *   * a line ordered and not shipped prints no quantity shipped and no extension, and is not held to the quantity
 *     ordered; a price of zero beside a printed extension is no price.
 *
 * Pure; the sweep turns the reader's answer (`billRead.ts`) into a `PaperRead` with
 * `paperFromBillRead` and calls `checkPaper`; nothing here reads a table. It lives beside the functions since PR 2
 * (v2.6882), so `bill-lines-sweep` and the app hold one definition: `src/lib/materials/lines/paperChecks.ts`
 * re-exports it, the way `bills/billRead.ts` re-exports the reader.
 */
import type { BillRead } from './billRead.ts'

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

export type CheckState = 'adds_up' | 'off' | 'accepted'

/** The check's rule sets, counted. A paper held off under older rules is due one more check (2: PR 1c, v2.7103). */
export const CHECK_RULES = 2

/**
 * Whether a paper's lines count as purchases: the view `supply_purchase_lines`'s rule in TypeScript (v2.6824). An invoice
 * or credit, still owned by a bill on file (a deleted bill leaves its paper with no `invoice_id`, and the paper then
 * drops out of every count), whose lines add up or a person accepted. A ship ticket, a quote, an acknowledgement never
 * count; an `off` paper waits for a person.
 */
export function countsAsPurchase(paper: { kind: PaperKind; checkState: CheckState; invoiceId: string | null }): boolean {
  return PURCHASE_KINDS.has(paper.kind) && paper.invoiceId != null && (paper.checkState === 'adds_up' || paper.checkState === 'accepted')
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
  /** The lines whose quantity is packs and whose price is for one piece, with how many pieces a pack holds. */
  packs: { lineNo: number; factor: number }[]
  /** The charge lines the printed subtotal leaves out, in cents; 0 when every line is inside it. */
  outsideCents: number
  /** What the check allowed, in words, for the Look window: a pack priced by the piece, a charge outside the subtotal. */
  notes: string[]
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

/** The decimal places a number shows, four at most: 2.159 → 3, 1.24 → 2, 40 → 0. */
function placesOf(n: number): number {
  const s = String(Math.round(Math.abs(n) * 10000) / 10000)
  const dot = s.indexOf('.')
  return dot < 0 ? 0 : Math.min(4, s.length - dot - 1)
}

/**
 * The places a paper prints its prices to: the most any line shows. A column prints one width, and a price that ends
 * in a zero (1.240) reads back as 1.24, so the paper's widest price says what every line was rounded to.
 */
export function pricePlaces(lines: readonly Pick<PaperLine, 'unitPrice'>[]): number {
  return lines.reduce((most, l) => (l.unitPrice == null ? most : Math.max(most, placesOf(l.unitPrice))), 0)
}

/**
 * What the rounding of a printed price allows a line's extension to miss by, in cents: the quantity times half a
 * unit of the price's last printed place. 200 feet at a price printed to three places may miss by 10 cents. Nothing
 * on a paper that prints its prices to the cent: there a miss is a misread, and a cheap part's quantity would slip by.
 */
export function roundingAllowCents(qty: number, places: number, pricingUnit: PricingUnit): number {
  if (places < 3) return 0
  return (Math.abs(qty) * 50 * 10 ** -places) / PRICING_UNIT_DIVISOR[pricingUnit]
}

/** The units that say the quantity is packs: a box, a case, a pack, a carton, a bag, a roll, a bundle, a sleeve. */
const PACK_UNITS: ReadonlySet<string> = new Set(['BX', 'BOX', 'CS', 'CASE', 'PK', 'PKG', 'PACK', 'CT', 'CTN', 'CARTON', 'BG', 'BAG', 'RL', 'ROLL', 'BDL', 'BUNDLE', 'SLV', 'SLEEVE'])

/** The most pieces a pack is taken to hold. */
const PACK_MAX = 10_000

export type LineArithmetic =
  /** Nothing to hold the line to: no quantity or no price was read, or the line was ordered and not shipped. */
  | { verdict: 'not_checked' }
  | { verdict: 'holds'; expectedCents: number; packFactor: number | null }
  | { verdict: 'fails'; expectedCents: number }

/**
 * One line's own arithmetic. `places` is the paper's price width (`pricePlaces`). The sizes are compared, so a rebate
 * printed as 1 × 40.00 = −40.00 holds; the sums hold the sign.
 */
export function lineArithmetic(line: Pick<PaperLine, 'unit' | 'qtyShipped' | 'qtyOrdered' | 'unitPrice' | 'pricingUnit' | 'extendedCents'>, places: number): LineArithmetic {
  if (line.extendedCents == null) return { verdict: 'not_checked' }
  // Ordered and not shipped: no quantity shipped is printed and nothing is charged, so the quantity ordered is not the line's.
  if (line.qtyShipped == null && line.extendedCents === 0) return { verdict: 'not_checked' }
  // A price of zero beside a printed extension is a price the reader did not find, not a price.
  if (line.unitPrice === 0 && line.extendedCents !== 0) return { verdict: 'not_checked' }
  const qty = line.qtyShipped ?? line.qtyOrdered
  if (qty == null || line.unitPrice == null) return { verdict: 'not_checked' }
  const exact = Math.abs((qty * line.unitPrice * 100) / PRICING_UNIT_DIVISOR[line.pricingUnit])
  const expectedCents = expectedExtensionCents(line) ?? 0
  const printed = Math.abs(line.extendedCents)
  if (Math.abs(Math.abs(expectedCents) - printed) <= CENT || Math.abs(exact - printed) <= CENT + roundingAllowCents(qty, places, line.pricingUnit)) return { verdict: 'holds', expectedCents, packFactor: null }
  if (exact > 0 && PACK_UNITS.has(line.unit.trim().toUpperCase())) {
    const factor = Math.round(printed / exact)
    if (factor >= 2 && factor <= PACK_MAX && Math.abs(exact * factor - printed) <= CENT + roundingAllowCents(qty * factor, places, line.pricingUnit)) {
      return { verdict: 'holds', expectedCents, packFactor: factor }
    }
  }
  return { verdict: 'fails', expectedCents }
}

/**
 * How many pieces one of a line's packs holds, when its quantity is packs and its price is for one piece: a box of 50
 * at 2.159 each, extended 107.95. Null for a line priced the way it is counted. Kept for the crosswalk's unit factor.
 */
export function packFactorOf(line: Pick<PaperLine, 'unit' | 'qtyShipped' | 'qtyOrdered' | 'unitPrice' | 'pricingUnit' | 'extendedCents'>, places: number): number | null {
  const a = lineArithmetic(line, places)
  return a.verdict === 'holds' ? a.packFactor : null
}

/**
 * The charge lines the printed subtotal leaves out, in cents. A shipping row printed under the subtotal and read as a
 * line makes the lines pass the subtotal by exactly that charge. It counts as outside only when both sums say so: the
 * lines less the charge meet the subtotal, and the subtotal with tax, freight and the charge meets the total. One
 * charge line is tried first, then every charge together. 0 when the lines meet the subtotal or no charge explains the gap.
 */
export function outsideChargeCents(paper: Pick<PaperRead, 'lines' | 'subtotalCents' | 'taxCents' | 'freightCents' | 'totalCents'>): number {
  if (paper.subtotalCents == null || paper.totalCents == null) return 0
  const counted = paper.lines.filter((l) => l.lineKind !== 'component')
  const off = counted.reduce((s, l) => s + (l.extendedCents ?? 0), 0) - paper.subtotalCents
  if (Math.abs(off) <= CENT) return 0
  const charges = counted.filter((l) => l.lineKind === 'charge' && l.extendedCents != null).map((l) => l.extendedCents!)
  const all = charges.reduce((s, c) => s + c, 0)
  const outside = charges.find((c) => Math.abs(c - off) <= CENT) ?? (charges.length > 1 && Math.abs(all - off) <= CENT ? all : null)
  if (outside == null || outside === 0) return 0
  const offTotal = paper.subtotalCents + (paper.taxCents ?? 0) + (paper.freightCents ?? 0) + outside - paper.totalCents
  return Math.abs(offTotal) <= CENT ? outside : 0
}

/** The words that say a line takes money off the paper it is on. */
const CREDIT_WORDS = /\b(REBATE|CREDIT|CR|DISCOUNT|DISC|RETURN|RETURNED|ALLOWANCE|REFUND)\b/i

/**
 * A paper as its own sums say it stands, before it is checked or written. Four things a read can carry that the
 * paper does not mean, each turned only on the paper's own evidence; `changed` names the lines it touched.
 *
 *   * A price of zero beside a printed extension: no price was read, so the price is empty and never a $0.00 purchase.
 *   * No quantity shipped and no extension on a line that was ordered: nothing shipped, so the quantity shipped is 0
 *     and the purchase view never counts the quantity ordered as bought.
 *   * Every extension negative: the paper prints its direction on its lines (a credit memo that prints −12.40). The
 *     kind carries the direction here, so the lines are positive.
 *   * One line that takes money off, read as a positive: the lines pass the subtotal by exactly twice that line and
 *     its words say rebate, credit, discount or return. It is turned negative. Two lines that fit are left for a person.
 */
export function settlePaper(paper: PaperRead): { paper: PaperRead; changed: number[] } {
  const changed = new Set<number>()
  let lines = paper.lines.map((l) => {
    if (l.lineKind === 'component') return l
    let next = l
    if (next.unitPrice === 0 && next.extendedCents != null && next.extendedCents !== 0) next = { ...next, unitPrice: null }
    if (next.qtyShipped == null && next.extendedCents === 0 && (next.qtyOrdered ?? 0) > 0) next = { ...next, qtyShipped: 0 }
    if (next !== l) changed.add(l.lineNo)
    return next
  })
  const counted = lines.filter((l) => l.lineKind !== 'component' && l.extendedCents != null && l.extendedCents !== 0)
  if (counted.length > 0 && counted.every((l) => l.extendedCents! < 0)) {
    lines = lines.map((l) => {
      if (l.lineKind === 'component' || l.extendedCents == null || l.extendedCents === 0) return l
      changed.add(l.lineNo)
      return { ...l, extendedCents: -l.extendedCents }
    })
  } else {
    const sum = lines.reduce((s, l) => s + (l.lineKind === 'component' ? 0 : (l.extendedCents ?? 0)), 0)
    const target = paper.subtotalCents ?? (paper.totalCents == null ? null : paper.totalCents - (paper.taxCents ?? 0) - (paper.freightCents ?? 0))
    const off = target == null ? 0 : sum - target
    if (off > CENT) {
      const fits = lines.filter((l) => l.lineKind !== 'component' && l.extendedCents != null && l.extendedCents > 0 && Math.abs(2 * l.extendedCents - off) <= CENT && CREDIT_WORDS.test(l.description))
      if (fits.length === 1) {
        const turn = fits[0]!
        lines = lines.map((l) => (l === turn ? { ...l, extendedCents: -l.extendedCents! } : l))
        changed.add(turn.lineNo)
      }
    }
  }
  return { paper: changed.size ? { ...paper, lines } : paper, changed: [...changed].sort((a, b) => a - b) }
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
 * one quantity the paper prints, the unit price whole (the cents figure when the answer is an older one), then
 * settled by the paper's own sums (`settlePaper`), so the rows written are the rows checked.
 */
export function paperFromBillRead(read: BillRead): PaperRead {
  return settlePaper(paperOfBillRead(read)).paper
}

function paperOfBillRead(read: BillRead): PaperRead {
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
  const packs: { lineNo: number; factor: number }[] = []
  const notes: string[] = []
  const text = ctx.text?.trim() ?? ''
  const places = pricePlaces(counted)

  for (const line of counted) {
    const arithmetic = lineArithmetic(line, places)
    if (arithmetic.verdict === 'fails') {
      lineProblems.push({
        kind: 'arithmetic',
        lineNo: line.lineNo,
        expectedCents: arithmetic.expectedCents,
        extendedCents: line.extendedCents!,
        words: `Line ${line.lineNo}: the quantity times the price is ${moneyWords(arithmetic.expectedCents)}, the paper prints ${moneyWords(line.extendedCents!)}.`,
      })
    } else if (arithmetic.verdict === 'holds' && arithmetic.packFactor != null) {
      packs.push({ lineNo: line.lineNo, factor: arithmetic.packFactor })
      notes.push(`Line ${line.lineNo} is priced by the piece, ${arithmetic.packFactor} to a pack.`)
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
  // A charge the printed subtotal leaves out is taken off the lines' side and put on the total's.
  const outsideCents = outsideChargeCents(paper)
  if (outsideCents !== 0) notes.push(`A charge of ${moneyWords(outsideCents)} is printed outside the subtotal.`)
  if (paper.subtotalCents != null) {
    const off = sumCents - outsideCents - paper.subtotalCents
    if (Math.abs(off) > CENT) paperProblems.push({ kind: 'lines_vs_subtotal', offCents: off, words: `The lines are ${shortOrOver(off)} the subtotal.` })
    if (paper.totalCents != null) {
      const offTotal = paper.subtotalCents + tax + freight + outsideCents - paper.totalCents
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
  return { state, lineCount: counted.length, sumCents, lineProblems, paperProblems, packs, outsideCents, notes, words }
}
