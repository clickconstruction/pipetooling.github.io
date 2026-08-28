import { describe, it, expect } from 'vitest'
import {
  buildBidRoomRevisionPayload,
  parseBidRoomRevisionPayload,
  roomBaseOption,
  roomHeaderBrandForServiceType,
} from './bidRoomPayload'

const section = (name: string, revenueSum: number, isAlternate = false, fixtureRows = [{ fixture: 'ft of 4IN WASTE', count: 537.27 }]) => ({
  name,
  isAlternate,
  revenueSum,
  fixtureRows,
})

const baseInput = {
  projectName: 'Game Show Battle Rooms',
  projectAddress: '123 Main St, San Antonio',
  gcName: 'NORTHSTAR CONSTRUCTION SERVICES',
  serviceTypeName: 'Plumbing',
  inclusions: 'All plumbing per plans.',
  exclusions: 'Fixtures by others.',
  terms: 'Net 30.',
}

describe('buildBidRoomRevisionPayload', () => {
  it('merges base sections into one pre-selected base option; alternates each stand alone', () => {
    const p = buildBidRoomRevisionPayload({
      ...baseInput,
      sections: [
        section('To Plans', 200000.5),
        section('Site work', 49970.79),
        section('Value Engineered', 97558.12, true),
      ],
    })!
    expect(p.options.map((o) => ({ key: o.key, name: o.name, is_base: o.is_base, total: o.total_cents }))).toEqual([
      { key: 'base', name: 'Base bid', is_base: true, total: 20000050 + 4997079 },
      { key: 'alt-1', name: 'Value Engineered', is_base: false, total: 9755812 },
    ])
    // base merges the fixture lists of every base section
    expect(p.options[0]!.fixture_rows).toHaveLength(2)
  })

  it('a single base section keeps its own name', () => {
    const p = buildBidRoomRevisionPayload({ ...baseInput, sections: [section('To Plans', 249971.29)] })!
    expect(p.options[0]!.name).toBe('To Plans')
  })

  it('unpriced sections are left off — same rule as the letter', () => {
    const p = buildBidRoomRevisionPayload({
      ...baseInput,
      sections: [section('To Plans', 249971.29), section('Unpriced alt', 0, true)],
    })!
    expect(p.options).toHaveLength(1)
  })

  it('no priced base → null (nothing to propose)', () => {
    expect(buildBidRoomRevisionPayload({ ...baseInput, sections: [section('VE only', 97558, true)] })).toBeNull()
    expect(buildBidRoomRevisionPayload({ ...baseInput, sections: [] })).toBeNull()
  })

  it('brands by service type', () => {
    expect(roomHeaderBrandForServiceType('Plumbing')).toBe('plum')
    expect(roomHeaderBrandForServiceType('Electrical')).toBe('elec')
    expect(roomHeaderBrandForServiceType('HVAC')).toBeNull()
  })
})

describe('parseBidRoomRevisionPayload', () => {
  it('round-trips a built payload', () => {
    const built = buildBidRoomRevisionPayload({
      ...baseInput,
      sections: [section('To Plans', 249971.29), section('VE', 97558.12, true)],
    })!
    expect(parseBidRoomRevisionPayload(JSON.parse(JSON.stringify(built)))).toEqual(built)
  })

  it('rejects junk, versionless, optionless, and baseless payloads', () => {
    expect(parseBidRoomRevisionPayload(null)).toBeNull()
    expect(parseBidRoomRevisionPayload({})).toBeNull()
    expect(parseBidRoomRevisionPayload({ v: 1, options: [] })).toBeNull()
    expect(
      parseBidRoomRevisionPayload({ v: 1, options: [{ key: 'alt-1', name: 'VE', is_base: false, total_cents: 1, fixture_rows: [] }] }),
    ).toBeNull()
  })

  it('drops unkeyed/duplicate options and coerces fixture rows', () => {
    const p = parseBidRoomRevisionPayload({
      v: 1,
      options: [
        { key: 'base', name: 'Base', is_base: true, total_cents: '100', fixture_rows: [{ fixture: 'WC-1', count: 3 }, null, { count: 2 }] },
        { key: 'base', name: 'dupe', is_base: true, total_cents: 5, fixture_rows: [] },
        { name: 'no key', is_base: false, total_cents: 5, fixture_rows: [] },
      ],
    })!
    expect(p.options).toHaveLength(1)
    expect(p.options[0]!.total_cents).toBe(100)
    expect(p.options[0]!.fixture_rows).toEqual([
      { fixture: 'WC-1', count: 3 },
      { fixture: '', count: 2 },
    ])
  })

  it('roomBaseOption returns the base', () => {
    const built = buildBidRoomRevisionPayload({ ...baseInput, sections: [section('To Plans', 1)] })!
    expect(roomBaseOption(built).key).toBe('base')
  })
})
