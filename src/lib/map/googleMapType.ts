/**
 * The view a card offers over its dots, and what Google calls it (v2.7686).
 *
 * A card with a Satellite / Streets switch keeps one choice, and each canvas turns it into its own
 * layer: the Leaflet canvas lays imagery tiles over its streets, the Google canvas takes a map type.
 * Kept out of the canvas files so a card can import it without pulling a map library in.
 */
export type MapLayerChoice = 'satellite' | 'streets'

/** The two Google base maps a card may ask `PinsMapGoogleCanvas` for. */
export type GoogleMapTypeId = 'roadmap' | 'hybrid'

/**
 * Satellite is Google's `hybrid`: the photograph with the street names on it, since a leader reads a
 * place by its streets. Streets is the plain road map.
 */
export function googleMapTypeForLayer(layer: MapLayerChoice): GoogleMapTypeId {
  return layer === 'satellite' ? 'hybrid' : 'roadmap'
}

/**
 * Whether the map is a photograph. The canvas holds a photograph flat: zoomed in, Google tilts to its
 * 45° view where it has one, and a dot would sit off its spot.
 */
export function googleMapTypeIsImagery(mapTypeId: GoogleMapTypeId | null | undefined): boolean {
  return mapTypeId === 'hybrid'
}
