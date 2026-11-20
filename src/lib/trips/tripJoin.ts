/**
 * Join a trip with the next (v2.7963, punch list #379): the rules and the words behind **Join with the next** on an
 * open trip.
 *
 * A trip is one going out and coming back. Two trips can turn out to be one: the crew pressed End the trip by
 * mistake and started again, or one going out was typed twice. The join makes them one trip. It is also how a split
 * is taken back. The open trip keeps its number and its words, everyone and every day from both trips are on it,
 * and the next trip goes.
 *
 * The write is the database's (`trip_join`, migration 20261119180000), in one call. This file draws what it will do
 * before the press: which trip is the next one, the one trip the two become, what stays and what refuses, and what
 * the toast says after. Pure.
 */
import { TRIP_DAY_LABEL, type TripDayKind } from './tripDays'
import { TRIP_BILLING_LABEL, tripNumberOf, type TripRecord, type TripRecordPerson } from './tripRecord'
import { daysWords, monthDay, tripNameOfRecord, tripNumberWords, tripRecordSpan, tripSpanWords } from './tripsLook'

export const TRIP_JOIN_LABEL = 'Join with the next'
export const TRIP_JOIN_PRESS_TITLE = 'This trip and the next one were really one. Make them one trip.'
export const TRIP_JOIN_CONFIRM_LABEL = 'Join into one trip'
export const TRIP_JOIN_BUSY_LABEL = 'Joining the trips…'
export const TRIP_JOIN_KEEPS_NOTE = 'Everyone and every day from both trips are kept. No clock row, bill or cost changes.'
export const TRIP_JOIN_BACK_NOTE = 'To take a join back, press Split in two on the joined trip.'
export const TRIP_JOIN_FAILED_WORDS = 'The trips were not joined.'

/** Two trips share a home on the same development, or on the same job when the trip has no development. */
function sameHome(a: Pick<TripRecord, 'developmentId' | 'jobId'>, b: Pick<TripRecord, 'developmentId' | 'jobId'>): boolean {
  if (a.developmentId) return a.developmentId === b.developmentId
  return !b.developmentId && !!a.jobId && a.jobId === b.jobId
}

/** The key `sortTrips` orders by: first day, then last day, then id; a trip with no day last. */
function orderKey(t: Pick<TripRecord, 'id' | 'people'>): string {
  const s = tripRecordSpan(t)
  return s ? `${s.first}:${s.last}:${t.id}` : `9999-99-99::${t.id}`
}

/**
 * The trip that went out next on the same home, in the order the Trips look draws. Null for the last trip, and for
 * a trip that is not among the ones handed in. The database decides the same way (`trip_next_id`) and refuses any
 * other pair, so a stale screen cannot join the wrong two.
 */
export function nextTripOf(record: TripRecord, records: ReadonlyArray<TripRecord>): TripRecord | null {
  const home = records.filter((r) => r.id === record.id || sameHome(record, r)).sort((a, b) => orderKey(a).localeCompare(orderKey(b)))
  const at = home.findIndex((r) => r.id === record.id)
  return at >= 0 ? (home[at + 1] ?? null) : null
}

const nameKey = (name: string): string => name.trim().toLowerCase()

/**
 * The one trip the two become, as the database will make it. The open trip keeps its id, its number, its words and
 * where it came from, and takes the next trip's where what it was for, who asked or how it went is empty. People
 * are told apart by name, as the save tells them apart. Each keeps every day from both, and where both give one
 * person the same day the open trip's kind stays. An empty billing takes the other's.
 */
export function joinTrips(record: TripRecord, next: TripRecord): TripRecord {
  const people = new Map<string, TripRecordPerson>()
  for (const p of record.people) people.set(nameKey(p.name), { ...p, days: { ...p.days } })
  for (const p of next.people) {
    const here = people.get(nameKey(p.name))
    if (here) people.set(nameKey(p.name), { ...here, personId: here.personId ?? p.personId, userId: here.userId ?? p.userId, days: { ...p.days, ...here.days } })
    else people.set(nameKey(p.name), { ...p, days: { ...p.days } })
  }
  const asked = record.askedBy ? record : next
  return {
    ...record,
    purpose: record.purpose.trim() ? record.purpose : next.purpose,
    askedBy: asked.askedBy,
    askedWho: asked.askedWho,
    askedHow: asked.askedHow,
    outcome: record.outcome.trim() ? record.outcome : next.outcome,
    billing: record.billing ?? next.billing,
    people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name)),
    jobIds: [...new Set([...record.jobIds, ...next.jobIds])],
  }
}

/** What the two trips hold of a job's lines: a trip holds one line at most. */
export type TripJoinLines = { here: boolean; next: boolean }

/**
 * Why these two cannot be joined as they stand, in the database's own words; null when they can. Two different
 * billings wait for Change. Two lines wait for one to come off its job.
 */
export function tripJoinProblem(record: Pick<TripRecord, 'billing'>, next: Pick<TripRecord, 'billing'>, lines: TripJoinLines): string | null {
  if (record.billing && next.billing && record.billing !== next.billing)
    return `These trips say two different billings: ${TRIP_BILLING_LABEL[record.billing]} and ${TRIP_BILLING_LABEL[next.billing]}. Make them match with Change, then join.`
  if (lines.here && lines.next) return 'Both trips are on a bill, each with its own line. A trip holds one line. Take one line off its job, then join.'
  return null
}

/** A day both trips give one person. The open trip's kind stays. */
export type TripJoinSharedDay = { name: string; ymd: string; kept: TripDayKind; dropped: TripDayKind }

/** Every day both trips give one person, by name then by day. */
export function tripJoinSharedDays(record: Pick<TripRecord, 'people'>, next: Pick<TripRecord, 'people'>): TripJoinSharedDay[] {
  const out: TripJoinSharedDay[] = []
  for (const p of record.people) {
    const other = next.people.find((q) => nameKey(q.name) === nameKey(p.name))
    if (!other) continue
    for (const ymd of Object.keys(other.days).sort()) {
      const kept = p.days[ymd]
      const dropped = other.days[ymd]
      if (kept && dropped) out.push({ name: p.name, ymd, kept, dropped })
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.ymd.localeCompare(b.ymd))
}

/** A shared day in words: *Nov 12 · Dana · stays At the site*, and what the next trip said when it said another kind. */
export function tripJoinSharedDayWords(d: TripJoinSharedDay): { day: string; who: string; stays: string; was: string | null } {
  return { day: monthDay(d.ymd), who: d.name, stays: `stays ${TRIP_DAY_LABEL[d.kept]}`, was: d.kept !== d.dropped ? `the next trip said ${TRIP_DAY_LABEL[d.dropped]}` : null }
}

/** What heads the shared days in the window. */
export function tripJoinSharedCap(record: Pick<TripRecord, 'tripNumber'>): string {
  return `On both trips. ${tripNumberWords(record.tripNumber) ?? 'This trip'}’s kind stays`
}

/** One trip in words for the window. */
export type TripJoinPart = { name: string; who: string; days: string }

function partWords(record: Pick<TripRecord, 'tripNumber' | 'people'>, todayYmd: string): TripJoinPart {
  const days = new Set(record.people.flatMap((p) => Object.keys(p.days)))
  return { name: tripNameOfRecord(record, todayYmd).full, who: record.people.map((p) => p.name).sort((a, b) => a.localeCompare(b)).join(', '), days: daysWords(days.size) }
}

/** Both trips as they stand and the one trip they become, in words: *Trip 7 · Nov 9 to 11*, *Trip 8 · Nov 14 to 15*, *Trip 7 · Nov 9 to 15*. */
export function tripJoinParts(record: TripRecord, next: TripRecord, todayYmd: string): { first: TripJoinPart; second: TripJoinPart; joined: TripJoinPart } {
  return { first: partWords(record, todayYmd), second: partWords(next, todayYmd), joined: partWords(joinTrips(record, next), todayYmd) }
}

/** The window's title: *Join Trip 7 with Trip 8*, and *Join this trip with the next* when a number is missing. */
export function tripJoinTitle(record: Pick<TripRecord, 'tripNumber'>, next: Pick<TripRecord, 'tripNumber'>): string {
  const a = tripNumberWords(record.tripNumber)
  const b = tripNumberWords(next.tripNumber)
  return a && b ? `Join ${a} with ${b}` : 'Join this trip with the next'
}

const listWords = (items: ReadonlyArray<string>): string => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)

/**
 * What the joined trip takes from the next trip, and what goes. Each is one plain sentence for the window; the list
 * is empty of a sentence that has nothing to say.
 */
export function tripJoinNotes(record: TripRecord, next: TripRecord, lines: TripJoinLines): string[] {
  const a = tripNumberWords(record.tripNumber) ?? 'This trip'
  const b = tripNumberWords(next.tripNumber) ?? 'The next trip'
  const out: string[] = []
  const taken: string[] = []
  if (!record.purpose.trim() && next.purpose.trim()) taken.push('what it was for')
  if (!record.askedBy && next.askedBy) taken.push('who asked')
  if (!record.outcome.trim() && next.outcome.trim()) taken.push('how it went')
  out.push(taken.length > 0 ? `${a} keeps its number and its words. It takes ${listWords(taken)} from ${b === 'The next trip' ? 'the next trip' : b}.` : `${a} keeps its number and its words.`)
  if (!record.billing && next.billing) out.push(`The joined trip takes the billing ${b === 'The next trip' ? 'the next trip' : b} said: ${TRIP_BILLING_LABEL[next.billing]}.`)
  if (lines.here && !lines.next) out.push(`${a} is on a bill. Its line stays with it.`)
  if (!lines.here && lines.next) out.push(`${b} is on a bill. Its line moves to the joined trip.`)
  out.push(`${b} goes, and its number is not used again. It waits under Deleted trips, marked as joined.`)
  return out
}

/** What `trip_join` answers after a join. */
export type TripJoinReply = { tripId: string; tripNumber: number | null; goneTripId: string; goneTripNumber: number | null; line: 'none' | 'stays' | 'moves' }

/** Read the function's reply. Null for anything that is not a join that happened. */
export function parseTripJoinReply(raw: unknown): TripJoinReply | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (r.did !== 'join' || typeof r.trip_id !== 'string' || !r.trip_id || typeof r.gone_trip_id !== 'string' || !r.gone_trip_id) return null
  const line = r.line === 'stays' || r.line === 'moves' ? r.line : 'none'
  return { tripId: r.trip_id, tripNumber: tripNumberOf(r.trip_number), goneTripId: r.gone_trip_id, goneTripNumber: tripNumberOf(r.gone_trip_number), line }
}

/** The toast after a join: *Joined. Trip 7 is now Nov 9 to 15, 5 days.* */
export function tripJoinDoneWords(record: TripRecord, next: TripRecord, todayYmd: string): string {
  const joined = joinTrips(record, next)
  const span = tripRecordSpan(joined)
  if (!span) return 'Joined into one trip.'
  const days = new Set(joined.people.flatMap((p) => Object.keys(p.days)))
  return `Joined. ${tripNumberWords(record.tripNumber) ?? 'The trip'} is now ${tripSpanWords(span.first, span.last, todayYmd)}, ${daysWords(days.size)}.`
}
