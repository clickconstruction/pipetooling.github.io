import { describe, expect, it } from 'vitest'
import { candidateBar, candidateCounts, candidateHead, candidateToItemInsert, candidateToItemInserts, defaultProductKeys, productFromPieces, productPiecesOf, rowSplitTags, splitExplanation, tagsFromFixtureName, takeoffCandidates, withProductKeys, type TakeoffLine } from './takeoffCandidates'

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

describe('the product under a fixture (v2.4292: its pieces, trim off by name)', () => {
  // BP375 SPACEX BA-02N as its takeoff carries them on 2026-10-01 — the three fixtures one line named wrong.
  const bp = new Map([
    ['ladena', { name: '2215-0 LADENA WHITE', partTypeName: null }],
    ['faucet', { name: 'T25S51E#CP', partTypeName: null }],
    ['supply', { name: 'BRASSCRAFT/PLUMBSHOP PLS1-16AF 3/8 COMP X 1/2 FIP X 16 IN SS SUPPLY', partTypeName: null }],
    ['grid', { name: '|HYDRAPRO H20008 CP BRASS COMMERCIAL LAVATORY GRID DRAIN WITH OVERFLOW', partTypeName: null }],
    ['trap', { name: 'MLZ8700 11/4 CHROME PLATED 17 GUAGE SEMI CAST BRASS P-TRAP', partTypeName: null }],
    ['stop', { name: 'BRASSCRA PLB113XP 1/2 NOM COMPX3/8 OD COMP W/LOOSEKEY ANG', partTypeName: 'Sink' }],
    ['flange', { name: 'MAINLINE ML90105 POLISHED CHROME 5/8 OD LOW PATTERN SURE GRIP FLANGE', partTypeName: 'Sink' }],
    ['b8236', { name: 'B-8236', partTypeName: null }],
    ['bowl', { name: 'CT728CUVG#01 TORNADO FLUSH COMMERCIAL FLUSHOMETER WALL- MOUNTED TOILET', partTypeName: null }],
    ['fv', { name: 'TET2UB31#SS', partTypeName: null }],
    ['seat', { name: 'MAINLINE ML1055SSC000 WHT ELONG', partTypeName: null }],
    ['carrier', { name: 'ZURN Z1201-NR4-CL12-RYK17 NH DURA-COAT CI ADJ HORIZONTAL SIPHON JET EZCARRY W/RT HAND INLET', partTypeName: 'Toilet' }],
    ['urinal', { name: 'UT105UVG#01', partTypeName: null }],
    ['ufv', { name: 'TEU2UA11#SS', partTypeName: null }],
    ['primer', { name: 'PPP PR-500 TRAP PRIMER', partTypeName: null }],
  ])
  const moore = new Map([['pr-m', { houseId: 'h-moore', houseName: 'Moore Supply' }]])
  const seq = (row: string, ids: Array<[string, number]>) => ids.map(([partId, unitPrice], i) => line({ id: `${row}-${i}`, countRowId: row, sequenceOrder: i + 1, partId, unitPrice, sourceMaterialPartPriceId: 'pr-m' }))
  const of = (row: string, ids: Array<[string, number]>) => {
    const pieces = productPiecesOf(row, seq(row, ids), bp, templates, moore)
    return productFromPieces(pieces, defaultProductKeys(pieces)).product
  }

  it('LAV2: the lavatory, the faucet and the carrier — the stop typed “Sink” no longer wins, and trim is left off by its name', () => {
    expect(of('lav2', [['ladena', 225], ['faucet', 582.87], ['supply', 4.48], ['grid', 18.41], ['trap', 29.73], ['stop', 15.04], ['flange', 0.37], ['b8236', 154.44]])).toBe('2215-0 LADENA WHITE + T25S51E#CP + B-8236')
    const pieces = productPiecesOf('lav2', seq('lav2', [['ladena', 225], ['supply', 4.48], ['grid', 18.41], ['trap', 29.73], ['stop', 15.04], ['flange', 0.37]]), bp, templates, moore)
    expect(pieces.map((p) => [p.key, p.trim])).toEqual([['lav2-0', false], ['lav2-1', true], ['lav2-2', true], ['lav2-3', true], ['lav2-4', true], ['lav2-5', true]])
  })

  it('WC 1&2 and UR 1&2: the china first and the flush valve beside it — price no longer picks the valve alone', () => {
    expect(of('wc', [['bowl', 267.3], ['fv', 730.92], ['seat', 15.6], ['carrier', 316.33]])).toBe('CT728CUVG#01 TORNADO FLUSH COMMERCIAL FLUSHOMETER WALL- MOUNTED TOILET + TET2UB31#SS + MAINLINE ML1055SSC000 WHT ELONG + ZURN Z1201-NR4-CL12-RYK17 NH DURA-COAT CI ADJ HORIZONTAL SIPHON JET EZCARRY W/RT HAND INLET')
    expect(of('ur', [['urinal', 414.15], ['ufv', 752.22]])).toBe('UT105UVG#01 + TEU2UA11#SS')
  })

  it('takeoff order, not array order; a trap primer is a valve; all-trim keeps its first line; bundles, makers and nothing at all', () => {
    const shuffled = [line({ id: 'b', countRowId: 'c', sequenceOrder: 2, partId: 'fv' }), line({ id: 'a', countRowId: 'c', sequenceOrder: 1, partId: 'bowl' })]
    expect(productPiecesOf('c', shuffled, bp, templates).map((p) => p.key)).toEqual(['a', 'b'])
    expect(of('fd', [['primer', 80]])).toBe('PPP PR-500 TRAP PRIMER')
    expect(of('st', [['stop', 15], ['supply', 4]])).toBe('BRASSCRA PLB113XP 1/2 NOM COMPX3/8 OD COMP W/LOOSEKEY ANG')
    expect(productFromPieces(productPiecesOf('c', [line({ countRowId: 'c', sourceTemplateId: 't-hs', unitPrice: 966 })], parts, templates), ['c:0']).product).toBe('HS - HAND SINK - SHIPLEY DO-NUTS')
    expect(of('wh', [])).toBeNull()
    const wh = productPiecesOf('wh', [line({ countRowId: 'wh', partId: 'p-wh', sourceMaterialPartPriceId: 'pr-2' })], parts, templates, houses)
    expect(productFromPieces(wh, defaultProductKeys(wh))).toEqual({ product: 'A.O. Smith BTH-199 WATER HEATER', partId: 'p-wh', houseId: 'h-moore', houseName: 'Moore Supply' })
    expect(productPiecesOf('c', [line({ countRowId: 'c', partId: 'unknown' })], parts, templates)).toEqual([])
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
      ['WC-1, WC-2', 'fixtures', true, 'TOTO CT708UVG#01 WALL HUNG BOWL + TOTO TET1LA FLUSH VALVE', 'Reece'],
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
    expect(candidateToItemInsert(wc, 'rev-1', 3)).toEqual({ submittal_id: 'rev-1', tag: 'WC-1, WC-2', sequence_order: 3, specified_description: 'WC 1&2', submitted_label: 'TOTO CT708UVG#01 WALL HUNG BOWL + TOTO TET1LA FLUSH VALVE', supply_house_id: 'h-reece', status: 'proposed', sheet_pages: [], source_count_row_id: 'c-wc' })
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
      ['WC-1', 3, 'TOTO CT708UVG#01 WALL HUNG BOWL + TOTO TET1LA FLUSH VALVE', 'h-reece', 'c-wc', 'proposed'],
      ['WC-2', 4, 'TOTO CT708UVG#01 WALL HUNG BOWL + TOTO TET1LA FLUSH VALVE', 'h-reece', 'c-wc', 'proposed'],
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

  it('v2.4292 · a stored choice of pieces wins, stale ids fall back to the rule, none on makes a row to type, and withProductKeys recomputes the house', () => {
    const lav = [line({ id: 'l1', countRowId: 'c-lav', sequenceOrder: 1, sourceTemplateId: 't-hs', unitPrice: 500 }), line({ id: 'l2', countRowId: 'c-lav', sequenceOrder: 2, partId: 'p-stop', unitPrice: 15, sourceMaterialPartPriceId: 'pr-1' })]
    const base = { countRows: [{ id: 'c-lav', fixture: 'LAV 1', count: 2 }], lines: lav, parts, templates, houses }
    const def = takeoffCandidates(base)[0]!
    expect(def).toMatchObject({ productKeys: ['l1'], storedProductKeys: null, product: 'HS - HAND SINK - SHIPLEY DO-NUTS', supplyHouseName: null })
    expect(def.pieces.map((p) => [p.key, p.trim])).toEqual([['l1', false], ['l2', true]])
    const both = takeoffCandidates({ ...base, productKeys: new Map([['c-lav', ['l1', 'l2']]]) })[0]!
    expect(both).toMatchObject({ productKeys: ['l1', 'l2'], product: 'HS - HAND SINK - SHIPLEY DO-NUTS + 1/2 ANGLE STOP', supplyHouseId: 'h-reece' })
    expect(takeoffCandidates({ ...base, productKeys: new Map([['c-lav', ['gone']]]) })[0]!.productKeys).toEqual(['l1'])
    const none = takeoffCandidates({ ...base, productKeys: new Map([['c-lav', []]]) })[0]!
    expect(none).toMatchObject({ productKeys: [], product: null, group: 'fixtures' })
    expect(candidateToItemInsert(none, 'rev-1', 1)).toMatchObject({ submitted_label: null, status: 'missing' })
    expect(withProductKeys(def, ['l2', 'l1'])).toMatchObject({ productKeys: ['l1', 'l2'], supplyHouseId: 'h-reece', supplyHouseName: 'Reece' })
  })
})
