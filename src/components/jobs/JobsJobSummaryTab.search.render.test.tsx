// @vitest-environment jsdom
/**
 * Wiring smoke for Jobs → Job Summary's search (v2.5745): the job you type always
 * shows. The owner typed 891 on the default view (Show · Finished, the HCP # 500
 * floor) and the tab drew nothing. The kernels hold the rule
 * (`jobSummarySearchWins.test.ts`, `jobSummaryLedgerView.test.ts`); this smoke
 * checks the tab draws the row, the note under the controls, the empty branch and
 * the floor line from them. Supabase is stubbed; the view bundle is built from the
 * kernels the hook runs, with no day ledger.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import JobsJobSummaryTab, { type JobSummaryRow, type JobsJobSummaryTabProps } from './JobsJobSummaryTab'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { JobSummaryViewBundle } from '../../hooks/useJobSummaryView'
import {
  JOB_SUMMARY_VIEW_DEFAULTS,
  enrichJobSummaryRows,
  filterAndSortJobSummaryRows,
  groupJobSummaryRows,
  jobSummaryConcentration,
  jobSummaryRowsHiddenByStatus,
  summarizeJobSummaryRows,
  type JobSummaryViewPrefs,
} from '../../lib/jobs/jobSummaryLedgerView'
import { OVERHEAD_ALLOCATION_RECOMMENDED } from '../../lib/jobs/overheadAllocation'
import type { JobWithDetails } from '../../types/jobWithDetails'

const START = '2026-07-24'
const END = '2026-10-22'

const summaryRow = (job: JobWithDetails, totalBill: number, teamLaborCost = 0): JobSummaryRow => ({
  job,
  subLaborCost: 0,
  teamLaborCost,
  partsCost: 0,
  totalBill,
  profit: totalBill - teamLaborCost,
  partsFromTally: 0,
  invoicesFromSupplyHouses: 0,
  billedMaterialsSum: 0,
  cardCharges: 0,
  cardChargesLinkedToInvoices: 0,
  costLines: [],
  teamLaborRow: undefined,
  subLaborJobs: [],
  tallyPartsForJob: [],
})

// 891 still in progress, worked this month; 931 finished (paid in full), worked this month.
const job891 = makeJob({ id: 'j891', hcp_number: '891', job_name: 'Oak Hill repipe', pct_complete: 40, revenue: 10_000, last_work_date: '2026-10-20' })
const job931 = makeJob({ id: 'j931', hcp_number: '931', job_name: 'Lavender Springs', pct_complete: 100, revenue: 48_700, last_work_date: '2026-10-01', invoices: [makeInvoice({ status: 'paid', amount: 48_700 })] })
// 432 sits under the HCP # 500 floor: in the ledger list only once a search lifts it.
const job432 = makeJob({ id: 'j432', hcp_number: '432', job_name: 'Old import', pct_complete: 100, revenue: 900, last_work_date: '2026-10-02' })
const rows891And931 = [summaryRow(job891, 10_000, 2_000), summaryRow(job931, 48_700)]

function buildView(rows: JobSummaryRow[], search: string, prefs: JobSummaryViewPrefs, hygiene: JobSummaryViewBundle<JobSummaryRow>['hygiene'] = null): JobSummaryViewBundle<JobSummaryRow> {
  const enriched = enrichJobSummaryRows({ rows, reportPctByJobId: new Map(), ledger: null, method: prefs.method })
  const visible = filterAndSortJobSummaryRows({ rows: enriched, prefs, search, startYmd: START, endYmd: END })
  const groups = groupJobSummaryRows(visible, prefs.cutBy)
  return {
    prefs,
    setPrefs: vi.fn(),
    toggleSort: vi.fn(),
    startYmd: START,
    endYmd: END,
    ledger: null,
    ledgerLoading: false,
    ledgerError: null,
    reloadLedger: vi.fn(),
    rows: visible,
    allRows: enriched,
    totals: summarizeJobSummaryRows(visible),
    hiddenByStatus: jobSummaryRowsHiddenByStatus({ rows: enriched, prefs, search, startYmd: START, endYmd: END }),
    hygiene,
    compare: null,
    groups,
    concentration: jobSummaryConcentration(groups),
    overhead: {
      settings: OVERHEAD_ALLOCATION_RECOMMENDED,
      appDefault: OVERHEAD_ALLOCATION_RECOMMENDED,
      isOverride: false,
      appDefaultLoaded: true,
      saving: false,
      explore: vi.fn(),
      saveAppDefault: vi.fn(async () => {}),
      allocation: null,
    },
  }
}

function renderTab(args: { search: string; ledgerJobs: JobWithDetails[]; rows: JobSummaryRow[]; liftedJobIds?: ReadonlySet<string>; hygiene?: JobSummaryViewBundle<JobSummaryRow>['hygiene'] }) {
  const prefs: JobSummaryViewPrefs = { ...JOB_SUMMARY_VIEW_DEFAULTS, window: '90d' }
  const props: JobsJobSummaryTabProps = {
    view: buildView(args.rows, args.search, prefs, args.hygiene ?? null),
    canOpenSessionNotes: true,
    users: [],
    error: null,
    jobSummaryLedgerError: null,
    jobSummaryLedgerLoading: false,
    jobSummaryLedgerJobs: args.ledgerJobs,
    jobSummaryLedgerAllJobs: args.ledgerJobs,
    jobSummaryHiddenByMinHcp: 398,
    jobSummaryMinHcpExclusive: 500,
    setJobSummaryMinHcpExclusive: vi.fn(),
    jobSummaryLiftedJobIds: args.liftedJobIds,
    jobSummaryData: args.rows,
    jobSummarySearch: args.search,
    setJobSummarySearch: vi.fn(),
    expandedJobSummaryJobIds: new Set(),
    setExpandedJobSummaryJobIds: vi.fn(),
    jobSummaryTeamLaborPersonExpandedKeys: new Set(),
    setJobSummaryTeamLaborPersonExpandedKeys: vi.fn(),
    jobSummaryBreakdownPersonSearchByJobId: {},
    setJobSummaryBreakdownPersonSearchByJobId: vi.fn(),
    jobSummaryClockSessionsByJobId: new Map(),
    jobSummaryInvoiceLinesByJobId: new Map(),
    jobSummaryMercuryAllocationsByJobId: new Map(),
    jobSummaryReportsByJobId: new Map(),
    jobSummaryReportPctByJobId: new Map(),
    jobThreadStatsByJobId: {},
    onOpenJobDetail: vi.fn(),
    onOpenEditJob: vi.fn(),
    setJobSummaryCostDrilldown: vi.fn(),
    printCostBreakdownJobId: null,
    setPrintCostBreakdownJobId: vi.fn(),
    canAccessBankingForParts: true,
    showTeamLaborAndProfit: true,
    nicknameByDebitCard: {},
    tallyPartsLoading: false,
    laborJobsLoading: false,
    driveMileageCost: null,
    driveTimePerMile: null,
    loadJobSummaryInvoiceLinesForJob: vi.fn(),
    loadJobSummaryMercuryAllocationsForJob: vi.fn(),
    handleJobSummaryMercuryReassignFromDrilldown: vi.fn(),
    printJobSummaryCostBreakdown: vi.fn(async () => {}),
  }
  return { ...renderWithProviders(<JobsJobSummaryTab {...props} />), view: props.view }
}

const drawnJobCells = () => screen.queryAllByTestId('job-summary-job-cell').map((c) => c.textContent ?? '')
const note = () => screen.queryByTestId('job-summary-search-note')?.textContent ?? null
/** The Jobs tile's number (the View chip is also labelled Jobs): the tiles sum what is drawn. */
const jobsTile = () => {
  for (const el of screen.getAllByText('Jobs')) {
    const v = el.parentElement?.children[1]?.textContent ?? ''
    if (/^\d+$/.test(v)) return v
  }
  return null
}

describe('JobsJobSummaryTab · the search wins (v2.5745)', () => {
  it('nothing typed: the chips rule, there is no note, and the floor line counts the whole list', async () => {
    renderTab({ search: '', ledgerJobs: [job891, job931], rows: rows891And931 })
    await settle()
    expect(drawnJobCells()).toEqual([expect.stringContaining('J931')])
    expect(jobsTile()).toBe('1')
    expect(note()).toBeNull()
    expect(screen.getByText(/^2 shown · 398 older imported jobs \(HCP # 500 and below\) hidden by the default HCP # 500 floor/)).toBeTruthy()
  })

  it('891 typed on the default view: the in-progress row is drawn, the note names the Show chip, the floor line counts the search', async () => {
    renderTab({ search: '891', ledgerJobs: [job891, job931], rows: rows891And931 })
    await settle()
    expect(drawnJobCells()).toEqual([expect.stringContaining('J891')])
    expect(jobsTile()).toBe('1')
    expect(note()).toBe('1 job matches your search. Job 891 is still in progress, so the Show chip stepped aside.')
    expect(screen.queryByText(/isn’t finished yet/)).toBeNull()
    expect(screen.getByText(/^1 job shown for the search · 398 older imported jobs \(HCP # 500 and below\) hidden by the default HCP # 500 floor/)).toBeTruthy()
  })

  it('432 typed: the row lifted from under the floor is drawn, and both lines say where it came from', async () => {
    renderTab({ search: '432', ledgerJobs: [job891, job931, job432], rows: [...rows891And931, summaryRow(job432, 900)], liftedJobIds: new Set(['j432']) })
    await settle()
    expect(drawnJobCells()).toEqual([expect.stringContaining('J432')])
    expect(note()).toBe('1 job matches your search. Job 432 sits under the HCP # 500 floor, so the floor stepped aside.')
    expect(screen.getByText(/^1 job shown for the search, 1 from under the floor · 397 older imported jobs/)).toBeTruthy()
  })

  it('no match: the note says so, the old three-suggestion line is gone, and the floor line reads 0 for the search', async () => {
    renderTab({ search: 'zzz', ledgerJobs: [job891, job931], rows: rows891And931 })
    await settle()
    expect(drawnJobCells()).toEqual([])
    expect(jobsTile()).toBe('0')
    expect(note()).toBe('No job matches zzz. Check the number, or clear the search box to see the list again.')
    expect(screen.queryByText(/No jobs match — try/)).toBeNull()
    expect(screen.getByText(/^0 jobs shown for the search · 398 older imported jobs/)).toBeTruthy()
  })

  it('nothing typed and every job outside Worked in: Clear the filters sets Show, Worked in and the budget to All (#184)', async () => {
    const old = makeJob({ id: 'j940', hcp_number: '940', job_name: 'Spring remodel', pct_complete: 100, revenue: 5_000, last_work_date: '2026-03-02', invoices: [makeInvoice({ status: 'paid', amount: 5_000 })] })
    const { view } = renderTab({ search: '', ledgerJobs: [old], rows: [summaryRow(old, 5_000)] })
    await settle()
    expect(drawnJobCells()).toEqual([])
    const press = screen.getByRole('button', { name: 'Clear the filters' })
    expect((press.closest('[data-empty-state]') as HTMLElement).textContent).toBe('No jobs match the filters. Clear the filters')
    fireEvent.click(press)
    expect(view.setPrefs).toHaveBeenCalledWith({ status: 'all', window: 'all', budgetFilter: 'all' })
  })
})

describe('JobsJobSummaryTab · the header says what each number is for (v2.6389)', () => {
  it('804 typed: billed in full under 100% — the chip on the % cell, the note, the Burn words, the tiles and the Proj. true margin header', async () => {
    const job804 = makeJob({
      id: 'j804',
      hcp_number: '804',
      job_name: 'Auto parts store',
      pct_complete: 40,
      revenue: 32_600,
      status: 'billed',
      last_work_date: '2026-10-20',
      invoices: [makeInvoice({ status: 'paid', amount: 11_736 }), makeInvoice({ status: 'paid', amount: 11_736 }), makeInvoice({ status: 'billed', amount: 6_520 }), makeInvoice({ status: 'billed', amount: 2_608 })],
    })
    renderTab({ search: '804', ledgerJobs: [job804, job931], rows: [summaryRow(job804, 32_600, 19_957.12), summaryRow(job931, 48_700)] })
    await settle()
    expect(drawnJobCells()).toEqual([expect.stringContaining('J804')])
    expect(screen.getByTestId('job-summary-billed-in-full').textContent).toBe('billed in full')
    expect(note()).toBe('1 job matches your search. Job 804 is still in progress, so the Show chip stepped aside. Job 804 is billed in full, but its % says 40% done. Read at 40% it is under water. Read as finished its margin is 39%.')
    expect(screen.getByText('94% spent · 40% done')).toBeTruthy()
    expect(screen.getByText('matching your search')).toBeTruthy()
    expect(screen.getByText('Revenue earned')).toBeTruthy()
    expect(screen.getByText('to date · 40% of $32,600')).toBeTruthy()
    expect(screen.getByText('Proj. true margin')).toBeTruthy()
    expect(screen.getByText(/1 job is billed in full but under 100%/)).toBeTruthy()
  })

  it('the window-wide chips fold into one line while a search is on, and a press opens them', async () => {
    const hygiene = { unallocatedUsd: 0, unallocatedDays: 0, pendingFieldSessions: 15, pendingFieldHours: 127.9, poolUsd: 0, carriedInUsd: 0, activityUsd: 0, carryUsd: 0, inFlightUsd: 6_517.2, reconciles: true, offListUsd: 12_745.4, offListJobs: 10 }
    renderTab({ search: '891', ledgerJobs: [job891, job931], rows: rows891And931, hygiene })
    await settle()
    const fold = screen.getByTestId('job-summary-window-chips-fold')
    expect(fold.textContent).toBe('Across the last 90 days: 15 sessions await approval · $6,517 of overhead in flight · $12,745 on 10 jobs off this list ▾')
    expect(screen.queryByText(/127\.9 h counted as recorded time/)).toBeNull()
    fireEvent.click(fold)
    expect(screen.getByText(/127\.9 h counted as recorded time/)).toBeTruthy()
    expect(screen.getByTestId('job-summary-window-chips-fold').textContent).toMatch(/▴$/)
  })
})
