// @vitest-environment jsdom
/**
 * Render-smoke tests for JobsStagesTable — the job-only Stages section table
 * (Waiting / Working / Paid in Full), extracted from Jobs.tsx in v2.830.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'

// A row with a customer renders customer chrome that reads useAuth (v2.4212 fixtures set customer_id).
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import JobsStagesTable, { type JobsStagesTableProps } from './JobsStagesTable'
import { makeJob, makeTeamMember, renderWithProviders, settle } from '../../test/renderSmokeMocks'

function makeProps(overrides: Partial<JobsStagesTableProps> = {}): JobsStagesTableProps {
  return {
    jobList: [],
    actionLabel: 'Move to Working',
    onAction: vi.fn(),
    showTimeOpen: true,
    onSendBack: undefined,
    onSendBackSimple: undefined,
    showPctComplete: false,
    stagesJobFlashId: null,
    stagesEditMode: false,
    renderStagesOpenDetailJobName: (j) => <div>{j.job_name ?? '—'}</div>,
    stagesStatusUpdatingId: null,
    pctCompleteSavingId: null,
    updateJobPctComplete: vi.fn(async () => {}),
    commitStagesPctWithNote: vi.fn(async () => {}),
    setCreatePartialInvoiceAmount: vi.fn(),
    setCreatePartialInvoiceJob: vi.fn(),
    openEdit: vi.fn(),
    openStagesDetailJobModal: vi.fn(),
    setAiaG702StagesJob: vi.fn(),
    canCreateHazmatFee: false,
    openHazmatFee: vi.fn(),
    canEditJobPctComplete: true,
    canManageJobPeople: true,
    setManageJobPeople: vi.fn(),
    jobThreadNotesLoadingId: null,
    jobThreadDraft: '',
    jobThreadSubmittingId: null,
    setJobThreadDraft: vi.fn(),
    submitJobThreadNote: vi.fn(async () => {}),
    authUser: { id: 'smoke-auth-user-1' } as JobsStagesTableProps['authUser'],
    showToast: vi.fn(),
    customers: [],
    openEditJobAndCreateCustomerFlow: vi.fn(),
    stagesManHoursByJobId: new Map(),
    stagesManHoursLoading: false,
    crewByJobId: new Map(),
    stagesLaborBreakdownByJobId: new Map(),
    expandedJobThreadId: null,
    toggleStagesJobThreadExpanded: vi.fn(),
    jobThreadStatsByJobId: {},
    jobThreadActivityByJobId: {},
    openJobThreadFullscreen: vi.fn(),
    openJobActivityExpand: vi.fn(),
    openJobCalendar: vi.fn(),
    stagesUpcomingByJobId: {},
    stagesWorkedByJobId: {},
    jobThreadFullscreen: false,
    setJobThreadFullscreen: vi.fn(),
    applyStagesInvoiceFocus: vi.fn(() => true),
    canOpenJobScheduleModal: true,
    setScheduleModalJob: vi.fn(),
    openQuickAssignForJob: vi.fn(),
    authRole: 'dev',
    loadJobs: vi.fn(async () => []),
    ...overrides,
  }
}

describe('JobsStagesTable render smoke', () => {
  it('renders the empty-group row with no jobs', async () => {
    renderWithProviders(<JobsStagesTable {...makeProps()} />)
    await settle()
    expect(screen.getByText('No jobs in this group')).toBeTruthy()
  })

  it('renders one row per job with data-stages-job-id, without pct input when showPctComplete is off', async () => {
    const a = makeJob({ job_name: 'Waiting Alpha', team_members: [makeTeamMember('u-1', 'Tech One')] })
    const b = makeJob({ job_name: 'Waiting Beta' })
    renderWithProviders(<JobsStagesTable {...makeProps({ jobList: [a, b], showPctComplete: false })} />)
    await settle()
    expect(screen.getByText('Waiting Alpha')).toBeTruthy()
    expect(screen.getByText('Waiting Beta')).toBeTruthy()
    const rows = document.querySelectorAll('tr[data-stages-job-id]')
    expect(rows).toHaveLength(2)
    expect(document.querySelector(`tr[data-stages-job-id="${a.id}"]`)).toBeTruthy()
    expect(document.querySelector(`tr[data-stages-job-id="${b.id}"]`)).toBeTruthy()
    expect(screen.queryAllByLabelText('Percent complete')).toHaveLength(0)
    expect(screen.getByText('Tech One')).toBeTruthy()
  })

  it('the Progress & payment header is a sort button only when the tab hands it a toggle (v2.3408)', async () => {
    const onToggleProgressSort = vi.fn()
    const { unmount } = renderWithProviders(
      <JobsStagesTable {...makeProps({ jobList: [makeJob({ job_name: 'Sortable' })], onToggleProgressSort })} />,
    )
    await settle()
    const header = screen.getByRole('button', { name: /Progress & payment/ })
    expect(header.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(header)
    expect(onToggleProgressSort).toHaveBeenCalledTimes(1)
    unmount()
    // Sorted: the header reads pressed and the column carries aria-sort.
    renderWithProviders(
      <JobsStagesTable {...makeProps({ jobList: [makeJob({ job_name: 'Sortable' })], onToggleProgressSort, stagesSortMode: 'progress' })} />,
    )
    await settle()
    const pressed = screen.getByRole('button', { name: /Progress & payment/ })
    expect(pressed.getAttribute('aria-pressed')).toBe('true')
    expect(pressed.closest('th')!.getAttribute('aria-sort')).toBe('ascending')
  })

  it('without a toggle the Progress & payment header is plain text', async () => {
    renderWithProviders(<JobsStagesTable {...makeProps({ jobList: [makeJob({ job_name: 'Plain' })] })} />)
    await settle()
    expect(screen.queryByRole('button', { name: /Progress & payment/ })).toBeNull()
    expect(screen.getByText('Progress & payment').tagName).toBe('TH')
  })

  it('renders a Share job button per row (v2.2613 — Waiting/Working join the every-row promise)', async () => {
    const a = makeJob({ job_name: 'Share Alpha' })
    const b = makeJob({ job_name: 'Share Beta' })
    renderWithProviders(<JobsStagesTable {...makeProps({ jobList: [a, b] })} />)
    await settle()
    expect(screen.getAllByLabelText('Share job')).toHaveLength(2)
  })

  it('renders the editable pct input per row when showPctComplete is on', async () => {
    const a = makeJob({ job_name: 'Working Alpha', pct_complete: 40 })
    const b = makeJob({ job_name: 'Working Beta', pct_complete: null })
    renderWithProviders(<JobsStagesTable {...makeProps({ jobList: [a, b], showPctComplete: true })} />)
    await settle()
    const pctInputs = screen.getAllByLabelText('Percent complete') as HTMLInputElement[]
    expect(pctInputs).toHaveLength(2)
    expect(pctInputs[0]!.defaultValue).toBe('40')
    expect(document.querySelectorAll('tr[data-stages-job-id]')).toHaveLength(2)
  })

  it('wraps the hazmat button in a green box only for jobs with a live fee (v2.1040)', async () => {
    const withFee = makeJob({ job_name: 'Fee Job' })
    const without = makeJob({ job_name: 'Plain Job' })
    renderWithProviders(
      <JobsStagesTable
        {...makeProps({
          jobList: [withFee, without],
          canCreateHazmatFee: true,
          hazmatFeeJobIds: new Set([withFee.id]),
        })}
      />,
    )
    await settle()
    const buttons = screen.getAllByLabelText('Create a hazmat fee for this job')
    expect(buttons).toHaveLength(2)
    const boxed = buttons.filter((b) => (b as HTMLElement).style.border.includes('rgb(34, 197, 94)'))
    expect(boxed).toHaveLength(1)
    expect(boxed[0]?.title).toContain('has a hazmat fee')
  })

  it('expanded thread panel carries no Schedule / Week dispatch buttons (owner call, v2.1673)', async () => {
    const teamless = makeJob({ job_name: 'Thread Panel Job', team_members: [] })
    renderWithProviders(
      <JobsStagesTable
        {...makeProps({
          jobList: [teamless],
          expandedJobThreadId: teamless.id,
        })}
      />,
    )
    await settle()
    // The panel is open (its empty-state copy is on screen) but the scheduling
    // shortcuts are gone — scheduling lives on its own surfaces.
    expect(screen.getByText('No activity yet — post the first note')).toBeTruthy()
    expect(screen.queryByText('Schedule')).toBeNull()
    expect(screen.queryByText('Week dispatch')).toBeNull()
    // v2.4131: the open row and the thread row under it read as one card — the
    // same tint and left bar on both, no rule between them, aria-expanded on the row.
    const row = document.querySelector(`tr[data-stages-job-id="${teamless.id}"]`) as HTMLTableRowElement
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(row.style.backgroundColor).toBe('var(--bg-blue-tint)')
    expect(row.style.boxShadow).toContain('var(--text-link)')
    expect(row.style.borderBottom).not.toContain('solid')
    const threadCell = document.querySelector(`tr[data-stages-thread-for="${teamless.id}"] > td`) as HTMLTableCellElement
    expect(threadCell.style.background).toBe('var(--bg-blue-tint)')
    expect(threadCell.style.boxShadow).toContain('var(--text-link)')
  })

  it('a closed row carries neither the tint nor aria-expanded (v2.4131)', async () => {
    const job = makeJob({ job_name: 'Closed Row Job' })
    renderWithProviders(<JobsStagesTable {...makeProps({ jobList: [job], expandedJobThreadId: null })} />)
    await settle()
    const row = document.querySelector(`tr[data-stages-job-id="${job.id}"]`) as HTMLTableRowElement
    expect(row.getAttribute('aria-expanded')).toBe('false')
    expect(row.style.backgroundColor).toBe('')
    expect(document.querySelector('tr[data-stages-thread-for]')).toBeNull()
  })

  it('schedule quick action opens the Assign work sheet, even with no team members (v2.1536)', async () => {
    const teamless = makeJob({ job_name: 'No Team Yet', team_members: [] })
    const openQuickAssignForJob = vi.fn()
    const setScheduleModalJob = vi.fn()
    renderWithProviders(
      <JobsStagesTable {...makeProps({ jobList: [teamless], openQuickAssignForJob, setScheduleModalJob })} />,
    )
    await settle()
    const btn = screen.getByLabelText('Assign work — pick people and a time') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    btn.click()
    expect(openQuickAssignForJob).toHaveBeenCalledWith(expect.objectContaining({ id: teamless.id }))
    expect(setScheduleModalJob).not.toHaveBeenCalled()
  })

  it('v2.4160 · the address ends in the property-kind badge — C, R, or a ? that opens the picker; v2.4212: no linked property but a customer is a ? too; v2.4222: a GC counts as the home; neither, no badge', async () => {
    const commercial = makeJob({ id: 'j-c', job_name: 'Take 5- Liberty Hill', job_address: '11730 TX-29\nLiberty Hill, TX', customer_address_id: 'addr-c' })
    const residential = makeJob({ id: 'j-r', job_name: 'Tovi Polk Repairs', job_address: '1141 Lago Vista St\nSan Marcos, TX', customer_address_id: 'addr-r' })
    const unknown = makeJob({ id: 'j-u', job_name: 'Backflow Preventor Valve', job_address: '8507 Culebra Road\nSan Antonio, TX', customer_address_id: 'addr-u' })
    const unlinked = makeJob({ id: 'j-n', job_name: 'Typed Address Job', job_address: '1 Nowhere Ln\nAustin, TX', customer_address_id: null, customer_id: 'cust-n', customer_name: 'Dudley Mason' })
    const gcOnly = makeJob({ id: 'j-g', job_name: 'GC Job No Owner', job_address: '371 Buffalo Creek\nNew Braunfels, TX', customer_address_id: null, customer_id: null, gc_customer_id: 'gc-1', gcCustomer: { id: 'gc-1', name: 'Limitless Renovations & Design LLC' } })
    const orphan = makeJob({ id: 'j-o', job_name: 'No Customer Job', job_address: '2 Nowhere Ln\nAustin, TX', customer_address_id: null, customer_id: null, gc_customer_id: null })
    const onPropertyKindSaved = vi.fn()
    renderWithProviders(
      <JobsStagesTable
        {...makeProps({
          jobList: [commercial, residential, unknown, unlinked, gcOnly, orphan],
          propertyKindByJobId: new Map([
            ['j-c', 'non_residential'],
            ['j-r', 'residential'],
            ['j-u', ''],
            ['j-n', ''],
            ['j-g', ''],
          ]),
          onPropertyKindSaved,
        })}
      />,
    )
    await settle()
    const badges = screen.getAllByTestId('property-kind-badge')
    expect(badges.map((b) => [b.textContent, b.getAttribute('data-kind'), b.getAttribute('data-unlinked')])).toEqual([
      ['C', 'non_residential', null],
      ['R', 'residential', null],
      ['?', 'unset', null],
      ['?', 'unset', 'true'],
      ['?', 'unset', 'true'],
    ])
    expect(document.querySelector('tr[data-stages-job-id="j-o"] [data-testid="property-kind-badge"]')).toBeNull()
    // v2.4222 · no customer but a GC: the GC is the property's home, as on Edit Job.
    fireEvent.click(badges[4] as HTMLElement)
    expect(screen.getByRole('dialog', { name: 'What kind of property is 371 Buffalo Creek?' }).textContent).toContain("Not one of Limitless Renovations & Design LLC's saved properties yet")
    fireEvent.click(badges[4] as HTMLElement)
    // The unlinked ? says what its pick will do.
    fireEvent.click(badges[3] as HTMLElement)
    expect(screen.getByRole('dialog', { name: 'What kind of property is 1 Nowhere Ln?' }).textContent).toContain("Not one of Dudley Mason's saved properties yet")
    fireEvent.click(badges[3] as HTMLElement)
    // The ? asks, with the lien screens' Residential | Commercial switch.
    fireEvent.click(badges[2] as HTMLElement)
    const dialog = screen.getByRole('dialog', { name: 'What kind of property is 8507 Culebra Road?' })
    expect(within(dialog).getByTestId('property-kind-switch').getAttribute('data-kind')).toBe('unset')
    expect(within(dialog).getByRole('button', { name: 'Commercial' })).toBeTruthy()
  })

  it('v2.4342 · the contract chip tells time: amber with a crew on site, grey with no date, none on Paid in Full', async () => {
    const onSite = makeJob({ id: 'j-on', job_name: 'Crew On Site', status: 'working', revenue: 37745, last_work_date: '2026-09-30' })
    const quiet = makeJob({ id: 'j-q', job_name: 'Nothing Booked', status: 'working', revenue: 500 })
    const paid = makeJob({ id: 'j-p', job_name: 'Paid Job', status: 'paid', revenue: 900 })
    const coverage = new Map([onSite, quiet, paid].map((j) => [j.id, { kind: 'none' as const }]))
    const onOpenJobContract = vi.fn()
    renderWithProviders(
      <JobsStagesTable
        {...makeProps({
          jobList: [onSite, quiet, paid],
          jobContractCoverageByJobId: coverage,
          onOpenJobContract,
          stagesUpcomingByJobId: { 'j-on': { ymd: '2099-01-02', timeStart: '08:00', timeEnd: '16:00', assigneeNames: [], note: null, bookedYmds: ['2099-01-02'], lastYmd: '2099-01-02', visitCount: 1 } },
        })}
      />,
    )
    await settle()
    const rowOf = (id: string) => document.querySelector(`tr[data-stages-job-id="${id}"]`) as HTMLElement
    const ask = within(rowOf('j-on')).getByRole('button', { name: /No contract · crew on site/ })
    expect(ask.textContent).toBe('No contract · crew on site')
    fireEvent.click(ask)
    expect(onOpenJobContract).toHaveBeenCalledWith(onSite, 'contract')
    expect(within(rowOf('j-q')).getByRole('button', { name: /No contract/ }).textContent).toBe('No contract')
    expect(within(rowOf('j-p')).queryByRole('button', { name: /contract/i })).toBeNull()
  })
})
