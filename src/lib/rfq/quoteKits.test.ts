import { describe, expect, it } from 'vitest'

import { aggregateKit, describeKitBasis, expectedRoles, isStructured, splitTagHeading, tagsInCommon, type KitLineInput } from './quoteKits'

const money = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// The NWS S6277623 shape (SpaceX BA-2): three unpriced components under one
// EACH subtotal, and a carrier priced on a second sheet.
const NWS_WC: KitLineInput[] = [
  { id: 'n1', fixture: 'WC1&2', unitPriceEachCents: null, componentRole: 'bowl', label: 'TOTO CT728CUVG#01', pageRef: 'p. 2' },
  { id: 'n2', fixture: 'WC1&2', unitPriceEachCents: null, componentRole: 'flush_valve', label: 'TOTO TET2LBi31#SS', pageRef: 'p. 3' },
  { id: 'n3', fixture: 'WC1&2', unitPriceEachCents: null, componentRole: 'seat', label: 'TOTO SC534#01', pageRef: 'p. 3' },
  { id: 'n4', fixture: 'WC1&2', unitPriceEachCents: 101000, componentRole: 'kit', label: 'Subtotal — WC-1 & WC-2 EACH', pageRef: 'p. 3' },
  { id: 'n5', fixture: 'WC1&2', unitPriceEachCents: 33841, componentRole: 'carrier', label: 'Josam 12704/12714 vertical, no side inlets', pageRef: 'carrier sheet' },
]

// A house that quoted the fixture but never the carrier.
const OTHER_WC: KitLineInput[] = [
  { id: 'o1', fixture: 'WC1&2', unitPriceEachCents: 31090, componentRole: 'bowl', label: 'Kohler bowl' },
  { id: 'o2', fixture: 'WC1&2', unitPriceEachCents: 24400, componentRole: 'flush_valve', label: 'Sloan 111' },
  { id: 'o3', fixture: 'WC1&2', unitPriceEachCents: 3850, componentRole: 'seat', label: 'Bemis seat' },
]

describe('aggregateKit', () => {
  it('a plain single line is unchanged — today’s quotes keep their price', () => {
    const cell = aggregateKit([{ id: 'a', fixture: 'FD-1', unitPriceEachCents: 11057 }])
    expect(cell.basis).toBe('line')
    expect(cell.kitEachCents).toBe(11057)
    expect(cell.incomplete).toBe(false)
    expect(cell.needsChoice).toBeNull()
  })

  it('a kit subtotal plus a separately priced carrier prices the fixture as one $/each', () => {
    const expected = expectedRoles([NWS_WC, OTHER_WC])
    expect(expected).toEqual(['bowl', 'carrier', 'flush_valve', 'seat'])
    const cell = aggregateKit(NWS_WC, expected)
    expect(cell.basis).toBe('kit')
    expect(cell.kitEachCents).toBe(101000 + 33841)
    expect(cell.incomplete).toBe(false)
    expect(cell.missingRoles).toEqual([])
    // Unpriced components ride the kit subtotal.
    expect(cell.components.find((c) => c.role === 'bowl')?.inKit).toBe(true)
    expect(cell.components.find((c) => c.role === 'carrier')?.inKit).toBe(false)
    expect(describeKitBasis(cell, money)).toBe('$1,010.00 kit + carrier $338.41')
  })

  it('a house that skipped the carrier is incomplete and gets no $/each — never cheapest', () => {
    const expected = expectedRoles([NWS_WC, OTHER_WC])
    const cell = aggregateKit(OTHER_WC, expected)
    expect(cell.incomplete).toBe(true)
    expect(cell.missingRoles).toEqual(['carrier'])
    expect(cell.kitEachCents).toBeNull()
  })

  it('a rule can require a role no house quoted', () => {
    const expected = expectedRoles([OTHER_WC], ['carrier'])
    expect(expected).toContain('carrier')
    expect(aggregateKit(OTHER_WC, expected).missingRoles).toEqual(['carrier'])
  })

  it('unpriced components with no kit subtotal to ride are a hole', () => {
    const cell = aggregateKit([
      { id: 'x1', fixture: 'L-1', unitPriceEachCents: 21000, componentRole: 'bowl' },
      { id: 'x2', fixture: 'L-1', unitPriceEachCents: null, componentRole: 'faucet' },
    ])
    expect(cell.incomplete).toBe(true)
    expect(cell.kitEachCents).toBeNull()
  })

  it('size options with no choice are "needs a choice" with a range — never summed', () => {
    const rpz: KitLineInput[] = [
      { id: 'r1', fixture: 'RPZ', unitPriceEachCents: 286485, optionGroup: 'size', optionLabel: '2½in' },
      { id: 'r2', fixture: 'RPZ', unitPriceEachCents: 312182, optionGroup: 'size', optionLabel: '3in' },
      { id: 'r3', fixture: 'RPZ', unitPriceEachCents: 368009, optionGroup: 'size', optionLabel: '4in' },
      { id: 'r4', fixture: 'RPZ', unitPriceEachCents: 1452800, optionGroup: 'size', optionLabel: '10in' },
    ]
    const cell = aggregateKit(rpz)
    expect(cell.kitEachCents).toBeNull()
    expect(cell.needsChoice?.group).toBe('size')
    expect(cell.needsChoice?.options.map((o) => o.label)).toEqual(['2½in', '3in', '4in', '10in'])
    expect(cell.needsChoice?.minCents).toBe(286485)
    expect(cell.needsChoice?.maxCents).toBe(1452800)
  })

  it('a chosen option prices the fixture, and extra priced components add on', () => {
    const cell = aggregateKit([
      { id: 'r1', fixture: 'RPZ', unitPriceEachCents: 312182, optionGroup: 'size', optionLabel: '3in' },
      { id: 'r3', fixture: 'RPZ', unitPriceEachCents: 368009, optionGroup: 'size', optionLabel: '4in', optionChosen: true },
      { id: 'r9', fixture: 'RPZ', unitPriceEachCents: 5000, componentRole: 'accessory', label: 'test cocks' },
    ])
    expect(cell.basis).toBe('option')
    expect(cell.kitEachCents).toBe(368009 + 5000)
    expect(describeKitBasis(cell, money)).toBe('4in $3,680.09')
  })

  it('all lines can’t-supply → the cell can’t supply', () => {
    const cell = aggregateKit([
      { id: 'c1', fixture: 'FCO', unitPriceEachCents: null, cantSupply: true, componentRole: 'kit' },
    ])
    expect(cell.cantSupply).toBe(true)
    expect(cell.kitEachCents).toBeNull()
  })

  it('carries picked / reason / lot through from the lines', () => {
    const cell = aggregateKit([
      { id: 'k', fixture: 'UR-1', unitPriceEachCents: 110100, componentRole: 'kit', picked: true, pickReason: 'complete kit', lotId: 'lot-1', lotTotalCents: 110100 },
      { id: 'c', fixture: 'UR-1', unitPriceEachCents: 15693, componentRole: 'carrier' },
    ])
    expect(cell.picked).toBe(true)
    expect(cell.pickReason).toBe('complete kit')
    expect(cell.lotId).toBe('lot-1')
    expect(cell.kitEachCents).toBe(110100 + 15693)
  })
})

describe('isStructured', () => {
  it('is false for a lone plain line and true once roles, options, or several lines appear', () => {
    expect(isStructured([{ id: 'a', fixture: 'FD-1', unitPriceEachCents: 1 }])).toBe(false)
    expect(isStructured([{ id: 'a', fixture: 'FD-1', unitPriceEachCents: 1, componentRole: 'kit' }])).toBe(true)
    expect(isStructured(NWS_WC)).toBe(true)
  })
})

describe('splitTagHeading / tagsInCommon', () => {
  it('splits headings that cover several tags and drops the trailing words', () => {
    expect(splitTagHeading('WC-1 & WC-2 WATER CLOSET')).toEqual(['WC-1', 'WC-2'])
    expect(splitTagHeading('WC-1 & WC-2 (CARRIERS)')).toEqual(['WC-1', 'WC-2'])
    expect(splitTagHeading('RD-1 & RD-3')).toEqual(['RD-1', 'RD-3'])
    expect(splitTagHeading('FCO/CO')).toEqual(['FCO', 'CO'])
    expect(splitTagHeading('WC1&2')).toEqual(['WC-1', 'WC-2'])
    expect(splitTagHeading('LAV-1 LAVATORY')).toEqual(['LAV-1'])
    expect(splitTagHeading('UR-1 (CARRIER)')).toEqual(['UR-1'])
  })

  it('joins Wendi’s row names to the quote’s headings', () => {
    expect(tagsInCommon('WC1&2', 'WC-1 & WC-2 WATER CLOSET')).toEqual(['WC-1', 'WC-2'])
    expect(tagsInCommon('RD-3', 'RD-1 & RD-3')).toEqual(['RD-3'])
    expect(tagsInCommon('RPZ', 'RPZ-1 REDUCED PRESSURE ZONE')).toEqual(['RPZ-1'])
    expect(tagsInCommon('FCO', 'FCO/CO')).toEqual(['FCO'])
    expect(tagsInCommon('CO', 'FCO/CO')).toEqual(['CO'])
    expect(tagsInCommon('LAV-2', 'LAV-1 LAVATORY')).toEqual([])
  })
})
