// @vitest-environment jsdom
/**
 * The Pipeline's partial invoice goes through the job form's draft-invoice write (`lib/jobs/draftInvoiceWrite`, the
 * Stages map's step 19). This pins what the tab hands it: the job, the planned amount and place, the job's own status
 * (which decides the remainder's re-sync) and the label the retry reports under. The board cannot open the dialog
 * on a Ready to Bill job today, so the re-sync itself is pinned in the lib's tests.
 */
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

const ALL_SCOPES = ['waiting', 'working', 'ready_to_bill', 'billed_all', 'paid']
vi.mock('../../contexts/JobsListCacheContext', async () => {
  const actual = await vi.importActual<typeof import('../../contexts/JobsListCacheContext')>('../../contexts/JobsListCacheContext')
  return {
    ...actual,
    useJobsListCache: () => ({ mergedScopes: new Set(ALL_SCOPES), scopeLoading: new Set(), fetchScopeIfNeeded: async () => {}, headerStats: null }),
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
const write = vi.hoisted(() => ({ calls: [] as unknown[][], answer: { invoiceId: 'inv-new', ensureFailure: null as string | null } }))
vi.mock('../../lib/jobs/draftInvoiceWrite', async (original) => {
  const actual = await original<typeof import('../../lib/jobs/draftInvoiceWrite')>()
  return {
    ...actual,
    writeDraftInvoice: async (...args: unknown[]) => {
      write.calls.push(args)
      return write.answer
    },
  }
})

import JobsStagesTab, { type JobsStagesTabHandle, type JobsStagesTabProps } from './JobsStagesTab'
import { supabase } from '../../lib/supabase'
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

const tab = (over: Partial<JobsStagesTabProps> = {}) => <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps(over)} />
async function createPartialInvoice(amount: string) {
  fireEvent.click(screen.getByRole('button', { name: /^More actions for / }))
  fireEvent.click(screen.getByText('Partial invoice'))
  fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: amount } })
  fireEvent.click(screen.getByText('Create invoice'))
  await settle()
}

describe('JobsStagesTab — the partial invoice goes through the shared draft write (map step 19)', () => {
  beforeEach(() => {
    localStorage.setItem('jobs-stages-mobile-cards', 'true')
    write.calls = []
    write.answer = { invoiceId: 'inv-new', ensureFailure: null }
  })
  afterEach(() => {
    cleanup()
    localStorage.removeItem('jobs-stages-mobile-cards')
  })

  for (const status of ['working', 'waiting'] as const) {
    it(`hands the write the job, the planned amount and place, and the job’s own status (${status})`, async () => {
      localStorage.setItem('pipetooling_stages_sections_v2', JSON.stringify({ waiting: true, working: true, readyToBill: false, billed: false, collections: false, paid: false }))
      renderWithProviders(tab({ jobs: [makeJob({ id: 'pi-job', job_name: 'Partial Duplex', status, revenue: 5000, payments_made: 0, invoices: [] })] }))
      await settle()
      await createPartialInvoice('1200')
      expect(write.calls).toHaveLength(1)
      expect(write.calls[0]![0]).toBe(supabase)
      expect(write.calls[0]![1]).toEqual({ jobId: 'pi-job', amount: 1200, sequenceOrder: 0, jobStatus: status, resyncLabel: 'ensure RTB remainder after partial invoice' })
    })
  }

  it('a write whose re-sync failed says the invoice is in and the remainder is not, and still reads the jobs again', async () => {
    localStorage.setItem('pipetooling_stages_sections_v2', JSON.stringify({ waiting: false, working: true, readyToBill: false, billed: false, collections: false, paid: false }))
    write.answer = { invoiceId: 'inv-new', ensureFailure: 'Job is locked for billing' }
    const setError = vi.fn()
    const loadJobs = vi.fn(async () => [])
    renderWithProviders(tab({ jobs: [makeJob({ id: 'pi-job', job_name: 'Partial Duplex', status: 'working', revenue: 5000, payments_made: 0, invoices: [] })], setError, loadJobs }))
    await settle()
    const loadsBefore = loadJobs.mock.calls.length
    await createPartialInvoice('1200')
    expect(setError).toHaveBeenLastCalledWith('Invoice created, but the remainder draft did not re-sync: Job is locked for billing')
    expect(screen.queryByText('Create partial invoice')).toBeNull()
    expect(loadJobs.mock.calls.length).toBe(loadsBefore + 1)
  })
})
