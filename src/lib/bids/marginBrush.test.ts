// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import {
  brushChangedRows,
  brushPrevPrice,
  brushPriceFor,
  brushSweptMessage,
  brushUndoOf,
  draftsWithout,
  previewWithoutRows,
  workbenchRowIdAt,
  type BrushRow,
  type BrushTouch,
} from './marginBrush'

const row = (id: string, over: Partial<BrushRow> = {}): BrushRow => ({ countRow: { id }, cost: 600, count: 4, unitPrice: null, isFixedPrice: false, ...over })

describe('brushPriceFor', () => {
  it('prices a costed row at the margin, whole dollars per unit', () => {
    // 600 ÷ (1 − 0.40) ÷ 4 = 250
    expect(brushPriceFor(row('r1'), new Set(), 40)).toBe(250)
  })

  it('skips a row with no cost, a fixed price, a 📌, or no count', () => {
    expect(brushPriceFor(row('r1', { cost: 0 }), new Set(), 40)).toBeNull()
    expect(brushPriceFor(row('r1', { isFixedPrice: true }), new Set(), 40)).toBeNull()
    expect(brushPriceFor(row('r1'), new Set(['r1']), 40)).toBeNull()
    expect(brushPriceFor(row('r1', { count: 0 }), new Set(), 40)).toBeNull()
  })

  it('a pin on another row does not skip this one', () => {
    expect(brushPriceFor(row('r1'), new Set(['r2']), 40)).toBe(250)
  })
})

describe('brushPrevPrice', () => {
  it('is the saved price, and a missing or $0 price reads as none', () => {
    expect(brushPrevPrice({ unitPrice: 180 })).toBe(180)
    expect(brushPrevPrice({ unitPrice: null })).toBeNull()
    expect(brushPrevPrice({ unitPrice: 0 })).toBeNull()
  })
})

describe('brushChangedRows / brushUndoOf', () => {
  const stroke = new Map<string, BrushTouch>([
    ['r1', { prev: null, next: 250 }],
    ['r2', { prev: 250, next: 250 }],
    ['r3', { prev: 180, next: 250 }],
  ])

  it('a row already at the brushed price is not a change; order is the stroke’s', () => {
    expect(brushChangedRows(stroke).map(([id]) => id)).toEqual(['r1', 'r3'])
  })

  it('the undo is each changed row with the price it had before (null = was unpriced)', () => {
    expect(brushUndoOf(brushChangedRows(stroke))).toEqual([
      ['r1', null],
      ['r3', 180],
    ])
  })
})

describe('draftsWithout', () => {
  it('drops the named rows and leaves the rest, without touching the original', () => {
    const drafts = { r1: '250', r2: '90', r3: '12' }
    expect(draftsWithout(drafts, ['r1', 'r3', 'zz'])).toEqual({ r2: '90' })
    expect(drafts).toEqual({ r1: '250', r2: '90', r3: '12' })
  })
})

describe('previewWithoutRows', () => {
  it('takes the brushed rows out of the preview and its vetoes', () => {
    const out = previewWithoutRows({ r1: 250, r2: 90, r3: 12 }, new Set(['r1', 'r3']), ['r1'])
    expect(out).toEqual({ preview: { r2: 90, r3: 12 }, veto: new Set(['r3']), touched: true })
  })

  it('an emptied preview is null', () => {
    expect(previewWithoutRows({ r1: 250 }, new Set(), ['r1']).preview).toBeNull()
  })

  it('says nothing was touched when no brushed row was in the preview', () => {
    const out = previewWithoutRows({ r2: 90 }, new Set(['r2']), ['r1'])
    expect(out.touched).toBe(false)
    expect(out.preview).toEqual({ r2: 90 })
    expect(out.veto).toEqual(new Set(['r2']))
  })
})

describe('brushSweptMessage', () => {
  it('counts the rows and names the margin', () => {
    expect(brushSweptMessage(1, 40)).toBe('Swept 1 row at 40% — sweep again, or Esc puts the brush down.')
    expect(brushSweptMessage(3, 45)).toBe('Swept 3 rows at 45% — sweep again, or Esc puts the brush down.')
  })
})

describe('workbenchRowIdAt', () => {
  it('finds the Workbench row an element sits in, and nothing outside one', () => {
    const table = document.createElement('table')
    table.innerHTML = '<tbody><tr id="wb-row-r7"><td><span>cell</span></td></tr><tr id="other"><td>x</td></tr></tbody>'
    expect(workbenchRowIdAt(table.querySelector('span'))).toBe('r7')
    expect(workbenchRowIdAt(table.querySelector('#other td'))).toBeNull()
    expect(workbenchRowIdAt(null)).toBeNull()
  })
})
