// @vitest-environment jsdom
/**
 * Man-hours on a Pipeline row, through the real board (the Stages map's step 15): the board reads
 * `get_man_hours_by_job` once, a moment after it shows, and each row draws its job's total with the people behind it.
 * The read is the hook's now (`useStagesManHours`); these cases hold for the tab either way. Made-up names and hours.
 */
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup } from '@testing-library/react'

const ALL_SCOPES = ['waiting', 'working', 'ready_to_bill', 'billed_all', 'paid']
vi.mock('../../contexts/JobsListCacheContext', async () => {
  const actual = await vi.importActual<typeof import('../../contexts/JobsListCacheContext')>('../../contexts/JobsListCacheContext')
  return {
    ...actual,
    useJobsListCache: () => ({ mergedScopes: new Set(ALL_SCOPES), scopeLoading: new Set(), fetchScopeIfNeeded: async () => {}, headerStats: null }),
  }
})
// The stub client, with the one RPC this file is about answered from `hours`.
const hours = vi.hoisted(() => ({ rows: [] as Array<{ job_id: string; person_name: string; man_hours: number }>, fail: false, calls: 0 }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  const plainRpc = stub.rpc as unknown as (...args: unknown[]) => unknown
  return {
    supabase: {
      ...stub,
      rpc: (name: string, ...rest: unknown[]) => {
        if (name !== 'get_man_hours_by_job') return plainRpc(name, ...rest)
        hours.calls += 1
        return Promise.resolve(hours.fail ? { data: null, error: { message: 'refused', code: '42501' } } : { data: hours.rows, error: null })
      },
    },
  }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import JobsStagesTab, { type JobsStagesTabHandle, type JobsStagesTabProps } from './JobsStagesTab'
import { makeJob, makeUseAuthValue, renderWithProviders } from '../../test/renderSmokeMocks'
import { formatDecimalWorkHoursToHhMm } from '../../lib/formatDecimalWorkHoursHhMm'

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

const rowOf = (id: string): HTMLElement => {
  const el = document.querySelector<HTMLElement>(`tr[data-stages-job-id="${id}"]`)
  if (!el) throw new Error(`no row for ${id}`)
  return el
}
/** Let the 80 ms wait pass and the read land. */
const letTheReadLand = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200)
  })
}
const jobs = () => [
  makeJob({ id: 'mh-a', job_name: 'Hours Duplex', status: 'working' }),
  makeJob({ id: 'mh-b', job_name: 'Quiet Villa', status: 'working' }),
]
const tab = (over: Partial<JobsStagesTabProps> = {}) => <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: jobs(), ...over })} />

describe('JobsStagesTab — man-hours on a row (map step 15)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.setItem('pipetooling_stages_sections_v2', JSON.stringify({ waiting: false, working: true, readyToBill: false, billed: false, collections: false, paid: false }))
    localStorage.setItem('jobs-stages-mobile-cards', 'false')
    hours.rows = [
      { job_id: 'mh-a', person_name: 'Ana Made', man_hours: 4.5 },
      { job_id: 'mh-a', person_name: 'Ben Up', man_hours: 8 },
    ]
    hours.fail = false
    hours.calls = 0
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    localStorage.removeItem('jobs-stages-mobile-cards')
  })

  it('reads once, a moment after the board shows, and the row draws the total with its people, most hours first', async () => {
    renderWithProviders(tab())
    expect(hours.calls).toBe(0)
    await letTheReadLand()
    expect(hours.calls).toBe(1)
    const people = `Ben Up ${formatDecimalWorkHoursToHhMm(8)} · Ana Made ${formatDecimalWorkHoursToHhMm(4.5)}`
    const chip = rowOf('mh-a').querySelector<HTMLElement>(`[title="${people}"]`)
    expect(chip?.textContent).toContain(formatDecimalWorkHoursToHhMm(12.5))
    // A job with no hours has no people behind its line.
    expect(rowOf('mh-b').querySelector(`[title="${people}"]`)).toBeNull()
    expect(rowOf('mh-b').querySelector('[title="Man-hours applied (crew assignments)"]')?.textContent).toContain(formatDecimalWorkHoursToHhMm(0))
  })

  it('a board that is not showing reads nothing, and showing it again does not read twice', async () => {
    const view = renderWithProviders(tab({ active: false }))
    await letTheReadLand()
    expect(hours.calls).toBe(0)
    view.rerender(tab({ active: true }))
    await letTheReadLand()
    expect(hours.calls).toBe(1)
    view.rerender(tab({ active: false }))
    view.rerender(tab({ active: true }))
    await letTheReadLand()
    expect(hours.calls).toBe(1)
    expect(rowOf('mh-a').textContent).toContain(formatDecimalWorkHoursToHhMm(12.5))
  })

  it('a read that is refused draws no hours and is tried again the next time the board shows', async () => {
    hours.fail = true
    const view = renderWithProviders(tab())
    await letTheReadLand()
    expect(hours.calls).toBe(1)
    expect(rowOf('mh-a').textContent).not.toContain(formatDecimalWorkHoursToHhMm(12.5))
    hours.fail = false
    view.rerender(tab({ active: false }))
    view.rerender(tab({ active: true }))
    await letTheReadLand()
    expect(hours.calls).toBe(2)
    expect(rowOf('mh-a').textContent).toContain(formatDecimalWorkHoursToHhMm(12.5))
  })

  it('with nobody signed in the board reads nothing', async () => {
    renderWithProviders(tab({ authUser: null }))
    await letTheReadLand()
    expect(hours.calls).toBe(0)
  })
})
