// @vitest-environment jsdom
/**
 * The Pipeline's three contract windows, through the real board (the Stages map's step 24). The windows are probes
 * that record what they are handed; these cases pin what the board does with them: they sit in the modal tail,
 * mounted whether or not the board shows, and `?contractSweep=1` opens the sweep, whose last press filters the
 * board. They hold for the tab before the host and after it. Made-up jobs.
 */
import { createRef } from 'react'
import { act, cleanup, screen } from '@testing-library/react'
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
type Props = Record<string, unknown>
const seen = vi.hoisted(() => ({ contract: [] as Props[], sweep: [] as Props[] }))
vi.mock('./JobContractModal', () => ({ default: (p: Props) => (seen.contract.push(p), <div data-testid="contract-window" data-open={String(p.open)} />) }))
vi.mock('./JobsContractSweepModal', () => ({ default: (p: Props) => (seen.sweep.push(p), <div data-testid="contract-sweep" data-open={String(p.open)} />) }))

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

const last = (list: Props[]) => list[list.length - 1]!
const jobs = () => [makeJob({ id: 'cw-1', job_name: 'Contract Duplex', status: 'working', revenue: 9000 }), makeJob({ id: 'cw-2', job_name: 'Contract Villa', status: 'waiting', revenue: 4000 })]
const tab = (over: Partial<JobsStagesTabProps> = {}) => <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: jobs(), ...over })} />

describe('JobsStagesTab — the contract windows (map step 24)', () => {
  beforeEach(() => {
    localStorage.setItem('pipetooling_stages_sections_v2', JSON.stringify({ waiting: true, working: true, readyToBill: false, billed: false, collections: false, paid: false }))
    seen.contract = []
    seen.sweep = []
  })
  afterEach(() => {
    cleanup()
    window.history.replaceState(null, '', '/')
  })

  it('the Contract window and the sweep sit in the modal tail: mounted shut, even while the board is hidden', async () => {
    renderWithProviders(tab({ active: false }))
    await settle()
    expect(screen.getByTestId('contract-window').getAttribute('data-open')).toBe('false')
    expect(last(seen.contract).job).toBeNull()
    expect(screen.getByTestId('contract-sweep').getAttribute('data-open')).toBe('false')
  })

  it('?contractSweep=1 opens the sweep on the board’s jobs, and its last press shuts it and filters the board', async () => {
    window.history.replaceState(null, '', '/?contractSweep=1')
    const list = jobs()
    renderWithProviders(tab({ jobs: list }))
    await settle()
    expect(last(seen.sweep).open).toBe(true)
    expect(last(seen.sweep).jobs).toBe(list)
    expect(screen.queryByRole('button', { name: /^Clear contract filter/ })).toBeNull()
    act(() => {
      ;(last(seen.sweep).onFilterBoard as () => void)()
    })
    await settle()
    expect(last(seen.sweep).open).toBe(false)
    expect(screen.getByRole('button', { name: /^Clear contract filter/ })).toBeTruthy()
  })

  it('the sweep’s close shuts it and leaves the board unfiltered', async () => {
    window.history.replaceState(null, '', '/?contractSweep=1')
    renderWithProviders(tab())
    await settle()
    act(() => {
      ;(last(seen.sweep).onClose as () => void)()
    })
    await settle()
    expect(last(seen.sweep).open).toBe(false)
    expect(screen.queryByRole('button', { name: /^Clear contract filter/ })).toBeNull()
  })

  it('the sweep’s Edit Job press opens that job in the page’s Edit Job', async () => {
    window.history.replaceState(null, '', '/?contractSweep=1')
    const openEdit = vi.fn()
    const list = jobs()
    renderWithProviders(tab({ jobs: list, openEdit }))
    await settle()
    act(() => {
      ;(last(seen.sweep).onEditJob as (j: unknown) => void)(list[1])
    })
    expect(openEdit).toHaveBeenCalledWith(list[1])
  })
})
