import { describe, expect, it } from 'vitest'
import { mapsUrlFor, subPortalDayCountWord, subPortalDayItems, subPortalMonthCells, subPortalOffDayCollisions, type SubPortalDays } from './subPortalDays'

const DAYS: SubPortalDays = {
  bookings: [
    { start: '2026-09-09', end: '2026-09-10', label: 'Rough-in · #1004', address: '2210 Goforth Rd, Kyle', jobNumber: '1004', source: 'pick', commitmentId: 'c1', note: null },
    { start: '2026-09-10', end: '2026-09-10', label: '#1017', address: '415 Bunton Creek Rd, Kyle', jobNumber: '1017', source: 'office', commitmentId: null, note: 'morning · about 3 hours' },
    { start: '2026-09-11', end: '2026-09-12', label: 'Trim · #1009', address: '88 Mission Hills Dr, Buda', jobNumber: '1009', source: 'office', commitmentId: null, note: null },
    { start: 'bad', end: 'bad', label: 'junk', address: null, jobNumber: null, source: 'office', commitmentId: null, note: null },
  ],
  offDays: ['2026-09-15', 'nope'],
}

describe('subPortalDays', () => {
  it('lists a day with picks first', () => {
    const d = subPortalDayItems(DAYS, '2026-09-10')
    expect(d.map((i) => `${i.source}:${i.label}`)).toEqual(['pick:Rough-in · #1004', 'office:#1017'])
    expect(d[1]!.note).toBe('morning · about 3 hours')
    expect(subPortalDayItems(DAYS, '2026-09-08')).toEqual([])
  })

  it('builds weekday cells from the Monday on or before the start', () => {
    const rows = subPortalMonthCells(DAYS, '2026-09-09', 2, '2026-09-09')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.map((c) => c.day)).toEqual(['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'])
    expect(rows[0]![0]!.past).toBe(true)
    expect(rows[0]![2]!.past).toBe(false)
    expect(rows[0]![3]!.items).toHaveLength(2)
    expect(rows[1]![1]!.off).toBe(true) // Sep 15
    expect(rows[1]![1]!.items).toEqual([])
    expect(rows[0]!.every((c) => c.inMonth)).toBe(true)
  })

  it('words the count', () => {
    expect(subPortalDayCountWord(1, 'en')).toBe('one job')
    expect(subPortalDayCountWord(2, 'en')).toBe('two jobs')
    expect(subPortalDayCountWord(2, 'es')).toBe('dos trabajos')
    expect(subPortalDayCountWord(7, 'en')).toBe('7 jobs')
    expect(subPortalDayCountWord(0, 'en')).toBe('')
  })

  it('names the picks a day off would collide with', () => {
    expect(subPortalOffDayCollisions(DAYS, '2026-09-10').map((i) => i.label)).toEqual(['Rough-in · #1004'])
    expect(subPortalOffDayCollisions(DAYS, '2026-09-11')).toEqual([])
  })

  it('links the address to Maps', () => {
    expect(mapsUrlFor('2210 Goforth Rd, Kyle')).toBe('https://maps.apple.com/?q=2210%20Goforth%20Rd%2C%20Kyle')
  })
})
