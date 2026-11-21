import { describe, expect, it } from 'vitest'
import { TASK_PLACE_WIDE_START, TASK_PLACE_WIDE_ZOOM } from '../tasks/taskPlace'
import { boxMapOpening, boxMapReading, boxPinReady, onSiteMapStart } from './boxMapStart'

const SITE = { lat: 29.5, lng: -98.4 }
const A3 = { id: 'a3', lat: 29.5001, lng: -98.4001 }
const A7 = { id: 'a7', lat: 29.5004, lng: -98.4003 }
const WAY = { lines: [{ points: [{ lat: 29.6, lng: -98.5 }] }], places: [{ lat: 29.61, lng: -98.51 }] }

describe('where the box map opens', () => {
  it('opens on the pin in focus, else on the first pin, and says it is on a pin', () => {
    expect(onSiteMapStart({ pins: [A3, A7], focusId: 'a7', center: SITE })).toEqual({ at: { lat: A7.lat, lng: A7.lng }, onPin: true })
    expect(onSiteMapStart({ pins: [A3, A7], focusId: null, center: SITE })).toEqual({ at: { lat: A3.lat, lng: A3.lng }, onPin: true })
    expect(onSiteMapStart({ pins: [A3], focusId: 'gone', center: SITE })?.at).toEqual({ lat: A3.lat, lng: A3.lng })
  })

  it('with no pin opens on the job’s address, else where it was flown, else on a painted line, else on a painted place', () => {
    expect(onSiteMapStart({ pins: [], center: SITE, flyTo: { lat: 1, lng: 2 }, painted: [WAY] })).toEqual({ at: SITE, onPin: false })
    expect(onSiteMapStart({ pins: [], center: null, flyTo: { lat: 1, lng: 2 }, painted: [WAY] })?.at).toEqual({ lat: 1, lng: 2 })
    expect(onSiteMapStart({ pins: [], center: null, painted: [WAY] })?.at).toEqual({ lat: 29.6, lng: -98.5 })
    expect(onSiteMapStart({ pins: [], center: null, painted: [{ lines: [], places: WAY.places }] })?.at).toEqual({ lat: 29.61, lng: -98.51 })
  })

  it('has nowhere to open with no pin, no address, no flight and no painted map', () => {
    expect(onSiteMapStart({ pins: [], center: null })).toBeNull()
    expect(onSiteMapStart({ pins: [], center: null, flyTo: null, painted: [] })).toBeNull()
  })
})

describe('what Use my location does with a reading', () => {
  it('a spot is flown to and kept, with its margin', () => {
    expect(boxMapReading({ lat: 29.5, lng: -98.4, accuracyM: 5 })).toEqual({ kind: 'spot', fly: { lat: 29.5, lng: -98.4, accuracyM: 5 } })
    expect(boxMapReading({ lat: 29.5, lng: -98.4, accuracyM: 120 }).kind).toBe('spot')
    expect(boxMapReading({ lat: 29.5, lng: -98.4, accuracyM: null }).kind).toBe('spot')
    expect(boxMapReading({ lat: 29.5, lng: -98.4, accuracyM: 1000 }).kind).toBe('spot')
  })

  it('an area is never flown to and never kept: only its margin is, for the words', () => {
    expect(boxMapReading({ lat: 29.9, lng: -98.9, accuracyM: 3200 })).toEqual({ kind: 'area', roughM: 3200 })
    expect(boxMapReading({ lat: 29.9, lng: -98.9, accuracyM: 1001 })).toEqual({ kind: 'area', roughM: 1001 })
  })
})

describe('a map with nowhere to open', () => {
  const nowhere = { pins: [], center: null, painted: [] as never[], fly: null }

  it('stays the empty frame until a press got no spot, then opens wide on the task sheet’s wide start', () => {
    expect(boxMapOpening({ ...nowhere, openWide: false })).toEqual({ wide: false, center: null, startZoom: undefined })
    expect(boxMapOpening({ ...nowhere, openWide: true })).toEqual({ wide: true, center: TASK_PLACE_WIDE_START, startZoom: TASK_PLACE_WIDE_ZOOM })
  })

  it('never opens wide when the map has a pin, an address, a painted line or a spot to fly to', () => {
    expect(boxMapOpening({ ...nowhere, pins: [A3], openWide: true })).toEqual({ wide: false, center: null, startZoom: undefined })
    expect(boxMapOpening({ ...nowhere, center: SITE, openWide: true })).toEqual({ wide: false, center: SITE, startZoom: undefined })
    expect(boxMapOpening({ ...nowhere, painted: [WAY], openWide: true }).wide).toBe(false)
    expect(boxMapOpening({ ...nowhere, fly: { lat: 29.5, lng: -98.4 }, openWide: true }).wide).toBe(false)
  })
})

describe('the pin press', () => {
  it('is dead with no ring', () => {
    expect(boxPinReady(null, false)).toBe(false)
    expect(boxPinReady(null, true)).toBe(false)
  })

  it('is dead while the ring still sits on the wide start, and live once it is dragged off', () => {
    expect(boxPinReady(TASK_PLACE_WIDE_START, true)).toBe(false)
    expect(boxPinReady({ lat: TASK_PLACE_WIDE_START.lat + 0.00001, lng: TASK_PLACE_WIDE_START.lng }, true)).toBe(false)
    expect(boxPinReady({ lat: 29.7, lng: -98.6 }, true)).toBe(true)
  })

  it('is live wherever the ring is on a map that did not open wide', () => {
    expect(boxPinReady(SITE, false)).toBe(true)
    expect(boxPinReady(TASK_PLACE_WIDE_START, false)).toBe(true)
  })
})
