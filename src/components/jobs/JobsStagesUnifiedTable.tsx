import { Fragment, type CSSProperties, type Dispatch, type MutableRefObject, type ReactNode, type SetStateAction } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  formatCurrency,
  formatEstimatedCompletionDisplay,
  formatJobNameTwoLines,
  formatTimeSince,
  formatUsdNoCents,
} from '../../lib/jobs/jobFormatting'
import {
  effectiveInvoiceEstBillDate,
  invoiceOpenRemainingOnJob,
  jobBilledUnpaidDollars,
  sumInvoiceAppliedFromJobPayments,
} from '../../lib/jobs/invoiceBilling'
import { jobBillingUnallocatedDollars, type InvoiceWithJob, type StageRow } from '../../lib/jobsStagesBoard'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { buildStagesMoneyBarModel } from '../../lib/stagesMoneyBar'
import StagesProgressPaymentCell from './StagesProgressPaymentCell'
import { JobThreadNotesPanel } from '../JobThreadNotesPanel'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { buildClickToolingUrl } from '../../lib/jobs/jobAddressUrls'
import { showAiaG702G703 } from '../../lib/aiaG702G703Eligibility'
import { getDefaultWeekRange } from '../../utils/dateUtils'
import { useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import { useDispatchTaskModal } from '../../contexts/DispatchTaskModalContext'
import { useAuth } from '../../hooks/useAuth'
import { useJobThreadNotes } from '../../hooks/useJobThreadNotes'
import { useJobsStagesMutations } from '../../hooks/useJobsStagesMutations'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { UserRow } from '../../pages/Jobs'
import {
  renderJobAddressWithMap,
  renderJobCustomerLine as renderJobCustomerLineWithCtx,
  renderStagesFieldAndBillingLines as renderStagesFieldAndBillingLinesWithCtx,
  renderStagesJobColumnEstimateFooter,
  renderStagesJobHcpSubline,
  renderStagesLastActivityCell as renderStagesLastActivityCellWithCtx,
  renderStagesProjectBannerRow,
  renderStagesThreeLineHeader,
  shouldSuppressStagesRowJobThreadToggle,
  stagesRowHasProjectBanner,
  type StagesRowRenderContext,
} from './jobsStagesRowShared'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * Stages mixed job/invoice-row section table (Ready to Bill / Billed Awaiting
 * Payment / Collections) — Jobs.tsx decomposition step 9a
 * (docs/JOBS_TABS_ARCHITECTURE.md "Section renderers"). Behavior-preserving
 * move of the IIFE closure `renderUnifiedStagesTable(rows, options)`: the
 * former ~20-key options object is flattened into same-named props (defaults
 * preserved in the destructure), and every captured page value is a same-named
 * prop (wide prop list accepted for this step — the step-9b JobsStagesTab
 * becomes the single caller and absorbs most of them). The quick-action
 * stack's `navigate` + dispatch-task/checklist modal contexts are consumed via
 * their app-global hooks here instead of props.
 */
export type JobsStagesUnifiedTableProps = {
  rows: StageRow[]
  actionLabel: React.ReactNode | null
  onJobAction: (j: JobWithDetails) => void
  onInvoiceAction: (inv: InvoiceWithJob) => void
  /** Billed Awaiting Payment: open read-only bill (Stripe or outside). */
  onViewBill?: (inv: InvoiceWithJob) => void
  onJobSendBack?: (j: JobWithDetails) => void
  onInvoiceSendBack: (inv: InvoiceWithJob) => void
  showRemaining?: boolean
  showTimeOpen?: boolean
  sendBackBelowRemaining?: boolean
  showCreatePartialInvoice?: boolean
  jobSendBackLabel?: string
  invoiceBundleActionLabel?: string
  invoiceStandaloneActionLabel?: string
  /** Deep-link flash: row matching this invoice id gets a brief highlight. */
  flashInvoiceId?: string | null
  /** When false, hide the Click Tooling (wrench) shortcut (e.g. Billed Awaiting Payment). Default true. */
  showClickTooling?: boolean
  /** Billed Awaiting Payment: open Lien Tooling prefill modal. */
  onOpenLienTooling?: (ctx: { job: JobWithDetails; invoice: JobsLedgerInvoice | null }) => void
  /** Billed Awaiting Payment: flag the row's job as difficult-to-collect (Collections section). */
  onJobMoveToCollections?: (j: JobWithDetails) => void
  /** Collections: short muted note line under the amounts (e.g. the stored collections reason). */
  jobNoteLine?: (j: JobWithDetails) => string | null
  // --- captured page values (same names as in Jobs.tsx; step 9b's JobsStagesTab absorbs these) ---
  stagesJobFlashId: string | null
  stagesHamMode: boolean
  assignedEditJobId: string | null
  setAssignedEditJobId: (id: string | null) => void
  assignedEditSelectedIds: string[]
  setAssignedEditSelectedIds: Dispatch<SetStateAction<string[]>>
  assignedEditSavingId: string | null
  assignedEditDropdownRef: MutableRefObject<HTMLDivElement | null>
  users: UserRow[]
  updateJobTeamMembers: (jobId: string, userIds: string[]) => Promise<void>
  renderStagesOpenDetailJobName: (j: JobWithDetails) => ReactNode
  stagesStatusUpdatingId: ReturnType<typeof useJobsStagesMutations>['stagesStatusUpdatingId']
  pctCompleteSavingId: ReturnType<typeof useJobsStagesMutations>['pctCompleteSavingId']
  updateJobPctComplete: ReturnType<typeof useJobsStagesMutations>['updateJobPctComplete']
  commitStagesPctWithNote: ReturnType<typeof useJobsStagesMutations>['commitStagesPctWithNote']
  setCreatePartialInvoiceAmount: (v: string) => void
  setCreatePartialInvoiceJob: (j: JobWithDetails | null) => void
  openEdit: (job: JobWithDetails, opts?: { billingCustomerHighlight?: boolean }) => void
  openStagesDetailJobModal: (j: JobWithDetails) => void
  setAiaG702StagesJob: (j: JobWithDetails | null) => void
  canCreateHazmatFee: boolean
  openHazmatFee: (j: JobWithDetails) => void
  canEditJobPctComplete: boolean
  canManageJobPeople: boolean
  setManageJobPeople: (v: { jobId: string; jobLabel: string; currentTeamUserIds: string[] } | null) => void
  jobThreadNotesLoadingId: ReturnType<typeof useJobThreadNotes>['jobThreadNotesLoadingId']
  jobThreadDraft: ReturnType<typeof useJobThreadNotes>['jobThreadDraft']
  jobThreadSubmittingId: ReturnType<typeof useJobThreadNotes>['jobThreadSubmittingId']
  setJobThreadDraft: ReturnType<typeof useJobThreadNotes>['setJobThreadDraft']
  submitJobThreadNote: ReturnType<typeof useJobThreadNotes>['submitJobThreadNote']
  authUser: ReturnType<typeof useAuth>['user']
  // --- shared row-render context inputs (navigate + the dispatch-task/checklist modals are consumed via hooks here) ---
  showToast: StagesRowRenderContext['showToast']
  customers: StagesRowRenderContext['customers']
  openEditJobAndCreateCustomerFlow: StagesRowRenderContext['openEditJobAndCreateCustomerFlow']
  stagesManHoursByJobId: StagesRowRenderContext['stagesManHoursByJobId']
  stagesManHoursLoading: StagesRowRenderContext['stagesManHoursLoading']
  stagesLaborBreakdownByJobId: StagesRowRenderContext['stagesLaborBreakdownByJobId']
  expandedJobThreadId: StagesRowRenderContext['expandedJobThreadId']
  toggleStagesJobThreadExpanded: StagesRowRenderContext['toggleStagesJobThreadExpanded']
  jobThreadStatsByJobId: StagesRowRenderContext['jobThreadStatsByJobId']
  jobThreadActivityByJobId: StagesRowRenderContext['jobThreadActivityByJobId']
  setViewReportsJob: StagesRowRenderContext['setViewReportsJob']
  applyStagesInvoiceFocus: StagesRowRenderContext['applyStagesInvoiceFocus']
  canOpenJobScheduleModal: StagesRowRenderContext['canOpenJobScheduleModal']
  setScheduleModalJob: StagesRowRenderContext['setScheduleModalJob']
  authRole: StagesRowRenderContext['authRole']
  loadJobs: StagesRowRenderContext['loadJobs']
  stagesInvoiceUpdatingId: ReturnType<typeof useJobsStagesMutations>['stagesInvoiceUpdatingId']
  invoiceEstimatedBillDateSavingId: ReturnType<typeof useJobsStagesMutations>['invoiceEstimatedBillDateSavingId']
  bumpInvoiceEstimatedBillDate: ReturnType<typeof useJobsStagesMutations>['bumpInvoiceEstimatedBillDate']
  setWhenInvoiceBillModal: (v: { invoiceId: string; jobId: string; jobName: string; hcpNumber: string } | null) => void
  setWhenInvoiceBillModalDate: (v: string) => void
}

export default function JobsStagesUnifiedTable(props: JobsStagesUnifiedTableProps) {
  const {
    rows,
    actionLabel,
    onJobAction,
    onInvoiceAction,
    onViewBill,
    onJobSendBack,
    onInvoiceSendBack,
    showRemaining,
    showTimeOpen,
    sendBackBelowRemaining,
    showCreatePartialInvoice,
    jobSendBackLabel = 'Send back',
    invoiceBundleActionLabel = 'Remove line',
    invoiceStandaloneActionLabel = 'Send back',
    flashInvoiceId = null,
    showClickTooling = true,
    onOpenLienTooling,
    onJobMoveToCollections,
    jobNoteLine,
    stagesJobFlashId,
    stagesHamMode,
    assignedEditJobId,
    setAssignedEditJobId,
    assignedEditSelectedIds,
    setAssignedEditSelectedIds,
    assignedEditSavingId,
    assignedEditDropdownRef,
    users,
    updateJobTeamMembers,
    renderStagesOpenDetailJobName,
    stagesStatusUpdatingId,
    pctCompleteSavingId,
    updateJobPctComplete,
    commitStagesPctWithNote,
    setCreatePartialInvoiceAmount,
    setCreatePartialInvoiceJob,
    openEdit,
    openStagesDetailJobModal,
    setAiaG702StagesJob,
    canCreateHazmatFee,
    openHazmatFee,
    canEditJobPctComplete,
    canManageJobPeople,
    setManageJobPeople,
    jobThreadNotesLoadingId,
    jobThreadDraft,
    jobThreadSubmittingId,
    setJobThreadDraft,
    submitJobThreadNote,
    authUser,
    showToast,
    customers,
    openEditJobAndCreateCustomerFlow,
    stagesManHoursByJobId,
    stagesManHoursLoading,
    stagesLaborBreakdownByJobId,
    expandedJobThreadId,
    toggleStagesJobThreadExpanded,
    jobThreadStatsByJobId,
    jobThreadActivityByJobId,
    setViewReportsJob,
    applyStagesInvoiceFocus,
    canOpenJobScheduleModal,
    setScheduleModalJob,
    authRole,
    loadJobs,
    stagesInvoiceUpdatingId,
    invoiceEstimatedBillDateSavingId,
    bumpInvoiceEstimatedBillDate,
    setWhenInvoiceBillModal,
    setWhenInvoiceBillModalDate,
  } = props
  const navigate = useNavigate()
  const dispatchTaskModal = useDispatchTaskModal()
  const checklistAddModal = useChecklistAddModal()

  const stagesRowSharedCtx: StagesRowRenderContext = {
    showToast,
    customers,
    openEditJobAndCreateCustomerFlow,
    stagesManHoursByJobId,
    stagesManHoursLoading,
    stagesLaborBreakdownByJobId,
    expandedJobThreadId,
    toggleStagesJobThreadExpanded,
    jobThreadStatsByJobId,
    jobThreadActivityByJobId,
    setViewReportsJob,
    applyStagesInvoiceFocus,
    canOpenJobScheduleModal,
    setScheduleModalJob,
    navigate,
    authRole,
    dispatchTaskModal,
    checklistAddModal,
    loadJobs,
  }
  const renderStagesFieldAndBillingLines = (job: JobWithDetails) =>
    renderStagesFieldAndBillingLinesWithCtx(stagesRowSharedCtx, job)
  const renderJobCustomerLine = (job: JobWithDetails) => renderJobCustomerLineWithCtx(stagesRowSharedCtx, job)
  const renderStagesLastActivityCell = (job: JobWithDetails, billingLineForStripeHint?: JobsLedgerInvoice | null) =>
    renderStagesLastActivityCellWithCtx(stagesRowSharedCtx, job, billingLineForStripeHint)

  const renderJobNoteLine = (j: JobWithDetails) => {
    const note = jobNoteLine?.(j)
    if (!note) return null
    return (
      <span
        title={note}
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-red-700)',
          fontStyle: 'italic',
          maxWidth: '11rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {note}
      </span>
    )
  }
  const unifiedStagesColCount = 5
  const flashRowStyle = (invoiceId: string): CSSProperties =>
    flashInvoiceId === invoiceId
      ? {
          backgroundColor: 'var(--bg-amber-100)',
          outline: '2px solid #f59e0b',
          outlineOffset: -2,
          transition: 'background-color 0.35s ease',
        }
      : {}
  const stagesSecondaryOutlineButtonBase: CSSProperties = {
    padding: '0.25rem 0.5rem',
    fontSize: '0.8125rem',
    lineHeight: 1.2,
    textAlign: 'center',
    background: 'none',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    width: 'fit-content',
    maxWidth: '100%',
    boxSizing: 'border-box',
  }
  const stagesInvoiceHcpBadgeStyle: CSSProperties = {
    display: 'inline-block',
    padding: '0.15rem 0.4rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
    border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: 4,
    background: '#16a34a',
    color: 'white',
    lineHeight: 1.2,
    fontFamily: 'inherit',
  }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
      <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead style={{ background: 'var(--bg-subtle)' }}>
          <tr>
            <th
              style={{
                padding: '0.75rem',
                textAlign: 'left',
                borderBottom: '1px solid var(--border)',
                minWidth: '6.75rem',
              }}
            >
              {renderStagesThreeLineHeader('Assigned', 'HCP', 'Last-Activity')}
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', minWidth: 200 }}>Last activity</th>
            <th
              style={{
                padding: '0.75rem',
                textAlign: 'center',
                borderBottom: '1px solid var(--border)',
                minWidth: '12rem',
              }}
            >
              Progress & payment
            </th>
            <th style={{ padding: '0.75rem', width: 140, borderBottom: '1px solid var(--border)' }} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={unifiedStagesColCount} style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                No jobs or invoices in this group
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              if (
                row.kind === 'job' ||
                row.kind === 'job_with_merged_billed' ||
                row.kind === 'job_with_primary_rtb'
              ) {
                const j = row.job
                const bundleInv =
                  row.kind === 'job_with_merged_billed' || row.kind === 'job_with_primary_rtb'
                    ? row.inv
                    : null
                const bundleInvWithJob: InvoiceWithJob | null =
                  bundleInv != null ? { ...bundleInv, job: j } : null
                const bundleRowKey =
                  bundleInv != null
                    ? row.kind === 'job_with_primary_rtb'
                      ? `job-${j.id}-rtb-${bundleInv.id}`
                      : `job-${j.id}-billed-${bundleInv.id}`
                    : `job-${j.id}`
                return (
                  <Fragment key={bundleRowKey}>
                  <tr
                    data-stages-invoice-id={bundleInv != null ? bundleInv.id : undefined}
                    data-stages-job-id={j.id}
                    style={{
                      borderBottom: stagesRowHasProjectBanner(j.project_id, j.project) ? 'none' : '1px solid #e5e7eb',
                      ...(bundleInv != null ? flashRowStyle(bundleInv.id) : {}),
                      ...(stagesJobFlashId === j.id
                        ? { backgroundColor: 'var(--bg-amber-100)', outline: '2px solid #f59e0b', outlineOffset: -2, transition: 'background-color 0.35s ease' }
                        : {}),
                    }}
                    onClick={(e) => {
                      if (shouldSuppressStagesRowJobThreadToggle(e.target)) return
                      toggleStagesJobThreadExpanded(j.id)
                    }}
                  >
                    <td style={{ padding: '0.75rem', verticalAlign: 'top', position: 'relative' }}>
                      {stagesHamMode ? (
                        <div ref={assignedEditJobId === j.id ? assignedEditDropdownRef : undefined} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <span>{(j.team_members ?? []).map((t) => t.users?.name?.trim()).filter(Boolean).join(', ') || '—'}</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (assignedEditJobId === j.id) {
                                setAssignedEditJobId(null)
                              } else {
                                setAssignedEditJobId(j.id)
                                setAssignedEditSelectedIds((j.team_members ?? []).map((t) => t.user_id))
                              }
                            }}
                            disabled={assignedEditSavingId === j.id}
                            title="Change assigned"
                            aria-label="Change assigned"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 24,
                              height: 24,
                              padding: 0,
                              border: 'none',
                              borderRadius: 4,
                              background: 'none',
                              cursor: assignedEditSavingId === j.id ? 'not-allowed' : 'pointer',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                              <path d="M100.4 417.2C104.5 402.6 112.2 389.3 123 378.5L304.2 197.3L338.1 163.4C354.7 180 389.4 214.7 442.1 267.4L476 301.3L442.1 335.2L260.9 516.4C250.2 527.1 236.8 534.9 222.2 539L94.4 574.6C86.1 576.9 77.1 574.6 71 568.4C64.9 562.2 62.6 553.3 64.9 545L100.4 417.2zM156 413.5C151.6 418.2 148.4 423.9 146.7 430.1L122.6 517L209.5 492.9C215.9 491.1 221.7 487.8 226.5 483.2L155.9 413.5zM510 267.4C493.4 250.8 458.7 216.1 406 163.4L372 129.5C398.5 103 413.4 88.1 416.9 84.6C430.4 71 448.8 63.4 468 63.4C487.2 63.4 505.6 71 519.1 84.6L554.8 120.3C568.4 133.9 576 152.3 576 171.4C576 190.5 568.4 209 554.8 222.5C551.3 226 536.4 240.9 509.9 267.4z" />
                            </svg>
                          </button>
                          {assignedEditJobId === j.id && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: 4,
                                zIndex: 50,
                                background: 'var(--surface)',
                                border: '1px solid var(--border-strong)',
                                borderRadius: 4,
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                padding: '0.5rem',
                                minWidth: 180,
                                maxHeight: 200,
                                overflowY: 'auto',
                              }}
                            >
                              <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Assigned</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {users.map((u) => (
                                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                                    <input
                                      type="checkbox"
                                      checked={assignedEditSelectedIds.includes(u.id)}
                                      onChange={() => {
                                        setAssignedEditSelectedIds((prev) =>
                                          prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                                        )
                                      }}
                                      style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                                    />
                                    <span>{u.name}</span>
                                  </label>
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <button
                                  type="button"
                                  onClick={() => updateJobTeamMembers(j.id, assignedEditSelectedIds)}
                                  disabled={assignedEditSavingId === j.id}
                                  style={{
                                    padding: '0.35rem 0.75rem',
                                    fontSize: '0.8125rem',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: assignedEditSavingId === j.id ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  {assignedEditSavingId === j.id ? '…' : 'Apply'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAssignedEditJobId(null)}
                                  style={{
                                    padding: '0.35rem 0.75rem',
                                    fontSize: '0.8125rem',
                                    background: 'none',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        {renderStagesJobHcpSubline(j, { marginTop: '0.15rem' })}
                        {renderStagesFieldAndBillingLines(j)}
                      </div>
                      ) : (
                        <>
                          <div>{(j.team_members ?? []).map((t) => t.users?.name?.trim()).filter(Boolean).join(', ') || '—'}</div>
                          {renderStagesJobHcpSubline(j, { marginTop: '0.15rem' })}
                          {renderStagesFieldAndBillingLines(j)}
                        </>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {renderStagesOpenDetailJobName(j)}
                      {renderJobAddressWithMap(j.job_address)}
                      {renderJobCustomerLine(j)}
                      {bundleInv != null ? (
                        <div
                          style={{ fontSize: '0.75rem', color: 'var(--text-blue-800)', marginTop: '0.25rem' }}
                          title="Single billing line for this job (Stripe or external send)"
                        >
                          {row.kind === 'job_with_merged_billed' ? (
                            <>
                              Billed line: {formatCurrency(invoiceOpenRemainingOnJob(bundleInv, j))} open
                            </>
                          ) : (
                            <>Billing line: {formatCurrency(Number(bundleInv.amount))}</>
                          )}
                        </div>
                      ) : null}
                      {renderStagesJobColumnEstimateFooter(j.linkedEstimateForStages)}
                    </td>
                    {renderStagesLastActivityCell(j, bundleInv ?? undefined)}
                    <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                        {!bundleInv ? (
                          <>
                            <StagesProgressPaymentCell
                              model={buildStagesMoneyBarModel({
                                totalBill: j.revenue != null ? Number(j.revenue) : null,
                                paymentsMade: j.payments_made != null ? Number(j.payments_made) : null,
                                pctComplete: j.pct_complete ?? null,
                                billedUnpaid: jobBilledUnpaidDollars(j),
                              })}
                              pctComplete={j.pct_complete ?? null}
                              pctSaving={pctCompleteSavingId === j.id}
                              onPctCommit={(n) => updateJobPctComplete(j.id, n)}
                              footnote={showRemaining ? (() => {
                                const u = jobBillingUnallocatedDollars(j)
                                return u > 0 ? (
                                  <span title="Left on the job after draft and billed invoice lines">{`${formatUsdNoCents(u)} unallocated`}</span>
                                ) : null
                              })() : null}
                            />
                            {sendBackBelowRemaining && onJobSendBack && (
                              <button
                                type="button"
                                onClick={() => onJobSendBack(j)}
                                disabled={stagesStatusUpdatingId === j.id}
                                style={{
                                  ...stagesSecondaryOutlineButtonBase,
                                  cursor: stagesStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {jobSendBackLabel}
                              </button>
                            )}
                            {onJobMoveToCollections && (
                              <button
                                type="button"
                                onClick={() => onJobMoveToCollections(j)}
                                title="Flag this job as difficult to collect (moves to the Collections section; stays Billed)"
                                style={{ ...stagesSecondaryOutlineButtonBase, cursor: 'pointer' }}
                              >
                                Move to Collections
                              </button>
                            )}
                            {renderJobNoteLine(j)}
                          </>
                        ) : (
                          <>
                            <StagesProgressPaymentCell
                              model={buildStagesMoneyBarModel({
                                totalBill: j.revenue != null ? Number(j.revenue) : null,
                                paymentsMade: j.payments_made != null ? Number(j.payments_made) : null,
                                pctComplete: j.pct_complete ?? null,
                                billedUnpaid: jobBilledUnpaidDollars(j),
                              })}
                              pctComplete={j.pct_complete ?? null}
                              pctSaving={pctCompleteSavingId === j.id}
                              onPctCommit={(n) => updateJobPctComplete(j.id, n)}
                              footnote={
                                row.kind === 'job_with_merged_billed'
                                  ? (() => {
                                      const ap = sumInvoiceAppliedFromJobPayments(j, bundleInv.id)
                                      return (
                                        <span title="This row's billed line">
                                          {`This bill: ${formatUsdNoCents(ap)} paid · ${formatUsdNoCents(invoiceOpenRemainingOnJob(bundleInv, j))} left`}
                                        </span>
                                      )
                                    })()
                                  : (
                                      <span title="Amount on this billing line">{`${formatUsdNoCents(Number(bundleInv.amount))} remainder`}</span>
                                    )
                              }
                            />
                            {sendBackBelowRemaining && onInvoiceSendBack && bundleInvWithJob != null && (
                              <button
                                type="button"
                                onClick={() => onInvoiceSendBack(bundleInvWithJob)}
                                disabled={stagesInvoiceUpdatingId === bundleInv.id}
                                title="Remove this billing line (partial invoice row)"
                                style={{
                                  ...stagesSecondaryOutlineButtonBase,
                                  cursor: stagesInvoiceUpdatingId === bundleInv.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {invoiceBundleActionLabel}
                              </button>
                            )}
                            {onJobMoveToCollections && (
                              <button
                                type="button"
                                onClick={() => onJobMoveToCollections(j)}
                                title="Flag this job as difficult to collect (moves to the Collections section; stays Billed)"
                                style={{ ...stagesSecondaryOutlineButtonBase, cursor: 'pointer' }}
                              >
                                Move to Collections
                              </button>
                            )}
                            {renderJobNoteLine(j)}
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                        {onViewBill && bundleInvWithJob != null && row.kind === 'job_with_merged_billed' ? (
                          <button
                            type="button"
                            onClick={() => onViewBill(bundleInvWithJob)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.8125rem',
                              background: 'var(--surface)',
                              color: 'var(--text-link)',
                              border: '1px solid #2563eb',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            View Bill
                          </button>
                        ) : null}
                        {onViewBill && !bundleInv && (j.invoices ?? []).filter((i) => i.status === 'billed').length === 1 ? (
                          <button
                            type="button"
                            onClick={() => {
                              const b = (j.invoices ?? []).filter((i) => i.status === 'billed')
                              onViewBill({ ...b[0], job: j } as InvoiceWithJob)
                            }}
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.8125rem',
                              background: 'var(--surface)',
                              color: 'var(--text-link)',
                              border: '1px solid #2563eb',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            View Bill
                          </button>
                        ) : null}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {actionLabel && bundleInvWithJob != null ? (
                            <button
                              type="button"
                              onClick={() => onInvoiceAction(bundleInvWithJob)}
                              disabled={
                                stagesStatusUpdatingId === j.id ||
                                stagesInvoiceUpdatingId === bundleInvWithJob.id
                              }
                              title="Billing action for this invoice line (job + invoice merged row)"
                              style={{
                                padding: '0.35rem 0.75rem',
                                paddingLeft: '0.6rem',
                                fontSize: '0.8125rem',
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderLeft: '4px solid #16a34a',
                                borderRadius: 4,
                                cursor:
                                  stagesStatusUpdatingId === j.id ||
                                  stagesInvoiceUpdatingId === bundleInvWithJob.id
                                    ? 'not-allowed'
                                    : 'pointer',
                              }}
                            >
                              {stagesStatusUpdatingId === j.id ||
                              stagesInvoiceUpdatingId === bundleInvWithJob.id
                                ? '…'
                                : actionLabel}
                            </button>
                          ) : actionLabel ? (
                            <button
                              type="button"
                              onClick={() => onJobAction(j)}
                              disabled={stagesStatusUpdatingId === j.id}
                              style={{
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.8125rem',
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: stagesStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {stagesStatusUpdatingId === j.id ? '…' : actionLabel}
                            </button>
                          ) : null}
                          {showTimeOpen && (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'block', textAlign: 'center', minWidth: '5rem' }} title="Time since job created">
                              Open {formatTimeSince(j.created_at ?? null)}
                            </span>
                          )}
                          {!sendBackBelowRemaining && onJobSendBack && (
                            <button
                              type="button"
                              onClick={() => onJobSendBack(j)}
                              disabled={stagesStatusUpdatingId === j.id}
                              style={{
                                ...stagesSecondaryOutlineButtonBase,
                                cursor: stagesStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {jobSendBackLabel}
                            </button>
                          )}
                          {!sendBackBelowRemaining && onInvoiceSendBack && bundleInvWithJob != null && (
                            <button
                              type="button"
                              onClick={() => onInvoiceSendBack(bundleInvWithJob)}
                              disabled={stagesInvoiceUpdatingId === bundleInvWithJob.id}
                              title="Remove billing line (partial invoice)"
                              style={{
                                ...stagesSecondaryOutlineButtonBase,
                                cursor: stagesInvoiceUpdatingId === bundleInvWithJob.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {invoiceBundleActionLabel}
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                              {showCreatePartialInvoice && (() => {
                                const rem = jobBillingUnallocatedDollars(j)
                                return (
                                  <button
                                    type="button"
                                    onClick={() => { setCreatePartialInvoiceAmount(''); setCreatePartialInvoiceJob(j) }}
                                    disabled={rem <= 0}
                                    title={rem <= 0 ? 'No remaining amount' : 'Create partial invoice'}
                                    aria-label="Create partial invoice"
                                    style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: rem <= 0 ? 'not-allowed' : 'pointer', color: rem <= 0 ? 'var(--text-faint)' : '#16a34a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                      <path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM248 320C234.7 320 224 330.7 224 344C224 357.3 234.7 368 248 368L392 368C405.3 368 416 357.3 416 344C416 330.7 405.3 320 392 320L248 320zM248 416C234.7 416 224 426.7 224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440C416 426.7 405.3 416 392 416L248 416z" />
                                    </svg>
                                  </button>
                                )
                              })()}
                              <button
                                type="button"
                                onClick={() => openEdit(j)}
                                title="Edit"
                                aria-label="Edit"
                                style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                  <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => openStagesDetailJobModal(j)}
                                title="Job detail"
                                aria-label={`Open job detail for ${(j.job_name ?? '').trim() || 'Job'}`}
                                style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                  <path d="M264 112L376 112C380.4 112 384 115.6 384 120L384 160L256 160L256 120C256 115.6 259.6 112 264 112zM208 120L208 160L128 160C92.7 160 64 188.7 64 224L64 320L576 320L576 224C576 188.7 547.3 160 512 160L432 160L432 120C432 89.1 406.9 64 376 64L264 64C233.1 64 208 89.1 208 120zM576 368L384 368L384 384C384 401.7 369.7 416 352 416L288 416C270.3 416 256 401.7 256 384L256 368L64 368L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 368z" />
                                </svg>
                              </button>
                          </div>
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                              {showClickTooling && (
                                <button
                                  type="button"
                                  onClick={() => openInExternalBrowser(buildClickToolingUrl(j))}
                                  title="Open Click Tooling report (pre-fill customer info)"
                                  aria-label="Open Click Tooling"
                                  style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#FF6600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                    <path d="M541.4 162.6C549 155 561.7 156.9 565.5 166.9C572.3 184.6 576 203.9 576 224C576 312.4 504.4 384 416 384C398.5 384 381.6 381.2 365.8 376L178.9 562.9C150.8 591 105.2 591 77.1 562.9C49 534.8 49 489.2 77.1 461.1L264 274.2C258.8 258.4 256 241.6 256 224C256 135.6 327.6 64 416 64C436.1 64 455.4 67.7 473.1 74.5C483.1 78.3 484.9 91 477.4 98.6L388.7 187.3C385.7 190.3 384 194.4 384 198.6L384 240C384 248.8 391.2 256 400 256L441.4 256C445.6 256 449.7 254.3 452.7 251.3L541.4 162.6z" />
                                  </svg>
                                </button>
                              )}
                              {onOpenLienTooling &&
                                (() => {
                                  let invForLien: JobsLedgerInvoice | null = bundleInv ?? null
                                  if (!invForLien) {
                                    const billedOnly = (j.invoices ?? []).filter((i) => i.status === 'billed')
                                    invForLien = billedOnly.length === 1 ? billedOnly[0]! : null
                                  }
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => onOpenLienTooling({ job: j, invoice: invForLien })}
                                      title="Lien Tooling — review and open demand / lien forms"
                                      aria-label="Lien Tooling prefill"
                                      style={{
                                        padding: '0.25rem',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#FF6600',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                        <path d="M201.6 217.4L182.9 198.7C170.4 186.2 170.4 165.9 182.9 153.4L297.6 38.6C310.1 26.1 330.4 26.1 342.9 38.6L361.6 57.4C374.1 69.9 374.1 90.2 361.6 102.7L246.9 217.4C234.4 229.9 214.1 229.9 201.6 217.4zM308 275.7L276.6 244.3L388.6 132.3L508 251.7L396 363.7L364.6 332.3L132.6 564.3C117 579.9 91.7 579.9 76 564.3C60.3 548.7 60.4 523.4 76 507.7L308 275.7zM422.9 438.6C410.4 426.1 410.4 405.8 422.9 393.3L537.6 278.6C550.1 266.1 570.4 266.1 582.9 278.6L601.6 297.3C614.1 309.8 614.1 330.1 601.6 342.6L486.9 457.4C474.4 469.9 454.1 469.9 441.6 457.4L422.9 438.7z" />
                                      </svg>
                                    </button>
                                  )
                                })()}
                              {showAiaG702G703(authRole, j) ? (
                                <button
                                  type="button"
                                  onClick={() => setAiaG702StagesJob(j)}
                                  title="AIA G702-G703"
                                  aria-label="Open AIA G702-G703 workbook generator"
                                  style={{
                                    padding: '0.25rem',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#16a34a',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <FileSpreadsheet size={16} aria-hidden />
                                </button>
                              ) : null}
                              {canCreateHazmatFee ? (
                                <button
                                  type="button"
                                  onClick={() => openHazmatFee(j)}
                                  title="Hazmat Fee — document a biohazard incident and bill the customer"
                                  aria-label="Create a hazmat fee for this job"
                                  style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#FF6600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M292 76.6C292 68.3 284.4 62.1 276.5 64.5C215.6 83.3 171.4 140.3 171.4 207.6C171.4 232.7 177.5 256.3 188.4 277.1C167.4 278.9 146.4 285.3 126.9 296.6C69 330.2 42.1 396.8 56 459.1C57.9 467.5 67.4 471.1 74.9 466.7C79.9 463.8 82.5 458.1 82 452.3C81.7 449 81.6 445.7 81.6 442.2C81.6 318.7 266 318.7 266 442.2C266 530.6 171.5 555.8 117.8 517.6C113.3 514.4 107.3 513.7 102.5 516.5C95.5 520.6 93.9 530.1 99.8 535.6C146.4 579.4 217.8 589.5 275.9 555.8C293.8 545.4 308.7 531.9 320.4 516.4C332.1 532 347 545.5 364.9 555.8C423 589.5 494.4 579.4 541 535.6C546.9 530.1 545.3 520.5 538.3 516.5C533.5 513.7 527.5 514.4 523 517.6C469.3 555.8 374.8 530.6 374.8 442.2C374.8 318.7 559.2 318.7 559.2 442.2C559.2 445.6 559.1 449 558.8 452.3C558.3 458.1 560.9 463.8 565.9 466.7C573.3 471 582.9 467.5 584.8 459.1C598.7 396.9 571.8 330.2 513.9 296.6C494.4 285.3 473.5 278.9 452.4 277.1C463.3 256.3 469.4 232.7 469.4 207.6C469.4 140.3 425.2 83.3 364.3 64.5C356.4 62.1 348.8 68.3 348.8 76.6C348.8 82.5 352.8 87.6 358.3 89.8C441.7 123.4 429.1 268.2 320.5 268.2C211.9 268.2 199.1 123.4 282.5 89.8C288 87.6 292 82.5 292 76.6zM280.4 352C280.4 329.9 298.3 312 320.4 312C342.5 312 360.4 329.9 360.4 352C360.4 374.1 342.5 392 320.4 392C298.3 392 280.4 374.1 280.4 352zM467 381.7C450.8 381.7 435.6 387.2 424.9 396.7C414.8 405.8 406.8 420.1 406.8 442.3C406.8 463.4 414 477.3 423.3 486.4C455.5 461.8 478.8 425.9 487.2 384.6C480.9 382.7 474 381.6 467 381.6zM234 442.3C234 420 226 405.7 215.9 396.7C205.2 387.1 190 381.7 173.8 381.7C166.8 381.7 159.9 382.7 153.6 384.7C162 426 185.2 461.9 217.5 486.5C226.9 477.4 234 463.4 234 442.3zM275.2 218C284.2 228.2 298.4 236.2 320.4 236.2C342.4 236.2 356.6 228.2 365.6 218C372.3 210.4 377.1 200.5 379.2 189.6C360.9 182.8 341 179.1 320.4 179.1C299.8 179.1 279.9 182.8 261.6 189.6C263.8 200.5 268.5 210.4 275.2 218.1z" /></svg>
                                </button>
                              ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {expandedJobThreadId === j.id && (
                    <tr>
                      <td
                        colSpan={unifiedStagesColCount}
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: 'var(--bg-subtle)',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <JobThreadNotesPanel
                          pctComplete={j.pct_complete ?? null}
                          canEditPct={canEditJobPctComplete}
                          pctSaving={pctCompleteSavingId === j.id}
                          onCommitPct={(value, note) => commitStagesPctWithNote(j.id, value, note)}
                          teamMembers={j.team_members?.map((t) => ({ user_id: t.user_id, name: t.users?.name ?? null })) ?? []}
                          peopleAction={
                            canManageJobPeople
                              ? {
                                  onClick: () =>
                                    setManageJobPeople({
                                      jobId: j.id,
                                      jobLabel: `${(j.hcp_number ?? '').trim() || '—'} · ${(j.job_name ?? '').trim() || 'Job'}`,
                                      currentTeamUserIds: j.team_members?.map((t) => t.user_id) ?? [],
                                    }),
                                }
                              : undefined
                          }
                          activity={jobThreadActivityByJobId[j.id] ?? []}
                          loading={jobThreadNotesLoadingId === j.id}
                          canPost={!!authUser}
                          draft={jobThreadDraft}
                          submitting={jobThreadSubmittingId === j.id}
                          onDraftChange={setJobThreadDraft}
                          onSubmit={() => void submitJobThreadNote(j.id)}
                          scheduleAction={
                            canOpenJobScheduleModal
                              ? {
                                  onClick: () => setScheduleModalJob(j),
                                  disabled: (j.team_members?.length ?? 0) === 0,
                                }
                              : undefined
                          }
                          scheduleDispatchAction={
                            canOpenJobScheduleModal
                              ? {
                                  onClick: () => {
                                    const week = getDefaultWeekRange().start
                                    navigate(
                                      `/schedule-dispatch?jobId=${encodeURIComponent(j.id)}&week=${encodeURIComponent(week)}`,
                                    )
                                  },
                                  disabled: (j.team_members?.length ?? 0) === 0,
                                }
                              : undefined
                          }
                          viewerRole={authRole}
                        />
                      </td>
                    </tr>
                  )}
                  {renderStagesProjectBannerRow(j.project_id, j.project, unifiedStagesColCount)}
                  </Fragment>
                )
              } else {
                const { inv, job } = row
                const invWithJob: InvoiceWithJob = { ...inv, job }
                const stagesInvoiceHcpTrimmed = (job.hcp_number ?? '').trim()
                const stagesInvoiceRowHcpLabel = stagesInvoiceHcpTrimmed
                  ? `Invoice: ${stagesInvoiceHcpTrimmed}`
                  : '—'
                return (
                  <Fragment key={`inv-${inv.id}`}>
                  <tr
                    data-stages-invoice-id={inv.id}
                    data-stages-job-id={job.id}
                    style={{
                      borderBottom: stagesRowHasProjectBanner(job.project_id, job.project) ? 'none' : '1px solid #e5e7eb',
                      ...flashRowStyle(inv.id),
                      ...(stagesJobFlashId === job.id
                        ? { backgroundColor: 'var(--bg-amber-100)', outline: '2px solid #f59e0b', outlineOffset: -2, transition: 'background-color 0.35s ease' }
                        : {}),
                    }}
                    onClick={(e) => {
                      if (shouldSuppressStagesRowJobThreadToggle(e.target)) return
                      toggleStagesJobThreadExpanded(job.id)
                    }}
                  >
                    <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                      <div>{(job.team_members ?? []).map((t) => t.users?.name?.trim()).filter(Boolean).join(', ') || '—'}</div>
                      {stagesInvoiceHcpTrimmed ? (
                        <div style={{ marginTop: '0.15rem' }}>
                          <span style={stagesInvoiceHcpBadgeStyle}>{stagesInvoiceRowHcpLabel}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {stagesInvoiceRowHcpLabel}
                        </div>
                      )}
                      {renderStagesFieldAndBillingLines(job)}
                      {(() => {
                        const eff = effectiveInvoiceEstBillDate(inv, job)
                        const display = formatEstimatedCompletionDisplay(eff)
                        return (
                          <>
                            {display ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{display}</div>
                            ) : null}
                            {stagesHamMode ? (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  marginTop: '0.15rem',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    void bumpInvoiceEstimatedBillDate(inv.id, job.id, inv, job, -1)
                                  }}
                                  disabled={invoiceEstimatedBillDateSavingId === inv.id}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: 4,
                                    background: 'none',
                                    cursor: invoiceEstimatedBillDateSavingId === inv.id ? 'not-allowed' : 'pointer',
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  -1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void bumpInvoiceEstimatedBillDate(inv.id, job.id, inv, job, 1)
                                  }}
                                  disabled={invoiceEstimatedBillDateSavingId === inv.id}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: 4,
                                    background: 'none',
                                    cursor: invoiceEstimatedBillDateSavingId === inv.id ? 'not-allowed' : 'pointer',
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  +1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWhenInvoiceBillModal({
                                      invoiceId: inv.id,
                                      jobId: job.id,
                                      jobName: job.job_name ?? '—',
                                      hcpNumber: effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—',
                                    })
                                    setWhenInvoiceBillModalDate(
                                      inv.estimated_bill_date?.trim().slice(0, 10) ??
                                        job.last_bill_date?.trim().slice(0, 10) ??
                                        ''
                                    )
                                  }}
                                  disabled={invoiceEstimatedBillDateSavingId === inv.id}
                                  title="Edit est. bill date"
                                  aria-label="Edit est. bill date"
                                  style={{
                                    padding: '0.25rem',
                                    background: 'none',
                                    border: 'none',
                                    cursor: invoiceEstimatedBillDateSavingId === inv.id ? 'not-allowed' : 'pointer',
                                    color: 'var(--text-700)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden="true">
                                    <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                                  </svg>
                                </button>
                              </div>
                            ) : null}
                          </>
                        )
                      })()}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {(() => {
                        const fmt = formatJobNameTwoLines(job.job_name)
                        if (!fmt) return <div>—</div>
                        return (
                          <>
                            <div>{fmt.line1}</div>
                            {fmt.line2 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{fmt.line2}</div>}
                          </>
                        )
                      })()}
                      {renderJobAddressWithMap(job.job_address)}
                      {renderJobCustomerLine(job)}
                      {renderStagesJobColumnEstimateFooter(job.linkedEstimateForStages)}
                    </td>
                    {renderStagesLastActivityCell(job, inv)}
                    <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                        <StagesProgressPaymentCell
                          model={buildStagesMoneyBarModel({
                            totalBill: job.revenue != null ? Number(job.revenue) : null,
                            paymentsMade: job.payments_made != null ? Number(job.payments_made) : null,
                            pctComplete: job.pct_complete ?? null,
                            billedUnpaid: jobBilledUnpaidDollars(job),
                          })}
                          pctComplete={job.pct_complete ?? null}
                          pctSaving={pctCompleteSavingId === job.id}
                          onPctCommit={(n) => updateJobPctComplete(job.id, n)}
                          footnote={(() => {
                            const u = showRemaining ? jobBillingUnallocatedDollars(job) : 0
                            return (
                              <span>
                                <span title="Amount on this draft billing line">{`${formatUsdNoCents(Number(inv.amount))} draft`}</span>
                                {u > 0 ? (
                                  <span title="Left on the job after all draft and billed lines">{` · ${formatUsdNoCents(u)} unallocated`}</span>
                                ) : null}
                              </span>
                            )
                          })()}
                        />
                        {sendBackBelowRemaining && (
                          <button
                            type="button"
                            onClick={() => onInvoiceSendBack(invWithJob)}
                            disabled={stagesInvoiceUpdatingId === inv.id}
                            style={{
                              ...stagesSecondaryOutlineButtonBase,
                              cursor: stagesInvoiceUpdatingId === inv.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {invoiceStandaloneActionLabel}
                          </button>
                        )}
                        {onJobMoveToCollections && (
                          <button
                            type="button"
                            onClick={() => onJobMoveToCollections(job)}
                            title="Flag this job as difficult to collect (moves all its billed lines to the Collections section; stays Billed)"
                            style={{ ...stagesSecondaryOutlineButtonBase, cursor: 'pointer' }}
                          >
                            Move to Collections
                          </button>
                        )}
                        {renderJobNoteLine(job)}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                        {onViewBill ? (
                          <button
                            type="button"
                            onClick={() => onViewBill(invWithJob)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.8125rem',
                              background: 'var(--surface)',
                              color: 'var(--text-link)',
                              border: '1px solid #2563eb',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            View Bill
                          </button>
                        ) : null}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {actionLabel && (
                            <button
                              type="button"
                              onClick={() => onInvoiceAction(invWithJob)}
                              disabled={stagesInvoiceUpdatingId === inv.id}
                              style={{
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.8125rem',
                                background: '#16a34a',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: stagesInvoiceUpdatingId === inv.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {stagesInvoiceUpdatingId === inv.id ? '…' : actionLabel}
                            </button>
                          )}
                          {!sendBackBelowRemaining && (
                            <button
                              type="button"
                              onClick={() => onInvoiceSendBack(invWithJob)}
                              disabled={stagesInvoiceUpdatingId === inv.id}
                              style={{
                                ...stagesSecondaryOutlineButtonBase,
                                cursor: stagesInvoiceUpdatingId === inv.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {invoiceStandaloneActionLabel}
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          {showClickTooling && (
                            <button
                              type="button"
                              onClick={() => openInExternalBrowser(buildClickToolingUrl(job))}
                              title="Open Click Tooling report (pre-fill customer info)"
                              aria-label="Open Click Tooling"
                              style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#FF6600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                <path d="M541.4 162.6C549 155 561.7 156.9 565.5 166.9C572.3 184.6 576 203.9 576 224C576 312.4 504.4 384 416 384C398.5 384 381.6 381.2 365.8 376L178.9 562.9C150.8 591 105.2 591 77.1 562.9C49 534.8 49 489.2 77.1 461.1L264 274.2C258.8 258.4 256 241.6 256 224C256 135.6 327.6 64 416 64C436.1 64 455.4 67.7 473.1 74.5C483.1 78.3 484.9 91 477.4 98.6L388.7 187.3C385.7 190.3 384 194.4 384 198.6L384 240C384 248.8 391.2 256 400 256L441.4 256C445.6 256 449.7 254.3 452.7 251.3L541.4 162.6z" />
                              </svg>
                            </button>
                          )}
                          {onOpenLienTooling ? (
                            <button
                              type="button"
                              onClick={() => onOpenLienTooling({ job, invoice: inv })}
                              title="Lien Tooling — review and open demand / lien forms"
                              aria-label="Lien Tooling prefill"
                              style={{
                                padding: '0.25rem',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#FF6600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                <path d="M201.6 217.4L182.9 198.7C170.4 186.2 170.4 165.9 182.9 153.4L297.6 38.6C310.1 26.1 330.4 26.1 342.9 38.6L361.6 57.4C374.1 69.9 374.1 90.2 361.6 102.7L246.9 217.4C234.4 229.9 214.1 229.9 201.6 217.4zM308 275.7L276.6 244.3L388.6 132.3L508 251.7L396 363.7L364.6 332.3L132.6 564.3C117 579.9 91.7 579.9 76 564.3C60.3 548.7 60.4 523.4 76 507.7L308 275.7zM422.9 438.6C410.4 426.1 410.4 405.8 422.9 393.3L537.6 278.6C550.1 266.1 570.4 266.1 582.9 278.6L601.6 297.3C614.1 309.8 614.1 330.1 601.6 342.6L486.9 457.4C474.4 469.9 454.1 469.9 441.6 457.4L422.9 438.7z" />
                              </svg>
                            </button>
                          ) : null}
                          {showAiaG702G703(authRole, job, inv) ? (
                            <button
                              type="button"
                              onClick={() => setAiaG702StagesJob(job)}
                              title="AIA G702-G703"
                              aria-label="Open AIA G702-G703 workbook generator"
                              style={{
                                padding: '0.25rem',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#16a34a',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <FileSpreadsheet size={16} aria-hidden />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openEdit(job)}
                            title="Edit"
                            aria-label="Edit"
                            style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                              <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => openStagesDetailJobModal(job)}
                            title="Job detail"
                            aria-label={`Open job detail for ${(job.job_name ?? '').trim() || 'Job'}`}
                            style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                              <path d="M264 112L376 112C380.4 112 384 115.6 384 120L384 160L256 160L256 120C256 115.6 259.6 112 264 112zM208 120L208 160L128 160C92.7 160 64 188.7 64 224L64 320L576 320L576 224C576 188.7 547.3 160 512 160L432 160L432 120C432 89.1 406.9 64 376 64L264 64C233.1 64 208 89.1 208 120zM576 368L384 368L384 384C384 401.7 369.7 416 352 416L288 416C270.3 416 256 401.7 256 384L256 368L64 368L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 368z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {expandedJobThreadId === job.id && (
                    <tr>
                      <td
                        colSpan={unifiedStagesColCount}
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: 'var(--bg-subtle)',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <JobThreadNotesPanel
                          pctComplete={job.pct_complete ?? null}
                          canEditPct={canEditJobPctComplete}
                          pctSaving={pctCompleteSavingId === job.id}
                          onCommitPct={(value, note) => commitStagesPctWithNote(job.id, value, note)}
                          teamMembers={job.team_members?.map((t) => ({ user_id: t.user_id, name: t.users?.name ?? null })) ?? []}
                          peopleAction={
                            canManageJobPeople
                              ? {
                                  onClick: () =>
                                    setManageJobPeople({
                                      jobId: job.id,
                                      jobLabel: `${(job.hcp_number ?? '').trim() || '—'} · ${(job.job_name ?? '').trim() || 'Job'}`,
                                      currentTeamUserIds: job.team_members?.map((t) => t.user_id) ?? [],
                                    }),
                                }
                              : undefined
                          }
                          activity={jobThreadActivityByJobId[job.id] ?? []}
                          loading={jobThreadNotesLoadingId === job.id}
                          canPost={!!authUser}
                          draft={jobThreadDraft}
                          submitting={jobThreadSubmittingId === job.id}
                          onDraftChange={setJobThreadDraft}
                          onSubmit={() => void submitJobThreadNote(job.id)}
                          scheduleAction={
                            canOpenJobScheduleModal
                              ? {
                                  onClick: () => setScheduleModalJob(job),
                                  disabled: (job.team_members?.length ?? 0) === 0,
                                }
                              : undefined
                          }
                          scheduleDispatchAction={
                            canOpenJobScheduleModal
                              ? {
                                  onClick: () => {
                                    const week = getDefaultWeekRange().start
                                    navigate(
                                      `/schedule-dispatch?jobId=${encodeURIComponent(job.id)}&week=${encodeURIComponent(week)}`,
                                    )
                                  },
                                  disabled: (job.team_members?.length ?? 0) === 0,
                                }
                              : undefined
                          }
                          viewerRole={authRole}
                        />
                      </td>
                    </tr>
                  )}
                  {renderStagesProjectBannerRow(job.project_id, job.project, unifiedStagesColCount)}
                  </Fragment>
                )
              }
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
