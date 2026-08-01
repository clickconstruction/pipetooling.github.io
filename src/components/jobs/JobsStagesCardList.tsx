import { useNavigate } from 'react-router-dom'
import type { CSSProperties, ReactNode } from 'react'
import { useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import { useDispatchTaskModal } from '../../contexts/DispatchTaskModalContext'
import { formatTimeSince } from '../../lib/jobs/jobFormatting'
import { jobBilledUnpaidDollars } from '../../lib/jobs/invoiceBilling'
import { jobBillingUnallocatedDollars } from '../../lib/jobsStagesBoard'
import type { InvoiceWithJob } from '../../lib/jobsStagesBoard'
import { buildStagesMoneyBarModel } from '../../lib/stagesMoneyBar'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { showAiaG702G703 } from '../../lib/aiaG702G703Eligibility'
import { getDefaultWeekRange } from '../../utils/dateUtils'
import StagesProgressPaymentCell from './StagesProgressPaymentCell'
import { JobThreadNotesPanel } from '../JobThreadNotesPanel'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobsStagesTableProps } from './JobsStagesTable'
import type { JobsStagesUnifiedTableProps } from './JobsStagesUnifiedTable'
import {
  renderJobAddressWithMap,
  renderJobCustomerLine as renderJobCustomerLineWithCtx,
  renderStagesFieldAndBillingLines as renderStagesFieldAndBillingLinesWithCtx,
  renderStagesJobColumnEstimateFooter,
  renderStagesJobHcpSubline,
  renderStagesLastActivityCell as renderStagesLastActivityCellWithCtx,
  renderStagesThreadFullscreenJobHeader,
  renderStagesEditModeRail,
  shouldSuppressStagesRowJobThreadToggle,
  STAGES_EDIT_MODE_RAIL_WIDTH,
  type StagesRowRenderContext,
} from './jobsStagesRowShared'

/**
 * Stages "Mobile cards" view (v2.1241, ⋯ tools menu toggle): the same section
 * data as JobsStagesTable / JobsStagesUnifiedTable rendered as full-width
 * vertical cards instead of a 940px-min table — built for phones, no sideways
 * scroll. Deliberately consumes the SAME props types as the tables so the
 * section render sites just swap the component, and reuses the shared row
 * renderers (`jobsStagesRowShared`) + `StagesProgressPaymentCell` +
 * `JobThreadNotesPanel`, so every action routes through the table handlers.
 * Card anatomy: identity + the section's primary action pinned top-right,
 * address/customer, crew, field/billing lines, money bar, the activity body
 * (thread teaser, Next appointment, invoice chips, View reports), then — when
 * the card is expanded (tap, same as a table row) — the thread panel and a
 * labeled toolbelt.
 */

const cardStyle: CSSProperties = {
  position: 'relative',
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'var(--surface)',
  padding: '0.6rem 0.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.45rem',
  overflow: 'hidden',
}

const cardPrimaryActionStyle: CSSProperties = {
  marginLeft: 'auto',
  flexShrink: 0,
  padding: '0.35rem 0.75rem',
  fontSize: '0.8125rem',
  background: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
}

const cardToolbeltButtonStyle: CSSProperties = {
  padding: '0.3rem 0.6rem',
  fontSize: '0.75rem',
  background: 'none',
  color: 'var(--text-700)',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

function crewLine(job: JobWithDetails) {
  const names = (job.team_members ?? [])
    .map((t) => t.users?.name?.trim())
    .filter(Boolean)
    .join(', ')
  return (
    <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>{names || '—'}</div>
  )
}

/** Thread-panel inputs shared verbatim by both tables (structural subset). */
type StagesCardThreadProps = Pick<
  JobsStagesTableProps,
  | 'canEditJobPctComplete'
  | 'pctCompleteSavingId'
  | 'commitStagesPctWithNote'
  | 'canManageJobPeople'
  | 'setManageJobPeople'
  | 'jobThreadNotesLoadingId'
  | 'jobThreadDraft'
  | 'jobThreadSubmittingId'
  | 'setJobThreadDraft'
  | 'submitJobThreadNote'
  | 'authUser'
  | 'jobThreadFullscreen'
  | 'setJobThreadFullscreen'
  | 'canOpenJobScheduleModal'
  | 'setScheduleModalJob'
  | 'authRole'
>

function renderCardThreadPanel(p: StagesCardThreadProps, ctx: StagesRowRenderContext, j: JobWithDetails) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', background: 'var(--bg-subtle)', margin: '0 -0.75rem -0.6rem', padding: '0.5rem 0.75rem 0.6rem' }}>
      <JobThreadNotesPanel
        fullscreenControl={{ active: p.jobThreadFullscreen, onToggle: () => p.setJobThreadFullscreen(!p.jobThreadFullscreen) }}
        fullscreenHeader={renderStagesThreadFullscreenJobHeader(j)}
        nextAppointment={ctx.stagesUpcomingByJobId[j.id] ?? null}
        pctComplete={j.pct_complete ?? null}
        canEditPct={p.canEditJobPctComplete}
        pctSaving={p.pctCompleteSavingId === j.id}
        onCommitPct={(value, note) => p.commitStagesPctWithNote(j.id, value, note)}
        teamMembers={j.team_members?.map((t) => ({ user_id: t.user_id, name: t.users?.name ?? null })) ?? []}
        peopleAction={
          p.canManageJobPeople
            ? {
                onClick: () =>
                  p.setManageJobPeople({
                    jobId: j.id,
                    jobLabel: `${(j.hcp_number ?? '').trim() || '—'} · ${(j.job_name ?? '').trim() || 'Job'}`,
                    currentTeamUserIds: j.team_members?.map((t) => t.user_id) ?? [],
                  }),
              }
            : undefined
        }
        activity={ctx.jobThreadActivityByJobId[j.id] ?? []}
        loading={p.jobThreadNotesLoadingId === j.id}
        canPost={!!p.authUser}
        draft={p.jobThreadDraft}
        submitting={p.jobThreadSubmittingId === j.id}
        onDraftChange={p.setJobThreadDraft}
        onSubmit={() => void p.submitJobThreadNote(j.id)}
        scheduleAction={
          p.canOpenJobScheduleModal
            ? { onClick: () => p.setScheduleModalJob(j), disabled: (j.team_members?.length ?? 0) === 0 }
            : undefined
        }
        scheduleDispatchAction={
          p.canOpenJobScheduleModal
            ? {
                onClick: () => {
                  const week = getDefaultWeekRange().start
                  ctx.navigate(`/schedule-dispatch?jobId=${encodeURIComponent(j.id)}&week=${encodeURIComponent(week)}`)
                },
                disabled: (j.team_members?.length ?? 0) === 0,
              }
            : undefined
        }
        viewerRole={p.authRole}
      />
    </div>
  )
}

export default function JobsStagesCardList(props: JobsStagesTableProps) {
  const {
    jobList,
    actionLabel,
    onAction,
    showTimeOpen,
    onSendBack,
    onSendBackSimple,
    showPctComplete,
    stagesJobFlashId,
    stagesEditMode,
    renderStagesOpenDetailJobName,
    stagesStatusUpdatingId,
    pctCompleteSavingId,
    updateJobPctComplete,
    setCreatePartialInvoiceAmount,
    setCreatePartialInvoiceJob,
    openEdit,
    openStagesDetailJobModal,
    setAiaG702StagesJob,
    canCreateHazmatFee,
    openHazmatFee,
    hazmatFeeJobIds,
    canEditJobPctComplete,
  } = props
  const navigate = useNavigate()
  const dispatchTaskModal = useDispatchTaskModal()
  const checklistAddModal = useChecklistAddModal()
  const ctx: StagesRowRenderContext = {
    showToast: props.showToast,
    customers: props.customers,
    openEditJobAndCreateCustomerFlow: props.openEditJobAndCreateCustomerFlow,
    stagesManHoursByJobId: props.stagesManHoursByJobId,
    stagesManHoursLoading: props.stagesManHoursLoading,
    stagesLaborBreakdownByJobId: props.stagesLaborBreakdownByJobId,
    expandedJobThreadId: props.expandedJobThreadId,
    toggleStagesJobThreadExpanded: props.toggleStagesJobThreadExpanded,
    jobThreadStatsByJobId: props.jobThreadStatsByJobId,
    jobThreadActivityByJobId: props.jobThreadActivityByJobId,
    openJobThreadFullscreen: props.openJobThreadFullscreen,
    openJobCalendar: props.openJobCalendar,
    stagesUpcomingByJobId: props.stagesUpcomingByJobId,
    applyStagesInvoiceFocus: props.applyStagesInvoiceFocus,
    canOpenJobScheduleModal: props.canOpenJobScheduleModal,
    setScheduleModalJob: props.setScheduleModalJob,
    navigate,
    authRole: props.authRole,
    dispatchTaskModal,
    checklistAddModal,
    loadJobs: props.loadJobs,
    onDevelopmentFilter: props.onDevelopmentFilter,
  }

  if (jobList.length === 0) {
    return <p style={{ margin: 0, padding: '0.5rem 0.25rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No jobs in this group</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {jobList.map((j) => {
        const expanded = props.expandedJobThreadId === j.id
        const busy = stagesStatusUpdatingId === j.id
        return (
          <div
            key={j.id}
            data-stages-job-id={j.id}
            style={{
              ...cardStyle,
              ...(stagesEditMode ? { paddingLeft: `calc(0.75rem + ${STAGES_EDIT_MODE_RAIL_WIDTH}px)` } : {}),
              ...(stagesJobFlashId === j.id
                ? { backgroundColor: 'var(--bg-amber-100)', outline: '2px solid #f59e0b', outlineOffset: -2 }
                : {}),
            }}
            onClick={(e) => {
              if (shouldSuppressStagesRowJobThreadToggle(e.target)) return
              props.toggleStagesJobThreadExpanded(j.id)
            }}
          >
            {stagesEditMode ? renderStagesEditModeRail(j, openEdit) : null}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div style={{ minWidth: 0, flex: 1 }}>{renderStagesOpenDetailJobName(j)}</div>
              {actionLabel ? (
                <button
                  type="button"
                  onClick={() => onAction(j)}
                  disabled={busy}
                  style={{ ...cardPrimaryActionStyle, cursor: busy ? 'not-allowed' : 'pointer' }}
                >
                  {busy ? '…' : actionLabel}
                </button>
              ) : null}
            </div>
            {renderStagesJobHcpSubline(j)}
            {crewLine(j)}
            {renderJobAddressWithMap(j.job_address)}
            {renderJobCustomerLineWithCtx(ctx, j)}
            {renderStagesJobColumnEstimateFooter(j.linkedEstimateForStages)}
            {renderStagesFieldAndBillingLinesWithCtx(ctx, j)}
            <StagesProgressPaymentCell
              model={buildStagesMoneyBarModel({
                totalBill: j.revenue != null ? Number(j.revenue) : null,
                paymentsMade: j.payments_made != null ? Number(j.payments_made) : null,
                pctComplete: j.pct_complete ?? null,
                billedUnpaid: jobBilledUnpaidDollars(j),
              })}
              pctComplete={j.pct_complete ?? null}
              pctSaving={showPctComplete ? pctCompleteSavingId === j.id : undefined}
              onPctCommit={showPctComplete && canEditJobPctComplete ? (n) => updateJobPctComplete(j.id, n) : undefined}
              footnote={showTimeOpen ? `Open ${formatTimeSince(j.created_at ?? null)}` : undefined}
              onNoBidValueClick={() => openEdit(j, { fixturesSectionHighlight: true })}
            />
            {renderStagesLastActivityCellWithCtx(ctx, j, undefined, { asDiv: true })}
            {expanded ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                <button type="button" style={cardToolbeltButtonStyle} onClick={() => openStagesDetailJobModal(j)}>
                  Job detail
                </button>
                <button type="button" style={cardToolbeltButtonStyle} onClick={() => openEdit(j)}>
                  Edit job
                </button>
                <button type="button" style={cardToolbeltButtonStyle} onClick={() => props.openJobCalendar(j)}>
                  Calendar
                </button>
                {(() => {
                  const rem = jobBillingUnallocatedDollars(j)
                  return rem > 0 ? (
                    <button
                      type="button"
                      style={cardToolbeltButtonStyle}
                      onClick={() => {
                        setCreatePartialInvoiceAmount('')
                        setCreatePartialInvoiceJob(j)
                      }}
                    >
                      Partial invoice
                    </button>
                  ) : null
                })()}
                {showAiaG702G703(props.authRole, j) ? (
                  <button type="button" style={cardToolbeltButtonStyle} onClick={() => setAiaG702StagesJob(j)}>
                    AIA G702
                  </button>
                ) : null}
                {canCreateHazmatFee ? (
                  <button
                    type="button"
                    style={{
                      ...cardToolbeltButtonStyle,
                      ...(hazmatFeeJobIds?.has(j.id) ? { border: '2px solid #22c55e' } : {}),
                      color: '#FF6600',
                    }}
                    onClick={() => openHazmatFee(j)}
                  >
                    Hazmat fee
                  </button>
                ) : null}
                {onSendBack ? (
                  <button type="button" style={{ ...cardToolbeltButtonStyle, color: 'var(--text-muted)' }} disabled={busy} onClick={() => onSendBack(j)}>
                    Send back
                  </button>
                ) : null}
                {onSendBackSimple ? (
                  <button type="button" style={{ ...cardToolbeltButtonStyle, color: 'var(--text-muted)' }} disabled={busy} onClick={() => onSendBackSimple(j)}>
                    Send back
                  </button>
                ) : null}
              </div>
            ) : null}
            {expanded ? renderCardThreadPanel(props, ctx, j) : null}
          </div>
        )
      })}
    </div>
  )
}

/** Unified sections (Ready to Bill / Billed / Collections): one job-anchored card per StageRow. */
export function JobsStagesUnifiedCardList(props: JobsStagesUnifiedTableProps) {
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
    jobSendBackLabel,
    invoiceBundleActionLabel,
    invoiceStandaloneActionLabel,
    flashInvoiceId,
    onOpenLienTooling,
    onJobMoveToCollections,
    jobNoteLine,
    stagesJobFlashId,
    stagesEditMode,
    renderStagesOpenDetailJobName,
    stagesStatusUpdatingId,
    stagesInvoiceUpdatingId,
    pctCompleteSavingId,
    updateJobPctComplete,
    openEdit,
    openStagesDetailJobModal,
    canEditJobPctComplete,
  } = props
  const navigate = useNavigate()
  const dispatchTaskModal = useDispatchTaskModal()
  const checklistAddModal = useChecklistAddModal()
  const ctx: StagesRowRenderContext = {
    showToast: props.showToast,
    customers: props.customers,
    openEditJobAndCreateCustomerFlow: props.openEditJobAndCreateCustomerFlow,
    stagesManHoursByJobId: props.stagesManHoursByJobId,
    stagesManHoursLoading: props.stagesManHoursLoading,
    stagesLaborBreakdownByJobId: props.stagesLaborBreakdownByJobId,
    expandedJobThreadId: props.expandedJobThreadId,
    toggleStagesJobThreadExpanded: props.toggleStagesJobThreadExpanded,
    jobThreadStatsByJobId: props.jobThreadStatsByJobId,
    jobThreadActivityByJobId: props.jobThreadActivityByJobId,
    openJobThreadFullscreen: props.openJobThreadFullscreen,
    openJobCalendar: props.openJobCalendar,
    stagesUpcomingByJobId: props.stagesUpcomingByJobId,
    applyStagesInvoiceFocus: props.applyStagesInvoiceFocus,
    canOpenJobScheduleModal: props.canOpenJobScheduleModal,
    setScheduleModalJob: props.setScheduleModalJob,
    navigate,
    authRole: props.authRole,
    dispatchTaskModal,
    checklistAddModal,
    loadJobs: props.loadJobs,
    onDevelopmentFilter: props.onDevelopmentFilter,
  }

  if (rows.length === 0) {
    return (
      <p style={{ margin: 0, padding: '0.5rem 0.25rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        No jobs or invoices in this group
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {rows.map((row) => {
        const j = row.job
        const inv = row.kind === 'job' ? null : row.inv
        const invWithJob: InvoiceWithJob | null = inv ? { ...inv, job: j } : null
        const key =
          row.kind === 'invoice'
            ? `inv-${row.inv.id}`
            : inv
              ? `job-${j.id}-${row.kind}-${inv.id}`
              : `job-${j.id}`
        const expanded = props.expandedJobThreadId === j.id
        const jobBusy = stagesStatusUpdatingId === j.id
        const invBusy = inv != null && stagesInvoiceUpdatingId === inv.id
        const primary: { label: ReactNode; onClick: () => void; busy: boolean } | null = (() => {
          if (row.kind === 'job') {
            return actionLabel ? { label: actionLabel, onClick: () => onJobAction(j), busy: jobBusy } : null
          }
          if (row.kind === 'invoice') {
            return invoiceStandaloneActionLabel && invWithJob
              ? { label: invoiceStandaloneActionLabel, onClick: () => onInvoiceAction(invWithJob), busy: invBusy }
              : null
          }
          return invoiceBundleActionLabel && invWithJob
            ? { label: invoiceBundleActionLabel, onClick: () => onInvoiceAction(invWithJob), busy: invBusy }
            : null
        })()
        const noteLine = jobNoteLine?.(j)?.trim() || null
        const flash = stagesJobFlashId === j.id || (inv != null && flashInvoiceId === inv.id)
        return (
          <div
            key={key}
            data-stages-job-id={j.id}
            data-stages-invoice-id={inv?.id}
            style={{
              ...cardStyle,
              ...(stagesEditMode ? { paddingLeft: `calc(0.75rem + ${STAGES_EDIT_MODE_RAIL_WIDTH}px)` } : {}),
              ...(flash ? { backgroundColor: 'var(--bg-amber-100)', outline: '2px solid #f59e0b', outlineOffset: -2 } : {}),
            }}
            onClick={(e) => {
              if (shouldSuppressStagesRowJobThreadToggle(e.target)) return
              props.toggleStagesJobThreadExpanded(j.id)
            }}
          >
            {stagesEditMode ? renderStagesEditModeRail(j, openEdit) : null}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div style={{ minWidth: 0, flex: 1 }}>{renderStagesOpenDetailJobName(j)}</div>
              {primary ? (
                <button
                  type="button"
                  onClick={primary.onClick}
                  disabled={primary.busy}
                  style={{ ...cardPrimaryActionStyle, cursor: primary.busy ? 'not-allowed' : 'pointer' }}
                >
                  {primary.busy ? '…' : primary.label}
                </button>
              ) : null}
            </div>
            {renderStagesJobHcpSubline(j)}
            {inv ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  Invoice {formatUsdNoCents(Number(inv.amount ?? 0))}
                </strong>
                {row.kind === 'invoice' && inv.sequence_order != null ? (
                  <span style={{ color: 'var(--text-muted)' }}> · #{inv.sequence_order}</span>
                ) : null}
                {showRemaining ? (
                  <span style={{ color: 'var(--text-muted)' }}>
                    {' '}
                    · remaining {formatUsdNoCents(jobBillingUnallocatedDollars(j))}
                  </span>
                ) : null}
              </div>
            ) : null}
            {noteLine ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{noteLine}</div> : null}
            {crewLine(j)}
            {renderJobAddressWithMap(j.job_address)}
            {renderJobCustomerLineWithCtx(ctx, j)}
            {renderStagesFieldAndBillingLinesWithCtx(ctx, j)}
            <StagesProgressPaymentCell
              model={buildStagesMoneyBarModel({
                totalBill: j.revenue != null ? Number(j.revenue) : null,
                paymentsMade: j.payments_made != null ? Number(j.payments_made) : null,
                pctComplete: j.pct_complete ?? null,
                billedUnpaid: jobBilledUnpaidDollars(j),
              })}
              pctComplete={j.pct_complete ?? null}
              pctSaving={pctCompleteSavingId === j.id}
              onPctCommit={canEditJobPctComplete ? (n) => updateJobPctComplete(j.id, n) : undefined}
              footnote={showTimeOpen ? `Open ${formatTimeSince(j.created_at ?? null)}` : undefined}
              onNoBidValueClick={() => openEdit(j, { fixturesSectionHighlight: true })}
            />
            {renderStagesLastActivityCellWithCtx(ctx, j, inv ?? undefined, { asDiv: true })}
            {expanded ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                <button type="button" style={cardToolbeltButtonStyle} onClick={() => openStagesDetailJobModal(j)}>
                  Job detail
                </button>
                <button type="button" style={cardToolbeltButtonStyle} onClick={() => openEdit(j)}>
                  Edit job
                </button>
                <button type="button" style={cardToolbeltButtonStyle} onClick={() => props.openJobCalendar(j)}>
                  Calendar
                </button>
                {onViewBill && invWithJob ? (
                  <button type="button" style={cardToolbeltButtonStyle} onClick={() => onViewBill(invWithJob)}>
                    View bill
                  </button>
                ) : null}
                {onOpenLienTooling ? (
                  <button type="button" style={cardToolbeltButtonStyle} onClick={() => onOpenLienTooling({ job: j, invoice: inv })}>
                    Lien tooling
                  </button>
                ) : null}
                {onJobMoveToCollections ? (
                  <button type="button" style={{ ...cardToolbeltButtonStyle, color: 'var(--text-amber-800)' }} onClick={() => onJobMoveToCollections(j)}>
                    To collections
                  </button>
                ) : null}
                {row.kind === 'job' && onJobSendBack ? (
                  <button type="button" style={{ ...cardToolbeltButtonStyle, color: 'var(--text-muted)' }} disabled={jobBusy} onClick={() => onJobSendBack(j)}>
                    {jobSendBackLabel ?? 'Send back'}
                  </button>
                ) : null}
                {row.kind !== 'job' && invWithJob ? (
                  <button
                    type="button"
                    style={{ ...cardToolbeltButtonStyle, color: 'var(--text-muted)' }}
                    disabled={invBusy}
                    onClick={() => onInvoiceSendBack(invWithJob)}
                  >
                    {jobSendBackLabel ?? 'Send back'}
                  </button>
                ) : null}
              </div>
            ) : null}
            {expanded ? renderCardThreadPanel(props, ctx, j) : null}
          </div>
        )
      })}
    </div>
  )
}
