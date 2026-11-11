/**
 * Looks like a customer (punch list #307): the reads behind the worklist on Builders and its
 * Needs you line. What is read once for every city, what is read for one, and one city counted
 * whole. The counting itself is `lookAlikeWorklist.ts`. No kernel logic here.
 */
import { loadAllNameAnswers, loadCustomerNames, loadPermitsByHouseNumber, loadRecentBidsWithCustomer } from './bidSiteIo'
import { numbersToAsk } from './bidSitePanel'
import { readLookAlikeCounts, rememberLookAlikeCount } from './lookAlikeCountMemory'
import { cityLookAlikes, freshLookAlikeCount, ourBids, settledNames, siteCountsInCity, sumCityLookAlikes, type CityLookAlikes, type LookAlikeNeed, type LookAlikeShared, type WorklistBid } from './lookAlikeWorklist'
import { readLastCity } from './permitCityDoors'
import { RESEARCH_CITIES } from './permitResearch'
import { loadBuilders } from './permitResearchIo'

/**
 * What every city's worklist stands on: the answers given, our customers by name, and the newest
 * thousand bids with a customer on them. Null before the answers table is on the database.
 */
export async function loadLookAlikeShared(): Promise<LookAlikeShared | null> {
  const answers = await loadAllNameAnswers()
  if (answers == null) return null
  const [customers, bids] = await Promise.all([loadCustomerNames(), loadRecentBidsWithCustomer()])
  return { answers: answers.rows, customers, bids }
}

/** The names on permits that sit on addresses we bid to each customer, in one city: one read by house number. */
export async function loadCitySiteCounts(city: string, bids: readonly WorklistBid[]): Promise<Map<string, Map<string, number>>> {
  const numbers = numbersToAsk(ourBids(bids), [city]).get(city) ?? []
  const permits = numbers.length > 0 ? ((await loadPermitsByHouseNumber(city, numbers)) ?? []) : []
  return siteCountsInCity(bids, city, permits)
}

/**
 * One city's count for the Needs you line: its Builders read and its site evidence, counted by
 * the function the chip uses. Null before Builders' read is on the database.
 */
export async function countCityLookAlikes(city: string, shared: LookAlikeShared, settled: ReadonlyMap<string, ReadonlySet<string>> = settledNames(shared.answers)): Promise<number | null> {
  const builders = await loadBuilders(city)
  if (builders == null) return null
  if (builders.length === 0) return 0
  return cityLookAlikes(shared, builders, await loadCitySiteCounts(city, shared.bids), settled).length
}

let reading: Promise<LookAlikeNeed | null> | null = null

/**
 * The Needs you line's count: every city's chip added up, or null when none wait and before the
 * answers table is on the database. A city counted in the last half hour is taken from this
 * browser's memory and not read; the rest are read one at a time, since Builders is a heavy read,
 * and a city that cannot be read is left out while the others are counted. Two askers at once
 * share one read.
 */
export function loadLookAlikeNeed(nowMs: number = Date.now()): Promise<LookAlikeNeed | null> {
  reading ??= countEveryCity(nowMs).finally(() => {
    reading = null
  })
  return reading
}

async function countEveryCity(nowMs: number): Promise<LookAlikeNeed | null> {
  const memory = readLookAlikeCounts()
  const rows: CityLookAlikes[] = []
  // Read only when a city needs counting: a Dashboard opened twice in half an hour reads nothing.
  let shared: LookAlikeShared | null | undefined
  let settled: Map<string, Set<string>> | undefined
  for (const city of RESEARCH_CITIES) {
    const kept = freshLookAlikeCount(memory, city, nowMs)
    if (kept != null) {
      rows.push({ city, count: kept })
      continue
    }
    if (shared === undefined) {
      shared = await loadLookAlikeShared()
      if (shared) settled = settledNames(shared.answers)
    }
    if (shared == null) return null
    try {
      const count = await countCityLookAlikes(city, shared, settled)
      if (count == null) continue
      rememberLookAlikeCount(city, count, nowMs)
      rows.push({ city, count })
    } catch {
      // One city that cannot be read does not hide the others.
    }
  }
  const need = sumCityLookAlikes(rows, readLastCity('') || null)
  return need.count > 0 ? need : null
}
