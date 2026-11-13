import { describe, expect, it } from 'vitest'
import type { BookPart } from '../partMatch'
import { codesStanding, codesStandingWords, codesWithNoPart, offerIsSure, partsMatching, type CodeLine } from './codesWithNoPart'

// Made-up purchases and a made-up book: invented houses, codes, parts and prices.
const line = (over: Partial<CodeLine> & { id: string }): CodeLine => ({ invoiceId: `b-${over.id}`, houseId: 'h1', datedOn: '2026-10-22', lineKind: 'part', houseCode: '', description: '', unit: 'EA', pricingUnit: 'each', unitPrice: null, partId: null, quantity: null, extendedCents: null, ...over })
const houseNames = new Map([['h1', 'Ridgeway Supply'], ['h2', 'Pecan Supply Co']])
const book: BookPart[] = [
  { id: 'p-valve', name: 'Brasscraft KTCR19X angle stop 1/2 x 3/8', manufacturer: 'Brasscraft' },
  { id: 'p-wax', name: 'Wax ring with horn', manufacturer: null },
  { id: 'p-elbow', name: 'Copper 90 elbow 3/4 in. CxC', manufacturer: null },
  { id: 'p-tube', name: 'Copper tube type L 3/4', manufacturer: null },
]

const LINES: CodeLine[] = [
  // The most dollars: no part in the book fits.
  line({ id: '1', houseCode: '0417-2210', description: 'PVC SCH40 PIPE 2X20 PE', quantity: 30, extendedCents: 151080, datedOn: '2026-10-22' }),
  line({ id: '2', houseCode: '04172210', description: 'PVC SCH40 PIPE 2X20', quantity: 10, extendedCents: 50360, datedOn: '2026-09-01' }),
  // The manufacturer's number in the line is in a part's name: a sure offer.
  line({ id: '3', houseCode: 'RS-55310', mfrNumber: 'KTCR19X', description: 'ANGLE STOP 1/2X3/8 KTCR19X', quantity: 20, extendedCents: 12400 }),
  // The same name: a sure offer.
  line({ id: '4', houseId: 'h2', houseCode: 'PS-0077', description: 'Wax Ring With Horn', quantity: 6, extendedCents: 1860 }),
  // Already taught, a charge, a line with no code, a line with its own part: none is listed.
  line({ id: '5', houseCode: 'RS-11204', description: 'COP TUBE L 3/4', quantity: 80, extendedCents: 30720 }),
  line({ id: '6', lineKind: 'charge', houseCode: 'FRT', description: 'FREIGHT', extendedCents: 4500 }),
  line({ id: '7', description: 'SHOP TOWELS', quantity: 1, extendedCents: 900 }),
  line({ id: '8', houseCode: 'RS-40712', partId: 'p-elbow', description: 'COP 90', quantity: 5, extendedCents: 2350 }),
]
const teaches = [{ houseId: 'h1', codeKey: 'RS11204', partId: 'p-tube', notAPart: false }]

describe('codesWithNoPart', () => {
  const rows = codesWithNoPart({ lines: LINES, teaches, book, houseNames })

  it('lists the codes the book does not know, the most dollars first', () => {
    expect(rows.map((r) => [r.houseName, r.code, r.spendCents])).toEqual([
      ['Ridgeway Supply', '0417-2210', 201440],
      ['Ridgeway Supply', 'RS-55310', 12400],
      ['Pecan Supply Co', 'PS-0077', 1860],
    ])
  })

  it('gathers a code however it is dashed, under its newest words, with its newest line to teach on', () => {
    expect(rows[0]).toMatchObject({ key: 'h1|04172210', description: 'PVC SCH40 PIPE 2X20 PE', bills: 2, quantity: 40, unit: 'EA', lastDay: '2026-10-22', lineId: '1', offer: null, rivals: [] })
  })

  it('offers the part the manufacturer’s number names, and the part of the same name', () => {
    expect(rows[1]!.offer).toEqual({ part: book[0], how: 'model_number' })
    expect(rows[1]!.mfrNumber).toBe('KTCR19X')
    expect(rows[2]!.offer).toEqual({ part: book[1], how: 'same_name' })
    expect(rows.filter(offerIsSure).map((r) => r.code)).toEqual(['RS-55310', 'PS-0077'])
  })

  it('leaves out a code once it is taught, whichever way: a part, or not a part', () => {
    const after = codesWithNoPart({ lines: LINES, teaches: [...teaches, { houseId: 'h1', codeKey: '04172210', partId: null, notAPart: true }, { houseId: 'h1', codeKey: 'RS55310', partId: 'p-valve', notAPart: false }], book, houseNames })
    expect(after.map((r) => r.code)).toEqual(['PS-0077'])
  })

  it('offers nothing sure by words alone', () => {
    const byWords = codesWithNoPart({ lines: [line({ id: 'w', houseCode: 'RS-9', description: 'COPPER ELBOW 90 3/4 CXC', quantity: 4, extendedCents: 1880 })], teaches: [], book, houseNames })[0]!
    if (byWords.offer) {
      expect(byWords.offer.how).toBe('words')
      expect(offerIsSure(byWords)).toBe(false)
    } else {
      expect(byWords.rivals.length === 0 || byWords.rivals.length >= 2).toBe(true)
    }
  })
})

describe('the words and the picker', () => {
  it('says where the list stands, with the share the first forty cover when there are more', () => {
    const rows = codesWithNoPart({ lines: LINES, teaches, book, houseNames })
    expect(codesStandingWords(codesStanding(rows))).toBe('3 codes with no part · $2,157 behind them')
    expect(codesStandingWords({ codes: 2060, spendCents: 41230000, topN: 40, topShare: 0.34 })).toBe('2,060 codes with no part · $412,300 behind them · the first 40 are 34% of it')
    expect(codesStandingWords({ codes: 1, spendCents: 12400, topN: 1, topShare: 1 })).toBe('1 code with no part · $124 behind it')
    expect(codesStanding(rows, 1)).toMatchObject({ codes: 3, topN: 1 })
    expect(codesStanding(rows, 1).topShare).toBeCloseTo(201440 / 215700)
  })

  it('finds a part by every word typed, eight at most, and nothing for nothing typed', () => {
    expect(partsMatching(book, 'copper 3/4').map((p) => p.id)).toEqual(['p-elbow', 'p-tube'])
    expect(partsMatching(book, 'brasscraft').map((p) => p.id)).toEqual(['p-valve'])
    expect(partsMatching(book, '  ')).toEqual([])
    expect(partsMatching(book, 'zzz')).toEqual([])
  })
})
