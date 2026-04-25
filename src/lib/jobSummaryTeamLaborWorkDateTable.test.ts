import { describe, expect, it } from 'vitest'
import {
  buildJobSummaryTeamLaborWorkDateTableRows,
  JOB_SUMMARY_TEAM_LABOR_NO_WORK_DATE,
} from './jobSummaryTeamLaborWorkDateTable'

const S = (over: Partial<{ id: string; work_date: string | null; clocked_in_at: string; clocked_out_at: string }>) => ({
  id: '1',
  work_date: '2024-01-02' as string | null,
  clocked_in_at: '2024-01-02T12:00:00Z',
  clocked_out_at: '2024-01-02T14:00:00Z',
  ...over,
})

describe('buildJobSummaryTeamLaborWorkDateTableRows', () => {
  it('merges two alloc days and one punch on second day, sorted by date', () => {
    const r2 = buildJobSummaryTeamLaborWorkDateTableRows(
      [
        { workDate: '2024-01-10', hours: 2, cost: 100 },
        { workDate: '2024-01-05', hours: 1, cost: 50 },
      ],
      [S({ id: 'a', work_date: '2024-01-10' })],
    )
    expect(r2.map((x) => x.workDate)).toEqual(['2024-01-05', '2024-01-10', '2024-01-10'])
    expect(r2[0]!.kind).toBe('alloc')
    expect(r2[1]!.kind).toBe('alloc')
    expect(r2[2]!.kind).toBe('punch')
  })

  it('on same day, alloc then punches, multiple sessions sorted by clock in', () => {
    const rows = buildJobSummaryTeamLaborWorkDateTableRows(
      [{ workDate: '2024-01-02', hours: 8, cost: 400 }],
      [
        S({ id: 'late', work_date: '2024-01-02', clocked_in_at: '2024-01-02T16:00:00Z' }),
        S({ id: 'early', work_date: '2024-01-02', clocked_in_at: '2024-01-02T08:00:00Z' }),
      ],
    )
    expect(rows[0]).toMatchObject({ kind: 'alloc', workDate: '2024-01-02' })
    expect((rows[1] as { kind: string; session: { id: string } }).session.id).toBe('early')
    expect((rows[2] as { kind: string; session: { id: string } }).session.id).toBe('late')
  })

  it('punch with null work_date is last and grouped', () => {
    const rows = buildJobSummaryTeamLaborWorkDateTableRows(
      [{ workDate: '2024-01-01', hours: 1, cost: 1 }],
      [S({ id: 'n', work_date: null, clocked_in_at: '2023-12-01T00:00:00Z' })],
    )
    const last = rows[rows.length - 1]!
    expect(last.kind).toBe('punch')
    if (last.kind === 'punch') expect(last.workDate).toBe(JOB_SUMMARY_TEAM_LABOR_NO_WORK_DATE)
  })
})
