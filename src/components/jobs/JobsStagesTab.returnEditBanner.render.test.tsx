// @vitest-environment jsdom
/**
 * "Back to Edit Job" on the Pipeline, through the real board (the Stages map's step 16). Edit Job's *See in Stages*
 * leaves a note in session storage; the board offers the way back for ten seconds. The banner is its own component
 * now (`StagesReturnEditBanner`); these cases hold for the tab either way. Made-up jobs.
 */
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'

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

import JobsStagesTab, { type JobsStagesTabHandle, type JobsStagesTabProps } from './JobsStagesTab'
import { makeJob, makeUseAuthValue, renderWithProviders } from '../../test/renderSmokeMocks'
import { RETURN_EDIT_JOB_SESSION_KEY, setReturnEditJobFromStages } from '../../lib/returnEditJobFromStages'

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

const jobs = () => [makeJob({ id: 'back-job', job_name: 'Went To Look Duplex', status: 'ready_to_bill' }), makeJob({ id: 'other-job', job_name: 'Other Villa', status: 'working' })]
const tab = (over: Partial<JobsStagesTabProps> = {}) => <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: jobs(), ...over })} />
const banner = () => screen.queryByRole('button', { name: 'Back to Edit Job' })
const note = () => sessionStorage.getItem(RETURN_EDIT_JOB_SESSION_KEY)
const pass = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

describe('JobsStagesTab — Back to Edit Job (map step 16)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
    localStorage.setItem('pipetooling_stages_sections_v2', JSON.stringify({ waiting: false, working: false, readyToBill: false, billed: false, collections: false, paid: false }))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    sessionStorage.clear()
  })

  it('with no note left, the board shows no banner', async () => {
    renderWithProviders(tab())
    await pass(50)
    expect(banner()).toBeNull()
  })

  it('a note brings the banner; Back opens that job in Edit Job with the board’s copy of it, and a save reads the jobs again', async () => {
    setReturnEditJobFromStages('back-job')
    const tryOpenEditJob = vi.fn()
    const loadJobs = vi.fn(async () => [])
    const list = jobs()
    renderWithProviders(tab({ jobs: list, tryOpenEditJob, loadJobs }))
    await pass(50)
    const status = screen.getByRole('status')
    expect(status.contains(banner())).toBe(true)
    fireEvent.click(banner()!)
    expect(tryOpenEditJob).toHaveBeenCalledTimes(1)
    const [jobId, opts] = tryOpenEditJob.mock.calls[0]! as [string, { initialJob?: unknown; onSaved?: () => void }]
    expect(jobId).toBe('back-job')
    expect(opts.initialJob).toBe(list[0])
    // Going back takes the banner and the note with it.
    expect(banner()).toBeNull()
    expect(note()).toBeNull()
    const before = loadJobs.mock.calls.length
    opts.onSaved?.()
    expect(loadJobs.mock.calls.length).toBe(before + 1)
  })

  it('Dismiss takes the banner and the note away and opens nothing', async () => {
    setReturnEditJobFromStages('back-job')
    const tryOpenEditJob = vi.fn()
    renderWithProviders(tab({ tryOpenEditJob }))
    await pass(50)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(banner()).toBeNull()
    expect(note()).toBeNull()
    expect(tryOpenEditJob).not.toHaveBeenCalled()
  })

  it('the banner takes itself down after ten seconds, and the note goes with it', async () => {
    setReturnEditJobFromStages('back-job')
    renderWithProviders(tab())
    await pass(50)
    expect(banner()).not.toBeNull()
    await pass(9_900)
    expect(banner()).not.toBeNull()
    expect(note()).not.toBeNull()
    await pass(200)
    expect(banner()).toBeNull()
    expect(note()).toBeNull()
  })

  it('waits for the jobs to load', async () => {
    setReturnEditJobFromStages('back-job')
    const view = renderWithProviders(tab({ jobsListLoading: true }))
    await pass(50)
    expect(banner()).toBeNull()
    expect(note()).not.toBeNull()
    view.rerender(tab({ jobsListLoading: false }))
    await pass(50)
    expect(banner()).not.toBeNull()
  })

  it('a hidden board shows none and throws the note away, so showing the board later brings nothing back', async () => {
    setReturnEditJobFromStages('back-job')
    const view = renderWithProviders(tab({ active: false }))
    await pass(50)
    expect(banner()).toBeNull()
    expect(note()).toBeNull()
    view.rerender(tab({ active: true }))
    await pass(50)
    expect(banner()).toBeNull()
  })

  it('hiding the board takes a showing banner down', async () => {
    setReturnEditJobFromStages('back-job')
    const view = renderWithProviders(tab())
    await pass(50)
    expect(banner()).not.toBeNull()
    view.rerender(tab({ active: false }))
    await pass(50)
    expect(banner()).toBeNull()
    expect(note()).toBeNull()
  })

  it('only the Pipeline’s own addresses pick the note up: another tab’s address leaves it where it is', async () => {
    setReturnEditJobFromStages('back-job')
    renderWithProviders(tab(), { route: '/jobs?tab=parts' })
    await pass(50)
    expect(banner()).toBeNull()
    expect(note()).not.toBeNull()
    cleanup()
    for (const route of ['/jobs', '/jobs?tab=stages', '/jobs?tab=billed']) {
      setReturnEditJobFromStages('back-job')
      renderWithProviders(tab(), { route })
      await pass(50)
      expect(banner()).not.toBeNull()
      cleanup()
    }
  })

  it('a note older than fifteen minutes brings nothing', async () => {
    sessionStorage.setItem(RETURN_EDIT_JOB_SESSION_KEY, JSON.stringify({ jobId: 'back-job', at: Date.now() - 16 * 60 * 1000 }))
    renderWithProviders(tab())
    await pass(50)
    expect(banner()).toBeNull()
  })
})
