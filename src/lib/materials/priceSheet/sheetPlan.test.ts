import { describe, expect, it } from 'vitest'
import { indexBook, indexHouseCodes } from '../partMatch'
import { linesFromTextItems, textFromPages } from './sheetText'
import { parsePasted } from './pastedRow'
import { isChargeRow, planSheet, sheetVerdict, waitingCount, type SheetGroup, type SheetLine } from './sheetPlan'

// Every house, part, number and price here is made up.
const BOOK = indexBook([
  { id: 'kit', name: 'AX8802XL-LR-PC ARLO SUPPLY KIT 1/2IPS X 3/8OD' },
  { id: 'trap', name: 'AX87029-BPC ARLO 1-1/2 17GA P-TRAP' },
  { id: 'trapBare', name: 'AX8702-9BPC' },
  { id: 'rinse', name: 'B0133-ADF12 TANNER PRE-RINSE WALL MNT 8IN' },
  { id: 'bolt', name: '3/8 X 1-1/2 CLOSET BOLT BRASS' },
])
const CODES = indexHouseCodes([
  { supplyHouseId: 'hill', code: '512207', partId: 'kit', unitFactor: 1 },
  { supplyHouseId: 'hill', code: '277310', partId: 'rinse', unitFactor: 1 },
  { supplyHouseId: 'hill', code: '440118', partId: null, notAPart: true },
])
const line = (over: Partial<SheetLine>): SheetLine => ({
  id: `l${over.lineNo}`, lineNo: 1, groupNo: 1, kind: 'part', houseCode: '', description: '', qty: 1, unitPrice: null, pricingUnit: 'each', partId: null, filedAt: null, filedPrice: null, heldWhy: '', ...over,
})
const group = (over: Partial<SheetGroup>): SheetGroup => ({ id: `g${over.groupNo}`, groupNo: 1, tag: 'SK-2', label: 'DUMP SINK', eachPrice: null, placedAt: null, heldWhy: '', ...over })
const ctx = { supplyHouseId: 'hill', houseName: 'Hillcrest Supply', book: BOOK, codes: CODES, onFile: new Map([['rinse', { price: 214, effectiveDate: '2026-08-12' }]]), datedOn: '2026-11-06' }

const LINES = [
  line({ lineNo: 1, groupNo: 1, houseCode: '440118', description: 'MISC CHARGE' }),
  line({ lineNo: 2, groupNo: 1, houseCode: '512207', description: 'AX8802XL-LR-PC ARLO SUPPLY KIT' }),
  line({ lineNo: 3, groupNo: 1, houseCode: '318002', description: 'AX87029-BPC ARLO 1-1/2 17GA P-TRAP' }),
  line({ lineNo: 4, groupNo: 2, houseCode: '277310', description: 'B0133-ADF12 TANNER PRE RINSE', unitPrice: 312.5 }),
  line({ lineNo: 5, groupNo: 2, houseCode: '190442', description: '3/8 X 1-1/2 CLOSET BOLT BRASS', unitPrice: 38.4, pricingUnit: 'per_hundred', qty: 2 }),
  line({ lineNo: 6, groupNo: 2, houseCode: '702291', description: 'NORDIC NW-2BL BI-LEVEL COOLER', unitPrice: 1284 }),
  line({ lineNo: 7, groupNo: null, houseCode: '512207', description: 'ARLO SUPPLY KIT', unitPrice: 18.4 }),
]
const GROUPS = [group({ groupNo: 1, tag: 'SK-2', eachPrice: 52.72 }), group({ groupNo: 2, tag: 'MS-1', label: 'MOP SINK', eachPrice: 1650 })]

describe('planSheet', () => {
  const plan = planSheet(LINES, GROUPS, ctx)
  const bucket = (n: number) => plan.rows.find((r) => r.line.lineNo === n)!.bucket

  it('sorts every row into one bucket', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(bucket)).toEqual(['charge', 'ready', 'needs_you', 'needs_you', 'needs_you', 'needs_you', 'ready'])
  })
  it('a kit row with the house’s own number is ready with no price; a model number on two parts needs her', () => {
    expect(plan.rows[1]!.card.status).toBe('no_price')
    expect(plan.rows[2]!.card.status).toBe('pick')
  })
  it('a move past a quarter, a price by the hundred and nothing on file each need her', () => {
    expect([plan.rows[3]!.card.chip.label, plan.rows[4]!.card.chip.label, plan.rows[5]!.card.chip.label]).toEqual(['Price moved a lot', 'Unit differs', 'Nothing on file'])
  })
  it('a row under no heading is loose', () => {
    expect(plan.loose.map((r) => r.line.lineNo)).toEqual([7])
  })
  it('a fixture of kit rows has nothing to add up; a fixture of priced rows is checked against its subtotal', () => {
    expect(plan.groups[0]!.addsUp).toBeNull()
    expect(plan.groups[1]!.rowsSum).toBe(1597.26)
    expect(plan.groups[1]!.addsUp).toBe(false)
  })
  it('a fixture is ready only when no row of it waits', () => {
    expect(plan.groups.map((g) => g.ready)).toEqual([false, false])
    const picked = planSheet(LINES, GROUPS, { ...ctx, picks: { l3: { id: 'trap', name: 'AX87029-BPC ARLO 1-1/2 17GA P-TRAP' } } })
    expect(picked.rows[2]!.picked).toBe(true)
    expect(picked.rows[2]!.bucket).toBe('confirm')
  })
  it('counts every row once, and says the sheet in one line', () => {
    expect(plan.counts).toMatchObject({ rows: 7, fixtures: 2, ready: 2, confirm: 0, needs_you: 4, charge: 1, filed: 0, left_out: 0, notAddingUp: 1 })
    expect(sheetVerdict(plan, 6)).toEqual({
      head: '6 pages · 2 fixtures · 7 rows.',
      chips: [
        { tone: 'green', label: '2 ready' },
        { tone: 'amber', label: '4 need you' },
        { tone: 'gray', label: '1 charge stays in its bundle' },
      ],
      foot: 'MS-1 does not add up to its subtotal.',
    })
    expect(waitingCount(plan)).toBe(6)
  })
  it('a filed row and a row left out are done', () => {
    const done = planSheet(
      [line({ lineNo: 1, houseCode: '512207', description: 'ARLO KIT', unitPrice: 18.4, filedAt: '2026-11-06T12:00:00Z', filedPrice: 18.4, partId: 'kit' }), line({ lineNo: 2, description: 'NORDIC COOLER', unitPrice: 5, heldWhy: 'left_out' })],
      [group({ groupNo: 1 })],
      ctx,
    )
    expect(done.rows.map((r) => r.bucket)).toEqual(['filed', 'left_out'])
    expect(done.groups[0]!.ready).toBe(true)
    expect(waitingCount(done)).toBe(0)
  })
  it('with no house settled, a matched row asks the house first', () => {
    const none = planSheet([line({ lineNo: 1, description: 'AX8802XL-LR-PC ARLO SUPPLY KIT', unitPrice: 18.4 })], [], { ...ctx, supplyHouseId: null, houseName: null })
    expect(none.rows[0]!.card.status).toBe('no_house')
    expect(none.rows[0]!.bucket).toBe('needs_you')
  })
})

describe('isChargeRow', () => {
  it('knows a charge by its kind or its words', () => {
    expect(isChargeRow({ kind: 'charge', description: 'ANYTHING' })).toBe(true)
    expect(isChargeRow({ kind: 'part', description: 'MISC CHARGE' })).toBe(true)
    expect(isChargeRow({ kind: 'part', description: 'Freight' })).toBe(true)
    expect(isChargeRow({ kind: 'part', description: 'MISC BRASS FITTINGS' })).toBe(false)
  })
})

describe('a page of text items', () => {
  it('reads items at one height as one line, left to right, top to bottom', () => {
    const items = [
      { x: 300, y: 700, str: 'AX8802XL-LR-PC ARLO SUPPLY KIT' },
      { x: 40, y: 701, str: '1ea' },
      { x: 120, y: 699.5, str: '512207' },
      { x: 300, y: 688, str: '1/2IPS X 3/8OD W/ STANDARD' },
      { x: 40, y: 720, str: 'SK-2 DUMP SINK (BAR) (OFCI)' },
      { x: 430, y: 676, str: 'Subtotal ------- SK-2 EACH' },
      { x: 560, y: 676, str: '52.72' },
      { x: 10, y: 660, str: '   ' },
    ]
    const lines = linesFromTextItems(items)
    expect(lines).toEqual(['SK-2 DUMP SINK (BAR) (OFCI)', '1ea  512207  AX8802XL-LR-PC ARLO SUPPLY KIT', '1/2IPS X 3/8OD W/ STANDARD', 'Subtotal ------- SK-2 EACH  52.72'])
    const sheet = parsePasted(textFromPages([lines]))
    expect(sheet.groups).toHaveLength(1)
    expect(sheet.groups[0]).toMatchObject({ tag: 'SK-2', each: 52.72, page: 1 })
    expect(sheet.groups[0]!.rows[0]).toMatchObject({ houseCode: '512207', lines: 2, page: 1 })
  })
})

describe('a later copy of a quote', () => {
  const earlier = [
    { houseCode: '512207', description: 'ARLO SUPPLY KIT', unitPrice: 18.4 },
    { houseCode: '277310', description: 'TANNER PRE RINSE', unitPrice: 312.5 },
    { houseCode: '', description: '3/4 FROSTPROOF WALL HYDRANT', unitPrice: 61.75 },
    { houseCode: '440118', description: 'MISC CHARGE', unitPrice: null },
    { houseCode: '655012', description: 'OLD ROW', unitPrice: 9 },
  ]
  it('counts what moved, what is new, what is gone and what is the same', async () => {
    const { sheetRevision, revisionWords } = await import('./sheetPlan')
    const rev = sheetRevision(earlier, [
      { houseCode: '512-207', description: 'ARLO SUPPLY KIT (REV)', unitPrice: 18.4 },
      { houseCode: '277310', description: 'TANNER PRE RINSE', unitPrice: 329 },
      { houseCode: '', description: '3/4 Frostproof wall hydrant', unitPrice: 61.75 },
      { houseCode: '440118', description: 'MISC CHARGE', unitPrice: null },
      { houseCode: '702291', description: 'NORDIC COOLER', unitPrice: 1284 },
    ])
    expect(rev).toEqual({ changed: 1, added: 1, gone: 1, same: 3 })
    expect(revisionWords(rev, 'Q-88213', 'Nov 6')).toBe('Q-88213 was read on Nov 6. This copy is later: 1 price changed, 1 row is new, 1 row is gone, and 3 rows are the same.')
  })
  it('says so when nothing moved', async () => {
    const { sheetRevision, revisionWords } = await import('./sheetPlan')
    expect(revisionWords(sheetRevision(earlier, earlier), '', 'Nov 6')).toBe('This quote was read on Nov 6. This copy is later: every row is the same.')
  })

  it('says when the pricing twin read a sheet, and nothing for a person\'s own drop', async () => {
    const { readerWords } = await import('./sheetPlan')
    expect(readerWords('twin:twin-pricer-1@example.test')).toBe('read by the pricing twin')
    expect(readerWords('text')).toBeNull()
    expect(readerWords('')).toBeNull()
    expect(readerWords(null)).toBeNull()
  })
})
