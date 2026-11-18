/**
 * Older photos of a spot (v2.7693): the reading half. `olderPhotos.ts` has the rules and the words.
 *
 * Three public reads of Esri's World Imagery Wayback, none with a key: the list of releases, the
 * tile map that says which release a tile really comes from, and the metadata that names the day a
 * photograph was taken. Nothing about the task, the person or the company leaves the browser: the
 * archive is asked about a map tile and the middle of that tile, never the place's own point.
 */
import { todayYmdInAppTz } from '../../utils/dateUtils'
import {
  OLDER_PHOTOS_MAX_STEPS,
  isNewPhoto,
  nextWalkIndex,
  olderPhotosSettled,
  parseWaybackReleases,
  readKeptOlderPhotos,
  readTakenYmd,
  readTilemapAnswer,
  tileCentre,
  tileForSpot,
  waybackMetadataQueryUrl,
  waybackTilemapUrl,
  WAYBACK_CONFIG_URL,
  type KeptOlderPhotos,
  type MapSpot,
  type OlderPhotoFound,
  type WaybackRelease,
} from './olderPhotos'

export type FetchJson = (url: string, signal?: AbortSignal, timeoutMs?: number) => Promise<unknown>

const READ_TIMEOUT_MS = 9000
/**
 * The day a photograph was taken comes from a slow service: measured 2026-11-17, one answer took
 * between 1 and 25 seconds, and a question that timed out was answered fast when asked again. So a
 * day is asked up to three times, a few at once, and a photograph is on the list before its day is.
 */
const DAY_TIMEOUT_MS = 12000
const DAY_TRIES = 3
const DAYS_AT_ONCE = 4
const KEEP_PREFIX = 'older_photos_v1:'

/** One read with its own clock: the archive sometimes holds a request open, and a walk must not wait on it. */
const fetchJsonWithClock: FetchJson = async (url, signal, timeoutMs = READ_TIMEOUT_MS) => {
  const clock = new AbortController()
  const timer = setTimeout(() => clock.abort(), timeoutMs)
  const stop = () => clock.abort()
  signal?.addEventListener('abort', stop)
  try {
    const res = await fetch(url, { signal: clock.signal })
    if (!res.ok) throw new Error(`The photo archive answered ${res.status}.`)
    return (await res.json()) as unknown
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', stop)
  }
}

let releasesKept: Promise<WaybackRelease[]> | null = null
const walksKept = new Map<string, OlderPhotoFound[]>()

/** For tests: forget the release list and every walk of this visit. The device's own keep is the test's to clear. */
export function forgetOlderPhotos(): void {
  releasesKept = null
  walksKept.clear()
}

function readDeviceKeep(key: string): OlderPhotoFound[] | null {
  try {
    return typeof localStorage === 'undefined' ? null : readKeptOlderPhotos(localStorage.getItem(KEEP_PREFIX + key), todayYmdInAppTz())
  } catch {
    return null
  }
}

function writeDeviceKeep(key: string, found: OlderPhotoFound[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    const kept: KeptOlderPhotos = { at: todayYmdInAppTz(), found }
    localStorage.setItem(KEEP_PREFIX + key, JSON.stringify(kept))
  } catch {
    // A full or closed store: the walk is still kept for this visit.
  }
}

/** Esri's list of releases, read once a visit. A failed read is not kept, so Retry reads again. */
export function loadWaybackReleases(fetchJson: FetchJson = fetchJsonWithClock, signal?: AbortSignal): Promise<WaybackRelease[]> {
  if (!releasesKept) {
    const mine = fetchJson(WAYBACK_CONFIG_URL, signal).then((json) => {
      const list = parseWaybackReleases(json)
      if (list.length === 0) throw new Error('The photo archive sent no list of dates.')
      return list
    })
    releasesKept = mine
    mine.catch(() => {
      if (releasesKept === mine) releasesKept = null
    })
  }
  return releasesKept
}

/** At most `limit` jobs at once, in the order they were given. */
function gate(limit: number): <T>(job: () => Promise<T>) => Promise<T> {
  let running = 0
  const waiting: Array<() => void> = []
  const next = () => {
    running -= 1
    waiting.shift()?.()
  }
  return async (job) => {
    if (running >= limit) await new Promise<void>((go) => waiting.push(go))
    running += 1
    try {
      return await job()
    } finally {
      next()
    }
  }
}

export type WalkOptions = {
  /** Called with the whole list each time a photograph is found or its day lands, so the dates draw as they come. */
  onChange: (found: OlderPhotoFound[]) => void
  /** The walk has met every photograph. Their days may still be on the way. */
  onWalked?: () => void
  signal?: AbortSignal
  fetchJson?: FetchJson
  maxSteps?: number
}

/**
 * Walk the archive at a spot, newest release to oldest, and hand back every photograph it has.
 *
 * It throws when the list of releases or the first tile cannot be read: there is nothing to show
 * and the caller offers Retry. A read that fails later ends the walk with what it found, since a
 * hold on one date must not take the others away. A day that cannot be read after three tries
 * leaves its photograph named by the day it was published. A finished walk is kept for the visit,
 * and on the device for a week when every photograph has its day.
 */
export async function walkOlderPhotos(spot: MapSpot, { onChange, onWalked, signal, fetchJson = fetchJsonWithClock, maxSteps = OLDER_PHOTOS_MAX_STEPS }: WalkOptions): Promise<OlderPhotoFound[]> {
  const tile = tileForSpot(spot)
  const key = `${tile.z}/${tile.x}/${tile.y}`
  const kept = walksKept.get(key) ?? readDeviceKeep(key)
  if (kept) {
    walksKept.set(key, kept)
    onChange(kept)
    onWalked?.()
    return kept
  }
  const releases = await loadWaybackReleases(fetchJson, signal)
  const byRelease = new Map(releases.map((r) => [r.release, r]))
  let found: OlderPhotoFound[] = []
  const days: Promise<void>[] = []
  const inTurn = gate(DAYS_AT_ONCE)
  const say = () => {
    if (!signal?.aborted) onChange(found)
  }
  const askDay = async (metadataUrl: string | null): Promise<string | null> => {
    if (!metadataUrl) return null
    // Asked at the middle of the tile: the place's own point is never sent.
    const url = waybackMetadataQueryUrl(metadataUrl, tileCentre(tile))
    for (let attempt = 0; attempt < DAY_TRIES && !signal?.aborted; attempt++) {
      try {
        return readTakenYmd(await fetchJson(url, signal, DAY_TIMEOUT_MS))
      } catch {
        // Asked again: the service answers a repeated question faster.
      }
    }
    return null
  }

  let at: number | null = 0
  for (let step = 0; at != null && step < maxSteps; step++) {
    if (signal?.aborted) return found
    const asked = releases[at]!
    let answer
    try {
      answer = readTilemapAnswer(await fetchJson(waybackTilemapUrl(asked.release, tile), signal), asked.release)
    } catch (e) {
      if (step === 0) throw e
      break
    }
    if (!answer.has) break
    const actual = byRelease.get(answer.actualRelease) ?? asked
    if (isNewPhoto(found, answer.size)) {
      // The stop is known by its place in the list.
      const mine = found.length
      found = [...found, { release: actual.release, publishedYmd: actual.publishedYmd, size: answer.size }]
      say()
      days.push(
        inTurn(() => askDay(actual.metadataUrl)).then((takenYmd) => {
          found = found.map((f, i) => (i === mine ? { ...f, takenYmd } : f))
          say()
        }),
      )
    } else {
      // The same photograph, published earlier: its first publishing day moves back, its release stays.
      found = found.map((f, i) => (i === found.length - 1 ? { ...f, publishedYmd: actual.publishedYmd } : f))
      say()
    }
    at = nextWalkIndex(releases, actual.release)
  }
  if (!signal?.aborted) onWalked?.()
  await Promise.all(days)
  if (!signal?.aborted) {
    walksKept.set(key, found)
    if (olderPhotosSettled(found)) writeDeviceKeep(key, found)
  }
  return found
}
