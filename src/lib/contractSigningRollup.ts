/** Row shape from `person_contract_documents` for Users tab signing rollup. */
export type PersonContractSigningRollupRow = {
  person_name: string
  contract_lineage_id: string
  lineage_version: number
  status: string
}

export type ContractSigningTrafficLight = 'green' | 'yellow' | 'red'

/**
 * One logical contract per lineage (latest `lineage_version` wins).
 * Red: none signed; yellow: some but not all; green: all signed.
 */
export function rollupContractSigningStatusByPersonName(
  rows: PersonContractSigningRollupRow[],
): Record<string, ContractSigningTrafficLight> {
  type Latest = { lineage_version: number; status: string }
  const byPerson = new Map<string, Map<string, Latest>>()

  for (const r of rows) {
    let lineages = byPerson.get(r.person_name)
    if (!lineages) {
      lineages = new Map()
      byPerson.set(r.person_name, lineages)
    }
    const lid = r.contract_lineage_id
    const existing = lineages.get(lid)
    const lv = r.lineage_version
    if (!existing || lv > existing.lineage_version) {
      lineages.set(lid, { lineage_version: lv, status: r.status })
    }
  }

  const map: Record<string, ContractSigningTrafficLight> = {}
  for (const [personName, lineages] of byPerson) {
    const latest = [...lineages.values()]
    if (latest.length === 0) continue
    let signedCount = 0
    for (const L of latest) {
      if (L.status === 'signed') signedCount++
    }
    const total = latest.length
    if (signedCount === 0) map[personName] = 'red'
    else if (signedCount === total) map[personName] = 'green'
    else map[personName] = 'yellow'
  }
  return map
}

export function contractSigningIconTitle(light: ContractSigningTrafficLight): string {
  switch (light) {
    case 'green':
      return 'All contracts signed'
    case 'yellow':
      return 'Some contracts signed'
    case 'red':
      return 'No contracts signed'
  }
}
