/**
 * The map under the magnifying glass on a Google canvas (punch list #387, step 3, the card's call 5),
 * kept for the page.
 *
 * Google bills by the map made. So there is one glass map: made the first time a finger places
 * something on a painted map, and used again for every drag and every painted map after it until
 * the page is loaded again. Between drags its box waits off the page.
 *
 * A second one is made only if the app's theme changed since: Google takes its light or dark look
 * when a map is made and not after.
 */
import { GOOGLE_MAP_STYLES } from '../../lib/map/googleMapLook'
import type { GoogleMapTypeId } from '../../lib/map/googleMapType'
import type { PaintedPoint } from '../../lib/paintedMap/paintedLine'

/** The map is this much bigger than the hole it shows through, so Google's own marks at its edges stay out of the glass. */
export const GLASS_MAP_PX = 240

type KeptGlass = { host: HTMLDivElement; map: google.maps.Map; scheme: 'DARK' | 'LIGHT' }
let kept: KeptGlass | null = null

/** The glass's map, made now if the page has none in this look. */
export function paintedGlassMap(scheme: 'DARK' | 'LIGHT', open: { center: PaintedPoint; zoom: number; mapTypeId: GoogleMapTypeId }): KeptGlass {
  if (kept && kept.scheme === scheme) return kept
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
  kept = { host, map, scheme }
  return kept
}

/** The glass's map if the page has made one. */
export function keptPaintedGlassMap(): KeptGlass | null {
  return kept
}

/** A new page, for a test. */
export function forgetPaintedGlassForTests(): void {
  kept = null
}
