/**
 * The Pipeline lists' shared bundle for a render test (`StagesTableShared`, the Stages map's step 10): every handler a
 * stub, every map empty. The three lists' render tests each wrote these lines out; they build them here (step 14).
 */
import { vi } from 'vitest'
import type { StagesTableShared, StagesUnifiedTableShared } from '../components/jobs/stagesTableShared'

export function makeStagesTableShared(overrides: Partial<StagesTableShared> = {}): StagesTableShared {
  return {
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
    authUser: { id: 'smoke-auth-user-1' } as StagesTableShared['authUser'],
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

/** The bill-row lists' bundle: the same, with what a bill row reads and no checklist marks. */
export function makeStagesUnifiedTableShared(overrides: Partial<StagesUnifiedTableShared> = {}): StagesUnifiedTableShared {
  return {
    ...makeStagesTableShared(),
    checklistMarksFor: () => null,
    flashInvoiceId: null,
    stagesHamMode: false,
    stagesInvoiceUpdatingId: null,
    invoiceEstimatedBillDateSavingId: null,
    bumpInvoiceEstimatedBillDate: vi.fn(async () => {}),
    setWhenInvoiceBillModal: vi.fn(),
    setWhenInvoiceBillModalDate: vi.fn(),
    ...overrides,
  }
}
