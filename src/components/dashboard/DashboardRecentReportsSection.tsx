import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel'
import type { UserRole } from '../../hooks/useAuth'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { formatReportFieldValueInlineList } from '../../lib/reportSignatureField'
import {
  formatReportRowTime,
  isDashboardRecentReportsRole,
  openedNotShownCount,
  recentReportsNewCount,
  reportRowState,
  visibleRecentReports,
  type RecentReportRow,
} from '../../lib/dashboardRecentReports'
import ReportEditModal, { type ReportForEdit } from '../ReportEditModal'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { DashboardJobPicturesLinkRow } from './DashboardJobPicturesLinkRow'
import { RecentReportsSkeleton } from './DashboardSkeletons'
import { ReportEmailSettingsModal } from './ReportEmailSettingsModal'

/**
 * Inbox redesign (v2.1469): read/done state lives in report_reads (read_at /
 * done_at, cross-device). New = blue dot; opened = dimmed with a check, stays
 * in place (nothing vanishes on collapse); Done durably clears from the
 * dashboard (View all still shows everything). The old localStorage hidden /
 * hide-on-refresh machinery is gone — this key is read once to migrate old
 * hidden ids into done_at, then removed.
 */
const LEGACY_HIDE_ON_REFRESH_STORAGE_KEY = 'pipetooling_dashboard_hide_on_refresh_ids'

const rowActionChip = {
  fontSize: '0.75rem',
  padding: '0.2rem 0.6rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text-700)',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
} as const

export function DashboardRecentReportsSection({
  authUserId,
  role,
  submitLinkJobPicturesDispatchRequest,
}: {
  authUserId: string | undefined
  role: UserRole | null
  /** Shared with the job-row family — creates the `link_job_pictures` dispatch request. */
  submitLinkJobPicturesDispatchRequest?: (args: {
    jobId: string
    hcpNumber: string | null | undefined
    jobName: string | null | undefined
    jobAddress: string | null | undefined
  }) => Promise<void>
}) {
  const jobDetailModal = useJobDetailModal()
  const [recentReports, setRecentReports] = useState<RecentReportRow[]>([])
  const [recentReportsLoading, setRecentReportsLoading] = useState(false)
  const [isReportEnabledOnlyUser, setIsReportEnabledOnlyUser] = useState(false)
  const [readReportIds, setReadReportIds] = useState<Set<string>>(new Set())
  const [doneReportIds, setDoneReportIds] = useState<Set<string>>(new Set())
  /** Rows opened in THIS session stay listed (dimmed) even though read — nothing vanishes as you collapse. */
  const [sessionOpenedIds, setSessionOpenedIds] = useState<Set<string>>(new Set())
  const [showOpened, setShowOpened] = useState(false)
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null)
  const [editReportModalOpen, setEditReportModalOpen] = useState(false)
  const [reportForEdit, setReportForEdit] = useState<ReportForEdit | null>(null)
  const [recentReportsExpanded, setRecentReportsExpanded] = useState(false)
  const [emailSettingsOpen, setEmailSettingsOpen] = useState(false)
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
        const [{ data: reportsData }, { data: readsData }] = await Promise.all([
          supabase.rpc('list_reports_with_job_info'),
          supabase.from('report_reads').select('report_id, done_at').eq('user_id', authUserId),
        ])
        const arr = Array.isArray(reportsData) ? reportsData : []
        const list = arr.slice(0, 8).map((r: { id: string; template_name: string; job_display_name: string; created_at: string; created_by_name: string; field_values?: unknown; reported_at_lat?: number | null; reported_at_lng?: number | null; job_ledger_id?: string | null; job_hcp_number?: string; job_job_pictures_link?: string | null; job_address?: string | null }) => ({
          id: r.id,
          template_name: r.template_name,
          job_display_name: r.job_display_name,
          created_at: r.created_at,
          created_by_name: r.created_by_name,
          field_values: r.field_values as Record<string, string> | undefined,
          reported_at_lat: r.reported_at_lat ?? null,
          reported_at_lng: r.reported_at_lng ?? null,
          job_ledger_id: r.job_ledger_id ?? null,
          job_hcp_number: r.job_hcp_number ?? '',
          job_pictures_link: r.job_job_pictures_link ?? null,
          job_address: r.job_address ?? null,
        }))
        setRecentReports(list)
        const readIds = new Set<string>()
        const doneIds = new Set<string>()
        if (Array.isArray(readsData)) {
          for (const row of readsData) {
            if (!row?.report_id) continue
            readIds.add(row.report_id)
            if (row.done_at) doneIds.add(row.report_id)
          }
        }
        // One-time migration: ids the OLD flow hid on this device become Done
        // (server-side), so previously-cleared reports don't flood back.
        try {
          const raw = localStorage.getItem(LEGACY_HIDE_ON_REFRESH_STORAGE_KEY)
          if (raw) {
            const legacyIds = (JSON.parse(raw) as string[]).filter(
              (id) => list.some((r) => r.id === id) && !doneIds.has(id),
            )
            for (const id of legacyIds) {
              await supabase
                .from('report_reads')
                .upsert({ user_id: authUserId, report_id: id, done_at: new Date().toISOString() }, { onConflict: 'user_id,report_id' })
              readIds.add(id)
              doneIds.add(id)
            }
            localStorage.removeItem(LEGACY_HIDE_ON_REFRESH_STORAGE_KEY)
          }
        } catch {
          /* ignore legacy migration failures */
        }
        setReadReportIds(readIds)
        setDoneReportIds(doneIds)
        if (role !== 'primary' && list.some((r) => !readIds.has(r.id))) {
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

  const markRead = (reportId: string) => {
    setReadReportIds((prev) => new Set(prev).add(reportId))
    setSessionOpenedIds((prev) => new Set(prev).add(reportId))
    if (authUserId) {
      supabase.from('report_reads').upsert({ user_id: authUserId, report_id: reportId }, { onConflict: 'user_id,report_id' }).then(() => {})
    }
  }

  const markDone = (reportId: string) => {
    setReadReportIds((prev) => new Set(prev).add(reportId))
    setDoneReportIds((prev) => new Set(prev).add(reportId))
    setExpandedReportId((prev) => (prev === reportId ? null : prev))
    if (authUserId) {
      supabase
        .from('report_reads')
        .upsert({ user_id: authUserId, report_id: reportId, done_at: new Date().toISOString() }, { onConflict: 'user_id,report_id' })
        .then(() => {})
    }
  }

  const markUnread = (reportId: string) => {
    setReadReportIds((prev) => {
      const next = new Set(prev)
      next.delete(reportId)
      return next
    })
    setDoneReportIds((prev) => {
      const next = new Set(prev)
      next.delete(reportId)
      return next
    })
    setExpandedReportId((prev) => (prev === reportId ? null : prev))
    if (authUserId) {
      supabase.from('report_reads').delete().eq('user_id', authUserId).eq('report_id', reportId).then(() => {})
    }
  }

  const markAllOpened = () => {
    const unread = recentReports.filter((r) => reportRowState(r.id, readReportIds, doneReportIds) === 'new')
    for (const r of unread) markRead(r.id)
  }

  const newCount = recentReportsNewCount(recentReports, readReportIds, doneReportIds)
  const hiddenOpenedCount = openedNotShownCount(recentReports, readReportIds, doneReportIds, sessionOpenedIds)
  const showRecent = isDashboardRecentReportsRole(role)
  const nowMs = Date.now()

  return (
    <>
      {showRecent && (
        <div
          id="dash-reports"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--surface)',
            padding: recentReportsExpanded ? '0.85rem 1rem 1rem' : '0.85rem 1rem',
            marginTop: '1rem',
            marginBottom: '1rem',
            scrollMarginTop: 8,
          }}
        >
          {/* flex-wrap + fit-content title: at narrow widths the actions
              cluster drops to its own right-aligned line instead of the badge
              painting over "Mark all opened" (viewport sweep, v2.1469). */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: '0.5rem', rowGap: '0.25rem', marginBottom: recentReportsExpanded ? '0.5rem' : 0 }}>
            <button
              type="button"
              onClick={() => setRecentReportsExpanded((prev) => !prev)}
              aria-expanded={recentReportsExpanded}
              style={{ margin: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flex: '1 1 auto', minWidth: 'fit-content', gap: '0.45rem' }}
            >
              <span aria-hidden style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{recentReportsExpanded ? '▼' : '▶'}</span>
              <h2 style={{ fontSize: '1.125rem', margin: 0, whiteSpace: 'nowrap' }}>Recent Reports</h2>
              {newCount > 0 ? (
                <span
                  aria-label={`${newCount} new ${newCount === 1 ? 'report' : 'reports'}`}
                  style={{ background: '#3b82f6', color: '#ffffff', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, padding: '0.1rem 0.55rem', whiteSpace: 'nowrap' }}
                >
                  {newCount} new
                </span>
              ) : null}
            </button>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
            {recentReportsExpanded && newCount > 0 ? (
              <button
                type="button"
                onClick={markAllOpened}
                style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-link)', whiteSpace: 'nowrap' }}
              >
                Mark all opened
              </button>
            ) : null}
            {recentReportsExpanded && !isReportEnabledOnlyUser ? (
              <Link to="/jobs?tab=reports" style={{ fontSize: '0.8125rem', color: 'var(--text-link)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                View all →
              </Link>
            ) : null}
            {canManageReportEmails && (
              <button
                type="button"
                onClick={() => setEmailSettingsOpen(true)}
                title="Report email recipients"
                aria-label="Report email recipients"
                style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, padding: 0, border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true" style={{ display: 'block' }}>
                  <path d="M125.4 128C91.5 128 64 155.5 64 189.4C64 190.3 64 191.1 64.1 192L64 192L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 192L575.9 192C575.9 191.1 576 190.3 576 189.4C576 155.5 548.5 128 514.6 128L125.4 128zM528 256.3L528 448C528 456.8 520.8 464 512 464L128 464C119.2 464 112 456.8 112 448L112 256.3L266.8 373.7C298.2 397.6 341.7 397.6 373.2 373.7L528 256.3zM112 189.4C112 182 118 176 125.4 176L514.6 176C522 176 528 182 528 189.4C528 193.6 526 197.6 522.7 200.1L344.2 335.5C329.9 346.3 310.1 346.3 295.8 335.5L117.3 200.1C114 197.6 112 193.6 112 189.4z" />
                </svg>
              </button>
            )}
            </span>
          </div>
          {recentReportsExpanded && (
            <>
              {recentReportsLoading ? (
                <RecentReportsSkeleton />
              ) : recentReports.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {visibleRecentReports(recentReports, readReportIds, doneReportIds, sessionOpenedIds, showOpened).map((r) => {
                    const state = reportRowState(r.id, readReportIds, doneReportIds)
                    const isRead = state !== 'new'
                    const isExpanded = expandedReportId === r.id
                    const t = formatReportRowTime(r.created_at, nowMs)
                    return (
                      <li key={r.id} style={{ marginBottom: '0.5rem' }}>
                        <div
                          style={{
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            background: isExpanded ? 'var(--surface)' : isRead ? 'var(--bg-subtle)' : 'var(--surface)',
                            opacity: isRead && !isExpanded ? 0.72 : 1,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}
                            onClick={() => {
                              const nextExpanded = isExpanded ? null : r.id
                              setExpandedReportId(nextExpanded)
                              if (nextExpanded) markRead(r.id)
                            }}
                          >
                            {isRead ? (
                              <span aria-label="Opened" title="Opened" style={{ flexShrink: 0, marginTop: 4, color: 'var(--text-green-700, #15803d)', fontSize: '0.8rem', lineHeight: 1 }}>
                                ✓
                              </span>
                            ) : (
                              <span aria-label="New report" style={{ flexShrink: 0, width: 8, height: 8, borderRadius: 999, background: '#3b82f6', marginTop: 7 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  {r.job_ledger_id && role !== 'primary' ? (
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        jobDetailModal?.openJobDetail({
                                          jobId: r.job_ledger_id!,
                                          prefillRowLabel: `${(r.job_hcp_number ?? '').trim() || '—'} · ${r.job_display_name || 'Job'}`,
                                          prefillAddress: (r.job_address ?? '').trim() || null,
                                        })
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          jobDetailModal?.openJobDetail({
                                            jobId: r.job_ledger_id!,
                                            prefillRowLabel: `${(r.job_hcp_number ?? '').trim() || '—'} · ${r.job_display_name || 'Job'}`,
                                            prefillAddress: (r.job_address ?? '').trim() || null,
                                          })
                                        }
                                      }}
                                      aria-label={`Job details: ${r.job_display_name || 'Job'}`}
                                      title="Open job details"
                                      style={{ fontWeight: isRead ? 400 : 600, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--border-strong)', textUnderlineOffset: 3 }}
                                    >
                                      {r.job_display_name || 'Unknown job'}
                                    </span>
                                  ) : (
                                    <span style={{ fontWeight: isRead ? 400 : 600 }}>{r.job_display_name || 'Unknown job'}</span>
                                  )}
                                </span>
                                <span style={{ flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.clock}</span>
                              </div>
                              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                <span>
                                  {r.created_by_name} · {t.day}
                                  {isRead && !isExpanded ? ' · opened' : ''}
                                </span>
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
                              </div>
                            </div>
                          </div>
                          {isExpanded && (
                            <div
                              style={{ padding: '0.25rem 0.75rem 0.85rem', borderTop: '1px solid var(--border)', fontSize: '0.875rem' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.5rem 0 0.75rem' }}>
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
                                <p style={{ color: 'var(--text-faint)', fontSize: '0.875rem' }}>No content</p>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                {/* Primaries only reach their own Account-Man jobs (v2.2177 scoping),
                                    and reports span every job — so no job-detail door for them (v2.2222). */}
                                {r.job_ledger_id && role !== 'primary' ? (
                                  <button
                                    type="button"
                                    style={rowActionChip}
                                    onClick={() =>
                                      jobDetailModal?.openJobDetail({
                                        jobId: r.job_ledger_id!,
                                        prefillRowLabel: `${(r.job_hcp_number ?? '').trim() || '—'} · ${r.job_display_name || 'Job'}`,
                                        prefillAddress: (r.job_address ?? '').trim() || null,
                                      })
                                    }
                                  >
                                    Job detail
                                  </button>
                                ) : null}
                                {r.reported_at_lat != null && r.reported_at_lng != null ? (
                                  <a
                                    href={`https://www.google.com/maps?q=${r.reported_at_lat},${r.reported_at_lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`${Number(r.reported_at_lat).toFixed(4)}, ${Number(r.reported_at_lng).toFixed(4)}`}
                                    style={rowActionChip}
                                  >
                                    Map
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => markUnread(r.id)}
                                  style={{ ...rowActionChip, border: 'none', background: 'none', color: 'var(--text-muted)' }}
                                >
                                  Mark unread
                                </button>
                                <button
                                  type="button"
                                  onClick={() => markDone(r.id)}
                                  title="Clear from the dashboard on every device (still in View all)"
                                  style={{ ...rowActionChip, marginLeft: 'auto', border: '1px solid var(--text-link)', color: 'var(--text-link)', fontWeight: 600 }}
                                >
                                  ✓ Done
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No reports yet.{' '}
                  {isReportEnabledOnlyUser ? (
                    'Create one above.'
                  ) : (
                    <Link to="/jobs?tab=reports" style={{ color: 'var(--text-link)' }}>Create one</Link>
                  )}
                </p>
              )}
              {hiddenOpenedCount > 0 || showOpened ? (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem', paddingTop: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowOpened((v) => !v)}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-link)' }}
                  >
                    {showOpened
                      ? 'Hide opened reports'
                      : `Show ${hiddenOpenedCount} opened ${hiddenOpenedCount === 1 ? 'report' : 'reports'}`}
                  </button>
                </div>
              ) : null}
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
        <ReportEmailSettingsModal
          open={emailSettingsOpen}
          onClose={() => setEmailSettingsOpen(false)}
          authUserId={authUserId}
        />
      )}
    </>
  )
}
