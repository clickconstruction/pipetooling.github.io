import { describe, expect, it } from 'vitest'
import { addDays, type TripDayKind } from './tripDays'
import type { TripHourRow } from './tripHours'
import { newTripRecord, NO_TRIP_PEOPLE, type TripRecord } from './tripRecord'
import { askedByWords, atSitePercentWords, buildTripStrip, buildTripsLook, daysWords, filterTripRows, hoursWords, monthDay, namesWords, tripSpanWords, tripOffersNeedWords, tripStripStartYear, tripsLookWords, tripsStripWords } from './tripsLook'

// Every name, day and hour here is made up.
const TODAY = '2026-11-17'
function days(first: string, letters: string): Record<string, TripDayKind> {
  const kind: Record<string, TripDayKind> = { g: 'ready', r: 'road', s: 'site' }
  const out: Record<string, TripDayKind> = {}
  ;[...letters].forEach((c, i) => {
    const k = kind[c]
    if (k) out[addDays(first, i)] = k
  })
  return out
}
const trip = (id: string, first: string, people: Array<[string, string]>, over: Partial<TripRecord> = {}): TripRecord => ({ ...newTripRecord({ id, developmentId: 'd1' }), people: people.map(([name, letters]) => ({ personId: null, userId: null, name, days: days(first, letters) })), ...over })
const row = (name: string, ymd: string, hours: number, place: TripHourRow['place'], jobId = 'j1'): TripHourRow => ({ personKey: `n:${name.toLowerCase()}`, ymd, hours, place, jobId })

const firstTry = trip('t1', '2026-02-13', [['Dana', 'grrssrr'], ['Luis', 'xrrssrr']], { purpose: 'Rough-in, first try', askedBy: 'them', askedWho: 'Ray, the site super', billing: 'extra' })
const lifts = trip('t5', '2026-10-29', [['Luis', 'grssxsr'], ['Priya', 'xrssssr']], { purpose: 'Lift stations before the pour', askedBy: 'us', billing: 'inside', jobIds: ['j1'] })
const trim = trip('t6', '2026-12-01', [['Dana', 'rsssr']], { purpose: '', askedBy: 'them', billing: 'ours' })
const records = [lifts, trim, firstTry]
const hours: TripHourRow[] = [
  row('Luis', '2026-10-29', 6, 'elsewhere'),
  row('Luis', '2026-10-31', 10, 'site'),
  row('Luis', '2026-11-02', 3, 'elsewhere'),
  row('Priya', '2026-10-31', 10.5, 'site', 'j2'),
  row('Dana', '2026-02-16', 9, 'none'),
  row('Dana', '2026-10-12', 4, 'elsewhere'),
]

describe('words', () => {
  it('says a trip’s days inside a month, across one, and for one day', () => {
    expect(tripSpanWords('2026-12-01', '2026-12-05', TODAY)).toBe('Dec 1 to 5')
    expect(tripSpanWords('2026-10-23', '2026-11-04', TODAY)).toBe('Oct 23 to Nov 4')
    expect(tripSpanWords('2026-12-01', '2026-12-01', TODAY)).toBe('Dec 1')
  })

  it('says the year when the trip is not in this year, or runs across a year end', () => {
    expect(tripSpanWords('2025-03-06', '2025-03-20', TODAY)).toBe('Mar 6 to 20, 2025')
    expect(tripSpanWords('2026-12-29', '2027-01-03', TODAY)).toBe('Dec 29, 2026 to Jan 3, 2027')
  })

  it('says hours whole above a hundred and to one place below', () => {
    expect(hoursWords(1408.4)).toBe('1,408')
    expect(hoursWords(10.5)).toBe('10.5')
    expect(hoursWords(10)).toBe('10')
    expect(hoursWords(0)).toBe('0')
  })

  it('says names, days and who asked', () => {
    expect(namesWords(['Luis'])).toBe('Luis')
    expect(namesWords(['Luis', 'Priya'])).toBe('Luis and Priya')
    expect(namesWords(['Dana', 'Luis', 'Omar'])).toBe('Dana, Luis and Omar')
    expect(daysWords(1)).toBe('1 day')
    expect(monthDay('2026-10-23')).toBe('Oct 23')
    expect(askedByWords({ askedBy: 'us', askedWho: '' })).toBe('us')
    expect(askedByWords({ askedBy: 'them', askedWho: ' Ray ' })).toBe('Ray')
    expect(askedByWords({ askedBy: 'them', askedWho: '' })).toBe('them')
    expect(askedByWords({ askedBy: null, askedWho: 'Ray' })).toBeNull()
  })
})

describe('the look', () => {
  const model = buildTripsLook({ records, index: NO_TRIP_PEOPLE, hours, todayYmd: TODAY })

  it('lists the trips newest first, each with its days, its words and where it stands', () => {
    expect(model.rows.map((r) => [r.id, r.when, r.standingWords, r.why, r.who])).toEqual([
      ['t6', 'Dec 1 to 5', 'Planned', 'A trip', 'Dana · asked by them'],
      ['t5', 'Oct 29 to Nov 4', 'Back · 4 days at the site', 'Lift stations before the pour', 'Luis, Priya · asked by us'],
      ['t1', 'Feb 13 to 19', 'Back · 2 days at the site', 'Rough-in, first try', 'Dana, Luis · asked by Ray, the site super'],
    ])
  })

  it('counts the band from the same days: trips gone out, planned, and days at the site', () => {
    expect(model.band).toMatchObject({ gone: 2, planned: 1, siteDays: 6 })
  })

  it('lays the hours over the trips: at the site only with a punch there, no place apart, the rest at home', () => {
    expect(model.band.hours).toEqual({ site: 20.5, road: 0, ready: 6, noPlace: 9, home: 7, all: 42.5, notAtSite: 22 })
    expect(model.rows.find((r) => r.id === 't5')?.hours).toMatchObject({ site: 20.5, ready: 6, all: 26.5 })
    expect(model.rows.find((r) => r.id === 't1')?.hours).toMatchObject({ noPlace: 9, site: 0, all: 9 })
    expect(model.rows.find((r) => r.id === 't6')?.hours).toMatchObject({ all: 0 })
    expect(model.home).toEqual([
      { personKey: 'n:dana', jobId: 'j1', hours: 4 },
      { personKey: 'n:luis', jobId: 'j1', hours: 3 },
    ])
  })

  it('gives each person their own days over the trip’s span, and their hours', () => {
    const luis = model.rows.find((r) => r.id === 't5')?.people.find((p) => p.name === 'Luis')
    expect(luis?.days.map((d) => d.kind ?? 'off')).toEqual(['ready', 'road', 'site', 'site', 'off', 'site', 'road'])
    expect(luis?.hours).toEqual({ site: 10, road: 0, ready: 6, noPlace: 0, all: 16 })
  })

  it('words the billing, and counts the chips', () => {
    expect(model.rows.map((r) => r.billingLabel)).toEqual(['Ours · no bill', 'Inside the price', 'Extra'])
    expect(model.counts).toEqual({ all: 3, them: 2, extra: 1 })
    expect(filterTripRows(model.rows, 'them').map((r) => r.id)).toEqual(['t6', 't1'])
    expect(filterTripRows(model.rows, 'extra').map((r) => r.id)).toEqual(['t1'])
    expect(filterTripRows(model.rows, 'all')).toHaveLength(3)
  })

  it('leaves the hours unknown while they are not read, and still counts the days', () => {
    const waiting = buildTripsLook({ records, index: NO_TRIP_PEOPLE, hours: null, todayYmd: TODAY })
    expect(waiting.band).toMatchObject({ gone: 2, planned: 1, siteDays: 6, hours: null })
    expect(waiting.rows.every((r) => r.hours === null && r.people.every((p) => p.hours === null))).toBe(true)
  })

  it('says the look in one line, with a trip that is out in amber', () => {
    expect(tripsLookWords(model)).toEqual({ n: 3, count: '3 trips', need: null })
    expect(tripsStripWords(records, '2026-10-31')).toEqual({ n: 3, count: '3 trips', need: '1 out now' })
    expect(tripsStripWords([lifts], TODAY)).toEqual({ n: 1, count: '1 trip', need: null })
    expect(tripsStripWords([], TODAY)).toEqual({ n: 0, count: 'none yet', need: null })
  })

  it('adds the runs of punches that look like a trip to the amber words, a trip that is out first', () => {
    expect(tripOffersNeedWords(1)).toBe('1 looks like a trip')
    expect(tripOffersNeedWords(3)).toBe('3 look like trips')
    expect(tripsLookWords(model, 1)).toEqual({ n: 3, count: '3 trips', need: '1 looks like a trip' })
    expect(tripsStripWords(records, '2026-10-31', 2)).toEqual({ n: 3, count: '3 trips', need: '1 out now · 2 look like trips' })
    expect(tripsStripWords([], TODAY, 1)).toEqual({ n: 0, count: 'none yet', need: '1 looks like a trip' })
    expect(tripsStripWords([lifts], TODAY, 0)).toEqual({ n: 1, count: '1 trip', need: null })
  })

  it('shares the hours at the site as a percent', () => {
    expect(atSitePercentWords({ site: 609, all: 1408 })).toBe('43%')
    expect(atSitePercentWords({ site: 0, all: 0 })).toBeNull()
  })
})

describe('the year strip', () => {
  const model = buildTripsLook({ records: [...records, trip('old', '2025-12-29', [['Dana', 'rssssssr']])], index: NO_TRIP_PEOPLE, hours: null, todayYmd: TODAY })

  it('places each trip of the year by its first day, planned ones marked, and today', () => {
    const strip = buildTripStrip(model.rows, 2026, TODAY)
    expect(strip.bars.map((b) => [b.id, b.label, b.planned, b.kinds.length])).toEqual([
      ['old', 'Jan 1', false, 5],
      ['t1', 'Feb 13', false, 7],
      ['t5', 'Oct 29', false, 7],
      ['t6', 'Dec 1', true, 5],
    ])
    expect(strip.bars[1]?.leftPct).toBeCloseTo((43 / 365) * 100)
    expect(strip.bars[1]?.widthPct).toBeCloseTo((7 / 365) * 100)
    expect(strip.todayPct).toBeCloseTo((320 / 365) * 100)
    expect(strip.years).toEqual([2025, 2026])
    expect(strip.months).toHaveLength(12)
  })

  it('shows the part of a trip that falls in another year there, with no today', () => {
    const strip = buildTripStrip(model.rows, 2025, TODAY)
    expect(strip.bars.map((b) => [b.id, b.label, b.kinds.length])).toEqual([['old', 'Dec 29', 3]])
    expect(strip.todayPct).toBeNull()
  })

  it('opens on this year when a trip touches it, else on the year of the newest trip', () => {
    expect(tripStripStartYear(model.rows, TODAY)).toBe(2026)
    expect(tripStripStartYear(model.rows, '2028-03-01')).toBe(2026)
    expect(tripStripStartYear([], TODAY)).toBe(2026)
  })
})
