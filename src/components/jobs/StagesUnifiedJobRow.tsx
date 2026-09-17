/**
 * A job-backed row of the unified Pipeline table (Stages tab decomposition PR 10, v2.3548):
 * `job`, `job_with_merged_billed` and `job_with_primary_rtb` — the job row that may carry a
 * bundled bill line. Moved verbatim out of `JobsStagesUnifiedTable.tsx`, which builds the
 * `t` context once per render from its post-default props and its helpers. The key the
 * table gives it is `stagesUnifiedRowKey` (lib), unchanged from before the split.
 */
import StagesProgressPaymentCell from './StagesProgressPaymentCell'
import ViewBillWithPdfTail from './ViewBillWithPdfTail'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { Database } from '../../types/database'
import type { StagesUnifiedRowContext } from './JobsStagesUnifiedTable'
import { Fragment } from 'react'
import { JobsStagesActivityBox } from './JobsStagesActivityBox'
import { STAGES_EDIT_MODE_RAIL_WIDTH, accountManOnlyStripeStyle, renderJobAddressWithMap, renderStagesEditModeRail, renderStagesJobColumnEstimateFooter, renderStagesJobHcpSubline, renderStagesProjectBannerRow, renderStagesThreadExpandButton, renderStagesViewReportsButton, shouldSuppressStagesRowJobThreadToggle, stagesRowHasProjectBanner } from './jobsStagesRowShared'
import { ShareJobButton } from './ShareJobButton'
import { StagesAiaG702Button, StagesHazmatFeeButton, StagesLienInstrumentsButton, StagesLienReleaseButton, StagesTestReportButton } from './StagesRowActionButtons'
import { StagesCrewLine } from './StagesCrewLine'
import { StagesExpandedThreadRow } from './StagesExpandedThreadRow'
import { formatCurrency, formatTimeSince, formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { invoiceOpenRemainingOnJob, sumInvoiceAppliedFromJobPayments } from '../../lib/jobs/invoiceBilling'
import { jobBillingUnallocatedDollars, type InvoiceWithJob } from '../../lib/jobsStagesBoard'
import { progressPaymentForJob } from '../../lib/jobs/progressPaymentForJob'
import { showAiaG702G703 } from '../../lib/aiaG702G703Eligibility'
import { stagesAddedStampLabel } from '../../lib/jobsStagesSortMode'
import { stagesBillSentPctAlert } from '../../lib/jobs/stagesBillSentPctAlert'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

export type StagesUnifiedJobRowKind = Extract<StageRow, { kind: 'job' | 'job_with_merged_billed' | 'job_with_primary_rtb' }>

export function StagesUnifiedJobRow({ row, t }: { row: StagesUnifiedJobRowKind; t: StagesUnifiedRowContext }) {
  const {
    actionLabel,
    onJobAction,
    onInvoiceAction,
    onViewBill,
    onJobSendBack,
    onInvoiceSendBack,
    showRemaining,
    showTimeOpen,
    sendBackBelowRemaining,
    jobSendBackLabel,
    invoiceBundleActionLabel,
    showClickTooling,
    onOpenLienTooling,
    onOpenLienRelease,
    lienReleaseJobIds,
    demandOutJobIds,
    onJobMoveToCollections,
    stagesJobFlashId,
    stagesEditMode,
    renderStagesOpenDetailJobName,
    stagesStatusUpdatingId,
    pctCompleteSavingId,
    updateJobPctComplete,
    openEdit,
    setAiaG702StagesJob,
    canCreateHazmatFee,
    openHazmatFee,
    hazmatFeeJobIds,
    submitJobThreadNoteWithBody,
    loadJobThreadNotesForJob,
    expandedJobThreadId,
    toggleStagesJobThreadExpanded,
    authRole,
    stagesInvoiceUpdatingId,
    openTestReportFor,
    stagesRowSharedCtx,
    renderStagesFieldAndBillingLines,
    renderJobCustomerLine,
    renderStagesJobCellActivityFooter,
    renderStagesQuickActionsStack,
    renderJobNoteLine,
    unifiedStagesColCount,
    flashRowStyle,
    stagesSecondaryOutlineButtonBase,
    stagesCellButtonRowStyle,
    stagesCellButtonStyle,
    threadRowShared,
    wideViewport,
  } = t
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
        borderBottom: stagesRowHasProjectBanner(j.project_id, j.project) ? 'none' : '1px solid var(--border-job-row)',
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
      <td
        style={{
          padding: '0.75rem',
          ...(stagesEditMode ? { paddingLeft: `calc(0.75rem + ${STAGES_EDIT_MODE_RAIL_WIDTH}px)` } : {}),
          verticalAlign: 'top',
          position: 'relative',
        }}
      >
        {stagesEditMode ? renderStagesEditModeRail(j, openEdit) : null}
        {/* v2.1530: the quick-action stack moved here from the Activity cell. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
        {renderStagesQuickActionsStack(j)}
        <div style={{ flex: 1, minWidth: 0 }}>
        <StagesCrewLine job={j} />
        {renderStagesJobHcpSubline(j, { marginTop: '0.15rem' }, t.stagesSortMode === 'added' ? stagesAddedStampLabel(j.created_at) : null)}
        {renderStagesFieldAndBillingLines(j)}
        </div>
        </div>
      </td>
      <td style={{ padding: '0.75rem', ...accountManOnlyStripeStyle(j) }}>
        {/* Wide screens: identity keeps its natural width and the Job
            activity box (v2.1587) absorbs the cell's dead middle. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'wrap' }}>
          {renderStagesOpenDetailJobName(j)}
          {/* The activity box already carries the trail on wide screens —
          the chevron+count beside the name is redundant there (v2.1588);
          row click still expands the thread either way. */}
          {!wideViewport ? renderStagesThreadExpandButton(stagesRowSharedCtx, j.id) : null}
        </div>
        {renderJobAddressWithMap(j.job_address)}
        {renderJobCustomerLine(j)}
        {bundleInv != null && row.kind === 'job_with_merged_billed' ? (
          // The "Billed line: $X open" text was redundant with the
          // Progress column (v2.1155) — the Reports pill moved here
          // from the Activity cell instead.
          <div style={{ marginTop: '0.25rem' }}>
            {renderStagesViewReportsButton(stagesRowSharedCtx, j)}
          </div>
        ) : bundleInv != null ? (
          <div
            style={{ fontSize: '0.75rem', color: 'var(--text-blue-800)', marginTop: '0.25rem' }}
            title="Single billing line for this job (Stripe or external send)"
          >
            Billing line: {formatCurrency(Number(bundleInv.amount))}
          </div>
        ) : null}
        {renderStagesJobColumnEstimateFooter(j.linkedEstimateForStages)}
        {renderStagesJobCellActivityFooter(j, bundleInv ?? undefined, row.kind === 'job_with_merged_billed' ? { hideReportsButton: true } : undefined)}
        </div>
        {wideViewport ? (
          <JobsStagesActivityBox
            job={j}
            ctx={stagesRowSharedCtx}
            loadActivityForJob={loadJobThreadNotesForJob}
            submitNoteWithBody={submitJobThreadNoteWithBody}
          />
        ) : null}
        </div>
      </td>
      <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          {!bundleInv ? (
            <>
              <StagesProgressPaymentCell
                model={progressPaymentForJob(j, stagesRowSharedCtx.crewByJobId.get(j.id) ?? null).model}
      view={progressPaymentForJob(j, stagesRowSharedCtx.crewByJobId.get(j.id) ?? null).view}
                pctComplete={j.pct_complete ?? null}
                billSentAlert={stagesBillSentPctAlert(j)}
                pctSaving={pctCompleteSavingId === j.id}
                onPctCommit={(n) => updateJobPctComplete(j.id, n, j.pct_complete ?? null)}
                onNoBidValueClick={() => openEdit(j, { fixturesSectionHighlight: true })}
                onStageClick={() => openEdit(j, { fixturesSectionHighlight: true })}
                footnote={showRemaining ? (() => {
                  const u = jobBillingUnallocatedDollars(j)
                  return u > 0 ? (
                    <span title="Left on the job after draft and billed invoice lines">{`${formatUsdNoCents(u)} unallocated`}</span>
                  ) : null
                })() : null}
              />
              {((sendBackBelowRemaining && onJobSendBack) || onJobMoveToCollections) && (
                <div style={stagesCellButtonRowStyle}>
                  {sendBackBelowRemaining && onJobSendBack && (
                    <button
                      type="button"
                      onClick={() => onJobSendBack(j)}
                      disabled={stagesStatusUpdatingId === j.id}
                      style={{
                        ...stagesCellButtonStyle,
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
                      style={{ ...stagesCellButtonStyle, color: 'var(--text-red-600)', border: '1px solid #dc2626', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Collections
                    </button>
                  )}
                </div>
              )}
              {renderJobNoteLine(j)}
            </>
          ) : (
            <>
              <StagesProgressPaymentCell
                model={progressPaymentForJob(j, stagesRowSharedCtx.crewByJobId.get(j.id) ?? null).model}
      view={progressPaymentForJob(j, stagesRowSharedCtx.crewByJobId.get(j.id) ?? null).view}
                pctComplete={j.pct_complete ?? null}
                billSentAlert={stagesBillSentPctAlert(j)}
                pctSaving={pctCompleteSavingId === j.id}
                onPctCommit={(n) => updateJobPctComplete(j.id, n, j.pct_complete ?? null)}
                onNoBidValueClick={() => openEdit(j, { fixturesSectionHighlight: true })}
                onStageClick={() => openEdit(j, { fixturesSectionHighlight: true })}
                footnote={
                  row.kind === 'job_with_merged_billed'
                    ? (() => {
                        // v2.3459: "This bill: $X paid · $Y left" only when the job carries
                        // more than one sent bill — with a single bill the legend above
                        // already prints the same two numbers.
                        if ((j.invoices ?? []).filter((i) => i.status === 'billed').length < 2) return null
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
              {((sendBackBelowRemaining && bundleInvWithJob != null) || onJobMoveToCollections) && (
                <div style={stagesCellButtonRowStyle}>
                  {sendBackBelowRemaining && onInvoiceSendBack && bundleInvWithJob != null && (
                    <button
                      type="button"
                      onClick={() => onInvoiceSendBack(bundleInvWithJob)}
                      disabled={stagesInvoiceUpdatingId === bundleInv.id}
                      title="Remove this billing line (partial invoice row)"
                      style={{
                        ...stagesCellButtonStyle,
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
                      style={{ ...stagesCellButtonStyle, color: 'var(--text-red-600)', border: '1px solid #dc2626', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Collections
                    </button>
                  )}
                </div>
              )}
              {renderJobNoteLine(j)}
            </>
          )}
        </div>
      </td>
      <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          {onViewBill && bundleInvWithJob != null && row.kind === 'job_with_merged_billed' ? (
            <ViewBillWithPdfTail
              onViewBill={() => onViewBill(bundleInvWithJob)}
              invoice={{ id: bundleInvWithJob.id, job_id: bundleInvWithJob.job_id }}
            />
          ) : null}
          {onViewBill && !bundleInv && (j.invoices ?? []).filter((i) => i.status === 'billed').length === 1 ? (
            (() => {
              const b = (j.invoices ?? []).filter((i) => i.status === 'billed')
              return (
                <ViewBillWithPdfTail
                  onViewBill={() => onViewBill({ ...b[0], job: j } as InvoiceWithJob)}
                  invoice={{ id: b[0]!.id, job_id: b[0]!.job_id }}
                />
              )
            })()
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
          {t.billedExpectedPayChip?.(row)}
          {/* marginTop tops the outer stack's 0.25rem gap up to the status
              buttons' own 0.5rem rhythm — equal air above Edit Job (v2.1688). */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'stretch', marginTop: '0.25rem' }}>
            {/* One big Edit Job target (owner call, v2.1686) — replaces the
                partial-invoice / Edit / Job detail icon trio. Job detail
                stays a click away via the job name; partial invoicing
                lives on the Bill tab (and the mobile card menu). */}
            <button
              type="button"
              onClick={() => openEdit(j)}
              title="Open the Edit tab for this job"
              style={{ ...stagesSecondaryOutlineButtonBase, width: '100%', minWidth: '7.5rem', padding: '0.4rem 0.75rem', cursor: 'pointer', color: 'var(--text-700)' }}
            >
              Edit
            </button>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                {onOpenLienRelease ? <StagesLienReleaseButton onClick={() => onOpenLienRelease({ job: j, invoice: bundleInv ?? null })} hasRelease={lienReleaseJobIds?.has(j.id) === true} /> : null}
                <ShareJobButton
                  jobId={j.id}
                  fields={{ hcpNumber: j.hcp_number, jobName: j.job_name, jobAddress: j.job_address }}
                />
                {showClickTooling && (
                  <StagesTestReportButton onClick={() => openTestReportFor(j)} />
                )}
                {onOpenLienTooling &&
                  (() => {
                    let invForLien: JobsLedgerInvoice | null = bundleInv ?? null
                    if (!invForLien) {
                      const billedOnly = (j.invoices ?? []).filter((i) => i.status === 'billed')
                      invForLien = billedOnly.length === 1 ? billedOnly[0]! : null
                    }
                    return (
                      <StagesLienInstrumentsButton onClick={() => onOpenLienTooling({ job: j, invoice: invForLien })} demandOut={demandOutJobIds?.has(j.id) === true} />
                    )
                  })()}
                {showAiaG702G703(authRole, j) ? <StagesAiaG702Button onClick={() => setAiaG702StagesJob(j)} /> : null}
                {canCreateHazmatFee ? <StagesHazmatFeeButton onClick={() => openHazmatFee(j)} hasFee={hazmatFeeJobIds?.has(j.id) === true} /> : null}
            </div>
          </div>
        </div>
      </td>
    </tr>
    {expandedJobThreadId === j.id && <StagesExpandedThreadRow {...threadRowShared} job={j} colSpan={unifiedStagesColCount} />}
    {renderStagesProjectBannerRow(j.project_id, j.project, unifiedStagesColCount)}
    </Fragment>
  )
}
