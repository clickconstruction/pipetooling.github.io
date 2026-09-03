import { type CSSProperties, type ReactNode } from 'react'
import { Link, type NavigateFunction } from 'react-router-dom'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import type { JobCalendarJobIdentity } from '../../lib/jobCalendarModal'
import { type StagesUpcomingAppointment } from '../../lib/stagesUpcomingSchedule'
import { getBidServiceTypeTag } from '../../utils/unifiedJobBidSearch'
import AccountManIcon from '../icons/AccountManIcon'
import { ACCOUNT_MAN_RELATIONSHIP_LABELS, ACCOUNT_MAN_RELATIONSHIP_SHORT, buildAccountManDisplay, type AccountManDisplay } from '../../lib/jobs/accountMan'
import {
  deriveStagesBillingActivityDetail,
  deriveStagesFieldReferenceYmd,
  deriveStagesFieldTooltip,
} from '../../lib/stagesJobReferenceDates'
import { formatEstimatedCompletionDisplay, formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { formatDecimalWorkHoursToHhMm } from '../../lib/formatDecimalWorkHoursHhMm'
import { formatAddressTwoLines, googleMapsSearchUrl } from '../../lib/jobs/jobAddressUrls'
import { JobAddressText } from './JobAddressText'
import { StagesSearchMark } from './StagesSearchMark'
import { invoiceOpenRemainingOnJob, jobStagesInvoiceJumpChipTargets } from '../../lib/jobs/invoiceBilling'
import {
  formatDispatchNoteDaysAgoShort,
  formatDispatchNoteWeekdayShortTimeChicago,
  getDispatchNoteDisplayMeta,
} from '../../utils/dispatchNoteDisplay'
import { StripeInvoiceSendFromStripeButton } from './StripeInvoiceSendFromStripeButton'
import { stripeModeForBillingFromRole } from '../../lib/voidStripeInvoiceForRevert'
import { showTaskDispatchButton } from '../../lib/headerTaskDispatchEstimatorEligible'
import { getDefaultWeekRange } from '../../utils/dateUtils'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobThreadNotes } from '../../hooks/useJobThreadNotes'
import { useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import { useDispatchTaskModal } from '../../contexts/DispatchTaskModalContext'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import CustomerContactCardIcon from '../icons/CustomerContactCardIcon'
import GcHardHatIcon from '../icons/GcHardHatIcon'
import CustomerPortalGlobeButton from '../customers/CustomerPortalGlobeButton'
import DevelopmentHouseIcon from '../icons/DevelopmentHouseIcon'
import { JobContractChip } from './JobContractChip'
import type { JobContractCoverage } from '../../lib/jobs/jobContractCoverage'

type CustomerRow = Database['public']['Tables']['customers']['Row']
type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * Shared Stages row-render helpers (Jobs.tsx decomposition step 9a — see
 * docs/JOBS_TABS_ARCHITECTURE.md "Section renderers"). These are the closures
 * both `JobsStagesTable` and `JobsStagesUnifiedTable` consumed as siblings
 * inside the Stages IIFE, moved verbatim; every captured page value now
 * arrives through the explicit `StagesRowRenderContext` argument (or is a
 * plain import). Behavior-preserving: bodies are byte-identical to the IIFE
 * closures modulo the ctx parameter/destructure headers.
 */
export type StagesRowRenderContext = {
  showToast: ReturnType<typeof useToastContext>['showToast']
  customers: CustomerRow[]
  openEditJobAndCreateCustomerFlow: (job: JobWithDetails) => void
  /** Opens the customer profile modal (v2.1322); optional — surfaces without the provider omit it. */
  openCustomerProfile?: (customerId: string) => void
  /** Opens the job work-story modal from the man-hours chip (v2.1766); optional like openCustomerProfile. */
  openJobHoursStory?: (target: { jobId: string; hcpNumber: string | null; clickNumber?: string | null; jobName: string | null }) => void
  stagesManHoursByJobId: Map<string, number>
  stagesManHoursLoading: boolean
  stagesLaborBreakdownByJobId: Map<string, Array<{ personName: string; hours: number }>>
  expandedJobThreadId: string | null
  toggleStagesJobThreadExpanded: (id: string) => void
  jobThreadStatsByJobId: ReturnType<typeof useJobThreadNotes>['jobThreadStatsByJobId']
  jobThreadActivityByJobId: ReturnType<typeof useJobThreadNotes>['jobThreadActivityByJobId']
  openJobThreadFullscreen: (jobId: string) => void
  /** Opens the full-page Job activity modal (the activity box's expand view). */
  openJobActivityExpand: (job: JobWithDetails) => void
  /**
   * Opens the Pipeline "Session notes" view pinned to this job (the per-job
   * door beside "N Reports"). Null/absent when the viewer's role can't open it —
   * the tables read it from `SessionNotesOpenerContext`.
   */
  openSessionNotesForJob?: ((job: JobWithDetails) => void) | null
  openJobCalendar: (job: JobWithDetails) => void
  stagesUpcomingByJobId: Record<string, StagesUpcomingAppointment>
  applyStagesInvoiceFocus: (invoiceId: string) => boolean
  canOpenJobScheduleModal: boolean
  setScheduleModalJob: (j: JobWithDetails | null) => void
  /** Opens the dispatch "Assign work" sheet pre-picked to this job (the schedule quick action). */
  openQuickAssignForJob: (j: JobWithDetails) => void
  navigate: NavigateFunction
  authRole: ReturnType<typeof useAuth>['role']
  dispatchTaskModal: ReturnType<typeof useDispatchTaskModal>
  checklistAddModal: ReturnType<typeof useChecklistAddModal>
  loadJobs: () => Promise<unknown>
  /** When set, the row's development label becomes a button that filters the board to that development. */
  onDevelopmentFilter?: (developmentId: string) => void
  /** Contract Desk: per-job contract coverage — the chip under the job (office roles only; undefined hides it). */
  jobContractCoverageByJobId?: ReadonlyMap<string, JobContractCoverage>
  /** Opens the job's Contract modal (PR 2); absent = the chip is a plain label. */
  onOpenJobContract?: (job: JobWithDetails) => void
}


/**
 * Minimum width for both Stages tables (JobsStagesTable + JobsStagesUnifiedTable).
 * They use table-layout: fixed with a colgroup whose sized columns total 476px;
 * the single flexible column (Job — the Activity column was removed in
 * v2.1555) takes all of the remaining `minWidth − 476` and keeps growing as
 * the page widens. 760 keeps the Job column ≥ ~284px at the floor (the table
 * scrolls sideways inside its own wrapper on phones instead).
 */
export const STAGES_TABLE_MIN_WIDTH = 760

/**
 * Edit mode rail (v2.1236): with the ⋯ tools menu's "Edit mode" on, every
 * job-backed row in both Stages tables wears this thin vertical E-D-I-T tab on
 * its left edge — one tap straight into the Edit Job modal, saving dispatch
 * and controllers the Job Detail hop. Rendered inside the row's FIRST cell
 * (which must be position: relative and add STAGES_EDIT_MODE_RAIL_WIDTH of
 * left padding) rather than as an extra table column, so no colgroup/colSpan
 * bookkeeping; the cell box spans the full row height, so the rail does too.
 * The Billing tab (v2.1635) reuses it as its whole actions cell with
 * side: 'right' — rail on the row's right edge, divider on its left.
 */
export const STAGES_EDIT_MODE_RAIL_WIDTH = 18

export function renderStagesEditModeRail(job: JobWithDetails, openEdit: (job: JobWithDetails) => void, side: 'left' | 'right' = 'left') {
  const jobNo = job.hcp_number?.trim() || job.click_number?.trim() || ''
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openEdit(job)
      }}
      title={`Edit job${jobNo ? ` #${jobNo}` : ''}`}
      aria-label={`Edit job ${jobNo || job.job_name || ''}`.trim()}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: STAGES_EDIT_MODE_RAIL_WIDTH,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        padding: 0,
        border: 'none',
        ...(side === 'left' ? { left: 0, borderRight: '1px solid var(--border)' } : { right: 0, borderLeft: '1px solid var(--border)' }),
        background: 'var(--bg-blue-tint)',
        color: 'var(--text-link)',
        fontSize: '0.5625rem',
        fontWeight: 700,
        lineHeight: 1.15,
        cursor: 'pointer',
      }}
    >
      <span aria-hidden>E</span>
      <span aria-hidden>D</span>
      <span aria-hidden>I</span>
      <span aria-hidden>T</span>
    </button>
  )
}

/**
 * Wrapper for full-width expanded-row panels (Job activity / notes): pins the
 * panel to the visible strip of the horizontally scrollable table so it stays
 * on-screen when the table is scrolled sideways on a phone.
 */
export function renderStagesExpandedRowPanel(children: ReactNode) {
  return <div style={{ position: 'sticky', left: 0, maxWidth: 'calc(100vw - 2rem)' }}>{children}</div>
}

/** Stages table headers: one visual line per phrase when the table is narrow (no mid-phrase wrap). */
const stagesThreeLineHeaderLineStyle: CSSProperties = { display: 'block', whiteSpace: 'nowrap' }

export function renderStagesTwoLineHeader(line1: string, line2: string) {
  return (
    <>
      <span style={stagesThreeLineHeaderLineStyle}>{line1}</span>
      <span style={stagesThreeLineHeaderLineStyle}>{line2}</span>
    </>
  )
}

/** Shared metrics so Job HCP badge and service-type pill match box height. */
const stagesJobSublinePillBoxBase: CSSProperties = {
  display: 'inline-block',
  boxSizing: 'border-box',
  padding: '0.15rem 0.4rem',
  fontSize: '0.6875rem',
  fontWeight: 600,
  lineHeight: 1.2,
  borderRadius: 4,
  fontFamily: 'inherit',
  // "964 PLUM" must never break between the number and the tag (v2.1602 —
  // same fix family as the j:/b: lines in v2.1586 and the invoice badge in
  // v2.1590); the auto-layout column widens instead.
  whiteSpace: 'nowrap',
}
const stagesJobHcpBadgeStyle: CSSProperties = {
  ...stagesJobSublinePillBoxBase,
  border: '1px solid rgba(255,255,255,0.5)',
  background: '#2563eb',
  color: 'white',
}

/**
 * Just the "961 PLUM" chip (or blue "Job: 961" badge when the job has no
 * service type) — null when the job has no number. Lets the mobile card title
 * row put the chip beside the job name; the tables keep the subline wrapper.
 */
export function renderStagesJobHcpChip(job: JobWithDetails, extraStyle?: CSSProperties): ReactNode {
  const t = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
  if (!t) return null
  const stName = job.serviceType?.name?.trim()
  if (stName) {
    const tagInfo = getBidServiceTypeTag(stName)
    const serviceLabel = (tagInfo?.tag ?? stName.slice(0, 4)).toUpperCase()
    // One merged chip — "961 PLUM" in the trade color (was a blue "Job: 961"
    // badge plus a separate service pill).
    const mergedChipStyle: CSSProperties = {
      ...stagesJobSublinePillBoxBase,
      letterSpacing: '0.02em',
      border: tagInfo ? '1px solid rgba(255,255,255,0.5)' : '1px solid var(--border-strong)',
      background: tagInfo ? tagInfo.color : 'var(--bg-muted)',
      color: tagInfo ? '#fff' : 'var(--text-700)',
      ...extraStyle,
    }
    return (
      <span style={mergedChipStyle} title={stName}>
        <StagesSearchMark text={t} onColor={!!tagInfo} /> {serviceLabel}
      </span>
    )
  }
  return (
    <span style={{ ...stagesJobHcpBadgeStyle, ...extraStyle }}>
      Job: <StagesSearchMark text={t} />
    </span>
  )
}

export function renderStagesJobHcpSubline(job: JobWithDetails, extraWrap?: CSSProperties, addedStamp?: string | null) {
  const chip = renderStagesJobHcpChip(job)
  // "added Aug 18" pill while the board sorts by time added (v2.1807) — the
  // visible number makes number-sort scannable; this does the same for dates.
  const stamp = addedStamp ? (
    <span
      style={{
        marginLeft: 6,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 7px',
        height: 16,
        borderRadius: 9999,
        fontSize: '0.64rem',
        fontWeight: 700,
        background: 'var(--bg-green-tint)',
        color: 'var(--text-green-600)',
        whiteSpace: 'nowrap',
      }}
    >
      {addedStamp}
    </span>
  ) : null
  if (chip) return <div style={extraWrap}>{chip}{stamp}</div>
  return (
    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', ...extraWrap }}>—{stamp}</div>
  )
}

/**
 * Job identity block atop the FULLSCREEN Job activity / notes panel and the
 * Job Calendar modal: number badge + service-tag pill + job name, then a
 * maps-linked one-line address. Takes the narrow identity shape so leaner
 * surfaces (Job Mode) can use it too; JobWithDetails satisfies it structurally.
 */
export function renderStagesThreadFullscreenJobHeader(job: JobCalendarJobIdentity) {
  const jobNumber = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
  const stName = job.serviceType?.name?.trim()
  const tagInfo = stName ? getBidServiceTypeTag(stName) : null
  const servicePillStyle: CSSProperties | null = stName
    ? {
        ...stagesJobSublinePillBoxBase,
        letterSpacing: '0.02em',
        border: `1px solid ${tagInfo?.color ?? '#d1d5db'}`,
        background: tagInfo ? tagInfo.color : 'var(--bg-muted)',
        color: tagInfo ? '#fff' : 'var(--text-700)',
      }
    : null
  // Abbreviated tag (PLUM), same as the board's Job-column pill — the full
  // name is too wide for the one-line header.
  const serviceLabel = stName ? (tagInfo?.tag ?? stName.slice(0, 4)).toUpperCase() : ''
  const addr = (job.job_address ?? '').trim()
  const addrLines = formatAddressTwoLines(addr)
  const addrOneLine = addrLines ? [addrLines.line1, addrLines.line2].filter(Boolean).join(' ') : ''
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        marginBottom: '0.5rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
        <span style={stagesJobHcpBadgeStyle}>Job: {jobNumber || '—'}</span>
        {servicePillStyle ? <span style={servicePillStyle}>{serviceLabel}</span> : null}
        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-strong)', lineHeight: 1.3 }}>
          {(job.job_name ?? '').trim() || '—'}
        </span>
      </div>
      {addrOneLine ? (
        <a
          href={googleMapsSearchUrl(addr)}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Google Maps"
          style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none', alignSelf: 'flex-start' }}
        >
          {addrOneLine}
        </a>
      ) : null}
    </div>
  )
}

export function renderStagesFieldAndBillingLines(ctx: StagesRowRenderContext, job: JobWithDetails) {
  const { showToast, stagesManHoursByJobId, stagesManHoursLoading, stagesLaborBreakdownByJobId, openJobCalendar } = ctx
  const jYmd = deriveStagesFieldReferenceYmd({
    lastWorkDate: job.last_work_date,
    lastScheduleWorkDate: job.last_schedule_work_date ?? null,
  })
  const bDetail = deriveStagesBillingActivityDetail(job)
  const jDisplay = jYmd ? formatEstimatedCompletionDisplay(jYmd) : null
  const bDisplay = bDetail ? formatEstimatedCompletionDisplay(bDetail.ymd) : null
  const jTitle = deriveStagesFieldTooltip({
    lastWorkDate: job.last_work_date,
    lastScheduleWorkDate: job.last_schedule_work_date ?? null,
    resolvedYmd: jYmd,
  })
  const lineStyle = {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '0.15rem',
    // "j: T+106 (mon)" / "b: T+120 (mon)" / "22h 46m" must never wrap — a
    // dangling "(mon)" line reads as a fourth row of the stack (owner report).
    whiteSpace: 'nowrap',
  } as const
  const jbLineButtonStyle: CSSProperties = {
    ...lineStyle,
    display: 'block',
    width: '100%',
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'inherit',
    font: 'inherit',
  }
  return (
    <>
      <button
        type="button"
        style={jbLineButtonStyle}
        title={jTitle ?? undefined}
        aria-label="Field / job-activity date (click to open the job calendar)"
        onClick={(e) => {
          e.stopPropagation()
          openJobCalendar(job)
        }}
      >
        j: {jDisplay ?? '—'}
      </button>
      <button
        type="button"
        style={jbLineButtonStyle}
        title={bDetail?.tooltip}
        aria-label="Billing-activity date (click for explanation)"
        onClick={(e) => {
          e.stopPropagation()
          showToast('Billing-activity date', 'info', 2000, { clientX: e.clientX, clientY: e.clientY })
        }}
      >
        b: {bDisplay ?? '—'}
      </button>
      {(() => {
        const known = stagesManHoursByJobId.has(job.id)
        const total = stagesManHoursByJobId.get(job.id) ?? 0
        const display =
          stagesManHoursLoading && !known ? '…' : formatDecimalWorkHoursToHhMm(total)
        const breakdown = stagesLaborBreakdownByJobId.get(job.id) ?? []
        const tip = breakdown.length
          ? breakdown
              .map((p) => `${p.personName} ${formatDecimalWorkHoursToHhMm(p.hours)}`)
              .join(' · ')
          : 'Man-hours applied (crew assignments)'
        const openStory = ctx.openJobHoursStory
        return (
          <div
            role={openStory ? 'button' : undefined}
            tabIndex={openStory ? 0 : undefined}
            onClick={
              openStory
                ? (e) => {
                    e.stopPropagation()
                    openStory({ jobId: job.id, hcpNumber: job.hcp_number, clickNumber: job.click_number, jobName: job.job_name })
                  }
                : undefined
            }
            onKeyDown={
              openStory
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      openStory({ jobId: job.id, hcpNumber: job.hcp_number, clickNumber: job.click_number, jobName: job.job_name })
                    }
                  }
                : undefined
            }
            style={{ ...lineStyle, display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: openStory ? 'pointer' : undefined }}
            title={openStory ? `${tip} — click for the job's work story` : tip}
            aria-label={`Man-hours applied: ${display === '…' ? 'loading' : display}${openStory ? ' — open the work story' : ''}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width={11}
              height={11}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              style={{ flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {display}
          </div>
        )
      })()}
    </>
  )
}

/** Job-column address: red map-pin icon + two-line address, linking to Google Maps. */
export function renderJobAddressWithMap(address: string | null | undefined) {
  const fmt = formatAddressTwoLines(address ?? null)
  if (!fmt) return null
  return (
    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
      {/* inline-flex so the clickable area hugs the icon + text instead of
          stretching across the whole Job cell. */}
      <a
        href={googleMapsSearchUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in Google Maps"
        style={{
          color: 'inherit',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'flex-start',
          gap: '0.3rem',
          maxWidth: '100%',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 640 640"
          width={12}
          height={12}
          fill="currentColor"
          aria-hidden="true"
          style={{ flexShrink: 0, marginTop: 1, color: 'var(--text-red-600)' }}
        >
          <path d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z" />
        </svg>
        <JobAddressText line1={fmt.line1} line2={fmt.line2} />
      </a>
    </div>
  )
}

/** True when loaded customers include exactly one row matching name (prefer same master_user_id as the job). */
function customerListImpliesLinkedRow(customersList: CustomerRow[], jobMasterUserId: string, customerNameTrimmed: string): boolean {
  const nameKey = customerNameTrimmed.trim().toLowerCase()
  if (!nameKey) return false
  const byName = customersList.filter((c) => (c.name ?? '').trim().toLowerCase() === nameKey)
  const byMaster = byName.filter((c) => c.master_user_id === jobMasterUserId)
  if (byMaster.length === 1) return true
  if (byMaster.length === 0 && byName.length === 1) return true
  return false
}

/**
 * Account Man chip (v2.1466): quiet icon+name for primary, amber outline for
 * preferred, white-on-red for only. Shared by the Pipeline job column (tables
 * + mobile cards via renderJobCustomerLine) and DetailJobModal.
 */
export function renderAccountManChip(display: AccountManDisplay) {
  const title = `Account Man — ${ACCOUNT_MAN_RELATIONSHIP_LABELS[display.relationship]}`
  const base: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }
  if (display.variant === 'only') {
    return (
      <span title={title} style={{ ...base, background: '#dc2626', color: '#ffffff', fontWeight: 600, borderRadius: 5, padding: '0.1rem 0.45rem' }}>
        <AccountManIcon size={13} />
        <span>{display.name} · only</span>
      </span>
    )
  }
  if (display.variant === 'preferred') {
    return (
      <span title={title} style={{ ...base, border: '1px solid var(--text-amber-800)', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', borderRadius: 5, padding: '0.05rem 0.4rem' }}>
        <AccountManIcon size={13} />
        <span>{display.name} · {ACCOUNT_MAN_RELATIONSHIP_SHORT[display.relationship]}</span>
      </span>
    )
  }
  return (
    <span title={title} style={base}>
      <AccountManIcon size={13} />
      <span>{display.name}</span>
    </span>
  )
}

/**
 * Thin red stripes for 'only communicator' jobs (v2.1466) — spread onto the
 * job cell/card container so the whole column reads restricted at a glance.
 */
export function accountManOnlyStripeStyle(job: JobWithDetails): CSSProperties {
  return buildAccountManDisplay(job)?.variant === 'only'
    ? { borderTop: '3px solid #dc2626', borderBottom: '3px solid #dc2626' }
    : {}
}

/**
 * Green accent for STANDALONE invoice rows (v2.1828) — a break-off floating in
 * a section apart from its job used to render nearly identical to a job row
 * (Taunya: "invoices and jobs look too similar"). Tint + left rail say
 * "invoice" before any text is read, in the board's green=invoice / blue=job
 * color language. Job rows — including bundled job+invoice rows — stay plain.
 */
export const stagesInvoiceRowAccentRowStyle: CSSProperties = {
  backgroundColor: 'var(--bg-green-tint)',
}

export const stagesInvoiceRowAccentRailStyle: CSSProperties = {
  borderLeft: '4px solid #16a34a',
}

export function renderJobCustomerLine(ctx: StagesRowRenderContext, job: JobWithDetails) {
  const { customers, openEditJobAndCreateCustomerFlow } = ctx
  const hasCustomerInfo = ((job.customer_name ?? '').trim() || (job.customer_email ?? '').trim() || (job.customer_phone ?? '').trim())
  const gcName = (job.gcCustomer?.name ?? '').trim()
  const developmentName = (job.development?.name ?? '').trim()
  const accountMan = buildAccountManDisplay(job)
  if (!hasCustomerInfo && !gcName && !developmentName && !accountMan) return null
  const cn = (job.customer_name ?? '').trim()
  const impliedCustomerLink = !job.customer_id && customerListImpliesLinkedRow(customers, job.master_user_id, cn)
  const showNotInCustomersBadge = !job.customer_id && !impliedCustomerLink
  return (
    <div
      style={{
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        marginTop: '0.15rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '0.25rem',
      }}
    >
      {/* Icon + name open the customer profile modal (v2.1322); rows with a
          customer NAME but no linked row route to the existing create/link
          flow instead — same affordance, honest destination. */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (job.customer_id) ctx.openCustomerProfile?.(job.customer_id)
          else openEditJobAndCreateCustomerFlow(job)
        }}
        title={job.customer_id ? 'Open customer profile' : 'Link or create this customer'}
        aria-label={job.customer_id ? `Open customer profile for ${cn || 'customer'}` : `Link or create customer ${cn || ''}`.trim()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', textAlign: 'left' }}
      >
        <CustomerContactCardIcon size={13} style={{ flexShrink: 0 }} />
        <span style={{ textDecoration: job.customer_id ? 'underline dotted' : 'none', textUnderlineOffset: 2 }}>{cn ? <StagesSearchMark text={cn} /> : '—'}</span>
      </button>
      {/* 🌐 portal link (portal train PR 4) — office-only, renders null otherwise. */}
      {job.customer_id ? (
        <CustomerPortalGlobeButton customerId={job.customer_id} customerName={cn || 'Customer'} size={13} />
      ) : null}
      </span>
      {gcName || developmentName ? (
        // GC and development share one muted row — they're the same "who/where
        // does this roll up to" fact; wraps on narrow columns. The icons keep
        // the pair scannable on their own, so a wider gap (no separator glyph)
        // splits them.
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {gcName ? (
            <span title="GC/Builder for this job" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <GcHardHatIcon size={13} style={{ flexShrink: 0 }} />
              <span><StagesSearchMark text={gcName} /></span>
              {job.gcCustomer?.id ? (
                <CustomerPortalGlobeButton customerId={job.gcCustomer.id} customerName={gcName} size={13} />
              ) : null}
            </span>
          ) : null}
          {developmentName ? (
            ctx.onDevelopmentFilter && job.development?.id ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  ctx.onDevelopmentFilter?.(job.development?.id ?? '')
                }}
                title={`Show only ${developmentName} jobs`}
                aria-label={`Filter the board to the ${developmentName} development`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  textDecoration: 'underline dotted',
                  textUnderlineOffset: '2px',
                  textAlign: 'left',
                }}
              >
                <DevelopmentHouseIcon size={13} style={{ flexShrink: 0 }} />
                <span><StagesSearchMark text={developmentName} /></span>
              </button>
            ) : (
              <span title="Development for this job" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <DevelopmentHouseIcon size={13} style={{ flexShrink: 0 }} />
                <span><StagesSearchMark text={developmentName} /></span>
              </span>
            )
          ) : null}
        </span>
      ) : null}
      {accountMan ? renderAccountManChip(accountMan) : null}
      {showNotInCustomersBadge ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openEditJobAndCreateCustomerFlow(job)
          }}
          aria-label="Open Edit Job and create customer from job"
          style={{
            padding: '0.1rem 0.3rem',
            fontSize: '0.6875rem',
            fontWeight: 500,
            fontFamily: 'inherit',
            background: 'var(--bg-amber-100)',
            color: 'var(--text-amber-800)',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          Not in Customers
        </button>
      ) : null}
    </div>
  )
}

/**
 * Mobile-card identity line: the customer button and a ONE-line address share a
 * single muted row (" · " separated), with the conditional GC/development row,
 * Account-Man chip, and Not-in-Customers badge below — the same affordances as
 * renderJobCustomerLine + renderJobAddressWithMap, which the desktop tables
 * keep using, collapsed from up to four card rows into one or two.
 */
export function renderJobCustomerAndAddressLine(ctx: StagesRowRenderContext, job: JobWithDetails) {
  const { customers, openEditJobAndCreateCustomerFlow } = ctx
  const cn = (job.customer_name ?? '').trim()
  const hasCustomerInfo = !!(cn || (job.customer_email ?? '').trim() || (job.customer_phone ?? '').trim())
  const addr = (job.job_address ?? '').trim()
  const addrFmt = formatAddressTwoLines(addr)
  const addrOneLine = addrFmt ? [addrFmt.line1, addrFmt.line2].filter(Boolean).join(', ') : ''
  const gcName = (job.gcCustomer?.name ?? '').trim()
  const developmentName = (job.development?.name ?? '').trim()
  const accountMan = buildAccountManDisplay(job)
  if (!hasCustomerInfo && !addrOneLine && !gcName && !developmentName && !accountMan) return null
  const impliedCustomerLink = !job.customer_id && customerListImpliesLinkedRow(customers, job.master_user_id, cn)
  const showNotInCustomersBadge = hasCustomerInfo && !job.customer_id && !impliedCustomerLink
  return (
    <div
      style={{
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        marginTop: '0.1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '0.25rem',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35rem', rowGap: '0.15rem', minWidth: 0 }}>
        {hasCustomerInfo ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (job.customer_id) ctx.openCustomerProfile?.(job.customer_id)
              else openEditJobAndCreateCustomerFlow(job)
            }}
            title={job.customer_id ? 'Open customer profile' : 'Link or create this customer'}
            aria-label={job.customer_id ? `Open customer profile for ${cn || 'customer'}` : `Link or create customer ${cn || ''}`.trim()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', textAlign: 'left' }}
          >
            <CustomerContactCardIcon size={13} style={{ flexShrink: 0 }} />
            <span style={{ textDecoration: job.customer_id ? 'underline dotted' : 'none', textUnderlineOffset: 2 }}>{cn || '—'}</span>
          </button>
        ) : null}
        {hasCustomerInfo && addrOneLine ? <span aria-hidden>·</span> : null}
        {addrOneLine ? (
          <a
            href={googleMapsSearchUrl(addr)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Google Maps"
            onClick={(e) => e.stopPropagation()}
            style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'flex-start', gap: '0.3rem', minWidth: 0 }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 640 640"
              width={12}
              height={12}
              fill="currentColor"
              aria-hidden="true"
              style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-red-600)' }}
            >
              <path d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z" />
            </svg>
            <span>{addrOneLine}</span>
          </a>
        ) : null}
      </span>
      {gcName || developmentName ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {gcName ? (
            <span title="GC/Builder for this job" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <GcHardHatIcon size={13} style={{ flexShrink: 0 }} />
              <span><StagesSearchMark text={gcName} /></span>
            </span>
          ) : null}
          {developmentName ? (
            ctx.onDevelopmentFilter && job.development?.id ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  ctx.onDevelopmentFilter?.(job.development?.id ?? '')
                }}
                title={`Show only ${developmentName} jobs`}
                aria-label={`Filter the board to the ${developmentName} development`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  textDecoration: 'underline dotted',
                  textUnderlineOffset: '2px',
                  textAlign: 'left',
                }}
              >
                <DevelopmentHouseIcon size={13} style={{ flexShrink: 0 }} />
                <span><StagesSearchMark text={developmentName} /></span>
              </button>
            ) : (
              <span title="Development for this job" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <DevelopmentHouseIcon size={13} style={{ flexShrink: 0 }} />
                <span><StagesSearchMark text={developmentName} /></span>
              </span>
            )
          ) : null}
        </span>
      ) : null}
      {accountMan ? renderAccountManChip(accountMan) : null}
      {showNotInCustomersBadge ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openEditJobAndCreateCustomerFlow(job)
          }}
          aria-label="Open Edit Job and create customer from job"
          style={{
            padding: '0.1rem 0.3rem',
            fontSize: '0.6875rem',
            fontWeight: 500,
            fontFamily: 'inherit',
            background: 'var(--bg-amber-100)',
            color: 'var(--text-amber-800)',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          Not in Customers
        </button>
      ) : null}
    </div>
  )
}

export function shouldSuppressStagesRowJobThreadToggle(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null
  if (!el) return false
  return !!el.closest('button, a, input, textarea, select, label, [role="button"]')
}

/** Chevron + note count, inline at the END of the last-activity header line
 * (v2.1043 — used to be a stacked column in front of it). Lives inside the
 * clickable body, so the click stops propagation to avoid a double toggle. */
export function renderStagesThreadExpandButton(ctx: StagesRowRenderContext, jobId: string) {
  const { expandedJobThreadId, jobThreadStatsByJobId, toggleStagesJobThreadExpanded } = ctx
  const expanded = expandedJobThreadId === jobId
  const stat = jobThreadStatsByJobId[jobId]
  const count = stat?.note_count ?? 0
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        toggleStagesJobThreadExpanded(jobId)
      }}
      aria-expanded={expanded}
      title={count > 0 ? `${count} thread note(s)` : 'Job notes thread'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        marginLeft: '0.45rem',
        padding: '0 0.15rem',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        color: 'var(--text-700)',
        fontSize: '0.65rem',
        lineHeight: 1.1,
        verticalAlign: 'middle',
      }}
    >
      <span aria-hidden>{expanded ? '\u25BC' : '\u25B6'}</span>
      {count > 0 ? (
        <span style={{ color: 'var(--text-link)', fontWeight: 600 }}>{count}</span>
      ) : null}
    </button>
  )
}

/** The "N Report(s)" pill — normally the Activity cell's footer; billed merged
 * rows render it in the Job column instead (v2.1155), where the redundant
 * "Billed line: $X open" text used to sit. At zero reports it demotes to
 * quiet borderless "Reports" text (v2.1475): a bordered pill in an otherwise
 * empty Activity cell was the loudest element on the row while advertising
 * nothing, and the contrast is what lets rows with real field activity pop. */
export function renderStagesViewReportsButton(ctx: StagesRowRenderContext, job: JobWithDetails) {
  const cellReportCount = job.report_count ?? 0
  const hasReports = cellReportCount > 0
  const openSessionNotes = ctx.openSessionNotesForJob
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 2, flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => ctx.openJobActivityExpand(job)}
        title="Open the full-page job activity view"
        style={{
          padding: '0.2rem 0.5rem',
          fontSize: '0.75rem',
          background: 'none',
          color: hasReports ? 'var(--text-link)' : 'var(--text-faint)',
          border: hasReports ? '1px solid #2563eb' : '1px solid transparent',
          borderRadius: 4,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {hasReports ? `${cellReportCount} Report${cellReportCount !== 1 ? 's' : ''}` : 'Reports'}
      </button>
      {openSessionNotes ? (
        // The per-job door into Session notes: every clock session on this job,
        // one line each, pinned on open. Quiet like zero-report "Reports".
        <button
          type="button"
          onClick={() => openSessionNotes(job)}
          title="Every clock session on this job, one line each — Session notes"
          aria-label={`Session notes for ${(job.job_name ?? '').trim() || 'this job'}`}
          style={{
            padding: '0.2rem 0.5rem',
            fontSize: '0.75rem',
            background: 'none',
            color: 'var(--text-faint)',
            border: '1px solid transparent',
            borderRadius: 4,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Sessions
        </button>
      ) : null}
    </div>
  )
}

/**
 * The row's quick-action icon stack — schedule (green), week dispatch (blue),
 * call customer (teal, when a phone is on file), send to Dispatch (sky), and
 * send-as-task (purple). Lived at the left edge of the Activity cell until
 * v2.1530; now renders at the left edge of the Crew & Dates cell in both
 * Stages tables (owner request — the mobile card list has its own shortcut row).
 */
export function renderStagesQuickActionsStack(ctx: StagesRowRenderContext, job: JobWithDetails) {
  const {
    canOpenJobScheduleModal,
    openQuickAssignForJob,
    navigate,
    authRole,
    dispatchTaskModal,
    checklistAddModal,
  } = ctx
  const scheduleNoTeam = (job.team_members?.length ?? 0) === 0
  const quickIconButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.25rem',
    border: 'none',
    background: 'none',
    flexShrink: 0,
  }
  const customerPhone = (job.customer_phone ?? '').trim()
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 2,
        flexShrink: 0,
        alignSelf: 'flex-start',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {canOpenJobScheduleModal ? (
          <button
            type="button"
            onClick={() => openQuickAssignForJob(job)}
            title="Assign work — pick people and a time"
            aria-label="Assign work — pick people and a time"
            style={{
              ...quickIconButtonStyle,
              cursor: 'pointer',
              color: '#16a34a',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 640 640"
              width={16}
              height={16}
              fill="currentColor"
              aria-hidden
            >
              <path d="M224 64C206.3 64 192 78.3 192 96L192 128L160 128C124.7 128 96 156.7 96 192L96 240L544 240L544 192C544 156.7 515.3 128 480 128L448 128L448 96C448 78.3 433.7 64 416 64C398.3 64 384 78.3 384 96L384 128L256 128L256 96C256 78.3 241.7 64 224 64zM96 288L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 288L96 288z" />
            </svg>
          </button>
        ) : null}
        {/* Hidden (not grayed) when the job has no team — week dispatch is team-scoped (v2.1540). */}
        {canOpenJobScheduleModal && !scheduleNoTeam ? (
          <button
            type="button"
            onClick={() => {
              const week = getDefaultWeekRange().start
              navigate(`/schedule-dispatch?jobId=${encodeURIComponent(job.id)}&week=${encodeURIComponent(week)}`)
            }}
            title="Open week dispatch"
            aria-label="Open week dispatch"
            style={{
              ...quickIconButtonStyle,
              cursor: 'pointer',
              color: 'var(--text-link)',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 640 640"
              width={16}
              height={16}
              fill="currentColor"
              aria-hidden
            >
              <path d="M128 96L512 96C547.3 96 576 124.7 576 160L576 480C576 515.3 547.3 544 512 544L128 544C92.7 544 64 515.3 64 480L64 160C64 124.7 92.7 96 128 96zM128 192L128 480L232 480L232 192L128 192zM280 192L280 480L360 480L360 192L280 192zM408 192L408 480L512 480L512 192L408 192z" />
            </svg>
          </button>
        ) : null}
        {customerPhone ? (
          <a
            href={`tel:${customerPhone}`}
            title={`Call customer: ${customerPhone}`}
            aria-label={`Call customer at ${customerPhone}`}
            style={{ ...quickIconButtonStyle, color: '#0f766e', cursor: 'pointer' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 640 640"
              width={16}
              height={16}
              fill="currentColor"
              aria-hidden
            >
              <path d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C492.9 589.2 555.5 534 573.1 469.4L574.6 463.9C579.9 444.2 569.9 423.7 551 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 240.7 342.2 205.8 271.9L253 233.3C266.9 221.9 271.7 202.9 264.8 186.3L224.2 89z" />
            </svg>
          </a>
        ) : null}
        {showTaskDispatchButton(authRole) ? (
          <button
            type="button"
            onClick={() =>
              dispatchTaskModal?.openDispatchModal({
                reference: {
                  source: 'job',
                  id: job.id,
                  hcp_number: job.hcp_number ?? '',
                  click_number: job.click_number ?? null,
                  job_name: job.job_name ?? '',
                  job_address: job.job_address ?? '',
                  service_type_id: job.service_type_id ?? null,
                  service_type_name: job.serviceType?.name ?? null,
                },
              })
            }
            title="Send this job to Dispatch with a note"
            aria-label="Send job to Dispatch"
            style={{ ...quickIconButtonStyle, color: '#0ea5e9', cursor: 'pointer' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 640 640"
              width={16}
              height={16}
              fill="currentColor"
              aria-hidden
            >
              <path d="M280 128C266.7 128 256 138.7 256 152C256 165.3 266.7 176 280 176L296 176L296 209.3C188.8 220.7 104.2 307.7 96.6 416L543.5 416C535.8 307.7 451.2 220.7 344 209.3L344 176L360 176C373.3 176 384 165.3 384 152C384 138.7 373.3 128 360 128L280 128zM88 464C74.7 464 64 474.7 64 488C64 501.3 74.7 512 88 512L552 512C565.3 512 576 501.3 576 488C576 474.7 565.3 464 552 464L88 464z" />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            const numLabel = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
            const label = `${(numLabel ?? '').trim() || '—'} · ${(job.job_name ?? '').trim() || 'Job'}`
            checklistAddModal?.openAddModal({
              preset: {
                title: `{{1:${label}}} — `,
                links: [`${window.location.origin}/jobs?jobDetail=${encodeURIComponent(job.id)}`],
              },
            })
          }}
          title="Send this job to someone as a task"
          aria-label="Send job as a task"
          style={{ ...quickIconButtonStyle, color: '#7c3aed', cursor: 'pointer' }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 640 640"
            width={16}
            height={16}
            fill="currentColor"
            aria-hidden
          >
            <path d="M576 64L64 288L240 352L240 496L328 400L472 512L576 64z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/**
 * Job-cell activity footer (v2.1555): the survivors of the Activity column's
 * removal — invoice jump chips, the Stripe emailed/Resend hint, and the
 * Reports button — rendered at the bottom of the Job cell in both Stages
 * tables. The note-count chevron rides the job-name line via
 * renderStagesThreadExpandButton; the mobile card list keeps its own zones.
 */
export function renderStagesJobCellActivityFooter(
  ctx: StagesRowRenderContext,
  job: JobWithDetails,
  opts?: {
    /** Billing line whose Stripe emailed/Resend hint shows under the job. */
    billingLineForStripeHint?: JobsLedgerInvoice | null
    /** Billed merged rows render the Reports pill higher in the Job cell (v2.1155). */
    hideReportsButton?: boolean
  },
) {
  const { applyStagesInvoiceFocus, authRole, loadJobs } = ctx

  const stagesInvoiceJumpAmountChipStyle: CSSProperties = {
    padding: '0.15rem 0.4rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
    border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: 4,
    background: '#16a34a',
    color: 'white',
    cursor: 'pointer',
    lineHeight: 1.2,
    fontFamily: 'inherit',
  }

  function renderStagesInvoiceJumpChips(forJob: JobWithDetails) {
    const invs = jobStagesInvoiceJumpChipTargets(forJob)
    if (invs.length === 0) return null
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.3rem',
          marginTop: '0.35rem',
          maxWidth: '100%',
        }}
      >
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 500,
            color: 'var(--text-700)',
            lineHeight: 1.2,
            flexShrink: 0,
          }}
        >
          {invs.length === 1 ? 'Open Invoice:' : 'Open Invoices:'}
        </span>
        {invs.map((inv) => {
          const amt = formatUsdNoCents(Number(inv.amount ?? 0))
          const openCents = Math.round(invoiceOpenRemainingOnJob(inv, forJob) * 100)
          const paidLabel = openCents === 0 ? 'Paid' : 'Unpaid'
          const statusLabel = inv.status === 'billed' ? 'Billed' : 'Ready to bill'
          return (
            <button
              key={inv.id}
              type="button"
              onClick={() => {
                applyStagesInvoiceFocus(inv.id)
              }}
              title={`Go to this invoice row on Stages (${statusLabel}, ${paidLabel})`}
              aria-label={`Go to invoice ${inv.sequence_order} for ${amt}, ${paidLabel}, on Stages`}
              style={stagesInvoiceJumpAmountChipStyle}
            >
              {amt}
            </button>
          )
        })}
      </div>
    )
  }

  function renderStagesStripeEmailedCustomerHint(): ReactNode {
    const line = opts?.billingLineForStripeHint
    if (!line) return null
    if (line.external_send_channel !== 'stripe') return null
    if (!String(line.stripe_invoice_id ?? '').trim()) return null
    const sentRaw = line.sent_to_customer_at
    if (sentRaw == null || !String(sentRaw).trim()) return null
    const sentMeta = getDispatchNoteDisplayMeta(String(sentRaw))
    const stripePaid =
      String(line.stripe_invoice_status ?? '').toLowerCase() === 'paid'
    // One scan line: "Resend Email sent Fri 3:36 PM (today)" (v2.1188 — action
    // first, then the state label). Full wording lives in the tooltip; the
    // resend control keeps its own confirm/disable behavior. The action+label
    // and the time are two nowrap chunks so narrow Job cells wrap between
    // them instead of overflowing into the next column (v2.1042).
    return (
      <div
        title={`Stripe emailed the customer ${sentMeta.weekdayTimeChicago} (${sentMeta.daysAgoLabel})`}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.3rem',
          marginTop: '0.35rem',
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
          lineHeight: 1.2,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
          <StripeInvoiceSendFromStripeButton
            jobsLedgerInvoiceId={line.id}
            stripeInvoiceId={String(line.stripe_invoice_id).trim()}
            customerEmail={job.customer_email ?? null}
            stripeModeForBilling={stripeModeForBillingFromRole(authRole)}
            onSent={() => void loadJobs()}
            compact
            micro
            unboxed
            hideInlineSuccessLine
            recordedLastSendAt={line.sent_to_customer_at}
            buttonLabel="Resend"
            sendDisabled={stripePaid}
            sendDisabledTitle="This Stripe invoice is paid; Stripe will not send another email."
          />
          <span>Email sent</span>
        </span>
        <span style={{ whiteSpace: 'nowrap' }}>
          {formatDispatchNoteWeekdayShortTimeChicago(String(sentRaw))} (
          {formatDispatchNoteDaysAgoShort(String(sentRaw))})
        </span>
      </div>
    )
  }

  function renderStagesContractChip(): ReactNode {
    const coverage = ctx.jobContractCoverageByJobId
    if (!coverage) return null
    const cov = coverage.get(job.id)
    const open = ctx.onOpenJobContract
    return (
      <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
        <JobContractChip coverage={cov} onClick={open ? () => open(job) : undefined} />
      </div>
    )
  }

  return (
    <>
      {renderStagesInvoiceJumpChips(job)}
      {renderStagesContractChip()}
      {renderStagesStripeEmailedCustomerHint()}
      {opts?.hideReportsButton ? null : (
        <div style={{ marginTop: '0.35rem' }}>{renderStagesViewReportsButton(ctx, job)}</div>
      )}
    </>
  )
}

export function stagesRowHasProjectBanner(
  projectId: string | null,
  project: { name: string } | null | undefined
): boolean {
  return !!(projectId && project)
}

export function renderStagesProjectBannerRow(
  projectId: string | null,
  project: { name: string } | null | undefined,
  colSpan: number
): React.ReactElement | null {
  if (!projectId || !project) return null
  return (
    <tr style={{ borderBottom: '1px solid var(--border-job-row)' }}>
      <td
        colSpan={colSpan}
        style={{
          padding: '0.5rem 0.75rem',
          background: 'var(--bg-blue-tint)',
          fontSize: '0.8125rem',
        }}
      >
        <Link to={`/workflows/${projectId}`} style={{ color: 'var(--text-blue-700)', textDecoration: 'none', fontWeight: 500 }}>
          Project: {project.name}
        </Link>
      </td>
    </tr>
  )
}

const STAGES_JOB_COLUMN_ESTIMATE_TITLE_MAX = 56
export function renderStagesJobColumnEstimateFooter(linked: JobWithDetails['linkedEstimateForStages']): React.ReactElement | null {
  if (!linked) return null
  const raw = linked.title?.trim() ?? ''
  const title =
    raw.length > STAGES_JOB_COLUMN_ESTIMATE_TITLE_MAX
      ? `${raw.slice(0, STAGES_JOB_COLUMN_ESTIMATE_TITLE_MAX)}…`
      : raw
  return (
    <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
      <Link
        to={`/estimates/${linked.estimate_number}`}
        style={{ color: '#15803d', textDecoration: 'none', fontWeight: 500 }}
      >
        Quote #{linked.estimate_number}
        {title ? ` — ${title}` : ''}
      </Link>
    </div>
  )
}
