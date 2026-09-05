import { describe, expect, it } from 'vitest'
import { buildAheadSeries } from './jobSummaryAhead'
import type { JobSummaryEnrichedRow } from './jobSummaryLedgerView'

const row = (id: string, contractUsd: number, revenueUsd: number, finished: boolean, status = 'working'): JobSummaryEnrichedRow =>
  ({ row: { job: { id, hcp_number: id, job_name: id, pct_complete: null, status }, subLaborCost: 0, teamLaborCost: 0, partsCost: 0, totalBill: contractUsd }, finished, contractUsd, revenueUsd, flags: [] }) as unknown as JobSummaryEnrichedRow

describe('ahead (v2.2830)', () => {
  const today = '2026-09-05' // Saturday → weeks start Mon Aug 31
  const rows = [row('a', 10_000, 4_000, false), row('b', 5_000, 5_000, true), row('c', 8_000, 8_000, false, 'billed'), row('d', 3_000, 1_500, false)]
  const bids = [
    { id: 'w1', bid_number: 'BP1', project_name: 'Lot 4', bid_value: 20_000, agreed_value: 21_000, estimated_job_start_date: '2026-09-14', outcome: 'won' },
    { id: 'w2', bid_number: 'BP2', project_name: 'Ste 9', bid_value: 9_000, agreed_value: null, estimated_job_start_date: null, outcome: 'won' },
    { id: 'w3', bid_number: 'BP3', project_name: 'Passed', bid_value: 4_000, agreed_value: null, estimated_job_start_date: '2026-08-01', outcome: 'won' },
    { id: 'w4', bid_number: 'BP4', project_name: 'Linked', bid_value: 50_000, agreed_value: null, estimated_job_start_date: '2026-09-21', outcome: 'won' },
    { id: 'l1', bid_number: 'BP5', project_name: 'Lost', bid_value: 7_000, agreed_value: null, estimated_job_start_date: null, outcome: 'lost' },
  ]
  const blocks = [
    { work_date: '2026-09-07', assignee_user_id: 'u1', job_id: 'a', bid_id: null },
    { work_date: '2026-09-07', assignee_user_id: 'u1', job_id: 'a', bid_id: null }, // same person-day twice → 1
    { work_date: '2026-09-07', assignee_user_id: 'u2', job_id: 'd', bid_id: null },
    { work_date: '2026-09-08', assignee_user_id: 'u1', job_id: null, bid_id: 'w1' },
    { work_date: '2026-09-15', assignee_user_id: 'u1', job_id: 'a', bid_id: null },
    { work_date: '2026-09-01', assignee_user_id: 'u1', job_id: 'a', bid_id: null }, // before today → ignored
  ]
  const s = buildAheadSeries({ rows, bids, linkedBidIds: new Set(['w4']), blocks, todayYmd: today, crewNow: 4, windowRevenueUsd: 360_000, windowDays: 252, trueMarginPct: 40, targetTrueMarginPct: 35 })

  it('remaining on open jobs = contract − earned, skipping finished and billed', () => {
    expect(s.openJobs).toBe(2)
    expect(s.remainingUsd).toBe(6_000 + 1_500)
  })

  it('won bids with no job yet, with no-date and start-passed counts; linked and lost excluded', () => {
    expect(s.wonNotStarted).toBe(3)
    expect(s.wonNotStartedUsd).toBe(21_000 + 9_000 + 4_000)
    expect(s.wonNoDate).toBe(1)
    expect(s.wonStartPassed).toBe(1)
    expect(s.notStarted.map((b) => b.label)).toEqual(['BP3 Passed', 'BP1 Lot 4', 'BP2 Ste 9'])
  })

  it('books person-days per week ahead against crew × 5, and places bid starts', () => {
    expect(s.weeks.length).toBe(8)
    expect(s.weeks[0]).toMatchObject({ weekStartYmd: '2026-08-31', personDays: 0, capacityDays: 20 })
    expect(s.weeks[1]).toMatchObject({ weekStartYmd: '2026-09-07', personDays: 3, jobsBooked: 3 })
    expect(s.weeks[2]).toMatchObject({ personDays: 1, jobsBooked: 1 })
    expect(s.weeks[2]!.bidStarts.map((b) => b.label)).toEqual(['BP1 Lot 4'])
    expect(s.bookedDaysNext4).toBe(4)
    expect(s.capacityDaysNext4).toBe(80)
  })

  it('backlog, weeks at pace, and expected profit at the window margin and the target', () => {
    expect(s.backlogUsd).toBe(7_500 + 34_000)
    expect(s.backlogWeeks).toBeCloseTo(41_500 / 10_000)
    expect(s.expectedTrueProfitUsd).toBeCloseTo(41_500 * 0.4)
    expect(s.expectedAtTargetUsd).toBeCloseTo(41_500 * 0.35)
  })
})
