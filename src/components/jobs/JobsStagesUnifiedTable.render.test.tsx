// @vitest-environment jsdom
/**
 * Render-smoke tests for JobsStagesUnifiedTable — the mixed job/invoice-row
 * Stages section table (Ready to Bill / Billed / Collections), extracted from
 * Jobs.tsx in v2.830.
 */
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import JobsStagesUnifiedTable, { type JobsStagesUnifiedTableProps } from './JobsStagesUnifiedTable'
import { makeInvoice, makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import type { StageRow } from '../../lib/jobsStagesBoard'

function makeProps(overrides: Partial<JobsStagesUnifiedTableProps> = {}): JobsStagesUnifiedTableProps {
  return {
    rows: [],
    actionLabel: 'Bill Customer',
    onJobAction: vi.fn(),
    onInvoiceAction: vi.fn(),
    onViewBill: vi.fn(),
    onJobSendBack: vi.fn(),
    onInvoiceSendBack: vi.fn(),
    showRemaining: true,
    showTimeOpen: false,
    sendBackBelowRemaining: false,
    showCreatePartialInvoice: true,
    flashInvoiceId: null,
    stagesJobFlashId: null,
    stagesHamMode: false,
    assignedEditJobId: null,
    setAssignedEditJobId: vi.fn(),
    assignedEditSelectedIds: [],
    setAssignedEditSelectedIds: vi.fn(),
    assignedEditSavingId: null,
    assignedEditDropdownRef: createRef<HTMLDivElement | null>() as JobsStagesUnifiedTableProps['assignedEditDropdownRef'],
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
    authUser: { id: 'smoke-auth-user-1' } as JobsStagesUnifiedTableProps['authUser'],
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
    stagesInvoiceUpdatingId: null,
    invoiceEstimatedBillDateSavingId: null,
    bumpInvoiceEstimatedBillDate: vi.fn(async () => {}),
    setWhenInvoiceBillModal: vi.fn(),
    setWhenInvoiceBillModalDate: vi.fn(),
    ...overrides,
  }
}

describe('JobsStagesUnifiedTable render smoke', () => {
  it('renders the empty-group row with no rows', () => {
    renderWithProviders(<JobsStagesUnifiedTable {...makeProps()} />)
    expect(screen.getByText('No jobs or invoices in this group')).toBeTruthy()
  })

  it('renders a bare job row, a standalone invoice row, and a merged-billed row', () => {
    const bareJob = makeJob({ job_name: 'RTB Bare Job', status: 'ready_to_bill' })
    const invoiceJob = makeJob({ job_name: 'RTB Invoice Job', status: 'ready_to_bill' })
    const invoice = makeInvoice({ job_id: invoiceJob.id, amount: 250, status: 'ready_to_bill' })
    const billedJob = makeJob({ job_name: 'Billed Merged Job', status: 'billed' })
    const billedInvoice = makeInvoice({ job_id: billedJob.id, amount: 900, status: 'billed' })
    const rows: StageRow[] = [
      { kind: 'job', job: bareJob },
      { kind: 'invoice', inv: invoice, job: invoiceJob },
      { kind: 'job_with_merged_billed', job: billedJob, inv: billedInvoice },
    ]
    renderWithProviders(<JobsStagesUnifiedTable {...makeProps({ rows })} />)
    expect(screen.getByText('RTB Bare Job')).toBeTruthy()
    expect(screen.getByText('Billed Merged Job')).toBeTruthy()
    // Job-shaped rows carry data-stages-job-id; invoice-bearing rows carry data-stages-invoice-id
    expect(document.querySelector(`tr[data-stages-job-id="${bareJob.id}"]`)).toBeTruthy()
    expect(document.querySelector(`tr[data-stages-invoice-id="${invoice.id}"]`)).toBeTruthy()
    const mergedRow = document.querySelector(`tr[data-stages-invoice-id="${billedInvoice.id}"]`)
    expect(mergedRow).toBeTruthy()
    expect(mergedRow!.getAttribute('data-stages-job-id')).toBe(billedJob.id)
  })

  it('applies the flash styling branch to the row matching flashInvoiceId', () => {
    const billedJob = makeJob({ job_name: 'Flash Job', status: 'billed' })
    const billedInvoice = makeInvoice({ job_id: billedJob.id, amount: 500, status: 'billed' })
    const rows: StageRow[] = [{ kind: 'job_with_merged_billed', job: billedJob, inv: billedInvoice }]
    renderWithProviders(
      <JobsStagesUnifiedTable {...makeProps({ rows, flashInvoiceId: billedInvoice.id })} />,
    )
    const row = document.querySelector(`tr[data-stages-invoice-id="${billedInvoice.id}"]`) as HTMLElement
    expect(row).toBeTruthy()
    expect(row.style.backgroundColor).toBe('var(--bg-amber-100)')
    expect(row.style.outline).toContain('#f59e0b')
  })

  it('does not apply flash styling when flashInvoiceId targets another invoice', () => {
    const billedJob = makeJob({ job_name: 'No Flash Job', status: 'billed' })
    const billedInvoice = makeInvoice({ job_id: billedJob.id, amount: 500, status: 'billed' })
    const rows: StageRow[] = [{ kind: 'job_with_merged_billed', job: billedJob, inv: billedInvoice }]
    renderWithProviders(
      <JobsStagesUnifiedTable {...makeProps({ rows, flashInvoiceId: 'some-other-invoice' })} />,
    )
    const row = document.querySelector(`tr[data-stages-invoice-id="${billedInvoice.id}"]`) as HTMLElement
    expect(row.style.backgroundColor).toBe('')
  })
})
