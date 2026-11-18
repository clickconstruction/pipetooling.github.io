import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchSiteLabor } from '../lib/developments/fetchSiteLabor'
import { sharedAddressWords } from '../lib/developments/overview'
import type { SiteLabor } from '../lib/developments/siteLabor'
import { normalizeAddressForGeocodeKey } from '../lib/map/normalizeAddressForGeocode'
import { supabase } from '../lib/supabase'
import { jobClockTags, jobTripHours, jobTripsLine, type ClockTripTag, type JobPunchRow, type JobTripsHoursState, type JobTripsLine } from '../lib/trips/jobTrips'
import type { SiteTripHours } from '../lib/trips/tripHours'
import { tripPeopleIndex, type TripRecord, type TripRosterPerson } from '../lib/trips/tripRecord'
import { readSiteAddresses, readSitePunches, readSiteTrips, readTripRoster, saveTrip, type SiteAddresses } from '../lib/trips/tripsIo'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { useAddressGeocodeCoords } from './useAddressGeocodeCoords'

/**
 * A job's trips in the Job window (punch list #379, PR 6). Three steps, each only when the one before says
 * it is worth it, so a job on a site with no trip costs one small read and a job with no development costs none:
 *
 * 1. The site's trips (`readSiteTrips`), for the office door and a job that is in a development. They are few.
 * 2. Once the site has a trip: the roster, the clock's rows on this job with the places they carry, and the
 *    site's point. The point is the Trips look's own: the address the site's jobs and bids share
 *    (`sharedAddressWords` over two small reads by the development), so a job's bar and the look's figures
 *    cannot differ on a site whose jobs sit at different addresses. Only when that read gives nothing is the
 *    job's own address used. These give each clock line in the feed its tag.
 * 3. Once a trip names this job, so the line shows: the job's hours by person and day (`fetchSiteLabor`, the
 *    Development page's own read, asked for this one job), laid over the trips for the bar.
 *
 * `enabled` false, no job or no development reads nothing. Nothing here changes a clock row. The io is
 * injectable for tests.
 */
export type JobTripsIo = {
  readTrips: (developmentId: string, jobIds: ReadonlyArray<string>) => Promise<TripRecord[]>
  readRoster: () => Promise<TripRosterPerson[]>
  readPunches: (jobIds: ReadonlyArray<string>) => Promise<JobPunchRow[]>
  /** The addresses on the development's jobs and bids, for the address they share. */
  readSiteAddresses: (developmentId: string) => Promise<SiteAddresses>
  readLabor: (jobIds: ReadonlyArray<string>) => Promise<SiteLabor>
  /** Saves the trip whole; hands back the number the database gave it, when the reply names one. */
  save: (record: TripRecord) => Promise<number | null | void>
}

export const supabaseJobTripsIo: JobTripsIo = {
  readTrips: readSiteTrips,
  readRoster: readTripRoster,
  // The read asks for each row's id (`PUNCH_COLUMNS`), which is how the feed names the same row.
  readPunches: async (jobIds) => (await readSitePunches(jobIds)) as JobPunchRow[],
  readSiteAddresses,
  readLabor: (jobIds) => fetchSiteLabor(supabase, jobIds),
  save: saveTrip,
}

const NO_TAGS: ReadonlyMap<string, ClockTripTag> = new Map()

export type JobTripsState = {
  /** The site's trips; null until read, and for a reader or a job that reads none. */
  records: TripRecord[] | null
  /** What the job says about its trips; null on a job no trip names, which draws nothing. */
  line: JobTripsLine | null
  /** The job's hours in the five figures; null until read, and when they cannot be laid over the trips. */
  hours: SiteTripHours | null
  hoursState: JobTripsHoursState
  /** True when the site's address has no point, so no punch can be checked against the site. */
  noSitePoint: boolean
  /** A tag for each clock line of the feed, by the feed's key; empty on a site with no trip. */
  clockTags: ReadonlyMap<string, ClockTripTag>
  /** The roster for the sheet's Who went; null while it is being read. */
  roster: TripRosterPerson[] | null
  save: (record: TripRecord) => Promise<void>
}

export function useJobTrips({
  jobId,
  developmentId,
  address,
  enabled,
  todayYmd,
  io = supabaseJobTripsIo,
}: {
  jobId: string | null
  /** The job's development; null for a job that has none, which reads nothing. */
  developmentId: string | null
  /** The job's own address: what a punch is read against only when the site's jobs and bids give no shared address. */
  address: string | null
  /** The office door only. */
  enabled: boolean
  /** Today in the company's calendar; read when the line is made, for tests to set. */
  todayYmd?: string
  io?: JobTripsIo
}): JobTripsState {
  const [read, setRead] = useState<{ key: string; records: TripRecord[] } | null>(null)
  const [roster, setRoster] = useState<TripRosterPerson[] | null>(null)
  const [punchRead, setPunchRead] = useState<{ key: string; rows: JobPunchRow[] | null } | null>(null)
  const [laborRead, setLaborRead] = useState<{ key: string; labor: SiteLabor | null } | null>(null)
  const [addressRead, setAddressRead] = useState<{ key: string; shared: string | null } | null>(null)
  const [gen, setGen] = useState(0)

  const readKey = enabled && jobId && developmentId ? `${developmentId}|${jobId}` : ''
  useEffect(() => {
    if (!readKey || !jobId || !developmentId) return
    let live = true
    // A read that fails leaves the trips unknown, and the Job window then draws as it always has.
    io.readTrips(developmentId, [jobId]).then(
      (records) => live && setRead({ key: readKey, records }),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [readKey, jobId, developmentId, io, gen])

  const records = read && read.key === readKey ? read.records : null
  const siteHasTrip = !!records && records.length > 0
  const line = useMemo(() => (records && jobId ? jobTripsLine({ records, jobId, todayYmd: todayYmd ?? todayYmdInAppTz() }) : null), [records, jobId, todayYmd])
  const lineShows = !!line

  useEffect(() => {
    if (!siteHasTrip || roster) return
    let live = true
    io.readRoster().then(
      (r) => live && setRoster(r),
      () => live && setRoster([]),
    )
    return () => {
      live = false
    }
  }, [siteHasTrip, roster, io])

  const punchKey = siteHasTrip && jobId ? jobId : ''
  useEffect(() => {
    if (!punchKey) return
    let live = true
    io.readPunches([punchKey]).then(
      (rows) => live && setPunchRead({ key: punchKey, rows }),
      () => live && setPunchRead({ key: punchKey, rows: null }),
    )
    return () => {
      live = false
    }
  }, [punchKey, io, gen])

  const laborKey = lineShows && jobId ? jobId : ''
  useEffect(() => {
    if (!laborKey) return
    let live = true
    io.readLabor([laborKey]).then(
      (labor) => live && setLaborRead({ key: laborKey, labor }),
      () => live && setLaborRead({ key: laborKey, labor: null }),
    )
    return () => {
      live = false
    }
  }, [laborKey, io, gen])

  // The site's address, as the Trips look reads it: the one the development's jobs and bids share.
  const addressKey = siteHasTrip && developmentId ? developmentId : ''
  useEffect(() => {
    if (!addressKey) return
    let live = true
    io.readSiteAddresses(addressKey).then(
      (rows) => live && setAddressRead({ key: addressKey, shared: sharedAddressWords(rows) }),
      // A read that fails gives nothing, and the job's own address stands in.
      () => live && setAddressRead({ key: addressKey, shared: null }),
    )
    return () => {
      live = false
    }
  }, [addressKey, io])
  const sharedRead = addressRead && addressRead.key === addressKey ? addressRead : null
  // No point is asked for until the shared address has answered, so the job's own address is never placed first and then dropped.
  const pointAddress = sharedRead ? (sharedRead.shared ?? address) : null
  const addresses = useMemo(() => (pointAddress && pointAddress.trim() ? [{ key: normalizeAddressForGeocodeKey(pointAddress), display: pointAddress.trim() }] : []), [pointAddress])
  const geo = useAddressGeocodeCoords(addresses, siteHasTrip && addresses.length > 0, 'job trips site point')
  const sitePoint = addresses[0] ? (geo.coords.get(addresses[0].key) ?? null) : null
  const sitePointKnown = !!sharedRead && (addresses.length === 0 || !!sitePoint || !geo.resolving)

  const punches = punchRead && punchRead.key === punchKey ? punchRead : null
  const labor = laborRead && laborRead.key === laborKey ? laborRead : null
  const index = useMemo(() => tripPeopleIndex(roster ?? []), [roster])
  // A tag waits for the roster, the punches and the site's point, so a line never wears one tag and then another.
  const clockTags = useMemo(
    () => (records && records.length > 0 && roster && punches?.rows && sitePointKnown ? jobClockTags({ records, index, punches: punches.rows, site: sitePoint }) : NO_TAGS),
    [records, roster, punches, sitePointKnown, sitePoint, index],
  )
  const hours = useMemo(
    () => (records && jobId && roster && punches?.rows && labor?.labor && sitePointKnown ? jobTripHours({ records, index, labor: labor.labor, punches: punches.rows, site: sitePoint, jobId }) : null),
    [records, jobId, roster, punches, labor, sitePointKnown, sitePoint, index],
  )
  const hoursState: JobTripsHoursState = (labor && !labor.labor) || (punches && !punches.rows) ? 'failed' : labor?.labor && !labor.labor.daysKnown ? 'closed' : hours ? 'read' : 'reading'

  const save = useCallback(
    async (record: TripRecord) => {
      const number = await io.save(record)
      const kept = typeof number === 'number' ? { ...record, tripNumber: number } : record
      setRead((prev) => (prev ? { key: prev.key, records: [...prev.records.filter((r) => r.id !== record.id), kept] } : prev))
      setGen((g) => g + 1)
    },
    [io],
  )

  return { records, line, hours, hoursState, noSitePoint: siteHasTrip && sitePointKnown && !sitePoint, clockTags, roster, save }
}
