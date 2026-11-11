/**
 * Looks like a customer (punch list #307, PR 10 and its Needs you line): what the worklist on
 * Builders stands on, and the one function that counts it. The chip on Builders and the line on
 * the Dashboard's Needs you card both call `cityLookAlikes`, so the two can never say different
 * numbers for a city. The Dashboard's words, the city its press opens and the memory that keeps
 * the Dashboard from reading every city on every open are here too. No React, no Supabase.
 */
import { ROBOT_BID_RE } from '../bids/bidPursuit'
import { permitsOnSite, readBidAddress, type BidSitePermit } from './bidSite'
import { foldNameAnswers, type NameAnswerRow } from './nameAnswers'
import { lookAlikePairs, type LookAlike, type PermitName } from './nameLikeness'
import { builderName, type BuilderRow } from './permitBuilders'

/** A bid as the worklist reads it: whose it is, where it is, and its name, to leave the robots' copies out. */
export type WorklistBid = { customer_id: string; address: string | null; project_name: string | null }
/** A permit as the site evidence reads it. */
export type WorklistPermit = Pick<BidSitePermit, 'id' | 'address'> & Partial<Pick<BidSitePermit, 'permit_number' | 'permit_type' | 'stage'>> & { builder_key: string | null }

/** What the worklist reads once for every city: our customers, the answers already given, and our bids. */
export type LookAlikeShared = { customers: ReadonlyArray<{ id: string; name: string }>; answers: readonly NameAnswerRow[]; bids: readonly WorklistBid[] }

/** The bids people priced: a robot's copy of a bid would count its site twice. */
export function ourBids<B extends WorklistBid>(bids: readonly B[]): B[] {
  return bids.filter((b) => !ROBOT_BID_RE.test(b.project_name ?? ''))
}

/** What each customer has settled, either way: a name tied to it or refused for it is never offered again. */
export function settledNames(answers: readonly NameAnswerRow[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const id of new Set(answers.map((r) => r.customer_id))) {
    const keys = [...foldNameAnswers(answers, [id]).values()].filter((s) => s.all || s.someoneElse).map((s) => s.key)
    if (keys.length > 0) out.set(id, new Set(keys))
  }
  return out
}

/**
 * The names on permits that sit on addresses we bid to each customer, in one city: customer id
 * to name key to how many permits. `permits` is the city's read by house number; which of them
 * sit on a bid's site is `bidSite.ts`'s call. One permit counts once for a customer.
 */
export function siteCountsInCity(bids: readonly WorklistBid[], city: string, permits: readonly WorklistPermit[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>()
  const seen = new Set<string>()
  for (const bid of ourBids(bids)) {
    const site = readBidAddress(bid.address, [city])
    if (site.kind !== 'site') continue
    for (const p of permitsOnSite(site, permits)) {
      if (!p.builder_key || seen.has(`${bid.customer_id}|${p.id}`)) continue
      seen.add(`${bid.customer_id}|${p.id}`)
      const m = out.get(bid.customer_id) ?? new Map<string, number>()
      m.set(p.builder_key, (m.get(p.builder_key) ?? 0) + 1)
      out.set(bid.customer_id, m)
    }
  }
  return out
}

/** Builders' rows as the likeness kernel reads a name on permits. */
export function permitNamesOf(builders: readonly BuilderRow[]): PermitName[] {
  return builders.map((r) => ({ key: r.key, name: builderName(r), permits: r.permits, lastOn: r.last_permit_on, kind: r.kind }))
}

/**
 * One city's worklist: every name on its Builders list that may be one of our customers, the
 * strongest reason first. Its length is the number on the chip, and the number the Dashboard
 * counts for the city.
 */
export function cityLookAlikes(shared: Pick<LookAlikeShared, 'customers'>, builders: readonly BuilderRow[], siteCounts: ReadonlyMap<string, ReadonlyMap<string, number>>, settled: ReadonlyMap<string, ReadonlySet<string>>): LookAlike[] {
  return lookAlikePairs(shared.customers, permitNamesOf(builders), siteCounts, settled)
}

// --- The Dashboard's Needs you line ----------------------------------------------------------

export type CityLookAlikes = { city: string; count: number }

/** What the Needs you line reads: the chips' numbers added up, each city that has some, and the city its press opens. */
export type LookAlikeNeed = { count: number; byCity: CityLookAlikes[]; city: string | null }

/**
 * Every city's chip as one: the sum, and each city that has some, the fullest first. The press
 * opens the city this browser last had on screen when it has some, else the fullest.
 */
export function sumCityLookAlikes(rows: readonly CityLookAlikes[], lastCity: string | null = null): LookAlikeNeed {
  const some = rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count || a.city.localeCompare(b.city))
  const own = some.find((r) => r.city === lastCity)
  return { count: some.reduce((n, r) => n + r.count, 0), byCity: some, city: (own ?? some[0])?.city ?? null }
}

/** The line's words: how many names, where when more than one city has some, and what a press does. Null when none wait. */
export function lookAlikeNudgeWords(count: number, byCity: readonly CityLookAlikes[] = []): { title: string; detail: string } | null {
  if (count <= 0) return null
  const title = count === 1 ? '1 name on permits looks like a customer' : `${count} names on permits look like a customer`
  const cities = byCity.filter((c) => c.count > 0)
  const where = cities.length > 1 ? `${cities.map((c) => `${c.city} ${c.count}`).join(' · ')}.` : ''
  return { title, detail: [where, 'Answer each once. Nothing is tied until you press.'].filter(Boolean).join(' ') }
}

// --- What the Dashboard remembers, so it does not read every city on every open ------------------

/** How long a city's count is taken as read. Saving an answer on a name forgets every count at once. */
export const LOOK_ALIKE_COUNT_FRESH_MS = 30 * 60 * 1000

/** A city's count with the moment it was counted, in milliseconds. */
export type LookAlikeCountMemory = Record<string, { count: number; at: number }>

/** The memory as kept, read back. Anything that is not a count with its moment is dropped. */
export function parseLookAlikeCounts(raw: string | null | undefined): LookAlikeCountMemory {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: LookAlikeCountMemory = {}
    for (const [city, v] of Object.entries(parsed as Record<string, unknown>)) {
      const row = v as { count?: unknown; at?: unknown } | null
      if (row && typeof row.count === 'number' && Number.isFinite(row.count) && row.count >= 0 && typeof row.at === 'number' && Number.isFinite(row.at)) out[city] = { count: row.count, at: row.at }
    }
    return out
  } catch {
    return {}
  }
}

/** A city's count while it is still fresh, else null: the city is read again. A count from the future is not trusted. */
export function freshLookAlikeCount(memory: LookAlikeCountMemory, city: string, nowMs: number, freshMs = LOOK_ALIKE_COUNT_FRESH_MS): number | null {
  const row = memory[city]
  if (!row || row.at > nowMs || nowMs - row.at >= freshMs) return null
  return row.count
}

/** The memory with one city counted now. */
export function withLookAlikeCount(memory: LookAlikeCountMemory, city: string, count: number, nowMs: number): LookAlikeCountMemory {
  return { ...memory, [city]: { count, at: nowMs } }
}
