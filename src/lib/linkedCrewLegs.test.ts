import { describe, expect, it } from 'vitest'
import { formatLinkedCrewWorkDate, groupLinkedCrewLegs, linkedCrewLegKey } from './linkedCrewLegs'

const block = (over: Partial<Parameters<typeof linkedCrewLegKey>[0]> & { id?: string } = {}) => ({
  id: 'b1',
  job_id: 'job-a',
  work_date: '2026-08-05',
  time_start: '08:00',
  time_end: '10:00',
  ...over,
})

describe('groupLinkedCrewLegs', () => {
  it('groups same-leg blocks together and preserves row order', () => {
    const rows = [block({ id: 'b1' }), block({ id: 'b2' }), block({ id: 'b3' })]
    const legs = groupLinkedCrewLegs(rows)
    expect(legs).toHaveLength(1)
    expect(legs[0]!.rows.map((r) => r.id)).toEqual(['b1', 'b2', 'b3'])
    expect(legs[0]!.jobId).toBe('job-a')
    expect(legs[0]!.workDate).toBe('2026-08-05')
  })

  it('splits multi-day crews into one leg per day, sorted by date then start time', () => {
    const rows = [
      block({ id: 'd2', work_date: '2026-08-06' }),
      block({ id: 'd1' }),
      block({ id: 'd1b' }),
      block({ id: 'late', work_date: '2026-08-06', time_start: '13:00', time_end: '15:00' }),
    ]
    const legs = groupLinkedCrewLegs(rows)
    expect(legs.map((l) => `${l.workDate} ${l.timeStart}`)).toEqual([
      '2026-08-05 08:00',
      '2026-08-06 08:00',
      '2026-08-06 13:00',
    ])
    expect(legs[0]!.rows.map((r) => r.id)).toEqual(['d1', 'd1b'])
  })

  it('separates different jobs at the same date and window', () => {
    const rows = [block({ id: 'a' }), block({ id: 'b', job_id: 'job-b' })]
    const legs = groupLinkedCrewLegs(rows)
    expect(legs).toHaveLength(2)
    expect(legs.map((l) => l.jobId)).toEqual(['job-a', 'job-b'])
  })

  it('returns an empty array for no rows', () => {
    expect(groupLinkedCrewLegs([])).toEqual([])
  })
})

describe('linkedCrewLegKey', () => {
  it('matches the add-person leg identity', () => {
    expect(linkedCrewLegKey(block())).toBe('job-a|2026-08-05|08:00|10:00')
  })
})

describe('formatLinkedCrewWorkDate', () => {
  it('formats a plain date with weekday, no timezone shift', () => {
    expect(formatLinkedCrewWorkDate('2026-08-05')).toBe('Wed, Aug 5')
    expect(formatLinkedCrewWorkDate('2026-01-01')).toBe('Thu, Jan 1')
  })

  it('passes malformed input through unchanged', () => {
    expect(formatLinkedCrewWorkDate('not-a-date')).toBe('not-a-date')
    expect(formatLinkedCrewWorkDate('')).toBe('')
  })
})
