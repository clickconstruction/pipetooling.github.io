/**
 * Split a trip in two (v2.7891, punch list #379): the rules and the words behind **Split in two** on an open trip.
 *
 * A trip is one going out and coming back. A trip that grew on the phone a day at a time, or one typed from memory,
 * can turn out to be two: the crew went home in the middle. The split cuts the trip at a day. The trip keeps its
 * number and every day before that day. A new trip takes that day and every day after it. Each person goes where
 * their days are, and somebody with days on both sides is on both.
 *
 * The write is the database's (`trip_split`, migration 20261119010000), in one call. This file draws what it will
 * do before the press: the days the second trip may start on, the day to offer first, both halves in words, and
 * what the toast says after. Pure.
 */
import { daysBetween } from './tripDays'
import { tripNumberOf, type TripRecord } from './tripRecord'
import { daysWords, monthDay, tripNameOfRecord, tripNumberWords, tripRecordSpan, tripSpanWords } from './tripsLook'

export const TRIP_SPLIT_LABEL = 'Split in two'
export const TRIP_SPLIT_PRESS_TITLE = 'This trip was really two. Cut it at a day into two trips.'
export const TRIP_SPLIT_CONFIRM_LABEL = 'Split into two trips'
export const TRIP_SPLIT_BUSY_LABEL = 'Splitting the trip…'
export const TRIP_SPLIT_PICK_CAP = 'The second trip starts on'
export const TRIP_SPLIT_PICK_FIRST = 'Pick the day the second trip starts.'
export const TRIP_SPLIT_KEEPS_NOTE = 'Both trips keep what it was for, who asked, how it went and the jobs. No clock row, bill or cost changes.'
export const TRIP_SPLIT_NO_UNDO_NOTE = 'A split has no undo. To take one back, delete the new trip and add its days to the first with Change.'
export const TRIP_SPLIT_FAILED_WORDS = 'The trip was not split.'

/** One day of a trip, with everyone on it. */
export type TripSplitDay = {
  ymd: string
  /** Who was on the trip that day, by name, in order. */
  names: string[]
  /** Days since the trip's day before this one: 1 for the next day, 3 after two days at home. 0 on the first day. */
  gap: number
}

/** The trip's days, each once, in order. */
export function tripSplitDays(record: Pick<TripRecord, 'people'>): TripSplitDay[] {
  const who = new Map<string, string[]>()
  for (const p of record.people) {
    for (const ymd of Object.keys(p.days)) {
      const names = who.get(ymd)
      if (names) names.push(p.name)
      else who.set(ymd, [p.name])
    }
  }
  const days = [...who.keys()].sort()
  return days.map((ymd, i) => ({ ymd, names: [...(who.get(ymd) ?? [])].sort((a, b) => a.localeCompare(b)), gap: i === 0 ? 0 : daysBetween(days[i - 1]!, ymd) }))
}

/** A trip can be split when it has two days or more. */
export function canSplitTrip(record: Pick<TripRecord, 'people'>): boolean {
  return tripSplitDays(record).length >= 2
}

/** The days the second trip may start on: every day of the trip but its first. */
export function tripSplitChoices(record: Pick<TripRecord, 'people'>): TripSplitDay[] {
  return tripSplitDays(record).slice(1)
}

/**
 * The day to offer first: the one after the longest stretch at home, when the trip has a stretch at home at all.
 * Two stretches of one length offer the earlier. A trip with no day at home in the middle offers none: the person
 * says where it was two.
 */
export function tripSplitSuggested(record: Pick<TripRecord, 'people'>): string | null {
  let best: TripSplitDay | null = null
  for (const d of tripSplitChoices(record)) if (d.gap > 1 && (!best || d.gap > best.gap)) best = d
  return best?.ymd ?? null
}

/**
 * The two trips a split at this day makes, as the database will: the first keeps the trip's id and number, the
 * second is new. A trip on a bill keeps its line, so the second then starts with no billing said. Null when the
 * day would leave a half empty.
 */
export function splitTripAt(record: TripRecord, ymd: string, opts: { onBill?: boolean } = {}): { first: TripRecord; second: TripRecord } | null {
  const part = (keep: (day: string) => boolean) =>
    record.people
      .map((p) => ({ ...p, days: Object.fromEntries(Object.entries(p.days).filter(([day]) => keep(day))) }))
      .filter((p) => Object.keys(p.days).length > 0)
  const before = part((day) => day < ymd)
  const after = part((day) => day >= ymd)
  if (before.length === 0 || after.length === 0) return null
  return {
    first: { ...record, people: before },
    second: { ...record, id: '', tripNumber: null, via: 'app', createdAt: null, billing: opts.onBill ? null : record.billing, people: after, jobIds: [...record.jobIds] },
  }
}

/** One half, in words for the window. */
export type TripSplitHalf = { name: string; who: string; days: string }

function halfWords(name: string, record: Pick<TripRecord, 'people'>): TripSplitHalf {
  return { name, who: record.people.map((p) => p.name).sort((a, b) => a.localeCompare(b)).join(', '), days: daysWords(tripSplitDays(record).length) }
}

/** Both halves of a split at this day, in words: *Trip 3 · Nov 9 to 11* and *A new trip · Nov 14 to 16*. */
export function tripSplitHalves(record: TripRecord, ymd: string, todayYmd: string): { first: TripSplitHalf; second: TripSplitHalf } | null {
  const halves = splitTripAt(record, ymd)
  if (!halves) return null
  const span = tripRecordSpan(halves.second)
  return {
    first: halfWords(tripNameOfRecord(halves.first, todayYmd).full, halves.first),
    second: halfWords(`A new trip${span ? ` · ${tripSpanWords(span.first, span.last, todayYmd)}` : ''}`, halves.second),
  }
}

/** A choice in words: the day, who was on it, and the days at home before it when there were any. */
export function tripSplitChoiceWords(day: TripSplitDay): { day: string; who: string; home: string | null } {
  return { day: monthDay(day.ymd), who: day.names.join(', '), home: day.gap > 1 ? `after ${daysWords(day.gap - 1)} at home` : null }
}

/** The window's title: *Split Trip 3 in two*, and *Split this trip in two* for a trip with no number. */
export function tripSplitTitle(record: Pick<TripRecord, 'tripNumber'>): string {
  return `Split ${tripNumberWords(record.tripNumber) ?? 'this trip'} in two`
}

/** What the window says of a trip on a bill; null for one that is not. */
export function tripSplitBillNote(record: Pick<TripRecord, 'tripNumber'>, onBill: boolean): string | null {
  if (!onBill) return null
  const name = tripNumberWords(record.tripNumber) ?? 'This trip'
  return `${name} is on a bill. Its line stays with ${name === 'This trip' ? 'it' : name}, and the new trip starts with no billing said.`
}

/** What `trip_split` answers after a split. */
export type TripSplitReply = { tripId: string; tripNumber: number | null; newTripId: string; newTripNumber: number | null }

/** Read the function's reply. Null for anything that is not a split that happened. */
export function parseTripSplitReply(raw: unknown): TripSplitReply | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (r.did !== 'split' || typeof r.trip_id !== 'string' || !r.trip_id || typeof r.new_trip_id !== 'string' || !r.new_trip_id) return null
  return { tripId: r.trip_id, tripNumber: tripNumberOf(r.trip_number), newTripId: r.new_trip_id, newTripNumber: tripNumberOf(r.new_trip_number) }
}

/** The toast after a split: *Split. Trip 3 is Nov 9 to 11, and Trip 8 is Nov 14 to 16.* */
export function tripSplitDoneWords(record: TripRecord, ymd: string, reply: Pick<TripSplitReply, 'newTripNumber'> | null, todayYmd: string): string {
  const halves = splitTripAt(record, ymd)
  if (!halves) return 'Split in two.'
  const first = tripRecordSpan(halves.first)
  const second = tripRecordSpan(halves.second)
  if (!first || !second) return 'Split in two.'
  const a = tripNumberWords(record.tripNumber) ?? 'The first trip'
  const b = tripNumberWords(reply?.newTripNumber) ?? 'the new trip'
  return `Split. ${a} is ${tripSpanWords(first.first, first.last, todayYmd)}, and ${b} is ${tripSpanWords(second.first, second.last, todayYmd)}.`
}
