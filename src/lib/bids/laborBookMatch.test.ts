import { describe, expect, it } from 'vitest'
import { entryAlreadyKnows, fixtureCodePrefix, laborBookEntriesForMatch, laborRowAnswered, laborRowPatchFromMatch, laborRowSource, laborRowsNeedingHours, matchLaborRow, matchLaborRows, type LaborBookMatchEntry } from './laborBookMatch'
import type { CostEstimateLaborRow, LaborBookEntryWithFixture } from './bidPricingEngineTypes'

// The Robot Default book as it stands in prod (2026-09-11), trimmed.
const each = { unit: 'each', kind: 'fixture' } as const
const book: LaborBookMatchEntry[] = [
  { id: 'e-toilet', name: 'Toilet', aliases: ['WC', 'Water closet', 'Toilets'], rough: 1, top: 1, trim: 1, ...each },
  { id: 'e-lav', name: 'Lavatory', aliases: ['LAV', 'Bathroom sinks'], rough: 0.5, top: 0.5, trim: 0.5, ...each },
  { id: 'e-wh', name: 'Water heater (electric)', aliases: ['WH', 'Water heaters (electric)'], rough: 1, top: 2, trim: 2, ...each },
  { id: 'e-fd', name: 'Floor drain', aliases: ['FD'], rough: 1.5, top: 0, trim: 0.5, ...each },
  { id: 'e-hb', name: 'Hose bib', aliases: ['HB', 'Hose bibs'], rough: 1, top: 0.5, trim: 1, ...each },
  { id: 'e-w12', name: '½" water', aliases: ['ft of 1/2IN WATER'], rough: 2.5, top: 1.5, trim: 0, unit: 'per_100ft', kind: 'fixture' },
  { id: 'e-saw', name: 'Sawcut & excavation', aliases: ['SAWCUT'], rough: 6, top: 0, trim: 0, unit: 'each', kind: 'task' },
]

const row = (id: string, fixture: string, hrs: [number, number, number] = [0, 0, 0], extra: Partial<CostEstimateLaborRow> = {}): CostEstimateLaborRow =>
  ({ id, cost_estimate_id: 'ce', fixture, count: 1, rough_in_hrs_per_unit: hrs[0], top_out_hrs_per_unit: hrs[1], trim_set_hrs_per_unit: hrs[2], is_fixed: false, kind: 'fixture', unit: 'each', source: null, source_note: null, sequence_order: 0, created_at: null, ...extra }) as CostEstimateLaborRow

describe('fixtureCodePrefix', () => {
  it('takes the letters at the front of a code only when a digit follows', () => {
    expect(fixtureCodePrefix('LAV2')).toBe('lav')
    expect(fixtureCodePrefix('WC 1&2')).toBe('wc')
    expect(fixtureCodePrefix('UR 1&2')).toBe('ur')
    expect(fixtureCodePrefix('WHA-500')).toBe('wha')
    expect(fixtureCodePrefix('EWC1')).toBe('ewc')
    expect(fixtureCodePrefix('HB-3')).toBe('hb')
  })
  it('leaves words, footage and one-letter codes alone', () => {
    expect(fixtureCodePrefix('Toilets')).toBeNull()
    expect(fixtureCodePrefix('ft of 3/4IN WATER')).toBeNull()
    expect(fixtureCodePrefix('12" DEEP MOP SINK')).toBeNull()
    expect(fixtureCodePrefix('A1')).toBeNull()
    expect(fixtureCodePrefix('')).toBeNull()
  })
})

describe('matchLaborRow', () => {
  it('exact name, then alias, then the code prefix — and says which', () => {
    expect(matchLaborRow('Toilet', book)).toMatchObject({ entry: { id: 'e-toilet' }, via: 'exact' })
    expect(matchLaborRow('  toilets ', book)).toMatchObject({ entry: { id: 'e-toilet' }, via: 'alias' })
    expect(matchLaborRow('WC 1&2', book)).toMatchObject({ entry: { id: 'e-toilet' }, via: 'prefix' })
    expect(matchLaborRow('LAV2', book)).toMatchObject({ entry: { id: 'e-lav' }, via: 'prefix' })
    expect(matchLaborRow('FD', book)).toMatchObject({ entry: { id: 'e-fd' }, via: 'alias' })
    expect(matchLaborRow('HB-3', book)).toMatchObject({ entry: { id: 'e-hb' }, via: 'prefix' })
  })
  it('does not guess: unknown codes, footage and empty text are null', () => {
    expect(matchLaborRow('WHA-500', book)).toBeNull()
    expect(matchLaborRow('ft of 3/4IN WATER', book)).toBeNull()
    expect(matchLaborRow('SAWCUTTING', book)).toBeNull() // 'SAWCUT' is an alias, not a prefix — no digit follows
    expect(matchLaborRow('', book)).toBeNull()
    expect(matchLaborRow(null, book)).toBeNull()
  })
  it('a name wins over an alias that happens to equal another entry\'s prefix', () => {
    const tricky: LaborBookMatchEntry[] = [...book, { id: 'e-wc-code', name: 'WC', aliases: [], rough: 9, top: 9, trim: 9, ...each }]
    expect(matchLaborRow('WC', tricky)).toMatchObject({ entry: { id: 'e-wc-code' }, via: 'exact' })
  })
})

describe('laborBookEntriesForMatch', () => {
  it('reads the joined fixture name, trims aliases, and defaults unit and kind; entries without a name drop', () => {
    const entries = [
      { id: 'a', fixture_types: { name: ' Toilet ' }, alias_names: [' WC ', ''], rough_in_hrs: 1, top_out_hrs: '2' as unknown as number, trim_set_hrs: null as unknown as number },
      { id: 'b', fixture_types: null, alias_names: ['orphan'], rough_in_hrs: 1, top_out_hrs: 1, trim_set_hrs: 1 },
      { id: 'c', fixture_types: { name: '2" waste' }, alias_names: [], rough_in_hrs: 4, top_out_hrs: 0, trim_set_hrs: 0, unit: 'per_100ft', kind: 'bogus' },
    ] as unknown as LaborBookEntryWithFixture[]
    expect(laborBookEntriesForMatch(entries)).toEqual([
      { id: 'a', name: 'Toilet', aliases: ['WC'], rough: 1, top: 2, trim: 0, unit: 'each', kind: 'fixture' },
      { id: 'c', name: '2" waste', aliases: [], rough: 4, top: 0, trim: 0, unit: 'per_100ft', kind: 'fixture' },
    ])
  })
})

describe('laborRowSource · laborRowsNeedingHours · entryAlreadyKnows', () => {
  const rows = [
    row('1', 'WC 1&2', [1, 1, 1]),
    row('2', 'LAV2', [0.75, 0.5, 0.5]),
    row('3', 'SAWCUTTING', [6, 0, 0]),
    row('4', 'WHA-500'),
    row('5', 'FD'),
    row('6', 'Ramirez excavation', [0, 0, 0], { kind: 'sub' }),
    row('7', 'HB-3', [1, 0.5, 1], { source: 'robot' }),
  ]
  const matches = matchLaborRows(rows, book)
  it('book when the hours equal the entry, edited when they differ, typed when unmatched, robot when the row says so, none at zero', () => {
    expect(laborRowSource(rows[0]!, matches.get('1'))).toBe('book')
    expect(laborRowSource(rows[1]!, matches.get('2'))).toBe('edited')
    expect(laborRowSource(rows[2]!, matches.get('3'))).toBe('typed')
    expect(laborRowSource(rows[3]!, matches.get('4'))).toBe('none')
    expect(laborRowSource(rows[4]!, matches.get('5'))).toBe('none')
    expect(laborRowSource(rows[6]!, matches.get('7'))).toBe('robot')
  })
  it('the queue is every zero row in sheet order, matched or not — a sub line is answered without hours', () => {
    expect(laborRowsNeedingHours(rows).map((r) => r.fixture)).toEqual(['WHA-500', 'FD'])
    expect(laborRowAnswered(rows[5]!)).toBe(true)
    expect(laborRowAnswered(rows[3]!)).toBe(false)
  })
  it('knows when an alias would be redundant', () => {
    expect(entryAlreadyKnows(book[0]!, 'wc')).toBe(true)
    expect(entryAlreadyKnows(book[0]!, 'Toilet')).toBe(true)
    expect(entryAlreadyKnows(book[0]!, 'WC 1&2')).toBe(false)
  })
})

describe('laborRowPatchFromMatch', () => {
  it('writes the hours, unit and kind of the entry, source book for a name match and alias otherwise, and a note naming the entry', () => {
    expect(laborRowPatchFromMatch(matchLaborRow('Toilet', book)!, 'Robot Default')).toEqual({
      rough_in_hrs_per_unit: 1, top_out_hrs_per_unit: 1, trim_set_hrs_per_unit: 1, unit: 'each', kind: 'fixture', is_fixed: false, source: 'book', source_note: 'Toilet · Robot Default',
    })
    expect(laborRowPatchFromMatch(matchLaborRow('WC 1&2', book)!)).toMatchObject({ source: 'alias', source_note: 'Toilet (by code)' })
    expect(laborRowPatchFromMatch(matchLaborRow('ft of 1/2IN WATER', book)!, 'Robot Default')).toMatchObject({ unit: 'per_100ft', kind: 'fixture', is_fixed: false, source: 'alias', source_note: '½" water · Robot Default (by alias)' })
  })
  it('a task entry makes a task row with fixed hours, whatever its unit', () => {
    expect(laborRowPatchFromMatch(matchLaborRow('SAWCUT', book)!)).toMatchObject({ kind: 'task', is_fixed: true, unit: 'each', rough_in_hrs_per_unit: 6 })
  })
})
