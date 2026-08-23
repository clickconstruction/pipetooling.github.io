import { describe, expect, it } from 'vitest'
import { parseCountsImportText } from './parseCountsImportText'

describe('parseCountsImportText', () => {
  it('parses tab-delimited 4-column rows (fixture, count, group, page)', () => {
    const { rows, skippedCount } = parseCountsImportText('Toilet\t5\tBath\tA-101')
    expect(skippedCount).toBe(0)
    expect(rows).toEqual([{ fixture: 'Toilet', count: 5, group_tag: 'Bath', page: 'A-101', unit: 'ea' }])
  })

  it('parses comma-delimited rows', () => {
    const { rows } = parseCountsImportText('Sink,3,Kitchen,P-2')
    expect(rows).toEqual([{ fixture: 'Sink', count: 3, group_tag: 'Kitchen', page: 'P-2', unit: 'ea' }])
  })

  it('treats 3 columns as fixture, count, page (no group_tag)', () => {
    const { rows } = parseCountsImportText('Sink\t3\tP-2')
    expect(rows).toEqual([{ fixture: 'Sink', count: 3, group_tag: null, page: 'P-2', unit: 'ea' }])
  })

  it('handles a bare fixture + count (page null)', () => {
    const { rows } = parseCountsImportText('Sink\t3')
    expect(rows).toEqual([{ fixture: 'Sink', count: 3, group_tag: null, page: null, unit: 'ea' }])
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
    expect(rows).toEqual([{ fixture: 'Tub', count: 4, group_tag: null, page: null, unit: 'ea' }])
    expect(skippedCount).toBe(2)
  })

  it('accepts fractional counts and treats empty group/page as null', () => {
    const { rows } = parseCountsImportText('Pipe,2.5, ,')
    expect(rows).toEqual([{ fixture: 'Pipe', count: 2.5, group_tag: null, page: null, unit: 'ea' }])
  })

  it('stamps the unit from the name convention', () => {
    const { rows } = parseCountsImportText('WC\t12\t1\nft of 2in Copper\t148.5\t1\npx of 1in Gas\t367\t2\n[Rough-In] ft of 4in PVC\t60\t3')
    expect(rows.map((r) => r.unit)).toEqual(['ea', 'ft', 'px', 'ft'])
  })

  it('returns sourceLink null when there is no footer (backward compatible)', () => {
    const { rows, skippedCount, sourceLink } = parseCountsImportText('Toilet\t5\nSink\t2')
    expect(rows).toHaveLength(2)
    expect(skippedCount).toBe(0)
    expect(sourceLink).toBeNull()
  })

  it('captures the CountTooling view link and excludes the footer from rows/skipped', () => {
    const payload =
      'Water Closet\t12\t1, 2, 3\n\n' +
      '[Rough-In] ft of 2in Copper\t148.50\t1, 2\n\n' +
      'ft of 4in PVC\t60.00\t3\n\n' +
      'View link:\thttps://counttooling.com/?t=8f3c2a4e-1b9d-4c77-a0e2-6d5b1f0a9e21'
    const { rows, skippedCount, sourceLink } = parseCountsImportText(payload)
    expect(sourceLink).toBe('https://counttooling.com/?t=8f3c2a4e-1b9d-4c77-a0e2-6d5b1f0a9e21')
    expect(skippedCount).toBe(0)
    expect(rows).toEqual([
      { fixture: 'Water Closet', count: 12, group_tag: null, page: '1, 2, 3', unit: 'ea' },
      { fixture: '[Rough-In] ft of 2in Copper', count: 148.5, group_tag: null, page: '1, 2', unit: 'ft' },
      { fixture: 'ft of 4in PVC', count: 60, group_tag: null, page: '3', unit: 'ft' },
    ])
  })

  it('matches the link by URL shape, not the label or position', () => {
    // No "View link:" label, link appears before the count rows.
    const { sourceLink, rows } = parseCountsImportText(
      'https://counttooling.com/?t=8f3c2a4e-1b9d-4c77-a0e2-6d5b1f0a9e21\nToilet\t5'
    )
    expect(sourceLink).toBe('https://counttooling.com/?t=8f3c2a4e-1b9d-4c77-a0e2-6d5b1f0a9e21')
    expect(rows).toEqual([{ fixture: 'Toilet', count: 5, group_tag: null, page: null, unit: 'ea' }])
  })

  it('matches the t= param in any query position and on any host (stored as-is)', () => {
    const ampForm = parseCountsImportText(
      'View link:\thttps://counttooling.com/?foo=bar&t=8f3c2a4e-1b9d-4c77-a0e2-6d5b1f0a9e21'
    )
    expect(ampForm.sourceLink).toBe('https://counttooling.com/?foo=bar&t=8f3c2a4e-1b9d-4c77-a0e2-6d5b1f0a9e21')

    const otherHost = parseCountsImportText(
      'View link:\thttps://example.com/x?t=8f3c2a4e-1b9d-4c77-a0e2-6d5b1f0a9e21'
    )
    expect(otherHost.sourceLink).toBe('https://example.com/x?t=8f3c2a4e-1b9d-4c77-a0e2-6d5b1f0a9e21')
  })

  it('does not count the footer line as a skipped row', () => {
    const { rows, skippedCount, sourceLink } = parseCountsImportText(
      'Toilet\t5\nView link:\thttps://counttooling.com/?t=8f3c2a4e-1b9d-4c77-a0e2-6d5b1f0a9e21'
    )
    expect(rows).toEqual([{ fixture: 'Toilet', count: 5, group_tag: null, page: null, unit: 'ea' }])
    expect(skippedCount).toBe(0)
    expect(sourceLink).toBe('https://counttooling.com/?t=8f3c2a4e-1b9d-4c77-a0e2-6d5b1f0a9e21')
  })
})
