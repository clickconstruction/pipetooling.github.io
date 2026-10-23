import { describe, expect, it } from 'vitest'
import { clampView, labelFontSize, dotRadiusPx, dotRadiusView, inView, isDrag, labelShows, labelsShow, padBox, panTo, viewBoxAttr, viewPoint, wheelFactor, zoomAt, zoomStep, type ViewBox } from './countyMapView'

const STATE: ViewBox = { x: 0, y: 0, w: 600, h: 570 }
const WORLD = padBox(STATE, 30)
const MIN_W = 20

describe('zoomAt', () => {
  it('keeps the point under the cursor where it is', () => {
    const vb: ViewBox = { x: 0, y: 0, w: 600, h: 570 }
    const z = zoomAt(vb, WORLD, 0.5, 300, 285, MIN_W)
    expect(z).toEqual({ x: 150, y: 142.5, w: 300, h: 285 })
    // the cursor at (300,285) is still at the same fraction of the view
    expect((300 - z.x) / z.w).toBeCloseTo(0.5)
    const corner = zoomAt(vb, WORLD, 0.5, 0, 0, MIN_W)
    expect(corner).toEqual({ x: 0, y: 0, w: 300, h: 285 })
  })
  it('never zooms past the world or under the floor', () => {
    const z = zoomAt({ x: 0, y: 0, w: 600, h: 570 }, WORLD, 10, 300, 285, MIN_W)
    expect(z.w).toBe(WORLD.w)
    const tight = zoomAt({ x: 100, y: 100, w: 30, h: 28.5 }, WORLD, 0.1, 115, 114.25, MIN_W)
    expect(tight.w).toBe(MIN_W)
  })
  it('steps by 1.4 about the middle, and the wheel zooms in on a negative delta', () => {
    const vb: ViewBox = { x: 100, y: 100, w: 140, h: 133 }
    const inn = zoomStep(vb, WORLD, 1, MIN_W)
    expect(inn.w).toBe(100)
    expect(inn.x + inn.w / 2).toBeCloseTo(170)
    expect(zoomStep(inn, WORLD, -1, MIN_W).w).toBe(140)
    expect(wheelFactor(-100)).toBeLessThan(1)
    expect(wheelFactor(100)).toBeGreaterThan(1)
  })
})

describe('panTo / clampView', () => {
  it('moves the view against the drag, as a fraction of the page', () => {
    const start: ViewBox = { x: 100, y: 100, w: 200, h: 190 }
    expect(panTo(start, WORLD, 0.5, 0, MIN_W)).toEqual({ x: 0, y: 100, w: 200, h: 190 })
  })
  it('cannot lose the map: the middle stays inside the world', () => {
    const start: ViewBox = { x: 100, y: 100, w: 200, h: 190 }
    const far = panTo(start, WORLD, -50, -50, MIN_W)
    expect(far.x).toBe(WORLD.x + WORLD.w - 100)
    expect(far.y).toBe(WORLD.y + WORLD.h - 95)
    expect(clampView({ x: -1000, y: -1000, w: 5000, h: 4750 }, WORLD, MIN_W).w).toBe(WORLD.w)
  })
  it('reads a page point as a view point', () => {
    expect(viewPoint({ x: 100, y: 50, w: 200, h: 100 }, 0.25, 1)).toEqual([150, 150])
    expect(inView({ x: 0, y: 0, w: 10, h: 10 }, 5, 5)).toBe(true)
    expect(inView({ x: 0, y: 0, w: 10, h: 10 }, 11, 5)).toBe(false)
    expect(viewBoxAttr({ x: 1, y: 2, w: 3, h: 4 })).toBe('1 2 3 4')
  })
})

describe('the rules the screen reads', () => {
  it('a press is a drag past 3 px', () => {
    expect(isDrag(2, 2)).toBe(false)
    expect(isDrag(3, 1)).toBe(true)
  })
  it('names draw at a third of the state, and always for a colored county', () => {
    expect(labelsShow({ x: 0, y: 0, w: 200, h: 190 }, 600)).toBe(true)
    expect(labelsShow({ x: 0, y: 0, w: 201, h: 190 }, 600)).toBe(false)
    expect(labelShows({ x: 0, y: 0, w: 420, h: 400 }, 600, true)).toBe(true)
    expect(labelShows({ x: 0, y: 0, w: 421, h: 400 }, 600, true)).toBe(false)
    expect(labelShows({ x: 0, y: 0, w: 420, h: 400 }, 600, false)).toBe(false)
    expect(labelFontSize({ x: 0, y: 0, w: 100, h: 95 })).toBe(2.9)
  })
  it('a dot is 6 to 12 px on the page by balance, whatever the view', () => {
    expect(dotRadiusPx(0)).toBe(6)
    expect(dotRadiusPx(250)).toBe(6)
    expect(dotRadiusPx(4050)).toBeCloseTo(7.04, 2)
    expect(dotRadiusPx(15781.82)).toBeCloseTo(10.48, 2)
    expect(dotRadiusPx(1e9)).toBe(12)
    // 8 px on a 400 px wide svg showing 200 units = 4 units
    expect(dotRadiusView({ x: 0, y: 0, w: 200, h: 100 }, 400, 8)).toBe(4)
  })
})
