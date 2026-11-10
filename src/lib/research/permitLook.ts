/**
 * Permits, the look (punch list #302, PR 3 and 5): the pure steps behind the two pictures at the
 * top of a skim card and the swipe that answers it. What is asked of Street View, the words
 * under a picture, the map tiles that put a pin in the middle of a small still, and whether a
 * drag is an answer. No React, no Supabase.
 */
import type { ResearchPermitRow } from './permitResearch'
import type { SkimAnswer } from './permitSkim'

/** What Street View is asked for: the street address with its city and zip, so the camera faces the lot. */
export function streetViewLocation(row: Pick<ResearchPermitRow, 'address' | 'city' | 'zip' | 'lat' | 'lng'>): string | null {
  const street = (row.address ?? '').replace(/\s+/g, ' ').trim()
  if (street !== '') return [street, row.city, 'TX', row.zip].filter(Boolean).join(', ')
  if (row.lat != null && row.lng != null) return `${row.lat},${row.lng}`
  return null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2024-03" as "Mar 2024"; a bare year as itself; anything else as nothing. */
export function monthWords(month: string | null | undefined): string | null {
  const m = (month ?? '').match(/^(\d{4})(?:-(\d{2}))?$/)
  if (!m) return null
  const name = m[2] ? MONTHS[Number(m[2]) - 1] : null
  return name ? `${name} ${m[1]}` : (m[1] ?? null)
}

/** The words on the street view tile: when it was taken, so an old picture of an empty lot reads as one. */
export function streetViewWords(month: string | null | undefined): string {
  const taken = monthWords(month)
  return taken ? `Street view · ${taken}` : 'Street view'
}

export const NO_STREET_VIEW_WORDS = 'No street view · satellite'

/** One map tile and where it sits, in pixels from the still's top-left corner. */
export type PlacedTile = { key: string; x: number; y: number; z: number; left: number; top: number }

export const TILE_PX = 256

/**
 * The tiles that cover a still of a given size with a point in its middle, in the web-map scheme
 * every tile server here speaks. Returns each tile's column and row and where to draw it, so the
 * point lands on the centre of the still.
 */
export function tilesAround(lat: number, lng: number, zoom: number, width: number, height: number): PlacedTile[] {
  const n = 2 ** zoom
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat))
  const worldX = ((lng + 180) / 360) * n * TILE_PX
  const rad = (clampedLat * Math.PI) / 180
  const worldY = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n * TILE_PX
  const originX = worldX - width / 2
  const originY = worldY - height / 2
  const firstX = Math.floor(originX / TILE_PX)
  const lastX = Math.floor((originX + width - 1) / TILE_PX)
  const firstY = Math.floor(originY / TILE_PX)
  const lastY = Math.floor((originY + height - 1) / TILE_PX)
  const out: PlacedTile[] = []
  for (let ty = firstY; ty <= lastY; ty++) {
    if (ty < 0 || ty >= n) continue
    for (let tx = firstX; tx <= lastX; tx++) {
      const wrapped = ((tx % n) + n) % n
      out.push({ key: `${zoom}/${wrapped}/${ty}`, x: wrapped, y: ty, z: zoom, left: Math.round(tx * TILE_PX - originX), top: Math.round(ty * TILE_PX - originY) })
    }
  }
  return out
}

/** The street map's tile, from the server the app's maps already use. */
export function streetTileUrl(t: Pick<PlacedTile, 'x' | 'y' | 'z'>): string {
  return `https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`
}

/** The satellite tile, from the imagery the On site map already draws. */
export function satelliteTileUrl(t: Pick<PlacedTile, 'x' | 'y' | 'z'>): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${t.z}/${t.y}/${t.x}`
}

/** How far a card must be dragged to answer: a third of its width, and never less than 90 pixels. */
export function swipeThreshold(cardWidth: number): number {
  return Math.max(90, Math.round(cardWidth / 3))
}

/** The answer a finished drag makes: right keeps, left passes, a short drag is no answer. */
export function swipeAnswer(dx: number, cardWidth: number): SkimAnswer | null {
  const need = swipeThreshold(cardWidth)
  if (dx >= need) return 'keep'
  if (dx <= -need) return 'pass'
  return null
}

/** How strongly the word shows while the card is dragged: nothing at rest, whole at the threshold. */
export function swipeProgress(dx: number, cardWidth: number): number {
  return Math.max(-1, Math.min(1, dx / swipeThreshold(cardWidth)))
}

/**
 * Whether a touch may start a swipe. A mouse never does: a desk has keys. A touch that starts
 * within 24 pixels of the screen's left or right edge is the browser's own Back, so it is left alone.
 */
export function swipeMayStart(pointerType: string, clientX: number, viewportWidth: number): boolean {
  if (pointerType === 'mouse') return false
  return clientX >= 24 && clientX <= viewportWidth - 24
}

/** A drag that goes more down than across is a scroll, not a swipe. */
export function swipeIsScroll(dx: number, dy: number): boolean {
  return Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8
}
