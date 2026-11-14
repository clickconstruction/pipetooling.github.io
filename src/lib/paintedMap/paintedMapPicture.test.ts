import { describe, expect, it } from 'vitest'
import { fromPlane, type PaintedPoint } from './paintedLine'
import { copyMadeWords, pictureFileName, pictureFrame, pictureKeyLine, picturePoint, pictureTiles, pictureTileUrl, worldPx, PICTURE_HEIGHT, PICTURE_MAX_ZOOM, PICTURE_NATIVE_ZOOM, PICTURE_PAD, PICTURE_POINT_ZOOM, PICTURE_WIDTH } from './paintedMapPicture'

const ORIGIN: PaintedPoint = { lat: 39.5, lng: -98.35 }
const at = (eastM: number, northM: number): PaintedPoint => fromPlane(ORIGIN, { x: eastM, y: northM })

describe('the flat map every tile is cut from', () => {
  it('puts the middle of the world in the middle', () => {
    expect(worldPx({ lat: 0, lng: 0 }, 0)).toEqual({ x: 128, y: 128 })
    expect(worldPx({ lat: 0, lng: -180 }, 3).x).toBe(0)
  })
  it('runs east to the right and north to the top', () => {
    const a = worldPx(ORIGIN, 18)
    expect(worldPx(at(100, 0), 18).x).toBeGreaterThan(a.x)
    expect(worldPx(at(0, 100), 18).y).toBeLessThan(a.y)
  })
  it('doubles with each zoom', () => {
    const a = worldPx(ORIGIN, 10)
    const b = worldPx(ORIGIN, 11)
    expect(b.x).toBeCloseTo(a.x * 2, 6)
    expect(b.y).toBeCloseTo(a.y * 2, 6)
  })
})

describe('the frame a picture looks through', () => {
  it('has no picture of nothing', () => {
    expect(pictureFrame([])).toBeNull()
  })
  it('holds every point with room around it, as close as it can', () => {
    const points = [at(0, 0), at(200, 0), at(200, 150)]
    const frame = pictureFrame(points)!
    for (const p of points) {
      const px = picturePoint(frame, p)
      expect(px.x).toBeGreaterThanOrEqual(PICTURE_PAD - 1)
      expect(px.x).toBeLessThanOrEqual(PICTURE_WIDTH - PICTURE_PAD + 1)
      expect(px.y).toBeGreaterThanOrEqual(PICTURE_PAD - 1)
      expect(px.y).toBeLessThanOrEqual(PICTURE_HEIGHT - PICTURE_PAD + 1)
    }
    // One zoom closer would push a point into the edge's room, unless the frame is already as close as it goes.
    const closer = { ...frame, zoom: frame.zoom + 1 }
    const span = Math.abs(worldPx(points[1]!, closer.zoom).x - worldPx(points[0]!, closer.zoom).x)
    expect(frame.zoom === PICTURE_MAX_ZOOM || span > PICTURE_WIDTH - 2 * PICTURE_PAD || Math.abs(worldPx(points[2]!, closer.zoom).y - worldPx(points[0]!, closer.zoom).y) > PICTURE_HEIGHT - 2 * PICTURE_PAD).toBe(true)
  })
  it('centres the points', () => {
    const frame = pictureFrame([at(-300, -100), at(300, 100)])!
    const a = picturePoint(frame, at(-300, -100))
    const b = picturePoint(frame, at(300, 100))
    expect((a.x + b.x) / 2).toBeCloseTo(PICTURE_WIDTH / 2, 0)
    expect((a.y + b.y) / 2).toBeCloseTo(PICTURE_HEIGHT / 2, 0)
  })
  it('zooms out for a long drive and stops at the closest zoom for a short pipe run', () => {
    expect(pictureFrame([at(0, 0), at(4000, 2500)])!.zoom).toBeLessThan(16)
    expect(pictureFrame([at(0, 0), at(6, 4)])!.zoom).toBe(PICTURE_MAX_ZOOM)
  })
  it('draws a single place close, in the middle', () => {
    const frame = pictureFrame([ORIGIN])!
    expect(frame.zoom).toBe(PICTURE_POINT_ZOOM)
    expect(picturePoint(frame, ORIGIN).x).toBeCloseTo(PICTURE_WIDTH / 2, 0)
    expect(picturePoint(frame, ORIGIN).y).toBeCloseTo(PICTURE_HEIGHT / 2, 0)
  })
})

describe('the tiles under a picture', () => {
  it('cover the frame with no gap', () => {
    const frame = pictureFrame([at(0, 0), at(200, 150)])!
    const tiles = pictureTiles(frame)
    expect(Math.min(...tiles.map((t) => t.left))).toBeLessThanOrEqual(0)
    expect(Math.min(...tiles.map((t) => t.top))).toBeLessThanOrEqual(0)
    expect(Math.max(...tiles.map((t) => t.left + t.size))).toBeGreaterThanOrEqual(frame.width)
    expect(Math.max(...tiles.map((t) => t.top + t.size))).toBeGreaterThanOrEqual(frame.height)
    expect(new Set(tiles.map((t) => `${t.x}/${t.y}`)).size).toBe(tiles.length)
  })
  it('never ask for a tile deeper than the view from above has, and stretch it instead', () => {
    const frame = pictureFrame([at(0, 0), at(6, 4)])!
    const tiles = pictureTiles(frame)
    expect(tiles.every((t) => t.z === PICTURE_NATIVE_ZOOM)).toBe(true)
    expect(tiles[0]!.size).toBe(256 * 2 ** (PICTURE_MAX_ZOOM - PICTURE_NATIVE_ZOOM))
  })
  it('draw at their own size up to the native zoom', () => {
    const tiles = pictureTiles(pictureFrame([at(0, 0), at(4000, 2500)])!)
    expect(tiles.every((t) => t.size === 256)).toBe(true)
  })
  it('name a tile by zoom, row, then column', () => {
    expect(pictureTileUrl({ z: 18, x: 59400, y: 99900 })).toBe('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/18/99900/59400')
  })
})

describe('the words a copy carries', () => {
  it('names the file after the map', () => {
    expect(pictureFileName('The way in for deliveries')).toBe('the-way-in-for-deliveries.jpg')
    expect(pictureFileName('  Lot 14 — back gate!! ')).toBe('lot-14-back-gate.jpg')
    expect(pictureFileName('Café entrée', 'png')).toBe('cafe-entree.png')
    expect(pictureFileName('???')).toBe('painted-map.jpg')
  })
  it('says the day it was made', () => {
    expect(copyMadeWords('2026-11-13')).toBe('Made Nov 13, 2026')
    expect(copyMadeWords('2027-02-01')).toBe('Made Feb 1, 2027')
    expect(copyMadeWords('')).toBe('')
    expect(copyMadeWords('2026-13-01')).toBe('')
  })
  it('reads a place as its name and its words', () => {
    expect(pictureKeyLine({ name: 'Truck gate', words: 'Close it behind you.' })).toBe('Truck gate. Close it behind you.')
    expect(pictureKeyLine({ name: 'Meter', words: ' ' })).toBe('Meter')
    expect(pictureKeyLine({ name: 'Park here.', words: 'Not on the grass' })).toBe('Park here. Not on the grass')
  })
})
