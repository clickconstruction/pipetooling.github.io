import { describe, expect, it } from 'vitest'
import { hubPersonDayKey } from './scheduleDispatchHub'
import { formatExpectedManpowerPersonHours } from './scheduleDispatchExpectedManpower'
import {
  buildScheduleHiddenByCell,
  formatManpowerWithHidden,
  normalizeScheduleHiddenBlockRows,
  scheduleHiddenBlocksTotal,
  scheduleHiddenManpowerForDayKeys,
  scheduleHiddenPlaceholderTitle,
  scheduleHiddenUserIds,
  type ScheduleHiddenBlockCount,
} from './scheduleHiddenBlocks'

const rows: ScheduleHiddenBlockCount[] = [
  { user_id: 'u1', day: '2026-09-02', hidden_count: 2, hidden_hours: 12 },
  { user_id: 'u2', day: '2026-09-02', hidden_count: 1, hidden_hours: 8 },
  { user_id: 'u1', day: '2026-09-03', hidden_count: 1, hidden_hours: 8 },
  { user_id: 'u3', day: '2026-09-05', hidden_count: 3, hidden_hours: 17 },
]

describe('normalizeScheduleHiddenBlockRows (RPC payload → rows)', () => {
  it('coerces PostgREST numeric strings and drops zero/junk rows', () => {
    expect(
      normalizeScheduleHiddenBlockRows([
        { user_id: 'u1', day: '2026-09-02', hidden_count: '2', hidden_hours: '12.50' },
        { user_id: 'u9', day: '2026-09-02', hidden_count: 0, hidden_hours: 0 },
        { user_id: null, day: '2026-09-02', hidden_count: 1, hidden_hours: 1 },
        'garbage',
        null,
      ]),
    ).toEqual([{ user_id: 'u1', day: '2026-09-02', hidden_count: 2, hidden_hours: 12.5 }])
  })

  it('non-array payloads shape to an empty list', () => {
    expect(normalizeScheduleHiddenBlockRows(null)).toEqual([])
    expect(normalizeScheduleHiddenBlockRows({ hidden_count: 4 })).toEqual([])
  })
})

describe('buildScheduleHiddenByCell (placeholder shaping)', () => {
  it('keys each row by hubPersonDayKey so the grid can look up a person-day directly', () => {
    const m = buildScheduleHiddenByCell(rows)
    expect(m.size).toBe(4)
    expect(m.get(hubPersonDayKey('u1', '2026-09-02'))).toEqual({ count: 2, hours: 12 })
    expect(m.get(hubPersonDayKey('u3', '2026-09-05'))).toEqual({ count: 3, hours: 17 })
    expect(m.get(hubPersonDayKey('u2', '2026-09-03'))).toBeUndefined()
  })

  it('merges duplicate person-day rows and ignores zero counts', () => {
    const m = buildScheduleHiddenByCell([
      { user_id: 'u1', day: '2026-09-02', hidden_count: 1, hidden_hours: 4 },
      { user_id: 'u1', day: '2026-09-02', hidden_count: 2, hidden_hours: 6 },
      { user_id: 'u1', day: '2026-09-04', hidden_count: 0, hidden_hours: 0 },
    ])
    expect(m.size).toBe(1)
    expect(m.get(hubPersonDayKey('u1', '2026-09-02'))).toEqual({ count: 3, hours: 10 })
  })

  it('the placeholder title says busy-elsewhere with the block count and no job identity', () => {
    expect(scheduleHiddenPlaceholderTitle({ count: 1, hours: 8 })).toBe(
      'Busy on work outside your projects (1 block) — details are hidden',
    )
    expect(scheduleHiddenPlaceholderTitle({ count: 3, hours: 17 })).toContain('3 blocks')
  })

  it('lists the distinct people who have hidden work (roster completion)', () => {
    expect(scheduleHiddenUserIds(rows).sort()).toEqual(['u1', 'u2', 'u3'])
  })
})

describe('Expected Manpower total with hidden blocks', () => {
  it('rolls hidden blocks up for one day', () => {
    expect(scheduleHiddenManpowerForDayKeys(rows, ['2026-09-02'])).toEqual({
      count: 3,
      hours: 20,
      people: 2,
    })
  })

  it('rolls hidden blocks up for the visible week and ignores days outside it', () => {
    const week = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']
    expect(scheduleHiddenManpowerForDayKeys(rows, week)).toEqual({ count: 4, hours: 28, people: 2 })
    expect(scheduleHiddenManpowerForDayKeys(rows, [])).toEqual({ count: 0, hours: 0, people: 0 })
  })

  it('J18-F2 headline: visible 38 + hidden 45 reads "83 · 38 on your projects"', () => {
    const r = formatManpowerWithHidden(38, 45, formatExpectedManpowerPersonHours)
    expect(r).toEqual({ total: '83', detail: '38 on your projects' })
    expect(`${r.total} · ${r.detail}`).toBe('83 · 38 on your projects')
  })

  it('with nothing hidden the headline is unchanged for office roles', () => {
    expect(formatManpowerWithHidden(38, 0, formatExpectedManpowerPersonHours)).toEqual({
      total: '38',
      detail: null,
    })
  })

  it('telemetry count is the sum of hidden blocks', () => {
    expect(scheduleHiddenBlocksTotal(rows)).toBe(7)
    expect(scheduleHiddenBlocksTotal([])).toBe(0)
  })
})
