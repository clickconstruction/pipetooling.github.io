import { describe, expect, it } from 'vitest'
import {
  JOB_SUMMARY_BILLED_IN_FULL_CHIP,
  jobSummaryBilledInFullTitle,
  jobSummaryBurnCellWords,
  jobSummaryTileWords,
  jobSummaryWindowChipsFold,
  jobSummaryWindowPhrase,
} from './jobSummaryHeaderWords'
import { enrichJobSummaryRows, summarizeJobSummaryRows, type JobSummaryLedgerRowInput, type JobSummaryTotals } from './jobSummaryLedgerView'
import { projectJobSummaryBurn } from './jobSummaryBurn'

/**
 * The header's words (v2.6389): J804 read a 39 % margin beside a −70 % projection with no
 * word between them, Burn read `94% · 40%`, and three window-wide chips sat under a one-job
 * search as if they were the job's.
 */
type Row = JobSummaryLedgerRowInput
const row = (id: string, hcp: string, over: Omit<Partial<Row>, 'job'> & { job?: Partial<Row['job']> } = {}): Row => ({
  job: { id, hcp_number: hcp, click_number: null, job_name: `Job ${hcp}`, pct_complete: null, invoices: [], last_work_date: null, created_at: '2026-01-15T00:00:00Z', ...(over.job ?? {}) },
  subLaborCost: over.subLaborCost ?? 0,
  teamLaborCost: over.teamLaborCost ?? 0,
  partsCost: over.partsCost ?? 0,
  totalBill: over.totalBill ?? 0,
})
const enrich = (rows: Row[], report: ReadonlyMap<string, number> = new Map()) => enrichJobSummaryRows({ rows, reportPctByJobId: report, ledger: null, method: 'day' })

describe('jobSummaryTileWords', () => {
  it('one in-progress row (J804 at 40 %): Revenue earned says the rule, every to-date tile says so, Heading for carries the projection', () => {
    const rows = enrich([row('j804', '804', { totalBill: 32_600, teamLaborCost: 3_122.12, subLaborCost: 5_600, partsCost: 11_235, job: { pct_complete: 40 } })])
    const base = summarizeJobSummaryRows(rows)
    // The ledger's figures from the screenshot, pinned by hand: overhead $2,182.51 over 20 field days → −$22,749.07 at 100 %.
    const totals: JobSummaryTotals = { ...base, hours: 139.7, overheadUsd: 2_182.51, trueProfitUsd: base.grossUsd - 2_182.51, trueMarginPct: ((base.grossUsd - 2_182.51) / base.revenueUsd) * 100, projectedTrueMarginUsd: -22_749.07, projectedRows: 1, projectedContractUsd: 32_600 }
    const w = jobSummaryTileWords({ totals, rows, methodLabel: 'Day-share' })
    expect(w.revenue).toEqual({ label: 'Revenue earned', sub: 'to date · 40% of $32,600' })
    expect(w.gross.sub).toBe('to date · -53% margin')
    expect(w.overhead.sub).toBe('to date · day-share · — of gross')
    expect(w.trueProfit.sub).toBe('to date · -70% true margin')
    expect(w.headingFor?.usd).toBe(-22_749.07)
    expect(w.headingFor?.pct).toBeCloseTo(-69.78, 1)
    expect(w.headingFor?.sub).toBe('true margin at 100% · -70%')
    expect(w.perHour.sub).toBe('true profit ÷ 139.7 h')
  })
  it('every row finished: the contract, no "to date", no Heading for', () => {
    const rows = enrich([row('a', 'a', { totalBill: 10_000, teamLaborCost: 4_000, job: { pct_complete: 100 } }), row('b', 'b', { totalBill: 5_000, job: { pct_complete: 100 } })])
    const totals: JobSummaryTotals = { ...summarizeJobSummaryRows(rows), overheadUsd: 1_000, trueProfitUsd: 10_000, trueMarginPct: 66.67 }
    const w = jobSummaryTileWords({ totals, rows, methodLabel: 'Day-share' })
    expect(w.revenue).toEqual({ label: 'Revenue', sub: 'contract · every job finished' })
    expect(w.gross.sub).toBe('73% margin')
    expect(w.overhead.sub).toBe('day-share · 9% of gross')
    expect(w.trueProfit.sub).toBe('67% true margin')
    expect(w.headingFor).toBeNull()
  })
  it('a mix: the in-progress count, Heading for over its jobs, and an assumed-half row says so when it is alone', () => {
    const rows = enrich([row('a', 'a', { totalBill: 10_000, job: { pct_complete: 100 } }), row('b', 'b', { totalBill: 20_000, job: { pct_complete: 50 } }), row('c', 'c', { totalBill: 8_000, job: { pct_complete: 25 } })])
    const totals: JobSummaryTotals = { ...summarizeJobSummaryRows(rows), projectedTrueMarginUsd: -3_360, projectedRows: 2, projectedContractUsd: 28_000 }
    const w = jobSummaryTileWords({ totals, rows, methodLabel: 'A' })
    expect(w.revenue).toEqual({ label: 'Revenue', sub: 'to date · 2 of 3 in progress earned by hours' })
    expect(w.headingFor?.sub).toBe('true margin at 100% · -12% · 2 jobs')
    const open = enrich([row('b', 'b', { totalBill: 20_000, job: { pct_complete: 50 } }), row('c', 'c', { totalBill: 8_000, job: { pct_complete: 25 } })])
    expect(jobSummaryTileWords({ totals: summarizeJobSummaryRows(open), rows: open, methodLabel: 'A' }).revenue).toEqual({ label: 'Revenue earned', sub: 'to date · 2 in progress earned by hours' })
    const half = enrich([row('h', 'h', { totalBill: 10_000 })])
    expect(jobSummaryTileWords({ totals: summarizeJobSummaryRows(half), rows: half, methodLabel: 'A' }).revenue.sub).toBe('to date · assumed 50% of $10,000')
  })
})

describe('jobSummaryBurnCellWords', () => {
  const j804 = { contractUsd: 32_600, spentUsd: 19_957.12, finished: false, fieldDays: 20, overheadUsd: 2_182.51, targetMarginPct: 0 }
  it('spent and done each carry their word; early, done and no budget keep theirs', () => {
    expect(jobSummaryBurnCellWords(projectJobSummaryBurn({ ...j804, pct: 40 }), 40)).toBe('94% spent · 40% done')
    expect(jobSummaryBurnCellWords(projectJobSummaryBurn({ ...j804, pct: 5 }), 5)).toBe('94% spent · early')
    expect(jobSummaryBurnCellWords(projectJobSummaryBurn({ ...j804, pct: 100, finished: true }), 100)).toBe('done')
    expect(jobSummaryBurnCellWords(projectJobSummaryBurn({ ...j804, contractUsd: 0, pct: 40 }), 40)).toBe('—')
    expect(jobSummaryBurnCellWords(null, 40)).toBe('—')
  })
})

describe('the window-wide chips fold under a search', () => {
  const hygiene = { pendingFieldSessions: 15, pendingFieldHours: 127.9, unallocatedUsd: 0, unallocatedDays: 0, inFlightUsd: 6_517.2, offListUsd: 12_745.4, offListJobs: 10 }
  it('names the window and each chip in short form; the money chips only when money shows', () => {
    const f = jobSummaryWindowChipsFold({ search: '804', window: 'ytd', showMoney: true, dayShare: true, hygiene })
    expect(f?.summary).toBe('Across this year: 15 sessions await approval · $6,517 of overhead in flight · $12,745 on 10 jobs off this list')
    expect(f?.parts).toHaveLength(3)
    expect(jobSummaryWindowChipsFold({ search: '804', window: '90d', showMoney: false, dayShare: true, hygiene })?.summary).toBe('Across the last 90 days: 15 sessions await approval')
    expect(jobSummaryWindowChipsFold({ search: '804', window: 'ytd', showMoney: true, dayShare: false, hygiene })?.parts).toHaveLength(2)
  })
  it('nothing typed, no hygiene or nothing to fold: null', () => {
    expect(jobSummaryWindowChipsFold({ search: '', window: 'ytd', showMoney: true, dayShare: true, hygiene })).toBeNull()
    expect(jobSummaryWindowChipsFold({ search: '804', window: 'ytd', showMoney: true, dayShare: true, hygiene: null })).toBeNull()
    expect(jobSummaryWindowChipsFold({ search: '804', window: 'ytd', showMoney: true, dayShare: true, hygiene: { ...hygiene, pendingFieldSessions: 0, inFlightUsd: 0, offListUsd: 0 } })).toBeNull()
  })
  it('the window phrase', () => {
    expect(['90d', '6mo', 'ytd', '12mo', 'all'].map((w) => jobSummaryWindowPhrase(w as never))).toEqual(['the last 90 days', 'the last 6 months', 'this year', 'the last 12 months', 'every day since 2025'])
  })
})

describe('the billed in full chip', () => {
  it('has its words and a hover that says what to do', () => {
    expect(JOB_SUMMARY_BILLED_IN_FULL_CHIP).toBe('billed in full')
    expect(jobSummaryBilledInFullTitle(40)).toContain('but the % says 40')
    expect(jobSummaryBilledInFullTitle(null)).toContain('no % yet')
  })
})
