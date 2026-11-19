// @vitest-environment jsdom
/**
 * The age of the remembered board on the Pipeline, through the real board (the Stages map's step 25): the chip rides
 * the *Updating jobs…* line while a refresh runs over the kept board, and the line that says the refresh did not
 * land. These cases hold for the tab before the chip had its own file and after. Made-up jobs.
 */
import { createRef } from 'react'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../contexts/JobsListCacheContext', async () => {
  const actual = await vi.importActual<typeof import('../../contexts/JobsListCacheContext')>('../../contexts/JobsListCacheContext')
  return {
    ...actual,
    useJobsListCache: () => ({ mergedScopes: new Set(['waiting', 'working', 'ready_to_bill', 'billed_all', 'paid']), scopeLoading: new Set(), fetchScopeIfNeeded: async () => {}, headerStats: null }),
  }
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import JobsStagesTab, { type JobsStagesTabHandle, type JobsStagesTabProps } from './JobsStagesTab'
import { makeJob, makeUseAuthValue, renderWithProviders, settle } from '../../test/renderSmokeMocks'

const authValue = makeUseAuthValue()

function makeProps(overrides: Partial<JobsStagesTabProps> = {}): JobsStagesTabProps {
  return {
    active: true,
    error: null,
    setError: vi.fn(),
    jobs: [],
    jobsListLoading: false,
    jobsListRefreshing: false,
    jobsListError: null,
    paidJobsLoading: false,
    jobsListDataKey: 'k1',
    paidJobsMergedForKey: null,
    loadJobs: vi.fn(async () => []),
    runFetchJobs: vi.fn(async () => []),
    fetchPaidJobsIfNeeded: vi.fn(async () => {}),
    customerFilterForFetch: null,
    scheduleLoadJobsAfterMutation: vi.fn(),
    authUser: authValue.user as JobsStagesTabProps['authUser'],
    authRole: 'dev',
    authProfileName: 'Smoke Dev',
    myRole: 'dev',
    users: [],
    customers: [],
    showToast: vi.fn(),
    shortNewJobButtonLabel: false,
    openNew: vi.fn(),
    openEdit: vi.fn(),
    openEditJobAndCreateCustomerFlow: vi.fn(),
    tryOpenEditJob: vi.fn(),
    openStagesDetailJobModal: vi.fn(),
    refreshCustomersAfterJobFormSave: vi.fn(),
    billCustomer: { openBillCustomer: vi.fn() } as unknown as JobsStagesTabProps['billCustomer'],
    stagesStatusUpdatingId: null,
    stagesInvoiceUpdatingId: null,
    updateJobStatus: vi.fn(async () => {}),
    moveJobToReadyToBillWithStripePrep: vi.fn(async () => {}),
    revertBilledInvoiceToReadyToBill: vi.fn(async () => {}),
    deleteInvoice: vi.fn(async () => {}),
    invoiceEstimatedBillDateSavingId: null,
    setInvoiceEstimatedBillDate: vi.fn(async () => {}),
    bumpInvoiceEstimatedBillDate: vi.fn(async () => {}),
    pctCompleteSavingId: null,
    updateJobPctComplete: vi.fn(async () => {}),
    commitStagesPctWithNote: vi.fn(async () => {}),
    expandedJobThreadId: null,
    setExpandedJobThreadId: vi.fn(),
    jobThreadActivityByJobId: {},
    jobThreadNotesLoadingId: null,
    jobThreadSubmittingId: null,
    jobThreadDraft: '',
    setJobThreadDraft: vi.fn(),
    submitJobThreadNote: vi.fn(async () => {}),
    jobThreadStatsByJobId: {},
    refreshJobThreadStatsForJobIds: vi.fn(async () => {}),
    ...overrides,
  } as JobsStagesTabProps
}

const tab = (over: Partial<JobsStagesTabProps> = {}) => <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: [makeJob({ id: 'sn-1', job_name: 'Kept Duplex', status: 'working' })], ...over })} />
const FIVE_MIN_AGO = () => Date.now() - 5 * 60_000

describe('JobsStagesTab — the age of the remembered board (map step 25)', () => {
  beforeEach(() => {
    localStorage.setItem('pipetooling_stages_sections_v2', JSON.stringify({ waiting: false, working: true, readyToBill: false, billed: false, collections: false, paid: false }))
  })
  afterEach(cleanup)

  it('while a refresh runs over the kept board, Updating jobs… names its age', async () => {
    renderWithProviders(tab({ jobsListRefreshing: true, jobsListSnapshotAt: FIVE_MIN_AGO() } as Partial<JobsStagesTabProps>))
    await settle()
    const line = screen.getByText(/^Updating jobs…/)
    expect(line.textContent).toBe('Updating jobs…board from 5 min ago')
  })

  it('a refresh that did not land says so, with the kept board’s age', async () => {
    renderWithProviders(tab({ jobsListRefreshing: false, jobsListSnapshotAt: FIVE_MIN_AGO() } as Partial<JobsStagesTabProps>))
    await settle()
    const line = screen.getByText(/^Showing the board this device remembered/)
    expect(line.getAttribute('role')).toBe('status')
    expect(line.textContent).toMatch(/board from 5 min ago$/)
  })

  it('a refresh over a board read fresh names no age', async () => {
    renderWithProviders(tab({ jobsListRefreshing: true, jobsListSnapshotAt: null } as Partial<JobsStagesTabProps>))
    await settle()
    expect(screen.getByText(/^Updating jobs…/).textContent).toBe('Updating jobs…')
    expect(screen.queryByText(/board from/)).toBeNull()
  })

  it('a fresh board with no refresh running shows neither line', async () => {
    renderWithProviders(tab({ jobsListRefreshing: false, jobsListSnapshotAt: null } as Partial<JobsStagesTabProps>))
    await settle()
    expect(screen.queryByText(/^Updating jobs…/)).toBeNull()
    expect(screen.queryByText(/^Showing the board this device remembered/)).toBeNull()
  })
})
