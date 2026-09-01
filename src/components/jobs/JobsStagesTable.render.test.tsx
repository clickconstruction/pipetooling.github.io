// @vitest-environment jsdom
/**
 * Render-smoke tests for JobsStagesTable — the job-only Stages section table
 * (Waiting / Working / Paid in Full), extracted from Jobs.tsx in v2.830.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import JobsStagesTable, { type JobsStagesTableProps } from './JobsStagesTable'
import {
  makeJob,
  makeTeamMember,
  renderWithProviders,
} from '../../test/renderSmokeMocks'

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

describe('JobsStagesTable render smoke', () => {
  it('renders the empty-group row with no jobs', () => {
    renderWithProviders(<JobsStagesTable {...makeProps()} />)
    expect(screen.getByText('No jobs in this group')).toBeTruthy()
  })

  it('renders one row per job with data-stages-job-id, without pct input when showPctComplete is off', () => {
    const a = makeJob({ job_name: 'Waiting Alpha', team_members: [makeTeamMember('u-1', 'Tech One')] })
    const b = makeJob({ job_name: 'Waiting Beta' })
    renderWithProviders(<JobsStagesTable {...makeProps({ jobList: [a, b], showPctComplete: false })} />)
    expect(screen.getByText('Waiting Alpha')).toBeTruthy()
    expect(screen.getByText('Waiting Beta')).toBeTruthy()
    const rows = document.querySelectorAll('tr[data-stages-job-id]')
    expect(rows).toHaveLength(2)
    expect(document.querySelector(`tr[data-stages-job-id="${a.id}"]`)).toBeTruthy()
    expect(document.querySelector(`tr[data-stages-job-id="${b.id}"]`)).toBeTruthy()
    expect(screen.queryAllByLabelText('Percent complete')).toHaveLength(0)
    expect(screen.getByText('Tech One')).toBeTruthy()
  })

  it('renders a Share job button per row (v2.2613 — Waiting/Working join the every-row promise)', () => {
    const a = makeJob({ job_name: 'Share Alpha' })
    const b = makeJob({ job_name: 'Share Beta' })
    renderWithProviders(<JobsStagesTable {...makeProps({ jobList: [a, b] })} />)
    expect(screen.getAllByLabelText('Share job')).toHaveLength(2)
  })

  it('renders the editable pct input per row when showPctComplete is on', () => {
    const a = makeJob({ job_name: 'Working Alpha', pct_complete: 40 })
    const b = makeJob({ job_name: 'Working Beta', pct_complete: null })
    renderWithProviders(<JobsStagesTable {...makeProps({ jobList: [a, b], showPctComplete: true })} />)
    const pctInputs = screen.getAllByLabelText('Percent complete') as HTMLInputElement[]
    expect(pctInputs).toHaveLength(2)
    expect(pctInputs[0]!.defaultValue).toBe('40')
    expect(document.querySelectorAll('tr[data-stages-job-id]')).toHaveLength(2)
  })

  it('wraps the hazmat button in a green box only for jobs with a live fee (v2.1040)', () => {
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
    const buttons = screen.getAllByLabelText('Create a hazmat fee for this job')
    expect(buttons).toHaveLength(2)
    const boxed = buttons.filter((b) => (b as HTMLElement).style.border.includes('rgb(34, 197, 94)'))
    expect(boxed).toHaveLength(1)
    expect(boxed[0]?.title).toContain('has a hazmat fee')
  })

  it('expanded thread panel carries no Schedule / Week dispatch buttons (owner call, v2.1673)', () => {
    const teamless = makeJob({ job_name: 'Thread Panel Job', team_members: [] })
    renderWithProviders(
      <JobsStagesTable
        {...makeProps({
          jobList: [teamless],
          expandedJobThreadId: teamless.id,
        })}
      />,
    )
    // The panel is open (its empty-state copy is on screen) but the scheduling
    // shortcuts are gone — scheduling lives on its own surfaces.
    expect(screen.getByText('No activity yet — post the first note')).toBeTruthy()
    expect(screen.queryByText('Schedule')).toBeNull()
    expect(screen.queryByText('Week dispatch')).toBeNull()
  })

  it('schedule quick action opens the Assign work sheet, even with no team members (v2.1536)', () => {
    const teamless = makeJob({ job_name: 'No Team Yet', team_members: [] })
    const openQuickAssignForJob = vi.fn()
    const setScheduleModalJob = vi.fn()
    renderWithProviders(
      <JobsStagesTable {...makeProps({ jobList: [teamless], openQuickAssignForJob, setScheduleModalJob })} />,
    )
    const btn = screen.getByLabelText('Assign work — pick people and a time') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    btn.click()
    expect(openQuickAssignForJob).toHaveBeenCalledWith(expect.objectContaining({ id: teamless.id }))
    expect(setScheduleModalJob).not.toHaveBeenCalled()
  })
})
