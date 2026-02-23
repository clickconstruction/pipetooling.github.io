import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ReportViewModal from './ReportViewModal'
import AdditionalReportModal from './AdditionalReportModal'

type ReportForView = {
  id: string
  template_name: string
  job_display_name: string
  created_at: string
  created_by_name: string
  field_values?: Record<string, string>
}

type ReportWithJobInfo = ReportForView & {
  job_ledger_id: string | null
  project_id: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  jobId: string
  hcpNumber: string
  jobName: string
  jobAddress: string
  authUserId: string | null
}

export default function JobReportsModal({ open, onClose, jobId, hcpNumber, jobName, jobAddress, authUserId }: Props) {
  const [reports, setReports] = useState<ReportForView[]>([])
  const [loading, setLoading] = useState(false)
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
        const filtered = all.filter((r) => r.job_ledger_id === jobId)
        setReports(filtered)
      })
  }, [open, jobId])

  function handleReportAdded() {
    supabase.rpc('list_reports_with_job_info').then(({ data }) => {
      const all = (data as ReportWithJobInfo[]) ?? []
      const filtered = all.filter((r) => r.job_ledger_id === jobId)
      setReports(filtered)
    })
  }

  if (!open) return null

  const jobDisplayName = `${hcpNumber} · ${jobName}`

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'white',
          zIndex: 55,
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
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Reports</h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
              {reports.map((r) => (
                <li
                  key={r.id}
                  style={{
                    padding: '1rem',
                    marginBottom: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: '#fff',
                  }}
                  onClick={() => setViewingReport(r)}
                  onKeyDown={(e) => e.key === 'Enter' && setViewingReport(r)}
                  role="button"
                  tabIndex={0}
                >
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{r.template_name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {r.created_by_name} · {new Date(r.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ReportViewModal open={!!viewingReport} report={viewingReport} onClose={() => setViewingReport(null)} />

      <AdditionalReportModal
        open={newReportOpen}
        onClose={() => setNewReportOpen(false)}
        onSaved={() => {
          handleReportAdded()
          setNewReportOpen(false)
        }}
        authUserId={authUserId}
        jobId={jobId}
        hcpNumber={hcpNumber}
        jobName={jobName}
        jobAddress={jobAddress}
      />
    </>
  )
}
