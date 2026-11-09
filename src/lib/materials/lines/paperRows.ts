/**
 * Supply house bill lines, the bill's row and the Look window (punch list #298 PR 1b, v2.6819). Pure: what a bill's
 * row says about its lines, how a paper read from a PDF becomes the rows the office writes, how a person's fix or
 * added line is folded in and checked again, and the words of the Count it as read press. The checks themselves
 * are `paperChecks.ts`; the reads and writes are `paperIo.ts`.
 */
import type { BillRead } from '../bills/billRead'
import { checkPaper, moneyWords, paperFromBillRead, PRICING_UNIT_DIVISOR, type LineKind, type PaperCheck, type PaperKind, type PaperLine, type PaperRead, type PricingUnit } from './paperChecks'

/** A `supply_papers` row as the app reads it, with its lines. */
export interface PaperRow {
  id: string
  invoiceId: string | null
  kind: PaperKind
  number: string
  datedOn: string | null
  orderNumber: string
  poText: string
  filePath: string | null
  driveFileId: string | null
  subtotalCents: number | null
  taxCents: number | null
  freightCents: number | null
  totalCents: number | null
  readBy: string
  readAt: string | null
  checkState: 'adds_up' | 'off' | 'accepted'
  checkNote: string
  acceptedBy: string | null
  acceptedAt: string | null
  lines: PaperLine[]
}

/** What the row's Lines cell says: the tone, the words, and whether Look is offered. */
export type RowLinesWords =
  | { tone: 'ok'; words: string; look: true }
  | { tone: 'off'; words: string; look: true }
  | { tone: 'accepted'; words: string; look: true }
  | { tone: 'none'; words: string; look: false }

const lineWords = (n: number): string => `${n} ${n === 1 ? 'line' : 'lines'}`

/** The counted lines: every line but a component. */
export function countedLines(lines: readonly PaperLine[]): PaperLine[] {
  return lines.filter((l) => l.lineKind !== 'component')
}

/**
 * The row's one line. A paper that adds up: *6 lines · adds up*. One that is off: *5 lines · $12.40 short of the
 * subtotal*. One a person accepted: *5 lines · counted as read by Dana*. No paper: *No lines yet* when the row has a
 * PDF the sweep will read, or *No PDF on this bill* when it has none.
 */
export function rowLinesWords(paper: PaperRow | null, row: { link: string | null; hasFile: boolean }, acceptedByName?: string | null): RowLinesWords {
  if (!paper) {
    if (row.hasFile || (row.link ?? '').trim()) return { tone: 'none', words: 'No lines yet', look: false }
    return { tone: 'none', words: 'No PDF on this bill', look: false }
  }
  const n = countedLines(paper.lines).length
  if (paper.checkState === 'accepted') return { tone: 'accepted', words: `${lineWords(n)} · counted as read${acceptedByName ? ` by ${acceptedByName}` : ''}`, look: true }
  if (paper.checkState === 'adds_up') return { tone: 'ok', words: `${lineWords(n)} · adds up`, look: true }
  const note = paper.checkNote.trim().replace(/\.$/, '')
  return { tone: 'off', words: `${lineWords(n)} · ${note || 'off'}`, look: true }
}

/** The paper's read as the check kernel holds it, from a row. */
export function paperReadOfRow(paper: PaperRow): PaperRead {
  return { kind: paper.kind, lines: paper.lines, subtotalCents: paper.subtotalCents, taxCents: paper.taxCents, freightCents: paper.freightCents, totalCents: paper.totalCents }
}

/** The first problem's words, with the row's line, for the strip at the top of the Look window. */
export function gapWords(check: PaperCheck): { tone: 'ok' | 'off'; title: string; detail: string[] } {
  if (check.state === 'adds_up') {
    return { tone: 'ok', title: `The ${lineWords(check.lineCount)} add up.`, detail: [`They sum to ${moneyWords(check.sumCents)}, and the subtotal, the tax and the total agree with the paper and the bill's row.`] }
  }
  const first = check.paperProblems[0] ?? check.lineProblems[0]
  const detail: string[] = []
  for (const p of check.paperProblems) detail.push(p.words)
  for (const p of check.lineProblems) detail.push(p.words)
  const onlyLines = check.paperProblems.length === 0 && check.lineProblems.length > 0
  const onlySubtotal = check.paperProblems.length === 1 && check.paperProblems[0]!.kind === 'lines_vs_subtotal' && check.lineProblems.length === 0
  const hint = onlySubtotal ? 'Each line\'s own arithmetic holds, so a line is missing or one was read wrong.' : onlyLines ? 'The sums hold; one line\'s own arithmetic does not.' : ''
  return { tone: 'off', title: first ? first.words : 'The lines do not add up.', detail: hint ? [...detail.slice(1), hint] : detail.slice(1) }
}

/** A line as the Look window edits it: every number as typed text, so a half-typed price never throws a row away. */
export interface LineDraft {
  lineNo: number
  lineKind: LineKind
  houseCode: string
  mfrNumber: string
  description: string
  unit: string
  qtyShipped: string
  unitPrice: string
  pricingUnit: PricingUnit
  extended: string
}

const num = (s: string): number | null => {
  const t = s.replace(/[\s$,]/g, '')
  if (!t || !/^-?\d+(?:\.\d+)?$/.test(t)) return null
  return Number(t)
}

export function draftOfLine(l: PaperLine): LineDraft {
  return {
    lineNo: l.lineNo,
    lineKind: l.lineKind,
    houseCode: l.houseCode,
    mfrNumber: l.mfrNumber,
    description: l.description,
    unit: l.unit,
    qtyShipped: l.qtyShipped == null ? (l.qtyOrdered == null ? '' : String(l.qtyOrdered)) : String(l.qtyShipped),
    unitPrice: l.unitPrice == null ? '' : String(l.unitPrice),
    pricingUnit: l.pricingUnit,
    extended: l.extendedCents == null ? '' : (l.extendedCents / 100).toFixed(2),
  }
}

/** An empty draft for the row a person adds under the lines. */
export function blankDraft(lineNo: number): LineDraft {
  return { lineNo, lineKind: 'part', houseCode: '', mfrNumber: '', description: '', unit: '', qtyShipped: '', unitPrice: '', pricingUnit: 'each', extended: '' }
}

/** Whether a draft says anything: a blank add row is left out of the save. */
export function draftIsBlank(d: LineDraft): boolean {
  return !d.houseCode.trim() && !d.description.trim() && !d.qtyShipped.trim() && !d.unitPrice.trim() && !d.extended.trim()
}

/**
 * A draft back to a line. The extension typed wins; with none typed, the quantity times the price through the
 * pricing unit stands in, so a person may type three numbers or two.
 */
export function lineOfDraft(d: LineDraft, prior?: PaperLine): PaperLine {
  const qty = num(d.qtyShipped)
  const price = num(d.unitPrice)
  const typedExt = num(d.extended)
  const extendedCents = typedExt != null ? Math.round(typedExt * 100) : qty != null && price != null ? Math.round((qty * price * 100) / PRICING_UNIT_DIVISOR[d.pricingUnit]) : null
  return {
    lineNo: d.lineNo,
    lineKind: d.lineKind,
    houseCode: d.houseCode.trim(),
    mfrNumber: d.mfrNumber.trim(),
    description: d.description.trim(),
    unit: d.unit.trim().toUpperCase(),
    qtyOrdered: prior?.qtyOrdered ?? null,
    qtyShipped: qty,
    qtyBackordered: prior?.qtyBackordered ?? null,
    unitPrice: price,
    pricingUnit: d.pricingUnit,
    extendedCents,
  }
}

/** The lines as a person left them, numbered again from one, and checked. */
export function linesFromDrafts(drafts: readonly LineDraft[], prior: readonly PaperLine[]): PaperLine[] {
  const byNo = new Map(prior.map((l) => [l.lineNo, l]))
  return drafts
    .filter((d) => !draftIsBlank(d))
    .map((d, i) => lineOfDraft({ ...d, lineNo: i + 1 }, byNo.get(d.lineNo)))
}

/** The same paper with other lines, checked against the bill's row. */
export function recheck(paper: PaperRead, lines: PaperLine[], rowAmountCents: number | null): { paper: PaperRead; check: PaperCheck } {
  const next: PaperRead = { ...paper, lines }
  return { paper: next, check: checkPaper(next, { rowAmountCents }) }
}

// ---------------------------------------------------------------------------
// What the office writes
// ---------------------------------------------------------------------------

/** The `p_paper` object of `supply_paper_save`. */
export interface PaperSave {
  kind: PaperKind
  number: string
  dated_on: string | null
  order_number: string
  po_text: string
  file_path: string | null
  drive_file_id: string | null
  subtotal_cents: number | null
  tax_cents: number | null
  freight_cents: number | null
  total_cents: number | null
  read_by: string
  read_id: string | null
  read_at: string | null
  check_state: 'adds_up' | 'off'
  check_note: string
}

/** One element of `p_lines`. */
export interface LineSave {
  line_no: number
  line_kind: LineKind
  house_code: string
  mfr_number: string
  description: string
  unit: string
  qty_ordered: number | null
  qty_shipped: number | null
  qty_backordered: number | null
  unit_price: number | null
  pricing_unit: PricingUnit
  extended_cents: number | null
}

export function lineSaves(lines: readonly PaperLine[]): LineSave[] {
  return lines.map((l) => ({
    line_no: l.lineNo,
    line_kind: l.lineKind,
    house_code: l.houseCode,
    mfr_number: l.mfrNumber,
    description: l.description,
    unit: l.unit,
    qty_ordered: l.qtyOrdered,
    qty_shipped: l.qtyShipped,
    qty_backordered: l.qtyBackordered,
    unit_price: l.unitPrice,
    pricing_unit: l.pricingUnit,
    extended_cents: l.extendedCents,
  }))
}

/**
 * The paper the Add invoice window writes at Save of a bill filled from its PDF: the reader's answer as a paper,
 * checked against the amount the person saved, the file our copy is at, and the read it came from.
 */
export function paperSaveFromBillRead(args: { read: BillRead; rowAmountCents: number; filePath: string | null; readId: string | null; readAt: string; model: string }): { paper: PaperSave; lines: LineSave[]; check: PaperCheck } {
  const paper = paperFromBillRead(args.read)
  const check = checkPaper(paper, { rowAmountCents: args.rowAmountCents })
  return {
    paper: {
      kind: args.read.kind === 'credit' ? 'credit' : 'invoice',
      number: args.read.number,
      dated_on: args.read.dateYmd || null,
      order_number: args.read.orderNumber ?? '',
      po_text: args.read.poText,
      file_path: args.filePath,
      drive_file_id: null,
      subtotal_cents: paper.subtotalCents,
      tax_cents: paper.taxCents,
      freight_cents: paper.freightCents,
      total_cents: paper.totalCents,
      read_by: `form:${args.model}`,
      read_id: args.readId,
      read_at: args.readAt,
      check_state: check.state,
      check_note: check.state === 'off' ? check.words.replace(/^\d+ lines? · /, '') : '',
    },
    lines: lineSaves(paper.lines),
    check,
  }
}

/**
 * The paper the Look window writes after a person's fix: the row's paper with its lines as they stand now. The reader
 * is now the person (`read_by` 'person', no read row), since the lines are no longer the model's word.
 */
export function paperSaveFromRow(paper: PaperRow, lines: readonly PaperLine[], check: PaperCheck): { paper: PaperSave; lines: LineSave[] } {
  return {
    paper: {
      kind: paper.kind === 'credit' ? 'credit' : 'invoice',
      number: paper.number,
      dated_on: paper.datedOn,
      order_number: paper.orderNumber,
      po_text: paper.poText,
      file_path: paper.filePath,
      drive_file_id: paper.driveFileId,
      subtotal_cents: paper.subtotalCents,
      tax_cents: paper.taxCents,
      freight_cents: paper.freightCents,
      total_cents: paper.totalCents,
      read_by: 'person',
      read_id: null,
      read_at: paper.readAt,
      check_state: check.state,
      check_note: check.state === 'off' ? check.words.replace(/^\d+ lines? · /, '') : '',
    },
    lines: lineSaves(lines),
  }
}

/** The words of the Count it as read press and its confirm window. */
export const ACCEPT_WORDS = {
  press: 'Count it as read anyway',
  confirm: 'Count it as read',
  message: (gap: string) => `The lines will count toward what we buy from now, with the gap kept beside them: ${gap}. Your name goes on it.`,
} as const

/** The Save press names its count: *Save 1 line* when one was added or changed, *Save 6 lines* for the set. */
export function saveLinesLabel(changed: number, total: number): string {
  const n = changed > 0 ? changed : total
  return `Save ${n} ${n === 1 ? 'line' : 'lines'}`
}

/** How many drafts differ from the lines they came from, an added row counted once it says anything. */
export function changedCount(drafts: readonly LineDraft[], prior: readonly PaperLine[]): number {
  const byNo = new Map(prior.map((l) => [l.lineNo, draftOfLine(l)]))
  let n = 0
  for (const d of drafts) {
    const was = byNo.get(d.lineNo)
    if (!was) {
      if (!draftIsBlank(d)) n++
      continue
    }
    if (JSON.stringify(was) !== JSON.stringify(d)) n++
  }
  return n + Math.max(0, prior.length - drafts.filter((d) => byNo.has(d.lineNo)).length)
}
