import { describe, expect, it } from 'vitest'
import { addDays, type TripDayKind } from './tripDays'
import { plansByDateTrips } from './tripLane'
import { newTripRecord, type TripRecord } from './tripRecord'

// Every name, site and day here is made up.
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
const trip = (id: string, first: string, people: Array<[string, string]>, purpose = ''): TripRecord => ({ ...newTripRecord({ id, developmentId: 'd-heron' }), purpose, people: people.map(([name, letters]) => ({ personId: null, userId: null, name, days: days(first, letters) })) })

const lifts = trip('t5', '2026-10-23', [['Luis', 'gxxrssr'], ['Priya', 'xxxrssr']], ' Lift stations before the pour ')
const trim = trip('t6', '2026-12-01', [['Dana', 'rsr']])
const nobody = trip('t9', '2026-12-10', [])

describe('a site’s trips for the Plans look’s By date view', () => {
  const out = plansByDateTrips([trim, nobody, lifts], TODAY)

  it('hands over each trip with a day, in the order they went out', () => {
    expect(out.map((t) => t.id)).toEqual(['t5', 't6'])
  })

  it('gives each day the trip’s kind over everyone on it, and no kind on a day nobody was', () => {
    expect(out[0]?.days).toEqual([
      { ymd: '2026-10-23', kind: 'ready' },
      { ymd: '2026-10-24', kind: null },
      { ymd: '2026-10-25', kind: null },
      { ymd: '2026-10-26', kind: 'road' },
      { ymd: '2026-10-27', kind: 'site' },
      { ymd: '2026-10-28', kind: 'site' },
      { ymd: '2026-10-29', kind: 'road' },
    ])
  })

  it('says when, where it stands, who went and what for', () => {
    expect(out[0]).toMatchObject({ planned: false, when: 'Oct 23 to 29', standing: 'Back · 2 days at the site', who: 'Luis, Priya', why: 'Lift stations before the pour' })
    expect(out[1]).toMatchObject({ planned: true, when: 'Dec 1 to 3', standing: 'Planned', who: 'Dana', why: '' })
  })

  it('names a trip made before numbers by its days, with a door that says no number', () => {
    expect(out[0]).toMatchObject({ title: 'Trip Oct 23 to 29', number: null, door: 'Open this trip' })
  })

  it('names a trip by its number first, for its card, its line in the list and its door', () => {
    const numbered = plansByDateTrips([{ ...trim, tripNumber: 6 }, { ...lifts, tripNumber: 5 }], TODAY)
    expect(numbered.map((t) => [t.id, t.title, t.number, t.door, t.when])).toEqual([
      ['t5', 'Trip 5 · Oct 23 to 29', 'Trip 5', 'Open Trip 5', 'Oct 23 to 29'],
      ['t6', 'Trip 6 · Dec 1 to 3', 'Trip 6', 'Open Trip 6', 'Dec 1 to 3'],
    ])
  })

  it('says a trip that is out today is out now', () => {
    expect(plansByDateTrips([lifts], '2026-10-27')[0]).toMatchObject({ planned: false, standing: 'Out now · 2 days at the site' })
  })

  it('is empty for a site with no trip', () => {
    expect(plansByDateTrips([], TODAY)).toEqual([])
  })
})
