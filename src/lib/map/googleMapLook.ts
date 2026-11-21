/**
 * The look every Google map in the app wears (punch list #387): which of Google's own labels draw.
 *
 * Google's photograph with street names and its road map both carry Google's own labels for shops,
 * rooms, parks, landmarks and bus stops. At the zoom a site is read at there are a dozen around a
 * line or a dot, and one can sit under a dot. They cannot be pressed. The map is for the app's own
 * marks, so those labels are off and the street names, the road numbers and the names of towns and
 * neighbourhoods stay.
 *
 * It is Google's own `styles` option, which works on a map made with no Map ID, and none of the app's
 * maps has one. Over the photograph it reaches the labels, which is all that is asked of it. One
 * list, read by every Google canvas, so two maps cannot drift. It changes nothing about when or how
 * often a map is made.
 *
 * Kept out of the canvas files, so a test reads it without a map library.
 */

/** One rule of Google's map styling, as its style reference writes it. */
export type GoogleMapStyleRule = {
  featureType: string
  elementType: string
  stylers: Array<{ visibility: 'on' | 'off' | 'simplified' }>
}

/**
 * Google's own place labels, off. `labels` is the icon and the words, so a park keeps its green on
 * the road map and loses only its name. Roads and the names of places people live in are not named
 * here, so they draw as Google draws them.
 */
export const GOOGLE_MAP_STYLES: GoogleMapStyleRule[] = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
]
