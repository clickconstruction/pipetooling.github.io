import { useState, useMemo } from 'react'

export type ReportForMyReports = {
  id: string
  template_id: string
  template_name: string
  job_display_name: string
  job_ledger_id?: string | null
  project_id?: string | null
  created_at: string
  created_by_name: string
  field_values?: Record<string, string>
}

type Props = {
  open: boolean
  onClose: () => void
  reports: ReportForMyReports[]
  reportEditWindowDays: number
  onViewReport: (report: ReportForMyReports) => void
  onEditReport: (report: ReportForMyReports) => void
}

function matchesSearch(report: ReportForMyReports, q: string): boolean {
  const lower = q.toLowerCase()
  if ((report.job_display_name ?? '').toLowerCase().includes(lower)) return true
  if ((report.template_name ?? '').toLowerCase().includes(lower)) return true
  const fv = report.field_values ?? {}
  for (const val of Object.values(fv)) {
    if (String(val).toLowerCase().includes(lower)) return true
  }
  return false
}

function getJobKey(report: ReportForMyReports): string {
  return report.job_ledger_id ?? report.project_id ?? report.job_display_name ?? 'unknown'
}

export default function MyReportsModal({
  open,
  onClose,
  reports,
  reportEditWindowDays,
  onViewReport,
  onEditReport,
}: Props) {
  const [search, setSearch] = useState('')
  const [expandedJobKeys, setExpandedJobKeys] = useState<Set<string>>(new Set())

  const filteredReports = useMemo(() => {
    const q = search.trim()
    if (!q) return reports
    return reports.filter((r) => matchesSearch(r, q))
  }, [reports, search])

  const jobsWithReports = useMemo(() => {
    const map = new Map<string, { jobDisplayName: string; reports: ReportForMyReports[] }>()
    for (const r of filteredReports) {
      const key = getJobKey(r)
      const existing = map.get(key)
      if (existing) {
        existing.reports.push(r)
      } else {
        map.set(key, { jobDisplayName: r.job_display_name ?? 'Unknown job', reports: [r] })
      }
    }
    for (const entry of map.values()) {
      entry.reports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    return Array.from(map.entries()).sort((a, b) => {
      const aLatest = a[1].reports[0]?.created_at ?? ''
      const bLatest = b[1].reports[0]?.created_at ?? ''
      return new Date(bLatest).getTime() - new Date(aLatest).getTime()
    })
  }, [filteredReports])

  const editWindowMs = reportEditWindowDays * 24 * 60 * 60 * 1000

  function toggleJob(key: string) {
    setExpandedJobKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 360,
          maxWidth: 560,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>My Reports</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#6b7280', lineHeight: 1 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by job or contents"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #d1d5db', borderRadius: 4, flexShrink: 0 }}
        />

        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {jobsWithReports.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              {search.trim() ? 'No reports match your search.' : 'No reports yet.'}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {jobsWithReports.map(([jobKey, { jobDisplayName, reports: jobReports }]) => {
                const isExpanded = expandedJobKeys.has(jobKey)
                return (
                  <li key={jobKey} style={{ marginBottom: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => toggleJob(jobKey)}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        textAlign: 'left',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        background: isExpanded ? '#f9fafb' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.875rem',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{jobDisplayName}</span>
                      <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>
                        {jobReports.length} report{jobReports.length !== 1 ? 's' : ''}
                        <span style={{ marginLeft: '0.5rem' }}>{isExpanded ? '▼' : '▶'}</span>
                      </span>
                    </button>
                    {isExpanded && (
                      <ul style={{ listStyle: 'none', padding: '0.5rem 0 0 1rem', margin: 0, borderLeft: '2px solid #e5e7eb', marginLeft: '0.75rem' }}>
                        {jobReports.map((r) => {
                          const isWithinEditWindow = new Date(r.created_at).getTime() >= Date.now() - editWindowMs
                          return (
                            <li key={r.id} style={{ marginBottom: '0.5rem' }}>
                              <div
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 6,
                                  background: '#fff',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                }}
                              >
                                <div
                                  style={{ flex: 1, minWidth: 0 }}
                                  onClick={() => onViewReport(r)}
                                >
                                  <span style={{ fontWeight: 500 }}>{r.template_name}</span>
                                  <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                    {new Date(r.created_at).toLocaleString()}
                                  </div>
                                </div>
                                {isWithinEditWindow && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onEditReport(r)
                                    }}
                                    style={{ flexShrink: 0, padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
