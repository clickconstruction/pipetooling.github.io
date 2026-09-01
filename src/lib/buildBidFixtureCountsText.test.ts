import { describe, expect, it } from 'vitest'

import { buildBidFixtureCountsText, buildBidFixtureCountsTextGrouped } from './buildBidFixtureCountsText'

describe('buildBidFixtureCountsText', () => {
  it('formats the bid label, one line per row, and the item count', () => {
    const text = buildBidFixtureCountsText({
      bidLabel: 'BP375 SPACEX BA-02N Architectural',
      rows: [
        { fixture: 'WHA-300', count: 1 },
        { fixture: 'HB-3', count: 2 },
        { fixture: 'ft of 3/4IN WATER', count: 140.23 },
      ],
    })
    expect(text).toBe(
      [
        'Bid: BP375 SPACEX BA-02N Architectural',
        '',
        'WHA-300 — 1',
        'HB-3 — 2',
        'ft of 3/4IN WATER — 140.23',
        '',
        'Items: 3',
      ].join('\n'),
    )
  })

  it('appends the unit when the row carries one', () => {
    const text = buildBidFixtureCountsText({
      bidLabel: 'Bid',
      rows: [{ fixture: 'SEWER LINE', count: 148.62, unit: 'ft' }],
    })
    expect(text).toContain('SEWER LINE — 148.62 ft')
  })

  it('skips zero, negative, and non-finite counts', () => {
    const text = buildBidFixtureCountsText({
      bidLabel: 'Bid',
      rows: [
        { fixture: 'KEEP', count: 5 },
        { fixture: 'ZERO', count: 0 },
        { fixture: 'NEG', count: -2 },
        { fixture: 'NAN', count: Number.NaN },
      ],
    })
    expect(text).toContain('KEEP — 5')
    expect(text).not.toContain('ZERO')
    expect(text).not.toContain('NEG')
    expect(text).not.toContain('NAN')
    expect(text).toContain('Items: 1')
  })

  it('falls back to a dash for blank fixture names and trims whitespace', () => {
    const text = buildBidFixtureCountsText({
      bidLabel: 'Bid',
      rows: [
        { fixture: '   ', count: 1 },
        { fixture: '  WC-1  ', count: 2, unit: '  ' },
      ],
    })
    expect(text).toContain('— — 1')
    expect(text).toContain('WC-1 — 2')
    expect(text).not.toContain('WC-1 — 2 ')
  })

  it('emits only the bid line when no row is usable', () => {
    const text = buildBidFixtureCountsText({ bidLabel: 'BP001 Empty', rows: [] })
    expect(text).toBe('Bid: BP001 Empty')
  })

  it('grouped: sections in ascending code order, No code yet tail, same item count', () => {
    const codeByName = new Map<string, string | null>([
      ['WC-1', '22 42 13'],
      ['L-1', '22 42 16'],
      ['ft of 4IN WASTE', '22 13 16'],
      ['GPR-10', null],
      ['DEMO', null],
    ])
    const text = buildBidFixtureCountsTextGrouped({
      bidLabel: 'BP339 SAISD - DAVIS MS PHASE II',
      rows: [
        { fixture: 'WC-1', count: 4 },
        { fixture: 'L-1', count: 12 },
        { fixture: 'GPR-10', count: 1 },
        { fixture: 'ft of 4IN WASTE', count: 751.45 },
        { fixture: 'DEMO', count: 24 },
        { fixture: 'ZERO', count: 0 },
      ],
      sectionCodeForName: (name) => codeByName.get(name) ?? null,
      sectionTitleByCode: new Map([
        ['22 42 13', 'Commercial Water Closets and Urinals'],
        ['22 42 16', 'Commercial Lavatories and Sinks'],
        ['22 13 16', 'Sanitary Waste and Vent Piping'],
      ]),
    })
    expect(text).toBe(
      [
        'Bid: BP339 SAISD - DAVIS MS PHASE II',
        '',
        '22 13 16 · Sanitary Waste and Vent Piping',
        'ft of 4IN WASTE — 751.45',
        '',
        '22 42 13 · Commercial Water Closets and Urinals',
        'WC-1 — 4',
        '',
        '22 42 16 · Commercial Lavatories and Sinks',
        'L-1 — 12',
        '',
        'No code yet',
        'GPR-10 — 1',
        'DEMO — 24',
        '',
        'Items: 5',
      ].join('\n'),
    )
  })

  it('grouped: a code with no known title prints the code alone; all matched means no tail', () => {
    const text = buildBidFixtureCountsTextGrouped({
      bidLabel: 'Bid',
      rows: [{ fixture: 'WC-1', count: 2 }],
      sectionCodeForName: () => '22 42 13',
      sectionTitleByCode: new Map(),
    })
    expect(text).toContain('\n22 42 13\nWC-1 — 2')
    expect(text).not.toContain('No code yet')
  })

  it('grouped: emits only the bid line when no row is usable, and stays price-free', () => {
    expect(
      buildBidFixtureCountsTextGrouped({
        bidLabel: 'BP001 Empty',
        rows: [],
        sectionCodeForName: () => null,
        sectionTitleByCode: new Map(),
      }),
    ).toBe('Bid: BP001 Empty')
    const text = buildBidFixtureCountsTextGrouped({
      bidLabel: 'Bid',
      rows: [{ fixture: 'WC-1', count: 4 }],
      sectionCodeForName: () => '22 42 13',
      sectionTitleByCode: new Map(),
    })
    expect(text).not.toContain('$')
    expect(text.toLowerCase()).not.toMatch(/price|revenue|profit|margin|total:/)
  })

  it('never contains money — no dollar signs, totals, or price words', () => {
    const text = buildBidFixtureCountsText({
      bidLabel: 'BP375 SPACEX BA-02N Architectural',
      rows: [
        { fixture: 'WHA-300', count: 1 },
        { fixture: 'ft of 1IN WATER', count: 66.13 },
      ],
    })
    expect(text).not.toContain('$')
    expect(text.toLowerCase()).not.toMatch(/price|revenue|profit|margin|total:/)
  })
})
