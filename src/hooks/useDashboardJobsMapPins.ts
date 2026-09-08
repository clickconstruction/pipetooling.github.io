/**
 * Coordinates for the Dashboard "Your jobs on a map" card (v2.3131).
 *
 * Reads the shared `address_geocodes` cache for every job address (batched
 * like the Map page), then asks `geocode-address-batch` for the cold ones in
 * chunks of 20 — the same pair `useMapPageData` uses, without the Map page's
 * per-row progress table. Pins render as soon as the cache answers; cold
 * addresses fill in as each chunk returns. Nothing here is fatal: a failed
 * geocode leaves the job in the "no map location yet" line.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { batchGeocodeCacheKeys } from '../lib/map/geocodeCacheBatches'
import {
  dashboardJobsMapJobs,
  resolveDashboardJobsMapPins,
  type DashboardJobsMapJob,
  type DashboardJobsMapPin,
} from '../lib/dashboardJobsMap'
import type { DashboardTeamAssignedJobRow } from '../lib/dashboardTeamAssignedJobRow'

/** Matches `geocode-address-batch` MAX_ADDRESSES (and the Map page's chunking). */
const GEOCODE_BATCH_MAX = 20

type Coords = { lat: number; lng: number }
type GeocodeRow = { address_normalized: string; lat: number; lng: number }

export type DashboardJobsMapPinsState = {
  pins: DashboardJobsMapPin[]
  /** Jobs with an address the cache and the geocoder could not place (yet). */
  unmapped: DashboardJobsMapJob[]
  /** Jobs with no address at all — never sent to the geocoder. */
  noAddress: DashboardJobsMapJob[]
  /** True while the cache read or a geocode chunk is still in flight. */
  resolving: boolean
  /** Every job the card knows about, mapped or not. */
  total: number
}

export function useDashboardJobsMapPins(
  assignedJobs: readonly DashboardTeamAssignedJobRow[],
  superintendentJobs: readonly DashboardTeamAssignedJobRow[],
  enabled: boolean,
): DashboardJobsMapPinsState {
  const { jobs, noAddress } = useMemo(() => dashboardJobsMapJobs(assignedJobs, superintendentJobs), [assignedJobs, superintendentJobs])
  const [coords, setCoords] = useState<Map<string, Coords>>(() => new Map())
  const [resolving, setResolving] = useState(false)
  const genRef = useRef(0)
  // Keys we already asked the geocoder about this mount — a miss is not retried on every render.
  const askedRef = useRef<Set<string>>(new Set())

  const keysSignature = useMemo(() => [...new Set(jobs.map((j) => j.addressKey))].sort().join('\n'), [jobs])

  useEffect(() => {
    if (!enabled || keysSignature.length === 0) return
    const gen = ++genRef.current
    let cancelled = false
    const keys = keysSignature.split('\n')
    const displayByKey = new Map<string, string>()
    for (const j of jobs) if (!displayByKey.has(j.addressKey)) displayByKey.set(j.addressKey, j.address)

    void (async () => {
      setResolving(true)
      const known = new Map<string, Coords>()
      try {
        const cached = (
          await Promise.all(
            batchGeocodeCacheKeys(keys).map((batch) =>
              withSupabaseRetry<GeocodeRow[]>(
                async () => supabase.from('address_geocodes').select('address_normalized, lat, lng').in('address_normalized', batch),
                'dashboard jobs map address_geocodes',
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
          /* a failed chunk leaves its jobs unmapped; the next mount tries again */
        }
      }
      if (!cancelled && gen === genRef.current) setResolving(false)
    })()

    return () => {
      cancelled = true
    }
    // `jobs` changes only when the row lists do; the signature captures the keys that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, keysSignature])

  return useMemo(() => {
    const { pins, unmapped } = resolveDashboardJobsMapPins(jobs, coords)
    return { pins, unmapped, noAddress, resolving, total: jobs.length + noAddress.length }
  }, [jobs, noAddress, coords, resolving])
}
