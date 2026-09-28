/**
 * Hourly wages for the Schedule Dispatch hub's Expected Manpower payroll column.
 *
 * `people_pay_config` is keyed by person NAME, not user id, so the hub asks for
 * the roster's names and then hands each roster id its wage. The match is the
 * trimmed name exactly as written — case matters, here and in the query.
 */

export type HubPayConfigWageRow = { person_name: string | null; hourly_wage: number | null }

/** The name `fetchUserNamesForIds` gives an id it could not name — never a person to look up. */
const UNKNOWN_PERSON_NAME = 'Unknown'

/** The roster's names to ask `people_pay_config` for: trimmed, one of each, in roster order. */
export function hubWageLookupNames(
  rosterIds: readonly string[],
  nameByUserId: ReadonlyMap<string, string>,
): string[] {
  const names = new Set<string>()
  for (const uid of rosterIds) {
    const raw = nameByUserId.get(uid)?.trim()
    if (raw && raw !== UNKNOWN_PERSON_NAME) names.add(raw)
  }
  return [...names]
}

/**
 * Every roster id → hourly wage. A person with no name, no pay row, or a wage
 * that is not a finite number gets 0; when two pay rows share a name the later
 * one wins.
 */
export function buildHourlyWageByUserId(
  rows: readonly HubPayConfigWageRow[],
  rosterIds: readonly string[],
  nameByUserId: ReadonlyMap<string, string>,
): Map<string, number> {
  const wageByName = new Map<string, number>()
  for (const r of rows) {
    const pn = r.person_name?.trim()
    if (!pn) continue
    const w = r.hourly_wage
    wageByName.set(pn, typeof w === 'number' && Number.isFinite(w) ? w : 0)
  }
  const wageByUserId = new Map<string, number>()
  for (const uid of rosterIds) {
    const nm = nameByUserId.get(uid)?.trim()
    wageByUserId.set(uid, nm ? (wageByName.get(nm) ?? 0) : 0)
  }
  return wageByUserId
}
