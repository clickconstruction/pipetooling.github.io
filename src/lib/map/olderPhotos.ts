/**
 * Older photos of a spot (v2.7693): the pure half of the archive view, which every map with a Time
 * press shows (punch list #395, `mapTime.ts`).
 *
 * The photographs are Esri's World Imagery Wayback: every release of its imagery since February
 * 2014, each its own tile layer, with a metadata layer that names the day a photograph was taken.
 * Google's map API serves only its current imagery and its terms keep another provider's map off
 * and away from a Google map, so an older photo is always its own view, never a layer on Google's.
 *
 * A release is a day Esri published the whole map, not a day a photograph was taken, and most
 * releases change nothing at a given spot. So the archive is walked: ask a release for the spot's
 * tile, it names the release that tile really comes from, and the walk goes on from the release
 * before that one. Each stop is one photograph. Nothing here fetches: `olderPhotosIo.ts` does.
 */

export type MapSpot = { lat: number; lng: number }
export type MapTile = { z: number; x: number; y: number }

/** The zoom the archive is asked at: a job site fills the tile, and a tile changes when the site's photograph does. */
export const OLDER_PHOTOS_ZOOM = 17
/** The most stops one walk makes. A busy city centre has about fifty. */
export const OLDER_PHOTOS_MAX_STEPS = 90

export const WAYBACK_CONFIG_URL = 'https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json'
const WAYBACK_HOST = 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery'
/** Esri's own credit line for World Imagery, as its item page gives it. */
export const WAYBACK_ATTRIBUTION = 'Imagery &copy; Esri, Vantor, Earthstar Geographics, and the GIS User Community'

export const OLDER_PHOTOS_LOOKING_WORDS = 'Looking through the archive…'
export const OLDER_PHOTOS_DAYS_WORDS = 'Finding the days the photos were taken…'
export const OLDER_PHOTOS_FAILED_WORDS = "Couldn't read the photo archive."
export const OLDER_PHOTOS_EARTH_PRESS = 'Open this spot in Google Earth'
export const OLDER_PHOTOS_EARTH_WORDS = 'Google keeps its own older photos there.'

/** The zoom the archive view opens at: close enough to read a roof, a slab or a trench. */
export const OLDER_PHOTOS_VIEW_ZOOM = 17

/**
 * What the archive view frames: two corners close around the spot. The shared canvas gives one
 * point a box about two kilometres wide, so that one dot does not open at street level, and an
 * older photo is looked at close. The canvas's zoom cap then sets the zoom.
 */
export function olderPhotosFrame(spot: MapSpot): [MapSpot, MapSpot] {
  const pad = 0.0005
  return [
    { lat: spot.lat - pad, lng: spot.lng - pad },
    { lat: spot.lat + pad, lng: spot.lng + pad },
  ]
}

/** The slippy-map tile a spot falls in. */
export function tileForSpot(spot: MapSpot, zoom: number = OLDER_PHOTOS_ZOOM): MapTile {
  const n = 2 ** zoom
  const lat = Math.max(-85.0511, Math.min(85.0511, spot.lat))
  const x = Math.floor(((spot.lng + 180) / 360) * n)
  const rad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * n)
  return { z: zoom, x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) }
}

/**
 * The middle of a tile. The day a photograph was taken is asked there, not at the place itself:
 * the tiles the map draws already tell the archive which tile is looked at, and the exact point of
 * a task's place is never sent.
 */
export function tileCentre(tile: MapTile): MapSpot {
  const n = 2 ** tile.z
  const lng = ((tile.x + 0.5) / n) * 360 - 180
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (tile.y + 0.5)) / n))) * 180) / Math.PI
  return { lat, lng }
}

export type WaybackRelease = {
  /** Esri's release number: the one in a tile's address. Not in date order. */
  release: number
  /** The day Esri published this version of the whole map. */
  publishedYmd: string
  /** The metadata service that names each photograph's day, when the release has one. */
  metadataUrl: string | null
}

/** Esri's list of releases, newest first. A row it cannot read is left out. */
export function parseWaybackReleases(config: unknown): WaybackRelease[] {
  if (!config || typeof config !== 'object') return []
  const out: WaybackRelease[] = []
  for (const [key, raw] of Object.entries(config as Record<string, unknown>)) {
    const release = Number(key)
    if (!Number.isInteger(release) || release <= 0 || !raw || typeof raw !== 'object') continue
    const row = raw as { itemTitle?: unknown; metadataLayerUrl?: unknown }
    const ymd = typeof row.itemTitle === 'string' ? /(\d{4}-\d{2}-\d{2})/.exec(row.itemTitle)?.[1] : undefined
    if (!ymd) continue
    const metadataUrl = typeof row.metadataLayerUrl === 'string' && row.metadataLayerUrl.startsWith('https://') ? row.metadataLayerUrl : null
    out.push({ release, publishedYmd: ymd, metadataUrl })
  }
  return out.sort((a, b) => (a.publishedYmd < b.publishedYmd ? 1 : a.publishedYmd > b.publishedYmd ? -1 : b.release - a.release))
}

/** A release's tiles, as a Leaflet layer address. */
export function waybackTileTemplate(release: number): string {
  return `${WAYBACK_HOST}/WMTS/1.0.0/default028mm/MapServer/tile/${release}/{z}/{y}/{x}`
}

/** The question a walk asks: which release does this tile really come from? */
export function waybackTilemapUrl(release: number, tile: MapTile): string {
  return `${WAYBACK_HOST}/MapServer/tilemap/${release}/${tile.z}/${tile.y}/${tile.x}`
}

export type TilemapAnswer = {
  /** The archive has a picture of this tile in this release. */
  has: boolean
  /** The release the picture really comes from: this one, or an earlier one it was kept from. */
  actualRelease: number
  /** The picture's size in bytes. Two stops of one size are one photograph published twice. */
  size: number | null
}

export function readTilemapAnswer(json: unknown, asked: number): TilemapAnswer {
  const row = (json && typeof json === 'object' ? json : {}) as { data?: unknown; select?: unknown; size?: unknown }
  const has = Array.isArray(row.data) && row.data[0] === 1
  const select = Array.isArray(row.select) && Number.isInteger(row.select[0]) ? (row.select[0] as number) : asked
  const size = Array.isArray(row.size) && typeof row.size[0] === 'number' && row.size[0] > 0 ? row.size[0] : null
  return { has, actualRelease: select, size }
}

/**
 * Where the walk goes next: the release published before the one the tile came from. `null` ends
 * the walk, at the oldest release or at a release the list does not know.
 */
export function nextWalkIndex(releases: ReadonlyArray<WaybackRelease>, actualRelease: number): number | null {
  const at = releases.findIndex((r) => r.release === actualRelease)
  if (at < 0 || at + 1 >= releases.length) return null
  return at + 1
}

/** The metadata layer for a zoom: layer 0 is the finest (zoom 23) and layer 13 the coarsest (zoom 10). */
export function waybackMetadataLayerId(zoom: number = OLDER_PHOTOS_ZOOM): number {
  return Math.max(0, Math.min(13, 23 - Math.round(zoom)))
}

/** The question that names a photograph's day at a spot. */
export function waybackMetadataQueryUrl(metadataUrl: string, spot: MapSpot, zoom: number = OLDER_PHOTOS_ZOOM): string {
  const q = new URLSearchParams({
    f: 'json',
    outFields: 'SRC_DATE2,NICE_NAME',
    geometry: `${spot.lng.toFixed(6)},${spot.lat.toFixed(6)}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    returnGeometry: 'false',
  })
  return `${metadataUrl.replace(/\/+$/, '')}/${waybackMetadataLayerId(zoom)}/query?${q.toString()}`
}

/** The day a photograph was taken, from the metadata's answer. `null` when it does not say. */
export function readTakenYmd(json: unknown): string | null {
  const features = (json && typeof json === 'object' ? (json as { features?: unknown }).features : null) as unknown
  if (!Array.isArray(features)) return null
  for (const f of features) {
    const ms = (f as { attributes?: { SRC_DATE2?: unknown } } | null)?.attributes?.SRC_DATE2
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) continue
    const d = new Date(ms)
    const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    if (d.getUTCFullYear() >= 1990) return ymd
  }
  return null
}

/**
 * One stop of the walk: one photograph. `release` is the newest release that shows it, and never
 * changes, so a pick holds while the walk goes on. `publishedYmd` is the day Esri first published
 * it, which moves back as the walk meets it in earlier releases. `takenYmd` is `undefined` while
 * its day is being asked and `null` when the archive gave none.
 */
export type OlderPhotoFound = {
  release: number
  publishedYmd: string
  size: number | null
  takenYmd?: string | null
}

/**
 * Whether a stop is a photograph the walk has not met yet. The walk goes newest to oldest, and a
 * tile published again unchanged keeps its size, so a stop of the last stop's size is the same
 * photograph and is passed over.
 */
export function isNewPhoto(found: ReadonlyArray<OlderPhotoFound>, size: number | null): boolean {
  const last = found[found.length - 1]
  return !last || last.size == null || size == null || last.size !== size
}

export type OlderPhotoChoice = {
  /** The release whose tiles draw it. */
  release: number
  /** Every stop this press stands for: two stops with one taken day are one photograph. */
  releases: number[]
  /** The day the choice is ordered by: the day the photograph was taken, or else the day it was first published. */
  ymd: string
  /** `ymd` is the day the photograph was taken. */
  taken: boolean
  /** Its day is still being asked. */
  asking: boolean
  /** The short name on its press: `Mar 2019`, or `Before Jun 2018` while only its publishing day is known. */
  label: string
  /** The sentence under the map. */
  caption: string
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function parts(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split('-').map((n) => Number(n))
  return { y: y ?? 0, m: Math.max(1, Math.min(12, m ?? 1)), d: d ?? 1 }
}

/** A day in full: `March 12, 2019`. */
export function olderPhotoLongDay(ymd: string): string {
  const { y, m, d } = parts(ymd)
  return `${MONTHS_LONG[m - 1]} ${d}, ${y}`
}

/**
 * The presses, oldest first, every photograph the walk has found.
 *
 * A photograph is named by the day it was taken. That day comes slowly and not always, and the day
 * Esri published a picture can be years after it was taken, so a photograph whose day is not known
 * is named `Before` its publishing month, which is all that is true of it. Two stops with one taken
 * day are one photograph, and the newest release stands for it.
 */
export function olderPhotoChoices(found: ReadonlyArray<OlderPhotoFound>): OlderPhotoChoice[] {
  type Row = { release: number; releases: number[]; ymd: string; taken: boolean; asking: boolean }
  const rows: Row[] = []
  const byTakenDay = new Map<string, Row>()
  for (const f of found) {
    if (f.takenYmd) {
      const kept = byTakenDay.get(f.takenYmd)
      if (kept) {
        kept.releases.push(f.release)
        continue
      }
      const row: Row = { release: f.release, releases: [f.release], ymd: f.takenYmd, taken: true, asking: false }
      byTakenDay.set(f.takenYmd, row)
      rows.push(row)
    } else {
      rows.push({ release: f.release, releases: [f.release], ymd: f.publishedYmd, taken: false, asking: f.takenYmd === undefined })
    }
  }
  rows.sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : a.taken === b.taken ? 0 : a.taken ? -1 : 1))
  const monthCount = new Map<string, number>()
  const monthKey = (r: Row) => `${r.taken ? 't' : 'p'}:${r.ymd.slice(0, 7)}`
  for (const r of rows) monthCount.set(monthKey(r), (monthCount.get(monthKey(r)) ?? 0) + 1)
  return rows.map((r) => {
    const { y, m, d } = parts(r.ymd)
    const shared = (monthCount.get(monthKey(r)) ?? 0) > 1
    const day = shared ? `${MONTHS_SHORT[m - 1]} ${d}, ${y}` : `${MONTHS_SHORT[m - 1]} ${y}`
    const label = r.taken ? day : `Before ${day}`
    const caption = r.taken
      ? `Photo taken ${olderPhotoLongDay(r.ymd)}.`
      : r.asking
        ? `Esri published this picture on ${olderPhotoLongDay(r.ymd)}. Finding the day it was taken…`
        : `Esri published this picture on ${olderPhotoLongDay(r.ymd)}. It was taken before that, and the archive did not say when.`
    return { ...r, label, caption }
  })
}

/** What a screen holds of one walk, with the tile it was walked for. */
export type OlderPhotosHeld = { key: string | null; found: OlderPhotoFound[]; looking: 'walk' | 'days' | null }

/**
 * What to show for the tile asked about now (v2.7870).
 *
 * A screen learns of a new ask one frame before its walk begins, so for that frame what it holds is
 * another tile's walk, or none. Read as it stood, that frame said the archive had nothing for a spot
 * it had not yet looked at. So an ask that what is held does not answer is a walk that is under way:
 * nothing found yet, and looking.
 */
export function olderPhotosForAsk(askKey: string | null, held: OlderPhotosHeld): Pick<OlderPhotosHeld, 'found' | 'looking'> {
  if (askKey == null) return { found: [], looking: null }
  if (held.key !== askKey) return { found: [], looking: 'walk' }
  return { found: held.found, looking: held.looking }
}

/** Whether every photograph of a finished walk has its day: only such a walk is worth keeping past the visit. */
export function olderPhotosSettled(found: ReadonlyArray<OlderPhotoFound>): boolean {
  return found.length > 0 && found.every((f) => typeof f.takenYmd === 'string')
}

/** What is kept on the device for a tile: the walk and the day it was made. */
export type KeptOlderPhotos = { at: string; found: OlderPhotoFound[] }
/** A kept walk is read for a week: Esri publishes about once a month. */
export const OLDER_PHOTOS_KEEP_DAYS = 7

/** Read a kept walk back, or nothing when it is stale, torn or not a walk. */
export function readKeptOlderPhotos(raw: string | null, todayYmd: string): OlderPhotoFound[] | null {
  if (!raw) return null
  let kept: unknown
  try {
    kept = JSON.parse(raw)
  } catch {
    return null
  }
  const row = kept as Partial<KeptOlderPhotos> | null
  if (!row || typeof row.at !== 'string' || !Array.isArray(row.found)) return null
  const age = (Date.parse(`${todayYmd}T00:00:00Z`) - Date.parse(`${row.at}T00:00:00Z`)) / 86400000
  if (!Number.isFinite(age) || age < 0 || age > OLDER_PHOTOS_KEEP_DAYS) return null
  const found: OlderPhotoFound[] = []
  for (const f of row.found as unknown[]) {
    const s = f as Partial<OlderPhotoFound> | null
    if (!s || !Number.isInteger(s.release) || typeof s.publishedYmd !== 'string' || typeof s.takenYmd !== 'string') return null
    found.push({ release: s.release as number, publishedYmd: s.publishedYmd, size: typeof s.size === 'number' ? s.size : null, takenYmd: s.takenYmd })
  }
  return found.length > 0 ? found : null
}

/** Google Earth at a spot, looking straight down from about 700 metres. Its own time slider has Google's older photos. */
export function googleEarthUrl(spot: MapSpot): string {
  return `https://earth.google.com/web/@${spot.lat.toFixed(6)},${spot.lng.toFixed(6)},0a,700d,35y,0h,0t,0r`
}
