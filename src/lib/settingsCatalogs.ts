/** Pure kernels for the Settings → Catalogs & trades engines.
 * Extracted from Settings.tsx (v2.855) so they can be unit-tested; no React / no I/O. */

/** Count takeoff-book entries per fixture type. An entry matches a fixture type when
 * its lowercase fixture_name equals the type's lowercase name, or the type's name is in
 * its lowercase alias_names. Every fixture-type id gets a key (0 when unmatched);
 * an entry counts toward at most the FIRST matching fixture type (find order). */
export function countTakeoffEntriesByFixtureType(
  entries: Array<{ fixture_name: string | null; alias_names: string[] | null }>,
  fixtureTypes: Array<{ id: string; name: string }>,
): Record<string, number> {
  const takeoffBookCounts: Record<string, number> = {}
  fixtureTypes.forEach(ft => takeoffBookCounts[ft.id] = 0)
  entries.forEach(row => {
    const fixtureName = (row.fixture_name ?? '').toLowerCase()
    const aliasNames = (row.alias_names ?? []).map((a: string) => a.toLowerCase())
    const matchingFixtureType = fixtureTypes.find(ft => {
      const ftName = ft.name.toLowerCase()
      return fixtureName === ftName || aliasNames.includes(ftName)
    })
    if (matchingFixtureType) {
      takeoffBookCounts[matchingFixtureType.id] = (takeoffBookCounts[matchingFixtureType.id] || 0) + 1
    }
  })
  return takeoffBookCounts
}

/** A material_part_prices row whose joined part and/or supply house no longer exists. */
export type OrphanedPriceRow = {
  id: string
  partId: string | null
  partName: string
  supplyHouseId: string | null
  supplyHouseName: string
  price: number
  effectiveDate: string | null
  reason: 'missing_part' | 'missing_supply_house' | 'both'
}

type MaterialPartPriceJoinRow = {
  id: string
  part_id?: string | null
  supply_house_id?: string | null
  price?: number | string | null
  effective_date?: string | null
  material_parts?: { id: string; name: string | null } | null
  supply_houses?: { id: string; name: string | null } | null
}

/** Classify material-price rows (with joined part/supply-house) into orphans.
 * Rows whose part AND supply house both resolve are dropped. */
export function classifyOrphanMaterialPrices(rows: MaterialPartPriceJoinRow[]): OrphanedPriceRow[] {
  return rows
    .map((row) => {
      const part = (row.material_parts ?? null) as { id: string; name: string | null } | null
      const sh = (row.supply_houses ?? null) as { id: string; name: string | null } | null
      const missingPart = !part
      const missingSupplyHouse = !sh
      if (!missingPart && !missingSupplyHouse) return null
      const reason: OrphanedPriceRow['reason'] =
        missingPart && missingSupplyHouse
          ? 'both'
          : missingPart
          ? 'missing_part'
          : 'missing_supply_house'
      return {
        id: row.id as string,
        partId: (row.part_id as string | null) ?? null,
        partName: part?.name ?? `Unknown part (${row.part_id ?? 'no id'})`,
        supplyHouseId: (row.supply_house_id as string | null) ?? null,
        supplyHouseName: sh?.name ?? `Unknown supply house (${row.supply_house_id ?? 'no id'})`,
        price: Number(row.price ?? 0),
        effectiveDate: (row.effective_date as string | null) ?? null,
        reason,
      } as OrphanedPriceRow
    })
    .filter((r): r is OrphanedPriceRow => r !== null)
}
