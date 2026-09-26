import { describe, expect, it } from 'vitest'
import { PRICES_ONLY, scenarioAssignments, scenarioCustomPriceMap, scenarioPackageRows, scenarioPricingRows, scenarioRevenue } from './scenarioPricingRows'

// Two bid versions (per-GC variants) with their own count rows — ids differ per version.
const rowsA = [
  { id: 'a-wc', fixture: 'Water closet', count: 10 },
  { id: 'a-lav', fixture: 'Lavatory', count: 4 },
]
const rowsB = [
  { id: 'b-wc', fixture: 'Water closet', count: 12 },
  { id: 'b-lav', fixture: 'Lavatory', count: 4 },
]
const entry = (id: string, versionId: string, name: string, total: number) => ({ id, version_id: versionId, total_price: total, fixture_types: { name } })
const assign = (pricing: string, row: string, entryId: string, extra: Partial<{ is_fixed_price: boolean | null; unit_price_override: number | null }> = {}) => ({
  price_book_version_id: pricing,
  count_row_id: row,
  price_book_entry_id: entryId,
  is_fixed_price: null,
  unit_price_override: null,
  ...extra,
})

const entries = [entry('e-a-wc', 'p-a', 'Water closet', 500), entry('e-a-lav', 'p-a', 'Lavatory', 300), entry('e-b-wc', 'p-b', 'Water closet', 450), entry('e-b-lav', 'p-b', 'Lavatory', 250)]
const assignments = [assign('p-a', 'a-wc', 'e-a-wc'), assign('p-a', 'a-lav', 'e-a-lav'), assign('p-b', 'b-wc', 'e-b-wc'), assign('p-b', 'b-lav', 'e-b-lav')]

describe('scenarioPricingRows', () => {
  it('prices the scenario on the rows it is given, from its own assignments and entries only', () => {
    const res = scenarioPricingRows({ scenarioId: 'p-a', countRows: rowsA, entries, assignments, customPrices: [] })
    expect(res.rows.map((r) => [r.countRow.id, r.unitPrice, r.revenue])).toEqual([
      ['a-wc', 500, 5000],
      ['a-lav', 300, 1200],
    ])
    expect(res.totalRevenue).toBe(6200)
  })

  it('an alternate ★ prices on ITS OWN count rows — the caller passes them; the on-screen rows give another number (v2.3685, v2.3841)', () => {
    const right = scenarioPricingRows({ scenarioId: 'p-b', countRows: rowsB, entries, assignments, customPrices: [] })
    expect(right.totalRevenue).toBe(12 * 450 + 4 * 250)
    // p-b's assignments name b-wc / b-lav; on rowsA none match, so the rows fall to the entries' fixture names — a different total, not the ★'s.
    const wrong = scenarioPricingRows({ scenarioId: 'p-b', countRows: rowsA, entries, assignments, customPrices: [] })
    expect(wrong.rows.every((r) => r.assignment === undefined)).toBe(true)
    expect(wrong.totalRevenue).not.toBe(right.totalRevenue)
  })

  it('a custom price fills a row with no assignment; another scenario’s custom price is ignored', () => {
    const res = scenarioPricingRows({
      scenarioId: 'p-b',
      countRows: [...rowsB, { id: 'b-hb', fixture: 'Hose bibb', count: 3 }],
      entries,
      assignments,
      customPrices: [
        { price_book_version_id: 'p-b', count_row_id: 'b-hb', unit_price: '90' },
        { price_book_version_id: 'p-a', count_row_id: 'b-hb', unit_price: 999 },
      ],
    })
    expect(res.rows.find((r) => r.countRow.id === 'b-hb')?.revenue).toBe(270)
    expect(res.totalRevenue).toBe(12 * 450 + 4 * 250 + 270)
  })

  it('an assignment’s unit-price override wins over the entry; a fixed price is one line, not per unit', () => {
    const res = scenarioPricingRows({
      scenarioId: 'p-a',
      countRows: rowsA,
      entries,
      assignments: [assign('p-a', 'a-wc', 'e-a-wc', { unit_price_override: 520 }), assign('p-a', 'a-lav', 'e-a-lav', { is_fixed_price: true, unit_price_override: 1000 })],
      customPrices: [],
    })
    const wc = res.rows.find((r) => r.countRow.id === 'a-wc')
    const lav = res.rows.find((r) => r.countRow.id === 'a-lav')
    expect(wc?.unitPrice).toBe(520)
    expect(wc?.revenue).toBe(5200)
    expect(lav?.isFixedPrice).toBe(true)
    expect(lav?.revenue).toBe(1000)
  })

  it('a hidden row is marked omitted and still counts in revenue; hides of another scenario do not apply', () => {
    const hides = [
      { bid_id: 'bid', price_book_version_id: 'p-a', count_row_id: 'a-lav' },
      { bid_id: 'bid', price_book_version_id: 'p-b', count_row_id: 'a-wc' },
    ] as never
    const res = scenarioPricingRows({ scenarioId: 'p-a', countRows: rowsA, entries, assignments, customPrices: [], hides })
    expect(res.rows.map((r) => [r.countRow.id, r.omitFromSubmissionDocuments])).toEqual([
      ['a-wc', false],
      ['a-lav', true],
    ])
    expect(res.totalRevenue).toBe(6200)
    expect(scenarioRevenue({ scenarioId: 'p-a', countRows: rowsA, entries, assignments, customPrices: [], hides })).toBe(6200)
  })

  it('entries loaded without a version_id (one scenario’s read) are all taken', () => {
    const own = entries.filter((e) => e.version_id === 'p-a').map(({ version_id: _v, ...e }) => e)
    const res = scenarioPricingRows({ scenarioId: 'p-a', countRows: rowsA, entries: own, assignments, customPrices: [] })
    expect(res.totalRevenue).toBe(6200)
  })

  it('prices only by default: no labor, no materials, no tax on any row', () => {
    const res = scenarioPricingRows({ scenarioId: 'p-a', countRows: rowsA, entries, assignments, customPrices: [] })
    expect(res.rows.every((r) => r.cost === 0 && r.laborHrs === 0 && r.materialsWithTax === 0)).toBe(true)
    expect(PRICES_ONLY.laborRate).toBe(0)
  })

  it('with costs, the grid’s cost side flows through the same rows', () => {
    const res = scenarioPricingRows({
      scenarioId: 'p-a',
      countRows: rowsA,
      entries,
      assignments,
      customPrices: [],
      costs: { ...PRICES_ONLY, taxPercent: 10, materialsFromTakeoffByCountRowId: { 'a-wc': 100 } },
    })
    const wc = res.rows.find((r) => r.countRow.id === 'a-wc')
    // materialsFromTakeoffByCountRowId is the row's total, taxed at the rate.
    expect(wc?.materialsBeforeTax).toBe(100)
    expect(wc?.materialsWithTax).toBeCloseTo(110, 6)
    expect(wc?.revenue).toBe(5000)
  })

  it('the package rows carry fixture, count, unit price, revenue and the omit flag, with the total', () => {
    const pkg = scenarioPackageRows(scenarioPricingRows({ scenarioId: 'p-a', countRows: rowsA, entries, assignments, customPrices: [] }))
    expect(pkg).toEqual({
      rows: [
        { fixture: 'Water closet', count: 10, unitPrice: 500, revenue: 5000, omitFromSubmissionDocuments: false },
        { fixture: 'Lavatory', count: 4, unitPrice: 300, revenue: 1200, omitFromSubmissionDocuments: false },
      ],
      totalRevenue: 6200,
    })
  })

  it('the two projections stand alone: the custom map and the assignments are the scenario’s own', () => {
    expect([...scenarioCustomPriceMap([{ price_book_version_id: 'p-a', count_row_id: 'x', unit_price: '12.5' }, { price_book_version_id: 'p-b', count_row_id: 'y', unit_price: 1 }], 'p-a')]).toEqual([['x', 12.5]])
    expect(scenarioAssignments(assignments, 'p-b')).toEqual([
      { count_row_id: 'b-wc', price_book_entry_id: 'e-b-wc', is_fixed_price: false, unit_price_override: null },
      { count_row_id: 'b-lav', price_book_entry_id: 'e-b-lav', is_fixed_price: false, unit_price_override: null },
    ])
  })
})
