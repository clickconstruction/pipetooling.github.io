import { describe, expect, it } from 'vitest'
import { googleScrollwheelOption, leafletScrollWheelZoom, mapScrollZoomLocked } from './scrollZoomGate'

const desktop = { isMobile: false, afterClick: true, clicked: false }

describe('mapScrollZoomLocked', () => {
  it('locks a desktop map that asked for the gate until it is clicked', () => {
    expect(mapScrollZoomLocked(desktop)).toBe(true)
    expect(mapScrollZoomLocked({ ...desktop, clicked: true })).toBe(false)
  })

  it('never locks a map that did not ask, clicked or not', () => {
    expect(mapScrollZoomLocked({ ...desktop, afterClick: false })).toBe(false)
    expect(mapScrollZoomLocked({ ...desktop, afterClick: false, clicked: true })).toBe(false)
  })

  it('never locks a phone', () => {
    expect(mapScrollZoomLocked({ ...desktop, isMobile: true })).toBe(false)
  })
})

describe('leafletScrollWheelZoom', () => {
  it('is off while locked and on after the click', () => {
    expect(leafletScrollWheelZoom(desktop)).toBe(false)
    expect(leafletScrollWheelZoom({ ...desktop, clicked: true })).toBe(true)
  })

  it('is on from the start for a desktop map that did not ask for the gate', () => {
    expect(leafletScrollWheelZoom({ ...desktop, afterClick: false })).toBe(true)
  })

  it('stays off on a phone, gate or no gate, clicked or not', () => {
    expect(leafletScrollWheelZoom({ isMobile: true, afterClick: false, clicked: false })).toBe(false)
    expect(leafletScrollWheelZoom({ isMobile: true, afterClick: true, clicked: true })).toBe(false)
  })
})

describe('googleScrollwheelOption', () => {
  it('is false while locked and true after the click', () => {
    expect(googleScrollwheelOption(desktop)).toBe(false)
    expect(googleScrollwheelOption({ ...desktop, clicked: true })).toBe(true)
  })

  it('leaves the option alone for a map that did not ask for the gate', () => {
    expect(googleScrollwheelOption({ ...desktop, afterClick: false })).toBeUndefined()
    expect(googleScrollwheelOption({ ...desktop, afterClick: false, clicked: true })).toBeUndefined()
  })

  it('leaves the option alone on a phone', () => {
    expect(googleScrollwheelOption({ ...desktop, isMobile: true })).toBeUndefined()
    expect(googleScrollwheelOption({ ...desktop, isMobile: true, clicked: true })).toBeUndefined()
  })
})
