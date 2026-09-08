/**
 * Coordinates for a list of addresses (v2.3162 — extracted from the Dashboard
 * jobs map hook so the Bid Board map can share it).
 *
 * Reads the shared `address_geocodes` cache for every key (batched like the
 * Map page), then asks `geocode-address-batch` for the cold ones in chunks of
 * 20 — the same pair `useMapPageData` uses, without the Map page's per-row
 * progress table. Callers paint as soon as the cache answers; cold addresses
 * fill in as each chunk returns. Nothing here is fatal: a failed geocode just
 * leaves its key out of the map, and a miss is not re-asked until the next
 * mount.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { batchGeocodeCacheKeys } from '../lib/map/geocodeCacheBatches'

/** Matches `geocode-address-batch` MAX_ADDRESSES (and the Map page's chunking). */
const GEOCODE_BATCH_MAX = 20

export type AddressCoords = { lat: number; lng: number }
type GeocodeRow = { address_normalized: string; lat: number; lng: number }

/** One address to place: `key` is `normalizeAddressForGeocodeKey(display)`. */
export type AddressToGeocode = { key: string; display: string }

export type AddressGeocodeCoordsState = {
  /** Coordinates by address key — grows as the cache and the geocoder answer. */
  coords: Map<string, AddressCoords>
  /** True while the cache read or a geocode chunk is still in flight. */
  resolving: boolean
}

export function useAddressGeocodeCoords(
  addresses: readonly AddressToGeocode[],
  enabled: boolean,
  logLabel = 'address_geocodes lookup',
): AddressGeocodeCoordsState {
  const [coords, setCoords] = useState<Map<string, AddressCoords>>(() => new Map())
  const [resolving, setResolving] = useState(false)
  const genRef = useRef(0)
  // Keys we already asked the geocoder about this mount — a miss is not retried on every render.
  const askedRef = useRef<Set<string>>(new Set())

  const keysSignature = useMemo(() => [...new Set(addresses.map((a) => a.key))].sort().join('\n'), [addresses])

  useEffect(() => {
    if (!enabled || keysSignature.length === 0) return
    const gen = ++genRef.current
    let cancelled = false
    const keys = keysSignature.split('\n')
    const displayByKey = new Map<string, string>()
    for (const a of addresses) if (!displayByKey.has(a.key)) displayByKey.set(a.key, a.display)

    void (async () => {
      setResolving(true)
      const known = new Map<string, AddressCoords>()
      try {
        const cached = (
          await Promise.all(
            batchGeocodeCacheKeys(keys).map((batch) =>
              withSupabaseRetry<GeocodeRow[]>(
                async () => supabase.from('address_geocodes').select('address_normalized, lat, lng').in('address_normalized', batch),
                logLabel,
              ),
            ),
          )
        ).flat()
        for (const c of cached) known.set(c.address_normalized, { lat: c.lat, lng: c.lng })
      } catch {
        /* the cache is best-effort; cold keys go to the geocoder below */
      }
      if (cancelled || gen !== genRef.current) return
      setCoords((prev) => {
        const next = new Map(prev)
        for (const [k, v] of known) next.set(k, v)
        return next
      })

      const cold = keys.filter((k) => !known.has(k) && !askedRef.current.has(k))
      for (let offset = 0; offset < cold.length; offset += GEOCODE_BATCH_MAX) {
        if (cancelled || gen !== genRef.current) return
        const chunk = cold.slice(offset, offset + GEOCODE_BATCH_MAX)
        for (const k of chunk) askedRef.current.add(k)
        try {
          const { data, error } = await supabase.functions.invoke<{ results?: GeocodeRow[] }>('geocode-address-batch', {
            body: { addresses: chunk.map((k) => displayByKey.get(k) ?? k) },
          })
          if (cancelled || gen !== genRef.current) return
          if (error || !data?.results?.length) continue
          const got = data.results
          setCoords((prev) => {
            const next = new Map(prev)
            for (const r of got) next.set(r.address_normalized, { lat: r.lat, lng: r.lng })
            return next
          })
        } catch {
          /* a failed chunk leaves its addresses unmapped; the next mount tries again */
        }
      }
      if (!cancelled && gen === genRef.current) setResolving(false)
    })()

    return () => {
      cancelled = true
    }
    // `addresses` changes with the caller's rows; the signature captures the keys that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, keysSignature])

  return useMemo(() => ({ coords, resolving }), [coords, resolving])
}
