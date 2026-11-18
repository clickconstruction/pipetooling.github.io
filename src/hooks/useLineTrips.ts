import { useEffect, useMemo, useRef, useState } from 'react'
import { lineTripDoors, lineTripIds, type LineTrip, type LineTripDoor } from '../lib/trips/tripBillLine'
import { readLineTrips } from '../lib/trips/tripBillLineIo'

const NO_DOORS: ReadonlyMap<string, LineTripDoor> = new Map()

/**
 * The door back from a job's line to its trip (punch list #391, PR 4): for the lines that came from a trip,
 * one small read of those trips' numbers and sites, and a door for each line by its id. A job with no such
 * line reads nothing. A read that fails, or a reader the trips are closed to, leaves the lines with no door.
 */
export function useLineTrips(lines: ReadonlyArray<{ id: string; trip_id?: string | null }>, enabled: boolean, read: (ids: ReadonlyArray<string>) => Promise<LineTrip[]> = readLineTrips): ReadonlyMap<string, LineTripDoor> {
  const key = useMemo(() => lineTripIds(lines).sort().join(','), [lines])
  const [state, setState] = useState<{ key: string; trips: LineTrip[] } | null>(null)
  const readRef = useRef(read)
  readRef.current = read
  useEffect(() => {
    if (!enabled || !key) return
    let live = true
    readRef.current(key.split(',')).then(
      (trips) => {
        if (live) setState({ key, trips })
      },
      () => {
        if (live) setState(null)
      },
    )
    return () => {
      live = false
    }
  }, [enabled, key])
  return useMemo(() => (enabled && key && state && state.key === key ? lineTripDoors({ lines, trips: state.trips }) : NO_DOORS), [enabled, key, state, lines])
}
