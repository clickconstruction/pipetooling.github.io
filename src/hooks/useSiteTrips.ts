import { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeAddressForGeocodeKey } from '../lib/map/normalizeAddressForGeocode'
import { resolveOfficeAnchor } from '../lib/officeAddressSettings'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import type { LatLng } from '../lib/jobTravelEstimate'
import type { PunchRow } from '../lib/trips/tripHourRows'
import { milesFromShop, tripsLookShows } from '../lib/trips/tripPlace'
import type { TripRecord, TripRosterPerson } from '../lib/trips/tripRecord'
import { deleteTrip, readSitePunches, readSiteTrips, readTripRoster, saveTrip } from '../lib/trips/tripsIo'
import { useAddressGeocodeCoords } from './useAddressGeocodeCoords'

/**
 * A development's trips on its page (punch list #379, PR 3). Three steps, each only when the one before
 * says it is worth it:
 *
 * 1. The trips themselves, and how far the site is from the shop. Both are small and decide whether the
 *    Trips look shows at all: a site with a trip, or a site far from the shop.
 * 2. Once the look shows, the roster and the punches on the site's jobs, which lay the clock's hours over
 *    the trips' days.
 *
 * `enabled` false reads nothing (a reader outside the office door). The io is injectable for tests.
 */
export type SiteTripsIo = {
  readTrips: (developmentId: string, jobIds: ReadonlyArray<string>) => Promise<TripRecord[]>
  readRoster: () => Promise<TripRosterPerson[]>
  readPunches: (jobIds: ReadonlyArray<string>) => Promise<PunchRow[]>
  readShop: () => Promise<LatLng | null>
  save: (record: TripRecord) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const supabaseSiteTripsIo: SiteTripsIo = {
  readTrips: readSiteTrips,
  readRoster: readTripRoster,
  readPunches: readSitePunches,
  readShop: async () => {
    const anchor = await resolveOfficeAnchor()
    return anchor ? { lat: anchor.lat, lng: anchor.lng } : null
  },
  save: saveTrip,
  remove: deleteTrip,
}

export type SiteTripsState = {
  /** Null until the first read is in. */
  records: TripRecord[] | null
  failure: OfflineRecoveryLastError | null
  /** Straight-line miles from the shop; null while unknown or when either point is. */
  miles: number | null
  /** The site's point, for reading a punch against it; null while unknown. */
  sitePoint: LatLng | null
  /** True once the site's point has been asked for and answered, found or not. */
  sitePointKnown: boolean
  /** Whether the Trips look shows: a trip exists, or the site is far from the shop. False until the reads say so. */
  shows: boolean
  roster: TripRosterPerson[] | null
  /** The punches on the site's jobs; null while reading, and `punchesFailed` when they would not read. */
  punches: PunchRow[] | null
  punchesFailed: boolean
  /** Ask for the roster before the look shows: the sheet for a site's first trip needs it. */
  askRoster: () => void
  reload: () => void
  save: (record: TripRecord) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useSiteTrips({ developmentId, jobIds, address, enabled, io = supabaseSiteTripsIo }: { developmentId: string; jobIds: ReadonlyArray<string>; address: string | null; enabled: boolean; io?: SiteTripsIo }): SiteTripsState {
  const jobKey = useMemo(() => [...jobIds].sort().join(','), [jobIds])
  const [read, setRead] = useState<{ key: string; records: TripRecord[] } | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [shop, setShop] = useState<LatLng | null>(null)
  const [roster, setRoster] = useState<TripRosterPerson[] | null>(null)
  const [punchRead, setPunchRead] = useState<{ key: string; rows: PunchRow[] | null; failed: boolean } | null>(null)
  const [rosterWanted, setRosterWanted] = useState(false)
  const [gen, setGen] = useState(0)

  const readKey = enabled && developmentId ? `${developmentId}|${jobKey}` : ''
  useEffect(() => {
    if (!readKey) return
    let live = true
    io.readTrips(developmentId, jobKey ? jobKey.split(',') : []).then(
      (records) => {
        if (!live) return
        setRead({ key: readKey, records })
        setFailure(null)
      },
      (e: unknown) => live && setFailure(recoveryFailureFromError(e, 'The trips could not be read.')),
    )
    return () => {
      live = false
    }
  }, [readKey, developmentId, jobKey, io, gen])

  useEffect(() => {
    if (!enabled) return
    let live = true
    io.readShop().then(
      (p) => live && setShop(p),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [enabled, io])

  const addresses = useMemo(() => (address && address.trim() ? [{ key: normalizeAddressForGeocodeKey(address), display: address.trim() }] : []), [address])
  const geo = useAddressGeocodeCoords(addresses, enabled && addresses.length > 0, 'trips site point')
  const sitePoint = addresses[0] ? (geo.coords.get(addresses[0].key) ?? null) : null
  const sitePointKnown = addresses.length === 0 || !!sitePoint || !geo.resolving
  const miles = milesFromShop(shop, sitePoint)

  const records = read && read.key === readKey ? read.records : null
  const shows = !!records && tripsLookShows({ tripCount: records.length, miles })

  useEffect(() => {
    if (!(shows || rosterWanted) || roster) return
    let live = true
    io.readRoster().then(
      (r) => live && setRoster(r),
      () => live && setRoster([]),
    )
    return () => {
      live = false
    }
  }, [shows, rosterWanted, roster, io])

  const punchKey = shows ? jobKey : ''
  useEffect(() => {
    if (!punchKey) return
    let live = true
    io.readPunches(punchKey.split(',')).then(
      (rows) => live && setPunchRead({ key: punchKey, rows, failed: false }),
      () => live && setPunchRead({ key: punchKey, rows: null, failed: true }),
    )
    return () => {
      live = false
    }
  }, [punchKey, io, gen])

  const reload = useCallback(() => setGen((g) => g + 1), [])
  const askRoster = useCallback(() => setRosterWanted(true), [])
  const save = useCallback(
    async (record: TripRecord) => {
      await io.save(record)
      setRead((prev) => (prev ? { key: prev.key, records: [...prev.records.filter((r) => r.id !== record.id), record] } : prev))
      reload()
    },
    [io, reload],
  )
  const remove = useCallback(
    async (id: string) => {
      await io.remove(id)
      setRead((prev) => (prev ? { key: prev.key, records: prev.records.filter((r) => r.id !== id) } : prev))
    },
    [io],
  )

  const punches = punchRead && punchRead.key === punchKey ? punchRead : null
  return { records, failure, miles, sitePoint, sitePointKnown, shows, roster, punches: punches?.rows ?? (punchKey ? null : []), punchesFailed: !!punches?.failed, askRoster, reload, save, remove }
}
