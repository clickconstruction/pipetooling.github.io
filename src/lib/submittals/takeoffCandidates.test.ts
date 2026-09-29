import { describe, expect, it } from 'vitest'
import { candidateBar, candidateCounts, candidateHead, candidateToItemInsert, candidateToItemInserts, productLineOf, rowSplitTags, splitExplanation, tagsFromFixtureName, takeoffCandidates, type TakeoffLine } from './takeoffCandidates'

const parts = new Map([
  ['p-wc', { name: 'TOTO CT708UVG#01 WALL HUNG BOWL', partTypeName: 'Fixtures' }],
  ['p-fv', { name: 'TOTO TET1LA FLUSH VALVE', partTypeName: 'Fixtures' }],
  ['p-seat', { name: 'TOTO SC134 SEAT', partTypeName: 'Fixtures' }],
  ['p-stop', { name: '1/2 ANGLE STOP', partTypeName: 'Valves' }],
  ['p-pipe', { name: '3/4IN TYPE L COPPER', partTypeName: 'Pipe' }],
  ['p-wh', { name: 'BTH-199 WATER HEATER', manufacturer: 'A.O. Smith', partTypeName: 'Equipment' }],
  ['p-tank', { name: 'ST-12 EXPANSION TANK', partTypeName: 'Equipment' }],
  ['p-arr', { name: 'WHA-300 ARRESTOR', partTypeName: 'Valves' }],
])
const templates = new Map([['t-hs', 'HS - HAND SINK - SHIPLEY DO-NUTS']])
const houses = new Map([
  ['pr-1', { houseId: 'h-reece', houseName: 'Reece' }],
  ['pr-2', { houseId: 'h-moore', houseName: 'Moore Supply' }],
])
const line = (p: Partial<TakeoffLine> & { countRowId: string }): TakeoffLine => ({ partId: null, sourceTemplateId: null, quantity: 1, unitPrice: 0, sourceMaterialPartPriceId: null, ...p })

describe('tags from a takeoff fixture name', () => {
  it('reads the tags the way Wendi names fixtures', () => {
    expect(tagsFromFixtureName('WC 1&2')).toEqual(['WC-1', 'WC-2'])
    expect(tagsFromFixtureName('(10) WC 1&2 - WATER CLOSET')).toEqual(['WC-1', 'WC-2'])
    expect(tagsFromFixtureName('LAV2')).toEqual(['LAV-2'])
    expect(tagsFromFixtureName('LAV 1')).toEqual(['LAV-1'])
    expect(tagsFromFixtureName('DWH1 & ET')).toEqual(['DWH-1'])
    expect(tagsFromFixtureName('WHA-300')).toEqual(['WHA-300'])
    expect(tagsFromFixtureName('HB-3')).toEqual(['HB-3'])
    expect(tagsFromFixtureName('UR 1&2')).toEqual(['UR-1', 'UR-2'])
    expect(tagsFromFixtureName('FD')).toEqual(['FD'])
    expect(tagsFromFixtureName('12" DEEP MOP SINK')).toEqual([])
    expect(tagsFromFixtureName('(140.23) ft of 3/4IN WATER')).toEqual([])
    expect(tagsFromFixtureName('SAWCUTTING')).toEqual([])
    expect(candidateHead('(2) UTILITY SINK - 2 COMP')).toBe('UTILITY SINK')
  })
})

describe('the product under a fixture', () => {
  it('prefers a fixture-typed part over a pricier accessory, a bundle by its name, and nothing when unpriced', () => {
    const wc = productLineOf([line({ countRowId: 'c', partId: 'p-stop', unitPrice: 900, quantity: 2 }), line({ countRowId: 'c', partId: 'p-wc', unitPrice: 300 }), line({ countRowId: 'c', partId: 'p-seat', unitPrice: 40 })], parts, templates)!
    expect(wc.label).toBe('TOTO CT708UVG#01 WALL HUNG BOWL')
    const hs = productLineOf([line({ countRowId: 'c', sourceTemplateId: 't-hs', unitPrice: 966 })], parts, templates)!
    expect(hs.label).toBe('HS - HAND SINK - SHIPLEY DO-NUTS')
    const wh = productLineOf([line({ countRowId: 'c', partId: 'p-tank', unitPrice: 80 }), line({ countRowId: 'c', partId: 'p-wh', unitPrice: 2400 })], parts, templates)!
    expect(wh.label).toBe('A.O. Smith BTH-199 WATER HEATER')
    expect(productLineOf([], parts, templates)).toBeNull()
    expect(productLineOf([line({ countRowId: 'c', partId: 'unknown' })], parts, templates)).toBeNull()
  })
})

describe('the candidates', () => {
  const countRows = [
    { id: 'c-wc', fixture: 'WC 1&2', count: 10 },
    { id: 'c-lav', fixture: 'LAV 1', count: 2 },
    { id: 'c-wh', fixture: 'DWH1 & ET', count: 1 },
    { id: 'c-arr', fixture: 'WHA-300', count: 1 },
    { id: 'c-us', fixture: 'UTILITY SINK', count: 2 },
    { id: 'c-pipe', fixture: 'ft of 3/4IN WATER', count: 140.23 },
    { id: 'c-saw', fixture: 'SAWCUTTING', count: 1 },
    { id: 'c-dsc', fixture: 'DSC', count: 1 },
  ]
  const lines = [
    line({ countRowId: 'c-wc', partId: 'p-wc', unitPrice: 300, sourceMaterialPartPriceId: 'pr-1' }),
    line({ countRowId: 'c-wc', partId: 'p-fv', unitPrice: 250, sourceMaterialPartPriceId: 'pr-1' }),
    line({ countRowId: 'c-lav', sourceTemplateId: 't-hs', unitPrice: 500 }),
    line({ countRowId: 'c-wh', partId: 'p-wh', unitPrice: 2400, sourceMaterialPartPriceId: 'pr-2' }),
    line({ countRowId: 'c-arr', partId: 'p-arr', unitPrice: 600, sourceMaterialPartPriceId: 'pr-1' }),
    line({ countRowId: 'c-pipe', partId: 'p-pipe', unitPrice: 6.5, quantity: 140 }),
  ]

  it('groups, tags, names the product and the house, and ticks by the rule', () => {
    const c = takeoffCandidates({ countRows, lines, parts, templates, houses })
    expect(c.map((x) => [x.tagText || x.fixture, x.group, x.ticked, x.product, x.supplyHouseName])).toEqual([
      ['DWH-1', 'fixtures', true, 'A.O. Smith BTH-199 WATER HEATER', 'Moore Supply'],
      ['LAV-1', 'fixtures', true, 'HS - HAND SINK - SHIPLEY DO-NUTS', null],
      ['WC-1, WC-2', 'fixtures', true, 'TOTO CT708UVG#01 WALL HUNG BOWL', 'Reece'],
      ['WHA-300', 'fixtures', true, 'WHA-300 ARRESTOR', 'Reece'],
      ['UTILITY SINK', 'no_part', false, null, null],
      ['DSC', 'pipe_allowance', false, null, null],
      ['ft of 3/4IN WATER', 'pipe_allowance', false, '3/4IN TYPE L COPPER', null],
      ['SAWCUTTING', 'pipe_allowance', false, null, null],
    ])
  })

  it('the estimator’s stored tick wins, and a fixture already on the revision is set aside', () => {
    const c = takeoffCandidates({ countRows, lines, parts, templates, houses, choices: new Map([['c-arr', false], ['c-us', true]]), alreadyOn: new Set(['c-wc']) })
    const by = new Map(c.map((x) => [x.countRowId, x]))
    expect(by.get('c-arr')).toMatchObject({ ticked: false, storedTick: false, defaultTicked: true })
    expect(by.get('c-us')).toMatchObject({ ticked: true, storedTick: true, defaultTicked: false })
    expect(by.get('c-wc')!.alreadyOn).toBe(true)
    const counts = candidateCounts(c)
    expect(counts).toEqual({ total: 8, withProduct: 5, ticked: 3, rows: 3, splitCount: 0, tickedWithProduct: 2, tickedToType: 1, leftOut: 4, alreadyOn: 1 })
    expect(candidateBar(counts, 'Rev 2')).toBe('3 rows will go on Rev 2 · 2 with a product, 1 to type · 4 left out · 1 already on it')
    expect(candidateBar(candidateCounts(c, new Map([['c-lav', false], ['c-wh', false], ['c-us', false]])), 'Rev 1')).toBe('0 rows will go on Rev 1 · 7 left out · 1 already on it')
  })

  it('a ticked candidate becomes a Proposed row with the fixture as what the plan calls it, or Missing when there is nothing to propose yet', () => {
    const c = takeoffCandidates({ countRows, lines, parts, templates, houses })
    const wc = c.find((x) => x.countRowId === 'c-wc')!
    expect(candidateToItemInsert(wc, 'rev-1', 3)).toEqual({ submittal_id: 'rev-1', tag: 'WC-1, WC-2', sequence_order: 3, specified_description: 'WC 1&2', submitted_label: 'TOTO CT708UVG#01 WALL HUNG BOWL', supply_house_id: 'h-reece', status: 'proposed', sheet_pages: [], source_count_row_id: 'c-wc' })
    const us = c.find((x) => x.countRowId === 'c-us')!
    expect(candidateToItemInsert(us, 'rev-1', 4)).toMatchObject({ tag: 'UTILITY SINK', submitted_label: null, status: 'missing' })
  })

  it('v2.4118 · a name that spells out two tags can split: the stored split, the counts and bar, one row per tag with the same product, house and count row', () => {
    const c = takeoffCandidates({ countRows, lines, parts, templates, houses, splits: new Map([['c-wc', true]]) })
    const by = new Map(c.map((x) => [x.countRowId, x]))
    expect(by.get('c-wc')).toMatchObject({ canSplit: true, storedSplit: true, split: true, tags: ['WC-1', 'WC-2'] })
    expect(by.get('c-wh')).toMatchObject({ canSplit: false, split: false })
    expect(by.get('c-lav')!.canSplit).toBe(false)
    const counts = candidateCounts(c)
    expect(counts).toMatchObject({ ticked: 4, rows: 5, splitCount: 1, tickedWithProduct: 5 })
    expect(candidateBar(counts, 'Rev 1')).toBe('5 rows will go on Rev 1 · 5 with a product · 1 split into 2 · 4 left out')
    // Switched off on the screen, the same candidate counts once.
    expect(candidateCounts(c, undefined, new Map([['c-wc', false]]))).toMatchObject({ ticked: 4, rows: 4, splitCount: 0 })
    const rows = candidateToItemInserts(by.get('c-wc')!, 'rev-1', 3)
    expect(rows.map((r) => [r.tag, r.sequence_order, r.submitted_label, r.supply_house_id, r.source_count_row_id, r.status])).toEqual([
      ['WC-1', 3, 'TOTO CT708UVG#01 WALL HUNG BOWL', 'h-reece', 'c-wc', 'proposed'],
      ['WC-2', 4, 'TOTO CT708UVG#01 WALL HUNG BOWL', 'h-reece', 'c-wc', 'proposed'],
    ])
    expect(candidateToItemInserts(by.get('c-wc')!, 'rev-1', 3, false)).toHaveLength(1)
    expect(candidateToItemInserts(by.get('c-wh')!, 'rev-1', 1, true)).toHaveLength(1)
  })

  it('v2.4118 · the same reader offers Split on a draft row’s tag, and the modal reads this bid’s names', () => {
    expect(rowSplitTags('WC-1, WC-2')).toEqual(['WC-1', 'WC-2'])
    expect(rowSplitTags('WC-1 / WC-2')).toEqual(['WC-1', 'WC-2'])
    expect(rowSplitTags('WC 1&2')).toEqual(['WC-1', 'WC-2'])
    expect(rowSplitTags('UR-1, UR-2 and UR-3')).toEqual(['UR-1', 'UR-2', 'UR-3'])
    expect(rowSplitTags('WC-1')).toEqual([])
    expect(rowSplitTags('DWH1 & ET')).toEqual([])
    expect(rowSplitTags('WC-1, WC-1')).toEqual([])
    expect(rowSplitTags('')).toEqual([])
    const ex = splitExplanation(takeoffCandidates({ countRows, lines, parts, templates, houses }))
    expect(ex.map((x) => [x.name, x.readsAs, x.canSplit, x.note])).toEqual([
      ['DWH1 & ET', 'DWH-1', false, '“ET” has no number, so it is not a second tag'],
      ['LAV 1', 'LAV-1', false, null],
      ['WC 1&2', 'WC-1, WC-2', true, null],
      ['WHA-300', 'WHA-300', false, null],
      ['UTILITY SINK', 'UTILITY SINK', false, 'no tag read; the name is the tag'],
    ])
  })
})
