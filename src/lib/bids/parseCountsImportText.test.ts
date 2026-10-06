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
      // v2.4188: the [Group] prefix is lifted into group_tag and taken off the name.
      { fixture: 'ft of 2in Copper', count: 148.5, group_tag: 'Rough-In', page: '1, 2', unit: 'ft' },
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

  it('treats CountTooling framed headings as structure, not rows (the D25 scope header)', () => {
    // A project named "2026 …" used to import as fixture "--- Counts" × 2026 via the comma split.
    const { rows, skippedCount } = parseCountsImportText(
      '--- Counts, 2026 BA03 Metrology Lab · every sheet · every layer ---\nFD-1\t2\t\t31\n--- Duct ---\n'
    )
    expect(rows).toEqual([{ fixture: 'FD-1', count: 2, group_tag: null, page: '31', unit: 'ea' }])
    expect(skippedCount).toBe(0)
  })

  it('still imports a fixture whose name merely starts with dashes', () => {
    const { rows } = parseCountsImportText('--- not a heading\t3')
    expect(rows).toHaveLength(1)
  })
})

describe('groups and alternates from CountTooling (v2.4188)', () => {
  it('lifts the [Group] prefix into group_tag and takes it off the fixture, in 3- and 4-column rows', () => {
    const { rows } = parseCountsImportText('[Restroom A] WC\t4\t2\n[Restroom A] ft of 2" PVC\t112.00\t2\n[LP-1 / 7] Duplex Receptacle\t2\t\tE2.1')
    expect(rows.map((r) => [r.fixture, r.group_tag, r.page, r.unit])).toEqual([
      ['WC', 'Restroom A', '2', 'ea'],
      ['ft of 2" PVC', 'Restroom A', '2', 'ft'],
      ['Duplex Receptacle', 'LP-1 / 7', 'E2.1', 'ea'],
    ])
  })

  it('an explicit 4-column group wins over the prefix; an empty bracket leaves the group null', () => {
    const { rows } = parseCountsImportText('[Old] WC\t4\tRiser 2\t2\n[] LAV\t3\t2')
    expect(rows.map((r) => [r.fixture, r.group_tag])).toEqual([['WC', 'Riser 2'], ['LAV', null]])
  })

  it('reads the --- Alternate: <name> --- block: its rows join the group, the name is reported once, a blank line ends it', () => {
    const text = [
      '--- Counts, Sunridge Dental · every sheet ---',
      '[Restroom A] WC\t4\t2',
      'WH\t1\t1',
      '',
      '--- Alternate: Break room ---',
      '[Break room] WC\t1\t3',
      'LAV\t1\t3',
      '',
      '--- Alternate: break room ---',
      '[Break room] ft of 2" PVC\t48.50\t3',
      '',
      'View link:\thttps://counttooling.com/app/?t=12345678-1234-1234-1234-123456789abc',
    ].join('\n')
    const out = parseCountsImportText(text)
    expect(out.alternateGroups).toEqual(['Break room'])
    expect(out.rows.map((r) => [r.fixture, r.group_tag])).toEqual([
      ['WC', 'Restroom A'],
      ['WH', null],
      ['WC', 'Break room'],
      ['LAV', 'Break room'],
      ['ft of 2" PVC', 'Break room'],
    ])
    expect(out.skippedCount).toBe(0)
    expect(out.sourceLink).toContain('t=12345678')
  })

  it('schedule blocks are structure — a water row is not a count, an alternate\'s water block names the same alternate', () => {
    const text = [
      'WC\t12\t1',
      '',
      '--- Alternate: Break room ---',
      '[Break room] WC\t1\t1',
      '',
      '--- Duct ---',
      "24×12\t24 ga\t70'\t6.94 lb/ft\t486 lb",
      'Bid weight\t\t\t\t1,804 lb',
      '',
      '--- Water sizing ---',
      'Cold main\t1″\t3 fixtures · 12 WSFU\t8.0 gpm\t5.1 fps\t✓',
      'Cold water total\t\t3 fixtures\t\t\t✓',
      '',
      '--- Alternate: Break room · Water sizing ---',
      'Break room cold\t¾″\t1 fixture · 4 WSFU\t4.0 gpm\t9.2 fps\t⚠ over 8 fps',
      'Sized at 8 fps cold / 5 fps hot, practice not code; public fixture units\t\t\t\t\t',
      '',
      'WH\t1\t2',
    ].join('\n')
    const { rows, skippedCount, alternateGroups } = parseCountsImportText(text)
    expect(rows.map((r) => [r.fixture, r.count, r.group_tag])).toEqual([['WC', 12, null], ['WC', 1, 'Break room'], ['WH', 1, null]])
    expect(skippedCount).toBe(0)
    expect(alternateGroups).toEqual(['Break room'])
  })

  it('a text with no alternate reports none', () => {
    expect(parseCountsImportText('WC\t4\t2').alternateGroups).toEqual([])
  })
})

describe('the scope heading (v2.4686)', () => {
  it('reads every sheet as the whole takeoff, another Counts heading as a part, none as unknown', () => {
    expect(parseCountsImportText('--- Counts, Elm Creek · every sheet · every layer ---\nWC\t4\t2').scope).toBe('all')
    expect(parseCountsImportText('--- Counts, Elm Creek · P-2 · every layer ---\nWC\t4\t2').scope).toBe('partial')
    expect(parseCountsImportText('WC\t4\t2').scope).toBe('unknown')
    expect(parseCountsImportText('--- Duct ---\nCold main\t1\n\nWC\t4\t2').scope).toBe('unknown')
  })
})
