import { describe, expect, it } from 'vitest'
import type { Trip } from './tripDays'
import { tripEvidence, tripEvidenceChips } from './tripEvidence'
import type { PunchRow } from './tripHourRows'
import { tripPeopleIndex } from './tripRecord'

// Made-up points and people: a site, a motel about eleven miles off.
const site = { lat: 35.0, lng: -76.6 }
const index = tripPeopleIndex([
  { id: 'p-luis', name: 'Luis', userId: 'u-luis' },
  { id: 'p-priya', name: 'Priya', userId: 'u-priya' },
])
const punch = (over: Partial<PunchRow>): PunchRow => ({ user_id: 'u-luis', work_date: '2026-10-31', clock_in_lat: null, clock_in_lng: null, clock_in_location_source: null, arrived_lat: null, arrived_lng: null, arrived_location_source: null, clock_out_lat: null, clock_out_lng: null, clock_out_location_source: null, travel_started_at: null, arrived_at: null, ...over })
const atSite = { clock_in_lat: 35.001, clock_in_lng: -76.601, clock_in_location_source: 'gps' }
const atMotel = { clock_in_lat: 35.11, clock_in_lng: -76.75, clock_in_location_source: 'gps' }
const stamped = { travel_started_at: '2026-10-31T12:05:00Z', arrived_at: '2026-10-31T12:40:00Z' }

// A trip across a month end. Luis is off on Nov 1; Priya joins on Oct 31.
const trip: Trip = {
  id: 't5',
  people: [
    { personKey: 'p:p-luis', name: 'Luis', days: { '2026-10-30': 'road', '2026-10-31': 'site', '2026-11-02': 'site', '2026-11-03': 'road' } },
    { personKey: 'p:p-priya', name: 'Priya', days: { '2026-10-31': 'site', '2026-11-01': 'site', '2026-11-02': 'site' } },
  ],
}
const count = (punches: PunchRow[], historyDays: string[] = [], at: typeof site | null = site) => tripEvidence({ trip, punches, site: at, index, historyDays })

describe('what shows a trip', () => {
  it('counts the punches at the site on the trip’s person-days, across a month end', () => {
    const e = count([
      punch({ work_date: '2026-10-31', ...atSite }),
      punch({ work_date: '2026-10-31', ...atSite }),
      punch({ work_date: '2026-11-02', ...atSite }),
      punch({ user_id: 'u-priya', work_date: '2026-11-01', ...atSite }),
    ])
    expect(e.punchesAtSite).toBe(4)
  })

  it('does not count a punch on a day the person was off, though someone else was on the trip that day', () => {
    expect(count([punch({ work_date: '2026-11-01', ...atSite, ...stamped })])).toEqual({ punchesAtSite: 0, stamps: 0, historyLines: 0 })
  })

  it('does not count a punch by someone who is not on the trip', () => {
    expect(count([punch({ user_id: 'u-omar', work_date: '2026-10-31', ...atSite, ...stamped })])).toEqual({ punchesAtSite: 0, stamps: 0, historyLines: 0 })
  })

  it('counts the stamps on a trip day that is not at the site, and no punch at the site for it', () => {
    expect(count([punch({ work_date: '2026-10-30', ...atMotel, ...stamped }), punch({ work_date: '2026-11-03', travel_started_at: '2026-11-03T13:00:00Z' })])).toEqual({ punchesAtSite: 0, stamps: 3, historyLines: 0 })
  })

  it('counts each stamp one, on a punch at the site too', () => {
    expect(count([punch({ work_date: '2026-10-31', ...atSite, ...stamped })])).toEqual({ punchesAtSite: 1, stamps: 2, historyLines: 0 })
  })

  it('counts nothing from no punches', () => {
    expect(count([])).toEqual({ punchesAtSite: 0, stamps: 0, historyLines: 0 })
  })

  it('reads no punch as at the site when the site has no point, and still counts the stamps', () => {
    expect(count([punch({ work_date: '2026-10-31', ...atSite, ...stamped })], [], null)).toEqual({ punchesAtSite: 0, stamps: 2, historyLines: 0 })
  })

  it('counts the History lines on a day anyone was on the trip, one a line', () => {
    expect(count([], ['2026-10-29', '2026-10-30', '2026-11-01', '2026-11-01', '2026-11-03', '2026-11-04']).historyLines).toBe(4)
  })

  it('names a person on the trip the same way the clock does: by the login’s roster person', () => {
    const byName: Trip = { id: 't', people: [{ personKey: 'n:walt', name: 'Walt', days: { '2026-10-31': 'site' } }] }
    expect(tripEvidence({ trip: byName, punches: [punch({ work_date: '2026-10-31', ...atSite })], site, index, historyDays: [] }).punchesAtSite).toBe(0)
  })
})

describe('the chips', () => {
  it('says each count plainly, green for a sighting above zero and grey for the rest', () => {
    expect(tripEvidenceChips({ punchesAtSite: 8, stamps: 4, historyLines: 3 })).toEqual([
      { key: 'punches', words: '8 punches at the site', tone: 'green' },
      { key: 'stamps', words: '4 On my way and I’m here stamps', tone: 'green' },
      { key: 'lines', words: '3 lines in History', tone: 'plain' },
    ])
  })

  it('reads a zero plainly, and one as one', () => {
    expect(tripEvidenceChips({ punchesAtSite: 0, stamps: 0, historyLines: 0 }).map((c) => [c.words, c.tone])).toEqual([
      ['0 punches at the site', 'plain'],
      ['0 On my way and I’m here stamps', 'plain'],
      ['0 lines in History', 'plain'],
    ])
    expect(tripEvidenceChips({ punchesAtSite: 1, stamps: 1, historyLines: 1 }).map((c) => c.words)).toEqual(['1 punch at the site', '1 On my way and I’m here stamp', '1 line in History'])
  })
})
