import { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeAddressForGeocodeKey } from '../lib/map/normalizeAddressForGeocode'
import { resolveOfficeAnchor } from '../lib/officeAddressSettings'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { readUserNames } from '../lib/developments/fetchDevelopmentPage'
import type { LatLng } from '../lib/jobTravelEstimate'
import type { PunchRow } from '../lib/trips/tripHourRows'
import type { TripDismissalInsert, TripDismissalRow } from '../lib/trips/tripOffers'
import { milesFromShop, tripsLookShows } from '../lib/trips/tripPlace'
import type { TripRecord, TripRosterPerson } from '../lib/trips/tripRecord'
import { deleteTrip, deleteTripDismissals, insertTripDismissals, readSiteDismissals, readSitePunches, readSiteTrips, readTripRoster, saveTrip } from '../lib/trips/tripsIo'
import { useAddressGeocodeCoords } from './useAddressGeocodeCoords'

/**
 * A development's trips on its page (punch list #379, PR 3). Three steps, each only when the one before
 * says it is worth it:
 *
 * 1. The trips themselves, and how far the site is from the shop. Both are small and decide whether the
 *    Trips look shows at all: a site with a trip, or a site far from the shop.
 * 2. Once the look shows, the roster and the punches on the site's jobs, which lay the clock's hours over
 *    the trips' days, and the days somebody said were Not a trip (PR 5), so Looks like a trip passes them over.
 * 3. Once the punches are in, the names of the logins on them that have no roster row, read once.
 *
 * `enabled` false reads nothing (a reader outside the office door). The io is injectable for tests.
 */
export type SiteTripsIo = {
  readTrips: (developmentId: string, jobIds: ReadonlyArray<string>) => Promise<TripRecord[]>
  readRoster: () => Promise<TripRosterPerson[]>
  readPunches: (jobIds: ReadonlyArray<string>) => Promise<PunchRow[]>
  readShop: () => Promise<LatLng | null>
  /** The days on the site somebody said were not a trip. */
  readDismissals: (developmentId: string) => Promise<TripDismissalRow[]>
  /** The names of logins, by user id. */
  readNames: (userIds: ReadonlyArray<string>) => Promise<Map<string, string>>
  /** Saves the trip whole; hands back the number the database gave it, when the reply names one. */
  save: (record: TripRecord) => Promise<number | null | void>
  remove: (id: string) => Promise<void>
  dismiss: (rows: ReadonlyArray<TripDismissalInsert>) => Promise<TripDismissalRow[]>
  undismiss: (ids: ReadonlyArray<string>) => Promise<void>
}

export const supabaseSiteTripsIo: SiteTripsIo = {
  readTrips: readSiteTrips,
  readRoster: readTripRoster,
  readPunches: readSitePunches,
  readShop: async () => {
    const anchor = await resolveOfficeAnchor()
    return anchor ? { lat: anchor.lat, lng: anchor.lng } : null
  },
  readDismissals: readSiteDismissals,
  // Called late, so a test that stands in for the page's fetch need not stand in for this name read.
  readNames: (userIds) => readUserNames(userIds),
  save: saveTrip,
  remove: deleteTrip,
  dismiss: insertTripDismissals,
  undismiss: deleteTripDismissals,
}

const NO_NAMES: ReadonlyMap<string, string> = new Map()

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
  /** The days somebody said were Not a trip; null while reading, or when they would not read, so nothing is offered twice. */
  dismissals: TripDismissalRow[] | null
  /** The names of the logins on the punches that have no roster row, by user id; empty until read. */
  names: ReadonlyMap<string, string>
  /** Ask for the roster before the look shows: the sheet for a site's first trip needs it. */
  askRoster: () => void
  reload: () => void
  save: (record: TripRecord) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Remember Not a trip, one row a person; the rows come back with their ids. */
  dismiss: (rows: ReadonlyArray<TripDismissalInsert>) => Promise<TripDismissalRow[]>
  /** Take a Not a trip back by its rows' ids. */
  undismiss: (ids: ReadonlyArray<string>) => Promise<void>
}

export function useSiteTrips({ developmentId, jobIds, address, enabled, io = supabaseSiteTripsIo }: { developmentId: string; jobIds: ReadonlyArray<string>; address: string | null; enabled: boolean; io?: SiteTripsIo }): SiteTripsState {
  const jobKey = useMemo(() => [...jobIds].sort().join(','), [jobIds])
  const [read, setRead] = useState<{ key: string; records: TripRecord[] } | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [shop, setShop] = useState<LatLng | null>(null)
  const [roster, setRoster] = useState<TripRosterPerson[] | null>(null)
  const [punchRead, setPunchRead] = useState<{ key: string; rows: PunchRow[] | null; failed: boolean } | null>(null)
  const [dismissRead, setDismissRead] = useState<{ key: string; rows: TripDismissalRow[] } | null>(null)
  const [names, setNames] = useState<ReadonlyMap<string, string>>(NO_NAMES)
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

  // Not a trip, by the site. A read that fails leaves it unknown, and the look then offers nothing.
  const dismissKey = shows ? developmentId : ''
  useEffect(() => {
    if (!dismissKey) return
    let live = true
    io.readDismissals(dismissKey).then(
      (rows) => live && setDismissRead({ key: dismissKey, rows }),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [dismissKey, io, gen])

  // The logins on the punches with no roster row: an offer names them, so their names are read once.
  const punchRows = punchRead && punchRead.key === punchKey ? punchRead.rows : null
  const namelessKey = useMemo(() => {
    if (!roster || !punchRows) return ''
    const onRoster = new Set(roster.map((r) => r.userId))
    return [...new Set(punchRows.map((p) => p.user_id).filter((id) => id && !onRoster.has(id)))].sort().join(',')
  }, [roster, punchRows])
  useEffect(() => {
    if (!namelessKey) return
    let live = true
    io.readNames(namelessKey.split(',')).then(
      (read) => live && setNames(read),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [namelessKey, io])

  const reload = useCallback(() => setGen((g) => g + 1), [])
  const askRoster = useCallback(() => setRosterWanted(true), [])
  const save = useCallback(
    async (record: TripRecord) => {
      const number = await io.save(record)
      // The database hands out the number: a new trip wears it at once, and the read that follows agrees.
      const kept = typeof number === 'number' ? { ...record, tripNumber: number } : record
      setRead((prev) => (prev ? { key: prev.key, records: [...prev.records.filter((r) => r.id !== record.id), kept] } : prev))
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

  const dismiss = useCallback(
    async (rows: ReadonlyArray<TripDismissalInsert>) => {
      const made = await io.dismiss(rows)
      setDismissRead((prev) => (prev ? { key: prev.key, rows: [...prev.rows, ...made] } : prev))
      return made
    },
    [io],
  )
  const undismiss = useCallback(
    async (ids: ReadonlyArray<string>) => {
      await io.undismiss(ids)
      setDismissRead((prev) => (prev ? { key: prev.key, rows: prev.rows.filter((r) => !ids.includes(r.id)) } : prev))
    },
    [io],
  )

  const punches = punchRead && punchRead.key === punchKey ? punchRead : null
  const dismissals = dismissRead && dismissRead.key === dismissKey ? dismissRead.rows : null
  return { records, failure, miles, sitePoint, sitePointKnown, shows, roster, punches: punches?.rows ?? (punchKey ? null : []), punchesFailed: !!punches?.failed, dismissals, names, askRoster, reload, save, remove, dismiss, undismiss }
}
