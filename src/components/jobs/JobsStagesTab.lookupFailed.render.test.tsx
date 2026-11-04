// @vitest-environment jsdom
/**
 * A failed lookup is not "no match" (the owner's yes, 2026-11-03). The server lookup is the only part of
 * the Pipeline search that reaches the jobs the board has not loaded. When it failed, the board searched only
 * its own rows and still said *No match anywhere — Paid in Full included*; when the rows it found did not
 * load, the same; and the # jump flashed *No job matches that number*. Now each says what was not searched
 * and why, a lost signal offers Retry, and a refusal shows its reason with none.
 */
import { act, createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

const ALL_SCOPES = ['waiting', 'working', 'ready_to_bill', 'billed_all', 'paid']
const cache = vi.hoisted(() => ({ merged: [] as string[], setJobs: () => {} }))
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
      zzTestJobCount: 0,
    }),
  }
})
type LeanAnswer = { ok: true; ids: string[] } | { ok: false; error: string; errorKind: 'network' | 'server' | 'unknown' }
// What the two lookups answer, case by case: each call takes the next answer, and the last one repeats.
const lean = vi.hoisted(() => ({ search: [] as LeanAnswer[], number: [] as LeanAnswer[], searchCalls: 0 }))
vi.mock('../../lib/jobs/leanJobSearch', async () => {
  const actual = await vi.importActual<typeof import('../../lib/jobs/leanJobSearch')>('../../lib/jobs/leanJobSearch')
  const next = (list: LeanAnswer[]) => (list.length > 1 ? list.shift()! : (list[0] ?? { ok: true as const, ids: [] }))
  return {
    ...actual,
    fetchLeanJobSearchIds: async () => {
      lean.searchCalls += 1
      return next(lean.search)
    },
    fetchLeanJobIdsByNumber: async () => next(lean.number),
  }
})
// The rows a lookup found load, unless a case makes that read fail.
const rows = vi.hoisted(() => ({ fail: null as null | { error: string; errorKind: 'network' | 'server' | 'unknown' } }))
vi.mock('../../lib/fetchJobsLedgerWithDetailsForStages', async () => {
  const actual = await vi.importActual<typeof import('../../lib/fetchJobsLedgerWithDetailsForStages')>(
    '../../lib/fetchJobsLedgerWithDetailsForStages',
  )
  return {
    ...actual,
    fetchJobsLedgerWithDetailsForStages: async (options?: { ids?: string[] }) =>
      options?.ids && rows.fail ? { ok: false as const, ...rows.fail } : actual.fetchJobsLedgerWithDetailsForStages(options),
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

const SEARCH_PLACEHOLDER = 'Search HCP, name, address'
const NETWORK = { ok: false as const, error: 'No connection.', errorKind: 'network' as const }
const REFUSED = { ok: false as const, error: 'You don’t have access to this record.', errorKind: 'server' as const }

function boardJobs() {
  return [makeJob({ job_name: 'Waiting Casa', status: 'waiting' }), makeJob({ job_name: 'Working Duplex', status: 'working' })]
}

const mount = async (props: Partial<JobsStagesTabProps> = {}) => {
  renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: boardJobs(), ...props })} />)
  await settle()
}
const search = async (value: string) => {
  fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), { target: { value } })
  await settle()
}
/** The lookup waits out its debounce before it asks. */
const pastTheLookup = () => act(async () => { await new Promise((r) => setTimeout(r, 360)) })
const failedBlock = () => document.querySelector('[data-testid="stages-search-lookup-failed"]')?.textContent ?? null
const paidHeader = () => [...document.querySelectorAll('button')].map((b) => b.textContent ?? '').find((t) => /Paid in Full \(/.test(t)) ?? null
const jumpField = () => screen.getByRole('textbox', { name: /Job number \(C# or HCP\)/ }) as HTMLInputElement
const jumpTo = async (digits: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Jump to a job by number' }))
  fireEvent.change(jumpField(), { target: { value: digits } })
  fireEvent.keyDown(jumpField(), { key: 'Enter' })
  await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
}

describe('a failed lookup is not "no match"', () => {
  beforeEach(() => {
    localStorage.setItem(
      'pipetooling_stages_sections_v2',
      JSON.stringify({ waiting: true, working: true, readyToBill: true, billed: true, collections: true, paid: true }),
    )
    cache.merged = [...ALL_SCOPES]
    lean.search = []
    lean.number = []
    lean.searchCalls = 0
    rows.fail = null
  })
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('a lost signal says only the board was searched, offers Retry, and never says "No match anywhere"', async () => {
    cache.merged = ALL_SCOPES.filter((s) => s !== 'paid')
    lean.search = [NETWORK]
    await mount()
    await search('Concrete')
    await pastTheLookup()
    expect(screen.queryByText(/No match anywhere/)).toBeNull()
    expect(failedBlock()).toContain('Only the jobs already on the board were searched.')
    expect(failedBlock()).toContain('No connection, so the other jobs were not searched. The search runs again when the signal is back.')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    // Paid in Full holds jobs the lookup never reached, so its header does not count them as none.
    expect(paidHeader()).toContain('not searched')
  })

  it('Retry asks again, and an answer clears the line: a true no match then says so', async () => {
    lean.search = [NETWORK, { ok: true, ids: [] }]
    await mount()
    await search('Concrete')
    await pastTheLookup()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await pastTheLookup()
    expect(lean.searchCalls).toBe(2)
    expect(failedBlock()).toBeNull()
    expect(screen.getByText(/No match anywhere/)).toBeTruthy()
  })

  it('a new term starts clean: the last term’s line comes off while the new lookup runs (v2.6487)', async () => {
    cache.merged = ALL_SCOPES.filter((s) => s !== 'paid')
    lean.search = [NETWORK]
    await mount()
    await search('smith')
    await pastTheLookup()
    expect(failedBlock()).toContain('Only the jobs already on the board were searched.')
    expect(paidHeader()).toContain('not searched')
    await search('smithson')
    // Through the debounce and the request nothing says the new term was searched short.
    expect(failedBlock()).toBeNull()
    expect(paidHeader()).not.toContain('not searched')
    await pastTheLookup()
    expect(lean.searchCalls).toBe(2)
    expect(failedBlock()).toContain('Only the jobs already on the board were searched.')
  })

  it('a refusal shows its reason and no Retry', async () => {
    lean.search = [REFUSED]
    await mount()
    await search('Concrete')
    await pastTheLookup()
    expect(failedBlock()).toContain('Only the jobs already on the board were searched.')
    expect(failedBlock()).toContain('You don’t have access to this record.')
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(screen.queryByText(/No match anywhere/)).toBeNull()
  })

  it('matches on the board still show, with the line saying the rest was not searched', async () => {
    lean.search = [NETWORK]
    await mount()
    await search('Duplex')
    await pastTheLookup()
    expect(screen.getAllByText((_, el) => el?.textContent === 'Working Duplex' && el.children.length <= 3).length).toBeGreaterThan(0)
    expect(failedBlock()).toContain('Only the jobs already on the board were searched.')
  })

  it('found jobs whose rows did not load are counted, not called "no match"', async () => {
    lean.search = [{ ok: true, ids: ['job-unloaded-a', 'job-unloaded-b'] }]
    rows.fail = { error: 'No connection.', errorKind: 'network' }
    await mount()
    await search('Concrete')
    await pastTheLookup()
    expect(failedBlock()).toContain('2 more matches could not be loaded.')
    expect(failedBlock()).toContain('No connection, so they did not load. They load again when the signal is back.')
    expect(screen.queryByText(/No match anywhere/)).toBeNull()
  })

  it('the # jump: a failed lookup says so in a toast and never flashes "No job matches that number"', async () => {
    lean.number = [NETWORK]
    const showToast = vi.fn()
    await mount({ showToast })
    await jumpTo('468')
    expect(showToast).toHaveBeenCalledWith('No connection, so #468 could not be looked up. Try again when the signal is back.', 'error')
    expect(jumpField().value).toBe('468')
    expect(jumpField().title).not.toBe('No job matches that number')
  })

  it('the # jump: a number nobody holds still flashes "No job matches that number"', async () => {
    lean.number = [{ ok: true, ids: [] }]
    const showToast = vi.fn()
    await mount({ showToast })
    await jumpTo('99999')
    expect(jumpField().title).toBe('No job matches that number')
    expect(showToast).not.toHaveBeenCalled()
  })
})
