import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import { Link } from 'react-router-dom'
import type {
  ClockedInTodayStripRow,
  JobsWorkedTodayStripRow,
  TodaySessionStripRow,
} from '../hooks/useDashboardMyTeamSectionState'
import { approveClockSessions } from '../lib/approveClockSessions'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { useIntervalNowMs } from '../hooks/useIntervalNowMs'
import {
  AssignSessionJobPopover,
  type AssignSessionJobSavedPatch,
} from './clock-sessions/AssignSessionJobPopover'
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

function stripRowHasPendingApprovalMerged(
  row: ClockedInTodayStripRow,
  optimisticIds: ReadonlySet<string>,
): boolean {
  return row.todaySessions.some((s) => stripSessionIsPendingApprovalMerged(s, optimisticIds))
}

function stripRowInFocusedClockedInView(
  row: ClockedInTodayStripRow,
  optimisticIds: ReadonlySet<string>,
): boolean {
  return stripRowHasUnassignedSession(row) || stripRowHasPendingApprovalMerged(row, optimisticIds)
}

function stripActionsPayloadFromSession(
  s: TodaySessionStripRow,
  personName: string,
  timeRangeLabel: string,
  stripStatus: 'pending' | 'approved',
): ClockSessionStripActionsPayload {
  const hasJobOrBid = !!(s.job_ledger_id || s.bid_id)
  const fromEmbeds = formatClockSessionJobOrBidLabelFromEmbeds(s)
  const assignmentLabel =
    fromEmbeds ?? (s.job_ledger_id ? 'Job linked' : s.bid_id ? 'Bid linked' : null)
  const assignmentShortLabel = shortJobOrBidLabelFromEmbeds(s) ?? assignmentLabel
  const modalLines = formatClockSessionJobOrBidModalLinesFromEmbeds(s)
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
function shortJobOrBidLabel(s: ClockSessionRow): string | null {
  return shortJobOrBidLabelFromEmbeds(s)
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
        color: '#92400e',
        background: '#fffbeb',
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
  borderBottom: '1px solid #e5e7eb',
  fontWeight: 600,
  fontSize: '0.75rem',
  color: '#374151',
}
const td = {
  padding: '0.2rem 0.4rem',
  fontSize: '0.75rem',
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'middle' as const,
}

const stripSalaryNameSuffix: CSSProperties = {
  marginLeft: '0.15rem',
  fontSize: '0.68rem',
  color: '#9ca3af',
  fontWeight: 400,
}

/** Match ClockInOutButton enabled fill (`#ff6600`). */
const STRIP_SECTION_HEAD_BG = '#ff6600'
const STRIP_SECTION_HEAD_TEXT = '#ffffff'
/** Per-cell bottom edge (avoid border-collapse dropping the soft line under the first column). */
const STRIP_SECTION_HEAD_BOTTOM_EDGE = 'inset 0 -1px 0 0 rgba(255,255,255,0.22)'

const stripSectionTh: CSSProperties = {
  ...th,
  color: STRIP_SECTION_HEAD_TEXT,
  borderBottom: 'none',
  boxShadow: STRIP_SECTION_HEAD_BOTTOM_EDGE,
}

/** Chevron column width; also used to indent expanded session rows under the name column. */
const CLOCKED_IN_TODAY_EXPAND_COL = '1.75rem'

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
  color: '#6b7280',
  verticalAlign: 'top',
}

/** Content-width bottom rule under time + job + memo (not full inner table width). */
const clockedInTodaySessionBlock: CSSProperties = {
  display: 'inline-block',
  maxWidth: '100%',
  verticalAlign: 'top',
  borderBottom: '1px solid #e5e7eb',
  paddingBottom: '0.2rem',
}

const clockedInTodayDetailLink: CSSProperties = {
  color: '#2563eb',
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
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: active ? '#e5e7eb' : 'white',
  cursor: 'pointer',
  color: '#374151',
  fontWeight: active ? 600 : 500,
})

const jobBidCellFlex: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  minWidth: 0,
  flexWrap: 'wrap' as const,
}

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
  color: '#2563eb',
  textDecoration: 'none',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: '0 1 auto',
  minWidth: 0,
  fontSize: '0.72rem',
}

const jobBidStripMemo: CSSProperties = {
  flex: '1 1 0',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: '#6b7280',
  fontSize: '0.72rem',
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

const stripTableHost: CSSProperties = {
  position: 'relative',
}

const stripScopeOverlay: CSSProperties = {
  position: 'absolute',
  top: '0.2rem',
  right: '0.4rem',
  zIndex: 3,
}

/** Open clock sessions plus "Clocked in today" summary (Dashboard). Mount when there are open sessions or today rows so the tick interval runs when needed. */
export function DashboardTeamActiveClockStrip({
  sessions,
  hoursTodayByUserId,
  clockedInTodayRows,
  jobsWorkedTodayRows = [],
  showScopeToggle = false,
  clockStripScope = 'team',
  onClockStripScopeChange,
  showJobBidColumn = false,
  onJobBidSaved,
  onJobBidAssignError,
  onOpenStripMyTimeEditor,
  authUserId,
  canApproveClockSessions,
  onClockSessionsMutated,
  onMaterializeSalarySession,
  hideCurrentlyInTable = false,
}: {
  sessions: DashboardStripSession[]
  hoursTodayByUserId: Readonly<Record<string, number>>
  clockedInTodayRows: readonly ClockedInTodayStripRow[]
  jobsWorkedTodayRows?: readonly JobsWorkedTodayStripRow[]
  showScopeToggle?: boolean
  clockStripScope?: 'team' | 'everyone'
  onClockStripScopeChange?: (scope: 'team' | 'everyone') => void
  showJobBidColumn?: boolean
  onJobBidSaved?: (patch: AssignSessionJobSavedPatch) => void
  onJobBidAssignError?: (msg: string) => void
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
}) {
  const stripRejectTitleId = useId()
  const nowMs = useIntervalNowMs(45_000)
  const [salaryMaterializeBusyUserId, setSalaryMaterializeBusyUserId] = useState<string | null>(null)
  const [stripApproveBusy, setStripApproveBusy] = useState<ReadonlySet<string>>(() => new Set())
  const [stripRejectConfirm, setStripRejectConfirm] = useState<StripRejectClockSessionPayload | null>(null)
  const [stripActionsSession, setStripActionsSession] = useState<ClockSessionStripActionsPayload | null>(null)
  const [optimisticStripApprovedIds, setOptimisticStripApprovedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

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
        ? `${tIn} – Open`
        : `${tIn} – ${new Date(s.clocked_out_at!).toLocaleTimeString(undefined, timeOpts)}`
      return stripActionsPayloadFromSession(s, row.displayName, timeRangeLabel, st === 'approved' ? 'approved' : 'pending')
    }
    return normalizeStripActionsPayloadFallback(stripActionsSession)
  }, [stripActionsSession, clockedInTodayRows, optimisticStripApprovedIds])

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
  const clockedInTodayColSpan = 3
  const scopeShowsOverlay = showScopeToggle && !!onClockStripScopeChange
  const scopeHeaderReserve: CSSProperties = scopeShowsOverlay
    ? { paddingRight: 'clamp(8.5rem, 22vw, 10.5rem)' }
    : {}
  const clockedInTodayModeOverlay =
    showClockedInTodayToggle ? (
      <div style={stripScopeOverlay}>
        <button
          type="button"
          onClick={() =>
            setClockedInTodayTableMode((m) => (m === 'all' ? 'missing' : 'all'))
          }
          style={{ ...scopeBtn(false), flexShrink: 0 }}
          title="Limit to people with an unassigned session or a closed session pending approval"
          aria-label={
            clockedInTodayTableMode === 'all'
              ? 'Show only people needing attention: unassigned job or bid, or pending clock approval'
              : 'Show everyone clocked in today'
          }
        >
          {clockedInTodayTableMode === 'all' ? 'Needs attention' : 'Show all'}
        </button>
      </div>
    ) : null

  const rejectModalBusy =
    stripRejectConfirm != null && stripApproveBusy.has(stripRejectConfirm.sessionId)

  const actionsModalBusy =
    stripActionsPayload != null && stripApproveBusy.has(stripActionsPayload.sessionId)

  return (
    <>
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: '1rem',
      }}
    >
      <div style={stripTableHost}>
        {scopeShowsOverlay ? (
          <div style={stripScopeOverlay}>
            <div role="group" aria-label="Clocked-in list scope">
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
                My team
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
                Everyone
              </button>
            </div>
          </div>
        ) : null}
        {!hideCurrentlyInTable ? (
        <div style={{ overflowX: 'auto' }} aria-live="polite">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: STRIP_SECTION_HEAD_BG }}>
                <th
                  scope="col"
                  style={{ ...stripSectionTh, fontWeight: 700 }}
                  aria-label={`Person name; ${sessions.length} currently in`}
                >
                  Currently In ({sessions.length})
                </th>
                <th scope="col" style={{ ...stripSectionTh, textAlign: 'right' as const }}>
                  Today
                </th>
                <th scope="col" style={{ ...stripSectionTh, textAlign: 'right' as const }} aria-label="Session length and clock-in time">
                  Session | In
                </th>
                {showJobBidColumn ? (
                  <th scope="col" style={{ ...stripSectionTh, maxWidth: 220, ...scopeHeaderReserve }}>
                    Job or bid
                  </th>
                ) : (
                  <th scope="col" style={{ ...stripSectionTh, maxWidth: 200, ...scopeHeaderReserve }}>
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
              const fullJobBid = synthetic ? null : formatClockSessionJobOrBidLabel(s as ClockSessionRow)
              const shortJb = synthetic ? null : shortJobOrBidLabel(s as ClockSessionRow)
              const jobHref =
                !synthetic && s.job_ledger_id
                  ? `/jobs?edit=${encodeURIComponent(s.job_ledger_id)}`
                  : null
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
              const sessionInPartStyle: CSSProperties = { color: '#4b5563', fontWeight: 400 }
              const sessionInCell = (
                <>
                  <span style={sessionInPartStyle}>{elapsedStr}</span>
                  <span style={sessionInPartStyle}>{' | '}{inStr}</span>
                </>
              )
              const memo = (s.notes ?? '').trim()
              const hasJobOrBid = !synthetic && !!(s.job_ledger_id || s.bid_id)

              return (
                <tr key={s.id}>
                  <td style={td}>
                    {personName(s)}
                    {shouldShowSalaryStripNameSuffix(s) ? (
                      <span style={stripSalaryNameSuffix} title="Salary schedule">
                        (s)
                      </span>
                    ) : null}
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
                          border: 'none',
                          background: 'none',
                          padding: 0,
                          margin: 0,
                          cursor: 'pointer',
                          font: 'inherit',
                          fontWeight: 600,
                          color: '#1d4ed8',
                          textAlign: 'right',
                          width: '100%',
                        }}
                      >
                        {formatHoursH(todayH)}
                      </button>
                    ) : (
                      <span style={{ fontWeight: 600, color: '#374151' }}>{formatHoursH(todayH)}</span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' as const }}>
                    {sessionInCell}
                  </td>
                  {showJobBidColumn && (
                    <td style={{ ...td, maxWidth: 220 }}>
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
                              />
                            </span>
                          ) : null}
                          {synthetic && linkText ? (
                            <span style={{ fontSize: '0.72rem', color: '#6b7280' }} title={titleText}>
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
                                      color: '#2563eb',
                                      textDecoration: 'underline',
                                    }}
                                  >
                                    {salaryMaterializeBusyUserId === s.user_id ? '…' : 'Create session'}
                                  </button>
                                </>
                              ) : null}
                            </span>
                          ) : null}
                          {jobHref && linkText ? (
                            <Link to={jobHref} title={titleText} style={jobBidStripLink}>
                              {linkText}
                            </Link>
                          ) : bidHref && linkText ? (
                            <Link to={bidHref} title={titleText} style={jobBidStripLink}>
                              {linkText}
                            </Link>
                          ) : null}
                          <span style={jobBidStripMemo} title={memo || undefined}>
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
                            />
                          </span>
                        ) : null}
                      </div>
                    </td>
                  )}
                  {!showJobBidColumn && (
                    <td style={{ ...td, maxWidth: 200, color: '#6b7280', fontSize: '0.72rem' }}>
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                        }}
                        title={memo || undefined}
                      >
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
            borderTop: '1px solid #e5e7eb',
          }}
        >
          {clockedInTodayRows.length === 0 ? (
            <p style={{ margin: '0.35rem 0.4rem 0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
              No sessions recorded yet today.
            </p>
          ) : (
            <div
              id="clocked-in-today-section-panel"
              role="region"
              aria-labelledby="clocked-in-today-section-toggle"
            >
              <div
                style={{
                  position: 'relative',
                  ...(showClockedInTodayToggle ? { minHeight: '2.25rem' } : {}),
                }}
              >
                {showClockedInTodayToggle ? clockedInTodayModeOverlay : null}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                          style={{
                            border: 'none',
                            background: 'none',
                            padding: '0.1rem',
                            cursor: 'pointer',
                            fontSize: '0.65rem',
                            color: STRIP_SECTION_HEAD_TEXT,
                            lineHeight: 1,
                          }}
                        >
                          <span aria-hidden>
                            {clockedInTodayExpandMode === 'collapsed' ? '\u25B6' : '\u25BC'}
                          </span>
                        </button>
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
                          ...(showClockedInTodayToggle
                            ? { paddingRight: 'clamp(8rem, 20vw, 12rem)' }
                            : {}),
                        }}
                      >
                        {clockedInTodaySectionOpen ? 'Today | First clock-in' : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody hidden={!clockedInTodaySectionOpen}>
                    {!clockedInTodaySectionOpen ? null : clockedInTodayBodyRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={clockedInTodayColSpan}
                          style={{
                            ...td,
                            borderBottom: '1px solid #e5e7eb',
                            padding: '0.35rem 0.4rem 0.5rem',
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            ...(showClockedInTodayToggle
                              ? { paddingRight: 'clamp(8rem, 20vw, 12rem)' }
                              : {}),
                          }}
                        >
                          {clockedInTodayExpandMode === 'unassignedPeek'
                            ? 'No unassigned job/bid sessions today.'
                            : clockedInTodayTableMode === 'missing'
                              ? 'No sessions need attention today (unassigned job/bid or pending approval).'
                              : 'No rows to display.'}
                        </td>
                      </tr>
                    ) : (
                      clockedInTodayBodyRows.map((row) => {
                  const hasDetail = row.todaySessions.length > 0
                  const expanded = hasDetail && !collapsedClockedInTodayUserIds.has(row.userId)
                  const detailId = `clocked-in-today-detail-${row.userId}`
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
                                  ? `Hide today’s sessions for ${row.displayName}`
                                  : `Show today’s sessions for ${row.displayName}`
                              }
                              onClick={() =>
                                setCollapsedClockedInTodayUserIds((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(row.userId)) next.delete(row.userId)
                                  else next.add(row.userId)
                                  return next
                                })
                              }
                              style={{
                                border: 'none',
                                background: 'none',
                                padding: '0.1rem',
                                cursor: 'pointer',
                                fontSize: '0.65rem',
                                color: '#374151',
                                lineHeight: 1,
                              }}
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
                            {row.displayName}
                            {row.hasIntervalOverlapToday ? <StripClockOverlapBadge /> : null}
                          </span>
                        </td>
                        <td
                          style={{
                            ...clockedInTodayRowTd,
                            textAlign: 'left',
                            whiteSpace: 'nowrap' as const,
                            ...(showClockedInTodayToggle
                              ? { paddingRight: 'clamp(8rem, 20vw, 12rem)' }
                              : {}),
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
                              aria-label={`Edit today's time for ${row.displayName}`}
                              style={{
                                border: 'none',
                                background: 'none',
                                padding: 0,
                                margin: 0,
                                cursor: 'pointer',
                                font: 'inherit',
                                fontWeight: 600,
                                color: '#1d4ed8',
                              }}
                            >
                              {formatHoursH(row.hoursToday)}
                            </button>
                          ) : (
                            <span style={{ fontWeight: 600, color: '#374151' }}>
                              {formatHoursH(row.hoursToday)}
                            </span>
                          )}
                          <span style={{ color: '#4b5563', fontWeight: 400 }}>
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
                              background: '#fafafa',
                              padding: '0.35rem 0.5rem 0.45rem',
                              fontSize: '0.7rem',
                              color: '#6b7280',
                            }}
                          >
                            <div id={detailId} role="region" aria-label={`Today’s clock sessions for ${row.displayName}`}>
                              <div
                                style={{
                                  overflowX: 'auto',
                                  maxWidth: '100%',
                                  marginLeft: `calc(${CLOCKED_IN_TODAY_EXPAND_COL} + 0.45rem)`,
                                  borderLeft: '2px solid #e5e7eb',
                                  paddingLeft: '0.45rem',
                                }}
                              >
                                <table
                                  style={{
                                    borderCollapse: 'collapse',
                                    fontSize: '0.68rem',
                                    color: '#6b7280',
                                    width: 'auto',
                                  }}
                                >
                                  <caption style={srOnly}>{`Today’s sessions for ${row.displayName}`}</caption>
                                  <tbody>
                                    {row.todaySessions.map((s, idx) => {
                                      const tIn = new Date(s.clocked_in_at).toLocaleTimeString(undefined, timeOpts)
                                      const open = s.clocked_out_at == null
                                      const sec = sessionDurationSeconds(s.clocked_in_at, s.clocked_out_at, nowMs)
                                      const dur = formatDurationFromSeconds(sec)
                                      const memo = (s.notes ?? '').trim()
                                      const fullJobBid = formatClockSessionJobOrBidLabelFromEmbeds(s)
                                      const shortJb = shortJobOrBidLabelFromEmbeds(s)
                                      const jobHref = s.job_ledger_id
                                        ? `/jobs?edit=${encodeURIComponent(s.job_ledger_id)}`
                                        : null
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
                                        ? `${tIn} – Open`
                                        : `${tIn} – ${new Date(s.clocked_out_at!).toLocaleTimeString(undefined, timeOpts)}`
                                      return (
                                        <tr key={s.id || `${s.user_id}-${s.clocked_in_at}-${idx}`}>
                                          <td style={clockedInTodayDetailCell}>
                                            <div style={clockedInTodaySessionBlock}>
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
                                                          row.displayName,
                                                          timeRangeLabel,
                                                          stripApproveStatus === 'approved'
                                                            ? 'approved'
                                                            : 'pending',
                                                        ),
                                                      )
                                                    }}
                                                    onApprove={async () => {
                                                      await handleStripSessionApprove(s.id)
                                                    }}
                                                    onReject={async () => {}}
                                                  />
                                                ) : null}
                                                <span style={{ whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                                                  {open ? (
                                                    <>
                                                      {tIn} – <span style={{ fontWeight: 600, color: '#374151' }}>Open</span>
                                                      {' · '}
                                                      {formatElapsedOpen(s.clocked_in_at, nowMs)}
                                                    </>
                                                  ) : (
                                                    <>
                                                      {tIn} – {new Date(s.clocked_out_at!).toLocaleTimeString(undefined, timeOpts)}
                                                      {' · '}
                                                      {dur}
                                                    </>
                                                  )}
                                                </span>
                                                <div
                                                  style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap',
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
                                                        />
                                                      </span>
                                                    ) : null}
                                                    {jobHref && linkText ? (
                                                      <Link
                                                        to={jobHref}
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
                                                      style={{
                                                        ...jobBidStripMemo,
                                                        fontSize: '0.68rem',
                                                        flex: '0 1 auto',
                                                        whiteSpace: 'normal' as const,
                                                        overflow: 'visible',
                                                        textOverflow: 'clip',
                                                      }}
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
              borderTop: '1px solid #e5e7eb',
            }}
          >
            <div
              id="jobs-worked-today-section-panel"
              role="region"
              aria-labelledby="jobs-worked-today-section-toggle"
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                        style={{
                          border: 'none',
                          background: 'none',
                          padding: '0.1rem',
                          cursor: 'pointer',
                          fontSize: '0.65rem',
                          color: STRIP_SECTION_HEAD_TEXT,
                          lineHeight: 1,
                        }}
                      >
                        <span aria-hidden>
                          {jobsWorkedTodaySectionCollapsed ? '\u25B6' : '\u25BC'}
                        </span>
                      </button>
                    </th>
                    <th
                      scope="col"
                      aria-label={`Jobs worked today; each row shows job name with today's hours and people (${jobsWorkedTodayRows.length} jobs)`}
                      style={{
                        ...stripSectionTh,
                        ...(scopeShowsOverlay ? { paddingRight: 'clamp(8rem, 20vw, 12rem)' } : {}),
                      }}
                    >
                      <span style={srOnly}>{'Expand session rows per job. '}</span>
                      Jobs worked today ({jobsWorkedTodayRows.length})
                    </th>
                  </tr>
                </thead>
                <tbody hidden={jobsWorkedTodaySectionCollapsed}>
                  {jobsWorkedTodayRows.map((job) => {
                    const hasSessions = job.sessions.length > 0
                    const jobDetailExpanded =
                      hasSessions && !collapsedJobsWorkedTodayJobLedgerIds.has(job.jobLedgerId)
                    const jobDetailId = `jobs-worked-today-detail-${job.jobLedgerId}`
                    const jobHref = `/jobs?edit=${encodeURIComponent(job.jobLedgerId)}`
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
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  padding: '0.1rem',
                                  cursor: 'pointer',
                                  fontSize: '0.65rem',
                                  color: '#374151',
                                  lineHeight: 1,
                                }}
                              >
                                <span aria-hidden>{jobDetailExpanded ? '\u25BC' : '\u25B6'}</span>
                              </button>
                            ) : null}
                          </td>
                          <td
                            style={{
                              ...clockedInTodayRowTd,
                              ...(scopeShowsOverlay ? { paddingRight: 'clamp(8rem, 20vw, 12rem)' } : {}),
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
                                <Link
                                  to={jobHref}
                                  style={{
                                    ...clockedInTodayDetailLink,
                                    fontWeight: 600,
                                    flex: '0 1 auto',
                                    minWidth: 0,
                                  }}
                                  title={`${job.label} — ${jobLinkStatsLabel}`}
                                  aria-label={`Open job ${job.label}, ${jobLinkStatsLabel}`}
                                >
                                  {job.label}
                                </Link>
                                <span
                                  style={{
                                    flexShrink: 0,
                                    color: '#4b5563',
                                    fontWeight: 400,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {'[ '}
                                  <span style={{ fontWeight: 400, color: '#374151' }}>
                                    {formatHoursH(totalH)}
                                  </span>
                                  <span style={{ color: '#4b5563' }}>{' • '}</span>
                                  <span style={{ fontWeight: 600 }}>{job.distinctPeopleCount}</span>
                                  {' ]'}
                                </span>
                              </div>
                              {job.addressLine ? (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    color: '#6b7280',
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
                                background: '#fafafa',
                                padding: '0.35rem 0.5rem 0.45rem',
                                fontSize: '0.7rem',
                                color: '#6b7280',
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
                                    borderLeft: '2px solid #e5e7eb',
                                    paddingLeft: '0.45rem',
                                  }}
                                >
                                  <table
                                    style={{
                                      borderCollapse: 'collapse',
                                      fontSize: '0.68rem',
                                      color: '#6b7280',
                                      width: 'auto',
                                    }}
                                  >
                                    <caption style={srOnly}>{`Sessions on ${job.label}`}</caption>
                                    <tbody>
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
                                        const range = open
                                          ? `${tIn} – Open`
                                          : `${tIn} – ${new Date(s.clocked_out_at!).toLocaleTimeString(undefined, timeOpts)}`
                                        return (
                                          <tr key={s.id || `${s.user_id}-${idx}`}>
                                            <td style={clockedInTodayDetailCell}>
                                              <span
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '0.35rem',
                                                  flexWrap: 'wrap',
                                                }}
                                              >
                                                {stripPersonDisplayName(s)}
                                                {clockStripOverlapByUserId.get(s.user_id) ? (
                                                  <StripClockOverlapBadge />
                                                ) : null}
                                              </span>
                                            </td>
                                            <td
                                              style={{
                                                ...clockedInTodayDetailCell,
                                                whiteSpace: 'nowrap',
                                                paddingLeft: '0.5rem',
                                              }}
                                            >
                                              {range}
                                            </td>
                                            <td
                                              style={{
                                                ...clockedInTodayDetailCell,
                                                whiteSpace: 'nowrap',
                                                paddingLeft: '0.5rem',
                                                fontWeight: 600,
                                                color: '#1d4ed8',
                                              }}
                                            >
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
                                                    color: '#1d4ed8',
                                                    whiteSpace: 'nowrap',
                                                  }}
                                                >
                                                  {dur}
                                                </button>
                                              ) : (
                                                <span style={{ fontWeight: 600, color: '#1d4ed8' }}>{dur}</span>
                                              )}
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
          background: 'white',
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
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
          <strong style={{ color: '#374151' }}>{stripRejectConfirm.personName}</strong>
          {' · '}
          {stripRejectConfirm.timeRangeLabel}
        </p>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#6b7280' }}>
          This session will be marked rejected and removed from pending approval.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={rejectModalBusy}
            onClick={cancelStripSessionReject}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              background: 'white',
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
    </>
  )
}
