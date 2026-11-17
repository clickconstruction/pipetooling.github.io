import { describe, expect, it } from 'vitest'
import { newTripRecord, NO_TRIP_PEOPLE, tripFromRow, tripOfRecord, tripPeopleIndex, tripPersonKey, tripProblem, tripSavePayload, type TripRecord, type TripRow } from './tripRecord'

// Every name here is made up.
const row: TripRow = {
  id: 't1', development_id: 'd1', job_id: null, purpose: 'Lift stations before the pour', asked_by: 'them', asked_who: 'Ray, the site super', asked_how: 'by phone, Oct 20',
  outcome: '', billing: 'inside', via: 'app', created_at: '2026-10-20T15:00:00Z',
  trip_people: [
    { person_id: null, user_id: null, person_name: 'Walt (sub)', days: { '2026-10-31': 'site', '2026-11-01': 'site' } },
    { person_id: 'p-luis', user_id: 'u-luis', person_name: 'Luis', days: { '2026-10-30': 'road', '2026-10-31': 'site', bad: 'site', '2026-11-02': 'home' } },
  ],
  trip_jobs: [{ job_id: 'j1' }],
}

describe('a kept trip, read back', () => {
  const t = tripFromRow(row)

  it('reads the row with its people in name order and its jobs', () => {
    expect(t).toMatchObject({ id: 't1', developmentId: 'd1', jobId: null, purpose: 'Lift stations before the pour', askedBy: 'them', billing: 'inside', jobIds: ['j1'] })
    expect(t.people.map((p) => p.name)).toEqual(['Luis', 'Walt (sub)'])
  })

  it('drops a day that is not a day, and a kind that is not one of the three', () => {
    expect(t.people[0]?.days).toEqual({ '2026-10-30': 'road', '2026-10-31': 'site' })
  })

  it('reads words it does not know as nobody having said', () => {
    const odd = tripFromRow({ ...row, asked_by: 'someone', billing: 'free', trip_people: null, trip_jobs: null, purpose: null })
    expect(odd).toMatchObject({ askedBy: null, billing: null, people: [], jobIds: [], purpose: '' })
  })
})

describe('what the save takes', () => {
  const base: TripRecord = { ...newTripRecord({ id: 't9', developmentId: 'd1' }), purpose: '  Trim-out  ', askedBy: 'us', askedWho: 'left over', askedHow: 'left over', jobIds: ['j1', 'j1'], people: [{ personId: 'p1', userId: 'u1', name: ' Dana ', days: { '2026-12-01': 'road' } }, { personId: null, userId: null, name: '  ', days: {} }] }

  it('sends the trip whole under its own id, trimmed, with a job once and no nameless person', () => {
    expect(tripSavePayload(base)).toEqual({
      id: 't9', development_id: 'd1', job_id: null, purpose: 'Trim-out', asked_by: 'us', asked_who: '', asked_how: '', outcome: '', billing: null, via: 'app',
      people: [{ person_id: 'p1', user_id: 'u1', name: 'Dana', days: { '2026-12-01': 'road' } }],
      job_ids: ['j1'],
    })
  })

  it('keeps who and how only when they asked', () => {
    expect(tripSavePayload({ ...base, askedBy: 'them', askedWho: ' Ray ', askedHow: ' by email ' })).toMatchObject({ asked_by: 'them', asked_who: 'Ray', asked_how: 'by email' })
  })
})

describe('why a trip cannot save yet', () => {
  const person = (name: string, days: Record<string, 'site'> = { '2026-12-01': 'site' }) => ({ personId: null, userId: null, name, days })

  it('needs someone, then a day, and nothing else', () => {
    expect(tripProblem({ people: [] })).toBe('Add who went.')
    expect(tripProblem({ people: [person('Dana', {})] })).toBe('Pick at least one day.')
    expect(tripProblem({ people: [person('Dana')] })).toBeNull()
  })

  it('says when one name is on it twice', () => {
    expect(tripProblem({ people: [person('Dana'), person(' dana ')] })).toBe('dana is on this trip twice.')
  })
})

describe('one person, three names', () => {
  const index = tripPeopleIndex([
    { id: 'p-luis', name: 'Luis Ortega', userId: 'u-luis' },
    { id: 'p-ana', name: 'Ana Reyes', userId: null },
    { id: 'p-sam1', name: 'Sam Lee', userId: null },
    { id: 'p-sam2', name: 'sam lee', userId: null },
  ])

  it('reaches the roster person by their id, their login or their name', () => {
    expect(tripPersonKey(index, { personId: 'p-luis' })).toBe('p:p-luis')
    expect(tripPersonKey(index, { userId: 'u-luis' })).toBe('p:p-luis')
    expect(tripPersonKey(index, { name: ' luis ortega ' })).toBe('p:p-luis')
    expect(tripPersonKey(index, { name: 'Ana Reyes' })).toBe('p:p-ana')
  })

  it('falls back to the login, then to the name as written', () => {
    expect(tripPersonKey(index, { userId: 'u-nobody', name: 'Nobody' })).toBe('u:u-nobody')
    expect(tripPersonKey(index, { name: 'Walt (sub)' })).toBe('n:walt (sub)')
  })

  it('does not guess between two roster people with one name', () => {
    expect(tripPersonKey(index, { name: 'Sam Lee' })).toBe('n:sam lee')
  })

  it('reads a kept trip with each person under their one key', () => {
    const t = tripOfRecord(tripFromRow(row), index)
    expect(t.people.map((p) => p.personKey)).toEqual(['p:p-luis', 'n:walt (sub)'])
    expect(tripOfRecord(tripFromRow(row), NO_TRIP_PEOPLE).people[0]?.personKey).toBe('p:p-luis')
  })
})
