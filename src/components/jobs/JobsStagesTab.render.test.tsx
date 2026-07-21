// @vitest-environment jsdom
/**
 * Render-smoke tests for JobsStagesTab — the always-mounted Stages surface
 * extracted from Jobs.tsx in v2.831 (the biggest of the decomposition moves).
 *
 * The critical contract under test: the component stays MOUNTED when the user
 * leaves the Stages tab (`active={false}` renders no board but keeps hooks and
 * state alive), so tab-owned state (search text, open sections) must survive an
 * active → inactive → active round trip exactly as it did when the state lived
 * in Jobs.tsx.
 */
import { act, createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// Children in the always-rendered modal tail (ManageJobPeopleModal,
// BilledBillViewModal, AiaG702G703Modal, LienToolingPrefillModal) call
// useAuth() unconditionally; there is no AuthProvider in the smoke harness.
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import JobsStagesTab, {
  type JobsStagesTabHandle,
  type JobsStagesTabProps,
} from './JobsStagesTab'
import {
  makeJob,
  makeUseAuthValue,
  renderWithProviders,
} from '../../test/renderSmokeMocks'

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

const SEARCH_PLACEHOLDER = 'Search HCP, name, address, schedule notes, or clock notes'

function boardJobs() {
  return [
    makeJob({ job_name: 'Waiting Casa', status: 'waiting' }),
    makeJob({ job_name: 'Working Duplex', status: 'working' }),
    makeJob({ job_name: 'Working Villa', status: 'working' }),
  ]
}

describe('JobsStagesTab render smoke', () => {
  it('mounts with active=false without rendering the board (hooks still run)', () => {
    renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ active: false })} />)
    expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).toBeNull()
    expect(screen.queryByText(/Waiting \(/)).toBeNull()
  })

  it('renders the board with section headers when active', () => {
    renderWithProviders(
      <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: boardJobs() })} />,
    )
    expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toBeTruthy()
    expect(screen.getByText(/Waiting \(1\)/)).toBeTruthy()
    expect(screen.getByText(/Working \(2\)/)).toBeTruthy()
    expect(screen.getByText(/Ready to Bill \(0\)/)).toBeTruthy()
    expect(screen.getByText(/Billed Awaiting Payment \(0\)/)).toBeTruthy()
    expect(screen.getByText(/Collections \(0\)/)).toBeTruthy()
    expect(screen.getByText(/Paid in Full \(/)).toBeTruthy()
    // Working opens by default → its rows render
    expect(screen.getByText('Working Duplex')).toBeTruthy()
    expect(screen.getByText('Working Villa')).toBeTruthy()
  })

  it('stages search filters the board sections', () => {
    renderWithProviders(
      <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: boardJobs() })} />,
    )
    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), { target: { value: 'Villa' } })
    expect(screen.getByText(/Working \(1\)/)).toBeTruthy()
    expect(screen.queryByText('Working Duplex')).toBeNull()
    expect(screen.getByText('Working Villa')).toBeTruthy()
  })

  it('toggles a section closed and open again', () => {
    renderWithProviders(
      <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: boardJobs() })} />,
    )
    const workingHeader = screen.getByText(/Working \(2\)/)
    expect(workingHeader.closest('button')!.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(workingHeader)
    expect(screen.queryByText('Working Duplex')).toBeNull()
    fireEvent.click(screen.getByText(/Working \(2\)/))
    expect(screen.getByText('Working Duplex')).toBeTruthy()
    // Waiting starts closed; opening it reveals its rows
    const waitingHeader = screen.getByText(/Waiting \(1\)/)
    expect(waitingHeader.closest('button')!.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Waiting Casa')).toBeNull()
    fireEvent.click(waitingHeader)
    expect(screen.getByText('Waiting Casa')).toBeTruthy()
  })

  it('tab-owned state SURVIVES an active → inactive → active round trip (always-mounted contract)', () => {
    const ref = createRef<JobsStagesTabHandle>()
    const props = makeProps({ jobs: boardJobs() })
    const view = renderWithProviders(<JobsStagesTab ref={ref} {...props} />)
    // Set state: open the Waiting section and type a search
    fireEvent.click(screen.getByText(/Waiting \(1\)/))
    expect(screen.getByText('Waiting Casa')).toBeTruthy()
    const search = screen.getByPlaceholderText(SEARCH_PLACEHOLDER) as HTMLInputElement
    fireEvent.change(search, { target: { value: 'Casa' } })
    expect(screen.queryByText('Working Duplex')).toBeNull()
    // Leave the tab (still mounted) …
    view.rerender(<JobsStagesTab ref={ref} {...props} active={false} />)
    expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).toBeNull()
    // … and come back: search text and the open Waiting section survived
    view.rerender(<JobsStagesTab ref={ref} {...props} active={true} />)
    const searchAgain = screen.getByPlaceholderText(SEARCH_PLACEHOLDER) as HTMLInputElement
    expect(searchAgain.value).toBe('Casa')
    const waitingHeader = screen.getByText(/Waiting \(1\)/)
    expect(waitingHeader.closest('button')!.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Waiting Casa')).toBeTruthy()
  })

  it('imperative handle methods are callable without throwing', () => {
    const ref = createRef<JobsStagesTabHandle>()
    const showToast = vi.fn()
    renderWithProviders(
      <JobsStagesTab ref={ref} {...makeProps({ jobs: boardJobs(), showToast })} />,
    )
    act(() => {
      ref.current!.focusSection('billed')
      ref.current!.followMovedJob('nope', 'working')
      ref.current!.focusJob('not-on-board')
      expect(ref.current!.focusInvoice('not-an-invoice')).toBe(false)
      ref.current!.showBilledTotalByName()
    })
    // focusJob for an unknown id falls back to a toast
    expect(showToast).toHaveBeenCalledWith('That job isn’t on the Stages board right now.', 'info')
    // Billed section opened by focusSection stays expanded
    const billedHeader = screen.getByText(/Billed Awaiting Payment \(0\)/)
    expect(billedHeader.closest('button')!.getAttribute('aria-expanded')).toBe('true')
    // Total by Name modal opened via the handle
    expect(screen.getByText('take me to Job: Stages: Billed')).toBeTruthy()
  })

  it('openBankPayments opens the Accounts Receivable modal', async () => {
    const ref = createRef<JobsStagesTabHandle>()
    renderWithProviders(<JobsStagesTab ref={ref} {...makeProps({ jobs: boardJobs() })} />)
    await act(async () => {
      ref.current!.openBankPayments()
    })
    // BankPaymentsModal flips from mounted-closed to open without crashing
    expect(document.body.textContent).toContain('Accounts Receivable')
  })
})
