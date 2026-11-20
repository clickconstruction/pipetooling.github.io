import { describe, expect, it } from 'vitest'
import {
  MAP_PROVIDER_TO_GOOGLE_WORDS,
  MAP_PROVIDER_TO_OSM_WORDS,
  googleMapCanBeDrawn,
  mapProviderSwitch,
  readMapProviderPick,
  resolvePickedMapProvider,
  writeMapProviderPick,
} from './mapProviderPick'

function shelf(start: Record<string, string> = {}) {
  const kept = new Map(Object.entries(start))
  return {
    kept,
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => {
      kept.set(k, v)
    },
  }
}
const refusing = {
  getItem: () => {
    throw new Error('storage is off')
  },
  setItem: () => {
    throw new Error('storage is off')
  },
}

describe('the pick a device keeps', () => {
  it('reads nothing until the person has pressed the switch', () => {
    expect(readMapProviderPick('k', shelf())).toBeNull()
  })

  it('keeps a pick under the map’s own key and reads it back', () => {
    const s = shelf()
    writeMapProviderPick('my-map', 'osm', s)
    expect(s.kept.get('my-map')).toBe('osm')
    expect(readMapProviderPick('my-map', s)).toBe('osm')
    expect(readMapProviderPick('another-map', s)).toBeNull()
    writeMapProviderPick('my-map', 'google', s)
    expect(readMapProviderPick('my-map', s)).toBe('google')
  })

  it('reads a value it never wrote as no pick', () => {
    expect(readMapProviderPick('k', shelf({ k: 'leaflet' }))).toBeNull()
    expect(readMapProviderPick('k', shelf({ k: '' }))).toBeNull()
  })

  it('a phone that refuses storage reads no pick and takes a write without a throw', () => {
    expect(readMapProviderPick('k', refusing)).toBeNull()
    expect(() => writeMapProviderPick('k', 'osm', refusing)).not.toThrow()
    expect(readMapProviderPick('k', null)).toBeNull()
    expect(() => writeMapProviderPick('k', 'osm', null)).not.toThrow()
  })
})

describe('which map is drawn', () => {
  it('Google can be drawn with a key and no failure on the page', () => {
    expect(googleMapCanBeDrawn({ key: 'k', googleFailed: false })).toBe(true)
    expect(googleMapCanBeDrawn({ key: '', googleFailed: false })).toBe(false)
    expect(googleMapCanBeDrawn({ key: 'k', googleFailed: true })).toBe(false)
  })

  it('with no pick the map is Google while Google can be drawn', () => {
    expect(resolvePickedMapProvider({ key: 'k', googleFailed: false, pick: null })).toBe('google')
    expect(resolvePickedMapProvider({ key: '', googleFailed: false, pick: null })).toBe('osm')
    expect(resolvePickedMapProvider({ key: 'k', googleFailed: true, pick: null })).toBe('osm')
  })

  it('a pick of OpenStreetMap is kept whatever Google can do', () => {
    expect(resolvePickedMapProvider({ key: 'k', googleFailed: false, pick: 'osm' })).toBe('osm')
    expect(resolvePickedMapProvider({ key: '', googleFailed: false, pick: 'osm' })).toBe('osm')
  })

  it('a pick of Google never draws a map the page cannot: no key, or a failure, is OpenStreetMap', () => {
    expect(resolvePickedMapProvider({ key: 'k', googleFailed: false, pick: 'google' })).toBe('google')
    expect(resolvePickedMapProvider({ key: '', googleFailed: false, pick: 'google' })).toBe('osm')
    expect(resolvePickedMapProvider({ key: 'k', googleFailed: true, pick: 'google' })).toBe('osm')
  })
})

describe('the switch', () => {
  it('on Google goes to the OpenStreetMap map, and on that map goes back', () => {
    expect(mapProviderSwitch({ key: 'k', googleFailed: false, provider: 'google', inTime: false })).toEqual({ to: 'osm', label: MAP_PROVIDER_TO_OSM_WORDS })
    expect(mapProviderSwitch({ key: 'k', googleFailed: false, provider: 'osm', inTime: false })).toEqual({ to: 'google', label: MAP_PROVIDER_TO_GOOGLE_WORDS })
  })

  it('is not there when the page can draw one map alone', () => {
    expect(mapProviderSwitch({ key: '', googleFailed: false, provider: 'osm', inTime: false })).toBeNull()
    expect(mapProviderSwitch({ key: 'k', googleFailed: true, provider: 'osm', inTime: false })).toBeNull()
  })

  it('waits while Time is on, whichever map was up before it', () => {
    expect(mapProviderSwitch({ key: 'k', googleFailed: false, provider: 'google', inTime: true })).toBeNull()
    expect(mapProviderSwitch({ key: 'k', googleFailed: false, provider: 'osm', inTime: true })).toBeNull()
  })
})
