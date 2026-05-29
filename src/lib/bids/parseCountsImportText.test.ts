import { describe, expect, it } from 'vitest'
import { parseCountsImportText } from './parseCountsImportText'

describe('parseCountsImportText', () => {
  it('parses tab-delimited 4-column rows (fixture, count, group, page)', () => {
    const { rows, skippedCount } = parseCountsImportText('Toilet\t5\tBath\tA-101')
    expect(skippedCount).toBe(0)
    expect(rows).toEqual([{ fixture: 'Toilet', count: 5, group_tag: 'Bath', page: 'A-101' }])
  })

  it('parses comma-delimited rows', () => {
    const { rows } = parseCountsImportText('Sink,3,Kitchen,P-2')
    expect(rows).toEqual([{ fixture: 'Sink', count: 3, group_tag: 'Kitchen', page: 'P-2' }])
  })

  it('treats 3 columns as fixture, count, page (no group_tag)', () => {
    const { rows } = parseCountsImportText('Sink\t3\tP-2')
    expect(rows).toEqual([{ fixture: 'Sink', count: 3, group_tag: null, page: 'P-2' }])
  })

  it('handles a bare fixture + count (page null)', () => {
    const { rows } = parseCountsImportText('Sink\t3')
    expect(rows).toEqual([{ fixture: 'Sink', count: 3, group_tag: null, page: null }])
  })

  it('skips blank lines without counting them', () => {
    const { rows, skippedCount } = parseCountsImportText('Toilet\t5\n\n   \nSink\t2')
    expect(rows).toHaveLength(2)
    expect(skippedCount).toBe(0)
  })

  it('skips rows missing fixture or count', () => {
    const { rows, skippedCount } = parseCountsImportText('\t5\nToilet\t')
    expect(rows).toHaveLength(0)
    expect(skippedCount).toBe(2)
  })

  it('skips non-numeric and negative counts', () => {
    const { rows, skippedCount } = parseCountsImportText('Toilet\tabc\nSink\t-2\nTub\t4')
    expect(rows).toEqual([{ fixture: 'Tub', count: 4, group_tag: null, page: null }])
    expect(skippedCount).toBe(2)
  })

  it('accepts fractional counts and treats empty group/page as null', () => {
    const { rows } = parseCountsImportText('Pipe,2.5, ,')
    expect(rows).toEqual([{ fixture: 'Pipe', count: 2.5, group_tag: null, page: null }])
  })
})
