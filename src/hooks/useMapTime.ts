import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOlderPhotos, type OlderPhotosState } from './useOlderPhotos'
import { mapTimeOlder, mapTimePickFor, mapTimeShown, mapTimeStep, mapTimeToday, type MapTimePick, type MapTimeSpot } from '../lib/map/mapTime'
import { WAYBACK_ATTRIBUTION, olderPhotoChoices, olderPhotosFrame, waybackTileTemplate, type MapSpot, type OlderPhotoChoice } from '../lib/map/olderPhotos'

/** A view from above other than today's: one release of the photo archive. */
export type MapTimeImagery = { url: string; attribution: string }

export type MapTime = {
  on: boolean
  toggle: () => void
  off: () => void
  /** The place on show while Time is on. Nothing is Time off, or on with no spot picked yet. */
  spot: MapTimeSpot | null
  /** The two corners the map frames while Time is on. */
  frame: [MapSpot, MapSpot] | null
  photos: OlderPhotosState
  /** Today's photograph, once the archive has named it. */
  today: OlderPhotoChoice | null
  /** The dates on the row, oldest first. */
  older: OlderPhotoChoice[]
  /** The date on show. Nothing is Today. */
  shown: OlderPhotoChoice | null
  /** The photograph to draw in place of today's. Nothing is today's. */
  imagery: MapTimeImagery | null
  pickDate: (choice: OlderPhotoChoice) => void
  pickToday: () => void
  /** One step along the row: -1 is older, 1 is newer. */
  step: (direction: -1 | 1) => void
  canStep: (direction: -1 | 1) => boolean
}

/**
 * Time on one map (punch list #395): whether it is on, the spot it looks at, and the date on show.
 *
 * All of it is this map's own state and none of it is kept, so leaving the screen puts Time away:
 * the map that comes back is the map of today. The archive is read only while Time is on.
 *
 * `live` is the spot the map offers now, the open dot or the screen's own place. A map can let go
 * of its open dot on a stray press, so Time holds the last spot it was given until it gets another.
 */
export function useMapTime(live: MapTimeSpot | null): MapTime {
  const [on, setOn] = useState(false)
  const [held, setHeld] = useState<MapTimeSpot | null>(null)
  const [pick, setPick] = useState<MapTimePick | null>(null)
  const liveLat = live?.lat ?? null
  const liveLng = live?.lng ?? null
  const liveName = live?.name ?? null

  useEffect(() => {
    if (on && liveLat != null && liveLng != null) setHeld({ lat: liveLat, lng: liveLng, name: liveName ?? '' })
  }, [on, liveLat, liveLng, liveName])

  const spot = useMemo<MapTimeSpot | null>(() => {
    if (!on) return null
    if (liveLat != null && liveLng != null) return { lat: liveLat, lng: liveLng, name: liveName ?? '' }
    return held
  }, [on, liveLat, liveLng, liveName, held])

  const photos = useOlderPhotos(spot)
  const found = photos.found
  const choices = useMemo(() => olderPhotoChoices(found), [found])
  const today = useMemo(() => mapTimeToday(found, choices), [found, choices])
  const older = useMemo(() => mapTimeOlder(found, choices), [found, choices])
  const stands = spot ? mapTimeShown(found, choices, pick, photos.looking !== 'walk') : null
  // A pick that lands on today's photograph at another spot is Today.
  const shown = stands && stands !== today ? stands : null
  const imageryRelease = !spot || !pick ? null : shown ? shown.release : stands ? null : pick.release
  const imagery = useMemo<MapTimeImagery | null>(() => (imageryRelease == null ? null : { url: waybackTileTemplate(imageryRelease), attribution: WAYBACK_ATTRIBUTION }), [imageryRelease])
  const frame = useMemo(() => (spot ? olderPhotosFrame(spot) : null), [spot])

  const off = useCallback(() => {
    setOn(false)
    setPick(null)
    setHeld(null)
  }, [])
  const toggle = useCallback(() => {
    setPick(null)
    setHeld(null)
    setOn((was) => !was)
  }, [])
  const pickDate = useCallback((choice: OlderPhotoChoice) => setPick(mapTimePickFor(found, choice)), [found])
  const pickToday = useCallback(() => setPick(null), [])
  const step = useCallback(
    (direction: -1 | 1) => {
      const to = mapTimeStep(older, shown, direction)
      if (to === 'today') setPick(null)
      else if (to) setPick(mapTimePickFor(found, to))
    },
    [older, shown, found],
  )
  const canStep = useCallback((direction: -1 | 1) => mapTimeStep(older, shown, direction) != null, [older, shown])

  return { on, toggle, off, spot, frame, photos, today, older, shown, imagery, pickDate, pickToday, step, canStep }
}
