/**
 * A map's own switch between Google Maps and the OpenStreetMap map (v2.8032): the pick a person
 * makes with one press, kept on their device, and the rule that fits it inside what the page can draw.
 *
 * The page's own rule stands first (`resolveDashboardMapProvider`): Google only with a browser key,
 * and never again on this page once Google has failed. The pick chooses inside that. A person who
 * picked OpenStreetMap gets it. A person who picked Google, or never pressed, gets Google while it
 * can be drawn.
 *
 * Kept out of the canvas files so a card and a test can read it without pulling a map library in.
 */
export type MapProviderPick = 'google' | 'osm'

type PickStorage = Pick<Storage, 'getItem' | 'setItem'>

function deviceStorage(): PickStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** The pick this device keeps under `key`, or null when the person never pressed the switch. */
export function readMapProviderPick(key: string, storage: PickStorage | null = deviceStorage()): MapProviderPick | null {
  try {
    const kept = storage?.getItem(key)
    return kept === 'google' || kept === 'osm' ? kept : null
  } catch {
    return null
  }
}

/** Keeps the pick on this device. A phone that refuses storage keeps it for the visit alone, in the frame. */
export function writeMapProviderPick(key: string, pick: MapProviderPick, storage: PickStorage | null = deviceStorage()): void {
  try {
    storage?.setItem(key, pick)
  } catch {
    // The switch still works for this visit.
  }
}

/** Whether this page can draw a Google map at all: a browser key, and no failure of Google on this page. */
export function googleMapCanBeDrawn(input: { key: string; googleFailed: boolean }): boolean {
  return input.key.length > 0 && !input.googleFailed
}

/** Which canvas a map with the switch mounts: the person's pick, inside what the page can draw. */
export function resolvePickedMapProvider(input: { key: string; googleFailed: boolean; pick: MapProviderPick | null }): MapProviderPick {
  return googleMapCanBeDrawn(input) && input.pick !== 'osm' ? 'google' : 'osm'
}

/** The switch as it stands: the map a press goes to, and the words that name the press. */
export type MapProviderSwitch = { to: MapProviderPick; label: string }

export const MAP_PROVIDER_TO_OSM_WORDS = 'Switch to the OpenStreetMap map'
export const MAP_PROVIDER_TO_GOOGLE_WORDS = 'Switch to Google Maps'

/**
 * The switch a map wears, or null when there is nothing to switch between.
 *
 * - No key, or Google failed on this page: one map is all the page can draw, so no switch.
 * - Time is on: the photo archive is one provider's and draws on one canvas, so the switch waits
 *   until Time is left.
 */
export function mapProviderSwitch(input: { key: string; googleFailed: boolean; provider: MapProviderPick; inTime: boolean }): MapProviderSwitch | null {
  if (!googleMapCanBeDrawn(input) || input.inTime) return null
  return input.provider === 'google' ? { to: 'osm', label: MAP_PROVIDER_TO_OSM_WORDS } : { to: 'google', label: MAP_PROVIDER_TO_GOOGLE_WORDS }
}

/**
 * How far from the map's bottom edge a corner press sits, in px. One number for both maps, so a
 * press does not move when the map under it changes: it clears Google's logo and terms, and the
 * Leaflet map's credit line where a phone wraps it to two lines.
 */
export const MAP_CORNER_PRESS_BOTTOM_PX = 40
/** How far a corner press sits from the map's side edge, in px: Leaflet's own margin for its zoom buttons. */
export const MAP_CORNER_PRESS_SIDE_PX = 10
/** A corner press is a finger wide and tall. */
export const MAP_CORNER_PRESS_SIZE_PX = 40
