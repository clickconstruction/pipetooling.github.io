import { describe, expect, it } from 'vitest'
import { groupSupplyHouseStats, type SupplyHouseStatsRow } from './supplyHouseStats'

function row(p: Partial<SupplyHouseStatsRow>): SupplyHouseStatsRow {
  return {
    service_type_id: 'st-1',
    service_type_name: 'Plumbing',
    total_parts: 100,
    parts_with_prices: 80,
    parts_with_multiple_prices: 40,
    supply_house_id: 'sh-1',
    supply_house_name: 'Ferguson',
    price_count: 55,
    ...p,
  }
}

describe('groupSupplyHouseStats', () => {
  it('groups service types once and pivots price counts per supply house', () => {
    const result = groupSupplyHouseStats([
      row({}),
      row({ supply_house_id: 'sh-2', supply_house_name: 'Winsupply', price_count: 12 }),
      row({
        service_type_id: 'st-2', service_type_name: 'HVAC',
        total_parts: 10, parts_with_prices: 5, parts_with_multiple_prices: 1,
        price_count: 3,
      }),
    ])

    expect(result.serviceTypes).toEqual([
      { id: 'st-1', name: 'Plumbing', totalParts: 100, partsWithPrices: 80, partsWithMultiplePrices: 40 },
      { id: 'st-2', name: 'HVAC', totalParts: 10, partsWithPrices: 5, partsWithMultiplePrices: 1 },
    ])
    expect(result.supplyHouses).toEqual([
      { id: 'sh-1', name: 'Ferguson', pricesByServiceType: { 'st-1': 55, 'st-2': 3 } },
      { id: 'sh-2', name: 'Winsupply', pricesByServiceType: { 'st-1': 12 } },
    ])
  })

  it('keeps the FIRST row values for a duplicated service type (pre-extraction semantics)', () => {
    const result = groupSupplyHouseStats([
      row({ total_parts: 100 }),
      row({ total_parts: 999, supply_house_id: 'sh-2', supply_house_name: 'Winsupply' }),
    ])
    expect(result.serviceTypes).toHaveLength(1)
    expect(result.serviceTypes[0]?.totalParts).toBe(100)
  })

  it('returns empty groups for null/undefined/empty input', () => {
    expect(groupSupplyHouseStats(null)).toEqual({ serviceTypes: [], supplyHouses: [] })
    expect(groupSupplyHouseStats(undefined)).toEqual({ serviceTypes: [], supplyHouses: [] })
    expect(groupSupplyHouseStats([])).toEqual({ serviceTypes: [], supplyHouses: [] })
  })
})
