import { describe, expect, it } from 'vitest'
import {
  googleEarthUrl,
  isNewPhoto,
  nextWalkIndex,
  olderPhotoChoices,
  olderPhotosFrame,
  olderPhotosSettled,
  parseWaybackReleases,
  readKeptOlderPhotos,
  readTakenYmd,
  readTilemapAnswer,
  tileCentre,
  tileForSpot,
  waybackMetadataLayerId,
  waybackMetadataQueryUrl,
  waybackTileTemplate,
  waybackTilemapUrl,
  type OlderPhotoFound,
} from './olderPhotos'

const CONFIG = {
  '10': { itemTitle: 'World Imagery (Wayback 2014-02-20)', metadataLayerUrl: 'https://metadata.example/2014_r01/MapServer' },
  '900': { itemTitle: 'World Imagery (Wayback 2026-10-29)', metadataLayerUrl: 'https://metadata.example/2026_r10/MapServer' },
  '500': { itemTitle: 'World Imagery (Wayback 2020-06-10)', metadataLayerUrl: 'http://not-secure.example/x' },
  bad: { itemTitle: 'World Imagery (Wayback 2021-01-01)' },
  '77': { itemTitle: 'no date here' },
  '78': null,
}

describe('tileForSpot', () => {
  it('finds the slippy tile of a point', () => {
    expect(tileForSpot({ lat: 30.2672, lng: -97.7431 }, 17)).toEqual({ z: 17, x: 29948, y: 53964 })
    expect(tileForSpot({ lat: 0, lng: 0 }, 1)).toEqual({ z: 1, x: 1, y: 1 })
  })

  it('holds a point past the map edge on the map', () => {
    expect(tileForSpot({ lat: 89.9, lng: 180 }, 2)).toEqual({ z: 2, x: 3, y: 0 })
  })

  it('the middle of a tile falls back in that tile, within a tile of the point', () => {
    const spot = { lat: 30.2672, lng: -97.7431 }
    const tile = tileForSpot(spot, 17)
    const mid = tileCentre(tile)
    expect(tileForSpot(mid, 17)).toEqual(tile)
    expect(Math.abs(mid.lat - spot.lat)).toBeLessThan(0.003)
    expect(Math.abs(mid.lng - spot.lng)).toBeLessThan(0.003)
    expect(mid).not.toEqual(spot)
  })
})

describe('olderPhotosFrame', () => {
  it('frames the spot close: two corners about a hundred metres apart, the spot between them', () => {
    const [a, b] = olderPhotosFrame({ lat: 30.2672, lng: -97.7431 })
    expect((a.lat + b.lat) / 2).toBeCloseTo(30.2672, 6)
    expect((a.lng + b.lng) / 2).toBeCloseTo(-97.7431, 6)
    expect(b.lat - a.lat).toBeCloseTo(0.001, 6)
    expect(b.lng - a.lng).toBeCloseTo(0.001, 6)
  })
})

describe('parseWaybackReleases', () => {
  it('lists the releases newest first and leaves out a row it cannot read', () => {
    expect(parseWaybackReleases(CONFIG)).toEqual([
      { release: 900, publishedYmd: '2026-10-29', metadataUrl: 'https://metadata.example/2026_r10/MapServer' },
      { release: 500, publishedYmd: '2020-06-10', metadataUrl: null },
      { release: 10, publishedYmd: '2014-02-20', metadataUrl: 'https://metadata.example/2014_r01/MapServer' },
    ])
  })

  it('answers an empty list for anything that is not a list', () => {
    expect(parseWaybackReleases(null)).toEqual([])
    expect(parseWaybackReleases('nope')).toEqual([])
  })
})

describe('the archive addresses', () => {
  it('a release is a Leaflet layer, and a tile is asked row before column', () => {
    expect(waybackTileTemplate(10)).toBe('https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/10/{z}/{y}/{x}')
    expect(waybackTilemapUrl(10, { z: 17, x: 29948, y: 53964 })).toBe('https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tilemap/10/17/53964/29948')
  })

  it('the metadata layer follows the zoom, finest first', () => {
    expect(waybackMetadataLayerId(17)).toBe(6)
    expect(waybackMetadataLayerId(23)).toBe(0)
    expect(waybackMetadataLayerId(30)).toBe(0)
    expect(waybackMetadataLayerId(3)).toBe(13)
  })

  it('the day is asked at the point, longitude first', () => {
    const url = waybackMetadataQueryUrl('https://metadata.example/2014_r01/MapServer/', { lat: 30.2672, lng: -97.7431 })
    expect(url.startsWith('https://metadata.example/2014_r01/MapServer/6/query?')).toBe(true)
    expect(new URL(url).searchParams.get('geometry')).toBe('-97.743100,30.267200')
    expect(new URL(url).searchParams.get('returnGeometry')).toBe('false')
  })

  it('Google Earth opens over the spot', () => {
    expect(googleEarthUrl({ lat: 30.2672, lng: -97.7431 })).toBe('https://earth.google.com/web/@30.267200,-97.743100,0a,700d,35y,0h,0t,0r')
  })
})

describe('readTilemapAnswer', () => {
  it('names the release a kept tile really comes from, and its size', () => {
    expect(readTilemapAnswer({ data: [1], select: [490], size: [27654], valid: true }, 900)).toEqual({ has: true, actualRelease: 490, size: 27654 })
  })

  it('a tile changed in the release asked has no select', () => {
    expect(readTilemapAnswer({ data: [1], size: [100] }, 900)).toEqual({ has: true, actualRelease: 900, size: 100 })
  })

  it('no picture, or an answer that is not one', () => {
    expect(readTilemapAnswer({ data: [0] }, 900).has).toBe(false)
    expect(readTilemapAnswer(null, 900)).toEqual({ has: false, actualRelease: 900, size: null })
  })
})

describe('nextWalkIndex', () => {
  const releases = parseWaybackReleases(CONFIG)
  it('goes on from the release before the one the tile came from', () => {
    expect(nextWalkIndex(releases, 900)).toBe(1)
    expect(nextWalkIndex(releases, 500)).toBe(2)
  })
  it('ends at the oldest release, or at one the list does not know', () => {
    expect(nextWalkIndex(releases, 10)).toBeNull()
    expect(nextWalkIndex(releases, 12345)).toBeNull()
  })
})

describe('readTakenYmd', () => {
  it('reads the day a photograph was taken', () => {
    expect(readTakenYmd({ features: [{ attributes: { SRC_DATE2: Date.UTC(2023, 9, 8) } }] })).toBe('2023-10-08')
  })
  it('answers nothing when the archive does not say', () => {
    expect(readTakenYmd({ features: [] })).toBeNull()
    expect(readTakenYmd({ features: [{ attributes: { SRC_DATE2: null } }] })).toBeNull()
    expect(readTakenYmd({ error: { code: 500 } })).toBeNull()
    expect(readTakenYmd(undefined)).toBeNull()
  })
})

describe('isNewPhoto', () => {
  const one: OlderPhotoFound[] = [{ release: 900, publishedYmd: '2026-10-29', size: 27654 }]
  it('a stop of the last stop’s size is the same photograph published twice', () => {
    expect(isNewPhoto(one, 27654)).toBe(false)
    expect(isNewPhoto(one, 17175)).toBe(true)
  })
  it('the first stop is new, and so is one whose size is not known', () => {
    expect(isNewPhoto([], 1)).toBe(true)
    expect(isNewPhoto(one, null)).toBe(true)
  })
})

describe('olderPhotoChoices', () => {
  // Newest first, as the walk hands them over.
  const found: OlderPhotoFound[] = [
    { release: 900, publishedYmd: '2026-10-29', size: 5, takenYmd: '2023-10-08' },
    { release: 800, publishedYmd: '2024-05-09', size: 4, takenYmd: '2024-01-31' },
    { release: 700, publishedYmd: '2022-03-01', size: 3, takenYmd: '2021-03-20' },
    { release: 650, publishedYmd: '2021-08-01', size: 8, takenYmd: '2021-03-20' },
    { release: 600, publishedYmd: '2021-05-01', size: 2, takenYmd: '2021-03-03' },
    { release: 500, publishedYmd: '2018-01-10', size: 1, takenYmd: null },
    { release: 400, publishedYmd: '2016-02-02', size: 9 },
  ]

  it('lists every photograph oldest first by the day it was taken, one press a taken day', () => {
    expect(olderPhotoChoices(found).map((c) => [c.release, c.label])).toEqual([
      [400, 'Before Feb 2016'],
      [500, 'Before Jan 2018'],
      [600, 'Mar 3, 2021'],
      [700, 'Mar 20, 2021'],
      [900, 'Oct 2023'],
      [800, 'Jan 2024'],
    ])
    // Two stops with one taken day are one photograph: the newest release stands for both.
    expect(olderPhotoChoices(found).find((c) => c.release === 700)?.releases).toEqual([700, 650])
  })

  it('says when a photograph was taken, that its day is on the way, or that the archive gave none', () => {
    const choices = olderPhotoChoices(found)
    expect(choices.find((c) => c.release === 900)?.caption).toBe('Photo taken October 8, 2023.')
    expect(choices.find((c) => c.release === 400)).toMatchObject({ taken: false, asking: true, caption: 'Esri published this picture on February 2, 2016. Finding the day it was taken…' })
    expect(choices.find((c) => c.release === 500)).toMatchObject({ taken: false, asking: false, caption: 'Esri published this picture on January 10, 2018. It was taken before that, and the archive did not say when.' })
  })

  it('two photographs published in one month, days not known, are told apart by the day', () => {
    const two: OlderPhotoFound[] = [
      { release: 2, publishedYmd: '2018-06-20', size: 2 },
      { release: 1, publishedYmd: '2018-06-06', size: 1 },
    ]
    expect(olderPhotoChoices(two).map((c) => c.label)).toEqual(['Before Jun 6, 2018', 'Before Jun 20, 2018'])
  })
})

describe('keeping a walk on the device', () => {
  const settled: OlderPhotoFound[] = [
    { release: 900, publishedYmd: '2026-10-29', size: 5, takenYmd: '2023-10-08' },
    { release: 700, publishedYmd: '2022-03-01', size: null, takenYmd: '2021-03-20' },
  ]

  it('only a walk whose every photograph has its day is worth keeping', () => {
    expect(olderPhotosSettled(settled)).toBe(true)
    expect(olderPhotosSettled([...settled, { release: 1, publishedYmd: '2014-02-20', size: 1, takenYmd: null }])).toBe(false)
    expect(olderPhotosSettled([{ release: 1, publishedYmd: '2014-02-20', size: 1 }])).toBe(false)
    expect(olderPhotosSettled([])).toBe(false)
  })

  it('reads a kept walk back for a week', () => {
    const raw = JSON.stringify({ at: '2026-11-10', found: settled })
    expect(readKeptOlderPhotos(raw, '2026-11-17')).toEqual(settled)
    expect(readKeptOlderPhotos(raw, '2026-11-18')).toBeNull()
    // A clock set back does not make a keep fresh.
    expect(readKeptOlderPhotos(raw, '2026-11-09')).toBeNull()
  })

  it('reads nothing from a torn keep', () => {
    expect(readKeptOlderPhotos(null, '2026-11-17')).toBeNull()
    expect(readKeptOlderPhotos('{not json', '2026-11-17')).toBeNull()
    expect(readKeptOlderPhotos(JSON.stringify({ at: '2026-11-17', found: [] }), '2026-11-17')).toBeNull()
    expect(readKeptOlderPhotos(JSON.stringify({ at: '2026-11-17', found: [{ release: 'x', publishedYmd: '2020-01-01', takenYmd: '2019-01-01' }] }), '2026-11-17')).toBeNull()
    expect(readKeptOlderPhotos(JSON.stringify({ at: '2026-11-17', found: [{ release: 5, publishedYmd: '2020-01-01', takenYmd: null }] }), '2026-11-17')).toBeNull()
  })
})
