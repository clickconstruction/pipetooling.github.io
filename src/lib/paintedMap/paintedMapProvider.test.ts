import { describe, expect, it } from 'vitest'
import { pictureTileUrl, PICTURE_ATTRIBUTION } from './paintedMapPicture'
import {
  PAINTED_GOOGLE_REACH,
  PAINTED_PICTURE_PROVIDER,
  paintedMapKeepsLeaflet,
  paintedWindowUse,
  resolvePaintedMapProvider,
  type PaintedGoogleReach,
  type PaintedMapProviderAsk,
  type PaintedMapScreen,
  type PaintedMapUse,
  type PaintedWindowMode,
} from './paintedMapProvider'

const SCREENS: PaintedMapScreen[] = ['window', 'way']
const USES: PaintedMapUse[] = ['looking', 'drawing', 'placing', 'walking']
/** The train finished: every screen and every use on Google. */
const EVERYWHERE: PaintedGoogleReach = { screens: SCREENS, uses: USES }
/** After the second step: the painting window, for looking. */
const WINDOW_LOOKING: PaintedGoogleReach = { screens: ['window'], uses: ['looking'] }

/** A made-up key. The rule reads only whether there is one. */
const KEY = 'made-up-key'
const ask = (over: Partial<PaintedMapProviderAsk> = {}): PaintedMapProviderAsk => ({ key: KEY, googleFailed: false, screen: 'window', use: 'looking', ...over })

describe('resolvePaintedMapProvider', () => {
  it('draws on Google with a key, no failure, and a screen and a use within reach', () => {
    for (const screen of SCREENS) for (const use of USES) expect(resolvePaintedMapProvider(ask({ screen, use }), EVERYWHERE)).toBe('google')
  })

  it('keeps the app’s own rule first: no key is Leaflet, on every screen and for every use', () => {
    for (const screen of SCREENS) for (const use of USES) expect(resolvePaintedMapProvider(ask({ key: '', screen, use }), EVERYWHERE)).toBe('osm')
  })

  it('falls back once Google has failed on the page, and stays there', () => {
    for (const screen of SCREENS) for (const use of USES) expect(resolvePaintedMapProvider(ask({ googleFailed: true, screen, use }), EVERYWHERE)).toBe('osm')
  })

  it('leaves a screen outside Google’s reach on Leaflet however good the key is', () => {
    expect(resolvePaintedMapProvider(ask({ screen: 'window' }), WINDOW_LOOKING)).toBe('google')
    expect(resolvePaintedMapProvider(ask({ screen: 'way' }), WINDOW_LOOKING)).toBe('osm')
  })

  it('leaves a use the Google canvas does not carry yet on Leaflet', () => {
    expect(resolvePaintedMapProvider(ask({ use: 'looking' }), WINDOW_LOOKING)).toBe('google')
    for (const use of ['drawing', 'placing', 'walking'] as const) expect(resolvePaintedMapProvider(ask({ use }), WINDOW_LOOKING)).toBe('osm')
  })

  it('takes the Google canvas down while Time is on: the archive is Esri’s', () => {
    expect(resolvePaintedMapProvider(ask({ timeOn: true }), EVERYWHERE)).toBe('osm')
    expect(resolvePaintedMapProvider(ask({ timeOn: false }), EVERYWHERE)).toBe('google')
  })

  it('takes the Google canvas down while a picture of the map is on the screen: the picture is Esri’s', () => {
    expect(resolvePaintedMapProvider(ask({ pictureUp: true }), EVERYWHERE)).toBe('osm')
    expect(resolvePaintedMapProvider(ask({ pictureUp: false }), EVERYWHERE)).toBe('google')
  })

  it('keeps the Leaflet canvas on a screen that has left Google’s map to make something', () => {
    expect(resolvePaintedMapProvider(ask({ keptOnLeaflet: true }), EVERYWHERE)).toBe('osm')
    expect(resolvePaintedMapProvider(ask({ keptOnLeaflet: false }), EVERYWHERE)).toBe('google')
  })

  it('draws a still on the Leaflet canvas, the only one that draws one', () => {
    expect(resolvePaintedMapProvider(ask({ still: true }), EVERYWHERE)).toBe('osm')
  })

  it('reads today’s reach when it is handed none', () => {
    expect(resolvePaintedMapProvider(ask())).toBe(resolvePaintedMapProvider(ask(), PAINTED_GOOGLE_REACH))
  })
})

describe('PAINTED_GOOGLE_REACH, today', () => {
  it('puts both screens on Google for every use', () => {
    for (const screen of SCREENS) for (const use of USES) expect(resolvePaintedMapProvider(ask({ screen, use }))).toBe('google')
  })

  it('still takes Google’s map down for Time, for a picture of the map and for a still, whatever is within reach', () => {
    for (const use of USES) {
      expect(resolvePaintedMapProvider(ask({ use, timeOn: true }))).toBe('osm')
      expect(resolvePaintedMapProvider(ask({ use, pictureUp: true }))).toBe('osm')
      expect(resolvePaintedMapProvider(ask({ use, still: true }))).toBe('osm')
    }
  })

  it('puts a place’s dot down on Google (step 3)', () => {
    expect(PAINTED_GOOGLE_REACH.uses).toContain('placing')
    expect(resolvePaintedMapProvider(ask({ use: paintedWindowUse('place') }))).toBe('google')
  })

  it('paints a walk on Google from its first reading to Done (step 3)', () => {
    expect(PAINTED_GOOGLE_REACH.uses).toContain('walking')
    expect(resolvePaintedMapProvider(ask({ use: paintedWindowUse('walk') }))).toBe('google')
  })

  it('puts the public page on Google, on Taunya’s yes of 2026-11-21', () => {
    // Every outside reader's open counts. The line that held it off came out with that yes: no link had yet been
    // made, and people alone made 10 to 40 map loads a day against the free 10,000 a month.
    expect(PAINTED_GOOGLE_REACH.screens).toContain('way')
  })

  it('draws a line by hand on Google (step 3), on Taunya’s word from her lawyer of 2026-11-21', () => {
    // The reading of Google's terms it waited on (3.2.3 (c)) is the card's call 6. The word went in with the part of
    // the Google canvas that draws corners.
    expect(PAINTED_GOOGLE_REACH.uses).toContain('drawing')
    expect(resolvePaintedMapProvider(ask({ use: paintedWindowUse('draw') }))).toBe('google')
  })
})

describe('paintedMapKeepsLeaflet', () => {
  it('starts keeping when a line, a place or a walk is made on the Leaflet canvas', () => {
    for (const use of ['drawing', 'placing', 'walking'] as const) expect(paintedMapKeepsLeaflet(false, { provider: 'osm', use })).toBe(true)
  })

  it('starts keeping when a picture of the map is shown', () => {
    expect(paintedMapKeepsLeaflet(false, { provider: 'osm', use: 'looking', pictureUp: true })).toBe(true)
  })

  it('never lets go: back to looking, the screen is still on Leaflet', () => {
    expect(paintedMapKeepsLeaflet(true, { provider: 'osm', use: 'looking' })).toBe(true)
    expect(paintedMapKeepsLeaflet(true, { provider: 'google', use: 'looking' })).toBe(true)
  })

  it('does not keep for Time, or for a map that is only being read on Leaflet', () => {
    // Time puts the canvas on Leaflet while the map is still only being looked at.
    expect(paintedMapKeepsLeaflet(false, { provider: 'osm', use: 'looking' })).toBe(false)
  })

  it('does not keep when the making is on Google', () => {
    // After the step that draws on Google there is nothing to keep away from.
    for (const use of ['drawing', 'placing', 'walking'] as const) expect(paintedMapKeepsLeaflet(false, { provider: 'google', use })).toBe(false)
  })

  it('holds a painter on one photograph from the first corner to the window’s close: Google’s, now that every use is within reach', () => {
    // Read, draw, save and read again, in the window as it is today.
    let kept = false
    const seen: string[] = []
    for (const mode of ['view', 'draw', 'view', 'place', 'view'] as const) {
      const use = paintedWindowUse(mode)
      const provider = resolvePaintedMapProvider(ask({ use, keptOnLeaflet: kept }))
      seen.push(provider)
      kept = paintedMapKeepsLeaflet(kept, { provider, use })
    }
    expect(seen).toEqual(['google', 'google', 'google', 'google', 'google'])
    expect(kept).toBe(false)
  })

  it('still holds a painter on the Leaflet map once a line was drawn there, as when Google was out of reach for drawing', () => {
    let kept = false
    const seen: string[] = []
    for (const mode of ['view', 'draw', 'view', 'place', 'view'] as const) {
      const use = paintedWindowUse(mode)
      const provider = resolvePaintedMapProvider(ask({ use, keptOnLeaflet: kept }), WINDOW_LOOKING)
      seen.push(provider)
      kept = paintedMapKeepsLeaflet(kept, { provider, use })
    }
    expect(seen).toEqual(['google', 'osm', 'osm', 'osm', 'osm'])
  })
})

describe('paintedWindowUse', () => {
  it('names each of the window’s modes', () => {
    const want: Record<PaintedWindowMode, PaintedMapUse> = { view: 'looking', review: 'looking', draw: 'drawing', place: 'placing', walk: 'walking' }
    for (const mode of Object.keys(want) as PaintedWindowMode[]) expect(paintedWindowUse(mode)).toBe(want[mode])
  })

  it('is placing already in a window opened to add a place, before its panel is up', () => {
    expect(paintedWindowUse('view', true)).toBe('placing')
    // So the map is one map through the wait, whichever it is: never made only to be taken down a moment later.
    expect(resolvePaintedMapProvider(ask({ use: paintedWindowUse('view', true) }))).toBe(resolvePaintedMapProvider(ask({ use: paintedWindowUse('place') })))
    expect(resolvePaintedMapProvider(ask({ use: paintedWindowUse('view', true) }), WINDOW_LOOKING)).toBe('osm')
    // Only the wait is placing. Every other mode says what it is.
    expect(paintedWindowUse('review', true)).toBe('looking')
    expect(paintedWindowUse('draw', true)).toBe('drawing')
    expect(paintedWindowUse('walk', true)).toBe('walking')
  })

  it('keeps a walk on one map from its first reading to Done, paused or not', () => {
    // The mode is `walk` either way, so the answer cannot change at a pause.
    expect(resolvePaintedMapProvider(ask({ use: paintedWindowUse('walk') }), WINDOW_LOOKING)).toBe('osm')
    expect(resolvePaintedMapProvider(ask({ use: paintedWindowUse('walk') }), EVERYWHERE)).toBe('google')
  })

  it('reads a saved map and a walk being looked over on Google once looking is within reach', () => {
    expect(resolvePaintedMapProvider(ask({ use: paintedWindowUse('view') }), WINDOW_LOOKING)).toBe('google')
    expect(resolvePaintedMapProvider(ask({ use: paintedWindowUse('review') }), WINDOW_LOOKING)).toBe('google')
    expect(resolvePaintedMapProvider(ask({ use: paintedWindowUse('draw') }), WINDOW_LOOKING)).toBe('osm')
    expect(resolvePaintedMapProvider(ask({ use: paintedWindowUse('place') }), WINDOW_LOOKING)).toBe('osm')
  })
})

describe('the picture’s own rule', () => {
  it('is Esri’s photograph whatever the canvas draws on', () => {
    expect(PAINTED_PICTURE_PROVIDER.google).toBe('esri')
    expect(PAINTED_PICTURE_PROVIDER.osm).toBe('esri')
  })

  it('is the rule the picture’s own tiles follow', () => {
    // The picture and the print both stitch these. A tile from Google here would break its terms.
    expect(new URL(pictureTileUrl({ z: 18, x: 60000, y: 100000 })).hostname).toBe('server.arcgisonline.com')
    expect(PICTURE_ATTRIBUTION).toContain('Esri')
  })
})
