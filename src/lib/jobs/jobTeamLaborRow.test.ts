import { describe, expect, it } from 'vitest'
import { buildJobTeamLaborRow, pendingSessionHours, roundHoursLabel } from './jobTeamLaborRow'

const day = (workDate: string, hours: number, cost: number) => ({ workDate, hours, cost })

describe('buildJobTeamLaborRow', () => {
  it('names a single salaried day: 8.0 h · one person, cost = hours × wage', () => {
    const row = buildJobTeamLaborRow([
      { personName: 'Malachi', hours: 8, cost: 461.84, byWorkDate: [day('2026-09-08', 8, 461.84)] },
    ])
    expect(row.totalCost).toBeCloseTo(461.84, 2)
    expect(row.totalHours).toBe(8)
    expect(row.summaryLabel).toBe('8.0 h · Malachi')
    expect(row.pendingLabel).toBeNull()
    expect(row.people).toEqual([{ personName: 'Malachi', hours: 8, cost: 461.84 }])
  })

  it('counts people and sorts by cost, largest first', () => {
    const row = buildJobTeamLaborRow([
      { personName: 'Paige', hours: 4, cost: 100, byWorkDate: [] },
      { personName: 'Abraham', hours: 8, cost: 400, byWorkDate: [] },
      { personName: 'Ghost', hours: 0, cost: 0, byWorkDate: [] },
    ])
    expect(row.people.map((p) => p.personName)).toEqual(['Abraham', 'Paige'])
    expect(row.summaryLabel).toBe('12.0 h · 2 people')
    expect(row.totalCost).toBe(500)
  })

  it('reads "no recorded time" when nothing is allocated', () => {
    const row = buildJobTeamLaborRow([])
    expect(row.summaryLabel).toBe('no recorded time')
    expect(row.totalCost).toBe(0)
  })

  it('surfaces pending hours only when there are some', () => {
    expect(buildJobTeamLaborRow([], 0).pendingLabel).toBeNull()
    expect(buildJobTeamLaborRow([], 0.02).pendingLabel).toBeNull()
    expect(buildJobTeamLaborRow([], 6.5).pendingLabel).toBe('includes 6.5 h awaiting approval')
    expect(buildJobTeamLaborRow([], -3).pendingHours).toBe(0)
  })
})

describe('pendingSessionHours', () => {
  const base = { rejected_at: null, revoked_at: null }
  it('sums closed unapproved sessions and skips approved / open / rejected / revoked ones', () => {
    const hours = pendingSessionHours([
      { ...base, clocked_in_at: '2026-09-08T13:00:00Z', clocked_out_at: '2026-09-08T17:00:00Z', approved_at: null }, // 4 h pending
      { ...base, clocked_in_at: '2026-09-08T17:00:00Z', clocked_out_at: '2026-09-08T21:00:00Z', approved_at: '2026-09-08T23:00:00Z' }, // approved
      { ...base, clocked_in_at: '2026-09-09T13:00:00Z', clocked_out_at: null, approved_at: null }, // open
      { clocked_in_at: '2026-09-07T13:00:00Z', clocked_out_at: '2026-09-07T15:00:00Z', approved_at: null, rejected_at: '2026-09-07T20:00:00Z', revoked_at: null },
      { clocked_in_at: '2026-09-06T13:00:00Z', clocked_out_at: '2026-09-06T15:00:00Z', approved_at: null, rejected_at: null, revoked_at: '2026-09-06T20:00:00Z' },
    ])
    expect(hours).toBe(4)
  })
  it('ignores negative or unparsable spans', () => {
    expect(pendingSessionHours([{ ...base, clocked_in_at: '2026-09-08T17:00:00Z', clocked_out_at: '2026-09-08T13:00:00Z', approved_at: null }])).toBe(0)
    expect(pendingSessionHours([{ ...base, clocked_in_at: 'nope', clocked_out_at: '2026-09-08T13:00:00Z', approved_at: null }])).toBe(0)
  })
})

describe('roundHoursLabel', () => {
  it('rounds to a tenth and keeps one decimal', () => {
    expect(roundHoursLabel(8)).toBe('8.0 h')
    expect(roundHoursLabel(45.24)).toBe('45.2 h')
    expect(roundHoursLabel(0.05)).toBe('0.1 h')
  })
})
