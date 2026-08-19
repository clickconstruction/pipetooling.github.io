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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'

// v2.1824: the tab reads the scope API straight from the cache context; the
// smoke props still supply `jobs`, so present every scope as merged (row-derived
// headers and bodies, exactly the pre-scoping behavior these tests pin).
vi.mock('../../contexts/JobsListCacheContext', async () => {
  const actual = await vi.importActual<typeof import('../../contexts/JobsListCacheContext')>(
    '../../contexts/JobsListCacheContext',
  )
  return {
    ...actual,
    useJobsListCache: () => ({
      mergedScopes: new Set(['waiting', 'working', 'ready_to_bill', 'billed_all', 'paid']),
      scopeLoading: new Set(),
      fetchScopeIfNeeded: async () => {},
      headerStats: null,
    }),
  }
})

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

// Default placeholder — the schedule/clock supplement is opt-in since v2.1184.
const SEARCH_PLACEHOLDER = 'Search HCP, name, address'

function boardJobs() {
  return [
    makeJob({ job_name: 'Waiting Casa', status: 'waiting' }),
    makeJob({ job_name: 'Working Duplex', status: 'working' }),
    makeJob({ job_name: 'Working Villa', status: 'working' }),
  ]
}


/** Matches an element whose OWN textContent equals `name` even when the
 * search highlight (v2.1830) splits it into <mark>/<span> segments. */
const byJobName = (name: string) => (_: string, el: Element | null) =>
  el?.textContent === name && el.children.length <= 3 && !['TR', 'TD', 'TBODY', 'TABLE'].includes(el.tagName)

describe('JobsStagesTab render smoke', () => {
  beforeEach(() => {
    // The v2.1824 per-device default opens Ready to Bill only; these smokes
    // interact with Working/Billed content, so pin the old all-open layout.
    localStorage.setItem(
      'pipetooling_stages_sections_v2',
      JSON.stringify({ waiting: false, working: true, readyToBill: true, billed: true, collections: true, paid: false }),
    )
  })

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
    expect(screen.getAllByText(byJobName('Working Villa'))[0]).toBeTruthy()
  })

  it('stages search filters the board sections', () => {
    renderWithProviders(
      <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: boardJobs() })} />,
    )
    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), { target: { value: 'Villa' } })
    expect(screen.getByText(/Working \(1\)/)).toBeTruthy()
    expect(screen.queryByText('Working Duplex')).toBeNull()
    expect(screen.getAllByText(byJobName('Working Villa'))[0]).toBeTruthy()
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
    expect((screen.queryAllByText(byJobName('Waiting Casa'))[0] ?? null)).toBeNull()
    fireEvent.click(waitingHeader)
    expect(screen.getAllByText(byJobName('Waiting Casa'))[0]).toBeTruthy()
  })

  it('tab-owned state SURVIVES an active → inactive → active round trip (always-mounted contract)', () => {
    const ref = createRef<JobsStagesTabHandle>()
    const props = makeProps({ jobs: boardJobs() })
    const view = renderWithProviders(<JobsStagesTab ref={ref} {...props} />)
    // Set state: open the Waiting section and type a search
    fireEvent.click(screen.getByText(/Waiting \(1\)/))
    expect(screen.getAllByText(byJobName('Waiting Casa'))[0]).toBeTruthy()
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
    expect(screen.getAllByText(byJobName('Waiting Casa'))[0]).toBeTruthy()
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
    expect(showToast).toHaveBeenCalledWith('That job isn’t on the Pipeline board right now.', 'info')
    // Billed section opened by focusSection stays expanded
    const billedHeader = screen.getByText(/Billed Awaiting Payment \(0\)/)
    expect(billedHeader.closest('button')!.getAttribute('aria-expanded')).toBe('true')
    // Total by Name modal opened via the handle
    expect(screen.getByText('take me to Job: Stages: Billed')).toBeTruthy()
  })

  it('focusJob clears an active search and opens the job’s section (new-job reveal, v2.1528)', () => {
    const ref = createRef<JobsStagesTabHandle>()
    const jobs = [
      makeJob({ id: 'job-new', job_name: 'Fresh Casa', status: 'waiting' }),
      makeJob({ job_name: 'Working Duplex', status: 'working' }),
    ]
    renderWithProviders(<JobsStagesTab ref={ref} {...makeProps({ jobs })} />)
    // A search that hides the waiting job entirely
    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), { target: { value: 'Duplex' } })
    expect(screen.getByText(/Waiting \(0\)/)).toBeTruthy()
    act(() => {
      ref.current!.focusJob('job-new')
    })
    // Search cleared, Waiting opened, and the job row is on screen
    expect((screen.getByPlaceholderText(SEARCH_PLACEHOLDER) as HTMLInputElement).value).toBe('')
    const waitingHeader = screen.getByText(/Waiting \(1\)/)
    expect(waitingHeader.closest('button')!.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Fresh Casa')).toBeTruthy()
  })

  it('GC/development filters live in the ⋯ tools menu, not the search bar (v2.1232)', () => {
    const jobs = [
      makeJob({ job_name: 'Horton House', gcCustomer: { id: 'gc-1', name: 'D.R. Horton' } }),
      makeJob({ job_name: 'Other House' }),
    ]
    renderWithProviders(<JobsStagesTab ref={createRef()} {...makeProps({ jobs })} />)
    // Bar default: no filter selects, no active-filter chip.
    expect(screen.queryByLabelText('Filter the Pipeline board by GC/Builder')).toBeNull()
    expect(screen.queryByTitle('Filtered by GC/Builder — tap to clear')).toBeNull()
    // The selects render inside the tools menu.
    fireEvent.click(screen.getByLabelText('Pipeline tools'))
    const gcSelect = screen.getByLabelText('Filter the Pipeline board by GC/Builder')
    expect(screen.getByText('Filters')).toBeTruthy()
    // Selecting applies the filter, keeps the menu open, and raises the bar chip.
    fireEvent.change(gcSelect, { target: { value: 'gc-1' } })
    expect(screen.getByLabelText('Filter the Pipeline board by GC/Builder')).toBeTruthy()
    const chip = screen.getByTitle('Filtered by GC/Builder — tap to clear')
    expect(chip.textContent).toContain('D.R. Horton')
    expect(screen.getByText('Horton House')).toBeTruthy()
    expect(screen.queryByText('Other House')).toBeNull()
    // Tapping the chip clears the filter.
    fireEvent.click(chip)
    expect(screen.queryByTitle('Filtered by GC/Builder — tap to clear')).toBeNull()
    expect(screen.getByText('Other House')).toBeTruthy()
  })

  it('Edit mode (v2.1236): tools-menu toggle adds an EDIT rail per job row that calls openEdit', () => {
    window.localStorage.removeItem('jobs-stages-edit-mode')
    const openEdit = vi.fn()
    const jobs = boardJobs()
    renderWithProviders(<JobsStagesTab ref={createRef()} {...makeProps({ jobs, openEdit })} />)
    // Off by default: no rails anywhere.
    expect(screen.queryAllByLabelText(/^Edit job /)).toHaveLength(0)
    // Toggle it on from the ⋯ tools menu.
    fireEvent.click(screen.getByLabelText('Pipeline tools'))
    fireEvent.click(screen.getByText('Edit mode'))
    // Waiting defaults collapsed — rails appear on the two visible Working rows.
    expect(screen.getAllByLabelText(/^Edit job /)).toHaveLength(2)
    // Tapping a row's rail opens THAT job in Edit Job (no Job Detail stop).
    const duplexRow = screen.getByText('Working Duplex').closest('tr') as HTMLElement
    fireEvent.click(within(duplexRow).getByLabelText(/^Edit job /))
    expect(openEdit).toHaveBeenCalledTimes(1)
    expect((openEdit.mock.calls[0]![0] as { id: string }).id).toBe(jobs[1]!.id)
    // Toggle back off: rails disappear.
    fireEvent.click(screen.getByText('Edit mode'))
    expect(screen.queryAllByLabelText(/^Edit job /)).toHaveLength(0)
    window.localStorage.removeItem('jobs-stages-edit-mode')
  })

  it('Mobile cards (v2.1241): tools-menu toggle swaps tables for cards, tap requests the thread', () => {
    window.localStorage.removeItem('jobs-stages-mobile-cards')
    const jobs = boardJobs()
    // Thread expansion is page-owned state — pre-expand one working job so the
    // card's toolbelt + thread panel branch renders in the harness.
    const setExpandedJobThreadId = vi.fn()
    const props = makeProps({ jobs, expandedJobThreadId: jobs[1]!.id, setExpandedJobThreadId })
    const { container } = renderWithProviders(<JobsStagesTab ref={createRef()} {...props} />)
    // Off by default: the classic tables render.
    expect(container.querySelector('table')).toBeTruthy()
    // Toggle on from the ⋯ tools menu (available to every role).
    fireEvent.click(screen.getByLabelText('Pipeline tools'))
    fireEvent.click(screen.getByText('Mobile cards'))
    expect(container.querySelector('table')).toBeNull()
    const cards = container.querySelectorAll('[data-stages-job-id]')
    expect(cards.length).toBeGreaterThanOrEqual(2)
    // The section's primary action rides the card header.
    expect(screen.getAllByText('Ready to Bill').length).toBeGreaterThanOrEqual(1)
    // Compact zones (v2.1244, zoned card): the j:/b: shorthand became labeled
    // chips that render only when the job HAS the date (a "job —" placeholder
    // was dead width on the action row), and the money legend a single
    // condensed line. The smoke jobs carry no field/billing dates, so no
    // placeholder chips may appear.
    expect(screen.queryByLabelText('Field / job-activity date (click to open the job calendar)')).toBeNull()
    expect(screen.queryByText('job —')).toBeNull()
    expect(screen.queryByText('bill —')).toBeNull()
    expect(screen.queryByText(/^j: /)).toBeNull()
    expect(screen.queryByText('Left on Job')).toBeNull()
    expect(screen.getAllByText(/^Left /).length).toBeGreaterThanOrEqual(2)
    // v2.1402: the tap-revealed toolbelt is gone — actions live behind the
    // card footer's visible ⋯ button, which opens the more-actions sheet.
    expect(screen.queryByText('Job detail')).toBeNull()
    expect(screen.queryByText('Edit job')).toBeNull()
    const moreButtons = screen.getAllByTitle('More actions')
    expect(moreButtons.length).toBeGreaterThanOrEqual(2)
    fireEvent.click(moreButtons[0]!)
    expect(screen.getByText('View job')).toBeTruthy()
    expect(screen.getByText('Edit job')).toBeTruthy()
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('View job')).toBeNull()
    // Tapping a collapsed card requests its thread through the page setter.
    const collapsed = container.querySelector(`[data-stages-job-id="${jobs[2]!.id}"]`) as HTMLElement
    fireEvent.click(collapsed)
    expect(setExpandedJobThreadId).toHaveBeenCalled()
    // Toggle back off restores the tables.
    fireEvent.click(screen.getByText('Mobile cards'))
    expect(container.querySelector('table')).toBeTruthy()
    window.localStorage.removeItem('jobs-stages-mobile-cards')
  })

  it('Mobile cards compose with Edit mode: cards wear the EDIT rail', () => {
    window.localStorage.setItem('jobs-stages-mobile-cards', 'true')
    window.localStorage.setItem('jobs-stages-edit-mode', 'true')
    const openEdit = vi.fn()
    const jobs = boardJobs()
    const { container } = renderWithProviders(<JobsStagesTab ref={createRef()} {...makeProps({ jobs, openEdit })} />)
    const rails = screen.getAllByLabelText(/^Edit job /)
    expect(rails.length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('table')).toBeNull()
    fireEvent.click(rails[0]!)
    expect(openEdit).toHaveBeenCalledTimes(1)
    window.localStorage.removeItem('jobs-stages-mobile-cards')
    window.localStorage.removeItem('jobs-stages-edit-mode')
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
