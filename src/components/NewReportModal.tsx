import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import type { Database } from '../types/database'
import type { UserRole } from '../hooks/useAuth'

type ReportTemplate = Database['public']['Tables']['report_templates']['Row']
type ReportTemplateField = Database['public']['Tables']['report_template_fields']['Row']
type Report = Database['public']['Tables']['reports']['Row']

type JobSearchResult = { id: string; source: 'job_ledger' | 'project'; display_name: string; hcp_number: string; address?: string }

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  authUserId: string | null
  userRole?: UserRole | null
  initialJob?: { id: string; source: 'job_ledger' | 'project'; display_name: string; hcp_number: string; address?: string }
  initialTemplateName?: string
}

export default function NewReportModal({ open, onClose, onSaved, authUserId, userRole, initialJob, initialTemplateName }: Props) {
  const { showToast } = useToastContext()
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [templateFields, setTemplateFields] = useState<Record<string, ReportTemplateField[]>>({})
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [jobSearchText, setJobSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<JobSearchResult[]>([])
  const [selectedJob, setSelectedJob] = useState<JobSearchResult | null>(null)
  const [lastReportJob, setLastReportJob] = useState<JobSearchResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchMode, setSearchMode] = useState<'search' | 'last'>('search')
  const [copyJustClicked, setCopyJustClicked] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase.from('report_templates').select('*').order('sequence_order').then(({ data }) => {
      const list = (data as ReportTemplate[]) ?? []
      setTemplates(list)
      if (list.length > 0) {
        if (initialTemplateName) {
          const match = list.find((t) => t.name.toLowerCase() === initialTemplateName!.toLowerCase())
          setSelectedTemplateId(match?.id ?? list[0]!.id)
        } else if (!selectedTemplateId) {
          setSelectedTemplateId(list[0]!.id)
        }
      }
    })
  }, [open, initialTemplateName])

  useEffect(() => {
    if (open && initialJob) {
      setSelectedJob(initialJob)
      setSearchMode('search')
    }
  }, [open, initialJob])

  useEffect(() => {
    if (!selectedTemplateId) return
    supabase
      .from('report_template_fields')
      .select('*')
      .eq('template_id', selectedTemplateId)
      .order('sequence_order')
      .then(({ data }) => {
        const fields = (data as ReportTemplateField[]) ?? []
        setTemplateFields((prev) => ({ ...prev, [selectedTemplateId]: fields }))
        setFieldValues({})
      })
  }, [selectedTemplateId])

  useEffect(() => {
    if (!open || !authUserId) return
    supabase
      .from('reports')
      .select('id, job_ledger_id, project_id, created_at')
      .eq('created_by_user_id', authUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        const r = data as (Report & { job_ledger_id?: string; project_id?: string }) | null
        if (!r) {
          setLastReportJob(null)
          return
        }
        const source = r.job_ledger_id ? 'job_ledger' : 'project'
        const id = r.job_ledger_id ?? r.project_id
        if (!id) return
        const { data: row } = await supabase.rpc('get_job_display_for_report', { p_source: source, p_id: id })
        const first = (row as JobSearchResult[] | null)?.[0]
        if (first) setLastReportJob(first)
      })
  }, [open, authUserId])

  useEffect(() => {
    if (!open || searchMode !== 'search') return
    const q = jobSearchText.trim()
    supabase.rpc('search_jobs_for_reports', { search_text: q }).then(async ({ data }) => {
      let raw = (data as JobSearchResult[] | null) ?? []
      if (raw.length > 0) {
        const jobIds = raw.filter((r) => r.source === 'job_ledger').map((r) => r.id)
        const jobAddrMap: Record<string, string> = {}
        if (jobIds.length > 0) {
          const { data: jobRows } = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds })
          for (const r of (jobRows ?? []) as { id: string; job_address?: string }[]) {
            jobAddrMap[r.id] = r.job_address ?? ''
          }
        }
        raw = raw.map((r) => ({
          ...r,
          address: (r.address && r.address.trim()) || (r.source === 'job_ledger' ? jobAddrMap[r.id] : r.address ?? '') || '',
        }))
      }
      setSearchResults(raw)
    })
  }, [open, jobSearchText, searchMode])

  function reset() {
    setSelectedJob(null)
    setJobSearchText('')
    setSearchResults([])
    setFieldValues({})
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleCopyToText() {
    const fields = templateFields[selectedTemplateId] ?? []
    const parts: string[] = []
    if (selectedJob) {
      parts.push(`Job: ${selectedJob.display_name}${selectedJob.hcp_number ? ` (HCP: ${selectedJob.hcp_number})` : ''}`)
    }
    for (const f of fields) {
      const val = (fieldValues[f.label] ?? '').trim()
      if (val) parts.push(`${f.label}:\n${val}`)
    }
    let text = parts.join('\n\n')
    if (!text) return
    // iOS Safari treats text with "Word:" patterns as a URL and URL-encodes it when pasting.
    // Insert U+2066 (LEFT-TO-RIGHT ISOLATE) before label colons to prevent this.
    text = text.replace(/(^|\n)([^\s:]+):/g, '$1$2\u2066:')
    try {
      await navigator.clipboard.writeText(text)
      setCopyJustClicked(true)
      setTimeout(() => setCopyJustClicked(false), 1500)
      showToast('Copied to clipboard', 'success')
    } catch (err) {
      console.error('Failed to copy:', err)
      showToast('Failed to copy to clipboard', 'error')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!authUserId || !selectedJob || !selectedTemplateId) return
    setSaving(true)
    setError(null)
    const fields = templateFields[selectedTemplateId] ?? []
    const fv: Record<string, string> = {}
    for (const f of fields) {
      fv[f.label] = fieldValues[f.label] ?? ''
    }
    const jobLedgerId = selectedJob.source === 'job_ledger' ? selectedJob.id : null
    const projectId = selectedJob.source === 'project' ? selectedJob.id : null

    let reportedAtLat: number | null = null
    let reportedAtLng: number | null = null
    if ('geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 60000,
          })
        })
        reportedAtLat = pos.coords.latitude
        reportedAtLng = pos.coords.longitude
      } catch {
        // Proceed without location
      }
    }

    let inserted: { id: string } | null = null
    let err: { message: string } | null = null

    if (userRole === 'estimator') {
      // Use RPC - SECURITY DEFINER bypasses RLS (fixes estimator insert policy issues)
      const { data: reportId, error: rpcErr } = await supabase.rpc('insert_report', {
        p_template_id: selectedTemplateId,
        p_field_values: fv,
        p_job_ledger_id: jobLedgerId,
        p_project_id: projectId,
        p_reported_at_lat: reportedAtLat ?? undefined,
        p_reported_at_lng: reportedAtLng ?? undefined,
      })
      err = rpcErr
      if (reportId && typeof reportId === 'string') inserted = { id: reportId }
    } else {
      const { data: sessionUser } = await supabase.auth.getUser()
      const createdByUserId = sessionUser?.user?.id ?? authUserId
      const { data: row, error: insertErr } = await supabase.from('reports').insert({
        template_id: selectedTemplateId,
        created_by_user_id: createdByUserId,
        field_values: fv,
        job_ledger_id: jobLedgerId ?? null,
        project_id: projectId ?? null,
        ...(reportedAtLat != null &&
          reportedAtLng != null && { reported_at_lat: reportedAtLat, reported_at_lng: reportedAtLng }),
      }).select('id').single()
      err = insertErr
      inserted = row ?? null
    }
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onSaved()
    handleClose()
    if (inserted?.id) {
      try {
        await supabase.functions.invoke('send-report-notification', { body: { report_id: inserted.id } })
      } catch {
        // Non-blocking: report was created; notification is best-effort
      }
    }
  }

  if (!open) return null

  const fields = templateFields[selectedTemplateId] ?? []
  const canSubmit = selectedJob && selectedTemplateId && authUserId

  const missingFields: string[] = []
  if (!selectedJob) missingFields.push('Job')
  if (!selectedTemplateId) missingFields.push('Report type')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 65 }}>
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>New report</h2>
          <button type="button" onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <p style={{ margin: 0, fontWeight: 500 }}>Select job *</p>
              {lastReportJob && (
                <button
                  type="button"
                  onClick={() => {
                    if (searchMode === 'last') {
                      setSelectedJob(null)
                      setSearchMode('search')
                    } else {
                      setSearchMode('last')
                      setSelectedJob(lastReportJob)
                      setSearchResults([])
                      setJobSearchText('')
                    }
                  }}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: searchMode === 'last' ? '2px solid #3b82f6' : '1px solid #d1d5db', background: searchMode === 'last' ? '#eff6ff' : 'white', borderRadius: 4, cursor: 'pointer' }}
                >
                  Same job as last report
                </button>
              )}
            </div>
            {selectedJob && (
              <div style={{ margin: 0, padding: '0.5rem', background: '#f3f4f6', borderRadius: 4 }}>
                <div>Selected: {selectedJob.display_name} (HCP: {selectedJob.hcp_number || '—'})</div>
                {selectedJob.address && <div style={{ marginTop: '0.25rem', color: '#4b5563', fontSize: '0.875rem' }}>{selectedJob.address}</div>}
              </div>
            )}
            {lastReportJob && (
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
                recent report location:{' '}
                <button
                  type="button"
                  onClick={() => {
                    setSearchMode('last')
                    setSelectedJob(lastReportJob)
                    setSearchResults([])
                    setJobSearchText('')
                  }}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#2563eb', textDecoration: 'underline', font: 'inherit' }}
                >
                  {lastReportJob.display_name}{lastReportJob.hcp_number ? ` (HCP: ${lastReportJob.hcp_number})` : ''}
                </button>
              </p>
            )}
            <input
              type="text"
              value={jobSearchText}
              onChange={(e) => { setJobSearchText(e.target.value); setSearchMode('search'); setSelectedJob(null) }}
              placeholder="Search by HCP #, project name, or address"
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
            {searchMode === 'search' && searchResults.length > 0 && (
              <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                {searchResults.map((r) => (
                  <button
                    key={`${r.source}-${r.id}`}
                    type="button"
                    onClick={() => { setSelectedJob(r); setSearchResults([]) }}
                    style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', border: 'none', background: selectedJob?.id === r.id ? '#eff6ff' : 'white', cursor: 'pointer', borderBottom: '1px solid #e5e7eb' }}
                  >
                    {r.display_name} {r.hcp_number ? `(HCP: ${r.hcp_number})` : ''}{r.address ? `  -  ${r.address}` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Report type</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(t.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    border: selectedTemplateId === t.id ? '2px solid #3b82f6' : '1px solid #d1d5db',
                    background: selectedTemplateId === t.id ? '#eff6ff' : 'white',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontWeight: selectedTemplateId === t.id ? 600 : 400,
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {fields.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              {fields.map((f) => (
                <div key={f.id} style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{f.label}</label>
                  <textarea
                    value={fieldValues[f.label] ?? ''}
                    onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.label]: e.target.value }))}
                    rows={3}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
              ))}
            </div>
          )}

          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCopyToText}
              disabled={fields.length === 0 || !fields.some((f) => (fieldValues[f.label] ?? '').trim())}
              style={{
                padding: '0.5rem 1rem',
                border: copyJustClicked ? '1px solid #22c55e' : '1px solid #d1d5db',
                background: copyJustClicked ? '#dcfce7' : 'white',
                borderRadius: 4,
                cursor: 'pointer',
                color: copyJustClicked ? '#16a34a' : undefined,
                fontWeight: copyJustClicked ? 600 : undefined,
              }}
            >
              {copyJustClicked ? 'Copied!' : 'Copy to Text'}
            </button>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleClose} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={!canSubmit || saving} title={!canSubmit ? `Required: ${missingFields.join(', ')}` : undefined} style={{ padding: '0.5rem 1rem', background: canSubmit && !saving ? '#2563eb' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: canSubmit && !saving ? 'pointer' : 'not-allowed' }}>{saving ? 'Saving…' : 'Save report'}</button>
              {!canSubmit && !saving && missingFields.length > 0 && (
                <span style={{ fontSize: '0.8rem', color: '#FF6600', marginLeft: '0.5rem', display: 'inline-block' }}>
                <span style={{ display: 'block' }}>Required:</span>
                {missingFields.map((f) => (
                  <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>{f}</span>
                ))}
              </span>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
