import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'

/** Pacing between Google-only refresh calls (no Nominatim; light throttle). */
export const GOOGLE_ONLY_REFRESH_PACING_MS = 200

export type GeocodeOneOk = {
  ok: true
  address_normalized: string
  lat: number
  lng: number
  fromCache: boolean
  source?: 'cache' | 'nominatim' | 'google'
  refreshed?: true
}
export type GeocodeOneFail = { ok: false; address_normalized: string; error: string; detail?: string }
export type GeocodeOneResponse = GeocodeOneOk | GeocodeOneFail

/**
 * Rerun only Google (skip DB cache and Nominatim). Dev-only; same auth as `geocode-one` default.
 * Edge may return 200 with `{ ok: false, ... }` in the body; that is still `data` from invoke (no throw).
 */
export async function invokeGeocodeOneRefreshGoogleOnly(address: string): Promise<GeocodeOneResponse> {
  return withSupabaseRetry(
    async () =>
      supabase.functions.invoke<GeocodeOneResponse>('geocode-one', {
        body: { address, refresh_google_only: true },
      }),
    'geocode-one refresh google only'
  )
}
