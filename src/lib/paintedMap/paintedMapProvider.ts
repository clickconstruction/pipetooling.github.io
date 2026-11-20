/**
 * Which map a painted map's canvas draws on (punch list #387): Google's, or the Leaflet canvas it
 * has drawn on since #345. Pure. The painting window and the public page read it, and nothing else
 * decides.
 *
 * The app's one provider rule comes first (`resolveDashboardMapProvider`): Google with a browser key
 * and no failure on this page, Leaflet otherwise. A painted map asks three things more.
 *
 * - **The screen.** Google bills by the map opened. The painting window is staff only. The public
 *   page is opened by every outside reader a link reaches, so it waits for the owner's look at the
 *   billing console.
 * - **The use.** The Google canvas is built a step at a time, looking first. A use it does not carry
 *   yet draws on Leaflet however good the key is.
 * - **Esri's photograph on the screen.** Time's archive is Esri's, and so is a picture of the map.
 *   Google's terms keep a map that is not Google's away from one that is (3.2.3 (e)), so the Google
 *   canvas is down while either shows and the Leaflet canvas takes its place, as on every Time map.
 *
 * The Leaflet canvas is never retired. It is the fall back, and it is the canvas Time draws on.
 */
import { resolveDashboardMapProvider, type DashboardJobsMapProvider } from '../dashboardJobsMap'

/** What a painted map's canvas draws on. The same two words every other map in the app answers with. */
export type PaintedMapProvider = DashboardJobsMapProvider

/** The two screens that mount the painting canvas: the painting window, and the public page at `/way`. */
export type PaintedMapScreen = 'window' | 'way'

/**
 * What the canvas is being used for.
 * - `looking`: the map is read. Its lines, its places, the reader's own dot.
 * - `drawing`: a line is drawn or its corners are moved, by hand.
 * - `placing`: a place's dot is put down.
 * - `walking`: a walk is painting a line from the phone's readings.
 */
export type PaintedMapUse = 'looking' | 'drawing' | 'placing' | 'walking'

/** How far Google has come on painted maps: the screens that may draw on it, and the uses its canvas carries. */
export type PaintedGoogleReach = {
  screens: ReadonlyArray<PaintedMapScreen>
  uses: ReadonlyArray<PaintedMapUse>
}

/**
 * How far it has come today: nowhere. This step is the rule alone, and no screen reads it yet.
 *
 * Each step of the train adds its own word here, in the change that builds the part.
 * - A Google canvas for looking adds `window` and `looking`, once the owner has read the month's
 *   count of maps opened in the billing console.
 * - Drawing on Google adds `drawing`, `placing` and `walking`. A line drawn by hand over Google's
 *   photograph also waits on a reading of Google's terms on content made from its imagery (3.2.3 (c)).
 * - The public page adds `way`, and never before the billing look says yes. It also needs the frame
 *   that keeps a reader and the line in the picture together.
 */
export const PAINTED_GOOGLE_REACH: PaintedGoogleReach = { screens: [], uses: [] }

export type PaintedMapProviderAsk = {
  /** The browser key (`googleMapsBrowserKey()`). Empty when the build has none. */
  key: string
  /** Google failed on this page: a refused key, a script that never came, a map that never painted. Kept for the visit, so a bad key never flickers. */
  googleFailed: boolean
  /** The screen the canvas is on. */
  screen: PaintedMapScreen
  /** What the canvas is being used for now. */
  use: PaintedMapUse
  /** Time is on, whether or not a date shows yet. */
  timeOn?: boolean
  /** A picture of the map is on the screen: the Share sheet is showing one it made. */
  pictureUp?: boolean
}

/**
 * The map the canvas draws on. Google only when every answer is yes: a key, no failure, a screen and
 * a use within Google's reach, and none of Esri's photographs on the screen.
 */
export function resolvePaintedMapProvider(ask: PaintedMapProviderAsk, reach: PaintedGoogleReach = PAINTED_GOOGLE_REACH): PaintedMapProvider {
  if (resolveDashboardMapProvider({ key: ask.key, googleFailed: ask.googleFailed }) !== 'google') return 'osm'
  if (!reach.screens.includes(ask.screen)) return 'osm'
  if (!reach.uses.includes(ask.use)) return 'osm'
  if (ask.timeOn === true || ask.pictureUp === true) return 'osm'
  return 'google'
}

/** The painting window's five modes (`PaintedMapWindow`). */
export type PaintedWindowMode = 'view' | 'draw' | 'place' | 'walk' | 'review'

/**
 * What the painting window is using its canvas for, from its mode and not from what it hands the
 * canvas.
 *
 * A walk is walking from its first reading to Done, paused or not. Read from the canvas's own props
 * a paused walk would look like a map being read, and the map would change under the walker each
 * time they stopped. Each change back would also open one more map on Google's count.
 *
 * Look it over is looking: the walk's lines wait on the phone and none is being moved. Fixing one of
 * them by hand is drawing.
 */
export function paintedWindowUse(mode: PaintedWindowMode): PaintedMapUse {
  switch (mode) {
    case 'draw':
      return 'drawing'
    case 'place':
      return 'placing'
    case 'walk':
      return 'walking'
    case 'view':
    case 'review':
      return 'looking'
  }
}

/** What a picture or a printed page of a painted map is stitched from. */
export type PaintedPictureProvider = 'esri'

/**
 * The picture's own rule, read by what the canvas draws on: Esri's photograph either way.
 *
 * A picture and a printed page are map tiles stitched into one image, and the image leaves the app:
 * by text, on paper, into a job's folder. Google's terms keep its tiles inside its own map (3.2.3 (a)
 * and (b): none taken out, none kept). So a map read over Google's photograph is still pictured over
 * Esri's, and the two photographs of one spot can sit a few feet apart.
 */
export const PAINTED_PICTURE_PROVIDER: Readonly<Record<PaintedMapProvider, PaintedPictureProvider>> = { google: 'esri', osm: 'esri' }
