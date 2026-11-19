import { useCallback, useEffect, useRef, useState } from 'react'
import type { TripBillLine } from '../lib/trips/tripBillLine'
import { readTripBillLines } from '../lib/trips/tripBillLineIo'
import type { TripRecord, TripRosterPerson } from '../lib/trips/tripRecord'
import { readSiteTrips, readTripRoster, saveTrip } from '../lib/trips/tripsIo'

/**
 * The trips behind a job's Bill tab strip (`lib/trips/jobBillTrips.ts`): the trips kept on the job's site, and the
 * lines the Extra ones hold, read together so a trip is never offered while its line is not known. One small read
 * of each when the strip mounts, for the trips office on a job that is in a development; nothing otherwise.
 *
 * The roster is read only once the sheet for a new trip is asked for. Saving a trip changes no clock row, bill or
 * cost. The io is injectable for tests.
 */
export type JobBillTripsIo = {
  readTrips: (developmentId: string) => Promise<TripRecord[]>
  readLines: (tripIds: ReadonlyArray<string>) => Promise<Map<string, TripBillLine>>
  readRoster: () => Promise<TripRosterPerson[]>
  save: (record: TripRecord) => Promise<number | null | void>
}

export const supabaseJobBillTripsIo: JobBillTripsIo = {
  readTrips: (developmentId) => readSiteTrips(developmentId, []),
  readLines: readTripBillLines,
  readRoster: readTripRoster,
  save: saveTrip,
}

export type JobBillTripsState = {
  /** The site's trips; null until read. */
  records: TripRecord[] | null
  /** The lines the site's Extra trips hold, by trip; null until read. */
  lines: Map<string, TripBillLine> | null
  /** The trips or their lines would not read. */
  failed: boolean
  roster: TripRosterPerson[] | null
  /** Ask for the roster: the sheet's Who went needs it. */
  askRoster: () => void
  reload: () => void
  save: (record: TripRecord) => Promise<void>
}

export function useJobBillTrips({ developmentId, enabled, io = supabaseJobBillTripsIo }: { developmentId: string | null; enabled: boolean; io?: JobBillTripsIo }): JobBillTripsState {
  const [read, setRead] = useState<{ key: string; records: TripRecord[]; lines: Map<string, TripBillLine> } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [roster, setRoster] = useState<TripRosterPerson[] | null>(null)
  const [rosterWanted, setRosterWanted] = useState(false)
  const [gen, setGen] = useState(0)
  const ioRef = useRef(io)
  ioRef.current = io

  const key = enabled && developmentId ? developmentId : ''
  useEffect(() => {
    if (!key) return
    let live = true
    const run = async () => {
      const records = await ioRef.current.readTrips(key)
      const extra = records.filter((r) => r.billing === 'extra').map((r) => r.id)
      const lines = extra.length ? await ioRef.current.readLines(extra) : new Map<string, TripBillLine>()
      return { records, lines }
    }
    run().then(
      (found) => {
        if (!live) return
        setRead({ key, ...found })
        setFailedKey(null)
      },
      () => live && setFailedKey(key),
    )
    return () => {
      live = false
    }
  }, [key, gen])

  useEffect(() => {
    if (!rosterWanted || roster) return
    let live = true
    ioRef.current.readRoster().then(
      (r) => live && setRoster(r),
      () => live && setRoster([]),
    )
    return () => {
      live = false
    }
  }, [rosterWanted, roster])

  const reload = useCallback(() => setGen((g) => g + 1), [])
  const askRoster = useCallback(() => setRosterWanted(true), [])
  const save = useCallback(
    async (record: TripRecord) => {
      await ioRef.current.save(record)
      reload()
    },
    [reload],
  )

  const mine = read && read.key === key ? read : null
  return { records: mine?.records ?? null, lines: mine?.lines ?? null, failed: !!key && failedKey === key && !mine, roster, askRoster, reload, save }
}
