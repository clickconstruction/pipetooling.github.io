import { describe, expect, it } from 'vitest'
import { addDays, type TripDayKind } from './tripDays'
import type { TripHourRow } from './tripHours'
import { newTripRecord, NO_TRIP_PEOPLE, type TripRecord } from './tripRecord'
import { askedByWords, atSitePercentWords, buildTripStrip, buildTripsLook, daysWords, filterTripRows, hoursWords, monthDay, namesWords, tripName, tripNameOfRecord, tripNumberWords, tripRecordSpan, tripSpanWords, tripOffersNeedWords, tripStripStartYear, tripStripYearOf, tripsLookWords, tripsStripWords } from './tripsLook'

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

describe('a trip by name', () => {
  const span = { first: '2026-10-23', last: '2026-11-04' }

  it('leads with the number when the trip has one, in each form a screen needs', () => {
    expect(tripName({ tripNumber: 5, span, todayYmd: TODAY })).toEqual({
      number: 'Trip 5',
      days: 'Oct 23 to Nov 4',
      full: 'Trip 5 · Oct 23 to Nov 4',
      short: 'Trip 5',
      said: 'Trip 5, Oct 23 to Nov 4',
      theTrip: 'Trip 5, Oct 23 to Nov 4',
      door: 'Open Trip 5',
      titled: 'Trip 5 · Oct 23 to Nov 4',
    })
  })

  it('is told by its days alone when the trip was made before numbers', () => {
    expect(tripName({ tripNumber: null, span, todayYmd: TODAY })).toEqual({
      number: null,
      days: 'Oct 23 to Nov 4',
      full: 'Oct 23 to Nov 4',
      short: 'Oct 23 to Nov 4',
      said: 'Oct 23 to Nov 4',
      theTrip: 'the trip of Oct 23 to Nov 4',
      door: 'Open this trip',
      titled: 'Trip Oct 23 to Nov 4',
    })
  })

  it('says the year across a year end, and for a trip in another year, with the number and without', () => {
    const yearEnd = { first: '2026-12-29', last: '2027-01-03' }
    expect(tripName({ tripNumber: 7, span: yearEnd, todayYmd: TODAY }).full).toBe('Trip 7 · Dec 29, 2026 to Jan 3, 2027')
    expect(tripName({ tripNumber: 7, span: yearEnd, todayYmd: TODAY }).said).toBe('Trip 7, Dec 29, 2026 to Jan 3, 2027')
    expect(tripName({ tripNumber: 7, span: yearEnd, todayYmd: TODAY }).short).toBe('Trip 7')
    expect(tripName({ tripNumber: null, span: yearEnd, todayYmd: TODAY }).full).toBe('Dec 29, 2026 to Jan 3, 2027')
    expect(tripName({ tripNumber: null, span: yearEnd, todayYmd: TODAY }).short).toBe('Dec 29, 2026 to Jan 3, 2027')
    expect(tripName({ tripNumber: 2, span: { first: '2025-03-06', last: '2025-03-20' }, todayYmd: TODAY }).full).toBe('Trip 2 · Mar 6 to 20, 2025')
  })

  it('names a trip with no day yet by its number, or as this trip', () => {
    expect(tripName({ tripNumber: 8, span: null, todayYmd: TODAY })).toMatchObject({ full: 'Trip 8', short: 'Trip 8', said: 'Trip 8', theTrip: 'Trip 8', titled: 'Trip 8', days: null })
    expect(tripName({ tripNumber: null, span: null, todayYmd: TODAY })).toMatchObject({ full: 'No day yet', short: 'No day yet', theTrip: 'this trip', door: 'Open this trip', number: null })
  })

  it('reads a number only from a positive whole number', () => {
    expect([tripNumberWords(1), tripNumberWords(42), tripNumberWords(0), tripNumberWords(-1), tripNumberWords(2.5), tripNumberWords(null), tripNumberWords(undefined)]).toEqual(['Trip 1', 'Trip 42', null, null, null, null, null])
  })

  it('names a kept trip from its own days, over everyone on it', () => {
    const numbered = { ...lifts, tripNumber: 5 }
    expect(tripRecordSpan(numbered)).toEqual({ first: '2026-10-29', last: '2026-11-04' })
    expect(tripNameOfRecord(numbered, TODAY).full).toBe('Trip 5 · Oct 29 to Nov 4')
    expect(tripNameOfRecord(lifts, TODAY).full).toBe('Oct 29 to Nov 4')
    expect(tripRecordSpan(newTripRecord({ id: 'e', developmentId: 'd1' }))).toBeNull()
  })
})

describe('the look', () => {
  const model = buildTripsLook({ records, index: NO_TRIP_PEOPLE, hours, todayYmd: TODAY })

  it('names each row with its number when it has one, and by its days when it was made before numbers', () => {
    const mixed = buildTripsLook({ records: [{ ...lifts, tripNumber: 5 }, { ...trim, tripNumber: 6 }, firstTry], index: NO_TRIP_PEOPLE, hours: null, todayYmd: TODAY })
    expect(mixed.rows.map((r) => [r.id, r.name.number, r.name.full, r.when])).toEqual([
      ['t6', 'Trip 6', 'Trip 6 · Dec 1 to 5', 'Dec 1 to 5'],
      ['t5', 'Trip 5', 'Trip 5 · Oct 29 to Nov 4', 'Oct 29 to Nov 4'],
      ['t1', null, 'Feb 13 to 19', 'Feb 13 to 19'],
    ])
  })

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

  it('says each bar by the trip’s name on a hover and to a screen reader, the number first', () => {
    const numbered = buildTripsLook({ records: [{ ...lifts, tripNumber: 5 }, { ...trim, tripNumber: 6 }, firstTry], index: NO_TRIP_PEOPLE, hours: null, todayYmd: TODAY })
    expect(buildTripStrip(numbered.rows, 2026, TODAY).bars.map((b) => [b.id, b.title, b.aria])).toEqual([
      ['t1', 'Feb 13 to 19: open this trip', 'The trip of Feb 13 to 19. Open it.'],
      ['t5', 'Trip 5 · Oct 29 to Nov 4: open this trip', 'Trip 5, Oct 29 to Nov 4. Open it.'],
      ['t6', 'Trip 6 · Dec 1 to 5: open this trip', 'Trip 6, Dec 1 to 5, planned. Open it.'],
    ])
  })

  it('shows the year of one trip when a link opens it: this year when the trip touches it, else its last year', () => {
    const byId = new Map(model.rows.map((r) => [r.id, r]))
    expect(tripStripYearOf(byId.get('t5')!, TODAY)).toBe(2026)
    expect(tripStripYearOf(byId.get('old')!, TODAY)).toBe(2026)
    expect(tripStripYearOf(byId.get('old')!, '2028-03-01')).toBe(2026)
    expect(tripStripYearOf(byId.get('t5')!, '2028-03-01')).toBe(2026)
    expect(tripStripYearOf({ span: { first: '2024-05-01', last: '2024-05-03' } }, TODAY)).toBe(2024)
    expect(tripStripYearOf({ span: null }, TODAY)).toBe(2026)
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
