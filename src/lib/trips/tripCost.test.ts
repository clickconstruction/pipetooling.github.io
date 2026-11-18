/**
 * What a trip cost (punch list #379, PR 8): the wages of the hours inside the trip and the card charges
 * dated in its days. Heron Point's made-up people, days and round dollars; nothing here is real.
 */
import { describe, expect, it } from 'vitest'
import { EMPTY_CARD_CHARGE_EXCLUSIONS } from '../../../supabase/functions/_shared/cardChargeAllocationFilter'
import type { SiteCostRows } from '../developments/siteCosts'
import type { SiteLabor, SiteLaborPerson } from '../developments/siteLabor'
import { addDays, type Trip, type TripDayKind } from './tripDays'
import { siteCardCharges, splitTripCosts, tripCostLines, tripCostsOfTrips, type TripCardCharge } from './tripCost'
import { NO_TRIP_PEOPLE, tripPeopleIndex } from './tripRecord'

function days(first: string, letters: string): Record<string, TripDayKind> {
  const kind: Record<string, TripDayKind> = { g: 'ready', r: 'road', s: 'site' }
  const out: Record<string, TripDayKind> = {}
  ;[...letters].forEach((c, i) => {
    const k = kind[c]
    if (k) out[addDays(first, i)] = k
  })
  return out
}
const day = (ymd: string, hours: number, costUsd: number) => ({ ymd, hours, costUsd })
const person = (personName: string, byWorkDate: Array<{ ymd: string; hours: number; costUsd: number }>): SiteLaborPerson => ({
  personName,
  personId: null,
  userId: null,
  hours: byWorkDate.reduce((s, d) => s + d.hours, 0),
  costUsd: byWorkDate.reduce((s, d) => s + d.costUsd, 0),
  days: byWorkDate.length,
  leadDays: 0,
  byWorkDate,
})
function laborOf(jobs: Record<string, SiteLaborPerson[]>): SiteLabor {
  const byJobId = new Map(Object.entries(jobs).map(([jobId, people]) => [jobId, { jobId, hours: people.reduce((s, p) => s + p.hours, 0), costUsd: people.reduce((s, p) => s + p.costUsd, 0), days: 0, people }]))
  return { byJobId, siteDays: 0, people: 0, daysKnown: true }
}
const card = (ymd: string | null, usd: number, txKey: string, jobId = 'j1'): TripCardCharge => ({ jobId, ymd, usd, txKey })

// The lift stations trip runs across a month end. Luis is off on Nov 2, in the middle. Dana never went.
const lifts: Trip = { id: 't5', people: [{ personKey: 'n:luis', name: 'Luis', days: days('2026-10-29', 'grssxsr') }, { personKey: 'n:priya', name: 'Priya', days: days('2026-10-29', 'xrssssr') }] }
const LABOR = laborOf({
  j1: [
    person('Luis', [day('2026-10-29', 6, 300), day('2026-10-31', 10, 500), day('2026-11-02', 4, 200), day('2026-11-03', 10, 500), day('2026-10-12', 8, 400)]),
    person('Dana', [day('2026-10-31', 5, 350), day('2026-11-03', 5, 350)]),
  ],
  j2: [person('Priya', [day('2026-10-31', 10, 400), day('2026-11-04', 8, 320)])],
})
const CARDS = [card('2026-10-28', 90, 'tx0'), card('2026-10-29', 120, 'tx1'), card('2026-11-02', 60, 'tx2'), card('2026-11-04', 200, 'tx3', 'j2'), card('2026-11-04', 40, 'tx3'), card('2026-11-05', 75, 'tx4'), card(null, 30, 'tx5')]

describe('the split of wages and card charges over trips', () => {
  const split = splitTripCosts({ trips: [lifts], labor: LABOR, index: NO_TRIP_PEOPLE, cards: CARDS })
  const trip = split.byTrip.get('t5')!

  it('gives a trip the wages of its people on their own trip days, across a month end', () => {
    // Luis Oct 29, Oct 31 and Nov 3; Priya Oct 31 and Nov 4.
    expect(trip.hours).toBe(6 + 10 + 10 + 10 + 8)
    expect(trip.laborUsd).toBe(300 + 500 + 500 + 400 + 320)
    expect([...trip.workDays].sort()).toEqual(['2026-10-29', '2026-10-31', '2026-11-03', '2026-11-04'])
  })

  it('leaves out a day off in the middle and a person who was not on the trip: both are at home for the site', () => {
    // Luis on Nov 2 and on Oct 12, and Dana on two of the trip's own days.
    expect(split.home.hours).toBe(4 + 8 + 5 + 5)
    expect(split.home.laborUsd).toBe(200 + 400 + 350 + 350)
  })

  it('gives a trip the card charges dated on a day anyone was on it, whoever spent them', () => {
    // Nov 2 is a day off for Luis, and Priya was at the site, so the charge is in the trip's days.
    expect(trip.cardsUsd).toBe(120 + 60 + 200 + 40)
    // One bank charge split over two of the site's jobs is one charge.
    expect(trip.cards).toBe(3)
  })

  it('keeps a charge the day before the trip, the day after and one with no date outside it', () => {
    expect(split.home.cardsUsd).toBe(90 + 75 + 30)
    expect(split.home.cards).toBe(3)
  })

  it('adds up: every hour, every wage dollar and every card dollar is in a trip or at home', () => {
    const hours = [...LABOR.byJobId.values()].reduce((s, j) => s + j.hours, 0)
    const wages = [...LABOR.byJobId.values()].reduce((s, j) => s + j.costUsd, 0)
    expect(trip.hours + split.home.hours).toBe(hours)
    expect(trip.laborUsd + split.home.laborUsd).toBe(wages)
    expect(trip.cardsUsd + split.home.cardsUsd).toBe(CARDS.reduce((s, c) => s + c.usd, 0))
  })

  it('a day two trips both hold goes to the trip that went out first, once', () => {
    const early: Trip = { id: 't4', people: [{ personKey: 'n:walt', name: 'Walt', days: days('2026-10-27', 'rss') }] }
    const two = splitTripCosts({ trips: [lifts, early], labor: LABOR, index: NO_TRIP_PEOPLE, cards: CARDS })
    // Oct 28 is Walt's alone; Oct 29 is on both trips and goes to Walt's, which went out first.
    expect(two.byTrip.get('t4')!.cardsUsd).toBe(90 + 120)
    expect(two.byTrip.get('t5')!.cardsUsd).toBe(60 + 200 + 40)
    // Walt has no hours on the clock, and Luis's Oct 29 is his own trip day still.
    expect(two.byTrip.get('t4')!.laborUsd).toBe(0)
    expect(two.byTrip.get('t5')!.laborUsd).toBe(2020)
  })

  it('a window keeps the days inside it, and an undated charge is in no window', () => {
    const nov = splitTripCosts({ trips: [lifts], labor: LABOR, index: NO_TRIP_PEOPLE, cards: CARDS, window: { from: '2026-11-01', to: '2026-11-30' } })
    expect(nov.byTrip.get('t5')!.laborUsd).toBe(500 + 320)
    expect(nov.byTrip.get('t5')!.cardsUsd).toBe(60 + 200 + 40)
    expect(nov.home.laborUsd).toBe(200 + 350)
    expect(nov.home.cardsUsd).toBe(75)
  })

  it('kept to some jobs, it counts those jobs alone', () => {
    const j2 = splitTripCosts({ trips: [lifts], labor: LABOR, index: NO_TRIP_PEOPLE, cards: CARDS, jobIds: new Set(['j2']) })
    expect(j2.byTrip.get('t5')!.laborUsd).toBe(720)
    expect(j2.byTrip.get('t5')!.cardsUsd).toBe(200)
    expect(j2.home.laborUsd).toBe(0)
  })

  it('names a person the way the hours split does: the roster person, by login or by name', () => {
    const index = tripPeopleIndex([{ id: 'p-luis', name: 'Luis', userId: 'u-luis' }])
    const trip2: Trip = { id: 't9', people: [{ personKey: 'p:p-luis', name: 'Luis', days: days('2026-10-31', 's') }] }
    const labor = laborOf({ j1: [{ ...person('Luis', [day('2026-10-31', 10, 500)]), userId: 'u-luis' }] })
    expect(splitTripCosts({ trips: [trip2], labor, index, cards: null }).byTrip.get('t9')!.laborUsd).toBe(500)
  })

  it('says what is not known: no days on the clock, no card charges handed in', () => {
    const noDays = splitTripCosts({ trips: [lifts], labor: { ...LABOR, daysKnown: false }, index: NO_TRIP_PEOPLE, cards: null })
    expect(noDays.laborKnown).toBe(false)
    expect(noDays.cardsKnown).toBe(false)
    expect(noDays.byTrip.get('t5')!.laborUsd).toBe(0)
  })
})

describe('what it cost, on an open trip', () => {
  it('a reader who may not see costs gets nothing', () => {
    expect(tripCostsOfTrips({ seesCosts: false, trips: [lifts], labor: LABOR, index: NO_TRIP_PEOPLE, cards: CARDS })).toBeNull()
  })

  it('a dev or a controller gets the wages, the cards and the sum', () => {
    const costs = tripCostsOfTrips({ seesCosts: true, trips: [lifts], labor: LABOR, index: NO_TRIP_PEOPLE, cards: CARDS })!
    expect(costs.get('t5')).toEqual({ laborUsd: 2020, cards: { count: 3, usd: 420 }, totalUsd: 2440 })
  })

  it('each figure waits on its own read, and the sum waits on both', () => {
    const noClock = tripCostsOfTrips({ seesCosts: true, trips: [lifts], labor: null, index: NO_TRIP_PEOPLE, cards: CARDS })!
    expect(noClock.get('t5')).toEqual({ laborUsd: null, cards: { count: 3, usd: 420 }, totalUsd: null })
    const noCosts = tripCostsOfTrips({ seesCosts: true, trips: [lifts], labor: LABOR, index: NO_TRIP_PEOPLE, cards: null })!
    expect(noCosts.get('t5')).toEqual({ laborUsd: 2020, cards: null, totalUsd: null })
  })

  it('writes the three rows, money as the Scoreboard writes it', () => {
    const lines = tripCostLines({ laborUsd: 2020, cards: { count: 3, usd: 420 }, totalUsd: 2440 }, { labor: 'read', cards: 'read' })
    expect(lines.map((l) => [l.label, l.small, l.value])).toEqual([
      ['The crew’s hours', null, '$2,020'],
      ['Card and bank charges in the days', '3 charges', '$420'],
      ['The trip', null, '$2,440'],
    ])
    expect(tripCostLines({ laborUsd: 0, cards: { count: 1, usd: 40 }, totalUsd: 40 }, { labor: 'read', cards: 'read' })[1]!.small).toBe('1 charge')
  })

  it('says plainly what is not read yet, and gives no sum on half a read', () => {
    const waiting = tripCostLines({ laborUsd: null, cards: null, totalUsd: null }, { labor: 'reading', cards: 'reading' })
    expect(waiting.map((l) => [l.value, l.stands])).toEqual([['reading the clock…', false], ['reading the costs…', false], ['—', false]])
    const closed = tripCostLines({ laborUsd: null, cards: { count: 3, usd: 420 }, totalUsd: null }, { labor: 'closed', cards: 'read' })
    expect(closed.map((l) => l.value)).toEqual(['the clock’s days are closed', '$420', '—'])
    const failed = tripCostLines({ laborUsd: 2020, cards: null, totalUsd: null }, { labor: 'read', cards: 'failed' })
    expect(failed.map((l) => l.value)).toEqual(['$2,020', 'the costs did not read', '—'])
    expect(tripCostLines(undefined, { labor: 'failed', cards: 'reading' })[0]!.value).toBe('the clock did not read')
  })

  it('leaves the card row out when the page’s cost rows carry no card charges, and the sum is the wages', () => {
    const lines = tripCostLines({ laborUsd: 2020, cards: null, totalUsd: null }, { labor: 'read', cards: 'off' })
    expect(lines.map((l) => [l.key, l.value])).toEqual([['labor', '$2,020'], ['total', '$2,020']])
  })
})

describe('the site’s card charges, from the cost rows the page holds', () => {
  const tx = (posted_at: string | null, amount: number) => ({ posted_at, counterparty_name: 'A made-up fuel stop', amount })
  const rows: Pick<SiteCostRows, 'cardAlloc' | 'cardExclusions'> = {
    cardAlloc: [
      { job_id: 'j1', id: 'a1', mercury_transaction_id: 'tx1', amount: -120, mercury_transactions: tx('2026-10-29', -120) },
      { job_id: 'j1', id: 'a2', mercury_transaction_id: 'tx2', amount: 40, mercury_transactions: tx('2026-10-30', 40) },
      { job_id: 'j2', id: 'a3', mercury_transaction_id: 'tx3', amount: -500, mercury_transactions: tx('2026-10-31', -500) },
      { job_id: 'j2', id: 'a4', mercury_transaction_id: 'tx4', amount: -75, mercury_transactions: tx('2026-10-31', -75) },
      { job_id: 'j1', id: 'a5', mercury_transaction_id: null, amount: -10, mercury_transactions: tx(null, -10) },
    ],
    // tx3 is an internal transfer and tx4 is already on a supply invoice: neither is a card cost.
    cardExclusions: { bucketByTxId: new Map([['tx3', 'internal_transfer']]), invoiceLinkedTxIds: new Set(['tx4']) },
  }
  const toYmd = (raw: string | null) => raw

  it('keeps the charges the job costs count, money out, each with its day', () => {
    expect(siteCardCharges(rows, toYmd)).toEqual([
      { jobId: 'j1', ymd: '2026-10-29', usd: 120, txKey: 'tx1' },
      // A refund comes off.
      { jobId: 'j1', ymd: '2026-10-30', usd: -40, txKey: 'tx2' },
      { jobId: 'j1', ymd: null, usd: 10, txKey: 'line:a5' },
    ])
  })

  it('with no rule read, every row counts', () => {
    expect(siteCardCharges({ ...rows, cardExclusions: EMPTY_CARD_CHARGE_EXCLUSIONS }, toYmd)).toHaveLength(5)
  })
})
