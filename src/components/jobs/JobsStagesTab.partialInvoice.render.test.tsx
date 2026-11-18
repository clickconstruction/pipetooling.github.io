// @vitest-environment jsdom
/**
 * A partial invoice from the Pipeline, through the real board and the real dialog (the Stages map's step 19): a
 * card's Partial invoice, an amount, Create invoice. The write itself is `lib/jobs/draftInvoiceWrite` now; these cases
 * hold for the tab either way, and pin the row that reaches the database. Made-up jobs and amounts.
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
// The stub client, with the bill-line insert and the remainder re-sync recorded and answered from `db`.
const db = vi.hoisted(() => ({
  inserts: [] as unknown[],
  rpcs: [] as string[],
  insertAnswer: { data: { id: 'inv-new' }, error: null } as { data: unknown; error: unknown },
}))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  const plainFrom = stub.from as unknown as (table: string) => Record<string, unknown>
  const plainRpc = stub.rpc as unknown as (...args: unknown[]) => unknown
  return {
    supabase: {
      ...stub,
      from: (table: string) => {
        const builder = plainFrom(table)
        if (table !== 'jobs_ledger_invoices') return builder
        return {
          ...builder,
          insert: (row: unknown) => {
            db.inserts.push(row)
            const chain = { select: () => chain, single: () => Promise.resolve(db.insertAnswer) }
            return chain
          },
        }
      },
      rpc: (name: string, ...rest: unknown[]) => {
        if (name === 'ensure_single_ready_to_bill_invoice_for_job') db.rpcs.push(name)
        return plainRpc(name, ...rest)
      },
    },
  }
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

const job = () => makeJob({ id: 'pi-job', job_name: 'Partial Duplex', status: 'working', hcp_number: '878', revenue: 5000, payments_made: 0, invoices: [] })
const tab = (over: Partial<JobsStagesTabProps> = {}) => <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: [job()], ...over })} />
const dialog = () => screen.queryByText('Create partial invoice')
/** The card's ⋯ sheet, Partial invoice, the amount, Create invoice. */
async function createPartialInvoice(amount: string) {
  fireEvent.click(screen.getByRole('button', { name: /^More actions for / }))
  fireEvent.click(screen.getByText('Partial invoice'))
  expect(dialog()).not.toBeNull()
  fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: amount } })
  fireEvent.click(screen.getByText('Create invoice'))
  await settle()
}

describe('JobsStagesTab — a partial invoice from a card (map step 19)', () => {
  beforeEach(() => {
    localStorage.setItem('pipetooling_stages_sections_v2', JSON.stringify({ waiting: false, working: true, readyToBill: false, billed: false, collections: false, paid: false }))
    localStorage.setItem('jobs-stages-mobile-cards', 'true')
    db.inserts = []
    db.rpcs = []
    db.insertAnswer = { data: { id: 'inv-new' }, error: null }
  })
  afterEach(() => {
    cleanup()
    localStorage.removeItem('jobs-stages-mobile-cards')
  })

  it('writes one ready-to-bill line for the typed amount, closes the dialog, clears the error and reads the jobs again', async () => {
    const loadJobs = vi.fn(async () => [])
    const setError = vi.fn()
    renderWithProviders(tab({ loadJobs, setError }))
    await settle()
    const loadsBefore = loadJobs.mock.calls.length
    await createPartialInvoice('1200')
    expect(db.inserts).toEqual([{ job_id: 'pi-job', amount: 1200, status: 'ready_to_bill', sequence_order: 0, estimated_bill_date: null, is_primary_rtb_bundle: false }])
    // A Working job has no remainder draft to re-sync.
    expect(db.rpcs).toEqual([])
    expect(dialog()).toBeNull()
    expect(setError).toHaveBeenLastCalledWith(null)
    expect(loadJobs.mock.calls.length).toBe(loadsBefore + 1)
  })

  it('an amount over what the job has left is cut to it, with a toast that says so', async () => {
    const showToast = vi.fn()
    renderWithProviders(tab({ showToast }))
    await settle()
    await createPartialInvoice('9000')
    expect(showToast).toHaveBeenCalledWith('Adjusted to remaining unallocated ($5,000.00)', 'info')
    expect(db.inserts).toHaveLength(1)
    expect((db.inserts[0] as { amount: number }).amount).toBe(5000)
  })

  it('a refused insert leaves the dialog open with the database’s words, and reads nothing again', async () => {
    db.insertAnswer = { data: null, error: { message: 'new row violates row-level security policy', details: 'Failing row.', hint: 'Ask the office.', code: '42501' } }
    const loadJobs = vi.fn(async () => [])
    const setError = vi.fn()
    renderWithProviders(tab({ loadJobs, setError }))
    await settle()
    const loadsBefore = loadJobs.mock.calls.length
    await createPartialInvoice('1200')
    expect(db.inserts).toHaveLength(1)
    expect(setError).toHaveBeenLastCalledWith('new row violates row-level security policy. Failing row. Ask the office.')
    expect(dialog()).not.toBeNull()
    expect(loadJobs.mock.calls.length).toBe(loadsBefore)
    // The button is live again for another try.
    expect((screen.getByText('Create invoice') as HTMLButtonElement).disabled).toBe(false)
  })

  it('the new line takes the next place after the job’s bill lines', async () => {
    const withLines = makeJob({
      id: 'pi-job',
      job_name: 'Partial Duplex',
      status: 'working',
      revenue: 5000,
      payments_made: 0,
      invoices: [
        { id: 'inv-a', job_id: 'pi-job', amount: 1000, status: 'billed', sequence_order: 0, billed_at: '2026-10-01T18:00:00Z', estimated_bill_date: null },
        { id: 'inv-b', job_id: 'pi-job', amount: 500, status: 'ready_to_bill', sequence_order: 1, billed_at: null, estimated_bill_date: null },
      ] as never,
    })
    renderWithProviders(tab({ jobs: [withLines] }))
    await settle()
    await createPartialInvoice('700')
    expect(db.inserts).toEqual([{ job_id: 'pi-job', amount: 700, status: 'ready_to_bill', sequence_order: 2, estimated_bill_date: null, is_primary_rtb_bundle: false }])
  })

  it('a refusal with no words of its own says the invoice was not created', async () => {
    db.insertAnswer = { data: null, error: { code: 'XX000' } }
    const setError = vi.fn()
    renderWithProviders(tab({ setError }))
    await settle()
    await createPartialInvoice('1200')
    expect(setError).toHaveBeenLastCalledWith('Failed to create invoice')
    expect(dialog()).not.toBeNull()
  })

  it('a reload that fails after a good write says so on the page; the line is in and the dialog is closed', async () => {
    let fail = false
    const loadJobs = vi.fn(async () => {
      if (fail) throw new Error('Could not load jobs')
      return []
    })
    const setError = vi.fn()
    renderWithProviders(tab({ loadJobs, setError }))
    await settle()
    fail = true
    await createPartialInvoice('1200')
    expect(db.inserts).toHaveLength(1)
    expect(dialog()).toBeNull()
    expect(setError).toHaveBeenLastCalledWith('Could not load jobs')
  })
})
