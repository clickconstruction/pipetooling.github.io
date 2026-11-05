import type { GoogleGeocodeResult } from './googleGeocode.ts'
import type { CensusGeocodeResult } from './censusGeocode.ts'
import type { ParcelIdentifyResult } from './txParcelIdentify.ts'
import type { ParcelRecord } from './txParcelRecord.ts'
import { inUsPointBox } from './usPointBox.ts'
import { geocodePinHold, parcelSitusHold, type PinHold } from './parcelPinMatch.ts'

/**
 * The property lookup's ladder, one copy for `property-lookup` and
 * `owner-confirm-nightly` (v2.6520; before it each function carried its own):
 * a pin for the address, then the parcel under it, with the two gates of
 * `parcelPinMatch.ts` between.
 *
 * Google answers first when a key is set, because only Google says how well it
 * placed the address; a pin it could not put on the lot holds the lookup
 * before the roll is asked, and is not written to the geocode cache (the Map's
 * own geocode keeps its rule). The cache and the US Census follow as the
 * fallbacks, as before, when Google is unset or fails. A parcel whose situs
 * names another lot is held too, and nothing is filled from it.
 *
 * Every outside call comes in through `deps`, so a test drives the ladder with
 * recorded answers and no network.
 */

export type PinSource = 'google' | 'cache' | 'census'

export type ParcelPinLookupDeps = {
  /** The `address_geocodes` row for the normalized key, or null. */
  readCachedPoint: (key: string) => Promise<{ lat: number; lng: number } | null>
  /** Upsert the key's point into `address_geocodes`. */
  writeCachedPoint: (key: string, lat: number, lng: number) => Promise<void>
  /** null when no Google key is configured. */
  geocodeGoogle: ((display: string) => Promise<GoogleGeocodeResult>) | null
  geocodeCensus: (display: string) => Promise<CensusGeocodeResult>
  /** The parcel under a pin (`identifyParcel`). */
  identify: (lat: number, lng: number) => Promise<ParcelIdentifyResult>
  /** Ask Google once for the county when the roll has no parcel and the pin was not Google's (`property-lookup`'s county rung). */
  countyFromGoogleWhenNoParcel?: boolean
}

export type ParcelPinLookup =
  | {
      ok: true
      key: string
      lat: number
      lng: number
      pinSource: PinSource
      /** Google's county, '' when the pin came from the cache or the Census and the county rung was not asked. */
      countyGeocoder: string
      /** null when nothing sits under the pin, or the pin or the parcel was held. */
      parcel: ParcelRecord | null
      /** A parcel-service failure (timeout / HTTP); the county rung still answers. */
      parcelError?: string
      /** Why the pin or the parcel was not trusted; `parcel` is null with it. */
      hold?: PinHold
    }
  | { ok: false; key: string; error: 'not_found'; detail: string }

export function normalizeAddressKey(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase()
}

export async function lookupParcelForAddress(display: string, deps: ParcelPinLookupDeps): Promise<ParcelPinLookup> {
  const key = normalizeAddressKey(display)
  let lat: number | null = null
  let lng: number | null = null
  let source: PinSource | null = null
  let county = ''
  let googleDetail: string | undefined

  if (deps.geocodeGoogle) {
    const g = await deps.geocodeGoogle(display)
    if (g.ok) {
      county = g.county
      const hold = geocodePinHold(display, g)
      if (hold) {
        return { ok: true, key, lat: g.lat, lng: g.lng, pinSource: 'google', countyGeocoder: county, parcel: null, hold }
      }
      lat = g.lat
      lng = g.lng
      source = 'google'
      await deps.writeCachedPoint(key, lat, lng)
    } else {
      googleDetail = g.detail ? `Google: ${g.error} (${g.detail})` : `Google: ${g.error}`
    }
  }
  if (lat == null || lng == null) {
    const c = await deps.readCachedPoint(key)
    // A cached point outside the lower 48 reads as none and is asked again (v2.4975).
    if (c && inUsPointBox(c.lat, c.lng)) {
      lat = c.lat
      lng = c.lng
      source = 'cache'
    }
  }
  if (lat == null || lng == null) {
    const cz = await deps.geocodeCensus(display)
    if (cz.ok) {
      lat = cz.lat
      lng = cz.lng
      source = 'census'
    }
  }
  if (lat == null || lng == null || source == null) {
    return { ok: false, key, error: 'not_found', detail: [googleDetail, 'no match from US Census'].filter(Boolean).join('; ') }
  }

  const ident = await deps.identify(lat, lng)
  let parcel = ident.parcel
  let hold: PinHold | undefined
  if (parcel) {
    const h = parcelSitusHold(display, parcel)
    if (h) {
      hold = h
      parcel = null
    }
  }
  if (!parcel && county === '' && deps.countyFromGoogleWhenNoParcel && deps.geocodeGoogle && source !== 'google') {
    const g = await deps.geocodeGoogle(display)
    if (g.ok) county = g.county
  }
  return {
    ok: true,
    key,
    lat,
    lng,
    pinSource: source,
    countyGeocoder: county,
    parcel,
    ...(ident.error ? { parcelError: ident.error } : {}),
    ...(hold ? { hold } : {}),
  }
}
