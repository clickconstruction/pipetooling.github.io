// @vitest-environment jsdom
/**
 * Render tests for the Stages mobile card ⋯ more-actions sheet (v2.1402):
 * the card footer carries a visible ⋯ button, tapping it opens a bottom
 * sheet with the labeled desktop-row actions (gated like the desktop), and
 * choosing an action runs its handler and closes the sheet. The old
 * tap-revealed toolbelt is gone.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import JobsStagesCardList from './JobsStagesCardList'
import type { JobsStagesTableProps } from './JobsStagesTable'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'

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
    stagesLaborBreakdownByJobId: new Map(),
    expandedJobThreadId: null,
    toggleStagesJobThreadExpanded: vi.fn(),
    jobThreadStatsByJobId: {},
    jobThreadActivityByJobId: {},
    openJobThreadFullscreen: vi.fn(),
    openJobActivityExpand: vi.fn(),
    openJobCalendar: vi.fn(),
    stagesUpcomingByJobId: {},
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

describe('JobsStagesCardList more-actions sheet', () => {
  it('shows a ⋯ button per card and no always-hidden toolbelt', () => {
    const job = makeJob({ job_name: 'Card Alpha' })
    renderWithProviders(<JobsStagesCardList {...makeProps({ jobList: [job] })} />)
    expect(screen.getByTitle('More actions')).toBeTruthy()
    expect(screen.queryByText('View job')).toBeNull()
  })

  it('opens the sheet with the core actions; choosing one runs the handler and closes the sheet', () => {
    const openStagesDetailJobModal = vi.fn()
    const job = makeJob({ job_name: 'Card Alpha' })
    renderWithProviders(
      <JobsStagesCardList {...makeProps({ jobList: [job], openStagesDetailJobModal })} />,
    )
    fireEvent.click(screen.getByTitle('More actions'))
    expect(screen.getByText('View job')).toBeTruthy()
    expect(screen.getByText('Edit job')).toBeTruthy()
    expect(screen.getByText('Activity and notes')).toBeTruthy()
    expect(screen.getByText('Plumbing Tooling report')).toBeTruthy()
    expect(screen.queryByText('Hazmat fee')).toBeNull()
    expect(screen.queryByText('Send back')).toBeNull()
    fireEvent.click(screen.getByText('View job'))
    expect(openStagesDetailJobModal).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('View job')).toBeNull()
  })

  it('gates hazmat and send-back rows on their props', () => {
    const openHazmatFee = vi.fn()
    const onSendBack = vi.fn()
    const job = makeJob({ job_name: 'Card Beta' })
    renderWithProviders(
      <JobsStagesCardList
        {...makeProps({ jobList: [job], canCreateHazmatFee: true, openHazmatFee, onSendBack })}
      />,
    )
    fireEvent.click(screen.getByTitle('More actions'))
    expect(screen.getByText('Hazmat fee')).toBeTruthy()
    fireEvent.click(screen.getByText('Send back'))
    expect(onSendBack).toHaveBeenCalledTimes(1)
  })

  it('carries the demoted rail actions and the crew subtitle (zoned card)', () => {
    const openQuickAssignForJob = vi.fn()
    const job = makeJob({
      job_name: 'Card Delta',
      team_members: [{ user_id: 'u1', users: { name: 'Malachi' } }] as ReturnType<typeof makeJob>['team_members'],
    })
    renderWithProviders(
      <JobsStagesCardList {...makeProps({ jobList: [job], openQuickAssignForJob })} />,
    )
    fireEvent.click(screen.getByTitle('More actions'))
    expect(screen.getByText('Crew: Malachi')).toBeTruthy()
    expect(screen.getByText('Send as task')).toBeTruthy()
    fireEvent.click(screen.getByText('Assign work'))
    expect(openQuickAssignForJob).toHaveBeenCalledTimes(1)
  })

  it('Cancel closes the sheet without running anything', () => {
    const openEdit = vi.fn()
    const job = makeJob({ job_name: 'Card Gamma' })
    renderWithProviders(<JobsStagesCardList {...makeProps({ jobList: [job], openEdit })} />)
    fireEvent.click(screen.getByTitle('More actions'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(openEdit).not.toHaveBeenCalled()
    expect(screen.queryByText('Edit job')).toBeNull()
  })
})
