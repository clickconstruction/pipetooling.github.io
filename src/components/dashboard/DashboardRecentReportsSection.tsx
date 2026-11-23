import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { countedLabel } from '../../lib/batchWords'
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel'
import type { UserRole } from '../../hooks/useAuth'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { formatReportFieldValueInlineList } from '../../lib/reportSignatureField'
import {
  RECENT_REPORTS_OPENED_GLOSS,
  RECENT_REPORTS_OPENED_HEADING,
  buildRecentReportsCard,
  formatReportRowWhen,
  isDashboardRecentReportsRole,
  markedOpenedWords,
  readIdsWithOwnReports,
  recentReportsNewWords,
  recentReportsOpenedMoreWords,
  recentReportsWindowStartIso,
  reportsInWindow,
  reportsScopeLine,
  type RecentReportRow,
} from '../../lib/dashboardRecentReports'
import ReportEditModal, { type ReportForEdit } from '../ReportEditModal'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { DashboardJobPicturesLinkRow } from './DashboardJobPicturesLinkRow'
import { RecentReportsSkeleton } from './DashboardSkeletons'
import { EmailReportsModal } from '../jobs/EmailReportsModal'
import { useRecurringReportScopeMasters } from '../../hooks/useRecurringReportScopeMasters'
import { useAuth } from '../../hooks/useAuth'
import { EmptyState } from '../EmptyState'
import { RECENT_REPORTS_CLEAR_EMPTY, recentReportsEmptyWords } from '../../lib/dashboard/dashboardEmptyWords'
import { ReportPhotosStrip } from '../reports/ReportPhotosStrip'
import { ReportPhotoCount } from '../reports/ReportPhotoCount'
import { useReportPhotoCounts } from '../../hooks/useReportPhotoCounts'
import { DashboardCardHead, DashboardCardTitle } from './DashboardCardTitle'
import { WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { SwipeAwayRow } from '../shared/SwipeAwayRow'
import { handHeld } from '../../lib/paintedMap/handHeld'
import { swipeAwayHint } from '../../lib/swipeAway'

/**
 * Inbox redesign (v2.1469): the viewer's mark on a report lives in report_reads
 * (cross-device). New = blue dot; opened = a tick. Since punch list #426 there is
 * one put-away state: a report marked opened leaves the list for the Opened group
 * at the card's foot, where Mark unread puts it back. The older done_at reads as
 * opened. The old localStorage hidden ids are read once to migrate them into
 * done_at, then removed.
 */
const LEGACY_HIDE_ON_REFRESH_STORAGE_KEY = 'pipetooling_dashboard_hide_on_refresh_ids'

/** A word press on the card: one size, a thumb tall. */
const wordPress: CSSProperties = {
  flexShrink: 0,
  minHeight: 44,
  padding: '0 0.8rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text-700)',
  fontFamily: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
}
/** A door at the card's foot: link type, a thumb tall. */
const footDoor: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  minHeight: 44,
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--text-link)',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}
const footRow: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', minHeight: 44, borderTop: '1px solid var(--border)' }

type ReportsRpcRow = {
  id: string
  template_name: string
  job_display_name: string
  created_at: string
  created_by_name: string
  created_by_user_id?: string | null
  field_values?: unknown
  reported_at_lat?: number | null
  reported_at_lng?: number | null
  job_ledger_id?: string | null
  job_hcp_number?: string
  job_job_pictures_link?: string | null
  job_address?: string | null
}

export function DashboardRecentReportsSection({
  authUserId,
  role,
  submitLinkJobPicturesDispatchRequest,
  onCounts,
}: {
  authUserId: string | undefined
  role: UserRole | null
  /** How many reports the card holds and how many are new, for a host that draws the section folded (v2.3891). */
  onCounts?: (counts: { listed: number; fresh: number } | null) => void
  /** Shared with the job-row family — creates the `link_job_pictures` dispatch request. */
  submitLinkJobPicturesDispatchRequest?: (args: {
    jobId: string
    hcpNumber: string | null | undefined
    jobName: string | null | undefined
    jobAddress: string | null | undefined
  }) => Promise<void>
}) {
  const jobDetailModal = useJobDetailModal()
  const { showToast, showActionToast } = useToastContext()
  /** On a device held in the hand a report is marked opened with a swipe; at a desk, with a word press (punch list #426). */
  const swipes = useMemo(() => handHeld(), [])
  /** The reports of the window (`RECENT_REPORTS_WINDOW_DAYS`), newest first. */
  const [recentReports, setRecentReports] = useState<RecentReportRow[]>([])
  /** True once the database answered any report at all, in the window or older: an empty list then means nothing is new. */
  const [hasAnyReport, setHasAnyReport] = useState(false)
  const [recentReportsLoading, setRecentReportsLoading] = useState(false)
  const [isReportEnabledOnlyUser, setIsReportEnabledOnlyUser] = useState(false)
  /** Every report the viewer has a mark on (opened, or the older done), and their own. */
  const [readReportIds, setReadReportIds] = useState<Set<string>>(new Set())
  /** Rows opened in place in THIS session stay listed (dimmed): nothing vanishes under a finger. */
  const [sessionOpenedIds, setSessionOpenedIds] = useState<Set<string>>(new Set())
  const [openedGroupOpen, setOpenedGroupOpen] = useState(false)
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null)
  const [editReportModalOpen, setEditReportModalOpen] = useState(false)
  const [reportForEdit, setReportForEdit] = useState<ReportForEdit | null>(null)
  const nowMs = Date.now()
  const card = buildRecentReportsCard(recentReports, readReportIds, sessionOpenedIds, nowMs)
  // The photos (punch list #229, PR 3): one count read for the rows drawn, a badge on the folded row, the strip when open.
  const photoCounts = useReportPhotoCounts([...card.listed, ...card.opened].map((r) => r.id))
  useEffect(() => {
    onCounts?.(recentReportsLoading ? null : { listed: card.inWindow, fresh: card.fresh })
    // The counts are the message; the callback's identity is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentReportsLoading, card.inWindow, card.fresh])
  const [recentReportsExpanded, setRecentReportsExpanded] = useState(false)
  const [emailSettingsOpen, setEmailSettingsOpen] = useState(false)
  // v2.3570: Email reports opens the shared Email reports modal, whose Digests tab needs the
  // viewer's scope-leader choices; the hook is the same one Jobs → Reports uses.
  const { user: authUserForScopes, profileName: authProfileName } = useAuth()
  const scopeMasterChoices = useRecurringReportScopeMasters({ authUserId, authUserEmail: authUserForScopes?.email ?? null, authRole: role, authProfileName })
  // Same gate as the clock-strip schedule-email button (excludes primary).
  const canManageReportEmails =
    role === 'dev' || role === 'master_technician' || isAssistantLike(role)

  useEffect(() => {
    if (!authUserId) return
    supabase.from('report_enabled_users').select('user_id').eq('user_id', authUserId).maybeSingle().then(({ data }) => {
      setIsReportEnabledOnlyUser(!!data)
    })
  }, [authUserId])

  const loadRecentReportsRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!authUserId) return
    const showRecent = isDashboardRecentReportsRole(role)
    if (!showRecent) return
    setRecentReportsLoading(true)
    const load = async () => {
      try {
        const loadedAtMs = Date.now()
        const [{ data: reportsData }, { data: readsData }] = await Promise.all([
          supabase.rpc('list_reports_with_job_info'),
          // A report filed inside the window can only have been marked inside it, so the marks are read from
          // the window's start: a bounded read, where it used to ask for every mark the person ever made.
          supabase.from('report_reads').select('report_id, done_at').eq('user_id', authUserId).gte('read_at', recentReportsWindowStartIso(loadedAtMs)),
        ])
        const arr = (Array.isArray(reportsData) ? reportsData : []) as ReportsRpcRow[]
        const list: RecentReportRow[] = reportsInWindow(arr, loadedAtMs).map((r) => ({
          id: r.id,
          template_name: r.template_name,
          job_display_name: r.job_display_name,
          created_at: r.created_at,
          created_by_name: r.created_by_name,
          created_by_user_id: r.created_by_user_id ?? null,
          field_values: r.field_values as Record<string, string> | undefined,
          reported_at_lat: r.reported_at_lat ?? null,
          reported_at_lng: r.reported_at_lng ?? null,
          job_ledger_id: r.job_ledger_id ?? null,
          job_hcp_number: r.job_hcp_number ?? '',
          job_pictures_link: r.job_job_pictures_link ?? null,
          job_address: r.job_address ?? null,
        }))
        setHasAnyReport(arr.length > 0)
        setRecentReports(list)
        const readIds = new Set<string>()
        if (Array.isArray(readsData)) {
          for (const row of readsData) {
            if (row?.report_id) readIds.add(row.report_id)
          }
        }
        // One-time migration: ids the OLD flow hid on this device become marks
        // (server-side), so previously-cleared reports don't flood back.
        try {
          const raw = localStorage.getItem(LEGACY_HIDE_ON_REFRESH_STORAGE_KEY)
          if (raw) {
            const legacyIds = (JSON.parse(raw) as string[]).filter(
              (id) => list.some((r) => r.id === id) && !readIds.has(id),
            )
            for (const id of legacyIds) {
              await supabase
                .from('report_reads')
                .upsert({ user_id: authUserId, report_id: id, done_at: new Date().toISOString() }, { onConflict: 'user_id,report_id' })
              readIds.add(id)
            }
            localStorage.removeItem(LEGACY_HIDE_ON_REFRESH_STORAGE_KEY)
          }
        } catch {
          /* ignore legacy migration failures */
        }
        // The viewer's own reports are never new to them (punch list #384): no row is written, they only read as opened.
        const readWithOwn = readIdsWithOwnReports(readIds, list, authUserId)
        setReadReportIds(readWithOwn)
        if (role !== 'primary' && list.some((r) => !readWithOwn.has(r.id))) {
          setRecentReportsExpanded(true)
        }
      } finally {
        setRecentReportsLoading(false)
      }
    }
    loadRecentReportsRef.current = load
    load()
  }, [authUserId, role, isReportEnabledOnlyUser])

  const dashboardReportsEnabled = isDashboardRecentReportsRole(role)
  const dashboardReportsFilters = useMemo(
    () => [{ event: '*' as const, schema: 'public', table: 'reports' }],
    [],
  )
  useRealtimeChannel(
    dashboardReportsEnabled,
    'dashboard-reports-changes',
    dashboardReportsFilters,
    () => {
      loadRecentReportsRef.current?.()
    },
    { debounceMs: 500 },
  )

  /** A mark that did not save: say why, and read the marks again so the card shows what the database holds. */
  const markFailed = (e: unknown) => {
    showToast(formatErrorMessage(e, 'Could not save the mark'), 'error')
    loadRecentReportsRef.current?.()
  }
  const saveMarks = (ids: string[]) => {
    if (!authUserId || ids.length === 0) return
    void withSupabaseRetry(
      async () => supabase.from('report_reads').upsert(ids.map((report_id) => ({ user_id: authUserId, report_id })), { onConflict: 'user_id,report_id' }),
      'mark reports opened',
    ).catch(markFailed)
  }
  const dropMarks = (ids: string[]) => {
    if (!authUserId || ids.length === 0) return
    void withSupabaseRetry(async () => supabase.from('report_reads').delete().eq('user_id', authUserId).in('report_id', ids), 'mark reports unread').catch(markFailed)
  }
  const withIds = (prev: Set<string>, ids: string[], on: boolean) => {
    const next = new Set(prev)
    for (const id of ids) {
      if (on) next.add(id)
      else next.delete(id)
    }
    return next
  }

  /** A press on a report opens it in place. That marks it opened, and it stays in the list, dimmed, for this session. */
  const openInPlace = (reportId: string) => {
    const opening = expandedReportId !== reportId
    setExpandedReportId(opening ? reportId : null)
    if (!opening || readReportIds.has(reportId)) return
    setReadReportIds((prev) => withIds(prev, [reportId], true))
    setSessionOpenedIds((prev) => withIds(prev, [reportId], true))
    saveMarks([reportId])
  }

  /**
   * Mark opened: the reports leave the list for the Opened group at once, one report or every new one
   * in the list. Undo puts each back as it was: a new report loses its mark, and one that was open in
   * place goes back to the list dimmed.
   */
  const putAway = (reports: RecentReportRow[]) => {
    if (reports.length === 0) return
    const ids = reports.map((r) => r.id)
    const wereNew = ids.filter((id) => !readReportIds.has(id))
    const wereInPlace = ids.filter((id) => sessionOpenedIds.has(id))
    setReadReportIds((prev) => withIds(prev, ids, true))
    setSessionOpenedIds((prev) => withIds(prev, ids, false))
    setExpandedReportId((prev) => (prev && ids.includes(prev) ? null : prev))
    saveMarks(wereNew)
    showActionToast(
      markedOpenedWords(reports.map((r) => r.job_display_name)),
      {
        label: 'Undo',
        onClick: () => {
          setReadReportIds((prev) => withIds(prev, wereNew, false))
          setSessionOpenedIds((prev) => withIds(prev, wereInPlace, true))
          dropMarks(wereNew)
        },
      },
      { durationMs: 10000 },
    )
  }

  const markUnread = (reportId: string) => {
    setReadReportIds((prev) => withIds(prev, [reportId], false))
    setSessionOpenedIds((prev) => withIds(prev, [reportId], false))
    setExpandedReportId((prev) => (prev === reportId ? null : prev))
    dropMarks([reportId])
  }

  const showRecent = isDashboardRecentReportsRole(role)
  // A primary reads their own jobs' reports alone (the database decides); the line says so over the list.
  const scopeLine = reportsScopeLine(role)
  const newListed = card.listed.filter((r) => !readReportIds.has(r.id))
  const openedMore = recentReportsOpenedMoreWords(card.opened.length, card.openedCount)

  /** One report: its mark, its job, who filed it and when as one value, and its press on the right. */
  const reportRow = (r: RecentReportRow, mode: 'listed' | 'opened') => {
    const isRead = readReportIds.has(r.id)
    const isExpanded = expandedReportId === r.id
    const name = r.job_display_name || 'Unknown job'
    const openJob = () =>
      jobDetailModal?.openJobDetail({
        jobId: r.job_ledger_id!,
        prefillRowLabel: `${(r.job_hcp_number ?? '').trim() || '—'} · ${r.job_display_name || 'Job'}`,
        prefillAddress: (r.job_address ?? '').trim() || null,
      })
    const mark = isRead ? (
      <span aria-label="Opened" title="Opened" style={{ flexShrink: 0, width: 12, textAlign: 'center', color: 'var(--text-green-700)', fontSize: '0.8rem', lineHeight: 1 }}>
        ✓
      </span>
    ) : (
      <span aria-label="New report" style={{ flexShrink: 0, width: 8, height: 8, margin: '0 2px', borderRadius: 999, background: '#3b82f6' }} />
    )
    // A press anywhere on the report opens it in place (the owner's pick of 2026-11-23): the name used to
    // open the job and the rest of the row the report. Job detail is inside the opened report.
    const words = (
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        data-report-open
        onClick={() => openInPlace(r.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openInPlace(r.id)
          }
        }}
        style={{ flex: 1, minWidth: 0, minHeight: 44, display: 'grid', alignContent: 'center', gap: '0.15rem', cursor: 'pointer', opacity: isRead && !isExpanded ? 0.78 : 1 }}
      >
        <span style={{ fontWeight: isRead ? 400 : 600, overflowWrap: 'anywhere', lineHeight: 1.3 }}>{name}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem 0.45rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span>{r.created_by_name}</span>
          <WorkedOutValue>{formatReportRowWhen(r.created_at, nowMs)}</WorkedOutValue>
          <ReportPhotoCount count={photoCounts.get(r.id)} tone={isRead ? 'quiet' : 'new'} />
          {r.job_ledger_id && submitLinkJobPicturesDispatchRequest ? (
            <span style={{ display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
              <DashboardJobPicturesLinkRow
                layout="inline"
                jobPicturesLink={r.job_pictures_link}
                onMissingClick={() =>
                  void submitLinkJobPicturesDispatchRequest({
                    jobId: r.job_ledger_id!,
                    hcpNumber: r.job_hcp_number,
                    jobName: r.job_display_name,
                    jobAddress: r.job_address,
                  })
                }
              />
            </span>
          ) : null}
        </span>
      </div>
    )
    // The row is opaque so it covers the strip it slides over.
    const rowBox: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.35rem 0', background: 'var(--surface)' }
    return (
      <li key={r.id} data-report-row={r.id} style={{ borderTop: '1px solid var(--border)' }}>
        {mode === 'listed' ? (
          // A swipe to the left marks the report opened on a device held in the hand; at a desk the same act is the word press.
          <SwipeAwayRow label="Mark opened" name={name} swipe={swipes} onAway={() => putAway([r])}>
            {(press) => (
              <div style={rowBox}>
                {mark}
                {words}
                {press ?? (
                  <span aria-hidden style={{ flexShrink: 0, color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1 }}>
                    {isExpanded ? '▾' : '›'}
                  </span>
                )}
              </div>
            )}
          </SwipeAwayRow>
        ) : (
          <div style={rowBox}>
            {mark}
            {words}
            <button type="button" onClick={() => markUnread(r.id)} aria-label={`Mark unread, ${name}`} style={wordPress}>
              Mark unread
            </button>
          </div>
        )}
        {isExpanded && (
          <div style={{ padding: '0 0 0.85rem 1.3rem', fontSize: '0.875rem' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.75rem' }}>
              {new Date(r.created_at).toLocaleString()} · {r.created_by_name}
            </div>
            {r.field_values && Object.keys(r.field_values).length > 0 ? (
              <div>
                {Object.entries(r.field_values).map(([label, val]) =>
                  val ? (
                    <div key={label} style={{ marginBottom: '0.75rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                        {label}
                      </span>
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{formatReportFieldValueInlineList(val)}</div>
                    </div>
                  ) : null
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--text-faint)', fontSize: '0.875rem' }}>This report has no answers.</p>
            )}
            {/* The report's photos (punch list #229, PR 3): in Drive, or not in Drive yet with the reason. */}
            <ReportPhotosStrip reportId={r.id} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              {/* Primaries only reach their own Account-Man jobs (v2.2177 scoping),
                  and reports span every job — so no job-detail door for them (v2.2222). */}
              {r.job_ledger_id && role !== 'primary' ? (
                <button type="button" style={wordPress} onClick={openJob}>
                  Job detail
                </button>
              ) : null}
              {r.reported_at_lat != null && r.reported_at_lng != null ? (
                <a
                  href={`https://www.google.com/maps?q=${r.reported_at_lat},${r.reported_at_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${Number(r.reported_at_lat).toFixed(4)}, ${Number(r.reported_at_lng).toFixed(4)}`}
                  style={wordPress}
                >
                  Map
                </a>
              ) : null}
              {mode === 'listed' ? (
                <button type="button" onClick={() => markUnread(r.id)} style={wordPress}>
                  Mark unread
                </button>
              ) : null}
            </div>
          </div>
        )}
      </li>
    )
  }
  const reportList: CSSProperties = { listStyle: 'none', padding: 0, margin: 0 }

  return (
    <>
      {showRecent && (
        <div
          id="dash-reports"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--surface)',
            padding: recentReportsExpanded ? '0.85rem 1rem 0.25rem' : '0.85rem 1rem',
            marginTop: '1rem',
            marginBottom: '1rem',
            scrollMarginTop: 8,
          }}
        >
          {/* One row at every width (punch list #426): the fold, the title and its badge. Mark N opened,
              Email reports and View all were here too and wrapped the heading onto a second row on every
              phone. They are at the card's foot now. */}
          <DashboardCardHead closed={!recentReportsExpanded} below="0.25rem" style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setRecentReportsExpanded((prev) => !prev)}
              aria-expanded={recentReportsExpanded}
              style={{ margin: 0, padding: 0, minHeight: 44, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flex: '1 1 auto', minWidth: 0, gap: '0.45rem' }}
            >
              <span aria-hidden style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{recentReportsExpanded ? '▼' : '▶'}</span>
              <DashboardCardTitle nowrap>Recent Reports</DashboardCardTitle>
              {card.fresh > 0 ? (
                <span
                  aria-label={`${card.fresh} new ${card.fresh === 1 ? 'report' : 'reports'}`}
                  style={{ background: '#2563eb', color: '#ffffff', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, padding: '0.1rem 0.55rem', whiteSpace: 'nowrap' }}
                >
                  {card.fresh} new
                </span>
              ) : null}
            </button>
          </DashboardCardHead>
          {recentReportsExpanded && (
            <>
              {scopeLine ? (
                <p data-reports-scope style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{scopeLine}</p>
              ) : null}
              {recentReportsLoading ? (
                <RecentReportsSkeleton />
              ) : (
                <>
                  {card.listed.length > 0 ? (
                    <ul data-reports-list style={{ ...reportList, marginTop: scopeLine ? 0 : '-1px' }}>
                      {card.listed.map((r) => reportRow(r, 'listed'))}
                    </ul>
                  ) : (
                    // Reports on file and none new is the good state; no report at all names where one is written.
                    <EmptyState compact {...(hasAnyReport ? RECENT_REPORTS_CLEAR_EMPTY : recentReportsEmptyWords(isReportEnabledOnlyUser, role === 'primary'))} />
                  )}
                  {card.openedCount > 0 ? (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      <h3 style={{ margin: 0 }}>
                        <button
                          type="button"
                          onClick={() => setOpenedGroupOpen((v) => !v)}
                          aria-expanded={openedGroupOpen}
                          aria-label={`${RECENT_REPORTS_OPENED_HEADING}, ${card.openedCount} ${card.openedCount === 1 ? 'report' : 'reports'}`}
                          style={{ width: '100%', minHeight: 44, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: '0.5rem', alignItems: 'center', margin: 0, padding: '0.4rem 0', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-strong)' }}
                        >
                          <span aria-hidden style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {openedGroupOpen ? '▼' : '▶'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>{RECENT_REPORTS_OPENED_HEADING}</span>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, padding: '0 0.45rem', borderRadius: 999, background: 'var(--bg-muted)', color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>{card.openedCount}</span>
                          </span>
                          {openedGroupOpen ? <span style={{ gridColumn: 2, fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-muted)' }}>{RECENT_REPORTS_OPENED_GLOSS}</span> : null}
                        </button>
                      </h3>
                      {openedGroupOpen ? (
                        <>
                          <ul data-reports-opened style={reportList}>
                            {card.opened.map((r) => reportRow(r, 'opened'))}
                          </ul>
                          {openedMore ? <p style={{ margin: 0, padding: '0.5rem 0', borderTop: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{openedMore}</p> : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  {/* The foot: what acts on the whole list, then the two doors. Each row reads what it is on the left and has its press on the right. */}
                  {card.listed.length > 0 ? (
                    <div data-reports-foot="mark" style={footRow}>
                      <span data-reports-hint={swipes ? 'swipe' : 'count'} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0.35rem 0' }}>
                        {swipes ? swipeAwayHint('report', 'mark it opened') : recentReportsNewWords(card.fresh)}
                      </span>
                      {newListed.length > 0 ? (
                        <button type="button" onClick={() => putAway(newListed)} style={wordPress}>
                          {countedLabel('Mark', newListed.length, ['opened', 'opened'])}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {canManageReportEmails || !isReportEnabledOnlyUser ? (
                    <div data-reports-foot="doors" style={footRow}>
                      {canManageReportEmails ? (
                        <button type="button" onClick={() => setEmailSettingsOpen(true)} title="Email reports — who gets every report as it's filed" style={footDoor}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true" style={{ display: 'block' }}>
                            <path d="M125.4 128C91.5 128 64 155.5 64 189.4C64 190.3 64 191.1 64.1 192L64 192L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 192L575.9 192C575.9 191.1 576 190.3 576 189.4C576 155.5 548.5 128 514.6 128L125.4 128zM528 256.3L528 448C528 456.8 520.8 464 512 464L128 464C119.2 464 112 456.8 112 448L112 256.3L266.8 373.7C298.2 397.6 341.7 397.6 373.2 373.7L528 256.3zM112 189.4C112 182 118 176 125.4 176L514.6 176C522 176 528 182 528 189.4C528 193.6 526 197.6 522.7 200.1L344.2 335.5C329.9 346.3 310.1 346.3 295.8 335.5L117.3 200.1C114 197.6 112 193.6 112 189.4z" />
                          </svg>
                          Email reports
                        </button>
                      ) : (
                        <span />
                      )}
                      {!isReportEnabledOnlyUser ? (
                        <Link to="/jobs?tab=reports" style={footDoor}>
                          View all ›
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
      )}
      <ReportEditModal
        open={editReportModalOpen}
        report={reportForEdit}
        onClose={() => {
          setEditReportModalOpen(false)
          setReportForEdit(null)
        }}
        onSaved={() => {
          loadRecentReportsRef.current?.()
        }}
        viewerRole={role}
      />
      {canManageReportEmails && (
        <EmailReportsModal
          open={emailSettingsOpen}
          onClose={() => setEmailSettingsOpen(false)}
          authUserId={authUserId}
          authRole={role}
          scopeMasterChoices={scopeMasterChoices}
        />
      )}
    </>
  )
}
