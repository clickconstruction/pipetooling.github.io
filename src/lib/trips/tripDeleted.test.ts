/**
 * Deleted trips, kept: what `trip_deleted_list` answers, read into trips ready for their own save, and each said in
 * words for the fold. Heron Point's made-up trips.
 */
import { describe, expect, it } from 'vitest'
import { tripSavePayload } from './tripRecord'
import { deletedTripGoneWords, deletedTripLine, deletedTripLines, parseDeletedTrips, TRIP_DELETE_KEPT_WORDS, TRIP_DELETED_KEEP_DAYS, TRIP_DELETED_NOTE } from './tripDeleted'

const TODAY = '2026-11-18'
const toYmd = (iso: string) => iso.slice(0, 10)

const ITEM = {
  deleted_at: '2026-11-18T16:20:00.000Z',
  deleted_by_name: 'Dana Office',
  jobs_gone: 0,
  trip: {
    id: 't3',
    trip_number: 3,
    development_id: 'd1',
    job_id: null,
    purpose: 'Reset the riser the framers moved',
    asked_by: 'them',
    asked_who: 'Walt, the super',
    asked_how: 'by phone',
    outcome: '',
    billing: 'extra',
    via: 'app',
    created_at: '2026-11-12T15:00:00.000Z',
    trip_people: [
      { person_id: null, user_id: 'u-luis', person_name: 'Luis', days: { '2026-11-09': 'site', '2026-11-10': 'site', '2026-11-11': 'site' } },
      { person_id: null, user_id: null, person_name: 'Priya', days: { '2026-11-09': 'site' } },
    ],
    trip_jobs: [{ job_id: 'j1' }],
  },
}

describe('parseDeletedTrips', () => {
  it('reads a deleted trip whole, with who deleted it and when', () => {
    const [d] = parseDeletedTrips([ITEM])
    expect(d?.deletedAt).toBe('2026-11-18T16:20:00.000Z')
    expect(d?.deletedByName).toBe('Dana Office')
    expect(d?.jobsGone).toBe(0)
    expect(d?.record).toMatchObject({ id: 't3', tripNumber: 3, developmentId: 'd1', purpose: 'Reset the riser the framers moved', askedBy: 'them', askedWho: 'Walt, the super', askedHow: 'by phone', billing: 'extra', jobIds: ['j1'] })
    expect(d?.record.people.map((p) => `${p.name}:${p.userId ?? '-'}:${Object.keys(p.days).length}`)).toEqual(['Luis:u-luis:3', 'Priya:-:1'])
  })

  it('hands back a trip its own save takes: the same id and the number it had', () => {
    const [d] = parseDeletedTrips([ITEM])
    if (!d) throw new Error('no trip read')
    expect(tripSavePayload(d.record)).toMatchObject({ id: 't3', trip_number: 3, development_id: 'd1', billing: 'extra', job_ids: ['j1'] })
    expect((tripSavePayload(d.record).people as Array<{ name: string }>).map((p) => p.name)).toEqual(['Luis', 'Priya'])
  })

  it('keeps the order the database gave, newest delete first', () => {
    const older = { ...ITEM, deleted_at: '2026-11-02T10:00:00.000Z', trip: { ...ITEM.trip, id: 't1', trip_number: 1 } }
    expect(parseDeletedTrips([ITEM, older]).map((d) => d.record.id)).toEqual(['t3', 't1'])
  })

  it('passes over anything that is not a trip with an id, and reads nothing from a reply that is no list', () => {
    expect(parseDeletedTrips([null, 'x', {}, { trip: null }, { trip: { id: '' } }, { trip: { purpose: 'no id' } }])).toEqual([])
    expect(parseDeletedTrips(null)).toEqual([])
    expect(parseDeletedTrips({ trip: ITEM.trip })).toEqual([])
  })

  it('reads a thin entry: no name, no day, no people, no jobs', () => {
    const [d] = parseDeletedTrips([{ trip: { id: 't9' } }])
    expect(d).toMatchObject({ deletedAt: null, deletedByName: null, jobsGone: 0 })
    expect(d?.record).toMatchObject({ id: 't9', tripNumber: null, people: [], jobIds: [] })
  })

  it('drops a person with no name and a job with no id, and counts the jobs gone since', () => {
    const [d] = parseDeletedTrips([{ ...ITEM, jobs_gone: 2, trip: { ...ITEM.trip, trip_people: [...ITEM.trip.trip_people, { person_name: ' ' }, null], trip_jobs: [{ job_id: 'j1' }, { job_id: '' }, null] } }])
    expect(d?.record.people).toHaveLength(2)
    expect(d?.record.jobIds).toEqual(['j1'])
    expect(d?.jobsGone).toBe(2)
  })
})

describe('deletedTripLine', () => {
  const read = () => {
    const [d] = parseDeletedTrips([ITEM])
    if (!d) throw new Error('no trip read')
    return d
  }

  it('says the trip by its number and days, what for, who went, who deleted it and until when it is kept', () => {
    expect(deletedTripLine(read(), { todayYmd: TODAY, toYmd })).toEqual({
      id: 't3',
      name: 'Trip 3 · Nov 9 to 11',
      why: 'Reset the riser the framers moved',
      who: 'Luis, Priya',
      deleted: 'Deleted Nov 18 by Dana Office',
      kept: 'kept until Feb 16',
      gone: null,
      pressLabel: 'Put back Trip 3, Nov 9 to 11',
    })
  })

  it('keeps a trip the days the archive does', () => {
    expect(TRIP_DELETED_KEEP_DAYS).toBe(90)
    expect(TRIP_DELETED_NOTE).toContain('90 days')
    expect(TRIP_DELETE_KEPT_WORDS).toBe('After that it waits under Deleted trips for 90 days.')
  })

  it('says a trip on its last day goes within a day', () => {
    expect(deletedTripLine({ ...read(), deletedAt: '2026-08-20T12:00:00.000Z' }, { todayYmd: TODAY, toYmd }).kept).toBe('goes within a day')
    expect(deletedTripLine({ ...read(), deletedAt: '2026-08-21T12:00:00.000Z' }, { todayYmd: TODAY, toYmd }).kept).toBe('kept until Nov 19')
  })

  it('says less when less is known: nobody named, no day, no purpose', () => {
    const thin = { ...read(), deletedAt: null, deletedByName: null, record: { ...read().record, purpose: ' ' } }
    expect(deletedTripLine(thin, { todayYmd: TODAY, toYmd })).toMatchObject({ why: 'A trip', deleted: 'Deleted', kept: null })
    expect(deletedTripLine({ ...read(), deletedByName: null }, { todayYmd: TODAY, toYmd }).deleted).toBe('Deleted Nov 18')
    expect(deletedTripLine(read(), { todayYmd: TODAY, toYmd: () => '' })).toMatchObject({ deleted: 'Deleted by Dana Office', kept: null })
  })

  it('names a trip made before numbers by its days', () => {
    const old = { ...read(), record: { ...read().record, tripNumber: null } }
    expect(deletedTripLine(old, { todayYmd: TODAY, toYmd })).toMatchObject({ name: 'Nov 9 to 11', pressLabel: 'Put back Nov 9 to 11' })
  })

  it('says a job gone since, one or several', () => {
    expect(deletedTripGoneWords(0)).toBeNull()
    expect(deletedTripGoneWords(1)).toBe('A job it named is gone since.')
    expect(deletedTripGoneWords(3)).toBe('3 jobs it named are gone since.')
    expect(deletedTripLine({ ...read(), jobsGone: 1 }, { todayYmd: TODAY, toYmd }).gone).toBe('A job it named is gone since.')
  })

  it('says every trip of a list, in its order', () => {
    const older = { ...read(), record: { ...read().record, id: 't1', tripNumber: 1 } }
    expect(deletedTripLines([read(), older], { todayYmd: TODAY, toYmd }).map((l) => l.id)).toEqual(['t3', 't1'])
  })
})
