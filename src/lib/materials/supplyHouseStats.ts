/**
 * Pure grouping for the Parts Book supply-house stats header — extracted from
 * the loops inside `loadSupplyHouseStatsByServiceType` in Materials.tsx
 * (Stage A). Input rows come from the `get_supply_house_stats_by_service_type`
 * RPC; the caller keeps the RPC call and error handling.
 */

export type SupplyHouseStatsRow = {
  service_type_id: string
  service_type_name: string
  total_parts: number
  parts_with_prices: number
  parts_with_multiple_prices: number
  supply_house_id: string
  supply_house_name: string
  price_count: number
}

export type SupplyHouseStatsByServiceType = {
  serviceTypes: Array<{
    id: string
    name: string
    totalParts: number
    partsWithPrices: number
    partsWithMultiplePrices: number
  }>
  supplyHouses: Array<{
    id: string
    name: string
    pricesByServiceType: Record<string, number>
  }>
}

export function groupSupplyHouseStats(rows: SupplyHouseStatsRow[] | null | undefined): SupplyHouseStatsByServiceType {
  const input = rows ?? []

  // Group by service type
  const serviceTypeMap = new Map<string, SupplyHouseStatsByServiceType['serviceTypes'][number]>()

  // Group by supply house
  const supplyHouseMap = new Map<string, SupplyHouseStatsByServiceType['supplyHouses'][number]>()

  for (const row of input) {
    // Service type stats (same for all rows with same service_type_id)
    if (!serviceTypeMap.has(row.service_type_id)) {
      serviceTypeMap.set(row.service_type_id, {
        id: row.service_type_id,
        name: row.service_type_name,
        totalParts: row.total_parts,
        partsWithPrices: row.parts_with_prices,
        partsWithMultiplePrices: row.parts_with_multiple_prices,
      })
    }

    // Supply house prices
    if (!supplyHouseMap.has(row.supply_house_id)) {
      supplyHouseMap.set(row.supply_house_id, {
        id: row.supply_house_id,
        name: row.supply_house_name,
        pricesByServiceType: {},
      })
    }

    const sh = supplyHouseMap.get(row.supply_house_id)!
    sh.pricesByServiceType[row.service_type_id] = row.price_count
  }

  return {
    serviceTypes: Array.from(serviceTypeMap.values()),
    supplyHouses: Array.from(supplyHouseMap.values()),
  }
}
