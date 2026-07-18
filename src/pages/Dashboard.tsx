import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useRealtimeChannel } from '../hooks/useRealtimeChannel'
import { openInExternalBrowser } from '../lib/openInExternalBrowser'
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
import { isAssistantLike, isSubcontractorLikeRole } from '../lib/subcontractorLikeRole'
import { useJobModeEnabled } from '../hooks/useJobModeEnabled'
import DashboardJobModeCard from '../components/jobMode/DashboardJobModeCard'
import TurnawayModal from '../components/jobMode/TurnawayModal'
import { useSendBackCollectPaymentFlowNotice } from '../hooks/useSendBackCollectPaymentFlowNotice'
import JobReportsModal from '../components/JobReportsModal'
import AdditionalReportModal from '../components/AdditionalReportModal'
import type { DetailJobModalAssignedJobRow } from '../components/jobs/DetailJobModal'
import {
  DASHBOARD_CLOCK_STRIP_SCOPE_KEY,
  readClockStripScopeFromStorage,
  stripScopeEligible,
} from '../lib/dashboardClockStripScopeStorage'
import DashboardFieldCollectPaymentQueue from '../components/dashboard/DashboardFieldCollectPaymentQueue'
import { BillingPipelineCard, BillingPipelineStage } from '../components/dashboard/BillingPipelineCard'
import { DashboardGroupCard } from '../components/dashboard/DashboardGroupCard'
import { DashboardUpcomingInspectionsSection } from '../components/dashboard/DashboardUpcomingInspectionsSection'
import { DashboardRecentReportsSection } from '../components/dashboard/DashboardRecentReportsSection'
import { DashboardMyBidsSection } from '../components/dashboard/DashboardMyBidsSection'
import { SectionDock } from '../components/SectionDock'
import {
  getPinnedForUserFromSupabase,
  type PinnedItem,
} from '../lib/pinnedTabs'
import { useToastContext } from '../contexts/ToastContext'
import { useJobFormModal } from '../contexts/JobFormModalContext'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { useWeeklyTeamLaborTotal } from '../hooks/useWeeklyTeamLaborTotal'
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
import DashboardFinancialsSection from '../components/DashboardFinancialsSection'
import { DashboardPinnedQuickRow } from '../components/dashboard/DashboardPinnedQuickRow'
import { filterPinnedByRole } from '../lib/dashboardPinnedRow'
import { DashboardTeamActiveClockStrip } from '../components/DashboardTeamActiveClockStrip'
import { useDashboardMyTeamSectionState } from '../hooks/useDashboardMyTeamSectionState'
import { useApplyScheduleProportions } from '../hooks/useApplyScheduleProportions'
import { ApplyScheduleApprovedConfirmModal } from '../components/clock-sessions/ApplyScheduleApprovedConfirmModal'
import { useDispatchInbox } from '../hooks/useDispatchInbox'
import { useEstimatorInbox } from '../hooks/useEstimatorInbox'
import { DispatchDismissedItemsModal } from '../components/DispatchDismissedItemsModal'
import CreateTripChargeModal, { type CreateTripChargeTarget } from '../components/CreateTripChargeModal'
import { DashboardTeamsInboxCard } from '../components/dashboard/DashboardTeamsInboxCard'
import { DashboardProjectsCard } from '../components/dashboard/DashboardProjectsCard'
import { DashboardMyInboxCard } from '../components/dashboard/DashboardMyInboxCard'
import { type JobBillingContext } from '../lib/jobBillingContext'
import { useBillCustomerModal } from '../contexts/BillCustomerModalContext'
import BilledPaymentConfirmationModal, { type InvoiceWithJobLike } from '../components/jobs/BilledPaymentConfirmationModal'
import { denverCalendarDayKey, getDefaultWeekRange, getLastWeekRange } from '../utils/dateUtils'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { notifyDispatchRequestsChanged } from '../lib/dispatchRequestHelpers'
import { readEdgeFunctionErrorBody } from '../lib/readEdgeFunctionErrorBody'
import { useDashboardBoot } from '../hooks/useDashboardBoot'
import { formatDatetime } from '../lib/dashboardProjectsCard'
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
  DashboardListRowSkeleton,
  MyTeamSectionSkeleton,
} from '../components/dashboard/DashboardSkeletons'
import { subcontractorLastActivityMobileLine } from '../lib/subcontractorLastActivityCompact'
import {
  formatTimeSince,
  subcontractorAssignedJobStageDisplay,
  subcontractorLastActivityBlock,
} from '../lib/dashboardJobRowActivity'
import SubcontractorJobActivityModal from '../components/dashboard/SubcontractorJobActivityModal'
import { useDashboardSubSchedule } from '../hooks/useDashboardSubSchedule'
import { useDashboardAssignedJobs } from '../hooks/useDashboardAssignedJobs'
import { DashboardMyScheduleSection } from '../components/dashboard/DashboardMyScheduleSection'
import { DashboardTeamReadyToBillSection } from '../components/dashboard/DashboardTeamReadyToBillSection'
import { DashboardJobPicturesLinkRow } from '../components/dashboard/DashboardJobPicturesLinkRow'
import { DashboardLeaveReportButton } from '../components/dashboard/DashboardLeaveReportButton'
import {
  isDashboardTeamReadyToBillRole,
  type DashboardTeamAssignedJobRow,
} from '../lib/dashboardTeamAssignedJobRow'

const DashboardMyTeamSection = lazy(() => import('../components/DashboardMyTeamSection'))
import type { Database } from '../types/database'
import type { ClockSessionRow, DashboardStripSession } from '../types/clockSessions'

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
  // Desktop gets full-size bordered buttons (easier to recognize and hit);
  // mobile keeps the compact bare icons so pipeline cards stay short.
  const isMobile = useIsMobile()
  const iconSize = isMobile ? 16 : 22
  const iconBtn: CSSProperties = isMobile
    ? {
        padding: '0.25rem',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-700)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }
    : {
        padding: '0.45rem',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-700)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }
  return (
    // Row on desktop keeps the taller buttons from stretching short pipeline cards.
    // No gap — the buttons' own padding already separates the glyphs and keeps hit targets apart.
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => onOpenDetail({ jobId, hcpNumber, jobName, jobAddress })}
        title="Job detail"
        aria-label={`Open job detail for ${safeName}`}
        style={iconBtn}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={iconSize} height={iconSize} fill="currentColor" aria-hidden="true">
          <path d="M264 112L376 112C380.4 112 384 115.6 384 120L384 160L256 160L256 120C256 115.6 259.6 112 264 112zM208 120L208 160L128 160C92.7 160 64 188.7 64 224L64 320L576 320L576 224C576 188.7 547.3 160 512 160L432 160L432 120C432 89.1 406.9 64 376 64L264 64C233.1 64 208 89.1 208 120zM576 368L384 368L384 384C384 401.7 369.7 416 352 416L288 416C270.3 416 256 401.7 256 384L256 368L64 368L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 368z" />
        </svg>
      </button>
      {jobFormModalAvailable ? (
        <button type="button" onClick={() => onEditJob(jobId)} title="Edit job" aria-label={`Edit job ${safeName}`} style={iconBtn}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={iconSize} height={iconSize} fill="currentColor" aria-hidden="true">
            <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

export default function Dashboard() {
  const jobDetailModal = useJobDetailModal()
  const { user: authUser, role, estimatorProspectsAccess } = useAuth()
  const isDocVisible = useDocumentVisibility()
  const { showToast } = useToastContext()
  const jobFormModal = useJobFormModal()
  const showClockStripScopeToggle =
    role === 'dev' || role === 'master_technician' || isAssistantLike(role)
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
  const {
    subscribedSteps,
    assignedSteps,
    todayChecklist,
    setTodayChecklist,
    userError,
    setUserError,
    userLoading,
    checklistLoading,
    assignedLoading,
    subscribedLoading,
    userNames,
    userName,
    loadAssignedSteps,
  } = useDashboardBoot({ authUserId: authUser?.id })
  /** Mirrors DashboardMyInboxCard’s render gate (reported via onVisibleChange) for the SectionDock entry. */
  const [myInboxDockVisible, setMyInboxDockVisible] = useState(true)
  const [pinnedRoutes, setPinnedRoutes] = useState<PinnedItem[]>([])
  const [readyToBillExpanded, setReadyToBillExpanded] = useState(true)
  const [waitingForPaymentExpanded, setWaitingForPaymentExpanded] = useState(false)
  const {
    assignedJobs,
    setAssignedJobs,
    assignedJobsLoading,
    assignedReadyToBillJobs,
    setAssignedReadyToBillJobs,
    assignedReadyToBillLoading,
    superintendentJobs,
    setSuperintendentJobs,
    superintendentJobsLoading,
    refreshDashboardAssignedJobLists,
    refreshAssignedReadyToBill,
    resyncDashboardAfterUpdateJobStatusFailureRef,
  } = useDashboardAssignedJobs({ authUserId: authUser?.id, role })
  const [superintendentJobsExpanded, setSuperintendentJobsExpanded] = useState(true)
  const {
    subScheduleLoading,
    subScheduleLabels,
    subSchedulePhones,
    subScheduleDayPartition,
    leaveReportReminderForJobRow,
  } = useDashboardSubSchedule({
    authUserId: authUser?.id,
    role,
    assignedJobs,
    assignedReadyToBillJobs,
  })
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

  const [dispatchDismissedModalOpen, setDispatchDismissedModalOpen] = useState(false)
  const [tripChargeTarget, setTripChargeTarget] = useState<CreateTripChargeTarget | null>(null)

  /** Data half of the My Bids dock gate, reported up by DashboardMyBidsSection (which owns the section state). */
  const [myBidsDockHasContent, setMyBidsDockHasContent] = useState(false)

  const isDev = role === 'dev'
  // Both inbox engines stay here (not in DashboardTeamsInboxCard): the
  // SectionDock entry + the card render gates need the eligibility flags, and
  // DispatchDismissedItemsModal (rendered once, outside both card positions)
  // needs fetchDismissedDispatchInboxRows.
  const dispatchInbox = useDispatchInbox()
  const { dispatchInboxEligible, fetchDismissedDispatchInboxRows } = dispatchInbox
  const estimatorInbox = useEstimatorInbox()
  const { estimatorInboxEligible } = estimatorInbox
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
  const { total: costMatrixTotal } = useWeeklyTeamLaborTotal(hasCostMatrixPin)
  const { count: billedCount, total: billedTotal } = useBilledTotal(hasBilledPin, financialRefreshKey)
  const { count: hoursAwaitingCount } = useHoursAwaitingApprovalCount(isDev, financialRefreshKey)
  const { total: supplyHousesAPTotal } = useSupplyHousesAPTotal(hasSupplyHousesAPPin, financialRefreshKey)
  const { total: subLaborDueTotal } = useSubLaborDueTotal(hasSubLaborDuePin, financialRefreshKey)

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
    if (!authUser?.id || (role !== 'dev' && role !== 'master_technician' && !isAssistantLike(role))) {
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
    if (!authUser?.id || (role !== 'dev' && role !== 'master_technician' && !isAssistantLike(role))) {
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
    if (!authUser?.id || (role !== 'dev' && role !== 'master_technician' && !isAssistantLike(role))) return
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
    if (!authUser?.id || (role !== 'dev' && role !== 'master_technician' && !isAssistantLike(role))) return
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
    if (role !== 'dev' && role !== 'master_technician' && !isAssistantLike(role)) return
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

  async function getCurrentUserName(): Promise<string> {
    if (!authUser?.id) return 'Unknown'
    const { data: userData } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', authUser.id)
      .single()
    return (userData as { name: string | null; email: string | null } | null)?.name || (userData as { email: string | null } | null)?.email || 'Unknown'
  }

  const showAssigned = assignedLoading || assignedSteps.length > 0
  const showSubscribed = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  /** Projects card wraps Assigned + Subscribed stages; visible if either sub-section would show. */
  const projectsCardVisible =
    userLoading || showAssigned || (showSubscribed && (subscribedLoading || subscribedSteps.length > 0))
  const showRecent = role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
  const showFinancials = role === 'dev' || role === 'master_technician' || isAssistantLike(role)

  const showDashboardQuickButtons = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const quickActionLinkStyle: CSSProperties = {
    padding: '0.75rem 1.25rem',
    background: '#3b82f6',
    color: 'white',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '1rem',
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

  // Banners + tally + Job Report + quick actions + pins row live in
  // DashboardPinnedQuickRow (v2.723), mounted at BOTH positions (Job Mode early
  // return + main return). pinnedRoutes/visiblePins and the financial pin total
  // hooks stay here: the has*Pin flags they derive from also enable the
  // dashboard-financial-pins realtime channel, and quick-button state stays
  // because dashboardButtonVisibility also gates the Upcoming-inspection
  // section and the top placement renders outside the block.
  const pinnedQuickRowSharedProps = {
    authUserId: authUser?.id,
    role,
    visiblePins,
    quickActionDefs,
    quickButtonsPlacement,
    showDashboardQuickButtons,
    hoursAwaitingCount,
    costMatrixTotal,
    billedCount,
    billedTotal,
    supplyHousesAPTotal,
    subLaborDueTotal,
  }

  // Job Mode focused view: replaces top of Dashboard with one big card; rest of
  // Dashboard is hidden until user taps "Show full dashboard" (component-local;
  // resets every page load). Toggle lives in the header gear menu (Layout.tsx).
  if (jobModeEnabled && !jobModeShowFullDashboard && authUser?.id) {
    return (
      <div>
        {/* renderModals={false}: the tail modals never mounted in this early return (their openers are inert in Job Mode) — preserved. */}
        <DashboardPinnedQuickRow {...pinnedQuickRowSharedProps} renderModals={false} />
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
    { id: 'dash-my-inbox', label: 'My Inbox', visible: myInboxDockVisible },
    {
      id: 'dash-teams-inbox',
      label: 'Teams Inbox',
      visible: Boolean(authUser?.id && (dispatchInboxEligible || estimatorInboxEligible)),
    },
    {
      id: 'dash-billing',
      label: 'Billing',
      visible: isAssistantLike(role) || role === 'dev' || role === 'master_technician',
    },
    {
      id: 'dash-bids',
      label: 'Bids',
      visible:
        (role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'estimator' || role === 'primary') &&
        myBidsDockHasContent,
    },
    { id: 'dash-reports', label: 'Reports', visible: showRecent },
    { id: 'dash-projects', label: 'Projects', visible: projectsCardVisible },
    { id: 'dash-me', label: 'Me', visible: Boolean(authUser?.id) },
  ].filter((sec) => sec.visible)

  /** Above-the-fold: quick actions and clock first; checklist/assigned use skeletons until data arrives. */
  const myInboxCard = (
    <DashboardMyInboxCard
      authUserId={authUser?.id}
      role={role}
      isMobile={isMobile}
      todayChecklist={todayChecklist}
      setTodayChecklist={setTodayChecklist}
      checklistLoading={checklistLoading}
      userLoading={userLoading}
      setUserError={setUserError}
      getCurrentUserName={getCurrentUserName}
      onVisibleChange={setMyInboxDockVisible}
    />
  )

  return (
    <div style={{ paddingBottom: dockSections.length > 1 ? '4.5rem' : 0 }}>
      {dockSections.length > 1 ? <SectionDock sections={dockSections} ariaLabel="Dashboard sections" /> : null}
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
      <DashboardPinnedQuickRow {...pinnedQuickRowSharedProps} renderModals />
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
      {isAssistantLike(role) && authUser?.id && showClockActivityStrip && (
        <div id="dash-clocked-in" aria-hidden="true" style={dockAnchorStyle} />
      )}
      {isAssistantLike(role) && authUser?.id && showClockActivityStrip && (
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
      {isAssistantLike(role) && authUser?.id && (
        <DashboardMyTeamPendingBanner
          pendingApprovalCount={myTeam.pendingApprovalCount}
          loadingSessions={myTeam.loadingSessions}
          onGoToPendingSessions={goToPendingSessionsInMyTeam}
        />
      )}
      {isAssistantLike(role) && (
        <>
          {myInboxCard}
          {authUser?.id && (dispatchInboxEligible || estimatorInboxEligible) && (
            <DashboardTeamsInboxCard
              dispatchInbox={dispatchInbox}
              estimatorInbox={estimatorInbox}
              showHelpFeedback={false}
              onOpenDismissedArchive={() => setDispatchDismissedModalOpen(true)}
              onLinkJobPictures={
                jobFormModal
                  ? (jobId) => jobFormModal.openEditJob(jobId, { jobPicturesLinkHighlight: true })
                  : undefined
              }
              onCreateTripCharge={(args) => setTripChargeTarget(args)}
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
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                            <button type="button" onClick={() => setViewReportsJob({ id: inv.job_id, hcpNumber: inv.hcp_number ?? '—', jobName: inv.job_name ?? '—', jobAddress: inv.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                            <button type="button" onClick={() => { setSendBackChecked(false); setSendBackInvoice({ inv, action: 'delete' }) }} disabled={invoiceStatusUpdatingId === inv.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: invoiceStatusUpdatingId === inv.id ? 'not-allowed' : 'pointer' }}>Delete<br />draft bill</button>
                            <div className="billingPipelineActionAgePair">
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
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                          <button type="button" onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                          <button type="button" onClick={() => { setSendBackChecked(false); setSendBackJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', toStatus: 'working', rtbDraftCount: countDashboardRtbDraftsForJob(j.id, readyToBillInvoices) }) }} disabled={jobStatusUpdatingId === j.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer' }} aria-label="Send back">Send<br />Back</button>
                          {bundleInv != null && (
                            <button type="button" onClick={() => { setSendBackChecked(false); setSendBackInvoice({ inv: bundleInv, action: 'delete' }) }} disabled={invoiceStatusUpdatingId === bundleInv.id} title="Remove this billing line (partial invoice row)" style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: invoiceStatusUpdatingId === bundleInv.id ? 'not-allowed' : 'pointer' }}>Delete<br />draft bill</button>
                          )}
                          <div className="billingPipelineActionAgePair">
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
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                          <button type="button" onClick={() => setViewReportsJob({ id: inv.job_id, hcpNumber: inv.hcp_number ?? '—', jobName: inv.job_name ?? '—', jobAddress: inv.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                          <button type="button" onClick={() => { setSendBackChecked(false); setSendBackInvoice({ inv, action: 'revert' }) }} disabled={invoiceStatusUpdatingId === inv.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: invoiceStatusUpdatingId === inv.id ? 'not-allowed' : 'pointer' }}>Send<br />back</button>
                          <div className="billingPipelineActionAgePair">
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
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                            <button type="button" onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                            <button type="button" onClick={() => { setSendBackChecked(false); setSendBackJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', toStatus: 'ready_to_bill', rtbDraftCount: 0 }) }} disabled={jobStatusUpdatingId === j.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer' }}>Send<br />back</button>
                            <div className="billingPipelineActionAgePair">
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
      {!isAssistantLike(role) && authUser?.id && showClockActivityStrip && (
        <div id="dash-clocked-in" aria-hidden="true" style={dockAnchorStyle} />
      )}
      {!isAssistantLike(role) && authUser?.id && showClockActivityStrip && (
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
      {(role === 'dev' || role === 'master_technician') && myInboxCard}
      {authUser?.id && (dispatchInboxEligible || estimatorInboxEligible) && !isAssistantLike(role) && (
        <DashboardTeamsInboxCard
          dispatchInbox={dispatchInbox}
          estimatorInbox={estimatorInbox}
          showHelpFeedback={isDev}
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
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                          <button type="button" onClick={() => setViewReportsJob({ id: inv.job_id, hcpNumber: inv.hcp_number ?? '—', jobName: inv.job_name ?? '—', jobAddress: inv.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                          <button type="button" onClick={() => { setSendBackChecked(false); setSendBackInvoice({ inv, action: 'delete' }) }} disabled={invoiceStatusUpdatingId === inv.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: invoiceStatusUpdatingId === inv.id ? 'not-allowed' : 'pointer' }}>Delete<br />draft bill</button>
                          <div className="billingPipelineActionAgePair">
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
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                        <button type="button" onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                        <button type="button" onClick={() => { setSendBackChecked(false); setSendBackJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', toStatus: 'working', rtbDraftCount: countDashboardRtbDraftsForJob(j.id, readyToBillInvoices) }) }} disabled={jobStatusUpdatingId === j.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer' }} aria-label="Send back">Send<br />Back</button>
                        {bundleInv != null && (
                          <button type="button" onClick={() => { setSendBackChecked(false); setSendBackInvoice({ inv: bundleInv, action: 'delete' }) }} disabled={invoiceStatusUpdatingId === bundleInv.id} title="Remove this billing line (partial invoice row)" style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: invoiceStatusUpdatingId === bundleInv.id ? 'not-allowed' : 'pointer' }}>Delete<br />draft bill</button>
                        )}
                        <div className="billingPipelineActionAgePair">
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
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                          <button type="button" onClick={() => setViewReportsJob({ id: inv.job_id, hcpNumber: inv.hcp_number ?? '—', jobName: inv.job_name ?? '—', jobAddress: inv.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                          <button type="button" onClick={() => { setSendBackChecked(false); setSendBackInvoice({ inv, action: 'revert' }) }} disabled={invoiceStatusUpdatingId === inv.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: invoiceStatusUpdatingId === inv.id ? 'not-allowed' : 'pointer' }}>Send<br />back</button>
                          <div className="billingPipelineActionAgePair">
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
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                        <button type="button" onClick={() => setViewReportsJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                        <button type="button" onClick={() => { setSendBackChecked(false); setSendBackJob({ id: j.id, hcpNumber: j.hcp_number ?? '—', jobName: j.job_name ?? '—', toStatus: 'ready_to_bill', rtbDraftCount: 0 }) }} disabled={jobStatusUpdatingId === j.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer' }}>Send<br />back</button>
                        <div className="billingPipelineActionAgePair">
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

      {!isAssistantLike(role) && role !== 'dev' && role !== 'master_technician' && myInboxCard}
      <DashboardMyScheduleSection
        role={role}
        firstAssistantDispatchPhone={firstAssistantDispatchPhone}
        subScheduleLoading={subScheduleLoading}
        subScheduleDayPartition={subScheduleDayPartition}
        subScheduleLabels={subScheduleLabels}
        subSchedulePhones={subSchedulePhones}
        leaveReportReminderForJobRow={leaveReportReminderForJobRow}
        assignedJobs={assignedJobs}
        assignedReadyToBillJobs={assignedReadyToBillJobs}
        detailModalAssignedJobsRows={detailModalAssignedJobsRows}
        submitLinkJobPicturesDispatchRequest={submitLinkJobPicturesDispatchRequest}
        setLeaveReportJob={setLeaveReportJob}
      />
      <DashboardMyBidsSection
        authUserId={authUser?.id}
        role={role}
        isMobile={isMobile}
        onContentVisibleChange={setMyBidsDockHasContent}
      />
      <DashboardRecentReportsSection authUserId={authUser?.id} role={role} />
      {userError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{userError}</p>}

      <DashboardTeamReadyToBillSection
        role={role}
        isMobile={isMobile}
        narrowViewport660={narrowViewport660}
        assignedReadyToBillJobs={assignedReadyToBillJobs}
        assignedReadyToBillLoading={assignedReadyToBillLoading}
        refreshAssignedReadyToBill={refreshAssignedReadyToBill}
        leaveReportReminderForJobRow={leaveReportReminderForJobRow}
        openJobDetailFromDashboardJobRow={openJobDetailFromDashboardJobRow}
        setViewReportsJob={setViewReportsJob}
        setLeaveReportJob={setLeaveReportJob}
        setSubcontractorJobActivityModalJob={setSubcontractorJobActivityModalJob}
      />


      {(assignedJobsLoading || assignedJobs.length > 0) && (
        <DashboardGroupCard title={`Assigned Jobs (${assignedJobs.length})`}>
          {assignedJobsLoading && assignedJobs.length === 0 ? (
            <DashboardListRowSkeleton rows={2} />
          ) : (
            <div>
              {assignedJobs.map((j, idx) => (
                <div
                  key={j.id}
                  style={{
                    padding: '0.85rem 0',
                    borderBottom: idx < assignedJobs.length - 1 ? '1px solid var(--border)' : 'none',
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
                      {(role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary') && (
                        <>
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
                        marginTop: '0.75rem',
                        padding: '0.4rem 0.75rem',
                        background: '#ede9fe',
                        color: '#6d28d9',
                        textDecoration: 'none',
                        fontSize: '0.875rem',
                        borderRadius: 6,
                        textAlign: 'center',
                      }}
                    >
                      In progress stage: {j.in_progress_stage_name}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </DashboardGroupCard>
      )}

      <DashboardUpcomingInspectionsSection
        authUserId={authUser?.id}
        role={role}
        inspectionsButtonVisible={dashboardButtonVisibility?.inspections !== false}
      />

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
      {projectsCardVisible && (
        <DashboardProjectsCard
          assignedSteps={assignedSteps}
          subscribedSteps={subscribedSteps}
          assignedLoading={assignedLoading}
          subscribedLoading={subscribedLoading}
          userLoading={userLoading}
          showAssigned={showAssigned}
          showSubscribed={showSubscribed}
          userNames={userNames}
          role={role}
          getCurrentUserName={getCurrentUserName}
          loadAssignedSteps={loadAssignedSteps}
        />
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
    </div>
  )
}
