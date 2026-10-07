import { describe, expect, it } from 'vitest'
import {
  MAP_PAGE_FAR_MILES,
  farFromOfficeLine,
  farFromOfficePlaces,
  farMilesWords,
  farPlaceCountWords,
  mapPageFitAllPoints,
  mapPageHomeFitPoints,
  splitFarFromOffice,
} from './mapPageFirstView'

const office = { lat: 29.42, lng: -98.49 } // San Antonio
const sanMarcos = { id: 'a', lat: 29.88, lng: -97.94 } // ~45 mi
const houston = { id: 'b', lat: 29.76, lng: -95.37 } // ~190 mi
const salinas = { id: 'c', lat: 36.76, lng: -121.79 } // ~1,500 mi
const assam = { id: 'd', lat: 26.78, lng: 91.93 } // the other side of the world

describe('splitFarFromOffice', () => {
  it('keeps the pins within the line and lists the rest farthest first', () => {
    const { near, far } = splitFarFromOffice([sanMarcos, salinas, houston, assam], office)
    expect(near.map((p) => p.id)).toEqual(['a', 'b'])
    expect(far.map((f) => f.item.id)).toEqual(['d', 'c'])
    expect(far[1]!.miles).toBeGreaterThan(1400)
    expect(far[1]!.miles).toBeLessThan(1600)
  })

  it('calls nothing far without an office', () => {
    const { near, far } = splitFarFromOffice([sanMarcos, assam], null)
    expect(near).toHaveLength(2)
    expect(far).toEqual([])
  })

  it('takes a custom line', () => {
    expect(splitFarFromOffice([houston], office, 100).far).toHaveLength(1)
    expect(MAP_PAGE_FAR_MILES).toBe(300)
  })
})

describe('the fits', () => {
  it('the home fit frames the office ring even when the only near pin is close in', () => {
    const pts = mapPageHomeFitPoints([sanMarcos], office)
    const lats = pts.map((p) => p.lat)
    expect(Math.max(...lats) - Math.min(...lats)).toBeGreaterThan(1) // the 50 mi ring spans more than a degree
  })

  it('Fit all is every near pin and the office, never the far ones', () => {
    const { near } = splitFarFromOffice([sanMarcos, houston, salinas], office)
    const pts = mapPageFitAllPoints(near, office)
    expect(pts).toHaveLength(3)
    expect(pts.some((p) => p.lng < -110)).toBe(false)
    expect(mapPageFitAllPoints(near, null)).toHaveLength(2)
  })
})

describe('the far list', () => {
  const neeses = { addressKey: 'gun dog trail neeses sc', addressLabel: 'Gun Dog Trail, Neeses, SC', lat: 33.52, lng: -81.12 }
  const far = splitFarFromOffice(
    [
      { ...salinas, kind: 'job' as const, addressKey: 'ranch', addressLabel: 'Ranch' },
      { ...neeses, id: 'n1', kind: 'job' as const },
      { ...neeses, id: 'n2', kind: 'job' as const },
      { ...neeses, id: 'n3', kind: 'bid' as const },
      { ...assam, kind: 'job' as const, addressKey: 'zack', addressLabel: "Zack's house" },
    ],
    office,
  ).far

  it('groups the far pins by address, farthest first, and counts by kind', () => {
    const places = farFromOfficePlaces(far)
    expect(places.map((p) => p.addressLabel)).toEqual(["Zack's house", 'Ranch', 'Gun Dog Trail, Neeses, SC'])
    expect(places[2]!.items).toHaveLength(3)
    expect(farPlaceCountWords(places[2]!.items)).toBe('2 jobs · 1 bid')
    expect(farPlaceCountWords(places[0]!.items)).toBe('1 job')
    expect(places[2]!.miles).toBeGreaterThan(900)
  })

  it('reads the count without calling a far job a wrong address', () => {
    expect(farFromOfficeLine(0)).toBe('')
    expect(farFromOfficeLine(1)).toBe('1 address is more than 300 miles from the office. The map draws it but never frames it.')
    expect(farFromOfficeLine(3)).toBe('3 addresses are more than 300 miles from the office. The map draws them but never frames them.')
    expect(farMilesWords(1539.6)).toBe('1,540 mi')
  })
})
