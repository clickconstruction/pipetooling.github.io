import { describe, expect, it } from 'vitest'
import { stagesLaborBreakdownByJobId, stagesManHoursByJobId } from './stagesManHours'

const rows = [
  { job_id: 'j1', person_name: 'Abraham', man_hours: 12.5 },
  { job_id: 'j1', person_name: 'Miguel', man_hours: '20' },
  { job_id: 'j2', person_name: 'Abraham', man_hours: 4 },
  { job_id: 'j1', person_name: 'Tristen', man_hours: null },
]

describe('stagesManHoursByJobId', () => {
  it('sums each job’s rows; a string is a number and a null is 0', () => {
    const m = stagesManHoursByJobId(rows)
    expect(m.get('j1')).toBe(32.5)
    expect(m.get('j2')).toBe(4)
    expect(m.has('j3')).toBe(false)
  })
  it('is empty for no rows', () => {
    expect(stagesManHoursByJobId([]).size).toBe(0)
  })
})

describe('stagesLaborBreakdownByJobId', () => {
  it('lists each job’s people most hours first, the null-hour person last at 0', () => {
    const m = stagesLaborBreakdownByJobId(rows)
    expect(m.get('j1')).toEqual([
      { personName: 'Miguel', hours: 20 },
      { personName: 'Abraham', hours: 12.5 },
      { personName: 'Tristen', hours: 0 },
    ])
    expect(m.get('j2')).toEqual([{ personName: 'Abraham', hours: 4 }])
  })
  it('the breakdown’s hours add up to the total', () => {
    const totals = stagesManHoursByJobId(rows)
    for (const [jobId, entries] of stagesLaborBreakdownByJobId(rows)) {
      expect(entries.reduce((s, e) => s + e.hours, 0)).toBe(totals.get(jobId))
    }
  })
})
