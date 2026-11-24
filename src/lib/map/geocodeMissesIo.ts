/**
 * Reads the addresses no map service could place (punch list #408).
 *
 * A screen that places addresses reads this beside the saved points in `address_geocodes` and sends
 * `geocode-address-batch` only an address that is in neither, so an address every service missed
 * is not asked again on every open. The rule, and how long a miss stands, is
 * `supabase/functions/_shared/geocodeMissMemory.ts`, the same file the functions run.
 *
 * Best effort, and it never throws: when the read fails the caller asks as before, and the function,
 * which reads the same memory, answers without asking a service.
 */
import { supabase } from '../supabase'
import { batchGeocodeCacheKeys } from './geocodeCacheBatches'
import { standingGeocodeMisses, type GeocodeMissRow } from '../../../supabase/functions/_shared/geocodeMissMemory'

/** The misses that still stand among `keys` (`normalizeAddressForGeocodeKey` of each address), by key. */
export async function readStandingGeocodeMisses(keys: readonly string[], now: Date = new Date()): Promise<Map<string, GeocodeMissRow>> {
  if (keys.length === 0) return new Map()
  try {
    const batches = await Promise.all(
      batchGeocodeCacheKeys([...keys]).map(async (batch) => {
        const { data, error } = await supabase.from('address_geocode_misses').select('address_normalized, error_code, detail, checked_at').in('address_normalized', batch)
        if (error) throw error
        return Array.isArray(data) ? (data as GeocodeMissRow[]) : []
      }),
    )
    return standingGeocodeMisses(batches.flat(), now)
  } catch {
    return new Map()
  }
}
