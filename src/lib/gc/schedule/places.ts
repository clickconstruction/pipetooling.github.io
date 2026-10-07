/**
 * GC mode, the real build, the schedule's PR 1a: where the work is (G-83), moved word for word from the
 * GC mode prototype (branch spike/gc-mode, `gcPlaces.ts`). A bar's place and its guess, the places
 * kept, and too many trades in one place after a move. The crowded weeks read crew counts and people
 * on site (G-84), so they and what reads them stay in the prototype until the schedule's PR 1b:
 * `crowdedWeeks`, `crowdedPlaces`, `crowdedSpells`, `placesSummary`, `crowdedCalls` and
 * `morningCrowding`.
 */
import { addDays } from '../building'
import { lineStage } from './draft'
import { activityName, scheduleItems, scheduleLinesOf } from './schedule'
import type { ScheduleActivity } from './types'
import type { GcProject, GcState } from '../types'
import { weekdayDate } from '../words'

/** Our rule (G-83): this many trades or more in one place on the same day is too many. The owner can change it. */
export const TRADES_IN_ONE_PLACE = 3

/** The longest place the office can keep. */
export const PLACE_MAX = 40

/** The rule as the surface says it, wherever the flag is. */
export const PLACE_RULE = `Our rule: ${TRADES_IN_ONE_PLACE} trades or more in one place on the same day is too many.`

// ---------------------------------------------------------------------------------------------
// Where a place comes from
// ---------------------------------------------------------------------------------------------

/** Where a guess came from: the bar's name, its trade or its stage. */
export type PlaceFrom = 'name' | 'trade' | 'stage'

export interface PlaceGuess {
  place: string
  from: PlaceFrom
}

/** A numbered or lettered part of the job in a line's name: "Framing, level 2" is Level 2, "Suite 101 ceilings" is Suite 101. */
const AREA = /\b(level|floor|suite|unit|building|area|zone|wing|phase)\s+(\d+[a-z]?|[a-z])\b/i

/** Words in a line's name that say where its work is, the most telling first ("interior storefront" is inside). Each matches the start of a word. */
const PLACE_WORDS: [string, string[]][] = [
  ['Inside', ['interior', 'inside']],
  ['Outside walls', ['exterior']],
  ['Roof', ['rooftop', 'roof', 'membrane', 'flashing', 'coping']],
  ['Site', ['site', 'paving', 'parking', 'sidewalk', 'striping', 'landscap', 'irrigation', 'utilities', 'clearing', 'grading', 'drive-through', 'planting']],
  ['Outside walls', ['storefront', 'facade', 'stucco', 'siding']],
]

/** The place a trade's work is in when a line's name does not say. */
const TRADE_PLACE: Record<string, string> = {
  Roofing: 'Roof',
  Sitework: 'Site',
  Landscaping: 'Site',
  'Glass and storefront': 'Outside walls',
}

/** The place a stage of the job is in. Foundations, underground, the slab, the frame and dry-in are the whole building at once: no guess. */
const STAGE_PLACE: Record<string, string> = {
  sitePrep: 'Site',
  siteFinish: 'Site',
  framing: 'Inside',
  roughIn: 'Inside',
  closeIn: 'Inside',
  finishes: 'Inside',
  trim: 'Inside',
  closeout: 'Inside',
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** A guess at a line's place: from its name, then its trade, then its stage. Null: none can be made. */
export function placeGuess(trade: string, label: string): PlaceGuess | null {
  const area = AREA.exec(label)
  if (area) return { place: `${cap((area[1] ?? '').toLowerCase())} ${(area[2] ?? '').toUpperCase()}`, from: 'name' }
  const name = label.toLowerCase()
  for (const [place, words] of PLACE_WORDS) if (words.some((w) => new RegExp(`\\b${w}`).test(name))) return { place, from: 'name' }
  const byTrade = TRADE_PLACE[trade]
  if (byTrade) return { place: byTrade, from: 'trade' }
  const byStage = STAGE_PLACE[lineStage(trade, label)]
  return byStage ? { place: byStage, from: 'stage' } : null
}

/** A place as it is kept: trimmed, one space between words. Empty: none. */
export function cleanPlace(place: string): string {
  return place.trim().replace(/\s+/g, ' ')
}

/** What is wrong with a place, in the office's words. Null: it can be kept. */
export function placeProblem(place: string): string | null {
  return cleanPlace(place).length > PLACE_MAX ? `A place is ${PLACE_MAX} characters at most.` : null
}

/** A bar that takes a place: a trade's line or our own crew's. An inspection and the job's own bar do not. */
export function takesPlace(a: ScheduleActivity): boolean {
  return a.packageId !== '' && !a.inspection && !a.added
}

/** The places the office kept, by line id. */
export function keptPlaces(project: GcProject): Map<string, string> {
  const out = new Map<string, string>()
  for (const a of project.schedule?.activities ?? []) if (a.place && takesPlace(a)) out.set(a.lineId, a.place)
  return out
}

/** One bar in the places window: its place, or its guess while it has none. */
export interface PlaceRow {
  lineId: string
  /** "Roofing · TPO membrane". */
  name: string
  /** "Summit Roofing", or "Our own crew". */
  company: string
  /** The place the office kept. Null: none yet. */
  kept: string | null
  /** The guess, while no place is kept. */
  guess: PlaceGuess | null
}

/** Every bar not done that takes a place, in the chart's order. */
export function placeRows(state: GcState, project: GcProject): PlaceRow[] {
  return scheduleItems(state, project).flatMap((it) => {
    const a = it.activity
    if (!it.pkg || !takesPlace(a) || it.actual >= 100) return []
    const kept = a.place ?? null
    return [{ lineId: a.lineId, name: activityName(it), company: it.company, kept, guess: kept ? null : placeGuess(it.trade, it.label) }]
  })
}

// ---------------------------------------------------------------------------------------------
// The action's work
// ---------------------------------------------------------------------------------------------

export interface PlaceChange {
  lineId: string
  /** Null: the place comes off. */
  place: string | null
}

/**
 * What `setActivityPlaces` would change. Null when any of it is refused: a line the schedule does
 * not have, an inspection, the job's own bar, a place over PLACE_MAX. A place already there is no change.
 */
export function placeChanges(activities: ScheduleActivity[], places: Record<string, string | null>): PlaceChange[] | null {
  const byId = new Map(activities.map((a) => [a.lineId, a]))
  const out: PlaceChange[] = []
  for (const [lineId, raw] of Object.entries(places)) {
    const a = byId.get(lineId)
    if (!a || !takesPlace(a)) return null
    const place = cleanPlace(raw ?? '')
    if (place.length > PLACE_MAX) return null
    const next = place === '' ? null : place
    if ((a.place ?? null) !== next) out.push({ lineId, place: next })
  }
  return out
}

/** The activities with the changes made: a place set, or the field gone when it comes off. */
export function withPlaces(activities: ScheduleActivity[], changes: PlaceChange[]): ScheduleActivity[] {
  const by = new Map(changes.map((c) => [c.lineId, c.place]))
  return activities.map((a) => {
    if (!by.has(a.lineId)) return a
    const place = by.get(a.lineId) ?? null
    const { place: _was, ...rest } = a
    return place ? { ...rest, place } : rest
  })
}

/** The log's line: "Set the place of TPO membrane to Roof." or "Set places on 13 bars at Fair Oaks Shops, Building D." */
export function placesLogWords(project: GcProject, changes: PlaceChange[]): string {
  const labels = new Map(project.packages.flatMap((k) => scheduleLinesOf(k).map((l) => [l.lineId, l.label] as const)))
  const set = changes.filter((c) => c.place !== null)
  const off = changes.filter((c) => c.place === null)
  const bars = (n: number) => `${n} ${n === 1 ? 'bar' : 'bars'}`
  const one = changes.length === 1 ? changes[0] : undefined
  if (one) {
    const label = labels.get(one.lineId) ?? 'a bar'
    return one.place ? `Set the place of ${label} to ${one.place}.` : `Took the place off ${label}.`
  }
  if (off.length === 0) return `Set places on ${bars(set.length)} at ${project.name}.`
  if (set.length === 0) return `Took the place off ${bars(off.length)} at ${project.name}.`
  return `Set places on ${bars(set.length)} at ${project.name} and took ${off.length} off.`
}

/** "Mon Oct 5 to Fri Oct 9", or one day: "Fri Oct 2". */
function spanWords(from: string, to: string): string {
  return from === to ? weekdayDate(from) : `${weekdayDate(from)} to ${weekdayDate(to)}`
}

/** "3 trades", or "up to 4 trades" when the days it covers do not all have that many. */
function tradesWords(most: number, even: boolean): string {
  return `${even ? '' : 'up to '}${most} trades`
}

/** Each place's crowded days from today on: the trades there that day, each with its first bar there. */
function crowdedDays(state: GcState, project: GcProject): Map<string, { day: string; trades: Map<string, string> }[]> {
  const out = new Map<string, { day: string; trades: Map<string, string> }[]>()
  const places = keptPlaces(project)
  if (places.size === 0) return out
  // A trade is in a place on a day by the plan's own dates, as G-84 counts people: a late bar does not fill every week ahead.
  const items = scheduleItems(state, project).filter((it) => it.pkg && takesPlace(it.activity) && it.actual < 100 && places.has(it.activity.lineId))
  const last = items.reduce((m, it) => (it.activity.finish > m ? it.activity.finish : m), '')
  for (let day = state.today; day <= last; day = addDays(day, 1)) {
    const here = new Map<string, Map<string, string>>()
    for (const it of items) {
      const a = it.activity
      const place = places.get(a.lineId)
      if (!place || !it.pkg || a.start > day || day > a.finish) continue
      const trades = here.get(place) ?? new Map<string, string>()
      if (!trades.has(it.pkg.id)) trades.set(it.pkg.id, a.lineId)
      here.set(place, trades)
    }
    for (const [place, trades] of here) {
      if (trades.size < TRADES_IN_ONE_PLACE) continue
      out.set(place, [...(out.get(place) ?? []), { day, trades }])
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Before a move saves, the morning list, the call list
// ---------------------------------------------------------------------------------------------

/** A line in the move window: amber when the move crowds a place, green when it clears one. */
export interface CrowdingChange {
  words: string
  tone: 'amber' | 'green'
}

/** What a move would do to the places with too many (G-83), said before it saves. `activities` are the schedule's as the move would leave them. Empty: nothing changes. */
export function crowdingAfterMove(state: GcState, project: GcProject, activities: ScheduleActivity[]): CrowdingChange[] {
  const schedule = project.schedule
  if (!schedule) return []
  const before = crowdedDays(state, project)
  if (keptPlaces(project).size === 0) return []
  const after = crowdedDays(state, { ...project, schedule: { ...schedule, activities } })
  const out: CrowdingChange[] = []
  for (const place of [...new Set([...before.keys(), ...after.keys()])]) {
    const was = new Map((before.get(place) ?? []).map((d) => [d.day, d.trades.size]))
    const now = new Map((after.get(place) ?? []).map((d) => [d.day, d.trades.size]))
    const added = [...now.keys()].filter((d) => !was.has(d)).sort()
    const cleared = [...was.keys()].filter((d) => !now.has(d)).sort()
    const firstAdded = added[0]
    const lastAdded = added[added.length - 1]
    if (firstAdded && lastAdded) {
      const most = Math.max(...added.map((d) => now.get(d) ?? 0))
      const even = added.every((d) => now.get(d) === most)
      out.push({ words: `Too many in one place: ${place} would have ${tradesWords(most, even)} at once${firstAdded === lastAdded ? ' on' : ','} ${spanWords(firstAdded, lastAdded)}.`, tone: 'amber' })
    }
    const firstCleared = cleared[0]
    const lastCleared = cleared[cleared.length - 1]
    if (firstCleared && lastCleared) out.push({ words: `Too many in one place: this clears ${place}${firstCleared === lastCleared ? ' on' : ','} ${spanWords(firstCleared, lastCleared)}.`, tone: 'green' })
  }
  return out
}
