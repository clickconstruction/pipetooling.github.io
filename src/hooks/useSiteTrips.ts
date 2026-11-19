import { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeAddressForGeocodeKey } from '../lib/map/normalizeAddressForGeocode'
import { resolveOfficeAnchor } from '../lib/officeAddressSettings'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { readUserNames } from '../lib/developments/fetchDevelopmentPage'
import type { LatLng } from '../lib/jobTravelEstimate'
import type { PunchRow } from '../lib/trips/tripHourRows'
import type { TripDismissalInsert, TripDismissalRow } from '../lib/trips/tripOffers'
import type { DeletedTrip } from '../lib/trips/tripDeleted'
import { milesFromShop, tripsLookShows, TRIP_FAR_MILES_DEFAULT } from '../lib/trips/tripPlace'
import type { TripRecord, TripRosterPerson } from '../lib/trips/tripRecord'
import { parseTripSplitReply, type TripSplitReply } from '../lib/trips/tripSplit'
import { parseTripJoinReply, type TripJoinReply } from '../lib/trips/tripJoin'
import { deleteTrip, deleteTripDismissals, insertTripDismissals, readDeletedTrips, readSiteDismissals, readSitePunches, readSiteTrips, readTripFarMiles, readTripRoster, joinTrip, saveTrip, splitTrip } from '../lib/trips/tripsIo'
import { useAddressGeocodeCoords } from './useAddressGeocodeCoords'

/**
 * A development's trips on its page (punch list #379, PR 3). Three steps, each only when the one before
 * says it is worth it:
 *
 * 1. The trips themselves, the site's deleted trips, and how far the site is from the shop. All are small and
 *    decide whether the Trips look shows at all: a site with a trip, kept or deleted, or a site far from the shop.
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
  /** How many miles from the shop makes a site a trip from home: the one setting. Absent, the default. */
  readFarMiles?: () => Promise<number>
  /** The days on the site somebody said were not a trip. */
  readDismissals: (developmentId: string) => Promise<TripDismissalRow[]>
  /** The site's deleted trips that nothing has put back, newest first. Absent, none is read. */
  readDeleted?: (developmentId: string) => Promise<DeletedTrip[]>
  /** The names of logins, by user id. */
  readNames: (userIds: ReadonlyArray<string>) => Promise<Map<string, string>>
  /** Saves the trip whole; hands back the number the database gave it, when the reply names one. */
  save: (record: TripRecord) => Promise<number | null | void>
  remove: (id: string) => Promise<void>
  /** Split a trip in two at a day; hands back the function's reply as it came. Absent, the screen cannot split. */
  split?: (id: string, fromDay: string) => Promise<unknown>
  /** Join a trip with the trip that went out next; hands back the function's reply as it came. Absent, the screen cannot join. */
  join?: (id: string, nextId: string) => Promise<unknown>
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
  readFarMiles: readTripFarMiles,
  readDismissals: readSiteDismissals,
  readDeleted: readDeletedTrips,
  // Called late, so a test that stands in for the page's fetch need not stand in for this name read.
  readNames: (userIds) => readUserNames(userIds),
  save: saveTrip,
  remove: deleteTrip,
  split: splitTrip,
  join: joinTrip,
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
  /** Whether the Trips look shows: a trip exists, kept or deleted, or the site is far from the shop. False until the reads say so. */
  shows: boolean
  /** The site's deleted trips that nothing has put back, newest first; empty until read. */
  deleted: DeletedTrip[]
  /** True once the deleted trips have been asked for and answered, read or not. */
  deletedKnown: boolean
  /** The deleted trips would not read. */
  deletedFailed: boolean
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
  /** Split a trip in two at a day, then read the site's trips again. Null when the reply names no second trip. */
  split: (id: string, fromDay: string) => Promise<TripSplitReply | null>
  /** Join a trip with the trip that went out next, then read the site's trips again. Null when the reply names no join. */
  join: (id: string, nextId: string) => Promise<TripJoinReply | null>
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
  const [farMiles, setFarMiles] = useState(TRIP_FAR_MILES_DEFAULT)
  const [roster, setRoster] = useState<TripRosterPerson[] | null>(null)
  const [punchRead, setPunchRead] = useState<{ key: string; rows: PunchRow[] | null; failed: boolean } | null>(null)
  const [dismissRead, setDismissRead] = useState<{ key: string; rows: TripDismissalRow[] } | null>(null)
  const [deletedRead, setDeletedRead] = useState<{ key: string; rows: DeletedTrip[]; failed: boolean } | null>(null)
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
    // The shop and the setting land together: the site's miles are unknown until both are in, so a site is never
    // called far by the default while the setting is still on its way.
    Promise.all([io.readShop(), io.readFarMiles ? io.readFarMiles().catch(() => TRIP_FAR_MILES_DEFAULT) : TRIP_FAR_MILES_DEFAULT]).then(
      ([p, far]) => {
        if (!live) return
        setFarMiles(far)
        setShop(p)
      },
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [enabled, io])

  // The site's deleted trips, beside the trips: a site whose only trip was deleted still shows its look, so the
  // trip can be put back. A read that fails leaves none, and says so.
  const deletedKey = enabled && developmentId && io.readDeleted ? developmentId : ''
  useEffect(() => {
    if (!deletedKey || !io.readDeleted) return
    let live = true
    io.readDeleted(deletedKey).then(
      (rows) => live && setDeletedRead({ key: deletedKey, rows, failed: false }),
      () => live && setDeletedRead({ key: deletedKey, rows: [], failed: true }),
    )
    return () => {
      live = false
    }
  }, [deletedKey, io, gen])

  const addresses = useMemo(() => (address && address.trim() ? [{ key: normalizeAddressForGeocodeKey(address), display: address.trim() }] : []), [address])
  const geo = useAddressGeocodeCoords(addresses, enabled && addresses.length > 0, 'trips site point')
  const sitePoint = addresses[0] ? (geo.coords.get(addresses[0].key) ?? null) : null
  const sitePointKnown = addresses.length === 0 || !!sitePoint || !geo.resolving
  const miles = milesFromShop(shop, sitePoint)

  const records = read && read.key === readKey ? read.records : null
  const deletedNow = deletedRead && deletedRead.key === deletedKey ? deletedRead : null
  // A trip that is back, or on its minute of Undo and saved again, is not also listed as deleted.
  const deleted = useMemo(() => (deletedNow && records ? deletedNow.rows.filter((d) => !records.some((r) => r.id === d.record.id)) : (deletedNow?.rows ?? [])), [deletedNow, records])
  const deletedKnown = !deletedKey || !!deletedNow
  const shows = !!records && tripsLookShows({ tripCount: records.length + deleted.length, miles, farMiles })

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
      // The deleted trips are read again, so the trip that just went is listed under them.
      reload()
    },
    [io, reload],
  )
  const split = useCallback(
    async (id: string, fromDay: string) => {
      if (!io.split) throw new Error('This screen cannot split a trip.')
      const reply = parseTripSplitReply(await io.split(id, fromDay))
      // Two trips now stand where one did: the site's trips are read again, and the new one arrives with its number.
      reload()
      return reply
    },
    [io, reload],
  )
  const join = useCallback(
    async (id: string, nextId: string) => {
      if (!io.join) throw new Error('This screen cannot join trips.')
      const reply = parseTripJoinReply(await io.join(id, nextId))
      // One trip now stands where two did: the next trip leaves the list at once, and the read that follows brings
      // the joined trip in with its days and the trip that went under Deleted trips.
      setRead((prev) => (prev ? { key: prev.key, records: prev.records.filter((r) => r.id !== nextId) } : prev))
      reload()
      return reply
    },
    [io, reload],
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
  return { records, failure, miles, sitePoint, sitePointKnown, shows, deleted, deletedKnown, deletedFailed: !!deletedNow?.failed, roster, punches: punches?.rows ?? (punchKey ? null : []), punchesFailed: !!punches?.failed, dismissals, names, askRoster, reload, save, remove, split, join, dismiss, undismiss }
}
