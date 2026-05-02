import { describe, expect, it } from 'vitest'
import {
  aggregateOverheadDetailByPerson,
  aggregateOverheadDetailByPersonTotalScope,
  aggregateOtherJobsLaborByPerson,
  approvedClosedSessionHours,
  buildOtherJobsLaborByDay,
  buildOverheadDailyLabor,
  buildOverheadWageLookup,
  filterOverheadDetailLines,
  mergeOfficePartsIntoOverheadDays,
  mergeOverheadDayTableRows,
  overheadBucketForSession,
  overheadFactorTotalOverOtherJobs,
  type OverheadClockSessionRow,
  type OverheadSessionDetailLine,
} from './overheadDailyLabor'

function detailLine(p: Partial<OverheadSessionDetailLine> & Pick<OverheadSessionDetailLine, 'sessionId' | 'userName' | 'bucket'>): OverheadSessionDetailLine {
  return {
    workDate: '2026-06-02',
    hours: 1,
    laborUsd: 10,
    missingWage: false,
    jobLedgerId: null,
    bidId: null,
    ...p,
  }
}

function sess(p: Partial<OverheadClockSessionRow> & Pick<OverheadClockSessionRow, 'id' | 'user_id' | 'work_date'>): OverheadClockSessionRow {
  return {
    clocked_in_at: '2026-06-02T14:00:00.000Z',
    clocked_out_at: '2026-06-02T16:00:00.000Z',
    job_ledger_id: null,
    bid_id: null,
    approved_at: '2026-06-02T20:00:00.000Z',
    rejected_at: null,
    revoked_at: null,
    users: { name: 'Alice' },
    ...p,
  }
}

describe('overheadBucketForSession', () => {
  const office = '11111111-1111-4111-8111-111111111111'

  it('classifies office when job matches', () => {
    expect(overheadBucketForSession(office, office, 'bid-uuid')).toBe('office')
  })

  it('classifies bid when job is not office but bid_id set', () => {
    expect(overheadBucketForSession(office, 'other-job', 'bid-uuid')).toBe('bid')
  })

  it('returns null when no office match and no bid', () => {
    expect(overheadBucketForSession(office, 'other-job', null)).toBe(null)
  })
})

describe('approvedClosedSessionHours', () => {
  it('returns null when open', () => {
    expect(
      approvedClosedSessionHours({
        clocked_in_at: '2026-06-02T14:00:00.000Z',
        clocked_out_at: null,
      }),
    ).toBe(null)
  })

  it('returns fractional hours when closed', () => {
    expect(
      approvedClosedSessionHours({
        clocked_in_at: '2026-06-02T14:00:00.000Z',
        clocked_out_at: '2026-06-02T16:30:00.000Z',
      }),
    ).toBe(2.5)
  })
})

describe('buildOverheadDailyLabor', () => {
  const officeId = '11111111-1111-4111-8111-111111111111'
  const wages = buildOverheadWageLookup([{ person_name: 'Alice', hourly_wage: 40 }])

  it('skips rejected and non-approved', () => {
    const r = buildOverheadDailyLabor({
      sessions: [
        sess({
          id: 'a',
          user_id: 'u1',
          work_date: '2026-06-02',
          job_ledger_id: officeId,
          rejected_at: '2026-06-02T12:00:00.000Z',
        }),
        sess({
          id: 'b',
          user_id: 'u1',
          work_date: '2026-06-02',
          job_ledger_id: officeId,
          rejected_at: null,
          approved_at: null,
        }),
      ],
      officeJobLedgerId: officeId,
      wageByNormalizedName: wages,
    })
    expect(r.byDay).toEqual([])
  })

  it('splits office vs bid per day', () => {
    const r = buildOverheadDailyLabor({
      sessions: [
        sess({
          id: 'o',
          user_id: 'u1',
          work_date: '2026-06-02',
          job_ledger_id: officeId,
        }),
        sess({
          id: 'b',
          user_id: 'u2',
          work_date: '2026-06-02',
          job_ledger_id: null,
          bid_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          users: { name: 'Alice' },
          clocked_in_at: '2026-06-02T10:00:00.000Z',
          clocked_out_at: '2026-06-02T11:00:00.000Z',
        }),
      ],
      officeJobLedgerId: officeId,
      wageByNormalizedName: wages,
    })
    expect(r.byDay).toHaveLength(1)
    expect(r.byDay[0]?.work_date).toBe('2026-06-02')
    expect(r.byDay[0]?.officeLaborUsd).toBe(80)
    expect(r.byDay[0]?.bidLaborUsd).toBe(40)
    expect(r.byDay[0]?.totalUsd).toBe(120)
    expect(r.byDay[0]?.laborHours).toBe(3)
  })

  it('marks missing wage on detail', () => {
    const r = buildOverheadDailyLabor({
      sessions: [
        sess({
          id: 'x',
          user_id: 'u9',
          work_date: '2026-06-03',
          job_ledger_id: officeId,
          users: { name: 'Nobody' },
        }),
      ],
      officeJobLedgerId: officeId,
      wageByNormalizedName: wages,
    })
    expect(r.byDay[0]?.officeLaborUsd).toBe(0)
    expect(r.byDay[0]?.laborHours).toBe(2)
    const lines = r.detailByDay.get('2026-06-03') ?? []
    expect(lines[0]?.missingWage).toBe(true)
    expect(lines[0]?.laborUsd).toBe(0)
  })
})

describe('filterOverheadDetailLines', () => {
  const lines = [
    detailLine({ sessionId: '1', userName: 'A', bucket: 'office' }),
    detailLine({ sessionId: '2', userName: 'B', bucket: 'bid' }),
  ]

  it('returns all for total', () => {
    expect(filterOverheadDetailLines(lines, 'total')).toHaveLength(2)
  })

  it('filters by bucket', () => {
    expect(filterOverheadDetailLines(lines, 'office').map((l) => l.sessionId)).toEqual(['1'])
    expect(filterOverheadDetailLines(lines, 'bid').map((l) => l.sessionId)).toEqual(['2'])
  })
})

describe('aggregateOverheadDetailByPerson', () => {
  it('sums one person multiple sessions', () => {
    const lines = [
      detailLine({ sessionId: 'a', userName: 'Pat', bucket: 'office', hours: 2, laborUsd: 80 }),
      detailLine({ sessionId: 'b', userName: 'Pat', bucket: 'office', hours: 1, laborUsd: 40 }),
    ]
    expect(aggregateOverheadDetailByPerson(lines)).toEqual([
      { userName: 'Pat', hours: 3, laborUsd: 120, missingWage: false },
    ])
  })

  it('sorts multiple people', () => {
    const lines = [
      detailLine({ sessionId: 'x', userName: 'Zed', bucket: 'bid', hours: 1, laborUsd: 1 }),
      detailLine({ sessionId: 'y', userName: 'Amy', bucket: 'bid', hours: 1, laborUsd: 2 }),
    ]
    expect(aggregateOverheadDetailByPerson(lines).map((r) => r.userName)).toEqual(['Amy', 'Zed'])
  })

  it('ORs missingWage across lines', () => {
    const lines = [
      detailLine({ sessionId: 'a', userName: 'Pat', bucket: 'office', hours: 1, laborUsd: 0, missingWage: true }),
      detailLine({ sessionId: 'b', userName: 'Pat', bucket: 'office', hours: 1, laborUsd: 50, missingWage: false }),
    ]
    expect(aggregateOverheadDetailByPerson(lines)[0]?.missingWage).toBe(true)
  })
})

describe('aggregateOverheadDetailByPersonTotalScope', () => {
  it('splits office vs bid per person', () => {
    const lines = [
      detailLine({ sessionId: 'a', userName: 'Pat', bucket: 'office', hours: 2, laborUsd: 80 }),
      detailLine({ sessionId: 'b', userName: 'Pat', bucket: 'bid', hours: 1, laborUsd: 40 }),
      detailLine({ sessionId: 'c', userName: 'Kim', bucket: 'bid', hours: 3, laborUsd: 90 }),
    ]
    expect(aggregateOverheadDetailByPersonTotalScope(lines)).toEqual([
      {
        userName: 'Kim',
        hours: 3,
        officeLaborUsd: 0,
        bidLaborUsd: 90,
        totalLaborUsd: 90,
        missingWage: false,
      },
      {
        userName: 'Pat',
        hours: 3,
        officeLaborUsd: 80,
        bidLaborUsd: 40,
        totalLaborUsd: 120,
        missingWage: false,
      },
    ])
  })
})

describe('mergeOfficePartsIntoOverheadDays', () => {
  it('unions labor and parts days and sums total', () => {
    const labor = [
      { work_date: '2026-06-02', officeLaborUsd: 10, bidLaborUsd: 20, totalUsd: 30, laborHours: 2.5 },
      { work_date: '2026-06-03', officeLaborUsd: 0, bidLaborUsd: 5, totalUsd: 5, laborHours: 1 },
    ]
    const parts = new Map([
      ['2026-06-02', 3],
      ['2026-06-04', 100],
    ])
    const rows = mergeOfficePartsIntoOverheadDays(labor, parts)
    expect(rows).toEqual([
      {
        work_date: '2026-06-02',
        officeLaborUsd: 10,
        bidLaborUsd: 20,
        officePartsUsd: 3,
        totalUsd: 33,
        totalLaborHours: 2.5,
        otherJobsUsd: 0,
        otherJobsLaborHours: 0,
      },
      {
        work_date: '2026-06-03',
        officeLaborUsd: 0,
        bidLaborUsd: 5,
        officePartsUsd: 0,
        totalUsd: 5,
        totalLaborHours: 1,
        otherJobsUsd: 0,
        otherJobsLaborHours: 0,
      },
      {
        work_date: '2026-06-04',
        officeLaborUsd: 0,
        bidLaborUsd: 0,
        officePartsUsd: 100,
        totalUsd: 100,
        totalLaborHours: 0,
        otherJobsUsd: 0,
        otherJobsLaborHours: 0,
      },
    ])
  })

  it('handles empty labor', () => {
    const parts = new Map([['2026-06-01', 42]])
    expect(mergeOfficePartsIntoOverheadDays([], parts)).toEqual([
      {
        work_date: '2026-06-01',
        officeLaborUsd: 0,
        bidLaborUsd: 0,
        officePartsUsd: 42,
        totalUsd: 42,
        totalLaborHours: 0,
        otherJobsUsd: 0,
        otherJobsLaborHours: 0,
      },
    ])
  })
})

describe('mergeOverheadDayTableRows', () => {
  it('adds other jobs labor and parts without changing overhead totalUsd', () => {
    const labor = [{ work_date: '2026-06-02', officeLaborUsd: 10, bidLaborUsd: 20, totalUsd: 30, laborHours: 4 }]
    const officeParts = new Map([['2026-06-02', 3]])
    const ojLabor = new Map([['2026-06-02', 50]])
    const ojLaborHours = new Map([['2026-06-02', 2.5]])
    const ojParts = new Map([['2026-06-02', 7]])
    const rows = mergeOverheadDayTableRows(labor, officeParts, ojLabor, ojLaborHours, ojParts)
    expect(rows).toEqual([
      {
        work_date: '2026-06-02',
        officeLaborUsd: 10,
        bidLaborUsd: 20,
        officePartsUsd: 3,
        totalUsd: 33,
        totalLaborHours: 4,
        otherJobsUsd: 57,
        otherJobsLaborHours: 2.5,
      },
    ])
  })

  it('unions other-jobs-only days', () => {
    const rows = mergeOverheadDayTableRows(
      [],
      new Map(),
      new Map([['2026-06-05', 1]]),
      new Map(),
      new Map([['2026-06-05', 2]]),
    )
    expect(rows).toEqual([
      {
        work_date: '2026-06-05',
        officeLaborUsd: 0,
        bidLaborUsd: 0,
        officePartsUsd: 0,
        totalUsd: 0,
        totalLaborHours: 0,
        otherJobsUsd: 3,
        otherJobsLaborHours: 0,
      },
    ])
  })

  it('other-jobs parts only yields zero labor hours', () => {
    const rows = mergeOverheadDayTableRows([], new Map(), new Map(), new Map(), new Map([['2026-06-06', 88]]))
    expect(rows).toEqual([
      {
        work_date: '2026-06-06',
        officeLaborUsd: 0,
        bidLaborUsd: 0,
        officePartsUsd: 0,
        totalUsd: 0,
        totalLaborHours: 0,
        otherJobsUsd: 88,
        otherJobsLaborHours: 0,
      },
    ])
  })
})

describe('buildOtherJobsLaborByDay', () => {
  const officeId = '11111111-1111-4111-8111-111111111111'
  const otherJob = '22222222-2222-4222-8222-222222222222'
  const wages = buildOverheadWageLookup([{ person_name: 'Alice', hourly_wage: 40 }])

  it('sums labor excluding office job', () => {
    const sessions: OverheadClockSessionRow[] = [
      sess({
        id: 'a',
        user_id: 'u1',
        work_date: '2026-06-02',
        job_ledger_id: otherJob,
      }),
      sess({
        id: 'b',
        user_id: 'u1',
        work_date: '2026-06-02',
        job_ledger_id: officeId,
      }),
      sess({
        id: 'c',
        user_id: 'u1',
        work_date: '2026-06-02',
        job_ledger_id: null,
        bid_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
    ]
    const r = buildOtherJobsLaborByDay({ sessions, officeJobLedgerId: officeId, wageByNormalizedName: wages })
    expect(r.laborUsdByDay.get('2026-06-02')).toBe(80)
    expect(r.laborHoursByDay.get('2026-06-02')).toBe(2)
    expect((r.detailByDay.get('2026-06-02') ?? []).map((x) => x.sessionId)).toEqual(['a'])
  })

  it('includes all job rows when no office configured', () => {
    const sessions: OverheadClockSessionRow[] = [
      sess({
        id: 'a',
        user_id: 'u1',
        work_date: '2026-06-02',
        job_ledger_id: officeId,
      }),
    ]
    const r = buildOtherJobsLaborByDay({ sessions, officeJobLedgerId: null, wageByNormalizedName: wages })
    expect(r.laborUsdByDay.get('2026-06-02')).toBe(80)
    expect(r.laborHoursByDay.get('2026-06-02')).toBe(2)
  })
})

describe('overheadFactorTotalOverOtherJobs', () => {
  it('returns null when other jobs dollars are zero or negative', () => {
    expect(overheadFactorTotalOverOtherJobs(100, 0)).toBe(null)
    expect(overheadFactorTotalOverOtherJobs(100, -1)).toBe(null)
  })

  it('divides total by other jobs when denominator is positive', () => {
    expect(overheadFactorTotalOverOtherJobs(100, 25)).toBe(4)
  })

  it('returns zero when total is zero and other jobs is positive', () => {
    expect(overheadFactorTotalOverOtherJobs(0, 50)).toBe(0)
  })

  it('returns null when inputs are not finite', () => {
    expect(overheadFactorTotalOverOtherJobs(Number.NaN, 10)).toBe(null)
    expect(overheadFactorTotalOverOtherJobs(10, Number.NaN)).toBe(null)
  })
})

describe('aggregateOtherJobsLaborByPerson', () => {
  it('aggregates like office/bid person rows', () => {
    const lines = [
      {
        sessionId: '1',
        workDate: '2026-06-01',
        userName: 'Pat',
        hours: 2,
        laborUsd: 20,
        missingWage: false,
        jobLedgerId: 'j1',
      },
      {
        sessionId: '2',
        workDate: '2026-06-01',
        userName: 'Pat',
        hours: 1,
        laborUsd: 10,
        missingWage: false,
        jobLedgerId: 'j2',
      },
    ]
    expect(aggregateOtherJobsLaborByPerson(lines)).toEqual([
      { userName: 'Pat', hours: 3, laborUsd: 30, missingWage: false },
    ])
  })
})
