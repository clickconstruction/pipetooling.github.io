import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CSSProperties, ReactNode } from 'react'
import { useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import { useDispatchTaskModal } from '../../contexts/DispatchTaskModalContext'
import { formatEstimatedCompletionDisplay, formatTimeSince, formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import {
  invoiceOpenRemainingOnJob,
  jobBilledUnpaidDollars,
  jobStagesInvoiceJumpChipTargets,
} from '../../lib/jobs/invoiceBilling'
import { jobBillingUnallocatedDollars } from '../../lib/jobsStagesBoard'
import type { InvoiceWithJob } from '../../lib/jobsStagesBoard'
import { buildStagesMoneyBarModel } from '../../lib/stagesMoneyBar'
import {
  deriveStagesBillingActivityDetail,
  deriveStagesFieldReferenceYmd,
  deriveStagesFieldTooltip,
} from '../../lib/stagesJobReferenceDates'
import { formatStagesCompactWindow, formatStagesNextDateLabel } from '../../lib/stagesUpcomingSchedule'
import { formatDecimalWorkHoursToHhMm } from '../../lib/formatDecimalWorkHoursHhMm'
import {
  formatDispatchNoteDaysAgoShortPhrase,
  formatDispatchNoteWeekdayShortTimeChicago,
  getDispatchNoteDisplayMeta,
} from '../../utils/dispatchNoteDisplay'
import { showTaskDispatchButton } from '../../lib/headerTaskDispatchEstimatorEligible'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { stripeModeForBillingFromRole } from '../../lib/voidStripeInvoiceForRevert'
import { StripeInvoiceSendFromStripeButton } from './StripeInvoiceSendFromStripeButton'
import { showAiaG702G703 } from '../../lib/aiaG702G703Eligibility'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { buildClickToolingUrl, googleMapsSearchUrl } from '../../lib/jobs/jobAddressUrls'
import { StagesCardMoreActionsSheet, type StagesCardMoreAction } from './StagesCardMoreActionsSheet'
import { ShareJobButton, useShareJob } from './ShareJobButton'
import { getDefaultWeekRange } from '../../utils/dateUtils'
import StagesProgressPaymentCell from './StagesProgressPaymentCell'
import { JobThreadNotesPanel } from '../JobThreadNotesPanel'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobsStagesTableProps } from './JobsStagesTable'
import type { JobsStagesUnifiedTableProps } from './JobsStagesUnifiedTable'
import {
  accountManOnlyStripeStyle,
  renderJobAddressWithMap,
  renderJobCustomerLine as renderJobCustomerLineWithCtx,
  renderStagesJobColumnEstimateFooter,
  renderStagesJobHcpSubline,
  renderStagesThreadExpandButton,
  renderStagesThreadFullscreenJobHeader,
  renderStagesViewReportsButton,
  renderStagesEditModeRail,
  shouldSuppressStagesRowJobThreadToggle,
  STAGES_EDIT_MODE_RAIL_WIDTH,
  type StagesRowRenderContext,
} from './jobsStagesRowShared'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * Stages "Mobile cards" view (v2.1241, compacted v2.1244; ⋯ tools menu
 * toggle): the same section data as JobsStagesTable / JobsStagesUnifiedTable
 * rendered as full-width vertical cards — built for phones, no sideways
 * scroll. Deliberately consumes the SAME props types as the tables so the
 * section render sites just swap the component; every action routes through
 * the table handlers. Card anatomy (top to bottom): identity + the section's
 * primary action pinned top-right, HCP subline, crew, address/customer,
 * meta chips (the desktop j:/b:/hours stack on one row + open-time), the
 * money cell in `compact` mode (pct + bar + one condensed legend line), the
 * Next-appointment chip, a one-line activity teaser (2-line note clamp,
 * expand chevron), then an always-visible footer: invoice jump chips, View
 * reports, the quick-icon row laid horizontally, and a ⋯ button opening the
 * StagesCardMoreActionsSheet (v2.1402) with every remaining desktop-row
 * action, labeled. Tapping the card (same as a table row) expands the thread
 * panel; the old tap-revealed "toolbelt" is folded into the ⋯ sheet.
 */

const cardStyle: CSSProperties = {
  position: 'relative',
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'var(--surface)',
  padding: '0.5rem 0.65rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
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

function crewLine(job: JobWithDetails) {
  const names = (job.team_members ?? [])
    .map((t) => t.users?.name?.trim())
    .filter(Boolean)
    .join(', ')
  return (
    <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>{names || '—'}</div>
  )
}

// ---------------------------------------------------------------------------
// Compact card zones (v2.1244): the v1 card reused the desktop cell renderers,
// whose stacked single-purpose lines made each card ~2 screens tall. These
// re-render the SAME data (same derivation helpers, same handlers) in
// phone-shaped rows: labeled chips for the j/b/hours shorthand, a one-line
// activity teaser, a compact Next chip, invoice jump chips, and a horizontal
// quick-icon row on the card footer.
// ---------------------------------------------------------------------------

const cardChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: '0.6875rem',
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border)',
  borderRadius: 999,
  padding: '0.1rem 0.55rem',
  color: 'var(--text-700)',
  whiteSpace: 'nowrap',
}

const cardQuickIconStyle: CSSProperties = {
  padding: '0.3rem',
  background: 'none',
  border: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
}

function cardClockGlyph() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

/** The desktop "j: / b: / hours" stack as one row of labeled chips (+ open-time). */
function cardMetaChips(ctx: StagesRowRenderContext, job: JobWithDetails, openLabel: string | null) {
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
  const hoursKnown = ctx.stagesManHoursByJobId.has(job.id)
  const hoursTotal = ctx.stagesManHoursByJobId.get(job.id) ?? 0
  const hours = ctx.stagesManHoursLoading && !hoursKnown ? '…' : formatDecimalWorkHoursToHhMm(hoursTotal)
  const breakdown = ctx.stagesLaborBreakdownByJobId.get(job.id) ?? []
  const hoursTip = breakdown.length
    ? breakdown.map((p) => `${p.personName} ${formatDecimalWorkHoursToHhMm(p.hours)}`).join(' · ')
    : 'Man-hours applied (crew assignments)'
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem' }}>
      <button
        type="button"
        title={jTitle ?? undefined}
        aria-label="Field / job-activity date (click to open the job calendar)"
        onClick={(e) => {
          e.stopPropagation()
          ctx.openJobCalendar(job)
        }}
        style={{ ...cardChipStyle, cursor: 'pointer' }}
      >
        job {jDisplay ?? '—'}
      </button>
      <button
        type="button"
        title={bDetail?.tooltip}
        aria-label="Billing-activity date (click for explanation)"
        onClick={(e) => {
          e.stopPropagation()
          ctx.showToast('Billing-activity date', 'info', 2000, { clientX: e.clientX, clientY: e.clientY })
        }}
        style={{ ...cardChipStyle, cursor: 'pointer' }}
      >
        bill {bDisplay ?? '—'}
      </button>
      <span style={cardChipStyle} title={hoursTip} aria-label={`Man-hours applied: ${hours === '…' ? 'loading' : hours}`}>
        {cardClockGlyph()}
        {hours}
      </span>
      {openLabel ? (
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title="Time since job created">
          open {openLabel}
        </span>
      ) : null}
    </div>
  )
}

/** "NEXT" upcoming appointment as one compact green-edged chip → job calendar. */
function cardNextChip(ctx: StagesRowRenderContext, job: JobWithDetails) {
  const up = ctx.stagesUpcomingByJobId[job.id]
  if (!up) return null
  const headline = `${formatStagesNextDateLabel(up.ymd)} ${formatStagesCompactWindow(up.timeStart, up.timeEnd)} · ${up.assigneeNames.join(', ')}`
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        ctx.openJobCalendar(job)
      }}
      title={`Next scheduled: ${headline}${up.note ? ` — ${up.note}` : ''}. Click to open the job calendar.`}
      aria-label={`Next scheduled appointment ${headline}. Open the job calendar.`}
      style={{
        display: 'block',
        width: '100%',
        padding: '0.1rem 0 0.1rem 0.5rem',
        border: 'none',
        borderLeft: '3px solid var(--border-green)',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
      }}
    >
      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#15803d' }}>Next</span>
        <span style={{ margin: '0 0.35rem' }}>·</span>
        {headline}
      </span>
    </button>
  )
}

/** One-line author · time teaser + 2-line note clamp; expand chevron routes to the thread. */
function cardActivityTeaser(ctx: StagesRowRenderContext, job: JobWithDetails) {
  const stat = ctx.jobThreadStatsByJobId[job.id]
  const wireMs = (iso: string | null | undefined): number | null => {
    if (iso == null || !String(iso).trim()) return null
    const t = Date.parse(String(iso))
    return Number.isNaN(t) ? null : t
  }
  const tNote = wireMs(stat?.last_note_at)
  const tReport = wireMs(stat?.last_report_at)
  let atIso: string | null = null
  let author = ''
  let body = ''
  if (stat && (tNote != null || tReport != null)) {
    const useReport = tReport != null && (tNote == null || tReport > tNote)
    atIso = useReport ? stat.last_report_at! : stat.last_note_at!
    author = (useReport ? stat.last_report_author_name : stat.last_note_author_name)?.trim() || ''
    body = useReport
      ? (stat.last_report_preview ?? '').trim() || `Report: ${(stat.last_report_template_name ?? '').trim() || 'Report'}`
      : (stat.last_note_body ?? '').trim()
  }
  return (
    <div style={{ fontSize: '0.75rem', minWidth: 0 }}>
      <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.35rem' }}>
        {atIso ? (
          <>
            {author ? <strong style={{ color: 'var(--text-strong)' }}>{author}</strong> : null}
            <span style={{ whiteSpace: 'nowrap' }}>
              {formatDispatchNoteWeekdayShortTimeChicago(atIso)} ({formatDispatchNoteDaysAgoShortPhrase(atIso)})
            </span>
          </>
        ) : (
          <span style={{ color: 'var(--text-faint)' }}>—</span>
        )}
        {renderStagesThreadExpandButton(ctx, job.id)}
      </div>
      {body ? (
        <div
          style={{
            color: 'var(--text-700)',
            lineHeight: 1.35,
            wordBreak: 'break-word',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
          }}
        >
          {body}
        </div>
      ) : null}
    </div>
  )
}

/** Green $-amount chips jumping to the invoice's own Stages row. */
function cardInvoiceChips(ctx: StagesRowRenderContext, job: JobWithDetails) {
  const invs = jobStagesInvoiceJumpChipTargets(job)
  if (invs.length === 0) return null
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem' }}>
      {invs.map((inv) => {
        const amt = formatUsdNoCents(Number(inv.amount ?? 0))
        const openCents = Math.round(invoiceOpenRemainingOnJob(inv, job) * 100)
        const paidLabel = openCents === 0 ? 'Paid' : 'Unpaid'
        const statusLabel = inv.status === 'billed' ? 'Billed' : 'Ready to bill'
        return (
          <button
            key={inv.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              ctx.applyStagesInvoiceFocus(inv.id)
            }}
            title={`Go to this invoice row on Stages (${statusLabel}, ${paidLabel})`}
            aria-label={`Go to invoice ${inv.sequence_order} for ${amt}, ${paidLabel}, on Stages`}
            style={{
              padding: '0.15rem 0.5rem',
              fontSize: '0.6875rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: 4,
              background: '#16a34a',
              color: 'white',
              cursor: 'pointer',
              lineHeight: 1.2,
            }}
          >
            {amt}
          </button>
        )
      })}
    </span>
  )
}

/** Billed Stripe invoices: compact "Resend · Email sent …" line (parity with the table's hint). */
function cardStripeEmailedHint(ctx: StagesRowRenderContext, job: JobWithDetails, line: JobsLedgerInvoice) {
  if (line.external_send_channel !== 'stripe') return null
  if (!String(line.stripe_invoice_id ?? '').trim()) return null
  const sentRaw = line.sent_to_customer_at
  if (sentRaw == null || !String(sentRaw).trim()) return null
  const sentMeta = getDispatchNoteDisplayMeta(String(sentRaw))
  const stripePaid = String(line.stripe_invoice_status ?? '').toLowerCase() === 'paid'
  return (
    <div
      title={`Stripe emailed the customer ${sentMeta.weekdayTimeChicago} (${sentMeta.daysAgoLabel})`}
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}
    >
      <StripeInvoiceSendFromStripeButton
        jobsLedgerInvoiceId={line.id}
        stripeInvoiceId={String(line.stripe_invoice_id).trim()}
        customerEmail={job.customer_email ?? null}
        stripeModeForBilling={stripeModeForBillingFromRole(ctx.authRole)}
        onSent={() => void ctx.loadJobs()}
        compact
        micro
        unboxed
        hideInlineSuccessLine
        recordedLastSendAt={line.sent_to_customer_at}
        buttonLabel="Resend"
        sendDisabled={stripePaid}
        sendDisabledTitle="This Stripe invoice is paid; Stripe will not send another email."
      />
      <span style={{ whiteSpace: 'nowrap' }}>
        Email sent {sentMeta.weekdayTimeChicago} ({sentMeta.daysAgoLabel})
      </span>
    </div>
  )
}

/** The desktop activity cell's vertical icon rail, laid horizontally on the card footer. */
function cardQuickIcons(ctx: StagesRowRenderContext, job: JobWithDetails, openDetail: (j: JobWithDetails) => void) {
  const scheduleNoTeam = (job.team_members?.length ?? 0) === 0
  const customerPhone = (job.customer_phone ?? '').trim()
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
      {ctx.canOpenJobScheduleModal ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            ctx.openQuickAssignForJob(job)
          }}
          title="Assign work — pick people and a time"
          aria-label="Assign work — pick people and a time"
          style={{ ...cardQuickIconStyle, cursor: 'pointer', color: '#16a34a' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
            <path d="M224 64C206.3 64 192 78.3 192 96L192 128L160 128C124.7 128 96 156.7 96 192L96 240L544 240L544 192C544 156.7 515.3 128 480 128L448 128L448 96C448 78.3 433.7 64 416 64C398.3 64 384 78.3 384 96L384 128L256 128L256 96C256 78.3 241.7 64 224 64zM96 288L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 288L96 288z" />
          </svg>
        </button>
      ) : null}
      {/* Hidden (not grayed) when the job has no team — week dispatch is team-scoped (v2.1540). */}
      {ctx.canOpenJobScheduleModal && !scheduleNoTeam ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            const week = getDefaultWeekRange().start
            ctx.navigate(`/schedule-dispatch?jobId=${encodeURIComponent(job.id)}&week=${encodeURIComponent(week)}`)
          }}
          title="Open week dispatch"
          aria-label="Open week dispatch"
          style={{ ...cardQuickIconStyle, cursor: 'pointer', color: 'var(--text-link)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
            <path d="M128 96L512 96C547.3 96 576 124.7 576 160L576 480C576 515.3 547.3 544 512 544L128 544C92.7 544 64 515.3 64 480L64 160C64 124.7 92.7 96 128 96zM128 192L128 480L232 480L232 192L128 192zM280 192L280 480L360 480L360 192L280 192zM408 192L408 480L512 480L512 192L408 192z" />
          </svg>
        </button>
      ) : null}
      {customerPhone ? (
        <a
          href={`tel:${customerPhone}`}
          title={`Call customer: ${customerPhone}`}
          aria-label={`Call customer at ${customerPhone}`}
          style={{ ...cardQuickIconStyle, color: '#0f766e' }}
          onClick={(e) => e.stopPropagation()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
            <path d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C492.9 589.2 555.5 534 573.1 469.4L574.6 463.9C579.9 444.2 569.9 423.7 551 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 240.7 342.2 205.8 271.9L253 233.3C266.9 221.9 271.7 202.9 264.8 186.3L224.2 89z" />
          </svg>
        </a>
      ) : null}
      {showTaskDispatchButton(ctx.authRole) ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            ctx.dispatchTaskModal?.openDispatchModal({
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
          }}
          title="Send this job to Dispatch with a note"
          aria-label="Send job to Dispatch"
          style={{ ...cardQuickIconStyle, color: '#0ea5e9' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
            <path d="M280 128C266.7 128 256 138.7 256 152C256 165.3 266.7 176 280 176L296 176L296 209.3C188.8 220.7 104.2 307.7 96.6 416L543.5 416C535.8 307.7 451.2 220.7 344 209.3L344 176L360 176C373.3 176 384 165.3 384 152C384 138.7 373.3 128 360 128L280 128zM88 464C74.7 464 64 474.7 64 488C64 501.3 74.7 512 88 512L552 512C565.3 512 576 501.3 576 488C576 474.7 565.3 464 552 464L88 464z" />
          </svg>
        </button>
      ) : null}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          const numLabel = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
          const label = `${(numLabel ?? '').trim() || '—'} · ${(job.job_name ?? '').trim() || 'Job'}`
          ctx.checklistAddModal?.openAddModal({
            preset: {
              title: `{{1:${label}}} — `,
              links: [`${window.location.origin}/jobs?jobDetail=${encodeURIComponent(job.id)}`],
            },
          })
        }}
        title="Send this job to someone as a task"
        aria-label="Send job as a task"
        style={{ ...cardQuickIconStyle, color: '#7c3aed' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
          <path d="M576 64L64 288L240 352L240 496L328 400L472 512L576 64z" />
        </svg>
      </button>
      {/* Promoted from the ⋯ sheet (v2.1458): Job detail + Share are the two
          most-used desktop row actions — visible on every card, same icons as
          the desktop cluster. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          openDetail(job)
        }}
        title="Job detail"
        aria-label={`Open job detail for ${(job.job_name ?? '').trim() || 'Job'}`}
        style={{ ...cardQuickIconStyle, color: 'var(--text-700)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
          <path d="M264 112L376 112C380.4 112 384 115.6 384 120L384 160L256 160L256 120C256 115.6 259.6 112 264 112zM208 120L208 160L128 160C92.7 160 64 188.7 64 224L64 320L576 320L576 224C576 188.7 547.3 160 512 160L432 160L432 120C432 89.1 406.9 64 376 64L264 64C233.1 64 208 89.1 208 120zM576 368L384 368L384 384C384 401.7 369.7 416 352 416L288 416C270.3 416 256 401.7 256 384L256 368L64 368L64 480C64 515.3 92.7 544 128 544L512 544C547.3 544 576 515.3 576 480L576 368z" />
        </svg>
      </button>
      <ShareJobButton
        jobId={job.id}
        fields={{ hcpNumber: job.hcp_number, jobName: job.job_name, jobAddress: job.job_address }}
        size={16}
        padding="0.3rem"
      />
    </span>
  )
}

/** Sheet header label: effective job number + name (same shape as the send-as-task preset). */
function cardMoreActionsTitle(job: JobWithDetails): string {
  const numLabel = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
  return `${(numLabel ?? '').trim() || '—'} · ${(job.job_name ?? '').trim() || 'Job'}`
}

/** The card's always-visible footer: invoice chips + reports + the horizontal icon row + the ⋯ sheet opener. */
function cardFooterRow(
  ctx: StagesRowRenderContext,
  job: JobWithDetails,
  onMoreActions: () => void,
  openDetail: (j: JobWithDetails) => void,
) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
      {cardInvoiceChips(ctx, job)}
      {renderStagesViewReportsButton(ctx, job)}
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        {cardQuickIcons(ctx, job, openDetail)}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onMoreActions()
          }}
          title="More actions"
          aria-label={`More actions for ${cardMoreActionsTitle(job)}`}
          style={{
            padding: '0.15rem 0.45rem',
            fontSize: '1rem',
            lineHeight: 1,
            fontWeight: 700,
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            background: 'var(--surface)',
            color: 'var(--text-700)',
            cursor: 'pointer',
          }}
        >
          ⋯
        </button>
      </span>
    </div>
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
  const shareJob = useShareJob()
  const [moreActionsJob, setMoreActionsJob] = useState<JobWithDetails | null>(null)
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
    openQuickAssignForJob: props.openQuickAssignForJob,
    navigate,
    authRole: props.authRole,
    dispatchTaskModal,
    checklistAddModal,
    loadJobs: props.loadJobs,
    onDevelopmentFilter: props.onDevelopmentFilter,
  }

  const moreActionsFor = (j: JobWithDetails): StagesCardMoreAction[] => {
    const items: StagesCardMoreAction[] = [
      { key: 'view', label: 'View job', onClick: () => openStagesDetailJobModal(j) },
      { key: 'edit', label: 'Edit job', onClick: () => openEdit(j) },
      {
        key: 'activity',
        label: 'Activity and notes',
        onClick: () => props.openJobThreadFullscreen(j.id),
        badge: (() => {
          const n = props.jobThreadStatsByJobId[j.id]?.note_count ?? 0
          return n > 0 ? String(n) : undefined
        })(),
      },
      { key: 'calendar', label: 'Calendar', onClick: () => props.openJobCalendar(j) },
      {
        key: 'share',
        label: 'Share job',
        onClick: () => void shareJob(j.id, { hcpNumber: j.hcp_number, jobName: j.job_name, jobAddress: j.job_address }),
      },
      { key: 'click-tooling', label: 'Click Tooling report', onClick: () => openInExternalBrowser(buildClickToolingUrl(j)) },
    ]
    if ((j.job_address ?? '').trim()) {
      items.push({ key: 'maps', label: 'Google Maps', onClick: () => openInExternalBrowser(googleMapsSearchUrl(j.job_address)) })
    }
    if (props.canOpenJobScheduleModal && (j.team_members?.length ?? 0) > 0) {
      items.push({
        key: 'week-dispatch',
        label: 'Week dispatch',
        onClick: () => {
          const week = getDefaultWeekRange().start
          navigate(`/schedule-dispatch?jobId=${encodeURIComponent(j.id)}&week=${encodeURIComponent(week)}`)
        },
      })
    }
    if (jobBillingUnallocatedDollars(j) > 0) {
      items.push({
        key: 'partial-invoice',
        label: 'Partial invoice',
        onClick: () => {
          setCreatePartialInvoiceAmount('')
          setCreatePartialInvoiceJob(j)
        },
      })
    }
    if (showAiaG702G703(props.authRole, j)) {
      items.push({ key: 'aia', label: 'AIA G702-G703', onClick: () => setAiaG702StagesJob(j) })
    }
    if (canCreateHazmatFee) {
      items.push({
        key: 'hazmat',
        label: 'Hazmat fee',
        onClick: () => openHazmatFee(j),
        badge: hazmatFeeJobIds?.has(j.id) ? 'live' : undefined,
      })
    }
    const sendBack = onSendBack ?? onSendBackSimple
    if (sendBack) {
      items.push({ key: 'send-back', label: props.sendBackLabel ?? 'Send back', tone: 'muted', onClick: () => sendBack(j) })
    }
    return items
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
              ...accountManOnlyStripeStyle(j),
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
            {cardMetaChips(ctx, j, showTimeOpen ? formatTimeSince(j.created_at ?? null) : null)}
            <StagesProgressPaymentCell
              compact
              model={buildStagesMoneyBarModel({
                totalBill: j.revenue != null ? Number(j.revenue) : null,
                paymentsMade: j.payments_made != null ? Number(j.payments_made) : null,
                pctComplete: j.pct_complete ?? null,
                billedUnpaid: jobBilledUnpaidDollars(j),
              })}
              pctComplete={j.pct_complete ?? null}
              pctSaving={showPctComplete ? pctCompleteSavingId === j.id : undefined}
              onPctCommit={showPctComplete && canEditJobPctComplete ? (n) => updateJobPctComplete(j.id, n) : undefined}
              onNoBidValueClick={() => openEdit(j, { fixturesSectionHighlight: true })}
            />
            {cardNextChip(ctx, j)}
            {cardActivityTeaser(ctx, j)}
            {cardFooterRow(ctx, j, () => setMoreActionsJob(j), openStagesDetailJobModal)}
            {expanded ? renderCardThreadPanel(props, ctx, j) : null}
          </div>
        )
      })}
      <StagesCardMoreActionsSheet
        open={moreActionsJob != null}
        title={moreActionsJob ? cardMoreActionsTitle(moreActionsJob) : ''}
        actions={moreActionsJob ? moreActionsFor(moreActionsJob) : []}
        onClose={() => setMoreActionsJob(null)}
      />
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
  const shareJob = useShareJob()
  const [moreActionsRow, setMoreActionsRow] = useState<(typeof rows)[number] | null>(null)
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
    openQuickAssignForJob: props.openQuickAssignForJob,
    navigate,
    authRole: props.authRole,
    dispatchTaskModal,
    checklistAddModal,
    loadJobs: props.loadJobs,
    onDevelopmentFilter: props.onDevelopmentFilter,
  }

  const moreActionsForRow = (row: (typeof rows)[number]): StagesCardMoreAction[] => {
    const j = row.job
    const inv = row.kind === 'job' ? null : row.inv
    const invWithJob: InvoiceWithJob | null = inv ? { ...inv, job: j } : null
    const items: StagesCardMoreAction[] = [
      { key: 'view', label: 'View job', onClick: () => openStagesDetailJobModal(j) },
      { key: 'edit', label: 'Edit job', onClick: () => openEdit(j) },
      { key: 'calendar', label: 'Calendar', onClick: () => props.openJobCalendar(j) },
      {
        key: 'share',
        label: 'Share job',
        onClick: () => void shareJob(j.id, { hcpNumber: j.hcp_number, jobName: j.job_name, jobAddress: j.job_address }),
      },
    ]
    if (onViewBill && invWithJob) {
      items.push({ key: 'view-bill', label: 'View bill', onClick: () => onViewBill(invWithJob) })
    }
    if (props.showClickTooling !== false) {
      items.push({ key: 'click-tooling', label: 'Click Tooling report', onClick: () => openInExternalBrowser(buildClickToolingUrl(j)) })
    }
    if ((j.job_address ?? '').trim()) {
      items.push({ key: 'maps', label: 'Google Maps', onClick: () => openInExternalBrowser(googleMapsSearchUrl(j.job_address)) })
    }
    if (props.canOpenJobScheduleModal && (j.team_members?.length ?? 0) > 0) {
      items.push({
        key: 'week-dispatch',
        label: 'Week dispatch',
        onClick: () => {
          const week = getDefaultWeekRange().start
          navigate(`/schedule-dispatch?jobId=${encodeURIComponent(j.id)}&week=${encodeURIComponent(week)}`)
        },
      })
    }
    if (onOpenLienTooling) {
      items.push({ key: 'lien', label: 'Lien Tooling', onClick: () => onOpenLienTooling({ job: j, invoice: inv }) })
    }
    if (onJobMoveToCollections) {
      items.push({ key: 'collections', label: 'Flag for collections', tone: 'warn', onClick: () => onJobMoveToCollections(j) })
    }
    if (row.kind === 'job' && onJobSendBack) {
      items.push({ key: 'send-back', label: jobSendBackLabel ?? 'Send back', tone: 'muted', onClick: () => onJobSendBack(j) })
    }
    if (row.kind !== 'job' && invWithJob) {
      items.push({ key: 'send-back-inv', label: jobSendBackLabel ?? 'Send back', tone: 'muted', onClick: () => onInvoiceSendBack(invWithJob) })
    }
    return items
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
              ...accountManOnlyStripeStyle(j),
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
            {cardMetaChips(ctx, j, showTimeOpen ? formatTimeSince(j.created_at ?? null) : null)}
            <StagesProgressPaymentCell
              compact
              model={buildStagesMoneyBarModel({
                totalBill: j.revenue != null ? Number(j.revenue) : null,
                paymentsMade: j.payments_made != null ? Number(j.payments_made) : null,
                pctComplete: j.pct_complete ?? null,
                billedUnpaid: jobBilledUnpaidDollars(j),
              })}
              pctComplete={j.pct_complete ?? null}
              pctSaving={pctCompleteSavingId === j.id}
              onPctCommit={canEditJobPctComplete ? (n) => updateJobPctComplete(j.id, n) : undefined}
              onNoBidValueClick={() => openEdit(j, { fixturesSectionHighlight: true })}
            />
            {cardNextChip(ctx, j)}
            {cardActivityTeaser(ctx, j)}
            {inv ? cardStripeEmailedHint(ctx, j, inv) : null}
            {cardFooterRow(ctx, j, () => setMoreActionsRow(row), openStagesDetailJobModal)}
            {expanded ? renderCardThreadPanel(props, ctx, j) : null}
          </div>
        )
      })}
      <StagesCardMoreActionsSheet
        open={moreActionsRow != null}
        title={moreActionsRow ? cardMoreActionsTitle(moreActionsRow.job) : ''}
        actions={moreActionsRow ? moreActionsForRow(moreActionsRow) : []}
        onClose={() => setMoreActionsRow(null)}
      />
    </div>
  )
}
