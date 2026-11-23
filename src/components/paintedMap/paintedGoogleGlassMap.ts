/**
 * The map under the magnifying glass on a Google canvas (punch list #387, step 3, the card's call 5),
 * kept for the page.
 *
 * Google bills by the map made. So there is one glass map: made the first time a finger places
 * something on a painted map, and used again for every drag and every painted map after it until
 * the page is loaded again. Between drags its box waits off the page.
 *
 * Google takes its light or dark look when a map is made and not after, so there is one for each
 * look the page has placed in: two at the most, however often the theme is changed back and forth.
 *
 * How close the glass's map is drawn is asked of Google once a held press (`askGlassDepth`), the
 * owner's choice of 2026-11-22. Asking makes no map.
 */
import { GOOGLE_MAP_STYLES } from '../../lib/map/googleMapLook'
import type { GoogleMapTypeId } from '../../lib/map/googleMapType'
import type { PaintedPoint } from '../../lib/paintedMap/paintedLine'

/** The map is this much bigger than the hole it shows through, so Google's own marks at its edges stay out of the glass. */
export const GLASS_MAP_PX = 240

type KeptGlass = { host: HTMLDivElement; map: google.maps.Map; scheme: 'DARK' | 'LIGHT' }
const kept: Partial<Record<'DARK' | 'LIGHT', KeptGlass>> = {}

/** The glass's map, made now if the page has none in this look. */
export function paintedGlassMap(scheme: 'DARK' | 'LIGHT', open: { center: PaintedPoint; zoom: number; mapTypeId: GoogleMapTypeId }): KeptGlass {
  const was = kept[scheme]
  if (was) return was
  const host = document.createElement('div')
  host.style.cssText = `position:absolute;width:${GLASS_MAP_PX}px;height:${GLASS_MAP_PX}px;pointer-events:none`
  const map = new google.maps.Map(host, {
    center: { lat: open.center.lat, lng: open.center.lng },
    zoom: open.zoom,
    mapTypeId: open.mapTypeId,
    tilt: 0,
    colorScheme: scheme,
    disableDefaultUI: true,
    gestureHandling: 'none',
    keyboardShortcuts: false,
    clickableIcons: false,
    // The look every Google map in the app wears: Google's own place labels off, as on the map the glass rides over.
    styles: GOOGLE_MAP_STYLES,
  })
  const made: KeptGlass = { host, map, scheme }
  kept[scheme] = made
  return made
}

/** The glass's map in this look, if the page has made one. */
export function keptPaintedGlassMap(scheme: 'DARK' | 'LIGHT'): KeptGlass | null {
  return kept[scheme] ?? null
}

let depths: google.maps.MaxZoomService | null = null

/**
 * How deep Google's photograph goes at a spot: the deepest zoom it has a picture for there. Asked once each time a
 * finger is held to place, never as the finger moves. It is one small request to Google, and Google's own script
 * keeps the answer for the same spot. Null when Google cannot say: the glass then draws as it did before.
 */
export async function askGlassDepth(at: PaintedPoint): Promise<number | null> {
  const Service = google.maps.MaxZoomService
  if (typeof Service !== 'function') return null
  try {
    if (!depths) depths = new Service()
    const answer = await depths.getMaxZoomAtLatLng({ lat: at.lat, lng: at.lng })
    return Number.isFinite(answer.zoom) ? answer.zoom : null
  } catch {
    return null
  }
}

/**
 * On new ground Google can turn a kept map's closer zoom down for a moment, until it knows how deep its own picture
 * goes there. The glass asks again this often while the map is short of the zoom it wants. Seen 2026-11-22 on a page
 * with Google's own script: a second ask about 30 ms after the first was taken every time.
 */
export const GLASS_ASK_AGAIN_MS = 50
/** And gives up after this many tries, two seconds, leaving the glass drawn for the zoom the map is at. */
export const GLASS_ASK_AGAIN_TRIES = 40

/** A new page, for a test. */
export function forgetPaintedGlassForTests(): void {
  delete kept.DARK
  delete kept.LIGHT
  depths = null
}
