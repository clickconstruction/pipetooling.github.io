// @vitest-environment jsdom
/**
 * A search whose matches the board's filters hold back (the owner's yes, 2026-11-03). With a
 * development's group hidden, typing its name read *No match anywhere — Paid in Full included*
 * while the jobs sat behind the hide. The board now says how many are held back, and its press
 * shows them until the search is cleared, with the hides left as they were saved.
 *
 * A file of its own so the shared smoke's cache mock keeps its shape: this one also hands out
 * the ZZ ids and stands in for the lean lookup's answer.
 */
import { act, createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

const ALL_SCOPES = ['waiting', 'working', 'ready_to_bill', 'billed_all', 'paid']
// setJobs keeps one identity: the search effect depends on it, and a new one each render never settles.
const cache = vi.hoisted(() => ({ merged: [] as string[], zzCount: 0, zzIds: new Set<string>(), setJobs: () => {} }))
vi.mock('../../contexts/JobsListCacheContext', async () => {
  const actual = await vi.importActual<typeof import('../../contexts/JobsListCacheContext')>(
    '../../contexts/JobsListCacheContext',
  )
  return {
    ...actual,
    useJobsListCache: () => ({
      mergedScopes: new Set(cache.merged),
      scopeLoading: new Set(),
      fetchScopeIfNeeded: async () => {},
      headerStats: null,
      setJobs: cache.setJobs,
      zzTestJobCount: cache.zzCount,
      zzTestJobIds: cache.zzIds,
    }),
  }
})
// What the server's all-jobs lookup answers: the real one over the stub unless a case names ids.
const lean = vi.hoisted(() => ({ ids: null as string[] | null }))
vi.mock('../../lib/jobs/leanJobSearch', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/leanJobSearch')>('../../lib/jobs/leanJobSearch')
  return {
    ...actual,
    fetchLeanJobSearchIds: async (term: string, customer: string | null) =>
      lean.ids ? { ok: true as const, ids: lean.ids } : actual.fetchLeanJobSearchIds(term, customer),
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
import { ZZ_TEST_JOBS_SHOWN_STORAGE_KEY } from '../../lib/jobs/zzTestJobSwitch'

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
const EXCLUDE_KEY = 'jobs-stages-exclude-filters'
const sagemoor = { id: 'dev-sagemoor', name: 'Sagemoor' }
const HIDDEN_SAGEMOOR = JSON.stringify({ gc: [], development: ['dev-sagemoor'], accountMan: [] })

function boardJobs() {
  return [
    makeJob({ job_name: 'Waiting Casa', status: 'waiting' }),
    makeJob({ job_name: 'Working Duplex', status: 'working' }),
    makeJob({ job_name: 'Lot 12', status: 'working', development: sagemoor }),
    makeJob({ job_name: 'Lot 14', status: 'paid', development: sagemoor }),
  ]
}

const mount = async (props: Partial<JobsStagesTabProps> = {}) => {
  renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: boardJobs(), ...props })} />)
  await settle()
}
const search = async (value: string) => {
  fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), { target: { value } })
  await settle()
}
/** The lean lookup waits out its debounce before it asks. */
const pastTheLookup = () => act(async () => { await new Promise((r) => setTimeout(r, 360)) })
const heldBack = () => document.querySelector('[data-testid="stages-search-held-back"]')?.textContent ?? null
const press = async (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }))
  await settle()
}
const boardWords = () => document.body.textContent ?? ''

describe('a search whose matches the filters hold back', () => {
  beforeEach(() => {
    localStorage.setItem(
      'pipetooling_stages_sections_v2',
      JSON.stringify({ waiting: true, working: true, readyToBill: true, billed: true, collections: true, paid: true }),
    )
    localStorage.setItem(EXCLUDE_KEY, HIDDEN_SAGEMOOR)
    cache.merged = [...ALL_SCOPES]
    cache.zzCount = 0
    cache.zzIds = new Set()
    lean.ids = null
  })
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('says how many instead of "No match anywhere", in the sections too, and leaves the rows behind the hide', async () => {
    await mount()
    await search('Sagemoor')
    await pastTheLookup()
    expect(heldBack()).toBe('2 matches are hidden by your filters.Show them')
    expect(screen.queryByText(/No match anywhere/)).toBeNull()
    expect(boardWords()).toContain('No jobs in Working match ‘Sagemoor’ with your filters on.')
    expect(boardWords()).toContain('No jobs in Paid in Full match ‘Sagemoor’ with your filters on.')
    expect(screen.queryByText('Lot 12')).toBeNull()
    expect(screen.queryByText('Lot 14')).toBeNull()
  })

  it('Show them puts the matches on the board until the search is cleared; the hide stays saved', async () => {
    await mount()
    await search('Sagemoor')
    await press('Show them')
    expect(screen.getByText('Lot 12')).toBeTruthy()
    expect(screen.getByText('Lot 14')).toBeTruthy()
    expect(heldBack()).toBe('Showing 2 matches your filters hide.Hide them')
    // The chip still says what is saved, and a section with no match no longer blames the filters.
    expect(screen.getByRole('button', { name: /1 group hidden from the board/ })).toBeTruthy()
    expect(boardWords()).toContain('No jobs in Waiting match ‘Sagemoor’.')
    expect(boardWords()).not.toContain('with your filters on')
    expect(localStorage.getItem(EXCLUDE_KEY)).toBe(HIDDEN_SAGEMOOR)

    await search('')
    expect(screen.queryByText('Lot 12')).toBeNull()
    expect(heldBack()).toBeNull()
    expect(localStorage.getItem(EXCLUDE_KEY)).toBe(HIDDEN_SAGEMOOR)

    // The next search starts behind the filters again.
    await search('Sagemoor')
    expect(screen.queryByText('Lot 12')).toBeNull()
    expect(heldBack()).toBe('2 matches are hidden by your filters.Show them')
  })

  it('Hide them puts the matches back behind the filters with the search still typed', async () => {
    await mount()
    await search('Sagemoor')
    await press('Show them')
    await press('Hide them')
    expect(screen.queryByText('Lot 12')).toBeNull()
    expect(heldBack()).toBe('2 matches are hidden by your filters.Show them')
  })

  it('a match on the board and one behind the filters are both said', async () => {
    await mount({ jobs: [...boardJobs(), makeJob({ job_name: 'Sagemoor Repipe', status: 'waiting' })] })
    await search('Sagemoor')
    await pastTheLookup()
    expect(screen.getByRole('button', { name: 'Show them' })).toBeTruthy()
    expect(heldBack()).toBe('2 matches are hidden by your filters.Show them')
    expect(screen.queryByText(/No match anywhere/)).toBeNull()
  })

  it('a search that matches nothing behind the filters either still says "No match anywhere"', async () => {
    await mount()
    await search('Zanzibar')
    await pastTheLookup()
    expect(heldBack()).toBeNull()
    expect(screen.getByText(/No match anywhere/)).toBeTruthy()
  })

  it('with no filter on, the same search just finds the jobs and says nothing about filters', async () => {
    localStorage.removeItem(EXCLUDE_KEY)
    await mount()
    await search('Sagemoor')
    expect(screen.getByText('Lot 12')).toBeTruthy()
    expect(heldBack()).toBeNull()
    expect(boardWords()).not.toContain('with your filters on')
  })

  it('a dev whose ZZ switch is off is told a match is a ZZ test job, and the press opens Hide groups', async () => {
    localStorage.removeItem(EXCLUDE_KEY)
    cache.zzCount = 1
    cache.zzIds = new Set(['job-zz'])
    lean.ids = ['job-zz']
    await mount()
    await search('test devel')
    await pastTheLookup()
    expect(heldBack()).toBe('1 match is a ZZ test job.Open Hide groups')
    expect(screen.queryByText(/No match anywhere/)).toBeNull()
    await press('Open Hide groups')
    expect(document.getElementById('stages-hide-groups-title')).toBeTruthy()
  })

  it('a dev who shows ZZ test jobs gets no ZZ line: the row is on the board', async () => {
    localStorage.removeItem(EXCLUDE_KEY)
    localStorage.setItem(ZZ_TEST_JOBS_SHOWN_STORAGE_KEY, '1')
    const zz = makeJob({ job_name: 'ZZ Test', status: 'working' })
    cache.zzCount = 1
    cache.zzIds = new Set([zz.id])
    lean.ids = [zz.id]
    await mount({ jobs: [...boardJobs(), zz] })
    await search('test devel')
    await pastTheLookup()
    expect(heldBack()).toBeNull()
    expect(screen.queryByText(/No match anywhere/)).toBeNull()
  })

  it('no other role ever hears of a ZZ job: the lookup found one and the board says no match', async () => {
    localStorage.removeItem(EXCLUDE_KEY)
    cache.zzCount = 1
    cache.zzIds = new Set(['job-zz'])
    lean.ids = ['job-zz']
    await mount({ authRole: 'assistant', myRole: 'assistant' })
    await search('test devel')
    await pastTheLookup()
    expect(heldBack()).toBeNull()
    expect(boardWords()).not.toContain('ZZ test job')
    expect(screen.getByText(/No match anywhere/)).toBeTruthy()
  })
})
