/**
 * ＋ Paint the way here (punch list #372, step 4), for the phone's Places sheet and the office's place heads: the
 * painting window opens on a new map on the place's job, named *The way to Level 2*. When that window closes the map
 * is read back by the id made here, and if a line or a place was saved it goes onto the place. Nothing saved is
 * nothing changed, as a task's Paint a new one works (`TaskMapField.tsx`).
 */
import { loadPaintedMap } from '../../lib/paintedMap/paintedMapIo'
import { openPaintedMap, paintPaintedMap, type PaintedMapHome } from '../../lib/paintedMap/paintedMapDoor'
import { newId } from '../../lib/materials/onSiteStore'
import type { Place } from '../../lib/materials/onSite'
import { PLACE_WAY_NO_WINDOW_WORDS, paintedWayWasSaved, placeWayName, placeWayNotSetWords, placeWayNothingWords, placeWaySavedWords, placeWayTakenOffWords } from '../../lib/materials/placeWay'
import { setPlaceWay } from '../../lib/materials/placeWayIo'
import { formatErrorMessage } from '../../utils/errorHandling'

type Say = (words: string, tone: 'success' | 'info' | 'error') => void

export function paintPlaceWay(place: Place, home: PaintedMapHome & { jobId: string }, say: Say, io: { paint?: typeof paintPaintedMap; loadMap?: typeof loadPaintedMap; setWay?: typeof setPlaceWay; makeId?: () => string } = {}): void {
  const { paint = paintPaintedMap, loadMap = loadPaintedMap, setWay = setPlaceWay, makeId = newId } = io
  const id = makeId()
  const opened = paint({ id, name: placeWayName(place.name), words: '', first: 'line', home }, () => {
    void loadMap(id).then(
      async (res) => {
        if (!res.ok || !paintedWayWasSaved(res.value)) {
          say(placeWayNothingWords(place.name), 'info')
          return
        }
        try {
          await setWay(home.jobId, place.id, id)
          say(placeWaySavedWords(place.name), 'success')
        } catch (e) {
          say(placeWayNotSetWords(place.name, formatErrorMessage(e)), 'error')
        }
      },
      () => say(placeWayNothingWords(place.name), 'info'),
    )
  })
  if (!opened) say(PLACE_WAY_NO_WINDOW_WORDS, 'error')
}

/** Open a place's way in the painted map window. */
export function openPlaceWay(place: Place, address: string | null, say: Say): void {
  if (!place.wayMapId) return
  if (!openPaintedMap(place.wayMapId, address)) say(PLACE_WAY_NO_WINDOW_WORDS, 'error')
}

/** Take the way off a place. The map itself is kept. */
export async function takeOffPlaceWay(place: Place, jobId: string, say: Say, setWay: typeof setPlaceWay = setPlaceWay): Promise<void> {
  try {
    await setWay(jobId, place.id, null)
    say(placeWayTakenOffWords(place.name), 'info')
  } catch (e) {
    say(`The way did not come off ${place.name}: ${formatErrorMessage(e)}`, 'error')
  }
}
