// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { paintedMapFile, paintedMapGpx, paintedMapKml, xmlText, type PaintedMapFileInput } from './paintedMapFiles'

const MAP: PaintedMapFileInput = {
  name: 'The way in for deliveries',
  words: 'Start at the truck gate.',
  lines: [
    { points: [{ lat: 39.5, lng: -98.35 }, { lat: 39.5, lng: -98.3488 }, { lat: 39.5008, lng: -98.3488 }], lengthWords: 'About 670 ft, give or take 30 ft' },
    { points: [{ lat: 39.5008, lng: -98.3488 }, { lat: 39.501, lng: -98.348 }], label: 'To the meter' },
    { points: [{ lat: 39.5, lng: -98.35 }] },
  ],
  places: [
    { number: 1, name: 'Truck gate', words: 'Close it behind you.', lat: 39.5, lng: -98.35 },
    { number: 2, name: 'Meter', words: '', lat: 39.5008, lng: -98.3482 },
  ],
  company: 'Made Up Plumbing',
  madeWords: 'Made Nov 13, 2026',
}
const parse = (text: string): Document => {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  expect(doc.querySelector('parsererror')).toBeNull()
  return doc
}

describe('a painted map as a .kml file', () => {
  it('is well-formed, with a line for each line and a point for each place', () => {
    const doc = parse(paintedMapKml(MAP))
    expect(doc.documentElement.namespaceURI).toBe('http://www.opengis.net/kml/2.2')
    expect(doc.querySelector('Document > name')?.textContent).toBe('The way in for deliveries')
    expect(doc.querySelectorAll('LineString')).toHaveLength(2)
    expect(doc.querySelectorAll('Point')).toHaveLength(2)
    expect([...doc.querySelectorAll('Placemark > name')].map((e) => e.textContent)).toEqual(['Line 1', 'To the meter', '1. Truck gate', '2. Meter'])
  })
  it('writes longitude first, as the format asks', () => {
    const doc = parse(paintedMapKml(MAP))
    expect(doc.querySelector('LineString > coordinates')?.textContent).toBe('-98.350000,39.500000,0 -98.348800,39.500000,0 -98.348800,39.500800,0')
    expect(doc.querySelector('Point > coordinates')?.textContent).toBe('-98.350000,39.500000,0')
  })
  it('says a length is a guide, whose map it is and the day', () => {
    const about = parse(paintedMapKml(MAP)).querySelector('Document > description')?.textContent
    expect(about).toBe('Start at the truck gate. Made Up Plumbing · Made Nov 13, 2026 A length here is a guide for how far. It is not a measurement.')
  })
})

describe('a painted map as a .gpx file', () => {
  it('is well-formed, with a track for each line and a waypoint for each place, waypoints first', () => {
    const doc = parse(paintedMapGpx(MAP))
    expect(doc.documentElement.getAttribute('version')).toBe('1.1')
    expect(doc.documentElement.namespaceURI).toBe('http://www.topografix.com/GPX/1/1')
    expect([...doc.documentElement.children].map((e) => e.tagName)).toEqual(['metadata', 'wpt', 'wpt', 'trk', 'trk'])
    expect(doc.querySelectorAll('trk')[0]!.querySelectorAll('trkpt')).toHaveLength(3)
    expect(doc.querySelector('wpt')?.getAttribute('lat')).toBe('39.500000')
    expect(doc.querySelector('wpt')?.getAttribute('lon')).toBe('-98.350000')
    expect(doc.querySelector('wpt > desc')?.textContent).toBe('Close it behind you.')
  })
  it('has no clock: a line is a shape', () => {
    const text = paintedMapGpx(MAP)
    expect(text).not.toContain('<time')
    expect(text).not.toContain('<ele')
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
  })
})

describe('what a file may not carry', () => {
  it('writes a name as text, never as markup', () => {
    const odd = { ...MAP, name: 'Gate <A> & "B"', places: [{ number: 1, name: "O'Neil's </name><x/>", words: 'a & b', lat: 39.5, lng: -98.35 }] }
    for (const text of [paintedMapKml(odd), paintedMapGpx(odd)]) {
      const doc = parse(text)
      expect(doc.querySelector('x')).toBeNull()
      expect(text).toContain('Gate &lt;A&gt; &amp; &quot;B&quot;')
    }
  })
  it('drops characters XML refuses', () => {
    expect(xmlText('a\u0000b\u0007c\td')).toBe('abc\td')
  })
  it('names the file after the map, with its kind', () => {
    expect(paintedMapFile('kml', MAP)).toMatchObject({ name: 'the-way-in-for-deliveries.kml', type: 'application/vnd.google-earth.kml+xml' })
    expect(paintedMapFile('gpx', MAP)).toMatchObject({ name: 'the-way-in-for-deliveries.gpx', type: 'application/gpx+xml' })
    expect(paintedMapFile('gpx', MAP).text).toBe(paintedMapGpx(MAP))
  })
})
