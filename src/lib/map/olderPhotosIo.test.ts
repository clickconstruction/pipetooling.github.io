import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WAYBACK_CONFIG_URL, type OlderPhotoFound } from './olderPhotos'
import { forgetOlderPhotos, walkOlderPhotos, type FetchJson } from './olderPhotosIo'

const SPOT = { lat: 30.2672, lng: -97.7431 }
const CONFIG = {
  '900': { itemTitle: 'World Imagery (Wayback 2026-10-29)', metadataLayerUrl: 'https://metadata.example/r900/MapServer' },
  '800': { itemTitle: 'World Imagery (Wayback 2024-06-06)', metadataLayerUrl: 'https://metadata.example/r800/MapServer' },
  '700': { itemTitle: 'World Imagery (Wayback 2022-03-01)', metadataLayerUrl: 'https://metadata.example/r700/MapServer' },
  '600': { itemTitle: 'World Imagery (Wayback 2019-05-01)', metadataLayerUrl: 'https://metadata.example/r600/MapServer' },
  '500': { itemTitle: 'World Imagery (Wayback 2014-02-20)' },
}

/** A small archive: 900 was kept from 800, 800 and 700 are one photograph, 600 is older, 500 older still with no day. */
function archive(over: Partial<Record<string, unknown | Error>> = {}): { fetchJson: FetchJson; asked: string[] } {
  const asked: string[] = []
  const tilemap: Record<string, unknown> = {
    '900': { data: [1], select: [800], size: [300] },
    '700': { data: [1], size: [300] },
    '600': { data: [1], size: [200] },
    '500': { data: [1], size: [100] },
  }
  const taken: Record<string, unknown> = {
    r800: { features: [{ attributes: { SRC_DATE2: Date.UTC(2023, 9, 8) } }] },
    r700: { features: [{ attributes: { SRC_DATE2: Date.UTC(2023, 9, 8) } }] },
    r600: { features: [{ attributes: { SRC_DATE2: Date.UTC(2019, 2, 3) } }] },
  }
  const fetchJson: FetchJson = async (url) => {
    asked.push(url)
    const answer = (() => {
      if (url === WAYBACK_CONFIG_URL) return 'config' in over ? over.config : CONFIG
      const map = /\/tilemap\/(\d+)\//.exec(url)?.[1]
      if (map) return map in over ? over[map] : tilemap[map]
      const meta = /\/(r\d+)\/MapServer/.exec(url)?.[1]
      if (meta) return meta in over ? over[meta] : taken[meta]
      return undefined
    })()
    if (answer instanceof Error) throw answer
    return answer
  }
  return { fetchJson, asked }
}

// The device's keep, stood in for: the walk writes a settled answer there.
let store: Record<string, string> = {}
beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] } })
})
afterEach(() => {
  forgetOlderPhotos()
  vi.unstubAllGlobals()
})

describe('walkOlderPhotos', () => {
  it('walks newest to oldest, passes over a photograph published twice, and names each by the day it was taken', async () => {
    const { fetchJson, asked } = archive()
    const seen: OlderPhotoFound[][] = []
    const found = await walkOlderPhotos(SPOT, { fetchJson, onChange: (list) => seen.push(list) })
    expect(found).toEqual([
      // 900 was kept from 800, and 700 is the same picture: the stop keeps its newest release and takes the first publishing day.
      { release: 800, publishedYmd: '2022-03-01', size: 300, takenYmd: '2023-10-08' },
      { release: 600, publishedYmd: '2019-05-01', size: 200, takenYmd: '2019-03-03' },
      { release: 500, publishedYmd: '2014-02-20', size: 100, takenYmd: null },
    ])
    // The walk skipped 800's own tile map: 900 already named it.
    expect(asked.filter((u) => u.includes('/tilemap/')).map((u) => /\/tilemap\/(\d+)\//.exec(u)?.[1])).toEqual(['900', '700', '600', '500'])
    // The dates were handed over as they came, not all at the end.
    expect(seen.length).toBeGreaterThan(3)
    expect(seen[0]).toHaveLength(1)
    // A photograph is on the list before its day is.
    expect(seen[0]![0]!.takenYmd).toBeUndefined()
    // The day is asked at the middle of the tile, never at the place's own point.
    const dayAsks = asked.filter((u) => u.includes('/query?'))
    expect(dayAsks.length).toBe(2)
    for (const u of dayAsks) expect(new URL(u).searchParams.get('geometry')).not.toBe('-97.743100,30.267200')
  })

  it('says when every photograph has been met, before the days are all in', async () => {
    let release: (v: unknown) => void = () => {}
    const { fetchJson } = archive()
    const slow: FetchJson = (url, signal) => (url.includes('/r600/') ? new Promise((resolve) => { release = resolve }) : fetchJson(url, signal))
    let walked = false
    let done = false
    const walk = walkOlderPhotos(SPOT, { fetchJson: slow, onChange: () => {}, onWalked: () => { walked = true } }).then((found) => { done = true; return found })
    await vi.waitFor(() => expect(walked).toBe(true))
    expect(done).toBe(false)
    release({ features: [{ attributes: { SRC_DATE2: Date.UTC(2019, 2, 3) } }] })
    expect((await walk).find((f) => f.release === 600)?.takenYmd).toBe('2019-03-03')
  })

  it('asks a slow day again, up to three times', async () => {
    const { fetchJson, asked } = archive()
    let tries = 0
    const flaky: FetchJson = (url, signal) => {
      if (url.includes('/r600/') && (tries += 1) < 3) return Promise.reject(new Error('timed out'))
      return fetchJson(url, signal)
    }
    const found = await walkOlderPhotos(SPOT, { fetchJson: flaky, onChange: () => {} })
    expect(tries).toBe(3)
    expect(found.find((f) => f.release === 600)?.takenYmd).toBe('2019-03-03')
    expect(asked.filter((u) => u.includes('/r600/'))).toHaveLength(1)
  })

  it('keeps a walk on the device only when every photograph has its day', async () => {
    // 500 has no metadata service, so this walk is not settled.
    await walkOlderPhotos(SPOT, { fetchJson: archive().fetchJson, onChange: () => {} })
    expect(Object.keys(store)).toEqual([])
    forgetOlderPhotos()
    // Without 500 every photograph has its day: kept, and the next visit asks nothing.
    await walkOlderPhotos(SPOT, { fetchJson: archive({ '500': { data: [0] } }).fetchJson, onChange: () => {} })
    expect(Object.keys(store)).toEqual(['older_photos_v1:17/29948/53964'])
    forgetOlderPhotos()
    const next = archive()
    const found = await walkOlderPhotos(SPOT, { fetchJson: next.fetchJson, onChange: () => {} })
    expect(next.asked).toEqual([])
    expect(found.map((f) => f.release)).toEqual([800, 600])
  })

  it('keeps a finished walk for the visit and asks nothing the second time', async () => {
    const { fetchJson, asked } = archive()
    await walkOlderPhotos(SPOT, { fetchJson, onChange: () => {} })
    const before = asked.length
    const again: OlderPhotoFound[][] = []
    const found = await walkOlderPhotos({ lat: SPOT.lat + 0.00001, lng: SPOT.lng }, { fetchJson, onChange: (list) => again.push(list) })
    expect(asked.length).toBe(before)
    expect(again).toEqual([found])
    expect(found).toHaveLength(3)
  })

  it('throws when the list of dates cannot be read, and reads it again on the next try', async () => {
    const down = archive({ config: new Error('Failed to fetch') })
    await expect(walkOlderPhotos(SPOT, { fetchJson: down.fetchJson, onChange: () => {} })).rejects.toThrow('Failed to fetch')
    const up = archive()
    expect(await walkOlderPhotos(SPOT, { fetchJson: up.fetchJson, onChange: () => {} })).toHaveLength(3)
  })

  it('throws when the list is empty or the first tile cannot be read', async () => {
    await expect(walkOlderPhotos(SPOT, { fetchJson: archive({ config: {} }).fetchJson, onChange: () => {} })).rejects.toThrow('sent no list of dates')
    forgetOlderPhotos()
    await expect(walkOlderPhotos(SPOT, { fetchJson: archive({ '900': new Error('boom') }).fetchJson, onChange: () => {} })).rejects.toThrow('boom')
  })

  it('a read that fails later ends the walk with what it found', async () => {
    const { fetchJson } = archive({ '600': new Error('boom') })
    const found = await walkOlderPhotos(SPOT, { fetchJson, onChange: () => {} })
    expect(found.map((f) => f.release)).toEqual([800])
  })

  it('a day that cannot be read leaves the photograph named by the day it was published', async () => {
    const { fetchJson } = archive({ r600: new Error('slow') })
    const found = await walkOlderPhotos(SPOT, { fetchJson, onChange: () => {} })
    expect(found.find((f) => f.release === 600)?.takenYmd).toBeNull()
  })

  it('stops where the archive has no picture, and at the step cap', async () => {
    expect((await walkOlderPhotos(SPOT, { fetchJson: archive({ '600': { data: [0] } }).fetchJson, onChange: () => {} })).map((f) => f.release)).toEqual([800])
    forgetOlderPhotos()
    expect((await walkOlderPhotos(SPOT, { fetchJson: archive().fetchJson, onChange: () => {}, maxSteps: 1 })).map((f) => f.release)).toEqual([800])
  })

  it('says nothing more once it is told to stop', async () => {
    const stop = new AbortController()
    const { fetchJson } = archive()
    const seen: OlderPhotoFound[][] = []
    const walk = walkOlderPhotos(SPOT, { fetchJson, signal: stop.signal, onChange: (list) => { seen.push(list); stop.abort() } })
    await walk
    expect(seen).toHaveLength(1)
    // A stopped walk is not kept: the next one reads again.
    const next = archive()
    await walkOlderPhotos(SPOT, { fetchJson: next.fetchJson, onChange: () => {} })
    expect(next.asked.length).toBeGreaterThan(0)
  })
})
