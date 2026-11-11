import { describe, expect, it } from 'vitest'
import { shapeTwinSheet, twinSheetSaved } from '../../../../supabase/functions/_shared/priceSheetRows'

// Every fixture, number and price here is made up.
const SHEET = {
  number: 'Q-88213',
  dated_on: '2026-11-06',
  valid_until: '2026-12-06',
  fixtures: [
    {
      tag: 'SK-2',
      label: 'DUMP SINK (BAR) (OFCI)',
      each: 52.72,
      rows: [
        { qty: 1, house_code: '440118', description: 'MISC CHARGE', page: 4 },
        { qty: 1, house_code: '512207', description: 'AX8802XL-LR-PC ARLO SUPPLY KIT  1/2IPS X 3/8OD', page: 4 },
      ],
    },
    { tag: 'MS-1', label: 'MOP SINK', each: '313.27', rows: [{ qty: 2, house_code: '190442', description: '3/8 X 1-1/2 CLOSET BOLT BRASS', unit_price: 38.4, pricing_unit: 'per_hundred', page: 5 }] },
  ],
  loose: [{ house_code: '702291', description: 'NORDIC NW-2BL COOLER', unit_price: '1284.00' }],
}

describe('shapeTwinSheet', () => {
  it('shapes fixtures and rows as the database keeps them', () => {
    const res = shapeTwinSheet(SHEET)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.sheet.groups).toEqual([
      { group_no: 1, tag: 'SK-2', label: 'DUMP SINK (BAR) (OFCI)', each_price: 52.72 },
      { group_no: 2, tag: 'MS-1', label: 'MOP SINK', each_price: 313.27 },
    ])
    expect(res.sheet.lines.map((l) => [l.line_kind, l.group_no, l.house_code, l.unit_price, l.pricing_unit, l.page_no])).toEqual([
      ['charge', 1, '440118', null, 'each', 4],
      ['component', 1, '512207', null, 'each', 4],
      ['part', 2, '190442', 38.4, 'per_hundred', 5],
      ['part', null, '702291', 1284, 'each', null],
    ])
    // Spaces a quote wraps on are folded, and a row knows its fixture.
    expect(res.sheet.lines[1]).toMatchObject({ description: 'AX8802XL-LR-PC ARLO SUPPLY KIT 1/2IPS X 3/8OD', group_tag: 'SK-2', group_label: 'DUMP SINK (BAR) (OFCI)' })
    expect(res.sheet).toMatchObject({ number: 'Q-88213', dated_on: '2026-11-06', valid_until: '2026-12-06' })
  })

  it('names every problem with its place, and writes nothing', () => {
    const res = shapeTwinSheet({
      dated_on: 'Nov 6',
      fixtures: [
        { tag: '', rows: [{ description: '' }] },
        { tag: 'WC-1', each: -5, rows: [] },
        { tag: 'LAV-1', rows: [{ description: 'GRID DRAIN', unit_price: 'call', pricing_unit: 'dozen', qty: -1 }] },
      ],
    })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.problems).toEqual([
      'fixture 1: tag is required, the fixture\'s tag as the quote prints it',
      'fixture 1 row 1: description is required, as printed',
      'fixture 2 (WC-1): each must be the printed Subtotal EACH in dollars, or left out when none is printed',
      'fixture 2 (WC-1): rows is required, every row under the heading',
      'fixture 3 (LAV-1) row 1: pricing_unit "dozen" is not each, per_hundred or per_thousand',
      'fixture 3 (LAV-1) row 1: unit_price must be dollars as printed, zero or more, or left out for a row with no price of its own',
      'fixture 3 (LAV-1) row 1: qty must be a number, zero or more',
      'dated_on must be YYYY-MM-DD, the day the quote prints',
    ])
  })

  it('refuses a sheet with no row, and one past the limit', () => {
    expect(shapeTwinSheet({})).toEqual({ ok: false, problems: ['a sheet needs at least one row: fixtures with their rows, or loose rows'] })
    const big = shapeTwinSheet({ loose: Array.from({ length: 801 }, (_, i) => ({ description: `ROW ${i}` })) })
    expect(big.ok).toBe(false)
    if (!big.ok) expect(big.problems[0]).toBe('a sheet keeps 800 rows at most; this one has 801. Send it in two parts.')
  })
})

describe('twinSheetSaved', () => {
  it('tells the twin what was kept, and that nothing is filed', () => {
    const res = shapeTwinSheet(SHEET)
    if (!res.ok) throw new Error('the sheet should shape')
    expect(twinSheetSaved(res.sheet, 'Hillcrest Supply', false)).toMatchObject({ ok: true, house: 'Hillcrest Supply', fixtures: 2, rows: 4, rows_with_a_price: 2, charges: 1, filed: 0, replaced: false })
  })
})
