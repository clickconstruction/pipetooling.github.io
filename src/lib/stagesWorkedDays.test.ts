import { describe, expect, it } from 'vitest'
import { groupStagesPastBookedDays, groupStagesWorkedDays, mergeStagesWeekSoFar, type StagesWorkedSessionRow } from './stagesWorkedDays'

function row(over: Partial<StagesWorkedSessionRow>): StagesWorkedSessionRow {
  return { job_ledger_id: 'j1', work_date: '2026-09-21', users: { name: 'Malachi' }, ...over }
}

describe('groupStagesWorkedDays', () => {
  it('returns empty for no rows', () => {
    expect(groupStagesWorkedDays([])).toEqual({})
  })

  it('folds sessions into one entry per job-day, days ascending, names sorted and deduped', () => {
    const out = groupStagesWorkedDays([
      row({ work_date: '2026-09-22', users: { name: 'Tristen' } }),
      row({}),
      row({ users: { name: 'Tristen' } }),
      row({ users: { name: 'Malachi' } }), // a second session the same day
      row({ work_date: '2026-09-22', users: { name: 'Malachi' } }),
    ])
    expect(out.j1).toEqual([
      { ymd: '2026-09-21', names: ['Malachi', 'Tristen'] },
      { ymd: '2026-09-22', names: ['Malachi', 'Tristen'] },
    ])
  })

  it('keeps jobs apart, tolerates a null name and drops rows with no job', () => {
    const out = groupStagesWorkedDays([
      row({}),
      row({ job_ledger_id: 'j2', users: { name: null } }),
      row({ job_ledger_id: null }),
    ])
    expect(Object.keys(out).sort()).toEqual(['j1', 'j2'])
    expect(out.j2).toEqual([{ ymd: '2026-09-21', names: ['Unknown'] }])
  })

  it('reads a timestamp-shaped work_date by its day', () => {
    const out = groupStagesWorkedDays([row({ work_date: '2026-09-21T00:00:00' })])
    expect(out.j1![0]!.ymd).toBe('2026-09-21')
  })
})

describe('groupStagesPastBookedDays + mergeStagesWeekSoFar', () => {
  it('collects distinct booked days per job and joins them with the worked days', () => {
    const booked = groupStagesPastBookedDays([
      { job_id: 'j1', work_date: '2026-09-22' },
      { job_id: 'j1', work_date: '2026-09-21' },
      { job_id: 'j1', work_date: '2026-09-21' }, // two blocks the same day
      { job_id: null, work_date: '2026-09-21' },
      { job_id: 'j3', work_date: '2026-09-22' },
    ])
    expect(booked).toEqual({ j1: ['2026-09-21', '2026-09-22'], j3: ['2026-09-22'] })
    const merged = mergeStagesWeekSoFar({ j1: [{ ymd: '2026-09-21', names: ['Malachi'] }], j2: [{ ymd: '2026-09-22', names: ['Tristen'] }] }, booked)
    expect(merged.j1).toEqual({ worked: [{ ymd: '2026-09-21', names: ['Malachi'] }], bookedYmds: ['2026-09-21', '2026-09-22'] })
    expect(merged.j2).toEqual({ worked: [{ ymd: '2026-09-22', names: ['Tristen'] }], bookedYmds: [] })
    expect(merged.j3).toEqual({ worked: [], bookedYmds: ['2026-09-22'] })
  })
})
