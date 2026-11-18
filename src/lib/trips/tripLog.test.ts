/**
 * The trip log on paper (punch list #379, PR 8): the look's model in, the paper's lines out. Heron Point's
 * made-up trips, people and hours; nothing here is real, and the paper carries no dollars.
 */
import { describe, expect, it } from 'vitest'
import { addDays, type TripDayKind } from './tripDays'
import type { TripHourRow } from './tripHours'
import { buildTripLog, dayKindsWords, siteHoursWords, TRIP_LOG_HOURS_NOTE, tripHoursWords, tripLogPrintHtml, tripSpanOnPaper } from './tripLog'
import { newTripRecord, NO_TRIP_PEOPLE, type TripRecord } from './tripRecord'
import { buildTripsLook } from './tripsLook'

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

const firstTry = trip('t1', '2026-02-13', [['Dana', 'grrssrr'], ['Luis', 'xrrssrr']], { purpose: 'Rough-in, first try', askedBy: 'them', askedWho: 'Ray, the site super', askedHow: 'by phone, Feb 11', billing: 'extra', outcome: 'Turned around. The slab was not ready.' })
const lifts = trip('t5', '2026-10-29', [['Luis', 'grssxsr'], ['Priya', 'xrssssr']], { purpose: 'Lift stations before the pour', askedBy: 'us', billing: 'inside', jobIds: ['j1', 'gone'] })
const trim = trip('t6', '2026-12-01', [['Dana', 'rsssr']], { askedBy: 'them', billing: 'ours' })
const records = [lifts, trim, firstTry]
const hours: TripHourRow[] = [row('Luis', '2026-10-29', 6, 'elsewhere'), row('Luis', '2026-10-31', 10, 'site'), row('Luis', '2026-11-02', 3, 'elsewhere'), row('Priya', '2026-10-31', 10.5, 'site', 'j2'), row('Dana', '2026-02-16', 9, 'none'), row('Dana', '2026-10-12', 4, 'elsewhere')]
const jobLabel = (id: string) => (id === 'j1' ? 'J2101 Rough-in: lodge and bunkhouse' : null)
const logOf = (h: TripHourRow[] | null, over: { hoursNote?: string | null; customerName?: string | null; printedBy?: string | null } = {}) =>
  buildTripLog({ model: buildTripsLook({ records, index: NO_TRIP_PEOPLE, hours: h, todayYmd: TODAY }), siteName: 'Heron Point', customerName: 'customerName' in over ? (over.customerName ?? null) : 'Northgate Builders', printedAt: 'Nov 17, 2026, 3:10 PM', printedBy: 'printedBy' in over ? (over.printedBy ?? null) : 'Dana', jobLabel, hoursNote: over.hoursNote })

describe('words on the paper', () => {
  it('always says the year of a trip’s days', () => {
    expect(tripSpanOnPaper('2026-10-29', '2026-11-04')).toBe('Oct 29 to Nov 4, 2026')
    expect(tripSpanOnPaper('2026-12-01', '2026-12-05')).toBe('Dec 1 to 5, 2026')
    expect(tripSpanOnPaper('2026-12-01', '2026-12-01')).toBe('Dec 1, 2026')
    expect(tripSpanOnPaper('2026-12-29', '2027-01-03')).toBe('Dec 29, 2026 to Jan 3, 2027')
  })

  it('says a person’s days by kind, and leaves out a kind with none', () => {
    expect(dayKindsWords({ site: 8, road: 2, ready: 1 })).toBe('8 days at the site, 2 on the road, 1 getting ready')
    expect(dayKindsWords({ site: 1, road: 0, ready: 0 })).toBe('1 day at the site')
    expect(dayKindsWords({ site: 0, road: 0, ready: 0 })).toBe('no day yet')
  })

  it('says a trip’s hours in four figures and the site’s in five', () => {
    expect(tripHoursWords({ site: 20.5, road: 0, ready: 6, noPlace: 0, all: 26.5 })).toBe('At the site 20.5 h · On the road 0 h · Getting ready 6 h · No place on the punch 0 h · 26.5 h in all')
    expect(siteHoursWords({ site: 20.5, road: 0, ready: 6, noPlace: 9, home: 7, all: 42.5, notAtSite: 22 })).toBe('At the site 20.5 h · On the road 0 h · Getting ready 6 h · No place on the punch 9 h · At home for the site 7 h · 42.5 h on the site’s jobs')
  })
})

describe('the trip log', () => {
  const log = logOf(hours)

  it('heads the paper with the site, the customer, and when and by whom it was printed', () => {
    expect([log.siteName, log.customerName, log.stamp]).toEqual(['Heron Point', 'Northgate Builders', 'Printed Nov 17, 2026, 3:10 PM by Dana'])
    expect(logOf(hours, { customerName: null, printedBy: null }).stamp).toBe('Printed Nov 17, 2026, 3:10 PM')
    expect(logOf(hours, { customerName: '  ' }).customerName).toBeNull()
  })

  it('has one block a trip, oldest first, headed by its days and where it stands', () => {
    expect(log.blocks.map((b) => [b.id, b.heading])).toEqual([
      ['t1', 'Feb 13 to 19, 2026 · Back'],
      ['t5', 'Oct 29 to Nov 4, 2026 · Back'],
      ['t6', 'Dec 1 to 5, 2026 · Planned'],
    ])
  })

  it('says what a trip was for, its days, who asked and how, how it went, its jobs, its billing and its hours', () => {
    expect(log.blocks[0]!.lines).toEqual([
      { label: 'What for', words: 'Rough-in, first try' },
      { label: 'The days', words: '7 days: 2 days at the site, 4 on the road, 1 getting ready' },
      { label: 'Asked by', words: 'Them: Ray, the site super, by phone, Feb 11' },
      { label: 'How it went', words: 'Turned around. The slab was not ready.' },
      { label: 'Work goes on', words: 'No job named' },
      { label: 'Billing', words: 'Extra: past the job’s price, to be billed with its reason' },
      { label: 'Hours', words: 'At the site 0 h · On the road 0 h · Getting ready 0 h · No place on the punch 9 h · 9 h in all' },
    ])
    const lift = Object.fromEntries(log.blocks[1]!.lines.map((l) => [l.label, l.words]))
    expect(lift['Asked by']).toBe('Us')
    expect(lift['How it went']).toBe('Nobody has said')
    expect(lift['Work goes on']).toBe('J2101 Rough-in: lodge and bunkhouse; A job no longer on this site')
    expect(lift['Billing']).toBe('Inside the price: part of the job’s price, not billed apart')
    expect(lift['Hours']).toBe('At the site 20.5 h · On the road 0 h · Getting ready 6 h · No place on the punch 0 h · 26.5 h in all')
  })

  it('names who went, each with their own days by kind', () => {
    expect(log.blocks[0]!.people).toEqual(['Dana: 2 days at the site, 4 on the road, 1 getting ready', 'Luis: 2 days at the site, 4 on the road'])
    expect(log.blocks[1]!.people).toEqual(['Luis: 3 days at the site, 2 on the road, 1 getting ready', 'Priya: 4 days at the site, 2 on the road'])
  })

  it('a planned trip says what is known and has no hours', () => {
    const planned = Object.fromEntries(log.blocks[2]!.lines.map((l) => [l.label, l.words]))
    expect(planned).toEqual({ 'What for': 'Nobody has said', 'The days': '5 days: 3 days at the site, 2 on the road', 'Asked by': 'Them', 'How it went': 'Not back yet', 'Work goes on': 'No job named', Billing: 'Ours: our own cost, no bill' })
  })

  it('closes with the trips, the days at the site and the site’s five figures', () => {
    expect(log.totals).toEqual(['2 trips gone out, 1 planned', '6 days at the site', 'At the site 20.5 h · On the road 0 h · Getting ready 6 h · No place on the punch 9 h · At home for the site 7 h · 42.5 h on the site’s jobs'])
    expect(log.hoursNote).toBeNull()
  })

  it('with the hours not read it leaves them off every block and off the totals, and says why', () => {
    const bare = logOf(null, { hoursNote: TRIP_LOG_HOURS_NOTE.closed })
    expect(bare.blocks.every((b) => b.lines.every((l) => l.label !== 'Hours'))).toBe(true)
    expect(bare.totals).toEqual(['2 trips gone out, 1 planned', '6 days at the site'])
    expect(bare.hoursNote).toBe('The clock’s days are closed to the person who printed this, so the hours are not on this page.')
  })
})

describe('the printed page', () => {
  const html = tripLogPrintHtml(logOf(hours))

  it('is a light page with the site, the customer, the stamp, a block a trip and the totals', () => {
    expect(html).toContain('<html lang="en" data-theme="light">')
    expect(html).toContain('<h1>Heron Point · trip log</h1><span>Northgate Builders</span>')
    expect(html).toContain('Printed Nov 17, 2026, 3:10 PM by Dana')
    expect(html.match(/<section class="trip">/g)).toHaveLength(3)
    expect(html.indexOf('Feb 13 to 19, 2026')).toBeLessThan(html.indexOf('Oct 29 to Nov 4, 2026'))
    expect(html).toContain('<dt>Who went</dt><dd>Luis: 3 days at the site, 2 on the road, 1 getting ready<br>Priya: 4 days at the site, 2 on the road</dd>')
    expect(html).toContain('<p class="totals">2 trips gone out, 1 planned · 6 days at the site · At the site 20.5 h')
  })

  it('carries no dollars at all', () => {
    expect(html).not.toContain('$')
    expect(html.toLowerCase()).not.toMatch(/dollar|wage|labor/)
    // With the hours unread and a reason given, the page says the reason and still no dollar.
    const bare = tripLogPrintHtml(logOf(null, { hoursNote: TRIP_LOG_HOURS_NOTE.failed }))
    expect(bare).toContain('<p class="note">The clock would not read, so the hours are not on this page.</p>')
    expect(bare).not.toContain('$')
  })

  it('escapes what a person typed', () => {
    const typed = buildTripLog({ model: buildTripsLook({ records: [trip('t9', '2026-03-02', [['Omar <b>', 's']], { purpose: 'Pump & <valve>' })], index: NO_TRIP_PEOPLE, hours: null, todayYmd: TODAY }), siteName: 'Heron <Point>', customerName: null, printedAt: 'Nov 17, 2026', printedBy: null, jobLabel })
    const page = tripLogPrintHtml(typed)
    expect(page).toContain('Pump &amp; &lt;valve&gt;')
    expect(page).toContain('Omar &lt;b&gt;: 1 day at the site')
    expect(page).toContain('<h1>Heron &lt;Point&gt; · trip log</h1>')
    expect(page).not.toContain('<valve>')
  })
})
