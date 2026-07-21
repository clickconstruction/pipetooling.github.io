import { type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Link, type NavigateFunction } from 'react-router-dom'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { getBidServiceTypeTag } from '../../utils/unifiedJobBidSearch'
import {
  deriveStagesBillingActivityDetail,
  deriveStagesFieldReferenceYmd,
  deriveStagesFieldTooltip,
} from '../../lib/stagesJobReferenceDates'
import { formatEstimatedCompletionDisplay, formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { formatDecimalWorkHoursToHhMm } from '../../lib/formatDecimalWorkHoursHhMm'
import { formatAddressTwoLines, googleMapsSearchUrl } from '../../lib/jobs/jobAddressUrls'
import { JobAddressText } from './JobAddressText'
import { invoiceOpenRemainingOnJob, jobStagesInvoiceJumpChipTargets } from '../../lib/jobs/invoiceBilling'
import {
  formatDispatchNoteDaysAgoShortPhrase,
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
  stagesManHoursByJobId: Map<string, number>
  stagesManHoursLoading: boolean
  stagesLaborBreakdownByJobId: Map<string, Array<{ personName: string; hours: number }>>
  expandedJobThreadId: string | null
  toggleStagesJobThreadExpanded: (id: string) => void
  jobThreadStatsByJobId: ReturnType<typeof useJobThreadNotes>['jobThreadStatsByJobId']
  jobThreadActivityByJobId: ReturnType<typeof useJobThreadNotes>['jobThreadActivityByJobId']
  setViewReportsJob: (v: { id: string; hcpNumber: string; jobName: string; jobAddress: string } | null) => void
  applyStagesInvoiceFocus: (invoiceId: string) => boolean
  canOpenJobScheduleModal: boolean
  setScheduleModalJob: (j: JobWithDetails | null) => void
  navigate: NavigateFunction
  authRole: ReturnType<typeof useAuth>['role']
  dispatchTaskModal: ReturnType<typeof useDispatchTaskModal>
  checklistAddModal: ReturnType<typeof useChecklistAddModal>
  loadJobs: () => Promise<unknown>
}


/** Stages table headers: one visual line per phrase when the table is narrow (no mid-phrase wrap). */
const stagesThreeLineHeaderLineStyle: CSSProperties = { display: 'block', whiteSpace: 'nowrap' }

export function renderStagesThreeLineHeader(line1: string, line2: string, line3: string) {
  return (
    <>
      <span style={stagesThreeLineHeaderLineStyle}>{line1}</span>
      <span style={stagesThreeLineHeaderLineStyle}>{line2}</span>
      <span style={stagesThreeLineHeaderLineStyle}>{line3}</span>
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
}
const stagesJobHcpBadgeStyle: CSSProperties = {
  ...stagesJobSublinePillBoxBase,
  border: '1px solid rgba(255,255,255,0.5)',
  background: '#2563eb',
  color: 'white',
}

export function renderStagesJobHcpSubline(job: JobWithDetails, extraWrap?: CSSProperties) {
  const t = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
  if (t) {
    const stName = job.serviceType?.name?.trim()
    const tagInfo = stName ? getBidServiceTypeTag(stName) : null
    const serviceLabel = stName
      ? (tagInfo?.tag ?? stName.slice(0, 4)).toUpperCase()
      : ''
    const borderColor = tagInfo?.color ?? '#d1d5db'
    const servicePillStyle: CSSProperties | null = stName
      ? {
          ...stagesJobSublinePillBoxBase,
          marginTop: '0.15rem',
          letterSpacing: '0.02em',
          border: `1px solid ${borderColor}`,
          background: tagInfo ? borderColor : 'var(--bg-muted)',
          color: tagInfo ? '#fff' : 'var(--text-700)',
        }
      : null
    return (
      <div style={extraWrap}>
        <span style={stagesJobHcpBadgeStyle}>Job: {t}</span>
        {servicePillStyle ? <span style={servicePillStyle}>{serviceLabel}</span> : null}
      </div>
    )
  }
  return (
    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', ...extraWrap }}>—</div>
  )
}

export function renderStagesFieldAndBillingLines(ctx: StagesRowRenderContext, job: JobWithDetails) {
  const { showToast, stagesManHoursByJobId, stagesManHoursLoading, stagesLaborBreakdownByJobId } = ctx
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
        aria-label="Field / job-activity date (click for explanation)"
        onClick={(e) => {
          e.stopPropagation()
          showToast('Field / job-activity date', 'info', 2000, { clientX: e.clientX, clientY: e.clientY })
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
        return (
          <div
            style={{ ...lineStyle, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            title={tip}
            aria-label={`Man-hours applied: ${display === '…' ? 'loading' : display}`}
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

export function renderJobCustomerLine(ctx: StagesRowRenderContext, job: JobWithDetails) {
  const { customers, openEditJobAndCreateCustomerFlow } = ctx
  const hasCustomerInfo = ((job.customer_name ?? '').trim() || (job.customer_email ?? '').trim() || (job.customer_phone ?? '').trim())
  if (!hasCustomerInfo) return null
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
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 640 640"
          width={13}
          height={13}
          fill="currentColor"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <path d="M160 64C124.7 64 96 92.7 96 128L96 512C96 547.3 124.7 576 160 576L448 576C483.3 576 512 547.3 512 512L512 128C512 92.7 483.3 64 448 64L160 64zM272 352L336 352C380.2 352 416 387.8 416 432C416 440.8 408.8 448 400 448L208 448C199.2 448 192 440.8 192 432C192 387.8 227.8 352 272 352zM248 256C248 225.1 273.1 200 304 200C334.9 200 360 225.1 360 256C360 286.9 334.9 312 304 312C273.1 312 248 286.9 248 256zM576 144C576 135.2 568.8 128 560 128C551.2 128 544 135.2 544 144L544 208C544 216.8 551.2 224 560 224C568.8 224 576 216.8 576 208L576 144zM576 272C576 263.2 568.8 256 560 256C551.2 256 544 263.2 544 272L544 336C544 344.8 551.2 352 560 352C568.8 352 576 344.8 576 336L576 272zM560 384C551.2 384 544 391.2 544 400L544 464C544 472.8 551.2 480 560 480C568.8 480 576 472.8 576 464L576 400C576 391.2 568.8 384 560 384z" />
        </svg>
        <span>{(job.customer_name ?? '').trim() || '—'}</span>
      </span>
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

function renderStagesThreadExpandButton(ctx: StagesRowRenderContext, jobId: string) {
  const { expandedJobThreadId, jobThreadStatsByJobId, toggleStagesJobThreadExpanded } = ctx
  const expanded = expandedJobThreadId === jobId
  const stat = jobThreadStatsByJobId[jobId]
  const count = stat?.note_count ?? 0
  return (
    <button
      type="button"
      onClick={() => toggleStagesJobThreadExpanded(jobId)}
      aria-expanded={expanded}
      title={count > 0 ? `${count} thread note(s)` : 'Job notes thread'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '0.25rem',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        color: 'var(--text-700)',
        fontSize: '0.75rem',
        lineHeight: 1.1,
        flexShrink: 0,
        alignSelf: 'flex-start',
      }}
    >
      <span aria-hidden>{expanded ? '\u25BC' : '\u25B6'}</span>
      {count > 0 ? (
        <span style={{ fontSize: '0.65rem', color: 'var(--text-link)', fontWeight: 600 }}>{count}</span>
      ) : null}
    </button>
  )
}

export function renderStagesLastActivityCell(
  ctx: StagesRowRenderContext,
  job: JobWithDetails,
  billingLineForStripeHint?: JobsLedgerInvoice | null,
) {
  const {
    expandedJobThreadId,
    jobThreadStatsByJobId,
    jobThreadActivityByJobId,
    toggleStagesJobThreadExpanded,
    setViewReportsJob,
    applyStagesInvoiceFocus,
    canOpenJobScheduleModal,
    setScheduleModalJob,
    navigate,
    authRole,
    dispatchTaskModal,
    checklistAddModal,
    loadJobs,
  } = ctx
  const jobId = job.id
  const stat = jobThreadStatsByJobId[jobId]
  const count = stat?.note_count ?? 0
  const activity = jobThreadActivityByJobId[jobId]
  let fromThreadBody = ''
  let lastChronologicalNoteAuthor: string | undefined
  if (activity?.length) {
    for (let i = activity.length - 1; i >= 0; i--) {
      const it = activity[i]
      if (it == null) continue
      if (it.kind === 'note') {
        fromThreadBody = (it.note.body ?? '').trim()
        lastChronologicalNoteAuthor = it.note.author?.name?.trim() || undefined
        break
      }
    }
  }
  const titleForEmpty = 'Job notes thread'
  const reportCount = stat?.report_count ?? 0
  const titleParts: string[] = []
  if (count > 0) titleParts.push(`${count} thread note(s)`)
  if (reportCount > 0) titleParts.push(`${reportCount} field report(s)`)
  const titleWithNotes = titleParts.length > 0 ? titleParts.join(' · ') : titleForEmpty
  const expanded = expandedJobThreadId === jobId
  const scheduleNoTeam = (job.team_members?.length ?? 0) === 0
  const cellReportCount = job.report_count ?? 0

  function renderStagesViewReportsFooterButton() {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setViewReportsJob({ id: job.id, hcpNumber: job.hcp_number ?? '—', jobName: job.job_name ?? '—', jobAddress: job.job_address ?? '—' })}
          style={{
            padding: '0.2rem 0.5rem',
            fontSize: '0.75rem',
            background: 'none',
            color: 'var(--text-link)',
            border: '1px solid #2563eb',
            borderRadius: 4,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {cellReportCount} Report{cellReportCount !== 1 ? 's' : ''}
        </button>
      </div>
    )
  }

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
          marginTop: 'auto',
          flexShrink: 0,
          alignSelf: 'stretch',
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

  const lastActivityMainColumnStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    alignItems: 'stretch',
  }

  const tdShellStyle: CSSProperties = {
    padding: '0.75rem',
    verticalAlign: 'top',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: '0.35rem',
  }

  function renderStagesLastActivityLeadingControls() {
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
              onClick={() => setScheduleModalJob(job)}
              disabled={scheduleNoTeam}
              title={scheduleNoTeam ? 'Assign team members to open schedule' : 'Open schedule'}
              aria-label={scheduleNoTeam ? 'Schedule: assign team members first' : 'Open schedule'}
              style={{
                ...quickIconButtonStyle,
                cursor: scheduleNoTeam ? 'not-allowed' : 'pointer',
                color: scheduleNoTeam ? 'var(--text-faint)' : '#16a34a',
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
          {canOpenJobScheduleModal ? (
            <button
              type="button"
              onClick={() => {
                const week = getDefaultWeekRange().start
                navigate(`/schedule-dispatch?jobId=${encodeURIComponent(job.id)}&week=${encodeURIComponent(week)}`)
              }}
              disabled={scheduleNoTeam}
              title={scheduleNoTeam ? 'Assign team members to open week dispatch' : 'Open week dispatch'}
              aria-label={scheduleNoTeam ? 'Week dispatch: assign team members first' : 'Open week dispatch'}
              style={{
                ...quickIconButtonStyle,
                cursor: scheduleNoTeam ? 'not-allowed' : 'pointer',
                color: scheduleNoTeam ? 'var(--text-faint)' : 'var(--text-link)',
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
        {renderStagesThreadExpandButton(ctx, jobId)}
      </div>
    )
  }

  function lastActivityBodyInteractiveProps(title: string): {
    role: 'button'
    tabIndex: 0
    title: string
    'aria-expanded': boolean
    onClick: () => void
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
    style: CSSProperties
  } {
    return {
      role: 'button',
      tabIndex: 0,
      title,
      'aria-expanded': expanded,
      onClick: () => toggleStagesJobThreadExpanded(jobId),
      onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggleStagesJobThreadExpanded(jobId)
        }
      },
      style: {
        flex: 1,
        minWidth: 0,
        cursor: 'pointer',
      },
    }
  }

  function renderStagesStripeEmailedCustomerHint(): ReactNode {
    const line = billingLineForStripeHint
    if (!line) return null
    if (line.external_send_channel !== 'stripe') return null
    if (!String(line.stripe_invoice_id ?? '').trim()) return null
    const sentRaw = line.sent_to_customer_at
    if (sentRaw == null || !String(sentRaw).trim()) return null
    const sentMeta = getDispatchNoteDisplayMeta(String(sentRaw))
    const stripePaid =
      String(line.stripe_invoice_status ?? '').toLowerCase() === 'paid'
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.2rem',
          width: '100%',
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
          lineHeight: 1.2,
          textAlign: 'center',
        }}
      >
        <span>Stripe emailed customer</span>
        <span>
          {sentMeta.weekdayTimeChicago} ({sentMeta.daysAgoLabel})
        </span>
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
          buttonLabel="Resend invoice email"
          sendDisabled={stripePaid}
          sendDisabledTitle="This Stripe invoice is paid; Stripe will not send another email."
        />
      </div>
    )
  }

  function threadActivityWireMs(iso: string | null | undefined): number | null {
    if (iso == null || !String(iso).trim()) return null
    const t = Date.parse(String(iso))
    return Number.isNaN(t) ? null : t
  }

  if (!stat) {
    return (
      <td style={tdShellStyle}>
        {renderStagesLastActivityLeadingControls()}
        <div style={lastActivityMainColumnStyle}>
          <div {...lastActivityBodyInteractiveProps(titleForEmpty)}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>—</span>
          </div>
          {renderStagesStripeEmailedCustomerHint()}
          {renderStagesInvoiceJumpChips(job)}
          {renderStagesViewReportsFooterButton()}
        </div>
      </td>
    )
  }
  const tNote = threadActivityWireMs(stat.last_note_at)
  const tReport = threadActivityWireMs(stat.last_report_at)
  if (tNote == null && tReport == null) {
    return (
      <td style={tdShellStyle}>
        {renderStagesLastActivityLeadingControls()}
        <div style={lastActivityMainColumnStyle}>
          <div {...lastActivityBodyInteractiveProps(titleForEmpty)}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>—</span>
          </div>
          {renderStagesStripeEmailedCustomerHint()}
          {renderStagesInvoiceJumpChips(job)}
          {renderStagesViewReportsFooterButton()}
        </div>
      </td>
    )
  }
  const useReport = tReport != null && (tNote == null || tReport > tNote)
  const atIso = useReport ? stat.last_report_at! : stat.last_note_at!
  const author = useReport
    ? stat.last_report_author_name?.trim() || ''
    : stat.last_note_author_name?.trim() || lastChronologicalNoteAuthor || ''
  const body = useReport
    ? (() => {
        const tmpl = (stat.last_report_template_name ?? '').trim() || 'Report'
        const prev = (stat.last_report_preview ?? '').trim()
        return prev ? `Report: ${tmpl}\n${prev}` : `Report: ${tmpl}`
      })()
    : (stat.last_note_body ?? '').trim() || fromThreadBody
  return (
    <td style={{ ...tdShellStyle, maxWidth: 280 }}>
      {renderStagesLastActivityLeadingControls()}
      <div style={lastActivityMainColumnStyle}>
        <div {...lastActivityBodyInteractiveProps(titleWithNotes)}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
            {author ? <span>{author}</span> : null}
            {author ? <span style={{ margin: '0 0.35rem' }}>·</span> : null}
            <span>{formatDispatchNoteWeekdayShortTimeChicago(atIso)}</span>
            <span style={{ marginLeft: '0.35rem' }}>({formatDispatchNoteDaysAgoShortPhrase(atIso)})</span>
          </div>
          <div
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-700)',
              lineHeight: 1.35,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              maxHeight: '4.2em',
              overflow: 'hidden',
            }}
          >
            {body || '—'}
          </div>
        </div>
        {renderStagesStripeEmailedCustomerHint()}
        {renderStagesInvoiceJumpChips(job)}
        {renderStagesViewReportsFooterButton()}
      </div>
    </td>
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
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
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
