import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel'
import type { UserRole } from '../../hooks/useAuth'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { displayReportTemplateName } from '../../lib/reportTemplateDisplayName'
import { formatReportFieldValueInlineList } from '../../lib/reportSignatureField'
import { recentReportsUnreadCount, recentReportsVisibleRows, type RecentReportRow } from '../../lib/dashboardRecentReports'
import ReportEditModal, { type ReportForEdit } from '../ReportEditModal'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { DashboardJobPicturesLinkRow } from './DashboardJobPicturesLinkRow'
import { RecentReportsSkeleton } from './DashboardSkeletons'
import { ReportEmailSettingsModal } from './ReportEmailSettingsModal'

const HIDE_ON_REFRESH_STORAGE_KEY = 'pipetooling_dashboard_hide_on_refresh_ids'

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
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null)
  // Pure initializer (no side effects): reads the ids persisted last session so
  // reports opened before this refresh start out hidden. It must NOT remove the
  // key here — under React StrictMode the initializer runs twice, and a removal
  // on the first run makes the second run read nothing, leaving this empty (the
  // "opened reports still show after refresh" bug). The write effect below keeps
  // the key in sync with readReportIds, so an explicit removal is unnecessary.
  const [hiddenReportIds, setHiddenReportIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(HIDE_ON_REFRESH_STORAGE_KEY)
      if (!raw) return new Set()
      const ids = JSON.parse(raw) as string[]
      if (!Array.isArray(ids)) return new Set()
      return new Set(ids)
    } catch {
      return new Set()
    }
  })
  const [hideOnRefreshPending, setHideOnRefreshPending] = useState(true)
  const [editReportModalOpen, setEditReportModalOpen] = useState(false)
  const [reportForEdit, setReportForEdit] = useState<ReportForEdit | null>(null)
  const [recentReportsExpanded, setRecentReportsExpanded] = useState(false)
  const [recentReportsView, setRecentReportsView] = useState<'unread' | 'all'>('unread')
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
    const showRecent = role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
    if (!showRecent) return
    setRecentReportsLoading(true)
    const load = async () => {
      try {
        const [{ data: reportsData }, { data: readsData }] = await Promise.all([
          supabase.rpc('list_reports_with_job_info'),
          supabase.from('report_reads').select('report_id').eq('user_id', authUserId),
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
        if (Array.isArray(readsData)) {
          for (const row of readsData) {
            if (row?.report_id) readIds.add(row.report_id)
          }
        }
        setReadReportIds(readIds)
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

  const dashboardReportsEnabled =
    role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
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

  useEffect(() => {
    const unreadCount = recentReportsUnreadCount(recentReports, hiddenReportIds, readReportIds)
    if (recentReportsView === 'unread' && unreadCount === 0) {
      setRecentReportsView('all')
    }
  }, [recentReports, readReportIds, hiddenReportIds, recentReportsView])

  useEffect(() => {
    if (!hideOnRefreshPending || readReportIds.size === 0) return
    const ids = Array.from(readReportIds)
    try {
      localStorage.setItem(HIDE_ON_REFRESH_STORAGE_KEY, JSON.stringify(ids))
    } catch {
      /* ignore */
    }
  }, [readReportIds, hideOnRefreshPending])

  const showRecent = role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'

  return (
    <>
      {showRecent && (
        <div
          id="dash-reports"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--surface)',
            padding: '0.85rem 1rem 1rem',
            marginTop: '1rem',
            marginBottom: '1rem',
            scrollMarginTop: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: recentReportsExpanded ? '0.5rem' : 0 }}>
            <button
              type="button"
              onClick={() => setRecentReportsExpanded((prev) => !prev)}
              aria-expanded={recentReportsExpanded}
              style={{ margin: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flex: 1, minWidth: 0, gap: '0.5rem' }}
            >
              <h2 style={{ fontSize: '1.125rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span aria-hidden>{recentReportsExpanded ? '▼' : '▶'}</span>
                Recent Reports ({recentReportsUnreadCount(recentReports, hiddenReportIds, readReportIds)})
              </h2>
            </button>
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
          </div>
          {recentReportsExpanded && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setRecentReportsView('unread')}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.8125rem',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      background: recentReportsView === 'unread' ? 'var(--bg-muted)' : 'transparent',
                      cursor: 'pointer',
                      fontWeight: recentReportsView === 'unread' ? 600 : 400,
                      color: 'inherit',
                    }}
                  >
                    Unread reports
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecentReportsView('all')}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.8125rem',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      background: recentReportsView === 'all' ? 'var(--bg-muted)' : 'transparent',
                      cursor: 'pointer',
                      fontWeight: recentReportsView === 'all' ? 600 : 400,
                      color: 'inherit',
                    }}
                  >
                    All recent reports
                  </button>
                </div>
                {!isReportEnabledOnlyUser && (
                  <Link to="/jobs?tab=reports" style={{ fontSize: '0.875rem', color: 'var(--text-link)', textDecoration: 'none' }}>View all →</Link>
                )}
              </div>
              {recentReportsLoading ? (
                <RecentReportsSkeleton />
              ) : recentReports.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {recentReportsVisibleRows(recentReports, hiddenReportIds, readReportIds, recentReportsView, expandedReportId)
                    .map((r) => {
                const isRead = readReportIds.has(r.id)
                    const isExpanded = expandedReportId === r.id
                    return (
                      <li key={r.id} style={{ marginBottom: '0.5rem' }}>
                        <div
                          style={{
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            background: isExpanded ? 'var(--surface)' : (isRead ? 'var(--bg-subtle)' : 'var(--surface)'),
                            opacity: isRead && !isExpanded ? 0.85 : 1,
                            overflow: 'hidden',
                          }}
                        >
                        <div
                          style={{
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                          }}
                          onClick={() => {
                            const nextExpanded = isExpanded ? null : r.id
                            setExpandedReportId(nextExpanded)
                            if (nextExpanded) {
                              setReadReportIds((prev) => new Set(prev).add(r.id))
                              if (authUserId) {
                                supabase.from('report_reads').upsert({ user_id: authUserId, report_id: r.id }, { onConflict: 'user_id,report_id' }).then(() => {})
                              }
                            }
                          }}
                        >
                        {!isRead && (
                          <span style={{ flexShrink: 0, width: 20, height: 20, color: 'var(--text-muted)', marginTop: 2 }} aria-hidden>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" style={{ width: '100%', height: '100%' }}>
                              <path d="M125.4 128C91.5 128 64 155.5 64 189.4C64 190.3 64 191.1 64.1 192L64 192L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 192L575.9 192C575.9 191.1 576 190.3 576 189.4C576 155.5 548.5 128 514.6 128L125.4 128zM528 256.3L528 448C528 456.8 520.8 464 512 464L128 464C119.2 464 112 456.8 112 448L112 256.3L266.8 373.7C298.2 397.6 341.7 397.6 373.2 373.7L528 256.3zM112 189.4C112 182 118 176 125.4 176L514.6 176C522 176 528 182 528 189.4C528 193.6 526 197.6 522.7 200.1L344.2 335.5C329.9 346.3 310.1 346.3 295.8 335.5L117.3 200.1C114 197.6 112 193.6 112 189.4z" />
                            </svg>
                          </span>
                        )}
                        {isRead && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setHiddenReportIds((prev) => new Set(prev).add(r.id))
                            }}
                            title="Hide from dashboard"
                            aria-label="Hide from dashboard"
                            style={{ flexShrink: 0, width: 24, height: 24, padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor" style={{ width: 14, height: 14 }}>
                              <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z" />
                            </svg>
                          </button>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {r.job_ledger_id ? (
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
                              style={{ fontWeight: 500, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--border-strong)', textUnderlineOffset: 3 }}
                            >
                              {r.job_display_name || 'Unknown job'}
                            </span>
                          ) : (
                            <span style={{ fontWeight: 500 }}>{r.job_display_name || 'Unknown job'}</span>
                          )}
                          {r.job_ledger_id && submitLinkJobPicturesDispatchRequest ? (
                            <span style={{ marginLeft: '0.5rem', verticalAlign: 'middle', display: 'inline-flex' }}>
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
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginLeft: '0.5rem' }}>· {displayReportTemplateName(r.template_name, role)}</span>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            {new Date(r.created_at).toLocaleString()} · {r.created_by_name}
                          </div>
                        </div>
                        {isRead && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setReadReportIds((prev) => {
                                const next = new Set(prev)
                                next.delete(r.id)
                                return next
                              })
                              if (authUserId) {
                                supabase.from('report_reads').delete().eq('user_id', authUserId).eq('report_id', r.id).then(() => {})
                              }
                            }}
                            title="Mark as unread"
                            aria-label="Mark as unread"
                            style={{ flexShrink: 0, width: 44, height: 44, padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginLeft: 'auto' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" style={{ width: 26, height: 26 }}>
                              <path d="M576 480C576 515.3 547.5 544 512.1 544L128 544C92.6 544 64 515.3 64 480L64 228C64.1 212.5 71.8 198 84.5 189.2L270 61.3C300.1 40.6 339.8 40.6 369.9 61.3L555.5 189.2C568.3 198 575.9 212.5 576 228L576 480zM128 496L512.1 496C520.9 496 528 488.9 528 480L528 288.3L373.2 405.7C341.8 429.6 298.3 429.6 266.8 405.7L112 288.3L112 480C112 488.9 119.2 496 128 496zM527.6 228.4L342.7 100.8C329 91.4 311 91.4 297.3 100.8L112.4 228.4L295.8 367.5C310.1 378.3 329.9 378.3 344.2 367.5L527.6 228.4z" />
                            </svg>
                          </button>
                        )}
                        </div>
                        {isExpanded && (
                          <div
                            style={{
                              padding: '0.75rem 0.75rem 1rem',
                              borderTop: '1px solid var(--border)',
                              fontSize: '0.875rem',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div style={{ marginBottom: '0.5rem' }}>
                              <div style={{ fontWeight: 600, fontSize: '1rem' }}>{displayReportTemplateName(r.template_name, role)}</div>
                              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{r.job_display_name || 'Unknown job'}</div>
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                              {new Date(r.created_at).toLocaleString()} · {r.created_by_name}
                              {r.reported_at_lat != null && r.reported_at_lng != null && (
                                <a
                                  href={`https://www.google.com/maps?q=${r.reported_at_lat},${r.reported_at_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`${Number(r.reported_at_lat).toFixed(4)}, ${Number(r.reported_at_lng).toFixed(4)}`}
                                  style={{ color: 'var(--text-link)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16}>
                                    <path d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z" fill="currentColor" />
                                  </svg>
                                </a>
                              )}
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
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem', paddingTop: '0.25rem' }}>
                <label
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    color: 'var(--text-faint)',
                    fontWeight: 300,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={hideOnRefreshPending}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setHideOnRefreshPending(checked)
                      if (checked) {
                        const ids = Array.from(readReportIds)
                        try {
                          localStorage.setItem(HIDE_ON_REFRESH_STORAGE_KEY, JSON.stringify(ids))
                        } catch {
                          /* ignore */
                        }
                      } else {
                        try {
                          localStorage.removeItem(HIDE_ON_REFRESH_STORAGE_KEY)
                        } catch {
                          /* ignore */
                        }
                      }
                    }}
                    style={{ margin: 0, accentColor: 'var(--text-faint)' }}
                  />
                  <span>hide from dashboard reports I've opened, on refresh</span>
                </label>
              </div>
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
