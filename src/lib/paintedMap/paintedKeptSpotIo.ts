/**
 * A place set with no signal (punch list #413, step 2b): keeping it on the phone, and sending it.
 * The rules are `paintedKeptSpot.ts`'s. The record is in the phone's own storage, as a walk that
 * was never saved is (`usePaintedWalk`), and the photos' bytes are in the phone's photo store
 * (`keptPhotos`), where a job photo's wait.
 */
import { keptPhotos, type KeptPhotosStore } from '../offline/keptPhotos'
import { paintedMapsChanged } from './paintedMapDoor'
import { addPaintedPlace, createPaintedMap, uploadPaintedPlacePhoto } from './paintedMapIo'
import type { PlacePhoto } from './paintedMap'
import { alreadyThere, keptSpotPhotoIds, keptSpotsFromJson, type KeptSpot } from './paintedKeptSpot'
import { paintedPlaceKindFrom } from './paintedPlaceKind'
import { paintedPlacePhotoPath } from './paintedPlacePhoto'

const keyFor = (userId: string): string => `pt.paintedMap.keptSpots.${userId}`

function readRaw(userId: string): string | null {
  try {
    return window.localStorage.getItem(keyFor(userId))
  } catch {
    return null
  }
}

/** True when the phone took the list. A phone with no room, or a private window, takes nothing. */
function writeList(userId: string, list: ReadonlyArray<KeptSpot>): boolean {
  try {
    if (list.length > 0) window.localStorage.setItem(keyFor(userId), JSON.stringify(list))
    else window.localStorage.removeItem(keyFor(userId))
    return true
  } catch {
    return false
  }
}

/**
 * The places that wait on this phone for this person, the oldest first. One too old to send is
 * dropped here with its bytes, so it is not left lying on the phone unseen.
 */
export function readKeptSpots(userId: string, nowMs: number = Date.now(), store: KeptPhotosStore = keptPhotos): KeptSpot[] {
  const read = keptSpotsFromJson(readRaw(userId), userId, nowMs)
  if (read.expired.length > 0) {
    writeList(userId, read.waiting)
    void store.drop(read.expired.flatMap(keptSpotPhotoIds))
  }
  return read.waiting
}

/**
 * Keeps a place on the phone: its photos' bytes first, then its record. False when the phone could
 * not hold it all, and then nothing is left behind.
 */
export async function keepSpot(spot: KeptSpot, photos: ReadonlyArray<{ id: string; blob: Blob }>, store: KeptPhotosStore = keptPhotos): Promise<boolean> {
  const held: string[] = []
  for (const p of photos) {
    const ok = await store.keep(p.id, p.blob).catch(() => false)
    if (!ok) {
      void store.drop(held)
      return false
    }
    held.push(p.id)
  }
  const list = [...readKeptSpots(spot.userId, spot.savedAtMs, store).filter((s) => s.id !== spot.id), spot]
  if (!writeList(spot.userId, list)) {
    void store.drop(held)
    return false
  }
  return true
}

/** One photo's bytes to the bucket. Its path when it went or was already there, null when its bytes are gone from the phone, and an error otherwise. */
async function sendPhoto(mapId: string, photoId: string, store: KeptPhotosStore): Promise<{ ok: true; path: string | null } | { ok: false; error: string }> {
  const blob = await store.read(photoId).catch(() => null)
  if (!blob) return { ok: true, path: null }
  const up = await uploadPaintedPlacePhoto(mapId, photoId, blob)
  if (up.ok) return { ok: true, path: up.value }
  return alreadyThere(up.error) ? { ok: true, path: paintedPlacePhotoPath(mapId, photoId) } : { ok: false, error: up.error }
}

/**
 * Sends one kept place: its map when this place starts the job's list, its photos, then its row.
 * Each step is the same write on a second try, so a place whose answer was lost is not made twice.
 */
export async function sendKeptSpot(spot: KeptSpot, store: KeptPhotosStore = keptPhotos): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!spot.map.saved) {
    const made = await createPaintedMap({ id: spot.map.id, name: spot.map.name, words: spot.map.words, jobId: spot.map.jobId, developmentId: spot.map.developmentId, jobList: spot.map.jobList, by: spot.userId })
    if (!made.ok && !alreadyThere(made.error)) return { ok: false, error: made.error }
  }
  let photoPath: string | null = null
  if (spot.photoId) {
    const sent = await sendPhoto(spot.map.id, spot.photoId, store)
    if (!sent.ok) return sent
    photoPath = sent.path
  }
  const morePhotos: PlacePhoto[] = []
  for (const id of spot.moreIds) {
    const sent = await sendPhoto(spot.map.id, id, store)
    if (!sent.ok) return sent
    if (sent.path) morePhotos.push({ path: sent.path, at: new Date(spot.savedAtMs).toISOString(), by: spot.userId })
  }
  const added = await addPaintedPlace(
    spot.map.id,
    { id: spot.id, lat: spot.place.lat, lng: spot.place.lng, name: spot.place.name, words: spot.place.words, accuracyM: spot.place.accuracyM, photoPath, kind: paintedPlaceKindFrom(spot.place.kind), ...(morePhotos.length > 0 ? { morePhotos } : null) },
    spot.userId,
  )
  if (!added.ok && !alreadyThere(added.error)) return { ok: false, error: added.error }
  return { ok: true }
}

/**
 * Sends every place that waits on this phone for this person, the oldest first. A place that went
 * leaves the phone with its bytes. It stops at the first that does not go, since the next would
 * meet the same lost signal, and says how many went and how many still wait.
 */
export async function sendKeptSpots(userId: string, store: KeptPhotosStore = keptPhotos): Promise<{ sent: number; waiting: number; error: string | null }> {
  let waiting = readKeptSpots(userId, Date.now(), store)
  let sent = 0
  let error: string | null = null
  for (const spot of waiting.slice()) {
    const res = await sendKeptSpot(spot, store)
    if (!res.ok) {
      error = res.error
      break
    }
    sent += 1
    waiting = waiting.filter((s) => s.id !== spot.id)
    writeList(userId, waiting)
    void store.drop(keptSpotPhotoIds(spot))
  }
  if (sent > 0) paintedMapsChanged()
  return { sent, waiting: waiting.length, error }
}
