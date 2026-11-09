import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readBillAnswer } from '../bills/billRead'
import { checkPaper, codeInText, expectedExtensionCents, moneyWords, paperFromBillRead, purchaseSign, type PaperLine, type PaperRead } from './paperChecks'

const FIXTURES = resolve(__dirname, '../../../test/fixtures/bills')
const answerOf = (slug: string): unknown => JSON.parse(readFileSync(resolve(FIXTURES, `${slug}.answer.json`), 'utf8'))

// Made-up paper: invented parts, codes and prices in the shapes the houses print.
const line = (over: Partial<PaperLine> & { lineNo: number }): PaperLine => ({
  lineKind: 'part',
  houseCode: '',
  mfrNumber: '',
  description: '',
  unit: 'ea',
  qtyOrdered: null,
  qtyShipped: null,
  qtyBackordered: null,
  unitPrice: null,
  pricingUnit: 'each',
  extendedCents: null,
  ...over,
})

const paper = (lines: PaperLine[], over: Partial<PaperRead> = {}): PaperRead => ({ kind: 'invoice', lines, subtotalCents: null, taxCents: null, freightCents: null, totalCents: null, ...over })

describe('checkPaper', () => {
  it('adds up when every sum holds, and names the count', () => {
    const p = paper(
      [
        line({ lineNo: 1, houseCode: '48370', description: 'PIPE 2X20', unit: 'ft', qtyOrdered: 120, qtyShipped: 120, unitPrice: 0.507, extendedCents: 6084 }),
        line({ lineNo: 2, houseCode: '30614', description: '2 DWV 90', qtyOrdered: 20, qtyShipped: 20, unitPrice: 2.159, extendedCents: 4318 }),
      ],
      { subtotalCents: 10402, taxCents: 858, totalCents: 11260 },
    )
    const c = checkPaper(p, { rowAmountCents: 11260, text: 'PRODUCT ID 48370 30614 DESCRIPTION PVCPIPE 2X20 PVC 2 DWV 90 ELB HUB' })
    expect(c.state).toBe('adds_up')
    expect(c.lineCount).toBe(2)
    expect(c.sumCents).toBe(10402)
    expect(c.words).toBe('2 lines · adds up')
  })

  it('skips a kit component in the arithmetic and the sum', () => {
    const p = paper(
      [
        line({ lineNo: 1, houseCode: '946623', qtyShipped: 1, unitPrice: 278.261, extendedCents: 27826 }),
        line({ lineNo: 2, lineKind: 'component', houseCode: '', description: 'KINGSTON 1.28 TANK RH', qtyShipped: 1, unitPrice: null, extendedCents: null }),
        line({ lineNo: 3, lineKind: 'component', houseCode: '', description: 'KINGSTON CH EB BOWL WHT', qtyShipped: 1, unitPrice: 0, extendedCents: 0 }),
      ],
      { subtotalCents: 27826, taxCents: 2296, totalCents: 30122 },
    )
    const c = checkPaper(p)
    expect(c.state).toBe('adds_up')
    expect(c.lineCount).toBe(1)
  })

  it('divides by the pricing unit: a price per hundred or per thousand', () => {
    const perC = line({ lineNo: 1, qtyShipped: 10, unitPrice: 79.31, pricingUnit: 'per_hundred', extendedCents: 793 })
    const perM = line({ lineNo: 2, qtyShipped: 500, unitPrice: 345.71, pricingUnit: 'per_thousand', extendedCents: 17286 })
    expect(expectedExtensionCents(perC)).toBe(793)
    expect(expectedExtensionCents(perM)).toBe(17286)
    const c = checkPaper(paper([perC, perM], { subtotalCents: 18079, totalCents: 18079 }))
    expect(c.state).toBe('adds_up')
  })

  it('marks the line whose own arithmetic fails, within a cent', () => {
    const p = paper(
      [
        line({ lineNo: 1, qtyShipped: 7, unitPrice: 252.615, extendedCents: 176831 }),
        line({ lineNo: 2, qtyShipped: 24, unitPrice: 199, extendedCents: 477600 }),
        // Printed 8,992.70 for 10 × 899.72: a transposed extension.
        line({ lineNo: 3, qtyShipped: 10, unitPrice: 899.72, extendedCents: 899270 }),
      ],
      { subtotalCents: 176831 + 477600 + 899270, totalCents: 176831 + 477600 + 899270 },
    )
    const c = checkPaper(p, { rowAmountCents: null })
    expect(c.lineProblems.map((l) => l.lineNo)).toEqual([3])
    expect(c.lineProblems[0]!.kind).toBe('arithmetic')
    expect(c.state).toBe('off')
  })

  it('says how far the lines are from the subtotal, and the subtotal from the total', () => {
    const p = paper([line({ lineNo: 1, qtyShipped: 1, unitPrice: 10, extendedCents: 1000 })], { subtotalCents: 2240, taxCents: 100, totalCents: 2340 })
    const c = checkPaper(p)
    expect(c.state).toBe('off')
    expect(c.paperProblems[0]).toMatchObject({ kind: 'lines_vs_subtotal', offCents: -1240 })
    expect(c.words).toBe('1 line · The lines are $12.40 short of the subtotal')
    const over = checkPaper(paper([line({ lineNo: 1, qtyShipped: 1, unitPrice: 10, extendedCents: 1000 })], { subtotalCents: 1000, taxCents: 83, totalCents: 1000 }))
    expect(over.paperProblems[0]).toMatchObject({ kind: 'subtotal_vs_total', offCents: 83 })
  })

  it('holds the printed total against the bill’s row, by size, so a credit row typed positive still matches', () => {
    const p = paper([line({ lineNo: 1, qtyShipped: 2, unitPrice: 5, extendedCents: 1000 })], { kind: 'credit', subtotalCents: 1000, totalCents: 1083, taxCents: 83 })
    expect(checkPaper(p, { rowAmountCents: 1083 }).state).toBe('adds_up')
    expect(checkPaper(p, { rowAmountCents: -1083 }).state).toBe('adds_up')
    const off = checkPaper(p, { rowAmountCents: 1053 })
    expect(off.paperProblems[0]).toMatchObject({ kind: 'total_vs_row', offCents: 30 })
    expect(off.words).toBe('1 line · The printed total is $0.30 over the amount on the bill’s row'.replace('’', "'"))
  })

  it('meets the total with the lines alone when no subtotal is printed, and says so when nothing was read', () => {
    const p = paper([line({ lineNo: 1, qtyShipped: 1, unitPrice: 10, extendedCents: 1000 })], { taxCents: 83, totalCents: 1083 })
    expect(checkPaper(p).state).toBe('adds_up')
    const none = checkPaper(paper([]))
    expect(none.state).toBe('off')
    expect(none.paperProblems.map((x) => x.kind)).toEqual(['no_lines'])
    const noTotal = checkPaper(paper([line({ lineNo: 1, qtyShipped: 1, unitPrice: 10, extendedCents: 1000 })]))
    expect(noTotal.paperProblems.map((x) => x.kind)).toEqual(['no_total'])
  })

  it('flags a house code the paper’s own text does not carry, and only when there is a text', () => {
    const lines = [line({ lineNo: 1, houseCode: 'PDWVCM', qtyShipped: 3, unitPrice: 3.081, extendedCents: 924 }), line({ lineNo: 2, houseCode: 'K-26077-0', qtyShipped: 1, unitPrice: 199, extendedCents: 19900 })]
    const p = paper(lines, { subtotalCents: 20824, totalCents: 20824 })
    expect(checkPaper(p).state).toBe('adds_up')
    const withText = checkPaper(p, { text: 'ITEM PDWVCM 3 DWV CPLG HUB ... KOHLER PN: K-26077-0 TOILET' })
    expect(withText.state).toBe('adds_up')
    const wrong = checkPaper(p, { text: 'ITEM PDWVCM 3 DWV CPLG HUB ... KOHLER PN: K-26078-0 TOILET' })
    expect(wrong.state).toBe('off')
    expect(wrong.lineProblems[0]).toMatchObject({ kind: 'code_not_in_text', lineNo: 2, houseCode: 'K-26077-0' })
  })
})

describe('paperFromBillRead', () => {
  it("turns the reader's answer into a paper the checks read: the made-up bill adds up, the wrong-total one is off by what it prints", () => {
    const good = checkPaper(paperFromBillRead(readBillAnswer(answerOf('ridgeway-S1183420'))!), { rowAmountCents: 95228 })
    expect(good.state).toBe('adds_up')
    expect(good.words).toBe('5 lines · adds up')
    const wrong = checkPaper(paperFromBillRead(readBillAnswer(answerOf('ridgeway-S1183455-wrong-total'))!))
    expect(wrong.state).toBe('off')
    expect(wrong.paperProblems.map((p) => p.kind)).toEqual(['subtotal_vs_total'])
    expect(wrong.words).toBe('7 lines · The subtotal with tax and freight is $36.00 short of the total')
  })
  it('numbers the lines as printed and carries the new columns, the price whole', () => {
    const read = readBillAnswer({
      document_kind: 'credit',
      freight: '',
      lines: [{ line_kind: 'part', house_code: 'A1', description: 'x', unit: 'FT', quantity: '', qty_ordered: '10', qty_shipped: '4', qty_backordered: '6', unit_price: '2.159', pricing_unit: 'each', extended: '8.64' }],
      subtotal: '8.64',
      total: '8.64',
    })!
    const paper = paperFromBillRead(read)
    expect(paper.kind).toBe('credit')
    expect(paper.lines[0]).toMatchObject({ lineNo: 1, houseCode: 'A1', unit: 'FT', qtyOrdered: 10, qtyShipped: 4, qtyBackordered: 6, unitPrice: 2.159, pricingUnit: 'each', extendedCents: 864 })
    expect(checkPaper(paper).state).toBe('adds_up')
  })
})

describe('codeInText', () => {
  it('folds case, whitespace and a hyphenation, and does not judge a code under three characters', () => {
    expect(codeInText('k-26077-0', 'PN: K-26077-0')).toBe(true)
    expect(codeInText('K26077-0', 'PN: K-26077-0')).toBe(true)
    expect(codeInText('1831937', 'PRODUCT ID 18 31937')).toBe(true)
    expect(codeInText('ZZ9', 'nothing here')).toBe(false)
    expect(codeInText('12', 'anything')).toBeNull()
    expect(codeInText('', 'anything')).toBeNull()
  })
})

describe('words and signs', () => {
  it('prints money the app’s way and signs a credit negative', () => {
    expect(moneyWords(128410)).toBe('$1,284.10')
    expect(moneyWords(-1240)).toBe('−$12.40')
    expect(moneyWords(5)).toBe('$0.05')
    expect(purchaseSign('invoice')).toBe(1)
    expect(purchaseSign('credit')).toBe(-1)
    expect(purchaseSign('quote')).toBe(0)
    expect(purchaseSign('ship_ticket')).toBe(0)
  })
})
