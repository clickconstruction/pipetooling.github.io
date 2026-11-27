// @vitest-environment jsdom
/**
 * The split under a Workbench row adds to the row, to the cent (finding 346, punch list #46). The labor line is what
 * is left, on the screen too. Every name and figure is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { PricingSplitRows, type PricingSplitRowsProps } from './PricingSplitRows'
import { rowPriceSplit } from '../../lib/bids/rowPriceSplit'

afterEach(cleanup)

/** Dollars off a cell, in whole cents. A minus sign before the dollar sign makes it negative. */
const cents = (text: string) => {
  const m = /(−)?\$([\d,]+\.\d\d)/.exec(text)
  return m ? Math.round(Number(m[2]!.replace(/,/g, '')) * 100) * (m[1] ? -1 : 1) : null
}

function draw(over: { count: number; price: number; materialCost: number; laborCost: number; typedMaterial?: number }) {
  const s = rowPriceSplit({ price: over.price, materialCost: over.materialCost, markup: 0.5, taxPercent: 8.25, kind: 'fixture', typed: over.typedMaterial != null ? { material: over.typedMaterial } : null })
  const props: PricingSplitRowsProps = {
    r: { countRow: { id: 'cr-tub', fixture: 'ZZ Test tub' }, count: over.count, effRevenue: over.price, materialsBeforeTax: over.materialCost, laborCost: over.laborCost },
    s,
    taxPct: 8.25,
    materialMarkup: 0.5,
    wbMarkupDraft: null,
    setWbMarkupDraft: vi.fn(),
    commitRowMarkupText: vi.fn(),
    updateRowMarks: vi.fn(),
    priceCellStyle: { width: '6rem' },
    mColor: () => 'inherit',
  }
  const view = render(
    <table>
      <tbody>
        <PricingSplitRows {...props} />
      </tbody>
    </table>,
  )
  const lines = [...view.container.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')])
  // Columns: 3 cost a unit, 5 price a unit, 6 revenue, 7 profit. Material's price a unit is a box.
  const unit = lines.map((tds) => {
    const box = tds[5]!.querySelector('input') as HTMLInputElement | null
    return cents(box ? '$' + box.value : (tds[5]!.textContent ?? ''))
  })
  const revenue = lines.map((tds) => cents(tds[6]!.textContent ?? ''))
  const profit = lines.map((tds) => cents(tds[7]!.textContent ?? ''))
  return { unit, revenue, profit, text: lines.map((tds) => tds.map((td) => (td.textContent ?? '').trim())) }
}

const sum = (xs: Array<number | null>) => xs.reduce<number>((a, b) => a + (b ?? 0), 0)

describe('PricingSplitRows: the three lines add to the row', () => {
  it('the row that was walked: three at 5,600.00, with material a third of a cent off', () => {
    const d = draw({ count: 3, price: 16800, materialCost: 7754.61, laborCost: 300 })
    expect(d.unit).toEqual([387731, 31988, 140281])
    expect(sum(d.unit)).toBe(560000)
    expect(d.revenue).toEqual([1163191, 95963, 420846])
    expect(sum(d.revenue)).toBe(1680000)
    // Profit: the row's own, 16,800.00 less 7,754.61 of material, 639.76 of tax on it and 300.00 of labor.
    expect(sum(d.profit)).toBe(1680000 - 775461 - 63976 - 30000)
  })

  it('five at 1,500.00: the three profits add to the row\u2019s, where they read a cent under', () => {
    // Material 648.98 a unit, labor 87.03 a unit. The row's profit is 7,500.00 less 3,244.90, 267.70 and 435.15: 3,552.25.
    const d = draw({ count: 5, price: 7500, materialCost: 3244.9, laborCost: 435.15 })
    expect(d.revenue).toEqual([486735, 40156, 223109])
    expect(sum(d.revenue)).toBe(750000)
    // Rounded one at a time the labor line read 1,795.94 and the three added to 3,552.24.
    expect(d.profit).toEqual([162245, 13385, 179595])
    expect(sum(d.profit)).toBe(355225)
  })

  it('a row whose lines already add up reads as it did', () => {
    const d = draw({ count: 6, price: 4800, materialCost: 1200, laborCost: 600 })
    expect(d.unit).toEqual([30000, 2475, 47525])
    expect(d.revenue).toEqual([180000, 14850, 285150])
    expect(d.profit).toEqual([60000, 4950, 225150])
  })

  it('four at 500.00: the unit prices add to 500.00, where they read a cent over', () => {
    const d = draw({ count: 4, price: 2000, materialCost: 400, laborCost: 400 })
    expect(d.unit).toEqual([15000, 1238, 33762])
    expect(sum(d.unit)).toBe(50000)
    expect(d.revenue).toEqual([60000, 4950, 135050])
  })

  it('labor that goes under still adds to the row, and a row with no labor cost shows no labor profit', () => {
    const under = draw({ count: 6, price: 4800, materialCost: 1200, laborCost: 600, typedMaterial: 5000 })
    expect(sum(under.unit)).toBe(80000)
    expect(sum(under.revenue)).toBe(480000)
    expect(under.revenue[2]).toBe(-61250)
    const noLabor = draw({ count: 3, price: 16800, materialCost: 7754.61, laborCost: 0 })
    expect(noLabor.text[2]![7]).toBe('—')
    expect(sum(noLabor.revenue)).toBe(1680000)
  })
})
