import { describe, expect, it } from 'vitest'
import { TILE_PX, monthWords, satelliteTileUrl, streetTileUrl, streetViewLocation, streetViewWords, swipeAnswer, swipeIsScroll, swipeMayStart, swipeProgress, swipeThreshold, tilesAround } from './permitLook'

// Every street and number here is made up.
describe('the pictures on a skim card (punch list #302)', () => {
  it('asks Street View for the address with its city and zip, or the point when there is no address', () => {
    expect(streetViewLocation({ address: '100  SAMPLE ST', city: 'San Antonio', zip: '78245', lat: 29.4, lng: -98.5 })).toBe('100 SAMPLE ST, San Antonio, TX, 78245')
    expect(streetViewLocation({ address: null, city: 'San Antonio', zip: null, lat: 29.4, lng: -98.5 })).toBe('29.4,-98.5')
    expect(streetViewLocation({ address: ' ', city: 'San Antonio', zip: null, lat: null, lng: null })).toBeNull()
  })

  it('says when a picture was taken', () => {
    expect(monthWords('2024-03')).toBe('Mar 2024')
    expect(monthWords('2019')).toBe('2019')
    expect(monthWords('March')).toBeNull()
    expect(monthWords(null)).toBeNull()
    expect(streetViewWords('2024-03')).toBe('Street view · Mar 2024')
    expect(streetViewWords(null)).toBe('Street view')
  })

  it('covers a still with tiles so the point sits in its middle', () => {
    const tiles = tilesAround(29.4241, -98.4936, 11, 170, 122)
    expect(tiles.length).toBeGreaterThanOrEqual(1)
    expect(tiles.length).toBeLessThanOrEqual(4)
    for (const t of tiles) {
      expect(t.z).toBe(11)
      expect([463, 464]).toContain(t.x)
      expect([848, 849]).toContain(t.y)
      // Every tile overlaps the still.
      expect(t.left).toBeLessThan(170)
      expect(t.left + TILE_PX).toBeGreaterThan(0)
      expect(t.top).toBeLessThan(122)
      expect(t.top + TILE_PX).toBeGreaterThan(0)
    }
    // The centre of the still is inside one of them.
    expect(tiles.some((t) => t.left <= 85 && t.left + TILE_PX > 85 && t.top <= 61 && t.top + TILE_PX > 61)).toBe(true)
    expect(streetTileUrl({ x: 463, y: 842, z: 11 })).toBe('https://tile.openstreetmap.org/11/463/842.png')
    expect(satelliteTileUrl({ x: 463, y: 842, z: 11 })).toBe('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/11/842/463')
  })
})

describe('the swipe', () => {
  it('answers past a third of the card and not before', () => {
    expect(swipeThreshold(345)).toBe(115)
    expect(swipeThreshold(200)).toBe(90)
    expect(swipeAnswer(120, 345)).toBe('keep')
    expect(swipeAnswer(-120, 345)).toBe('pass')
    expect(swipeAnswer(100, 345)).toBeNull()
    expect(swipeAnswer(-40, 345)).toBeNull()
    expect(swipeProgress(57.5, 345)).toBe(0.5)
    expect(swipeProgress(-400, 345)).toBe(-1)
  })

  it('never starts under a mouse, nor at the edge of the screen where the browser goes Back', () => {
    expect(swipeMayStart('mouse', 200, 375)).toBe(false)
    expect(swipeMayStart('touch', 200, 375)).toBe(true)
    expect(swipeMayStart('touch', 10, 375)).toBe(false)
    expect(swipeMayStart('touch', 370, 375)).toBe(false)
    expect(swipeMayStart('pen', 60, 375)).toBe(true)
  })

  it('leaves a drag that goes down to the page', () => {
    expect(swipeIsScroll(4, 30)).toBe(true)
    expect(swipeIsScroll(40, 10)).toBe(false)
    expect(swipeIsScroll(2, 5)).toBe(false)
  })
})
