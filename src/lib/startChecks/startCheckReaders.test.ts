import { describe, expect, it } from 'vitest'
import { PERMITS_HREF, READER_WORDS as W, READS_CHOICES, orderLogHref, readOrderLog, readPermit, readTrip, readerFor, readsLabel, readsWanted, tripsHref, type OrderLine, type OrderLogRead } from './startCheckReaders'
import type { StageLine, StartBulletRow } from './startCheckRows'

const line = (over: Partial<OrderLine> = {}): OrderLine => ({ stage: 'rough_in', orderedOn: null, expectedOn: null, deliveredOn: null, ...over })
const log = (lines: OrderLine[]): OrderLogRead => ({ state: 'read', bidId: 'bid-1', lines })
const DAY_ONE = '2026-12-01'

describe('a bullet of ours reads the order log', () => {
  it('reads open, in words, where there is nothing to read', () => {
    expect(readOrderLog(undefined, 'Rough In', DAY_ONE)).toEqual({ ok: false, fact: W.reading, door: '', href: null })
    expect(readOrderLog({ state: 'no_bid' }, 'Rough In', DAY_ONE).fact).toBe(W.noBid)
    expect(readOrderLog({ state: 'cannot' }, 'Rough In', DAY_ONE).fact).toBe(W.orderShut)
    expect(readOrderLog(log([line()]), 'Camera the sewer', DAY_ONE)).toEqual({ ok: false, fact: W.noStageName, door: W.orderDoor, href: orderLogHref('bid-1') })
    expect(readOrderLog(log([line({ stage: 'trim_set' }), line({ stage: null })]), 'Rough In', DAY_ONE).fact).toBe(W.noLines)
  })

  it('is ready when every line of the stage is on site, and counts no other stage', () => {
    const read = log([line({ deliveredOn: '2026-11-20' }), line({ deliveredOn: '2026-11-21' }), line({ stage: 'top_out' })])
    expect(readOrderLog(read, 'Rough-in', DAY_ONE)).toEqual({ ok: true, fact: 'All 2 lines are on site.', door: W.orderDoor, href: orderLogHref('bid-1') })
    expect(readOrderLog(log([line({ deliveredOn: '2026-11-20' })]), 'Rough In', null).fact).toBe('The one line is on site.')
  })

  it('is open while a line has no order, or no day to land', () => {
    const read = log([line({ deliveredOn: '2026-11-20' }), line(), line()])
    expect(readOrderLog(read, 'Rough In', DAY_ONE)).toMatchObject({ ok: false, fact: '2 of 3 lines are not ordered yet.' })
    expect(readOrderLog(log([line({ orderedOn: '2026-11-10' })]), 'Rough In', DAY_ONE).fact).toBe('1 of 1 line has no day to land yet.')
  })

  it('is ready when the last line lands before the first day, and says how far ahead', () => {
    const read = log([line({ deliveredOn: '2026-11-20' }), line({ orderedOn: '2026-11-10', expectedOn: '2026-11-25' }), line({ orderedOn: '2026-11-10', expectedOn: '2026-11-22' })])
    expect(readOrderLog(read, 'Rough In', DAY_ONE)).toMatchObject({ ok: true, fact: '1 of 3 lines on site. The last lands Nov 25, 6 days ahead.' })
    expect(readOrderLog(log([line({ orderedOn: '2026-11-10', expectedOn: '2026-11-30' })]), 'Rough In', DAY_ONE).fact).toBe('0 of 1 line on site. The last lands Nov 30, 1 day ahead.')
  })

  it('is open when a line lands on the first day or after it, across a month end', () => {
    const read = log([line({ orderedOn: '2026-11-10', expectedOn: '2026-11-25' }), line({ orderedOn: '2026-11-10', expectedOn: '2026-12-01' }), line({ orderedOn: '2026-11-10', expectedOn: '2026-12-03' })])
    expect(readOrderLog(read, 'Rough In', DAY_ONE)).toMatchObject({ ok: false, fact: '2 of 3 lines land on the first day or after it. The last lands Dec 3.' })
    expect(readOrderLog(log([line({ orderedOn: '2026-11-10', expectedOn: '2026-12-01' })]), 'Rough In', DAY_ONE).fact).toBe('1 of 1 line lands on the first day or after it. The last lands Dec 1.')
  })

  it('cannot tell without our days unless everything is on site', () => {
    expect(readOrderLog(log([line({ orderedOn: '2026-11-10', expectedOn: '2026-11-25' })]), 'Rough In', null).fact).toBe(W.noDays)
  })
})

describe('a bullet of ours reads the trip', () => {
  const trips = (list: Array<{ first: string | null; last: string | null; people: string[]; name?: string }>) => ({ state: 'read' as const, developmentId: 'dev-1', trips: list.map((t, i) => ({ id: `t${i}`, name: t.name ?? `Trip ${i + 1}`, first: t.first, last: t.last, people: t.people })) })

  it('is ready when a trip with people on it covers the first day', () => {
    expect(readTrip(trips([{ first: '2026-11-30', last: '2026-12-04', people: ['Ana', 'Bo', 'Cy'] }]), DAY_ONE)).toEqual({ ok: true, fact: 'Trip 1: Ana, Bo and Cy, Nov 30 to Dec 4.', door: W.tripDoor, href: tripsHref('dev-1') })
    expect(readTrip(trips([{ first: '2026-12-01', last: '2026-12-01', people: ['Ana'] }]), DAY_ONE).ok).toBe(true)
  })

  it('is open with no trip on the first day, a trip nobody is on, or no days of ours', () => {
    expect(readTrip(trips([{ first: '2026-12-02', last: '2026-12-04', people: ['Ana'] }, { first: null, last: null, people: ['Bo'] }]), DAY_ONE)).toMatchObject({ ok: false, fact: W.noTrip, door: W.tripDoor })
    expect(readTrip(trips([{ first: '2026-11-30', last: '2026-12-04', people: [] }]), DAY_ONE).fact).toBe('Trip 1 has nobody on it yet.')
    expect(readTrip(trips([]), null).fact).toBe(W.noDays)
  })

  it('says so when the seat cannot read trips, or the job is on no development', () => {
    expect(readTrip({ state: 'cannot' }, DAY_ONE)).toEqual({ ok: false, fact: W.tripShut, door: '', href: null })
    expect(readTrip({ state: 'no_site' }, DAY_ONE).fact).toBe(W.noSite)
    expect(readTrip(undefined, DAY_ONE).fact).toBe(W.reading)
  })
})

describe('a bullet of ours reads the permit', () => {
  it('is ready on an issued plumbing permit in our name, the earliest one', () => {
    const read = { state: 'read' as const, permits: [{ number: 'P-200', issued: true, issuedOn: '2026-11-09' }, { number: 'P-100', issued: true, issuedOn: '2026-11-03' }, { number: 'P-300', issued: false, issuedOn: null }] }
    expect(readPermit(read)).toEqual({ ok: true, fact: 'Plumbing permit P-100 was issued Nov 3.', door: W.permitDoor, href: PERMITS_HREF })
    expect(readPermit({ state: 'read', permits: [{ number: 'P-1', issued: true, issuedOn: null }] }).fact).toBe('Plumbing permit P-1 is issued.')
  })

  it('is open while it is applied for, or none shows', () => {
    expect(readPermit({ state: 'read', permits: [{ number: 'P-300', issued: false, issuedOn: null }] })).toMatchObject({ ok: false, fact: 'Plumbing permit P-300 is applied for and not issued yet.' })
    expect(readPermit({ state: 'read', permits: [] }).fact).toBe(W.noPermit)
  })

  it('says so where there are no records to read, or the seat cannot read them', () => {
    expect(readPermit({ state: 'no_records' })).toEqual({ ok: false, fact: W.noRecords, door: '', href: null })
    expect(readPermit({ state: 'cannot' }).fact).toBe(W.permitShut)
  })
})

describe('the seam a list is built with', () => {
  const bullet = (over: Partial<StartBulletRow>): StartBulletRow => ({ id: 'b', job_id: 'job-1', fixture_id: 'fx-1', sort_order: 1, words: 'Ours', waits_on: 'us', wants_photo: false, shown_to_gc: false, by_day: null, reads: 'hand', hand_ok: false, hand_ok_at: null, hand_ok_by_name: '', template_id: null, removed_at: null, created_at: '2026-11-01T00:00:00Z', ...over }) as StartBulletRow
  const lines: StageLine[] = [{ fixtureId: 'fx-1', jobId: 'job-1', name: 'Rough In', order: 1, finished: false, window: [DAY_ONE, '2026-12-05'] }]

  it('asks only for the kinds a live bullet of ours uses', () => {
    const wanted = readsWanted([bullet({ reads: 'order_log' }), bullet({ reads: 'order_log', job_id: 'job-2' }), bullet({ reads: 'trip', removed_at: '2026-11-02T00:00:00Z' }), bullet({ reads: 'hand' }), bullet({ waits_on: 'them', reads: null })])
    expect(wanted).toEqual({ orderLog: ['job-1', 'job-2'], trips: [], permits: [] })
  })

  it('reads each bullet against its own stage line, leaves a hand tick alone, and says when a read failed', () => {
    const reader = readerFor(lines, new Map([['job-1', { orderLog: log([line({ deliveredOn: '2026-11-20' })]), trips: { state: 'read' as const, developmentId: 'dev-1', trips: [] } }]]))
    expect(reader(bullet({ reads: 'order_log' }))?.ok).toBe(true)
    expect(reader(bullet({ reads: 'trip' }))?.fact).toBe(W.noTrip)
    expect(reader(bullet({ reads: 'permit' }))?.fact).toBe(W.reading)
    expect(reader(bullet({ reads: 'hand' }))).toBeNull()
    expect(readerFor(lines, new Map([['job-1', { failed: true }]]))(bullet({ reads: 'trip' }))).toEqual({ ok: false, fact: W.failed, door: '', href: null })
  })

  it('names each choice in the words that follow "ours,"', () => {
    expect(READS_CHOICES.map((c) => c.value)).toEqual(['hand', 'order_log', 'trip', 'permit'])
    expect(readsLabel('order_log')).toBe('read from the order log')
    expect(readsLabel('hand')).toBe('ticked by hand')
  })
})
