/**
 * A painted map as a picture (punch list #345, PR 4b): where each tile, corner and dot lands on a
 * flat image. Pure: the browser part that loads tiles and paints a canvas is
 * `paintedMapPictureIo.ts`. A picture is a copy. It cannot be taken back and it goes out of date,
 * so it always carries the day it was made.
 */
import { boundsOfPoints, type PaintedPoint } from './paintedLine'

export const PICTURE_TILE = 256
/** The deepest tiles asked for. The view from above has this zoom nearly everywhere; deeper, a rural tile is a grey card. */
export const PICTURE_NATIVE_ZOOM = 18
/** The deepest the picture zooms. Past the native zoom the tiles are stretched, as the map on the screen does. */
export const PICTURE_MAX_ZOOM = 20
/** A map that is one point, or two on top of each other, is drawn this close. */
export const PICTURE_POINT_ZOOM = 18
export const PICTURE_WIDTH = 1200
export const PICTURE_HEIGHT = 900
/** Room kept around the line, so a dot at its end is not cut by the edge. */
export const PICTURE_PAD = 90

/** A point on the whole world's flat map at a zoom, in pixels. Web Mercator, as every tile is cut. */
export function worldPx(p: PaintedPoint, zoom: number): { x: number; y: number } {
  const scale = PICTURE_TILE * 2 ** zoom
  const lat = Math.max(-85.0511, Math.min(85.0511, p.lat))
  const sin = Math.sin((lat * Math.PI) / 180)
  return { x: ((p.lng + 180) / 360) * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale }
}

/** The window the picture looks through: a zoom, and the world pixel at its top left corner. */
export type PictureFrame = { zoom: number; left: number; top: number; width: number; height: number }

/**
 * The closest whole zoom that holds every point with room around it, centred on them. Null for a
 * map with nothing on it: there is no picture of nothing.
 */
export function pictureFrame(points: ReadonlyArray<PaintedPoint>, size: { width: number; height: number } = { width: PICTURE_WIDTH, height: PICTURE_HEIGHT }, pad: number = PICTURE_PAD): PictureFrame | null {
  const b = boundsOfPoints(points)
  if (!b) return null
  const sw = { lat: b.south, lng: b.west }
  const ne = { lat: b.north, lng: b.east }
  const flat = b.south === b.north && b.west === b.east
  let zoom = flat ? PICTURE_POINT_ZOOM : 1
  if (!flat) {
    for (let z = PICTURE_MAX_ZOOM; z >= 1; z--) {
      const a = worldPx(sw, z)
      const c = worldPx(ne, z)
      if (Math.abs(c.x - a.x) <= size.width - 2 * pad && Math.abs(a.y - c.y) <= size.height - 2 * pad) {
        zoom = z
        break
      }
    }
  }
  const a = worldPx(sw, zoom)
  const c = worldPx(ne, zoom)
  return { zoom, left: Math.round((a.x + c.x) / 2 - size.width / 2), top: Math.round((a.y + c.y) / 2 - size.height / 2), width: size.width, height: size.height }
}

/** Where a point lands in the picture, in pixels from its top left. */
export function picturePoint(frame: PictureFrame, p: PaintedPoint): { x: number; y: number } {
  const w = worldPx(p, frame.zoom)
  return { x: w.x - frame.left, y: w.y - frame.top }
}

export type PictureTile = { z: number; x: number; y: number; left: number; top: number; size: number }

/**
 * The tiles that cover the frame, each with where it is drawn and how large. Past the native zoom
 * a tile from the native zoom is drawn larger. A tile off the top or bottom of the world is left out.
 */
export function pictureTiles(frame: PictureFrame): PictureTile[] {
  const z = Math.min(frame.zoom, PICTURE_NATIVE_ZOOM)
  const stretch = 2 ** (frame.zoom - z)
  const size = PICTURE_TILE * stretch
  const count = 2 ** z
  const out: PictureTile[] = []
  const x0 = Math.floor(frame.left / size)
  const x1 = Math.floor((frame.left + frame.width - 1) / size)
  const y0 = Math.floor(frame.top / size)
  const y1 = Math.floor((frame.top + frame.height - 1) / size)
  for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= count) continue
    for (let tx = x0; tx <= x1; tx++) {
      out.push({ z, x: ((tx % count) + count) % count, y: ty, left: tx * size - frame.left, top: ty * size - frame.top, size })
    }
  }
  return out
}

/** The view from above, one tile. The same source the map on the screen draws. */
export function pictureTileUrl(t: Pick<PictureTile, 'z' | 'x' | 'y'>): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${t.z}/${t.y}/${t.x}`
}
/** Written beside the first point of the first line, on a picture and on a printed page. */
export const PICTURE_START_WORD = 'Start'
/** Said on every picture: the tiles' own terms ask for it. */
export const PICTURE_ATTRIBUTION = 'Imagery © Esri, Maxar, Earthstar Geographics'

/** `the-way-in-for-deliveries.jpg`: a name a phone's share sheet and a Drive folder can both show. */
export function pictureFileName(mapName: string, ext: string = 'jpg'): string {
  const slug = mapName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return `${slug || 'painted-map'}.${ext}`
}

/** The words under a picture and on a printed page, so a copy says what it is and how old it is. */
export const PAINTED_MAP_COPY_WORDS = {
  /** Said in the sheet before a copy is made. */
  rule: 'A copy cannot be taken back, and it goes out of date. Send the link when you can.',
  guide: 'A length here is a guide for how far. It is not a measurement.',
  stale: 'A printed map goes out of date. Scan the code for the map as it is today.',
  staleNoCode: 'A printed map goes out of date. Ask whoever gave it to you for the map as it is today.',
} as const

/** `Made Nov 13, 2026` from a calendar day. Empty for a day that is not one. */
export function copyMadeWords(ymd: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? '')
  if (!m) return ''
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1]
  return month ? `Made ${month} ${Number(m[3])}, ${m[1]}` : ''
}

/** A place as the key under a picture reads it: `Truck gate. Close it behind you.` */
export function pictureKeyLine(place: { name: string; words: string }): string {
  const name = place.name.trim()
  const words = place.words.trim()
  if (!words) return name
  return /[.!?]$/.test(name) ? `${name} ${words}` : `${name}. ${words}`
}
