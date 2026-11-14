/**
 * A painted map (punch list #345): lines somebody walked, drove or drew by hand, and named places
 * with a word and a photo, on a job, on a development or on nothing yet. A street address cannot
 * say which gate, where to park or where the meter is. This file is the map's rows and its words.
 * Pure: no map, no network, no clock, no browser.
 *
 * The rules the screens lean on:
 * - The words a person reads are *painted map*, *line* and *place*, and the mark on a map is a
 *   *dot*. Never *pin* (Pin Mode pins a page), never *location* (that is where a person is), and
 *   never *track* or *route* (nothing here follows anyone or routes anything).
 * - A length is always *about*, rounded, with its give or take and how it was made. A length
 *   somebody measured with a wheel or a tape and typed in wins over every other, and says so.
 * - A saved line is a shape. Nothing here reads or writes a time along a line.
 */
import { haversineMeters } from '../jobTravelEstimate'
import {
  boundsOfPoints,
  isPaintedPoint,
  lineLengthMeters,
  partsFromJson,
  pointsFromJson,
  pointsToJson,
  type PaintedBounds,
  type PaintedPart,
  type PaintedPoint,
} from './paintedLine'

export type PaintedLineHow = 'walked' | 'driven' | 'drawn'
export type PaintedMeasuredHow = 'wheel' | 'tape' | 'other'

export const PAINTED_MAP_NAME_MAX = 60
export const PAINTED_MAP_WORDS_MAX = 160
export const PAINTED_PLACE_NAME_MAX = 40
export const PAINTED_PLACE_WORDS_MAX = 160
/** A map with no name of its own. A name is asked for, and this stands in when nobody gave one. */
export const PAINTED_MAP_UNNAMED = 'A painted map'
export const PAINTED_PLACE_UNNAMED = 'A place'

/** The names offered as chips when a place is added: the things a crew and a driver ask about. */
export const PAINTED_PLACE_CHIPS = ['Gate', 'Park here', 'Door', 'Meter', 'Shutoff', 'Cleanout'] as const

/** `painted_maps` as stored. */
export type PaintedMapRow = {
  id: string
  name: string
  words: string
  job_id: string | null
  development_id: string | null
  created_by: string | null
  created_at: string
}
/** `painted_map_lines` as stored. */
export type PaintedMapLineRow = {
  id: string
  map_id: string
  label: string
  how: string
  points: unknown
  poor_parts: unknown
  fixed_by_hand: boolean
  length_m: number
  margin_m: number | null
  measured_ft: number | string | null
  measured_how: string | null
  made_by: string | null
  made_at: string
}
/** `painted_map_places` as stored. */
export type PaintedMapPlaceRow = {
  id: string
  map_id: string
  name: string
  words: string
  lat: number
  lng: number
  accuracy_m: number | null
  photo_path: string | null
  set_by: string | null
  set_at: string
}

export const PAINTED_MAP_SELECT = 'id,name,words,job_id,development_id,created_by,created_at'
export const PAINTED_MAP_LINE_SELECT = 'id,map_id,label,how,points,poor_parts,fixed_by_hand,length_m,margin_m,measured_ft,measured_how,made_by,made_at'
export const PAINTED_MAP_PLACE_SELECT = 'id,map_id,name,words,lat,lng,accuracy_m,photo_path,set_by,set_at'

export type PaintedMap = {
  id: string
  name: string
  words: string
  jobId: string | null
  developmentId: string | null
  createdBy: string | null
  createdAt: string
}
export type PaintedLine = {
  id: string
  mapId: string
  label: string
  how: PaintedLineHow
  points: PaintedPoint[]
  poorParts: PaintedPart[]
  fixedByHand: boolean
  lengthM: number
  marginM: number | null
  measuredFt: number | null
  measuredHow: PaintedMeasuredHow | null
  madeBy: string | null
  madeAt: string
}
export type PaintedPlace = PaintedPoint & {
  id: string
  mapId: string
  name: string
  words: string
  /** The phone's margin in metres when the place was set from where the painter stood; null when placed by hand. */
  accuracyM: number | null
  photoPath: string | null
  setBy: string | null
  setAt: string
}

/** One line, trimmed, inner spaces collapsed, cut at the cap. */
export function cleanPaintedText(raw: string | null | undefined, max: number): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, max).trim()
}

const HOWS: ReadonlyArray<PaintedLineHow> = ['walked', 'driven', 'drawn']
const MEASURED: ReadonlyArray<PaintedMeasuredHow> = ['wheel', 'tape', 'other']
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function paintedMapFromRow(row: PaintedMapRow): PaintedMap {
  return {
    id: row.id,
    name: cleanPaintedText(row.name, PAINTED_MAP_NAME_MAX) || PAINTED_MAP_UNNAMED,
    words: cleanPaintedText(row.words, PAINTED_MAP_WORDS_MAX),
    jobId: row.job_id ?? null,
    developmentId: row.development_id ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
  }
}

/** A stored line, or null when what is stored cannot be drawn: fewer than two real points, or a way of making it nobody knows. */
export function paintedLineFromRow(row: PaintedMapLineRow): PaintedLine | null {
  const points = pointsFromJson(row.points)
  if (points.length < 2) return null
  const how = HOWS.find((h) => h === row.how)
  if (!how) return null
  const measured = typeof row.measured_ft === 'string' ? Number(row.measured_ft) : row.measured_ft
  const measuredHow = MEASURED.find((m) => m === row.measured_how) ?? null
  const hasMeasure = finite(measured) && measured > 0 && measuredHow !== null
  return {
    id: row.id,
    mapId: row.map_id,
    label: cleanPaintedText(row.label, PAINTED_MAP_NAME_MAX),
    how,
    points,
    poorParts: partsFromJson(row.poor_parts, points.length),
    fixedByHand: row.fixed_by_hand === true,
    lengthM: finite(row.length_m) && row.length_m >= 0 ? row.length_m : 0,
    marginM: finite(row.margin_m) && row.margin_m >= 0 ? row.margin_m : null,
    measuredFt: hasMeasure ? (measured as number) : null,
    measuredHow: hasMeasure ? measuredHow : null,
    madeBy: row.made_by ?? null,
    madeAt: row.made_at,
  }
}

/** A stored place, or null when its point is not on the globe. */
export function paintedPlaceFromRow(row: PaintedMapPlaceRow): PaintedPlace | null {
  if (!isPaintedPoint({ lat: row.lat, lng: row.lng })) return null
  return {
    id: row.id,
    mapId: row.map_id,
    name: cleanPaintedText(row.name, PAINTED_PLACE_NAME_MAX) || PAINTED_PLACE_UNNAMED,
    words: cleanPaintedText(row.words, PAINTED_PLACE_WORDS_MAX),
    lat: row.lat,
    lng: row.lng,
    accuracyM: finite(row.accuracy_m) && row.accuracy_m >= 0 ? row.accuracy_m : null,
    photoPath: row.photo_path || null,
    setBy: row.set_by ?? null,
    setAt: row.set_at,
  }
}

/** A line not yet saved: what the drawing and the walking hand over. */
export type PaintedLineDraft = {
  label?: string | null
  how: PaintedLineHow
  points: ReadonlyArray<PaintedPoint>
  poorParts?: ReadonlyArray<PaintedPart>
  fixedByHand?: boolean
  marginM?: number | null
}

/**
 * The columns a new line writes, or null when there is no line to write. The length is worked out
 * here from the points being saved, so the number stored is always the number of the shape stored.
 */
export function paintedLineColumns(draft: PaintedLineDraft, mapId: string, by: string) {
  const points = pointsToJson(draft.points)
  if (points.length < 2) return null
  const back = pointsFromJson(points)
  const poor = partsFromJson((draft.poorParts ?? []).map(([a, b]) => [a, b]), back.length)
  return {
    map_id: mapId,
    label: cleanPaintedText(draft.label, PAINTED_MAP_NAME_MAX),
    how: draft.how,
    points,
    poor_parts: poor.map(([a, b]) => [a, b]),
    fixed_by_hand: draft.how !== 'drawn' && draft.fixedByHand === true,
    length_m: Math.round(lineLengthMeters(back, poor) * 100) / 100,
    margin_m: finite(draft.marginM) && draft.marginM >= 0 ? Math.round(draft.marginM * 100) / 100 : null,
    made_by: by,
  }
}

/** The columns a new place writes, or null when the point is not on the globe. */
export function paintedPlaceColumns(
  place: PaintedPoint & { name?: string | null; words?: string | null; accuracyM?: number | null; photoPath?: string | null },
  mapId: string,
  by: string,
) {
  if (!isPaintedPoint(place)) return null
  return {
    map_id: mapId,
    name: cleanPaintedText(place.name, PAINTED_PLACE_NAME_MAX) || PAINTED_PLACE_UNNAMED,
    words: cleanPaintedText(place.words, PAINTED_PLACE_WORDS_MAX),
    lat: place.lat,
    lng: place.lng,
    accuracy_m: finite(place.accuracyM) && place.accuracyM >= 0 ? Math.round(place.accuracyM) : null,
    photo_path: place.photoPath || null,
    set_by: by,
  }
}

const FEET_PER_METER = 3.28084
const FEET_PER_MILE = 5280

/**
 * `about 830 ft`, `about 1,250 ft`, `about 1.4 mi`. Rounded to what the number can bear: the
 * nearest 5 ft under a hundred, 10 ft under a thousand, 50 ft under a mile, and a tenth of a mile
 * past it. Never `638.4 ft`: nothing here knows a length that well.
 */
export function aboutLengthWords(meters: number): string {
  const feet = Math.max(0, meters) * FEET_PER_METER
  if (feet >= FEET_PER_MILE) return `about ${(feet / FEET_PER_MILE).toFixed(1)} mi`
  const step = feet < 100 ? 5 : feet < 1000 ? 10 : 50
  return `about ${Math.max(step, Math.round(feet / step) * step).toLocaleString('en-US')} ft`
}

/** `give or take 40 ft`, rounded up, so the words never claim more than is known. Null when nothing is known. */
export function giveOrTakeWords(marginM: number | null | undefined): string | null {
  if (!finite(marginM) || marginM < 0) return null
  const feet = marginM * FEET_PER_METER
  const step = feet < 50 ? 5 : 10
  return `give or take ${Math.max(step, Math.ceil(feet / step) * step).toLocaleString('en-US')} ft`
}

const MEASURED_WORDS: Record<PaintedMeasuredHow, string> = {
  wheel: 'measured with a wheel',
  tape: 'measured with a tape',
  other: 'measured by hand',
}

/** `612 ft`, or `612.5 ft` when somebody typed the half foot. */
function measuredFeetWords(feet: number): string {
  const rounded = Math.round(feet * 10) / 10
  return `${rounded.toLocaleString('en-US', { maximumFractionDigits: 1 })} ft`
}

/** How a line was made, in a few words: `walked`, `driven`, `drawn by hand`, `walked, a part drawn by hand`. */
export function lineHowWords(line: Pick<PaintedLine, 'how' | 'fixedByHand'>): string {
  if (line.how === 'drawn') return 'drawn by hand'
  return line.fixedByHand ? `${line.how}, a part drawn by hand` : line.how
}

/**
 * A line's length as a person reads it. A measured length leads and says how it was measured.
 * Otherwise the length is about, with its give or take.
 *   { lead: '612 ft', tail: 'measured with a wheel', measured: true }
 *   { lead: 'About 830 ft', tail: 'give or take 40 ft', measured: false }
 */
export function lineLengthWords(line: Pick<PaintedLine, 'lengthM' | 'marginM' | 'measuredFt' | 'measuredHow'>): { lead: string; tail: string | null; measured: boolean } {
  if (line.measuredFt != null && line.measuredHow) {
    return { lead: measuredFeetWords(line.measuredFt), tail: MEASURED_WORDS[line.measuredHow], measured: true }
  }
  const about = aboutLengthWords(line.lengthM)
  return { lead: about.charAt(0).toUpperCase() + about.slice(1), tail: giveOrTakeWords(line.marginM), measured: false }
}

/** A measured length as typed, or null when it is not a length: `612`, `612.5`, `612 ft`, `1,250`. */
export function parseMeasuredFeet(raw: string | null | undefined): number | null {
  const text = (raw ?? '').replace(/,/g, '').replace(/\s*(ft|feet|foot|')\s*$/i, '').trim()
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  const feet = Math.round(Number(text) * 10) / 10
  return feet > 0 && feet < 1_000_000 ? feet : null
}

/** A map's whole length in metres: each line's typed length where it has one, its own otherwise. */
export function mapLengthMeters(lines: ReadonlyArray<Pick<PaintedLine, 'lengthM' | 'measuredFt'>>): number {
  return lines.reduce((sum, l) => sum + (l.measuredFt != null ? l.measuredFt / FEET_PER_METER : l.lengthM), 0)
}

/** `about 830 ft · 3 places`, `2 places`, `about 1,250 ft`. The line under a map's name. Empty for an empty map. */
export function mapSummaryWords(lines: ReadonlyArray<Pick<PaintedLine, 'lengthM' | 'measuredFt'>>, placeCount: number): string {
  const parts: string[] = []
  if (lines.length > 0) parts.push(aboutLengthWords(mapLengthMeters(lines)))
  if (placeCount > 0) parts.push(`${placeCount} place${placeCount === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

/** `Painted by Dana Whitlock on Nov 13.` The caller hands in the name and the day in the app's words. */
export function paintedByWords(byName: string | null | undefined, dayWords: string | null | undefined): string | null {
  const by = (byName ?? '').trim()
  const day = (dayWords ?? '').trim()
  if (by && day) return `Painted by ${by} on ${day}.`
  if (by) return `Painted by ${by}.`
  if (day) return `Painted on ${day}.`
  return null
}

/**
 * The maps a job shows: its own first, then its development's, each newest first. A map painted
 * for a development is every lot's way in, so it shows on each of its jobs.
 */
export function mapsForJob(maps: ReadonlyArray<PaintedMap>, jobId: string, developmentId: string | null): Array<PaintedMap & { fromDevelopment: boolean }> {
  const newest = (a: PaintedMap, b: PaintedMap) => b.createdAt.localeCompare(a.createdAt)
  const own = maps.filter((m) => m.jobId === jobId).sort(newest)
  const shared = developmentId ? maps.filter((m) => m.developmentId === developmentId).sort(newest) : []
  return [...own.map((m) => ({ ...m, fromDevelopment: false })), ...shared.map((m) => ({ ...m, fromDevelopment: true }))]
}

export type NumberedPlace = PaintedPlace & { number: number }

/** A map's places with the number each dot wears: the order they were set in, so a number never moves when another is added. */
export function numberedPlaces(places: ReadonlyArray<PaintedPlace>): NumberedPlace[] {
  return places
    .slice()
    .sort((a, b) => a.setAt.localeCompare(b.setAt) || a.id.localeCompare(b.id))
    .map((p, i) => ({ ...p, number: i + 1 }))
}

/** The box a map opens framed on: every line and every place. Null for an empty map. */
export function mapBounds(lines: ReadonlyArray<Pick<PaintedLine, 'points'>>, places: ReadonlyArray<PaintedPoint>): PaintedBounds | null {
  return boundsOfPoints([...lines.flatMap((l) => l.points), ...places])
}

/**
 * Where a map starts: the first point of its oldest line, or its first place when it has no line.
 * Directions go here. A maps app can route to a gate on a road. It cannot follow a painted line.
 */
export function mapStart(lines: ReadonlyArray<Pick<PaintedLine, 'points' | 'madeAt'>>, places: ReadonlyArray<PaintedPlace>): PaintedPoint | null {
  const first = lines.slice().sort((a, b) => a.madeAt.localeCompare(b.madeAt))[0]
  if (first && first.points[0]) return { lat: first.points[0].lat, lng: first.points[0].lng }
  const place = numberedPlaces(places)[0]
  return place ? { lat: place.lat, lng: place.lng } : null
}

/** A corner or a dot catches a target inside this reach: about 12 ft, what a fingertip under the glass can mean. */
export const PAINTED_SNAP_METERS = 3.5

/** Two points close enough to be one press: a corner pressed twice, a place set where one stands. */
export function isSamePaintedSpot(a: PaintedPoint, b: PaintedPoint): boolean {
  return haversineMeters(a, b) <= 0.5
}
