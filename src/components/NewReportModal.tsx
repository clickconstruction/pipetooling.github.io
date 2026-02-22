import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type ReportTemplate = Database['public']['Tables']['report_templates']['Row']
type ReportTemplateField = Database['public']['Tables']['report_template_fields']['Row']
type Report = Database['public']['Tables']['reports']['Row']

type JobSearchResult = { id: string; source: 'job_ledger' | 'project'; display_name: string; hcp_number: string }

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  authUserId: string | null
}

export default function NewReportModal({ open, onClose, onSaved, authUserId }: Props) {
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

  useEffect(() => {
    if (!open) return
    supabase.from('report_templates').select('*').order('sequence_order').then(({ data }) => {
      setTemplates((data as ReportTemplate[]) ?? [])
      if ((data?.length ?? 0) > 0 && !selectedTemplateId) {
        setSelectedTemplateId((data as ReportTemplate[])[0]!.id)
      }
    })
  }, [open, selectedTemplateId])

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
    supabase.rpc('search_jobs_for_reports', { search_text: q }).then(({ data }) => {
      setSearchResults((data as JobSearchResult[]) ?? [])
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
    const payload = {
      template_id: selectedTemplateId,
      created_by_user_id: authUserId,
      field_values: fv,
      job_ledger_id: selectedJob.source === 'job_ledger' ? selectedJob.id : null,
      project_id: selectedJob.source === 'project' ? selectedJob.id : null,
    }
    const { error: err } = await supabase.from('reports').insert(payload)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onSaved()
    handleClose()
  }

  if (!open) return null

  const fields = templateFields[selectedTemplateId] ?? []
  const canSubmit = selectedJob && selectedTemplateId && authUserId

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>New report</h2>
          <button type="button" onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <p style={{ margin: 0, fontWeight: 500 }}>Select job</p>
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
              <p style={{ margin: 0, padding: '0.5rem', background: '#f3f4f6', borderRadius: 4 }}>Selected: {selectedJob.display_name} (HCP: {selectedJob.hcp_number || '—'})</p>
            )}
            <input
              type="text"
              value={jobSearchText}
              onChange={(e) => { setJobSearchText(e.target.value); setSearchMode('search'); setSelectedJob(null) }}
              placeholder="Search by HCP # or project name"
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
                    {r.display_name} {r.hcp_number ? `(HCP: ${r.hcp_number})` : ''}
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

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleClose} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={!canSubmit || saving} style={{ padding: '0.5rem 1rem', background: canSubmit && !saving ? '#2563eb' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: canSubmit && !saving ? 'pointer' : 'not-allowed' }}>{saving ? 'Saving…' : 'Save report'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
