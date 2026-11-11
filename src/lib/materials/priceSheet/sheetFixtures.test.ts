import { describe, expect, it } from 'vitest'
import type { PlannedGroup, PlannedRow, RowBucket } from './sheetPlan'
import { assemblyName, countRowKeys, countRowName, findSameItemsAssembly, fixtureStatus, groupItems, rowsForTag, sameItems, tagKeys } from './sheetFixtures'

// Every bid row, part, assembly and price here is made up.
const ROWS = [
  { id: 'r1', fixture: 'SK-1 OFCI', count: 1 },
  { id: 'r2', fixture: 'SK-2 OFCI', count: 3 },
  { id: 'r3', fixture: 'Water closet', planTag: 'WC-1', count: 6 },
  { id: 'r4', fixture: 'wc 2 ADA', count: 2 },
  { id: 'r5', fixture: 'Lav-1', count: 2 },
]

const row = (lineNo: number, bucket: RowBucket, partId: string | null, qty = 1, unitPrice: number | null = null): PlannedRow =>
  ({
    line: { id: `l${lineNo}`, lineNo, groupNo: 1, kind: 'part', houseCode: '', description: '', qty, unitPrice, pricingUnit: 'each', partId, filedAt: bucket === 'filed' ? '2026-11-06T00:00:00Z' : null, filedPrice: null, heldWhy: '' },
    match: { how: 'none', part: null, rivals: [], model: null },
    picked: false,
    card: {} as PlannedRow['card'],
    bucket,
  }) as PlannedRow
const group = (over: Partial<PlannedGroup> & { tag?: string; eachPrice?: number | null; placedAt?: string | null } = {}): PlannedGroup => ({
  group: { id: 'g1', groupNo: 1, tag: over.tag ?? 'SK-2', label: 'DUMP SINK (BAR) (OFCI)', eachPrice: over.eachPrice === undefined ? 52.72 : over.eachPrice, placedAt: over.placedAt ?? null, heldWhy: '' },
  rows: over.rows ?? [row(1, 'charge', null), row(2, 'filed', 'kit'), row(3, 'filed', 'trap')],
  addsUp: over.addsUp ?? null,
  rowsSum: over.rowsSum ?? null,
  ready: true,
})
const none = () => 0

describe('tags', () => {
  it('folds a tag, and reads a heading that names two', () => {
    expect(tagKeys('SK-2')).toEqual(['SK2'])
    expect(tagKeys('WC-1 & WC-2')).toEqual(['WC1', 'WC2'])
    expect(tagKeys('WC-1 & 2')).toEqual(['WC1', 'WC2'])
    expect(tagKeys('WC-1/2A')).toEqual(['WC1', 'WC2A'])
  })
  it('a row of the bid answers to its plan tag and to the tag its name opens with', () => {
    expect(countRowKeys(ROWS[0]!)).toEqual(['SK1'])
    expect(countRowKeys(ROWS[2]!)).toEqual(['WC1'])
    expect(countRowKeys(ROWS[3]!)).toEqual(['WC2'])
    expect(countRowKeys({ id: 'x', fixture: 'Mop sink', count: 1 })).toEqual([])
  })
  it('finds the bid’s rows for a tag, however it is dashed or cased', () => {
    expect(rowsForTag('SK-2', ROWS).map((r) => r.id)).toEqual(['r2'])
    expect(rowsForTag('LAV-1', ROWS).map((r) => r.id)).toEqual(['r5'])
    expect(rowsForTag('WC-1 & WC-2', ROWS).map((r) => r.id)).toEqual(['r3', 'r4'])
    expect(rowsForTag('SK-4A', ROWS)).toEqual([])
  })
})

describe('the assembly', () => {
  it('holds each filed part once, its quantities summed, and no charge', () => {
    expect(groupItems([row(1, 'charge', null), row(2, 'filed', 'kit'), row(3, 'filed', 'trap', 2), row(4, 'filed', 'kit'), row(5, 'left_out', 'bolt'), row(6, 'ready', 'rinse')])).toEqual([
      { partId: 'kit', quantity: 2 },
      { partId: 'trap', quantity: 2 },
    ])
  })
  it('is the same as another only with the same parts in the same quantities', () => {
    const items = [{ partId: 'kit', quantity: 1 }, { partId: 'trap', quantity: 1 }]
    expect(sameItems(items, [{ partId: 'trap', quantity: 1 }, { partId: 'kit', quantity: 1 }])).toBe(true)
    expect(sameItems(items, [{ partId: 'kit', quantity: 1 }, { partId: 'trap', quantity: 2 }])).toBe(false)
    expect(sameItems(items, [{ partId: 'kit', quantity: 1 }])).toBe(false)
  })
  it('reuses an assembly on file with exactly these items, never one that nests another', () => {
    const items = [{ partId: 'kit', quantity: 1 }, { partId: 'trap', quantity: 1 }]
    const assemblies = [
      { id: 'a1', name: 'Bar sink trim kit', items },
      { id: 'a2', name: 'Another same kit', items },
      { id: 'a3', name: 'A nested one', items, nested: true },
      { id: 'a4', name: 'Bigger', items: [...items, { partId: 'rinse', quantity: 1 }] },
    ]
    expect(findSameItemsAssembly(items, assemblies)?.id).toBe('a2')
    expect(findSameItemsAssembly([{ partId: 'bolt', quantity: 4 }], assemblies)).toBeNull()
    expect(findSameItemsAssembly([], assemblies)).toBeNull()
  })
  it('is named for the tag, the fixture’s words and the house', () => {
    expect(assemblyName('MS-1', 'MOP  SINK', 'Hillcrest Supply')).toBe('MS-1 MOP SINK · Hillcrest Supply')
  })
})

describe('fixtureStatus', () => {
  it('ready: every row filed, a row of the bid waits, at the printed subtotal', () => {
    expect(fixtureStatus({ group: group(), countRows: ROWS, lineCount: none })).toMatchObject({ state: 'ready', each: 52.72, why: 'Goes on SK-2 OFCI.', items: [{ partId: 'kit', quantity: 1 }, { partId: 'trap', quantity: 1 }] })
  })
  it('a fixture the bid costed by hand waits for a word', () => {
    expect(fixtureStatus({ group: group(), countRows: ROWS, lineCount: (id) => (id === 'r2' ? 3 : 0) })).toMatchObject({ state: 'costed_by_hand', why: 'SK-2 OFCI is costed by hand already.' })
  })
  it('a tag the bid does not have, until a person chooses the row', () => {
    const g = group({ tag: 'SK-4A' })
    expect(fixtureStatus({ group: g, countRows: ROWS, lineCount: none })).toMatchObject({ state: 'no_row', why: 'No fixture on this bid is tagged SK-4A.' })
    expect(fixtureStatus({ group: g, countRows: ROWS, lineCount: none, chosenRowIds: ['r1'] })).toMatchObject({ state: 'ready', why: 'Goes on SK-1 OFCI.' })
  })
  it('two rows with one name are told apart by their area', () => {
    const areas = [
      { id: 'a1', fixture: 'WC', groupTag: 'Restroom A', count: 4 },
      { id: 'a2', fixture: 'WC', groupTag: 'Break room', count: 1 },
    ]
    expect(areas.map(countRowName)).toEqual(['WC · Restroom A', 'WC · Break room'])
    expect(countRowName({ fixture: 'WH', groupTag: '  ' })).toBe('WH')
    expect(fixtureStatus({ group: group({ tag: 'ZL-1' }), countRows: areas, lineCount: none, chosenRowIds: ['a2'] })).toMatchObject({ state: 'ready', why: 'Goes on WC · Break room.' })
  })
  it('a row not filed yet, rows that do not add up, and no price to place', () => {
    expect(fixtureStatus({ group: group({ rows: [row(1, 'filed', 'kit'), row(2, 'needs_you', null)] }), countRows: ROWS, lineCount: none })).toMatchObject({ state: 'waits', why: '1 row is not filed yet.' })
    expect(fixtureStatus({ group: group({ addsUp: false }), countRows: ROWS, lineCount: none }).state).toBe('off')
    expect(fixtureStatus({ group: group({ eachPrice: null }), countRows: ROWS, lineCount: none }).state).toBe('no_price')
  })
  it('with no printed subtotal, the sum of its priced rows is the price', () => {
    expect(fixtureStatus({ group: group({ eachPrice: null, rowsSum: 418.65 }), countRows: ROWS, lineCount: none })).toMatchObject({ state: 'ready', each: 418.65 })
  })
  it('a heading that names two tags goes on both rows', () => {
    expect(fixtureStatus({ group: group({ tag: 'WC-1 & WC-2' }), countRows: ROWS, lineCount: none })).toMatchObject({ state: 'ready', why: 'Goes on Water closet and wc 2 ADA.' })
  })
  it('placed already', () => {
    expect(fixtureStatus({ group: group({ placedAt: '2026-11-06T00:00:00Z' }), countRows: ROWS, lineCount: none })).toMatchObject({ state: 'placed', why: 'On the takeoff, on SK-2 OFCI.' })
  })
})
