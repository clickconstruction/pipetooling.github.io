import { describe, expect, it } from 'vitest'
import { classifyOrphanMaterialPrices, countTakeoffEntriesByFixtureType } from './settingsCatalogs'

describe('countTakeoffEntriesByFixtureType', () => {
  const fixtureTypes = [
    { id: 'ft-toilet', name: 'Toilet' },
    { id: 'ft-sink', name: 'Sink' },
  ]

  it('initializes every fixture type to 0', () => {
    expect(countTakeoffEntriesByFixtureType([], fixtureTypes)).toEqual({ 'ft-toilet': 0, 'ft-sink': 0 })
  })

  it('matches by lowercase fixture_name', () => {
    const counts = countTakeoffEntriesByFixtureType(
      [
        { fixture_name: 'TOILET', alias_names: null },
        { fixture_name: 'toilet', alias_names: [] },
        { fixture_name: 'Sink', alias_names: null },
      ],
      fixtureTypes,
    )
    expect(counts).toEqual({ 'ft-toilet': 2, 'ft-sink': 1 })
  })

  it('matches when the fixture type name appears in alias_names (case-insensitive)', () => {
    const counts = countTakeoffEntriesByFixtureType(
      [{ fixture_name: 'WC', alias_names: ['Commode', 'TOILET'] }],
      fixtureTypes,
    )
    expect(counts['ft-toilet']).toBe(1)
  })

  it('leaves unmatched entries uncounted and handles null names', () => {
    const counts = countTakeoffEntriesByFixtureType(
      [{ fixture_name: null, alias_names: null }, { fixture_name: 'Urinal', alias_names: ['Latrine'] }],
      fixtureTypes,
    )
    expect(counts).toEqual({ 'ft-toilet': 0, 'ft-sink': 0 })
  })

  it('counts an entry toward only the first matching fixture type', () => {
    const counts = countTakeoffEntriesByFixtureType(
      [{ fixture_name: 'toilet', alias_names: ['sink'] }],
      fixtureTypes,
    )
    expect(counts).toEqual({ 'ft-toilet': 1, 'ft-sink': 0 })
  })
})

describe('classifyOrphanMaterialPrices', () => {
  const part = { id: 'p1', name: 'Copper elbow' }
  const sh = { id: 's1', name: 'Ferguson' }

  it('drops rows where both joins resolve', () => {
    expect(
      classifyOrphanMaterialPrices([{ id: 'r1', material_parts: part, supply_houses: sh, price: 3 }]),
    ).toEqual([])
  })

  it('classifies missing part / missing supply house / both', () => {
    const rows = classifyOrphanMaterialPrices([
      { id: 'r1', part_id: 'gone', material_parts: null, supply_houses: sh, price: 1.5, effective_date: '2026-01-01' },
      { id: 'r2', supply_house_id: 'gone', material_parts: part, supply_houses: null, price: '2.25' },
      { id: 'r3', material_parts: null, supply_houses: null },
    ])
    expect(rows.map((r) => r.reason)).toEqual(['missing_part', 'missing_supply_house', 'both'])
    expect(rows[0]).toMatchObject({
      partName: 'Unknown part (gone)',
      supplyHouseName: 'Ferguson',
      price: 1.5,
      effectiveDate: '2026-01-01',
    })
    expect(rows[1]).toMatchObject({ partName: 'Copper elbow', supplyHouseName: 'Unknown supply house (gone)', price: 2.25 })
    expect(rows[2]).toMatchObject({
      partName: 'Unknown part (no id)',
      supplyHouseName: 'Unknown supply house (no id)',
      price: 0,
      effectiveDate: null,
    })
  })
})
