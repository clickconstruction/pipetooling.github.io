import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TripBillLine } from '../lib/trips/tripBillLine'
import { readTripBillLines } from '../lib/trips/tripBillLineIo'

/**
 * The lines a site's trips hold (punch list #391): one small read by the trips' ids, again whenever the set
 * of trips changes, and again on `reload` after a press. `lines` is null while the read is not in, and stays
 * null when the read fails or the lines are closed to the reader: a trip then says its own billing word and
 * no more, and no press is offered. Nothing is read when `enabled` is false or the site has no trip.
 */
export function useTripBillLines(tripIds: ReadonlyArray<string>, enabled: boolean, read: (ids: ReadonlyArray<string>) => Promise<Map<string, TripBillLine>> = readTripBillLines) {
  const key = useMemo(() => [...tripIds].sort().join(','), [tripIds])
  const [state, setState] = useState<{ key: string; lines: Map<string, TripBillLine> } | null>(null)
  const [nonce, setNonce] = useState(0)
  const readRef = useRef(read)
  readRef.current = read
  useEffect(() => {
    if (!enabled) return
    let live = true
    const ids = key ? key.split(',') : []
    readRef.current(ids).then(
      (lines) => {
        if (live) setState({ key, lines })
      },
      () => {
        // Closed to this reader, or a lost signal: the trips say their own billing word.
        if (live) setState(null)
      },
    )
    return () => {
      live = false
    }
  }, [enabled, key, nonce])
  const reload = useCallback(() => setNonce((n) => n + 1), [])
  // Lines read for another set of trips are not this set's: a trip added since would read as holding none.
  const lines = enabled && state && state.key === key ? state.lines : null
  return { lines, reload }
}
