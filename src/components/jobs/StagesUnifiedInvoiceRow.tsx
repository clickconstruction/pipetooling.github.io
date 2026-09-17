/**
 * A standalone invoice row of the unified Pipeline table (Stages tab decomposition PR 10,
 * v2.3548): the green `Invoice:` badge, the est-bill-date controls, View Bill, the lien
 * doors. Moved verbatim out of `JobsStagesUnifiedTable.tsx`, which builds the `t` context
 * once per render from its post-default props and its helpers.
 */
import StagesProgressPaymentCell from './StagesProgressPaymentCell'
import ViewBillWithPdfTail from './ViewBillWithPdfTail'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { StagesUnifiedRowContext } from './JobsStagesUnifiedTable'
import { Fragment } from 'react'
import { STAGES_EDIT_MODE_RAIL_WIDTH, accountManOnlyStripeStyle, renderJobAddressWithMap, renderStagesEditModeRail, renderStagesJobColumnEstimateFooter, renderStagesProjectBannerRow, renderStagesThreadExpandButton, shouldSuppressStagesRowJobThreadToggle, stagesInvoiceRowAccentRailStyle, stagesInvoiceRowAccentRowStyle, stagesRowHasProjectBanner } from './jobsStagesRowShared'
import { ShareJobButton } from './ShareJobButton'
import { StagesAiaG702Button, StagesLienInstrumentsButton, StagesLienReleaseButton, StagesTestReportButton } from './StagesRowActionButtons'
import { StagesCrewLine } from './StagesCrewLine'
import { StagesExpandedThreadRow } from './StagesExpandedThreadRow'
import { effectiveInvoiceEstBillDate } from '../../lib/jobs/invoiceBilling'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatEstimatedCompletionDisplay, formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { jobBillingUnallocatedDollars, type InvoiceWithJob } from '../../lib/jobsStagesBoard'
import { progressPaymentForJob } from '../../lib/jobs/progressPaymentForJob'
import { showAiaG702G703 } from '../../lib/aiaG702G703Eligibility'
import { stagesBillSentPctAlert } from '../../lib/jobs/stagesBillSentPctAlert'

export type StagesUnifiedInvoiceRowKind = Extract<StageRow, { kind: 'invoice' }>

export function StagesUnifiedInvoiceRow({ row, t }: { row: StagesUnifiedInvoiceRowKind; t: StagesUnifiedRowContext }) {
  const {
    actionLabel,
    onInvoiceAction,
    onViewBill,
    onInvoiceSendBack,
    showRemaining,
    sendBackBelowRemaining,
    invoiceStandaloneActionLabel,
    showClickTooling,
    onOpenLienTooling,
    onOpenLienRelease,
    lienReleaseJobIds,
    demandOutJobIds,
    onJobMoveToCollections,
    stagesJobFlashId,
    stagesHamMode,
    stagesEditMode,
    renderStagesOpenDetailJobName,
    pctCompleteSavingId,
    updateJobPctComplete,
    openEdit,
    setAiaG702StagesJob,
    expandedJobThreadId,
    toggleStagesJobThreadExpanded,
    authRole,
    stagesInvoiceUpdatingId,
    invoiceEstimatedBillDateSavingId,
    bumpInvoiceEstimatedBillDate,
    setWhenInvoiceBillModal,
    setWhenInvoiceBillModalDate,
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
    stagesInvoiceHcpBadgeStyle,
    threadRowShared,
  } = t
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
        borderBottom: stagesRowHasProjectBanner(job.project_id, job.project) ? 'none' : '1px solid var(--border-job-row)',
        ...stagesInvoiceRowAccentRowStyle,
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
      <td
        style={{
          padding: '0.75rem',
          ...(stagesEditMode ? { paddingLeft: `calc(0.75rem + ${STAGES_EDIT_MODE_RAIL_WIDTH}px)` } : {}),
          verticalAlign: 'top',
          position: 'relative',
          ...stagesInvoiceRowAccentRailStyle,
        }}
      >
        {stagesEditMode ? renderStagesEditModeRail(job, openEdit) : null}
        {/* v2.1530: the quick-action stack moved here from the Activity cell. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
        {renderStagesQuickActionsStack(job)}
        <div style={{ flex: 1, minWidth: 0 }}>
        <StagesCrewLine job={job} />
        {stagesInvoiceHcpTrimmed ? (
          <div style={{ marginTop: '0.15rem' }}>
            <span style={stagesInvoiceHcpBadgeStyle}>{stagesInvoiceRowHcpLabel}</span>
          </div>
        ) : (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem', whiteSpace: 'nowrap' }}>
            {stagesInvoiceRowHcpLabel}
          </div>
        )}
        {renderStagesFieldAndBillingLines(job)}
        {(() => {
          const eff = effectiveInvoiceEstBillDate(inv)
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
                      void bumpInvoiceEstimatedBillDate(inv.id, job.id, inv, -1)
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
                      void bumpInvoiceEstimatedBillDate(inv.id, job.id, inv, 1)
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
                        inv.estimated_bill_date?.trim().slice(0, 10) ?? ''
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
        </div>
        </div>
      </td>
      <td style={{ padding: '0.75rem', ...accountManOnlyStripeStyle(job) }}>
        {/* Same detail-opening name link as job-backed rows — Job detail
            stays a click away here after the icon pair retired (v2.1686
            parity for invoice rows). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'wrap' }}>
          {renderStagesOpenDetailJobName(job)}
          {renderStagesThreadExpandButton(stagesRowSharedCtx, job.id)}
        </div>
        {renderJobAddressWithMap(job.job_address)}
        {renderJobCustomerLine(job)}
        {renderStagesJobColumnEstimateFooter(job.linkedEstimateForStages)}
        {renderStagesJobCellActivityFooter(job, inv)}
      </td>
      <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          <StagesProgressPaymentCell
            model={progressPaymentForJob(job, stagesRowSharedCtx.crewByJobId.get(job.id) ?? null).model}
            view={progressPaymentForJob(job, stagesRowSharedCtx.crewByJobId.get(job.id) ?? null).view}
            pctComplete={job.pct_complete ?? null}
            billSentAlert={stagesBillSentPctAlert(job)}
            pctSaving={pctCompleteSavingId === job.id}
            onPctCommit={(n) => updateJobPctComplete(job.id, n, job.pct_complete ?? null)}
            onNoBidValueClick={() => openEdit(job, { fixturesSectionHighlight: true })}
            onStageClick={() => openEdit(job, { fixturesSectionHighlight: true })}
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
          {(sendBackBelowRemaining || onJobMoveToCollections) && (
            <div style={stagesCellButtonRowStyle}>
              {sendBackBelowRemaining && (
                <button
                  type="button"
                  onClick={() => onInvoiceSendBack(invWithJob)}
                  disabled={stagesInvoiceUpdatingId === inv.id}
                  style={{
                    ...stagesCellButtonStyle,
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
                  style={{ ...stagesCellButtonStyle, color: 'var(--text-red-600)', border: '1px solid #dc2626', fontWeight: 600, cursor: 'pointer' }}
                >
                  Collections
                </button>
              )}
            </div>
          )}
          {renderJobNoteLine(job)}
        </div>
      </td>
      <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          {onViewBill ? (
            <ViewBillWithPdfTail
              onViewBill={() => onViewBill(invWithJob)}
              invoice={{ id: invWithJob.id, job_id: invWithJob.job_id }}
            />
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
          {t.billedExpectedPayChip?.(row)}
          {/* marginTop tops the outer stack's 0.25rem gap up to the status
              buttons' own 0.5rem rhythm — equal air above Edit Job (v2.1688). */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'stretch', marginTop: '0.25rem' }}>
            {/* One big Edit Job target (owner call, v2.1686/this PR) —
                replaces the Edit / Job detail icon pair on invoice rows.
                Job detail stays a click away via the job name. */}
            <button
              type="button"
              onClick={() => openEdit(job)}
              title="Open the Edit tab for this job"
              style={{ ...stagesSecondaryOutlineButtonBase, width: '100%', minWidth: '7.5rem', padding: '0.4rem 0.75rem', cursor: 'pointer', color: 'var(--text-700)' }}
            >
              Edit
            </button>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'flex-end' }}>
            {onOpenLienRelease ? <StagesLienReleaseButton onClick={() => onOpenLienRelease({ job, invoice: inv })} hasRelease={lienReleaseJobIds?.has(job.id) === true} /> : null}
            <ShareJobButton
              jobId={job.id}
              fields={{ hcpNumber: job.hcp_number, jobName: job.job_name, jobAddress: job.job_address }}
            />
            {showClickTooling && (
              <StagesTestReportButton onClick={() => openTestReportFor(job)} />
            )}
            {onOpenLienTooling ? (
              <StagesLienInstrumentsButton onClick={() => onOpenLienTooling({ job, invoice: inv })} demandOut={demandOutJobIds?.has(job.id) === true} />
            ) : null}
            {showAiaG702G703(authRole, job, inv) ? <StagesAiaG702Button onClick={() => setAiaG702StagesJob(job)} /> : null}
            </div>
          </div>
        </div>
      </td>
    </tr>
    {expandedJobThreadId === job.id && <StagesExpandedThreadRow {...threadRowShared} job={job} colSpan={unifiedStagesColCount} />}
    {renderStagesProjectBannerRow(job.project_id, job.project, unifiedStagesColCount)}
    </Fragment>
  )
}
