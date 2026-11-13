import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readBillAnswer } from '../bills/billRead'
import { CHECK_RULES, checkPaper, codeInText, countsAsPurchase, expectedExtensionCents, lineArithmetic, moneyWords, outsideChargeCents, packFactorOf, paperFromBillRead, pricePlaces, purchaseSign, roundingAllowCents, settlePaper, type PaperLine, type PaperRead } from './paperChecks'

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
  it('counts a purchase only for an invoice or credit that still has its bill and whose check passed (the view’s rule)', () => {
    expect(countsAsPurchase({ kind: 'invoice', checkState: 'adds_up', invoiceId: 'inv-1' })).toBe(true)
    expect(countsAsPurchase({ kind: 'credit', checkState: 'accepted', invoiceId: 'inv-1' })).toBe(true)
    // The bill was deleted: the paper keeps its rows and drops out of the count.
    expect(countsAsPurchase({ kind: 'invoice', checkState: 'adds_up', invoiceId: null })).toBe(false)
    expect(countsAsPurchase({ kind: 'invoice', checkState: 'off', invoiceId: 'inv-1' })).toBe(false)
    expect(countsAsPurchase({ kind: 'ship_ticket', checkState: 'adds_up', invoiceId: 'inv-1' })).toBe(false)
    expect(countsAsPurchase({ kind: 'quote', checkState: 'accepted', invoiceId: 'inv-1' })).toBe(false)
  })
})

// PR 1c (v2.7103): the cases the measure of every bill on file named, each rebuilt as made-up paper.
describe('a price rounded on the paper', () => {
  // A house that sells pipe by the stick prints a price a foot to three places.
  const pipe = line({ lineNo: 1, houseCode: '48370', description: 'PEX 1X100 COIL', unit: 'ft', qtyShipped: 200, unitPrice: 3.127, extendedCents: 62547 })

  it('reads the paper\'s price width off its widest price, so 1.240 read back as 1.24 is still three places', () => {
    expect(pricePlaces([line({ lineNo: 1, unitPrice: 1.24 }), line({ lineNo: 2, unitPrice: 0.507 })])).toBe(3)
    expect(pricePlaces([line({ lineNo: 1, unitPrice: 12.5 }), line({ lineNo: 2, unitPrice: 40 })])).toBe(1)
    expect(pricePlaces([line({ lineNo: 1, unitPrice: 91.3937 })])).toBe(4)
    expect(pricePlaces([line({ lineNo: 1 })])).toBe(0)
  })

  it('allows the quantity times half a unit of the last place, and nothing on a paper priced to the cent', () => {
    expect(roundingAllowCents(200, 3, 'each')).toBeCloseTo(10)
    expect(roundingAllowCents(60, 3, 'each')).toBeCloseTo(3)
    expect(roundingAllowCents(200, 4, 'each')).toBeCloseTo(1)
    expect(roundingAllowCents(500, 3, 'per_hundred')).toBeCloseTo(0.25)
    expect(roundingAllowCents(200, 2, 'each')).toBe(0)
  })

  it('holds a line that misses by what the rounding allows: 200 feet at 3.127 printed as 625.47', () => {
    // 200 × 3.127 is 625.40; a price of 3.12735 a foot gives the 625.47 the paper prints.
    expect(lineArithmetic(pipe, 3).verdict).toBe('holds')
    const c = checkPaper(paper([pipe, line({ lineNo: 2, houseCode: '30614', qtyShipped: 20, unitPrice: 2.159, extendedCents: 4318 })], { subtotalCents: 66865, taxCents: 5516, totalCents: 72381 }), { rowAmountCents: 72381 })
    expect(c.state).toBe('adds_up')
    expect(c.notes).toEqual([])
  })

  it('holds a line whose price ends in a zero on a three-place paper: 120 feet at 1.240 printed as 148.76', () => {
    const c = checkPaper(paper([line({ lineNo: 1, unit: 'ft', qtyShipped: 120, unitPrice: 1.24, extendedCents: 14876 }), line({ lineNo: 2, qtyShipped: 20, unitPrice: 2.159, extendedCents: 4318 })], { subtotalCents: 19194, totalCents: 19194 }))
    expect(c.state).toBe('adds_up')
  })

  it('still fails a miss the rounding cannot explain, and a price a digit off', () => {
    // 200 × 3.127 = 625.40; 625.60 would need a price of 3.128.
    expect(lineArithmetic({ ...pipe, extendedCents: 62560 }, 3).verdict).toBe('fails')
    expect(checkPaper(paper([{ ...pipe, extendedCents: 62560 }], { subtotalCents: 62560, totalCents: 62560 })).lineProblems.map((p) => p.kind)).toEqual(['arithmetic'])
  })

  it('keeps the cent on a paper priced to the cent, so a cheap part\'s quantity cannot slip by', () => {
    // 13 read for 12 at 4 cents each: 4 cents off, and nothing on the paper is rounded.
    const cheap = line({ lineNo: 1, qtyShipped: 13, unitPrice: 0.04, extendedCents: 48 })
    expect(lineArithmetic(cheap, pricePlaces([cheap])).verdict).toBe('fails')
  })
})

describe('a pack priced by the piece', () => {
  const box = line({ lineNo: 1, houseCode: '30614', description: '*PVC 2 DWV 90 ELB HUB', unit: 'bx', qtyShipped: 1, unitPrice: 2.159, extendedCents: 10795 })

  it('holds a box whose extension is the price times a whole number of pieces', () => {
    expect(lineArithmetic(box, 3)).toEqual({ verdict: 'holds', expectedCents: 216, packFactor: 50 })
    expect(packFactorOf(box, 3)).toBe(50)
    // Two cases of 24 at 0.207 a bottle: 2 × 24 × 0.207 = 9.936, printed 9.94.
    expect(packFactorOf(line({ lineNo: 2, unit: 'CS', qtyShipped: 2, unitPrice: 0.207, extendedCents: 994 }), 3)).toBe(24)
  })

  it('says so in the notes and keeps the factor for the crosswalk', () => {
    const c = checkPaper(paper([box], { subtotalCents: 10795, totalCents: 10795 }))
    expect(c.state).toBe('adds_up')
    expect(c.packs).toEqual([{ lineNo: 1, factor: 50 }])
    expect(c.notes).toEqual(['Line 1 is priced by the piece, 50 to a pack.'])
  })

  it('is not a pack when the unit is each: a quantity read ten times too small still fails', () => {
    expect(lineArithmetic({ ...box, unit: 'ea' }, 3).verdict).toBe('fails')
    expect(packFactorOf({ ...box, unit: 'ea' }, 3)).toBeNull()
  })

  it('is not a pack when no whole number of pieces gives the extension', () => {
    // 2.159 × 50 = 107.95 and × 51 = 110.11; 109.00 is neither.
    expect(lineArithmetic({ ...box, extendedCents: 10900 }, 3).verdict).toBe('fails')
  })

  it('has no factor on a line priced the way it is counted', () => {
    expect(packFactorOf(line({ lineNo: 1, unit: 'bx', qtyShipped: 2, unitPrice: 14.5, extendedCents: 2900 }), 2)).toBeNull()
  })
})

describe('a charge outside the subtotal', () => {
  const urinal = line({ lineNo: 1, houseCode: 'UR-100', description: 'URINAL', qtyShipped: 2, unitPrice: 310.5, extendedCents: 62100 })
  const shipping = line({ lineNo: 2, lineKind: 'charge', description: 'S&H Charges', extendedCents: 4500 })

  it('adds up when the subtotal leaves the charge out and the total takes it back in', () => {
    const p = paper([urinal, shipping], { subtotalCents: 62100, taxCents: 0, totalCents: 66600 })
    expect(outsideChargeCents(p)).toBe(4500)
    const c = checkPaper(p, { rowAmountCents: 66600 })
    expect(c.state).toBe('adds_up')
    expect(c.outsideCents).toBe(4500)
    expect(c.sumCents).toBe(66600)
    expect(c.notes).toEqual(['A charge of $45.00 is printed outside the subtotal.'])
  })

  it('is not outside when the total does not take it in: the lines are over', () => {
    const p = paper([urinal, shipping], { subtotalCents: 62100, taxCents: 0, totalCents: 62100 })
    expect(outsideChargeCents(p)).toBe(0)
    expect(checkPaper(p).paperProblems.map((x) => x.kind)).toEqual(['lines_vs_subtotal'])
  })

  it('is not outside when the line is a part: only a charge can sit under the subtotal', () => {
    const p = paper([urinal, { ...shipping, lineKind: 'part' }], { subtotalCents: 62100, taxCents: 0, totalCents: 66600 })
    expect(outsideChargeCents(p)).toBe(0)
    expect(checkPaper(p).state).toBe('off')
  })

  it('takes every charge together when no one charge explains the gap', () => {
    const fuel = line({ lineNo: 3, lineKind: 'charge', description: 'FUEL SURCHARGE', extendedCents: 800 })
    const p = paper([urinal, shipping, fuel], { subtotalCents: 62100, taxCents: 5123, totalCents: 72523 })
    expect(outsideChargeCents(p)).toBe(5300)
    expect(checkPaper(p).state).toBe('adds_up')
  })

  it('leaves a charge inside the subtotal alone', () => {
    const p = paper([urinal, shipping], { subtotalCents: 66600, taxCents: 0, totalCents: 66600 })
    expect(outsideChargeCents(p)).toBe(0)
    expect(checkPaper(p).notes).toEqual([])
  })
})

describe('a line that takes money off', () => {
  const drill = line({ lineNo: 1, houseCode: 'DW-20', description: '20V DRILL KIT', qtyShipped: 1, unitPrice: 219, extendedCents: 21900 })
  const rebate = line({ lineNo: 2, description: 'TOOL INSTANT REBATE $30', qtyShipped: 1, unitPrice: 30, extendedCents: 3000 })

  it('holds a rebate the reader signed: the lines sum to the subtotal, and 1 × 30.00 = −30.00 is the same size', () => {
    const c = checkPaper(paper([drill, { ...rebate, extendedCents: -3000 }], { subtotalCents: 18900, taxCents: 1559, totalCents: 20459 }), { rowAmountCents: 20459 })
    expect(c.state).toBe('adds_up')
    expect(c.sumCents).toBe(18900)
  })

  it('turns a rebate read as a positive when the lines pass the subtotal by twice the line and its words say so', () => {
    const settled = settlePaper(paper([drill, rebate], { subtotalCents: 18900, taxCents: 1559, totalCents: 20459 }))
    expect(settled.changed).toEqual([2])
    expect(settled.paper.lines[1]!.extendedCents).toBe(-3000)
    expect(checkPaper(settled.paper, { rowAmountCents: 20459 }).state).toBe('adds_up')
  })

  it('reads a charge named a credit the same way', () => {
    const credit = line({ lineNo: 2, lineKind: 'charge', description: '$50 Warranty Credit For Valve', extendedCents: 5000 })
    const settled = settlePaper(paper([drill, credit], { subtotalCents: 16900, totalCents: 16900 }))
    expect(settled.paper.lines[1]!.extendedCents).toBe(-5000)
  })

  it('leaves a line whose words do not say it, and a gap that is not twice a line', () => {
    const plain = { ...rebate, description: 'TOOL BAG' }
    expect(settlePaper(paper([drill, plain], { subtotalCents: 18900, totalCents: 18900 })).changed).toEqual([])
    expect(settlePaper(paper([drill, rebate], { subtotalCents: 20000, totalCents: 20000 })).changed).toEqual([])
  })

  it('leaves two lines that both fit for a person', () => {
    const second = { ...rebate, lineNo: 3, description: 'MAIL-IN REBATE $30' }
    expect(settlePaper(paper([drill, rebate, second], { subtotalCents: 21900, totalCents: 21900 })).changed).toEqual([])
  })

  it('turns a paper that prints every line negative: the kind carries the direction', () => {
    const settled = settlePaper(paper([line({ lineNo: 1, extendedCents: -4318 }), line({ lineNo: 2, extendedCents: -900 })], { kind: 'credit', subtotalCents: 5218, totalCents: 5218 }))
    expect(settled.paper.lines.map((l) => l.extendedCents)).toEqual([4318, 900])
    expect(checkPaper(settled.paper).state).toBe('adds_up')
  })

  it('answers the same paper when nothing is turned', () => {
    const p = paper([drill], { subtotalCents: 21900, totalCents: 21900 })
    expect(settlePaper(p).paper).toBe(p)
  })
})

describe('a line ordered and not shipped, and a price that was not read', () => {
  // A partial shipment: three ordered, none shipped, nothing charged.
  const backordered = line({ lineNo: 2, houseCode: 'RV-300', description: 'LAV ROUGH-IN VALVE', qtyOrdered: 3, qtyShipped: null, unitPrice: 88.4012, extendedCents: 0 })
  const shipped = line({ lineNo: 1, houseCode: 'RV-100', qtyOrdered: 2, qtyShipped: 2, unitPrice: 14.5, extendedCents: 2900 })

  it('does not hold a line with no quantity shipped and no extension to the quantity ordered', () => {
    expect(lineArithmetic(backordered, 4).verdict).toBe('not_checked')
    expect(checkPaper(paper([shipped, backordered], { subtotalCents: 2900, totalCents: 2900 })).state).toBe('adds_up')
  })

  it('writes the quantity shipped as 0, so the purchase view never counts the quantity ordered as bought', () => {
    const settled = settlePaper(paper([shipped, backordered], { subtotalCents: 2900, totalCents: 2900 }))
    expect(settled.changed).toEqual([2])
    expect(settled.paper.lines[1]!.qtyShipped).toBe(0)
  })

  it('still fails a line that says it shipped and charges nothing', () => {
    expect(lineArithmetic({ ...backordered, qtyShipped: 3 }, 4).verdict).toBe('fails')
  })

  it('takes a price of zero beside a printed extension as no price: not checked, and written empty', () => {
    const noPrice = line({ lineNo: 1, description: 'WATER OUTLET BOX', qtyShipped: 4, unitPrice: 0, extendedCents: 24400 })
    expect(lineArithmetic(noPrice, 2).verdict).toBe('not_checked')
    const settled = settlePaper(paper([noPrice], { subtotalCents: 24400, totalCents: 24400 }))
    expect(settled.paper.lines[0]!.unitPrice).toBeNull()
    expect(checkPaper(settled.paper).state).toBe('adds_up')
  })

  it('leaves a free line as it is: a price of zero and no extension', () => {
    const free = line({ lineNo: 1, description: 'FREE BATTERY', qtyShipped: 1, unitPrice: 0, extendedCents: 0 })
    expect(settlePaper(paper([free])).changed).toEqual([])
    expect(lineArithmetic(free, 2).verdict).toBe('holds')
  })
})

describe('the reader\'s answer, settled', () => {
  it('keeps the sign the reader read and counts the rule sets', () => {
    const read = readBillAnswer({
      house_name: 'Ridgeway Supply', document_kind: 'invoice', number: 'S100300', date: '2026-10-05', order_number: '', po_text: '', account_ref: '', ship_to: '', job_text: '', terms: '', references_number: '',
      lines: [
        { line_kind: 'part', house_code: 'DW-20', mfr_number: '', description: '20V DRILL KIT', unit: 'EA', quantity: '1', qty_ordered: '', qty_shipped: '', qty_backordered: '', unit_price: '219.00', pricing_unit: 'each', extended: '219.00' },
        { line_kind: 'part', house_code: '', mfr_number: '', description: 'TOOL INSTANT REBATE $30', unit: '', quantity: '1', qty_ordered: '', qty_shipped: '', qty_backordered: '', unit_price: '30.00', pricing_unit: 'each', extended: '-30.00' },
      ],
      subtotal: '189.00', tax: '15.59', freight: '', total: '204.59', page_count: 1, statement_numbers: [], notes: '',
    })!
    const p = paperFromBillRead(read)
    expect(p.lines.map((l) => l.extendedCents)).toEqual([21900, -3000])
    expect(checkPaper(p, { rowAmountCents: 20459 }).state).toBe('adds_up')
    expect(CHECK_RULES).toBe(2)
  })
})
