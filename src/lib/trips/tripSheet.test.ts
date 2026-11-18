import { describe, expect, it } from 'vitest'
import { newTripRecord, type TripRecord } from './tripRecord'
import {
  addSheetPerson,
  clearSheetPersonDays,
  recordFromSheet,
  removeSheetPerson,
  setSheetRange,
  sheetDays,
  sheetFromRecord,
  sheetHasMore,
  sheetPersonDays,
  sheetProblem,
  sheetRosterLeft,
  sheetStanding,
  tapSheetDay,
  tapSheetPersonDay,
  TRIP_SHEET_MAX_DAYS,
} from './tripSheet'

// Every name here is made up.
const TODAY = '2026-11-17'
const fresh = newTripRecord({ id: 't-new', developmentId: 'd1' })
const dana = { id: 'p-dana', name: 'Dana', userId: 'u-dana' }
const luis = { id: 'p-luis', name: 'Luis', userId: null }
const kinds = (list: Array<{ kind: string | null }>) => list.map((d) => d.kind ?? 'off')

describe('a new trip', () => {
  const start = sheetFromRecord(fresh, TODAY)

  it('opens on today, painted At the site, with nobody on it', () => {
    expect(start).toMatchObject({ people: [], first: TODAY, last: TODAY, shared: { [TODAY]: 'site' } })
    expect(sheetProblem(start, fresh)).toBe('Add who went.')
  })

  it('is whole with one person and one day', () => {
    const one = addSheetPerson(start, dana)
    expect(sheetProblem(one, fresh)).toBeNull()
    expect(recordFromSheet(one, fresh).people).toEqual([{ personId: 'p-dana', userId: 'u-dana', name: 'Dana', days: { [TODAY]: 'site' } }])
  })

  it('paints every picked day At the site, and a last day before the first follows the first', () => {
    const moved = setSheetRange(start, '2026-12-01', start.last)
    expect(moved).toMatchObject({ first: '2026-12-01', last: '2026-12-01', shared: { '2026-12-01': 'site' } })
    const ranged = setSheetRange(moved, '2026-12-01', '2026-12-05')
    expect(kinds(sheetDays(ranged))).toEqual(['site', 'site', 'site', 'site', 'site'])
  })

  it('turns a day one tap at a time, and keeps the taps when the range grows or shrinks', () => {
    let s = setSheetRange(setSheetRange(start, '2026-12-01', '2026-12-01'), '2026-12-01', '2026-12-05')
    s = tapSheetDay(s, '2026-12-01')
    s = tapSheetDay(tapSheetDay(tapSheetDay(s, '2026-12-03'), '2026-12-03'), '2026-12-03')
    expect(kinds(sheetDays(s))).toEqual(['road', 'site', 'off', 'site', 'site'])
    s = setSheetRange(s, '2026-11-30', '2026-12-04')
    expect(kinds(sheetDays(s))).toEqual(['site', 'road', 'site', 'off', 'site'])
    expect(Object.keys(s.shared)).not.toContain('2026-12-05')
  })

  it('stops a range at the cap', () => {
    const long = setSheetRange(start, '2026-01-01', '2026-12-31')
    expect(sheetDays(long)).toHaveLength(TRIP_SHEET_MAX_DAYS)
  })

  it('says where the trip would stand if saved now', () => {
    const one = addSheetPerson(start, dana)
    expect(sheetStanding(one, fresh, TODAY)).toBe('out')
    expect(sheetStanding(setSheetRange(one, '2026-12-01', '2026-12-05'), fresh, TODAY)).toBe('planned')
    expect(sheetStanding(setSheetRange(one, '2026-10-01', '2026-10-02'), fresh, TODAY)).toBe('back')
  })
})

describe('who went', () => {
  const start = sheetFromRecord(fresh, TODAY)

  it('adds a roster person, or someone not in the app by name, and nobody twice', () => {
    let s = addSheetPerson(start, dana)
    s = addSheetPerson(s, { name: ' Walt (sub) ' })
    s = addSheetPerson(s, { name: 'dana' })
    s = addSheetPerson(s, { name: '   ' })
    expect(s.people).toEqual([
      { personId: 'p-dana', userId: 'u-dana', name: 'Dana', own: null },
      { personId: null, userId: null, name: 'Walt (sub)', own: null },
    ])
    expect(removeSheetPerson(s, 0).people.map((p) => p.name)).toEqual(['Walt (sub)'])
  })

  it('offers the roster people who are not on the trip yet', () => {
    const s = addSheetPerson(start, dana)
    expect(sheetRosterLeft(s, [dana, luis]).map((p) => p.name)).toEqual(['Luis'])
  })
})

describe('one person with their own days', () => {
  let s = setSheetRange(setSheetRange(sheetFromRecord(fresh, TODAY), '2026-12-01', '2026-12-01'), '2026-12-01', '2026-12-03')
  s = addSheetPerson(addSheetPerson(s, dana), luis)

  it('starts everyone on the trip’s days, and a tap on a person’s day makes days of their own', () => {
    expect(s.people.every((p) => p.own === null)).toBe(true)
    const own = tapSheetPersonDay(s, 1, '2026-12-01')
    expect(kinds(sheetPersonDays(own, own.people[1]!))).toEqual(['road', 'site', 'site'])
    expect(kinds(sheetPersonDays(own, own.people[0]!))).toEqual(['site', 'site', 'site'])
    expect(recordFromSheet(own, fresh).people.map((p) => p.days['2026-12-01'])).toEqual(['site', 'road'])
  })

  it('a tap on the trip’s days leaves a person’s own days alone, and they can take the trip’s days back', () => {
    const own = tapSheetDay(tapSheetPersonDay(s, 1, '2026-12-01'), '2026-12-03')
    expect(recordFromSheet(own, fresh).people.map((p) => p.days['2026-12-03'])).toEqual(['road', 'site'])
    expect(recordFromSheet(clearSheetPersonDays(own, 1), fresh).people.map((p) => p.days['2026-12-03'])).toEqual(['road', 'road'])
  })
})

describe('a kept trip', () => {
  const kept: TripRecord = {
    ...newTripRecord({ id: 't5', developmentId: 'd1' }),
    purpose: 'Lift stations before the pour', askedBy: 'us', billing: 'inside', jobIds: ['j1'],
    people: [
      { personId: 'p-dana', userId: 'u-dana', name: 'Dana', days: { '2026-10-30': 'road', '2026-10-31': 'site', '2026-11-01': 'road' } },
      { personId: 'p-luis', userId: null, name: 'Luis', days: { '2026-10-30': 'road', '2026-10-31': 'site', '2026-11-01': 'road' } },
      { personId: null, userId: null, name: 'Omar', days: { '2026-10-29': 'ready', '2026-10-30': 'road', '2026-10-31': 'site' } },
    ],
  }
  const s = sheetFromRecord(kept, TODAY)

  it('reads the days most people share as the trip’s, and the rest as a person’s own', () => {
    expect([s.first, s.last]).toEqual(['2026-10-29', '2026-11-01'])
    expect(kinds(sheetDays(s))).toEqual(['off', 'road', 'site', 'road'])
    expect(s.people.map((p) => [p.name, p.own === null])).toEqual([['Dana', true], ['Luis', true], ['Omar', false]])
  })

  it('saves back what it opened on, unchanged', () => {
    expect(recordFromSheet(s, kept)).toEqual(kept)
  })

  it('opens More by itself when anything under it is filled', () => {
    expect(sheetHasMore(s)).toBe(true)
    expect(sheetHasMore(sheetFromRecord(fresh, TODAY))).toBe(false)
  })

  it('drops a person’s own days that leave the range', () => {
    const shorter = setSheetRange(s, '2026-10-30', '2026-11-01')
    expect(recordFromSheet(shorter, kept).people.find((p) => p.name === 'Omar')?.days).toEqual({ '2026-10-30': 'road', '2026-10-31': 'site' })
  })
})
