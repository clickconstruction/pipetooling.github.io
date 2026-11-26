/**
 * Clearing a kept address nothing is written under (punch list #443, row 9): the search, the counts and the delete.
 * The rule is `keptAddressClear.ts`.
 *
 * All of it runs as the signed-in person. The cache's own policy lets the map's roles delete; the block that calls
 * this is drawn for a dev alone. The sources are read through the untyped client on purpose: the list is data
 * (`KEPT_ADDRESS_SOURCES`), held to the generated types by its own test.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { KEPT_ADDRESS_SEARCH_LIMIT, KEPT_ADDRESS_SOURCES, keptAddressClearProblem, keptAddressLikePattern, keptAddressSearchPattern, type KeptAddressHits, type KeptAddressKind } from './keptAddressClear'

/** One kept address, as the block lists it: a point the map placed, or a miss (#443, row 16). */
export interface KeptAddress {
  /** The address as the cache keeps it: its key. */
  key: string
  /** When the map looked it up. */
  keptAtIso: string | null
  /** False for an address the map could not place. */
  placed: boolean
  /** Which table keeps it: `address_geocodes`, or `address_geocode_misses` for a miss. */
  kind: KeptAddressKind
}

/** The table a kind is kept in. */
export const KEPT_ADDRESS_TABLES: Readonly<Record<KeptAddressKind, 'address_geocodes' | 'address_geocode_misses'>> = { kept: 'address_geocodes', miss: 'address_geocode_misses' }

/**
 * The kept addresses and the kept misses whose words match, newest kept first, twenty of each at most. Throws when
 * either read fails.
 */
export async function searchKeptAddresses(typed: string): Promise<KeptAddress[]> {
  const pattern = keptAddressSearchPattern(typed)
  const [rows, misses] = await Promise.all([
    withSupabaseRetry(
      () => supabase.from('address_geocodes').select('address_normalized, geocoded_at, geocode_error').ilike('address_normalized', pattern).order('geocoded_at', { ascending: false }).limit(KEPT_ADDRESS_SEARCH_LIMIT),
      'read the kept addresses',
    ),
    withSupabaseRetry(
      () => supabase.from('address_geocode_misses').select('address_normalized, checked_at').ilike('address_normalized', pattern).order('checked_at', { ascending: false }).limit(KEPT_ADDRESS_SEARCH_LIMIT),
      'read the kept misses',
    ),
  ])
  return [
    ...(rows ?? []).map((r): KeptAddress => ({ key: r.address_normalized, keptAtIso: r.geocoded_at, placed: !r.geocode_error, kind: 'kept' })),
    ...(misses ?? []).map((m): KeptAddress => ({ key: m.address_normalized, keptAtIso: m.checked_at, placed: false, kind: 'miss' })),
  ]
}

/**
 * How many records hold the address's street line, source by source. Null when the address is too short to check.
 * Throws when any read fails or answers no count, so an address is never cleared on half an answer.
 */
export async function readKeptAddressHits(key: string, client: unknown = supabase): Promise<KeptAddressHits | null> {
  const pattern = keptAddressLikePattern(key)
  if (!pattern) return null
  const db = client as SupabaseClient
  return Promise.all(
    KEPT_ADDRESS_SOURCES.map(async (source) => {
      const result = await db.from(source.table).select(source.column, { count: 'exact' }).ilike(source.column, pattern).limit(1)
      if (result.error) throw result.error
      if (typeof result.count !== 'number') throw new Error('The records could not be read, so nobody knows what is written under this address. Nothing was cleared.')
      return { source, count: result.count }
    }),
  )
}

/**
 * Clear one kept address, or one kept miss (`kind: 'miss'`, #443 row 16: the table lets a dev delete since
 * 20261126024719). The records are read again here, right before the delete, and an address that fails the rule is
 * refused with its reason. The delete is sent once, and a delete that reaches no row is said.
 */
export async function clearKeptAddress(key: string, kind: KeptAddressKind = 'kept'): Promise<void> {
  const problem = keptAddressClearProblem(key, await readKeptAddressHits(key))
  if (problem) throw new Error(problem)
  const table = KEPT_ADDRESS_TABLES[kind]
  const gone = await withSupabaseRetry(() => supabase.from(table).delete().eq('address_normalized', key).select('address_normalized'), kind === 'miss' ? 'clear the kept miss' : 'clear the kept address', { maxRetries: 0 })
  if (!gone || gone.length === 0) throw new Error(kind === 'miss' ? 'The miss was not cleared. It may be gone already, or you may not have leave to clear it. Find it again.' : 'The address was not cleared. It may be gone already. Find it again.')
}
