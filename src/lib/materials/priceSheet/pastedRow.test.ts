import { describe, expect, it } from 'vitest'
import { allRows, bookPrice, parsePasted, parsePastedRow, PRICING_UNIT_FACTOR } from './pastedRow'

// Every house, part, number and price here is made up.
describe('parsePastedRow', () => {
  it('a number, the words and a price', () => {
    expect(parsePastedRow('512207  AX8802XL-LR-PC ARLO SUPPLY KIT  18.40')).toEqual({
      qty: null, houseCode: '512207', description: 'AX8802XL-LR-PC ARLO SUPPLY KIT', unitPrice: 18.4, pricingUnit: 'each', extended: null, lines: 1,
    })
  })
  it('a quantity glued to its unit, and a kit row with no price', () => {
    expect(parsePastedRow('1ea   440118 MISC CHARGE')).toMatchObject({ qty: 1, houseCode: '440118', description: 'MISC CHARGE', unitPrice: null })
  })
  it('a quantity, a unit word, the unit price and the extension', () => {
    expect(parsePastedRow('2 EA 277310 B0133-ADF12 TANNER PRE RINSE $312.50 EA 625.00')).toMatchObject({
      qty: 2, houseCode: '277310', description: 'B0133-ADF12 TANNER PRE RINSE', unitPrice: 312.5, extended: 625, pricingUnit: 'each',
    })
  })
  it('a bare quantity ahead of the house number', () => {
    expect(parsePastedRow('3 318002 AX87029-BPC ARLO P-TRAP 14.25 42.75')).toMatchObject({ qty: 3, houseCode: '318002', unitPrice: 14.25, extended: 42.75 })
  })
  it('a price by the hundred, spaced or glued, and by the thousand', () => {
    expect(parsePastedRow('190442 3/8 X 1-1/2 CLOSET BOLT BRASS 38.40 C')).toMatchObject({ unitPrice: 38.4, pricingUnit: 'per_hundred', description: '3/8 X 1-1/2 CLOSET BOLT BRASS' })
    expect(parsePastedRow('190442 3/8 X 1-1/2 CLOSET BOLT BRASS 38.40/C')).toMatchObject({ unitPrice: 38.4, pricingUnit: 'per_hundred' })
    expect(parsePastedRow('1/2X4 BLK STL NIPP S40 412.00 M')).toMatchObject({ houseCode: '', unitPrice: 412, pricingUnit: 'per_thousand' })
  })
  it('a list price and a net price: the net is the price', () => {
    expect(parsePastedRow('702291 NORDIC NW-2BL COOLER 1,620.00 1,284.00')).toMatchObject({ unitPrice: 1284, extended: null })
  })
  it('a size in the words is never the price', () => {
    expect(parsePastedRow('655012 3/4 FROST PROOF WALL HYDRANT 8IN')).toMatchObject({ houseCode: '655012', unitPrice: null, description: '3/4 FROST PROOF WALL HYDRANT 8IN' })
    expect(parsePastedRow('1ea 512260 ARLO AX7702-PC GRID DRAIN 1.25 17GA')).toMatchObject({ unitPrice: null })
  })
  it('a model number at the head of a line is words, not the house number', () => {
    expect(parsePastedRow('AX8802XL-LR-PC ARLO SUPPLY KIT 18.40')).toMatchObject({ houseCode: '', description: 'AX8802XL-LR-PC ARLO SUPPLY KIT', unitPrice: 18.4 })
  })
  it('a line of words alone, a heading and a blank are not rows', () => {
    expect(parsePastedRow('COMPRESSION STOP AND SUPPLY KIT')).toBeNull()
    expect(parsePastedRow('SK-2 DUMP SINK (BAR) (OFCI)')).toBeNull()
    expect(parsePastedRow('   ')).toBeNull()
  })
})

const BLOCK = `ORDER QTY  ITEM NO   DESCRIPTION                          UNIT PRICE

SK-1 3 COMPARTMENT SINK (OFCI)
1ea        440118    MISC CHARGE
1ea        512207    AX8802XL-LR-PC ARLO SUPPLY KIT
                     1/2IPS X 3/8OD W/ STANDARD
                     COMPRESSION STOP AND SUPPLY KIT
1ea        318002    AX87029-BPC ARLO 1-1/2 17GA P-TRAP
                     W/C.O. & BRASS NUTS
                     Subtotal ------- SK-1 EACH            52.72
********************************

********************************
MS-1 MOP SINK
1ea        277310    B0133-ADF12 TANNER PRE RINSE          312.50
2ea        190442    3/8 X 1-1/2 CLOSET BOLT BRASS          38.40 C
                     Subtotal ------- MS-1 EACH            313.27
`

describe('parsePasted', () => {
  const sheet = parsePasted(BLOCK)

  it('groups the rows under each fixture and reads its EACH subtotal', () => {
    expect(sheet.groups.map((g) => [g.tag, g.label, g.each, g.rows.length])).toEqual([
      ['SK-1', '3 COMPARTMENT SINK (OFCI)', 52.72, 3],
      ['MS-1', 'MOP SINK', 313.27, 2],
    ])
    expect(sheet.loose).toEqual([])
  })
  it('a description that runs over three lines is one row, and says how many lines it took', () => {
    const kit = sheet.groups[0]!.rows[1]!
    expect(kit.description).toBe('AX8802XL-LR-PC ARLO SUPPLY KIT 1/2IPS X 3/8OD W/ STANDARD COMPRESSION STOP AND SUPPLY KIT')
    expect(kit.lines).toBe(3)
    expect(sheet.groups[0]!.rows[2]!.lines).toBe(2)
  })
  it('a kit row carries no price; a priced row carries its own, with its unit', () => {
    expect(sheet.groups[0]!.rows.map((r) => r.unitPrice)).toEqual([null, null, null])
    expect(sheet.groups[1]!.rows.map((r) => [r.unitPrice, r.pricingUnit])).toEqual([[312.5, 'each'], [38.4, 'per_hundred']])
  })
  it('skips the column heads and the rules', () => {
    expect(allRows(sheet).some((r) => /ORDER|\*\*\*/.test(r.description))).toBe(false)
  })
  it('one pasted line is one loose row', () => {
    expect(parsePasted('512207  AX8802XL-LR-PC ARLO SUPPLY KIT  18.40')).toEqual({
      groups: [],
      loose: [{ qty: null, houseCode: '512207', description: 'AX8802XL-LR-PC ARLO SUPPLY KIT', unitPrice: 18.4, pricingUnit: 'each', extended: null, lines: 1 }],
    })
  })
  it('a tag with a dash starts a fixture even with no blank line above it', () => {
    const two = parsePasted('SK-2 DUMP SINK\n1ea 512207 ARLO SUPPLY KIT\nSK-3 BAR SINK\n1ea 318002 ARLO P-TRAP')
    expect(two.groups.map((g) => [g.tag, g.rows.length])).toEqual([['SK-2', 1], ['SK-3', 1]])
  })
  it('a schedule that looks like a tag is the row above running on', () => {
    const one = parsePasted('1ea 924471 3" PVC DWV PE PIPE\nSCH40 SOLID CORE 20FT  41.10')
    expect(one.groups).toEqual([])
    expect(one.loose).toHaveLength(2)
    const run = parsePasted('1ea 924471 3" PVC DWV PE PIPE\nSCH40 SOLID CORE')
    expect(run.loose).toHaveLength(1)
    expect(run.loose[0]!.description).toBe('3" PVC DWV PE PIPE SCH40 SOLID CORE')
  })
  it('rows after a subtotal with no heading are loose', () => {
    const s = parsePasted('WC-1 WATER CLOSET\n1ea 318845 KESSLER K-4410 CARRIER\nSubtotal --- WC-1 EACH 410.00\n\n702291 NORDIC NW-2BL COOLER 1,284.00')
    expect(s.groups).toHaveLength(1)
    expect(s.loose.map((r) => r.houseCode)).toEqual(['702291'])
  })
})

describe('bookPrice', () => {
  it('a price by the hundred as the book keeps it, each', () => {
    expect(bookPrice(38.4, PRICING_UNIT_FACTOR.per_hundred)).toBe(0.38)
    expect(bookPrice(412, PRICING_UNIT_FACTOR.per_thousand)).toBe(0.41)
    expect(bookPrice(18.4, 1)).toBe(18.4)
  })
})
