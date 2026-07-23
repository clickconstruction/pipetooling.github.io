import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ForwardedRef,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatCurrencyAbbrevTruncated, formatCurrencyNoCents, formatJobNameTwoLines } from '../../lib/jobs/jobFormatting'
import {
  buildBilledAgingBuckets,
  sortStageRowsForTotalByNameDetail,
  stageRowBilledAgeDays,
  stageRowBilledLineLabel,
  stageRowBilledRemainingAmount,
} from '../../lib/jobs/invoiceBilling'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { useSendBackCollectPaymentFlowNotice } from '../../hooks/useSendBackCollectPaymentFlowNotice'
import { useArBankUnallocatedCount } from '../../hooks/useArBankUnallocatedCount'
import { useAuth } from '../../hooks/useAuth'
import { useJobThreadNotes } from '../../hooks/useJobThreadNotes'
import { useJobsStagesMutations } from '../../hooks/useJobsStagesMutations'
import { useBillCustomerModal } from '../../contexts/BillCustomerModalContext'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { buildBilledAwaitingPaymentReportHtml } from '../../lib/jobsDocuments/billedAwaitingPaymentReport'
import { ManageJobPeopleModal } from './ManageJobPeopleModal'
import JobReportsModal from '../JobReportsModal'
import JobsStagesTable from './JobsStagesTable'
import JobsStagesUnifiedTable from './JobsStagesUnifiedTable'
import { jobBillingContextFromJob } from '../../lib/jobBillingContext'
import BankPaymentsModal from './BankPaymentsModal'
import PaidInFullEmailSettingsModal from './PaidInFullEmailSettingsModal'
import JobBookModal from './JobBookModal'
import JobsCombineSeparateModal from './JobsCombineSeparateModal'
import StagesNoCustomerJobsModal from './StagesNoCustomerJobsModal'
import StagesAlertJobListModal from './StagesAlertJobListModal'
import JobBookIcon from '../icons/JobBookIcon'
import BilledPaymentConfirmationModal from './BilledPaymentConfirmationModal'
import BilledBillViewModal from './BilledBillViewModal'
import { findInvoiceWithJobFromJobs } from '../../lib/invoiceWithJobFromJobList'
import LienToolingPrefillModal from './LienToolingPrefillModal'
import AiaG702G703Modal from './AiaG702G703Modal'
import { HazmatFeeModal, type HazmatFeeModalJob } from './HazmatFeeModal'
import { ScheduleJobModal } from './ScheduleJobModal'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { UserRow } from '../../pages/Jobs'
import type { OpenEditJobOptions } from '../../contexts/JobFormModalContext'
import {
  clearReturnEditJobFromStages,
  peekReturnEditJobFromStages,
} from '../../lib/returnEditJobFromStages'
import { DELETE_DRAFT_BILL_LABEL } from '../../lib/deleteDraftBillLabel'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatMoveIntoStageByOnLine } from '../../lib/formatMoveIntoStageByOnLine'
import {
  invoiceNeedsStripeVoidForRevert,
  prepareBilledInvoicesBeforeJobRevertToReadyToBill,
  stripeModeForBillingFromRole,
} from '../../lib/voidStripeInvoiceForRevert'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { runJobsStagesSerializedPipeline } from '../../lib/jobsStagesSerializedPipeline'
import {
  buildJobsStagesBoardLists,
  clampPartialInvoiceCentsToUnallocated,
  jobBillingUnallocatedDollars,
  locateStagesInvoiceSection,
  readyToBillRowsExposureTotal,
  stagesInvoiceVisibleWithEmptySearch,
  stagesJobsWithoutCustomerFromFiltered,
  stagesSectionKeyForJobStatus,
  stagesReadyToBillJobsWithoutEmail,
  stagesWorkingJobsWithoutPicturesFromWorking,
  type InvoiceWithJob,
  type StageRow,
  buildCapableToBillBreakdownRows,
  capableToBillTotalFromWorking,
} from '../../lib/jobsStagesBoard'
import { jobLedgerHasCustomerForBilling } from '../../lib/jobLedgerCustomerForBilling'
import { setJobCollectionsFlag } from '../../lib/setJobCollectionsFlag'
import {
  fetchJobIdsMatchingScheduleOrClockSessions,
  shouldFetchStagesScheduleSessionSearch,
  STAGES_SCHEDULE_SESSION_SEARCH_MIN_CHARS,
} from '../../lib/jobsStagesScheduleSessionSearch'
import type { StagesRowRenderContext } from './jobsStagesRowShared'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * The Stages tab surface — Jobs.tsx decomposition steps 9b+9c
 * (docs/JOBS_TABS_ARCHITECTURE.md). Behavior-preserving move of the
 * `activeTab === 'stages'` block (toolbar + jump nav + loading block + the
 * section-wiring IIFE + the three inline modals), the Stages-owned state
 * cluster, and the Stages-only modal tail out of src/pages/Jobs.tsx. This
 * component is the single caller of JobsStagesTable / JobsStagesUnifiedTable.
 *
 * ALWAYS MOUNTED: the page renders it unconditionally and passes
 * `active={activeTab === 'stages'}`. The Stages-owned state used to live at
 * page level and survived tab switches; keeping the component mounted (body
 * gated on `active`, the modal tail rendered regardless — exactly the
 * always-rendered shape it had in the page's modal tail) preserves those
 * semantics. Effects that were keyed on `activeTab === 'stages'` are keyed on
 * `active` verbatim.
 *
 * The page keeps the URL deep-link router, the jobs cache wiring, `customers`
 * / `users`, the app modal contexts, and the seam-hook call sites
 * (useJobsStagesMutations / useJobThreadNotes), and drives tab-owned state
 * through the imperative handle below (followMovedJob + the deep-link focus
 * methods).
 */
export type JobsStagesTabHandle = {
  /** "Follow cards I move": input to the page-side useJobsStagesMutations hook. */
  followMovedJob: (jobId: string, toStatus: string) => void
  /** `?stagesSection=` deep link: open + scroll to a section. */
  focusSection: (key: 'waiting' | 'working' | 'readyToBill' | 'billed' | 'collections') => void
  /** `?stagesJob=` deep link: open the job's section, scroll + flash the row (toast when absent). */
  focusJob: (jobId: string) => void
  /** `?stagesInvoice=` deep link: focus + flash an invoice row (false when not on the board). */
  focusInvoice: (invoiceId: string) => boolean
  /** `?openBankPayments=` deep link: open the Accounts Receivable modal. */
  openBankPayments: () => void
  /** `?showBilledTotalByName=` deep link: open the Total by Name modal. */
  showBilledTotalByName: () => void
}

export type JobsStagesTabProps = {
  /** `activeTab === 'stages'` — gates the rendered surface and the tab-keyed effects; state persists across tab switches. */
  active: boolean
  // --- page-global error (quirk #7) ---
  error: string | null
  setError: Dispatch<SetStateAction<string | null>>
  // --- jobs cache wiring (stays in the page / JobsListCacheContext) ---
  jobs: JobWithDetails[]
  jobsListLoading: boolean
  jobsListRefreshing: boolean
  jobsListError: string | null
  paidJobsLoading: boolean
  jobsListDataKey: string | null
  paidJobsMergedForKey: string | null
  loadJobs: () => Promise<JobWithDetails[] | undefined>
  runFetchJobs: (customerFilter: string | null) => Promise<JobWithDetails[] | undefined>
  fetchPaidJobsIfNeeded: (customerFilter: string | null) => Promise<void>
  customerFilterForFetch: string | null
  scheduleLoadJobsAfterMutation: () => void
  // --- identity / roster / shared page context ---
  authUser: ReturnType<typeof useAuth>['user']
  authRole: ReturnType<typeof useAuth>['role']
  authProfileName: ReturnType<typeof useAuth>['profileName']
  myRole: string | null
  users: UserRow[]
  customers: StagesRowRenderContext['customers']
  showToast: StagesRowRenderContext['showToast']
  shortNewJobButtonLabel: boolean
  // --- page callbacks over the app modal contexts ---
  openNew: () => void
  openEdit: (job: JobWithDetails, opts?: { billingCustomerHighlight?: boolean }) => void
  openEditJobAndCreateCustomerFlow: (job: JobWithDetails) => void
  tryOpenEditJob: (jobId: string, options?: OpenEditJobOptions) => void
  openStagesDetailJobModal: (j: JobWithDetails) => void
  refreshCustomersAfterJobFormSave: () => void
  billCustomer: ReturnType<typeof useBillCustomerModal>
  // --- useJobsStagesMutations values (hook called in the page; followMovedJob flows back via the handle) ---
  stagesStatusUpdatingId: ReturnType<typeof useJobsStagesMutations>['stagesStatusUpdatingId']
  stagesInvoiceUpdatingId: ReturnType<typeof useJobsStagesMutations>['stagesInvoiceUpdatingId']
  updateJobStatus: ReturnType<typeof useJobsStagesMutations>['updateJobStatus']
  moveJobToReadyToBillWithStripePrep: ReturnType<typeof useJobsStagesMutations>['moveJobToReadyToBillWithStripePrep']
  revertBilledInvoiceToReadyToBill: ReturnType<typeof useJobsStagesMutations>['revertBilledInvoiceToReadyToBill']
  deleteInvoice: ReturnType<typeof useJobsStagesMutations>['deleteInvoice']
  invoiceEstimatedBillDateSavingId: ReturnType<typeof useJobsStagesMutations>['invoiceEstimatedBillDateSavingId']
  setInvoiceEstimatedBillDate: ReturnType<typeof useJobsStagesMutations>['setInvoiceEstimatedBillDate']
  bumpInvoiceEstimatedBillDate: ReturnType<typeof useJobsStagesMutations>['bumpInvoiceEstimatedBillDate']
  pctCompleteSavingId: ReturnType<typeof useJobsStagesMutations>['pctCompleteSavingId']
  updateJobPctComplete: ReturnType<typeof useJobsStagesMutations>['updateJobPctComplete']
  commitStagesPctWithNote: ReturnType<typeof useJobsStagesMutations>['commitStagesPctWithNote']
  // --- useJobThreadNotes values (hook called in the page; shared with Job Summary) ---
  expandedJobThreadId: ReturnType<typeof useJobThreadNotes>['expandedJobThreadId']
  setExpandedJobThreadId: ReturnType<typeof useJobThreadNotes>['setExpandedJobThreadId']
  jobThreadActivityByJobId: ReturnType<typeof useJobThreadNotes>['jobThreadActivityByJobId']
  jobThreadNotesLoadingId: ReturnType<typeof useJobThreadNotes>['jobThreadNotesLoadingId']
  jobThreadSubmittingId: ReturnType<typeof useJobThreadNotes>['jobThreadSubmittingId']
  jobThreadDraft: ReturnType<typeof useJobThreadNotes>['jobThreadDraft']
  setJobThreadDraft: ReturnType<typeof useJobThreadNotes>['setJobThreadDraft']
  submitJobThreadNote: ReturnType<typeof useJobThreadNotes>['submitJobThreadNote']
  jobThreadStatsByJobId: ReturnType<typeof useJobThreadNotes>['jobThreadStatsByJobId']
  refreshJobThreadStatsForJobIds: ReturnType<typeof useJobThreadNotes>['refreshJobThreadStatsForJobIds']
}

const JobsStagesTab = forwardRef(function JobsStagesTabInner(
  props: JobsStagesTabProps,
  ref: ForwardedRef<JobsStagesTabHandle>,
) {
  const {
    active,
    error,
    setError,
    jobs,
    jobsListLoading,
    jobsListRefreshing,
    jobsListError,
    paidJobsLoading,
    jobsListDataKey,
    paidJobsMergedForKey,
    loadJobs,
    runFetchJobs,
    fetchPaidJobsIfNeeded,
    customerFilterForFetch,
    scheduleLoadJobsAfterMutation,
    authUser,
    authRole,
    authProfileName,
    myRole,
    users,
    customers,
    showToast,
    shortNewJobButtonLabel,
    openNew,
    openEdit,
    openEditJobAndCreateCustomerFlow,
    tryOpenEditJob,
    openStagesDetailJobModal,
    refreshCustomersAfterJobFormSave,
    billCustomer,
    stagesStatusUpdatingId,
    stagesInvoiceUpdatingId,
    updateJobStatus,
    moveJobToReadyToBillWithStripePrep,
    revertBilledInvoiceToReadyToBill,
    deleteInvoice,
    invoiceEstimatedBillDateSavingId,
    setInvoiceEstimatedBillDate,
    bumpInvoiceEstimatedBillDate,
    pctCompleteSavingId,
    updateJobPctComplete,
    commitStagesPctWithNote,
    expandedJobThreadId,
    setExpandedJobThreadId,
    jobThreadActivityByJobId,
    jobThreadNotesLoadingId,
    jobThreadSubmittingId,
    jobThreadDraft,
    setJobThreadDraft,
    submitJobThreadNote,
    jobThreadStatsByJobId,
    refreshJobThreadStatsForJobIds,
  } = props
  /** Read-only here (loading block + return-to-edit banner); the URL router that WRITES params stays in Jobs.tsx. */
  const [searchParams] = useSearchParams()

  const canOpenJobScheduleModal = useMemo(
    () =>
      authRole === 'dev' ||
      authRole === 'master_technician' ||
      isAssistantLike(authRole) ||
      authRole === 'superintendent',
    [authRole],
  )
  // Matches the jobs_ledger UPDATE RLS (dev / master_technician / assistant / primary)
  // — who may set a job's % complete from the Stages expanded panel.
  const canEditJobPctComplete = useMemo(
    () =>
      authRole === 'dev' ||
      authRole === 'master_technician' ||
      isAssistantLike(authRole) ||
      authRole === 'primary',
    [authRole],
  )
  // Matches the jobs_ledger_team_members INSERT/DELETE RLS (dev / master_technician /
  // assistant only) — who may add or remove people from a job.
  const canManageJobPeople = useMemo(
    () => authRole === 'dev' || authRole === 'master_technician' || authRole === 'assistant',
    [authRole],
  )
  const [manageJobPeople, setManageJobPeople] = useState<
    { jobId: string; jobLabel: string; currentTeamUserIds: string[] } | null
  >(null)

  /** Set after Ready to Bill → See in Stages; cleared on timeout, dismiss, tab change, or reopening Edit Job. */
  const [returnEditBannerJobId, setReturnEditBannerJobId] = useState<string | null>(null)

  const [createPartialInvoiceJob, setCreatePartialInvoiceJob] = useState<JobWithDetails | null>(null)
  const [scheduleModalJob, setScheduleModalJob] = useState<JobWithDetails | null>(null)
  const [createPartialInvoiceAmount, setCreatePartialInvoiceAmount] = useState('')
  const [creatingPartialInvoiceFromModal, setCreatingPartialInvoiceFromModal] = useState(false)

  // Stages board: man-hours applied per job (lightweight get_man_hours_by_job RPC; mirrors teamLabor.ts math).
  const [stagesManHoursRows, setStagesManHoursRows] = useState<
    Array<{ job_id: string; person_name: string; man_hours: number }>
  >([])
  const [stagesManHoursLoading, setStagesManHoursLoading] = useState(false)
  const stagesManHoursLoadedRef = useRef(false)

  const [pendingStagesInvoiceFocusId, setPendingStagesInvoiceFocusId] = useState<string | null>(null)
  const [stagesInvoiceFlashId, setStagesInvoiceFlashId] = useState<string | null>(null)
  // "Follow cards I move": scroll to + flash a job row after a stage move (invoice-focus idiom).
  const [pendingStagesJobFocusId, setPendingStagesJobFocusId] = useState<string | null>(null)
  const [stagesJobFlashId, setStagesJobFlashId] = useState<string | null>(null)
  const [stagesSectionOpen, setStagesSectionOpen] = useState({
    waiting: false,
    working: true,
    readyToBill: true,
    billed: true,
    collections: true,
    paid: false,
  })
  const [billedTotalByNameModalOpen, setBilledTotalByNameModalOpen] = useState(false)
  const [billedTotalByNameExpandedName, setBilledTotalByNameExpandedName] = useState<string | null>(null)
  const [stagesNoCustomerModalOpen, setStagesNoCustomerModalOpen] = useState(false)
  const [stagesNoCustomerBtnHover, setStagesNoCustomerBtnHover] = useState(false)
  const [stagesNoJobPicturesModalOpen, setStagesNoJobPicturesModalOpen] = useState(false)
  const [stagesNoJobPicturesBtnHover, setStagesNoJobPicturesBtnHover] = useState(false)
  const [jobBookModalOpen, setJobBookModalOpen] = useState(false)
  const [combineSeparateModalOpen, setCombineSeparateModalOpen] = useState(false)
  const [capableToBillModalOpen, setCapableToBillModalOpen] = useState(false)
  const [whenInvoiceBillModal, setWhenInvoiceBillModal] = useState<{
    invoiceId: string
    jobId: string
    jobName: string
    hcpNumber: string
  } | null>(null)
  const [whenInvoiceBillModalDate, setWhenInvoiceBillModalDate] = useState('')
  const [stagesSearchQuery, setStagesSearchQuery] = useState('')
  const [stagesSearchExtraJobIds, setStagesSearchExtraJobIds] = useState<ReadonlySet<string>>(() => new Set())
  const [stagesScheduleSessionSearchBusy, setStagesScheduleSessionSearchBusy] = useState(false)
  // stagesStatusUpdatingId / stagesInvoiceUpdatingId / stagesInvoiceMutationLockRef and the
  // invoiceEstimatedBillDateSavingId / pctCompleteSavingId busy flags live in
  // useJobsStagesMutations (v2.828) — they arrive here as props from the page.
  const stagesInvoiceSendBackConfirmLockRef = useRef(false)
  const [viewReportsJob, setViewReportsJob] = useState<{ id: string; hcpNumber: string; jobName: string; jobAddress: string } | null>(null)
  const [readyForBillingJob, setReadyForBillingJob] = useState<{ id: string; hcpNumber: string; jobName: string } | null>(null)
  const [readyForBillingChecked1, setReadyForBillingChecked1] = useState(false)
  const [readyForBillingChecked2, setReadyForBillingChecked2] = useState(false)
  const [markPaidJob, setMarkPaidJob] = useState<JobWithDetails | null>(null)
  const [markPaidInvoice, setMarkPaidInvoice] = useState<InvoiceWithJob | null>(null)
  const [bankPaymentsModalOpen, setBankPaymentsModalOpen] = useState(false)
  /** ⚙ across from the Paid in Full header: "Customer paid" email recipients + preview/test (v2.965). */
  const [paidEmailSettingsOpen, setPaidEmailSettingsOpen] = useState(false)
  const { count: arBankTxUnallocatedCount } = useArBankUnallocatedCount({
    enabled: active,
    authUserId: authUser?.id,
    authRole,
    bankPaymentsModalOpen,
  })
  const [viewBillInvoice, setViewBillInvoice] = useState<InvoiceWithJob | null>(null)
  const [lienToolingPrefillModal, setLienToolingPrefillModal] = useState<{
    job: JobWithDetails
    invoice: JobsLedgerInvoice | null
  } | null>(null)
  const [aiaG702StagesJob, setAiaG702StagesJob] = useState<JobWithDetails | null>(null)
  const [hazmatFeeJob, setHazmatFeeJob] = useState<HazmatFeeModalJob | null>(null)
  /** Same office set as the create_hazmat_fee_incident RPC gate. */
  const canCreateHazmatFee =
    authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)
  const openHazmatFee = (j: JobWithDetails) =>
    setHazmatFeeJob({
      id: j.id,
      jobNumber: (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim() || '—',
      jobName: (j.job_name ?? '').trim() || 'Job',
      jobAddress: (j.job_address ?? '').trim() || '—',
      customerName: (j.customer_name ?? '').trim() || '—',
    })
  const lienToolingSenderFallback = useMemo(() => {
    const job = lienToolingPrefillModal?.job
    const sessionName = authProfileName?.trim() ?? ''
    if (!job?.master_user_id) return sessionName
    const masterRow = users.find((u) => u.id === job.master_user_id)
    return masterRow?.notes?.trim() || masterRow?.name?.trim() || sessionName
  }, [users, lienToolingPrefillModal?.job?.id, lienToolingPrefillModal?.job?.master_user_id, authProfileName])
  const [sendBackJob, setSendBackJob] = useState<{
    id: string
    hcpNumber: string
    jobName: string
    toStatus: 'working' | 'ready_to_bill'
    rtbDraftCount: number
  } | null>(null)
  const [sendBackInvoice, setSendBackInvoice] = useState<{ inv: InvoiceWithJob; action: 'delete' | 'revert' } | null>(null)
  const [sendBackInvoiceStripeExplainerAfterFailure, setSendBackInvoiceStripeExplainerAfterFailure] = useState(false)
  const [sendBackChecked, setSendBackChecked] = useState(false)
  const [sendBackStatusEventLine, setSendBackStatusEventLine] = useState<string | null>(null)
  const sendBackCollectPaymentNotice = useSendBackCollectPaymentFlowNotice(sendBackJob)
  const [sendBackConfirmJob, setSendBackConfirmJob] = useState<{ id: string; toStatus: 'waiting' | 'ready_to_bill' | 'billed' } | null>(null)
  // Collections flag confirm: 'to' = Billed → Collections (optional note), 'from' = Collections → Billed.
  const [collectionsConfirm, setCollectionsConfirm] = useState<{ job: JobWithDetails; direction: 'to' | 'from' } | null>(null)
  const [collectionsNoteDraft, setCollectionsNoteDraft] = useState('')
  const [collectionsSaving, setCollectionsSaving] = useState(false)
  const [confirmJobStatusJob, setConfirmJobStatusJob] = useState<{ id: string; toStatus: 'billed' | 'paid'; message: string } | null>(null)
  const [stagesHamMode, setStagesHamMode] = useState(() => {
    try {
      return localStorage.getItem('jobs-stages-ham-mode') === 'true'
    } catch {
      return false
    }
  })
  const [stagesFollowMoves, setStagesFollowMoves] = useState(() => {
    try {
      return localStorage.getItem('jobs-stages-follow-moves') === 'true'
    } catch {
      return false
    }
  })
  const [stagesIncludeScheduleTimeInSearch, setStagesIncludeScheduleTimeInSearch] = useState(() => {
    try {
      const raw = localStorage.getItem('jobs-stages-search-include-schedule-time')
      if (raw === null) return true
      return raw === 'true'
    } catch {
      return true
    }
  })
  const [assignedEditJobId, setAssignedEditJobId] = useState<string | null>(null)
  const [assignedEditSelectedIds, setAssignedEditSelectedIds] = useState<string[]>([])
  const [assignedEditSavingId, setAssignedEditSavingId] = useState<string | null>(null)
  const assignedEditDropdownRef = useRef<HTMLDivElement | null>(null)

  const renderStagesOpenDetailJobName = useCallback((j: JobWithDetails): ReactNode => {
    const fmt = formatJobNameTwoLines(j.job_name)
    if (!fmt) return <div>—</div>
    const n = (j.job_name ?? '').trim() || 'Job'
    return (
      <button
        type="button"
        onClick={() => openStagesDetailJobModal(j)}
        aria-label={`Open job detail for ${n}`}
        style={{
          display: 'block',
          margin: 0,
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
          color: 'var(--text-blue-700)',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
          width: '100%',
        }}
      >
        <span style={{ color: 'inherit', textDecoration: 'inherit' }}>{fmt.line1}</span>
        {fmt.line2 ? (
          <div style={{ fontSize: '0.75rem', color: 'inherit', marginTop: '0.15rem', textDecoration: 'inherit' }}>{fmt.line2}</div>
        ) : null}
      </button>
    )
  }, [openStagesDetailJobModal])

  const stagesBoardLists = useMemo(
    () => buildJobsStagesBoardLists(jobs, stagesSearchQuery, stagesSearchExtraJobIds),
    [jobs, stagesSearchQuery, stagesSearchExtraJobIds],
  )

  /** #3 of the billing-email guardrails: soft heads-up the moment a job is marked Ready to Bill. */
  const nudgeMissingBillingEmail = useCallback(
    (jobId: string) => {
      const j = jobs.find((x) => x.id === jobId)
      if (j && !(j.customer_email ?? '').trim()) {
        showToast('Heads up: no customer email on this job — Stripe invoices will need one.', 'info', 6000)
      }
    },
    [jobs, showToast],
  )

  const stagesJobsWithoutCustomer = useMemo(
    () => stagesJobsWithoutCustomerFromFiltered(stagesBoardLists.filtered),
    [stagesBoardLists.filtered],
  )

  const stagesWorkingJobsWithoutPictures = useMemo(
    () => stagesWorkingJobsWithoutPicturesFromWorking(stagesBoardLists.working),
    [stagesBoardLists.working],
  )

  const stagesReadyToBillNoEmailJobs = useMemo(
    () => stagesReadyToBillJobsWithoutEmail(stagesBoardLists.readyToBillRows),
    [stagesBoardLists.readyToBillRows],
  )
  const [stagesNoEmailModalOpen, setStagesNoEmailModalOpen] = useState(false)
  const [stagesNoEmailBtnHover, setStagesNoEmailBtnHover] = useState(false)

  const openStagesNoCustomerEditJob = useCallback(
    (jobId: string) => {
      setStagesNoCustomerModalOpen(false)
      tryOpenEditJob(jobId, { onSaved: () => void loadJobs() })
    },
    [tryOpenEditJob, loadJobs],
  )

  const openStagesNoJobPicturesEditJob = useCallback(
    (jobId: string) => {
      setStagesNoJobPicturesModalOpen(false)
      tryOpenEditJob(jobId, { onSaved: () => void loadJobs() })
    },
    [tryOpenEditJob, loadJobs],
  )

  useEffect(() => {
    if (stagesJobsWithoutCustomer.length === 0) {
      setStagesNoCustomerModalOpen(false)
    }
  }, [stagesJobsWithoutCustomer.length])

  useEffect(() => {
    if (stagesWorkingJobsWithoutPictures.length === 0) {
      setStagesNoJobPicturesModalOpen(false)
    }
  }, [stagesWorkingJobsWithoutPictures.length])

  useEffect(() => {
    if (stagesReadyToBillNoEmailJobs.length === 0) {
      setStagesNoEmailModalOpen(false)
    }
  }, [stagesReadyToBillNoEmailJobs.length])

  const focusStagesSection = useCallback((key: 'waiting' | 'working' | 'readyToBill' | 'billed' | 'collections') => {
    setStagesSectionOpen((prev) => ({ ...prev, [key]: true }))
    const elId =
      key === 'waiting'
        ? 'stages-waiting'
        : key === 'working'
          ? 'stages-working'
          : key === 'readyToBill'
            ? 'stages-ready-to-bill'
            : key === 'collections'
              ? 'stages-collections'
              : 'stages-billed'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }, [])

  /** "Follow cards I move": open the destination section, then scroll to + flash the job row. */
  const followMovedJob = useCallback(
    (jobId: string, toStatus: string) => {
      if (!stagesFollowMoves) return
      const section = stagesSectionKeyForJobStatus(toStatus)
      if (!section) return
      setStagesSectionOpen((prev) => ({ ...prev, [section]: true }))
      setPendingStagesJobFocusId(jobId)
      setStagesJobFlashId(jobId)
    },
    [stagesFollowMoves],
  )

  const stagesFilteredJobs = stagesBoardLists.filtered

  const STAGES_SCHEDULE_SESSION_DEBOUNCE_MS = 350
  useEffect(() => {
    if (!active) {
      setStagesSearchExtraJobIds(new Set())
      setStagesScheduleSessionSearchBusy(false)
      return
    }
    const q = stagesSearchQuery.trim()
    if (q.length < STAGES_SCHEDULE_SESSION_SEARCH_MIN_CHARS) {
      setStagesSearchExtraJobIds(new Set())
      setStagesScheduleSessionSearchBusy(false)
      return
    }
    if (!shouldFetchStagesScheduleSessionSearch(stagesIncludeScheduleTimeInSearch, q)) {
      setStagesSearchExtraJobIds(new Set())
      setStagesScheduleSessionSearchBusy(false)
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        setStagesScheduleSessionSearchBusy(true)
        const ids = jobs.map((j) => j.id)
        const { data, error: schedErr } = await fetchJobIdsMatchingScheduleOrClockSessions(ids, q)
        if (cancelled) return
        setStagesSearchExtraJobIds(data)
        setStagesScheduleSessionSearchBusy(false)
        if (schedErr) showToast(schedErr, 'warning')
      })()
    }, STAGES_SCHEDULE_SESSION_DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(t)
      setStagesScheduleSessionSearchBusy(false)
    }
  }, [active, stagesSearchQuery, stagesIncludeScheduleTimeInSearch, jobs, showToast])

  // Stages search should match paid-status jobs too; lazy paid list loads on expand, so prefetch when searching.
  useEffect(() => {
    if (!active) return
    if (!stagesSearchQuery.trim()) return
    void fetchPaidJobsIfNeeded(customerFilterForFetch)
  }, [active, stagesSearchQuery, customerFilterForFetch, fetchPaidJobsIfNeeded])

  const bankPaymentsModalBilledRows = useMemo(
    () => buildJobsStagesBoardLists(jobs, '').billedRows,
    [jobs],
  )

  const accountsReceivableButtonAccessibleName = useMemo(() => {
    const can =
      authRole === 'dev' ||
      authRole === 'master_technician' ||
      isAssistantLike(authRole) ||
      authRole === 'primary'
    if (!can) return 'Only dev, master, assistant, and primary can record payments'
    const hasUnalloc =
      typeof arBankTxUnallocatedCount === 'number' && arBankTxUnallocatedCount > 0
    if (hasUnalloc) {
      return `Accounts Receivable, ${arBankTxUnallocatedCount} unallocated bank transaction${arBankTxUnallocatedCount === 1 ? '' : 's'}`
    }
    if (bankPaymentsModalBilledRows.length === 0) return 'No billed rows'
    return 'Accounts Receivable: apply bank deposits to billed lines (non-Stripe)'
  }, [authRole, bankPaymentsModalBilledRows.length, arBankTxUnallocatedCount])

  const billedAgingBuckets = useMemo(() => buildBilledAgingBuckets(stagesFilteredJobs), [stagesFilteredJobs])

  /** Debounce: stagesFilteredJobs changes every Stages search keystroke; avoids overlapping multi-chunk RPC bursts. */
  const THREAD_STATS_STAGES_DEBOUNCE_MS = 320
  useEffect(() => {
    if (!authUser?.id || !active) return
    const ids = [...new Set(stagesFilteredJobs.map((j) => j.id))]
    const t = window.setTimeout(() => {
      void refreshJobThreadStatsForJobIds(ids)
    }, THREAD_STATS_STAGES_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [authUser?.id, active, stagesFilteredJobs, refreshJobThreadStatsForJobIds])

  function toggleStagesHamMode() {
    setStagesHamMode((prev) => {
      const next = !prev
      try {
        localStorage.setItem('jobs-stages-ham-mode', String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  function toggleStagesIncludeScheduleTimeInSearch() {
    setStagesIncludeScheduleTimeInSearch((prev) => {
      const next = !prev
      try {
        localStorage.setItem('jobs-stages-search-include-schedule-time', String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  useEffect(() => {
    if (!sendBackJob) {
      setSendBackStatusEventLine(null)
      return
    }
    const toStatusForEvent = sendBackJob.toStatus === 'working' ? 'ready_to_bill' : 'billed'
    supabase
      .from('job_status_events')
      .select('changed_at, users(name)')
      .eq('job_id', sendBackJob.id)
      .eq('to_status', toStatusForEvent)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { changed_at: string; users: { name: string | null } | null } | null
        setSendBackStatusEventLine(
          row
            ? formatMoveIntoStageByOnLine(toStatusForEvent, row.users?.name ?? null, row.changed_at)
            : null,
        )
      })
  }, [sendBackJob])

  useEffect(() => {
    if (sendBackInvoice) {
      setSendBackInvoiceStripeExplainerAfterFailure(false)
    }
  }, [sendBackInvoice])

  useEffect(() => {
    if (!assignedEditJobId) return
    function handleClickOutside(e: MouseEvent) {
      if (assignedEditDropdownRef.current && !assignedEditDropdownRef.current.contains(e.target as Node)) {
        setAssignedEditJobId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [assignedEditJobId])

  /** Stages board man-hours-per-job (load-once per visit; RLS-governed RPC, empty for roles without labor access). */
  async function loadStagesManHours() {
    if (stagesManHoursLoadedRef.current) return
    stagesManHoursLoadedRef.current = true
    setStagesManHoursLoading(true)
    const { data, error } = await supabase.rpc('get_man_hours_by_job')
    setStagesManHoursLoading(false)
    if (error) {
      stagesManHoursLoadedRef.current = false // allow retry on next Stages visit
      return
    }
    setStagesManHoursRows(
      (data ?? []) as Array<{ job_id: string; person_name: string; man_hours: number }>,
    )
  }

  function printBilledAwaitingPaymentReport(rows: StageRow[], opts?: { searchFilter?: string }) {
    if (rows.length === 0) {
      showToast('Nothing to print in Billed Awaiting Payment.', 'warning')
      return
    }
    if (!openHtmlPrintWindow(buildBilledAwaitingPaymentReportHtml(rows, opts))) {
      showToast('Allow pop-ups to print the report.', 'error')
    }
  }

  const applyStagesInvoiceFocus = useCallback(
    (invoiceId: string): boolean => {
      const raw = invoiceId.trim()
      if (!raw) return false
      const { readyToBillRows, billedRows } = buildJobsStagesBoardLists(
        jobs,
        stagesSearchQuery,
        stagesSearchExtraJobIds,
      )
      const section = locateStagesInvoiceSection(raw, readyToBillRows, billedRows)
      if (section == null) {
        if (stagesInvoiceVisibleWithEmptySearch(raw, jobs)) {
          showToast('Clear the Stages search to see this invoice.', 'info')
        } else {
          showToast('That invoice isn’t on the Stages board right now.', 'info')
        }
        return false
      }
      if (section === 'readyToBill') {
        setStagesSectionOpen((prev) => ({ ...prev, readyToBill: true }))
      } else {
        setStagesSectionOpen((prev) => ({ ...prev, billed: true }))
      }
      setPendingStagesInvoiceFocusId(raw)
      setStagesInvoiceFlashId(raw)
      return true
    },
    [jobs, stagesSearchQuery, stagesSearchExtraJobIds, showToast],
  )

  useEffect(() => {
    if (!active) {
      setReturnEditBannerJobId(null)
      clearReturnEditJobFromStages()
    }
  }, [active])

  useEffect(() => {
    if (!active || jobsListLoading) return
    const tabParam = searchParams.get('tab')
    const urlWantsStages = tabParam == null || tabParam === 'stages' || tabParam === 'billed'
    if (!urlWantsStages) return
    const id = peekReturnEditJobFromStages()
    if (id) setReturnEditBannerJobId(id)
  }, [active, jobsListLoading, searchParams])

  useEffect(() => {
    if (!returnEditBannerJobId) return
    const t = window.setTimeout(() => {
      clearReturnEditJobFromStages()
      setReturnEditBannerJobId(null)
    }, 10_000)
    return () => window.clearTimeout(t)
  }, [returnEditBannerJobId])

  useEffect(() => {
    if (!stagesInvoiceFlashId) return
    const t = window.setTimeout(() => setStagesInvoiceFlashId(null), 2600)
    return () => window.clearTimeout(t)
  }, [stagesInvoiceFlashId])

  useEffect(() => {
    if (!pendingStagesInvoiceFocusId) return
    const timer = window.setTimeout(() => {
      const el = document.querySelector(`[data-stages-invoice-id="${pendingStagesInvoiceFocusId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setPendingStagesInvoiceFocusId(null)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [pendingStagesInvoiceFocusId])

  // "Follow cards I move" — job-row cousins of the invoice flash/focus effects above.
  useEffect(() => {
    if (!stagesJobFlashId) return
    const t = window.setTimeout(() => setStagesJobFlashId(null), 2600)
    return () => window.clearTimeout(t)
  }, [stagesJobFlashId])

  useEffect(() => {
    if (!pendingStagesJobFocusId) return
    const jobId = pendingStagesJobFocusId
    const scrollTo = () => {
      const el = document.querySelector(`[data-stages-job-id="${jobId}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return !!el
    }
    // First attempt after the section-open re-render; one retry covers the destination row
    // appearing late (e.g. the post-move debounced refetch re-keying the lists).
    let retry: number | undefined
    const timer = window.setTimeout(() => {
      if (scrollTo()) {
        setPendingStagesJobFocusId(null)
        return
      }
      retry = window.setTimeout(() => {
        scrollTo()
        setPendingStagesJobFocusId(null)
      }, 700)
    }, 250)
    return () => {
      window.clearTimeout(timer)
      if (retry !== undefined) window.clearTimeout(retry)
    }
  }, [pendingStagesJobFocusId])

  useEffect(() => {
    if (!billedTotalByNameModalOpen) setBilledTotalByNameExpandedName(null)
  }, [billedTotalByNameModalOpen])

  useEffect(() => {
    if (active && authUser?.id) {
      const t = setTimeout(() => void loadStagesManHours(), 80)
      return () => clearTimeout(t)
    }
  }, [active, authUser?.id])

  /** Stages board: total man-hours per job id. */
  const stagesManHoursByJobId = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of stagesManHoursRows) {
      m.set(r.job_id, (m.get(r.job_id) ?? 0) + Number(r.man_hours ?? 0))
    }
    return m
  }, [stagesManHoursRows])

  /** Stages board: per-person man-hours per job id (descending), for the man-hours hover tooltip. */
  const stagesLaborBreakdownByJobId = useMemo(() => {
    const m = new Map<string, Array<{ personName: string; hours: number }>>()
    for (const r of stagesManHoursRows) {
      const arr = m.get(r.job_id) ?? []
      arr.push({ personName: r.person_name, hours: Number(r.man_hours ?? 0) })
      m.set(r.job_id, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => b.hours - a.hours)
    return m
  }, [stagesManHoursRows])

  async function createInvoiceFromModal() {
    if (!createPartialInvoiceJob) return
    const amount = parseFloat(createPartialInvoiceAmount)
    if (!(amount > 0)) {
      setError('Enter a valid amount greater than 0')
      return
    }
    const remaining = jobBillingUnallocatedDollars(createPartialInvoiceJob)
    const amountToUseCents = clampPartialInvoiceCentsToUnallocated(createPartialInvoiceJob, amount)
    const amountToUse = amountToUseCents / 100
    if (!(amountToUse > 0)) {
      setError('No remaining balance to bill')
      return
    }
    if (amountToUseCents < Math.round(amount * 100)) {
      showToast(`Adjusted to remaining unallocated ($${formatCurrency(amountToUse)})`, 'info')
      setCreatePartialInvoiceAmount(String(amountToUse))
    }
    if (
      createPartialInvoiceJob.status === 'ready_to_bill' &&
      Math.round(amountToUse * 100) === Math.round(remaining * 100)
    ) {
      const job = createPartialInvoiceJob
      setCreatePartialInvoiceJob(null)
      setCreatePartialInvoiceAmount('')
      setError(null)
      if (!jobLedgerHasCustomerForBilling(job.customer_id)) {
        showToast('Link this job to a customer before billing.', 'error')
        openEdit(job, { billingCustomerHighlight: true })
        return
      }
      billCustomer?.openBillCustomer({
        payload: { kind: 'job', job: jobBillingContextFromJob(job) },
        onSuccess: async () => {
          await loadJobs()
        },
        onAfterEnsureSuccess: async () => {
          await loadJobs()
        },
      })
      return
    }
    setCreatingPartialInvoiceFromModal(true)
    setError(null)
    try {
      const nextOrder = (createPartialInvoiceJob.invoices ?? []).length
      const estBillModal =
        createPartialInvoiceJob.last_bill_date?.trim().slice(0, 10) ?? null
      const { error: err } = await supabase
        .from('jobs_ledger_invoices')
        .insert({
          job_id: createPartialInvoiceJob.id,
          amount: amountToUse,
          status: 'ready_to_bill',
          sequence_order: nextOrder,
          estimated_bill_date: estBillModal,
          is_primary_rtb_bundle: false,
        })
        .select('id')
        .single()
      if (err) throw err
      if (createPartialInvoiceJob.status === 'ready_to_bill') {
        const raw = await withSupabaseRetry(
          () =>
            supabase.rpc('ensure_single_ready_to_bill_invoice_for_job', {
              p_job_id: createPartialInvoiceJob.id,
            }),
          'ensure RTB remainder after partial invoice'
        )
        const obj = raw as Record<string, unknown> | null
        if (obj && typeof obj.error === 'string' && obj.error.length > 0) {
          throw new Error(obj.error)
        }
      }
      setCreatePartialInvoiceJob(null)
      setCreatePartialInvoiceAmount('')
      setError(null)
      await loadJobs()
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; hint?: string }
      const msg = err?.message || 'Failed to create invoice'
      const extra = [err?.details, err?.hint].filter(Boolean).join(' ')
      setError(extra ? `${msg}. ${extra}` : msg)
    } finally {
      setCreatingPartialInvoiceFromModal(false)
    }
  }

  async function updateJobTeamMembers(jobId: string, userIds: string[]) {
    setAssignedEditSavingId(jobId)
    try {
      const { data: existingTeam } = await supabase.from('jobs_ledger_team_members').select('user_id').eq('job_id', jobId)
      const existingTeamIds = new Set((existingTeam ?? []).map((t: { user_id: string }) => t.user_id))
      const toAdd = userIds.filter((id) => !existingTeamIds.has(id))
      const toRemove = [...existingTeamIds].filter((id) => !userIds.includes(id))
      for (const uid of toRemove) {
        const { error: delErr } = await supabase.from('jobs_ledger_team_members').delete().eq('job_id', jobId).eq('user_id', uid)
        if (delErr) throw delErr
      }
      for (const uid of toAdd) {
        const { error: insErr } = await supabase.from('jobs_ledger_team_members').insert({ job_id: jobId, user_id: uid })
        if (insErr) throw insErr
      }
      await loadJobs()
      setAssignedEditJobId(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update assigned')
    } finally {
      setAssignedEditSavingId(null)
    }
  }

  // Imperative handle: the page's URL deep-link router effects and the
  // page-side useJobsStagesMutations hook drive tab-owned state through these
  // methods — each mirrors exactly what the page did before the move.
  useImperativeHandle(
    ref,
    () => ({
      followMovedJob,
      focusSection: focusStagesSection,
      focusJob: (jobId: string) => {
        const job = jobs.find((j) => j.id === jobId)
        if (job) {
          const section = stagesSectionKeyForJobStatus(job.status)
          if (section) setStagesSectionOpen((prev) => ({ ...prev, [section]: true }))
          setPendingStagesJobFocusId(jobId)
          setStagesJobFlashId(jobId)
        } else {
          showToast('That job isn’t on the Stages board right now.', 'info')
        }
      },
      focusInvoice: applyStagesInvoiceFocus,
      openBankPayments: () => setBankPaymentsModalOpen(true),
      showBilledTotalByName: () => setBilledTotalByNameModalOpen(true),
    }),
    [followMovedJob, focusStagesSection, applyStagesInvoiceFocus, jobs, showToast],
  )

  return (
    <>
      {active && (
        <div>
          {(error || jobsListError) && (
            <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error || jobsListError}</p>
          )}
          <div style={{ marginBottom: '1rem' }}>
            <span
              id="stages-search-supplemental-desc"
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              When Schedule and time in search is enabled, results can include jobs matched by dispatch schedule or clock
              session notes, people, or dates.
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={openNew}
              aria-label="New job"
              style={{
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {shortNewJobButtonLabel ? 'New' : 'New Job'}
            </button>
            <input
              type="text"
              placeholder={
                stagesIncludeScheduleTimeInSearch
                  ? 'Search HCP, name, address, schedule notes, or clock notes'
                  : 'Search HCP, name, address'
              }
              value={stagesSearchQuery}
              onChange={(e) => setStagesSearchQuery(e.target.value)}
              aria-busy={stagesIncludeScheduleTimeInSearch && stagesScheduleSessionSearchBusy}
              aria-describedby={
                stagesIncludeScheduleTimeInSearch ? 'stages-search-supplemental-desc' : undefined
              }
              style={{ flex: '1 1 10rem', minWidth: 0, padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
            />
            {(['dev', 'master_technician', 'assistant', 'controller'] as const).some(
              (r) => r === authRole || r === myRole,
            ) ? (
              <button
                type="button"
                onClick={() => setJobBookModalOpen(true)}
                title="Job Book"
                aria-label="Job Book"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  padding: 0,
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <JobBookIcon size={20} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={toggleStagesIncludeScheduleTimeInSearch}
              title={
                stagesIncludeScheduleTimeInSearch
                  ? 'Schedule and time in search on: also matches dispatch schedule and clock sessions (notes, assignee or puncher name, work date). Extra requests while you type. Click to search only HCP, name, and address.'
                  : 'Schedule and time in search off: only HCP, name, and address. Click to include schedule blocks and clock sessions in search.'
              }
              aria-label={
                stagesIncludeScheduleTimeInSearch
                  ? 'Schedule and time in search on, press to turn off'
                  : 'Schedule and time in search off, press to turn on'
              }
              aria-pressed={stagesIncludeScheduleTimeInSearch}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                flexShrink: 0,
                padding: 0,
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: stagesIncludeScheduleTimeInSearch ? 'var(--bg-blue-tint)' : 'var(--surface)',
                cursor: 'pointer',
                color: stagesIncludeScheduleTimeInSearch ? 'var(--text-link)' : 'var(--text-muted)',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor" aria-hidden>
                <path d="M480 272C480 317.9 465.1 360.3 440 394.7L566.6 521.4C579.1 533.9 579.1 554.2 566.6 566.7C554.1 579.2 533.8 579.2 521.3 566.7L394.7 440C360.3 465.1 317.9 480 272 480C157.1 480 64 386.9 64 272C64 157.1 157.1 64 272 64C386.9 64 480 157.1 480 272zM272 416C351.5 416 416 351.5 416 272C416 192.5 351.5 128 272 128C192.5 128 128 192.5 128 272C128 351.5 192.5 416 272 416z" />
              </svg>
            </button>
            {stagesIncludeScheduleTimeInSearch && stagesScheduleSessionSearchBusy ? (
              <span
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.25,
                  textAlign: 'left',
                }}
              >
                <span>Search includes schedule</span>
                <span>and session notes</span>
              </span>
            ) : null}
            {(['dev', 'assistant', 'controller'] as const).includes((authRole || myRole) as 'dev' | 'assistant' | 'controller') && (
              <button
                type="button"
                onClick={toggleStagesHamMode}
                title={stagesHamMode ? 'Ham mode on: faster shortcuts for some stage actions' : 'Ham mode off: all stage confirmations'}
                aria-pressed={stagesHamMode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  padding: 0,
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: stagesHamMode ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  cursor: 'pointer',
                  color: stagesHamMode ? 'var(--text-link)' : 'var(--text-muted)',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor" aria-hidden>
                  <path d="M224 329.2C224 337.7 220.6 345.8 214.6 351.8L187.8 378.6C175.5 390.9 155.3 390 138.4 385.8C133.8 384.7 128.9 384 123.9 384C90.8 384 63.9 410.9 63.9 444C63.9 477.1 90.8 504 123.9 504C130.2 504 135.9 509.7 135.9 516C135.9 549.1 162.8 576 195.9 576C229 576 255.9 549.1 255.9 516C255.9 511 255.3 506.2 254.1 501.5C249.9 484.6 248.9 464.4 261.3 452.1L288.1 425.3C294.1 419.3 302.2 415.9 310.7 415.9L399.9 415.9C406.2 415.9 412.3 415.6 418.4 414.9C430.3 413.7 434.8 399.4 429.2 388.9C420.7 373.1 415.9 355.1 415.9 335.9C415.9 274 466 223.9 527.9 223.9C535.9 223.9 543.6 224.7 551.1 226.3C562.8 228.8 575.2 220.4 573.1 208.7C558.4 126.4 486.4 63.9 399.9 63.9C302.7 63.9 223.9 142.7 223.9 239.9L223.9 329.1z" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setStagesFollowMoves((prev) => {
                  const next = !prev
                  try {
                    localStorage.setItem('jobs-stages-follow-moves', String(next))
                  } catch {
                    // localStorage unavailable — session-only toggle
                  }
                  return next
                })
              }
              title="After you move a card, scroll to it in its new section and highlight it"
              aria-pressed={stagesFollowMoves}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                height: 36,
                padding: '0 0.7rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: stagesFollowMoves ? 'var(--bg-blue-tint)' : 'var(--surface)',
                cursor: 'pointer',
                color: stagesFollowMoves ? 'var(--text-link)' : 'var(--text-muted)',
                fontSize: '0.8125rem',
                whiteSpace: 'nowrap',
              }}
            >
              Follow cards I move
            </button>
            <button
              type="button"
              onClick={() => setBilledTotalByNameModalOpen(true)}
              title="Total by Name"
              aria-label="Total by Name"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                padding: 0,
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} aria-hidden>
                <path
                  fill="currentColor"
                  d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM192 152C192 165.3 202.7 176 216 176L264 176C277.3 176 288 165.3 288 152C288 138.7 277.3 128 264 128L216 128C202.7 128 192 138.7 192 152zM192 248C192 261.3 202.7 272 216 272L264 272C277.3 272 288 261.3 288 248C288 234.7 277.3 224 264 224L216 224C202.7 224 192 234.7 192 248zM304 324L304 328C275.2 328.3 252 351.7 252 380.5C252 406.2 270.5 428.1 295.9 432.3L337.6 439.3C343.6 440.3 348 445.5 348 451.6C348 458.5 342.4 464.1 335.5 464.1L280 464C269 464 260 473 260 484C260 495 269 504 280 504L304 504L304 508C304 519 313 528 324 528C335 528 344 519 344 508L344 503.3C369 499.2 388 477.6 388 451.5C388 425.8 369.5 403.9 344.1 399.7L302.4 392.7C296.4 391.7 292 386.5 292 380.4C292 373.5 297.6 367.9 304.5 367.9L352 367.9C363 367.9 372 358.9 372 347.9C372 336.9 363 327.9 352 327.9L344 327.9L344 323.9C344 312.9 335 303.9 324 303.9C313 303.9 304 312.9 304 323.9z"
                />
              </svg>
            </button>
            {(['dev', 'master_technician', 'assistant', 'controller'] as const).some(
              (r) => r === authRole || r === myRole,
            ) ? (
              <button
                type="button"
                onClick={() => setCombineSeparateModalOpen(true)}
                title="Combine two jobs or split Specific Work into a new job"
                aria-label="Combine or separate jobs"
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--surface)',
                  color: 'var(--text-gray-800)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  fontSize: shortNewJobButtonLabel ? '0.8125rem' : undefined,
                }}
              >
                {shortNewJobButtonLabel ? 'C / S' : 'Combine / Separate'}
              </button>
            ) : null}
            </div>
          </div>
          <div
            style={{
              marginBottom: '0.75rem',
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              color: 'var(--text-700)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '1 1 auto',
                gap: '0.35rem',
                textAlign: 'center',
                minWidth: 0,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                <button
                  type="button"
                  onClick={() => focusStagesSection('waiting')}
                  aria-label={`Jump to Waiting, ${stagesBoardLists.waiting.length} jobs`}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'var(--text-blue-700)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Waiting
                </button>
                <span>({stagesBoardLists.waiting.length})</span>
              </span>
              <span style={{ color: 'var(--text-faint)', userSelect: 'none' }} aria-hidden>
                →
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                <button
                  type="button"
                  onClick={() => focusStagesSection('working')}
                  aria-label={`Jump to Working, ${stagesBoardLists.working.length} jobs`}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'var(--text-blue-700)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Working
                </button>
                <span>({stagesBoardLists.working.length})</span>
              </span>
              <span style={{ color: 'var(--text-faint)', userSelect: 'none' }} aria-hidden>
                →
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                <button
                  type="button"
                  onClick={() => focusStagesSection('readyToBill')}
                  aria-label={`Jump to Ready to Bill, ${stagesBoardLists.readyToBillRows.length} rows`}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'var(--text-blue-700)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Ready to Bill
                </button>
                <span>({stagesBoardLists.readyToBillRows.length})</span>
              </span>
              <span style={{ color: 'var(--text-faint)', userSelect: 'none' }} aria-hidden>
                →
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                <button
                  type="button"
                  onClick={() => focusStagesSection('billed')}
                  aria-label={`Jump to Billed Awaiting Payment, ${stagesBoardLists.billedActiveRows.length} rows`}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'var(--text-blue-700)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Billed Awaiting Payment
                </button>
                <span>({stagesBoardLists.billedActiveRows.length})</span>
              </span>
              {stagesBoardLists.collectionsRows.length > 0 ? (
                <>
                  <span style={{ color: 'var(--text-faint)', userSelect: 'none' }} aria-hidden>
                    →
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35em', rowGap: 0 }}>
                    <button
                      type="button"
                      onClick={() => focusStagesSection('collections')}
                      aria-label={`Jump to Collections, ${stagesBoardLists.collectionsRows.length} rows`}
                      style={{
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        font: 'inherit',
                        color: 'var(--text-red-700)',
                        textDecoration: 'underline',
                        textUnderlineOffset: '2px',
                      }}
                    >
                      Collections
                    </button>
                    <span>({stagesBoardLists.collectionsRows.length})</span>
                  </span>
                </>
              ) : null}
            </div>
            {stagesJobsWithoutCustomer.length > 0 || stagesWorkingJobsWithoutPictures.length > 0 ? (
              <div
                style={{
                  marginLeft: 'auto',
                  minWidth: 0,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  alignItems: 'center',
                }}
              >
                {stagesJobsWithoutCustomer.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStagesNoCustomerModalOpen(true)}
                    onMouseEnter={() => setStagesNoCustomerBtnHover(true)}
                    onMouseLeave={() => setStagesNoCustomerBtnHover(false)}
                    title="List jobs missing a linked customer"
                    aria-label={`No linked customer: ${stagesJobsWithoutCustomer.length} jobs. Open list.`}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      border: `1px solid ${stagesNoCustomerBtnHover ? '#f87171' : '#fecaca'}`,
                      borderRadius: 4,
                      background: 'var(--bg-red-tint)',
                      color: stagesNoCustomerBtnHover ? 'var(--text-red-800)' : 'var(--text-red-700)',
                      cursor: 'pointer',
                    }}
                  >
                    No customer ({stagesJobsWithoutCustomer.length})
                  </button>
                ) : null}
                {stagesWorkingJobsWithoutPictures.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStagesNoJobPicturesModalOpen(true)}
                    onMouseEnter={() => setStagesNoJobPicturesBtnHover(true)}
                    onMouseLeave={() => setStagesNoJobPicturesBtnHover(false)}
                    title="List working jobs missing Customer Pictures link"
                    aria-label={`Working jobs with no customer pictures link: ${stagesWorkingJobsWithoutPictures.length} jobs. Open list.`}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      border: `1px solid ${stagesNoJobPicturesBtnHover ? '#f87171' : '#fecaca'}`,
                      borderRadius: 4,
                      background: 'var(--bg-red-tint)',
                      color: stagesNoJobPicturesBtnHover ? 'var(--text-red-800)' : 'var(--text-red-700)',
                      cursor: 'pointer',
                    }}
                  >
                    No customer pictures ({stagesWorkingJobsWithoutPictures.length})
                  </button>
                ) : null}
                {stagesReadyToBillNoEmailJobs.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStagesNoEmailModalOpen(true)}
                    onMouseEnter={() => setStagesNoEmailBtnHover(true)}
                    onMouseLeave={() => setStagesNoEmailBtnHover(false)}
                    title="Ready to Bill jobs with no customer email — Stripe and emailed invoices need one"
                    aria-label={`Ready to Bill jobs with no customer email: ${stagesReadyToBillNoEmailJobs.length} jobs. Open list.`}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      border: `1px solid ${stagesNoEmailBtnHover ? '#d97706' : '#fcd34d'}`,
                      borderRadius: 4,
                      background: 'var(--bg-amber-tint)',
                      color: stagesNoEmailBtnHover ? 'var(--text-amber-800)' : 'var(--text-amber-700)',
                      cursor: 'pointer',
                    }}
                  >
                    No email ({stagesReadyToBillNoEmailJobs.length})
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <StagesAlertJobListModal
            open={stagesNoEmailModalOpen}
            onClose={() => setStagesNoEmailModalOpen(false)}
            jobs={stagesReadyToBillNoEmailJobs}
            onSelectJob={(jobId) => {
              setStagesNoEmailModalOpen(false)
              tryOpenEditJob(jobId, { onSaved: () => void loadJobs() })
            }}
            titleId="stages-no-email-modal-title"
            title="Ready to Bill jobs without a customer email"
            description="Stripe and emailed invoices need a customer email. Open Edit Job to add one."
          />
          <StagesNoCustomerJobsModal
            open={stagesNoCustomerModalOpen}
            onClose={() => setStagesNoCustomerModalOpen(false)}
            jobs={stagesJobsWithoutCustomer}
            onSelectJob={openStagesNoCustomerEditJob}
          />
          <StagesAlertJobListModal
            open={stagesNoJobPicturesModalOpen}
            onClose={() => setStagesNoJobPicturesModalOpen(false)}
            jobs={stagesWorkingJobsWithoutPictures}
            onSelectJob={openStagesNoJobPicturesEditJob}
            titleId="stages-no-job-pictures-modal-title"
            title="Working jobs without Customer Pictures"
            description="Working jobs in the current Stages search with no Customer Pictures URL set. Open Edit Job to add a link."
          />
          {(jobsListLoading || (jobsListRefreshing && !jobsListLoading)) && (
            <div
              role="status"
              aria-live="polite"
              style={{ textAlign: 'center', marginTop: '0.35rem', marginBottom: '0.75rem' }}
            >
              {jobsListLoading && (
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Loading jobs…
                  {(searchParams.get('openBankPayments') === 'true' || searchParams.get('openBankPayments') === '1') && (
                    <>
                      <br />
                      <span style={{ fontSize: '0.8125rem' }}>Opening Accounts Receivable when ready.</span>
                    </>
                  )}
                </p>
              )}
              {jobsListRefreshing && !jobsListLoading && (
                <p style={{ color: 'var(--text-faint)', fontSize: '0.8125rem', margin: 0 }}>Updating jobs…</p>
              )}
            </div>
          )}
          {(() => {
            const { waiting, working, paid, readyToBillRows, billedActiveRows, collectionsRows } = stagesBoardLists

            function toggleStages(key: keyof typeof stagesSectionOpen) {
              setStagesSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
            }

            function toggleStagesJobThreadExpanded(id: string) {
              setExpandedJobThreadId((prev) => (prev === id ? null : id))
            }

            const workingTotal = working.reduce((s, j) => s + (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)), 0)
            const waitingTotal = waiting.reduce((s, j) => s + (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)), 0)
            const capableToBillTotal = capableToBillTotalFromWorking(working)
            const readyToBillTotal = readyToBillRowsExposureTotal(readyToBillRows)
            const billedTotal = billedActiveRows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0)
            const collectionsTotal = collectionsRows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0)
            // Server RPC is authoritative; this only controls button visibility (same office pool as other stage moves).
            const canManageCollections =
              authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)
            return (
              <>
                <div id="stages-waiting" style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('waiting')}
                    aria-expanded={stagesSectionOpen.waiting}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{stagesSectionOpen.waiting ? '▼' : '▶'}</span>
                    Waiting ({waiting.length}) - ${formatCurrencyAbbrevTruncated(waitingTotal)}
                  </button>
                </div>
                {stagesSectionOpen.waiting && (
                  <JobsStagesTable
                    jobList={waiting}
                    actionLabel={'Move to Working'}
                    onAction={(j) => void updateJobStatus(j.id, 'working')}
                    showTimeOpen={true}
                    onSendBack={undefined}
                    onSendBackSimple={undefined}
                    showPctComplete={true}
                    stagesJobFlashId={stagesJobFlashId}
                    stagesHamMode={stagesHamMode}
                    assignedEditJobId={assignedEditJobId}
                    setAssignedEditJobId={setAssignedEditJobId}
                    assignedEditSelectedIds={assignedEditSelectedIds}
                    setAssignedEditSelectedIds={setAssignedEditSelectedIds}
                    assignedEditSavingId={assignedEditSavingId}
                    assignedEditDropdownRef={assignedEditDropdownRef}
                    users={users}
                    updateJobTeamMembers={updateJobTeamMembers}
                    renderStagesOpenDetailJobName={renderStagesOpenDetailJobName}
                    stagesStatusUpdatingId={stagesStatusUpdatingId}
                    pctCompleteSavingId={pctCompleteSavingId}
                    updateJobPctComplete={updateJobPctComplete}
                    commitStagesPctWithNote={commitStagesPctWithNote}
                    setCreatePartialInvoiceAmount={setCreatePartialInvoiceAmount}
                    setCreatePartialInvoiceJob={setCreatePartialInvoiceJob}
                    openEdit={openEdit}
                    openStagesDetailJobModal={openStagesDetailJobModal}
                    setAiaG702StagesJob={setAiaG702StagesJob}
                    canCreateHazmatFee={canCreateHazmatFee}
                    openHazmatFee={openHazmatFee}
                    canEditJobPctComplete={canEditJobPctComplete}
                    canManageJobPeople={canManageJobPeople}
                    setManageJobPeople={setManageJobPeople}
                    jobThreadNotesLoadingId={jobThreadNotesLoadingId}
                    jobThreadDraft={jobThreadDraft}
                    jobThreadSubmittingId={jobThreadSubmittingId}
                    setJobThreadDraft={setJobThreadDraft}
                    submitJobThreadNote={submitJobThreadNote}
                    authUser={authUser}
                    showToast={showToast}
                    customers={customers}
                    openEditJobAndCreateCustomerFlow={openEditJobAndCreateCustomerFlow}
                    stagesManHoursByJobId={stagesManHoursByJobId}
                    stagesManHoursLoading={stagesManHoursLoading}
                    stagesLaborBreakdownByJobId={stagesLaborBreakdownByJobId}
                    expandedJobThreadId={expandedJobThreadId}
                    toggleStagesJobThreadExpanded={toggleStagesJobThreadExpanded}
                    jobThreadStatsByJobId={jobThreadStatsByJobId}
                    jobThreadActivityByJobId={jobThreadActivityByJobId}
                    setViewReportsJob={setViewReportsJob}
                    applyStagesInvoiceFocus={applyStagesInvoiceFocus}
                    canOpenJobScheduleModal={canOpenJobScheduleModal}
                    setScheduleModalJob={setScheduleModalJob}
                    authRole={authRole}
                    loadJobs={loadJobs}
                  />
                )}

                <div id="stages-working" style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('working')}
                    aria-expanded={stagesSectionOpen.working}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{stagesSectionOpen.working ? '\u25BC' : '\u25B6'}</span>
                    Working ({working.length}) - ${formatCurrencyAbbrevTruncated(workingTotal)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCapableToBillModalOpen(true)}
                    style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', fontWeight: 400, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Capable of Being Billed: <span style={{ fontWeight: 600 }}>${formatCurrencyNoCents(capableToBillTotal)}</span>
                  </button>
                </div>
                {stagesSectionOpen.working && (
                  <JobsStagesTable
                    jobList={working}
                    actionLabel={'Ready to Bill'}
                    onAction={(j) =>
                      stagesHamMode
                        ? (nudgeMissingBillingEmail(j.id), void moveJobToReadyToBillWithStripePrep(j.id))
                        : (setReadyForBillingChecked1(false), setReadyForBillingChecked2(false), setReadyForBillingJob({ id: j.id, hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', jobName: j.job_name ?? '—' }))}
                    showTimeOpen={true}
                    onSendBack={undefined}
                    onSendBackSimple={stagesHamMode
                      ? (j) => void updateJobStatus(j.id, 'waiting')
                      : (j) => setSendBackConfirmJob({ id: j.id, toStatus: 'waiting' })}
                    showPctComplete={true}
                    stagesJobFlashId={stagesJobFlashId}
                    stagesHamMode={stagesHamMode}
                    assignedEditJobId={assignedEditJobId}
                    setAssignedEditJobId={setAssignedEditJobId}
                    assignedEditSelectedIds={assignedEditSelectedIds}
                    setAssignedEditSelectedIds={setAssignedEditSelectedIds}
                    assignedEditSavingId={assignedEditSavingId}
                    assignedEditDropdownRef={assignedEditDropdownRef}
                    users={users}
                    updateJobTeamMembers={updateJobTeamMembers}
                    renderStagesOpenDetailJobName={renderStagesOpenDetailJobName}
                    stagesStatusUpdatingId={stagesStatusUpdatingId}
                    pctCompleteSavingId={pctCompleteSavingId}
                    updateJobPctComplete={updateJobPctComplete}
                    commitStagesPctWithNote={commitStagesPctWithNote}
                    setCreatePartialInvoiceAmount={setCreatePartialInvoiceAmount}
                    setCreatePartialInvoiceJob={setCreatePartialInvoiceJob}
                    openEdit={openEdit}
                    openStagesDetailJobModal={openStagesDetailJobModal}
                    setAiaG702StagesJob={setAiaG702StagesJob}
                    canCreateHazmatFee={canCreateHazmatFee}
                    openHazmatFee={openHazmatFee}
                    canEditJobPctComplete={canEditJobPctComplete}
                    canManageJobPeople={canManageJobPeople}
                    setManageJobPeople={setManageJobPeople}
                    jobThreadNotesLoadingId={jobThreadNotesLoadingId}
                    jobThreadDraft={jobThreadDraft}
                    jobThreadSubmittingId={jobThreadSubmittingId}
                    setJobThreadDraft={setJobThreadDraft}
                    submitJobThreadNote={submitJobThreadNote}
                    authUser={authUser}
                    showToast={showToast}
                    customers={customers}
                    openEditJobAndCreateCustomerFlow={openEditJobAndCreateCustomerFlow}
                    stagesManHoursByJobId={stagesManHoursByJobId}
                    stagesManHoursLoading={stagesManHoursLoading}
                    stagesLaborBreakdownByJobId={stagesLaborBreakdownByJobId}
                    expandedJobThreadId={expandedJobThreadId}
                    toggleStagesJobThreadExpanded={toggleStagesJobThreadExpanded}
                    jobThreadStatsByJobId={jobThreadStatsByJobId}
                    jobThreadActivityByJobId={jobThreadActivityByJobId}
                    setViewReportsJob={setViewReportsJob}
                    applyStagesInvoiceFocus={applyStagesInvoiceFocus}
                    canOpenJobScheduleModal={canOpenJobScheduleModal}
                    setScheduleModalJob={setScheduleModalJob}
                    authRole={authRole}
                    loadJobs={loadJobs}
                  />
                )}

                <div id="stages-ready-to-bill" style={{ margin: '1.5rem 0 0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('readyToBill')}
                    aria-expanded={stagesSectionOpen.readyToBill}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{stagesSectionOpen.readyToBill ? '\u25BC' : '\u25B6'}</span>
                    Ready to Bill ({readyToBillRows.length}) - ${formatCurrencyAbbrevTruncated(readyToBillTotal)}
                  </button>
                </div>
                {stagesSectionOpen.readyToBill && (
                  <JobsStagesUnifiedTable
                    rows={readyToBillRows}
                    actionLabel={'Bill Customer'}
                    onJobAction={(j) => {
                      if (!jobLedgerHasCustomerForBilling(j.customer_id)) {
                        showToast('Link this job to a customer before billing.', 'error')
                        openEdit(j, { billingCustomerHighlight: true })
                        return
                      }
                      billCustomer?.openBillCustomer({
                        payload: { kind: 'job', job: jobBillingContextFromJob(j) },
                        onSuccess: async () => {
                          await loadJobs()
                          followMovedJob(j.id, 'billed')
                        },
                        onAfterEnsureSuccess: async () => {
                          await loadJobs()
                        },
                      })
                    }}
                    onInvoiceAction={(inv) => {
                      if (!jobLedgerHasCustomerForBilling(inv.job.customer_id)) {
                        showToast('Link this job to a customer before billing.', 'error')
                        openEdit(inv.job, { billingCustomerHighlight: true })
                        return
                      }
                      billCustomer?.openBillCustomer({
                        payload: {
                          kind: 'invoice',
                          job: jobBillingContextFromJob(inv.job),
                          // Memo + bundle flag drive the modal's standalone-charge
                          // pre-fill (riders: hazmat fee, trip charge).
                          invoice: {
                            id: inv.id,
                            amount: inv.amount,
                            status: inv.status,
                            stripe_invoice_memo: inv.stripe_invoice_memo ?? null,
                            is_primary_rtb_bundle: inv.is_primary_rtb_bundle ?? null,
                          },
                        },
                        onSuccess: async () => {
                          await loadJobs()
                          followMovedJob(inv.job.id, 'billed')
                        },
                        onAfterEnsureSuccess: async () => {
                          await loadJobs()
                        },
                      })
                    }}
                    onJobSendBack={(j) =>
                      stagesHamMode
                        ? void updateJobStatus(j.id, 'working')
                        : (setSendBackChecked(false),
                          setSendBackJob({
                            id: j.id,
                            hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
                            jobName: j.job_name ?? '—',
                            toStatus: 'working',
                            rtbDraftCount: (j.invoices ?? []).filter((i) => i.status === 'ready_to_bill').length,
                          }))}
                    onInvoiceSendBack={(inv) => stagesHamMode ? deleteInvoice(inv.id) : (setSendBackChecked(false), setSendBackInvoice({ inv, action: 'delete' }))}
                    showRemaining={true}
                    showTimeOpen={true}
                    showCreatePartialInvoice={true}
                    jobSendBackLabel={'Send Job Back'}
                    invoiceBundleActionLabel={DELETE_DRAFT_BILL_LABEL}
                    invoiceStandaloneActionLabel={DELETE_DRAFT_BILL_LABEL}
                    flashInvoiceId={stagesInvoiceFlashId}
                    stagesJobFlashId={stagesJobFlashId}
                    stagesHamMode={stagesHamMode}
                    assignedEditJobId={assignedEditJobId}
                    setAssignedEditJobId={setAssignedEditJobId}
                    assignedEditSelectedIds={assignedEditSelectedIds}
                    setAssignedEditSelectedIds={setAssignedEditSelectedIds}
                    assignedEditSavingId={assignedEditSavingId}
                    assignedEditDropdownRef={assignedEditDropdownRef}
                    users={users}
                    updateJobTeamMembers={updateJobTeamMembers}
                    renderStagesOpenDetailJobName={renderStagesOpenDetailJobName}
                    stagesStatusUpdatingId={stagesStatusUpdatingId}
                    pctCompleteSavingId={pctCompleteSavingId}
                    updateJobPctComplete={updateJobPctComplete}
                    commitStagesPctWithNote={commitStagesPctWithNote}
                    setCreatePartialInvoiceAmount={setCreatePartialInvoiceAmount}
                    setCreatePartialInvoiceJob={setCreatePartialInvoiceJob}
                    openEdit={openEdit}
                    openStagesDetailJobModal={openStagesDetailJobModal}
                    setAiaG702StagesJob={setAiaG702StagesJob}
                    canCreateHazmatFee={canCreateHazmatFee}
                    openHazmatFee={openHazmatFee}
                    canEditJobPctComplete={canEditJobPctComplete}
                    canManageJobPeople={canManageJobPeople}
                    setManageJobPeople={setManageJobPeople}
                    jobThreadNotesLoadingId={jobThreadNotesLoadingId}
                    jobThreadDraft={jobThreadDraft}
                    jobThreadSubmittingId={jobThreadSubmittingId}
                    setJobThreadDraft={setJobThreadDraft}
                    submitJobThreadNote={submitJobThreadNote}
                    authUser={authUser}
                    showToast={showToast}
                    customers={customers}
                    openEditJobAndCreateCustomerFlow={openEditJobAndCreateCustomerFlow}
                    stagesManHoursByJobId={stagesManHoursByJobId}
                    stagesManHoursLoading={stagesManHoursLoading}
                    stagesLaborBreakdownByJobId={stagesLaborBreakdownByJobId}
                    expandedJobThreadId={expandedJobThreadId}
                    toggleStagesJobThreadExpanded={toggleStagesJobThreadExpanded}
                    jobThreadStatsByJobId={jobThreadStatsByJobId}
                    jobThreadActivityByJobId={jobThreadActivityByJobId}
                    setViewReportsJob={setViewReportsJob}
                    applyStagesInvoiceFocus={applyStagesInvoiceFocus}
                    canOpenJobScheduleModal={canOpenJobScheduleModal}
                    setScheduleModalJob={setScheduleModalJob}
                    authRole={authRole}
                    loadJobs={loadJobs}
                    stagesInvoiceUpdatingId={stagesInvoiceUpdatingId}
                    invoiceEstimatedBillDateSavingId={invoiceEstimatedBillDateSavingId}
                    bumpInvoiceEstimatedBillDate={bumpInvoiceEstimatedBillDate}
                    setWhenInvoiceBillModal={setWhenInvoiceBillModal}
                    setWhenInvoiceBillModalDate={setWhenInvoiceBillModalDate}
                  />
                )}

                <div id="stages-billed" style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => toggleStages('billed')}
                      aria-expanded={stagesSectionOpen.billed}
                      style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                    >
                      <span aria-hidden>{stagesSectionOpen.billed ? '\u25BC' : '\u25B6'}</span>
                      Billed Awaiting Payment ({billedActiveRows.length}) - ${formatCurrencyAbbrevTruncated(billedTotal)}
                    </button>
                    <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                      {`30+ days: ${billedAgingBuckets.count30_90} | $${formatCurrencyAbbrevTruncated(billedAgingBuckets.sum30_90)} — 90+ days: ${billedAgingBuckets.count90} | $${formatCurrencyAbbrevTruncated(billedAgingBuckets.sum90)} · est. bill date`}
                    </span>
                  </div>
                  <div style={{ position: 'relative', flexShrink: 0, width: 'fit-content' }}>
                    <button
                      type="button"
                      onClick={() => setBankPaymentsModalOpen(true)}
                      disabled={
                        !(
                          authRole === 'dev' ||
                          authRole === 'master_technician' ||
                          isAssistantLike(authRole) ||
                          authRole === 'primary'
                        )
                      }
                      title={accountsReceivableButtonAccessibleName}
                      aria-label={accountsReceivableButtonAccessibleName}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        height: 36,
                        padding: '0 0.75rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        background:
                          !(
                            authRole === 'dev' ||
                            authRole === 'master_technician' ||
                            isAssistantLike(authRole) ||
                            authRole === 'primary'
                          )
                            ? 'var(--bg-muted)'
                            : 'var(--surface)',
                        cursor:
                          !(
                            authRole === 'dev' ||
                            authRole === 'master_technician' ||
                            isAssistantLike(authRole) ||
                            authRole === 'primary'
                          )
                            ? 'not-allowed'
                            : 'pointer',
                        color: 'var(--text-700)',
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                      }}
                    >
                      Accounts Receivable
                    </button>
                    {typeof arBankTxUnallocatedCount === 'number' && arBankTxUnallocatedCount > 0 ? (
                      <span
                        aria-hidden
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          minWidth: 18,
                          padding: '0 5px',
                          height: 18,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 9999,
                          background: '#f59e0b',
                          color: '#1c1917',
                          fontSize: 10,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          lineHeight: 1,
                          boxSizing: 'border-box',
                          pointerEvents: 'none',
                        }}
                      >
                        {arBankTxUnallocatedCount > 99 ? '99+' : arBankTxUnallocatedCount}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => printBilledAwaitingPaymentReport(billedActiveRows, { searchFilter: stagesSearchQuery })}
                    disabled={billedActiveRows.length === 0}
                    title="Print customers, contacts, and amounts due"
                    aria-label="Print billed awaiting payment report"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      flexShrink: 0,
                      height: 36,
                      padding: '0 0.75rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: billedActiveRows.length === 0 ? 'var(--bg-muted)' : 'var(--surface)',
                      cursor: billedActiveRows.length === 0 ? 'not-allowed' : 'pointer',
                      color: 'var(--text-700)',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} aria-hidden>
                      <path
                        fill="currentColor"
                        d="M128 192L128 96C128 78.3 142.3 64 160 64L480 64C497.7 64 512 78.3 512 96L512 192L552 192C569.7 192 584 206.3 584 224L584 384C584 401.7 569.7 416 552 416L512 416L512 520C512 537.7 497.7 552 480 552L160 552C142.3 552 128 537.7 128 520L128 416L88 416C70.3 416 56 401.7 56 384L56 224C56 206.3 70.3 192 88 192L128 192zM176 416L176 496L464 496L464 416L176 416zM512 352L512 256L88 256L88 352L128 352L128 192L512 192L512 352zM464 144L464 120C464 111.2 456.8 104 448 104L192 104C183.2 104 176 111.2 176 120L176 144L464 144z"
                      />
                    </svg>
                    Print
                  </button>
                </div>
                {stagesSectionOpen.billed && (
                  <JobsStagesUnifiedTable
                    rows={billedActiveRows}
                    actionLabel={'Mark Paid'}
                    onJobAction={(j) => setMarkPaidJob(j)}
                    onInvoiceAction={(inv) => setMarkPaidInvoice(inv)}
                    onViewBill={(inv) => setViewBillInvoice(inv)}
                    showClickTooling={false}
                    onOpenLienTooling={(ctx) =>
                      setLienToolingPrefillModal({ job: ctx.job, invoice: ctx.invoice })}
                    onJobSendBack={(j) =>
                      stagesHamMode
                        ? (nudgeMissingBillingEmail(j.id), void moveJobToReadyToBillWithStripePrep(j.id))
                        : (setSendBackChecked(false),
                          setSendBackJob({
                            id: j.id,
                            hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—',
                            jobName: j.job_name ?? '—',
                            toStatus: 'ready_to_bill',
                            rtbDraftCount: 0,
                          }))}
                    onInvoiceSendBack={(inv) =>
                      stagesHamMode
                        ? void revertBilledInvoiceToReadyToBill(inv)
                        : (setSendBackChecked(false), setSendBackInvoice({ inv, action: 'revert' }))}
                    showRemaining={true}
                    showTimeOpen={true}
                    sendBackBelowRemaining={true}
                    showCreatePartialInvoice={false}
                    invoiceBundleActionLabel={'Send back'}
                    flashInvoiceId={stagesInvoiceFlashId}
                    onJobMoveToCollections={canManageCollections
                      ? (j) => {
                          setCollectionsNoteDraft('')
                          setCollectionsConfirm({ job: j, direction: 'to' })
                        }
                      : undefined}
                    stagesJobFlashId={stagesJobFlashId}
                    stagesHamMode={stagesHamMode}
                    assignedEditJobId={assignedEditJobId}
                    setAssignedEditJobId={setAssignedEditJobId}
                    assignedEditSelectedIds={assignedEditSelectedIds}
                    setAssignedEditSelectedIds={setAssignedEditSelectedIds}
                    assignedEditSavingId={assignedEditSavingId}
                    assignedEditDropdownRef={assignedEditDropdownRef}
                    users={users}
                    updateJobTeamMembers={updateJobTeamMembers}
                    renderStagesOpenDetailJobName={renderStagesOpenDetailJobName}
                    stagesStatusUpdatingId={stagesStatusUpdatingId}
                    pctCompleteSavingId={pctCompleteSavingId}
                    updateJobPctComplete={updateJobPctComplete}
                    commitStagesPctWithNote={commitStagesPctWithNote}
                    setCreatePartialInvoiceAmount={setCreatePartialInvoiceAmount}
                    setCreatePartialInvoiceJob={setCreatePartialInvoiceJob}
                    openEdit={openEdit}
                    openStagesDetailJobModal={openStagesDetailJobModal}
                    setAiaG702StagesJob={setAiaG702StagesJob}
                    canCreateHazmatFee={canCreateHazmatFee}
                    openHazmatFee={openHazmatFee}
                    canEditJobPctComplete={canEditJobPctComplete}
                    canManageJobPeople={canManageJobPeople}
                    setManageJobPeople={setManageJobPeople}
                    jobThreadNotesLoadingId={jobThreadNotesLoadingId}
                    jobThreadDraft={jobThreadDraft}
                    jobThreadSubmittingId={jobThreadSubmittingId}
                    setJobThreadDraft={setJobThreadDraft}
                    submitJobThreadNote={submitJobThreadNote}
                    authUser={authUser}
                    showToast={showToast}
                    customers={customers}
                    openEditJobAndCreateCustomerFlow={openEditJobAndCreateCustomerFlow}
                    stagesManHoursByJobId={stagesManHoursByJobId}
                    stagesManHoursLoading={stagesManHoursLoading}
                    stagesLaborBreakdownByJobId={stagesLaborBreakdownByJobId}
                    expandedJobThreadId={expandedJobThreadId}
                    toggleStagesJobThreadExpanded={toggleStagesJobThreadExpanded}
                    jobThreadStatsByJobId={jobThreadStatsByJobId}
                    jobThreadActivityByJobId={jobThreadActivityByJobId}
                    setViewReportsJob={setViewReportsJob}
                    applyStagesInvoiceFocus={applyStagesInvoiceFocus}
                    canOpenJobScheduleModal={canOpenJobScheduleModal}
                    setScheduleModalJob={setScheduleModalJob}
                    authRole={authRole}
                    loadJobs={loadJobs}
                    stagesInvoiceUpdatingId={stagesInvoiceUpdatingId}
                    invoiceEstimatedBillDateSavingId={invoiceEstimatedBillDateSavingId}
                    bumpInvoiceEstimatedBillDate={bumpInvoiceEstimatedBillDate}
                    setWhenInvoiceBillModal={setWhenInvoiceBillModal}
                    setWhenInvoiceBillModalDate={setWhenInvoiceBillModalDate}
                  />
                )}

                <div id="stages-collections" style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => toggleStages('collections')}
                    aria-expanded={stagesSectionOpen.collections}
                    style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <span aria-hidden>{stagesSectionOpen.collections ? '▼' : '▶'}</span>
                    Collections ({collectionsRows.length}) - ${formatCurrencyAbbrevTruncated(collectionsTotal)}
                  </button>
                  <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                    Billed jobs flagged difficult to collect — still awaiting payment
                  </span>
                </div>
                {stagesSectionOpen.collections && (collectionsRows.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
                    No jobs in Collections. Use “Move to Collections” on a Billed Awaiting Payment row to park a hard-to-collect job here.
                  </p>
                ) : (
                  <JobsStagesUnifiedTable
                    rows={collectionsRows}
                    actionLabel={'Mark Paid'}
                    onJobAction={(j) => setMarkPaidJob(j)}
                    onInvoiceAction={(inv) => setMarkPaidInvoice(inv)}
                    onViewBill={(inv) => setViewBillInvoice(inv)}
                    showClickTooling={false}
                    onOpenLienTooling={(ctx) =>
                      setLienToolingPrefillModal({ job: ctx.job, invoice: ctx.invoice })}
                    onJobSendBack={(j) => setCollectionsConfirm({ job: j, direction: 'from' })}
                    onInvoiceSendBack={(inv) => setCollectionsConfirm({ job: inv.job, direction: 'from' })}
                    showRemaining={true}
                    showTimeOpen={true}
                    sendBackBelowRemaining={true}
                    showCreatePartialInvoice={false}
                    jobSendBackLabel={'Send back to Billed'}
                    invoiceBundleActionLabel={'Send back to Billed'}
                    invoiceStandaloneActionLabel={'Send back to Billed'}
                    flashInvoiceId={stagesInvoiceFlashId}
                    jobNoteLine={(j) => j.collections_note ?? null}
                    stagesJobFlashId={stagesJobFlashId}
                    stagesHamMode={stagesHamMode}
                    assignedEditJobId={assignedEditJobId}
                    setAssignedEditJobId={setAssignedEditJobId}
                    assignedEditSelectedIds={assignedEditSelectedIds}
                    setAssignedEditSelectedIds={setAssignedEditSelectedIds}
                    assignedEditSavingId={assignedEditSavingId}
                    assignedEditDropdownRef={assignedEditDropdownRef}
                    users={users}
                    updateJobTeamMembers={updateJobTeamMembers}
                    renderStagesOpenDetailJobName={renderStagesOpenDetailJobName}
                    stagesStatusUpdatingId={stagesStatusUpdatingId}
                    pctCompleteSavingId={pctCompleteSavingId}
                    updateJobPctComplete={updateJobPctComplete}
                    commitStagesPctWithNote={commitStagesPctWithNote}
                    setCreatePartialInvoiceAmount={setCreatePartialInvoiceAmount}
                    setCreatePartialInvoiceJob={setCreatePartialInvoiceJob}
                    openEdit={openEdit}
                    openStagesDetailJobModal={openStagesDetailJobModal}
                    setAiaG702StagesJob={setAiaG702StagesJob}
                    canCreateHazmatFee={canCreateHazmatFee}
                    openHazmatFee={openHazmatFee}
                    canEditJobPctComplete={canEditJobPctComplete}
                    canManageJobPeople={canManageJobPeople}
                    setManageJobPeople={setManageJobPeople}
                    jobThreadNotesLoadingId={jobThreadNotesLoadingId}
                    jobThreadDraft={jobThreadDraft}
                    jobThreadSubmittingId={jobThreadSubmittingId}
                    setJobThreadDraft={setJobThreadDraft}
                    submitJobThreadNote={submitJobThreadNote}
                    authUser={authUser}
                    showToast={showToast}
                    customers={customers}
                    openEditJobAndCreateCustomerFlow={openEditJobAndCreateCustomerFlow}
                    stagesManHoursByJobId={stagesManHoursByJobId}
                    stagesManHoursLoading={stagesManHoursLoading}
                    stagesLaborBreakdownByJobId={stagesLaborBreakdownByJobId}
                    expandedJobThreadId={expandedJobThreadId}
                    toggleStagesJobThreadExpanded={toggleStagesJobThreadExpanded}
                    jobThreadStatsByJobId={jobThreadStatsByJobId}
                    jobThreadActivityByJobId={jobThreadActivityByJobId}
                    setViewReportsJob={setViewReportsJob}
                    applyStagesInvoiceFocus={applyStagesInvoiceFocus}
                    canOpenJobScheduleModal={canOpenJobScheduleModal}
                    setScheduleModalJob={setScheduleModalJob}
                    authRole={authRole}
                    loadJobs={loadJobs}
                    stagesInvoiceUpdatingId={stagesInvoiceUpdatingId}
                    invoiceEstimatedBillDateSavingId={invoiceEstimatedBillDateSavingId}
                    bumpInvoiceEstimatedBillDate={bumpInvoiceEstimatedBillDate}
                    setWhenInvoiceBillModal={setWhenInvoiceBillModal}
                    setWhenInvoiceBillModalDate={setWhenInvoiceBillModalDate}
                  />
                ))}

                {/* Header row mirrors the Billed section: toggle on the left, affordances flushed right. */}
                <div style={{ margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setStagesSectionOpen((prev) => {
                      const nextOpen = !prev.paid
                      if (nextOpen) {
                        queueMicrotask(() => void fetchPaidJobsIfNeeded(customerFilterForFetch))
                      }
                      return { ...prev, paid: nextOpen }
                    })
                  }}
                  aria-expanded={stagesSectionOpen.paid}
                  style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', flex: 1, minWidth: 0 }}
                >
                  <span aria-hidden>{stagesSectionOpen.paid ? '\u25BC' : '\u25B6'}</span>
                  {(() => {
                    const countPart = paidJobsLoading
                      ? '…'
                      : paidJobsMergedForKey === jobsListDataKey && jobsListDataKey != null
                        ? paid.length
                        : 'Expand to load'
                    const suffix = paidJobsLoading ? ' — loading' : ''
                    if (countPart === 'Expand to load') {
                      return (
                        <>
                          Paid in Full (
                          <span style={{ color: 'var(--text-red-600)' }}>Expand to load</span>)
                          {suffix}
                        </>
                      )
                    }
                    return `Paid in Full (${countPart})${suffix}`
                  })()}
                </button>
                {(authRole === 'dev' || authRole === 'master_technician') && (
                  <button
                    type="button"
                    onClick={() => setPaidEmailSettingsOpen(true)}
                    title="Paid in Full email settings"
                    aria-label="Paid in Full email settings"
                    style={{
                      flexShrink: 0,
                      height: 32,
                      padding: '0 0.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: 'var(--surface)',
                      cursor: 'pointer',
                      color: 'var(--text-700)',
                      fontSize: '1rem',
                    }}
                  >
                    <span aria-hidden>⚙</span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Paid notifications</span>
                  </button>
                )}
                </div>
                {stagesSectionOpen.paid ? (
                  <>
                    {paidJobsLoading ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem' }} role="status">
                        Loading paid jobs…
                      </p>
                    ) : null}
                    <JobsStagesTable
                      jobList={paid}
                      actionLabel={null}
                      onAction={() => {}}
                      showTimeOpen={true}
                      onSendBack={undefined}
                      onSendBackSimple={stagesHamMode
                        ? (j) => updateJobStatus(j.id, 'billed')
                        : (j) => setSendBackConfirmJob({ id: j.id, toStatus: 'billed' })}
                      showPctComplete={true}
                      stagesJobFlashId={stagesJobFlashId}
                      stagesHamMode={stagesHamMode}
                      assignedEditJobId={assignedEditJobId}
                      setAssignedEditJobId={setAssignedEditJobId}
                      assignedEditSelectedIds={assignedEditSelectedIds}
                      setAssignedEditSelectedIds={setAssignedEditSelectedIds}
                      assignedEditSavingId={assignedEditSavingId}
                      assignedEditDropdownRef={assignedEditDropdownRef}
                      users={users}
                      updateJobTeamMembers={updateJobTeamMembers}
                      renderStagesOpenDetailJobName={renderStagesOpenDetailJobName}
                      stagesStatusUpdatingId={stagesStatusUpdatingId}
                      pctCompleteSavingId={pctCompleteSavingId}
                      updateJobPctComplete={updateJobPctComplete}
                      commitStagesPctWithNote={commitStagesPctWithNote}
                      setCreatePartialInvoiceAmount={setCreatePartialInvoiceAmount}
                      setCreatePartialInvoiceJob={setCreatePartialInvoiceJob}
                      openEdit={openEdit}
                      openStagesDetailJobModal={openStagesDetailJobModal}
                      setAiaG702StagesJob={setAiaG702StagesJob}
                      canCreateHazmatFee={canCreateHazmatFee}
                      openHazmatFee={openHazmatFee}
                      canEditJobPctComplete={canEditJobPctComplete}
                      canManageJobPeople={canManageJobPeople}
                      setManageJobPeople={setManageJobPeople}
                      jobThreadNotesLoadingId={jobThreadNotesLoadingId}
                      jobThreadDraft={jobThreadDraft}
                      jobThreadSubmittingId={jobThreadSubmittingId}
                      setJobThreadDraft={setJobThreadDraft}
                      submitJobThreadNote={submitJobThreadNote}
                      authUser={authUser}
                      showToast={showToast}
                      customers={customers}
                      openEditJobAndCreateCustomerFlow={openEditJobAndCreateCustomerFlow}
                      stagesManHoursByJobId={stagesManHoursByJobId}
                      stagesManHoursLoading={stagesManHoursLoading}
                      stagesLaborBreakdownByJobId={stagesLaborBreakdownByJobId}
                      expandedJobThreadId={expandedJobThreadId}
                      toggleStagesJobThreadExpanded={toggleStagesJobThreadExpanded}
                      jobThreadStatsByJobId={jobThreadStatsByJobId}
                      jobThreadActivityByJobId={jobThreadActivityByJobId}
                      setViewReportsJob={setViewReportsJob}
                      applyStagesInvoiceFocus={applyStagesInvoiceFocus}
                      canOpenJobScheduleModal={canOpenJobScheduleModal}
                      setScheduleModalJob={setScheduleModalJob}
                      authRole={authRole}
                      loadJobs={loadJobs}
                    />
                  </>
                ) : null}

                {billedTotalByNameModalOpen && (() => {
                  const byNameRows = new Map<string, StageRow[]>()
                  for (const r of billedActiveRows) {
                    const name = r.job.job_name || '—'
                    const list = byNameRows.get(name) ?? []
                    list.push(r)
                    byNameRows.set(name, list)
                  }
                  const entries = [...byNameRows.entries()]
                    .map(([name, rows]) => ({
                      name,
                      rows,
                      total: rows.reduce((sum, row) => sum + stageRowBilledRemainingAmount(row), 0),
                    }))
                    .sort((a, b) => b.total - a.total)
                  return (
                    <div role="dialog" aria-modal="true" aria-label="Billed Awaiting Payment by Job Name" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 560, maxHeight: '80vh', overflow: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                          <h2 style={{ margin: 0, fontSize: '1.25rem', flex: 1, minWidth: 0 }}>Billed Awaiting Payment by Job Name</h2>
                          <button
                            type="button"
                            onClick={() => printBilledAwaitingPaymentReport(billedActiveRows, { searchFilter: stagesSearchQuery })}
                            disabled={billedActiveRows.length === 0}
                            title="Print customers, contacts, and amounts due"
                            aria-label="Print billed awaiting payment report"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              flexShrink: 0,
                              height: 36,
                              padding: '0 0.75rem',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: billedActiveRows.length === 0 ? 'var(--bg-muted)' : 'var(--surface)',
                              cursor: billedActiveRows.length === 0 ? 'not-allowed' : 'pointer',
                              color: 'var(--text-700)',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} aria-hidden>
                              <path
                                fill="currentColor"
                                d="M128 192L128 96C128 78.3 142.3 64 160 64L480 64C497.7 64 512 78.3 512 96L512 192L552 192C569.7 192 584 206.3 584 224L584 384C584 401.7 569.7 416 552 416L512 416L512 520C512 537.7 497.7 552 480 552L160 552C142.3 552 128 537.7 128 520L128 416L88 416C70.3 416 56 401.7 56 384L56 224C56 206.3 70.3 192 88 192L128 192zM176 416L176 496L464 496L464 416L176 416zM512 352L512 256L88 256L88 352L128 352L128 192L512 192L512 352zM464 144L464 120C464 111.2 456.8 104 448 104L192 104C183.2 104 176 111.2 176 120L176 144L464 144z"
                              />
                            </svg>
                            Print
                          </button>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Job Name</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map(({ name, total, rows }, idx) => {
                              const expanded = billedTotalByNameExpandedName === name
                              const panelId = `total-by-name-detail-${idx}`
                              const detailRows = sortStageRowsForTotalByNameDetail(rows)
                              return (
                                <Fragment key={name}>
                                  <tr style={{ borderBottom: expanded ? 'none' : '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setBilledTotalByNameExpandedName((prev) => (prev === name ? null : name))
                                        }
                                        aria-expanded={expanded}
                                        aria-controls={panelId}
                                        id={`total-by-name-toggle-${idx}`}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.35rem',
                                          padding: 0,
                                          border: 'none',
                                          background: 'none',
                                          cursor: 'pointer',
                                          color: 'var(--text-strong)',
                                          fontSize: 'inherit',
                                          textAlign: 'left',
                                          maxWidth: '100%',
                                        }}
                                      >
                                        <span aria-hidden style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                          {expanded ? '\u25BC' : '\u25B6'}
                                        </span>
                                        {name}
                                      </button>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 500 }}>${formatCurrency(total)}</td>
                                  </tr>
                                  {expanded && (
                                    <tr>
                                      <td
                                        colSpan={2}
                                        style={{
                                          padding: 0,
                                          borderBottom:
                                            idx === entries.length - 1 ? 'none' : '1px solid var(--border)',
                                          background: 'var(--bg-subtle)',
                                        }}
                                      >
                                        <div id={panelId} role="region" aria-labelledby={`total-by-name-toggle-${idx}`} style={{ padding: '0.5rem 0.75rem 0.75rem' }}>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                            <thead>
                                              <tr>
                                                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Line</th>
                                                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Amount</th>
                                                <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Age</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {detailRows.map((r, detailIdx) => {
                                                const amt = stageRowBilledRemainingAmount(r)
                                                const days = stageRowBilledAgeDays(r)
                                                const ageLabel = days == null ? '—' : `${days} day${days !== 1 ? 's' : ''}`
                                                const rowKey =
                                                  r.kind === 'job' ? `job-${r.job.id}` : `inv-${r.inv.id}`
                                                const addr = (r.job.job_address ?? '').trim() || '—'
                                                const isLastBillInGroup = detailIdx === detailRows.length - 1
                                                return (
                                                  <Fragment key={rowKey}>
                                                    <tr style={{ borderBottom: 'none' }}>
                                                      <td style={{ padding: '0.35rem 0.5rem' }}>{stageRowBilledLineLabel(r)}</td>
                                                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>${formatCurrency(amt)}</td>
                                                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>{ageLabel}</td>
                                                    </tr>
                                                    <tr
                                                      style={{
                                                        borderBottom: isLastBillInGroup ? 'none' : '1px solid var(--border)',
                                                      }}
                                                    >
                                                      <td
                                                        colSpan={3}
                                                        style={{
                                                          padding: '0 0.5rem 0.35rem',
                                                          fontSize: '0.75rem',
                                                          color: 'var(--text-muted)',
                                                        }}
                                                      >
                                                        {addr}
                                                      </td>
                                                    </tr>
                                                  </Fragment>
                                                )
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setBilledTotalByNameModalOpen(false)
                              setStagesSectionOpen((prev) => ({ ...prev, billed: true }))
                              setTimeout(() => document.getElementById('stages-billed')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
                            }}
                            style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                          >
                            take me to Job: Stages: Billed
                          </button>
                          <button type="button" onClick={() => setBilledTotalByNameModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Close</button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
                {capableToBillModalOpen && (() => {
                  const rows = buildCapableToBillBreakdownRows(working)
                  return (
                    <div role="dialog" aria-modal="true" aria-label="Billed Awaiting Payment by Job Name" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 480, maxWidth: 720, maxHeight: '80vh', overflow: 'auto' }}>
                        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Capable of Being Billed — Breakdown</h2>
                        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          Jobs in Working with billable value. Sorted by amount.
                        </p>
                        {rows.length === 0 ? (
                          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No jobs with billable amount</p>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Job</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>%</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Done</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Paid</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>To Bill</th>
                                <th style={{ padding: '0.5rem 0.75rem', width: 80 }} />
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(({ job, toBill, valueCreated }) => (
                                <tr key={job.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <div>{job.job_name || '—'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'}</div>
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{job.pct_complete != null ? `${job.pct_complete}%` : '—'}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatCurrency(valueCreated)}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatCurrency(Number(job.payments_made ?? 0))}</td>
                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(toBill)}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        tryOpenEditJob(job.id, {
                                          initialJob: job,
                                          onSaved: () => {
                                            void loadJobs()
                                            refreshCustomersAfterJobFormSave()
                                          },
                                        })
                                        setCapableToBillModalOpen(false)
                                      }}
                                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      View
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                                <td colSpan={4} style={{ padding: '0.5rem 0.75rem' }}>Total</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatCurrency(capableToBillTotal)}</td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        )}
                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setCapableToBillModalOpen(false)
                              setStagesSectionOpen((prev) => ({ ...prev, working: true }))
                              setTimeout(() => document.getElementById('stages-working')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
                            }}
                            style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                          >
                            take me to Job: Stages: Working
                          </button>
                          <button type="button" onClick={() => setCapableToBillModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Close</button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
                {whenInvoiceBillModal && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                    <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 480 }}>
                      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Est. bill date for partial invoice</h2>
                      <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {whenInvoiceBillModal.jobName} ({whenInvoiceBillModal.hcpNumber})
                      </p>
                      <label style={{ display: 'block', marginBottom: '1rem' }}>
                        <span style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Date</span>
                        <input
                          type="date"
                          value={whenInvoiceBillModalDate}
                          onChange={(e) => setWhenInvoiceBillModalDate(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
                        />
                      </label>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setWhenInvoiceBillModal(null)
                            setWhenInvoiceBillModalDate('')
                          }}
                          style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={
                            !whenInvoiceBillModalDate.trim() ||
                            invoiceEstimatedBillDateSavingId === whenInvoiceBillModal.invoiceId
                          }
                          onClick={async () => {
                            if (!whenInvoiceBillModalDate.trim() || !whenInvoiceBillModal) return
                            await setInvoiceEstimatedBillDate(
                              whenInvoiceBillModal.invoiceId,
                              whenInvoiceBillModal.jobId,
                              whenInvoiceBillModalDate.trim()
                            )
                            setWhenInvoiceBillModal(null)
                            setWhenInvoiceBillModalDate('')
                          }}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor:
                              !whenInvoiceBillModalDate.trim() ||
                              invoiceEstimatedBillDateSavingId === whenInvoiceBillModal.invoiceId
                                ? 'not-allowed'
                                : 'pointer',
                          }}
                        >
                          {invoiceEstimatedBillDateSavingId === whenInvoiceBillModal.invoiceId ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}
      {viewReportsJob && (
        <JobReportsModal
          open={!!viewReportsJob}
          onClose={() => setViewReportsJob(null)}
          jobId={viewReportsJob.id}
          hcpNumber={viewReportsJob.hcpNumber}
          jobName={viewReportsJob.jobName}
          jobAddress={viewReportsJob.jobAddress}
          authUserId={authUser?.id ?? null}
          userRole={authRole}
        />
      )}
      {readyForBillingJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Ready to Bill</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {readyForBillingJob.hcpNumber} · {readyForBillingJob.jobName}
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
                <input type="checkbox" checked={readyForBillingChecked1} onChange={(e) => setReadyForBillingChecked1(e.target.checked)} style={{ marginTop: 4 }} />
                <span>I have reported all the Job Parts I&apos;ve used</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={readyForBillingChecked2} onChange={(e) => setReadyForBillingChecked2(e.target.checked)} style={{ marginTop: 4 }} />
                <span>The customer knows the work is done and is satisfied</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setReadyForBillingJob(null); setReadyForBillingChecked1(false); setReadyForBillingChecked2(false) }} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={!readyForBillingChecked1 || !readyForBillingChecked2 || stagesStatusUpdatingId === readyForBillingJob.id} onClick={async () => { if (!readyForBillingJob) return; nudgeMissingBillingEmail(readyForBillingJob.id); const ok = await moveJobToReadyToBillWithStripePrep(readyForBillingJob.id); if (!ok) return; setReadyForBillingJob(null); setReadyForBillingChecked1(false); setReadyForBillingChecked2(false) }} style={{ padding: '0.5rem 1rem', background: readyForBillingChecked1 && readyForBillingChecked2 && stagesStatusUpdatingId !== readyForBillingJob.id ? '#3b82f6' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: readyForBillingChecked1 && readyForBillingChecked2 && stagesStatusUpdatingId !== readyForBillingJob.id ? 'pointer' : 'not-allowed' }}>{stagesStatusUpdatingId === readyForBillingJob.id ? '…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
      {createPartialInvoiceJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Create partial invoice</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{effectiveJobLedgerNumber(createPartialInvoiceJob.hcp_number, createPartialInvoiceJob.click_number) || '—'} · {createPartialInvoiceJob.job_name ?? '—'}</p>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>Remaining: ${formatCurrency(jobBillingUnallocatedDollars(createPartialInvoiceJob))}</div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Amount ($)
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={createPartialInvoiceAmount}
                  onChange={(e) => setCreatePartialInvoiceAmount(e.target.value)}
                  onBlur={() => {
                    if (!createPartialInvoiceJob) return
                    const raw = parseFloat(createPartialInvoiceAmount)
                    if (!Number.isFinite(raw)) return
                    const useCents = clampPartialInvoiceCentsToUnallocated(createPartialInvoiceJob, raw)
                    const clamped = useCents / 100
                    if (Math.round(raw * 100) !== useCents) {
                      setCreatePartialInvoiceAmount(String(clamped))
                      setError(null)
                    }
                  }}
                  placeholder="0"
                  style={{ width: '100%', marginTop: 4, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </label>
              {error && <p style={{ color: 'var(--text-red-700)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>{error}</p>}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setCreatePartialInvoiceJob(null); setCreatePartialInvoiceAmount(''); setError(null) }} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={creatingPartialInvoiceFromModal || !(parseFloat(createPartialInvoiceAmount) > 0)} onClick={createInvoiceFromModal} style={{ padding: '0.5rem 1rem', background: creatingPartialInvoiceFromModal || !(parseFloat(createPartialInvoiceAmount) > 0) ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: creatingPartialInvoiceFromModal || !(parseFloat(createPartialInvoiceAmount) > 0) ? 'not-allowed' : 'pointer' }}>{creatingPartialInvoiceFromModal ? '…' : 'Create invoice'}</button>
            </div>
          </div>
        </div>
      )}
      {paidEmailSettingsOpen && (
        <PaidInFullEmailSettingsModal onClose={() => setPaidEmailSettingsOpen(false)} />
      )}
      <BankPaymentsModal
        open={bankPaymentsModalOpen}
        onClose={() => setBankPaymentsModalOpen(false)}
        authUserId={authUser?.id}
        authRole={authRole}
        billedRows={bankPaymentsModalBilledRows}
        billedTargetsLoading={jobsListLoading && bankPaymentsModalBilledRows.length === 0}
        onApplied={async () => {
          await loadJobs()
        }}
        onOpenEditJob={(jobId) => tryOpenEditJob(jobId, { onSaved: () => void loadJobs() })}
      />
      <JobBookModal
        open={jobBookModalOpen}
        onClose={() => setJobBookModalOpen(false)}
        onDbError={(msg) => showToast(msg, 'error')}
      />
      <JobsCombineSeparateModal
        open={combineSeparateModalOpen}
        onClose={() => setCombineSeparateModalOpen(false)}
        onAfterSuccess={() => void runJobsStagesSerializedPipeline(() => Promise.resolve(loadJobs()))}
      />
      <BilledBillViewModal
        invoice={viewBillInvoice}
        onClose={() => {
          setViewBillInvoice(null)
        }}
        onAfterVoidStripeInvoiceSuccess={() => {
          scheduleLoadJobsAfterMutation()
        }}
        onAfterStripeDetailsLoaded={() => {
          void (async () => {
            let list = await runFetchJobs(customerFilterForFetch)
            // `runFetchJobs` can return undefined when a coalesced fetch is already in flight; retry once.
            if (list == null) list = await runFetchJobs(customerFilterForFetch)
            if (list == null) return
            setViewBillInvoice((prev) => {
              if (!prev) return null
              const merged = findInvoiceWithJobFromJobs(list, prev.id)
              return merged ?? prev
            })
          })()
        }}
      />
      <LienToolingPrefillModal
        open={lienToolingPrefillModal != null}
        onClose={() => setLienToolingPrefillModal(null)}
        job={lienToolingPrefillModal?.job ?? null}
        invoice={lienToolingPrefillModal?.invoice ?? null}
        senderNameFallback={lienToolingSenderFallback}
        authEmail={authUser?.email?.trim() ?? ''}
      />
      <AiaG702G703Modal
        open={aiaG702StagesJob != null}
        onClose={() => setAiaG702StagesJob(null)}
        job={aiaG702StagesJob}
        hcpForFilename={aiaG702StagesJob?.hcp_number ?? ''}
      />
      <HazmatFeeModal
        job={hazmatFeeJob}
        onClose={() => setHazmatFeeJob(null)}
        onCreated={() => {
          loadJobs()
        }}
      />
      <BilledPaymentConfirmationModal
        mode="job"
        invoice={null}
        payments={undefined}
        job={
          markPaidJob
            ? {
                id: markPaidJob.id,
                hcp_number: markPaidJob.hcp_number,
                click_number: markPaidJob.click_number,
                job_name: markPaidJob.job_name,
                revenue: markPaidJob.revenue,
                payments_made: markPaidJob.payments_made,
              }
            : null
        }
        stripeModeForBilling={stripeModeForBillingFromRole(authRole)}
        onClose={() => setMarkPaidJob(null)}
        onSuccess={async () => {
          await loadJobs()
        }}
      />
      <BilledPaymentConfirmationModal
        mode="invoice"
        invoice={markPaidInvoice}
        payments={markPaidInvoice?.job.payments}
        job={null}
        stripeModeForBilling={stripeModeForBillingFromRole(authRole)}
        onClose={() => setMarkPaidInvoice(null)}
        onSuccess={async () => {
          await loadJobs()
        }}
      />
      {sendBackInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>{sendBackInvoice.action === 'delete' ? DELETE_DRAFT_BILL_LABEL : 'Send back'}</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {`Job ${effectiveJobLedgerNumber(sendBackInvoice.inv.job.hcp_number, sendBackInvoice.inv.job.click_number) || '—'} · ${sendBackInvoice.inv.job.job_name || '—'} · $${Number(sendBackInvoice.inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </p>
            {sendBackInvoice.action === 'delete' && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>This will remove the invoice from Ready to Bill.</p>
            )}
            {sendBackInvoice.action === 'revert' &&
              invoiceNeedsStripeVoidForRevert(sendBackInvoice.inv) &&
              sendBackInvoiceStripeExplainerAfterFailure && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>
                This bill was sent via Stripe. We will void or remove the Stripe invoice so the customer cannot pay an unpaid bill. If it is already paid in Stripe, send back will fail until you resolve it there.
              </p>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={sendBackChecked} onChange={(e) => setSendBackChecked(e.target.checked)} style={{ marginTop: 4 }} />
                <span>I am going to call the Subcontractor and explain why I am voiding this bill and another will have to be issued</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setSendBackInvoice(null)
                  setSendBackChecked(false)
                  setSendBackInvoiceStripeExplainerAfterFailure(false)
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!sendBackChecked || stagesInvoiceUpdatingId === sendBackInvoice.inv.id}
                onClick={() => {
                  void (async () => {
                    if (!sendBackChecked || !sendBackInvoice) return
                    if (stagesInvoiceSendBackConfirmLockRef.current) return
                    stagesInvoiceSendBackConfirmLockRef.current = true
                    const { inv, action } = sendBackInvoice
                    try {
                      if (action === 'delete') {
                        setSendBackInvoice(null)
                        setSendBackChecked(false)
                        setSendBackInvoiceStripeExplainerAfterFailure(false)
                        await deleteInvoice(inv.id)
                      } else {
                        const ok = await revertBilledInvoiceToReadyToBill(inv)
                        if (ok) {
                          setSendBackInvoice(null)
                          setSendBackChecked(false)
                          setSendBackInvoiceStripeExplainerAfterFailure(false)
                        } else if (invoiceNeedsStripeVoidForRevert(inv)) {
                          setSendBackInvoiceStripeExplainerAfterFailure(true)
                        }
                      }
                    } finally {
                      stagesInvoiceSendBackConfirmLockRef.current = false
                    }
                  })()
                }}
                style={{ padding: '0.5rem 1rem', background: sendBackChecked && stagesInvoiceUpdatingId !== sendBackInvoice.inv.id ? '#3b82f6' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: sendBackChecked && stagesInvoiceUpdatingId !== sendBackInvoice.inv.id ? 'pointer' : 'not-allowed' }}
              >
                {stagesInvoiceUpdatingId === sendBackInvoice.inv.id ? '…' : sendBackInvoice.action === 'delete' ? DELETE_DRAFT_BILL_LABEL : 'Send back'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sendBackJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>{sendBackJob.toStatus === 'working' ? 'Send Job Back' : 'Send back'}</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
              {sendBackJob.toStatus === 'ready_to_bill'
                ? 'This will move the job back to Ready to Bill.'
                : sendBackJob.rtbDraftCount > 0
                  ? `This will move the job back to Assigned Jobs (Working). ${
                      sendBackJob.rtbDraftCount === 1
                        ? `This will also remove 1 Ready to Bill draft bill (same as ${DELETE_DRAFT_BILL_LABEL.replace('\u00A0', ' ')}).`
                        : `This will also remove ${sendBackJob.rtbDraftCount} Ready to Bill draft bills (same as ${DELETE_DRAFT_BILL_LABEL.replace('\u00A0', ' ')}).`
                    }`
                  : 'This will move the job back to Assigned Jobs (Working).'}
            </p>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {sendBackJob.hcpNumber} · {sendBackJob.jobName}
            </p>
            {sendBackJob.toStatus === 'working' && sendBackCollectPaymentNotice != null && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>{sendBackCollectPaymentNotice}</p>
            )}
            {sendBackStatusEventLine != null && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {sendBackStatusEventLine}
              </p>
            )}
            {sendBackJob.toStatus === 'ready_to_bill' && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>
                Billed lines on this job will be removed (Stripe invoices voided first where applicable). Lines with recorded payments block send back until adjusted. Paid Stripe invoices block until resolved in Stripe.
              </p>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={sendBackChecked}
                  onChange={(e) => setSendBackChecked(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>I am going to call the Subcontractor and explain why I am voiding this bill and another will have to be issued</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setSendBackJob(null)
                  setSendBackChecked(false)
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!sendBackChecked || stagesStatusUpdatingId === sendBackJob.id}
                onClick={async () => {
                  if (!sendBackJob) return
                  if (sendBackJob.toStatus === 'ready_to_bill') {
                    const token = await getAccessTokenForEdgeFunctions()
                    if (!token) {
                      setError('Not signed in')
                      return
                    }
                    const prep = await prepareBilledInvoicesBeforeJobRevertToReadyToBill({
                      jobId: sendBackJob.id,
                      authRole,
                      accessToken: token,
                    })
                    if (!prep.ok) {
                      setError(prep.message)
                      return
                    }
                  }
                  const ok = await updateJobStatus(sendBackJob.id, sendBackJob.toStatus)
                  if (!ok) return
                  setSendBackJob(null)
                  setSendBackChecked(false)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: sendBackChecked && stagesStatusUpdatingId !== sendBackJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: sendBackChecked && stagesStatusUpdatingId !== sendBackJob.id ? 'pointer' : 'not-allowed',
                }}
              >
                {stagesStatusUpdatingId === sendBackJob.id ? '…' : sendBackJob.toStatus === 'working' ? 'Send Job Back' : 'Send back'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmJobStatusJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Are you sure?</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {confirmJobStatusJob.message}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConfirmJobStatusJob(null)}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={stagesStatusUpdatingId === confirmJobStatusJob.id}
                onClick={async () => {
                  if (!confirmJobStatusJob) return
                  const ok = await updateJobStatus(confirmJobStatusJob.id, confirmJobStatusJob.toStatus)
                  if (!ok) return
                  setConfirmJobStatusJob(null)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: stagesStatusUpdatingId !== confirmJobStatusJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: stagesStatusUpdatingId !== confirmJobStatusJob.id ? 'pointer' : 'not-allowed',
                }}
              >
                {stagesStatusUpdatingId === confirmJobStatusJob.id ? '…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sendBackConfirmJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Are you sure?</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {sendBackConfirmJob.toStatus === 'waiting'
                ? 'This will move the job back to Waiting.'
                : sendBackConfirmJob.toStatus === 'ready_to_bill'
                  ? 'This will move the job back to Ready to Bill.'
                  : 'This will move the job back to Billed Awaiting Payment.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSendBackConfirmJob(null)}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={stagesStatusUpdatingId === sendBackConfirmJob.id}
                onClick={async () => {
                  if (!sendBackConfirmJob) return
                  const ok = await updateJobStatus(sendBackConfirmJob.id, sendBackConfirmJob.toStatus)
                  if (!ok) return
                  setSendBackConfirmJob(null)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: stagesStatusUpdatingId !== sendBackConfirmJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: stagesStatusUpdatingId !== sendBackConfirmJob.id ? 'pointer' : 'not-allowed',
                }}
              >
                {stagesStatusUpdatingId === sendBackConfirmJob.id ? '…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      {collectionsConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 420 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>
              {collectionsConfirm.direction === 'to' ? 'Move to Collections?' : 'Send back to Billed?'}
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {collectionsConfirm.direction === 'to'
                ? `Flag ${(collectionsConfirm.job.hcp_number ?? '').trim() || (collectionsConfirm.job.click_number ?? '').trim() || '—'} · ${(collectionsConfirm.job.job_name ?? '').trim() || 'Job'} as difficult to collect? It stays Billed — this only moves it to the Collections section.`
                : `Return ${(collectionsConfirm.job.hcp_number ?? '').trim() || (collectionsConfirm.job.click_number ?? '').trim() || '—'} · ${(collectionsConfirm.job.job_name ?? '').trim() || 'Job'} to Billed Awaiting Payment?`}
            </p>
            {collectionsConfirm.direction === 'to' ? (
              <label style={{ display: 'block', margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                Note (optional)
                <textarea
                  value={collectionsNoteDraft}
                  onChange={(e) => setCollectionsNoteDraft(e.target.value)}
                  placeholder="e.g. customer disputing invoice, no response in 60 days"
                  rows={3}
                  style={{ display: 'block', width: '100%', marginTop: '0.35rem', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </label>
            ) : collectionsConfirm.job.collections_note ? (
              <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-red-700)', fontStyle: 'italic' }}>
                Collections note: {collectionsConfirm.job.collections_note}
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setCollectionsConfirm(null)
                  setCollectionsNoteDraft('')
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={collectionsSaving}
                onClick={async () => {
                  if (!collectionsConfirm || collectionsSaving) return
                  const { job, direction } = collectionsConfirm
                  setCollectionsSaving(true)
                  try {
                    const res = await setJobCollectionsFlag(job.id, direction === 'to', direction === 'to' ? collectionsNoteDraft : undefined)
                    if (!res.ok) {
                      showToast(res.error ?? 'Could not update Collections.', 'error')
                      return
                    }
                    setCollectionsConfirm(null)
                    setCollectionsNoteDraft('')
                    showToast(direction === 'to' ? 'Job moved to Collections.' : 'Job returned to Billed Awaiting Payment.', 'success')
                    await loadJobs()
                    if (stagesFollowMoves) {
                      setStagesSectionOpen((prev) => ({ ...prev, [direction === 'to' ? 'collections' : 'billed']: true }))
                      setPendingStagesJobFocusId(job.id)
                      setStagesJobFlashId(job.id)
                    }
                  } finally {
                    setCollectionsSaving(false)
                  }
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: !collectionsSaving ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: !collectionsSaving ? 'pointer' : 'not-allowed',
                }}
              >
                {collectionsSaving ? '…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      {scheduleModalJob ? (
        <ScheduleJobModal
          key={scheduleModalJob.id}
          open
          onClose={() => setScheduleModalJob(null)}
          jobId={scheduleModalJob.id}
          jobTitle={`${(scheduleModalJob.hcp_number ?? '').trim() || '—'} · ${(scheduleModalJob.job_name ?? '').trim() || 'Job'}`}
          teamMembers={(scheduleModalJob.team_members ?? []).map((tm) => ({
            user_id: tm.user_id,
            name: tm.users?.name ?? null,
          }))}
          assigneeCandidates={users.map((u) => ({ user_id: u.id, name: u.name }))}
        />
      ) : null}
      <ManageJobPeopleModal
        open={manageJobPeople != null}
        onClose={() => setManageJobPeople(null)}
        jobId={manageJobPeople?.jobId ?? null}
        jobLabel={manageJobPeople?.jobLabel ?? ''}
        currentTeamUserIds={manageJobPeople?.currentTeamUserIds ?? []}
        onChanged={() => void loadJobs()}
      />
      {returnEditBannerJobId && active ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 0.85rem',
            background: '#1e40af',
            color: 'white',
            borderRadius: 8,
            border: '2px solid #1d4ed8',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: 'min(360px, calc(100vw - 2rem))',
          }}
        >
          <button
            type="button"
            onClick={() => {
              const jid = returnEditBannerJobId
              clearReturnEditJobFromStages()
              setReturnEditBannerJobId(null)
              if (!jid) return
              tryOpenEditJob(jid, {
                initialJob: jobs.find((j) => j.id === jid),
                onSaved: () => {
                  void loadJobs()
                },
              })
            }}
            style={{
              flex: 1,
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '0.15rem 0',
            }}
          >
            Back to Edit Job
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              clearReturnEditJobFromStages()
              setReturnEditBannerJobId(null)
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '1.35rem',
              lineHeight: 1,
              cursor: 'pointer',
              padding: '0 0.15rem',
            }}
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  )
})

export default JobsStagesTab
