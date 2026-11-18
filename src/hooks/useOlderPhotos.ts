import { useCallback, useEffect, useMemo, useState } from 'react'
import { OLDER_PHOTOS_FAILED_WORDS, olderPhotosForAsk, tileForSpot, type MapSpot, type OlderPhotoFound } from '../lib/map/olderPhotos'
import { walkOlderPhotos } from '../lib/map/olderPhotosIo'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'

export type OlderPhotosState = {
  /** The photographs found so far, newest first, as the walk hands them over. */
  found: OlderPhotoFound[]
  /** `walk`: more photographs may come. `days`: every photograph is here and some days are still on the way. */
  looking: 'walk' | 'days' | null
  failure: OfflineRecoveryLastError | null
  retry: () => void
}

/**
 * The older photos of a spot (v2.7693), read while the archive view is open. `null` reads nothing.
 * A new spot in the same map tile reads nothing again: the walk is kept by tile.
 */
export function useOlderPhotos(spot: MapSpot | null): OlderPhotosState {
  const [found, setFound] = useState<OlderPhotoFound[]>([])
  const [looking, setLooking] = useState<'walk' | 'days' | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [attempt, setAttempt] = useState(0)
  // The tile the state below was walked for. It lands a frame after the ask changes: `olderPhotosForAsk` covers that frame.
  const [heldKey, setHeldKey] = useState<string | null>(null)
  const tile = spot ? tileForSpot(spot) : null
  const key = tile ? `${tile.z}/${tile.x}/${tile.y}` : null
  const lat = spot?.lat ?? null
  const lng = spot?.lng ?? null

  useEffect(() => {
    setHeldKey(key)
    setFound([])
    setFailure(null)
    if (key == null || lat == null || lng == null) {
      setLooking(null)
      return
    }
    const stop = new AbortController()
    setLooking('walk')
    walkOlderPhotos({ lat, lng }, { onChange: (list) => setFound(list), onWalked: () => setLooking('days'), signal: stop.signal })
      .then((list) => {
        if (stop.signal.aborted) return
        setFound(list)
        setLooking(null)
      })
      .catch((e: unknown) => {
        if (stop.signal.aborted) return
        setFailure(recoveryFailureFromError(e, OLDER_PHOTOS_FAILED_WORDS))
        setLooking(null)
      })
    return () => stop.abort()
    // The tile is the question: a spot that moves inside one tile asks nothing new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  const shown = useMemo(() => olderPhotosForAsk(key, { key: heldKey, found, looking }), [key, heldKey, found, looking])
  return { found: shown.found, looking: shown.looking, failure: heldKey === key ? failure : null, retry }
}
