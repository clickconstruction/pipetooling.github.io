// @vitest-environment jsdom
/**
 * Render-smoke tests for JobsStagesTable — the job-only Stages section table
 * (Waiting / Working / Paid in Full), extracted from Jobs.tsx in v2.830.
 */
import { createRef } from 'react'
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
    stagesHamMode: false,
    assignedEditJobId: null,
    setAssignedEditJobId: vi.fn(),
    assignedEditSelectedIds: [],
    setAssignedEditSelectedIds: vi.fn(),
    assignedEditSavingId: null,
    assignedEditDropdownRef: createRef<HTMLDivElement | null>() as JobsStagesTableProps['assignedEditDropdownRef'],
    users: [],
    updateJobTeamMembers: vi.fn(async () => {}),
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
    setViewReportsJob: vi.fn(),
    applyStagesInvoiceFocus: vi.fn(() => true),
    canOpenJobScheduleModal: true,
    setScheduleModalJob: vi.fn(),
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

  it('renders the editable pct input per row when showPctComplete is on', () => {
    const a = makeJob({ job_name: 'Working Alpha', pct_complete: 40 })
    const b = makeJob({ job_name: 'Working Beta', pct_complete: null })
    renderWithProviders(<JobsStagesTable {...makeProps({ jobList: [a, b], showPctComplete: true })} />)
    const pctInputs = screen.getAllByLabelText('Percent complete') as HTMLInputElement[]
    expect(pctInputs).toHaveLength(2)
    expect(pctInputs[0]!.defaultValue).toBe('40')
    expect(document.querySelectorAll('tr[data-stages-job-id]')).toHaveLength(2)
  })
})
