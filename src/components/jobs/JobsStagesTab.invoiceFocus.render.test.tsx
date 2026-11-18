// @vitest-environment jsdom
/**
 * Jumping to a bill on the Pipeline while a search is on (the Stages map's step 20, its quirk 17). The board shows a
 * job the search found two ways: the words match what the board holds, or the server lookup found it by something
 * the board's own match does not read, an old job number for one. The jump to one of that job's bills has to look
 * through the same rows the board shows. It used to keep an old copy of the lookup's finds, so it said *Clear the
 * Stages search to see this invoice* about a bill that was on screen. Made-up jobs.
 */
import { act, createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

// One cache object for the whole file: the board's effects key on these functions, so they must not change between renders.
const cache = vi.hoisted(() => ({ value: null as unknown }))
vi.mock('../../contexts/JobsListCacheContext', async () => {
  const actual = await vi.importActual<typeof import('../../contexts/JobsListCacheContext')>('../../contexts/JobsListCacheContext')
  cache.value = { mergedScopes: new Set(['waiting', 'working', 'ready_to_bill', 'billed_all', 'paid']), scopeLoading: new Set(), fetchScopeIfNeeded: async () => {}, headerStats: null, setJobs: () => {}, zzTestJobCount: 0 }
  return { ...actual, useJobsListCache: () => cache.value }
})
// The server lookup's answer, case by case.
const lean = vi.hoisted(() => ({ ids: [] as string[], calls: 0 }))
vi.mock('../../lib/jobs/leanJobSearch', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/leanJobSearch')>('../../lib/jobs/leanJobSearch')
  return {
    ...actual,
    fetchLeanJobSearchIds: async () => {
      lean.calls += 1
      return { ok: true as const, ids: lean.ids }
    },
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
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'

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

const SEARCH_PLACEHOLDER = 'Search HCP, name, address'
/** A job billed five days ago, one bill for the whole job. */
function billedJob(id: string, name: string) {
  const j = makeJob({ id, job_name: name, status: 'billed', revenue: 900, payments_made: 0 })
  const billedAt = `${ymdAddDays(todayYmdInAppTz(), -5)}T18:00:00.000Z`
  return { ...j, invoices: [{ id: `inv-${id}`, job_id: j.id, amount: 900, status: 'billed', sequence_order: 0, billed_at: billedAt, estimated_bill_date: null }] } as typeof j
}
const search = async (value: string) => {
  fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), { target: { value } })
  await settle()
}
/** The lookup waits out its debounce before it asks. */
const pastTheLookup = () => act(async () => { await new Promise((r) => setTimeout(r, 380)) })
const rowOf = (id: string) => document.querySelector(`[data-stages-job-id="${id}"]`)

describe('JobsStagesTab — jumping to a bill while a search is on (map step 20)', () => {
  beforeEach(() => {
    localStorage.setItem('pipetooling_stages_sections_v2', JSON.stringify({ waiting: false, working: false, readyToBill: true, billed: true, collections: true, paid: false }))
    localStorage.setItem('jobs-stages-mobile-cards', 'false')
    lean.ids = []
    lean.calls = 0
  })
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('a bill of a job the server lookup found is on the board, so the jump finds it and says nothing about clearing the search', async () => {
    const ref = createRef<JobsStagesTabHandle>()
    const showToast = vi.fn()
    // Nothing about this job matches the words typed; the lookup finds it, as it would by an old job number.
    lean.ids = ['found-by-lookup']
    renderWithProviders(<JobsStagesTab ref={ref} {...makeProps({ jobs: [billedJob('found-by-lookup', 'Lookup Diner'), billedJob('other', 'Other Villa')], showToast })} />)
    await settle()
    await search('zz-old-number-77')
    await pastTheLookup()
    expect(lean.calls).toBeGreaterThan(0)
    // The board shows the job the lookup found, and not the other.
    expect(rowOf('found-by-lookup')).not.toBeNull()
    expect(rowOf('other')).toBeNull()
    let found = false
    act(() => {
      found = ref.current!.focusInvoice('inv-found-by-lookup')
    })
    expect(found).toBe(true)
    expect(showToast).not.toHaveBeenCalledWith('Clear the Stages search to see this invoice.', 'info')
  })

  it('a bill the search really hides still says to clear the search', async () => {
    const ref = createRef<JobsStagesTabHandle>()
    const showToast = vi.fn()
    lean.ids = ['found-by-lookup']
    renderWithProviders(<JobsStagesTab ref={ref} {...makeProps({ jobs: [billedJob('found-by-lookup', 'Lookup Diner'), billedJob('other', 'Other Villa')], showToast })} />)
    await settle()
    await search('zz-old-number-77')
    await pastTheLookup()
    let found = true
    act(() => {
      found = ref.current!.focusInvoice('inv-other')
    })
    expect(found).toBe(false)
    expect(showToast).toHaveBeenCalledWith('Clear the Stages search to see this invoice.', 'info')
  })

  it('with no search on, the jump finds any bill on the board', async () => {
    const ref = createRef<JobsStagesTabHandle>()
    const showToast = vi.fn()
    renderWithProviders(<JobsStagesTab ref={ref} {...makeProps({ jobs: [billedJob('found-by-lookup', 'Lookup Diner'), billedJob('other', 'Other Villa')], showToast })} />)
    await settle()
    let found = false
    act(() => {
      found = ref.current!.focusInvoice('inv-other')
    })
    expect(found).toBe(true)
    expect(showToast).not.toHaveBeenCalled()
  })

  it('a bill that is not on the board at all says so', async () => {
    const ref = createRef<JobsStagesTabHandle>()
    const showToast = vi.fn()
    renderWithProviders(<JobsStagesTab ref={ref} {...makeProps({ jobs: [billedJob('other', 'Other Villa')], showToast })} />)
    await settle()
    let found = true
    act(() => {
      found = ref.current!.focusInvoice('inv-nowhere')
    })
    expect(found).toBe(false)
    expect(showToast).toHaveBeenCalledWith('That invoice isn’t on the Pipeline board right now.', 'info')
  })
})
