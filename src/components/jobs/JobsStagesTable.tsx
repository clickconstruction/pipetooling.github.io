import { Fragment, type Dispatch, type MutableRefObject, type ReactNode, type SetStateAction } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatTimeSince } from '../../lib/jobs/jobFormatting'
import { jobBilledUnpaidDollars, stagesJobLevelStripeEmailedHintInvoice } from '../../lib/jobs/invoiceBilling'
import { jobBillingUnallocatedDollars } from '../../lib/jobsStagesBoard'
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
  renderStagesTwoLineHeader,
  shouldSuppressStagesRowJobThreadToggle,
  stagesRowHasProjectBanner,
  type StagesRowRenderContext,
} from './jobsStagesRowShared'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * Stages job-only section table (Waiting / Working / Paid in Full) — Jobs.tsx
 * decomposition step 9a (docs/JOBS_TABS_ARCHITECTURE.md "Section renderers").
 * Behavior-preserving move of the IIFE closure `renderStagesTable(jobList,
 * actionLabel, onAction, showTimeOpen?, onSendBack?, onSendBackSimple?,
 * showPctComplete?)`: the former parameters and every captured page value are
 * same-named props (wide prop list accepted for this step — the step-9b
 * JobsStagesTab becomes the single caller and absorbs most of them). The
 * quick-action stack's `navigate` + dispatch-task/checklist modal contexts are
 * consumed via their app-global hooks here instead of props.
 */
export type JobsStagesTableProps = {
  jobList: JobWithDetails[]
  actionLabel: React.ReactNode | null
  onAction: (j: JobWithDetails) => void
  showTimeOpen?: boolean
  onSendBack?: (j: JobWithDetails) => void
  onSendBackSimple?: (j: JobWithDetails) => void
  showPctComplete?: boolean
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
}

export default function JobsStagesTable(props: JobsStagesTableProps) {
  const {
    jobList,
    actionLabel,
    onAction,
    showTimeOpen,
    onSendBack,
    onSendBackSimple,
    showPctComplete,
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

  const stagesTableColCount = 5
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
      {/* tableLayout: fixed (v2.967): column widths come from the colgroup, never from content
          measurement — lazy-loaded rows and search filtering used to re-measure auto layout and
          make the Job column jitter a few px. The unspecified col takes the remaining width. */}
      <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: '0.875rem', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '9rem' }} />
          <col />
          <col style={{ width: 200 }} />
          <col style={{ width: '12rem' }} />
          <col style={{ width: 140 }} />
        </colgroup>
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
              {renderStagesTwoLineHeader('Team &', 'Last-update')}
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', minWidth: 200 }}>Activity</th>
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
          {jobList.length === 0 ? (
            <tr>
              <td colSpan={stagesTableColCount} style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                No jobs in this group
              </td>
            </tr>
          ) : (
            jobList.map((j) => (
              <Fragment key={j.id}>
              <tr
                data-stages-job-id={j.id}
                style={{
                  borderBottom: stagesRowHasProjectBanner(j.project_id, j.project) ? 'none' : '1px solid #e5e7eb',
                  ...(stagesJobFlashId === j.id
                    ? { backgroundColor: 'var(--bg-amber-100)', outline: '2px solid #f59e0b', outlineOffset: -2, transition: 'background-color 0.35s ease' }
                    : {}),
                }}
                onClick={(e) => {
                  if (shouldSuppressStagesRowJobThreadToggle(e.target)) return
                  toggleStagesJobThreadExpanded(j.id)
                }}
              >
                <td style={{ padding: '0.75rem', position: 'relative', verticalAlign: 'top' }}>
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
                      {renderStagesJobHcpSubline(j)}
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
                  {renderStagesJobColumnEstimateFooter(j.linkedEstimateForStages)}
                </td>
                {renderStagesLastActivityCell(j, stagesJobLevelStripeEmailedHintInvoice(j))}
                <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                  <StagesProgressPaymentCell
                    model={buildStagesMoneyBarModel({
                      totalBill: j.revenue != null ? Number(j.revenue) : null,
                      paymentsMade: j.payments_made != null ? Number(j.payments_made) : null,
                      pctComplete: j.pct_complete ?? null,
                      billedUnpaid: jobBilledUnpaidDollars(j),
                    })}
                    pctComplete={j.pct_complete ?? null}
                    pctSaving={showPctComplete ? pctCompleteSavingId === j.id : undefined}
                    onPctCommit={showPctComplete ? (n) => updateJobPctComplete(j.id, n) : undefined}
                  />
                </td>
                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {showTimeOpen && (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'block', textAlign: 'center', minWidth: '5rem' }} title="Time since job created">
                            Open {formatTimeSince(j.created_at ?? null)}
                          </span>
                        )}
                        {onSendBack && (
                          <button
                            type="button"
                            onClick={() => onSendBack(j)}
                            disabled={stagesStatusUpdatingId === j.id}
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.8125rem',
                              background: 'none',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              cursor: stagesStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Send back
                          </button>
                        )}
                        {onSendBackSimple && (
                          <button
                            type="button"
                            onClick={() => onSendBackSimple(j)}
                            disabled={stagesStatusUpdatingId === j.id}
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.8125rem',
                              background: 'none',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              cursor: stagesStatusUpdatingId === j.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Send back
                          </button>
                        )}
                        {actionLabel && (
                          <button
                            type="button"
                            onClick={() => onAction(j)}
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
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            {(() => {
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
                    colSpan={stagesTableColCount}
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
              {renderStagesProjectBannerRow(j.project_id, j.project, stagesTableColCount)}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
