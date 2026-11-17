/**
 * The three-question sheet's own state (punch list #379, PR 3): who went, which days, what for. The days
 * are painted, not typed. Picking a first and a last day paints every day At the site, and a tap turns one
 * day's kind. Everyone on the trip shares those days until somebody is given days of their own, which is
 * how one person joins late or drives home early.
 *
 * Pure moves over one state, so the sheet only draws and calls them. A sheet opened on a kept trip reads
 * the days most of its people share as the trip's days, and leaves the rest as each person's own.
 */
import { addDays, daysBetween, daysInRange, nextDayKind, tripStanding, withDay, type TripDayKind, type TripDays, type TripStanding } from './tripDays'
import { tripProblem, type TripAskedBy, type TripBilling, type TripRecord, type TripRecordPerson, type TripRosterPerson } from './tripRecord'

/** The longest run of days one trip paints. Past it the trip is two trips. */
export const TRIP_SHEET_MAX_DAYS = 120

export type TripSheetPerson = {
  personId: string | null
  userId: string | null
  name: string
  /** This person's own days, when they are not the trip's; null while they share the trip's days. */
  own: TripDays | null
}

export type TripSheetState = {
  people: TripSheetPerson[]
  first: string
  last: string
  /** The days everyone shares, inside first to last. A day tapped off is not here. */
  shared: TripDays
  purpose: string
  askedBy: TripAskedBy | null
  askedWho: string
  askedHow: string
  outcome: string
  billing: TripBilling | null
  jobIds: string[]
}

const daysKey = (days: TripDays): string =>
  Object.keys(days)
    .sort()
    .map((d) => `${d}:${days[d]}`)
    .join(',')

/** The sheet for a kept trip, or for a new one (nobody on it, today painted At the site). */
export function sheetFromRecord(record: TripRecord, todayYmd: string): TripSheetState {
  // The days most people share are the trip's; on a tie the first person's.
  const counts = new Map<string, { n: number; days: TripDays }>()
  for (const p of record.people) {
    const key = daysKey(p.days)
    const hit = counts.get(key)
    if (hit) hit.n += 1
    else counts.set(key, { n: 1, days: p.days })
  }
  let shared: TripDays | null = null
  let best = 0
  for (const c of counts.values())
    if (c.n > best) {
      best = c.n
      shared = c.days
    }
  const all = record.people.flatMap((p) => Object.keys(p.days)).sort()
  const first = all[0] ?? todayYmd
  const last = all[all.length - 1] ?? todayYmd
  const sharedDays: TripDays = shared ?? { [todayYmd]: 'site' }
  const sharedKey = daysKey(sharedDays)
  return {
    people: record.people.map((p) => ({ personId: p.personId, userId: p.userId, name: p.name, own: daysKey(p.days) === sharedKey ? null : p.days })),
    first,
    last,
    shared: sharedDays,
    purpose: record.purpose,
    askedBy: record.askedBy,
    askedWho: record.askedWho,
    askedHow: record.askedHow,
    outcome: record.outcome,
    billing: record.billing,
    jobIds: [...record.jobIds],
  }
}

/** Every day of the sheet's range with the trip's kind that day, for the painted row. */
export function sheetDays(state: Pick<TripSheetState, 'first' | 'last' | 'shared'>): Array<{ ymd: string; kind: TripDayKind | null }> {
  return daysInRange(state.first, state.last).map((ymd) => ({ ymd, kind: state.shared[ymd] ?? null }))
}

/** One person's days over the same range: their own when they have them, else the trip's. */
export function sheetPersonDays(state: Pick<TripSheetState, 'first' | 'last' | 'shared'>, person: TripSheetPerson): Array<{ ymd: string; kind: TripDayKind | null }> {
  const days = person.own ?? state.shared
  return daysInRange(state.first, state.last).map((ymd) => ({ ymd, kind: days[ymd] ?? null }))
}

function clip(days: TripDays, first: string, last: string): TripDays {
  const out: Record<string, TripDayKind> = {}
  for (const [ymd, kind] of Object.entries(days)) if (ymd >= first && ymd <= last) out[ymd] = kind
  return out
}

/**
 * Pick the first and the last day. A day that comes into the range starts as At the site; a day that
 * leaves it is dropped, from the trip's days and from anybody's own. A last day before the first follows
 * the first, and a range past the cap stops at the cap.
 */
export function setSheetRange(state: TripSheetState, first: string, last: string): TripSheetState {
  let end = last < first ? first : last
  if (daysBetween(first, end) + 1 > TRIP_SHEET_MAX_DAYS) end = addDays(first, TRIP_SHEET_MAX_DAYS - 1)
  const shared: Record<string, TripDayKind> = { ...clip(state.shared, first, end) }
  for (const ymd of daysInRange(first, end)) if (ymd < state.first || ymd > state.last) shared[ymd] = 'site'
  return {
    ...state,
    first,
    last: end,
    shared,
    people: state.people.map((p) => {
      if (!p.own) return p
      const own: Record<string, TripDayKind> = { ...clip(p.own, first, end) }
      for (const ymd of daysInRange(first, end)) if (ymd < state.first || ymd > state.last) own[ymd] = 'site'
      return { ...p, own }
    }),
  }
}

/** One tap on one of the trip's days: the site, the road, getting ready, off, and round. */
export function tapSheetDay(state: TripSheetState, ymd: string): TripSheetState {
  return { ...state, shared: withDay(state.shared, ymd, nextDayKind(state.shared[ymd] ?? null)) }
}

/** One tap on one person's day: from then on that person has days of their own. */
export function tapSheetPersonDay(state: TripSheetState, index: number, ymd: string): TripSheetState {
  return {
    ...state,
    people: state.people.map((p, i) => {
      if (i !== index) return p
      const days = p.own ?? state.shared
      return { ...p, own: withDay(days, ymd, nextDayKind(days[ymd] ?? null)) }
    }),
  }
}

/** Give a person the trip's days again. */
export function clearSheetPersonDays(state: TripSheetState, index: number): TripSheetState {
  return { ...state, people: state.people.map((p, i) => (i === index ? { ...p, own: null } : p)) }
}

/** Add a roster person, or someone not in the app by name alone. A name already on the trip is not added twice. */
export function addSheetPerson(state: TripSheetState, who: TripRosterPerson | { name: string }): TripSheetState {
  const name = who.name.trim()
  if (!name || state.people.some((p) => p.name.trim().toLowerCase() === name.toLowerCase())) return state
  const person: TripSheetPerson = 'id' in who ? { personId: who.id, userId: who.userId, name, own: null } : { personId: null, userId: null, name, own: null }
  return { ...state, people: [...state.people, person] }
}

export function removeSheetPerson(state: TripSheetState, index: number): TripSheetState {
  return { ...state, people: state.people.filter((_, i) => i !== index) }
}

/** The roster people not on the trip yet, for the picker. */
export function sheetRosterLeft(state: Pick<TripSheetState, 'people'>, roster: ReadonlyArray<TripRosterPerson>): TripRosterPerson[] {
  const on = new Set(state.people.map((p) => p.personId).filter((id): id is string => !!id))
  const names = new Set(state.people.map((p) => p.name.trim().toLowerCase()))
  return roster.filter((r) => !on.has(r.id) && !names.has(r.name.trim().toLowerCase()))
}

/** The trip the sheet holds, on the record it was opened from: every person with their own days or the trip's. */
export function recordFromSheet(state: TripSheetState, base: TripRecord): TripRecord {
  const people: TripRecordPerson[] = state.people.map((p) => ({ personId: p.personId, userId: p.userId, name: p.name.trim(), days: clip(p.own ?? state.shared, state.first, state.last) }))
  return { ...base, people, purpose: state.purpose, askedBy: state.askedBy, askedWho: state.askedWho, askedHow: state.askedHow, outcome: state.outcome, billing: state.billing, jobIds: [...state.jobIds] }
}

/** Why the sheet cannot save yet, in its own words; null when it can. */
export function sheetProblem(state: TripSheetState, base: TripRecord): string | null {
  return tripProblem(recordFromSheet(state, base))
}

/** Where the trip would stand if saved now, for the foot: *Saves as Planned.* */
export function sheetStanding(state: TripSheetState, base: TripRecord, todayYmd: string): TripStanding {
  const record = recordFromSheet(state, base)
  return tripStanding({ id: record.id, people: record.people.map((p) => ({ personKey: p.name, name: p.name, days: p.days })) }, todayYmd)
}

/** Whether anything under More is filled, so the fold opens by itself on a trip that has it. */
export function sheetHasMore(state: TripSheetState): boolean {
  return state.askedBy != null || state.billing != null || state.jobIds.length > 0 || !!state.outcome.trim()
}
