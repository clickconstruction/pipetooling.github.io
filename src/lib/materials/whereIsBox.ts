/**
 * Where is it? on a cage or a box (punch list #372, step 2): what the app knows about where a box stands, said in
 * sentences, the distance from where the reader stands to its pin, and the rule for I found it. Pure: no map, no
 * network, no clock, no browser. The sheet is `WhereIsBox.tsx`.
 *
 * The rules the screens lean on:
 * - Words first. A phone cannot tell one side of a wall from the other and knows no floor, so the place, the where
 *   note and the photo do the last steps. The map and the line get a person to the right side of the right building.
 * - A pin is where someone said the box was, on some day. The sheet always says the day and the person
 *   (`job_containers.pinned_at`, `pinned_by_name`, v2.7573), and a pin older than `BOX_PIN_OLD_DAYS` says so.
 * - A distance is always *about*, with the phone's own margin beside it, and the line is straight: it knows no
 *   fence, wall or gate. The words are a task place's own (`taskPlace.ts`), so a crew reads one way of saying it.
 * - I found it reads the phone once and pins the box where the finder stands. A reading the phone is not sure of
 *   within about 150 ft is refused in words, as a task's place refuses one: a bad pin is worse than no pin.
 */
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort, todayYmdInAppTz, ymdDaysBetween } from '../../utils/dateUtils'
import { haversineMeters } from '../jobTravelEstimate'
import { TASK_PLACE_HERE_METERS, TASK_PLACE_POOR_FIX_METERS, cleanTaskPlaceName, isPoorTaskPlaceFix, taskPlaceAccuracyWords, taskPlaceDirection, taskPlaceDistanceWords, type TaskPlaceDraft } from '../tasks/taskPlace'
import { lastCountedAt, type Container, type ContainerMove, type Movement, type Place } from './onSite'

/** The press on a box, and the sheet's own presses, each by its exact name. */
export const WHERE_IS_IT_PRESS = 'Where is it?'
export const WHERE_SHOW_ME_PRESS = 'Show where I am'
export const WHERE_FOUND_PRESS = 'I found it'
export const WHERE_DIRECTIONS_PRESS = 'Directions'
export const WHERE_SITE_DIRECTIONS_PRESS = 'Directions to the site'
export const WHERE_MOVE_PIN_PRESS = 'Move the pin by hand'
export const WHERE_TRY_AGAIN_PRESS = 'Try again'
export const WHERE_SAME_PLACE_PRESS = 'Yes, same place'
export const WHERE_SEND_SOMEONE_PRESS = 'Send someone to it'
/** Said under Show where I am: the reader's dot is drawn on this phone and sent nowhere. */
export const WHERE_PRIVACY_WORDS = 'Your location stays on this phone. The dot moves while this sheet is open and the screen is on.'

/** A pin older than this reads as old: boxes get moved. A guess, with nothing measured behind it yet. */
export const BOX_PIN_OLD_DAYS = 30

export function whereIsBoxTitle(label: string): string {
  return `Where is ${label}?`
}

/** What the sheet reads off a box. */
export type WhereBox = Pick<Container, 'id' | 'label' | 'where' | 'locationId' | 'lat' | 'lng' | 'pinnedAt' | 'pinnedByName' | 'pinAccuracyM'>

/** A point with the phone's own margin in metres, as `requestMyFix` hands it over. */
export type WhereFix = { lat: number; lng: number; accuracyM: number | null }

export function boxIsPinned<T extends Pick<Container, 'lat' | 'lng'>>(box: T): box is T & { lat: number; lng: number } {
  return typeof box.lat === 'number' && typeof box.lng === 'number' && Number.isFinite(box.lat) && Number.isFinite(box.lng)
}

/** `Nov 12`, or `today` on the company's calendar. Null for no time or one that does not parse. */
function dayWords(iso: string | null | undefined, now: Date): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  const ymd = calendarYmdInAppTzFromIso(iso)
  return ymd === todayYmdInAppTz(now) ? 'today' : formatWorkDateYmdMonthDayShort(ymd)
}

/** `on Nov 12`, or plain `today`. */
function onDay(day: string): string {
  return day === 'today' ? 'today' : `on ${day}`
}

/** Whole days since the pin was set, on the company's calendar. Null when the pin kept no day. */
export function boxPinAgeDays(box: Pick<Container, 'pinnedAt'>, now: Date): number | null {
  if (!box.pinnedAt || !Number.isFinite(new Date(box.pinnedAt).getTime())) return null
  const days = ymdDaysBetween(calendarYmdInAppTzFromIso(box.pinnedAt), todayYmdInAppTz(now))
  return days == null ? null : Math.max(0, days)
}

export function boxPinIsOld(box: Pick<Container, 'pinnedAt'>, now: Date): boolean {
  const days = boxPinAgeDays(box, now)
  return days != null && days > BOX_PIN_OLD_DAYS
}

/** `5 weeks`, `2 months`: how old an old pin is, in the unit a person would say. */
function ageWords(days: number): string {
  if (days < 60) {
    const weeks = Math.max(1, Math.round(days / 7))
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`
  }
  const months = Math.round(days / 30)
  return `${months} months`
}

/** The box screen's short mark beside its place: `pinned Nov 12`, `pinned today`, `pinned on the map`. Null with no pin. */
export function boxPinShort(box: Pick<Container, 'lat' | 'lng' | 'pinnedAt'>, now: Date): string | null {
  if (!boxIsPinned(box)) return null
  const day = dayWords(box.pinnedAt, now)
  return day ? `pinned ${day}` : 'pinned on the map'
}

/** The pin's own sentence: `Pinned on Nov 12 by Marcus Reyes, within 20 ft.` Null with no pin. */
export function boxPinSentence(box: Pick<Container, 'lat' | 'lng' | 'pinnedAt' | 'pinnedByName' | 'pinAccuracyM'>, now: Date): string | null {
  if (!boxIsPinned(box)) return null
  const day = dayWords(box.pinnedAt, now)
  if (!day) return 'Pinned on the map. The day was not kept.'
  const by = (box.pinnedByName ?? '').trim()
  const sure = taskPlaceAccuracyWords(box.pinAccuracyM)
  return `Pinned ${onDay(day)}${by ? ` by ${by}` : ''}${sure ? `, ${sure}` : ''}.`
}

/** The newest move of this box into a place: who put it there and when. Null when nobody moved it. */
export function lastPutOf(moves: ReadonlyArray<ContainerMove>, containerId: string): { at: string; byName: string; toLocationId: string } | null {
  let best: ContainerMove | null = null
  for (const m of moves) {
    if (m.containerId !== containerId || !m.toLocationId) continue
    if (!best || m.at > best.at) best = m
  }
  return best && best.toLocationId ? { at: best.at, byName: best.byName, toLocationId: best.toLocationId } : null
}

/** The newest count of this box, else the newest press on anything in it: who was at the box last. */
export function lastTouchOf(movements: ReadonlyArray<Movement>, containerId: string): { at: string; byName: string; counted: boolean } | null {
  const counted = lastCountedAt(movements, containerId)
  if (counted) return { ...counted, counted: true }
  let best: Movement | null = null
  for (const m of movements) {
    if (m.fromContainerId !== containerId && m.toContainerId !== containerId) continue
    if (!best || m.at > best.at) best = m
  }
  return best ? { at: best.at, byName: best.byName, counted: false } : null
}

export type WhereIsBoxWords = {
  /** The first sentence, drawn large. */
  lead: string
  /** The sentences under it, in order. */
  lines: string[]
  pinned: boolean
  placed: boolean
  /** An old pin's caution, or null. */
  old: string | null
}

/**
 * Everything the app knows about where a box stands, as sentences. A pinned box leads with its place. A box nobody
 * pinned leads with that, since it is the fact the reader most needs: there is no dot to walk to.
 */
export function whereIsBoxWords(input: {
  box: WhereBox
  places: ReadonlyArray<Place>
  /** The newest move into a place (`lastPutOf`). */
  lastPut: { at: string; byName: string; toLocationId: string } | null
  /** The newest count, else the newest press on any of its lines. */
  lastTouch: { at: string; byName: string; counted: boolean } | null
  now: Date
}): WhereIsBoxWords {
  const { box, places, lastPut, lastTouch, now } = input
  const place = places.find((p) => p.id === box.locationId)?.name ?? null
  const where = box.where.trim().replace(/[.\s]+$/, '')
  const pinned = boxIsPinned(box)
  const lines: string[] = []

  const stands = (subject: string): string[] => {
    if (place) return [`${subject} is at ${place}${where ? `, ${where}` : ''}.`]
    return where ? [`${subject} has no place yet.`, `The note says: ${where}.`] : [`${subject} has no place yet.`]
  }

  let lead: string
  if (pinned) {
    const [first, ...rest] = stands(box.label)
    lead = first!
    lines.push(...rest)
    const pin = boxPinSentence(box, now)
    if (pin) lines.push(pin)
  } else {
    lead = `Nobody has pinned ${box.label}.`
    lines.push(...stands('It'))
    // Who put it where it stands, when the newest move is the one that brought it to this place.
    if (place && lastPut && lastPut.toLocationId === box.locationId) {
      const day = dayWords(lastPut.at, now)
      const by = lastPut.byName.trim()
      if (day && by) lines.push(`${by} put it there ${onDay(day)}.`)
      else if (day) lines.push(`It was put there ${onDay(day)}.`)
    }
  }

  if (lastTouch) {
    const day = dayWords(lastTouch.at, now)
    const by = lastTouch.byName.trim()
    if (day && by) lines.push(`${by} ${lastTouch.counted ? 'counted' : 'handled'} it last, ${onDay(day)}.`)
  }

  const days = pinned ? boxPinAgeDays(box, now) : null
  const old = days != null && days > BOX_PIN_OLD_DAYS ? `That pin is ${ageWords(days)} old. Boxes get moved. If ${box.label} is not there, look near it, then press ${WHERE_FOUND_PRESS}.` : null
  return { lead, lines, pinned, placed: !!place, old }
}

/** What an unpinned box's sheet says where the line would be. */
export function whereNoPinWords(label: string): string {
  return `No pin yet, so there is no line to draw. When you find ${label}, press ${WHERE_FOUND_PRESS}.`
}

export type WhereFar = {
  /** `About 240 ft north-east of you.`, or `You are at the pin.` */
  lead: string
  /** How sure the phone is, or null when it did not say. */
  sure: string | null
  /** The phone's margin is too wide to trust the line: indoors, or beside a tall wall. */
  rough: boolean
  /** What to keep in mind about the line, or null at the pin. */
  note: string | null
  here: boolean
  meters: number
}

/** The answer to Show where I am: how far the pin is in a straight line, which way, and how much to trust it. */
export function whereIsBoxFar(me: WhereFix, pin: { lat: number; lng: number }): WhereFar {
  const meters = haversineMeters(me, pin)
  const here = meters <= TASK_PLACE_HERE_METERS
  const rough = isPoorTaskPlaceFix(me.accuracyM)
  const sureWords = taskPlaceAccuracyWords(me.accuracyM)
  const sure = sureWords ? `Your phone is ${rough ? 'only ' : ''}sure ${sureWords}.` : null
  const lead = here && !rough ? 'You are at the pin.' : `About ${taskPlaceDistanceWords(meters)} ${taskPlaceDirection(me, pin)} of you.`
  const note = rough ? 'You may be indoors. The line is a rough guide here. Go by the place, the note and the photo.' : here ? null : 'The line is straight. It knows no fence, wall or gate.'
  return { lead, sure, rough, note, here: here && !rough, meters }
}

/** Why the phone gave no reading, as `requestMyFix` reports it. */
export type WhereNoFix = 'none' | 'refused' | 'failed'

/** What I found it says when the phone gives no reading at all. */
export function foundNoFixWords(label: string, why: WhereNoFix): string {
  if (why === 'refused') return `Location is off for this app. To pin ${label} where you stand, allow location in the phone’s settings. Or move the pin by hand.`
  if (why === 'none') return `This device gives no location. ${label} was not pinned. Move the pin by hand.`
  return `Could not find you. ${label} was not pinned. Try again in the open, or move the pin by hand.`
}

export type FoundVerdict = { ok: true; pin: { lat: number; lng: number }; accuracyM: number; words: string } | { ok: false; words: string }

/**
 * May this reading become the box's pin? Nobody looks at the map before I found it saves, so the phone must say how
 * sure it is and be sure within the limit a task's place holds (about 150 ft).
 */
export function foundVerdict(label: string, fix: WhereFix): FoundVerdict {
  const acc = fix.accuracyM
  if (typeof acc !== 'number' || !Number.isFinite(acc) || acc < 0) return { ok: false, words: `Your phone did not say how sure it is. ${label} was not pinned. Try again in the open, or move the pin by hand.` }
  if (Math.round(acc) > TASK_PLACE_POOR_FIX_METERS) return { ok: false, words: `Your phone is only sure ${taskPlaceAccuracyWords(acc)}. ${label} was not pinned. Try again in the open, or move the pin by hand.` }
  return { ok: true, pin: { lat: fix.lat, lng: fix.lng }, accuracyM: acc, words: `${label} is pinned where you stand. Your phone was sure ${taskPlaceAccuracyWords(acc)}.` }
}

/** After I found it: the place may have changed too. Null when the box has no place to confirm. */
export function stillThereAsk(label: string, places: ReadonlyArray<Place>, locationId: string | null): string | null {
  const place = places.find((p) => p.id === locationId)?.name
  return place ? `Is ${label} still at ${place}?` : null
}

/** After I found it on a box with no place: the one press that gives it one. */
export function noPlaceAsk(label: string): string {
  return `Move box gives ${label} a place.`
}

/** The line over the newest photo: `The newest photo, from Nov 12.` The photo is what the person is looking for. */
export function newestPhotoWords(at: string | null | undefined, now: Date): string {
  const day = dayWords(at, now)
  return day ? `The newest photo, from ${day}.` : 'The newest photo.'
}

/** A reading from Show where I am is fresh enough for I found it while it is younger than this. */
export const WHERE_LIVE_FIX_MS = 15_000

/** A dot on the sheet's map: the box itself, and the other live boxes of its place drawn faint around it. */
export type WhereMapPin = { id: string; label: string; lat: number; lng: number; tone: 'target' | 'target-old' | 'dim' }

export function whereMapPins(box: WhereBox, containers: ReadonlyArray<Container>, now: Date): WhereMapPin[] {
  const out: WhereMapPin[] = []
  for (const c of containers) {
    if (c.id === box.id || c.retiredAt || c.kind === 'unsorted' || !boxIsPinned(c)) continue
    if (c.locationId !== box.locationId) continue
    out.push({ id: c.id, label: c.label, lat: c.lat, lng: c.lng, tone: 'dim' })
  }
  if (boxIsPinned(box)) out.push({ id: box.id, label: box.label, lat: box.lat, lng: box.lng, tone: boxPinIsOld(box, now) ? 'target-old' : 'target' })
  return out
}

/** What the New task window opens with when a box's sheet sends someone to it (punch list #372, step 5). */
export type FindBoxTask = { title: string; links: string[]; place?: TaskPlaceDraft }

/**
 * Send someone to it: a task, *Find A7*, with the box's pin as the task's place and the way to the box's place as the
 * place's map. The person given the task reads the place and the map through the task, so they need not be on the
 * job's crew: a task may point at a map its giver can open (v2.7340), and the giver reads the box's job. A box nobody
 * pinned still makes a task, with its words and no dot.
 */
export function findBoxTask(input: { box: WhereBox; places: ReadonlyArray<Place>; /** The way to the box's place, when it has one the giver can name. */ way?: { id: string; name: string } | null }): FindBoxTask {
  const { box, places, way } = input
  const place = places.find((p) => p.id === box.locationId)?.name ?? null
  const where = box.where.trim().replace(/[.\s]+$/, '')
  const title = place ? `Find ${box.label} at ${place}${where ? `, ${where}` : ''}` : where ? `Find ${box.label}, ${where}` : `Find ${box.label}`
  if (!boxIsPinned(box)) return { title, links: [] }
  return {
    title,
    links: [],
    place: {
      lat: box.lat,
      lng: box.lng,
      name: cleanTaskPlaceName(place ? `${box.label} at ${place}` : box.label),
      accuracyM: typeof box.pinAccuracyM === 'number' ? box.pinAccuracyM : null,
      ...(way ? { mapId: way.id, mapName: way.name } : {}),
    },
  }
}
