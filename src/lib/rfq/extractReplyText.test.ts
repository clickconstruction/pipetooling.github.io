import { describe, expect, it } from 'vitest'

import { flattenSheetRows, parseCsv } from './extractReplyText'

describe('flattenSheetRows', () => {
  it('drops ext/total/amount columns so the parser cannot grab extended prices', () => {
    const { lines, droppedColumns } = flattenSheetRows([
      ['Item', 'Qty', 'Unit Price', 'Ext Price'],
      ['WC-1', 4, 185.5, 742.0],
      ['FCO', 5, 116, 580],
    ])
    expect(droppedColumns).toEqual(['Ext Price'])
    expect(lines[1]).toBe('WC-1  4  185.5')
    expect(lines[2]).toBe('FCO  5  116')
  })
  it('handles sheets with no header row (nothing dropped)', () => {
    const { lines, droppedColumns } = flattenSheetRows([
      ['WC-1', 185.5],
      [null, ''],
      ['FCO', 116],
    ])
    expect(droppedColumns).toEqual([])
    expect(lines).toEqual(['WC-1  185.5', 'FCO  116'])
  })
  it('drops "Total" and "Amount" variants too', () => {
    const { droppedColumns } = flattenSheetRows([
      ['Description', 'Each', 'Line Total', 'Net Amount'],
      ['GCO', 116, 232, 232],
    ])
    expect(droppedColumns).toEqual(['Line Total', 'Net Amount'])
  })
})

describe('parseCsv', () => {
  it('splits on commas/tabs/semicolons and honors quoted cells', () => {
    expect(parseCsv('a,b\t"c,d"\n"e""f",g')).toEqual([
      ['a', 'b', 'c,d'],
      ['e"f', 'g'],
    ])
  })
})
