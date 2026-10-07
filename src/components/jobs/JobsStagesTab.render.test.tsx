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
// headers and bodies, exactly the pre-scoping behavior these tests pin). A test
// may narrow `merged` and read which scopes the tab `asked` for (v2.4321).
const ALL_SCOPES = ['waiting', 'working', 'ready_to_bill', 'billed_all', 'paid']
const cache = vi.hoisted(() => ({ merged: [] as string[], asked: [] as string[] }))
vi.mock('../../contexts/JobsListCacheContext', async () => {
  const actual = await vi.importActual<typeof import('../../contexts/JobsListCacheContext')>(
    '../../contexts/JobsListCacheContext',
  )
  return {
    ...actual,
    useJobsListCache: () => ({
      mergedScopes: new Set(cache.merged),
      scopeLoading: new Set(),
      fetchScopeIfNeeded: async (scope: string) => {
        cache.asked.push(scope)
      },
      headerStats: null,
    }),
  }
})

const uncollectibleRpc = vi.hoisted(() => ({ calls: [] as unknown[][] }))
vi.mock('../../lib/setJobUncollectible', async () => {
  const actual = await vi.importActual<typeof import('../../lib/setJobUncollectible')>('../../lib/setJobUncollectible')
  return {
    ...actual,
    setJobUncollectible: async (...args: unknown[]) => {
      uncollectibleRpc.calls.push(args)
      return { ok: true }
    },
  }
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// Children in the always-rendered modal tail (ManageJobPeopleModal,
// BilledBillViewModal, AiaG702G703Modal) call useAuth() unconditionally;
// there is no AuthProvider in the smoke harness.
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import JobsStagesTab, {
  type JobsStagesTabHandle,
  type JobsStagesTabProps,
} from './JobsStagesTab'
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

/** A section's header toggle (v2.4512: the name, the count in its pill, the dollars — "Working 2 $0"). */
const sectionHeader = (label: string, count: number): HTMLElement => {
  const hit = [...document.querySelectorAll<HTMLElement>('[data-stages-section-header] button[aria-expanded]')].find((b) => new RegExp(`${label} ${count}( |$)`).test(b.textContent ?? ''))
  if (!hit) throw new Error(`no section header reads "${label} ${count}"`)
  return hit
}

describe('JobsStagesTab render smoke', () => {
  beforeEach(() => {
    // The v2.1824 per-device default opens Ready to Bill only; these smokes
    // interact with Working/Billed content, so pin the old all-open layout.
    localStorage.setItem(
      'pipetooling_stages_sections_v2',
      JSON.stringify({ waiting: false, working: true, readyToBill: true, billed: true, collections: true, paid: false }),
    )
    cache.merged = [...ALL_SCOPES]
    cache.asked = []
  })

  it('mounts with active=false without rendering the board (hooks still run)', async () => {
    renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ active: false })} />)
    await settle()
    expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).toBeNull()
    expect(screen.queryByRole('button', { name: /^Waiting \d/ })).toBeNull()
  })

  it('renders the board with section headers when active', async () => {
    renderWithProviders(
      <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: boardJobs() })} />,
    )
    await settle()
    expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toBeTruthy()
    expect(sectionHeader('Waiting', 1)).toBeTruthy()
    expect(sectionHeader('Working', 2)).toBeTruthy()
    expect(sectionHeader('Ready to Bill', 0)).toBeTruthy()
    expect(sectionHeader('Billed Awaiting Payment', 0)).toBeTruthy()
    expect(sectionHeader('Collections', 0)).toBeTruthy()
    expect(screen.getByText(/Paid in Full \(/)).toBeTruthy()
    // Working opens by default → its rows render
    expect(screen.getByText('Working Duplex')).toBeTruthy()
    expect(screen.getAllByText(byJobName('Working Villa'))[0]).toBeTruthy()
  })

  it('stages search filters the board sections', async () => {
    renderWithProviders(
      <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: boardJobs() })} />,
    )
    await settle()
    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), { target: { value: 'Villa' } })
    expect(sectionHeader('Working', 1)).toBeTruthy()
    expect(screen.queryByText('Working Duplex')).toBeNull()
    expect(screen.getAllByText(byJobName('Working Villa'))[0]).toBeTruthy()
  })

  it('toggles a section closed and open again', async () => {
    renderWithProviders(
      <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: boardJobs() })} />,
    )
    await settle()
    const workingHeader = sectionHeader('Working', 2)
    expect(workingHeader.closest('button')!.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(workingHeader)
    expect(screen.queryByText('Working Duplex')).toBeNull()
    fireEvent.click(sectionHeader('Working', 2))
    expect(screen.getByText('Working Duplex')).toBeTruthy()
    // Waiting starts closed; opening it reveals its rows
    const waitingHeader = sectionHeader('Waiting', 1)
    expect(waitingHeader.closest('button')!.getAttribute('aria-expanded')).toBe('false')
    expect((screen.queryAllByText(byJobName('Waiting Casa'))[0] ?? null)).toBeNull()
    fireEvent.click(waitingHeader)
    expect(screen.getAllByText(byJobName('Waiting Casa'))[0]).toBeTruthy()
  })

  it('tab-owned state SURVIVES an active → inactive → active round trip (always-mounted contract)', async () => {
    const ref = createRef<JobsStagesTabHandle>()
    const props = makeProps({ jobs: boardJobs() })
    const view = renderWithProviders(<JobsStagesTab ref={ref} {...props} />)
    await settle()
    // Set state: open the Waiting section and type a search
    fireEvent.click(sectionHeader('Waiting', 1))
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
    const waitingHeader = sectionHeader('Waiting', 1)
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
    const billedHeader = sectionHeader('Billed Awaiting Payment', 0)
    expect(billedHeader.closest('button')!.getAttribute('aria-expanded')).toBe('true')
    // Total by Name modal opened via the handle
    expect(screen.getByText('take me to Job: Stages: Billed')).toBeTruthy()
  })

  it('focusJob clears an active search and opens the job’s section (new-job reveal, v2.1528)', async () => {
    const ref = createRef<JobsStagesTabHandle>()
    const jobs = [
      makeJob({ id: 'job-new', job_name: 'Fresh Casa', status: 'waiting' }),
      makeJob({ job_name: 'Working Duplex', status: 'working' }),
    ]
    renderWithProviders(<JobsStagesTab ref={ref} {...makeProps({ jobs })} />)
    await settle()
    // A search that hides the waiting job entirely
    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), { target: { value: 'Duplex' } })
    expect(sectionHeader('Waiting', 0)).toBeTruthy()
    act(() => {
      ref.current!.focusJob('job-new')
    })
    // Search cleared, Waiting opened, and the job row is on screen
    expect((screen.getByPlaceholderText(SEARCH_PLACEHOLDER) as HTMLInputElement).value).toBe('')
    const waitingHeader = sectionHeader('Waiting', 1)
    expect(waitingHeader.closest('button')!.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Fresh Casa')).toBeTruthy()
  })

  it('GC/development filters live in the ⋯ tools menu, not the search bar (v2.1232)', async () => {
    const jobs = [
      makeJob({ job_name: 'Horton House', gcCustomer: { id: 'gc-1', name: 'D.R. Horton' } }),
      makeJob({ job_name: 'Other House' }),
    ]
    renderWithProviders(<JobsStagesTab ref={createRef()} {...makeProps({ jobs })} />)
    await settle()
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
    // v2.3752: the "job T-1" chip became the two-week schedule strip, which
    // draws on every card — an empty strip with "not scheduled" is the message.
    expect(screen.getAllByLabelText(/^Schedule strip — /).length).toBeGreaterThanOrEqual(2)
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
    // The card, ⋯ and Cancel clicks above were outside the tools menu, and an outside
    // click closes it (v2.3772: no page-covering backdrop) — reopen it to toggle back
    // off, which restores the tables.
    expect(screen.queryByText('Mobile cards')).toBeNull()
    fireEvent.click(screen.getByLabelText('Pipeline tools'))
    fireEvent.click(screen.getByText('Mobile cards'))
    expect(container.querySelector('table')).toBeTruthy()
    window.localStorage.removeItem('jobs-stages-mobile-cards')
  })

  it('Mobile cards compose with Edit mode: cards wear the EDIT rail', async () => {
    window.localStorage.setItem('jobs-stages-mobile-cards', 'true')
    window.localStorage.setItem('jobs-stages-edit-mode', 'true')
    const openEdit = vi.fn()
    const jobs = boardJobs()
    const { container } = renderWithProviders(<JobsStagesTab ref={createRef()} {...makeProps({ jobs, openEdit })} />)
    await settle()
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

  it('a hidden map is a Map button in the command bar, not a folded card; the button brings the card back and Hide map puts it away (v2.4518)', async () => {
    localStorage.setItem('pipetooling_jobs_map_hidden', '1')
    renderWithProviders(<JobsStagesTab {...makeProps({ jobs: boardJobs() })} />)
    await settle()
    expect(document.getElementById('jobs-map-card')).toBeNull()
    expect(screen.queryByText('Show map')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show the map' }))
    await settle()
    expect(document.getElementById('jobs-map-card')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show the map' })).toBeNull()
    expect(localStorage.getItem('pipetooling_jobs_map_hidden')).toBeNull()
    fireEvent.click(screen.getByText('Hide map'))
    await settle()
    expect(document.getElementById('jobs-map-card')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show the map' })).toBeTruthy()
    expect(localStorage.getItem('pipetooling_jobs_map_hidden')).toBe('1')
    localStorage.removeItem('pipetooling_jobs_map_hidden')
  })

  it('the section headers\u2019 buttons wear the menu\u2019s icons (v2.4527)', async () => {
    renderWithProviders(<JobsStagesTab {...makeProps({ jobs: boardJobs() })} />)
    await settle()
    const glyphs = [...document.querySelectorAll<HTMLElement>('[data-stages-section-header] button [data-tools-glyph]')].map((g) => g.dataset.toolsGlyph)
    // Ready to Bill · Billed Awaiting Payment (six) · Collections' Legal and Lien desk · Paid in Full (two), in board order.
    expect(glyphs).toEqual(['bell', 'building', 'bank', 'share', 'chart-bar', 'calendar-bars', 'bell', 'scales', 'gavel', 'chart-bar', 'bell'])
    // No header button is left with an emoji mark the menu no longer uses.
    const marks = [...document.querySelectorAll('[data-stages-section-header] button')].map((b) => b.textContent ?? '').join(' ')
    expect(marks).not.toMatch(/[⚙📊📅💵⇪⏱⚖]/u)
  })

  it('the Lien desk asks for the billed jobs the board has not loaded; its Calendar reads the board until they land (v2.4321)', async () => {
    // The phone board's shape: one stage loaded, Billed folded, no map asking for every scope.
    localStorage.setItem(
      'pipetooling_stages_sections_v2',
      JSON.stringify({ waiting: false, working: true, readyToBill: false, billed: false, collections: false, paid: false }),
    )
    localStorage.setItem('pipetooling_jobs_map_hidden', '1')
    cache.merged = ['working']
    const ref = createRef<JobsStagesTabHandle>()
    const props = makeProps({ jobs: boardJobs() })
    const view = renderWithProviders(<JobsStagesTab ref={ref} {...props} />)
    await settle()
    expect(cache.asked).not.toContain('billed_all')
    await act(async () => {
      ref.current!.openLienDesk()
    })
    // A plain open lands on Do now (punch list #82); Deadlines is one tab over.
    fireEvent.click(await screen.findByRole('tab', { name: 'Deadlines' }))
    expect(cache.asked).toContain('billed_all')
    expect(screen.getByText('Reading the board…')).toBeTruthy()
    expect(screen.queryByText('Nothing billed is on a lien clock.')).toBeNull()
    // The scope lands: the billed job is on the board and the Calendar counts it.
    cache.merged = ['working', 'billed_all']
    // v2.4788 (punch list #94): the job the office gave up on is billed and open, and on no clock.
    // A Collections job still chased stays on its clock (the control); the one given up on does not.
    const parked = makeJob({ job_name: 'Parked', status: 'billed', revenue: 500, collections_at: '2026-08-01T00:00:00Z' })
    const givenUp = makeJob({ job_name: 'Given Up', status: 'billed', revenue: 2000, collections_at: '2026-08-01T00:00:00Z', uncollectible_at: '2026-10-07T00:00:00Z' })
    view.rerender(<JobsStagesTab ref={ref} {...props} jobs={[...boardJobs(), makeJob({ job_name: 'Billed Lennox', status: 'billed' }), parked, givenUp]} />)
    expect(await screen.findByRole('button', { name: 'All · 2 jobs · $1,500' })).toBeTruthy()
    expect(screen.queryByText('Reading the board…')).toBeNull()
    localStorage.removeItem('pipetooling_jobs_map_hidden')
  })

  it('a Lien desk row opens the job’s lien window over the desk; closing it lands back on the desk, not the board (v2.4523)', async () => {
    cache.merged = ['working', 'billed_all']
    const ref = createRef<JobsStagesTabHandle>()
    renderWithProviders(<JobsStagesTab ref={ref} {...makeProps({ jobs: [...boardJobs(), makeJob({ job_name: 'Billed Lennox', status: 'billed' })] })} />)
    await settle()
    await act(async () => {
      ref.current!.openLienDesk()
    })
    // A plain open lands on Do now (punch list #82); Deadlines is one tab over.
    fireEvent.click(await screen.findByRole('tab', { name: 'Deadlines' }))
    const desk = await screen.findByRole('dialog', { name: 'Lien desk' })
    await within(desk).findByRole('button', { name: 'All · 1 job · $1,000' })
    // The calendar folds its groups: open Overdue, then the job's row is there to click.
    fireEvent.click([...desk.querySelectorAll('button')].find((b) => b.textContent?.startsWith('▸Overdue'))!)
    await settle()
    const row = [...desk.querySelectorAll<HTMLElement>('button, [role="button"]')].find((b) => b.textContent?.includes('Billed Lennox'))
    expect(row).toBeTruthy()
    fireEvent.click(row!)
    await settle()
    const lienWindow = document.querySelector('[aria-labelledby="lien-instruments-title"]') as HTMLElement
    expect(lienWindow).toBeTruthy()
    // The desk is still there, under the window.
    expect(screen.getByRole('dialog', { name: 'Lien desk' })).toBeTruthy()
    fireEvent.click(within(lienWindow).getAllByRole('button', { name: 'Close' })[0]!)
    await settle()
    expect(document.querySelector('[aria-labelledby="lien-instruments-title"]')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Lien desk' })).toBeTruthy()
    expect(within(screen.getByRole('dialog', { name: 'Lien desk' })).getByRole('button', { name: 'All · 1 job · $1,000' })).toBeTruthy()
  })

  it('a Collections job with no bill line wears the shell pill — In Collections N days · no bill line (B6 / J4-10, wired in v2.4758)', async () => {
    const flaggedDaysAgo = 12
    const flaggedAt = new Date(Date.now() - flaggedDaysAgo * 86_400_000).toISOString()
    const jobs = [
      makeJob({ job_name: 'Parked Shell', status: 'billed', revenue: 1200, payments_made: 0, collections_at: flaggedAt, invoices: [] }),
      makeJob({ job_name: 'Billed Shell', status: 'billed', revenue: 800, payments_made: 0, invoices: [] }),
    ]
    renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs })} />)
    await settle()
    // The Collections shell ages from the flag day; the Billed shell keeps its plain pill.
    const parked = screen.getByText(new RegExp(`^In Collections ${flaggedDaysAgo} days · no bill line$`))
    expect(parked.getAttribute('title')).toMatch(/^Flagged difficult to collect \d{4}-\d{2}-\d{2}\./)
    expect(screen.getByText('No bill line')).toBeTruthy()
  })

  it('on the phone board, focusSection picks the stage — ?stagesSection=collections lands on Collections, not the first open stage (punch list #93 D, v2.4759)', async () => {
    const realMatchMedia = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query === '(max-width: 640px)' || query === '(max-width: 559px)',
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
    try {
      localStorage.setItem('jobs-stages-mobile-cards', 'true')
      localStorage.setItem(
        'pipetooling_stages_sections_v2',
        JSON.stringify({ waiting: false, working: false, readyToBill: true, billed: false, collections: false, paid: false }),
      )
      const ref = createRef<JobsStagesTabHandle>()
      const jobs = [...boardJobs(), makeJob({ job_name: 'Parked', status: 'billed', revenue: 500, payments_made: 0, collections_at: '2026-09-01T00:00:00Z', invoices: [] })]
      renderWithProviders(<JobsStagesTab ref={ref} {...makeProps({ jobs })} />)
      await settle()
      expect(screen.getByRole('tab', { name: /^Ready/ }).getAttribute('aria-selected')).toBe('true')
      await act(async () => {
        ref.current!.focusSection('collections')
      })
      expect(screen.getByRole('tab', { name: /^Coll\./ }).getAttribute('aria-selected')).toBe('true')
      expect(screen.getByRole('tab', { name: /^Ready/ }).getAttribute('aria-selected')).toBe('false')
    } finally {
      window.matchMedia = realMatchMedia
      localStorage.removeItem('jobs-stages-mobile-cards')
    }
  })

  describe('Uncollectible (punch list #94, v2.4792)', () => {
    const chased = () => makeJob({ job_name: 'Still Chased', status: 'billed', revenue: 350, payments_made: 0, collections_at: '2026-08-01T00:00:00Z', invoices: [] })
    const givenUp = () =>
      makeJob({ job_name: 'Given Up', status: 'billed', revenue: 7502, payments_made: 0, collections_at: '2026-04-13T00:00:00Z', uncollectible_at: '2026-10-07T03:30:00Z', uncollectible_reason: 'Customer is engaging in theft of service.', invoices: [] })

    it('the band under Collections carries the given-up job with its stamp; the Collections header counts only what is still chased', async () => {
      renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: [...boardJobs(), chased(), givenUp()] })} />)
      await settle()
      expect(sectionHeader('Collections', 1)).toBeTruthy()
      const band = document.querySelector('[data-stages-uncollectible-band]')!
      expect(band.textContent).toContain('Uncollectible')
      expect(band.textContent).toContain('$7,502')
      const stamp = screen.getByRole('note', { name: /^Uncollectible\. Customer is engaging in theft of service\. Oct 6, 2026/ })
      expect(stamp.textContent).toContain('$7,502 given up on')
      expect(document.querySelectorAll('tr[data-stages-row-stamped]')).toHaveLength(1)
      // The stamped row keeps Mark Paid and offers the way back; the chased row offers the door.
      expect(screen.getByRole('button', { name: 'Put it back in Collections' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Uncollectible…' })).toBeTruthy()
    })

    it('Uncollectible… asks for a reason and writes it; Put it back asks and unmarks', async () => {
      uncollectibleRpc.calls = []
      const jobs = [...boardJobs(), chased(), givenUp()]
      renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs })} />)
      await settle()
      fireEvent.click(screen.getByRole('button', { name: 'Uncollectible…' }))
      const dialog = screen.getByRole('dialog', { name: 'Mark the job Uncollectible' })
      const confirmBtn = within(dialog).getByRole('button', { name: 'Mark Uncollectible' })
      expect((confirmBtn as HTMLButtonElement).disabled).toBe(true)
      fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Refused the bill, will not answer, not worth a suit.' } })
      expect((confirmBtn as HTMLButtonElement).disabled).toBe(false)
      await act(async () => {
        fireEvent.click(confirmBtn)
      })
      expect(uncollectibleRpc.calls).toEqual([[jobs[3]!.id, true, 'Refused the bill, will not answer, not worth a suit.']])
      expect(screen.queryByRole('dialog', { name: 'Mark the job Uncollectible' })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Put it back in Collections' }))
      const back = screen.getByRole('dialog', { name: 'Put the job back in Collections' })
      await act(async () => {
        fireEvent.click(within(back).getByRole('button', { name: 'Put it back' }))
      })
      expect(uncollectibleRpc.calls[1]).toEqual([jobs[4]!.id, false, undefined])
    })
  })

  describe('section moves (the shared stagesSectionActionProps, map step 6)', () => {
    function moveJobs() {
      return [
        makeJob({ job_name: 'Waiting Casa', status: 'waiting' }),
        makeJob({ job_name: 'Working Duplex', status: 'working', hcp_number: '878' }),
      ]
    }
    beforeEach(() => {
      localStorage.setItem(
        'pipetooling_stages_sections_v2',
        JSON.stringify({ waiting: true, working: true, readyToBill: false, billed: false, collections: false, paid: false }),
      )
    })

    it('Move to Working moves the Waiting job; Ready to Bill and Mark Waiting ask first', async () => {
      localStorage.removeItem('jobs-stages-ham-mode')
      const jobs = moveJobs()
      const updateJobStatus = vi.fn(async () => true)
      const moveJobToReadyToBillWithStripePrep = vi.fn(async () => true)
      renderWithProviders(
        <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs, updateJobStatus, moveJobToReadyToBillWithStripePrep })} />,
      )
      await settle()
      fireEvent.click(screen.getByRole('button', { name: 'Move to Working' }))
      expect(updateJobStatus).toHaveBeenCalledWith(jobs[0]!.id, 'working')
      fireEvent.click(screen.getByRole('button', { name: 'Ready to Bill' }))
      expect(screen.getByText('878 · Working Duplex')).toBeTruthy()
      expect(moveJobToReadyToBillWithStripePrep).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      fireEvent.click(screen.getByRole('button', { name: 'Mark Waiting' }))
      expect(screen.getByText('This will move the job back to Waiting.')).toBeTruthy()
      expect(updateJobStatus).toHaveBeenCalledTimes(1)
    })

    it('ham mode moves straight through: Ready to Bill and Mark Waiting act without a confirm', async () => {
      localStorage.setItem('jobs-stages-ham-mode', 'true')
      const jobs = moveJobs()
      const updateJobStatus = vi.fn(async () => true)
      const moveJobToReadyToBillWithStripePrep = vi.fn(async () => true)
      renderWithProviders(
        <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs, updateJobStatus, moveJobToReadyToBillWithStripePrep })} />,
      )
      await settle()
      fireEvent.click(screen.getByRole('button', { name: 'Ready to Bill' }))
      expect(moveJobToReadyToBillWithStripePrep).toHaveBeenCalledWith(jobs[1]!.id)
      fireEvent.click(screen.getByRole('button', { name: 'Mark Waiting' }))
      expect(updateJobStatus).toHaveBeenCalledWith(jobs[1]!.id, 'waiting')
      expect(screen.queryByText('878 · Working Duplex')).toBeNull()
      localStorage.removeItem('jobs-stages-ham-mode')
    })
  })
})
