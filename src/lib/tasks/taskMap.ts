/**
 * A painted map on a task (punch list #345, "A map on a task"). Pure.
 *
 * A task's place is a dot (#328). Some work is a line and not a dot: a trench, a route for a
 * camera, a run of pipe. So a task may carry a painted map with no place at all. The column is the
 * one a place's way in already uses (`painted_map_id`, `20261115063000_task_painted_maps.sql`), and
 * whoever reads the task reads the map.
 *
 * With a place and a map together, the dot is the place and the line is the way to it: that is
 * `taskPlaceWay.ts`. This file is the map by itself.
 *
 *  - `taskMapIdFromRow`: the map a row carries when it has no place.
 *  - `taskMapLineWords`: what the task says under its due line.
 *  - `taskMapFrame`: where the small picture looks, so the whole line is in it.
 *  - `taskMapHowFarWords`: the answer to How far am I?, measured to the line's start.
 */
import { haversineMeters } from '../jobTravelEstimate'
import type { PaintedBounds } from '../paintedMap/paintedLine'
import { PAINTED_MAP_UNNAMED, PAINTED_PLACE_UNNAMED, mapBounds, mapStart, mapSummaryWords, numberedPlaces, type PaintedLine, type PaintedPlace } from '../paintedMap/paintedMap'
import { TASK_PLACE_HERE_METERS, isTaskPlacePoint, taskPlaceAccuracyWords, taskPlaceDirection, taskPlaceDistanceWords, type TaskPlacePoint } from './taskPlace'

/** The painted map a task's row carries by itself: null when the row has a place, since the map is then that place's way in. */
export function taskMapIdFromRow(row: { place_lat?: number | null; place_lng?: number | null; painted_map_id?: string | null } | null | undefined): string | null {
  if (!row || isTaskPlacePoint(row.place_lat, row.place_lng)) return null
  return typeof row.painted_map_id === 'string' && row.painted_map_id ? row.painted_map_id : null
}

/** Under the due line: `The trench · about 830 ft · 3 places`. A map with nothing on it yet is its name alone. */
export function taskMapLineWords(mapName: string | null | undefined, lines: ReadonlyArray<Pick<PaintedLine, 'lengthM' | 'measuredFt'>>, placeCount: number): string {
  const name = (mapName ?? '').trim() || PAINTED_MAP_UNNAMED
  const summary = mapSummaryWords(lines, placeCount)
  return summary ? `${name} · ${summary}` : name
}

/** How many places the card names under the picture. Past it the rest are counted. */
export const TASK_MAP_PLACES_NAMED = 6

/**
 * The key under the picture: each numbered dot and its name, in the order the dots are numbered.
 * `more` counts the places past the ones named, so a map of twenty places stays three lines.
 */
export function taskMapPlaceKey(places: ReadonlyArray<PaintedPlace>, max: number = TASK_MAP_PLACES_NAMED): { named: Array<{ id: string; number: number; name: string }>; more: number } {
  const all = numberedPlaces(places)
  const named = all.slice(0, Math.max(0, max)).map((p) => ({ id: p.id, number: p.number, name: p.name.trim() || PAINTED_PLACE_UNNAMED }))
  return { named, more: all.length - named.length }
}

export type TaskMapFrame = { center: TaskPlacePoint; zoom: number }

const FRAME_MIN_ZOOM = 3
/** As close as the picture goes: a short line still shows the building it runs beside. */
const FRAME_MAX_ZOOM = 19
/** The line keeps this share of the picture, so it never touches the frame. */
const FRAME_FILL = 0.8
const TILE = 256

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360))

/**
 * Where a still picture looks so the whole map is in it: the middle of its box, at the closest zoom
 * that holds the box. `size` is the picture in pixels. Null for a map with nothing on it.
 */
export function taskMapFrame(lines: ReadonlyArray<Pick<PaintedLine, 'points'>>, places: ReadonlyArray<TaskPlacePoint>, size: { width: number; height: number } = { width: 320, height: 150 }): TaskMapFrame | null {
  const box: PaintedBounds | null = mapBounds(lines, places)
  if (!box) return null
  const center = { lat: (box.south + box.north) / 2, lng: (box.west + box.east) / 2 }
  const lngShare = Math.abs(box.east - box.west) / 360
  const latShare = Math.abs(mercatorY(box.north) - mercatorY(box.south)) / (2 * Math.PI)
  const fit = (share: number, pixels: number) => (share > 0 ? Math.log2((pixels * FRAME_FILL) / (TILE * share)) : FRAME_MAX_ZOOM)
  const zoom = Math.floor(Math.min(fit(lngShare, size.width), fit(latShare, size.height)))
  return { center, zoom: Math.max(FRAME_MIN_ZOOM, Math.min(FRAME_MAX_ZOOM, Number.isFinite(zoom) ? zoom : FRAME_MAX_ZOOM)) }
}

/** Where the map starts: Directions and How far am I? both go here. */
export function taskMapStart(lines: ReadonlyArray<Pick<PaintedLine, 'points' | 'madeAt'>>, places: ReadonlyArray<PaintedPlace>): TaskPlacePoint | null {
  return mapStart(lines, places)
}

/** The answer to How far am I? on a task with a map and no place: `The start is 250 ft north-east of you.` */
export function taskMapHowFarWords(from: TaskPlacePoint & { accuracyM?: number | null }, start: TaskPlacePoint): { lead: string; sure: string | null } {
  const meters = haversineMeters(from, start)
  const sure = taskPlaceAccuracyWords(from.accuracyM)
  const tail = sure ? `Your phone is sure ${sure}.` : null
  if (meters <= TASK_PLACE_HERE_METERS) return { lead: 'You are at the start.', sure: tail }
  return { lead: `The start is ${taskPlaceDistanceWords(meters)} ${taskPlaceDirection(from, start)} of you.`, sure: tail }
}

export const TASK_MAP_WORDS = {
  /** The line under the due line before the map is read. */
  reading: 'A painted map',
  open: 'Open the map',
  directionsToStart: 'Directions to the start',
  howFar: 'How far am I?',
  finding: 'Finding you…',
  /** What the stroke says to a screen reader. */
  mark: 'This task has a painted map',
} as const
