/**
 * When the mouse wheel zooms a pins map — pure; `PinsMapCanvas` (Leaflet) and
 * `PinsMapGoogleCanvas` read it.
 *
 * A map that sits in a scrolling page catches the wheel on the way past and
 * zooms out. A card that passes `scrollZoomAfterClick` keeps the wheel for the
 * page until the map has been clicked once; the + / − buttons, dragging and
 * the pins work from the start. Phones have no wheel and keep their own
 * gestures, so the gate never applies there.
 */
export type MapScrollZoomGate = {
  isMobile: boolean
  /** The card asked for the gate (`scrollZoomAfterClick`). */
  afterClick: boolean
  /** The map has been clicked since it mounted. */
  clicked: boolean
}

/** The wheel scrolls the page, not the map. */
export function mapScrollZoomLocked(g: MapScrollZoomGate): boolean {
  return g.afterClick && !g.isMobile && !g.clicked
}

/** Leaflet's `scrollWheelZoom`: off on phones (as before), off on a desktop while the gate is locked. */
export function leafletScrollWheelZoom(g: MapScrollZoomGate): boolean {
  return !g.isMobile && !mapScrollZoomLocked(g)
}

/**
 * Google's `scrollwheel` option. `undefined` leaves the map's own default alone — every map
 * that did not ask for the gate, and phones, where `gestureHandling` already decides.
 */
export function googleScrollwheelOption(g: MapScrollZoomGate): boolean | undefined {
  if (!g.afterClick || g.isMobile) return undefined
  return g.clicked
}
