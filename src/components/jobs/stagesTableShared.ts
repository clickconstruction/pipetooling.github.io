import type { ReactNode } from 'react'
import type { useAuth } from '../../hooks/useAuth'
import type { useJobThreadNotes } from '../../hooks/useJobThreadNotes'
import type { useJobsStagesMutations } from '../../hooks/useJobsStagesMutations'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { StagesBoardSortMode } from '../../lib/jobsStagesSortMode'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StagesRowRenderContext } from './jobsStagesRowShared'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * What every Pipeline section shares (the Stages map's step 10): the Stages tab builds this once and hands it to
 * each section table and card list as the one prop `shared`, where it used to spread these keys into every site.
 * A section's own rows, labels and moves stay beside it as the list's other props, and no key lives on both sides.
 */
export type StagesTableShared = {
  /** Board sort mode (v2.1807): 'added' shows an "added <date>" stamp beside each job number; 'progress' (v2.3408) lights the column header. */
  stagesSortMode?: StagesBoardSortMode
  // --- the page's values and mutations, under the names the Stages tab holds them by ---
  stagesJobFlashId: string | null
  /** ⋯ tools menu "Edit mode" (v2.1236): thin vertical EDIT rail on every job row → openEdit. */
  stagesEditMode: boolean
  renderStagesOpenDetailJobName: (j: JobWithDetails) => ReactNode
  stagesStatusUpdatingId: ReturnType<typeof useJobsStagesMutations>['stagesStatusUpdatingId']
  pctCompleteSavingId: ReturnType<typeof useJobsStagesMutations>['pctCompleteSavingId']
  updateJobPctComplete: ReturnType<typeof useJobsStagesMutations>['updateJobPctComplete']
  commitStagesPctWithNote: ReturnType<typeof useJobsStagesMutations>['commitStagesPctWithNote']
  setCreatePartialInvoiceAmount: (v: string) => void
  setCreatePartialInvoiceJob: (j: JobWithDetails | null) => void
  openEdit: (job: JobWithDetails, opts?: { billingCustomerHighlight?: boolean; fixturesSectionHighlight?: boolean; initialTab?: 'documents' }) => void
  openStagesDetailJobModal: (j: JobWithDetails) => void
  setAiaG702StagesJob: (j: JobWithDetails | null) => void
  canCreateHazmatFee: boolean
  openHazmatFee: (j: JobWithDetails) => void
  /** Jobs with a live (non-voided) hazmat fee — their ☣ button wears a bright green box (v2.1040). */
  hazmatFeeJobIds?: ReadonlySet<string>
  canEditJobPctComplete: boolean
  canManageJobPeople: boolean
  setManageJobPeople: (v: { jobId: string; jobLabel: string; currentTeamUserIds: string[] } | null) => void
  jobThreadNotesLoadingId: ReturnType<typeof useJobThreadNotes>['jobThreadNotesLoadingId']
  jobThreadDraft: ReturnType<typeof useJobThreadNotes>['jobThreadDraft']
  jobThreadSubmittingId: ReturnType<typeof useJobThreadNotes>['jobThreadSubmittingId']
  setJobThreadDraft: ReturnType<typeof useJobThreadNotes>['setJobThreadDraft']
  submitJobThreadNote: ReturnType<typeof useJobThreadNotes>['submitJobThreadNote']
  /** Wide-screen Job activity box (v2.1587): body-based note submit + lazy activity loader. */
  submitJobThreadNoteWithBody?: ReturnType<typeof useJobThreadNotes>['submitJobThreadNoteWithBody']
  loadJobThreadNotesForJob?: ReturnType<typeof useJobThreadNotes>['loadJobThreadNotesForJob']
  authUser: ReturnType<typeof useAuth>['user']
  // --- what the row-render context reads (each list adds navigate and the dispatch-task / checklist modals from its own hooks) ---
  showToast: StagesRowRenderContext['showToast']
  customers: StagesRowRenderContext['customers']
  openEditJobAndCreateCustomerFlow: StagesRowRenderContext['openEditJobAndCreateCustomerFlow']
  stagesManHoursByJobId: StagesRowRenderContext['stagesManHoursByJobId']
  stagesManHoursLoading: StagesRowRenderContext['stagesManHoursLoading']
  crewByJobId: StagesRowRenderContext['crewByJobId']
  checklistMarksFor?: StagesRowRenderContext['checklistMarksFor']
  openChecklistDoor?: StagesRowRenderContext['openChecklistDoor']
  stagesLaborBreakdownByJobId: StagesRowRenderContext['stagesLaborBreakdownByJobId']
  expandedJobThreadId: StagesRowRenderContext['expandedJobThreadId']
  toggleStagesJobThreadExpanded: StagesRowRenderContext['toggleStagesJobThreadExpanded']
  jobThreadStatsByJobId: StagesRowRenderContext['jobThreadStatsByJobId']
  jobThreadActivityByJobId: StagesRowRenderContext['jobThreadActivityByJobId']
  openJobThreadFullscreen: StagesRowRenderContext['openJobThreadFullscreen']
  openJobActivityExpand: StagesRowRenderContext['openJobActivityExpand']
  openJobCalendar: StagesRowRenderContext['openJobCalendar']
  stagesUpcomingByJobId: StagesRowRenderContext['stagesUpcomingByJobId']
  stagesWorkedByJobId: StagesRowRenderContext['stagesWorkedByJobId']
  jobThreadFullscreen: boolean
  setJobThreadFullscreen: (v: boolean) => void
  applyStagesInvoiceFocus: StagesRowRenderContext['applyStagesInvoiceFocus']
  canOpenJobScheduleModal: StagesRowRenderContext['canOpenJobScheduleModal']
  setScheduleModalJob: StagesRowRenderContext['setScheduleModalJob']
  openQuickAssignForJob: StagesRowRenderContext['openQuickAssignForJob']
  authRole: StagesRowRenderContext['authRole']
  loadJobs: StagesRowRenderContext['loadJobs']
  jobContractCoverageByJobId?: StagesRowRenderContext['jobContractCoverageByJobId']
  propertyKindByJobId?: StagesRowRenderContext['propertyKindByJobId']
  onPropertyKindSaved?: StagesRowRenderContext['onPropertyKindSaved']
  propertyLinkByJobId?: StagesRowRenderContext['propertyLinkByJobId']
  onPropertyLinked?: StagesRowRenderContext['onPropertyLinked']
  onOpenJobContract?: StagesRowRenderContext['onOpenJobContract']
  /** The legal matter each job sits in, for the row's ⚖ chip beside the contract chip (v2.3313; reaching the rows since step 21). */
  legalMatterByJobId?: StagesRowRenderContext['legalMatterByJobId']
  /** The jobs marked as waiting, with a reason (v2.8723): the row's wait chip. */
  buildWaitByJobId?: StagesRowRenderContext['buildWaitByJobId']
  onOpenCustomerDoor?: StagesRowRenderContext['onOpenCustomerDoor']
  boardDotByJobId?: StagesRowRenderContext['boardDotByJobId']
  customerLinesByJobId?: StagesRowRenderContext['customerLinesByJobId']
}

/** The bill-row sections' bundle (Ready to Bill, Billed, Collections): the same, with what a bill row reads. */
export type StagesUnifiedTableShared = StagesTableShared & {
  /** Deep-link flash: row matching this invoice id gets a brief highlight. */
  flashInvoiceId?: string | null
  /** Release of lien (v2.2579): open the in-app waiver-and-release modal. */
  onOpenLienRelease?: (ctx: { job: JobWithDetails; invoice: JobsLedgerInvoice | null }) => void
  /** Jobs with a live (non-voided) release — their release button wears a blue box (v2.2582). */
  lienReleaseJobIds?: ReadonlySet<string>
  /** Jobs with a live SENT demand letter (v2.2640) — the lien icon wears an amber box. */
  demandOutJobIds?: ReadonlySet<string>
  /** Billed / Collections (v2.4051): the lien runway under the money bar — today → expected pay → the last day to lien. */
  billedLienRunway?: (row: StageRow) => ReactNode
  stagesHamMode: boolean
  stagesInvoiceUpdatingId: ReturnType<typeof useJobsStagesMutations>['stagesInvoiceUpdatingId']
  invoiceEstimatedBillDateSavingId: ReturnType<typeof useJobsStagesMutations>['invoiceEstimatedBillDateSavingId']
  bumpInvoiceEstimatedBillDate: ReturnType<typeof useJobsStagesMutations>['bumpInvoiceEstimatedBillDate']
  setWhenInvoiceBillModal: (v: { invoiceId: string; jobId: string; jobName: string; hcpNumber: string } | null) => void
  setWhenInvoiceBillModalDate: (v: string) => void
}

/**
 * A list's props as one flat object, the shape every line under its door has always read: the bundle's keys beside
 * the section's own. The types keep the two sides apart; if a key ever sat on both, the section's would win.
 */
export function stagesTableFlatProps<P extends { shared: object }>(props: P): Omit<P, 'shared'> & P['shared'] {
  const { shared, ...section } = props
  return { ...shared, ...section }
}
