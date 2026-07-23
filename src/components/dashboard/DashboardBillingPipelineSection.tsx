import { useEffect, useState, type CSSProperties, type MutableRefObject } from 'react'
import { supabase } from '../../lib/supabase'
import { DELETE_DRAFT_BILL_LABEL } from '../../lib/deleteDraftBillLabel'
import { formatMoveIntoStageByOnLine } from '../../lib/formatMoveIntoStageByOnLine'
import {
  invoiceNeedsStripeVoidForRevert,
  prepareBilledInvoicesBeforeJobRevertToReadyToBill,
  stripeModeForBillingFromRole,
} from '../../lib/voidStripeInvoiceForRevert'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { formatTimeSince } from '../../lib/dashboardJobRowActivity'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import {
  countDashboardRtbDraftsForJob,
  dashboardBilledInvoiceAmounts,
  dashboardInvoiceToPaymentModal,
  dashboardJobHasCustomerForBilling,
  type BilledWaitingDashboardUnit,
  type InvoiceForDashboard,
  type JobForDashboard,
  type ReadyToBillDashboardUnit,
} from '../../lib/dashboardBillingInvoiceUnits'
import { useSendBackCollectPaymentFlowNotice } from '../../hooks/useSendBackCollectPaymentFlowNotice'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import DashboardFieldCollectPaymentQueue from './DashboardFieldCollectPaymentQueue'
import { BillingPipelineCard, BillingPipelineStage } from './BillingPipelineCard'
import { DashboardListRowSkeleton } from './DashboardSkeletons'
import BilledPaymentConfirmationModal from '../jobs/BilledPaymentConfirmationModal'
import type { UserRole } from '../../hooks/useAuth'

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

export type DashboardBillingPipelineSectionProps = {
  authUserId: string | undefined
  role: UserRole | null
  /** Billing engine outputs (useDashboardBillingInvoices), destructured in the parent and passed down. */
  readyToBillInvoices: InvoiceForDashboard[]
  readyToBillLoading: boolean
  readyToBillDashboardUnits: ReadyToBillDashboardUnit[]
  waitingForPaymentLoading: boolean
  billedWaitingDashboardUnits: BilledWaitingDashboardUnit[]
  invoiceStatusUpdatingId: string | null
  jobStatusUpdatingId: string | null
  dashboardInvoiceSendBackConfirmLockRef: MutableRefObject<boolean>
  updateJobStatus: (jobId: string, toStatus: 'working' | 'ready_to_bill' | 'billed' | 'paid') => Promise<boolean>
  refreshInvoices: () => Promise<void>
  revertBilledDashboardInvoiceToReadyToBill: (inv: InvoiceForDashboard) => Promise<boolean>
  deleteInvoice: (invoiceId: string) => Promise<void>
  shouldShowPrepareBillForFieldQueue: (jobId: string) => boolean
  /** Parent glue (context openers + field-queue prepare flow; sendRecordJobMeta state stays parent-side — it is also opened by handlePrepareBillFromFieldQueue). */
  handlePrepareBillFromFieldQueue: (jobId: string) => void
  openReadyToBillEditJob: (jobId: string) => void
  openReadyToBillDetailJobModal: (args: { jobId: string; hcpNumber: string; jobName: string; jobAddress: string }) => void
  openDashboardBillCustomerInvoice: (inv: InvoiceForDashboard) => void
  setSendRecordJobMeta: (meta: { id: string }) => void
  /** Shared modal opener — JobReportsModal stays page-level (also opened by the job-row sections). */
  setViewReportsJob: (job: { id: string; hcpNumber: string; jobName: string; jobAddress: string }) => void
}

/**
 * Dashboard Billing Pipeline section (extraction #13; duplicated-render quirk
 * #1 collapsed): the whole BillingPipelineCard — Stage 1 field collect-payment
 * queue, Stage 2 "Ready to Bill" (invoice units), Stage 3 "Billed Waiting for
 * Payment" — plus the modals only this card opens (mark-paid job/invoice,
 * send-back invoice confirm, send-back job confirm). MONEY-PATH code moved
 * verbatim from the assistant-branch copy of Dashboard.tsx; the parent mounts
 * this component at BOTH role positions (assistant branch and dev/master
 * branch — mutually exclusive gates, so exactly one copy mounts).
 */
export function DashboardBillingPipelineSection({
  authUserId,
  role,
  readyToBillInvoices,
  readyToBillLoading,
  readyToBillDashboardUnits,
  waitingForPaymentLoading,
  billedWaitingDashboardUnits,
  invoiceStatusUpdatingId,
  jobStatusUpdatingId,
  dashboardInvoiceSendBackConfirmLockRef,
  updateJobStatus,
  refreshInvoices,
  revertBilledDashboardInvoiceToReadyToBill,
  deleteInvoice,
  shouldShowPrepareBillForFieldQueue,
  handlePrepareBillFromFieldQueue,
  openReadyToBillEditJob,
  openReadyToBillDetailJobModal,
  openDashboardBillCustomerInvoice,
  setSendRecordJobMeta,
  setViewReportsJob,
}: DashboardBillingPipelineSectionProps) {
  const { showToast } = useToastContext()
  const jobFormModal = useJobFormModal()
  const [readyToBillExpanded, setReadyToBillExpanded] = useState(true)
  const [waitingForPaymentExpanded, setWaitingForPaymentExpanded] = useState(false)
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
  return (
    <>
          <BillingPipelineCard>
          {authUserId && (
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
                              {effectiveJobLedgerNumber(inv.hcp_number, inv.click_number) || '—'} · {inv.job_name || '—'}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              {inv.job_address?.trim() ? (
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inv.job_address.trim())}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{inv.job_address}</a>
                              ) : (
                                '—'
                              )}
                            </div>
                            {/* No Applied/Open sub-line here: payments cannot exist on ready_to_bill
                                invoices (every payment-insert RPC requires status 'billed', and no
                                path reverts an invoice with payments back to ready_to_bill), so the
                                RTB loaders correctly map with an empty payments map. */}
                            <div style={{ fontSize: '0.875rem', marginTop: 4 }}>
                              {`Invoice: $${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
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
                              hcpNumber={effectiveJobLedgerNumber(inv.hcp_number, inv.click_number) || '—'}
                              jobName={inv.job_name ?? '—'}
                              jobAddress={inv.job_address ?? '—'}
                              jobFormModalAvailable={Boolean(jobFormModal)}
                              onEditJob={openReadyToBillEditJob}
                              onOpenDetail={openReadyToBillDetailJobModal}
                            />
                            <button type="button" onClick={() => setViewReportsJob({ id: inv.job_id, hcpNumber: effectiveJobLedgerNumber(inv.hcp_number, inv.click_number) || '—', jobName: inv.job_name ?? '—', jobAddress: inv.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
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
                            {effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'} · {j.job_name || '—'}
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
                            hcpNumber={effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'}
                            jobName={j.job_name ?? '—'}
                            jobAddress={j.job_address ?? '—'}
                            jobFormModalAvailable={Boolean(jobFormModal)}
                            onEditJob={openReadyToBillEditJob}
                            onOpenDetail={openReadyToBillDetailJobModal}
                          />
                          <button type="button" onClick={() => setViewReportsJob({ id: j.id, hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                          <button type="button" onClick={() => { setSendBackChecked(false); setSendBackJob({ id: j.id, hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', jobName: j.job_name ?? '—', toStatus: 'working', rtbDraftCount: countDashboardRtbDraftsForJob(j.id, readyToBillInvoices) }) }} disabled={jobStatusUpdatingId === j.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer' }} aria-label="Send back">Send<br />Back</button>
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
                          <div style={{ fontWeight: 600 }}>{effectiveJobLedgerNumber(inv.hcp_number, inv.click_number) || '—'} · {inv.job_name || '—'}</div>
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
                          <button type="button" onClick={() => setViewReportsJob({ id: inv.job_id, hcpNumber: effectiveJobLedgerNumber(inv.hcp_number, inv.click_number) || '—', jobName: inv.job_name ?? '—', jobAddress: inv.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
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
                            <div style={{ fontWeight: 600 }}>{effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'} · {j.job_name || '—'}</div>
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
                            <button type="button" onClick={() => setViewReportsJob({ id: j.id, hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', jobName: j.job_name ?? '—', jobAddress: j.job_address ?? '—' })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}>View<br />Reports</button>
                            <button type="button" onClick={() => { setSendBackChecked(false); setSendBackJob({ id: j.id, hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', jobName: j.job_name ?? '—', toStatus: 'ready_to_bill', rtbDraftCount: 0 }) }} disabled={jobStatusUpdatingId === j.id} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: jobStatusUpdatingId === j.id ? 'not-allowed' : 'pointer' }}>Send<br />back</button>
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
              {`Job ${effectiveJobLedgerNumber(sendBackInvoice.inv.hcp_number, sendBackInvoice.inv.click_number) || '—'} · ${sendBackInvoice.inv.job_name || '—'} · $${sendBackInvoice.inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
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
    </>
  )
}
