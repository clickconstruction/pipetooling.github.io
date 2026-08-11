import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ReportDetailBody, ReportLocationMapsLink, type ReportForView } from './ReportViewModal'
import AdditionalReportModal from './AdditionalReportModal'
import type { UserRole } from '../hooks/useAuth'
import { displayReportTemplateName } from '../lib/reportTemplateDisplayName'
import {
  buildJobReportsTimelineItems,
  jobReportsPercentArc,
  type JobReportsTimelineItem,
} from '../lib/jobReportsTimeline'
import { formatDispatchNoteDaysAgoShortPhrase } from '../utils/dispatchNoteDisplay'

type ReportWithJobInfo = ReportForView & {
  job_ledger_id: string | null
  project_id: string | null
  bid_id: string | null
  created_by_user_id?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  jobId: string
  hcpNumber: string
  jobName: string
  jobAddress: string
  authUserId: string | null
  userRole?: UserRole | null
  filterCreatedByUserId?: string | null
  zIndex?: number
  /** Called after a new report is saved from this modal (e.g. Dashboard refreshes Leave Report nag). */
  onReportSaved?: () => void
}

export default function JobReportsModal({
  open,
  onClose,
  jobId,
  hcpNumber,
  jobName,
  jobAddress,
  authUserId,
  userRole,
  filterCreatedByUserId,
  zIndex = 55,
  onReportSaved,
}: Props) {
  const [reports, setReports] = useState<ReportForView[]>([])
  const [loading, setLoading] = useState(false)
  /** Older reports the user opened in full — the newest is always shown in full. */
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [newReportOpen, setNewReportOpen] = useState(false)

  useEffect(() => {
    if (!open || !jobId) return
    setLoading(true)
    supabase
      .rpc('list_reports_with_job_info')
      .then(({ data, error }) => {
        setLoading(false)
        if (error) return
        const all = (data as ReportWithJobInfo[]) ?? []
        let filtered = all.filter((r) => r.job_ledger_id === jobId)
        if (filterCreatedByUserId) {
          filtered = filtered.filter((r) => r.created_by_user_id === filterCreatedByUserId)
        }
        setReports(filtered)
      })
  }, [open, jobId, filterCreatedByUserId])

  useEffect(() => {
    setExpandedIds(new Set())
  }, [reports])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' && e.key !== ' ') return
      if (e.key === ' ') {
        const target = e.target as HTMLElement
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'BUTTON' ||
          target.isContentEditable
        ) {
          return
        }
        e.preventDefault()
      }
      if (newReportOpen) {
        setNewReportOpen(false)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, newReportOpen, onClose])

  function handleReportAdded() {
    supabase.rpc('list_reports_with_job_info').then(({ data }) => {
      const all = (data as ReportWithJobInfo[]) ?? []
      let filtered = all.filter((r) => r.job_ledger_id === jobId)
      if (filterCreatedByUserId) {
        filtered = filtered.filter((r) => r.created_by_user_id === filterCreatedByUserId)
      }
      setReports(filtered)
    })
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!open) return null

  const jobDisplayName = `${hcpNumber} · ${jobName}`
  const timelineById = new Map<string, JobReportsTimelineItem>(
    buildJobReportsTimelineItems(reports).map((t) => [t.id, t]),
  )
  const arc = jobReportsPercentArc(reports)
  const arcLabel =
    arc == null
      ? null
      : arc.fromPercent === arc.toPercent
        ? `${arc.toPercent}% complete`
        : `${arc.fromPercent}% → ${arc.toPercent}% complete`

  const typeChipColor = (templateName: string): string => {
    const n = templateName.toLowerCase()
    if (n.includes('status')) return 'var(--text-link)'
    if (n.includes('walk')) return '#0f766e'
    if (n.includes('eod') || n.includes('end of day')) return '#7c3aed'
    return 'var(--text-muted)'
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--surface)',
          zIndex,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* One-line header (timeline redesign, v2.1548): title + arc subtitle + close.
            Top padding clears the iOS status bar/notch — this is a full-screen
            fixed overlay under viewport-fit=cover (v2.1574). */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            padding: 'calc(0.75rem + env(safe-area-inset-top, 0px)) 1rem 0.75rem',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {filterCreatedByUserId ? 'My reports' : 'Reports'} · {jobDisplayName}
            </h1>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
              {loading
                ? 'Loading…'
                : `${reports.length} ${reports.length === 1 ? 'report' : 'reports'}${arcLabel ? ` · ${arcLabel}` : ''}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reports"
            style={{
              flexShrink: 0,
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              borderRadius: 999,
              padding: '0.3rem 0.7rem',
              fontSize: '0.875rem',
              cursor: 'pointer',
              color: 'var(--text-700)',
            }}
          >
            ✕
          </button>
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1rem 1.5rem' }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading reports…</p>
          ) : reports.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No reports yet. Add one below.</p>
          ) : (
            <div>
              {reports.map((r, i) => {
                const t = timelineById.get(r.id)
                const isNewest = i === 0
                const expanded = isNewest || expandedIds.has(r.id)
                const isLast = i === reports.length - 1
                const chipName = displayReportTemplateName(r.template_name, userRole)
                return (
                  <div key={r.id} style={{ display: 'flex', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div
                        aria-hidden
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: isNewest ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                          color: isNewest ? 'var(--text-blue-700)' : 'var(--text-muted)',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {t?.initials ?? '?'}
                      </div>
                      {!isLast ? <div style={{ flex: 1, width: 2, background: 'var(--border)' }} /> : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : '1rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.35rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          marginBottom: '0.2rem',
                        }}
                        title={new Date(r.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      >
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>
                          {r.created_by_name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            color: typeChipColor(chipName),
                            background: 'var(--bg-subtle)',
                            borderRadius: 999,
                            padding: '1px 8px',
                          }}
                        >
                          {chipName.replace(/\s*Report$/i, '')}
                        </span>
                        <span>{formatDispatchNoteDaysAgoShortPhrase(r.created_at)}</span>
                        {t?.percent != null ? <span>· {t.percent}%</span> : null}
                        {r.reported_at_lat != null && r.reported_at_lng != null ? (
                          <ReportLocationMapsLink lat={Number(r.reported_at_lat)} lng={Number(r.reported_at_lng)} stopPropagation />
                        ) : null}
                      </div>
                      {expanded ? (
                        <>
                          <ReportDetailBody report={r} fieldLayout="inline" hideMeta />
                          {!isNewest ? (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(r.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                            >
                              Hide full report
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <div
                            style={{
                              fontSize: '0.8125rem',
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {t?.previewLine || '—'}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleExpanded(r.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.75rem', cursor: 'pointer', padding: 0, marginTop: 2 }}
                          >
                            Show full report
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => setNewReportOpen(true)}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Add additional report
          </button>
        </div>
      </div>

      <AdditionalReportModal
        open={newReportOpen}
        onClose={() => setNewReportOpen(false)}
        overlayZIndex={zIndex + 10}
        onSaved={() => {
          handleReportAdded()
          setNewReportOpen(false)
          onReportSaved?.()
        }}
        authUserId={authUserId}
        userRole={userRole}
        jobId={jobId}
        hcpNumber={hcpNumber}
        jobName={jobName}
        jobAddress={jobAddress}
      />
    </>
  )
}
