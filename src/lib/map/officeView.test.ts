import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { METERS_PER_MILE } from './mapCanvasTypes'
import { plainSentence } from '../valuesInPlace'
import { MAP_FIT_PADDING_PX, OFFICE_VIEW_RADIUS_MILES, countOutsideOfficeView, metersPerPx, officeView, officeViewLine } from './officeView'

// An invented office, at a Texas latitude.
const OFFICE = { lat: 29.6, lng: -98.4 }
const PHONE = { width: 340, height: 260 }
const DESK = { width: 900, height: 360 }

/** Great-circle miles, the plain way, to check the kernel against something that is not its own maths. */
function miles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2
  return (2 * 6371008.8 * Math.asin(Math.sqrt(h))) / METERS_PER_MILE
}

/** The span of the fit box in px at a zoom, as a canvas would measure it before it pads. */
function fitBoxPx(view: NonNullable<ReturnType<typeof officeView>>, zoom: number): { w: number; h: number } {
  const [north, south, west, east] = view.fitPoints as [{ lat: number; lng: number }, { lat: number; lng: number }, { lat: number; lng: number }, { lat: number; lng: number }]
  const world = 256 * 2 ** zoom
  const y = (lat: number) => {
    const s = Math.sin((lat * Math.PI) / 180)
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world
  }
  return { w: ((east.lng - west.lng) / 360) * world, h: y(south.lat) - y(north.lat) }
}

describe('officeView', () => {
  it('a phone frame, wider than tall: centred on the office, about a hundred miles to the top and the bottom', () => {
    const v = officeView(OFFICE, PHONE)!
    expect(v.center).toEqual(OFFICE)
    expect(v.zoom).toBe(7)
    expect(Math.round(v.radiusMiles)).toBe(86)
    // The frame's top edge really is that far north of the office (the map's scale drifts a little with latitude), and its sides are farther.
    expect(Math.abs(miles(OFFICE, { lat: v.bounds.north, lng: OFFICE.lng }) - v.radiusMiles)).toBeLessThan(1.5)
    expect(miles(OFFICE, { lat: OFFICE.lat, lng: v.bounds.east })).toBeGreaterThan(v.radiusMiles)
  })

  it('a desk frame: the same zoom step, and a little more ground', () => {
    const v = officeView(OFFICE, DESK)!
    expect(v.zoom).toBe(7)
    expect(Math.round(v.radiusMiles)).toBe(119)
  })

  it('a tall frame: the width is the shorter side, so the hundred miles is read to the left and the right', () => {
    const v = officeView(OFFICE, { width: 200, height: 500 })!
    expect(v.zoom).toBe(6)
    expect(miles(OFFICE, { lat: OFFICE.lat, lng: v.bounds.east })).toBeCloseTo(v.radiusMiles, 0)
    expect(miles(OFFICE, { lat: v.bounds.north, lng: OFFICE.lng })).toBeGreaterThan(v.radiusMiles)
  })

  it('a whole zoom step doubles the distance, so every frame lands within a step of a hundred miles', () => {
    for (const side of [180, 220, 260, 300, 360, 420, 520, 700]) {
      for (const lat of [0, 25.9, 29.6, 36.5, 47]) {
        const v = officeView({ lat, lng: -98.4 }, { width: side * 2, height: side })!
        expect(v.radiusMiles, `${side}px at ${lat}°`).toBeGreaterThan(OFFICE_VIEW_RADIUS_MILES / Math.SQRT2 - 0.01)
        expect(v.radiusMiles, `${side}px at ${lat}°`).toBeLessThan(OFFICE_VIEW_RADIUS_MILES * Math.SQRT2 + 0.01)
        expect(Number.isInteger(v.zoom)).toBe(true)
      }
    }
  })

  it('the fit box lands both canvases on this zoom: it fits inside the frame less their padding, and not at the next step', () => {
    for (const frame of [PHONE, DESK, { width: 200, height: 500 }, { width: 290, height: 260 }]) {
      const v = officeView(OFFICE, frame)!
      const room = Math.min(frame.width, frame.height) - 2 * MAP_FIT_PADDING_PX
      const here = fitBoxPx(v, v.zoom)
      const next = fitBoxPx(v, v.zoom + 1)
      expect(Math.max(here.w, here.h)).toBeLessThanOrEqual(room)
      expect(Math.max(next.w, next.h)).toBeGreaterThan(room)
      // The box is centred on the office, so the fit's centre is the office.
      const [north, south, west, east] = v.fitPoints as [{ lat: number; lng: number }, { lat: number; lng: number }, { lat: number; lng: number }, { lat: number; lng: number }]
      expect((west.lng + east.lng) / 2).toBeCloseTo(OFFICE.lng, 6)
      expect(north.lat).toBeGreaterThan(OFFICE.lat)
      expect(south.lat).toBeLessThan(OFFICE.lat)
    }
  })

  it('the padding is the canvases’ own: both fit with 28 px', () => {
    expect(MAP_FIT_PADDING_PX).toBe(28)
    expect(readFileSync('src/components/map/PinsMapCanvas.tsx', 'utf8')).toContain('padding: [28, 28]')
    expect(readFileSync('src/components/map/PinsMapGoogleCanvas.tsx', 'utf8')).toContain('map.fitBounds(bounds, 28)')
  })

  it('a frame not yet measured is read as square on its height', () => {
    const v = officeView(OFFICE, { width: null, height: 260 })!
    expect(v.zoom).toBe(7)
    expect(miles(OFFICE, { lat: OFFICE.lat, lng: v.bounds.east })).toBeCloseTo(v.radiusMiles, 0)
  })

  it('no office, a broken office or no frame is no office view: the caller fits its pins as before', () => {
    expect(officeView(null, PHONE)).toBeNull()
    expect(officeView(undefined, PHONE)).toBeNull()
    expect(officeView({ lat: Number.NaN, lng: -98.4 }, PHONE)).toBeNull()
    expect(officeView(OFFICE, { width: 340, height: 0 })).toBeNull()
  })

  it('metersPerPx is the usual figure at the equator', () => {
    expect(metersPerPx(0, 0)).toBeCloseTo(156543.03, 1)
  })
})

describe('countOutsideOfficeView', () => {
  const view = officeView(OFFICE, PHONE)
  it('counts the jobs the office view does not show, and none when there is no office view', () => {
    const near = { lat: 29.7, lng: -98.1 }
    const farEast = { lat: 33.9, lng: -81.0 }
    const farNorth = { lat: 32.8, lng: -98.4 }
    expect(countOutsideOfficeView([near, OFFICE], view)).toBe(0)
    expect(countOutsideOfficeView([near, farEast, farNorth], view)).toBe(2)
    expect(countOutsideOfficeView([farEast], null)).toBe(0)
  })
})

describe('officeViewLine', () => {
  it('names the jobs the view leaves out, with the count marked as a value', () => {
    expect(plainSentence(officeViewLine({ mode: 'office', outside: 1 })!)).toBe('1 job is outside the office view.')
    expect(plainSentence(officeViewLine({ mode: 'office', outside: 3 })!)).toBe('3 jobs are outside the office view.')
    expect(officeViewLine({ mode: 'office', outside: 3 })).toContain('⟪count|3⟫')
  })

  it('says nothing when every job is in view, and says so when every job is shown', () => {
    expect(officeViewLine({ mode: 'office', outside: 0 })).toBeNull()
    expect(officeViewLine({ mode: 'all', outside: 2 })).toBe('Showing every job on the map.')
  })
})
