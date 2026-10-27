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

function buildView(rows: JobSummaryRow[], search: string, prefs: JobSummaryViewPrefs): JobSummaryViewBundle<JobSummaryRow> {
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
    hygiene: null,
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

function renderTab(args: { search: string; ledgerJobs: JobWithDetails[]; rows: JobSummaryRow[]; liftedJobIds?: ReadonlySet<string> }) {
  const prefs: JobSummaryViewPrefs = { ...JOB_SUMMARY_VIEW_DEFAULTS, window: '90d' }
  const props: JobsJobSummaryTabProps = {
    view: buildView(args.rows, args.search, prefs),
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
