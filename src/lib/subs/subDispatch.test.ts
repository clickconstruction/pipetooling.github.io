import { describe, expect, it } from 'vitest'
import { buildSubBadgesByCell, buildSubLanes, subDispatchSpan, subOrderTouchesRange, subsOnDay, type SubDispatchOrder } from './subDispatch'
import { hubPersonDayKey } from '../scheduleDispatchHub'

const DAYS = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']
const base: SubDispatchOrder = {
  id: 'c1', personId: 'p-behar', personName: 'Behar Kraja', jobId: 'j-1004', jobLabel: '#1004 · 2210 Goforth Rd', status: 'accepted',
  pickedStart: '2026-09-09', pickedEnd: '2026-09-10', proposedStart: '2026-09-08', proposedEnd: '2026-09-19', windowStart: '2026-09-08', windowEnd: '2026-09-19', stageName: 'Rough-in', recordId: 'WO-1004-1',
}
const windowOnly: SubDispatchOrder = { ...base, id: 'c2', pickedStart: null, pickedEnd: null, stageName: 'Top-out', windowStart: '2026-09-10', windowEnd: '2026-09-18', proposedStart: null, proposedEnd: null }
const offered: SubDispatchOrder = { ...windowOnly, id: 'c3', status: 'offered', personId: 'p-mig', personName: 'Miguel Rodriguez', jobId: 'j-1009', jobLabel: '#1009 · 88 Mission Hills Dr', stageName: null }

describe('subDispatch', () => {
  it('reads a pick as definite, a window as a maybe, an offer as dashed, and nothing for closed orders', () => {
    expect(subDispatchSpan(base)).toEqual({ start: '2026-09-09', end: '2026-09-10', kind: 'pick' })
    expect(subDispatchSpan(windowOnly)).toEqual({ start: '2026-09-10', end: '2026-09-18', kind: 'window' })
    expect(subDispatchSpan(offered)).toEqual({ start: '2026-09-10', end: '2026-09-18', kind: 'offered' })
    expect(subDispatchSpan({ ...base, status: 'settled' })).toBeNull()
    expect(subDispatchSpan({ ...windowOnly, windowStart: null, windowEnd: null })).toBeNull()
    // an offer that somehow carries a pick still reads as an offer (nothing is signed)
    expect(subDispatchSpan({ ...base, status: 'offered' })?.kind).toBe('offered')
  })

  it('builds one lane per sub across the visible days', () => {
    const lanes = buildSubLanes([base, windowOnly, offered], DAYS)
    expect(lanes.map((l) => l.name)).toEqual(['Behar Kraja', 'Miguel Rodriguez'])
    const behar = lanes[0]!
    expect(behar.total).toBe(2)
    expect(behar.cells.get('2026-09-09')?.map((i) => i.kind)).toEqual(['pick'])
    expect(behar.cells.get('2026-09-10')?.map((i) => i.kind)).toEqual(['pick', 'window'])
    expect(behar.cells.get('2026-09-07')).toBeUndefined()
    expect(behar.cells.get('2026-09-11')?.[0]?.label).toBe('Top-out · #1004 · 2210 Goforth Rd')
    expect(lanes[1]!.cells.get('2026-09-11')?.[0]?.kind).toBe('offered')
    // a sub with nothing this week has no lane
    expect(buildSubLanes([{ ...base, pickedStart: '2026-10-05', pickedEnd: '2026-10-06' }], DAYS)).toEqual([])
  })

  it('badges only the crew assigned to the job, only on picked days', () => {
    const team = new Map([['j-1004', ['u-robert']], ['j-1009', ['u-malachi']]])
    const badges = buildSubBadgesByCell([base, windowOnly, offered], team, DAYS)
    expect(badges.get(hubPersonDayKey('u-robert', '2026-09-09'))).toEqual({ count: 1, titles: ['Rough-in · #1004 · 2210 Goforth Rd · Behar Kraja'] })
    expect(badges.get(hubPersonDayKey('u-robert', '2026-09-10'))?.count).toBe(1) // the window does not badge
    expect(badges.get(hubPersonDayKey('u-robert', '2026-09-11'))).toBeUndefined()
    expect(badges.get(hubPersonDayKey('u-malachi', '2026-09-10'))).toBeUndefined() // offer, not a pick
    expect(badges.size).toBe(2)
  })

  it('lists the subs on a day, picks first', () => {
    const d = subsOnDay([base, windowOnly, offered], '2026-09-10')
    expect(d.definite.map((i) => i.personName)).toEqual(['Behar Kraja'])
    expect(d.maybe.map((i) => `${i.personName}:${i.span.kind}`)).toEqual(['Behar Kraja:window', 'Miguel Rodriguez:offered'])
    expect(subsOnDay([base], '2026-09-08').definite).toEqual([])
  })

  it('filters by range touch', () => {
    expect(subOrderTouchesRange(base, '2026-09-07', '2026-09-11')).toBe(true)
    expect(subOrderTouchesRange(base, '2026-09-11', '2026-09-15')).toBe(false)
    expect(subOrderTouchesRange({ ...base, status: 'cancelled' }, '2026-09-07', '2026-09-11')).toBe(false)
  })
})
