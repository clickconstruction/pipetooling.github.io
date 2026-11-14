/**
 * A place's photo on a painted map (punch list #345): what the gate, the meter or the door looks
 * like. Pure: the object's name in the bucket and nothing else.
 *
 * The bucket's gate reads the map from the object's name (`<map id>/<file>`), so whoever can read
 * the map can read and add its photos. The name has one shape, and anything else reads as no photo.
 */
export const PAINTED_MAP_PHOTOS_BUCKET = 'painted-map-photos'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FILE = /^[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|png|webp)$/

/** `<map id>/<photo id>.jpg`. */
export function paintedPlacePhotoPath(mapId: string, photoId: string): string {
  return `${mapId}/${photoId}.jpg`
}

/** The map a path belongs to, or null for a name of any other shape. */
export function paintedPlacePhotoMap(path: string | null | undefined): string | null {
  const parts = (path ?? '').split('/')
  if (parts.length !== 2) return null
  const [mapId, file] = parts as [string, string]
  return UUID.test(mapId) && FILE.test(file) ? mapId : null
}

/** A path worth reading: non-empty and of the one shape. A stale or mangled column reads as no photo. */
export function isPaintedPlacePhotoPath(path: string | null | undefined): path is string {
  return paintedPlacePhotoMap(path) !== null
}

/**
 * What the place sheet says beside the words box. A link shows a map to anyone who holds it, so
 * nothing that opens a lock belongs on one.
 */
export const PAINTED_PLACE_NO_CODES_WORDS = 'Never type a gate code or a lock code here. Anyone this map is shared with would read it.'
