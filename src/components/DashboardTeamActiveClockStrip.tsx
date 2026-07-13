import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import {
  JOBS_WORKED_TODAY_UNASSIGNED_ID,
  type ClockedInTodayStripRow,
  type JobsWorkedTodayStripRow,
  type TodaySessionStripRow,
} from '../hooks/useDashboardMyTeamSectionState'
import { approveClockSessions } from '../lib/approveClockSessions'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { denverCalendarDayKey } from '../utils/dateUtils'
import { useUserReviewModal } from '../contexts/UserReviewModalContext'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { useIntervalNowMs } from '../hooks/useIntervalNowMs'
import { useMatchMedia } from '../hooks/useMatchMedia'
import {
  AssignSessionJobPopover,
  type AssignSessionJobSavedPatch,
} from './clock-sessions/AssignSessionJobPopover'
import type { DispatchScheduledJobForAssign } from '../lib/jobScheduleBlocks'
import { StripClockTimeMapButton } from './clock-sessions/StripClockTimeMapButton'
import {
  ClockSessionStripActionsModal,
  type ClockSessionStripActionsPayload,
} from './ClockSessionStripActionsModal'
import {
  ClockSessionStripApproveControl,
  deriveClockSessionStripApproveStatus,
  type ClockSessionStripApproveStatus,
} from './ClockSessionStripApproveControl'
import {
  formatClockSessionJobOrBidLabel,
  formatClockSessionJobOrBidLabelFromEmbeds,
  formatClockSessionJobOrBidModalLinesFromEmbeds,
  shortJobOrBidLabelFromEmbeds,
  type ClockSessionRow,
  type DashboardStripSession,
  isSyntheticSalaryStripSession,
  shouldShowSalaryStripNameSuffix,
} from '../types/clockSessions'
import { effectiveJobLedgerNumber, type LedgerPrefixMap } from '../lib/ledgerDisplayPrefixes'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { CopyDayJobMixModal, CopyDayJobMixIcon } from './day-job-mix/CopyDayJobMixModal'
import { ScheduleDayEmailModal } from './ScheduleDayEmailModal'
import { JobsWorkedTodayReportIcon } from './icons/JobsWorkedTodayReportIcon'
import ReportViewModal, { type ReportForView } from './ReportViewModal'
import { reportForViewFromJobLedgerRow, type ReportForJobLedgerRow } from '../lib/reportForViewFromJobLedgerRow'
import { useAuth } from '../hooks/useAuth'

const EMPTY_JOBS_WORKED_TODAY_REPORT_KEYS: ReadonlySet<string> = new Set<string>()
const EMPTY_JOBS_WORKED_TODAY_REPORT_ID_BY_KEY: ReadonlyMap<string, string> = new Map<string, string>()

const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }

function findTodaySessionInStrip(
  rows: readonly ClockedInTodayStripRow[],
  sessionId: string,
): TodaySessionStripRow | undefined {
  for (const row of rows) {
    const t = row.todaySessions.find((x) => x.id === sessionId)
    if (t) return t
  }
  return undefined
}

/** Merge server-derived status with post-approve optimistic ids (until refetch sets approved_at). */
function stripApproveStatusForSession(
  s: Pick<TodaySessionStripRow, 'id' | 'clocked_out_at' | 'approved_at'>,
  optimisticIds: ReadonlySet<string>,
): ClockSessionStripApproveStatus {
  const derived = deriveClockSessionStripApproveStatus(s.clocked_out_at, s.approved_at)
  if (derived === 'open') return 'open'
  if (derived === 'approved') return 'approved'
  if (optimisticIds.has(s.id)) return 'approved'
  return 'pending'
}

/** For focused-row filter (Option B): same merge as strip UI so optimistic approve drops the row from the list. */
function stripSessionIsPendingApprovalMerged(
  s: Pick<TodaySessionStripRow, 'id' | 'clocked_out_at' | 'approved_at'>,
  optimisticIds: ReadonlySet<string>,
): boolean {
  return stripApproveStatusForSession(s, optimisticIds) === 'pending'
}

/** Visible / a11y label for the clocked-in-today strip row; keeps the viewer’s row identifiable. */
function stripClockedInTodayDisplayLabel(
  row: Pick<ClockedInTodayStripRow, 'userId' | 'displayName'>,
  authUserId: string | undefined,
): string {
  if (authUserId != null && row.userId === authUserId) {
    return `You · ${row.displayName}`
  }
  return row.displayName
}

function stripRowHasPendingApprovalMerged(
  row: ClockedInTodayStripRow,
  optimisticIds: ReadonlySet<string>,
): boolean {
  return row.todaySessions.some((s) => stripSessionIsPendingApprovalMerged(s, optimisticIds))
}

/**
 * Split (or multi-block) salary day: completed salary block(s), nothing open — e.g. gap between
 * morning and afternoon sessions. Keeps the person visible under the default "missing" filter.
 */
function stripRowHasClosedSalaryScheduleNoOpenSession(row: ClockedInTodayStripRow): boolean {
  const active = row.todaySessions.filter((s) => !s.rejected_at && !s.revoked_at)
  if (active.length === 0) return false
  if (active.some((s) => s.clocked_out_at == null)) return false
  return active.some((s) => s.origin === 'salary_schedule')
}

function stripRowInFocusedClockedInView(
  row: ClockedInTodayStripRow,
  optimisticIds: ReadonlySet<string>,
): boolean {
  return (
    stripRowHasUnassignedSession(row) ||
    stripRowHasPendingApprovalMerged(row, optimisticIds) ||
    stripRowHasClosedSalaryScheduleNoOpenSession(row)
  )
}

function stripActionsPayloadFromSession(
  s: TodaySessionStripRow,
  personName: string,
  timeRangeLabel: string,
  stripStatus: 'pending' | 'approved',
  prefixMap: LedgerPrefixMap,
): ClockSessionStripActionsPayload {
  const hasJobOrBid = !!(s.job_ledger_id || s.bid_id)
  const fromEmbeds = formatClockSessionJobOrBidLabelFromEmbeds(s, prefixMap)
  const assignmentLabel =
    fromEmbeds ?? (s.job_ledger_id ? 'Job linked' : s.bid_id ? 'Bid linked' : null)
  const assignmentShortLabel = shortJobOrBidLabelFromEmbeds(s, prefixMap) ?? assignmentLabel
  const modalLines = formatClockSessionJobOrBidModalLinesFromEmbeds(s, prefixMap)
  const assignmentModalLine1 =
    modalLines?.line1 ?? (s.job_ledger_id ? 'Job linked' : s.bid_id ? 'Bid linked' : null)
  const assignmentModalLine2 = modalLines?.line2 ?? null
  return {
    sessionId: s.id,
    personName,
    timeRangeLabel,
    stripStatus,
    hasJobOrBid,
    notes: s.notes ?? null,
    job_ledger_id: s.job_ledger_id,
    bid_id: s.bid_id,
    assignmentLabel,
    assignmentShortLabel,
    assignmentModalLine1,
    assignmentModalLine2,
    jobEditHref: s.job_ledger_id
      ? `/jobs?edit=${encodeURIComponent(s.job_ledger_id)}`
      : null,
    bidEditHref: s.bid_id
      ? `/bids?bidId=${encodeURIComponent(s.bid_id)}&tab=submission-followup`
      : null,
  }
}

/** When session row is missing from merged data, ensure newer payload fields exist. */
function normalizeStripActionsPayloadFallback(
  stripActionsSession: ClockSessionStripActionsPayload,
): ClockSessionStripActionsPayload {
  const assignmentLabel =
    stripActionsSession.assignmentLabel ??
    (stripActionsSession.job_ledger_id ? 'Job linked' : stripActionsSession.bid_id ? 'Bid linked' : null)
  const assignmentModalLine1 =
    stripActionsSession.assignmentModalLine1 ??
    stripActionsSession.assignmentShortLabel ??
    assignmentLabel
  return {
    ...stripActionsSession,
    assignmentLabel,
    assignmentShortLabel:
      stripActionsSession.assignmentShortLabel ??
      stripActionsSession.assignmentLabel ??
      assignmentLabel,
    assignmentModalLine1,
    assignmentModalLine2: stripActionsSession.assignmentModalLine2 ?? null,
    jobEditHref:
      stripActionsSession.jobEditHref ??
      (stripActionsSession.job_ledger_id
        ? `/jobs?edit=${encodeURIComponent(stripActionsSession.job_ledger_id)}`
        : null),
    bidEditHref:
      stripActionsSession.bidEditHref ??
      (stripActionsSession.bid_id
        ? `/bids?bidId=${encodeURIComponent(stripActionsSession.bid_id)}&tab=submission-followup`
        : null),
  }
}

function personName(s: DashboardStripSession): string {
  return s.users?.name?.trim() ?? 'Unknown'
}

function stripPersonDisplayName(s: TodaySessionStripRow): string {
  return s.users?.name?.trim() || `User (${s.user_id.slice(-6)})`
}

/** One-line compact label for the strip table (full address in title via formatClockSessionJobOrBidLabel). */
function shortJobOrBidLabel(s: ClockSessionRow, prefixMap: LedgerPrefixMap): string | null {
  return shortJobOrBidLabelFromEmbeds(s, prefixMap)
}

/** Same second math as useDashboardMyTeamSectionState sessionDurationSeconds (aligns with Today totals). */
function sessionDurationSeconds(clockedIn: string, clockedOut: string | null, nowMs: number): number {
  const inMs = new Date(clockedIn).getTime()
  const outMs = clockedOut ? new Date(clockedOut).getTime() : nowMs
  return Math.max(0, Math.floor((outMs - inMs) / 1000))
}

function formatDurationFromSeconds(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** Elapsed since clock-in for an open session, using `nowMs` instead of Date.now() for testability and tick alignment. */
function formatElapsedOpen(clockedInAt: string, nowMs: number): string {
  return formatDurationFromSeconds(sessionDurationSeconds(clockedInAt, null, nowMs))
}

const STRIP_CLOCK_OVERLAP_TITLE =
  'Clock intervals overlap today — open Edit time to fix'

function StripClockOverlapBadge() {
  return (
    <span
      role="status"
      title={STRIP_CLOCK_OVERLAP_TITLE}
      aria-label="Clock intervals overlap today; open Edit time to fix"
      style={{
        fontSize: '0.6rem',
        fontWeight: 700,
        color: 'var(--text-amber-800)',
        background: 'var(--bg-amber-tint)',
        border: '1px solid #f59e0b',
        borderRadius: 3,
        padding: '1px 4px',
        lineHeight: 1.2,
        flexShrink: 0,
      }}
    >
      Overlap
    </span>
  )
}

const srOnly: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

const th = {
  padding: '0.25rem 0.4rem',
  textAlign: 'left' as const,
  borderBottom: '1px solid var(--border)',
  fontWeight: 600,
  fontSize: '0.75rem',
  color: 'var(--text-700)',
}
const td = {
  padding: '0.2rem 0.4rem',
  fontSize: '0.75rem',
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'middle' as const,
}

const stripSalaryNameSuffix: CSSProperties = {
  fontSize: '0.68rem',
  color: 'var(--text-faint)',
  fontWeight: 400,
  flexShrink: 0,
}

/** “Currently in” name + optional (s): keep the salary suffix on the same line (mobile: avoid a lone (s) below a full-width name button). */
const stripCurrentlyInNameWithSuffix: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  flexWrap: 'nowrap',
  columnGap: '0.15rem',
  minWidth: 'max-content',
}

/** First column of the “Currently in” table: intrinsic width includes full name + optional (s). */
const stripCurrentlyInFirstCol: CSSProperties = {
  minWidth: 'max-content',
}

/** Match ClockInOutButton enabled fill (`#ff6600`). */
const STRIP_SECTION_HEAD_BG = '#ff6600'
const STRIP_SECTION_HEAD_TEXT = '#ffffff'
/** Per-cell bottom edge (avoid border-collapse dropping the soft line under the first column). */
const STRIP_SECTION_HEAD_BOTTOM_EDGE = 'inset 0 -1px 0 0 rgba(255,255,255,0.22)'

/** Canonical 0.75rem for strip summary cells (`Today`, `hours | clock-in`). */
const STRIP_SUMMARY_CELL_FONT_REM = '0.75rem' as const

/** Orange strip bar titles and column labels — explicit parity (incl. iOS PWA). */
const stripOrangeHeaderTypography: CSSProperties = {
  fontSize: STRIP_SUMMARY_CELL_FONT_REM,
  fontWeight: 600,
  color: STRIP_SECTION_HEAD_TEXT,
  lineHeight: 1.2,
  fontFamily: 'inherit',
  WebkitTextSizeAdjust: '100%',
}

/** White chevron on orange bar (same sizing as adjacent header text). */
const stripOrangeBarChevronButton: CSSProperties = {
  ...stripOrangeHeaderTypography,
  border: 'none',
  background: 'none',
  padding: '0.1rem',
  cursor: 'pointer',
}

/** Expand chevron on neutral body rows — same metrics as orange bar chevrons. */
const stripBodyExpandChevronButton: CSSProperties = {
  ...stripOrangeBarChevronButton,
  color: 'var(--text-700)',
}

const stripOrangeHeaderTitleButton: CSSProperties = {
  ...stripOrangeHeaderTypography,
  border: 'none',
  background: 'none',
  padding: 0,
  margin: 0,
  cursor: 'pointer',
}

/** Hours total in Currently In “Today” cell and Clocked “Today | First clock-in”. */
const stripClockStripSummaryHoursButton: CSSProperties = {
  border: 'none',
  background: 'none',
  padding: 0,
  margin: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: STRIP_SUMMARY_CELL_FONT_REM,
  fontWeight: 600,
  color: 'var(--text-blue-700)',
  WebkitTextSizeAdjust: '100%',
}

const stripClockStripSummaryHoursReadonly: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: STRIP_SUMMARY_CELL_FONT_REM,
  fontWeight: 600,
  color: 'var(--text-700)',
  WebkitTextSizeAdjust: '100%',
}

/** Pipe + clock time (`| 9:31 AM`) and Currently In “Session | In” fragments. */
const stripClockStripSummaryPipeTime: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: STRIP_SUMMARY_CELL_FONT_REM,
  fontWeight: 400,
  color: 'var(--text-600)',
  WebkitTextSizeAdjust: '100%',
}

const stripSectionTh: CSSProperties = {
  ...th,
  ...stripOrangeHeaderTypography,
  borderBottom: 'none',
  boxShadow: STRIP_SECTION_HEAD_BOTTOM_EDGE,
}

/** Chevron column width; also used to indent expanded session rows under the name column. */
const CLOCKED_IN_TODAY_EXPAND_COL = '1.75rem'

/** Merged CIT+Jobs header: one tight title line in the second column. */
const mergedHeaderTitleCluster: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '0.3em',
  minWidth: 0,
  maxWidth: '100%',
}

/** Narrow viewports: keep merged titles on one row; parent clips → horizontal scroll. */
const mergedJobsHeaderTitlesOverflowWrap: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
}

const JOBS_WORKED_TODAY_COL_SPAN = 2

const clockedInTodayRowTd: CSSProperties = {
  ...td,
  borderBottom: 'none',
}

/** Single session cell: no full-width row border (rule is on shrink-wrapped block). */
const clockedInTodayDetailCell: CSSProperties = {
  padding: '0.1rem 0',
  borderBottom: 'none',
  fontSize: '0.68rem',
  color: 'var(--text-muted)',
  verticalAlign: 'top',
}

/** Typography for clocked-in-today session time range (matches `clockedInTodayDetailCell`). */
const clockedInTodaySessionTimeText: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '0.68rem',
  fontWeight: 400,
  color: 'var(--text-muted)',
  WebkitTextSizeAdjust: '100%',
  whiteSpace: 'nowrap' as const,
  flexShrink: 0,
}

/** Jobs worked today expanded sessions — matches parent `td` (0.7rem grey). */
const jobsWorkedTodaySessionTimeText: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '0.7rem',
  fontWeight: 400,
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap' as const,
  flexShrink: 0,
}

/** Content-width bottom rule under time + job + memo (not full inner table width). */
const clockedInTodaySessionBlock: CSSProperties = {
  display: 'inline-block',
  maxWidth: '100%',
  verticalAlign: 'top',
  borderBottom: '1px solid var(--border)',
  paddingBottom: '0.2rem',
}

/** iOS/WebKit — long-press Session actions must not drag text selection across the dense row / page. */
const stripSessionActionsRowChromeNoSelect: CSSProperties = {
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
}

/** Jobs worked today: one flex row per session (person, times, duration, memo); underline matches content width. */
const jobsWorkedTodaySessionRowShell: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.5rem',
  width: 'fit-content',
  maxWidth: '100%',
  boxSizing: 'border-box',
  borderBottom: '1px solid var(--border)',
  paddingBottom: '0.2rem',
  fontSize: '0.68rem',
  color: 'var(--text-muted)',
  ...stripSessionActionsRowChromeNoSelect,
}

const jobsWorkedTodaySessionList: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.45rem',
  alignItems: 'flex-start',
}

const clockedInTodayDetailLink: CSSProperties = {
  color: 'var(--text-link)',
  textDecoration: 'none',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
}

function formatHoursH(h: number): string {
  return `${h.toFixed(2)}h`
}

const scopeBtn = (active: boolean): CSSProperties => ({
  padding: '0.2rem 0.45rem',
  fontSize: '0.7rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: active ? 'var(--bg-200)' : 'var(--surface)',
  cursor: 'pointer',
  color: 'var(--text-700)',
  fontWeight: active ? 600 : 500,
})

/** Mix + Needs attention / Show all in strip header — same min-height (16px icon vs text line). */
const stripClockedInChromeBtnLayout: CSSProperties = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  minHeight: '1.5rem',
}

const jobBidCellFlex: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  minWidth: 0,
  flexWrap: 'nowrap',
}

/** Currently In — last column: avoid collapse on narrow viewports; parent scrolls horizontally. */
const STRIP_CURRENTLY_IN_JOB_BID_COL_MIN = '14rem'

/** Align with Layout mobile breakpoint; shortens first-column header to "In (n)". */
const STRIP_SHORT_CURRENTLY_IN_HEADER_MQ = '(max-width: 640px)'

/** Job/bid link + focus memo (and unassigned Assign before memo when in strip). */
const jobBidLinkMemoGroup: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  minWidth: 0,
  flex: '1 1 auto',
}

const clockedInTodayJobBidLinkMemoGroup: CSSProperties = {
  ...jobBidLinkMemoGroup,
  flex: '0 1 auto',
}

const jobBidStripLink: CSSProperties = {
  color: 'var(--text-link)',
  textDecoration: 'none',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: '0 1 auto',
  minWidth: 0,
  fontSize: '0.72rem',
}

/**
 * Makes a `<button>` indistinguishable from the existing `<Link>` styling so we can swap
 * the three job links in this strip from `/jobs?edit=...` navigation to in-place
 * `useJobDetailModal()` open (see v2.447). Spread as `{ ...buttonAsLinkReset, ...jobBidStripLink }`.
 */
const buttonAsLinkReset: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
}

/** Session memo (`clocked_sessions.notes`): one typography block for Currently In, Focus, Clocked detail (iOS PWA parity). */
const stripSessionMemoTextStyle: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.72rem',
  fontWeight: 400,
  lineHeight: 1.25,
  fontFamily: 'inherit',
  WebkitTextSizeAdjust: '100%',
}

const stripSessionMemoCellStyle: CSSProperties = {
  ...stripSessionMemoTextStyle,
  flex: '1 1 0',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const STRIP_POPOVER_Z = 1100
/** Session actions dialog (above strip popovers). */
const STRIP_ACTIONS_MODAL_Z = 1150
/** Inner overlays inside strip modals (job search panels if portaled). */
const STRIP_MODAL_INNER_Z = 1170
/** Final reject confirm — above [`STRIP_ACTIONS_MODAL_Z`]. */
const STRIP_REJECT_MODAL_Z = 1280

type StripRejectClockSessionPayload = {
  sessionId: string
  personName: string
  timeRangeLabel: string
}

/** Legacy key; superseded by `DASHBOARD_CLOCK_STRIP_CLOCKED_IN_TODAY_EXPAND_MODE_KEY`. */
const DASHBOARD_CLOCK_STRIP_CLOCKED_IN_TODAY_COLLAPSED_KEY = 'dashboard_clock_strip_clocked_in_today_collapsed'

type ClockedInTodayExpandMode = 'collapsed' | 'unassignedPeek' | 'full'

const DASHBOARD_CLOCK_STRIP_CLOCKED_IN_TODAY_EXPAND_MODE_KEY =
  'dashboard_clock_strip_clocked_in_today_expand_mode'

function isClockedInTodayExpandMode(s: string | null): s is ClockedInTodayExpandMode {
  return s === 'collapsed' || s === 'unassignedPeek' || s === 'full'
}

function readClockedInTodayExpandMode(): ClockedInTodayExpandMode {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(DASHBOARD_CLOCK_STRIP_CLOCKED_IN_TODAY_EXPAND_MODE_KEY)
      if (isClockedInTodayExpandMode(v)) return v
      const legacy = localStorage.getItem(DASHBOARD_CLOCK_STRIP_CLOCKED_IN_TODAY_COLLAPSED_KEY)
      if (legacy === '1') return 'collapsed'
      if (legacy === '0') return 'full'
    }
  } catch {
    /* ignore */
  }
  return 'collapsed'
}

function persistClockedInTodayExpandMode(mode: ClockedInTodayExpandMode): void {
  try {
    localStorage.setItem(DASHBOARD_CLOCK_STRIP_CLOCKED_IN_TODAY_EXPAND_MODE_KEY, mode)
  } catch {
    /* ignore */
  }
}

function cycleClockedInTodayExpandMode(m: ClockedInTodayExpandMode): ClockedInTodayExpandMode {
  if (m === 'collapsed') return 'unassignedPeek'
  if (m === 'unassignedPeek') return 'full'
  return 'collapsed'
}

const DASHBOARD_CLOCK_STRIP_JOBS_WORKED_TODAY_COLLAPSED_KEY =
  'dashboard_clock_strip_jobs_worked_today_collapsed'

/** Default collapsed; expanded only after user opens section (`'0'`). */
function readJobsWorkedTodaySectionCollapsed(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(DASHBOARD_CLOCK_STRIP_JOBS_WORKED_TODAY_COLLAPSED_KEY) !== '0'
    }
  } catch {
    /* ignore */
  }
  return true
}

function persistJobsWorkedTodaySectionCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(DASHBOARD_CLOCK_STRIP_JOBS_WORKED_TODAY_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
}

type ClockedInTodayTableMode = 'all' | 'missing'

function stripRowHasUnassignedSession(row: ClockedInTodayStripRow): boolean {
  return row.todaySessions.some((s) => !s.job_ledger_id && !s.bid_id)
}

/**
 * "Apply Schedule %" eligibility for a Clocked-in-today person: exactly one session that day, which
 * is closed and has no job/bid (parity with the day-editor single-session v1 scope).
 */
function stripRowEligibleForApplyScheduleProportions(row: ClockedInTodayStripRow): boolean {
  if (row.todaySessions.length !== 1) return false
  const only = row.todaySessions[0]!
  return !!only.clocked_out_at && !only.job_ledger_id && !only.bid_id
}

const stripTableHost: CSSProperties = {
  position: 'relative',
}

/** Open clock sessions plus "Clocked in today" summary (Dashboard). Mount when there are open sessions or today rows so the tick interval runs when needed. Omits the "Currently In" table when `sessions` is empty (and `hideCurrentlyInTable` is false). */
export function DashboardTeamActiveClockStrip({
  sessions,
  hoursTodayByUserId,
  clockedInTodayRows,
  jobsWorkedTodayRows = [],
  showScopeToggle = false,
  clockStripScope = 'team',
  clockStripNarrowScopeLabel = 'My team',
  clockStripWideScopeLabel = 'Everyone',
  onClockStripScopeChange,
  showJobBidColumn = false,
  onJobBidSaved,
  onJobBidAssignError,
  onApplyScheduleProportionsForSession,
  onOpenStripMyTimeEditor,
  authUserId,
  canApproveClockSessions,
  onClockSessionsMutated,
  onMaterializeSalarySession,
  hideCurrentlyInTable = false,
  enableCopyDayJobMix = false,
  enableScheduleDayEmail = false,
  clockStripWorkDateYmd,
  jobsWorkedTodayReportKeys = EMPTY_JOBS_WORKED_TODAY_REPORT_KEYS,
  jobsWorkedTodayReportIdByKey = EMPTY_JOBS_WORKED_TODAY_REPORT_ID_BY_KEY,
  jobsWorkedTodayJobLedgerIdsWithReport,
  showAddClockSession = false,
  onAddClockSession,
}: {
  sessions: DashboardStripSession[]
  hoursTodayByUserId: Readonly<Record<string, number>>
  clockedInTodayRows: readonly ClockedInTodayStripRow[]
  jobsWorkedTodayRows?: readonly JobsWorkedTodayStripRow[]
  showScopeToggle?: boolean
  clockStripScope?: 'team' | 'everyone'
  /** Left control (`team` scope); default "My team". */
  clockStripNarrowScopeLabel?: string
  /** Right control (`everyone` scope); default "Everyone". */
  clockStripWideScopeLabel?: string
  onClockStripScopeChange?: (scope: 'team' | 'everyone') => void
  showJobBidColumn?: boolean
  onJobBidSaved?: (patch: AssignSessionJobSavedPatch) => void
  onJobBidAssignError?: (msg: string) => void
  /**
   * People → Hours only: split this person's single closed unassigned session across their Dispatch
   * schedule. When set, the "Clocked in today" Assign popover shows an "Apply Schedule %" action.
   */
  onApplyScheduleProportionsForSession?: (
    session: TodaySessionStripRow,
    picks: DispatchScheduledJobForAssign[],
  ) => void
  /** Dev / master / assistant: open My Time day editor for this person's hours today (company calendar). */
  onOpenStripMyTimeEditor?: (p: { subjectUserId: string; displayName: string }) => void
  /** For `rejected_by` when rejecting from the today strip. */
  authUserId?: string
  /** When true, pending closed sessions show approve / reject controls (RLS still enforces). */
  canApproveClockSessions?: boolean
  /** Refresh today strip + pending after approve/reject. */
  onClockSessionsMutated?: () => void
  /**
   * Materialize `salary_schedule` open session via RPC (when UI shows synthetic schedule row only).
   * After resolve, parent should refetch pending; Assign job/bid becomes available on the real row.
   */
  onMaterializeSalarySession?: (userId: string) => Promise<void>
  /** When true, omit the live open-sessions "Currently In" table (e.g. Quickfill browsing a non-today work date). */
  hideCurrentlyInTable?: boolean
  /** Dev / master / assistant: show copy job-mix mode on Clocked in today. */
  enableCopyDayJobMix?: boolean
  /** Dev / master / assistant: schedule dispatch schedule email for this strip day. */
  enableScheduleDayEmail?: boolean
  /** Strip `work_date` (YYYY-MM-DD), e.g. from my team hook `clockStripWorkDateYmd`. */
  clockStripWorkDateYmd?: string
  /** `(jobLedgerId:userId)` when user filed a report for that job on the strip calendar day. */
  jobsWorkedTodayReportKeys?: ReadonlySet<string>
  /** Latest report id per `${jobLedgerId}:${userId}` on the strip calendar day (for opening the report). */
  jobsWorkedTodayReportIdByKey?: ReadonlyMap<string, string>
  /** `jobLedgerId` when any report exists for that job on the strip calendar day; `null` while loading. */
  jobsWorkedTodayJobLedgerIdsWithReport?: ReadonlySet<string> | null
  /** Show the "+" (add a clock session for a person) button in the header chrome cluster. */
  showAddClockSession?: boolean
  /** Open the parent-owned add-clock-session modal (with person picker). */
  onAddClockSession?: () => void
}) {
  const { role: viewerRole } = useAuth()
  const prefixMap = useLedgerPrefixMap()
  const clockStripWorkDateResolved =
    clockStripWorkDateYmd ?? new Date().toLocaleDateString('en-CA')
  const userReviewModal = useUserReviewModal()
  const openUserReview = useCallback(
    (userId: string, displayName: string) => {
      userReviewModal?.open({
        userId,
        displayName,
        workDateYmd: clockStripWorkDateYmd ?? denverCalendarDayKey(Date.now()),
      })
    },
    [userReviewModal, clockStripWorkDateYmd],
  )
  const jobDetailModal = useJobDetailModal()
  const openJobDetailFromSessionEmbeds = useCallback(
    (jobLedgerId: string, jl: ClockSessionRow['jobs_ledger'] | null) => {
      if (!jobDetailModal) return
      const h = effectiveJobLedgerNumber(jl?.hcp_number, jl?.click_number) || '—'
      const n = (jl?.job_name ?? '').trim() || 'Job'
      jobDetailModal.openJobDetail({
        jobId: jobLedgerId,
        prefillRowLabel: `${h} · ${n}`,
        prefillAddress: (jl?.job_address ?? '').trim() || null,
      })
    },
    [jobDetailModal],
  )
  const stripNameAsScheduleButtonStyle: CSSProperties = {
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'none',
    font: 'inherit',
    color: 'inherit',
    cursor: 'pointer',
    textAlign: 'left' as const,
    textDecoration: 'underline',
    textDecorationColor: 'rgba(37, 99, 235, 0.35)',
  }
  const stripRejectTitleId = useId()
  const shortCurrentlyInHeader = useMatchMedia(STRIP_SHORT_CURRENTLY_IN_HEADER_MQ)
  const mergedJobsStripTitleClusterStyle: CSSProperties = shortCurrentlyInHeader
    ? { ...mergedHeaderTitleCluster, flexWrap: 'nowrap' }
    : mergedHeaderTitleCluster
  const wrapMergedJobsHeaderTitles = (children: ReactNode) =>
    shortCurrentlyInHeader ? (
      <div style={mergedJobsHeaderTitlesOverflowWrap}>
        <div style={mergedJobsStripTitleClusterStyle}>{children}</div>
      </div>
    ) : (
      <div style={mergedHeaderTitleCluster}>{children}</div>
    )
  const nowMs = useIntervalNowMs(45_000)
  const [salaryMaterializeBusyUserId, setSalaryMaterializeBusyUserId] = useState<string | null>(null)
  const [stripApproveBusy, setStripApproveBusy] = useState<ReadonlySet<string>>(() => new Set())
  const [stripRejectConfirm, setStripRejectConfirm] = useState<StripRejectClockSessionPayload | null>(null)
  const [stripActionsSession, setStripActionsSession] = useState<ClockSessionStripActionsPayload | null>(null)

  /** Clear stray iOS/WebKit selection after opening Session actions (long-press + modal). */
  useEffect(() => {
    if (stripActionsSession == null) return
    let cancelled = false
    const id1 = requestAnimationFrame(() => {
      if (cancelled) return
      window.getSelection()?.removeAllRanges()
      requestAnimationFrame(() => {
        if (cancelled) return
        window.getSelection()?.removeAllRanges()
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id1)
    }
  }, [stripActionsSession])

  const [optimisticStripApprovedIds, setOptimisticStripApprovedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [copyDayJobMixMode, setCopyDayJobMixMode] = useState(false)
  const [copyDayJobMixModal, setCopyDayJobMixModal] = useState<{
    sourceUserId: string
    sourceDisplayName: string
  } | null>(null)
  const [scheduleDayEmailOpen, setScheduleDayEmailOpen] = useState(false)
  const [stripViewingReport, setStripViewingReport] = useState<ReportForView | null>(null)

  const openJobsWorkedTodayReport = useCallback(
    async (jobLedgerId: string, userId: string) => {
      const reportId = jobsWorkedTodayReportIdByKey.get(`${jobLedgerId}:${userId}`)
      if (!reportId) return
      try {
        const rows = await withSupabaseRetry(
          () => supabase.rpc('list_reports_for_job_ledger', { p_job_id: jobLedgerId }),
          'clock strip open report',
        )
        const list = (rows ?? []) as ReportForJobLedgerRow[]
        const row = list.find((r) => r.id === reportId)
        if (!row) {
          console.error('clock strip open report: row not found after fetch', reportId)
          return
        }
        setStripViewingReport(reportForViewFromJobLedgerRow(row))
      } catch (e) {
        console.error(e)
      }
    },
    [jobsWorkedTodayReportIdByKey],
  )

  useEffect(() => {
    if (!copyDayJobMixMode) setCopyDayJobMixModal(null)
  }, [copyDayJobMixMode])

  const stripActionsPayload = useMemo((): ClockSessionStripActionsPayload | null => {
    if (!stripActionsSession) return null
    for (const row of clockedInTodayRows) {
      const s = row.todaySessions.find((t) => t.id === stripActionsSession.sessionId)
      if (!s) continue
      const st = stripApproveStatusForSession(s, optimisticStripApprovedIds)
      if (st === 'open') return null
      const tIn = new Date(s.clocked_in_at).toLocaleTimeString(undefined, timeOpts)
      const openS = s.clocked_out_at == null
      const timeRangeLabel = openS
        ? `${tIn} - Open`
        : `${tIn} - ${new Date(s.clocked_out_at!).toLocaleTimeString(undefined, timeOpts)}`
      return stripActionsPayloadFromSession(
        s,
        stripClockedInTodayDisplayLabel(row, authUserId),
        timeRangeLabel,
        st === 'approved' ? 'approved' : 'pending',
        prefixMap,
      )
    }
    return normalizeStripActionsPayloadFallback(stripActionsSession)
  }, [authUserId, stripActionsSession, clockedInTodayRows, optimisticStripApprovedIds, prefixMap])

  useEffect(() => {
    setOptimisticStripApprovedIds((prev) => {
      if (prev.size === 0) return prev
      const next = new Set(prev)
      let changed = false
      for (const id of prev) {
        const sess = findTodaySessionInStrip(clockedInTodayRows, id)
        if (!sess) {
          next.delete(id)
          changed = true
          continue
        }
        const d = deriveClockSessionStripApproveStatus(sess.clocked_out_at, sess.approved_at)
        if (d === 'approved' && sess.approved_at != null) {
          next.delete(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [clockedInTodayRows])

  useEffect(() => {
    if (!stripActionsSession) return
    const exists = clockedInTodayRows.some((row) =>
      row.todaySessions.some((t) => t.id === stripActionsSession.sessionId),
    )
    if (!exists) setStripActionsSession(null)
  }, [stripActionsSession, clockedInTodayRows])

  useEffect(() => {
    if (!stripActionsSession) return
    for (const row of clockedInTodayRows) {
      const sess = row.todaySessions.find((t) => t.id === stripActionsSession.sessionId)
      if (!sess) continue
      if (stripApproveStatusForSession(sess, optimisticStripApprovedIds) === 'open') {
        setStripActionsSession(null)
      }
      break
    }
  }, [clockedInTodayRows, stripActionsSession, optimisticStripApprovedIds])

  const cancelStripSessionReject = useCallback(() => {
    setStripRejectConfirm(null)
  }, [])

  useEffect(() => {
    if (!stripRejectConfirm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (stripApproveBusy.has(stripRejectConfirm.sessionId)) return
      e.preventDefault()
      setStripRejectConfirm(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stripRejectConfirm, stripApproveBusy])

  const handleStripSessionApprove = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (!sessionId) return false
      setStripApproveBusy((prev) => new Set(prev).add(sessionId))
      try {
        const { data, error: rpcErr } = await approveClockSessions([sessionId])
        if (rpcErr) {
          onJobBidAssignError?.(rpcErr.message)
          return false
        }
        const result = (data ?? []) as Array<{ approved_count: number; error_message: string | null }>
        const row = result[0]
        if (row?.error_message) {
          onJobBidAssignError?.(row.error_message)
          return false
        }
        setOptimisticStripApprovedIds((prev) => new Set(prev).add(sessionId))
        onClockSessionsMutated?.()
        return true
      } finally {
        setStripApproveBusy((prev) => {
          const next = new Set(prev)
          next.delete(sessionId)
          return next
        })
      }
    },
    [onClockSessionsMutated, onJobBidAssignError],
  )

  const handleStripSessionRevoke = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (!sessionId) return false
      if (
        !confirm(
          'Revoke this session? It will move back to Pending and remove its hours from Hours.',
        )
      ) {
        return false
      }
      setStripApproveBusy((prev) => new Set(prev).add(sessionId))
      try {
        const { data, error } = await supabase.rpc('revoke_clock_sessions', { p_session_ids: [sessionId] })
        if (error) {
          onJobBidAssignError?.(error.message)
          return false
        }
        const result = (data ?? []) as Array<{ revoked_count: number; error_message: string | null }>
        const row = result[0]
        if (row?.error_message) {
          onJobBidAssignError?.(row.error_message)
          return false
        }
        setOptimisticStripApprovedIds((prev) => {
          const next = new Set(prev)
          next.delete(sessionId)
          return next
        })
        onClockSessionsMutated?.()
        return true
      } catch (e) {
        onJobBidAssignError?.(formatErrorMessage(e))
        return false
      } finally {
        setStripApproveBusy((prev) => {
          const next = new Set(prev)
          next.delete(sessionId)
          return next
        })
      }
    },
    [onClockSessionsMutated, onJobBidAssignError],
  )

  const requestStripSessionReject = useCallback((payload: StripRejectClockSessionPayload) => {
    if (!payload.sessionId) return
    setStripRejectConfirm(payload)
  }, [])

  const requestRejectFromActionsModal = useCallback(() => {
    const p = stripActionsPayload
    setStripActionsSession(null)
    if (!p?.sessionId) return
    requestStripSessionReject({
      sessionId: p.sessionId,
      personName: p.personName,
      timeRangeLabel: p.timeRangeLabel,
    })
  }, [stripActionsPayload, requestStripSessionReject])

  const performStripSessionReject = useCallback(async () => {
    const pending = stripRejectConfirm
    if (!pending?.sessionId) return
    const sessionId = pending.sessionId
    setStripApproveBusy((prev) => new Set(prev).add(sessionId))
    try {
      await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .update({
              rejected_at: new Date().toISOString(),
              rejected_by: authUserId ?? null,
            })
            .eq('id', sessionId),
        'reject clock session from strip',
      )
      setStripRejectConfirm(null)
      setStripActionsSession((s) => (s?.sessionId === sessionId ? null : s))
      setOptimisticStripApprovedIds((prev) => {
        const next = new Set(prev)
        next.delete(sessionId)
        return next
      })
      onClockSessionsMutated?.()
    } catch (e) {
      onJobBidAssignError?.(formatErrorMessage(e))
    } finally {
      setStripApproveBusy((prev) => {
        const next = new Set(prev)
        next.delete(sessionId)
        return next
      })
    }
  }, [stripRejectConfirm, authUserId, onClockSessionsMutated, onJobBidAssignError])
  const clockedInTodayFocusedRows = useMemo(
    () => clockedInTodayRows.filter((row) => stripRowInFocusedClockedInView(row, optimisticStripApprovedIds)),
    [clockedInTodayRows, optimisticStripApprovedIds],
  )
  const [clockedInTodayTableMode, setClockedInTodayTableMode] = useState<ClockedInTodayTableMode>('missing')
  /** Users who collapsed session detail; everyone else is expanded by default. */
  const [collapsedClockedInTodayUserIds, setCollapsedClockedInTodayUserIds] = useState(() => new Set<string>())
  const [clockedInTodayExpandMode, setClockedInTodayExpandMode] = useState<ClockedInTodayExpandMode>(() =>
    readClockedInTodayExpandMode(),
  )
  const [jobsWorkedTodaySectionCollapsed, setJobsWorkedTodaySectionCollapsed] = useState(() =>
    readJobsWorkedTodaySectionCollapsed(),
  )
  const [collapsedJobsWorkedTodayJobLedgerIds, setCollapsedJobsWorkedTodayJobLedgerIds] = useState(
    () => new Set<string>(),
  )
  const clockedInTodaySectionOpen = clockedInTodayExpandMode !== 'collapsed'
  const clockedInTodayVisible =
    clockedInTodayTableMode === 'all' ? clockedInTodayRows : clockedInTodayFocusedRows
  const clockedInTodayUnassignedRows = useMemo(
    () => clockedInTodayRows.filter((row) => stripRowHasUnassignedSession(row)),
    [clockedInTodayRows],
  )
  const clockedInTodayBodyRows = useMemo((): readonly ClockedInTodayStripRow[] => {
    if (clockedInTodayExpandMode === 'collapsed') return []
    if (clockedInTodayExpandMode === 'unassignedPeek') return clockedInTodayUnassignedRows
    return clockedInTodayVisible
  }, [clockedInTodayExpandMode, clockedInTodayUnassignedRows, clockedInTodayVisible])
  const clockStripOverlapByUserId = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const r of clockedInTodayRows) {
      m.set(r.userId, r.hasIntervalOverlapToday)
    }
    return m
  }, [clockedInTodayRows])
  const showClockedInTodayToggle =
    clockedInTodayExpandMode === 'full' &&
    clockedInTodayRows.length > 0 &&
    (clockedInTodayTableMode === 'missing' || clockedInTodayFocusedRows.length < clockedInTodayRows.length)

  useLayoutEffect(() => {
    if (clockedInTodayRows.length === 0) return
    if (clockedInTodayExpandMode === 'collapsed') return
    if (clockedInTodayBodyRows.length > 0) return
    // Unassigned peek with nobody to list: do not snap back to collapsed (merged bar would "eat" the click);
    // open full list and show all rows if "missing" would still be empty.
    if (clockedInTodayExpandMode === 'unassignedPeek' && clockedInTodayUnassignedRows.length === 0) {
      setClockedInTodayExpandMode('full')
      persistClockedInTodayExpandMode('full')
      setClockedInTodayTableMode('all')
      return
    }
    setClockedInTodayExpandMode('collapsed')
    persistClockedInTodayExpandMode('collapsed')
  }, [
    clockedInTodayBodyRows.length,
    clockedInTodayExpandMode,
    clockedInTodayRows.length,
    clockedInTodayUnassignedRows.length,
  ])

  const clockedInTodayColSpan = 3
  const scopeShowsOverlay = showScopeToggle && !!onClockStripScopeChange
  const showCurrentlyInTable = !hideCurrentlyInTable && sessions.length > 0
  const copyJobMixChrome = enableCopyDayJobMix === true && clockedInTodayRows.length > 0
  const scheduleEmailChrome = enableScheduleDayEmail === true
  const showClockedInHeaderChrome =
    showClockedInTodayToggle || copyJobMixChrome || scheduleEmailChrome || showAddClockSession === true
  const showStripTopRightBar = scopeShowsOverlay || showClockedInHeaderChrome
  // Desktop with the Currently In table: the controls overlay the orange header row
  // itself (its last column reserves space via stripTopRightHeaderReserve). On narrow
  // viewports — or when there is no Currently In header to land on — keep the
  // dedicated band above the table instead.
  const chromeOverlaysHeaderBar = showStripTopRightBar && !shortCurrentlyInHeader && showCurrentlyInTable
  const stripTableHostWithTopBar: CSSProperties = {
    ...stripTableHost,
    ...(showStripTopRightBar && !chromeOverlaysHeaderBar ? { paddingTop: '1.9rem' } : {}),
  }
  const stripTopRightHeaderReserve: CSSProperties =
    scopeShowsOverlay && showClockedInHeaderChrome
      ? {
          paddingRight: scheduleEmailChrome
            ? 'clamp(17.5rem, 44vw, 27rem)'
            : 'clamp(14rem, 38vw, 22rem)',
        }
      : scopeShowsOverlay
        ? { paddingRight: 'clamp(8.5rem, 22vw, 10.5rem)' }
        : showClockedInHeaderChrome
          ? {
              paddingRight: scheduleEmailChrome
                ? 'clamp(10rem, 22vw, 14rem)'
                : 'clamp(6.5rem, 18vw, 11rem)',
            }
          : {}
  const mergeClockedInHeaderIntoJobs =
    clockedInTodayExpandMode === 'collapsed' &&
    clockedInTodayRows.length > 0 &&
    jobsWorkedTodayRows.length > 0
  const stripHeaderChromeInner = showClockedInHeaderChrome ? (
    <div
      style={{
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        maxWidth: 'min(100%, 24rem)',
        flexShrink: 1,
      }}
    >
      {scheduleEmailChrome ? (
        <button
          type="button"
          onClick={() => {
            if (authUserId) setScheduleDayEmailOpen(true)
          }}
          disabled={!authUserId}
          title="Email a copy of the dispatch schedule for this day"
          aria-label="Schedule email with dispatch blocks for this day"
          style={{
            ...scopeBtn(false),
            ...stripClockedInChromeBtnLayout,
            opacity: authUserId ? 1 : 0.45,
          }}
        >
          Email schedule
        </button>
      ) : null}
      {copyJobMixChrome ? (
        <button
          type="button"
          aria-pressed={copyDayJobMixMode}
          onClick={() => setCopyDayJobMixMode((v) => !v)}
          title="Copy one person’s job time mix to another person’s day"
          aria-label={
            copyDayJobMixMode
              ? 'Exit copy job time mix mode'
              : 'Turn on copy job time mix: use the copy icon by each name to pick a template person'
          }
          style={{
            ...scopeBtn(copyDayJobMixMode),
            ...stripClockedInChromeBtnLayout,
            gap: 4,
          }}
        >
          <CopyDayJobMixIcon active={copyDayJobMixMode} />
          <span>Mix</span>
        </button>
      ) : null}
      {showClockedInTodayToggle ? (
        <button
          type="button"
          onClick={() => setClockedInTodayTableMode((m) => (m === 'all' ? 'missing' : 'all'))}
          style={{ ...scopeBtn(false), ...stripClockedInChromeBtnLayout }}
          title="Limit to people with an unassigned session or a closed session pending approval"
          aria-label={
            clockedInTodayTableMode === 'all'
              ? 'Show only people needing attention: unassigned job or bid, or pending clock approval'
              : 'Show everyone clocked in today'
          }
        >
          {clockedInTodayTableMode === 'all' ? 'Needs attention' : 'Show all'}
        </button>
      ) : null}
      {showAddClockSession ? (
        <button
          type="button"
          onClick={() => onAddClockSession?.()}
          title="Add a clock session for a person on this day"
          aria-label="Add a clock session for a person on this day"
          style={{ ...scopeBtn(false), ...stripClockedInChromeBtnLayout }}
        >
          + Add session
        </button>
      ) : null}
    </div>
  ) : null

  const citExpandModeToggle = (
    <button
      type="button"
      id="clocked-in-today-section-toggle"
      aria-expanded={clockedInTodaySectionOpen}
      aria-controls="clocked-in-today-section-panel"
      title={
        clockedInTodayExpandMode === 'collapsed'
          ? 'Show people with unassigned job or bid only'
          : clockedInTodayExpandMode === 'unassignedPeek'
            ? 'Show full clocked-in list with Needs attention / Show all'
            : 'Collapse clocked-in today'
      }
      onClick={() => {
        setClockedInTodayExpandMode((m) => {
          const next = cycleClockedInTodayExpandMode(m)
          persistClockedInTodayExpandMode(next)
          return next
        })
      }}
      aria-label={
        clockedInTodayExpandMode === 'collapsed'
          ? `Show unassigned only: people with no job or bid today, out of ${clockedInTodayRows.length} ${
              clockedInTodayRows.length === 1 ? 'person' : 'people'
            } clocked in`
          : clockedInTodayExpandMode === 'unassignedPeek'
            ? `Expand to full list and filters, ${clockedInTodayRows.length} ${
                clockedInTodayRows.length === 1 ? 'person' : 'people'
              }`
            : `Collapse to header only, ${clockedInTodayRows.length} ${
                clockedInTodayRows.length === 1 ? 'person' : 'people'
              }`
      }
      style={stripOrangeBarChevronButton}
    >
      <span aria-hidden>
        {clockedInTodayExpandMode === 'collapsed' ? '\u25B6' : '\u25BC'}
      </span>
    </button>
  )

  /** Same CIT expand behavior as `citExpandModeToggle`, with id; used in merged header title when Jobs tbody is visible (only one chevron in column 1). */
  const citExpandModeTitleButton = (
    <button
      type="button"
      id="clocked-in-today-section-toggle"
      aria-expanded={clockedInTodaySectionOpen}
      aria-controls="clocked-in-today-section-panel"
      title={
        clockedInTodayExpandMode === 'collapsed'
          ? 'Show people with unassigned job or bid only'
          : clockedInTodayExpandMode === 'unassignedPeek'
            ? 'Show full clocked-in list with Needs attention / Show all'
            : 'Collapse clocked-in today'
      }
      onClick={() => {
        setClockedInTodayExpandMode((m) => {
          const next = cycleClockedInTodayExpandMode(m)
          persistClockedInTodayExpandMode(next)
          return next
        })
      }}
      aria-label={
        clockedInTodayExpandMode === 'collapsed'
          ? `Show unassigned only: people with no job or bid today, out of ${clockedInTodayRows.length} ${
              clockedInTodayRows.length === 1 ? 'person' : 'people'
            } clocked in`
          : clockedInTodayExpandMode === 'unassignedPeek'
            ? `Expand to full list and filters, ${clockedInTodayRows.length} ${
                clockedInTodayRows.length === 1 ? 'person' : 'people'
              }`
            : `Collapse to header only, ${clockedInTodayRows.length} ${
                clockedInTodayRows.length === 1 ? 'person' : 'people'
              }`
      }
      style={{ ...stripOrangeHeaderTitleButton, textAlign: 'left' }}
    >
      Clocked in today ({clockedInTodayRows.length})
    </button>
  )

  /** Same Jobs section toggle as column-1 glyph, with id; used in merged header title when both sections collapsed (only CIT chevron in column 1). */
  const jobsExpandModeTitleButton = (
    <button
      type="button"
      id="jobs-worked-today-section-toggle"
      aria-expanded={!jobsWorkedTodaySectionCollapsed}
      aria-controls="jobs-worked-today-section-panel"
      onClick={() => {
        setJobsWorkedTodaySectionCollapsed((v) => {
          const next = !v
          persistJobsWorkedTodaySectionCollapsed(next)
          return next
        })
      }}
      aria-label={
        jobsWorkedTodaySectionCollapsed
          ? `Show jobs worked today, ${jobsWorkedTodayRows.length} jobs`
          : `Hide jobs worked today, ${jobsWorkedTodayRows.length} jobs`
      }
      style={{ ...stripOrangeHeaderTitleButton, textAlign: 'left' }}
    >
      Jobs worked today ({jobsWorkedTodayRows.length})
    </button>
  )

  const rejectModalBusy =
    stripRejectConfirm != null && stripApproveBusy.has(stripRejectConfirm.sessionId)

  const actionsModalBusy =
    stripActionsPayload != null && stripApproveBusy.has(stripActionsPayload.sessionId)

  return (
    <>
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: '1rem',
      }}
    >
      <div style={stripTableHostWithTopBar}>
        {showStripTopRightBar ? (
          <div
            style={{
              position: 'absolute',
              top: '0.2rem',
              right: '0.4rem',
              zIndex: 5,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              columnGap: 10,
              rowGap: 4,
              maxWidth: 'calc(100% - 0.8rem)',
              boxSizing: 'border-box',
            }}
          >
            {stripHeaderChromeInner}
            {scopeShowsOverlay ? (
              <div
                role="group"
                aria-label={`Clocked-in list scope: ${clockStripNarrowScopeLabel}, ${clockStripWideScopeLabel}`}
                style={{ display: 'inline-flex', flexShrink: 0 }}
              >
                <button
                  type="button"
                  aria-pressed={clockStripScope === 'team'}
                  onClick={() => onClockStripScopeChange!('team')}
                  style={{
                    ...scopeBtn(clockStripScope === 'team'),
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0,
                    marginRight: -1,
                  }}
                >
                  {clockStripNarrowScopeLabel}
                </button>
                <button
                  type="button"
                  aria-pressed={clockStripScope === 'everyone'}
                  onClick={() => onClockStripScopeChange!('everyone')}
                  style={{
                    ...scopeBtn(clockStripScope === 'everyone'),
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                  }}
                >
                  {clockStripWideScopeLabel}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {showCurrentlyInTable ? (
        <div style={{ overflowX: 'auto' }} aria-live="polite">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={stripCurrentlyInFirstCol} />
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr style={{ background: STRIP_SECTION_HEAD_BG }}>
                <th
                  scope="col"
                  style={{ ...stripSectionTh, ...stripCurrentlyInFirstCol }}
                  aria-label={`Currently in: ${sessions.length} ${
                    sessions.length === 1 ? 'person' : 'people'
                  }`}
                >
                  {shortCurrentlyInHeader
                    ? `In (${sessions.length})`
                    : `Currently In (${sessions.length})`}
                </th>
                <th scope="col" style={{ ...stripSectionTh, textAlign: 'right' as const }}>
                  Today
                </th>
                <th scope="col" style={{ ...stripSectionTh, textAlign: 'right' as const }} aria-label="Session length and clock-in time">
                  Session | In
                </th>
                {showJobBidColumn ? (
                  <th
                    scope="col"
                    style={{
                      ...stripSectionTh,
                      minWidth: STRIP_CURRENTLY_IN_JOB_BID_COL_MIN,
                      whiteSpace: 'nowrap',
                      ...stripTopRightHeaderReserve,
                    }}
                  >
                    Job or bid
                  </th>
                ) : (
                  <th scope="col" style={{ ...stripSectionTh, maxWidth: 200, ...stripTopRightHeaderReserve }}>
                    Focus
                  </th>
                )}
              </tr>
            </thead>
          <tbody>
            {sessions.map((s) => {
              const synthetic = isSyntheticSalaryStripSession(s)
              const inDate = new Date(s.clocked_in_at)
              const todayHBase = hoursTodayByUserId[s.user_id] ?? 0
              const todayH = synthetic
                ? Math.max(todayHBase, sessionDurationSeconds(s.clocked_in_at, null, nowMs) / 3600)
                : todayHBase
              const fullJobBid = synthetic ? null : formatClockSessionJobOrBidLabel(s as ClockSessionRow, prefixMap)
              const shortJb = synthetic ? null : shortJobOrBidLabel(s as ClockSessionRow, prefixMap)
              const bidHref =
                !synthetic && s.bid_id
                  ? `/bids?bidId=${encodeURIComponent(s.bid_id)}&tab=submission-followup`
                  : null
              const linkText = synthetic
                ? 'Salary schedule'
                : shortJb ?? (s.job_ledger_id ? 'Job' : s.bid_id ? 'Bid' : null)
              const titleText = synthetic ? 'On schedule; session sync may follow' : fullJobBid ?? linkText ?? undefined
              const elapsedStr = formatElapsedOpen(s.clocked_in_at, nowMs)
              const inStr = inDate.toLocaleTimeString(undefined, timeOpts)
              const cr = s as ClockSessionRow
              const sessionInCell = (
                <>
                  <span style={stripClockStripSummaryPipeTime}>{elapsedStr}</span>
                  <span style={stripClockStripSummaryPipeTime}>{' | '}</span>
                  <StripClockTimeMapButton
                    kind="in"
                    lat={synthetic ? null : cr.clock_in_lat ?? null}
                    lng={synthetic ? null : cr.clock_in_lng ?? null}
                    locationSource={synthetic ? null : cr.clock_in_location_source ?? null}
                    baseStyle={stripClockStripSummaryPipeTime}
                  >
                    {inStr}
                  </StripClockTimeMapButton>
                </>
              )
              const memo = (s.notes ?? '').trim()
              const hasJobOrBid = !synthetic && !!(s.job_ledger_id || s.bid_id)

              return (
                <tr key={s.id}>
                  <td style={{ ...td, ...stripCurrentlyInFirstCol }}>
                    <span style={stripCurrentlyInNameWithSuffix}>
                    {userReviewModal ? (
                      <button
                        type="button"
                        onClick={() => openUserReview(s.user_id, personName(s))}
                        title="View day schedule, transactions, and add blocks"
                        aria-label={`User review for ${personName(s)}`}
                        style={{ ...stripNameAsScheduleButtonStyle, whiteSpace: 'nowrap' }}
                      >
                        {personName(s)}
                      </button>
                    ) : (
                      <span style={{ whiteSpace: 'nowrap' as const }}>{personName(s)}</span>
                    )}
                    {shouldShowSalaryStripNameSuffix(s) ? (
                      <span style={stripSalaryNameSuffix} title="Salary schedule">
                        (s)
                      </span>
                    ) : null}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {onOpenStripMyTimeEditor ? (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenStripMyTimeEditor({ subjectUserId: s.user_id, displayName: personName(s) })
                        }
                        title="Edit today's time"
                        aria-label={`Edit today's time for ${personName(s)}`}
                        style={{
                          ...stripClockStripSummaryHoursButton,
                          textAlign: 'right',
                          width: '100%',
                        }}
                      >
                        {formatHoursH(todayH)}
                      </button>
                    ) : (
                      <span style={stripClockStripSummaryHoursReadonly}>
                        {formatHoursH(todayH)}
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' as const }}>
                    {sessionInCell}
                  </td>
                  {showJobBidColumn && (
                    <td style={{ ...td, minWidth: STRIP_CURRENTLY_IN_JOB_BID_COL_MIN }}>
                      <div style={jobBidCellFlex}>
                        <div style={jobBidLinkMemoGroup}>
                          {!hasJobOrBid && !synthetic ? (
                            <span style={{ flexShrink: 0 }}>
                              <AssignSessionJobPopover
                                session={s as ClockSessionRow}
                                onSaved={(p) => {
                                  if (p) onJobBidSaved?.(p)
                                }}
                                onError={onJobBidAssignError}
                                popoverZIndex={STRIP_POPOVER_Z}
                                unassignedTrigger="default"
                                compactTrigger
                                showChangeWhenAssigned={onOpenStripMyTimeEditor == null}
                                dispatchScheduleAssigneeUserId={s.user_id}
                                dispatchScheduleWorkDateYmd={s.work_date}
                              />
                            </span>
                          ) : null}
                          {synthetic && linkText ? (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} title={titleText}>
                              {linkText}
                              {onMaterializeSalarySession ? (
                                <>
                                  {' · '}
                                  <button
                                    type="button"
                                    disabled={salaryMaterializeBusyUserId === s.user_id}
                                    title="Create the scheduled clock session so you can assign a job or bid"
                                    onClick={() => {
                                      setSalaryMaterializeBusyUserId(s.user_id)
                                      void onMaterializeSalarySession(s.user_id).finally(() => {
                                        setSalaryMaterializeBusyUserId((cur) =>
                                          cur === s.user_id ? null : cur,
                                        )
                                      })
                                    }}
                                    style={{
                                      padding: 0,
                                      margin: 0,
                                      border: 'none',
                                      background: 'none',
                                      cursor: salaryMaterializeBusyUserId === s.user_id ? 'wait' : 'pointer',
                                      font: 'inherit',
                                      fontSize: 'inherit',
                                      color: 'var(--text-link)',
                                      textDecoration: 'underline',
                                    }}
                                  >
                                    {salaryMaterializeBusyUserId === s.user_id ? '…' : 'Create session'}
                                  </button>
                                </>
                              ) : null}
                            </span>
                          ) : null}
                          {!synthetic && s.job_ledger_id && linkText ? (
                            <button
                              type="button"
                              onClick={() =>
                                openJobDetailFromSessionEmbeds(
                                  s.job_ledger_id!,
                                  (s as ClockSessionRow).jobs_ledger ?? null,
                                )
                              }
                              title={titleText}
                              style={{ ...buttonAsLinkReset, ...jobBidStripLink }}
                            >
                              {linkText}
                            </button>
                          ) : bidHref && linkText ? (
                            <Link to={bidHref} title={titleText} style={jobBidStripLink}>
                              {linkText}
                            </Link>
                          ) : null}
                          <span style={stripSessionMemoCellStyle} title={memo || undefined}>
                            {memo || '—'}
                          </span>
                        </div>
                        {hasJobOrBid ? (
                          <span style={{ flexShrink: 0 }}>
                            <AssignSessionJobPopover
                              session={s}
                              onSaved={(p) => {
                                if (p) onJobBidSaved?.(p)
                              }}
                              onError={onJobBidAssignError}
                              popoverZIndex={STRIP_POPOVER_Z}
                              unassignedTrigger="default"
                              compactTrigger
                              showChangeWhenAssigned={onOpenStripMyTimeEditor == null}
                              dispatchScheduleAssigneeUserId={s.user_id}
                              dispatchScheduleWorkDateYmd={s.work_date}
                            />
                          </span>
                        ) : null}
                      </div>
                    </td>
                  )}
                  {!showJobBidColumn && (
                    <td style={{ ...td, maxWidth: 200 }}>
                      <div style={stripSessionMemoCellStyle} title={memo || undefined}>
                        {memo || '—'}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
        ) : null}
        <div
          style={{
            borderTop: showCurrentlyInTable ? '1px solid var(--border)' : 'none',
          }}
        >
          {clockedInTodayRows.length === 0 ? (
            <p style={{ margin: '0.35rem 0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              No sessions recorded yet today.
            </p>
          ) : (
            <div
              id="clocked-in-today-section-panel"
              role="region"
              aria-labelledby="clocked-in-today-section-toggle"
            >
              <div style={{ position: 'relative' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  {mergeClockedInHeaderIntoJobs ? null : (
                  <thead>
                    <tr style={{ background: STRIP_SECTION_HEAD_BG }}>
                      <th
                        style={{
                          ...stripSectionTh,
                          width: CLOCKED_IN_TODAY_EXPAND_COL,
                          textAlign: 'center',
                          verticalAlign: 'middle',
                        }}
                      >
                        {citExpandModeToggle}
                      </th>
                      <th
                        scope="col"
                        style={stripSectionTh}
                        aria-label={`Names of people clocked in today, ${clockedInTodayRows.length} ${
                          clockedInTodayRows.length === 1 ? 'person' : 'people'
                        }${
                          clockedInTodayExpandMode === 'unassignedPeek'
                            ? `; showing ${clockedInTodayUnassignedRows.length} with unassigned job or bid`
                            : ''
                        }`}
                      >
                        <span style={srOnly}>{'Expand session rows. '}</span>
                        Clocked in today ({clockedInTodayRows.length})
                      </th>
                      <th
                        scope="col"
                        style={{
                          ...stripSectionTh,
                          ...stripTopRightHeaderReserve,
                        }}
                      >
                        {clockedInTodaySectionOpen ? 'Today | First clock-in' : ''}
                      </th>
                    </tr>
                  </thead>
                  )}
                  <tbody hidden={!clockedInTodaySectionOpen}>
                    {!clockedInTodaySectionOpen ? null : clockedInTodayBodyRows.length === 0 ? null : (
                      clockedInTodayBodyRows.map((row) => {
                  const hasDetail = row.todaySessions.length > 0
                  const expanded = hasDetail && !collapsedClockedInTodayUserIds.has(row.userId)
                  const detailId = `clocked-in-today-detail-${row.userId}`
                  const rowLabel = stripClockedInTodayDisplayLabel(row, authUserId)
                  const showApplyScheduleProportionsForRow =
                    Boolean(onApplyScheduleProportionsForSession) &&
                    stripRowEligibleForApplyScheduleProportions(row)
                  return (
                    <Fragment key={row.userId}>
                      <tr>
                        <td
                          style={{
                            ...clockedInTodayRowTd,
                            width: CLOCKED_IN_TODAY_EXPAND_COL,
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          {hasDetail ? (
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-controls={detailId}
                              aria-label={
                                expanded
                                  ? `Hide today’s sessions for ${rowLabel}`
                                  : `Show today’s sessions for ${rowLabel}`
                              }
                              onClick={() =>
                                setCollapsedClockedInTodayUserIds((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(row.userId)) next.delete(row.userId)
                                  else next.add(row.userId)
                                  return next
                                })
                              }
                              style={stripBodyExpandChevronButton}
                            >
                              <span aria-hidden>{expanded ? '\u25BC' : '\u25B6'}</span>
                            </button>
                          ) : null}
                        </td>
                        <td style={clockedInTodayRowTd}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              flexWrap: 'wrap',
                            }}
                          >
                            {userReviewModal ? (
                              <button
                                type="button"
                                onClick={() => openUserReview(row.userId, row.displayName)}
                                title="View day schedule, transactions, and add blocks"
                                aria-label={`User review for ${rowLabel}`}
                                style={stripNameAsScheduleButtonStyle}
                              >
                                {rowLabel}
                              </button>
                            ) : (
                              rowLabel
                            )}
                            {row.hasIntervalOverlapToday ? <StripClockOverlapBadge /> : null}
                            {copyDayJobMixMode && copyJobMixChrome ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setCopyDayJobMixModal({
                                    sourceUserId: row.userId,
                                    sourceDisplayName: row.displayName,
                                  })
                                }
                                title={`Copy ${row.displayName}’s job time mix to another person`}
                                aria-label={`Copy job time mix from ${rowLabel}`}
                                style={{
                                  flexShrink: 0,
                                  marginLeft: 2,
                                  padding: '0.1rem 0.2rem',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: 4,
                                  background: 'var(--bg-blue-tint)',
                                  color: 'var(--text-blue-700)',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  lineHeight: 1,
                                }}
                              >
                                <CopyDayJobMixIcon />
                              </button>
                            ) : null}
                          </span>
                        </td>
                        <td
                          style={{
                            ...clockedInTodayRowTd,
                            textAlign: 'left',
                            whiteSpace: 'nowrap' as const,
                            ...stripTopRightHeaderReserve,
                          }}
                        >
                          {onOpenStripMyTimeEditor ? (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenStripMyTimeEditor({
                                  subjectUserId: row.userId,
                                  displayName: row.displayName,
                                })
                              }
                              title="Edit today's time"
                              aria-label={`Edit today's time for ${rowLabel}`}
                              style={stripClockStripSummaryHoursButton}
                            >
                              {formatHoursH(row.hoursToday)}
                            </button>
                          ) : (
                            <span style={{ ...stripClockStripSummaryHoursReadonly, whiteSpace: 'nowrap' }}>
                              {formatHoursH(row.hoursToday)}
                            </span>
                          )}
                          <span style={{ ...stripClockStripSummaryPipeTime, whiteSpace: 'nowrap' }}>
                            {' | '}
                            {new Date(row.firstClockedInAt).toLocaleTimeString(undefined, timeOpts)}
                          </span>
                        </td>
                      </tr>
                      {expanded && hasDetail ? (
                        <tr>
                          <td
                            colSpan={clockedInTodayColSpan}
                            style={{
                              ...td,
                              borderBottom: 'none',
                              background: 'var(--bg-page)',
                              padding: '0.35rem 0.5rem 0.45rem',
                              fontSize: '0.7rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <div id={detailId} role="region" aria-label={`Today’s clock sessions for ${rowLabel}`}>
                              <div
                                style={{
                                  overflowX: 'auto',
                                  maxWidth: '100%',
                                  marginLeft: `calc(${CLOCKED_IN_TODAY_EXPAND_COL} + 0.45rem)`,
                                  borderLeft: '2px solid var(--border)',
                                  paddingLeft: '0.45rem',
                                }}
                              >
                                <table
                                  style={{
                                    borderCollapse: 'collapse',
                                    fontSize: '0.68rem',
                                    color: 'var(--text-muted)',
                                    width: 'auto',
                                  }}
                                >
                                  <caption style={srOnly}>{`Today’s sessions for ${rowLabel}`}</caption>
                                  <tbody>
                                    {row.todaySessions.map((s, idx) => {
                                      const tIn = new Date(s.clocked_in_at).toLocaleTimeString(undefined, timeOpts)
                                      const open = s.clocked_out_at == null
                                      const sec = sessionDurationSeconds(s.clocked_in_at, s.clocked_out_at, nowMs)
                                      const dur = formatDurationFromSeconds(sec)
                                      const memo = (s.notes ?? '').trim()
                                      const fullJobBid = formatClockSessionJobOrBidLabelFromEmbeds(s, prefixMap)
                                      const shortJb = shortJobOrBidLabelFromEmbeds(s, prefixMap)
                                      const bidHref = s.bid_id
                                        ? `/bids?bidId=${encodeURIComponent(s.bid_id)}&tab=submission-followup`
                                        : null
                                      const linkText = shortJb ?? (s.job_ledger_id ? 'Job' : s.bid_id ? 'Bid' : null)
                                      const titleText = fullJobBid ?? linkText ?? undefined
                                      const hasJobOrBid = !!(s.job_ledger_id || s.bid_id)
                                      const stripApproveStatus = stripApproveStatusForSession(
                                        s,
                                        optimisticStripApprovedIds,
                                      )
                                      const timeRangeLabel = open
                                        ? `${tIn} - Open`
                                        : `${tIn} - ${new Date(s.clocked_out_at!).toLocaleTimeString(undefined, timeOpts)}`
                                      return (
                                        <tr key={s.id || `${s.user_id}-${s.clocked_in_at}-${idx}`}>
                                          <td style={clockedInTodayDetailCell}>
                                            <div style={clockedInTodaySessionBlock}>
                                              <div
                                                style={{
                                                  ...stripSessionActionsRowChromeNoSelect,
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  flexWrap: 'nowrap',
                                                  gap: '0.35rem',
                                                  minWidth: 0,
                                                }}
                                              >
                                                {s.id ? (
                                                  <ClockSessionStripApproveControl
                                                    sessionId={s.id}
                                                    status={stripApproveStatus}
                                                    interactive={
                                                      canApproveClockSessions === true &&
                                                      stripApproveStatus === 'pending'
                                                    }
                                                    actionsEligible={
                                                      canApproveClockSessions === true &&
                                                      (stripApproveStatus === 'pending' ||
                                                        stripApproveStatus === 'approved')
                                                    }
                                                    busy={stripApproveBusy.has(s.id)}
                                                    onOpenActions={() => {
                                                      if (stripApproveStatus === 'open') return
                                                      setStripActionsSession(
                                                        stripActionsPayloadFromSession(
                                                          s,
                                                          rowLabel,
                                                          timeRangeLabel,
                                                          stripApproveStatus === 'approved'
                                                            ? 'approved'
                                                            : 'pending',
                                                          prefixMap,
                                                        ),
                                                      )
                                                    }}
                                                    onApprove={async () => {
                                                      await handleStripSessionApprove(s.id)
                                                    }}
                                                    onReject={async () => {}}
                                                  />
                                                ) : null}
                                                <span
                                                  style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    flexWrap: 'nowrap',
                                                    gap: '0.35rem',
                                                    minWidth: 0,
                                                  }}
                                                >
                                                  {open ? (
                                                    <>
                                                      <StripClockTimeMapButton
                                                        kind="in"
                                                        lat={s.clock_in_lat ?? null}
                                                        lng={s.clock_in_lng ?? null}
                                                        locationSource={s.clock_in_location_source ?? null}
                                                        baseStyle={clockedInTodaySessionTimeText}
                                                      >
                                                        {tIn}
                                                      </StripClockTimeMapButton>
                                                      {'-'}
                                                      <span style={{ fontWeight: 600, color: 'var(--text-700)' }}>Open</span>
                                                      {'•'}
                                                      <span style={clockedInTodaySessionTimeText}>
                                                        {formatElapsedOpen(s.clocked_in_at, nowMs)}
                                                      </span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <StripClockTimeMapButton
                                                        kind="in"
                                                        lat={s.clock_in_lat ?? null}
                                                        lng={s.clock_in_lng ?? null}
                                                        locationSource={s.clock_in_location_source ?? null}
                                                        baseStyle={clockedInTodaySessionTimeText}
                                                      >
                                                        {tIn}
                                                      </StripClockTimeMapButton>
                                                      {'-'}
                                                      <StripClockTimeMapButton
                                                        kind="out"
                                                        lat={s.clock_out_lat ?? null}
                                                        lng={s.clock_out_lng ?? null}
                                                        locationSource={s.clock_out_location_source ?? null}
                                                        baseStyle={clockedInTodaySessionTimeText}
                                                      >
                                                        {new Date(s.clocked_out_at!).toLocaleTimeString(
                                                          undefined,
                                                          timeOpts,
                                                        )}
                                                      </StripClockTimeMapButton>
                                                      {'•'}
                                                      <span style={clockedInTodaySessionTimeText}>{dur}</span>
                                                    </>
                                                  )}
                                                </span>
                                                <div
                                                  style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    flexWrap: 'nowrap',
                                                    gap: '0.35rem',
                                                    minWidth: 0,
                                                    flex: '0 1 auto',
                                                  }}
                                                >
                                                  <div style={clockedInTodayJobBidLinkMemoGroup}>
                                                    {onJobBidSaved && s.id && !hasJobOrBid ? (
                                                      <span style={{ flexShrink: 0 }}>
                                                        <AssignSessionJobPopover
                                                          session={{
                                                            id: s.id,
                                                            job_ledger_id: s.job_ledger_id,
                                                            bid_id: s.bid_id,
                                                          }}
                                                          onSaved={(p) => {
                                                            if (p) onJobBidSaved(p)
                                                          }}
                                                          onError={onJobBidAssignError}
                                                          popoverZIndex={STRIP_POPOVER_Z}
                                                          unassignedTrigger="default"
                                                          compactTrigger
                                                          showChangeWhenAssigned={onOpenStripMyTimeEditor == null}
                                                          dispatchScheduleAssigneeUserId={s.user_id}
                                                          dispatchScheduleWorkDateYmd={clockStripWorkDateResolved}
                                                          showApplyScheduleProportions={showApplyScheduleProportionsForRow}
                                                          onApplyScheduleProportions={(picks) =>
                                                            onApplyScheduleProportionsForSession?.(s, picks)
                                                          }
                                                        />
                                                      </span>
                                                    ) : null}
                                                    {s.job_ledger_id && linkText ? (
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          openJobDetailFromSessionEmbeds(
                                                            s.job_ledger_id!,
                                                            s.jobs_ledger ?? null,
                                                          )
                                                        }
                                                        title={titleText}
                                                        style={{
                                                          ...buttonAsLinkReset,
                                                          ...clockedInTodayDetailLink,
                                                          flex: '0 1 auto',
                                                          minWidth: 0,
                                                          maxWidth: '100%',
                                                        }}
                                                      >
                                                        {linkText}
                                                      </button>
                                                    ) : bidHref && linkText ? (
                                                      <Link
                                                        to={bidHref}
                                                        title={titleText}
                                                        style={{
                                                          ...clockedInTodayDetailLink,
                                                          flex: '0 1 auto',
                                                          minWidth: 0,
                                                          maxWidth: '100%',
                                                        }}
                                                      >
                                                        {linkText}
                                                      </Link>
                                                    ) : linkText ? (
                                                      <span
                                                        title={titleText}
                                                        style={{
                                                          overflow: 'hidden',
                                                          textOverflow: 'ellipsis',
                                                          whiteSpace: 'nowrap',
                                                          flex: '0 1 auto',
                                                          minWidth: 0,
                                                        }}
                                                      >
                                                        {linkText}
                                                      </span>
                                                    ) : null}
                                                    <span
                                                      style={stripSessionMemoCellStyle}
                                                      title={memo || undefined}
                                                    >
                                                      {memo || '—'}
                                                    </span>
                                                  </div>
                                                  {onJobBidSaved && s.id && hasJobOrBid ? (
                                                    <span style={{ flexShrink: 0 }}>
                                                      <AssignSessionJobPopover
                                                        session={{
                                                          id: s.id,
                                                          job_ledger_id: s.job_ledger_id,
                                                          bid_id: s.bid_id,
                                                        }}
                                                        onSaved={(p) => {
                                                          if (p) onJobBidSaved(p)
                                                        }}
                                                        onError={onJobBidAssignError}
                                                        popoverZIndex={STRIP_POPOVER_Z}
                                                        unassignedTrigger="default"
                                                        compactTrigger
                                                        showChangeWhenAssigned={onOpenStripMyTimeEditor == null}
                                                        dispatchScheduleAssigneeUserId={s.user_id}
                                                        dispatchScheduleWorkDateYmd={clockStripWorkDateResolved}
                                                      />
                                                    </span>
                                                  ) : null}
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        {jobsWorkedTodayRows.length > 0 ? (
          <div
            style={{
              borderTop: mergeClockedInHeaderIntoJobs ? 'none' : '1px solid var(--border)',
            }}
          >
            <div
              id="jobs-worked-today-section-panel"
              role="region"
              aria-labelledby="jobs-worked-today-section-toggle"
              style={{ position: 'relative' }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  ...(mergeClockedInHeaderIntoJobs ? { tableLayout: 'fixed' as const } : {}),
                }}
              >
                {mergeClockedInHeaderIntoJobs ? (
                  <colgroup>
                    <col style={{ width: CLOCKED_IN_TODAY_EXPAND_COL }} />
                    <col />
                  </colgroup>
                ) : null}
                <thead>
                  <tr style={{ background: STRIP_SECTION_HEAD_BG }}>
                    <th
                      style={{
                        ...stripSectionTh,
                        width: CLOCKED_IN_TODAY_EXPAND_COL,
                        minWidth: CLOCKED_IN_TODAY_EXPAND_COL,
                        maxWidth: mergeClockedInHeaderIntoJobs ? CLOCKED_IN_TODAY_EXPAND_COL : undefined,
                        textAlign: mergeClockedInHeaderIntoJobs ? ('left' as const) : ('center' as const),
                        verticalAlign: 'middle',
                        ...(mergeClockedInHeaderIntoJobs
                          ? { paddingRight: 2, boxSizing: 'border-box' as const }
                          : {}),
                      }}
                    >
                      {mergeClockedInHeaderIntoJobs ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            flexWrap: 'nowrap',
                            gap: 5,
                            width: '100%',
                          }}
                        >
                          {jobsWorkedTodaySectionCollapsed ? (
                            citExpandModeToggle
                          ) : (
                            <button
                              type="button"
                              id="jobs-worked-today-section-toggle"
                              aria-expanded={!jobsWorkedTodaySectionCollapsed}
                              aria-controls="jobs-worked-today-section-panel"
                              onClick={() => {
                                setJobsWorkedTodaySectionCollapsed((v) => {
                                  const next = !v
                                  persistJobsWorkedTodaySectionCollapsed(next)
                                  return next
                                })
                              }}
                              aria-label={
                                jobsWorkedTodaySectionCollapsed
                                  ? `Show jobs worked today, ${jobsWorkedTodayRows.length} jobs`
                                  : `Hide jobs worked today, ${jobsWorkedTodayRows.length} jobs`
                              }
                              style={stripOrangeBarChevronButton}
                            >
                              <span aria-hidden>
                                {jobsWorkedTodaySectionCollapsed ? '\u25B6' : '\u25BC'}
                              </span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          id="jobs-worked-today-section-toggle"
                          aria-expanded={!jobsWorkedTodaySectionCollapsed}
                          aria-controls="jobs-worked-today-section-panel"
                          onClick={() => {
                            setJobsWorkedTodaySectionCollapsed((v) => {
                              const next = !v
                              persistJobsWorkedTodaySectionCollapsed(next)
                              return next
                            })
                          }}
                          aria-label={
                            jobsWorkedTodaySectionCollapsed
                              ? `Show jobs worked today, ${jobsWorkedTodayRows.length} jobs`
                              : `Hide jobs worked today, ${jobsWorkedTodayRows.length} jobs`
                          }
                          style={stripOrangeBarChevronButton}
                        >
                          <span aria-hidden>
                            {jobsWorkedTodaySectionCollapsed ? '\u25B6' : '\u25BC'}
                          </span>
                        </button>
                      )}
                    </th>
                    <th
                      scope="col"
                      aria-label={
                        mergeClockedInHeaderIntoJobs
                          ? `Names of people clocked in today, ${clockedInTodayRows.length} ${
                              clockedInTodayRows.length === 1 ? 'person' : 'people'
                            }; jobs worked today, ${jobsWorkedTodayRows.length} ${
                              jobsWorkedTodayRows.length === 1 ? 'job' : 'jobs'
                            }`
                          : `Jobs worked today; each row shows job name with today's hours and people (${jobsWorkedTodayRows.length} jobs)`
                      }
                      style={{
                        ...stripSectionTh,
                        ...(mergeClockedInHeaderIntoJobs ? { minWidth: 0 } : {}),
                        ...stripTopRightHeaderReserve,
                      }}
                    >
                      {mergeClockedInHeaderIntoJobs ? (
                        !jobsWorkedTodaySectionCollapsed ? (
                          wrapMergedJobsHeaderTitles(
                            <>
                              <span style={srOnly}>{'Expand session rows. '}</span>
                              {citExpandModeTitleButton}
                              <span style={srOnly}>{' '}</span>
                              <span style={stripOrangeHeaderTypography}>
                                Jobs worked today ({jobsWorkedTodayRows.length})
                              </span>
                            </>,
                          )
                        ) : (
                          wrapMergedJobsHeaderTitles(
                            <>
                              <span style={srOnly}>{'Expand session rows. '}</span>
                              <span style={stripOrangeHeaderTypography}>
                                Clocked in today ({clockedInTodayRows.length})
                              </span>
                              {jobsExpandModeTitleButton}
                            </>,
                          )
                        )
                      ) : (
                        <>
                          <span style={srOnly}>{'Expand session rows per job. '}</span>
                          <span style={stripOrangeHeaderTypography}>
                            Jobs worked today ({jobsWorkedTodayRows.length})
                          </span>
                        </>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody hidden={jobsWorkedTodaySectionCollapsed}>
                  {jobsWorkedTodayRows.map((job) => {
                    const hasSessions = job.sessions.length > 0
                    const isUnassignedAggregateRow =
                      job.jobLedgerId === JOBS_WORKED_TODAY_UNASSIGNED_ID
                    const jobDetailExpanded =
                      hasSessions && !collapsedJobsWorkedTodayJobLedgerIds.has(job.jobLedgerId)
                    const jobDetailId = `jobs-worked-today-detail-${job.jobLedgerId}`
                    const totalH = job.totalSeconds / 3600
                    const jobLinkStatsLabel = `${formatHoursH(totalH)} today, ${job.distinctPeopleCount} ${
                      job.distinctPeopleCount === 1 ? 'person' : 'people'
                    }`
                    return (
                      <Fragment key={job.jobLedgerId}>
                        <tr>
                          <td
                            style={{
                              ...clockedInTodayRowTd,
                              width: CLOCKED_IN_TODAY_EXPAND_COL,
                              textAlign: 'center',
                              verticalAlign: 'middle',
                            }}
                          >
                            {hasSessions ? (
                              <button
                                type="button"
                                aria-expanded={jobDetailExpanded}
                                aria-controls={jobDetailId}
                                aria-label={
                                  jobDetailExpanded
                                    ? `Hide sessions for ${job.label}`
                                    : `Show sessions for ${job.label}`
                                }
                                onClick={() =>
                                  setCollapsedJobsWorkedTodayJobLedgerIds((prev) => {
                                    const next = new Set(prev)
                                    if (next.has(job.jobLedgerId)) next.delete(job.jobLedgerId)
                                    else next.add(job.jobLedgerId)
                                    return next
                                  })
                                }
                                style={stripBodyExpandChevronButton}
                              >
                                <span aria-hidden>{jobDetailExpanded ? '\u25BC' : '\u25B6'}</span>
                              </button>
                            ) : null}
                          </td>
                            <td
                            style={{
                              ...clockedInTodayRowTd,
                              ...stripTopRightHeaderReserve,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.12rem',
                                minWidth: 0,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  gap: '0.15rem',
                                  minWidth: 0,
                                }}
                              >
                                {jobsWorkedTodayJobLedgerIdsWithReport != null &&
                                !isUnassignedAggregateRow &&
                                hasSessions &&
                                !jobsWorkedTodayJobLedgerIdsWithReport.has(job.jobLedgerId) ? (
                                  <JobsWorkedTodayReportIcon variant="missing" />
                                ) : null}
                                {isUnassignedAggregateRow ? (
                                  <span
                                    style={{
                                      fontWeight: 600,
                                      flex: '0 1 auto',
                                      minWidth: 0,
                                      color: 'var(--text-muted)',
                                    }}
                                    title={`${job.label} — ${jobLinkStatsLabel}`}
                                  >
                                    {job.label}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      jobDetailModal?.openJobDetail({
                                        jobId: job.jobLedgerId,
                                        prefillRowLabel: job.label,
                                        prefillAddress: (job.addressLine ?? '').trim() || null,
                                      })
                                    }
                                    style={{
                                      ...buttonAsLinkReset,
                                      ...clockedInTodayDetailLink,
                                      fontWeight: 600,
                                      flex: '0 1 auto',
                                      minWidth: 0,
                                    }}
                                    title={`${job.label} — ${jobLinkStatsLabel}`}
                                    aria-label={`Open job ${job.label}, ${jobLinkStatsLabel}`}
                                  >
                                    {job.label}
                                  </button>
                                )}
                                <span
                                  style={{
                                    flexShrink: 0,
                                    color: 'var(--text-600)',
                                    fontWeight: 400,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {'[ '}
                                  <span style={{ fontWeight: 400, color: 'var(--text-700)' }}>
                                    {formatHoursH(totalH)}
                                  </span>
                                  <span style={{ color: 'var(--text-600)' }}>{' • '}</span>
                                  <span style={{ fontWeight: 600 }}>{job.distinctPeopleCount}</span>
                                  {' ]'}
                                </span>
                              </div>
                              {job.addressLine ? (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    color: 'var(--text-muted)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    maxWidth: '100%',
                                  }}
                                  title={job.addressLine}
                                >
                                  {job.addressLine}
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                        {jobDetailExpanded && hasSessions ? (
                          <tr>
                            <td
                              colSpan={JOBS_WORKED_TODAY_COL_SPAN}
                              style={{
                                ...td,
                                borderBottom: 'none',
                                background: 'var(--bg-page)',
                                padding: '0.35rem 0.5rem 0.45rem',
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                              }}
                            >
                              <div
                                id={jobDetailId}
                                role="region"
                                aria-label={`Clock sessions on ${job.label}`}
                              >
                                <div
                                  style={{
                                    overflowX: 'auto',
                                    maxWidth: '100%',
                                    marginLeft: `calc(${CLOCKED_IN_TODAY_EXPAND_COL} + 0.45rem)`,
                                    borderLeft: '2px solid var(--border)',
                                    paddingLeft: '0.45rem',
                                  }}
                                >
                                  <span style={srOnly}>{`Sessions on ${job.label}`}</span>
                                  <div style={jobsWorkedTodaySessionList}>
                                    {job.sessions.map((s, idx) => {
                                      const tIn = new Date(s.clocked_in_at).toLocaleTimeString(
                                        undefined,
                                        timeOpts,
                                      )
                                      const open = s.clocked_out_at == null
                                      const sec = sessionDurationSeconds(
                                        s.clocked_in_at,
                                        s.clocked_out_at,
                                        nowMs,
                                      )
                                      const dur = formatDurationFromSeconds(sec)
                                      const stripApproveStatus = stripApproveStatusForSession(
                                        s,
                                        optimisticStripApprovedIds,
                                      )
                                      const timeRangeLabel = open
                                        ? `${tIn} - Open`
                                        : `${tIn} - ${new Date(s.clocked_out_at!).toLocaleTimeString(undefined, timeOpts)}`
                                      const personName = stripPersonDisplayName(s)
                                      const memo = (s.notes ?? '').trim()
                                      return (
                                        <div
                                          key={s.id || `${s.user_id}-${idx}`}
                                          style={jobsWorkedTodaySessionRowShell}
                                        >
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              flexWrap: 'wrap',
                                              gap: '0.35rem',
                                              minWidth: 0,
                                            }}
                                          >
                                            {s.id ? (
                                              <ClockSessionStripApproveControl
                                                sessionId={s.id}
                                                status={stripApproveStatus}
                                                interactive={
                                                  canApproveClockSessions === true &&
                                                  stripApproveStatus === 'pending'
                                                }
                                                actionsEligible={
                                                  canApproveClockSessions === true &&
                                                  (stripApproveStatus === 'pending' ||
                                                    stripApproveStatus === 'approved')
                                                }
                                                busy={stripApproveBusy.has(s.id)}
                                                onOpenActions={() => {
                                                  if (stripApproveStatus === 'open') return
                                                  setStripActionsSession(
                                                    stripActionsPayloadFromSession(
                                                      s,
                                                      personName,
                                                      timeRangeLabel,
                                                      stripApproveStatus === 'approved'
                                                        ? 'approved'
                                                        : 'pending',
                                                      prefixMap,
                                                    ),
                                                  )
                                                }}
                                                onApprove={async () => {
                                                  await handleStripSessionApprove(s.id)
                                                }}
                                                onReject={async () => {}}
                                              />
                                            ) : null}
                                            <span
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                flexWrap: 'wrap',
                                              }}
                                            >
                                              {job.jobLedgerId !== JOBS_WORKED_TODAY_UNASSIGNED_ID &&
                                              jobsWorkedTodayReportKeys.has(
                                                `${job.jobLedgerId}:${s.user_id}`,
                                              ) ? (
                                                <button
                                                  type="button"
                                                  onClick={() => void openJobsWorkedTodayReport(job.jobLedgerId, s.user_id)}
                                                  title="View report"
                                                  aria-label={`View field report for ${personName}`}
                                                  style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    padding: 0,
                                                    margin: 0,
                                                    border: 'none',
                                                    background: 'none',
                                                    cursor: 'pointer',
                                                    font: 'inherit',
                                                    color: 'inherit',
                                                  }}
                                                >
                                                  <JobsWorkedTodayReportIcon decorative />
                                                </button>
                                              ) : null}
                                              {personName}
                                              {clockStripOverlapByUserId.get(s.user_id) ? (
                                                <StripClockOverlapBadge />
                                              ) : null}
                                            </span>
                                          </div>
                                          <span
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              flexWrap: 'nowrap',
                                              gap: '0.35rem',
                                              minWidth: 0,
                                            }}
                                          >
                                            {open ? (
                                              <>
                                                <StripClockTimeMapButton
                                                  kind="in"
                                                  lat={s.clock_in_lat ?? null}
                                                  lng={s.clock_in_lng ?? null}
                                                  locationSource={s.clock_in_location_source ?? null}
                                                  baseStyle={jobsWorkedTodaySessionTimeText}
                                                >
                                                  {tIn}
                                                </StripClockTimeMapButton>
                                                {'-'}
                                                <span style={{ fontWeight: 600, color: 'var(--text-700)' }}>Open</span>
                                              </>
                                            ) : (
                                              <>
                                                <StripClockTimeMapButton
                                                  kind="in"
                                                  lat={s.clock_in_lat ?? null}
                                                  lng={s.clock_in_lng ?? null}
                                                  locationSource={s.clock_in_location_source ?? null}
                                                  baseStyle={jobsWorkedTodaySessionTimeText}
                                                >
                                                  {tIn}
                                                </StripClockTimeMapButton>
                                                {'-'}
                                                <StripClockTimeMapButton
                                                  kind="out"
                                                  lat={s.clock_out_lat ?? null}
                                                  lng={s.clock_out_lng ?? null}
                                                  locationSource={s.clock_out_location_source ?? null}
                                                  baseStyle={jobsWorkedTodaySessionTimeText}
                                                >
                                                  {new Date(s.clocked_out_at!).toLocaleTimeString(
                                                    undefined,
                                                    timeOpts,
                                                  )}
                                                </StripClockTimeMapButton>
                                              </>
                                            )}
                                          </span>
                                          {onOpenStripMyTimeEditor ? (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                onOpenStripMyTimeEditor({
                                                  subjectUserId: s.user_id,
                                                  displayName: stripPersonDisplayName(s),
                                                })
                                              }
                                              title="Edit today's time"
                                              aria-label={`Edit today's time for ${stripPersonDisplayName(s)}`}
                                              style={{
                                                border: 'none',
                                                background: 'none',
                                                padding: 0,
                                                margin: 0,
                                                cursor: 'pointer',
                                                font: 'inherit',
                                                fontSize: 'inherit',
                                                fontWeight: 600,
                                                color: 'var(--text-blue-700)',
                                                whiteSpace: 'nowrap',
                                                flexShrink: 0,
                                              }}
                                            >
                                              {dur}
                                            </button>
                                          ) : (
                                            <span
                                              style={{
                                                fontWeight: 600,
                                                color: 'var(--text-blue-700)',
                                                whiteSpace: 'nowrap',
                                                flexShrink: 0,
                                              }}
                                            >
                                              {dur}
                                            </span>
                                          )}
                                          <span style={stripSessionMemoCellStyle} title={memo || undefined}>
                                            {memo || '—'}
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  <ClockSessionStripActionsModal
    open={stripActionsPayload != null}
    payload={stripActionsPayload}
    zIndex={STRIP_ACTIONS_MODAL_Z}
    innerPopoverZIndex={STRIP_MODAL_INNER_Z}
    busy={actionsModalBusy}
    onClose={() => setStripActionsSession(null)}
    onApprove={async () => {
      if (!stripActionsPayload) return false
      return handleStripSessionApprove(stripActionsPayload.sessionId)
    }}
    onRequestReject={requestRejectFromActionsModal}
    onRevoke={async () => {
      if (!stripActionsPayload) return false
      return handleStripSessionRevoke(stripActionsPayload.sessionId)
    }}
    onSaved={() => onClockSessionsMutated?.()}
    onError={(msg) => onJobBidAssignError?.(msg)}
  />
  {stripRejectConfirm ? (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: STRIP_REJECT_MODAL_Z,
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return
        if (stripRejectConfirm && stripApproveBusy.has(stripRejectConfirm.sessionId)) return
        cancelStripSessionReject()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={stripRejectTitleId}
        style={{
          background: 'var(--surface)',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 320,
          maxWidth: 420,
          margin: '1rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={stripRejectTitleId} style={{ margin: '0 0 0.75rem', fontSize: '1.125rem' }}>
          Reject clock session?
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-700)' }}>{stripRejectConfirm.personName}</strong>
          {' · '}
          {stripRejectConfirm.timeRangeLabel}
        </p>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          This session will be marked rejected and removed from pending approval.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={rejectModalBusy}
            onClick={cancelStripSessionReject}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              borderRadius: 4,
              cursor: rejectModalBusy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={rejectModalBusy}
            onClick={() => void performStripSessionReject()}
            style={{
              padding: '0.5rem 1rem',
              background: rejectModalBusy ? '#9ca3af' : '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: rejectModalBusy ? 'not-allowed' : 'pointer',
            }}
          >
            {rejectModalBusy ? 'Rejecting…' : 'Reject session'}
          </button>
        </div>
      </div>
    </div>
  ) : null}
  {copyDayJobMixModal ? (
    <CopyDayJobMixModal
      open
      onClose={() => setCopyDayJobMixModal(null)}
      workDateYmd={clockStripWorkDateResolved}
      sourceUserId={copyDayJobMixModal.sourceUserId}
      sourceDisplayName={copyDayJobMixModal.sourceDisplayName}
      clockedInTodayRows={clockedInTodayRows}
      nowMs={nowMs}
      onApplied={() => onClockSessionsMutated?.()}
    />
  ) : null}
  {authUserId && enableScheduleDayEmail ? (
    <ScheduleDayEmailModal
      open={scheduleDayEmailOpen}
      onClose={() => setScheduleDayEmailOpen(false)}
      workDateYmd={clockStripWorkDateResolved}
      authUserId={authUserId}
      onScheduled={() => {
        onClockSessionsMutated?.()
      }}
    />
  ) : null}
  <ReportViewModal
    open={stripViewingReport != null}
    report={stripViewingReport}
    onClose={() => setStripViewingReport(null)}
    viewerRole={viewerRole}
  />
    </>
  )
}
