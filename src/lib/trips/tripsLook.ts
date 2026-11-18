/**
 * The Trips look's figures and words (punch list #379, PR 3). One model from the kept trips, the site's
 * hours and today, so the band, the bar, the year strip, a row and an open trip are counted from the same
 * days and cannot disagree. The band answers the owner's question first: of all the hours on this site,
 * how many were at the site.
 *
 * Pure. The rules are `tripDays.ts` and `tripHours.ts`; this file only lays them out.
 */
import { daysBetween, sortTrips, tripDayCounts, tripDayList, tripSpan, tripStanding, TRIP_STANDING_LABEL, type Trip, type TripDayCounts, type TripDayKind, type TripStanding } from './tripDays'
import { splitTripHours, type SiteTripHours, type TripHourRow, type TripHours, type TripHoursOfTrip } from './tripHours'
import { NO_TRIP_PEOPLE, tripOfRecord, tripPersonKey, TRIP_BILLING_LABEL, type TripBilling, type TripPeopleIndex, type TripRecord } from './tripRecord'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

const yearOf = (ymd: string): number => Number(ymd.slice(0, 4))
const monthOf = (ymd: string): number => Number(ymd.slice(5, 7))
const dayOf = (ymd: string): number => Number(ymd.slice(8, 10))

/** *Oct 23*. */
export function monthDay(ymd: string): string {
  return `${MONTHS[monthOf(ymd) - 1] ?? ''} ${dayOf(ymd)}`
}

/**
 * A trip's days in words: *Dec 1 to 5* inside a month, *Oct 23 to Nov 4* across one, *Dec 1* for one day.
 * The year is said when the trip is not in this year, or runs across a year end.
 */
export function tripSpanWords(first: string, last: string, todayYmd: string): string {
  const sameYear = yearOf(first) === yearOf(last)
  if (!sameYear) return `${monthDay(first)}, ${yearOf(first)} to ${monthDay(last)}, ${yearOf(last)}`
  const year = yearOf(last) === yearOf(todayYmd) ? '' : `, ${yearOf(last)}`
  if (first === last) return `${monthDay(first)}${year}`
  if (monthOf(first) === monthOf(last)) return `${monthDay(first)} to ${dayOf(last)}${year}`
  return `${monthDay(first)} to ${monthDay(last)}${year}`
}

export const daysWords = (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`

/** Hours for the eye: whole above a hundred, one place below, no trailing zero. */
export function hoursWords(hours: number): string {
  const n = Math.abs(hours) >= 100 ? Math.round(hours) : Math.round(hours * 10) / 10
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

/** *Luis and Priya*, *Dana, Luis and Omar*. */
export function namesWords(names: ReadonlyArray<string>): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Who asked, after *asked by*: *us*, the name they gave, or *them* when nobody wrote a name. Null while nobody has said. */
export function askedByWords(t: Pick<TripRecord, 'askedBy' | 'askedWho'>): string | null {
  if (t.askedBy === 'us') return 'us'
  if (t.askedBy === 'them') return t.askedWho.trim() || 'them'
  return null
}

export type TripsFilter = 'all' | 'them' | 'extra'

export const TRIPS_FILTERS: ReadonlyArray<{ key: TripsFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'them', label: 'Asked by them' },
  { key: 'extra', label: 'Extra' },
]

export type TripLookPerson = {
  personKey: string
  name: string
  /** One cell for each day of the trip's span, null where this person was off. */
  days: Array<{ ymd: string; kind: TripDayKind | null }>
  hours: TripHours | null
}

export type TripLookRow = {
  id: string
  record: TripRecord
  trip: Trip
  standing: TripStanding
  span: { first: string; last: string } | null
  /** *Oct 23 to Nov 4*. */
  when: string
  /** *Back · 8 days at the site*, or *Planned*. */
  standingWords: string
  /** What for, or a plain stand-in when nobody wrote it. */
  why: string
  /** *Luis, Priya · asked by us*. */
  who: string
  days: Array<{ ymd: string; kind: TripDayKind | null }>
  dayCounts: TripDayCounts
  /** Null while the site's hours are not known. A planned trip has zeros. */
  hours: TripHoursOfTrip | null
  people: TripLookPerson[]
  billing: TripBilling | null
  billingLabel: string | null
}

export type TripsBand = {
  /** Trips that have gone out: out now or back. */
  gone: number
  planned: number
  /** Days at the site over the trips that have gone out, each day once a trip. */
  siteDays: number
  /** The site's hours in the five figures; null while they are not known. */
  hours: SiteTripHours | null
}

export type TripsLookModel = {
  /** Newest first. */
  rows: TripLookRow[]
  band: TripsBand
  counts: Record<TripsFilter, number>
  /** Hours on the site's jobs outside every trip, by person and job, most first. */
  home: Array<{ personKey: string; jobId: string | null; hours: number }>
}

export function buildTripsLook(args: { records: ReadonlyArray<TripRecord>; index: TripPeopleIndex; hours: ReadonlyArray<TripHourRow> | null; todayYmd: string }): TripsLookModel {
  const trips = sortTrips(args.records.map((r) => tripOfRecord(r, args.index)))
  const recordById = new Map(args.records.map((r) => [r.id, r]))
  const split = args.hours ? splitTripHours({ trips, rows: args.hours }) : null
  const rows: TripLookRow[] = []
  let gone = 0
  let planned = 0
  let siteDays = 0
  for (const trip of trips) {
    const record = recordById.get(trip.id)
    if (!record) continue
    const span = tripSpan(trip)
    const standing = tripStanding(trip, args.todayYmd)
    const dayCounts = tripDayCounts(trip)
    const days = tripDayList(trip)
    const hours = split?.byTrip.get(trip.id) ?? null
    if (standing === 'planned') planned += 1
    else {
      gone += 1
      siteDays += dayCounts.site
    }
    const asked = askedByWords(record)
    const names = record.people.map((p) => p.name)
    rows.push({
      id: trip.id,
      record,
      trip,
      standing,
      span,
      when: span ? tripSpanWords(span.first, span.last, args.todayYmd) : 'No day yet',
      standingWords: standing === 'planned' ? TRIP_STANDING_LABEL.planned : `${TRIP_STANDING_LABEL[standing]} · ${daysWords(dayCounts.site)} at the site`,
      why: record.purpose.trim() || 'A trip',
      who: [names.join(', '), asked ? `asked by ${asked}` : null].filter(Boolean).join(' · '),
      days,
      dayCounts,
      hours,
      people: record.people.map((p) => {
        const personKey = tripPersonKey(args.index, p)
        return { personKey, name: p.name, days: days.map((d) => ({ ymd: d.ymd, kind: p.days[d.ymd] ?? null })), hours: hours ? (hours.byPerson.get(personKey) ?? { site: 0, road: 0, ready: 0, noPlace: 0, all: 0 }) : null }
      }),
      billing: record.billing,
      billingLabel: record.billing ? (record.billing === 'ours' ? 'Ours · no bill' : TRIP_BILLING_LABEL[record.billing]) : null,
    })
  }
  rows.reverse()
  return {
    rows,
    band: { gone, planned, siteDays, hours: split ? split.site : null },
    counts: { all: rows.length, them: rows.filter((r) => r.record.askedBy === 'them').length, extra: rows.filter((r) => r.billing === 'extra').length },
    home: split ? split.home : [],
  }
}

export function filterTripRows(rows: ReadonlyArray<TripLookRow>, filter: TripsFilter): TripLookRow[] {
  if (filter === 'them') return rows.filter((r) => r.record.askedBy === 'them')
  if (filter === 'extra') return rows.filter((r) => r.billing === 'extra')
  return [...rows]
}

/** The look's one line on the strip and when folded: *5 trips*, and in amber *1 out now* while a trip is out. */
function lookWords(n: number, out: number): { n: number; count: string; need: string | null } {
  if (n === 0) return { n: 0, count: 'none yet', need: null }
  return { n, count: `${n} ${n === 1 ? 'trip' : 'trips'}`, need: out > 0 ? `${out} out now` : null }
}

export function tripsLookWords(model: TripsLookModel): { n: number; count: string; need: string | null } {
  return lookWords(model.rows.length, model.rows.filter((r) => r.standing === 'out').length)
}

/** The same line from the kept trips alone, for the strip, which needs no hours. */
export function tripsStripWords(records: ReadonlyArray<TripRecord>, todayYmd: string): { n: number; count: string; need: string | null } {
  return lookWords(records.length, records.filter((r) => tripStanding(tripOfRecord(r, NO_TRIP_PEOPLE), todayYmd) === 'out').length)
}

/** The share of the hours at the site, as *43%*; null with no hours. */
export function atSitePercentWords(h: Pick<SiteTripHours, 'site' | 'all'>): string | null {
  return h.all > 0 ? `${Math.round((h.site / h.all) * 100)}%` : null
}

// ---- the year strip ---------------------------------------------------------------------------

export type TripStripBar = {
  id: string
  /** Where the bar starts and how wide it is, as shares of the year (0 to 100). */
  leftPct: number
  widthPct: number
  /** The trip's days inside the year, in order, for the bar's own colours. */
  kinds: Array<TripDayKind | null>
  planned: boolean
  label: string
}

export type TripStrip = {
  year: number
  /** The years any trip touches, and this year, in order: the strip's own steps. */
  years: number[]
  months: ReadonlyArray<string>
  bars: TripStripBar[]
  /** Where today falls in the year shown, 0 to 100; null in another year. */
  todayPct: number | null
}

const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

export function buildTripStrip(rows: ReadonlyArray<TripLookRow>, year: number, todayYmd: string): TripStrip {
  const jan1 = `${year}-01-01`
  const dec31 = `${year}-12-31`
  const yearDays = isLeap(year) ? 366 : 365
  const pct = (ymd: string): number => (daysBetween(jan1, ymd) / yearDays) * 100
  const years = new Set<number>([yearOf(todayYmd)])
  const bars: TripStripBar[] = []
  for (const r of rows) {
    if (!r.span) continue
    for (let y = yearOf(r.span.first); y <= yearOf(r.span.last); y += 1) years.add(y)
    if (r.span.last < jan1 || r.span.first > dec31) continue
    const inYear = r.days.filter((d) => d.ymd >= jan1 && d.ymd <= dec31)
    const first = inYear[0]?.ymd
    if (!first) continue
    bars.push({ id: r.id, leftPct: pct(first), widthPct: (inYear.length / yearDays) * 100, kinds: inYear.map((d) => d.kind), planned: r.standing === 'planned', label: monthDay(first) })
  }
  bars.sort((a, b) => a.leftPct - b.leftPct)
  return { year, years: [...years].sort((a, b) => a - b), months: MONTHS, bars, todayPct: yearOf(todayYmd) === year ? pct(todayYmd) : null }
}

/** The year the strip opens on: this year when a trip touches it, else the year of the newest trip. */
export function tripStripStartYear(rows: ReadonlyArray<TripLookRow>, todayYmd: string): number {
  const thisYear = yearOf(todayYmd)
  const spans = rows.map((r) => r.span).filter((s): s is { first: string; last: string } => !!s)
  if (spans.length === 0 || spans.some((s) => yearOf(s.first) <= thisYear && yearOf(s.last) >= thisYear)) return thisYear
  return Math.max(...spans.map((s) => yearOf(s.last)))
}
