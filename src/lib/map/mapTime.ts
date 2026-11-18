/**
 * Time on a map (punch list #395): the pure half of the press that shows a place on earlier days.
 *
 * A map with the press has two states. Off, it is the map of today. On, it frames one spot on the
 * photo archive, with a row of dates under it: the newest photograph is **Today**, and every older
 * one is a date. The archive is Esri's, so a Google map is down for as long as Time is on, and
 * flipping between Today and a date changes one tile layer on one canvas.
 *
 * The photographs, their days and the walk that finds them are `olderPhotos.ts`. This file is what
 * the row lights, steps to, reads and says. Whether Time is on is kept nowhere: it lives in the map
 * on screen (`useMapTime`) and ends with it.
 */
import { olderPhotoLongDay, type MapSpot, type OlderPhotoChoice, type OlderPhotoFound } from './olderPhotos'

export const MAP_TIME_PRESS = 'Time'
export const MAP_TIME_TODAY_PRESS = 'Today'
export const MAP_TIME_NO_SPOT_WORDS = 'Press a dot to pick the spot.'
export const MAP_TIME_DOTS_WORDS = 'The dots are today’s.'
export const MAP_TIME_NO_OLDER_WORDS = 'The archive has no older photo of this spot.'
export const MAP_TIME_OLDER_PRESS = 'An older photo'
export const MAP_TIME_NEWER_PRESS = 'A newer photo'
export const MAP_TIME_EARTH_PRESS = 'Older in Google Earth'

/** The place Time looks at, with the name the row says. */
export type MapTimeSpot = MapSpot & { name: string }

/**
 * The date a person pressed. `release` draws it. `publishedYmd` is the day that photograph first
 * went up, which is what carries the pick to another spot: a release covers the whole map.
 */
export type MapTimePick = { release: number; publishedYmd: string }

/** The spot Time looks at on a map of dots: the open dot, or the only dot. Several dots and none open is no spot. */
export function mapTimeSpotFromPins(pins: ReadonlyArray<{ id: string; lat: number; lng: number; title: string }>, selectedId: string | null): MapTimeSpot | null {
  const pin = pins.find((p) => p.id === selectedId) ?? (pins.length === 1 ? pins[0] : undefined)
  return pin ? { lat: pin.lat, lng: pin.lng, name: pin.title } : null
}

/** Today's photograph: the choice that holds the walk's first stop, the newest picture the archive has. */
export function mapTimeToday(found: ReadonlyArray<OlderPhotoFound>, choices: ReadonlyArray<OlderPhotoChoice>): OlderPhotoChoice | null {
  const newest = found[0]
  return newest ? (choices.find((c) => c.releases.includes(newest.release)) ?? null) : null
}

/** The dates on the row, oldest first: every photograph but today's. */
export function mapTimeOlder(found: ReadonlyArray<OlderPhotoFound>, choices: ReadonlyArray<OlderPhotoChoice>): OlderPhotoChoice[] {
  const today = mapTimeToday(found, choices)
  return choices.filter((c) => c !== today)
}

/** What a press on a date keeps. */
export function mapTimePickFor(found: ReadonlyArray<OlderPhotoFound>, choice: OlderPhotoChoice): MapTimePick {
  const stop = found.find((f) => f.release === choice.release) ?? found.find((f) => choice.releases.includes(f.release))
  return { release: choice.release, publishedYmd: stop?.publishedYmd ?? choice.ymd }
}

/**
 * The photograph a pick stands for at the spot on show, or nothing while it cannot be said.
 *
 * At the spot where it was pressed that is the date itself. At another spot it is the photograph
 * that was up there on the day the pressed one first went up: the newest stop published on or before
 * that day, or the oldest stop when the spot has nothing that old. The walk goes newest to oldest
 * and only its last stop's day moves, so an answer does not change once it is given. Until the walk
 * has gone far enough the answer is nothing, and the map draws the pressed release as it is.
 */
export function mapTimeShown(found: ReadonlyArray<OlderPhotoFound>, choices: ReadonlyArray<OlderPhotoChoice>, pick: MapTimePick | null, walked: boolean): OlderPhotoChoice | null {
  if (!pick) return null
  const of = (release: number) => choices.find((c) => c.releases.includes(release)) ?? null
  const same = of(pick.release)
  if (same) return same
  const at = found.findIndex((f) => f.publishedYmd <= pick.publishedYmd)
  // The last stop's day may still move back, so it is an answer only once the walk is over.
  if (at >= 0 && (at < found.length - 1 || walked)) return of(found[at]!.release)
  if (at < 0 && walked && found.length > 0) return of(found[found.length - 1]!.release)
  return null
}

/**
 * One step along the row, where the dates run oldest first and Today is past the newest.
 * `null` is a step that goes nowhere: older than the oldest, or newer than Today.
 */
export function mapTimeStep(older: ReadonlyArray<OlderPhotoChoice>, shown: OlderPhotoChoice | null, direction: -1 | 1): OlderPhotoChoice | 'today' | null {
  const at = shown ? older.indexOf(shown) : older.length
  if (at < 0) return null
  const to = at + direction
  if (to < 0 || to > older.length) return null
  return to === older.length ? 'today' : older[to]!
}

/** What the press reads: its name, with the date on show. A phone has room for the date alone. */
export function mapTimeButtonLabel(shown: OlderPhotoChoice | null, isMobile: boolean): string {
  if (!shown) return MAP_TIME_PRESS
  return isMobile ? shown.label : `${MAP_TIME_PRESS} · ${shown.label}`
}

/** How many older photographs, in words. */
function olderCountWords(n: number): string {
  if (n === 0) return MAP_TIME_NO_OLDER_WORDS
  return n === 1 ? '1 older photo.' : `${n} older photos.`
}

/**
 * The sentence over the row.
 *
 * With a date on show it is that photograph's own sentence, and what on the map is not from that
 * day. With Today on show it names the spot and the day today's photograph was taken, which is
 * rarely today, and once the walk is over it counts what is older.
 */
export function mapTimeCaption(args: {
  spotName: string
  today: OlderPhotoChoice | null
  olderCount: number
  /** The date on show. Nothing is Today. */
  shown: OlderPhotoChoice | null
  /** The walk is still meeting photographs. */
  walking: boolean
  /** What on the map is not from the photograph's day: `The dots are today’s.` */
  dotsWords?: string
}): string {
  const { spotName, today, olderCount, shown, walking, dotsWords = MAP_TIME_DOTS_WORDS } = args
  if (shown) return shown.taken && dotsWords ? `${shown.caption} ${dotsWords}` : shown.caption
  const taken = today?.taken ? `, taken ${olderPhotoLongDay(today.ymd)}` : ''
  const lead = `Today’s photo of ${spotName}${taken}.`
  return walking ? lead : `${lead} ${olderCountWords(olderCount)}`
}
