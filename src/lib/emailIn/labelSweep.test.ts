import { describe, expect, it } from 'vitest'
import { ageDays, dayRow, planSweep, threadSeen, type GmailThreadMeta } from './labelSweep'

// Made-up threads from a made-up box. Dates are the app's calendar (America/Chicago).
const ms = (iso: string) => String(new Date(iso).getTime())
const NOW = '2026-10-23T14:55:00.000Z' // Fri Oct 23, 9:55 AM Chicago

describe('threadSeen: what the table keeps of one thread', () => {
  it('reads the first message for the arrival, the sender and the subject, and the last for the latest activity', () => {
    const t: GmailThreadMeta = {
      id: 'thr-1',
      messages: [
        { id: 'm2', internalDate: ms('2026-10-20T16:00:00Z'), payload: { headers: [{ name: 'From', value: 'Marisol <marisol@clickplumbing.example>' }, { name: 'Subject', value: 'Re: Lot 7 — final waivers' }] } },
        { id: 'm1', internalDate: ms('2026-10-17T15:10:00Z'), payload: { headers: [{ name: 'from', value: 'Ridgeway Builders <ap@ridgeway.example>' }, { name: 'subject', value: 'Lot 7 — final waivers' }] } },
      ],
    }
    expect(threadSeen(t)).toEqual({
      gmailThreadId: 'thr-1',
      arrivedAt: '2026-10-17T15:10:00.000Z',
      lastAt: '2026-10-20T16:00:00.000Z',
      fromName: 'Ridgeway Builders',
      fromAddress: 'ap@ridgeway.example',
      subject: 'Lot 7 — final waivers',
    })
  })

  it('keeps nothing it cannot read: no messages, no dates, no From', () => {
    expect(threadSeen({ id: 'thr-2' })).toEqual({ gmailThreadId: 'thr-2', arrivedAt: null, lastAt: null, fromName: null, fromAddress: null, subject: '' })
    expect(threadSeen({ id: 'thr-3', messages: [{ id: 'm', payload: { headers: [{ name: 'Subject', value: ' Toll bill ' }] } }] })).toEqual({
      gmailThreadId: 'thr-3',
      arrivedAt: null,
      lastAt: null,
      fromName: null,
      fromAddress: null,
      subject: 'Toll bill',
    })
  })
})

describe('planSweep: which threads to fetch, which are gone, which are still there', () => {
  const known = [
    { gmailThreadId: 'a', gone: false },
    { gmailThreadId: 'b', gone: false },
    { gmailThreadId: 'c', gone: true },
  ]

  it('fetches the new and the returned, keeps the still, and marks the unlisted open ones gone on a complete listing', () => {
    expect(planSweep(['a', 'c', 'd', 'd'], known, true)).toEqual({ fetch: ['c', 'd'], gone: ['b'], still: ['a'] })
  })

  it('marks nothing gone when the listing was cut short at the page cap', () => {
    expect(planSweep(['a', 'd'], known, false)).toEqual({ fetch: ['d'], gone: [], still: ['a'] })
  })

  it('on a first sweep fetches everything, and on an empty label clears everything', () => {
    expect(planSweep(['x', 'y'], [], true)).toEqual({ fetch: ['x', 'y'], gone: [], still: [] })
    expect(planSweep([], known, true)).toEqual({ fetch: [], gone: ['a', 'b'], still: [] })
  })
})

describe('ageDays: whole civil days since a thread arrived', () => {
  it('counts the app calendar days, never below zero, and null with no arrival', () => {
    expect(ageDays('2026-10-17T15:10:00Z', NOW)).toBe(6)
    expect(ageDays('2026-10-23T03:00:00Z', NOW)).toBe(1) // 10 PM Thursday in Chicago: yesterday
    expect(ageDays('2026-10-23T13:00:00Z', NOW)).toBe(0)
    expect(ageDays('2026-10-24T13:00:00Z', NOW)).toBe(0)
    expect(ageDays(null, NOW)).toBeNull()
  })
})

describe('dayRow: one day of the trend', () => {
  it('counts the open threads, the oldest, and what came and cleared that day', () => {
    const threads = [
      { arrivedAt: '2026-10-11T12:00:00Z', firstSeenAt: '2026-10-12T12:00:00Z', goneAt: null },
      { arrivedAt: '2026-10-17T15:10:00Z', firstSeenAt: '2026-10-17T15:15:00Z', goneAt: null },
      { arrivedAt: '2026-10-22T20:00:00Z', firstSeenAt: '2026-10-23T14:00:00Z', goneAt: null },
      { arrivedAt: null, firstSeenAt: '2026-10-23T14:30:00Z', goneAt: null },
      { arrivedAt: '2026-10-19T12:00:00Z', firstSeenAt: '2026-10-19T12:00:00Z', goneAt: '2026-10-23T14:50:00Z' },
      { arrivedAt: '2026-10-18T12:00:00Z', firstSeenAt: '2026-10-18T12:00:00Z', goneAt: '2026-10-22T14:50:00Z' },
    ]
    expect(dayRow(threads, NOW)).toEqual({ count: 4, oldestDays: 12, newCount: 2, clearedCount: 1 })
    expect(dayRow([], NOW)).toEqual({ count: 0, oldestDays: null, newCount: 0, clearedCount: 0 })
  })
})
