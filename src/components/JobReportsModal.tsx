import { useState, useEffect, type CSSProperties } from 'react'
import { supabase } from '../lib/supabase'
import ReportViewModal, { ReportDetailBody, type ReportForView } from './ReportViewModal'
import AdditionalReportModal from './AdditionalReportModal'
import type { UserRole } from '../hooks/useAuth'
import { displayReportTemplateName } from '../lib/reportTemplateDisplayName'

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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [viewingReport, setViewingReport] = useState<ReportForView | null>(null)
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
    setExpandedIds(new Set(reports.map((r) => r.id)))
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
      if (viewingReport) {
        setViewingReport(null)
        return
      }
      if (newReportOpen) {
        setNewReportOpen(false)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, viewingReport, newReportOpen, onClose])

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
  const allExpanded = reports.length > 0 && expandedIds.size === reports.length
  const allCollapsed = expandedIds.size === 0

  const toolbarBtnStyle: CSSProperties = {
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    background: 'none',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    cursor: 'pointer',
    color: '#374151',
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'white',
          zIndex,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e5e7eb',
            flexShrink: 0,
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{filterCreatedByUserId ? 'My reports for this job' : 'Reports'}</h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {!loading && reports.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setExpandedIds(new Set(reports.map((r) => r.id)))}
                  disabled={allExpanded}
                  style={{ ...toolbarBtnStyle, opacity: allExpanded ? 0.5 : 1, cursor: allExpanded ? 'not-allowed' : 'pointer' }}
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedIds(new Set())}
                  disabled={allCollapsed}
                  style={{ ...toolbarBtnStyle, opacity: allCollapsed ? 0.5 : 1, cursor: allCollapsed ? 'not-allowed' : 'pointer' }}
                >
                  Collapse all
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setNewReportOpen(true)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Add additional report
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '1rem',
                background: 'none',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#374151',
              }}
              aria-label="Close"
            >
              Close
            </button>
          </div>
        </header>

        <div style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
          {jobDisplayName}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 1.5rem 1.5rem' }}>
          {loading ? (
            <p style={{ color: '#6b7280' }}>Loading reports…</p>
          ) : reports.length === 0 ? (
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>No reports yet. Add one below.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {reports.map((r) => {
                const isExpanded = expandedIds.has(r.id)
                return (
                  <li
                    key={r.id}
                    style={{
                      marginBottom: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      background: '#fff',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        padding: '1rem',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpanded(r.id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Collapse report' : 'Expand report'}
                        style={{
                          flexShrink: 0,
                          width: 28,
                          height: 28,
                          padding: 0,
                          border: '1px solid #e5e7eb',
                          borderRadius: 4,
                          background: '#f9fafb',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          lineHeight: 1,
                          color: '#374151',
                        }}
                      >
                        {isExpanded ? '▾' : '▸'}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{displayReportTemplateName(r.template_name, userRole)}</div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          {r.created_by_name} · {new Date(r.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewingReport(r)}
                        style={{
                          ...toolbarBtnStyle,
                          flexShrink: 0,
                          fontSize: '0.8125rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Open in popup
                      </button>
                    </div>
                    {isExpanded && (
                      <div
                        style={{
                          padding: '0 1rem 1rem 1rem',
                          paddingLeft: 'calc(1rem + 28px + 0.5rem)',
                          borderTop: '1px solid #f3f4f6',
                          paddingTop: '0.75rem',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ReportDetailBody report={r} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <ReportViewModal open={!!viewingReport} report={viewingReport} onClose={() => setViewingReport(null)} viewerRole={userRole} />

      <AdditionalReportModal
        open={newReportOpen}
        onClose={() => setNewReportOpen(false)}
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
