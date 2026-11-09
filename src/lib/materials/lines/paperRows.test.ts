import { describe, expect, it } from 'vitest'
import type { BillRead } from '../bills/billRead'
import type { PaperLine } from './paperChecks'
import {
  ACCEPT_WORDS,
  blankDraft,
  changedCount,
  draftOfLine,
  gapWords,
  lineOfDraft,
  linesFromDrafts,
  paperSaveFromBillRead,
  paperSaveFromRow,
  recheck,
  rowLinesWords,
  saveLinesLabel,
  type PaperRow,
} from './paperRows'

// A made-up bill: six lines that sum to 664.70, tax 54.84, total 719.54. Every code, part and price is invented.
const line = (lineNo: number, houseCode: string, description: string, qty: number, price: number, ext: number, lineKind: PaperLine['lineKind'] = 'part'): PaperLine => ({
  lineNo,
  lineKind,
  houseCode,
  mfrNumber: '',
  description,
  unit: 'EA',
  qtyOrdered: qty,
  qtyShipped: qty,
  qtyBackordered: null,
  unitPrice: price,
  pricingUnit: 'each',
  extendedCents: ext,
})

const LINES: PaperLine[] = [
  line(1, 'RS-40712', '3/4 COP 90 ELL CXC', 25, 4.7, 11750),
  line(2, 'RS-40718', '3/4 COP TEE CXCXC', 12, 7.85, 9420),
  line(3, 'RS-11204', '3/4 X 10 TYPE L COP TUBE', 8, 38.4, 30720),
  line(4, 'RS-55310', '3/4 FIP BALL VLV FP', 6, 21.15, 12690),
  line(5, 'RS-90021', 'WAX RING W/HORN', 4, 3.1, 1240),
  line(6, 'FRT', 'FUEL SURCHARGE', 1, 6.5, 650, 'charge'),
]

const paper = (over: Partial<PaperRow> = {}): PaperRow => ({
  id: 'p1',
  invoiceId: 'inv1',
  kind: 'invoice',
  number: 'S-118342',
  datedOn: '2026-10-22',
  orderNumber: '',
  poText: '41207',
  filePath: 'bills/h/x/bill.pdf',
  driveFileId: null,
  subtotalCents: 66470,
  taxCents: 5484,
  freightCents: null,
  totalCents: 71954,
  readBy: 'form:claude-sonnet-5-5',
  readAt: '2026-10-22T15:00:00Z',
  checkState: 'adds_up',
  checkNote: '',
  acceptedBy: null,
  acceptedAt: null,
  lines: LINES,
  ...over,
})

describe('rowLinesWords', () => {
  it('says adds up, with the counted lines', () => {
    expect(rowLinesWords(paper(), { link: 'x', hasFile: true })).toEqual({ tone: 'ok', words: '6 lines · adds up', look: true })
  })
  it('says the gap when the paper is off', () => {
    const r = rowLinesWords(paper({ checkState: 'off', checkNote: 'The lines are $12.40 short of the subtotal.', lines: LINES.slice(0, 4).concat(LINES[5]!) }), { link: 'x', hasFile: true })
    expect(r).toEqual({ tone: 'off', words: '5 lines · The lines are $12.40 short of the subtotal', look: true })
  })
  it('names who counted it as read', () => {
    expect(rowLinesWords(paper({ checkState: 'accepted' }), { link: 'x', hasFile: true }, 'Dana').words).toBe('6 lines · counted as read by Dana')
  })
  it('does not count a component line', () => {
    const withKit = paper({ lines: [...LINES, line(7, 'RS-1', 'KIT PART', 1, 0, 0, 'component')] })
    expect(rowLinesWords(withKit, { link: 'x', hasFile: true }).words).toBe('6 lines · adds up')
  })
  it('says what fills it when there is no paper', () => {
    expect(rowLinesWords(null, { link: 'https://drive.example/x', hasFile: false })).toEqual({ tone: 'none', words: 'No lines yet', look: false })
    expect(rowLinesWords(null, { link: null, hasFile: false })).toEqual({ tone: 'none', words: 'No PDF on this bill', look: false })
  })
})

describe('gapWords', () => {
  it('reads the missing line as a missing line', () => {
    const { check } = recheck({ kind: 'invoice', lines: LINES, subtotalCents: 66470, taxCents: 5484, freightCents: null, totalCents: 71954 }, LINES.filter((l) => l.lineNo !== 5), 71954)
    expect(check.state).toBe('off')
    const g = gapWords(check)
    expect(g.tone).toBe('off')
    expect(g.title).toBe('The lines are $12.40 short of the subtotal.')
    expect(g.detail[g.detail.length - 1]).toMatch(/a line is missing/)
  })
  it('reads a line whose own arithmetic fails', () => {
    const bad = LINES.map((l) => (l.lineNo === 2 ? { ...l, extendedCents: 9240 } : l))
    const { check } = recheck({ kind: 'invoice', lines: LINES, subtotalCents: 66470, taxCents: 5484, freightCents: null, totalCents: 71954 }, bad, 71954)
    const g = gapWords(check)
    expect(g.tone).toBe('off')
    expect(check.lineProblems[0]?.lineNo).toBe(2)
    expect(g.detail.join(' ')).toMatch(/Line 2/)
  })
  it('says the sums when it adds up', () => {
    const { check } = recheck({ kind: 'invoice', lines: LINES, subtotalCents: 66470, taxCents: 5484, freightCents: null, totalCents: 71954 }, LINES, 71954)
    expect(gapWords(check)).toEqual({ tone: 'ok', title: 'The 6 lines add up.', detail: [expect.stringMatching(/\$664\.70/)] })
  })
})

describe('drafts', () => {
  it('round-trips a line through its draft', () => {
    const d = draftOfLine(LINES[0]!)
    expect(d.qtyShipped).toBe('25')
    expect(d.unitPrice).toBe('4.7')
    expect(d.extended).toBe('117.50')
    expect(lineOfDraft(d, LINES[0]!)).toEqual(LINES[0])
  })
  it('works the extension out when none is typed, through the pricing unit', () => {
    const d = { ...blankDraft(7), houseCode: 'RS-7', description: 'WIRE', qtyShipped: '250', unitPrice: '42.50', pricingUnit: 'per_hundred' as const }
    expect(lineOfDraft(d).extendedCents).toBe(10625)
  })
  it('leaves a blank add row out and numbers the rest from one', () => {
    const drafts = [...LINES.filter((l) => l.lineNo !== 5).map((l) => draftOfLine(l)), blankDraft(7)]
    const lines = linesFromDrafts(drafts, LINES)
    expect(lines.map((l) => l.lineNo)).toEqual([1, 2, 3, 4, 5])
    expect(lines[4]?.houseCode).toBe('FRT')
  })
  it('a typed add row makes the bill add up again', () => {
    const drafts = [...LINES.filter((l) => l.lineNo !== 5).map((l) => draftOfLine(l)), { ...blankDraft(7), houseCode: 'RS-90021', description: 'WAX RING W/HORN', unit: 'EA', qtyShipped: '4', unitPrice: '3.10', extended: '12.40' }]
    const lines = linesFromDrafts(drafts, LINES)
    const { check } = recheck({ kind: 'invoice', lines: [], subtotalCents: 66470, taxCents: 5484, freightCents: null, totalCents: 71954 }, lines, 71954)
    expect(check.state).toBe('adds_up')
    expect(check.lineCount).toBe(6)
  })
  it('counts what changed, and names the Save press by it', () => {
    const drafts = LINES.map((l) => draftOfLine(l))
    expect(changedCount(drafts, LINES)).toBe(0)
    drafts[1] = { ...drafts[1]!, qtyShipped: '13' }
    expect(changedCount(drafts, LINES)).toBe(1)
    expect(saveLinesLabel(1, 6)).toBe('Save 1 line')
    expect(saveLinesLabel(0, 6)).toBe('Save 6 lines')
    expect(changedCount([...drafts, { ...blankDraft(7), description: 'X' }], LINES)).toBe(2)
    expect(changedCount(drafts.slice(0, 5), LINES)).toBe(2)
  })
})

describe('what the office writes', () => {
  const read: BillRead = {
    houseName: 'Ridgeway Supply',
    kind: 'invoice',
    number: 'S-118342',
    dateYmd: '2026-10-22',
    poText: '41207',
    accountRef: '',
    shipTo: '',
    jobText: '',
    terms: '',
    referencesNumber: '',
    orderNumber: 'SO-77',
    lines: LINES.map((l) => ({ description: l.description, quantity: l.qtyShipped, unitPriceCents: Math.round((l.unitPrice ?? 0) * 100), extendedCents: l.extendedCents, lineKind: l.lineKind, houseCode: l.houseCode, mfrNumber: '', unit: l.unit, qtyOrdered: l.qtyOrdered, qtyShipped: l.qtyShipped, qtyBackordered: null, unitPrice: l.unitPrice, pricingUnit: 'each' })),
    subtotalCents: 66470,
    taxCents: 5484,
    freightCents: null,
    totalCents: 71954,
    pageCount: 1,
    statementNumbers: [],
    notes: '',
  }
  it('builds the paper from the fill, checked against the saved amount', () => {
    const out = paperSaveFromBillRead({ read, rowAmountCents: 71954, filePath: 'bills/h/x/bill.pdf', readId: 'r1', readAt: '2026-10-22T15:00:00Z', model: 'claude-sonnet-5-5' })
    expect(out.check.state).toBe('adds_up')
    expect(out.paper).toMatchObject({ kind: 'invoice', number: 'S-118342', dated_on: '2026-10-22', order_number: 'SO-77', total_cents: 71954, read_by: 'form:claude-sonnet-5-5', read_id: 'r1', check_state: 'adds_up', check_note: '' })
    expect(out.lines).toHaveLength(6)
    expect(out.lines[5]).toMatchObject({ line_no: 6, line_kind: 'charge', house_code: 'FRT', extended_cents: 650 })
  })
  it('keeps the gap as the note when the saved amount differs', () => {
    const out = paperSaveFromBillRead({ read, rowAmountCents: 70000, filePath: null, readId: null, readAt: '2026-10-22T15:00:00Z', model: 'claude-sonnet-5-5' })
    expect(out.paper.check_state).toBe('off')
    expect(out.paper.check_note).toMatch(/over the amount on the bill's row/)
  })
  it('a credit is a credit', () => {
    const out = paperSaveFromBillRead({ read: { ...read, kind: 'credit' }, rowAmountCents: -71954, filePath: null, readId: null, readAt: '2026-10-22T15:00:00Z', model: 'm' })
    expect(out.paper.kind).toBe('credit')
    expect(out.check.state).toBe('adds_up')
  })
  it('writes a row\'s paper again with the fixed lines', () => {
    const p = paper({ checkState: 'off', checkNote: 'The lines are $12.40 short of the subtotal.' })
    const { check } = recheck({ kind: 'invoice', lines: [], subtotalCents: 66470, taxCents: 5484, freightCents: null, totalCents: 71954 }, LINES, 71954)
    const out = paperSaveFromRow(p, LINES, check)
    expect(out.paper).toMatchObject({ check_state: 'adds_up', check_note: '', read_by: 'person', read_id: null, file_path: 'bills/h/x/bill.pdf' })
    expect(out.lines).toHaveLength(6)
  })
  it('the accept words name the act', () => {
    expect(ACCEPT_WORDS.confirm).toBe('Count it as read')
    expect(ACCEPT_WORDS.message('$12.40 short of the subtotal')).toMatch(/\$12\.40 short/)
  })
})
