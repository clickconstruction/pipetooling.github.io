/**
 * A place set with no signal (punch list #413, step 2b): it waits on the phone and goes to the job
 * when the signal is back. A crew sets a spot standing in a yard, and a yard is where the signal
 * drops. A place that is lost because the save failed is a place nobody sets twice.
 *
 * Pure: what is kept, what is still worth sending, and the words. No storage, no network, no React.
 *
 * The rules the screens lean on:
 * - Only a new place waits. A change to a saved place says it did not save, as before: it has a
 *   row to go back to.
 * - The place's id is made on the phone, and so is its map's when the job had no list yet. A second
 *   try writes the same rows, so a save whose answer was lost does not make two places.
 * - The photo's bytes wait in the phone's own photo store, under the photo's id. A place whose
 *   bytes are gone still goes, with no photo, since the dot and the words are worth having.
 * - A place waits seven days, as a photo does. After that it is dropped.
 * - What waits is read only by the person who set it, on the phone that holds it.
 */

/** How long a place waits on the phone: a photo's own seven days. */
export const KEPT_SPOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type KeptSpot = {
  /** The place's id, made on the phone. */
  id: string
  userId: string
  savedAtMs: number
  /** The map the place goes on. `saved` is false for a job's list that this place starts. */
  map: { id: string; jobId: string | null; developmentId: string | null; name: string; words: string; jobList: boolean; saved: boolean }
  place: { name: string; words: string; kind: string | null; lat: number; lng: number; accuracyM: number | null }
  /** The first photo's id, whose bytes wait in the phone's photo store. Null with no photo. */
  photoId: string | null
  /** The ids of the photos after the first. */
  moreIds: string[]
}

export const KEPT_SPOT_WORDS = {
  /** In the window, right after the press. */
  kept: 'Kept on this phone. It goes to the job when the signal is back.',
  send: 'Send now',
  sending: 'Sending…',
  /** A place could not be kept either: the phone has no room, or is in a private window. */
  cannotKeep: 'There is no signal, and this phone could not keep the place. Stay on this screen and press Add this place again when the signal is back.',
} as const

/** `1 place waits on this phone.` or `3 places wait on this phone.`, then what happens next. */
export function keptSpotsWords(count: number): string {
  return `${count === 1 ? '1 place waits' : `${count} places wait`} on this phone. ${count === 1 ? 'It goes' : 'They go'} to the job when the signal is back.`
}

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** One kept place, read with care. Anything that is not whole is null: a mangled record is never sent. */
export function keptSpotFrom(raw: unknown): KeptSpot | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const m = (o.map ?? null) as Record<string, unknown> | null
  const p = (o.place ?? null) as Record<string, unknown> | null
  if (!str(o.id) || !str(o.userId) || !num(o.savedAtMs) || !m || !p) return null
  if (!str(m.id) || !str(p.name) || !num(p.lat) || !num(p.lng)) return null
  if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) return null
  return {
    id: o.id,
    userId: o.userId,
    savedAtMs: o.savedAtMs,
    map: { id: m.id, jobId: str(m.jobId) ? m.jobId : null, developmentId: str(m.developmentId) ? m.developmentId : null, name: str(m.name) ? m.name : '', words: typeof m.words === 'string' ? m.words : '', jobList: m.jobList === true, saved: m.saved === true },
    place: { name: p.name, words: typeof p.words === 'string' ? p.words : '', kind: str(p.kind) ? p.kind : null, lat: p.lat, lng: p.lng, accuracyM: num(p.accuracyM) && p.accuracyM >= 0 ? p.accuracyM : null },
    photoId: str(o.photoId) ? o.photoId : null,
    moreIds: Array.isArray(o.moreIds) ? o.moreIds.filter(str) : [],
  }
}

/**
 * What a phone holds, as its storage wrote it: the places still worth sending for this person,
 * the oldest first, and those too old to send, which the caller drops with their bytes.
 */
export function keptSpotsFromJson(raw: string | null | undefined, userId: string, nowMs: number): { waiting: KeptSpot[]; expired: KeptSpot[] } {
  let list: unknown = null
  try {
    list = raw ? JSON.parse(raw) : null
  } catch {
    list = null
  }
  const all = (Array.isArray(list) ? list : []).map(keptSpotFrom).filter((s): s is KeptSpot => !!s && s.userId === userId)
  const byAge = all.slice().sort((a, b) => a.savedAtMs - b.savedAtMs)
  return { waiting: byAge.filter((s) => nowMs - s.savedAtMs <= KEPT_SPOT_MAX_AGE_MS), expired: byAge.filter((s) => nowMs - s.savedAtMs > KEPT_SPOT_MAX_AGE_MS) }
}

/** Every photo id a kept place holds bytes under. */
export function keptSpotPhotoIds(spot: Pick<KeptSpot, 'photoId' | 'moreIds'>): string[] {
  return [spot.photoId, ...spot.moreIds].filter(str)
}

/**
 * Did a save fail for want of a signal? The phone says it is offline, or the error is a fetch that
 * never reached anything. A refusal by the database is not this: it would be refused again.
 */
export function saveLostSignal(error: string | null | undefined, online: boolean): boolean {
  if (!online) return true
  return /failed to fetch|load failed|networkerror|network request failed|no signal|the internet connection appears to be offline/i.test(error ?? '')
}

/** A write that found its own row or its own bytes already there: an earlier try landed and its answer was lost. That is a success. */
export function alreadyThere(error: string | null | undefined): boolean {
  return /duplicate key|already exists|resource already exists/i.test(error ?? '')
}
