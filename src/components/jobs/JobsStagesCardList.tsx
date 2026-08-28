import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CSSProperties, ReactNode } from 'react'
import { useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import { useDispatchTaskModal } from '../../contexts/DispatchTaskModalContext'
import { useJobHoursStoryModal } from '../../contexts/JobHoursStoryModalContext'
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
import { useShareJob } from './ShareJobButton'
import { getDefaultWeekRange } from '../../utils/dateUtils'
import StagesProgressPaymentCell from './StagesProgressPaymentCell'
import { JobsStagesThreadPanel } from './JobsStagesThreadPanel'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobsStagesTableProps } from './JobsStagesTable'
import type { JobsStagesUnifiedTableProps } from './JobsStagesUnifiedTable'
import {
  accountManOnlyStripeStyle,
  renderJobCustomerAndAddressLine,
  renderStagesJobColumnEstimateFooter,
  renderStagesJobHcpChip,
  renderStagesThreadExpandButton,
  renderStagesThreadFullscreenJobHeader,
  renderStagesViewReportsButton,
  renderStagesEditModeRail,
  shouldSuppressStagesRowJobThreadToggle,
  STAGES_EDIT_MODE_RAIL_WIDTH,
  stagesInvoiceRowAccentRowStyle,
  stagesInvoiceRowAccentRailStyle,
  type StagesRowRenderContext,
} from './jobsStagesRowShared'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * Stages "Mobile cards" view (v2.1241, compacted v2.1244; ⋯ tools menu
 * toggle): the same section data as JobsStagesTable / JobsStagesUnifiedTable
 * rendered as full-width vertical cards — built for phones, no sideways
 * scroll. Deliberately consumes the SAME props types as the tables so the
 * section render sites just swap the component; every action routes through
 * the table handlers. Zoned card anatomy (top to bottom): (1) identity —
 * number+trade chip and name on one title line with the section's primary
 * action pinned top-right, then customer · one-line address on a single muted
 * row (GC/development/Account-Man rows only when present); (2) the tinted
 * MONEY ZONE — the only place money renders: optional invoice-context line,
 * the money cell in `compact` mode (pct + bar + condensed legend), and the
 * Stripe "✉ Sent … · Resend" state; (3) a hairline-separated action row:
 * invoice jump chips, View reports, the j:/b:/hours meta chips + open-time,
 * then call + a ⋯ button opening the StagesCardMoreActionsSheet (v2.1402)
 * with every remaining desktop-row action, labeled (incl. the demoted rail
 * icons: assign, dispatch note, send-as-task; crew names ride the sheet
 * header); (4) pulse, at the card FOOT — the Next-appointment chip and a
 * strictly one-line activity teaser (author · age — body, expand chevron) —
 * deliberately last so it sits flush against the thread panel it previews.
 * Tapping the card (same as a table row) expands the thread panel.
 */

const cardStyle: CSSProperties = {
  position: 'relative',
  border: '1px solid var(--border-strong)',
  borderRadius: 10,
  background: 'var(--surface)',
  // Elevation carries the card edge in LIGHT mode, where --bg-page (#fafafa)
  // and --surface (#fff) are near-identical and a --border hairline dissolves;
  // in dark mode the shadow fades to harmless and the surface step separates.
  boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 2px 10px rgba(0,0,0,0.07)',
  padding: '0.5rem 0.65rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  overflow: 'hidden',
}

/** Card title row: "941 PLUM" chip leading the job-name link on one line (chip below was dead vertical space). */
const cardTitleRowWithChipStyle: CSSProperties = {
  minWidth: 0,
  flex: 1,
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.4rem',
}

/** Nudge the chip down so it centers on the name's first text line. */
const cardTitleChipStyle: CSSProperties = {
  flexShrink: 0,
  marginTop: '0.1rem',
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

/** Crew names for the ⋯ sheet header — the card body no longer spends a row on them (zoned card). */
function crewNamesLabel(job: JobWithDetails): string | undefined {
  const names = (job.team_members ?? [])
    .map((t) => t.users?.name?.trim())
    .filter(Boolean)
    .join(', ')
  return names ? `Crew: ${names}` : undefined
}

/** The money zone (zoned card): a tinted strip that is the only place money renders on the card. */
const cardMoneyZoneStyle: CSSProperties = {
  background: 'var(--bg-subtle)',
  borderRadius: 8,
  padding: '0.4rem 0.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
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
  // Chips with no value are omitted (zoned card) — a "job —" placeholder is
  // dead width on the action row; the calendar stays reachable via the Next
  // chip and the ⋯ sheet.
  const showHoursChip = hours === '…' || hoursTotal > 0
  return (
    <>
      {jDisplay ? (
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
          job {jDisplay}
        </button>
      ) : null}
      {bDisplay ? (
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
          bill {bDisplay}
        </button>
      ) : null}
      {showHoursChip ? (
        ctx.openJobHoursStory ? (
          <button
            type="button"
            title={`${hoursTip} — tap for the job's work story`}
            aria-label={`Man-hours applied: ${hours === '…' ? 'loading' : hours} — open the work story`}
            onClick={(e) => {
              e.stopPropagation()
              ctx.openJobHoursStory?.({ jobId: job.id, hcpNumber: job.hcp_number, clickNumber: job.click_number, jobName: job.job_name })
            }}
            style={{ ...cardChipStyle, cursor: 'pointer' }}
          >
            {cardClockGlyph()}
            {hours}
          </button>
        ) : (
          <span style={cardChipStyle} title={hoursTip} aria-label={`Man-hours applied: ${hours === '…' ? 'loading' : hours}`}>
            {cardClockGlyph()}
            {hours}
          </span>
        )
      ) : null}
      {openLabel ? (
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title="Time since job created">
          open {openLabel}
        </span>
      ) : null}
    </>
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
  // No activity and no notes → no row at all (zoned card); the card tap and
  // the ⋯ sheet's "Activity and notes" still reach the thread.
  if (!atIso && (stat?.note_count ?? 0) === 0) return null
  return (
    <div style={{ fontSize: '0.75rem', minWidth: 0, display: 'flex', alignItems: 'baseline', columnGap: '0.35rem' }}>
      {atIso ? (
        <>
          {author ? <strong style={{ color: 'var(--text-strong)', flexShrink: 0 }}>{author}</strong> : null}
          <span
            style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}
            title={formatDispatchNoteWeekdayShortTimeChicago(atIso)}
          >
            {formatDispatchNoteDaysAgoShortPhrase(atIso)}
          </span>
          {body ? (
            // One line, hard-ellipsized (zoned card) — the ▶ expand and the
            // fullscreen thread carry the full text, so the card only teases.
            <span style={{ color: 'var(--text-700)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              — {body}
            </span>
          ) : null}
        </>
      ) : (
        <span style={{ color: 'var(--text-faint)' }}>—</span>
      )}
      {renderStagesThreadExpandButton(ctx, job.id)}
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
      style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}
    >
      <span style={{ whiteSpace: 'nowrap' }}>✉ Sent {sentMeta.daysAgoLabel}</span>
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
    </div>
  )
}

/** Call-customer icon — the one quick action that stays on the card foot (zoned card); everything else lives in the ⋯ sheet. */
function cardCallIcon(job: JobWithDetails) {
  const customerPhone = (job.customer_phone ?? '').trim()
  if (!customerPhone) return null
  return (
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
  )
}

/** Sheet header label: effective job number + name (same shape as the send-as-task preset). */
function cardMoreActionsTitle(job: JobWithDetails): string {
  const numLabel = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
  return `${(numLabel ?? '').trim() || '—'} · ${(job.job_name ?? '').trim() || 'Job'}`
}

/**
 * The card's action row (zoned card): a hairline-separated foot carrying
 * Reports + invoice jump chips + the j/b/hours meta chips, then call + the ⋯
 * sheet opener. The old always-visible icon rail (assign, week dispatch,
 * dispatch note, send-as-task, job detail, share) lives in the ⋯ sheet now.
 */
function cardFooterRow(
  ctx: StagesRowRenderContext,
  job: JobWithDetails,
  onMoreActions: () => void,
  openLabel: string | null,
) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.4rem', marginTop: '0.1rem' }}>
      {cardInvoiceChips(ctx, job)}
      {renderStagesViewReportsButton(ctx, job)}
      {cardMetaChips(ctx, job, openLabel)}
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        {cardCallIcon(job)}
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
  | 'submitJobThreadNoteWithBody'
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
      <JobsStagesThreadPanel
        job={j}
        activity={ctx.jobThreadActivityByJobId[j.id] ?? []}
        loading={p.jobThreadNotesLoadingId === j.id}
        upcoming={ctx.stagesUpcomingByJobId[j.id] ?? null}
        viewerRole={p.authRole}
        {...(p.authUser && p.submitJobThreadNoteWithBody
          ? { submitNoteWithBody: p.submitJobThreadNoteWithBody }
          : {})}
        fullscreen={p.jobThreadFullscreen}
        onToggleFullscreen={() => p.setJobThreadFullscreen(!p.jobThreadFullscreen)}
        fullscreenHeader={renderStagesThreadFullscreenJobHeader(j)}
        pctComplete={j.pct_complete ?? null}
        canEditPct={p.canEditJobPctComplete}
        pctSaving={p.pctCompleteSavingId === j.id}
        onCommitPct={(value, note) => p.commitStagesPctWithNote(j.id, value, note)}
        teamMembers={j.team_members?.map((t) => ({ user_id: t.user_id, name: t.users?.name ?? null })) ?? []}
        {...(p.canManageJobPeople
          ? {
              peopleAction: {
                onClick: () =>
                  p.setManageJobPeople({
                    jobId: j.id,
                    jobLabel: `${(j.hcp_number ?? '').trim() || '\u2014'} \u00b7 ${(j.job_name ?? '').trim() || 'Job'}`,
                    currentTeamUserIds: j.team_members?.map((t) => t.user_id) ?? [],
                  }),
              },
            }
          : {})}
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
  const jobHoursStoryModal = useJobHoursStoryModal()
  const checklistAddModal = useChecklistAddModal()
  const shareJob = useShareJob()
  const [moreActionsJob, setMoreActionsJob] = useState<JobWithDetails | null>(null)
  const ctx: StagesRowRenderContext = {
    openJobHoursStory: jobHoursStoryModal?.openJobHoursStory,
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
    openJobActivityExpand: props.openJobActivityExpand,
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
      { key: 'click-tooling', label: 'Plumbing Tooling report', onClick: () => openInExternalBrowser(buildClickToolingUrl(j)) },
    ]
    if ((j.job_address ?? '').trim()) {
      items.push({ key: 'maps', label: 'Google Maps', onClick: () => openInExternalBrowser(googleMapsSearchUrl(j.job_address)) })
    }
    // Demoted from the always-visible icon rail (zoned card): the rail is now
    // call + ⋯ only, so these keep their labeled homes here.
    if (ctx.canOpenJobScheduleModal) {
      items.push({ key: 'assign-work', label: 'Assign work', onClick: () => ctx.openQuickAssignForJob(j) })
    }
    if (showTaskDispatchButton(ctx.authRole)) {
      items.push({
        key: 'dispatch-note',
        label: 'Send to Dispatch',
        onClick: () =>
          ctx.dispatchTaskModal?.openDispatchModal({
            reference: {
              source: 'job',
              id: j.id,
              hcp_number: j.hcp_number ?? '',
              click_number: j.click_number ?? null,
              job_name: j.job_name ?? '',
              job_address: j.job_address ?? '',
              service_type_id: j.service_type_id ?? null,
              service_type_name: j.serviceType?.name ?? null,
            },
          }),
      })
    }
    items.push({
      key: 'send-task',
      label: 'Send as task',
      onClick: () => {
        const numLabel = effectiveJobLedgerNumber(j.hcp_number, j.click_number)
        const label = `${(numLabel ?? '').trim() || '—'} · ${(j.job_name ?? '').trim() || 'Job'}`
        ctx.checklistAddModal?.openAddModal({
          preset: {
            title: `{{1:${label}}} — `,
            links: [`${window.location.origin}/jobs?jobDetail=${encodeURIComponent(j.id)}`],
          },
        })
      },
    })
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
              <div style={cardTitleRowWithChipStyle}>
                {renderStagesJobHcpChip(j, cardTitleChipStyle)}
                <div style={{ minWidth: 0, flex: 1 }}>{renderStagesOpenDetailJobName(j)}</div>
              </div>
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
            {renderJobCustomerAndAddressLine(ctx, j)}
            {renderStagesJobColumnEstimateFooter(j.linkedEstimateForStages)}
            <div style={cardMoneyZoneStyle}>
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
                onPctCommit={showPctComplete && canEditJobPctComplete ? (n) => updateJobPctComplete(j.id, n, j.pct_complete ?? null) : undefined}
                onNoBidValueClick={() => openEdit(j, { fixturesSectionHighlight: true })}
              />
            </div>
            {cardFooterRow(ctx, j, () => setMoreActionsJob(j), showTimeOpen ? formatTimeSince(j.created_at ?? null) : null)}
            {cardNextChip(ctx, j)}
            {cardActivityTeaser(ctx, j)}
            {expanded ? renderCardThreadPanel(props, ctx, j) : null}
          </div>
        )
      })}
      <StagesCardMoreActionsSheet
        open={moreActionsJob != null}
        title={moreActionsJob ? cardMoreActionsTitle(moreActionsJob) : ''}
        subtitle={moreActionsJob ? crewNamesLabel(moreActionsJob) : undefined}
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
  const jobHoursStoryModal = useJobHoursStoryModal()
  const checklistAddModal = useChecklistAddModal()
  const shareJob = useShareJob()
  const [moreActionsRow, setMoreActionsRow] = useState<(typeof rows)[number] | null>(null)
  const ctx: StagesRowRenderContext = {
    openJobHoursStory: jobHoursStoryModal?.openJobHoursStory,
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
    openJobActivityExpand: props.openJobActivityExpand,
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
      items.push({ key: 'click-tooling', label: 'Plumbing Tooling report', onClick: () => openInExternalBrowser(buildClickToolingUrl(j)) })
    }
    if ((j.job_address ?? '').trim()) {
      items.push({ key: 'maps', label: 'Google Maps', onClick: () => openInExternalBrowser(googleMapsSearchUrl(j.job_address)) })
    }
    // Demoted from the always-visible icon rail (zoned card): the rail is now
    // call + ⋯ only, so these keep their labeled homes here.
    if (ctx.canOpenJobScheduleModal) {
      items.push({ key: 'assign-work', label: 'Assign work', onClick: () => ctx.openQuickAssignForJob(j) })
    }
    if (showTaskDispatchButton(ctx.authRole)) {
      items.push({
        key: 'dispatch-note',
        label: 'Send to Dispatch',
        onClick: () =>
          ctx.dispatchTaskModal?.openDispatchModal({
            reference: {
              source: 'job',
              id: j.id,
              hcp_number: j.hcp_number ?? '',
              click_number: j.click_number ?? null,
              job_name: j.job_name ?? '',
              job_address: j.job_address ?? '',
              service_type_id: j.service_type_id ?? null,
              service_type_name: j.serviceType?.name ?? null,
            },
          }),
      })
    }
    items.push({
      key: 'send-task',
      label: 'Send as task',
      onClick: () => {
        const numLabel = effectiveJobLedgerNumber(j.hcp_number, j.click_number)
        const label = `${(numLabel ?? '').trim() || '—'} · ${(j.job_name ?? '').trim() || 'Job'}`
        ctx.checklistAddModal?.openAddModal({
          preset: {
            title: `{{1:${label}}} — `,
            links: [`${window.location.origin}/jobs?jobDetail=${encodeURIComponent(j.id)}`],
          },
        })
      },
    })
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
              ...(row.kind === 'invoice' ? { ...stagesInvoiceRowAccentRowStyle, ...stagesInvoiceRowAccentRailStyle } : {}),
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
              <div style={cardTitleRowWithChipStyle}>
                {renderStagesJobHcpChip(j, cardTitleChipStyle)}
                <div style={{ minWidth: 0, flex: 1 }}>{renderStagesOpenDetailJobName(j)}</div>
              </div>
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
            {renderJobCustomerAndAddressLine(ctx, j)}
            {noteLine ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{noteLine}</div> : null}
            <div style={cardMoneyZoneStyle}>
              {/* Invoice context only when the Billed/Left legend can't carry it:
                  a standalone #N row, a multi-invoice job, or unbilled remainder.
                  The single-invoice/zero-remaining case was pure repetition. */}
              {inv && (row.kind === 'invoice' || (j.invoices?.length ?? 0) > 1 || (showRemaining && jobBillingUnallocatedDollars(j) > 0)) ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-700)' }}>
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
                onPctCommit={canEditJobPctComplete ? (n) => updateJobPctComplete(j.id, n, j.pct_complete ?? null) : undefined}
                onNoBidValueClick={() => openEdit(j, { fixturesSectionHighlight: true })}
              />
              {props.billedExpectedPayChip?.(row)}
              {inv ? cardStripeEmailedHint(ctx, j, inv) : null}
            </div>
            {cardFooterRow(ctx, j, () => setMoreActionsRow(row), showTimeOpen ? formatTimeSince(j.created_at ?? null) : null)}
            {cardNextChip(ctx, j)}
            {cardActivityTeaser(ctx, j)}
            {expanded ? renderCardThreadPanel(props, ctx, j) : null}
          </div>
        )
      })}
      <StagesCardMoreActionsSheet
        open={moreActionsRow != null}
        title={moreActionsRow ? cardMoreActionsTitle(moreActionsRow.job) : ''}
        subtitle={moreActionsRow ? crewNamesLabel(moreActionsRow.job) : undefined}
        actions={moreActionsRow ? moreActionsForRow(moreActionsRow) : []}
        onClose={() => setMoreActionsRow(null)}
      />
    </div>
  )
}
