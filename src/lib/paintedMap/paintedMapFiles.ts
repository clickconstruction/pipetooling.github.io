/**
 * A painted map as a file for another map (punch list #345, PR 5b): `.kml` for Google Earth and
 * Google My Maps, `.gpx` for a hiking app or a handheld. Pure. For the few who keep a map of their
 * own: an engineer, a surveyor, a general contractor.
 *
 * A file carries the lines and the places with their words. It carries no photo, no name of who
 * painted what, and no time: a line is a shape here as it is in the table, so a `.gpx` track has
 * no clock along it.
 */
import type { PaintedPoint } from './paintedLine'
import { pictureFileName } from './paintedMapPicture'

export type FileLine = { points: ReadonlyArray<PaintedPoint>; label?: string | null; lengthWords?: string | null }
export type FilePlace = { number: number; name: string; words: string; lat: number; lng: number }
export type PaintedMapFileInput = {
  name: string
  words: string
  lines: ReadonlyArray<FileLine>
  places: ReadonlyArray<FilePlace>
  /** Who the map is from, and the day the file was made: `Made Nov 13, 2026`. */
  company: string
  madeWords: string
}

/** Text as XML reads it. Control characters XML refuses are dropped. */
export function xmlText(s: string): string {
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/** Six decimals, about four inches: what the table keeps. */
const n = (v: number): string => v.toFixed(6)

const lineName = (line: FileLine, i: number, count: number): string => (line.label ?? '').trim() || (count === 1 ? 'The line' : `Line ${i + 1}`)
const about = (i: PaintedMapFileInput): string => [i.words.trim(), [i.company.trim(), i.madeWords.trim()].filter(Boolean).join(' · '), 'A length here is a guide for how far. It is not a measurement.'].filter(Boolean).join(' ')

/** Keyhole Markup: Google Earth, Google My Maps, most desktop mapping tools. Longitude comes first in it. */
export function paintedMapKml(i: PaintedMapFileInput): string {
  const lines = i.lines
    .filter((l) => l.points.length >= 2)
    .map((l, k, all) => `    <Placemark>\n      <name>${xmlText(lineName(l, k, all.length))}</name>${l.lengthWords ? `\n      <description>${xmlText(l.lengthWords)}</description>` : ''}\n      <styleUrl>#paint</styleUrl>\n      <LineString>\n        <tessellate>1</tessellate>\n        <coordinates>${l.points.map((p) => `${n(p.lng)},${n(p.lat)},0`).join(' ')}</coordinates>\n      </LineString>\n    </Placemark>`)
  const places = i.places.map((p) => `    <Placemark>\n      <name>${xmlText(`${p.number}. ${p.name}`)}</name>${p.words.trim() ? `\n      <description>${xmlText(p.words.trim())}</description>` : ''}\n      <Point>\n        <coordinates>${n(p.lng)},${n(p.lat)},0</coordinates>\n      </Point>\n    </Placemark>`)
  // KML colours are alpha, blue, green, red: the paint's #ff5a1f written backwards.
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>${xmlText(i.name)}</name>\n    <description>${xmlText(about(i))}</description>\n    <Style id="paint">\n      <LineStyle>\n        <color>ff1f5aff</color>\n        <width>5</width>\n      </LineStyle>\n    </Style>\n${[...lines, ...places].join('\n')}\n  </Document>\n</kml>\n`
}

/** GPS Exchange 1.1: hiking apps and handhelds. A track for a line, a waypoint for a place, and no time on either. */
export function paintedMapGpx(i: PaintedMapFileInput): string {
  const places = i.places.map((p) => `  <wpt lat="${n(p.lat)}" lon="${n(p.lng)}">\n    <name>${xmlText(`${p.number}. ${p.name}`)}</name>${p.words.trim() ? `\n    <desc>${xmlText(p.words.trim())}</desc>` : ''}\n  </wpt>`)
  const lines = i.lines
    .filter((l) => l.points.length >= 2)
    .map((l, k, all) => `  <trk>\n    <name>${xmlText(lineName(l, k, all.length))}</name>${l.lengthWords ? `\n    <desc>${xmlText(l.lengthWords)}</desc>` : ''}\n    <trkseg>\n${l.points.map((p) => `      <trkpt lat="${n(p.lat)}" lon="${n(p.lng)}"/>`).join('\n')}\n    </trkseg>\n  </trk>`)
  // The schema's order: the file's own words, then waypoints, then tracks.
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="${xmlText(i.company.trim() || 'Painted map')}" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata>\n    <name>${xmlText(i.name)}</name>\n    <desc>${xmlText(about(i))}</desc>\n  </metadata>\n${[...places, ...lines].join('\n')}\n</gpx>\n`
}

export type PaintedMapFileKind = 'kml' | 'gpx'
export const PAINTED_MAP_FILE_TYPES: Readonly<Record<PaintedMapFileKind, string>> = { kml: 'application/vnd.google-earth.kml+xml', gpx: 'application/gpx+xml' }
/** What each press says it is for. */
export const PAINTED_MAP_FILE_WORDS: Readonly<Record<PaintedMapFileKind, { press: string; forWhat: string }>> = {
  kml: { press: 'A .kml file', forWhat: 'Google Earth and Google My Maps' },
  gpx: { press: 'A .gpx file', forWhat: 'A hiking app or a handheld' },
}

/** The file's text, its name and its type. */
export function paintedMapFile(kind: PaintedMapFileKind, i: PaintedMapFileInput): { name: string; type: string; text: string } {
  return { name: pictureFileName(i.name, kind), type: PAINTED_MAP_FILE_TYPES[kind], text: kind === 'kml' ? paintedMapKml(i) : paintedMapGpx(i) }
}
