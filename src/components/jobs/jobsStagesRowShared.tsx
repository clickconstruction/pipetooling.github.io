import type { CSSProperties, ReactNode } from 'react'
import type { JobCrewPosition } from '../../lib/jobs/jobCrewPosition'
import { customerListImpliesLinkedRow } from '../../lib/jobs/customerLinkHeuristics'
import { Link, type NavigateFunction } from 'react-router-dom'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import type { JobCalendarJobIdentity } from '../../lib/jobCalendarModal'
import { type StagesUpcomingAppointment } from '../../lib/stagesUpcomingSchedule'
import { type StagesWeekSoFar } from '../../lib/stagesWorkedDays'
import { scheduleTodayDateKey } from '../../lib/jobScheduleChicago'
import {
  buildTwoWeekStrip,
  stripWeeks,
  deriveStagesWhen,
  describeStagesWhen,
  type StagesWhen,
} from '../../lib/jobs/stagesScheduleStrip'
import { getBidServiceTypeTag } from '../../utils/unifiedJobBidSearch'
import AccountManIcon from '../icons/AccountManIcon'
import { ACCOUNT_MAN_RELATIONSHIP_LABELS, ACCOUNT_MAN_RELATIONSHIP_SHORT, buildAccountManDisplay, type AccountManDisplay } from '../../lib/jobs/accountMan'
import { formatAddressTwoLines, googleMapsSearchUrl } from '../../lib/jobs/jobAddressUrls'
import { JobAddressText } from './JobAddressText'
import PropertyKindBadge from './PropertyKindBadge'
import { StagesSearchMark } from './StagesSearchMark'
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
import OwnerShareChip from './OwnerShareChip'
import DevelopmentHouseIcon from '../icons/DevelopmentHouseIcon'
import { contractRowChipForJob, type ContractRowChip } from '../../lib/jobs/contractRowChip'
import type { LegalMatterRow } from '../../lib/legal/legalMatters'
import type { JobContractCoverage } from '../../lib/jobs/jobContractCoverage'
import { seeAllDoorWords } from '../../lib/jobs/stagesRowDoors'

type CustomerRow = Database['public']['Tables']['customers']['Row']

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
  /** Opens the customer profile modal (v2.1322); optional — surfaces without the provider omit it. `view` names Profile or Timeline (punch list #97). */
  openCustomerProfile?: (customerId: string, options?: { view?: 'profile' | 'timeline' }) => void
  /**
   * Opens the job work-story modal from the man-hours chip (v2.1766); optional like openCustomerProfile.
   * Since v2.4324 the chip is the row's one door to time: `onOpenSessionNotes` puts a Session notes link in the window's header.
   */
  openJobHoursStory?: (target: { jobId: string; hcpNumber: string | null; clickNumber?: string | null; jobName: string | null; onOpenSessionNotes?: (() => void) | null }) => void
  stagesManHoursByJobId: Map<string, number>
  stagesManHoursLoading: boolean
  /** v2.3419: where the crew is per job (`useJobCrewPositions`); empty until the feed answers. */
  crewByJobId: ReadonlyMap<string, JobCrewPosition>
  stagesLaborBreakdownByJobId: Map<string, Array<{ personName: string; hours: number }>>
  expandedJobThreadId: string | null
  toggleStagesJobThreadExpanded: (id: string) => void
  jobThreadStatsByJobId: ReturnType<typeof useJobThreadNotes>['jobThreadStatsByJobId']
  jobThreadActivityByJobId: ReturnType<typeof useJobThreadNotes>['jobThreadActivityByJobId']
  openJobThreadFullscreen: (jobId: string) => void
  /** Opens the full-page Job activity modal (the activity box's expand view). */
  openJobActivityExpand: (job: JobWithDetails) => void
  /** v2.3197: the activity box's report pill — opens New Report preselected on this job. Absent = no pill. */
  openNewReportForJob?: (job: JobWithDetails) => void
  /**
   * Opens the Pipeline "Session notes" view pinned to this job — since v2.4324
   * from the work-story window's header, reached by the man-hours chip (the
   * row's Sessions link is gone). Null/absent when the viewer's role can't open
   * it — the tables read it from `SessionNotesOpenerContext`.
   */
  openSessionNotesForJob?: ((job: JobWithDetails) => void) | null
  openJobCalendar: (job: JobWithDetails) => void
  stagesUpcomingByJobId: Record<string, StagesUpcomingAppointment>
  /** The week so far per job — days worked (the strip's ✓ cells) and days booked before today (v2.3785). */
  stagesWorkedByJobId: Record<string, StagesWeekSoFar>
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
  /** Each job's property kind ('' | residential | non_residential) for the address badge (v2.4160); null/absent while unread → no badge. */
  propertyKindByJobId?: ReadonlyMap<string, string> | null
  /** A kind picked from the badge: the board records it at once (the property row is already saved). */
  onPropertyKindSaved?: (customerAddressId: string, kind: string) => void
  /** Properties linked from the badge since the board loaded (v2.4212): job id → customer_addresses id; the row's own column wins once it reloads. */
  propertyLinkByJobId?: ReadonlyMap<string, string> | null
  /** An unlinked job's pick saved (or reused) a property and linked the job: the board remembers both at once. */
  onPropertyLinked?: (jobId: string, customerAddressId: string, kind: string) => void
  /** Legal portal PR 2 (v2.3313): the legal matter a Collections job belongs to — the ⚖ chip beside the contract chip. */
  legalMatterByJobId?: ReadonlyMap<string, LegalMatterRow>
  /**
   * Opens the job's Contract modal (PR 2); absent = the chip is a plain label. Since v2.4342 the chip
   * says which door it is (`contractRowChip`): `gc-paper` opens Add the contract on the GC's jobs.
   */
  onOpenJobContract?: (job: JobWithDetails, opens?: ContractRowChipOpens) => void
}

type ContractRowChipOpens = Extract<ContractRowChip, { show: true }>['opens']

/**
 * The row's contract chip (v2.4342): what it says and which door it opens, from the same feeds the
 * strip reads. Null when the viewer cannot see contracts; `{ show: false }` on a Paid in Full row.
 */
export function stagesContractChipFor(
  ctx: Pick<StagesRowRenderContext, 'jobContractCoverageByJobId' | 'stagesUpcomingByJobId' | 'stagesWorkedByJobId'>,
  job: JobWithDetails,
): ContractRowChip | null {
  const coverage = ctx.jobContractCoverageByJobId
  if (!coverage) return null
  return contractRowChipForJob(job, {
    coverage: coverage.get(job.id),
    upcoming: ctx.stagesUpcomingByJobId[job.id] ?? null,
    weekSoFar: ctx.stagesWorkedByJobId?.[job.id] ?? null,
    todayYmd: scheduleTodayDateKey(),
  })
}


/**
 * Minimum width for both Stages tables (JobsStagesTable + JobsStagesUnifiedTable).
 * They use table-layout: fixed with a colgroup whose sized columns total 596px
 * (14rem + 14.5rem + 140px — the Progress & payment column widened to 14.5rem in
 * v2.3462 so its legend never wraps; Crew & Dates widened from 9rem in v2.4128 so
 * the names, the strip and the DONE / BILL lines stop wrapping into a twelve-line
 * stack); the single flexible column (Job — the Activity column was removed in
 * v2.1555) takes all of the remaining `minWidth − 596` and keeps growing as the
 * page widens. 880 keeps the Job column ≥ ~284px at the floor (the table scrolls
 * sideways inside its own wrapper on phones instead).
 */
export const STAGES_TABLE_MIN_WIDTH = 880

/**
 * The open row (v2.4131): when a job's notes thread is expanded under it, the row
 * and the thread row beneath read as one card — a 3 px bar in the link blue down
 * the left edge (an inset shadow, so nothing shifts) and a faint blue tint on
 * both, with no rule between them. Blue means "you opened this"; the amber
 * flash (`stagesJobFlashId`) keeps meaning "we scrolled you here".
 */
export const STAGES_OPEN_ROW_BAR = 'inset 3px 0 0 var(--text-link)'

export const stagesOpenRowStyle: CSSProperties = {
  backgroundColor: 'var(--bg-blue-tint)',
  boxShadow: STAGES_OPEN_ROW_BAR,
  borderBottom: 'none',
  transition: 'background-color 150ms ease',
}

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

/** The three-state "when" for a row: what is next, when the plan ends, or why nothing is booked (v2.3752). */
export function stagesWhenForJob(ctx: Pick<StagesRowRenderContext, 'stagesUpcomingByJobId'>, job: JobWithDetails): StagesWhen {
  return deriveStagesWhen({
    upcoming: ctx.stagesUpcomingByJobId[job.id] ?? null,
    lastWorkDate: job.last_work_date,
    lastScheduleWorkDate: job.last_schedule_work_date ?? null,
    pctComplete: job.pct_complete,
    status: job.status,
    todayYmd: scheduleTodayDateKey(),
  })
}

/**
 * The two-week strip itself — ten weekday cells (this week · next week),
 * booked days filled, today outlined, weekday letters under it — as one
 * button into the Job Calendar. Each week is its own run of cells with a real
 * gap between the two (v2.4042). Both desktop tables (10 px cells, inside the
 * 14rem Crew & Dates column; 12 px cells since v2.4128) and the phone card (11 px) draw it.
 */
export function renderStagesScheduleStripCells(
  ctx: Pick<StagesRowRenderContext, 'stagesUpcomingByJobId' | 'stagesWorkedByJobId' | 'openJobCalendar'>,
  job: JobWithDetails,
  when: StagesWhen,
  opts: { cellPx: number; extraTitle?: string | null; /** Air above the strip (v2.4145): the desktop cell's chip sat on the top row of cells. */ marginTop?: string },
) {
  const up = ctx.stagesUpcomingByJobId[job.id]
  const soFar = ctx.stagesWorkedByJobId?.[job.id]
  const workedDays = soFar?.worked ?? []
  const strip = buildTwoWeekStrip({
    todayYmd: scheduleTodayDateKey(),
    bookedYmds: [...(soFar?.bookedYmds ?? []), ...(up?.bookedYmds ?? [])],
    workedYmds: workedDays.map((d) => d.ymd),
  })
  const weeks = stripWeeks(strip.cells)
  const words = describeStagesWhen(when)
  const later = strip.laterCount > 0 ? ` +${strip.laterCount} more day${strip.laterCount === 1 ? '' : 's'} after next week.` : ''
  const workedWords = strip.cells
    .filter((c) => c.worked || c.missed)
    .map((c) => {
      const day = workedDays.find((d) => d.ymd === c.ymd)
      return c.worked ? `${c.letter} ${c.ymd.slice(5)} ✓ ${day?.names.join(', ') ?? ''}` : `${c.letter} ${c.ymd.slice(5)} booked, nobody clocked`
    })
  const workedLine = workedWords.length ? ` ${workedWords.join(' · ')}.` : ''
  const title = `${words}.${later}${workedLine}${opts.extraTitle ? ` ${opts.extraTitle}` : ''} Click to open the job calendar.`
  return (
    <button
      type="button"
      className="stagesStrip"
      style={{ '--strip-cell': `${opts.cellPx}px`, ...(opts.marginTop ? { marginTop: opts.marginTop } : {}) } as CSSProperties}
      title={title}
      aria-label={`Schedule strip — ${words}. Open the job calendar.`}
      onClick={(e) => {
        e.stopPropagation()
        ctx.openJobCalendar(job)
      }}
    >
      <span className="stagesStripCells" aria-hidden>
        {weeks.map((week) => (
          <span key={week[0]!.ymd} className="stagesStripWeek">
            {week.map((c) => (
              <i
                key={c.ymd}
                className={[
                  c.booked ? 'isBooked' : '',
                  c.worked ? 'isWorked' : '',
                  c.missed ? 'isMissed' : '',
                  c.today ? 'isToday' : '',
                  c.past ? 'isPast' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {c.worked ? '✓' : ''}
              </i>
            ))}
          </span>
        ))}
      </span>
      <span className="stagesStripLetters" aria-hidden>
        {weeks.map((week) => (
          <span key={week[0]!.ymd} className="stagesStripWeek">
            {week.map((c) => (
              <span key={c.ymd}>{c.letter}</span>
            ))}
          </span>
        ))}
      </span>
    </button>
  )
}

/**
 * The address under the job name, a Google Maps link; since v2.4160 the
 * property-kind badge (C / R / ?) sits at the end of its last line. The block
 * flows inline with a hanging indent (the pin hangs in the gutter, every line
 * of text aligns under the first), so the badge lands right after the last
 * word — "Hondo, TX (?)" — instead of at the edge of the widest line (v2.4210).
 * It stays a sibling of the link, never a button inside the anchor.
 */
export function renderJobAddressWithMap(
  ctx: Pick<StagesRowRenderContext, 'propertyKindByJobId' | 'onPropertyKindSaved' | 'propertyLinkByJobId' | 'onPropertyLinked' | 'authRole' | 'showToast'>,
  job: Pick<JobWithDetails, 'id' | 'job_address' | 'customer_address_id' | 'customer_id' | 'customer_name' | 'gc_customer_id' | 'gcCustomer' | 'hcp_number' | 'job_name'>,
) {
  const address = job.job_address
  const fmt = formatAddressTwoLines(address ?? null)
  if (!fmt) return null
  return (
    <div
      style={{
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        marginTop: '0.15rem',
        // hanging indent: the 12px pin + its gap sit left of the text column
        paddingLeft: 'calc(12px + 0.3rem)',
        textIndent: 'calc(-12px - 0.3rem)',
        // an unsplit one-liner that must wrap breaks into even lines instead
        // of orphaning "TX" (was on the text span while it was a flex item)
        textWrap: 'balance',
      }}
    >
      <a
        href={googleMapsSearchUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in Google Maps"
        style={{ color: 'inherit', textDecoration: 'none' }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 640 640"
          width={12}
          height={12}
          fill="currentColor"
          aria-hidden="true"
          style={{ verticalAlign: -1, marginRight: '0.3rem', color: 'var(--text-red-600)' }}
        >
          <path d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z" />
        </svg>
        <JobAddressText line1={fmt.line1} line2={fmt.line2} />
      </a>
      <PropertyKindBadge
        // The property's home is the customer, else the GC (v2.4222) — the fallback Edit Job's Property record row uses; a GC job with no owner still gets its badge.
        job={{
          ...job,
          customer_address_id: job.customer_address_id ?? ctx.propertyLinkByJobId?.get(job.id) ?? null,
          customer_id: job.customer_id ?? job.gc_customer_id ?? null,
          customer_name: job.customer_id ? job.customer_name : (job.gcCustomer?.name ?? null),
        }}
        kind={ctx.propertyKindByJobId?.get(job.id)}
        role={ctx.authRole}
        onSaved={(addressId, kind) => ctx.onPropertyKindSaved?.(addressId, kind)}
        onLinked={(addressId, kind, reused) => {
          ctx.onPropertyLinked?.(job.id, addressId, kind)
          const who = ((job.customer_id ? job.customer_name : job.gcCustomer?.name) ?? '').trim() || 'the customer'
          ctx.showToast(reused ? `Linked to ${who}'s saved property and marked ${kind === 'residential' ? 'residential' : 'commercial'}` : `Saved as a property on ${who} and marked ${kind === 'residential' ? 'residential' : 'commercial'}`, 'success', 3500)
        }}
        onError={(m) => ctx.showToast(m, 'error')}
      />
    </div>
  )
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

/**
 * The GC's name on a row (punch list #97, PR 3): a door to the GC's timeline, where every job
 * they are the GC on sits on one spine. Plain text where the window cannot open.
 */
function renderGcTimelineDoor(job: JobWithDetails, gcName: string, ctx: StagesRowRenderContext) {
  const gcId = job.gcCustomer?.id
  if (!gcId || !ctx.openCustomerProfile) {
    return (
      <span>
        <StagesSearchMark text={gcName} />
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        ctx.openCustomerProfile?.(gcId, { view: 'timeline' })
      }}
      title="Open the GC's timeline"
      aria-label={`Open the timeline for ${gcName}`}
      style={{ display: 'inline', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', textAlign: 'left' }}
    >
      <StagesSearchMark text={gcName} />
    </button>
  )
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
          flow instead — same affordance, honest destination. The line flows
          as text (v2.4151): a long name wraps and the 🌐 + owner-sees chip
          follow its last word, instead of floating beside a two-line block. */}
      <span style={{ display: 'inline' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (job.customer_id) ctx.openCustomerProfile?.(job.customer_id)
          else openEditJobAndCreateCustomerFlow(job)
        }}
        title={job.customer_id ? 'Open customer profile' : 'Link or create this customer'}
        aria-label={job.customer_id ? `Open customer profile for ${cn || 'customer'}` : `Link or create customer ${cn || ''}`.trim()}
        style={{ display: 'inline', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', textAlign: 'left' }}
      >
        <CustomerContactCardIcon size={13} style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '0.3rem' }} />
        <span style={{ textDecoration: job.customer_id ? 'underline dotted' : 'none', textUnderlineOffset: 2 }}>{cn ? <StagesSearchMark text={cn} /> : '—'}</span>
      </button>
      {job.customer_id ? (
        // One inline unit after the name's last word: the 🌐 (portal train PR 4, office-only, renders null otherwise)
        // and the owner-sees chip (v2.3827: only on a GC-billed job whose customer is the owner; renders null otherwise).
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', verticalAlign: 'middle', marginLeft: '0.15rem' }} data-testid="customer-line-tail">
          <CustomerPortalGlobeButton customerId={job.customer_id} customerName={cn || 'Customer'} size={13} />
          <OwnerShareChip job={job} invoices={job.invoices ?? []} ownerName={cn || 'The owner'} gcName={gcName} role={ctx.authRole} onChanged={() => void ctx.loadJobs()} onError={(m) => ctx.showToast(m, 'error')} />
        </span>
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
              {renderGcTimelineDoor(job, gcName, ctx)}
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
              {renderGcTimelineDoor(job, gcName, ctx)}
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

/**
 * The row's door into the job's notes and reports where there is no activity
 * box: under 1100 px, on standalone bill rows and on the phone cards (v2.4324;
 * it was the "N Reports" pill, which opened the same window as the box's
 * See all, plus a Sessions link the man-hours chip now carries). Same words as
 * the box's door (`seeAllDoorWords`): quiet *See all* text, bordered blue with
 * the count when the job has reports, so a row with field reports still stands
 * out (v2.1475). Billed merged rows draw it higher in the Job column (v2.1155).
 */
export function renderStagesSeeAllButton(ctx: StagesRowRenderContext, job: JobWithDetails) {
  const reports = job.report_count ?? 0
  const hasReports = reports > 0
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 2, flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => ctx.openJobActivityExpand(job)}
        title="Open every note and report on this job"
        aria-label="Expand job activity"
        data-stages-see-all=""
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '0.2rem 0.5rem',
          fontSize: '0.75rem',
          background: 'none',
          color: hasReports ? 'var(--text-link)' : 'var(--text-muted)',
          border: hasReports ? '1px solid #2563eb' : '1px solid transparent',
          borderRadius: 4,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9.5 2.5h4v4" />
          <path d="M13.5 2.5 9 7" />
          <path d="M6.5 13.5h-4v-4" />
          <path d="M2.5 13.5 7 9" />
        </svg>
        {seeAllDoorWords(null, reports)}
      </button>
    </div>
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

/** v2.4147: Send back / Collections under the action column's icons — stacked and centred; since v2.4155 each is only as wide as its words, so nothing abuts the card's edge. */
export const stagesActionMoveStackStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center', width: '100%', marginTop: '0.25rem' }
