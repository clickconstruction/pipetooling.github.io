import { describe, expect, it } from 'vitest'
import type { Trip } from './tripDays'
import { dismissalsForSuggestion, findTripsNotMade, tripPeopleFromSuggestion, type SitePunchDay } from './tripFinder'

// Every name here is made up.
const punch = (personKey: string, ymd: string, name?: string): SitePunchDay => ({ personKey, ymd, name })
const omarRun = [punch('omar', '2026-09-08', 'Omar'), punch('omar', '2026-09-09'), punch('omar', '2026-09-10'), punch('omar', '2026-09-11')]

describe('Looks like a trip', () => {
  it('offers a run of punches at the site that no trip covers', () => {
    const found = findTripsNotMade({ punchDays: omarRun, trips: [] })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ first: '2026-09-08', last: '2026-09-11', punchDays: 4, people: [{ personKey: 'omar', name: 'Omar', days: ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'] }] })
  })

  it('offers nothing when a trip has the person on it those days, whatever each day’s kind', () => {
    const trip: Trip = { id: 't', people: [{ personKey: 'omar', name: 'Omar', days: { '2026-09-08': 'road', '2026-09-09': 'site', '2026-09-10': 'site', '2026-09-11': 'road' } }] }
    expect(findTripsNotMade({ punchDays: omarRun, trips: [trip] })).toEqual([])
  })

  it('offers only the days a trip leaves out, and only for the person it leaves out', () => {
    const trip: Trip = { id: 't', people: [{ personKey: 'omar', name: 'Omar', days: { '2026-09-08': 'site', '2026-09-09': 'site' } }] }
    const found = findTripsNotMade({ punchDays: [...omarRun, punch('luis', '2026-09-08', 'Luis')], trips: [trip] })
    expect(found.map((s) => [s.first, s.last, s.people.map((p) => `${p.name} ${p.days.length}`)])).toEqual([['2026-09-08', '2026-09-11', ['Omar 2', 'Luis 1']]])
  })

  it('keeps a weekend inside one run and starts a new run after a longer gap', () => {
    const found = findTripsNotMade({ punchDays: [punch('omar', '2026-09-11'), punch('omar', '2026-09-14'), punch('omar', '2026-09-18')], trips: [] })
    expect(found.map((s) => `${s.first} to ${s.last}`)).toEqual(['2026-09-11 to 2026-09-14', '2026-09-18 to 2026-09-18'])
  })

  it('makes one offer of people whose days run together, the one with the most days first', () => {
    const found = findTripsNotMade({ punchDays: [...omarRun, punch('luis', '2026-09-10', 'Luis'), punch('luis', '2026-09-12'), punch('luis', '2026-09-10')], trips: [] })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ first: '2026-09-08', last: '2026-09-12', punchDays: 6 })
    expect(found[0]?.people.map((p) => p.name)).toEqual(['Omar', 'Luis'])
  })

  it('does not offer days somebody said were not a trip, and offers a day past them', () => {
    const dismissed = [{ personKey: 'omar', first: '2026-09-08', last: '2026-09-11' }]
    expect(findTripsNotMade({ punchDays: omarRun, trips: [], dismissed })).toEqual([])
    const found = findTripsNotMade({ punchDays: [...omarRun, punch('omar', '2026-09-12')], trips: [], dismissed })
    expect(found.map((s) => [s.first, s.last, s.punchDays])).toEqual([['2026-09-12', '2026-09-12', 1]])
  })

  it('keeps one key for the same people and days, and another when they change', () => {
    const a = findTripsNotMade({ punchDays: omarRun, trips: [] })[0]
    const b = findTripsNotMade({ punchDays: [...omarRun].reverse(), trips: [] })[0]
    const c = findTripsNotMade({ punchDays: [...omarRun, punch('omar', '2026-09-12')], trips: [] })[0]
    expect(a?.key).toBe(b?.key)
    expect(a?.key).not.toBe(c?.key)
  })

  it('offers nothing from no punches', () => {
    expect(findTripsNotMade({ punchDays: [], trips: [] })).toEqual([])
  })
})

describe('what a person does with an offer', () => {
  const offer = findTripsNotMade({ punchDays: [punch('omar', '2026-09-08', 'Omar'), punch('omar', '2026-09-09'), punch('omar', '2026-09-11'), punch('luis', '2026-09-09', 'Luis')], trips: [] })[0]

  it('Make it a trip fills the people and paints each punch day At the site, a gap left off', () => {
    if (!offer) throw new Error('no offer')
    expect(tripPeopleFromSuggestion(offer)).toEqual([
      { personKey: 'omar', name: 'Omar', days: { '2026-09-08': 'site', '2026-09-09': 'site', '2026-09-11': 'site' } },
      { personKey: 'luis', name: 'Luis', days: { '2026-09-09': 'site' } },
    ])
  })

  it('Not a trip remembers each person’s days, and the offer does not come back', () => {
    if (!offer) throw new Error('no offer')
    const dismissed = dismissalsForSuggestion(offer)
    expect(dismissed).toEqual([
      { personKey: 'omar', first: '2026-09-08', last: '2026-09-11' },
      { personKey: 'luis', first: '2026-09-09', last: '2026-09-09' },
    ])
    expect(findTripsNotMade({ punchDays: [punch('omar', '2026-09-08'), punch('omar', '2026-09-09'), punch('omar', '2026-09-11'), punch('luis', '2026-09-09')], trips: [], dismissed })).toEqual([])
  })
})
