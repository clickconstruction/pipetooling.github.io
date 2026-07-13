import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEventHandler,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toDatetimeLocal, fromDatetimeLocal } from '../utils/datetimeLocal'
import { useRealtimeChannel } from '../hooks/useRealtimeChannel'
import { upsertBidNotesReadWatermark } from '../lib/userBidNotesReadState'
import { openInExternalBrowser } from '../lib/openInExternalBrowser'
import { formatProjectNumberLabel } from '../lib/projectNumberLabel'
import { DELETE_DRAFT_BILL_LABEL } from '../lib/deleteDraftBillLabel'
import { formatMoveIntoStageByOnLine } from '../lib/formatMoveIntoStageByOnLine'
import {
  ensureLedgerInvoiceRemovedAfterStripeSendBack,
  invoiceNeedsStripeVoidForRevert,
  invokeVoidStripeInvoiceForRevert,
  prepareBilledInvoicesBeforeJobRevertToReadyToBill,
  stripeModeForBillingFromRole,
} from '../lib/voidStripeInvoiceForRevert'
import { getAccessTokenForEdgeFunctions } from '../lib/supabaseAccessTokenForEdge'
import { canLeaveJobFieldReport } from '../lib/canLeaveJobFieldReport'
import { syncJobToReadyToBillIfNoBilledInvoicesRemain } from '../lib/syncJobToReadyToBillIfNoBilledInvoicesRemain'
import {
  shouldResyncJobsAfterUpdateJobStatusFailure,
  toastForUpdateJobStatusFailure,
} from '../lib/updateJobStatusClientFeedback'
import { useAuth } from '../hooks/useAuth'
import { useDocumentVisibility } from '../hooks/useDocumentVisibility'
import { isSubcontractorLikeRole } from '../lib/subcontractorLikeRole'
import { useJobModeEnabled } from '../hooks/useJobModeEnabled'
import DashboardJobModeCard from '../components/jobMode/DashboardJobModeCard'
import TurnawayModal from '../components/jobMode/TurnawayModal'
import { useSendBackCollectPaymentFlowNotice } from '../hooks/useSendBackCollectPaymentFlowNotice'
import NewReportModal from '../components/NewReportModal'
import JobReportsModal from '../components/JobReportsModal'
import AdditionalReportModal from '../components/AdditionalReportModal'
import JobBillDetailsModal from '../components/JobBillDetailsModal'
import type { DetailJobModalAssignedJobRow } from '../components/jobs/DetailJobModal'
import CollectPaymentModal from '../components/jobs/CollectPaymentModal'
import {
  DASHBOARD_CLOCK_STRIP_SCOPE_KEY,
  readClockStripScopeFromStorage,
  stripScopeEligible,
} from '../lib/dashboardClockStripScopeStorage'
import DashboardFieldCollectPaymentQueue from '../components/dashboard/DashboardFieldCollectPaymentQueue'
import { BillingPipelineCard, BillingPipelineStage } from '../components/dashboard/BillingPipelineCard'
import { DashboardSectionDock } from '../components/dashboard/DashboardSectionDock'
import ReportEditModal, { type ReportForEdit } from '../components/ReportEditModal'
import ChecklistItemMuteModal from '../components/ChecklistItemMuteModal'
import {
  getPinnedForUserFromSupabase,
  type PinnedItem,
} from '../lib/pinnedTabs'
import { useToastContext } from '../contexts/ToastContext'
import { useJobFormModal } from '../contexts/JobFormModalContext'
import { useBidPreview } from '../contexts/BidPreviewModalContext'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { useEditProjectModal } from '../contexts/EditProjectModalContext'
import { useCostMatrixTotal } from '../hooks/useCostMatrixTotal'
import { useBilledTotal } from '../hooks/useBilledTotal'
import { useHoursAwaitingApprovalCount } from '../hooks/useHoursAwaitingApprovalCount'
import { useSupplyHousesAPTotal } from '../hooks/useSupplyHousesAPTotal'
import { useSubLaborDueTotal } from '../hooks/useSubLaborDueTotal'
import { useIsMobile } from '../hooks/useIsMobile'
import { useNarrowViewport660 } from '../hooks/useNarrowViewport660'
import { useFirstAssistantDispatchPhone } from '../hooks/useFirstAssistantDispatchPhone'
import ClockInOutButton from '../components/ClockInOutButton'
import { DashboardContractSigningPromptModal } from '../components/DashboardContractSigningPromptModal'
import TeamFeedbackWizard from '../components/team-feedback/TeamFeedbackWizard'
import { fetchTeamFeedbackSettings } from '../lib/teamFeedback'
import DashboardMyTimeSection from '../components/DashboardMyTimeSection'
import { DashboardMyTimeDayEditorModal } from '../components/DashboardMyTimeDayEditorModal'
import DashboardDevRejectedNotification from '../components/DashboardDevRejectedNotification'
import DashboardMyTeamPendingBanner from '../components/DashboardMyTeamPendingBanner'
import DashboardArBankUnallocatedBanner from '../components/DashboardArBankUnallocatedBanner'
import DashboardFinancialsSection from '../components/DashboardFinancialsSection'
import DashboardLostBidsMissingReasonBanner from '../components/DashboardLostBidsMissingReasonBanner'
import DashboardTallyStaleBanner from '../components/DashboardTallyStaleBanner'
import DashboardTallyStaleStaffBanner from '../components/DashboardTallyStaleStaffBanner'
import { DashboardStaleTallyStaffFollowUpModal } from '../components/DashboardStaleTallyStaffFollowUpModal'
import {
  canRoleSeeArBankUnallocatedDashboardBanner,
  useArBankUnallocatedCount,
} from '../hooks/useArBankUnallocatedCount'
import { useStaleTallyStaffFollowUp } from '../hooks/useStaleTallyStaffFollowUp'
import { TALLY_STALE_MIN_AGE_DAYS } from '../lib/tallyStaleMinAgeDays'
import { DashboardTeamActiveClockStrip } from '../components/DashboardTeamActiveClockStrip'
import { useDashboardMyTeamSectionState } from '../hooks/useDashboardMyTeamSectionState'
import { useApplyScheduleProportions } from '../hooks/useApplyScheduleProportions'
import { ApplyScheduleApprovedConfirmModal } from '../components/clock-sessions/ApplyScheduleApprovedConfirmModal'
import { useDispatchInbox } from '../hooks/useDispatchInbox'
import { DispatchInboxSection } from '../components/DispatchInboxSection'
import { DispatchDismissedItemsModal } from '../components/DispatchDismissedItemsModal'
import CreateTripChargeModal, { type CreateTripChargeTarget } from '../components/CreateTripChargeModal'
import { HelpFeedbackInboxSection } from '../components/HelpFeedbackInboxSection'
import {
  EstimatorInboxSection,
  type EstimatorInboxRow,
  type EstimatorThreadNoteRow,
} from '../components/EstimatorInboxSection'
import { ChecklistTitleWithLinks } from '../components/ChecklistTitleWithLinks'
import AssignedStageCard from '../components/AssignedStageCard'
import { type JobBillingContext } from '../lib/jobBillingContext'
import { useBillCustomerModal } from '../contexts/BillCustomerModalContext'
import BilledPaymentConfirmationModal, { type InvoiceWithJobLike } from '../components/jobs/BilledPaymentConfirmationModal'
import { getNextDisplayOrders } from '../utils/checklistOrder'
import { denverCalendarDayKey, getDefaultWeekRange, getLastWeekRange } from '../utils/dateUtils'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { notifyDispatchRequestsChanged } from '../lib/dispatchRequestHelpers'
import { readEdgeFunctionErrorBody } from '../lib/readEdgeFunctionErrorBody'
import { labelJobsLedgerStatusForDashboard } from '../lib/jobsLedgerStatusPipeline'
import { displayReportTemplateName } from '../lib/reportTemplateDisplayName'
import { formatReportFieldValueInlineList } from '../lib/reportSignatureField'
import { fetchDashboardPhase1 } from '../lib/dashboardBootQueries'
import { readDashboardBootCache, writeDashboardBootCache } from '../lib/dashboardBootCache'
import { displayNameFromAuthUser } from '../lib/displayNameFromAuthUser'
import { fetchHoursDaysCorrectWorkDates } from '../lib/fetchHoursDaysCorrectWorkDates'
import {
  buildReadyToBillDashboardUnits,
  resolveReadyToBillBillCustomerTarget,
  type ReadyToBillDashboardUnit as ReadyToBillDashboardUnitBase,
} from '../lib/buildReadyToBillDashboardUnits'
import { wouldEnsureNothingLeftToBillForJob } from '../lib/wouldEnsureNothingLeftToBillForJob'
import { syncSalaryClockSessionsForUserDay } from '../lib/salaryScheduleSync'
import { fetchSalariedUserIdSetFromUserIds } from '../lib/salaryPayConfigGate'
import { recordNotComingInForUserAsStaff } from '../lib/notComingInTimeOff'
import {
  AssignedSkeleton,
  ChecklistSkeleton,
  DashboardListRowSkeleton,
  MyBidsSectionSkeleton,
  MyTeamSectionSkeleton,
  RecentReportsSkeleton,
  SubscribedSkeleton,
} from '../components/dashboard/DashboardSkeletons'
import {
  fetchScheduleBlocksForAssigneeDateRange,
  type JobScheduleBlockRow,
} from '../lib/jobScheduleBlocks'
import { shouldShowLeaveReportScheduleReminder } from '../lib/leaveReportScheduleReminder'
import {
  SUBCONTRACTOR_ACTIVITY_SOURCE_ORDER,
  subcontractorActivitySourceLabel,
  type SubcontractorActivitySource,
} from '../lib/subcontractorJobActivityCopy'
import { subcontractorLastActivityMobileLine } from '../lib/subcontractorLastActivityCompact'
import SubcontractorJobActivityModal from '../components/dashboard/SubcontractorJobActivityModal'
import {
  scheduleDateKeyAddDays,
  scheduleFormatWeekdayLong,
  scheduleFormatWindow,
  scheduleTodayDateKey,
} from '../lib/jobScheduleChicago'

const DashboardMyTeamSection = lazy(() => import('../components/DashboardMyTeamSection'))
import type { Database } from '../types/database'
import type { ClockSessionRow, DashboardStripSession } from '../types/clockSessions'

function formatTimeSince(iso: string | null): string {
  if (!iso) return '—'
  const now = new Date()
  const then = new Date(iso)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffMs / 604800000)
  const diffMonths = Math.floor(diffMs / 2592000000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''}`
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''}`
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`
  return `${Math.floor(diffMonths / 12)} year${Math.floor(diffMonths / 12) !== 1 ? 's' : ''}`
}

/** Compact "time ago" for My Bids note summaries (e.g. 25m ago). */
function formatRelativeCompactAgo(iso: string | null): string {
  if (!iso) return '—'
  const now = new Date()
  const then = new Date(iso)
  const diffMs = now.getTime() - then.getTime()
  if (diffMs < 0) return 'just now'
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffMs / 604800000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffWeeks < 5) return `${diffWeeks}w ago`
  try {
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  } catch {
    return '—'
  }
}

const HIDE_ON_REFRESH_STORAGE_KEY = 'pipetooling_dashboard_hide_on_refresh_ids'

/** Dashboard My Bids: how many "from others" rows to add per "Show more" click. */
const MY_BID_OTHERS_VISIBLE_STEP = 5

/** Dashboard My Bids list: max rows (estimator match, non-lost), ordered by due date. */
const MY_BIDS_DASHBOARD_ROW_LIMIT = 50

type SubscribedStep = {
  step_id: string
  step_name: string
  project_id: string
  project_name: string
  project_number: string | null
  notify_when_started: boolean
  notify_when_complete: boolean
  notify_when_reopened: boolean
}

type JobsLedgerInvoiceRow = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type JobsLedgerPaymentRow = Database['public']['Tables']['jobs_ledger_payments']['Row']

type InvoiceForDashboard = JobsLedgerInvoiceRow & {
  hcp_number: string
  job_name: string
  job_address: string
  google_drive_link: string | null
  job_plans_link: string | null
  master_user_id: string
  customer_id: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  last_work_date: string | null
  /** Prefer job `created_at` for dashboard “Open … ago” labels */
  open_since_at: string | null
  invoice_payments: JobsLedgerPaymentRow[]
}

type DashboardInvoiceJoinRow = JobsLedgerInvoiceRow & {
  jobs_ledger: {
    hcp_number: string
    job_name: string
    job_address: string
    google_drive_link: string | null
    job_plans_link: string | null
    created_at: string | null
    master_user_id: string
    customer_id: string | null
    customer_name: string | null
    customer_email: string | null
    customer_phone: string | null
    last_work_date: string | null
  }
}

const DASHBOARD_INVOICES_JOBS_LEDGER_SELECT =
  'id, job_id, amount, status, created_at, is_primary_rtb_bundle, billed_at, estimated_bill_date, external_send_channel, external_send_note, hosted_invoice_url, sent_to_customer_at, sequence_order, stripe_invoice_id, stripe_invoice_memo, stripe_invoice_footer, stripe_invoice_status, agreed_write_down_at, agreed_write_down_by, agreed_write_down_note, agreed_write_down_previous_amount, agreed_write_down_stripe_credit_note_id, jobs_ledger!inner(hcp_number, job_name, job_address, google_drive_link, job_plans_link, created_at, master_user_id, customer_id, customer_name, customer_email, customer_phone, last_work_date)'

function buildPaymentsByInvoiceIdMap(payments: JobsLedgerPaymentRow[]): Map<string, JobsLedgerPaymentRow[]> {
  const m = new Map<string, JobsLedgerPaymentRow[]>()
  for (const p of payments) {
    if (!p.invoice_id) continue
    const list = m.get(p.invoice_id) ?? []
    list.push(p)
    m.set(p.invoice_id, list)
  }
  return m
}

function mapJoinedInvoiceToDashboard(
  r: DashboardInvoiceJoinRow,
  paymentsByInvoiceId: Map<string, JobsLedgerPaymentRow[]>,
): InvoiceForDashboard {
  const jl = r.jobs_ledger
  return {
    id: r.id,
    job_id: r.job_id,
    amount: r.amount,
    status: r.status,
    billed_at: r.billed_at,
    created_at: r.created_at,
    estimated_bill_date: r.estimated_bill_date,
    external_send_channel: r.external_send_channel,
    external_send_note: r.external_send_note,
    hosted_invoice_url: r.hosted_invoice_url,
    sent_to_customer_at: r.sent_to_customer_at,
    sequence_order: r.sequence_order,
    stripe_invoice_id: r.stripe_invoice_id,
    stripe_invoice_memo: r.stripe_invoice_memo,
    stripe_invoice_footer: r.stripe_invoice_footer,
    stripe_invoice_status: r.stripe_invoice_status,
    agreed_write_down_at: r.agreed_write_down_at,
    agreed_write_down_by: r.agreed_write_down_by,
    agreed_write_down_note: r.agreed_write_down_note,
    agreed_write_down_previous_amount: r.agreed_write_down_previous_amount,
    agreed_write_down_stripe_credit_note_id: r.agreed_write_down_stripe_credit_note_id,
    is_primary_rtb_bundle: r.is_primary_rtb_bundle,
    hcp_number: jl?.hcp_number ?? '',
    job_name: jl?.job_name ?? '',
    job_address: jl?.job_address ?? '',
    google_drive_link: jl?.google_drive_link ?? null,
    job_plans_link: jl?.job_plans_link ?? null,
    master_user_id: jl?.master_user_id ?? '',
    customer_id: jl?.customer_id ?? null,
    customer_name: jl?.customer_name ?? null,
    customer_email: jl?.customer_email ?? null,
    customer_phone: jl?.customer_phone ?? null,
    last_work_date: jl?.last_work_date ?? null,
    open_since_at: jl?.created_at ?? r.created_at,
    invoice_payments: paymentsByInvoiceId.get(r.id) ?? [],
  }
}

function dashboardBilledInvoiceAmounts(inv: InvoiceForDashboard): { applied: number; open: number } {
  const applied = inv.invoice_payments.reduce((s, p) => s + Number(p.amount ?? 0), 0)
  return { applied, open: Math.max(0, Number(inv.amount ?? 0) - applied) }
}

function dashboardInvoiceToPaymentModal(inv: InvoiceForDashboard): InvoiceWithJobLike {
  const {
    hcp_number,
    job_name,
    job_address,
    google_drive_link,
    job_plans_link,
    master_user_id,
    customer_id,
    customer_name,
    customer_email,
    open_since_at: _openSince,
    invoice_payments: _invPay,
    ...invoiceRow
  } = inv
  return {
    ...invoiceRow,
    job: {
      id: inv.job_id,
      hcp_number,
      job_name,
      revenue: null,
      payments_made: null,
    },
  }
}

function jobBillingFromDashboardInvoice(inv: InvoiceForDashboard): JobBillingContext {
  return {
    id: inv.job_id,
    master_user_id: inv.master_user_id,
    hcp_number: inv.hcp_number,
    job_name: inv.job_name,
    customer_id: inv.customer_id,
    customer_name: inv.customer_name,
    customer_email: inv.customer_email,
    job_address: inv.job_address,
    customer_phone: inv.customer_phone,
    last_work_date: inv.last_work_date,
  }
}

type JobForDashboard = {
  id: string
  hcp_number: string
  job_name: string
  job_address: string
  revenue: number | null
  payments_made: number | null
  google_drive_link: string | null
  job_plans_link: string | null
  created_at: string | null
  customer_id: string | null
}

function dashboardJobHasCustomerForBilling(customerId: string | null | undefined): boolean {
  return customerId != null && String(customerId).trim().length > 0
}

/** `readyToBillInvoices` is already limited to status ready_to_bill. */
function countDashboardRtbDraftsForJob(jobId: string, readyToBillInvoices: InvoiceForDashboard[]): number {
  let n = 0
  for (const inv of readyToBillInvoices) {
    if (inv.job_id === jobId) n += 1
  }
  return n
}

type ReadyToBillDashboardUnit = ReadyToBillDashboardUnitBase<JobForDashboard, InvoiceForDashboard>

type BilledWaitingDashboardUnit =
  | { kind: 'job'; job: JobForDashboard }
  | { kind: 'job_bundle'; job: JobForDashboard; inv: InvoiceForDashboard }
  | { kind: 'invoice'; inv: InvoiceForDashboard }

/** Dedupes billed job + invoice rows: one merged row when exactly one billed invoice on the job. */
function buildBilledWaitingDashboardUnits(jobs: JobForDashboard[], invoices: InvoiceForDashboard[]): BilledWaitingDashboardUnit[] {
  const byJob = new Map<string, InvoiceForDashboard[]>()
  for (const inv of invoices) {
    const list = byJob.get(inv.job_id) ?? []
    list.push(inv)
    byJob.set(inv.job_id, list)
  }
  const bundledIds = new Set<string>()
  const out: BilledWaitingDashboardUnit[] = []
  for (const job of jobs) {
    const billedOnJob = byJob.get(job.id) ?? []
    if (billedOnJob.length === 1) {
      const inv = billedOnJob[0]!
      bundledIds.add(inv.id)
      out.push({ kind: 'job_bundle', job, inv })
    } else if (billedOnJob.length === 0) {
      out.push({ kind: 'job', job })
    }
  }
  for (const inv of invoices) {
    if (!bundledIds.has(inv.id)) out.push({ kind: 'invoice', inv })
  }
  return out
}

/** Dashboard Assigned Jobs + team Ready to Bill rows from list_*_for_dashboard RPCs. */
type DashboardTeamAssignedJobRow = {
  id: string
  hcp_number: string
  job_name: string
  job_address: string
  google_drive_link: string | null
  job_plans_link: string | null
  job_pictures_link?: string | null
  revenue: number | null
  created_at: string | null
  last_report_at?: string | null
  /** Latest `reports.created_at` authored by viewer (Dashboard Leave Report nag; 12h silence). */
  my_last_report_at?: string | null
  /** Max of latest thread note, field report, qualifying clock session, and schedule block (Dashboard "Last activity"). */
  last_job_activity_at?: string | null
  last_thread_note_at?: string | null
  last_clock_activity_at?: string | null
  last_schedule_activity_at?: string | null
  in_progress_stage_name?: string | null
  project_id?: string | null
  in_progress_step_id?: string | null
  collect_payment_button_variant?: string | null
  status?: string | null
}

function DashboardLeaveReportButton(props: {
  showReminder: boolean
  onClick: MouseEventHandler<HTMLButtonElement>
  buttonTitle?: string
}) {
  const { showReminder, onClick, buttonTitle } = props
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <button
          type="button"
          onClick={onClick}
          title={buttonTitle}
          style={{
            padding: '0.35rem 0.75rem',
            fontSize: '0.875rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Leave<br />Report
        </button>
        {showReminder ? (
          <span
            role="status"
            aria-label="Scheduled work ended — leave a job report."
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'inline-flex',
              pointerEvents: 'none',
            }}
          >
            {/* Icon: Font Awesome Free 7.x — circle exclamation (OFL/CC-BY) */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 640 640"
              width={21}
              height={21}
              aria-hidden
              focusable={false}
              style={{ color: '#FFE600' }}
            >
              <path
                fill="currentColor"
                d="M320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576zM320 384C302.3 384 288 398.3 288 416C288 433.7 302.3 448 320 448C337.7 448 352 433.7 352 416C352 398.3 337.7 384 320 384zM320 192C301.8 192 287.3 207.5 288.6 225.7L296 329.7C296.9 342.3 307.4 352 319.9 352C332.5 352 342.9 342.3 343.8 329.7L351.2 225.7C352.5 207.5 338.1 192 319.8 192z"
              />
            </svg>
          </span>
        ) : null}
      </span>
    </span>
  )
}

function subcontractorAssignedJobStageDisplay(
  j: Pick<DashboardTeamAssignedJobRow, 'in_progress_stage_name' | 'project_id'>,
): { line: string; title: string | undefined } | null {
  const name = j.in_progress_stage_name?.trim()
  if (name) {
    return { line: `Stage: ${name}`, title: undefined }
  }
  if (j.project_id) {
    return {
      line: 'Stage: —',
      title: 'No step is currently in progress for this project',
    }
  }
  return null
}

function DashboardJobPicturesLinkRow({
  jobPicturesLink,
  layout = 'stacked',
  onMissingClick,
  size = 'default',
}: {
  jobPicturesLink: string | null | undefined
  layout?: 'stacked' | 'inline'
  onMissingClick?: () => void
  /** `large` matches the My Schedule Leave Report button height. */
  size?: 'default' | 'large'
}) {
  const url = jobPicturesLink?.trim()
  const glyphSize = size === 'large' ? '2.5em' : '1.25em'
  const glyph = (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={glyphSize} height={glyphSize} fill="currentColor" aria-hidden="true">
      <path d="M128 160C128 124.7 156.7 96 192 96L512 96C547.3 96 576 124.7 576 160L576 416C576 451.3 547.3 480 512 480L192 480C156.7 480 128 451.3 128 416L128 160zM56 192C69.3 192 80 202.7 80 216L80 512C80 520.8 87.2 528 96 528L456 528C469.3 528 480 538.7 480 552C480 565.3 469.3 576 456 576L96 576C60.7 576 32 547.3 32 512L32 216C32 202.7 42.7 192 56 192zM224 224C241.7 224 256 209.7 256 192C256 174.3 241.7 160 224 160C206.3 160 192 174.3 192 192C192 209.7 206.3 224 224 224zM420.5 235.5C416.1 228.4 408.4 224 400 224C391.6 224 383.9 228.4 379.5 235.5L323.2 327.6L298.7 297C294.1 291.3 287.3 288 280 288C272.7 288 265.8 291.3 261.3 297L197.3 377C191.5 384.2 190.4 394.1 194.4 402.4C198.4 410.7 206.8 416 216 416L488 416C496.7 416 504.7 411.3 508.9 403.7C513.1 396.1 513 386.9 508.4 379.4L420.4 235.4z" />
    </svg>
  )
  if (url) {
    const link = (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open customer pictures"
        aria-label="Open customer pictures"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          openInExternalBrowser(url)
        }}
        style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-blue-500)', textDecoration: 'none' }}
      >
        {/* Font Awesome Free 7.x — images (OFL) */}
        {glyph}
      </a>
    )
    if (layout === 'inline') return link
    return <div style={{ marginTop: 6 }}>{link}</div>
  }
  if (onMissingClick) {
    const missingBtn = (
      <button
        type="button"
        title="No customer photos link — tap to ask Dispatch to set one"
        aria-label="No customer photos link — tap to ask Dispatch to set one"
        onClick={(e) => {
          e.stopPropagation()
          onMissingClick()
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--text-red-600)',
        }}
      >
        {glyph}
      </button>
    )
    if (layout === 'inline') return missingBtn
    return <div style={{ marginTop: 6 }}>{missingBtn}</div>
  }
  return null
}

function isDashboardTeamReadyToBillRole(role: string | null | undefined): boolean {
  return (
    role === 'subcontractor' ||
    role === 'helpers' ||
    role === 'primary' ||
    role === 'superintendent' ||
    role === 'estimator'
  )
}

type Step = Database['public']['Tables']['project_workflow_steps']['Row']
type AssignedStep = Step & {
  project_id: string
  project_name: string
  project_address: string | null
  project_plans_link: string | null
  project_superintendent_names: string | null
  workflow_id: string
}

function formatDatetime(iso: string | null): string {
  if (!iso) return 'unknown'
  const date = new Date(iso)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const dateTime = date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  return `${weekday}, ${dateTime}`
}

function subcontractorLastActivityTimeMs(iso: string | null | undefined): number | null {
  const t = (iso ?? '').trim()
  if (!t) return null
  const ms = new Date(t).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** Which source(s) share the same instant as `last_job_activity_at` (ms tie → comma-joined labels). */
function subcontractorLastActivityTypeLine(
  j: Pick<
    DashboardTeamAssignedJobRow,
    | 'last_job_activity_at'
    | 'last_thread_note_at'
    | 'last_report_at'
    | 'last_clock_activity_at'
    | 'last_schedule_activity_at'
  >,
): string {
  const activity = (j.last_job_activity_at ?? '').trim()
  if (!activity) return 'Activity'
  const winMs = new Date(activity).getTime()
  if (Number.isNaN(winMs)) return 'Activity'

  const sources: { key: SubcontractorActivitySource; ms: number | null }[] = [
    { key: 'thread_note', ms: subcontractorLastActivityTimeMs(j.last_thread_note_at) },
    { key: 'field_report', ms: subcontractorLastActivityTimeMs(j.last_report_at) },
    { key: 'clock', ms: subcontractorLastActivityTimeMs(j.last_clock_activity_at) },
    { key: 'schedule', ms: subcontractorLastActivityTimeMs(j.last_schedule_activity_at) },
  ]
  const winners = new Set(sources.filter((s) => s.ms != null && s.ms === winMs).map((s) => s.key))
  if (winners.size === 0) return 'Activity'
  return SUBCONTRACTOR_ACTIVITY_SOURCE_ORDER.filter((k) => winners.has(k))
    .map((k) => subcontractorActivitySourceLabel[k])
    .join(', ')
}

type SubcontractorLastActivityLines = { title: string; line1: string; line2: string; line3?: string }

function subcontractorLastActivityBlock(
  j: Pick<
    DashboardTeamAssignedJobRow,
    | 'last_job_activity_at'
    | 'last_thread_note_at'
    | 'last_report_at'
    | 'last_clock_activity_at'
    | 'last_schedule_activity_at'
  >,
): SubcontractorLastActivityLines {
  const activity = (j.last_job_activity_at ?? '').trim()
  if (!activity) {
    return {
      title: 'No thread notes, field reports, work sessions, or schedule activity on this job yet',
      line1: 'Last activity:',
      line2: 'No activity yet',
    }
  }
  const rel = formatTimeSince(activity)
  const relLine = rel === 'just now' ? 'Just now' : `${rel} ago`
  return {
    title: `Latest activity: ${formatDatetime(activity)}`,
    line1: 'Last activity:',
    line2: relLine,
    line3: subcontractorLastActivityTypeLine(j),
  }
}

function daysOpen(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || endedAt) return null
  const start = new Date(startedAt)
  const end = new Date()
  const result = Math.floor((end.getTime() - start.getTime()) / 86400000)
  return result < 0 ? null : result
}

function personDisplay(name: string | null, userNames: Set<string>): string {
  if (!name || !name.trim()) {
    return 'Assigned to: unknown'
  }
  const trimmedName = name.trim()
  const isUser = userNames.has(trimmedName.toLowerCase())
  return isUser ? trimmedName : `${trimmedName} (not a user)`
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDaysUntilDue(scheduledDateStr: string): number {
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const parts = scheduledDateStr.split('-').map(Number)
  const scheduled = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1)
  return Math.round((scheduled.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000))
}

function formatTDays(diff: number): string {
  if (diff >= 0) return `T-${diff}`
  return `T+${Math.abs(diff)}`
}

type ChecklistInstance = {
  id: string
  checklist_item_id: string
  scheduled_date: string
  completed_at: string | null
  notes: string | null
  completed_by_user_id: string | null
  created_at: string | null
  checklist_items?: {
    title: string
    links?: string[] | null
    notify_on_complete_user_id?: string | null
    notify_creator_on_complete?: boolean
    created_by_user_id?: string | null
  } | null
  checklist_instance_assignees?: Array<{ user_id: string }>
}

// Paths each role can access (for filtering pinned items). When role is null, treat as primary to prevent flash.
const SUBCONTRACTOR_PATHS = new Set(['/', '/dashboard', '/calendar', '/checklist', '/settings', '/tally'])
const PRIMARY_PATHS = new Set(['/dashboard', '/materials', '/jobs', '/bids', '/calendar', '/checklist', '/settings', '/tally'])
const SUPERINTENDENT_PATHS = new Set(['/dashboard', '/projects', '/workflows', '/jobs', '/bids', '/materials', '/calendar', '/checklist', '/settings', '/tally'])

function getAllowedPathsForRole(role: string | null, estimatorProspectsAccess?: boolean): Set<string> | null {
  if (role === 'subcontractor' || role === 'helpers') return SUBCONTRACTOR_PATHS
  if (role === 'estimator') {
    return new Set([
      '/dashboard',
      '/materials',
      '/bids',
      '/customers',
      ...(estimatorProspectsAccess ? ['/prospects'] : []),
      '/calendar',
      '/checklist',
      '/people',
      '/settings',
      '/tally',
    ])
  }
  if (role === 'primary' || role === null) return PRIMARY_PATHS
  if (role === 'superintendent') return SUPERINTENDENT_PATHS
  return null // dev, master_technician, assistant: no filter (all paths allowed)
}

function filterPinnedByRole(pins: PinnedItem[], role: string | null, estimatorProspectsAccess?: boolean): PinnedItem[] {
  const allowed = getAllowedPathsForRole(role, estimatorProspectsAccess)
  if (!allowed) return pins
  return pins.filter((p) => allowed.has(p.path))
}

/** One row per mirrored linked group (same group, date, window). */
function dedupeSubScheduleBlocks(blocks: JobScheduleBlockRow[]): JobScheduleBlockRow[] {
  const seen = new Set<string>()
  const out: JobScheduleBlockRow[] = []
  for (const b of blocks) {
    const g = b.shared_block_group_id
    const key = g
      ? `g:${g}:${b.work_date}:${b.time_start}:${b.time_end}`
      : `id:${b.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(b)
  }
  return out
}

const HOURS_DAY_CORRECT_BLOCK_TOAST =
  'This day is marked correct in People → Hours. Unmark it there to edit time from the Dashboard.'

function ReadyToBillJobIconToolbar({
  jobId,
  hcpNumber,
  jobName,
  jobAddress,
  jobFormModalAvailable,
  onEditJob,
  onOpenDetail,
}: {
  jobId: string
  hcpNumber: string
  jobName: string
  jobAddress: string
  jobFormModalAvailable: boolean
  onEditJob: (id: string) => void
  onOpenDetail: (a: { jobId: string; hcpNumber: string; jobName: string; jobAddress: string }) => void
}) {
  const safeName = (jobName ?? '').trim() || 'Job'
  const iconBtn: CSSProperties = {
    padding: '0.25rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-700)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => onOpenDetail({ jobId, hcpNumber, jobName, jobAddress })}
        title="Job detail"
        aria-label={`Open job detail for ${safeName}`}
        style={iconBtn}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d="M264 112L376 112C380.4 112 384 115.6 384 120L384 160L256 160L256 120C256 115.6 259.6 112 264 112zM208 120L208 160L128 160C92.7 160 64 188.7 64 224L64 320L576 320L576 224C576 188.7 547.3 160 512 160L432 160L432 120C432 89.1 406.9 64 376 64L264 64C233.1 64 208 89.1 208 120zM576 368L384 368L384 384C384 401.7 369.7 416 352 416L288 416C270.3 416 256 401.7 256 384L256 368L64 368L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 368z" />
        </svg>
      </button>
      {jobFormModalAvailable ? (
        <button type="button" onClick={() => onEditJob(jobId)} title="Edit" aria-label="Edit" style={iconBtn}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const bidPreview = useBidPreview()
  const jobDetailModal = useJobDetailModal()
  const editProjectModal = useEditProjectModal()
  const { user: authUser, role, estimatorProspectsAccess } = useAuth()
  const isDocVisible = useDocumentVisibility()
  const { showToast } = useToastContext()
  const jobFormModal = useJobFormModal()
  const showClockStripScopeToggle =
    role === 'dev' || role === 'master_technician' || role === 'assistant'
  const showStripSubjectMyTimeEditor =
    showClockStripScopeToggle || role === 'superintendent'
  const pendingClockBannerAtMyTeamTop = Boolean(authUser?.id && !showClockStripScopeToggle)
  const [clockStripScope, setClockStripScope] = useState<'team' | 'everyone'>(() =>
    readClockStripScopeFromStorage(role),
  )
  const setClockStripScopePersist = useCallback((next: 'team' | 'everyone') => {
    setClockStripScope(next)
    try {
      localStorage.setItem(DASHBOARD_CLOCK_STRIP_SCOPE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])
  useEffect(() => {
    if (!stripScopeEligible(role)) return
    try {
      if (typeof localStorage === 'undefined') return
      if (localStorage.getItem(DASHBOARD_CLOCK_STRIP_SCOPE_KEY) != null) return
      localStorage.setItem(DASHBOARD_CLOCK_STRIP_SCOPE_KEY, 'everyone')
      setClockStripScope('everyone')
    } catch {
      /* ignore */
    }
  }, [role])
  const orgWideStripEnabled = showClockStripScopeToggle && clockStripScope === 'everyone'
  const myTeam = useDashboardMyTeamSectionState(authUser?.id, { orgWideStripEnabled })
  const reloadMyTeamPendingSilent = useCallback(() => {
    void myTeam.loadPending({ silent: true })
  }, [myTeam.loadPending])
  const applySchedule = useApplyScheduleProportions({
    authUserId: authUser?.id,
    onApplied: reloadMyTeamPendingSilent,
  })
  const goToPendingSessionsInMyTeam = useCallback(() => {
    myTeam.setMyTeamExpanded(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById('dashboard-my-team-pending-sessions')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })
    })
  }, [myTeam.setMyTeamExpanded])
  const sessionsForStrip = useMemo((): DashboardStripSession[] => {
    const isOpen = (s: DashboardStripSession) => s.clocked_out_at == null
    const base =
      showClockStripScopeToggle && clockStripScope === 'everyone'
        ? myTeam.orgWidePendingSessions
        : myTeam.pendingSessions
    const realOpen = base.filter(isOpen) as ClockSessionRow[]
    const merged: DashboardStripSession[] = [...realOpen, ...myTeam.stripSyntheticSalarySessions]
    merged.sort((a, b) => {
      const an = (a.users?.name ?? '').trim() || a.user_id
      const bn = (b.users?.name ?? '').trim() || b.user_id
      const c = an.localeCompare(bn, undefined, { sensitivity: 'base' })
      if (c !== 0) return c
      return a.clocked_in_at.localeCompare(b.clocked_in_at)
    })
    return merged
  }, [
    showClockStripScopeToggle,
    clockStripScope,
    myTeam.orgWidePendingSessions,
    myTeam.pendingSessions,
    myTeam.stripSyntheticSalarySessions,
  ])

  const hoursTodayForStrip = useMemo(() => {
    if (showClockStripScopeToggle && clockStripScope === 'everyone') {
      return myTeam.hoursTodayByUserIdOrg
    }
    return myTeam.hoursTodayByUserId
  }, [showClockStripScopeToggle, clockStripScope, myTeam.hoursTodayByUserIdOrg, myTeam.hoursTodayByUserId])

  const showClockActivityStrip = useMemo(
    () => sessionsForStrip.length > 0 || myTeam.clockedInTodayStripRows.length > 0,
    [sessionsForStrip, myTeam.clockedInTodayStripRows],
  )

  const stripPayGateUserIds = useMemo(() => {
    const ids = new Set<string>()
    if (authUser?.id) ids.add(authUser.id)
    for (const id of myTeam.memberUserIds) ids.add(id)
    for (const s of sessionsForStrip) ids.add(s.user_id)
    for (const r of myTeam.clockedInTodayStripRows) ids.add(r.userId)
    return [...ids]
  }, [authUser?.id, myTeam.memberUserIds, sessionsForStrip, myTeam.clockedInTodayStripRows])

  const [stripSalariedUserIds, setStripSalariedUserIds] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    if (stripPayGateUserIds.length === 0) {
      setStripSalariedUserIds(new Set())
      return
    }
    let cancelled = false
    void fetchSalariedUserIdSetFromUserIds(stripPayGateUserIds).then((set) => {
      if (!cancelled) setStripSalariedUserIds(set)
    })
    return () => {
      cancelled = true
    }
  }, [stripPayGateUserIds])

  const hoursDaysCorrectRange = useMemo(() => {
    const { start: w0, end: w1 } = getDefaultWeekRange()
    const { start: l0, end: l1 } = getLastWeekRange()
    const today = denverCalendarDayKey(Date.now())
    const strip = myTeam.clockStripWorkDateYmd
    const keys = [w0, w1, l0, l1, today, strip]
    const start = keys.reduce((a, b) => (a < b ? a : b))
    const end = keys.reduce((a, b) => (a > b ? a : b))
    return { start, end }
  }, [myTeam.clockStripWorkDateYmd])

  const [hoursDaysCorrectSet, setHoursDaysCorrectSet] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!authUser?.id) return
    let cancelled = false
    void (async () => {
      try {
        const set = await fetchHoursDaysCorrectWorkDates(hoursDaysCorrectRange.start, hoursDaysCorrectRange.end)
        if (!cancelled) setHoursDaysCorrectSet(set)
      } catch {
        if (!cancelled) setHoursDaysCorrectSet(new Set())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, hoursDaysCorrectRange.start, hoursDaysCorrectRange.end])

  const [stripMyTimeEditor, setStripMyTimeEditor] = useState<{
    subjectUserId: string
    displayName: string
    dateStr: string
    showSalariedStripFooter: boolean
    clockTimesReadOnly: boolean
  } | null>(null)
  const openStripMyTimeEditor = useCallback(
    (p: { subjectUserId: string; displayName: string }) => {
      const dateStr = myTeam.clockStripWorkDateYmd
      if (hoursDaysCorrectSet.has(dateStr)) {
        showToast(HOURS_DAY_CORRECT_BLOCK_TOAST, 'warning')
        return
      }
      setStripMyTimeEditor({
        ...p,
        dateStr,
        showSalariedStripFooter: stripSalariedUserIds.has(p.subjectUserId),
        clockTimesReadOnly: !showClockStripScopeToggle,
      })
    },
    [
      hoursDaysCorrectSet,
      myTeam.clockStripWorkDateYmd,
      showClockStripScopeToggle,
      showToast,
      stripSalariedUserIds,
    ],
  )

  useEffect(() => {
    setStripMyTimeEditor((prev) => {
      if (!prev) return prev
      const shouldShow = stripSalariedUserIds.has(prev.subjectUserId)
      if (shouldShow === prev.showSalariedStripFooter) return prev
      return { ...prev, showSalariedStripFooter: shouldShow }
    })
  }, [stripSalariedUserIds])
  const isMobile = useIsMobile()
  const narrowViewport660 = useNarrowViewport660()
  const firstAssistantDispatchPhone = useFirstAssistantDispatchPhone(isSubcontractorLikeRole(role))
  const [subscribedSteps, setSubscribedSteps] = useState<SubscribedStep[]>([])
  const [assignedSteps, setAssignedSteps] = useState<AssignedStep[]>([])
  const [todayChecklist, setTodayChecklist] = useState<ChecklistInstance[]>([])
  const checklistToggleInFlightRef = useRef(new Set<string>())
  const [outstandingItems, setOutstandingItems] = useState<ChecklistInstance[]>([])
  const [outstandingLoading, setOutstandingLoading] = useState(true)
  const outstandingToggleInFlightRef = useRef(new Set<string>())
  const [userError, setUserError] = useState<string | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [checklistLoading, setChecklistLoading] = useState(true)
  const [assignedLoading, setAssignedLoading] = useState(true)
  const [subscribedLoading, setSubscribedLoading] = useState(true)
  const [userNames, setUserNames] = useState<Set<string>>(new Set())
  const [rejectStep, setRejectStep] = useState<{ step: AssignedStep; reason: string } | null>(null)
  const [skipStep, setSkipStep] = useState<{ step: AssignedStep; reason: string } | null>(null)
  const [setStartStep, setSetStartStep] = useState<{ step: AssignedStep; startDateTime: string } | null>(null)
  const [sendTaskUsers, setSendTaskUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [fwdInstance, setFwdInstance] = useState<ChecklistInstance | null>(null)
  const [fwdTitle, setFwdTitle] = useState('')
  const [fwdAssigneeId, setFwdAssigneeId] = useState('')
  const [fwdSaving, setFwdSaving] = useState(false)
  const [muteModalItemId, setMuteModalItemId] = useState<string | null>(null)
  const [muteModalTitle, setMuteModalTitle] = useState('')
  const [pinnedRoutes, setPinnedRoutes] = useState<PinnedItem[]>([])
  const [completedItemsOpen, setCompletedItemsOpen] = useState(false)
  const [completedItems, setCompletedItems] = useState<ChecklistInstance[]>([])
  const [completedItemsLoading, setCompletedItemsLoading] = useState(false)
  const [readInstanceIds, setReadInstanceIds] = useState<Set<string>>(new Set())
  const [ignoredItemIds, setIgnoredItemIds] = useState<Set<string>>(new Set())
  const [ignoredSectionOpen, setIgnoredSectionOpen] = useState(false)
  const [ignoringItemId, setIgnoringItemId] = useState<string | null>(null)
  const [expandedCompleterIds, setExpandedCompleterIds] = useState<Set<string>>(new Set())
  const [markingReadId, setMarkingReadId] = useState<string | null>(null)
  const [markingUnreadId, setMarkingUnreadId] = useState<string | null>(null)
  const [completedItemsUserMap, setCompletedItemsUserMap] = useState<Map<string, string>>(new Map())
  const [recentReports, setRecentReports] = useState<Array<{ id: string; template_name: string; job_display_name: string; created_at: string; created_by_name: string; field_values?: Record<string, string>; reported_at_lat?: number | null; reported_at_lng?: number | null }>>([])
  const [recentReportsLoading, setRecentReportsLoading] = useState(false)
  const [isReportEnabledOnlyUser, setIsReportEnabledOnlyUser] = useState(false)
  const [newReportModalOpen, setNewReportModalOpen] = useState(false)
  const [readReportIds, setReadReportIds] = useState<Set<string>>(new Set())
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null)
  const [hiddenReportIds, setHiddenReportIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(HIDE_ON_REFRESH_STORAGE_KEY)
      if (!raw) return new Set()
      const ids = JSON.parse(raw) as string[]
      if (!Array.isArray(ids)) return new Set()
      localStorage.removeItem(HIDE_ON_REFRESH_STORAGE_KEY)
      return new Set(ids)
    } catch {
      return new Set()
    }
  })
  const [hideOnRefreshPending, setHideOnRefreshPending] = useState(true)
  const [editReportModalOpen, setEditReportModalOpen] = useState(false)
  const [reportForEdit, setReportForEdit] = useState<ReportForEdit | null>(null)
  const [recentReportsExpanded, setRecentReportsExpanded] = useState(false)
  const [recentReportsView, setRecentReportsView] = useState<'unread' | 'all'>('unread')
  const [readyToBillExpanded, setReadyToBillExpanded] = useState(true)
  const [waitingForPaymentExpanded, setWaitingForPaymentExpanded] = useState(false)
  const [assignedJobs, setAssignedJobs] = useState<DashboardTeamAssignedJobRow[]>([])
  const [assignedJobsLoading, setAssignedJobsLoading] = useState(false)
  const [assignedReadyToBillJobs, setAssignedReadyToBillJobs] = useState<DashboardTeamAssignedJobRow[]>([])
  const [assignedReadyToBillLoading, setAssignedReadyToBillLoading] = useState(false)
  const [assignedReadyToBillExpanded, setAssignedReadyToBillExpanded] = useState(true)
  const [superintendentJobs, setSuperintendentJobs] = useState<DashboardTeamAssignedJobRow[]>([])
  const [superintendentJobsLoading, setSuperintendentJobsLoading] = useState(false)
  const [superintendentJobsExpanded, setSuperintendentJobsExpanded] = useState(true)
  const [assignedJobsExpanded, setAssignedJobsExpanded] = useState(true)
  const [assignedStagesExpanded, setAssignedStagesExpanded] = useState(true)
  const [assignedStagesCompleteExpanded, setAssignedStagesCompleteExpanded] = useState(false)
  const [subscribedStagesExpanded, setSubscribedStagesExpanded] = useState(true)
  /** One-time expand/collapse heuristic after initial assigned roster load — do not overwrite user toggle on refresh. */
  const assignedStagesExpandedDefaultAppliedRef = useRef(false)
  const [subScheduleRows, setSubScheduleRows] = useState<JobScheduleBlockRow[]>([])
  const [subScheduleLoading, setSubScheduleLoading] = useState(false)
  const [subScheduleLabels, setSubScheduleLabels] = useState<Map<string, string>>(() => new Map())
  const [subSchedulePhones, setSubSchedulePhones] = useState<Map<string, string | null>>(() => new Map())
  const [scheduleReminderNow, setScheduleReminderNow] = useState(() => new Date())
  const [readyToBillInvoices, setReadyToBillInvoices] = useState<InvoiceForDashboard[]>([])
  const [readyToBillJobs, setReadyToBillJobs] = useState<JobForDashboard[]>([])
  const [readyToBillLoading, setReadyToBillLoading] = useState(false)
  const readyToBillDashboardUnits = useMemo<ReadyToBillDashboardUnit[]>(
    () => buildReadyToBillDashboardUnits(readyToBillJobs, readyToBillInvoices),
    [readyToBillJobs, readyToBillInvoices],
  )
  const [waitingForPaymentInvoices, setWaitingForPaymentInvoices] = useState<InvoiceForDashboard[]>([])
  const [waitingForPaymentJobs, setWaitingForPaymentJobs] = useState<JobForDashboard[]>([])
  const [waitingForPaymentLoading, setWaitingForPaymentLoading] = useState(false)
  const billedWaitingDashboardUnits = useMemo(
    () => buildBilledWaitingDashboardUnits(waitingForPaymentJobs, waitingForPaymentInvoices),
    [waitingForPaymentJobs, waitingForPaymentInvoices],
  )
  const fieldQueueCombinedBillInvoices = useMemo(
    () => [...readyToBillInvoices, ...waitingForPaymentInvoices],
    [readyToBillInvoices, waitingForPaymentInvoices],
  )
  const shouldShowPrepareBillForFieldQueue = useCallback(
    (jobId: string) => {
      const resolved = resolveReadyToBillBillCustomerTarget(jobId, readyToBillDashboardUnits)
      if (resolved.mode !== 'job') return true
      const job = readyToBillJobs.find((j) => j.id === jobId) ?? null
      if (wouldEnsureNothingLeftToBillForJob(jobId, job, fieldQueueCombinedBillInvoices)) {
        return false
      }
      return true
    },
    [readyToBillDashboardUnits, readyToBillJobs, fieldQueueCombinedBillInvoices],
  )
  const [invoiceStatusUpdatingId, setInvoiceStatusUpdatingId] = useState<string | null>(null)
  const [jobStatusUpdatingId, setJobStatusUpdatingId] = useState<string | null>(null)
  const dashboardInvoiceMutationLockRef = useRef<string | null>(null)
  const dashboardJobStatusMutationLockRef = useRef<string | null>(null)
  /** Set after `refreshInvoices` is defined; reloads dashboard job lists on `update_job_status` RPC failure. */
  const resyncDashboardAfterUpdateJobStatusFailureRef = useRef<() => Promise<void>>(async () => {})
  const dashboardInvoiceSendBackConfirmLockRef = useRef(false)
  const [viewReportsJob, setViewReportsJob] = useState<{ id: string; hcpNumber: string; jobName: string; jobAddress: string } | null>(null)
  const [subcontractorJobActivityModalJob, setSubcontractorJobActivityModalJob] = useState<{
    id: string
    hcpNumber: string
    jobName: string
  } | null>(null)
  const [leaveReportJob, setLeaveReportJob] = useState<{ id: string; hcpNumber: string; jobName: string; jobAddress: string } | null>(null)
  const [turnawayJob, setTurnawayJob] = useState<{ id: string; hcpNumber: string; jobName: string; jobAddress: string } | null>(null)
  const [jobModeEnabled] = useJobModeEnabled(authUser?.id ?? null)
  // Component-local "show full dashboard" override; resets every page load so
  // the field-first paint is consistent. The Job Mode toggle in the gear menu
  // remains the persistent setting.
  const [jobModeShowFullDashboard, setJobModeShowFullDashboard] = useState(false)
  const [collectPaymentJob, setCollectPaymentJob] = useState<{
    id: string
    hcpNumber: string
    jobName: string
    buttonVariant?: string | null
  } | null>(null)
  const [viewBillDetailsJob, setViewBillDetailsJob] = useState<{ id: string; hcpNumber: string; jobName: string; jobAddress: string; revenue: number | null } | null>(null)
  const [dashboardButtonVisibility, setDashboardButtonVisibility] = useState<Record<string, boolean> | null>(null)
  const [quickButtonsPlacement, setQuickButtonsPlacement] = useState<'top' | 'with_pins'>('with_pins')
  const [readyForBillingJob, setReadyForBillingJob] = useState<{ id: string; hcpNumber: string; jobName: string } | null>(null)
  const [readyForBillingChecked1, setReadyForBillingChecked1] = useState(false)
  const [readyForBillingChecked2, setReadyForBillingChecked2] = useState(false)
  const [sendRecordJobMeta, setSendRecordJobMeta] = useState<{ id: string } | null>(null)
  const [markPaidJob, setMarkPaidJob] = useState<JobForDashboard | null>(null)
  const [markPaidInvoice, setMarkPaidInvoice] = useState<InvoiceForDashboard | null>(null)
  const [sendBackJob, setSendBackJob] = useState<{
    id: string
    hcpNumber: string
    jobName: string
    toStatus: 'working' | 'ready_to_bill'
    rtbDraftCount: number
  } | null>(null)
  const [sendBackInvoice, setSendBackInvoice] = useState<{ inv: InvoiceForDashboard; action: 'delete' | 'revert' } | null>(null)
  const [sendBackInvoiceStripeExplainerAfterFailure, setSendBackInvoiceStripeExplainerAfterFailure] = useState(false)
  const [sendBackChecked, setSendBackChecked] = useState(false)
  const [sendBackStatusEventLine, setSendBackStatusEventLine] = useState<string | null>(null)
  const sendBackCollectPaymentNotice = useSendBackCollectPaymentFlowNotice(sendBackJob)
  const [upcomingInspections, setUpcomingInspections] = useState<Array<{ id: string; address: string; inspection_type: string; scheduled_date: string }>>([])
  const [upcomingInspectionsLoading, setUpcomingInspectionsLoading] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const clockDisplayName = useMemo(
    () => userName ?? displayNameFromAuthUser(authUser),
    [userName, authUser],
  )
  const [dashboardSelfIsSalary, setDashboardSelfIsSalary] = useState(false)
  /** Same rule as ClockInOutButton salaryUiActive: pay is_salary plus salary_work_schedule_templates row. */
  const [dashboardSalaryScheduleClockActive, setDashboardSalaryScheduleClockActive] = useState(false)
  useEffect(() => {
    const name = clockDisplayName?.trim()
    if (!name) {
      setDashboardSelfIsSalary(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const row = await withSupabaseRetry(
          async () =>
            supabase.from('people_pay_config').select('is_salary').eq('person_name', name).maybeSingle(),
          'dashboard self people_pay_config is_salary',
        )
        if (!cancelled) setDashboardSelfIsSalary(!!(row as { is_salary?: boolean } | null)?.is_salary)
      } catch {
        if (!cancelled) setDashboardSelfIsSalary(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clockDisplayName])
  useEffect(() => {
    const name = clockDisplayName?.trim()
    const uid = authUser?.id
    if (!name || !uid) {
      setDashboardSalaryScheduleClockActive(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [pay, tmpl] = await Promise.all([
          withSupabaseRetry(
            async () =>
              supabase.from('people_pay_config').select('is_salary').eq('person_name', name).maybeSingle(),
            'dashboard salary schedule people_pay_config is_salary',
          ),
          withSupabaseRetry(
            async () =>
              supabase.from('salary_work_schedule_templates').select('user_id').eq('user_id', uid).maybeSingle(),
            'dashboard salary_work_schedule_templates for user',
          ),
        ])
        if (cancelled) return
        const sal = !!(pay as { is_salary?: boolean } | null)?.is_salary
        setDashboardSalaryScheduleClockActive(sal && !!tmpl)
      } catch {
        if (!cancelled) setDashboardSalaryScheduleClockActive(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clockDisplayName, authUser?.id])
  const openMyTimePreviewFromClock = useCallback(() => {
    if (!authUser?.id) return
    const dateStr = denverCalendarDayKey(Date.now())
    if (hoursDaysCorrectSet.has(dateStr)) {
      showToast(HOURS_DAY_CORRECT_BLOCK_TOAST, 'warning')
      return
    }
    setStripMyTimeEditor({
      subjectUserId: authUser.id,
      displayName: clockDisplayName?.trim() || 'You',
      dateStr,
      showSalariedStripFooter: stripSalariedUserIds.has(authUser.id),
      clockTimesReadOnly: true,
    })
  }, [authUser?.id, clockDisplayName, hoursDaysCorrectSet, showToast, stripSalariedUserIds])
  const [teamFeedbackHomeEnabled, setTeamFeedbackHomeEnabled] = useState(false)
  const [teamFeedbackWizardOpen, setTeamFeedbackWizardOpen] = useState(false)
  const [contractSigningPromptOpen, setContractSigningPromptOpen] = useState(false)
  const [contractSigningPromptRows, setContractSigningPromptRows] = useState<
    Array<{ id: string; document_name: string; status: string }>
  >([])
  const [contractSigningPromptOpeningId, setContractSigningPromptOpeningId] = useState<string | null>(null)
  /** Guards salary visit-time RPC so React Strict Mode double-mount does not open the modal twice. */
  const contractSigningVisitPromptEpochRef = useRef(0)

  const fetchContractDashboardPromptRows = useCallback(async () => {
    return (await withSupabaseRetry(
      () => supabase.rpc('list_my_contract_dashboard_prompts'),
      'list_my_contract_dashboard_prompts',
    )) as Array<{ id: string; document_name: string; status: string }>
  }, [])

  const runContractSigningPromptFromRpc = useCallback(async () => {
    try {
      const rows = await fetchContractDashboardPromptRows()
      if (rows.length > 0) {
        setContractSigningPromptRows(rows)
        setContractSigningPromptOpen(true)
      }
    } catch {
      /* ignore — do not block clock-in on RPC failure */
    }
  }, [fetchContractDashboardPromptRows])

  const handleClockInSuccessContractPrompt = useCallback(async () => {
    if (!authUser?.id) return
    await runContractSigningPromptFromRpc()
  }, [authUser?.id, runContractSigningPromptFromRpc])

  useEffect(() => {
    if (!authUser?.id || !dashboardSalaryScheduleClockActive) return
    contractSigningVisitPromptEpochRef.current += 1
    const epoch = contractSigningVisitPromptEpochRef.current
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchContractDashboardPromptRows()
        if (cancelled || epoch !== contractSigningVisitPromptEpochRef.current) return
        if (rows.length > 0) {
          setContractSigningPromptRows(rows)
          setContractSigningPromptOpen(true)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, dashboardSalaryScheduleClockActive, fetchContractDashboardPromptRows])

  const [dispatchRequestsOpen, setDispatchRequestsOpen] = useState(true)
  const [dispatchDismissedModalOpen, setDispatchDismissedModalOpen] = useState(false)
  const [tripChargeTarget, setTripChargeTarget] = useState<CreateTripChargeTarget | null>(null)

  const [estimatorInboxEligible, setEstimatorInboxEligible] = useState(false)
  const [estimatorRequestsOpen, setEstimatorRequestsOpen] = useState(true)
  const [estimatorRequests, setEstimatorRequests] = useState<EstimatorInboxRow[]>([])
  const [estimatorRequestsLoading, setEstimatorRequestsLoading] = useState(false)
  const [estimatorRequestDismissingId, setEstimatorRequestDismissingId] = useState<string | null>(null)
  const [expandedEstimatorRequestId, setExpandedEstimatorRequestId] = useState<string | null>(null)
  const [estimatorThreadNotesByRequestId, setEstimatorThreadNotesByRequestId] = useState<
    Record<string, EstimatorThreadNoteRow[]>
  >({})
  const [estimatorNotesLoadingRequestId, setEstimatorNotesLoadingRequestId] = useState<string | null>(null)
  const [estimatorNoteSubmitRequestId, setEstimatorNoteSubmitRequestId] = useState<string | null>(null)
  const [estimatorNoteDraft, setEstimatorNoteDraft] = useState('')
  const expandedEstimatorRequestIdRef = useRef<string | null>(null)

  type MyBidOthersBidItem = {
    id: string
    text: string | null
    createdAt: string
    occurredAt?: string | null
    contactMethod?: string | null
    authorLabel?: string
  }
  type MyBidOthersCustomerItem = {
    id: string
    text: string | null
    createdAt: string
    contactDate?: string
    contactMethod?: string | null
    authorLabel?: string
  }
  type MyBidRow = {
    id: string
    project_name: string | null
    bid_due_date: string | null
    bid_date_sent: string | null
    outcome: string | null
    service_type_name: string
    /** Current user's relationship to this bid on Dashboard My Bids. */
    myBidRoles: 'estimator' | 'account_manager' | 'both'
    unreadBidNotes: boolean
    unreadCustomerNotes: boolean
    othersBidUpdates: MyBidOthersBidItem[]
    othersCustomerUpdates: MyBidOthersCustomerItem[]
  }
  const [myBids, setMyBids] = useState<MyBidRow[]>([])
  const [myBidsLoading, setMyBidsLoading] = useState(false)
  const [lostMissingLossReasonCount, setLostMissingLossReasonCount] = useState(0)
  const [lostMissingLossReasonLoading, setLostMissingLossReasonLoading] = useState(true)
  const [hiddenBidIds, setHiddenBidIds] = useState<Set<string>>(new Set())
  const [hiddenBidsExpanded, setHiddenBidsExpanded] = useState(false)
  const [sentBidsExpanded, setSentBidsExpanded] = useState(false)
  const myBidsPrimaryCollapseAppliedRef = useRef(false)
  const [myBidsSectionExpanded, setMyBidsSectionExpanded] = useState(role === 'primary' ? false : true)
  const [myBidOthersVisibleLimits, setMyBidOthersVisibleLimits] = useState<
    Record<string, { bid: number; customer: number }>
  >({})
  const [myBidOthersNoteDetailsOpen, setMyBidOthersNoteDetailsOpen] = useState<Set<string>>(() => new Set())

  const toggleMyBidOthersNoteDetails = useCallback((key: string, open: boolean) => {
    setMyBidOthersNoteDetailsOpen((prev) => {
      const next = new Set(prev)
      if (open) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const myBidsVisibleCount = useMemo(
    () => myBids.reduce((acc, b) => acc + (hiddenBidIds.has(b.id) ? 0 : 1), 0),
    [myBids, hiddenBidIds],
  )

  useEffect(() => {
    if (role !== 'primary' || myBidsPrimaryCollapseAppliedRef.current) return
    setMyBidsSectionExpanded(false)
    myBidsPrimaryCollapseAppliedRef.current = true
  }, [role])

  const isDev = role === 'dev'
  const {
    dispatchInboxEligible,
    dispatchRequests,
    dispatchRequestsLoading,
    dispatchRequestDismissingId,
    expandedDispatchRequestId,
    dispatchThreadNotesByRequestId,
    dispatchNotesLoadingRequestId,
    dispatchNoteSubmitRequestId,
    dispatchNoteDraft,
    setDispatchNoteDraft,
    toggleExpandDispatchRequest,
    submitDispatchNote,
    submitDispatchNoteAndClose,
    dismissDispatchRequest,
    fetchDismissedDispatchInboxRows,
  } = useDispatchInbox()
  const billCustomer = useBillCustomerModal()
  const materializeSalarySessionForStrip = useCallback(
    async (userId: string) => {
      const { error } = await syncSalaryClockSessionsForUserDay(userId)
      if (error) {
        showToast(error, 'error')
        return
      }
      await myTeam.loadPending({ silent: true })
    },
    [showToast, myTeam.loadPending],
  )
  const handleStripMarkNotComingIn = useCallback(
    async (p: { subjectUserId: string; displayName: string; workDateYmd: string }) => {
      const result = await recordNotComingInForUserAsStaff({
        subjectUserId: p.subjectUserId,
        workDateYmd: p.workDateYmd,
      })
      if (result.ok && result.alreadyMarked) {
        showToast(`${p.displayName} already has unpaid time off on ${p.workDateYmd}.`, 'warning')
        return
      }
      if (!result.ok) {
        showToast(result.message, 'error')
        return
      }
      showToast(`Marked ${p.displayName} as not coming in (${p.workDateYmd}).`, 'success')
      if (result.syncWarning) {
        showToast(`Salary sync: ${result.syncWarning}`, 'warning')
      }
      void myTeam.loadPending({ silent: true })
    },
    [showToast, myTeam.loadPending],
  )
  const visiblePins = filterPinnedByRole(pinnedRoutes, role, estimatorProspectsAccess)
  const pinsToShow = visiblePins
    .filter((p) => p.path !== '/dashboard' && p.path !== '/')
    .filter((p) => !(p.path === '/materials' && p.tab === 'external-team'))
  const hasCostMatrixPin = visiblePins.some((p) => p.path === '/people' && p.tab === 'hours')
  const hasBilledPin = visiblePins.some((p) => p.path === '/jobs' && p.tab === 'billed')
  const hasSupplyHousesAPPin = visiblePins.some((p) => p.path === '/materials' && p.tab === 'supply-houses')
  const hasSubLaborDuePin = visiblePins.some((p) => p.path === '/jobs' && p.tab === 'sub_sheet_ledger')
  const [financialRefreshKey, setFinancialRefreshKey] = useState(0)
  /** Coalesce WAL bursts from financial-pin tables into one REST refresh (see dashboard-financial-pins channel). */
  const FINANCIAL_PINS_REALTIME_DEBOUNCE_MS = 1200
  const financialPinsRealtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleFinancialPinsRefreshFromRealtime = useCallback(() => {
    if (!isDocVisible) return
    if (financialPinsRealtimeTimerRef.current) clearTimeout(financialPinsRealtimeTimerRef.current)
    financialPinsRealtimeTimerRef.current = setTimeout(() => {
      financialPinsRealtimeTimerRef.current = null
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      setFinancialRefreshKey((k) => k + 1)
    }, FINANCIAL_PINS_REALTIME_DEBOUNCE_MS)
  }, [isDocVisible])
  const [tallyUnlinkedCount, setTallyUnlinkedCount] = useState<number | null>(null)
  const [tallyStaleUnlinkedCount, setTallyStaleUnlinkedCount] = useState<number | null>(null)
  const [tallyStaffFollowUpModalOpen, setTallyStaffFollowUpModalOpen] = useState(false)
  const {
    peopleCount: tallyStaffStalePeopleCount,
    transactionCount: tallyStaffStaleTxCount,
    refetch: refetchStaleTallyStaffFollowUp,
  } = useStaleTallyStaffFollowUp(TALLY_STALE_MIN_AGE_DAYS)
  const { total: costMatrixTotal } = useCostMatrixTotal(hasCostMatrixPin)
  const { count: billedCount, total: billedTotal } = useBilledTotal(hasBilledPin, financialRefreshKey)
  const { count: hoursAwaitingCount } = useHoursAwaitingApprovalCount(isDev, financialRefreshKey)
  const { total: supplyHousesAPTotal } = useSupplyHousesAPTotal(hasSupplyHousesAPPin, financialRefreshKey)
  const { total: subLaborDueTotal } = useSubLaborDueTotal(hasSubLaborDuePin, financialRefreshKey)

  const arBankCountEnabled = Boolean(authUser?.id) && canRoleSeeArBankUnallocatedDashboardBanner(role)
  const { count: arBankUnallocatedCount } = useArBankUnallocatedCount({
    enabled: arBankCountEnabled,
    authUserId: authUser?.id,
    authRole: role,
  })

  const loadTallyUnlinkedCount = useCallback(async () => {
    if (!authUser?.id || role == null) return
    try {
      const n = await withSupabaseRetry(
        async () => await supabase.rpc('count_unlinked_mercury_transactions_for_tally'),
        'count unlinked tally transactions',
      )
      setTallyUnlinkedCount(typeof n === 'number' && Number.isFinite(n) ? n : 0)
    } catch {
      setTallyUnlinkedCount(null)
    }
  }, [authUser?.id, role])

  const loadTallyStaleUnlinkedCount = useCallback(async () => {
    if (!authUser?.id || role == null) return
    try {
      const n = await withSupabaseRetry(
        async () =>
          await supabase.rpc('count_unlinked_mercury_transactions_for_tally_stale', {
            min_age_days: TALLY_STALE_MIN_AGE_DAYS,
          }),
        'count stale unlinked tally transactions',
      )
      setTallyStaleUnlinkedCount(typeof n === 'number' && Number.isFinite(n) ? n : 0)
    } catch {
      setTallyStaleUnlinkedCount(null)
    }
  }, [authUser?.id, role])

  useEffect(() => {
    if (!authUser?.id || role == null) {
      setTallyUnlinkedCount(null)
      setTallyStaleUnlinkedCount(null)
      return
    }
    void loadTallyUnlinkedCount()
    void loadTallyStaleUnlinkedCount()
  }, [authUser?.id, role, loadTallyUnlinkedCount, loadTallyStaleUnlinkedCount])

  useEffect(() => {
    if (!authUser?.id || role == null) return
    const onFocus = () => {
      void loadTallyUnlinkedCount()
      void loadTallyStaleUnlinkedCount()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [authUser?.id, role, loadTallyUnlinkedCount, loadTallyStaleUnlinkedCount])

  // Load users for Forward modal (all users, for Outstanding Forward)
  useEffect(() => {
    if (!authUser?.id) return
    supabase.from('users').select('id, name, email').order('name').then(({ data }) => {
      setSendTaskUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
    })
  }, [authUser?.id])

  useEffect(() => {
    if (!authUser?.id) {
      setTeamFeedbackHomeEnabled(false)
      return
    }
    let cancelled = false
    void fetchTeamFeedbackSettings()
      .then((s) => {
        if (!cancelled) setTeamFeedbackHomeEnabled(!!s?.enabled && !!s?.home_entry_enabled)
      })
      .catch(() => {
        if (!cancelled) setTeamFeedbackHomeEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [authUser?.id])

  const openContractSigningPageForDoc = useCallback(
    async (personContractDocumentId: string) => {
      setContractSigningPromptOpeningId(personContractDocumentId)
      try {
        const origin = typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : ''
        const { data: raw, error: fnErr } = await supabase.functions.invoke('get-contract-signing-link-for-self', {
          body: { person_contract_document_id: personContractDocumentId, public_origin: origin },
        })
        if (fnErr) {
          const detail = await readEdgeFunctionErrorBody(fnErr)
          showToast(detail ?? fnErr.message ?? 'Could not open signing page', 'error')
          return
        }
        const json = raw as { ok?: boolean; accept_url?: string; error?: string }
        if (!json?.ok || !json.accept_url) {
          showToast(json?.error ?? 'Could not open signing page', 'error')
          return
        }
        window.location.assign(json.accept_url)
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not open signing page', 'error')
      } finally {
        setContractSigningPromptOpeningId(null)
      }
    },
    [showToast],
  )

  useEffect(() => {
    if (!authUser?.id) {
      setEstimatorInboxEligible(false)
      return
    }
    if (role === 'dev') {
      setEstimatorInboxEligible(true)
      return
    }
    let cancelled = false
    supabase
      .from('estimator_group_members')
      .select('user_id')
      .eq('user_id', authUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setEstimatorInboxEligible(!!data)
      })
    return () => {
      cancelled = true
    }
  }, [authUser?.id, role])

  const loadEstimatorRequests = useCallback(() => {
    if (!authUser?.id || !estimatorInboxEligible) {
      setEstimatorRequests([])
      return
    }
    setEstimatorRequestsLoading(true)
    void Promise.all([
      supabase
        .from('estimator_requests')
        .select(
          'id, title, links, created_at, from_user_id, reference_summary, location_lat, location_lng, status, closed_at, closed_by_user_id, closed_note, sender:users!estimator_requests_from_user_id_fkey(name, email), closed_by:users!estimator_requests_closed_by_user_id_fkey(name)',
        )
        .order('created_at', { ascending: false }),
      supabase.from('estimator_request_dismissals').select('request_id').eq('user_id', authUser.id),
    ]).then(async ([requestsRes, dismissalsRes]) => {
      if (requestsRes.error) {
        setEstimatorRequestsLoading(false)
        console.error('Estimator inbox load:', requestsRes.error)
        return
      }
      const dismissedIds = new Set(
        (dismissalsRes.data ?? []).map((r: { request_id: string }) => r.request_id),
      )
      const rows = ((requestsRes.data ?? []) as EstimatorInboxRow[]).filter(
        (r) => !dismissedIds.has(r.id),
      )
      rows.sort((a, b) => {
        const aOpen = a.status === 'open' ? 1 : 0
        const bOpen = b.status === 'open' ? 1 : 0
        if (aOpen !== bOpen) return bOpen - aOpen
        const aDate = a.status === 'closed' ? (a.closed_at ?? a.created_at ?? '') : (a.created_at ?? '')
        const bDate = b.status === 'closed' ? (b.closed_at ?? b.created_at ?? '') : (b.created_at ?? '')
        return bDate.localeCompare(aDate)
      })

      let merged: EstimatorInboxRow[] = rows.map((r) => ({
        ...r,
        note_count: 0,
        last_note_at: null,
      }))

      if (rows.length > 0) {
        try {
          const statsRows = await withSupabaseRetry(
            async () =>
              supabase.rpc('estimator_inbox_note_stats', { p_request_ids: rows.map((r) => r.id) }),
            'estimator inbox note stats',
          )
          type StatRow = { request_id: string; note_count: number; last_note_at: string | null }
          const list = (statsRows ?? []) as StatRow[]
          const byId = new Map(
            list.map((s) => [
              s.request_id,
              { note_count: Number(s.note_count), last_note_at: s.last_note_at ?? null },
            ]),
          )
          merged = rows.map((r) => {
            const s = byId.get(r.id)
            return {
              ...r,
              note_count: s?.note_count ?? 0,
              last_note_at: s?.last_note_at ?? null,
            }
          })
        } catch (e) {
          console.error('Estimator inbox note stats:', e)
        }
      }

      setEstimatorRequests(merged)
      setEstimatorRequestsLoading(false)
    })
  }, [authUser?.id, estimatorInboxEligible])

  const loadEstimatorNotesForRequest = useCallback(
    async (requestId: string) => {
      setEstimatorNotesLoadingRequestId(requestId)
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('estimator_request_notes')
              .select(
                'id, body, created_at, author:users!estimator_request_notes_author_user_id_fkey(name)',
              )
              .eq('request_id', requestId)
              .order('created_at', { ascending: true }),
          'load estimator_request notes',
        )
        const rows = (data as EstimatorThreadNoteRow[] | null) ?? []
        setEstimatorThreadNotesByRequestId((prev) => ({ ...prev, [requestId]: rows }))
      } catch (e) {
        showToast(formatErrorMessage(e, 'Failed to load estimator notes'), 'error')
      } finally {
        setEstimatorNotesLoadingRequestId(null)
      }
    },
    [showToast],
  )

  useEffect(() => {
    expandedEstimatorRequestIdRef.current = expandedEstimatorRequestId
  }, [expandedEstimatorRequestId])

  useEffect(() => {
    if (!expandedEstimatorRequestId) return
    setEstimatorNoteDraft('')
    void loadEstimatorNotesForRequest(expandedEstimatorRequestId)
  }, [expandedEstimatorRequestId, loadEstimatorNotesForRequest])

  useEffect(() => {
    if (!authUser?.id || !estimatorInboxEligible) {
      setEstimatorRequests([])
      return
    }
    loadEstimatorRequests()
  }, [authUser?.id, estimatorInboxEligible, loadEstimatorRequests])

  const dashboardEstimatorEnabled = !!authUser?.id && estimatorInboxEligible
  const dashboardEstimatorRequestFilters = useMemo(
    () => [{ event: '*' as const, schema: 'public', table: 'estimator_requests' }],
    [],
  )
  useRealtimeChannel(
    dashboardEstimatorEnabled,
    'dashboard-estimator-requests',
    dashboardEstimatorRequestFilters,
    () => {
      loadEstimatorRequests()
    },
    { debounceMs: 400 },
  )

  // See useEstimatorInbox: drop the per-payload optimization in favour of "if
  // expanded, reload its notes". Volume on estimator_request_notes is low.
  const dashboardEstimatorNoteFilters = useMemo(
    () => [{ event: 'INSERT' as const, schema: 'public', table: 'estimator_request_notes' }],
    [],
  )
  useRealtimeChannel(
    dashboardEstimatorEnabled,
    'dashboard-estimator-request-notes',
    dashboardEstimatorNoteFilters,
    () => {
      const expandedId = expandedEstimatorRequestIdRef.current
      if (expandedId) void loadEstimatorNotesForRequest(expandedId)
      loadEstimatorRequests()
    },
    { debounceMs: 400 },
  )

  useEffect(() => {
    if (!authUser?.id) {
      setOutstandingLoading(false)
      return
    }
    loadOutstanding()
  }, [authUser?.id])

  async function refreshPinned() {
    if (!authUser?.id) {
      setPinnedRoutes([])
      return
    }
    // Single source now (self + dev pins live in user_pinned_tabs), already ordered by sort_order.
    const fromDb = await getPinnedForUserFromSupabase(authUser.id)
    setPinnedRoutes(fromDb)
  }

  useEffect(() => {
    refreshPinned()
  }, [authUser?.id])

  useEffect(() => {
    if (!authUser?.id || (role !== 'dev' && role !== 'master_technician' && role !== 'assistant')) {
      setDashboardButtonVisibility(null)
      return
    }
    supabase
      .from('user_dashboard_buttons')
      .select('button_key, visible')
      .eq('user_id', authUser.id)
      .then(({ data }) => {
        const defaults: Record<string, boolean> = { job: true, job_labor: true, bid: true, project: true, part: true, assembly: true, prospect: true, inspections: true, builder_review: role === 'master_technician' }
        const map = { ...defaults }
        for (const r of (data ?? []) as Array<{ button_key: string; visible: boolean }>) {
          if (r.button_key in map) map[r.button_key] = r.visible
        }
        setDashboardButtonVisibility(map)
      })
  }, [authUser?.id, role])

  useEffect(() => {
    if (!authUser?.id || (role !== 'dev' && role !== 'master_technician' && role !== 'assistant')) {
      setQuickButtonsPlacement('top')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const row = await withSupabaseRetry(
          async () =>
            await supabase
              .from('user_dashboard_preferences')
              .select('quick_buttons_placement')
              .eq('user_id', authUser.id)
              .maybeSingle(),
          'load user dashboard preferences',
        )
        if (cancelled) return
        const p = (row as { quick_buttons_placement?: string } | null)?.quick_buttons_placement
        // Default is with_pins (one row, uniform height); an explicit 'top' choice is honored.
        setQuickButtonsPlacement(p === 'top' ? 'top' : 'with_pins')
      } catch {
        if (!cancelled) setQuickButtonsPlacement('with_pins')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, role])

  // user_dashboard_preferences was dropped from supabase_realtime as part of
  // the Tier 1 mitigation (see migration 20260520172210). Cross-tab sync of
  // quick_buttons_placement is gone, but the value is rarely changed and the
  // initial fetch elsewhere in this file covers first-paint. Listener removed.

  useEffect(() => {
    return () => {
      if (financialPinsRealtimeTimerRef.current) {
        clearTimeout(financialPinsRealtimeTimerRef.current)
        financialPinsRealtimeTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const onPinsChanged = () => {
      refreshPinned()
      setFinancialRefreshKey((k) => k + 1)
    }
    window.addEventListener('pipetooling-pins-changed', onPinsChanged)
    window.addEventListener('focus', onPinsChanged)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshPinned()
        setFinancialRefreshKey((k) => k + 1)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pipetooling-pins-changed', onPinsChanged)
      window.removeEventListener('focus', onPinsChanged)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [authUser?.id])

  // user_pinned_tabs was dropped from supabase_realtime as part of the Tier 1
  // mitigation (see migration 20260520172210). The window-focus and
  // pipetooling-pins-changed listeners above already trigger refreshPinned()
  // on the surfaces that matter; cross-tab realtime sync was nice-to-have.

  // Realtime: refresh financial pin totals when underlying data changes.
  // Only jobs_ledger_invoices is in supabase_realtime today. If
  // supply_house_invoices, people_labor_jobs, people_labor_job_payments,
  // people_labor_job_items, or jobs_ledger are added to the publication
  // later, add them here in the same PR per
  // .cursor/rules/supabase-realtime.mdc — subscribing to a non-published
  // table is a silent no-op and misleads future readers.
  const dashboardFinancialPinsEnabled =
    !!authUser?.id && (hasBilledPin || hasSupplyHousesAPPin || hasSubLaborDuePin)
  const dashboardFinancialPinsFilters = useMemo(
    () => [{ event: '*' as const, schema: 'public', table: 'jobs_ledger_invoices' }],
    [],
  )
  useRealtimeChannel(
    dashboardFinancialPinsEnabled,
    'dashboard-financial-pins',
    dashboardFinancialPinsFilters,
    () => scheduleFinancialPinsRefreshFromRealtime(),
    { debounceMs: 500 },
  )

  useEffect(() => {
    if (!authUser?.id) return
    supabase.from('report_enabled_users').select('user_id').eq('user_id', authUser.id).maybeSingle().then(({ data }) => {
      setIsReportEnabledOnlyUser(!!data)
    })
  }, [authUser?.id])

  const loadRecentReportsRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!authUser?.id) return
    const showRecent = role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary'
    if (!showRecent) return
    setRecentReportsLoading(true)
    const load = async () => {
      try {
        const [{ data: reportsData }, { data: readsData }] = await Promise.all([
          supabase.rpc('list_reports_with_job_info'),
          supabase.from('report_reads').select('report_id').eq('user_id', authUser.id),
        ])
        const arr = Array.isArray(reportsData) ? reportsData : []
        const list = arr.slice(0, 8).map((r: { id: string; template_name: string; job_display_name: string; created_at: string; created_by_name: string; field_values?: unknown; reported_at_lat?: number | null; reported_at_lng?: number | null }) => ({
          id: r.id,
          template_name: r.template_name,
          job_display_name: r.job_display_name,
          created_at: r.created_at,
          created_by_name: r.created_by_name,
          field_values: r.field_values as Record<string, string> | undefined,
          reported_at_lat: r.reported_at_lat ?? null,
          reported_at_lng: r.reported_at_lng ?? null,
        }))
        setRecentReports(list)
        const readIds = new Set<string>()
        if (Array.isArray(readsData)) {
          for (const row of readsData) {
            if (row?.report_id) readIds.add(row.report_id)
          }
        }
        setReadReportIds(readIds)
        if (role !== 'primary' && list.some((r) => !readIds.has(r.id))) {
          setRecentReportsExpanded(true)
        }
      } finally {
        setRecentReportsLoading(false)
      }
    }
    loadRecentReportsRef.current = load
    load()
  }, [authUser?.id, role, isReportEnabledOnlyUser])

  useEffect(() => {
    const showUpcomingInspections = role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary'
    if (!authUser?.id || !showUpcomingInspections) return
    setUpcomingInspectionsLoading(true)
    const today = new Date()
    const startStr = toLocalDateString(today)
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 2)
    const endStr = toLocalDateString(endDate)
    supabase
      .from('inspections')
      .select('id, address, inspection_type, scheduled_date')
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr)
      .order('scheduled_date', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setUpcomingInspections([])
        } else {
          setUpcomingInspections((data as Array<{ id: string; address: string; inspection_type: string; scheduled_date: string }>) ?? [])
        }
        setUpcomingInspectionsLoading(false)
      })
  }, [authUser?.id, role])

  useEffect(() => {
    const hasBidsAccess =
      role === 'dev' ||
      role === 'master_technician' ||
      role === 'assistant' ||
      role === 'estimator' ||
      role === 'primary' ||
      role === 'superintendent'
    if (!authUser?.id || !hasBidsAccess) return
    let cancelled = false
    setMyBidsLoading(true)
    void (async () => {
      try {
        const uidForFilter = authUser.id
        const rawRows = await withSupabaseRetry(
          async () =>
            supabase
              .from('bids')
              .select(
                'id, project_name, bid_due_date, bid_date_sent, outcome, customer_id, estimator_id, account_manager_id, service_type:service_types(name)'
              )
              .or(`estimator_id.eq.${uidForFilter},account_manager_id.eq.${uidForFilter}`)
              .or('outcome.is.null,outcome.neq.lost')
              .order('bid_due_date', { ascending: true, nullsFirst: false })
              .limit(MY_BIDS_DASHBOARD_ROW_LIMIT),
          'load dashboard my bids'
        )
        if (cancelled) return
        const baseRows = (rawRows ?? []) as Array<{
          id: string
          project_name: string | null
          bid_due_date: string | null
          bid_date_sent: string | null
          outcome: string | null
          customer_id: string | null
          estimator_id: string | null
          account_manager_id: string | null
          service_type: { name: string } | null
        }>
        const bidIds = baseRows.map((r) => r.id)
        const uid = authUser.id
        if (bidIds.length === 0) {
          if (!cancelled) setMyBids([])
          return
        }

        const [readStateRows, entryRows] = await Promise.all([
          withSupabaseRetry(
            async () =>
              supabase.from('user_bid_notes_read_state').select('*').eq('user_id', uid).in('bid_id', bidIds),
            'load bid notes read state'
          ),
          withSupabaseRetry(
            async () =>
              supabase
                .from('bids_submission_entries')
                .select('id, bid_id, created_at, created_by, notes, occurred_at, contact_method')
                .in('bid_id', bidIds),
            'load bid submission entries for unread'
          ),
        ])
        const customerIds = [
          ...new Set(
            baseRows
              .map((r) => r.customer_id)
              .filter((cid): cid is string => cid != null && cid !== '')
          ),
        ]
        type SubmissionEntryRow = {
          id: string
          bid_id: string
          created_at: string | null
          created_by: string | null
          notes: string | null
          occurred_at: string
          contact_method: string | null
        }
        type CustomerContactRow = {
          id: string
          customer_id: string
          created_at: string | null
          created_by: string | null
          details: string | null
          contact_date: string
          contact_method: string | null
        }
        let contactRows: CustomerContactRow[] = []
        if (customerIds.length > 0) {
          contactRows =
            (await withSupabaseRetry(
              async () =>
                supabase
                  .from('customer_contacts')
                  .select('id, customer_id, created_at, created_by, details, contact_date, contact_method')
                  .in('customer_id', customerIds),
              'load customer contacts for unread'
            )) ?? []
        }
        if (cancelled) return

        const readMap = new Map<
          string,
          { last_seen_bid_submission_at: string | null; last_seen_customer_contact_at: string | null }
        >()
        for (const r of readStateRows ?? []) {
          readMap.set(r.bid_id, {
            last_seen_bid_submission_at: r.last_seen_bid_submission_at,
            last_seen_customer_contact_at: r.last_seen_customer_contact_at,
          })
        }

        function compareSubmissionDesc(a: SubmissionEntryRow, b: SubmissionEntryRow): number {
          const ta = a.created_at ? Date.parse(a.created_at) : 0
          const tb = b.created_at ? Date.parse(b.created_at) : 0
          if (tb !== ta) return tb - ta
          return b.id.localeCompare(a.id)
        }

        function compareContactDesc(a: CustomerContactRow, b: CustomerContactRow): number {
          const ta = a.created_at ? Date.parse(a.created_at) : 0
          const tb = b.created_at ? Date.parse(b.created_at) : 0
          if (tb !== ta) return tb - ta
          return b.id.localeCompare(a.id)
        }

        const bidListsFromOthers = new Map<string, SubmissionEntryRow[]>()
        for (const row of (entryRows ?? []) as SubmissionEntryRow[]) {
          if (!row.created_by || row.created_by === uid) continue
          const ca = row.created_at
          if (!ca) continue
          const list = bidListsFromOthers.get(row.bid_id)
          if (list) list.push(row)
          else bidListsFromOthers.set(row.bid_id, [row])
        }
        for (const list of bidListsFromOthers.values()) {
          list.sort(compareSubmissionDesc)
        }

        const customerListsFromOthers = new Map<string, CustomerContactRow[]>()
        for (const row of contactRows) {
          if (!row.created_by || row.created_by === uid) continue
          const ca = row.created_at
          if (!ca) continue
          const cid = row.customer_id
          const list = customerListsFromOthers.get(cid)
          if (list) list.push(row)
          else customerListsFromOthers.set(cid, [row])
        }
        for (const list of customerListsFromOthers.values()) {
          list.sort(compareContactDesc)
        }

        const authorIds = new Set<string>()
        for (const list of bidListsFromOthers.values()) {
          for (const e of list) {
            if (e.created_by) authorIds.add(e.created_by)
          }
        }
        for (const list of customerListsFromOthers.values()) {
          for (const c of list) {
            if (c.created_by) authorIds.add(c.created_by)
          }
        }
        const authorLabelById = new Map<string, string>()
        if (authorIds.size > 0) {
          const authors =
            (await withSupabaseRetry(
              async () =>
                supabase.from('users').select('id, name, email').in('id', [...authorIds]),
              'load users for my bids note authors'
            )) ?? []
          for (const u of authors as Array<{ id: string; name: string | null; email: string }>) {
            authorLabelById.set(u.id, (u.name?.trim() || u.email || 'Someone').trim())
          }
        }

        function isUnread(latest: string | undefined, wm: string | null | undefined): boolean {
          if (!latest) return false
          if (wm == null || wm === '') return true
          return Date.parse(latest) > Date.parse(wm)
        }

        function myBidRolesForUser(
          userId: string,
          estimatorId: string | null,
          accountManagerId: string | null
        ): 'estimator' | 'account_manager' | 'both' {
          const isEstimator = estimatorId === userId
          const isAccountManager = accountManagerId === userId
          if (isEstimator && isAccountManager) return 'both'
          if (isEstimator) return 'estimator'
          if (isAccountManager) return 'account_manager'
          return 'estimator'
        }

        const myBidsBuilt: MyBidRow[] = baseRows.map((r) => {
          const rs = readMap.get(r.id)
          const bidList = bidListsFromOthers.get(r.id) ?? []
          const latestBid = bidList[0]?.created_at ?? undefined
          const unreadBid = isUnread(latestBid, rs?.last_seen_bid_submission_at)
          let unreadCust = false
          const custList = r.customer_id ? customerListsFromOthers.get(r.customer_id) ?? [] : []
          const latestC = custList[0]?.created_at ?? undefined
          if (r.customer_id) {
            unreadCust = isUnread(latestC, rs?.last_seen_customer_contact_at)
          }

          const othersBidUpdates: MyBidOthersBidItem[] = bidList.map((e) => ({
            id: e.id,
            text: e.notes,
            createdAt: e.created_at ?? '',
            occurredAt: e.occurred_at,
            contactMethod: e.contact_method ?? undefined,
            authorLabel: e.created_by ? authorLabelById.get(e.created_by) : undefined,
          }))

          const othersCustomerUpdates: MyBidOthersCustomerItem[] = custList.map((c) => ({
            id: c.id,
            text: c.details,
            createdAt: c.created_at ?? '',
            contactDate: c.contact_date,
            contactMethod: c.contact_method ?? undefined,
            authorLabel: c.created_by ? authorLabelById.get(c.created_by) : undefined,
          }))

          return {
            id: r.id,
            project_name: r.project_name,
            bid_due_date: r.bid_due_date,
            bid_date_sent: r.bid_date_sent,
            outcome: r.outcome,
            service_type_name: r.service_type?.name ?? '',
            myBidRoles: myBidRolesForUser(uid, r.estimator_id, r.account_manager_id),
            unreadBidNotes: unreadBid,
            unreadCustomerNotes: unreadCust,
            othersBidUpdates,
            othersCustomerUpdates,
          }
        })
        if (!cancelled) setMyBids(myBidsBuilt)
      } catch {
        if (!cancelled) setMyBids([])
      } finally {
        if (!cancelled) setMyBidsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, role])

  useEffect(() => {
    const hasBidsAccess =
      role === 'dev' ||
      role === 'master_technician' ||
      role === 'assistant' ||
      role === 'estimator' ||
      role === 'primary' ||
      role === 'superintendent'
    if (!authUser?.id || !hasBidsAccess) {
      setLostMissingLossReasonCount(0)
      setLostMissingLossReasonLoading(false)
      return
    }
    let cancelled = false
    setLostMissingLossReasonLoading(true)
    const uidForFilter = authUser.id
    void (async () => {
      try {
        const rawRows = await withSupabaseRetry(
          async () =>
            supabase
              .from('bids')
              .select('loss_reason')
              .eq('outcome', 'lost')
              .or(`estimator_id.eq.${uidForFilter},account_manager_id.eq.${uidForFilter}`)
              .limit(500),
          'dashboard lost bids missing loss reason',
        )
        if (cancelled) return
        const rows = (rawRows ?? []) as Array<{ loss_reason: string | null }>
        const n = rows.filter((r) => !String(r.loss_reason ?? '').trim()).length
        if (!cancelled) setLostMissingLossReasonCount(n)
      } catch {
        if (!cancelled) setLostMissingLossReasonCount(0)
      } finally {
        if (!cancelled) setLostMissingLossReasonLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, role])

  useEffect(() => {
    if (!authUser?.id || typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(`dashboard_my_bids_hidden_${authUser.id}`)
      if (raw) {
        const arr = JSON.parse(raw) as string[]
        if (Array.isArray(arr)) setHiddenBidIds(new Set(arr))
      }
    } catch {
      /* ignore */
    }
  }, [authUser?.id])

  function hideBid(bidId: string) {
    const next = new Set(hiddenBidIds)
    next.add(bidId)
    setHiddenBidIds(next)
    if (authUser?.id && typeof window !== 'undefined') {
      localStorage.setItem(`dashboard_my_bids_hidden_${authUser.id}`, JSON.stringify([...next]))
    }
  }

  function unhideBid(bidId: string) {
    const next = new Set(hiddenBidIds)
    next.delete(bidId)
    setHiddenBidIds(next)
    if (authUser?.id && typeof window !== 'undefined') {
      localStorage.setItem(`dashboard_my_bids_hidden_${authUser.id}`, JSON.stringify([...next]))
    }
  }

  const markMyBidNotesReadAsViewed = useCallback(
    async (bidId: string) => {
      if (!authUser?.id) return
      try {
        await upsertBidNotesReadWatermark(authUser.id, bidId)
        setMyBids((prev) =>
          prev.map((b) =>
            b.id === bidId
              ? {
                  ...b,
                  unreadBidNotes: false,
                  unreadCustomerNotes: false,
                  othersBidUpdates: [],
                  othersCustomerUpdates: [],
                }
              : b
          )
        )
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not mark notes as read'), 'error')
      }
    },
    [authUser?.id, showToast]
  )

  const adjustMyBidOthersLimit = useCallback(
    (bidId: string, stream: 'bid' | 'customer', op: 'more' | 'all' | 'less', total: number) => {
      setMyBidOthersVisibleLimits((prev) => {
        const cur = prev[bidId] ?? { bid: 1, customer: 1 }
        const v = stream === 'bid' ? cur.bid : cur.customer
        let nv = v
        if (op === 'more') nv = Math.min(v + MY_BID_OTHERS_VISIBLE_STEP, total)
        else if (op === 'all') nv = total
        else nv = 1
        return {
          ...prev,
          [bidId]: {
            bid: stream === 'bid' ? nv : cur.bid,
            customer: stream === 'customer' ? nv : cur.customer,
          },
        }
      })
    },
    []
  )

  useEffect(() => {
    const ids = new Set(myBids.map((x) => x.id))
    setMyBidOthersVisibleLimits((prev) => {
      let changed = false
      const next: Record<string, { bid: number; customer: number }> = { ...prev }
      for (const k of Object.keys(next)) {
        if (!ids.has(k)) {
          delete next[k]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [myBids])

  const dashboardReportsEnabled =
    role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary'
  const dashboardReportsFilters = useMemo(
    () => [{ event: '*' as const, schema: 'public', table: 'reports' }],
    [],
  )
  useRealtimeChannel(
    dashboardReportsEnabled,
    'dashboard-reports-changes',
    dashboardReportsFilters,
    () => {
      loadRecentReportsRef.current?.()
    },
    { debounceMs: 500 },
  )

  useEffect(() => {
    const visible = recentReports.filter((r) => !hiddenReportIds.has(r.id))
    const unreadCount = visible.filter((r) => !readReportIds.has(r.id)).length
    if (recentReportsView === 'unread' && unreadCount === 0) {
      setRecentReportsView('all')
    }
  }, [recentReports, readReportIds, hiddenReportIds, recentReportsView])

  useEffect(() => {
    if (!hideOnRefreshPending || readReportIds.size === 0) return
    const ids = Array.from(readReportIds)
    try {
      localStorage.setItem(HIDE_ON_REFRESH_STORAGE_KEY, JSON.stringify(ids))
    } catch {
      /* ignore */
    }
  }, [readReportIds, hideOnRefreshPending])

  useEffect(() => {
    if (!authUser?.id) {
      setUserLoading(false)
      return
    }
    let cancelled = false
    setUserError(null)
    const today = toLocalDateString(new Date())
    const cached = readDashboardBootCache(authUser.id, today)

    if (cached) {
      setTodayChecklist(cached.todayChecklist as ChecklistInstance[])
      setChecklistLoading(false)
      setUserNames(new Set(cached.userNamesLower))
      setUserName(cached.userName)
      setUserLoading(false)
    } else {
      setUserLoading(true)
      setChecklistLoading(true)
      setAssignedLoading(true)
      setSubscribedLoading(true)
    }

    // Phase 1: shared query module (see dashboardBootQueries.ts); stale cache hydrates above before this resolves.
    fetchDashboardPhase1(supabase, authUser.id, today).then(([userRes, allUsersRes, subsRes, checklistRes]) => {
      if (cancelled) return

      const { data: userData, error: userErr } = userRes
      if (userErr) {
        setUserError(userErr.message)
        setUserLoading(false)
        setChecklistLoading(false)
        setAssignedLoading(false)
        setSubscribedLoading(false)
        return
      }

      const user = userData as { name: string | null } | null
      setUserLoading(false)
      setUserName(user?.name ?? null)

      const userNamesSet = new Set<string>()
      const allUsers = allUsersRes.data ?? []
      allUsers.forEach((u) => {
        if (u.name) userNamesSet.add(u.name.trim().toLowerCase())
      })
      setUserNames(userNamesSet)

      const checklistDataUnsorted = (checklistRes.data ?? []) as ChecklistInstance[]
      if (!cancelled) {
        setTodayChecklist(checklistDataUnsorted)
        setChecklistLoading(false)
      }

      const writeBootCache = (checklistForCache: ChecklistInstance[]) => {
        if (cancelled) return
        writeDashboardBootCache(authUser.id, today, {
          userName: user?.name ?? null,
          userNamesLower: Array.from(userNamesSet),
          todayChecklist: checklistForCache,
        })
      }

      if (!cancelled && checklistDataUnsorted.length > 0) {
        void (async () => {
          const itemIds = [...new Set(checklistDataUnsorted.map((r) => r.checklist_item_id))]
          const { data: orderData } = await supabase
            .from('checklist_item_assignees')
            .select('checklist_item_id, display_order')
            .eq('user_id', authUser.id)
            .in('checklist_item_id', itemIds)
          if (cancelled) return
          const orderMap = new Map<string, number>()
          for (const row of (orderData ?? []) as Array<{ checklist_item_id: string; display_order: number | null }>) {
            orderMap.set(row.checklist_item_id, row.display_order ?? 999999)
          }
          const sorted = [...checklistDataUnsorted].sort((a, b) => {
            const orderA = orderMap.get(a.checklist_item_id) ?? 999999
            const orderB = orderMap.get(b.checklist_item_id) ?? 999999
            if (orderA !== orderB) return orderA - orderB
            return (a.created_at ?? '').localeCompare(b.created_at ?? '')
          })
          if (!cancelled) setTodayChecklist(sorted)
          writeBootCache(sorted)
        })()
      } else if (!cancelled) {
        writeBootCache(checklistDataUnsorted)
      }

      const subs = subsRes.data ?? []
      const name = user?.name ?? null

      // Phase 2: Load subscribed and assigned in parallel
      const loadSubscribed = async () => {
        if (!subs || subs.length === 0) {
          if (!cancelled) setSubscribedSteps([])
          if (!cancelled) setSubscribedLoading(false)
          return
        }
        const stepIds = subs.map((s) => s.step_id)
        const { data: steps } = await supabase
          .from('project_workflow_steps')
          .select('id, name, workflow_id')
          .in('id', stepIds)
        if (cancelled || !steps?.length) {
          if (!cancelled) setSubscribedLoading(false)
          return
        }
        const workflowIds = [...new Set(steps.map((s) => s.workflow_id))]
        const { data: workflows } = await supabase
          .from('project_workflows')
          .select('id, project_id')
          .in('id', workflowIds)
        if (cancelled || !workflows?.length) {
          if (!cancelled) setSubscribedLoading(false)
          return
        }
        const projectIds = [...new Set(workflows.map((w) => w.project_id))]
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name, project_number')
          .in('id', projectIds)
        if (cancelled || !projects?.length) {
          if (!cancelled) setSubscribedLoading(false)
          return
        }
        const workflowToProject = new Map(workflows.map((w) => [w.id, w.project_id]))
        const projectMap = new Map(
          projects.map((p) => [
            p.id,
            { name: p.name, project_number: p.project_number ?? null },
          ]),
        )
        const subscribed: SubscribedStep[] = []
        steps.forEach((step) => {
          const sub = subs.find((s) => s.step_id === step.id)
          const projectId = workflowToProject.get(step.workflow_id)
          const projectInfo = projectId ? projectMap.get(projectId) : null
          if (sub && projectId && projectInfo) {
            subscribed.push({
              step_id: step.id,
              step_name: step.name,
              project_id: projectId,
              project_name: projectInfo.name,
              project_number: projectInfo.project_number,
              notify_when_started: sub.notify_when_started ?? false,
              notify_when_complete: sub.notify_when_complete ?? false,
              notify_when_reopened: sub.notify_when_reopened ?? false,
            })
          }
        })
        if (!cancelled) {
          setSubscribedSteps(subscribed)
          setSubscribedLoading(false)
        }
      }

      const loadAssigned = async () => {
        if (!name) {
          if (!cancelled) setAssignedLoading(false)
          return
        }
        let assigned: AssignedStep[] = []
        const withProjectsRes = await supabase.rpc('get_assigned_steps_with_projects_for_dashboard', { p_user_name: name })
        if (!withProjectsRes.error && Array.isArray(withProjectsRes.data)) {
          assigned = withProjectsRes.data as AssignedStep[]
        }
        if (assigned.length === 0 && (withProjectsRes.error?.message?.includes('Could not find the function') || withProjectsRes.error)) {
          let steps: Step[] = []
          const rpcRes = await supabase.rpc('get_assigned_steps_for_dashboard', { p_user_name: name })
          if (rpcRes.error?.message?.includes('Could not find the function')) {
            const { data } = await supabase.from('project_workflow_steps').select('*').eq('assigned_to_name', name).order('created_at', { ascending: false }).limit(100)
            steps = (data ?? []) as Step[]
          } else {
            steps = (rpcRes.data ?? []) as Step[]
          }
          if (cancelled || steps.length === 0) {
            if (!cancelled) setAssignedLoading(false)
            return
          }
          const workflowIds = [...new Set(steps.map((s) => s.workflow_id))]
          const { data: workflows } = await supabase.from('project_workflows').select('id, project_id').in('id', workflowIds)
          if (cancelled || !workflows?.length) {
            if (!cancelled) setAssignedLoading(false)
            return
          }
          const projectIds = [...new Set(workflows.map((w) => w.project_id))]
          const { data: projects } = await supabase.from('projects').select('id, name, address, plans_link').in('id', projectIds)
          if (cancelled || !projects?.length) {
            if (!cancelled) setAssignedLoading(false)
            return
          }
          const workflowToProject = new Map(workflows.map((w) => [w.id, w.project_id]))
          const projectMap = new Map(projects.map((p) => [p.id, { name: p.name, address: p.address, plans_link: p.plans_link }]))
          assigned = steps.map((step) => {
            const projectId = workflowToProject.get(step.workflow_id) ?? ''
            const project = projectId ? projectMap.get(projectId) : null
            return {
              ...step,
              project_id: projectId,
              project_name: project?.name ?? '',
              project_address: project?.address ?? null,
              project_plans_link: project?.plans_link ?? null,
              project_superintendent_names: null,
              workflow_id: step.workflow_id,
            }
          })
        }
        if (cancelled || assigned.length === 0) {
          if (!cancelled) setAssignedLoading(false)
          return
        }
        if (!cancelled) {
          setAssignedSteps(assigned)
          setAssignedLoading(false)
        }
      }

      void Promise.all([loadSubscribed(), loadAssigned()]).catch(() => {})
    })
    return () => { cancelled = true }
  }, [authUser?.id])

  useEffect(() => {
    if (!authUser?.id) return
    setAssignedJobsLoading(true)
    supabase
      .rpc('list_assigned_jobs_for_dashboard')
      .then(({ data, error }) => {
        setAssignedJobsLoading(false)
        if (error) return
        setAssignedJobs((data ?? []) as unknown as DashboardTeamAssignedJobRow[])
      })
  }, [authUser?.id])

  useEffect(() => {
    const id = window.setInterval(() => setScheduleReminderNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!authUser?.id || !canLeaveJobFieldReport(role)) {
      setSubScheduleRows([])
      setSubScheduleLoading(false)
      return
    }
    let cancelled = false
    const run = async () => {
      if (isSubcontractorLikeRole(role)) setSubScheduleLoading(true)
      const todayYmd = scheduleTodayDateKey()
      const tomorrowYmd = scheduleDateKeyAddDays(todayYmd, 1) ?? todayYmd
      const { data, error } = await fetchScheduleBlocksForAssigneeDateRange(
        authUser.id,
        todayYmd,
        tomorrowYmd,
      )
      if (cancelled) return
      if (error) {
        showToast(error, 'warning')
        setSubScheduleRows([])
        setSubScheduleLoading(false)
        return
      }
      setSubScheduleRows(dedupeSubScheduleBlocks(data ?? []))
      setSubScheduleLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, role, showToast])

  useEffect(() => {
    if (!isSubcontractorLikeRole(role) || !authUser?.id) {
      setSubScheduleLabels(new Map())
      return
    }
    if (subScheduleRows.length === 0) {
      setSubScheduleLabels(new Map())
      return
    }
    const jobIds = [...new Set(subScheduleRows.map((b) => b.job_id))]
    const labelMap = new Map<string, string>()
    for (const j of [...assignedJobs, ...assignedReadyToBillJobs]) {
      if (jobIds.includes(j.id)) {
        labelMap.set(
          j.id,
          `${(j.hcp_number ?? '').trim() || '—'} · ${(j.job_name ?? '').trim() || 'Job'}`,
        )
      }
    }
    const missing = jobIds.filter((id) => !labelMap.has(id))
    if (missing.length === 0) {
      setSubScheduleLabels(new Map(labelMap))
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            await supabase.from('jobs_ledger').select('id, hcp_number, job_name').in('id', missing),
          'dashboardSubScheduleJobLabels',
        )
        if (cancelled) return
        for (const r of (rows ?? []) as Array<{
          id: string
          hcp_number: string | null
          job_name: string | null
        }>) {
          labelMap.set(
            r.id,
            `${(r.hcp_number ?? '').trim() || '—'} · ${(r.job_name ?? '').trim() || 'Job'}`,
          )
        }
        for (const id of missing) {
          if (!labelMap.has(id)) labelMap.set(id, 'Job')
        }
        setSubScheduleLabels(new Map(labelMap))
      } catch {
        if (!cancelled) {
          for (const id of missing) {
            if (!labelMap.has(id)) labelMap.set(id, 'Job')
          }
          setSubScheduleLabels(new Map(labelMap))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role, authUser?.id, subScheduleRows, assignedJobs, assignedReadyToBillJobs])

  useEffect(() => {
    if (!isSubcontractorLikeRole(role) || !authUser?.id) {
      setSubSchedulePhones(new Map())
      return
    }
    if (subScheduleRows.length === 0) {
      setSubSchedulePhones(new Map())
      return
    }
    const jobIds = [...new Set(subScheduleRows.map((b) => b.job_id))]
    let cancelled = false
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            await supabase.from('jobs_ledger').select('id, customer_phone').in('id', jobIds),
          'dashboardSubScheduleJobPhones',
        )
        if (cancelled) return
        const m = new Map<string, string | null>()
        for (const r of (rows ?? []) as Array<{ id: string; customer_phone: string | null }>) {
          m.set(r.id, r.customer_phone)
        }
        setSubSchedulePhones(m)
      } catch {
        if (!cancelled) setSubSchedulePhones(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role, authUser?.id, subScheduleRows])

  const subScheduleDayPartition = useMemo(() => {
    const todayYmd = scheduleTodayDateKey()
    const tomorrowYmd = scheduleDateKeyAddDays(todayYmd, 1) ?? todayYmd
    return {
      todayYmd,
      tomorrowYmd,
      todayBlocks: subScheduleRows.filter((b) => b.work_date === todayYmd),
      tomorrowBlocks: subScheduleRows.filter((b) => b.work_date === tomorrowYmd),
    }
  }, [subScheduleRows])

  const leaveReportReminderForJobRow = useCallback(
    (j: Pick<DashboardTeamAssignedJobRow, 'id' | 'my_last_report_at'>) =>
      shouldShowLeaveReportScheduleReminder({
        now: scheduleReminderNow,
        todayYmd: scheduleTodayDateKey(scheduleReminderNow),
        jobId: j.id,
        blocks: subScheduleRows,
        myLastReportAtIso: j.my_last_report_at ?? null,
      }),
    [scheduleReminderNow, subScheduleRows],
  )

  const refreshDashboardAssignedJobLists = useCallback(async () => {
    if (!authUser?.id) return
    try {
      const { data: assignedData } = await supabase.rpc('list_assigned_jobs_for_dashboard')
      if (assignedData) setAssignedJobs(assignedData as unknown as DashboardTeamAssignedJobRow[])
      if (isDashboardTeamReadyToBillRole(role)) {
        const { data: rtbAssignedData } = await supabase.rpc('list_ready_to_bill_assigned_jobs_for_dashboard')
        if (rtbAssignedData) setAssignedReadyToBillJobs(rtbAssignedData as unknown as DashboardTeamAssignedJobRow[])
      }
      if (role === 'superintendent') {
        const { data: superintendentData } = await supabase.rpc('list_superintendent_jobs_for_dashboard')
        if (superintendentData) setSuperintendentJobs(superintendentData as unknown as DashboardTeamAssignedJobRow[])
      }
    } catch {
      /* keep prior lists */
    }
  }, [authUser?.id, role])

  const detailModalAssignedJobsRows = useMemo(
    () => [...assignedJobs, ...assignedReadyToBillJobs],
    [assignedJobs, assignedReadyToBillJobs],
  )

  const openJobDetailFromDashboardJobRow = useCallback(
    (j: { id: string; hcp_number: string | null; job_name: string | null; job_address: string | null }) => {
      const hcp = (j.hcp_number ?? '').trim() || '—'
      const name = (j.job_name ?? '').trim() || '—'
      jobDetailModal?.openJobDetail({
        jobId: j.id,
        scheduleContext: null,
        prefillRowLabel: `${hcp} · ${name}`,
        prefillAddress: (j.job_address ?? '').trim() || null,
        assignedJobsRows: detailModalAssignedJobsRows,
      })
    },
    [jobDetailModal, detailModalAssignedJobsRows],
  )

  const readyToBillDetailModalAssignedRows = useMemo((): DetailJobModalAssignedJobRow[] => {
    return readyToBillJobs.map((j) => ({
      id: j.id,
      hcp_number: j.hcp_number ?? '',
      job_name: j.job_name ?? '',
      job_address: j.job_address ?? '',
      google_drive_link: j.google_drive_link,
      job_plans_link: j.job_plans_link,
      revenue: j.revenue != null ? Number(j.revenue) : null,
      project_id: null,
    }))
  }, [readyToBillJobs])

  useEffect(() => {
    if (!authUser?.id || !isDashboardTeamReadyToBillRole(role)) {
      setAssignedReadyToBillJobs([])
      setAssignedReadyToBillLoading(false)
      return
    }
    let cancelled = false
    setAssignedReadyToBillLoading(true)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () => supabase.rpc('list_ready_to_bill_assigned_jobs_for_dashboard'),
          'list_ready_to_bill_assigned_jobs_for_dashboard',
        )
        if (cancelled) return
        setAssignedReadyToBillJobs((data ?? []) as unknown as DashboardTeamAssignedJobRow[])
      } catch {
        /* keep prior list */
      } finally {
        if (!cancelled) setAssignedReadyToBillLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, role])

  const refreshAssignedReadyToBill = useCallback(() => {
    if (!authUser?.id || !isDashboardTeamReadyToBillRole(role)) return
    void supabase.rpc('list_ready_to_bill_assigned_jobs_for_dashboard').then(({ data, error }) => {
      if (!error && data) {
        setAssignedReadyToBillJobs(data as unknown as DashboardTeamAssignedJobRow[])
      }
    })
  }, [authUser?.id, role])

  useEffect(() => {
    if (!authUser?.id || role !== 'superintendent') return
    setSuperintendentJobsLoading(true)
    supabase
      .rpc('list_superintendent_jobs_for_dashboard')
      .then(({ data, error }) => {
        setSuperintendentJobsLoading(false)
        if (error) return
        setSuperintendentJobs((data ?? []) as unknown as typeof superintendentJobs)
      })
  }, [authUser?.id, role])

  useEffect(() => {
    if (!authUser?.id || (role !== 'dev' && role !== 'master_technician' && role !== 'assistant')) return
    setReadyToBillLoading(true)
    Promise.all([
      supabase
        .from('jobs_ledger_invoices')
        .select(DASHBOARD_INVOICES_JOBS_LEDGER_SELECT)
        .eq('status', 'ready_to_bill')
        .order('created_at', { ascending: false }),
      supabase.rpc('get_jobs_ledger_by_status', { p_status: 'ready_to_bill' }),
    ]).then(([invRes, jobRes]) => {
      setReadyToBillLoading(false)
      if (!invRes.error) {
        const rows = (invRes.data ?? []) as DashboardInvoiceJoinRow[]
        const emptyPay = new Map<string, JobsLedgerPaymentRow[]>()
        setReadyToBillInvoices(rows.map((r) => mapJoinedInvoiceToDashboard(r, emptyPay)))
      }
      if (!jobRes.error) {
        setReadyToBillJobs((jobRes.data ?? []) as JobForDashboard[])
      }
    })
  }, [authUser?.id, role])

  useEffect(() => {
    if (!authUser?.id || (role !== 'dev' && role !== 'master_technician' && role !== 'assistant')) return
    setWaitingForPaymentLoading(true)
    Promise.all([
      supabase
        .from('jobs_ledger_invoices')
        .select(DASHBOARD_INVOICES_JOBS_LEDGER_SELECT)
        .eq('status', 'billed')
        .order('created_at', { ascending: false }),
      supabase.rpc('get_jobs_ledger_by_status', { p_status: 'billed' }),
    ]).then(async ([invRes, jobRes]) => {
      setWaitingForPaymentLoading(false)
      const jobs = (jobRes.data ?? []) as JobForDashboard[]
      if (!jobRes.error) {
        setWaitingForPaymentJobs(jobs)
      }
      if (invRes.error) return
      const rows = (invRes.data ?? []) as DashboardInvoiceJoinRow[]
      const jobIds = new Set<string>()
      for (const r of rows) jobIds.add(r.job_id)
      for (const j of jobs) jobIds.add(j.id)
      let payMap = new Map<string, JobsLedgerPaymentRow[]>()
      if (jobIds.size > 0) {
        const { data: payData } = await supabase.from('jobs_ledger_payments').select('*').in('job_id', [...jobIds])
        payMap = buildPaymentsByInvoiceIdMap((payData ?? []) as JobsLedgerPaymentRow[])
      }
      setWaitingForPaymentInvoices(rows.map((r) => mapJoinedInvoiceToDashboard(r, payMap)))
    })
  }, [authUser?.id, role])

  async function updateJobStatus(jobId: string, toStatus: 'working' | 'ready_to_bill' | 'billed' | 'paid'): Promise<boolean> {
    if (dashboardJobStatusMutationLockRef.current === jobId) return false
    dashboardJobStatusMutationLockRef.current = jobId
    setJobStatusUpdatingId(jobId)
    try {
      const { data, error } = await supabase.rpc('update_job_status', { p_job_id: jobId, p_to_status: toStatus })
      if (error) {
        const { text, variant } = toastForUpdateJobStatusFailure(error.message)
        showToast?.(text, variant)
        if (shouldResyncJobsAfterUpdateJobStatusFailure(error.message)) {
          void resyncDashboardAfterUpdateJobStatusFailureRef.current()
        }
        return false
      }
      const result = data as { error?: string } | null
      if (result?.error) {
        const { text, variant } = toastForUpdateJobStatusFailure(result.error)
        showToast?.(text, variant)
        if (shouldResyncJobsAfterUpdateJobStatusFailure(result.error)) {
          void resyncDashboardAfterUpdateJobStatusFailureRef.current()
        }
        return false
      }
      showToast?.('Status updated', 'success')
      setAssignedJobs((prev) => prev.filter((j) => j.id !== jobId))
      setAssignedReadyToBillJobs((prev) => prev.filter((j) => j.id !== jobId))
      setSuperintendentJobs((prev) => prev.filter((j) => j.id !== jobId))
      refreshInvoices()
      const { data: assignedData } = await supabase.rpc('list_assigned_jobs_for_dashboard')
      if (assignedData) setAssignedJobs(assignedData as unknown as DashboardTeamAssignedJobRow[])
      if (isDashboardTeamReadyToBillRole(role)) {
        const { data: rtbAssignedData } = await supabase.rpc('list_ready_to_bill_assigned_jobs_for_dashboard')
        if (rtbAssignedData) setAssignedReadyToBillJobs(rtbAssignedData as unknown as DashboardTeamAssignedJobRow[])
      }
      if (role === 'superintendent') {
        const { data: superintendentData } = await supabase.rpc('list_superintendent_jobs_for_dashboard')
        if (superintendentData) setSuperintendentJobs(superintendentData as unknown as DashboardTeamAssignedJobRow[])
      }
      return true
    } finally {
      setJobStatusUpdatingId(null)
      if (dashboardJobStatusMutationLockRef.current === jobId) {
        dashboardJobStatusMutationLockRef.current = null
      }
    }
  }

  async function moveJobToReadyToBillWithStripePrep(jobId: string): Promise<boolean> {
    const token = await getAccessTokenForEdgeFunctions()
    if (!token) {
      showToast?.('Not signed in', 'error')
      return false
    }
    const prep = await prepareBilledInvoicesBeforeJobRevertToReadyToBill({
      jobId,
      authRole: role,
      accessToken: token,
    })
    if (!prep.ok) {
      showToast?.(prep.message, 'error')
      return false
    }
    return updateJobStatus(jobId, 'ready_to_bill')
  }

  async function refreshInvoices() {
    if (role !== 'dev' && role !== 'master_technician' && role !== 'assistant') return
    const emptyPay = new Map<string, JobsLedgerPaymentRow[]>()
    const fetchInvoiceRows = async (status: string) => {
      const { data } = await supabase
        .from('jobs_ledger_invoices')
        .select(DASHBOARD_INVOICES_JOBS_LEDGER_SELECT)
        .eq('status', status)
        .order('created_at', { ascending: false })
      return (data ?? []) as DashboardInvoiceJoinRow[]
    }
    const fetchJobs = async (status: string) => {
      const { data } = await supabase.rpc('get_jobs_ledger_by_status', { p_status: status })
      return (data ?? []) as JobForDashboard[]
    }
    const [readyRows, billedRows, readyJobs, billedJobs] = await Promise.all([
      fetchInvoiceRows('ready_to_bill'),
      fetchInvoiceRows('billed'),
      fetchJobs('ready_to_bill'),
      fetchJobs('billed'),
    ])
    setReadyToBillInvoices(readyRows.map((r) => mapJoinedInvoiceToDashboard(r, emptyPay)))
    const jobIds = new Set<string>()
    for (const r of billedRows) jobIds.add(r.job_id)
    for (const j of billedJobs) jobIds.add(j.id)
    let payMap = emptyPay
    if (jobIds.size > 0) {
      const { data: payData } = await supabase.from('jobs_ledger_payments').select('*').in('job_id', [...jobIds])
      payMap = buildPaymentsByInvoiceIdMap((payData ?? []) as JobsLedgerPaymentRow[])
    }
    setWaitingForPaymentInvoices(billedRows.map((r) => mapJoinedInvoiceToDashboard(r, payMap)))
    setReadyToBillJobs(readyJobs)
    setWaitingForPaymentJobs(billedJobs)
  }

  resyncDashboardAfterUpdateJobStatusFailureRef.current = async () => {
    await refreshInvoices()
    const { data: assignedData } = await supabase.rpc('list_assigned_jobs_for_dashboard')
    if (assignedData) setAssignedJobs(assignedData as unknown as DashboardTeamAssignedJobRow[])
    if (isDashboardTeamReadyToBillRole(role)) {
      const { data: rtbAssignedData } = await supabase.rpc('list_ready_to_bill_assigned_jobs_for_dashboard')
      if (rtbAssignedData) setAssignedReadyToBillJobs(rtbAssignedData as unknown as DashboardTeamAssignedJobRow[])
    }
    if (role === 'superintendent') {
      const { data: superintendentData } = await supabase.rpc('list_superintendent_jobs_for_dashboard')
      if (superintendentData) setSuperintendentJobs(superintendentData as unknown as DashboardTeamAssignedJobRow[])
    }
  }

  const refreshInvoicesRef = useRef(refreshInvoices)
  refreshInvoicesRef.current = refreshInvoices

  const openReadyToBillEditJob = useCallback(
    (jobId: string) => {
      jobFormModal?.openEditJob(jobId, { onSaved: () => void refreshInvoicesRef.current() })
    },
    [jobFormModal],
  )

  const submitLinkJobPicturesDispatchRequest = useCallback(
    async (args: {
      jobId: string
      hcpNumber: string | null | undefined
      jobName: string | null | undefined
      jobAddress: string | null | undefined
    }) => {
      if (!authUser?.id) {
        showToast('Sign in to send to Dispatch.', 'error')
        return
      }
      const jobId = args.jobId.trim()
      if (!jobId) return
      const hcp = (args.hcpNumber ?? '').trim()
      const name = (args.jobName ?? '').trim() || 'Job'
      const address = (args.jobAddress ?? '').trim()
      try {
        const existing = await withSupabaseRetry<{ id: string } | null>(
          async () =>
            supabase
              .from('dispatch_requests')
              .select('id')
              .eq('job_ledger_id', jobId)
              .eq('pending_action', 'link_job_pictures')
              .eq('status', 'open')
              .limit(1)
              .maybeSingle(),
          'check existing link_job_pictures dispatch request',
        )
        if (existing?.id) {
          showToast('Already sent to Dispatch. They will add the folder soon.', 'info')
          return
        }
        const titlePrefix = hcp ? `HCP ${hcp} - ` : ''
        const title = `Add a Customer Pictures folder for ${titlePrefix}${name}`
        const referenceSummaryParts = [
          hcp ? `HCP ${hcp}` : null,
          name,
        ].filter(Boolean) as string[]
        const referenceHead = referenceSummaryParts.join(' | ')
        const referenceSummary = address ? `${referenceHead} - ${address}` : referenceHead
        const row = await withSupabaseRetry<{ id: string }>(
          async () =>
            supabase
              .from('dispatch_requests')
              .insert({
                from_user_id: authUser.id,
                title,
                links: [],
                job_ledger_id: jobId,
                bid_id: null,
                reference_summary: referenceSummary || null,
                pending_action: 'link_job_pictures',
              })
              .select('id')
              .single(),
          'insert link_job_pictures dispatch request',
        )
        if (!row?.id) {
          showToast('Could not send to Dispatch.', 'error')
          return
        }
        void supabase.functions.invoke('notify-dispatch-request', {
          body: { dispatch_request_id: row.id },
        })
        notifyDispatchRequestsChanged()
        showToast('Sent to Dispatch. They will add the customer pictures folder soon.', 'success')
      } catch (e) {
        showToast(formatErrorMessage(e, 'Failed to send to Dispatch'), 'error')
      }
    },
    [authUser?.id, showToast],
  )

  const openReadyToBillDetailJobModal = useCallback(
    (args: { jobId: string; hcpNumber: string; jobName: string; jobAddress: string }) => {
      const h = args.hcpNumber.trim() || '—'
      const n = args.jobName.trim() || 'Job'
      jobDetailModal?.openJobDetail({
        jobId: args.jobId,
        scheduleContext: null,
        prefillRowLabel: `${h} · ${n}`,
        prefillAddress: args.jobAddress.trim() || null,
        assignedJobsRows: readyToBillDetailModalAssignedRows,
        onEditJobSaved: () => void refreshInvoicesRef.current(),
      })
    },
    [jobDetailModal, readyToBillDetailModalAssignedRows],
  )

  useEffect(() => {
    if (!sendRecordJobMeta) return
    let cancelled = false
    void (async () => {
      try {
        type JobBillingRow = Pick<
          Database['public']['Tables']['jobs_ledger']['Row'],
          | 'id'
          | 'master_user_id'
          | 'customer_id'
          | 'customer_name'
          | 'customer_email'
          | 'customer_phone'
          | 'hcp_number'
          | 'job_name'
          | 'job_address'
          | 'last_work_date'
        >
        const data = await withSupabaseRetry<JobBillingRow | null>(
          async () =>
            supabase
              .from('jobs_ledger')
              .select(
                'id, master_user_id, customer_id, customer_name, customer_email, customer_phone, hcp_number, job_name, job_address, last_work_date',
              )
              .eq('id', sendRecordJobMeta.id)
              .maybeSingle(),
          'load job for send invoice modal',
        )
        if (cancelled) return
        if (!data) {
          showToast?.('Could not load job', 'error')
          setSendRecordJobMeta(null)
          return
        }
        if (!dashboardJobHasCustomerForBilling(data.customer_id)) {
          showToast?.('Link this job to a customer before billing.', 'error')
          setSendRecordJobMeta(null)
          return
        }
        const ctx: JobBillingContext = {
          id: data.id,
          master_user_id: data.master_user_id,
          customer_id: data.customer_id,
          customer_name: data.customer_name,
          customer_email: data.customer_email,
          hcp_number: data.hcp_number,
          job_name: data.job_name,
          job_address: data.job_address,
          customer_phone: data.customer_phone,
          last_work_date: data.last_work_date,
        }
        billCustomer?.openBillCustomer({
          payload: { kind: 'job', job: ctx },
          onSuccess: async () => {
            await refreshInvoicesRef.current()
          },
          onAfterEnsureSuccess: async () => {
            await refreshInvoicesRef.current()
          },
        })
        setSendRecordJobMeta(null)
      } catch (e) {
        if (cancelled) return
        showToast?.(e instanceof Error ? e.message : 'Could not load job', 'error')
        setSendRecordJobMeta(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sendRecordJobMeta?.id, showToast, billCustomer])

  function openDashboardBillCustomerInvoice(inv: InvoiceForDashboard) {
    billCustomer?.openBillCustomer({
      payload: {
        kind: 'invoice',
        job: jobBillingFromDashboardInvoice(inv),
        invoice: {
          id: inv.id,
          amount: inv.amount,
          status: inv.status,
          stripe_invoice_memo: inv.stripe_invoice_memo,
          is_primary_rtb_bundle: inv.is_primary_rtb_bundle,
        },
      },
      onSuccess: refreshInvoices,
      onAfterEnsureSuccess: refreshInvoices,
    })
  }

  function handlePrepareBillFromFieldQueue(jobId: string) {
    const resolved = resolveReadyToBillBillCustomerTarget(jobId, readyToBillDashboardUnits)
    if (resolved.mode === 'none') {
      showToast?.(
        'This job is not in Ready to Bill. Open Jobs or refresh the dashboard.',
        'error',
      )
      return
    }
    if (resolved.mode === 'ambiguous') {
      showToast?.(
        `Multiple Ready to Bill lines for this job (${resolved.count}). Use the Ready to Bill section to pick one.`,
        'error',
      )
      return
    }
    if (resolved.mode === 'job') {
      if (!dashboardJobHasCustomerForBilling(resolved.job.customer_id)) {
        showToast?.('Link this job to a customer before billing.', 'error')
        return
      }
      setSendRecordJobMeta({ id: jobId })
      return
    }
    if (!dashboardJobHasCustomerForBilling(resolved.inv.customer_id)) {
      showToast?.('Link this job to a customer before billing.', 'error')
      return
    }
    openDashboardBillCustomerInvoice(resolved.inv)
  }

  async function revertBilledDashboardInvoiceToReadyToBill(inv: InvoiceForDashboard): Promise<boolean> {
    if (!invoiceNeedsStripeVoidForRevert(inv)) {
      if (dashboardInvoiceMutationLockRef.current === inv.id) return false
      dashboardInvoiceMutationLockRef.current = inv.id
      setInvoiceStatusUpdatingId(inv.id)
      try {
        const data = await withSupabaseRetry(
          async () => await supabase.rpc('delete_billed_invoice_on_send_back', { p_invoice_id: inv.id }),
          'delete_billed_invoice_on_send_back',
        )
        const result = data as { ok?: boolean; deleted?: boolean; error?: string } | null
        if (!result?.ok) {
          showToast?.(result?.error ?? 'Failed to send back invoice', 'error')
          return false
        }
        const sync = await syncJobToReadyToBillIfNoBilledInvoicesRemain(supabase, inv.job_id)
        if (!sync.ok) {
          showToast?.(sync.message, 'error')
          return false
        }
        showToast?.('Invoice sent back', 'success')
        await refreshInvoices()
        return true
      } catch (e) {
        showToast?.(e instanceof Error ? e.message : 'Failed to send back invoice', 'error')
        return false
      } finally {
        setInvoiceStatusUpdatingId(null)
        if (dashboardInvoiceMutationLockRef.current === inv.id) {
          dashboardInvoiceMutationLockRef.current = null
        }
      }
    }
    if (dashboardInvoiceMutationLockRef.current === inv.id) return false
    dashboardInvoiceMutationLockRef.current = inv.id
    setInvoiceStatusUpdatingId(inv.id)
    try {
      const token = await getAccessTokenForEdgeFunctions()
      if (!token) {
        showToast?.('Not signed in', 'error')
        return false
      }
      const r = await invokeVoidStripeInvoiceForRevert({
        invoiceId: inv.id,
        stripeModeForBilling: stripeModeForBillingFromRole(role),
        accessToken: token,
      })
      if (!r.ok) {
        showToast?.(r.message, 'error')
        return false
      }
      const cleaned = await ensureLedgerInvoiceRemovedAfterStripeSendBack(inv.id)
      if (!cleaned.ok) {
        showToast?.(cleaned.message, 'error')
        return false
      }
      const sync = await syncJobToReadyToBillIfNoBilledInvoicesRemain(supabase, inv.job_id)
      if (!sync.ok) {
        showToast?.(sync.message, 'error')
        return false
      }
      showToast?.('Invoice sent back', 'success')
      await refreshInvoices()
      return true
    } finally {
      setInvoiceStatusUpdatingId(null)
      if (dashboardInvoiceMutationLockRef.current === inv.id) {
        dashboardInvoiceMutationLockRef.current = null
      }
    }
  }

  async function deleteInvoice(invoiceId: string) {
    if (dashboardInvoiceMutationLockRef.current === invoiceId) return
    dashboardInvoiceMutationLockRef.current = invoiceId
    setInvoiceStatusUpdatingId(invoiceId)
    try {
      const data = await withSupabaseRetry(
        async () => await supabase.rpc('delete_ready_to_bill_invoice', { p_invoice_id: invoiceId }),
        'delete_ready_to_bill_invoice',
      )
      const result = data as { ok?: boolean; deleted?: boolean; error?: string } | null
      if (!result?.ok) {
        showToast?.(result?.error ?? 'Failed to remove invoice', 'error')
        return
      }
      if (result.deleted === true) {
        showToast?.('Invoice removed', 'success')
      }
      await refreshInvoices()
    } catch (e) {
      showToast?.(e instanceof Error ? e.message : 'Failed to remove invoice', 'error')
    } finally {
      setInvoiceStatusUpdatingId(null)
      if (dashboardInvoiceMutationLockRef.current === invoiceId) {
        dashboardInvoiceMutationLockRef.current = null
      }
    }
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
    if (!authUser?.id || !isDev) return
    setCompletedItemsLoading(true)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    Promise.all([
      supabase
        .from('checklist_instances')
        .select('id, checklist_item_id, scheduled_date, completed_at, completed_by_user_id, checklist_items(title, links), checklist_instance_assignees(user_id)')
        .not('completed_at', 'is', null)
        .gte('completed_at', sevenDaysAgo)
        .order('completed_at', { ascending: false }),
      supabase
        .from('dev_read_completed_items')
        .select('checklist_instance_id')
        .eq('dev_user_id', authUser.id),
      supabase
        .from('dev_ignored_checklist_items')
        .select('checklist_item_id')
        .eq('dev_user_id', authUser.id),
    ]).then(async ([instRes, readRes, ignoredRes]) => {
      if (instRes.error) {
        setCompletedItemsLoading(false)
        return
      }
      const instances = (instRes.data ?? []) as ChecklistInstance[]
      const userIds = new Set<string>()
      instances.forEach((i) => {
        ;(i.checklist_instance_assignees ?? []).forEach((a) => userIds.add(a.user_id))
        if (i.completed_by_user_id) userIds.add(i.completed_by_user_id)
      })
      const userMap = new Map<string, string>()
      if (userIds.size > 0) {
        const { data: usersData } = await supabase.from('users').select('id, name, email').in('id', Array.from(userIds))
        ;(usersData ?? []).forEach((u: { id: string; name: string | null; email: string | null }) => {
          userMap.set(u.id, u.name || u.email || 'Unknown')
        })
      }
      setCompletedItems(instances)
      setCompletedItemsUserMap(userMap)
      const readSet = new Set<string>()
      ;(readRes.data ?? []).forEach((r: { checklist_instance_id: string }) => readSet.add(r.checklist_instance_id))
      setReadInstanceIds(readSet)
      const ignoredSet = new Set<string>()
      ;(ignoredRes.data ?? []).forEach((r: { checklist_item_id: string }) => ignoredSet.add(r.checklist_item_id))
      setIgnoredItemIds(ignoredSet)
      if (instances.length > 0) {
        const completerIds = new Set(instances.map((i) => i.completed_by_user_id).filter(Boolean) as string[])
        setExpandedCompleterIds((prev) => (prev.size === 0 ? completerIds : prev))
      }
      setCompletedItemsLoading(false)
    })
  }, [authUser?.id, isDev])

  async function markCompletedItemAsRead(inst: ChecklistInstance) {
    if (!authUser?.id || markingReadId) return
    setMarkingReadId(inst.id)
    await supabase.from('dev_read_completed_items').insert({
      dev_user_id: authUser.id,
      checklist_instance_id: inst.id,
    })
    setMarkingReadId(null)
    setReadInstanceIds((prev) => new Set(prev).add(inst.id))
  }

  async function markCompletedItemAsUnread(inst: ChecklistInstance) {
    if (!authUser?.id || markingUnreadId) return
    setMarkingUnreadId(inst.id)
    await supabase.from('dev_read_completed_items').delete().eq('dev_user_id', authUser.id).eq('checklist_instance_id', inst.id)
    setMarkingUnreadId(null)
    setReadInstanceIds((prev) => {
      const next = new Set(prev)
      next.delete(inst.id)
      return next
    })
  }

  async function ignoreTaskType(checklistItemId: string) {
    if (!authUser?.id || ignoringItemId) return
    setIgnoringItemId(checklistItemId)
    await supabase.from('dev_ignored_checklist_items').insert({
      dev_user_id: authUser.id,
      checklist_item_id: checklistItemId,
    })
    setIgnoringItemId(null)
    setIgnoredItemIds((prev) => new Set(prev).add(checklistItemId))
  }

  async function unignoreTaskType(checklistItemId: string) {
    if (!authUser?.id || ignoringItemId) return
    setIgnoringItemId(checklistItemId)
    await supabase.from('dev_ignored_checklist_items').delete().eq('dev_user_id', authUser.id).eq('checklist_item_id', checklistItemId)
    setIgnoringItemId(null)
    setIgnoredItemIds((prev) => {
      const next = new Set(prev)
      next.delete(checklistItemId)
      return next
    })
  }

  async function loadAssignedSteps() {
    if (!authUser?.id) return
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', authUser.id)
      .single()
    const name = (userData as { name: string | null } | null)?.name ?? null

    if (!name) return

    const withProjectsRes = await supabase.rpc('get_assigned_steps_with_projects_for_dashboard', { p_user_name: name })
      if (!withProjectsRes.error && Array.isArray(withProjectsRes.data)) {
        const assigned = withProjectsRes.data as AssignedStep[]
        if (assigned.length > 0) {
          setAssignedSteps(assigned)
        } else {
          setAssignedSteps([])
        }
        return
      }
      const rpcRes = await supabase.rpc('get_assigned_steps_for_dashboard', { p_user_name: name })
      let steps: Step[] = []
      if (rpcRes.error?.message?.includes('Could not find the function')) {
        const { data } = await supabase
          .from('project_workflow_steps')
          .select('*')
          .eq('assigned_to_name', name)
          .order('created_at', { ascending: false })
          .limit(100)
        steps = (data ?? []) as Step[]
      } else {
        steps = (rpcRes.data ?? []) as Step[]
      }
      if (steps.length > 0) {
        const workflowIds = [...new Set(steps.map((s) => s.workflow_id))]
        const { data: workflows } = await supabase
          .from('project_workflows')
          .select('id, project_id')
          .in('id', workflowIds)
        
        if (workflows) {
          const projectIds = [...new Set(workflows.map((w) => w.project_id))]
          const { data: projects } = await supabase
            .from('projects')
            .select('id, name, address, plans_link')
            .in('id', projectIds)
          
          if (projects) {
            const workflowToProject = new Map<string, string>()
            workflows.forEach((w) => workflowToProject.set(w.id, w.project_id))
            const projectMap = new Map<string, { name: string; address: string | null; plans_link: string | null }>()
            projects.forEach((p) => projectMap.set(p.id, { name: p.name, address: p.address, plans_link: p.plans_link }))
            
            const assigned: AssignedStep[] = steps.map((step) => {
              const projectId = workflowToProject.get(step.workflow_id) ?? ''
              const project = projectId ? (projectMap.get(projectId) ?? null) : null
              return {
                ...step,
                project_id: projectId,
                project_name: project?.name ?? '',
                project_address: project?.address ?? null,
                project_plans_link: project?.plans_link ?? null,
                project_superintendent_names: null,
                workflow_id: step.workflow_id,
              }
            })
            setAssignedSteps(assigned)
          } else {
            setAssignedSteps([])
          }
        } else {
          setAssignedSteps([])
        }
      } else {
        setAssignedSteps([])
      }
  }

  async function loadTodayChecklist() {
    if (!authUser?.id) return
    const today = toLocalDateString(new Date())
    const { data: todayData } = await supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, completed_at, notes, completed_by_user_id, created_at, checklist_items(title, links, notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id), checklist_instance_assignees!inner(user_id)')
      .eq('checklist_instance_assignees.user_id', authUser.id)
      .eq('scheduled_date', today)
      .order('created_at', { ascending: true })
    const { data: itemsData } = await supabase
      .from('checklist_items')
      .select('id')
      .eq('show_until_completed', true)
    const itemIds = (itemsData ?? []).map((i) => i.id)
    let overdueData: ChecklistInstance[] = []
    if (itemIds.length > 0) {
      const { data } = await supabase
        .from('checklist_instances')
        .select('id, checklist_item_id, scheduled_date, completed_at, notes, completed_by_user_id, created_at, checklist_items(title, links, notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id), checklist_instance_assignees!inner(user_id)')
        .eq('checklist_instance_assignees.user_id', authUser.id)
        .is('completed_at', null)
        .lt('scheduled_date', today)
        .in('checklist_item_id', itemIds)
        .order('scheduled_date', { ascending: true })
      overdueData = (data ?? []) as ChecklistInstance[]
    }
    const merged = [...overdueData, ...(todayData ?? [])]
    merged.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    setTodayChecklist(merged as ChecklistInstance[])
  }

  async function loadOutstanding() {
    if (!authUser?.id) return
    setOutstandingLoading(true)
    const { data, error } = await supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, completed_at, notes, completed_by_user_id, created_at, checklist_items(title, links, repeat_type), checklist_instance_assignees!inner(user_id)')
      .eq('checklist_instance_assignees.user_id', authUser.id)
      .is('completed_at', null)
      .order('scheduled_date', { ascending: true })
    if (error) {
      setOutstandingLoading(false)
      return
    }
    const raw = (data ?? []) as Array<{
      id: string
      checklist_item_id: string
      scheduled_date: string
      completed_at: string | null
      notes: string | null
      completed_by_user_id: string | null
      created_at: string | null
      checklist_items?: { title?: string; links?: string[] | null; repeat_type?: string } | null
      checklist_instance_assignees?: Array<{ user_id: string }>
    }>
    const instances = raw.filter((inst) => {
      const assignees = inst.checklist_instance_assignees ?? []
      return assignees.length > 0 && (inst.checklist_items as { repeat_type?: string } | null)?.repeat_type === 'once'
    })
    const itemIds = [...new Set(instances.map((i) => i.checklist_item_id))]
    const orderMap = new Map<string, number>()
    if (itemIds.length > 0) {
      const { data: orderData } = await supabase
        .from('checklist_item_assignees')
        .select('checklist_item_id, display_order')
        .eq('user_id', authUser.id)
        .in('checklist_item_id', itemIds)
      for (const row of (orderData ?? []) as Array<{ checklist_item_id: string; display_order: number | null }>) {
        orderMap.set(row.checklist_item_id, row.display_order ?? 999999)
      }
    }
    const sorted = [...instances].sort((a, b) => {
      const orderA = orderMap.get(a.checklist_item_id) ?? 999999
      const orderB = orderMap.get(b.checklist_item_id) ?? 999999
      if (orderA !== orderB) return orderA - orderB
      return a.scheduled_date.localeCompare(b.scheduled_date)
    })
    setOutstandingItems((sorted.slice(0, 10) as unknown) as ChecklistInstance[])
    setOutstandingLoading(false)
  }

  async function toggleChecklistComplete(inst: ChecklistInstance) {
    if (!authUser?.id) return
    if (checklistToggleInFlightRef.current.has(inst.id)) return
    checklistToggleInFlightRef.current.add(inst.id)

    const isCompleted = !!inst.completed_at
    const nextCompletedAt = isCompleted ? null : new Date().toISOString()
    const nextCompletedBy = isCompleted ? null : authUser.id
    const previous = inst

    setTodayChecklist((prev) =>
      prev.map((row) =>
        row.id === inst.id
          ? { ...row, completed_at: nextCompletedAt, completed_by_user_id: nextCompletedBy }
          : row,
      ),
    )

    try {
      const { error: e } = await supabase
        .from('checklist_instances')
        .update({
          completed_at: nextCompletedAt,
          completed_by_user_id: nextCompletedBy,
        })
        .eq('id', inst.id)
      if (e) throw e
      await loadTodayChecklist()
      if (!isCompleted) {
        void sendChecklistCompletionNotifications(inst)
        void maybeCreateNextChecklistInstance(inst)
      }
    } catch (e: unknown) {
      setTodayChecklist((prev) => prev.map((row) => (row.id === inst.id ? previous : row)))
      showToast(formatErrorMessage(e, 'Could not update checklist'), 'error')
    } finally {
      checklistToggleInFlightRef.current.delete(inst.id)
    }
  }

  async function toggleOutstandingComplete(inst: ChecklistInstance) {
    if (!authUser?.id) return
    if (outstandingToggleInFlightRef.current.has(inst.id)) return
    const isCompleted = !!inst.completed_at
    if (isCompleted) {
      return
    }

    outstandingToggleInFlightRef.current.add(inst.id)
    let snapshot: ChecklistInstance[] = []
    setOutstandingItems((prev) => {
      snapshot = prev
      return prev.filter((row) => row.id !== inst.id)
    })

    try {
      const { error: e } = await supabase
        .from('checklist_instances')
        .update({
          completed_at: new Date().toISOString(),
          completed_by_user_id: authUser.id,
        })
        .eq('id', inst.id)
      if (e) throw e
      await loadOutstanding()
      void sendChecklistCompletionNotifications(inst)
      void maybeCreateNextChecklistInstance(inst)
    } catch (e: unknown) {
      setOutstandingItems(snapshot)
      showToast(formatErrorMessage(e, 'Could not update checklist'), 'error')
    } finally {
      outstandingToggleInFlightRef.current.delete(inst.id)
    }
  }

  function isNotificationRecipient(inst: ChecklistInstance): boolean {
    if (!authUser?.id) return false
    const item = inst.checklist_items as {
      notify_on_complete_user_id?: string | null
      notify_creator_on_complete?: boolean
      created_by_user_id?: string | null
    } | null
    if (!item) return false
    if (item.notify_on_complete_user_id === authUser.id) return true
    if (item.notify_creator_on_complete && item.created_by_user_id === authUser.id) return true
    return false
  }

  function openMuteModal(inst: ChecklistInstance) {
    const title = (inst.checklist_items as { title: string } | null)?.title ?? 'Untitled'
    setMuteModalItemId(inst.checklist_item_id)
    setMuteModalTitle(title)
  }

  function openFwd(inst: ChecklistInstance) {
    const title = (inst.checklist_items as { title: string } | null)?.title ?? 'Untitled'
    setFwdInstance(inst)
    setFwdTitle(title)
    setFwdAssigneeId('')
  }

  async function saveFwd() {
    if (!fwdInstance || !authUser?.id || !fwdTitle.trim() || !fwdAssigneeId) return
    setFwdSaving(true)
    setUserError(null)
    try {
      const { data: sourceItem } = await supabase
        .from('checklist_items')
        .select('notify_on_complete_user_id, notify_creator_on_complete, reminder_time, reminder_scope, show_until_completed')
        .eq('id', fwdInstance.checklist_item_id)
        .single()
      const src = sourceItem as { notify_on_complete_user_id: string | null; notify_creator_on_complete: boolean; reminder_time: string | null; reminder_scope: string | null; show_until_completed?: boolean } | null
      const { data: newItem, error: itemErr } = await supabase
        .from('checklist_items')
        .insert({
          title: fwdTitle.trim(),
          created_by_user_id: authUser.id,
          repeat_type: 'once',
          start_date: fwdInstance.scheduled_date,
          show_until_completed: src?.show_until_completed ?? true,
          notify_on_complete_user_id: src?.notify_on_complete_user_id ?? null,
          notify_creator_on_complete: src?.notify_creator_on_complete ?? false,
          reminder_time: src?.reminder_time ?? null,
          reminder_scope: src?.reminder_scope ?? null,
        })
        .select('id')
        .single()
      if (itemErr) throw itemErr
      if (newItem?.id && fwdAssigneeId) {
        const nextOrders = await getNextDisplayOrders([fwdAssigneeId])
        await supabase.from('checklist_item_assignees').insert({
          checklist_item_id: newItem.id,
          user_id: fwdAssigneeId,
          display_order: nextOrders.get(fwdAssigneeId) ?? 1,
        })
        const { data: newInst } = await supabase
          .from('checklist_instances')
          .insert({ checklist_item_id: newItem.id, scheduled_date: fwdInstance.scheduled_date })
          .select('id')
          .single()
        if (newInst?.id) {
          await supabase.from('checklist_instance_assignees').insert({ checklist_instance_id: newInst.id, user_id: fwdAssigneeId })
        }
        await supabase.from('checklist_instances').delete().eq('id', fwdInstance.id)
      }
      setFwdInstance(null)
      await loadTodayChecklist()
      await loadOutstanding()
    } catch (err: unknown) {
      setUserError(err instanceof Error ? err.message : 'Failed to forward')
    } finally {
      setFwdSaving(false)
    }
  }

  async function sendChecklistCompletionNotifications(inst: ChecklistInstance) {
    const { data: item } = await supabase
      .from('checklist_items')
      .select('notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id, title')
      .eq('id', inst.checklist_item_id)
      .single()
    if (!item) return
    const title = (item as { title: string }).title
    const assigneeName = await getCurrentUserName()
    const body = `${assigneeName} completed: ${title}`
    const recipients: string[] = []
    const notifyUserId = (item as { notify_on_complete_user_id: string | null }).notify_on_complete_user_id
    if (notifyUserId) recipients.push(notifyUserId)
    const notifyCreator = (item as { notify_creator_on_complete: boolean }).notify_creator_on_complete
    const creatorId = (item as { created_by_user_id: string }).created_by_user_id
    if (notifyCreator && creatorId && !recipients.includes(creatorId)) recipients.push(creatorId)
    for (const uid of recipients) {
      try {
        await supabase.functions.invoke('send-checklist-notification', {
          body: {
            recipient_user_id: uid,
            push_title: 'Checklist completed',
            push_body: body,
            push_url: '/checklist',
            tag: `checklist-${inst.id}`,
          },
        })
      } catch {
        // ignore
      }
    }
  }

  async function maybeCreateNextChecklistInstance(inst: ChecklistInstance) {
    const { data: item } = await supabase
      .from('checklist_items')
      .select('repeat_type, repeat_days_after, repeat_end_date')
      .eq('id', inst.checklist_item_id)
      .single()
    if (!item) return
    const rt = (item as { repeat_type: string }).repeat_type
    if (rt !== 'days_after_completion') return
    const daysAfter = (item as { repeat_days_after: number | null }).repeat_days_after
    if (!daysAfter) return
    const endDate = (item as { repeat_end_date: string | null }).repeat_end_date
    const nextDate = new Date(inst.scheduled_date)
    nextDate.setDate(nextDate.getDate() + daysAfter)
    const nextDateStr = toLocalDateString(nextDate)
    if (endDate && nextDateStr > endDate) return
    const existing = await supabase
      .from('checklist_instances')
      .select('id')
      .eq('checklist_item_id', inst.checklist_item_id)
      .eq('scheduled_date', nextDateStr)
      .single()
    if (existing.data) return
    const { data: assignees } = await supabase
      .from('checklist_item_assignees')
      .select('user_id')
      .eq('checklist_item_id', inst.checklist_item_id)
    const assigneeIds = (assignees ?? []).map((r: { user_id: string }) => r.user_id)
    if (assigneeIds.length === 0) return
    const { data: newInst } = await supabase
      .from('checklist_instances')
      .insert({ checklist_item_id: inst.checklist_item_id, scheduled_date: nextDateStr })
      .select('id')
      .single()
    if (newInst?.id) {
      await supabase.from('checklist_instance_assignees').insert(
        assigneeIds.map((uid) => ({ checklist_instance_id: newInst.id, user_id: uid }))
      )
    }
  }

  async function getCurrentUserName(): Promise<string> {
    if (!authUser?.id) return 'Unknown'
    const { data: userData } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', authUser.id)
      .single()
    return (userData as { name: string | null; email: string | null } | null)?.name || (userData as { email: string | null } | null)?.email || 'Unknown'
  }

  async function recordAction(stepId: string, actionType: 'started' | 'completed' | 'approved' | 'rejected' | 'reopened' | 'skipped', notes?: string | null) {
    const performedBy = await getCurrentUserName()
    const performedAt = new Date().toISOString()
    await supabase
      .from('project_workflow_step_actions')
      .insert({
        step_id: stepId,
        action_type: actionType,
        performed_by: performedBy,
        performed_at: performedAt,
        notes: notes || null,
      })
  }

  async function findPreviousStep(step: AssignedStep): Promise<AssignedStep | null> {
    const { data: allStepsData } = await supabase
      .from('project_workflow_steps')
      .select('*')
      .eq('workflow_id', step.workflow_id)
      .order('sequence_order', { ascending: true })
    const allSteps = (allStepsData ?? []) as Step[]
    if (allSteps.length === 0) return null
    
    const sortedSteps = allSteps.sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
    const currentIndex = sortedSteps.findIndex((s) => s.id === step.id)
    if (currentIndex <= 0) return null
    
    const previousStep = sortedSteps[currentIndex - 1]
    // Find the project info for the previous step
    const { data: workflow } = await supabase
      .from('project_workflows')
      .select('project_id')
      .eq('id', step.workflow_id)
      .single()
    
    if (workflow) {
      const { data: project } = await supabase
        .from('projects')
        .select('id, name, address, plans_link')
        .eq('id', workflow.project_id)
        .single()
      
      if (project) {
        return {
          ...previousStep,
          project_id: project.id,
          project_name: project.name,
          project_address: project.address,
          project_plans_link: project.plans_link,
          project_superintendent_names: null,
          workflow_id: step.workflow_id,
        } as AssignedStep
      }
    }
    
    return null
  }

  async function findNextStep(step: AssignedStep): Promise<AssignedStep | null> {
    const { data: allStepsData } = await supabase
      .from('project_workflow_steps')
      .select('*')
      .eq('workflow_id', step.workflow_id)
      .order('sequence_order', { ascending: true })
    const allSteps = (allStepsData ?? []) as Step[]
    if (allSteps.length === 0) return null
    
    const sortedSteps = allSteps.sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
    const currentIndex = sortedSteps.findIndex((s) => s.id === step.id)
    if (currentIndex < 0 || currentIndex >= sortedSteps.length - 1) return null
    
    const nextStep = sortedSteps[currentIndex + 1]
    // Find the project info for the next step
    const { data: workflow } = await supabase
      .from('project_workflows')
      .select('project_id')
      .eq('id', step.workflow_id)
      .single()
    
    if (workflow) {
      const { data: project } = await supabase
        .from('projects')
        .select('id, name, address, plans_link')
        .eq('id', workflow.project_id)
        .single()
      
      if (project) {
        return {
          ...nextStep,
          project_id: project.id,
          project_name: project.name,
          project_address: project.address,
          project_plans_link: project.plans_link,
          project_superintendent_names: null,
          workflow_id: step.workflow_id,
        } as AssignedStep
      }
    }
    
    return null
  }

  async function markStarted(step: AssignedStep, startDateTime?: string) {
    const startedAt = startDateTime ? fromDatetimeLocal(startDateTime) : new Date().toISOString()
    const st = await supabase
      .from('project_workflow_steps')
      .update({ started_at: startedAt, status: 'in_progress' })
      .eq('id', step.id)
      .select('id')
    const stRows = Array.isArray(st.data) ? st.data.length : 0
    if (st.error || stRows === 0) {
      showToast(st.error?.message ?? 'Could not start this stage. Try again or contact the office.', 'error')
      return
    }
    await recordAction(step.id, 'started')
    await loadAssignedSteps()
  }

  async function submitSetStart() {
    if (!setStartStep) return
    await markStarted(setStartStep.step, setStartStep.startDateTime)
    setSetStartStep(null)
  }

  async function markCompleted(step: AssignedStep) {
    const upd1 = await supabase
      .from('project_workflow_steps')
      .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
      .eq('id', step.id)
      .select('id')
    const rowsAffected = Array.isArray(upd1.data) ? upd1.data.length : upd1.data ? 1 : 0
    if (upd1.error || rowsAffected === 0) {
      showToast(
        upd1.error?.message ?? 'Could not mark this stage complete. Try again or contact the office.',
        'error',
      )
      return
    }
    await recordAction(step.id, 'completed')
    
    // Check if next step is rejected and reopen it
    const nextStep = await findNextStep(step)
    if (nextStep && nextStep.status === 'rejected') {
      // Clear the notice and rejection reason from current step if they were set
      if (step.next_step_rejected_notice) {
        await supabase.from('project_workflow_steps').update({ 
          next_step_rejected_notice: null,
          next_step_rejection_reason: null,
        }).eq('id', step.id)
      }
      // Reopen the rejected next step
      await supabase.from('project_workflow_steps').update({
        status: 'pending',
        rejection_reason: null,
        ended_at: null,
      }).eq('id', nextStep.id)
      await recordAction(nextStep.id, 'reopened', 'Previous step was re-completed')
    }

    await loadAssignedSteps()
  }

  async function markApproved(step: AssignedStep) {
    const approvedByName = await getCurrentUserName()
    const approvedAt = new Date().toISOString()
    await supabase.from('project_workflow_steps').update({
      status: 'approved',
      ended_at: approvedAt,
      approved_by: approvedByName,
      approved_at: approvedAt,
    }).eq('id', step.id)
    await recordAction(step.id, 'approved')
    
    // Check if next step is rejected and reopen it
    const nextStep = await findNextStep(step)
    if (nextStep && nextStep.status === 'rejected') {
      // Clear the notice and rejection reason from current step if they were set
      if (step.next_step_rejected_notice) {
        await supabase.from('project_workflow_steps').update({ 
          next_step_rejected_notice: null,
          next_step_rejection_reason: null,
        }).eq('id', step.id)
      }
      // Reopen the rejected next step
      await supabase.from('project_workflow_steps').update({
        status: 'pending',
        rejection_reason: null,
        ended_at: null,
      }).eq('id', nextStep.id)
      await recordAction(nextStep.id, 'reopened', 'Previous step was re-approved')
    }
    
    await loadAssignedSteps()
  }

  async function submitReject() {
    if (!rejectStep) return
    await supabase.from('project_workflow_steps').update({
      status: 'rejected',
      rejection_reason: rejectStep.reason.trim() || null,
      ended_at: new Date().toISOString(),
    }).eq('id', rejectStep.step.id)
    await recordAction(rejectStep.step.id, 'rejected', rejectStep.reason.trim() || null)
    
    // Find previous step and reopen it if it's completed/approved, or set notice if already pending/in_progress
    const previousStep = await findPreviousStep(rejectStep.step)
    const rejectionReason = rejectStep.reason.trim() || null
    if (previousStep) {
      if (previousStep.status === 'completed' || previousStep.status === 'approved') {
        // Reopen the previous step with notice and rejection reason
        await supabase.from('project_workflow_steps').update({
          status: 'pending',
          ended_at: null,
          approved_by: null,
          approved_at: null,
          next_step_rejected_notice: rejectStep.step.name,
          next_step_rejection_reason: rejectionReason,
        }).eq('id', previousStep.id)
        await recordAction(previousStep.id, 'reopened', `Next step "${rejectStep.step.name}" was rejected`)
      } else if (previousStep.status === 'pending' || previousStep.status === 'in_progress') {
        // Previous step is already pending/in_progress, just set the notice and rejection reason
        await supabase.from('project_workflow_steps').update({ 
          next_step_rejected_notice: rejectStep.step.name,
          next_step_rejection_reason: rejectionReason,
        }).eq('id', previousStep.id)
      }
    }
    
    setRejectStep(null)
    await loadAssignedSteps()
  }

  async function submitSkip() {
    if (!skipStep || !skipStep.reason.trim()) return
    await supabase.from('project_workflow_steps').update({
      status: 'skipped',
      skipped_reason: skipStep.reason.trim(),
      ended_at: new Date().toISOString(),
    }).eq('id', skipStep.step.id)
    await recordAction(skipStep.step.id, 'skipped', skipStep.reason.trim())
    setSkipStep(null)
    await loadAssignedSteps()
  }

  function toggleExpandEstimatorRequest(requestId: string) {
    setExpandedEstimatorRequestId((prev) => (prev === requestId ? null : requestId))
  }

  async function submitEstimatorNote(requestId: string) {
    if (!authUser?.id) return
    const body = estimatorNoteDraft.trim()
    if (!body) {
      showToast('Enter a note.', 'error')
      return
    }
    if (body.length > 2000) {
      showToast('Note must be 2000 characters or less.', 'error')
      return
    }

    let wasClosed = false
    const row = estimatorRequests.find((r) => r.id === requestId)
    if (row) {
      wasClosed = row.status === 'closed'
    } else {
      const { data: statusRow, error: statusErr } = await supabase
        .from('estimator_requests')
        .select('status')
        .eq('id', requestId)
        .maybeSingle()
      if (statusErr) {
        showToast(statusErr.message, 'error')
        return
      }
      wasClosed = statusRow?.status === 'closed'
    }

    setEstimatorNoteSubmitRequestId(requestId)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('estimator_request_notes').insert({
            request_id: requestId,
            author_user_id: authUser.id,
            body,
          }),
        'insert estimator_request note',
      )

      if (wasClosed) {
        try {
          await withSupabaseRetry(
            async () =>
              supabase
                .from('estimator_requests')
                .update({
                  status: 'open',
                  closed_at: null,
                  closed_by_user_id: null,
                  closed_note: null,
                })
                .eq('id', requestId),
            'reopen estimator request',
          )
        } catch (reopenErr) {
          setEstimatorNoteDraft('')
          await loadEstimatorNotesForRequest(requestId)
          loadEstimatorRequests()
          showToast(formatErrorMessage(reopenErr, 'Note saved, but reopen failed.'), 'error')
          return
        }
      }

      setEstimatorNoteDraft('')
      await loadEstimatorNotesForRequest(requestId)
      loadEstimatorRequests()
      showToast(wasClosed ? 'Note added and task reopened.' : 'Note added.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to add note'), 'error')
    } finally {
      setEstimatorNoteSubmitRequestId(null)
    }
  }

  async function submitEstimatorNoteAndClose(requestId: string) {
    if (!authUser?.id) return
    const body = estimatorNoteDraft.trim()
    if (!body) {
      showToast('Enter a note.', 'error')
      return
    }
    if (body.length > 2000) {
      showToast('Note must be 2000 characters or less.', 'error')
      return
    }

    const row = estimatorRequests.find((r) => r.id === requestId)
    if (row?.status === 'closed') {
      showToast('This request is already closed.', 'error')
      return
    }

    setEstimatorNoteSubmitRequestId(requestId)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('estimator_request_notes').insert({
            request_id: requestId,
            author_user_id: authUser.id,
            body,
          }),
        'insert estimator_request note',
      )

      try {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('estimator_requests')
              .update({
                status: 'closed',
                closed_at: new Date().toISOString(),
                closed_by_user_id: authUser.id,
                closed_note: body,
              })
              .eq('id', requestId),
          'close estimator request',
        )
      } catch (closeErr) {
        setEstimatorNoteDraft('')
        await loadEstimatorNotesForRequest(requestId)
        loadEstimatorRequests()
        showToast(formatErrorMessage(closeErr, 'Note saved, but mark closed failed.'), 'error')
        return
      }

      setEstimatorNoteDraft('')
      await loadEstimatorNotesForRequest(requestId)
      loadEstimatorRequests()
      showToast('Note added and request marked closed.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to add note'), 'error')
    } finally {
      setEstimatorNoteSubmitRequestId(null)
    }
  }

  async function dismissEstimatorRequest(requestId: string) {
    if (!authUser?.id) return
    setEstimatorRequestDismissingId(requestId)
    const { error } = await supabase.from('estimator_request_dismissals').insert({
      user_id: authUser.id,
      request_id: requestId,
    })
    setEstimatorRequestDismissingId(null)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    setEstimatorRequests((prev) => prev.filter((r) => r.id !== requestId))
    setExpandedEstimatorRequestId((ex) => (ex === requestId ? null : ex))
  }

  const showChecklist = checklistLoading || todayChecklist.length > 0
  const showAssigned = assignedLoading || assignedSteps.length > 0

  const activeAssignedSteps = useMemo(
    () => assignedSteps.filter((s) => s.status !== 'completed'),
    [assignedSteps],
  )
  const completedAssignedSteps = useMemo(
    () => assignedSteps.filter((s) => s.status === 'completed'),
    [assignedSteps],
  )

  useEffect(() => {
    if (assignedStagesExpandedDefaultAppliedRef.current) return
    if (assignedLoading) return
    assignedStagesExpandedDefaultAppliedRef.current = true
    const hasInProgress = assignedSteps.some((s) => s.status === 'in_progress')
    setAssignedStagesExpanded(hasInProgress)
  }, [assignedLoading, assignedSteps])

  const showSubscribed = role === 'dev' || role === 'master_technician' || role === 'assistant'
  const showRecent = role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary'
  const showFinancials = role === 'dev' || role === 'master_technician' || role === 'assistant'

  const showDashboardQuickButtons = role === 'dev' || role === 'master_technician' || role === 'assistant'
  const quickActionLinkStyle: CSSProperties = {
    padding: '0.75rem 1.25rem',
    background: '#3b82f6',
    color: 'white',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '1rem',
  }
  /** Pinned-row chips share the quick-button look; slightly tighter padding so many pins still fit one row. */
  const pinnedItemLinkStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    padding: '0.5rem 1rem',
    fontSize: '0.9375rem',
    fontWeight: 600,
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    textDecoration: 'none',
  }
  const quickActionDefs = useMemo(() => {
    if (!showDashboardQuickButtons || role === null) {
      return [] as Array<{ key: string; label: string; to: string }>
    }
    return [
      { key: 'job', label: 'Job', to: '/jobs?tab=billing&newJob=true' },
      { key: 'job_labor', label: 'Job Labor', to: '/jobs?tab=sub_sheet_ledger&newJob=true' },
      { key: 'bid', label: 'Bid', to: '/bids?new=true' },
      { key: 'project', label: 'Project', to: '/projects/new' },
      { key: 'part', label: 'Part', to: '/materials?tab=parts-book&addPart=true' },
      { key: 'assembly', label: 'Assembly', to: '/materials?tab=assembly-book&addAssembly=true' },
      { key: 'prospect', label: 'Prospect', to: '/prospects?newProspect=true' },
      { key: 'inspections', label: 'Inspections', to: '/jobs?tab=inspections' },
      { key: 'builder_review', label: 'Builder Review', to: '/bids?tab=builder-review' },
    ]
      .filter((b) => (b.key === 'builder_review' ? role === 'master_technician' : true))
      .filter((b) => dashboardButtonVisibility?.[b.key] !== false)
  }, [showDashboardQuickButtons, role, dashboardButtonVisibility])

  const showPinnedRowWithQuickActions =
    pinsToShow.length > 0 || isDev || (quickButtonsPlacement === 'with_pins' && showDashboardQuickButtons)

  const tallyLinkAccessibleName =
    typeof tallyUnlinkedCount === 'number' && tallyUnlinkedCount > 0
      ? `Job Parts Tally, ${tallyUnlinkedCount} unlinked transaction${tallyUnlinkedCount === 1 ? '' : 's'}`
      : 'Job Parts Tally'

  const tallyAndPinnedBlock = (
    <>
      {arBankCountEnabled && (
        <DashboardArBankUnallocatedBanner
          count={arBankUnallocatedCount ?? 0}
          loading={arBankUnallocatedCount === null}
          onGoToAr={() => {
            showToast('Opening Accounts Receivable…', 'info', 2800)
            navigate('/accounts-receivable')
          }}
        />
      )}
      {role != null && (
        <DashboardTallyStaleBanner
          staleCount={typeof tallyStaleUnlinkedCount === 'number' ? tallyStaleUnlinkedCount : 0}
          loading={tallyStaleUnlinkedCount === null}
          minAgeDays={TALLY_STALE_MIN_AGE_DAYS}
          onGoToTally={() => navigate('/tally?tab=transactions')}
        />
      )}
      <DashboardLostBidsMissingReasonBanner
        count={lostMissingLossReasonCount}
        loading={lostMissingLossReasonLoading}
        onGoToLostSummary={() => {
          if (!authUser?.id) return
          navigate(
            `/bids?tab=bid-board&lostSummary=1&lostSummaryTab=${encodeURIComponent(authUser.id)}`,
          )
        }}
      />
      {(role === 'dev' || role === 'master_technician' || role === 'assistant') && (
        <DashboardTallyStaleStaffBanner
          peopleCount={typeof tallyStaffStalePeopleCount === 'number' ? tallyStaffStalePeopleCount : 0}
          transactionCount={typeof tallyStaffStaleTxCount === 'number' ? tallyStaffStaleTxCount : 0}
          loading={tallyStaffStalePeopleCount === null || tallyStaffStaleTxCount === null}
          minAgeDays={TALLY_STALE_MIN_AGE_DAYS}
          onOpen={() => setTallyStaffFollowUpModalOpen(true)}
        />
      )}
      {role != null && (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
            <Link
              to="/tally"
              title={tallyLinkAccessibleName}
              aria-label={tallyLinkAccessibleName}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                background: '#3b82f6',
                color: 'white',
                borderRadius: 8,
                textDecoration: 'none',
                boxSizing: 'border-box',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={28} height={28} fill="currentColor" style={{ display: 'block' }} aria-hidden>
                <path d="M541.4 162.6C549 155 561.7 156.9 565.5 166.9C572.3 184.6 576 203.9 576 224C576 312.4 504.4 384 416 384C398.5 384 381.6 381.2 365.8 376L178.9 562.9C150.8 591 105.2 591 77.1 562.9C49 534.8 49 489.2 77.1 461.1L264 274.2C258.8 258.4 256 241.6 256 224C256 135.6 327.6 64 416 64C436.1 64 455.4 67.7 473.1 74.5C483.1 78.3 484.9 91 477.4 98.6L388.7 187.3C385.7 190.3 384 194.4 384 198.6L384 240C384 248.8 391.2 256 400 256L441.4 256C445.6 256 449.7 254.3 452.7 251.3L541.4 162.6z" />
              </svg>
            </Link>
            {typeof tallyUnlinkedCount === 'number' && tallyUnlinkedCount > 0 ? (
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
                {tallyUnlinkedCount > 99 ? '99+' : tallyUnlinkedCount}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setNewReportModalOpen(true)}
            style={{
              flex: 1,
              padding: '0 1.5rem',
              background: '#3b82f6',
              color: 'white',
              borderRadius: 8,
              border: 'none',
              fontWeight: 600,
              fontSize: '1.125rem',
              textAlign: 'center',
              minHeight: 48,
              height: 48,
              boxSizing: 'border-box',
              cursor: 'pointer',
            }}
          >
            Job Report
          </button>
        </div>
      )}
      {showPinnedRowWithQuickActions && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            {isDev && (
              <Link to="/people?tab=hours" style={pinnedItemLinkStyle}>
                Hours Awaiting Approval: {hoursAwaitingCount ?? '…'}
              </Link>
            )}
            {quickButtonsPlacement === 'with_pins' &&
              showDashboardQuickButtons &&
              quickActionDefs.map((b) => (
                <Link key={b.key} to={b.to} style={pinnedItemLinkStyle}>
                  {b.label}
                </Link>
              ))}
            {pinsToShow.map((item) => {
              const isCostMatrix = item.path === '/people' && item.tab === 'hours'
              const isSupplyHouseAP = item.path === '/materials' && item.tab === 'supply-houses'
              const isBilled = item.path === '/jobs' && item.tab === 'billed'
              const isSubLaborDue = item.path === '/jobs' && item.tab === 'sub_sheet_ledger'
              const to = item.tab
                ? isSubLaborDue
                  ? '/jobs?tab=sub_sheet_ledger'
                  : `${item.path}?tab=${encodeURIComponent(isBilled ? 'stages' : item.tab)}${isCostMatrix ? '#cost-matrix' : ''}${isBilled ? '&showBilledTotalByName=true' : ''}`
                : item.path
              const displayLabel = isCostMatrix
                ? (costMatrixTotal != null ? `Internal Team: $${Math.round(costMatrixTotal).toLocaleString('en-US')}` : item.label)
                : isBilled
                  ? (billedCount != null && billedTotal != null ? `Billed Awaiting Payment (${billedCount}): $${billedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Billed Awaiting Payment…')
                  : isSupplyHouseAP
                    ? (supplyHousesAPTotal != null ? `Supply Houses: $${Math.round(supplyHousesAPTotal).toLocaleString('en-US')}` : item.label)
                    : isSubLaborDue
                      ? (subLaborDueTotal != null ? `Sub Labor Due: $${subLaborDueTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : item.label)
                      : (item.tab ? `${item.label} · ${item.tab.replace(/-/g, ' ').replace(/_/g, ' ')}` : item.label)
              return (
                <Link key={item.path + (item.tab ?? '')} to={to} style={pinnedItemLinkStyle}>
                  {displayLabel}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </>
  )

  // Job Mode focused view: replaces top of Dashboard with one big card; rest of
  // Dashboard is hidden until user taps "Show full dashboard" (component-local;
  // resets every page load). Toggle lives in the header gear menu (Layout.tsx).
  if (jobModeEnabled && !jobModeShowFullDashboard && authUser?.id) {
    return (
      <div>
        {tallyAndPinnedBlock}
        <DashboardJobModeCard
          userId={authUser.id}
          onLeaveReport={(j) => setLeaveReportJob(j)}
          onTurnaway={(j) => setTurnawayJob(j)}
        />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setJobModeShowFullDashboard(true)}
            style={{
              padding: '0.5rem 0.9rem',
              borderRadius: 8,
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              color: 'var(--text-gray-800)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Show full dashboard
          </button>
        </div>
        {leaveReportJob && (
          <AdditionalReportModal
            open={!!leaveReportJob}
            onClose={() => setLeaveReportJob(null)}
            onSaved={() => {
              setLeaveReportJob(null)
              void refreshDashboardAssignedJobLists()
            }}
            onReportSaved={() => void refreshDashboardAssignedJobLists()}
            authUserId={authUser?.id ?? null}
            userRole={role}
            jobId={leaveReportJob.id}
            hcpNumber={leaveReportJob.hcpNumber}
            jobName={leaveReportJob.jobName}
            jobAddress={leaveReportJob.jobAddress}
          />
        )}
        {turnawayJob && (
          <TurnawayModal
            open={!!turnawayJob}
            onClose={() => setTurnawayJob(null)}
            onSubmitted={() => {
              setTurnawayJob(null)
              void refreshDashboardAssignedJobLists()
            }}
            authUserId={authUser?.id ?? null}
            userRole={role}
            jobId={turnawayJob.id}
            hcpNumber={turnawayJob.hcpNumber}
            jobName={turnawayJob.jobName}
            jobAddress={turnawayJob.jobAddress}
          />
        )}
      </div>
    )
  }

  const dockAnchorStyle: CSSProperties = { scrollMarginTop: 8 }
  /** Sections offered by the floating bottom dock; mirrors each section's render gate. */
  const dockSections = [
    { id: 'dash-notifications', label: 'Notifications', visible: showFinancials },
    { id: 'dash-clocked-in', label: 'ClockedIn', visible: Boolean(authUser?.id && showClockActivityStrip) },
    {
      id: 'dash-teams-inbox',
      label: 'Teams Inbox',
      visible: Boolean(authUser?.id && (dispatchInboxEligible || estimatorInboxEligible)),
    },
    {
      id: 'dash-billing',
      label: 'Billing',
      visible: role === 'assistant' || role === 'dev' || role === 'master_technician',
    },
    { id: 'dash-my-inbox', label: 'My Inbox', visible: userLoading || showChecklist },
    {
      id: 'dash-bids',
      label: 'Bids',
      visible:
        (role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'estimator' || role === 'primary') &&
        (myBidsLoading || myBids.some((b) => !hiddenBidIds.has(b.id))),
    },
    { id: 'dash-reports', label: 'Reports', visible: showRecent },
    { id: 'dash-me', label: 'Me', visible: Boolean(authUser?.id) },
  ].filter((sec) => sec.visible)

  /** Above-the-fold: quick actions and clock first; checklist/assigned use skeletons until data arrives. */
  return (
    <div style={{ paddingBottom: dockSections.length > 1 ? '4.5rem' : 0 }}>
      {dockSections.length > 1 ? <DashboardSectionDock sections={dockSections} /> : null}
      {showFinancials && <div id="dash-notifications" aria-hidden="true" style={dockAnchorStyle} />}
      {showFinancials && <DashboardFinancialsSection />}
      {showDashboardQuickButtons && quickButtonsPlacement === 'top' && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', justifyContent: 'center' }}>
          {quickActionDefs.map((b) => (
            <Link key={b.key} to={b.to} style={quickActionLinkStyle}>
              {b.label}
            </Link>
          ))}
        </div>
      )}
      {authUser?.id && (
        <ClockInOutButton
          userId={authUser.id}
          userName={clockDisplayName}
          onOpenMyTimeDayEditor={dashboardSelfIsSalary ? undefined : openMyTimePreviewFromClock}
          onClockInSuccess={handleClockInSuccessContractPrompt}
          onFieldReportSaved={() => void refreshDashboardAssignedJobLists()}
        />
      )}
      {tallyAndPinnedBlock}
      {authUser?.id && teamFeedbackHomeEnabled && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => setTeamFeedbackWizardOpen(true)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              fontWeight: 600,
              border: '2px solid #ea580c',
              borderRadius: 8,
              background: 'var(--bg-orange-tint)',
              color: 'var(--text-orange-700)',
              cursor: 'pointer',
            }}
          >
            Quick feedback
          </button>
        </div>
      )}
      {authUser?.id && teamFeedbackWizardOpen && (
        <TeamFeedbackWizard
          open
          onClose={() => setTeamFeedbackWizardOpen(false)}
          userId={authUser.id}
          source="home_button"
          skipIntro
        />
      )}
      <DashboardContractSigningPromptModal
        open={contractSigningPromptOpen}
        rows={contractSigningPromptRows}
        openingDocId={contractSigningPromptOpeningId}
        onClose={() => setContractSigningPromptOpen(false)}
        onOpenSigningPage={openContractSigningPageForDoc}
      />
      {role === 'assistant' && authUser?.id && showClockActivityStrip && (
        <div id="dash-clocked-in" aria-hidden="true" style={dockAnchorStyle} />
      )}
      {role === 'assistant' && authUser?.id && showClockActivityStrip && (
        <DashboardTeamActiveClockStrip
          sessions={sessionsForStrip}
          hoursTodayByUserId={hoursTodayForStrip}
          clockedInTodayRows={myTeam.clockedInTodayStripRows}
          jobsWorkedTodayRows={myTeam.jobsWorkedTodayStripRows}
          jobsWorkedTodayReportKeys={myTeam.jobsWorkedTodayReportKeys}
          jobsWorkedTodayReportIdByKey={myTeam.jobsWorkedTodayReportIdByKey}
          jobsWorkedTodayJobLedgerIdsWithReport={myTeam.jobsWorkedTodayJobLedgerIdsWithReport}
          showScopeToggle={showClockStripScopeToggle}
          clockStripScope={clockStripScope}
          clockStripNarrowScopeLabel={showClockStripScopeToggle ? 'Everyone' : undefined}
          clockStripWideScopeLabel={showClockStripScopeToggle ? 'Organization' : undefined}
          onClockStripScopeChange={setClockStripScopePersist}
          showJobBidColumn={showClockStripScopeToggle}
          onJobBidSaved={(patch) => {
            myTeam.applyOptimisticClockSessionAssign(patch)
            void myTeam.loadPending({ silent: true })
          }}
          onJobBidAssignError={(msg) => showToast(msg, 'error')}
          onApplyScheduleProportionsForSession={applySchedule.requestApply}
          onOpenStripMyTimeEditor={
            showStripSubjectMyTimeEditor ? openStripMyTimeEditor : undefined
          }
          authUserId={authUser.id}
          canApproveClockSessions={showClockStripScopeToggle}
          onClockSessionsMutated={() => {
            void myTeam.loadPending({ silent: true })
          }}
          onMaterializeSalarySession={
            showClockStripScopeToggle ? materializeSalarySessionForStrip : undefined
          }
          enableCopyDayJobMix={showClockStripScopeToggle}
          enableScheduleDayEmail={showClockStripScopeToggle}
          clockStripWorkDateYmd={myTeam.clockStripWorkDateYmd}
        />
      )}
      {role === 'assistant' && authUser?.id && (
        <DashboardMyTeamPendingBanner
          pendingApprovalCount={myTeam.pendingApprovalCount}
          loadingSessions={myTeam.loadingSessions}
          onGoToPendingSessions={goToPendingSessionsInMyTeam}
        />
      )}
      {role === 'assistant' && (
        <>
          {/* Inboxes first: processing dispatch/estimator requests is the assistant's primary queue. */}
          {authUser?.id && (dispatchInboxEligible || estimatorInboxEligible) && (
            <div id="dash-teams-inbox" aria-hidden="true" style={dockAnchorStyle} />
          )}
          {authUser?.id && dispatchInboxEligible && (
            <DispatchInboxSection
              sectionOpen={dispatchRequestsOpen}
              onToggleSection={() => setDispatchRequestsOpen((o) => !o)}
              requests={dispatchRequests}
              loading={dispatchRequestsLoading}
              expandedRequestId={expandedDispatchRequestId}
              onToggleExpandRequest={toggleExpandDispatchRequest}
              notesByRequestId={dispatchThreadNotesByRequestId}
              notesLoadingRequestId={dispatchNotesLoadingRequestId}
              noteSubmitRequestId={dispatchNoteSubmitRequestId}
              canAddNotes={dispatchInboxEligible}
              dispatchRequestDismissingId={dispatchRequestDismissingId}
              noteDraft={dispatchNoteDraft}
              onNoteDraftChange={setDispatchNoteDraft}
              onSubmitNote={submitDispatchNote}
              onSubmitNoteAndClose={submitDispatchNoteAndClose}
              onDismiss={dismissDispatchRequest}
              onOpenDismissedArchive={() => setDispatchDismissedModalOpen(true)}
              onLinkJobPictures={
                jobFormModal
                  ? (jobId) => jobFormModal.openEditJob(jobId, { jobPicturesLinkHighlight: true })
                  : undefined
              }
              onCreateTripCharge={(args) => setTripChargeTarget(args)}
            />
          )}
          {authUser?.id && estimatorInboxEligible && (
            <EstimatorInboxSection
              sectionOpen={estimatorRequestsOpen}
              onToggleSection={() => setEstimatorRequestsOpen((o) => !o)}
              requests={estimatorRequests}
              loading={estimatorRequestsLoading}
              expandedRequestId={expandedEstimatorRequestId}
              onToggleExpandRequest={toggleExpandEstimatorRequest}
              notesByRequestId={estimatorThreadNotesByRequestId}
              notesLoadingRequestId={estimatorNotesLoadingRequestId}
              noteSubmitRequestId={estimatorNoteSubmitRequestId}
              canAddNotes={estimatorInboxEligible}
              estimatorRequestDismissingId={estimatorRequestDismissingId}
              noteDraft={estimatorNoteDraft}
              onNoteDraftChange={setEstimatorNoteDraft}
              onSubmitNote={submitEstimatorNote}
              onSubmitNoteAndClose={submitEstimatorNoteAndClose}
              onDismiss={dismissEstimatorRequest}
            />
          )}
          <div id="dash-billing" aria-hidden="true" style={dockAnchorStyle} />
          <BillingPipelineCard>
          {authUser?.id && (
            <BillingPipelineStage step={1} connectToNext>
              <DashboardFieldCollectPaymentQueue
                embedded
                onPrepareBill={handlePrepareBillFromFieldQueue}
                shouldShowPrepareBill={shouldShowPrepareBillForFieldQueue}
              />
            </BillingPipelineStage>
          )}
          <BillingPipelineStage step={2} connectToNext={waitingForPaymentLoading || billedWaitingDashboardUnits.length > 0}>
          <div style={{ marginBottom: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setReadyToBillExpanded((prev) => !prev)}
              aria-expanded={readyToBillExpanded}
              style={{ margin: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: readyToBillExpanded ? '0.75rem' : 0 }}
            >
              <span aria-hidden>{readyToBillExpanded ? '\u25BC' : '\u25B6'}</span>
              <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Ready to Bill ({readyToBillDashboardUnits.length})</h2>
            </button>
            {readyToBillExpanded && (
            <>
            {readyToBillLoading && readyToBillDashboardUnits.length === 0 ? (
              <DashboardListRowSkeleton rows={2} />
            ) : readyToBillDashboardUnits.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No jobs or invoices ready to bill yet</p>
            ) : (
              <div>
                {readyToBillDashboardUnits.map((unit) => {
                  if (unit.kind === 'invoice') {
                    const inv = unit.inv
                    return (
                      <div
                        key={inv.id}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '1rem',
                          marginBottom: '0.75rem',
                          background: 'var(--surface)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {inv.hcp_number || '—'} · {inv.job_name || '—'}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              {inv.job_address?.trim() ? (
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inv.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{inv.job_address}</a>
                              ) : (
                                '—'
                              )}
                            </div>
                            <div style={{ fontSize: '0.875rem', marginTop: 4 }}>
                              {`Invoice: $${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                              {(() => {
                                const { applied, open } = dashboardBilledInvoiceAmounts(inv)
                                if (applied <= 0) return null
                                return (
                                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                    {`Applied: $${applied.toLocaleString('en-US', { minimumFractionDigits: 2 })} · Open: $${open.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            {(inv.google_drive_link?.trim() || inv.job_plans_link?.trim()) && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                {inv.google_drive_link?.trim() && (
                                  <a
                                    href={inv.google_drive_link.trim()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => { e.preventDefault(); openInExternalBrowser(inv.google_drive_link!.trim()) }}
                                    title="Google Drive"
                                    style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                                      <path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" />
                                    </svg>
                                  </a>
                                )}
                                {inv.job_plans_link?.trim() && (
                                  <a
                                    href={inv.job_plans_link.trim()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => { e.preventDefault(); openInExternalBrowser(inv.job_plans_link!.trim()) }}
                                    title="Job Plans"
                                    style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                                      <path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" />
                                    </svg>
                                  </a>
                                )}
                              </div>
                            )}
                            <ReadyToBillJobIconToolbar
                              jobId={inv.job_id}
                              hcpNumber={inv.hcp_number ?? '—'}
                              jobName={inv.job_name ?? '—'}
                              jobAddress={inv.job_address ?? '—'}
                              jobFormModalAvailable={Boolean(jobFormModal)}
                              onEditJob={openReadyToBillEditJob}
                              onOpenDetail={openReadyToBillDetailJobModal}
                            />
                            <button type="button" onClick={() => setViewBillDetailsJob({ id: inv.job_id, hcpNumber: inv.hcp_number ?? '—', jobName: inv.job_name ?? '—', jobAddress: inv.job_address ?? '—', revenue: inv.amount })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: 'none', cursor: 'pointer', textDecoration: 'none' }}>View<br />Details</button>
                            <button type="button" onClick={() => setViewReportsJob({ id: inv.job_id, hcpNumber: inv.hcp_number ?? '—', jobName: inv.job_name ?? '—', jobAddress: inv.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                            <button type="button" onClick={() => { setSendBackChecked(false); setSendBackInvoice({ inv, action: 'delete' }) }} disabled={invoiceStatusUpdatingId === inv.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: invoiceStatusUpdatingId === inv.id ? 'not-allowed' : 'pointer' }}>Delete<br />draft bill</button>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                              <button type="button" onClick={() => {
                                if (!dashboardJobHasCustomerForBilling(inv.customer_id)) {
                                  showToast?.('Link this job to a customer before billing.', 'error')
                                  return
                                }
                                openDashboardBillCustomerInvoice(inv)
                              }} disabled={invoiceStatusUpdatingId === inv.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: invoiceStatusUpdatingId === inv.id ? 'not-allowed' : 'pointer' }}>{invoiceStatusUpdatingId === inv.id ? '…' : 'Bill Customer'}</button>
                              {inv.open_since_at && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'center' }} title="Time open">Open {formatTimeSince(inv.open_since_at)}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  const j = unit.job
                  const bundleInv = unit.kind === 'job_bundle' ? unit.inv : null
                  const remaining = bundleInv != null ? Number(bundleInv.amount) : (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0))
                  return (
                    <div
                      key={bundleInv != null ? `bundle-${j.id}-${bundleInv.id}` : j.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '1rem',
                        marginBottom: '0.75rem',
                        background: 'var(--surface)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {j.hcp_number || '—'} · {j.job_name || '—'}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {j.job_address?.trim() ? (
                              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{j.job_address}</a>
                            ) : (
                              '—'
                            )}
                          </div>
                          {bundleInv != null ? (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-blue-800)', marginTop: 4 }} title="Single billing line for this job (Stripe or external send)">
                              Billing line: ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.875rem', marginTop: 4 }}>Remaining: ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          {(j.google_drive_link?.trim() || j.job_plans_link?.trim()) && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                              {j.google_drive_link?.trim() && (
                                <a href={j.google_drive_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.google_drive_link!.trim()) }} title="Google Drive" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true"><path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" /></svg>
                                </a>
                              )}
                              {j.job_plans_link?.trim() && (
                                <a href={j.job_plans_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.job_plans_link!.trim()) }} title="Job Plans" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true"><path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" /></svg>
                                </a>
                              )}
                            </div>
                          )}
                          <ReadyToBillJobIconToolbar
                            jobId={j.id}
                            hcpNumber={j.hcp_number ?? '—'}
                            jobName={j.job_name ?? '—'}
                            jobAddress={j.job_address ?? '—'}
                            jobFormModalAvailable={Boolean(jobFormModal)}
                            onEditJob={openReadyToBillEditJob}
                            onOpenDetail={openReadyToBillDetailJobModal}
                          />
                          <button type="button" onClick={() => setViewBillDetailsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—', revenue: j.revenue })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: 'none', cursor: 'pointer', textDecoration: 'none' }}>View<br />Details</button>
                          <button type="button" onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                          <button type="button" onClick={() => { setSendBackChecked(false); setSendBackJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', toStatus: 'working', rtbDraftCount: countDashboardRtbDraftsForJob(j.id, readyToBillInvoices) }) }} disabled={jobStatusUpdatingId === j.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer' }} aria-label="Send back">Send<br />Back</button>
                          {bundleInv != null && (
                            <button type="button" onClick={() => { setSendBackChecked(false); setSendBackInvoice({ inv: bundleInv, action: 'delete' }) }} disabled={invoiceStatusUpdatingId === bundleInv.id} title="Remove this billing line (partial invoice row)" style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: invoiceStatusUpdatingId === bundleInv.id ? 'not-allowed' : 'pointer' }}>Delete<br />draft bill</button>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                            {bundleInv != null ? (
                              <button type="button" onClick={() => {
                                if (!dashboardJobHasCustomerForBilling(bundleInv.customer_id)) {
                                  showToast?.('Link this job to a customer before billing.', 'error')
                                  return
                                }
                                openDashboardBillCustomerInvoice(bundleInv)
                              }} disabled={invoiceStatusUpdatingId === bundleInv.id} title="Bill Customer for this billing line (e.g. Stripe)" style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: invoiceStatusUpdatingId === bundleInv.id ? 'not-allowed' : 'pointer' }}>{invoiceStatusUpdatingId === bundleInv.id ? '…' : 'Bill Customer'}</button>
                            ) : (
                              <button type="button" onClick={() => {
                                if (!dashboardJobHasCustomerForBilling(j.customer_id)) {
                                  showToast?.('Link this job to a customer before billing.', 'error')
                                  return
                                }
                                setSendRecordJobMeta({ id: j.id })
                              }} disabled={jobStatusUpdatingId === j.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer' }}>{jobStatusUpdatingId === j.id ? '…' : 'Bill Customer'}</button>
                            )}
                            {(bundleInv?.created_at ?? j.created_at) && (
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'center' }} title={bundleInv != null ? 'Time since invoice created' : 'Time since job created'}>
                                Open {formatTimeSince(bundleInv?.created_at ?? j.created_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            </>
            )}
          </div>
          </BillingPipelineStage>
          {(waitingForPaymentLoading || billedWaitingDashboardUnits.length > 0) && (
            <BillingPipelineStage step={3}>
            <div style={{ marginBottom: 0 }}>
              <button
                type="button"
                onClick={() => setWaitingForPaymentExpanded((prev) => !prev)}
                aria-expanded={waitingForPaymentExpanded}
                style={{ margin: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: waitingForPaymentExpanded ? '0.75rem' : 0 }}
              >
                <span aria-hidden>{waitingForPaymentExpanded ? '\u25BC' : '\u25B6'}</span>
                <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Billed Waiting for Payment ({billedWaitingDashboardUnits.length})</h2>
              </button>
              {waitingForPaymentExpanded && (
              <>
              {waitingForPaymentLoading && billedWaitingDashboardUnits.length === 0 ? (
                <DashboardListRowSkeleton rows={2} />
              ) : (
                <div>
                  {billedWaitingDashboardUnits.map((unit) => {
                    if (unit.kind === 'invoice' || unit.kind === 'job_bundle') {
                      const inv = unit.inv
                      const cardKey = unit.kind === 'job_bundle' ? `billed-bundle-${unit.job.id}-${inv.id}` : inv.id
                      return (
                    <div key={cardKey} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', marginBottom: '0.75rem', background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{inv.hcp_number || '—'} · {inv.job_name || '—'}</div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {inv.job_address?.trim() ? (
                              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inv.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{inv.job_address}</a>
                            ) : (
                              '—'
                            )}
                          </div>
                          <div style={{ fontSize: '0.875rem', marginTop: 4 }}>
                            {`Invoice: $${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                            {(() => {
                              const { applied, open } = dashboardBilledInvoiceAmounts(inv)
                              if (applied <= 0) return null
                              return (
                                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                  {`Applied: $${applied.toLocaleString('en-US', { minimumFractionDigits: 2 })} · Open: $${open.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          {(inv.google_drive_link?.trim() || inv.job_plans_link?.trim()) && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                              {inv.google_drive_link?.trim() && (
                                <a href={inv.google_drive_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(inv.google_drive_link!.trim()) }} title="Google Drive" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true"><path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" /></svg>
                                </a>
                              )}
                              {inv.job_plans_link?.trim() && (
                                <a href={inv.job_plans_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(inv.job_plans_link!.trim()) }} title="Job Plans" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true"><path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" /></svg>
                                </a>
                              )}
                            </div>
                          )}
                            <button type="button" onClick={() => setViewBillDetailsJob({ id: inv.job_id, hcpNumber: inv.hcp_number ?? '—', jobName: inv.job_name ?? '—', jobAddress: inv.job_address ?? '—', revenue: inv.amount })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: 'none', cursor: 'pointer', textDecoration: 'none' }}>View<br />Details</button>
                          <button type="button" onClick={() => setViewReportsJob({ id: inv.job_id, hcpNumber: inv.hcp_number ?? '—', jobName: inv.job_name ?? '—', jobAddress: inv.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                          <button type="button" onClick={() => { setSendBackChecked(false); setSendBackInvoice({ inv, action: 'revert' }) }} disabled={invoiceStatusUpdatingId === inv.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: invoiceStatusUpdatingId === inv.id ? 'not-allowed' : 'pointer' }}>Send<br />back</button>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                            <button type="button" onClick={() => setMarkPaidInvoice(inv)} disabled={invoiceStatusUpdatingId === inv.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: invoiceStatusUpdatingId === inv.id ? 'not-allowed' : 'pointer' }}>{invoiceStatusUpdatingId === inv.id ? '…' : 'Mark Paid'}</button>
                            {inv.open_since_at && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'center' }} title="Time open">Open {formatTimeSince(inv.open_since_at)}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                      )
                    }
                    const j = unit.job
                    const remaining = Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)
                    return (
                      <div key={j.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', marginBottom: '0.75rem', background: 'var(--surface)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{j.hcp_number || '—'} · {j.job_name || '—'}</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              {j.job_address?.trim() ? (
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{j.job_address}</a>
                              ) : (
                                '—'
                              )}
                            </div>
                            <div style={{ fontSize: '0.875rem', marginTop: 4 }}>Remaining: ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            {(j.google_drive_link?.trim() || j.job_plans_link?.trim()) && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                {j.google_drive_link?.trim() && (
                                  <a href={j.google_drive_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.google_drive_link!.trim()) }} title="Google Drive" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true"><path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" /></svg>
                                  </a>
                                )}
                                {j.job_plans_link?.trim() && (
                                  <a href={j.job_plans_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.job_plans_link!.trim()) }} title="Job Plans" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true"><path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" /></svg>
                                  </a>
                                )}
                              </div>
                            )}
                          <button type="button" onClick={() => setViewBillDetailsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—', revenue: j.revenue })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: 'none', cursor: 'pointer', textDecoration: 'none' }}>View<br />Details</button>
                            <button type="button" onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                            <button type="button" onClick={() => { setSendBackChecked(false); setSendBackJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', toStatus: 'ready_to_bill', rtbDraftCount: 0 }) }} disabled={jobStatusUpdatingId === j.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer' }}>Send<br />back</button>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                              <button type="button" onClick={() => setMarkPaidJob(j)} disabled={jobStatusUpdatingId === j.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer' }}>{jobStatusUpdatingId === j.id ? '…' : 'Mark Paid'}</button>
                              {j.created_at && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'center' }} title="Time since job created">Open {formatTimeSince(j.created_at)}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              </>
              )}
            </div>
            </BillingPipelineStage>
          )}
          </BillingPipelineCard>
        </>
      )}
      {role !== 'assistant' && authUser?.id && showClockActivityStrip && (
        <div id="dash-clocked-in" aria-hidden="true" style={dockAnchorStyle} />
      )}
      {role !== 'assistant' && authUser?.id && showClockActivityStrip && (
        <DashboardTeamActiveClockStrip
          sessions={sessionsForStrip}
          hoursTodayByUserId={hoursTodayForStrip}
          clockedInTodayRows={myTeam.clockedInTodayStripRows}
          jobsWorkedTodayRows={myTeam.jobsWorkedTodayStripRows}
          jobsWorkedTodayReportKeys={myTeam.jobsWorkedTodayReportKeys}
          jobsWorkedTodayReportIdByKey={myTeam.jobsWorkedTodayReportIdByKey}
          jobsWorkedTodayJobLedgerIdsWithReport={myTeam.jobsWorkedTodayJobLedgerIdsWithReport}
          showScopeToggle={showClockStripScopeToggle}
          clockStripScope={clockStripScope}
          clockStripNarrowScopeLabel={showClockStripScopeToggle ? 'Everyone' : undefined}
          clockStripWideScopeLabel={showClockStripScopeToggle ? 'Organization' : undefined}
          onClockStripScopeChange={setClockStripScopePersist}
          showJobBidColumn={showClockStripScopeToggle}
          onJobBidSaved={(patch) => {
            myTeam.applyOptimisticClockSessionAssign(patch)
            void myTeam.loadPending({ silent: true })
          }}
          onJobBidAssignError={(msg) => showToast(msg, 'error')}
          onApplyScheduleProportionsForSession={applySchedule.requestApply}
          onOpenStripMyTimeEditor={
            showStripSubjectMyTimeEditor ? openStripMyTimeEditor : undefined
          }
          authUserId={authUser.id}
          canApproveClockSessions={showClockStripScopeToggle}
          onClockSessionsMutated={() => {
            void myTeam.loadPending({ silent: true })
          }}
          onMaterializeSalarySession={
            showClockStripScopeToggle ? materializeSalarySessionForStrip : undefined
          }
          enableCopyDayJobMix={showClockStripScopeToggle}
          enableScheduleDayEmail={showClockStripScopeToggle}
          clockStripWorkDateYmd={myTeam.clockStripWorkDateYmd}
        />
      )}
      {(role === 'dev' || role === 'master_technician') && authUser?.id && (
        <DashboardMyTeamPendingBanner
          pendingApprovalCount={myTeam.pendingApprovalCount}
          loadingSessions={myTeam.loadingSessions}
          onGoToPendingSessions={goToPendingSessionsInMyTeam}
        />
      )}
      {stripMyTimeEditor && (
        <DashboardMyTimeDayEditorModal
          dateStr={stripMyTimeEditor.dateStr}
          sessions={[]}
          subjectUserId={stripMyTimeEditor.subjectUserId}
          subjectDisplayName={stripMyTimeEditor.displayName}
          showSalariedLabelUnderVisualStrip={stripMyTimeEditor.showSalariedStripFooter}
          prefetchSalarySessionsWhenEmpty
          clockTimesReadOnly={stripMyTimeEditor.clockTimesReadOnly}
          jobLabels={{}}
          bidLabels={{}}
          allowNcnsFromMyTime={showClockStripScopeToggle}
          showMarkNotComingIn={showStripSubjectMyTimeEditor}
          onMarkNotComingIn={
            showStripSubjectMyTimeEditor
              ? () =>
                  handleStripMarkNotComingIn({
                    subjectUserId: stripMyTimeEditor.subjectUserId,
                    displayName: stripMyTimeEditor.displayName,
                    workDateYmd: stripMyTimeEditor.dateStr,
                  })
              : undefined
          }
          onClose={() => setStripMyTimeEditor(null)}
          onSaved={() => {
            void myTeam.loadPending({ silent: true })
            setStripMyTimeEditor(null)
          }}
          onLinkedSessionsUpdated={() => void myTeam.loadPending({ silent: true })}
        />
      )}
      {isDev && authUser?.id && <DashboardDevRejectedNotification />}
      {isDev && authUser?.id && <HelpFeedbackInboxSection />}
      {authUser?.id && dispatchInboxEligible && (
        <DispatchDismissedItemsModal
          open={dispatchDismissedModalOpen}
          onClose={() => setDispatchDismissedModalOpen(false)}
          loadRows={fetchDismissedDispatchInboxRows}
        />
      )}
      {tripChargeTarget && (
        <CreateTripChargeModal
          target={tripChargeTarget}
          onClose={() => setTripChargeTarget(null)}
          onCreated={() => {
            setTripChargeTarget(null)
            void refreshInvoicesRef.current()
          }}
        />
      )}
      {authUser?.id && (dispatchInboxEligible || estimatorInboxEligible) && role !== 'assistant' && (
        <div id="dash-teams-inbox" aria-hidden="true" style={dockAnchorStyle} />
      )}
      {authUser?.id && dispatchInboxEligible && role !== 'assistant' && (
        <DispatchInboxSection
          sectionOpen={dispatchRequestsOpen}
          onToggleSection={() => setDispatchRequestsOpen((o) => !o)}
          requests={dispatchRequests}
          loading={dispatchRequestsLoading}
          expandedRequestId={expandedDispatchRequestId}
          onToggleExpandRequest={toggleExpandDispatchRequest}
          notesByRequestId={dispatchThreadNotesByRequestId}
          notesLoadingRequestId={dispatchNotesLoadingRequestId}
          noteSubmitRequestId={dispatchNoteSubmitRequestId}
          canAddNotes={dispatchInboxEligible}
          dispatchRequestDismissingId={dispatchRequestDismissingId}
          noteDraft={dispatchNoteDraft}
          onNoteDraftChange={setDispatchNoteDraft}
          onSubmitNote={submitDispatchNote}
          onSubmitNoteAndClose={submitDispatchNoteAndClose}
          onDismiss={dismissDispatchRequest}
          onOpenDismissedArchive={() => setDispatchDismissedModalOpen(true)}
          onLinkJobPictures={
            jobFormModal
              ? (jobId) => jobFormModal.openEditJob(jobId, { jobPicturesLinkHighlight: true })
              : undefined
          }
          onCreateTripCharge={
            role === 'dev' || role === 'master_technician'
              ? (args) => setTripChargeTarget(args)
              : undefined
          }
        />
      )}
      {authUser?.id && estimatorInboxEligible && role !== 'assistant' && (
        <EstimatorInboxSection
          sectionOpen={estimatorRequestsOpen}
          onToggleSection={() => setEstimatorRequestsOpen((o) => !o)}
          requests={estimatorRequests}
          loading={estimatorRequestsLoading}
          expandedRequestId={expandedEstimatorRequestId}
          onToggleExpandRequest={toggleExpandEstimatorRequest}
          notesByRequestId={estimatorThreadNotesByRequestId}
          notesLoadingRequestId={estimatorNotesLoadingRequestId}
          noteSubmitRequestId={estimatorNoteSubmitRequestId}
          canAddNotes={estimatorInboxEligible}
          estimatorRequestDismissingId={estimatorRequestDismissingId}
          noteDraft={estimatorNoteDraft}
          onNoteDraftChange={setEstimatorNoteDraft}
          onSubmitNote={submitEstimatorNote}
          onSubmitNoteAndClose={submitEstimatorNoteAndClose}
          onDismiss={dismissEstimatorRequest}
        />
      )}
      {(role === 'dev' || role === 'master_technician') && (
        <div id="dash-billing" aria-hidden="true" style={dockAnchorStyle} />
      )}
      {(role === 'dev' || role === 'master_technician') && (
        <BillingPipelineCard>
        {authUser?.id && (
          <BillingPipelineStage step={1} connectToNext>
            <DashboardFieldCollectPaymentQueue
              embedded
              onPrepareBill={handlePrepareBillFromFieldQueue}
              shouldShowPrepareBill={shouldShowPrepareBillForFieldQueue}
            />
          </BillingPipelineStage>
        )}
        <BillingPipelineStage step={2} connectToNext={waitingForPaymentLoading || billedWaitingDashboardUnits.length > 0}>
        <div style={{ marginBottom: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setReadyToBillExpanded((prev) => !prev)}
            aria-expanded={readyToBillExpanded}
            style={{ margin: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: readyToBillExpanded ? '0.75rem' : 0 }}
          >
            <span aria-hidden>{readyToBillExpanded ? '\u25BC' : '\u25B6'}</span>
            <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Ready to Bill ({readyToBillDashboardUnits.length})</h2>
          </button>
          {readyToBillExpanded && (
          <>
          {readyToBillLoading && readyToBillDashboardUnits.length === 0 ? (
            <DashboardListRowSkeleton rows={2} />
          ) : readyToBillDashboardUnits.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No jobs or invoices ready to bill yet</p>
          ) : (
            <div>
              {readyToBillDashboardUnits.map((unit) => {
                if (unit.kind === 'invoice') {
                  const inv = unit.inv
                  return (
                    <div
                      key={inv.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '1rem',
                        marginBottom: '0.75rem',
                        background: 'var(--surface)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {inv.hcp_number || '—'} · {inv.job_name || '—'}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {inv.job_address?.trim() ? (
                              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inv.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{inv.job_address}</a>
                            ) : (
                              '—'
                            )}
                          </div>
                          <div style={{ fontSize: '0.875rem', marginTop: 4 }}>
                            {`Invoice: $${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                            {(() => {
                              const { applied, open } = dashboardBilledInvoiceAmounts(inv)
                              if (applied <= 0) return null
                              return (
                                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                  {`Applied: $${applied.toLocaleString('en-US', { minimumFractionDigits: 2 })} · Open: $${open.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          {(inv.google_drive_link?.trim() || inv.job_plans_link?.trim()) && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                              {inv.google_drive_link?.trim() && (
                                <a
                                  href={inv.google_drive_link.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => { e.preventDefault(); openInExternalBrowser(inv.google_drive_link!.trim()) }}
                                  title="Google Drive"
                                  style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                                    <path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" />
                                  </svg>
                                </a>
                              )}
                              {inv.job_plans_link?.trim() && (
                                <a
                                  href={inv.job_plans_link.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => { e.preventDefault(); openInExternalBrowser(inv.job_plans_link!.trim()) }}
                                  title="Job Plans"
                                  style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                                    <path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          )}
                          <ReadyToBillJobIconToolbar
                              jobId={inv.job_id}
                              hcpNumber={inv.hcp_number ?? '—'}
                              jobName={inv.job_name ?? '—'}
                              jobAddress={inv.job_address ?? '—'}
                              jobFormModalAvailable={Boolean(jobFormModal)}
                              onEditJob={openReadyToBillEditJob}
                              onOpenDetail={openReadyToBillDetailJobModal}
                            />
                            <button type="button" onClick={() => setViewBillDetailsJob({ id: inv.job_id, hcpNumber: inv.hcp_number ?? '—', jobName: inv.job_name ?? '—', jobAddress: inv.job_address ?? '—', revenue: inv.amount })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: 'none', cursor: 'pointer', textDecoration: 'none' }}>View<br />Details</button>
                          <button type="button" onClick={() => setViewReportsJob({ id: inv.job_id, hcpNumber: inv.hcp_number ?? '—', jobName: inv.job_name ?? '—', jobAddress: inv.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                          <button type="button" onClick={() => { setSendBackChecked(false); setSendBackInvoice({ inv, action: 'delete' }) }} disabled={invoiceStatusUpdatingId === inv.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: invoiceStatusUpdatingId === inv.id ? 'not-allowed' : 'pointer' }}>Delete<br />draft bill</button>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                            <button type="button" onClick={() => {
                                if (!dashboardJobHasCustomerForBilling(inv.customer_id)) {
                                  showToast?.('Link this job to a customer before billing.', 'error')
                                  return
                                }
                                openDashboardBillCustomerInvoice(inv)
                              }} disabled={invoiceStatusUpdatingId === inv.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: invoiceStatusUpdatingId === inv.id ? 'not-allowed' : 'pointer' }}>{invoiceStatusUpdatingId === inv.id ? '…' : 'Bill Customer'}</button>
                            {inv.open_since_at && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'center' }} title="Time open">Open {formatTimeSince(inv.open_since_at)}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }
                const j = unit.job
                const bundleInv = unit.kind === 'job_bundle' ? unit.inv : null
                const remaining = bundleInv != null ? Number(bundleInv.amount) : (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0))
                return (
                  <div
                    key={bundleInv != null ? `bundle-${j.id}-${bundleInv.id}` : j.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '1rem',
                      marginBottom: '0.75rem',
                      background: 'var(--surface)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {j.hcp_number || '—'} · {j.job_name || '—'}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          {j.job_address?.trim() ? (
                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{j.job_address}</a>
                          ) : (
                            '—'
                          )}
                        </div>
                        {bundleInv != null ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-blue-800)', marginTop: 4 }} title="Single billing line for this job (Stripe or external send)">
                            Billing line: ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.875rem', marginTop: 4 }}>Remaining: ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {(j.google_drive_link?.trim() || j.job_plans_link?.trim()) && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                            {j.google_drive_link?.trim() && (
                              <a href={j.google_drive_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.google_drive_link!.trim()) }} title="Google Drive" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true"><path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" /></svg>
                              </a>
                            )}
                            {j.job_plans_link?.trim() && (
                              <a href={j.job_plans_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.job_plans_link!.trim()) }} title="Job Plans" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true"><path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" /></svg>
                              </a>
                            )}
                          </div>
                        )}
                        <ReadyToBillJobIconToolbar
                            jobId={j.id}
                            hcpNumber={j.hcp_number ?? '—'}
                            jobName={j.job_name ?? '—'}
                            jobAddress={j.job_address ?? '—'}
                            jobFormModalAvailable={Boolean(jobFormModal)}
                            onEditJob={openReadyToBillEditJob}
                            onOpenDetail={openReadyToBillDetailJobModal}
                          />
                          <button type="button" onClick={() => setViewBillDetailsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—', revenue: j.revenue })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: 'none', cursor: 'pointer', textDecoration: 'none' }}>View<br />Details</button>
                        <button type="button" onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                        <button type="button" onClick={() => { setSendBackChecked(false); setSendBackJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', toStatus: 'working', rtbDraftCount: countDashboardRtbDraftsForJob(j.id, readyToBillInvoices) }) }} disabled={jobStatusUpdatingId === j.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer' }} aria-label="Send back">Send<br />Back</button>
                        {bundleInv != null && (
                          <button type="button" onClick={() => { setSendBackChecked(false); setSendBackInvoice({ inv: bundleInv, action: 'delete' }) }} disabled={invoiceStatusUpdatingId === bundleInv.id} title="Remove this billing line (partial invoice row)" style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: invoiceStatusUpdatingId === bundleInv.id ? 'not-allowed' : 'pointer' }}>Delete<br />draft bill</button>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                          {bundleInv != null ? (
                            <button type="button" onClick={() => {
                                if (!dashboardJobHasCustomerForBilling(bundleInv.customer_id)) {
                                  showToast?.('Link this job to a customer before billing.', 'error')
                                  return
                                }
                                openDashboardBillCustomerInvoice(bundleInv)
                              }} disabled={invoiceStatusUpdatingId === bundleInv.id} title="Bill Customer for this billing line (e.g. Stripe)" style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: invoiceStatusUpdatingId === bundleInv.id ? 'not-allowed' : 'pointer' }}>{invoiceStatusUpdatingId === bundleInv.id ? '…' : 'Bill Customer'}</button>
                          ) : (
                            <button type="button" onClick={() => {
                                if (!dashboardJobHasCustomerForBilling(j.customer_id)) {
                                  showToast?.('Link this job to a customer before billing.', 'error')
                                  return
                                }
                                setSendRecordJobMeta({ id: j.id })
                              }} disabled={jobStatusUpdatingId === j.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer' }}>{jobStatusUpdatingId === j.id ? '…' : 'Bill Customer'}</button>
                          )}
                          {(bundleInv?.created_at ?? j.created_at) && (
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'center' }} title={bundleInv != null ? 'Time since invoice created' : 'Time since job created'}>
                              Open {formatTimeSince(bundleInv?.created_at ?? j.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          </>
          )}
        </div>
        </BillingPipelineStage>
        {(waitingForPaymentLoading || billedWaitingDashboardUnits.length > 0) && (
          <BillingPipelineStage step={3}>
          <div style={{ marginBottom: 0 }}>
          <button
            type="button"
            onClick={() => setWaitingForPaymentExpanded((prev) => !prev)}
            aria-expanded={waitingForPaymentExpanded}
            style={{ margin: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: waitingForPaymentExpanded ? '0.75rem' : 0 }}
          >
            <span aria-hidden>{waitingForPaymentExpanded ? '\u25BC' : '\u25B6'}</span>
            <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Billed Waiting for Payment ({billedWaitingDashboardUnits.length})</h2>
          </button>
          {waitingForPaymentExpanded && (
          <>
          {waitingForPaymentLoading && billedWaitingDashboardUnits.length === 0 ? (
            <DashboardListRowSkeleton rows={2} />
          ) : (
            <div>
              {billedWaitingDashboardUnits.map((unit) => {
                if (unit.kind === 'invoice' || unit.kind === 'job_bundle') {
                  const inv = unit.inv
                  const cardKey = unit.kind === 'job_bundle' ? `billed-bundle-${unit.job.id}-${inv.id}` : inv.id
                  return (
                    <div key={cardKey} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', marginBottom: '0.75rem', background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{inv.hcp_number || '—'} · {inv.job_name || '—'}</div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {inv.job_address?.trim() ? (
                              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inv.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{inv.job_address}</a>
                            ) : (
                              '—'
                            )}
                          </div>
                          <div style={{ fontSize: '0.875rem', marginTop: 4 }}>
                            {`Invoice: $${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                            {(() => {
                              const { applied, open } = dashboardBilledInvoiceAmounts(inv)
                              if (applied <= 0) return null
                              return (
                                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                  {`Applied: $${applied.toLocaleString('en-US', { minimumFractionDigits: 2 })} · Open: $${open.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          {(inv.google_drive_link?.trim() || inv.job_plans_link?.trim()) && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                              {inv.google_drive_link?.trim() && (
                                <a href={inv.google_drive_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(inv.google_drive_link!.trim()) }} title="Google Drive" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true"><path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" /></svg>
                                </a>
                              )}
                              {inv.job_plans_link?.trim() && (
                                <a href={inv.job_plans_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(inv.job_plans_link!.trim()) }} title="Job Plans" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true"><path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" /></svg>
                                </a>
                              )}
                            </div>
                          )}
                            <button type="button" onClick={() => setViewBillDetailsJob({ id: inv.job_id, hcpNumber: inv.hcp_number ?? '—', jobName: inv.job_name ?? '—', jobAddress: inv.job_address ?? '—', revenue: inv.amount })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: 'none', cursor: 'pointer', textDecoration: 'none' }}>View<br />Details</button>
                          <button type="button" onClick={() => setViewReportsJob({ id: inv.job_id, hcpNumber: inv.hcp_number ?? '—', jobName: inv.job_name ?? '—', jobAddress: inv.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                          <button type="button" onClick={() => { setSendBackChecked(false); setSendBackInvoice({ inv, action: 'revert' }) }} disabled={invoiceStatusUpdatingId === inv.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: invoiceStatusUpdatingId === inv.id ? 'not-allowed' : 'pointer' }}>Send<br />back</button>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                            <button type="button" onClick={() => setMarkPaidInvoice(inv)} disabled={invoiceStatusUpdatingId === inv.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: invoiceStatusUpdatingId === inv.id ? 'not-allowed' : 'pointer' }}>{invoiceStatusUpdatingId === inv.id ? '…' : 'Mark Paid'}</button>
                            {inv.open_since_at && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'center' }} title="Time open">Open {formatTimeSince(inv.open_since_at)}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }
                const j = unit.job
                const remaining = Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)
                return (
                  <div key={j.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', marginBottom: '0.75rem', background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{j.hcp_number || '—'} · {j.job_name || '—'}</div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          {j.job_address?.trim() ? (
                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{j.job_address}</a>
                          ) : (
                            '—'
                          )}
                        </div>
                        <div style={{ fontSize: '0.875rem', marginTop: 4 }}>Remaining: ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {(j.google_drive_link?.trim() || j.job_plans_link?.trim()) && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                            {j.google_drive_link?.trim() && (
                              <a href={j.google_drive_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.google_drive_link!.trim()) }} title="Google Drive" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true"><path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" /></svg>
                              </a>
                            )}
                            {j.job_plans_link?.trim() && (
                              <a href={j.job_plans_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.job_plans_link!.trim()) }} title="Job Plans" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true"><path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" /></svg>
                              </a>
                            )}
                          </div>
                        )}
                          <button type="button" onClick={() => setViewBillDetailsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—', revenue: j.revenue })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: 'none', cursor: 'pointer', textDecoration: 'none' }}>View<br />Details</button>
                        <button type="button" onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                        <button type="button" onClick={() => { setSendBackChecked(false); setSendBackJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', toStatus: 'ready_to_bill', rtbDraftCount: 0 }) }} disabled={jobStatusUpdatingId === j.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer' }}>Send<br />back</button>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                          <button type="button" onClick={() => setMarkPaidJob(j)} disabled={jobStatusUpdatingId === j.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer' }}>{jobStatusUpdatingId === j.id ? '…' : 'Mark Paid'}</button>
                          {j.created_at && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'center' }} title="Time since job created">Open {formatTimeSince(j.created_at)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          </>
          )}
        </div>
          </BillingPipelineStage>
        )}
        </BillingPipelineCard>
      )}

      {(userLoading || showChecklist) && (
        <div id="dash-my-inbox" style={{ marginTop: '1.5rem', marginBottom: '2rem', scrollMarginTop: 8 }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>
            Checklist: Due Today
            <Link to="/checklist" style={{ marginLeft: '0.5rem', fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-link)' }}>
              View all →
            </Link>
          </h2>
          {checklistLoading && todayChecklist.length === 0 ? (
            <ChecklistSkeleton />
          ) : todayChecklist.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {todayChecklist.map((inst) => {
              const title = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled'
              const links = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.links
              const isCompleted = !!inst.completed_at
              return (
                <li
                  key={inst.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    marginBottom: '0.5rem',
                    background: isCompleted ? 'var(--bg-green-tint)' : 'var(--surface)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={() => void toggleChecklistComplete(inst)}
                  />
                  <span style={{ flex: 1, fontWeight: 500, textDecoration: isCompleted ? 'line-through' : 'none', color: isCompleted ? 'var(--text-muted)' : 'inherit' }}>
                    <ChecklistTitleWithLinks title={title} links={links} />
                  </span>
                  {inst.completed_at && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(inst.completed_at).toLocaleString()}
                    </span>
                  )}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {isNotificationRecipient(inst) && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); openMuteModal(inst) }}
                        style={{
                          padding: '0.2rem',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          background: 'var(--surface)',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          lineHeight: 1,
                        }}
                        title="Mute notifications for this task"
                        aria-label="Mute notifications for this task"
                      >
                        🔕
                      </button>
                    )}
                    {isDev && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); openFwd(inst) }}
                        style={{
                          padding: 0,
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          color: 'var(--text-faint)',
                          textDecoration: 'underline',
                        }}
                      >
                        fwd
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          ) : null}
        </div>
      )}
      {(outstandingLoading || outstandingItems.length > 0) && (
        <div style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>
            Checklist: Outstanding
            <Link to="/checklist?tab=review" style={{ marginLeft: '0.5rem', fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-link)' }}>
              View all →
            </Link>
          </h2>
          {outstandingLoading && outstandingItems.length === 0 ? (
            <ChecklistSkeleton />
          ) : outstandingItems.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {outstandingItems.map((inst) => {
                const title = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled'
                const links = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.links
                return (
                  <li
                    key={inst.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      marginBottom: '0.5rem',
                      background: 'var(--surface)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!inst.completed_at}
                      onChange={() => void toggleOutstandingComplete(inst)}
                      title="Mark complete"
                      aria-label="Mark complete"
                    />
                    <span style={{ flex: 1, fontWeight: 500 }}>
                      <ChecklistTitleWithLinks title={title} links={links} />
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {' '}({formatTDays(getDaysUntilDue(inst.scheduled_date))})
                    </span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); openFwd(inst) }}
                      title="Forward"
                      aria-label="Forward"
                      style={{
                        padding: '0.25rem',
                        border: 'none',
                        borderRadius: 4,
                        background: 'transparent',
                        color: 'var(--text-blue-500)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path d="M371.8 82.4C359.8 87.4 352 99 352 112L352 192L240 192C142.8 192 64 270.8 64 368C64 481.3 145.5 531.9 164.2 542.1C166.7 543.5 169.5 544 172.3 544C183.2 544 192 535.1 192 524.3C192 516.8 187.7 509.9 182.2 504.8C172.8 496 160 478.4 160 448.1C160 395.1 203 352.1 256 352.1L352 352.1L352 432.1C352 445 359.8 456.7 371.8 461.7C383.8 466.7 397.5 463.9 406.7 454.8L566.7 294.8C579.2 282.3 579.2 262 566.7 249.5L406.7 89.5C397.5 80.3 383.8 77.6 371.8 82.6z" />
                      </svg>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      )}
      {isSubcontractorLikeRole(role) && (
        <div style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: '0.5rem', minWidth: 0 }}>
              {firstAssistantDispatchPhone ? (
                <a
                  href={`tel:${firstAssistantDispatchPhone.telHref}`}
                  style={{ color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }}
                  aria-label={`Call dispatch at ${firstAssistantDispatchPhone.display}`}
                  title={`Call dispatch at ${firstAssistantDispatchPhone.display}`}
                >
                  <h2 style={{ fontSize: '1.125rem', margin: 0, whiteSpace: 'nowrap' }}>My Schedule</h2>
                </a>
              ) : (
                <h2 style={{ fontSize: '1.125rem', margin: 0, whiteSpace: 'nowrap' }}>My Schedule</h2>
              )}
              {firstAssistantDispatchPhone && (
                <a
                  href={`tel:${firstAssistantDispatchPhone.telHref}`}
                  style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textDecoration: 'none', lineHeight: 1.15, whiteSpace: 'nowrap' }}
                  aria-label={`Schedule wrong? Click to call dispatch at ${firstAssistantDispatchPhone.display}`}
                  title={`Call dispatch at ${firstAssistantDispatchPhone.display}`}
                >
                  (schedule wrong?<br />click to call dispatch)
                </a>
              )}
            </div>
            <Link to="/calendar" style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-link)' }}>
              Calendar →
            </Link>
          </div>
          {subScheduleLoading ? (
            <DashboardListRowSkeleton rows={2} />
          ) : (
            <>
              {(['today', 'tomorrow'] as const).map((which) => {
                const ymd = which === 'today' ? subScheduleDayPartition.todayYmd : subScheduleDayPartition.tomorrowYmd
                const blocks =
                  which === 'today' ? subScheduleDayPartition.todayBlocks : subScheduleDayPartition.tomorrowBlocks
                const dayTitle = which === 'today' ? 'Today' : 'Tomorrow'
                const sorted = [...blocks].sort((a, b) => a.time_start.localeCompare(b.time_start))
                return (
                  <div key={which} style={{ marginBottom: which === 'today' ? '1.25rem' : 0 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem 0', color: 'var(--text-700)', textAlign: 'center' }}>
                      {dayTitle}
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                        {scheduleFormatWeekdayLong(ymd)}
                      </span>
                    </h3>
                    {sorted.length === 0 ? (
                      <p style={{ margin: 0, color: 'var(--text-faint)', fontSize: '0.875rem', textAlign: 'center' }}>No blocks scheduled.</p>
                    ) : (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {sorted.map((b) => {
                          const rowLabel = subScheduleLabels.get(b.job_id) ?? 'Job'
                          const fromAssigned =
                            assignedJobs.find((j) => j.id === b.job_id) ??
                            assignedReadyToBillJobs.find((j) => j.id === b.job_id)
                          const prefillAddr = (fromAssigned?.job_address ?? '').trim() || null
                          const scheduleDetailPayload = {
                            jobId: b.job_id,
                            prefillRowLabel: rowLabel,
                            prefillAddress: prefillAddr,
                            scheduleContext: {
                              workDate: b.work_date,
                              timeStart: b.time_start,
                              timeEnd: b.time_end,
                              note: b.note,
                            },
                          }
                          return (
                            <li
                              key={b.id}
                              role="button"
                              tabIndex={0}
                              onClick={() =>
                                jobDetailModal?.openJobDetail({
                                  ...scheduleDetailPayload,
                                  assignedJobsRows: detailModalAssignedJobsRows,
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  jobDetailModal?.openJobDetail({
                                    ...scheduleDetailPayload,
                                    assignedJobsRows: detailModalAssignedJobsRows,
                                  })
                                }
                              }}
                              aria-label={`Job details: ${rowLabel}`}
                              style={{
                                padding: '0.5rem 0.75rem',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                marginBottom: '0.5rem',
                                background: 'var(--surface)',
                                cursor: 'pointer',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  gap: '0.75rem',
                                }}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 500,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      minWidth: 0,
                                    }}
                                  >
                                    <span
                                      style={{
                                        minWidth: 0,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {rowLabel}
                                    </span>
                                    {(() => {
                                      const phone = (subSchedulePhones.get(b.job_id) ?? '').trim()
                                      if (!phone) return null
                                      return (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            openInExternalBrowser(`tel:${phone}`)
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.stopPropagation()
                                            }
                                          }}
                                          aria-label={`Call customer at ${phone}`}
                                          title={`Call customer at ${phone}`}
                                          style={{
                                            flexShrink: 0,
                                            background: 'transparent',
                                            border: 'none',
                                            padding: '0.2rem',
                                            cursor: 'pointer',
                                            color: 'var(--text-link)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                          }}
                                        >
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 640 640"
                                            width={16}
                                            height={16}
                                            aria-hidden
                                            focusable={false}
                                            style={{ display: 'block' }}
                                          >
                                            <path
                                              fill="currentColor"
                                              d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C493 589.3 555.5 534 573.1 469.4L574.6 463.9C580 444.2 569.9 423.6 551.1 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 241.3 341 208.8 269.3L253 233.3C266.9 222 271.6 202.9 264.8 186.3L224.2 89z"
                                            />
                                          </svg>
                                        </button>
                                      )
                                    })()}
                                  </div>
                                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                    {scheduleFormatWindow(b.time_start, b.time_end)}
                                  </div>
                                  {b.note?.trim() ? (
                                    <div
                                      style={{
                                        fontSize: '0.8125rem',
                                        color: 'var(--text-faint)',
                                        marginTop: '0.35rem',
                                        wordBreak: 'break-word',
                                      }}
                                    >
                                      {b.note.trim()}
                                    </div>
                                  ) : null}
                                </div>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    flexShrink: 0,
                                  }}
                                >
                                  <DashboardJobPicturesLinkRow
                                    layout="inline"
                                    size="large"
                                    jobPicturesLink={fromAssigned?.job_pictures_link}
                                    onMissingClick={() =>
                                      void submitLinkJobPicturesDispatchRequest({
                                        jobId: b.job_id,
                                        hcpNumber: fromAssigned?.hcp_number,
                                        jobName: fromAssigned?.job_name ?? rowLabel,
                                        jobAddress: fromAssigned?.job_address,
                                      })
                                    }
                                  />
                                  {canLeaveJobFieldReport(role) ? (
                                    <DashboardLeaveReportButton
                                      showReminder={
                                        fromAssigned ? leaveReportReminderForJobRow(fromAssigned) : false
                                      }
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setLeaveReportJob({
                                          id: b.job_id,
                                          hcpNumber: fromAssigned?.hcp_number ?? '—',
                                          jobName: fromAssigned?.job_name ?? rowLabel,
                                          jobAddress: fromAssigned?.job_address ?? '—',
                                        })
                                      }}
                                    />
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
      {(role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'estimator' || role === 'primary') && (myBidsLoading || myBids.some((b) => !hiddenBidIds.has(b.id))) && (
        <div id="dash-bids" style={{ marginBottom: '1rem', scrollMarginTop: 8 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: !isMobile && !myBidsSectionExpanded ? 'flex-start' : 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: !isMobile && !myBidsSectionExpanded ? 0 : '0.5rem',
            }}
          >
            {isMobile ? (
              <h2 style={{ fontSize: '1.125rem', margin: 0 }}>
                {myBidsLoading ? 'My Bids' : `My Bids (${myBidsVisibleCount})`}
              </h2>
            ) : (
              <button
                type="button"
                onClick={() => setMyBidsSectionExpanded((prev) => !prev)}
                aria-expanded={myBidsSectionExpanded}
                aria-label={
                  myBidsLoading
                    ? 'My Bids, loading'
                    : `My Bids, ${myBidsVisibleCount} ${myBidsVisibleCount === 1 ? 'bid' : 'bids'}`
                }
                style={{
                  margin: 0,
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span aria-hidden>{myBidsSectionExpanded ? '\u25BC' : '\u25B6'}</span>
                <h2 style={{ fontSize: '1.125rem', margin: 0 }}>
                  {myBidsLoading ? 'My Bids' : `My Bids (${myBidsVisibleCount})`}
                </h2>
              </button>
            )}
            {(isMobile || myBidsSectionExpanded) && (
              <Link
                to="/bids?new=true"
                style={{
                  padding: '0.35rem 0.75rem',
                  background: '#3b82f6',
                  color: 'white',
                  borderRadius: 6,
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                New Bid
              </Link>
            )}
          </div>
          {(isMobile || myBidsSectionExpanded) && (myBidsLoading ? (
            <MyBidsSectionSkeleton />
          ) : (
            <>
              {(() => {
                const visibleBids = myBids.filter((b) => !hiddenBidIds.has(b.id))
                const unsentBids = visibleBids.filter((b) => !b.bid_date_sent)
                const sentBids = visibleBids.filter((b) => b.bid_date_sent != null)
                function formatMyBidPreviewDate(iso: string): string {
                  try {
                    return new Date(iso).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: '2-digit',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  } catch {
                    return iso
                  }
                }
                function truncateMyBidNotePreview(text: string | null, max: number): string {
                  if (!text?.trim()) return ''
                  const t = text.trim()
                  return t.length <= max ? t : `${t.slice(0, max)}…`
                }
                const myBidPillEstimator: CSSProperties = {
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.45rem',
                  borderRadius: 4,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  background: 'var(--bg-blue-200)',
                  border: '1px solid #93c5fd',
                  color: 'var(--text-blue-800)',
                }
                const myBidPillAccountManager: CSSProperties = {
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.45rem',
                  borderRadius: 4,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  background: '#ede9fe',
                  border: '1px solid #c4b5fd',
                  color: '#5b21b6',
                }
                const renderBidItem = (b: typeof myBids[0], cardStyle: CSSProperties, mode: 'visible' | 'hidden' = 'visible') => {
                  const status =
                    !b.bid_date_sent
                      ? 'Unsent'
                      : b.outcome === 'won'
                        ? 'Won'
                        : b.outcome === 'started_or_complete'
                          ? 'Started or Complete'
                          : 'Pending'
                  const dueStr = b.bid_due_date
                    ? new Date(b.bid_due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
                    : '—'
                  const hasUnread = b.unreadBidNotes || b.unreadCustomerNotes
                  const myBidMetaBold: CSSProperties = { fontWeight: 600 }
                  return (
                    <li key={b.id} style={{ marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Link
                          to={`/bids?bidId=${encodeURIComponent(b.id)}&tab=submission-followup`}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'block',
                            padding: '0.5rem 0.75rem',
                            ...cardStyle,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'row',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: '0.5rem',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontWeight: 500 }}>{b.project_name || 'Untitled'}</span>
                              {b.service_type_name && (
                                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({b.service_type_name})</span>
                              )}
                            </div>
                            <div
                              style={{
                                flexShrink: 0,
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'flex-end',
                                alignItems: 'flex-start',
                                gap: '0.25rem',
                              }}
                            >
                              {(b.myBidRoles === 'estimator' || b.myBidRoles === 'both') && (
                                <span style={myBidPillEstimator}>Estimator</span>
                              )}
                              {(b.myBidRoles === 'account_manager' || b.myBidRoles === 'both') && (
                                <span style={myBidPillAccountManager}>Account Manager</span>
                              )}
                            </div>
                          </div>
                          <div style={{ marginTop: '0.25rem', color: 'var(--text-600)' }}>
                            Due {dueStr} · {status}
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            bidPreview?.openBidPreview(b.id)
                          }}
                          style={{
                            flexShrink: 0,
                            padding: '0.35rem 0.55rem',
                            background: 'var(--bg-muted)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            color: 'var(--text-700)',
                            fontSize: '0.8125rem',
                          }}
                          title="Preview bid"
                        >
                          Preview
                        </button>
                        {mode === 'visible' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              hideBid(b.id)
                            }}
                            style={{
                              flexShrink: 0,
                              padding: '0.35rem',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-muted)',
                            }}
                            title="Hide bid"
                            aria-label="Hide bid"
                          >
                            <svg width="16" height="16" viewBox="0 0 640 640" fill="currentColor" style={{ display: 'block' }}>
                              <path d="M73 39.1C63.6 29.7 48.4 29.7 39.1 39.1C29.8 48.5 29.7 63.7 39 73.1L567 601.1C576.4 610.5 591.6 610.5 600.9 601.1C610.2 591.7 610.3 576.5 600.9 567.2L504.5 470.8C507.2 468.4 509.9 466 512.5 463.6C559.3 420.1 590.6 368.2 605.5 332.5C608.8 324.6 608.8 315.8 605.5 307.9C590.6 272.2 559.3 220.2 512.5 176.8C465.4 133.1 400.7 96.2 319.9 96.2C263.1 96.2 214.3 114.4 173.9 140.4L73 39.1zM208.9 175.1C241 156.2 278.1 144 320 144C385.2 144 438.8 173.6 479.9 211.7C518.4 247.4 545 290 558.5 320C544.9 350 518.3 392.5 479.9 428.3C476.8 431.1 473.7 433.9 470.5 436.7L425.8 392C439.8 371.5 448 346.7 448 320C448 249.3 390.7 192 320 192C293.3 192 268.5 200.2 248 214.2L208.9 175.1zM390.9 357.1L282.9 249.1C294 243.3 306.6 240 320 240C364.2 240 400 275.8 400 320C400 333.4 396.7 346 390.9 357.1zM135.4 237.2L101.4 203.2C68.8 240 46.4 279 34.5 307.7C31.2 315.6 31.2 324.4 34.5 332.3C49.4 368 80.7 420 127.5 463.4C174.6 507.1 239.3 544 320.1 544C357.4 544 391.3 536.1 421.6 523.4L384.2 486C364.2 492.4 342.8 496 320 496C254.8 496 201.2 466.4 160.1 428.3C121.6 392.6 95 350 81.5 320C91.9 296.9 110.1 266.4 135.5 237.2z" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => unhideBid(b.id)}
                            style={{
                              flexShrink: 0,
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.8125rem',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: 'var(--surface)',
                              color: 'var(--text-700)',
                              cursor: 'pointer',
                            }}
                          >
                            Add back
                          </button>
                        )}
                      </div>
                      {hasUnread ? (
                        <div
                          role="region"
                          aria-label={`Unread notes for ${b.project_name || 'bid'}`}
                          style={{
                            marginTop: '0.35rem',
                            marginLeft: '0.5rem',
                            padding: '0.6rem 0.75rem 0.6rem 1rem',
                            background: 'var(--bg-amber-tint)',
                            border: '1px solid #fcd34d',
                            borderLeft: '3px solid #f59e0b',
                            borderRadius: 6,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '0.5rem',
                              flexWrap: 'wrap',
                              marginBottom:
                                (b.unreadBidNotes && b.othersBidUpdates.length > 0) ||
                                (b.unreadCustomerNotes && b.othersCustomerUpdates.length > 0)
                                  ? '0.5rem'
                                  : 0,
                            }}
                          >
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>Unread updates</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                void markMyBidNotesReadAsViewed(b.id)
                              }}
                              style={{
                                flexShrink: 0,
                                padding: '0.35rem 0.6rem',
                                fontSize: '0.8125rem',
                                border: '1px solid #d97706',
                                borderRadius: 4,
                                background: 'var(--surface)',
                                color: 'var(--text-amber-900)',
                                cursor: 'pointer',
                                fontWeight: 500,
                              }}
                            >
                              Mark read
                            </button>
                          </div>
                          {b.unreadBidNotes && b.othersBidUpdates.length > 0 ? (
                            <div style={{ marginTop: '0.35rem' }}>
                              {(() => {
                                const lim = myBidOthersVisibleLimits[b.id] ?? { bid: 1, customer: 1 }
                                const bidTotal = b.othersBidUpdates.length
                                const bidLimit = Math.min(Math.max(1, lim.bid), bidTotal)
                                const bidSlice = b.othersBidUpdates.slice(0, bidLimit)
                                const othersBtn: CSSProperties = {
                                  padding: 0,
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.8125rem',
                                  color: 'var(--text-amber-800)',
                                  textDecoration: 'underline',
                                  fontWeight: 500,
                                }
                                return (
                                  <>
                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'flex-start',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        flexWrap: 'wrap',
                                        marginBottom: '0.35rem',
                                      }}
                                    >
                                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>
                                        Recent Bid Notes
                                      </span>
                                      <div
                                        style={{
                                          display: 'flex',
                                          gap: '0.75rem',
                                          flexWrap: 'wrap',
                                          alignItems: 'center',
                                        }}
                                      >
                                        {bidTotal > bidLimit ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              adjustMyBidOthersLimit(b.id, 'bid', 'more', bidTotal)
                                            }}
                                            style={othersBtn}
                                          >
                                            Show more
                                          </button>
                                        ) : null}
                                        {bidTotal > bidLimit && bidLimit > 1 ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              adjustMyBidOthersLimit(b.id, 'bid', 'all', bidTotal)
                                            }}
                                            style={othersBtn}
                                          >
                                            Show all
                                          </button>
                                        ) : null}
                                        {bidLimit > 1 ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              adjustMyBidOthersLimit(b.id, 'bid', 'less', bidTotal)
                                            }}
                                            style={othersBtn}
                                          >
                                            Show less
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                    {bidSlice.map((item, idx) => {
                                      const teaser =
                                        truncateMyBidNotePreview(item.text, 90) || 'No note text'
                                      const detailKey = `bid:${item.id}`
                                      const isNoteOpen = myBidOthersNoteDetailsOpen.has(detailKey)
                                      const fullBody = item.text?.trim() ? item.text : 'No note text.'
                                      return (
                                        <details
                                          key={item.id}
                                          open={isNoteOpen}
                                          onToggle={(e) => {
                                            toggleMyBidOthersNoteDetails(
                                              detailKey,
                                              (e.currentTarget as HTMLDetailsElement).open
                                            )
                                          }}
                                          style={{ marginTop: idx > 0 ? '0.5rem' : 0 }}
                                        >
                                          <summary
                                            style={{
                                              cursor: 'pointer',
                                              fontSize: '0.8125rem',
                                              color: 'var(--text-amber-900)',
                                              listStyle: 'none',
                                            }}
                                          >
                                            {isNoteOpen ? (
                                              <span
                                                style={{
                                                  fontWeight: 400,
                                                  whiteSpace: 'pre-wrap',
                                                  display: 'block',
                                                  maxHeight: 200,
                                                  overflowY: 'auto',
                                                  lineHeight: 1.45,
                                                }}
                                              >
                                                <span style={myBidMetaBold}>
                                                  ({formatRelativeCompactAgo(item.createdAt)})
                                                </span>{' '}
                                                {fullBody} -{' '}
                                                <span style={myBidMetaBold}>{item.authorLabel ?? 'Someone'}</span>
                                                {' '}·{' '}
                                                {formatMyBidPreviewDate(item.createdAt)}
                                              </span>
                                            ) : (
                                              <span style={{ fontWeight: 400 }}>
                                                {teaser} -{' '}
                                                <span style={myBidMetaBold}>
                                                  {item.authorLabel ?? 'Someone'} (
                                                  {formatRelativeCompactAgo(item.createdAt)})
                                                </span>
                                              </span>
                                            )}
                                          </summary>
                                          {isNoteOpen && item.contactMethod ? (
                                            <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#a16207' }}>
                                              <span>Method: {item.contactMethod}</span>
                                            </div>
                                          ) : null}
                                        </details>
                                      )
                                    })}
                                  </>
                                )
                              })()}
                            </div>
                          ) : null}
                          {b.unreadCustomerNotes && b.othersCustomerUpdates.length > 0 ? (
                            <div style={{ marginTop: '0.5rem' }}>
                              {(() => {
                                const lim = myBidOthersVisibleLimits[b.id] ?? { bid: 1, customer: 1 }
                                const custTotal = b.othersCustomerUpdates.length
                                const custLimit = Math.min(Math.max(1, lim.customer), custTotal)
                                const custSlice = b.othersCustomerUpdates.slice(0, custLimit)
                                const othersBtn: CSSProperties = {
                                  padding: 0,
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.8125rem',
                                  color: 'var(--text-amber-800)',
                                  textDecoration: 'underline',
                                  fontWeight: 500,
                                }
                                return (
                                  <>
                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'flex-start',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        flexWrap: 'wrap',
                                        marginBottom: '0.35rem',
                                      }}
                                    >
                                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>
                                        Recent Customer Notes
                                      </span>
                                      <div
                                        style={{
                                          display: 'flex',
                                          gap: '0.75rem',
                                          flexWrap: 'wrap',
                                          alignItems: 'center',
                                        }}
                                      >
                                        {custTotal > custLimit ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              adjustMyBidOthersLimit(b.id, 'customer', 'more', custTotal)
                                            }}
                                            style={othersBtn}
                                          >
                                            Show more
                                          </button>
                                        ) : null}
                                        {custTotal > custLimit && custLimit > 1 ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              adjustMyBidOthersLimit(b.id, 'customer', 'all', custTotal)
                                            }}
                                            style={othersBtn}
                                          >
                                            Show all
                                          </button>
                                        ) : null}
                                        {custLimit > 1 ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              adjustMyBidOthersLimit(b.id, 'customer', 'less', custTotal)
                                            }}
                                            style={othersBtn}
                                          >
                                            Show less
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                    {custSlice.map((item, idx) => {
                                      const teaser =
                                        truncateMyBidNotePreview(item.text, 90) || 'No note text'
                                      const detailKey = `cust:${item.id}`
                                      const isNoteOpen = myBidOthersNoteDetailsOpen.has(detailKey)
                                      const fullBody = item.text?.trim() ? item.text : 'No note text.'
                                      return (
                                        <details
                                          key={item.id}
                                          open={isNoteOpen}
                                          onToggle={(e) => {
                                            toggleMyBidOthersNoteDetails(
                                              detailKey,
                                              (e.currentTarget as HTMLDetailsElement).open
                                            )
                                          }}
                                          style={{ marginTop: idx > 0 ? '0.5rem' : 0 }}
                                        >
                                          <summary
                                            style={{
                                              cursor: 'pointer',
                                              fontSize: '0.8125rem',
                                              color: 'var(--text-amber-900)',
                                              listStyle: 'none',
                                            }}
                                          >
                                            {isNoteOpen ? (
                                              <span
                                                style={{
                                                  fontWeight: 400,
                                                  whiteSpace: 'pre-wrap',
                                                  display: 'block',
                                                  maxHeight: 200,
                                                  overflowY: 'auto',
                                                  lineHeight: 1.45,
                                                }}
                                              >
                                                <span style={myBidMetaBold}>
                                                  ({formatRelativeCompactAgo(item.createdAt)})
                                                </span>{' '}
                                                {fullBody} -{' '}
                                                <span style={myBidMetaBold}>{item.authorLabel ?? 'Someone'}</span>
                                                {' '}·{' '}
                                                {formatMyBidPreviewDate(item.createdAt)}
                                              </span>
                                            ) : (
                                              <span style={{ fontWeight: 400 }}>
                                                {teaser} -{' '}
                                                <span style={myBidMetaBold}>
                                                  {item.authorLabel ?? 'Someone'} (
                                                  {formatRelativeCompactAgo(item.createdAt)})
                                                </span>
                                              </span>
                                            )}
                                          </summary>
                                          {isNoteOpen && (item.contactMethod || item.contactDate) ? (
                                            <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#a16207' }}>
                                              {item.contactMethod ? <span>Method: {item.contactMethod}</span> : null}
                                              {item.contactMethod && item.contactDate ? ' · ' : null}
                                              {item.contactDate ? (
                                                <span>Contact: {formatMyBidPreviewDate(item.contactDate)}</span>
                                              ) : null}
                                            </div>
                                          ) : null}
                                        </details>
                                      )
                                    })}
                                  </>
                                )
                              })()}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  )
                }
                const unsentCardStyle: CSSProperties = { background: 'var(--bg-blue-tint)', border: '1px solid #bfdbfe', borderRadius: 4, color: 'var(--text-blue-800)', textDecoration: 'none', fontSize: '0.875rem' }
                const sentCardStyle: CSSProperties = { background: 'var(--bg-blue-tint)', border: '1px solid #bfdbfe', borderRadius: 4, color: 'var(--text-blue-800)', textDecoration: 'none', fontSize: '0.875rem' }
                const hiddenBidCardStyle: CSSProperties = {
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-700)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                }
                return (
                  <>
                    {unsentBids.length === 0 && sentBids.length > 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No unsent bids</p>
                    ) : null}
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {unsentBids.map((b) => renderBidItem(b, unsentCardStyle))}
                    </ul>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <Link
                        to="/bids?tab=bid-board"
                        style={{
                          fontSize: '0.875rem',
                          color: 'var(--text-link)',
                          textDecoration: 'underline',
                        }}
                      >
                        View all
                      </Link>
                      <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {sentBids.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSentBidsExpanded((x) => !x)}
                            style={{
                              padding: 0,
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              color: 'var(--text-link)',
                              textDecoration: 'underline',
                            }}
                          >
                            Sent bids ({sentBids.length}) {sentBidsExpanded ? '\u25B2' : '\u25BC'}
                          </button>
                        )}
                        {hiddenBidIds.size > 0 && (
                          <button
                            type="button"
                            onClick={() => setHiddenBidsExpanded((x) => !x)}
                            style={{
                              padding: 0,
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              color: 'var(--text-link)',
                              textDecoration: 'underline',
                            }}
                          >
                            View hidden ({hiddenBidIds.size})
                          </button>
                        )}
                      </span>
                    </div>
                    {sentBidsExpanded && sentBids.length > 0 && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Sent bids</div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {sentBids.map((b) => renderBidItem(b, sentCardStyle))}
                        </ul>
                      </div>
                    )}
              {hiddenBidsExpanded && hiddenBidIds.size > 0 && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Hidden bids</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {myBids.filter((b) => hiddenBidIds.has(b.id)).map((b) => renderBidItem(b, hiddenBidCardStyle, 'hidden'))}
                  </ul>
                </div>
              )}
            </>
          )
        })()}
      </>
          ))}
        </div>
      )}
      {isDev && (
        <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: completedItemsOpen ? '0.75rem' : 0 }}>
            <h2
              style={{
                fontSize: '1.125rem',
                margin: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
              onClick={() => setCompletedItemsOpen((o) => !o)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setCompletedItemsOpen((o) => !o)}
            >
              {completedItemsOpen ? '▼' : '▶'} Recently Completed Tasks
              {(() => {
                const visibleItems = completedItems.filter((inst) => !ignoredItemIds.has(inst.checklist_item_id))
                const n = visibleItems.filter((inst) => !readInstanceIds.has(inst.id)).length
                return n > 0 ? <span style={{ fontWeight: 600, color: 'var(--text-link)' }}>{' - '}{n} UNREAD</span> : null
              })()}
            </h2>
          </div>
          {completedItemsOpen && (
            <>
              {completedItemsLoading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
              ) : completedItems.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No completed items in the last 7 days.</p>
              ) : (
                (() => {
                  const visibleItems = completedItems.filter((inst) => !ignoredItemIds.has(inst.checklist_item_id))
                  const ignoredItems = completedItems.filter((inst) => ignoredItemIds.has(inst.checklist_item_id))
                  const byCompleter = new Map<string, ChecklistInstance[]>()
                  visibleItems.forEach((inst) => {
                    const cid = inst.completed_by_user_id ?? 'unknown'
                    if (!byCompleter.has(cid)) byCompleter.set(cid, [])
                    byCompleter.get(cid)!.push(inst)
                  })
                  const getUserName = (id: string | null) => {
                    if (!id) return 'Unknown'
                    return completedItemsUserMap.get(id) ?? id.slice(0, 8) + '…'
                  }
                  return (
                    <>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {Array.from(byCompleter.entries()).map(([completerId, items]) => {
                        const isExpanded = expandedCompleterIds.has(completerId)
                        const completerName = getUserName(completerId === 'unknown' ? null : completerId)
                        const unreadCount = items.filter((inst) => !readInstanceIds.has(inst.id)).length
                        return (
                          <li key={completerId} style={{ marginBottom: '0.5rem' }}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setExpandedCompleterIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(completerId)) next.delete(completerId)
                                else next.add(completerId)
                                return next
                              })}
                              onKeyDown={(e) => e.key === 'Enter' && setExpandedCompleterIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(completerId)) next.delete(completerId)
                                else next.add(completerId)
                                return next
                              })}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                cursor: 'pointer',
                                background: 'var(--bg-subtle)',
                              }}
                            >
                              <span style={{ fontSize: '0.875rem', minWidth: 16 }}>{isExpanded ? '▼' : '▶'}</span>
                              <span style={{ fontWeight: 500 }}>{completerName}</span>
                              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>({items.length} item{items.length !== 1 ? 's' : ''}{unreadCount > 0 ? ` · ${unreadCount} unread` : ''})</span>
                            </div>
                            {isExpanded && (
                              <ul style={{ listStyle: 'none', padding: '0.5rem 0 0 1.5rem', margin: 0 }}>
                                {items.map((inst) => {
                                  const title = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled'
                                  const links = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.links
                                  const isRead = readInstanceIds.has(inst.id)
                                  const assigneeName = (inst.checklist_instance_assignees ?? [])
                                    .map((a) => getUserName(a.user_id))
                                    .filter(Boolean)
                                    .join(', ') || '—'
                                  return (
                                    <li
                                      key={inst.id}
                                      style={{
                                        display: 'flex',
                                        flexDirection: isMobile ? 'column' : 'row',
                                        alignItems: isMobile ? 'stretch' : 'center',
                                        gap: isMobile ? '0.5rem' : '0.75rem',
                                        padding: '0.5rem 0.75rem',
                                        border: '1px solid var(--border)',
                                        borderRadius: 8,
                                        marginTop: '0.5rem',
                                        background: isRead ? 'var(--surface)' : 'var(--bg-sky-tint)',
                                      }}
                                    >
                                      {!isMobile && (
                                        <button
                                          type="button"
                                          title="Ignore"
                                          onClick={(e) => { e.stopPropagation(); ignoreTaskType(inst.checklist_item_id) }}
                                          disabled={!!ignoringItemId}
                                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: ignoringItemId ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M73 39.1C63.6 29.7 48.4 29.7 39.1 39.1C29.8 48.5 29.7 63.7 39 73.1L567 601.1C576.4 610.5 591.6 610.5 600.9 601.1C610.2 591.7 610.3 576.5 600.9 567.2L513.1 479.4C530.6 476.1 543.9 460.7 543.9 442.3C543.9 435.6 542.1 429 538.8 423.3L517 385.7C498 353.1 488 316.1 488 278.4L488 263.9C488 179.3 425.4 109.2 344 97.6L344 87.9C344 74.6 333.3 63.9 320 63.9C306.7 63.9 296 74.6 296 87.9L296 97.6C253.8 103.6 216.6 125.4 190.6 156.7L73 39.1zM224.8 190.9C246.7 162.4 281.2 144 320 144C386.3 144 440 197.7 440 264L440 278.5C440 324.7 452.3 370 475.5 409.9L488.4 432L465.8 432L224.7 190.9zM164.5 409.9C184 376.5 195.8 339.2 199.1 300.9L152.4 254.2C152.2 257.5 152.1 260.8 152.1 264.1L152.1 278.6C152.1 316.3 142.1 353.3 123.1 385.9L101.1 423.2C97.7 429 96 435.5 96 442.2C96 463.1 112.9 480 133.8 480L378.2 480L330.2 432L151.6 432L164.5 409.9zM252.1 528C262 556 288.7 576 320 576C351.3 576 378 556 387.9 528L252.1 528z"/></svg>
                                        </button>
                                      )}
                                      <span style={{ width: isMobile ? '100%' : undefined, flex: isMobile ? undefined : 1, fontWeight: 500, minWidth: 0 }}><ChecklistTitleWithLinks title={title} links={links} /></span>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', flex: isMobile ? undefined : 1, minWidth: 0 }}>
                                        {isMobile && (
                                          <button
                                            type="button"
                                            title="Ignore"
                                            onClick={(e) => { e.stopPropagation(); ignoreTaskType(inst.checklist_item_id) }}
                                            disabled={!!ignoringItemId}
                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: ignoringItemId ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M73 39.1C63.6 29.7 48.4 29.7 39.1 39.1C29.8 48.5 29.7 63.7 39 73.1L567 601.1C576.4 610.5 591.6 610.5 600.9 601.1C610.2 591.7 610.3 576.5 600.9 567.2L513.1 479.4C530.6 476.1 543.9 460.7 543.9 442.3C543.9 435.6 542.1 429 538.8 423.3L517 385.7C498 353.1 488 316.1 488 278.4L488 263.9C488 179.3 425.4 109.2 344 97.6L344 87.9C344 74.6 333.3 63.9 320 63.9C306.7 63.9 296 74.6 296 87.9L296 97.6C253.8 103.6 216.6 125.4 190.6 156.7L73 39.1zM224.8 190.9C246.7 162.4 281.2 144 320 144C386.3 144 440 197.7 440 264L440 278.5C440 324.7 452.3 370 475.5 409.9L488.4 432L465.8 432L224.7 190.9zM164.5 409.9C184 376.5 195.8 339.2 199.1 300.9L152.4 254.2C152.2 257.5 152.1 260.8 152.1 264.1L152.1 278.6C152.1 316.3 142.1 353.3 123.1 385.9L101.1 423.2C97.7 429 96 435.5 96 442.2C96 463.1 112.9 480 133.8 480L378.2 480L330.2 432L151.6 432L164.5 409.9zM252.1 528C262 556 288.7 576 320 576C351.3 576 378 556 387.9 528L252.1 528z"/></svg>
                                          </button>
                                        )}
                                        {isMobile ? (
                                          <span style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            <span style={{ display: 'block' }}>{inst.completed_at && new Date(inst.completed_at).toLocaleDateString()}</span>
                                            <span style={{ display: 'block' }}>{inst.completed_at && new Date(inst.completed_at).toLocaleTimeString()}</span>
                                          </span>
                                        ) : (
                                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {inst.completed_at && new Date(inst.completed_at).toLocaleString()}
                                          </span>
                                        )}
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>→ {assigneeName}</span>
                                        {!isMobile && (
                                          <button
                                            type="button"
                                            title="Re-send"
                                            onClick={(e) => { e.stopPropagation(); openFwd(inst) }}
                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, cursor: 'pointer', background: 'transparent', color: 'var(--text-blue-500)', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M371.8 82.4C359.8 87.4 352 99 352 112L352 192L240 192C142.8 192 64 270.8 64 368C64 481.3 145.5 531.9 164.2 542.1C166.7 543.5 169.5 544 172.3 544C183.2 544 192 535.1 192 524.3C192 516.8 187.7 509.9 182.2 504.8C172.8 496 160 478.4 160 448.1C160 395.1 203 352.1 256 352.1L352 352.1L352 432.1C352 445 359.8 456.7 371.8 461.7C383.8 466.7 397.5 463.9 406.7 454.8L566.7 294.8C579.2 282.3 579.2 262 566.7 249.5L406.7 89.5C397.5 80.3 383.8 77.6 371.8 82.6z"/></svg>
                                          </button>
                                        )}
                                        {isMobile && (
                                          <button
                                            type="button"
                                            title="Re-send"
                                            onClick={(e) => { e.stopPropagation(); openFwd(inst) }}
                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, cursor: 'pointer', background: 'transparent', color: 'var(--text-blue-500)', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M371.8 82.4C359.8 87.4 352 99 352 112L352 192L240 192C142.8 192 64 270.8 64 368C64 481.3 145.5 531.9 164.2 542.1C166.7 543.5 169.5 544 172.3 544C183.2 544 192 535.1 192 524.3C192 516.8 187.7 509.9 182.2 504.8C172.8 496 160 478.4 160 448.1C160 395.1 203 352.1 256 352.1L352 352.1L352 432.1C352 445 359.8 456.7 371.8 461.7C383.8 466.7 397.5 463.9 406.7 454.8L566.7 294.8C579.2 282.3 579.2 262 566.7 249.5L406.7 89.5C397.5 80.3 383.8 77.6 371.8 82.6z"/></svg>
                                          </button>
                                        )}
                                        <span style={{ marginLeft: 'auto' }}>
                                          {!isRead && (
                                            <button
                                              type="button"
                                              title="Mark as read"
                                              onClick={() => markCompletedItemAsRead(inst)}
                                              disabled={!!markingReadId}
                                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, background: 'transparent', color: 'var(--text-link)', border: '1px solid #93c5fd', cursor: markingReadId ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M125.4 128C91.5 128 64 155.5 64 189.4C64 190.3 64 191.1 64.1 192L64 192L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 192L575.9 192C575.9 191.1 576 190.3 576 189.4C576 155.5 548.5 128 514.6 128L125.4 128zM528 256.3L528 448C528 456.8 520.8 464 512 464L128 464C119.2 464 112 456.8 112 448L112 256.3L266.8 373.7C298.2 397.6 341.7 397.6 373.2 373.7L528 256.3zM112 189.4C112 182 118 176 125.4 176L514.6 176C522 176 528 182 528 189.4C528 193.6 526 197.6 522.7 200.1L344.2 335.5C329.9 346.3 310.1 346.3 295.8 335.5L117.3 200.1C114 197.6 112 193.6 112 189.4z"/></svg>
                                            </button>
                                          )}
                                          {isRead && (
                                            <button
                                              type="button"
                                              title="Mark as unread"
                                              onClick={() => markCompletedItemAsUnread(inst)}
                                              disabled={!!markingUnreadId}
                                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: markingUnreadId ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M576 480C576 515.3 547.5 544 512.1 544L128 544C92.6 544 64 515.3 64 480L64 228C64.1 212.5 71.8 198 84.5 189.2L270 61.3C300.1 40.6 339.8 40.6 369.9 61.3L555.5 189.2C568.3 198 575.9 212.5 576 228L576 480zM128 496L512.1 496C520.9 496 528 488.9 528 480L528 288.3L373.2 405.7C341.8 429.6 298.3 429.6 266.8 405.7L112 288.3L112 480C112 488.9 119.2 496 128 496zM527.6 228.4L342.7 100.8C329 91.4 311 91.4 297.3 100.8L112.4 228.4L295.8 367.5C310.1 378.3 329.9 378.3 344.2 367.5L527.6 228.4z"/></svg>
                                            </button>
                                          )}
                                        </span>
                                      </div>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                    {ignoredItems.length > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setIgnoredSectionOpen((o) => !o)}
                          onKeyDown={(e) => e.key === 'Enter' && setIgnoredSectionOpen((o) => !o)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.9375rem',
                            color: 'var(--text-faint)',
                            marginBottom: ignoredSectionOpen ? '0.5rem' : 0,
                          }}
                        >
                          <span style={{ minWidth: 16 }}>{ignoredSectionOpen ? '▼' : '▶'}</span>
                          Ignored ({ignoredItems.length})
                        </div>
                        {ignoredSectionOpen && (
                          (() => {
                            const byCompleterIgnored = new Map<string, ChecklistInstance[]>()
                            ignoredItems.forEach((inst) => {
                              const cid = inst.completed_by_user_id ?? 'unknown'
                              if (!byCompleterIgnored.has(cid)) byCompleterIgnored.set(cid, [])
                              byCompleterIgnored.get(cid)!.push(inst)
                            })
                            const getUserNameIgnored = (id: string | null) => {
                              if (!id) return 'Unknown'
                              return completedItemsUserMap.get(id) ?? id.slice(0, 8) + '…'
                            }
                            return (
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {Array.from(byCompleterIgnored.entries()).map(([completerId, items]) => {
                                  const isExpanded = expandedCompleterIds.has(completerId)
                                  const completerName = getUserNameIgnored(completerId === 'unknown' ? null : completerId)
                                  return (
                                    <li key={`ignored-${completerId}`} style={{ marginBottom: '0.5rem' }}>
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setExpandedCompleterIds((prev) => {
                                          const next = new Set(prev)
                                          if (next.has(completerId)) next.delete(completerId)
                                          else next.add(completerId)
                                          return next
                                        })}
                                        onKeyDown={(e) => e.key === 'Enter' && setExpandedCompleterIds((prev) => {
                                          const next = new Set(prev)
                                          if (next.has(completerId)) next.delete(completerId)
                                          else next.add(completerId)
                                          return next
                                        })}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.5rem',
                                          padding: '0.5rem 0.75rem',
                                          border: '1px solid var(--border)',
                                          borderRadius: 8,
                                          cursor: 'pointer',
                                          background: 'var(--bg-subtle)',
                                        }}
                                      >
                                        <span style={{ fontSize: '0.875rem', minWidth: 16 }}>{isExpanded ? '▼' : '▶'}</span>
                                        <span style={{ fontWeight: 500 }}>{completerName}</span>
                                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>({items.length} item{items.length !== 1 ? 's' : ''})</span>
                                      </div>
                                      {isExpanded && (
                                        <ul style={{ listStyle: 'none', padding: '0.5rem 0 0 1.5rem', margin: 0 }}>
                                          {items.map((inst) => {
                                            const title = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled'
                                            const links = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.links
                                            const assigneeName = (inst.checklist_instance_assignees ?? [])
                                              .map((a) => getUserNameIgnored(a.user_id))
                                              .filter(Boolean)
                                              .join(', ') || '—'
                                            return (
                                              <li
                                                key={inst.id}
                                                style={{
                                                  display: 'flex',
                                                  flexDirection: isMobile ? 'column' : 'row',
                                                  alignItems: isMobile ? 'stretch' : 'center',
                                                  gap: isMobile ? '0.5rem' : '0.75rem',
                                                  padding: '0.5rem 0.75rem',
                                                  border: '1px solid var(--border)',
                                                  borderRadius: 8,
                                                  marginTop: '0.5rem',
                                                  background: 'var(--surface)',
                                                }}
                                              >
                                                {!isMobile && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); unignoreTaskType(inst.checklist_item_id) }}
                                                    disabled={!!ignoringItemId}
                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, background: 'transparent', color: 'var(--text-link)', border: '1px solid #93c5fd', cursor: ignoringItemId ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                                                  >
                                                    Un-ignore
                                                  </button>
                                                )}
                                                <span style={{ width: isMobile ? '100%' : undefined, flex: isMobile ? undefined : 1, fontWeight: 500, minWidth: 0 }}><ChecklistTitleWithLinks title={title} links={links} /></span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                                                  {isMobile ? (
                                                    <span style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                      <span style={{ display: 'block' }}>{inst.completed_at && new Date(inst.completed_at).toLocaleDateString()}</span>
                                                      <span style={{ display: 'block' }}>{inst.completed_at && new Date(inst.completed_at).toLocaleTimeString()}</span>
                                                    </span>
                                                  ) : (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                      {inst.completed_at && new Date(inst.completed_at).toLocaleString()}
                                                    </span>
                                                  )}
                                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>→ {assigneeName}</span>
                                                  {isMobile && (
                                                    <button
                                                      type="button"
                                                      onClick={(e) => { e.stopPropagation(); unignoreTaskType(inst.checklist_item_id) }}
                                                      disabled={!!ignoringItemId}
                                                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, background: 'transparent', color: 'var(--text-link)', border: '1px solid #93c5fd', cursor: ignoringItemId ? 'not-allowed' : 'pointer' }}
                                                    >
                                                      Un-ignore
                                                    </button>
                                                  )}
                                                </div>
                                              </li>
                                            )
                                          })}
                                        </ul>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            )
                          })()
                        )}
                      </div>
                    )}
                    </>
                  )
                })()
              )}
            </>
          )}
        </div>
      )}
      {showRecent && (
        <div id="dash-reports" style={{ marginTop: '2rem', marginBottom: '1rem', scrollMarginTop: 8 }}>
          <button
            type="button"
            onClick={() => setRecentReportsExpanded((prev) => !prev)}
            aria-expanded={recentReportsExpanded}
            style={{ margin: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.5rem', marginBottom: recentReportsExpanded ? '0.5rem' : 0 }}
          >
            <h2 style={{ fontSize: '1.125rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span aria-hidden>{recentReportsExpanded ? '\u25BC' : '\u25B6'}</span>
              Recent Reports ({recentReports.filter((r) => !hiddenReportIds.has(r.id) && !readReportIds.has(r.id)).length})
            </h2>
          </button>
          {recentReportsExpanded && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setRecentReportsView('unread')}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.8125rem',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      background: recentReportsView === 'unread' ? 'var(--bg-muted)' : 'transparent',
                      cursor: 'pointer',
                      fontWeight: recentReportsView === 'unread' ? 600 : 400,
                      color: 'inherit',
                    }}
                  >
                    Unread reports
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecentReportsView('all')}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.8125rem',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      background: recentReportsView === 'all' ? 'var(--bg-muted)' : 'transparent',
                      cursor: 'pointer',
                      fontWeight: recentReportsView === 'all' ? 600 : 400,
                      color: 'inherit',
                    }}
                  >
                    All recent reports
                  </button>
                </div>
                {!isReportEnabledOnlyUser && (
                  <Link to="/jobs?tab=reports" style={{ fontSize: '0.875rem', color: 'var(--text-link)', textDecoration: 'none' }}>View all →</Link>
                )}
              </div>
              {recentReportsLoading ? (
                <RecentReportsSkeleton />
              ) : recentReports.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {recentReports
                    .filter((r) => !hiddenReportIds.has(r.id) && (recentReportsView === 'all' || !readReportIds.has(r.id) || expandedReportId === r.id))
                    .map((r) => {
                const isRead = readReportIds.has(r.id)
                    const isExpanded = expandedReportId === r.id
                    return (
                      <li key={r.id} style={{ marginBottom: '0.5rem' }}>
                        <div
                          style={{
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            background: isExpanded ? '#fff' : (isRead ? 'var(--bg-subtle)' : 'var(--surface)'),
                            opacity: isRead && !isExpanded ? 0.85 : 1,
                            overflow: 'hidden',
                          }}
                        >
                        <div
                          style={{
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                          }}
                          onClick={() => {
                            const nextExpanded = isExpanded ? null : r.id
                            setExpandedReportId(nextExpanded)
                            if (nextExpanded) {
                              setReadReportIds((prev) => new Set(prev).add(r.id))
                              if (authUser?.id) {
                                supabase.from('report_reads').upsert({ user_id: authUser.id, report_id: r.id }, { onConflict: 'user_id,report_id' }).then(() => {})
                              }
                            }
                          }}
                        >
                        {!isRead && (
                          <span style={{ flexShrink: 0, width: 20, height: 20, color: 'var(--text-muted)', marginTop: 2 }} aria-hidden>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" style={{ width: '100%', height: '100%' }}>
                              <path d="M125.4 128C91.5 128 64 155.5 64 189.4C64 190.3 64 191.1 64.1 192L64 192L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 192L575.9 192C575.9 191.1 576 190.3 576 189.4C576 155.5 548.5 128 514.6 128L125.4 128zM528 256.3L528 448C528 456.8 520.8 464 512 464L128 464C119.2 464 112 456.8 112 448L112 256.3L266.8 373.7C298.2 397.6 341.7 397.6 373.2 373.7L528 256.3zM112 189.4C112 182 118 176 125.4 176L514.6 176C522 176 528 182 528 189.4C528 193.6 526 197.6 522.7 200.1L344.2 335.5C329.9 346.3 310.1 346.3 295.8 335.5L117.3 200.1C114 197.6 112 193.6 112 189.4z" />
                            </svg>
                          </span>
                        )}
                        {isRead && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setHiddenReportIds((prev) => new Set(prev).add(r.id))
                            }}
                            title="Hide from dashboard"
                            aria-label="Hide from dashboard"
                            style={{ flexShrink: 0, width: 24, height: 24, padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor" style={{ width: 14, height: 14 }}>
                              <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z" />
                            </svg>
                          </button>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 500 }}>{r.job_display_name || 'Unknown job'}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginLeft: '0.5rem' }}>· {displayReportTemplateName(r.template_name, role)}</span>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            {new Date(r.created_at).toLocaleString()} · {r.created_by_name}
                          </div>
                        </div>
                        {isRead && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setReadReportIds((prev) => {
                                const next = new Set(prev)
                                next.delete(r.id)
                                return next
                              })
                              if (authUser?.id) {
                                supabase.from('report_reads').delete().eq('user_id', authUser.id).eq('report_id', r.id).then(() => {})
                              }
                            }}
                            title="Mark as unread"
                            aria-label="Mark as unread"
                            style={{ flexShrink: 0, width: 44, height: 44, padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginLeft: 'auto' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" style={{ width: 26, height: 26 }}>
                              <path d="M576 480C576 515.3 547.5 544 512.1 544L128 544C92.6 544 64 515.3 64 480L64 228C64.1 212.5 71.8 198 84.5 189.2L270 61.3C300.1 40.6 339.8 40.6 369.9 61.3L555.5 189.2C568.3 198 575.9 212.5 576 228L576 480zM128 496L512.1 496C520.9 496 528 488.9 528 480L528 288.3L373.2 405.7C341.8 429.6 298.3 429.6 266.8 405.7L112 288.3L112 480C112 488.9 119.2 496 128 496zM527.6 228.4L342.7 100.8C329 91.4 311 91.4 297.3 100.8L112.4 228.4L295.8 367.5C310.1 378.3 329.9 378.3 344.2 367.5L527.6 228.4z" />
                            </svg>
                          </button>
                        )}
                        </div>
                        {isExpanded && (
                          <div
                            style={{
                              padding: '0.75rem 0.75rem 1rem',
                              borderTop: '1px solid var(--border)',
                              fontSize: '0.875rem',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div style={{ marginBottom: '0.5rem' }}>
                              <div style={{ fontWeight: 600, fontSize: '1rem' }}>{displayReportTemplateName(r.template_name, role)}</div>
                              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{r.job_display_name || 'Unknown job'}</div>
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                              {new Date(r.created_at).toLocaleString()} · {r.created_by_name}
                              {r.reported_at_lat != null && r.reported_at_lng != null && (
                                <a
                                  href={`https://www.google.com/maps?q=${r.reported_at_lat},${r.reported_at_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`${Number(r.reported_at_lat).toFixed(4)}, ${Number(r.reported_at_lng).toFixed(4)}`}
                                  style={{ color: 'var(--text-link)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16}>
                                    <path d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z" fill="currentColor" />
                                  </svg>
                                </a>
                              )}
                            </div>
                            {r.field_values && Object.keys(r.field_values).length > 0 ? (
                              <div>
                                {Object.entries(r.field_values).map(([label, val]) =>
                                  val ? (
                                    <div key={label} style={{ marginBottom: '0.75rem' }}>
                                      <span style={{ color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                                        {label}
                                      </span>
                                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{formatReportFieldValueInlineList(val)}</div>
                                    </div>
                                  ) : null
                                )}
                              </div>
                            ) : (
                              <p style={{ color: 'var(--text-faint)', fontSize: '0.875rem' }}>No content</p>
                            )}
                          </div>
                        )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No reports yet.{' '}
                  {isReportEnabledOnlyUser ? (
                    'Create one above.'
                  ) : (
                    <Link to="/jobs?tab=reports" style={{ color: 'var(--text-link)' }}>Create one</Link>
                  )}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem', paddingTop: '0.25rem' }}>
                <label
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    color: 'var(--text-faint)',
                    fontWeight: 300,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={hideOnRefreshPending}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setHideOnRefreshPending(checked)
                      if (checked) {
                        const ids = Array.from(readReportIds)
                        try {
                          localStorage.setItem(HIDE_ON_REFRESH_STORAGE_KEY, JSON.stringify(ids))
                        } catch {
                          /* ignore */
                        }
                      } else {
                        try {
                          localStorage.removeItem(HIDE_ON_REFRESH_STORAGE_KEY)
                        } catch {
                          /* ignore */
                        }
                      }
                    }}
                    style={{ margin: 0, accentColor: '#9ca3af' }}
                  />
                  <span>hide from dashboard reports I've opened, on refresh</span>
                </label>
              </div>
            </>
          )}
        </div>
      )}
      {userError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{userError}</p>}
      {fwdInstance && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
          onClick={(e) => e.target === e.currentTarget && setFwdInstance(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              padding: '1.5rem',
              minWidth: 320,
              maxWidth: 400,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Forward task</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Title</label>
                <input
                  type="text"
                  value={fwdTitle}
                  onChange={(e) => setFwdTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Assign to</label>
                <select
                  value={fwdAssigneeId}
                  onChange={(e) => setFwdAssigneeId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                >
                  {sendTaskUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email || u.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={saveFwd}
                disabled={fwdSaving || !fwdTitle.trim() || !fwdAssigneeId}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: fwdSaving ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {fwdSaving ? 'Saving…' : 'Forward'}
              </button>
              <button
                type="button"
                onClick={() => setFwdInstance(null)}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-200)', color: 'var(--text-700)', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isDashboardTeamReadyToBillRole(role) && (assignedReadyToBillLoading || assignedReadyToBillJobs.length > 0) && (
        <div style={{ marginTop: '2rem' }}>
          <button
            type="button"
            onClick={() => setAssignedReadyToBillExpanded((prev) => !prev)}
            aria-expanded={assignedReadyToBillExpanded}
            style={{ margin: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: assignedReadyToBillExpanded ? '0.75rem' : 0 }}
          >
            <span aria-hidden>{assignedReadyToBillExpanded ? '\u25BC' : '\u25B6'}</span>
            <h2 style={{ fontSize: '1.125rem', margin: 0 }}>
              Ready to Bill ({assignedReadyToBillJobs.length})
            </h2>
          </button>
          {assignedReadyToBillExpanded && (assignedReadyToBillLoading && assignedReadyToBillJobs.length === 0 ? (
            <DashboardListRowSkeleton rows={2} />
          ) : (
            <div>
              {assignedReadyToBillJobs.map((j) => (
                <div
                  key={j.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '1rem',
                    marginBottom: '0.75rem',
                    background: 'var(--surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={isMobile ? { flex: '0 0 50%', minWidth: 0 } : undefined}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openJobDetailFromDashboardJobRow(j)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openJobDetailFromDashboardJobRow(j)
                          }
                        }}
                        aria-label={`Job details: ${(j.hcp_number ?? '').trim() || '—'} · ${(j.job_name ?? '').trim() || '—'}`}
                        style={{
                          fontWeight: 600,
                          cursor: 'pointer',
                          color: 'var(--text-strong)',
                          width: 'fit-content',
                        }}
                      >
                        {j.hcp_number || '—'} · {j.job_name || '—'}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {j.job_address?.trim() ? (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{j.job_address}</a>
                        ) : (
                          '—'
                        )}
                      </div>
                      {isSubcontractorLikeRole(role) && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Job: {labelJobsLedgerStatusForDashboard(j.status)}
                        </div>
                      )}
                      {isSubcontractorLikeRole(role) && narrowViewport660 && j.created_at && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }} title="Time since job created">
                          Open {formatTimeSince(j.created_at)}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {(j.google_drive_link?.trim() || j.job_plans_link?.trim() || j.job_pictures_link?.trim()) && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                          {j.google_drive_link?.trim() && (
                            <a
                              href={j.google_drive_link.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.google_drive_link!.trim()) }}
                              title="Google Drive"
                              style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                                <path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" />
                              </svg>
                            </a>
                          )}
                          {j.job_pictures_link?.trim() && (
                            <span style={{ display: 'inline-flex', padding: '0.35rem' }}>
                              <DashboardJobPicturesLinkRow layout="inline" jobPicturesLink={j.job_pictures_link} />
                            </span>
                          )}
                          {j.job_plans_link?.trim() && (
                            <a
                              href={j.job_plans_link.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.job_plans_link!.trim()) }}
                              title="Job Plans"
                              style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                                <path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" />
                              </svg>
                            </a>
                          )}
                        </div>
                      )}
                      {(role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary') && (
                        <>
                          <button
                            type="button"
                            onClick={() => setViewBillDetailsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—', revenue: j.revenue })}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: 'none', cursor: 'pointer', textDecoration: 'none' }}
                          >
                            View<br />Details
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                          >
                            View<br />Reports
                          </button>
                        </>
                      )}
                      {role === 'superintendent' && (
                        <button
                          type="button"
                          onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                        >
                          View<br />Reports
                        </button>
                      )}
                      {isSubcontractorLikeRole(role) && !isMobile && (() => {
                        const b = subcontractorLastActivityBlock(j)
                        return (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              fontSize: '0.8125rem',
                              color: 'var(--text-muted)',
                              textAlign: 'center',
                              maxWidth: 220,
                              lineHeight: 1.25,
                              gap: 2,
                            }}
                            title={b.title}
                          >
                            <span>{b.line1}</span>
                            <span>{b.line2}</span>
                            {b.line3 != null ? (
                              <button
                                type="button"
                                className="subcontractorLastActivityTypeBtn"
                                onClick={() =>
                                  setSubcontractorJobActivityModalJob({
                                    id: j.id,
                                    hcpNumber: j.hcp_number ?? '—',
                                    jobName: j.job_name ?? '—',
                                  })
                                }
                                aria-label={`What last activity means and recent history for ${j.job_name ?? 'this job'}`}
                              >
                                {b.line3}
                              </button>
                            ) : null}
                          </div>
                        )
                      })()}
                      {canLeaveJobFieldReport(role) && (
                        <DashboardLeaveReportButton
                          showReminder={leaveReportReminderForJobRow(j)}
                          onClick={() =>
                            setLeaveReportJob({
                              id: j.id,
                              hcpNumber: j.hcp_number ?? '—',
                              jobName: j.job_name ?? '—',
                              jobAddress: j.job_address ?? '—',
                            })
                          }
                        />
                      )}
                      {isSubcontractorLikeRole(role) && (
                        <button
                          type="button"
                          onClick={() =>
                            setCollectPaymentJob({
                              id: j.id,
                              hcpNumber: j.hcp_number ?? '—',
                              jobName: j.job_name ?? '—',
                              buttonVariant: j.collect_payment_button_variant ?? 'default',
                            })
                          }
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.875rem',
                            borderRadius: 4,
                            cursor: 'pointer',
                            ...((j.collect_payment_button_variant ?? 'default') === 'ready_terminal'
                              ? {
                                  background: '#15803d',
                                  color: '#ffffff',
                                  border: '1px solid #15803d',
                                  fontWeight: 600,
                                }
                              : (j.collect_payment_button_variant ?? 'default') === 'pending_dispatch'
                                ? {
                                    background: 'var(--bg-amber-tint)',
                                    color: 'var(--text-amber-700)',
                                    border: '1px solid #f59e0b',
                                    fontWeight: 500,
                                  }
                                : {
                                    background: 'var(--surface)',
                                    color: 'var(--text-link)',
                                    border: '1px solid #2563eb',
                                  }),
                          }}
                        >
                          {(j.collect_payment_button_variant ?? 'default') === 'pending_dispatch' ? (
                            <>
                              Collect<br />
                              Payment (pending)
                            </>
                          ) : (
                            <>
                              Collect<br />Payment
                            </>
                          )}
                        </button>
                      )}
                      {j.created_at && (!isSubcontractorLikeRole(role) || !narrowViewport660) && (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }} title="Time since job created">
                          <>Open<br />{formatTimeSince(j.created_at)}</>
                        </span>
                      )}
                      {isSubcontractorLikeRole(role) && isMobile && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {(() => {
                            const m = subcontractorLastActivityMobileLine(j, { formatTitle: formatDatetime })
                            if (!m.clickable) {
                              return (
                                <span title={m.title} aria-label={m.aria} style={{ lineHeight: 1.25 }}>
                                  {m.text}
                                </span>
                              )
                            }
                            return (
                              <button
                                type="button"
                                className="subcontractorLastActivityTypeBtn"
                                title={m.title}
                                aria-label={m.aria}
                                style={{ lineHeight: 1.25 }}
                                onClick={() =>
                                  setSubcontractorJobActivityModalJob({
                                    id: j.id,
                                    hcpNumber: j.hcp_number ?? '—',
                                    jobName: j.job_name ?? '—',
                                  })
                                }
                              >
                                {m.text}
                              </button>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  {j.in_progress_stage_name && (
                    <Link
                      to={j.project_id && j.in_progress_step_id
                        ? `/workflows/${j.project_id}#step-${j.in_progress_step_id}`
                        : '/workflows'}
                      style={{
                        display: 'block',
                        marginTop: '1rem',
                        marginLeft: '-1rem',
                        marginRight: '-1rem',
                        marginBottom: '-1rem',
                        padding: '0.5rem 1rem',
                        background: '#ede9fe',
                        color: '#6d28d9',
                        textDecoration: 'none',
                        fontSize: '0.875rem',
                        borderBottomLeftRadius: 8,
                        borderBottomRightRadius: 8,
                        textAlign: 'center',
                      }}
                    >
                      In progress stage: {j.in_progress_stage_name}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}


      {(assignedJobsLoading || assignedJobs.length > 0) && (
        <div style={{ marginTop: '2rem' }}>
          <button
            type="button"
            onClick={() => setAssignedJobsExpanded((prev) => !prev)}
            aria-expanded={assignedJobsExpanded}
            style={{ margin: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: assignedJobsExpanded ? '0.75rem' : 0 }}
          >
            <span aria-hidden>{assignedJobsExpanded ? '\u25BC' : '\u25B6'}</span>
            <h2 style={{ fontSize: '1.125rem', margin: 0 }}>
              Assigned Jobs ({assignedJobs.length})
            </h2>
          </button>
          {assignedJobsExpanded && (assignedJobsLoading && assignedJobs.length === 0 ? (
            <DashboardListRowSkeleton rows={2} />
          ) : (
            <div>
              {assignedJobs.map((j) => (
                <div
                  key={j.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '1rem',
                    marginBottom: '0.75rem',
                    background: 'var(--surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={isMobile ? { flex: '0 0 50%', minWidth: 0 } : undefined}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openJobDetailFromDashboardJobRow(j)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openJobDetailFromDashboardJobRow(j)
                          }
                        }}
                        aria-label={`Job details: ${(j.hcp_number ?? '').trim() || '—'} · ${(j.job_name ?? '').trim() || '—'}`}
                        style={{
                          fontWeight: 600,
                          cursor: 'pointer',
                          color: 'var(--text-strong)',
                          width: 'fit-content',
                        }}
                      >
                        {j.hcp_number || '—'} · {j.job_name || '—'}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {j.job_address?.trim() ? (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{j.job_address}</a>
                        ) : (
                          '—'
                        )}
                      </div>
                      {isSubcontractorLikeRole(role) && (() => {
                        const d = subcontractorAssignedJobStageDisplay(j)
                        if (!d) return null
                        const { line, title } = d
                        return (
                          <div
                            style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}
                            title={title}
                          >
                            {line}
                          </div>
                        )
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {(j.google_drive_link?.trim() || j.job_plans_link?.trim() || j.job_pictures_link?.trim()) && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                          {j.google_drive_link?.trim() && (
                            <a
                              href={j.google_drive_link.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.google_drive_link!.trim()) }}
                              title="Google Drive"
                              style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                                <path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" />
                              </svg>
                            </a>
                          )}
                          {j.job_pictures_link?.trim() && (
                            <span style={{ display: 'inline-flex', padding: '0.35rem' }}>
                              <DashboardJobPicturesLinkRow layout="inline" jobPicturesLink={j.job_pictures_link} />
                            </span>
                          )}
                          {j.job_plans_link?.trim() && (
                            <a
                              href={j.job_plans_link.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.job_plans_link!.trim()) }}
                              title="Job Plans"
                              style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true">
                                <path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" />
                              </svg>
                            </a>
                          )}
                        </div>
                      )}
                      {(role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary') && (
                        <>
                          <button
                            type="button"
                            onClick={() => setViewBillDetailsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—', revenue: j.revenue })}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: 'none', cursor: 'pointer', textDecoration: 'none' }}
                          >
                            View<br />Details
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                          >
                            View<br />Reports
                          </button>
                        </>
                      )}
                      {role === 'superintendent' && (
                        <button
                          type="button"
                          onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                        >
                          View<br />Reports
                        </button>
                      )}
                      {isSubcontractorLikeRole(role) && !isMobile && (() => {
                        const b = subcontractorLastActivityBlock(j)
                        return (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              fontSize: '0.8125rem',
                              color: 'var(--text-muted)',
                              textAlign: 'center',
                              maxWidth: 220,
                              lineHeight: 1.25,
                              gap: 2,
                            }}
                            title={b.title}
                          >
                            <span>{b.line1}</span>
                            <span>{b.line2}</span>
                            {b.line3 != null ? (
                              <button
                                type="button"
                                className="subcontractorLastActivityTypeBtn"
                                onClick={() =>
                                  setSubcontractorJobActivityModalJob({
                                    id: j.id,
                                    hcpNumber: j.hcp_number ?? '—',
                                    jobName: j.job_name ?? '—',
                                  })
                                }
                                aria-label={`What last activity means and recent history for ${j.job_name ?? 'this job'}`}
                              >
                                {b.line3}
                              </button>
                            ) : null}
                          </div>
                        )
                      })()}
                      {canLeaveJobFieldReport(role) && (
                        <DashboardLeaveReportButton
                          showReminder={leaveReportReminderForJobRow(j)}
                          onClick={() =>
                            setLeaveReportJob({
                              id: j.id,
                              hcpNumber: j.hcp_number ?? '—',
                              jobName: j.job_name ?? '—',
                              jobAddress: j.job_address ?? '—',
                            })
                          }
                        />
                      )}
                      {role !== 'helpers' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReadyForBillingJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—' })
                          setReadyForBillingChecked1(false)
                          setReadyForBillingChecked2(false)
                        }}
                        disabled={jobStatusUpdatingId === j.id}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.875rem',
                          background: 'var(--surface)',
                          color: 'var(--text-link)',
                          border: '1px solid #2563eb',
                          borderRadius: 4,
                          cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                          opacity: jobStatusUpdatingId === j.id ? 0.6 : 1,
                        }}
                      >
                        {jobStatusUpdatingId === j.id ? '…' : <>Send to<br />Billing</>}
                      </button>
                      ) : null}
                      {j.created_at && (!isMobile || !isSubcontractorLikeRole(role)) && (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }} title="Time since job created">
                          <>Open<br />{formatTimeSince(j.created_at)}</>
                        </span>
                      )}
                      {isSubcontractorLikeRole(role) && isMobile && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {j.created_at && (
                          <span>
                            Open<br />
                            {formatTimeSince(j.created_at)}
                          </span>
                        )}
                          {(() => {
                            const m = subcontractorLastActivityMobileLine(j, { formatTitle: formatDatetime })
                            if (!m.clickable) {
                              return (
                                <span title={m.title} aria-label={m.aria} style={{ lineHeight: 1.25 }}>
                                  {m.text}
                                </span>
                              )
                            }
                            return (
                              <button
                                type="button"
                                className="subcontractorLastActivityTypeBtn"
                                title={m.title}
                                aria-label={m.aria}
                                style={{ lineHeight: 1.25 }}
                                onClick={() =>
                                  setSubcontractorJobActivityModalJob({
                                    id: j.id,
                                    hcpNumber: j.hcp_number ?? '—',
                                    jobName: j.job_name ?? '—',
                                  })
                                }
                              >
                                {m.text}
                              </button>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  {j.in_progress_stage_name && !isSubcontractorLikeRole(role) && (
                    <Link
                      to={j.project_id && j.in_progress_step_id
                        ? `/workflows/${j.project_id}#step-${j.in_progress_step_id}`
                        : '/workflows'}
                      style={{
                        display: 'block',
                        marginTop: '1rem',
                        marginLeft: '-1rem',
                        marginRight: '-1rem',
                        marginBottom: '-1rem',
                        padding: '0.5rem 1rem',
                        background: '#ede9fe',
                        color: '#6d28d9',
                        textDecoration: 'none',
                        fontSize: '0.875rem',
                        borderBottomLeftRadius: 8,
                        borderBottomRightRadius: 8,
                        textAlign: 'center',
                      }}
                    >
                      In progress stage: {j.in_progress_stage_name}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {(role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary') && dashboardButtonVisibility?.inspections !== false && (upcomingInspectionsLoading || upcomingInspections.length > 0) && (
        <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>Upcoming inspection (3 days)</h2>
          {upcomingInspectionsLoading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : upcomingInspections.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No inspections in the next 3 days.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {upcomingInspections.map((i) => {
                const today = new Date()
                const parts = i.scheduled_date.split('-').map(Number)
                const scheduled = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1)
                const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
                const diffDays = Math.round((scheduled.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000))
                const dayOfWeek = scheduled.toLocaleDateString('en-US', { weekday: 'long' })
                const formatted = `${i.scheduled_date} (${diffDays}) ${dayOfWeek}`
                return (
                  <li key={i.id} style={{ marginBottom: '0.5rem' }}>
                    <Link
                      to="/jobs?tab=inspections"
                      style={{
                        display: 'block',
                        padding: '0.5rem 0.75rem',
                        background: 'var(--bg-blue-tint)',
                        border: '1px solid #bfdbfe',
                        borderRadius: 4,
                        color: 'var(--text-blue-800)',
                        textDecoration: 'none',
                        fontSize: '0.875rem',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>{formatted}</span>
                        <span style={{ color: 'var(--text-600)' }}>{' - '}{i.inspection_type}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                        <span style={{ fontWeight: 500 }}>{i.address}</span>
                        {i.address?.trim() && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openInExternalBrowser(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.address.trim())}`) }}
                            title={`View ${i.address} on map`}
                            style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-link)', flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 16, height: 16, fill: 'currentColor' }}>
                              <path d="M576 112C576 103.7 571.7 96 564.7 91.6C557.7 87.2 548.8 86.8 541.4 90.5L416.5 152.1L244 93.4C230.3 88.7 215.3 89.6 202.1 95.7L77.8 154.3C69.4 158.2 64 166.7 64 176L64 528C64 536.2 68.2 543.9 75.1 548.3C82 552.7 90.7 553.2 98.2 549.7L225.5 489.8L396.2 546.7C409.9 551.3 424.7 550.4 437.8 544.2L562.2 485.7C570.6 481.7 576 473.3 576 464L576 112zM208 146.1L208 445.1L112 490.3L112 191.3L208 146.1zM256 449.4L256 148.3L384 191.8L384 492.1L256 449.4zM432 198L528 150.6L528 448.8L432 494L432 198z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {role === 'superintendent' && (superintendentJobsLoading || superintendentJobs.filter((j) => !assignedJobs.some((a) => a.id === j.id)).length > 0) && (
        <div style={{ marginTop: '2rem' }}>
          <button
            type="button"
            onClick={() => setSuperintendentJobsExpanded((prev) => !prev)}
            aria-expanded={superintendentJobsExpanded}
            style={{ margin: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: superintendentJobsExpanded ? '0.75rem' : 0 }}
          >
            <span aria-hidden>{superintendentJobsExpanded ? '\u25BC' : '\u25B6'}</span>
            <h2 style={{ fontSize: '1.125rem', margin: 0 }}>
              Superintendent Jobs ({superintendentJobs.filter((j) => !assignedJobs.some((a) => a.id === j.id)).length})
            </h2>
          </button>
          {superintendentJobsExpanded && (
            superintendentJobsLoading && superintendentJobs.length === 0 ? (
              <DashboardListRowSkeleton rows={2} />
            ) : (
              <div>
                {superintendentJobs
                  .filter((j) => !assignedJobs.some((a) => a.id === j.id))
                  .map((j) => (
                    <div
                      key={j.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '1rem',
                        marginBottom: '0.75rem',
                        background: 'var(--surface)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div style={isMobile ? { flex: '0 0 50%', minWidth: 0 } : undefined}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => openJobDetailFromDashboardJobRow(j)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                openJobDetailFromDashboardJobRow(j)
                              }
                            }}
                            aria-label={`Job details: ${(j.hcp_number ?? '').trim() || '—'} · ${(j.job_name ?? '').trim() || '—'}`}
                            style={{
                              fontWeight: 600,
                              cursor: 'pointer',
                              color: 'var(--text-strong)',
                              width: 'fit-content',
                            }}
                          >
                            {j.hcp_number || '—'} · {j.job_name || '—'}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {j.job_address?.trim() ? (
                              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{j.job_address}</a>
                            ) : (
                              '—'
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          {(j.google_drive_link?.trim() || j.job_plans_link?.trim() || j.job_pictures_link?.trim()) && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                              {j.google_drive_link?.trim() && (
                                <a href={j.google_drive_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.google_drive_link!.trim()) }} title="Google Drive" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true"><path d="M403 378.9L239.4 96L400.6 96L564.2 378.9L403 378.9zM265.5 402.5L184.9 544L495.4 544L576 402.5L265.5 402.5zM218.1 131.4L64 402.5L144.6 544L301 272.8L218.1 131.4z" /></svg>
                                </a>
                              )}
                              {j.job_pictures_link?.trim() && (
                                <span style={{ display: 'inline-flex', padding: '0.35rem' }}>
                                  <DashboardJobPicturesLinkRow layout="inline" jobPicturesLink={j.job_pictures_link} />
                                </span>
                              )}
                              {j.job_plans_link?.trim() && (
                                <a href={j.job_plans_link.trim()} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(j.job_plans_link!.trim()) }} title="Job Plans" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0.35rem' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true"><path d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z" /></svg>
                                </a>
                              )}
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })}
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                              >
                                View<br />Reports
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReadyForBillingJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—' })
                                  setReadyForBillingChecked1(false)
                                  setReadyForBillingChecked2(false)
                                }}
                                disabled={jobStatusUpdatingId === j.id}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  fontSize: '0.875rem',
                                  background: 'var(--surface)',
                                  color: 'var(--text-link)',
                                  border: '1px solid #2563eb',
                                  borderRadius: 4,
                                  cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                                  opacity: jobStatusUpdatingId === j.id ? 0.6 : 1,
                                }}
                              >
                                {jobStatusUpdatingId === j.id ? '…' : <>Send to<br />Billing</>}
                              </button>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              {j.created_at && (
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }} title="Time since job created">
                                  <>Open<br />{formatTimeSince(j.created_at)}</>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {j.in_progress_stage_name && (
                        <Link
                          to={j.project_id && j.in_progress_step_id
                            ? `/workflows/${j.project_id}#step-${j.in_progress_step_id}`
                            : '/workflows'}
                          style={{
                            display: 'block',
                            marginTop: '1rem',
                            marginLeft: '-1rem',
                            marginRight: '-1rem',
                            marginBottom: '-1rem',
                            padding: '0.5rem 1rem',
                            background: '#ede9fe',
                            color: '#6d28d9',
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                            borderBottomLeftRadius: 8,
                            borderBottomRightRadius: 8,
                            textAlign: 'center',
                          }}
                        >
                          In progress stage: {j.in_progress_stage_name}
                        </Link>
                      )}
                    </div>
                  ))}
              </div>
            )
          )}
        </div>
      )}
      {(userLoading || showAssigned) && (
        <div style={{ marginTop: '2rem' }}>
          <button
            type="button"
            onClick={() => setAssignedStagesExpanded((prev) => !prev)}
            aria-expanded={assignedStagesExpanded}
            aria-controls="dashboard-assigned-stages-panel"
            style={{
              margin: 0,
              padding: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: assignedStagesExpanded ? '0.75rem' : 0,
            }}
          >
            <span aria-hidden>{assignedStagesExpanded ? '\u25BC' : '\u25B6'}</span>
            <h2 id="dashboard-assigned-stages-heading" style={{ fontSize: '1.125rem', margin: 0 }}>
              Projects: Assigned Stages ({assignedSteps.length})
            </h2>
          </button>
          {assignedStagesExpanded &&
            (assignedLoading && assignedSteps.length === 0 ? (
              <div
                id="dashboard-assigned-stages-panel"
                role="region"
                aria-labelledby="dashboard-assigned-stages-heading"
              >
                <AssignedSkeleton />
              </div>
            ) : (
              <div id="dashboard-assigned-stages-panel" role="region" aria-labelledby="dashboard-assigned-stages-heading">
                {activeAssignedSteps.map((s) => (
                  <AssignedStageCard
                    key={s.id}
                    step={s}
                    userNames={userNames}
                    role={role}
                    onSetStart={() => setSetStartStep({ step: s, startDateTime: toDatetimeLocal(new Date().toISOString()) })}
                    onMarkComplete={() => markCompleted(s)}
                    onMarkApproved={() => markApproved(s)}
                    onReject={() => setRejectStep({ step: s, reason: '' })}
                    onSkip={() => setSkipStep({ step: s, reason: '' })}
                    formatDatetime={formatDatetime}
                    daysOpen={daysOpen}
                    personDisplay={personDisplay}
                  />
                ))}
                {completedAssignedSteps.length > 0 && (
                  <div style={{ marginTop: activeAssignedSteps.length > 0 ? '1.25rem' : 0, paddingLeft: '1.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setAssignedStagesCompleteExpanded((prev) => !prev)}
                      aria-expanded={assignedStagesCompleteExpanded}
                      style={{
                        margin: 0,
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: assignedStagesCompleteExpanded ? '0.75rem' : 0,
                      }}
                    >
                      <span aria-hidden>{assignedStagesCompleteExpanded ? '\u25BC' : '\u25B6'}</span>
                      <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 600 }}>
                        Complete ({completedAssignedSteps.length})
                      </h3>
                    </button>
                    {assignedStagesCompleteExpanded &&
                      completedAssignedSteps.map((s) => (
                        <AssignedStageCard
                          key={s.id}
                          step={s}
                          userNames={userNames}
                          role={role}
                          onSetStart={() => setSetStartStep({ step: s, startDateTime: toDatetimeLocal(new Date().toISOString()) })}
                          onMarkComplete={() => markCompleted(s)}
                          onMarkApproved={() => markApproved(s)}
                          onReject={() => setRejectStep({ step: s, reason: '' })}
                          onSkip={() => setSkipStep({ step: s, reason: '' })}
                          formatDatetime={formatDatetime}
                          daysOpen={daysOpen}
                          personDisplay={personDisplay}
                        />
                      ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Previous work incomplete: {rejectStep.step.name}</h3>
            <label style={{ display: 'block', marginBottom: 4 }}>Reason and Proposed Remedy</label>
            <textarea
              value={rejectStep.reason}
              onChange={(e) => setRejectStep((r) => r ? { ...r, reason: e.target.value } : null)}
              rows={3}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
              placeholder="What is wrong and how should it be fixed (optional)"
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={submitReject} style={{ padding: '0.5rem 1rem', color: '#E87600' }}>Send Back: Previous Work Incomplete</button>
              <button type="button" onClick={() => setRejectStep(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Skip Modal */}
      {skipStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Skip stage: {skipStep.step.name}</h3>
            <label style={{ display: 'block', marginBottom: 4 }}>Why is this stage being skipped?</label>
            <textarea
              value={skipStep.reason}
              onChange={(e) => setSkipStep((r) => r ? { ...r, reason: e.target.value } : null)}
              rows={4}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
              placeholder="e.g. Client waived inspection, combined with prior stage, not applicable..."
            />
            <div style={{ marginBottom: '1rem' }}>
              <button type="button" onClick={() => setSkipStep((s) => s ? { ...s, reason: 'Not relevant' } : null)} style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}>
                Not relevant
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={submitSkip} disabled={!skipStep.reason.trim()} style={{ padding: '0.5rem 1rem', color: 'var(--text-amber-800)', ...(!skipStep.reason.trim() && { opacity: 0.5, cursor: 'not-allowed' }) }}>Skip</button>
              <button type="button" onClick={() => setSkipStep(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Set Start Modal */}
      {setStartStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Set Start Time: {setStartStep.step.name}</h3>
            <label htmlFor="start-datetime" style={{ display: 'block', marginBottom: 4 }}>Start Date & Time</label>
            <input
              id="start-datetime"
              type="datetime-local"
              value={setStartStep.startDateTime}
              onChange={(e) => setSetStartStep({ step: setStartStep.step, startDateTime: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={submitSetStart} style={{ padding: '0.5rem 1rem' }}>Set Start</button>
              <button type="button" onClick={() => setSetStartStep(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      {showSubscribed && (subscribedLoading || subscribedSteps.length > 0) && (
        <div style={{ marginTop: '2rem' }}>
          <button
            type="button"
            onClick={() => setSubscribedStagesExpanded((prev) => !prev)}
            aria-expanded={subscribedStagesExpanded}
            aria-controls="dashboard-subscribed-stages-panel"
            style={{
              margin: 0,
              padding: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: subscribedStagesExpanded ? '0.75rem' : 0,
            }}
          >
            <span aria-hidden>{subscribedStagesExpanded ? '\u25BC' : '\u25B6'}</span>
            <h2 id="dashboard-subscribed-stages-heading" style={{ fontSize: '1.125rem', margin: 0 }}>
              Projects: Subscribed Stages ({subscribedSteps.length})
            </h2>
          </button>
          {subscribedStagesExpanded ? (
            <div
              id="dashboard-subscribed-stages-panel"
              role="region"
              aria-labelledby="dashboard-subscribed-stages-heading"
            >
              {subscribedLoading && subscribedSteps.length === 0 ? (
                <SubscribedSkeleton />
              ) : subscribedSteps.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                  No subscribed stages. Go to a workflow and enable &quot;Notify when started&quot;, &quot;Notify when complete&quot;, or &quot;Notify when re-opened&quot; for steps you want to track here.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {subscribedSteps.map((sub) => {
                    const notifications = []
                    if (sub.notify_when_started) notifications.push('started')
                    if (sub.notify_when_complete) notifications.push('complete')
                    if (sub.notify_when_reopened) notifications.push('re-opened')
                    return (
                      <li
                        key={sub.step_id}
                        style={{
                          padding: '0.75rem 0',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <div>
                          <Link to={`/workflows/${sub.project_id}#step-${sub.step_id}`} style={{ fontWeight: 500 }}>
                            {sub.step_name}
                          </Link>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {formatProjectNumberLabel(sub.project_number) ?? 'Project'}:{' '}
                            <button
                              type="button"
                              onClick={() => {
                                editProjectModal?.openEditProjectModal(sub.project_id)
                              }}
                              style={{
                                color: 'var(--text-link)',
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                font: 'inherit',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                            >
                              {sub.project_name}
                            </button>
                          </div>
                          {notifications.length > 0 && (
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              Notify when: {notifications.join(', ')}
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      )}

      {authUser?.id && (
        <Suspense fallback={<MyTeamSectionSkeleton />}>
          <DashboardMyTeamSection
            myTeam={myTeam}
            showPendingBannerAtTop={pendingClockBannerAtMyTeamTop}
            onGoToPendingSessions={goToPendingSessionsInMyTeam}
          />
        </Suspense>
      )}

      {authUser?.id && <div id="dash-me" aria-hidden="true" style={dockAnchorStyle} />}
      {authUser?.id && (
        <DashboardMyTimeSection
          userId={authUser.id}
          hoursDaysCorrect={hoursDaysCorrectSet}
          disableDayEditor={dashboardSelfIsSalary}
        />
      )}

      <ApplyScheduleApprovedConfirmModal {...applySchedule.approvedConfirm} />

      <NewReportModal
        open={newReportModalOpen}
        onClose={() => setNewReportModalOpen(false)}
        onSaved={() => setNewReportModalOpen(false)}
        authUserId={authUser?.id ?? null}
        userRole={role}
      />
      {(role === 'dev' || role === 'master_technician' || role === 'assistant') && (
        <DashboardStaleTallyStaffFollowUpModal
          open={tallyStaffFollowUpModalOpen}
          onClose={() => setTallyStaffFollowUpModalOpen(false)}
          minAgeDays={TALLY_STALE_MIN_AGE_DAYS}
          onDataChanged={() => void refetchStaleTallyStaffFollowUp()}
        />
      )}
      <ReportEditModal
        open={editReportModalOpen}
        report={reportForEdit}
        onClose={() => {
          setEditReportModalOpen(false)
          setReportForEdit(null)
        }}
        onSaved={() => {
          loadRecentReportsRef.current?.()
        }}
        viewerRole={role}
      />
      <ChecklistItemMuteModal
        open={!!muteModalItemId}
        checklistItemId={muteModalItemId}
        taskTitle={muteModalTitle}
        authUserId={authUser?.id ?? null}
        onClose={() => setMuteModalItemId(null)}
        onSaved={() => loadTodayChecklist()}
      />
      {viewReportsJob && (
        <JobReportsModal
          open={!!viewReportsJob}
          onClose={() => setViewReportsJob(null)}
          jobId={viewReportsJob.id}
          hcpNumber={viewReportsJob.hcpNumber}
          jobName={viewReportsJob.jobName}
          jobAddress={viewReportsJob.jobAddress}
          authUserId={authUser?.id ?? null}
          userRole={role}
          onReportSaved={() => void refreshDashboardAssignedJobLists()}
        />
      )}
      {subcontractorJobActivityModalJob ? (
        <SubcontractorJobActivityModal
          open
          onClose={() => setSubcontractorJobActivityModalJob(null)}
          jobId={subcontractorJobActivityModalJob.id}
          hcpNumber={subcontractorJobActivityModalJob.hcpNumber}
          jobName={subcontractorJobActivityModalJob.jobName}
        />
      ) : null}
      {leaveReportJob && (
        <AdditionalReportModal
          open={!!leaveReportJob}
          onClose={() => setLeaveReportJob(null)}
          onSaved={() => {
            setLeaveReportJob(null)
            void refreshDashboardAssignedJobLists()
          }}
          onReportSaved={() => void refreshDashboardAssignedJobLists()}
          authUserId={authUser?.id ?? null}
          userRole={role}
          jobId={leaveReportJob.id}
          hcpNumber={leaveReportJob.hcpNumber}
          jobName={leaveReportJob.jobName}
          jobAddress={leaveReportJob.jobAddress}
        />
      )}
      {collectPaymentJob ? (
        <CollectPaymentModal
          open
          onClose={() => setCollectPaymentJob(null)}
          jobId={collectPaymentJob.id}
          hcpNumber={collectPaymentJob.hcpNumber}
          jobName={collectPaymentJob.jobName}
          initialFlowStatus={
            collectPaymentJob.buttonVariant === 'ready_terminal'
              ? 'approved_for_terminal'
              : collectPaymentJob.buttonVariant === 'pending_dispatch'
                ? 'pending_dispatch'
                : null
          }
          onFlowChanged={refreshAssignedReadyToBill}
          stripeModeForBilling={stripeModeForBillingFromRole(role)}
        />
      ) : null}
      {readyForBillingJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Send to<br />Billing</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {readyForBillingJob.hcpNumber} · {readyForBillingJob.jobName}
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={readyForBillingChecked1}
                  onChange={(e) => setReadyForBillingChecked1(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>I have reported all the Job Parts I&apos;ve used</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={readyForBillingChecked2}
                  onChange={(e) => setReadyForBillingChecked2(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>The customer knows the work is done and is satisfied</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setReadyForBillingJob(null)
                  setReadyForBillingChecked1(false)
                  setReadyForBillingChecked2(false)
                }}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!readyForBillingChecked1 || !readyForBillingChecked2 || jobStatusUpdatingId === readyForBillingJob.id}
                onClick={async () => {
                  if (!readyForBillingJob) return
                  const ok = await moveJobToReadyToBillWithStripePrep(readyForBillingJob.id)
                  if (!ok) return
                  setReadyForBillingJob(null)
                  setReadyForBillingChecked1(false)
                  setReadyForBillingChecked2(false)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: readyForBillingChecked1 && readyForBillingChecked2 && jobStatusUpdatingId !== readyForBillingJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: readyForBillingChecked1 && readyForBillingChecked2 && jobStatusUpdatingId !== readyForBillingJob.id ? 'pointer' : 'not-allowed',
                }}
              >
                {jobStatusUpdatingId === readyForBillingJob.id ? '…' : 'Send for billing'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sendRecordJobMeta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8 }}>Loading job…</div>
        </div>
      )}
      <BilledPaymentConfirmationModal
        mode="job"
        invoice={null}
        payments={undefined}
        job={
          markPaidJob
            ? {
                id: markPaidJob.id,
                hcp_number: markPaidJob.hcp_number,
                job_name: markPaidJob.job_name,
                revenue: markPaidJob.revenue,
                payments_made: markPaidJob.payments_made,
              }
            : null
        }
        stripeModeForBilling={stripeModeForBillingFromRole(role)}
        onClose={() => setMarkPaidJob(null)}
        onSuccess={async () => {
          await refreshInvoices()
          showToast?.('Payment recorded', 'success')
        }}
      />
      <BilledPaymentConfirmationModal
        mode="invoice"
        invoice={markPaidInvoice ? dashboardInvoiceToPaymentModal(markPaidInvoice) : null}
        payments={markPaidInvoice?.invoice_payments}
        job={null}
        stripeModeForBilling={stripeModeForBillingFromRole(role)}
        onClose={() => setMarkPaidInvoice(null)}
        onSuccess={async () => {
          await refreshInvoices()
          showToast?.('Payment recorded', 'success')
        }}
      />
      {sendBackInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>{sendBackInvoice.action === 'delete' ? DELETE_DRAFT_BILL_LABEL : 'Send back'}</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {`Job ${sendBackInvoice.inv.hcp_number || '—'} · ${sendBackInvoice.inv.job_name || '—'} · $${sendBackInvoice.inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
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
                disabled={!sendBackChecked || invoiceStatusUpdatingId === sendBackInvoice.inv.id}
                onClick={() => {
                  void (async () => {
                    if (!sendBackChecked || !sendBackInvoice) return
                    if (dashboardInvoiceSendBackConfirmLockRef.current) return
                    dashboardInvoiceSendBackConfirmLockRef.current = true
                    const { inv, action } = sendBackInvoice
                    try {
                      if (action === 'delete') {
                        setSendBackInvoice(null)
                        setSendBackChecked(false)
                        setSendBackInvoiceStripeExplainerAfterFailure(false)
                        await deleteInvoice(inv.id)
                      } else {
                        const ok = await revertBilledDashboardInvoiceToReadyToBill(inv)
                        if (ok) {
                          setSendBackInvoice(null)
                          setSendBackChecked(false)
                          setSendBackInvoiceStripeExplainerAfterFailure(false)
                        } else if (invoiceNeedsStripeVoidForRevert(inv)) {
                          setSendBackInvoiceStripeExplainerAfterFailure(true)
                        }
                      }
                    } finally {
                      dashboardInvoiceSendBackConfirmLockRef.current = false
                    }
                  })()
                }}
                style={{ padding: '0.5rem 1rem', background: sendBackChecked && invoiceStatusUpdatingId !== sendBackInvoice.inv.id ? '#3b82f6' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: sendBackChecked && invoiceStatusUpdatingId !== sendBackInvoice.inv.id ? 'pointer' : 'not-allowed' }}
              >
                {invoiceStatusUpdatingId === sendBackInvoice.inv.id ? '…' : sendBackInvoice.action === 'delete' ? DELETE_DRAFT_BILL_LABEL : 'Send back'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sendBackJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>{sendBackJob.toStatus === 'working' ? 'Job: Send Job Back' : 'Send back'}</h2>
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
                disabled={!sendBackChecked || jobStatusUpdatingId === sendBackJob.id}
                onClick={async () => {
                  if (!sendBackJob) return
                  if (sendBackJob.toStatus === 'ready_to_bill') {
                    const token = await getAccessTokenForEdgeFunctions()
                    if (!token) {
                      showToast?.('Not signed in', 'error')
                      return
                    }
                    const prep = await prepareBilledInvoicesBeforeJobRevertToReadyToBill({
                      jobId: sendBackJob.id,
                      authRole: role,
                      accessToken: token,
                    })
                    if (!prep.ok) {
                      showToast?.(prep.message, 'error')
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
                  background: sendBackChecked && jobStatusUpdatingId !== sendBackJob.id ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: sendBackChecked && jobStatusUpdatingId !== sendBackJob.id ? 'pointer' : 'not-allowed',
                }}
              >
                {jobStatusUpdatingId === sendBackJob.id ? '…' : sendBackJob.toStatus === 'working' ? 'Job: Send Job Back' : 'Send back'}
              </button>
            </div>
          </div>
        </div>
      )}
      {viewBillDetailsJob && (
        <JobBillDetailsModal
          open={!!viewBillDetailsJob}
          onClose={() => setViewBillDetailsJob(null)}
          jobId={viewBillDetailsJob.id}
          hcpNumber={viewBillDetailsJob.hcpNumber}
          jobName={viewBillDetailsJob.jobName}
          jobAddress={viewBillDetailsJob.jobAddress}
          revenue={viewBillDetailsJob.revenue}
          onEditJob={(jobId) => {
            setViewBillDetailsJob(null)
            navigate(`/jobs?edit=${jobId}`)
          }}
          onEditJobLabor={(hcpNumber) => {
            setViewBillDetailsJob(null)
            navigate(`/jobs?editLabor=${encodeURIComponent(hcpNumber)}`)
          }}
          onEditParts={(jobId) => {
            setViewBillDetailsJob(null)
            navigate(`/jobs?editParts=${jobId}`)
          }}
        />
      )}
    </div>
  )
}
